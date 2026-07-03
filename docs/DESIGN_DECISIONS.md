# Design Decisions

## 1. Why PostgreSQL for the Queue?
While Redis is typically used for distributed job queues (e.g., BullMQ, Sidekiq), we chose PostgreSQL for this implementation for the following reasons:
1. **ACID Guarantees**: Complete transactional safety when creating massive batches of jobs or resolving complex DAG workflows.
2. **Simplified Infrastructure**: A single persistence layer reduces the operational burden of managing both a relational DB (for auth/tenancy) and a key-value store (for jobs).
3. **Complex Queries**: PostgreSQL enables deep relational queries (e.g., fetching a job, its execution logs, its dependencies, and the worker assigned in a single query).

To mitigate the performance drawbacks of a DB-backed queue, we leverage:
- Indexes on `(queueId, status, priority, createdAt)`
- Postgres 9.5+ `SELECT ... FOR UPDATE SKIP LOCKED` logic (via Prisma) to allow highly concurrent worker polling without deadlocks.

## 2. Event-Driven Architecture
The backend uses a Node.js `EventEmitter` (EventBus) internally. When a REST endpoint or a worker alters job state, it emits an event. The WebSocket handler listens to this internal bus and broadcasts to connected clients.
- **Benefit**: Decouples the REST controllers from the WebSocket server, improving testability and modularity.

## 3. Workflow Dependency Resolution
Job dependencies are modeled as a directed acyclic graph (DAG) via the `JobDependency` join table. 
Instead of a cron-like polling mechanism to check if dependencies are met, the system uses an event-driven hook in the `workflows` module. When a job transitions to `COMPLETED`, the system immediately resolves dependents and transitions them from `WAITING` to `QUEUED` atomically.

## 4. Security & Tokens
We implement **Refresh Token Rotation**. Access tokens are short-lived (15 minutes). Refresh tokens are long-lived but are strictly checked and invalidated upon `logout`. This severely limits the window of opportunity for stolen access tokens.
