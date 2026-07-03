import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../config/logger.js';
import { isTokenBlacklisted } from '../modules/auth/auth.service.js';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw AppError.unauthorized('Authorization header is required');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw AppError.unauthorized('Authorization header must be in format: Bearer <token>');
    }

    const token = parts[1];

    if (isTokenBlacklisted(token)) {
      throw AppError.unauthorized('Token has been invalidated');
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      req.user = decoded;
      next();
    } catch (jwtError) {
      if (jwtError instanceof jwt.TokenExpiredError) {
        throw AppError.unauthorized('Token has expired');
      }
      if (jwtError instanceof jwt.JsonWebTokenError) {
        throw AppError.unauthorized('Invalid token');
      }
      throw jwtError;
    }
  } catch (error) {
    next(error);
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next();
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return next();
  }

  try {
    const token = parts[1];
    if (isTokenBlacklisted(token)) {
      return next();
    }
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = decoded;
  } catch {
    logger.debug('Optional auth token invalid, continuing without user');
  }

  next();
}
