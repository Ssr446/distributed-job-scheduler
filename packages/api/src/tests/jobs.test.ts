import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/database';

describe('Jobs Module', () => {
  let userToken: string;
  let orgId: string;
  let projectId: string;
  let queueId: string;

  beforeAll(async () => {
    // Register and get token
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'jobtest@example.com',
        password: 'Password123!',
        name: 'Job Tester'
      });
    userToken = res.body.data.accessToken;
    const user = res.body.data.user;

    // Get default org
    const orgRes = await request(app)
      .get('/api/v1/orgs')
      .set('Authorization', `Bearer ${userToken}`);
    orgId = orgRes.body.data[0].id;

    // Create project
    const projRes = await request(app)
      .post(`/api/v1/orgs/${orgId}/projects`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Test Project' });
    projectId = projRes.body.data.id;

    // Create queue
    const queueRes = await request(app)
      .post(`/api/v1/projects/${projectId}/queues`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'test-queue' });
    queueId = queueRes.body.data.id;
  });

  it('should create a job', async () => {
    const res = await request(app)
      .post(`/api/v1/queues/${queueId}/jobs`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        type: 'send_email',
        payload: { to: 'user@example.com' }
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('QUEUED');
    expect(res.body.data.type).toBe('send_email');
  });

  it('should fetch jobs in a queue', async () => {
    const res = await request(app)
      .get(`/api/v1/queues/${queueId}/jobs`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    const jobs = Array.isArray(res.body.data) ? res.body.data : res.body.data.items;
    expect(jobs.length).toBeGreaterThan(0);
  });

  it('should reject a fabricated two-part Bearer token with 401', async () => {
    // 1. Get a valid job ID
    const res = await request(app)
      .get(`/api/v1/queues/${queueId}/jobs`)
      .set('Authorization', `Bearer ${userToken}`);
    const jobs = Array.isArray(res.body.data) ? res.body.data : res.body.data.items;
    const jobId = jobs[0].id;

    // 2. Make request with fake two-part token
    const retryRes = await request(app)
      .post(`/api/v1/jobs/${jobId}/retry`)
      .set('Authorization', 'Bearer fake.token');

    expect(retryRes.status).toBe(401);
  });

  it('should reject a user from a different org with 403', async () => {
    // 1. Create a second user who has no access to the first org
    const res2 = await request(app).post('/api/v1/auth/register').send({
      email: 'intruder2@test.com',
      password: 'Password123!',
      name: 'Intruder'
    });
    const intruderToken = res2.body.data.accessToken;

    // 2. Get a valid job ID
    const res = await request(app)
      .get(`/api/v1/queues/${queueId}/jobs`)
      .set('Authorization', `Bearer ${userToken}`);
    const jobs = Array.isArray(res.body.data) ? res.body.data : res.body.data.items;
    const jobId = jobs[0].id;

    // 3. Intruder tries to cancel the job
    const cancelRes = await request(app)
      .post(`/api/v1/jobs/${jobId}/cancel`)
      .set('Authorization', `Bearer ${intruderToken}`);

    expect(cancelRes.status).toBe(403);
  });
});
