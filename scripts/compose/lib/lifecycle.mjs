import { labels, hash, fail } from './plan.mjs';

export function expectedObjects(plan) {
  const expected = [];
  for (const [service, s] of Object.entries(plan.compose.services)) for (let i = 1; i <= s.deploy.replicas; i++) {
    expected.push({ kind: 'container', name: `${plan.scope}-${service}-${i}`, service, labels: s.labels });
  }
  for (const n of Object.values(plan.compose.networks)) expected.push({ kind: 'network', name: n.name, labels: n.labels });
  for (const v of Object.values(plan.compose.volumes)) expected.push({ kind: 'volume', name: v.name, labels: v.labels });
  return expected;
}

export function inspectLimits(entry, objects) {
  const p = entry.plan; const expected = expectedObjects(p);
  if (!Array.isArray(objects) || objects.length !== expected.length) fail('OWNERSHIP');
  const keys = new Set(); const ids = new Set();
  const observed = [];
  for (const o of objects) {
    const key = `${o.kind}:${o.name}`;
    const e = expected.find(e => e.kind === o.kind && e.name === o.name);
    if (!e || keys.has(key) || ids.has(o.id) || typeof o.id !== 'string' || !o.id ||
      Object.entries(e.labels).some(([k, v]) => o.labels?.[k] !== v) || o.labels?.['com.docker.compose.project'] !== p.scope) fail('OWNERSHIP');
    keys.add(key); ids.add(o.id);
    if (o.kind !== 'container') {
      if (o.kind === 'network' && (o.internal !== true || o.driver !== 'bridge' ||
        (o.attachments ?? []).some(id => !objects.some(c => c.kind === 'container' && c.id === id)))) fail('RUNTIME_POLICY');
      continue;
    }
    const s = p.compose.services[e.service];
    const networkNames = s.networks.map(n => p.compose.networks[n].name).sort();
    const volumes = (s.volumes ?? []).map(v => p.compose.volumes[v.source].name).sort();
    if (o.privileged !== false || o.hostNetwork !== false || !Array.isArray(o.ports) || o.ports.length ||
      JSON.stringify([...o.networks].sort()) !== JSON.stringify(networkNames) ||
      JSON.stringify([...o.mounts].sort()) !== JSON.stringify(volumes)) fail('RUNTIME_POLICY');
    observed.push({ service: e.service, id: o.id, limits: structuredClone(o.limits),
      matches: o.limits?.cpuMillis === s.cpus * 1000 && o.limits?.memoryBytes === s.mem_limit && o.limits?.pids === s.pids_limit });
  }
  return { requested: structuredClone(entry.admission.requested), admitted: structuredClone(entry.admission.admitted),
    observed, configurationMatches: observed.every(o => o.matches), source: 'docker-inspect',
    enforced: 'unknown', runtimeConformance: false };
}

export function planLifecycle(store, planId, action, reader, confirmation = {}) {
  if (!['stop', 'down', 'destroy'].includes(action)) fail('ACTION');
  const before = store.snapshot(); const entry = before.entries.find(e => e.plan.planId === planId);
  if (!entry) fail('INVENTORY_MISSING');
  if (action === 'destroy' && (confirmation.confirmDataLoss !== true || confirmation.confirmPlanId !== planId)) fail('CONFIRMATION_REQUIRED');
  const objects = reader.resources(entry.plan);
  const report = inspectLimits(entry, objects);
  if (store.snapshot().revision !== before.revision) fail('STALE_REVISION');
  const actions = objects.filter(o => action === 'destroy' || o.kind === 'container' || (action === 'down' && o.kind === 'network'))
    .sort((a, b) => ({ container: 0, network: 1, volume: 2 }[a.kind] - { container: 0, network: 1, volume: 2 }[b.kind]))
    .map(o => ({ action: action === 'stop' ? 'stop' : 'remove', kind: o.kind, id: o.id, projectScope: entry.plan.scope,
      requiredLabels: labels(entry.plan.target, entry.plan.scope, o.labels['dev.bsk.service']) }));
  const result = { mode: 'intent-only', revision: before.revision, planId, action,
    preservesVolumes: action !== 'destroy', actions, report, executionAuthorized: false };
  return { ...result, lifecycleId: hash(result) };
}
