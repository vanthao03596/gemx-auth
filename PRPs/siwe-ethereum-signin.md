name: "SIWE (Sign-In with Ethereum) Authentication - TypeScript Implementation"
description: |

---

## Goal

**Feature Goal**: Enable users to authenticate using their Ethereum wallet through Sign-In with Ethereum (SIWE) standard, providing a decentralized authentication alternative to traditional email/password.

**Deliverable**: Complete SIWE authentication system with nonce generation and signature verification endpoints that integrates seamlessly with existing JWT-based authentication infrastructure.

**Success Definition**: Users can authenticate using MetaMask or other Web3 wallets, receive standard JWT tokens, and access protected routes using the same middleware as existing auth methods.

## User Persona (if applicable)

**Target User**: Web3-savvy users who prefer wallet-based authentication over traditional credentials

**Use Case**: Users want to sign in without creating accounts or remembering passwords, using their existing Ethereum wallet as their identity

**User Journey**:
1. User clicks "Connect Wallet" button
2. Frontend generates SIWE message using backend nonce
3. User signs message in their wallet
4. Backend verifies signature and issues JWT token
5. User accesses protected routes with standard authentication

**Pain Points Addressed**:
- Eliminates need for password management
- Provides self-custodial authentication
- Reduces registration friction for Web3 users

## Why

- Enable decentralized authentication following EIP-4361 standard
- Integrate with existing JWT infrastructure without disruption
- Provide Web3-native authentication option alongside email/OTP methods
- Follow KISS principles - minimal complexity, maximum compatibility

## What

A simple SIWE authentication system that adds two new endpoints (`/auth/siwe/nonce` and `/auth/siwe/verify`) while reusing existing authentication infrastructure.

### Success Criteria

- [ ] Generate cryptographically secure nonces via GET `/auth/siwe/nonce`
- [ ] Verify SIWE signatures and issue JWT tokens via POST `/auth/siwe/verify`
- [ ] Integration with existing auth middleware (no changes needed)
- [ ] Compatible with existing user management and protected routes
- [ ] Proper error handling following existing patterns
- [ ] All validation passes (lint, typecheck, tests)

## All Needed Context

### Context Completeness Check

_"If someone knew nothing about this codebase, would they have everything needed to implement SIWE successfully following existing patterns?"_

### Documentation & References

```yaml
# Essential SIWE Documentation
- url: https://eips.ethereum.org/EIPS/eip-4361
  why: Official EIP-4361 specification for SIWE message format
  critical: Message structure requirements and security considerations

- url: https://viem.sh/docs/siwe/utilities/createSiweMessage
  why: Viem built-in SIWE utilities for message creation and verification
  pattern: Use viem/siwe instead of separate siwe package

- url: https://viem.sh/docs/siwe/actions/verifySiweMessage
  why: Server-side signature verification using viem public client
  critical: Proper signature verification without wallet dependency

# Existing Codebase Patterns to Follow
- file: src/features/auth/auth.controller.ts
  why: Controller structure with dependency injection and error handling
  pattern: async methods with try/catch and next(error), req.validatedBody usage

- file: src/features/auth/auth.service.ts
  why: Service layer patterns with Prisma and JWT integration
  pattern: AuthResponse interface, user lookup/creation, token generation

- file: src/features/auth/auth.validation.ts
  why: Zod validation schemas and TypeScript type inference
  pattern: export schema + Input type, email/string validation patterns

- file: src/features/auth/auth.routes.ts
  why: Express router setup with middleware composition
  pattern: rate limiting -> validation -> controller binding

- file: src/middleware/auth.middleware.ts
  why: JWT authentication middleware (no changes needed)
  pattern: Bearer token extraction, jose verification, user lookup
```

### Current Codebase tree

```bash
.
├── src/
│   ├── features/
│   │   └── auth/
│   │       ├── auth.controller.ts     # Controller patterns to follow
│   │       ├── auth.service.ts        # Service patterns to follow
│   │       ├── auth.validation.ts     # Validation patterns to follow
│   │       └── auth.routes.ts         # Route patterns to follow
│   ├── middleware/
│   │   ├── auth.middleware.ts         # Works unchanged with SIWE JWT tokens
│   │   ├── rateLimiter.middleware.ts  # Rate limiting patterns
│   │   └── validation.middleware.ts   # Zod validation middleware
│   ├── types/
│   │   ├── response.types.ts          # API response interfaces
│   │   └── express.d.ts               # Express extensions (works unchanged)
│   └── utils/
│       ├── jwt.utils.ts               # JWT generation (works unchanged)
│       ├── response.utils.ts          # Response utilities
│       └── errors.ts                  # Custom error classes
```

