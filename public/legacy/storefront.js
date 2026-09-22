import { productDetails } from './product-gallery.js';
import { applyDisplayPreferences, getDisplayPreferences, saveDisplayPreferences, t, translateCommon } from './settings-ui.js';

const app = document.querySelector('#app');
const navLinks = [...document.querySelectorAll('[data-nav]')];
const cartCount = document.querySelector('#cart-count');
const notificationCount = document.querySelector('#notification-count');
const navAuthAction = document.querySelector('#nav-auth-action');
const mobileMenuToggle = document.querySelector('#mobile-menu-toggle');
const siteHeader = document.querySelector('.site-header');
const settingsMenuWrap = document.querySelector('#settings-menu-wrap');
const settingsMenuToggle = document.querySelector('#settings-menu-toggle');
const settingsDropdown = document.querySelector('#settings-dropdown');
let assets = [];
let searchTerm = '';
let categoryFilter = 'All';
let currentOrder = null;
let customerEmail = '';
let customerUser = null;
let resetToken = '';
let authNext = readSession('safe-auth-next', '#catalog');
let carouselIndex = 1;
let cart = readCart();
let selected = new Set(cart);
let profileData = readSession('safe-profile', { name: '', email: '' });
let storeSettings = null;

function closeMobileMenu(returnFocus = false) {
  if (!mobileMenuToggle) return;
  const wasOpen = siteHeader.classList.contains('menu-open');
  siteHeader.classList.remove('menu-open');
  mobileMenuToggle.setAttribute('aria-expanded', 'false');
  mobileMenuToggle.setAttribute('aria-label', t('เปิดเมนู', 'Open menu'));
  if (returnFocus && wasOpen) mobileMenuToggle.focus();
}
function closeSettingsDropdown(returnFocus = false) {
  const wasOpen = !settingsDropdown.hidden;
  settingsDropdown.hidden = true;
  settingsMenuToggle.setAttribute('aria-expanded', 'false');
  settingsMenuToggle.setAttribute('aria-label', t('เปิดเมนูตั้งค่า', 'Open settings menu'));
  if (returnFocus && wasOpen) settingsMenuToggle.focus();
}
settingsMenuToggle.addEventListener('click', () => {
  const open = settingsDropdown.hidden;
  settingsDropdown.hidden = !open;
  settingsMenuToggle.setAttribute('aria-expanded', String(open));
  settingsMenuToggle.setAttribute('aria-label', open ? t('ปิดเมนูตั้งค่า', 'Close settings menu') : t('เปิดเมนูตั้งค่า', 'Open settings menu'));
  if (open) {
    const current = getDisplayPreferences();
    document.querySelector('#quick-theme').value = current.theme;
    document.querySelector('#quick-language').value = current.language;
    settingsDropdown.querySelector('select')?.focus();
  }
});
settingsMenuWrap.addEventListener('click', event => { if (event.target.closest('a')) closeSettingsDropdown(); });
settingsMenuWrap.addEventListener('change', async event => {
  const key = event.target.id === 'quick-theme' ? 'theme' : event.target.id === 'quick-language' ? 'language' : null;
  if (!key) return;
  saveDisplayPreferences({ [key]: event.target.value });
  if (key === 'language') { closeSettingsDropdown(); route(true); }
  else {
    const field = document.querySelector('#settings-form select[name="theme"]');
    if (field) field.value = event.target.value;
  }
  if (customerUser) {
    try {
      const { preferences } = await api('settings?view=customer');
      const display = getDisplayPreferences();
      await api('settings', { action: 'set-preferences', preferences: { ...preferences, theme: display.theme, language: display.language } });
    } catch { /* The browser preference is still saved if account sync is unavailable. */ }
  }
});
mobileMenuToggle?.addEventListener('click', () => {
  closeSettingsDropdown();
  const open = siteHeader.classList.toggle('menu-open');
  mobileMenuToggle.setAttribute('aria-expanded', String(open));
  mobileMenuToggle.setAttribute('aria-label', open ? t('ปิดเมนู', 'Close menu') : t('เปิดเมนู', 'Open menu'));
  if (open) siteHeader.querySelector('.nav-pills a:not([hidden])')?.focus();
});
siteHeader.querySelector('.nav-pills')?.addEventListener('click', event => { if (event.target.closest('a')) closeMobileMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') { if (!settingsDropdown.hidden) closeSettingsDropdown(true); else closeMobileMenu(true); } });
document.addEventListener('click', event => { if (!settingsMenuWrap.contains(event.target)) closeSettingsDropdown(); if (!siteHeader.contains(event.target)) closeMobileMenu(); });
window.addEventListener('resize', () => { closeSettingsDropdown(); if (window.innerWidth > 800) closeMobileMenu(); });

function readSession(key, fallback) {
  try { return JSON.parse(sessionStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeSession(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {} }
function readCart() {
  let value;
  try { value = JSON.parse(localStorage.getItem('polyloot-cart-v1')); } catch {}
  if (!Array.isArray(value)) value = readSession('safe-cart', []);
  return Array.isArray(value) ? [...new Set(value.filter(id => typeof id === 'string' && /^[a-z0-9-]{1,80}$/.test(id)))].slice(0, 20) : [];
}
function safeDestination(value) {
  return typeof value === 'string' && /^#(?:home|catalog|asset\/[a-z0-9-]+|cart|checkout(?:\/[a-z0-9-]+)?|order\/GA-[A-F0-9]{24}|track|history|profile|library|settings|notifications|help)$/.test(value) ? value : '#catalog';
}
function rememberDestination(value) { authNext = safeDestination(value); writeSession('safe-auth-next', authNext); }
function clearActiveFocus() {
  if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
    document.activeElement.blur();
  }
}
function finishAuth() {
  const next = safeDestination(authNext);
  rememberDestination('#catalog');
  window.history.replaceState(null, '', next);
  route(true);
  syncCustomerSettings();
}
async function syncCustomerSettings() {
  if (!customerUser) return;
  try {
    const result = await api('settings?view=customer');
    if (!localStorage.getItem('polyloot-display-preferences-v1')) saveDisplayPreferences({ theme: result.preferences.theme, language: result.preferences.language });
    notificationCount.textContent = Math.min(9, result.notifications.filter(item => !item.read).length) || '';
    notificationCount.hidden = !notificationCount.textContent;
    translateCommon(document);
  } catch {}
}
function goBack(fallback = '#home') {
  clearActiveFocus();
  if (window.history.length > 1 && (!document.referrer || document.referrer.startsWith(location.origin))) window.history.back();
  else location.hash = fallback;
}
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const money = amount => getDisplayPreferences().language === 'en'
  ? `THB ${new Intl.NumberFormat('en-US').format(amount)}`
  : `${new Intl.NumberFormat('th-TH').format(amount)} บาท`;
const asset = id => assets.find(item => item.id === id);
const cover = (item, eager = false) => `<img class="asset-cover" src="${esc(item.cover)}" alt="ปกแอสเซ็ต ${esc(item.title)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'}>`;
const notice = (text, kind = 'error') => `<div class="notice notice-${kind}" role="alert">${esc(text)}</div>`;
const demo = '<div class="demo-note"><strong>DEMO ONLY</strong><span>การชำระเงินเป็นเพียงการจำลอง ไม่มีการรับเงินจริง ไม่มีการเก็บข้อมูลบัตรหรือ OTP</span></div>';

function normalizeUserNames(source = {}) {
  const firstName = (typeof source.first_name === 'string' ? source.first_name : (typeof source.firstName === 'string' ? source.firstName : '')).trim();
  const lastName = (typeof source.last_name === 'string' ? source.last_name : (typeof source.lastName === 'string' ? source.lastName : '')).trim();
  let fullName = (typeof source.full_name === 'string' ? source.full_name : (typeof source.name === 'string' ? source.name : '')).trim();

  let resolvedFirst = firstName;
  let resolvedLast = lastName;

  if (!resolvedFirst && !resolvedLast && fullName && fullName !== source.username) {
    const parts = fullName.split(/\s+/);
    resolvedFirst = parts[0] || '';
    resolvedLast = parts.slice(1).join(' ') || '';
  }

  const combinedName = [resolvedFirst, resolvedLast].filter(Boolean).join(' ');
  const finalName = combinedName || fullName || source.username || '';

  return {
    firstName: resolvedFirst,
    lastName: resolvedLast,
    first_name: resolvedFirst,
    last_name: resolvedLast,
    fullName: finalName,
    name: finalName
  };
}

function getUserDisplayName(user, fallback = '') {
  if (!user) return fallback;
  const names = normalizeUserNames(user);
  return names.fullName || user.username || fallback;
}

async function api(path, payload) {
  const response = await fetch(`/api/${path}`, { method: payload ? 'POST' : 'GET', headers: payload ? { 'Content-Type': 'application/json' } : {}, body: payload ? JSON.stringify(payload) : undefined, cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && customerUser) {
      rememberDestination(location.hash || '#catalog');
      customerUser = null;
      currentOrder = null;
      customerEmail = '';
      window.history.replaceState(null, '', '#login');
      authPage('login', 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
    }
    throw new Error(data.error || 'ระบบขัดข้อง');
  }
  return data;
}
function refreshCartCount() { cartCount.textContent = cart.length; cartCount.hidden = cart.length === 0; cartCount.parentElement.setAttribute('aria-label', `ตะกร้าสินค้า ${cart.length} รายการ`); }
function setView(html, active = '') {
  closeSettingsDropdown();
  closeMobileMenu();
  clearActiveFocus();
  clearInterval(carouselInterval);
  app.innerHTML = html;
  const isAuth = active === 'login' || active === 'register';
  document.body.classList.toggle('auth-active', isAuth);
  for (const link of navLinks) {
    link.hidden = isAuth && !link.classList.contains('nav-auth-action');
  }
  const displayName = getUserDisplayName(customerUser, profileData);
  navAuthAction.classList.toggle('signed-in', Boolean(customerUser));
  settingsMenuToggle.classList.toggle('is-current', active === 'settings');
  navAuthAction.setAttribute('aria-label', customerUser ? `บัญชีผู้ใช้: ${displayName || 'โปรไฟล์'}` : 'บัญชีผู้ใช้: เข้าสู่ระบบ');
  navLinks.forEach(link => { const on = link.dataset.nav === active || (link.dataset.nav === 'orders' && ['track', 'history'].includes(active)); link.classList.toggle('active', on); if (on) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  translateCommon(document);
  refreshCartCount();
  window.scrollTo(0, 0);
}
function saveCart() { try { localStorage.setItem('polyloot-cart-v1', JSON.stringify(cart)); sessionStorage.removeItem('safe-cart'); } catch {} refreshCartCount(); }
function addToCart(id) { if (!cart.includes(id) && cart.length < 20) cart.push(id); selected.add(id); saveCart(); location.hash = '#cart'; cartPage(); }
function orderTabs(active) { return `<div class="order-tabs" role="navigation" aria-label="ส่วนคำสั่งซื้อ"><a class="${active === 'track' ? 'active' : ''}" href="#track">ติดตามคำสั่งซื้อ</a><a class="${active === 'history' ? 'active' : ''}" href="#history">ประวัติการสั่งซื้อ</a></div>`; }
function statusInfo(order) {
  if (order.status === 'PAID') return { className: 'paid', label: '3D Asset พร้อมใช้งาน', short: 'PAID' };
  if (order.status === 'CANCELLED') return { className: 'cancelled', label: 'ยกเลิกการสั่งซื้อ', short: 'CANCELLED' };
  return { className: 'pending', label: 'กำลังรอการชำระ...', short: 'PENDING' };
}
function orderRow(order, mode = 'track') {
  const items = order.items?.length ? order.items : [asset(order.assetId)].filter(Boolean);
  const first = items[0];
  const status = statusInfo(order);
  const title = first ? `${first.title}${items.length > 1 ? ` และอีก ${items.length - 1} ชุด` : ''}` : 'รายการแอสเซ็ต';
  return `<article class="tracking-row">
    <div class="tracking-cover">${first ? cover(first) : ''}</div>
    <div class="tracking-copy"><h2>${esc(title)}</h2><p>${first ? esc(first.subtitle) : ''}</p><p class="tracking-description">${first ? esc(first.description) : ''}</p><strong>${money(order.price)}</strong><small>คำสั่งซื้อ ${esc(order.id)}</small></div>
    <div class="tracking-side"><div class="tracking-actions">${mode === 'guest' ? '<a class="tracking-button view" href="#login">เข้าสู่ระบบเพื่อดูรายละเอียด</a>' : mode === 'track' && order.status === 'PENDING' ? `<button class="tracking-button pay" type="button" data-track-pay="${esc(order.id)}">ชำระเงิน</button><button class="tracking-button cancel" type="button" data-track-cancel="${esc(order.id)}">ยกเลิก</button>` : `<button class="tracking-button view" type="button" data-open-order="${esc(order.id)}" aria-label="ดูรายละเอียดคำสั่งซื้อ ${esc(order.id)}">ดูรายละเอียด</button>`}</div><span class="badge ${status.className}">${status.label}</span></div>
  </article>`;
}
async function sessionOrders() {
  if (!customerUser) return [];
  return (await api('customer?view=orders')).orders;
}
function bindOpenOrders(container, orders) {
  container.querySelectorAll('[data-open-order]').forEach(button => button.addEventListener('click', () => {
    currentOrder = orders.find(order => order.id === button.dataset.openOrder);
    customerEmail = currentOrder.email;
    location.hash = `#order/${currentOrder.id}`;
    orderPage(currentOrder.id);
  }));
}
function pageHead(title, subtitle = '') { return `<div class="page-heading"><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</div>`; }
function productCard(item) {
  const formats = (item.formats || []).length ? (item.formats || []).slice(0, 3) : ['OBJ', 'FBX', 'GLB'];
  const formatBadges = formats.map(f => `<span class="spec-badge format-badge">${esc(f)}</span>`).join('');
  return `<article class="product-card"><a class="product-cover" href="#asset/${esc(item.id)}" aria-label="ดูรายละเอียด ${esc(item.title)}">${cover(item)}<span class="card-type-tag">3D ASSET</span></a><div class="product-copy"><div class="card-meta-top"><span class="product-category">${esc(item.category || '3D Asset')}</span><span class="card-engine-tag">Unity · UE · Godot</span></div><h3><a href="#asset/${esc(item.id)}">${esc(item.title)}</a></h3><p class="product-description">${esc(item.description)}</p><div class="product-specs">${formatBadges}<span class="spec-badge license-badge">${esc(item.license || 'CC0 1.0')}</span></div><div class="product-bottom"><strong>${money(item.price)} <small>ราคาเดโม</small></strong><button class="pill-button dark" type="button" data-add="${esc(item.id)}">เพิ่มลงตะกร้า</button></div></div></article>`;
}

function recommendedCard(item, index, total) {
  const isVisible = index === 0 || index === 1 || index === total - 1;
  let initClass = '';
  if (total > 0) {
    if (index === 0) initClass = ' center';
    else if (index === 1 || (total === 2 && index === 1)) initClass = ' next';
    else if (index === total - 1) initClass = ' prev';
    else if (index > total / 2) initClass = ' hidden-left';
    else initClass = ' hidden-right';
  }
  return `<a class="recommended-item${initClass}" data-index="${index}" href="#asset/${esc(item.id)}" title="${esc(item.title)}"><div class="recommended-cover-wrap">${cover(item, isVisible)}</div><div class="recommended-title"><h3>${esc(item.title)}</h3></div></a>`;
}

function home() {
  const featured = assets.filter(item => item.is_featured);
  const displayAssets = (featured.length ? featured : assets).slice(0, 5);
  const categories = [['Characters','ตัวละคร'],['Environments','ฉากและพื้นที่'],['Weapons','อาวุธ'],['Vehicles','ยานพาหนะ'],['Props','สิ่งของประกอบ']];
  setView(`
    <section class="home-hero"><div class="home-hero-copy"><span class="home-eyebrow">POLYLOOT / 3D GAME ASSETS</span><h1>หาแอสเซ็ตที่ใช่<br>แล้วสร้างเกมของคุณ</h1><p>โมเดล 3D คุณภาพสูงสำหรับนักพัฒนาเกม เลือกดูรายละเอียดสเปกไฟล์ ทดลองสั่งซื้อ และรับไฟล์ในคลังของคุณได้ทันที</p><div class="hero-actions"><a class="pill-button dark" href="#catalog">เลือกดูสินค้า <span aria-hidden="true">↗</span></a><a class="hero-text-link" href="#library">ไปที่คลังของฉัน →</a></div><div class="dev-stats-strip"><div class="dev-stat-box"><span class="stat-value">34+</span><span class="stat-caption">Game Packs</span></div><div class="dev-stat-box"><span class="stat-value">1,500+</span><span class="stat-caption">3D Models</span></div><div class="dev-stat-box"><span class="stat-value">Unity · UE · Godot</span><span class="stat-caption">Compatible</span></div><div class="dev-stat-box"><span class="stat-value">CC0 1.0</span><span class="stat-caption">Royalty-Free</span></div></div><p class="hero-disclaimer">ร้านสาธิตเพื่อการศึกษา · ราคาจำลอง · ไฟล์ต้นฉบับคุณภาพจาก Kenney</p></div><div class="home-hero-art"><img src="/assets/previews/blocky-characters.png" alt="ตัวอย่างชุด Blocky Characters จาก Kenney"></div></section>
    <section class="home-categories" aria-labelledby="category-heading"><div class="section-title"><h2 id="category-heading">เลือกตามหมวดหมู่</h2><span>3D Assets สำหรับเกม</span></div><div class="category-grid">${categories.map(([id,label], index) => `<a href="#catalog" data-home-category="${id}" class="category-tile"><span class="category-index">0${index + 1}</span><span class="category-name">${label}</span><span class="category-english">${id}</span><span class="category-arrow" aria-hidden="true">↗</span></a>`).join('')}</div></section>
    <section class="home-featured" aria-labelledby="featured-heading"><div class="section-title"><h2 id="featured-heading">สินค้าที่แนะนำ</h2><a class="section-link" href="#catalog">ดูสินค้าทั้งหมด →</a></div><div class="product-grid">${displayAssets.map(productCard).join('')}</div></section>
    <section class="how-it-works" aria-labelledby="how-heading"><div><span class="home-eyebrow">HOW IT WORKS</span><h2 id="how-heading">จากไอเดียสู่ไฟล์พร้อมใช้</h2><p>ขั้นตอนการซื้อใน Mini Project นี้เป็นการจำลอง ไม่มีการเรียกเก็บเงินจริง</p></div><ol><li><span>01</span><strong>ค้นหาแอสเซ็ต</strong><small>กรองหมวดและดูรายละเอียดไฟล์</small></li><li><span>02</span><strong>สั่งซื้อจำลอง</strong><small>บันทึกคำสั่งซื้อและสถานะ</small></li><li><span>03</span><strong>ดาวน์โหลด</strong><small>เข้าถึงไฟล์จากคลังหลังชำระสำเร็จ</small></li></ol></section>
  `, 'home');
}

let carouselInterval = null;
function initCarousel(total) {
  clearInterval(carouselInterval);
  const track = document.getElementById('rec-track');
  if (!track || total === 0) return;
  const prevBtn = document.querySelector('.rec-arrow.prev');
  const nextBtn = document.querySelector('.rec-arrow.next');
  let isPaused = false;
  let currentIndex = 0;
  const items = Array.from(track.children);
  const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function renderCarousel() {
    items.forEach((item, i) => {
      item.classList.remove('center', 'prev', 'next', 'hidden-left', 'hidden-right');
      const diff = (i - currentIndex + total) % total;

      if (diff === 0) {
        item.classList.add('center');
      } else if (diff === 1 || (diff === total - 1 && total === 2 && i > currentIndex)) {
        item.classList.add('next');
      } else if (diff === total - 1) {
        item.classList.add('prev');
      } else {
        // Decide whether to hide left or right to make rotation direction smooth
        if (diff > total / 2) {
          item.classList.add('hidden-left');
        } else {
          item.classList.add('hidden-right');
        }
      }
    });
  }

  function next() {
    currentIndex = (currentIndex + 1) % total;
    renderCarousel();
  }

  function prevSlide() {
    currentIndex = (currentIndex - 1 + total) % total;
    renderCarousel();
  }

  function resetTimer() {
    clearInterval(carouselInterval);
    if (!isReduced) {
      carouselInterval = setInterval(() => {
        if (!document.getElementById('rec-track')) { clearInterval(carouselInterval); return; }
        if (!isPaused && document.visibilityState === 'visible') {
          next();
        }
      }, 5000);
    }
  }

  renderCarousel();
  prevBtn.addEventListener('click', () => { prevSlide(); resetTimer(); });
  nextBtn.addEventListener('click', () => { next(); resetTimer(); });
  track.addEventListener('pointerenter', () => { isPaused = true; });
  track.addEventListener('pointerleave', () => { isPaused = false; });
  track.addEventListener('focusin', () => { isPaused = true; });
  track.addEventListener('focusout', () => { isPaused = false; });

  let touchStartX = 0;
  let touchStartY = 0;
  let isTouching = false;
  let swiped = false;

  track.addEventListener('touchstart', event => {
    if (event.touches.length === 1) {
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
      isTouching = true;
      swiped = false;
      isPaused = true;
    }
  }, { passive: true });

  track.addEventListener('touchend', event => {
    if (!isTouching || !event.changedTouches.length) {
      isPaused = false;
      resetTimer();
      return;
    }
    isTouching = false;
    isPaused = false;

    const deltaX = event.changedTouches[0].clientX - touchStartX;
    const deltaY = event.changedTouches[0].clientY - touchStartY;

    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY)) {
      swiped = true;
      if (deltaX < 0) {
        next();
      } else {
        prevSlide();
      }
    }
    resetTimer();
  }, { passive: true });

  track.addEventListener('touchcancel', () => {
    isTouching = false;
    isPaused = false;
    resetTimer();
  }, { passive: true });

  track.addEventListener('click', event => {
    if (swiped) {
      event.preventDefault();
      event.stopPropagation();
      swiped = false;
    }
  }, true);

  resetTimer();
}

function catalog() {
  const categories = ['All','Characters','Environments','Weapons','Vehicles','Props'];
  setView(`<section class="catalog-hero"><div class="catalog-hero-content"><div class="kicker">THE COLLECTION</div><h1>แอสเซ็ตสำหรับสร้างเกม<span class="catalog-hero-sub">เลือกชุดที่เข้ากับโปรเจกต์ของคุณ</span></h1><p class="catalog-hero-desc">ตรวจสอบรูปแบบไฟล์ เอนจินที่รองรับ และสิทธิ์การใช้งานก่อนสั่งซื้อ</p><div class="catalog-hero-features"><span class="hero-pill">5 หมวดหมู่</span><span class="hero-pill">ไฟล์ 3D พร้อมใช้</span><span class="hero-pill">ตัวอย่างสำหรับ Mini Project</span></div></div></section><div class="section-title"><h2>สินค้าทั้งหมด</h2><span id="catalog-count"></span></div><div class="catalog-controls"><label class="visually-hidden" for="asset-search">ค้นหาสินค้า</label><input id="asset-search" type="search" placeholder="ค้นหาชื่อสินค้า รูปแบบไฟล์ หรือเอนจิน..." value="${esc(searchTerm)}" aria-label="ค้นหาสินค้า"><label class="visually-hidden" for="category-filter">หมวดหมู่</label><select id="category-filter" aria-label="หมวดหมู่">${categories.map(c => `<option value="${c}" ${categoryFilter === c ? 'selected' : ''}>${c === 'All' ? 'ทุกหมวดหมู่' : c}</option>`).join('')}</select></div><div class="quick-category-pills" role="group" aria-label="ตัวกรองด่วนหมวดหมู่">${categories.map(c => `<button type="button" class="quick-cat-btn${categoryFilter === c ? ' active' : ''}" data-cat="${c}">${c === 'All' ? 'ทั้งหมด (All)' : c}</button>`).join('')}</div><div id="catalog-grid" class="product-grid" aria-live="polite"></div>`, 'catalog');
  const grid = document.querySelector('#catalog-grid');
  const update = () => {
    const query = searchTerm.trim().toLocaleLowerCase();
    const shown = assets.filter(item => (categoryFilter === 'All' || item.category === categoryFilter) && `${item.title} ${item.description} ${item.category} ${(item.formats || []).join(' ')} ${(item.engines || []).join(' ')}`.toLocaleLowerCase().includes(query));
    document.querySelector('#catalog-count').textContent = `${shown.length} จาก ${assets.length} ชุด`;
    document.querySelectorAll('.quick-cat-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.cat === categoryFilter));
    grid.innerHTML = shown.length ? shown.map(productCard).join('') : `<div class="catalog-empty"><h3>ไม่พบสินค้าที่ตรงกับการค้นหา</h3><p>ลองใช้คำค้นอื่นหรือเปลี่ยนหมวดหมู่</p><button class="pill-button outline" type="button" id="clear-filters">แสดงสินค้าทั้งหมด</button></div>`;
    grid.querySelector('#clear-filters')?.addEventListener('click', () => { searchTerm = ''; categoryFilter = 'All'; document.querySelector('#asset-search').value = ''; document.querySelector('#category-filter').value = 'All'; update(); });
  };
  document.querySelector('#asset-search').addEventListener('input', event => { searchTerm = event.target.value; update(); });
  document.querySelector('#category-filter').addEventListener('change', event => { categoryFilter = event.target.value; update(); });
  document.querySelectorAll('.quick-cat-btn').forEach(btn => btn.addEventListener('click', event => { categoryFilter = event.currentTarget.dataset.cat; document.querySelector('#category-filter').value = categoryFilter; update(); }));
  update();
}

function detail(id) {
  const item = asset(id); if (!item) return notFound();
  const info = productDetails[id];
  const hasSample = Boolean(info) || ['animated-characters-protagonists', 'animated-characters-retro'].includes(id);
  const slides = [{ kind: 'image', src: item.cover, label: `ภาพรวม ${item.title}` }, ...(info?.slides || [])];
  const mainSlide = slide => slide.kind === 'sheet'
    ? `<div class="gallery-sample-grid">${slide.items.map(part => `<figure><img src="${esc(part.src)}" alt="ตัวอย่างโมเดล ${esc(part.label)}" loading="lazy"><figcaption>${esc(part.label)}</figcaption></figure>`).join('')}</div>`
    : `<img class="gallery-large-image" src="${esc(slide.src)}" alt="${esc(slide.label)}" loading="${slide === slides[0] ? 'eager' : 'lazy'}">`;
  const gallery = `<div class="product-gallery"><div class="gallery-stage" aria-live="polite">${slides.map((slide, index) => `<div class="gallery-slide${index === 0 ? ' is-active' : ''}" data-gallery-slide="${index}" ${index ? 'hidden' : ''}>${mainSlide(slide)}<span class="gallery-caption">${esc(slide.label)}</span></div>`).join('')}</div><div class="gallery-thumbs" role="group" aria-label="เลือกภาพตัวอย่างสินค้า">${slides.map((slide, index) => `<button type="button" class="gallery-thumb${index === 0 ? ' is-active' : ''}" data-gallery-thumb="${index}" aria-label="ภาพ ${index + 1}: ${esc(slide.label)}" aria-pressed="${index === 0}">${slide.kind === 'sheet' ? `<img src="${esc(slide.items[0].src)}" alt="" loading="lazy"><span>+${slide.items.length}</span>` : `<img src="${esc(slide.src)}" alt="" loading="lazy">`}</button>`).join('')}</div><p class="gallery-credit">ภาพตัวอย่างจากไฟล์ต้นฉบับในแพ็ก Kenney · ภาพโมเดลแยกอาจมีขนาดเล็ก</p></div>`;
  const bytes = Number(item.file_size_bytes) || 0;
  const size = bytes ? `${(bytes / 1048576).toFixed(1)} MB` : (item.file_size || 'ดูรายละเอียดในไฟล์');
  const features = info ? `<div class="product-inside"><div><span class="kicker">INSIDE THE PACK</span><h3>ในชุดนี้มีอะไร</h3><p><strong>${info.count} ${esc(info.noun)}</strong> จากไฟล์ต้นฉบับที่ตรวจสอบแล้ว</p></div><ul>${info.highlights.map(point => `<li>${esc(point)}</li>`).join('')}</ul></div>` : '';
  const related = assets.filter(other => other.id !== id).sort((a, b) => Number(b.category === item.category) - Number(a.category === item.category)).slice(0, 4);
  setView(`<button class="back-link" type="button" data-back-fallback="#catalog">← กลับไปดูสินค้าทั้งหมด</button>
    <div class="product-breadcrumb">สินค้า <span>/</span> ${esc(item.category || '3D Assets')} <span>/</span> <strong>${esc(item.title)}</strong></div>
    <section class="white-panel detail-panel detail-store"><div>${gallery}</div><div class="detail-copy"><div class="detail-kicker"><span class="kicker">${esc(item.category || '3D Asset')}</span><span class="detail-license">${esc(item.license || 'ตรวจสอบสิทธิ์')}</span></div><h1>${esc(item.title)}</h1><p class="detail-subtitle">${esc(item.subtitle)}</p><p class="detail-lead">${esc(item.description)}</p>${info ? `<div class="detail-count"><strong>${info.count}</strong><span>${esc(info.noun)}ในแพ็ก</span></div>` : ''}<div class="detail-meta"><span>ผู้จัดทำ <strong>${esc(item.author)}</strong></span><span>รูปแบบไฟล์ <strong>${esc((item.formats || []).join(' · ') || 'ดูรายละเอียด')}</strong></span><span>เอนจินที่ระบุ <strong>${esc((item.engines || []).join(' · ') || 'ตรวจสอบก่อนใช้')}</strong></span><span>เวอร์ชัน <strong>${esc(item.version || '—')}</strong></span><span>ขนาด ZIP <strong>${esc(size)}</strong></span><span>สิทธิ์ใช้งาน <strong>${esc(item.license || 'ดูต้นฉบับ')}</strong></span></div><div class="product-buy-box"><div><small>ราคาจำลองสำหรับ Mini Project</small><strong class="detail-price">${money(item.price)}</strong></div><div class="detail-actions"><button class="pill-button dark" type="button" data-add="${esc(item.id)}">เพิ่มลงตะกร้า</button><a class="pill-button outline" href="#checkout/${esc(item.id)}">สั่งซื้อชุดนี้</a>${hasSample ? `<a class="pill-button light" href="/assets/samples/${esc(item.id)}.zip" download>ดาวน์โหลดโมเดลตัวอย่างฟรี</a>` : ''}</div><p>ชำระเงินแบบจำลอง · ไม่มีการรับเงินจริง · ตัวอย่างฟรีมีเพียง 1 โมเดลจากแพ็ก</p></div><p class="source-note">ไฟล์ต้นฉบับจาก <a href="${esc(item.source_url || `https://kenney.nl/assets/${item.id}`)}" target="_blank" rel="noopener noreferrer">Kenney ↗</a> · ตรวจสอบเงื่อนไขสิทธิ์ก่อนใช้งาน</p></div></section>
    ${features}
    <section class="product-information"><div class="section-title"><h2>ข้อมูลก่อนนำไปใช้</h2><span>PRODUCT DETAILS</span></div><div class="product-info-grid"><article><span class="product-info-number">01</span><h3>ไฟล์ที่ได้รับ</h3><p>แพ็ก ZIP ประกอบด้วยโมเดล 3D ในรูปแบบที่ระบุด้านบน พร้อมไฟล์ประกอบตามชุดต้นฉบับ ดูภาพตัวอย่างเพื่อเลือกชิ้นที่เหมาะกับเกมของคุณ</p></article><article><span class="product-info-number">02</span><h3>ใช้งานกับโปรเจกต์</h3><p>นำเข้าไฟล์ด้วยรูปแบบที่เอนจินรองรับ แล้วตรวจวัสดุและขนาดโมเดลในโปรเจกต์ของคุณ ความเข้ากันได้ขึ้นอยู่กับเวอร์ชันและการตั้งค่าของแต่ละเอนจิน</p></article><article><span class="product-info-number">03</span><h3>รับไฟล์และสิทธิ์</h3><p>หลังจำลองชำระเงินสำเร็จ ดาวน์โหลดจากคลังของบัญชีได้ หากลิงก์หมดอายุสามารถเปิดคำสั่งซื้อเพื่อรับลิงก์ใหม่ สินค้าเริ่มต้นจาก Kenney ใช้สิทธิ์ CC0 1.0</p></article></div></section>
    ${related.length ? `<section class="product-related"><div class="section-title"><h2>เลือกดูชุดอื่นด้วย</h2><a class="section-link" href="#catalog">ดูสินค้าทั้งหมด →</a></div><div class="product-grid">${related.map(productCard).join('')}</div></section>` : ''}`, 'catalog');
  document.querySelectorAll('[data-gallery-thumb]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.galleryThumb);
    document.querySelectorAll('[data-gallery-slide]').forEach(slide => { const active = Number(slide.dataset.gallerySlide) === index; slide.hidden = !active; slide.classList.toggle('is-active', active); });
    document.querySelectorAll('[data-gallery-thumb]').forEach(thumb => { const active = thumb === button; thumb.classList.toggle('is-active', active); thumb.setAttribute('aria-pressed', String(active)); });
  }));
}

function authPage(mode = 'login', message = '') {
  if (customerUser) { window.history.replaceState(null, '', safeDestination(authNext) === '#catalog' ? '#profile' : safeDestination(authNext)); return route(); }
  const register = mode === 'register';
  const formFields = register
    ? `<label for="auth-username">Username</label><input id="auth-username" name="username" autocomplete="username" required minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" placeholder="Username"><p class="field-note">ใช้ตัวอักษรอังกฤษ ตัวเลข หรือ _ จำนวน 3–24 ตัว</p><label for="auth-first">ชื่อ</label><input id="auth-first" name="first" autocomplete="given-name" required maxlength="80" placeholder="ชื่อ"><label for="auth-last">นามสกุล</label><input id="auth-last" name="last" autocomplete="family-name" required maxlength="80" placeholder="นามสกุล"><label for="auth-email">อีเมล</label><input id="auth-email" name="email" type="email" autocomplete="email" required maxlength="254" placeholder="อีเมล">`
    : `<label for="auth-identifier">Username หรืออีเมล</label><input id="auth-identifier" name="identifier" autocomplete="username" required maxlength="254" placeholder="Username หรืออีเมล">`;
  const passIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
  const passWrap = (id, name, auto, placeholder) => `<div class="password-wrap"><input id="${id}" name="${name}" type="password" autocomplete="${auto}" required minlength="8" maxlength="128" placeholder="${placeholder}"><button type="button" class="toggle-password" aria-label="แสดงรหัสผ่าน" aria-pressed="false">${passIcon}</button></div>`;
  const form = `<form id="auth-form">${formFields}<label for="auth-password">รหัสผ่าน</label>${passWrap('auth-password', 'password', register ? 'new-password' : 'current-password', 'Password')}${register ? `<label for="auth-confirm">ยืนยันรหัสผ่าน</label>${passWrap('auth-confirm', 'confirmPassword', 'new-password', 'Confirm Password')}` : ''}<div id="live-message" aria-live="polite"></div><button class="pill-button dark" type="submit">${register ? 'สร้างบัญชี' : 'เข้าสู่ระบบ'}</button></form>`;
  const content = register
    ? `<h2 class="auth-title">สร้างบัญชี</h2><p class="auth-desc">กรอกข้อมูลด้านล่างเพื่อดำเนินการต่อ</p>${form}<div class="auth-bottom"><a class="auth-switch" href="#login">มีบัญชีอยู่แล้ว? เข้าสู่ระบบ</a></div>`
    : `<h2 class="auth-title">เข้าสู่ระบบ</h2><p class="auth-desc">เข้าสู่บัญชีของคุณเพื่อดำเนินการต่อ</p>${message ? notice(message, message.startsWith('ลิงก์ยืนยัน') ? 'error' : 'success') : ''}${form}<div class="auth-bottom"><a class="auth-link" href="#forgot-password">ลืมรหัสผ่าน?</a><a class="auth-switch" href="#register">ยังไม่มีบัญชี? สมัครสมาชิก</a></div>`;
  const brandArea = `<div class="auth-brand"><div class="kicker">3D ASSET STORE</div><h1>${register ? 'สร้างเรื่องใหม่<br>เริ่มได้ที่นี่' : 'ยินดีต้อนรับ<br>กลับมา'}</h1><p>${register ? 'สร้างบัญชีเพื่อบันทึกคำสั่งซื้อและเข้าถึง 3D Asset ของคุณ' : 'เข้าสู่ระบบเพื่อดูคำสั่งซื้อและเข้าถึง 3D Asset ของคุณ'}</p></div>`;
  setView(`<section class="auth-layout">${brandArea}<div class="white-panel auth-card">${content}</div></section>`, register ? 'register' : 'login');
  document.querySelectorAll('.toggle-password').forEach(btn => btn.addEventListener('click', e => {
    const input = e.currentTarget.previousElementSibling;
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    e.currentTarget.setAttribute('aria-pressed', String(isPass));
    e.currentTarget.innerHTML = isPass ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>' : passIcon;
  }));
  document.querySelector('#auth-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = register ? 'กำลังสร้างบัญชี...' : 'กำลังเข้าสู่ระบบ...';
    document.querySelector('#live-message').innerHTML = '';
    try {
      const payload = { action: register ? 'register' : 'login', password: form.elements.namedItem('password').value };
      if (register) {
        payload.username = form.elements.namedItem('username').value.trim();
        payload.email = form.elements.namedItem('email').value.trim();
        payload.first = form.elements.namedItem('first')?.value.trim() || '';
        payload.last = form.elements.namedItem('last')?.value.trim() || '';
        payload.confirmPassword = form.elements.namedItem('confirmPassword').value;
        if (!payload.first || !payload.last) throw new Error('กรุณากรอกชื่อและนามสกุล');
        if (payload.password !== payload.confirmPassword) throw new Error('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
      }
      else payload.identifier = form.elements.namedItem('identifier').value;
      const result = await api('customer', payload);
      if (result.confirmationRequired) { document.querySelector('#live-message').innerHTML = notice('สมัครสมาชิกแล้ว กรุณายืนยันอีเมลจากจดหมายก่อนเข้าสู่ระบบ', 'success'); button.textContent = originalText; return; }
      customerUser = result.user;
      profileData = { name: customerUser.name || '', firstName: customerUser.firstName || '', lastName: customerUser.lastName || '', email: customerUser.email };
      writeSession('safe-profile', profileData);
      finishAuth();
    } catch (error) {
      document.querySelector('#live-message').innerHTML = notice(error.message);
      button.disabled = false;
      button.textContent = originalText;
    }
  });
}

function forgotPage() {
  const brandArea = `<div class="auth-brand"><div class="kicker">3D ASSET STORE</div><h1>ยินดีต้อนรับ<br>กลับมา</h1><p>เข้าสู่ระบบเพื่อดูคำสั่งซื้อและเข้าถึง 3D Asset ของคุณ</p></div>`;
  setView(`<section class="auth-layout">${brandArea}<div class="white-panel auth-card"><h2 class="auth-title">ลืมรหัสผ่าน</h2><p class="auth-desc">กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์เปลี่ยนรหัสผ่านให้</p><form id="forgot-form"><label for="forgot-email">อีเมลบัญชี</label><input id="forgot-email" name="email" type="email" autocomplete="email" required placeholder="อีเมล"><div id="live-message" aria-live="polite"></div><button class="pill-button dark" type="submit">ส่งลิงก์ทางอีเมล</button></form><div class="auth-bottom"><a class="auth-switch" href="#login">← กลับไปเข้าสู่ระบบ</a></div></div></section>`, 'login');
  document.querySelector('#forgot-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'กำลังส่ง...';
    try {
      const result = await api('customer', { action: 'forgot-password', email: event.currentTarget.elements.namedItem('email').value });
      document.querySelector('#live-message').innerHTML = notice('หากอีเมลนี้มีบัญชีอยู่ กรุณาตรวจกล่องจดหมายและอีเมลขยะ', 'success') + (result.demoResetUrl ? `<p class="auth-note">โหมดทดสอบในเครื่อง: <a href="${esc(result.demoResetUrl)}">เปิดลิงก์เปลี่ยนรหัสผ่าน</a></p>` : '');
      button.textContent = originalText;
    } catch (error) { document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; button.textContent = originalText; }
  });
}

function resetPage() {
  if (!resetToken) return forgotPage();
  const brandArea = `<div class="auth-brand"><div class="kicker">3D ASSET STORE</div><h1>ยินดีต้อนรับ<br>กลับมา</h1><p>เข้าสู่ระบบเพื่อดูคำสั่งซื้อและเข้าถึง 3D Asset ของคุณ</p></div>`;
  const passIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
  const passWrap = (id, name, auto, placeholder) => `<div class="password-wrap"><input id="${id}" name="${name}" type="password" autocomplete="${auto}" required minlength="8" maxlength="128" placeholder="${placeholder}"><button type="button" class="toggle-password" aria-label="แสดงรหัสผ่าน" aria-pressed="false">${passIcon}</button></div>`;
  setView(`<section class="auth-layout">${brandArea}<div class="white-panel auth-card"><h2 class="auth-title">ตั้งรหัสผ่านใหม่</h2><p class="auth-desc">รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร</p><form id="reset-form"><label for="reset-password">รหัสผ่านใหม่</label>${passWrap('reset-password', 'password', 'new-password', 'Password')}<label for="reset-confirm">ยืนยันรหัสผ่านใหม่</label>${passWrap('reset-confirm', 'confirm', 'new-password', 'Confirm Password')}<div id="live-message" aria-live="polite"></div><button class="pill-button dark" type="submit">เปลี่ยนรหัสผ่าน</button></form></div></section>`, 'login');
  document.querySelectorAll('.toggle-password').forEach(btn => btn.addEventListener('click', e => {
    const input = e.currentTarget.previousElementSibling;
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    e.currentTarget.setAttribute('aria-pressed', String(isPass));
    e.currentTarget.innerHTML = isPass ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>' : passIcon;
  }));
  document.querySelector('#reset-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const password = form.elements.namedItem('password').value;
    if (password !== form.elements.namedItem('confirm').value) { document.querySelector('#live-message').innerHTML = notice('รหัสผ่านสองช่องไม่ตรงกัน'); return; }
    const button = form.querySelector('button');
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'กำลังเปลี่ยนรหัสผ่าน...';
    try {
      await api('customer', { action: 'reset-password', token: resetToken, password });
      resetToken = '';
      customerUser = null;
      currentOrder = null;
      location.hash = '#login';
      authPage('login', 'เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบอีกครั้ง');
    } catch (error) { document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; button.textContent = originalText; }
  });
}

function requireLogin(next) {
  if (customerUser) return true;
  rememberDestination(next);
  window.history.replaceState(null, '', '#login');
  authPage();
  return false;
}

function cartPage() {
  const items = cart.map(asset).filter(Boolean);
  const selectedItems = items.filter(item => selected.has(item.id));
  const total = selectedItems.reduce((sum, item) => sum + item.price, 0);
  setView(`<section class="white-panel cart-panel cart-standalone"><div class="cart-page-heading"><div><span class="kicker">YOUR CART</span><h1>ตะกร้าสินค้า</h1><p>${items.length ? `${items.length} รายการในตะกร้า · เลือกสินค้าที่ต้องการก่อนชำระเงิน` : 'เลือกสินค้าเพื่อเริ่มคำสั่งซื้อ'}</p></div><a class="pill-button outline" href="#catalog">เลือกดูสินค้าเพิ่ม →</a></div>${items.length ? `<div class="cart-layout"><div class="cart-list">${items.map(item => `<div class="cart-row"><input type="checkbox" class="cart-check" aria-label="เลือก ${esc(item.title)}" data-select="${esc(item.id)}" ${selected.has(item.id) ? 'checked' : ''}><div class="cart-cover">${cover(item)}</div><div class="cart-copy"><h2>${esc(item.title)}</h2><p>${esc(item.subtitle)}</p><p>${esc(item.description)}</p><strong>${money(item.price)}</strong></div><button type="button" class="remove-button" aria-label="นำ ${esc(item.title)} ออกจากตะกร้า" data-remove="${esc(item.id)}">×</button></div>`).join('')}</div><div class="cart-sidebar"><div class="cart-total-box"><span class="cart-total-label">ยอดรวม ${selectedItems.length} รายการที่เลือก</span><strong class="cart-total-price">${money(total)}</strong><a class="pill-button dark ${selectedItems.length ? '' : 'disabled'}" href="${selectedItems.length ? '#checkout' : '#cart'}" ${selectedItems.length ? '' : 'aria-disabled="true"'}>ชำระเงิน →</a></div></div></div>` : `<div class="empty-state"><p>ยังไม่มีสินค้าในตะกร้า</p><a class="pill-button dark" href="#catalog">เลือกดู 3D Asset</a></div>`}</section>`, 'cart');
  document.querySelectorAll('[data-select]').forEach(input => input.addEventListener('change', event => { const id = event.currentTarget.dataset.select; if (event.currentTarget.checked) selected.add(id); else selected.delete(id); cartPage(); }));
  document.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', event => { const id = event.currentTarget.dataset.remove; cart = cart.filter(item => item !== id); selected.delete(id); saveCart(); cartPage(); }));
}

function checkout(singleId = '') {
  if (!requireLogin(singleId ? `#checkout/${singleId}` : '#checkout')) return;
  const ids = singleId ? [singleId] : cart.filter(id => selected.has(id));
  const items = ids.map(asset).filter(Boolean);
  if (!items.length) return cartPage();
  const total = items.reduce((sum, item) => sum + item.price, 0);
  const buyerName = getUserDisplayName(customerUser, profileData);
  setView(`<button class="back-link" type="button" data-back-fallback="${singleId ? `#asset/${esc(singleId)}` : '#cart'}">← ย้อนกลับ</button>${pageHead('การชำระสินค้า')}
    <section class="white-panel checkout-panel"><div class="checkout-title"><div><div class="kicker">CHECKOUT / DEMO</div><h2>ยืนยันคำสั่งซื้อ</h2></div><span class="status-pill pending">ยังไม่ชำระ</span></div>${demo}
    <div class="checkout-columns"><div><h3>รายการสินค้า</h3>${items.map(item => `<div class="checkout-item"><div class="checkout-cover">${cover(item)}</div><div><strong>${esc(item.title)}</strong><p>${esc(item.subtitle)}</p><b>${money(item.price)}</b></div></div>`).join('')}<div class="checkout-total"><span>ยอดรวมจำลอง</span><strong>${money(total)}</strong></div></div>
    <div><h3>ข้อมูลสำหรับรับแอสเซ็ต</h3><form id="checkout-form"><label for="buyer-name">ชื่อผู้สั่งซื้อ</label><input id="buyer-name" name="name" minlength="2" maxlength="80" autocomplete="name" required value="${esc(buyerName)}" placeholder="ชื่อผู้สั่งซื้อ"><label for="buyer-email">อีเมลบัญชี</label><input id="buyer-email" name="email" type="email" value="${esc(customerUser.email)}" readonly><p class="field-note">แอสเซ็ตและคำสั่งซื้อจะผูกกับอีเมลบัญชีนี้</p><div id="live-message" aria-live="polite"></div><button class="pill-button dark wide" type="submit">สร้างคำสั่งซื้อ PENDING</button></form></div></div></section>`, 'cart');
  document.querySelector('#checkout-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button[type=submit]'); button.disabled = true;
    document.querySelector('#live-message').innerHTML = '';
    try {
      const { order } = await api('orders', { assetIds: ids, name: form.elements.namedItem('name').value });
      currentOrder = order; customerEmail = order.email;
      cart = cart.filter(id => !ids.includes(id)); ids.forEach(id => selected.delete(id)); saveCart();
      window.history.replaceState(null, '', `#order/${order.id}`); orderPage(order.id);
    } catch (error) { document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; }
  });
}

function pendingPayment(order, items) {
  setView(`${pageHead('การชำระสินค้า')}<section class="white-panel mock-payment-panel">${demo}<div class="kicker">PAYMENT / DEMO</div><h2>เลือกการชำระสินค้า</h2><div class="mock-methods" role="group" aria-label="ตัวเลือกการชำระเงินจำลอง"><button type="button" data-mock-method="card" aria-pressed="false">บัตรเครดิต</button><button type="button" data-mock-method="qr" class="active" aria-pressed="true">QR PromptPay</button></div><div class="mock-payment-grid"><div><h3>อีเมลสำหรับจัดส่งสินค้า</h3><div class="mock-readonly">${esc(order.email)}</div><h3>เลขคำสั่งซื้อ</h3><div class="mock-readonly order-number">${esc(order.id)}</div><p class="mock-payment-summary">${items.map(item => esc(item.title)).join(' · ')}<br><strong>ยอดรวมจำลอง ${money(order.price)}</strong></p></div><div class="mock-payment-explain"><span class="mock-symbol" aria-hidden="true">◎</span><h3>QR PromptPay (ตัวอย่าง)</h3><p id="mock-method-note">ไม่มี QR สำหรับรับเงินจริง กด “จำลองชำระเงินสำเร็จ” เพื่อทดสอบขั้นตอนถัดไป</p></div></div></section><div class="mock-payment-actions"><a class="pill-button light" href="#track">ชำระสินค้าในภายหลัง</a><button class="pill-button light" id="pay-button" type="button">จำลองชำระเงินสำเร็จ</button><button class="pill-button mock-cancel" id="cancel-button" type="button">ยกเลิกการชำระ</button></div><div id="live-message" class="mock-payment-message" aria-live="polite"></div>`, 'orders');
  document.querySelectorAll('[data-mock-method]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-mock-method]').forEach(option => { const active = option === button; option.classList.toggle('active', active); option.setAttribute('aria-pressed', String(active)); });
    const isCard = button.dataset.mockMethod === 'card';
    document.querySelector('.mock-payment-explain h3').textContent = isCard ? 'บัตรเครดิต (ตัวอย่าง)' : 'QR PromptPay (ตัวอย่าง)';
    document.querySelector('#mock-method-note').textContent = isCard ? 'ระบบนี้ไม่รับข้อมูลบัตรจริง กด “จำลองชำระเงินสำเร็จ” เพื่อทดสอบขั้นตอนถัดไป' : 'ไม่มี QR สำหรับรับเงินจริง กด “จำลองชำระเงินสำเร็จ” เพื่อทดสอบขั้นตอนถัดไป';
  }));
  document.querySelector('#pay-button').addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true; button.textContent = 'กำลังอัปเดต…';
    try { const data = await api('pay', { id: order.id, email: customerEmail || order.email }); currentOrder = data.order; orderPage(order.id); }
    catch (error) { document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; button.textContent = 'จำลองชำระเงินสำเร็จ'; }
  });
  document.querySelector('#cancel-button').addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true;
    try { const data = await api('cancel', { id: order.id, email: customerEmail || order.email }); currentOrder = data.order; orderPage(order.id); }
    catch (error) { document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; }
  });
}

