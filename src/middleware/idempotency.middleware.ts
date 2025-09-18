import { Request, Response, NextFunction } from 'express';
import { BadRequestError } from '../utils/errors';
import { getCache } from '../utils/redis.utils';

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

    // Check if transaction already processed
    const existingTransaction = await getCache(`idempotency:${idempotencyKey}`);
    if (existingTransaction) {
      res.json(existingTransaction);
      return;
    }

    req.idempotencyKey = idempotencyKey;
    next();
  } catch (error) {
    next(error);
  }
};
