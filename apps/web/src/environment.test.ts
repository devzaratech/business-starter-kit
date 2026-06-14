import { describe, expect, it } from 'vitest';
import { normalizeEnvironment } from './environment';

describe('normalizeEnvironment', () => {
  it('keeps supported environment names', () => {
    expect(normalizeEnvironment('dev')).toBe('dev');
    expect(normalizeEnvironment('QA')).toBe('qa');
    expect(normalizeEnvironment('uat')).toBe('uat');
    expect(normalizeEnvironment('staging')).toBe('staging');
    expect(normalizeEnvironment('prod')).toBe('prod');
  });

  it('falls back to local for unknown values', () => {
    expect(normalizeEnvironment(undefined)).toBe('local');
    expect(normalizeEnvironment('sandbox')).toBe('local');
  });
});
