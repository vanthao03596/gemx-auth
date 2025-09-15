name: "Email OTP Login Feature - Simple Implementation"
description: |

---

## Goal

**Feature Goal**: Enable users to log in using a 6-digit OTP sent to their email address

**Deliverable**: Complete email OTP login system that works for new and existing users

**Success Definition**: Users can enter their email, receive an OTP, and authenticate successfully

## User Persona

**Target User**: Any user accessing the application (new or returning)

**Use Case**: Passwordless login via email verification

**User Journey**:
1. User enters email address
2. System sends 6-digit OTP to email
3. User enters OTP to complete login

**Pain Points Addressed**: Eliminates password management and provides secure, simple authentication

## Why

- Simplifies login process by removing password requirements
- Provides secure authentication via email verification
- Works seamlessly for both new user registration and existing user login
- Reduces password-related support issues

## What

Users enter their email and receive a 6-digit numeric OTP via email. The system automatically creates new users or authenticates existing ones based on email verification.

### Success Criteria

- [ ] User can request OTP by entering email
- [ ] System sends 6-digit OTP to user's email within 30 seconds
- [ ] OTP expires after 10 minutes
- [ ] New users are automatically created upon successful OTP verification
- [ ] Existing users are authenticated upon successful OTP verification
- [ ] System prevents OTP brute force attacks with rate limiting

## All Needed Context

### Context Completeness Check

_This PRP provides everything needed to implement email OTP login following existing codebase patterns_

### Documentation & References

```yaml
- url: https://nodemailer.com/about/
  why: Simple email sending with SMTP
  critical: Use createTransporter with Gmail SMTP for simplicity

- file: src/features/auth/auth.service.ts
  why: Follow existing authentication service patterns
  pattern: Service class structure, JWT generation, user creation/lookup
  gotcha: Use select to exclude password field, throw custom errors

- file: src/features/auth/auth.validation.ts
  why: Follow existing Zod validation patterns
  pattern: Email validation, schema structure, error messages

- file: prisma/schema.prisma
  why: Follow existing database schema patterns
  pattern: Int ID, snake_case mapping, timestamps, table relations

- file: src/middleware/rateLimiter.middleware.ts
  why: Apply rate limiting to OTP endpoints
  pattern: Redis-based rate limiting with custom messages
```

### Current Codebase tree

```bash
src/
├── features/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.validation.ts
│   │   └── auth.routes.ts
│   └── health/
├── middleware/
├── utils/
└── config/
```

### Desired Codebase tree with files to be added

```bash
src/
├── features/
│   ├── auth/
│   │   ├── auth.controller.ts      # Add sendOtp and verifyOtp methods
│   │   ├── auth.service.ts         # Add OTP business logic
│   │   ├── auth.validation.ts      # Add OTP schemas
│   │   └── auth.routes.ts          # Add OTP routes
│   └── otp/
│       ├── email.service.ts        # Simple email sending service
└── utils/
    └── otp.utils.ts                # Simple OTP generation
```

### Known Gotchas of our codebase & Library Quirks

```typescript
// CRITICAL: Prisma requires select to exclude password field
const user = await prisma.user.findUnique({
  where: { email },
  select: { id: true, email: true, name: true, createdAt: true, updatedAt: true }
});

// CRITICAL: Use existing error classes for consistency
throw new AuthenticationError('Invalid OTP code');

// CRITICAL: Follow existing rate limiting patterns
export const otpRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 3, // 3 OTP requests per window
});

// CRITICAL: Database uses snake_case mapping
@@map("otp_codes")
@map("expires_at")
```

## Implementation Blueprint

### Data models and structure

