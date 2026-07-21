import { NextResponse } from "next/server";
import { dbConnect } from "@/app/backend/utils/db-connect";
import { ApiClientService } from "@/app/backend/services/api-client-service";
import { runMiddlewares } from "@/app/backend/middleware/run-middlewares";
import { userAuthenticationMiddleware } from "@/app/backend/middleware/user-authentication-middleware";
import { logger } from "@/app/backend/utils/logger";
import { AuthenticatedRequest } from "@/app/backend/interfaces/auth-interface";

/**
 * Rotates client secret for an API client.
 * POST /api/private/auth/client/rotate
 */
export async function rotateApiClientHandler(req: AuthenticatedRequest): Promise<Response> {
  try {
    await dbConnect();
    const body = await req.json();
    const { apiKey } = body;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing apiKey parameter" },
        { status: 400 },
      );
    }

    if (!req.user) {
      return NextResponse.json(
        { error: "Unauthorized: You must be logged in to perform this action" },
        { status: 401 },
      );
    }

    const existingClient = await ApiClientService.getClientByApiKey(apiKey);
    if (!existingClient) {
      return NextResponse.json(
        { error: "Client not found or client is revoked" },
        { status: 404 },
      );
    }
    if (existingClient.createdBy && existingClient.createdBy.toString() !== req.user._id) {
      return NextResponse.json(
        { error: "You do not have permission to rotate this API key" },
        { status: 403 },
      );
    }

    const result = await ApiClientService.rotateSecret(apiKey);
    if (!result) {
      return NextResponse.json(
        { error: "Client not found or client is revoked" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        message: "API client secret rotated successfully",
        apiKey: result.client.apiKey,
        clientSecret: result.newPlaintextSecret, // new plaintext client secret shown ONLY ONCE
        currentSecretVersion: result.client.currentSecretVersion,
        previousSecretVersion: result.client.previousSecretVersion,
      },
      { status: 200 },
    );
  } catch (err) {
    logger.error("Failed to rotate client secret route", err, {
      requestId: req.requestId,
    });
    return NextResponse.json(
      { error: (err as Error).message || "Internal Server Error" },
      { status: 500 },
    );
  }
}

export const POST = runMiddlewares([
  userAuthenticationMiddleware,
], rotateApiClientHandler);
