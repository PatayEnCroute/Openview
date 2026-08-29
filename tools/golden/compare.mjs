/**
 * Compares a candidate batch with the tracked references, and names what moved.
 *
 * Usage: node tools/golden/compare.mjs <reference-directory> <candidate-directory> [report.json]
 *
 * Reads only. Nothing on any path through this file writes into the reference directory, and there
 * is no flag, no environment variable and no mode that blesses a difference: accepting a new batch
 * is a separate command a human runs after looking at the pages.
 *
 * The order matters. The profile is compared before a single byte is read, because two runs that
 * never shared a host were never comparable and reporting their difference as a document defect
 * would be a lie. Every difference of every scenario is then accumulated rather than thrown at the
 * first one, so one run shows the whole radius of a change.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROFILE_FIELDS } from '../reproducibility/fields.mjs';
import { digestOf } from './canonical-json.mjs';
import { CORPUS } from './corpus.mjs';
import { HOST_FIELDS, ManifestError, RENDERER_FIELDS, readManifest } from './manifest.mjs';
import { extractPage } from './pages.mjs';

const USAGE =
  'usage: node tools/golden/compare.mjs <reference-directory> <candidate-directory> [report.json]';

/** The register the two manifests are held against: neither side gets to define the batch. */
const REGISTER = CORPUS.map((scenario) => ({ id: scenario.id, filename: scenario.filename }));

/** A field of the profile, compared as text so an array or an object compares by value. */
const fieldsThatDiffer = (left, right, fields) =>
  fields.filter((field) => JSON.stringify(left[field]) !== JSON.stringify(right[field]));

/**
 * Checks that a directory holds exactly the pdfs its manifest names, and that they all exist.
 *
 * An orphan pdf is as much a failure as a missing one: a file nobody compares is a document that
 * left the batch without anyone deciding to remove it.
 */
function closureOf(directory, manifest, side) {
  const failures = [];
  const named = new Set(manifest.documents.map((document) => document.filename));
  const present = new Set(
    readdirSync(directory).filter((entry) => entry.toLowerCase().endsWith('.pdf')),
  );
  for (const filename of named) {
    if (!present.has(filename)) {
      failures.push(`${side}: ${filename} is named by the manifest and absent from the directory`);
    }
  }
  for (const filename of present) {
    if (!named.has(filename)) {
      failures.push(`${side}: ${filename} is in the directory and named by no manifest entry`);
    }
  }
  const ids = manifest.documents.map((document) => document.id);
  const expected = REGISTER.map((entry) => entry.id);
  if (JSON.stringify(ids) !== JSON.stringify(expected)) {
    failures.push(
      `${side}: the manifest lists [${ids.join(', ')}] where the register lists [${expected.join(', ')}]`,
    );
  }
  /* The register fixes WHICH documents the batch holds and in what order, not how long they are.
     How many pages a scenario takes is a measured consequence the generator checks three ways
     before it writes anything; here, a different count is a difference to be reported page by
     page, not a malformed batch. */
  for (const entry of REGISTER) {
    const document = manifest.documents.find((one) => one.id === entry.id);
    if (document !== undefined && document.filename !== entry.filename) {
      failures.push(
        `${side}: ${entry.id} is stored as ${document.filename} where the register names ${entry.filename}`,
      );
    }
  }
  return failures;
}

/** Reads one stored document and checks it is the document its own manifest attests. */
function readDocument(directory, record, side) {
  const bytes = readFileSync(join(directory, record.filename));
  const attested = bytes.length === record.pdf.bytes && digestOf(bytes) === record.pdf.sha256;
  return { bytes, attested, side };
}

/** Whether two byte strings are equal, length first so a short answer stays short. */
const sameBytes = (left, right) =>
  left.length === right.length && Buffer.from(left).equals(Buffer.from(right));

/** The pages of one rank, derived from both documents and compared as bytes. */
async function comparePage(reference, candidate, number) {
  const left = await extractPage(reference, number);
  const right = await extractPage(candidate, number);
  return sameBytes(left, right);
}

/** `1..5`, or `1` when there is only one -- the shape the failure message reads best in. */
const span = (count) => (count === 1 ? '1' : `1..${count}`);

/**
 * Compares one scenario, and answers everything that differs about it.
 *
 * The single-page derivation only runs when the whole document already differs: identical bytes
 * cannot hide a moved page, and twenty-one extractions on both sides are not free.
 */
