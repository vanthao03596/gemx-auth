import crypto from 'crypto';
import { env } from '../config/env';

export interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string | undefined;
  username?: string | undefined;
  photo_url?: string | undefined;
  auth_date: number;
  hash: string;
}

/**
 * Validates Telegram authentication data by verifying the hash
 * according to Telegram's authentication specification
 * @see https://core.telegram.org/widgets/login#checking-authorization
 */
export const validateTelegramAuth = (authData: TelegramAuthData): boolean => {
  const { hash, ...data } = authData;

  // Create data-check-string by sorting keys and joining with newlines
  const dataCheckString = Object.keys(data)
    .sort()
    .map((key) => `${key}=${data[key as keyof typeof data]}`)
    .join('\n');

  // Create secret key from bot token
  const secretKey = crypto
    .createHash('sha256')
    .update(env.TELEGRAM_BOT_TOKEN)
    .digest();

  // Calculate HMAC-SHA256 hash
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  // Compare hashes
  return calculatedHash === hash;
};

/**
 * Checks if Telegram auth data is still valid (not expired)
 * Telegram recommends checking that auth_date is recent
 * @param authDate Unix timestamp from Telegram
 * @param maxAgeSeconds Maximum age in seconds (default: 1 hour)
 */
export const isTelegramAuthRecent = (
  authDate: string,
  maxAgeSeconds: number = 3600
): boolean => {
  const authTimestamp = parseInt(authDate, 10);
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const age = currentTimestamp - authTimestamp;

  return age <= maxAgeSeconds;
};
