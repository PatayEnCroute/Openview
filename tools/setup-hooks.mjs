/**
 * Points git at .githooks. Invoked by the root `prepare` script, so it runs on
 * every `pnpm install` -- in every contributor clone and in CI.
 *
 * Two things it must never do, both learned the hard way:
 *
 * 1. Never touch a repository that is not this one. `git rev-parse --git-dir`
 *    searches ANCESTOR directories, so a vendored or tarball copy of Openview
 *    sitting anywhere under another checkout passed that check and then rewrote
 *    the OUTER repository's `core.hooksPath`, silently disabling every hook that
 *    project had -- pointing them at a `.githooks` directory that does not exist
 *    there -- while never installing Openview's own hook. The toplevel is
 *    compared against this file's own location instead.
 *
 * 2. Never fail the install. A source tarball, a vendored copy or a Docker stage
 *    that copies package files without `.git` has no repository at all, and a
 *    read-only or lock-contended `.git/config` cannot be written. Neither is a
 *    reason to abort `pnpm install` for a hook that is irrelevant in that context,
 *    so every git call is guarded and every failure is a warning.
 */
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** `tools/` sits directly under the repository root. */
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Why the last `git()` call returned null, for the warning message. */
let lastGitError = '';

/**
 * ENOENT means git itself is missing, which is a different diagnosis from "not a
 * git checkout" -- reporting the latter for the former sent readers looking for an
 * absent `.git` instead of an absent `git`. git's stderr is captured rather than
 * discarded, which had left `error.message` as a bare "Command failed".
 */
function describe(error) {
  if (typeof error !== 'object' || error === null) {
    return String(error);
  }
  if ('code' in error && error.code === 'ENOENT') {
    return 'git is not installed or not on PATH';
  }
  const stderr = 'stderr' in error && error.stderr ? String(error.stderr).trim() : '';
  return stderr || (error instanceof Error ? error.message.trim() : String(error));
}

/** Trimmed stdout, or null when git cannot be reached or exits non-zero. */
function git(args) {
  try {
    return execFileSync('git', args, {
      cwd: packageRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    lastGitError = describe(error);
    return null;
  }
}

function skip(reason) {
  console.warn(`[openview] skipping git hook setup: ${reason}`);
  process.exit(0);
}

/** Windows reports paths whose drive-letter case need not match Node's. */
function samePath(a, b) {
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

const toplevel = git(['rev-parse', '--show-toplevel']);

if (toplevel === null) {
  skip(`not a git checkout (${lastGitError})`);
}

if (!samePath(resolve(toplevel), packageRoot)) {
  skip(
    `${packageRoot} is not the root of its own repository (git reports ${resolve(toplevel)}), so core.hooksPath is left alone`,
  );
}

// `--get` exits 1 when the key is unset, which `git()` reports as null.
const previous = git(['config', '--local', '--get', 'core.hooksPath']);

if (previous === '.githooks') {
  process.exit(0);
}

if (git(['config', 'core.hooksPath', '.githooks']) === null) {
  skip(`could not write core.hooksPath (${lastGitError})`);
}

if (previous) {
  console.warn(
    `[openview] core.hooksPath was '${previous}', now '.githooks' -- hooks in '${previous}' no longer run`,
  );
}
