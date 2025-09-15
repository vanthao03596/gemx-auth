import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validateBody } from '../../middleware/validation.middleware';
import { authenticateToken } from '../../middleware/auth.middleware';
import { authRateLimit } from '../../middleware/rateLimiter.middleware';
import { registerSchema, loginSchema } from './auth.validation';

const router = Router();
const authController = new AuthController();

router.post(
  '/register',
  authRateLimit,
  validateBody(registerSchema),
  authController.register
);

router.post(
  '/login',
  authRateLimit,
  validateBody(loginSchema),
  authController.login
);

router.get(
  '/profile',
  authenticateToken,
  authController.getProfile
);

router.get(
  '/.well-known/jwks.json',
  authController.jwksEndpoint
);

export { router as authRoutes };