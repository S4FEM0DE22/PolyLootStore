import type { Metadata } from 'next';
import Script from 'next/script';
import '../theme.css';
import './admin.css';
import '../dark.css';

export const metadata: Metadata = {
  title: 'ผู้ดูแลร้าน · PolyLoot',
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <>
    <div id="app" aria-live="polite"><div className="boot">กำลังเปิดระบบผู้ดูแล…</div></div>
    <Script src="/legacy/admin.js" type="module" strategy="afterInteractive" />
  </>;
}
