import { dbConnect } from "../utils/db-connect";
import AuditLog from "../models/audit-log-model";
import ApiKeyUsageLog from "../models/api-key-usage-log-model";
import { IAuditLog } from "../types/auth.types";
import { QueryFilter, QuerySelect, QuerySort } from "../types/dao.types";

export class AuditDao {
  static async createAuditLog(data: Partial<IAuditLog>): Promise<IAuditLog> {
    await dbConnect();
    const log = new AuditLog(data);
    return await log.save();
  }

  /**
   * Retrieves audit logs matching the given filter.
   */
  static async getAuditLogs(
    filter: QueryFilter<IAuditLog>,
    options?: { select?: QuerySelect; sort?: QuerySort<IAuditLog>; limit?: number },
  ): Promise<IAuditLog[]> {
    await dbConnect();
    let query = AuditLog.find(filter);
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

  /**
   * Increments the daily request and error counters for a given API key.
   */
  static async incrementApiKeyUsage(apiKey: string, isError = false): Promise<void> {
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

    await ApiKeyUsageLog.findOneAndUpdate({ apiKey, date: today }, updateQuery, {
      upsert: true,
      returnDocument: "after",
    });
  }
}
