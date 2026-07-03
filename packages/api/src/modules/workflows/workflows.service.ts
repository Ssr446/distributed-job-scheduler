import { prisma } from '../../config/database.js';
import { eventBus } from '../../events/eventBus.js';
import { logger } from '../../config/logger.js';

export const checkAndResolveDependencies = async (completedJobId: string) => {
  // Find all jobs that depend on the completed job
  const dependentLinks = await prisma.jobDependency.findMany({
    where: { dependsOnJobId: completedJobId },
    select: { jobId: true }
  });

  if (dependentLinks.length === 0) return;

  const dependentJobIds = dependentLinks.map(link => link.jobId);

  // Check each dependent job to see if ALL its dependencies are met
  for (const jobId of dependentJobIds) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { dependentOn: { include: { dependsOnJob: true } }, queue: true }
    });

    if (!job || job.status !== 'WAITING') continue;

    // Check if all dependencies are COMPLETED
    const allCompleted = job.dependentOn.every(dep => dep.dependsOnJob.status === 'COMPLETED');
    const anyFailed = job.dependentOn.some(dep => ['FAILED', 'DEAD', 'CANCELLED'].includes(dep.dependsOnJob.status));

    if (allCompleted) {
      // Transition to QUEUED
      const updatedJob = await prisma.job.update({
        where: { id: jobId },
        data: { status: 'QUEUED' }
      });
      logger.info({ jobId: updatedJob.id }, 'All dependencies met, job queued');
      eventBus.emit('job.updated', { ...updatedJob, projectId: job.queue.projectId });
    } else if (anyFailed) {
      // Fast fail the dependent job if a dependency failed
      const updatedJob = await prisma.job.update({
        where: { id: jobId },
        data: { status: 'CANCELLED', error: 'A dependency failed or was cancelled' }
      });
      logger.warn({ jobId: updatedJob.id }, 'Dependency failed, job cancelled');
      eventBus.emit('job.updated', { ...updatedJob, projectId: job.queue.projectId });
    }
  }
};

// Register listener automatically when imported
const handleDepCheck = async (job: any) => {
  try {
    await checkAndResolveDependencies(job.id);
  } catch (error) {
    logger.error({ err: error, jobId: job.id }, 'Failed to resolve dependencies');
  }
};

eventBus.on('job.completed', handleDepCheck);
eventBus.on('job.dead', handleDepCheck);
eventBus.on('job.cancelled', handleDepCheck);
