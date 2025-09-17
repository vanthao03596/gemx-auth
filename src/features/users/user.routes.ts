import { Router } from 'express';
import { UserController } from './user.controller';
import { validateBody } from '../../middleware/validation.middleware';
import { batchUsersSchema } from './user.validation';

const router = Router();
const userController = new UserController();

router.post(
  '/batch',
  validateBody(batchUsersSchema),
  userController.getBatchUsers.bind(userController)
);

router.get(
  '/:id',
  userController.getUser.bind(userController)
);

export { router as userRoutes };