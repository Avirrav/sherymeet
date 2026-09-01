// Single-tenant deployment: there is no login. The API client (key + secret)
// is provisioned once via the deploy script (see scripts/create-client.ts),
// and every meeting is created/joined through the signed /api/v1/client API
// by whatever backend holds that key — not through this page. This route
// only exists so "/" isn't a 404; it carries no auth state.
export default function LandingPage() {
  return (
    <div className="relative h-screen bg-md-surface flex flex-col justify-center overflow-hidden font-sans">
      <main className="relative z-10 max-w-4xl mx-auto w-full px-6 py-16 flex flex-col items-center text-center">
        <div className="mb-8 flex items-center justify-center w-20 h-20 rounded-md-xl bg-md-primary-container text-md-on-primary-container">
          <svg viewBox="0 0 24 24" className="w-10 h-10" fill="currentColor" aria-hidden="true">
            <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
          </svg>
        </div>
        <h1 className="mb-3 text-4xl md:text-5xl font-normal tracking-tight text-md-on-surface">
          Meet
        </h1>
        <p className="max-w-md text-base text-md-on-surface-variant">
          Secure, high-quality video meetings for your product.
        </p>
      </main>
    </div>
  );
}
