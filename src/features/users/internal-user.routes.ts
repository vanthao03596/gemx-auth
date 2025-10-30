import { Router } from 'express';
import { InternalUserController } from './internal-user.controller';
import { validateBody, validateQuery } from '../../middleware/validation.middleware';
import { authenticateService } from '../../middleware/service-auth.middleware';
import { batchCreateUsersSchema, updateReferrersSchema, searchUsersQuerySchema } from './internal-user.validation';

const router = Router();
const internalUserController = new InternalUserController();


router.get(
  '/',
  authenticateService,
  validateQuery(searchUsersQuerySchema),
  internalUserController.searchUsers.bind(internalUserController)
);

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
