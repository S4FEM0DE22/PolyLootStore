import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const out = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, m => m.slice(1)));
const W = 1600, H = 900;

// Signature Theme Colors extracted from User's Canva "Web Design" Prototype
const C = {
  bg: '#FFFFFF',
  lime: '#B8FF57',
  limeLight: '#D9FFA3',
  limeDark: '#99E640',
  white: '#FFFFFF',
  black: '#000000',
  muted: '#555555',
  red: '#FF2D2D',
  line: '#B8FF57',
  blackLine: '#000000',
  cardBg: '#B8FF57'
};

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
let body = '';
const add = s => body += s;

function rect(x, y, w, h, fill = C.white, r = 0, stroke = 'none', sw = 1) {
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`);
}
function circle(cx, cy, r, fill = 'none', stroke = C.lime, sw = 2) {
  add(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`);
}
function line(x1, y1, x2, y2, color = C.line, sw = 1) {
  add(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${sw}"/>`);
}
function txt(x, y, s, size = 22, color = C.black, weight = 400, anchor = 'start') {
  add(`<text x="${x}" y="${y}" fill="${color}" font-family="'Prompt','Kanit','Leelawadee UI',Arial,sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${esc(s)}</text>`);
}



// Read logos as base64 to ensure self-contained SVG:
// 1. polyloot.png (black text) -> for white/light backgrounds
// 2. polyloot-dark.png (white text) -> for black/dark backgrounds
let logoLightBase64 = '';
let logoDarkBase64 = '';
try {
  const lightPath = path.resolve(out, '../../public/assets/brand/polyloot.png');
  if (fs.existsSync(lightPath)) {
    logoLightBase64 = `data:image/png;base64,${fs.readFileSync(lightPath).toString('base64')}`;
  }
  const darkPath = path.resolve(out, '../../public/assets/brand/polyloot-dark.png');
  if (fs.existsSync(darkPath)) {
    logoDarkBase64 = `data:image/png;base64,${fs.readFileSync(darkPath).toString('base64')}`;
  }
} catch {
  logoLightBase64 = '';
  logoDarkBase64 = '';
}

function start() {
  body = '';
  rect(0, 0, W, H, C.bg);
}

function finish(slug) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
  fs.writeFileSync(path.join(out, `${slug}.svg`), svg, 'utf8');
}

// User's Real Prototype Header (Signature Lime Capsule + White Logo Pill + Pill Nav Items)
function customerNav(active = 'หน้าแรก') {
  // Top lime container
  rect(20, 16, 1560, 92, C.lime, 46);

  // Left logo pill capsule (White background -> Black text logo)
  rect(38, 28, 270, 68, C.white, 34);
  if (logoLightBase64) {
    add(`<image href="${logoLightBase64}" x="55" y="36" width="235" height="52" preserveAspectRatio="xMidYMid meet"/>`);
  } else {
    txt(173, 72, 'POLY LOOT', 24, C.black, 800, 'middle');
  }

  // Right nav container pill
  rect(845, 28, 715, 68, C.white, 34, C.lime, 2);
  const items = ['หน้าแรก', 'สินค้า', 'คำสั่งซื้อ', 'คลัง'];
  items.forEach((name, i) => {
    const x = 860 + i * 142;
    const isActive = name === active;
    rect(x, 37, 132, 50, isActive ? C.lime : C.white, 25, isActive ? 'none' : C.lime, isActive ? 0 : 2);
    txt(x + 66, 70, name, 20, C.black, 700, 'middle');
  });

  // User icon
  circle(1495, 62, 22, C.white, C.lime, 2.5);
  circle(1495, 56, 8, C.white, C.lime, 2.5);
  add(`<path d="M 1481 76 A 14 14 0 0 1 1509 76" fill="none" stroke="${C.lime}" stroke-width="2.5"/>`);
}

function adminNav(active = 'ภาพรวม') {
  // Top lime container with admin designation
  rect(20, 16, 1560, 92, C.lime, 46);
  // White logo pill -> Black text logo
  rect(38, 28, 300, 68, C.white, 34);
  if (logoLightBase64) {
    add(`<image href="${logoLightBase64}" x="50" y="36" width="180" height="52" preserveAspectRatio="xMidYMid meet"/>`);
    txt(245, 70, 'ADMIN', 18, C.red, 800);
  } else {
    txt(188, 72, 'POLY LOOT ADMIN', 22, C.black, 800, 'middle');
  }

  rect(620, 28, 940, 68, C.white, 34, C.lime, 2);
  const items = ['ภาพรวม', 'คำสั่งซื้อ', 'สินค้า', 'ลูกค้า', 'ช่วยเหลือ', 'แจ้งเตือน', 'ตั้งค่า'];
  items.forEach((name, i) => {
    const x = 635 + i * 130;
    const isActive = name === active;
    rect(x, 37, 122, 50, isActive ? C.lime : C.white, 25, isActive ? 'none' : C.lime, isActive ? 0 : 2);
    txt(x + 61, 70, name, 18, C.black, 700, 'middle');
  });
}

// -------------------------------------------------------------
// Screen 01 - 09: Matching User's Early Screens
// -------------------------------------------------------------
function page01() {
  start();
  customerNav('หน้าแรก');
  rect(20, 138, 1560, 725, C.lime, 52);
  rect(120, 220, 1360, 320, C.white, 40);
  txt(800, 340, 'POLY LOOT STORE', 58, C.black, 800, 'middle');
  txt(800, 410, 'แหล่งรวม 3D GAME ASSETS สำหรับนักพัฒนาเกม', 26, C.muted, 600, 'middle');
  rect(640, 450, 320, 65, C.lime, 32.5);
  txt(800, 492, 'เลือกดูสินค้าทั้งหมด', 24, C.black, 700, 'middle');
  finish('01-home');
}

function page02() {
  start();
  customerNav('สินค้า');
  rect(20, 138, 1560, 725, C.lime, 52);
  txt(80, 205, 'รายการสินค้าทั้งหมด', 36, C.black, 800);
  for (let i = 0; i < 4; i++) {
    const x = 80 + i * 370;
    rect(x, 240, 340, 420, C.white, 35);
    rect(x + 20, 260, 300, 220, C.limeLight, 25);
    txt(x + 170, 375, '[ 3D Asset ]', 26, C.black, 700, 'middle');
    txt(x + 30, 520, `Pack 0${i + 1} Kit`, 24, C.black, 700);
    txt(x + 30, 555, 'CC0 License • 3D Models', 18, C.muted);
    txt(x + 30, 615, '฿490', 26, C.black, 800);
    rect(x + 170, 575, 140, 55, C.lime, 27.5);
    txt(x + 240, 610, 'ใส่ตะกร้า', 19, C.black, 700, 'middle');
  }
  finish('02-catalog');
}

