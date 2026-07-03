import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response.js';
import * as jobsService from './jobs.service.js';

export const createJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await jobsService.createJob((req.params.queueId as string), req.body);
    sendSuccess(res, job, 201);
  } catch (error) { next(error); }
};
export const createBatch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobs = await jobsService.createBatch((req.params.queueId as string), req.body);
    sendSuccess(res, jobs, 201);
  } catch (error) { next(error); }
};
export const listJobs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobs = await jobsService.listJobs((req.params.queueId as string), req.query);
    sendSuccess(res, jobs);
  } catch (error) { next(error); }
};
export const getJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await jobsService.getJob((req.params.id as string));
    sendSuccess(res, job);
  } catch (error) { next(error); }
};
export const retryJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await jobsService.retryJob((req.params.id as string), req.user?.userId);
    sendSuccess(res, job);
  } catch (error) { next(error); }
};
export const cancelJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await jobsService.cancelJob((req.params.id as string), req.user?.userId);
    sendSuccess(res, job);
  } catch (error) { next(error); }
};
export const getJobLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logs = await jobsService.getJobLogs((req.params.id as string));
    sendSuccess(res, logs);
  } catch (error) { next(error); }
};

export const claimJobs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workerId = req.worker?.id;
    if (!workerId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'worker identity missing' } });
      return;
    }
    const { limit, shardKey } = req.body;
    const jobs = await jobsService.claimJobs((req.params.queueId as string), workerId, parseInt(limit) || 1, shardKey);
    sendSuccess(res, jobs);
  } catch (error) { next(error); }
};

export const startJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workerId = req.worker?.id!;
    const job = await jobsService.startJob(req.params.id as string, workerId);
    sendSuccess(res, job);
  } catch (error) { next(error); }
};

export const completeJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workerId = req.worker?.id!;
    const { result, durationMs } = req.body;
    const job = await jobsService.completeJob(req.params.id as string, workerId, result, durationMs);
    sendSuccess(res, job);
  } catch (error) { next(error); }
};

export const failJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workerId = req.worker?.id!;
    const { error, durationMs } = req.body;
    const job = await jobsService.failJob(req.params.id as string, workerId, error, durationMs);
    sendSuccess(res, job);
  } catch (error) { next(error); }
};