function orderPage(id) {
  if (!requireLogin(`#order/${id}`)) return;
  if (!currentOrder || currentOrder.id !== id) {
    setView('<div class="loading">กำลังโหลดคำสั่งซื้อ…</div>', 'track');
    api('order', { id }).then(data => {
      if (location.hash !== `#order/${id}`) return;
      currentOrder = data.order;
      customerEmail = data.order.email;
      orderPage(id);
    }).catch(error => {
      if (location.hash === `#order/${id}`) setView(`<section class="white-panel empty-state">${notice(error.message)}<a class="pill-button dark" href="#track">กลับหน้าติดตาม</a></section>`, 'track');
    });
    return;
  }
  const order = currentOrder;
  const paid = order.status === 'PAID';
  const cancelled = order.status === 'CANCELLED';
  const status = statusInfo(order);
  const items = order.items?.length ? order.items : [asset(order.assetId)].filter(Boolean);
  if (!paid && !cancelled) return pendingPayment(order, items);
  const deliveryText = { SENT: 'ส่งอีเมลแจ้งข้อมูลคำสั่งซื้อแล้ว โปรดตรวจกล่องจดหมายและอีเมลขยะ', DEMO: 'โหมดทดสอบในเครื่อง: การจำลองคำสั่งซื้อเสร็จสมบูรณ์', FAILED: 'คำสั่งซื้อสำเร็จแล้ว แต่ระบบยังไม่สามารถส่งอีเมลได้ สามารถเข้าถึง 3D Asset ได้จากลิงก์ด้านล่าง', NOT_CONFIGURED: 'ระบบยังไม่สามารถส่งอีเมลได้ในขณะนี้ สามารถเข้าถึง 3D Asset ได้จากลิงก์ด้านล่าง', NOT_SENT: 'ยังไม่ได้ส่งอีเมล สามารถเข้าถึง 3D Asset ได้จากลิงก์ด้านล่าง' }[order.emailStatus];
  setView(`${orderTabs('track')}${pageHead(paid ? '✓ คำสั่งซื้อเสร็จสมบูรณ์' : cancelled ? 'ยกเลิกคำสั่งซื้อแล้ว' : 'รอชำระสินค้า')}
    <section class="white-panel status-panel"><div class="status-panel-head"><div><div class="kicker">ORDER SUMMARY</div><h2>คำสั่งซื้อ ${esc(order.id)}</h2></div><span class="status-pill ${status.className}">${status.short}</span></div>${demo}<div class="status-id"><span>เลขคำสั่งซื้อ</span><strong>${esc(order.id)}</strong><button class="small-action" type="button" id="copy-id">คัดลอก</button></div><div class="status-items"><h3>รายละเอียดสินค้า</h3>${items.map(item => `<div class="status-item"><div class="status-cover">${cover(item)}</div><div><strong>${esc(item.title)}</strong><p>${esc(item.subtitle)}</p><b>${money(item.price)}</b></div></div>`).join('')}</div><div class="status-facts"><div><span>ยอดรวมจำลอง</span><strong>${money(order.price)}</strong></div><div><span>อีเมลรับแอสเซ็ต</span><strong>${esc(order.email)}</strong></div><div><span>วันที่สั่งซื้อ</span><strong>${esc(new Intl.DateTimeFormat(getDisplayPreferences().language === 'en' ? 'en-US' : 'th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(order.createdAt)))}</strong></div><div><span>สถานะ</span><strong>${esc(status.label)}</strong></div></div><div class="receipt-actions"><button class="pill-button outline" type="button" id="print-order">พิมพ์ / บันทึกใบสรุป</button><a class="pill-button light" href="#help">แจ้งปัญหาคำสั่งซื้อ</a></div><p class="receipt-disclaimer">เอกสารสรุปคำสั่งซื้อสำหรับโปรเจกต์สาธิต ไม่ใช่ใบเสร็จรับเงินจริงหรือใบกำกับภาษี</p>${paid ? `<div class="delivery-panel"><h3>การส่งมอบ</h3><p>${esc(deliveryText || 'กำลังตรวจผลการส่งอีเมล')}</p>${items.map(item => order.downloadUrls?.[item.id] || (items.length === 1 ? order.downloadUrl : '') ? `<a href="${esc(order.downloadUrls?.[item.id] || order.downloadUrl)}" target="_blank" rel="noopener">เปิด 3D Asset ${esc(item.title)} ↗</a>` : '').join('')}${['FAILED', 'NOT_CONFIGURED', 'NOT_SENT'].includes(order.emailStatus) ? '<button class="pill-button outline" type="button" id="retry-email-button">ลองส่งอีเมลอีกครั้ง</button>' : ''}<small>ลิงก์ใช้ได้ 24 ชั่วโมง ควรเปิดในเบราว์เซอร์หรือแอปอีเมล</small></div>` : cancelled ? `<div class="cancelled-panel">คำสั่งซื้อนี้ถูกยกเลิกแล้ว</div>` : `<div class="payment-demo"><div><h3>ชำระเงินจำลอง</h3><p>กดปุ่มเพื่อเปลี่ยนสถานะเป็น PAID และทดสอบการส่งมอบแอสเซ็ต</p></div><div class="payment-actions"><button class="pill-button dark" type="button" id="pay-button">จำลองชำระเงินสำเร็จ</button><button class="pill-button danger-outline" type="button" id="cancel-button">ยกเลิกคำสั่งซื้อ</button></div></div>`}<div id="live-message" aria-live="polite"></div></section>`, 'orders');
  document.querySelector('#print-order').addEventListener('click', () => window.print());
  document.querySelector('#copy-id').addEventListener('click', async () => { try { await navigator.clipboard.writeText(order.id); document.querySelector('#copy-id').textContent = 'คัดลอกแล้ว'; } catch {} });
  document.querySelector('#pay-button')?.addEventListener('click', async event => { const button = event.currentTarget; button.disabled = true; button.textContent = 'กำลังอัปเดต…'; try { const data = await api('pay', { id: order.id, email: customerEmail || order.email }); currentOrder = data.order; orderPage(order.id); } catch (error) { try { const latest = await api('order', { id: order.id, email: customerEmail || order.email }); if (latest.order.status !== order.status) { currentOrder = latest.order; orderPage(order.id); return; } } catch {} document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; button.textContent = 'จำลองชำระเงินสำเร็จ'; } });
  document.querySelector('#retry-email-button')?.addEventListener('click', async event => { const button = event.currentTarget; button.disabled = true; button.textContent = 'กำลังส่ง…'; try { const data = await api('pay', { id: order.id, email: customerEmail || order.email }); currentOrder = data.order; orderPage(order.id); } catch (error) { document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; button.textContent = 'ลองส่งอีเมลอีกครั้ง'; } });
  document.querySelector('#cancel-button')?.addEventListener('click', async event => { const button = event.currentTarget; button.disabled = true; try { const data = await api('cancel', { id: order.id, email: customerEmail || order.email }); currentOrder = data.order; orderPage(order.id); } catch (error) { document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; } });
}

