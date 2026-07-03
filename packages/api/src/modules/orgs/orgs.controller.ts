import { Request, Response, NextFunction } from 'express';
import * as orgsService from './orgs.service.js';
import { sendSuccess } from '../../utils/response.js';

export async function createOrg(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await orgsService.createOrganization(req.user!.userId, req.body);
    sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
}

export async function listOrgs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await orgsService.listUserOrgs(req.user!.userId);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function inviteMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await orgsService.inviteMember((req.params.id as string), req.body);
    sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateMemberRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await orgsService.updateMemberRole((req.params.id as string), (req.params.userId as string), req.body);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await orgsService.removeMember((req.params.id as string), (req.params.userId as string), req.user!.userId);
    sendSuccess(res, { message: 'Member removed successfully' });
  } catch (error) {
    next(error);
  }
}
