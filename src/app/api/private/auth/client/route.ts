import { NextResponse } from "next/server";
import { dbConnect } from "@/app/backend/utils/db-connect";
import { ApiClientService } from "@/app/backend/services/api-client-service";
import { runMiddlewares } from "@/app/backend/middleware/run-middlewares";
import { userAuthenticationMiddleware } from "@/app/backend/middleware/user-authentication-middleware";
import { logger } from "@/app/backend/utils/logger";
import { AuthenticatedRequest } from "@/app/backend/interfaces/auth-interface";

/**
 * Lists the API clients created by the logged-in platform user.
 * GET /api/private/auth/client
 */
export async function listApiClientsHandler(req: AuthenticatedRequest): Promise<Response> {
  try {
    await dbConnect();

    if (!req.user) {
      return NextResponse.json(
        { error: "Unauthorized: You must be logged in to perform this action" },
        { status: 401 },
      );
    }

    const clients = await ApiClientService.listClientsForUser(req.user._id);
    return NextResponse.json({
      clients: clients.map((client) => ({
        id: client._id.toString(),
        name: client.name,
        apiKey: client.apiKey,
        status: client.status,
        allowRecording: client.allowRecording,
        rateLimit: client.rateLimit,
        burstLimit: client.burstLimit,
        dailyLimit: client.dailyLimit,
        createdByName: client.createdByName,
        createdByAvatarUrl: client.createdByAvatarUrl,
        createdAt: client.createdAt,
      })),
    });
  } catch (err) {
    logger.error("Failed to list api clients route", err, {
      requestId: req.requestId,
    });
    return NextResponse.json(
      { error: (err as Error).message || "Internal Server Error" },
      { status: 500 },
    );
  }
}

/**
 * Registers a new API Client keypair.
 * POST /api/private/auth/client
 */
export async function createApiClientHandler(req: AuthenticatedRequest): Promise<Response> {
  try {
    await dbConnect();
    const body = await req.json();
    const { name, allowedDomains, allowRecording } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Missing name parameter" },
        { status: 400 },
      );
    }

    if (!req.user) {
      return NextResponse.json(
        { error: "Unauthorized: You must be logged in to perform this action" },
        { status: 401 },
      );
    }
    const {_id,userName,avatarUrl} = req.user;
    console.log("\n\n_id",_id)
    console.log("\n\nuserName",userName)
    console.log("\n\navatarUrl",avatarUrl)
    // Create API Client directly at root
    const result = await ApiClientService.createApiClient(
      name,
      allowedDomains || [],
      { id: _id, name: userName, avatarUrl: avatarUrl },
      !!allowRecording,
    );
    console.log("result from createApiClientHandler", result)
    return NextResponse.json(
      {
        message: "API client registered successfully",
        clientId: result.client._id,
        apiKey: result.client.apiKey,
        clientSecret: result.plaintextSecret, // plaintext client secret shown ONLY ONCE
        allowRecording: result.client.allowRecording,
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

export const GET = runMiddlewares([
  userAuthenticationMiddleware,
], listApiClientsHandler);

export const POST = runMiddlewares([
  userAuthenticationMiddleware,
], createApiClientHandler);