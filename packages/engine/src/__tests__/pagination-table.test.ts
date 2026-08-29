import { describe, expect, it } from 'vitest';
import { buildPagedTree } from '../html/build-page.js';
import { serializeHtml } from '../html/serialize.js';
import { DEFAULT_RENDER_SAFETY_LIMITS } from '../limits/types.js';
import type { MaterialFragment, PaginatedDocument, TableFragment } from '../pagination/types.js';
import {
  gridPage,
  idsPerPage,
  literalText,
  materializedOf,
  NO_FONTS,
  NO_IMAGES,
  paginateOnGrid,
  refusalOfCut,
  SAMPLE_DATA,
  textPerPage,
} from './fixtures.js';

const flow = (children: readonly Record<string, unknown>[]): Record<string, unknown> => ({
  root: { type: 'container', id: 'root', children },
});

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

const COLUMNS = [
  { id: 'one', width: 1, align: 'start' },
  { id: 'two', width: 1, align: 'end' },
];

/** A table of `count` body rows, each one grid line tall. */
function tableOf(
  count: number,
  parts: {
    header?: readonly Record<string, unknown>[];
    footer?: readonly Record<string, unknown>[];
    box?: Record<string, unknown>;
  } = {},
): Record<string, unknown> {
  return {
    type: 'table',
    id: 'grid',
    ...(parts.box === undefined ? {} : { box: parts.box }),
    columns: COLUMNS,
    header: parts.header ?? [],
    body: Array.from({ length: count }, (_unused, index) => row(`r${index}`, `body ${index}`)),
    footer: parts.footer ?? [],
  };
}

/** The tables painted on each page, in page order. */
function tablesOf(paginated: PaginatedDocument): readonly TableFragment[][] {
  return paginated.pages.map((page) => {
    const found: TableFragment[] = [];
    const walk = (fragments: readonly MaterialFragment[]): void => {
      for (const fragment of fragments) {
        if (fragment.kind === 'table') {
          found.push(fragment);
        }
        if (fragment.kind === 'container') {
          walk(fragment.children);
        }
      }
    };
    walk(page.root);
    return found;
  });
}

const rowIdsPerPage = (paginated: PaginatedDocument): readonly (readonly string[])[] =>
  tablesOf(paginated).map((tables) =>
    tables.flatMap((table) => table.rows.map((entry) => entry.source.nodeId)),
  );

const headerIdsPerPage = (paginated: PaginatedDocument): readonly (readonly string[])[] =>
  tablesOf(paginated).map((tables) =>
    tables.flatMap((table) => table.header.map((entry) => entry.source.nodeId)),
  );

describe('a table that fits', () => {
  it('is painted once, header and footer included', () => {
    const paginated = paginateOnGrid(
      materializedOf(
        {
          page: gridPage(10),
          ...flow([tableOf(2, { header: [row('h', 'head')], footer: [row('f', 'foot')] })]),
        },
        {},
      ),
    );
    expect(paginated.pages).toHaveLength(1);
    expect(headerIdsPerPage(paginated)).toStrictEqual([['h']]);
    expect(rowIdsPerPage(paginated)).toStrictEqual([['r0', 'r1', 'f']]);
    expect(tablesOf(paginated)[0]?.[0]?.includesFooterEnd).toBe(true);
    expect(tablesOf(paginated)[0]?.[0]?.edge).toBe('whole');
  });

  it('is painted once even when it holds no row at all', () => {
    const paginated = paginateOnGrid(
      materializedOf(
        { page: gridPage(10), ...flow([tableOf(0, { header: [row('h', 'head')] })]) },
        {},
      ),
    );
    expect(paginated.pages).toHaveLength(1);
    const [table] = tablesOf(paginated)[0] ?? [];
    expect(table?.rows).toStrictEqual([]);
    expect(table?.header.map((entry) => entry.source.nodeId)).toStrictEqual(['h']);
    expect(table?.includesFooterEnd).toBe(true);
  });

  it('invents no header for a table that declares none', () => {
    const paginated = paginateOnGrid(
      materializedOf({ page: gridPage(3), ...flow([tableOf(6)]) }, {}),
    );
    expect(paginated.pages.length).toBeGreaterThan(1);
    for (const page of headerIdsPerPage(paginated)) {
      expect(page).toStrictEqual([]);
    }
    const html = serializeHtml(
      buildPagedTree(paginated, NO_FONTS, NO_IMAGES),
      DEFAULT_RENDER_SAFETY_LIMITS.maxHtmlBytes,
    );
    expect(html).toContain('<thead></thead>');
  });
});

