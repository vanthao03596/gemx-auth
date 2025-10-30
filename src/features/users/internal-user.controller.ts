import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service';
import { BatchCreateUsersInput, UpdateReferrersInput, SearchUsersQuery } from './internal-user.validation';
import { successResponse } from '../../utils/response.utils';

export class InternalUserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  async createUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.validatedBody as BatchCreateUsersInput;
      const serviceName = req.service!.name;

      const result = await this.userService.createUsers(data.users, serviceName);

      successResponse(res, result, 'Users created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async updateReferrers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.validatedBody as UpdateReferrersInput;

      const result = await this.userService.updateReferrers(data.updates);

      successResponse(res, result, 'Referrers updated successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async searchUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { search } = req.validatedQuery as SearchUsersQuery;

      const users = await this.userService.searchUsers(search);

      successResponse(res, { users }, 'Users retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }
}
