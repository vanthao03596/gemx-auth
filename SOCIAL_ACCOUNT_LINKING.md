# Social Account Linking Feature

## Overview
This feature allows authenticated users to link/unlink Google and Twitter accounts to their existing profile.

## API Endpoints

### 1. Get Connected Social Accounts
**Endpoint:** `GET /auth/social`
**Authentication:** Required (JWT Bearer token)

**Response:**
```json
{
  "success": true,
  "message": "Connected social accounts retrieved successfully",
  "data": {
    "connected_accounts": [
      {
        "id": 1,
        "provider": "google",
        "email": "user@gmail.com",
        "name": "John Doe",
        "avatar": "https://lh3.googleusercontent.com/...",
        "createdAt": "2025-01-15T10:30:00.000Z"
      },
      {
        "id": 2,
        "provider": "twitter",
        "email": null,
        "name": "johndoe",
        "avatar": "https://pbs.twimg.com/...",
        "createdAt": "2025-01-16T14:20:00.000Z"
      }
    ]
  }
}
```

**Usage:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:3000/auth/social"
```

**Notes:**
- Returns an empty array if no social accounts are connected
- Results are ordered by creation date (newest first)
- Excludes sensitive `providerId` field for security

### 2. Get Link URL (Google)
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

### 3. Get Link URL (Twitter)
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

### 4. OAuth Callbacks (Unified for Login & Linking)
**Google Endpoint:** `GET /auth/google/callback`
**Twitter Endpoint:** `GET /auth/twitter/callback`

**Note:** These callbacks handle **both** login (new user registration) and linking (authenticated users) flows.

**Query Parameters:**
- `code`: OAuth authorization code
- `state`: OAuth state parameter

**Behavior:**
The callback automatically determines the flow mode based on OAuth state:

**Login Mode** (when state has no userId):
- Creates or finds user account
- Generates JWT token
- Redirects to: `{redirectUrl}?token={jwt}`

**Linking Mode** (when state contains userId):
- Validates OAuth state for CSRF protection
- Fetches social provider profile information
- Links social account to authenticated user
- Redirects to: `{redirectUrl}?linked={provider}&success=true`

**Error Handling:**
- If social account already linked to another user: redirects with error
- If social account already linked to same user: redirects with error
- On any error: `{redirectUrl}?error=oauth_failed&message=...`

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

### Getting Connected Accounts
1. User navigates to settings page
2. Frontend calls `GET /auth/social` with JWT token
3. Backend returns list of connected social accounts
4. Frontend displays connected accounts with link/unlink buttons

### Linking Flow
1. User clicks "Link Google Account" button in settings
2. Frontend calls `GET /auth/link/google/url?redirectUrl=http://yourapp.com/settings`
3. Frontend redirects user to the returned `authUrl`
4. User authorizes on Google
5. Google redirects to backend callback URL
6. Backend processes linking and redirects to: `http://yourapp.com/settings?linked=google&success=true`
7. Frontend displays success message and refreshes connected accounts list

### Unlinking Flow
1. User clicks "Unlink Google Account" button
2. Frontend calls `DELETE /auth/social/google` with JWT token
3. Backend validates and unlinks account
4. Frontend displays success message and refreshes connected accounts list

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
   - `getConnectedSocialAccounts()`: Gets list of connected social accounts for a user

2. **[src/features/auth/social.controller.ts](src/features/auth/social.controller.ts)**
   - `getLinkGoogleUrl()`: Generate OAuth URL for linking (authenticated)
   - `getLinkTwitterUrl()`: Generate OAuth URL for linking (authenticated)
   - `googleCallback()`: **Modified** to handle both login and linking flows
   - `twitterCallback()`: **Modified** to handle both login and linking flows
   - `unlinkSocialAccount()`: Remove social account link
   - `getConnectedAccounts()`: Get list of connected social accounts

3. **[src/features/auth/social.validation.ts](src/features/auth/social.validation.ts)**
   - `unlinkParamsSchema`: Validation for unlink request

