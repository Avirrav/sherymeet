import { z } from "zod";
import { logger } from "./logger";

/**
 * Single source of truth for environment variables. Parsed once at module
 * load and exported as a typed `config` object — call sites import `config`
 * instead of reading `process.env` directly, so a missing/malformed var is
 * caught by the schema instead of surfacing as `undefined` deep in a service.
 *
 * `validateEnv()` runs once at server startup via src/instrumentation.ts and
 * throws in production when a required-in-production variable is missing,
 * so the server can never silently boot with fallback secrets. In
 * development it only warns, so local setups keep working.
 *
 * NEXT_PUBLIC_* vars are read with static `process.env.NEXT_PUBLIC_X`
 * property access on purpose: Next.js inlines those references at build
 * time, which is the only way they exist inside the standalone Docker
 * runtime.
 */

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Database
  MONGODB_URI: z.string().min(1).optional(),

  // LiveKit
  LIVEKIT_API_KEY: z.string().min(1).optional(),
  LIVEKIT_API_SECRET: z.string().min(1).optional(),
  LIVEKIT_URL: z.string().min(1).optional(),
  NEXT_PUBLIC_LIVEKIT_URL: z.string().min(1).optional(),
  LIVEKIT_TOKEN_TTL: z.string().default("2h"),
  ROOM_EMPTY_TIMEOUT: z.coerce.number().int().positive().default(300),

  // Security
  ENCRYPTION_MASTER_KEY: z
    .string()
    .min(32, "must be at least 32 characters")
    .optional(),

  // Public URLs
  NEXT_PUBLIC_API_URL: z.string().url().optional(),

  // Redis
  REDIS_URL: z.string().url().optional(),

  // Logging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
  LOG_FORMAT: z.enum(["json", "pretty"]).optional(),

  // Audit
  AUDIT_LOG_TTL_DAYS: z.coerce.number().int().positive().default(90),

  // AWS
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_SESSION_TOKEN: z.string().optional(),
  AWS_REGION: z.string().default("ap-south-1"),
  AWS_TRANSCRIBE_REGION: z.string().default("us-east-1"),
  AWS_S3_BUCKET_NAME: z.string().default("sherymeet-recordings"),
  AWS_S3_REGION: z.string().default("ap-south-1"),

});

function collectRawEnv() {
  return {
    NODE_ENV: process.env.NODE_ENV,
    MONGODB_URI: process.env.MONGODB_URI,
    LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
    LIVEKIT_URL: process.env.LIVEKIT_URL,
    NEXT_PUBLIC_LIVEKIT_URL: process.env.NEXT_PUBLIC_LIVEKIT_URL,
    LIVEKIT_TOKEN_TTL: process.env.LIVEKIT_TOKEN_TTL,
    ROOM_EMPTY_TIMEOUT: process.env.ROOM_EMPTY_TIMEOUT,
    ENCRYPTION_MASTER_KEY: process.env.ENCRYPTION_MASTER_KEY,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    REDIS_URL: process.env.REDIS_URL,
    LOG_LEVEL: process.env.LOG_LEVEL,
    LOG_FORMAT: process.env.LOG_FORMAT,
    AUDIT_LOG_TTL_DAYS: process.env.AUDIT_LOG_TTL_DAYS,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_SESSION_TOKEN: process.env.AWS_SESSION_TOKEN,
    AWS_REGION: process.env.AWS_REGION,
    AWS_TRANSCRIBE_REGION: process.env.AWS_TRANSCRIBE_REGION,
    AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME,
    AWS_S3_REGION: process.env.AWS_S3_REGION,
  };
}

function parseConfig() {
  // Non-strict parse: unset optional vars just become `undefined`/defaults.
  // Required-in-production enforcement happens separately in validateEnv(),
  // which runs once at boot rather than on every import of this module.
  const result = envSchema.safeParse(collectRawEnv());

  if (!result.success) {
    // Should only happen for malformed values (e.g. AUDIT_LOG_TTL_DAYS not a
    // number), since every field above is optional or defaulted.
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }

  return result.data;
}

export const config = parseConfig();

export function isProduction(): boolean {
  return config.NODE_ENV === "production";
}

const requiredInProduction = z.object({
  MONGODB_URI: z.string().min(1),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  LIVEKIT_URL: z.string().min(1),
  ENCRYPTION_MASTER_KEY: z.string().min(32, "must be at least 32 characters"),
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_LIVEKIT_URL: z.string().min(1),
});

/**
 * Validates the environment. Throws in production, warns in development.
 */
export function validateEnv(): void {
  const result = requiredInProduction.safeParse(config);

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

  if (isProduction() && !config.REDIS_URL) {
    logger.warn(
      "REDIS_URL is not set: rate limiting and replay protection will be per-process (in-memory). " +
        "Set REDIS_URL before running more than one instance.",
    );
  }
}
