import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { TwitterApi } from 'twitter-api-v2';
import { SocialAuthService } from './social.service';
import { UrlQueryInput, CallbackQueryInput } from './social.validation';
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

      const user = await this.socialAuthService.handleGoogleCallback(code);
      const token = await generateToken({ userId: user.id, email: user.email });

      // Redirect to frontend with JWT token
      const redirectUrl = stateValidation.redirectUrl || env.FRONTEND_DEFAULT_URL;
      const separator = redirectUrl?.includes('?') ? '&' : '?';

      res.redirect(`${redirectUrl}${separator}token=${token}`);
    } catch (error) {
      // Handle OAuth errors with fallback redirect
      if (error instanceof AuthenticationError) {
        const fallbackUrl = env.FRONTEND_DEFAULT_URL;
        const separator = fallbackUrl?.includes('?') ? '&' : '?';
        return res.redirect(`${fallbackUrl}${separator}error=oauth_failed&message=${encodeURIComponent(error.message)}`);
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

  async twitterCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      const user = await this.socialAuthService.handleTwitterCallback(code, codeVerifier);
      const token = await generateToken({ userId: user.id, email: user.email });

      // Redirect to frontend with JWT token
      const redirectUrl = stateValidation.redirectUrl || env.FRONTEND_DEFAULT_URL;
      const separator = redirectUrl?.includes('?') ? '&' : '?';

      res.redirect(`${redirectUrl}${separator}token=${token}`);
    } catch (error) {
      // Handle OAuth errors with fallback redirect
      if (error instanceof AuthenticationError) {
        const fallbackUrl = env.FRONTEND_DEFAULT_URL;
        const separator = fallbackUrl?.includes('?') ? '&' : '?';
        return res.redirect(`${fallbackUrl}${separator}error=oauth_failed&message=${encodeURIComponent(error.message)}`);
      }
      next(error);
    }
  }
}