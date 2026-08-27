import { describe, expect, it } from 'vitest';
import type { Expression } from '../../expression/expression.js';
import type { DocumentNode, TextSegment } from '../nodes.js';
import { walk } from '../traverse.js';
import { visitNode, visitSegment } from '../visitor.js';

const discountApplies: Expression = {
  kind: 'compare',
  op: 'gt',
  left: { kind: 'path', path: 'line.discount' },
  right: { kind: 'literal', value: 0 },
};

const tree: DocumentNode = {
  type: 'container',
  id: 'root',
  children: [
    { type: 'text', id: 'title', content: [{ kind: 'literal', text: 'Invoice' }] },
    {
      type: 'loop',
      id: 'lines',
      each: { kind: 'path', path: 'invoice.lines' },
      as: 'line',
      children: [
        { type: 'image', id: 'thumb', src: 'thumb.png' },
        {
          type: 'condition',
          id: 'discounted',
          when: discountApplies,
          children: [
            {
              type: 'text',
              id: 'label',
              content: [
                { kind: 'literal', text: 'Discount: ' },
                { kind: 'binding', value: { kind: 'path', path: 'line.discount' } },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe('visitNode', () => {
  it('dispatches each node type to its own branch', () => {
    const describeNode = (node: DocumentNode): string =>
      visitNode(node, {
        text: (n) => `text:${n.content.map((segment) => segment.kind).join('+')}`,
        image: (n) => `image:${n.src}`,
        container: (n) => `container:${n.children.length}`,
        loop: (n) => `loop:${n.each.kind}`,
        condition: (n) => `condition:${n.when.kind}`,
        table: (n) => `table:${n.columns.length}`,
        tableRowGroup: (n) => `tableRowGroup:${n.as}`,
        tableRow: (n) => `tableRow:${n.cells.length}`,
      });

    expect(describeNode(tree)).toBe('container:2');
    expect([...walk(tree)].map(describeNode)).toStrictEqual([
      'container:2',
      'text:literal',
      'loop:path',
      'image:thumb.png',
      'condition:compare',
      'text:literal+binding',
    ]);
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
