/**
 * The E7 manifest: what a stored reference attests, and what a reader refuses.
 *
 * A pdf on its own is not a reference. Without the profile that produced it and the digest of the
 * input that was rendered, a difference could come from another icu build or from an edited fixture
 * as easily as from the engine. This module owns that contract: it validates it once, at the
 * boundary, and writes it back in a fixed order so an equal manifest is an equal file.
 *
 * The schema stays in the tooling on purpose. Moving it into `@openview/core` would turn a test
 * format into a product contract that integrators could then depend on.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROFILE_FIELDS } from '../reproducibility/fields.mjs';
import { serializeProfile } from '../reproducibility/profile.mjs';

/* Resolved from `core`, which is where pnpm installed zod: `tools/` is not a workspace package, so
   a bare specifier would find nothing beside this file. */
const fromCore = createRequire(new URL('../../packages/core/package.json', import.meta.url));
const { z } = fromCore('zod/v4');

/** The json shape of the manifest. Bumped when the shape changes, never when a document does. */
export const FORMAT_VERSION = 1;

/** Bumped when the definition of one of the digests changes. */
export const GENERATOR_VERSION = 1;

/** Bumped when the bytes a single-page extraction produces can change. */
export const PAGE_EXTRACTOR_VERSION = 1;

/** The one name a manifest goes by, in a candidate directory as in the reference one. */
export const MANIFEST_FILENAME = 'manifest.json';

/**
 * The half of the profile that says whether two runs were ever comparable.
 *
 * A difference here is not a document defect and must never be reported as one: two icu builds
 * write two different space characters, and E7 refuses to qualify bytes across them.
 */
export const HOST_FIELDS = Object.freeze([
  'platform',
  'architecture',
  'node',
  'v8',
  'icu',
  'unicode',
  'launchArguments',
]);

/**
 * The half that says which build did the rendering.
 *
 * A difference here is a real change of renderer. E7 still refuses to call the two profiles equal,
 * but it goes on to show which pages moved, because that is what a deliberate upgrade needs in
 * order to be reviewed.
 */
export const RENDERER_FIELDS = Object.freeze(
  PROFILE_FIELDS.filter((field) => !HOST_FIELDS.includes(field)),
);

/**
 * The host the official corpus is produced on, mirroring the E7 job of the ci workflow.
 *
 * Spelt here so `accept.mjs` can refuse to promote a candidate produced anywhere else. Changing the
 * runner or the node patch of that job means changing this constant and regenerating the corpus in
 * the same commit; a structural test reads the workflow and refuses the two drifting apart.
 */
export const OFFICIAL_HOST = Object.freeze({
  platform: 'linux',
  architecture: 'x64',
  node: '24.11.1',
  launchArguments: Object.freeze(['--no-sandbox']),
});

/**
 * The one directory a reference batch lives in.
 *
 * Resolved from this file rather than from the working directory: the generator refuses to write
 * inside it and the acceptance refuses to write anywhere else, and neither guard may depend on
 * where the operator happened to stand when they typed the command.
 */
export const REFERENCES_DIRECTORY = fileURLToPath(
  new URL('../../tests/golden/e7/references/', import.meta.url),
);

const HEX_64 = /^[0-9a-f]{64}$/;

/** Lower-case ascii words joined by single hyphens: stable, sortable, and free of business data. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The same, plus the one extension a reference file may carry. Rejects `..`, separators and `.txt`. */
const PDF_FILENAME = /^[a-z0-9]+(?:-[a-z0-9]+)*\.pdf$/;

const sha256 = z.string().regex(HEX_64, 'must be 64 lower-case hexadecimal characters');

const digestRecord = z.strictObject({
  bytes: z.int().positive(),
  sha256,
});

/**
 * The profile shape, built FROM the E6 field list rather than beside it.
 *
 * Spelling thirteen keys again here would create a second list to keep in step, and the day the two
 * disagreed the manifest would attest something the comparator does not read.
 */
const profileShape = Object.fromEntries(
  PROFILE_FIELDS.map((field) => {
    if (field === 'fonts') {
      return [field, z.array(z.strictObject({ id: z.string().min(1), sha256 })).min(1)];
    }
    if (field === 'launchArguments') {
      return [field, z.array(z.string().min(1))];
    }
    if (field === 'pdfCanonicalizer') {
      return [field, z.int().positive()];
    }
    return [field, z.string().min(1)];
  }),
);

const pageRecord = z.strictObject({
  number: z.int().positive(),
  pdf: digestRecord,
  pagination: digestRecord,
});

