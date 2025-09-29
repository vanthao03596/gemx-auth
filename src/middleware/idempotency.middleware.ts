import { Request, Response, NextFunction } from 'express';
import { BadRequestError, ConflictError } from '../utils/errors';
import { getCache } from '../utils/redis.utils';
import { redis } from '../config/redis';

export const ensureIdempotency = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const idempotencyKey = req.headers['idempotency-key'] as string;

    if (!idempotencyKey) {
      return next(new BadRequestError('Idempotency-Key header required'));
    }

    const lockKey = `lock:${idempotencyKey}`;
    const resultKey = `idempotency:${idempotencyKey}`;

    // First, check if we already have a cached result
    const existingResult = await getCache(resultKey);
    if (existingResult) {
      console.log(`🔄 [${idempotencyKey}] Returning cached result`);
      res.json(existingResult);
      return;
    }

    // Try to acquire lock atomically using Redis SET with NX and PX options
    // NX = only set if not exists, PX = set expiration in milliseconds
    const lockAcquired = await redis.set(lockKey, '1', {
      NX: true,           // Only set if key doesn't exist
      PX: 30000          // Expire in 30 seconds
    });

    if (!lockAcquired) {
      console.log(`⏳ [${idempotencyKey}] Lock not acquired, waiting for result...`);
      // Another request is processing, wait briefly and check for result
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await getCache(resultKey);
      if (result) {
        console.log(`🔄 [${idempotencyKey}] Found result after waiting, returning cached result`);
        res.json(result);
        return;
      }

      console.log(`❌ [${idempotencyKey}] No result found after waiting, returning conflict`);
      // If still no result after waiting, return conflict error
      return next(new ConflictError('Request already being processed. Please retry shortly.'));
    }

    // Lock acquired successfully, proceed with operation
    console.log(`🔒 [${idempotencyKey}] Lock acquired, proceeding with operation`);
    req.idempotencyKey = idempotencyKey;

    // Clean up lock when response finishes (success or error)
    const cleanupLock = async () => {
      try {
        await redis.del(lockKey);
      } catch (error) {
        console.error('Failed to cleanup idempotency lock:', error);
      }
    };

    res.on('finish', cleanupLock);
    res.on('close', cleanupLock);
    res.on('error', cleanupLock);

    next();
  } catch (error) {
    next(error);
  }
};