describe('a table that spans several pages', () => {
  const spanning = (flowLines: number, rows: number) =>
    paginateOnGrid(
      materializedOf(
        {
          page: gridPage(flowLines),
          ...flow([tableOf(rows, { header: [row('h', 'head')], footer: [row('f', 'foot')] })]),
        },
        {},
      ),
    );

  it('repeats every header row on each fragment and never repeats the footer', () => {
    const paginated = spanning(3, 6);
    expect(headerIdsPerPage(paginated)).toStrictEqual([['h'], ['h'], ['h'], ['h']]);
    const rows = rowIdsPerPage(paginated);
    expect(rows.flat().filter((id) => id === 'f')).toHaveLength(1);
    expect(rows.at(-1)?.at(-1)).toBe('f');
  });

  it('prints every body row exactly once and in the order it was bound', () => {
    const paginated = spanning(3, 9);
    const rows = rowIdsPerPage(paginated).flat();
    expect(rows.filter((id) => id !== 'f')).toStrictEqual(
      Array.from({ length: 9 }, (_unused, index) => `r${index}`),
    );
  });

  it('paints the cells of a row on the page that carries it, and nowhere else', () => {
    const paginated = spanning(3, 4);
    const painted = idsPerPage(paginated);
    /* Each sheet holds the root, the table, the repeated header with its two cells, then its rows. */
    for (const page of painted) {
      expect(page.filter((id) => id === 'h')).toHaveLength(1);
      expect(page).toContain('h-a');
    }
    expect(painted.flat().filter((id) => id === 'r0-a')).toHaveLength(1);
    expect(textPerPage(paginated, 'r0-a')).toStrictEqual(['body 0']);
    /* The header text is repeated once per fragment, and the body text never is. */
    expect(textPerPage(paginated, 'h-a')).toHaveLength(painted.length);
  });

  it('accepts no fragment that carries a header and nothing else', () => {
    const paginated = spanning(3, 7);
    for (const page of rowIdsPerPage(paginated)) {
      expect(page.length).toBeGreaterThan(0);
    }
  });

  it('marks each fragment with where it sits in the run', () => {
    const edges = tablesOf(spanning(3, 6)).map((tables) => tables[0]?.edge);
    expect(edges).toStrictEqual(['first', 'middle', 'middle', 'last']);
  });

  it('repeats a header of several rows as a block and in order', () => {
    const paginated = paginateOnGrid(
      materializedOf(
        {
          page: gridPage(4),
          ...flow([tableOf(6, { header: [row('h1', 'first'), row('h2', 'second')] })]),
        },
        {},
      ),
    );
    expect(paginated.pages.length).toBeGreaterThan(1);
    for (const page of headerIdsPerPage(paginated)) {
      expect(page).toStrictEqual(['h1', 'h2']);
    }
  });

  it('starts the footer on a page of its own when the body filled the one before it', () => {
    /* Two lines of flow, a header line and three body lines: the third body row fills page two, so
       the footer opens page three -- with the header repeated in front of it. */
    const paginated = paginateOnGrid(
      materializedOf(
        {
          page: gridPage(2),
          ...flow([tableOf(3, { header: [row('h', 'head')], footer: [row('f', 'foot')] })]),
        },
        {},
      ),
    );
    const rows = rowIdsPerPage(paginated);
    expect(rows.at(-1)).toStrictEqual(['f']);
    expect(headerIdsPerPage(paginated).at(-1)).toStrictEqual(['h']);
  });

  it('refuses a header that leaves no room for a single row on a page of its own', () => {
    const refused = refusalOfCut(() =>
      paginateOnGrid(
        materializedOf(
          {
            page: gridPage(2),
            ...flow([tableOf(4, { header: [row('h1', 'a'), row('h2', 'b')] })]),
          },
          {},
        ),
      ),
    );
    expect(refused.code).toBe('pagination-impossible');
    expect(refused.details.nodeId).toBe('grid');
  });

  it('refuses a header taller than a page rather than printing header after header', () => {
    const refused = refusalOfCut(() =>
      paginateOnGrid(
        materializedOf(
          {
            page: gridPage(2),
            ...flow([tableOf(2, { header: [row('h1', 'a'), row('h2', 'b'), row('h3', 'c')] })]),
          },
          {},
        ),
      ),
    );
    expect(refused.code).toBe('pagination-impossible');
    expect(refused.details.nodeId).toBe('grid');
  });

  it('charges the padding of the table to every fragment it is cut into', () => {
    const padded = paginateOnGrid(
      materializedOf(
        {
          page: gridPage(3),
          ...flow([tableOf(6, { box: { padding: { top: 1, right: 0, bottom: 1, left: 0 } } })]),
        },
        {},
      ),
    );
    const plain = paginateOnGrid(materializedOf({ page: gridPage(3), ...flow([tableOf(6)]) }, {}));
    /* Three rows a page without padding, two with it: a cloned box is paid for on every sheet. */
    expect(padded.pages.length).toBeGreaterThan(plain.pages.length);
  });
});

describe('a row that no longer fits where it stands', () => {
  it('moves whole to the next page rather than being cut', () => {
    const tall = {
      type: 'table',
      id: 'grid',
      columns: COLUMNS,
      header: [],
      body: [
        row('short', 'one line'),
        {
          type: 'tableRow',
          id: 'tall',
          cells: [cell('one', 'tall-a', 'x'.repeat(40)), cell('two', 'tall-b', 'y'.repeat(20))],
        },
      ],
      footer: [],
    };
    const paginated = paginateOnGrid(materializedOf({ page: gridPage(2), ...flow([tall]) }, {}));
    expect(rowIdsPerPage(paginated)).toStrictEqual([['short'], ['tall']]);
    const [, second] = tablesOf(paginated);
    expect(second?.[0]?.rows[0]?.edge).toBe('whole');
  });
});

