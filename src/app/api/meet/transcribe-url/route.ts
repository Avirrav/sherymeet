import { NextRequest } from "next/server";
import aws4 from "aws4";
import { ApiError, ApiResponse } from "@/app/backend/utils/api-helper";

export async function GET(request: NextRequest) {
  try {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const sessionToken = process.env.AWS_SESSION_TOKEN;
    const region = process.env.AWS_REGION || "us-east-1";

    if (!accessKeyId || !secretAccessKey) {
      throw new ApiError(
        "AWS credentials (AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY) are not configured on the server.",
        500,
      );
    }

    const host = `transcribestreaming.${region}.amazonaws.com:8443`;
    const path = "/stream-transcription-websocket";

    // Automatic language identification query parameters:
    // we use identify-multiple-languages=true to transcribe a mix of English and Hindi (Hinglish).
    const queryParams = [
      "X-Amz-Expires=300",
      //'identify-multiple-languages=true',
      //'language-options=en-US,hi-IN',
      "language-code=hi-IN",
      "media-encoding=pcm",
      "sample-rate=16000",
    ].join("&");

    const opts = {
      host,
      path: `${path}?${queryParams}`,
      service: "transcribe",
      region,
      method: "GET",
      signQuery: true, // Generate SigV4 parameters in the query string
    };

    // Sign the options
    aws4.sign(opts, {
      accessKeyId,
      secretAccessKey,
      sessionToken,
    });

    // The signed URL with all auth parameters is constructed here
    const signedUrl = `wss://${opts.host}${opts.path}`;

    return ApiResponse.success({
      url: signedUrl,
    });
  } catch (unknownErr) {
    if (unknownErr instanceof ApiError) {
      console.error("Failed to sign transcribe URL:", unknownErr.message);
      return ApiResponse.failure(
        unknownErr.message,
        unknownErr.statusCode,
        unknownErr.errors,
      );
    }
    const err =
      unknownErr instanceof Error ? unknownErr : new Error(String(unknownErr));
    console.error("Failed to sign transcribe URL:", err);
    return ApiResponse.failure(
      err.message || "Failed to generate signed URL",
      500,
    );
  }
}
