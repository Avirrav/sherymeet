import { NextResponse } from "next/server";
import {
  AuthenticatedRequest,
  NextMiddleware,
  Permission,
  UserRole,
} from "../types/auth-types";
import { AuthorizationService } from "../services/authorization.service";

/**
 * Authorization Middleware Factory.
 * Enforces Role-Based Access Control (RBAC) permissions.
 */
export function authorizationMiddleware(requiredPermissions: Permission[]) {
  return async (
    request: AuthenticatedRequest,
    next: NextMiddleware,
  ): Promise<Response> => {
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
