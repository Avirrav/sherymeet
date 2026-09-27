import { Video, Shield, Zap } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Secure HD Video Meetings for Your Product",
  description:
    "SheryMeet provides secure, high-quality HD video conferencing with end-to-end encryption and low latency. Easily embed video meetings directly into your product via API.",
  openGraph: {
    title: "SheryMeet - Secure HD Video Meetings for Your Product",
    description:
      "Embed secure, high-quality video conferencing into your product. HD video, end-to-end encryption, and ultra-low latency.",
  },
};

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-md-surface flex flex-col justify-center overflow-hidden font-sans">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-md-primary/5 via-transparent to-transparent" />

      <main className="relative z-10 max-w-2xl mx-auto w-full px-6 py-16 flex flex-col items-center text-center">
        {/* Logo */}
        <div className="mb-8 w-20 h-20 rounded-2xl bg-md-primary flex items-center justify-center shadow-lg shadow-md-primary/20">
          <svg viewBox="0 0 24 24" className="w-10 h-10 text-md-on-primary" fill="currentColor">
            <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
          </svg>
        </div>

        {/* Heading */}
        <h1 className="mb-4 text-5xl md:text-6xl font-bold tracking-tight text-md-on-surface">
          Shery<span className="text-md-primary">Meet</span>
        </h1>

        {/* Subheading */}
        <p className="max-w-md text-lg text-md-on-surface-variant leading-relaxed mb-10">
          Secure, high-quality video meetings embedded directly into your product.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-md-surface-container border border-md-outline-variant/30">
            <Video className="w-4 h-4 text-md-primary" />
            <span className="text-sm text-md-on-surface">HD Video</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-md-surface-container border border-md-outline-variant/30">
            <Shield className="w-4 h-4 text-md-tertiary" />
            <span className="text-sm text-md-on-surface">End-to-End Encrypted</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-md-surface-container border border-md-outline-variant/30">
            <Zap className="w-4 h-4 text-yellow-500" />
            <span className="text-sm text-md-on-surface">Low Latency</span>
          </div>
        </div>

        {/* API notice */}
        <div className="px-6 py-4 rounded-2xl bg-md-surface-container border border-md-outline-variant/30 max-w-md">
          <p className="text-sm text-md-on-surface-variant leading-relaxed">
            Meetings are created via the{" "}
            <code className="px-1.5 py-0.5 rounded bg-md-surface-variant text-md-primary text-xs font-mono">
              /api/v1
            </code>{" "}
            endpoints. This page is for reference only.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="absolute bottom-0 left-0 right-0 py-6 text-center">
        <p className="text-xs text-md-on-surface-variant/50">
          Powered by LiveKit &bull; Built for embedding
        </p>
      </footer>
    </div>
  );
}
