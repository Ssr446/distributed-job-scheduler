# Distributed Job Scheduler

A robust, multi-tenant distributed job scheduling platform designed for fault tolerance and high concurrency. The system coordinates atomic job claiming via advisory locks, enforces resilient state transitions, supports configurable exponential backoff and jitter for retries, and maintains a strict Dead Letter Queue (DLQ) for exhausted jobs. It ships with a real-time WebSocket dashboard for observability and control, alongside a horizontally scalable worker daemon.

![NodeJS](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?style=flat-square&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat-square&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)

---

## Architecture Flow

The traffic is cleanly partitioned: **Workers** interact exclusively with internal claim/state APIs via cryptographically hashed API keys, while **Dashboard users** authenticate via secure `httpOnly` cookies protected by strict CSRF middleware.

```mermaid
sequenceDiagram
    participant D as Dashboard
    participant A as API Server
    participant DB as PostgreSQL
    participant W as Worker Daemon

    Note over D, A: Dashboard Flow (Cookie + CSRF)
    D->>A: POST /api/v1/queues/:id/jobs (Create Job)
    A->>DB: INSERT INTO jobs (status: QUEUED)
    A-->>D: Job Created

    Note over W, DB: Core Execution Cycle (API Key)
    loop Polling (or trigger)
        W->>A: POST /api/v1/queues/:id/jobs/claim
        A->>DB: pg_advisory_xact_lock() + FOR UPDATE SKIP LOCKED
        DB-->>A: Atomic return of claimed jobs
        A-->>W: List of jobs (status: CLAIMED)
        
        W->>A: POST /api/v1/jobs/:id/start
        A->>DB: UPDATE jobs SET status = 'RUNNING'
        A-->>W: Acknowledged

        Note right of W: Worker executes task...

        alt Success
            W->>A: POST /api/v1/jobs/:id/complete
            A->>DB: UPDATE jobs SET status = 'COMPLETED'
        else Failure
            W->>A: POST /api/v1/jobs/:id/fail
            A->>DB: Check attempt < maxRetries
            alt Can Retry
                DB-->>A: Set status = 'QUEUED', nextRetryAt
            else Exhausted
                DB-->>A: Set status = 'DEAD', Insert to DLQ
            end
        end
    end
    
    Note over A, D: Observability
    DB-->>A: Prisma Triggers / Service Events
    A->>D: WebSocket Event (job.started, job.completed, etc.)
```

## Key Features

### Job Lifecycle & Reliability
- **Atomic Claiming:** Prevents race conditions during high-concurrency claiming using Postgres transaction-level advisory locks combined with `FOR UPDATE SKIP LOCKED`.
- **Idempotent State Machine:** Enforces strict directional state transitions (`QUEUED` → `CLAIMED` → `RUNNING` → `COMPLETED`/`FAILED`/`DEAD`), rejecting out-of-order execution attempts.
- **Resilient Retries:** Configurable per-queue retry policies featuring linear or exponential backoff, automatically jittered to prevent thundering herd problems.
- **Dead Letter Queue (DLQ):** Automatically cascades chronically failing jobs into a traceable DLQ, preventing bad tasks from poisoning queues infinitely.

### Auth & Security
- **Hardened User Auth:** JWTs stored securely in `httpOnly` cookies with strict SameSite policies, accompanied by mandatory Origin/Referer CSRF validation for all dashboard traffic.
- **API Key Segregation:** Worker traffic bypasses generic middlewares, verifying securely hashed API keys with `crypto.timingSafeEqual` to thwart timing attacks.
- **Role-Based Access Control:** Explicit org-level and project-level ownership checks preventing unauthorized cross-tenant job mutation or queue manipulation.
- **Token Rotation & Revocation:** Built-in JWT revocation tracking using `jti` to immediately invalidate compromised sessions.

### Observability
- **Worker Heartbeats:** Granular tracking of worker health, CPU/memory usage, and active job concurrency.
- **Execution Logging:** Per-job execution tracing and granular event logging stored directly alongside the job history.
- **Real-Time Dashboards:** End-to-end WebSocket integration broadcasting state mutations directly to scoped project channels.

---

## Entity-Relationship Diagram

