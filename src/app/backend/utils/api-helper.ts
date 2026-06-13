import { NextResponse } from "next/server";
import { ApiErrorDetail } from "@/app/backend/types/error-types";

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
