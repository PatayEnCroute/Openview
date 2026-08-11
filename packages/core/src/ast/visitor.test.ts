import { describe, expect, it } from 'vitest';
import type { Expression } from '../expression/expression.js';
import type { DocumentNode } from './nodes.js';
import { childrenOf, collectDataPaths, findNodeById, visitNode, walk } from './visitor.js';

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
    { type: 'text', id: 'title', content: 'Invoice' },
    {
      type: 'loop',
      id: 'lines',
      each: { kind: 'path', path: 'invoice.lines' },
      children: [
        { type: 'image', id: 'thumb', src: 'thumb.png' },
        {
          type: 'condition',
          id: 'discounted',
          when: discountApplies,
          children: [{ type: 'text', id: 'label', content: 'Discounted' }],
        },
      ],
    },
  ],
};

describe('visitNode', () => {
  it('dispatches each node type to its own branch', () => {
    const describeNode = (node: DocumentNode): string =>
      visitNode(node, {
        text: (n) => `text:${n.content}`,
        image: (n) => `image:${n.src}`,
        container: (n) => `container:${n.children.length}`,
        loop: (n) => `loop:${n.each.kind}`,
        condition: (n) => `condition:${n.when.kind}`,
      });

    expect(describeNode(tree)).toBe('container:2');
    expect([...walk(tree)].map(describeNode)).toStrictEqual([
      'container:2',
      'text:Invoice',
      'loop:path',
      'image:thumb.png',
      'condition:compare',
      'text:Discounted',
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
      }),
    ).toThrow(TypeError);
  });
});

describe('childrenOf', () => {
  it('reports no children for leaves', () => {
    expect(childrenOf({ type: 'text', id: 't', content: 'x' })).toStrictEqual([]);
    expect(childrenOf({ type: 'image', id: 'i', src: 's' })).toStrictEqual([]);
  });

  it('reports the direct children of every container kind', () => {
    expect(childrenOf(tree).map((child) => child.id)).toStrictEqual(['title', 'lines']);
  });
});

describe('walk', () => {
  it('yields parents before children, depth first', () => {
    expect([...walk(tree)].map((node) => node.id)).toStrictEqual([
      'root',
      'title',
      'lines',
      'thumb',
      'discounted',
      'label',
    ]);
  });

  it('yields a lone leaf', () => {
    expect([...walk({ type: 'text', id: 'solo', content: 'x' })].map((n) => n.id)).toStrictEqual([
      'solo',
    ]);
  });
});

describe('findNodeById', () => {
  it('finds a deeply nested node', () => {
    expect(findNodeById(tree, 'label')?.type).toBe('text');
  });

  it('returns undefined rather than throwing when the id is absent', () => {
    expect(findNodeById(tree, 'nope')).toBeUndefined();
  });
});

describe('collectDataPaths', () => {
  it('reaches inside compound expressions, not just top-level paths', () => {
    // `line.discount` is nested two levels down inside a compare node. A string
    // language would have needed parsing to find it; the structured form makes
    // this exact.
    expect(collectDataPaths(tree)).toStrictEqual(['invoice.lines', 'line.discount']);
  });

  it('de-duplicates repeated paths', () => {
    const repeated: DocumentNode = {
      type: 'container',
      id: 'root',
      children: [
        { type: 'loop', id: 'a', each: { kind: 'path', path: 'items' }, children: [] },
        { type: 'loop', id: 'b', each: { kind: 'path', path: 'items' }, children: [] },
      ],
    };
    expect(collectDataPaths(repeated)).toStrictEqual(['items']);
  });

  it('returns nothing for a tree with no dynamic bindings', () => {
    expect(collectDataPaths({ type: 'text', id: 't', content: 'static' })).toStrictEqual([]);
  });
});
