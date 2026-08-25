import { Router } from 'express';
import * as ctrl from './workers.controller.js';
import { apiKeyAuth } from '../../middleware/auth.js';
import { workerRateLimiter } from '../../middleware/rateLimiter.js';

// Dashboard routes (JWT-authenticated, mounted behind `authenticate`)
export const workerRoutes = Router();
workerRoutes.get('/', ctrl.listWorkers);
workerRoutes.post('/register', ctrl.registerWorker);
workerRoutes.get('/:id', ctrl.getWorker);
workerRoutes.post('/:id/heartbeat', ctrl.heartbeat);
workerRoutes.post('/:id/deregister', ctrl.deregisterWorker);

// Worker-process routes (API-key-authenticated, mounted before `authenticate`)
export const workerSelfRoutes = Router();
workerSelfRoutes.post('/register', apiKeyAuth, workerRateLimiter, ctrl.registerWorker);
workerSelfRoutes.post('/:id/heartbeat', apiKeyAuth, workerRateLimiter, ctrl.heartbeat);
workerSelfRoutes.post('/:id/deregister', apiKeyAuth, workerRateLimiter, ctrl.deregisterWorker);
