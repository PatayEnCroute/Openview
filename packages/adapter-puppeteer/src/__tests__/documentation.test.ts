import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CURRENT_SCHEMA_VERSION, parseTemplate } from '@openview/core';
import {
  DEFAULT_RENDER_SAFETY_LIMITS,
  DOCUMENT_RENDER_ERROR_CODES,
  DOCUMENT_RENDER_PHASES,
} from '@openview/engine';
import { PDFDocument } from 'pdf-lib';
import puppeteer from 'puppeteer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DocumentationInput } from '../../../../tools/docs/check.d.mts';
import {
  checkDocumentation,
  exportedNamesOf,
  filesOf,
  LANGUAGES,
  regionsOf,
} from '../../../../tools/docs/check.mjs';
import { PROFILE_FIELDS } from '../../../../tools/reproducibility/profile.mjs';
import { BUNDLED_FACES, CATALOGUE_ORDER } from '../../../engine/dist/document/fonts/catalogue.js';
import { DEFAULT_RESOURCE_LIMITS } from '../resource/types.js';
import { RENDER_OUTCOMES } from '../runtime/audit.js';
import { DEFAULT_RUNTIME_LIMITS } from '../runtime/limits.js';
import { renderFirstInvoice } from './documentation/example.js';
import { INVOICE_DATA } from './documentation/invoice-data.js';
import { renderUntrusted } from './documentation/protected-example.js';
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

/** The example modules the pages quote, keyed by file name so an annotation stays readable. */
const EXAMPLE_MODULES = ['example.ts', 'invoice-data.ts', 'protected-example.ts'];

const REPOSITORY = fileURLToPath(new URL('../../../../', import.meta.url));

const read = async (path: string): Promise<string> =>
  await readFile(join(REPOSITORY, path), 'utf8');

/** The published documentation, and every source it is allowed to claim a fact from. */
async function publishedInput(): Promise<DocumentationInput> {
  const files = new Map<string, string>();
  for (const language of LANGUAGES) {
    for (const file of filesOf(language)) {
      /* A missing page is a G1 violation, not a crash: the rule has to be able to speak. */
      if (existsSync(join(REPOSITORY, file.path))) {
        files.set(file.path, await read(file.path));
      }
    }
  }
  const regions = new Map<string, string>();
  for (const module of EXAMPLE_MODULES) {
    const source = await read(`packages/adapter-puppeteer/src/__tests__/documentation/${module}`);
    for (const [name, text] of regionsOf(source)) {
      regions.set(`${module}#${name}`, text);
    }
  }
  return {
    files,
    regions,
    exports: new Map([
      ['@openview/core', exportedNamesOf(await read('packages/core/src/index.ts'))],
      ['@openview/engine', exportedNamesOf(await read('packages/engine/src/index.ts'))],
      [
        '@openview/adapter-puppeteer',
        exportedNamesOf(await read('packages/adapter-puppeteer/src/index.ts')),
      ],
    ]),
    vocabularies: new Map<string, readonly string[]>([
      ['DOCUMENT_RENDER_ERROR_CODES', DOCUMENT_RENDER_ERROR_CODES],
      ['DOCUMENT_RENDER_PHASES', DOCUMENT_RENDER_PHASES],
      ['RENDER_OUTCOMES', RENDER_OUTCOMES],
      ['PROFILE_FIELDS', PROFILE_FIELDS],
    ]),
    defaults: new Map<string, object>([
      ['DEFAULT_RENDER_SAFETY_LIMITS', DEFAULT_RENDER_SAFETY_LIMITS],
      ['DEFAULT_RUNTIME_LIMITS', DEFAULT_RUNTIME_LIMITS],
      ['DEFAULT_RESOURCE_LIMITS', DEFAULT_RESOURCE_LIMITS],
    ]),
    values: new Map<string, number | string>([
      ['CURRENT_SCHEMA_VERSION', CURRENT_SCHEMA_VERSION],
      ['FONT_FAMILIES', CATALOGUE_ORDER.length],
      ['FONT_FACES', BUNDLED_FACES.length],
    ]),
    exists: (path: string): boolean => existsSync(join(REPOSITORY, path)),
  };
}

