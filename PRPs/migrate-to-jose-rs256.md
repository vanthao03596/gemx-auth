# Migrate from jsonwebtoken to jose with RS256 Algorithm and JWKS Endpoint

## Goal

**Feature Goal**: Replace jsonwebtoken package with jose package, change JWT algorithm from HS256 to RS256, and implement JWKS endpoint for public key distribution.

**Deliverable**: Updated JWT utilities using jose package with RS256 algorithm and a new JWKS endpoint at `/.well-known/jwks.json`.

**Success Definition**:
- All existing JWT functionality works with jose package
- JWT tokens use RS256 algorithm instead of HS256
- JWKS endpoint returns public key in standard format
- All tests pass with new implementation

## Why

- **Security**: RS256 uses asymmetric cryptography eliminating shared secret vulnerabilities
- **Scalability**: Multiple services can verify tokens without sharing private keys
- **Standards Compliance**: JWKS endpoint follows industry standards for public key distribution
- **Modern Library**: jose package is actively maintained with zero dependencies and better TypeScript support

## What

Replace the current symmetric JWT implementation with asymmetric RS256:

1. Remove jsonwebtoken dependency and add jose package
2. Update jwt.utils.ts to use jose with RS256 algorithm
3. Add public/private key pair management
4. Create JWKS endpoint for public key distribution
5. Update environment configuration for RS256 keys
6. Ensure backward compatibility during migration

### Success Criteria

- [ ] jose package replaces jsonwebtoken
- [ ] JWT tokens use RS256 algorithm
- [ ] All existing JWT functions (generateToken, verifyToken, decodeToken) work unchanged
- [ ] JWKS endpoint returns valid public key
- [ ] All existing tests pass
- [ ] No breaking changes to API contracts

## All Needed Context

### Documentation & References

```yaml
- url: https://github.com/panva/jose#readme
  why: Official jose package documentation with RS256 examples
  critical: SignJWT and jwtVerify usage patterns for RS256

- url: https://github.com/panva/jose/blob/main/docs/functions/jwt_sign.signjwt.md
  why: SignJWT class documentation for token generation
  critical: RS256 algorithm setup and key handling

- url: https://github.com/panva/jose/blob/main/docs/functions/jwt_verify.jwtverify.md
  why: jwtVerify function documentation for token verification
  critical: Public key verification patterns

- url: https://datatracker.ietf.org/doc/html/rfc7517
  why: JWKS specification for endpoint implementation
  critical: Standard JWKS JSON format requirements

- file: src/utils/jwt.utils.ts
  why: Current JWT implementation to replace
  pattern: generateToken, verifyToken, decodeToken function signatures
  gotcha: Must maintain same function signatures for compatibility

- file: src/config/env.ts
  why: Environment variable validation pattern
  pattern: Zod schema validation for new JWT_PRIVATE_KEY and JWT_PUBLIC_KEY variables
  gotcha: Need to add new RS256 key variables while keeping compatibility

- file: src/features/auth/auth.service.ts
  why: JWT usage in authentication service
  pattern: Token generation in register/login methods
  gotcha: Keep same return format and error handling

- file: src/middleware/auth.middleware.ts
  why: JWT verification in middleware
  pattern: Token extraction and verification flow
  gotcha: Maintain same user object structure in req.user
```

### Current Codebase Structure

```bash
src/
├── config/
│   └── env.ts                 # Environment validation with Zod
├── features/
│   └── auth/
│       ├── auth.service.ts    # Uses generateToken()
│       ├── auth.controller.ts # Auth endpoints
│       └── auth.middleware.ts # Uses verifyToken()
├── utils/
│   └── jwt.utils.ts          # Current jsonwebtoken implementation
└── app.ts                    # Express app setup
```

### Desired Codebase Structure with New Files

```bash
src/
├── config/
│   └── env.ts                 # Updated with RS256 key variables
├── features/
│   └── auth/
│       ├── auth.service.ts    # Same - uses updated generateToken()
│       ├── auth.controller.ts # Same
│       ├── auth.middleware.ts # Same - uses updated verifyToken()
│       └── auth.routes.ts     # Add JWKS endpoint
├── utils/
│   └── jwt.utils.ts          # Updated to use jose with RS256
└── app.ts                    # Same
```

### Known Gotchas & Library Quirks

```typescript
// CRITICAL: jose uses async/await everywhere, jsonwebtoken mostly sync
// OLD: const token = jwt.sign(payload, secret)
// NEW: const token = await new jose.SignJWT(payload).sign(privateKey)

// CRITICAL: RS256 requires proper key format - use importPKCS8/importSPKI
// Keys must be in PEM format, not raw strings

// CRITICAL: jose key imports are async
// Must await jose.importPKCS8(privateKeyPem, 'RS256')

// CRITICAL: Maintain exact same function signatures for compatibility
// generateToken(), verifyToken(), decodeToken() must work exactly as before
```

## Implementation Blueprint

### Data Models and Structure

