export function createWorkerHeartbeat(serviceName = 'worker') {
  return {
    service: serviceName,
    status: 'ok'
  };
}
