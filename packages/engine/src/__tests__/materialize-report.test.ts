import type { EvaluationScope } from '@openview/core';
import { describe, expect, it } from 'vitest';
import { reachableOccurrences } from '../document/bands.js';
import { materializeDocument } from '../document/materialize.js';
import type {
  MaterialBlock,
  MaterialDocument,
  MaterialRow,
  MaterialTable,
} from '../document/types.js';
import { DocumentRenderError } from '../errors.js';
import { templateOf } from './fixtures.js';

const flow = (children: readonly Record<string, unknown>[]): Record<string, unknown> => ({
  root: { type: 'container', id: 'root', children },
});

const path = (value: string) => ({ kind: 'path', path: value });

const COLUMNS = [{ id: 'amount', width: 1, align: 'end' }];

const cell = (id: string, content: readonly unknown[]) => ({
  columnId: 'amount',
  children: [{ type: 'text', id, content }],
});

const ENTRIES: EvaluationScope = {
  ledger: {
    entries: [{ amount: 10 }, { amount: 20 }, { amount: 30 }],
    label: 'ledger',
  },
};

function boundOf(
  overrides: Record<string, unknown>,
  data: EvaluationScope = ENTRIES,
): MaterialDocument {
  return materializeDocument(templateOf(overrides), data, reachableOccurrences(2)).document;
}

/** The blocks of the root container, which every fixture below wraps its flow in. */
function rootChildren(document: MaterialDocument): readonly MaterialBlock[] {
  const [root] = document.root;
  return root?.kind === 'container' ? root.children : [];
}

function tableOf(document: MaterialDocument): MaterialTable {
  const [table] = rootChildren(document);
  if (table?.kind !== 'table') {
    throw new Error('the fixture should hold a table');
  }
  return table;
}

/** A table whose detail row is repeated once per entry and declares what each entry is worth. */
function ledgerTable(
  groupExtra: Record<string, unknown> = {},
  rowExtra: Record<string, unknown> = { pageReport: { value: path('entry.amount') } },
  rows = 1,
): Record<string, unknown> {
  return {
    type: 'table',
    id: 'ledger',
    columns: COLUMNS,
    header: [{ type: 'tableRow', id: 'head', cells: [cell('h', [])] }],
    body: [
      {
        type: 'tableRowGroup',
        id: 'entries',
        each: path('ledger.entries'),
        as: 'entry',
        ...groupExtra,
        rows: Array.from({ length: rows }, (_unused, index) => ({
          type: 'tableRow',
          id: `entry-row-${String(index)}`,
          ...rowExtra,
          cells: [cell(`entry-cell-${String(index)}`, [])],
        })),
      },
    ],
    footer: [],
  };
}

function refusalOfBinding(run: () => unknown): DocumentRenderError {
  try {
    run();
  } catch (error) {
    if (error instanceof DocumentRenderError) {
      return error;
    }
    throw error;
  }
  throw new Error('this materialisation was accepted; the contract changed');
}

describe('a contribution evaluated once per occurrence', () => {
  it('reads the scope of the row it belongs to, not the root one', () => {
    const table = tableOf(boundOf(flow([ledgerTable()])));
    expect(table.body.map((row) => row.pageReport?.value)).toStrictEqual([10, 20, 30]);
  });

  it('ranks the occurrences in materialisation order, from zero and without a gap', () => {
    const table = tableOf(boundOf(flow([ledgerTable()])));
    expect(table.body.map((row) => row.pageReport?.order)).toStrictEqual([0, 1, 2]);
  });

  it('files the contribution under the key of the row that produced it', () => {
    const table = tableOf(boundOf(flow([ledgerTable()])));
    for (const row of table.body) {
      expect(row.pageReport?.key).toBe(row.key);
    }
  });

  it('leaves a row that declares none with no contribution at all', () => {
    const table = tableOf(boundOf(flow([ledgerTable({}, {})])));
    expect(table.body.map((row) => row.pageReport)).toStrictEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(table.header[0]?.pageReport).toBeUndefined();
  });

  it('spends the shared budget, so a contribution is one more step and not a free one', () => {
    // The ceiling belongs to the document, not to a position in it: the steps a contribution costs
    // are steps the cells and the bands no longer have.
    const withContribution = materializeDocument(
      templateOf(flow([ledgerTable()])),
      ENTRIES,
      reachableOccurrences(2),
    );
    const without = materializeDocument(
      templateOf(flow([ledgerTable({}, {})])),
      ENTRIES,
      reachableOccurrences(2),
    );
    expect(withContribution.budget.spent.steps).toBeGreaterThan(without.budget.spent.steps);

    /* And the ceiling really stops it: three entries do not fit in a budget of two steps. */
    expect(() =>
      materializeDocument(templateOf(flow([ledgerTable()])), ENTRIES, reachableOccurrences(2), {
        maxSteps: 2,
      }),
    ).toThrow(DocumentRenderError);
  });

  it('ranks two renders of the same template and data identically', () => {
    const once = tableOf(boundOf(flow([ledgerTable()])));
    const twice = tableOf(boundOf(flow([ledgerTable()])));
    expect(twice.body.map((row) => row.pageReport)).toStrictEqual(
      once.body.map((row) => row.pageReport),
    );
  });
});

