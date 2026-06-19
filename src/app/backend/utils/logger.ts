type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Default log level from environment or 'info'
const CURRENT_LOG_LEVEL = (process.env.LOG_LEVEL?.toLowerCase() as LogLevel) || 
  (process.env.NODE_ENV === "production" ? "info" : "debug");

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

    const logOutput = `${timestamp} ${levelTag}${requestIdStr}: ${message}${metadataStr}${errorStack}`;

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
