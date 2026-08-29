import type { EvaluationScope, Template } from '@openview/core';
import { describe, expect, it } from 'vitest';
import { reachableOccurrences } from '../document/bands.js';
import { documentImages, resolvedImageTable } from '../document/images.js';
import { extendBands, materializeDocument } from '../document/materialize.js';
import { DocumentRenderError } from '../errors.js';
import { buildPagedTree } from '../html/build-page.js';
import { serializeHtml } from '../html/serialize.js';
import { DEFAULT_RENDER_SAFETY_LIMITS, type RenderSafetyLimits } from '../limits/types.js';
import {
  gridPage,
  literalText,
  materializedOf,
  NO_FONTS,
  NO_IMAGES,
  paginateOnGrid,
  refusalOfCut,
  sameImages,
  TINY_PNG,
  templateOf,
} from './fixtures.js';

const flow = (children: readonly Record<string, unknown>[]): Record<string, unknown> => ({
  root: { type: 'container', id: 'root', children },
});

const rows = (count: number): EvaluationScope => ({
  ledger: { lines: Array.from({ length: count }, (_, at) => ({ label: `l${at}` })) },
});

/** A loop whose body is a single literal text: cheap to evaluate, and one occurrence per item. */
const staticLoop = (): Record<string, unknown> =>
  flow([
    {
      type: 'loop',
      id: 'each-line',
      each: { kind: 'path', path: 'ledger.lines' },
      as: 'line',
      children: [literalText('line', 'x')],
    },
  ]);

const limits = (overrides: Partial<RenderSafetyLimits>): RenderSafetyLimits => ({
  ...DEFAULT_RENDER_SAFETY_LIMITS,
  ...overrides,
});

const refusalOf = (run: () => unknown): DocumentRenderError => {
  try {
    run();
  } catch (error) {
    if (error instanceof DocumentRenderError) {
      return error;
    }
    throw error;
  }
  throw new Error('the document was built');
};

describe('the objects a document may materialise', () => {
  it('lets a loop whose occurrences fit the ceiling through', () => {
    const document = materializedOf(staticLoop(), rows(4), limits({ maxMaterializedUnits: 200 }));
    expect(document.root).toHaveLength(1);
  });

  it('refuses a static loop that expands past the ceiling, cheap as it is to evaluate', () => {
    /* The gap the evaluation budget cannot close: a thousand items cost a handful of steps and a
       thousand persistent blocks. */
    const refused = refusalOf(() =>
      materializedOf(staticLoop(), rows(1_000), limits({ maxMaterializedUnits: 50 })),
    );
    expect(refused.code).toBe('materialization-limit-exceeded');
    expect(refused.details.limit).toBe(50);
    expect(refused.details.nodeId).toBe('line');
  });

  it('counts a run of text as its own object, not only the block that holds it', () => {
    const twoRuns = flow([
      {
        type: 'text',
        id: 'title',
        content: [
          { kind: 'literal', text: 'a' },
          { kind: 'literal', text: 'b' },
        ],
      },
    ]);
    /* Root container, text block, two runs: four. Three is one short. */
    expect(() => materializedOf(twoRuns, {}, limits({ maxMaterializedUnits: 4 }))).not.toThrow();
    expect(
      refusalOf(() => materializedOf(twoRuns, {}, limits({ maxMaterializedUnits: 3 }))).code,
    ).toBe('materialization-limit-exceeded');
  });

  it('counts every cell of every row, not only the table', () => {
    const table = flow([
      {
        type: 'table',
        id: 'grid',
        columns: [
          { id: 'a', width: 1, align: 'start' },
          { id: 'b', width: 1, align: 'start' },
        ],
        header: [],
        body: [
          {
            type: 'tableRowGroup',
            id: 'group',
            each: { kind: 'path', path: 'ledger.lines' },
            as: 'line',
            rows: [{ type: 'tableRow', id: 'line', cells: [] }],
          },
        ],
        footer: [],
      },
    ]);
    /* Two cells per row are materialised even when the row declares neither of them, and a budget
       that only counted rows would let a wide table through. */
    const refused = refusalOf(() =>
      materializedOf(table, rows(20), limits({ maxMaterializedUnits: 30 })),
    );
    expect(refused.code).toBe('materialization-limit-exceeded');
  });

  const banded = (): Template =>
    templateOf({
      ...staticLoop(),
      page: {
        ...templateOf().page,
        header: [
          {
            on: 'firstOnly',
            content: {
              type: 'container',
              id: 'first-band',
              children: [literalText('first-line', 'first')],
            },
          },
          {
            /* Only a run of several pages ever reaches this one, which is what makes the second
               materialisation pass exist at all. */
            on: 'exceptFirst',
            content: {
              type: 'container',
              id: 'later-band',
              children: [literalText('later-line', 'later')],
            },
          },
        ],
      },
    });

  const boundWith = (ceiling: number) =>
    materializeDocument(
      banded(),
      rows(6),
      reachableOccurrences(1),
      undefined,
      undefined,
      limits({ maxMaterializedUnits: ceiling }),
    );

  it('shares one budget between the first pass and the bands a second page reaches', () => {
    const bound = boundWith(300);
    const spentOnce = bound.units.spent;
    expect(spentOnce).toBeGreaterThan(0);
    const widened = extendBands(banded(), rows(6), bound, reachableOccurrences(2));
    /* The same instance, not a copy of its ceiling: the second pass keeps spending the budget the
       first one started. */
    expect(widened.units).toBe(bound.units);
    expect(widened.units.spent).toBeGreaterThan(spentOnce);
  });

  it('refuses in the second pass what the first one left just enough room for', () => {
    const bound = boundWith(300);
    const room = bound.units.spent;
    /* A budget reset between the passes would let this document reach twice its ceiling; here the
       extension crosses a ceiling the first pass had left open. */
    const tight = boundWith(room + 1);
    const refused = refusalOf(() => extendBands(banded(), rows(6), tight, reachableOccurrences(2)));
    expect(refused.code).toBe('materialization-limit-exceeded');
    expect(refused.details.limit).toBe(room + 1);
  });
});

