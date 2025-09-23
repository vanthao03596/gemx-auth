import { Request, Response, NextFunction } from 'express';
import { WalletService } from './wallet.service';
import { InternalCreditInput, InternalDebitInput, InternalBalanceInput, GetTransactionInput } from './internal-wallet.validation';
import { successResponse } from '../../utils/response.utils';
import { setCache } from '../../utils/redis.utils';

export class InternalWalletController {
  private walletService = new WalletService();

  async creditWallet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, currency, amount, description, referenceId } = req.validatedBody as InternalCreditInput;
      const serviceName = req.service!.name;
      const idempotencyKey = req.idempotencyKey!;

      // Use clean description from request - service attribution handled in service layer
      const transaction = await this.walletService.creditWallet(
        userId,
        currency,
        amount,
        description,                   // Clean user description from request
        referenceId,
        serviceName                    // Service attribution for audit
      );

      // Cache result for idempotency
      const response = { transaction, message: 'Wallet credited successfully' };
      await setCache(`idempotency:${idempotencyKey}`, JSON.stringify(response), 3600);

      successResponse(res, { transaction }, 'Wallet credited successfully');
    } catch (error) {
      next(error);
    }
  }

  async debitWallet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, currency, amount, description, referenceId } = req.validatedBody as InternalDebitInput;
      const serviceName = req.service!.name;
      const idempotencyKey = req.idempotencyKey!;

      // Use clean description from request - service attribution handled in service layer
      const transaction = await this.walletService.debitWallet(
        userId,
        currency,
        amount,
        description,                   // Clean user description from request
        referenceId,
        serviceName                    // Service attribution for audit
      );

      const response = { transaction, message: 'Wallet debited successfully' };
      await setCache(`idempotency:${idempotencyKey}`, JSON.stringify(response), 3600);

      successResponse(res, { transaction }, 'Wallet debited successfully');
    } catch (error) {
      next(error);
    }
  }

  async getBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.validatedParams as InternalBalanceInput;
      const balance = await this.walletService.getBalance(userId);

      successResponse(res, balance, 'Balance retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getTransactionByReference(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { walletType, transactionType, referenceId, userId } = req.validatedQuery as GetTransactionInput;

      const transaction = await this.walletService.getTransactionByReference(
        walletType,
        transactionType,
        referenceId,
        userId
      );

      if (!transaction) {
        successResponse(res, null, 'Transaction not found');
        return;
      }

      successResponse(res, { transaction }, 'Transaction retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}