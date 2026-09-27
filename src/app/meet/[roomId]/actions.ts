interface VerifyTokenParams {
  roomId: string;
  token: string;
  password?: string;
}

export enum StatusType {
  Scheduled = "scheduled",
  Active = "active",
  Ended = "ended",
}

export enum ConferenceRoomType {
  Webinar = "webinar",
  Meeting = "meet",
}

interface PublicMeetDetails {
  roomId: string;
  roomCode: string;
  status: StatusType;
  type: ConferenceRoomType;
  isRecording: boolean;
  isTranscription: boolean;
  hasPasscode: boolean;
  startedAt: Date | null;
  endedAt: Date | null;
}

interface VerifyTokenResponse {
  success: boolean;
  message?: string;
  data?: {
    token?: string;
    meet?: PublicMeetDetails;
    meetStatus?: StatusType;
    roomAdmin?: boolean;
  };
}

interface MeetingDetailsResponse {
  success: boolean;
  data?: {
    status?: StatusType;
  };
}

interface StartMeetingResponse {
  success: boolean;
  message?: string;
}

interface EndMeetingResponse {
  success: boolean;
  message?: string;
}

export async function verifyMeetingToken({
  roomId,
  token,
  password,
}: VerifyTokenParams): Promise<VerifyTokenResponse> {
  const res = await fetch(`/api/server/${roomId}/verify-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId, token, password: password || undefined }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    return { success: false, message: error.message || `Request failed with status ${res.status}` };
  }
  return res.json();
}

export async function getMeetingDetails(
  roomId: string,
  token: string,
): Promise<MeetingDetailsResponse> {
  const res = await fetch(`/api/server/${roomId}/details`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return { success: false };
  }
  return res.json();
}

export async function startMeeting(roomId: string, token: string): Promise<StartMeetingResponse> {
  const res = await fetch(`/api/server/${roomId}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId, token }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    return { success: false, message: error.message || `Request failed with status ${res.status}` };
  }
  return res.json();
}

export async function endMeeting(roomId: string, token: string): Promise<EndMeetingResponse> {
  const res = await fetch(`/api/server/${roomId}/end`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId, token }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    return { success: false, message: error.message || `Request failed with status ${res.status}` };
  }
  return res.json();
}
