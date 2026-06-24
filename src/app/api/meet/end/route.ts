import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/app/backend/utils/db-connect";
import ApiClient from "@/app/backend/models/api-client-model";
import { SecretCacheService } from "@/app/backend/services/secret-cache-service";
import { SignatureService } from "@/app/backend/services/signature.service";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { roomId } = await request.json();
    if (!roomId) {
      return NextResponse.json({ error: "Room ID is required" }, { status: 400 });
    }

    await dbConnect();
    const client = await ApiClient.findOne({ status: "active", revoked: false });
    if (!client) {
      return NextResponse.json({ error: "No active API Client found in database" }, { status: 500 });
    }

    // Decrypt client secret using KMS/Master key cached service
    const plaintextSecret = await SecretCacheService.getDecryptedSecret(
      client.apiKey,
      "current",
      client.currentSecret
    );

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString("hex");
    const requestId = "main_" + crypto.randomBytes(8).toString("hex");

    const method = "POST";
    const path = "/api/v1/client/meet/end-meet";
    const requestPayload = {
      roomId,
      host: {
        userName: "System Signer",
        role: "mentor"
      }
    };
    
    // Generate canonical body hash
    const bodyHash = SignatureService.computeBodyHash(JSON.stringify(requestPayload));

    // Get origin & host context
    const origin = request.nextUrl.origin;
    const host = request.nextUrl.host;

    // Build signature payload
    const payload = SignatureService.constructPayload({
      method,
      host,
      path,
      query: "",
      timestamp,
      nonce,
      bodyHash,
      origin: origin || undefined,
    });

    // Compute HMAC signature
    const signature = crypto
      .createHmac("sha256", plaintextSecret)
      .update(payload, "utf8")
      .digest("hex");

    const targetUrl = `${origin}${path}`;

    // Send HTTP POST request with full cryptographic HMAC headers
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": requestId,
        "x-api-key": client.apiKey,
        "x-timestamp": timestamp,
        "x-nonce": nonce,
        "x-signature-version": "v1",
        "x-signature": signature,
        "origin": origin,
      },
      body: JSON.stringify(requestPayload),
    });

    const responseData = await response.json();
    return NextResponse.json(responseData, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Failed to route signed end-meet request" },
      { status: 500 }
    );
  }
}
