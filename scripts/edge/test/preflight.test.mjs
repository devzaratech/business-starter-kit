import test from 'node:test';
import assert from 'node:assert/strict';
import { caddyFixture, recandidate } from '../test-support/caddy.mjs';
import { createCaddyPreflight } from '../adapters/caddy/preflight.mjs';

function setup() {
  const f = caddyFixture();
  const calls = [];
  const scope = { ...f.runtime.target, engineRef: f.runtime.engineRef, sourceRef: 'synthetic-host-worker' };
  const inventory = f.inventory;
  const deployments = f.runtime.deployments.map(({ entry, objects, addresses }) => ({ planId: entry.plan.planId,
    objects, addresses, ingressPeers: addresses.map(({ running, imageRef, ...peer }) => peer),
    containers: objects.filter(o => o.kind === 'container').map(c => {
      const imageRef = entry.plan.workloads.find(w => w.name === c.labels['dev.bsk.service']).image;
      const imageId = `sha256:${c.id}`;
      return { containerId: c.id, imageId, inspectedImageId: imageId, imageRef, repoDigests: [imageRef], running: true,
        networks: c.networks.map(name => ({ name, id: objects.find(o => o.kind === 'network' && o.name === name).id })) };
    }) }));
  let time = 50_000;
  const options = { scope, now: () => time, readRegistry: () => { calls.push('registry'); return f.snapshot; },
    readInventory: () => { calls.push('inventory'); return inventory; },
    readRuntime: query => {
      calls.push('runtime');
      assert.deepEqual(query.plans.map(p => p.planId).sort(), deployments.map(d => d.planId).sort());
      return { scope: query.scope, collectedAt: time, deployments };
    },
    validator: {
      version: () => { calls.push('version'); return 'v2.10.2'; },
      validate: query => {
        calls.push('validate');
        assert.equal(JSON.parse(query.configJson).admin.disabled, true);
        assert.match(query.scope.renderId, /^[a-f0-9]{64}$/);
        assert.equal(query.scope.candidatePlanId, f.candidate.planId);
        return true;
      }
    } };
  return { ...f, fixture: f, options, inventory, deployments, calls, tick: n => { time += n; },
    run: () => createCaddyPreflight(options)(f.candidate) };
}

async function rejected(s, code, validation = 'not-performed') {
  const result = await s.run();
  assert.equal(result.state, 'rejected');
  assert.equal(result.validation, validation);
  assert.deepEqual(result.diagnostics, [code]);
  assert.equal(result.applied, null);
  assert.equal(result.observed, null);
  return result;
}

test('preflight uses only worker capabilities, binds the render, and rechecks live reads', async () => {
  const s = setup();
  const before = structuredClone([s.candidate, s.snapshot, s.inventory, s.deployments]);
  const result = await s.run();
  assert.deepEqual(s.calls, ['registry', 'inventory', 'runtime', 'version', 'validate', 'version', 'inventory', 'runtime', 'inventory', 'registry']);
  assert.deepEqual([s.candidate, s.snapshot, s.inventory, s.deployments], before);
  assert.equal(result.state, 'passed');
  assert.equal(result.validation, 'valid');
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.scope, { ...s.options.scope, registryGeneration: 7,
    candidatePlanId: s.candidate.planId, inventoryRevision: 3, renderId: result.scope.renderId });
  assert.match(result.scope.renderId, /^[a-f0-9]{64}$/);
  assert.equal(result.applied, null);
  assert.equal(result.observed, null);
  assert.equal(result.collection.firstAt, 50_000);
  assert.equal(result.collection.lastAt, 50_000);
  assert.match(result.collection.observationId, /^[a-f0-9]{64}$/);
  assert.deepEqual(await s.run(), result);
  s.deployments.reverse();
  for (const d of s.deployments) { d.objects.reverse(); d.containers.reverse(); }
  assert.deepEqual(await s.run(), result);
});

