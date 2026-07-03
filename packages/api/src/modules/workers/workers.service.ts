import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';
import { eventBus } from '../../events/eventBus.js';

export const listWorkers = async () => {
  return prisma.worker.findMany({ orderBy: { lastHeartbeatAt: 'desc' } });
};

export const getWorker = async (id: string) => {
  const worker = await prisma.worker.findUnique({ where: { id }, include: { heartbeats: { take: 20, orderBy: { timestamp: 'desc' } } } });
  if (!worker) throw new AppError(404, 'NOT_FOUND', 'Worker not found');
  return worker;
};

export const registerWorker = async (data: { name: string, hostname: string, pid: number, concurrency: number, queues: string[] }) => {
  const worker = await prisma.worker.create({
    data: {
      name: data.name,
      hostname: data.hostname,
      pid: data.pid,
      concurrency: data.concurrency,
      queues: data.queues,
      status: 'ONLINE',
      lastHeartbeatAt: new Date(),
    }
  });
  
  eventBus.emit('worker.registered', worker);
  return worker;
};

export const heartbeat = async (id: string, data: { activeJobs: number, cpuUsage?: number, memoryUsage?: number }) => {
  const worker = await prisma.worker.findUnique({ where: { id } });
  if (!worker) throw new AppError(404, 'NOT_FOUND', 'Worker not found');

  const updatedWorker = await prisma.worker.update({
    where: { id },
    data: {
      activeJobs: data.activeJobs,
      lastHeartbeatAt: new Date(),
      status: data.activeJobs >= worker.concurrency ? 'BUSY' : 'ONLINE'
    }
  });

  await prisma.workerHeartbeat.create({
    data: {
      workerId: id,
      activeJobs: data.activeJobs,
      cpuUsage: data.cpuUsage,
      memoryUsage: data.memoryUsage
    }
  });

  eventBus.emit('worker.heartbeat', updatedWorker);
  return updatedWorker;
};

export const deregisterWorker = async (id: string) => {
  const worker = await prisma.worker.findUnique({ where: { id } });
  if (!worker) throw new AppError(404, 'NOT_FOUND', 'Worker not found');

  const updatedWorker = await prisma.worker.update({
    where: { id },
    data: {
      status: 'OFFLINE',
      deregisteredAt: new Date()
    }
  });

  eventBus.emit('worker.offline', updatedWorker);
  return updatedWorker;
};
