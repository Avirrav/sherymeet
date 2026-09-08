class MemoryStore {
  private cache = new Map<string, { value: unknown; expiresAt: number }>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Periodically clean up expired entries to avoid memory leaks
    if (typeof setInterval !== "undefined") {
      this.cleanupInterval = setInterval(() => this.cleanup(), 10000);
      // Ensure the process can exit even if the timer is still active
      if (this.cleanupInterval && typeof this.cleanupInterval.unref === "function") {
        this.cleanupInterval.unref();
      }
    }
  }

  /**
   * Cleans up expired cache entries.
   */
  private cleanup() {
    const now = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (item.expiresAt <= now) {
        this.cache.delete(key);
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
   * Deletes an entry from the cache.
   */
  public del(key: string): void {
    this.cache.delete(key);
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
