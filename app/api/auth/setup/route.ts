import { NextResponse } from "next/server";
import crypto from "crypto";


function generateSecret(): string {
  return crypto.randomBytes(20).toString("hex");
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function generateQRCodeURL(userid: string, secret: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    `otpauth://totp/HST:${userid}?secret=${secret}&issuer=HST`
  )}`;
}

export async function POST(request: Request) {
  try {
    const { userid, password } = await request.json();

    if (!userid || !password) {
      return NextResponse.json(
        { error: "userid and password required" },
        { status: 400 }
      );
    }

    const totpSecret = generateSecret();
    const passwordHash = hashPassword(password);
    const qrCodeUrl = generateQRCodeURL(userid, totpSecret);

    return NextResponse.json({
      success: true,
      userid,
      passwordHash,
      totpSecret,
      qrCodeUrl,
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}