function page03() {
  start();
  customerNav('คำสั่งซื้อ');
  // Sub-tabs capsule
  rect(20, 138, 1560, 95, C.white, 47.5, C.lime, 2);
  rect(35, 148, 480, 75, C.white, 37.5, C.lime, 2);
  txt(275, 196, 'ตะกร้าสินค้า', 30, C.black, 700, 'middle');
  rect(540, 148, 480, 75, C.lime, 37.5);
  txt(780, 196, 'ติดตามคำสั่งซื้อ', 30, C.black, 700, 'middle');
  rect(1045, 148, 480, 75, C.lime, 37.5);
  txt(1285, 196, 'ประวัติการสั่งซื้อ', 30, C.black, 700, 'middle');

  // Lime content container
  rect(20, 252, 1560, 610, C.lime, 52);
  txt(60, 320, 'รายการการสั่งซื้อทั้งหมด', 32, C.black, 800);

  // Bottom right price and checkout
  rect(920, 765, 410, 85, C.white, 42.5);
  txt(960, 819, 'ราคารวม', 28, C.black, 800);
  txt(1280, 819, '0  บาท', 28, C.black, 800, 'end');
  rect(1345, 765, 215, 85, C.limeLight, 42.5, C.lime, 3);
  txt(1452, 819, 'ชำระเงิน', 28, C.black, 800, 'middle');
  finish('03-cart');
}

function page04() {
  start();
  customerNav('คำสั่งซื้อ');
  txt(800, 185, 'การชำระสินค้า', 48, C.black, 800, 'middle');

  // Lime card
  rect(300, 215, 1000, 570, C.lime, 52);
  txt(350, 275, 'เลือกการชำระสินค้า', 28, C.black, 700);
  rect(350, 295, 170, 56, C.limeLight, 28, C.limeDark, 2);
  txt(435, 332, 'บัตรเครดิต', 22, C.black, 700, 'middle');
  rect(540, 295, 210, 56, C.white, 28);
  txt(645, 332, 'QR PromptPay', 22, C.black, 600, 'middle');

  txt(350, 410, 'ระบุอีเมลสำหรับจัดส่งสินค้า', 26, C.black, 700);
  rect(350, 430, 480, 62, C.white, 31, C.blackLine, 2);

  txt(350, 545, 'OTP ยืนยันอีเมล', 26, C.black, 700);
  rect(350, 565, 220, 62, C.white, 31, C.blackLine, 2);
  rect(590, 565, 200, 62, C.white, 31, C.blackLine, 2);
  txt(690, 604, 'รับรหัสยืนยัน', 20, C.black, 700, 'middle');

  txt(920, 450, 'กรุณายืนยันอีเมลก่อน', 26, C.black, 700);
  txt(920, 490, 'รับ QR PromptPay', 26, C.black, 700);

  // Bottom action buttons
  rect(350, 805, 260, 75, C.white, 37.5, C.lime, 2);
  txt(480, 852, 'ชำระสินค้าในภายหลัง', 22, C.black, 700, 'middle');
  rect(640, 805, 260, 75, C.white, 37.5, C.lime, 2);
  txt(770, 852, 'ยืนยันการชำระ', 22, C.black, 700, 'middle');
  rect(930, 805, 260, 75, C.red, 37.5);
  txt(1060, 852, 'ยกเลิกการชำระ', 24, C.white, 700, 'middle');
  finish('04-checkout');
}

function page05() {
  start();
  customerNav('คำสั่งซื้อ');
  txt(800, 185, 'ชำระสินค้าเสร็จสิ้น', 48, C.black, 800, 'middle');

  rect(300, 215, 1000, 570, C.lime, 52);
  txt(350, 280, 'รายละเอียดสินค้า', 28, C.black, 700);

  txt(350, 375, 'ชำระโดย', 26, C.black, 700);
  rect(460, 335, 200, 60, C.white, 30);
  txt(560, 374, 'QR PromptPay', 22, C.black, 600, 'middle');

  txt(350, 475, 'อีเมลที่รับสินค้า', 26, C.black, 700);
  rect(560, 435, 480, 62, C.white, 31, C.blackLine, 2);
  txt(585, 474, 'example@exam.com', 22, C.black, 500);

  txt(350, 575, 'รหัสสินค้า', 26, C.black, 700);
  rect(500, 535, 480, 62, C.white, 31, C.blackLine, 2);
  txt(740, 574, 'EB-12XXX6', 24, C.black, 700, 'middle');

  // Bottom buttons
  rect(490, 805, 260, 75, C.white, 37.5, C.lime, 2);
  txt(620, 852, 'คำสั่งซื้อ', 24, C.black, 700, 'middle');
  rect(790, 805, 260, 75, C.white, 37.5, C.lime, 2);
  txt(920, 852, 'เสร็จสิ้น', 24, C.black, 700, 'middle');
  finish('05-success');
}

function page06() {
  start();
  customerNav('คำสั่งซื้อ');
  rect(20, 138, 1560, 95, C.white, 47.5, C.lime, 2);
  rect(35, 148, 480, 75, C.lime, 37.5);
  txt(275, 196, 'ตะกร้าสินค้า', 30, C.black, 700, 'middle');
  rect(540, 148, 480, 75, C.white, 37.5, C.lime, 2);
  txt(780, 196, 'ติดตามคำสั่งซื้อ', 30, C.black, 700, 'middle');
  rect(1045, 148, 480, 75, C.lime, 37.5);
  txt(1285, 196, 'ประวัติการสั่งซื้อ', 30, C.black, 700, 'middle');

  rect(20, 252, 1560, 610, C.lime, 52);
  txt(60, 320, 'ติดตามสถานะคำสั่งซื้อ', 32, C.black, 800);
  rect(60, 360, 1440, 120, C.white, 30);
  txt(100, 430, 'หมายเลขคำสั่งซื้อ: #EB-12XXX6', 26, C.black, 700);
  rect(1220, 395, 240, 50, C.lime, 25);
  txt(1340, 428, 'ชำระเงินสำเร็จแล้ว', 20, C.black, 700, 'middle');

  // Timeline pills
  const steps = ['รับคำสั่งซื้อ', 'ชำระเงิน', 'จัดเตรียมไฟล์', 'พร้อมดาวน์โหลด'];
  steps.forEach((s, i) => {
    const x = 120 + i * 350;
    rect(x, 560, 280, 75, C.white, 37.5, C.blackLine, 2);
    circle(x + 45, 597, 20, C.lime, C.blackLine, 2);
    txt(x + 45, 604, String(i + 1), 20, C.black, 800, 'middle');
    txt(x + 160, 605, s, 20, C.black, 700, 'middle');
  });
  finish('06-track');
}

function page07() {
  start();
  customerNav('คำสั่งซื้อ');
  rect(20, 138, 1560, 95, C.white, 47.5, C.lime, 2);
  rect(35, 148, 480, 75, C.lime, 37.5);
  txt(275, 196, 'ตะกร้าสินค้า', 30, C.black, 700, 'middle');
  rect(540, 148, 480, 75, C.lime, 37.5);
  txt(780, 196, 'ติดตามคำสั่งซื้อ', 30, C.black, 700, 'middle');
  rect(1045, 148, 480, 75, C.white, 37.5, C.lime, 2);
  txt(1285, 196, 'ประวัติการสั่งซื้อ', 30, C.black, 700, 'middle');

  rect(20, 252, 1560, 610, C.lime, 52);
  txt(60, 320, 'ประวัติการสั่งซื้อของคุณ', 32, C.black, 800);
  for (let i = 0; i < 3; i++) {
    const y = 350 + i * 115;
    rect(60, y, 1440, 95, C.white, 25);
    txt(100, y + 55, `#EB-1200${i + 1}`, 24, C.black, 700);
    txt(360, y + 55, '24 ก.ย. 2026', 22, C.muted);
    txt(620, y + 55, 'Aurora 3D Character Pack', 22, C.black, 600);
    rect(1080, y + 25, 160, 45, C.lime, 22.5);
    txt(1160, y + 55, 'สำเร็จ', 20, C.black, 700, 'middle');
    rect(1270, y + 22, 200, 50, C.white, 25, C.limeDark, 2);
    txt(1370, y + 55, 'ดูรายละเอียด', 20, C.black, 700, 'middle');
  }
  finish('07-history');
}

