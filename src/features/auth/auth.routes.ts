import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validateBody } from '../../middleware/validation.middleware';
import { authenticateToken } from '../../middleware/auth.middleware';
import { authRateLimit, createRateLimiter } from '../../middleware/rateLimiter.middleware';
import { registerSchema, loginSchema, sendOtpSchema, verifyOtpSchema } from './auth.validation';

const router = Router();
const authController = new AuthController();

// Rate limiter for OTP requests - 3 requests per 15 minutes
const otpRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 3, // 3 OTP requests per window
  keyGenerator: (req) => `otp:${req.ip}:${req.body?.email || 'unknown'}`,
  message: 'Too many OTP requests, please try again later.',
});

router.post(
  '/register',
  authRateLimit,
  validateBody(registerSchema),
  authController.register.bind(authController)
);

router.post(
  '/login',
  authRateLimit,
  validateBody(loginSchema),
  authController.login.bind(authController)
);

router.get(
  '/profile',
  authenticateToken,
  authController.getProfile.bind(authController)
);

router.get(
  '/.well-known/jwks.json',
  authController.jwksEndpoint.bind(authController)
);

router.post(
  '/send-otp',
  otpRateLimit,
  validateBody(sendOtpSchema),
  authController.sendOtp.bind(authController)
);

router.post(
  '/verify-otp',
  authRateLimit,
  validateBody(verifyOtpSchema),
  authController.verifyOtp.bind(authController)
);

export { router as authRoutes };