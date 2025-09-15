name: "Social Authentication - Google and X(Twitter) Integration"
description: |
  Simple social authentication feature for Google and X(Twitter) using google-auth-library and twitter-api-v2.
  Follows existing auth patterns and database structure.

---

## Goal

**Feature Goal**: Add Google and X(Twitter) social authentication to existing auth system

**Deliverable**: Social auth endpoints that allow users to authenticate with Google and X(Twitter)

**Success Definition**: Users can sign in with Google and/or X(Twitter), link both accounts to one user profile

## Why

- Users want quick sign-in without creating passwords
- Reduce signup friction with social providers
- Allow users to link multiple social accounts

## What

Social authentication endpoints that:
- Generate OAuth URLs for Google and X(Twitter) with redirectUrl support (SPA-compatible)
- Handle OAuth callbacks via GET endpoints with full page redirects
- Link social accounts to existing users
- Create new users from social auth
- Return JWT tokens via redirect query parameters to frontend

### Success Criteria

- [ ] GET /api/v1/auth/google/url?redirectUrl=frontend-url - returns Google OAuth URL for SPA
- [ ] GET /api/v1/auth/google/callback - handles Google OAuth callback with full page redirect
- [ ] GET /api/v1/auth/twitter/url?redirectUrl=frontend-url - returns X(Twitter) OAuth URL for SPA
- [ ] GET /api/v1/auth/twitter/callback - handles X(Twitter) OAuth callback with full page redirect
- [ ] Users can link both Google and Twitter to same account
- [ ] Returns JWT token via redirect query parameter to frontend
- [ ] SPA frontend can initiate OAuth flows with full page redirects

## All Needed Context

### Context Completeness Check

_"Someone unfamiliar with this codebase would have everything needed to implement Google and X(Twitter) social auth using existing patterns"_

### Documentation & References

```yaml
# Authentication Libraries
- url: https://github.com/googleapis/google-auth-library-nodejs
  why: OAuth2Client setup, token verification, user profile fetching
  critical: Use OAuth2Client with clientId, clientSecret, redirectUri pattern

- url: https://github.com/PLhery/node-twitter-api-v2
  why: TwitterApi OAuth2 flow, generateOAuth2AuthLink, loginWithOAuth2
  critical: PKCE flow requires storing codeVerifier in session/Redis

# Existing Auth Patterns
- file: src/features/auth/auth.controller.ts
  why: Controller pattern - async methods with try/catch, successResponse calls
  pattern: Request/Response/NextFunction typing, validatedBody casting
  gotcha: Always call next(error) in catch blocks

- file: src/features/auth/auth.service.ts
  why: Service pattern - database operations, business logic separation
  pattern: Class-based services, private methods, error throwing
  gotcha: Exclude password from User responses using Prisma select

- file: src/features/auth/auth.routes.ts
  why: Route setup pattern with middleware chaining
  pattern: Router instance, middleware before controller methods
  gotcha: Rate limiting applied to auth endpoints

- file: src/features/auth/auth.validation.ts
  why: Zod schema patterns and type inference
  pattern: Export schema and infer types, custom error messages
  gotcha: Use z.infer<typeof schema> for TypeScript types
```

### Current Codebase tree

```bash
src/features/auth/
├── auth.controller.ts   # HTTP request handling
├── auth.service.ts      # Business logic and database operations
├── auth.routes.ts       # Route definitions with middleware
└── auth.validation.ts   # Zod validation schemas
```

### Desired Codebase tree with files to be added

```bash
src/features/auth/
├── auth.controller.ts   # Existing
├── auth.service.ts      # Existing
├── auth.routes.ts       # Existing - ADD social routes
├── auth.validation.ts   # Existing
├── social.controller.ts # NEW - Google/Twitter OAuth controllers
├── social.service.ts    # NEW - Social auth business logic
└── social.validation.ts # NEW - Social auth validation schemas

# Database schema update needed
prisma/schema.prisma     # ADD SocialAccount model
```

### Known Gotchas of our codebase & Library Quirks

```typescript
// CRITICAL: JWT utils use RS256 with PEM keys - maintain compatibility
// src/utils/jwt.utils.ts - generateToken expects { userId: number, email: string }

// CRITICAL: Database uses INT auto-increment IDs and snake_case mapping
// Follow existing User model pattern with @map() directives

// CRITICAL: Existing auth middleware expects req.user with Omit<User, 'password'>
// Social auth must return same user structure

// CRITICAL: Rate limiting uses Redis - configure for social auth endpoints
// Follow existing rateLimiter.middleware.ts patterns

// CRITICAL: Error handling uses custom AppError classes
// Use ConflictError, AuthenticationError from utils/errors.ts

// Library Quirks:
// Google: OAuth2Client requires exact redirect URI match
// Twitter: PKCE codeVerifier must be stored between request/callback
```