```mermaid
erDiagram
    User ||--o{ OrgMembership : "has"
    User ||--o{ Project : "creates"
    Organization ||--o{ OrgMembership : "has"
    Organization ||--o{ Project : "owns"
    Project ||--o{ Queue : "contains"
    Project ||--o{ RetryPolicy : "defines"
    Queue ||--o| RetryPolicy : "uses"
    Queue ||--o{ Job : "holds"
    Queue ||--o{ DeadLetterQueue : "collects"
    Job ||--o| Worker : "claimedBy"
    Job ||--o{ JobExecution : "records"
    Job ||--o{ JobLog : "logs"
    Job ||--o{ DeadLetterQueue : "failsInto"
    Job ||--o| ScheduledJob : "scheduledAs"
    Job ||--o{ JobDependency : "dependsOn"
    Job ||--o{ JobDependency : "dependencyOf"
    Worker ||--o{ JobExecution : "executes"
    Worker ||--o{ WorkerHeartbeat : "emits"
    Worker ||--o{ ApiKey : "authenticatesWith"

    User {
        String id PK
        String email UK
        String passwordHash
        String name
        USER_ROLE role
        DateTime createdAt
        DateTime updatedAt
    }
    Organization {
        String id PK
        String name
        String slug UK
        DateTime createdAt
    }
    OrgMembership {
        String userId PK
        String orgId PK
        ORG_ROLE role
    }
    Project {
        String id PK
        String orgId FK
        String name
        String description
        String createdById FK
        DateTime createdAt
    }
    RetryPolicy {
        String id PK
        String projectId FK
        String name
        RETRY_STRATEGY strategy
        Int maxRetries
        Int initialDelayMs
        Int maxDelayMs
        Float backoffMultiplier
    }
    Queue {
        String id PK
        String projectId FK
        String name
        Int priority
        Int concurrencyLimit
        String retryPolicyId FK
        Boolean isPaused
        Int maxJobDurationMs
        String shardKey
        Int rateLimitPerSec
        DateTime createdAt
        DateTime updatedAt
    }
    Job {
        String id PK
        String queueId FK
        String type
        Json payload
        JOB_STATUS status
        Int priority
        DateTime scheduledAt
        String cronExpression
        String batchId
        Int attempt
        Int maxRetries
        RETRY_STRATEGY retryStrategy
        Int retryDelayMs
        Json result
        String error
        String claimedById FK
        DateTime claimedAt
        DateTime startedAt
        DateTime completedAt
        DateTime nextRetryAt
        String idempotencyKey UK
        DateTime createdAt
        DateTime updatedAt
    }
    JobExecution {
        String id PK
        String jobId FK
        String workerId FK
        Int attempt
        EXECUTION_STATUS status
        DateTime startedAt
        DateTime completedAt
        Int durationMs
        Json result
        String error
        String errorStack
    }
    Worker {
        String id PK
        String name
        String hostname
        Int pid
        WORKER_STATUS status
        Int concurrency
        Int activeJobs
        String[] queues
        DateTime lastHeartbeatAt
        DateTime registeredAt
        DateTime deregisteredAt
    }
    WorkerHeartbeat {
        String id PK
        String workerId FK
        DateTime timestamp
        Int activeJobs
        Float cpuUsage
        Float memoryUsage
    }
    JobLog {
        String id PK
        String jobId FK
        LOG_LEVEL level
        String message
        Json metadata
        DateTime timestamp
    }
    DeadLetterQueue {
        String id PK
        String jobId FK
        String queueId FK
        String reason
        String failureSummary
        DateTime failedAt
        Int retryCount
        String lastError
        Boolean requeued
        DateTime requeuedAt
    }
    ScheduledJob {
        String id PK
        String jobId FK
        String cronExpression
        DateTime nextRunAt
        DateTime lastRunAt
        Boolean isActive
        String timezone
    }
    JobDependency {
        String id PK
        String jobId FK
        String dependsOnJobId FK
    }
    RevokedToken {
        String id PK
        String jti UK
        DateTime revokedAt
        DateTime expiresAt
    }
    ApiKey {
        String id PK
        String keyHash
        String name
        String workerId FK
        DateTime createdAt
        DateTime revokedAt
    }
```

---

## Getting Started

