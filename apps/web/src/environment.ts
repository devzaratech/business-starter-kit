const SUPPORTED_ENVIRONMENTS = ['local', 'dev', 'qa', 'uat', 'staging', 'prod'] as const;

type SupportedEnvironment = (typeof SUPPORTED_ENVIRONMENTS)[number];

export function normalizeEnvironment(value: string | undefined): SupportedEnvironment {
  const normalizedValue = (value ?? 'local').trim().toLowerCase();

  if (SUPPORTED_ENVIRONMENTS.includes(normalizedValue as SupportedEnvironment)) {
    return normalizedValue as SupportedEnvironment;
  }

  return 'local';
}
