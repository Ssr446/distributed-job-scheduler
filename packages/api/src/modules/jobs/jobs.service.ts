import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';
import { eventBus } from '../../events/eventBus.js';

export interface CreateJobInput {
  type: string;
  payload: any;
  priority?: number;
  scheduledAt?: string;
  cronExpression?: string;
  batchId?: string;
  idempotencyKey?: string;
  dependsOn?: string[];
}

export const createJob = async (queueId: string, data: CreateJobInput) => {
  const queue = await prisma.queue.findUnique({ where: { id: queueId } });
  if (!queue) throw new AppError(404, 'NOT_FOUND', 'Queue not found');
  
  if (data.idempotencyKey) {
    const existing = await prisma.job.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
    if (existing && !['COMPLETED', 'FAILED', 'DEAD', 'CANCELLED'].includes(existing.status)) {
      return existing;
    }
  }

  const status = data.dependsOn?.length ? 'WAITING' : (data.scheduledAt || data.cronExpression ? 'SCHEDULED' : 'QUEUED');
  
  const job = await prisma.job.create({
    data: {
      queueId,
      type: data.type,
      payload: data.payload,
      priority: data.priority ?? queue.priority,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      cronExpression: data.cronExpression,
      batchId: data.batchId,
      idempotencyKey: data.idempotencyKey,
      status
    }
  });

  if (data.dependsOn?.length) {
    await prisma.jobDependency.createMany({
      data: data.dependsOn.map((depId: string) => ({ jobId: job.id, dependsOnJobId: depId }))
    });
  }

  if (data.cronExpression) {
    await prisma.scheduledJob.create({
      data: { jobId: job.id, cronExpression: data.cronExpression }
    });
  }

  eventBus.emit('job.created', { ...job, projectId: queue.projectId });
  return job;
};

export const createBatch = async (queueId: string, batchData: CreateJobInput[]) => {
  const queue = await prisma.queue.findUnique({ where: { id: queueId } });
  if (!queue) throw new AppError(404, 'NOT_FOUND', 'Queue not found');

  return prisma.$transaction(async (tx) => {
    const jobs = [];
    for (const data of batchData) {
      const status = data.dependsOn?.length ? 'WAITING' : (data.scheduledAt || data.cronExpression ? 'SCHEDULED' : 'QUEUED');
      const job = await tx.job.create({
        data: {
          queueId,
          type: data.type,
          payload: data.payload,
          priority: data.priority ?? queue.priority,
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
          cronExpression: data.cronExpression,
          batchId: data.batchId,
          idempotencyKey: data.idempotencyKey,
          status
        }
      });
      jobs.push(job);
      
      if (data.dependsOn?.length) {
        await tx.jobDependency.createMany({
          data: data.dependsOn.map((depId: string) => ({ jobId: job.id, dependsOnJobId: depId }))
        });
      }
      if (data.cronExpression) {
        await tx.scheduledJob.create({
          data: { jobId: job.id, cronExpression: data.cronExpression }
        });
      }
    }
    
    for (const job of jobs) {
      eventBus.emit('job.created', { ...job, projectId: queue.projectId });
    }
    
    return jobs;
  });
};

export const listJobs = async (queueId: string, query: { status?: any, type?: string, batchId?: string, page?: string, limit?: string }) => {
  const where: any = { queueId };
  if (query.status) where.status = query.status;
  if (query.type) where.type = query.type;
  if (query.batchId) where.batchId = query.batchId;
  
  const page = parseInt(query.page || '1') || 1;
  const limit = parseInt(query.limit || '20') || 20;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.job.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.job.count({ where })
  ]);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

export const getJob = async (id: string) => {
  const job = await prisma.job.findUnique({
    where: { id },
    include: { executions: { orderBy: { startedAt: 'desc' } }, logs: { take: 10, orderBy: { timestamp: 'desc' } } }
  });
  if (!job) throw new AppError(404, 'NOT_FOUND', 'Job not found');
  return job;
};

