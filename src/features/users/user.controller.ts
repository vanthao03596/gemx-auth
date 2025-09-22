import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service';
import { BatchUsersInput, SetReferrerInput } from './user.validation';
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

  async getReferralCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const referralCode = await this.userService.getReferralCode(userId);

      successResponse(res, { referral_code: referralCode }, 'Referral code retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async setReferrer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const data = req.validatedBody as SetReferrerInput;
      const user = await this.userService.setReferrer(userId, data.referralCode);

      successResponse(res, { user }, 'Referrer set successfully');
    } catch (error) {
      next(error);
    }
  }

  async getReferrals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const referrals = await this.userService.getReferrals(userId);

      successResponse(res, { referrals }, 'Referrals retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getReferralsCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const referralsCount = await this.userService.getReferralsCount(userId);

      successResponse(res, { referralsCount }, 'Referrals count retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}