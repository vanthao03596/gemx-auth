import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service';
import { BatchUsersInput } from './user.validation';
import { successResponse } from '../../utils/response.utils';
import { NotFoundError } from '../../utils/errors';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  async getBatchUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {

      const data = req.validatedBody as BatchUsersInput;
      const users = await this.userService.getUsersByIds(data.userIds);

      successResponse(res, { users }, 'Users retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {

      const userId = parseInt(req.params.id!, 10);

      if (isNaN(userId)) {
        throw new NotFoundError('Invalid user ID');
      }

      const user = await this.userService.getUserById(userId);

      if (!user) {
        throw new NotFoundError('User not found');
      }

      successResponse(res, { user }, 'User retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}