## Implementation Blueprint

### Data models and structure

```typescript
// Extend existing Prisma schema
model SocialAccount {
  id          Int      @id @default(autoincrement())
  userId      Int      @map("user_id")
  provider    String   @map("provider")      // 'google' | 'twitter'
  providerId  String   @map("provider_id")   // external user ID
  email       String?  @map("email")
  name        String?  @map("name")
  avatar      String?  @map("avatar")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerId])
  @@map("social_accounts")
}

// Add to existing User model
model User {
  // ... existing fields
  socialAccounts SocialAccount[]
}
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: UPDATE prisma/schema.prisma
  - IMPLEMENT: Add SocialAccount model with provider/providerId unique constraint
  - FOLLOW pattern: Existing User/OtpCode relationship pattern
  - NAMING: snake_case database mapping, INT auto-increment ID
  - PLACEMENT: After existing models in schema file

Task 2: CREATE src/utils/oauth-state.utils.ts
  - IMPLEMENT: OAuth state generation and validation using Redis
  - FOLLOW pattern: src/utils/redis.utils.ts (Redis operations, error handling)
  - NAMING: generateOAuthState, validateOAuthState functions
  - DEPENDENCIES: Redis client, crypto module
  - PLACEMENT: Utility functions for OAuth state management

Task 3: CREATE src/features/auth/social.validation.ts
  - IMPLEMENT: Zod schemas for OAuth URL query params and callback query params
  - FOLLOW pattern: src/features/auth/auth.validation.ts (schema structure, error messages)
  - NAMING: urlQuerySchema for { redirectUrl?: string }, callbackQuerySchema for { code: string, state: string }
  - DEPENDENCIES: Import z from 'zod'
  - PLACEMENT: Auth feature validation file

Task 3.1: UPDATE src/config/env.ts
  - IMPLEMENT: Add OAuth environment variables to schema
  - FOLLOW pattern: Existing environment variable validation with z.string()
  - NAMING: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET, TWITTER_REDIRECT_URI, FRONTEND_DEFAULT_URL
  - DEPENDENCIES: Extend existing envSchema
  - PLACEMENT: Add to existing env.ts configuration

Task 4: CREATE src/features/auth/social.service.ts
  - IMPLEMENT: Social auth business logic - find/create users, link accounts
  - FOLLOW pattern: src/features/auth/auth.service.ts (class structure, prisma usage)
  - NAMING: SocialAuthService class, camelCase methods
  - DEPENDENCIES: Prisma client, OAuth libraries, JWT utils, oauth-state utils
  - PLACEMENT: Auth feature service file

Task 5: CREATE src/features/auth/social.controller.ts
  - IMPLEMENT: OAuth flow controllers for Google and Twitter with state validation
  - FOLLOW pattern: src/features/auth/auth.controller.ts (async methods, error handling)
  - NAMING: SocialAuthController class, method names match routes
  - DEPENDENCIES: Import social service, OAuth libraries, validation schemas, oauth-state utils
  - PLACEMENT: Auth feature controller file

Task 6: UPDATE src/features/auth/auth.routes.ts
  - IMPLEMENT: Add social auth routes with existing middleware patterns
  - FOLLOW pattern: Existing route structure with rate limiting
  - NAMING: GET /google/url, GET /google/callback, GET /twitter/url, GET /twitter/callback
  - DEPENDENCIES: Import social controller, validation middleware
  - PLACEMENT: Add to existing auth routes
```

### Implementation Patterns & Key Details

