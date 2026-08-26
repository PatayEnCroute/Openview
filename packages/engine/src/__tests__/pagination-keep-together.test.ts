import type { EvaluationScope } from '@openview/core';
import { describe, expect, it } from 'vitest';
import { decideKeepTogether } from '../pagination/keep-together.js';
import type { PaginatedDocument } from '../pagination/types.js';
import {
  gridPage,
  idsPerPage,
  literalText,
  materializedOf,
  multiPageOf,
  paginateOnGrid,
  refusalOfCut,
  TINY_PNG,
} from './fixtures.js';
import { GRID } from './metrics.js';

const flow = (children: readonly Record<string, unknown>[]): Record<string, unknown> => ({
  root: { type: 'container', id: 'root', children },
});

/** Twenty characters is one line of the grid, so a block of `n` lines is `n` of these. */
const lines = (count: number): string => 'x'.repeat(count * 20);

const path = (value: string) => ({ kind: 'path', path: value });

const marked = { keepTogether: true };

const ITEMS: EvaluationScope = { set: { items: [{ n: 1 }, { n: 2 }] } };

/** Which pages each declaration was painted on, one entry per page. */
const pagesOf = (paginated: PaginatedDocument, nodeId: string): readonly number[] =>
  idsPerPage(paginated)
    .map((ids, index) => (ids.includes(nodeId) ? index + 1 : 0))
    .filter((page) => page > 0);

/**
 * One filler block of `fill` lines, then the subject: the subject therefore starts part way down
 * the first page, which is the position the three branches are distinguished at.
 */
function afterFiller(
  fill: number,
  subject: Record<string, unknown>,
  height: number,
  data: EvaluationScope = {},
): PaginatedDocument {
  return paginateOnGrid(
    materializedOf(
      { page: gridPage(height), ...flow([literalText('fill', lines(fill)), subject]) },
      data,
    ),
  );
}

describe('the three ordered branches of a mark', () => {
  it('places whole, defers, then stops blocking, and in that order', () => {
    expect(decideKeepTogether(10, 10, 30)).toBe('whole');
    expect(decideKeepTogether(20, 10, 30)).toBe('defer');
    expect(decideKeepTogether(40, 10, 30)).toBe('fallBack');
  });

  it('places whole when the room is exactly the height, never one pixel short', () => {
    expect(decideKeepTogether(30, 30, 30)).toBe('whole');
    expect(decideKeepTogether(30.5, 30, 30)).toBe('fallBack');
  });
});

describe('a marked block, kind by kind', () => {
  /** The three cases every kind owes: it fits here, it fits only on a fresh page, it fits nowhere. */
  const subjects: readonly (readonly [string, (id: string) => Record<string, unknown>, number])[] =
    [
      ['text', (id) => ({ ...literalText(id, lines(3)), ...marked }), 3],
      [
        'image',
        (id) => ({ type: 'image', id, src: TINY_PNG, ...marked }),
        GRID.imageHeight / GRID.lineHeight,
      ],
      [
        'container',
        (id) => ({
          type: 'container',
          id,
          ...marked,
          children: [literalText(`${id}-a`, lines(2)), literalText(`${id}-b`, lines(1))],
        }),
        3,
      ],
      [
        'table',
        (id) => ({
          type: 'table',
          id,
          ...marked,
          columns: [{ id: 'c', width: 1, align: 'start' }],
          header: [],
          body: [0, 1, 2].map((index) => ({
            type: 'tableRow',
            id: `${id}-r${String(index)}`,
            cells: [
              {
                columnId: 'c',
                children: [literalText(`${id}-t${String(index)}`, lines(1))],
              },
            ],
          })),
          footer: [],
        }),
        3,
      ],
    ];

  it.each(subjects)('keeps a %s where it stands when it fits there', (_kind, build, tall) => {
    // Room for the filler and the subject on one page: the mark changes nothing.
    const paginated = afterFiller(1, build('subject'), tall + 1);
    expect(paginated.pages).toHaveLength(1);
    expect(pagesOf(paginated, 'subject')).toStrictEqual([1]);
  });

  it.each(subjects)('moves a %s whole to a fresh page rather than cut it', (_kind, build, tall) => {
    // The page holds the filler and part of the subject, and a fresh page holds all of it.
    const paginated = afterFiller(2, build('subject'), tall + 1);
    expect(paginated.pages).toHaveLength(2);
    expect(pagesOf(paginated, 'subject')).toStrictEqual([2]);
    /* And the page it left is not empty: the filler stayed where it was. */
    expect(pagesOf(paginated, 'fill')).toStrictEqual([1]);
  });

  it.each(subjects.filter(([kind]) => kind !== 'image'))(
    'stops blocking once no page can hold the %s whole',
    (_kind, build, tall) => {
      // The third branch is the termination argument: the mark yields and the kind cuts as it would
      // have unmarked, rather than deferring for ever or refusing a printable document.
      const paginated = afterFiller(1, build('subject'), tall - 1);
      expect(pagesOf(paginated, 'subject').length).toBeGreaterThan(1);
    },
  );

  it('keeps a marked image atomic, and refuses one no page can hold', () => {
    // An image is not cut, so its third branch is the refusal it already had unmarked.
    const refused = refusalOfCut(() =>
      afterFiller(1, { type: 'image', id: 'subject', src: TINY_PNG, ...marked }, 2),
    );
    expect(refused.code).toBe('oversized-atomic-resource');
    expect(refused.details.nodeId).toBe('subject');
  });
});

