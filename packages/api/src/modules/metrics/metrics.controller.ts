import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response.js';
import * as metricsService from './metrics.service.js';

export const getProjectMetrics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metrics = await metricsService.getProjectMetrics((req.params.projectId as string));
    sendSuccess(res, metrics);
  } catch (error) { next(error); }
};
export const getQueueMetrics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metrics = await metricsService.getQueueMetrics((req.params.id as string));
    sendSuccess(res, metrics);
  } catch (error) { next(error); }
};
