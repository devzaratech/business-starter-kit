import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';

const schema = JSON.parse(readFileSync(
  new URL('../../../contracts/schemas/bsk-module.schema.json', import.meta.url), 'utf8'
));
const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);

export function validateManifestShape(manifest) {
  if (validate(manifest)) return [];
  return validate.errors.map(({ instancePath, message, params }) => {
    const property = params.missingProperty ?? params.additionalProperty;
    const path = `${instancePath}${property ? `/${property}` : ''}` || '/';
    return `${path}: ${message}`;
  });
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
