import * as jose from 'jose';
import { env } from '../config/env';

export interface JwtPayload {
  userId: number;
  email: string;
  iat?: number;
  exp?: number;
}

export interface JWK {
  kty: 'RSA';
  use: 'sig';
  alg: 'RS256';
  kid: string;
  n: string;
  e: string;
}

export const generateToken = async (payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> => {
  // Decode base64 PEM key
  const privateKeyPem = Buffer.from(env.JWT_PRIVATE_KEY_PEM, 'base64').toString('utf-8');
  const privateKey = await jose.importPKCS8(privateKeyPem, 'RS256');

  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN)
    .sign(privateKey);
};

export const verifyToken = async (token: string): Promise<JwtPayload> => {
  // Decode base64 PEM key
  const publicKeyPem = Buffer.from(env.JWT_PUBLIC_KEY_PEM, 'base64').toString('utf-8');
  const publicKey = await jose.importSPKI(publicKeyPem, 'RS256');

  const { payload } = await jose.jwtVerify(token, publicKey);
  return payload as unknown as JwtPayload;
};

export const decodeToken = (token: string): JwtPayload | null => {
  try {
    const decoded = jose.decodeJwt(token);
    return decoded as unknown as JwtPayload;
  } catch (_error) {
    return null;
  }
};

export const getJwks = async (): Promise<{ keys: JWK[] }> => {
  // Decode base64 PEM key
  const publicKeyPem = Buffer.from(env.JWT_PUBLIC_KEY_PEM, 'base64').toString('utf-8');
  const publicKey = await jose.importSPKI(publicKeyPem, 'RS256');
  const jwk = await jose.exportJWK(publicKey);

  return {
    keys: [
      {
        ...jwk,
        use: 'sig',
        alg: 'RS256',
        kid: 'default'
      } as JWK
    ]
  };
};