// lib/totp.ts
// RFC 6238 TOTP Implementation for Node.js

import crypto from 'crypto';

export interface TOTPConfig {
  timeStep?: number;      // Default: 30 seconds
  digits?: number;        // Default: 6 digits
  algorithm?: string;     // Default: 'sha1'
  window?: number;        // Time window tolerance (±1 step = ±30s)
}

const DEFAULT_CONFIG: Required<TOTPConfig> = {
  timeStep: 30,
  digits: 6,
  algorithm: 'sha1',
  window: 1,
};

/**
 * Generate TOTP for a given secret and time
 */
export function generateTOTP(
  secret: Buffer,
  unixTime: number = Math.floor(Date.now() / 1000),
  config: TOTPConfig = {}
): string {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Calculate time step
  const timeStep = Math.floor(unixTime / cfg.timeStep);
  
  // Convert time step to 8-byte buffer (big-endian)
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigUInt64BE(BigInt(timeStep));
  
  // Compute HMAC
  const hmac = crypto.createHmac(cfg.algorithm, secret);
  hmac.update(timeBuffer);
  const hash = hmac.digest();
  
  // Dynamic truncation (RFC 6238)
  const offset = hash[hash.length - 1] & 0x0f;
  const truncatedHash =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);
  
  // Generate OTP
  const otp = truncatedHash % Math.pow(10, cfg.digits);
  
  // Pad with leading zeros
  return otp.toString().padStart(cfg.digits, '0');
}

/**
 * Verify TOTP with time window tolerance
 */
export function verifyTOTP(
  otp: string,
  secret: Buffer,
  unixTime: number = Math.floor(Date.now() / 1000),
  config: TOTPConfig = {}
): { valid: boolean; delta: number } {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Check current time step
  const currentOTP = generateTOTP(secret, unixTime, cfg);
  if (otp === currentOTP) {
    return { valid: true, delta: 0 };
  }
  
  // Check time window (past and future)
  for (let i = 1; i <= cfg.window; i++) {
    // Check past
    const pastTime = unixTime - i * cfg.timeStep;
    const pastOTP = generateTOTP(secret, pastTime, cfg);
    if (otp === pastOTP) {
      return { valid: true, delta: -i };
    }
    
    // Check future
    const futureTime = unixTime + i * cfg.timeStep;
    const futureOTP = generateTOTP(secret, futureTime, cfg);
    if (otp === futureOTP) {
      return { valid: true, delta: i };
    }
  }
  
  return { valid: false, delta: 0 };
}

/**
 * Generate a random TOTP secret
 */
export function generateSecret(length: number = 20): Buffer {
  return crypto.randomBytes(length);
}

/**
 * Convert hex string to Buffer
 */
export function hexToBuffer(hex: string): Buffer {
  return Buffer.from(hex, 'hex');
}

/**
 * Convert Buffer to hex string
 */
export function bufferToHex(buffer: Buffer): string {
  return buffer.toString('hex');
}

/**
 * Get current Unix timestamp
 */
export function getCurrentUnixTime(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Calculate remaining seconds in current time step
 */
export function getRemainingSeconds(config: TOTPConfig = {}): number {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const currentTime = Math.floor(Date.now() / 1000);
  const elapsed = currentTime % cfg.timeStep;
  return cfg.timeStep - elapsed;
}

/**
 * Generate QR code URL for TOTP provisioning
 */
export function generateQRCodeURL(
  userid: string,
  secret: Buffer,
  issuer: string = 'HardwareSecureTokeniser'
): string {
  const secretBase32 = bufferToBase32(secret);
  const label = `${issuer}:${userid}`;
  const otpauthUrl = `otpauth://totp/${encodeURIComponent(label)}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}`;
  
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`;
}

/**
 * Base32 encoding for QR codes (RFC 4648)
 */
function bufferToBase32(buffer: Buffer): string {
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    
    while (bits >= 5) {
      output += base32Chars[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  
  if (bits > 0) {
    output += base32Chars[(value << (5 - bits)) & 31];
  }
  
  return output;
}

/**
 * Hash password with salt
 */
export function hashPassword(password: string, salt?: string): string {
  const saltToUse = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, saltToUse, 100000, 64, 'sha512').toString('hex');
  return `${saltToUse}:${hash}`;
}

/**
 * Verify password against hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}