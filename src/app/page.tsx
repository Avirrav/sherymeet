import Image from 'next/image';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/backend/services/session-service';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  google_denied: 'Google sign-in was cancelled. Please try again.',
  invalid_state: 'Your sign-in request expired. Please try again.',
  email_not_verified: 'Please use a Google account with a verified email address.',
  google_auth_failed: 'Something went wrong while signing you in. Please try again.',
};

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ authError?: string }>;
}) {
  const user = await getSessionUser();
  if (user) {
    redirect('/dashboard');
  }
  const { authError } = await searchParams;
  const errorMessage = authError ? AUTH_ERROR_MESSAGES[authError] || 'Sign-in failed. Please try again.' : null;
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
        {errorMessage && (
          <p className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {errorMessage}
          </p>
        )}
        {/* Login with Google */}
        <a
          href="/api/private/auth/google"
          className="flex items-center gap-3 rounded-xl border border-brand-border bg-white px-6 py-3 font-medium text-brand-dark transition-colors hover:bg-neutral-200"
        >
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
            <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
          </svg>
          Continue with Google
        </a>
      </main>
    </div>
  );
}
