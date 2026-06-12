class MemoryStore {
  private cache = new Map<string, { value: unknown; expiresAt: number }>();
  private rateLimits = new Map<string, number[]>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Periodically clean up expired entries to avoid memory leaks
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 10000);
      // Ensure the process can exit even if the timer is still active
      if (this.cleanupInterval && typeof this.cleanupInterval.unref === 'function') {
        this.cleanupInterval.unref();
      }
    }
  }

  /**
   * Cleans up expired cache entries and rate limit timestamps older than 24 hours.
   */
  private cleanup() {
    const now = Date.now();
    
    // Cleanup standard cache
    for (const [key, item] of this.cache.entries()) {
      if (item.expiresAt <= now) {
        this.cache.delete(key);
      }
    }

    // Cleanup rate limit lists (anything older than 24 hours)
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    for (const [key, timestamps] of this.rateLimits.entries()) {
      const filtered = timestamps.filter((t) => t > oneDayAgo);
      if (filtered.length === 0) {
        this.rateLimits.delete(key);
      } else {
        this.rateLimits.set(key, filtered);
      }
    }
  }

  /**
   * Retrieves a value from the cache. Returns null if expired or missing.
   */
  public get(key: string): unknown {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (item.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  /**
   * Sets a value in the cache with a specified TTL in seconds.
   */
  public set(key: string, value: unknown, ttlSeconds: number): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Simulates Redis SET NX: sets a value only if the key does not exist or has expired.
   * Returns true if set, false otherwise.
   */
  public setNx(key: string, value: unknown, ttlSeconds: number): boolean {
    const now = Date.now();
    const item = this.cache.get(key);

    if (item && item.expiresAt > now) {
      return false;
    }

    this.cache.set(key, {
      value,
      expiresAt: now + ttlSeconds * 1000,
    });
    return true;
  }

  /**
   * Deletes an entry from the cache.
   */
  public del(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Implements a sliding window rate limit check.
   * Purges timestamps outside window, checks capacity, and inserts current request timestamp.
   */
  public checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): { allowed: boolean; remaining: number; reset: number } {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const cutoff = now - windowMs;

    let timestamps = this.rateLimits.get(key) || [];
    
    // Keep only timestamps within the sliding window
    timestamps = timestamps.filter((t) => t > cutoff);

    if (timestamps.length >= limit) {
      const oldestInWindow = timestamps[0];
      const resetTimeSec = Math.ceil((oldestInWindow + windowMs - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        reset: resetTimeSec > 0 ? resetTimeSec : 1,
      };
    }

    // Record the current request timestamp
    timestamps.push(now);
    this.rateLimits.set(key, timestamps);

    const remaining = limit - timestamps.length;
    return {
      allowed: true,
      remaining,
      reset: windowSeconds,
    };
  }

  /**
   * Destroys the interval to clean up resources during tests.
   */
  public destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

export const memoryStore = new MemoryStore();
