import { describe, expect, it } from 'vitest';
import { fillFlow } from '../pagination/flow.js';
import { placeRow } from '../pagination/row.js';
import type {
  MaterialFragment,
  PaginatedDocument,
  RowFragment,
  TableFragment,
} from '../pagination/types.js';
import {
  gridPage,
  literalText,
  materializedOf,
  paginateOnGrid,
  refusalOfCut,
  textPerPage,
} from './fixtures.js';
import { gridMetrics } from './metrics.js';

const flow = (children: readonly Record<string, unknown>[]): Record<string, unknown> => ({
  root: { type: 'container', id: 'root', children },
});

const COLUMNS = [
  { id: 'label', width: 1, align: 'start' },
  { id: 'detail', width: 3, align: 'start' },
];

const INNER_COLUMNS = [{ id: 'only', width: 1, align: 'start' }];

const innerRow = (index: number) => ({
  type: 'tableRow',
  id: `inner-${index}`,
  cells: [{ columnId: 'only', children: [literalText(`inner-t-${index}`, `inner line ${index}`)] }],
});

/**
 * One outer row two cells wide: a short label on the left, and on the right a table long enough
 * that no page can hold the row it sits in.
 */
function nested(innerRows: number): Record<string, unknown> {
  return {
    type: 'table',
    id: 'outer',
    columns: COLUMNS,
    header: [
      {
        type: 'tableRow',
        id: 'outer-head',
        cells: [
          { columnId: 'label', children: [literalText('oh-a', 'Item')] },
          { columnId: 'detail', children: [literalText('oh-b', 'Breakdown')] },
        ],
      },
    ],
    body: [
      {
        type: 'tableRow',
        id: 'outer-row',
        cells: [
          { columnId: 'label', children: [literalText('short', 'the label')] },
          {
            columnId: 'detail',
            children: [
              {
                type: 'table',
                id: 'inner',
                columns: INNER_COLUMNS,
                header: [
                  {
                    type: 'tableRow',
                    id: 'inner-head',
                    cells: [{ columnId: 'only', children: [literalText('ih', 'Detail')] }],
                  },
                ],
                body: Array.from({ length: innerRows }, (_unused, index) => innerRow(index)),
                footer: [],
              },
            ],
          },
        ],
      },
    ],
    footer: [],
  };
}

function tablesOf(fragments: readonly MaterialFragment[]): readonly TableFragment[] {
  const found: TableFragment[] = [];
  const walk = (entries: readonly MaterialFragment[]): void => {
    for (const entry of entries) {
      if (entry.kind === 'table') {
        found.push(entry);
        for (const row of [...entry.header, ...entry.rows]) {
          for (const cell of row.cells) {
            walk(cell.children);
          }
        }
      }
      if (entry.kind === 'container') {
        walk(entry.children);
      }
    }
  };
  walk(fragments);
  return found;
}

const outerRowsPerPage = (paginated: PaginatedDocument): readonly (readonly RowFragment[])[] =>
  paginated.pages.map(
    (page) => tablesOf(page.root).find((table) => table.source.nodeId === 'outer')?.rows ?? [],
  );

describe('a row taller than any page', () => {
  const paginated = () =>
    paginateOnGrid(materializedOf({ page: gridPage(4), ...flow([nested(9)]) }, {}));

  it('is split down its columns rather than refused', () => {
    const cut = paginated();
    expect(cut.pages.length).toBeGreaterThan(2);
    for (const rows of outerRowsPerPage(cut)) {
      expect(rows).toHaveLength(1);
      expect(rows[0]?.source.nodeId).toBe('outer-row');
    }
  });

  it('marks the fragments of the row from first to last', () => {
    const edges = outerRowsPerPage(paginated()).map((rows) => rows[0]?.edge);
    expect(edges[0]).toBe('first');
    expect(edges.at(-1)).toBe('last');
    for (const edge of edges.slice(1, -1)) {
      expect(edge).toBe('middle');
    }
  });

  it('keeps every cell in its column, with the finished ones present and empty', () => {
    const cut = paginated();
    for (const rows of outerRowsPerPage(cut)) {
      expect(rows[0]?.cells.map((entry) => entry.source.columnId)).toStrictEqual([
        'label',
        'detail',
      ]);
    }
    /* The short label belongs to the first fragment; the ones after it keep the column and
       nothing else. */
    const labels = outerRowsPerPage(cut).map((rows) => rows[0]?.cells[0]?.children.length ?? 0);
    expect(labels[0]).toBe(1);
    for (const later of labels.slice(1)) {
      expect(later).toBe(0);
    }
  });

  it('prints the content of a finished cell exactly once', () => {
    expect(textPerPage(paginated(), 'short')).toStrictEqual(['the label']);
  });

  it('repeats the header of the outer table and of the inner one alike', () => {
    const cut = paginated();
    for (const page of cut.pages) {
      const tables = tablesOf(page.root);
      const outer = tables.find((table) => table.source.nodeId === 'outer');
      const inner = tables.find((table) => table.source.nodeId === 'inner');
      expect(outer?.header.map((entry) => entry.source.nodeId)).toStrictEqual(['outer-head']);
      expect(inner?.header.map((entry) => entry.source.nodeId)).toStrictEqual(['inner-head']);
    }
  });

  it('prints every inner row exactly once and in order', () => {
    const cut = paginated();
    const printed = cut.pages.flatMap((page) => {
      const inner = tablesOf(page.root).find((table) => table.source.nodeId === 'inner');
      return (inner?.rows ?? []).map((entry) => entry.source.nodeId);
    });
    expect(printed).toStrictEqual(Array.from({ length: 9 }, (_unused, index) => `inner-${index}`));
  });

  it('spans no more rows than the outer table declares', () => {
    const all = outerRowsPerPage(paginated()).flat();
    expect(new Set(all.map((entry) => entry.source.nodeId))).toStrictEqual(new Set(['outer-row']));
  });

  it('refuses the row when even one inner line cannot fit on a page of its own', () => {
    /* Two lines of flow, and the two headers alone already take both of them. */
    const refused = refusalOfCut(() =>
      paginateOnGrid(materializedOf({ page: gridPage(2), ...flow([nested(4)]) }, {})),
    );
    expect(refused.code).toBe('pagination-impossible');
  });
});

describe('a row that is not taller than a page', () => {
  it('is never split, even when the page it stands on cannot hold it', () => {
    const cut = paginateOnGrid(materializedOf({ page: gridPage(6), ...flow([nested(2)]) }, {}));
    const rows = outerRowsPerPage(cut).flat();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.edge).toBe('whole');
  });
});

describe('splitting one row down its columns', () => {
  const rowOf = () => {
    const document = materializedOf({ page: gridPage(4), ...flow([nested(3)]) }, {});
    const table = tablesOf(paginateOnGrid(document).pages.flatMap((page) => page.root)).find(
      (entry) => entry.source.nodeId === 'outer',
    );
    const row = table?.rows[0]?.source;
    if (row === undefined) {
      throw new Error('the fixture holds no outer row');
    }
    return { row, metrics: gridMetrics(document) };
  };

  it('places nothing when every cell of the row is already spent', () => {
    const { row, metrics } = rowOf();
    const spent = {
      cells: row.cells.map((cell) => ({ index: cell.children.length, inner: undefined })),
    };
    expect(placeRow(row, spent, 1000, 1000, metrics, fillFlow)).toBeUndefined();
  });

  it('places nothing when the row is left no height for its own padding', () => {
    const { row, metrics } = rowOf();
    expect(placeRow(row, undefined, 0, 1000, metrics, fillFlow)).toBeUndefined();
  });
});
