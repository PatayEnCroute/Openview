/**
 * Traversals derived from the node shape: children, depth-first walk, id lookup, and the data paths
 * a subtree reads.
 *
 * Nothing here enumerates node kinds. Everything it needs comes from `nodeShape`.
 */
import { type Expression, pathsOf, rootSegment } from '../expression/expression.js';
import type { DocumentNode } from './nodes.js';
import { nodeShape } from './shape.js';

/**
 * Returns the direct children of an AST node in flow order.
 *
 * The stored array itself when the node keeps its children in a single run, a fresh one otherwise.
 * Identity is never a contract here: a consumer must not memoise on it.
 */
export function childrenOf(node: DocumentNode): readonly DocumentNode[] {
  const slots = nodeShape(node).children;
  const only = slots.length === 1 ? slots[0] : undefined;
  return only === undefined ? slots.flatMap((slot) => slot.nodes) : only.nodes;
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

/** Expressions read by a node and any loop alias bound for its children. */
export interface NodeReads {
  readonly reads: readonly Expression[];
  readonly binds: string | undefined;
}

/**
 * Returns the expressions directly read by a node and any bound alias.
 *
 * Readings come in declaration order, followed by the source of a bound alias.
 */
export function nodeReads(node: DocumentNode): NodeReads {
  const { readings, binding } = nodeShape(node);
  const read = readings().map((reading) => reading.expression);
  return binding === undefined
    ? { reads: read, binds: undefined }
    : { reads: [...read, binding.source.expression], binds: binding.alias };
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
  const { readings, binding, children } = nodeShape(node);
  for (const reading of readings()) {
    addCallerPaths(reading.expression, aliases, into);
  }
  if (binding !== undefined) {
    addCallerPaths(binding.source.expression, aliases, into);
  }

  const inner = binding === undefined ? aliases : new Set(aliases).add(binding.alias);
  for (const slot of children) {
    for (const child of slot.nodes) {
      collectFrom(child, inner, into);
    }
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
