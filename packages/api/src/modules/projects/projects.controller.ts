import { Request, Response, NextFunction } from 'express';
import * as projectsService from './projects.service.js';
import { sendSuccess, paginate } from '../../utils/response.js';

export async function createProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = (req.params.orgId as string);
    const result = await projectsService.createProject(orgId, req.user!.userId, req.body);
    sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
}

export async function listProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = (req.params.orgId as string);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await projectsService.listProjects(orgId, page, limit);
    sendSuccess(res, { data: result.projects, meta: paginate(result.page, result.limit, result.total) });
  } catch (error) {
    next(error);
  }
}

export async function getProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await projectsService.getProject((req.params.id as string));
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function updateProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await projectsService.updateProject((req.params.id as string), req.body);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function deleteProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await projectsService.deleteProject((req.params.id as string));
    sendSuccess(res, { message: 'Project deleted successfully' });
  } catch (error) {
    next(error);
  }
}
