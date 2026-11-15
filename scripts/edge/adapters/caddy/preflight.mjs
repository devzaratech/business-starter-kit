import { hash } from '../../lib/model.mjs';
import { renderCaddy } from './render.mjs';
import { reject, verifyCandidate } from './resolve.mjs';
import { fields, selectAdmissions, runtimeBundle, verifyTopology } from './observe.mjs';

export const supportedCaddyVersion = 'v2.10.2';
const scopeFields = ['installationRef', 'hostRef', 'gatewayRef', 'engineRef', 'sourceRef'];
const diagnostics = new Set([
  'CANDIDATE', 'DRIVER_UNSUPPORTED', 'LISTENERS_UNSUPPORTED', 'STALE_GENERATION', 'REGISTRY_UNAVAILABLE', 'REGISTRY_CHANGED',
  'INVENTORY_UNAVAILABLE', 'INVENTORY_SCOPE', 'INVENTORY_CHANGED', 'DEPLOYMENT_MISSING', 'DEPLOYMENT_AMBIGUOUS',
  'OBSERVATION_UNAVAILABLE', 'OBSERVATION_SCOPE', 'OBSERVATION_STALE', 'OBSERVATION_INCOMPLETE',
  'OBSERVATION_CONTRADICTORY', 'OBSERVATION_CHANGED', 'RUNTIME_INPUT', 'RUNTIME_SCOPE', 'ADMISSION', 'OWNERSHIP',
  'ROLE_UNSUPPORTED', 'PRIVATE_EXPOSURE', 'ARTIFACT_MISMATCH', 'PORT_MISMATCH', 'RUNTIME_POLICY', 'INGRESS_ATTACHMENT',
  'ENDPOINT_POLICY', 'ENDPOINT_AMBIGUOUS', 'ENDPOINT_OVERLAP', 'UNUSED_DEPLOYMENT', 'CADDY_VALIDATOR_UNAVAILABLE',
  'CADDY_VERSION_MISMATCH', 'CADDY_CONFIG_INVALID', 'PREFLIGHT_TIMEOUT'
]);

/**
 * Install inside a trusted host worker. Capabilities and clock are operator wiring.
 * The returned function receives only a candidate. IDs and timestamps are evidence.
 * @param {import('./ports.d.ts').CaddyPreflightOptions} options
 * @returns {(candidate: import('../../lib/ports.d.ts').IngressCandidate) => Promise<import('./ports.d.ts').CaddyPreflightResult>}
 */
