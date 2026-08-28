import type { EvaluationScope, OccurrenceReference } from '@openview/core';
import { describe, expect, it } from 'vitest';
import { materializedOf, multiPageOf, SAMPLE_DATA } from '../../__tests__/fixtures.js';
import { DocumentRenderError } from '../../errors.js';
import { addressKey, occurrenceOf } from '../occurrence.js';
import type { MaterialBlock, MaterialDocument, MaterialPageBand, MaterialRow } from '../types.js';

const columns = [
  { id: 'left', width: 30, align: 'start' },
  { id: 'middle', width: 30, align: 'start' },
  { id: 'right', width: 40, align: 'end' },
] as const;

const text = (id: string, path: string): Record<string, unknown> => ({
  type: 'text',
  id,
  content: [{ kind: 'binding', value: { kind: 'path', path } }],
});

const flow = (children: readonly Record<string, unknown>[]): Record<string, unknown> => ({
  root: { type: 'container', id: 'root', children },
});

/** A predicate that holds on the sample dataset, so a condition is exercised rather than refused. */
const HAS_LABEL = {
  kind: 'not',
  operand: { kind: 'isEmpty', operand: { kind: 'path', path: 'sample.label' } },
};

/** Every occurrence the document holds, in the order the materialisation produced them. */
function addressesOf(document: MaterialDocument): readonly OccurrenceReference[] {
  const found: OccurrenceReference[] = [];

  const rows = (list: readonly MaterialRow[]): void => {
    for (const row of list) {
      if (row.keptGroup !== undefined) {
        found.push(occurrenceOf(row.keptGroup));
      }
      found.push(occurrenceOf(row));
      for (const cell of row.cells) {
        blocks(cell.children);
      }
    }
  };

  function blocks(list: readonly MaterialBlock[]): void {
    for (const block of list) {
      found.push(occurrenceOf(block));
      if (block.kind === 'container') {
        blocks(block.children);
      }
      if (block.kind === 'table') {
        rows(block.header);
        rows(block.body);
        rows(block.footer);
      }
      if (block.kind === 'grid') {
        for (const item of block.items) {
          blocks([item.content]);
        }
      }
    }
  }

  const bands = (list: readonly MaterialPageBand[]): void => {
    for (const band of list) {
      blocks([band.content]);
    }
  };

  for (const layer of document.backgroundLayers) {
    blocks([layer.content]);
  }
  bands(document.headerBands);
  blocks(document.root);
  bands(document.footerBands);
  for (const layer of document.foregroundLayers) {
    blocks([layer.content]);
  }
  return found;
}

const keysOf = (document: MaterialDocument): readonly string[] =>
  addressesOf(document).map(addressKey);

/** The occurrences one declaration id produced, whatever the subtree it was declared in. */
const named = (document: MaterialDocument, nodeId: string): readonly OccurrenceReference[] =>
  addressesOf(document).filter((occurrence) => occurrence.nodeId === nodeId);

/**
 * Two subtrees sharing one id, a loop inside a loop, and a row group under both of them.
 *
 * The shape probe P1 asks for: everything that could make two occurrences collide is present at
 * once, so a single address that is not built from a declaration path plus an ancestry collides.
 */
const twins = flow([
  {
    type: 'loop',
    id: 'outer',
    each: { kind: 'path', path: 'sample.items' },
    as: 'line',
    children: [
      { type: 'container', id: 'twin', children: [text('leaf', 'line.sku')] },
      {
        type: 'loop',
        id: 'inner',
        each: { kind: 'path', path: 'sample.items' },
        as: 'other',
        children: [text('leaf', 'other.sku')],
      },
      {
        type: 'table',
        id: 'ledger',
        columns,
        header: [],
        body: [
          {
            type: 'tableRowGroup',
            id: 'entries',
            each: { kind: 'path', path: 'sample.items' },
            as: 'entry',
            keepTogether: true,
            rows: [
              {
                type: 'tableRow',
                id: 'entry-row',
                cells: [{ columnId: 'left', children: [text('leaf', 'entry.sku')] }],
              },
            ],
          },
        ],
        footer: [],
      },
    ],
  },
  { type: 'container', id: 'twin', children: [text('leaf', 'sample.label')] },
]);

