import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../config/database.js';

describe('Queue Pause/Resume & RBAC', () => {
  let userToken = '';
  let otherUserToken = '';
  let orgId = '';
  let projectId = '';
  let queueId = '';
  let workerKey = '';

  beforeAll(async () => {
    // 1. Setup First User & Project
    const userRes = await request(app).post('/api/v1/auth/register').send({
      email: 'owner@test.com',
      password: 'Password1!',
      name: 'Test Owner'
    });
    userToken = userRes.body.data.accessToken;

    const orgs = await request(app).get('/api/v1/orgs').set('Authorization', `Bearer ${userToken}`);
    orgId = orgs.body.data[0].id;

    const projRes = await request(app)
      .post(`/api/v1/orgs/${orgId}/projects`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Test Project' });
    projectId = projRes.body.data.id;

    const qRes = await request(app)
      .post(`/api/v1/projects/${projectId}/queues`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'q-pause-test', concurrencyLimit: 1 });
    queueId = qRes.body.data.id;

    // 2. Setup Second User (No access to Org)
    const user2Res = await request(app).post('/api/v1/auth/register').send({
      email: 'intruder@test.com',
      password: 'Password1!',
      name: 'Test Intruder'
    });
    otherUserToken = user2Res.body.data.accessToken;

    // 3. Setup Worker
    const worker = await prisma.worker.create({
      data: { name: 'test-worker', hostname: 'local', pid: 1, status: 'ONLINE', concurrency: 5, queues: [queueId] }
    });
    const key = await prisma.apiKey.create({
      data: { name: 'Test Key', workerId: worker.id, keyHash: 'test-hash-will-bypass' }
    });
    const crypto = await import('crypto');
    const secret = 'test-secret';
    const hash = crypto.createHash('sha256').update(secret).digest('hex');
    await prisma.apiKey.update({ where: { id: key.id }, data: { keyHash: hash } });
    workerKey = `${key.id}.${secret}`;
  });

  it('should deny removing a member for user without org access (RBAC)', async () => {
    // otherUser tries to remove a member from the org
    const res = await request(app)
      .delete(`/api/v1/orgs/${orgId}/members/some-user-id`)
      .set('Authorization', `Bearer ${otherUserToken}`);
    
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('should pause queue, verify no jobs claimed, then resume and claim', async () => {
    // Enqueue a job
    await request(app)
      .post(`/api/v1/queues/${queueId}/jobs`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ type: 'test_job', payload: { foo: 'bar' } });

    // Pause the queue
    const pauseRes = await request(app)
      .post(`/api/v1/queues/${queueId}/pause`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(pauseRes.status).toBe(200);

    // Attempt to claim job - should return empty because queue is paused
    const claimRes1 = await request(app)
      .post(`/api/v1/queues/${queueId}/jobs/claim`)
      .set('Authorization', `Bearer ${workerKey}`)
      .send({ limit: 1 });
    
    expect(claimRes1.status).toBe(200);
    expect(claimRes1.body.data).toHaveLength(0);

    // Resume the queue
    const resumeRes = await request(app)
      .post(`/api/v1/queues/${queueId}/resume`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(resumeRes.status).toBe(200);

    // Attempt to claim job - should return the job now
    const claimRes2 = await request(app)
      .post(`/api/v1/queues/${queueId}/jobs/claim`)
      .set('Authorization', `Bearer ${workerKey}`)
      .send({ limit: 1 });
    
    expect(claimRes2.status).toBe(200);
    expect(claimRes2.body.data).toHaveLength(1);
    expect(claimRes2.body.data[0].status).toBe('CLAIMED');
  });
});
