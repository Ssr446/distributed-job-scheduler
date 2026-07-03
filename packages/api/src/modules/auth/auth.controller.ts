import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service.js';
import { sendSuccess } from '../../utils/response.js';

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.register(req.body);
    sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.login(req.body);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.refreshToken(req.body.refreshToken);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const user = await authService.getProfile(userId);
    sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const user = await authService.updateProfile(userId, { name: req.body.name });
    sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
};

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const result = await authService.logout(token as string);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}
