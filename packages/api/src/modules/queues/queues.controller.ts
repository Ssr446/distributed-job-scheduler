import { Request, Response, NextFunction } from 'express';
import * as queuesService from './queues.service.js';
import { sendSuccess } from '../../utils/response.js';

export async function createQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = (req.params.projectId as string);
    const result = await queuesService.createQueue(projectId, req.body);
    sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
}

export async function listQueues(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = (req.params.projectId as string);
    const result = await queuesService.listQueues(projectId);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function getQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await queuesService.getQueue((req.params.id as string));
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function updateQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await queuesService.updateQueue((req.params.id as string), req.body);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function pauseQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await queuesService.pauseQueue((req.params.id as string));
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function resumeQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await queuesService.resumeQueue((req.params.id as string));
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function getQueueStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await queuesService.getQueueThroughputStats((req.params.id as string));
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}