### Desired Codebase tree with files to be added

```bash
src/features/auth/
├── auth.controller.ts               # Add siweNonce() and siweVerify() methods
├── auth.service.ts                  # Add generateSiweNonce() and verifySiweSignature() methods
├── auth.validation.ts               # Add siweNonceSchema and siweVerifySchema
├── auth.routes.ts                   # Add GET /siwe/nonce and POST /siwe/verify routes
└── siwe.types.ts                    # SIWE-specific TypeScript interfaces
```

### Known Gotchas of our codebase & Library Quirks

```typescript
// CRITICAL: viem requires publicClient for signature verification
// Must create publicClient with RPC URL, not wallet client
// Example: publicClient.verifySiweMessage() not walletClient.verifySiweMessage()

// CRITICAL: Follow existing auth patterns exactly
// req.validatedBody as TypeScript type (from validation middleware)
// successResponse(res, data, message) for consistent API responses
// throw custom error classes (AuthenticationError, ValidationError)

// CRITICAL: Nonce management for replay attack prevention
// Generate cryptographically secure nonces (viem generateSiweNonce())
// Store nonces in Redis with TTL (leverage existing Redis infrastructure)
// Key pattern: "siwe:nonce:{nonce}" with 5min expiration
// Invalidate nonces after successful verification

// CRITICAL: Database schema update required
// Add optional walletAddress field to User model: walletAddress String? @unique @map("wallet_address")
// Allows users to have both email AND wallet authentication methods

// CRITICAL: Environment configuration
// Add RPC_URL, SIWE_DOMAIN, CHAIN_ID to env.ts schema
// Chain selection based on CHAIN_ID environment variable

// CRITICAL: JWT integration
// Use existing generateToken({ userId, email }) function
// Return same AuthResponse interface { user, token }
// No changes needed to auth middleware or protected routes
```

## Implementation Blueprint

### Data models and structure

```typescript
// SIWE-specific types following existing patterns
interface SiweNonceResponse {
  nonce: string;
}

interface SiweVerifyInput {
  message: string;    // EIP-4361 formatted message
  signature: string;  // Hex signature from wallet
}

interface SiweMessage {
  domain: string;
  address: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
}
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: CREATE src/features/auth/siwe.types.ts
  - IMPLEMENT: TypeScript interfaces for SIWE request/response types
  - FOLLOW pattern: src/types/response.types.ts (interface structure, naming)
  - NAMING: PascalCase interfaces, camelCase properties
  - DEPENDENCIES: None (foundational types)
  - PLACEMENT: Feature-specific types in auth feature directory

Task 2: UPDATE src/features/auth/auth.validation.ts
  - IMPLEMENT: Zod schemas for siweNonceSchema and siweVerifySchema
  - FOLLOW pattern: existing validation schemas (email validation, string constraints)
  - NAMING: camelCase schema names, export schema + Input type
  - DEPENDENCIES: Import SiweVerifyInput from Task 1
  - VALIDATION: Ethereum address regex, signature hex validation

Task 3: UPDATE src/features/auth/auth.service.ts
  - IMPLEMENT: generateSiweNonce() and verifySiweSignature() methods
  - FOLLOW pattern: existing service methods (error handling, return AuthResponse)
  - DEPENDENCIES: viem publicClient, Task 1 types
  - INTEGRATION: Use existing generateToken() and user lookup patterns
  - NONCE: Store/validate nonces for replay attack prevention

Task 4: UPDATE src/features/auth/auth.controller.ts
  - IMPLEMENT: siweNonce() and siweVerify() controller methods
  - FOLLOW pattern: existing controller methods (try/catch, req.validatedBody)
  - DEPENDENCIES: Use auth service methods from Task 3
  - RESPONSES: Use successResponse() utility for consistent API responses
  - ERROR_HANDLING: Use next(error) pattern with custom error classes

Task 5: UPDATE src/features/auth/auth.routes.ts
  - IMPLEMENT: GET /siwe/nonce and POST /siwe/verify routes
  - FOLLOW pattern: existing route structure (middleware composition)
  - DEPENDENCIES: Controller methods from Task 4, validation from Task 2
  - MIDDLEWARE: rate limiting -> validation -> controller.method.bind()
  - PLACEMENT: Add to existing auth router

Task 6: UPDATE database schema for wallet addresses
  - IMPLEMENT: Add walletAddress field to User model in schema.prisma
  - PATTERN: walletAddress String? @unique @map("wallet_address")
  - MIGRATION: Run prisma db push or prisma migrate dev
  - RATIONALE: Optional field allows dual auth methods (email + wallet)

Task 7: UPDATE environment configuration
  - IMPLEMENT: Add RPC_URL, SIWE_DOMAIN, CHAIN_ID to env.ts schema
  - UPDATE: .env.example with SIWE environment variables
  - VALIDATION: Proper Zod schemas with URL validation for RPC_URL
  - CHAIN_CONFIG: Environment-driven chain selection (1=mainnet, 11155111=sepolia)

Task 8: ADD viem dependency and publicClient configuration
  - IMPLEMENT: npm install viem, create publicClient with chain selection
  - FOLLOW pattern: existing config files in src/config/
  - DEPENDENCIES: Use env variables from Task 7
  - PLACEMENT: Create src/config/siwe.ts for viem publicClient setup
  - CLIENT: createPublicClient with environment-based chain selection
```