async function track(prefill = '') {
  setView(`${orderTabs('track')}<section class="white-panel tracking-panel"><div class="tracking-heading"><h1>รายการการสั่งซื้อทั้งหมด</h1><button class="tracking-lookup-trigger" id="open-track-search" type="button" aria-label="ค้นหาคำสั่งซื้อด้วยเลขคำสั่งซื้อและอีเมล" aria-haspopup="dialog" aria-controls="track-search-dialog"><span class="tracking-search-label">ค้นหา<span class="tracking-search-extra">คำสั่งซื้อ</span></span><span class="tracking-search-icon" aria-hidden="true"></span></button></div><p class="tracking-note">${customerUser ? `คำสั่งซื้อของ ${esc(customerUser.email)}` : 'ค้นหาสถานะด้วยเลขคำสั่งซื้อและอีเมล'} · การชำระเงินเป็นระบบจำลอง</p><div id="track-message" aria-live="polite"></div><div id="tracking-list" class="tracking-list"><div class="loading">กำลังโหลดรายการ…</div></div>
    <dialog class="track-dialog" id="track-search-dialog" aria-labelledby="track-dialog-title"><div class="track-dialog-head"><div><div class="kicker">FIND YOUR ORDER</div><h2 id="track-dialog-title">ค้นหาคำสั่งซื้อ</h2><p>กรอกเลขคำสั่งซื้อและอีเมลที่ใช้สั่งซื้อ</p></div><button class="track-dialog-close" id="close-track-search" type="button" aria-label="ปิดหน้าต่างค้นหา">×</button></div><form id="track-form"><label for="track-id">เลขคำสั่งซื้อ</label><input id="track-id" name="id" required maxlength="27" value="${esc(prefill)}" placeholder="เลขคำสั่งซื้อ" autofocus><label for="track-email">อีเมลที่ใช้สั่งซื้อ</label><input id="track-email" name="email" type="email" required maxlength="254" value="${esc(customerUser?.email || '')}" ${customerUser ? 'readonly' : ''} placeholder="Email"><div id="live-message" aria-live="polite"></div><div class="track-dialog-actions"><button class="pill-button outline" id="cancel-track-search" type="button">ปิด</button><button class="pill-button dark" type="submit">ดูสถานะคำสั่งซื้อ</button></div></form></dialog></section>`, 'track');
  const dialog = document.querySelector('#track-search-dialog');
  document.querySelector('#open-track-search').addEventListener('click', () => dialog.showModal());
  document.querySelector('#close-track-search').addEventListener('click', () => dialog.close());
  document.querySelector('#cancel-track-search').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  if (prefill) dialog.showModal();
  document.querySelector('#track-form').addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button[type=submit]'); button.disabled = true; try { const data = await api('order', { id: form.elements.namedItem('id').value.trim().toUpperCase(), email: form.elements.namedItem('email').value.trim() }); dialog.close(); if (customerUser) { currentOrder = data.order; customerEmail = data.order.email; location.hash = `#order/${data.order.id}`; orderPage(data.order.id); } else { document.querySelector('#tracking-list').innerHTML = orderRow(data.order, 'guest'); } } catch (error) { document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; } });
  const list = document.querySelector('#tracking-list');
  if (!customerUser) { list.innerHTML = '<div class="empty-state"><p>กรอกเลขคำสั่งซื้อและอีเมลเพื่อดูสถานะ</p></div>'; return; }
  let orders;
  try { orders = await sessionOrders(); }
  catch (error) { if (list.isConnected) list.innerHTML = notice(error.message); return; }
  if (!list.isConnected) return;
  list.innerHTML = orders.length ? orders.map(order => orderRow(order)).join('') : `<div class="empty-state"><p>ยังไม่มีประวัติการสั่งซื้อ</p></div>`;
  bindOpenOrders(list, orders);
  for (const action of ['pay', 'cancel']) {
    list.querySelectorAll(`[data-track-${action}]`).forEach(button => button.addEventListener('click', async () => {
      const order = orders.find(item => item.id === button.dataset[`track${action[0].toUpperCase()}${action.slice(1)}`]);
      button.disabled = true;
      try {
        const data = await api(action, { id: order.id, email: order.email });
        currentOrder = data.order;
        customerEmail = order.email;
        await track();
      } catch (error) {
        document.querySelector('#track-message').innerHTML = notice(error.message);
        button.disabled = false;
      }
    }));
  }
}

