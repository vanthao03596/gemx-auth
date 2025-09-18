name: "User Wallet System - Two-Wallet Implementation with Transaction Tracking"
description: |

---

## Goal

**Feature Goal**: Add two-wallet system (points and USDT) for each user with basic balance and transaction management, including microservice integration

**Deliverable**:
- Database models for user wallets and transactions
- Public API endpoints for balance and transaction history
- Internal service methods for credit/debit operations
- **Internal API endpoints for service-to-service wallet operations**
- Safe concurrent transaction handling with idempotency
- Service authentication and authorization system

**Success Definition**: Users can view wallet balances and transaction history; system can safely credit/debit balances concurrently; other microservices can securely perform wallet operations via internal APIs

## User Persona

**Target User**:
- **Primary**: Existing authenticated users in the micro-auth system
- **Secondary**: Other microservices in the ecosystem (order-service, referral-service, payment-service)

**Use Case**:
- **Users**: View points and USDT balances and transaction history
- **Services**: Credit/debit user wallets for business operations (purchases, rewards, payments)

**User Journey**:
1. User authenticates with existing auth system
2. User calls API to get wallet balances
3. User calls API to get transaction history
4. **Service-to-service**: Other microservices call internal APIs to credit/debit wallets

**Pain Points Addressed**:
- Currently no wallet system exists for tracking user balances
- **No secure way for other services to perform wallet operations**
- **Lack of audit trail for service-to-service financial transactions**

## Why

- Enable point-based reward system for users
- Support USDT balance tracking for financial operations
- Provide transaction audit trail for user transparency
- **Enable secure microservice integration for wallet operations**
- **Support service attribution and audit for business transactions**
- Foundation for future financial features

## What

Add minimal wallet functionality with two balance types per user:

### Success Criteria

- [ ] Each user has exactly two wallets: points and USDT
- [ ] Balances stored as integer cents to avoid floating point issues
- [ ] All balance changes recorded in transaction table
- [ ] Public API: GET balance, GET transaction history with pagination
- [ ] Internal API: credit balance, debit balance (with validation)
- [ ] **Service-to-service API: Internal endpoints for microservice wallet operations**
- [ ] **Service authentication and authorization system**
- [ ] **Idempotency support for preventing duplicate transactions**
- [ ] Concurrent operations handled safely with database transactions

## All Needed Context

### Context Completeness Check

_"If someone knew nothing about this codebase, would they have everything needed to implement this successfully?"_

### Documentation & References

```yaml
# Database patterns to follow
- file: /Users/thaopv/Desktop/micro-auth/prisma/schema.prisma
  why: Follow existing User model patterns, relationship structure, and naming conventions
  pattern: Int primary keys, snake_case database mapping, DateTime timestamps
  gotcha: Use @map() for all fields, maintain @@map() for table names

- file: /Users/thaopv/Desktop/micro-auth/src/features/auth/auth.service.ts
  why: Follow service layer patterns for database operations and error handling
  pattern: Service class structure, Prisma operations, select patterns excluding password
  gotcha: Always use custom error classes from utils/errors.ts

- file: /Users/thaopv/Desktop/micro-auth/src/features/users/user.routes.ts
  why: Follow route organization and middleware patterns for user-related endpoints
  pattern: Router setup, authenticateToken middleware, controller method binding
  gotcha: Must bind controller methods to preserve 'this' context

- file: /Users/thaopv/Desktop/micro-auth/src/features/users/user.validation.ts
  why: Follow Zod validation patterns for input validation
  pattern: Schema definition with z.object(), type inference with z.infer
  gotcha: Transform string inputs to numbers for pagination parameters

# External documentation for financial operations
- url: https://www.prisma.io/docs/orm/prisma-client/queries/transactions
  why: Safe concurrent wallet operations using Prisma transactions
  critical: Use interactive transactions for operations requiring balance validation

- url: https://frontstuff.io/how-to-handle-monetary-values-in-javascript
  why: Best practices for storing monetary values as integers
  critical: Always store as cents (amount * 100) to avoid precision issues
```

