import { validAndroidCode, validAndroidState } from '../../../../lib/android-oauth.js';

export function GET(request) {
  const params = new URL(request.url).searchParams;
  const code = params.get('code');
  const state = params.get('state');
  const valid = [...params.keys()].every(key => key === 'code' || key === 'state') && params.getAll('code').length === 1 && params.getAll('state').length === 1 && validAndroidCode(code) && validAndroidState(state);
  const target = valid ? `com.polyloot.customer://oauth/callback?code=${code}&amp;state=${state}` : '/#login';
  // Explicit user gesture works even when browsers block automatic custom-scheme
  // redirects. Never accept a caller-supplied scheme, target, token or verifier.
  return new Response(`<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>กลับเข้า PolyLoot</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f8f2;color:#18251d;font-family:system-ui,sans-serif}main{margin:24px;padding:40px;border-radius:40px;background:#c0ff72;max-width:440px}h1{font-size:28px}a{display:inline-block;margin-top:16px;padding:14px 24px;border-radius:999px;background:#233d2d;color:white;text-decoration:none}p{line-height:1.8}</style><main><h1>${valid ? 'เข้าสู่ระบบ Google แล้ว' : 'ลิงก์เข้าสู่ระบบไม่ถูกต้อง'}</h1><p>${valid ? 'กดกลับเข้าแอปเพื่อยืนยันบัญชีให้เสร็จ รหัสนี้ใช้ได้ครั้งเดียวภายใน 5 นาที และใช้ได้เฉพาะแอปที่เริ่มเข้าสู่ระบบ' : 'กรุณาเปิดแอป PolyLoot แล้วเริ่มเข้าสู่ระบบ Google ใหม่'}</p><a href="${target}">${valid ? 'กลับเข้าแอป PolyLoot' : 'กลับหน้าเข้าสู่ระบบ'}</a></main></html>`, {
    status: valid ? 200 : 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'" }
  });
}
