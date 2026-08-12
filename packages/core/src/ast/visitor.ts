import { type Expression, pathsOf } from '../expression/expression.js';
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
 * know which loops a node sits under. The `switch` still lives in `visitNode`
 * alone -- a new node type breaks compilation there, not here.
 *
 * Read this before writing the renderer. This function is the only place that
 * encodes "a loop's children are read under its alias". `DataBindingStep` in
 * @openview/engine needs the same descent, pairing `evaluateSequence` with
 * `childScope`, and a second copy of the alias stack is free to disagree with
 * this one: `collectDataPaths` would then promise a caller one set of keys while
 * the renderer reads another, and the symptom is a document rendering blanks for
 * data the static analysis said was not needed. Extract a shared scope-aware
 * traversal from here instead of reimplementing it (ADR 0002).
 */
function collectFrom(node: DocumentNode, aliases: ReadonlySet<string>, into: Set<string>): void {
  visitNode<void>(node, {
    text: (text) => {
      for (const segment of text.content) {
        if (segment.kind === 'binding') {
          addCallerPaths(segment.value, aliases, into);
        }
      }
    },
    // An image src is a plain string today, so it reads no data. When it gains a
    // binding, this is the branch that has to collect it.
    image: () => undefined,
    container: (container) => {
      collectChildren(container.children, aliases, into);
    },
    loop: (loop) => {
      // `each` is read in the enclosing scope: the alias is not bound yet.
      addCallerPaths(loop.each, aliases, into);
      collectChildren(loop.children, new Set(aliases).add(loop.as), into);
    },
    condition: (condition) => {
      addCallerPaths(condition.when, aliases, into);
      collectChildren(condition.children, aliases, into);
    },
  });
}

function collectChildren(
  children: readonly DocumentNode[],
  aliases: ReadonlySet<string>,
  into: Set<string>,
): void {
  for (const child of children) {
    collectFrom(child, aliases, into);
  }
}

/**
 * Every data path a template reads from the caller's data, in traversal order and
 * de-duplicated.
 *
 * This is static analysis, not a heuristic: because expressions are structured
 * trees rather than strings (ADR 0001), the answer is exact. The engine can tell
 * a caller which keys a template needs before rendering anything, and the
 * designer can flag a template that binds to a field its data schema does not
 * declare.
 *
 * Loop aliases are excluded, and text bindings are included: before ADR 0002 this
 * function reported `line.discount` -- a name the caller never supplies -- and
 * ignored every value a document actually prints, which made both halves of the
 * promise above false.
 */
export function collectDataPaths(root: DocumentNode): readonly string[] {
  const found = new Set<string>();
  collectFrom(root, new Set<string>(), found);
  return [...found];
}
