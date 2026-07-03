import { beforeAll, afterAll, afterEach } from 'vitest';
import { prisma } from '../config/database';

beforeAll(async () => {
  // Clear the database before tests
  await prisma.jobDependency.deleteMany();
  await prisma.jobExecution.deleteMany();
  await prisma.jobLog.deleteMany();
  await prisma.job.deleteMany();
  await prisma.queue.deleteMany();
  await prisma.project.deleteMany();
  await prisma.orgMembership.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
