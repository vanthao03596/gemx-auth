name: "Simple User Referral System - KISS/YAGNI Implementation"
description: |

---

## Goal

**Feature Goal**: Add basic referral capability where users can have one referrer and see their referred users using algorithmic referral codes

**Deliverable**: Self-referencing User relationship with Base62 referral codes, 2 API endpoints and circular reference protection

**Success Definition**: Users can set referrer using referral codes (once), view their referrals, with circular references prevented

## User Persona

**Target User**: Existing authenticated users of the micro-auth system

**Use Case**: User wants to indicate who referred them and see who they have referred

**User Journey**:
1. User logs in to system
2. User gets their own referral code (algorithmic, based on user ID)
3. User can optionally set their referrer using another user's referral code - once only
4. User can view list of users they have referred

**Pain Points Addressed**: Simple referral tracking without complex codes or reward systems

## Why

- Enables basic referral tracking for business metrics
- Integrates with existing user management system
- Provides foundation for future referral features if needed

## What

Add referrer relationship to existing User model with minimal API endpoints.

### Success Criteria

- [ ] User can get their own referral code (algorithmic generation from user ID)
- [ ] User can set referrer using referral code once (cannot change after set)
- [ ] Circular reference validation prevents user from referring themselves or creating cycles
- [ ] User can get list of users they referred
- [ ] All operations use existing authentication/validation patterns

## All Needed Context

### Context Completeness Check

_This PRP provides everything needed to implement basic referral functionality using existing codebase patterns._

### Documentation & References

```yaml
- file: src/features/users/user.service.ts
  why: Follow existing user service patterns for database operations
  pattern: Service class with Prisma operations, error handling
  gotcha: Always exclude password field from responses

- file: src/features/users/user.controller.ts
  why: Follow existing controller patterns for HTTP handling
  pattern: Request validation, service calls, standardized responses
  gotcha: Use req.validatedBody and next(error) for error handling

- file: src/features/users/user.validation.ts
  why: Follow existing Zod validation patterns
  pattern: Export schemas and inferred types
  gotcha: Use descriptive error messages

- file: prisma/schema.prisma
  why: Follow existing model and relationship patterns
  pattern: Int primary keys, snake_case database mapping, proper relations
  gotcha: Use @map for database column names, onDelete cascading

- file: src/features/users/user.routes.ts
  why: Follow existing route definition patterns
  pattern: Router with middleware stack (auth, validation, rate limiting)
  gotcha: Bind controller methods properly
```

### Current Codebase tree

```bash
src/
├── features/
│   └── users/           # EXTEND: Add referral endpoints here
│       ├── user.controller.ts
│       ├── user.service.ts
│       ├── user.validation.ts
│       └── user.routes.ts
├── middleware/          # USE: Existing auth and validation
├── utils/              # USE: Existing response utilities
└── types/              # USE: Existing type patterns
```

### Desired Codebase tree with files to be modified

```bash
prisma/
└── schema.prisma                    # MODIFY: Add referrer relationship to User model

src/features/users/
├── user.controller.ts               # MODIFY: Add getReferralCode, setReferrer and getReferrals methods
├── user.service.ts                  # MODIFY: Add referral business logic with Base62 encoding
├── user.validation.ts               # MODIFY: Add referral code validation schema
└── user.routes.ts                   # MODIFY: Add three new routes

src/utils/
└── referral.utils.ts                # CREATE: Base62 encoding/decoding utilities
```

### Known Gotchas of our codebase & Library Quirks

```typescript
// CRITICAL: Prisma requires explicit relation naming for self-references
// CRITICAL: Always exclude password field using select or Omit<User, 'password'>
// CRITICAL: Use snake_case database columns with @map() directive
// CRITICAL: Follow existing error handling with custom error classes
// CRITICAL: Use existing authentication middleware for protected routes
```

## Implementation Blueprint

### Data models and structure

