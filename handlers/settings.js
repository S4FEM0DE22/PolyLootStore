import { createHash } from 'node:crypto';
import { isAdmin } from '../lib/admin-auth.js';
import { customer, sameOrigin } from '../lib/customer-auth.js';
import { body, fail, json, validateEmail } from '../lib/http.js';
import { getCustomerPreferences, getStoreSettings, listCustomerOrders, listCustomerTickets, setCustomerPreferences, setStoreSettings } from '../lib/store.js';

const preferenceKeys = ['theme', 'language', 'notify_orders', 'notify_support', 'notify_announcements'];

async function notifications(user, preferences, settings) {
  const [orders, tickets] = await Promise.all([listCustomerOrders(user.id), listCustomerTickets(user.id)]);
  const rows = [];
  if (preferences.notify_orders) for (const order of orders) rows.push({
    id: `order:${order.id}:${order.status}`, type: 'order', status: order.status,
    title: order.status === 'PAID' ? 'สินค้าในคำสั่งซื้อพร้อมดาวน์โหลด' : order.status === 'CANCELLED' ? 'คำสั่งซื้อถูกยกเลิก' : 'ได้รับคำสั่งซื้อแล้ว',
    detail: order.id, href: `#order/${order.id}`, createdAt: order.paid_at || order.cancelled_at || order.created_at
  });
  if (preferences.notify_support) for (const ticket of tickets) rows.push({
    id: `ticket:${ticket.id}:${ticket.status}`, type: 'support', status: ticket.status,
    title: ticket.status === 'RESOLVED' ? 'คำร้องดำเนินการแล้ว' : ticket.status === 'IN_PROGRESS' ? 'กำลังตรวจสอบคำร้อง' : 'รับคำร้องแล้ว',
    detail: ticket.id, href: '#help', createdAt: ticket.created_at
  });
  if (preferences.notify_announcements && settings.announcement) rows.push({
    id: 'announcement:' + createHash('sha256').update(settings.announcement).digest('hex').slice(0, 16),
    type: 'announcement', status: 'NEW', title: 'ประกาศจากร้าน', detail: settings.announcement,
    href: '#help', createdAt: settings.updated_at || new Date(0).toISOString()
  });
  const read = new Set(preferences.read_ids || []);
  return rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 100).map(item => ({ ...item, read: read.has(item.id) }));
}

export default { async fetch(request) {
  try {
    const url = new URL(request.url);
    if (request.method === 'GET') {
      const settings = await getStoreSettings();
      if (url.searchParams.get('view') !== 'customer') return json({ settings });
      const user = await customer(request);
      if (!user) return json({ error: 'กรุณาเข้าสู่ระบบ' }, 401);
      const preferences = await getCustomerPreferences(user.id);
      return json({ settings, preferences, notifications: await notifications(user, preferences, settings) });
    }
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    sameOrigin(request);
    const input = await body(request);
    if (input.action === 'update-store') {
      if (!isAdmin(request)) return json({ error: 'กรุณาเข้าสู่ระบบผู้ดูแล' }, 401);
      const email = typeof input.contact_email === 'string' ? input.contact_email.trim().toLowerCase() : '';
      const phone = typeof input.contact_phone === 'string' ? input.contact_phone.trim() : '';
      const hours = typeof input.support_hours === 'string' ? input.support_hours.trim() : '';
      const announcement = typeof input.announcement === 'string' ? input.announcement.trim() : '';
      const faq = input.faq;
      if ((email && !validateEmail(email)) || phone.length > 40 || !/^[0-9+()\- .]*$/.test(phone) || hours.length > 120 || announcement.length > 240 || !Array.isArray(faq) || faq.length > 8 || faq.some(row => typeof row?.question !== 'string' || typeof row?.answer !== 'string' || !row.question.trim() || !row.answer.trim() || row.question.length > 150 || row.answer.length > 500)) return json({ error: 'ตรวจข้อมูลติดต่อ ประกาศ และคำถามที่พบบ่อย' }, 400);
      return json({ settings: await setStoreSettings({ contact_email: email, contact_phone: phone, support_hours: hours, announcement, faq: faq.map(row => ({ question: row.question.trim(), answer: row.answer.trim() })) }) });
    }
    const user = await customer(request);
    if (!user) return json({ error: 'กรุณาเข้าสู่ระบบ' }, 401);
    if (input.action === 'set-preferences') {
      if (!input.preferences || typeof input.preferences !== 'object' || Array.isArray(input.preferences) || Object.keys(input.preferences).some(key => !preferenceKeys.includes(key))) return json({ error: 'ข้อมูลการตั้งค่าไม่ถูกต้อง' }, 400);
      const value = input.preferences;
      if ((value.theme != null && !['light', 'dark', 'system'].includes(value.theme)) || (value.language != null && !['th', 'en'].includes(value.language)) || ['notify_orders', 'notify_support', 'notify_announcements'].some(key => value[key] != null && typeof value[key] !== 'boolean')) return json({ error: 'ข้อมูลการตั้งค่าไม่ถูกต้อง' }, 400);
      const updated = await setCustomerPreferences(user.id, value);
      return json({ preferences: updated });
    }
    if (input.action === 'mark-read' || input.action === 'mark-all-read') {
      const settings = await getStoreSettings();
      const preferences = await getCustomerPreferences(user.id);
      const available = (await notifications(user, preferences, settings)).map(item => item.id);
      const ids = input.action === 'mark-all-read' ? available : [input.id];
      if (ids.some(id => typeof id !== 'string' || !available.includes(id))) return json({ error: 'ไม่พบการแจ้งเตือน' }, 404);
      const read_ids = [...new Set([...(preferences.read_ids || []), ...ids])].slice(-200);
      await setCustomerPreferences(user.id, { read_ids });
      return json({ success: true });
    }
    return json({ error: 'คำสั่งไม่ถูกต้อง' }, 400);
  } catch (error) { return fail(error); }
} };
