import { PaginationMeta } from '../../types/response.types';

export interface WalletBalance {
  points: number;
  usdt: number;
}

export interface WalletTransactionResponse {
  id: number;
  walletId: number;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  description: string | null;        // User-facing description only
  referenceId: string | null;
  createdAt: Date;
  wallet: {
    currency: string;
  };
  // internalNotes excluded from public API response
}

export interface WalletTransactionAudit {
  id: number;
  walletId: number;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  description: string | null;        // User-facing description
  internalNotes: string | null;      // Service attribution for audit
  referenceId: string | null;
  createdAt: Date;
  wallet: {
    currency: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ServiceContext {
  name: string;
  permissions: string[];
}

// Extend Express Request interface to include service and idempotency context
declare global {
  namespace Express {
    interface Request {
      service?: ServiceContext;
      idempotencyKey?: string;
    }
  }
}