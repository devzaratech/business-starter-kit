import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeEnvironment } from '../src/environment.js';

describe('normalizeEnvironment', () => {
  it('keeps supported environment names', () => {
    assert.equal(normalizeEnvironment('dev'), 'dev');
    assert.equal(normalizeEnvironment('QA'), 'qa');
    assert.equal(normalizeEnvironment('uat'), 'uat');
    assert.equal(normalizeEnvironment('staging'), 'staging');
    assert.equal(normalizeEnvironment('prod'), 'prod');
  });

  it('falls back to local for unknown values', () => {
    assert.equal(normalizeEnvironment(undefined), 'local');
    assert.equal(normalizeEnvironment('sandbox'), 'local');
  });
});
