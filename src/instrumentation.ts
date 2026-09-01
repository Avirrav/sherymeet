/**
 * Runs once when the Next.js server boots (before it accepts requests).
 * Used to fail fast on missing/invalid environment configuration.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("./server/utils/env");
    validateEnv();
  }
}