async function orderHistory() {
  if (!requireLogin('#history')) return;
  setView(`${orderTabs('history')}<section class="white-panel tracking-panel history-panel"><h1>ประวัติการสั่งซื้อทั้งหมด</h1><p class="tracking-note">คำสั่งซื้อของ ${esc(customerUser.email)}</p><div id="history-list" class="tracking-list"><div class="loading">กำลังโหลดรายการ…</div></div></section>`, 'orders');
  const list = document.querySelector('#history-list');
  let orders;
  try { orders = await sessionOrders(); }
  catch (error) { if (list.isConnected) list.innerHTML = notice(error.message); return; }
  if (!list.isConnected) return;
  list.innerHTML = orders.length ? orders.map(order => orderRow(order, 'history')).join('') : `<div class="empty-state"><p>ยังไม่มีประวัติการสั่งซื้อ</p></div>`;
  bindOpenOrders(list, orders);
}

async function logoutCustomer(button) {
  button.disabled = true;
  try {
    await api('customer', { action: 'logout' });
    customerUser = null;
    notificationCount.hidden = true;
    currentOrder = null;
    customerEmail = '';
    rememberDestination('#catalog');
    profileData = { name: '', firstName: '', lastName: '', email: '' };
    writeSession('safe-profile', profileData);
    window.history.replaceState(null, '', '#login');
    authPage();
  } catch (error) {
    const message = document.querySelector('#live-message');
    if (message) message.innerHTML = notice(error.message);
    else {
      document.querySelector('.nav-notice')?.remove();
      const banner = document.createElement('div');
      banner.className = 'nav-notice';
      banner.setAttribute('role', 'alert');
      banner.textContent = error.message;
      document.querySelector('.site-header').after(banner);
    }
  } finally { button.disabled = false; }
}