function page08() {
  start();
  customerNav('คลัง');
  rect(20, 138, 1560, 725, C.lime, 52);
  txt(60, 205, 'คลังสินค้าของฉัน (My Library)', 36, C.black, 800);
  for (let i = 0; i < 3; i++) {
    const y = 240 + i * 140;
    rect(60, y, 1440, 115, C.white, 30);
    rect(90, y + 20, 100, 75, C.limeLight, 15);
    txt(140, y + 66, '3D', 26, C.black, 800, 'middle');
    txt(220, y + 50, `3D Asset Pack 0${i + 1}`, 26, C.black, 700);
    txt(220, y + 85, 'เวอร์ชัน 2.1 • ไฟล์ .FBX, .OBJ พร้อม Material', 18, C.muted);
    rect(1180, y + 30, 280, 55, C.lime, 27.5);
    txt(1320, y + 66, '⤓ ดาวน์โหลดไฟล์เต็ม (ZIP)', 20, C.black, 700, 'middle');
  }
  finish('08-library');
}

function page09() {
  start();
  customerNav('คลัง');
  txt(800, 185, 'โปรไฟล์ของฉัน', 48, C.black, 800, 'middle');
  rect(300, 215, 1000, 570, C.lime, 52);

  // Avatar pill
  circle(800, 310, 55, C.white, C.blackLine, 2);
  txt(800, 320, 'M', 45, C.black, 800, 'middle');

  txt(420, 420, 'ชื่อผู้ใช้งาน', 24, C.black, 700);
  rect(420, 440, 760, 62, C.white, 31, C.blackLine, 2);
  txt(450, 480, 'Mina Creative Studio', 22, C.black, 600);

  txt(420, 535, 'อีเมลสมาชิก', 24, C.black, 700);
  rect(420, 555, 760, 62, C.white, 31, C.blackLine, 2);
  txt(450, 595, 'mina@example.com', 22, C.black, 600);

  rect(500, 805, 280, 75, C.white, 37.5, C.lime, 2);
  txt(640, 852, 'บันทึกข้อมูล', 24, C.black, 700, 'middle');
  rect(820, 805, 280, 75, C.white, 37.5, C.lime, 2);
  txt(960, 852, 'ตั้งค่าบัญชี', 24, C.black, 700, 'middle');
  finish('09-profile');
}

// -------------------------------------------------------------
// Screen 10 - 25: PROTOTYPE-ALIGNED (Pure Lime Green & Stadium Pills)
// -------------------------------------------------------------

// Page 10: Product Detail
function page10() {
  start();
  customerNav('สินค้า');
  txt(800, 175, 'รายละเอียดสินค้า', 46, C.black, 800, 'middle');

  rect(80, 205, 1440, 580, C.lime, 52);

  // Left column: 3D Preview area
  rect(120, 235, 680, 360, C.white, 35);
  rect(150, 260, 620, 220, C.limeLight, 25);
  txt(460, 375, '[ พื้นที่แสดงโมเดล 3D ]', 32, C.black, 800, 'middle');
  txt(460, 415, 'หมุนดูมุมมอง 360° จำลอง', 20, C.muted, 600, 'middle');

  // Thumbnails
  const thumbs = ['มุมหน้า', 'มุมข้าง', 'Wireframe', 'ชิ้นส่วนโมเดล'];
  thumbs.forEach((t, i) => {
    const x = 120 + i * 175;
    rect(x, 615, 155, 65, C.white, 22, C.blackLine, 1.5);
    txt(x + 77, 655, t, 17, C.black, 700, 'middle');
  });

  // Right column: Product specs & Actions
  rect(830, 235, 650, 515, C.white, 35);
  rect(860, 265, 180, 45, C.lime, 22.5);
  txt(950, 295, '3D Characters', 20, C.black, 700, 'middle');
  rect(1055, 265, 140, 45, C.limeLight, 22.5, C.lime, 2);
  txt(1125, 295, 'สิทธิ์ CC0', 18, C.black, 700, 'middle');

  txt(860, 360, 'Aurora Character Kit', 34, C.black, 800);
  txt(860, 400, 'ชุดโมเดล 3D สไตล์บล็อกกี้ สำหรับเกมอินดี้', 20, C.muted, 600);
  txt(860, 465, '฿490', 44, C.black, 800);

  // Specs pill box
  rect(860, 495, 590, 115, C.limeLight, 20);
  txt(885, 535, '• รูปแบบไฟล์: .FBX, .OBJ, .GLTF พร้อม Material', 18, C.black, 600);
  txt(885, 570, '• จำนวนชิ้นงาน: 68 ไฟล์โมเดล 3D แบบครบชุด', 18, C.black, 600);
  txt(885, 600, '• เวอร์ชัน 2.1 (ดาวน์โหลดได้ทันทีหลังชำระเงิน)', 16, C.muted, 600);

  rect(860, 630, 590, 65, C.lime, 32.5);
  txt(1155, 672, '⤓ ดาวน์โหลดตัวอย่างฟรี (Sample ZIP)', 22, C.black, 800, 'middle');

  // Bottom action buttons
  rect(460, 805, 310, 75, C.white, 37.5, C.lime, 2);
  txt(615, 852, '+ เพิ่มลงตะกร้าสินค้า', 22, C.black, 700, 'middle');
  rect(800, 805, 340, 75, C.lime, 37.5, C.blackLine, 2);
  txt(970, 852, 'ชำระเงินทันที (Checkout)', 22, C.black, 800, 'middle');
  finish('10-product-detail');
}