```typescript
// Prisma schema modification only - add referrer relationship to existing User model
model User {
  // ... existing fields ...
  referrerId  Int?  @map("referrer_id")
  referrer    User? @relation("UserReferrals", fields: [referrerId], references: [id])
  referrals   User[] @relation("UserReferrals")
}

// Base62 encoding/decoding for referral codes
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export const generateReferralCode = (userId: number): string => {
  let result = '';
  let num = userId;
  while (num > 0) {
    result = BASE62[num % 62] + result;
    num = Math.floor(num / 62);
  }
  return 'R' + result.padStart(4, '0'); // e.g., R0001, R123A
};

export const decodeReferralCode = (code: string): number => {
  if (!code.startsWith('R')) throw new Error('Invalid referral code format');
  const encoded = code.substring(1);
  let result = 0;
  for (let i = 0; i < encoded.length; i++) {
    const char = encoded[i];
    const value = BASE62.indexOf(char);
    if (value === -1) throw new Error('Invalid referral code character');
    result = result * 62 + value;
  }
  return result;
};

// TypeScript types (inferred from Prisma)
type UserWithReferrals = User & {
  referrer?: User | null;
  referrals?: User[];
}
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: CREATE src/utils/referral.utils.ts
  - IMPLEMENT: Base62 encoding/decoding functions
  - ADD: generateReferralCode(userId: number): string
  - ADD: decodeReferralCode(code: string): number
  - FOLLOW pattern: Existing utility files structure
  - NAMING: Export functions with descriptive names

Task 2: MODIFY prisma/schema.prisma
  - ADD: referrerId Int? @map("referrer_id") to User model
  - ADD: Self-referencing relation "UserReferrals"
  - FOLLOW pattern: Existing User model structure and naming conventions
  - NAMING: camelCase in schema, snake_case in database with @map

Task 3: MODIFY src/features/users/user.validation.ts
  - ADD: setReferrerSchema with referral code validation
  - FOLLOW pattern: Existing Zod schemas in file
  - NAMING: Export schema and inferred type
  - VALIDATION: Ensure referral code format (starts with 'R')

Task 4: MODIFY src/features/users/user.service.ts
  - ADD: getReferralCode method (generate from user ID)
  - ADD: setReferrer method with circular reference check using decoded code
  - ADD: getReferrals method
  - FOLLOW pattern: Existing service methods with Prisma operations
  - DEPENDENCIES: Use referral utils from Task 1, User model from Task 2
  - GOTCHA: Always exclude password field, handle circular references

Task 5: MODIFY src/features/users/user.controller.ts
  - ADD: getReferralCode controller method
  - ADD: setReferrer controller method
  - ADD: getReferrals controller method
  - FOLLOW pattern: Existing controller methods
  - DEPENDENCIES: Use validation from Task 3, service from Task 4
  - NAMING: Use existing response utility patterns

Task 6: MODIFY src/features/users/user.routes.ts
  - ADD: GET /referral-code route (get user's referral code)
  - ADD: PUT /referrer route (set referrer by code)
  - ADD: GET /referrals route (get user's referrals)
  - FOLLOW pattern: Existing route definitions with middleware
  - DEPENDENCIES: Use controller methods from Task 5
  - MIDDLEWARE: authenticateToken, validateBody
```

### Implementation Patterns & Key Details