```typescript
// Environment Variable Validation - extends existing env.ts schema
import { z } from 'zod';

const envSchema = z.object({
  // ... existing environment variables

  // OAuth configuration
  GOOGLE_CLIENT_ID: z.string().min(1, 'Google Client ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'Google Client Secret is required'),
  GOOGLE_REDIRECT_URI: z.string().url('Google Redirect URI must be a valid URL'),
  TWITTER_CLIENT_ID: z.string().min(1, 'Twitter Client ID is required'),
  TWITTER_CLIENT_SECRET: z.string().min(1, 'Twitter Client Secret is required'),
  TWITTER_REDIRECT_URI: z.string().url('Twitter Redirect URI must be a valid URL'),
  FRONTEND_DEFAULT_URL: z.string().url('Frontend Default URL must be a valid URL').default('http://localhost:3000'),
});

// Validation Schema Implementations - src/features/auth/social.validation.ts
export const urlQuerySchema = z.object({
  redirectUrl: z.string()
    .url('Redirect URL must be a valid URL')
    .optional()
    .refine((url) => {
      if (!url) return true;
      // Validate allowed domains for security
      const allowedDomains = env.CORS_ORIGINS?.split(',') || ['localhost'];
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

// OAuth State Management - follows existing Redis utils pattern
import crypto from 'crypto';
import { redis } from '../config/redis';

export const generateOAuthState = async (userId?: string, redirectUrl?: string): Promise<string> => {
  const state = crypto.randomBytes(32).toString('hex');
  const stateData = {
    timestamp: Date.now(),
    userId: userId || null,
    redirectUrl: redirectUrl || null
  };

  // 10-minute expiration following existing Redis patterns
  await redis.setEx(`oauth:state:${state}`, 600, JSON.stringify(stateData));
  return state;
};

export const validateOAuthState = async (state: string): Promise<{ valid: boolean; userId?: string; redirectUrl?: string }> => {
  const stateData = await redis.get(`oauth:state:${state}`);

  if (!stateData) {
    return { valid: false };
  }

  // One-time use - delete immediately after validation
  await redis.del(`oauth:state:${state}`);

  const parsed = JSON.parse(stateData);
  return { valid: true, userId: parsed.userId, redirectUrl: parsed.redirectUrl };
};

// Social Service Pattern - extends existing service patterns
export class SocialAuthService {
  async findOrCreateUser(provider: string, profile: any): Promise<User> {
    // Check if social account exists
    const socialAccount = await prisma.socialAccount.findUnique({
      where: { provider_providerId: { provider, providerId: profile.id }},
      include: { user: { select: { id: true, email: true, name: true, createdAt: true }}}
    });

    if (socialAccount) {
      return socialAccount.user;
    }

    // Check if user exists by email
    let user = await prisma.user.findUnique({ where: { email: profile.email }});

    if (!user) {
      // Create new user - follow existing pattern
      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          password: '', // No password for social users
        }
      });
    }

    // Link social account
    await prisma.socialAccount.create({
      data: {
        userId: user.id,
        provider,
        providerId: profile.id,
        email: profile.email,
        name: profile.name
      }
    });

    return user;
  }
}

// Controller Pattern - matches existing auth controller
export class SocialAuthController {
  private socialAuthService: SocialAuthService;

  constructor() {
    this.socialAuthService = new SocialAuthService();
  }

  async getGoogleAuthUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { redirectUrl } = req.validatedQuery as UrlQueryInput;

      // Generate state for CSRF protection with redirectUrl
      const state = await generateOAuthState(req.user?.id, redirectUrl);

      const authUrl = googleOAuth2Client.generateAuthUrl({
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
      const state = await generateOAuthState(req.user?.id, redirectUrl);

      const { url, codeVerifier } = twitterClient.generateOAuth2AuthLink(
        env.TWITTER_REDIRECT_URI!,
        { scope: ['tweet.read', 'users.read'], state }
      );

      // Store PKCE codeVerifier with state for Twitter OAuth2
      await redis.setEx(`twitter:pkce:${state}`, 600, codeVerifier);

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
      const codeVerifier = await redis.get(`twitter:pkce:${state}`);
      if (!codeVerifier) {
        throw new AuthenticationError('PKCE code verifier not found or expired');
      }

      await redis.del(`twitter:pkce:${state}`); // One-time use

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
```

### SPA Frontend Integration Workflow

