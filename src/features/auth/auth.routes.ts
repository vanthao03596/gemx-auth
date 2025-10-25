import { Router } from 'express';
import { AuthController } from './auth.controller';
import { SocialAuthController } from './social.controller';
import { validateBody, validateQuery, validateParams } from '../../middleware/validation.middleware';
import { authenticateToken } from '../../middleware/auth.middleware';
import { authRateLimit, createRateLimiter } from '../../middleware/rateLimiter.middleware';
import { registerSchema, loginSchema, sendOtpSchema, verifyOtpSchema, siweVerifySchema } from './auth.validation';
import { urlQuerySchema, callbackQuerySchema, unlinkParamsSchema } from './social.validation';

const router = Router();
const authController = new AuthController();
const socialAuthController = new SocialAuthController();

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

// Social authentication routes
router.get(
  '/google/url',
  authRateLimit,
  validateQuery(urlQuerySchema),
  socialAuthController.getGoogleAuthUrl.bind(socialAuthController)
);

router.get(
  '/google/callback',
  validateQuery(callbackQuerySchema),
  socialAuthController.googleCallback.bind(socialAuthController)
);

router.get(
  '/twitter/url',
  authRateLimit,
  validateQuery(urlQuerySchema),
  socialAuthController.getTwitterAuthUrl.bind(socialAuthController)
);

router.get(
  '/twitter/callback',
  validateQuery(callbackQuerySchema),
  socialAuthController.twitterCallback.bind(socialAuthController)
);

// SIWE authentication routes
router.get(
  '/siwe/nonce',
  authRateLimit,
  authController.siweNonce.bind(authController)
);

router.post(
  '/siwe/verify',
  authRateLimit,
  validateBody(siweVerifySchema),
  authController.siweVerify.bind(authController)
);

// Social account linking routes (protected - requires authentication)
// Note: /link/google/url and /link/twitter/url generate OAuth URLs for authenticated users
// The callbacks reuse existing /google/callback and /twitter/callback endpoints
router.get(
  '/social',
  authenticateToken,
  authRateLimit,
  socialAuthController.getConnectedAccounts.bind(socialAuthController)
);

router.get(
  '/link/google/url',
  authenticateToken,
  authRateLimit,
  validateQuery(urlQuerySchema),
  socialAuthController.getLinkGoogleUrl.bind(socialAuthController)
);

router.get(
  '/link/twitter/url',
  authenticateToken,
  authRateLimit,
  validateQuery(urlQuerySchema),
  socialAuthController.getLinkTwitterUrl.bind(socialAuthController)
);

router.delete(
  '/social/:provider',
  authenticateToken,
  authRateLimit,
  validateParams(unlinkParamsSchema),
  socialAuthController.unlinkSocialAccount.bind(socialAuthController)
);

export { router as authRoutes };