function profileHeaderName(user, profile) {
  const merged = { ...profile, ...user };
  const names = normalizeUserNames(merged);
  return names.fullName || user?.username || 'สมาชิก PolyLoot';
}

function profile(feedback = null) {
  if (!customerUser) return requireLogin('#profile');
  const names = normalizeUserNames({ ...profileData, ...customerUser });
  const firstVal = names.firstName;
  const lastVal = names.lastName;
  const headerName = profileHeaderName(customerUser, profileData);

  setView(`${pageHead('บัญชีของฉัน', 'จัดการโปรไฟล์และตั้งค่าบัญชีของคุณ')}
    <section class="white-panel dashboard-panel">
      <div class="dashboard-header">
        <div class="dashboard-avatar" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        </div>
        <div class="dashboard-meta">
          <h2>${esc(headerName)}</h2>
          <p>${esc(customerUser.email)}</p>
        </div>
      </div>
      <div class="dashboard-body">
        <div class="dashboard-section">
          <h3>ข้อมูลทั่วไป</h3>
          <form id="profile-form" class="profile-form">
            <div class="form-group">
              <label for="profile-username">Username</label>
              <input id="profile-username" name="username" value="${esc(customerUser.username || '')}" ${customerUser.username ? 'readonly' : 'required minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}"'} placeholder="Username">
              ${customerUser.username ? '' : '<p class="field-note">ตั้ง Username สำหรับเข้าสู่ระบบ (3–24 ตัว ใช้ a-z, 0-9 หรือ _)</p>'}
            </div>
            <div class="form-group">
              <label for="profile-first">ชื่อ</label>
              <input id="profile-first" name="first" autocomplete="given-name" value="${esc(firstVal)}" placeholder="ชื่อ">
            </div>
            <div class="form-group">
              <label for="profile-last">นามสกุล</label>
              <input id="profile-last" name="last" autocomplete="family-name" value="${esc(lastVal)}" placeholder="นามสกุล">
            </div>
            <div class="form-group">
              <label for="profile-email">อีเมล</label>
              <input id="profile-email" name="email" type="email" value="${esc(customerUser.email)}" readonly placeholder="อีเมล">
            </div>
            <div id="live-message" aria-live="polite">${feedback ? notice(feedback.text, feedback.kind) : ''}</div>
            <div class="dashboard-actions">
              <button class="pill-button dark" type="submit">บันทึกข้อมูล</button>
            </div>
          </form>
        </div>
        <div class="dashboard-sidebar">
          <h3>เมนูบัญชี</h3>
          <a class="dashboard-link" href="#history">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> ประวัติการสั่งซื้อ
          </a>
          <a class="dashboard-link" href="#forgot-password">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> เปลี่ยนรหัสผ่าน
          </a>
          <a class="dashboard-link" href="#settings">⚙ ${t('ตั้งค่าบัญชี', 'Settings')}</a>
          <a class="dashboard-link" href="#notifications">♧ ${t('การแจ้งเตือน', 'Notifications')}</a>
          <a class="dashboard-link" href="#help">? ${t('ศูนย์ช่วยเหลือ', 'Help center')}</a>
          <button class="dashboard-link danger" id="customer-logout" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg> ออกจากระบบ
          </button>
        </div>
      </div>
    </section>`, 'profile');

  document.querySelector('#profile-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type=submit]');
    const first = form.elements.namedItem('first').value.trim();
    const last = form.elements.namedItem('last').value.trim();
    const usernameInput = form.elements.namedItem('username');
    const username = usernameInput ? usernameInput.value.trim() : '';

    if (!first) {
      document.querySelector('#live-message').innerHTML = notice('กรุณากรอกชื่อ');
      return;
    }
    button.disabled = true;
    button.textContent = 'กำลังบันทึก...';
    try {
      const payload = { action: 'update-profile', first, last };
      if (!customerUser.username && username) payload.username = username;
      const result = await api('customer', payload);
      customerUser = result.user;
      profileData = {
        name: result.user.name,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        email: customerUser.email
      };
      writeSession('safe-profile', profileData);
      const displayName = getUserDisplayName(customerUser, profileData);
      navAuthAction.setAttribute('aria-label', `บัญชีผู้ใช้: ${displayName || 'โปรไฟล์'}`);
      profile({ text: 'บันทึกข้อมูลเรียบร้อยแล้ว', kind: 'success' });
    } catch (error) {
      document.querySelector('#live-message').innerHTML = notice(error.message);
      button.disabled = false;
      button.textContent = 'บันทึกข้อมูล';
    }
  });
  document.querySelector('#customer-logout').addEventListener('click', event => logoutCustomer(event.currentTarget));
}

