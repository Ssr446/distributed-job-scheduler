import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

export const requireCsrfSafe = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF check for requests authenticated via API Key / Bearer token (Workers)
  if (req.authMethod !== 'cookie') {
    return next();
  }
  
  const origin = req.headers.origin || req.headers.referer;
  if (!origin || !origin.includes(env.FRONTEND_URL)) {
    return res.status(403).json({ success: false, error: { message: 'Invalid origin (CSRF)' } });
  }
  
  next();
};
