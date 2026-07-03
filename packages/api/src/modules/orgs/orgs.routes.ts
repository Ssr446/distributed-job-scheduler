import { Router } from 'express';
import * as orgsController from './orgs.controller.js';
import { validate } from '../../middleware/validator.js';
import { authenticate } from '../../middleware/auth.js';
import { requireOrgRole } from '../../middleware/rbac.js';
import { createOrgSchema, inviteMemberSchema, updateMemberRoleSchema } from './orgs.validator.js';

const router = Router();

// All org routes require authentication
router.use(authenticate);

router.post(
  '/',
  validate({ body: createOrgSchema.shape.body }),
  orgsController.createOrg
);

router.get('/', orgsController.listOrgs);

router.post(
  '/:id/members',
  requireOrgRole('id', 'OWNER', 'ADMIN'),
  validate({ body: inviteMemberSchema.shape.body }),
  orgsController.inviteMember
);

router.put(
  '/:id/members/:userId',
  requireOrgRole('id', 'OWNER'),
  validate({ body: updateMemberRoleSchema.shape.body }),
  orgsController.updateMemberRole
);

router.delete(
  '/:id/members/:userId',
  requireOrgRole('id', 'OWNER', 'ADMIN'),
  orgsController.removeMember
);

export default router;
