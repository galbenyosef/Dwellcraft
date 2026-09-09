import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  icons: { icon: '/icon.svg' },
  title: 'Dwellcraft · 住进想象',
  description: '选择一个家，自由布置，让理想生活成为可以走进去的空间。',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
