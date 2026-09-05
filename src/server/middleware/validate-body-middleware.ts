import { NextResponse } from "next/server";
import { ZodType } from "zod";
import { AppMiddleware, AuthenticatedRequest, NextMiddleware } from "../types/auth.types";

export function validateBodyMiddleware(schema: ZodType): AppMiddleware {
  return async (
    request: AuthenticatedRequest,
    next: NextMiddleware,
  ): Promise<Response> => {
    let data: unknown;
    try {
      if (request.rawBody) {
        const text = request.rawBody.toString("utf8");
        data = text ? JSON.parse(text) : {};
      } else {
        data = await request.json();
      }
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 },
      );
    }

    const result = schema.safeParse(data);
    if (!result.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          errors: result.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    request.validatedBody = result.data;
    return await next();
  };
}