export const retryJob = async (id: string, userId?: string) => {
  const job = await prisma.job.findUnique({ 
    where: { id }, 
    include: { queue: { include: { project: { include: { organization: { include: { memberships: true } } } } } } } 
  });
  if (!job) throw new AppError(404, 'NOT_FOUND', 'Job not found');
  if (userId && !job.queue.project.organization.memberships.some(m => m.userId === userId)) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied to this job');
  }
  if (!['FAILED', 'DEAD'].includes(job.status)) throw new AppError(400, 'BAD_REQUEST', 'Only FAILED or DEAD jobs can be retried');
  
  const updatedJob = await prisma.job.update({
    where: { id },
    data: { status: 'QUEUED', attempt: { increment: 1 }, nextRetryAt: null }
  });
  
  eventBus.emit('job.updated', { ...updatedJob, projectId: job.queue.projectId });
  return updatedJob;
};

export const cancelJob = async (id: string, userId?: string) => {
  const job = await prisma.job.findUnique({ 
    where: { id }, 
    include: { queue: { include: { project: { include: { organization: { include: { memberships: true } } } } } } } 
  });
  if (!job) throw new AppError(404, 'NOT_FOUND', 'Job not found');
  if (userId && !job.queue.project.organization.memberships.some(m => m.userId === userId)) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied to this job');
  }
  if (['RUNNING', 'COMPLETED', 'DEAD'].includes(job.status)) throw new AppError(400, 'BAD_REQUEST', 'Cannot cancel job in current state');
  
  const updatedJob = await prisma.job.update({ where: { id }, data: { status: 'CANCELLED' } });
  
  eventBus.emit('job.cancelled', { ...updatedJob, projectId: job.queue.projectId });
  return updatedJob;
};

export const getJobLogs = async (id: string) => {
  return prisma.jobLog.findMany({ where: { jobId: id }, orderBy: { timestamp: 'desc' } });
};

