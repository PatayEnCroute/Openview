/**
 * Promotes a reviewed candidate batch into the tracked references.
 *
 * Usage: node tools/golden/accept.mjs <candidate-directory>
 *
 * The one command in E7 that writes into `tests/golden/e7/references/`, and it is never called by
 * a workflow. A gate that could bless its own failure is not a gate: the differences a run reports
 * are looked at by a person, the twenty-one pages are rendered and read, and only then is this run.
 *
 * It replaces exactly the files the register names, and deletes nothing else. On a failed write it
 * puts back what was there, so the directory holds either the whole old batch or the whole new one.
 */
import {
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digestOf } from './canonical-json.mjs';
import { CORPUS } from './corpus.mjs';
import {
  MANIFEST_FILENAME,
  officialHostMismatches,
  REFERENCES_DIRECTORY,
  readManifest,
  serializeManifest,
} from './manifest.mjs';

const USAGE = 'usage: node tools/golden/accept.mjs <candidate-directory>';

/** Suffixes of the two shadows a promotion passes through, and never leaves behind. */
const INCOMING = '.incoming';
const OUTGOING = '.outgoing';

/**
 * Everything that makes a candidate unfit to be promoted.
 *
 * Read in full before a byte is written: half a promotion is worse than none, and the cheapest way
 * not to write half of one is to know the whole answer first.
 */
function objectionsTo(candidateDirectory, manifest) {
  const objections = [];
  const ids = manifest.documents.map((document) => document.id);
  const expected = CORPUS.map((scenario) => scenario.id);
  if (JSON.stringify(ids) !== JSON.stringify(expected)) {
    objections.push(
      `the candidate lists [${ids.join(', ')}] where the register lists [${expected.join(', ')}]`,
    );
  }
  for (const field of officialHostMismatches(manifest.profile)) {
    objections.push(
      `profile.${field} is not the official host: only a batch produced by the E7 job is promoted`,
    );
  }
  for (const scenario of CORPUS) {
    const document = manifest.documents.find((one) => one.id === scenario.id);
    if (document === undefined) {
      objections.push(`${scenario.id} is missing from the candidate`);
      continue;
    }
    if (document.filename !== scenario.filename) {
      objections.push(`${scenario.id} is stored as ${document.filename}`);
      continue;
    }
    const path = join(candidateDirectory, document.filename);
    if (!existsSync(path)) {
      objections.push(`${document.filename} is named by the candidate manifest and absent from it`);
      continue;
    }
    const bytes = readFileSync(path);
    if (bytes.length !== document.pdf.bytes || digestOf(bytes) !== document.pdf.sha256) {
      objections.push(`${document.filename} is not the file the candidate manifest attests`);
    }
    if (document.pages.length !== scenario.expectedPages) {
      objections.push(
        `${scenario.id} carries ${document.pages.length} pages where the register expects ${scenario.expectedPages}`,
      );
    }
  }
  const named = new Set(manifest.documents.map((document) => document.filename));
  for (const entry of readdirSync(candidateDirectory)) {
    if (entry.toLowerCase().endsWith('.pdf') && !named.has(entry)) {
      objections.push(`${entry} is in the candidate and named by no manifest entry`);
    }
  }
  return objections;
}

/**
 * Writes the whole batch into the target, or puts back what was there.
 *
 * Every new file lands beside its target first, every old one steps aside second, and the renames
 * happen last. A failure at any point restores the previous batch entire.
 *
 * `rename` exists so a test can make one of those renames fail. There is no other way to reach the
 * recovery path: on a working filesystem the third loop does not fail, and a guarantee of
 * all-or-nothing that nobody has ever seen fail is a claim, not a guarantee.
 */
export function acceptInto(candidateDirectory, targetDirectory, rename = renameSync) {
  const candidate = resolve(candidateDirectory);
  const target = resolve(targetDirectory);
  if (!existsSync(candidate) || !statSync(candidate).isDirectory()) {
    throw new Error(`${candidate} is not a directory`);
  }
  if (!existsSync(target) || !statSync(target).isDirectory()) {
    throw new Error(`${target} is not a directory`);
  }
  const manifest = readManifest(candidate);
  const objections = objectionsTo(candidate, manifest);
  if (objections.length > 0) {
    throw new Error(
      `${candidate} cannot be promoted:\n${objections.map((line) => `  - ${line}`).join('\n')}`,
    );
  }

  const files = [
    ...manifest.documents.map((document) => ({
      name: document.filename,
      bytes: readFileSync(join(candidate, document.filename)),
    })),
    { name: MANIFEST_FILENAME, bytes: Buffer.from(serializeManifest(manifest), 'utf8') },
  ];

  const staged = [];
  const stepped = [];
  /* Tracked separately from `stepped`: promoting into an EMPTY target steps nothing aside, so a
     rename that fails on the fourth file would otherwise leave the first three behind as a batch
     nobody chose -- which is the one state this function exists to make impossible. */
  const promoted = [];
  try {
    for (const file of files) {
      writeFileSync(join(target, `${file.name}${INCOMING}`), file.bytes);
      staged.push(file.name);
    }
    for (const file of files) {
      if (existsSync(join(target, file.name))) {
        rename(join(target, file.name), join(target, `${file.name}${OUTGOING}`));
        stepped.push(file.name);
      }
    }
    for (const file of files) {
      rename(join(target, `${file.name}${INCOMING}`), join(target, file.name));
      promoted.push(file.name);
    }
  } catch (error) {
    /* Undone in the order it was done: what landed goes first, so the restore below always finds
       the name free. */
    for (const name of promoted) {
      rmSync(join(target, name), { force: true });
    }
    for (const name of stepped) {
      if (existsSync(join(target, `${name}${OUTGOING}`))) {
        renameSync(join(target, `${name}${OUTGOING}`), join(target, name));
      }
    }
    for (const name of staged) {
      rmSync(join(target, `${name}${INCOMING}`), { force: true });
    }
    throw error;
  }
  for (const name of stepped) {
    rmSync(join(target, `${name}${OUTGOING}`), { force: true });
  }
  return files.map((file) => file.name);
}

/** True when this file is the entry point, rather than a module a test imported. */
const invoked =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invoked) {
  const [candidate, requestedTarget] = process.argv.slice(2);
  if (candidate === undefined) {
    throw new Error(USAGE);
  }
  /* A target may be spelt out, but only the one: an acceptance that could write anywhere is a way
     to bless a batch into a directory nobody reviews. */
  if (requestedTarget !== undefined && resolve(requestedTarget) !== resolve(REFERENCES_DIRECTORY)) {
    throw new Error(
      `${resolve(requestedTarget)} is not ${resolve(REFERENCES_DIRECTORY)}: references live in one place`,
    );
  }
  try {
    const written = acceptInto(candidate, REFERENCES_DIRECTORY);
    for (const name of written) {
      console.log(`accepted ${name}`);
    }
    console.log(`${written.length} files promoted into ${resolve(REFERENCES_DIRECTORY)}`);
    console.log('Nothing was staged, committed or pushed: read the diff of manifest.json next.');
  } catch (error) {
    /* Reported rather than rethrown: this is the one command a maintainer runs by hand, and the
       objections are the whole answer. The stack behind them says nothing they need. */
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
