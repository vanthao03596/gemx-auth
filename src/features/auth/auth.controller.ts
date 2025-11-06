import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { RegisterInput, LoginInput, SendOtpInput, VerifyOtpInput, SiweVerifyInput, ConnectWalletInput } from './auth.validation';
import { successResponse } from '../../utils/response.utils';
import { HttpStatus } from '../../types/response.types';
import { AuthenticationError, NotFoundError } from '../../utils/errors';
import { getJwks } from '../../utils/jwt.utils';
import { WalletService } from '../wallet/wallet.service';

export class AuthController {
  private authService: AuthService;
  private walletService: WalletService;

  constructor() {
    this.authService = new AuthService();
    this.walletService = new WalletService();
  }
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.validatedBody as RegisterInput;
      const result = await this.authService.register(data);

      successResponse(res, result, 'User registered successfully', HttpStatus.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.validatedBody as LoginInput;
      const result = await this.authService.login(data);

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

      const user = await this.authService.getUserById(req.user.id);

      if (!user) {
        throw new NotFoundError('User not found');
      }

      successResponse(res, { user }, 'Profile retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async sendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.validatedBody as SendOtpInput;
      await this.authService.sendOtp(data);

      successResponse(res, null, 'OTP sent successfully');
    } catch (error) {
      next(error);
    }
  }

  async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.validatedBody as VerifyOtpInput;
      const result = await this.authService.verifyOtp(data);

      successResponse(res, result, 'OTP verified successfully');
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

  async siweNonce(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.authService.generateSiweNonce();
      successResponse(res, result, 'SIWE nonce generated');
    } catch (error) {
      next(error);
    }
  }

  async siweVerify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.validatedBody as SiweVerifyInput;
      const result = await this.authService.verifySiweSignature(data);
      successResponse(res, result, 'SIWE authentication successful');
    } catch (error) {
      next(error);
    }
  }

  async getWalletNonce(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('User not authenticated');
      }

      const result = await this.authService.generateWalletConnectNonce(req.user.id);
      successResponse(res, result, 'Wallet connection nonce generated');
    } catch (error) {
      next(error);
    }
  }

  async connectWallet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('User not authenticated');
      }

      const data = req.validatedBody as ConnectWalletInput;
      const user = await this.authService.connectWallet(req.user.id, data);

      successResponse(res, { user }, 'Wallet connected successfully');
    } catch (error) {
      next(error);
    }
  }
}