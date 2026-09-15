import { updateParticipantAccess } from "@/server/services/livekit/update-participant-access";
import { runMiddlewares } from "@/server/middleware/run-middlewares";
import { serverApiMiddleware } from "@/server/middleware/server-api-middleware";
import { ipRateLimitMiddleware } from "@/server/middleware/ip-rate-limit-middleware";
import { requestIdMiddleware } from "@/server/middleware/requestid-middleware";
import { AuthenticatedRequest } from "@/server/types/auth.types";

export async function microphoneHandler(request: AuthenticatedRequest) {
  return updateParticipantAccess(request, "microphone");
}
export const POST = runMiddlewares(
  [requestIdMiddleware, ipRateLimitMiddleware, serverApiMiddleware],
  microphoneHandler,
);
