import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('api-node health endpoint', () => {
  it('returns an ok health response', async () => {
    const response = await request(createApp()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      service: 'api-node',
      status: 'ok'
    });
  });
});
