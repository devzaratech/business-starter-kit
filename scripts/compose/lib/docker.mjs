import { spawnSync } from 'node:child_process';
import { expectedObjects } from './lifecycle.mjs';
import { fail, scopeName } from './plan.mjs';

function execute(args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(DOCKER_|COMPOSE_)/i.test(k)));
  const r = spawnSync('docker', args, { shell: false, encoding: 'utf8', timeout: 10000, maxBuffer: 4 * 1024 * 1024, env });
  if (r.error || r.status !== 0) fail('DOCKER_READ');
  return r.stdout;
}

export class DockerReader {
  constructor(authorization, run = execute) {
    const a = authorization;
    const path = typeof a?.endpoint === 'string' ? a.endpoint.slice('unix://'.length) : '';
    if (!a || Object.keys(a).sort().join(',') !== ['context', 'endpoint', 'engineId', 'hostRef', 'disposable', 'authorizationRef'].sort().join(',') ||
      a.disposable !== true || !/^bsk-es2-[a-z0-9-]{1,50}$/.test(a.context) ||
      !/^unix:\/\/\/[a-zA-Z0-9_./-]+$/.test(a.endpoint) || path.slice(1).split('/').some(s => !s || s === '.' || s === '..') ||
      /^unix:\/\/\/(?:var\/)?run\/docker\.sock$|desktop|docker_engine/i.test(a.endpoint) ||
      ![a.engineId, a.hostRef, a.authorizationRef].every(v => typeof v === 'string' && v.length > 0 && v.length <= 256)) fail('CONTEXT_REQUIRED');
    this.authorization = structuredClone(a); this.run = run;
  }
  call(args) {
    try { return this.run(args); } catch { fail('DOCKER_READ'); }
  }
  authorize(plan) {
    const a = this.authorization;
    if (scopeName(plan.target) !== plan.scope || plan.target.hostRef !== a.hostRef) fail('CONTEXT_MISMATCH');
    let endpoint, info;
    try {
      endpoint = JSON.parse(this.call(['context', 'inspect', a.context, '--format', '{{json .Endpoints.docker.Host}}']));
      if (endpoint !== a.endpoint) fail('CONTEXT_MISMATCH');
      info = JSON.parse(this.call(['--context', a.context, 'info', '--format', '{{json .}}']));
      if (info.ID !== a.engineId || info.OSType !== 'linux') fail('CONTEXT_MISMATCH');
    } catch (e) { if (e.code) throw e; fail('DOCKER_READ'); }
    return info;
  }
  resources(plan) {
    this.authorize(plan);
    const prefix = ['--context', this.authorization.context];
    const expected = expectedObjects(plan); const objects = [];
    for (const kind of ['container', 'network', 'volume']) {
      const listArgs = [kind, 'ls', ...(kind === 'container' ? ['-a'] : []),
        ...(kind !== 'volume' ? ['--no-trunc'] : []), '--filter', `label=com.docker.compose.project=${plan.scope}`,
        '--format', kind === 'volume' ? '{{.Name}}' : '{{.ID}}'];
      const listed = this.call([...prefix, ...listArgs]).split(/\r?\n/).filter(Boolean);
      const refs = [...new Set([...listed, ...expected.filter(e => e.kind === kind).map(e => e.name)])];
      if (refs.length > 2200 || refs.some(s => !/^[a-zA-Z0-9_.-]{1,256}$/.test(s))) fail('DOCKER_READ');
      const seen = new Set();
      for (const ref of refs) {
        let values; try { values = JSON.parse(this.call([...prefix, kind, 'inspect', ref])); } catch { fail('DOCKER_READ'); }
        if (!Array.isArray(values) || values.length !== 1) fail('DOCKER_READ');
        const o = values[0]; const id = kind === 'volume' ? o.Name : o.Id;
        if (typeof id !== 'string' || (kind !== 'volume' && !/^[a-f0-9]{64}$/.test(id))) fail('DOCKER_READ');
        if (seen.has(id)) continue; seen.add(id);
        if (kind === 'container') {
          const h = o.HostConfig; const n = o.NetworkSettings;
          if (!h || !n || !Array.isArray(o.Mounts)) fail('DOCKER_READ');
          objects.push({ kind, id, name: o.Name?.replace(/^\//, ''), labels: o.Config?.Labels ?? {},
            limits: { cpuMillis: h.NanoCpus > 0 ? h.NanoCpus / 1000000 : h.CpuQuota > 0 && h.CpuPeriod > 0 ? h.CpuQuota / h.CpuPeriod * 1000 : null,
              memoryBytes: h.Memory ?? null, pids: h.PidsLimit ?? null },
            privileged: h.Privileged, hostNetwork: h.NetworkMode === 'host', networks: Object.keys(n.Networks ?? {}),
            ports: Object.values(n.Ports ?? {}).flatMap(p => p ?? []),
            mounts: o.Mounts.map(m => m.Type === 'volume' ? m.Name : `unmanaged:${m.Type}`) });
        } else objects.push({ kind, id, name: o.Name, labels: o.Labels ?? {},
          ...(kind === 'network' ? { internal: o.Internal, driver: o.Driver, attachments: Object.keys(o.Containers ?? {}) } : {}) });
      }
    }
    return objects;
  }
  versions(plan) {
    const info = this.authorize(plan);
    return { engine: info.ServerVersion ?? 'unknown', kernel: info.KernelVersion ?? 'unknown', cgroup: info.CgroupVersion ?? 'unknown',
      compose: this.call(['--context', this.authorization.context, 'compose', 'version', '--short']).trim(),
      engineId: info.ID, context: this.authorization.context };
  }
}
