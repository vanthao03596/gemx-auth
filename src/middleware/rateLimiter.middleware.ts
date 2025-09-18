import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { RateLimitError } from '../utils/errors';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
}

export const createRateLimiter = (options: RateLimitOptions) => {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (req: Request) => req.ip || 'unknown',
    message = 'Too many requests, please try again later.',
  } = options;

  return async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const key = `rate_limit:${keyGenerator(req)}`;
      const currentCount = await redis.get(key);

      if (currentCount && parseInt(currentCount, 10) >= maxRequests) {
        return next(new RateLimitError(message));
      }

      await redis
        .multi()
        .incr(key)
        .expire(key, Math.ceil(windowMs / 1000))
        .exec();

      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      next();
    }
  };
};

export const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: env.RATE_LIMIT_MAX,
  keyGenerator: (req: Request) => `auth:${req.ip}`,
  message: 'Too many authentication attempts, please try again later.',
});

export const globalRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  message: 'Too many requests from this IP, please try again later.',
});