### Current Codebase tree

```bash
src/features/
├── auth/          # Authentication patterns to follow
├── users/         # User management patterns to follow
├── health/        # Simple feature structure example
└── otp/           # Service layer patterns
```

### Desired Codebase tree with files to be added

```bash
src/features/
└── wallet/
    ├── wallet.controller.ts            # Handle user-facing HTTP requests/responses
    ├── internal-wallet.controller.ts   # Handle service-to-service requests
    ├── wallet.service.ts               # Business logic and database operations
    ├── wallet.routes.ts                # Public route definitions and middleware
    ├── internal-wallet.routes.ts       # Internal service routes
    ├── wallet.validation.ts            # Zod schemas for public API validation
    ├── internal-wallet.validation.ts   # Zod schemas for internal API validation
    └── wallet.types.ts                 # TypeScript interfaces for wallet data

src/middleware/
├── service-auth.middleware.ts          # Service authentication middleware
└── idempotency.middleware.ts           # Idempotency handling middleware

# Database changes
prisma/schema.prisma                    # Add Wallet and WalletTransaction models
```

### Known Gotchas of our codebase & Library Quirks

```typescript
// CRITICAL: Prisma requires @map() for all fields to follow snake_case DB convention
// Example: createdAt DateTime @default(now()) @map("created_at")

// CRITICAL: Always exclude password field in all user selections
// Pattern: select: { id: true, email: true, name: true, /* no password */ }

// CRITICAL: Use existing error classes for consistency
// Import: import { NotFoundError, BadRequestError } from '../../utils/errors';

// CRITICAL: Controller methods must be bound to preserve 'this' context
// Pattern: router.get('/path', controller.method.bind(controller))

// CRITICAL: Use authenticateToken middleware for all user-specific endpoints
// Access user via: req.user!.id (non-null assertion safe after auth middleware)

// CRITICAL: Store monetary values as integer cents, not decimals
// Example: $5.00 stored as 500, $0.01 stored as 1

// CRITICAL: Wallet Initialization Strategy
// Wallets are created on-demand during first credit operation (auto-creation)
// Use upsert pattern in creditWallet to ensure safe concurrent wallet creation
// No manual wallet creation needed - lazy initialization handles existing users

// CRITICAL: Service Authentication for Internal APIs
// Use API key authentication for service-to-service communication
// Validate service name and permissions for each operation
// Store service credentials securely in environment variables

// CRITICAL: Idempotency for Financial Operations
// All credit/debit operations must include Idempotency-Key header
// Cache successful responses to prevent duplicate transactions
// Use service-prefixed reference IDs for better traceability

// CRITICAL: Two-Layer Description Strategy
// description: Clean user-facing text ("Referral bonus", "Order refund")
// internalNotes: Service attribution for audit ("via referral-service")
// Public APIs exclude internalNotes, audit systems include both
```

## Implementation Blueprint

### Data models and structure

