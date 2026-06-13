import { ROLE_PERMISSIONS } from "../constants/roles";
import { RoleHierarchy } from "../interfaces/user-interface";
import { UserRole, Permission } from "../types/auth-types";

export class AuthorizationService {
  /**
   * Evaluates if a given role has the required permission.
   * SUPER_ADMIN automatically bypasses all checks.
   */
  static async checkPermission(
    role: UserRole,
    requiredPermission: Permission,
  ): Promise<boolean> {
    if (RoleHierarchy[role] >= RoleHierarchy[UserRole.SUPER_ADMIN]) {
      return true;
    }
    const permissions = ROLE_PERMISSIONS[role] || [];
    return permissions.includes(requiredPermission);
  }

  /**
   * Evaluates if a given role has all the required permissions.
   * SUPER_ADMIN automatically bypasses all checks.
   */
  static async checkPermissions(
    role: UserRole,
    requiredPermissions: Permission[],
  ): Promise<boolean> {
    if (RoleHierarchy[role] >= RoleHierarchy[UserRole.SUPER_ADMIN]) {
      return true;
    }
    if (requiredPermissions.length === 0) {
      return false;
    }
    const permissions = ROLE_PERMISSIONS[role] || [];
    return requiredPermissions.every((p) => permissions.includes(p));
  }
}
