import { applyDisplayPreferences, getDisplayPreferences, saveDisplayPreferences, t, translateCommon } from './settings-ui.js';
import { inspectZipFile } from './zip-inspect.js';
const app = document.querySelector('#app');
let data = { assets: [], orders: [], customers: [], tickets: [], emailConfigured: false };
let storeSettings = { contact_email: '', contact_phone: '', support_hours: '', announcement: '', faq: [] };
let view = 'overview';
let query = '';
let statusFilter = 'ALL';
let assetQuery = '';
let assetCategory = 'ALL';
let assetState = 'ALL';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const formatDate = value => value ? new Intl.DateTimeFormat(getDisplayPreferences().language === 'en' ? 'en-US' : 'th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
const statusText = status => ({ PENDING: 'รอชำระ', PAID: 'ชำระแล้ว', CANCELLED: 'ยกเลิกแล้ว' })[status] || status;
const emailText = status => ({ SENT: 'ส่งอีเมลแล้ว', FAILED: 'ส่งไม่สำเร็จ', NOT_CONFIGURED: 'ยังไม่ตั้งค่าอีเมล', DEMO: 'โหมดสาธิต', NOT_SENT: 'ยังไม่ส่ง' })[status] || status;

async function api(path, options = {}) {
  const response = await fetch(`/api/admin${path}`, { credentials: 'same-origin', cache: 'no-store', ...options });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error || 'ระบบขัดข้อง'), { status: response.status });
  return result;
}
const post = input => api('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
async function settingsApi(input) {
  const response = await fetch('/api/settings', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'ระบบขัดข้อง');
  return result;
}

function toast(message, bad = false) {
  document.querySelector('.toast')?.remove();
  const element = document.createElement('div');
  element.className = `toast${bad ? ' bad' : ''}`;
  element.textContent = message;
  document.body.append(element);
  setTimeout(() => element.remove(), 4000);
}

function renderLogin(configured = true) {
  app.innerHTML = `<div class="admin-auth-layout"><div class="admin-auth-side"><a class="brand" href="/" aria-label="PolyLoot หน้าร้าน"><img src="/assets/brand/polyloot.png" alt="PolyLoot"></a><div class="admin-auth-hero"><span class="eyebrow">ADMIN WORKSPACE</span><h1>ระบบผู้ดูแลร้าน</h1><p>จัดการแอสเซ็ต คำสั่งซื้อ และข้อมูลร้านจากพื้นที่เดียว</p></div><a href="/" class="pill-button outline">กลับหน้าร้าน</a></div><div class="admin-auth-main"><form class="login-card" id="login-form"><h2>เข้าสู่ระบบ</h2><p class="muted">กรุณากรอกรหัสผ่านเพื่อเข้าใช้งาน</p><label for="password">รหัสผ่านผู้ดูแล</label><input class="field" id="password" type="password" autocomplete="current-password" required autofocus placeholder="Password"><button class="primary" type="submit">เข้าสู่หลังบ้าน</button><div class="error" id="login-error" role="alert">${configured ? '' : 'ยังไม่ได้ตั้งค่ารหัสผู้ดูแลบนเซิร์ฟเวอร์'}</div></form></div></div>`;
  document.querySelector('#login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    document.querySelector('#login-error').textContent = '';
    try {
      await post({ action: 'login', password: document.querySelector('#password').value });
      document.querySelector('#password').value = '';
      await load();
    } catch (error) { document.querySelector('#login-error').textContent = error.message; }
    finally { button.disabled = false; }
  });
}

function metrics() {
  const pending = data.orders.filter(order => order.status === 'PENDING').length;
  const paid = data.orders.filter(order => order.status === 'PAID').length;
  const active = data.assets.filter(asset => asset.active).length;
  return `<div class="metrics"><div class="metric"><span>คำสั่งซื้อทั้งหมด</span><strong>${data.orders.length}</strong><small>รายการล่าสุดสูงสุด 100 รายการ</small></div><div class="metric alert"><span>รอชำระ</span><strong>${pending}</strong><small>ระบบชำระเงินจำลอง</small></div><div class="metric"><span>ชำระแล้ว</span><strong>${paid}</strong><small>3D Asset พร้อมใช้งาน</small></div><div class="metric"><span>แอสเซ็ตที่เปิดขาย</span><strong>${active}</strong><small>จากทั้งหมด ${data.assets.length} ชุด · ลูกค้า ${data.customers.length} บัญชี</small></div></div>`;
}

function orderTable(limit) {
  const filtered = data.orders.filter(order => (statusFilter === 'ALL' || order.status === statusFilter) && `${order.id} ${order.customerName} ${order.email}`.toLowerCase().includes(query.toLowerCase())).slice(0, limit);
  if (!filtered.length) return `<div class="empty">${query ? 'ไม่พบคำสั่งซื้อที่ค้นหา' : 'ยังไม่มีคำสั่งซื้อ'}</div>`;
  return `<div class="admin-order-list">${filtered.map(order => `<article class="admin-order-row"><div class="admin-cover">${order.items[0]?.cover ? `<img src="${escapeHtml(order.items[0].cover)}" alt="" loading="lazy">` : ''}</div><div class="admin-order-copy"><h3>${escapeHtml(order.items[0]?.title || 'รายการแอสเซ็ต')}${order.items.length > 1 ? ` และอีก ${order.items.length - 1} ชุด` : ''}</h3><p>${escapeHtml(order.customerName)} · ${escapeHtml(order.email)}</p><p class="order-id">${escapeHtml(order.id)} · ${formatDate(order.createdAt)}</p><strong>${order.price} บาท</strong></div><div class="admin-order-side"><span class="pill ${order.status.toLowerCase()}">${statusText(order.status)}</span><span class="email-state">${emailText(order.emailStatus)}</span><div class="row-actions"><button class="mini" data-action="view-order" data-id="${escapeHtml(order.id)}">รายละเอียด</button>${order.status === 'PENDING' ? `<button class="mini" data-action="mark-paid" data-id="${escapeHtml(order.id)}">จำลองชำระ</button><button class="mini danger" data-action="cancel-order" data-id="${escapeHtml(order.id)}">ยกเลิก</button>` : order.status === 'PAID' && order.emailStatus !== 'SENT' && data.emailConfigured ? `<button class="mini" data-action="retry-email" data-id="${escapeHtml(order.id)}">ลองส่งอีเมล</button>` : ''}</div></div></article>`).join('')}</div>`;
}

function assetResults() {
  const filtered = data.assets.filter(asset => `${asset.title} ${asset.subtitle} ${asset.author} ${asset.id}`.toLocaleLowerCase().includes(assetQuery.toLocaleLowerCase()) && (assetCategory === 'ALL' || asset.category === assetCategory) && (assetState === 'ALL' || (assetState === 'ACTIVE') === Boolean(asset.active)));
  return `<p class="catalog-count">แสดง ${filtered.length} จาก ${data.assets.length} ชุด</p><div class="catalog-grid">${filtered.length ? filtered.map(asset => `<article class="asset"><img src="${escapeHtml(asset.cover || '/assets/previews/default-asset-preview.svg')}" alt="" loading="lazy"><div><h3>${escapeHtml(asset.title)}</h3><p>${escapeHtml(asset.subtitle)}</p><strong>${asset.price} บาท</strong><span class="pill ${asset.active ? 'paid' : 'cancelled'}">${asset.active ? 'เปิดขาย' : 'ซ่อนจากร้าน'}</span><br><button class="mini" data-action="edit-asset" data-id="${escapeHtml(asset.id)}">แก้ไข</button> <button class="mini" data-action="set-asset-active" data-id="${escapeHtml(asset.id)}" data-active="${!asset.active}">${asset.active ? 'ซ่อน' : 'เปิดขาย'}</button> <button class="mini danger" data-action="delete-asset" data-id="${escapeHtml(asset.id)}">ลบ</button></div></article>`).join('') : '<div class="empty">ไม่พบแอสเซ็ตตามตัวกรอง</div>'}</div>`;
}

function reportPanel() {
  const paid = data.orders.filter(order => order.status === 'PAID');
  const revenue = paid.reduce((sum, order) => sum + Number(order.price || 0), 0);
  const counts = new Map();
  for (const order of paid) for (const item of order.items || []) counts.set(item.title, (counts.get(item.title) || 0) + 1);
  const popular = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return `<section class="panel"><div class="panel-head"><div><h2>รายงานร้านค้า</h2><p>คำนวณจากคำสั่งซื้อล่าสุดสูงสุด 100 รายการ · ยอดขายเป็นข้อมูลจำลอง</p></div><button class="mini" type="button" id="export-orders">Export CSV</button></div><div class="report-grid"><article><span>ยอดขายจำลอง</span><strong>${new Intl.NumberFormat('th-TH').format(revenue)} บาท</strong></article><article><span>คำสั่งซื้อสำเร็จ</span><strong>${paid.length} รายการ</strong></article><article><span>คำร้องที่ยังเปิด</span><strong>${(data.tickets || []).filter(ticket => ticket.status !== 'RESOLVED').length} รายการ</strong></article></div><h3>สินค้ายอดนิยม</h3>${popular.length ? `<ol class="report-products">${popular.map(([title, count]) => `<li><span>${escapeHtml(title)}</span><strong>${count} ครั้ง</strong></li>`).join('')}</ol>` : '<p class="muted">ยังไม่มีคำสั่งซื้อสำเร็จ</p>'}</section>`;
}

