import { Router } from 'express';
import * as projectsController from './projects.controller.js';
import { validate } from '../../middleware/validator.js';
import { createProjectSchema, updateProjectSchema } from './projects.validator.js';

const router = Router({ mergeParams: true });

// Routes mounted at /api/orgs/:orgId/projects
router.post(
  '/',
  validate({ body: createProjectSchema.shape.body }),
  projectsController.createProject
);

router.get('/', projectsController.listProjects);

// Routes mounted at /api/projects/:id
router.get('/:id', projectsController.getProject);

router.put(
  '/:id',
  validate({ body: updateProjectSchema.shape.body }),
  projectsController.updateProject
);

router.delete('/:id', projectsController.deleteProject);

export default router;
