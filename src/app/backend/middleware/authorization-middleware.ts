import { NextResponse } from "next/server";
import {
  AuthenticatedRequest,
  NextMiddleware,
  Permission,
  UserRole,
} from "../types/auth-types";
import { AuthorizationService } from "../services/authorization.service";
import { logger } from "../utils/logger";

/**
 * Authorization Middleware Factory.
 * Enforces Role-Based Access Control (RBAC) permissions.
 */
export function authorizationMiddleware(requiredPermissions: Permission[]) {
  return async (
    request: AuthenticatedRequest,
    next: NextMiddleware,
  ): Promise<Response> => {
    // Extract user/host context from body if not already present on the request
    if (!request.user) {
      try {
        const clone = request.clone();
        const bodyText = await clone.text();
        if (bodyText.trim()) {
          const parsedBody = JSON.parse(bodyText);
          const userContext = parsedBody.user || parsedBody.host;
          if (userContext) {
            request.user = userContext;
          }
        }
      } catch (e) {
        logger.error("Failed to parse request body for authorization context", e, {
          requestId: request.requestId,
        });
      }
    }

    // 1. Resolve Role
    // Default to 'SERVICE_ACCOUNT' for direct API Client access if no user context is attached
    const role: UserRole = request.user ? request.user.role : UserRole.SERVICE_ACCOUNT;
    // 2. Verify Permissions
    const isAuthorized = await AuthorizationService.checkPermissions(
      role,
      requiredPermissions,
    );
    if (!isAuthorized) {
      return NextResponse.json(
        {
          error: `Forbidden: Insufficient permissions. Required: [${requiredPermissions.join(
            ", ",
          )}]. Role: ${role}`,
        },
        { status: 403 },
      );
    }
    return await next();
  };
}
