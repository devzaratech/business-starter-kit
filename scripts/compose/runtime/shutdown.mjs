import { request } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { DockerReader } from '../lib/docker.mjs';
import { requireThat } from './guard.mjs';

// Read-only, direct Unix transport: no CLI formatting, environment or fallback target.
export function unixInfo(endpoint, connect = request, schedule = setTimeout, cancel = clearTimeout) {
  return new Promise((resolve, reject) => {
    const req = connect({ socketPath: endpoint.slice('unix://'.length), path: '/info', method: 'GET' }, res => {
      let size = 0; const chunks = [];
      res.on('data', chunk => {
        size += chunk.length;
        if (size > 1048576) req.destroy(Object.assign(new Error(), { code: 'SHUTDOWN_RESPONSE' }));
        else chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => {
        try {
          requireThat(res.statusCode === 200, 'SHUTDOWN_RESPONSE');
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch { reject(Object.assign(new Error(), { code: 'SHUTDOWN_RESPONSE' })); }
      });
    });
    const timer = schedule(() => req.destroy(Object.assign(new Error(), { code: 'ETIMEDOUT' })), 1000);
    req.on('close', () => cancel(timer)); req.on('error', reject); req.end();
  });
}

export async function verifyShutdown(session, sandbox, authorization, evidence, read = unixInfo, wait = delay) {
  // Reuse the strict descriptor validation, without interpreting reader errors as outage proof.
  new DockerReader(authorization);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const observation = { attempt, outerStopped: false, endpointMatches: false, code: null };
    try {
      requireThat(session.context === `bsk-es2-${session.permit.run}` && session.context === authorization.context &&
        session.endpoint === authorization.endpoint && session.innerId === authorization.engineId, 'CONTEXT_MISMATCH');
      const actual = session.inspect(sandbox, true);
      requireThat(actual.State?.Running === false && actual.State?.Restarting === false && actual.State?.Status === 'exited', 'SANDBOX_NOT_STOPPED');
      observation.outerStopped = true;
      const endpoint = JSON.parse(session.raw(['context', 'inspect', session.context, '--format', '{{json .Endpoints.docker.Host}}']).stdout);
      requireThat(endpoint === authorization.endpoint, 'CONTEXT_MISMATCH'); observation.endpointMatches = true;
      let info;
      try { info = await read(endpoint); }
      catch (e) {
        observation.code = /^[A-Z_]{1,50}$/.test(e.code ?? '') ? e.code : 'SHUTDOWN_READ';
        if (['ENOENT', 'ECONNREFUSED'].includes(e.code)) return e.code;
        throw e;
      }
      requireThat(info && typeof info.ID === 'string' && info.ID.length > 0 && info.OSType === 'linux', 'SHUTDOWN_RESPONSE');
      requireThat(info.ID === authorization.engineId, 'CONTEXT_MISMATCH');
      observation.code = 'DAEMON_REACHABLE';
      requireThat(attempt < 3, 'DAEMON_REACHABLE');
    } catch (e) {
      observation.code = /^[A-Z_]{1,50}$/.test(e.code ?? '') ? e.code : 'SHUTDOWN_READ';
      throw e;
    } finally { evidence.push(observation); }
    await wait(250);
  }
}
