import { User } from '@prisma/client';
import { prisma } from '../../config/database';
import { generateReferralCode, decodeReferralCode } from '../../utils/referral.utils';
import { NotFoundError, ConflictError, BadRequestError } from '../../utils/errors';

export class UserService {
  async getUsersByIds(userIds: number[]): Promise<Omit<User, 'password'>[]> {
    return prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        name: true,
        walletAddress: true,
        referrerId: true,
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
        referrerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  async getReferralCode(userId: number): Promise<string> {
    return generateReferralCode(userId);
  }

  private async checkCircularReference(userId: number, referrerId: number): Promise<boolean> {
    if (referrerId === userId) return true;

    const visited = new Set<number>();
    let currentId: number | null = referrerId;

    while (currentId !== null && !visited.has(currentId)) {
      visited.add(currentId);

      if (currentId === userId) return true;

      const user: { referrerId: number | null } | null = await prisma.user.findUnique({
        where: { id: currentId },
        select: { referrerId: true }
      });

      currentId = user?.referrerId || null;
    }

    return false;
  }

  async setReferrer(userId: number, referralCode: string): Promise<Omit<User, 'password'>> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');
    if (user.referrerId) throw new ConflictError('Referrer already set');

    let referrerId: number;
    try {
      referrerId = decodeReferralCode(referralCode);
    } catch (error) {
      throw new BadRequestError('Invalid referral code');
    }

    const referrer = await prisma.user.findUnique({ where: { id: referrerId } });
    if (!referrer) throw new NotFoundError('Referrer not found');

    if (await this.checkCircularReference(userId, referrerId)) {
      throw new BadRequestError('Circular reference detected');
    }

    return prisma.user.update({
      where: { id: userId },
      data: { referrerId },
      select: {
        id: true,
        email: true,
        name: true,
        walletAddress: true,
        referrerId: true,
        createdAt: true,
        updatedAt: true,
      }
    });
  }

  async getReferrals(userId: number): Promise<Omit<User, 'password'>[]> {
    return prisma.user.findMany({
      where: { referrerId: userId },
      select: {
        id: true,
        email: true,
        name: true,
        walletAddress: true,
        referrerId: true,
        createdAt: true,
        updatedAt: true,
      }
    });
  }

  async getReferralsCount(userId: number): Promise<number> {
    return prisma.user.count({
      where: { referrerId: userId },
    });
  }
}