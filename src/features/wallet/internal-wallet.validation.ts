import { z } from 'zod';

export const internalCreditSchema = z.object({
  userId: z.number().int().positive(),
  currency: z.enum(['points', 'usdt']),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'User-friendly description required').max(255),
  referenceId: z.string().max(50, 'Reference ID too long'),
});

export const internalDebitSchema = z.object({
  userId: z.number().int().positive(),
  currency: z.enum(['points', 'usdt']),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'User-friendly description required').max(255),
  referenceId: z.string().max(50, 'Reference ID too long'),
});

export const internalBalanceSchema = z.object({
  userId: z.string().transform(Number).pipe(z.number().int().positive())
});

export type InternalCreditInput = z.infer<typeof internalCreditSchema>;
export type InternalDebitInput = z.infer<typeof internalDebitSchema>;
export type InternalBalanceInput = z.infer<typeof internalBalanceSchema>;