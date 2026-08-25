# Architecture & Design Decisions

## 1. Advisory Locks for Atomic Claiming
We use PostgreSQL `pg_advisory_xact_lock` combined with a strict transaction block to handle concurrent worker polling, rather than relying on a separate message queue (like Redis or RabbitMQ). This simplifies the infrastructure footprint to just PostgreSQL while ensuring exactly-once delivery; the transaction bounds guarantee that a single job cannot be claimed by two workers simultaneously.

## 2. Idempotent State Machine via Conditional Updates
The worker execution lifecycle (claim → start → complete/fail) enforces strict state transitions. The `completeJob` and `failJob` endpoints execute a 0-row conditional update (`UPDATE ... WHERE id = X AND status = Y`). If a worker experiences a network partition and retries completing a job that is already marked completed, the conditional update returns safely without duplicating side-effects (like rewriting `JobExecution` logs or triggering duplicate events).

## 3. Worker Authentication & HTTP-Only Cookies
The system explicitly separates human and machine identities. The dashboard uses secure `HttpOnly` cookies and strict CSRF checks for browser security, mitigating XSS and session hijacking. Conversely, the worker authenticates via a cryptographically secure `WORKER_API_KEY` validated using a constant-time hash comparison, allowing the worker to bypass CSRF and global rate limits safely.

## 4. Exponential Backoff & Retry Formulas
Job failures execute a configurable retry policy (fixed, linear, or exponential backoff). The exponential backoff computes its delay dynamically using the formula `initialDelayMs * (multiplier ^ attempt)`, strictly bounded by a `maxDelayMs` ceiling. The current attempt count is evaluated *before* incrementing, ensuring the initial failure correctly receives the first-tier delay.

## 5. DLQ and Dependency Cascade
When a job exhausts its maximum retry count, it transitions to `DEAD` rather than `FAILED`, and a corresponding record is written to the `DeadLetterQueue`. Crucially, this state transition triggers a cascading cancellation: any jobs in the `WAITING` state that depend on the `DEAD` job are immediately transitioned to `CANCELLED`, preventing workflow deadlocks.

---

## API Reference

All endpoints are prefixed with `/api/v1`. Responses follow the shape `{ success: true, data: ... }` or `{ success: false, error: { code, message, details? } }`.

### Authentication

Two schemes are used depending on the caller:
- **JWT Cookie** — dashboard users; Bearer token in an httpOnly cookie
- **API Key** — worker processes; `Authorization: Bearer <keyId>.<secret>`

---

### Auth Endpoints

| Method | Path | Auth | Body / Query | Description |
|--------|------|------|-------------|-------------|
| `POST` | `/auth/register` | Public | `{ email, password, name }` | Register user + default org. Sets cookies. |
| `POST` | `/auth/login` | Public | `{ email, password }` | Login. Sets `accessToken` + `refreshToken` cookies. |
| `POST` | `/auth/refresh` | Refresh cookie | — | Rotate refresh token. Returns new `accessToken`. |
| `GET`  | `/auth/me` | JWT | — | Current user profile. |
| `POST` | `/auth/logout` | JWT | — | Revoke current session JTI. |

---

### Organizations

| Method | Path | Auth | Body | Description |
|--------|------|------|------|-------------|
| `POST` | `/orgs` | JWT | `{ name, slug }` | Create org. Caller becomes OWNER. |
| `GET`  | `/orgs` | JWT | — | List user's orgs. |
| `POST` | `/orgs/:id/members` | JWT (OWNER/ADMIN) | `{ email, role }` | Invite member. |
| `PUT`  | `/orgs/:id/members/:userId` | JWT (OWNER) | `{ role }` | Change member role. |
| `DELETE` | `/orgs/:id/members/:userId` | JWT (OWNER/ADMIN) | — | Remove member. |

---

### Projects

| Method | Path | Auth | Body / Query | Description |
|--------|------|------|-------------|-------------|
| `POST` | `/orgs/:orgId/projects` | JWT | `{ name, description? }` | Create project. |
| `GET`  | `/orgs/:orgId/projects` | JWT | `page, limit` | List org projects. |
| `GET`  | `/projects/:id` | JWT | — | Project detail. |
| `PUT`  | `/projects/:id` | JWT | `{ name?, description? }` | Update project. |
| `DELETE` | `/projects/:id` | JWT | — | Delete project. |

---

### Queues

