import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import authRoutes from './modules/auth/auth.routes.js';
import orgRoutes from './modules/orgs/orgs.routes.js';
import projectRoutes from './modules/projects/projects.routes.js';
import queueRoutes from './modules/queues/queues.routes.js';

import { jobRoutes, queueJobRoutes } from './modules/jobs/jobs.routes.js';
import { dlqRoutes, projectDlqRoutes } from './modules/dlq/dlq.routes.js';
import { workerRoutes } from './modules/workers/workers.routes.js';
import { projectMetricsRoutes, queueMetricsRoutes } from './modules/metrics/metrics.routes.js';

import { errorHandler } from './middleware/errorHandler.js';
import { authenticate } from './middleware/auth.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { env } from './config/env.js';

const app = express();

// ── Security Headers ──────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── General Middleware ─────────────────────────────────────────────────────────
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Global rate limiter ───────────────────────────────────────────────────────
app.use(rateLimiter);

// ── Request ID & Logging ──────────────────────────────────────────────────────
import { v4 as uuidv4 } from 'uuid';
app.use((req: any, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// Setup morgan to include request ID
morgan.token('id', (req: any) => req.id);
app.use(morgan(':id :method :url :status :res[content-length] - :response-time ms'));

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      environment: env.NODE_ENV,
      version: '1.0.0',
    },
  });
});

// ── Public routes ─────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);

// ── Protected routes ──────────────────────────────────────────────────────────
app.use('/api/orgs', authenticate, orgRoutes);
app.use('/api/orgs/:orgId/projects', authenticate, projectRoutes);
app.use('/api/projects/:projectId/queues', authenticate, queueRoutes);
app.use('/api/projects', authenticate, projectRoutes);
app.use('/api/queues', authenticate, queueRoutes);
app.use('/api/queues/:queueId/jobs', authenticate, queueJobRoutes);
app.use('/api/jobs', authenticate, jobRoutes);
app.use('/api/workers', authenticate, workerRoutes);
app.use('/api/dlq', authenticate, dlqRoutes);
app.use('/api/projects/:projectId/dlq', authenticate, projectDlqRoutes);
app.use('/api/projects/:projectId/metrics', authenticate, projectMetricsRoutes);
app.use('/api/queues/:id/metrics', authenticate, queueMetricsRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
