import { z } from 'zod/v4';
import {
  type Expression,
  ExpressionSchema,
  isIdentifier,
  type LiteralExpression,
  LiteralExpressionSchema,
  type PathExpression,
  PathExpressionSchema,
} from '../expression/expression.js';

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
   * A literal or a path, not the full expression algebra. Those two are the only
   * kinds that yield something printable: `compare`, `logical`, `not` and
   * `isEmpty` are predicates, and a print position that accepted them would let a
   * template print `true` into an invoice. The two sibling expression positions
   * each enforce their own result kind at evaluation (`evaluatePredicate` refuses
   * a non-boolean, `evaluateSequence` a non-list); this one enforces it at save
   * time, where the narrowing costs no migration.
   */
  readonly value: LiteralExpression | PathExpression;
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

const nodeIdSchema = z.string().min(1, 'A node id is required');

/**
 * The alias binds as a key of the evaluation scope, so it has to be a single
 * identifier under exactly the rule paths obey -- otherwise a template could
 * declare a name that no path is allowed to read back.
 */
const loopAliasSchema = z
  .string()
  .refine(
    isIdentifier,
    'A loop alias must be a single identifier, and may not be __proto__, constructor or prototype',
  );

export const TextLiteralSegmentSchema = z.object({
  kind: z.literal('literal'),
  text: z.string(),
});

/** The kinds that yield a printable value -- see {@link TextBindingSegment.value}. */
const printableExpressionSchema = z.discriminatedUnion('kind', [
  LiteralExpressionSchema,
  PathExpressionSchema,
]);

export const TextBindingSegmentSchema = z.object({
  kind: z.literal('binding'),
  value: printableExpressionSchema,
});

/**
 * No `z.ZodType<TextSegment>` annotation, and `DocumentNodeSchema`'s explicit
 * binding below does **not** police this union in its place: zod declares
 * `ZodType<out Output, ...>`, so it is covariant in its output and a schema that
 * produces *less* than `TextSegment` stays assignable and still compiles. The
 * real guard is the mutual-assignability assertion in nodes.test.ts, which fails
 * in both directions.
 */
export const TextSegmentSchema = z.discriminatedUnion('kind', [
  TextLiteralSegmentSchema,
  TextBindingSegmentSchema,
]);

export const TextNodeSchema = z.object({
  type: z.literal('text'),
  id: nodeIdSchema,
  content: z.array(TextSegmentSchema),
});

export const ImageNodeSchema = z.object({
  type: z.literal('image'),
  id: nodeIdSchema,
  src: z.string().min(1, 'An image src is required'),
  alt: z.string().optional(),
});

/**
 * The single recursive binding. `z.lazy` defers resolution so the three
 * container schemas below can reference it before they are initialised, and the
 * explicit `z.ZodType<DocumentNode>` annotation keeps the inferred type from
 * collapsing. The concrete schemas need no annotation: their own inference is
 * fine once `children` resolves through this one.
 */
export const DocumentNodeSchema: z.ZodType<DocumentNode> = z.lazy(() =>
  z.discriminatedUnion('type', [
    TextNodeSchema,
    ImageNodeSchema,
    ContainerNodeSchema,
    LoopNodeSchema,
    ConditionNodeSchema,
  ]),
);

export const ContainerNodeSchema = z.object({
  type: z.literal('container'),
  id: nodeIdSchema,
  children: z.array(DocumentNodeSchema),
});

export const LoopNodeSchema = z.object({
  type: z.literal('loop'),
  id: nodeIdSchema,
  each: ExpressionSchema,
  as: loopAliasSchema,
  children: z.array(DocumentNodeSchema),
});

export const ConditionNodeSchema = z.object({
  type: z.literal('condition'),
  id: nodeIdSchema,
  when: ExpressionSchema,
  children: z.array(DocumentNodeSchema),
});
