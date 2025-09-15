import crypto from 'crypto';
import { redis } from '../config/redis';

interface OAuthStateData {
  timestamp: number;
  userId?: string | undefined;
  redirectUrl?: string | undefined;
}

export const generateOAuthState = async (userId?: string, redirectUrl?: string): Promise<string> => {
  const state = crypto.randomBytes(32).toString('hex');
  const stateData: OAuthStateData = {
    timestamp: Date.now(),
    userId: userId || undefined,
    redirectUrl: redirectUrl || undefined
  };

  // 10-minute expiration following existing Redis patterns
  await redis.setEx(`oauth:state:${state}`, 600, JSON.stringify(stateData));
  return state;
};

export const validateOAuthState = async (state: string): Promise<{ valid: boolean; userId?: string | undefined; redirectUrl?: string | undefined }> => {
  const stateData = await redis.get(`oauth:state:${state}`);

  if (!stateData) {
    return { valid: false };
  }

  // One-time use - delete immediately after validation
  await redis.del(`oauth:state:${state}`);

  const parsed: OAuthStateData = JSON.parse(stateData);
  return { valid: true, userId: parsed.userId, redirectUrl: parsed.redirectUrl };
};

// Twitter PKCE code verifier storage
export const storePKCECodeVerifier = async (state: string, codeVerifier: string): Promise<void> => {
  await redis.setEx(`twitter:pkce:${state}`, 600, codeVerifier);
};

export const retrievePKCECodeVerifier = async (state: string): Promise<string | null> => {
  const codeVerifier = await redis.get(`twitter:pkce:${state}`);

  if (codeVerifier) {
    // One-time use - delete immediately after retrieval
    await redis.del(`twitter:pkce:${state}`);
  }

  return codeVerifier;
};