function supportPanel() {
  const labels = { DOWNLOAD: 'ดาวน์โหลด', ORDER: 'คำสั่งซื้อ', PRODUCT: 'สินค้า', ACCOUNT: 'บัญชี', OTHER: 'อื่น ๆ' };
  return `<section class="panel"><div class="panel-head"><div><h2>คำร้องขอความช่วยเหลือ</h2><p>ลูกค้าส่งจากหน้าช่วยเหลือ · แสดงล่าสุดสูงสุด 100 รายการ</p></div></div>${(data.tickets || []).length ? `<div class="support-list">${data.tickets.map(ticket => `<article class="support-row"><div><strong>${escapeHtml(ticket.id)} · ${labels[ticket.category] || 'อื่น ๆ'}</strong><p>${escapeHtml(ticket.email)} · ${formatDate(ticket.createdAt)}</p>${ticket.orderId ? `<p>คำสั่งซื้อ ${escapeHtml(ticket.orderId)}</p>` : ''}<p class="support-message">${escapeHtml(ticket.message)}</p></div><label>สถานะ<select class="field" data-ticket-status="${escapeHtml(ticket.id)}"><option value="OPEN" ${ticket.status === 'OPEN' ? 'selected' : ''}>รับเรื่องแล้ว</option><option value="IN_PROGRESS" ${ticket.status === 'IN_PROGRESS' ? 'selected' : ''}>กำลังตรวจสอบ</option><option value="RESOLVED" ${ticket.status === 'RESOLVED' ? 'selected' : ''}>ดำเนินการแล้ว</option></select></label></article>`).join('')}</div>` : '<div class="empty">ยังไม่มีคำร้อง</div>'}</section>`;
}

function assetsPanel() {
  return `<section class="panel"><div class="panel-head"><div><h2>จัดการแอสเซ็ต</h2><p>เพิ่ม แก้ไขราคา ซ่อน และลบสินค้า</p></div><div class="asset-toolbar"><button class="primary" data-action="add-asset">+ เพิ่มแอสเซ็ต</button><button class="mini" id="export-assets">Export JSON</button><label class="mini">Import JSON<input id="import-assets" type="file" accept="application/json" hidden></label></div></div><div class="asset-filters"><input class="field" id="asset-search" type="search" placeholder="ค้นหาชื่อหรือผู้จัดทำ" value="${escapeHtml(assetQuery)}" aria-label="ค้นหาแอสเซ็ต"><select class="field" id="asset-category" aria-label="กรองหมวดหมู่"><option value="ALL">ทุกหมวดหมู่</option>${['Characters','Environments','Weapons','Vehicles','Props'].map(c => `<option ${assetCategory === c ? 'selected' : ''}>${c}</option>`).join('')}</select><select class="field" id="asset-state" aria-label="กรองสถานะ"><option value="ALL">ทุกสถานะ</option><option value="ACTIVE" ${assetState === 'ACTIVE' ? 'selected' : ''}>เปิดขาย</option><option value="HIDDEN" ${assetState === 'HIDDEN' ? 'selected' : ''}>ซ่อน</option></select></div><div id="asset-results">${assetResults()}</div></section>`;
}

function customersPanel() {
  return `<section class="panel"><div class="panel-head"><div><h2>บัญชีลูกค้า</h2><p>ข้อมูลนี้แสดงเฉพาะผู้ดูแลร้าน</p></div></div><div class="customer-list">${data.customers.length ? data.customers.map(item => {
    const fullName = (item.firstName && item.lastName) ? `${item.firstName} ${item.lastName}` : (item.name || item.username || 'ลูกค้า');
    return `<article class="customer-row"><div class="customer-avatar" aria-hidden="true">${escapeHtml((item.username || item.email)[0].toUpperCase())}</div><div><h3>${escapeHtml(item.username || 'ยังไม่มี Username')}</h3><p><strong>ชื่อ-นามสกุล:</strong> ${escapeHtml(fullName)}${item.firstName ? ` (ชื่อ: ${escapeHtml(item.firstName)}, นามสกุล: ${escapeHtml(item.lastName)})` : ''}</p><p><strong>อีเมล:</strong> ${escapeHtml(item.email)}</p><small>${item.createdAt ? `สมัครเมื่อ ${formatDate(item.createdAt)}` : 'บัญชีทดสอบในเครื่อง'}</small></div></article>`;
  }).join('') : '<div class="empty">ยังไม่มีบัญชีลูกค้า</div>'}</div></section>`;
}

function showDialog(html) {
  document.querySelector('.admin-dialog')?.remove();
  const dialog = document.createElement('dialog');
  dialog.className = 'admin-dialog';
  dialog.innerHTML = html;
  document.body.append(dialog);
  dialog.showModal();
  dialog.addEventListener('click', event => { if (event.target === dialog || event.target.closest('[data-close-dialog]')) dialog.close(); });
  dialog.addEventListener('close', () => dialog.remove());
  return dialog;
}

function showOrder(id) {
  const order = data.orders.find(item => item.id === id);
  if (!order) return toast('ไม่พบคำสั่งซื้อ', true);
  showDialog(`<div class="dialog-head"><h2>รายละเอียดคำสั่งซื้อ</h2><button type="button" data-close-dialog aria-label="ปิด">×</button></div><p class="order-id">${escapeHtml(order.id)} <button class="mini" id="copy-order-id" type="button">คัดลอกเลข</button></p><p>${escapeHtml(order.customerName)} · ${escapeHtml(order.email)}</p><p>สร้างเมื่อ ${formatDate(order.createdAt)} · สถานะ ${statusText(order.status)} · ${emailText(order.emailStatus)}</p><div class="dialog-items">${order.items.map(item => `<div><img src="${escapeHtml(item.cover || '/assets/previews/default-asset-preview.svg')}" alt="" loading="lazy"><span>${escapeHtml(item.title)}</span><strong>${item.price} บาท</strong></div>`).join('')}</div><p class="dialog-total">ยอดรวมจำลอง <strong>${order.price} บาท</strong></p><button class="mini" data-close-dialog type="button">ปิด</button>`);
  document.querySelector('#copy-order-id').addEventListener('click', async () => { try { await navigator.clipboard.writeText(order.id); toast('คัดลอกเลขคำสั่งซื้อแล้ว'); } catch { toast('คัดลอกไม่สำเร็จ', true); } });
}

function confirmDeleteAsset(asset) {
  const defaultCoverUrl = '/assets/previews/default-asset-preview.svg';
  const html = `
    <div class="dialog-head">
      <h2>ยืนยันการลบแอสเซ็ต</h2>
      <button type="button" data-close-dialog aria-label="ปิด">×</button>
    </div>
    <div class="delete-dialog-content">
      <div class="delete-asset-preview">
        <img class="delete-asset-thumb" src="${escapeHtml(asset.cover || defaultCoverUrl)}" alt="">
        <div class="delete-asset-meta">
          <strong>${escapeHtml(asset.title)}</strong>
          <p>หมวดหมู่: ${escapeHtml(asset.category)} · ราคา ${asset.price} บาท</p>
          <p class="order-id">รหัส: ${escapeHtml(asset.id)} · ไฟล์: ${escapeHtml(asset.fileName || asset.file || '3D Asset')}</p>
        </div>
      </div>
      <div class="delete-warning-box">
        <strong>⚠️ คำเตือนการลบข้อมูล</strong>
        การลบจะนำไฟล์ 3D Asset และข้อมูลสินค้านี้ออกจากระบบอย่างถาวร หากเคยมีคำสั่งซื้อที่อ้างอิงถึงสินค้านี้ ระบบจะไม่สามารถลบได้ แนะนำให้ใช้ปุ่ม "ซ่อนจากหน้าร้าน" แทน
      </div>
      <div id="delete-dialog-error" class="error" role="alert"></div>
      <div class="dialog-actions">
        <button type="button" class="mini" data-close-dialog>ยกเลิก</button>
        ${asset.active ? `<button type="button" class="mini" id="modal-hide-asset-btn">ซ่อนจากหน้าร้านแทน</button>` : ''}
        <button type="button" class="mini danger" id="modal-delete-asset-btn">ยืนยันลบถาวร</button>
      </div>
    </div>
  `;
  const dialog = showDialog(html);
  const errorEl = dialog.querySelector('#delete-dialog-error');
  const deleteBtn = dialog.querySelector('#modal-delete-asset-btn');
  const hideBtn = dialog.querySelector('#modal-hide-asset-btn');

  if (hideBtn) {
    hideBtn.addEventListener('click', async () => {
      hideBtn.disabled = true;
      hideBtn.textContent = 'กำลังซ่อน...';
      try {
        await post({ action: 'set-asset-active', id: asset.id, active: false });
        dialog.close();
        await load();
        toast('ซ่อนแอสเซ็ตจากหน้าร้านเรียบร้อยแล้ว');
      } catch (err) {
        errorEl.textContent = err.message;
        hideBtn.disabled = false;
        hideBtn.textContent = 'ซ่อนจากหน้าร้านแทน';
      }
    });
  }

  deleteBtn.addEventListener('click', async () => {
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'กำลังลบ...';
    errorEl.textContent = '';
    try {
      await post({ action: 'delete-asset', id: asset.id });
      dialog.close();
      await load();
      toast('ลบแอสเซ็ตเรียบร้อยแล้ว');
    } catch (err) {
      errorEl.textContent = err.message;
      deleteBtn.disabled = false;
      deleteBtn.textContent = 'ยืนยันลบถาวร';
    }
  });
}

