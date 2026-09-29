#!/usr/bin/env node
import { resolve } from 'node:path';
import { discoverManifests } from './lib/discover-manifests.mjs';
import { validateDependencyGraph } from './lib/dependency-rules.mjs';

function parseRoot(args) {
  const index = args.indexOf('--root');
  if (index === -1) return process.cwd();
  if (!args[index + 1]) throw new Error('--root requires a path');
  return resolve(args[index + 1]);
}

async function main() {
  const root = parseRoot(process.argv.slice(2));
  const modules = await discoverManifests(root, {
    ignoredRelativePaths: ['scripts/architecture/test/fixtures']
  });

  if (modules.length === 0) {
    console.error('Architecture check failed: no bsk.module.json manifests found');
    process.exitCode = 1;
    return;
  }

  const errors = validateDependencyGraph(modules);
  if (errors.length > 0) {
    console.error('Architecture check failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Architecture check passed: ${modules.length} module(s)`);
}

main().catch((error) => {
  console.error(`Architecture check failed: ${error.message}`);
  process.exitCode = 1;
});
