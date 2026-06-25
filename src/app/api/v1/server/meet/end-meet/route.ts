import { NextRequest, NextResponse } from "next/server";
import { MeetDao } from "@/app/backend/dao/meet-dao";
import { endMeet } from "@/app/backend/services/meet-services/end-meet";
import { serverApiMiddleware } from "@/app/backend/middleware/server-api-middleware";
import { runMiddlewares } from "@/app/backend/middleware/run-middlewares";

export async function endMeetHandler(request: NextRequest) {
  try {
    const { roomId, localParticipant } = await request.json();
    if (!roomId) {
      return NextResponse.json({ error: "Room ID is required" }, { status: 400 });
    }
    if (!localParticipant || !localParticipant.username) {
      return NextResponse.json({ error: "Local participant identity context is required" }, { status: 400 });
    }
    // 1. Fetch meeting from database
    const meet = await MeetDao.getMeetByRoomId(roomId);
    if (!meet) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }
    // 2. Validate that the requesting user is the host who created the meeting
    const isHost = meet.host.username === localParticipant.username;
    if (!isHost) {
      return NextResponse.json({ error: "Unauthorized: Only the host can end the meeting" }, { status: 403 });
    }
    // 3. End the meeting, stop any active recordings, and clean up the LiveKit room
    const updatedMeet = await endMeet({ roomId });
    return NextResponse.json({ success: true, meet: updatedMeet }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Failed to end meeting" },
      { status: 500 }
    );
  }
}
export const POST = runMiddlewares(
  [
   serverApiMiddleware
  ],
  endMeetHandler,
); 