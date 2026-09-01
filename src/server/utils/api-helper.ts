import { NextResponse } from "next/server";
import { ApiErrorDetail } from "@/server/types/error-types";
import { logger } from "./logger";

/**
 * Standard API Error class extending native Error.
 * Follows the strict ApiErrorResponse interface.
 */
export class ApiError extends Error {
  public statusCode: number;
  public success: boolean;
  public errors: ApiErrorDetail[];
  public data: null;

  constructor(
    message: string,
    statusCode: number = 500,
    errors: ApiErrorDetail[] = [],
    stack?: string,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.success = false;
    this.errors = errors;
    this.data = null;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Standard API Response class extending NextResponse.
 * Follows the strict ApiResponseType<T> format.
 */
export class ApiResponse extends NextResponse {
  /**
   * Returns a standard success response with success: true and data payload.
   */
  static success<T>(
    data: T,
    message: string = "Success",
    statusCode: number = 200,
  ) {
    return NextResponse.json(
      {
        statusCode,
        data,
        message,
        success: true,
      },
      { status: statusCode },
    );
  }

  /**
   * Returns a standard error response with success: false, data: null, and error list.
   */
  /**
   * Standard catch-block responder: ApiErrors pass through with their status
   * and message; anything else is logged server-side and returned as the
   * generic fallback so internal error details never reach the client.
   */
  static fromError(error: unknown, fallbackMessage: string) {
    if (error instanceof ApiError) {
      return ApiResponse.failure(error.message, error.statusCode, error.errors);
    }
    logger.error(fallbackMessage, error);
    return ApiResponse.failure(fallbackMessage, 500);
  }

  static failure(
    message: string,
    statusCode: number = 500,
    errors: ApiErrorDetail[] = [],
  ) {
    return NextResponse.json(
      {
        statusCode,
        message,
        errors,
        success: false,
        data: null,
      },
      { status: statusCode },
    );
  }
}