```typescript
// Database schema additions to prisma/schema.prisma
model Wallet {
  id       Int         @id @default(autoincrement())
  userId   Int         @map("user_id")
  currency String      @map("currency") // "points" or "usdt"
  balance  Int         @default(0) @map("balance") // Amount in base units (points or cents)
  createdAt DateTime   @default(now()) @map("created_at")
  updatedAt DateTime   @updatedAt @map("updated_at")

  user         User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions WalletTransaction[]

  @@unique([userId, currency])
  @@index([userId], map: "wallets_user_id_fkey")
  @@map("wallets")
}

model WalletTransaction {
  id            Int                   @id @default(autoincrement())
  walletId      Int                   @map("wallet_id")
  type          WalletTransactionType @map("type")
  amount        Int                   @map("amount")         // Amount in base units (positive for credit, negative for debit)
  description   String?               @map("description")    // User-facing description
  internalNotes String?               @map("internal_notes") // Service attribution for audit
  referenceId   String?               @map("reference_id")   // ID of related resource
  createdAt     DateTime              @default(now()) @map("created_at")

  wallet Wallet @relation(fields: [walletId], references: [id], onDelete: Cascade)

  @@index([walletId], map: "wallet_transactions_wallet_id_fkey")
  @@map("wallet_transactions")
}

enum WalletTransactionType {
  CREDIT
  DEBIT
}

// Update User model to include wallets relationship
model User {
  // ... existing fields
  wallets Wallet[]
  // ... existing relationships
}
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: CREATE prisma schema updates
  - IMPLEMENT: Add Wallet and WalletTransaction models to schema.prisma
  - FOLLOW pattern: Existing User model structure and naming conventions
  - NAMING: snake_case database fields with @map(), @@map() for tables
  - PLACEMENT: Add to existing schema.prisma file

Task 2: CREATE src/features/wallet/wallet.types.ts
  - IMPLEMENT: TypeScript interfaces for wallet responses and service methods
  - FOLLOW pattern: Existing type definitions in src/types/
  - NAMING: PascalCase for interfaces, clear descriptive names
  - DEPENDENCIES: None
  - INTERFACES: WalletBalance, WalletTransactionResponse, PaginatedResponse

Task 3: CREATE src/features/wallet/wallet.validation.ts
  - IMPLEMENT: Zod schemas for transaction history query parameters and wallet operations
  - FOLLOW pattern: src/features/users/user.validation.ts structure
  - NAMING: Schema names ending with 'Schema', type inference with Input suffix
  - DEPENDENCIES: Import types from Task 2
  - SCHEMAS: transactionQuerySchema, creditWalletSchema, debitWalletSchema

Task 4: CREATE src/features/wallet/wallet.service.ts
  - IMPLEMENT: WalletService class with getBalance, getTransactions, credit, debit methods
  - FOLLOW pattern: src/features/auth/auth.service.ts class structure
  - NAMING: Service class with async methods, proper error handling
  - DEPENDENCIES: Import types from Task 2, use validation from Task 3
  - CRITICAL: Use Prisma transactions for credit/debit operations

Task 5: CREATE src/features/wallet/wallet.controller.ts
  - IMPLEMENT: WalletController class handling HTTP requests
  - FOLLOW pattern: src/features/users/user.controller.ts structure
  - NAMING: Controller class with bound methods, proper error handling
  - DEPENDENCIES: Import service from Task 4, types from Task 2

Task 6: CREATE src/features/wallet/wallet.routes.ts
  - IMPLEMENT: Express routes for wallet endpoints
  - FOLLOW pattern: src/features/users/user.routes.ts structure
  - NAMING: Export walletRoutes, use authenticateToken middleware
  - DEPENDENCIES: Import controller from Task 5, validation from Task 3

Task 7: CREATE src/middleware/service-auth.middleware.ts
  - IMPLEMENT: Service authentication middleware for API key validation
  - FOLLOW pattern: src/middleware/auth.middleware.ts structure
  - NAMING: authenticateService function, service validation logic
  - DEPENDENCIES: Environment variables for service credentials

Task 8: CREATE src/middleware/idempotency.middleware.ts
  - IMPLEMENT: Idempotency middleware for preventing duplicate transactions
  - FOLLOW pattern: Redis caching patterns from existing middleware
  - NAMING: ensureIdempotency function, cache key management
  - DEPENDENCIES: Redis utils from src/utils/redis.utils.ts

Task 9: CREATE src/features/wallet/internal-wallet.validation.ts
  - IMPLEMENT: Zod schemas for internal API validation
  - FOLLOW pattern: wallet.validation.ts structure
  - NAMING: internalCreditSchema, internalDebitSchema
  - DEPENDENCIES: Import types from Task 2

Task 10: CREATE src/features/wallet/internal-wallet.controller.ts
  - IMPLEMENT: InternalWalletController for service-to-service operations
  - FOLLOW pattern: wallet.controller.ts structure
  - NAMING: Controller class with enhanced audit logging
  - DEPENDENCIES: Import service from Task 4, middleware from Tasks 7-8

Task 11: CREATE src/features/wallet/internal-wallet.routes.ts
  - IMPLEMENT: Internal routes for service-to-service operations
  - FOLLOW pattern: wallet.routes.ts structure
  - NAMING: Export internalWalletRoutes, use service auth middleware
  - DEPENDENCIES: Import controller from Task 10, validation from Task 9

Task 12: UPDATE src/app.ts
  - IMPLEMENT: Register both public and internal wallet routes
  - FOLLOW pattern: Existing route registration pattern
  - PLACEMENT: Add route registration in app.ts
  - DEPENDENCIES: Import routes from Tasks 6 and 11
```

