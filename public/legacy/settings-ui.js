import { translations } from './translations-en.js';

const key = 'polyloot-display-preferences-v1';
const defaults = { theme: 'system', language: 'th' };
const english = {
  'หน้าแรก': 'Home', 'สินค้า': 'Products', 'คำสั่งซื้อ': 'Orders', 'คลัง': 'Library',
  'ตะกร้า': 'Cart', 'แคตตาล็อก': 'Catalog', 'ตะกร้าสินค้า': 'Cart',
  'ติดตามคำสั่งซื้อ': 'Track orders', 'บัญชีผู้ใช้': 'Account',
  'เกี่ยวกับร้าน / ช่วยเหลือ': 'Help & contact', 'ศูนย์ช่วยเหลือ': 'Help center',
  'บัญชีของฉัน': 'My account', 'ข้อมูลทั่วไป': 'Personal details',
  'เมนูบัญชี': 'Account menu', 'ประวัติการสั่งซื้อ': 'Order history',
  'เปลี่ยนรหัสผ่าน': 'Change password', 'ออกจากระบบ': 'Sign out',
  'ตั้งค่าบัญชี': 'Settings', 'การแจ้งเตือน': 'Notifications',
  'ตั้งค่า': 'Settings', 'การตั้งค่า': 'Settings', 'ปรับร้านให้เหมาะกับคุณ': 'Make the store yours',
  'ธีมการแสดงผล': 'Appearance', 'ภาษา': 'Language', 'ตามอุปกรณ์': 'Use device setting',
  'สว่าง': 'Light', 'มืด': 'Dark', 'ตั้งค่าทั้งหมด': 'All settings',
  'ติดต่อและช่วยเหลือ': 'Contact and help', 'เปิดเมนูตั้งค่า': 'Open settings menu',
  'ปิดเมนูตั้งค่า': 'Close settings menu',
  'ทางลัด': 'Shortcuts', 'บัญชีและการแจ้งเตือน': 'Account and notifications',
  'คำถามที่พบบ่อยและช่องทางติดต่อ': 'FAQs and contact options',
  'บันทึกข้อมูล': 'Save details', 'ดูคำสั่งซื้อ': 'View orders',
  'เลือกดูสินค้า': 'Browse products', 'ค้นหา': 'Search',
  'เพิ่มลงตะกร้า': 'Add to cart', 'สั่งซื้อชุดนี้': 'Order this pack',
  'ดาวน์โหลดโมเดลตัวอย่างฟรี': 'Download free sample',
  'รายละเอียดสินค้า': 'Product details', 'ข้อมูลก่อนนำไปใช้': 'Before you use it',
  'ติดต่อผู้ดูแลร้าน': 'Contact support', 'ส่งคำร้อง': 'Send request',
  'คำร้องของฉัน': 'My requests', 'กำลังโหลดคำร้อง...': 'Loading requests...',
  'ยังไม่มีคำร้อง': 'No requests yet', 'กำลังตรวจสอบ': 'In progress',
  'ดำเนินการแล้ว': 'Resolved', 'รับเรื่องแล้ว': 'Received',
  'บันทึกการตั้งค่า': 'Save settings', 'ทำเครื่องหมายว่าอ่านทั้งหมด': 'Mark all as read',
  'ตั้งค่าร้าน': 'Store settings', 'คำร้องลูกค้า': 'Support requests',
  'ภาพรวม': 'Overview', 'ภาพรวมร้าน': 'Store overview', 'แอสเซ็ต': 'Assets',
  'ลูกค้า': 'Customers', 'คำร้อง': 'Requests', 'รีเฟรช': 'Refresh',
  'กลับหน้าร้าน': 'Back to store', 'เข้าสู่ระบบ': 'Sign in',
  'บันทึก': 'Save', 'ยกเลิก': 'Cancel', 'รายละเอียด': 'Details'
};
const dictionary = { ...english, ...translations };
const phrases = Object.keys(dictionary).sort((a, b) => b.length - a.length);
const originalText = new WeakMap();
const originalAttributes = new WeakMap();