// Page 11: Order Detail
function page11() {
  start();
  customerNav('คำสั่งซื้อ');
  txt(800, 175, 'รายละเอียดคำสั่งซื้อ #NV-2409-1088', 46, C.black, 800, 'middle');

  rect(80, 205, 1440, 580, C.lime, 52);

  // Left items
  rect(120, 235, 860, 515, C.white, 35);
  txt(150, 280, 'รายการสินค้าในคำสั่งซื้อ (2 รายการ)', 26, C.black, 800);

  // Item 1
  rect(150, 310, 800, 95, C.limeLight, 25);
  txt(180, 355, 'Aurora Character Kit (68 ไฟล์)', 22, C.black, 700);
  txt(180, 385, '3D Model Pack • v2.1', 17, C.muted);
  txt(630, 365, '฿490', 24, C.black, 800);
  rect(720, 335, 200, 48, C.lime, 24);
  txt(820, 366, '⤓ ดาวน์โหลด', 18, C.black, 700, 'middle');

  // Item 2
  rect(150, 425, 800, 95, C.limeLight, 25);
  txt(180, 470, 'Paperplane Icons 3D (120 ไฟล์)', 22, C.black, 700);
  txt(180, 500, '3D Props Pack • v1.4', 17, C.muted);
  txt(630, 480, '฿290', 24, C.black, 800);
  rect(720, 450, 200, 48, C.lime, 24);
  txt(820, 481, '⤓ ดาวน์โหลด', 18, C.black, 700, 'middle');

  rect(150, 550, 800, 120, C.white, 20, C.lime, 2);
  txt(180, 595, 'ชำระโดย: บัตรเครดิต (Simulated Checkout)', 20, C.black, 600);
  txt(180, 635, 'วันที่ทำรายการ: 24 กันยายน 2026 เวลา 14:20 น.', 18, C.muted);

  // Right summary
  rect(1010, 235, 470, 515, C.white, 35);
  rect(1040, 265, 220, 45, C.lime, 22.5);
  txt(1150, 295, '● ชำระเงินสำเร็จ', 20, C.black, 700, 'middle');

  txt(1040, 360, 'สรุปยอดคำสั่งซื้อ', 28, C.black, 800);
  txt(1040, 415, 'ราคารวมสินค้า', 20, C.muted);
  txt(1440, 415, '฿780', 22, C.black, 700, 'end');
  txt(1040, 460, 'ส่วนลด', 20, C.muted);
  txt(1440, 460, '-฿0', 22, C.black, 700, 'end');
  txt(1040, 520, 'ยอดชำระสุทธิ', 24, C.black, 800);
  txt(1440, 520, '฿780', 32, C.black, 800, 'end');

  rect(1040, 560, 410, 80, C.limeLight, 20);
  txt(1060, 595, 'อีเมลที่ได้รับไฟล์:', 16, C.muted);
  txt(1060, 625, 'example@exam.com', 20, C.black, 700);

  // Bottom buttons
  rect(460, 805, 300, 75, C.white, 37.5, C.lime, 2);
  txt(610, 852, '📄 พิมพ์ใบเสร็จ (PDF)', 22, C.black, 700, 'middle');
  rect(790, 805, 350, 75, C.lime, 37.5, C.blackLine, 2);
  txt(965, 852, 'ไปที่คลังสินค้า (My Library)', 22, C.black, 800, 'middle');
  finish('11-order-detail');
}

// Page 12: Help & Support
function page12() {
  start();
  customerNav('คลัง');
  txt(800, 175, 'ศูนย์ช่วยเหลือ & แจ้งปัญหา', 46, C.black, 800, 'middle');

  rect(80, 205, 1440, 580, C.lime, 52);

  // Left FAQ
  rect(120, 235, 670, 515, C.white, 35);
  txt(160, 285, 'คำถามที่พบบ่อย (FAQ)', 28, C.black, 800);
  const faqs = [
    'วิธีดาวน์โหลดโมเดล 3D หลังชำระเงิน',
    'การนำไฟล์ไปใช้ในเชิงพาณิชย์ (CC0 License)',
    'ลิงก์ดาวน์โหลดหมดอายุ หรือเปลี่ยนอีเมลรับไฟล์',
    'การขอใบเสร็จและหลักฐานการสั่งซื้อ'
  ];
  faqs.forEach((q, i) => {
    const y = 315 + i * 95;
    rect(150, y, 610, 75, C.limeLight, 25);
    txt(175, y + 46, q, 19, C.black, 700);
  });

  // Right Ticket Form
  rect(820, 235, 660, 515, C.white, 35);
  txt(860, 285, 'ส่งคำขอความช่วยเหลือ (Support Ticket)', 26, C.black, 800);

  txt(860, 335, 'หมายเลขคำสั่งซื้อ (ถ้ามี)', 20, C.black, 700);
  rect(860, 350, 580, 55, C.white, 27.5, C.blackLine, 2);
  txt(880, 385, '#NV-2409-1088', 19, C.muted);

  txt(860, 435, 'หัวข้อปัญหา', 20, C.black, 700);
  rect(860, 450, 580, 55, C.white, 27.5, C.blackLine, 2);
  txt(880, 485, 'ดาวน์โหลดไฟล์ไม่ได้', 19, C.black);

  txt(860, 535, 'รายละเอียดปัญหาที่พบ', 20, C.black, 700);
  rect(860, 550, 580, 110, C.white, 25, C.blackLine, 2);
  txt(880, 585, 'พิมพ์อธิบายปัญหาที่ต้องการให้ทีมงานช่วยเหลือ...', 18, C.muted);

  // Bottom buttons
  rect(500, 805, 300, 75, C.lime, 37.5, C.blackLine, 2);
  txt(650, 852, 'ส่งคำขอช่วยเหลือ', 24, C.black, 800, 'middle');
  rect(830, 805, 270, 75, C.white, 37.5, C.lime, 2);
  txt(965, 852, 'กลับหน้าแรก', 22, C.black, 700, 'middle');
  finish('12-help');
}

// Page 13: Settings
function page13() {
  start();
  customerNav('คลัง');
  txt(800, 175, 'ตั้งค่าบัญชี & การแสดงผล', 46, C.black, 800, 'middle');

  rect(250, 205, 1100, 580, C.lime, 52);
  rect(290, 235, 1020, 515, C.white, 35);

  // Setting rows
  const settings = [
    ['ภาษาของระบบ (Language)', 'ภาษาไทย (TH)', 'English (EN)'],
    ['ธีมหน้าจอ (Display Theme)', 'สว่าง (Light)', 'มืด (Dark)'],
    ['แจ้งเตือนคำสั่งซื้อทางอีเมล', 'เปิดใช้งาน', 'ปิด'],
    ['แจ้งเตือนอัปเดตไฟล์ในคลัง', 'เปิดใช้งาน', 'ปิด']
  ];
  settings.forEach((s, i) => {
    const y = 265 + i * 110;
    txt(330, y + 40, s[0], 24, C.black, 700);
    rect(820, y + 10, 220, 55, C.lime, 27.5, C.blackLine, 2);
    txt(930, y + 46, s[1], 20, C.black, 700, 'middle');
    rect(1060, y + 10, 200, 55, C.white, 27.5, C.lime, 2);
    txt(1160, y + 46, s[2], 20, C.black, 600, 'middle');
  });

  // Bottom buttons
  rect(500, 805, 300, 75, C.lime, 37.5, C.blackLine, 2);
  txt(650, 852, 'บันทึกการตั้งค่า', 24, C.black, 800, 'middle');
  rect(830, 805, 270, 75, C.red, 37.5);
  txt(965, 852, 'ออกจากระบบ', 24, C.white, 800, 'middle');
  finish('13-settings');
}

