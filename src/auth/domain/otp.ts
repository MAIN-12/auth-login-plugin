import crypto from 'crypto'

/**
 * Generates a cryptographically secure 6-digit OTP code.
 */
export function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString()
}

/**
 * Hashes an OTP code with SHA-256 for secure storage.
 */
export function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex')
}

/**
 * Constant-time comparison of an OTP against its hash.
 * Uses crypto.timingSafeEqual to prevent timing attacks.
 */
export function verifyOtp(otp: string, hashedOtp: string): boolean {
  const inputHash = hashOtp(otp)

  if (inputHash.length !== hashedOtp.length) {
    return false
  }

  try {
    return crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(hashedOtp))
  } catch {
    return false
  }
}

/**
 * Returns expiry date (default: 10 minutes from now).
 */
export function getOtpExpiry(minutes = 10): Date {
  return new Date(Date.now() + minutes * 60 * 1000)
}

/**
 * Checks if an OTP has expired.
 */
export function isOtpExpired(expiryDate: Date | string): boolean {
  const expiry = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate
  return new Date() > expiry
}

/**
 * Max OTP verification attempts before code is invalidated.
 */
export function getMaxOtpAttempts(): number {
  return parseInt(process.env.OTP_MAX_ATTEMPTS || '3', 10)
}