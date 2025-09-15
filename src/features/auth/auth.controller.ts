import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { RegisterInput, LoginInput } from './auth.validation';
import { successResponse } from '../../utils/response.utils';
import { HttpStatus } from '../../types/response.types';
import { AuthenticationError, NotFoundError } from '../../utils/errors';
import { getJwks } from '../../utils/jwt.utils';

const authService = new AuthService();

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.validatedBody as RegisterInput;
      const result = await authService.register(data);

      successResponse(res, result, 'User registered successfully', HttpStatus.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.validatedBody as LoginInput;
      const result = await authService.login(data);

      successResponse(res, result, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('User not authenticated');
      }

      const user = await authService.getUserById(req.user.id);

      if (!user) {
        throw new NotFoundError('User not found');
      }

      successResponse(res, { user }, 'Profile retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async jwksEndpoint(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const jwks = await getJwks();
      res.json(jwks);
    } catch (error) {
      next(error);
    }
  }
}