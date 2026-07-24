import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const LOCAL_PREFIX = "local:";
// Development-only fallback. Production refuses to run without a real key
// (also enforced at boot by validateEnv in instrumentation.ts).
const DEV_MASTER_KEY_FALLBACK = "sherymeet_default_32byte_masterkey!";

export class apiKeyEncryption {
  private static getMasterKey(): Buffer {
    let keyStr = process.env.ENCRYPTION_MASTER_KEY;
    if (!keyStr) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("ENCRYPTION_MASTER_KEY must be set in production");
      }
      keyStr = DEV_MASTER_KEY_FALLBACK;
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
      const decipher = crypto.createDecipheriv(
        ALGORITHM,
        this.getMasterKey(),
        iv,
      );

      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedHex, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (err) {
      throw new Error(`Local decryption failed: ${(err as Error).message}`);
    }
  }
}
