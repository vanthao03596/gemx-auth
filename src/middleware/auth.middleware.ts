import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.utils';
import { prisma } from '../config/database';
import { AuthenticationError } from '../utils/errors';

export const authenticateToken = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7)
      : null;

    if (!token) {
      return next(new AuthenticationError('Access token is required'));
    }

    const decoded = await verifyToken(token);
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return next(new AuthenticationError('User not found'));
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7)
      : null;

    if (!token) {
      return next();
    }

    const decoded = await verifyToken(token);
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (user) {
      req.user = user;
    }

    next();
  } catch (error) {
    next(error);
  }
};