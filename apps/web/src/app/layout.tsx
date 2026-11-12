import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Victor Noctis',
  description: 'Private, owner-controlled personal AI companion and execution system.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#090a0f] text-slate-200 antialiased">
        {children}
      </body>
    </html>
  );
}
