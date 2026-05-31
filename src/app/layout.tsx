import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '1:1 Meet | Sheryians Coding School',
  description: 'Premium developer-focused 1:1 video conferencing app powered by LiveKit.',
  icons: {
    icon: 'https://px.pixxo.io/sheryians/favicon_FuNGo5cLy.webp',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="h-full bg-brand-dark text-brand-text-primary selection:bg-brand-orange selection:text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
