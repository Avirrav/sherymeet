import mongoose, { Schema } from "mongoose";
import { ParticipantRole } from "@/types/roles";

export interface RoomMemberRecord {
  roomId: string;
  identity: string;
  name: string;
  email?: string;
  role: ParticipantRole;
  microphoneAllowed?: boolean;
  lockUntil: Date;
}
const schema = new Schema<RoomMemberRecord>(
  {
    roomId: { type: String, required: true },
    identity: { type: String, required: true },
    name: { type: String, required: true },
    email: String,
    microphoneAllowed: { type: Boolean, default: false },
    role: { type: String, enum: Object.values(ParticipantRole), required: true },
    lockUntil: { type: Date, default: () => new Date(0) },
  },
  { timestamps: true },
);
schema.index({ roomId: 1, identity: 1 }, { unique: true });
schema.index({ roomId: 1, email: 1 });
// Replace a development model compiled before the microphone permission existed.
if (
  process.env.NODE_ENV === "development" &&
  mongoose.models.RoomMember &&
  !mongoose.models.RoomMember.schema.path("microphoneAllowed")
) {
  delete mongoose.models.RoomMember;
}
export const RoomMember =
  (mongoose.models.RoomMember as mongoose.Model<RoomMemberRecord>) ||
  mongoose.model<RoomMemberRecord>("RoomMember", schema);
