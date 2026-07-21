import { NextRequest } from "next/server";
import { getMeetDetails } from "@/app/backend/services/meet-services/get-meet-details";
import { ApiResponse, ApiError } from "@/app/backend/utils/api-helper";
import { runMiddlewares } from "@/app/backend/middleware/run-middlewares";
import { serverApiMiddleware } from "@/app/backend/middleware/server-api-middleware";

export async function getDetailsHandler(request: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    if (!roomId) {
      throw new ApiError("Room ID is required", 400);
    }
    const meet = await getMeetDetails({ roomId });
    return ApiResponse.success(meet);
  } catch (error) {
    if (error instanceof ApiError) {
      return ApiResponse.failure(error.message, error.statusCode, error.errors);
    }
    const err = error instanceof Error ? error : new Error(String(error));
    return ApiResponse.failure(err.message || "Failed to fetch meeting details", 500);
  }
}

export const GET = runMiddlewares(
  [
    serverApiMiddleware,
  ],
  getDetailsHandler
);
