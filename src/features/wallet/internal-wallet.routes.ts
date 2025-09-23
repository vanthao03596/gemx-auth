import { Router } from 'express';
import { InternalWalletController } from './internal-wallet.controller';
import { validateBody, validateParams, validateQuery } from '../../middleware/validation.middleware';
import { authenticateService } from '../../middleware/service-auth.middleware';
import { ensureIdempotency } from '../../middleware/idempotency.middleware';
import { internalCreditSchema, internalDebitSchema, internalBalanceSchema, getTransactionSchema } from './internal-wallet.validation';

const router = Router();
const internalWalletController = new InternalWalletController();

router.post(
  '/credit',
  authenticateService,
  ensureIdempotency,
  validateBody(internalCreditSchema),
  internalWalletController.creditWallet.bind(internalWalletController)
);

router.post(
  '/debit',
  authenticateService,
  ensureIdempotency,
  validateBody(internalDebitSchema),
  internalWalletController.debitWallet.bind(internalWalletController)
);

router.get(
  '/balance/:userId',
  authenticateService,
  validateParams(internalBalanceSchema),
  internalWalletController.getBalance.bind(internalWalletController)
);

router.get(
  '/transaction',
  authenticateService,
  validateQuery(getTransactionSchema),
  internalWalletController.getTransactionByReference.bind(internalWalletController)
);

export { router as internalWalletRoutes };