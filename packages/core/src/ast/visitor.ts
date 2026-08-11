import { pathsOf } from '../expression/expression.js';
import type {
  ConditionNode,
  ContainerNode,
  DocumentNode,
  ImageNode,
  LoopNode,
  TextNode,
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
 * Every data path a template reads, in traversal order and de-duplicated.
 *
 * This is static analysis, not a heuristic: because expressions are structured
 * trees rather than strings (ADR 0001), the answer is exact. The engine can tell
 * a caller which keys a template needs before rendering anything, and the
 * designer can flag a template that binds to a field its data schema does not
 * declare.
 */
export function collectDataPaths(root: DocumentNode): readonly string[] {
  const found = new Set<string>();
  for (const node of walk(root)) {
    if (node.type === 'loop') {
      pathsOf(node.each, found);
    } else if (node.type === 'condition') {
      pathsOf(node.when, found);
    }
  }
  return [...found];
}
