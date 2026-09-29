# Foundation Guardrails — live repository reconciliation

The complete approved plan supplied on 2026-09-28 is reproduced below. Its
historical examples describe implementation intent, not current capability
claims. The approved design is now stored at
`docs/superpowers/specs/2026-09-11-bsk-golden-path-design.md`.

These reconciliation notes and the accepted PR #1 corrections take precedence
where the historical plan conflicts with the live repository:

- Keep `core-domain`, `tenancy`, `auth-rbac`, `audit` as the initial governed
  packages. Do not create the absent `event-bus` package.
- These four packages are placeholders: required/optional/provides/requires
  remain empty until corresponding implementation exists. Keep forbiddenKinds.
- Keep all current app/reference modules Preview; retain their actual names,
  kinds and implemented capabilities, without claiming runtime conformance.
- Apache-2.0 is the current core license; ADR 0004 already exists.
- Use `npm test`, `npm run build`, Maven tests and Docker Compose validation;
  `npm run test:packages` does not exist. SonarQube remains optional.
- Use `npm run architecture:test` with native Node discovery; the historical
  wildcard commands are superseded for Windows/Node 20 portability.
- Canonical schema validation now uses locked Ajv 2020 after `npm ci`.
- The original Task 3 code matched the original narrow policy. The explicit
  allowed-edge policy and independent Freedom Class checks are accepted review
  corrections, specified in `2026-09-28-foundation-review-corrections.md` and
  its linked design; they do not imply the original plan was ignored.
- Exclude architecture fixtures from production discovery. No physical moves,
  later Golden Path features, automatic merging, or maturity promotion.

## Preserved repository execution note

# BSK Foundation Guardrails Implementation Plan

Status: active execution on `feat/bsk-golden-path-foundation`.

This repository copy records the approved execution baseline. The detailed working plan was prepared outside the repository and is being reconciled against the live repository before each task. The live repository is the source of truth for existing paths, versions, licenses, and CI commands.

Key execution corrections:

- Baseline: `chore/multi-env-hardening`.
- Initial governed modules: `core-domain`, `tenancy`, `auth-rbac`, `audit`.
- `event-bus` is deferred because it does not exist in the live repository.
- Existing quality commands are Maven tests, `npm test`, Docker Compose validation, and optional SonarQube.
- BSK core license: Apache-2.0.
- Architecture test fixtures must never be discovered by repository-wide production manifest scans.

Execution follows RED -> GREEN -> REFACTOR with focused commits.

---

## Complete approved source plan (historical baseline)

# BSK Foundation Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the first executable BSK Golden Path foundation: canonical module metadata, dependency-direction guardrails, architecture checks, and CI integration without restructuring the working runtimes yet.

**Architecture:** Add a repository-neutral `bsk.module.json` manifest contract plus a Node.js architecture checker that discovers module manifests, validates their shape, resolves internal dependencies, and rejects forbidden dependency directions. Seed the manifest model on the existing P0 platform packages and current runnable apps first; later plans can move folders and expand coverage without changing the contract.

**Tech Stack:** Node.js >=20, ECMAScript modules, JSON, JSON Schema 2020-12, built-in `node:test` / `node:assert`, npm workspaces, GitHub Actions/Jenkins hooks where already present.

**Spec:** `docs/superpowers/specs/2026-09-11-bsk-golden-path-design.md`

## Global Constraints

- BSK remains polyglot, open-core, schema-first and provider-neutral.
- Canonical public contracts are the source of truth; runtime implementations do not redefine them independently.
- `kernel` must not depend on runtime frameworks, cloud SDKs, databases, Grafana, SAP, OpenFiscal or private components.
- Adapters depend on BSK ports/contracts; core modules never depend on adapters.
- OSS components never require private components.
- Compatibility must be demonstrated by executable checks, not documentation alone.
- Deployment environment and deployment target remain separate concepts.
- This plan does **not** move existing applications or packages. Guardrails land before physical repository migration.
- Existing runnable services (`api-spring`, `api-node`, `api-fastapi`, `api-php`, `web`, `worker`) must remain runnable after this plan.
- Root Node tooling remains compatible with Node.js >=20.

---

## File Structure Introduced by This Plan

```text
contracts/
└── schemas/
    └── bsk-module.schema.json            Canonical manifest schema

platform/
└── bsk-platform.json                     Platform compatibility identity

scripts/
└── architecture/
    ├── check.mjs                         CLI entry point
    ├── lib/
    │   ├── discover-manifests.mjs        Manifest discovery
    │   ├── module-manifest.mjs           Parse + semantic validation
    │   └── dependency-rules.mjs          Dependency-direction rules
    └── test/
        ├── fixtures/
        │   ├── valid/
        │   └── invalid/
        ├── module-manifest.test.mjs
        └── dependency-rules.test.mjs

packages/tenancy/bsk.module.json
packages/auth-rbac/bsk.module.json
packages/audit/bsk.module.json
packages/event-bus/bsk.module.json
apps/api-spring/bsk.module.json
apps/api-node/bsk.module.json
apps/api-fastapi/bsk.module.json
apps/api-php/bsk.module.json
apps/web/bsk.module.json
apps/worker/bsk.module.json

docs/architecture/
├── module-metadata.md                    Human-readable contract
└── decisions/
    └── 00XX-machine-readable-module-metadata.md
```

