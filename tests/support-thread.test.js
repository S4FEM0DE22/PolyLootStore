import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import customerApi from '../handlers/customer.js';
import adminApi from '../handlers/admin.js';
import supportApi from '../handlers/support.js';
import { handleSupportThread } from '../handlers/support-thread.js';
import { getNotifications } from '../lib/notifications.js';
import { sendSupportReplyEmail, supportReplyEmail } from '../lib/support-email.js';
import { customer } from '../lib/customer-auth.js';

const origin = 'http://localhost:3000';
const post = (path, data, cookie = '', source = origin) => new Request(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: source }, body: JSON.stringify(data) });
const get = (path, cookie = '') => new Request(origin + path, { headers: { Cookie: cookie } });
test('support conversation enforces ownership, idempotency, roles, reopening and notifications', async () => {
  const users = [];
  for (let i = 0; i < 2; i++) {
    const tag = randomUUID().slice(0, 8);
    const result = await customerApi.fetch(post('/api/customer', { action: 'register', username: `thread_${tag}`, email: `${tag}@example.test`, password: 'TestThreadPassword123!', name: 'Thread Test' }));
    assert.equal(result.status, 201);
    const cookie = result.headers.get('set-cookie').split(';')[0];
    users.push({ cookie, user: await customer(get('/api/support', cookie)) });
  }
  const [owner, other] = users;
  process.env.ADMIN_PASSWORD = 'ThreadAdminPassword123!';
  const login = await adminApi.fetch(post('/api/admin', { action: 'login', password: process.env.ADMIN_PASSWORD }));
  const adminCookie = login.headers.get('set-cookie').split(';')[0];
  const created = await supportApi.fetch(post('/api/support', { category: 'DOWNLOAD', message: 'Please help with this downloaded model.' }, owner.cookie));
  const id = (await created.json()).ticket.id;
  assert.equal((await supportApi.fetch(get(`/api/support?id=${id}`, other.cookie))).status, 404);
  assert.equal((await handleSupportThread(get(`/api/admin/support?id=${id}`, owner.cookie), true)).status, 401);
  const payload = { action: 'reply', id, messageId: randomUUID(), message: '<script>alert(1)</script> Here is the solution.', author: 'customer' };
  const send = () => handleSupportThread(post('/api/admin/support', payload, adminCookie), true);
  const first = await send(); assert.equal(first.status, 200);
  const firstData = await first.json();
  assert.equal(firstData.messages[0].author, 'admin');
  assert.equal(firstData.messages[0].emailStatus, 'DEMO');
  const repeat = await send(); assert.equal((await repeat.json()).messages.length, 1);
  assert.equal((await handleSupportThread(post('/api/admin/support', { ...payload, message: 'Changed' }, adminCookie), true)).status, 409);
  const own = await supportApi.fetch(get(`/api/support?id=${id}`, owner.cookie));
  const ownData = await own.json();
  assert.equal(ownData.messages[0].emailStatus, undefined);
  assert.equal(ownData.ticket.email, undefined);
  const options = { limit: 100, offset: 0, unread: false, type: 'support', since: null };
  const feed = await getNotifications(owner.user.id, options);
  assert.ok(feed.notifications.some(row => row.status === 'ADMIN_REPLY' && row.href === `#ticket/${id}`));
  assert.ok(!(await getNotifications(other.user.id, options)).notifications.some(row => row.detail === id));
  await adminApi.fetch(post('/api/admin', { action: 'set-ticket-status', id, status: 'RESOLVED' }, adminCookie));
  const reply = { action: 'reply', id, messageId: randomUUID(), message: 'The issue is still present.', author: 'admin' };
  assert.equal((await supportApi.fetch(post('/api/support', reply, other.cookie))).status, 404);
  assert.equal((await supportApi.fetch(post('/api/support', reply, owner.cookie, 'https://evil.example'))).status, 403);
  const customerReply = await supportApi.fetch(post('/api/support', reply, owner.cookie));
  const customerData = await customerReply.json();
  assert.equal(customerData.ticket.status, 'OPEN');
  assert.equal(customerData.messages[1].author, 'customer');
  assert.ok((await getNotifications('admin', options)).notifications.some(row => row.status === 'CUSTOMER_REPLY' && row.detail === id));
  assert.ok(!(await getNotifications(owner.user.id, options)).notifications.some(row => row.status === 'CUSTOMER_REPLY' && row.detail === id));
});
test('support reply email escapes hostile content and links to an authenticated thread', () => {
  const result = supportReplyEmail({ id: 'SP-0123456789ABCDEF' }, { body: '<p><img src=x onerror=alert(1)></p>\nReply' }, 'https://poly-loot-store.vercel.app');
  assert.ok(result.html.includes('&lt;img'));
  assert.ok(!result.html.includes('<img src=x'));
  assert.ok(result.text.includes('/#ticket/SP-0123456789ABCDEF'));
});

test('support email retries use identical payload/key and persist failures without losing replies', async () => {
  const names = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'RESEND_API_KEY', 'RESEND_FROM_EMAIL'];
  const old = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, { SUPABASE_URL: 'https://fixture.supabase.test', SUPABASE_SECRET_KEY: 'sb_secret_fixture', RESEND_API_KEY: 're_fixture', RESEND_FROM_EMAIL: 'support@example.test' });
  const message = { id: randomUUID(), ticket_id: 'SP-0123456789ABCDEF', author_role: 'admin', body: 'Answer', email_status: 'PENDING', created_at: new Date().toISOString() };
  const ticket = { id: message.ticket_id, email: 'customer@example.test' };
  const sends = []; let persisted;
  globalThis.fetch = async (url, options) => {
    if (url === 'https://api.resend.com/emails') {
      sends.push({ body: options.body, key: options.headers['Idempotency-Key'] });
      return sends.length === 1 ? new Response('{}', { status: 503 }) : Response.json({ id: 'provider-fixture-id' });
    }
    assert.equal(options.method, 'PATCH'); persisted = JSON.parse(options.body);
    return Response.json([{ ...message, ...persisted }]);
  };
  try {
    const result = await sendSupportReplyEmail(ticket, message, 'https://store.example.test');
    assert.equal(result.email_status, 'SENT'); assert.equal(persisted.email_id, 'provider-fixture-id');
    assert.equal(sends.length, 2); assert.deepEqual(sends[0], sends[1]);
    globalThis.fetch = async (url, options) => url === 'https://api.resend.com/emails' ? new Response('{}', { status: 403 }) : Response.json([{ ...message, ...JSON.parse(options.body) }]);
    assert.equal((await sendSupportReplyEmail(ticket, message, 'https://store.example.test')).email_status, 'FAILED');
    await assert.rejects(sendSupportReplyEmail(ticket, { ...message, email_attempt_at: new Date().toISOString() }, 'https://store.example.test', true), /60/);
    await assert.rejects(sendSupportReplyEmail(ticket, { ...message, created_at: new Date(Date.now() - 24 * 3600000).toISOString() }, 'https://store.example.test', true), /23/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of names) if (old[name] === undefined) delete process.env[name]; else process.env[name] = old[name];
  }
});