it('publishes a documentation set that respects every rule', async () => {
  expect(checkDocumentation(await publishedInput())).toStrictEqual([]);
});

it(
  'renders the hardened example through a worker and a real browser',
  async () => {
    const stored: unknown = JSON.parse(await readFile(TEMPLATE, 'utf8'));
    const bytes = await renderUntrusted(
      {
        launch: HOST_LAUNCH_OPTIONS,
        engine: { presentationSelection: { amount: 'fr-eur' } },
      },
      { template: parseTemplate(stored), data: INVOICE_DATA },
    );
    expect(Buffer.from(bytes).subarray(0, 5).toString('latin1')).toBe('%PDF-');
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
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

  const faults: readonly {
    readonly rule: string;
    readonly fault: string;
    readonly of: () => DocumentationInput;
  }[] = [
    {
      rule: 'G1',
      fault: 'a page missing from one tree',
      of: (): DocumentationInput => {
        const input = healthyInput();
        const files = new Map(input.files);
        files.delete(FIRST_FR);
        return { ...input, files };
      },
    },
    {
      rule: 'G2',
      fault: 'a heading added on one side',
      of: (): DocumentationInput =>
        withPage(healthyInput(), FIRST_FR, `${HEALTHY_PAGE}\n## One heading too many\n`),
    },
    {
      rule: 'G3',
      fault: 'a code block edited in one language',
      of: (): DocumentationInput =>
        withPage(
          healthyInput(),
          FIRST_FR,
          HEALTHY_PAGE.replace('node example.js', 'node other.js'),
        ),
    },
    {
      rule: 'G4',
      fault: 'a snippet that drifted from its region',
      of: (): DocumentationInput => {
        const input = healthyInput();
        const drifted = HEALTHY_PAGE.replace(SNIPPET, 'const answer = 2;');
        return withPage(withPage(input, FIRST_EN, drifted), FIRST_FR, drifted);
      },
    },
    {
      rule: 'G5',
      fault: 'a line past the width',
      of: (): DocumentationInput =>
        withPage(healthyInput(), FIRST_EN, `${HEALTHY_PAGE}${'x'.repeat(101)}\n`),
    },
    {
      rule: 'G6',
      fault: 'a dead link',
      of: (): DocumentationInput =>
        withPage(healthyInput(), FIRST_EN, `${HEALTHY_PAGE}A [dead link](./missing.md).\n`),
    },
    {
      rule: 'G7',
      fault: 'an export the package does not have',
      of: (): DocumentationInput =>
        withPage(
          healthyInput(),
          FIRST_EN,
          HEALTHY_PAGE.replace('createPdfRenderPort -->', 'createPdfRenderPort createNothing -->'),
        ),
    },
    {
      rule: 'G8',
      fault: 'a default published wrong',
      of: (): DocumentationInput =>
        withPage(
          healthyInput(),
          FIRST_EN,
          HEALTHY_PAGE.replace('| 100 | pages |', '| 200 | pages |'),
        ),
    },
    {
      rule: 'G6',
      fault: 'a root-absolute link',
      of: (): DocumentationInput =>
        withPage(
          healthyInput(),
          FIRST_EN,
          `${HEALTHY_PAGE}A [root link](/AGENTS.md).
`,
        ),
    },
    {
      rule: 'G4',
      fault: 'a code fence nobody closed',
      of: (): DocumentationInput => {
        const input = healthyInput();
        const open = HEALTHY_PAGE.replace('node example.js\n```', 'node example.js');
        return withPage(withPage(input, FIRST_EN, open), FIRST_FR, open);
      },
    },
  ];

  it.each(faults)('refuses $fault, and blames $rule alone', ({ rule, of }) => {
    const violations = checkDocumentation(of());
    expect(violations.length).toBeGreaterThan(0);
    expect([...new Set(violations.map((found) => found.rule))]).toStrictEqual([rule]);
  });
});