The ADR number `00XX` must be replaced during execution with the next unused sequential number found in `docs/architecture/decisions/` before the file is created.

---

### Task 1: Define the canonical BSK module manifest contract

**Files:**
- Create: `contracts/schemas/bsk-module.schema.json`
- Create: `platform/bsk-platform.json`
- Create: `docs/architecture/module-metadata.md`
- Create: `docs/architecture/decisions/<next>-machine-readable-module-metadata.md`
- Test: `scripts/architecture/test/module-manifest.test.mjs`

**Interfaces:**
- Consumes: approved Golden Path spec only.
- Produces: manifest fields `schemaVersion`, `module`, `compatibility`, `dependencies`, and `capabilities`; platform identity `platformLine`.

- [ ] **Step 1: Inspect existing ADR numbering and choose the next number**

Run:

```bash
find docs/architecture/decisions -maxdepth 1 -type f -name '[0-9][0-9][0-9][0-9]-*.md' -printf '%f\n' | sort
```

Expected: a sorted list of existing ADR files. Choose exactly the next sequential number and use it for every later reference to the new ADR.

- [ ] **Step 2: Write the failing manifest-contract test**

Create `scripts/architecture/test/module-manifest.test.mjs` initially with:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateManifestShape } from '../lib/module-manifest.mjs';

const validManifest = {
  schemaVersion: '1.0',
  module: {
    name: 'tenancy',
    version: '0.1.0',
    kind: 'capability',
    visibility: 'public',
    freedomClass: 'F1',
    supportLevel: 'GA',
    license: 'Apache-2.0'
  },
  compatibility: { bskPlatform: '1.x' },
  dependencies: {
    required: [],
    optional: [],
    forbiddenKinds: ['private-extension']
  },
  capabilities: {
    provides: ['tenancy'],
    requires: []
  }
};

test('accepts a complete BSK module manifest', () => {
  assert.deepEqual(validateManifestShape(validManifest), []);
});

test('rejects a manifest that mixes support level with freedom class', () => {
  const invalid = structuredClone(validManifest);
  invalid.module.freedomClass = 'GA';
  assert.match(validateManifestShape(invalid).join('\n'), /freedomClass/);
});

test('canonical schema declares the supported classifications', async () => {
  const schema = JSON.parse(
    await readFile(new URL('../../../contracts/schemas/bsk-module.schema.json', import.meta.url), 'utf8')
  );
  assert.deepEqual(schema.properties.module.properties.freedomClass.enum, ['F1', 'F2', 'F3']);
  assert.deepEqual(schema.properties.module.properties.supportLevel.enum, ['GA', 'Preview', 'Lab']);
});
```

- [ ] **Step 3: Run the test and verify that it fails**

Run:

```bash
node --test scripts/architecture/test/module-manifest.test.mjs
```

Expected: FAIL because `scripts/architecture/lib/module-manifest.mjs` and the canonical schema do not exist.

- [ ] **Step 4: Create the canonical JSON Schema**

Create `contracts/schemas/bsk-module.schema.json` with this contract:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://business-starter-kit.dev/schemas/bsk-module.schema.json",
  "title": "BSK Module Manifest",
  "type": "object",
  "additionalProperties": false,
  "required": ["schemaVersion", "module", "compatibility", "dependencies", "capabilities"],
  "properties": {
    "schemaVersion": { "const": "1.0" },
    "module": {
      "type": "object",
      "additionalProperties": false,
      "required": ["name", "version", "kind", "visibility", "freedomClass", "supportLevel", "license"],
      "properties": {
        "name": { "type": "string", "pattern": "^[a-z0-9][a-z0-9-]*$" },
        "version": { "type": "string", "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$" },
        "kind": {
          "enum": [
            "contract", "kernel", "capability", "runtime", "adapter", "profile",
            "compliance-kernel", "compliance-pack", "observability", "conformance",
            "deployment", "extension-contract", "application", "reference-client", "private-extension"
          ]
        },
        "visibility": { "enum": ["public", "private"] },
        "freedomClass": { "enum": ["F1", "F2", "F3"] },
        "supportLevel": { "enum": ["GA", "Preview", "Lab"] },
        "license": { "type": "string", "minLength": 1 }
      }
    },
    "compatibility": {
      "type": "object",
      "additionalProperties": false,
      "required": ["bskPlatform"],
      "properties": {
        "bskPlatform": { "type": "string", "minLength": 1 }
      }
    },
    "dependencies": {
      "type": "object",
      "additionalProperties": false,
      "required": ["required", "optional", "forbiddenKinds"],
      "properties": {
        "required": { "type": "array", "uniqueItems": true, "items": { "type": "string" } },
        "optional": { "type": "array", "uniqueItems": true, "items": { "type": "string" } },
        "forbiddenKinds": { "type": "array", "uniqueItems": true, "items": { "type": "string" } }
      }
    },
    "capabilities": {
      "type": "object",
      "additionalProperties": false,
      "required": ["provides", "requires"],
      "properties": {
        "provides": { "type": "array", "uniqueItems": true, "items": { "type": "string" } },
        "requires": { "type": "array", "uniqueItems": true, "items": { "type": "string" } }
      }
    }
  }
}
```

