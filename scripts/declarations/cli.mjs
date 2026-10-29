#!/usr/bin/env node
import { openSync, fstatSync, readSync, closeSync } from 'node:fs';
import { validateBundle } from './lib/validate.mjs';
import { planBundle } from './lib/plan.mjs';

const MAX_BYTES = 1024 * 1024;
const messages = {
  USAGE: 'Usage: node scripts/declarations/cli.mjs <validate|plan> <bundle.json>',
  READ: 'Cannot read a regular local input file.',
  SIZE: 'Input exceeds the 1 MiB limit.',
  JSON: 'Input must be valid UTF-8 JSON.'
};

function fail(code) {
  process.stderr.write(`${JSON.stringify({ code, message: messages[code] })}\n`);
  process.exitCode = 2;
}

function readInput(file) {
  let fd;
  try {
    fd = openSync(file, 'r');
    const info = fstatSync(fd);
    if (!info.isFile()) return { error: 'READ' };
    if (info.size > MAX_BYTES) return { error: 'SIZE' };
    // Bound the read as well as the stat: the file may grow after inspection.
    const buffer = Buffer.alloc(MAX_BYTES + 1);
    let bytes = 0;
    while (bytes < buffer.length) {
      const count = readSync(fd, buffer, bytes, buffer.length - bytes, null);
      if (count === 0) break;
      bytes += count;
    }
    if (bytes > MAX_BYTES) return { error: 'SIZE' };
    return { data: buffer.subarray(0, bytes) };
  } catch {
    return { error: 'READ' };
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

const [command, file, ...extra] = process.argv.slice(2);
if (!['validate', 'plan'].includes(command) || !file || extra.length || file.startsWith('-') ||
    /^[\\/]{2}/.test(file) || /^[a-z][a-z0-9+.-]*:\/\//i.test(file) || /^file:/i.test(file)) {
  fail('USAGE');
} else {
  const input = readInput(file);
  if (input.error) fail(input.error);
  else {
    let value;
    try {
      value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(input.data));
    } catch {
      fail('JSON');
    }
    if (process.exitCode !== 2) {
      const result = command === 'validate' ? validateBundle(value) : planBundle(value);
      process.stdout.write(`${JSON.stringify(result)}\n`);
      process.exitCode = result.diagnostics.length ? 1 : 0;
    }
  }
}