```typescript
// Frontend SPA workflow example with full page redirects
const initiateGoogleAuth = async () => {
  // 1. Get auth URL from backend with current page as redirectUrl
  const currentUrl = window.location.origin + window.location.pathname;
  const response = await fetch(`/api/v1/auth/google/url?redirectUrl=${encodeURIComponent(currentUrl)}`);
  const { authUrl } = await response.json();

  // 2. Redirect full page to OAuth provider
  window.location.href = authUrl;
};

// 3. After OAuth completion, user returns to frontend with token
// Check for token in URL params on page load
const handleOAuthReturn = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (token) {
    // Store JWT token
    localStorage.setItem('authToken', token);

    // Clean URL by removing token parameter
    const url = new URL(window.location.href);
    url.searchParams.delete('token');
    window.history.replaceState({}, document.title, url.toString());

    // Redirect to authenticated area or update UI
    window.location.href = '/dashboard';
  }
};

// Handle OAuth errors from redirect
const handleOAuthError = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const error = urlParams.get('error');
  const message = urlParams.get('message');

  if (error === 'oauth_failed') {
    // Display error to user
    alert(`Authentication failed: ${decodeURIComponent(message || 'Unknown error')}`);

    // Clean error parameters from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('error');
    url.searchParams.delete('message');
    window.history.replaceState({}, document.title, url.toString());
  }
};

// Usage in SPA
// On auth button click
document.getElementById('google-login').addEventListener('click', initiateGoogleAuth);

// On page load - handle both success and error cases
document.addEventListener('DOMContentLoaded', () => {
  handleOAuthReturn();
  handleOAuthError();
});
```

### Integration Points

```yaml
DATABASE:
  - migration: "Add SocialAccount table with User foreign key"
  - client: "Use existing prisma instance from src/config/database.ts"
  - pattern: "Follow existing User/OtpCode relationship pattern"

CONFIG:
  - add to: .env
  - pattern: "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET, TWITTER_REDIRECT_URI, FRONTEND_DEFAULT_URL"
  - validation: "Add to src/config/env.ts schema"

ROUTES:
  - integration: "Add to existing src/features/auth/auth.routes.ts"
  - pattern: "Use existing rate limiting and error middleware"
  - naming: "GET /api/v1/auth/{provider}/url?redirectUrl=... and GET /api/v1/auth/{provider}/callback"
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# Run after each file creation
npm run lint                    # ESLint with existing rules
npm run build                   # TypeScript compilation check
npx prisma generate            # Update Prisma client types

# Expected: Zero errors. Fix before proceeding.
```

### Level 2: Integration Testing (System Validation)

```bash
# Development server with social auth
npm run dev

# Test OAuth URL generation
curl http://localhost:3000/api/v1/auth/google/url
# Expected: 200 with JSON { "authUrl": "https://accounts.google.com/...", "state": "..." }

curl http://localhost:3000/api/v1/auth/twitter/url
# Expected: 200 with JSON { "authUrl": "https://twitter.com/i/oauth2/...", "state": "..." }

# Database migration
npm run db:push
# Expected: SocialAccount table created successfully
```

### Level 3: Manual OAuth Flow Testing

```bash
# Test complete OAuth flows manually with full page redirect workflow
# 1. GET /api/v1/auth/google/url?redirectUrl=http://localhost:3000/dashboard
# 2. Navigate to returned authUrl in browser
# 3. Complete OAuth flow with Google
# 4. Verify redirect to http://localhost:3000/dashboard?token=xxx
# 5. Verify JWT token validity and user creation/linking

# Expected: Working OAuth flows, proper user creation/linking
```

## Final Validation Checklist

### Technical Validation

- [ ] All validation levels completed successfully
- [ ] No linting errors: `npm run lint`
- [ ] No type errors: `npm run build`
- [ ] Database migration successful: `npm run db:push`
- [ ] Prisma client updated: `npx prisma generate`

### Feature Validation

- [ ] Google OAuth flow works end-to-end
- [ ] Twitter OAuth flow works end-to-end
- [ ] Users can link both Google and Twitter accounts
- [ ] Returns JWT tokens compatible with existing auth
- [ ] Proper error handling for OAuth failures
- [ ] Rate limiting applied to social auth endpoints
- [ ] RedirectUrl validation prevents unauthorized redirects
- [ ] Environment variables properly validated on startup
- [ ] OAuth provider errors handled gracefully with user feedback
- [ ] Token generation failures redirect with error messages

### Code Quality Validation

- [ ] Follows existing auth feature patterns exactly
- [ ] File placement matches current structure
- [ ] Database schema follows existing conventions
- [ ] TypeScript types properly defined and used
- [ ] Error handling uses existing AppError classes

---

## Anti-Patterns to Avoid

- ❌ Don't create complex provider abstractions - just implement Google and Twitter directly
- ❌ Don't change existing JWT format or auth middleware
- ❌ Don't create new database patterns - follow User/OtpCode relationship style
- ❌ Don't skip OAuth state validation - critical for CSRF protection
- ❌ Don't store tokens in plain text - follow existing encryption patterns if needed