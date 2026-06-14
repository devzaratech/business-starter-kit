const SUPPORTED_ENVIRONMENTS = ['local', 'dev', 'qa', 'uat', 'staging', 'prod'];

export function normalizeEnvironment(value) {
  const normalizedValue = (value ?? 'local').trim().toLowerCase();

  if (SUPPORTED_ENVIRONMENTS.includes(normalizedValue)) {
    return normalizedValue;
  }

  return 'local';
}
