import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../config/logger.js';
import type { CreateOrgInput, InviteMemberInput, UpdateMemberRoleInput } from './orgs.validator.js';
import type { ORG_ROLE } from '@prisma/client';

export async function createOrganization(userId: string, input: CreateOrgInput) {
  const existing = await prisma.organization.findUnique({ where: { slug: input.slug } });
  if (existing) {
    throw AppError.conflict('An organization with this slug already exists');
  }

  const result = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: input.name,
        slug: input.slug,
      },
    });

    await tx.orgMembership.create({
      data: {
        userId,
        orgId: org.id,
        role: 'OWNER',
      },
    });

    return org;
  });

  logger.info({ orgId: result.id, userId }, 'Organization created');
  return result;
}

export async function listUserOrgs(userId: string) {
  const memberships = await prisma.orgMembership.findMany({
    where: { userId },
    include: {
      organization: {
        include: {
          _count: {
            select: {
              memberships: true,
              projects: true,
            },
          },
        },
      },
    },
  });

  return memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    role: m.role,
    memberCount: m.organization._count.memberships,
    projectCount: m.organization._count.projects,
    createdAt: m.organization.createdAt,
  }));
}

export async function inviteMember(orgId: string, input: InviteMemberInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw AppError.notFound('User with this email');
  }

  const existingMembership = await prisma.orgMembership.findUnique({
    where: {
      userId_orgId: {
        userId: user.id,
        orgId,
      },
    },
  });

  if (existingMembership) {
    throw AppError.conflict('User is already a member of this organization');
  }

  const membership = await prisma.orgMembership.create({
    data: {
      userId: user.id,
      orgId,
      role: input.role as ORG_ROLE,
    },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });

  logger.info({ orgId, userId: user.id, role: input.role }, 'Member invited to organization');

  return {
    userId: membership.userId,
    orgId: membership.orgId,
    role: membership.role,
    user: membership.user,
  };
}

export async function updateMemberRole(orgId: string, targetUserId: string, input: UpdateMemberRoleInput) {
  const membership = await prisma.orgMembership.findUnique({
    where: {
      userId_orgId: {
        userId: targetUserId,
        orgId,
      },
    },
  });

  if (!membership) {
    throw AppError.notFound('Membership');
  }

  // Prevent demoting the last owner
  if (membership.role === 'OWNER' && input.role !== 'OWNER') {
    const ownerCount = await prisma.orgMembership.count({
      where: { orgId, role: 'OWNER' },
    });
    if (ownerCount <= 1) {
      throw AppError.badRequest('Cannot demote the last owner of the organization');
    }
  }

  const updated = await prisma.orgMembership.update({
    where: {
      userId_orgId: {
        userId: targetUserId,
        orgId,
      },
    },
    data: { role: input.role as ORG_ROLE },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });

  logger.info({ orgId, targetUserId, newRole: input.role }, 'Member role updated');

  return {
    userId: updated.userId,
    orgId: updated.orgId,
    role: updated.role,
    user: updated.user,
  };
}

export async function removeMember(orgId: string, targetUserId: string, requesterId: string) {
  const membership = await prisma.orgMembership.findUnique({
    where: {
      userId_orgId: {
        userId: targetUserId,
        orgId,
      },
    },
  });

  if (!membership) {
    throw AppError.notFound('Membership');
  }

  // Prevent removing the last owner
  if (membership.role === 'OWNER') {
    const ownerCount = await prisma.orgMembership.count({
      where: { orgId, role: 'OWNER' },
    });
    if (ownerCount <= 1) {
      throw AppError.badRequest('Cannot remove the last owner of the organization');
    }
  }

  await prisma.orgMembership.delete({
    where: {
      userId_orgId: {
        userId: targetUserId,
        orgId,
      },
    },
  });

  logger.info({ orgId, targetUserId, requesterId }, 'Member removed from organization');
}
