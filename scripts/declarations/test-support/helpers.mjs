import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function fixture(name = 'two-projects') {
  return JSON.parse(readFileSync(new URL(`../test/fixtures/${name}.json`, import.meta.url), 'utf8'));
}

export function resources() {
  return {
    cpuRequestMillis: 100, cpuLimitMillis: 500,
    memoryRequestBytes: 1024, memoryLimitBytes: 4096,
    storageBudgetBytes: 8192, pidsLimit: 32, replicas: 2
  };
}

export function snapshot(root) {
  const result = {};
  function walk(dir, prefix = '') {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const relative = `${prefix}${entry.name}`;
      if (entry.isDirectory()) walk(join(dir, entry.name), `${relative}/`);
      else result[relative] = readFileSync(join(dir, entry.name)).toString('hex');
    }
  }
  walk(root);
  return result;
}
