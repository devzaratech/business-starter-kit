import { mkdirSync, lstatSync, readFileSync, openSync, writeFileSync, fsyncSync, closeSync,
  renameSync, unlinkSync, existsSync, fstatSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateInput, validateSnapshot, validateTransaction, validateMatch, owner, bindingKey,
  canonical, hash, fail, version, maxBytes } from './model.mjs';

const keys = (v, expected) => v && !Array.isArray(v) && typeof v === 'object' && Object.keys(v).sort().join(',') === [...expected].sort().join(',');
function directory(root) {
  const stat = lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('REGISTRY_PATH');
}
function ownersFor(routes) {
  const map = new Map();
  for (const r of routes) map.set(r.spec.hostname, { hostname: r.spec.hostname,
    projectRef: r.metadata.projectRef, environmentRef: r.metadata.environmentRef });
  return [...map.values()];
}
function validateOwners(owners, snapshot) {
  if (!Array.isArray(owners) || owners.length > 1000 || new Set(owners.map(o => o?.hostname)).size !== owners.length) fail('CORRUPT_REGISTRY');
  for (const o of owners) {
    if (!keys(o, ['hostname', 'projectRef', 'environmentRef'])) fail('CORRUPT_REGISTRY');
    validateMatch(o.hostname, '/');
    if (!snapshot.input.declarations.resources.some(r => r.kind === 'Environment' &&
      r.metadata.projectRef === o.projectRef && r.metadata.name === o.environmentRef)) fail('CORRUPT_REGISTRY');
  }
  for (const r of snapshot.input.routes) if (!owners.some(o => o.hostname === r.spec.hostname && owner(o) === owner(r.metadata))) fail('CORRUPT_REGISTRY');
}

/** One authoritative, trusted local directory per installation, covering all gateways. */
export class RouteRegistry {
  constructor(root, { installationRef, authorize } = {}) {
    if (typeof root !== 'string' || !root || root.startsWith('-') || /^[\\/]{2}|^[a-z][a-z0-9+.-]*:\/\//i.test(root)) fail('REGISTRY_PATH');
    this.root = resolve(root); this.installationRef = installationRef; this.authorize = authorize;
  }

  static initialize(root, input, options = {}) {
    const desired = validateInput(input);
    if (desired.routes.length) fail('INITIAL_ROUTES');
    if (options.installationRef !== undefined && options.installationRef !== desired.installationRef) fail('REGISTRY_SCOPE');
    const store = new RouteRegistry(root, { ...options, installationRef: desired.installationRef });
    try { mkdirSync(store.root, { recursive: true, mode: 0o700 }); } catch { fail('REGISTRY_WRITE'); }
    store.lock(() => {
      if (existsSync(join(store.root, 'registry.json'))) fail('ALREADY_INITIALIZED');
      store.persist({ snapshot: { apiVersion: version, kind: 'RouteRegistrySnapshot', generation: 0, input: desired },
        hostnameOwners: ownersFor(desired.routes) });
    });
    return store;
  }

  lock(fn) {
    try { directory(this.root); } catch { fail('REGISTRY_PATH'); }
    const path = join(this.root, '.lock'); let fd; let held;
    try { fd = openSync(path, 'wx', 0o600); held = fstatSync(fd); }
    catch (e) { fail(e.code === 'EEXIST' ? 'REGISTRY_BUSY' : 'REGISTRY_WRITE'); }
    try {
      try {
        writeFileSync(fd, JSON.stringify({ pid: process.pid, token: randomUUID() })); fsyncSync(fd);
        closeSync(fd); fd = undefined;
      } catch { fail('REGISTRY_WRITE'); }
      return fn();
    } finally {
      if (fd !== undefined) closeSync(fd);
      // Never remove a lock replaced by another filesystem actor.
      let actual; try { actual = lstatSync(path); } catch { fail('REGISTRY_LOCK_CHANGED'); }
      if (actual.isSymbolicLink() || actual.dev !== held.dev || actual.ino !== held.ino) fail('REGISTRY_LOCK_CHANGED');
      try { unlinkSync(path); } catch { fail('REGISTRY_LOCK_CHANGED'); }
    }
  }

  read() {
    let state;
    try {
      directory(this.root);
      const path = join(this.root, 'registry.json'); const stat = lstatSync(path);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2 * maxBytes) fail('CORRUPT_REGISTRY');
      state = JSON.parse(readFileSync(path, 'utf8'));
      if (!keys(state, ['snapshot', 'hostnameOwners', 'checksum']) || typeof state.checksum !== 'string' ||
        hash({ snapshot: state.snapshot, hostnameOwners: state.hostnameOwners }) !== state.checksum) fail('CORRUPT_REGISTRY');
      state.snapshot = validateSnapshot(state.snapshot); validateOwners(state.hostnameOwners, state.snapshot);
    } catch { fail('CORRUPT_REGISTRY'); }
    if (this.installationRef !== undefined && this.installationRef !== state.snapshot.input.installationRef) fail('REGISTRY_SCOPE');
    return state;
  }

