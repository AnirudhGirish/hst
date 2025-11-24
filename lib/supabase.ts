/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/supabase.ts
// Supabase client for server-side operations

import { createClient } from '@supabase/supabase-js'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
}

// Create Supabase client with service role key (server-side only)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Database types
export interface User {
  id: string
  user_id: string
  password_hash: string
  totp_secret: string
  created_at: string
  updated_at: string
  last_login: string | null
  is_active: boolean
}

export interface AuthLog {
  id: string
  user_id: string
  otp_used: string
  success: boolean
  ip_address: string | null
  user_agent: string | null
  error_message: string | null
  timestamp: string
  time_delta: number | null
}

export interface OTPConsumed {
  id: string
  user_id: string
  otp: string
  time_step: number
  consumed_at: string
}

export interface TamperEvent {
  id: string
  device_id: string | null
  event_type: string
  tamper_count: number | null
  user_id: string | null
  timestamp: string
  details: Record<string, any> | null
}