### Implementation Patterns & Key Details

```typescript
// Wallet service credit/debit pattern with Prisma transactions
export class WalletService {
  async getBalance(userId: number): Promise<{ points: number; usdt: number }> {
    const wallets = await prisma.wallet.findMany({
      where: { userId },
      select: { currency: true, balance: true }
    });

    return {
      points: wallets.find(w => w.currency === 'points')?.balance || 0,
      usdt: wallets.find(w => w.currency === 'usdt')?.balance || 0
    };
  }

  async getTransactions(
    userId: number,
    currency?: 'points' | 'usdt',
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<WalletTransaction>> {
    const offset = (page - 1) * limit;

    const where = {
      wallet: {
        userId,
        ...(currency && { currency })
      }
    };

    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        select: {
          id: true,
          walletId: true,
          type: true,
          amount: true,
          description: true,              // User-facing description only
          referenceId: true,
          createdAt: true,
          wallet: {
            select: { currency: true }
          }
          // internalNotes excluded from public API
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.walletTransaction.count({ where })
    ]);

    return paginatedResponse(transactions, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    });
  }

  async creditWallet(
    userId: number,
    currency: 'points' | 'usdt',
    amount: number,
    userDescription: string,      // Clean user-facing description
    referenceId?: string,
    serviceName?: string          // For internal operations
  ): Promise<WalletTransaction> {
    return await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: {
          userId_currency: { userId, currency }
        },
        create: {
          userId,
          currency,
          balance: amount
        },
        update: {
          balance: { increment: amount }
        }
      });

      return await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'CREDIT',
          amount,
          description: userDescription,                    // "Referral bonus"
          internalNotes: serviceName ? `via ${serviceName}` : null,  // "via referral-service"
          referenceId: serviceName ? `${serviceName}:${referenceId}` : referenceId
        }
      });
    });
  }

  async debitWallet(
    userId: number,
    currency: 'points' | 'usdt',
    amount: number,
    userDescription: string,      // Clean user-facing description
    referenceId?: string,
    serviceName?: string          // For internal operations
  ): Promise<WalletTransaction> {
    return await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId_currency: { userId, currency } }
      });

      if (!wallet) throw new NotFoundError(`${currency} wallet not found`);
      if (wallet.balance < amount) throw new BadRequestError('Insufficient balance');

      const updatedWallet = await tx.wallet.update({
        where: { userId_currency: { userId, currency } },
        data: { balance: { decrement: amount } }
      });

      return await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'DEBIT',
          amount: -amount,
          description: userDescription,                    // "Item purchase"
          internalNotes: serviceName ? `via ${serviceName}` : null,  // "via order-service"
          referenceId: serviceName ? `${serviceName}:${referenceId}` : referenceId
        }
      });
    });
  }

  // Example usage patterns with clean user descriptions
  async processReferralBonus(userId: number, referralId: string): Promise<void> {
    await this.creditWallet(
      userId,
      'points',
      100,
      'Referral bonus',        // Clean user-facing description
      referralId,
      'referral-service'       // Service attribution for audit
    );
  }

  async processPurchase(userId: number, orderId: string, pointsCost: number): Promise<void> {
    await this.debitWallet(
      userId,
      'points',
      pointsCost,
      'Item purchase',         // Clean user-facing description
      orderId,
      'order-service'          // Service attribution for audit
    );
  }
}

// Controller pattern for public endpoints
export class WalletController {
  async getBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const balance = await this.walletService.getBalance(userId);
      successResponse(res, balance, 'Balance retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

// Route pattern with validation schemas
router.get('/balance', authenticateToken, walletController.getBalance.bind(walletController));
router.get('/transactions', authenticateToken, validateQuery(transactionQuerySchema), walletController.getTransactions.bind(walletController));

// Validation schemas in wallet.validation.ts
export const transactionQuerySchema = z.object({
  currency: z.enum(['points', 'usdt']).optional(),
  page: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('20')
});

export const creditWalletSchema = z.object({
  currency: z.enum(['points', 'usdt']),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().max(255).optional(),
  referenceId: z.string().max(50).optional()
});

export const debitWalletSchema = z.object({
  currency: z.enum(['points', 'usdt']),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().max(255).optional(),
  referenceId: z.string().max(50).optional()
});

export type TransactionQueryInput = z.infer<typeof transactionQuerySchema>;
export type CreditWalletInput = z.infer<typeof creditWalletSchema>;
export type DebitWalletInput = z.infer<typeof debitWalletSchema>;

// Service authentication middleware pattern
export const authenticateService = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    const serviceName = req.headers['x-service-name'] as string;

    if (!apiKey || !serviceName) {
      return next(new AuthenticationError('Service authentication required'));
    }

    // Validate API key and service authorization
    const service = await validateServiceAuth(apiKey, serviceName);
    if (!service) {
      return next(new AuthenticationError('Invalid service credentials'));
    }

    req.service = { name: serviceName, permissions: service.permissions };
    next();
  } catch (error) {
    next(error);
  }
};

// Idempotency middleware pattern
export const ensureIdempotency = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const idempotencyKey = req.headers['idempotency-key'] as string;

  if (!idempotencyKey) {
    return next(new BadRequestError('Idempotency-Key header required'));
  }

  // Check if transaction already processed
  const existingTransaction = await getCache(`idempotency:${idempotencyKey}`);
  if (existingTransaction) {
    return res.json(JSON.parse(existingTransaction));
  }

  req.idempotencyKey = idempotencyKey;
  next();
};

// Complete type definitions in wallet.types.ts
export interface WalletBalance {
  points: number;
  usdt: number;
}

export interface WalletTransactionResponse {
  id: number;
  walletId: number;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  description: string | null;        // User-facing description only
  referenceId: string | null;
  createdAt: Date;
  wallet: {
    currency: string;
  };
  // internalNotes excluded from public API response
}

export interface WalletTransactionAudit {
  id: number;
  walletId: number;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  description: string | null;        // User-facing description
  internalNotes: string | null;      // Service attribution for audit
  referenceId: string | null;
  createdAt: Date;
  wallet: {
    currency: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Internal API controller pattern with idempotency
export class InternalWalletController {
  private walletService = new WalletService();

  async creditWallet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, currency, amount, description, referenceId } = req.body;
      const serviceName = req.service!.name;
      const idempotencyKey = req.idempotencyKey!;

      // Use clean description from request - service attribution handled in service layer

      const transaction = await this.walletService.creditWallet(
        userId,
        currency,
        amount,
        description,                   // Clean user description from request
        referenceId,
        serviceName                    // Service attribution for audit
      );

      // Cache result for idempotency
      const response = successResponse({}, transaction, 'Wallet credited successfully');
      await setCache(`idempotency:${idempotencyKey}`, JSON.stringify(response), 3600);

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async debitWallet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, currency, amount, description, referenceId } = req.body;
      const serviceName = req.service!.name;
      const idempotencyKey = req.idempotencyKey!;

      // Use clean description from request - service attribution handled in service layer

      const transaction = await this.walletService.debitWallet(
        userId,
        currency,
        amount,
        description,                   // Clean user description from request
        referenceId,
        serviceName                    // Service attribution for audit
      );

      const response = successResponse({}, transaction, 'Wallet debited successfully');
      await setCache(`idempotency:${idempotencyKey}`, JSON.stringify(response), 3600);

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

// Internal API validation schemas with user-friendly descriptions
export const internalCreditSchema = z.object({
  userId: z.number().int().positive(),
  currency: z.enum(['points', 'usdt']),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'User-friendly description required').max(255),
  referenceId: z.string().max(50, 'Reference ID too long'),
});

export const internalDebitSchema = z.object({
  userId: z.number().int().positive(),
  currency: z.enum(['points', 'usdt']),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'User-friendly description required').max(255),
  referenceId: z.string().max(50, 'Reference ID too long'),
});

// Internal API routes pattern
router.post(
  '/credit',
  authenticateService,
  ensureIdempotency,
  validateBody(internalCreditSchema),
  controller.creditWallet.bind(controller)
);

router.post(
  '/debit',
  authenticateService,
  ensureIdempotency,
  validateBody(internalDebitSchema),
  controller.debitWallet.bind(controller)
);
```

