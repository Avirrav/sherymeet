import { dbConnect } from "../utils/db-connect";
import ApiClient from "../models/api-client-model";
import RevokedApiKey from "../models/revoked-api-key-model";
import { IApiClient } from "../interfaces/auth-interface";

export class ApiClientDao {
  static async createApiClient(
    clientData: Partial<IApiClient>,
  ): Promise<IApiClient> {
    await dbConnect();
    const client = new ApiClient(clientData);
    return await client.save();
  }

  static async getApiClientByApiKey(
    apiKey: string,
  ): Promise<IApiClient | null> {
    await dbConnect();
    return await ApiClient.findOne({ apiKey });
  }

  static async updateApiClient(
    id: string,
    updateData: Partial<IApiClient>,
  ): Promise<IApiClient | null> {
    await dbConnect();
    return await ApiClient.findByIdAndUpdate(
      id,
      { $set: updateData },
      { returnDocument: "after", runValidators: true },
    );
  }

  static async revokeApiClient(
    apiKey: string,
    reason?: string,
  ): Promise<boolean> {
    await dbConnect();

    // Mark in ApiClient model
    const client = await ApiClient.findOneAndUpdate(
      { apiKey },
      { $set: { revoked: true, revokedAt: new Date() } },
      { returnDocument: "after" },
    );

    if (!client) return false;

    // Add to revoked_api_keys collection for fast caching
    await RevokedApiKey.findOneAndUpdate(
      { apiKey },
      { $setOnInsert: { apiKey, reason, revokedAt: new Date() } },
      { upsert: true },
    );

    return true;
  }

  static async isApiKeyRevoked(apiKey: string): Promise<boolean> {
    await dbConnect();
    const revoked = await RevokedApiKey.findOne({ apiKey });
    return !!revoked;
  }
}