- [ ] **Step 5: Create platform identity metadata**

Create `platform/bsk-platform.json`:

```json
{
  "schemaVersion": "1.0",
  "platform": "business-starter-kit",
  "platformLine": "1.x",
  "manifestSchema": "contracts/schemas/bsk-module.schema.json"
}
```

- [ ] **Step 6: Implement minimal shape validation**

Create `scripts/architecture/lib/module-manifest.mjs`:

```js
const FREEDOM_CLASSES = new Set(['F1', 'F2', 'F3']);
const SUPPORT_LEVELS = new Set(['GA', 'Preview', 'Lab']);
const VISIBILITIES = new Set(['public', 'private']);
const KINDS = new Set([
  'contract', 'kernel', 'capability', 'runtime', 'adapter', 'profile',
  'compliance-kernel', 'compliance-pack', 'observability', 'conformance',
  'deployment', 'extension-contract', 'application', 'reference-client', 'private-extension'
]);

export function validateManifestShape(manifest) {
  const errors = [];
  if (manifest?.schemaVersion !== '1.0') errors.push('schemaVersion must be 1.0');

  const module = manifest?.module ?? {};
  if (!/^[a-z0-9][a-z0-9-]*$/.test(module.name ?? '')) errors.push('module.name is invalid');
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(module.version ?? '')) errors.push('module.version is invalid');
  if (!KINDS.has(module.kind)) errors.push('module.kind is invalid');
  if (!VISIBILITIES.has(module.visibility)) errors.push('module.visibility is invalid');
  if (!FREEDOM_CLASSES.has(module.freedomClass)) errors.push('module.freedomClass is invalid');
  if (!SUPPORT_LEVELS.has(module.supportLevel)) errors.push('module.supportLevel is invalid');
  if (typeof module.license !== 'string' || module.license.length === 0) errors.push('module.license is required');

  if (typeof manifest?.compatibility?.bskPlatform !== 'string') errors.push('compatibility.bskPlatform is required');

  for (const field of ['required', 'optional', 'forbiddenKinds']) {
    if (!Array.isArray(manifest?.dependencies?.[field])) errors.push(`dependencies.${field} must be an array`);
  }
  for (const field of ['provides', 'requires']) {
    if (!Array.isArray(manifest?.capabilities?.[field])) errors.push(`capabilities.${field} must be an array`);
  }
  return errors;
}

export function parseManifest(text, source = '<memory>') {
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch (error) {
    throw new Error(`${source}: invalid JSON: ${error.message}`);
  }
  const errors = validateManifestShape(manifest);
  if (errors.length > 0) throw new Error(`${source}:\n- ${errors.join('\n- ')}`);
  return manifest;
}
```

- [ ] **Step 7: Run the focused test**

Run:

```bash
node --test scripts/architecture/test/module-manifest.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Document the contract and decision**

Create `docs/architecture/module-metadata.md` describing each field exactly as defined above, including the invariant that Freedom Class and Support Level are independent axes. Create the numbered ADR with these exact sections:

```markdown
# ADR <number>: Machine-readable BSK module metadata

## Status
Accepted

## Context
BSK is a modular polyglot monorepo. Architecture rules cannot remain prose-only as runtimes, adapters, compliance packs and private extensions grow.

## Decision
Every BSK module brought under Golden Path governance uses `bsk.module.json` conforming to `contracts/schemas/bsk-module.schema.json`. Freedom Class and Support Level are separate fields. Dependency direction is checked in CI.

## Consequences
Architecture rules become executable and modules can evolve/version independently. Adoption is incremental: existing modules receive manifests without requiring an immediate directory migration.
```

- [ ] **Step 9: Commit Task 1**

```bash
git add contracts/schemas/bsk-module.schema.json platform/bsk-platform.json \
  scripts/architecture/lib/module-manifest.mjs scripts/architecture/test/module-manifest.test.mjs \
  docs/architecture/module-metadata.md docs/architecture/decisions/
git commit -m "feat(architecture): define BSK module metadata contract"
```

---

### Task 2: Discover manifests and reject duplicate module identities

**Files:**
- Create: `scripts/architecture/lib/discover-manifests.mjs`
- Modify: `scripts/architecture/test/module-manifest.test.mjs`
- Create: `scripts/architecture/test/fixtures/valid/packages/tenancy/bsk.module.json`
- Create: `scripts/architecture/test/fixtures/invalid/duplicate-a/bsk.module.json`
- Create: `scripts/architecture/test/fixtures/invalid/duplicate-b/bsk.module.json`

**Interfaces:**
- Consumes: `parseManifest(text, source)` from Task 1.
- Produces: `discoverManifests(rootDir): Promise<Array<{ path: string, manifest: object }>>`.

- [ ] **Step 1: Add failing discovery tests**

Append to `scripts/architecture/test/module-manifest.test.mjs`:

```js
import { discoverManifests } from '../lib/discover-manifests.mjs';

