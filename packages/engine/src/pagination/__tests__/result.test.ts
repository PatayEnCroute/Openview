import { type PagePlacement, type PaginationResult, PaginationResultSchema } from '@openview/core';
import { describe, expect, it } from 'vitest';
import {
  gridPage,
  literalText,
  paginationOf,
  SAMPLE_DATA,
  TINY_PNG,
} from '../../__tests__/fixtures.js';

const flow = (children: readonly Record<string, unknown>[]): Record<string, unknown> => ({
  root: { type: 'container', id: 'root', children },
});

const COLUMNS = [
  { id: 'one', width: 1, align: 'start' },
  { id: 'two', width: 1, align: 'end' },
];

const cell = (columnId: string, id: string, text: string) => ({
  columnId,
  children: [literalText(id, text)],
});

const row = (id: string, text: string, extra: Record<string, unknown> = {}) => ({
  type: 'tableRow',
  id,
  ...extra,
  cells: [cell('one', `${id}-a`, text), cell('two', `${id}-b`, text)],
});

/** A table of `count` body rows, each one grid line tall in each of its two cells. */
const tableOf = (
  count: number,
  parts: { header?: readonly Record<string, unknown>[]; from?: number } = {},
): Record<string, unknown> => ({
  type: 'table',
  id: 'ledger',
  columns: COLUMNS,
  header: parts.header ?? [],
  body: Array.from({ length: count }, (_unused, index) => {
    const at = (parts.from ?? 0) + index;
    return row(`r${at}`, `body ${at}`);
  }),
  footer: [],
});

/** Every placement of the result, page by page, as readable tuples. */
const shapeOf = (result: PaginationResult): readonly (readonly string[])[] =>
  result.pages.map((page) =>
    page.placements.map(
      (placement) =>
        `${placement.occurrence.nodeId}:${placement.region}:${placement.role}:${placement.fragment}`,
    ),
  );

const idsOn = (page: { readonly placements: readonly PagePlacement[] }): readonly string[] =>
  page.placements.map((placement) => placement.occurrence.nodeId);

const BAND = (id: string, on: string): Record<string, unknown> => ({
  on,
  content: { type: 'container', id, children: [literalText(`${id}-t`, 'band')] },
});

const LAYER = (id: string, plane: string): Record<string, unknown> => ({
  plane,
  content: { type: 'container', id, children: [literalText(`${id}-t`, 'layer')] },
});

