import { prisma } from '../../config/database.js';

export const getProjectMetrics = async (projectId: string) => {
  const totalJobs = await prisma.job.count({ where: { queue: { projectId } } });
  const completedJobs = await prisma.job.count({ where: { queue: { projectId }, status: 'COMPLETED' } });
  const failedJobs = await prisma.job.count({ where: { queue: { projectId }, status: 'FAILED' } });
  const activeWorkers = await prisma.worker.count({ where: { status: { in: ['ONLINE', 'BUSY'] } } });
  
  // Jobs completed per minute over the last hour using raw SQL
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

  return { totalJobs, completedJobs, failedJobs, activeWorkers, throughputLastHour };
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

  // Calculate average latency for completed jobs in the last hour
  const latency = await prisma.$queryRaw<Array<{ avg_latency: number }>>`
    SELECT COALESCE(EXTRACT(EPOCH FROM AVG("completedAt" - "createdAt")), 0) as avg_latency
    FROM jobs
    WHERE "queueId" = ${queueId}
      AND status = 'COMPLETED'
      AND "completedAt" >= NOW() - INTERVAL '1 hour'
  `;

  const avgLatencySec = latency[0]?.avg_latency || 0;

  return { 
    totalJobs, 
    statusDistribution,
    avgLatencySec
  };
};
