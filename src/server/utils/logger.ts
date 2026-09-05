import { config } from "./config";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Default log level from environment or 'info'
const CURRENT_LOG_LEVEL = (config.LOG_LEVEL as LogLevel) ||
  (config.NODE_ENV === "production" ? "info" : "debug");

// Production emits one JSON object per line so log aggregators can parse
// fields; development keeps the human-readable format. LOG_FORMAT overrides.
const USE_JSON_LOGS =
  config.LOG_FORMAT === "json" ||
  (config.LOG_FORMAT !== "pretty" && config.NODE_ENV === "production");

interface LogContext {
  requestId?: string;
  [key: string]: unknown;
}

class Logger {
  private getLevelValue(level: LogLevel): number {
    return LOG_LEVELS[level] ?? 1;
  }

  private shouldLog(level: LogLevel): boolean {
    const currentVal = this.getLevelValue(CURRENT_LOG_LEVEL);
    const targetVal = this.getLevelValue(level);
    return targetVal >= currentVal;
  }

  /**
   * Formats the log message and outputs to the console.
   */
  private logMessage(
    level: LogLevel,
    message: string,
    context?: LogContext | Error | unknown,
    error?: Error
  ) {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const levelTag = `[${level.toUpperCase()}]`;
    
    let requestIdStr = "";
    let metadataStr = "";
    let errorStack = "";

    // Extract requestId and compile metadata
    if (context && typeof context === "object") {
      // If context is an Error object
      if (context instanceof Error) {
        errorStack = `\n${context.stack || context.message}`;
      } else {
        const ctx = context as LogContext;
        
        const reqObj = ctx.req as Record<string, unknown> | undefined;
        const requestObj = ctx.request as Record<string, unknown> | undefined;

        // Extract requestId from context if present
        if (ctx.requestId) {
          requestIdStr = ` [${ctx.requestId}]`;
        } else if (reqObj && typeof reqObj === "object" && typeof reqObj.requestId === "string") {
          requestIdStr = ` [${reqObj.requestId}]`;
        } else if (requestObj && typeof requestObj === "object" && typeof requestObj.requestId === "string") {
          requestIdStr = ` [${requestObj.requestId}]`;
        }

        // Clean out internal request references from logging metadata to keep logs clean
        const cleanContext = { ...ctx };
        delete cleanContext.requestId;
        delete cleanContext.req;
        delete cleanContext.request;

        if (Object.keys(cleanContext).length > 0) {
          metadataStr = ` | Context: ${JSON.stringify(cleanContext)}`;
        }
      }
    }

    if (error instanceof Error) {
      errorStack = `\n${error.stack || error.message}`;
    }

    let logOutput: string;
    if (USE_JSON_LOGS) {
      const entry: Record<string, unknown> = { timestamp, level, message };
      const requestId = requestIdStr.replace(/^\s*\[|\]$/g, "");
      if (requestId) entry.requestId = requestId;
      if (metadataStr) {
        try {
          entry.context = JSON.parse(metadataStr.replace(" | Context: ", ""));
        } catch {
          entry.context = metadataStr;
        }
      }
      if (errorStack) entry.error = errorStack.trim();
      logOutput = JSON.stringify(entry);
    } else {
      logOutput = `${timestamp} ${levelTag}${requestIdStr}: ${message}${metadataStr}${errorStack}`;
    }

    // Write to standard streams based on severity
    if (level === "error") {
      console.error(logOutput);
    } else if (level === "warn") {
      console.warn(logOutput);
    } else {
      console.log(logOutput);
    }
  }

  public debug(message: string, context?: LogContext | unknown) {
    this.logMessage("debug", message, context);
  }

  public info(message: string, context?: LogContext | unknown) {
    this.logMessage("info", message, context);
  }

  public warn(message: string, context?: LogContext | unknown) {
    this.logMessage("warn", message, context);
  }

  public error(message: string, error?: Error | unknown, context?: LogContext) {
    const errObj = error instanceof Error ? error : undefined;
    const ctxObj = context || (error && !(error instanceof Error) ? error as LogContext : undefined);
    this.logMessage("error", message, ctxObj || errObj, errObj);
  }
}

export const logger = new Logger();
