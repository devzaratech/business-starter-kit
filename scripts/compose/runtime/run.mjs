import { authorize } from './guard.mjs';
import { Harness } from './harness.mjs';

// Authorization is checked before creating files, contexts or issuing Docker commands.
try {
  const permit = authorize(process.env);
  const result = await new Harness(permit).run();
  console.log(JSON.stringify(result));
  // A green harness job means its implemented checks passed, not that all ES2 gaps closed.
  process.exitCode = result.checksPassed ? 0 : 1;
} catch (e) {
  console.error(JSON.stringify({ status: 'blocked', code: /^[A-Z_]{1,50}$/.test(e.code ?? '') ? e.code : 'HARNESS' }));
  process.exitCode = 2;
}
