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

export type UrlQueryInput = z.infer<typeof urlQuerySchema>;
export type CallbackQueryInput = z.infer<typeof callbackQuerySchema>;