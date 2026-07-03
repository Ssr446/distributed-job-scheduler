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
    let summary = 'Unknown Error: Review logs for details.';
    const errorText = (entry.lastError || '').toLowerCase();
    
    if (errorText.includes('timeout') || errorText.includes('econnrefused')) {
      summary = 'Network/Timeout Error: The external service was unreachable or timed out.';
    } else if (errorText.includes('validation') || errorText.includes('invalid') || errorText.includes('bad request')) {
      summary = 'Validation Error: Job payload contains invalid data.';
    } else if (errorText.includes('declined') || errorText.includes('insufficient funds')) {
      summary = 'Business Logic Error: The transaction was declined or failed business rules.';
    } else if (errorText.includes('null') || errorText.includes('undefined')) {
      summary = 'Null Reference Error: Code attempted to access a missing property.';
    }
    
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
