/**
 * Points git at .githooks. Invoked by the root `prepare` script.
 *
 * Must never fail an install performed outside a git checkout -- a source
 * tarball, a vendored copy, or a Docker stage that copies package files without
 * .git. Running `git config` unconditionally aborted `pnpm install` there with
 * "fatal: not in a git directory", for a hook that is irrelevant in that context.
 */
import { execFileSync } from 'node:child_process';

try {
  execFileSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore' });
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  console.warn(`[openview] not a git checkout, skipping hook setup (${reason})`);
  process.exit(0);
}

execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'inherit' });