describe('the rules of a fragment are resolved after the cut', () => {
  /**
   * Widths chosen so that a boundary decided against a NEIGHBOUR and one decided against the
   * TABLE come out differently: a row bottom of 0.6 beats the 0.2 top of the row below it, and
   * loses to the 1 mm bottom edge of the table.
   */
  const ruled = (count: number) => ({
    type: 'table',
    id: 'grid',
    box: { border: { bottom: { width: 1, color: '#000000' } } },
    columns: COLUMNS,
    header: [row('h', 'head', { box: { border: { bottom: { width: 0.2, color: '#111111' } } } })],
    body: Array.from({ length: count }, (_unused, index) =>
      row(`r${index}`, `body ${index}`, {
        box: {
          border: {
            top: { width: 0.2, color: '#222222' },
            bottom: { width: 0.6, color: '#333333' },
          },
        },
      }),
    ),
    footer: [],
  });

  /** The `<tr>` of one sheet, in order: the repeated header first, then the rows it carries. */
  const rowsOfSheet = (sheet: string): readonly string[] => sheet.split('<tr').slice(1);

  it('gives the last row of a fragment the boundary of the page, not of its old neighbour', () => {
    const paginated = paginateOnGrid(
      materializedOf({ page: gridPage(3), ...flow([ruled(5)]) }, {}),
    );
    const sheets = serializeHtml(
      buildPagedTree(paginated, NO_FONTS, NO_IMAGES),
      DEFAULT_RENDER_SAFETY_LIMITS.maxHtmlBytes,
    )
      .split('class="ov-page"')
      .slice(1);
    expect(sheets.length).toBeGreaterThan(2);
    for (const sheet of sheets) {
      const rows = rowsOfSheet(sheet);
      /* The row that ends a fragment shares its boundary with the table edge and loses to it, so
         it paints no rule of its own. Copying the rules of the uncut table would keep one. */
      expect(rows.at(-1)).not.toContain('inset 0 -0.6mm 0 0 #333333');
      /* Every row of a fragment still takes the boundary above it from the row before it. */
      expect(rows.at(1)).toContain('inset 0 0.2mm 0 0 #222222');
    }
  });

  it('closes the perimeter of every fragment with the edges the table declared', () => {
    const paginated = paginateOnGrid(
      materializedOf({ page: gridPage(3), ...flow([ruled(5)]) }, {}),
    );
    const html = serializeHtml(
      buildPagedTree(paginated, NO_FONTS, NO_IMAGES),
      DEFAULT_RENDER_SAFETY_LIMITS.maxHtmlBytes,
    );
    const sheets = html.split('class="ov-page"').slice(1);
    for (const sheet of sheets) {
      expect(sheet).toContain('inset 0 -1mm 0 0 #000000');
    }
    /* Two adjacent rules never add up: the wider one wins and the other paints nowhere. */
    expect(html).not.toContain('0.8mm');
    expect(html).not.toContain('1.6mm');
  });

  it('keeps the same column widths on every fragment', () => {
    const paginated = paginateOnGrid(
      materializedOf({ page: gridPage(3), ...flow([ruled(6)]) }, {}),
    );
    const html = serializeHtml(
      buildPagedTree(paginated, NO_FONTS, NO_IMAGES),
      DEFAULT_RENDER_SAFETY_LIMITS.maxHtmlBytes,
    );
    const widths = [...html.matchAll(/<col style="width:([\d.%]+)">/g)].map((match) => match[1]);
    expect(new Set(widths)).toStrictEqual(new Set(['50%']));
    expect(widths).toHaveLength(paginated.pages.length * 2);
  });
});

describe('a table built from a row group', () => {
  it('cuts between its occurrences like any other sequence of rows', () => {
    const paginated = paginateOnGrid(
      materializedOf(
        {
          page: gridPage(2),
          ...flow([
            {
              type: 'table',
              id: 'grid',
              columns: COLUMNS,
              header: [row('h', 'head')],
              body: [
                {
                  type: 'tableRowGroup',
                  id: 'group',
                  each: { kind: 'path', path: 'sample.items' },
                  as: 'item',
                  rows: [
                    {
                      type: 'tableRow',
                      id: 'detail',
                      cells: [
                        {
                          columnId: 'one',
                          children: [
                            {
                              type: 'text',
                              id: 'sku',
                              content: [
                                { kind: 'binding', value: { kind: 'path', path: 'item.sku' } },
                              ],
                            },
                          ],
                        },
                        cell('two', 'note', 'x'),
                      ],
                    },
                  ],
                },
              ],
              footer: [],
            },
          ]),
        },
        SAMPLE_DATA,
      ),
    );
    expect(rowIdsPerPage(paginated)).toStrictEqual([['detail'], ['detail']]);
    for (const page of headerIdsPerPage(paginated)) {
      expect(page).toStrictEqual(['h']);
    }
  });
});
