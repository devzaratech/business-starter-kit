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