describe('a contribution that cannot be a number', () => {
  const refusedFor = (value: unknown) =>
    refusalOfBinding(() =>
      boundOf(flow([ledgerTable({}, { pageReport: { value: path('ledger.label') } })]), {
        ledger: { entries: [{ amount: 1 }], label: value },
      }),
    );

  it.each([
    ['a string', 'twelve'],
    ['a boolean', true],
    ['a sequence', [1, 2]],
    ['an object', { amount: 1 }],
  ])('refuses %s, naming its category and never its value', (_title, value) => {
    const refused = refusedFor(value);
    expect(refused.code).toBe('page-report-refused');
    expect(refused.details.nodeId).toBe('entry-row-0');
    expect(refused.details.actualType).toBeDefined();
    expect(refused.message).not.toContain(String(value));
  });

  it('refuses an absent value rather than treating it as nothing to add', () => {
    const refused = refusedFor(undefined);
    expect(refused.code).toBe('page-report-refused');
  });

  it('refuses a number that is not finite', () => {
    const refused = refusalOfBinding(() =>
      boundOf(flow([ledgerTable()]), { ledger: { entries: [{ amount: 1 / 0 }] } }),
    );
    expect(refused.code).toBe('page-report-refused');
    expect(refused.message).not.toContain('Infinity');
  });

  it('keeps the more precise refusal when the formula itself failed', () => {
    // A formula that `@openview/core` refuses keeps its own code and its diagnostics: the new
    // refusal names a value that cannot be a number, not a formula that never produced one.
    const refused = refusalOfBinding(() =>
      boundOf(
        flow([
          ledgerTable(
            {},
            {
              pageReport: {
                value: {
                  kind: 'arithmetic',
                  op: 'div',
                  left: { kind: 'literal', value: 1 },
                  right: { kind: 'literal', value: 0 },
                },
              },
            },
          ),
        ]),
      ),
    );
    expect(refused.code).toBe('expression-refused');
    expect(refused.details.diagnostics?.length ?? 0).toBeGreaterThan(0);
  });

  it('refuses a path that names nothing, rather than counting it as zero', () => {
    // An absent value is not "adds nothing": a blank in an accounting total is exactly the silence
    // this contract exists to refuse.
    const refused = refusalOfBinding(() =>
      boundOf(flow([ledgerTable({}, { pageReport: { value: path('ledger.missing') } })])),
    );
    expect(refused.code).toBe('page-report-refused');
  });

  it('refuses a contribution declared inside a page band, which repeats', () => {
    const refused = refusalOfBinding(() =>
      boundOf({
        page: {
          sheet: { width: 210, height: 297 },
          margins: { top: 10, right: 10, bottom: 10, left: 10 },
          header: [
            {
              on: 'every',
              content: { type: 'container', id: 'band', children: [ledgerTable()] },
            },
          ],
          footer: [],
        },
        ...flow([]),
      }),
    );
    expect(refused.code).toBe('page-report-refused');
    expect(refused.details.region).toBe('header');
    expect(refused.details.nodeId).toBe('entry-row-0');
  });
});

