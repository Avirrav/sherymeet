import { UserDao } from "../dao/user-dao";
import { IUserDocument, UserRole } from "../interfaces/user-interface";

export interface GoogleProfile {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export class UserService {
  /**
   * Finds an existing user by Google account ID, or creates a new one on first login.
   * Updates profile details and lastLoginAt on every sign-in.
   */
  static async findOrCreateFromGoogleProfile(
    profile: GoogleProfile,
  ): Promise<IUserDocument> {
    const existing = await UserDao.getUserByGoogleId(profile.sub);
    if (existing) {
      const updated = await UserDao.updateUser(existing._id.toString(), {
        userName: profile.name || existing.userName,
        avatarUrl: profile.picture || existing.avatarUrl,
        lastLoginAt: new Date(),
      });
      return updated || existing;
    }

    return await UserDao.createUser({
      googleId: profile.sub,
      email: profile.email,
      userName: profile.name || profile.email,
      avatarUrl: profile.picture,
      role: UserRole.SERVICE_ACCOUNT,
      status: "active",
      lastLoginAt: new Date(),
    });
  }

  static async getUserById(id: string): Promise<IUserDocument | null> {
    return await UserDao.getUserById(id);
  }
}
