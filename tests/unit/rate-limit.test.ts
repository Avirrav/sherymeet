import { memoryStore } from "../../src/app/backend/utils/memory-store";
import { RateLimitService } from "../../src/app/backend/services/rate-limit-service";
import { NonceService } from "../../src/app/backend/services/nonce-service";

describe("Rate Limit and Replay Protection Services", () => {
  beforeEach(() => {
    const store = memoryStore as unknown as {
      cache: Map<string, unknown>;
      rateLimits: Map<string, number[]>;
    };
    store.cache.clear();
    store.rateLimits.clear();
  });

  afterAll(() => {
    memoryStore.destroy();
  });

  describe("NonceService (Replay Protection)", () => {
    it("should allow unique nonces", async () => {
      const apiKey = "test_api_key";
      const firstCheck = await NonceService.validateNonce(apiKey, "nonce_1");
      const secondCheck = await NonceService.validateNonce(apiKey, "nonce_2");

      expect(firstCheck).toBe(true);
      expect(secondCheck).toBe(true);
    });

    it("should reject duplicate nonces within TTL window", async () => {
      const apiKey = "test_api_key";
      const firstCheck = await NonceService.validateNonce(apiKey, "nonce_1");
      const secondCheck = await NonceService.validateNonce(apiKey, "nonce_1");

      expect(firstCheck).toBe(true);
      expect(secondCheck).toBe(false);
    });
  });

  describe("RateLimitService (Sliding Window)", () => {
    const limits = {
      rateLimit: 5, // 5 requests/minute
      burstLimit: 2, // 2 requests/10 seconds
      dailyLimit: 10, // 10 requests/day
    };

    it("should allow requests within quotas", async () => {
      const apiKey = "test_api_key";

      const r1 = await RateLimitService.checkRateLimits(apiKey, limits);
      const r2 = await RateLimitService.checkRateLimits(apiKey, limits);

      expect(r1.allowed).toBe(true);
      expect(r2.allowed).toBe(true);
      expect(r2.remaining).toBe(0); // burst limit of 2 is fully consumed
    });

    it("should trigger burst limit when rate exceeds short window", async () => {
      const apiKey = "test_api_key";

      await RateLimitService.checkRateLimits(apiKey, limits); // req 1
      await RateLimitService.checkRateLimits(apiKey, limits); // req 2

      // 3rd request in same 10 second window should trigger burst limit
      const r3 = await RateLimitService.checkRateLimits(apiKey, limits);

      expect(r3.allowed).toBe(false);
      expect(r3.limitType).toBe("burst");
    });

    it("should trigger minute limit when rate exceeds 60s window", async () => {
      const apiKey = "test_api_key";
      const now = Date.now();

      // Push 5 timestamps spread out by 15s to bypass burst (2 req/10s), but hit minute limit (5 req/min)
      const mockTimestamps = [
        now - 59000, // 59s ago (inside 60s window)
        now - 45000, // 45s ago
        now - 30000, // 30s ago
        now - 15000, // 15s ago
        now - 5000, // 5s ago
      ];

      const store = memoryStore as unknown as {
        cache: Map<string, unknown>;
        rateLimits: Map<string, number[]>;
      };
      store.rateLimits.set(`rate:minute:${apiKey}`, mockTimestamps);
      store.rateLimits.set(`rate:burst:${apiKey}`, [now - 5000]);

      const result = await RateLimitService.checkRateLimits(apiKey, limits);

      expect(result.allowed).toBe(false);
      expect(result.limitType).toBe("minute");
    });
  });
});
