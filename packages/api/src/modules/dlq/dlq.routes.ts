import { Router } from 'express';
import * as ctrl from './dlq.controller.js';

export const projectDlqRoutes = Router({ mergeParams: true });
projectDlqRoutes.get('/', ctrl.listDlq);

export const dlqRoutes = Router();
dlqRoutes.get('/:id', ctrl.getDlq);
dlqRoutes.post('/:id/requeue', ctrl.requeueDlq);
