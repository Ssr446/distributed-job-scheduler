import { z } from 'zod';

export const createJobSchema = z.object({
  type: z.string().min(1).max(255),
  payload: z.record(z.unknown()).default({}).refine(
    (val) => JSON.stringify(val).length < 65536,
    { message: 'Payload exceeds maximum size of 64KB' }
  ),
  priority: z.number().int().optional(),
  scheduledAt: z.string().datetime().optional(),
  cronExpression: z.string().optional(),
  batchId: z.string().uuid().optional(),
  idempotencyKey: z.string().max(255).optional(),
  dependsOn: z.array(z.string().uuid()).max(100).optional()
});

export const batchCreateJobSchema = z.array(createJobSchema).max(1000);

export const listJobsQuerySchema = z.object({
  query: z.object({
    status: z.enum(['QUEUED', 'SCHEDULED', 'WAITING', 'CLAIMED', 'RUNNING', 'COMPLETED', 'FAILED', 'DEAD', 'CANCELLED']).optional(),
    type: z.string().optional(),
    batchId: z.string().uuid().optional(),
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
  })
});
