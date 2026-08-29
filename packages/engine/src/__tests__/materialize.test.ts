import {
  createBudget,
  type EvaluationScope,
  printableAreaOf,
  STANDARD_SHEETS_MM,
  type TableColumn,
} from '@openview/core';
import { describe, expect, it } from 'vitest';
import { bandForRole, reachableOccurrences } from '../document/bands.js';
import {
  createKeySource,
  materializeBodyEntry,
  materializeDocument,
  materializeNode,
} from '../document/materialize.js';
import { createPresentationSession } from '../document/presentation.js';
import { printableText } from '../document/printable.js';
import type { MaterialBlock, MaterialTable, MaterialText } from '../document/types.js';
import { DEFAULT_TYPOGRAPHY, resolveRunTypography } from '../document/typography.js';
import { DocumentRenderError } from '../errors.js';
import { createMaterializationBudget } from '../limits/materialization.js';
import { materializedOf, SAMPLE_DATA, TINY_PNG, templateOf } from './fixtures.js';

const flow = (children: readonly Record<string, unknown>[]): Record<string, unknown> => ({
  root: { type: 'container', id: 'root', children },
});

/** The band domains a one-page document reaches, which is where binding always starts. */
const ONE_PAGE = reachableOccurrences(1);

/** Stands in for a band a test expects to exist, so a missing one fails on the text it printed. */
const PLACEHOLDER: MaterialBlock = {
  kind: 'text',
  key: 'absent',
  nodeId: 'absent',
  nodeType: 'text',
  declarationPath: [],
  iterations: [],
  box: undefined,
  keepTogether: false,
  align: 'start',
  runs: [],
};

/** The single materialised root container, which is what the root region always holds. */
function rootBlocks(overrides: Record<string, unknown>, data: EvaluationScope = SAMPLE_DATA) {
  const [container] = materializedOf(overrides, data).root;
  if (container?.kind !== 'container') {
    throw new Error('the root region is not a container');
  }
  return container.children;
}

function textAt(blocks: readonly MaterialBlock[], index: number): MaterialText {
  const block = blocks[index];
  if (block?.kind !== 'text') {
    throw new Error(`block ${index} is not a text block`);
  }
  return block;
}

function refusalFrom(run: () => unknown): DocumentRenderError {
  try {
    run();
  } catch (error) {
    if (error instanceof DocumentRenderError) {
      return error;
    }
    throw error;
  }
  throw new Error('the document was accepted');
}

/** What a text block would print, with a marker written as the field it names. */
const joined = (block: MaterialText): string =>
  block.runs.map((run) => (run.kind === 'text' ? run.text : `<${run.field}>`)).join('');

describe('materialised document', () => {
  it('carries the declared sheet, margins and the printable area of core', () => {
    /* Decimal AND asymmetric on both axes, so a locally rewritten formula cannot agree by
       accident: with equal margins, `width - (left + right)` and `width - left * 2` are the same
       number and the assertion would prove nothing. */
    const page = {
      sheet: { ...STANDARD_SHEETS_MM.letter },
      margins: { top: 12.7, right: 19.05, bottom: 25.4, left: 12.7 },
      header: [],
      footer: [],
    };
    const document = materializedOf({ page }, {});
    expect(document.sheet).toStrictEqual(page.sheet);
    expect(document.margins).toStrictEqual(page.margins);
    expect(document.printable).toStrictEqual(printableAreaOf(page));
  });

  it('keeps the root container so its own box still paints', () => {
    const document = materializedOf(
      { root: { type: 'container', id: 'root', box: { background: '#ffffff' }, children: [] } },
      {},
    );
    expect(document.root).toHaveLength(1);
    expect(document.root[0]?.box).toStrictEqual({ background: '#ffffff' });
  });
});

