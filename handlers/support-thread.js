import { isAdmin } from '../lib/admin-auth.js';
import { customer, sameOrigin } from '../lib/customer-auth.js';
import { body, fail, json } from '../lib/http.js';
import { getSupportThread, replySupportTicket } from '../lib/store.js';
import { sendSupportReplyEmail } from '../lib/support-email.js';

const ticketId = value => typeof value === 'string' && /^SP-[A-F0-9]{16}$/.test(value);
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function threadView(thread, admin) {
  const row = thread.ticket;
  return { ticket: { id: row.id, category: row.category, status: row.status, orderId: row.order_id, message: row.message, createdAt: row.created_at, updatedAt: row.updated_at || row.created_at, ...(admin ? { email: row.email } : {}) },
    messages: thread.messages.map(m => ({ id: m.id, author: m.author_role, message: m.body, createdAt: m.created_at, ...(admin ? { emailStatus: m.email_status, emailAttemptAt: m.email_attempt_at } : {}) })) };
}
export async function handleSupportThread(request, admin = false, givenInput = null) {
  try {
    const user = admin ? null : await customer(request);
    if (admin ? !isAdmin(request) : !user) return json({ error: 'กรุณาเข้าสู่ระบบ' }, 401);
    if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed' }, 405);
    if (request.method === 'POST') sameOrigin(request);
    const input = request.method === 'POST' ? givenInput || await body(request) : {};
    const id = request.method === 'GET' ? new URL(request.url).searchParams.get('id') : input.id;
    if (!ticketId(id)) return json({ error: 'เลขคำร้องไม่ถูกต้อง' }, 400);
    const thread = await getSupportThread(id, admin ? null : user.id);
    if (!thread) return json({ error: 'ไม่พบคำร้อง' }, 404);
    if (request.method === 'GET') return json(threadView(thread, admin));
    if (input.action === 'retry-email' && admin) {
      const message = thread.messages.find(m => m.id === input.messageId && m.author_role === 'admin');
      if (!message) return json({ error: 'ไม่พบข้อความ' }, 404);
      await sendSupportReplyEmail(thread.ticket, message, new URL(request.url).origin, true);
    } else if (input.action === 'reply') {
      const text = typeof input.message === 'string' ? input.message.trim() : '';
      if (!uuid(input.messageId) || text.length < 1 || text.length > 4000) return json({ error: 'ข้อความต้องยาว 1–4,000 ตัวอักษร และมีรหัสคำขอที่ถูกต้อง' }, 400);
      const result = await replySupportTicket(id, user?.id || null, admin, input.messageId, text);
      if (admin && !result.reused) {
        // A saved reply remains successful if email bookkeeping/network fails.
        try { await sendSupportReplyEmail(result.ticket, result.message, new URL(request.url).origin); } catch { /* Outbox remains pending and manually retryable. */ }
      }
    } else return json({ error: 'คำสั่งไม่ถูกต้อง' }, 400);
    return json(threadView(await getSupportThread(id, admin ? null : user.id), admin));
  } catch (error) { return fail(error); }
}
