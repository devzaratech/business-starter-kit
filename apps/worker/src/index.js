import { writeFileSync } from 'node:fs';
import { createWorkerHeartbeat } from './heartbeat.js';

const HEARTBEAT_FILE = process.env.WORKER_HEARTBEAT_FILE || '/tmp/worker-heartbeat.json';
const INTERVAL_MS = Number(process.env.WORKER_HEARTBEAT_INTERVAL_MS || 15000);

function emitHeartbeat() {
  const payload = { ...createWorkerHeartbeat(), ts: Date.now() };
  try {
    writeFileSync(HEARTBEAT_FILE, JSON.stringify(payload));
  } catch (error) {
    console.error('Failed to write worker heartbeat', error);
  }
  return payload;
}

console.log('Business Starter Kit worker started', emitHeartbeat());

const timer = setInterval(emitHeartbeat, INTERVAL_MS);

function shutdown(signal) {
  console.log(`Worker received ${signal}, shutting down.`);
  clearInterval(timer);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
