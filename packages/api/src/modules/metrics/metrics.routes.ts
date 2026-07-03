import { Router } from 'express';
import * as ctrl from './metrics.controller.js';

export const projectMetricsRoutes = Router({ mergeParams: true });
projectMetricsRoutes.get('/', ctrl.getProjectMetrics);

export const queueMetricsRoutes = Router({ mergeParams: true });
queueMetricsRoutes.get('/', ctrl.getQueueMetrics);
