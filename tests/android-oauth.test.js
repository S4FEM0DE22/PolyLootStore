import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { getAndroidGoogleAuthUrl, exchangeAndroidGoogleCode } from '../lib/android-oauth.js';
import { verifyGoogleToken } from '../lib/customer-auth.js';
import { GET as callback } from '../app/auth/android/callback/route.js';
import signing from '../apps/desktop/signing-policy.cjs';
import customerApi from '../handlers/customer.js';

test('Android OAuth uses S256 and a fixed HTTPS callback with no token or verifier in URLs', () => {
  const previous = process.env.SUPABASE_URL;
  process.env.SUPABASE_URL = 'https://auth.example';
  try {
    const target = new URL(getAndroidGoogleAuthUrl('https://shop.example', 'a'.repeat(43), 'b'.repeat(43)));
    assert.equal(target.searchParams.get('code_challenge_method'), 's256');
    assert.equal(target.searchParams.get('code_challenge'), 'a'.repeat(43));
    assert.equal(target.searchParams.get('redirect_to'), 'https://shop.example/auth/android/callback?state=' + 'b'.repeat(43));
    assert.equal(target.searchParams.get('provider'), 'google');
    assert.doesNotMatch(target.href, /access_token|verifier=/);
    for (const origin of ['http://shop.example', 'https://shop.example/evil', 'https://user:pass@shop.example']) assert.throws(() => getAndroidGoogleAuthUrl(origin, 'a'.repeat(43), 'b'.repeat(43)));
    assert.throws(() => getAndroidGoogleAuthUrl('https://shop.example', 'short', 'b'.repeat(43)));
  } finally { if (previous === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous; }
});

test('Android callback is no-store, referrer-free and rejects injected/duplicate parameters', async () => {
  const valid = 'https://shop.example/auth/android/callback?code=' + 'c'.repeat(36) + '&state=' + 's'.repeat(43);
  const response = callback(new Request(valid));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.match(await response.text(), /com\.polyloot\.customer:\/\/oauth\/callback/);
  for (const url of [valid + '&code=duplicate', valid + '&state=duplicate', valid + '&error=access_denied', valid + '&access_token=secret', valid.replace('c'.repeat(36), '%22%3E%3Cscript%3E')]) assert.equal(callback(new Request(url)).status, 400);
});

test('PKCE success creates a private customer cookie and session survives reload without provider tokens', async () => {
  const names = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'DOWNLOAD_SECRET'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const oldFetch = globalThis.fetch;
  process.env.SUPABASE_URL = 'https://auth.example'; process.env.SUPABASE_SECRET_KEY = 'test-only'; process.env.DOWNLOAD_SECRET = 'test-session-secret'.repeat(3);
  const profile = { user_id: 'test-user-id', email: 'customer@example.com', username: 'customer_test', session_version: 1 };
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push(url);
    if (url.endsWith('/auth/v1/token?grant_type=pkce')) return Response.json({ access_token: 'provider-secret-token' });
    if (url.endsWith('/auth/v1/user')) {
      assert.equal(options.headers.Authorization, 'Bearer provider-secret-token');
      return Response.json({ id: profile.user_id, email: profile.email, user_metadata: { name: 'Test Customer' } });
    }
    if (url.includes('/rest/v1/customer_profiles?')) return Response.json([profile]);
    throw new Error('Unexpected mock endpoint');
  };
  try {
    const result = await customerApi.fetch(new Request('https://shop.example/api/customer', { method: 'POST', headers: { Origin: 'https://shop.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'android-google-session', code: 'c'.repeat(36), verifier: 'v'.repeat(43) }) }));
    assert.equal(result.status, 200);
    const cookie = result.headers.get('set-cookie');
    assert.match(cookie, /^polyloot_customer=.*HttpOnly; SameSite=Strict; Path=\/api;.*Secure/);
    assert.doesNotMatch(cookie, /provider-secret-token/);
    const response = await result.text();
    assert.doesNotMatch(response, /access_token|refresh_token|provider-secret-token|verifier/);
    const session = await customerApi.fetch(new Request('https://shop.example/api/customer?view=session', { headers: { Cookie: cookie.split(';')[0] } }));
    assert.equal((await session.json()).user.email, profile.email);
    assert.equal(requests.filter(url => url.includes('grant_type=pkce')).length, 1);
    const crossOrigin = await customerApi.fetch(new Request('https://shop.example/api/customer', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'android-google-session', code: 'c'.repeat(36), verifier: 'v'.repeat(43) }) }));
    assert.equal(crossOrigin.status, 403);
  } finally {
    globalThis.fetch = oldFetch;
    for (const name of names) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; }
  }
});