```typescript
// Prisma schema addition
model OtpCode {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  email     String   @map("email")
  code      String   @map("code")
  expiresAt DateTime @map("expires_at")
  usedAt    DateTime? @map("used_at")
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([email])
  @@map("otp_codes")
}

// TypeScript interfaces
interface SendOtpRequest {
  email: string;
}

interface VerifyOtpRequest {
  email: string;
  code: string;
}
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: CREATE prisma migration for otp_codes table
  - IMPLEMENT: Add OtpCode model to schema.prisma following existing patterns
  - FOLLOW pattern: User model structure (Int ID, snake_case mapping)
  - NAMING: otp_codes table, snake_case fields
  - RUN: npx prisma db push

Task 2: CREATE src/utils/otp.utils.ts
  - IMPLEMENT: Simple 6-digit OTP generation using Math.random
  - FUNCTION: generateOtp() returns 6-digit string
  - NAMING: Utility functions with descriptive names
  - DEPENDENCIES: None (use built-in Math.random)

Task 3: CREATE src/features/otp/email.service.ts
  - IMPLEMENT: Simple nodemailer email sending
  - FOLLOW pattern: Service class structure from auth.service.ts
  - FUNCTION: sendOtpEmail(email, code) using Gmail SMTP
  - DEPENDENCIES: nodemailer package

Task 4: MODIFY src/features/auth/auth.validation.ts
  - IMPLEMENT: Add sendOtpSchema and verifyOtpSchema
  - FOLLOW pattern: Existing Zod schemas with email validation
  - NAMING: camelCase schema names, descriptive error messages
  - DEPENDENCIES: Import from existing zod

Task 5: MODIFY src/features/auth/auth.service.ts
  - IMPLEMENT: Add sendOtp and verifyOtp methods to AuthService
  - FOLLOW pattern: Existing service methods, error handling, JWT generation
  - FUNCTION: Auto-create users on successful OTP verification
  - DEPENDENCIES: Import OTP utils and email service

Task 6: MODIFY src/features/auth/auth.controller.ts
  - IMPLEMENT: Add sendOtp and verifyOtp HTTP handlers
  - FOLLOW pattern: Existing controller methods, response handling
  - FUNCTION: Handle HTTP requests and call service methods
  - DEPENDENCIES: Import new validation schemas

Task 7: MODIFY src/features/auth/auth.routes.ts
  - IMPLEMENT: Add POST /send-otp and POST /verify-otp routes
  - FOLLOW pattern: Existing route definitions with middleware
  - MIDDLEWARE: Apply rate limiting and validation
  - DEPENDENCIES: Import new controller methods
```

### Implementation Patterns & Key Details

```typescript
// OTP Generation (KISS principle)
export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Email Service (Simple SMTP)
export class EmailService {
  private transporter = nodemailer.createTransporter({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  async sendOtpEmail(email: string, code: string): Promise<void> {
    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Your Login Code',
      text: `Your OTP code is: ${code}. Valid for 10 minutes.`
    });
  }
}

// Service Integration (Follow existing auth patterns)
async sendOtp(email: string): Promise<void> {
  // Generate OTP
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Create or find user
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { email, password: '', name: email.split('@')[0] }
    });
  }

  // Store OTP
  await prisma.otpCode.upsert({
    where: { email },
    update: { code, expiresAt, usedAt: null },
    create: { userId: user.id, email, code, expiresAt }
  });

  // Send email
  await this.emailService.sendOtpEmail(email, code);
}
```

### Integration Points

```yaml
DATABASE:
  - migration: "Add otp_codes table with foreign key to users"
  - pattern: "Follow existing User model patterns"

ENV_VARS:
  - add to: .env
  - pattern: "SMTP_USER, SMTP_PASS, SMTP_FROM for email sending"

ROUTES:
  - endpoints: "POST /auth/send-otp, POST /auth/verify-otp"
  - middleware: "Rate limiting (3 requests per 15 min)"
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
npm run lint                    # ESLint checks
npm run build                   # TypeScript compilation
```

### Level 2: Integration Testing (System Validation)

```bash
# Test OTP endpoints
curl -X POST http://localhost:3000/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

curl -X POST http://localhost:3000/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "code": "123456"}'

# Expected: 200 responses, email sent, JWT token returned
```

### Level 3: Manual Validation

```bash
# Database check
npx prisma studio
# Verify otp_codes table exists and stores OTP entries

# Email delivery check
# Verify test emails are received with 6-digit OTP
```

## Final Validation Checklist

### Technical Validation

- [ ] No linting errors: `npm run lint`
- [ ] No type errors: `npx tsc --noEmit`
- [ ] Database migration successful: `npx prisma db push`
- [ ] Production build succeeds: `npm run build`

### Feature Validation

- [ ] User can request OTP via email
- [ ] 6-digit OTP generated and stored in database
- [ ] Email delivered within 30 seconds
- [ ] OTP expires after 10 minutes
- [ ] New users created automatically on successful verification
- [ ] Existing users authenticated on successful verification
- [ ] Rate limiting prevents abuse (3 requests per 15 minutes)

### Code Quality Validation

- [ ] Follows existing TypeScript patterns
- [ ] Uses existing error handling (AuthenticationError, ValidationError)
- [ ] Database follows snake_case mapping conventions
- [ ] Reuses existing middleware and utilities
- [ ] Simple implementation without over-engineering

### KISS/YAGNI Compliance

- [ ] No unnecessary features beyond email OTP login
- [ ] Simple 6-digit numeric OTP (no complex algorithms)
- [ ] Basic email sending (no advanced templates)
- [ ] Database storage only (no Redis complexity)
- [ ] Reuses existing auth patterns (no new architecture)

---

## Anti-Patterns to Avoid

- ❌ Don't add SMS OTP (not requested - YAGNI)
- ❌ Don't use complex OTP libraries (simple generation works - KISS)
- ❌ Don't create separate user management (reuse existing auth - KISS)
- ❌ Don't add CAPTCHA or advanced security (not required - YAGNI)
- ❌ Don't overcomplicate email templates (plain text works - KISS)
- ❌ Don't add multiple OTP types (only login needed - YAGNI)