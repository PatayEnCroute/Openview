import type { EvaluationScope } from '@openview/core';
import { describe, expect, it } from 'vitest';
import { buildPagedTree } from '../html/build-page.js';
import { serializeHtml } from '../html/serialize.js';
import { DEFAULT_RENDER_SAFETY_LIMITS } from '../limits/types.js';
import { paginate } from '../pagination/paginate.js';
import { completedOn } from '../pagination/reports.js';
import type { PaginatedDocument } from '../pagination/types.js';
import {
  constantMarkers,
  gridPage,
  materializedOf,
  multiPageOf,
  NO_FONTS,
  NO_IMAGES,
  paginateOnGrid,
  refusalOfCut,
} from './fixtures.js';
import { GRID, gridMetrics } from './metrics.js';

const flow = (children: readonly Record<string, unknown>[]): Record<string, unknown> => ({
  root: { type: 'container', id: 'root', children },
});

const path = (value: string) => ({ kind: 'path', path: value });

/** One column, one line of text per cell: every body row of the grid is exactly one line tall. */
const COLUMNS = [{ id: 'amount', width: 1, align: 'end' }];

const cellText = (id: string, content: readonly unknown[]) => ({
  columnId: 'amount',
  children: [{ type: 'text', id, content }],
});

const headerRow = {
  type: 'tableRow',
  id: 'head',
  cells: [cellText('h', [{ kind: 'literal', text: 'Amount' }])],
};

/** A table whose detail row is repeated once per entry and declares what each entry is worth. */
function ledgerTable(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'table',
    id: 'ledger',
    columns: COLUMNS,
    header: [headerRow],
    body: [
      {
        type: 'tableRowGroup',
        id: 'entries',
        each: path('ledger.entries'),
        as: 'entry',
        rows: [
          {
            type: 'tableRow',
            id: 'entry-row',
            pageReport: { value: path('entry.amount') },
            cells: [cellText('entry-amount', [{ kind: 'binding', value: path('entry.amount') }])],
          },
        ],
        ...overrides,
      },
    ],
    footer: [],
  };
}

const ledgerOf = (...amounts: readonly number[]): EvaluationScope => ({
  ledger: { entries: amounts.map((amount) => ({ amount })) },
});

/** The report each page carries in, which is what a marker on that page would write. */
const incoming = (paginated: PaginatedDocument): readonly number[] =>
  paginated.pages.map((page) => page.incomingReport);

function ledgerPages(amounts: readonly number[], lines = 4): PaginatedDocument {
  return paginateOnGrid(
    materializedOf({ page: gridPage(lines), ...flow([ledgerTable()]) }, ledgerOf(...amounts)),
  );
}

