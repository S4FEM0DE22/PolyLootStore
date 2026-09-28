// Public production integration checks. No login credentials, customer writes,
// cookies, verifier, auth codes or provider state are recorded in the report.
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import policy from '../apps/desktop/policy.cjs';
const origin = policy.validateAppUrl(process.env.POLYLOOT_APP_URL || JSON.parse(readFileSync(new URL('../apps/config.json', import.meta.url), 'utf8')).appUrl);
const state = randomBytes(32).toString('base64url');
const verifier = randomBytes(32).toString('base64url');
const challenge = createHash('sha256').update(verifier).digest('base64url');
const callback = `${origin}/auth/android/callback?state=${state}`;
const checks = [];
const get = url => fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20000) });
try {
  const start = await get(`${origin}/auth/android/start?challenge=${challenge}&state=${state}`);
  assert.equal(start.status, 302);
  const authorize = new URL(start.headers.get('location'));
  assert.equal(authorize.protocol, 'https:');
  assert.ok(authorize.hostname.endsWith('.supabase.co'));
  assert.equal(authorize.pathname, '/auth/v1/authorize');
  assert.equal(authorize.searchParams.get('code_challenge_method'), 's256');
  assert.equal(authorize.searchParams.get('code_challenge'), challenge);
  assert.equal(authorize.searchParams.get('redirect_to'), callback);
  checks.push('Deployed start route uses S256 and the fixed callback');

  const provider = await get(authorize.href);
  assert.equal(provider.status, 302);
  const google = new URL(provider.headers.get('location'));
  assert.equal(google.protocol, 'https:');
  assert.equal(google.hostname, 'accounts.google.com');
  // Some deployed Auth versions use opaque state. Only claim redirect
  // acceptance if inspectable provider state contains the exact referrer;
  // otherwise actual account-owner callback is required. Never save state.
  const providerState = google.searchParams.get('state');
  assert.ok(providerState && providerState.length >= 20);
  if (providerState.split('.').length === 3) {
    const payload = JSON.parse(Buffer.from(providerState.split('.')[1], 'base64url').toString('utf8'));
    assert.equal(payload.referrer, callback, 'Supabase did not accept the Android HTTPS callback');
    checks.push('Live Supabase Google authorize accepts the HTTPS callback');
  } else {
    checks.push('Live Supabase starts Google authorization with opaque state; redirect acceptance requires actual callback');
  }

  const code = randomBytes(24).toString('hex'); // Fabricated, cannot create a session.
  const landing = await get(`${callback}&code=${code}`);
  assert.equal(landing.status, 200);
  assert.equal(landing.headers.get('cache-control'), 'no-store');
  assert.equal(landing.headers.get('referrer-policy'), 'no-referrer');
  const html = await landing.text();
  assert.match(html, /com\.polyloot\.customer:\/\/oauth\/callback\?code=/);
  assert.doesNotMatch(html, /access_token|refresh_token|code_verifier/);
  assert.equal((await get(`${callback}&code=${code}&code=duplicate`)).status, 400);
  assert.equal((await get(`${origin}/auth/android/start`)).status, 400);
  checks.push('Callback renders safe return link; malformed/duplicate requests fail');

  for (const input of [{ action: 'android-google-session', code, verifier }, { action: 'google-session', accessToken: 'demo-google-token-verification' }]) {
    const rejected = await fetch(`${origin}/api/customer`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(20000) });
    assert.equal(rejected.status, 401);
    assert.equal(rejected.headers.get('set-cookie'), null);
  }
  checks.push('Fabricated code and demo token rejected in production; no session issued');
  const dir = resolve('.data/live-verification'); mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'android-oauth-live.json'), JSON.stringify({ date: new Date().toISOString(), origin, checks, googleProviderLoginCompleted: false, physicalDeviceTested: false }, null, 2) + '\n');
  console.log(checks.join('\n'));
  console.log('Google login/consent and native authenticated return still require the account owner.');
} catch (error) {
  // Assertion errors can include a provider state/URL; do not print actual/expected.
  console.error(`OAuth integration check failed: ${checks.length} completed checks; ${error.code || error.name}. No secrets recorded.`);
  process.exitCode = 1;
}
