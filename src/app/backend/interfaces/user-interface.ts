export enum UserRole {
  BLOCKED = "blocked",
  DELETED = "deleted",
  STUDENT = "student",
  MENTOR = "mentor",
  ADMIN = "admin",
  SUPER_ADMIN = "super_admin",
  SERVICE_ACCOUNT = "service_account",
}

export interface IUser {
    _id: string;
    userName: string;
    role:UserRole;
    email:string;
}
export interface IParticipant {
    participantName:string;
    role:UserRole;
}
export const RoleHierarchy = {
  [UserRole.BLOCKED]: -2,
  [UserRole.DELETED]: -1,
  [UserRole.STUDENT]: 1,
  [UserRole.SERVICE_ACCOUNT]: 0,
  [UserRole.MENTOR]: 2,
  [UserRole.ADMIN]: 3,
  [UserRole.SUPER_ADMIN]: 4
} as const;


