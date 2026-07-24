import crypto from "crypto";
import { ApiClientDao } from "../dao/api-client-dao";
import { apiKeyEncryption } from "./keyencryption-service";
import { IApiClient } from "../interfaces/auth-interface";

export class ApiClientService {
  /**
   * Registers a new API Client.
   * Generates a secure API key and secret, encrypts the secret, and saves the client.
   * Returns the database client document and the unencrypted plaintext secret (only returned ONCE).
   */
  static async createApiClient(
    name: string,
    allowedDomains: string[] = [],
    creator?: { id: string; name?: string; avatarUrl?: string },
    allowRecording: boolean = false,
  ): Promise<{ client: IApiClient; plaintextSecret: string }> {
    const apiKey = `sm_live_${crypto.randomBytes(16).toString("hex")}`;
    const plaintextSecret = `sm_sec_${crypto.randomBytes(32).toString("base64url")}`;
    // Encrypt secret using KMS/GCM
    const encryptedSecret = await apiKeyEncryption.encrypt(plaintextSecret);
    const clientDoc = await ApiClientDao.createApiClient({
      name,
      apiKey,
      currentSecret: encryptedSecret,
      currentSecretVersion: 1,
      allowedDomains,
      allowRecording,
      status: "active",
      revoked: false,
      createdBy: creator?.id,
      createdByName: creator?.name,
      createdByAvatarUrl: creator?.avatarUrl,
    });
    return {
      client: clientDoc,
      plaintextSecret,
    };
  }

  /**
   * Lists the API clients created by a given platform user (dashboard self-service).
   */
  static async listClientsForUser(userId: string): Promise<IApiClient[]> {
    return await ApiClientDao.getApiClientsByCreatedBy(userId);
  }
  /**
   * Performs client secret rotation.
   * Moves the currentSecret to previousSecret and generates a new currentSecret.
   */
  static async rotateSecret(
    apiKey: string,
  ): Promise<{ client: IApiClient; newPlaintextSecret: string } | null> {
    const client = await ApiClientDao.getApiClientByApiKey(apiKey);
    if (!client || client.revoked) return null;
    const newPlaintextSecret = `sm_sec_${crypto.randomBytes(32).toString("base64url")}`;
    const newEncryptedSecret = await apiKeyEncryption.encrypt(newPlaintextSecret);
    const updateData: Partial<IApiClient> = {
      previousSecret: client.currentSecret,
      previousSecretVersion: client.currentSecretVersion,
      currentSecret: newEncryptedSecret,
      currentSecretVersion: client.currentSecretVersion + 1,
    };
    const updatedClient = await ApiClientDao.updateApiClient(
      client._id.toString(),
      updateData,
    );
    if (!updatedClient) return null;
    return {
      client: updatedClient,
      newPlaintextSecret,
    };
  }
  /**
   * Retrieves an API client by their API key.
   */
  static async getClientByApiKey(apiKey: string): Promise<IApiClient | null> {
    return await ApiClientDao.getApiClientByApiKey(apiKey);
  }

  /**
   * Revokes an API client key immediately.
   */
  static async revokeClient(apiKey: string, reason?: string): Promise<boolean> {
    return await ApiClientDao.revokeApiClient(apiKey, reason);
  }
}
