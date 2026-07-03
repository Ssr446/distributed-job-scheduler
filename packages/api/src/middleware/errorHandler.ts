import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { AppError } from '../utils/AppError.js';
import { sendError } from '../utils/response.js';
import { logger } from '../config/logger.js';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // AppError — known operational errors
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error({ err }, 'Non-operational AppError');
    }
    sendError(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    sendError(res, 400, 'VALIDATION_ERROR', 'Request validation failed', details);
    return;
  }

  // Prisma known request errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const target = (err.meta?.target as string[])?.join(', ') ?? 'field';
        sendError(res, 409, 'DUPLICATE_ENTRY', `A record with this ${target} already exists`);
        return;
      }
      case 'P2025':
        sendError(res, 404, 'NOT_FOUND', 'The requested record was not found');
        return;
      case 'P2003':
        sendError(res, 400, 'FOREIGN_KEY_VIOLATION', 'Referenced record does not exist');
        return;
      default:
        logger.error({ err, code: err.code }, 'Prisma error');
        sendError(res, 500, 'DATABASE_ERROR', 'A database error occurred');
        return;
    }
  }

  // Prisma validation errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.error({ err }, 'Prisma validation error');
    sendError(res, 400, 'DATABASE_VALIDATION_ERROR', 'Invalid data provided');
    return;
  }

  // JSON parse errors
  if (err instanceof SyntaxError && 'body' in err) {
    sendError(res, 400, 'INVALID_JSON', 'Request body contains invalid JSON');
    return;
  }

  // Unknown errors
  logger.error({ err }, 'Unhandled error');
  sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
};
