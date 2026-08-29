import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  OccurrenceReference,
  PagePlacement,
  PaginationNotice,
  PaginationPageResult,
  PaginationResult,
} from '@openview/core';
import { CURRENT_SCHEMA_VERSION, parseTemplate } from '@openview/core';
import { describe, expect, it } from 'vitest';
import { canonicalDigest, canonicalJson } from '../../../../tools/golden/canonical-json.mjs';
import {
  CORPUS,
  CORPUS_FILENAMES,
  CORPUS_IDS,
  inputDigestOf,
  storedTemplateDigestOf,
} from '../../../../tools/golden/corpus.mjs';
import {
  certificateOf,
  noticesCertificateOf,
  sheetCertificateOf,
} from '../../../../tools/golden/pages.mjs';
import {
  COMPATIBILITY_PAGE,
  V1_DATA,
  V1_DOCUMENT,
} from '../../../core/dist/template/__tests__/compatibility-fixtures.js';
import { inspectPdf, renderCapturing } from './fixtures.js';

const TOOLS = join(import.meta.dirname, '..', '..', '..', '..', 'tools', 'golden');

/** Room for Chromium to launch and lay one document out, under a loaded machine. */
const RENDER_TIMEOUT_MS = 120_000;

/**
 * The register, spelt out here rather than derived from the module under test.
 *
 * A batch nobody can enumerate is not a safety net: this list is what refuses a scenario silently
 * gaining, losing or renaming itself, and it is the reason a seventh document cannot appear without
 * a reviewer reading a diff that says so.
 */
const EXPECTED = [
  { id: 'invoice-one-page', filename: 'invoice-one-page.pdf', pages: 1, recipeVersion: 1 },
  { id: 'invoice-sixty-bare', filename: 'invoice-sixty-bare.pdf', pages: 4, recipeVersion: 1 },
  { id: 'invoice-sixty-fr-eur', filename: 'invoice-sixty-fr-eur.pdf', pages: 5, recipeVersion: 1 },
  { id: 'invoice-sixty-en-usd', filename: 'invoice-sixty-en-usd.pdf', pages: 5, recipeVersion: 1 },
  {
    id: 'invoice-sixty-layered',
    filename: 'invoice-sixty-layered.pdf',
    pages: 5,
    recipeVersion: 1,
  },
  { id: 'historical-v1', filename: 'historical-v1.pdf', pages: 1, recipeVersion: 1 },
] as const;

/** The scenario of an id, refused loudly rather than reached through an optional. */
function scenarioOf(id: string) {
  const scenario = CORPUS.find((one) => one.id === id);
  if (scenario === undefined) {
    throw new Error(`the register carries no ${id}`);
  }
  return scenario;
}