4. **[src/features/auth/auth.routes.ts](src/features/auth/auth.routes.ts)**
   - Added 4 new routes:
     - `GET /auth/social` - Get connected accounts
     - `GET /auth/link/google/url` - Generate Google link URL
     - `GET /auth/link/twitter/url` - Generate Twitter link URL
     - `DELETE /auth/social/:provider` - Unlink social account
   - Existing callback routes now handle both login and linking

## Testing Recommendations

1. **Test Getting Connected Accounts:**
   - Get connected accounts for user with no linked accounts (should return empty array)
   - Get connected accounts for user with one linked account
   - Get connected accounts for user with multiple linked accounts
   - Try accessing endpoint without authentication (should fail with 401)
   - Verify response format matches expected structure
   - Verify `providerId` is not exposed in response

2. **Test Linking:**
   - Link Google account to existing user
   - Link Twitter account to existing user
   - Try linking same account twice (should fail)
   - Try linking account already linked to another user (should fail)
   - Verify newly linked account appears in GET /auth/social response

3. **Test Unlinking:**
   - Unlink when user has password
   - Unlink when user has multiple social accounts
   - Try unlinking only authentication method (should fail)
   - Unlink non-existent provider (should fail)
   - Verify unlinked account no longer appears in GET /auth/social response

4. **Test Security:**
   - Try accessing link URLs without authentication (should fail)
   - Try using expired/invalid OAuth state (should fail)
   - Verify CSRF protection works
   - Verify rate limiting is applied to GET /auth/social endpoint

## Example Frontend Code (React/TypeScript)

```typescript
// Get Connected Social Accounts
async function getConnectedAccounts() {
  const response = await fetch('/auth/social', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const { data } = await response.json();
  return data.connected_accounts;
}

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
    // Refresh connected accounts list
    const accounts = await getConnectedAccounts();
    setConnectedAccounts(accounts);
  }
}

// Component example
function SocialAccountsSettings() {
  const [connectedAccounts, setConnectedAccounts] = useState([]);

  useEffect(() => {
    // Load connected accounts on mount
    getConnectedAccounts().then(setConnectedAccounts);

    // Handle OAuth callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      const provider = params.get('linked');
      alert(`${provider} account linked successfully`);
      // Refresh list and clean up URL
      getConnectedAccounts().then(setConnectedAccounts);
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

  return (
    <div>
      <h2>Connected Accounts</h2>
      {connectedAccounts.map(account => (
        <div key={account.id}>
          <img src={account.avatar} alt={account.name} />
          <span>{account.provider}: {account.name}</span>
          <button onClick={() => unlinkAccount(account.provider)}>
            Unlink
          </button>
        </div>
      ))}
      <button onClick={linkGoogleAccount}>Link Google Account</button>
      <button onClick={linkTwitterAccount}>Link Twitter Account</button>
    </div>
  );
}
```

## Implementation Details

### Unified Callback Approach (KISS Principle)
This implementation uses a **unified callback strategy** where the same OAuth callback endpoints handle both login and linking flows:

- **No additional environment variables needed** - reuses existing `GOOGLE_REDIRECT_URI` and `TWITTER_REDIRECT_URI`
- **No additional OAuth provider configuration** - same callback URLs registered with Google/Twitter
- **Automatic flow detection** - callbacks check if `userId` exists in OAuth state to determine mode:
  - `userId` present → Linking mode (authenticated user linking account)
  - No `userId` → Login mode (new user registration/login)

### Key Characteristics
- OAuth state contains `userId` when generated by authenticated endpoints (`/link/google/url`, `/link/twitter/url`)
- OAuth state is empty when generated by public endpoints (`/google/url`, `/twitter/url`)
- Rate limiting is applied to all endpoints
- All responses follow the existing snake_case convention
- CSRF protection via OAuth state validation for all flows
- One-time use state tokens for enhanced security