### Implementation Patterns & Key Details

```typescript
// SIWE Service Implementation Pattern
export class AuthService {
  private publicClient: PublicClient;

  constructor() {
    // Setup viem publicClient with environment-based chain selection
    const getChain = () => {
      switch (env.CHAIN_ID) {
        case 1: return mainnet;
        case 11155111: return sepolia;
        default: return mainnet;
      }
    };

    this.publicClient = createPublicClient({
      chain: getChain(),
      transport: http(env.RPC_URL)
    });
  }

  async generateSiweNonce(): Promise<{ nonce: string }> {
    // PATTERN: Use viem built-in nonce generation
    const nonce = generateSiweNonce();

    // CRITICAL: Store nonce in Redis with 5min TTL for replay attack prevention
    await redis.setEx(`siwe:nonce:${nonce}`, 300, 'unused');

    return { nonce };
  }

  async verifySiweSignature(data: SiweVerifyInput): Promise<AuthResponse> {
    // PATTERN: Parse message, verify signature, handle user lookup/creation
    const { message, signature } = data;

    // Extract nonce and address from SIWE message
    const siweMessage = parseSiweMessage(message);

    // CRITICAL: Validate nonce exists and hasn't been used
    const storedNonce = await redis.get(`siwe:nonce:${siweMessage.nonce}`);
    if (!storedNonce) {
      throw new AuthenticationError('Invalid or expired nonce');
    }

    const isValid = await this.publicClient.verifySiweMessage({
      message,
      signature,
      domain: env.SIWE_DOMAIN // Security: validate domain binding
    });

    if (!isValid) {
      throw new AuthenticationError('Invalid signature');
    }

    // CRITICAL: Invalidate nonce after successful verification
    await redis.del(`siwe:nonce:${siweMessage.nonce}`);

    // PATTERN: Find/create user by wallet address
    let user = await prisma.user.findUnique({
      where: { walletAddress: siweMessage.address.toLowerCase() }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          walletAddress: siweMessage.address.toLowerCase(),
          name: `User ${siweMessage.address.slice(0, 8)}`,
          email: `${siweMessage.address.toLowerCase()}@wallet.local` // Placeholder
        }
      });
    }

    // PATTERN: Generate JWT using existing utility
    const token = generateToken({ userId: user.id, email: user.email });

    return { user, token };
  }
}

// Controller Pattern (add to existing AuthController)
async siweNonce(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await this.authService.generateSiweNonce();
    successResponse(res, result, 'SIWE nonce generated');
  } catch (error) {
    next(error);
  }
}

// Validation Pattern
export const siweVerifySchema = z.object({
  message: z.string().min(1, 'Message is required'),
  signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/, 'Invalid signature format'),
});
```

### Integration Points

