import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const PRIVATE_REGISTRY_PREFIX = 'https://packages.applied-caas-gateway1.internal.api.openai.org/artifactory/api/npm/npm-public/';
export const PUBLIC_REGISTRY_PREFIX = 'https://registry.npmjs.org/';

export function normalizeResolvedUrl(value) {
  if (typeof value !== 'string' || !value.startsWith(PRIVATE_REGISTRY_PREFIX)) {
    return value;
  }

  return `${PUBLIC_REGISTRY_PREFIX}${value.slice(PRIVATE_REGISTRY_PREFIX.length)}`;
}

export function normalizeLockfile(lockfile) {
  let changed = 0;

  for (const metadata of Object.values(lockfile.packages ?? {})) {
    if (!metadata || typeof metadata !== 'object') continue;

    const before = metadata.resolved;
    const after = normalizeResolvedUrl(before);
    if (after !== before) {
      metadata.resolved = after;
      changed += 1;
    }
  }

  return { lockfile, changed };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const write = args.has('--write');
  const check = args.has('--check') || !write;

  if (write && args.has('--check')) {
    throw new Error('Use either --write or --check, not both.');
  }

  const lockfilePath = resolve(process.cwd(), 'package-lock.json');
  const source = await readFile(lockfilePath, 'utf8');
  const parsed = JSON.parse(source);
  const { lockfile, changed } = normalizeLockfile(parsed);

  if (write) {
    if (changed > 0) {
      await writeFile(lockfilePath, `${JSON.stringify(lockfile, null, 2)}\n`, 'utf8');
    }
    console.log(`Normalized ${changed} package-lock resolved URL(s).`);
    return;
  }

  if (check && changed > 0) {
    console.error(`package-lock.json contains ${changed} non-portable private registry URL(s).`);
    process.exitCode = 1;
    return;
  }

  console.log('package-lock.json registry URLs are portable.');
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  await main();
}
