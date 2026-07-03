import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../config/logger.js';
import crypto from 'crypto';
import { prisma } from '../config/database.js';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  jti: string;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      worker?: { id: string };
      authMethod?: 'cookie' | 'apiKey' | 'header';
    }
  }
}

export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    let token = req.cookies?.accessToken;
    let authMethod: 'cookie' | 'header' = 'cookie';

    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
        authMethod = 'header';
      }
    }

    if (!token) {
      throw AppError.unauthorized('Authentication token is required');
    }


    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      
      const revoked = await prisma.revokedToken.findUnique({ where: { jti: decoded.jti } });
      if (revoked) {
        throw AppError.unauthorized('Token has been revoked');
      }

      req.user = decoded;
      req.authMethod = authMethod;
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
};

export const optionalAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  let token = req.cookies?.accessToken;
  let authMethod: 'cookie' | 'header' = 'cookie';

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
      authMethod = 'header';
    }
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const revoked = await prisma.revokedToken.findUnique({ where: { jti: decoded.jti } });
    if (!revoked) {
      req.user = decoded;
      req.authMethod = authMethod;
    }
  } catch {
    logger.debug('Optional auth token invalid, continuing without user');
  }

  next();
};

export const apiKeyAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw AppError.unauthorized('Authorization header is required');
    }
    
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw AppError.unauthorized('Authorization header must be in format: Bearer <id>.<secret>');
    }
    
    const token = parts[1];
    const tokenParts = token.split('.');
    if (tokenParts.length !== 2) {
      throw AppError.unauthorized('Invalid API key format. Expected: <id>.<secret>');
    }
    
    const [keyId, rawSecret] = tokenParts;
    
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: keyId }
    });
    
    if (!apiKey || apiKey.revokedAt) {
      throw AppError.unauthorized('Invalid or revoked API key');
    }
    
    const expectedHashBuffer = Buffer.from(apiKey.keyHash, 'hex');
    const actualHash = crypto.createHash('sha256').update(rawSecret).digest('hex');
    const actualHashBuffer = Buffer.from(actualHash, 'hex');
    
    if (expectedHashBuffer.length !== actualHashBuffer.length || !crypto.timingSafeEqual(expectedHashBuffer, actualHashBuffer)) {
      throw AppError.unauthorized('Invalid API key');
    }
    
    req.worker = { id: apiKey.workerId };
    req.authMethod = 'apiKey';
    next();
  } catch (error) {
    next(error);
  }
};