describe('an occurrence address', () => {
  it('names the declaration and no repetition for a block outside every loop', () => {
    const [only] = named(materializedOf(flow([text('alone', 'sample.label')])), 'alone');
    expect(only?.declarationPath).toStrictEqual(['root', 'children', 0]);
    expect(only?.iterations).toStrictEqual([]);
    expect(only?.nodeType).toBe('text');
  });

  it('keeps one declaration path per loop item and separates them by rank alone', () => {
    const document = materializedOf(
      flow([
        {
          type: 'loop',
          id: 'each-line',
          each: { kind: 'path', path: 'sample.items' },
          as: 'line',
          children: [text('sku', 'line.sku')],
        },
      ]),
    );
    const occurrences = named(document, 'sku');
    expect(occurrences.map((one) => one.declarationPath)).toStrictEqual([
      ['root', 'children', 0, 'children', 0],
      ['root', 'children', 0, 'children', 0],
    ]);
    expect(occurrences.map((one) => one.iterations.map((step) => step.index))).toStrictEqual([
      [0],
      [1],
    ]);
  });

  it('orders the ancestry from the outermost repetition to the innermost', () => {
    const document = materializedOf(twins);
    const innerLoopLeaf = ['root', 'children', 0, 'children', 1, 'children', 0];
    const inner = named(document, 'leaf').filter(
      (one) => JSON.stringify(one.declarationPath) === JSON.stringify(innerLoopLeaf),
    );
    /* Two items outside times two inside: four leaves, ranked outer-then-inner. */
    expect(inner.map((one) => one.iterations.map((step) => step.index))).toStrictEqual([
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ]);
    const [first] = inner;
    expect(first?.iterations[0]?.declarationPath).toStrictEqual(['root', 'children', 0]);
    expect(first?.iterations[1]?.declarationPath).toStrictEqual([
      'root',
      'children',
      0,
      'children',
      1,
    ]);
  });

  it('adds no rank for a condition, and keeps the ranks around it', () => {
    const document = materializedOf(
      flow([
        {
          type: 'loop',
          id: 'each-line',
          each: { kind: 'path', path: 'sample.items' },
          as: 'line',
          children: [
            {
              type: 'condition',
              id: 'when-any',
              when: HAS_LABEL,
              children: [text('kept', 'line.sku')],
            },
          ],
        },
      ]),
    );
    const occurrences = named(document, 'kept');
    expect(occurrences.map((one) => one.iterations.length)).toStrictEqual([1, 1]);
    expect(occurrences.map((one) => one.declarationPath)).toStrictEqual([
      ['root', 'children', 0, 'children', 0, 'children', 0],
      ['root', 'children', 0, 'children', 0, 'children', 0],
    ]);
  });

  it('reports a marked loop as a loop occurrence, one per item', () => {
    const document = materializedOf(
      flow([
        {
          type: 'loop',
          id: 'each-line',
          each: { kind: 'path', path: 'sample.items' },
          as: 'line',
          keepTogether: true,
          children: [text('sku', 'line.sku')],
        },
      ]),
    );
    const wrappers = named(document, 'each-line');
    expect(wrappers).toHaveLength(2);
    expect(wrappers.map((one) => one.nodeType)).toStrictEqual(['loop', 'loop']);
    expect(wrappers.map((one) => one.iterations.at(-1)?.index)).toStrictEqual([0, 1]);
  });

  it('reports a marked condition as a condition occurrence', () => {
    const document = materializedOf(
      flow([
        {
          type: 'condition',
          id: 'when-any',
          when: HAS_LABEL,
          keepTogether: true,
          children: [text('kept', 'sample.label')],
        },
      ]),
    );
    expect(named(document, 'when-any').map((one) => one.nodeType)).toStrictEqual(['condition']);
  });

  it('addresses a row group and every row it produced', () => {
    const document = materializedOf(twins);
    const groups = named(document, 'entries');
    /* One group occurrence per item, and the group repeats under each item of the outer loop. */
    expect(groups.map((one) => one.nodeType)).toStrictEqual(Array(4).fill('tableRowGroup'));
    expect(groups.map((one) => one.iterations.map((step) => step.index))).toStrictEqual([
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ]);
    const rows = named(document, 'entry-row');
    expect(rows.map((one) => one.nodeType)).toStrictEqual(Array(4).fill('tableRow'));
    expect(rows[0]?.declarationPath.at(-2)).toBe('rows');
  });

  it('tells duplicated ids apart by the declaration each came from', () => {
    const document = materializedOf(twins);
    const containers = named(document, 'twin').map((one) => one.declarationPath);
    expect(new Set(containers.map((path) => JSON.stringify(path))).size).toBe(2);
  });

  it('is unique across a whole render, ids and loops included', () => {
    const document = materializedOf(twins);
    /* The address itself, not only the key derived from it: what the contract publishes is what has
       to separate two occurrences, whatever a grouping helper happens to hash. */
    const addresses = addressesOf(document).map((one) => JSON.stringify(one));
    expect(addresses.length).toBeGreaterThan(20);
    expect(new Set(addresses).size).toBe(addresses.length);

    const keys = keysOf(document);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('separates two occurrences that a rank alone would confuse', () => {
    /* The leaf of the inner loop and the leaf of the row group sit under the same outer item and
       carry the same two ranks. Only the declarations they name tell them apart. */
    const twoRanks = named(materializedOf(twins), 'leaf').filter(
      (one) => one.iterations.length === 2,
    );
    const ranks = twoRanks.map((one) => one.iterations.map((step) => step.index).join(','));
    expect(new Set(ranks).size).toBeLessThan(twoRanks.length);
    expect(new Set(twoRanks.map((one) => addressKey(one))).size).toBe(twoRanks.length);
  });

  it('is identical between two materialisations of the same template and data', () => {
    expect(addressesOf(materializedOf(twins))).toStrictEqual(addressesOf(materializedOf(twins)));
  });

  it('produces no occurrence for an empty sequence or a false condition', () => {
    const empty = materializedOf(
      flow([
        {
          type: 'loop',
          id: 'nothing',
          each: { kind: 'path', path: 'sample.absent' },
          as: 'line',
          children: [text('ghost', 'line.sku')],
        },
        {
          type: 'condition',
          id: 'never',
          when: { kind: 'isEmpty', operand: { kind: 'path', path: 'sample.label' } },
          children: [text('ghost', 'sample.label')],
        },
      ]),
    );
    expect(named(empty, 'ghost')).toStrictEqual([]);
  });

  it('keeps a flow address unchanged when the bands are bound a second time', () => {
    const band = {
      on: 'exceptFirst',
      content: { type: 'container', id: 'run', children: [text('run-t', 'sample.label')] },
    };
    const overrides = {
      ...twins,
      page: {
        sheet: { width: 210, height: 297 },
        margins: { top: 10, right: 10, bottom: 10, left: 10 },
        header: [],
        footer: [band],
      },
    };
    const one = materializedOf(overrides);
    const many = multiPageOf(overrides);
    expect(named(one, 'run-t')).toStrictEqual([]);
    expect(named(many, 'run-t')).toHaveLength(1);
    expect(named(many, 'leaf')).toStrictEqual(named(one, 'leaf'));
  });

  it('makes no promise about ranks once the data changed', () => {
    const other: EvaluationScope = {
      sample: { ...(SAMPLE_DATA.sample as Record<string, unknown>), items: [{ sku: 'Z-9' }] },
    };
    expect(named(materializedOf(twins, other), 'leaf').length).not.toBe(
      named(materializedOf(twins), 'leaf').length,
    );
  });

  it('never leaves a declaration path empty', () => {
    for (const occurrence of addressesOf(materializedOf(twins))) {
      expect(occurrence.declarationPath.length).toBeGreaterThan(0);
      for (const step of occurrence.iterations) {
        expect(step.declarationPath.length).toBeGreaterThan(0);
        expect(Number.isInteger(step.index) && step.index >= 0).toBe(true);
      }
    }
  });

  it('carries nothing of the occurrence beyond its address', () => {
    const [only] = addressesOf(materializedOf(flow([text('alone', 'sample.label')])));
    expect(Object.keys(only ?? {}).sort()).toStrictEqual([
      'declarationPath',
      'iterations',
      'nodeId',
      'nodeType',
    ]);
  });
});

describe('the path of a cell', () => {
  /** Three columns, the middle one unfilled, and the two declared cells in reverse order. */
  const reordered = flow([
    {
      type: 'table',
      id: 'ledger',
      columns,
      header: [],
      body: [
        {
          type: 'tableRow',
          id: 'detail',
          cells: [
            { columnId: 'right', children: [text('amount', 'issuer.notice')] },
            { columnId: 'left', children: [text('sku', 'sample.label')] },
          ],
        },
      ],
      footer: [],
    },
  ]);

  it('follows the stored cell, not the rank of the column it fills', () => {
    const document = materializedOf(reordered);
    const rowPath = ['root', 'children', 0, 'body', 0];
    /* `right` is the LAST column and the FIRST declared cell: the address follows the row, so it
       reads `cells 0`. Addressing it by the column would have said `cells 2`. */
    expect(named(document, 'amount')[0]?.declarationPath).toStrictEqual([
      ...rowPath,
      'cells',
      0,
      'children',
      0,
    ]);
    expect(named(document, 'sku')[0]?.declarationPath).toStrictEqual([
      ...rowPath,
      'cells',
      1,
      'children',
      0,
    ]);
  });

  it('points a binding refusal at the cell that really holds it', () => {
    const broken = flow([
      {
        type: 'table',
        id: 'ledger',
        columns,
        header: [],
        body: [
          {
            type: 'tableRow',
            id: 'detail',
            cells: [
              { columnId: 'right', children: [text('amount', 'sample.absentField')] },
              { columnId: 'left', children: [text('sku', 'sample.label')] },
            ],
          },
        ],
        footer: [],
      },
    ]);
    let caught: unknown;
    try {
      materializedOf(broken);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DocumentRenderError);
    if (caught instanceof DocumentRenderError) {
      expect(caught.details.path).toStrictEqual([
        'root',
        'children',
        0,
        'body',
        0,
        'cells',
        0,
        'children',
        0,
        'content',
        0,
      ]);
    }
  });
});

describe('a refusal raised inside a repetition', () => {
  it('carries the ancestry of the occurrence being built', () => {
    const broken = flow([
      {
        type: 'loop',
        id: 'each-line',
        each: { kind: 'path', path: 'sample.items' },
        as: 'line',
        children: [text('sku', 'line.absentField')],
      },
    ]);
    let caught: unknown;
    try {
      materializedOf(broken);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DocumentRenderError);
    if (caught instanceof DocumentRenderError) {
      expect(caught.details.occurrence).toStrictEqual({
        declarationPath: ['root', 'children', 0, 'children', 0],
        iterations: [{ declarationPath: ['root', 'children', 0], index: 0 }],
      });
      expect(JSON.stringify(caught.details)).not.toContain('A-1');
    }
  });

  it('carries no ancestry when nothing repeats', () => {
    let caught: unknown;
    try {
      materializedOf(flow([text('alone', 'sample.absentField')]));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DocumentRenderError);
    if (caught instanceof DocumentRenderError) {
      expect(caught.details.occurrence).toBeUndefined();
    }
  });
});