async function helpPage() {
  try { storeSettings = (await api('settings')).settings; } catch {}
  if (location.hash !== '#help') return;
  const setting = storeSettings || {};
  const contact = `<section class="white-panel contact-panel"><div class="section-title"><h2>${t('ข้อมูลติดต่อร้าน', 'Contact the store')}</h2><span>CONTACT</span></div>${setting.announcement ? `<div class="store-announcement"><strong>${t('ประกาศจากร้าน', 'Store announcement')}</strong><p>${esc(setting.announcement)}</p></div>` : ''}<div class="contact-grid"><article><span>${t('อีเมลติดต่อ', 'Email')}</span><strong>${setting.contact_email ? `<a href="mailto:${esc(setting.contact_email)}">${esc(setting.contact_email)}</a>` : t('ใช้แบบฟอร์มคำร้องด้านล่าง', 'Use the request form below')}</strong></article><article><span>${t('โทรศัพท์', 'Phone')}</span><strong>${setting.contact_phone ? `<a href="tel:${esc(setting.contact_phone.replace(/[^0-9+]/g, ''))}">${esc(setting.contact_phone)}</a>` : '—'}</strong></article><article><span>${t('เวลาติดต่อ', 'Support hours')}</span><strong>${esc(setting.support_hours || '—')}</strong></article></div>${Array.isArray(setting.faq) && setting.faq.length ? `<div class="faq-list"><h3>${t('คำถามที่พบบ่อย', 'Frequently asked questions')}</h3>${setting.faq.map(row => `<details><summary>${esc(row.question)}</summary><p>${esc(row.answer)}</p></details>`).join('')}</div>` : ''}</section>`;
  setView(`${pageHead('ศูนย์ช่วยเหลือ', 'ข้อมูลก่อนสั่งซื้อ ดาวน์โหลด และแจ้งปัญหา')}<section class="white-panel help-panel"><div class="help-grid"><article><h2>ร้านนี้เป็นโปรเจกต์สาธิต</h2><p>ราคาที่เห็นและขั้นตอนชำระเงินเป็นข้อมูลจำลอง ไม่มีการเรียกเก็บเงินจริง และไม่ต้องกรอกเลขบัตรหรือ OTP</p></article><article><h2>สินค้าและสิทธิ์ใช้งาน</h2><p>แอสเซ็ตตัวอย่าง ${assets.length} ชุดมาจาก Kenney ภายใต้ CC0 1.0 ดูแหล่งที่มา รูปแบบไฟล์ และรายละเอียดสินค้าแต่ละชิ้นก่อนใช้งาน</p></article><article><h2>คำสั่งซื้อและไฟล์</h2><p>ติดตามหรือยกเลิกคำสั่งซื้อก่อนจำลองชำระเงิน หลังสถานะสำเร็จ ไฟล์จะอยู่ในคลังบัญชี และสร้างลิงก์ดาวน์โหลดใหม่ได้เมื่อลิงก์เดิมหมดอายุ</p></article><article><h2>แจ้งปัญหา</h2><p>ส่งคำร้องผ่านแบบฟอร์มด้านล่าง พร้อมเลขคำสั่งซื้อหากเกี่ยวข้อง ผู้ดูแลจะเห็นคำร้องใน Admin และอัปเดตสถานะให้ ห้ามส่งรหัสผ่าน ข้อมูลบัตร หรือ OTP</p></article></div><div class="help-actions"><a class="pill-button dark" href="#catalog">เลือกดูสินค้า</a><a class="pill-button light" href="#track">ดูคำสั่งซื้อ</a></div></section><section class="white-panel support-panel"><div class="section-title"><h2>ติดต่อผู้ดูแลร้าน</h2><span>SUPPORT</span></div>${customerUser ? `<p>ส่งในนาม ${esc(customerUser.email)} · เก็บคำร้องไว้ในบัญชีของคุณ</p><form id="support-form"><label>หัวข้อ<select class="field" name="category"><option value="DOWNLOAD">ดาวน์โหลดไฟล์</option><option value="ORDER">คำสั่งซื้อ</option><option value="PRODUCT">ข้อมูลสินค้า</option><option value="ACCOUNT">บัญชีผู้ใช้</option><option value="OTHER">อื่น ๆ</option></select></label><label>เลขคำสั่งซื้อ (ถ้ามี)<input class="field" name="orderId" pattern="GA-[A-Fa-f0-9]{24}" placeholder="GA-..."></label><label>รายละเอียด<textarea class="field" name="message" required minlength="10" maxlength="2000" rows="5" placeholder="อธิบายปัญหาที่พบ โดยไม่ส่งข้อมูลลับ"></textarea></label><button class="pill-button dark" type="submit">ส่งคำร้อง</button><div id="support-result" aria-live="polite"></div></form><div id="ticket-history"><p>กำลังโหลดคำร้อง...</p></div>` : `<p>เข้าสู่ระบบเพื่อส่งคำร้องและติดตามสถานะ</p><a class="pill-button dark" href="#login">เข้าสู่ระบบ</a>`}</section>`, 'help');
  document.querySelector('.support-panel').insertAdjacentHTML('beforebegin', contact);
  translateCommon(document.querySelector('.contact-panel'));
  if (!customerUser) return;
  const showTickets = async () => {
    const panel = document.querySelector('#ticket-history');
    if (!panel) return;
    try {
      const result = await api('support');
      const states = { OPEN: 'รับเรื่องแล้ว', IN_PROGRESS: 'กำลังตรวจสอบ', RESOLVED: 'ดำเนินการแล้ว' };
      panel.innerHTML = `<h3>คำร้องของฉัน</h3>${result.tickets.length ? result.tickets.map(ticket => `<article class="ticket-row"><strong>${esc(ticket.id)}</strong><span>${states[ticket.status] || esc(ticket.status)}</span><p>${esc(ticket.message)}</p>${ticket.orderId ? `<small>คำสั่งซื้อ ${esc(ticket.orderId)}</small>` : ''}</article>`).join('') : '<p>ยังไม่มีคำร้อง</p>'}`;
    } catch (error) { panel.innerHTML = notice(error.message); }
  };
  document.querySelector('#support-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget; const button = form.querySelector('button'); button.disabled = true;
    try {
      const result = await api('support', { category: form.elements.namedItem('category').value, orderId: form.elements.namedItem('orderId').value, message: form.elements.namedItem('message').value });
      document.querySelector('#support-result').innerHTML = notice(`ส่งคำร้องแล้ว เลขอ้างอิง ${result.ticket.id}`, 'success');
      form.reset(); await showTickets();
    } catch (error) { document.querySelector('#support-result').innerHTML = notice(error.message); }
    finally { button.disabled = false; }
  });
  await showTickets();
}

