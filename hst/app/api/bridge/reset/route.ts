import { NextResponse } from "next/server";

const BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL || "http://127.0.0.1:5000";
const ADMIN_PIN = process.env.ADMIN_PIN || "123456";

export async function POST(request: Request) {
  try {
    const { pin } = await request.json();

    if (pin !== ADMIN_PIN) {
      return NextResponse.json(
        { error: "Invalid admin PIN" },
        { status: 403 }
      );
    }

    const response = await fetch(`${BRIDGE_URL}/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to reset device" },
        { status: 500 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Reset error:", error);
    return NextResponse.json(
      { error: "Failed to connect to bridge" },
      { status: 500 }
    );
  }
}