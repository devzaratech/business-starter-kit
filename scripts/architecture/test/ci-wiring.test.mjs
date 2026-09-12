import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

test('GitHub Actions and Jenkins enforce the same architecture commands', async () => {
  const root = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
  const [githubCi, jenkins] = await Promise.all([
    readFile(resolve(root, '.github/workflows/ci.yml'), 'utf8'),
    readFile(resolve(root, 'Jenkinsfile'), 'utf8')
  ]);

  for (const command of ['npm run architecture:test', 'npm run architecture:check']) {
    assert.match(githubCi, new RegExp(command.replace(':', '\\:')));
    assert.match(jenkins, new RegExp(command.replace(':', '\\:')));
  }

  assert.match(githubCi, /architecture-guardrails/);
});