describe('the manifest of a page', () => {
  it('numbers the pages one to N with no hole, and one entry per composed page', () => {
    const result = paginationOf({ page: gridPage(2), ...flow([tableOf(6)]) }, {});
    expect(result.pages.map((page) => page.number)).toStrictEqual([1, 2, 3]);
  });

  it('validates against the schema the contract publishes', () => {
    const result = paginationOf({ page: gridPage(2), ...flow([tableOf(6)]) }, {});
    expect(PaginationResultSchema.safeParse(result).success).toBe(true);
  });

  it('names a whole text once, in the flow of the root region', () => {
    const result = paginationOf({ page: gridPage(4), ...flow([literalText('one', 'short')]) }, {});
    expect(shapeOf(result)).toStrictEqual([['root:root:flow:whole', 'one:root:flow:whole']]);
  });

  it('marks the parts of a text the cuts really split, in page order', () => {
    /* Twenty characters per line, two lines of flow per page: six lines fill three pages. */
    const result = paginationOf(
      { page: gridPage(2), ...flow([literalText('long', 'x'.repeat(120))]) },
      {},
    );
    expect(
      result.pages.map(
        (page) => page.placements.find((one) => one.occurrence.nodeId === 'long')?.fragment,
      ),
    ).toStrictEqual(['first', 'middle', 'last']);
  });

  it('names a container before the children it holds', () => {
    const result = paginationOf(
      {
        page: gridPage(4),
        ...flow([
          { type: 'container', id: 'box', children: [literalText('inner', 'a')] },
          literalText('after', 'b'),
        ]),
      },
      {},
    );
    expect(idsOn(result.pages[0] ?? { placements: [] })).toStrictEqual([
      'root',
      'box',
      'inner',
      'after',
    ]);
  });

  it('names an image and a grid whole, and descends the zones of the grid', () => {
    const result = paginationOf(
      {
        page: gridPage(20),
        ...flow([
          { type: 'image', id: 'logo', src: TINY_PNG },
          {
            type: 'grid',
            id: 'heading',
            columns: 2,
            rows: 1,
            step: 10,
            items: [
              {
                row: 1,
                column: 1,
                content: { type: 'container', id: 'zone', children: [literalText('title', 'T')] },
              },
            ],
          },
        ]),
      },
      {},
    );
    expect(shapeOf(result)[0]).toStrictEqual([
      'root:root:flow:whole',
      'logo:root:flow:whole',
      'heading:root:flow:whole',
      'zone:root:flow:whole',
      'title:root:flow:whole',
    ]);
  });

  it('repeats the header of a table on every page it reaches, under its own role', () => {
    const result = paginationOf(
      { page: gridPage(3), ...flow([tableOf(4, { header: [row('head', 'H')] })]) },
      {},
    );
    const headers = result.pages.map((page) =>
      page.placements
        .filter((one) => one.role === 'table-header')
        .map((one) => one.occurrence.nodeId),
    );
    expect(headers).toStrictEqual([
      ['head', 'head-a', 'head-b'],
      ['head', 'head-a', 'head-b'],
    ]);
    for (const page of result.pages) {
      expect(
        page.placements.filter((one) => one.occurrence.nodeId.startsWith('r')).length,
      ).toBeGreaterThan(0);
      expect(
        page.placements.filter((one) => one.occurrence.nodeId === 'r0' && one.role === 'flow'),
      ).toHaveLength(page.number === 1 ? 1 : 0);
    }
  });

  it('follows each row with the blocks of its cells, in column order', () => {
    const result = paginationOf({ page: gridPage(4), ...flow([tableOf(1)]) }, {});
    expect(idsOn(result.pages[0] ?? { placements: [] })).toStrictEqual([
      'root',
      'ledger',
      'r0',
      'r0-a',
      'r0-b',
    ]);
  });

  it('names one fragmented row on every page it reaches, with the same address', () => {
    /* One cell holds four lines of text and the flow is two lines tall: the row is cut. */
    const tall = {
      type: 'table',
      id: 'ledger',
      columns: COLUMNS,
      header: [],
      body: [
        {
          type: 'tableRow',
          id: 'wide',
          cells: [
            { columnId: 'one', children: [literalText('long', 'y'.repeat(80))] },
            cell('two', 'small', 'z'),
          ],
        },
      ],
      footer: [],
    };
    const result = paginationOf({ page: gridPage(2), ...flow([tall]) }, {});
    const edges = result.pages.map(
      (page) => page.placements.find((one) => one.occurrence.nodeId === 'wide')?.fragment,
    );
    expect(edges).toStrictEqual(['first', 'last']);
    const addresses = result.pages.flatMap((page) =>
      page.placements
        .filter((one) => one.occurrence.nodeId === 'wide')
        .map((one) => JSON.stringify(one.occurrence)),
    );
    expect(new Set(addresses).size).toBe(1);
  });

  it('gives a band its side and its own role, on the pages its domain names', () => {
    const result = paginationOf(
      {
        page: gridPage(4, { header: [BAND('top', 'every')], footer: [BAND('end', 'lastOnly')] }),
        ...flow([tableOf(4)]),
      },
      {},
    );
    expect(
      result.pages.map((page) =>
        page.placements
          .filter((one) => one.role === 'page-band')
          .map((one) => `${one.occurrence.nodeId}:${one.region}:${one.fragment}`),
      ),
    ).toStrictEqual([
      ['top:header:whole', 'top-t:header:whole'],
      ['top:header:whole', 'top-t:header:whole', 'end:footer:whole', 'end-t:footer:whole'],
    ]);
  });

  it('keeps a band role throughout a table it holds, header row included', () => {
    /* What repeats in a band is the whole band, so a header inside one is not told apart from the
       rows around it: the region already says the box is painted on every page of its domain. */
    const banded = {
      on: 'every',
      content: {
        type: 'container',
        id: 'top',
        children: [tableOf(1, { header: [row('head', 'H')] })],
      },
    };
    const result = paginationOf(
      { page: gridPage(6, { header: [banded] }), ...flow([literalText('one', 'short')]) },
      {},
    );
    const roles = new Set(
      (result.pages[0]?.placements ?? [])
        .filter((one) => one.region === 'header')
        .map((one) => one.role),
    );
    expect([...roles]).toStrictEqual(['page-band']);
    expect(idsOn(result.pages[0] ?? { placements: [] })).toContain('head');
  });

  it('paints the layers behind and in front, on every page, without moving a cut', () => {
    const overrides = {
      page: {
        ...gridPage(2),
        layers: [LAYER('behind', 'background'), LAYER('front', 'foreground')],
      },
      ...flow([tableOf(4)]),
    };
    const result = paginationOf(overrides, {});
    const bare = paginationOf({ page: gridPage(2), ...flow([tableOf(4)]) }, {});
    for (const page of result.pages) {
      const [first] = page.placements;
      expect(first?.occurrence.nodeId).toBe('behind');
      expect(first?.region).toBe('background');
      expect(first?.role).toBe('page-layer');
      expect(page.placements.at(-1)?.occurrence.nodeId).toBe('front-t');
      expect(page.placements.at(-1)?.region).toBe('foreground');
    }
    /* The layers reserve no height, so the flow of every page is the flow it had without them. */
    expect(
      shapeOf(result).map((page) => page.filter((one) => one.includes(':root:flow:'))),
    ).toStrictEqual(shapeOf(bare));
  });

  it('still announces one page, its bands and its layers, when the flow is empty', () => {
    const result = paginationOf(
      {
        page: {
          ...gridPage(4, { header: [BAND('top', 'every')] }),
          layers: [LAYER('behind', 'background')],
        },
        root: { type: 'container', id: 'root', children: [] },
      },
      {},
    );
    expect(result.pages).toHaveLength(1);
    expect(shapeOf(result)[0]).toStrictEqual([
      'behind:background:page-layer:whole',
      'behind-t:background:page-layer:whole',
      'top:header:page-band:whole',
      'top-t:header:page-band:whole',
      /* The root container is itself an occurrence, painted empty: the flow holds nothing else. */
      'root:root:flow:whole',
    ]);
  });

  it('carries no measurement key, no cursor and no bound value into the manifest', () => {
    const result = paginationOf({ page: gridPage(2), ...flow([tableOf(4)]) }, SAMPLE_DATA);
    const manifest = JSON.stringify({
      sheet: result.sheet,
      pages: result.pages,
      notices: result.notices,
    });
    expect(manifest).not.toMatch(/"o\d+"/);
    expect(manifest).not.toContain('cursor');
    expect(manifest).not.toContain('body 0');
    expect(manifest).not.toContain('acme');
  });
});
