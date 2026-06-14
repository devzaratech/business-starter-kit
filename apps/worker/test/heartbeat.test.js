import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createWorkerHeartbeat } from '../src/heartbeat.js';

describe('worker heartbeat', () => {
  it('returns a stable heartbeat payload', () => {
    assert.deepEqual(createWorkerHeartbeat(), {
      service: 'worker',
      status: 'ok'
    });
  });
});