// Page 14: Notifications
function page14() {
  start();
  customerNav('คลัง');
  txt(800, 175, 'ศูนย์การแจ้งเตือน', 46, C.black, 800, 'middle');

  rect(120, 205, 1360, 580, C.lime, 52);
  rect(160, 235, 1280, 515, C.white, 35);

  const notifs = [
    ['คำสั่งซื้อสำเร็จ', 'คำสั่งซื้อ #NV-2409-1088 ของคุณได้รับการยืนยันแล้ว สามารถดาวน์โหลดไฟล์ได้ทันที', '5 นาทีที่แล้ว', C.lime],
    ['สินค้ามีอัปเดตใหม่', 'Aurora Character Kit อัปเดตแพ็กเกจเป็น v2.1 แล้ว ดาวน์โหลดฟรีได้จากคลัง', 'เมื่อวานนี้', C.limeLight],
    ['ฝ่ายบริการลูกค้า', 'เจ้าหน้าที่ตอบกลับคำขอความช่วยเหลือ #SP-184 เรียบร้อยแล้ว', '2 วันที่แล้ว', C.limeLight]
  ];
  notifs.forEach((n, i) => {
    const y = 265 + i * 140;
    rect(190, y, 1220, 115, n[3], 25, C.blackLine, 1.5);
    txt(220, y + 48, n[0], 24, C.black, 800);
    txt(220, y + 84, n[1], 19, C.black, 600);
    txt(1370, y + 66, n[2], 17, C.muted, 600, 'end');
  });

  rect(580, 805, 440, 75, C.white, 37.5, C.lime, 2);
  txt(800, 852, 'ทำเครื่องหมายว่าอ่านแล้วทั้งหมด', 22, C.black, 700, 'middle');
  finish('14-notifications');
}

// Page 15 - 18: Auth pages matching image 3 layout
function authTemplate(slug, title, fields, cta, alt) {
  start();
  customerNav('หน้าแรก');
  txt(800, 175, title, 48, C.black, 800, 'middle');

  rect(350, 205, 900, 580, C.lime, 52);
  rect(390, 235, 820, 515, C.white, 35);

  let y = 265;
  fields.forEach(f => {
    txt(430, y + 25, f[0], 24, C.black, 700);
    rect(430, y + 40, 740, 60, C.white, 30, C.blackLine, 2);
    txt(455, y + 78, f[1], 20, C.muted);
    y += 115;
  });

  txt(800, y + 35, alt, 20, C.black, 700, 'middle');

  rect(600, 805, 400, 75, C.lime, 37.5, C.blackLine, 2);
  txt(800, 852, cta, 26, C.black, 800, 'middle');
  finish(slug);
}

function page15() {
  authTemplate('15-register', 'สมัครสมาชิกใหม่', [
    ['ชื่อที่แสดง / Studio Name', 'เช่น Mina Creative หรือ Indie Studio'],
    ['อีเมลสำหรับรับไฟล์', 'name@example.com'],
    ['รหัสผ่าน', 'กำหนดรหัสผ่านอย่างน้อย 8 ตัวอักษร']
  ], 'ยืนยันการสมัครสมาชิก', 'มีบัญชีอยู่แล้ว? เข้าสู่ระบบ');
}

function page16() {
  authTemplate('16-login', 'เข้าสู่ระบบ', [
    ['อีเมลผู้ใช้งาน', 'name@example.com'],
    ['รหัสผ่าน', 'กรอกรหัสผ่านของคุณ']
  ], 'เข้าสู่ระบบ', 'ลืมรหัสผ่าน?  •  สมัครสมาชิกใหม่');
}

function page17() {
  authTemplate('17-forgot', 'ลืมรหัสผ่าน?', [
    ['อีเมลที่ใช้สมัครสมาชิก', 'name@example.com']
  ], 'ส่งลิงก์รีเซ็ตรหัสผ่านทางอีเมล', 'กลับไปหน้าเข้าสู่ระบบ');
}

function page18() {
  authTemplate('18-reset', 'ตั้งรหัสผ่านใหม่', [
    ['รหัสผ่านใหม่', 'อย่างน้อย 8 ตัวอักษร'],
    ['ยืนยันรหัสผ่านใหม่อีกครั้ง', 'พิมพ์รหัสผ่านใหม่อีกครั้ง']
  ], 'บันทึกรหัสผ่านใหม่', 'ลิงก์นี้ใช้งานได้ครั้งเดียวเพื่อความปลอดภัย');
}

// -------------------------------------------------------------
// Screen 19 - 25: Admin Pages matching current website layout
// (Dark Sidebar on left + Light main canvas + Metric cards & Real Data Panels)
// -------------------------------------------------------------
function adminShell(slug, active, title, draw) {
  start();
  // Main background matching .admin-main (#F8F9FC)
  rect(0, 0, W, H, '#F8F9FC');

  // Sidebar matching .admin-sidebar (#050505)
  rect(0, 0, 260, H, '#050505');

  // Brand box (Dark background #141414 on #050505 -> White text logo)
  rect(25, 24, 210, 56, '#141414', 28);
  if (logoDarkBase64) {
    add(`<image href="${logoDarkBase64}" x="38" y="32" width="184" height="40" preserveAspectRatio="xMidYMid meet"/>`);
  } else {
    txt(130, 60, 'PolyLoot', 22, C.white, 800, 'middle');
  }
  txt(35, 110, 'ADMIN PANEL', 12, '#888888', 800);

  // Navigation items matching .admin-nav
  const menuItems = [
    ['overview', 'ภาพรวม'],
    ['orders', 'คำสั่งซื้อ'],
    ['assets', 'แอสเซ็ต'],
    ['customers', 'ลูกค้า'],
    ['support', 'คำร้องลูกค้า'],
    ['alerts', 'การแจ้งเตือน'],
    ['settings', 'ตั้งค่าร้าน']
  ];

  menuItems.forEach((item, i) => {
    const y = 135 + i * 56;
    const isActive = item[1] === active || item[0] === active;
    if (isActive) {
      rect(18, y, 224, 46, C.white, 12);
      txt(40, y + 30, item[1], 18, C.black, 700);
    } else {
      txt(40, y + 30, item[1], 18, '#999999', 500);
    }
  });

  // Sidebar bottom matching .nav-bottom
  line(20, 770, 240, 770, '#222222', 1);
  txt(38, 810, 'กลับหน้าร้าน', 18, '#999999', 500);
  txt(38, 855, 'ออกจากระบบ', 18, '#FF3838', 600);

  // Main Topbar matching .admin-topbar
  txt(305, 68, title, 34, '#111111', 800);
  rect(1360, 40, 110, 36, '#111111', 18);
  txt(1415, 63, 'DEMO ONLY', 12, C.white, 700, 'middle');
  rect(1485, 40, 85, 36, C.white, 18, '#D0D5DD', 1);
  txt(1527, 63, 'รีเฟรช', 14, '#111111', 600, 'middle');

  // Draw Page Content
  draw();

  finish(slug);
}

