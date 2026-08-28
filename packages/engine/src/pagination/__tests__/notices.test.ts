import type { EvaluationScope, PaginationResult } from '@openview/core';
import { describe, expect, it } from 'vitest';
import { gridPage, literalText, paginationOf } from '../../__tests__/fixtures.js';

const flow = (children: readonly Record<string, unknown>[]): Record<string, unknown> => ({
  root: { type: 'container', id: 'root', children },
});

/** Twenty characters is one line of the grid, so a block of `n` lines is `n` of these. */
const lines = (count: number): string => 'x'.repeat(count * 20);

const path = (value: string) => ({ kind: 'path', path: value });

const marked = { keepTogether: true };

const COLUMNS = [{ id: 'only', width: 1, align: 'start' }];

const cell = (id: string, text: string) => ({
  columnId: 'only',
  children: [literalText(id, text)],
});

/** The fallbacks a result reports, as `nodeId` plus the pages the occurrence really spans. */
const fallbacksOf = (result: PaginationResult): readonly string[] =>
  result.notices.map((notice) => `${notice.occurrence.nodeId}:${notice.pages.join(',')}`);

/**
 * One filler block of `fill` lines, then the subject, on a page of `height` lines.
 *
 * The subject therefore starts part way down the first page, which is where "fits here", "fits on a
 * page of its own" and "fits nowhere" are told apart.
 */
const afterFiller = (
  fill: number,
  subject: Record<string, unknown>,
  height: number,
  data: EvaluationScope = {},
): PaginationResult =>
  paginationOf(
    { page: gridPage(height), ...flow([literalText('fill', lines(fill)), subject]) },
    data,
  );

describe('a keep-together fallback notice', () => {
  it('is absent when the marked block fits in what is left of the page', () => {
    expect(fallbacksOf(afterFiller(1, literalText('kept', lines(2)), 4))).toStrictEqual([]);
  });

  it('is absent when the marked block was merely deferred to a page of its own', () => {
    const result = afterFiller(3, { ...literalText('kept', lines(3)), ...marked }, 4);
    expect(result.pages).toHaveLength(2);
    /* Deferred and painted whole: the mark was honoured, so nothing is reported. */
    expect(
      result.pages[1]?.placements.find((one) => one.occurrence.nodeId === 'kept')?.fragment,
    ).toBe('whole');
    expect(fallbacksOf(result)).toStrictEqual([]);
  });

  it('names the marked block that no page could hold, and the pages it was spread over', () => {
    /* One filler line leaves three of the four, and the block is six: it spills onto page two. */
    const result = afterFiller(1, { ...literalText('kept', lines(6)), ...marked }, 4);
    expect(fallbacksOf(result)).toStrictEqual(['kept:1,2']);
    expect(result.notices[0]?.code).toBe('keep-together-fallback');
    expect(result.notices[0]?.occurrence.nodeType).toBe('text');
  });

  it('reports the parent that fell back and leaves an honoured descendant alone', () => {
    const result = afterFiller(
      0,
      {
        type: 'container',
        id: 'group',
        ...marked,
        children: [literalText('a', lines(2)), { ...literalText('b', lines(2)), ...marked }],
      },
      3,
    );
    expect(fallbacksOf(result)).toStrictEqual(['group:1,2']);
  });

  it('reports both when the descendant is itself too tall, parent first', () => {
    const result = afterFiller(
      0,
      {
        type: 'container',
        id: 'group',
        ...marked,
        children: [{ ...literalText('inner', lines(6)), ...marked }],
      },
      3,
    );
    expect(fallbacksOf(result)).toStrictEqual(['group:1,2', 'inner:1,2']);
  });

  it('reports a marked row group once, under the group address, never once per row', () => {
    const table = {
      type: 'table',
      id: 'ledger',
      columns: COLUMNS,
      header: [],
      body: [
        {
          type: 'tableRowGroup',
          id: 'entries',
          each: path('set.items'),
          as: 'entry',
          ...marked,
          rows: [
            { type: 'tableRow', id: 'top', cells: [cell('top-t', lines(1))] },
            { type: 'tableRow', id: 'bottom', cells: [cell('bottom-t', lines(1))] },
          ],
        },
      ],
      footer: [],
    };
    /* Each group is two lines tall and a page offers one, so no page can hold one whole. */
    const result = paginationOf(
      { page: gridPage(1), ...flow([table]) },
      {
        set: { items: [{ n: 1 }, { n: 2 }] },
      },
    );
    expect(fallbacksOf(result)).toStrictEqual(['entries:1,2', 'entries:3,4']);
    expect(result.notices.map((one) => one.occurrence.nodeType)).toStrictEqual([
      'tableRowGroup',
      'tableRowGroup',
    ]);
    expect(result.notices.map((one) => one.occurrence.iterations.at(-1)?.index)).toStrictEqual([
      0, 1,
    ]);
  });

  it('reports a marked row that had to be cut down its columns', () => {
    const table = {
      type: 'table',
      id: 'ledger',
      columns: COLUMNS,
      header: [],
      body: [
        {
          type: 'tableRow',
          id: 'wide',
          ...marked,
          cells: [cell('long', lines(4))],
        },
      ],
      footer: [],
    };
    const result = paginationOf({ page: gridPage(2), ...flow([table]) }, {});
    expect(fallbacksOf(result)).toStrictEqual(['wide:1,2']);
    expect(result.notices[0]?.occurrence.nodeType).toBe('tableRow');
  });

  it('reports nothing for a mark inside a band, which is painted whole or not at all', () => {
    const band = {
      on: 'every',
      content: {
        type: 'container',
        id: 'top',
        ...marked,
        children: [{ ...literalText('top-t', lines(1)), ...marked }],
      },
    };
    const result = paginationOf(
      { page: gridPage(4, { header: [band] }), ...flow([literalText('long', lines(6))]) },
      {},
    );
    expect(result.pages.length).toBeGreaterThan(1);
    expect(fallbacksOf(result)).toStrictEqual([]);
  });

  it('reports one notice per occurrence, not one per fragment', () => {
    const result = afterFiller(0, { ...literalText('kept', lines(9)), ...marked }, 3);
    expect(result.pages).toHaveLength(3);
    expect(result.notices).toHaveLength(1);
    expect(result.notices[0]?.pages).toStrictEqual([1, 2, 3]);
  });

  it('names one address per repeated occurrence of the same declaration', () => {
    const loop = {
      type: 'loop',
      id: 'each',
      each: path('set.items'),
      as: 'item',
      ...marked,
      children: [literalText('body', lines(4))],
    };
    const result = paginationOf(
      { page: gridPage(3), ...flow([loop]) },
      {
        set: { items: [{ n: 1 }, { n: 2 }] },
      },
    );
    expect(result.notices.map((one) => one.occurrence.nodeId)).toStrictEqual(['each', 'each']);
    expect(result.notices.map((one) => one.occurrence.iterations.at(-1)?.index)).toStrictEqual([
      0, 1,
    ]);
    expect(new Set(result.notices.map((one) => JSON.stringify(one.occurrence))).size).toBe(2);
  });
});
