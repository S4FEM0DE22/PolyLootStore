import { verifyGoogleToken } from './customer-auth.js';

const invalid = () => Object.assign(new Error('คำขอเข้าสู่ระบบไม่ถูกต้อง กรุณาเริ่มใหม่'), { status: 400 });
const nonce = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
export const validAndroidCode = value => typeof value === 'string' && /^[A-Za-z0-9_-]{20,256}$/.test(value);
export const validAndroidState = nonce;

export function getAndroidGoogleAuthUrl(origin, challenge, state) {
  if (!nonce(challenge) || !nonce(state)) throw invalid();
  const site = new URL(origin);
  if (site.protocol !== 'https:' || site.username || site.password || site.pathname !== '/' || site.search || site.hash) throw invalid();
  const supabase = process.env.SUPABASE_URL?.replace(/\/$/, '');
  if (!supabase) throw Object.assign(new Error('ยังไม่ได้ตั้งค่า Supabase'), { status: 503 });
  const callback = new URL('/auth/android/callback', site);
  callback.searchParams.set('state', state);
  const url = new URL(`${supabase}/auth/v1/authorize`);
  url.searchParams.set('provider', 'google');
  url.searchParams.set('redirect_to', callback.href);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 's256');
  return url.href;
}

// Only the requesting installation knows the verifier. Supabase codes expire in
// five minutes and are single-use; tokens never cross the Android deep link.
export async function exchangeAndroidGoogleCode(code, verifier) {
  if (!validAndroidCode(code) || typeof verifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) throw invalid();
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const apikey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !apikey) throw Object.assign(new Error('ยังไม่ได้ตั้งค่า Supabase'), { status: 503 });
  const response = await fetch(`${url}/auth/v1/token?grant_type=pkce`, {
    method: 'POST', headers: { apikey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw Object.assign(new Error('ลิงก์ Google หมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่'), { status: 401 });
  const session = await response.json();
  if (typeof session.access_token !== 'string' || !session.access_token || session.access_token.startsWith('demo-google-token')) {
    throw Object.assign(new Error('การยืนยันตัวตนด้วย Google ไม่สำเร็จ'), { status: 401 });
  }
  return verifyGoogleToken(session.access_token);
}
