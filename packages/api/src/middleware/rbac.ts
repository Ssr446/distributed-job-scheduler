import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import { prisma } from '../config/database.js';
import type { USER_ROLE, ORG_ROLE } from '@prisma/client';

/**
 * Require the authenticated user to have one of the specified global roles.
 */
export function requireRole(...roles: USER_ROLE[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      if (!roles.includes(req.user.role as USER_ROLE)) {
        throw AppError.forbidden(
          `This action requires one of the following roles: ${roles.join(', ')}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Require the authenticated user to have one of the specified roles
 * within the organization identified by `orgIdParam` in req.params.
 */
export function requireOrgRole(orgIdParam: string, ...roles: ORG_ROLE[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const orgId = req.params[orgIdParam] as string;
      if (!orgId) {
        throw AppError.badRequest(`Missing parameter: ${orgIdParam}`);
      }

      // Global admins bypass org-level checks
      if (req.user.role === 'ADMIN') {
        return next();
      }

      const membership = await prisma.orgMembership.findUnique({
        where: {
          userId_orgId: {
            userId: req.user.userId,
            orgId,
          },
        },
      });

      if (!membership) {
        throw AppError.forbidden('You are not a member of this organization');
      }

      if (!roles.includes(membership.role)) {
        throw AppError.forbidden(
          `This action requires one of the following organization roles: ${roles.join(', ')}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Require the user to be a member of the organization (any role).
 */
export function requireOrgMember(orgIdParam: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const orgId = req.params[orgIdParam] as string;
      if (!orgId) {
        throw AppError.badRequest(`Missing parameter: ${orgIdParam}`);
      }

      if (req.user.role === 'ADMIN') {
        return next();
      }

      const membership = await prisma.orgMembership.findUnique({
        where: {
          userId_orgId: {
            userId: req.user.userId,
            orgId,
          },
        },
      });

      if (!membership) {
        throw AppError.forbidden('You are not a member of this organization');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
