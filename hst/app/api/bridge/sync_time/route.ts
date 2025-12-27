// ============================================================
// FILE: app/api/bridge/sync_time/route.ts
// PURPOSE: Synchronize time with device
// ============================================================

import { NextResponse } from "next/server";

const BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL || "http://127.0.0.1:5000";

export async function POST() {
  try {
    const response = await fetch(`${BRIDGE_URL}/sync_time`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timestamp: Math.floor(Date.now() / 1000),
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to sync time" },
        { status: 500 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Time sync error:", error);
    return NextResponse.json(
      { error: "Failed to connect to bridge" },
      { status: 500 }
    );
  }
}