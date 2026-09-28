import { getNotifications, markNotifications } from '../lib/notifications.js';
import { isAdmin } from '../lib/admin-auth.js';
import { customer, sameOrigin } from '../lib/customer-auth.js';
import { body, fail, json, validateEmail } from '../lib/http.js';
import { getCustomerPreferences, getStoreSettings, setCustomerPreferences, setStoreSettings } from '../lib/store.js';

const preferenceKeys = ['theme', 'language', 'notify_orders', 'notify_support', 'notify_announcements'];

async function notifications(user) {
  return (await getNotifications(user.id, { limit: 100, offset: 0, unread: false, type: '', since: null })).notifications;
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
      return json({ settings, preferences, notifications: await notifications(user) });
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
      if (input.action === 'mark-read' && typeof input.id !== 'string') return json({ error: 'ไม่พบการแจ้งเตือน' }, 404);
      await markNotifications(user.id, [input.id], input.action === 'mark-all-read');
      return json({ success: true });
    }
    return json({ error: 'คำสั่งไม่ถูกต้อง' }, 400);
  } catch (error) { return fail(error); }
} };
