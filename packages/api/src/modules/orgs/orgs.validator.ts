import { z } from 'zod';

export const createOrgSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100).trim(),
    slug: z
      .string()
      .min(1, 'Slug is required')
      .max(100)
      .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
      .trim(),
  }),
});

export const inviteMemberSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
  }),
});

export const updateMemberRoleSchema = z.object({
  body: z.object({
    role: z.enum(['OWNER', 'ADMIN', 'MEMBER']),
  }),
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>['body'];
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>['body'];
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>['body'];
