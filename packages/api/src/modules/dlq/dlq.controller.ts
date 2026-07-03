import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response.js';
import * as dlqService from './dlq.service.js';

export const listDlq = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entries = await dlqService.listDlq((req.params.projectId as string), req.query);
    sendSuccess(res, entries);
  } catch (error) { next(error); }
};
export const getDlq = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entry = await dlqService.getDlq((req.params.id as string));
    sendSuccess(res, entry);
  } catch (error) { next(error); }
};
export const requeueDlq = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await dlqService.requeueDlq((req.params.id as string));
    sendSuccess(res, job);
  } catch (error) { next(error); }
};
