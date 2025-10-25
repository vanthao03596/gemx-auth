import { Request, Response, NextFunction } from 'express';
import {
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  PrismaClientValidationError,
} from '@prisma/client/runtime/library';
import { env } from '../config/env';
import { errorResponse, handleValidationError } from '../utils/response.utils';
import { ErrorCode, HttpStatus } from '../types/response.types';
import { AppError, ZodValidationError } from '../utils/errors';

interface CustomError extends Error {
  statusCode?: number;
  status?: number;
}

export const errorHandler = (
  error: CustomError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode =
    error.statusCode || error.status || HttpStatus.INTERNAL_SERVER_ERROR;
  let message = error.message || 'Internal Server Error';
  let errorCode: ErrorCode | undefined;

  console.error('Error:', error);

  if (error instanceof ZodValidationError) {
    handleValidationError(res, error);
    return;
  }

  if (error instanceof AppError) {
    const stack = env.NODE_ENV === 'development' ? error.stack : undefined;
    const isProduction = env.NODE_ENV === 'production';
    const is5xxError = error.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR;

    // In production, hide detailed error messages for 5xx errors
    const sanitizedMessage = isProduction && is5xxError
      ? 'Internal server error'
      : error.message;

    errorResponse(
      res,
      sanitizedMessage,
      error.statusCode,
      error.errorCode,
      undefined,
      stack
    );
    return;
  }

  // Handle Prisma errors
  if (error instanceof PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      // Unique constraint violation
      statusCode = HttpStatus.CONFLICT;
      message = 'Resource already exists';
      errorCode = ErrorCode.CONFLICT;
    } else if (error.code === 'P2025') {
      // Record not found
      statusCode = HttpStatus.NOT_FOUND;
      message = 'Resource not found';
      errorCode = ErrorCode.NOT_FOUND;
    } else {
      statusCode = HttpStatus.BAD_REQUEST;
      message = 'Database operation failed';
      errorCode = ErrorCode.VALIDATION_ERROR;
    }
  } else if (error instanceof PrismaClientUnknownRequestError) {
    statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    message = 'Database connection error';
    errorCode = ErrorCode.INTERNAL_ERROR;
  } else if (error instanceof PrismaClientValidationError) {
    statusCode = HttpStatus.BAD_REQUEST;
    message = 'Invalid data provided';
    errorCode = ErrorCode.VALIDATION_ERROR;
  } else if (error.name === 'JWSInvalid') {
    statusCode = HttpStatus.UNAUTHORIZED;
    message = 'Invalid token';
    errorCode = ErrorCode.INVALID_TOKEN;
  } else if (error.name === 'JWTExpired') {
    statusCode = HttpStatus.UNAUTHORIZED;
    message = 'Token expired';
    errorCode = ErrorCode.TOKEN_EXPIRED;
  } else if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
    errorCode = ErrorCode.INTERNAL_ERROR;
  }

  // In production, hide detailed error messages for 5xx errors
  const isProduction = env.NODE_ENV === 'production';
  const is5xxError = statusCode >= HttpStatus.INTERNAL_SERVER_ERROR;
  const sanitizedMessage = isProduction && is5xxError
    ? 'Internal server error'
    : message;

  const stack = env.NODE_ENV === 'development' ? error.stack : undefined;

  errorResponse(res, sanitizedMessage, statusCode, errorCode, undefined, stack);
};

export const notFound = (req: Request, res: Response) => {
  errorResponse(
    res,
    `Route ${req.originalUrl} not found`,
    HttpStatus.NOT_FOUND,
    ErrorCode.NOT_FOUND
  );
};
