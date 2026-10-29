export function requireThat(condition, code) {
  if (!condition) throw Object.assign(new Error(code), { code });
}

export function authorize(env, platform = process.platform) {
  requireThat(platform === 'linux' && env.GITHUB_ACTIONS === 'true' && env.RUNNER_ENVIRONMENT === 'github-hosted' &&
    env.RUNNER_OS === 'Linux' && env.GITHUB_EVENT_NAME === 'workflow_dispatch' &&
    env.GITHUB_REPOSITORY === 'devzaratech/business-starter-kit' && env.GITHUB_REPOSITORY_OWNER === 'devzaratech' &&
    env.GITHUB_ACTOR === 'devzaratech' && env.GITHUB_TRIGGERING_ACTOR === 'devzaratech' &&
    env.BSK_RUNTIME_CONFIRM === 'AUTHORIZE_DISPOSABLE_ES2' && /^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? '') &&
    env.BSK_EXPECTED_SHA === env.GITHUB_SHA && /^[1-9][0-9]{0,19}$/.test(env.GITHUB_RUN_ID ?? '') &&
    /^[1-9][0-9]{0,3}$/.test(env.GITHUB_RUN_ATTEMPT ?? '') && /^\/[a-zA-Z0-9_./-]+$/.test(env.RUNNER_TEMP ?? '') &&
    env.RUNNER_TEMP.slice(1).split('/').every(s => s && s !== '.' && s !== '..'), 'AUTHORIZATION');
  return { run: `${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}`, commit: env.GITHUB_SHA, temp: env.RUNNER_TEMP,
    actor: env.GITHUB_ACTOR, repository: env.GITHUB_REPOSITORY };
}

export function verifyOwner(actual, expected) {
  requireThat((actual.Id ?? actual.Name) === expected.id &&
    Object.entries(expected.labels).every(([k, v]) => (actual.Config?.Labels ?? actual.Labels)?.[k] === v), 'OWNERSHIP');
}

export function assertEngine(info, outerId, run) {
  requireThat(typeof info.ID === 'string' && info.ID.length > 0 && info.ID !== outerId && info.OSType === 'linux' &&
    info.Labels?.includes(`dev.bsk.test-run=${run}`), 'TARGET');
  requireThat(info.CgroupVersion === '2', 'CGROUP_UNSUPPORTED');
}

export function resultStatus(checks, gaps) {
  if (checks.some(c => c.status === 'failed')) return 'failed';
  if (checks.some(c => c.status === 'blocked')) return 'blocked';
  return !checks.length || gaps.length ? 'incomplete' : 'demonstrated';
}
