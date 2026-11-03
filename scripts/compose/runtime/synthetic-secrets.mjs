import { secretMounts } from '../lib/secrets.mjs';
import { requireThat } from './guard.mjs';

const root = '/run/bsk-fixture-secrets';
export const secretGap = 'Secret refs have no backend in the merged driver; positive secret-ref acceptance remains unimplemented.';

// Only mounted inside the fresh authorized DinD host; never on the runner filesystem.
export class SyntheticSecrets {
  constructor(h) { this.h = h; this.files = new Set(); this.ready = false; }
  command(script, args = [], input) {
    requireThat(this.h.authorization?.disposable === true && this.h.authorization.engineId === this.h.docker.innerId, 'SECRET_AUTHORIZATION');
    this.h.docker.inspect(this.h.outerContainer, true);
    return this.h.docker.outer(['container', 'exec', ...(input === undefined ? [] : ['-i']), this.h.outerContainer.id, 'sh', '-ceu', script, 'bsk-fixture', ...args], { input });
  }
  prepare(plans) {
    this.command('umask 077; test ! -e "$1"; test ! -L "$1"; mkdir -m 700 "$1"', [root]);
    for (const plan of plans) {
      const mounts = Object.keys(plan.compose.services).flatMap(s => secretMounts(plan, s));
      if (!mounts.length) continue;
      this.command('umask 077; mkdir -m 700 "$1"', [`${root}/${plan.scope}`]);
      for (const m of mounts) {
        this.command('umask 077; set -C; test ! -e "$1"; test ! -L "$1"; head -c 32 /dev/urandom | base64 > "$1"; chmod 400 "$1"', [m.source]);
        this.files.add(m.source);
      }
    }
    this.ready = true;
  }
  verify(plan, service, mount) {
    requireThat(this.ready && this.files.has(mount.source) && secretMounts(plan, service).some(m => m.source === mount.source && m.target === mount.target), 'SECRET_SOURCE');
    this.command('test ! -L "$1"; test -f "$1"; test "$(stat -c %u "$1")" = 0; test "$(stat -c %a "$1")" = 400; test "$(stat -c %h "$1")" = 1; test "$(stat -c %s "$1")" = 45; for d in "$2" "$3"; do test ! -L "$d"; test "$(stat -c %u "$d")" = 0; test "$(stat -c %a "$d")" = 700; done',
      [mount.source, `${root}/${plan.scope}`, root]);
    return true;
  }
  cleanup(plans) {
    requireThat(this.ready, 'SECRET_CLEANUP');
    for (const plan of plans) for (const service of Object.keys(plan.compose.services)) for (const m of secretMounts(plan, service)) {
      this.verify(plan, service, m); this.command('rm -- "$1"', [m.source]); this.files.delete(m.source);
    }
    requireThat(this.files.size === 0, 'SECRET_CLEANUP');
    for (const plan of plans) if (plan.compose.secrets) this.command('rmdir -- "$1"', [`${root}/${plan.scope}`]);
    this.command('rmdir -- "$1"', [root]);
  }
  audit(plans, manifest) {
    requireThat(typeof manifest === 'string' && Buffer.byteLength(manifest) <= 1048576, 'SECRET_AUDIT');
    for (const plan of plans) for (const service of Object.keys(plan.compose.services)) for (const m of secretMounts(plan, service)) {
      this.verify(plan, service, m);
      this.command('if grep -F -q -f "$1"; then exit 1; else test "$?" = 1; fi', [m.source], manifest);
      for (const other of plans) for (const workload of other.workloads) {
        const record = this.h.recordFor(other, workload.name); this.h.docker.inspect(record);
        this.command('logs=$(docker --host unix:///run/bsk/docker.sock container logs "$2" 2>&1); if printf "%s" "$logs" | grep -F -q -f "$1"; then exit 1; else test "$?" = 1; fi', [m.source, record.id]);
      }
    }
  }
}

export function grantSyntheticReferences(f) {
  for (const r of f.requests) {
    const ref = r.target.projectRef === 'fixture-a' ? 'alpha-token' : 'beta-token';
    r.declarations.resources.find(s => s.kind === 'Service' && s.metadata.projectRef === r.target.projectRef).spec.secretRefs = [ref];
    r.secretProvider = { kind: 'disposable-synthetic', bindings: [{ installationRef: r.target.installationRef, projectRef: r.target.projectRef,
      environmentRef: r.target.environmentRef, serviceRef: 'http', ref }] };
  }
}

export function acceptSyntheticSecrets(h) {
  const evidence = [];
  for (const [index, plan] of h.plans.entries()) {
    const own = secretMounts(plan, 'http')[0]; const foreign = secretMounts(h.plans[1 - index], 'http')[0];
    h.python(h.recordFor(plan, 'http'), `import pathlib,base64,http.client
p=pathlib.Path(${JSON.stringify(own.target)})
assert len(base64.b64decode(p.read_bytes(),validate=False))==32
c=http.client.HTTPConnection('127.0.0.1',8080,timeout=2)
c.request('GET','/'); response=c.getresponse(); assert response.status==200
assert p.read_bytes().strip() not in response.read(); c.close()
assert not pathlib.Path(${JSON.stringify(foreign.target)}).exists()
assert not pathlib.Path(${JSON.stringify(foreign.source)}).exists()
print('SECRET_PROBE_OK')`);
    h.python(h.recordFor(plan, 'db'), `import pathlib
assert not pathlib.Path(${JSON.stringify(own.target)}).exists()
assert not pathlib.Path(${JSON.stringify(foreign.target)}).exists()
assert not pathlib.Path(${JSON.stringify(own.source)}).exists()
print('SECRET_PROBE_OK')`);
    evidence.push({ project: plan.target.projectRef, ownRead: true, foreignPathsAbsent: true, unassignedDataContainerDenied: true });
  }
  const manifest = JSON.stringify({ plans: h.plans, inventory: h.store.snapshot(), commands: h.docker.commands, checks: h.checks });
  h.syntheticSecrets.audit(h.plans, manifest);
  return evidence;
}