describe('single-page bands', () => {
  const band = (on: string, id: string) => ({
    on,
    content: {
      type: 'container',
      id,
      children: [{ type: 'text', id: `${id}-t`, content: [{ kind: 'literal', text: id }] }],
    },
  });

  it.each([
    ['every', true],
    ['firstOnly', true],
    ['lastOnly', true],
  ])('binds %s for the only page', (on, applies) => {
    const document = materializedOf(
      {
        page: {
          sheet: { ...STANDARD_SHEETS_MM.a4 },
          margins: { top: 10, right: 10, bottom: 10, left: 10 },
          header: [band(on, 'head')],
          footer: [],
        },
      },
      {},
    );
    expect(document.headerBands.length > 0).toBe(applies);
  });

  it.each([['exceptFirst'], ['exceptLast']])('leaves %s unbound for the only page', (on) => {
    const document = materializedOf(
      {
        page: {
          sheet: { ...STANDARD_SHEETS_MM.a4 },
          margins: { top: 10, right: 10, bottom: 10, left: 10 },
          header: [],
          footer: [band(on, 'foot')],
        },
      },
      {},
    );
    expect(document.footerBands).toStrictEqual([]);
  });

  it('selects nothing from an empty side', () => {
    expect(bandForRole([], 'only')).toBeUndefined();
  });

  it('keeps both page markers unresolved, in every region', () => {
    const markers = [
      { kind: 'literal', text: 'p ' },
      { kind: 'pageField', field: 'number' },
      { kind: 'literal', text: '/' },
      { kind: 'pageField', field: 'count' },
    ];
    const document = materializedOf(
      {
        page: {
          sheet: { ...STANDARD_SHEETS_MM.a4 },
          margins: { top: 10, right: 10, bottom: 10, left: 10 },
          header: [
            {
              on: 'every',
              content: {
                type: 'container',
                id: 'h',
                children: [{ type: 'text', id: 'ht', content: markers }],
              },
            },
          ],
          footer: [
            {
              on: 'lastOnly',
              content: {
                type: 'container',
                id: 'f',
                children: [{ type: 'text', id: 'ft', content: markers }],
              },
            },
          ],
        },
        ...flow([{ type: 'text', id: 'rt', content: markers }]),
      },
      {},
    );
    const regionText = (blocks: readonly MaterialBlock[]) => {
      const [container] = blocks;
      if (container?.kind !== 'container') {
        throw new Error('not a container');
      }
      return joined(textAt(container.children, 0));
    };
    /* No digit anywhere: which page holds a marker is not known before the cuts exist. */
    expect(regionText([document.headerBands[0]?.content ?? PLACEHOLDER])).toBe(
      'p <number>/<count>',
    );
    expect(regionText(document.root)).toBe('p <number>/<count>');
    expect(regionText([document.footerBands[0]?.content ?? PLACEHOLDER])).toBe(
      'p <number>/<count>',
    );
  });
});

describe('one budget for the whole document', () => {
  const binding = (id: string) => ({
    type: 'text',
    id,
    content: [{ kind: 'binding', value: { kind: 'path', path: 'sample.label' } }],
  });

  it('spends the same allowance across the header, the flow and the footer', () => {
    const page = {
      sheet: { ...STANDARD_SHEETS_MM.a4 },
      margins: { top: 10, right: 10, bottom: 10, left: 10 },
      header: [{ on: 'every', content: { type: 'container', id: 'h', children: [binding('hb')] } }],
      footer: [
        { on: 'lastOnly', content: { type: 'container', id: 'f', children: [binding('fb')] } },
      ],
    };
    const overrides = { page, ...flow([binding('rb')]) };
    /* Three bindings, one step each: two are affordable and the third is not. */
    expect(() =>
      materializeDocument(templateOf(overrides), SAMPLE_DATA, ONE_PAGE, { maxSteps: 3 }),
    ).not.toThrow();
    const refused = refusalFrom(() =>
      materializeDocument(templateOf(overrides), SAMPLE_DATA, ONE_PAGE, { maxSteps: 2 }),
    );
    expect(refused.code).toBe('expression-refused');
    expect(refused.details.region).toBe('footer');
  });
});

