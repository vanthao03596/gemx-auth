import { z } from 'zod';

export const transactionQuerySchema = z.object({
  currency: z.enum(['points', 'usdt']).optional(),
  page: z.string().optional().default('1').transform(Number).pipe(z.number().min(1)),
  limit: z.string().optional().default('20').transform(Number).pipe(z.number().min(1).max(100))
});

export const creditWalletSchema = z.object({
  currency: z.enum(['points', 'usdt']),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().max(255).optional(),
  referenceId: z.string().max(50).optional()
});

export const debitWalletSchema = z.object({
  currency: z.enum(['points', 'usdt']),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().max(255).optional(),
  referenceId: z.string().max(50).optional()
});

export type TransactionQueryInput = z.infer<typeof transactionQuerySchema>;
export type CreditWalletInput = z.infer<typeof creditWalletSchema>;
export type DebitWalletInput = z.infer<typeof debitWalletSchema>;