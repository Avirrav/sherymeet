import { memoryStore } from '../utils/memory-store';

export class RateLimitService {
  /**
   * Enforces three distinct rate limit sliding windows: burst, minute, and daily.
   * If any limit is exceeded, returns allowed: false and specifies which window was breached.
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
    // 1. Check Burst Limit (10 seconds)
    const burstKey = `rate:burst:${apiKey}`;
    const burstResult = memoryStore.checkRateLimit(burstKey, limits.burstLimit, 10);
    if (!burstResult.allowed) {
      return {
        allowed: false,
        limitType: 'burst',
        remaining: 0,
        reset: burstResult.reset,
      };
    }

    // 2. Check Minute Limit (60 seconds)
    const minuteKey = `rate:minute:${apiKey}`;
    const minuteResult = memoryStore.checkRateLimit(minuteKey, limits.rateLimit, 60);
    if (!minuteResult.allowed) {
      return {
        allowed: false,
        limitType: 'minute',
        remaining: 0,
        reset: minuteResult.reset,
      };
    }

    // 3. Check Daily Limit (86400 seconds)
    const dailyKey = `rate:daily:${apiKey}`;
    const dailyResult = memoryStore.checkRateLimit(dailyKey, limits.dailyLimit, 86400);
    if (!dailyResult.allowed) {
      return {
        allowed: false,
        limitType: 'daily',
        remaining: 0,
        reset: dailyResult.reset,
      };
    }

    // Determine the lowest remaining quota to return in headers
    const remaining = Math.min(burstResult.remaining, minuteResult.remaining);

    return {
      allowed: true,
      remaining,
      reset: 60, // Standard header reset window of 60 seconds
    };
  }
}
