import { z } from 'zod';

export const batchUsersSchema = z.object({
  userIds: z
    .array(z.number().int().positive('User IDs must be positive integers'))
    .min(1, 'At least one user ID is required')
    .max(100, 'Maximum 100 user IDs allowed')
});

export type BatchUsersInput = z.infer<typeof batchUsersSchema>;