### Integration Points

```yaml
DATABASE:
  - migration: "npm run db:migrate to create wallet tables"
  - client: "Use existing prisma instance from src/config/database.ts"

ROUTES:
  - public routes: "app.use('/api/v1/wallet', walletRoutes)"
  - internal routes: "app.use('/internal/v1/wallet', internalWalletRoutes)"
  - add to: src/app.ts

AUTH:
  - user middleware: "Use existing authenticateToken from src/middleware/auth.middleware.ts"
  - service middleware: "Use new authenticateService for internal APIs"
  - user access: "req.user!.id provides authenticated user ID"
  - service access: "req.service!.name provides service identification"

ENVIRONMENT:
  - service keys: "SERVICE_API_KEYS JSON string with service credentials"
  - allowed services: "ALLOWED_SERVICES array of permitted service names"
  - redis cache: "Use existing Redis for idempotency caching"

SECURITY:
  - rate limiting: "Different limits per service type"
  - network isolation: "Internal endpoints should be network-restricted"
  - audit logging: "Log all service-to-service operations"
  - idempotency: "Mandatory for all financial operations"
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
npm run lint                    # ESLint checks
npx tsc --noEmit               # TypeScript compilation check
npm run format                 # Prettier formatting
npm run db:generate            # Generate Prisma client after schema changes
```
### Level 2: Integration Testing (System Validation)

