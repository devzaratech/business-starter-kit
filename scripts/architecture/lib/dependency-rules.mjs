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