test('project-supplied runtime and candidate tampering cannot reach the runtime reader', async () => {
  const s = setup();
  s.candidate.runtime = s.runtime;
  await rejected(s, 'CANDIDATE');
  assert.deepEqual(s.calls, ['registry']);
});

test('stale registry generation and unsupported listeners fail before observation', async () => {
  const s = setup();
  s.snapshot.generation++;
  await rejected(s, 'STALE_GENERATION');
  s.snapshot.input.gateways[0].spec.listenerPorts = [80, 443];
  recandidate(s.fixture);
  await rejected(s, 'LISTENERS_UNSUPPORTED');
  assert.deepEqual(s.calls, ['registry', 'registry']);
});

test('scope and freshness are checked independently from worker authority', async () => {
  for (const field of ['sourceRef', 'engineRef', 'installationRef', 'hostRef', 'gatewayRef', 'candidatePlanId', 'registryGeneration', 'inventoryRevision', 'renderId']) {
    const s = setup();
    const read = s.options.readRuntime;
    s.options.readRuntime = q => ({ ...read(q), scope: { ...q.scope, [field]: 'other' } });
    await rejected(s, 'OBSERVATION_SCOPE');
  }
  for (const collectedAt of [49_999, 50_001, null]) {
    const s = setup();
    const read = s.options.readRuntime;
    s.options.readRuntime = q => ({ ...read(q), collectedAt });
    await rejected(s, 'OBSERVATION_STALE');
  }
  const s = setup();
  s.options.readRuntime = undefined;
  await rejected(s, 'OBSERVATION_UNAVAILABLE');
});

test('missing admission, foreign ownership and ambiguous identities are rejected', async () => {
  const missing = setup(); missing.inventory.entries.pop();
  await rejected(missing, 'DEPLOYMENT_MISSING');
  const foreign = setup(); foreign.deployments[0].objects[0].labels['dev.bsk.project'] = 'foreign';
  await rejected(foreign, 'OWNERSHIP');
  const ambiguous = setup(); ambiguous.deployments[0].containers.push(ambiguous.deployments[0].containers[0]);
  await rejected(ambiguous, 'OBSERVATION_CONTRADICTORY');
  const networks = setup();
  const [a, b] = networks.deployments.map(d => d.objects.filter(o => o.kind === 'network'));
  a[0].id = b[0].id;
  await rejected(networks, 'OWNERSHIP');
});

test('incomplete links, unexpected ingress peers and data-network leaks fail closed', async () => {
  const missing = setup(); missing.deployments[0].containers[0].networks.pop();
  await rejected(missing, 'OBSERVATION_CONTRADICTORY');
  const missingPeer = setup();
  missingPeer.deployments[0].objects.find(o => o.kind === 'network' && o.name.endsWith('data')).attachments.pop();
  await rejected(missingPeer, 'OBSERVATION_CONTRADICTORY');
  const foreign = setup(); foreign.deployments[0].objects.find(o => o.kind === 'network').attachments.push('a'.repeat(64));
  await rejected(foreign, 'RUNTIME_POLICY');
  const leak = setup();
  const d = leak.deployments[0];
  const data = d.objects.find(o => o.kind === 'container' && o.labels['dev.bsk.service'] === 'db');
  const ingress = d.objects.find(o => o.kind === 'network' && o.name.endsWith('ingress'));
  data.networks.push(ingress.name); ingress.attachments.push(data.id);
  await rejected(leak, 'RUNTIME_POLICY');
});

test('unsafe endpoints and images with no matching immutable reference are rejected', async () => {
  const unsafe = setup(); unsafe.deployments[0].addresses[0].ipv4 = '8.8.8.8';
  await rejected(unsafe, 'ENDPOINT_POLICY');
  const wrongImage = setup(); wrongImage.deployments[0].containers[0].repoDigests = ['fixture/not-admitted'];
  await rejected(wrongImage, 'ARTIFACT_MISMATCH');
  const wrongImageId = setup(); wrongImageId.deployments[0].containers[0].inspectedImageId = `sha256:${'b'.repeat(64)}`;
  await rejected(wrongImageId, 'ARTIFACT_MISMATCH');
});

