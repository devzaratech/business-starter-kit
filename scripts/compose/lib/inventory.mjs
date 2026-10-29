import { mkdirSync, lstatSync, readFileSync, openSync, writeFileSync, fsyncSync,
  closeSync, renameSync, unlinkSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { buildPlan, admit, assertHost, hash, identity, fail } from './plan.mjs';

function directory(root) {
  try { if (!lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink()) fail('CORRUPT_INVENTORY'); }
  catch { fail('CORRUPT_INVENTORY'); }
}
function keys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join(',') === [...expected].sort().join(',');
}
function validateState(s) {
  if (!keys(s, ['version', 'revision', 'host', 'entries']) || s.version !== 1 ||
      !Number.isSafeInteger(s.revision) || s.revision < 0 || !Array.isArray(s.entries) || s.entries.length > 1000) fail('CORRUPT_INVENTORY');
  assertHost(s.host);
  const scopes = new Set(); const owners = new Set(); const previous = [];
  for (const e of s.entries) {
    if (!keys(e, ['request', 'plan', 'admission'])) fail('CORRUPT_INVENTORY');
    const plan = buildPlan(e.request);
    const owner = JSON.stringify(identity(plan.target));
    if (hash(plan) !== hash(e.plan) || scopes.has(plan.scope) || owners.has(owner)) fail('CORRUPT_INVENTORY');
    if (hash(admit(plan, s.host, previous)) !== hash(e.admission)) fail('CORRUPT_INVENTORY');
    scopes.add(plan.scope); owners.add(owner); previous.push(e);
  }
  return s;
}

export class Inventory {
  constructor(root) { this.root = resolve(root); }

  static initialize(root, host) {
    assertHost(host);
    try { mkdirSync(root, { recursive: true, mode: 0o700 }); } catch { fail('INVENTORY_WRITE'); }
    const store = new Inventory(root);
    store.lock(() => {
      if (existsSync(join(store.root, 'inventory.json'))) fail('ALREADY_INITIALIZED');
      store.persist({ version: 1, revision: 0, host: structuredClone(host), entries: [] });
    });
    return store;
  }

  lock(fn) {
    directory(this.root);
    const path = join(this.root, '.lock'); let fd;
    try { fd = openSync(path, 'wx', 0o600); }
    catch (e) { fail(e.code === 'EEXIST' ? 'INVENTORY_BUSY' : 'INVENTORY_WRITE'); }
    try { writeFileSync(fd, `${process.pid}\n`); fsyncSync(fd); closeSync(fd); fd = undefined; return fn(); }
    finally {
      if (fd !== undefined) closeSync(fd);
      unlinkSync(path);
    }
  }

  snapshot() {
    try {
      directory(this.root);
      const path = join(this.root, 'inventory.json'); const stat = lstatSync(path);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 32 * 1024 * 1024) fail('CORRUPT_INVENTORY');
      return validateState(JSON.parse(readFileSync(path, 'utf8')));
    } catch { fail('CORRUPT_INVENTORY'); }
  }

  persist(state) {
    const file = join(this.root, `.state-${randomUUID()}.tmp`); let fd;
    try {
      const data = JSON.stringify(state);
      if (Buffer.byteLength(data) > 32 * 1024 * 1024) fail('INVENTORY_WRITE');
      fd = openSync(file, 'wx', 0o600); writeFileSync(fd, data); fsyncSync(fd); closeSync(fd); fd = undefined;
      renameSync(file, join(this.root, 'inventory.json'));
      if (process.platform !== 'win32') {
        const dir = openSync(this.root, 'r'); try { fsyncSync(dir); } finally { closeSync(dir); }
      }
    } catch { fail('INVENTORY_WRITE'); }
    finally {
      if (fd !== undefined) closeSync(fd);
      if (existsSync(file)) unlinkSync(file);
    }
  }

  claim(request, expectedRevision) {
    const plan = buildPlan(request);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) fail('STALE_REVISION');
    return this.lock(() => {
      const s = this.snapshot();
      if (s.revision !== expectedRevision) fail('STALE_REVISION');
      const prior = s.entries.find(e => JSON.stringify(identity(e.plan.target)) === JSON.stringify(identity(plan.target)));
      if (prior) {
        if (prior.plan.planId !== plan.planId) fail('IDENTITY_CONFLICT');
        return s;
      }
      if (s.entries.some(e => e.plan.scope === plan.scope)) fail('SCOPE_COLLISION');
      if (s.entries.length >= 1000 || s.revision === Number.MAX_SAFE_INTEGER) fail('INVENTORY_LIMIT');
      const admission = admit(plan, s.host, s.entries);
      s.entries.push({ request: structuredClone(request), plan, admission });
      s.entries.sort((a, b) => a.plan.scope < b.plan.scope ? -1 : 1);
      s.revision++;
      this.persist(s);
      return structuredClone(s);
    });
  }
}
