import type { Metadata } from 'next';
import { Roboto, Roboto_Mono, Playfair_Display } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';

// Roboto is the Material Design type family.
const roboto = Roboto({
  variable: '--font-roboto',
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
});

const robotoMono = Roboto_Mono({
  variable: '--font-roboto-mono',
  subsets: ['latin'],
});

// M3 allows a distinct "brand" typeface for Display/Headline roles while body
// text stays on the plain typeface (Roboto). Used only for hero headlines.
const playfair = Playfair_Display({
  // Named *-family so it doesn't collide with the Tailwind `--font-display`
  // theme token in globals.css, which references this one.
  variable: '--font-display-family',
  subsets: ['latin'],
  weight: ['600', '700'],
});

export const metadata: Metadata = {
  title: 'Meet',
  description: 'Secure, high-quality video meetings.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${roboto.variable} ${robotoMono.variable} ${playfair.variable} h-full antialiased dark`}
    >
      <body className="h-full bg-md-surface text-md-on-surface selection:bg-md-primary selection:text-md-on-primary">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
