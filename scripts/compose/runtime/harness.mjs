import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { buildPlan } from '../lib/plan.mjs';
import { Inventory } from '../lib/inventory.mjs';
import { DockerReader } from '../lib/docker.mjs';
import { expectedObjects, inspectLimits, planLifecycle } from '../lib/lifecycle.mjs';
import { requireThat, assertEngine, resultStatus } from './guard.mjs';
import { DockerSession } from './session.mjs';
import { fixtures } from './fixtures.mjs';
import { readCgroups, cgroupValues, verifyCgroup, verifyLoad, cpuLoad, pidsLoad, memoryLoad, connectProbe } from './probes.mjs';

const images = JSON.parse(readFileSync(new URL('./images.json', import.meta.url)));
const fixtureDir = fileURLToPath(new URL('./fixture', import.meta.url));
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const idPattern = /^[a-f0-9]{64}$/;

export class Harness {
  constructor(permit, session = new DockerSession(permit)) {
    this.permit = permit; this.docker = session; this.checks = []; this.aux = []; this.plans = [];
    this.gaps = ['Secret refs have no backend in the merged driver; positive secret-ref acceptance remains unimplemented.'];
  }
  save(name, value) { writeFileSync(join(this.root, `${name}.json`), json(value), { mode: 0o600 }); }
  async check(name, fn) {
    try { const evidence = await fn(); this.checks.push({ name, status: 'passed', evidence: evidence ?? null }); return evidence; }
    catch (e) {
      const code = /^[A-Z_]{1,50}$/.test(e.code ?? '') ? e.code : 'ASSERTION';
      this.checks.push({ name, status: code === 'CGROUP_UNSUPPORTED' || name === 'bootstrap' ? 'blocked' : 'failed', code });
      throw e;
    }
    finally { if (this.root) this.save('checks-progress', this.checks); }
  }
  async wait(fn, attempts = 30) {
    for (let i = 0; i < attempts; i++) { try { return fn(); } catch { if (i + 1 === attempts) throw Object.assign(new Error('READINESS'), { code: 'READINESS' }); await delay(1000); } }
  }
  async bootstrap() {
    const d = this.docker; const run = this.permit.run;
    // This host endpoint is used only after authorize() proves a manual hosted-runner job.
    const info = JSON.parse(d.raw(['--host', 'unix:///var/run/docker.sock', 'info', '--format', '{{json .}}']).stdout);
    requireThat(info.OSType === 'linux' && info.ID, 'TARGET'); d.outerId = info.ID;
    const labels = { 'dev.bsk.test-run': run, 'dev.bsk.test-role': 'disposable-daemon' };
    const dataName = `bsk-es2-daemon-data-${run}`;
    for (const [kind, name, format] of [['volume', dataName, '{{.Name}}'], ['container', `bsk-es2-daemon-${run}`, '{{.Names}}']]) {
      const names = d.outer([kind, 'ls', ...(kind === 'container' ? ['-a'] : []), '--format', format]).stdout.trim().split('\n');
      requireThat(!names.includes(name), 'TARGET_NOT_EMPTY');
    }
    d.outer(['volume', 'create', '--label', `dev.bsk.test-run=${run}`, '--label', 'dev.bsk.test-role=daemon-data', dataName]);
    this.outerVolume = { kind: 'volume', id: dataName, labels: { 'dev.bsk.test-run': run, 'dev.bsk.test-role': 'daemon-data' } };
    d.inspect(this.outerVolume, true);
    d.outer(['image', 'pull', '--platform', images.platform, images.dind], { timeout: 180000 });
    const id = d.outer(['container', 'run', '-d', '--platform', images.platform, '--name', `bsk-es2-daemon-${run}`,
      '--privileged', '--memory', '2g', '--cpus', '2', '--pids-limit', '512',
      '--label', `dev.bsk.test-run=${run}`, '--label', 'dev.bsk.test-role=disposable-daemon',
      '--mount', `type=volume,source=${dataName},target=/var/lib/docker`,
      '--mount', `type=bind,source=${this.socketDir},target=/run/bsk`,
      '--env', 'DOCKER_TLS_CERTDIR=', images.dind, 'dockerd', '--host=unix:///run/bsk/docker.sock',
      '--storage-driver=overlay2', `--label=dev.bsk.test-run=${run}`], { timeout: 60000 }).stdout.trim();
    requireThat(idPattern.test(id), 'TARGET'); this.outerContainer = { kind: 'container', id, labels };
    d.sandbox = this.outerContainer;
    const daemon = d.inspect(this.outerContainer, true);
    requireThat(daemon.HostConfig?.Privileged === true && !daemon.HostConfig?.PortBindings?.['2375/tcp'], 'TARGET');
    const socket = join(this.socketDir, 'docker.sock');
    await this.wait(() => {
      d.inspect(this.outerContainer, true);
      d.outer(['container', 'exec', id, 'chown', `${process.getuid()}:${process.getgid()}`, '/run/bsk/docker.sock']);
      requireThat(lstatSync(socket).isSocket() && !lstatSync(socket).isSymbolicLink(), 'TARGET');
    });
    d.context = `bsk-es2-${run}`; d.endpoint = `unix://${socket}`;
    d.raw(['context', 'create', d.context, '--docker', `host=${d.endpoint}`]);
    const inner = await this.wait(() => JSON.parse(d.raw(['--context', d.context, 'info', '--format', '{{json .}}']).stdout));
    assertEngine(inner, d.outerId, run); d.innerId = inner.ID;
    requireThat(d.inner(['container', 'ls', '-aq']).stdout.trim() === '' && d.inner(['volume', 'ls', '-q']).stdout.trim() === '', 'TARGET_NOT_EMPTY');
    const networks = d.inner(['network', 'ls', '--format', '{{json .}}']).stdout.trim().split('\n').filter(Boolean).map(s => JSON.parse(s));
    requireThat(networks.every(n => ['bridge', 'host', 'none'].includes(n.Name)), 'TARGET_NOT_EMPTY');
    this.authorization = { context: d.context, endpoint: d.endpoint, engineId: inner.ID, hostRef: 'disposable-host', disposable: true,
      authorizationRef: `github-actions:${run}:${this.permit.actor}:${this.permit.commit}` };
    this.reader = new DockerReader(this.authorization, args =>
      args[0] === '--context' && args[2] === 'compose' ? d.inner(args.slice(2)).stdout : d.raw(args).stdout);
    this.save('authorization', this.authorization);
    return { outerEngineId: info.ID, innerEngineId: inner.ID, context: d.context, cgroup: inner.CgroupVersion,
      engine: inner.ServerVersion, kernel: inner.KernelVersion, cgroupDriver: inner.CgroupDriver, runner: 'ubuntu-24.04',
      daemonImageId: daemon.Image, daemonImageReference: daemon.Config?.Image, outerEngine: info.ServerVersion };
  }
  addAux(kind, id, role) {
    requireThat(kind === 'volume' || idPattern.test(id), 'OWNERSHIP');
    const record = { kind, id, labels: { 'dev.bsk.test-run': this.permit.run, 'dev.bsk.test-role': role } };
    this.docker.inspect(record); this.aux.push(record); return record;
  }
  async image() {
    const d = this.docker; const run = this.permit.run;
    for (const image of [images.python, images.registry]) d.inner(['image', 'pull', '--platform', images.platform, image], { timeout: 180000 });
    const registryData = `bsk-es2-registry-data-${run}`;
    d.inner(['volume', 'create', '--label', `dev.bsk.test-run=${run}`, '--label', 'dev.bsk.test-role=registry-data', registryData]);
    this.addAux('volume', registryData, 'registry-data');
    const registry = d.inner(['container', 'run', '-d', '--name', `bsk-es2-registry-${run}`,
      '--label', `dev.bsk.test-run=${run}`, '--label', 'dev.bsk.test-role=registry', '--memory', '128m', '--cpus', '0.5', '--pids-limit', '64',
      '--mount', `type=volume,source=${registryData},target=/var/lib/registry`, '-p', '127.0.0.1:5000:5000', images.registry], { timeout: 30000 }).stdout.trim();
    this.addAux('container', registry, 'registry');
    const tag = `localhost:5000/bsk-es2-fixture:run-${run}`;
    d.inner(['build', '--network=none', '--platform', images.platform, '--build-arg', `BASE_IMAGE=${images.python}`,
      '--label', `dev.bsk.test-run=${run}`, '-t', tag, fixtureDir], { timeout: 180000 });
    await this.wait(() => d.inner(['image', 'push', tag], { timeout: 60000 }), 10);
    const built = JSON.parse(d.inner(['image', 'inspect', tag]).stdout)[0];
    const digest = built.RepoDigests.find(v => /^localhost:5000\/bsk-es2-fixture@sha256:[a-f0-9]{64}$/.test(v));
    requireThat(digest && built.Config?.Labels?.['dev.bsk.test-run'] === run, 'IMAGE');
    this.imageRef = digest;
    const bases = [images.python, images.registry].map(ref => {
      const actual = JSON.parse(d.inner(['image', 'inspect', ref]).stdout)[0];
      return { reference: ref, id: actual.Id, repoDigests: actual.RepoDigests, os: actual.Os, architecture: actual.Architecture };
    });
    this.save('images', { pinned: images, bases, synthetic: { reference: digest, id: built.Id, platform: images.platform },
      sourceHashes: { dockerfile: (await import('node:crypto')).createHash('sha256').update(readFileSync(join(fixtureDir, 'Dockerfile'))).digest('hex'),
        app: (await import('node:crypto')).createHash('sha256').update(readFileSync(join(fixtureDir, 'app.py'))).digest('hex') } });
    return { reference: digest, id: built.Id };
  }
  claim() {
    const f = fixtures(this.permit.run, this.imageRef);
    this.store = Inventory.initialize(join(this.root, 'inventory'), f.host);
    f.requests.forEach((r, i) => { this.store.claim(r, i); });
    this.plans = f.requests.map(buildPlan);
    this.save('requests', f.requests); this.save('host-policy', f.host); this.save('inventory-before', this.store.snapshot());
    for (const [index, p] of this.plans.entries()) {
      this.save(`compose-${index}`, p.compose);
      writeFileSync(join(this.socketDir, `compose-${index}.json`), json(p.compose), { mode: 0o600 });
    }
    return f;
  }
  recordFor(plan, service) {
    const expected = expectedObjects(plan).find(o => o.kind === 'container' && o.service === service);
    const actual = JSON.parse(this.docker.inner(['container', 'inspect', expected.name]).stdout)[0];
    const record = { kind: 'container', id: actual.Id, labels: { ...expected.labels, 'com.docker.compose.project': plan.scope } };
    this.docker.inspect(record); return record;
  }
  python(record, code, options) { return this.docker.execOwned(record, ['python', '-c', code], options); }
  ip(plan, service) {
    const actual = this.docker.inspect(this.recordFor(plan, service));
    const ip = actual.NetworkSettings?.Networks?.[plan.compose.networks.data.name]?.IPAddress;
    requireThat(ip, 'NETWORK'); return ip;
  }
  cgroups(record) {
    const raw = JSON.parse(this.python(record, readCgroups).stdout);
    return { raw, values: cgroupValues(raw) };
  }
  checksum(plan) {
    return this.python(this.recordFor(plan, 'db'), "import hashlib,pathlib; print(hashlib.sha256(pathlib.Path('/data/marker').read_bytes()).hexdigest())").stdout.trim();
  }
  available(plan) {
    const data = this.python(this.recordFor(plan, 'http'), connectProbe(this.ip(plan, 'db'), true)).stdout.trim();
    const http = this.python(this.recordFor(plan, 'db'), connectProbe(this.ip(plan, 'http'), true)).stdout.trim();
    return { data, http };
  }
  async deploy() {
    for (let i = 0; i < this.plans.length; i++) {
      const p = this.plans[i];
      this.docker.inner(['compose', '-p', p.scope, '-f', `/run/bsk/compose-${i}.json`, 'up', '-d', '--pull', 'never', '--wait', '--wait-timeout', '30'], { timeout: 60000 });
      await this.wait(() => this.python(this.recordFor(p, 'http'), connectProbe(this.ip(p, 'db'), true)));
    }
    const reports = [];
    for (const p of this.plans) {
      const entry = this.store.snapshot().entries.find(e => e.plan.planId === p.planId);
      const objects = this.reader.resources(p); const report = inspectLimits(entry, objects);
      requireThat(report.configurationMatches, 'RUNTIME_LIMIT');
      const cgroups = {};
      for (const w of p.workloads) { const cg = this.cgroups(this.recordFor(p, w.name)); verifyCgroup(cg.values, w.resources); cgroups[w.name] = cg; }
      reports.push({ project: p.target.projectRef, objects, report, cgroups });
    }
    this.save('observations', reports);
    this.beforeChecksums = this.plans.map(p => this.checksum(p));
    requireThat(this.beforeChecksums[0] !== this.beforeChecksums[1], 'DATA_NOT_DISTINCT');
    this.save('checksums-before', this.beforeChecksums);
    return reports;
  }
  async connectivity() {
    const [a, b] = this.plans; const bIP = this.ip(b, 'db');
    const own = this.python(this.recordFor(b, 'http'), connectProbe(bIP, true)).stdout.trim();
    const denied = this.python(this.recordFor(a, 'http'), connectProbe(bIP, false)).stdout.trim(); requireThat(denied === 'DENIED', 'CONNECTIVITY');
    const id = this.docker.inner(['container', 'run', '-d', '--name', `bsk-es2-public-probe-${this.permit.run}`,
      '--label', `dev.bsk.test-run=${this.permit.run}`, '--label', 'dev.bsk.test-role=public-probe',
      '--network', 'bridge', '--memory', '64m', '--cpus', '0.25', '--pids-limit', '32', '--cap-drop', 'ALL',
      '--security-opt', 'no-new-privileges:true', this.imageRef], { timeout: 30000 }).stdout.trim();
    const probe = this.addAux('container', id, 'public-probe');
    const publicDenied = this.python(probe, connectProbe(bIP, false)).stdout.trim(); requireThat(publicDenied === 'DENIED', 'CONNECTIVITY');
    return { own, crossProject: denied, publicBridge: publicDenied, destinationPort: 8080,
      publishedDatabasePorts: 'none; verified by inspectLimits', boundary: 'default bridge is outside both private networks; host root is trusted' };
  }
  async loads() {
    const [a, b] = this.plans; const record = this.recordFor(a, 'http'); const evidence = {};
    for (const [type, code] of [['cpu', cpuLoad], ['pids', pidsLoad], ['memory', memoryLoad]]) {
      const before = this.cgroups(record); const r = this.python(record, code, { timeout: 15000, allowFailure: true });
      const after = this.cgroups(record); verifyLoad(type, before.values, after.values, r.status);
      if (type === 'pids') requireThat(r.stdout.trim() === 'PID_LIMIT_REACHED', 'LOAD_EVIDENCE');
      this.available(b);
      evidence[type] = { before, after, exit: r.status, projectB: 'available' };
    }
    return evidence;
  }
  admission(f) {
    const deny = (request, expected) => {
      const before = json(this.store.snapshot()); let code;
      try { this.store.claim(request, this.store.snapshot().revision); } catch (e) { code = e.code; }
      requireThat(code === expected && json(this.store.snapshot()) === before, 'ADMISSION'); return code;
    };
    const conflict = structuredClone(f.requests[0]); conflict.target.deploymentRef = 'overlap';
    const excessive = structuredClone(f.requests[0]); excessive.workloads[0].resources.cpuLimitMillis = 999999;
    // A separate authoritative test store exercises capacity without changing the live ledger.
    const capacityStore = Inventory.initialize(join(this.root, 'negative-capacity'), f.host); let capacity;
    try { capacityStore.claim(excessive, 0); } catch (e) { capacity = e.code; } requireThat(capacity === 'CAPACITY', 'ADMISSION');
    const unsupported = structuredClone(f.host); unsupported.storageMode = 'enforce';
    const storageStore = Inventory.initialize(join(this.root, 'negative-storage'), unsupported); let storage;
    try { storageStore.claim(f.requests[0], 0); } catch (e) { storage = e.code; } requireThat(storage === 'CAPABILITY', 'ADMISSION');
    const bad = structuredClone(f.requests[0]); bad.workloads[0].privileged = true;
    return { rolloutOverlap: deny(conflict, 'IDENTITY_CONFLICT'), rawPrivilege: deny(bad, 'SCHEMA'), capacity, storage };
  }
  ownershipNegatives() {
    const a = this.plans[0]; const evidence = [];
    for (const role of ['foreign-owner', 'missing-bsk-labels']) {
      const name = `bsk-es2-${role}-${this.permit.run}`;
      const args = ['volume', 'create', '--label', `dev.bsk.test-run=${this.permit.run}`, '--label', `dev.bsk.test-role=${role}`,
        '--label', `com.docker.compose.project=${a.scope}`];
      if (role === 'foreign-owner') args.push('--label', 'dev.bsk.installation=foreign-install');
      this.docker.inner([...args, name]); const record = this.addAux('volume', name, role);
      let code;
      try { planLifecycle(this.store, a.planId, 'destroy', this.reader, { confirmPlanId: a.planId, confirmDataLoss: true }); } catch (e) { code = e.code; }
      requireThat(code === 'OWNERSHIP', 'OWNERSHIP_NEGATIVE'); this.docker.inspect(record);
      evidence.push({ role, rejection: code, resourceStillPresent: true });
      this.docker.removeOwned(record); this.aux = this.aux.filter(r => r !== record);
    }
    return { actualOwnershipRejections: evidence };
  }
  async lifecycle() {
    const [a, b] = this.plans; const beforeInventory = json(this.store.snapshot());
    const stop = planLifecycle(this.store, a.planId, 'stop', this.reader); this.save('stop-intent-a', stop);
    for (const action of stop.actions) {
      const record = { kind: action.kind, id: action.id, labels: { ...action.requiredLabels, 'com.docker.compose.project': a.scope } };
      this.docker.inspect(record); this.docker.inner(['container', 'stop', '--time', '5', record.id]);
    }
    this.available(b);
    requireThat(this.checksum(b) === this.beforeChecksums[1], 'DATA');
    const down = planLifecycle(this.store, a.planId, 'down', this.reader); this.save('down-intent-a', down);
    for (const action of down.actions) this.docker.removeOwned({ kind: action.kind, id: action.id,
      labels: { ...action.requiredLabels, 'com.docker.compose.project': a.scope } });
    this.available(b);
    // Recreate only A from the same generated model to read its retained volume.
    this.docker.inner(['compose', '-p', a.scope, '-f', '/run/bsk/compose-0.json', 'up', '-d', '--pull', 'never', '--wait', '--wait-timeout', '30'], { timeout: 60000 });
    await this.wait(() => this.python(this.recordFor(a, 'http'), connectProbe(this.ip(a, 'db'), true)));
    const after = this.plans.map(p => this.checksum(p)); requireThat(json(after) === json(this.beforeChecksums), 'DATA');
    requireThat(json(this.store.snapshot()) === beforeInventory, 'INVENTORY_CHANGED'); this.save('checksums-after', after);
    return { projectBAfterStopAndDown: 'available', before: this.beforeChecksums, after, inventoryUnchanged: true };
  }
  cleanup() {
    const errors = [];
    // Cleanup never invokes Compose down, force removal, wildcard deletion or prune.
    for (const p of this.plans) for (const expected of expectedObjects(p)) {
      try {
        const r = this.docker.inner([expected.kind, 'inspect', expected.name], { allowFailure: true });
        if (r.status !== 0) { errors.push({ resource: expected.name, code: 'INSPECTION_FAILED' }); continue; }
        const actual = JSON.parse(r.stdout)[0]; const id = expected.kind === 'volume' ? actual.Name : actual.Id;
        this.docker.removeOwned({ kind: expected.kind, id, labels: { ...expected.labels, 'com.docker.compose.project': p.scope } });
      } catch (e) { errors.push({ resource: expected.name, code: e.code ?? 'CLEANUP' }); }
    }
    for (const record of this.aux.reverse()) { try { this.docker.removeOwned(record); } catch (e) { errors.push({ resource: record.id, code: e.code ?? 'CLEANUP' }); } }
    // A failure leaves the sandbox for the ephemeral runner's disposal; do not bypass ownership failures.
    let daemonUnavailableRejection = null;
    if (!errors.length && this.reader && this.outerContainer && this.plans.length > 0) {
      this.docker.inspect(this.outerContainer, true);
      this.docker.outer(['container', 'stop', '--time', '5', this.outerContainer.id]);
      try { this.reader.resources(this.plans[0]); } catch (e) { daemonUnavailableRejection = e.code; }
      requireThat(daemonUnavailableRejection === 'DOCKER_READ', 'DAEMON_NEGATIVE');
    }
    if (!errors.length) {
      for (const record of [this.outerContainer, this.outerVolume].filter(Boolean)) {
        try { this.docker.removeOwned(record, true); } catch (e) { errors.push({ resource: record.id, code: e.code ?? 'CLEANUP' }); break; }
      }
    }
    if (this.root) this.save('cleanup', { errors, daemonUnavailableRejection });
    requireThat(!errors.length, 'CLEANUP_INCOMPLETE'); return { status: 'verified-removal', errors, daemonUnavailableRejection };
  }
  async run() {
    requireThat(lstatSync(this.permit.temp).isDirectory() && !lstatSync(this.permit.temp).isSymbolicLink(), 'TEMP');
    this.root = mkdtempSync(join(this.permit.temp, `bsk-es2-evidence-${this.permit.run}-`));
    this.docker.onCommand = commands => this.save('commands', commands);
    this.socketDir = join(this.root, 'socket'); mkdirSync(this.socketDir, { mode: 0o700 });
    process.env.DOCKER_CONFIG = join(this.root, 'docker-client'); mkdirSync(process.env.DOCKER_CONFIG, { mode: 0o700 });
    this.save('run', { ...this.permit, startedAt: new Date().toISOString(), scope: 'ES2 runtime only', runtimeAuthorized: true });
    try {
      await this.check('bootstrap', () => this.bootstrap());
      await this.check('immutable-synthetic-image', () => this.image());
      const f = await this.check('atomic-inventory', () => this.claim());
      await this.check('admission-negatives', () => this.admission(f));
      await this.check('ownership-topology-and-cgroup-limits', () => this.deploy());
      await this.check('version-evidence', () => {
        const versions = { ...this.reader.versions(this.plans[0]), images,
          python: this.python(this.recordFor(this.plans[0], 'http'), 'import sys; print(sys.version)').stdout.trim() };
        this.save('versions', versions); return versions;
      });
      await this.check('private-network-denials', () => this.connectivity());
      await this.check('bounded-load-enforcement', () => this.loads());
      await this.check('ownership-and-daemon-rejections', () => this.ownershipNegatives());
      await this.check('stop-down-project-and-data-isolation', () => this.lifecycle());
    } catch { /* The owning check records a redacted failure. Remaining checks are explicitly blocked below. */ }
    finally {
      await this.check('verified-cleanup', () => this.cleanup()).catch(() => {});
      const required = ['bootstrap', 'immutable-synthetic-image', 'atomic-inventory', 'admission-negatives', 'ownership-topology-and-cgroup-limits',
        'version-evidence', 'private-network-denials', 'bounded-load-enforcement', 'ownership-and-daemon-rejections', 'stop-down-project-and-data-isolation', 'verified-cleanup'];
      for (const name of required) if (!this.checks.some(c => c.name === name)) this.checks.push({ name, status: 'blocked', code: 'PREREQUISITE' });
      this.save('commands', this.docker.commands);
      this.save('results', { commit: this.permit.commit, run: this.permit.run, checks: this.checks, remainingAcceptanceGaps: this.gaps,
        conformance: resultStatus(this.checks, this.gaps), completedAt: new Date().toISOString() });
    }
    return { directory: this.root, status: resultStatus(this.checks, this.gaps), checksPassed: this.checks.every(c => c.status === 'passed') };
  }
}
