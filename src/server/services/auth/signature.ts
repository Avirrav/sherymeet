import { canonicalizeJson, canonicalizeQueryString } from "../../utils/canonical";
import { sha256, hmacSha256, timingSafeEqual } from "../../utils/crypto-helper";
import { SecretCacheService } from "./secret-cache";
import { IApiClient } from "../../types/auth.types";

export class SignatureService {
  /**
   * Computes the SHA-256 hash of the canonical JSON body.
   * Falls back to raw string hash if not JSON, or empty string hash if no body exists.
   */
  static computeBodyHash(body: Buffer | string | undefined): string {
    if (!body || body.length === 0) {
      return sha256("");
    }

    try {
      const bodyStr = Buffer.isBuffer(body) ? body.toString("utf8") : body;
      const trimmed = bodyStr.trim();

      if (!trimmed) {
        return sha256("");
      }

      // Try to parse as JSON to canonicalize keys
      const parsed = JSON.parse(trimmed);
      const canonical = canonicalizeJson(parsed);
      return sha256(canonical);
    } catch {
      // Fallback for non-JSON content types
      const bodyStr = Buffer.isBuffer(body) ? body.toString("utf8") : body;
      return sha256(bodyStr);
    }
  }

  /**
   * Constructs the signature payload string from request components.
   */
  static constructPayload(params: {
    method: string;
    host: string;
    path: string;
    query: string;
    timestamp: string;
    nonce: string;
    bodyHash: string;
    origin?: string;
  }): string {
    const { method, host, path, query, timestamp, nonce, bodyHash, origin } =
      params;

    // Normalize path by stripping query parameters if present
    const normalizedPath = path.split("?")[0];

    // Canonicalize query parameters
    const canonicalQuery = canonicalizeQueryString(query);

    return [
      method.toUpperCase(),
      host,
      normalizedPath,
      canonicalQuery,
      timestamp,
      nonce,
      bodyHash,
      origin || "",
    ].join("\n");
  }

  /**
   * Verifies the client signature in a timing-safe manner against both current and previous rotated secrets.
   */
  static async verifySignature(params: {
    method: string;
    host: string;
    path: string;
    query: string;
    timestamp: string;
    nonce: string;
    body: Buffer | string | undefined;
    origin?: string;
    signature: string;
    client: IApiClient;
  }): Promise<{
    verified: boolean;
    matchedVersion: "current" | "previous" | "none";
  }> {
    const {
      method,
      host,
      path,
      query,
      timestamp,
      nonce,
      body,
      origin,
      signature,
      client,
    } = params;

    const bodyHash = this.computeBodyHash(body);
    const payload = this.constructPayload({
      method,
      host,
      path,
      query,
      timestamp,
      nonce,
      bodyHash,
      origin,
    });

    // 1. Verify against current secret
    const currentSecret = await SecretCacheService.getDecryptedSecret(
      client.apiKey,
      "current",
      client.currentSecret,
    );
    const expectedCurrentSig = hmacSha256(currentSecret, payload);

    if (timingSafeEqual(signature, expectedCurrentSig)) {
      return { verified: true, matchedVersion: "current" };
    }

    // 2. Verify against previous secret (if rotation is in progress)
    if (client.previousSecret) {
      const previousSecret = await SecretCacheService.getDecryptedSecret(
        client.apiKey,
        "previous",
        client.previousSecret,
      );
      const expectedPreviousSig = hmacSha256(previousSecret, payload);

      if (timingSafeEqual(signature, expectedPreviousSig)) {
        return { verified: true, matchedVersion: "previous" };
      }
    }

    return { verified: false, matchedVersion: "none" };
  }
}