```bash
# Start development server
npm run dev

# Test public wallet endpoints
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/v1/wallet/balance
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/v1/wallet/transactions

# Test internal service endpoints
curl -X POST http://localhost:3000/internal/v1/wallet/credit \
  -H "X-API-Key: sk_order_xxx" \
  -H "X-Service-Name: order-service" \
  -H "Idempotency-Key: test_credit_001" \
  -H "Content-Type: application/json" \
  -d '{"userId": 1, "currency": "points", "amount": 100, "description": "Test credit", "referenceId": "test_001"}'

# Database migration test
npm run db:migrate
```

### Level 3: Creative & Domain-Specific Validation

```bash
# Test concurrent operations (create test script)
node scripts/test-concurrent-wallet-operations.js

# Verify database constraints
npm run db:studio  # Check wallet and transaction data integrity
```

## Final Validation Checklist

### Technical Validation

- [ ] All validation levels completed successfully
- [ ] Database migration creates wallet tables correctly
- [ ] Wallet balances stored as integers (cents for USDT, points as-is)
- [ ] Concurrent credit/debit operations work safely
- [ ] Transaction history includes all balance changes

### Feature Validation

- [ ] Users can get wallet balance (points and USDT)
- [ ] Users can get paginated transaction history
- [ ] Internal credit operations add to balance and create transaction record
- [ ] Internal debit operations subtract from balance with insufficient balance validation
- [ ] **Service credit/debit operations work via internal API endpoints**
- [ ] **Service authentication prevents unauthorized access**
- [ ] **Idempotency prevents duplicate transactions from services**
- [ ] All transaction records include proper currency and amount information
- [ ] **Service attribution visible in transaction descriptions and reference IDs**

