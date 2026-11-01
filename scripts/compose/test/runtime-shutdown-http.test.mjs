import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { unixInfo } from '../runtime/shutdown.mjs';

function transport(run) {
  let timeout; const req = new EventEmitter(); const res = new EventEmitter(); res.statusCode = 200;
  req.destroy = e => { req.emit('error', e); req.emit('close'); };
  return { read: () => unixInfo('unix:///unit-test/isolated.sock', (options, callback) => {
    assert.deepEqual(options, { socketPath: '/unit-test/isolated.sock', path: '/info', method: 'GET' });
    req.end = () => { callback(res); run(req, res, () => timeout()); }; return req;
  }, (fn, milliseconds) => { assert.equal(milliseconds, 1000); timeout = fn; return 1; }, () => {}) };
}
test('native transport reads exact Unix GET with bounded timer and JSON', async () => {
  assert.deepEqual(await transport((_q, r) => { r.emit('data', Buffer.from('{"ID":"inner"}')); r.emit('end'); }).read(), { ID: 'inner' });
});
for (const code of ['ENOENT', 'ECONNREFUSED']) test(`native transport preserves ${code}`, async () => {
  await assert.rejects(transport((q) => q.destroy(Object.assign(new Error('redacted'), { code }))).read(), e => e.code === code);
});
test('native transport enforces total timeout', async () => {
  await assert.rejects(transport((_q, _r, expire) => expire()).read(), e => e.code === 'ETIMEDOUT');
});
for (const mode of ['status', 'json', 'size', 'abort']) test(`native transport rejects ${mode}`, async () => {
  await assert.rejects(transport((_q, r) => {
    if (mode === 'abort') { r.emit('error', Object.assign(new Error(), { code: 'ECONNRESET' })); return; }
    if (mode === 'status') r.statusCode = 503;
    r.emit('data', Buffer.from(mode === 'size' ? ' '.repeat(1048577) : mode === 'json' ? 'invalid' : '{}')); r.emit('end');
  }).read());
});
