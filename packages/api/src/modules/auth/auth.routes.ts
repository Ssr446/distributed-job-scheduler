import { Router } from 'express';
import * as authController from './auth.controller.js';
import { validate } from '../../middleware/validator.js';
import { authenticate } from '../../middleware/auth.js';
import { registerSchema, loginSchema, refreshTokenSchema } from './auth.validator.js';
import { strictRateLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

router.post(
  '/register',
  strictRateLimiter,
  validate({ body: registerSchema.shape.body }),
  authController.register
);

router.post(
  '/login',
  strictRateLimiter,
  validate({ body: loginSchema.shape.body }),
  authController.login
);

router.post(
  '/refresh',
  strictRateLimiter,
  validate({ body: refreshTokenSchema.shape.body }),
  authController.refreshToken
);

router.post('/logout', authenticate, authController.logout);

router.get('/me', authenticate, authController.getProfile);
router.put('/me', authenticate, authController.updateProfile);

export default router;