async function compareDocument(referenceDirectory, candidateDirectory, left, right) {
  const differences = [];
  const pages = [];
  const notes = [];
  /* Printed after the page lines, because that is the order the reader needs: what the document
     did, which pages moved, and only then the shared source that may explain all of them. */
  const trailing = [];

  if (left.recipeVersion !== right.recipeVersion) {
    differences.push('recipe');
    notes.push(`recipe: version ${left.recipeVersion} against ${right.recipeVersion}`);
  }
  if (left.inputSha256 !== right.inputSha256) {
    differences.push('input');
    notes.push('input: the rendered template, data set or options differ');
  }
  if (left.storedTemplateSha256 !== right.storedTemplateSha256) {
    differences.push('stored-template');
    notes.push('stored-template: the raw stored document differs');
  }

  const reference = readDocument(referenceDirectory, left, 'reference');
  const candidate = readDocument(candidateDirectory, right, 'candidate');
  for (const side of [reference, candidate]) {
    if (!side.attested) {
      differences.push('attestation');
      notes.push(`${side.side}: the stored file is not the file its own manifest attests`);
    }
  }

  const pdfDiffers = !sameBytes(reference.bytes, candidate.bytes);
  if (pdfDiffers) {
    differences.push('pdf');
    notes.push(
      `pdf: ${left.pdf.bytes} bytes / ${left.pdf.sha256} against ${right.pdf.bytes} bytes / ${right.pdf.sha256}`,
    );
  }

  const common = Math.min(left.pages.length, right.pages.length);
  const added = right.pages.slice(common).map((page) => page.number);
  const missing = left.pages.slice(common).map((page) => page.number);
  if (added.length > 0 || missing.length > 0) {
    differences.push('page-count');
    notes.push(`pages: ${left.pages.length} against ${right.pages.length}`);
  }

  for (let rank = 1; rank <= common; rank += 1) {
    const referencePage = left.pages[rank - 1];
    const candidatePage = right.pages[rank - 1];
    if (referencePage === undefined || candidatePage === undefined) {
      continue;
    }
    const moved = [];
    /* Derived here from both stored documents rather than trusted from the manifest: two files with
       the same declared digest and different bytes must not be able to pass. */
    if (pdfDiffers && !(await comparePage(reference.bytes, candidate.bytes, rank))) {
      moved.push('pdf');
    }
    if (referencePage.pagination.sha256 !== candidatePage.pagination.sha256) {
      moved.push('pagination');
    }
    if (moved.length > 0) {
      pages.push({ number: rank, differences: moved });
    }
  }

  if (left.sheet.sha256 !== right.sheet.sha256) {
    differences.push('sheet');
    notes.push('sheet: the document was composed on another sheet');
  }
  if (left.notices.sha256 !== right.notices.sha256) {
    differences.push('notices');
    notes.push('notices: the pagination emitted another set of notices');
  }
  if (left.html.sha256 !== right.html.sha256) {
    differences.push('html');
    trailing.push(
      `html: shared source differs; pages ${span(Math.max(left.pages.length, right.pages.length))} may be affected`,
    );
  }

  if (pages.length > 0) {
    differences.push('page');
  }
  /* A change confined to the catalogue or the metadata moves the file without moving a page. Saying
     "page 1" there would be an invention; the honest answer names the whole document. */
  if (
    pdfDiffers &&
    pages.every((page) => !page.differences.includes('pdf')) &&
    added.length === 0
  ) {
    trailing.push(`document-level; pages ${span(left.pages.length)} potentially affected`);
  }

  return {
    id: left.id,
    status: differences.length === 0 ? 'identical' : 'differs',
    differences,
    notes,
    trailing,
    pdf: { reference: left.pdf, candidate: right.pdf },
    pageCount: { reference: left.pages.length, candidate: right.pages.length },
    addedPages: added,
    missingPages: missing,
    pages,
  };
}

const [referenceDirectory, candidateDirectory, reportPath] = process.argv.slice(2);
if (referenceDirectory === undefined || candidateDirectory === undefined) {
  throw new Error(USAGE);
}
const report = reportPath ?? join(candidateDirectory, 'report.json');

/**
 * Writes the report and leaves with the code the batch earned.
 *
 * A report that cannot be written is said so and nothing else changes: the refusal above it has
 * already been printed, and losing that answer behind an ENOENT on the artefact path would turn a
 * readable diagnosis into a stack trace.
 */
