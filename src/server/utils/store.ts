import Redis from "ioredis";
import { logger } from "./logger";
import { config } from "./config";

/**
 * Shared distributed store for rate limiting and replay (nonce) protection.
 *
 * Backed exclusively by Redis (REDIS_URL is a required env var — see
 * config.ts) so counters and nonces hold across restarts and multiple
 * instances. There is no in-memory fallback: if Redis is unreachable, calls
 * throw and are surfaced as a 5xx by the central error handler (see
 * run-middlewares.ts) rather than silently degrading to per-process state.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
}

export interface AppStore {
  /** Redis SET NX semantics: returns true only if the key was newly set. */
  setNx(key: string, value: string, ttlSeconds: number): Promise<boolean>;
  /** Sliding-window rate limit check that also records the current request. */
  checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
  /**
   * Verifies the store is actually reachable. Forces the lazy connection
   * open and round-trips a PING so a boot-time caller (instrumentation.ts)
   * finds out immediately whether Redis is up, instead of on the first
   * request.
   */
  connect(): Promise<void>;
}

class RedisAppStore implements AppStore {
  private redis: Redis;

  constructor(url: string) {
    this.redis = new Redis(url, {
      maxRetriesPerRequest: 2,
      connectTimeout: 5_000,
      lazyConnect: true,
    });
    this.redis.on("error", (err) => {
      logger.error("Redis connection error", err);
    });
  }

  async connect(): Promise<void> {
    try {
      logger.info("Connecting to Redis...");
      await this.redis.connect();
      await this.redis.ping();
      logger.info("Redis connected successfully!");
    } catch (error) {
      logger.error("Redis connection failed", error);
      throw error;
    }
  }

  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.redis.set(key, value, "EX", ttlSeconds, "NX");
    return result === "OK";
  }

  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    // Sorted-set sliding window: drop entries outside the window, count
    // what's left, and only record this request if it's under the limit.
    const pruned = this.redis
      .multi()
      .zremrangebyscore(key, 0, now - windowMs)
      .zcard(key);
    const results = await pruned.exec();
    const count = (results?.[1]?.[1] as number) ?? 0;

    if (count >= limit) {
      const oldest = await this.redis.zrange(key, 0, 0, "WITHSCORES");
      const oldestScore = oldest.length === 2 ? Number(oldest[1]) : now;
      const reset = Math.max(1, Math.ceil((oldestScore + windowMs - now) / 1000));
      return { allowed: false, remaining: 0, reset };
    }

    await this.redis
      .multi()
      .zadd(key, now, `${now}:${Math.random().toString(36).slice(2, 8)}`)
      .expire(key, windowSeconds)
      .exec();

    return { allowed: true, remaining: limit - count - 1, reset: windowSeconds };
  }
}

declare global {
  var appStoreSingleton: AppStore | undefined;
}

/**
 * Returns the process-wide store instance (cached on globalThis so Next.js
 * dev-mode module reloads don't open extra Redis connections).
 */
export function getStore(): AppStore {
  if (!global.appStoreSingleton) {
    global.appStoreSingleton = new RedisAppStore(config.REDIS_URL);
  }
  return global.appStoreSingleton;
}