| Method | Path | Auth | Body / Query | Description |
|--------|------|------|-------------|-------------|
| `POST` | `/projects/:projectId/queues` | JWT | `{ name, priority?, concurrencyLimit?, retryPolicyId?, maxJobDurationMs?, shardKey?, rateLimitPerSec? }` | Create queue. |
| `GET`  | `/projects/:projectId/queues` | JWT | — | List queues with job-count stats. |
| `GET`  | `/queues/:id` | JWT | — | Queue detail + full stats. |
| `PUT`  | `/queues/:id` | JWT | any subset of create body | Update queue config. |
| `POST` | `/queues/:id/pause` | JWT | — | Pause queue (workers skip it). |
| `POST` | `/queues/:id/resume` | JWT | — | Resume queue. |
| `GET`  | `/queues/:id/metrics` | JWT | — | Throughput per minute over the last hour. |

---

### Jobs

| Method | Path | Auth | Body / Query | Description |
|--------|------|------|-------------|-------------|
| `POST` | `/queues/:queueId/jobs` | JWT | `{ type, payload, priority?, scheduledAt?, cronExpression?, batchId?, idempotencyKey?, dependsOn? }` | Create job. `scheduledAt` = delayed. `cronExpression` = recurring. `dependsOn` = workflow dependency. |
| `POST` | `/queues/:queueId/jobs/batch` | JWT | Array of job specs (max 1000) | Batch create. |
| `GET`  | `/queues/:queueId/jobs` | JWT | `status?, type?, batchId?, page, limit` | List jobs with filtering. |
| `GET`  | `/jobs/:id` | JWT | — | Job detail with executions + recent logs. |
| `POST` | `/jobs/:id/retry` | JWT | — | Retry FAILED/DEAD job (reset to QUEUED). |
| `POST` | `/jobs/:id/cancel` | JWT | — | Cancel QUEUED/SCHEDULED job. |
| `GET`  | `/jobs/:id/logs` | JWT | `page, limit` | Paginated execution logs. |

---

### Worker Execution (API Key auth)

| Method | Path | Auth | Body | Description |
|--------|------|------|------|-------------|
| `POST` | `/queues/:queueId/jobs/claim` | API Key | `{ limit? }` | Atomically claim jobs (`pg_advisory_xact_lock` + `SKIP LOCKED`). Returns claimed jobs. |
| `POST` | `/jobs/:id/start` | API Key | `{}` | CLAIMED → RUNNING. Records `startedAt`, creates `JobExecution`. |
| `POST` | `/jobs/:id/complete` | API Key | `{ result?, durationMs }` | RUNNING → COMPLETED. Updates `JobExecution`. |
| `POST` | `/jobs/:id/fail` | API Key | `{ error, durationMs }` | RUNNING → FAILED or DEAD. Applies retry backoff or writes to DLQ. |

---

### Worker Lifecycle (API Key auth)

| Method | Path | Auth | Body | Description |
|--------|------|------|------|-------------|
| `POST` | `/workers/register` | API Key | `{ name, hostname, pid, concurrency, queues }` | Register worker. Returns `{ id }` used for heartbeats. |
| `POST` | `/workers/:id/heartbeat` | API Key | `{ activeJobs, cpuUsage?, memoryUsage? }` | Update `lastHeartbeatAt`, write `WorkerHeartbeat` row, set BUSY if at concurrency limit. |
| `POST` | `/workers/:id/deregister` | API Key | — | Mark worker OFFLINE on graceful shutdown. |
| `GET`  | `/workers` | JWT | — | List all workers with status. |
| `GET`  | `/workers/:id` | JWT | — | Worker detail with last 20 heartbeats. |

---

### Dead Letter Queue

| Method | Path | Auth | Query | Description |
|--------|------|------|-------|-------------|
| `GET`  | `/projects/:projectId/dlq` | JWT | `page, limit` | List DLQ entries. Auto-generates `failureSummary` via pattern-matching on first read. |
| `GET`  | `/dlq/:id` | JWT | — | Single DLQ entry with full job details and AI failure summary. |
| `POST` | `/dlq/:id/requeue` | JWT | — | Create fresh QUEUED job from dead job's payload. |

---

### Metrics

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/projects/:projectId/metrics` | JWT | Aggregate: `totalJobs`, `completedJobs`, `failedJobs`, `avgDurationMs`, `activeWorkers`, `queueHealth[]`, `throughputLastHour[]`. |
| `GET`  | `/queues/:id/metrics` | JWT | Per-queue throughput over time + status distribution. |
