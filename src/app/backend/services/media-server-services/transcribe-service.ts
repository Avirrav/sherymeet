import aws4 from "aws4";

export async function getTranscribeUrl(): Promise<string> {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;
  const region = process.env.AWS_REGION || "us-east-1";

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "AWS credentials (AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY) are not configured on the server."
    );
  }

  const host = `transcribestreaming.${region}.amazonaws.com:8443`;
  const path = "/stream-transcription-websocket";

  // Automatic language identification query parameters
  const queryParams = [
    "X-Amz-Expires=300",
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

  // Return the signed URL with all auth parameters
  return `wss://${opts.host}${opts.path}`;
}
