/* eslint-disable @typescript-eslint/no-unused-vars */
/*
 * ============================================================
 * FILE: app/api/bridge/verify/route.ts
 * VERSION: 2.0 PRODUCTION
 * STATUS: ALL ISSUES FIXED (#1, #2, #3)
 * ============================================================
 */

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyTOTP, verifyPassword, hexToBuffer, getCurrentUnixTime } from "@/lib/totp";

export async function POST(request: Request) {
  const startTime = Date.now();
  
  try {
    const { userid, password, otp } = await request.json();

    // ============================================================
    // VALIDATION: Check required fields
    // ============================================================
    if (!userid || !password || !otp) {
      await logAuthAttempt(userid, otp, false, "Missing required fields", null);
      return NextResponse.json(
        {
          success: false,
          message: "Missing required fields: userid, password, otp",
        },
        { status: 400 }
      );
    }

    // ============================================================
    // VALIDATION: Check OTP format
    // ============================================================
    if (!/^\d{6}$/.test(otp)) {
      await logAuthAttempt(userid, otp, false, "Invalid OTP format", null);
      return NextResponse.json(
        {
          success: false,
          message: "Invalid OTP format. Must be 6 digits.",
        },
        { status: 400 }
      );
    }

    // ============================================================
    // STEP 1: FETCH USER FROM SUPABASE (Issue #3 Fix)
    // ============================================================
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("user_id, password_hash, totp_secret, is_active")
      .eq("user_id", userid)
      .single();

    if (userError || !user) {
      console.warn(`[AUTH] User not found: ${userid}`);
      await logAuthAttempt(userid, otp, false, "User not found", null);
      return NextResponse.json(
        {
          success: false,
          message: "Invalid credentials",
        },
        { status: 401 }
      );
    }

    // ============================================================
    // VALIDATION: Check if user is active
    // ============================================================
    if (!user.is_active) {
      console.warn(`[AUTH] User inactive: ${userid}`);
      await logAuthAttempt(userid, otp, false, "User inactive", null);
      return NextResponse.json(
        {
          success: false,
          message: "Account is inactive",
        },
        { status: 403 }
      );
    }

    // ============================================================
    // STEP 2: VERIFY PASSWORD (Issue #3 Fix)
    // ============================================================
    const passwordValid = verifyPassword(password, user.password_hash);
    
    if (!passwordValid) {
      console.warn(`[AUTH] Invalid password: ${userid}`);
      await logAuthAttempt(userid, otp, false, "Invalid password", null);
      return NextResponse.json(
        {
          success: false,
          message: "Invalid credentials",
        },
        { status: 401 }
      );
    }

    // ============================================================
    // STEP 3: CHECK FOR REPLAY ATTACK (Issue #2 Fix)
    // ============================================================
    const { data: consumedOTP, error: checkError } = await supabase
      .from("otp_consumed")
      .select("id, consumed_at")
      .eq("user_id", userid)
      .eq("otp", otp)
      .single();

    if (!checkError && consumedOTP) {
      const consumedTime = new Date(consumedOTP.consumed_at).getTime();
      const timeSinceConsumption = (Date.now() - consumedTime) / 1000;
      
      console.warn(
        `[AUTH] OTP replay attempt: ${userid}, consumed ${timeSinceConsumption}s ago`
      );
      
      await logAuthAttempt(
        userid,
        otp,
        false,
        `OTP already consumed ${Math.round(timeSinceConsumption)}s ago`,
        null
      );
      
      return NextResponse.json(
        {
          success: false,
          message: "OTP has already been used",
          error_code: "OTP_ALREADY_CONSUMED",
        },
        { status: 410 }
      );
    }

    // ============================================================
    // STEP 4: VERIFY TOTP (Issue #1 Fix)
    // ============================================================
    const totpSecretBuffer = hexToBuffer(user.totp_secret);
    const currentUnixTime = getCurrentUnixTime();
    
    const { valid: otpValid, delta: timeDelta } = verifyTOTP(
      otp,
      totpSecretBuffer,
      currentUnixTime,
      { timeStep: 30, digits: 6, window: 1 }
    );

    if (!otpValid) {
      console.warn(`[AUTH] Invalid TOTP: ${userid}, OTP: ${otp}`);
      await logAuthAttempt(userid, otp, false, "Invalid TOTP", null);
      return NextResponse.json(
        {
          success: false,
          message: "Invalid OTP",
          error_code: "INVALID_OTP",
        },
        { status: 401 }
      );
    }

    // ============================================================
    // STEP 5: MARK OTP AS CONSUMED (Issue #2 Fix)
    // ============================================================
    const timeStep = Math.floor(currentUnixTime / 30);
    
    const { error: consumeError } = await supabase
      .from("otp_consumed")
      .insert({
        user_id: userid,
        otp,
        time_step: timeStep,
        consumed_at: new Date().toISOString(),
      });

    if (consumeError) {
      console.error(
        `[AUTH] Failed to mark OTP as consumed: ${userid}`,
        consumeError
      );
    }

    // ============================================================
    // STEP 6: UPDATE USER LAST LOGIN
    // ============================================================
    await supabase
      .from("users")
      .update({
        last_login: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userid);

    // ============================================================
    // SUCCESS: AUTHENTICATION SUCCESSFUL
    // ============================================================
    const duration = Date.now() - startTime;
    console.log(
      `[AUTH] ✓ Authentication successful: ${userid} (${duration}ms, time_delta: ${timeDelta})`
    );

    await logAuthAttempt(userid, otp, true, null, timeDelta);

    return NextResponse.json({
      success: true,
      message: "Authentication successful",
      userid,
      timestamp: new Date().toISOString(),
      time_delta: timeDelta,
      duration_ms: duration,
    });
  } catch (error) {
    console.error("[AUTH] Unexpected error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        error_code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}

// ============================================================
// HELPER: Log authentication attempt to database
// ============================================================
async function logAuthAttempt(
  userid: string | null,
  otpUsed: string | null,
  success: boolean,
  errorMessage: string | null,
  timeDelta: number | null
) {
  try {
    const userAgent = typeof window !== "undefined" ? navigator.userAgent : null;
    
    await supabase.from("auth_logs").insert({
      user_id: userid,
      otp_used: otpUsed,
      success,
      error_message: errorMessage,
      time_delta: timeDelta,
      ip_address: null,
      user_agent: userAgent,
      timestamp: new Date().toISOString(),
    });
  } catch (logError) {
    console.error("[AUTH] Failed to log attempt:", logError);
  }
}