### Code Quality Validation

- [ ] Follows existing codebase patterns for services, controllers, routes
- [ ] Uses existing error handling and response utilities
- [ ] Maintains consistency with user authentication patterns
- [ ] Database schema follows existing naming conventions

---

## Anti-Patterns to Avoid

- ❌ Don't add complex wallet features not explicitly requested (transfers, external payments, etc.)
- ❌ Don't use floating-point numbers for monetary values
- ❌ Don't skip Prisma transactions for credit/debit operations
- ❌ Don't create new authentication patterns - use existing middleware for users
- ❌ Don't add wallet features beyond the basic requirements (YAGNI principle)
- ❌ **Don't expose internal API endpoints on public networks without proper isolation**
- ❌ **Don't skip idempotency headers for service-to-service financial operations**
- ❌ **Don't allow services to perform operations without proper authentication**
- ❌ **Don't forget to audit and log all service-to-service transactions**

---

## 🏗️ **Microservice Integration Architecture**

### **Service-to-Service API Design**

**Internal Endpoints:**
```
POST /internal/v1/wallet/credit      # Credit user wallet
POST /internal/v1/wallet/debit       # Debit user wallet
GET  /internal/v1/wallet/balance/:userId  # Get wallet balance
```

**Authentication Headers:**
```
X-API-Key: sk_service_xxxxx         # Service API key
X-Service-Name: order-service       # Service identifier
Idempotency-Key: unique_operation_id # Prevent duplicates
```

**Request Examples:**

**Credit from Order Service:**
```bash
curl -X POST /internal/v1/wallet/credit \
  -H "X-API-Key: sk_order_xxx" \
  -H "X-Service-Name: order-service" \
  -H "Idempotency-Key: order_12345_refund" \
  -d '{
    "userId": 123,
    "currency": "usdt",
    "amount": 2500,
    "description": "Order refund",
    "referenceId": "order_12345"
  }'
```

**Credit from Referral Service:**
```bash
curl -X POST /internal/v1/wallet/credit \
  -H "X-API-Key: sk_ref_xxx" \
  -H "X-Service-Name: referral-service" \
  -H "Idempotency-Key: ref_bonus_user123" \
  -d '{
    "userId": 123,
    "currency": "points",
    "amount": 100,
    "description": "Referral bonus",
    "referenceId": "ref_456"
  }'
```

**Service Configuration:**
```bash
# Environment variables
SERVICE_API_KEYS='{"order-service":"sk_order_xxx","referral-service":"sk_ref_xxx"}'
ALLOWED_SERVICES='["order-service","referral-service","payment-service"]'

# Service permissions
{
  "order-service": ["credit", "debit", "balance"],
  "referral-service": ["credit", "balance"],
  "payment-service": ["credit", "debit", "balance"]
}
```

**Security Features:**
- ✅ API key authentication per service
- ✅ Service-level permission controls
- ✅ Mandatory idempotency for financial operations
- ✅ Enhanced audit trail with service attribution
- ✅ Network isolation for internal endpoints
- ✅ Rate limiting per service type
- ✅ Automatic transaction logging and monitoring