async function refreshNotificationCount() {
  if (!customerUser) { notificationCount.hidden = true; return; }
  try {
    const result = await api('settings?view=customer');
    const count = result.notifications.filter(item => !item.read).length;
    notificationCount.textContent = count > 9 ? '9+' : String(count);
    notificationCount.hidden = count === 0;
    document.querySelector('.nav-notifications')?.setAttribute('aria-label', `${t('การแจ้งเตือน', 'Notifications')} ${count}`);
  } catch { notificationCount.hidden = true; }
}

async function settingsPage() {
  setView(`<section class="white-panel settings-panel"><h1>${t('ตั้งค่าบัญชี', 'Settings')}</h1><p>${t('กำลังโหลดการตั้งค่า...', 'Loading settings...')}</p></section>`, 'settings');
  let server = null;
  if (customerUser) {
    try { server = await api('settings?view=customer'); }
    catch (error) { if (location.hash === '#settings') setView(notice(error.message), 'settings'); return; }
  }
  if (location.hash !== '#settings') return;
  const current = getDisplayPreferences();
  const prefs = server?.preferences || { ...current, notify_orders: true, notify_support: true, notify_announcements: true };
  setView(`${pageHead(t('ตั้งค่าบัญชี', 'Settings'), t('ปรับหน้าตา ภาษา และการแจ้งเตือนของคุณ', 'Choose your appearance, language and notifications'))}
    <section class="white-panel settings-panel"><div class="settings-hero"><h2>${t('ประสบการณ์ที่เหมาะกับคุณ', 'Make the store yours')}</h2><p>${customerUser ? esc(customerUser.email) : t('บันทึกธีมและภาษาไว้ในเบราว์เซอร์นี้', 'Appearance and language are saved in this browser')}</p></div>
    <form id="settings-form" class="settings-form"><div class="settings-card"><h3>${t('การแสดงผล', 'Appearance')}</h3><label>${t('ธีม', 'Theme')}<select name="theme" class="field"><option value="system" ${current.theme === 'system' ? 'selected' : ''}>${t('ตามอุปกรณ์', 'Use device setting')}</option><option value="light" ${current.theme === 'light' ? 'selected' : ''}>${t('สว่าง', 'Light')}</option><option value="dark" ${current.theme === 'dark' ? 'selected' : ''}>${t('มืด', 'Dark')}</option></select></label><label>${t('ภาษา', 'Language')}<select name="language" class="field"><option value="th" ${current.language === 'th' ? 'selected' : ''}>ไทย</option><option value="en" ${current.language === 'en' ? 'selected' : ''}>English</option></select></label><p>${t('เมนูและข้อมูลสินค้าตัวอย่างมีภาษาอังกฤษ ข้อมูลที่ผู้ใช้กรอกจะแสดงตามภาษาต้นฉบับ', 'Menus and demo product details are available in English. User-entered content stays in its original language.')}</p></div>
    ${customerUser ? `<div class="settings-card"><h3>${t('การแจ้งเตือนในเว็บไซต์', 'In-app notifications')}</h3><label class="settings-check"><input type="checkbox" name="notify_orders" ${prefs.notify_orders ? 'checked' : ''}><span>${t('สถานะคำสั่งซื้อและการดาวน์โหลด', 'Order status and downloads')}</span></label><label class="settings-check"><input type="checkbox" name="notify_support" ${prefs.notify_support ? 'checked' : ''}><span>${t('ความคืบหน้าคำร้อง', 'Support request updates')}</span></label><label class="settings-check"><input type="checkbox" name="notify_announcements" ${prefs.notify_announcements ? 'checked' : ''}><span>${t('ประกาศจากร้าน', 'Store announcements')}</span></label><p>${t('การแจ้งเตือนอยู่ในเว็บไซต์นี้ อีเมลส่งมอบคำสั่งซื้อยังทำงานตามปกติ', 'These controls affect in-app notifications. Order delivery email still works as usual.')}</p></div>` : `<div class="settings-card"><h3>${t('ซิงก์การตั้งค่ากับบัญชี', 'Sync with your account')}</h3><p>${t('เข้าสู่ระบบเพื่อบันทึกตัวเลือกการแจ้งเตือนในบัญชี', 'Sign in to save notification choices to your account.')}</p><a class="pill-button outline" href="#login">${t('เข้าสู่ระบบ', 'Sign in')}</a></div>`}
    <div id="settings-result" aria-live="polite"></div><button class="pill-button dark" type="submit">${t('บันทึกการตั้งค่า', 'Save settings')}</button></form>
    <div class="settings-links">${customerUser ? `<a href="#profile">${t('ข้อมูลส่วนตัวและรหัสผ่าน', 'Personal details and password')} →</a><a href="#notifications">${t('ดูการแจ้งเตือน', 'View notifications')} →</a>` : ''}<a href="#help">${t('ข้อมูลติดต่อและความช่วยเหลือ', 'Contact and help')} →</a></div></section>`, 'settings');
  document.querySelector('#settings-form').addEventListener('change', event => {
    if (event.target.name === 'theme') { document.documentElement.dataset.theme = event.target.value === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : event.target.value; }
  });
  document.querySelector('#settings-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button[type=submit]'); button.disabled = true;
    const theme = form.elements.namedItem('theme').value; const language = form.elements.namedItem('language').value;
    try {
      if (customerUser) await api('settings', { action: 'set-preferences', preferences: { theme, language, notify_orders: form.elements.namedItem('notify_orders').checked, notify_support: form.elements.namedItem('notify_support').checked, notify_announcements: form.elements.namedItem('notify_announcements').checked } });
      saveDisplayPreferences({ theme, language });
      settingsPage(); refreshNotificationCount();
    } catch (error) { document.querySelector('#settings-result').innerHTML = notice(error.message); button.disabled = false; applyDisplayPreferences(); }
  });
}

