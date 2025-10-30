import { Router } from 'express';
import { InternalUserController } from './internal-user.controller';
import { validateBody } from '../../middleware/validation.middleware';
import { authenticateService } from '../../middleware/service-auth.middleware';
import { batchCreateUsersSchema, updateReferrersSchema } from './internal-user.validation';

const router = Router();
const internalUserController = new InternalUserController();

router.post(
  '/',
  authenticateService,
  validateBody(batchCreateUsersSchema),
  internalUserController.createUsers.bind(internalUserController)
);

router.post(
  '/referrers',
  authenticateService,
  validateBody(updateReferrersSchema),
  internalUserController.updateReferrers.bind(internalUserController)
);

export { router as internalUserRoutes };
