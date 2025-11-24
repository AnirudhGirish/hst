import { NextResponse } from "next/server";

const BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL || "http://127.0.0.1:5000";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const consume = searchParams.get("consume") || "false";

    const response = await fetch(`${BRIDGE_URL}/otp?consume=${consume}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("OTP fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch OTP from bridge" },
      { status: 500 }
    );
  }
}