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
