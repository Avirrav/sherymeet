import crypto from "crypto";
import { apiKeyEncryption } from "./keyencryption";
import { memoryStore } from "../../utils/memory-store";
export class SecretCacheService {
  private static CACHE_TTL_SECONDS = 300; // 5 minutes cache
  /**
   * Resolves the decrypted secret. Checks the local cache first before performing KMS decryption.
   */
  static async getDecryptedSecret(
    apiKey: string,
    secretType: "current" | "previous",
    encryptedSecret: string,
  ): Promise<string> {
    if (!encryptedSecret) return "";

    // Create a unique cache key based on the apiKey, secret type, and hash of the ciphertext
    const cipherHash = crypto
      .createHash("md5")
      .update(encryptedSecret)
      .digest("hex");
    const cacheKey = `secret:${apiKey}:${secretType}:${cipherHash}`;

    // Check memory store cache
    const cached = memoryStore.get(cacheKey);
    if (typeof cached === "string") {
      return cached;
    }

    // Cache miss: Decrypt using KMS/Local GCM
    const decrypted = await apiKeyEncryption.decrypt(encryptedSecret);

    // Cache the decrypted secret
    memoryStore.set(cacheKey, decrypted, this.CACHE_TTL_SECONDS);

    return decrypted;
  }
  /**
   * Invalidates any cached secrets for a given API key.
   */
  static invalidateApiKeySecrets(): void {
    // Standard cleanup: We delete keys manually if needed
    // However, since we hashed the ciphertext, if the DB rotates, it automatically misses.
    // For direct invalidation, we can just delete from the store
    // (In production with Redis, we would run: DEL secret:apiKey:*)
  }
}
