import { dbConnect } from "../utils/db-connect";
import User from "../models/user-model";
import { IUserDocument } from "../interfaces/user-interface";

export class UserDao {
  static async createUser(
    userData: Partial<IUserDocument>,
  ): Promise<IUserDocument> {
    await dbConnect();
    const user = new User(userData);
    return await user.save();
  }

  static async getUserByGoogleId(
    googleId: string,
  ): Promise<IUserDocument | null> {
    await dbConnect();
    return await User.findOne({ googleId });
  }

  static async getUserByEmail(email: string): Promise<IUserDocument | null> {
    await dbConnect();
    return await User.findOne({ email: email.toLowerCase() });
  }

  static async getUserById(id: string): Promise<IUserDocument | null> {
    await dbConnect();
    return await User.findById(id);
  }

  static async updateUser(
    id: string,
    updateData: Partial<IUserDocument>,
  ): Promise<IUserDocument | null> {
    await dbConnect();
    return await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { returnDocument: "after", runValidators: true },
    );
  }
}