// Page 19: Overview / Dashboard
function page19() {
  adminShell('19-dashboard', 'ภาพรวม', 'ภาพรวมร้าน', () => {
    // 4 Metrics cards matching .metric
    const kpis = [
      ['คำสั่งซื้อทั้งหมด', '18', 'รายการล่าสุดสูงสุด 100 รายการ', false],
      ['รอชำระ', '2', 'ระบบชำระเงินจำลอง', true],
      ['ชำระแล้ว', '16', '3D Asset พร้อมใช้งาน', false],
      ['แอสเซ็ตที่เปิดขาย', '34', 'จากทั้งหมด 34 ชุด', false]
    ];
    kpis.forEach((k, i) => {
      const x = 305 + i * 315;
      rect(x, 115, 300, 145, C.white, 24, k[3] ? '#FF3838' : '#E8ECF2', k[3] ? 2 : 1);
      txt(x + 24, 150, k[0], 16, k[3] ? '#FF3838' : '#777777', 600);
      txt(x + 24, 205, k[1], 36, '#111111', 800);
      txt(x + 24, 235, k[2], 14, '#999999');
    });

    // Left section: Report Panel
    rect(305, 285, 615, 570, C.white, 24, '#E8ECF2', 1);
    txt(335, 330, 'รายงานร้านค้า', 24, '#111111', 800);
    txt(335, 360, 'คำนวณจากคำสั่งซื้อล่าสุดสูงสุด 100 รายการ', 15, '#777777');
    rect(800, 310, 100, 36, C.white, 18, '#D0D5DD', 1);
    txt(850, 333, 'Export CSV', 13, '#111111', 600, 'middle');

    // Mini revenue highlight
    rect(335, 390, 555, 95, '#F8F9FC', 16);
    txt(360, 425, 'ยอดขายจำลองรวม', 16, '#777777');
    txt(360, 462, '฿78,400 บาท', 28, '#111111', 800);
    rect(720, 415, 145, 45, C.limeLight, 22.5);
    txt(792, 444, 'สำเร็จ 16 ออเดอร์', 15, '#111111', 700, 'middle');

    txt(335, 525, 'สินค้ายอดนิยม', 20, '#111111', 800);
    const popular = [
      ['1. Blocky Characters Kit', '8 ครั้ง'],
      ['2. Modular Dungeon Kit', '5 ครั้ง'],
      ['3. Blaster Kit', '4 ครั้ง'],
      ['4. Furniture Kit 3D', '3 ครั้ง']
    ];
    popular.forEach((p, i) => {
      const y = 555 + i * 65;
      rect(335, y, 555, 52, '#F8F9FC', 12);
      txt(355, y + 33, p[0], 17, '#111111', 600);
      txt(865, y + 33, p[1], 16, '#111111', 800, 'end');
    });

    // Right section: Recent Orders Panel
    rect(940, 285, 615, 570, C.white, 24, '#E8ECF2', 1);
    txt(970, 330, 'คำสั่งซื้อล่าสุด', 24, '#111111', 800);
    txt(970, 360, '5 รายการล่าสุดในระบบ', 15, '#777777');
    rect(1440, 310, 95, 36, C.white, 18, '#D0D5DD', 1);
    txt(1487, 333, 'ดูทั้งหมด →', 13, '#111111', 600, 'middle');

    const recentOrders = [
      ['Blocky Characters Kit + 1', 'Mina Creative', '฿780', 'ชำระแล้ว', C.lime],
      ['Modular Dungeon Kit', 'Nawin Dev', '฿590', 'รอชำระ', '#FFF4D2'],
      ['Blaster Kit', 'Kira Game Studio', '฿490', 'ชำระแล้ว', C.lime],
      ['Furniture Kit 3D', 'Bam Artist', '฿390', 'ชำระแล้ว', C.lime]
    ];
    recentOrders.forEach((o, i) => {
      const y = 390 + i * 110;
      rect(970, y, 555, 95, '#F8F9FC', 16);
      rect(990, y + 15, 65, 65, C.limeLight, 12);
      txt(1022, y + 55, '3D', 20, '#111111', 800, 'middle');
      txt(1075, y + 42, o[0], 18, '#111111', 700);
      txt(1075, y + 70, o[1], 15, '#777777');
      txt(1380, y + 56, o[2], 18, '#111111', 800);
      rect(1420, y + 34, 85, 34, o[4], 17);
      txt(1462, y + 56, o[3], 13, '#111111', 700, 'middle');
    });
  });
}

// Page 20: Orders
function page20() {
  adminShell('20-orders', 'คำสั่งซื้อ', 'คำสั่งซื้อ', () => {
    rect(305, 115, 1250, 740, C.white, 24, '#E8ECF2', 1);

    // Panel head & Filters
    txt(340, 160, 'ติดตามคำสั่งซื้อ', 24, '#111111', 800);
    txt(340, 190, 'แสดงสูงสุด 100 รายการล่าสุด · ระบบชำระเงินจำลอง', 15, '#777777');

    rect(1060, 145, 170, 46, C.white, 12, '#D0D5DD', 1);
    txt(1085, 174, 'สถานะ: ทุกสถานะ ▾', 15, '#111111', 600);
    rect(1245, 145, 270, 46, C.white, 12, '#D0D5DD', 1);
    txt(1270, 174, '🔍 ค้นหาคำสั่งซื้อ...', 15, '#999999');

    // Order Rows matching .admin-order-row
    const orderRows = [
      ['Blocky Characters Kit และอีก 1 ชุด', 'Mina Creative · mina@example.com', '#NV-2409-1088 · 24 ก.ย. 2026, 14:20', '780 บาท', 'ชำระแล้ว', C.lime, 'ส่งอีเมลแล้ว'],
      ['Modular Dungeon Kit', 'Nawin Dev · nawin@example.com', '#NV-2409-1087 · 24 ก.ย. 2026, 11:05', '590 บาท', 'รอชำระ', '#FFF4D2', 'ยังไม่ส่ง'],
      ['Blaster Kit 3D Assets', 'Kira Game Studio · kira@example.com', '#NV-2409-1086 · 23 ก.ย. 2026, 16:40', '490 บาท', 'ชำระแล้ว', C.lime, 'ส่งอีเมลแล้ว'],
      ['Car Kit 3D Model Pack', 'Pim Pixel · pim@example.com', '#NV-2409-1085 · 23 ก.ย. 2026, 09:15', '290 บาท', 'ยกเลิกแล้ว', '#FFE9DC', 'ไม่ส่ง'],
      ['Furniture Kit Interior', 'Bam Artist · bam@example.com', '#NV-2409-1084 · 22 ก.ย. 2026, 18:30', '390 บาท', 'ชำระแล้ว', C.lime, 'ส่งอีเมลแล้ว']
    ];

    orderRows.forEach((r, i) => {
      const y = 220 + i * 115;
      rect(340, y, 1180, 98, '#F8F9FC', 16);
      rect(360, y + 16, 68, 66, C.white, 12, '#E8ECF2', 1);
      txt(394, y + 55, '3D', 22, C.black, 800, 'middle');

      txt(445, y + 40, r[0], 18, '#111111', 700);
      txt(445, y + 66, r[1], 14, '#666666');
      txt(445, y + 86, r[2], 13, '#999999');

      txt(950, y + 55, r[3], 20, '#111111', 800);
      rect(1060, y + 36, 100, 36, r[5], 18);
      txt(1110, y + 59, r[4], 14, '#111111', 700, 'middle');
      txt(1185, y + 59, r[6], 14, '#777777');

      rect(1320, y + 34, 90, 38, C.white, 19, '#D0D5DD', 1);
      txt(1365, y + 58, 'รายละเอียด', 13, '#111111', 600, 'middle');
      if (r[4] === 'รอชำระ') {
        rect(1420, y + 34, 85, 38, C.lime, 19);
        txt(1462, y + 58, 'จำลองชำระ', 13, '#111111', 700, 'middle');
      }
    });
  });
}