test('PKCE exchange rejects malformed or expired codes and never returns provider errors/tokens', async () => {
  await assert.rejects(exchangeAndroidGoogleCode('bad', 'v'.repeat(43)), { status: 400 });
  const oldFetch = globalThis.fetch;
  const previous = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY };
  process.env.SUPABASE_URL = 'https://auth.example'; process.env.SUPABASE_SECRET_KEY = 'test-only';
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://auth.example/auth/v1/token?grant_type=pkce');
    assert.deepEqual(JSON.parse(options.body), { auth_code: 'c'.repeat(36), code_verifier: 'v'.repeat(43) });
    return Response.json({ error: 'sensitive provider detail' }, { status: 400 });
  };
  try { await assert.rejects(exchangeAndroidGoogleCode('c'.repeat(36), 'v'.repeat(43)), { status: 401 }); }
  finally {
    globalThis.fetch = oldFetch;
    for (const [name, value] of [['SUPABASE_URL', previous.url], ['SUPABASE_SECRET_KEY', previous.key]]) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  }
});

test('production rejects demo Google tokens without network or local user creation', async () => {
  const previous = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY, demo: process.env.LOCAL_DEMO };
  process.env.SUPABASE_URL = 'https://auth.example'; process.env.SUPABASE_SECRET_KEY = 'test-only'; delete process.env.LOCAL_DEMO;
  try { await assert.rejects(verifyGoogleToken('demo-google-token-attacker'), { status: 401 }); }
  finally { for (const [name, value] of [['SUPABASE_URL', previous.url], ['SUPABASE_SECRET_KEY', previous.key], ['LOCAL_DEMO', previous.demo]]) { if (value === undefined) delete process.env[name]; else process.env[name] = value; } }
});

test('native PKCE policy executes strict callback/expiry checks on the JVM', t => {
  const javac = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', 'javac') : 'javac';
  const java = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', 'java') : 'java';
  const probe = spawnSync(javac, ['-version'], { encoding: 'utf8' });
  if (probe.error?.code === 'ENOENT') { t.skip('JDK required for native policy verification'); return; }
  const output = mkdtempSync(join(tmpdir(), 'polyloot-oauth-test-'));
  try {
    const files = ['../apps/android/app/src/main/java/com/polyloot/customer/OAuthRequest.java', '../apps/android/test/java/com/polyloot/customer/OAuthRequestTest.java'].map(path => fileURLToPath(new URL(path, import.meta.url)));
    const compiled = spawnSync(javac, ['-encoding', 'UTF-8', '-d', output, ...files], { encoding: 'utf8' });
    assert.equal(compiled.status, 0, compiled.stderr);
    const result = spawnSync(java, ['-cp', output, 'com.polyloot.customer.OAuthRequestTest'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  } finally { rmSync(output, { recursive: true, force: true }); }
});

test('signed Windows release requires a publisher and certificate, with force-signing enabled', () => {
  assert.throws(() => signing.releaseSigning({}), /publisher/i);
  assert.throws(() => signing.releaseSigning({ POLYLOOT_WINDOWS_PUBLISHER: 'PolyLoot' }), /No Windows signing certificate/);
  assert.throws(() => signing.releaseSigning({ POLYLOOT_WINDOWS_PUBLISHER: 'PolyLoot', POLYLOOT_WINDOWS_CERT_SHA1: 'invalid' }), /thumbprint/);
  assert.equal(signing.releaseSigning({ POLYLOOT_WINDOWS_PUBLISHER: 'PolyLoot', POLYLOOT_WINDOWS_CERT_SHA1: 'a'.repeat(40) }).publisherName, 'PolyLoot');
  assert.equal(signing.releaseSigning({ POLYLOOT_WINDOWS_PUBLISHER: 'PolyLoot', CSC_LINK: 'private.pfx' }).signingHashAlgorithms[0], 'sha256');
  assert.match(readFileSync(new URL('../apps/desktop/electron-builder.release.cjs', import.meta.url), 'utf8'), /forceCodeSigning: true/);
});
