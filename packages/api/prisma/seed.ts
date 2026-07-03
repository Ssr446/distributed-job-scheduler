import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // 1. Create Admin User
  const passwordHash = await bcrypt.hash('password123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@scheduler.io' },
    update: {},
    create: {
      email: 'admin@scheduler.io',
      name: 'Admin User',
      passwordHash,
      role: 'ADMIN',
    },
  });

  // 2. Create Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      name: 'Acme Corp',
      slug: 'acme-corp',
    },
  });

  // 3. Link User to Org
  await prisma.orgMembership.upsert({
    where: { userId_orgId: { userId: admin.id, orgId: org.id } },
    update: {},
    create: {
      userId: admin.id,
      orgId: org.id,
      role: 'OWNER',
    },
  });

  // Clean up existing projects/queues to be idempotent
  await prisma.jobLog.deleteMany({});
  await prisma.jobExecution.deleteMany({});
  await prisma.workerHeartbeat.deleteMany({});
  await prisma.job.deleteMany({});
  await prisma.apiKey.deleteMany({});
  await prisma.worker.deleteMany({});
  await prisma.queue.deleteMany({});
  await prisma.retryPolicy.deleteMany({});
  await prisma.project.deleteMany({});

  // 4. Create Projects
  const paymentProject = await prisma.project.create({
    data: {
      name: 'Payment Service',
      description: 'Handles all billing transactions',
      orgId: org.id,
      createdById: admin.id,
    },
  });

  const notificationProject = await prisma.project.create({
    data: {
      name: 'Notification Service',
      description: 'Emails, SMS, and Push',
      orgId: org.id,
      createdById: admin.id,
    },
  });

  // 5. Create Retry Policies
  const defaultRetry = await prisma.retryPolicy.create({
    data: {
      name: 'Standard Exponential Backoff',
      projectId: paymentProject.id,
      strategy: 'EXPONENTIAL',
      maxRetries: 3,
      initialDelayMs: 1000,
      backoffMultiplier: 2.0,
    },
  });

  // 6. Create Queues
  const paymentHighQ = await prisma.queue.create({
    data: {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'high-priority',
      projectId: paymentProject.id,
      priority: 100,
      concurrencyLimit: 10,
      retryPolicyId: defaultRetry.id,
    },
  });

  const paymentDefaultQ = await prisma.queue.create({
    data: {
      name: 'default',
      projectId: paymentProject.id,
      priority: 50,
      concurrencyLimit: 5,
      retryPolicyId: defaultRetry.id,
    },
  });

  // 7. Seed Workers
  const worker1 = await prisma.worker.create({
    data: {
      name: 'worker-us-east-1a-001',
      hostname: 'worker-node-1',
      pid: 1234,
      status: 'ONLINE',
      concurrency: 10,
      activeJobs: 2,
      queues: ['*'],
      lastHeartbeatAt: new Date(),
    }
  });

  const rawSecret = 'test-worker-key-123';
  const keyHash = crypto.createHash('sha256').update(rawSecret).digest('hex');
  const apiKeyId = '11111111-1111-1111-1111-111111111111';
  const apiKey = await prisma.apiKey.create({
    data: {
      id: apiKeyId,
      name: 'Test Worker Key',
      keyHash,
      workerId: worker1.id
    }
  });
  const fullApiKey = `${apiKey.id}.${rawSecret}`;
  console.log(`Created worker1 with API key: ${fullApiKey}`);

  const worker2 = await prisma.worker.create({
    data: {
      name: 'worker-us-east-1b-002',
      hostname: 'worker-node-2',
      pid: 5678,
      status: 'ONLINE',
      concurrency: 10,
      activeJobs: 0,
      queues: ['*'],
      lastHeartbeatAt: new Date(Date.now() - 5000), // 5 seconds ago
    }
  });

  // 8. Seed Jobs with Realistic History (Last hour)
  const now = new Date();
  
  // Create 50 completed jobs over the last hour
  for (let i = 0; i < 50; i++) {
    const minAgo = Math.floor(Math.random() * 60);
    const createdAt = new Date(now.getTime() - minAgo * 60000 - 5000);
    const startedAt = new Date(createdAt.getTime() + 100);
    const completedAt = new Date(startedAt.getTime() + Math.random() * 2000 + 100);
    
    await prisma.job.create({
      data: {
        queueId: Math.random() > 0.5 ? paymentHighQ.id : paymentDefaultQ.id,
        type: Math.random() > 0.5 ? 'charge_card' : 'generate_invoice',
        payload: { amount: 9900, currency: 'USD', customerId: `cust_${i}` },
        priority: 50,
        status: 'COMPLETED',
        createdAt,
        startedAt,
        completedAt,
        claimedById: Math.random() > 0.5 ? worker1.id : worker2.id,
        result: { receiptUrl: 'https://acme.com/receipt/123' },
      },
    });
  }

  // Create 3 failed jobs
  for (let i = 0; i < 3; i++) {
    const minAgo = Math.floor(Math.random() * 60);
    const createdAt = new Date(now.getTime() - minAgo * 60000 - 5000);
    
    await prisma.job.create({
      data: {
        queueId: paymentHighQ.id,
        type: 'charge_card',
        payload: { amount: 9900, currency: 'USD', customerId: `bad_cust_${i}` },
        priority: 100,
        status: 'FAILED',
        createdAt,
        startedAt: new Date(createdAt.getTime() + 100),
        completedAt: new Date(createdAt.getTime() + 500),
        claimedById: worker1.id,
        error: 'Card declined: Insufficient funds',
      },
    });
  }

  // Create 10 queued jobs
  for (let i = 0; i < 10; i++) {
    await prisma.job.create({
      data: {
        queueId: paymentDefaultQ.id,
        type: 'generate_invoice',
        payload: { invoiceId: `inv_pending_${i}` },
        priority: 50,
        status: 'QUEUED',
      },
    });
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