function conclude(body, failed) {
  try {
    writeFileSync(report, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
    console.log(`candidate report: ${report}`);
  } catch (error) {
    console.error(`E7: the report could not be written to ${report}`);
    console.error(`  ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = failed ? 1 : 0;
}

let manifests;
try {
  manifests = {
    reference: readManifest(referenceDirectory),
    candidate: readManifest(candidateDirectory),
  };
} catch (error) {
  if (!(error instanceof ManifestError)) {
    throw error;
  }
  console.error(error.message);
  conclude({ status: 'manifest-invalid', issues: error.issues }, true);
  process.exit(1);
}

const closure = [
  ...closureOf(referenceDirectory, manifests.reference, 'reference'),
  ...closureOf(candidateDirectory, manifests.candidate, 'candidate'),
];
if (closure.length > 0) {
  console.error('E7: the batch is not closed against its register.');
  for (const failure of closure) {
    console.error(`  - ${failure}`);
  }
  conclude({ status: 'not-closed', closure }, true);
  process.exit(1);
}

const hostDifferences = fieldsThatDiffer(
  manifests.reference.profile,
  manifests.candidate.profile,
  HOST_FIELDS,
);
if (hostDifferences.length > 0) {
  console.error('E7: the two batches were produced on two hosts, so their bytes say nothing:');
  for (const field of hostDifferences) {
    console.error(`  - profile.${field}`);
  }
  console.error('A local batch may be inspected against another local batch, never accepted.');
  conclude({ status: 'host-profile', profile: { status: 'host', fields: hostDifferences } }, true);
  process.exit(1);
}

const rendererDifferences = fieldsThatDiffer(
  manifests.reference.profile,
  manifests.candidate.profile,
  RENDERER_FIELDS,
);

const documents = [];
for (const [index, left] of manifests.reference.documents.entries()) {
  const right = manifests.candidate.documents[index];
  if (right === undefined) {
    continue;
  }
  documents.push(await compareDocument(referenceDirectory, candidateDirectory, left, right));
}

const moved = documents.filter((document) => document.status === 'differs');
const failed = moved.length > 0 || rendererDifferences.length > 0;

if (rendererDifferences.length > 0) {
  console.error('E7: the candidate was produced by another renderer, so its bytes are not the');
  console.error('same attestation. The documents below are shown to be reviewed, not accepted:');
  for (const field of rendererDifferences) {
    console.error(`  - profile.${field}`);
  }
}

for (const document of moved) {
  console.error(`E7 ${document.id}: reference differs`);
  for (const note of document.notes) {
    console.error(`  ${note}`);
  }
  for (const page of document.pages) {
    const said = page.differences
      .map((one) => (one === 'pdf' ? 'isolated pdf differs' : 'pagination certificate differs'))
      .join('; ');
    console.error(`  page ${page.number}: ${said}`);
  }
  if (document.addedPages.length > 0) {
    console.error(`  added page(s): ${document.addedPages.join(', ')}`);
  }
  if (document.missingPages.length > 0) {
    console.error(`  missing page(s): ${document.missingPages.join(', ')}`);
  }
  for (const note of document.trailing) {
    console.error(`  ${note}`);
  }
}

if (failed && moved.length > 0) {
  console.error(`E7: ${moved.length} of ${documents.length} documents differ.`);
} else if (failed) {
  console.error(
    `E7: the ${documents.length} documents are identical, but they were not produced by the renderer that froze them.`,
  );
} else {
  for (const document of documents) {
    console.log(`${document.id}: ${document.pageCount.reference} pages, identical`);
  }
  console.log(
    `profile: node ${manifests.reference.profile.node}, icu ${manifests.reference.profile.icu}, ${manifests.reference.profile.chromium}`,
  );
  console.log(`${documents.length} documents match the tracked references byte for byte.`);
}

conclude(
  {
    status: failed ? 'differs' : 'identical',
    profile: {
      status: rendererDifferences.length > 0 ? 'renderer' : 'identical',
      fields: rendererDifferences,
      /* Named so a reader of the artefact can tell how much of the profile was read. */
      compared: PROFILE_FIELDS.length,
    },
    manifest: {
      formatVersion: manifests.reference.formatVersion,
      generatorVersion: manifests.reference.generatorVersion,
      pageExtractorVersion: manifests.reference.pageExtractorVersion,
    },
    documents,
  },
  failed,
);
