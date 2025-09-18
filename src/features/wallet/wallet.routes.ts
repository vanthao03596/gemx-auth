import { Router } from 'express';
import { WalletController } from './wallet.controller';
import { validateQuery } from '../../middleware/validation.middleware';
import { authenticateToken } from '../../middleware/auth.middleware';
import { transactionQuerySchema } from './wallet.validation';

const router = Router();
const walletController = new WalletController();

router.get(
  '/balance',
  authenticateToken,
  walletController.getBalance.bind(walletController)
);

router.get(
  '/transactions',
  authenticateToken,
  validateQuery(transactionQuerySchema),
  walletController.getTransactions.bind(walletController)
);

export { router as walletRoutes };