describe('a mark on a repeated occurrence', () => {
  const iteration = (extra: Record<string, unknown>) => ({
    type: 'loop',
    id: 'rows',
    each: path('set.items'),
    as: 'item',
    ...extra,
    children: [
      { type: 'text', id: 'top', content: [{ kind: 'binding', value: path('item.n') }] },
      literalText('bottom', lines(1)),
    ],
  });

  it('keeps the two blocks of one iteration together, and does not group the iterations', () => {
    // Three lines a page and two lines an iteration: unmarked the second iteration is split across
    // the page edge; marked, it moves whole. A group of ALL iterations would be four lines and
    // would be deferred or split as one block, which is not what the mark asks for.
    const marks = paginateOnGrid(
      materializedOf({ page: gridPage(3), ...flow([iteration(marked)]) }, ITEMS),
    );
    expect(marks.pages).toHaveLength(2);
    expect(idsPerPage(marks)[0]).toStrictEqual(['root', 'rows', 'top', 'bottom']);
    expect(idsPerPage(marks)[1]).toStrictEqual(['root', 'rows', 'top', 'bottom']);
  });

  it('leaves an unmarked loop cut where the page edge falls', () => {
    const plain = paginateOnGrid(
      materializedOf({ page: gridPage(3), ...flow([iteration({})]) }, ITEMS),
    );
    expect(idsPerPage(plain)[0]).toStrictEqual(['root', 'top', 'bottom', 'top']);
  });

  it('keeps the branch of a marked condition whole', () => {
    const condition = {
      type: 'condition',
      id: 'when',
      when: { kind: 'literal', value: true },
      ...marked,
      children: [literalText('c-a', lines(1)), literalText('c-b', lines(1))],
    };
    const paginated = afterFiller(2, condition, 3);
    expect(pagesOf(paginated, 'c-a')).toStrictEqual([2]);
    expect(pagesOf(paginated, 'c-b')).toStrictEqual([2]);
  });
});

