import { NextResponse } from "next/server";

const BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL || "http://127.0.0.1:5000";

export async function GET() {
  try {
    const response = await fetch(`${BRIDGE_URL}/device`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Device not connected" },
        { status: 503 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Bridge connection error:", error);
    return NextResponse.json(
      { error: "Failed to connect to bridge server" },
      { status: 503 }
    );
  }
}