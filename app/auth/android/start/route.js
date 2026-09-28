import { getAndroidGoogleAuthUrl } from '../../../../lib/android-oauth.js';

export function GET(request) {
  const url = new URL(request.url);
  const origin = process.env.PUBLIC_SITE_URL?.replace(/\/$/, '') || url.origin;
  try {
    const target = getAndroidGoogleAuthUrl(origin, url.searchParams.get('challenge'), url.searchParams.get('state'));
    return new Response(null, { status: 302, headers: { Location: target, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
