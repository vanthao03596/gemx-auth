import { User } from '@prisma/client';
import { prisma } from '../../config/database';

export class UserService {
  async getUsersByIds(userIds: number[]): Promise<Omit<User, 'password'>[]> {
    return prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        name: true,
        walletAddress: true,
        createdAt: true,
        updatedAt: true,
      }
    });
  }

  async getUserById(userId: number): Promise<Omit<User, 'password'> | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        walletAddress: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }
}