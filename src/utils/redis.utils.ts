import { redis } from '../config/redis';

export const setCache = async (
  key: string,
  value: unknown,
  ttlSeconds?: number
): Promise<void> => {
  try {
    const stringValue =
      typeof value === 'string' ? value : JSON.stringify(value);

    if (ttlSeconds) {
      await redis.setEx(key, ttlSeconds, stringValue);
    } else {
      await redis.set(key, stringValue);
    }
  } catch (error) {
    console.error('Redis set error:', error);
    throw new Error('Cache write failed');
  }
};

export const getCache = async <T = unknown>(key: string): Promise<T | null> => {
  try {
    const value = await redis.get(key);

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
};

export const deleteCache = async (key: string): Promise<void> => {
  try {
    await redis.del(key);
  } catch (error) {
    console.error('Redis delete error:', error);
  }
};

export const existsCache = async (key: string): Promise<boolean> => {
  try {
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (error) {
    console.error('Redis exists error:', error);
    return false;
  }
};

export const incrementCache = async (
  key: string,
  ttlSeconds?: number
): Promise<number> => {
  try {
    const count = await redis.incr(key);

    if (ttlSeconds && count === 1) {
      await redis.expire(key, ttlSeconds);
    }

    return count;
  } catch (error) {
    console.error('Redis increment error:', error);
    throw new Error('Cache increment failed');
  }
};
