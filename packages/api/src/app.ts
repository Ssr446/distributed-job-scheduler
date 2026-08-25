import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { v4 as uuidv4 } from 'uuid';

import authRoutes from './modules/auth/auth.routes.js';
import orgRoutes from './modules/orgs/orgs.routes.js';
import projectRoutes from './modules/projects/projects.routes.js';
import queueRoutes from './modules/queues/queues.routes.js';

import { jobRoutes, queueJobRoutes, workerJobRoutes, workerQueueRoutes } from './modules/jobs/jobs.routes.js';
import { dlqRoutes, projectDlqRoutes } from './modules/dlq/dlq.routes.js';
import { workerRoutes, workerSelfRoutes } from './modules/workers/workers.routes.js';
import { projectMetricsRoutes, queueMetricsRoutes } from './modules/metrics/metrics.routes.js';

import { errorHandler } from './middleware/errorHandler.js';
import { authenticate } from './middleware/auth.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { requireCsrfSafe } from './middleware/csrf.js';
import { env } from './config/env.js';

const app = express();

// ── Security Headers ──────────────────────────────────────────────────────────
app.use(helmet());
// Support comma-separated list of allowed origins (one env var can cover
// both the Render service URL and a custom domain without code changes).
const allowedOrigins = env.CORS_ORIGIN.split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── General Middleware ─────────────────────────────────────────────────────────
app.use(compression());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// ── Request ID & Logging ──────────────────────────────────────────────────────
app.use((req: any, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-Id', req.id);
  next();
});

morgan.token('id', (req: any) => req.id);
app.use(morgan(':id :method :url :status :res[content-length] - :response-time ms'));

// ── Health / Readiness Checks ─────────────────────────────────────────────────
// /health — liveness: process is running
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

// /ready — readiness: process is ready to accept traffic (Render health-probe target)
app.get('/ready', (_req, res) => {
  res.json({ success: true, data: { status: 'ready' } });
});

// ── V1 API Router ─────────────────────────────────────────────────────────────
const v1Router = express.Router();

// Global rate limiter applied to all routes
v1Router.use(rateLimiter);

// Public routes
v1Router.use('/auth', authRoutes);

// Worker routes (mounted outside `authenticate` to rely purely on `apiKeyAuth`)
v1Router.use('/jobs', workerJobRoutes);
v1Router.use('/queues', workerQueueRoutes);
v1Router.use('/workers', workerSelfRoutes);

// Protected Dashboard routes
v1Router.use('/orgs', authenticate, requireCsrfSafe, orgRoutes);
v1Router.use('/orgs/:orgId/projects', authenticate, requireCsrfSafe, projectRoutes);
v1Router.use('/projects/:projectId/queues', authenticate, requireCsrfSafe, queueRoutes);
v1Router.use('/projects/:projectId/dlq', authenticate, requireCsrfSafe, projectDlqRoutes);
v1Router.use('/projects/:projectId/metrics', authenticate, requireCsrfSafe, projectMetricsRoutes);
v1Router.use('/projects', authenticate, requireCsrfSafe, projectRoutes);
v1Router.use('/queues/:id/metrics', authenticate, requireCsrfSafe, queueMetricsRoutes);
v1Router.use('/queues/:queueId/jobs', authenticate, requireCsrfSafe, queueJobRoutes);
v1Router.use('/queues', authenticate, requireCsrfSafe, queueRoutes);
v1Router.use('/jobs', authenticate, requireCsrfSafe, jobRoutes);
v1Router.use('/workers', authenticate, requireCsrfSafe, workerRoutes);
v1Router.use('/dlq', authenticate, requireCsrfSafe, dlqRoutes);

app.use('/api/v1', v1Router);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