describe('the printing policy of a visible binding', () => {
  const bound = (path: string) =>
    flow([
      { type: 'text', id: 'b', content: [{ kind: 'binding', value: { kind: 'path', path } }] },
    ]);

  it('prints text as itself', () => {
    expect(joined(textAt(rootBlocks(bound('sample.label')), 0))).toBe('acme');
  });

  it('prints a finite number in its canonical form, with no locale and no rounding', () => {
    const blocks = rootBlocks(
      flow([
        {
          type: 'text',
          id: 'n',
          content: [
            {
              kind: 'binding',
              value: {
                kind: 'arithmetic',
                op: 'div',
                left: { kind: 'literal', value: 1 },
                right: { kind: 'literal', value: 3 },
              },
            },
          ],
        },
      ]),
    );
    expect(joined(textAt(blocks, 0))).toBe('0.3333333333333333');
  });

  it.each([
    ['absent', undefined],
    ['null', null],
  ])('refuses %s with missing-binding-value', (_label, value) => {
    const refused = refusalFrom(() => printableText(value, { nodeId: 'b' }));
    expect(refused.code).toBe('missing-binding-value');
    expect(refused.details.nodeId).toBe('b');
  });

  it.each([
    ['a boolean', true],
    ['a non-finite number', Number.POSITIVE_INFINITY],
    ['a not-a-number', Number.NaN],
    ['a list', [1, 2]],
    ['an object', { total: 1200 }],
    ['a function', () => 1200],
    ['a symbol', Symbol('1200')],
    ['a bigint', 12n],
  ])('refuses %s with non-printable-binding-value', (_label, value) => {
    const refused = refusalFrom(() => printableText(value, { nodeId: 'b' }));
    expect(refused.code).toBe('non-printable-binding-value');
    expect(refused.details.actualType).toBeDefined();
    expect(refused.message).not.toContain('1200');
    expect(JSON.stringify(refused.details)).not.toContain('1200');
  });

  it('points at the exact segment that failed', () => {
    const refused = refusalFrom(() =>
      materializedOf(
        flow([
          {
            type: 'text',
            id: 'mixed',
            content: [
              { kind: 'literal', text: 'ok ' },
              { kind: 'binding', value: { kind: 'path', path: 'sample.label' } },
              { kind: 'binding', value: { kind: 'path', path: 'sample.missingField' } },
            ],
          },
        ]),
        SAMPLE_DATA,
      ),
    );
    expect(refused.details.nodeId).toBe('mixed');
    expect(refused.details.path).toStrictEqual(['root', 'children', 0, 'content', 2]);
    expect(refused.details.region).toBe('root');
  });

  it('keeps segments in order with no separator invented', () => {
    const blocks = rootBlocks(
      flow([
        {
          type: 'text',
          id: 'mix',
          content: [
            { kind: 'literal', text: 'a' },
            { kind: 'binding', value: { kind: 'path', path: 'sample.label' } },
            { kind: 'pageField', field: 'number' },
            { kind: 'literal', text: 'z' },
          ],
        },
      ]),
    );
    expect(joined(textAt(blocks, 0))).toBe('aacme<number>z');
  });
});

