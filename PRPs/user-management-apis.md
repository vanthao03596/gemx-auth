name: "User Management APIs - Simple Implementation"
description: |
  Add basic user API endpoints following KISS and YAGNI principles.
  Only implement what is needed: batch users and single user by ID.

---

## Goal

**Feature Goal**: Add two simple API endpoints for user data retrieval

**Deliverable**:
- POST /api/v1/users/batch (get multiple users by IDs)
- GET /api/v1/users/:id (single user)

**Success Definition**: Both endpoints return user data excluding passwords with proper authentication

## Why

- Need user listing for admin interface
- Need single user lookup for profile views
- Must follow existing auth patterns for security

## What

Add two authenticated endpoints that return user data:

### Success Criteria

- [ ] POST /users/batch accepts array of user IDs and returns matching users
- [ ] GET /users/:id returns single user by ID
- [ ] Both exclude password field
- [ ] Both require authentication
- [ ] Batch endpoint validates IDs are numbers
- [ ] Follows existing error handling

## All Needed Context

### Context Completeness Check

_Simple implementation following existing auth controller patterns - minimal new code required._

### Documentation & References

```yaml
- file: src/features/auth/auth.controller.ts
  why: Copy getProfile method pattern for user controller
  pattern: Request/Response/NextFunction typing with try-catch-next
  gotcha: Always use .bind(controller) in routes

- file: src/features/auth/auth.service.ts
  why: Copy getUserById method for user service
  pattern: Prisma select pattern excluding password field
  gotcha: Return null for not found, let controller handle error

- file: src/features/auth/auth.routes.ts
  why: Copy route structure with middleware chain
  pattern: authenticateToken -> validation -> controller method
  gotcha: Use explicit controller binding

- file: src/features/auth/auth.validation.ts
  why: Copy validation schema pattern for batch request body
  pattern: z.object() with array validation
  gotcha: Use z.array() for user IDs with proper transforms
```

### Current Codebase Structure

```
src/features/
├── auth/                    # Existing auth feature to copy
│   ├── auth.controller.ts   # Pattern for user.controller.ts
│   ├── auth.service.ts      # Pattern for user.service.ts
│   └── auth.routes.ts       # Pattern for user.routes.ts
└── users/                   # New feature directory
    ├── user.controller.ts   # Copy auth controller pattern
    ├── user.service.ts      # Copy auth service pattern
    ├── user.validation.ts   # Simple validation for batch request
    └── user.routes.ts       # Copy auth routes pattern
```

### Known Gotchas

```typescript
// CRITICAL: Always exclude password field using Prisma select
select: {
  id: true,
  email: true,
  name: true,
  walletAddress: true,
  createdAt: true,
  updatedAt: true,
  // password: false (implicit exclusion)
}

// CRITICAL: Controller methods must return Promise<void>
async getUsers(req: Request, res: Response, next: NextFunction): Promise<void>

// CRITICAL: Always bind controller methods in routes
userController.getUsers.bind(userController)
```

## Implementation Blueprint

### Implementation Tasks (copy existing patterns)

```yaml
Task 1: CREATE src/features/users/user.validation.ts
  - COPY: Auth validation schema pattern
  - IMPLEMENT: batchUsersSchema with z.array() for user IDs
  - FOLLOW: z.object() structure with ID validation and transform
  - NAMING: BatchUsersInput type from schema

Task 2: CREATE src/features/users/user.service.ts
  - COPY: AuthService.getUserById method pattern
  - IMPLEMENT: getUsersByIds(ids[]) and getUserById(id) methods
  - FOLLOW: Exact Prisma select pattern, use findMany with where: { id: { in: ids } }
  - NAMING: UserService class, standard method names

Task 3: CREATE src/features/users/user.controller.ts
  - COPY: AuthController.getProfile method pattern
  - IMPLEMENT: getBatchUsers and getUser controller methods
  - FOLLOW: Request/Response/NextFunction typing, try-catch-next pattern
  - NAMING: UserController class with async methods

Task 4: CREATE src/features/users/user.routes.ts
  - COPY: Auth routes middleware chain pattern
  - IMPLEMENT: POST /batch and GET /:id routes
  - FOLLOW: authenticateToken -> validateBody -> controller.method.bind(controller)
  - PLACEMENT: Export as userRoutes

Task 5: UPDATE src/app.ts
  - ADD: Import userRoutes
  - ADD: app.use('/api/v1/users', userRoutes)
  - FOLLOW: Existing route mounting pattern after auth routes
```

### Simple Implementation Pattern

```typescript
// user.validation.ts - Simple validation for batch request
export const batchUsersSchema = z.object({
  userIds: z.array(z.number().int().positive(), 'User IDs must be positive integers')
    .min(1, 'At least one user ID is required')
    .max(100, 'Maximum 100 user IDs allowed')
});

export type BatchUsersInput = z.infer<typeof batchUsersSchema>;

// user.service.ts - Copy from AuthService.getUserById pattern
export class UserService {
  async getUsersByIds(userIds: number[]): Promise<Omit<User, 'password'>[]> {
    return prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        name: true,
        walletAddress: true,
        createdAt: true,
        updatedAt: true,
      }
    });
  }

  async getUserById(userId: number): Promise<Omit<User, 'password'> | null> {
    // Copy exact pattern from AuthService.getUserById
  }
}

// user.controller.ts - Copy from AuthController.getProfile pattern
export class UserController {
  async getBatchUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.validatedBody as BatchUsersInput;
      const users = await this.userService.getUsersByIds(data.userIds);

      successResponse(res, { users }, 'Users retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}
```

## Validation Loop

### Level 1: Build & Type Check
```bash
npm run build                # Must compile without errors
npx tsc --noEmit            # Type checking passes
```

### Level 2: Basic Testing
```bash
npm run dev                 # Start server
curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"userIds": [1,2,3]}' http://localhost:3000/api/v1/users/batch
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/v1/users/1
```

### Level 3: Integration Testing
```bash
npm test                    # All existing tests still pass
```

## Final Validation Checklist

### Technical Validation
- [ ] Code compiles: `npm run build`
- [ ] Types check: `npx tsc --noEmit`
- [ ] Server starts: `npm run dev`

### Feature Validation
- [ ] POST /users/batch accepts array of user IDs and returns users (no passwords)
- [ ] GET /users/:id returns single user (no password)
- [ ] Both require authentication (401 without token)
- [ ] Batch validates userIds array (1-100 items, positive integers)
- [ ] 404 for non-existent user ID

### Code Quality Validation
- [ ] Follows exact patterns from auth feature
- [ ] Uses existing utilities (response, validation)
- [ ] No new dependencies added
- [ ] Password field excluded in all responses

---

## Anti-Patterns to Avoid

- ❌ Don't add complex filtering - just batch by IDs
- ❌ Don't add user creation/updates - only retrieval
- ❌ Don't add search functionality - YAGNI
- ❌ Don't add pagination to batch endpoint - simple array response
- ❌ Don't add rate limiting beyond existing auth patterns
- ❌ Don't return password field ever