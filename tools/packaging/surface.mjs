/**
 * Fails when a publishable tarball would carry test-support material.
 *
 * `npm pack --dry-run` is the ground truth: it applies `files`, `.npmignore` and npm's own
 * built-in rules exactly as `npm publish` will, so this gate reads the tarball that ships rather
 * than a second implementation of the same globs.
 *
 * Run from the repository root: `node tools/packaging/surface.mjs`. It needs a built workspace,
 * and says so rather than reporting an unbuilt package as clean.
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Workspace roots, swept rather than listed: a new package is gated without editing this file. */
const ROOTS = ['packages', 'apps'];

/**
 * The floor below which the sweep is broken rather than clean.
 *
 * A discovery that returns nothing reports every tarball as clean, which is the exact silence
 * this file exists to break.
 */
const MINIMUM_PACKAGES = 5;

/** A directory whose whole content belongs to the suites, helpers included. */
const TEST_DIRECTORY = '__tests__';

/**
 * The four spellings the Vitest glob runs, plus every artefact `tsc` derives from one.
 *
 * A spec file that reaches `dist/` publishes a top-level `vitest` import consumers do not install.
 */
const TEST_FILE = /\.(?:test|spec)\.(?:d\.ts|[cm]?[jt]s)(?:\.map)?$/;

/** @param {string} path */
function isTestSupport(path) {
  const segments = path.split('/');
  const name = segments.at(-1) ?? '';
  return segments.slice(0, -1).includes(TEST_DIRECTORY) || TEST_FILE.test(name);
}

/**
 * Proves the predicate still recognises both shapes, and still leaves production names alone.
 *
 * Without it a mangled pattern would find nothing anywhere and report five clean tarballs.
 */
function witness() {
  const offending = [
    'dist/__tests__/fixtures.js',
    'dist/document/fonts/__tests__/ttf.d.ts.map',
    'dist/template/__tests__/compatibility-fixtures.js.map',
    'dist/parser.spec.js',
    'dist/parser.test.d.ts',
  ];
  const legitimate = [
    'package.json',
    'LICENSE',
    'dist/index.js',
    'dist/index.d.ts.map',
    'dist/attestation.js',
    'dist/latest.d.ts',
  ];
  const missed = offending.filter((path) => !isTestSupport(path));
  const caught = legitimate.filter((path) => isTestSupport(path));
  if (missed.length > 0 || caught.length > 0) {
    throw new Error(
      `the test-support predicate is broken: missed [${missed.join(', ')}], ` +
        `wrongly caught [${caught.join(', ')}]`,
    );
  }
}

/** Every workspace package npm would publish, `private` ones excluded. */
function publishablePackages() {
  const found = [];
  for (const root of ROOTS) {
    /* A root a checkout does not carry is simply not swept: reading it would throw before the
       count below could say what it really found. */
    if (!existsSync(root)) {
      continue;
    }
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      const directory = join(root, entry.name);
      const manifestPath = join(directory, 'package.json');
      if (!entry.isDirectory() || !existsSync(manifestPath)) {
        continue;
      }
      let manifest;
      try {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      } catch (error) {
        const said = error instanceof Error ? error.message : String(error);
        throw new Error(`${manifestPath} is not readable JSON: ${said}`);
      }
      if (manifest.private === true) {
        continue;
      }
      found.push({ name: manifest.name ?? directory, directory, manifest });
    }
  }
  return found;
}

/**
 * The files a consumer resolves on `import`, as the manifest declares them.
 *
 * Checking they are in the tarball turns two silent publishes into failures: shipping an unbuilt
 * package, and narrowing `files` past an entry point `exports` still advertises.
 */
function entryPointsOf(manifest) {
  const declared = [manifest.main, manifest.types].filter((entry) => typeof entry === 'string');
  return [...new Set(declared.map((entry) => entry.replace(/^\.\//, '')))];
}

/** @param {string} directory */
function packedFilesOf(directory) {
  let stdout;
  try {
    /* Through a shell, not `execFileSync`: npm is a `.cmd` shim on Windows, which Node has
       refused to spawn directly since CVE-2024-27980. Every argument below is a literal, and
       `directory` travels as an option instead of inside the command string, so the shell
       interpolates nothing. */
    stdout = execSync('npm pack --dry-run --json', {
      cwd: directory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const said = error instanceof Error ? error.message : String(error);
    const stderr = typeof error?.stderr === 'string' ? `\n${error.stderr}` : '';
    throw new Error(`npm pack failed in ${directory}: ${said}${stderr}`);
  }
  const [report] = JSON.parse(stdout);
  const files = report?.files?.map((file) => file.path) ?? [];
  if (files.length === 0) {
    throw new Error(`npm pack listed no file for ${directory}`);
  }
  return files;
}

witness();

const packages = publishablePackages();
if (packages.length < MINIMUM_PACKAGES) {
  console.error(
    `packaging: swept ${ROOTS.join(' and ')} and found ${packages.length} publishable ` +
      `package(s), expected at least ${MINIMUM_PACKAGES}.`,
  );
  console.error('The discovery is broken, so a clean report would say nothing.');
  process.exit(1);
}

let published = 0;
let unreachable = 0;
for (const { name, directory, manifest } of packages) {
  const files = packedFilesOf(directory);
  const offenders = files.filter(isTestSupport);
  const missing = entryPointsOf(manifest).filter((entry) => !files.includes(entry));

  if (offenders.length === 0 && missing.length === 0) {
    console.log(`packaging ${name}: ${files.length} files, no test-support material`);
    continue;
  }
  published += offenders.length;
  unreachable += missing.length;
  for (const path of offenders) {
    console.error(`packaging ${name}: would publish the test-support file ${path}`);
  }
  for (const entry of missing) {
    console.error(`packaging ${name}: declares ${entry} but the tarball does not carry it`);
  }
}

if (published > 0 || unreachable > 0) {
  console.error('');
  if (published > 0) {
    console.error('A package carries what `files` lets through, not what `tsconfig` emits.');
    console.error('Exclude the paths above from `files`, or stop emitting them.');
  }
  if (unreachable > 0) {
    console.error('A declared entry point absent from the tarball is either narrowed out by');
    console.error('`files` or never built: run `pnpm run build` before this gate.');
  }
  process.exitCode = 1;
}
