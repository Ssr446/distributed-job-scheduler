import { Router } from 'express';
import * as ctrl from './jobs.controller.js';
import { validate } from '../../middleware/validator.js';
import { createJobSchema, batchCreateJobSchema } from './jobs.validator.js';

export const jobRoutes = Router({ mergeParams: true });
jobRoutes.get('/:id', ctrl.getJob);
jobRoutes.post('/:id/retry', ctrl.retryJob);
jobRoutes.post('/:id/cancel', ctrl.cancelJob);
jobRoutes.get('/:id/logs', ctrl.getJobLogs);

export const queueJobRoutes = Router({ mergeParams: true });
queueJobRoutes.post('/', validate({ body: createJobSchema as any }), ctrl.createJob);
queueJobRoutes.post('/batch', validate({ body: batchCreateJobSchema as any }), ctrl.createBatch);
queueJobRoutes.post('/claim', ctrl.claimJobs);
queueJobRoutes.get('/', ctrl.listJobs);
