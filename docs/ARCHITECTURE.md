# Distributed Job Scheduler — Architecture Document

> **Version:** 1.0.0
> **Last Updated:** 2026-07-02
> **Status:** Living Document

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Component Diagram](#2-component-diagram)
3. [Data Flow Diagrams](#3-data-flow-diagrams)
4. [Technology Stack](#4-technology-stack)
5. [Scalability Considerations](#5-scalability-considerations)
6. [Security Architecture](#6-security-architecture)
7. [Deployment Architecture](#7-deployment-architecture)

---

## 1. System Overview

The Distributed Job Scheduler is a production-grade, horizontally scalable system designed to manage, execute, and monitor asynchronous background jobs with support for retries, workflows, scheduling, and real-time observability.

### 1.1 Three-Tier Architecture

The system follows a classic **three-tier architecture** with a clear separation of concerns:

| Tier | Component | Responsibility |
|------|-----------|----------------|
| **Presentation** | React Dashboard (Vite) | User interface for job management, monitoring, and administration |
| **Application** | Express API (TypeScript) | REST API, authentication, authorization, job orchestration, WebSocket gateway |
| **Data & Execution** | PostgreSQL + Worker Service | Persistent storage, job queue, event bus, and distributed job execution |

**Key architectural principle:** The API server and Worker service are **independent processes** that communicate exclusively through PostgreSQL. This decoupling ensures that workers can scale horizontally without any coordination with the API layer, and either component can be restarted independently without affecting the other.

### 1.2 Monorepo Structure

The project is organized as an **npm workspaces monorepo** with three packages:

```
codity/
├── package.json              # Root workspace configuration
├── packages/
│   ├── api/                  # Express API server (port 3000)
│   │   ├── src/
│   │   │   ├── middleware/   # JWT auth, RBAC, rate limiter, validation, error handling
│   │   │   ├── routes/       # REST API route definitions
│   │   │   ├── services/     # Business logic layer
│   │   │   ├── socket/       # socket.io gateway for real-time updates
│   │   │   └── lib/          # Shared utilities (Prisma client, logger, config)
│   │   ├── prisma/           # Database schema, migrations, seed scripts
│   │   └── package.json
│   ├── worker/               # Worker service (background job execution)
│   │   ├── src/
│   │   │   ├── poller/       # Job polling with FOR UPDATE SKIP LOCKED
│   │   │   ├── executor/     # Job execution engine
│   │   │   ├── retry/        # Retry strategies (fixed, linear, exponential)
│   │   │   ├── heartbeat/    # Worker heartbeat emitter
│   │   │   ├── cron/         # Cron schedule evaluation and job spawning
│   │   │   ├── shard/        # Queue shard manager
│   │   │   └── lib/          # Shared utilities (Prisma client, logger, config)
│   │   └── package.json
│   └── dashboard/            # React 18 SPA (port 5173)
│       ├── src/
│       │   ├── components/   # UI components (shadcn/ui)
│       │   ├── pages/        # Route-level page components
│       │   ├── hooks/        # Custom React hooks (WebSocket, auth, data fetching)
│       │   ├── services/     # API client layer
│       │   └── stores/       # Client-side state management
│       └── package.json
└── docs/                     # Architecture and design documentation
```

### 1.3 Communication Patterns

The system leverages four distinct communication patterns:

1. **REST API** — Dashboard ↔ API for CRUD operations, authentication, and job management
2. **WebSocket (socket.io)** — API → Dashboard for real-time job status updates and metrics
3. **PostgreSQL LISTEN/NOTIFY** — Database → API/Worker for event-driven notifications on job state changes
4. **FOR UPDATE SKIP LOCKED** — Worker → Database for contention-free distributed job claiming

---

## 2. Component Diagram

```mermaid
flowchart TB
    subgraph Dashboard["Dashboard (React 18 + Vite) :5173"]
        direction TB
        UI["UI Components<br/>shadcn/ui + Tailwind CSS"]
        Pages["Pages<br/>Jobs | Workflows | Queues | Settings"]
        Hooks["Custom Hooks<br/>useSocket | useAuth | useJobs"]
        APIClient["API Client<br/>Axios + Interceptors"]
        SocketClient["Socket.IO Client<br/>Real-time Subscriptions"]
    end

    subgraph API["API Server (Express + TypeScript) :3000"]
        direction TB
        subgraph Middleware["Middleware Pipeline"]
            JWTAuth["JWT Auth<br/>Access + Refresh Tokens"]
            RBAC["RBAC Guard<br/>Org-level Roles"]
            RateLimiter["Rate Limiter<br/>100 req/min per user"]
            Validator["Input Validator<br/>Zod Schemas"]
            ErrorHandler["Error Handler<br/>Structured Error Responses"]
        end
        subgraph Services["Service Modules"]
            JobService["Job Service<br/>Create, Cancel, Query"]
            WorkflowService["Workflow Service<br/>DAG Validation, Orchestration"]
            QueueService["Queue Service<br/>CRUD, Sharding Config"]
            AuthService["Auth Service<br/>Login, Register, Token Refresh"]
            MetricsService["Metrics Service<br/>Aggregation, Throughput"]
            ScheduleService["Schedule Service<br/>Cron Expression Parsing"]
        end
        subgraph Realtime["Real-time Layer"]
            SocketGateway["Socket.IO Gateway<br/>Room-based Broadcasts"]
            PGListener["PG LISTEN Handler<br/>Channel Subscriptions"]
        end
    end

    subgraph DB["PostgreSQL 17"]
        direction TB
        subgraph CoreTables["Core Tables"]
            JobsTable["jobs<br/>id, queue, status, payload, result"]
            QueuesTable["queues<br/>id, name, shard_key, concurrency"]
            WorkflowsTable["workflows<br/>id, name, dag_edges"]
        end
        subgraph AuthTables["Auth Tables"]
            UsersTable["users<br/>id, email, password_hash"]
            OrgsTable["organizations<br/>id, name, plan"]
            RolesTable["org_memberships<br/>user_id, org_id, role"]
        end
        subgraph SystemTables["System Tables"]
            DLQTable["dead_letter_queue<br/>original_job, failure_reason"]
            WorkerReg["worker_registrations<br/>id, last_heartbeat, shard"]
            AuditLog["audit_log<br/>actor, action, resource"]
        end
        PGNotify["LISTEN/NOTIFY Channels<br/>job_status_changed<br/>workflow_step_completed"]
    end

    subgraph Worker["Worker Service(s)"]
        direction TB
        JobPoller["Job Poller<br/>FOR UPDATE SKIP LOCKED<br/>poll_interval: 1000ms"]
        JobExecutor["Job Executor<br/>Sandboxed Execution<br/>concurrency: 5"]
        HeartbeatEmitter["Heartbeat Emitter<br/>interval: 15s<br/>stale_timeout: 60s"]
        RetryEngine["Retry Engine<br/>Fixed | Linear | Exponential+Jitter"]
        CronScheduler["Cron Scheduler<br/>Schedule Evaluation & Spawning"]
        ShardManager["Shard Manager<br/>Queue Assignment & Rebalancing"]
    end

    %% Dashboard to API
    APIClient -->|"REST API (HTTPS)"| Middleware
    SocketClient <-->|"WebSocket (socket.io)"| SocketGateway

    %% API internal flow
    Middleware --> Services
    Services --> DB
    PGListener -->|"LISTEN/NOTIFY"| PGNotify
    SocketGateway -->|"Broadcasts job updates"| SocketClient

    %% Worker to DB
    JobPoller -->|"SELECT ... FOR UPDATE SKIP LOCKED"| JobsTable
    JobExecutor -->|"UPDATE status, result"| JobsTable
    HeartbeatEmitter -->|"UPDATE last_heartbeat"| WorkerReg
    RetryEngine -->|"INSERT retry / INSERT DLQ"| JobsTable
    RetryEngine -->|"Permanent failures"| DLQTable
    CronScheduler -->|"INSERT scheduled jobs"| JobsTable
    ShardManager -->|"READ shard assignments"| QueuesTable

    %% PG Notify triggers
    JobsTable -.->|"NOTIFY job_status_changed"| PGNotify
    WorkflowsTable -.->|"NOTIFY workflow_step_completed"| PGNotify

    style Dashboard fill:#1a1a2e,stroke:#e94560,color:#ffffff
    style API fill:#16213e,stroke:#0f3460,color:#ffffff
    style DB fill:#0f3460,stroke:#533483,color:#ffffff
    style Worker fill:#1a1a2e,stroke:#e94560,color:#ffffff
    style Middleware fill:#16213e,stroke:#e94560,color:#ffffff
    style Services fill:#16213e,stroke:#533483,color:#ffffff
    style Realtime fill:#16213e,stroke:#0f3460,color:#ffffff
```

---

## 3. Data Flow Diagrams

### 3.1 Job Creation Flow

```mermaid
sequenceDiagram
    actor User
    participant Dashboard
    participant API as API Server
    participant DB as PostgreSQL
    participant WS as Socket.IO

    User->>Dashboard: Click "Create Job"
    Dashboard->>API: POST /api/jobs<br/>{queue, type, payload, priority}
    
    Note over API: Middleware Pipeline
    API->>API: JWT Auth → RBAC → Rate Limit → Validate

    API->>DB: BEGIN TRANSACTION
    API->>DB: Validate queue exists & user has access
    API->>DB: INSERT INTO jobs (queue_id, type, payload,<br/>status='PENDING', priority, max_retries)
    DB-->>API: job record created

    alt Job is part of a workflow
        API->>DB: INSERT INTO workflow_steps<br/>(workflow_id, job_id, dependencies)
        API->>DB: Validate DAG (no cycles)
    end

    API->>DB: COMMIT
    DB->>DB: Trigger NOTIFY 'job_status_changed'<br/>payload: {job_id, status: 'PENDING'}
    
    API-->>Dashboard: 201 Created {job}
    Dashboard-->>User: Show job in list

    Note over DB,WS: Async Notification Path
    DB-->>API: NOTIFY event received
    API->>WS: Broadcast to room<br/>"queue:{queue_id}"
    WS-->>Dashboard: job:created event
    Dashboard->>Dashboard: Update job list in real-time
```

### 3.2 Job Claiming Flow (FOR UPDATE SKIP LOCKED)

```mermaid
sequenceDiagram
    participant W1 as Worker 1
    participant W2 as Worker 2
    participant W3 as Worker 3
    participant DB as PostgreSQL

    Note over W1,DB: Multiple workers poll concurrently (every 1000ms)

    par Concurrent Polling
        W1->>DB: BEGIN
        W1->>DB: SELECT * FROM jobs<br/>WHERE status = 'PENDING'<br/>AND queue_id IN (assigned_shards)<br/>AND scheduled_at <= NOW()<br/>ORDER BY priority DESC, created_at ASC<br/>LIMIT 5<br/>FOR UPDATE SKIP LOCKED
        
    and
        W2->>DB: BEGIN
        W2->>DB: SELECT * FROM jobs<br/>WHERE status = 'PENDING'<br/>...<br/>FOR UPDATE SKIP LOCKED
        
    and
        W3->>DB: BEGIN
        W3->>DB: SELECT * FROM jobs<br/>WHERE status = 'PENDING'<br/>...<br/>FOR UPDATE SKIP LOCKED
    end

    Note over DB: PostgreSQL locks rows for W1,<br/>W2 & W3 SKIP those locked rows<br/>and claim different jobs

    DB-->>W1: Returns jobs [A, B, C]
    DB-->>W2: Returns jobs [D, E]
    DB-->>W3: Returns jobs [F]

    W1->>DB: UPDATE jobs SET status = 'RUNNING',<br/>worker_id = 'w1', started_at = NOW()<br/>WHERE id IN (A, B, C)
    W1->>DB: COMMIT

    W2->>DB: UPDATE jobs SET status = 'RUNNING',<br/>worker_id = 'w2', started_at = NOW()<br/>WHERE id IN (D, E)
    W2->>DB: COMMIT

    W3->>DB: UPDATE jobs SET status = 'RUNNING',<br/>worker_id = 'w3', started_at = NOW()<br/>WHERE id IN (F)
    W3->>DB: COMMIT

    Note over W1,W3: Zero contention — no duplicate processing
```

### 3.3 Retry Flow

```mermaid
sequenceDiagram
    participant Worker
    participant RetryEngine as Retry Engine
    participant DB as PostgreSQL
    participant DLQ as Dead Letter Queue

    Worker->>Worker: Execute job
    Worker->>Worker: Job FAILS (exception thrown)

    Worker->>RetryEngine: Handle failure(job, error)
    RetryEngine->>DB: Read job.retry_count,<br/>job.max_retries, job.retry_strategy

    alt retry_count < max_retries
        RetryEngine->>RetryEngine: Calculate next_run_at based on strategy

        Note over RetryEngine: Strategy Calculations:<br/>Fixed: delay = base_delay<br/>Linear: delay = base_delay × attempt<br/>Exponential: delay = base_delay × 2^attempt<br/>+ random jitter (0–500ms)

        RetryEngine->>DB: UPDATE jobs SET<br/>status = 'PENDING',<br/>retry_count = retry_count + 1,<br/>scheduled_at = NOW() + delay,<br/>last_error = error_message
        DB-->>RetryEngine: Updated

        Note over DB: Job re-enters the queue<br/>and will be picked up after delay

    else retry_count >= max_retries
        RetryEngine->>DB: UPDATE jobs SET<br/>status = 'DEAD',<br/>completed_at = NOW()

        RetryEngine->>DLQ: INSERT INTO dead_letter_queue<br/>(job_id, original_payload, failure_reason,<br/>total_attempts, last_error, died_at)
        DLQ-->>RetryEngine: DLQ entry created

        Note over DLQ: Permanent failure.<br/>Available for manual inspection<br/>and retry from Dashboard.
    end

    DB->>DB: NOTIFY 'job_status_changed'
```

### 3.4 Workflow Dependency Flow

```mermaid
sequenceDiagram
    participant User
    participant API as API Server
    participant DB as PostgreSQL
    participant Worker
    participant WFEngine as Workflow Engine

    User->>API: POST /api/workflows<br/>{name, steps: [{job, dependsOn}]}

    API->>API: Build adjacency list from steps
    API->>API: DAG Validation (topological sort)<br/>Reject if cycle detected

    API->>DB: INSERT workflow + steps<br/>Mark root steps (no dependencies) as PENDING<br/>Mark dependent steps as BLOCKED

    Note over DB: Initial State:<br/>Step A: PENDING (root)<br/>Step B: PENDING (root)<br/>Step C: BLOCKED (depends on A, B)<br/>Step D: BLOCKED (depends on C)

    Worker->>DB: Claim Step A (FOR UPDATE SKIP LOCKED)
    Worker->>Worker: Execute Step A
    Worker->>DB: UPDATE Step A → COMPLETED

    DB->>DB: NOTIFY 'workflow_step_completed'
    DB-->>API: Notification received

    API->>WFEngine: Evaluate dependencies for Step C
    WFEngine->>DB: SELECT * FROM workflow_steps<br/>WHERE workflow_id = ? AND id IN (A, B)
    DB-->>WFEngine: Step A = COMPLETED, Step B = RUNNING

    Note over WFEngine: Step C stays BLOCKED<br/>(Step B not yet complete)

    Worker->>DB: Step B → COMPLETED
    DB->>DB: NOTIFY 'workflow_step_completed'

    API->>WFEngine: Re-evaluate Step C
    WFEngine->>DB: Check dependencies: A ✓, B ✓
    WFEngine->>DB: UPDATE Step C → PENDING<br/>(all dependencies satisfied)

    Worker->>DB: Claim & execute Step C
    Worker->>DB: Step C → COMPLETED

    WFEngine->>DB: UPDATE Step D → PENDING
    Worker->>DB: Claim & execute Step D
    Worker->>DB: Step D → COMPLETED

    WFEngine->>DB: All steps complete<br/>UPDATE workflow SET status = 'COMPLETED'
```

### 3.5 WebSocket Update Flow

```mermaid
sequenceDiagram
    participant Dashboard as Dashboard (Browser)
    participant SocketIO as Socket.IO Server
    participant PGListen as PG LISTEN Handler
    participant DB as PostgreSQL
    participant Worker

    Note over Dashboard,SocketIO: Connection Setup
    Dashboard->>SocketIO: Connect with JWT token
    SocketIO->>SocketIO: Verify JWT, extract user/org
    SocketIO->>SocketIO: Join rooms:<br/>"org:{org_id}"<br/>"queue:{queue_id}"
    SocketIO-->>Dashboard: Connected + room assignments

    Note over DB,Worker: Job Processing
    Worker->>DB: UPDATE jobs SET status = 'RUNNING'
    DB->>DB: Trigger function fires<br/>NOTIFY 'job_status_changed',<br/>payload: '{"id":"x","status":"RUNNING","queue_id":"q1"}'

    PGListen->>DB: Subscribed to 'job_status_changed'
    DB-->>PGListen: Notification received

    PGListen->>PGListen: Parse payload, determine target rooms
    PGListen->>SocketIO: Emit to room "queue:q1"
    SocketIO-->>Dashboard: Event: "job:updated"<br/>{id, status: "RUNNING", started_at}

    Dashboard->>Dashboard: React state update<br/>Job row animates to "Running"

    Note over DB,Worker: Job Completion
    Worker->>DB: UPDATE jobs SET<br/>status = 'COMPLETED', result = '{...}'
    DB-->>PGListen: NOTIFY with COMPLETED status

    PGListen->>SocketIO: Emit to room "queue:q1"
    SocketIO-->>Dashboard: Event: "job:updated"<br/>{id, status: "COMPLETED", result}

    Dashboard->>Dashboard: Update UI + show success toast

    Note over Dashboard,SocketIO: Metrics Stream
    SocketIO->>Dashboard: Event: "metrics:update"<br/>{throughput, pending_count, active_workers}
    Dashboard->>Dashboard: Update dashboard charts
```

---

## 4. Technology Stack

### 4.1 Core Technologies

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Runtime** | Node.js | 20 LTS | Server-side JavaScript runtime |
| **Language** | TypeScript | 5.x | Type-safe development across all packages |
| **Database** | PostgreSQL | 17 | Primary data store, job queue, event bus |
| **ORM** | Prisma | Latest | Type-safe database access, migrations, schema management |

### 4.2 API Server

| Technology | Purpose |
|-----------|---------|
| Express.js | HTTP framework, routing, middleware pipeline |
| socket.io | WebSocket server for real-time bidirectional communication |
| jsonwebtoken | JWT access & refresh token generation and verification |
| bcrypt | Password hashing with salt rounds |
| Zod | Runtime input validation and schema parsing |
| pino | Structured JSON logging with request correlation |
| express-rate-limit | Per-user rate limiting (100 req/min) |
| helmet | Security headers (CSP, HSTS, X-Frame-Options) |
| cors | Cross-origin resource sharing configuration |
| cron-parser | Cron expression parsing and next-run calculation |

### 4.3 Worker Service

| Technology | Purpose |
|-----------|---------|
| Prisma Client | Database queries with `FOR UPDATE SKIP LOCKED` via raw SQL |
| pino | Structured logging consistent with API server |
| node-cron / cron-parser | Cron schedule evaluation |
| Custom Retry Engine | Fixed, linear, and exponential backoff with jitter |

### 4.4 Dashboard

| Technology | Purpose |
|-----------|---------|
| React 18 | UI component library with concurrent features |
| Vite | Build tool and dev server (port 5173) |
| Tailwind CSS | Utility-first CSS framework |
| shadcn/ui | Accessible, customizable component library |
| socket.io-client | WebSocket client for real-time updates |
| React Router | Client-side routing |
| TanStack Query | Server state management, caching, and synchronization |
| Recharts / Nivo | Dashboard charting and visualization |
| Axios | HTTP client with interceptor support for auth |

### 4.5 Development & Testing

| Technology | Purpose |
|-----------|---------|
| Vitest | Unit and integration testing framework |
| npm workspaces | Monorepo package management |
| ESLint + Prettier | Code quality and formatting |
| Docker + Docker Compose | Containerized development and deployment |
| GitHub Actions | CI/CD pipeline |

---

## 5. Scalability Considerations

### 5.1 Horizontal Worker Scaling

Workers are designed to be **stateless** and **independently scalable**:

- **No shared state:** Each worker instance connects directly to PostgreSQL. There is no inter-worker communication or leader election required.
- **`FOR UPDATE SKIP LOCKED`:** This PostgreSQL feature ensures that concurrent workers claiming jobs from the same queue never process the same job, eliminating the need for external distributed locks (Redis, Zookeeper).
- **Concurrency control:** Each worker runs up to `concurrency: 5` jobs simultaneously using an in-process semaphore. Scale by adding more worker instances.
- **Heartbeat monitoring:** Workers emit heartbeats every `15s`. If a worker goes silent for `60s` (stale timeout), its in-progress jobs are reclaimed and re-queued by other workers.

```
Throughput ≈ num_workers × concurrency × (1 / avg_job_duration)
Example: 10 workers × 5 concurrency × (1 / 2s) = 25 jobs/sec
```

### 5.2 Queue Sharding

For high-throughput deployments, queues can be **sharded** to distribute load:

| Strategy | Description |
|----------|-------------|
| **Key-based sharding** | Jobs are assigned to shards via a consistent hash of their queue name or a custom shard key |
| **Worker affinity** | Each worker registers the shard(s) it is responsible for, ensuring targeted polling |
| **Dynamic rebalancing** | When workers join or leave, the shard manager redistributes shard assignments to maintain even load |

```
Queue: "email-notifications"
  ├── Shard 0 → Worker A, Worker B
  ├── Shard 1 → Worker C, Worker D
  └── Shard 2 → Worker E, Worker F
```

### 5.3 Connection Pooling

| Component | Pool Size | Notes |
|-----------|-----------|-------|
| API Server | 10–20 connections | Shared across all request handlers via Prisma |
| Worker (per instance) | 5–10 connections | Matches concurrency setting; one connection per active job |
| PG LISTEN | 1 dedicated connection | Long-lived connection for LISTEN/NOTIFY per subscriber |

> [!TIP]
> Use PgBouncer in `transaction` mode for the API server to handle connection multiplexing across a large number of concurrent HTTP requests. Workers should connect directly to PostgreSQL (not through PgBouncer) because `FOR UPDATE SKIP LOCKED` requires real transactions.

### 5.4 Index Strategy

Critical indexes for query performance:

```sql
-- Job claiming: the hot path for workers
CREATE INDEX idx_jobs_claimable ON jobs (queue_id, status, scheduled_at, priority DESC, created_at ASC)
  WHERE status = 'PENDING';

-- Job lookups by workflow
CREATE INDEX idx_jobs_workflow ON jobs (workflow_id, status);

-- Stale worker detection
CREATE INDEX idx_workers_heartbeat ON worker_registrations (last_heartbeat)
  WHERE status = 'ACTIVE';

-- DLQ browsing
CREATE INDEX idx_dlq_queue ON dead_letter_queue (queue_id, died_at DESC);

-- Audit log queries
CREATE INDEX idx_audit_org ON audit_log (org_id, created_at DESC);
```

### 5.5 Performance Targets

| Metric | Target |
|--------|--------|
| Job claim latency (p99) | < 50ms |
| Job creation API (p99) | < 100ms |
| WebSocket delivery latency | < 200ms |
| Dashboard page load (LCP) | < 1.5s |
| Worker polling overhead | < 5% CPU at idle |

---

## 6. Security Architecture

### 6.1 JWT Authentication Flow

```
┌──────────┐     POST /auth/login       ┌──────────┐
│ Dashboard │ ──────────────────────────→ │   API    │
│           │ ← access_token (15min)     │  Server  │
│           │   refresh_token (7d, httpOnly cookie)  │
└──────────┘                             └──────────┘
      │                                        │
      │  Authorization: Bearer <access_token>  │
      │ ──────────────────────────────────────→ │
      │                                        │
      │  Token expired (401)                   │
      │ ←────────────────────────────────────── │
      │                                        │
      │  POST /auth/refresh (httpOnly cookie)  │
      │ ──────────────────────────────────────→ │
      │  ← new access_token + rotated refresh  │
      │                                        │
```

| Token | Lifetime | Storage | Purpose |
|-------|----------|---------|---------|
| Access Token | 15 minutes | Memory (JS variable) | API authentication |
| Refresh Token | 7 days | httpOnly, Secure, SameSite cookie | Silent token renewal |

**Security measures:**
- Refresh token rotation on every use (previous token invalidated)
- Token family tracking to detect refresh token theft
- All tokens signed with RS256 (asymmetric keys)
- Logout invalidates all tokens in the family

### 6.2 RBAC Model

The system implements **organization-level Role-Based Access Control**:

| Role | Permissions |
|------|------------|
| **Owner** | Full access: manage org, members, all queues, all jobs, settings |
| **Admin** | Manage queues, jobs, view all members, cannot delete org |
| **Member** | Create and manage own jobs, view queue status, cannot manage members |
| **Viewer** | Read-only access to job statuses and dashboard metrics |

**Implementation:**
- Roles are stored in the `org_memberships` join table (`user_id`, `org_id`, `role`)
- The RBAC middleware extracts the user's role from the JWT claims and validates against route-level permission requirements
- Resource-level authorization ensures users can only access jobs and queues within their organization

### 6.3 Rate Limiting

| Scope | Limit | Window | Response |
|-------|-------|--------|----------|
| Per user (authenticated) | 100 requests | 1 minute | 429 Too Many Requests |
| Per IP (unauthenticated) | 20 requests | 1 minute | 429 Too Many Requests |
| Login endpoint | 5 attempts | 5 minutes | 429 + temporary lockout |

Rate limit state is tracked in-memory with a sliding window counter. For multi-instance deployments, a shared Redis store can be used.

### 6.4 Input Validation

All API inputs are validated using **Zod schemas** before reaching the service layer:

- **Request body:** Validated against typed schemas with strict mode (no extra properties)
- **Query parameters:** Parsed and coerced to correct types
- **Path parameters:** Validated for format (UUIDs, etc.)
- **Payload size:** Limited to 1MB per request
- **SQL injection:** Prevented by Prisma's parameterized queries
- **XSS:** Output encoding and CSP headers via Helmet

---

## 7. Deployment Architecture

### 7.1 Docker Compose Topology

```yaml
# Simplified deployment overview
services:
  postgres:
    image: postgres:17-alpine
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: pg_isready -U scheduler
      interval: 5s

  api:
    build: ./packages/api
    ports: ["3000:3000"]
    depends_on:
      postgres: { condition: service_healthy }
    environment:
      - DATABASE_URL=postgresql://scheduler:***@postgres:5432/scheduler
      - JWT_SECRET=...
      - NODE_ENV=production

  worker:
    build: ./packages/worker
    depends_on:
      postgres: { condition: service_healthy }
    deploy:
      replicas: 3    # Scale horizontally
    environment:
      - DATABASE_URL=postgresql://scheduler:***@postgres:5432/scheduler
      - WORKER_CONCURRENCY=5
      - POLL_INTERVAL_MS=1000
      - HEARTBEAT_INTERVAL_MS=15000
      - STALE_TIMEOUT_MS=60000

  dashboard:
    build: ./packages/dashboard
    ports: ["5173:80"]
    depends_on: [api]
```

### 7.2 Environment Configuration

| Variable | Component | Default | Description |
|----------|-----------|---------|-------------|
| `DATABASE_URL` | API, Worker | — | PostgreSQL connection string |
| `PORT` | API | `3000` | API server listen port |
| `JWT_ACCESS_SECRET` | API | — | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | API | — | Secret for signing refresh tokens |
| `CORS_ORIGIN` | API | `http://localhost:5173` | Allowed CORS origin |
| `WORKER_CONCURRENCY` | Worker | `5` | Max concurrent jobs per worker |
| `POLL_INTERVAL_MS` | Worker | `1000` | Job polling interval in ms |
| `HEARTBEAT_INTERVAL_MS` | Worker | `15000` | Heartbeat emission interval |
| `STALE_TIMEOUT_MS` | Worker | `60000` | Time before a worker is considered stale |
| `RATE_LIMIT_MAX` | API | `100` | Max requests per rate limit window |
| `RATE_LIMIT_WINDOW_MS` | API | `60000` | Rate limit window duration |
| `LOG_LEVEL` | API, Worker | `info` | pino log level |
| `NODE_ENV` | All | `development` | Environment mode |

### 7.3 Health Checks

Each component exposes health check endpoints for orchestrator liveness and readiness probes:

| Component | Endpoint | Checks |
|-----------|----------|--------|
| **API Server** | `GET /health/live` | Process is running |
| **API Server** | `GET /health/ready` | Database connection active, migrations applied |
| **Worker** | Heartbeat to `worker_registrations` | Worker is alive and processing |
| **PostgreSQL** | `pg_isready` | Database accepts connections |
| **Dashboard** | HTTP 200 on `/` | Static assets served correctly |

### 7.4 Observability

| Concern | Implementation |
|---------|---------------|
| **Structured logging** | pino with JSON output, request IDs, correlation IDs |
| **Request tracing** | Unique `x-request-id` header propagated through all layers |
| **Metrics** | Custom `/metrics` endpoint exposing job throughput, queue depth, error rates |
| **Alerting** | DLQ growth rate, worker stale count, error rate spikes |

---

> [!NOTE]
> This document is maintained alongside the codebase. Update it when architectural decisions change.
