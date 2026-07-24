import { getStore } from '../utils/store';

export class NonceService {
  private static NONCE_TTL_SECONDS = 300; // 5 minutes matching timestamp drift allowance

  /**
   * Validates if a nonce has already been used for a specific API Key.
   * Returns true if the nonce is unique and valid (not used), false if it is a duplicate.
   * Backed by Redis when REDIS_URL is set, so replay protection holds across
   * restarts and multiple instances.
   */
  static async validateNonce(apiKey: string, nonce: string): Promise<boolean> {
    const key = `nonce:${apiKey}:${nonce}`;

    // Set NX returns true if the key did not exist and was successfully set
    return getStore().setNx(key, '1', this.NONCE_TTL_SECONDS);
  }
}