const fixtureUrl = new URL('./fixtures/', import.meta.url);

test('discovers bsk.module.json recursively', async () => {
  const modules = await discoverManifests(new URL('valid/', fixtureUrl));
  assert.equal(modules.length, 1);
  assert.equal(modules[0].manifest.module.name, 'tenancy');
});

test('rejects duplicate module names', async () => {
  await assert.rejects(
    () => discoverManifests(new URL('invalid/', fixtureUrl)),
    /duplicate module name: duplicate-module/
  );
});
```

- [ ] **Step 2: Add fixture manifests**

Use this manifest for `valid/packages/tenancy/bsk.module.json`:

```json
{
  "schemaVersion": "1.0",
  "module": { "name": "tenancy", "version": "0.1.0", "kind": "capability", "visibility": "public", "freedomClass": "F1", "supportLevel": "GA", "license": "Apache-2.0" },
  "compatibility": { "bskPlatform": "1.x" },
  "dependencies": { "required": [], "optional": [], "forbiddenKinds": ["private-extension"] },
  "capabilities": { "provides": ["tenancy"], "requires": [] }
}
```

Use the same complete shape for both duplicate fixtures, with `module.name` set to `duplicate-module` and different `module.version` values (`0.1.0`, `0.2.0`).

- [ ] **Step 3: Run tests and verify failure**

```bash
node --test scripts/architecture/test/module-manifest.test.mjs
```

Expected: FAIL because `discover-manifests.mjs` does not exist.

- [ ] **Step 4: Implement recursive discovery**

Create `scripts/architecture/lib/discover-manifests.mjs`:

```js
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative, resolve } from 'node:path';
import { parseManifest } from './module-manifest.mjs';

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'target', 'coverage']);

export async function discoverManifests(rootDir) {
  const root = rootDir instanceof URL ? fileURLToPath(rootDir) : resolve(rootDir);
  const found = [];

  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) await walk(join(dir, entry.name));
        continue;
      }
      if (entry.name !== 'bsk.module.json') continue;
      const path = join(dir, entry.name);
      const manifest = parseManifest(await readFile(path, 'utf8'), relative(root, path));
      found.push({ path, manifest });
    }
  }

  await walk(root);
  const seen = new Map();
  for (const item of found) {
    const name = item.manifest.module.name;
    if (seen.has(name)) throw new Error(`duplicate module name: ${name}`);
    seen.set(name, item.path);
  }
  return found.sort((a, b) => a.manifest.module.name.localeCompare(b.manifest.module.name));
}
```

- [ ] **Step 5: Run tests**

```bash
node --test scripts/architecture/test/module-manifest.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add scripts/architecture/lib/discover-manifests.mjs scripts/architecture/test/
git commit -m "feat(architecture): discover BSK module manifests"
```

---

### Task 3: Encode dependency-direction rules as executable checks

**Files:**
- Create: `scripts/architecture/lib/dependency-rules.mjs`
- Create: `scripts/architecture/test/dependency-rules.test.mjs`

**Interfaces:**
- Consumes: discovered module records from Task 2.
- Produces: `validateDependencyGraph(modules): string[]`, where an empty array means the graph is conformant.

- [ ] **Step 1: Write failing dependency-rule tests**

Create `scripts/architecture/test/dependency-rules.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDependencyGraph } from '../lib/dependency-rules.mjs';

function record(name, kind, required = [], visibility = 'public') {
  return {
    path: `${name}/bsk.module.json`,
    manifest: {
      schemaVersion: '1.0',
      module: {
        name, version: '0.1.0', kind, visibility,
        freedomClass: visibility === 'public' ? 'F1' : 'F3',
        supportLevel: 'GA', license: visibility === 'public' ? 'Apache-2.0' : 'Proprietary'
      },
      compatibility: { bskPlatform: '1.x' },
      dependencies: { required, optional: [], forbiddenKinds: [] },
      capabilities: { provides: [], requires: [] }
    }
  };
}

test('kernel cannot depend on adapter', () => {
  const errors = validateDependencyGraph([
    record('kernel-security', 'kernel', ['postgres-adapter']),
    record('postgres-adapter', 'adapter')
  ]);
  assert.match(errors.join('\n'), /kernel-security.*adapter/);
});

test('public OSS module cannot depend on private extension', () => {
  const errors = validateDependencyGraph([
    record('audit', 'capability', ['sap-private']),
    record('sap-private', 'private-extension', [], 'private')
  ]);
  assert.match(errors.join('\n'), /public module audit.*private module sap-private/);
});

test('adapter may depend on public contract', () => {
  assert.deepEqual(validateDependencyGraph([
    record('storage-contract', 'contract'),
    record('s3-adapter', 'adapter', ['storage-contract'])
  ]), []);
});