describe('the report a page carries in', () => {
  it('is zero on the first page and the sum of the rows finished before every other', () => {
    // Four grid lines a page, one taken by the repeated header: three detail rows per page.
    const paginated = ledgerPages([1, 2, 3, 10, 20, 30, 100, 200, 300]);

    expect(paginated.pages).toHaveLength(3);
    expect(incoming(paginated)).toStrictEqual([0, 6, 66]);
  });

  it('never counts the repeated header, even one carrying a contribution no template can write', () => {
    // The contract already refuses a `pageReport` on a header row, so a document cannot reach this
    // guard -- which is exactly why the guard needs a test of its own rather than a scenario. The
    // fragment is therefore built by hand, with a contributing header the schema would never let
    // through, and the collector must still ignore it: a header is repeated on every page the table
    // reaches, so reading it would raise the report on each of them with no new row of the body.
    const paginated = ledgerPages([5, 7, 0, 0, 0, 0]);
    const [page] = paginated.pages;
    const table = page?.root[0]?.kind === 'container' ? page.root[0].children[0] : undefined;
    if (table?.kind !== 'table') {
      throw new Error('the fixture should paint a table on the first page');
    }
    const [headerFragment] = table.header;
    const [bodyFragment] = table.rows;
    if (headerFragment === undefined || bodyFragment?.source.pageReport === undefined) {
      throw new Error('the fixture should carry a header row and a contributing body row');
    }

    const smuggled = {
      ...table,
      header: [
        {
          ...headerFragment,
          source: {
            ...headerFragment.source,
            pageReport: { ...bodyFragment.source.pageReport, key: 'smuggled', value: 1000 },
          },
        },
      ],
    };
    expect(completedOn([smuggled]).map((one) => one.pageReport?.value)).not.toContain(1000);
    expect(completedOn([smuggled])).toStrictEqual(completedOn([table]));
  });

  it('carries negative amounts and a zero the same way as any other', () => {
    const paginated = ledgerPages([-5, 5, 0, 7, 0, 0]);
    expect(incoming(paginated)).toStrictEqual([0, 0]);
  });

  it('counts one contribution once, whichever fragment of the table repeats around it', () => {
    const paginated = ledgerPages([1, 1, 1, 1, 1, 1, 1, 1, 1]);
    const counted = paginated.pages.flatMap((page) => completedOn(page.root));
    expect(counted).toHaveLength(9);
    expect(new Set(counted.map((entry) => entry.key)).size).toBe(9);
  });

  it('adds the terms in the rank they were materialised at, not the rank pages were walked in', () => {
    // The two orders have to be able to DISAGREE, or this proves nothing -- and they only disagree
    // when a row materialised EARLY finishes LATE. An outer row is ranked before the inner rows its
    // own cell holds; make that inner table taller than a page and the outer row spans two sheets
    // while the first inner rows end on the first. Collection order is then 1, 2, 0, 3, 4.
    const sum = (terms: readonly number[]): number =>
      terms.reduce((total, term) => total + term, 0);
    const byRank = sum([1e16, 1, 1, 1, 1]);
    const byWalk = sum([1, 1, 1e16, 1, 1]);
    expect(byRank).not.toBe(byWalk);

    const spanning = {
      type: 'table',
      id: 'outer',
      columns: COLUMNS,
      header: [],
      body: [
        {
          type: 'tableRow',
          id: 'outer-row',
          pageReport: { value: { kind: 'literal', value: 1e16 } },
          cells: [
            {
              columnId: 'amount',
              children: [
                {
                  type: 'table',
                  id: 'inner',
                  columns: COLUMNS,
                  header: [],
                  body: [0, 1, 2, 3].map((index) => ({
                    type: 'tableRow',
                    id: `inner-${String(index)}`,
                    pageReport: { value: { kind: 'literal', value: 1 } },
                    cells: [cellText(`inner-t${String(index)}`, [{ kind: 'literal', text: 'z' }])],
                  })),
                  footer: [],
                },
              ],
            },
          ],
        },
        {
          type: 'tableRow',
          id: 'tail',
          cells: [cellText('tail-t', [{ kind: 'literal', text: 'w'.repeat(60) }])],
        },
      ],
      footer: [],
    };

    const paginated = paginateOnGrid(
      materializedOf({ page: gridPage(2), ...flow([spanning]) }, {}),
    );
    /* The order the fragments hand them over, page by page, really is not the order of the ranks. */
    const walked = paginated.pages
      .flatMap((page) => completedOn(page.root))
      .map((one) => one.pageReport?.order);
    expect(walked).toStrictEqual([1, 2, 0, 3, 4]);

    const last = incoming(paginated).at(-1);
    expect(last).toBe(byRank);
    expect(last).not.toBe(byWalk);
  });

  it('refuses a total that stops being finite, naming the page and no value', () => {
    // `1e308` prints in six characters, so the two rows that overflow the double stay one grid line
    // tall and the cut is the ordinary one: what fails here is the sum, not the layout.
    const refused = refusalOfCut(() =>
      paginateOnGrid(
        materializedOf(
          { page: gridPage(4), ...flow([ledgerTable()]) },
          ledgerOf(1e308, 1e308, 1, 0, 0, 0),
        ),
      ),
    );
    expect(refused.code).toBe('page-report-refused');
    expect(refused.details.pageNumber).toBe(2);
    expect(refused.message).not.toContain('1e+308');
    expect(refused.message).not.toContain('Infinity');
  });
});