```typescript
// Keep existing JwtPayload interface unchanged
interface JwtPayload {
  userId: number;
  email: string;
  iat?: number;
  exp?: number;
}

// Add new key management types
interface KeyPair {
  privateKey: string; // PEM format
  publicKey: string;  // PEM format
}

interface JWK {
  kty: 'RSA';
  use: 'sig';
  alg: 'RS256';
  kid: string;
  n: string;
  e: string;
}
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: UPDATE package.json dependencies
  - REMOVE: jsonwebtoken and @types/jsonwebtoken
  - ADD: jose package
  - FOLLOW pattern: package.json (keep same dev dependencies structure)
  - NAMING: npm uninstall jsonwebtoken @types/jsonwebtoken && npm install jose
  - PLACEMENT: package.json dependencies section

Task 2: UPDATE src/config/env.ts for RS256 keys
  - IMPLEMENT: Add JWT_PRIVATE_KEY_PEM and JWT_PUBLIC_KEY_PEM environment variables
  - FOLLOW pattern: src/config/env.ts (Zod schema validation)
  - NAMING: JWT_PRIVATE_KEY_PEM, JWT_PUBLIC_KEY_PEM (PEM format base64 encoded)
  - DEPENDENCIES: None
  - PLACEMENT: Add to envSchema in env.ts

Task 3: UPDATE src/utils/jwt.utils.ts to use jose
  - IMPLEMENT: Replace jsonwebtoken with jose for generateToken, verifyToken, decodeToken
  - FOLLOW pattern: src/utils/jwt.utils.ts (keep exact same function signatures)
  - NAMING: Keep generateToken, verifyToken, decodeToken unchanged
  - DEPENDENCIES: Task 1 (jose package), Task 2 (environment variables)
  - PLACEMENT: Replace existing jwt.utils.ts implementation

Task 4: ADD JWKS endpoint to auth routes
  - IMPLEMENT: GET /.well-known/jwks.json endpoint returning public key
  - FOLLOW pattern: src/features/auth/auth.routes.ts (Express router pattern)
  - NAMING: jwksEndpoint controller method
  - DEPENDENCIES: Task 3 (updated jwt.utils.ts)
  - PLACEMENT: Add route to auth.routes.ts

```

### Implementation Patterns & Key Details

```typescript
// Critical: Maintain exact same function signatures for compatibility
export const generateToken = async (payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> => {
  const privateKey = await jose.importPKCS8(env.JWT_PRIVATE_KEY_PEM, 'RS256');

  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN)
    .sign(privateKey);
};

export const verifyToken = async (token: string): Promise<JwtPayload> => {
  const publicKey = await jose.importSPKI(env.JWT_PUBLIC_KEY_PEM, 'RS256');

  const { payload } = await jose.jwtVerify(token, publicKey);
  return payload as JwtPayload;
};

// JWKS endpoint implementation
export const getJwks = async (): Promise<{ keys: JWK[] }> => {
  const publicKey = await jose.importSPKI(env.JWT_PUBLIC_KEY_PEM, 'RS256');
  const jwk = await jose.exportJWK(publicKey);

  return {
    keys: [
      {
        ...jwk,
        use: 'sig',
        alg: 'RS256',
        kid: 'default'
      } as JWK
    ]
  };
};
```

### Integration Points

```yaml
ENVIRONMENT:
  - add: JWT_PRIVATE_KEY_PEM (base64 encoded PEM private key)
  - add: JWT_PUBLIC_KEY_PEM (base64 encoded PEM public key)
  - keep: JWT_SECRET (for migration compatibility if needed)

ROUTES:
  - add: GET /.well-known/jwks.json (public key endpoint)
  - keep: All existing auth routes unchanged
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
npm run lint                    # ESLint checks
npm run build                   # TypeScript compilation

# Expected: Zero errors. All existing functionality works.
```
### Level 2: Integration Testing (System Validation)

```bash
# Start development server
npm run dev

# Test JWKS endpoint
curl http://localhost:3000/.well-known/jwks.json | jq .

# Test token generation and verification
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password"}'

# Expected: JWKS returns valid public key, auth flow works unchanged
```

### Level 3: Migration Validation

```bash
# Generate test RS256 key pair for development
node -e "const crypto = require('crypto'); const {publicKey, privateKey} = crypto.generateKeyPairSync('rsa', {modulusLength: 2048, publicKeyEncoding: {type: 'spki', format: 'pem'}, privateKeyEncoding: {type: 'pkcs8', format: 'pem'}}); console.log('Private:', Buffer.from(privateKey).toString('base64')); console.log('Public:', Buffer.from(publicKey).toString('base64'));"

# Test token compatibility
# Ensure existing clients can still verify tokens

# Expected: Smooth migration with no breaking changes
```

## Final Validation Checklist

### Technical Validation

- [ ] No linting errors: `npm run lint`
- [ ] TypeScript compiles: `npm run build`
- [ ] Development server starts: `npm run dev`

### Feature Validation

- [ ] JWT tokens use RS256 algorithm
- [ ] JWKS endpoint returns valid public key
- [ ] Existing auth endpoints work unchanged
- [ ] Token generation/verification maintains same API
- [ ] Error handling works as before

### Code Quality Validation

- [ ] Function signatures unchanged for compatibility
- [ ] Environment variables properly validated
- [ ] JWKS endpoint follows RFC 7517 standard
- [ ] No unnecessary complexity added (KISS principle)
- [ ] Only required features implemented (YAGNI principle)

---

## Anti-Patterns to Avoid

- ❌ Don't change existing function signatures - maintain compatibility
- ❌ Don't add complex key management - use simple environment variables
- ❌ Don't implement key rotation - not in requirements
- ❌ Don't add multiple algorithms - stick to RS256
- ❌ Don't over-engineer - implement only what's asked for