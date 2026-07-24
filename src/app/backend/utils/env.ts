import { z } from "zod";
import { logger } from "./logger";

/**
 * Central environment validation, run once at server startup via
 * src/instrumentation.ts. In production the server refuses to boot when a
 * required variable is missing so it can never silently run with fallback
 * secrets. In development we only warn, so local setups keep working.
 *
 * NEXT_PUBLIC_* vars are read with static property access on purpose:
 * Next.js inlines those references at build time, which is the only way
 * they exist inside the standalone Docker runtime.
 */

const requiredInProduction = z.object({
  MONGODB_URI: z.string().min(1),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  LIVEKIT_URL: z.string().min(1),
  ENCRYPTION_MASTER_KEY: z.string().min(32, "must be at least 32 characters"),
  SESSION_SECRET: z.string().min(32, "must be at least 32 characters"),
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_LIVEKIT_URL: z.string().min(1),
});

function collectEnv() {
  return {
    MONGODB_URI: process.env.MONGODB_URI,
    LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
    LIVEKIT_URL: process.env.LIVEKIT_URL,
    ENCRYPTION_MASTER_KEY: process.env.ENCRYPTION_MASTER_KEY,
    SESSION_SECRET: process.env.SESSION_SECRET,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_LIVEKIT_URL: process.env.NEXT_PUBLIC_LIVEKIT_URL,
  };
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Validates the environment. Throws in production, warns in development.
 */
export function validateEnv(): void {
  const result = requiredInProduction.safeParse(collectEnv());

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    const message = `Environment validation failed:\n${problems}`;

    if (isProduction()) {
      throw new Error(message);
    }
    logger.warn(`${message}\n(Continuing because NODE_ENV is not production.)`);
  }

  if (isProduction() && !process.env.REDIS_URL) {
    logger.warn(
      "REDIS_URL is not set: rate limiting and replay protection will be per-process (in-memory). " +
        "Set REDIS_URL before running more than one instance.",
    );
  }
}
