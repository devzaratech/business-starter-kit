import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { requireThat, verifyOwner, assertEngine } from './guard.mjs';

export function cleanEnvironment(env) {
  return Object.fromEntries(Object.entries(env).filter(([k]) => /^(PATH|HOME|USER|LANG|LC_ALL|TMPDIR|DOCKER_CONFIG)$/.test(k)));
}

export class DockerSession {
  constructor(permit, transport = (args, options) => spawnSync('docker', args, options)) {
    this.permit = permit; this.transport = transport; this.commands = [];
  }
  raw(args, { timeout = 15000, allowFailure = false } = {}) {
    requireThat(Number.isInteger(timeout) && timeout > 0 && timeout <= 180000, 'TIMEOUT');
    const r = this.transport(args, { timeout, shell: false, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
      env: cleanEnvironment(process.env) });
    this.commands.push({ argv: ['docker', ...args], exit: r.status, error: r.error?.code ?? null,
      stdoutSha256: createHash('sha256').update(r.stdout ?? '').digest('hex') });
    this.onCommand?.(this.commands);
    requireThat(!r.error && (allowFailure || r.status === 0), 'DOCKER_COMMAND');
    return r;
  }
  outer(args, options) {
    const info = JSON.parse(this.raw(['--host', 'unix:///var/run/docker.sock', 'info', '--format', '{{json .}}']).stdout);
    requireThat(this.outerId && info.ID === this.outerId && info.OSType === 'linux', 'TARGET');
    return this.raw(['--host', 'unix:///var/run/docker.sock', ...args], options);
  }
  inner(args, options) {
    requireThat(this.context === `bsk-es2-${this.permit.run}` && typeof this.endpoint === 'string' && this.innerId, 'TARGET');
    const endpoint = JSON.parse(this.raw(['context', 'inspect', this.context, '--format', '{{json .Endpoints.docker.Host}}']).stdout);
    requireThat(endpoint === this.endpoint, 'TARGET');
    const info = JSON.parse(this.raw(['--context', this.context, 'info', '--format', '{{json .}}']).stdout);
    assertEngine(info, this.outerId, this.permit.run); requireThat(info.ID === this.innerId, 'TARGET');
    if (args[0] === 'compose') {
      requireThat(this.sandbox, 'TARGET'); this.inspect(this.sandbox, true);
      return this.outer(['container', 'exec', this.sandbox.id, 'docker', '--host', 'unix:///run/bsk/docker.sock', ...args], options);
    }
    return this.raw(['--context', this.context, ...args], options);
  }
  inspect(record, outer = false) {
    const call = outer ? this.outer.bind(this) : this.inner.bind(this);
    const values = JSON.parse(call([record.kind, 'inspect', record.id]).stdout);
    requireThat(Array.isArray(values) && values.length === 1, 'OWNERSHIP');
    verifyOwner(values[0], record); return values[0];
  }
  removeOwned(record, outer = false) {
    this.inspect(record, outer);
    const call = outer ? this.outer.bind(this) : this.inner.bind(this);
    if (record.kind === 'container') {
      call(['container', 'stop', '--time', '5', record.id]);
      this.inspect(record, outer);
    }
    call([record.kind, 'rm', record.id]);
  }
  execOwned(record, args, options) {
    this.inspect(record);
    return this.inner(['container', 'exec', record.id, ...args], options);
  }
}