const documentRecord = z
  .strictObject({
    id: z.string().regex(SLUG, 'must be lower-case ascii words joined by hyphens'),
    recipeVersion: z.int().positive(),
    filename: z.string().regex(PDF_FILENAME, 'must be a hyphenated lower-case name ending in .pdf'),
    inputSha256: sha256,
    storedTemplateSha256: sha256.optional(),
    pdf: digestRecord,
    html: digestRecord,
    sheet: digestRecord,
    notices: digestRecord,
    pages: z.array(pageRecord).min(1),
  })
  .refine((document) => document.pages.every((page, index) => page.number === index + 1), {
    error: 'pages must be numbered 1..N, in order and without a gap',
    path: ['pages'],
  });

const manifestSchema = z
  .strictObject({
    /* Pinned rather than merely typed: a manifest written by another harness must produce a
       readable refusal here, not a partial interpretation further down. */
    formatVersion: z.literal(FORMAT_VERSION),
    generatorVersion: z.literal(GENERATOR_VERSION),
    pageExtractorVersion: z.literal(PAGE_EXTRACTOR_VERSION),
    profile: z.strictObject(profileShape),
    documents: z.array(documentRecord).min(1),
  })
  .superRefine((manifest, context) => {
    const ids = new Set();
    const filenames = new Set();
    for (const [index, document] of manifest.documents.entries()) {
      if (ids.has(document.id)) {
        context.addIssue({
          code: 'custom',
          message: 'two documents share one id',
          path: ['documents', index, 'id'],
        });
      }
      ids.add(document.id);
      if (filenames.has(document.filename)) {
        context.addIssue({
          code: 'custom',
          message: 'two documents share one filename',
          path: ['documents', index, 'filename'],
        });
      }
      filenames.add(document.filename);
    }
  });

/** An invalid manifest, named by its path and by the fields at fault -- never by its content. */
export class ManifestError extends Error {
  constructor(path, issues) {
    super(`${path} is not a valid E7 manifest:\n${issues.map((line) => `  - ${line}`).join('\n')}`);
    this.name = 'ManifestError';
    this.issues = issues;
  }
}

/**
 * Validates one manifest at the boundary, once.
 *
 * The issues name the field path and what was expected. They never carry the value that was read:
 * this text is published as a ci artefact, and a manifest is the only place a digest of a document
 * lives.
 */
export function parseManifest(text, path) {
  let candidate;
  try {
    candidate = JSON.parse(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unparseable';
    throw new ManifestError(path, [`the file is not json: ${reason}`]);
  }
  const result = manifestSchema.safeParse(candidate);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const where = issue.path.length === 0 ? '(root)' : issue.path.join('.');
      return `${where}: ${issue.message}`;
    });
    throw new ManifestError(path, issues);
  }
  return result.data;
}

/** Reads and validates the manifest of a corpus directory. */
export function readManifest(directory) {
  const path = join(directory, MANIFEST_FILENAME);
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unreadable';
    throw new ManifestError(path, [`the file could not be read: ${reason}`]);
  }
  return parseManifest(text, path);
}

/**
 * The manifest written with every key in a fixed order and a trailing newline.
 *
 * Insertion order would let two equal manifests serialise to two different files, and the reference
 * would then move without a document moving.
 */
export function serializeManifest(manifest) {
  const ordered = {
    formatVersion: manifest.formatVersion,
    generatorVersion: manifest.generatorVersion,
    pageExtractorVersion: manifest.pageExtractorVersion,
    profile: JSON.parse(serializeProfile(manifest.profile)),
    documents: manifest.documents.map((document) => ({
      id: document.id,
      recipeVersion: document.recipeVersion,
      filename: document.filename,
      inputSha256: document.inputSha256,
      ...(document.storedTemplateSha256 === undefined
        ? {}
        : { storedTemplateSha256: document.storedTemplateSha256 }),
      pdf: document.pdf,
      html: document.html,
      sheet: document.sheet,
      notices: document.notices,
      pages: document.pages.map((page) => ({
        number: page.number,
        pdf: page.pdf,
        pagination: page.pagination,
      })),
    })),
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

/**
 * The fields by which a profile differs from the host the official corpus is produced on.
 *
 * An empty array means the candidate came from the official runner and may be promoted. Anything
 * else names what a reviewer must look at before believing the bytes it carries.
 */
export function officialHostMismatches(profile) {
  const mismatches = [];
  for (const [field, expected] of Object.entries(OFFICIAL_HOST)) {
    if (JSON.stringify(profile[field]) !== JSON.stringify(expected)) {
      mismatches.push(field);
    }
  }
  return mismatches;
}
