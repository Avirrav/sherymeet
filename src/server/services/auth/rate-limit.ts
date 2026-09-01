import { getStore } from '../../utils/store';

export class RateLimitService {
  /**
   * Enforces three distinct rate limit sliding windows: burst, minute, and daily.
   * If any limit is exceeded, returns allowed: false and specifies which window was breached.
   * Backed by Redis when REDIS_URL is set (see utils/store.ts).
   */
  static async checkRateLimits(
    apiKey: string,
    limits: {
      rateLimit: number;   // requests/minute
      burstLimit: number;  // requests/10 seconds
      dailyLimit: number;  // requests/day
    }
  ): Promise<{
    allowed: boolean;
    limitType?: 'burst' | 'minute' | 'daily';
    remaining?: number;
    reset?: number;
  }> {
    const store = getStore();

    // 1. Check Burst Limit (10 seconds)
    const burstResult = await store.checkRateLimit(`rate:burst:${apiKey}`, limits.burstLimit, 10);
    if (!burstResult.allowed) {
      return { allowed: false, limitType: 'burst', remaining: 0, reset: burstResult.reset };
    }

    // 2. Check Minute Limit (60 seconds)
    const minuteResult = await store.checkRateLimit(`rate:minute:${apiKey}`, limits.rateLimit, 60);
    if (!minuteResult.allowed) {
      return { allowed: false, limitType: 'minute', remaining: 0, reset: minuteResult.reset };
    }

    // 3. Check Daily Limit (86400 seconds)
    const dailyResult = await store.checkRateLimit(`rate:daily:${apiKey}`, limits.dailyLimit, 86400);
    if (!dailyResult.allowed) {
      return { allowed: false, limitType: 'daily', remaining: 0, reset: dailyResult.reset };
    }

    // Determine the lowest remaining quota to return in headers
    const remaining = Math.min(burstResult.remaining, minuteResult.remaining);

    return {
      allowed: true,
      remaining,
      reset: 60, // Standard header reset window of 60 seconds
    };
  }

  /**
   * Simple per-IP rate limit for public (unauthenticated) endpoints.
   */
  static async checkIpRateLimit(
    ip: string,
    limits: { perMinute: number; burstPer10s: number } = { perMinute: 60, burstPer10s: 15 },
  ): Promise<{ allowed: boolean; reset?: number }> {
    const store = getStore();

    const burst = await store.checkRateLimit(`rate:ip:burst:${ip}`, limits.burstPer10s, 10);
    if (!burst.allowed) {
      return { allowed: false, reset: burst.reset };
    }
    const minute = await store.checkRateLimit(`rate:ip:minute:${ip}`, limits.perMinute, 60);
    if (!minute.allowed) {
      return { allowed: false, reset: minute.reset };
    }
    return { allowed: true };
  }
}
