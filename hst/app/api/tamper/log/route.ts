/*
 * ============================================================
 * FILE: app/api/tamper/log/route.ts
 * VERSION: 3.0 - FULLY FIXED
 * PURPOSE: Log tamper events to database
 * FIX: Accept both eventType (camelCase) and event_type (snake_case)
 * ============================================================
 */

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("[TAMPER] Received payload:", JSON.stringify(body));

    // Accept both camelCase and snake_case
    const event_type = body.event_type || body.eventType;
    const tamper_count = body.tamper_count || body.tamperCount;
    const user_id = body.user_id || body.userId;
    const device_id = body.device_id || body.deviceId;
    const details = body.details;

    // ============================================================
    // VALIDATION: event_type is required
    // ============================================================
    if (!event_type) {
      console.warn("[TAMPER] Missing event_type. Received:", Object.keys(body));
      return NextResponse.json(
        { 
          success: false, 
          error: "event_type (or eventType) is required",
          received_keys: Object.keys(body)
        },
        { status: 400 }
      );
    }

    // ============================================================
    // INSERT TAMPER EVENT INTO DATABASE
    // ============================================================
    console.log("[TAMPER] Logging event:", {
      device_id: device_id || null,
      event_type,
      tamper_count: tamper_count || null,
      user_id: user_id || null,
    });

    const { data, error } = await supabase
      .from("tamper_events")
      .insert({
        device_id: device_id || null,
        event_type: String(event_type).trim(),
        tamper_count: tamper_count ? Number(tamper_count) : null,
        user_id: user_id || null,
        details: details || null,
        timestamp: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("[TAMPER] Database error:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to log tamper event",
          details: error.message,
        },
        { status: 500 }
      );
    }

    console.log("[TAMPER] ✓ Event logged successfully:", event_type);

    return NextResponse.json({
      success: true,
      message: "Tamper event logged successfully",
      event_id: data.id,
      timestamp: data.timestamp,
      event_type,
      tamper_count,
      user_id,
    });

  } catch (error) {
    console.error("[TAMPER] Unexpected error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}