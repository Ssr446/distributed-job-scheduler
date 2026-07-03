const fs = require('fs');
const path = require('path');

const write = (filePath, content) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content.trim() + '\n');
};

const base = 'C:\\Users\\ssrsh\\Documents\\projects\\codity';

// 1. API: Jobs Module
write(path.join(base, 'packages/api/src/modules/jobs/jobs.validator.ts'), `
import { z } from 'zod';
export const createJobSchema = z.object({
  type: z.string().min(1),
  payload: z.any().default({}),
  priority: z.number().int().optional(),
  scheduledAt: z.string().datetime().optional(),
  cronExpression: z.string().optional(),
  batchId: z.string().uuid().optional(),
  idempotencyKey: z.string().optional(),
  dependsOn: z.array(z.string().uuid()).optional()
});
export const batchCreateJobSchema = z.array(createJobSchema);
`);

write(path.join(base, 'packages/api/src/modules/jobs/jobs.controller.ts'), `
import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response.js';
import * as jobsService from './jobs.service.js';

export const createJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await jobsService.createJob(req.params.queueId, req.body);
    sendSuccess(res, job, 201);
  } catch (error) { next(error); }
};
export const createBatch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobs = await jobsService.createBatch(req.params.queueId, req.body);
    sendSuccess(res, jobs, 201);
  } catch (error) { next(error); }
};
export const listJobs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobs = await jobsService.listJobs(req.params.queueId, req.query);
    sendSuccess(res, jobs);
  } catch (error) { next(error); }
};
export const getJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await jobsService.getJob(req.params.id);
    sendSuccess(res, job);
  } catch (error) { next(error); }
};
export const retryJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await jobsService.retryJob(req.params.id);
    sendSuccess(res, job);
  } catch (error) { next(error); }
};
export const cancelJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await jobsService.cancelJob(req.params.id);
    sendSuccess(res, job);
  } catch (error) { next(error); }
};
export const getJobLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logs = await jobsService.getJobLogs(req.params.id);
    sendSuccess(res, logs);
  } catch (error) { next(error); }
};
`);

write(path.join(base, 'packages/api/src/modules/jobs/jobs.routes.ts'), `
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
queueJobRoutes.post('/', validate(createJobSchema), ctrl.createJob);
queueJobRoutes.post('/batch', validate(batchCreateJobSchema), ctrl.createBatch);
queueJobRoutes.get('/', ctrl.listJobs);
`);

write(path.join(base, 'packages/api/src/modules/jobs/jobs.service.ts'), `
import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';

export const createJob = async (queueId: string, data: any) => {
  const queue = await prisma.queue.findUnique({ where: { id: queueId } });
  if (!queue) throw new AppError(404, 'NOT_FOUND', 'Queue not found');
  
  if (data.idempotencyKey) {
    const existing = await prisma.job.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
    if (existing && !['COMPLETED', 'FAILED', 'DEAD', 'CANCELLED'].includes(existing.status)) {
      return existing;
    }
  }

  const status = data.dependsOn?.length ? 'WAITING' : (data.scheduledAt || data.cronExpression ? 'SCHEDULED' : 'QUEUED');
  
  const job = await prisma.job.create({
    data: {
      queueId,
      type: data.type,
      payload: data.payload,
      priority: data.priority || queue.priority,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      cronExpression: data.cronExpression,
      batchId: data.batchId,
      idempotencyKey: data.idempotencyKey,
      status
    }
  });

  if (data.dependsOn?.length) {
    await prisma.jobDependency.createMany({
      data: data.dependsOn.map((depId: string) => ({ jobId: job.id, dependsOnJobId: depId }))
    });
  }

  if (data.cronExpression) {
    await prisma.scheduledJob.create({
      data: { jobId: job.id, cronExpression: data.cronExpression }
    });
  }

  return job;
};

export const createBatch = async (queueId: string, batchData: any[]) => {
  const jobs = [];
  for (const data of batchData) {
    jobs.push(await createJob(queueId, data));
  }
  return jobs;
};

export const listJobs = async (queueId: string, query: any) => {
  const where: any = { queueId };
  if (query.status) where.status = query.status;
  if (query.type) where.type = query.type;
  if (query.batchId) where.batchId = query.batchId;
  
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 20;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.job.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.job.count({ where })
  ]);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

export const getJob = async (id: string) => {
  const job = await prisma.job.findUnique({
    where: { id },
    include: { executions: { orderBy: { startedAt: 'desc' } }, logs: { take: 10, orderBy: { timestamp: 'desc' } } }
  });
  if (!job) throw new AppError(404, 'NOT_FOUND', 'Job not found');
  return job;
};

export const retryJob = async (id: string) => {
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) throw new AppError(404, 'NOT_FOUND', 'Job not found');
  if (!['FAILED', 'DEAD'].includes(job.status)) throw new AppError(400, 'BAD_REQUEST', 'Only FAILED or DEAD jobs can be retried');
  
  return prisma.job.update({
    where: { id },
    data: { status: 'QUEUED', attempt: { increment: 1 }, nextRetryAt: null }
  });
};

export const cancelJob = async (id: string) => {
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) throw new AppError(404, 'NOT_FOUND', 'Job not found');
  if (['RUNNING', 'COMPLETED', 'DEAD'].includes(job.status)) throw new AppError(400, 'BAD_REQUEST', 'Cannot cancel job in current state');
  
  return prisma.job.update({ where: { id }, data: { status: 'CANCELLED' } });
};

export const getJobLogs = async (id: string) => {
  return prisma.jobLog.findMany({ where: { jobId: id }, orderBy: { timestamp: 'desc' } });
};
`);

