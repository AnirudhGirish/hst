/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// FILE: app/api/auth/store/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL || "http://127.0.0.1:5000";

// Validate password hash format (should be "salt:hash")
function isValidPasswordHash(hash: string): boolean {
  if (!hash || typeof hash !== 'string') return false;
  const parts = hash.split(':');
  if (parts.length !== 2) return false;
  const [salt, hashValue] = parts;
  // Salt should be 32 hex chars (16 bytes), hash should be 128 hex chars (64 bytes)
  return salt.length === 32 && hashValue.length === 128;
}

export async function POST(request: Request) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { userid, passwordHash, totpSecret } = body;

    // Validation
    if (!userid || !passwordHash || !totpSecret) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required fields: userid, passwordHash, totpSecret",
        },
        { status: 400 }
      );
    }

    // Validate password hash format
    if (!isValidPasswordHash(passwordHash)) {
      console.error("[STORE] Invalid password hash format:", passwordHash);
      return NextResponse.json(
        {
          success: false,
          message: "Invalid password hash format. Expected format: salt:hash",
          error_code: "INVALID_HASH_FORMAT",
        },
        { status: 400 }
      );
    }

    // Validate TOTP secret (should be 40 hex characters)
    if (!/^[0-9a-f]{40}$/i.test(totpSecret)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid TOTP secret format",
          error_code: "INVALID_SECRET_FORMAT",
        },
        { status: 400 }
      );
    }

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("user_id")
      .eq("user_id", userid)
      .single();

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          message: "User ID already exists",
          error_code: "USER_EXISTS",
        },
        { status: 409 }
      );
    }

    // Store in database
    const { error: insertError } = await supabase
      .from("users")
      .insert({
        user_id: userid,
        password_hash: passwordHash,
        totp_secret: totpSecret,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("[STORE] Database insert error:", insertError);
      return NextResponse.json(
        {
          success: false,
          message: "Failed to store credentials in database",
          error_code: "DATABASE_ERROR",
          details: process.env.NODE_ENV === "development" ? insertError.message : undefined,
        },
        { status: 500 }
      );
    }

    console.log(`[STORE] ✓ User "${userid}" stored in database`);

    // Try to provision device via bridge
    let provisioningResult = {
      success: false,
      message: "Device provisioning not attempted",
      error: null as string | null,
    };

    try {
      const bridgeResponse = await fetch(`${BRIDGE_URL}/provision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userid,
          secret_hex: totpSecret,
        }),
      });

      if (bridgeResponse.ok) {
        const bridgeData = await bridgeResponse.json();
        provisioningResult = {
          success: true,
          message: bridgeData.message || "Device provisioned successfully",
          error: null,
        };
        console.log(`[STORE] ✓ Device provisioned for "${userid}"`);
      } else {
        const errorText = await bridgeResponse.text();
        provisioningResult = {
          success: false,
          message: "Bridge responded with error",
          error: errorText || `HTTP ${bridgeResponse.status}`,
        };
        console.warn(`[STORE] ⚠ Bridge error for "${userid}":`, errorText);
      }
    } catch (bridgeError: any) {
      provisioningResult = {
        success: false,
        message: "Bridge not available",
        error: bridgeError.message || "Connection failed",
      };
      console.warn(`[STORE] ⚠ Bridge connection failed for "${userid}":`, bridgeError.message);
    }

    // Prepare response
    const duration = Date.now() - startTime;
    const responseData: any = {
      success: true,
      message: "Credentials stored successfully",
      userid,
      stored_at: new Date().toISOString(),
      duration_ms: duration,
      database: {
        success: true,
        message: "Credentials saved to database",
      },
      device: provisioningResult,
    };

    // Add warning if device provisioning failed
    if (!provisioningResult.success) {
      responseData.warning = "Device provisioning failed, but credentials saved. You can retry provisioning from the setup page.";
    }

    return NextResponse.json(responseData, {
      status: provisioningResult.success ? 200 : 202, // 202 Accepted if partial
    });

  } catch (error) {
    console.error("[STORE] Unexpected error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        error_code: "INTERNAL_ERROR",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}