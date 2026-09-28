import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Isolated demo data; never use production credentials or customer records.
delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SECRET_KEY; delete process.env.VERCEL;
process.env.ADMIN_PASSWORD = 'NotificationTestAdminPassword123!';
process.chdir(await mkdtemp(path.join(tmpdir(), 'polyloot-notifications-')));
const { default: customerApi } = await import('../handlers/customer.js');
const { customer } = await import('../lib/customer-auth.js');
const { default: handler, notificationHandler } = await import('../handlers/notifications.js');
const { default: adminApi } = await import('../handlers/admin.js');
const store = await import('../lib/store.js');
const { recordLocalEvents } = await import('../lib/notification-events.js');
const { notificationOptions } = await import('../lib/notifications.js');
// Minimal browser globals for the existing settings module's boot-time hooks.
globalThis.MutationObserver = class { observe() {} };
globalThis.document = { documentElement: { dataset: {} }, title: '' };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
const { recentNotifications, notificationRow } = await import('../public/legacy/notification-center.js');
const base = 'http://localhost:3000';
const post = (url, input, cookie, origin = base) => new Request(base + url, { method: 'POST', headers: { Cookie: cookie || '', Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
const get = (query = '', cookie = '') => handler.fetch(new Request(base + '/api/notifications' + query, { headers: { Cookie: cookie } }));
let cookie, otherCookie, user, adminCookie;
test.before(async () => {
  for (const name of ['first', 'second']) {
    const response = await customerApi.fetch(post('/api/customer', { action: 'register', username: 'notif_' + name, email: name + '@example.test', password: 'TestPassword123!', first: name, last: 'User' }));
    assert.equal(response.status, 201);
    if (name === 'first') { cookie = response.headers.get('set-cookie').split(';')[0]; user = await customer(new Request(base + '/api/notifications', { headers: { Cookie: cookie } })); }
    else otherCookie = response.headers.get('set-cookie').split(';')[0];
  }
  const response = await adminApi.fetch(post('/api/admin', { action: 'login', password: process.env.ADMIN_PASSWORD }));
  adminCookie = response.headers.get('set-cookie').split(';')[0];
});
test('seven day boundary, unread filter and invalid pagination are enforced', async () => {
  const now = Date.now();
  assert.deepEqual(recentNotifications([{ createdAt: new Date(now - 7 * 86400000).toISOString() }, { createdAt: new Date(now - 7 * 86400000 - 1).toISOString() }, { createdAt: 'invalid' }], now).length, 1);
  for (const query of ['limit=0', 'offset=-1', 'days=30', 'filter=bogus', 'type=bogus']) assert.throws(() => notificationOptions(new URLSearchParams(query)));
  assert.equal((await get('?limit=0', cookie)).status, 400);
  await recordLocalEvents([{ id: 'old', customerId: user.id, type: 'order', status: 'PENDING', detail: 'old', href: '#history', createdAt: new Date(now - 8 * 86400000).toISOString() }]);
  const recent = await (await get('?days=7', cookie)).json();
  assert.equal(recent.notifications.some(item => item.id === 'old'), false);
  assert.equal((await (await get('', cookie)).json()).notifications.some(item => item.id === 'old'), true);
});
test('order and support transitions preserve history with real update times', async () => {
  const time = new Date(Date.now() - 10 * 86400000).toISOString();
  await store.createOrder({ id: 'GA-AAAAAAAAAAAAAAAAAAAAAAAA', customer_id: user.id, status: 'PENDING', created_at: time });
  await store.updateOrder('GA-AAAAAAAAAAAAAAAAAAAAAAAA', { status: 'PAID', paid_at: new Date().toISOString() });
  await store.createTicket({ id: 'SUP-TEST', customer_id: user.id, status: 'OPEN', created_at: time });
  await store.updateTicketStatus('SUP-TEST', 'IN_PROGRESS');
  await store.updateTicketStatus('SUP-TEST', 'RESOLVED');
  const all = await (await get('', cookie)).json();
  assert.equal(all.notifications.filter(item => item.detail === 'GA-AAAAAAAAAAAAAAAAAAAAAAAA').length, 2);
  assert.equal(all.notifications.filter(item => item.detail === 'SUP-TEST').length, 3);
  const recent = await (await get('?days=7', cookie)).json();
  assert.equal(recent.notifications.filter(item => item.detail === 'SUP-TEST').length, 2);
  await store.updateTicketStatus('SUP-TEST', 'RESOLVED');
  assert.equal((await (await get('', cookie)).json()).notifications.filter(item => item.detail === 'SUP-TEST').length, 3);
});
test('privacy, mark-read persistence, idempotency and CSRF protection', async () => {
  const mine = await (await get('', cookie)).json();
  const item = mine.notifications.find(row => row.type === 'order');
  assert.equal((await get()).status, 401);
  assert.equal((await (await get('', otherCookie)).json()).notifications.some(row => row.id === item.id), false);
  assert.equal((await handler.fetch(post('/api/notifications', { action: 'mark-read', id: item.id }, otherCookie))).status, 404);
  assert.equal((await handler.fetch(post('/api/notifications', { action: 'mark-read', id: item.id }, cookie, 'https://evil.example'))).status, 403);
  for (let n = 0; n < 2; n++) assert.equal((await handler.fetch(post('/api/notifications', { action: 'mark-read', id: item.id }, cookie))).status, 200);
  assert.equal((await (await get('', cookie)).json()).notifications.find(row => row.id === item.id).read, true);
  assert.equal((await (await get('?filter=unread', cookie)).json()).notifications.some(row => row.id === item.id), false);
});
test('all pages are reachable and mark-all-read handles more than 100 without dropping receipts', async () => {
  const stamp = new Date().toISOString();
  await recordLocalEvents(Array.from({ length: 125 }, (_, i) => ({ id: 'pagination-' + i, customerId: user.id, type: 'order', status: 'PENDING', detail: String(i), href: '#history', createdAt: stamp })));
  const first = await (await get('?limit=100', cookie)).json();
  const second = await (await get('?limit=100&offset=100', cookie)).json();
  assert.equal(first.hasMore, true); assert.equal(second.hasMore, false);
  assert.equal(new Set([...first.notifications, ...second.notifications].map(item => item.id)).size, first.total);
  assert.equal((await handler.fetch(post('/api/notifications', { action: 'mark-all-read' }, cookie))).status, 200);
  assert.equal((await (await get('', cookie)).json()).unreadCount, 0);
  await recordLocalEvents([{ id: 'after-read', customerId: user.id, type: 'order', status: 'PAID', detail: 'new', href: '#history', createdAt: new Date(Date.now() + 1).toISOString() }]);
  assert.equal((await (await get('', cookie)).json()).unreadCount, 1);
});
test('preferences suppress types; announcements survive updates without duplicate contact-edit alerts', async () => {
  await store.setStoreSettings({ announcement: 'First notice' });
  await store.setStoreSettings({ announcement: 'Second notice' });
  await store.setStoreSettings({ contact_phone: '123' });
  const all = await (await get('', cookie)).json();
  assert.equal(all.notifications.filter(item => item.type === 'announcement').length, 2);
  await store.setCustomerPreferences(user.id, { notify_orders: false, notify_support: false });
  assert.equal((await (await get('', cookie)).json()).notifications.every(item => item.type === 'announcement'), true);
});
test('admin feed requires admin session and read state is separate from customers', async () => {
  const admin = notificationHandler(true);
  const request = value => new Request(base + '/api/admin/notifications', { headers: { Cookie: value || '' } });
  assert.equal((await admin.fetch(request(cookie))).status, 401);
  const feed = await (await admin.fetch(request(adminCookie))).json();
  assert.ok(feed.unreadCount > 0); assert.ok(feed.notifications.every(item => ['orders', 'support'].includes(item.href)));
  assert.equal((await admin.fetch(post('/api/admin/notifications', { action: 'mark-all-read' }, adminCookie))).status, 200);
  assert.equal((await (await admin.fetch(request(adminCookie))).json()).unreadCount, 0);
});
test('notification UI escapes untrusted content', () => {
  const html = notificationRow({ id: '"><script>', detail: '<img src=x onerror=alert(1)>', status: 'NEW', type: 'announcement', createdAt: new Date().toISOString(), read: false });
  assert.equal(html.includes('<img'), false); assert.equal(html.includes('<script>'), false); assert.ok(html.includes('&lt;img'));
});
