import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';

export const categorizeFailure = (errorText: string): string => {
  const text = (errorText || '').toLowerCase();
  
  if (text.includes('timeout'.toLowerCase()) || text.includes('econnrefused'.toLowerCase())) {
    return 'Network/Timeout Error: The external service was unreachable or timed out.';
  } else if (text.includes('validation'.toLowerCase()) || text.includes('invalid'.toLowerCase()) || text.includes('bad request'.toLowerCase())) {
    return 'Validation Error: Job payload contains invalid data.';
  } else if (text.includes('declined'.toLowerCase()) || text.includes('insufficient funds'.toLowerCase())) {
    return 'Business Logic Error: The transaction was declined or failed business rules.';
  } else if (text.includes('null'.toLowerCase()) || text.includes('undefined'.toLowerCase())) {
    return 'Null Reference Error: Code attempted to access a missing property.';
  }
  
  return 'Unknown Error: Review logs for details.';
};

export const listDlq = async (projectId: string, query: any) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 20;
  const skip = (page - 1) * limit;

  const where = { queue: { projectId } };
  
  const [data, total] = await Promise.all([
    prisma.deadLetterQueue.findMany({ where, skip, take: limit, include: { job: true }, orderBy: { failedAt: 'desc' } }),
    prisma.deadLetterQueue.count({ where })
  ]);
  
  // Backfill any uncategorized entries on the fly (since UI doesn't call getDlq)
  for (const entry of data) {
    if (!entry.failureSummary) {
      const summary = categorizeFailure(entry.lastError || '');
      entry.failureSummary = summary;
      // Fire-and-forget update to persist the backfill
      prisma.deadLetterQueue.update({ where: { id: entry.id }, data: { failureSummary: summary } }).catch(console.error);
    }
  }
  
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

export const getDlq = async (id: string) => {
  const entry = await prisma.deadLetterQueue.findUnique({ where: { id }, include: { job: true } });
  if (!entry) throw new AppError(404, 'NOT_FOUND', 'DLQ entry not found');
  
  if (!entry.failureSummary) {
    const summary = categorizeFailure(entry.lastError || '');
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