describe('a contributing row that had to be cut', () => {
  /** A detail row whose single cell holds a text of `count` grid lines. */
  const tallRow = (count: number) => ({
    type: 'table',
    id: 'ledger',
    columns: COLUMNS,
    header: [headerRow],
    body: [
      {
        type: 'tableRow',
        id: 'tall',
        pageReport: { value: { kind: 'literal', value: 500 } },
        cells: [cellText('tall-text', [{ kind: 'literal', text: 'x'.repeat(count * 20) }])],
      },
      {
        type: 'tableRow',
        id: 'after',
        pageReport: { value: { kind: 'literal', value: 7 } },
        cells: [cellText('after-text', [{ kind: 'literal', text: 'y'.repeat(20) }])],
      },
    ],
    footer: [],
  });

  it('is counted on the page holding its last fragment, and never before', () => {
    // Two grid lines a page, one taken by the header: a row of four lines spans four pages, and
    // its amount appears in the report only once its final fragment has been printed.
    const paginated = paginateOnGrid(
      materializedOf({ page: gridPage(2), ...flow([tallRow(4)]) }, {}),
    );
    const reports = incoming(paginated);

    expect(paginated.pages.length).toBeGreaterThanOrEqual(5);
    /* Nothing carried while the row is still being printed. */
    expect(reports.slice(0, 4)).toStrictEqual([0, 0, 0, 0]);
    /* The page after the last fragment carries it, and the row that follows adds to it. */
    expect(reports[4]).toBe(500);
    expect(reports.at(-1)).toBe(500);
  });
});

