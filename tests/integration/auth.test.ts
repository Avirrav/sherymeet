import { SignatureService } from "../../src/app/backend/services/signature.service";
import { apiKeyEncryption } from "../../src/app/backend/services/keyencryption-service";
import { AuthorizationService } from "../../src/app/backend/services/authorization.service";
import { hmacSha256 } from "../../src/app/backend/utils/crypto-helper";
import { IApiClient, UserRole } from "../../src/app/backend/types/auth-types";

describe("Auth & Permission Pipeline Integration", () => {
  const mockApiKey = "sm_live_integration_test_key";
  const rawCurrentSecret = "sm_sec_current_secret_key_123";
  const rawPreviousSecret = "sm_sec_previous_secret_key_456";

  let encryptedCurrentSecret: string;
  let encryptedPreviousSecret: string;
  let mockClient: IApiClient;

  beforeAll(async () => {
    // Encrypt raw secrets using local KMS/GCM fallback
    encryptedCurrentSecret = await apiKeyEncryption.encrypt(rawCurrentSecret);
    encryptedPreviousSecret = await apiKeyEncryption.encrypt(rawPreviousSecret);

    mockClient = {
      apiKey: mockApiKey,
      currentSecret: encryptedCurrentSecret,
      previousSecret: encryptedPreviousSecret,
      currentSecretVersion: 2,
      previousSecretVersion: 1,
      status: "active",
      revoked: false,
      rateLimit: 100,
      burstLimit: 20,
      dailyLimit: 50000,
      allowedDomains: [],
    } as unknown as IApiClient;
  });

  describe("Signature Verification with Secret Rotation", () => {
    it("should successfully verify signatures signed with the current secret", async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = "nonce_current";
      const body = JSON.stringify({ roomName: "Test Room" });

      // Generate body hash and payload
      const bodyHash = SignatureService.computeBodyHash(body);
      const payload = SignatureService.constructPayload({
        method: "POST",
        host: "api.sherymeet.com",
        path: "/api/v1/meetings",
        query: "",
        timestamp,
        nonce,
        bodyHash,
      });

      // Sign payload with the raw plaintext CURRENT secret
      const signature = hmacSha256(rawCurrentSecret, payload);

      const result = await SignatureService.verifySignature({
        method: "POST",
        host: "api.sherymeet.com",
        path: "/api/v1/meetings",
        query: "",
        timestamp,
        nonce,
        body,
        signature,
        client: mockClient,
      });

      expect(result.verified).toBe(true);
      expect(result.matchedVersion).toBe("current");
    });

    it("should successfully verify signatures signed with the PREVIOUS secret (rotation window)", async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = "nonce_previous";
      const body = "";

      const bodyHash = SignatureService.computeBodyHash(body);
      const payload = SignatureService.constructPayload({
        method: "GET",
        host: "api.sherymeet.com",
        path: "/api/v1/recordings",
        query: "limit=10",
        timestamp,
        nonce,
        bodyHash,
      });

      // Sign payload with the raw plaintext PREVIOUS secret
      const signature = hmacSha256(rawPreviousSecret, payload);

      const result = await SignatureService.verifySignature({
        method: "GET",
        host: "api.sherymeet.com",
        path: "/api/v1/recordings",
        query: "limit=10",
        timestamp,
        nonce,
        body,
        signature,
        client: mockClient,
      });

      expect(result.verified).toBe(true);
      expect(result.matchedVersion).toBe("previous");
    });

    it("should reject signatures signed with invalid/old secrets", async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = "nonce_invalid";
      const body = "";

      const bodyHash = SignatureService.computeBodyHash(body);
      const payload = SignatureService.constructPayload({
        method: "GET",
        host: "api.sherymeet.com",
        path: "/api/v1/recordings",
        query: "limit=10",
        timestamp,
        nonce,
        bodyHash,
      });

      // Sign payload with an invalid secret
      const signature = hmacSha256("invalid_secret_key", payload);

      const result = await SignatureService.verifySignature({
        method: "GET",
        host: "api.sherymeet.com",
        path: "/api/v1/recordings",
        query: "limit=10",
        timestamp,
        nonce,
        body,
        signature,
        client: mockClient,
      });

      expect(result.verified).toBe(false);
      expect(result.matchedVersion).toBe("none");
    });
  });

  describe("RBAC Authorization Rules", () => {
    it("should allow SUPER_ADMIN to perform any action", async () => {
      const allowed = await AuthorizationService.checkPermission(
        UserRole.SUPER_ADMIN,
        "manageBilling",
      );
      expect(allowed).toBe(true);
    });

    it("should allow authorized roles", async () => {
      const allowed = await AuthorizationService.checkPermission(
        UserRole.ADMIN,
        "createMeeting",
      );
      expect(allowed).toBe(true);
    });

    it("should reject unauthorized roles", async () => {
      const allowed = await AuthorizationService.checkPermission(
        UserRole.SERVICE_ACCOUNT,
        "createMeeting",
      );
      expect(allowed).toBe(false);
    });

    it("should verify multiple permissions correctly", async () => {
      const allowedAll = await AuthorizationService.checkPermissions(UserRole.ADMIN, [
        "createMeeting",
        "startRecording",
      ]);
      const deniedSome = await AuthorizationService.checkPermissions(UserRole.ADMIN, [
        "createMeeting",
        "manageBilling",
      ]);

      expect(allowedAll).toBe(true);
      expect(deniedSome).toBe(false);
    });
  });
});
