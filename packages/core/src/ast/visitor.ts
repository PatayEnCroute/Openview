import { type Expression, pathsOf, rootSegment } from '../expression/expression.js';
import { kindOf } from '../expression/value-type.js';
import type {
  ConditionNode,
  ContainerNode,
  DocumentNode,
  ImageNode,
  LoopNode,
  TableNode,
  TableRowGroupNode,
  TableRowNode,
  TextBindingSegment,
  TextLiteralSegment,
  TextNode,
  TextPageFieldSegment,
  TextSegment,
} from './nodes.js';

/**
 * Visitor interface for exhaustive traversal over the Composite AST.
 */
export interface NodeVisitor<TResult> {
  readonly text: (node: TextNode) => TResult;
  readonly image: (node: ImageNode) => TResult;
  readonly container: (node: ContainerNode) => TResult;
  readonly loop: (node: LoopNode) => TResult;
  readonly condition: (node: ConditionNode) => TResult;
  readonly table: (node: TableNode) => TResult;
  readonly tableRowGroup: (node: TableRowGroupNode) => TResult;
  readonly tableRow: (node: TableRowNode) => TResult;
}

/**
 * Dispatches an AST node to the matching visitor method with compile-time exhaustiveness check.
 */
export function visitNode<TResult>(node: DocumentNode, visitor: NodeVisitor<TResult>): TResult {
  switch (node.type) {
    case 'text':
      return visitor.text(node);
    case 'image':
      return visitor.image(node);
    case 'container':
      return visitor.container(node);
    case 'loop':
      return visitor.loop(node);
    case 'condition':
      return visitor.condition(node);
    case 'table':
      return visitor.table(node);
    case 'tableRowGroup':
      return visitor.tableRowGroup(node);
    case 'tableRow':
      return visitor.tableRow(node);
    default: {
      const exhaustive: never = node;
      throw new TypeError(`Unhandled document node: ${kindOf(exhaustive, 'type')}`);
    }
  }
}

/** Returns the direct children of an AST node in flow order. */
export function childrenOf(node: DocumentNode): readonly DocumentNode[] {
  return visitNode<readonly DocumentNode[]>(node, {
    text: () => [],
    image: () => [],
    container: (container) => container.children,
    loop: (loop) => loop.children,
    condition: (condition) => condition.children,
    table: (table) => [...table.header, ...table.body, ...table.footer],
    tableRowGroup: (group) => group.rows,
    tableRow: (row) => row.cells.flatMap((cell) => cell.children),
  });
}

/** Lazy depth-first traversal (DFS) of an AST subtree. */
export function* walk(root: DocumentNode): Generator<DocumentNode> {
  yield root;
  for (const child of childrenOf(root)) {
    yield* walk(child);
  }
}

/** Finds a node by id in the given subtree. */
export function findNodeById(root: DocumentNode, id: string): DocumentNode | undefined {
  for (const node of walk(root)) {
    if (node.id === id) {
      return node;
    }
  }
  return undefined;
}

/** Visitor for inline text segments. */
export interface SegmentVisitor<TResult> {
  readonly literal: (segment: TextLiteralSegment) => TResult;
  readonly binding: (segment: TextBindingSegment) => TResult;
  readonly pageField: (segment: TextPageFieldSegment) => TResult;
}

/** Dispatches a text segment to the matching visitor method. */
export function visitSegment<TResult>(
  segment: TextSegment,
  visitor: SegmentVisitor<TResult>,
): TResult {
  switch (segment.kind) {
    case 'literal':
      return visitor.literal(segment);
    case 'binding':
      return visitor.binding(segment);
    case 'pageField':
      return visitor.pageField(segment);
    default: {
      const exhaustive: never = segment;
      throw new TypeError(`Unhandled text segment: ${kindOf(exhaustive, 'kind')}`);
    }
  }
}

/** Expressions read by a node and any loop alias bound for its children. */
export interface NodeReads {
  readonly reads: readonly Expression[];
  readonly binds: string | undefined;
}

const NO_READS: NodeReads = { reads: [], binds: undefined };

const SEGMENT_EXPRESSIONS: SegmentVisitor<readonly Expression[]> = {
  literal: () => [],
  binding: (segment) => [segment.value],
  pageField: () => [],
};

const READS_VISITOR: NodeVisitor<NodeReads> = {
  text: (text) => ({
    reads: text.content.flatMap((segment) => visitSegment(segment, SEGMENT_EXPRESSIONS)),
    binds: undefined,
  }),
  image: () => NO_READS,
  container: () => NO_READS,
  loop: (loop) => ({ reads: [loop.each], binds: loop.as }),
  condition: (condition) => ({ reads: [condition.when], binds: undefined }),
  table: () => NO_READS,
  tableRowGroup: (group) => ({ reads: [group.each], binds: group.as }),
  /* A contribution is read in the row's own scope, so its paths belong to the row and not to the
     group that repeats it: an alias bound above still masks them. */
  tableRow: (row) =>
    row.pageReport === undefined ? NO_READS : { reads: [row.pageReport.value], binds: undefined },
};

/** Returns the expressions directly read by a node and any bound alias. */
export function nodeReads(node: DocumentNode): NodeReads {
  return visitNode(node, READS_VISITOR);
}

function addCallerPaths(
  expression: Expression,
  aliases: ReadonlySet<string>,
  into: Set<string>,
): void {
  if (aliases.size === 0) {
    pathsOf(expression, into);
    return;
  }
  for (const dataPath of pathsOf(expression)) {
    if (!aliases.has(rootSegment(dataPath))) {
      into.add(dataPath);
    }
  }
}

function collectFrom(node: DocumentNode, aliases: ReadonlySet<string>, into: Set<string>): void {
  const { reads, binds } = nodeReads(node);
  for (const expression of reads) {
    addCallerPaths(expression, aliases, into);
  }

  const inner = binds === undefined ? aliases : new Set(aliases).add(binds);
  for (const child of childrenOf(node)) {
    collectFrom(child, inner, into);
  }
}

/**
 * Collects the deduplicated list of external data paths read by a root node and its descendants,
 * excluding local loop aliases.
 */
export function collectDataPaths(root: DocumentNode): readonly string[] {
  const found = new Set<string>();
  collectFrom(root, new Set<string>(), found);
  return [...found];
}
