/**
 * The single description of what an AST node carries.
 *
 * `childrenOf`, `nodeReads` and the catalogue analysis all derive from `nodeShape`, so a slot added
 * to one kind reaches every consumer at once instead of being declared in one traversal and
 * forgotten in another.
 */
import type { Expression } from '../expression/expression.js';
import type { DocumentNode } from './nodes.js';
import { type NodeVisitor, visitNode, visitSegment } from './visitor.js';

/**
 * What the runtime requires at the exact position a value is read.
 *
 * A closed vocabulary, not a type system. It lives with the AST because a position is a property of
 * the AST; which declared natures satisfy a position is a property of the catalogue.
 */
export const DATA_EXPECTATIONS = [
  'any',
  'printable',
  'number',
  'boolean',
  'text',
  'civil-date',
  'primitive',
  'orderable',
  'list',
] as const;

export type DataExpectation = (typeof DATA_EXPECTATIONS)[number];

/** One expression a node reads, under the expectation its position imposes. */
export interface NodeReading {
  readonly expression: Expression;
  readonly expectation: DataExpectation;
  /** Segments from the node to the expression. */
  readonly at: readonly (string | number)[];
}

/** The sequence a node repeats and the alias it opens for its children. */
export interface NodeBinding {
  readonly source: NodeReading;
  readonly alias: string;
}

/** A run of children stored under one key of their parent, in flow order. */
export interface NodeChildSlot {
  readonly nodes: readonly DocumentNode[];
  /** Segments from the node to the array itself; a child appends its own index. */
  readonly at: readonly (string | number)[];
}

/** Everything a traversal needs of one node: what it reads, the alias it opens, its children. */
export interface NodeShape {
  readonly readings: readonly NodeReading[];
  readonly binding: NodeBinding | undefined;
  readonly children: readonly NodeChildSlot[];
}

const NO_READINGS: readonly NodeReading[] = [];
const NO_BINDING = undefined;
const NO_CHILDREN: readonly NodeChildSlot[] = [];

/** A node that reads nothing, opens nothing and holds nothing. */
const LEAF: NodeShape = { readings: NO_READINGS, binding: NO_BINDING, children: NO_CHILDREN };

/** A sequence source, read under the only expectation a repeated value can satisfy. */
function repeats(source: Expression, alias: string): NodeBinding {
  return { source: { expression: source, expectation: 'list', at: ['each'] }, alias };
}

/** The children a block-bearing node stores under its own `children` key. */
function blockSlot(children: readonly DocumentNode[]): readonly NodeChildSlot[] {
  return [{ nodes: children, at: ['children'] }];
}

const SHAPE: NodeVisitor<NodeShape> = {
  text: (node) => ({
    readings: node.content.flatMap((segment, index) =>
      visitSegment<readonly NodeReading[]>(segment, {
        literal: () => NO_READINGS,
        binding: (bound) => [
          { expression: bound.value, expectation: 'printable', at: ['content', index, 'value'] },
        ],
        pageField: () => NO_READINGS,
      }),
    ),
    binding: NO_BINDING,
    children: NO_CHILDREN,
  }),
  image: () => LEAF,
  container: (node) => ({
    readings: NO_READINGS,
    binding: NO_BINDING,
    children: blockSlot(node.children),
  }),
  loop: (node) => ({
    readings: NO_READINGS,
    binding: repeats(node.each, node.as),
    children: blockSlot(node.children),
  }),
  condition: (node) => ({
    readings: [{ expression: node.when, expectation: 'boolean', at: ['when'] }],
    binding: NO_BINDING,
    children: blockSlot(node.children),
  }),
  table: (node) => ({
    readings: NO_READINGS,
    binding: NO_BINDING,
    children: [
      { nodes: node.header, at: ['header'] },
      { nodes: node.body, at: ['body'] },
      { nodes: node.footer, at: ['footer'] },
    ],
  }),
  tableRowGroup: (node) => ({
    readings: NO_READINGS,
    binding: repeats(node.each, node.as),
    children: [{ nodes: node.rows, at: ['rows'] }],
  }),
  /* A contribution is read in the row's own scope, so its paths belong to the row and not to the
     group that repeats it: an alias bound above still masks them. */
  tableRow: (node) => ({
    readings:
      node.pageReport === undefined
        ? NO_READINGS
        : [
            {
              expression: node.pageReport.value,
              expectation: 'number',
              at: ['pageReport', 'value'],
            },
          ],
    binding: NO_BINDING,
    children: node.cells.map((cell, index) => ({
      nodes: cell.children,
      at: ['cells', index, 'children'],
    })),
  }),
};

/** Returns the readings, the alias and the children of one node. */
export function nodeShape(node: DocumentNode): NodeShape {
  return visitNode(node, SHAPE);
}
