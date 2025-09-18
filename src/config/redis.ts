import { createClient } from 'redis';
import { env } from './env';

export type RedisClient = ReturnType<typeof createClient>;

const createRedisClient = () => {
  return createClient({
    url: env.REDIS_URL,
  });
};

export const redis = createRedisClient();

export const connectRedis = async () => {
  try {
    await redis.connect();
    console.log('Redis connected successfully');
  } catch (error) {
    console.error('Redis connection failed:', error);
    process.exit(1);
  }
};

export const disconnectRedis = async () => {
  try {
    if (redis.isOpen) {
      redis.destroy();
      console.log('Redis disconnected');
    }
  } catch (error) {
    console.error('Error disconnecting from Redis:', error);
  }
};

redis.on('error', (error) => {
  console.error('Redis error:', error);
});

redis.on('connect', () => {
  console.log('Redis client connected');
});

redis.on('ready', () => {
  console.log('Redis client ready');
});
