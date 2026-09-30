import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../', import.meta.url));

export const COMPOSE_CONFIGURATIONS = [
  ...['local', 'dev', 'qa', 'uat', 'staging', 'prod'].map((name) => ({
    name,
    envFile: `config/env/.env.${name}.example`,
    composeFile: `infra/compose/docker-compose.${name}.yml`
  })),
  { name: 'vps', envFile: '.env.example', composeFile: 'infra/compose/docker-compose.vps.yml' },
  { name: 'edge', envFile: '.env.example', composeFile: 'infra/compose/docker-compose.edge.yml' },
  { name: 'mongodb', envFile: '.env.example', composeFile: 'infra/compose/docker-compose.mongodb.yml' },
  { name: 'postgrest', envFile: '.env.example', composeFile: 'infra/compose/docker-compose.postgrest.yml' }
];

const COMPOSE_CONTROL_VARIABLES = [
  'COMPOSE_ENV_FILES',
  'COMPOSE_FILE',
  'COMPOSE_PATH_SEPARATOR',
  'COMPOSE_PROFILES',
  'COMPOSE_PROJECT_NAME'
];

function collectComposeOverrideNames() {
  const names = new Set(COMPOSE_CONTROL_VARIABLES);
  const files = new Set(COMPOSE_CONFIGURATIONS.flatMap(({ envFile, composeFile }) =>
    [envFile, composeFile]));

  for (const file of files) {
    const contents = readFileSync(resolve(REPOSITORY_ROOT, file), 'utf8');
    for (const match of contents.matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)=/gm)) {
      names.add(match[1].toUpperCase());
    }
    for (const match of contents.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)/g)) {
      names.add(match[1].toUpperCase());
    }
  }
  return names;
}

const COMPOSE_OVERRIDE_NAMES = collectComposeOverrideNames();

function controlledProcessEnvironment() {
  return Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    !COMPOSE_OVERRIDE_NAMES.has(name.toUpperCase())));
}

function interpolate(value, environment) {
  return value.replace(
    /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-(.*?))?\}/g,
    (_match, name, fallback = '') => {
      const configured = environment[name];
      return configured === undefined || configured === '' ? fallback : configured;
    }
  );
}

function bindingFromPort(port, environment) {
  if (typeof port === 'object') {
    if (port.published === undefined) return null;
    const hostIp = interpolate(String(port.host_ip ?? '0.0.0.0'), environment);
    const published = interpolate(String(port.published), environment);
    return { hostIp, published, protocol: port.protocol ?? 'tcp' };
  }

  const parts = interpolate(port, environment).split(':');
  if (parts.length < 2) return null;
  const target = parts.pop();
  const published = parts.pop();
  const hostIp = parts.join(':') || '0.0.0.0';
  return { hostIp, published, protocol: 'tcp' };
}

export function findDuplicatePublishedBindings(model, environment) {
  const seen = [];
  const duplicates = [];
  const wildcardAddresses = new Set(['0.0.0.0', '::', '[::]']);

  for (const [serviceName, service] of Object.entries(model.services ?? {})) {
    for (const port of service.ports ?? []) {
      const binding = bindingFromPort(port, environment);
      if (!binding) continue;

      const previous = seen.find((candidate) =>
        candidate.published === binding.published &&
        candidate.protocol === binding.protocol &&
        (candidate.hostIp === binding.hostIp ||
          wildcardAddresses.has(candidate.hostIp) || wildcardAddresses.has(binding.hostIp)));

      if (previous) {
        const hostIp = previous.hostIp === binding.hostIp ? binding.hostIp : '*';
        duplicates.push({
          binding: `${hostIp}:${binding.published}/${binding.protocol}`,
          services: [previous.serviceName, serviceName]
        });
      }
      seen.push({ ...binding, serviceName });
    }
  }

  return duplicates;
}

function runCompose(configuration, configArguments) {
  const result = spawnSync('docker', [
    'compose', '--env-file', configuration.envFile, '-f', configuration.composeFile,
    'config', ...configArguments
  ], {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
    env: controlledProcessEnvironment(),
    shell: false
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${configuration.name}: Compose render failed\n${result.stderr.trim()}`);
  }
  return result.stdout;
}

function parseComposeEnvironment(output) {
  return Object.fromEntries(output.split(/\r?\n/).filter(Boolean).map((line) => {
    const separator = line.indexOf('=');
    return separator < 0 ? [line, ''] : [line.slice(0, separator), line.slice(separator + 1)];
  }));
}

export function validateComposeConfigurations(configurations = COMPOSE_CONFIGURATIONS) {
  return configurations.map((configuration) => {
    const environment = parseComposeEnvironment(runCompose(configuration, ['--environment']));
    const authoredModel = JSON.parse(runCompose(configuration, ['--no-interpolate', '--format', 'json']));
    const duplicates = findDuplicatePublishedBindings(authoredModel, environment);
    if (duplicates.length > 0) {
      const details = duplicates.map(({ binding, services }) =>
        `${binding} (${services.join(', ')})`).join('; ');
      throw new Error(`${configuration.name}: duplicate published binding(s): ${details}`);
    }

    const renderedModel = JSON.parse(runCompose(configuration, ['--format', 'json']));
    const n8nTargets = (renderedModel.services?.n8n?.ports ?? []).map(({ target }) => target);
    return { name: configuration.name, n8nTargets };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const result of validateComposeConfigurations()) {
    console.log(`PASS ${result.name}`);
  }
}
