import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const file = path.join(process.cwd(), '.data', 'notification-events.json');
let queue = Promise.resolve();
async function read() {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return { events: [], receipts: {} }; throw error; }
}
function write(action) {
  const task = queue.then(async () => {
    const data = await read();
    const result = action(data);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(data, null, 2));
    return result;
  });
  queue = task.catch(() => {});
  return task;
}
export function orderEvents(order) {
  const states = [['PENDING', order.created_at], ...(order.paid_at ? [['PAID', order.paid_at]] : []), ...(order.cancelled_at ? [['CANCELLED', order.cancelled_at]] : [])];
  return states.map(([status, createdAt]) => ({ id: `order:${order.id}:${status}`, type: 'order', status, customerId: order.customer_id || null, detail: order.id, createdAt, href: `#order/${order.id}` }));
}
export function ticketEvent(ticket, changed = false) {
  return { id: `ticket:${ticket.id}:${ticket.status}${changed ? ':' + randomUUID() : ''}`, type: 'support', status: ticket.status, customerId: ticket.customer_id, detail: ticket.id, createdAt: changed ? new Date().toISOString() : ticket.created_at, href: '#help' };
}
export function announcementEvent(settings) {
  return { id: 'announcement:' + createHash('sha256').update(settings.announcement + (settings.updated_at || '')).digest('hex'), type: 'announcement', status: 'NEW', customerId: null, detail: settings.announcement, createdAt: settings.updated_at || new Date(0).toISOString(), href: '#help' };
}
export async function recordLocalEvents(events) {
  return write(data => {
    const ids = new Set(data.events.map(item => item.id));
    for (const event of events) if (!ids.has(event.id)) { data.events.push(event); ids.add(event.id); }
  });
}
export async function localNotificationFeed(viewer, options, seed = []) {
  await write(data => {
    for (const item of seed) if (!data.events.some(event => event.id === item.id || (item.type !== 'order' && event.type === item.type && event.detail === item.detail && event.status === item.status))) data.events.push(item);
  });
  const data = await read();
  const readIds = new Set([...(data.receipts[viewer] || []), ...(options.legacyRead || [])]);
  const all = data.events.filter(item => viewer === 'admin' ? item.type !== 'announcement' : (item.customerId === viewer || item.type === 'announcement') && options.types.includes(item.type)).map(item => ({ ...item, read: readIds.has(item.id) })).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  const filtered = all.filter(item => (!options.since || Date.parse(item.createdAt) >= Date.parse(options.since)) && (!options.unread || !item.read) && (!options.type || item.type === options.type));
  return { notifications: filtered.slice(options.offset, options.offset + options.limit), total: filtered.length, unreadCount: all.filter(item => !item.read).length, hasMore: options.offset + options.limit < filtered.length };
}
export async function markLocalNotifications(viewer, ids) {
  return write(data => { data.receipts[viewer] = [...new Set([...(data.receipts[viewer] || []), ...ids])]; });
}
