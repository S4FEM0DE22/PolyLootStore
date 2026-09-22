import { randomBytes } from 'node:crypto';
import { requireCustomer, sameOrigin } from '../lib/customer-auth.js';
import { body, fail, json, method, orderView } from '../lib/http.js';
import { createOrder, getAsset } from '../lib/store.js';

export default { async fetch(request) {
  try {
    method(request, 'POST');
    sameOrigin(request);
    const user = await requireCustomer(request);
    const input = await body(request);
    const ids = Array.isArray(input.assetIds) ? input.assetIds : [input.assetId];
    if (ids.length < 1 || ids.length > 20 || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) {
      return json({ error: 'เลือกแอสเซ็ตอย่างน้อยหนึ่งชุด' }, 400);
    }
    const assets = await Promise.all(ids.map(getAsset));
    const name = typeof input.name === 'string' ? input.name.trim() : user.name;
    if (assets.some(asset => !asset || asset.active === false) || name.length < 2 || name.length > 80) {
      return json({ error: 'กรุณาตรวจชื่อและแอสเซ็ตที่เลือก' }, 400);
    }
    const order = await createOrder({
      id: `GA-${randomBytes(12).toString('hex').toUpperCase()}`,
      asset_id: assets[0].id,
      asset_ids: assets.map(asset => asset.id),
      total_amount: assets.reduce((sum, asset) => sum + asset.price, 0),
      items_snapshot: assets.map(({ id, title, subtitle, description, cover, price, category, formats, engines, version, license }) => ({ id, title, subtitle, description, cover, price, category, formats, engines, version, license })),
      customer_id: user.id,
      customer_name: name,
      email: user.email,
      status: 'PENDING',
      email_status: 'NOT_SENT',
      created_at: new Date().toISOString()
    });
    return json({ order: orderView(order, assets) }, 201);
  } catch (error) { return fail(error); }
} };
