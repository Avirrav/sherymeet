import type { Metadata } from "next";
import { Roboto, Roboto_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

// Roboto is the Material Design type family.
const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

// M3 allows a distinct "brand" typeface for Display/Headline roles while body
// text stays on the plain typeface (Roboto). Used only for hero headlines.
const playfair = Playfair_Display({
  // Named *-family so it doesn't collide with the Tailwind `--font-display`
  // theme token in globals.css, which references this one.
  variable: "--font-display-family",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "SheryMeet - Secure Video Conferencing",
    template: "%s | SheryMeet",
  },
  description:
    "Secure, high-quality HD video meetings with end-to-end encryption. Low-latency conferencing built for seamless embedding into your product.",
  keywords: [
    "video conferencing",
    "video meetings",
    "secure meetings",
    "HD video calls",
    "encrypted video chat",
    "embeddable video",
    "WebRTC",
    "LiveKit",
    "screen sharing",
    "virtual meetings",
  ],
  authors: [{ name: "SheryMeet" }],
  creator: "SheryMeet",
  publisher: "SheryMeet",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "SheryMeet",
    title: "SheryMeet - Secure Video Conferencing",
    description:
      "Secure, high-quality HD video meetings with end-to-end encryption and low latency.",
  },
  twitter: {
    card: "summary_large_image",
    title: "SheryMeet - Secure Video Conferencing",
    description:
      "Secure, high-quality HD video meetings with end-to-end encryption and low latency.",
  },
  applicationName: "SheryMeet",
  category: "technology",
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
