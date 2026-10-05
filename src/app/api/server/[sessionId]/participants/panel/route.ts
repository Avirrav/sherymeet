import { updateParticipantAccess } from "@/server/services/livekit/update-participant-access";
import { runMiddlewares } from "@/server/middleware/run-middlewares";
import { ipRateLimitMiddleware } from "@/server/middleware/ip-rate-limit-middleware";
import { requestIdMiddleware } from "@/server/middleware/requestid-middleware";
import { AuthenticatedRequest } from "@/server/types/auth.types";

export async function panelHandler(request: AuthenticatedRequest) {
  return updateParticipantAccess(request, "panel");
}
export const POST = runMiddlewares([requestIdMiddleware, ipRateLimitMiddleware], panelHandler);
