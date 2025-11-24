// FILE: app/api/auth/verify/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL || "http://127.0.0.1:5000";

// Generate TOTP code from secret
function generateTOTP(secret: string, timeStep: number): string {
  const secretBuffer = Buffer.from(secret, "hex");
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigUInt64BE(BigInt(timeStep));

  const hmac = crypto.createHmac("sha1", secretBuffer);
  hmac.update(timeBuffer);
  const hash = hmac.digest();

  const offset = hash[19] & 0x0f;
  const truncatedHash =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = (truncatedHash % 1000000).toString().padStart(6, "0");
  return otp;
}

// Get current time step (30-second window)
function getCurrentTimeStep(): number {
  return Math.floor(Date.now() / 1000 / 30);
}

export async function POST(request: Request) {
  try {
    const { userid, otp } = await request.json();

    // Validation - NO PASSWORD REQUIRED
    if (!userid || !otp) {
      return NextResponse.json(
        { success: false, message: "User ID and OTP required" },
        { status: 400 }
      );
    }

    // Get user from database
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("user_id", userid)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    // Check if OTP has already been consumed
    const { data: consumedOTP } = await supabase
      .from("otp_consumed")
      .select("*")
      .eq("user_id", userid)
      .eq("otp", otp)
      .single();

    if (consumedOTP) {
      // Log the failed attempt
      await supabase.from("auth_logs").insert({
        user_id: userid,
        success: false,
        error_message: "OTP already used (replay attack prevented)",
        ip_address: request.headers.get("x-forwarded-for") || "unknown",
        user_agent: request.headers.get("user-agent") || "unknown",
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json(
        {
          success: false,
          message: "OTP already used. Generate new OTP on device.",
          error_code: "OTP_ALREADY_CONSUMED",
        },
        { status: 410 } // 410 Gone - resource consumed
      );
    }

    // Verify OTP against TOTP secret
    // Check current window and 2 previous windows (90 seconds total)
    const currentTimeStep = getCurrentTimeStep();
    const validOTPs = [
      generateTOTP(user.totp_secret, currentTimeStep),      // Current window (0-30s)
      generateTOTP(user.totp_secret, currentTimeStep - 1),  // Previous window (30-60s)
      generateTOTP(user.totp_secret, currentTimeStep - 2),  // 2 windows ago (60-90s)
    ];

    console.log("[VERIFY] Debug info:");
    console.log("  - Current time step:", currentTimeStep);
    console.log("  - User:", userid);
    console.log("  - Received OTP:", otp);
    console.log("  - Valid OTPs:", validOTPs);

    const isValid = validOTPs.includes(otp);

    if (!isValid) {
      // Log failed authentication
      await supabase.from("auth_logs").insert({
        user_id: userid,
        success: false,
        error_message: `Invalid OTP. Expected one of: ${validOTPs.join(", ")}`,
        ip_address: request.headers.get("x-forwarded-for") || "unknown",
        user_agent: request.headers.get("user-agent") || "unknown",
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json(
        { success: false, message: "Invalid OTP" },
        { status: 401 }
      );
    }

    // OTP is valid - Mark as consumed to prevent replay
    const { error: consumeError } = await supabase
      .from("otp_consumed")
      .insert({
        user_id: userid,
        otp: otp,
        time_step: currentTimeStep,
        consumed_at: new Date().toISOString(),
      });

    if (consumeError) {
      console.error("Failed to mark OTP as consumed:", consumeError);
    }

    // Log successful authentication
    await supabase.from("auth_logs").insert({
      user_id: userid,
      success: true,
      error_message: null,
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
      user_agent: request.headers.get("user-agent") || "unknown",
      timestamp: new Date().toISOString(),
    });

    // Update last login
    await supabase
      .from("users")
      .update({ last_login: new Date().toISOString() })
      .eq("user_id", userid);

    // Send OTP_CONSUMED command to device to turn off LED
    try {
      const bridgeRes = await fetch(`${BRIDGE_URL}/device`, { method: "GET" });
      if (bridgeRes.ok) {
        // Bridge is available, send consumed command
        await fetch(`${BRIDGE_URL}/flush`, { method: "POST" });
      }
    } catch (bridgeError) {
      console.warn("Failed to communicate with bridge:", bridgeError);
    }

    return NextResponse.json({
      success: true,
      message: "Authentication successful",
      userid,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Verification error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}