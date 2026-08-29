import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import puppeteer from 'puppeteer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DocumentationInput } from '../../../../tools/docs/check.d.mts';
import { checkDocumentation, filesOf, LANGUAGES } from '../../../../tools/docs/check.mjs';
import { renderFirstInvoice } from './documentation/example.js';
import { HOST_LAUNCH_OPTIONS } from './fixtures.js';

/** Room for Chromium to launch and lay the example out on a loaded machine. */
const CHROMIUM_TIMEOUT_MS = 120_000;

const TEMPLATE = fileURLToPath(
  new URL('../../../../docs/engine/examples/invoice.template.json', import.meta.url),
);

const HOST_ARGS = HOST_LAUNCH_OPTIONS.args;

/**
 * Lends the example the launch arguments this host needs, without writing them into the example.
 *
 * A published snippet must not teach `--no-sandbox`: dropping the sandbox is a decision only a
 * caller running without one can take, so the adaptation belongs to the test. The rebuilt options
 * are the ones the adapter itself sends, plus the arguments of the host.
 */
function launchAsHostCan(): void {
  const launch = puppeteer.launch.bind(puppeteer);
  vi.spyOn(puppeteer, 'launch').mockImplementation(
    async () =>
      await launch({
        headless: true,
        ...(HOST_ARGS === undefined ? {} : { args: [...HOST_ARGS] }),
      }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

it(
  'renders the published example into a real one-page pdf',
  async () => {
    launchAsHostCan();
    const directory = await mkdtemp(join(tmpdir(), 'openview-docs-'));
    try {
      const output = join(directory, 'invoice.pdf');
      await renderFirstInvoice(TEMPLATE, output);
      const bytes = await readFile(output);
      expect(bytes.byteLength).toBeGreaterThan(0);
      expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      const pdf = await PDFDocument.load(bytes);
      expect(pdf.getPageCount()).toBe(1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  CHROMIUM_TIMEOUT_MS,
);

const SNIPPET = 'const answer = 1;';

/** A page carrying one instance of everything the gate knows how to read. */
const HEALTHY_PAGE = [
  '# Title',
  '',
  '<!-- docs-region: example.ts#demo -->',
  '',
  '```ts',
  SNIPPET,
  '```',
  '',
  '```bash',
  'node example.js',
  '```',
  '',
  '<!-- docs-api: @openview/engine createPdfRenderPort -->',
  '',
  'It says [what it does](./neighbour.md).',
  '',
  '<!-- docs-vocabulary: CODES -->',
  '',
  '- `alpha` — the first one.',
  '- `beta` — the second one.',
  '',
  '<!-- docs-defaults: LIMITS -->',
  '',
  '| Key | Value | Unit |',
  '| :-- | ----: | :--- |',
  '| `maxPages` | 100 | pages |',
  '',
  '<!-- docs-value: SCHEMA=11 -->',
  '',
  'The stored schema is at version 11.',
  '',
].join('\n');

/** A set of pages the gate accepts, which every fixture below breaks in exactly one way. */
function healthyInput(): DocumentationInput {
  const files = new Map<string, string>();
  for (const language of LANGUAGES) {
    for (const file of filesOf(language)) {
      files.set(file.path, HEALTHY_PAGE);
    }
  }
  return {
    files,
    regions: new Map([['example.ts#demo', SNIPPET]]),
    exports: new Map([['@openview/engine', ['createPdfRenderPort']]]),
    vocabularies: new Map([['CODES', ['alpha', 'beta']]]),
    defaults: new Map([['LIMITS', { maxPages: 100 }]]),
    values: new Map([['SCHEMA', 11]]),
    exists: (path: string): boolean => !path.endsWith('missing.md'),
  };
}

/** The same input with one page rewritten, which is how each fixture states its fault. */
function withPage(input: DocumentationInput, path: string, text: string): DocumentationInput {
  const files = new Map(input.files);
  files.set(path, text);
  return { ...input, files };
}

const FIRST_EN = filesOf('en')[0]?.path ?? '';
const FIRST_FR = filesOf('fr')[0]?.path ?? '';

describe('the documentation gate', () => {
  it('accepts a set of pages that respects every rule', () => {
    expect(checkDocumentation(healthyInput())).toStrictEqual([]);
  });

  const faults: readonly { readonly rule: string; readonly of: () => DocumentationInput }[] = [
    {
      rule: 'G1',
      of: (): DocumentationInput => {
        const input = healthyInput();
        const files = new Map(input.files);
        files.delete(FIRST_FR);
        return { ...input, files };
      },
    },
    {
      rule: 'G2',
      of: (): DocumentationInput =>
        withPage(healthyInput(), FIRST_FR, `${HEALTHY_PAGE}\n## One heading too many\n`),
    },
    {
      rule: 'G3',
      of: (): DocumentationInput =>
        withPage(
          healthyInput(),
          FIRST_FR,
          HEALTHY_PAGE.replace('node example.js', 'node other.js'),
        ),
    },
    {
      rule: 'G4',
      of: (): DocumentationInput => {
        const input = healthyInput();
        const drifted = HEALTHY_PAGE.replace(SNIPPET, 'const answer = 2;');
        return withPage(withPage(input, FIRST_EN, drifted), FIRST_FR, drifted);
      },
    },
    {
      rule: 'G5',
      of: (): DocumentationInput =>
        withPage(healthyInput(), FIRST_EN, `${HEALTHY_PAGE}${'x'.repeat(101)}\n`),
    },
    {
      rule: 'G6',
      of: (): DocumentationInput =>
        withPage(healthyInput(), FIRST_EN, `${HEALTHY_PAGE}A [dead link](./missing.md).\n`),
    },
    {
      rule: 'G7',
      of: (): DocumentationInput =>
        withPage(
          healthyInput(),
          FIRST_EN,
          HEALTHY_PAGE.replace('createPdfRenderPort -->', 'createPdfRenderPort createNothing -->'),
        ),
    },
    {
      rule: 'G8',
      of: (): DocumentationInput =>
        withPage(
          healthyInput(),
          FIRST_EN,
          HEALTHY_PAGE.replace('| 100 | pages |', '| 200 | pages |'),
        ),
    },
  ];

  it.each(faults)('refuses a $rule fault, and blames $rule alone', ({ rule, of }) => {
    const violations = checkDocumentation(of());
    expect(violations.length).toBeGreaterThan(0);
    expect([...new Set(violations.map((found) => found.rule))]).toStrictEqual([rule]);
  });
});
