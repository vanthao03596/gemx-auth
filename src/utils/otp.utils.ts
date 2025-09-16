/**
 * Simple OTP generation utility following KISS principle
 */
import { randomInt } from 'crypto';

/**
 * Generate a 6-digit numeric OTP using cryptographically secure random generation
 * @returns 6-digit string (e.g., "123456")
 */
export function generateOtp(): string {
  return randomInt(100000, 1000000).toString();
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