function translateText(value, language) {
  if (language === 'th' || !/[\u0E00-\u0E7F]/.test(value)) return value;
  const source = value.trim();
  const exact = dictionary[source];
  if (exact) return value.replace(value.trim(), exact);
  const catalog = source.match(/^(.+?)ในชุด (.+?) รวม (\d+) โมเดล \(นับชื่อโมเดลไม่ซ้ำข้ามฟอร์แมต\) รองรับ (.+?) พร้อมภาพตัวอย่างจาก Kenney และลิงก์ตรวจสอบสิทธิ์ CC0 ที่หน้าต้นฉบับ$/);
  if (catalog) return `${dictionary[catalog[1]] || catalog[1]} in ${catalog[2]}. Includes ${catalog[3]} distinct models across formats. Formats: ${catalog[4]}. Kenney previews and a link to verify the CC0 license are provided on the source page.`;
  const counts = source.match(/^(\d+) จาก (\d+) ชุด$/);
  if (counts) return `${counts[1]} of ${counts[2]} packs`;
  const adminCounts = source.match(/^แสดง (\d+) จาก (\d+) ชุด$/);
  if (adminCounts) return `Showing ${adminCounts[1]} of ${adminCounts[2]} packs`;
  const dynamic = [
    [/^ดูรายละเอียด (.+)$/, 'View details for $1'],
    [/^ปกแอสเซ็ต (.+)$/, 'Asset cover: $1'],
    [/^ตัวอย่างโมเดล (.+)$/, 'Model preview: $1'],
    [/^ตัวอย่างชุด (.+) จาก Kenney$/, 'Preview of $1 by Kenney'],
    [/^ภาพรวม (.+)$/, 'Overview of $1'],
    [/^ภาพ (\d+): (.+)$/, 'Image $1: $2'],
    [/^เลือกภาพตัวอย่างสินค้า$/, 'Select product preview'],
    [/^คำสั่งซื้อของ (.+)$/, 'Orders for $1'],
  ];
  for (const [pattern, replacement] of dynamic) if (pattern.test(source)) return value.replace(source, source.replace(pattern, replacement));
  let result = value;
  for (const phrase of phrases) {
    if (phrase.length < 4 && phrase !== 'บาท') continue;
    if (result.includes(phrase)) result = result.replaceAll(phrase, dictionary[phrase]);
  }
  return result;
}

export function getDisplayPreferences() {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    return { theme: ['light', 'dark', 'system'].includes(value.theme) ? value.theme : defaults.theme, language: ['th', 'en'].includes(value.language) ? value.language : defaults.language };
  } catch { return { ...defaults }; }
}
export function saveDisplayPreferences(value) {
  const next = { ...getDisplayPreferences(), ...value };
  try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
  applyDisplayPreferences();
  return next;
}
export function t(th, en) { return getDisplayPreferences().language === 'en' ? (en || dictionary[th] || th) : th; }
export function applyDisplayPreferences() {
  const { theme, language } = getDisplayPreferences();
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.lang = language;
  document.documentElement.dataset.language = language;
  const title = language === 'en' ? 'PolyLoot — 3D Game Assets' : 'PolyLoot — ร้าน 3D Game Assets';
  if (document.title !== title) document.title = title;
}
export function translateCommon(root = document) {
  applyDisplayPreferences();
  const language = getDisplayPreferences().language;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement?.closest('script,style,textarea,option[data-no-translate],.support-message,[contenteditable]')) continue;
    const current = node.textContent;
    let entry = originalText.get(node);
    if (!entry || entry.last !== current) entry = { source: current, last: current };
    const next = translateText(entry.source, language);
    if (next !== current) node.textContent = next;
    originalText.set(node, { source: entry.source, last: next });
  }
  for (const element of root.querySelectorAll?.('[aria-label],[placeholder],[title],[alt]') || []) {
    let records = originalAttributes.get(element);
    if (!records) { records = new Map(); originalAttributes.set(element, records); }
    for (const attr of ['aria-label', 'placeholder', 'title', 'alt']) {
      const current = element.getAttribute(attr);
      if (!current) continue;
      let entry = records.get(attr);
      if (!entry || entry.last !== current) entry = { source: current, last: current };
      const next = translateText(entry.source, language);
      if (next !== current) element.setAttribute(attr, next);
      records.set(attr, { source: entry.source, last: next });
    }
  }
}
let translationQueued = false;
new MutationObserver(() => {
  if (translationQueued) return;
  translationQueued = true;
  queueMicrotask(() => { translationQueued = false; translateCommon(document); });
}).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'placeholder', 'title', 'alt'] });
applyDisplayPreferences();
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
  if (getDisplayPreferences().theme === 'system') applyDisplayPreferences();
});