export const claimJobs = async (queueId: string, workerId: string, limit: number = 1, shardKey?: string) => {
  const queue = await prisma.queue.findUnique({ where: { id: queueId } });
  if (!queue) throw new AppError(404, 'NOT_FOUND', 'Queue not found');
  if (queue.isPaused) return [];

  // Distributed locking & atomic claim using raw SQL (Prisma doesn't support SKIP LOCKED natively)
  const jobs = await prisma.$transaction(async (tx) => {
    // Acquire a transaction-level advisory lock on the queue to prevent concurrent claim overlap
    const lockKey = BigInt('0x' + queueId.replace(/-/g, '').slice(0, 15)) % 9223372036854775807n; // 64-bit int for advisory lock
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${Number(lockKey)})`;

    const shardFilter = shardKey 
      ? Prisma.sql`AND "shardKey" = ${shardKey}` 
      : Prisma.empty;

    const claimedJobsRaw: any[] = await tx.$queryRaw`
      UPDATE "jobs"
      SET 
        status = 'CLAIMED',
        "claimedById" = ${workerId},
        "claimedAt" = NOW(),
        "updatedAt" = NOW()
      WHERE id IN (
        SELECT id FROM "jobs"
        WHERE "queueId" = ${queueId}
          AND status = 'QUEUED'
          AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= NOW())
          ${shardFilter}
        ORDER BY priority DESC, "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      RETURNING *;
    `;

    return claimedJobsRaw;
  });

  for (const job of jobs) {
    eventBus.emit('job.claimed', { ...job, projectId: queue.projectId });
  }

  return jobs;
};

export const startJob = async (id: string, workerId: string) => {
  const result = await prisma.$executeRaw`
    UPDATE "jobs"
    SET status = 'RUNNING', "startedAt" = NOW(), "updatedAt" = NOW()
    WHERE id = ${id} AND status = 'CLAIMED' AND "claimedById" = ${workerId}
  `;
  if (result === 0) {
    const job = await prisma.job.findUnique({ where: { id } });
    if (job?.status === 'RUNNING' && job?.claimedById === workerId) return job;
    console.warn(`startJob idempotency conflict for job ${id}`);
    throw new AppError(409, 'CONFLICT', 'Job is not in CLAIMED state or not owned by worker');
  }
  const updated = await prisma.job.findUnique({ where: { id }, include: { queue: true } });
  eventBus.emit('job.started', { ...updated, projectId: updated!.queue.projectId });
  return updated;
};

export const completeJob = async (id: string, workerId: string, result: any, durationMs: number) => {
  const count = await prisma.$executeRaw`
    UPDATE "jobs"
    SET status = 'COMPLETED', "completedAt" = NOW(), "updatedAt" = NOW(), result = ${result ? JSON.stringify(result) : null}::jsonb
    WHERE id = ${id} AND status = 'RUNNING' AND "claimedById" = ${workerId}
  `;
  if (count === 0) {
    const job = await prisma.job.findUnique({ where: { id } });
    if (job?.status === 'COMPLETED' && job?.claimedById === workerId) return job;
    console.warn(`completeJob idempotency conflict for job ${id}`);
    throw new AppError(409, 'CONFLICT', 'Job is not RUNNING or not owned by worker');
  }

  const updated = await prisma.job.findUnique({ where: { id }, include: { queue: true } });
  
  await prisma.jobExecution.create({
    data: { jobId: id, workerId, attempt: updated!.attempt, status: 'COMPLETED', durationMs, result: result ? result : undefined }
  });
  
  await prisma.jobLog.create({
    data: { jobId: id, level: 'INFO', message: 'Job completed successfully', metadata: { durationMs } }
  });

  eventBus.emit('job.completed', { ...updated, projectId: updated!.queue.projectId });
  return updated;
};

export const failJob = async (id: string, workerId: string, error: string, durationMs: number) => {
  return prisma.$transaction(async (tx) => {
    const job = await tx.job.findUnique({ where: { id }, include: { queue: { include: { retryPolicy: true } } } });
    if (!job) throw new AppError(404, 'NOT_FOUND', 'Job not found');

    const updateCount = await tx.$executeRaw`
      UPDATE "jobs" SET "updatedAt" = NOW()
      WHERE id = ${id} AND status = 'RUNNING' AND "claimedById" = ${workerId}
    `;
    if (updateCount === 0) {
      if (['FAILED', 'DEAD', 'QUEUED'].includes(job.status) && job.claimedById === workerId) return job;
      console.warn(`failJob idempotency conflict for job ${id}`);
      throw new AppError(409, 'CONFLICT', 'Job is not RUNNING or not owned by worker');
    }

    await tx.jobExecution.create({
      data: { jobId: id, workerId, attempt: job.attempt, status: 'FAILED', durationMs, error }
    });
    
    await tx.jobLog.create({
      data: { jobId: id, level: 'ERROR', message: 'Job failed', metadata: { error, durationMs } }
    });

    const policy = job.queue.retryPolicy;
    const maxRetries = policy ? policy.maxRetries : job.maxRetries;
    const attempt = job.attempt; // Compute delay using attempt BEFORE incrementing

    if (attempt < maxRetries) {
      const initial = policy ? policy.initialDelayMs : job.retryDelayMs;
      const strategy = policy ? policy.strategy : job.retryStrategy;
      const mult = policy ? policy.backoffMultiplier : 2.0;
      const maxDelay = policy ? policy.maxDelayMs : 60000;
      
      let delay = initial;
      if (strategy === 'LINEAR') delay = Math.min(initial + (attempt * mult), maxDelay);
      else if (strategy === 'EXPONENTIAL') delay = Math.min(initial * Math.pow(mult, attempt), maxDelay);
      
      const jitter = Math.random() * delay * 0.1;
      delay = Math.floor(delay + jitter);
      
      const nextRetryAt = new Date(Date.now() + delay);
      
      const updated = await tx.job.update({
        where: { id },
        data: { status: 'QUEUED', attempt: attempt + 1, nextRetryAt, error }
      });
      eventBus.emit('job.failed', { ...updated, projectId: job.queue.projectId });
      return updated;
    } else {
      const updated = await tx.job.update({
        where: { id },
        data: { status: 'DEAD', error }
      });
      await tx.deadLetterQueue.create({
        data: { jobId: id, queueId: job.queueId, reason: 'Max retries exhausted', retryCount: attempt, lastError: error }
      });
      eventBus.emit('job.dead', { ...updated, projectId: job.queue.projectId });
      return updated;
    }
  });
};
