import { randomBytes } from 'node:crypto';
import { customer, sameOrigin } from '../lib/customer-auth.js';
import { body, fail, json } from '../lib/http.js';
import { createTicket, getOrder, listCustomerTickets } from '../lib/store.js';

const categories = new Set(['DOWNLOAD', 'ORDER', 'PRODUCT', 'ACCOUNT', 'OTHER']);
const publicTicket = row => ({ id: row.id, category: row.category, orderId: row.order_id, message: row.message, status: row.status, createdAt: row.created_at });

export default { async fetch(request) {
  try {
    const user = await customer(request);
    if (!user) return json({ error: 'กรุณาเข้าสู่ระบบก่อนแจ้งปัญหา' }, 401);
    if (request.method === 'GET') return json({ tickets: (await listCustomerTickets(user.id)).map(publicTicket) });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    sameOrigin(request);
    const input = await body(request);
    const category = String(input.category || 'OTHER');
    const message = typeof input.message === 'string' ? input.message.trim() : '';
    const orderId = typeof input.orderId === 'string' ? input.orderId.trim().toUpperCase() : '';
    if (!categories.has(category) || message.length < 10 || message.length > 2000) return json({ error: 'กรุณาเลือกหัวข้อและเขียนรายละเอียด 10–2,000 ตัวอักษร' }, 400);
    if (orderId) {
      if (!/^GA-[A-F0-9]{24}$/.test(orderId)) return json({ error: 'เลขคำสั่งซื้อไม่ถูกต้อง' }, 400);
      const order = await getOrder(orderId);
      if (!order || order.customer_id !== user.id) return json({ error: 'ไม่พบคำสั่งซื้อในบัญชีนี้' }, 404);
    }
    const ticket = await createTicket({ id: `SP-${randomBytes(8).toString('hex').toUpperCase()}`, customer_id: user.id, email: user.email, category, order_id: orderId || null, message, status: 'OPEN', created_at: new Date().toISOString() });
    return json({ ticket: publicTicket(ticket) }, 201);
  } catch (error) { return fail(error); }
} };
