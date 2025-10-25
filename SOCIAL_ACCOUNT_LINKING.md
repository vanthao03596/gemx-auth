# Social Account Linking Feature

## Overview
This feature allows authenticated users to link/unlink Google and Twitter accounts to their existing profile.

## API Endpoints

### 1. Get Link URL (Google)
**Endpoint:** `GET /auth/link/google/url`
**Authentication:** Required (JWT Bearer token)
**Query Parameters:**
- `redirectUrl` (optional): URL to redirect after successful linking

**Response:**
```json
{
  "success": true,
  "message": "Google link URL generated",
  "data": {
    "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
  }
}
```

**Usage:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:3000/auth/link/google/url?redirectUrl=http://localhost:3000/dashboard"
```

### 2. Get Link URL (Twitter)
**Endpoint:** `GET /auth/link/twitter/url`
**Authentication:** Required (JWT Bearer token)
**Query Parameters:**
- `redirectUrl` (optional): URL to redirect after successful linking

**Response:**
```json
{
  "success": true,
  "message": "Twitter link URL generated",
  "data": {
    "authUrl": "https://twitter.com/i/oauth2/authorize?..."
  }
}
```

### 3. Link Callback (Google)
**Endpoint:** `GET /auth/link/google/callback`
**Authentication:** Not required (state contains userId)
**Query Parameters:**
- `code`: OAuth authorization code
- `state`: OAuth state parameter

**Behavior:**
- Validates OAuth state for CSRF protection
- Fetches Google profile information
- Links social account to authenticated user
- Redirects to frontend: `{redirectUrl}?linked=google&success=true`

**Error Handling:**
- If social account already linked to another user: redirects with error
- If social account already linked to same user: redirects with error
- On any error: `{redirectUrl}?error=link_failed&message=...`

### 4. Link Callback (Twitter)
**Endpoint:** `GET /auth/link/twitter/callback`
**Authentication:** Not required (state contains userId)
**Query Parameters:**
- `code`: OAuth authorization code
- `state`: OAuth state parameter

**Behavior:**
- Same as Google callback but for Twitter
- Redirects to: `{redirectUrl}?linked=twitter&success=true`

### 5. Unlink Social Account
**Endpoint:** `DELETE /auth/social/:provider`
**Authentication:** Required (JWT Bearer token)
**URL Parameters:**
- `provider`: Either `google` or `twitter`

**Response:**
```json
{
  "success": true,
  "message": "google account unlinked successfully",
  "data": null
}
```

**Usage:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:3000/auth/social/google"
```

**Error Handling:**
- Returns error if provider not found
- Returns error if trying to unlink the only authentication method
- User must have either a password OR at least 2 social accounts

## Frontend Integration Flow

### Linking Flow
1. User clicks "Link Google Account" button in settings
2. Frontend calls `GET /auth/link/google/url?redirectUrl=http://yourapp.com/settings`
3. Frontend redirects user to the returned `authUrl`
4. User authorizes on Google
5. Google redirects to backend callback URL
6. Backend processes linking and redirects to: `http://yourapp.com/settings?linked=google&success=true`
7. Frontend displays success message

### Unlinking Flow
1. User clicks "Unlink Google Account" button
2. Frontend calls `DELETE /auth/social/google` with JWT token
3. Backend validates and unlinks account
4. Frontend displays success message

## Security Features

1. **CSRF Protection**: OAuth state parameter validated for all callbacks
2. **Authentication Required**: Link URLs require valid JWT token
3. **One-Time State**: OAuth state tokens are deleted after use
4. **PKCE for Twitter**: Code verifier used for Twitter OAuth2
5. **Duplicate Prevention**: Cannot link same social account to multiple users
6. **Account Safety**: Cannot unlink if it's the only authentication method

## Database Schema

The existing `SocialAccount` table is used:
```prisma
model SocialAccount {
  id         Int      @id @default(autoincrement())
  userId     Int
  provider   String   // "google" or "twitter"
  providerId String   // Social provider's user ID
  email      String?
  name       String?
  avatar     String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  user       User     @relation(fields: [userId], references: [id])

  @@unique([provider, providerId])
}
```

## Code Structure

### Modified Files

1. **[src/features/auth/social.service.ts](src/features/auth/social.service.ts)**
   - `linkSocialAccount()`: Links a social account to authenticated user
   - `unlinkSocialAccount()`: Removes social account link with safety checks

2. **[src/features/auth/social.controller.ts](src/features/auth/social.controller.ts)**
   - `getLinkGoogleUrl()`: Generate OAuth URL for linking (authenticated)
   - `getLinkTwitterUrl()`: Generate OAuth URL for linking (authenticated)
   - `linkGoogleCallback()`: Handle Google OAuth callback for linking
   - `linkTwitterCallback()`: Handle Twitter OAuth callback for linking
   - `unlinkSocialAccount()`: Remove social account link

3. **[src/features/auth/social.validation.ts](src/features/auth/social.validation.ts)**
   - `unlinkParamsSchema`: Validation for unlink request

4. **[src/features/auth/auth.routes.ts](src/features/auth/auth.routes.ts)**
   - Added 5 new routes for linking/unlinking

## Testing Recommendations

1. **Test Linking:**
   - Link Google account to existing user
   - Link Twitter account to existing user
   - Try linking same account twice (should fail)
   - Try linking account already linked to another user (should fail)

2. **Test Unlinking:**
   - Unlink when user has password
   - Unlink when user has multiple social accounts
   - Try unlinking only authentication method (should fail)
   - Unlink non-existent provider (should fail)

3. **Test Security:**
   - Try accessing link URLs without authentication (should fail)
   - Try using expired/invalid OAuth state (should fail)
   - Verify CSRF protection works

## Example Frontend Code (React/TypeScript)

```typescript
// Link Google Account
async function linkGoogleAccount() {
  const redirectUrl = `${window.location.origin}/settings`;
  const response = await fetch(
    `/auth/link/google/url?redirectUrl=${encodeURIComponent(redirectUrl)}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  const { data } = await response.json();
  window.location.href = data.authUrl;
}

// Unlink Google Account
async function unlinkGoogleAccount() {
  const response = await fetch('/auth/social/google', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  const result = await response.json();
  if (result.success) {
    alert('Google account unlinked successfully');
  }
}

// Handle callback in settings page
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('success') === 'true') {
    const provider = params.get('linked');
    alert(`${provider} account linked successfully`);
    // Clean up URL
    window.history.replaceState({}, '', '/settings');
  }
}, []);
```

## Notes

- The implementation reuses existing OAuth flow and utilities (KISS principle)
- OAuth state contains `userId` when in "linking mode" (authenticated user)
- Callbacks check if `userId` exists in state to determine if it's login or linking mode
- Rate limiting is applied to all endpoints
- All responses follow the existing snake_case convention
