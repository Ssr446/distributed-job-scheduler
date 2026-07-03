import { z } from 'zod';

export const createQueueSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(100)
      .regex(/^[a-zA-Z0-9_-]+$/, 'Name must contain only alphanumeric characters, hyphens, and underscores')
      .trim(),
    priority: z.coerce.number().int().min(0).max(100).default(0),
    concurrencyLimit: z.coerce.number().int().min(1).max(1000).default(5),
    retryPolicyId: z.string().uuid().optional(),
    maxJobDurationMs: z.coerce.number().int().min(1000).max(86400000).default(300000),
    shardKey: z.string().max(100).optional(),
    rateLimitPerSec: z.coerce.number().int().min(1).optional(),
  }),
});

export const updateQueueSchema = z.object({
  body: z.object({
    priority: z.coerce.number().int().min(0).max(100).optional(),
    concurrencyLimit: z.coerce.number().int().min(1).max(1000).optional(),
    retryPolicyId: z.string().uuid().optional().nullable(),
    maxJobDurationMs: z.coerce.number().int().min(1000).max(86400000).optional(),
    shardKey: z.string().max(100).optional().nullable(),
    rateLimitPerSec: z.coerce.number().int().min(1).optional().nullable(),
  }),
});

export type CreateQueueInput = z.infer<typeof createQueueSchema>['body'];
export type UpdateQueueInput = z.infer<typeof updateQueueSchema>['body'];
