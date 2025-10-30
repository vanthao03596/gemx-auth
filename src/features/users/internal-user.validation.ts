import { z } from 'zod';

const userCreateSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  password: z.string().optional(),
  walletAddress: z.string().optional(),
  referrerId: z.number().int().positive('Referrer ID must be a positive integer').optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
});

export const batchCreateUsersSchema = z.object({
  users: z
    .array(userCreateSchema)
    .min(1, 'At least one user is required')
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type BatchCreateUsersInput = z.infer<typeof batchCreateUsersSchema>;

const referralUpdateSchema = z.object({
  refereeUserId: z.number().int().positive('Referee user ID must be a positive integer'),
  referrerUserId: z.number().int().positive('Referrer user ID must be a positive integer'),
  refereeName: z.string().optional(),
  referrerName: z.string().optional(),
});

export const updateReferrersSchema = z.object({
  updates: z
    .array(referralUpdateSchema)
    .min(1, 'At least one referral update is required')
});

export type ReferralUpdateInput = z.infer<typeof referralUpdateSchema>;
export type UpdateReferrersInput = z.infer<typeof updateReferrersSchema>;
