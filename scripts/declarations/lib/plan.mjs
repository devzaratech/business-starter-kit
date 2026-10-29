import { createHash } from 'node:crypto';
import { resourceKey, validateBundle } from './validate.mjs';

const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
function compareTuples(a, b) {
  for (let i = 0; i < a.length; i++) {
    const order = compare(a[i] ?? '', b[i] ?? '');
    if (order) return order;
  }
  return 0;
}

function canonical(value, key = '') {
  if (Array.isArray(value)) {
    const items = value.map(item => canonical(item));
    return key === 'secretRefs' ? items.sort(compare) : items;
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort(compare).map(key => [key, canonical(value[key], key)]));
  }
  return value;
}

export function planBundle(value) {
  const { valid, diagnostics } = validateBundle(value);
  const output = { apiVersion: 'bsk/v0alpha1', mode: 'dry-run', planId: null, actions: [], diagnostics };
  if (!valid) return output;

  const resources = [...value.resources].sort((a, b) => compareTuples(resourceKey(a), resourceKey(b)));
  const routeKey = r => [r.installationRef, r.hostname, r.pathPrefix];
  const bundle = canonical({
    ...value,
    resources,
    catalog: {
      policies: [...value.catalog.policies].sort(compare),
      runtimes: [...value.catalog.runtimes].sort(compare),
      routes: [...value.catalog.routes].sort((a, b) => compareTuples(routeKey(a), routeKey(b)))
    }
  });
  output.planId = createHash('sha256').update(JSON.stringify(bundle), 'utf8').digest('hex');
  output.actions = bundle.resources.map(r => ({
    action: 'declare', resourceKey: resourceKey(r), spec: r.spec, runtimeChecks: 'not-evaluated'
  }));
  return output;
}