test('reports unresolved required dependency', () => {
  assert.match(
    validateDependencyGraph([record('audit', 'capability', ['missing-module'])]).join('\n'),
    /unresolved required dependency missing-module/
  );
});
```

- [ ] **Step 2: Run tests and verify failure**

```bash
node --test scripts/architecture/test/dependency-rules.test.mjs
```

Expected: FAIL because `dependency-rules.mjs` does not exist.

- [ ] **Step 3: Implement dependency-direction validation**

Create `scripts/architecture/lib/dependency-rules.mjs`:

```js
const CORE_KINDS = new Set(['contract', 'kernel', 'capability', 'compliance-kernel', 'extension-contract']);
const FORBIDDEN_FROM_CORE = new Set(['runtime', 'adapter', 'deployment', 'application', 'reference-client', 'private-extension']);

export function validateDependencyGraph(modules) {
  const errors = [];
  const byName = new Map(modules.map((item) => [item.manifest.module.name, item]));

  for (const item of modules) {
    const source = item.manifest.module;
    const deps = item.manifest.dependencies.required;

    for (const dependencyName of deps) {
      const targetRecord = byName.get(dependencyName);
      if (!targetRecord) {
        errors.push(`${source.name}: unresolved required dependency ${dependencyName}`);
        continue;
      }
      const target = targetRecord.manifest.module;

      if (CORE_KINDS.has(source.kind) && FORBIDDEN_FROM_CORE.has(target.kind)) {
        errors.push(`${source.name}: ${source.kind} must not depend on ${target.kind} module ${target.name}`);
      }
      if (source.visibility === 'public' && target.visibility === 'private') {
        errors.push(`public module ${source.name} must not depend on private module ${target.name}`);
      }
      if (item.manifest.dependencies.forbiddenKinds.includes(target.kind)) {
        errors.push(`${source.name}: dependency ${target.name} has forbidden kind ${target.kind}`);
      }
    }
  }
  return errors;
}
```

- [ ] **Step 4: Run focused tests**

```bash
node --test scripts/architecture/test/dependency-rules.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Run all architecture tests**

```bash
node --test scripts/architecture/test/*.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add scripts/architecture/lib/dependency-rules.mjs scripts/architecture/test/dependency-rules.test.mjs
git commit -m "feat(architecture): enforce BSK dependency direction"
```

---

### Task 4: Seed manifests on the existing P0 platform packages

**Files:**
- Create: `packages/tenancy/bsk.module.json`
- Create: `packages/auth-rbac/bsk.module.json`
- Create: `packages/audit/bsk.module.json`
- Create: `packages/event-bus/bsk.module.json`
- Test: existing architecture tests plus repository check from Task 6.

**Interfaces:**
- Consumes: manifest contract from Task 1.
- Produces: first governed capabilities: `tenancy`, `auth-rbac`, `audit`, `event-bus`.

- [ ] **Step 1: Verify these package directories still exist before writing manifests**

```bash
for d in packages/tenancy packages/auth-rbac packages/audit packages/event-bus; do
  test -d "$d" || { echo "missing expected package: $d" >&2; exit 1; }
done
```

Expected: command exits 0. If the current repository has renamed one of these packages, stop this task and update the plan paths before implementation; do not create duplicate replacement directories.

- [ ] **Step 2: Add the tenancy manifest**

Create `packages/tenancy/bsk.module.json`:

```json
{
  "schemaVersion": "1.0",
  "module": { "name": "tenancy", "version": "0.1.0", "kind": "capability", "visibility": "public", "freedomClass": "F1", "supportLevel": "Preview", "license": "Apache-2.0" },
  "compatibility": { "bskPlatform": "1.x" },
  "dependencies": { "required": [], "optional": [], "forbiddenKinds": ["runtime", "adapter", "deployment", "application", "reference-client", "private-extension"] },
  "capabilities": { "provides": ["tenancy"], "requires": [] }
}
```

- [ ] **Step 3: Add the auth/RBAC manifest**

Create `packages/auth-rbac/bsk.module.json`:

```json
{
  "schemaVersion": "1.0",
  "module": { "name": "auth-rbac", "version": "0.1.0", "kind": "capability", "visibility": "public", "freedomClass": "F1", "supportLevel": "Preview", "license": "Apache-2.0" },
  "compatibility": { "bskPlatform": "1.x" },
  "dependencies": { "required": ["tenancy"], "optional": [], "forbiddenKinds": ["runtime", "adapter", "deployment", "application", "reference-client", "private-extension"] },
  "capabilities": { "provides": ["authentication-hooks", "rbac"], "requires": ["tenancy"] }
}
```

- [ ] **Step 4: Add the audit manifest**

Create `packages/audit/bsk.module.json`:

```json
{
  "schemaVersion": "1.0",
  "module": { "name": "audit", "version": "0.1.0", "kind": "capability", "visibility": "public", "freedomClass": "F1", "supportLevel": "Preview", "license": "Apache-2.0" },
  "compatibility": { "bskPlatform": "1.x" },
  "dependencies": { "required": ["tenancy"], "optional": ["auth-rbac"], "forbiddenKinds": ["runtime", "adapter", "deployment", "application", "reference-client", "private-extension"] },
  "capabilities": { "provides": ["audit"], "requires": ["tenancy"] }
}
```