/** Runs one of the golden tools and answers what it decided. */
function run(tool: string, args: readonly string[]): { code: number; output: string } {
  try {
    const output = execFileSync(process.execPath, [join(TOOLS, tool), ...args], {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return { code: 0, output };
  } catch (error: unknown) {
    /* Refined rather than asserted: what `execFileSync` throws is `unknown`, and reading a field
       off it without checking is exactly the cast AGENTS.md forbids. */
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

const temporary = (prefix: string) => mkdtempSync(join(tmpdir(), `openview-${prefix}-`));

const occurrence = (nodeId: string): OccurrenceReference => ({
  nodeId,
  nodeType: 'text',
  declarationPath: ['root', 'children', 0],
  iterations: [],
});

const PLACEMENT: PagePlacement = {
  occurrence: occurrence('heading'),
  region: 'root',
  role: 'flow',
  fragment: 'whole',
};

const page = (number: number): PaginationPageResult => ({
  number,
  placements: [PLACEMENT],
  report: { incoming: number * 10, completedBy: [occurrence('row')] },
});

const notice: PaginationNotice = {
  code: 'keep-together-fallback',
  occurrence: occurrence('settlement'),
  pages: [2, 3],
};

/** A pagination result shaped like a real one, so a test can move exactly one thing in it. */
const PAGINATION: PaginationResult = {
  sheet: { width: 210, height: 297 },
  html: '<!doctype html><html lang="en"></html>',
  pages: [page(1), page(2), page(3)],
  notices: [notice],
};

/** The same result with one page replaced, so the mutation is confined to that rank. */
function withPage(replacement: PaginationPageResult): PaginationResult {
  return {
    ...PAGINATION,
    pages: PAGINATION.pages.map((one) => (one.number === replacement.number ? replacement : one)),
  };
}

describe('the closed register of scenarios', () => {
  it('carries exactly six documents, in this order and under these names', () => {
    expect([...CORPUS_IDS]).toStrictEqual(EXPECTED.map((entry) => entry.id));
    expect([...CORPUS_FILENAMES]).toStrictEqual(EXPECTED.map((entry) => entry.filename));
  });

  it.each(EXPECTED)('registers $id under $filename, $pages page(s)', (entry) => {
    const scenario = scenarioOf(entry.id);
    expect(scenario.filename).toBe(entry.filename);
    expect(scenario.expectedPages).toBe(entry.pages);
    expect(scenario.recipeVersion).toBe(entry.recipeVersion);
    expect(scenario.duty.length).toBeGreaterThan(0);
  });

  it('spells every id and filename in stable lower-case ascii, with no version in them', () => {
    for (const scenario of CORPUS) {
      expect(scenario.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(scenario.filename).toBe(`${scenario.id}.pdf`);
    }
  });

  it('shares no id and no filename between two scenarios', () => {
    expect(new Set(CORPUS_IDS).size).toBe(CORPUS.length);
    expect(new Set(CORPUS_FILENAMES).size).toBe(CORPUS.length);
  });

  it('takes twenty-one pages in all, which is what a visual review has to read', () => {
    expect(CORPUS.reduce((total, scenario) => total + scenario.expectedPages, 0)).toBe(21);
  });

  it('gives every scenario a distinct input digest', () => {
    expect(new Set(CORPUS.map(inputDigestOf)).size).toBe(CORPUS.length);
  });

  it('carries a stored-document digest on the historical scenario and on no other', () => {
    for (const scenario of CORPUS) {
      const stored = storedTemplateDigestOf(scenario);
      if (scenario.id === 'historical-v1') {
        expect(stored).toMatch(/^[0-9a-f]{64}$/);
      } else {
        expect(stored).toBeUndefined();
      }
    }
  });
});

describe('what the input digest answers for', () => {
  it('moves when the template moves, the data moves or the options move', () => {
    const scenario = scenarioOf('invoice-one-page');
    const baseline = inputDigestOf(scenario);
    const otherTemplate = { ...scenario, template: scenarioOf('invoice-sixty-bare').template };
    const otherData = { ...scenario, data: scenarioOf('invoice-sixty-bare').data };
    const otherOptions = {
      ...scenario,
      options: { presentationSelection: { amount: 'fr-eur-2' } },
    };
    expect(inputDigestOf(otherTemplate)).not.toBe(baseline);
    expect(inputDigestOf(otherData)).not.toBe(baseline);
    expect(inputDigestOf(otherOptions)).not.toBe(baseline);
  });

  it('does not move when the same input is digested twice', () => {
    for (const scenario of CORPUS) {
      expect(inputDigestOf(scenario)).toBe(inputDigestOf(scenario));
    }
  });
});

describe('the two writings of the same stored model', () => {
  it('renders both diagonals from ONE template object, not from two calls', () => {
    /* Identity, not equality: two independently built templates could drift apart without either
       scenario failing, and E4 is precisely the claim that the STORED document is the same. */
    expect(scenarioOf('invoice-sixty-fr-eur').template).toBe(
      scenarioOf('invoice-sixty-en-usd').template,
    );
  });

  it('separates them by their data set and their selection of writings alone', () => {
    const french = scenarioOf('invoice-sixty-fr-eur');
    const english = scenarioOf('invoice-sixty-en-usd');
    expect(canonicalJson(french.data)).not.toBe(canonicalJson(english.data));
    expect(canonicalJson(french.options)).not.toBe(canonicalJson(english.options));
    expect(inputDigestOf(french)).not.toBe(inputDigestOf(english));
  });
});

describe('the historical v1 witness', () => {
  it('is the raw C9 document: version one, and no page of its own', () => {
    expect(V1_DOCUMENT.schemaVersion).toBe(1);
    expect(Object.keys(V1_DOCUMENT)).not.toContain('page');
  });

  it('is not mutated by the migration that reads it', () => {
    const before = canonicalJson(V1_DOCUMENT);
    parseTemplate(V1_DOCUMENT);
    expect(canonicalJson(V1_DOCUMENT)).toBe(before);
  });

  it('arrives at the current stamp on the compatibility page', () => {
    const migrated = parseTemplate(V1_DOCUMENT);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.page.sheet).toStrictEqual(COMPATIBILITY_PAGE.sheet);
    expect(migrated.page.margins).toStrictEqual(COMPATIBILITY_PAGE.margins);
  });

  it('enters the register migrated, with the digest of the raw document beside it', () => {
    const scenario = scenarioOf('historical-v1');
    expect(scenario.template.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(scenario.data).toBe(V1_DATA);
    expect(storedTemplateDigestOf(scenario)).toBe(canonicalDigest(V1_DOCUMENT));
  });

  it(
    'renders to one page of pdf, which is the half of the promise C9 could not hold',
    async () => {
      const scenario = scenarioOf('historical-v1');
      const { bytes } = await renderCapturing(scenario.template, scenario.data);
      expect((await inspectPdf(bytes)).pages).toBe(scenario.expectedPages);
    },
    RENDER_TIMEOUT_MS,
  );
});

describe('where the generator agrees to write', () => {
  it('refuses to run without a directory', () => {
    const { code, output } = run('render.mjs', []);
    expect(code).not.toBe(0);
    expect(output).toContain('usage');
  });

  it('refuses a launch argument it was not sure it understood', () => {
    const { code, output } = run('render.mjs', [temporary('render-stray'), '-no-sandbox']);
    expect(code).not.toBe(0);
    expect(output).toContain('unrecognised launch argument');
  });

  it('refuses a directory that already holds a file', () => {
    const directory = temporary('render-full');
    writeFileSync(join(directory, 'stale.pdf'), 'not empty', 'utf8');
    const { code, output } = run('render.mjs', [directory]);
    expect(code).not.toBe(0);
    expect(output).toContain('already holds');
  });

  it('refuses a path that is a file rather than a directory', () => {
    const directory = temporary('render-file');
    const path = join(directory, 'output');
    writeFileSync(path, '', 'utf8');
    const { code, output } = run('render.mjs', [path]);
    expect(code).not.toBe(0);
    expect(output).toContain('is not a directory');
  });

  it('refuses to write into the tracked references, or anywhere under them', () => {
    const references = join(
      import.meta.dirname,
      '..',
      '..',
      '..',
      '..',
      'tests',
      'golden',
      'e7',
      'references',
    );
    for (const target of [references, join(references, 'nested')]) {
      const { code, output } = run('render.mjs', [target]);
      expect(code).not.toBe(0);
      expect(output).toContain('tracked reference directory');
    }
    /* And it did not create the nested directory on its way to refusing. */
    expect(readdirSync(references)).not.toContain('nested');
  });
});

describe('the E5 certificate of one page', () => {
  it('carries the page of that rank and the notices that name it, and nothing else', () => {
    const certificate = JSON.parse(certificateOf(PAGINATION, 2));
    expect(certificate.page.number).toBe(2);
    expect(certificate.notices).toHaveLength(1);
    expect(certificateOf(PAGINATION, 2)).not.toContain('doctype');
  });

  it('leaves a rank the notices do not name without them', () => {
    expect(JSON.parse(certificateOf(PAGINATION, 1)).notices).toStrictEqual([]);
  });

  it('refuses a rank the pagination does not carry', () => {
    expect(() => certificateOf(PAGINATION, 4)).toThrow(/page 4/);
  });

  it.each([
    [
      'a placement region',
      withPage({ ...page(2), placements: [{ ...PLACEMENT, region: 'header' }] }),
    ],
    [
      'a placement role',
      withPage({ ...page(2), placements: [{ ...PLACEMENT, role: 'table-header' }] }),
    ],
    [
      'a fragment state',
      withPage({ ...page(2), placements: [{ ...PLACEMENT, fragment: 'first' }] }),
    ],
    [
      'an incoming report',
      withPage({ ...page(2), report: { incoming: 999, completedBy: [occurrence('row')] } }),
    ],
    [
      'a completed row',
      withPage({ ...page(2), report: { incoming: 20, completedBy: [occurrence('other')] } }),
    ],
    ['an added placement', withPage({ ...page(2), placements: [] })],
  ])('reddens the rank whose %s moved, and only that rank', (_name, moved) => {
    expect(certificateOf(moved, 2)).not.toBe(certificateOf(PAGINATION, 2));
    expect(certificateOf(moved, 1)).toBe(certificateOf(PAGINATION, 1));
    expect(certificateOf(moved, 3)).toBe(certificateOf(PAGINATION, 3));
  });

  it('reddens both ranks a moved notice names, and neither of the others', () => {
    const moved: PaginationResult = {
      ...PAGINATION,
      notices: [{ ...notice, pages: [2, 3, 1] }],
    };
    expect(certificateOf(moved, 1)).not.toBe(certificateOf(PAGINATION, 1));
    expect(certificateOf(moved, 2)).not.toBe(certificateOf(PAGINATION, 2));
    expect(noticesCertificateOf(moved)).not.toBe(noticesCertificateOf(PAGINATION));
  });

  it('digests the sheet and the whole notice list on their own', () => {
    const other: PaginationResult = { ...PAGINATION, sheet: { width: 216, height: 279 } };
    expect(sheetCertificateOf(other)).not.toBe(sheetCertificateOf(PAGINATION));
    expect(noticesCertificateOf(other)).toBe(noticesCertificateOf(PAGINATION));
    expect(sheetCertificateOf(PAGINATION)).toBe('{"height":297,"width":210}');
  });

  it('writes the same certificate whatever order the fields were built in', () => {
    const reversed: PaginationResult = {
      notices: PAGINATION.notices,
      pages: PAGINATION.pages,
      html: PAGINATION.html,
      sheet: { height: 297, width: 210 },
    };
    expect(sheetCertificateOf(reversed)).toBe(sheetCertificateOf(PAGINATION));
    expect(certificateOf(reversed, 1)).toBe(certificateOf(PAGINATION, 1));
  });
});
