import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/server/utils/db-connect";

/**
 * GET /api/health
 * Readiness probe for load balancers and Docker HEALTHCHECK. Returns 200
 * when the app can reach MongoDB, 503 otherwise (nearly every route needs
 * the database, so "up but no DB" should not receive traffic).
 */
export async function GET() {
  try {
    await dbConnect();
    const dbState = mongoose.connection.readyState; // 1 = connected
    if (dbState !== 1) {
      return NextResponse.json(
        { status: "unhealthy", db: "disconnected" },
        { status: 503 },
      );
    }
    return NextResponse.json({
      status: "ok",
      db: "connected",
      uptime: Math.round(process.uptime()),
    });
  } catch {
    return NextResponse.json(
      { status: "unhealthy", db: "unreachable" },
      { status: 503 },
    );
  }
}
