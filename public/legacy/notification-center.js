import { t, getDisplayPreferences } from './settings-ui.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const titles = { PENDING: ['ได้รับคำสั่งซื้อแล้ว', 'Order received'], PAID: ['สินค้าในคำสั่งซื้อพร้อมดาวน์โหลด', 'Assets ready to download'], CANCELLED: ['คำสั่งซื้อถูกยกเลิก', 'Order cancelled'], OPEN: ['รับคำร้องแล้ว', 'Request received'], IN_PROGRESS: ['กำลังตรวจสอบคำร้อง', 'Request in progress'], RESOLVED: ['คำร้องดำเนินการแล้ว', 'Request resolved'], NEW: ['ประกาศจากร้าน', 'Store announcement'] };
export function recentNotifications(items, now = Date.now()) {
  return items.filter(item => Number.isFinite(Date.parse(item.createdAt)) && Date.parse(item.createdAt) >= now - 7 * 86400000 && Date.parse(item.createdAt) <= now);
}
export function notificationRow(item) {
  const title = titles[item.status] || ['การแจ้งเตือน', 'Notification'];
  const locale = getDisplayPreferences().language === 'en' ? 'en-US' : 'th-TH';
  const date = new Date(item.createdAt);
  const time = Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date) : '—';
  return `<article class="nc-row ${item.read ? 'is-read' : 'is-unread'}"><span class="nc-symbol" aria-hidden="true">${({ order: '▣', support: '?', announcement: '✦' })[item.type] || '●'}</span><div class="nc-copy"><button type="button" class="nc-open" data-nc-open="${esc(item.id)}"><strong>${esc(t(...title))}</strong><span>${esc(item.detail)}</span></button><small>${item.read ? t('อ่านแล้ว', 'Read') : t('ยังไม่อ่าน', 'Unread')} · <time datetime="${esc(item.createdAt)}">${esc(time)}</time></small></div>${!item.read ? `<button type="button" class="nc-read" data-nc-read="${esc(item.id)}" aria-label="${esc(t('ทำเครื่องหมายว่าอ่านแล้ว', 'Mark as read') + ': ' + t(...title))}">✓</button>` : ''}</article>`;
}
export function notificationBell() {
  return `<div class="nc-wrap" id="notification-wrap"><button type="button" class="nc-bell nav-notifications" id="notification-toggle" aria-expanded="false" aria-controls="notification-dropdown" aria-label="${t('การแจ้งเตือน', 'Notifications')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span id="notification-count" hidden></span></button><section class="nc-dropdown" id="notification-dropdown" aria-label="${t('การแจ้งเตือนล่าสุด 7 วัน', 'Notifications from the last 7 days')}" hidden></section></div>`;
}
export class NotificationCenter {
  constructor({ endpoint = '/api/notifications', authenticated = () => true, navigate, onOpen = () => {}, onUnauthorized = () => {}, allHref = '#notifications' } = {}) {
    Object.assign(this, { endpoint, authenticated, navigate, onOpen, onUnauthorized, allHref });
    this.items = new Map(); this.unreadCount = 0; this.generation = 0; this.loading = false; this.pageGeneration = 0;
    document.addEventListener('click', event => {
      const trigger = event.target.closest('#notification-toggle');
      if (trigger) { this.toggle(); return; }
      const wrap = document.querySelector('#notification-wrap');
      if (wrap && !wrap.contains(event.target)) this.close();
      const action = event.target.closest('[data-nc-read],[data-nc-open],[data-nc-all],[data-nc-retry],[data-nc-more],[data-nc-show-all]');
      if (action) this.action(action, event);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.isOpen()) { event.preventDefault(); this.close(true); }
      if (event.key === 'ArrowDown' && event.target.id === 'notification-toggle') { event.preventDefault(); this.toggle(true); }
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.refresh(); });
    window.addEventListener('online', () => this.refresh());
    this.timer = setInterval(() => { if (!document.hidden) this.refresh(); }, 30000);
  }
  isOpen() { const node = document.querySelector('#notification-dropdown'); return node && !node.hidden; }
  close(focus = false) {
    const node = document.querySelector('#notification-dropdown');
    if (node) node.hidden = true;
    document.querySelector('#notification-toggle')?.setAttribute('aria-expanded', 'false');
    if (focus) document.querySelector('#notification-toggle')?.focus();
  }
  reset() { this.generation++; this.pageGeneration++; this.close(); document.querySelector('#notification-dropdown')?.replaceChildren(); this.items.clear(); this.rows = []; this.unreadCount = 0; this.badge(); }
  badge() {
    const badge = document.querySelector('#notification-count');
    if (badge) { badge.hidden = !this.authenticated() || this.unreadCount === 0; badge.textContent = this.unreadCount > 99 ? '99+' : String(this.unreadCount); }
    document.querySelector('#notification-toggle')?.setAttribute('aria-label', `${t('การแจ้งเตือน', 'Notifications')} · ${this.unreadCount} ${t('ยังไม่อ่าน', 'unread')}`);
    document.querySelector('.admin-alert-count')?.replaceChildren(String(this.unreadCount));
  }
  async request(query = '', input) {
    const response = await fetch(this.endpoint + query, { method: input ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', headers: input ? { 'Content-Type': 'application/json' } : {}, body: input ? JSON.stringify(input) : undefined });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401) { this.reset(); this.onUnauthorized(); }
      throw Object.assign(new Error(result.error || t('โหลดไม่สำเร็จ กรุณาลองใหม่', 'Unable to load. Please retry.')), { status: response.status });
    }
    return result;
  }
  remember(result) { for (const item of result.notifications) this.items.set(item.id, item); this.unreadCount = result.unreadCount; this.badge(); }
  async toggle(force = false) {
    if (this.isOpen() && !force) { this.close(); return; }
    this.onOpen();
    const node = document.querySelector('#notification-dropdown');
    if (!node) return;
    node.hidden = false;
    document.querySelector('#notification-toggle')?.setAttribute('aria-expanded', 'true');
    if (!this.authenticated()) {
      node.innerHTML = `<div class="nc-empty"><strong>${t('เข้าสู่ระบบเพื่อดูแจ้งเตือน', 'Sign in to see notifications')}</strong><a href="#login">${t('เข้าสู่ระบบ', 'Sign in')} →</a></div>`;
    } else await this.dropdown(true);
    if (force && this.isOpen()) node.querySelector('button,a')?.focus();
  }
  error(node, error, retry = 'dropdown') {
    if (!node?.isConnected) return;
    node.innerHTML = `<div class="nc-empty" role="status"><p>${esc(error.message)}</p><button type="button" data-nc-retry="${retry}">${t('ลองใหม่', 'Retry')}</button></div>`;
  }
  async dropdown(showLoading = false) {
    const node = document.querySelector('#notification-dropdown'), version = this.generation;
    if (!node || !this.authenticated()) return;
    if (showLoading) node.innerHTML = `<div class="nc-empty" role="status">${t('กำลังโหลด...', 'Loading...')}</div>`;
    try {
      const result = await this.request('?days=7&limit=20');
      if (version !== this.generation || !this.authenticated()) return;
      this.remember(result); this.before = result.fetchedAt;
      if (!node.isConnected || node.hidden) return;
      // Do not replace a control while the user is operating it during polling.
      if (!showLoading && node.contains(document.activeElement)) return;
      node.innerHTML = `<div class="nc-head"><div><strong>${t('การแจ้งเตือน', 'Notifications')}</strong><small>${t('ล่าสุด 7 วัน', 'Last 7 days')} · ${result.total} ${t('รายการ', 'updates')}</small></div>${result.unreadCount ? `<button type="button" data-nc-all>${t('อ่านทั้งหมด', 'Read all')}</button>` : ''}</div><div class="nc-list">${recentNotifications(result.notifications).map(notificationRow).join('') || `<div class="nc-empty">${t('ไม่มีแจ้งเตือนใน 7 วันล่าสุด', 'No notifications in the last 7 days')}</div>`}</div><div class="nc-footer"><a href="${this.allHref}" data-nc-show-all>${t('ดูการแจ้งเตือนทั้งหมด', 'View all notifications')} →</a>${result.hasMore ? `<small>${t('รายการที่เหลือดูได้ในหน้าทั้งหมด', 'See more on the full page')}</small>` : ''}</div><div class="nc-error" role="status"></div>`;
    } catch (error) { if (version === this.generation && !node.hidden) this.error(node, error); }
  }
  async refresh() {
    this.badge();
    if (!this.authenticated() || this.loading) return;
    this.loading = true;
    const version = this.generation;
    try {
      if (this.isOpen()) await this.dropdown();
      else { const result = await this.request('?limit=1'); if (version === this.generation && this.authenticated()) this.remember(result); }
      const page = document.querySelector('#notification-center-page');
      if (page && this.rows.length <= 100 && !page.contains(document.activeElement)) await this.loadPage(false, true);
    } catch (error) { if (error.status === 401) this.reset(); }
    finally { this.loading = false; }
  }
  async mountPage(node) {
    this.close(); this.pageGeneration++;
    this.filters = { filter: 'all', type: '' }; this.rows = []; this.offset = 0;
    node.id = 'notification-center-page'; node.classList.add('nc-page');
    node.innerHTML = `<div class="nc-page-head"><div><h2>${t('การแจ้งเตือนทั้งหมด', 'All notifications')}</h2><p class="nc-summary" aria-live="polite"></p></div><button type="button" data-nc-all>${t('ทำเครื่องหมายว่าอ่านทั้งหมด', 'Mark all as read')}</button></div><div class="nc-filters"><label>${t('สถานะ', 'Status')}<select data-nc-filter="filter"><option value="all">${t('ทั้งหมด', 'All')}</option><option value="unread">${t('ยังไม่อ่าน', 'Unread')}</option></select></label><label>${t('ประเภท', 'Type')}<select data-nc-filter="type"><option value="">${t('ทุกประเภท', 'All types')}</option><option value="order">${t('คำสั่งซื้อ', 'Orders')}</option><option value="support">${t('คำร้อง', 'Support')}</option>${this.endpoint.includes('/admin/') ? '' : `<option value="announcement">${t('ประกาศ', 'Announcements')}</option>`}</select></label><button type="button" data-nc-retry="page">${t('รีเฟรช', 'Refresh')}</button></div><div class="nc-page-list"></div><div class="nc-error" role="status"></div><button type="button" class="nc-more" data-nc-more hidden>${t('โหลดเพิ่ม', 'Load more')}</button>`;
    node.addEventListener('change', event => { const key = event.target.dataset.ncFilter; if (key) { this.filters[key] = event.target.value; this.loadPage(); } });
    await this.loadPage();
  }
  async loadPage(more = false, background = false) {
    const node = document.querySelector('#notification-center-page');
    if (!node || !this.authenticated()) return;
    const requestId = ++this.pageGeneration;
    const list = node.querySelector('.nc-page-list'), button = node.querySelector('[data-nc-more]');
    button.disabled = true;
    const offset = more ? this.rows.length : 0;
    const params = new URLSearchParams({ ...this.filters, offset: String(offset), limit: String(background ? Math.max(20, Math.min(this.rows.length, 100)) : 20) });
    if (!more && !background) list.innerHTML = `<div class="nc-empty" role="status">${t('กำลังโหลด...', 'Loading...')}</div>`;
    try {
      const result = await this.request('?' + params);
      if (!node.isConnected || requestId !== this.pageGeneration) return;
      this.remember(result); this.before = result.fetchedAt;
      this.rows = more ? [...this.rows, ...result.notifications.filter(item => !this.rows.some(row => row.id === item.id))] : result.notifications;
      list.innerHTML = this.rows.map(notificationRow).join('') || `<div class="nc-empty"><strong>${t('ไม่มีรายการในตัวกรองนี้', 'No notifications match this filter')}</strong><p>${t('แจ้งเตือนคำสั่งซื้อ คำร้อง และประกาศจะปรากฏที่นี่', 'Order, support and store updates will appear here.')}</p></div>`;
      node.querySelector('.nc-summary').textContent = `${result.total} ${t('รายการ', 'updates')} · ${result.unreadCount} ${t('ยังไม่อ่าน', 'unread')}`;
      node.querySelector('[data-nc-all]').disabled = result.unreadCount === 0;
      button.hidden = !result.hasMore; button.disabled = false;
      node.querySelector('.nc-error').textContent = '';
    } catch (error) { if (node.isConnected && requestId === this.pageGeneration) { if (!more && !background) this.error(list, error, 'page'); else node.querySelector('.nc-error').textContent = error.message; button.disabled = false; } }
  }
  async action(button, event) {
    if (button.hasAttribute('data-nc-show-all')) { this.close(); if (this.navigate) { event.preventDefault(); this.navigate('all'); } return; }
    if (button.dataset.ncRetry) { if (button.dataset.ncRetry === 'page') await this.loadPage(); else await this.dropdown(true); return; }
    if (button.hasAttribute('data-nc-more')) { await this.loadPage(true); return; }
    const id = button.dataset.ncRead || button.dataset.ncOpen;
    const item = this.items.get(id);
    const all = button.hasAttribute('data-nc-all');
    if (!all && !item) return;
    button.disabled = true;
    const node = button.closest('.nc-dropdown,.nc-page');
    try {
      if (all || !item.read) await this.request('', { action: all ? 'mark-all-read' : 'mark-read', id, ...(all && this.before ? { before: this.before } : {}) });
      if (button.dataset.ncOpen) { this.close(); if (this.navigate) this.navigate(item.href, item); else location.hash = item.href; }
      else { if (this.isOpen()) await this.dropdown(true); if (document.querySelector('#notification-center-page')) await this.loadPage(); }
      await this.refresh();
    } catch (error) { const feedback = node?.querySelector('.nc-error'); if (feedback) feedback.textContent = error.message; button.disabled = false; }
  }
}