describe('the pages a document may be cut into', () => {
  /* One grid line per sheet, so each block of the flow lands on a page of its own. */
  const oneBlockPerPage = (count: number): Record<string, unknown> => ({
    page: gridPage(1),
    ...flow(Array.from({ length: count }, (_, at) => literalText(`t${at}`, `line`))),
  });

  it('cuts a document that stops exactly on the ceiling', () => {
    const document = materializedOf(oneBlockPerPage(3), {});
    expect(paginateOnGrid(document, {}, undefined, 3).pages).toHaveLength(3);
  });

  it('refuses the page past the ceiling before composing any of its fragments', () => {
    const document = materializedOf(oneBlockPerPage(4), {});
    const refused = refusalOfCut(() => paginateOnGrid(document, {}, undefined, 3));
    expect(refused.code).toBe('page-limit-exceeded');
    expect(refused.details.limit).toBe(3);
    expect(refused.details.pageNumber).toBe(4);
    expect(refused.details.phase).toBe('pagination');
  });
});

describe('the html a render may serialise', () => {
  it('produces the same bytes it always did while it stays under the ceiling', () => {
    const document = materializedOf(long(), {});
    const tree = buildPagedTree(paginateOnGrid(document), NO_FONTS, sameImages(document));
    const generous = serializeHtml(tree, DEFAULT_RENDER_SAFETY_LIMITS.maxHtmlBytes);
    const exact = serializeHtml(tree, Buffer.byteLength(generous, 'utf8'));
    expect(exact).toBe(generous);
  });

  it('refuses a document one byte over the ceiling, and returns no markup at all', () => {
    const document = materializedOf(long(), {});
    const tree = buildPagedTree(paginateOnGrid(document), NO_FONTS, sameImages(document));
    const size = Buffer.byteLength(serializeHtml(tree, DEFAULT_RENDER_SAFETY_LIMITS.maxHtmlBytes));
    const refused = refusalOf(() => serializeHtml(tree, size - 1));
    expect(refused.code).toBe('html-limit-exceeded');
    expect(refused.details.limit).toBe(size - 1);
  });

  function long(): Record<string, unknown> {
    return flow([literalText('t', 'a document with some words in it')]);
  }
});

describe('the sources a session resolved', () => {
  const withImage = (): Record<string, unknown> =>
    flow([{ type: 'image', id: 'logo', src: TINY_PNG, alt: 'logo' }]);

  it('are what the markup prints, in place of the stored source', () => {
    const document = materializedOf(withImage(), {});
    const [image] = documentImages(document);
    expect(image).toBeDefined();
    const table = new Map([[image?.key ?? '', 'data:image/png;base64,AAAA']]);
    const html = serializeHtml(
      buildPagedTree(paginateOnGrid(document), NO_FONTS, table),
      DEFAULT_RENDER_SAFETY_LIMITS.maxHtmlBytes,
    );
    expect(html).toContain('src="data:image/png;base64,AAAA"');
    expect(html).not.toContain(TINY_PNG);
  });

  it('stop the render when an occurrence reaches the html unresolved', () => {
    const document = materializedOf(withImage(), {});
    const refused = refusalOf(() =>
      serializeHtml(
        buildPagedTree(paginateOnGrid(document), NO_FONTS, NO_IMAGES),
        DEFAULT_RENDER_SAFETY_LIMITS.maxHtmlBytes,
      ),
    );
    expect(refused.code).toBe('resource-policy-refused');
    expect(refused.details.nodeId).toBe('logo');
  });
});

describe('the table a backend answers with', () => {
  const asked = [
    { key: 'o1', nodeId: 'a', path: [], src: 'one' },
    { key: 'o2', nodeId: 'b', path: [], src: 'two' },
  ];

  it('is accepted whole when every occurrence is answered once', () => {
    expect(
      resolvedImageTable(asked, [
        { key: 'o1', src: 'x' },
        { key: 'o2', src: 'y' },
      ]),
    ).toStrictEqual(
      new Map([
        ['o1', 'x'],
        ['o2', 'y'],
      ]),
    );
  });

  it('is refused when an occurrence is left out', () => {
    const refused = refusalOf(() => resolvedImageTable(asked, [{ key: 'o1', src: 'x' }]));
    expect(refused.code).toBe('resource-policy-refused');
    expect(refused.details.nodeId).toBe('b');
  });

  it('is refused when it names an occurrence this document does not hold', () => {
    expect(
      refusalOf(() =>
        resolvedImageTable(asked, [
          { key: 'o1', src: 'x' },
          { key: 'o2', src: 'y' },
          { key: 'o9', src: 'z' },
        ]),
      ).code,
    ).toBe('resource-policy-refused');
  });

  it('is refused when it answers one occurrence twice', () => {
    expect(
      refusalOf(() =>
        resolvedImageTable(asked, [
          { key: 'o1', src: 'x' },
          { key: 'o1', src: 'y' },
          { key: 'o2', src: 'z' },
        ]),
      ).code,
    ).toBe('resource-policy-refused');
  });
});
