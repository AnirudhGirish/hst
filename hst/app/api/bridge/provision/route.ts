/*
 * ============================================================
 * FILE: app/api/bridge/provision/route.ts
 * VERSION: 2.0 PRODUCTION
 * STATUS: ISSUE #4 FIXED
 * ============================================================
 */

import { NextResponse } from "next/server";

const BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL || "http://127.0.0.1:5000";

export async function POST(request: Request) {
  try {
    // ============================================================
    // PARSE REQUEST
    // ============================================================
    const { userid, secret } = await request.json();

    if (!userid || !secret) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: userid, secret",
        },
        { status: 400 }
      );
    }

    // ============================================================
    // VALIDATE SECRET FORMAT (should be hex string)
    // ============================================================
    if (!/^[a-f0-9]{40}$/i.test(secret)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid secret format. Expected 40-character hex string (20 bytes).",
          expected_format: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
          actual_length: secret.length,
        },
        { status: 400 }
      );
    }

    // ============================================================
    // SEND TO BRIDGE WITH CORRECT PARAMETERS (Issue #4 Fix)
    // ============================================================
    console.log(`[PROVISION] Sending to bridge: user_id=${userid}, secret_length=${secret.length}`);

    const bridgePayload = {
      user_id: userid,        // ✅ FIXED: Was missing before
      secret_hex: secret,     // ✅ FIXED: Was called just 'secret' before
    };

    console.log(`[PROVISION] Bridge payload:`, bridgePayload);

    const response = await fetch(`${BRIDGE_URL}/provision`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bridgePayload),
    });

    // ============================================================
    // HANDLE BRIDGE RESPONSE
    // ============================================================
    if (!response.ok) {
      console.error(
        `[PROVISION] Bridge returned error: ${response.status}`,
        await response.text()
      );
      
      return NextResponse.json(
        {
          success: false,
          error: "Failed to provision device via bridge",
          bridge_status: response.status,
        },
        { status: response.status }
      );
    }

    const bridgeData = await response.json();

    console.log(`[PROVISION] ✓ Device provisioned successfully`);

    return NextResponse.json({
      success: true,
      message: "Device provisioned successfully",
      userid,
      provisioned_at: new Date().toISOString(),
      bridge_response: bridgeData,
    });

  } catch (error) {
    console.error("[PROVISION] Error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Check if it's a network error (bridge not running)
    if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("fetch")) {
      return NextResponse.json(
        {
          success: false,
          error: "Bridge server not accessible",
          hint: "Ensure Python bridge is running on http://127.0.0.1:5000",
          details: errorMessage,
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to provision device",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}