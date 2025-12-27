import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { device_id, event_type, tamper_count, details } = await request.json();

    const { data, error } = await supabase
      .from("tamper_events")
      .insert({
        device_id: device_id || "esp32_001",
        event_type,
        tamper_count,
        details,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Tamper log error:", error);
    return NextResponse.json(
      { error: "Failed to log tamper event" },
      { status: 500 }
    );
  }
}