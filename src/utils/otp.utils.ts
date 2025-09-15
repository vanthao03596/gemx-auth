/**
 * Simple OTP generation utility following KISS principle
 */

/**
 * Generate a 6-digit numeric OTP
 * @returns 6-digit string (e.g., "123456")
 */
export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Check if OTP has expired
 * @param expiresAt OTP expiration timestamp
 * @returns true if expired, false otherwise
 */
export function isOtpExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * Create OTP expiration timestamp (10 minutes from now)
 * @returns Date object 10 minutes from current time
 */
export function createOtpExpiration(): Date {
  return new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
}