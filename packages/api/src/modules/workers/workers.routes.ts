import { Router } from 'express';
import * as ctrl from './workers.controller.js';

export const workerRoutes = Router();
workerRoutes.get('/', ctrl.listWorkers);
workerRoutes.post('/register', ctrl.registerWorker);
workerRoutes.get('/:id', ctrl.getWorker);
workerRoutes.post('/:id/heartbeat', ctrl.heartbeat);
workerRoutes.post('/:id/deregister', ctrl.deregisterWorker);
