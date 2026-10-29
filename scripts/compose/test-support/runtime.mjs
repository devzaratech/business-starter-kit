export function runtimeObjects(plan) {
  const project = { 'com.docker.compose.project': plan.scope };
  const objects = [];
  for (const [service, s] of Object.entries(plan.compose.services)) {
    for (let i = 1; i <= s.deploy.replicas; i++) objects.push({ kind: 'container', name: `${plan.scope}-${service}-${i}`,
      id: `${service}-${i}`, labels: { ...s.labels, ...project, 'com.docker.compose.service': service },
      limits: { cpuMillis: plan.workloads.find(w => w.name === service).resources.cpuLimitMillis, memoryBytes: s.mem_limit, pids: s.pids_limit },
      networks: s.networks.map(n => plan.compose.networks[n].name),
      privileged: false, hostNetwork: false, ports: [], mounts: (s.volumes ?? []).map(v => plan.compose.volumes[v.source].name) });
  }
  for (const n of Object.values(plan.compose.networks)) objects.push({ kind: 'network', name: n.name, id: n.name, labels: { ...n.labels, ...project }, internal: true, driver: 'bridge', attachments: [] });
  for (const v of Object.values(plan.compose.volumes)) objects.push({ kind: 'volume', name: v.name, id: v.name, labels: { ...v.labels, ...project } });
  return objects;
}
export const authorization = () => ({ context: 'bsk-es2-disposable', endpoint: 'unix:///tmp/bsk-es2/docker.sock',
  engineId: 'explicit-disposable-engine', hostRef: 'disposable-host', disposable: true, authorizationRef: 'operator-test-only' });