- [ ] **Step 5: Add the event-bus manifest**

Create `packages/event-bus/bsk.module.json`:

```json
{
  "schemaVersion": "1.0",
  "module": { "name": "event-bus", "version": "0.1.0", "kind": "capability", "visibility": "public", "freedomClass": "F1", "supportLevel": "Preview", "license": "Apache-2.0" },
  "compatibility": { "bskPlatform": "1.x" },
  "dependencies": { "required": ["tenancy"], "optional": ["audit"], "forbiddenKinds": ["runtime", "adapter", "deployment", "application", "reference-client", "private-extension"] },
  "capabilities": { "provides": ["events"], "requires": ["tenancy"] }
}
```

- [ ] **Step 6: Run existing package tests before architecture checks**

```bash
npm run test:packages
```

Expected: existing package tests PASS. A pre-existing failing package must be recorded before continuing; do not mask it by changing architecture metadata.

- [ ] **Step 7: Commit Task 4**

```bash
git add packages/tenancy/bsk.module.json packages/auth-rbac/bsk.module.json \
  packages/audit/bsk.module.json packages/event-bus/bsk.module.json
git commit -m "chore(architecture): govern P0 packages with BSK manifests"
```

---

### Task 5: Seed manifests on the currently runnable polyglot apps

**Files:**
- Create: `apps/api-spring/bsk.module.json`
- Create: `apps/api-node/bsk.module.json`
- Create: `apps/api-fastapi/bsk.module.json`
- Create: `apps/api-php/bsk.module.json`
- Create: `apps/web/bsk.module.json`
- Create: `apps/worker/bsk.module.json`

**Interfaces:**
- Consumes: P0 capabilities from Task 4.
- Produces: machine-readable identities for current Java, Node, Python, PHP, React and worker applications without moving them into final `runtimes/` layout yet.

- [ ] **Step 1: Verify the current application directories**

```bash
for d in apps/api-spring apps/api-node apps/api-fastapi apps/api-php apps/web apps/worker; do
  test -d "$d" || { echo "missing expected app: $d" >&2; exit 1; }
done
```

Expected: exit 0. If a runtime has moved, update the manifest target path to the real current path before continuing.

- [ ] **Step 2: Create the Java runtime-app manifest**

Create `apps/api-spring/bsk.module.json`:

```json
{
  "schemaVersion": "1.0",
  "module": { "name": "api-spring", "version": "0.1.0", "kind": "runtime", "visibility": "public", "freedomClass": "F1", "supportLevel": "Preview", "license": "Apache-2.0" },
  "compatibility": { "bskPlatform": "1.x" },
  "dependencies": { "required": ["tenancy", "auth-rbac", "audit", "event-bus"], "optional": [], "forbiddenKinds": ["private-extension"] },
  "capabilities": { "provides": ["runtime.java", "profile.web-api"], "requires": ["tenancy", "rbac", "audit", "events"] }
}
```

- [ ] **Step 3: Create equivalent Node, Python and PHP runtime manifests**

Create the following files using the exact same structure as `api-spring`, changing only `module.name` and the runtime capability:

```text
apps/api-node/bsk.module.json     name=api-node     provides runtime.node, profile.web-api
apps/api-fastapi/bsk.module.json  name=api-fastapi  provides runtime.python, profile.web-api
apps/api-php/bsk.module.json      name=api-php      provides runtime.php, profile.web-api
```

Keep all four at `supportLevel: "Preview"` in this phase. No runtime is promoted to GA until the dedicated runtime-conformance plan is implemented.

- [ ] **Step 4: Create the React reference-client manifest**

Create `apps/web/bsk.module.json`:

```json
{
  "schemaVersion": "1.0",
  "module": { "name": "web", "version": "0.1.0", "kind": "reference-client", "visibility": "public", "freedomClass": "F1", "supportLevel": "Preview", "license": "Apache-2.0" },
  "compatibility": { "bskPlatform": "1.x" },
  "dependencies": { "required": [], "optional": [], "forbiddenKinds": ["kernel", "private-extension"] },
  "capabilities": { "provides": ["reference-client.react"], "requires": ["http-contract"] }
}
```

- [ ] **Step 5: Create the async worker manifest**

Create `apps/worker/bsk.module.json`:

```json
{
  "schemaVersion": "1.0",
  "module": { "name": "worker", "version": "0.1.0", "kind": "application", "visibility": "public", "freedomClass": "F1", "supportLevel": "Preview", "license": "Apache-2.0" },
  "compatibility": { "bskPlatform": "1.x" },
  "dependencies": { "required": ["event-bus"], "optional": ["audit", "tenancy"], "forbiddenKinds": ["private-extension"] },
  "capabilities": { "provides": ["profile.async-worker"], "requires": ["events"] }
}
```

- [ ] **Step 6: Run each existing lightweight app test suite**

Run the existing root scripts if present:

```bash
npm run test:node
npm run test:web
npm run test:worker
```

Then run Java tests:

```bash
mvn -f apps/api-spring/pom.xml test
```

For FastAPI and PHP, run the repository's existing documented test/health validation commands rather than inventing new framework migrations in this task. The expected result is that adding metadata changes no runtime behavior.

- [ ] **Step 7: Commit Task 5**

```bash
git add apps/*/bsk.module.json
git commit -m "chore(architecture): describe existing polyglot apps"
```

---

### Task 6: Add the repository-level architecture check command

**Files:**
- Create: `scripts/architecture/check.mjs`
- Modify: `package.json`
- Modify: `Makefile`
- Test: `scripts/architecture/test/*.test.mjs`

**Interfaces:**
- Consumes: `discoverManifests()` and `validateDependencyGraph()`.
- Produces: CLI process exit 0 on conformance; non-zero with one error per line on architecture violations.

- [ ] **Step 1: Write a failing CLI smoke test**

Append to `scripts/architecture/test/dependency-rules.test.mjs`:

```js
import { spawnSync } from 'node:child_process';

 test('repository architecture check is executable', () => {
  const result = spawnSync(process.execPath, ['scripts/architecture/check.mjs', '--root', '.'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /BSK architecture check: PASS/);
});
```

- [ ] **Step 2: Run the test and verify failure**

```bash
node --test scripts/architecture/test/dependency-rules.test.mjs
```

Expected: FAIL because `scripts/architecture/check.mjs` does not exist.

- [ ] **Step 3: Implement the architecture check CLI**

Create `scripts/architecture/check.mjs`:

```js
#!/usr/bin/env node
import { resolve } from 'node:path';
import { discoverManifests } from './lib/discover-manifests.mjs';
import { validateDependencyGraph } from './lib/dependency-rules.mjs';

const rootIndex = process.argv.indexOf('--root');
const root = rootIndex >= 0 ? process.argv[rootIndex + 1] : '.';
if (!root) {
  console.error('Usage: node scripts/architecture/check.mjs [--root <path>]');
  process.exit(2);
}

try {
  const modules = await discoverManifests(resolve(root));
  const errors = validateDependencyGraph(modules);
  if (errors.length > 0) {
    console.error('BSK architecture check: FAIL');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`BSK architecture check: PASS (${modules.length} governed modules)`);
} catch (error) {
  console.error('BSK architecture check: FAIL');
  console.error(error.message);
  process.exit(1);
}
```

- [ ] **Step 4: Wire npm and Makefile entry points**

Add this root script to `package.json` without removing existing scripts:

```json
"architecture:check": "node scripts/architecture/check.mjs --root ."
```

Add this target to `Makefile` while preserving current targets:

```make
architecture-check:
	npm run architecture:check
```

If `.PHONY` is already declared, append `architecture-check` to it; otherwise add:

```make
.PHONY: architecture-check
```

- [ ] **Step 5: Run the complete architecture suite**

```bash
node --test scripts/architecture/test/*.test.mjs
npm run architecture:check
```

Expected:

```text
BSK architecture check: PASS (... governed modules)
```

- [ ] **Step 6: Run the existing root package suite**

```bash
npm run test:packages
```

Expected: PASS.

- [ ] **Step 7: Commit Task 6**

```bash
git add scripts/architecture/check.mjs package.json Makefile scripts/architecture/test/
git commit -m "feat(architecture): add executable BSK architecture check"
```

---

### Task 7: Put architecture guardrails into CI without coupling them to one CI vendor

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `Jenkinsfile`
- Modify: `docs/ci-cd/ci-cd-strategy.md`

**Interfaces:**
- Consumes: `npm run architecture:check` from Task 6.
- Produces: vendor-neutral quality gate callable from GitHub Actions, Jenkins and locally.

- [ ] **Step 1: Confirm both CI files exist**

```bash
test -f .github/workflows/ci.yml
test -f Jenkinsfile
```

Expected: exit 0. If one CI engine has intentionally been removed since the latest repository snapshot, keep the vendor-neutral npm command and modify only CI engines still officially supported; document that repository fact in `docs/ci-cd/ci-cd-strategy.md` before proceeding.

- [ ] **Step 2: Add architecture check to GitHub Actions**

In the existing Node/quality job after dependency installation and before package integration tests, add exactly one step:

```yaml
- name: Validate BSK architecture
  run: npm run architecture:check
```

Do not duplicate manifest logic in YAML.

- [ ] **Step 3: Add architecture check to Jenkins**

In the existing quality/test stage after root npm dependencies are available, add:

```groovy
sh 'npm run architecture:check'
```

Do not reimplement the checker in Groovy.

- [ ] **Step 4: Document CI ownership**

Add a section to `docs/ci-cd/ci-cd-strategy.md`:

```markdown
## Architecture gate

`npm run architecture:check` is the canonical architecture quality gate. CI engines invoke this command; they do not own its policy. A module manifest or dependency-direction violation must therefore fail consistently in local development, GitHub Actions and Jenkins.
```

- [ ] **Step 5: Validate workflow syntax and run local quality gates**

Run:

```bash
npm run architecture:check
node --test scripts/architecture/test/*.test.mjs
```

