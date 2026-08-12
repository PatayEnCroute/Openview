import { type Expression, pathsOf } from '../expression/expression.js';
import type {
  ConditionNode,
  ContainerNode,
  DocumentNode,
  ImageNode,
  LoopNode,
  TextBindingSegment,
  TextLiteralSegment,
  TextNode,
  TextSegment,
} from './nodes.js';

/**
 * Visitor pattern over the Composite AST.
 *
 * Composite without Visitor is half a pattern: rendering, validation, variable
 * collection and lookup-by-id are all traversals, and writing each as its own
 * `switch (node.type)` means every new block type forces an edit in every one of
 * them -- with no compiler error for the ones that were missed.
 *
 * Here the switch exists exactly once, in {@link visitNode}, and its `never`
 * branch turns "a node type was forgotten" into a compile error at that single
 * site.
 */
export interface NodeVisitor<TResult> {
  readonly text: (node: TextNode) => TResult;
  readonly image: (node: ImageNode) => TResult;
  readonly container: (node: ContainerNode) => TResult;
  readonly loop: (node: LoopNode) => TResult;
  readonly condition: (node: ConditionNode) => TResult;
}

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
    default: {
      // Adding a member to DocumentNode without handling it here fails to
      // compile: `node` is only assignable to `never` when every case is covered.
      const exhaustive: never = node;
      throw new TypeError(`Unhandled document node: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/** The direct children of a node; leaves report none. */
export function childrenOf(node: DocumentNode): readonly DocumentNode[] {
  return visitNode<readonly DocumentNode[]>(node, {
    text: () => [],
    image: () => [],
    container: (container) => container.children,
    loop: (loop) => loop.children,
    condition: (condition) => condition.children,
  });
}

/**
 * Depth-first, parents before children. Lazy on purpose: `findNodeById` can stop
 * at the first match instead of materialising the whole tree, which matters for
 * templates with thousands of nodes.
 */
export function* walk(root: DocumentNode): Generator<DocumentNode> {
  yield root;
  for (const child of childrenOf(root)) {
    yield* walk(child);
  }
}

export function findNodeById(root: DocumentNode, id: string): DocumentNode | undefined {
  for (const node of walk(root)) {
    if (node.id === id) {
      return node;
    }
  }
  return undefined;
}

/**
 * Visitor over the runs of a text block.
 *
 * Segments get the same protection node types get: the `switch` exists once, and
 * its `never` branch turns "a segment kind was forgotten" into a compile error
 * here rather than a silently skipped run somewhere. AGENTS.md 3.B asks for a
 * Visitor as soon as a second traversal appears, and the second one already
 * exists -- this file collects the paths a run reads, the playground renders it,
 * and the render pipeline will make a third.
 */
export interface SegmentVisitor<TResult> {
  readonly literal: (segment: TextLiteralSegment) => TResult;
  readonly binding: (segment: TextBindingSegment) => TResult;
}

export function visitSegment<TResult>(
  segment: TextSegment,
  visitor: SegmentVisitor<TResult>,
): TResult {
  switch (segment.kind) {
    case 'literal':
      return visitor.literal(segment);
    case 'binding':
      return visitor.binding(segment);
    default: {
      const exhaustive: never = segment;
      throw new TypeError(`Unhandled text segment: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/** What a single node reads, and the loop alias it binds for its children. */
export interface NodeReads {
  /** Evaluated in the node's ENCLOSING scope, before {@link NodeReads.binds}. */
  readonly reads: readonly Expression[];
  readonly binds: string | undefined;
}

const NO_READS: NodeReads = { reads: [], binds: undefined };

const SEGMENT_EXPRESSIONS: SegmentVisitor<readonly Expression[]> = {
  literal: () => [],
  binding: (segment) => [segment.value],
};

/**
 * Hoisted to module scope deliberately: it captures nothing, so one object serves
 * a whole traversal instead of one being built per visited node.
 */
const READS_VISITOR: NodeVisitor<NodeReads> = {
  text: (text) => ({
    reads: text.content.flatMap((segment) => visitSegment(segment, SEGMENT_EXPRESSIONS)),
    binds: undefined,
  }),
  // An image src is a plain string today, so it reads no data. When it gains a
  // binding, this is the branch that has to report it.
  image: () => NO_READS,
  container: () => NO_READS,
  loop: (loop) => ({ reads: [loop.each], binds: loop.as }),
  condition: (condition) => ({ reads: [condition.when], binds: undefined }),
};

/**
 * The seam static analysis and the render pipeline actually share.
 *
 * `DataBindingStep` in @openview/engine needs exactly these two facts -- which
 * expressions a node evaluates, and which alias it binds for its children -- but
 * it needs them once per loop **item**, carrying an `EvaluationScope` of values,
 * where {@link collectDataPaths} needs them once per **node**, carrying a set of
 * names. Those two traversals cannot be the same function, so telling the
 * renderer's author to reuse the descent below would send them after a refactor
 * that does not exist. This primitive is what they can share, and sharing it is
 * what keeps "a loop's children are read under its alias" stated once: two copies
 * of that rule are free to disagree, and the symptom would be a document printing
 * blanks for data the analysis said was not needed.
 */
export function nodeReads(node: DocumentNode): NodeReads {
  return visitNode(node, READS_VISITOR);
}

/**
 * Records the paths an expression reads *from the caller's data*, skipping those
 * rooted at a loop alias.
 *
 * `line.discount` under `loop invoice.lines as line` is an internal reference: it
 * is a field of an item, not a key the caller supplies, and the data it comes
 * from was already recorded when the loop's own source was collected.
 */
function addCallerPaths(
  expression: Expression,
  aliases: ReadonlySet<string>,
  into: Set<string>,
): void {
  if (aliases.size === 0) {
    // Nothing can be filtered out, so fill the result directly and skip the
    // intermediate Set. Most of a tree sits outside any loop.
    pathsOf(expression, into);
    return;
  }
  for (const dataPath of pathsOf(expression)) {
    // indexOf/slice rather than split: only the root segment decides, and this
    // runs once per expression of the whole tree.
    const dot = dataPath.indexOf('.');
    const rootSegment = dot === -1 ? dataPath : dataPath.slice(0, dot);
    if (!aliases.has(rootSegment)) {
      into.add(dataPath);
    }
  }
}

/**
 * Depth-first descent carrying the aliases in scope.
 *
 * `walk` cannot serve here: it yields nodes without their ancestry, so it cannot
 * know which loops a node sits under. Descent goes through `childrenOf`, so a
 * future container type is walked into without this function being told about it,
 * and the `switch` still lives in `visitNode` alone.
 */
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
 * Every data path a template reads from the **caller's** data, in traversal order
 * and de-duplicated.
 *
 * Exact rather than heuristic: because expressions are structured trees (ADR
 * 0001), the engine can tell a caller which keys a template needs before
 * rendering anything.
 *
 * Two limits, both deliberate, and both narrower than an earlier version of this
 * docstring claimed.
 *
 * Paths rooted at a loop alias are excluded, because they are internal
 * references. The consequence is that a per-item field is invisible here: a
 * typo'd `line.skuu` is reported by nothing, so this is **not** the function a
 * designer can use to flag a binding against a per-item data schema. That needs
 * each read paired with the scope it is relative to; ADR 0002 records it as open.
 *
 * And an alias that shadows a caller key -- `loop invoice.lines as invoice`, with
 * a child reading `invoice.total` -- silently changes what that child means, and
 * this function reports nothing at all rather than a collision. Detecting it needs
 * the same scope-qualified output, and is open for the same reason.
 */
export function collectDataPaths(root: DocumentNode): readonly string[] {
  const found = new Set<string>();
  collectFrom(root, new Set<string>(), found);
  return [...found];
}
