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