### Prerequisites
- Node.js >= 18
- PostgreSQL 15+ (if running locally)
- Docker & Docker Compose (optional but recommended)

### Quick Start (Docker Compose)

The easiest way to boot the full stack is via Docker.

1. **Configure Environment:**
   ```bash
   cp .env.example .env
   ```

2. **Boot the Database:**
   ```bash
   docker-compose up -d postgres
   ```

3. **Migrate and Seed:**
   Run migrations and seed the database to generate your default organization, project, admin user, and the worker API key.
   ```bash
   npm run db:migrate -w packages/api
   npm run db:seed -w packages/api
   ```
   > [!IMPORTANT]
   > The seed script will print a generated `WORKER_API_KEY` to your console. Copy this value and add it to your `.env` file under `WORKER_API_KEY=...`

4. **Boot the Stack:**
   ```bash
   docker-compose up --build
   ```
   - **Dashboard:** `http://localhost:8080` (Log in with `admin@codity.local` / `Admin123!`)
   - **API:** `http://localhost:3000`

### Local Development (Manual)

If you prefer to run services natively:

1. Copy `.env.example` to `.env`. Ensure your local PostgreSQL is running and update `DATABASE_URL` if needed.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Initialize the database:
   ```bash
   npm run db:migrate -w packages/api
   npm run db:seed -w packages/api
   ```
4. Update `.env` with the generated `WORKER_API_KEY`.
5. Run the services in separate terminals:
   - **API Server:** `npm run dev -w packages/api`
   - **Worker Daemon:** `npm run dev -w packages/worker`
   - **Dashboard:** `npm run dev -w packages/dashboard`

---

## Project Structure

This is a monolithic monorepo structured via NPM workspaces:

- `packages/api` — Express.js server, Prisma ORM, Socket.io server, and core business logic.
- `packages/worker` — Standalone Node.js daemon that connects to the API via securely hashed API keys, polling queues and executing jobs.
- `packages/dashboard` — React + Vite SPA using TailwindCSS, Zustand for state, and Recharts for visualization.

---

## API Reference & Usage

For full architectural context and reasoning on design decisions (like why advisory locks were chosen over pure row-locks), see [ARCHITECTURE.md](./ARCHITECTURE.md).

### Example: Core Lifecycle Execution

**1. Create a Job**
```bash
curl -X POST http://localhost:3000/api/v1/queues/<QUEUE_ID>/jobs \
  -H "Cookie: accessToken=<YOUR_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"type": "video_encode", "payload": {"file": "vid.mp4"}}'
```

**2. Claim the Job (Worker Only)**
```bash
curl -X POST http://localhost:3000/api/v1/queues/<QUEUE_ID>/jobs/claim \
  -H "Authorization: Bearer <YOUR_WORKER_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"limit": 1}'
```

**3. Complete the Job (Worker Only)**
```bash
curl -X POST http://localhost:3000/api/v1/jobs/<JOB_ID>/complete \
  -H "Authorization: Bearer <YOUR_WORKER_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"result": {"status": "success"}, "durationMs": 1200}'
```

---

## Testing

The API package includes a robust integration testing suite ensuring the resilience of the state machine.
Run tests via:
```bash
npm run test -w packages/api
```

The suite covers:
- **Idempotency:** Re-claiming or double-completing jobs fails gracefully.
- **RBAC:** Cross-tenant ownership checks explicitly reject unauthorized pause, resume, cancel, or retry attempts.
- **Queue Pausing:** Validates that paused queues do not yield jobs to workers during `SKIP LOCKED` queries.
- **DLQ Exhaustion:** Confirms that jobs strictly transition to `DEAD` after exceeding their queue's configured maximum retries.

---

## Known Limitations / Roadmap

- **Stale `RUNNING` Job Reaper:** If a worker hard-crashes mid-execution, the job is left stranded in the `RUNNING` state. A heartbeat-based reaper sweep is planned but not yet implemented.
- **Distributed Concurrency Enforcement:** Queue concurrency limits (`concurrencyLimit`) currently operate strictly per-worker-process. Global cross-worker concurrency limiting requires a centralized mechanism (e.g., Redis).
- **Telemetry Export:** No OpenTelemetry or Prometheus integration is currently active. Observability relies entirely on the WebSocket dashboard and PostgreSQL-backed job logs.
