#!/usr/bin/env node
import { constants, openSync, fstatSync, readSync, closeSync } from 'node:fs';
import { buildPlan, fail } from './lib/plan.mjs';
import { Inventory } from './lib/inventory.mjs';
import { DockerReader } from './lib/docker.mjs';
import { inspectLimits, planLifecycle } from './lib/lifecycle.mjs';

function readJson(file) {
  if (!file || file.startsWith('-') || /^[\\/]{2}|^[a-z][a-z0-9+.-]*:\/\//i.test(file)) fail('USAGE');
  let fd;
  try {
    fd = openSync(file, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0));
    const info = fstatSync(fd);
    if (!info.isFile() || info.size > 1048576) fail('INPUT');
    const b = Buffer.alloc(1048577); let size = 0;
    while (size < b.length) { const n = readSync(fd, b, size, b.length - size, null); if (!n) break; size += n; }
    if (size > 1048576) fail('INPUT');
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(b.subarray(0, size)));
  } catch { fail('INPUT'); }
  finally { if (fd !== undefined) closeSync(fd); }
}

try {
  const [command, ...a] = process.argv.slice(2); let result;
  if (command === 'plan' && a.length === 1) result = buildPlan(readJson(a[0]));
  else if (command === 'init' && a.length === 2) result = Inventory.initialize(a[0], readJson(a[1])).snapshot();
  else if (command === 'inventory' && a.length === 1) result = new Inventory(a[0]).snapshot();
  else if (command === 'claim' && a.length === 3 && /^(?:0|[1-9][0-9]*)$/.test(a[2])) result = new Inventory(a[0]).claim(readJson(a[1]), Number(a[2]));
  else if (['observe', 'versions'].includes(command) && a.length === 3) {
    const store = new Inventory(a[0]); const entry = store.snapshot().entries.find(e => e.plan.planId === a[1]);
    if (!entry) fail('INVENTORY_MISSING');
    const reader = new DockerReader(readJson(a[2]));
    result = command === 'versions' ? reader.versions(entry.plan) : inspectLimits(entry, reader.resources(entry.plan));
  } else if (command === 'lifecycle' && (a.length === 4 || a.length === 5)) {
    result = planLifecycle(new Inventory(a[0]), a[1], a[2], new DockerReader(readJson(a[3])), a[4] ? readJson(a[4]) : {});
  } else fail('USAGE');
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (e) {
  const code = /^[A-Z_]{1,40}$/.test(e.code ?? '') ? e.code : 'INPUT';
  process.stderr.write(`${JSON.stringify({ code, message: 'Compose request was rejected; no Docker mutation was executed.' })}\n`);
  process.exitCode = 2;
}
