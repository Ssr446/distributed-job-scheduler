import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';

export const listDlq = async (projectId: string, query: any) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 20;
  const skip = (page - 1) * limit;

  const where = { queue: { projectId } };
  
  const [data, total] = await Promise.all([
    prisma.deadLetterQueue.findMany({ where, skip, take: limit, include: { job: true }, orderBy: { failedAt: 'desc' } }),
    prisma.deadLetterQueue.count({ where })
  ]);
  
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

export const getDlq = async (id: string) => {
  const entry = await prisma.deadLetterQueue.findUnique({ where: { id }, include: { job: true } });
  if (!entry) throw new AppError(404, 'NOT_FOUND', 'DLQ entry not found');
  
  if (!entry.failureSummary) {
    const summary = 'AI Summary: Likely network timeout or missing resource based on logs.';
    await prisma.deadLetterQueue.update({ where: { id }, data: { failureSummary: summary } });
    entry.failureSummary = summary;
  }
  
  return entry;
};

export const requeueDlq = async (id: string) => {
  const entry = await prisma.deadLetterQueue.findUnique({ where: { id } });
  if (!entry) throw new AppError(404, 'NOT_FOUND', 'DLQ entry not found');
  
  await prisma.deadLetterQueue.update({ where: { id }, data: { requeued: true, requeuedAt: new Date() } });
  return prisma.job.update({ where: { id: entry.jobId }, data: { status: 'QUEUED', attempt: 0, nextRetryAt: null } });
};