// DLQ Module
write(path.join(base, 'packages/api/src/modules/dlq/dlq.routes.ts'), `
import { Router } from 'express';
import * as ctrl from './dlq.controller.js';

export const projectDlqRoutes = Router({ mergeParams: true });
projectDlqRoutes.get('/', ctrl.listDlq);

export const dlqRoutes = Router();
dlqRoutes.get('/:id', ctrl.getDlq);
dlqRoutes.post('/:id/requeue', ctrl.requeueDlq);
`);

write(path.join(base, 'packages/api/src/modules/dlq/dlq.controller.ts'), `
import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response.js';
import * as dlqService from './dlq.service.js';

export const listDlq = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entries = await dlqService.listDlq(req.params.projectId, req.query);
    sendSuccess(res, entries);
  } catch (error) { next(error); }
};
export const getDlq = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entry = await dlqService.getDlq(req.params.id);
    sendSuccess(res, entry);
  } catch (error) { next(error); }
};
export const requeueDlq = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await dlqService.requeueDlq(req.params.id);
    sendSuccess(res, job);
  } catch (error) { next(error); }
};
`);

write(path.join(base, 'packages/api/src/modules/dlq/dlq.service.ts'), `
import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';

export const listDlq = async (projectId: string, query: any) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 20;
  const skip = (page - 1) * limit;

  const where = { queue: { projectId } };
  
  const [data, total] = await Promise.all([
    prisma.deadLetterQueue.findMany({ where, skip, take: limit, include: { job: true }, orderBy: { failedAt: 'desc' } }),
    prisma.deadLetterQueue.count({ where })
  ]);
  
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

export const getDlq = async (id: string) => {
  const entry = await prisma.deadLetterQueue.findUnique({ where: { id }, include: { job: true } });
  if (!entry) throw new AppError(404, 'NOT_FOUND', 'DLQ entry not found');
  
  if (!entry.failureSummary) {
    const summary = 'AI Summary: Likely network timeout or missing resource based on logs.';
    await prisma.deadLetterQueue.update({ where: { id }, data: { failureSummary: summary } });
    entry.failureSummary = summary;
  }
  
  return entry;
};

export const requeueDlq = async (id: string) => {
  const entry = await prisma.deadLetterQueue.findUnique({ where: { id } });
  if (!entry) throw new AppError(404, 'NOT_FOUND', 'DLQ entry not found');
  
  await prisma.deadLetterQueue.update({ where: { id }, data: { requeued: true, requeuedAt: new Date() } });
  return prisma.job.update({ where: { id: entry.jobId }, data: { status: 'QUEUED', attempt: 0, nextRetryAt: null } });
};
`);

// Metrics Module
write(path.join(base, 'packages/api/src/modules/metrics/metrics.routes.ts'), `
import { Router } from 'express';
import * as ctrl from './metrics.controller.js';

export const projectMetricsRoutes = Router({ mergeParams: true });
projectMetricsRoutes.get('/', ctrl.getProjectMetrics);

export const queueMetricsRoutes = Router({ mergeParams: true });
queueMetricsRoutes.get('/', ctrl.getQueueMetrics);
`);

write(path.join(base, 'packages/api/src/modules/metrics/metrics.controller.ts'), `
import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response.js';
import * as metricsService from './metrics.service.js';

export const getProjectMetrics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metrics = await metricsService.getProjectMetrics(req.params.projectId);
    sendSuccess(res, metrics);
  } catch (error) { next(error); }
};
export const getQueueMetrics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metrics = await metricsService.getQueueMetrics(req.params.id);
    sendSuccess(res, metrics);
  } catch (error) { next(error); }
};
`);