function openAssetModal(mode = 'create', asset = null) {
  const isCreate = mode === 'create';
  const title = isCreate ? 'เพิ่มแอสเซ็ตใหม่' : 'แก้ไขแอสเซ็ต';
  const submitText = isCreate ? 'เพิ่มแอสเซ็ต' : 'บันทึกแอสเซ็ต';
  const loadingText = isCreate ? 'กำลังเพิ่มแอสเซ็ต...' : 'กำลังบันทึกข้อมูล...';

  const defaultCoverUrl = '/assets/previews/default-asset-preview.svg';

  let currentCoverBadge = 'ภาพพรีวิวเริ่มต้นของเว็บไซต์';
  if (!isCreate && asset?.cover) {
    if (asset.cover === defaultCoverUrl || asset.cover.includes('default-asset-cover')) {
      currentCoverBadge = 'ภาพพรีวิวเริ่มต้นของเว็บไซต์';
    } else if (asset.cover.includes('-auto.')) {
      currentCoverBadge = 'สร้างจากหน้าแรกอัตโนมัติ';
    } else {
      currentCoverBadge = 'อัปโหลดภาพพรีวิวเอง';
    }
  }

  // Initial tag parsing from subtitle
  let initialTags = [];
  if (!isCreate && asset?.subtitle) {
    initialTags = asset.subtitle.split(/[·,]/).map(t => t.trim()).filter(Boolean);
  }
  const activeTags = new Set(initialTags);
  const PRESET_TAGS = ['Low Poly', 'Stylized', 'Modular', 'Rigged', 'Animated', 'PBR', 'Game Ready', 'Sci-Fi', 'Fantasy', 'Interior', 'Nature', 'Vehicles', 'Weapons', 'Kenney CC0'];

  // Formats and Engines state
  const ALL_FORMATS = ['OBJ', 'FBX', 'GLTF', 'GLB', 'BLEND', 'DAE', 'STL'];
  const ALL_ENGINES = ['Unity', 'Unreal', 'Godot', 'Blender', 'Web'];
  const selectedFormats = new Set(asset?.formats?.length ? asset.formats.map(f => f.toUpperCase()) : ['OBJ', 'FBX', 'GLB']);
  const selectedEngines = new Set(asset?.engines?.length ? asset.engines : ['Unity', 'Unreal', 'Godot']);

  const html = `
    <div class="dialog-head">
      <h2>${title}</h2>
      <button type="button" data-close-dialog aria-label="ปิด">×</button>
    </div>
    <form id="asset-form">
      <div class="field-label-wrap">
        <label>ไฟล์ 3D Asset (ZIP หรือไฟล์โมเดล) ${isCreate ? '<span class="req">*</span>' : ''}</label>
        <div class="asset-dropzone${!isCreate && (asset?.fileName || asset?.file) ? ' has-file' : ''}" id="asset-dropzone" tabindex="0" role="button" aria-label="เลือกหรือลากไฟล์ 3D Asset">
          <div class="dropzone-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          </div>
          <p class="dropzone-title" id="dropzone-title">${!isCreate && (asset?.fileName || asset?.file) ? `ไฟล์ปัจจุบัน: ${escapeHtml(asset.fileName || asset.file)}` : 'ลากไฟล์ ZIP หรือ 3D Asset มาวางที่นี่'}</p>
          <p class="dropzone-hint" id="dropzone-hint">${!isCreate ? 'คลิกหรือลากไฟล์ใหม่มาวางหากต้องการเปลี่ยนไฟล์' : 'หรือคลิกเพื่อเลือกไฟล์ (รองรับ ZIP, OBJ, FBX, GLB, GLTF, BLEND สูงสุด 50MB)'}</p>
          <div class="dropzone-file-info" id="dropzone-file-info" style="display: none;"></div>
          <input name="file" id="asset-file-input" type="file" accept=".zip,.obj,.fbx,.glb,.gltf,.blend" style="display: none;" ${isCreate ? 'required' : ''}>
        </div>
      </div>

      <!-- ZIP Stats Card -->
      <div class="zip-stats-card" id="zip-stats-card" style="display: none;"></div>

      <!-- Extracted Images from ZIP Picker -->
      <div class="zip-images-section" id="zip-images-section" style="display: none;">
        <div class="zip-images-head">
          <strong>🖼️ รูปภาพตัวอย่างที่พบในไฟล์ ZIP <small id="zip-images-count"></small></strong>
          <small>คลิกรูปเพื่อเลือกเป็นภาพปกสินค้าทันที</small>
        </div>
        <div class="zip-images-grid" id="zip-images-grid"></div>
      </div>

      ${!isCreate ? `
        <div class="current-cover-section">
          <label>ภาพพรีวิวปัจจุบัน</label>
          <div class="current-cover-card">
            <img class="current-cover-thumb" src="${escapeHtml(asset?.cover || defaultCoverUrl)}" alt="ภาพพรีวิวปัจจุบัน">
            <div class="current-cover-info">
              <strong>${escapeHtml(asset?.title || 'แอสเซ็ต')}</strong>
              <span class="cover-badge">${escapeHtml(currentCoverBadge)}</span>
            </div>
          </div>
        </div>
      ` : ''}

      <div class="field-label-wrap" style="margin-top: 14px;">
        <label>${isCreate ? 'ภาพพรีวิว / ปกสินค้า' : 'เปลี่ยนภาพพรีวิว'}</label>
        <div class="cover-mode-group">
          ${!isCreate ? `
            <label class="cover-option-card">
              <input type="radio" name="cover_mode" value="keep" checked>
              <div class="cover-option-text">
                <strong>คงภาพพรีวิวปัจจุบัน</strong>
                <small>ใช้ภาพพรีวิวเดิม</small>
              </div>
            </label>
          ` : ''}
          <label class="cover-option-card" id="cover-mode-zip-label" style="display: none;">
            <input type="radio" name="cover_mode" value="zip_image">
            <div class="cover-option-text">
              <strong id="cover-zip-title">ใช้รูปตัวอย่างที่เลือกจากไฟล์ ZIP</strong>
              <small id="cover-zip-desc">ใช้ภาพปกจากแพ็ก ZIP โดยตรง</small>
            </div>
          </label>
          <label class="cover-option-card">
            <input type="radio" name="cover_mode" value="default" ${isCreate ? 'checked' : ''}>
            <div class="cover-option-text">
              <strong>ใช้ภาพพรีวิวเริ่มต้นของเว็บไซต์</strong>
              <small>ใช้ปกมาตรฐานของ PolyLoot</small>
            </div>
          </label>
          <label class="cover-option-card">
            <input type="radio" name="cover_mode" value="custom">
            <div class="cover-option-text">
              <strong>อัปโหลดภาพพรีวิวแยกจากเครื่อง</strong>
              <small>รองรับ JPG, PNG หรือ WebP (สูงสุด 5MB)</small>
            </div>
          </label>
        </div>
      </div>

      <div id="custom-cover-wrap" style="display: none; margin-top: 10px;">
        <label>
          เลือกรูปภาพพรีวิว <span class="req">*</span>
          <input name="cover_file" id="custom-cover-input" type="file" class="field file-field" accept=".jpg,.jpeg,.png,.webp">
          <small class="field-hint">รองรับไฟล์ .jpg, .jpeg, .png, .webp (สูงสุด 5MB)</small>
        </label>
      </div>

      <div class="cover-preview-wrapper" id="cover-preview-box">
        <img class="cover-preview-img" id="cover-preview-img" src="${escapeHtml(!isCreate && asset?.cover ? asset.cover : defaultCoverUrl)}" alt="พรีวิวภาพพรีวิว">
        <div class="cover-preview-meta">
          <strong id="cover-preview-title">${isCreate ? 'ภาพพรีวิวเริ่มต้น' : 'พรีวิว: คงภาพพรีวิวปัจจุบัน'}</strong>
          <span id="cover-preview-desc">${isCreate ? 'อัปโหลดภาพพรีวิว หรือเลือกจากไฟล์ ZIP' : 'ใช้รูปภาพพรีวิวเดิม'}</span>
        </div>
      </div>

      <label style="margin-top: 16px;">
        หมวดหมู่สินค้า <span class="req">*</span>
        <div class="category-select-wrap">
          <select name="category" id="asset-category-select" class="field" required>
            <option value="Characters" ${asset?.category === 'Characters' ? 'selected' : ''}>🧙‍♂️ Characters (ตัวละคร)</option>
            <option value="Environments" ${asset?.category === 'Environments' ? 'selected' : ''}>🏰 Environments (ฉากและสภาพแวดล้อม)</option>
            <option value="Weapons" ${asset?.category === 'Weapons' ? 'selected' : ''}>⚔️ Weapons (อาวุธ)</option>
            <option value="Vehicles" ${asset?.category === 'Vehicles' ? 'selected' : ''}>🚗 Vehicles (ยานพาหนะ)</option>
            <option value="Props" ${asset?.category === 'Props' ? 'selected' : (!asset ? 'selected' : '')}>📦 Props (สิ่งของและของประกอบฉาก)</option>
          </select>
        </div>
      </label>

      <label>
        ชื่อแอสเซ็ต <span class="req">*</span>
        <input name="title" id="asset-title-input" class="field" required minlength="3" maxlength="140" value="${escapeHtml(asset?.title || '')}" placeholder="ชื่อแอสเซ็ต เช่น Dungeon Modular Kit">
      </label>

      <div class="field-label-wrap">
        <label>คำอธิบายสั้น (Subtitle) <span class="req">*</span></label>
        <input name="subtitle" id="asset-subtitle-input" class="field" required minlength="3" maxlength="180" value="${escapeHtml(asset?.subtitle || '')}" placeholder="คำอธิบายสั้น หรือแท็กสินค้า">
      </div>

      <div class="field-label-wrap">
        <label>ระบบแท็กสินค้า (คลิกแท็กด้านล่าง หรือพิมพ์เพิ่ม)</label>
        <div class="tag-manager">
          <div class="tag-chips-active" id="active-tags-list"></div>
          <div class="tag-input-row">
            <input type="text" id="custom-tag-input" class="field" placeholder="พิมพ์แท็กใหม่ เช่น Modular, Sci-Fi...">
            <button type="button" class="mini" id="add-tag-btn">+ เพิ่มแท็ก</button>
          </div>
          <div class="tag-presets-wrap">
            <span class="tag-presets-label">แท็กยอดนิยม:</span>
            <div class="tag-presets-list" id="preset-tags-list">
              ${PRESET_TAGS.map(pt => `<button type="button" class="preset-tag-chip${activeTags.has(pt) ? ' active' : ''}" data-preset-tag="${escapeHtml(pt)}">${activeTags.has(pt) ? '✓ ' : '+ '}${escapeHtml(pt)}</button>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="field-label-wrap">
        <label>รูปแบบไฟล์ 3D (Formats)</label>
        <div class="selector-chips-group" id="formats-chips">
          ${ALL_FORMATS.map(fmt => `<button type="button" class="selector-chip${selectedFormats.has(fmt) ? ' active' : ''}" data-format="${fmt}">${fmt}</button>`).join('')}
        </div>
        <input name="formats" id="formats-hidden-input" class="field" style="margin-top: 6px; font-size: 0.9rem;" value="${escapeHtml(Array.from(selectedFormats).join(', '))}" placeholder="เช่น OBJ, FBX, GLB">
      </div>

      <div class="field-label-wrap">
        <label>เอนจินที่รองรับ (Engines)</label>
        <div class="selector-chips-group" id="engines-chips">
          ${ALL_ENGINES.map(eng => `<button type="button" class="selector-chip${selectedEngines.has(eng) ? ' active' : ''}" data-engine="${eng}">${eng}</button>`).join('')}
        </div>
        <input name="engines" id="engines-hidden-input" class="field" style="margin-top: 6px; font-size: 0.9rem;" value="${escapeHtml(Array.from(selectedEngines).join(', '))}" placeholder="เช่น Unity, Unreal, Godot">
      </div>

      <div class="field-label-wrap">
        <label>รายละเอียดสินค้าแบบยาว <span class="req">*</span></label>
        <div class="desc-helper-bar">
          <div class="desc-templates">
            <button type="button" class="desc-template-btn" data-template="specs">+ สเปกโมเดล</button>
            <button type="button" class="desc-template-btn" data-template="features">+ คุณสมบัติเด่น</button>
            <button type="button" class="desc-template-btn" data-template="contents">+ ของในแพ็ก</button>
            <button type="button" class="desc-template-btn" data-template="license">+ สิทธิ์ใช้งาน</button>
            <button type="button" class="desc-template-btn" id="desc-zip-stats-btn" style="display: none;">+ สถิติจาก ZIP</button>
          </div>
          <span class="desc-char-counter" id="desc-char-counter">${(asset?.description || '').length} / 4000</span>
        </div>
        <textarea name="description" id="asset-desc-textarea" class="field textarea-field" required minlength="10" maxlength="4000" rows="6" placeholder="กรอกรายละเอียดสินค้า คุณสมบัติ และคำแนะนำการใช้งาน...">${escapeHtml(asset?.description || '')}</textarea>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <label>
          ผู้จัดทำ <span class="req">*</span>
          <input name="author" class="field" required minlength="2" maxlength="100" value="${escapeHtml(asset?.author || 'Kenney')}" placeholder="เช่น Kenney">
        </label>
        <label>
          ราคาจำลอง (บาท) <span class="req">*</span>
          <input name="price" class="field" type="number" required min="1" max="100000" value="${asset ? asset.price : 99}" placeholder="ราคา">
        </label>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <label>Version<input name="version" class="field" value="${escapeHtml(asset?.version || '1.0.0')}"></label>
        <label>License<input name="license" class="field" value="${escapeHtml(asset?.license || 'CC0 1.0')}"></label>
      </div>

      <label>ลิงก์แหล่งที่มา (ถ้ามี)<input name="source_url" class="field" type="url" maxlength="500" value="${escapeHtml(asset?.source_url || '')}" placeholder="https://kenney.nl/assets/..."></label>

      <div id="asset-form-error" class="error" role="alert"></div>
      <div class="dialog-actions">
        <button type="button" class="mini" data-close-dialog>ยกเลิก</button>
        <button type="submit" class="primary" id="asset-submit-btn">${submitText}</button>
      </div>
    </form>
  `;

  const dialog = showDialog(html);
  const form = dialog.querySelector('#asset-form');
  const errorEl = dialog.querySelector('#asset-form-error');
  const submitBtn = dialog.querySelector('#asset-submit-btn');

  // Elements
  const dropzone = dialog.querySelector('#asset-dropzone');
  const dropzoneTitle = dialog.querySelector('#dropzone-title');
  const dropzoneHint = dialog.querySelector('#dropzone-hint');
  const dropzoneInfo = dialog.querySelector('#dropzone-file-info');
  const fileInput = dialog.querySelector('#asset-file-input');

  const zipStatsCard = dialog.querySelector('#zip-stats-card');
  const zipImagesSection = dialog.querySelector('#zip-images-section');
  const zipImagesGrid = dialog.querySelector('#zip-images-grid');
  const zipImagesCount = dialog.querySelector('#zip-images-count');

  const titleInput = dialog.querySelector('#asset-title-input');
  const subtitleInput = dialog.querySelector('#asset-subtitle-input');
  const categorySelect = dialog.querySelector('#asset-category-select');
  const descTextarea = dialog.querySelector('#asset-desc-textarea');
  const charCounter = dialog.querySelector('#desc-char-counter');
  const descZipStatsBtn = dialog.querySelector('#desc-zip-stats-btn');

  const customWrap = dialog.querySelector('#custom-cover-wrap');
  const customInput = dialog.querySelector('#custom-cover-input');
  const previewImg = dialog.querySelector('#cover-preview-img');
  const previewTitle = dialog.querySelector('#cover-preview-title');
  const previewDesc = dialog.querySelector('#cover-preview-desc');
  const zipCoverLabel = dialog.querySelector('#cover-mode-zip-label');
  const zipCoverTitle = dialog.querySelector('#cover-zip-title');
  const zipCoverDesc = dialog.querySelector('#cover-zip-desc');

  let chosenCustomUrl = null;
  let selectedZipImageBlob = null;
  let selectedZipImageName = null;
  let lastInspection = null;

  // --- Tag Management ---
  const activeTagsList = dialog.querySelector('#active-tags-list');
  const customTagInput = dialog.querySelector('#custom-tag-input');
  const addTagBtn = dialog.querySelector('#add-tag-btn');
  const presetTagsList = dialog.querySelector('#preset-tags-list');

  function renderTags() {
    activeTagsList.innerHTML = activeTags.size
      ? Array.from(activeTags).map(tag => `<span class="tag-badge">${escapeHtml(tag)}<button type="button" class="tag-remove-btn" data-remove-tag="${escapeHtml(tag)}" aria-label="ลบแท็ก">×</button></span>`).join('')
      : '<span class="tag-empty-hint">ยังไม่มีแท็ก (คลิกเลือกแท็กด้านล่างหรือพิมพ์เพิ่ม)</span>';

    presetTagsList.querySelectorAll('.preset-tag-chip').forEach(btn => {
      const tag = btn.dataset.presetTag;
      const on = activeTags.has(tag);
      btn.classList.toggle('active', on);
      btn.textContent = (on ? '✓ ' : '+ ') + tag;
    });

    // Auto-sync subtitle if subtitle was empty or represents tags
    if (activeTags.size) {
      if (!subtitleInput.value.trim() || subtitleInput.dataset.autoSynced === 'true') {
        subtitleInput.value = `${categorySelect.value} · ${Array.from(activeTags).join(' · ')}`;
        subtitleInput.dataset.autoSynced = 'true';
      }
    }
  }

  subtitleInput.addEventListener('input', () => {
    subtitleInput.dataset.autoSynced = 'false';
  });

  function addCustomTag() {
    const val = customTagInput.value.trim();
    if (!val) return;
    val.split(/[·,]/).forEach(item => {
      const clean = item.trim();
      if (clean && clean.length <= 30) activeTags.add(clean);
    });
    customTagInput.value = '';
    renderTags();
  }

  addTagBtn.addEventListener('click', addCustomTag);
  customTagInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addCustomTag();
    }
  });

  presetTagsList.addEventListener('click', event => {
    const chip = event.target.closest('[data-preset-tag]');
    if (!chip) return;
    const tag = chip.dataset.presetTag;
    if (activeTags.has(tag)) activeTags.delete(tag);
    else activeTags.add(tag);
    renderTags();
  });

  activeTagsList.addEventListener('click', event => {
    const rm = event.target.closest('[data-remove-tag]');
    if (!rm) return;
    activeTags.delete(rm.dataset.removeTag);
    renderTags();
  });

  categorySelect.addEventListener('change', () => {
    if (subtitleInput.dataset.autoSynced === 'true') {
      subtitleInput.value = `${categorySelect.value} · ${Array.from(activeTags).join(' · ')}`;
    }
  });

  renderTags();

  // --- Formats & Engines Selector ---
  const formatsHidden = dialog.querySelector('#formats-hidden-input');
  const formatsChips = dialog.querySelector('#formats-chips');
  formatsChips.addEventListener('click', event => {
    const chip = event.target.closest('[data-format]');
    if (!chip) return;
    const fmt = chip.dataset.format;
    if (selectedFormats.has(fmt)) {
      if (selectedFormats.size > 1) selectedFormats.delete(fmt);
    } else {
      selectedFormats.add(fmt);
    }
    chip.classList.toggle('active', selectedFormats.has(fmt));
    formatsHidden.value = Array.from(selectedFormats).join(', ');
  });

  const enginesHidden = dialog.querySelector('#engines-hidden-input');
  const enginesChips = dialog.querySelector('#engines-chips');
  enginesChips.addEventListener('click', event => {
    const chip = event.target.closest('[data-engine]');
    if (!chip) return;
    const eng = chip.dataset.engine;
    if (selectedEngines.has(eng)) {
      if (selectedEngines.size > 1) selectedEngines.delete(eng);
    } else {
      selectedEngines.add(eng);
    }
    chip.classList.toggle('active', selectedEngines.has(eng));
    enginesHidden.value = Array.from(selectedEngines).join(', ');
  });

  // --- Rich Description Templates & Counter ---
  descTextarea.addEventListener('input', () => {
    charCounter.textContent = `${descTextarea.value.length} / 4000`;
  });

  dialog.querySelectorAll('.desc-template-btn[data-template]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.template;
      let snippet = '';
      if (type === 'specs') {
        snippet = '\n\n📌 ข้อมูลสเปกโมเดล:\n- รูปแบบ 3D: Low Poly Game Ready\n- โครงสร้าง: แยกชิ้นส่วนได้ (Modular)\n- เท็กซ์เจอร์: PBR Material รวมในแพ็ก\n- รองรับ: Mobile, PC, Console';
      } else if (type === 'features') {
        snippet = '\n\n⭐ คุณสมบัติเด่น:\n- เหมาะสำหรับเกมแนว Action / Adventure / RPG\n- นำเข้าเอนจินเกมได้ทันที (Drag & Drop Ready)\n- จุดหมุน (Pivot Points) และสเกลโมเดลตั้งค่าตรงมาตรฐาน';
      } else if (type === 'contents') {
        snippet = '\n\n📦 สิ่งที่รวมในแพ็กเกจนี้:\n- ไฟล์โมเดล 3D คุณภาพสูงครบชุด\n- ไฟล์ Material และ Color Palette\n- ไฟล์ตัวอย่างการประกอบฉาก';
      } else if (type === 'license') {
        snippet = '\n\n📜 สิทธิ์การใช้งาน (License):\n- อนุญาตให้ใช้ในเกมส่วนตัวและเกมเชิงพาณิชย์ (Commercial Use)\n- ใช้งานได้ไม่จำกัดโปรเจกต์';
      }
      descTextarea.value = (descTextarea.value.trim() + snippet).trim();
      charCounter.textContent = `${descTextarea.value.length} / 4000`;
      descTextarea.focus();
    });
  });

  if (descZipStatsBtn) {
    descZipStatsBtn.addEventListener('click', () => {
      if (!lastInspection) return;
      const uncompMb = (lastInspection.uncompressedBytes / 1048576).toFixed(1);
      const snippet = `\n\n📊 ข้อมูลไฟล์ในแพ็กเกจ:\n- จำนวนโมเดล 3D: ${lastInspection.modelCount} ชิ้น\n- ไฟล์ทั้งหมด: ${lastInspection.totalFiles} ไฟล์\n- ขนาดไฟล์เมื่อแตก: ${uncompMb} MB`;
      descTextarea.value = (descTextarea.value.trim() + snippet).trim();
      charCounter.textContent = `${descTextarea.value.length} / 4000`;
      descTextarea.focus();
    });
  }

  // --- Cover View Handler ---
  function updateCoverView() {
    const selectedMode = form.querySelector('input[name="cover_mode"]:checked')?.value || (isCreate ? 'default' : 'keep');
    customWrap.style.display = selectedMode === 'custom' ? 'block' : 'none';

    if (selectedMode === 'keep') {
      previewImg.src = asset?.cover || defaultCoverUrl;
      previewTitle.textContent = 'พรีวิว: คงภาพพรีวิวปัจจุบัน';
      previewDesc.textContent = 'ใช้รูปภาพพรีวิวเดิม';
    } else if (selectedMode === 'zip_image') {
      if (selectedZipImageBlob) {
        previewImg.src = URL.createObjectURL(selectedZipImageBlob);
        previewTitle.textContent = `พรีวิว: ${selectedZipImageName || 'ภาพจากไฟล์ ZIP'}`;
        previewDesc.textContent = `รูปภาพตัวอย่างจากไฟล์ ZIP (${(selectedZipImageBlob.size / 1024).toFixed(0)} KB)`;
      }
    } else if (selectedMode === 'default') {
      previewImg.src = defaultCoverUrl;
      previewTitle.textContent = 'พรีวิว: ภาพพรีวิวเริ่มต้นของเว็บไซต์';
      previewDesc.textContent = 'ใช้รูปภาพมาตรฐานของ PolyLoot';
    } else if (selectedMode === 'custom') {
      if (chosenCustomUrl) {
        previewImg.src = chosenCustomUrl;
        previewTitle.textContent = 'พรีวิว: รูปภาพใหม่ที่เลือก';
        previewDesc.textContent = customInput.files[0]?.name || 'พร้อมบันทึกเป็นภาพพรีวิว';
      } else {
        previewImg.src = !isCreate && asset?.cover ? asset.cover : defaultCoverUrl;
        previewTitle.textContent = !isCreate && asset?.cover ? 'ใช้รูปภาพพรีวิวปัจจุบัน' : 'ยังไม่ได้เลือกรูปภาพ';
        previewDesc.textContent = 'กรุณาเลือกไฟล์รูปภาพ .jpg, .png หรือ .webp (สูงสุด 5MB)';
      }
    }
  }

  form.querySelectorAll('input[name="cover_mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const selected = form.querySelector('input[name="cover_mode"]:checked')?.value;
      if (selected !== 'custom') {
        if (customInput) customInput.value = '';
        if (chosenCustomUrl) {
          URL.revokeObjectURL(chosenCustomUrl);
          chosenCustomUrl = null;
        }
      }
      errorEl.textContent = '';
      updateCoverView();
    });
  });

  if (customInput) {
    customInput.addEventListener('change', () => {
      const file = customInput.files[0];
      if (!file) {
        if (chosenCustomUrl) {
          URL.revokeObjectURL(chosenCustomUrl);
          chosenCustomUrl = null;
        }
        updateCoverView();
        return;
      }
      if (file.size > 5242880) {
        errorEl.textContent = 'ไฟล์รูปภาพพรีวิวมีขนาดใหญ่เกิน 5MB';
        customInput.value = '';
        if (chosenCustomUrl) {
          URL.revokeObjectURL(chosenCustomUrl);
          chosenCustomUrl = null;
        }
        updateCoverView();
        return;
      }
      errorEl.textContent = '';
      if (chosenCustomUrl) URL.revokeObjectURL(chosenCustomUrl);
      chosenCustomUrl = URL.createObjectURL(file);
      updateCoverView();
    });
  }

  // --- Drag & Drop and File Inspection ---
  async function processSelectedFile(file) {
    if (!file) return;
    dropzone.classList.add('has-file');
    dropzoneTitle.textContent = file.name;
    const mb = (file.size / 1048576).toFixed(2);
    dropzoneHint.textContent = `ขนาดไฟล์: ${mb} MB · ตรวจสอบและดึงข้อมูลแล้ว`;
    dropzoneInfo.style.display = 'inline-flex';
    dropzoneInfo.textContent = `✓ ${file.name} (${mb} MB)`;

    // Inspect ZIP
    dropzoneHint.textContent = 'กำลังตรวจสอบข้อมูลในไฟล์...';
    const inspection = await inspectZipFile(file);
    lastInspection = inspection;

    if (inspection.isZip) {
      const uncompMb = (inspection.uncompressedBytes / 1048576).toFixed(1);
      zipStatsCard.style.display = 'grid';
      zipStatsCard.innerHTML = `
        <div class="zip-stat-item">
          <span>ขนาดไฟล์ ZIP</span>
          <strong>${mb} MB</strong>
        </div>
        <div class="zip-stat-item">
          <span>ขนาดแตกไฟล์</span>
          <strong>${uncompMb} MB</strong>
        </div>
        <div class="zip-stat-item">
          <span>โมเดล 3D ที่พบ</span>
          <strong>${inspection.modelCount} ชิ้น</strong>
        </div>
        <div class="zip-stat-item">
          <span>ไฟล์ทั้งหมด</span>
          <strong>${inspection.totalFiles} ไฟล์</strong>
        </div>
      `;

      if (descZipStatsBtn) descZipStatsBtn.style.display = 'inline-block';

      // Auto-select detected formats
      if (inspection.formatsDetected?.length) {
        inspection.formatsDetected.forEach(fmt => selectedFormats.add(fmt.toUpperCase()));
        formatsChips.querySelectorAll('.selector-chip').forEach(chip => {
          chip.classList.toggle('active', selectedFormats.has(chip.dataset.format));
        });
        formatsHidden.value = Array.from(selectedFormats).join(', ');
      }

      // Auto-suggest title if empty
      if (isCreate && !titleInput.value.trim() && inspection.suggestedTitle) {
        titleInput.value = inspection.suggestedTitle;
      }

      // Render Extracted Images Picker Gallery
      if (inspection.images?.length) {
        zipImagesSection.style.display = 'block';
        zipImagesCount.textContent = `(${inspection.images.length} รูป)`;
        zipImagesGrid.innerHTML = inspection.images.map((img, idx) => `
          <button type="button" class="zip-image-item${idx === 0 ? ' selected' : ''}" data-zip-img-idx="${idx}" aria-label="เลือกรูป ${escapeHtml(img.displayName)} เป็นภาพปก">
            <img src="${img.objectUrl}" alt="${escapeHtml(img.displayName)}" loading="lazy">
            <span class="zip-image-badge" style="${idx === 0 ? '' : 'display:none;'}">ภาพปก ✓</span>
            <span class="zip-image-name">${escapeHtml(img.displayName)}</span>
          </button>
        `).join('');

        // Automatically select first image as cover
        selectedZipImageBlob = inspection.images[0].blob;
        selectedZipImageName = inspection.images[0].displayName;

        zipCoverLabel.style.display = 'flex';
        zipCoverTitle.textContent = `ใช้รูปจากไฟล์ ZIP: ${selectedZipImageName}`;
        zipCoverDesc.textContent = `ขนาด ${(selectedZipImageBlob.size / 1024).toFixed(0)} KB · พร้อมบันทึกเป็นภาพปก`;

        const zipRadio = form.querySelector('input[name="cover_mode"][value="zip_image"]');
        if (zipRadio) zipRadio.checked = true;

        updateCoverView();

        // Image grid click handler
        zipImagesGrid.querySelectorAll('.zip-image-item').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = Number(btn.dataset.zipImgIdx);
            const chosen = inspection.images[idx];
            if (!chosen) return;

            zipImagesGrid.querySelectorAll('.zip-image-item').forEach(item => {
              const isIt = item === btn;
              item.classList.toggle('selected', isIt);
              const badge = item.querySelector('.zip-image-badge');
              if (badge) badge.style.display = isIt ? 'block' : 'none';
            });

            selectedZipImageBlob = chosen.blob;
            selectedZipImageName = chosen.displayName;

            zipCoverTitle.textContent = `ใช้รูปจากไฟล์ ZIP: ${selectedZipImageName}`;
            zipCoverDesc.textContent = `ขนาด ${(selectedZipImageBlob.size / 1024).toFixed(0)} KB · พร้อมบันทึกเป็นภาพปก`;

            if (zipRadio) zipRadio.checked = true;
            updateCoverView();
            toast(`เลือก "${chosen.displayName}" เป็นภาพปกแล้ว`);
          });
        });
      } else {
        zipImagesSection.style.display = 'none';
        zipCoverLabel.style.display = 'none';
      }

      dropzoneHint.textContent = `ตรวจพบ ${inspection.modelCount} โมเดล 3D · ${inspection.totalFiles} ไฟล์รวม`;
    } else {
      zipStatsCard.style.display = 'none';
      zipImagesSection.style.display = 'none';
      zipCoverLabel.style.display = 'none';
      dropzoneHint.textContent = `ไฟล์โมเดล 3D เดี่ยว (${mb} MB)`;
      if (isCreate && !titleInput.value.trim() && inspection.suggestedTitle) {
        titleInput.value = inspection.suggestedTitle;
      }
    }
  }

  // Dropzone click & drag events
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInput.click();
    }
  });

  dropzone.addEventListener('dragover', event => {
    event.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', async event => {
    event.preventDefault();
    dropzone.classList.remove('dragover');
    const droppedFile = event.dataTransfer?.files?.[0];
    if (droppedFile) {
      try {
        const dt = new DataTransfer();
        dt.items.add(droppedFile);
        fileInput.files = dt.files;
      } catch {}
      await processSelectedFile(droppedFile);
    }
  });

  fileInput.addEventListener('change', async () => {
    if (fileInput.files?.[0]) {
      await processSelectedFile(fileInput.files[0]);
    }
  });

  dialog.addEventListener('close', () => {
    if (chosenCustomUrl) {
      URL.revokeObjectURL(chosenCustomUrl);
      chosenCustomUrl = null;
    }
    if (lastInspection?.images?.length) {
      lastInspection.images.forEach(img => {
        try { URL.revokeObjectURL(img.objectUrl); } catch {}
      });
    }
  });

  // --- Form Submission ---
  form.addEventListener('submit', async event => {
    event.preventDefault();
    errorEl.textContent = '';

    const selectedMode = form.querySelector('input[name="cover_mode"]:checked')?.value || (isCreate ? 'default' : 'keep');
    if (selectedMode === 'custom') {
      if ((!customInput.files || !customInput.files[0]) && (isCreate || !asset?.cover || asset.cover === defaultCoverUrl)) {
        errorEl.textContent = 'กรุณาเลือกไฟล์รูปภาพพรีวิว';
        return;
      }
    }

    submitBtn.disabled = true;
    submitBtn.textContent = loadingText;

    try {
      const formData = new FormData(form);
      formData.append('action', isCreate ? 'add-asset' : 'update-asset');
      if (!isCreate) formData.append('id', asset.id);

      if (selectedMode === 'zip_image' && selectedZipImageBlob) {
        formData.set('cover_mode', 'custom');
        formData.set('cover_file', selectedZipImageBlob, selectedZipImageName || 'cover.png');
      } else if (!isCreate) {
        if (selectedMode === 'keep') {
          formData.delete('cover_mode');
          formData.delete('cover_file');
        } else if (selectedMode === 'default') {
          formData.set('cover_mode', selectedMode);
          formData.delete('cover_file');
        } else if (selectedMode === 'custom') {
          formData.set('cover_mode', 'custom');
        }
      } else {
        if (selectedMode !== 'custom') {
          formData.delete('cover_file');
        }
      }

      const response = await fetch('/api/admin', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
        cache: 'no-store'
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || (isCreate ? 'ไม่สามารถอัปโหลดไฟล์ 3D Asset ได้ กรุณาลองใหม่' : 'ไม่สามารถบันทึกข้อมูลแอสเซ็ตได้'));
      }

      dialog.close();
      await load();
      if (result.notice) {
        toast(result.notice);
      } else {
        toast(isCreate ? 'เพิ่มแอสเซ็ตเรียบร้อยแล้ว' : 'บันทึกข้อมูลแอสเซ็ตแล้ว');
      }
    } catch (error) {
      errorEl.textContent = error.message;
      toast(error.message, true);
      submitBtn.disabled = false;
      submitBtn.textContent = submitText;
    }
  });
}

function render() {
  const title = { overview: 'ภาพรวมร้าน', orders: 'คำสั่งซื้อ', assets: 'แอสเซ็ต', customers: 'ลูกค้า', support: 'คำร้องลูกค้า', settings: 'ตั้งค่าร้าน', alerts: 'การแจ้งเตือน' }[view];
  app.innerHTML = `<div class="admin-workspace"><aside class="admin-sidebar"><div class="admin-brand"><a class="brand" href="/" aria-label="PolyLoot หน้าร้าน"><img src="/assets/brand/polyloot.png" alt="PolyLoot"></a><span class="admin-label">ADMIN PANEL</span></div><nav class="admin-nav" aria-label="เมนูผู้ดูแล"><div class="nav-group"><button data-view="overview" class="${view === 'overview' ? 'active' : ''}">ภาพรวม</button><button data-view="orders" class="${view === 'orders' ? 'active' : ''}">คำสั่งซื้อ</button><button data-view="assets" class="${view === 'assets' ? 'active' : ''}">แอสเซ็ต</button><button data-view="customers" class="${view === 'customers' ? 'active' : ''}">ลูกค้า</button><button data-view="support" class="${view === 'support' ? 'active' : ''}">คำร้องลูกค้า ${(data.tickets || []).filter(ticket => ticket.status !== 'RESOLVED').length ? `(${(data.tickets || []).filter(ticket => ticket.status !== 'RESOLVED').length})` : ''}</button></div><div class="nav-bottom"><a href="/">กลับหน้าร้าน</a><button class="nav-exit" data-action="logout">ออกจากระบบ</button></div></nav></aside><main class="admin-main"><header class="admin-topbar"><div class="page-heading"><h1>${title}</h1></div><div class="content-actions"><span class="demo-badge">DEMO ONLY</span><button class="mini" data-action="refresh">รีเฟรช</button></div></header><div class="admin-content">${view === 'overview' ? `${metrics()}${reportPanel()}<section class="panel"><div class="panel-head"><div><h2>คำสั่งซื้อล่าสุด</h2><p>5 รายการล่าสุด</p></div><button class="mini" data-view="orders">ดูทั้งหมด →</button></div>${orderTable(5)}</section>` : view === 'orders' ? `<section class="panel"><div class="panel-head"><div><h2>ติดตามคำสั่งซื้อ</h2><p>แสดงสูงสุด 100 รายการล่าสุด</p></div><div class="order-filters"><select class="field" id="status-filter" aria-label="กรองสถานะ"><option value="ALL" ${statusFilter === 'ALL' ? 'selected' : ''}>ทุกสถานะ</option><option value="PENDING" ${statusFilter === 'PENDING' ? 'selected' : ''}>รอชำระ</option><option value="PAID" ${statusFilter === 'PAID' ? 'selected' : ''}>ชำระแล้ว</option><option value="CANCELLED" ${statusFilter === 'CANCELLED' ? 'selected' : ''}>ยกเลิกแล้ว</option></select><input class="field search" id="order-search" type="search" placeholder="ค้นหา" value="${escapeHtml(query)}" aria-label="ค้นหาคำสั่งซื้อ"></div></div><div id="order-results">${orderTable(100)}</div></section>` : view === 'assets' ? assetsPanel() : view === 'support' ? supportPanel() : customersPanel()}</div></main></div>`;
  document.querySelector('.admin-brand').insertAdjacentHTML('beforeend', `<button class="admin-menu-toggle" id="admin-menu-toggle" type="button" aria-controls="admin-mobile-nav" aria-expanded="false" aria-label="${t('เปิดเมนู', 'Open menu')}"><span></span><span></span><span></span></button>`);
  document.querySelector('.admin-nav').id = 'admin-mobile-nav';
  document.querySelector('#admin-menu-toggle').addEventListener('click', event => {
    const sidebar = document.querySelector('.admin-sidebar');
    const open = sidebar.classList.toggle('menu-open');
    event.currentTarget.setAttribute('aria-expanded', String(open));
    event.currentTarget.setAttribute('aria-label', open ? t('ปิดเมนู', 'Close menu') : t('เปิดเมนู', 'Open menu'));
    if (open) sidebar.querySelector('.admin-nav button')?.focus();
  });
  document.querySelector('.admin-nav .nav-group').insertAdjacentHTML('beforeend', `<button data-view="alerts" class="${view === 'alerts' ? 'active' : ''}">${t('การแจ้งเตือน', 'Notifications')} <span class="admin-alert-count">${data.orders.filter(item => item.status === 'PENDING').length + (data.tickets || []).filter(item => item.status !== 'RESOLVED').length}</span></button><button data-view="settings" class="${view === 'settings' ? 'active' : ''}">${t('ตั้งค่าร้าน', 'Store settings')}</button>`);
  if (view === 'settings') document.querySelector('.admin-content').innerHTML = settingsPanel();
  if (view === 'alerts') document.querySelector('.admin-content').innerHTML = alertsPanel();
  document.querySelector('#store-settings-form')?.addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button[type=submit]'); button.disabled = true;
    const faq = [...form.querySelectorAll('.faq-edit-row')].map(row => ({ question: row.querySelector('[name=faq_question]').value.trim(), answer: row.querySelector('[name=faq_answer]').value.trim() })).filter(row => row.question || row.answer);
    try {
      const result = await settingsApi({ action: 'update-store', contact_email: form.elements.namedItem('contact_email').value, contact_phone: form.elements.namedItem('contact_phone').value, support_hours: form.elements.namedItem('support_hours').value, announcement: form.elements.namedItem('announcement').value, faq });
      storeSettings = result.settings; toast(t('บันทึกการตั้งค่าแล้ว', 'Settings saved')); render();
    } catch (error) { document.querySelector('#store-settings-result').textContent = error.message; button.disabled = false; }
  });
  document.querySelector('#add-faq')?.addEventListener('click', () => {
    const list = document.querySelector('#faq-edit-list'); if (list.children.length >= 8) return toast(t('เพิ่มได้สูงสุด 8 ข้อ', 'Maximum 8 questions'), true);
    list.insertAdjacentHTML('beforeend', `<div class="faq-edit-row"><label>${t('คำถาม', 'Question')} ${list.children.length + 1}<input class="field" name="faq_question" maxlength="150"></label><label>${t('คำตอบ', 'Answer')}<textarea class="field" name="faq_answer" maxlength="500" rows="2"></textarea></label><button class="mini danger" type="button" data-remove-faq>${t('ลบ', 'Remove')}</button></div>`);
  });
  document.querySelector('#faq-edit-list')?.addEventListener('click', event => { if (event.target.closest('[data-remove-faq]')) event.target.closest('.faq-edit-row').remove(); });
  document.querySelector('#admin-theme')?.addEventListener('change', event => { saveDisplayPreferences({ theme: event.target.value }); render(); });
  document.querySelector('#admin-language')?.addEventListener('change', event => { saveDisplayPreferences({ language: event.target.value }); render(); });
  translateCommon(document);
  let searchTimeout;
  document.querySelector('#order-search')?.addEventListener('input', event => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      query = event.target.value;
      document.querySelector('#order-results').innerHTML = orderTable(100);
    }, 300);
  });
  document.querySelector('#status-filter')?.addEventListener('change', event => { statusFilter = event.target.value; document.querySelector('#order-results').innerHTML = orderTable(100); });
  const updateAssets = () => { document.querySelector('#asset-results').innerHTML = assetResults(); };
  document.querySelector('#asset-search')?.addEventListener('input', event => { assetQuery = event.target.value; updateAssets(); });
  document.querySelector('#asset-category')?.addEventListener('change', event => { assetCategory = event.target.value; updateAssets(); });
  document.querySelector('#asset-state')?.addEventListener('change', event => { assetState = event.target.value; updateAssets(); });
  document.querySelectorAll('[data-ticket-status]').forEach(select => select.addEventListener('change', async event => {
    const control = event.currentTarget; control.disabled = true;
    try { await post({ action: 'set-ticket-status', id: control.dataset.ticketStatus, status: control.value }); await load(); toast('อัปเดตคำร้องแล้ว'); }
    catch (error) { toast(error.message, true); await load(); }
  }));
  document.querySelector('#export-orders')?.addEventListener('click', () => {
    const rows = [['เลขคำสั่งซื้อ','วันที่','ลูกค้า','อีเมล','สถานะ','จำนวนสินค้า','ยอดรวมจำลอง (บาท)'], ...data.orders.map(order => [order.id, order.createdAt, order.customerName, order.email, statusText(order.status), order.items.length, order.price])];
    const csv = '\uFEFF' + rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); link.download = 'polyloot-orders-demo.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });
  translateCommon(document);
}

function settingsPanel() {
  const display = getDisplayPreferences();
  const faq = Array.isArray(storeSettings.faq) ? storeSettings.faq : [];
  return `<section class="panel settings-panel"><div class="panel-head"><div><h2>${t('ตั้งค่าร้าน', 'Store settings')}</h2><p>${t('ข้อมูลนี้แสดงในหน้าช่วยเหลือของลูกค้า', 'This information appears in customer help')}</p></div></div><form id="store-settings-form" class="settings-form"><div class="settings-card"><h3>${t('ข้อมูลติดต่อ', 'Contact information')}</h3><label>${t('อีเมลติดต่อ', 'Contact email')}<input class="field" name="contact_email" type="email" maxlength="254" value="${escapeHtml(storeSettings.contact_email)}" placeholder="support@example.com"></label><label>${t('โทรศัพท์', 'Phone')}<input class="field" name="contact_phone" maxlength="40" value="${escapeHtml(storeSettings.contact_phone)}" placeholder="+66 ..."></label><label>${t('เวลาติดต่อ', 'Support hours')}<input class="field" name="support_hours" maxlength="120" value="${escapeHtml(storeSettings.support_hours)}"></label></div><div class="settings-card"><h3>${t('ประกาศจากร้าน', 'Store announcement')}</h3><textarea class="field" name="announcement" maxlength="240" rows="3" placeholder="${t('ข้อความสั้นที่แสดงบนหน้าช่วยเหลือและการแจ้งเตือน', 'Short message shown in Help and notifications')}">${escapeHtml(storeSettings.announcement)}</textarea><p>${t('แก้ข้อความแล้วลูกค้าจะเห็นเป็นการแจ้งเตือนใหม่', 'Changing this message creates a new customer notification.')}</p></div><div class="settings-card"><h3>${t('คำถามที่พบบ่อย', 'Frequently asked questions')}</h3><div id="faq-edit-list">${faq.map((row, index) => `<div class="faq-edit-row"><label>${t('คำถาม', 'Question')} ${index + 1}<input class="field" name="faq_question" maxlength="150" value="${escapeHtml(row.question)}"></label><label>${t('คำตอบ', 'Answer')}<textarea class="field" name="faq_answer" maxlength="500" rows="2">${escapeHtml(row.answer)}</textarea></label><button class="mini danger" type="button" data-remove-faq>${t('ลบ', 'Remove')}</button></div>`).join('')}</div><button class="mini" type="button" id="add-faq">+ ${t('เพิ่มคำถาม', 'Add question')}</button><p>${t('เพิ่มได้สูงสุด 8 ข้อ', 'Up to 8 questions')}</p></div><div id="store-settings-result" aria-live="polite"></div><button class="primary" type="submit">${t('บันทึกการตั้งค่า', 'Save settings')}</button></form></section><section class="panel settings-panel"><div class="panel-head"><div><h2>${t('การแสดงผลหลังบ้าน', 'Admin appearance')}</h2><p>${t('ธีมและภาษาบันทึกในเบราว์เซอร์นี้ ใช้ร่วมกับหน้าร้าน', 'Theme and language are saved in this browser and shared with the storefront')}</p></div></div><div class="settings-form"><div class="settings-card"><label>${t('ธีม', 'Theme')}<select class="field" id="admin-theme"><option value="system" ${display.theme === 'system' ? 'selected' : ''}>${t('ตามอุปกรณ์', 'Use device setting')}</option><option value="light" ${display.theme === 'light' ? 'selected' : ''}>${t('สว่าง', 'Light')}</option><option value="dark" ${display.theme === 'dark' ? 'selected' : ''}>${t('มืด', 'Dark')}</option></select></label><label>${t('ภาษา', 'Language')}<select class="field" id="admin-language"><option value="th" ${display.language === 'th' ? 'selected' : ''}>ไทย</option><option value="en" ${display.language === 'en' ? 'selected' : ''}>English</option></select></label><p>${t('เมนูและข้อมูลสินค้าตัวอย่างมีภาษาอังกฤษ ข้อมูลที่ผู้ใช้กรอกจะแสดงตามภาษาต้นฉบับ', 'Menus and demo product details are available in English. User-entered content stays in its original language.')}</p></div></div></section>`;
}

function alertsPanel() {
  const pending = data.orders.filter(item => item.status === 'PENDING');
  const open = (data.tickets || []).filter(item => item.status !== 'RESOLVED');
  return `<section class="panel"><div class="panel-head"><div><h2>${t('สิ่งที่ต้องตรวจสอบ', 'Needs attention')}</h2><p>${t('จากคำสั่งซื้อและคำร้องล่าสุดสูงสุดอย่างละ 100 รายการ', 'From the latest 100 orders and support requests')}</p></div></div><div class="report-grid"><article><span>${t('รอชำระ', 'Pending orders')}</span><strong>${pending.length}</strong><button class="mini" data-view="orders">${t('ดูคำสั่งซื้อ', 'View orders')}</button></article><article><span>${t('คำร้องที่ยังเปิด', 'Open requests')}</span><strong>${open.length}</strong><button class="mini" data-view="support">${t('ดูคำร้อง', 'View requests')}</button></article></div>${open.length ? `<h3>${t('คำร้องล่าสุด', 'Recent requests')}</h3>${open.slice(0, 5).map(item => `<p>${escapeHtml(item.id)} · ${escapeHtml(item.email)}</p>`).join('')}` : `<p>${t('ไม่มีคำร้องค้าง', 'No open requests')}</p>`}</section>`;
}

async function load() {
  const [overview, publicSettings] = await Promise.all([api('?view=overview'), fetch('/api/settings', { cache: 'no-store' }).then(response => response.json()).catch(() => ({ settings: null }))]);
  data = overview;
  if (publicSettings.settings) storeSettings = publicSettings.settings;
  render();
}

app.addEventListener('click', async event => {
  const target = event.target.closest('[data-view], [data-action]');
  if (!target) return;
  if (target.dataset.view) { view = target.dataset.view; render(); return; }
  const action = target.dataset.action;
  if (action === 'view-order') return showOrder(target.dataset.id);
  if (action === 'add-asset') return openAssetModal('create');
  if (action === 'edit-asset') {
    const asset = data.assets.find(b => b.id === target.dataset.id);
    if (!asset) return toast('ไม่พบแอสเซ็ต', true);
    return openAssetModal('edit', asset);
  }
  if (action === 'delete-asset') {
    const asset = data.assets.find(b => b.id === target.dataset.id);
    if (!asset) return toast('ไม่พบแอสเซ็ต', true);
    return confirmDeleteAsset(asset);
  }
  target.disabled = true;
  try {
    if (action === 'refresh') { await load(); toast('อัปเดตข้อมูลล่าสุดแล้ว'); return; }
    if (action === 'logout') { await post({ action }); renderLogin(); return; }
    const input = { action, id: target.dataset.id };
    if (action === 'set-asset-active') input.active = target.dataset.active === 'true';
    await post(input);
    await load();
    toast(action === 'set-asset-active' ? 'อัปเดตหน้าร้านแล้ว' : action === 'delete-asset' ? 'ลบแอสเซ็ตเรียบร้อยแล้ว' : action === 'cancel-order' ? 'ยกเลิกคำสั่งซื้อแล้ว' : action === 'mark-paid' ? 'บันทึกการชำระเงินจำลองแล้ว' : 'ดำเนินการส่งอีเมลแล้ว');
  } catch (error) { toast(error.message, true); if (error.status === 401) renderLogin(); }
  finally { target.disabled = false; }
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const sidebar = document.querySelector('.admin-sidebar.menu-open');
  if (!sidebar) return;
  sidebar.classList.remove('menu-open');
  const toggle = sidebar.querySelector('#admin-menu-toggle');
  toggle?.setAttribute('aria-expanded', 'false');
  toggle?.focus();
});
document.addEventListener('click', event => {
  const sidebar = document.querySelector('.admin-sidebar.menu-open');
  if (sidebar && !sidebar.contains(event.target)) {
    sidebar.classList.remove('menu-open');
    sidebar.querySelector('#admin-menu-toggle')?.setAttribute('aria-expanded', 'false');
  }
});

try {
  const session = await api('?view=session');
  if (session.authenticated) await load(); else renderLogin(session.configured);
} catch (error) { renderLogin(); toast(error.message, true); }

document.addEventListener('click', async e => {
 if (e.target?.id !== 'export-assets') return;
 const response = await fetch('/api/admin?view=export');
 const blob = new Blob([JSON.stringify(await response.json(), null, 2)], {type:'application/json'});
 const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download='polyloot-assets.json'; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});
document.addEventListener('change', async e => {
 if (e.target?.id !== 'import-assets') return;
 try { const payload = JSON.parse(await e.target.files[0].text()); const result = await post({action:'import-assets', assets:payload.assets}); toast(`อัปเดต ${result.updated} รายการ`); await load(); } catch (error) { toast(error.message,true); }
});

