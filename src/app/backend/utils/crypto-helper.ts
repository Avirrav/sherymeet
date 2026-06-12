import crypto from 'crypto';

/**
 * Timing-safe comparison of two strings to prevent side-channel timing attacks.
 * First compares length, performing a dummy comparison to maintain constant time characteristics.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');

  if (aBuf.length !== bBuf.length) {
    // Perform dummy timingSafeEqual comparison with itself to preserve timing characteristics
    crypto.timingSafeEqual(aBuf, aBuf);
    return false;
  }

  return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * Generates a SHA-256 hash of the provided content.
 */
export function sha256(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Generates an HMAC-SHA256 signature of the payload using the specified secret.
 */
export function hmacSha256(secret: string | Buffer, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}
