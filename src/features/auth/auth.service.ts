import { User } from '@prisma/client';
import { prisma } from '../../config/database';
import { hashPassword, comparePassword } from '../../utils/password.utils';
import { generateToken } from '../../utils/jwt.utils';
import { RegisterInput, LoginInput } from './auth.validation';
import { ConflictError, AuthenticationError } from '../../utils/errors';

export interface AuthResponse {
  user: Omit<User, 'password'>;
  token: string;
}

export class AuthService {
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
        createdAt: true,
        updatedAt: true,
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
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }
}