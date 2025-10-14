import { User } from '@prisma/client';
import { prisma } from '../../config/database';
import { hashPassword, comparePassword } from '../../utils/password.utils';
import { generateToken } from '../../utils/jwt.utils';
import { RegisterInput, LoginInput, SendOtpInput, VerifyOtpInput, SiweVerifyInput } from './auth.validation';
import { ConflictError, AuthenticationError } from '../../utils/errors';
import { generateOtp, createOtpExpiration, isOtpExpired } from '../../utils/otp.utils';
import { EmailService } from '../otp/email.service';
import { generateSiweNonce, parseSiweMessage, verifySiweMessage } from 'viem/siwe';
import { siweClient, isValidSiweDomain } from '../../config/siwe';
import { setCache, getCache, deleteCache } from '../../utils/redis.utils';
import { SiweNonceResponse } from './siwe.types';

export interface AuthResponse {
  user: Omit<User, 'password'>;
  token: string;
}

export class AuthService {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  async register(data: RegisterInput): Promise<AuthResponse> {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictError('User already exists');
    }

    const hashedPassword = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        walletAddress: true,
        referrerId: true,
        createdAt: true,
        updatedAt: true,
        lastDailyLogin: true,
        role: true
      },
    });

    const token = await generateToken({
      userId: user.id,
      email: user.email,
    });

    return { user, token };
  }

  async login(data: LoginInput): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    const isPasswordValid = await comparePassword(data.password, user.password!);

    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid credentials');
    }

    const { password, ...userWithoutPassword } = user;

    const token = await generateToken({
      userId: user.id,
      email: user.email,
    });

    return { user: userWithoutPassword, token };
  }

  async getUserById(userId: number): Promise<Omit<User, 'password'> | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        walletAddress: true,
        referrerId: true,
        lastDailyLogin: true,
        createdAt: true,
        updatedAt: true,
        role: true
      },
    });

    return user;
  }

  async sendOtp(data: SendOtpInput): Promise<void> {
    const { email } = data;

    // Generate OTP
    const code = generateOtp();
    const expiresAt = createOtpExpiration();

    // Create or find user
    let user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, walletAddress: true, referrerId: true }
    });

    if (!user) {
      // Auto-create user for OTP login
      user = await prisma.user.create({
        data: {
          email,
          password: '', // Empty password for OTP-only users
          name: email.split('@')[0] || email // Use email prefix as default name, fallback to email
        },
        select: { id: true, email: true, name: true, walletAddress: true, referrerId: true }
      });
    }

    // Store OTP (upsert to handle existing OTP codes)
    await prisma.otpCode.upsert({
      where: { email },
      update: {
        code,
        expiresAt,
        usedAt: null // Reset used status
      },
      create: {
        userId: user.id,
        email,
        code,
        expiresAt
      }
    });

    // Send email
    await this.emailService.sendOtpEmail(email, code);

    // In development, log OTP for testing
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔐 OTP for ${email}: ${code}`);
    }
  }

  async verifyOtp(data: VerifyOtpInput): Promise<AuthResponse> {
    const { email, code } = data;

    // Find OTP code
    const otpRecord = await prisma.otpCode.findUnique({
      where: { email },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            walletAddress: true,
            referrerId: true,
            createdAt: true,
            updatedAt: true,
            lastDailyLogin: true,
            role: true
          }
        }
      }
    });

    if (!otpRecord) {
      throw new AuthenticationError('Invalid OTP code');
    }

    // Check if OTP is already used
    if (otpRecord.usedAt) {
      throw new AuthenticationError('OTP code has already been used');
    }

    // Check if OTP is expired
    if (isOtpExpired(otpRecord.expiresAt)) {
      throw new AuthenticationError('OTP code has expired');
    }

    // Check if code matches
    if (otpRecord.code !== code) {
      throw new AuthenticationError('Invalid OTP code');
    }

    // Mark OTP as used
    await prisma.otpCode.update({
      where: { email },
      data: { usedAt: new Date() }
    });

    // Generate JWT token
    const token = await generateToken({
      userId: otpRecord.user.id,
      email: otpRecord.user.email,
    });

    return {
      user: otpRecord.user,
      token
    };
  }

  async generateSiweNonce(): Promise<SiweNonceResponse> {
    const nonce = generateSiweNonce();

    // Store nonce in Redis with 5min TTL for replay attack prevention
    await setCache(`siwe:nonce:${nonce}`, 'unused', 300);

    return { nonce };
  }

  async verifySiweSignature(data: SiweVerifyInput): Promise<AuthResponse> {
    const { message, signature } = data;

    // Parse SIWE message to extract nonce and address
    let siweMessage;
    try {
      siweMessage = parseSiweMessage(message);
    } catch (_error) {
      throw new AuthenticationError('Invalid SIWE message format');
    }

    // Validate domain is in allowed list
    if (!siweMessage.domain || !isValidSiweDomain(siweMessage.domain)) {
      throw new AuthenticationError(`Invalid domain: ${siweMessage.domain}. Must be one of the configured domains.`);
    }

    // Validate nonce exists and hasn't been used
    const storedNonce = await getCache<string>(`siwe:nonce:${siweMessage.nonce}`);
    if (!storedNonce) {
      throw new AuthenticationError('Invalid or expired nonce');
    }

    // Verify signature using viem
    const isValid = await verifySiweMessage(siweClient, {
      message,
      signature: signature as `0x${string}`,
      domain: siweMessage.domain, // Use the domain from the message itself
    });

    if (!isValid) {
      throw new AuthenticationError('Invalid signature');
    }

    // Invalidate nonce after successful verification
    await deleteCache(`siwe:nonce:${siweMessage.nonce}`);

    // Find or create user by wallet address
    if (!siweMessage.address) {
      throw new AuthenticationError('Invalid SIWE message: missing address');
    }

    let user = await prisma.user.findUnique({
      where: { walletAddress: siweMessage.address.toLowerCase() },
      select: {
        id: true,
        email: true,
        name: true,
        walletAddress: true,
        referrerId: true,
        createdAt: true,
        updatedAt: true,
        lastDailyLogin: true
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          walletAddress: siweMessage.address.toLowerCase(),
          name: `User ${siweMessage.address.slice(0, 8)}`,
          email: `${siweMessage.address.toLowerCase()}@wallet.local`,
          password: '', // Empty password for wallet users
        },
        select: {
          id: true,
          email: true,
          name: true,
          walletAddress: true,
          referrerId: true,
          createdAt: true,
          updatedAt: true,
          lastDailyLogin: true,
          role: true
        },
      });
    }

    // Generate JWT using existing utility
    const token = await generateToken({
      userId: user.id,
      email: user.email,
    });

    return { user, token };
  }

  async updateLastDailyLogin(userId: number, date: Date): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { lastDailyLogin: date },
    });
  }
}