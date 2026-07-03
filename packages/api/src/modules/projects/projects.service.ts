import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../config/logger.js';
import type { CreateProjectInput, UpdateProjectInput } from './projects.validator.js';

export async function createProject(orgId: string, userId: string, input: CreateProjectInput) {
  // Verify the org exists
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    throw AppError.notFound('Organization');
  }

  const project = await prisma.project.create({
    data: {
      orgId,
      name: input.name,
      description: input.description,
      createdById: userId,
    },
    include: {
      createdBy: {
        select: { id: true, email: true, name: true },
      },
    },
  });

  logger.info({ projectId: project.id, orgId, userId }, 'Project created');
  return project;
}

export async function listProjects(orgId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where: { orgId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, email: true, name: true },
        },
        _count: {
          select: { queues: true },
        },
      },
    }),
    prisma.project.count({ where: { orgId } }),
  ]);

  return {
    projects: projects.map((p) => ({
      ...p,
      queueCount: p._count.queues,
      _count: undefined,
    })),
    total,
    page,
    limit,
  };
}

export async function getProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      createdBy: {
        select: { id: true, email: true, name: true },
      },
      queues: {
        select: {
          id: true,
          name: true,
          priority: true,
          isPaused: true,
          concurrencyLimit: true,
        },
      },
      retryPolicies: true,
      _count: {
        select: { queues: true },
      },
    },
  });

  if (!project) {
    throw AppError.notFound('Project');
  }

  return project;
}

export async function updateProject(projectId: string, input: UpdateProjectInput) {
  const existing = await prisma.project.findUnique({ where: { id: projectId } });
  if (!existing) {
    throw AppError.notFound('Project');
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
    },
    include: {
      createdBy: {
        select: { id: true, email: true, name: true },
      },
    },
  });

  logger.info({ projectId }, 'Project updated');
  return updated;
}

export async function deleteProject(projectId: string) {
  const existing = await prisma.project.findUnique({ where: { id: projectId } });
  if (!existing) {
    throw AppError.notFound('Project');
  }

  await prisma.project.delete({ where: { id: projectId } });

  logger.info({ projectId }, 'Project deleted');
}
