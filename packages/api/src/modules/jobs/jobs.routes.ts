import { Router } from 'express';
import * as ctrl from './jobs.controller.js';
import { validate } from '../../middleware/validator.js';
import { createJobSchema, batchCreateJobSchema, startJobSchema, completeJobSchema, failJobSchema } from './jobs.validator.js';
import { apiKeyAuth } from '../../middleware/auth.js';
import { workerRateLimiter } from '../../middleware/rateLimiter.js';

export const jobRoutes = Router({ mergeParams: true });
jobRoutes.get('/:id', ctrl.getJob);
jobRoutes.post('/:id/retry', ctrl.retryJob);
jobRoutes.post('/:id/cancel', ctrl.cancelJob);
jobRoutes.get('/:id/logs', ctrl.getJobLogs);

export const queueJobRoutes = Router({ mergeParams: true });
queueJobRoutes.post('/', validate({ body: createJobSchema as any }), ctrl.createJob);
queueJobRoutes.post('/batch', validate({ body: batchCreateJobSchema as any }), ctrl.createBatch);
queueJobRoutes.get('/', ctrl.listJobs);

// Worker execution endpoints (mounted separately in app.ts to bypass standard auth/csrf)
export const workerJobRoutes = Router({ mergeParams: true });
workerJobRoutes.post('/:id/start', apiKeyAuth, workerRateLimiter, validate({ body: startJobSchema as any }), ctrl.startJob);
workerJobRoutes.post('/:id/complete', apiKeyAuth, workerRateLimiter, validate({ body: completeJobSchema as any }), ctrl.completeJob);
workerJobRoutes.post('/:id/fail', apiKeyAuth, workerRateLimiter, validate({ body: failJobSchema as any }), ctrl.failJob);

export const workerQueueRoutes = Router({ mergeParams: true });
workerQueueRoutes.post('/:queueId/jobs/claim', apiKeyAuth, workerRateLimiter, ctrl.claimJobs);
