import { User } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import { TwitterApi } from 'twitter-api-v2';
import { prisma } from '../../config/database';
import { AuthenticationError } from '../../utils/errors';
import { env } from '../../config/env';

interface GoogleProfile {
  id: string;
  email: string;
  name: string;
  picture?: string | undefined;
}

interface TwitterProfile {
  id: string;
  username: string;
  name: string;
  profile_image_url?: string | undefined;
  email?: string | undefined;
}

interface DiscordProfile {
  id: string;
  username: string;
  discriminator: string;
  name: string;
  email?: string | undefined;
  avatar?: string | undefined;
}

export class SocialAuthService {
  private googleClient: OAuth2Client;
  private twitterClient: TwitterApi;

  constructor() {
    this.googleClient = new OAuth2Client(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_REDIRECT_URI
    );

    this.twitterClient = new TwitterApi({
      clientId: env.TWITTER_CLIENT_ID,
      clientSecret: env.TWITTER_CLIENT_SECRET,
    });
  }

  async handleGoogleCallback(code: string): Promise<Omit<User, 'password'>> {
    try {
      const { tokens } = await this.googleClient.getToken(code);
      this.googleClient.setCredentials(tokens);

      const ticket = await this.googleClient.verifyIdToken({
        idToken: tokens.id_token!,
        audience: env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new AuthenticationError('Invalid Google token payload');
      }

      const profile: GoogleProfile = {
        id: payload.sub,
        email: payload.email!,
        name: payload.name!,
        picture: payload.picture,
      };

      return await this.findOrCreateUser('google', profile);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError('Google authentication failed');
    }
  }

  async handleTwitterCallback(code: string, codeVerifier: string): Promise<Omit<User, 'password'>> {
    try {
      const { accessToken } = await this.twitterClient.loginWithOAuth2({
        code,
        codeVerifier,
        redirectUri: env.TWITTER_REDIRECT_URI,
      });

      const twitterUser = new TwitterApi(accessToken);
      const { data: me } = await twitterUser.v2.me({
        'user.fields': ['name', 'username', 'profile_image_url', 'public_metrics'],
      });

      if (!me) {
        throw new AuthenticationError('Failed to fetch Twitter user data');
      }

      const profile: TwitterProfile = {
        id: me.id,
        username: me.username,
        name: me.name,
        profile_image_url: me.profile_image_url,
        // Twitter API v2 doesn't provide email by default
        email: undefined,
      };

      return await this.findOrCreateUser('twitter', profile);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError('Twitter authentication failed');
    }
  }

  async handleDiscordCallback(code: string): Promise<Omit<User, 'password'>> {
    try {
      // Exchange code for access token
      const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: env.DISCORD_CLIENT_ID,
          client_secret: env.DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: env.DISCORD_REDIRECT_URI,
        }),
      });

      if (!tokenResponse.ok) {
        throw new AuthenticationError('Failed to exchange Discord authorization code');
      }

      const tokenData = await tokenResponse.json() as { access_token: string };
      const accessToken = tokenData.access_token;

      // Fetch user profile
      const userResponse = await fetch('https://discord.com/api/users/@me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!userResponse.ok) {
        throw new AuthenticationError('Failed to fetch Discord user data');
      }

      const userData = await userResponse.json() as {
        id: string;
        username: string;
        discriminator: string;
        email?: string;
        avatar?: string;
      };

      const profile: DiscordProfile = {
        id: userData.id,
        username: userData.username,
        discriminator: userData.discriminator,
        // Discord's new username system uses discriminator "0" for new usernames
        name: userData.discriminator === '0'
          ? userData.username
          : `${userData.username}#${userData.discriminator}`,
        email: userData.email || undefined,
        avatar: userData.avatar
          ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
          : undefined,
      };

      return await this.findOrCreateUser('discord', profile);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError('Discord authentication failed');
    }
  }

  async linkSocialAccount(
    userId: number,
    provider: string,
    profile: GoogleProfile | TwitterProfile | DiscordProfile
  ): Promise<void> {
    // Check if social account already exists for another user
    const existingSocialAccount = await prisma.socialAccount.findUnique({
      where: {
        provider_providerId: {
          provider,
          providerId: profile.id
        }
      }
    });

    if (existingSocialAccount) {
      if (existingSocialAccount.userId === userId) {
        throw new AuthenticationError('This social account is already linked to your account');
      }
      throw new AuthenticationError('This social account is already linked to another user');
    }

    // Create the social account link
    await prisma.socialAccount.create({
      data: {
        userId,
        provider,
        providerId: profile.id,
        email: 'email' in profile ? profile.email || null : null,
        name: profile.name,
        avatar: 'picture' in profile ? profile.picture || null :
                'profile_image_url' in profile ? profile.profile_image_url || null : null,
      }
    });
  }

  async unlinkSocialAccount(userId: number, provider: string): Promise<void> {
    // Find the social account
    const socialAccount = await prisma.socialAccount.findFirst({
      where: {
        userId,
        provider
      }
    });

    if (!socialAccount) {
      throw new AuthenticationError(`No ${provider} account linked to this user`);
    }

    // Check if user has other authentication methods
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        socialAccounts: true
      }
    });

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    // Prevent unlinking if it's the only authentication method
    // User must have either a password or at least 2 social accounts
    const hasPassword = user.password && user.password.length > 0;
    const socialAccountCount = user.socialAccounts.length;

    if (!hasPassword && socialAccountCount <= 1) {
      throw new AuthenticationError(
        'Cannot unlink the only authentication method. Please set a password or link another social account first.'
      );
    }

    // Delete the social account
    await prisma.socialAccount.delete({
      where: { id: socialAccount.id }
    });
  }

  async getConnectedSocialAccounts(userId: number) {
    const socialAccounts = await prisma.socialAccount.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return socialAccounts;
  }

  private async findOrCreateUser(
    provider: string,
    profile: GoogleProfile | TwitterProfile | DiscordProfile
  ): Promise<Omit<User, 'password'>> {
    // Check if social account exists
    const socialAccount = await prisma.socialAccount.findUnique({
      where: {
        provider_providerId: {
          provider,
          providerId: profile.id
        }
      },
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

    if (socialAccount) {
      // Update social account info if needed
      await prisma.socialAccount.update({
        where: { id: socialAccount.id },
        data: {
          email: 'email' in profile ? profile.email || null : socialAccount.email,
          name: profile.name,
          avatar: 'picture' in profile ? profile.picture || null :
                  'profile_image_url' in profile ? profile.profile_image_url || null :
                  socialAccount.avatar,
          updatedAt: new Date(),
        }
      });

      return socialAccount.user;
    }

    // For Twitter users without email, we need to handle this differently
    let user: User | null = null;

    if ('email' in profile && profile.email) {
      // Check if user exists by email (for Google or Twitter with email)
      user = await prisma.user.findUnique({
        where: { email: profile.email },
        select: {
          id: true,
          email: true,
          name: true,
          walletAddress: true,
          referrerId: true,
          createdAt: true,
          updatedAt: true,
          lastDailyLogin: true,
          password: true, // Need this for the transaction
          role: true
        }
      });
    }

    if (!user) {
      // Create new user - handle email appropriately
      const email = 'email' in profile && profile.email ?
                   profile.email :
                   `${profile.id}@${provider}.local`; // Fallback email for Twitter

      user = await prisma.user.create({
        data: {
          email,
          name: profile.name,
          password: '', // No password for social users
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
          password: true, // Need this for the transaction\
          role: true
        }
      });
    }

    // Link social account
    await prisma.socialAccount.create({
      data: {
        userId: user!.id,
        provider,
        providerId: profile.id,
        email: 'email' in profile ? profile.email || null : null,
        name: profile.name,
        avatar: 'picture' in profile ? profile.picture || null :
                'profile_image_url' in profile ? profile.profile_image_url || null : null,
      }
    });

    // Return user without password
    const { password, ...userWithoutPassword } = user!;
    return userWithoutPassword;
  }
}