import { Response } from 'express';
import { env } from '../config/env';
import {
  ApiResponse,
  PaginatedResponse,
  ErrorResponse,
  PaginationMeta,
  ValidationError,
  ErrorCode,
  HttpStatus,
} from '../types/response.types';
import { ZodValidationError } from './errors';

export const successResponse = <T>(
  res: Response,
  data?: T,
  message: string = 'Success',
  statusCode: number = HttpStatus.OK,
  meta?: Record<string, unknown>
): void => {
  const response: ApiResponse<T> = {
    success: true,
    message,
    ...(data !== undefined && { data }),
    ...(meta && { meta }),
  };

  res.status(statusCode).json(response);
};

export const paginatedResponse = <T>(
  res: Response,
  data: T[],
  meta: PaginationMeta,
  message: string = 'Data retrieved successfully',
  statusCode: number = HttpStatus.OK
): void => {
  const response: PaginatedResponse<T> = {
    success: true,
    message,
    data,
    meta,
  };

  res.status(statusCode).json(response);
};

export const errorResponse = (
  res: Response,
  message: string = 'Internal Server Error',
  statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR,
  errorCode?: ErrorCode,
  errors?: ValidationError[],
  stack?: string
): void => {
  const response: ErrorResponse = {
    success: false,
    message,
    ...(errorCode && { error_code: errorCode }),
    ...(errors && errors.length > 0 && { errors }),
    ...(env.NODE_ENV === 'development' && stack && { stack }),
  };

  res.status(statusCode).json(response);
};

export const handleValidationError = (
  res: Response,
  error: ZodValidationError
): void => {
  const validationErrors = error.zodError.issues.map((issue) => {
    const field = issue.path.length > 0 ? issue.path.join('.') : error.target;

    let message = issue.message;

    if (issue.path.length === 0) {
      message = `${error.target.charAt(0).toUpperCase() + error.target.slice(1)} is required`;
    }

    return { field, message };
  });

  errorResponse(
    res,
    'Validation Error',
    HttpStatus.BAD_REQUEST,
    ErrorCode.VALIDATION_ERROR,
    validationErrors
  );
};

export const handleAuthenticationError = (
  res: Response,
  message: string = 'Authentication required'
): void => {
  errorResponse(
    res,
    message,
    HttpStatus.UNAUTHORIZED,
    ErrorCode.AUTHENTICATION_ERROR
  );
};

export const handleNotFoundError = (
  res: Response,
  message: string = 'Resource not found'
): void => {
  errorResponse(res, message, HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
};

export const handleConflictError = (
  res: Response,
  message: string = 'Resource already exists'
): void => {
  errorResponse(res, message, HttpStatus.CONFLICT, ErrorCode.CONFLICT);
};