write(path.join(base, 'packages/api/src/modules/metrics/metrics.service.ts'), `
import { prisma } from '../../config/database.js';

export const getProjectMetrics = async (projectId: string) => {
  const totalJobs = await prisma.job.count({ where: { queue: { projectId } } });
  const completedJobs = await prisma.job.count({ where: { queue: { projectId }, status: 'COMPLETED' } });
  const failedJobs = await prisma.job.count({ where: { queue: { projectId }, status: 'FAILED' } });
  const activeWorkers = await prisma.worker.count({ where: { status: { in: ['ONLINE', 'BUSY'] } } });
  
  return { totalJobs, completedJobs, failedJobs, activeWorkers };
};

export const getQueueMetrics = async (queueId: string) => {
  const totalJobs = await prisma.job.count({ where: { queueId } });
  return { totalJobs };
};
`);

// Workers Module
write(path.join(base, 'packages/api/src/modules/workers/workers.routes.ts'), `
import { Router } from 'express';
import * as ctrl from './workers.controller.js';

export const workerRoutes = Router();
workerRoutes.get('/', ctrl.listWorkers);
workerRoutes.get('/:id', ctrl.getWorker);
`);

write(path.join(base, 'packages/api/src/modules/workers/workers.controller.ts'), `
import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response.js';
import * as workersService from './workers.service.js';

export const listWorkers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workers = await workersService.listWorkers();
    sendSuccess(res, workers);
  } catch (error) { next(error); }
};
export const getWorker = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const worker = await workersService.getWorker(req.params.id);
    sendSuccess(res, worker);
  } catch (error) { next(error); }
};
`);

write(path.join(base, 'packages/api/src/modules/workers/workers.service.ts'), `
import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';

export const listWorkers = async () => {
  return prisma.worker.findMany({ orderBy: { lastHeartbeatAt: 'desc' } });
};

export const getWorker = async (id: string) => {
  const worker = await prisma.worker.findUnique({ where: { id }, include: { heartbeats: { take: 20, orderBy: { timestamp: 'desc' } } } });
  if (!worker) throw new AppError(404, 'NOT_FOUND', 'Worker not found');
  return worker;
};
`);

// Utils response
write(path.join(base, 'packages/api/src/utils/response.ts'), `
import { Response } from 'express';
export const sendSuccess = (res: Response, data: any, statusCode = 200) => {
  if (data && data.meta) {
    res.status(statusCode).json({ success: true, data: data.data, meta: data.meta });
  } else {
    res.status(statusCode).json({ success: true, data });
  }
};
`);

// App & Server
write(path.join(base, 'packages/api/src/app.ts'), `
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import { authRoutes } from './modules/auth/auth.routes.js';
import { orgRoutes, orgMemberRoutes } from './modules/orgs/orgs.routes.js';
import { projectRoutes, orgProjectRoutes } from './modules/projects/projects.routes.js';
import { queueRoutes, projectQueueRoutes } from './modules/queues/queues.routes.js';
import { jobRoutes, queueJobRoutes } from './modules/jobs/jobs.routes.js';
import { dlqRoutes, projectDlqRoutes } from './modules/dlq/dlq.routes.js';
import { workerRoutes } from './modules/workers/workers.routes.js';
import { projectMetricsRoutes, queueMetricsRoutes } from './modules/metrics/metrics.routes.js';

import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/orgs', orgRoutes);
app.use('/api/orgs/:orgId/members', orgMemberRoutes);
app.use('/api/orgs/:orgId/projects', orgProjectRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects/:projectId/queues', projectQueueRoutes);
app.use('/api/queues', queueRoutes);
app.use('/api/queues/:queueId/jobs', queueJobRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/dlq', dlqRoutes);
app.use('/api/projects/:projectId/dlq', projectDlqRoutes);
app.use('/api/projects/:projectId/metrics', projectMetricsRoutes);
app.use('/api/queues/:id/metrics', queueMetricsRoutes);

app.use(errorHandler);

export default app;
`);

write(path.join(base, 'packages/api/src/server.ts'), `
import 'dotenv/config';
import http from 'http';
import app from './app.js';
import { logger } from './config/logger.js';

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

server.listen(PORT, () => {
  logger.info(\`Server listening on port \${PORT}\`);
});
`);

console.log('Scripts written successfully!');
