import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative, resolve, sep } from 'node:path';
import { parseManifest } from './module-manifest.mjs';

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'target', 'coverage']);

export async function discoverManifests(rootDir, { ignoredRelativePaths = [] } = {}) {
  const root = rootDir instanceof URL ? fileURLToPath(rootDir) : resolve(rootDir);
  const ignored = ignoredRelativePaths.map((path) => resolve(root, path));
  const found = [];

  function isIgnored(path) {
    return ignored.some((ignoredPath) => path === ignoredPath || path.startsWith(`${ignoredPath}${sep}`));
  }

  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const child = join(dir, entry.name);
        if (!SKIP_DIRS.has(entry.name) && !isIgnored(child)) await walk(child);
        continue;
      }
      if (entry.name !== 'bsk.module.json') continue;
      const path = join(dir, entry.name);
      if (isIgnored(path)) continue;
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
