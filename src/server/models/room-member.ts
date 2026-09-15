import mongoose, { Schema } from "mongoose";
import { ParticipantRole } from "@/types/roles";

export interface RoomMemberRecord {
  roomId: string;
  identity: string;
  name: string;
  email?: string;
  role: ParticipantRole;
  lockUntil: Date;
}
const schema = new Schema<RoomMemberRecord>(
  {
    roomId: { type: String, required: true },
    identity: { type: String, required: true },
    name: { type: String, required: true },
    email: String,
    role: { type: String, enum: Object.values(ParticipantRole), required: true },
    lockUntil: { type: Date, default: () => new Date(0) },
  },
  { timestamps: true },
);
schema.index({ roomId: 1, identity: 1 }, { unique: true });
schema.index({ roomId: 1, email: 1 });
export const RoomMember =
  (mongoose.models.RoomMember as mongoose.Model<RoomMemberRecord>) ||
  mongoose.model<RoomMemberRecord>("RoomMember", schema);
