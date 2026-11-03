import { createHash } from 'node:crypto';

export function denySecret() { throw Object.assign(new Error('Secret reference rejected.'), { code: 'SECRET_REFERENCE' }); }
export const secretKey = (service, ref) => `secret-${createHash('sha256').update(JSON.stringify([service, ref])).digest('hex').slice(0, 24)}`;
export function secretMounts(plan, service) {
  return (plan.compose.services[service]?.secrets ?? []).map(s => ({ ref: s.target,
    source: plan.compose.secrets[s.source].file, target: `/run/secrets/${s.target}`, readOnly: true }));
}
export function validateSecretMount(plan, service, mount, verify) {
  const approved = secretMounts(plan, service).find(s => s.source === mount.Source && s.target === mount.Destination);
  if (!approved || mount.Type !== 'bind' || mount.RW !== false || typeof verify !== 'function' || verify(plan, service, approved) !== true) denySecret();
  return approved;
}