```typescript
// Base62 referral code utilities
import { generateReferralCode, decodeReferralCode } from '@/utils/referral.utils';

// Service method to get user's referral code
async getReferralCode(userId: number): Promise<string> {
  return generateReferralCode(userId);
}

// Circular reference detection (deep traversal approach)
// CRITICAL: Must check entire referral chain to prevent cycles
// Example: A→B→C→A would not be caught by 2-level check
async checkCircularReference(userId: number, referrerId: number): Promise<boolean> {
  // Check direct circular reference
  if (referrerId === userId) return true;

  // Deep traversal to check entire referral chain
  const visited = new Set<number>();
  let currentId: number | null = referrerId;

  while (currentId !== null && !visited.has(currentId)) {
    visited.add(currentId);

    // If we find the original user in the chain, it's circular
    if (currentId === userId) return true;

    // Get the next referrer in the chain
    const user = await prisma.user.findUnique({
      where: { id: currentId },
      select: { referrerId: true }
    });

    currentId = user?.referrerId || null;
  }

  return false;
}

// Service method pattern with referral code
async setReferrer(userId: number, referralCode: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User not found');
  if (user.referrerId) throw new ConflictError('Referrer already set');

  // Decode referral code to get referrer ID
  let referrerId: number;
  try {
    referrerId = decodeReferralCode(referralCode);
  } catch (error) {
    throw new BadRequestError('Invalid referral code');
  }

  // Verify referrer exists
  const referrer = await prisma.user.findUnique({ where: { id: referrerId } });
  if (!referrer) throw new NotFoundError('Referrer not found');

  if (await this.checkCircularReference(userId, referrerId)) {
    throw new BadRequestError('Circular reference detected');
  }

  return prisma.user.update({
    where: { id: userId },
    data: { referrerId },
    select: { id: true, email: true, name: true, referrerId: true }
  });
}
```

### Integration Points

```yaml
DATABASE:
  - migration: "Add referrer_id column to users table"
  - existing: "Use current Prisma client setup"

ROUTES:
  - add to: src/features/users/user.routes.ts
  - pattern: "Follow existing authenticated route patterns"

VALIDATION:
  - add to: src/features/users/user.validation.ts
  - pattern: "Follow existing Zod schema patterns"
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
npm run lint                    # ESLint checks
npx tsc --noEmit               # TypeScript validation
npm run format                 # Prettier formatting
```

### Level 2: Unit Tests (Component Validation)

```bash
# Manual testing - no new test files needed (KISS principle)
# Use existing test patterns if tests are added later
npm test                       # Run existing tests to ensure no regression
```

### Level 3: Integration Testing (System Validation)

```bash
# Test database migration
npm run db:push

# Test API endpoints
# Get user's referral code
curl -X GET http://localhost:3000/api/users/referral-code \
  -H "Authorization: Bearer <token>"

# Set referrer using referral code
curl -X PUT http://localhost:3000/api/users/referrer \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"referralCode": "R123A"}'

# Get user's referrals
curl -X GET http://localhost:3000/api/users/referrals \
  -H "Authorization: Bearer <token>"
```

### Level 4: Creative & Domain-Specific Validation

```bash
# Test referral code generation and decoding
# Test deep circular reference prevention (multi-level chains)
# Test referrer can only be set once
# Test invalid referral code handling
# Test authentication requirements
# Test validation error responses
```

## Final Validation Checklist

### Technical Validation

- [ ] Database schema updated successfully
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] No linting errors: `npm run lint`
- [ ] Existing tests still pass: `npm test`

### Feature Validation

- [ ] User can get their referral code via API
- [ ] User can set referrer using referral code via API (once only)
- [ ] User can view their referrals via API
- [ ] Referral code encoding/decoding works correctly
- [ ] Deep circular reference validation works with referral codes (full chain traversal)
- [ ] Proper error messages for invalid referral codes
- [ ] Authentication required for all three endpoints

### Code Quality Validation

- [ ] Follows existing codebase patterns exactly
- [ ] File modifications are minimal and focused
- [ ] No new dependencies added
- [ ] Error handling matches existing patterns
- [ ] Response format matches existing APIs

### KISS/YAGNI Compliance

- [ ] Simple algorithmic referral codes (no database storage needed)
- [ ] No unnecessary features added (rewards, complex tracking, etc.)
- [ ] Uses existing infrastructure and patterns
- [ ] Minimal database changes (single column addition)
- [ ] Deep circular reference check (traverses entire referral chain)
- [ ] Reuses existing validation, auth, and response patterns

---

## Anti-Patterns to Avoid

- ❌ Don't create separate referral tables (not needed for this requirement)
- ❌ Don't implement referral codes or links (not requested)
- ❌ Don't add reward systems or tracking (YAGNI violation)
- ❌ Don't skip deep circular reference checks (security violation)
- ❌ Don't add new dependencies when existing patterns work
- ❌ Don't create new response formats when existing ones work