  snapshot() { return structuredClone(this.read().snapshot); }

  persist({ snapshot, hostnameOwners }) {
    const body = canonical({ snapshot, hostnameOwners }, true);
    const data = JSON.stringify({ ...body, checksum: hash(body) });
    if (Buffer.byteLength(data) > 2 * maxBytes) fail('REGISTRY_LIMIT');
    const file = join(this.root, `.state-${randomUUID()}.tmp`); let fd;
    try {
      fd = openSync(file, 'wx', 0o600); writeFileSync(fd, data); fsyncSync(fd); closeSync(fd); fd = undefined;
      renameSync(file, join(this.root, 'registry.json'));
      if (process.platform !== 'win32') {
        const dir = openSync(this.root, 'r'); try { fsyncSync(dir); } finally { closeSync(dir); }
      }
    } catch { fail('REGISTRY_WRITE'); }
    finally { if (fd !== undefined) closeSync(fd); }
    // Interrupted temporary files are never promoted or used as committed state.
  }

  transact(request, expectedGeneration) {
    const tx = validateTransaction(request);
    if (!Number.isSafeInteger(expectedGeneration) || expectedGeneration < 0) fail('STALE_GENERATION');
    return this.lock(() => {
      const state = this.read(); const { snapshot, hostnameOwners } = state;
      if (snapshot.generation !== expectedGeneration) fail('STALE_GENERATION');
      if (snapshot.generation === Number.MAX_SAFE_INTEGER) fail('REGISTRY_LIMIT');
      const before = structuredClone(snapshot.input.routes);
      if (tx.action === 'claim') {
        for (const r of tx.routes) {
          const prior = hostnameOwners.find(o => o.hostname === r.spec.hostname);
          if (prior && owner(prior) !== owner(r.metadata)) fail('HOSTNAME_OWNERSHIP');
        }
        snapshot.input.routes.push(...tx.routes);
      } else if (tx.action === 'release') {
        for (const ref of tx.bindingRefs) {
          const i = snapshot.input.routes.findIndex(r => bindingKey(r) === bindingKey({ metadata: ref }));
          if (i < 0) fail('UNRESOLVED_REFERENCE');
          snapshot.input.routes.splice(i, 1);
        }
      } else {
        const prior = hostnameOwners.find(o => o.hostname === tx.hostname);
        if (!prior || owner(prior) !== owner(tx.from)) fail('HOSTNAME_OWNERSHIP');
        if (tx.routes.some(r => r.spec.hostname !== tx.hostname || owner(r.metadata) !== owner(tx.to))) fail('REBIND_SCOPE');
        snapshot.input.routes = snapshot.input.routes.filter(r => r.spec.hostname !== tx.hostname);
        snapshot.input.routes.push(...tx.routes);
        Object.assign(prior, tx.to);
      }
      snapshot.input = validateInput(snapshot.input);
      for (const o of ownersFor(snapshot.input.routes)) if (!hostnameOwners.some(p => p.hostname === o.hostname)) hostnameOwners.push(o);
      validateOwners(hostnameOwners, snapshot);
      if (typeof this.authorize !== 'function') fail('AUTHORIZATION_REQUIRED');
      // This hook is a trusted embedding boundary, not authentication from claimed IDs.
      let allowed;
      try { allowed = this.authorize(structuredClone({ action: tx.action, installationRef: snapshot.input.installationRef,
        expectedGeneration, transaction: tx, before, after: snapshot.input.routes })); } catch { fail('AUTHORIZATION_REQUIRED'); }
      if (allowed !== true) fail('AUTHORIZATION_REQUIRED');
      snapshot.generation++;
      this.persist({ snapshot, hostnameOwners });
      return structuredClone(snapshot);
    });
  }
}
