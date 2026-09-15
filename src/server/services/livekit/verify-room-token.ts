import { TokenVerifier } from "livekit-server-sdk";
import { ApiError } from "@/server/utils/api-helper";
import { config } from "@/server/utils/config";

export interface VerifiedRoomToken {
  roomAdmin: boolean;
  identity: string;
  claims: Awaited<ReturnType<TokenVerifier["verify"]>>;
}
export async function verifyRoomToken(token: string, roomId: string): Promise<VerifiedRoomToken> {
  let claims;
  try {
    claims = await new TokenVerifier(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET).verify(
      token,
      0,
    );
  } catch {
    throw new ApiError("Invalid or expired token", 401);
  }
  if (!claims.exp || claims.exp <= Date.now() / 1000)
    throw new ApiError("Invalid or expired token", 401);
  if (!claims.sub || claims.video?.roomJoin !== true || claims.video?.room !== roomId) {
    throw new ApiError("Token does not grant access to this room", 401);
  }
  return {
    roomAdmin: claims.video?.roomAdmin === true,
    identity: claims.sub,
    claims,
  };
}
