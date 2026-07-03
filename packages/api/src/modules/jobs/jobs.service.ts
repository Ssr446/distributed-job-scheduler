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

export const retryJob = async (id: string) => {
  const job = await prisma.job.findUnique({ where: { id }, include: { queue: true } });
  if (!job) throw new AppError(404, 'NOT_FOUND', 'Job not found');
  if (!['FAILED', 'DEAD'].includes(job.status)) throw new AppError(400, 'BAD_REQUEST', 'Only FAILED or DEAD jobs can be retried');
  
  const updatedJob = await prisma.job.update({
    where: { id },
    data: { status: 'QUEUED', attempt: { increment: 1 }, nextRetryAt: null }
  });
  
  eventBus.emit('job.updated', { ...updatedJob, projectId: job.queue.projectId });
  return updatedJob;
};

export const cancelJob = async (id: string) => {
  const job = await prisma.job.findUnique({ where: { id }, include: { queue: true } });
  if (!job) throw new AppError(404, 'NOT_FOUND', 'Job not found');
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

  // Distributed locking & atomic claim using raw SQL (Prisma doesn't support SKIP LOCKED natively)
  const jobs = await prisma.$transaction(async (tx) => {
    // Acquire a transaction-level advisory lock on the queue to prevent concurrent claim overlap
    const lockKey = BigInt('0x' + queueId.replace(/-/g, '').slice(0, 15)) % 9223372036854775807n; // 64-bit int for advisory lock
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${Number(lockKey)})`;

    let shardFilter = '';
    if (shardKey) {
      shardFilter = `AND "shardKey" = '${shardKey.replace(/'/g, "''")}'`;
    }

    const claimedJobsRaw: any[] = await tx.$queryRawUnsafe(`
      UPDATE "Job"
      SET 
        status = 'CLAIMED',
        "claimedById" = $1,
        "claimedAt" = NOW(),
        "updatedAt" = NOW()
      WHERE id IN (
        SELECT id FROM "Job"
        WHERE "queueId" = $2
          AND status = 'QUEUED'
          AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= NOW())
          ${shardFilter}
        ORDER BY priority DESC, "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT $3
      )
      RETURNING *;
    `, workerId, queueId, limit);

    return claimedJobsRaw;
  });

  for (const job of jobs) {
    eventBus.emit('job.claimed', { ...job, projectId: queue.projectId });
  }

  return jobs;
};
