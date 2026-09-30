// Explicit composition policy; side roles deliberately have no numeric rank.
// See docs/superpowers/specs/2026-09-28-foundation-review-corrections-design.md.
const CONTRACTS = ['contract', 'extension-contract'];
const KERNELS = [...CONTRACTS, 'kernel', 'compliance-kernel'];
const CAPABILITIES = [...KERNELS, 'capability'];
const RUNTIMES = [...CAPABILITIES, 'observability', 'runtime', 'adapter'];
const PRODUCTS = [...RUNTIMES, 'compliance-pack', 'profile', 'application'];
const PUBLIC_KINDS = [...PRODUCTS, 'reference-client', 'deployment', 'conformance'];
const ALLOWED_TARGETS = new Map(Object.entries({
  contract: ['contract'],
  'extension-contract': CONTRACTS,
  kernel: [...CONTRACTS, 'kernel'],
  'compliance-kernel': KERNELS,
  capability: CAPABILITIES,
  observability: [...CAPABILITIES, 'observability'],
  adapter: [...CAPABILITIES, 'adapter'],
  runtime: RUNTIMES,
  'compliance-pack': [...CAPABILITIES, 'compliance-pack'],
  profile: [...RUNTIMES, 'compliance-pack', 'profile'],
  application: PRODUCTS,
  'reference-client': [...CONTRACTS, 'runtime', 'reference-client'],
  deployment: PUBLIC_KINDS,
  conformance: [...PUBLIC_KINDS, 'private-extension'],
  'private-extension': [...CONTRACTS, 'private-extension']
}).map(([kind, targets]) => [kind, new Set(targets)]));

const REQUIRED_FREEDOM_CLASSES = new Map([
  ['F1', new Set(['F1'])],
  ['F2', new Set(['F1', 'F2'])],
  ['F3', new Set(['F1', 'F2', 'F3'])]
]);

export function validateDependencyGraph(modules) {
  const errors = [];
  const byName = new Map(modules.map((item) => [item.manifest.module.name, item]));

  for (const item of modules) {
    const source = item.manifest.module;
    if (!ALLOWED_TARGETS.has(source.kind)) {
      errors.push(`${source.name}: unknown module kind ${source.kind}`);
      continue;
    }
    const deps = [
      ...item.manifest.dependencies.required.map((name) => ({ name, required: true })),
      ...item.manifest.dependencies.optional.map((name) => ({ name, required: false }))
    ];

    for (const { name: dependencyName, required } of deps) {
      const targetRecord = byName.get(dependencyName);
      if (!targetRecord) {
        if (required) errors.push(`${source.name}: unresolved required dependency ${dependencyName}`);
        continue;
      }
      const target = targetRecord.manifest.module;

      if (source.name === target.name) {
        errors.push(`${source.name}: self-dependency is not allowed`);
      }
      if (!ALLOWED_TARGETS.get(source.kind).has(target.kind)) {
        errors.push(`${source.name}: ${source.kind} must not depend on ${target.kind} module ${target.name}`);
      }
      if (source.visibility === 'public' && target.visibility === 'private') {
        errors.push(`public module ${source.name} must not depend on private module ${target.name}`);
      }
      if (required && !REQUIRED_FREEDOM_CLASSES.get(source.freedomClass)?.has(target.freedomClass)) {
        errors.push(`${source.name}: ${source.freedomClass} must not have required dependency ${target.name} (${target.freedomClass})`);
      }
      if (item.manifest.dependencies.forbiddenKinds.includes(target.kind)) {
        errors.push(`${source.name}: dependency ${target.name} has forbidden kind ${target.kind}`);
      }
    }
  }
  return errors;
}