Then run the repository's existing workflow/YAML validation command if one exists under `scripts/quality/`; otherwise parse `.github/workflows/ci.yml` using the existing YAML validation mechanism already used by this repository. Do not add a second YAML parser solely for this task.

Expected: all checks PASS.

- [ ] **Step 6: Commit Task 7**

```bash
git add .github/workflows/ci.yml Jenkinsfile docs/ci-cd/ci-cd-strategy.md
git commit -m "ci: enforce BSK architecture guardrails"
```

---

### Task 8: Update repository documentation and prove no physical migration happened accidentally

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture/architecture-overview.md`
- Modify: `docs/architecture/module-boundaries.md`
- Modify: `docs/architecture/repository-map.md`
- Modify: `docs/architecture/repository-structure.txt`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: all deliverables from Tasks 1-7.
- Produces: documented migration state: executable governance exists, but legacy physical paths remain until later plans.

- [ ] **Step 1: Add Golden Path foundation status to README**

Add a concise section stating:

```markdown
## Golden Path architecture governance

BSK uses machine-readable `bsk.module.json` manifests and `npm run architecture:check` to enforce module identity and dependency direction. This checkpoint adds governance before repository migration: existing `apps/` and `packages/` paths remain valid until dedicated migration plans move them behind the approved `contracts/`, `kernel/`, `capabilities/`, `runtimes/` and `adapters/` boundaries.
```

- [ ] **Step 2: Update architecture docs without claiming unfinished migrations**

In `architecture-overview.md`, `module-boundaries.md`, and `repository-map.md`, document these facts exactly:

```text
Canonical target architecture: approved Golden Path structure.
Current physical layout: legacy-compatible apps/packages structure.
Current enforcement: module metadata + dependency graph checks.
Migration policy: guardrails first, directory moves in dedicated plans.
```

Do not rewrite existing P0/P1/P2 historical documentation as though those checkpoints never existed.

- [ ] **Step 3: Update repository-structure.txt from the actual tree**

Regenerate or edit `docs/architecture/repository-structure.txt` using the repository's existing tree-generation convention. Ensure the newly created files appear and existing services remain in their current locations.

- [ ] **Step 4: Add the changelog checkpoint**

At the top of `CHANGELOG.md`, add an unreleased section:

```markdown
## Unreleased - Golden Path foundation guardrails

- Added canonical machine-readable BSK module metadata.
- Added executable dependency-direction architecture checks.
- Added initial governance manifests for P0 packages and current polyglot applications.
- Added architecture checks to local and CI quality gates.
- Kept the existing physical repository layout intact pending dedicated migration plans.
```

- [ ] **Step 5: Run the full verification available for this checkpoint**

```bash
npm run architecture:check
node --test scripts/architecture/test/*.test.mjs
npm run test:packages
npm run test:node
npm run test:web
npm run test:worker
mvn -f apps/api-spring/pom.xml test
```

Then run existing repository quality/sanitization checks under `scripts/quality/` and the current Compose validation command. Expected: no new failures attributable to architecture metadata or guardrails.

- [ ] **Step 6: Verify this plan did not move runtime directories**

```bash
for d in apps/api-spring apps/api-node apps/api-fastapi apps/api-php apps/web apps/worker; do
  test -d "$d" || exit 1
done
```

Expected: exit 0.

- [ ] **Step 7: Commit Task 8**

```bash
git add README.md CHANGELOG.md docs/architecture/
git commit -m "docs: establish Golden Path governance checkpoint"
```

---

## Plan Self-Review

### Spec coverage for this sub-project

This plan intentionally implements only the first independently testable subsystem of the approved spec:

- machine-readable module metadata;
- separation of Freedom Class and Support Level;
- executable dependency-direction rules;
- OSS-to-private dependency prohibition;
- initial governance of existing P0 capabilities and polyglot apps;
- vendor-neutral CI invocation;
- documentation of the transition without prematurely moving working code.

The following approved areas are intentionally assigned to later implementation plans rather than partially implemented here: canonical HTTP/event/OTel contracts, runtime conformance, observability distribution, security/tenancy hardening, environment/target Compose refactor, CLI `bsk`, compliance kernel and packs, resilience primitives, supply-chain/SBOM gates, React contract generation, cloud targets, SAP/Oracle Labs, and physical monorepo migration.

### Type / naming consistency

The canonical manifest filename is `bsk.module.json`. The checker discovers only that filename. Module dependencies refer to `module.name`. Freedom Class values are exactly `F1`, `F2`, `F3`; Support Level values are exactly `GA`, `Preview`, `Lab`. Platform compatibility starts at `1.x`.

### Execution prerequisite

Before execution, place the approved design spec at:

```text
docs/superpowers/specs/2026-09-11-bsk-golden-path-design.md
```

and place this plan at:

```text
docs/superpowers/plans/2026-09-11-bsk-foundation-guardrails.md
```

Execution must use the current repository state as the source of truth. Where a verification step explicitly says to stop if an expected historical path no longer exists, update the plan path before implementation rather than recreating obsolete structure.
