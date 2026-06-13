import { AuditDao } from "../dao/audit-dao";
import { IAuditLog } from "../types/auth-types";

export class AuditService {
  /**
   * Logs a security audit event and updates the usage statistics for the associated API key.
   */
  static async logEvent(
    logData: Partial<IAuditLog>,
  ): Promise<IAuditLog | null> {
    try {
      const log = await AuditDao.createAuditLog(logData);

      // If an API key is present, update usage statistics
      if (logData.apiKey) {
        const isError = logData.status !== undefined && logData.status >= 400;
        await AuditDao.incrementApiKeyUsage(logData.apiKey, isError);
      }

      return log;
    } catch (err) {
      // Log errors locally, but prevent audit log writing failures from blocking client API responses
      console.error("Failed to save audit log:", err);
      return null;
    }
  }

  /**
   * Retrieves security audit logs for a given API key.
   */
  static async getLogsForApiKey(
    apiKey: string,
    limit = 50,
  ): Promise<IAuditLog[]> {
    return await AuditDao.getAuditLogsByApiKey(apiKey, limit);
  }
}
