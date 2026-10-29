import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildPlan } from '../lib/plan.mjs';
import { request } from '../test-support/fixtures.mjs';

test('real Compose client validates two generated isolated models without contacting a daemon', t => {
  const root = mkdtempSync(join(tmpdir(), 'bsk-es2-render-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'empty.env'), '');
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(DOCKER_|COMPOSE_)/i.test(k)));
  for (const project of ['fixture-a', 'fixture-b']) {
    const p = buildPlan(request(project)); const file = join(root, `${project}.json`);
    writeFileSync(file, JSON.stringify(p.compose));
    const r = spawnSync('docker', ['compose', '--env-file', join(root, 'empty.env'), '-p', p.scope, '-f', file, 'config', '--format', 'json'],
      { env, encoding: 'utf8', timeout: 20000, shell: false });
    assert.ifError(r.error); assert.equal(r.status, 0, r.stderr);
    const c = JSON.parse(r.stdout);
    assert.equal(c.name, p.scope); assert.equal(c.services.http.cpus, 0.25);
    assert.equal(Number(c.services.http.mem_limit), 33554432); assert.equal(c.services.http.pids_limit, 32);
    assert.equal(c.services.db.ports, undefined); assert.equal(c.networks.data.internal, true);
    assert.equal(c.volumes['data-db'].labels['dev.bsk.project'], project);
  }
});
