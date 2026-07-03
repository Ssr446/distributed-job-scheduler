import { Router } from 'express';
import * as queuesController from './queues.controller.js';
import { validate } from '../../middleware/validator.js';
import { createQueueSchema, updateQueueSchema } from './queues.validator.js';

const router = Router({ mergeParams: true });

// Routes mounted at /api/projects/:projectId/queues
router.post(
  '/',
  validate({ body: createQueueSchema.shape.body }),
  queuesController.createQueue
);

router.get('/', queuesController.listQueues);

// Routes mounted at /api/queues/:id
router.get('/:id', queuesController.getQueue);

router.put(
  '/:id',
  validate({ body: updateQueueSchema.shape.body }),
  queuesController.updateQueue
);

router.post('/:id/pause', queuesController.pauseQueue);
router.post('/:id/resume', queuesController.resumeQueue);
router.get('/:id/stats', queuesController.getQueueStats);

export default router;
