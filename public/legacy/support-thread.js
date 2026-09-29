import { t, translateCommon } from './settings-ui.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const statusName = value => ({ OPEN: t('รับเรื่องแล้ว', 'Open'), IN_PROGRESS: t('กำลังตรวจสอบ', 'In progress'), RESOLVED: t('ดำเนินการแล้ว', 'Resolved') })[value] || value;
const stamp = value => new Date(value).toLocaleString(document.documentElement.lang === 'en' ? 'en-US' : 'th-TH');
export async function mountSupportThread(container, { id, admin = false, onUpdate = () => {} }) {
  const endpoint = admin ? '/api/admin/support' : '/api/support';
  let state;
  let pending = null;
  const request = async payload => {
    const response = await fetch(payload ? endpoint : `${endpoint}?id=${encodeURIComponent(id)}`, { cache: 'no-store', credentials: 'same-origin', ...(payload ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...payload }) } : {}) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || t('ระบบขัดข้อง', 'Request failed'));
    return result;
  };
  container.innerHTML = `<p role="status">${t('กำลังโหลดคำร้อง...', 'Loading conversation…')}</p>`;
  const renderMessages = () => {
    const items = [{ id: 'original', author: 'customer', message: state.ticket.message, createdAt: state.ticket.createdAt }, ...state.messages];
    container.querySelector('[data-thread-status]').textContent = statusName(state.ticket.status);
    container.querySelector('[data-thread-messages]').innerHTML = items.map(m => `<article class="support-bubble support-bubble-${m.author}"><div><strong>${m.author === 'admin' ? t('ผู้ดูแลร้าน', 'Store admin') : t('ลูกค้า', 'Customer')}</strong><time datetime="${esc(m.createdAt)}">${esc(stamp(m.createdAt))}</time></div><p>${esc(m.message)}</p>${admin && m.author === 'admin' ? `<small>${t('อีเมล', 'Email')}: ${esc(({ SENT: t('ผู้ให้บริการรับเมลแล้ว', 'Accepted by email provider'), DEMO: 'DEMO', NOT_CONFIGURED: t('ยังไม่ได้ตั้งค่าอีเมล', 'Email not configured'), FAILED: t('ส่งไม่สำเร็จ', 'Failed'), PENDING: t('รอส่ง', 'Pending') })[m.emailStatus] || m.emailStatus)}</small>${['FAILED', 'PENDING', 'NOT_CONFIGURED'].includes(m.emailStatus) ? `<button type="button" class="mini" data-retry-email="${esc(m.id)}">${t('ลองส่งอีเมลอีกครั้ง', 'Retry email')}</button>` : ''}` : ''}</article>`).join('');
    const messages = container.querySelector('[data-thread-messages]');
    messages.scrollTop = messages.scrollHeight;
    translateCommon(container);
  };
  try {
    state = await request();
    if (!container.isConnected) return;
    container.innerHTML = `<section class="support-thread"><header class="support-thread-head"><div><h2>${esc(id)}</h2><p>${t('สถานะ', 'Status')}: <strong data-thread-status></strong>${state.ticket.orderId ? ` · ${esc(state.ticket.orderId)}` : ''}</p>${admin ? `<p>${esc(state.ticket.email)}</p>` : ''}</div><button type="button" class="mini" data-thread-refresh>${t('ตรวจข้อความใหม่', 'Check new messages')}</button></header><div class="support-conversation" data-thread-messages aria-label="${t('บทสนทนาคำร้อง', 'Support conversation')}"></div><form class="support-reply-form"><label>${t('ข้อความตอบกลับ', 'Reply')}<textarea class="field" name="message" rows="4" maxlength="4000" required placeholder="${t('ไม่ส่งรหัสผ่านหรือข้อมูลลับ', 'Do not share passwords or secrets')}"></textarea></label><p>${t('ข้อความใหม่จากลูกค้าจะเปิดคำร้องที่ปิดแล้วอีกครั้ง', 'A customer reply reopens a resolved request.')}</p><div class="support-thread-result" role="status" aria-live="polite"></div><button class="${admin ? 'primary' : 'pill-button dark'}" type="submit">${t('ส่งข้อความ', 'Send reply')}</button></form></section>`;
    renderMessages();
    const feedback = text => { container.querySelector('.support-thread-result').textContent = text; };
    const form = container.querySelector('form');
    form.addEventListener('submit', async event => {
      event.preventDefault(); const button = form.querySelector('[type="submit"]');
      const message = form.elements.namedItem('message').value.trim();
      if (!message) return;
      // Retain the request ID after a network failure: Retry cannot duplicate a saved reply.
      if (!pending || pending.message !== message) pending = { action: 'reply', message, messageId: crypto.randomUUID() };
      button.disabled = true; feedback(t('กำลังส่งข้อความ…', 'Sending…'));
      try { state = await request(pending); if (!container.isConnected) return; pending = null; form.reset(); renderMessages(); feedback(t('บันทึกข้อความแล้ว', 'Reply saved')); onUpdate(); }
      catch (error) { if (container.isConnected) feedback(error.message); }
      finally { button.disabled = false; }
    });
    container.querySelector('[data-thread-refresh]').addEventListener('click', async event => {
      const button = event.currentTarget; button.disabled = true;
      try { state = await request(); if (container.isConnected) { renderMessages(); feedback(t('อัปเดตบทสนทนาแล้ว', 'Conversation updated')); } }
      catch (error) { if (container.isConnected) feedback(error.message); }
      finally { button.disabled = false; }
    });
    container.addEventListener('click', async event => {
      const button = event.target.closest('[data-retry-email]'); if (!button) return;
      button.disabled = true;
      try { state = await request({ action: 'retry-email', messageId: button.dataset.retryEmail }); if (container.isConnected) { renderMessages(); feedback(t('ตรวจสถานะอีเมลแล้ว', 'Email status updated')); } }
      catch (error) { if (container.isConnected) { feedback(error.message); button.disabled = false; } }
    });
  } catch (error) { if (container.isConnected) container.innerHTML = `<p class="error" role="alert">${esc(error.message)}</p><button class="mini" type="button" data-retry-thread>${t('ลองใหม่', 'Retry')}</button>`; container.querySelector('[data-retry-thread]')?.addEventListener('click', () => mountSupportThread(container, { id, admin, onUpdate })); }
}