```yaml
DEPENDENCIES:
  - add: "viem": "^2.x.x" (package.json)
  - config: RPC_URL, SIWE_DOMAIN, CHAIN_ID environment variables

DATABASE_CHANGES:
  - schema: Add walletAddress String? @unique @map("wallet_address") to User model
  - migration: Required Prisma migration for schema update
  - rationale: Optional field allows both email and wallet auth methods

ENVIRONMENT_SETUP:
  - .env.example additions:
    * RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-api-key
    * SIWE_DOMAIN=localhost:3000
    * CHAIN_ID=1
  - env.ts schema updates for validation
  - chain selection: Environment-driven (1=mainnet, 11155111=sepolia)

NONCE_STORAGE:
  - strategy: Use existing Redis infrastructure (already configured)
  - pattern: redis.setEx("siwe:nonce:{nonce}", 300, "unused") // 5min TTL
  - benefits: Persistent, scalable, automatic expiration

EXISTING_INFRASTRUCTURE:
  - middleware: auth.middleware.ts works unchanged (JWT-based)
  - responses: Use existing successResponse() and errorResponse()
  - errors: Use existing AuthenticationError and ValidationError classes
  - jwt: Use existing generateToken() function
  - redis: Leverage existing Redis client for nonce storage

ROUTES:
  - GET /auth/siwe/nonce: Generate nonce for SIWE message
  - POST /auth/siwe/verify: Verify signature and return JWT token
  - Integration: Add routes to existing auth router
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# Run after each file creation - fix before proceeding
npm run lint                    # ESLint checks with TypeScript rules
npx tsc --noEmit               # TypeScript type checking
npm run build                 # Build

# Expected: Zero errors. If errors exist, fix before proceeding.
```

### Level 2: Integration Testing (System Validation)

```bash
# Development server validation
npm run dev

# SIWE endpoint validation
curl -X GET http://localhost:3000/auth/siwe/nonce
# Expected: {"success":true,"data":{"nonce":"..."}}

curl -X POST http://localhost:3000/auth/siwe/verify \
  -H "Content-Type: application/json" \
  -d '{"message":"...","signature":"0x..."}' \
  | jq .
# Expected: {"success":true,"data":{"user":{},"token":"..."}}

# JWT token validation with protected routes
curl -H "Authorization: Bearer {SIWE_TOKEN}" \
  http://localhost:3000/auth/profile
# Expected: 200 OK with user profile data

# Production build validation
npm run build
# Expected: Successful build with no TypeScript errors
```

### Level 3: Creative & Domain-Specific Validation

```bash
# SIWE-specific validation
# Test with actual MetaMask signatures (manual testing)
# Verify nonce replay attack prevention
# Test signature verification with invalid signatures
# Validate domain binding security

# Performance validation
# Test nonce generation performance (should be fast)
# Test signature verification latency (network dependent)

# Security validation
# Verify nonces cannot be reused
# Test message expiration handling
# Validate signature format and Ethereum address extraction
```

## Final Validation Checklist

### Technical Validation

- [ ] All validation levels completed successfully
- [ ] No linting errors: `npm run lint`
- [ ] No type errors: `npx tsc --noEmit`
- [ ] Production build succeeds: `npm run build`
- [ ] SIWE endpoints respond correctly with proper JSON structure

### Feature Validation

- [ ] SIWE nonce generation works: GET `/auth/siwe/nonce`
- [ ] SIWE signature verification works: POST `/auth/siwe/verify`
- [ ] JWT tokens issued by SIWE work with existing auth middleware
- [ ] Protected routes accessible with SIWE-generated tokens
- [ ] Error cases handled gracefully (invalid signature, expired nonce, etc.)
- [ ] Rate limiting prevents nonce/verification abuse

### Code Quality Validation

- [ ] Follows existing TypeScript patterns in auth feature
- [ ] File placement matches feature-based organization
- [ ] Uses existing validation, error handling, and response patterns
- [ ] No duplication of existing functionality
- [ ] KISS principle: Simple, straightforward implementation
- [ ] YAGNI principle: Only essential SIWE features implemented

### SIWE-Specific Validation

- [ ] EIP-4361 message format compliance
- [ ] Proper signature verification using viem
- [ ] Nonce management prevents replay attacks
- [ ] Domain validation ensures security
- [ ] Integration with existing user management system

### Documentation & Deployment

- [ ] Code follows existing patterns and is self-documenting
- [ ] Environment variables documented if new ones added
- [ ] No breaking changes to existing authentication flows

---

## Anti-Patterns to Avoid

- ❌ Don't create separate user management for SIWE users
- ❌ Don't modify existing auth middleware (JWT works unchanged)
- ❌ Don't overcomplicate nonce storage (simple in-memory or Redis)
- ❌ Don't add client-side wallet connection logic (backend-only)
- ❌ Don't implement multi-chain support initially (YAGNI)
- ❌ Don't skip domain validation (security critical)
- ❌ Don't reuse nonces (replay attack vulnerability)
- ❌ Don't trust client-provided nonces (server-side generation only)