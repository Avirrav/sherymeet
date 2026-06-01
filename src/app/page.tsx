'use client';
import Image from 'next/image';
export default function LandingPage() {
  return (
    <div className="relative h-screen bg-brand-dark flex flex-col justify-between overflow-hidden font-sans">
      {/* Decorative background glow circles */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] aspect-square rounded-full bg-brand-orange/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] aspect-square rounded-full bg-brand-orange/5 blur-[120px] pointer-events-none" />
      
      {/* Grid Pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Main Hero */}
      <main className="relative z-10 max-w-4xl mx-auto w-full px-6 py-16 md:py-24 flex flex-col items-center text-center my-auto">
        {/* Sheryians Logo */}
        <div className="mb-10 flex items-center gap-4 bg-brand-surface/40 border border-brand-border/40 px-6 py-4 rounded-2xl backdrop-blur-md">
          <Image
            src="https://dfdx9u0psdezh.cloudfront.net/logos/full-logo.webp"
            alt="Sheryians Coding School"
            width={200}
            height={48}
            className="h-10 md:h-12 w-auto object-contain"
            priority
          />
        </div>
      </main>
    </div>
  );
}
