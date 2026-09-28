import { getCustomerPreferences, getStoreSettings, isLocalDemo, listCustomerOrders, listCustomerTickets, listOrders, listSupportTickets } from './store.js';
import { announcementEvent, localNotificationFeed, markLocalNotifications, orderEvents, ticketEvent } from './notification-events.js';

const titles = { PENDING: 'ได้รับคำสั่งซื้อแล้ว', PAID: 'สินค้าในคำสั่งซื้อพร้อมดาวน์โหลด', CANCELLED: 'คำสั่งซื้อถูกยกเลิก', OPEN: 'รับคำร้องแล้ว', IN_PROGRESS: 'กำลังตรวจสอบคำร้อง', RESOLVED: 'คำร้องดำเนินการแล้ว', NEW: 'ประกาศจากร้าน' };
export function notificationOptions(params) {
  const limit = Number(params.get('limit') || 20), offset = Number(params.get('offset') || 0);
  const days = params.get('days'), filter = params.get('filter') || 'all', type = params.get('type') || '';
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0 || offset > 1000000 || (days != null && days !== '7') || !['all', 'unread'].includes(filter) || !['', 'order', 'support', 'announcement'].includes(type)) throw Object.assign(new Error('ตัวกรองไม่ถูกต้อง'), { status: 400 });
  return { limit, offset, unread: filter === 'unread', type, since: days === '7' ? new Date(Date.now() - 7 * 86400000).toISOString() : null };
}
async function rpc(name, payload) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw Object.assign(new Error('ยังไม่ได้ตั้งค่า Supabase'), { status: 503 });
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(payload), cache: 'no-store' });
  if (!response.ok) throw Object.assign(new Error('ระบบแจ้งเตือนขัดข้อง กรุณาลองใหม่'), { status: 503 });
  return response.json();
}
async function context(viewer) {
  const preferences = viewer === 'admin' ? {} : await getCustomerPreferences(viewer);
  const types = viewer === 'admin' ? ['order', 'support'] : ['order', 'support', 'announcement'].filter(type => preferences[{ order: 'notify_orders', support: 'notify_support', announcement: 'notify_announcements' }[type]]);
  return { types, legacyRead: preferences.read_ids || [] };
}
export async function getNotifications(viewer, options) {
  const ctx = await context(viewer);
  let result;
  if (isLocalDemo()) {
    const [orders, tickets, settings] = await Promise.all([viewer === 'admin' ? listOrders(1000000) : listCustomerOrders(viewer), viewer === 'admin' ? listSupportTickets() : listCustomerTickets(viewer), getStoreSettings()]);
    result = await localNotificationFeed(viewer, { ...options, ...ctx }, [...orders.flatMap(orderEvents), ...tickets.map(item => ticketEvent(item)), ...(settings.announcement ? [announcementEvent(settings)] : [])]);
  } else result = await rpc('notification_feed', { p_viewer: viewer, p_types: ctx.types, p_legacy_read: ctx.legacyRead, p_since: options.since, p_unread: options.unread, p_type: options.type, p_offset: options.offset, p_limit: options.limit });
  result.notifications = result.notifications.map(item => ({ id: item.id, type: item.type, status: item.status, detail: item.detail, createdAt: item.createdAt, read: item.read, href: viewer === 'admin' ? (item.type === 'order' ? 'orders' : 'support') : item.href, title: titles[item.status] || 'การแจ้งเตือน' }));
  return result;
}
export async function markNotifications(viewer, ids, all = false, before = new Date().toISOString()) {
  if (!isLocalDemo()) {
    const ctx = await context(viewer);
    const count = await rpc('notification_mark_read', { p_viewer: viewer, p_types: ctx.types, p_ids: all ? null : ids, p_before: before });
    if (!all && count !== ids.length) throw Object.assign(new Error('ไม่พบการแจ้งเตือน'), { status: 404 });
    return;
  }
  const available = [];
  for (let offset = 0; ; offset += 100) {
    const page = await getNotifications(viewer, { limit: 100, offset, unread: false, type: '', since: null });
    available.push(...page.notifications.filter(item => Date.parse(item.createdAt) <= Date.parse(before)).map(item => item.id));
    if (!page.hasMore) break;
  }
  const owned = all ? available : ids;
  if (owned.some(id => !available.includes(id))) throw Object.assign(new Error('ไม่พบการแจ้งเตือน'), { status: 404 });
  await markLocalNotifications(viewer, owned);
}
