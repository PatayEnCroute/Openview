import { STANDARD_SHEETS_MM } from '@openview/core';
import { describe, expect, it } from 'vitest';
import {
  gridPage,
  literalText,
  materializedOf,
  SAMPLE_DATA,
  TINY_PNG,
} from '../../__tests__/fixtures.js';
import {
  childBlocksOf,
  documentAreas,
  flowBlocks,
  rowsOf,
  visitBlock,
  walkBlocks,
  walkDocument,
} from '../traverse.js';
import type { MaterialBlock } from '../types.js';

const image = (id: string): Record<string, unknown> => ({ type: 'image', id, src: TINY_PNG });

const container = (id: string, children: unknown[] = []): Record<string, unknown> => ({
  type: 'container',
  id,
  children,
});

const row = (id: string, children: unknown[]): Record<string, unknown> => ({
  type: 'tableRow',
  id,
  cells: [{ columnId: 'c', children }],
});

const table = (id: string): Record<string, unknown> => ({
  type: 'table',
  id,
  columns: [{ id: 'c', width: 1, align: 'start' }],
  header: [row('head', [literalText('in-head', 'h')])],
  body: [row('detail', [literalText('in-body', 'b')])],
  footer: [row('foot', [literalText('in-foot', 'f')])],
});

const grid = (id: string): Record<string, unknown> => ({
  type: 'grid',
  id,
  columns: 2,
  rows: 1,
  step: 5,
  items: [{ row: 1, column: 1, content: container('zone', [literalText('in-zone', 'z')]) }],
});

/** One document holding all five kinds, a table with three sections and a grid zone. */
const everyKind = () =>
  materializedOf(
    {
      root: container('root', [
        literalText('lead', 'lead'),
        image('mark'),
        container('wrap', [literalText('nested', 'nested')]),
        table('rows'),
        grid('zones'),
      ]),
    },
    SAMPLE_DATA,
  );

/** The one block of the document that has the asked-for kind and id, so a test can name it. */
function blockOf(kind: MaterialBlock['kind'], nodeId: string): MaterialBlock {
  for (const block of walkDocument(everyKind())) {
    if (block.kind === kind && block.nodeId === nodeId) {
      return block;
    }
  }
  throw new Error(`no ${kind} block named ${nodeId}`);
}

describe('visitBlock', () => {
  it('dispatches each of the five kinds to its own handler', () => {
    const naming = {
      text: () => 'text' as const,
      image: () => 'image' as const,
      container: () => 'container' as const,
      table: () => 'table' as const,
      grid: () => 'grid' as const,
    };
    const kinds = [...walkDocument(everyKind())].map((block) => visitBlock(block, naming));
    expect(new Set(kinds)).toStrictEqual(
      new Set(['text', 'image', 'container', 'table', 'grid'] as const),
    );
  });

  it('hands the handler the block itself, narrowed to its kind', () => {
    expect(
      visitBlock(blockOf('table', 'rows'), {
        text: () => -1,
        image: () => -1,
        container: () => -1,
        table: (found) => found.body.length,
        grid: () => -1,
      }),
    ).toBe(1);
  });
});

describe('childBlocksOf', () => {
  it('answers nothing for the two leaves', () => {
    expect(childBlocksOf(blockOf('text', 'lead'))).toStrictEqual([]);
    expect(childBlocksOf(blockOf('image', 'mark'))).toStrictEqual([]);
  });

  it('answers the declared children of a container', () => {
    expect(childBlocksOf(blockOf('container', 'wrap')).map((child) => child.nodeId)).toStrictEqual([
      'nested',
    ]);
  });

  it('answers the cell contents of a table, header then body then footer', () => {
    expect(childBlocksOf(blockOf('table', 'rows')).map((child) => child.nodeId)).toStrictEqual([
      'in-head',
      'in-body',
      'in-foot',
    ]);
  });

  it('answers the zone containers of a grid', () => {
    expect(childBlocksOf(blockOf('grid', 'zones')).map((child) => child.nodeId)).toStrictEqual([
      'zone',
    ]);
  });
});

