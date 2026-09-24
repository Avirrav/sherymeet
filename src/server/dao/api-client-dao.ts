import { dbConnect } from "../utils/db-connect";
import ApiClient from "../models/api-client-model";
import RevokedApiKey from "../models/revoked-api-key-model";
import { IApiClient } from "../types/auth.types";
import { QueryFilter, QuerySelect, QuerySort } from "../types/dao.types";

export class ApiClientDao {
  static async createApiClient(clientData: Partial<IApiClient>): Promise<IApiClient> {
    await dbConnect();
    const client = new ApiClient(clientData);
    return await client.save();
  }

  /**
   * Retrieves a single API client matching the given filter.
   */
  static async getApiClient(
    filter: QueryFilter<IApiClient>,
    select?: QuerySelect,
  ): Promise<IApiClient | null> {
    await dbConnect();
    let query = ApiClient.findOne(filter);
    if (select) {
      query = query.select(select);
    }
    return await query;
  }

  /**
   * Retrieves multiple API clients matching the given filter.
   */
  static async getApiClients(
    filter: QueryFilter<IApiClient>,
    options?: { select?: QuerySelect; sort?: QuerySort<IApiClient>; limit?: number },
  ): Promise<IApiClient[]> {
    await dbConnect();
    let query = ApiClient.find(filter);
    if (options?.select) {
      query = query.select(options.select);
    }
    if (options?.sort) {
      query = query.sort(options.sort);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    return await query;
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

  static async revokeApiClient(apiKey: string, reason?: string): Promise<boolean> {
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
