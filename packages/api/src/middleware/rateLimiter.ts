import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { sendError } from '../utils/response.js';

export const rateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, 429, 'TOO_MANY_REQUESTS', 'Rate limit exceeded. Please try again later.');
  },
  skip: (req: any) => env.NODE_ENV === 'test' || req.authMethod === 'apiKey',
});

export const strictRateLimiter = rateLimit({
  windowMs: 60000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, 429, 'TOO_MANY_REQUESTS', 'Rate limit exceeded. Please try again later.');
  },
  skip: (req: any) => env.NODE_ENV === 'test' || req.authMethod === 'apiKey',
});

export const workerRateLimiter = rateLimit({
  windowMs: 60000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, 429, 'TOO_MANY_REQUESTS', 'Worker rate limit exceeded.');
  },
  skip: () => env.NODE_ENV === 'test',
});
