import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { TwitterApi } from 'twitter-api-v2';
import { SocialAuthService } from './social.service';
import { UrlQueryInput, CallbackQueryInput, TelegramLinkInput } from './social.validation';
import { successResponse } from '../../utils/response.utils';
import { AuthenticationError } from '../../utils/errors';
import { generateToken } from '../../utils/jwt.utils';
import {
  generateOAuthState,
  validateOAuthState,
  storePKCECodeVerifier,
  retrievePKCECodeVerifier
} from '../../utils/oauth-state.utils';
import { env } from '../../config/env';

export class SocialAuthController {
  private socialAuthService: SocialAuthService;
  private googleClient: OAuth2Client;
  private twitterClient: TwitterApi;

  constructor() {
    this.socialAuthService = new SocialAuthService();
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

  async getGoogleAuthUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { redirectUrl } = req.validatedQuery as UrlQueryInput;

      // Generate state for CSRF protection with redirectUrl
      const state = await generateOAuthState(req.user?.id?.toString(), redirectUrl);

      const authUrl = this.googleClient.generateAuthUrl({
        access_type: 'offline',
        scope: ['profile', 'email'],
        state,
        redirect_uri: env.GOOGLE_REDIRECT_URI
      });

      successResponse(res, { authUrl }, 'Google auth URL generated');
    } catch (error) {
      next(error);
    }
  }

  async googleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    let redirectUrl = env.FRONTEND_DEFAULT_URL;

    try {
      const { code, state, error, error_description } = req.validatedQuery as CallbackQueryInput;

      // Handle OAuth provider errors
      if (error) {
        const errorMessage = error_description || 'OAuth authentication failed';
        throw new AuthenticationError(`Google OAuth error: ${errorMessage}`);
      }

      if (!code || !state) {
        throw new AuthenticationError('Missing required OAuth parameters');
      }

      // CRITICAL: Validate OAuth state for CSRF protection
      const stateValidation = await validateOAuthState(state);
      if (!stateValidation.valid) {
        throw new AuthenticationError('Invalid or expired OAuth state');
      }

      redirectUrl = stateValidation.redirectUrl || env.FRONTEND_DEFAULT_URL;
      const separator = redirectUrl?.includes('?') ? '&' : '?';

      // Check if this is LINKING MODE (authenticated user) or LOGIN MODE
      if (stateValidation.userId) {
        // LINKING MODE: User is authenticated and wants to link Google account
        
        // Get Google profile
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

        const profile = {
          id: payload.sub,
          email: payload.email!,
          name: payload.name!,
          picture: payload.picture,
        };

        // Link the social account
        await this.socialAuthService.linkSocialAccount(
          parseInt(stateValidation.userId),
          'google',
          profile
        );

        // Redirect with success
        res.redirect(`${redirectUrl}${separator}linked=google&success=true`);
      } else {
        // LOGIN MODE: User is not authenticated, perform login/registration
        const user = await this.socialAuthService.handleGoogleCallback(code);
        const token = await generateToken({ userId: user.id, email: user.email });

        // Redirect to frontend with JWT token
        res.redirect(`${redirectUrl}${separator}token=${token}`);
      }
    } catch (error) {
      // Handle OAuth errors with redirect
      if (error instanceof AuthenticationError) {
        const separator = redirectUrl?.includes('?') ? '&' : '?';
        return res.redirect(`${redirectUrl}${separator}error=oauth_failed&message=${encodeURIComponent(error.message)}`);
      }
      next(error);
    }
  }

  async getTwitterAuthUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { redirectUrl } = req.validatedQuery as UrlQueryInput;

      // Generate state for CSRF protection with redirectUrl
      const state = await generateOAuthState(req.user?.id?.toString(), redirectUrl);

      const { url, codeVerifier } = this.twitterClient.generateOAuth2AuthLink(
        env.TWITTER_REDIRECT_URI,
        { scope: ['tweet.read', 'users.read'], state }
      );

      // Store PKCE codeVerifier with state for Twitter OAuth2
      await storePKCECodeVerifier(state, codeVerifier);

      successResponse(res, { authUrl: url }, 'Twitter auth URL generated');
    } catch (error) {
      next(error);
    }
  }

  async getDiscordAuthUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { redirectUrl } = req.validatedQuery as UrlQueryInput;

      // Generate state for CSRF protection with redirectUrl
      const state = await generateOAuthState(req.user?.id?.toString(), redirectUrl);

      const params = new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        redirect_uri: env.DISCORD_REDIRECT_URI,
        response_type: 'code',
        scope: 'identify email',
        state,
      });

      const authUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`;

      successResponse(res, { authUrl }, 'Discord auth URL generated');
    } catch (error) {
      next(error);
    }
  }

  async getLinkGoogleUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { redirectUrl } = req.validatedQuery as UrlQueryInput;
      const userId = req.user?.id;

      if (!userId) {
        throw new AuthenticationError('User must be authenticated to link social accounts');
      }

      // Generate state for CSRF protection with userId and redirectUrl
      const state = await generateOAuthState(userId.toString(), redirectUrl);

      const authUrl = this.googleClient.generateAuthUrl({
        access_type: 'offline',
        scope: ['profile', 'email'],
        state,
        redirect_uri: env.GOOGLE_REDIRECT_URI
      });

      successResponse(res, { authUrl }, 'Google link URL generated');
    } catch (error) {
      next(error);
    }
  }

  async getLinkTwitterUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { redirectUrl } = req.validatedQuery as UrlQueryInput;
      const userId = req.user?.id;

      if (!userId) {
        throw new AuthenticationError('User must be authenticated to link social accounts');
      }

      // Generate state for CSRF protection with userId and redirectUrl
      const state = await generateOAuthState(userId.toString(), redirectUrl);

      const { url, codeVerifier } = this.twitterClient.generateOAuth2AuthLink(
        env.TWITTER_REDIRECT_URI,
        { scope: ['tweet.read', 'users.read'], state }
      );

      // Store PKCE codeVerifier with state for Twitter OAuth2
      await storePKCECodeVerifier(state, codeVerifier);

      successResponse(res, { authUrl: url }, 'Twitter link URL generated');
    } catch (error) {
      next(error);
    }
  }

  async getLinkDiscordUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { redirectUrl } = req.validatedQuery as UrlQueryInput;
      const userId = req.user?.id;

      if (!userId) {
        throw new AuthenticationError('User must be authenticated to link social accounts');
      }

      // Generate state for CSRF protection with userId and redirectUrl
      const state = await generateOAuthState(userId.toString(), redirectUrl);

      const params = new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        redirect_uri: env.DISCORD_REDIRECT_URI,
        response_type: 'code',
        scope: 'identify email',
        state,
      });

      const authUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`;

      successResponse(res, { authUrl }, 'Discord link URL generated');
    } catch (error) {
      next(error);
    }
  }

  async twitterCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    let redirectUrl = env.FRONTEND_DEFAULT_URL;

    try {
      const { code, state, error, error_description } = req.validatedQuery as CallbackQueryInput;

      // Handle OAuth provider errors
      if (error) {
        const errorMessage = error_description || 'OAuth authentication failed';
        throw new AuthenticationError(`Twitter OAuth error: ${errorMessage}`);
      }

      if (!code || !state) {
        throw new AuthenticationError('Missing required OAuth parameters');
      }

      // CRITICAL: Validate OAuth state for CSRF protection
      const stateValidation = await validateOAuthState(state);
      if (!stateValidation.valid) {
        throw new AuthenticationError('Invalid or expired OAuth state');
      }

      // Retrieve PKCE codeVerifier for Twitter OAuth2
      const codeVerifier = await retrievePKCECodeVerifier(state);
      if (!codeVerifier) {
        throw new AuthenticationError('PKCE code verifier not found or expired');
      }

      redirectUrl = stateValidation.redirectUrl || env.FRONTEND_DEFAULT_URL;
      const separator = redirectUrl?.includes('?') ? '&' : '?';

      // Check if this is LINKING MODE (authenticated user) or LOGIN MODE
      if (stateValidation.userId) {
        // LINKING MODE: User is authenticated and wants to link Twitter account

        // Get Twitter profile
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

        const profile = {
          id: me.id,
          username: me.username,
          name: me.name,
          profile_image_url: me.profile_image_url,
          email: undefined,
        };

        // Link the social account
        await this.socialAuthService.linkSocialAccount(
          parseInt(stateValidation.userId),
          'twitter',
          profile
        );

        // Redirect with success
        res.redirect(`${redirectUrl}${separator}linked=twitter&success=true`);
      } else {
        // LOGIN MODE: User is not authenticated, perform login/registration
        const user = await this.socialAuthService.handleTwitterCallback(code, codeVerifier);
        const token = await generateToken({ userId: user.id, email: user.email });

        // Redirect to frontend with JWT token
        res.redirect(`${redirectUrl}${separator}token=${token}`);
      }
    } catch (error) {
      // Handle OAuth errors with redirect
      if (error instanceof AuthenticationError) {
        const separator = redirectUrl?.includes('?') ? '&' : '?';
        return res.redirect(`${redirectUrl}${separator}error=oauth_failed&message=${encodeURIComponent(error.message)}`);
      }
      next(error);
    }
  }

  async discordCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    let redirectUrl = env.FRONTEND_DEFAULT_URL;

    try {
      const { code, state, error, error_description } = req.validatedQuery as CallbackQueryInput;

      // Handle OAuth provider errors
      if (error) {
        const errorMessage = error_description || 'OAuth authentication failed';
        throw new AuthenticationError(`Discord OAuth error: ${errorMessage}`);
      }

      if (!code || !state) {
        throw new AuthenticationError('Missing required OAuth parameters');
      }

      // CRITICAL: Validate OAuth state for CSRF protection
      const stateValidation = await validateOAuthState(state);
      if (!stateValidation.valid) {
        throw new AuthenticationError('Invalid or expired OAuth state');
      }

      redirectUrl = stateValidation.redirectUrl || env.FRONTEND_DEFAULT_URL;
      const separator = redirectUrl?.includes('?') ? '&' : '?';

      // Check if this is LINKING MODE (authenticated user) or LOGIN MODE
      if (stateValidation.userId) {
        // LINKING MODE: User is authenticated and wants to link Discord account

        // Exchange code for access token and get Discord profile
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

        const profile = {
          id: userData.id,
          username: userData.username,
          discriminator: userData.discriminator,
          name: userData.discriminator === '0'
            ? userData.username
            : `${userData.username}#${userData.discriminator}`,
          email: userData.email || undefined,
          avatar: userData.avatar
            ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
            : undefined,
        };

        // Link the social account
        await this.socialAuthService.linkSocialAccount(
          parseInt(stateValidation.userId),
          'discord',
          profile
        );

        // Redirect with success
        res.redirect(`${redirectUrl}${separator}linked=discord&success=true`);
      } else {
        // LOGIN MODE: User is not authenticated, perform login/registration
        const user = await this.socialAuthService.handleDiscordCallback(code);
        const token = await generateToken({ userId: user.id, email: user.email });

        // Redirect to frontend with JWT token
        res.redirect(`${redirectUrl}${separator}token=${token}`);
      }
    } catch (error) {
      // Handle OAuth errors with redirect
      if (error instanceof AuthenticationError) {
        const separator = redirectUrl?.includes('?') ? '&' : '?';
        return res.redirect(`${redirectUrl}${separator}error=oauth_failed&message=${encodeURIComponent(error.message)}`);
      }
      next(error);
    }
  }

  async linkTelegramAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      const telegramData = req.validatedBody as TelegramLinkInput;

      await this.socialAuthService.linkTelegramAccount(userId, telegramData);

      successResponse(res, null, 'Telegram account linked successfully');
    } catch (error) {
      next(error);
    }
  }

  async unlinkSocialAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { provider } = req.params as { provider: string };
      const userId = req.user?.id;

      if (!userId) {
        throw new AuthenticationError('User must be authenticated to unlink social accounts');
      }

      await this.socialAuthService.unlinkSocialAccount(userId, provider);

      successResponse(res, null, `${provider} account unlinked successfully`);
    } catch (error) {
      next(error);
    }
  }

  async getConnectedAccounts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new AuthenticationError('User must be authenticated');
      }

      const connectedAccounts = await this.socialAuthService.getConnectedSocialAccounts(userId);

      successResponse(res, { connected_accounts: connectedAccounts }, 'Connected social accounts retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}