// Page 21: Assets
function page21() {
  adminShell('21-products', 'แอสเซ็ต', 'แอสเซ็ต', () => {
    rect(305, 115, 1250, 740, C.white, 24, '#E8ECF2', 1);

    // Toolbar matching .asset-toolbar
    txt(340, 160, 'จัดการแอสเซ็ต', 24, '#111111', 800);
    txt(340, 190, 'เพิ่ม แก้ไขราคา ซ่อน และลบสินค้า 3D', 15, '#777777');

    rect(1120, 145, 130, 46, '#111111', 23);
    txt(1185, 174, '+ เพิ่มแอสเซ็ต', 14, C.white, 700, 'middle');
    rect(1265, 145, 115, 46, C.white, 23, '#D0D5DD', 1);
    txt(1322, 174, 'Export JSON', 13, '#111111', 600, 'middle');
    rect(1395, 145, 120, 46, C.white, 23, '#D0D5DD', 1);
    txt(1455, 174, 'Import JSON', 13, '#111111', 600, 'middle');

    // Filter row
    rect(340, 215, 340, 44, C.white, 12, '#D0D5DD', 1);
    txt(360, 243, '🔍 ค้นหาชื่อหรือผู้จัดทำ...', 14, '#999999');
    rect(700, 215, 180, 44, C.white, 12, '#D0D5DD', 1);
    txt(720, 243, 'หมวด: ทั้งหมด ▾', 14, '#111111');
    rect(900, 215, 160, 44, C.white, 12, '#D0D5DD', 1);
    txt(920, 243, 'สถานะ: ทั้งหมด ▾', 14, '#111111');
    txt(1440, 243, 'แสดง 6 จาก 34 ชุด', 14, '#777777', 500, 'end');

    // 6 Asset Cards in 3x2 grid matching .catalog-grid
    const assets = [
      ['Blocky Characters Kit', 'Characters • 68 ไฟล์', '490 บาท', 'เปิดขาย', C.lime],
      ['Modular Dungeon Kit', 'Environments • 45 ไฟล์', '590 บาท', 'เปิดขาย', C.lime],
      ['Blaster Kit 3D', 'Weapons • 32 ไฟล์', '390 บาท', 'เปิดขาย', C.lime],
      ['Car Kit Pack', 'Vehicles • 24 ไฟล์', '290 บาท', 'ซ่อน', '#FFE9DC'],
      ['Furniture Kit 3D', 'Props • 50 ไฟล์', '390 บาท', 'เปิดขาย', C.lime],
      ['Pirate Kit Assets', 'Characters • 30 ไฟล์', '490 บาท', 'เปิดขาย', C.lime]
    ];

    assets.forEach((a, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 340 + col * 400;
      const y = 280 + row * 265;

      rect(x, y, 380, 245, '#F8F9FC', 16, '#E8ECF2', 1);
      rect(x + 16, y + 16, 348, 110, C.white, 12, '#E8ECF2', 1);
      txt(x + 190, y + 75, '[ 3D Asset Preview ]', 18, C.black, 700, 'middle');

      txt(x + 18, y + 152, a[0], 17, '#111111', 700);
      txt(x + 18, y + 175, a[1], 13, '#777777');
      txt(x + 18, y + 205, a[2], 18, '#111111', 800);

      rect(x + 280, y + 140, 85, 28, a[4], 14);
      txt(x + 322, y + 159, a[3], 12, '#111111', 700, 'middle');

      rect(x + 160, y + 192, 60, 32, C.white, 16, '#D0D5DD', 1);
      txt(x + 190, y + 213, 'แก้ไข', 12, '#111111', 600, 'middle');
      rect(x + 230, y + 192, 65, 32, C.white, 16, '#D0D5DD', 1);
      txt(x + 262, y + 213, a[3] === 'เปิดขาย' ? 'ซ่อน' : 'เปิด', 12, '#111111', 600, 'middle');
      rect(x + 305, y + 192, 55, 32, '#FFE9DC', 16);
      txt(x + 332, y + 213, 'ลบ', 12, '#FF3838', 700, 'middle');
    });
  });
}

// Page 22: Customers
function page22() {
  adminShell('22-customers', 'ลูกค้า', 'ลูกค้า', () => {
    rect(305, 115, 1250, 740, C.white, 24, '#E8ECF2', 1);

    txt(340, 160, 'บัญชีลูกค้า', 24, '#111111', 800);
    txt(340, 190, 'ข้อมูลนี้แสดงเฉพาะผู้ดูแลร้าน · จัดเก็บข้อมูลบัญชีและประวัติการสั่งซื้อ', 15, '#777777');

    const customers = [
      ['M', 'Mina Creative', 'ชื่อ-นามสกุล: Mina Creative Studio', 'mina@example.com', 'สมัครเมื่อ 10 ส.ค. 2026 · 4 คำสั่งซื้อ'],
      ['N', 'Nawin Dev', 'ชื่อ-นามสกุล: Nawin P. (Game Dev)', 'nawin@example.com', 'สมัครเมื่อ 13 ส.ค. 2026 · 2 คำสั่งซื้อ'],
      ['K', 'Kira Game Studio', 'ชื่อ-นามสกุล: Kira S.', 'kira@example.com', 'สมัครเมื่อ 1 ก.ย. 2026 · 3 คำสั่งซื้อ'],
      ['P', 'Pim Pixel', 'ชื่อ-นามสกุล: Pim T.', 'pim@example.com', 'สมัครเมื่อ 9 ก.ย. 2026 · 1 คำสั่งซื้อ'],
      ['B', 'Bam Artist', 'ชื่อ-นามสกุล: Bam A.', 'bam@example.com', 'สมัครเมื่อ 17 ก.ย. 2026 · 1 คำสั่งซื้อ']
    ];

    customers.forEach((c, i) => {
      const y = 220 + i * 115;
      rect(340, y, 1180, 98, '#F8F9FC', 16);

      circle(385, y + 49, 28, C.white, '#111111', 2);
      txt(385, y + 58, c[0], 24, '#111111', 800, 'middle');

      txt(435, y + 38, c[1], 18, '#111111', 700);
      txt(435, y + 62, c[2], 14, '#555555');
      txt(435, y + 84, c[3], 14, '#777777');

      txt(1140, y + 54, c[4], 14, '#999999', 500, 'end');
      rect(1160, y + 32, 120, 38, C.white, 19, '#D0D5DD', 1);
      txt(1220, y + 56, 'ดูประวัติออเดอร์', 13, '#111111', 600, 'middle');
    });
  });
}