describe('an occurrence a mark asks to keep whole', () => {
  const marked = { keepTogether: true };
  const twoBlocks = (extra: Record<string, unknown>) => [
    {
      type: 'loop',
      id: 'rows',
      each: path('ledger.entries'),
      as: 'entry',
      ...extra,
      children: [
        { type: 'text', id: 'a', content: [{ kind: 'binding', value: path('entry.amount') }] },
        { type: 'text', id: 'b', content: [{ kind: 'literal', text: 'after' }] },
      ],
    },
  ];

  it('wraps each iteration of a marked loop, and never all of them at once', () => {
    const children = rootChildren(boundOf(flow(twoBlocks(marked))));
    expect(children).toHaveLength(3);
    for (const group of children) {
      expect(group.kind).toBe('container');
      expect(group.keepTogether).toBe(true);
      expect(group.nodeId).toBe('rows');
      expect(group.box).toBeUndefined();
      expect(
        group.kind === 'container' && group.children.map((child) => child.nodeId),
      ).toStrictEqual(['a', 'b']);
    }
  });

  it('leaves an unmarked loop flattened, so no document pays for a boundary nobody reads', () => {
    const children = rootChildren(boundOf(flow(twoBlocks({}))));
    expect(children.map((child) => child.nodeId)).toStrictEqual(['a', 'b', 'a', 'b', 'a', 'b']);
  });

  it('produces no group for a loop over an empty sequence', () => {
    expect(
      rootChildren(boundOf(flow(twoBlocks(marked)), { ledger: { entries: [] } })),
    ).toHaveLength(0);
  });

  it('wraps a condition that holds, and produces nothing for one that does not', () => {
    const condition = (when: unknown) => [
      {
        type: 'condition',
        id: 'maybe',
        when,
        keepTogether: true,
        children: [{ type: 'text', id: 'a', content: [] }],
      },
    ];
    const held = rootChildren(boundOf(flow(condition({ kind: 'literal', value: true }))));
    expect(held).toHaveLength(1);
    expect(held[0]?.nodeId).toBe('maybe');
    expect(rootChildren(boundOf(flow(condition({ kind: 'literal', value: false }))))).toHaveLength(
      0,
    );
  });
});

describe('a marked group of table rows', () => {
  const groups = (rows: readonly MaterialRow[]) =>
    rows.map((row) => row.keptGroup?.key ?? 'none').join(' ');

  it('gives each item its own boundary, spanning the rows that item produced', () => {
    const table = tableOf(boundOf(flow([ledgerTable({ keepTogether: true }, {}, 2)])));

    expect(table.body).toHaveLength(6);
    /* Three distinct occurrences of two rows, never one occurrence of six. */
    expect(new Set(table.body.map((row) => row.keptGroup?.key)).size).toBe(3);
    expect(table.body.map((row) => row.keptGroup?.rowCount)).toStrictEqual([2, 2, 2, 2, 2, 2]);
    expect(table.body.map((row) => row.keptGroup?.firstRow)).toStrictEqual([0, 0, 2, 2, 4, 4]);
    expect(groups(table.body.slice(0, 2)).split(' ')[0]).toBe(
      groups(table.body.slice(0, 2)).split(' ')[1],
    );
  });

  it('names the declaration the boundary came from, and the item it repeats for', () => {
    const table = tableOf(boundOf(flow([ledgerTable({ keepTogether: true }, {}, 1)])));
    expect(table.body.map((row) => row.keptGroup?.nodeId)).toStrictEqual([
      'entries',
      'entries',
      'entries',
    ]);
    expect(table.body.map((row) => row.keptGroup?.path.at(-1))).toStrictEqual([0, 1, 2]);
  });

  it('leaves an unmarked group as a plain sequence of rows', () => {
    const table = tableOf(boundOf(flow([ledgerTable({}, {}, 2)])));
    expect(table.body.every((row) => row.keptGroup === undefined)).toBe(true);
  });

  it('counts the rows a group starts at from the whole body, past a fixed row before it', () => {
    // A body may mix fixed rows and groups, and a boundary indexes the flattened sequence: an
    // offset taken from the entry alone would point the paginator at the wrong row.
    const table = tableOf(
      boundOf(
        flow([
          {
            type: 'table',
            id: 'ledger',
            columns: COLUMNS,
            header: [],
            body: [
              { type: 'tableRow', id: 'opening', cells: [cell('o', [])] },
              {
                type: 'tableRowGroup',
                id: 'entries',
                each: path('ledger.entries'),
                as: 'entry',
                keepTogether: true,
                rows: [{ type: 'tableRow', id: 'entry-row', cells: [cell('c', [])] }],
              },
            ],
            footer: [],
          },
        ]),
      ),
    );
    expect(table.body.map((row) => row.keptGroup?.firstRow)).toStrictEqual([undefined, 1, 2, 3]);
  });
});
