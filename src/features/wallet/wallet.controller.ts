import { Request, Response, NextFunction } from 'express';
import { WalletService } from './wallet.service';
import { TransactionQueryInput } from './wallet.validation';
import { successResponse, paginatedResponse } from '../../utils/response.utils';

export class WalletController {
  private walletService: WalletService;

  constructor() {
    this.walletService = new WalletService();
  }

  async getBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const balance = await this.walletService.getBalance(userId);

      successResponse(res, balance, 'Balance retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { currency, page, limit } = req.validatedQuery as TransactionQueryInput;

      const result = await this.walletService.getTransactions(userId, currency, page, limit);

      paginatedResponse(res, result.data, result.meta, 'Transactions retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}