import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { digestOf, recordOf } from '../../../../tools/golden/canonical-json.mjs';
import { CORPUS } from '../../../../tools/golden/corpus.mjs';
import {
  FORMAT_VERSION,
  GENERATOR_VERSION,
  HOST_FIELDS,
  MANIFEST_FILENAME,
  PAGE_EXTRACTOR_VERSION,
  RENDERER_FIELDS,
} from '../../../../tools/golden/manifest.mjs';
import { PROFILE_FIELDS } from '../../../../tools/reproducibility/profile.mjs';
import { canonicalizePdf } from '../canonicalize-pdf.js';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const COMPARE = join(ROOT, 'tools', 'golden', 'compare.mjs');
const REFERENCES = join(ROOT, 'tests', 'golden', 'e7', 'references');
const WORKFLOW = join(ROOT, '.github', 'workflows', 'ci.yml');

const HEX = 'a'.repeat(64);
const digest = { bytes: 12, sha256: HEX };

/** A profile shaped like the one the official job produces. */
const PROFILE = {
  platform: 'linux',
  architecture: 'x64',
  node: '24.11.1',
  v8: '13.6.233.10-node.28',
  icu: '77.1',
  unicode: '16.0',
  engine: '0.1.0',
  adapter: '0.1.0',
  puppeteer: '25.8.0',
  chromium: 'Chrome/152.0.7977.42',
  fonts: [{ id: 'Inter 400 normal', sha256: 'b'.repeat(64) }],
  pdfCanonicalizer: 1,
  launchArguments: ['--no-sandbox'],
};

/** Something a business document would contain, so a test can prove the report never leaks it. */
const SECRET = 'Longacre Works, 4 820,55 EUR';

const temporary = (prefix: string) => mkdtempSync(join(tmpdir(), `openview-${prefix}-`));

/**
 * A pdf of `pages` pages, each carrying its own mark.
 *
 * Two documents built with the same marks are equal byte for byte; two built with different marks
 * differ on the page that carries them, which is what lets a test move exactly one page.
 *
 * Canonicalised like a delivered document: `PDFDocument.create()` stamps the moment it ran, so two
 * batches built a second apart would otherwise differ by that alone and every case here would be a
 * coin toss.
 */
async function pdfOf(pages: number, marks: readonly string[]): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  for (let rank = 1; rank <= pages; rank += 1) {
    document.addPage([300, 400]).drawText(marks[rank - 1] ?? `page ${rank}`, { x: 20, y: 350 });
  }
  return await canonicalizePdf(
    await document.save({ useObjectStreams: false, addDefaultPage: false }),
  );
}

const marksOf = (pages: number) =>
  Array.from({ length: pages }, (_u, index) => `page ${index + 1}`);

interface BatchOptions {
  readonly pages?: Partial<Record<string, number>>;
  readonly marks?: Partial<Record<string, readonly string[]>>;
  readonly certificates?: Partial<Record<string, Partial<Record<number, string>>>>;
  readonly html?: Partial<Record<string, string>>;
  readonly sheet?: Partial<Record<string, string>>;
  readonly notices?: Partial<Record<string, string>>;
  readonly input?: Partial<Record<string, string>>;
  readonly profile?: Record<string, unknown>;
}

/**
 * A whole batch on disk: six synthetic pdfs and the manifest that attests them.
 *
 * Synthetic on purpose. What is under test here is the comparator -- what it names, what it refuses
 * and what it never prints -- and six real renders per case would make that a browser test.
 */
