import { z } from "zod";
import { logger } from "./logger";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  MONGODB_URI: z.string().min(1),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  LIVEKIT_URL: z.string().min(1),
  NEXT_PUBLIC_LIVEKIT_URL: z.string().min(1),
  LIVEKIT_TOKEN_TTL: z.string().default("2h"),
  ROOM_EMPTY_TIMEOUT: z.coerce.number().int().positive().default(300),
  ENCRYPTION_MASTER_KEY: z
    .string()
    .min(32, "must be at least 32 characters")
    .optional(),
  NEXT_PUBLIC_API_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]),
  LOG_FORMAT: z.enum(["json", "pretty"]),
  AUDIT_LOG_TTL_DAYS: z.coerce.number().int().positive().default(90),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_SESSION_TOKEN: z.string().optional(),
  AWS_REGION: z.string().default("ap-south-1").optional(),
  AWS_TRANSCRIBE_REGION: z.string().default("us-east-1").optional(),
  AWS_S3_BUCKET_NAME: z.string().default("sherymeet-recordings").optional(),
  AWS_S3_REGION: z.string().default("ap-south-1").optional(),
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
  const result = envSchema.safeParse(collectRawEnv());
  if (!result.success) {
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
      if (!config.REDIS_URL) {
        logger.warn(
          "REDIS_URL is not set: rate limiting and replay protection will be per-process (in-memory). " +
            "Set REDIS_URL before running more than one instance.",
        );
      }
      throw new Error(message);
    }
    logger.warn(`Environment validation failed: ${message}\n(Continuing because NODE_ENV is not production.)`);
  }

}
