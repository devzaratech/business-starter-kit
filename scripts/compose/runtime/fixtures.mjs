import { requireThat } from './guard.mjs';

export function fixtures(run, image) {
  requireThat(/^[0-9]+-[0-9]+$/.test(run), 'RUN');
  requireThat(/^localhost:5000\/bsk-es2-fixture@sha256:[a-f0-9]{64}$/.test(image), 'IMAGE');
  const installationRef = `es2-${run}`;
  const pairs = [['fixture-a', 'review-alpha'], ['fixture-b', 'qa-independent']];
  const declarations = { apiVersion: 'bsk/v0alpha1', catalog: { policies: ['disposable'], runtimes: ['synthetic'], routes: [] },
    resources: pairs.flatMap(([projectRef, environmentRef]) => [
      { apiVersion: 'bsk/v0alpha1', kind: 'Project', metadata: { installationRef, name: projectRef }, spec: { ownerRef: 'fixture-owner' } },
      { apiVersion: 'bsk/v0alpha1', kind: 'Environment', metadata: { installationRef, projectRef, name: environmentRef }, spec: { policyRef: 'disposable' } },
      { apiVersion: 'bsk/v0alpha1', kind: 'Service', metadata: { installationRef, projectRef, name: 'http' }, spec: { runtimeRef: 'synthetic', port: 8080 } }
    ]) };
  const resources = { cpuRequestMillis: 100, cpuLimitMillis: 250, memoryRequestBytes: 16777216,
    memoryLimitBytes: 67108864, storageBudgetBytes: 1048576, pidsLimit: 32, replicas: 1 };
  const budget = { cpuMillis: 2000, memoryBytes: 536870912, pids: 256, storageBytes: 16777216 };
  return { requests: pairs.map(([projectRef, environmentRef]) => ({ apiVersion: 'bsk.compose/v0alpha1', declarations,
    target: { installationRef, projectRef, environmentRef, hostRef: 'disposable-host', deploymentRef: 'runtime-1' },
    workloads: [ { name: 'http', role: 'http', serviceRef: 'http', image, resources: { ...resources }, dataRefs: ['db'] },
      { name: 'db', role: 'data', image, resources: { ...resources }, persistent: true } ] })),
  host: { hostRef: 'disposable-host', capacity: budget,
    reserved: { cpuMillis: 250, memoryBytes: 67108864, pids: 32, storageBytes: 0 },
    capabilities: { cpu: 'supported', memory: 'supported', pids: 'supported', storage: 'unsupported' }, storageMode: 'advisory',
    projectBudgets: pairs.map(([projectRef]) => ({ installationRef, projectRef, limits: { ...budget } })),
    environmentBudgets: pairs.map(([projectRef, environmentRef]) => ({ installationRef, projectRef, environmentRef, limits: { ...budget } })) } };
}
