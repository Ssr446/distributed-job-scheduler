import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../config/database.js';
import * as jobsService from '../modules/jobs/jobs.service.js';
import { eventBus } from '../events/eventBus.js';
import crypto from 'crypto';

describe('Worker E2E & Idempotency', () => {
  let workerId: string;
  let queueId: string;
  let jobId: string;

  beforeAll(async () => {
    const worker = await prisma.worker.create({
      data: { name: 'test-worker', hostname: 'test', pid: 1, concurrency: 1, queues: ['*'] }
    });
    workerId = worker.id;

    const org = await prisma.organization.create({
      data: { name: 'test-org', slug: 'test-org-' + Date.now() }
    });

    const project = await prisma.project.create({
      data: { name: 'test-project', orgId: org.id }
    });
    
    const policy = await prisma.retryPolicy.create({
      data: { name: 'test-policy', projectId: project.id, maxRetries: 1, strategy: 'FIXED', initialDelayMs: 10 }
    });

    const queue = await prisma.queue.create({
      data: { name: 'test-queue', projectId: project.id, retryPolicyId: policy.id }
    });
    queueId = queue.id;
  });

  afterAll(async () => {
    await prisma.jobExecution.deleteMany();
    await prisma.jobLog.deleteMany();
    await prisma.deadLetterQueue.deleteMany();
    await prisma.job.deleteMany();
    await prisma.queue.deleteMany();
    await prisma.retryPolicy.deleteMany();
    await prisma.project.deleteMany();
    await prisma.worker.deleteMany();
  });

  it('claims a job successfully', async () => {
    const job = await jobsService.createJob(queueId, { type: 'test', payload: {} });
    jobId = job.id;

    const claimed = await jobsService.claimJobs(queueId, workerId, 1);
    expect(claimed.length).toBe(1);
    expect(claimed[0].id).toBe(jobId);
    expect(claimed[0].status).toBe('CLAIMED');
  });

  it('starts a job idempotently', async () => {
    const started1 = await jobsService.startJob(jobId, workerId);
    expect(started1.status).toBe('RUNNING');

    const started2 = await jobsService.startJob(jobId, workerId);
    expect(started2.status).toBe('RUNNING');
  });

  it('completes a job idempotently without duplicating logs', async () => {
    const emitSpy = vi.spyOn(eventBus, 'emit');
    
    const completed1 = await jobsService.completeJob(jobId, workerId, { ok: true }, 100);
    expect(completed1.status).toBe('COMPLETED');
    expect(emitSpy).toHaveBeenCalledWith('job.completed', expect.anything());
    
    emitSpy.mockClear();

    const completed2 = await jobsService.completeJob(jobId, workerId, { ok: true }, 100);
    expect(completed2.status).toBe('COMPLETED');
    expect(emitSpy).not.toHaveBeenCalledWith('job.completed', expect.anything()); // Event omitted

    // Assert exactly ONE execution and ONE log
    const execs = await prisma.jobExecution.count({ where: { jobId } });
    const logs = await prisma.jobLog.count({ where: { jobId } });
    expect(execs).toBe(1);
    expect(logs).toBe(1);
  });

  it('exhausts retries and enters DLQ idempotently', async () => {
    const failJobId = (await jobsService.createJob(queueId, { type: 'test-fail', payload: {} })).id;
    await jobsService.claimJobs(queueId, workerId, 1);
    await jobsService.startJob(failJobId, workerId);

    // Attempt 0 -> Fails, goes to QUEUED (1 retry allowed)
    const failed1 = await jobsService.failJob(failJobId, workerId, 'err1', 50);
    expect(failed1.status).toBe('QUEUED');
    expect(failed1.attempt).toBe(1);

    // Re-claim and Re-start
    await jobsService.claimJobs(queueId, workerId, 1);
    await jobsService.startJob(failJobId, workerId);

    // Attempt 1 -> Fails, exhausts maxRetries (1), goes to DEAD
    const emitSpy = vi.spyOn(eventBus, 'emit');
    const failed2 = await jobsService.failJob(failJobId, workerId, 'err2', 50);
    expect(failed2.status).toBe('DEAD');
    expect(emitSpy).toHaveBeenCalledWith('job.dead', expect.anything());
    
    emitSpy.mockClear();

    // Idempotent retry on already DEAD job should just return the job, no events or rows
    const failed3 = await jobsService.failJob(failJobId, workerId, 'err3', 50);
    expect(failed3.status).toBe('DEAD');

    expect(emitSpy).not.toHaveBeenCalledWith('job.dead', expect.anything());

    // Assert exactly ONE DLQ row
    const dlqCount = await prisma.deadLetterQueue.count({ where: { jobId: failJobId } });
    expect(dlqCount).toBe(1);

    // Assert exact log counts (2 executions: 1 for attempt 0, 1 for attempt 1)
    const execs = await prisma.jobExecution.count({ where: { jobId: failJobId } });
    expect(execs).toBe(2);
  });
});
