import { TokenVerifier } from "livekit-server-sdk";
import { ApiError } from "@/app/backend/utils/api-helper";
import { IParticipant } from "@/app/backend/interfaces/user-interface";

const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;

export interface VerifiedRoomToken {
  participant: IParticipant | null;
  roomAdmin: boolean;
}

/**
 * Verifies a LiveKit access token's signature/expiry, confirms it grants
 * access to the given room, and reports the native roomAdmin grant
 * (true for co-host/host, set by generateToken()) alongside the app's
 * own participant metadata.
 */
export async function verifyRoomToken(token: string, roomId: string): Promise<VerifiedRoomToken> {
  if (!apiKey || !apiSecret) {
    throw new ApiError("LiveKit credentials are not configured", 500);
  }

  let claims;
  try {
    claims = await new TokenVerifier(apiKey, apiSecret).verify(token);
  } catch {
    throw new ApiError("Invalid or expired token", 401);
  }

  if (claims.video?.room !== roomId) {
    throw new ApiError("Token does not grant access to this room", 401);
  }

  let participant: IParticipant | null = null;
  try {
    const metadata = claims.metadata ? JSON.parse(claims.metadata) : null;
    participant = metadata?.participant ?? null;
  } catch {
    participant = null;
  }

  return {
    participant,
    roomAdmin: claims.video?.roomAdmin === true,
  };
}
