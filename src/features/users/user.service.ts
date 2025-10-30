import { User } from '@prisma/client';
import { prisma } from '../../config/database';
import { generateReferralCode, decodeReferralCode } from '../../utils/referral.utils';
import { NotFoundError, ConflictError, BadRequestError } from '../../utils/errors';
import { sendWebhooks } from '../../utils/webhook.utils';
import { env } from '../../config/env';

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
        lastDailyLogin: true,
        role: true
      }
    });
  }

  async searchUsers(searchQuery: string): Promise<Omit<User, 'password'>[]> {
    return prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: searchQuery } },
          { email: { contains: searchQuery } },
        ]
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
        lastDailyLogin: true,
        role: true,
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
    } catch (_error) {
      throw new BadRequestError('Invalid referral code');
    }

    const referrer = await prisma.user.findUnique({ where: { id: referrerId } });
    if (!referrer) throw new NotFoundError('Referrer not found');

    if (await this.checkCircularReference(userId, referrerId)) {
      throw new BadRequestError('Circular reference detected');
    }

    const updatedUser = await prisma.user.update({
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
        lastDailyLogin: true,
        role: true
      }
    });

    // Send webhook notification (fire-and-forget)
    void sendWebhooks(
      env.WEBHOOK_URLS || [],
      {
        event: 'referral.created',
        data: {
          referrerId,
          referredUserId: userId,
          timestamp: new Date().toISOString(),
        },
      },
      env.WEBHOOK_SECRET || ''
    );

    return updatedUser;
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
        lastDailyLogin: true,
        role: true
      }
    });
  }

  async getReferralsCount(userId: number){
    return Promise.all([
       prisma.user.count({
        where: { referrerId: userId },
      }),
      prisma.user.count({
        where: { referrerId: userId, lastDailyLogin: { not: null } },
      }),
    ]);
  }

   async updateDailyLogin(userId: number): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        lastDailyLogin: new Date()
      }
    });
  }

  async updateReferrers(
    updates: Array<{
      refereeUserId: number;
      referrerUserId: number;
      refereeName?: string | undefined;
      referrerName?: string | undefined;
    }>
  ): Promise<{
    updated: Array<{ refereeUserId: number; referrerUserId: number }>;
    failed: Array<{ refereeUserId: number; referrerUserId: number; reason: string }>;
  }> {
    const updated: Array<{ refereeUserId: number; referrerUserId: number }> = [];
    const failed: Array<{ refereeUserId: number; referrerUserId: number; reason: string }> = [];

    // Get all unique user IDs to validate
    const allUserIds = new Set<number>();
    updates.forEach(update => {
      allUserIds.add(update.refereeUserId);
      allUserIds.add(update.referrerUserId);
    });

    // Validate all users exist
    const existingUsers = await prisma.user.findMany({
      where: { id: { in: Array.from(allUserIds) } },
      select: { id: true }
    });
    const existingUserIds = new Set(existingUsers.map(u => u.id));

    // Process each update
    for (const update of updates) {
      try {
        // Check if both users exist
        if (!existingUserIds.has(update.refereeUserId)) {
          failed.push({
            refereeUserId: update.refereeUserId,
            referrerUserId: update.referrerUserId,
            reason: `Referee user ${update.refereeUserId} not found`
          });
          continue;
        }

        if (!existingUserIds.has(update.referrerUserId)) {
          failed.push({
            refereeUserId: update.refereeUserId,
            referrerUserId: update.referrerUserId,
            reason: `Referrer user ${update.referrerUserId} not found`
          });
          continue;
        }

        // Check for circular reference
        if (await this.checkCircularReference(update.refereeUserId, update.referrerUserId)) {
          failed.push({
            refereeUserId: update.refereeUserId,
            referrerUserId: update.referrerUserId,
            reason: 'Circular reference detected'
          });
          continue;
        }

        // Update the referrer
        await prisma.user.update({
          where: { id: update.refereeUserId },
          data: { referrerId: update.referrerUserId }
        });

        updated.push({
          refereeUserId: update.refereeUserId,
          referrerUserId: update.referrerUserId
        });

        // Send webhook notification (fire-and-forget)
        void sendWebhooks(
          env.WEBHOOK_URLS || [],
          {
            event: 'referral.updated',
            data: {
              referrerId: update.referrerUserId,
              referredUserId: update.refereeUserId,
              timestamp: new Date().toISOString(),
            },
          },
          env.WEBHOOK_SECRET || ''
        );

      } catch (error) {
        failed.push({
          refereeUserId: update.refereeUserId,
          referrerUserId: update.referrerUserId,
          reason: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return { updated, failed };
  }

  async createUsers(
    users: Array<{
      email: string;
      name: string;
      password?: string | undefined;
      walletAddress?: string | undefined;
      referrerId?: number | undefined;
      role?: 'USER' | 'ADMIN' | undefined;
    }>,
    serviceName: string
  ): Promise<{
    created: Omit<User, 'password'>[];
    failed: Array<{ email: string; reason: string }>;
  }> {
    const created: Omit<User, 'password'>[] = [];
    const failed: Array<{ email: string; reason: string }> = [];

    // Check for existing emails in batch
    const emails = users.map(u => u.email);
    const existingUsers = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { email: true }
    });
    const existingEmails = new Set(existingUsers.map(u => u.email));

    // Check for existing wallet addresses if provided
    const walletAddresses = users
      .map(u => u.walletAddress)
      .filter((addr): addr is string => addr !== undefined && addr !== null);

    const existingWallets = walletAddresses.length > 0
      ? await prisma.user.findMany({
          where: { walletAddress: { in: walletAddresses } },
          select: { walletAddress: true }
        })
      : [];
    const existingWalletSet = new Set(existingWallets.map(u => u.walletAddress));

    // Validate referrer IDs if provided
    const referrerIds = users
      .map(u => u.referrerId)
      .filter((id): id is number => id !== undefined && id !== null);

    const existingReferrers = referrerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: referrerIds } },
          select: { id: true }
        })
      : [];
    const validReferrerIds = new Set(existingReferrers.map(u => u.id));

    // Import hash password utility
    const { hashPassword } = await import('../../utils/password.utils');

    // Process each user
    for (const userData of users) {
      try {
        // Skip if email already exists
        if (existingEmails.has(userData.email)) {
          failed.push({
            email: userData.email,
            reason: 'Email already exists'
          });
          continue;
        }

        // Skip if wallet address already exists
        if (userData.walletAddress && existingWalletSet.has(userData.walletAddress)) {
          failed.push({
            email: userData.email,
            reason: 'Wallet address already exists'
          });
          continue;
        }

        // Validate referrerId if provided
        if (userData.referrerId && !validReferrerIds.has(userData.referrerId)) {
          failed.push({
            email: userData.email,
            reason: `Referrer ID ${userData.referrerId} does not exist`
          });
          continue;
        }

        // Hash password if provided, otherwise use empty string
        const hashedPassword = userData.password
          ? await hashPassword(userData.password)
          : '';

        // Create user
        const user = await prisma.user.create({
          data: {
            email: userData.email,
            name: userData.name,
            password: hashedPassword,
            walletAddress: userData.walletAddress ?? null,
            referrerId: userData.referrerId ?? null,
            role: userData.role ?? 'USER',
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
          }
        });

        created.push(user);

        // Send webhook notification for each created user (fire-and-forget)
        void sendWebhooks(
          env.WEBHOOK_URLS || [],
          {
            event: 'user.created',
            data: {
              userId: user.id,
              email: user.email,
              serviceName,
              timestamp: new Date().toISOString(),
            },
          },
          env.WEBHOOK_SECRET || ''
        );

        // Send referral webhook if user was created with a referrer (fire-and-forget)
        if (userData.referrerId) {
          void sendWebhooks(
            env.WEBHOOK_URLS || [],
            {
              event: 'referral.created',
              data: {
                referrerId: userData.referrerId,
                referredUserId: user.id,
                timestamp: new Date().toISOString(),
              },
            },
            env.WEBHOOK_SECRET || ''
          );
        }

      } catch (error) {
        failed.push({
          email: userData.email,
          reason: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return { created, failed };
  }
}