describe('typography and alignment', () => {
  it('fills every absent property with the engine defaults', () => {
    expect(resolveRunTypography(undefined, undefined)).toStrictEqual(DEFAULT_TYPOGRAPHY);
    expect(DEFAULT_TYPOGRAPHY).toStrictEqual({
      /* An embedded family, never a css generic: `sans-serif` would select whatever the machine
         has installed, which is the machine speaking rather than the template. */
      face: {
        family: 'noto-sans-2.015',
        cssFamily: '__openview_noto_sans_2_015',
        weight: 400,
        style: 'normal',
      },
      sizePt: 10,
      color: '#000000',
    });
  });

  it('gives a run precedence over its block, and the block over the default', () => {
    const resolved = resolveRunTypography({ bold: true }, { family: 'Noto Serif', bold: false });
    expect(resolved.face).toStrictEqual({
      family: 'noto-serif-2.015',
      cssFamily: '__openview_noto_serif_2_015',
      weight: 700,
      style: 'normal',
    });
    expect(resolved.sizePt).toBe(DEFAULT_TYPOGRAPHY.sizePt);
  });

  it('refuses a family the build does not embed, naming the site and not the name', () => {
    let refused: DocumentRenderError | undefined;
    try {
      resolveRunTypography(undefined, { family: 'Georgia' }, { nodeId: 'title', region: 'root' });
    } catch (error: unknown) {
      refused = error instanceof DocumentRenderError ? error : undefined;
    }
    expect(refused?.code).toBe('unsupported-font-family');
    expect(refused?.details).toStrictEqual({ nodeId: 'title', region: 'root' });
    expect(refused?.message).not.toContain('Georgia');
  });

  it('resolves each run of a block separately', () => {
    const blocks = rootBlocks(
      flow([
        {
          type: 'text',
          id: 'runs',
          typography: { family: 'Noto Serif', sizePt: 9 },
          content: [
            { kind: 'literal', text: 'plain' },
            { kind: 'literal', text: 'loud', typography: { bold: true, color: '#8c3a1b' } },
          ],
        },
      ]),
    );
    const block = textAt(blocks, 0);
    expect(block.runs[0]?.typography).toStrictEqual({
      face: {
        family: 'noto-serif-2.015',
        cssFamily: '__openview_noto_serif_2_015',
        weight: 400,
        style: 'normal',
      },
      sizePt: 9,
      color: '#000000',
    });
    expect(block.runs[1]?.typography.face.weight).toBe(700);
    expect(block.runs[1]?.typography.color).toBe('#8c3a1b');
    expect(block.runs[1]?.typography.face.family).toBe('noto-serif-2.015');
  });

  it('defaults alignment to start, and lets a block override its column', () => {
    const columns: readonly TableColumn[] = [{ id: 'c', width: 1, align: 'end' }];
    const table = {
      type: 'table',
      id: 't',
      columns,
      header: [],
      body: [
        {
          type: 'tableRow',
          id: 'r',
          cells: [
            {
              columnId: 'c',
              children: [
                { type: 'text', id: 'inherits', content: [{ kind: 'literal', text: 'x' }] },
                {
                  type: 'text',
                  id: 'overrides',
                  align: 'justify',
                  content: [{ kind: 'literal', text: 'y' }],
                },
              ],
            },
          ],
        },
      ],
      footer: [],
    };
    const blocks = rootBlocks(flow([{ type: 'text', id: 'bare', content: [] }, table]));
    expect(textAt(blocks, 0).align).toBe('start');
    const materialised = blocks[1];
    if (materialised?.kind !== 'table') {
      throw new Error('not a table');
    }
    const cellChildren = materialised.body[0]?.cells[0]?.children ?? [];
    expect(textAt(cellChildren, 0).align).toBe('end');
    expect(textAt(cellChildren, 1).align).toBe('justify');
  });
});