test('container-side IP and network-side peer/IPAM evidence must agree', async () => {
  for (const [key, value] of [['ipv4', '172.20.0.3'], ['networkId', 'a'.repeat(64)], ['subnet', '172.20.0.0/25']]) {
    const s = setup();
    s.deployments[0].ingressPeers[0][key] = value;
    await rejected(s, 'OBSERVATION_CONTRADICTORY');
  }
  const missing = setup(); missing.deployments[0].ingressPeers.pop();
  await rejected(missing, 'OBSERVATION_CONTRADICTORY');
});

test('validator fails closed for invalid config, unavailable tooling, timeouts and version divergence', async () => {
  const invalid = setup(); invalid.options.validator.validate = () => false;
  await rejected(invalid, 'CADDY_CONFIG_INVALID', 'invalid');
  const absent = setup(); absent.options.validator = undefined;
  await rejected(absent, 'CADDY_VALIDATOR_UNAVAILABLE', 'unavailable');
  const unavailable = setup(); unavailable.options.validator.validate = () => { throw new Error('private tool output'); };
  assert.doesNotMatch(JSON.stringify(await rejected(unavailable, 'CADDY_VALIDATOR_UNAVAILABLE', 'unavailable')), /private tool output/);
  const wrong = setup(); wrong.options.validator.version = () => 'v2.10.20';
  await rejected(wrong, 'CADDY_VERSION_MISMATCH', 'version-mismatch');
  assert.ok(!wrong.calls.includes('validate'));
  const swapped = setup();
  let probes = 0;
  swapped.options.validator.version = () => ++probes === 1 ? 'v2.10.2' : 'v2.10.20';
  await rejected(swapped, 'CADDY_VERSION_MISMATCH', 'version-mismatch');
  const hung = setup(); hung.options.timeoutMs = 1000;
  let signal;
  hung.options.validator.validate = (_, s) => { signal = s; return new Promise(() => {}); };
  await rejected(hung, 'PREFLIGHT_TIMEOUT', 'unavailable');
  assert.equal(signal.aborted, true);
});

test('changes during validation invalidate a successful validator response', async () => {
  const changed = setup(); changed.options.validator.validate = () => {
    changed.deployments[0].addresses[0].ipv4 = '172.20.0.3';
    changed.deployments[0].ingressPeers[0].ipv4 = '172.20.0.3';
    return true;
  };
  await rejected(changed, 'OBSERVATION_CHANGED', 'valid');
  const registry = setup(); registry.options.validator.validate = () => { registry.snapshot.generation++; return true; };
  await rejected(registry, 'STALE_GENERATION', 'valid');
  const inventory = setup(); inventory.options.validator.validate = () => { inventory.inventory.revision++; return true; };
  await rejected(inventory, 'INVENTORY_CHANGED', 'valid');
  const contradictoryInventory = setup();
  contradictoryInventory.options.validator.validate = () => { contradictoryInventory.inventory.host.capacity.cpuMillis += 100; return true; };
  await rejected(contradictoryInventory, 'INVENTORY_CHANGED', 'valid');
  const contradictoryRegistry = setup();
  contradictoryRegistry.options.validator.validate = () => {
    contradictoryRegistry.snapshot.input.declarations.resources.find(r => r.kind === 'Project').spec.ownerRef = 'other-owner';
    return true;
  };
  await rejected(contradictoryRegistry, 'REGISTRY_CHANGED', 'valid');
});

test('a replacement image object is detected even when the rendered endpoint stays the same', async () => {
  const s = setup();
  s.options.validator.validate = () => {
    const fact = s.deployments[0].containers[0];
    fact.imageId = fact.inspectedImageId = `sha256:${'f'.repeat(64)}`;
    return true;
  };
  await rejected(s, 'OBSERVATION_CHANGED', 'valid');
});
