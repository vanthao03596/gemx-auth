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

  private async findOrCreateUser(
    provider: string,
    profile: GoogleProfile | TwitterProfile
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
            createdAt: true,
            updatedAt: true
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
          createdAt: true,
          updatedAt: true,
          password: true // Need this for the transaction
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
          createdAt: true,
          updatedAt: true,
          password: true // Need this for the transaction
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