async function batch(directory: string, options: BatchOptions = {}): Promise<string> {
  const documents = [];
  for (const scenario of CORPUS) {
    const pages = options.pages?.[scenario.id] ?? scenario.expectedPages;
    const bytes = await pdfOf(pages, options.marks?.[scenario.id] ?? marksOf(pages));
    writeFileSync(join(directory, scenario.filename), bytes);
    documents.push({
      id: scenario.id,
      recipeVersion: scenario.recipeVersion,
      filename: scenario.filename,
      inputSha256: options.input?.[scenario.id] ?? HEX,
      pdf: recordOf(bytes),
      html: { bytes: 40, sha256: options.html?.[scenario.id] ?? HEX },
      sheet: { bytes: 26, sha256: options.sheet?.[scenario.id] ?? HEX },
      notices: { bytes: 2, sha256: options.notices?.[scenario.id] ?? HEX },
      pages: Array.from({ length: pages }, (_unused, index) => ({
        number: index + 1,
        pdf: digest,
        pagination: {
          bytes: 64,
          sha256: options.certificates?.[scenario.id]?.[index + 1] ?? HEX,
        },
      })),
    });
  }
  writeFileSync(
    join(directory, MANIFEST_FILENAME),
    `${JSON.stringify(
      {
        formatVersion: FORMAT_VERSION,
        generatorVersion: GENERATOR_VERSION,
        pageExtractorVersion: PAGE_EXTRACTOR_VERSION,
        profile: options.profile ?? PROFILE,
        documents,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  return directory;
}

/** Runs the comparator on two directories and answers what it decided. */
function compare(reference: string, candidate: string): { code: number; output: string } {
  try {
    const output = execFileSync(process.execPath, [COMPARE, reference, candidate], {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return { code: 0, output };
  } catch (error: unknown) {
    /* Refined rather than asserted: what `execFileSync` throws is `unknown`. */
    const failure = error instanceof Error ? error : undefined;
    const status = failure !== undefined && 'status' in failure ? failure.status : undefined;
    const stdout = failure !== undefined && 'stdout' in failure ? failure.stdout : undefined;
    const stderr = failure !== undefined && 'stderr' in failure ? failure.stderr : undefined;
    return {
      code: typeof status === 'number' ? status : 1,
      output: `${typeof stdout === 'string' ? stdout : ''}${typeof stderr === 'string' ? stderr : ''}`,
    };
  }
}

/** The report the comparator left beside the candidate. */
const reportOf = (candidate: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(candidate, 'report.json'), 'utf8'));

/** Two batches built the same way, ready for one of them to be moved. */
async function pair(options: BatchOptions = {}): Promise<{ reference: string; candidate: string }> {
  return {
    reference: await batch(temporary('golden-reference')),
    candidate: await batch(temporary('golden-candidate'), options),
  };
}

const workflow = () => readFileSync(WORKFLOW, 'utf8');

/** The block of the E7 job, so an assertion cannot pass on a line of the E6 one. */
function goldenJob(): string {
  const text = workflow();
  const start = text.indexOf('\n  golden-corpus:');
  if (start < 0) {
    throw new Error('the workflow declares no golden-corpus job');
  }
  const after = text.slice(start + 1);
  const end = after.indexOf('\n  compare-machines:');
  return end < 0 ? after : after.slice(0, end);
}

describe('a batch that did not move', () => {
  it('accepts two identical batches and says so without naming a page', async () => {
    const { reference, candidate } = await pair();
    const { code, output } = compare(reference, candidate);
    expect(code).toBe(0);
    expect(output).toContain('byte for byte');
    expect(output).not.toContain('page 1:');
    expect(reportOf(candidate).status).toBe('identical');
  });

  it('leaves every reference file exactly as it found it', async () => {
    const { reference, candidate } = await pair();
    const before = readdirSync(reference).map((entry) => ({
      entry,
      size: statSync(join(reference, entry)).size,
      digest: digestOf(readFileSync(join(reference, entry))),
    }));
    compare(reference, candidate);
    const after = readdirSync(reference).map((entry) => ({
      entry,
      size: statSync(join(reference, entry)).size,
      digest: digestOf(readFileSync(join(reference, entry))),
    }));
    expect(after).toStrictEqual(before);
    expect(readdirSync(reference)).not.toContain('report.json');
  });
});

describe('a batch whose documents moved', () => {
  it('names the scenario and the page whose isolated pdf differs', async () => {
    const { reference, candidate } = await pair({
      marks: { 'invoice-sixty-bare': ['page 1', 'moved', 'page 3', 'page 4'] },
    });
    const { code, output } = compare(reference, candidate);
    expect(code).toBe(1);
    expect(output).toContain('E7 invoice-sixty-bare: reference differs');
    expect(output).toContain('page 2: isolated pdf differs');
    expect(output).not.toContain('page 1: isolated pdf differs');
    expect(output).not.toContain('E7 invoice-one-page');
  });

  it('names the page whose pagination certificate differs, and only that one', async () => {
    const { reference, candidate } = await pair({
      certificates: { 'invoice-sixty-fr-eur': { 3: 'c'.repeat(64) } },
    });
    const { code, output } = compare(reference, candidate);
    expect(code).toBe(1);
    expect(output).toContain('page 3: pagination certificate differs');
    expect(output).not.toContain('page 2:');
  });

  it('reports both when one page moved in the pdf and in the certificate', async () => {
    const { reference, candidate } = await pair({
      marks: { 'invoice-sixty-layered': ['page 1', 'page 2', 'moved', 'page 4', 'page 5'] },
      certificates: { 'invoice-sixty-layered': { 3: 'c'.repeat(64) } },
    });
    const { output } = compare(reference, candidate);
    expect(output).toContain('page 3: isolated pdf differs; pagination certificate differs');
  });

  it('names the added pages when the document grew', async () => {
    const { reference, candidate } = await pair({ pages: { 'invoice-one-page': 2 } });
    const { code, output } = compare(reference, candidate);
    expect(code).toBe(1);
    expect(output).toContain('added page(s): 2');
  });

  it('names the missing pages when the document shrank', async () => {
    const { reference, candidate } = await pair({ pages: { 'invoice-sixty-bare': 3 } });
    const { code, output } = compare(reference, candidate);
    expect(code).toBe(1);
    expect(output).toContain('pages: 4 against 3');
    expect(output).toContain('missing page(s): 4');
  });

  it('says the whole document may be affected when only the html moved', async () => {
    const { reference, candidate } = await pair({
      html: { 'invoice-sixty-en-usd': 'c'.repeat(64) },
    });
    const { code, output } = compare(reference, candidate);
    expect(code).toBe(1);
    expect(output).toContain('html: shared source differs; pages 1..5 may be affected');
  });

  it('says document-level when the file moved but no page did', async () => {
    const reference = temporary('golden-reference');
    const candidate = temporary('golden-candidate');
    await batch(reference);
    await batch(candidate);
    /* The same pages, saved through another writer: the catalogue moves, the pages do not. */
    const [first] = CORPUS;
    if (first === undefined) {
      throw new Error('the register carries at least one scenario');
    }
    const source = await PDFDocument.load(readFileSync(join(candidate, first.filename)));
    const rewritten = await source.save({ useObjectStreams: true, addDefaultPage: false });
    writeFileSync(join(candidate, first.filename), rewritten);
    const manifest = JSON.parse(readFileSync(join(candidate, MANIFEST_FILENAME), 'utf8'));
    manifest.documents[0].pdf = recordOf(rewritten);
    writeFileSync(join(candidate, MANIFEST_FILENAME), JSON.stringify(manifest), 'utf8');

    const { code, output } = compare(reference, candidate);
    expect(code).toBe(1);
    expect(output).toContain('document-level; pages 1 potentially affected');
  });

  it('names the input when a fixture moved, rather than blaming the renderer', async () => {
    const { reference, candidate } = await pair({ input: { 'historical-v1': 'c'.repeat(64) } });
    const { code, output } = compare(reference, candidate);
    expect(code).toBe(1);
    expect(output).toContain('input: the rendered template, data set or options differ');
  });

  it('names the sheet and the notices when either moved', async () => {
    const { reference, candidate } = await pair({
      sheet: { 'invoice-one-page': 'c'.repeat(64) },
      notices: { 'invoice-sixty-bare': 'd'.repeat(64) },
    });
    const { output } = compare(reference, candidate);
    expect(output).toContain('sheet: the document was composed on another sheet');
    expect(output).toContain('notices: the pagination emitted another set of notices');
  });

  it('accumulates the six scenarios instead of stopping at the first', async () => {
    const marks = Object.fromEntries(
      CORPUS.map((scenario) => [scenario.id, marksOf(scenario.expectedPages).map(() => 'moved')]),
    );
    const { reference, candidate } = await pair({ marks });
    const { output } = compare(reference, candidate);
    for (const scenario of CORPUS) {
      expect(output).toContain(`E7 ${scenario.id}: reference differs`);
    }
    expect(output).toContain('6 of 6 documents differ');
  });
});

describe('what no digest of a manifest is allowed to excuse', () => {
  it('refuses two files whose bytes differ even when both manifests claim one digest', async () => {
    const reference = await batch(temporary('golden-reference'));
    const candidate = await batch(temporary('golden-candidate'), {
      marks: { 'invoice-one-page': ['moved'] },
    });
    /* The candidate manifest is rewritten to claim the reference's own digest. A comparator that
       read the manifest instead of the file would call these two documents equal. */
    const referenceManifest = JSON.parse(readFileSync(join(reference, MANIFEST_FILENAME), 'utf8'));
    const candidateManifest = JSON.parse(readFileSync(join(candidate, MANIFEST_FILENAME), 'utf8'));
    candidateManifest.documents[0].pdf = referenceManifest.documents[0].pdf;
    writeFileSync(join(candidate, MANIFEST_FILENAME), JSON.stringify(candidateManifest), 'utf8');

    const { code, output } = compare(reference, candidate);
    expect(code).toBe(1);
    expect(output).toContain('is not the file its own manifest attests');
    expect(output).toContain('page 1: isolated pdf differs');
  });
});

describe('the closure of the batch against its register', () => {
  it('refuses a pdf the manifest names and the directory does not hold', async () => {
    const { reference, candidate } = await pair();
    const [first] = CORPUS;
    if (first === undefined) {
      throw new Error('the register carries at least one scenario');
    }
    rmSync(join(candidate, first.filename));
    const { code, output } = compare(reference, candidate);
    expect(code).toBe(1);
    expect(output).toContain('absent from the directory');
  });

  it('refuses an orphan pdf no manifest entry names', async () => {
    const { reference, candidate } = await pair();
    writeFileSync(join(candidate, 'seventh.pdf'), await pdfOf(1, ['x']));
    const { code, output } = compare(reference, candidate);
    expect(code).toBe(1);
    expect(output).toContain('seventh.pdf');
    expect(output).toContain('named by no manifest entry');
  });

  it('refuses a manifest that dropped a scenario the register still carries', async () => {
    const { reference, candidate } = await pair();
    const manifest = JSON.parse(readFileSync(join(candidate, MANIFEST_FILENAME), 'utf8'));
    const dropped = manifest.documents.pop();
    rmSync(join(candidate, dropped.filename));
    writeFileSync(join(candidate, MANIFEST_FILENAME), JSON.stringify(manifest), 'utf8');
    const { code, output } = compare(reference, candidate);
    expect(code).toBe(1);
    expect(output).toContain('the register lists');
  });

  it('refuses a manifest whose scenarios are in another order', async () => {
    const { reference, candidate } = await pair();
    const manifest = JSON.parse(readFileSync(join(candidate, MANIFEST_FILENAME), 'utf8'));
    manifest.documents.reverse();
    writeFileSync(join(candidate, MANIFEST_FILENAME), JSON.stringify(manifest), 'utf8');
    const { code, output } = compare(reference, candidate);
    expect(code).toBe(1);
    expect(output).toContain('the register lists');
  });

  it('refuses a directory with no manifest at all, naming the path', () => {
    const reference = temporary('golden-empty-reference');
    const candidate = temporary('golden-empty-candidate');
    const { code, output } = compare(reference, candidate);
    expect(code).toBe(1);
    expect(output).toContain(MANIFEST_FILENAME);
    expect(reportOf(candidate).status).toBe('manifest-invalid');
  });

  it('refuses a manifest written by another version of the harness', async () => {
    const { reference, candidate } = await pair();
    const manifest = JSON.parse(readFileSync(join(candidate, MANIFEST_FILENAME), 'utf8'));
    manifest.pageExtractorVersion = PAGE_EXTRACTOR_VERSION + 1;
    writeFileSync(join(candidate, MANIFEST_FILENAME), JSON.stringify(manifest), 'utf8');
    const { code, output } = compare(reference, candidate);
    expect(code).toBe(1);
    expect(output).toContain('pageExtractorVersion');
    expect(output).not.toContain('isolated pdf differs');
  });
});

describe('the profile, compared before a byte is read', () => {
  it.each([...HOST_FIELDS])(
    'refuses two batches whose %s differs, and reads no document',
    async (field) => {
      const moved = { ...PROFILE, [field]: field === 'launchArguments' ? [] : 'elsewhere' };
      const { reference, candidate } = await pair({ profile: moved });
      const { code, output } = compare(reference, candidate);
      expect(code).toBe(1);
      expect(output).toContain(`profile.${field}`);
      expect(output).toContain('their bytes say nothing');
      expect(output).not.toContain('reference differs');
      expect(reportOf(candidate).status).toBe('host-profile');
    },
  );

  it.each([...RENDERER_FIELDS])(
    'fails on a different %s and still shows which documents moved',
    async (field) => {
      const moved = {
        ...PROFILE,
        [field]:
          field === 'fonts'
            ? [{ id: 'Inter 400 normal', sha256: 'c'.repeat(64) }]
            : field === 'pdfCanonicalizer'
              ? 2
              : '9.9.9',
      };
      const { reference, candidate } = await pair({
        profile: moved,
        marks: { 'invoice-one-page': ['moved'] },
      });
      const { code, output } = compare(reference, candidate);
      expect(code).toBe(1);
      expect(output).toContain(`profile.${field}`);
      expect(output).toContain('another renderer');
      expect(output).toContain('E7 invoice-one-page: reference differs');
    },
  );

  it('compares every one of the thirteen fields, host half plus renderer half', () => {
    expect([...HOST_FIELDS, ...RENDERER_FIELDS].sort()).toStrictEqual([...PROFILE_FIELDS].sort());
  });

  it('sorts the launch arguments before comparing them', async () => {
    const reference = await batch(temporary('golden-reference'), {
      profile: { ...PROFILE, launchArguments: ['--a', '--b'] },
    });
    const candidate = await batch(temporary('golden-candidate'), {
      profile: { ...PROFILE, launchArguments: ['--a', '--b'] },
    });
    expect(compare(reference, candidate).code).toBe(0);
  });
});

describe('what the published report is allowed to carry', () => {
  it('carries ids, digests, page counts and categories, and no document at all', async () => {
    const { reference, candidate } = await pair({
      marks: { 'invoice-sixty-fr-eur': ['page 1', SECRET, 'page 3', 'page 4', 'page 5'] },
    });
    const { output } = compare(reference, candidate);
    const report = readFileSync(join(candidate, 'report.json'), 'utf8');
    expect(report).toContain('invoice-sixty-fr-eur');
    expect(report).toContain('"status"');
    expect(report).not.toContain(SECRET);
    expect(report).not.toContain('<html');
    expect(report).not.toContain('doctype');
    expect(output).not.toContain(SECRET);
  });

  it('reads back as json a reviewer can diff', async () => {
    const { reference, candidate } = await pair();
    compare(reference, candidate);
    const report = reportOf(candidate);
    expect(report.status).toBe('identical');
    expect(Array.isArray(report.documents)).toBe(true);
  });
});

describe('the tracked reference directory', () => {
  it('holds no pdf the register does not name, whether or not the batch has landed yet', () => {
    const named = new Set(CORPUS.map((scenario) => scenario.filename));
    const strays = readdirSync(REFERENCES).filter(
      (entry) => entry.toLowerCase().endsWith('.pdf') && !named.has(entry),
    );
    expect(strays).toStrictEqual([]);
  });

  it('explains, in writing, how a batch gets in', () => {
    expect(readFileSync(join(REFERENCES, 'README.md'), 'utf8')).toContain('accept.mjs');
  });
});

describe('the ci job that runs this gate', () => {
  it('pins the runner and the node patch the corpus was produced on', () => {
    const job = goldenJob();
    expect(job).toContain('runs-on: ubuntu-24.04');
    expect(job).toContain('node-version: 24.11.1');
  });

  it('renders through the browser Puppeteer downloaded, with the profiled launch argument', () => {
    const job = goldenJob();
    expect(job).toContain('node tools/golden/render.mjs test-results/golden/e7 --no-sandbox');
    expect(job).not.toContain('executablePath');
  });

  it('compares the tracked references with the candidate, and nothing else', () => {
    expect(goldenJob()).toContain(
      'node tools/golden/compare.mjs tests/golden/e7/references test-results/golden/e7',
    );
  });

  it('persists no credential', () => {
    expect(goldenJob()).toContain('persist-credentials: false');
  });

  it('publishes the candidate only on failure, and only for seven days', () => {
    const job = goldenJob();
    expect(job).toContain('if: failure()');
    expect(job).toContain('retention-days: 7');
    /* `warn`, not `error`: the job has already failed by then, and a second failure here would
       only hide which step actually refused. */
    expect(job).toContain('if-no-files-found: warn');
  });

  it('never accepts a batch: no command any job runs is the acceptance', () => {
    /* The commands, not the comments: the job SAYS it never accepts, and this reads what it does. */
    const commands = [...workflow().matchAll(/^\s*run: (.+)$/gm)].map((match) => match[1] ?? '');
    expect(commands.length).toBeGreaterThan(0);
    expect(commands.filter((command) => command.includes('accept'))).toStrictEqual([]);
  });

  it('runs on every pull request and on main, like the gates beside it', () => {
    const text = workflow();
    expect(text).toContain('branches: [main]');
    expect(text).toContain('pull_request:');
  });
});
