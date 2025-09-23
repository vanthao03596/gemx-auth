import { WalletTransaction } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import { WalletBalance, WalletTransactionResponse, PaginatedResponse, WalletTransactionAudit } from './wallet.types';

export class WalletService {
  async getBalance(userId: number): Promise<WalletBalance> {
    const wallets = await prisma.wallet.findMany({
      where: { userId },
      select: { currency: true, balance: true }
    });

    return {
      points: wallets.find(w => w.currency === 'points')?.balance || 0,
      usdt: wallets.find(w => w.currency === 'usdt')?.balance || 0,
      gemx: wallets.find(w => w.currency === 'gemx')?.balance || 0
    };
  }

  async getTransactions(
    userId: number,
    currency?: 'points' | 'usdt' | 'gemx',
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<WalletTransactionResponse>> {
    const offset = (page - 1) * limit;

    const where = {
      wallet: {
        userId,
        ...(currency && { currency })
      }
    };

    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        select: {
          id: true,
          walletId: true,
          type: true,
          amount: true,
          description: true,              // User-facing description only
          referenceId: true,
          createdAt: true,
          wallet: {
            select: { currency: true }
          }
          // internalNotes excluded from public API
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.walletTransaction.count({ where })
    ]);

    return {
      data: transactions,
      meta: {
        total_count: total,
        current_page: page,
        total_pages: Math.ceil(total / limit),
        per_page: limit,
        has_next: page < Math.ceil(total / limit),
        has_previous: page > 1
      }
    };
  }

  async creditWallet(
    userId: number,
    currency: 'points' | 'usdt' | 'gemx',
    amount: number,
    userDescription: string,      // Clean user-facing description
    referenceId?: string,
    serviceName?: string          // For internal operations
  ): Promise<WalletTransaction> {
    return await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: {
          userId_currency: { userId, currency }
        },
        create: {
          userId,
          currency,
          balance: amount
        },
        update: {
          balance: { increment: amount }
        }
      });

      return await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'CREDIT',
          amount,
          description: userDescription,                    // "Referral bonus"
          internalNotes: serviceName ? `via ${serviceName}` : null,  // "via referral-service"
          referenceId: serviceName ? `${serviceName}:${referenceId || ''}` : (referenceId || null)
        }
      });
    });
  }

  async debitWallet(
    userId: number,
    currency: 'points' | 'usdt' | 'gemx',
    amount: number,
    userDescription: string,      // Clean user-facing description
    referenceId?: string,
    serviceName?: string          // For internal operations
  ): Promise<WalletTransaction> {
    return await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId_currency: { userId, currency } }
      });

      if (!wallet) throw new NotFoundError(`${currency} wallet not found`);
      if (wallet.balance < amount) throw new BadRequestError('Insufficient balance');

      await tx.wallet.update({
        where: { userId_currency: { userId, currency } },
        data: { balance: { decrement: amount } }
      });

      return await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'DEBIT',
          amount: -amount,
          description: userDescription,                    // "Item purchase"
          internalNotes: serviceName ? `via ${serviceName}` : null,  // "via order-service"
          referenceId: serviceName ? `${serviceName}:${referenceId || ''}` : (referenceId || null)
        }
      });
    });
  }

  // Example usage patterns with clean user descriptions
  async processReferralBonus(userId: number, referralId: string): Promise<void> {
    await this.creditWallet(
      userId,
      'points',
      100,
      'Referral bonus',        // Clean user-facing description
      referralId,
      'referral-service'       // Service attribution for audit
    );
  }

  async processPurchase(userId: number, orderId: string, pointsCost: number): Promise<void> {
    await this.debitWallet(
      userId,
      'points',
      pointsCost,
      'Item purchase',         // Clean user-facing description
      orderId,
      'order-service'          // Service attribution for audit
    );
  }

  async getTransactionByReference(
    walletType: 'points' | 'usdt' | 'gemx',
    transactionType: 'CREDIT' | 'DEBIT',
    referenceId: string,
    userId?: number
  ): Promise<WalletTransactionAudit | null> {
    const transaction = await prisma.walletTransaction.findFirst({
      where: {
        wallet: {
          currency: walletType,
          ...(userId && { userId })
        },
        type: transactionType,
        referenceId: {
          contains: referenceId
        }
      },
      select: {
        id: true,
        walletId: true,
        type: true,
        amount: true,
        description: true,
        internalNotes: true,
        referenceId: true,
        createdAt: true,
        wallet: {
          select: { currency: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return transaction;
  }
}