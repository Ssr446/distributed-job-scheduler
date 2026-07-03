import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { setupWebSocket } from './websocket/socketHandler.js';

const PORT = env.PORT;
const server = http.createServer(app);

// ── WebSocket Setup ──────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: env.CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

setupWebSocket(io);

// ── Start ────────────────────────────────────────────────────────────────────
async function start() {
  try {
    await connectDatabase();
    server.listen(PORT, () => {
      logger.info(`🚀 Server listening on port ${PORT} [${env.NODE_ENV}]`);
    });
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }
}

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    logger.info('HTTP server closed');
    await disconnectDatabase();
    logger.info('Database disconnected');
    process.exit(0);
  });
  // Force exit after 10s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.error(err, 'Uncaught exception');
  shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  logger.error(reason, 'Unhandled rejection');
});

start();
