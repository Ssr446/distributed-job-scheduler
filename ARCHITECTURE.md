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
