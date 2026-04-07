import type { Metadata } from 'next';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: '취향 매칭 | YouMatch',
  description: '같은 취향을 가진 사람을 만나보세요',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="noise-overlay">
        {children}
      </body>
    </html>
  );
}
