import { describe, expect, it } from 'vitest';
import type { DocumentNode, DocumentNodeType, TextSegment } from '../nodes.js';
import { visitNode, visitSegment } from '../visitor.js';
import { DISCOUNT_TREE, ONE_NODE_PER_KIND } from './fixtures.js';

const describeNode = (node: DocumentNode): string =>
  visitNode(node, {
    text: (n) => `text:${n.content.map((segment) => segment.kind).join('+')}`,
    image: (n) => `image:${n.src}`,
    container: (n) => `container:${n.children.length}`,
    loop: (n) => `loop:${n.each.kind}`,
    condition: (n) => `condition:${n.when.kind}`,
    table: (n) => `table:${n.columns.length}`,
    grid: (n) => `grid:${n.columns}x${n.rows}`,
    tableRowGroup: (n) => `tableRowGroup:${n.as}`,
    tableRow: (n) => `tableRow:${n.cells.length}`,
  });

describe('visitNode', () => {
  it('dispatches each of the nine node types to its own branch', () => {
    // Keyed by kind rather than walked, so this file needs nothing from the traversal module: a
    // broken `nodeShape` branch must not be able to redden the test of the dispatch itself.
    const described: Readonly<Record<DocumentNodeType, string>> = {
      text: describeNode(ONE_NODE_PER_KIND.text),
      image: describeNode(ONE_NODE_PER_KIND.image),
      container: describeNode(ONE_NODE_PER_KIND.container),
      loop: describeNode(ONE_NODE_PER_KIND.loop),
      condition: describeNode(ONE_NODE_PER_KIND.condition),
      table: describeNode(ONE_NODE_PER_KIND.table),
      grid: describeNode(ONE_NODE_PER_KIND.grid),
      tableRowGroup: describeNode(ONE_NODE_PER_KIND.tableRowGroup),
      tableRow: describeNode(ONE_NODE_PER_KIND.tableRow),
    };

    expect(described).toStrictEqual({
      text: 'text:literal+binding+pageField',
      image: 'image:asset-key',
      container: 'container:2',
      loop: 'loop:path',
      condition: 'condition:path',
      table: 'table:1',
      grid: 'grid:2x2',
      tableRowGroup: 'tableRowGroup:poste',
      tableRow: 'tableRow:2',
    });
    expect(describeNode(DISCOUNT_TREE)).toBe('container:2');
  });

  it('throws on a node type it does not know', () => {
    // Reaching the defensive branch requires a value that bypassed validation,
    // which is exactly the real scenario: data read straight from storage.
    // JSON.parse is the honest way in -- no cast, no `any` annotation.
    const smuggled: DocumentNode = JSON.parse('{"type":"barcode","id":"b1"}');

    expect(() =>
      visitNode(smuggled, {
        text: () => 'x',
        image: () => 'x',
        container: () => 'x',
        loop: () => 'x',
        condition: () => 'x',
        table: () => 'x',
        grid: () => 'x',
        tableRowGroup: () => 'x',
        tableRow: () => 'x',
      }),
    ).toThrow(TypeError);
  });
});

describe('visitSegment', () => {
  it('dispatches each segment kind to its own branch', () => {
    const describeSegment = (segment: TextSegment): string =>
      visitSegment(segment, {
        literal: (s) => `literal:${s.text}`,
        binding: (s) => `binding:${s.value.kind}`,
        pageField: (s) => `pageField:${s.field}`,
      });

    expect(describeSegment({ kind: 'literal', text: 'Total' })).toBe('literal:Total');
    expect(describeSegment({ kind: 'binding', value: { kind: 'path', path: 'a.b' } })).toBe(
      'binding:path',
    );
    expect(describeSegment({ kind: 'pageField', field: 'number' })).toBe('pageField:number');
    expect(describeSegment({ kind: 'pageField', field: 'count' })).toBe('pageField:count');
  });

  it('throws on a segment kind it does not know', () => {
    // The guarantee visitNode gives for node types, now given for runs: a fourth
    // kind added to the union breaks compilation at this single site instead of
    // being silently skipped wherever segments are walked.
    const smuggled: TextSegment = JSON.parse('{"kind":"mark","text":"x"}');

    expect(() =>
      visitSegment(smuggled, { literal: () => 'x', binding: () => 'x', pageField: () => 'x' }),
    ).toThrow(TypeError);
  });
});
