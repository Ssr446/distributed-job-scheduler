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
    const worker = await workersService.getWorker((req.params.id as string));
    sendSuccess(res, worker);
  } catch (error) { next(error); }
};
export const registerWorker = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const worker = await workersService.registerWorker(req.body);
    sendSuccess(res, worker, 201);
  } catch (error) { next(error); }
};
export const heartbeat = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const worker = await workersService.heartbeat((req.params.id as string), req.body);
    sendSuccess(res, worker);
  } catch (error) { next(error); }
};
export const deregisterWorker = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const worker = await workersService.deregisterWorker((req.params.id as string));
    sendSuccess(res, worker);
  } catch (error) { next(error); }
};
