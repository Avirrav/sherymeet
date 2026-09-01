import { redirect } from 'next/navigation';
import { getSessionUser } from '@/server/services/session-service';

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
    <div className="relative h-screen bg-md-surface flex flex-col justify-between overflow-hidden font-sans">
      {/* Main Hero */}
      <main className="relative z-10 max-w-4xl mx-auto w-full px-6 py-16 md:py-24 flex flex-col items-center text-center my-auto">
        {/* Product mark */}
        <div className="mb-8 flex items-center justify-center w-20 h-20 rounded-md-xl bg-md-primary-container text-md-on-primary-container">
          <svg viewBox="0 0 24 24" className="w-10 h-10" fill="currentColor" aria-hidden="true">
            <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
          </svg>
        </div>
        <h1 className="mb-3 text-4xl md:text-5xl font-normal tracking-tight text-md-on-surface">
          Meet
        </h1>
        <p className="mb-10 max-w-md text-base text-md-on-surface-variant">
          Secure, high-quality video meetings for your product.
        </p>
        {errorMessage && (
          <p className="mb-6 rounded-md-sm border border-md-error/40 bg-md-error-container/40 px-4 py-3 text-sm text-md-on-error-container">
            {errorMessage}
          </p>
        )}
        {/* Login with Google — M3 filled button */}
        <a
          href="/api/private/auth/google"
          className="btn-press md-state-layer flex items-center gap-3 rounded-md-full bg-md-primary px-6 py-3.5 text-sm font-medium text-md-on-primary"
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
