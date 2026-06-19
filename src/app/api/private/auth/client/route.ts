import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/app/backend/utils/db-connect";
import { ApiClientService } from "@/app/backend/services/api-client-service";
import { runMiddlewares } from "@/app/backend/middleware/run-middlewares";
import { requestIdMiddleware } from "@/app/backend/middleware/requestid-middleware";
import { authenticationMiddleware } from "@/app/backend/middleware/authentication-middleware";
import { authorizationMiddleware } from "@/app/backend/middleware/authorization-middleware";
import { rateLimitMiddleware } from "@/app/backend/middleware/rate-limit-middleware";
import { logger } from "@/app/backend/utils/logger";
import { AuthenticatedRequest } from "@/app/backend/interfaces/auth-interface";

/**
 * Registers a new API Client keypair.
 * POST /api/private/auth/client
 */
export async function createApiClientHandler(req: AuthenticatedRequest): Promise<Response> {
  try {
    await dbConnect();
    const body = await req.json();
    const { name, allowedDomains, allowedIps } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Missing name parameter" },
        { status: 400 },
      );
    }

    // Create API Client directly at root
    const result = await ApiClientService.createApiClient(
      name,
      allowedDomains || [],
      allowedIps || [],
    );

    return NextResponse.json(
      {
        message: "API client registered successfully",
        clientId: result.client._id,
        apiKey: result.client.apiKey,
        clientSecret: result.plaintextSecret, // plaintext client secret shown ONLY ONCE
        rateLimit: result.client.rateLimit,
        burstLimit: result.client.burstLimit,
        dailyLimit: result.client.dailyLimit,
      },
      { status: 201 },
    );
  } catch (err) {
    logger.error("Failed to create api client route", err, {
      requestId: req.requestId,
    });
    return NextResponse.json(
      { error: (err as Error).message || "Internal Server Error" },
      { status: 500 },
    );
  }
}

export const POST = runMiddlewares([
  requestIdMiddleware,
  authenticationMiddleware,
  authorizationMiddleware([]),
  rateLimitMiddleware,
], createApiClientHandler);