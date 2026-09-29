import { emailConfigured } from './delivery.js';
import { isLocalDemo, updateSupportEmail } from './store.js';
import { escapeHtml, renderEmailLayout } from './email-templates.js';

export function supportReplyEmail(ticket, message, origin) {
  const url = `${origin}/#ticket/${ticket.id}`;
  const subject = `PolyLoot: ผู้ดูแลตอบคำร้อง ${ticket.id}`;
  return { subject, text: `${subject}\n\n${message.body}\n\nดูบทสนทนาและตอบกลับ: ${url}\nกรุณาตอบผ่านระบบ ไม่ส่งรหัสผ่านหรือข้อมูลลับ`,
    html: renderEmailLayout({ title: subject, heading: 'ผู้ดูแลตอบคำร้องของคุณแล้ว', introText: `<p style="white-space:pre-wrap;font-size:16px">${escapeHtml(message.body)}</p>`, primaryCta: { text: 'ดูคำร้องและตอบกลับ', url }, fallbackUrlText: url, noticeText: 'กรุณาตอบผ่านระบบ และไม่ส่งรหัสผ่านหรือข้อมูลลับ', isDemo: false }) };
}

// Persisted per-message outbox; retry reuses the exact body and event key.
export async function sendSupportReplyEmail(ticket, message, origin, retry = false) {
  if (message.author_role !== 'admin' || ['SENT', 'DEMO'].includes(message.email_status)) return message;
  if (retry && (Date.now() - Date.parse(message.created_at) > 23 * 3600000 || Date.now() - Date.parse(message.email_attempt_at || 0) < 60000)) throw Object.assign(new Error('ลองส่งซ้ำได้หลัง 60 วินาที และภายใน 23 ชั่วโมงจากข้อความเดิม'), { status: 429 });
  const attempt = new Date().toISOString();
  let status = isLocalDemo() ? 'DEMO' : !emailConfigured() ? 'NOT_CONFIGURED' : 'FAILED';
  let emailId = null;
  if (!isLocalDemo() && emailConfigured()) {
    const payload = supportReplyEmail(ticket, message, origin);
    for (let i = 0; i < 2; i++) {
      try {
        const response = await fetch('https://api.resend.com/emails', { method: 'POST', signal: AbortSignal.timeout(6000),
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `support-reply-${message.id}` },
          body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM, to: [ticket.email], ...payload }) });
        if (response.ok) { const result = await response.json(); status = 'SENT'; emailId = result.id; break; }
        if (response.status !== 429 && response.status < 500) break;
      } catch { /* Do not log provider secrets or lose a saved reply. */ }
      if (i === 0) await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  return updateSupportEmail(ticket.id, message.id, { email_status: status, email_id: emailId, email_attempt_at: attempt });
}
