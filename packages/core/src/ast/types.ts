import type { Expression, PrintableExpression } from '../expression/expression.js';

/**
 * Composite pattern. Containers and leaves are manipulated uniformly through
 * {@link DocumentNode}; traversal lives in ./visitor.ts rather than in a
 * `switch` repeated at every call site.
 *
 * Types are hand-written and bound to their schema with `z.ZodType<T>` on
 * purpose. Letting `z.infer` derive a recursive union is where inference breaks
 * down, and the usual "fix" is a cast that AGENTS.md 1.1 forbids.
 *
 * Every field is `readonly`: the Command history in @openview/designer replaces
 * subtrees instead of mutating them, which is what makes undo/redo deterministic
 * under React 19 concurrent rendering.
 */
interface NodeBase {
  /** Stable across edits. Commands address nodes by id, never by position. */
  readonly id: string;
}

/**
 * A run inside a text block: either fixed characters, or a value read from the
 * render data (ADR 0002, option A1).
 *
 * The discriminant is `kind`, not `type`: `type` belongs to document nodes, and a
 * segment is not a node -- it is the inline content of one. That distinction is
 * the whole point. A binding expressed as a sibling *node* could not say that
 * "Total: " and the value belong on the same line, because the Composite is a
 * tree of blocks with no notion of inline flow.
 */
export interface TextLiteralSegment {
  readonly kind: 'literal';
  readonly text: string;
}

export interface TextBindingSegment {
  readonly kind: 'binding';
  /**
   * The printable sub-algebra, not the whole of it. `compare`, `logical`, `not` and
   * `isEmpty` are predicates, and a print position that accepted them would let a
   * template print `true` into an invoice. The two sibling expression positions each
   * enforce their own result kind at evaluation (`evaluatePredicate` refuses a
   * non-boolean, `evaluateSequence` a non-list); this one enforces it at save time,
   * where the narrowing costs no migration.
   *
   * ADR 0003 WIDENED this position from `literal | path` to every printable kind, so a
   * binding can now carry a computed amount. What it refuses is unchanged -- see
   * {@link PrintableExpression} for the guarantee, and for the reason a boolean
   * *literal* was never covered by it.
   */
  readonly value: PrintableExpression;
}

export type TextSegment = TextLiteralSegment | TextBindingSegment;

export interface TextNode extends NodeBase {
  readonly type: 'text';
  /** An empty run list is legal: a blank paragraph is a layout intent. */
  readonly content: readonly TextSegment[];
}

export interface ImageNode extends NodeBase {
  readonly type: 'image';
  readonly src: string;
  readonly alt?: string | undefined;
}

export interface ContainerNode extends NodeBase {
  readonly type: 'container';
  readonly children: readonly DocumentNode[];
}

/** Repeats its children once per item yielded by {@link LoopNode.each}. */
export interface LoopNode extends NodeBase {
  readonly type: 'loop';
  readonly each: Expression;
  /**
   * The name children read the current item under (ADR 0002, option B1).
   *
   * Declared by the template rather than fixed by the engine, for two reasons:
   * nested loops each name their own item instead of the inner one making the
   * outer unreachable, and a template stops depending on its host application to
   * invent the same name -- which is what `evaluatePredicate(when, { line })` in
   * the playground was doing.
   */
  readonly as: string;
  readonly children: readonly DocumentNode[];
}

/**
 * Renders its children only when {@link ConditionNode.when} evaluates to true.
 * Strictly true: see evaluatePredicate, which refuses JavaScript truthiness.
 */
export interface ConditionNode extends NodeBase {
  readonly type: 'condition';
  readonly when: Expression;
  readonly children: readonly DocumentNode[];
}

export type DocumentNode = TextNode | ImageNode | ContainerNode | LoopNode | ConditionNode;

/** Discriminant values, exported so the block Registry can validate a type. */
export type DocumentNodeType = DocumentNode['type'];
