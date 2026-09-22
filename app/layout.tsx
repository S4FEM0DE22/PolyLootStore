import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'PolyLoot — ร้าน 3D Game Assets',
  description: 'ร้าน 3D Game Assets สำหรับ Mini Project พร้อมระบบสั่งซื้อจำลอง',
  icons: { icon: '/assets/brand/polyloot.png' },
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="th"><body>{children}</body></html>;
}