describe('loops, conditions and images', () => {
  it('replaces a loop with its ordered occurrences in a child scope', () => {
    const blocks = rootBlocks(
      flow([
        {
          type: 'loop',
          id: 'each-line',
          each: { kind: 'path', path: 'sample.items' },
          as: 'line',
          children: [
            {
              type: 'text',
              id: 'sku',
              content: [{ kind: 'binding', value: { kind: 'path', path: 'line.sku' } }],
            },
          ],
        },
      ]),
    );
    expect(blocks.map((block) => joined(textAt([block], 0)))).toStrictEqual(['A-1', 'B-2']);
    /* The declaration path holds no rank of its own; the rank travels in the ancestry beside it. */
    expect(blocks[1]?.declarationPath).toStrictEqual(['root', 'children', 0, 'children', 0]);
    expect(blocks[1]?.iterations).toStrictEqual([
      { declarationPath: ['root', 'children', 0], index: 1 },
    ]);
    expect(blocks[1]?.nodeType).toBe('text');
  });

  it('produces no occurrence for an absent sequence', () => {
    expect(
      rootBlocks(
        flow([
          {
            type: 'loop',
            id: 'nothing',
            each: { kind: 'path', path: 'sample.missingItems' },
            as: 'line',
            children: [{ type: 'text', id: 't', content: [{ kind: 'literal', text: 'x' }] }],
          },
        ]),
      ),
    ).toStrictEqual([]);
  });

  it('keeps the right scope through nested loops', () => {
    const blocks = rootBlocks(
      flow([
        {
          type: 'loop',
          id: 'outer',
          each: { kind: 'path', path: 'sample.items' },
          as: 'line',
          children: [
            {
              type: 'loop',
              id: 'inner',
              each: { kind: 'path', path: 'sample.items' },
              as: 'other',
              children: [
                {
                  type: 'text',
                  id: 'pair',
                  content: [
                    { kind: 'binding', value: { kind: 'path', path: 'line.sku' } },
                    { kind: 'literal', text: '-' },
                    { kind: 'binding', value: { kind: 'path', path: 'other.sku' } },
                  ],
                },
              ],
            },
          ],
        },
      ]),
    );
    expect(blocks.map((block) => joined(textAt([block], 0)))).toStrictEqual([
      'A-1-A-1',
      'A-1-B-2',
      'B-2-A-1',
      'B-2-B-2',
    ]);
  });

  it('drops the children of a false condition and of an absent one', () => {
    const condition = (id: string, path: string) => ({
      type: 'condition',
      id,
      when: { kind: 'path', path },
      children: [{ type: 'text', id: `${id}-t`, content: [{ kind: 'literal', text: id }] }],
    });
    expect(
      rootBlocks(flow([condition('absent', 'sample.unknownFlag')])).map((block) => block.nodeId),
    ).toStrictEqual([]);
  });

  it('keeps the children of a true condition', () => {
    const blocks = rootBlocks(
      flow([
        {
          type: 'condition',
          id: 'holds',
          when: {
            kind: 'compare',
            op: 'eq',
            left: { kind: 'path', path: 'sample.label' },
            right: { kind: 'literal', value: 'acme' },
          },
          children: [{ type: 'text', id: 'inner', content: [{ kind: 'literal', text: 'yes' }] }],
        },
      ]),
    );
    expect(blocks.map((block) => block.nodeId)).toStrictEqual(['inner']);
  });

  it('keeps an image source, its alternative text and its declaration id', () => {
    const blocks = rootBlocks(
      flow([
        {
          type: 'image',
          id: 'logo',
          src: TINY_PNG,
          alt: 'a logo',
          box: { padding: { top: 1, right: 1, bottom: 1, left: 1 } },
        },
      ]),
    );
    const image = blocks[0];
    if (image?.kind !== 'image') {
      throw new Error('not an image');
    }
    expect(image.src).toBe(TINY_PNG);
    expect(image.alt).toBe('a logo');
    expect(image.nodeId).toBe('logo');
  });

  it('carries keepTogether without changing a single-page outcome', () => {
    const blocks = rootBlocks(
      flow([
        { type: 'text', id: 'kept', keepTogether: true, content: [{ kind: 'literal', text: 'x' }] },
        { type: 'text', id: 'free', content: [{ kind: 'literal', text: 'y' }] },
      ]),
    );
    expect(blocks.map((block) => block.keepTogether)).toStrictEqual([true, false]);
  });
});

