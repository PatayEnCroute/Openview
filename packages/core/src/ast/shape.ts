/**
 * The single description of what an AST node carries.
 *
 * `childrenOf`, `nodeReads` and the catalogue analysis all derive from `nodeShape`, so a slot added
 * to one kind reaches every consumer at once instead of being declared in one traversal and
 * forgotten in another.
 */
import type { Expression, PrintableExpression } from '../expression/expression.js';
import type {
  DocumentNode,
  GridNode,
  PresentationFormat,
  TableRowNode,
  TextNode,
} from './nodes.js';
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
  /**
   * Set when `at` names the sole child rather than an array, so no index is appended.
   *
   * A grid zone hangs alone under `items[i].content`: an appended index would name an element
   * that does not exist.
   */
  readonly single?: true | undefined;
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

/** What one binding segment reads: its expression, under the expectation its writing imposes. */
interface SegmentReading {
  readonly expression: PrintableExpression;
  readonly expectation: DataExpectation;
}

/**
 * What a position requires of the value it is about to write.
 *
 * A site that asks for money or a plain decimal requires a number, and one that asks for a date
 * requires a civil date: the writing is declared by the model, so the requirement is read from it
 * and never guessed from the path, the id or the value.
 */
function expectationOfFormat(format: PresentationFormat | undefined): DataExpectation {
  if (format === undefined) {
    return 'printable';
  }
  return format.kind === 'date' ? 'civil-date' : 'number';
}

/** The expression a segment binds, or nothing when it reads no data. */
const SEGMENT_BINDING: SegmentVisitor<SegmentReading | undefined> = {
  literal: () => undefined,
  binding: (segment) => ({
    expression: segment.value,
    expectation: expectationOfFormat(segment.format),
  }),
  /* A marker reads no data: a counter comes from the cuts and a report from declared contributions,
     so the profile it may carry is never a path of the catalogue. */
  pageField: () => undefined,
};

/** One reading per binding segment, at the index of the segment carrying it. */
function textReadings(node: TextNode): readonly NodeReading[] {
  const found: NodeReading[] = [];
  for (const [index, segment] of node.content.entries()) {
    const bound = visitSegment(segment, SEGMENT_BINDING);
    if (bound !== undefined) {
      found.push({
        expression: bound.expression,
        expectation: bound.expectation,
        at: ['content', index, 'value'],
      });
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

/** One slot per grid zone: a zone is a single container under its own item. */
function zoneSlots(node: GridNode): readonly NodeChildSlot[] {
  return node.items.map((item, index) => ({
    nodes: [item.content],
    at: ['items', index, 'content'],
    single: true,
  }));
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
  /* Grid positions are numbers of the layout, never data reads: only the zone contents read. */
  grid: (node) => ({
    readings: noReadings,
    binding: NO_BINDING,
    children: zoneSlots(node),
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