// Page 23: Support
function page23() {
  adminShell('23-support', 'คำร้องลูกค้า', 'คำร้องลูกค้า', () => {
    rect(305, 115, 1250, 740, C.white, 24, '#E8ECF2', 1);

    txt(340, 160, 'คำร้องขอความช่วยเหลือ', 24, '#111111', 800);
    txt(340, 190, 'ลูกค้าส่งจากหน้าช่วยเหลือ · แสดงล่าสุดสูงสุด 100 รายการ', 15, '#777777');

    const tickets = [
      ['#SP-184 · ดาวน์โหลด', 'mina@example.com · 24 ก.ย. 2026, 14:35', 'คำสั่งซื้อ #NV-2409-1088', 'ชำระเงินเรียบร้อยแล้วแต่ในหน้ารายการไม่มีปุ่มให้กดดาวน์โหลดค่ะ รบกวนตรวจสอบลิงก์ให้ด้วยนะคะ', 'รับเรื่องแล้ว', '#FFF4D2'],
      ['#SP-183 · คำสั่งซื้อ', 'nawin@example.com · 23 ก.ย. 2026, 12:10', 'คำสั่งซื้อ #NV-2409-1087', 'ขอสอบถามช่องทางการชำระเงินผ่าน QR PromptPay จำลองค่ะ ขึ้นว่ารอชำระเงิน', 'กำลังตรวจสอบ', '#DBECFF'],
      ['#SP-182 · สินค้า', 'kira@example.com · 22 ก.ย. 2026, 17:00', '', 'สอบถามสิทธิ์การนำโมเดล 3D ไปใช้ในเชิงพาณิชย์สำหรับเกมบน Steam ค่ะ (CC0 License)', 'ดำเนินการแล้ว', C.lime]
    ];

    tickets.forEach((t, i) => {
      const y = 220 + i * 155;
      rect(340, y, 1180, 138, '#F8F9FC', 16);

      txt(365, y + 36, t[0], 18, '#111111', 800);
      txt(365, y + 62, t[1], 14, '#666666');
      if (t[2]) txt(365, y + 84, t[2], 13, '#999999');

      rect(365, y + 95, 780, 32, C.white, 8);
      txt(375, y + 116, t[3], 14, '#444444');

      txt(1190, y + 50, 'สถานะคำร้อง:', 14, '#777777', 600);
      rect(1190, y + 65, 170, 44, t[5], 22);
      txt(1275, y + 92, t[4], 15, '#111111', 700, 'middle');
    });
  });
}

// Page 24: Alerts
function page24() {
  adminShell('24-alerts', 'การแจ้งเตือน', 'การแจ้งเตือน', () => {
    rect(305, 115, 1250, 740, C.white, 24, '#E8ECF2', 1);

    txt(340, 160, 'การแจ้งเตือนร้านค้า', 24, '#111111', 800);
    txt(340, 190, 'สรุปงาน คำสั่งซื้อค้างชำระ และคำร้องที่ต้องดำเนินการเร่งด่วน', 15, '#777777');

    const alerts = [
      ['คำสั่งซื้อรอชำระ', 'มี 2 คำสั่งซื้อในระบบที่ยังไม่ได้ชำระเงิน (#NV-2409-1087, #NV-2409-1082)', 'ตรวจสอบออเดอร์', '#FF3838', '#FFF0F0'],
      ['คำร้องลูกค้าใหม่', 'มีคำร้องขอความช่วยเหลือที่ยังไม่ได้รับเรื่อง 2 รายการ (#SP-184, #SP-183)', 'ดูคำร้องช่วยเหลือ', '#E67E22', '#FFF8F0'],
      ['ระบบอีเมล', 'การตั้งค่าอีเมลจัดส่งไฟล์: โหมดสาธิต (Demo Mode) ลิงก์ดาวน์โหลดใช้งานได้ตามปกติ', 'ตั้งค่าระบบ', '#3498DB', '#F0F8FF'],
      ['คลังแอสเซ็ต', 'แอสเซ็ตทั้งหมด 34 ชุด เปิดขายปกติและพร้อมดาวน์โหลดในระบบ', 'จัดการแอสเซ็ต', '#27AE60', '#F0FFF4']
    ];

    alerts.forEach((a, i) => {
      const y = 225 + i * 125;
      rect(340, y, 1180, 105, a[4], 16, a[3], 1.5);
      txt(370, y + 42, a[0], 20, a[3], 800);
      txt(370, y + 74, a[1], 16, '#333333');

      rect(1340, y + 34, 150, 42, C.white, 21, a[3], 1.5);
      txt(1415, y + 60, a[2], 14, a[3], 700, 'middle');
    });
  });
}

// Page 25: Settings
function page25() {
  adminShell('25-admin-settings', 'ตั้งค่าร้าน', 'ตั้งค่าร้าน', () => {
    rect(305, 115, 1250, 740, C.white, 24, '#E8ECF2', 1);

    txt(340, 160, 'ตั้งค่าข้อมูลร้านและฝ่ายช่วยเหลือ', 24, '#111111', 800);
    txt(340, 190, 'ข้อมูลนี้จะแสดงผลบนหน้าร้านและศูนย์ช่วยเหลือลูกค้า', 15, '#777777');

    // Fields matching settingsPanel
    const fields = [
      ['อีเมลติดต่อ (Contact Email)', 'support@polyloot.example'],
      ['เบอร์โทรศัพท์ติดต่อ (Contact Phone)', '02-123-4567'],
      ['เวลาทำการช่วยเหลือ (Support Hours)', 'จันทร์ - ศุกร์ 09:00 - 18:00 น.'],
      ['ข้อความประกาศหน้าร้าน (Store Announcement)', 'ยินดีต้อนรับสู่ PolyLoot แหล่งรวม 3D Game Assets ทดลองโหลด Sample ได้ฟรี!']
    ];

    fields.forEach((f, i) => {
      const y = 220 + i * 95;
      txt(340, y + 25, f[0], 16, '#111111', 700);
      rect(340, y + 36, 1180, 48, C.white, 12, '#D0D5DD', 1);
      txt(360, y + 66, f[1], 15, '#333333');
    });

    // FAQ Editor preview
    txt(340, 615, 'คำถามที่พบบ่อย (FAQ Manager)', 18, '#111111', 800);
    rect(340, 635, 1180, 110, '#F8F9FC', 14);
    txt(360, 668, 'Q1: วิธีดาวน์โหลดแอสเซ็ตหลังสั่งซื้อเสร็จสิ้น', 15, '#111111', 700);
    txt(360, 695, 'A1: ลูกค้าสามารถไปที่เมนู "คลัง" เพื่อดาวน์โหลดไฟล์ ZIP ฉบับเต็มได้ทันที', 14, '#666666');

    rect(1300, 765, 220, 52, '#111111', 26);
    txt(1410, 797, 'บันทึกการตั้งค่าร้าน', 16, C.white, 700, 'middle');
  });
}

// Generate all 25 screens
page01();
page02();
page03();
page04();
page05();
page06();
page07();
page08();
page09();
page10();
page11();
page12();
page13();
page14();
page15();
page16();
page17();
page18();
page19();
page20();
page21();
page22();
page23();
page24();
page25();

console.log(`Generated all 25 SVG prototype pages matching the exact user Canva theme in ${out}`);

const slugs = [
  '01-home', '02-catalog', '03-cart', '04-checkout', '05-success',
  '06-track', '07-history', '08-library', '09-profile', '10-product-detail',
  '11-order-detail', '12-help', '13-settings', '14-notifications', '15-register',
  '16-login', '17-forgot', '18-reset', '19-dashboard', '20-orders',
  '21-products', '22-customers', '23-support', '24-alerts', '25-admin-settings'
];

for (const slug of slugs) {
  const svgPath = path.join(out, `${slug}.svg`);
  const pngPath = path.join(out, `${slug}.png`);
  if (fs.existsSync(svgPath)) {
    await sharp(svgPath).png().toFile(pngPath);
  }
}
console.log(`Converted all 25 SVG prototypes to clean PNG images in ${out}`);
