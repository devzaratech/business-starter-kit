import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPOSE_CONFIGURATIONS,
  findDuplicatePublishedBindings,
  validateComposeConfigurations
} from '../validate-compose.mjs';

test('detects published-port duplicates created by environment interpolation', () => {
  const model = {
    services: {
      n8n: {
        ports: [
          '${N8N_HOST_BIND:-127.0.0.1}:${N8N_HOST_PORT:-15678}:5678',
          '${N8N_HOST_BIND:-127.0.0.1}:${N8N_HOST_PORT:-5678}:${N8N_PORT:-5678}'
        ]
      }
    }
  };
  const environment = {
    N8N_HOST_BIND: '127.0.0.1',
    N8N_HOST_PORT: '15678',
    N8N_PORT: '5678'
  };

  assert.deepEqual(findDuplicatePublishedBindings(model, environment), [{
    binding: '127.0.0.1:15678/tcp',
    services: ['n8n', 'n8n']
  }]);
});

test('detects wildcard and specific-address bindings that overlap', () => {
  const model = {
    services: {
      postgres: { ports: ['0.0.0.0:5432:5432'] },
      n8n: { ports: ['127.0.0.1:5432:5678'] }
    }
  };

  assert.deepEqual(findDuplicatePublishedBindings(model, {}), [{
    binding: '*:5432/tcp',
    services: ['postgres', 'n8n']
  }]);
});

test('actual example environments render with unique bindings and stable n8n ports', () => {
  const results = validateComposeConfigurations();
  assert.deepEqual(
    results.map(({ name }) => name),
    ['local', 'dev', 'qa', 'uat', 'staging', 'prod', 'vps', 'edge', 'mongodb', 'postgrest']
  );

  for (const result of results.filter(({ name }) =>
    ['local', 'dev', 'qa', 'uat', 'staging', 'prod', 'vps'].includes(name))) {
    assert.deepEqual(result.n8nTargets, [5678], `${result.name} must publish only n8n container port 5678`);
  }

  assert.equal(COMPOSE_CONFIGURATIONS.length, 10);
});

test('example validation ignores parent Compose interpolation overrides', { concurrency: false }, (t) => {
  const variableNames = ['N8N_HOST_PORT', 'POSTGRES_HOST_PORT'];
  const previous = Object.fromEntries(variableNames.map((name) => [name, process.env[name]]));
  t.after(() => {
    for (const name of variableNames) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  });

  process.env.N8N_HOST_PORT = '5432';
  process.env.POSTGRES_HOST_PORT = '5432';

  assert.doesNotThrow(() => validateComposeConfigurations());
});
