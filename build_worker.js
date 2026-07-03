const fs = require('fs');
const path = require('path');

const write = (filePath, content) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content.trim() + '\n');
};

const base = 'C:\\Users\\ssrsh\\Documents\\projects\\codity';

// 1. Worker package.json & tsconfig
write(path.join(base, 'packages/worker/package.json'), `
{
  "name": "worker",
  "version": "1.0.0",
  "main": "dist/worker.js",
  "scripts": {
    "dev": "tsx watch src/worker.ts",
    "build": "tsc",
    "start": "node dist/worker.js"
  },
  "dependencies": {
    "@prisma/client": "^6.0.0",
    "dotenv": "^16.4.7",
    "pg": "^8.13.1",
    "uuid": "^11.0.3"
  },
  "devDependencies": {
    "typescript": "^5.7.2",
    "tsx": "^4.19.2",
    "@types/node": "^22.10.2",
    "@types/pg": "^8.11.10",
    "@types/uuid": "^10.0.0"
  }
}
`);

write(path.join(base, 'packages/worker/tsconfig.json'), `
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"]
}
`);

// 2. Worker logic
write(path.join(base, 'packages/worker/src/worker.ts'), `
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const WORKER_ID = 'worker-1'; // In reality, generated uuid

async function main() {
  console.log('Worker started with ID:', WORKER_ID);

  // Poll for jobs
  setInterval(async () => {
    try {
      // Find a job
      const jobIds = await prisma.$queryRaw\`
        SELECT id FROM "Job"
        WHERE status = 'QUEUED'
        ORDER BY priority DESC, "createdAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      \`;

      const jobs = jobIds as any[];
      if (jobs.length > 0) {
        const jobId = jobs[0].id;
        
        // Claim the job
        await prisma.job.update({
          where: { id: jobId },
          data: { status: 'RUNNING', claimedById: WORKER_ID, startedAt: new Date() }
        });

        console.log(\`Claimed job \${jobId}\`);

        // Simulate execution
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Complete the job
        await prisma.job.update({
          where: { id: jobId },
          data: { status: 'COMPLETED', completedAt: new Date(), result: { msg: 'Success' } }
        });
        
        console.log(\`Completed job \${jobId}\`);
      }
    } catch (err) {
      console.error('Error claiming job:', err);
    }
  }, 1000);
}

main().catch(console.error);
`);

console.log('Worker scripts written successfully!');