describe('a contributing row inside another table', () => {
  /** An outer row whose single cell holds a table of its own, each inner row contributing. */
  const nested = {
    type: 'table',
    id: 'outer',
    columns: COLUMNS,
    header: [headerRow],
    body: [
      {
        type: 'tableRow',
        id: 'outer-row',
        pageReport: { value: { kind: 'literal', value: 100 } },
        cells: [
          {
            columnId: 'amount',
            children: [
              {
                type: 'table',
                id: 'inner',
                columns: COLUMNS,
                header: [],
                body: [1, 2, 3, 4].map((value) => ({
                  type: 'tableRow',
                  id: `inner-${String(value)}`,
                  pageReport: { value: { kind: 'literal', value } },
                  cells: [cellText(`inner-t${String(value)}`, [{ kind: 'literal', text: 'z' }])],
                })),
                footer: [],
              },
            ],
          },
        ],
      },
    ],
    footer: [],
  };

  it('counts an inner row that finished, even while the row holding it has not', () => {
    // Two grid lines a page and one taken by the header: the outer row spans several pages, so its
    // own hundred waits for its last fragment while the inner rows are counted as they end.
    const paginated = paginateOnGrid(materializedOf({ page: gridPage(2), ...flow([nested]) }, {}));
    const reports = paginated.pages.map((page) => page.incomingReport);

    expect(reports[0]).toBe(0);
    /* Strictly rising while the inner rows end, and never reaching the outer hundred early. */
    for (const [index, report] of reports.entries()) {
      expect(report).toBeLessThan(100);
      if (index > 0) {
        expect(report).toBeGreaterThanOrEqual(reports[index - 1] ?? 0);
      }
    }
    expect(reports.at(-1)).toBe(1 + 2 + 3);
  });

  it('counts each contribution once across the whole run', () => {
    const paginated = paginateOnGrid(materializedOf({ page: gridPage(2), ...flow([nested]) }, {}));
    const keys = paginated.pages
      .flatMap((page) => completedOn(page.root))
      .map((one) => one.pageReport?.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('what a report marker writes', () => {
  /** A running header carrying a literal and a report marker at a declared rounding. */
  const reportBand = (decimals: number, mode: string) => [
    {
      on: 'exceptFirst',
      content: {
        type: 'container',
        id: 'carried',
        children: [
          {
            type: 'text',
            id: 'carried-line',
            content: [
              { kind: 'literal', text: 'Carried ' },
              { kind: 'pageField', field: 'report', decimals, mode },
            ],
          },
        ],
      },
    },
  ];

  /** How the run was cut: the page count and the rows each page carries, with no value in it. */
  function bandedCuts(amounts: readonly number[]): string {
    const document = multiPageOf(
      {
        page: { ...gridPage(5), header: reportBand(2, 'halfExpand') },
        ...flow([ledgerTable()]),
      },
      ledgerOf(...amounts),
    );
    const metrics = gridMetrics(document);
    const paginated = paginate(document, {
      metrics,
      markers: constantMarkers(),
      printableHeight: document.printable.height * metrics.pxPerMm,
      slack: new Map(),
      maxPages: DEFAULT_RENDER_SAFETY_LIMITS.maxPages,
    });
    return paginated.pages.map((page) => String(completedOn(page.root).length)).join('|');
  }

  it('applies the rounding the model declared, and nothing else', () => {
    // The raw sum travels; each marker writes it at its own position and mode. Two markers of two
    // roundings therefore write two spellings of one total, which is the model's responsibility.
    const paginated = ledgerPages([2.005, 2.005, 0, 0, 0, 0]);
    const raw = paginated.pages[1]?.incomingReport;
    if (raw === undefined) {
      throw new Error('the fixture should produce a second page');
    }
    expect(raw).toBeCloseTo(4.01, 10);
  });

  it('reserves a band on every page, so the report cannot make the run oscillate', () => {
    // The band takes its height from every page whether it paints there or not, and the marker box
    // is a fixed width: the page count and the cuts are the same whatever the report is worth.
    const short = bandedCuts([1, 2, 3, 4, 5, 6]);
    expect(short).toBe(bandedCuts([1e6, 2e6, 3e6, 4e6, 5e6, 6e6]));
    expect(short).toBe(bandedCuts([-1.23456789, 2, 3, 4, 5, 6]));
    expect(short.split('|').length).toBeGreaterThan(1);
  });
});

describe('the digits a report marker paints', () => {
  /** The text of every marker box of the composed html, page by page. */
  function markerTexts(
    decimals: number,
    mode: string,
    amounts: readonly number[],
  ): readonly string[] {
    const document = multiPageOf(
      {
        page: {
          ...gridPage(5),
          header: [
            {
              on: 'exceptFirst',
              content: {
                type: 'container',
                id: 'carried',
                children: [
                  {
                    type: 'text',
                    id: 'carried-line',
                    content: [{ kind: 'pageField', field: 'report', decimals, mode }],
                  },
                ],
              },
            },
          ],
        },
        ...flow([ledgerTable()]),
      },
      ledgerOf(...amounts),
    );
    const metrics = gridMetrics(document);
    const html = serializeHtml(
      buildPagedTree(
        paginate(document, {
          metrics,
          markers: constantMarkers(),
          printableHeight: document.printable.height * metrics.pxPerMm,
          slack: new Map(),
          maxPages: DEFAULT_RENDER_SAFETY_LIMITS.maxPages,
        }),
        NO_FONTS,
        NO_IMAGES,
      ),
      DEFAULT_RENDER_SAFETY_LIMITS.maxHtmlBytes,
    );
    return [...html.matchAll(/<span class="ov-marker"[^>]*>([^<]*)<\/span>/g)].map(
      (match) => match[1] ?? '',
    );
  }

  it('writes the canonical decimal form, with no locale and no currency', () => {
    // Five grid lines, one for the band and one for the repeated header: three rows on page one,
    // so page two carries their sum -- no thousands separator, no symbol, no trailing zero.
    expect(markerTexts(2, 'halfExpand', [1234.5, 1, 1, 1])).toStrictEqual(['1236.5']);
  });

  it('writes the two rounding modes differently on the same total', () => {
    // The half that separates them, produced by the data rather than asserted on a constant.
    expect(markerTexts(0, 'halfExpand', [1.25, 1.25, 0, 0])).toStrictEqual(['3']);
    expect(markerTexts(0, 'halfEven', [1.25, 1.25, 0, 0])).toStrictEqual(['2']);
  });

  it('honours a negative rounding position, which rounds left of the point', () => {
    expect(markerTexts(-2, 'halfExpand', [1250, 0, 0, 0])).toStrictEqual(['1300']);
  });

  it('paints no report on the first page, because its band domain excludes it', () => {
    // The zero of the first page is real; it is the model that chooses not to show it.
    expect(markerTexts(2, 'halfExpand', [5, 0, 0, 0])).toHaveLength(1);
  });
});

describe('the grid the report oracles rest on', () => {
  it('gives one detail row exactly one line of the grid', () => {
    // Spelt once: every expectation above counts rows per page from it, so a change to the grid
    // shows up here rather than as an unexplained shift in a report.
    const document = materializedOf({ page: gridPage(4), ...flow([ledgerTable()]) }, ledgerOf(1));
    const metrics = gridMetrics(document);
    const [table] = document.root[0]?.kind === 'container' ? document.root[0].children : [];
    if (table?.kind !== 'table') {
      throw new Error('the fixture should hold a table');
    }
    expect(metrics.height(table.body[0]?.key ?? '')).toBe(GRID.lineHeight);
    expect(metrics.height(table.header[0]?.key ?? '')).toBe(GRID.lineHeight);
  });
});
