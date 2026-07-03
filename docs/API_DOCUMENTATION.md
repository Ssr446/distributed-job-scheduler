# API Documentation

## Base URL
`/api`

## Authentication
Most endpoints require a JWT bearer token. Obtain this via `POST /api/auth/login`.

## Endpoints

### Auth Module
- `POST /auth/register` - Create a new account.
- `POST /auth/login` - Authenticate and receive `accessToken` and `refreshToken`.
- `POST /auth/refresh` - Rotate the access token.
- `POST /auth/logout` - Invalidate the current session.
- `GET /auth/me` - Get current user profile.

### Queues Module
- `GET /projects/:projectId/queues` - List queues.
- `POST /projects/:projectId/queues` - Create queue.
- `GET /queues/:id` - Get queue stats and config.
- `POST /queues/:id/pause` - Pause a queue.
- `POST /queues/:id/resume` - Resume a queue.

### Jobs Module
- `POST /queues/:queueId/jobs` - Dispatch a single job.
  - Body: `{ type: string, payload: any, priority?: number, scheduledAt?: datetime, cronExpression?: string, dependsOn?: string[] }`
- `POST /queues/:queueId/jobs/batch` - Dispatch multiple jobs in a single transaction.
- `GET /queues/:queueId/jobs` - List jobs with filtering (status, type, batchId) and pagination.
- `GET /jobs/:id` - Job details and executions.
- `POST /jobs/:id/retry` - Manually retry a failed/dead job.
- `POST /jobs/:id/cancel` - Cancel a queued job.

### Workers Module
- `POST /workers/register` - Register a new worker. Returns worker ID.
- `POST /workers/:id/heartbeat` - Send active jobs count to keep worker online.
- `POST /workers/:id/deregister` - Gracefully offline a worker.

### WebSockets
- Connect to `/` with `{ auth: { token: '...' } }`.
- Events emitted by server: `job.created`, `job.updated`, `job.completed`, `job.failed`, `worker.registered`, `worker.heartbeat`.
