import type { EvaluationScope, PaginationResult } from '@openview/core';
import { describe, expect, it } from 'vitest';
import { gridPage, literalText, paginationOf } from '../../__tests__/fixtures.js';

const flow = (children: readonly Record<string, unknown>[]): Record<string, unknown> => ({
  root: { type: 'container', id: 'root', children },
});

const path = (value: string) => ({ kind: 'path', path: value });

const COLUMNS = [{ id: 'amount', width: 1, align: 'end' }];

const cellText = (id: string, content: readonly unknown[]) => ({
  columnId: 'amount',
  children: [{ type: 'text', id, content }],
});

/** A table whose detail row repeats once per entry and declares what each entry is worth. */
const ledgerTable = (): Record<string, unknown> => ({
  type: 'table',
  id: 'ledger',
  columns: COLUMNS,
  header: [
    { type: 'tableRow', id: 'head', cells: [cellText('h', [{ kind: 'literal', text: 'A' }])] },
  ],
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
    },
  ],
  footer: [],
});

const ledgerOf = (...amounts: readonly number[]): EvaluationScope => ({
  ledger: { entries: amounts.map((amount) => ({ amount })) },
});

const ledgerResult = (amounts: readonly number[], lines = 4): PaginationResult =>
  paginationOf({ page: gridPage(lines), ...flow([ledgerTable()]) }, ledgerOf(...amounts));

/** The ranks of the entries whose row closed on each page, read from the ancestry of the address. */
const closedOn = (result: PaginationResult): readonly (readonly number[])[] =>
  result.pages.map((page) =>
    page.report.completedBy.map((one) => one.iterations.at(-1)?.index ?? -1),
  );

describe('the report boundary of a page', () => {
  it('carries nothing into the first page and the raw sum into every other', () => {
    /* Four grid lines a page, one taken by the repeated header: three detail rows per page. */
    const result = ledgerResult([1, 2, 3, 10, 20, 30, 100, 200, 300]);
    expect(result.pages.map((page) => page.report.incoming)).toStrictEqual([0, 6, 66]);
  });

  it('names the rows that finished on each page, in contribution order', () => {
    const result = ledgerResult([1, 2, 3, 10, 20, 30]);
    expect(closedOn(result)).toStrictEqual([
      [0, 1, 2],
      [3, 4, 5],
    ]);
    for (const page of result.pages) {
      for (const one of page.report.completedBy) {
        expect(one.nodeId).toBe('entry-row');
        expect(one.nodeType).toBe('tableRow');
      }
    }
  });

  it('sums exactly the rows it named, page after page', () => {
    const amounts = [1, 2, 3, 10, 20, 30, 100, 200, 300];
    const result = ledgerResult(amounts);
    let carried = 0;
    for (const page of result.pages) {
      expect(page.report.incoming).toBe(carried);
      for (const one of page.report.completedBy) {
        carried += amounts[one.iterations.at(-1)?.index ?? -1] ?? Number.NaN;
      }
    }
    expect(carried).toBe(amounts.reduce((total, one) => total + one, 0));
  });

  it('counts a row cut across pages once, on the page its last fragment reaches', () => {
    /* The single cell holds four wrapped lines, and the flow is two lines tall. */
    const spanning = {
      type: 'table',
      id: 'ledger',
      columns: COLUMNS,
      header: [],
      body: [
        {
          type: 'tableRow',
          id: 'wide',
          pageReport: { value: { kind: 'literal', value: 7 } },
          cells: [{ columnId: 'amount', children: [literalText('long', 'y'.repeat(80))] }],
        },
        {
          type: 'tableRow',
          id: 'after',
          pageReport: { value: { kind: 'literal', value: 5 } },
          cells: [{ columnId: 'amount', children: [literalText('short', 'z')] }],
        },
      ],
      footer: [],
    };
    const result = paginationOf({ page: gridPage(2), ...flow([spanning]) }, {});
    const named = result.pages.map((page) => page.report.completedBy.map((one) => one.nodeId));
    expect(named).toStrictEqual([[], ['wide'], ['after']]);
    expect(result.pages.map((page) => page.report.incoming)).toStrictEqual([0, 0, 7]);
  });

  it('carries the sum raw, with every decimal the contributions produced', () => {
    /* Each marker declares the rounding it is written at, so the boundary a caller reads is the
       unrounded total the markers of that page were written from. */
    const result = ledgerResult([1.005, 2.0025, 3.125, 10, 20, 30]);
    expect(result.pages.map((page) => page.report.incoming)).toStrictEqual([0, 6.1325]);
  });

  it('carries nothing and names nobody when no row declares a contribution', () => {
    const result = paginationOf(
      { page: gridPage(2), ...flow([literalText('long', 'x'.repeat(60))]) },
      {},
    );
    expect(result.pages.map((page) => page.report.incoming)).toStrictEqual([0, 0]);
    expect(result.pages.every((page) => page.report.completedBy.length === 0)).toBe(true);
  });

  it('publishes the identity of a contribution and never its amount', () => {
    const result = ledgerResult([1234.56, 2]);
    const manifest = JSON.stringify(result.pages.map((page) => page.report.completedBy));
    expect(manifest).not.toContain('1234.56');
    expect(manifest).not.toContain('value');
  });
});
