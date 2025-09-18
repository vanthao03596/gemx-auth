const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export const generateReferralCode = (userId: number): string => {
  let result = '';
  let num = userId;
  while (num > 0) {
    result = BASE62[num % 62] + result;
    num = Math.floor(num / 62);
  }
  return 'R' + result.padStart(4, '0'); // e.g., R0001, R123A
};

export const decodeReferralCode = (code: string): number => {
  if (!code.startsWith('R')) throw new Error('Invalid referral code format');
  const encoded = code.substring(1);
  let result = 0;
  for (let i = 0; i < encoded.length; i++) {
    const char = encoded[i];
    if (!char) throw new Error('Invalid referral code character');
    const value = BASE62.indexOf(char);
    if (value === -1) throw new Error('Invalid referral code character');
    result = result * 62 + value;
  }
  return result;
};
