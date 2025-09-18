import { z } from 'zod';

export const batchUsersSchema = z.object({
  userIds: z
    .array(z.number().int().positive('User IDs must be positive integers'))
    .min(1, 'At least one user ID is required')
    .max(100, 'Maximum 100 user IDs allowed')
});

export const setReferrerSchema = z.object({
  referralCode: z
    .string()
    .min(1, 'Referral code is required')
    .regex(/^R[0-9A-Za-z]+$/, 'Invalid referral code format')
});

export type BatchUsersInput = z.infer<typeof batchUsersSchema>;
export type SetReferrerInput = z.infer<typeof setReferrerSchema>;