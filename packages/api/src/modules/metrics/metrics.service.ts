import { prisma } from '../../config/database.js';

export const getProjectMetrics = async (projectId: string) => {
  // Basic counts
  const [totalJobs, completedJobs, failedJobs, deadJobs, activeWorkers] = await Promise.all([
    prisma.job.count({ where: { queue: { projectId } } }),
    prisma.job.count({ where: { queue: { projectId }, status: 'COMPLETED' } }),
    prisma.job.count({ where: { queue: { projectId }, status: 'FAILED' } }),
    prisma.job.count({ where: { queue: { projectId }, status: 'DEAD' } }),
    prisma.worker.count({ where: { status: { in: ['ONLINE', 'BUSY'] } } }),
  ]);

  // Average execution duration from JobExecution records (uses actual measured durationMs)
  const durationResult = await prisma.$queryRaw<Array<{ avg_ms: number | null }>>`
    SELECT ROUND(AVG(je."durationMs")) AS avg_ms
    FROM job_executions je
    JOIN jobs j ON j.id = je."jobId"
    JOIN queues q ON q.id = j."queueId"
    WHERE q."projectId" = ${projectId}
      AND je.status = 'COMPLETED'
      AND je."completedAt" >= NOW() - INTERVAL '24 hours'
  `;
  const avgDurationMs = durationResult[0]?.avg_ms ?? null;

  // Throughput: jobs completed per minute in the last hour
  const throughput = await prisma.$queryRaw<Array<{ minute: Date; count: bigint }>>`
    SELECT
      date_trunc('minute', "completedAt") AS minute,
      COUNT(*)::bigint AS count
    FROM jobs
    JOIN queues ON jobs."queueId" = queues.id
    WHERE queues."projectId" = ${projectId}
      AND "completedAt" >= NOW() - INTERVAL '1 hour'
      AND jobs.status = 'COMPLETED'
    GROUP BY date_trunc('minute', "completedAt")
    ORDER BY minute ASC
  `;

  const throughputLastHour = throughput.map((row) => ({
    timestamp: row.minute,
    count: Number(row.count),
  }));

  // Queue health: per-queue job counts
  const queues = await prisma.queue.findMany({
    where: { projectId },
    select: {
      id: true,
      name: true,
      isPaused: true,
      concurrencyLimit: true,
      _count: { select: { jobs: true } },
    },
  });

  const queueHealthCounts = await prisma.$queryRaw<
    Array<{ queueId: string; status: string; count: bigint }>
  >`
    SELECT "queueId", status, COUNT(*)::bigint AS count
    FROM jobs
    WHERE "queueId" = ANY(${queues.map((q) => q.id)})
    GROUP BY "queueId", status
  `;

  // Build a lookup map { queueId → { status → count } }
  const countsByQueue: Record<string, Record<string, number>> = {};
  for (const row of queueHealthCounts) {
    if (!countsByQueue[row.queueId]) countsByQueue[row.queueId] = {};
    countsByQueue[row.queueId][row.status] = Number(row.count);
  }

  const queueHealth = queues.map((q) => {
    const counts = countsByQueue[q.id] ?? {};
    return {
      id: q.id,
      name: q.name,
      isPaused: q.isPaused,
      concurrencyLimit: q.concurrencyLimit,
      totalJobs: q._count.jobs,
      queued: counts['QUEUED'] ?? 0,
      running: counts['RUNNING'] ?? 0,
      completed: counts['COMPLETED'] ?? 0,
      failed: counts['FAILED'] ?? 0,
      dead: counts['DEAD'] ?? 0,
    };
  });

  return {
    totalJobs,
    completedJobs,
    failedJobs,
    deadJobs,
    activeWorkers,
    avgDurationMs,
    throughputLastHour,
    queueHealth,
  };
};

export const getQueueMetrics = async (queueId: string) => {
  const totalJobs = await prisma.job.count({ where: { queueId } });

  // Group by status
  const statusDistRaw = await prisma.job.groupBy({
    by: ['status'],
    where: { queueId },
    _count: { status: true },
  });

  const statusDistribution = statusDistRaw.reduce((acc: any, curr) => {
    acc[curr.status] = curr._count.status;
    return acc;
  }, {});

  // Average latency from JobExecution.durationMs for precision
  const latency = await prisma.$queryRaw<Array<{ avg_ms: number | null }>>`
    SELECT ROUND(AVG(je."durationMs")) AS avg_ms
    FROM job_executions je
    WHERE je."jobId" IN (
      SELECT id FROM jobs WHERE "queueId" = ${queueId}
    )
    AND je.status = 'COMPLETED'
    AND je."completedAt" >= NOW() - INTERVAL '1 hour'
  `;
  const avgDurationMs = latency[0]?.avg_ms ?? null;

  return {
    totalJobs,
    statusDistribution,
    avgDurationMs,
  };
};