describe('a marked group of table rows', () => {
  const ledger = (groupMark: Record<string, unknown>, rowsPerItem: number) => ({
    type: 'table',
    id: 'ledger',
    columns: [{ id: 'c', width: 1, align: 'start' }],
    header: [],
    body: [
      {
        type: 'tableRowGroup',
        id: 'entries',
        each: path('set.items'),
        as: 'item',
        ...groupMark,
        rows: Array.from({ length: rowsPerItem }, (_unused, index) => ({
          type: 'tableRow',
          id: `row-${String(index)}`,
          cells: [{ columnId: 'c', children: [literalText(`cell-${String(index)}`, lines(1))] }],
        })),
      },
    ],
    footer: [],
  });

  it('keeps the rows of one item together, and never the rows of all items', () => {
    // Two items of two rows each, three lines a page. Marked, the second item moves whole to page
    // two; a group over the whole sequence would be four rows and would behave as one block.
    const paginated = paginateOnGrid(
      materializedOf({ page: gridPage(3), ...flow([ledger(marked, 2)]) }, ITEMS),
    );
    expect(paginated.pages).toHaveLength(2);
    expect(idsPerPage(paginated)[0]).toStrictEqual([
      'root',
      'ledger',
      'row-0',
      'cell-0',
      'row-1',
      'cell-1',
    ]);
    expect(idsPerPage(paginated)[1]).toStrictEqual([
      'root',
      'ledger',
      'row-0',
      'cell-0',
      'row-1',
      'cell-1',
    ]);
  });

  it('leaves an unmarked group cut where the page edge falls', () => {
    const paginated = paginateOnGrid(
      materializedOf({ page: gridPage(3), ...flow([ledger({}, 2)]) }, ITEMS),
    );
    expect(idsPerPage(paginated)[0]).toHaveLength(8);
  });

  it('stops blocking when no page can hold one item, and cuts row by row', () => {
    // Four rows an item on a page of three lines: the group yields, and the rows take the ordinary
    // policy -- each whole where it fits, the next on the page after.
    const paginated = paginateOnGrid(
      materializedOf({ page: gridPage(3), ...flow([ledger(marked, 4)]) }, ITEMS),
    );
    expect(paginated.pages.length).toBeGreaterThan(2);
    for (const ids of idsPerPage(paginated)) {
      expect(ids.filter((id) => id.startsWith('row-')).length).toBeLessThanOrEqual(3);
    }
  });
});

describe('a mark a parent could not honour', () => {
  it('is still honoured by the descendant that can', () => {
    // The container is taller than any page, so its own mark falls back. Its marked child is not
    // silenced by that: it is still moved whole rather than cut across the edge.
    const paginated = paginateOnGrid(
      materializedOf(
        {
          page: gridPage(3),
          ...flow([
            {
              type: 'container',
              id: 'outer',
              ...marked,
              children: [
                literalText('lead', lines(2)),
                { ...literalText('totals', lines(2)), ...marked },
                literalText('tail', lines(2)),
              ],
            },
          ]),
        },
        {},
      ),
    );
    expect(pagesOf(paginated, 'totals')).toHaveLength(1);
  });

  it('does not retry the whole occurrence on every page once it has fallen back', () => {
    // A cursor inside the block means the mark is spent: re-deciding would defer the same block
    // for ever, and every page after the first would consume nothing.
    const paginated = paginateOnGrid(
      materializedOf(
        { page: gridPage(2), ...flow([{ ...literalText('long', lines(6)), ...marked }]) },
        {},
      ),
    );
    expect(paginated.pages).toHaveLength(3);
    for (const page of paginated.pages) {
      expect(page.root.length).toBeGreaterThan(0);
    }
  });
});

describe('a mark inside a page band', () => {
  it('changes nothing: a band is atomic and stays where its domain puts it', () => {
    const band = (extra: Record<string, unknown>) => [
      {
        on: 'every',
        content: {
          type: 'container',
          id: 'foot',
          ...extra,
          children: [literalText('foot-line', lines(1))],
        },
      },
    ];
    const cuts = (extra: Record<string, unknown>) =>
      idsPerPage(
        paginateOnGrid(
          multiPageOf(
            {
              page: { ...gridPage(3), footer: band(extra) },
              ...flow([literalText('body', lines(4))]),
            },
            {},
          ),
        ),
      );
    expect(cuts(marked)).toStrictEqual(cuts({}));
  });

  it('keeps the band refusal for one that is taller than the printable area', () => {
    const refused = refusalOfCut(() =>
      paginateOnGrid(
        multiPageOf(
          {
            page: {
              ...gridPage(2),
              footer: [
                {
                  on: 'every',
                  content: {
                    type: 'container',
                    id: 'foot',
                    ...marked,
                    children: [literalText('foot-line', lines(4))],
                  },
                },
              ],
            },
            ...flow([literalText('body', lines(1))]),
          },
          {},
        ),
      ),
    );
    expect(refused.code).toBe('page-band-overflow');
    expect(refused.details.region).toBe('footer');
  });
});
