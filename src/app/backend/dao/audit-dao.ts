import { dbConnect } from "../utils/db-connect";
import AuditLog from "../models/audit-log-model";
import ApiKeyUsageLog from "../models/api-key-usage-log-model";
import { IAuditLog } from "../types/auth-types";

export class AuditDao {
  static async createAuditLog(data: Partial<IAuditLog>): Promise<IAuditLog> {
    await dbConnect();
    const log = new AuditLog(data);
    return await log.save();
  }

  static async getAuditLogsByApiKey(
    apiKey: string,
    limit = 100,
  ): Promise<IAuditLog[]> {
    await dbConnect();
    return await AuditLog.find({ apiKey }).sort({ timestamp: -1 }).limit(limit);
  }

  /**
   * Increments the daily request and error counters for a given API key.
   */
  static async incrementApiKeyUsage(
    apiKey: string,
    isError = false,
  ): Promise<void> {
    await dbConnect();
    const today = new Date().toISOString().split("T")[0]; // Format: YYYY-MM-DD

    const updateQuery = {
      $inc: {
        requestCount: 1,
        ...(isError ? { errorCount: 1 } : {}),
      },
      $set: {
        lastUsedAt: new Date(),
      },
    };

    await ApiKeyUsageLog.findOneAndUpdate(
      { apiKey, date: today },
      updateQuery,
      { upsert: true, new: true },
    );
  }
}
