import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../config/logger.js';
import { eventBus } from '../../events/eventBus.js';
import type { CreateQueueInput, UpdateQueueInput } from './queues.validator.js';

export async function createQueue(projectId: string, input: CreateQueueInput) {
  // Verify project exists
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw AppError.notFound('Project');
  }

  // Check for duplicate name within the project
  const existing = await prisma.queue.findUnique({
    where: { projectId_name: { projectId, name: input.name } },
  });
  if (existing) {
    throw AppError.conflict(`A queue named "${input.name}" already exists in this project`);
  }

  const queue = await prisma.queue.create({
    data: {
      projectId,
      name: input.name,
      priority: input.priority,
      concurrencyLimit: input.concurrencyLimit,
      retryPolicyId: input.retryPolicyId,
      maxJobDurationMs: input.maxJobDurationMs,
      shardKey: input.shardKey,
      rateLimitPerSec: input.rateLimitPerSec,
    },
    include: {
      retryPolicy: true,
    },
  });

  logger.info({ queueId: queue.id, projectId, name: input.name }, 'Queue created');
  return queue;
}

export async function listQueues(projectId: string) {
  const queues = await prisma.queue.findMany({
    where: { projectId },
    orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    include: {
      retryPolicy: true,
    },
  });

  // Get job counts per queue using raw aggregate
  const queueIds = queues.map((q) => q.id);

  if (queueIds.length === 0) {
    return [];
  }

  const jobCounts = await prisma.job.groupBy({
    by: ['queueId', 'status'],
    where: { queueId: { in: queueIds } },
    _count: { id: true },
  });

  // Build a map of queue => status => count
  const countMap = new Map<string, Record<string, number>>();
  for (const entry of jobCounts) {
    if (!countMap.has(entry.queueId)) {
      countMap.set(entry.queueId, {});
    }
    countMap.get(entry.queueId)![entry.status] = entry._count.id;
  }

  return queues.map((queue) => {
    const counts = countMap.get(queue.id) || {};
    const total = Object.values(counts).reduce((sum, c) => sum + c, 0);
    return {
      ...queue,
      stats: {
        total,
        queued: counts['QUEUED'] || 0,
        running: counts['RUNNING'] || 0,
        completed: counts['COMPLETED'] || 0,
        failed: counts['FAILED'] || 0,
      },
    };
  });
}

export async function getQueue(queueId: string) {
  const queue = await prisma.queue.findUnique({
    where: { id: queueId },
    include: {
      retryPolicy: true,
      project: {
        select: { id: true, name: true, orgId: true },
      },
    },
  });

  if (!queue) {
    throw AppError.notFound('Queue');
  }

  // Full stats
  const jobCounts = await prisma.job.groupBy({
    by: ['status'],
    where: { queueId },
    _count: { id: true },
  });

  const stats: Record<string, number> = {};
  let total = 0;
  for (const entry of jobCounts) {
    stats[entry.status] = entry._count.id;
    total += entry._count.id;
  }

  return {
    ...queue,
    stats: {
      total,
      queued: stats['QUEUED'] || 0,
      scheduled: stats['SCHEDULED'] || 0,
      waiting: stats['WAITING'] || 0,
      claimed: stats['CLAIMED'] || 0,
      running: stats['RUNNING'] || 0,
      completed: stats['COMPLETED'] || 0,
      failed: stats['FAILED'] || 0,
      dead: stats['DEAD'] || 0,
      cancelled: stats['CANCELLED'] || 0,
    },
  };
}

export async function updateQueue(queueId: string, input: UpdateQueueInput) {
  const existing = await prisma.queue.findUnique({ where: { id: queueId } });
  if (!existing) {
    throw AppError.notFound('Queue');
  }

  const updated = await prisma.queue.update({
    where: { id: queueId },
    data: {
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.concurrencyLimit !== undefined && { concurrencyLimit: input.concurrencyLimit }),
      ...(input.retryPolicyId !== undefined && { retryPolicyId: input.retryPolicyId }),
      ...(input.maxJobDurationMs !== undefined && { maxJobDurationMs: input.maxJobDurationMs }),
      ...(input.shardKey !== undefined && { shardKey: input.shardKey }),
      ...(input.rateLimitPerSec !== undefined && { rateLimitPerSec: input.rateLimitPerSec }),
    },
    include: {
      retryPolicy: true,
    },
  });

  logger.info({ queueId }, 'Queue updated');
  return updated;
}

export async function pauseQueue(queueId: string) {
  const queue = await prisma.queue.findUnique({ where: { id: queueId } });
  if (!queue) {
    throw AppError.notFound('Queue');
  }

  if (queue.isPaused) {
    throw AppError.badRequest('Queue is already paused');
  }

  const updated = await prisma.queue.update({
    where: { id: queueId },
    data: { isPaused: true },
  });

  eventBus.emit('queue.paused', { queueId, projectId: queue.projectId });
  logger.info({ queueId }, 'Queue paused');
  return updated;
}

export async function resumeQueue(queueId: string) {
  const queue = await prisma.queue.findUnique({ where: { id: queueId } });
  if (!queue) {
    throw AppError.notFound('Queue');
  }

  if (!queue.isPaused) {
    throw AppError.badRequest('Queue is not paused');
  }

  const updated = await prisma.queue.update({
    where: { id: queueId },
    data: { isPaused: false },
  });

  eventBus.emit('queue.resumed', { queueId, projectId: queue.projectId });
  logger.info({ queueId }, 'Queue resumed');
  return updated;
}

export async function getQueueThroughputStats(queueId: string) {
  const queue = await prisma.queue.findUnique({ where: { id: queueId } });
  if (!queue) {
    throw AppError.notFound('Queue');
  }

  // Jobs completed per minute over the last hour using raw SQL
  const throughput = await prisma.$queryRaw<
    Array<{ minute: Date; count: bigint }>
  >`
    SELECT
      date_trunc('minute', "completedAt") AS minute,
      COUNT(*)::bigint AS count
    FROM jobs
    WHERE "queueId" = ${queueId}
      AND "completedAt" >= NOW() - INTERVAL '1 hour'
      AND "status" = 'COMPLETED'
    GROUP BY date_trunc('minute', "completedAt")
    ORDER BY minute ASC
  `;

  return throughput.map((row) => ({
    timestamp: row.minute,
    count: Number(row.count),
  }));
}
