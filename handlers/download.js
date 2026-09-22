import { localAssetBytes, resolveMimeType, signedAssetUrl, verifyDownloadToken } from '../lib/delivery.js';
import { fail, json, method } from '../lib/http.js';
import { getAsset, getOrder, isLocalDemo } from '../lib/store.js';

export default { async fetch(request) {
  try {
    method(request, 'GET');
    const token = new URL(request.url).searchParams.get('token');
    const grant = verifyDownloadToken(token);
    if (!grant) return json({ error: 'ลิงก์หมดอายุหรือไม่ถูกต้อง' }, 403);
    const order = await getOrder(grant.id);
    if (!order || order.status !== 'PAID') return json({ error: 'ยังไม่สามารถดาวน์โหลดได้' }, 403);
    const ids = Array.isArray(order.asset_ids) && order.asset_ids.length ? order.asset_ids : [order.asset_id];
    if (!ids.includes(grant.assetId)) return json({ error: 'ลิงก์ไม่ตรงกับแอสเซ็ต' }, 403);
    const asset = await getAsset(grant.assetId);
    if (!asset) return json({ error: 'ไม่พบแอสเซ็ต' }, 404);
    if (!isLocalDemo()) return Response.redirect(await signedAssetUrl(asset), 302);
    const bytes = await localAssetBytes(asset);
    return new Response(bytes, { headers: {
      'Content-Type': resolveMimeType(asset.file),
      'Content-Disposition': `attachment; filename="${asset.file}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    } });
  } catch (error) { return fail(error); }
} };