describe('rowsOf', () => {
  it('answers the three sections of a table in order', () => {
    expect(rowsOf(blockOf('table', 'rows')).map((found) => found.nodeId)).toStrictEqual([
      'head',
      'detail',
      'foot',
    ]);
  });

  it('answers nothing for every other kind', () => {
    for (const [kind, nodeId] of [
      ['text', 'lead'],
      ['image', 'mark'],
      ['container', 'wrap'],
      ['grid', 'zones'],
    ] as const) {
      expect(rowsOf(blockOf(kind, nodeId))).toStrictEqual([]);
    }
  });
});

describe('walkBlocks', () => {
  it('yields a block before its descendants, in paint order', () => {
    const document = materializedOf(
      { root: container('root', [container('wrap', [literalText('deep', 'd')]), image('after')]) },
      {},
    );
    expect([...walkBlocks(document.root)].map((block) => block.nodeId)).toStrictEqual([
      'root',
      'wrap',
      'deep',
      'after',
    ]);
  });

  it('descends a table through its cells and a grid through its zones', () => {
    expect([...walkBlocks([blockOf('table', 'rows')])].map((block) => block.nodeId)).toStrictEqual([
      'rows',
      'in-head',
      'in-body',
      'in-foot',
    ]);
    expect([...walkBlocks([blockOf('grid', 'zones')])].map((block) => block.nodeId)).toStrictEqual([
      'zones',
      'zone',
      'in-zone',
    ]);
  });

  it('yields nothing for an empty sequence', () => {
    expect([...walkBlocks([])]).toStrictEqual([]);
  });
});

/** A document with one marked block in each of the five painted areas. */
const everyArea = () =>
  materializedOf(
    {
      page: {
        sheet: { ...STANDARD_SHEETS_MM.a4 },
        margins: { top: 10, right: 10, bottom: 10, left: 10 },
        header: [{ on: 'every', content: container('head', [literalText('in-head', 'h')]) }],
        footer: [{ on: 'every', content: container('foot', [literalText('in-foot', 'f')]) }],
        layers: [
          { plane: 'background', content: container('back', [literalText('in-back', 'k')]) },
          { plane: 'foreground', content: container('front', [literalText('in-front', 'n')]) },
        ],
      },
      root: container('root', [literalText('in-root', 'r')]),
    },
    {},
  );

describe('documentAreas', () => {
  it('names the five painted areas in paint order', () => {
    expect(documentAreas(everyArea()).map(({ area }) => area)).toStrictEqual([
      'background',
      'header',
      'root',
      'footer',
      'foreground',
    ]);
  });

  it('is the root alone when a document declares no band and no layer', () => {
    const document = materializedOf({ root: container('root', []) }, {});
    expect(documentAreas(document).map(({ area }) => area)).toStrictEqual(['root']);
  });
});

describe('walkDocument', () => {
  it('reaches every area, layers included, in paint order', () => {
    expect([...walkDocument(everyArea())].map((block) => block.nodeId)).toStrictEqual([
      'back',
      'in-back',
      'head',
      'in-head',
      'root',
      'in-root',
      'foot',
      'in-foot',
      'front',
      'in-front',
    ]);
  });
});

describe('flowBlocks', () => {
  it('keeps the bands and the root, and drops both planes of layers', () => {
    expect([...walkBlocks(flowBlocks(everyArea()))].map((block) => block.nodeId)).toStrictEqual([
      'head',
      'in-head',
      'root',
      'in-root',
      'foot',
      'in-foot',
    ]);
  });

  it('is the root alone when a document declares no band and no layer', () => {
    const document = materializedOf({ page: gridPage(5), root: container('root', []) }, {});
    expect(flowBlocks(document).map((block) => block.nodeId)).toStrictEqual(['root']);
  });
});
