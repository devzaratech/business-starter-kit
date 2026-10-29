import { readFileSync } from 'node:fs';

export const limits = () => ({ cpuRequestMillis: 100, cpuLimitMillis: 250,
  memoryRequestBytes: 16777216, memoryLimitBytes: 33554432,
  storageBudgetBytes: 1048576, pidsLimit: 32, replicas: 1 });

export function request(project = 'fixture-a') {
  return {
    apiVersion: 'bsk.compose/v0alpha1',
    declarations: JSON.parse(readFileSync(new URL('../../declarations/test/fixtures/two-projects.json', import.meta.url))),
    target: { installationRef: 'fixture-install', projectRef: project,
      environmentRef: 'review-142', hostRef: 'disposable-host', deploymentRef: 'attempt-1' },
    workloads: [
      { name: 'http', role: 'http', serviceRef: 'http', image: `example.test/fixture@sha256:${'a'.repeat(64)}`, resources: limits(), dataRefs: ['db'] },
      { name: 'db', role: 'data', image: `example.test/data@sha256:${'b'.repeat(64)}`, resources: limits(), persistent: true }
    ]
  };
}

export function host() {
  const budget = { cpuMillis: 4000, memoryBytes: 1073741824, pids: 1024, storageBytes: 1073741824 };
  return {
    hostRef: 'disposable-host', capacity: budget,
    reserved: { cpuMillis: 250, memoryBytes: 67108864, pids: 64, storageBytes: 0 },
    capabilities: { cpu: 'supported', memory: 'supported', pids: 'supported', storage: 'unsupported' },
    storageMode: 'advisory',
    projectBudgets: ['fixture-a', 'fixture-b'].map(projectRef => ({ installationRef: 'fixture-install', projectRef, limits: { ...budget } })),
    environmentBudgets: ['fixture-a', 'fixture-b'].map(projectRef => ({ installationRef: 'fixture-install', projectRef, environmentRef: 'review-142', limits: { ...budget } }))
  };
}
