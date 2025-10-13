import { z } from 'zod';

export const internalCreditSchema = z.object({
  userId: z.number().int().positive(),
  currency: z.enum(['points', 'usdt', 'gemx', 'gap', 'commission', 'gap_ref', 'commission_ref']),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'User-friendly description required').max(255),
  referenceId: z.string().max(50, 'Reference ID too long'),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const internalDebitSchema = z.object({
  userId: z.number().int().positive(),
  currency: z.enum(['points', 'usdt', 'gemx', 'gap', 'commission', 'gap_ref', 'commission_ref']),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'User-friendly description required').max(255),
  referenceId: z.string().max(50, 'Reference ID too long'),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const internalBalanceSchema = z.object({
  userId: z.string().transform(Number).pipe(z.number().int().positive())
});

export const getTransactionSchema = z.object({
  walletType: z.enum(['points', 'usdt', 'gemx', 'gap', 'commission', 'gap_ref', 'commission_ref']),
  transactionType: z.enum(['CREDIT', 'DEBIT']),
  referenceId: z.string().min(1, 'Reference ID is required').max(50, 'Reference ID too long'),
  userId: z.string().transform(Number).pipe(z.number().int().positive()).optional()
});

export type InternalCreditInput = z.infer<typeof internalCreditSchema>;
export type InternalDebitInput = z.infer<typeof internalDebitSchema>;
export type InternalBalanceInput = z.infer<typeof internalBalanceSchema>;
export type GetTransactionInput = z.infer<typeof getTransactionSchema>;