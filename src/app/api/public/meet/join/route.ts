import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ message: "Public join endpoint is not implemented yet" }, { status: 501 });
}
