import { ValidationTarget } from '../middleware/validation.middleware';
import { ErrorCode, HttpStatus } from '../types/response.types';
import { z } from 'zod';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: ErrorCode | undefined;

  constructor(message: string, statusCode: number, errorCode?: ErrorCode) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed') {
    super(message, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, HttpStatus.UNAUTHORIZED, ErrorCode.AUTHENTICATION_ERROR);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, HttpStatus.FORBIDDEN, ErrorCode.AUTHORIZATION_ERROR);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, HttpStatus.CONFLICT, ErrorCode.CONFLICT);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request') {
    super(message, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_ERROR);
  }
}

export class ZodValidationError extends AppError {
  public readonly zodError: z.ZodError;
  public readonly target: ValidationTarget;

  constructor(zodError: z.ZodError, target: ValidationTarget) {
    super(
      'Validation Error',
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR
    );
    this.zodError = zodError;
    this.target = target;
  }
}
