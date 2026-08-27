/**
 * The single description of what an AST node carries.
 *
 * `childrenOf`, `nodeReads` and the catalogue analysis all derive from `nodeShape`, so a slot added
 * to one kind reaches every consumer at once instead of being declared in one traversal and
 * forgotten in another.
 */
import type { Expression, PrintableExpression } from '../expression/expression.js';
import type { DocumentNode, TableRowNode, TextNode } from './nodes.js';
import type { DataExpectation } from './types.js';
import { type NodeVisitor, type SegmentVisitor, visitNode, visitSegment } from './visitor.js';

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

/**
 * Everything a traversal needs of one node: what it reads, the alias it opens, its children.
 *
 * `readings` is a function rather than an array so that a structural traversal -- `childrenOf`,
 * `walk`, `findNodeById` -- never pays for the per-segment analysis of the text nodes it passes.
 * It is not memoised: call it once and keep the result.
 */
export interface NodeShape {
  readonly readings: () => readonly NodeReading[];
  readonly binding: NodeBinding | undefined;
  readonly children: readonly NodeChildSlot[];
}

const NO_READINGS: readonly NodeReading[] = [];
const NO_BINDING = undefined;
const NO_CHILDREN: readonly NodeChildSlot[] = [];

const noReadings = (): readonly NodeReading[] => NO_READINGS;

/** Shared by every node that reads nothing, opens nothing and holds nothing. */
const EMPTY_SHAPE: NodeShape = {
  readings: noReadings,
  binding: NO_BINDING,
  children: NO_CHILDREN,
};

/** The `each` source of a repeating node, under the only expectation a sequence can satisfy. */
function repeats(source: Expression, alias: string): NodeBinding {
  return { source: { expression: source, expectation: 'list', at: ['each'] }, alias };
}

/** The children a block-bearing node stores under its own `children` key. */
function blockSlot(children: readonly DocumentNode[]): readonly NodeChildSlot[] {
  return [{ nodes: children, at: ['children'] }];
}

/** The expression a segment binds, or nothing when it reads no data. */
const SEGMENT_BINDING: SegmentVisitor<PrintableExpression | undefined> = {
  literal: () => undefined,
  binding: (segment) => segment.value,
  pageField: () => undefined,
};

/** One reading per binding segment, at the index of the segment carrying it. */
function textReadings(node: TextNode): readonly NodeReading[] {
  const found: NodeReading[] = [];
  for (const [index, segment] of node.content.entries()) {
    const bound = visitSegment(segment, SEGMENT_BINDING);
    if (bound !== undefined) {
      found.push({ expression: bound, expectation: 'printable', at: ['content', index, 'value'] });
    }
  }
  return found;
}

/**
 * The contribution a row makes to the report the pages carry forward, when it declares one.
 *
 * Read in the row's own scope, so its paths belong to the row and not to the group that repeats it:
 * an alias bound above still masks them.
 */
function rowReadings(node: TableRowNode): readonly NodeReading[] {
  const { pageReport } = node;
  return pageReport === undefined
    ? NO_READINGS
    : [{ expression: pageReport.value, expectation: 'number', at: ['pageReport', 'value'] }];
}

const SHAPE: NodeVisitor<NodeShape> = {
  text: (node) => ({
    readings: () => textReadings(node),
    binding: NO_BINDING,
    children: NO_CHILDREN,
  }),
  image: () => EMPTY_SHAPE,
  container: (node) => ({
    readings: noReadings,
    binding: NO_BINDING,
    children: blockSlot(node.children),
  }),
  loop: (node) => ({
    readings: noReadings,
    binding: repeats(node.each, node.as),
    children: blockSlot(node.children),
  }),
  condition: (node) => ({
    readings: () => [{ expression: node.when, expectation: 'boolean', at: ['when'] }],
    binding: NO_BINDING,
    children: blockSlot(node.children),
  }),
  table: (node) => ({
    readings: noReadings,
    binding: NO_BINDING,
    children: [
      { nodes: node.header, at: ['header'] },
      { nodes: node.body, at: ['body'] },
      { nodes: node.footer, at: ['footer'] },
    ],
  }),
  tableRowGroup: (node) => ({
    readings: noReadings,
    binding: repeats(node.each, node.as),
    children: [{ nodes: node.rows, at: ['rows'] }],
  }),
  tableRow: (node) => ({
    readings: () => rowReadings(node),
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
