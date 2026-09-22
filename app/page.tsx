import Script from 'next/script';
import './theme.css';
import './store.css';
import './dark.css';

export default function StorePage() {
  return <>
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#home" aria-label="PolyLoot หน้าร้าน"><img src="/assets/brand/polyloot.png" alt="PolyLoot" /></a>
        <button className="mobile-menu-toggle" id="mobile-menu-toggle" type="button" aria-controls="mobile-nav" aria-expanded="false" aria-label="เปิดเมนู">
          <span /><span /><span />
        </button>
        <nav className="nav-pills" id="mobile-nav" aria-label="เมนูหลัก">
          <a href="#home" data-nav="home">หน้าแรก</a>
          <a href="#catalog" data-nav="catalog">สินค้า</a>
          <a href="#track" data-nav="orders">คำสั่งซื้อ</a>
          <a href="#library" data-nav="library">คลัง</a>
          <a href="#cart" data-nav="cart" className="nav-cart" aria-label="ตะกร้าสินค้า"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 4h2l2.2 10.5a2 2 0 0 0 2 1.5h8.3a2 2 0 0 0 1.9-1.5L21 8H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg><span className="cart-nav-label">ตะกร้า</span><span id="cart-count" className="cart-count" hidden /></a>
          <a href="#notifications" data-nav="notifications" className="nav-notifications" aria-label="การแจ้งเตือน"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg><span className="nav-notifications-label">การแจ้งเตือน</span><span id="notification-count" hidden></span></a>
          <div className="settings-menu-wrap" id="settings-menu-wrap">
            <button className="settings-menu-toggle" id="settings-menu-toggle" type="button" aria-expanded="false" aria-haspopup="true" aria-controls="settings-dropdown" aria-label="เปิดเมนูตั้งค่า">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.88 1.88-.06-.06A1.7 1.7 0 0 0 16 18.4a1.7 1.7 0 0 0-1 1.57V20H9v-.03a1.7 1.7 0 0 0-1-1.57 1.7 1.7 0 0 0-1.88.34l-.06.06-1.88-1.88.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.57-1H3v-4h.03A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88L4.2 7.06l1.88-1.88.06.06A1.7 1.7 0 0 0 8 5.6a1.7 1.7 0 0 0 1-1.57V4h6v.03a1.7 1.7 0 0 0 1 1.57 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.88 1.88-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.57 1H21v4h-.03A1.7 1.7 0 0 0 19.4 15Z"/></svg>
              <span className="settings-menu-label">ตั้งค่า</span>
            </button>
            <div className="settings-dropdown" id="settings-dropdown" hidden>
              <div className="settings-dropdown-head"><span className="settings-dropdown-icon" aria-hidden="true">✦</span><div><strong>การตั้งค่า</strong><small>ปรับร้านให้เหมาะกับคุณ</small></div></div>
              <div className="settings-dropdown-section"><label htmlFor="quick-theme">ธีมการแสดงผล</label><select id="quick-theme" className="styled-select"><option value="system">ตามอุปกรณ์</option><option value="light">สว่าง</option><option value="dark">มืด</option></select></div>
              <div className="settings-dropdown-section"><label htmlFor="quick-language">ภาษา</label><select id="quick-language" className="styled-select"><option value="th">ไทย</option><option value="en">English</option></select></div>
              <div className="settings-dropdown-links" aria-label="ทางลัดการตั้งค่า">
                <span className="settings-dropdown-caption">ทางลัด</span>
                <a href="#settings" className="settings-shortcut"><span className="settings-shortcut-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="17" r="2" fill="currentColor" stroke="none"/></svg></span><span className="settings-shortcut-copy"><strong>ตั้งค่าทั้งหมด</strong><small>บัญชีและการแจ้งเตือน</small></span><span className="settings-link-arrow" aria-hidden="true">↗</span></a>
                <a href="#help" className="settings-shortcut"><span className="settings-shortcut-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 9a3.5 3.5 0 1 1 6.1 2.3c-.9.9-2.6 1.5-2.6 3.2"/><circle cx="12" cy="18" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="10"/></svg></span><span className="settings-shortcut-copy"><strong>ติดต่อและช่วยเหลือ</strong><small>คำถามที่พบบ่อยและช่องทางติดต่อ</small></span><span className="settings-link-arrow" aria-hidden="true">↗</span></a>
              </div>
            </div>
          </div>
          <button className="nav-auth-action" id="nav-auth-action" type="button" aria-label="บัญชีผู้ใช้: เข้าสู่ระบบ">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>
            <span className="nav-auth-label">บัญชีผู้ใช้</span>
          </button>
        </nav>
      </header>
      <main id="app" tabIndex={-1}><div className="loading">กำลังโหลดร้านแอสเซ็ต…</div></main>
      <footer className="site-footer">
        <div className="footer-top">
          <div className="footer-brand"><img src="/assets/brand/polyloot.png" alt="PolyLoot" /><p>คลัง 3D Game Assets</p></div>
          <div className="footer-nav"><a href="#catalog">แคตตาล็อก</a><a href="#cart">ตะกร้าสินค้า</a><a href="#track">ติดตามคำสั่งซื้อ</a><a href="#settings">ตั้งค่าบัญชี</a><a href="#help">เกี่ยวกับร้าน / ช่วยเหลือ</a></div>
        </div>
        <div className="footer-bottom"><span className="footer-copy">© 2026 PolyLoot</span><span className="footer-badge">DEMO ONLY · ไม่มีการรับเงินจริง</span></div>
      </footer>
    </div>
    <Script src="/legacy/storefront.js" type="module" strategy="afterInteractive" />
  </>;
}
