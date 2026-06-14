import { describe, expect, it } from 'vitest';
import { createWorkerHeartbeat } from '../src/heartbeat.js';

describe('worker heartbeat', () => {
  it('returns a stable heartbeat payload', () => {
    expect(createWorkerHeartbeat()).toEqual({
      service: 'worker',
      status: 'ok'
    });
  });
});
