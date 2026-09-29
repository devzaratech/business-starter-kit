import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const manifest = {
  schemaVersion: '1.0',
  module: {
    name: 'one', version: '0.1.0', kind: 'kernel', visibility: 'public',
    freedomClass: 'F1', supportLevel: 'Preview', license: 'Apache-2.0'
  },
  compatibility: { bskPlatform: '1.x' },
  dependencies: { required: [], optional: [], forbiddenKinds: [] },
  capabilities: { provides: [], requires: [] }
};

test('repository architecture check ignores test fixtures', async () => {
  const root = await mkdtemp(join(tmpdir(), 'bsk-architecture-check-'));
  const productionDir = join(root, 'modules', 'one');
  const duplicateA = join(root, 'scripts', 'architecture', 'test', 'fixtures', 'invalid', 'duplicate-a');
  const duplicateB = join(root, 'scripts', 'architecture', 'test', 'fixtures', 'invalid', 'duplicate-b');

  await Promise.all([mkdir(productionDir, { recursive: true }), mkdir(duplicateA, { recursive: true }), mkdir(duplicateB, { recursive: true })]);
  const text = `${JSON.stringify(manifest, null, 2)}\n`;
  await Promise.all([
    writeFile(join(productionDir, 'bsk.module.json'), text),
    writeFile(join(duplicateA, 'bsk.module.json'), text),
    writeFile(join(duplicateB, 'bsk.module.json'), text)
  ]);

  const checker = fileURLToPath(new URL('../check.mjs', import.meta.url));
  const { stdout } = await execFileAsync(process.execPath, [checker, '--root', root]);
  assert.match(stdout, /Architecture check passed: 1 module\(s\)/);
});
