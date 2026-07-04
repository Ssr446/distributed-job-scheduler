import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service.js';
import { sendSuccess } from '../../utils/response.js';
import { env } from '../../config/env.js';

const setTokenCookies = (res: Response, accessToken: string, refreshToken: string, expiresIn: string) => {
  const isProd = env.NODE_ENV === 'production';
  // Determine maxAge in ms. Assuming expiresIn is '15m' or similar format. 
  // For simplicity, we can just let session handle it or set a hardcoded maxAge based on known values.
  // We'll set a standard maxAge of 7 days for the refresh token, and let access token expire via JWT.
  
  const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
  };

  res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 }); // 15 mins
  res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 }); // 7 days
};

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.register(req.body);
    setTokenCookies(res, result.accessToken, result.refreshToken, result.expiresIn);
    sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.login(req.body);
    setTokenCookies(res, result.accessToken, result.refreshToken, result.expiresIn);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.refreshToken || req.body.refreshToken;
    if (!token) {
      res.status(401).json({ success: false, error: { message: 'No refresh token provided' } });
      return;
    }
    const result = await authService.refreshToken(token);
    setTokenCookies(res, result.accessToken, result.refreshToken, result.expiresIn);
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
    let accessToken = req.cookies?.accessToken;
    let refreshToken = req.cookies?.refreshToken;
    
    if (!accessToken && req.headers.authorization?.startsWith('Bearer ')) {
      accessToken = req.headers.authorization.split(' ')[1];
    }
    
    const result = await authService.logout(accessToken, refreshToken);
    
    const isProd = env.NODE_ENV === 'production';
    const cookieOptions = { httpOnly: true, secure: isProd, sameSite: 'lax' as const };
    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);
    
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}
