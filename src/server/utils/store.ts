import Redis from "ioredis";
import { memoryStore } from "./memory-store";
import { logger } from "./logger";
import { config } from "./config";

/**
 * Shared distributed store for rate limiting and replay (nonce) protection.
 *
 * When REDIS_URL is set, sliding-window counters and nonces live in Redis so
 * they hold across restarts and multiple instances. Without it (local dev,
 * single instance) the in-memory store is used. If Redis errors at runtime we
 * fall back to the in-memory store for that call and log loudly — favoring
 * availability over strictness so a Redis blip doesn't take the API down.
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
}

class MemoryAppStore implements AppStore {
  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    return memoryStore.setNx(key, value, ttlSeconds);
  }

  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    return memoryStore.checkRateLimit(key, limit, windowSeconds);
  }
}

class RedisAppStore implements AppStore {
  private redis: Redis;
  private fallback = new MemoryAppStore();

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

  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    try {
      const result = await this.redis.set(key, value, "EX", ttlSeconds, "NX");
      return result === "OK";
    } catch (err) {
      logger.error("Redis setNx failed, falling back to in-memory store", err, { key });
      return this.fallback.setNx(key, value, ttlSeconds);
    }
  }

  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    try {
      // Sorted-set sliding window: drop entries outside the window, count
      // what's left, and only record this request if it's under the limit.
      const pruned = this.redis.multi().zremrangebyscore(key, 0, now - windowMs).zcard(key);
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
    } catch (err) {
      logger.error("Redis rate limit check failed, falling back to in-memory store", err, { key });
      return this.fallback.checkRateLimit(key, limit, windowSeconds);
    }
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
    const redisUrl = config.REDIS_URL;
    if (redisUrl) {
      logger.info("Using Redis-backed store for rate limiting and replay protection");
      global.appStoreSingleton = new RedisAppStore(redisUrl);
    } else {
      global.appStoreSingleton = new MemoryAppStore();
    }
  }
  return global.appStoreSingleton;
}