export function createCaddyPreflight({ scope: configuredScope, readRegistry, readInventory, readRuntime,
  validator, now = Date.now, timeoutMs = 10_000 }) {
  const pinned = structuredClone(configuredScope);
  if (!fields(pinned, scopeFields) || !scopeFields.every(field => typeof pinned[field] === 'string' &&
    /^[a-zA-Z0-9_-]{1,256}$/.test(pinned[field])) || !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 || timeoutMs > 30_000 || typeof now !== 'function') reject('WORKER_CONFIGURATION');
  const version = typeof validator?.version === 'function' ? validator.version.bind(validator) : undefined;
  const validate = typeof validator?.validate === 'function' ? validator.validate.bind(validator) : undefined;

  return async function preflight(value) {
    const scope = { ...pinned, registryGeneration: null, candidatePlanId: null, inventoryRevision: null, renderId: null };
    let validation = 'not-performed';
    let collection = null;
    const finish = (state, codes) => {
      const body = { apiVersion: 'bsk.caddy.preflight/v0alpha1', kind: 'CaddyPreflight', state, scope, validation,
        requiredCaddyVersion: supportedCaddyVersion, collection, diagnostics: codes, applied: null, observed: null };
      return { ...body, preflightId: hash(body) };
    };
    const controller = new AbortController();
    const deadline = performance.now() + timeoutMs;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const { signal } = controller;
    const checkDeadline = () => {
      if (signal.aborted || performance.now() >= deadline) {
        controller.abort();
        reject('PREFLIGHT_TIMEOUT');
      }
    };
    const call = async (port, code, ...args) => {
      checkDeadline();
      if (typeof port !== 'function') reject(code);
      let stop;
      const aborted = new Promise((_, rejectAbort) => {
        stop = () => rejectAbort(new Error('Preflight deadline'));
        signal.addEventListener('abort', stop, { once: true });
      });
      try {
        const output = await Promise.race([aborted, Promise.resolve().then(() => port(...args, signal))]);
        return structuredClone(output);
      } catch {
        checkDeadline();
        reject(code);
      } finally {
        signal.removeEventListener('abort', stop);
        checkDeadline();
      }
    };

    const checkCandidate = (value, snapshot) => {
      if (Number.isSafeInteger(value?.registryGeneration) && Number.isSafeInteger(snapshot?.generation) &&
        value.registryGeneration !== snapshot.generation) reject('STALE_GENERATION');
      const { candidate } = verifyCandidate(value, snapshot);
      if (['installationRef', 'hostRef', 'gatewayRef'].some(key => candidate.target[key] !== pinned[key])) reject('OBSERVATION_SCOPE');
      return candidate;
    };

    try {
      let input;
      try { input = structuredClone(value); } catch { reject('CANDIDATE'); }
      const snapshot = await call(readRegistry, 'REGISTRY_UNAVAILABLE');
      const candidate = checkCandidate(input, snapshot);
      Object.assign(scope, { registryGeneration: candidate.registryGeneration, candidatePlanId: candidate.planId });
      const inventory = await call(readInventory, 'INVENTORY_UNAVAILABLE');
      const entries = selectAdmissions(inventory, candidate);
      const inventoryId = hash(inventory);
      scope.inventoryRevision = inventory.revision;
      const checkInventory = async () => {
        const current = await call(readInventory, 'INVENTORY_UNAVAILABLE');
        if (!current || hash(current) !== inventoryId) reject('INVENTORY_CHANGED');
      };
      const observe = async () => {
        const sampleScope = { ...scope };
        const started = now();
        const sample = await call(readRuntime, 'OBSERVATION_UNAVAILABLE', {
          scope: { ...sampleScope }, plans: structuredClone(entries.map(e => e.plan))
        });
        const runtime = runtimeBundle(sample, candidate, sampleScope, entries, started, now());
        const render = renderCaddy(candidate, { snapshot, runtime });
        const identity = verifyTopology(sample, runtime);
        return { at: sample.collectedAt, render, identity };
      };

      const first = await observe();
      scope.renderId = first.render.renderId;
      collection = { firstAt: first.at, lastAt: first.at, observationId: first.identity };
      validation = 'unavailable';
      if (typeof validate !== 'function') reject('CADDY_VALIDATOR_UNAVAILABLE');
      const checkVersion = async () => {
        if (await call(version, 'CADDY_VALIDATOR_UNAVAILABLE') !== supportedCaddyVersion) {
          validation = 'version-mismatch';
          reject('CADDY_VERSION_MISMATCH');
        }
      };
      await checkVersion();
      const valid = await call(validate, 'CADDY_VALIDATOR_UNAVAILABLE', {
        scope: { ...scope }, configJson: JSON.stringify(first.render.config)
      });
      if (valid !== true && valid !== false) reject('CADDY_VALIDATOR_UNAVAILABLE');
      await checkVersion();
      validation = valid ? 'valid' : 'invalid';
      if (!valid) reject('CADDY_CONFIG_INVALID');

      await checkInventory();
      const second = await observe();
      if (second.at < first.at) reject('OBSERVATION_STALE');
      if (second.identity !== first.identity || second.render.renderId !== scope.renderId) reject('OBSERVATION_CHANGED');
      collection.lastAt = second.at;
      await checkInventory();
      const current = await call(readRegistry, 'REGISTRY_UNAVAILABLE');
      checkCandidate(candidate, current);
      if (hash(current) !== hash(snapshot)) reject('REGISTRY_CHANGED');
      checkDeadline();
      return finish('passed', []);
    } catch (error) {
      const code = diagnostics.has(error?.code) ? error.code : 'PREFLIGHT_ERROR';
      return finish('rejected', [code]);
    } finally {
      clearTimeout(timer);
    }
  };
}
