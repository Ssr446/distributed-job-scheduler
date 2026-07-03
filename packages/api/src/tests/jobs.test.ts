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
      .post('/api/auth/register')
      .send({
        email: 'jobtest@example.com',
        password: 'Password123!',
        name: 'Job Tester'
      });
    userToken = res.body.data.accessToken;
    const user = res.body.data.user;

    // Get default org
    const orgRes = await request(app)
      .get('/api/orgs')
      .set('Authorization', `Bearer ${userToken}`);
    orgId = orgRes.body.data[0].id;

    // Create project
    const projRes = await request(app)
      .post(`/api/orgs/${orgId}/projects`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Test Project' });
    projectId = projRes.body.data.id;

    // Create queue
    const queueRes = await request(app)
      .post(`/api/projects/${projectId}/queues`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'test-queue' });
    queueId = queueRes.body.data.id;
  });

  it('should create a job', async () => {
    const res = await request(app)
      .post(`/api/queues/${queueId}/jobs`)
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
      .get(`/api/queues/${queueId}/jobs`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    const jobs = Array.isArray(res.body.data) ? res.body.data : res.body.data.items;
    expect(jobs.length).toBeGreaterThan(0);
  });
});
