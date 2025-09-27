import { Router } from 'express';
import { UserController } from './user.controller';
import { validateBody } from '../../middleware/validation.middleware';
import { authenticateToken } from '../../middleware/auth.middleware';
import { batchUsersSchema, setReferrerSchema } from './user.validation';

const router = Router();
const userController = new UserController();

router.post(
  '/batch',
  validateBody(batchUsersSchema),
  userController.getBatchUsers.bind(userController)
);

router.get(
  '/referral-code',
  authenticateToken,
  userController.getReferralCode.bind(userController)
);

router.post(
  '/referrer',
  authenticateToken,
  validateBody(setReferrerSchema),
  userController.setReferrer.bind(userController)
);

router.get(
  '/referrals',
  authenticateToken,
  userController.getReferrals.bind(userController)
);

router.get(
  '/referrals-count',
  authenticateToken,
  userController.getReferralsCount.bind(userController)
);

router.post(
  '/update-daily-login',
  authenticateToken,
  userController.updateDailyLogin.bind(userController)
);

router.get(
  '/:id',
  userController.getUser.bind(userController)
);

export { router as userRoutes };