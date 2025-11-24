import { NextResponse } from "next/server";

const BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL || "http://127.0.0.1:5000";

export async function GET() {
  try {
    const response = await fetch(`${BRIDGE_URL}/tamper`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to get tamper status" },
        { status: 500 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Tamper status error:", error);
    return NextResponse.json(
      { error: "Failed to connect to bridge" },
      { status: 500 }
    );
  }
}