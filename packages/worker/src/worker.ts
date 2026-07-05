import 'dotenv/config';

const API_URL = process.env.API_URL || `http://127.0.0.1:${process.env.PORT || 3000}/api/v1`;
// Use env var in production; the hardcoded value matches the seed script for local dev.
const WORKER_API_KEY = process.env.WORKER_API_KEY || '11111111-1111-1111-1111-111111111111.test-worker-key-123';
const QUEUE_ID = process.env.QUEUE_ID || '22222222-2222-2222-2222-222222222222'; // Default seeded high-priority queue
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '5', 10);
let isShuttingDown = false;
let activeJobs = 0;

// Pluggable job handler registry
const handlers: Record<string, (payload: any) => Promise<any>> = {
  'charge_card': async (payload) => {
    console.log('[Handler] Charging card for customer', payload.customerId);
    if (payload.customerId?.startsWith('bad_')) throw new Error('Card declined: Insufficient funds');
    await new Promise(r => setTimeout(r, 1000));
    return { success: true, receiptUrl: 'https://acme.com/receipt/' + Date.now() };
  },
  'generate_invoice': async (payload) => {
    console.log('[Handler] Generating invoice', payload.invoiceId);
    await new Promise(r => setTimeout(r, 500));
    return { success: true, pdfUrl: 'https://acme.com/invoice/' + payload.invoiceId + '.pdf' };
  },
  'manual_trigger': async (payload) => {
    console.log('[Handler] Running manual trigger test job');
    await new Promise(r => setTimeout(r, 250));
    return { success: true, message: 'Manual test trigger executed successfully.' };
  },

  // ── Demo Failure Scenarios ────────────────────────────────────────────────
  // These handlers always fail so jobs exhaust their retries and land in the DLQ,
  // demonstrating the DLQ failure-categorization feature. Errors are worded to
  // match the exact keywords the categorizer in dlq.service.ts checks for.

  'demo_timeout': async (_payload) => {
    console.log('[Handler] demo_timeout: simulating a timeout failure');
    await new Promise(r => setTimeout(r, 300));
    // Matches categorizer keyword: "timeout" → "Network/Timeout Error"
    throw new Error('Request timed out after 5000ms waiting for upstream service');
  },

  'demo_network_error': async (_payload) => {
    console.log('[Handler] demo_network_error: simulating a network failure');
    await new Promise(r => setTimeout(r, 300));
    // Matches categorizer keyword: "econnrefused" → "Network/Timeout Error"
    throw new Error('ECONNREFUSED: connect ECONNREFUSED 10.0.0.1:5432 — database unreachable');
  },

  'demo_validation_error': async (_payload) => {
    console.log('[Handler] demo_validation_error: simulating a validation failure');
    await new Promise(r => setTimeout(r, 300));
    // Matches categorizer keyword: "validation" → "Validation Error"
    throw new Error('Validation failed: missing required field "amount" in job payload');
  },
};

async function fetchApi(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${WORKER_API_KEY}`,
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API Error ${res.status}: ${errText}`);
  }
  return res.json();
}

async function executeJob(job: any) {
  activeJobs++;
  const startMs = Date.now();
  console.log(`[Worker] Starting job ${job.id} (type: ${job.type})`);

  try {
    // 1. Call start API
    await fetchApi(`/jobs/${job.id}/start`, { method: 'POST' });

    // 2. Execute handler
    const handler = handlers[job.type];
    if (!handler) throw new Error(`No handler registered for job type: ${job.type}`);
    const result = await handler(job.payload);

    // 3. Call complete API
    const durationMs = Date.now() - startMs;
    await fetchApi(`/jobs/${job.id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ result, durationMs })
    });
    console.log(`[Worker] Completed job ${job.id} in ${durationMs}ms`);

  } catch (err: any) {
    // 4. Call fail API on error
    const durationMs = Date.now() - startMs;
    const errorMsg = err.message || 'Unknown error';
    console.error(`[Worker] Failed job ${job.id} in ${durationMs}ms:`, errorMsg);
    
    try {
      await fetchApi(`/jobs/${job.id}/fail`, {
        method: 'POST',
        body: JSON.stringify({ error: errorMsg, durationMs })
      });
    } catch (failErr: any) {
      console.error(`[Worker] Critical: Failed to report job failure for ${job.id}:`, failErr.message);
    }
  } finally {
    activeJobs--;
  }
}

async function main() {
  console.log(`[Startup] Fully resolved API_URL: ${API_URL}`);
  console.log('Starting HTTP polling worker with concurrency', CONCURRENCY);
  console.log('Target Queue:', QUEUE_ID);

  const shutdown = async () => {
    console.log('Shutting down worker. Waiting for in-flight jobs to finish...');
    isShuttingDown = true;
    let waitMs = 0;
    while (activeJobs > 0 && waitMs < 10000) {
      await new Promise(r => setTimeout(r, 500));
      waitMs += 500;
    }
    console.log('Worker shutdown complete.');
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  while (!isShuttingDown) {
    if (activeJobs >= CONCURRENCY) {
      await new Promise(r => setTimeout(r, 200));
      continue;
    }

    try {
      const response = await fetchApi(`/queues/${QUEUE_ID}/jobs/claim`, {
        method: 'POST',
        body: JSON.stringify({ limit: 1 }) // Claim 1 at a time to keep local loop simple
      });

      const claimedJobs = response.data || [];
      if (claimedJobs.length > 0) {
        // We do not await executeJob here so we can continue polling up to concurrency limit
        executeJob(claimedJobs[0]);
      } else {
        // No jobs, sleep before polling again
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (err: any) {
      console.error('[Worker] Poll error:', err.message);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

main().catch(err => {
  console.error('[Worker] Fatal error', err);
  process.exit(1);
});
