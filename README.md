# Hardware Secure Tokeniser (HST)

Hardware-based TOTP authentication system with ESP32.

## Setup

1. Create user account
2. Provision hardware token
3. Authenticate with OTP

## Environment Variables

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_BRIDGE_URL=http://127.0.0.1:5000
```

## Run Locally
```bash
npm install
npm run dev
```

Open http://localhost:3000

## Deploy

Deploy to Vercel and add environment variables.

## Requirements

- Supabase database
- Python bridge server running
- ESP32 hardware token

# Created by Anirudh Girish
## Contact for details or feedback `anirudhgirish08@gmail.cvom`