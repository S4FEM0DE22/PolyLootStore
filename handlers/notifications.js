import { isAdmin } from '../lib/admin-auth.js';
import { customer, sameOrigin } from '../lib/customer-auth.js';
import { body, fail, json } from '../lib/http.js';
import { getNotifications, markNotifications, notificationOptions } from '../lib/notifications.js';

export function notificationHandler(admin = false) {
  return { async fetch(request) {
    try {
      const viewer = admin ? (isAdmin(request) ? 'admin' : null) : (await customer(request))?.id;
      if (!viewer) return json({ error: 'กรุณาเข้าสู่ระบบ' }, 401);
      if (request.method === 'GET') return json({ ...await getNotifications(viewer, notificationOptions(new URL(request.url).searchParams)), fetchedAt: new Date().toISOString() });
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      sameOrigin(request);
      const input = await body(request);
      if (!['mark-read', 'mark-all-read'].includes(input.action)) return json({ error: 'คำสั่งไม่ถูกต้อง' }, 400);
      if (input.action === 'mark-read' && (typeof input.id !== 'string' || input.id.length > 250)) return json({ error: 'ข้อมูลไม่ถูกต้อง' }, 400);
      if (input.before != null && (!Number.isFinite(Date.parse(input.before)) || Date.parse(input.before) > Date.now() + 5000)) return json({ error: 'เวลาไม่ถูกต้อง' }, 400);
      await markNotifications(viewer, [input.id], input.action === 'mark-all-read', input.before || new Date().toISOString());
      return json({ success: true });
    } catch (error) { return fail(error); }
  } };
}
export default notificationHandler();
