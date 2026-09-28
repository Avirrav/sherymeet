import crypto from "crypto";
import { config, isProduction } from "../../utils/config";
import { logger } from "../../utils/logger";

const ALGORITHM = "aes-256-gcm";
const LOCAL_PREFIX = "local:";

let devKeyWarningLogged = false;

export class apiKeyEncryption {
  private static getMasterKey(): Buffer {
    const keyStr = config.ENCRYPTION_MASTER_KEY;

    if (!keyStr || keyStr.length < 32) {
      if (isProduction()) {
        throw new Error(
          "ENCRYPTION_MASTER_KEY must be set and at least 32 characters in production. " +
            "API key encryption is disabled without a valid master key.",
        );
      }
      // This should never happen as config validation requires the key,
      // but if it somehow does in development, throw an error
      throw new Error(
        "ENCRYPTION_MASTER_KEY is required. Please set a 32+ character key in your .env file.",
      );
    }

    // Warn if key looks like a placeholder/default (only in development)
    if (!isProduction() && !devKeyWarningLogged) {
      if (keyStr.includes("default") || keyStr.includes("example") || keyStr.includes("your_")) {
        logger.warn(
          "⚠️  ENCRYPTION_MASTER_KEY appears to be a placeholder. " +
            "Generate a secure key for production: openssl rand -base64 32",
        );
        devKeyWarningLogged = true;
      }
    }

    // Ensure the key is exactly 32 bytes (256 bits)
    return Buffer.from(keyStr.padEnd(32, "!").substring(0, 32), "utf8");
  }

  /**
   * Encrypts a plaintext string using local AES-256-GCM encryption.
   */
  static async encrypt(plaintext: string): Promise<string> {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, this.getMasterKey(), iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag().toString("hex");

    // Format: local:iv:authTag:ciphertext
    return `${LOCAL_PREFIX}${iv.toString("hex")}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypts a ciphertext string using local AES-256-GCM decryption.
   */
  static async decrypt(ciphertext: string): Promise<string> {
    if (!ciphertext.startsWith(LOCAL_PREFIX)) {
      throw new Error(
        "Decryption failed: Ciphertext is not in the correct format for local decryption.",
      );
    }

    try {
      const parts = ciphertext.substring(LOCAL_PREFIX.length).split(":");
      if (parts.length !== 3) {
        throw new Error("Invalid local ciphertext format");
      }

      const [ivHex, authTagHex, encryptedHex] = parts;
      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(authTagHex, "hex");
      const decipher = crypto.createDecipheriv(ALGORITHM, this.getMasterKey(), iv);

      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedHex, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (err) {
      throw new Error(`Local decryption failed: ${(err as Error).message}`);
    }
  }
}
