import { Request, Response, NextFunction } from 'express';
import { AuthenticationError } from '../utils/errors';
import { ServiceContext } from '../features/wallet/wallet.types';
import { env } from '../config/env';

const validateServiceAuth = async (
  apiKey: string,
  serviceName: string
): Promise<ServiceContext | null> => {
  try {
    // Get validated service configuration from env
    const serviceApiKeys = env.SERVICE_API_KEYS;
    const allowedServices = env.ALLOWED_SERVICES;

    // Validate service name is allowed
    if (!allowedServices.includes(serviceName)) {
      return null;
    }

    // Validate API key matches service
    if (serviceApiKeys[serviceName] !== apiKey) {
      return null;
    }

    // Define service permissions
    const servicePermissions: Record<string, string[]> = {
      'academy-service': ['credit', 'debit', 'balance'],
    };

    return {
      name: serviceName,
      permissions: servicePermissions[serviceName] || [],
    };
  } catch (error) {
    console.error('Service authentication error:', error);
    return null;
  }
};

export const authenticateService = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    const serviceName = req.headers['x-service-name'] as string;

    if (!apiKey || !serviceName) {
      return next(new AuthenticationError('Service authentication required'));
    }

    // Validate API key and service authorization
    const service = await validateServiceAuth(apiKey, serviceName);
    if (!service) {
      return next(new AuthenticationError('Invalid service credentials'));
    }

    req.service = service;
    next();
  } catch (error) {
    next(error);
  }
};
