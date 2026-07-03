import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { eventBus } from '../events/eventBus.js';
import { logger } from '../config/logger.js';
import type { JwtPayload } from '../middleware/auth.js';
import { prisma } from '../config/database.js';

export const setupWebSocket = (io: Server) => {
  // ── Authentication Middleware ──────────────────────────────────────────────
  io.use(async (socket: Socket, next) => {
    try {
      const cookieHeader = socket.request.headers.cookie;
      let token: string | undefined;

      if (cookieHeader) {
        // Parse cookies manually
        const cookies = cookieHeader.split(';').reduce((res, c) => {
          const [key, val] = c.trim().split('=').map(decodeURIComponent);
          try {
            return Object.assign(res, { [key]: JSON.parse(val) });
          } catch (e) {
            return Object.assign(res, { [key]: val });
          }
        }, {} as any);
        token = cookies['accessToken'];
      }
      
      // Fallback to handshake auth token for debugging or programmatic access
      if (!token) {
        token = socket.handshake.auth?.token;
      }

      if (!token) {
        return next(new Error('Authentication token required'));
      }
      const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      
      // Check for token revocation
      const revoked = await prisma.revokedToken.findUnique({ where: { jti: decoded.jti } });
      if (revoked) {
        return next(new Error('Token has been revoked'));
      }

      // Attach user to socket data for later use
      socket.data.user = decoded;
      next();
    } catch {
      next(new Error('Invalid or expired authentication token'));
    }
  });

  // ── Connection Handler ─────────────────────────────────────────────────────
  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as JwtPayload;
    logger.info({ socketId: socket.id, userId: user.userId }, 'WebSocket client connected');

    // Client joins a project-scoped room for targeted broadcasts
    socket.on('join:project', async (projectId: string) => {
      try {
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) return;
        
        const membership = await prisma.orgMembership.findUnique({
          where: { userId_orgId: { userId: user.userId, orgId: project.orgId } }
        });
        
        if (membership) {
          socket.join(`project:${projectId}`);
          logger.debug({ socketId: socket.id, projectId }, 'Client joined project room');
        }
      } catch (error) {
        logger.error({ error }, 'Error authorizing socket room join');
      }
    });

    socket.on('leave:project', (projectId: string) => {
      socket.leave(`project:${projectId}`);
    });

    socket.on('disconnect', (reason) => {
      logger.debug({ socketId: socket.id, reason }, 'WebSocket client disconnected');
    });
  });

  // ── Event Bus → WebSocket Broadcasts ──────────────────────────────────────
  // Job events — broadcast to the job's project room
  eventBus.on('job.created', (job: any) => {
    io.to(`project:${job.projectId}`).emit('jobUpdate', { type: 'created', job });
  });

  eventBus.on('job.claimed', (job: any) => {
    io.to(`project:${job.projectId}`).emit('jobUpdate', { type: 'claimed', job });
  });

  eventBus.on('job.started', (job: any) => {
    io.to(`project:${job.projectId}`).emit('jobUpdate', { type: 'started', job });
  });

  eventBus.on('job.completed', (job: any) => {
    io.to(`project:${job.projectId}`).emit('jobUpdate', { type: 'completed', job });
  });

  eventBus.on('job.failed', (job: any) => {
    io.to(`project:${job.projectId}`).emit('jobUpdate', { type: 'failed', job });
  });

  eventBus.on('job.dead', (job: any) => {
    io.to(`project:${job.projectId}`).emit('jobUpdate', { type: 'dead', job });
  });

  // Worker events — broadcast to all authenticated clients
  eventBus.on('worker.registered', (worker: any) => {
    io.emit('workerUpdate', { type: 'registered', worker });
  });

  eventBus.on('worker.heartbeat', (worker: any) => {
    io.emit('workerUpdate', { type: 'heartbeat', worker });
  });

  eventBus.on('worker.offline', (worker: any) => {
    io.emit('workerUpdate', { type: 'offline', worker });
  });

  // Queue events — broadcast to the queue's project room
  eventBus.on('queue.paused', (queue: any) => {
    io.to(`project:${queue.projectId}`).emit('queueUpdate', { type: 'paused', queue });
  });

  eventBus.on('queue.resumed', (queue: any) => {
    io.to(`project:${queue.projectId}`).emit('queueUpdate', { type: 'resumed', queue });
  });

  logger.info('WebSocket server initialized with JWT authentication');
};