describe('tables', () => {
  const columns = [
    { id: 'sku', width: 6, align: 'start' },
    { id: 'qty', width: 2, align: 'end' },
    { id: 'note', width: 4, align: 'start' },
  ];

  const cell = (columnId: string, id: string, path: string) => ({
    columnId,
    children: [{ type: 'text', id, content: [{ kind: 'binding', value: { kind: 'path', path } }] }],
  });

  const table = {
    type: 'table',
    id: 'lines',
    columns,
    header: [
      {
        type: 'tableRow',
        id: 'head',
        cells: [
          {
            columnId: 'sku',
            children: [{ type: 'text', id: 'h-sku', content: [{ kind: 'literal', text: 'Ref' }] }],
          },
          {
            columnId: 'qty',
            children: [{ type: 'text', id: 'h-qty', content: [{ kind: 'literal', text: 'Qty' }] }],
          },
          {
            columnId: 'note',
            children: [
              { type: 'text', id: 'h-note', content: [{ kind: 'literal', text: 'Note' }] },
            ],
          },
        ],
      },
    ],
    body: [
      {
        type: 'tableRowGroup',
        id: 'group',
        each: { kind: 'path', path: 'sample.items' },
        as: 'line',
        rows: [
          {
            type: 'tableRow',
            id: 'line',
            /* Declared out of column order, and short: `note` names no cell. */
            cells: [cell('qty', 'd-qty', 'line.count'), cell('sku', 'd-sku', 'line.sku')],
          },
        ],
      },
    ],
    footer: [
      {
        type: 'tableRow',
        id: 'total',
        cells: [
          {
            columnId: 'sku',
            children: [
              { type: 'text', id: 'f-label', content: [{ kind: 'literal', text: 'Total' }] },
            ],
          },
        ],
      },
    ],
  };

  function materialisedTable(): MaterialTable {
    const blocks = rootBlocks(flow([table]));
    const found = blocks[0];
    if (found?.kind !== 'table') {
      throw new Error('not a table');
    }
    return found;
  }

  it('repeats a row group once per item and keeps the three sections in order', () => {
    const found = materialisedTable();
    expect(found.header).toHaveLength(1);
    expect(found.body).toHaveLength(2);
    expect(found.footer).toHaveLength(1);
    expect(found.columns).toStrictEqual(columns);
  });

  it('gives every row one cell per column, in column order', () => {
    for (const row of materialisedTable().body) {
      expect(row.cells.map((entry) => entry.columnId)).toStrictEqual(['sku', 'qty', 'note']);
    }
  });

  it('finds a cell by its column id and not by its position', () => {
    const [first] = materialisedTable().body;
    expect(joined(textAt(first?.cells[0]?.children ?? [], 0))).toBe('A-1');
    expect(joined(textAt(first?.cells[1]?.children ?? [], 0))).toBe('2');
  });

  it('leaves an unfilled column empty rather than inventing filler', () => {
    const [first] = materialisedTable().body;
    expect(first?.cells[2]?.children).toStrictEqual([]);
    expect(
      materialisedTable().footer[0]?.cells.map((entry) => entry.children.length),
    ).toStrictEqual([1, 0, 0]);
  });

  it('materialises a nested block inside a cell', () => {
    const blocks = rootBlocks(
      flow([
        {
          type: 'table',
          id: 'nested',
          columns: [{ id: 'c', width: 1, align: 'start' }],
          header: [],
          body: [
            {
              type: 'tableRow',
              id: 'r',
              cells: [
                {
                  columnId: 'c',
                  children: [
                    {
                      type: 'container',
                      id: 'box',
                      children: [
                        {
                          type: 'condition',
                          id: 'when',
                          when: { kind: 'literal', value: true },
                          children: [
                            {
                              type: 'text',
                              id: 'deep',
                              content: [{ kind: 'literal', text: 'in' }],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
          footer: [],
        },
      ]),
    );
    const found = blocks[0];
    if (found?.kind !== 'table') {
      throw new Error('not a table');
    }
    const container = found.body[0]?.cells[0]?.children[0];
    if (container?.kind !== 'container') {
      throw new Error('not a container');
    }
    expect(joined(textAt(container.children, 0))).toBe('in');
  });

  it('does not mutate the declared template or its column array', () => {
    const template = templateOf(flow([table]));
    const before = structuredClone(template);
    materializeDocument(template, SAMPLE_DATA, ONE_PAGE);
    expect(template).toStrictEqual(before);
  });
});

describe('exhaustive traversal', () => {
  const context = {
    scope: {},
    budget: createBudget(),
    units: createMaterializationBudget(10_000),
    keys: createKeySource(),
    presentations: createPresentationSession(undefined, undefined),
    region: 'root' as const,
    column: undefined,
    declarationPath: [] as readonly (string | number)[],
    iterations: [],
  };

  it('refuses a row that reached the block flow', () => {
    const refused = refusalFrom(() =>
      materializeNode({ type: 'tableRow', id: 'stray', cells: [] }, context),
    );
    expect(refused.code).toBe('template-refused');
    expect(refused.details.nodeId).toBe('stray');
  });

  it('refuses a row group that reached the block flow', () => {
    const refused = refusalFrom(() =>
      materializeNode(
        {
          type: 'tableRowGroup',
          id: 'stray-group',
          each: { kind: 'path', path: 'nothing' },
          as: 'x',
          rows: [],
        },
        context,
      ),
    );
    expect(refused.code).toBe('template-refused');
  });

  it('refuses a block that reached the body of a table', () => {
    const refused = refusalFrom(() =>
      materializeBodyEntry({ type: 'text', id: 'stray-text', content: [] }, [], context),
    );
    expect(refused.code).toBe('template-refused');
    expect(refused.details.nodeId).toBe('stray-text');
  });
});
