import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

export const requireCsrfSafe = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF check for requests authenticated via API Key / Bearer token (Workers)
  if (req.authMethod !== 'cookie') {
    return next();
  }
  
  const origin = req.headers.origin || req.headers.referer;
  // Use CORS_ORIGIN as the single source of truth for allowed frontend origins
  if (!origin || !origin.includes(env.CORS_ORIGIN)) {
    return res.status(403).json({ success: false, error: { message: 'Invalid origin (CSRF)' } });
  }
  
  next();
};
