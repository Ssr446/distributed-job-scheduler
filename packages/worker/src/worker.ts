import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import os from 'os';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const hostname = os.hostname();
  const pid = process.pid;
  const workerName = `worker-${hostname}-${pid}`;

  // 1. Register worker in DB
  const worker = await prisma.worker.create({
    data: {
      name: workerName,
      hostname,
      pid,
      status: 'ONLINE',
      concurrency: 5,
      queues: ['*'],
    }
  });
  
  const WORKER_ID = worker.id;
  console.log('Worker registered with ID:', WORKER_ID);

  // Heartbeat loop
  setInterval(async () => {
    try {
      await prisma.workerHeartbeat.create({
        data: { workerId: WORKER_ID, activeJobs: 0 }
      });
      await prisma.worker.update({
        where: { id: WORKER_ID },
        data: { lastHeartbeatAt: new Date() }
      });
    } catch (e) {
      console.error('Heartbeat failed', e);
    }
  }, 10000);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down worker...');
    await prisma.worker.update({
      where: { id: WORKER_ID },
      data: { status: 'OFFLINE', deregisteredAt: new Date() }
    });
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Poll for jobs
  setInterval(async () => {
    try {
      // Claim job in a single transaction
      const claimedJob = await prisma.$transaction(async (tx) => {
        const jobs = await tx.$queryRaw<any[]>`
          SELECT id FROM "jobs"
          WHERE status = 'QUEUED'
          ORDER BY priority DESC, "createdAt" ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        `;

        if (jobs.length > 0) {
          const jobId = jobs[0].id;
          return tx.job.update({
            where: { id: jobId },
            data: { status: 'RUNNING', claimedById: WORKER_ID, startedAt: new Date() }
          });
        }
        return null;
      });

      if (claimedJob) {
        console.log(`Claimed job ${claimedJob.id} (type: ${claimedJob.type})`);

        // Simulate execution
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Complete the job
        await prisma.job.update({
          where: { id: claimedJob.id },
          data: { status: 'COMPLETED', completedAt: new Date(), result: { msg: 'Success' } }
        });
        
        console.log(`Completed job ${claimedJob.id}`);
      }
    } catch (err) {
      console.error('Error in job loop:', err);
    }
  }, 1000);
}

main().catch(console.error);