async function notificationsPage() {
  if (!requireLogin('#notifications')) return;
  setView(`<section class="white-panel notifications-panel"><h1>${t('การแจ้งเตือน', 'Notifications')}</h1><p>${t('กำลังโหลด...', 'Loading...')}</p></section>`, 'notifications');
  try {
    const result = await api('settings?view=customer');
    if (location.hash !== '#notifications') return;
    const count = result.notifications.filter(item => !item.read).length;
    const labels = { PAID: t('พร้อมดาวน์โหลด', 'Ready to download'), PENDING: t('รอชำระ', 'Pending'), CANCELLED: t('ยกเลิก', 'Cancelled'), OPEN: t('รับเรื่องแล้ว', 'Received'), IN_PROGRESS: t('กำลังตรวจสอบ', 'In progress'), RESOLVED: t('ดำเนินการแล้ว', 'Resolved'), NEW: t('ใหม่', 'New') };
    setView(`${pageHead(t('การแจ้งเตือน', 'Notifications'), `${count} ${t('รายการที่ยังไม่อ่าน', 'unread')}`)}<section class="white-panel notifications-panel"><div class="notifications-head"><h2>${t('รายการล่าสุด', 'Recent updates')}</h2>${count ? `<button id="mark-all-read" class="pill-button outline" type="button">${t('ทำเครื่องหมายว่าอ่านทั้งหมด', 'Mark all as read')}</button>` : ''}</div>${result.notifications.length ? result.notifications.map(item => `<article class="notification-row ${item.read ? 'is-read' : ''}"><div class="notification-dot" aria-hidden="true"></div><div><strong>${t(item.title, ({ 'ได้รับคำสั่งซื้อแล้ว': 'Order received', 'สินค้าในคำสั่งซื้อพร้อมดาวน์โหลด': 'Your assets are ready', 'คำสั่งซื้อถูกยกเลิก': 'Order cancelled', 'รับคำร้องแล้ว': 'Request received', 'กำลังตรวจสอบคำร้อง': 'Request in progress', 'คำร้องดำเนินการแล้ว': 'Request resolved', 'ประกาศจากร้าน': 'Store announcement' })[item.title])}</strong><p>${esc(item.detail)}</p><small>${labels[item.status] || ''} · ${esc(new Intl.DateTimeFormat(getDisplayPreferences().language === 'en' ? 'en-US' : 'th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt)))}</small></div><div class="notification-actions"><a href="${esc(item.href)}">${t('เปิดดู', 'View')}</a>${!item.read ? `<button type="button" data-read-id="${esc(item.id)}">${t('อ่านแล้ว', 'Mark read')}</button>` : ''}</div></article>`).join('') : `<div class="empty-state"><p>${t('ยังไม่มีการแจ้งเตือน', 'No notifications yet')}</p><a href="#settings">${t('ตั้งค่าการแจ้งเตือน', 'Notification settings')}</a></div>`}<div class="settings-links"><a href="#settings">${t('ตั้งค่าการแจ้งเตือน', 'Notification settings')} →</a></div></section>`, 'notifications');
    document.querySelector('#mark-all-read')?.addEventListener('click', async event => { const button = event.currentTarget; button.disabled = true; try { await api('settings', { action: 'mark-all-read' }); await notificationsPage(); await refreshNotificationCount(); } catch (error) { button.disabled = false; alert(error.message); } });
    document.querySelectorAll('[data-read-id]').forEach(button => button.addEventListener('click', async event => { const target = event.currentTarget; target.disabled = true; try { await api('settings', { action: 'mark-read', id: target.dataset.readId }); await notificationsPage(); await refreshNotificationCount(); } catch (error) { target.disabled = false; alert(error.message); } }));
  } catch (error) { if (location.hash === '#notifications') setView(notice(error.message), 'notifications'); }
}

function notFound() { setView(`<section class="white-panel empty-state"><h1>ไม่พบหน้านี้</h1><a class="pill-button dark" href="#home">กลับหน้าแรก</a></section>`); }
let lastRoutedHash = null;
function route(force = false) {
  clearActiveFocus();
  if (!force && location.hash === lastRoutedHash) return;
  lastRoutedHash = location.hash;
  const [section, id] = location.hash.slice(1).split('/');
  if (!section || section === 'home') home();
  else if (section === 'catalog') catalog();
  else if (section === 'asset') detail(id);
  else if (section === 'library') libraryPage();
  else if (section === 'help') helpPage();
  else if (section === 'cart') cartPage();
  else if (section === 'checkout') checkout(id);
  else if (section === 'order') orderPage(id);
  else if (section === 'track') track();
  else if (section === 'history') orderHistory();
  else if (section === 'profile') profile();
  else if (section === 'settings') settingsPage();
  else if (section === 'notifications') notificationsPage();
  else if (section === 'login' || section === 'register') authPage(section);
  else if (section === 'forgot-password') forgotPage();
  else if (section === 'reset-password') resetPage();
  else notFound();
}
app.addEventListener('click', event => { const category = event.target.closest('[data-home-category]'); if (category) { categoryFilter = category.dataset.homeCategory; searchTerm = ''; if (location.hash === '#catalog') catalog(); } const back = event.target.closest('[data-back-fallback]'); if (back) return goBack(back.dataset.backFallback); const login = event.target.closest('a[href="#login"]'); if (login && !customerUser && !/^#(?:login|register|forgot-password|reset-password)/.test(location.hash)) rememberDestination(location.hash || '#home'); const add = event.target.closest('[data-add]'); if (add) addToCart(add.dataset.add); });
app.addEventListener('error', event => {
  const img = event.target;
  if (!(img instanceof HTMLImageElement) || !img.classList.contains('asset-cover')) return;
  const fallback = document.createElement('div');
  fallback.className = 'asset-cover fallback-cover';
  fallback.textContent = img.alt.replace(/^ปกแอสเซ็ต\s*/, '');
  img.replaceWith(fallback);
}, true);
navAuthAction.addEventListener('click', () => { if (customerUser) { location.hash = '#profile'; profile(); } else { rememberDestination(location.hash || '#home'); location.hash = '#login'; authPage(); } });
try {
  const [catalog, session, publicSettings] = await Promise.all([api('assets'), api('customer?view=session'), api('settings').catch(() => ({ settings: null }))]);
  assets = catalog.assets;
  customerUser = session.user;
  storeSettings = publicSettings.settings;
  if (customerUser) {
    profileData = { name: customerUser.name || '', firstName: customerUser.firstName || '', lastName: customerUser.lastName || '', email: customerUser.email };
    writeSession('safe-profile', profileData);
    await syncCustomerSettings();
  }
  cart = cart.filter(id => asset(id));
  selected = new Set(cart);
  refreshCartCount();
  window.addEventListener('hashchange', () => route());
  window.addEventListener('popstate', () => route());
  window.addEventListener('pageshow', event => { clearActiveFocus(); if (event.persisted) route(true); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') clearActiveFocus(); });
  if (/^#(access_token|error=|error_code=)/.test(location.hash)) {
    const params = new URLSearchParams(location.hash.slice(1));
    const failed = params.has('error');
    const recovery = params.get('type') === 'recovery' && params.has('access_token');
    resetToken = recovery ? params.get('access_token') : '';
    window.history.replaceState(null, '', recovery ? '#reset-password' : '#login');
    if (recovery) resetPage();
    else authPage('login', failed ? 'ลิงก์ยืนยันหมดอายุหรือไม่ถูกต้อง' : 'ยืนยันอีเมลแล้ว กรุณาเข้าสู่ระบบ');
  } else if (location.hash.startsWith('#reset-password?token=')) {
    resetToken = new URLSearchParams(location.hash.split('?')[1]).get('token') || '';
    window.history.replaceState(null, '', '#reset-password');
    resetPage();
  } else route(true);
}
catch (error) { app.innerHTML = `<section class="white-panel empty-state">${notice(error.message)}</section>`; }

async function libraryPage() {
  if (!customerUser) { rememberDestination('#library'); location.hash = '#login'; return; }
  setView(`${pageHead('คลังของฉัน', 'ไฟล์ที่ได้รับหลังคำสั่งซื้อสำเร็จ')}<section class="library-shell"><div class="library-intro"><div><span class="home-eyebrow">MY LIBRARY</span><h2>แอสเซ็ตพร้อมดาวน์โหลด</h2><p>ลิงก์ดาวน์โหลดสร้างใหม่เมื่อเปิดหน้านี้ และใช้งานได้ 24 ชั่วโมง</p></div><a class="pill-button outline" href="#history">ประวัติคำสั่งซื้อ →</a></div><div id="library-list" class="library-list"><div class="loading">กำลังโหลดคลัง…</div></div></section>`, 'library');
  const list = document.querySelector('#library-list');
  try {
    const orders = (await sessionOrders()).filter(order => order.status === 'PAID');
    if (!list.isConnected) return;
    const entries = orders.flatMap(order => (order.items || []).map(item => ({ item, order, url: order.downloadUrls?.[item.id] || order.downloadUrl })));
    list.innerHTML = entries.length ? entries.map(({item,order,url}) => `<article class="library-card"><div class="library-cover">${cover(item)}</div><div class="library-info"><span class="product-category">${esc(item.category || '3D Asset')}</span><h3>${esc(item.title)}</h3><p>${esc((item.formats || []).join(' / '))} · ${esc(item.license || '')}</p><small>คำสั่งซื้อ ${esc(order.id)}</small></div><div class="library-actions">${url ? `<a class="pill-button dark" href="${esc(url)}">ดาวน์โหลด ZIP ↓</a>` : `<a class="pill-button outline" href="#order/${esc(order.id)}">ดูคำสั่งซื้อ</a>`}</div></article>`).join('') : '<div class="library-empty"><h3>ยังไม่มีแอสเซ็ตในคลัง</h3><p>สินค้าที่ชำระเงินจำลองสำเร็จจะปรากฏที่นี่</p><a class="pill-button dark" href="#catalog">เลือกดูสินค้า →</a></div>';
  } catch (error) { if (list.isConnected) list.innerHTML = notice(error.message); }
}

