import { auditMiddleware } from "@/app/backend/middleware/audit-middleware";
import { rateLimitMiddleware } from "@/app/backend/middleware/rate-limit-middleware";
import { runMiddlewares } from "@/app/backend/middleware/run-middlewares";
import { NextResponse } from "next/server";
import { AuthenticatedRequest } from "@/app/backend/interfaces/auth-interface";

export async function healthCheckHandler(_request: AuthenticatedRequest): Promise<Response> {
  return NextResponse.json({ message: "Public join endpoint is not implemented yet" }, { status: 501 });
}
  
export const POST = runMiddlewares([
   auditMiddleware,
   rateLimitMiddleware,
], healthCheckHandler);