import { requireThat } from './guard.mjs';

export const cgroupFiles = ['cpu.max', 'memory.max', 'pids.max', 'cpu.stat', 'memory.events', 'pids.events'];
export function cgroupValues(raw) {
  const integer = value => { requireThat(/^[0-9]+$/.test(value ?? ''), 'CGROUP_VALUE'); return Number(value); };
  const counter = (file, key) => integer(raw[file]?.trim().split('\n').map(s => s.split(/\s+/)).find(p => p[0] === key)?.[1]);
  const cpu = raw['cpu.max']?.trim().split(/\s+/);
  requireThat(cpu?.length === 2, 'CGROUP_CPU');
  const period = integer(cpu[1]); requireThat(period > 0, 'CGROUP_CPU');
  return { cpuMillis: integer(cpu[0]) / period * 1000, memoryBytes: integer(raw['memory.max']?.trim()),
    pids: integer(raw['pids.max']?.trim()), throttled: counter('cpu.stat', 'nr_throttled'),
    usageUsec: counter('cpu.stat', 'usage_usec'), oomKills: counter('memory.events', 'oom_kill'), pidsDenied: counter('pids.events', 'max') };
}
export function verifyCgroup(actual, resources) {
  requireThat(actual.cpuMillis === resources.cpuLimitMillis && actual.memoryBytes === resources.memoryLimitBytes && actual.pids === resources.pidsLimit, 'CGROUP_LIMIT');
}
export function verifyLoad(type, before, after, exit) {
  requireThat(type === 'cpu' ? exit === 0 && after.throttled > before.throttled && after.usageUsec > before.usageUsec :
    type === 'pids' ? exit === 0 && after.pidsDenied > before.pidsDenied :
      type === 'memory' && exit === 137 && after.oomKills > before.oomKills, 'LOAD_EVIDENCE');
}

export const readCgroups = `import json,pathlib
files=${JSON.stringify(cgroupFiles)}
print(json.dumps({f:(pathlib.Path('/sys/fs/cgroup')/f).read_text() for f in files}))`;
export const cpuLoad = `import time
end=time.monotonic()+4
n=0
while time.monotonic()<end: n+=1
print(n)`;
export const pidsLoad = `import os,time,errno
children=[]
try:
 for i in range(64):
  try: pid=os.fork()
  except OSError as e:
   if e.errno!=errno.EAGAIN: raise
   print('PID_LIMIT_REACHED',flush=True); break
  if pid==0: time.sleep(6); os._exit(0)
  children.append(pid)
 else: raise RuntimeError('PID limit not reached')
finally:
 for pid in children:
  try: os.kill(pid,15)
  except ProcessLookupError: pass
 for pid in children: os.waitpid(pid,0)`;
export const memoryLoad = `import time
chunks=[]
for i in range(48):
 chunks.append(bytearray(2*1024*1024)); time.sleep(0.02)
raise RuntimeError('memory limit not reached')`;

export function connectProbe(ip, allowed) {
  requireThat(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip), 'PROBE_IP');
  return `import socket
try:
 s=socket.create_connection((${JSON.stringify(ip)},8080),2)
 s.sendall(b'GET / HTTP/1.0\\r\\nHost: fixture\\r\\n\\r\\n')
 body=s.recv(4096); s.close()
except (TimeoutError,ConnectionRefusedError,OSError):
 ${allowed ? "raise RuntimeError('positive connectivity failed')" : "print('DENIED')"}
else:
 ${allowed ? "assert b'200 OK' in body; print('AVAILABLE')" : "raise RuntimeError('private endpoint reachable')"}`;
}
