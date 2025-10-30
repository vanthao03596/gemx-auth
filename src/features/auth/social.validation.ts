import { z } from 'zod';
import { env } from '../../config/env';

export const urlQuerySchema = z.object({
  redirectUrl: z.string()
    .url('Redirect URL must be a valid URL')
    .optional()
    .refine((url) => {
      if (!url) return true;
      // Validate allowed domains for security
      const allowedDomains = env.CORS_ORIGINS || ['localhost'];
      const urlObj = new URL(url);
      return allowedDomains.some(domain =>
        urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
      );
    }, 'Redirect URL domain not allowed'),
});

export const callbackQuerySchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'OAuth state parameter is required'),
  error: z.string().optional(), // OAuth provider error
  error_description: z.string().optional(), // OAuth error details
});

export const unlinkParamsSchema = z.object({
  provider: z.enum(['google', 'twitter', 'discord', 'telegram'], {
    message: 'Provider must be either google, twitter, discord, or telegram'
  })
});

export const telegramLinkSchema = z.object({
  id: z.number().min(1, 'Telegram user ID is required'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().url('Photo URL must be a valid URL').optional(),
  auth_date: z.number().min(1, 'Auth date is required'),
  hash: z.string().min(1, 'Hash is required'),
});

export type UrlQueryInput = z.infer<typeof urlQuerySchema>;
export type CallbackQueryInput = z.infer<typeof callbackQuerySchema>;
export type UnlinkParamsInput = z.infer<typeof unlinkParamsSchema>;
export type TelegramLinkInput = z.infer<typeof telegramLinkSchema>;