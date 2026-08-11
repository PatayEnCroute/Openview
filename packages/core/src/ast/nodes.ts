import { z } from 'zod/v4';
import { type Expression, ExpressionSchema } from '../expression/expression.js';

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

export interface TextNode extends NodeBase {
  readonly type: 'text';
  readonly content: string;
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

export const TextNodeSchema = z.object({
  type: z.literal('text'),
  id: nodeIdSchema,
  content: z.string(),
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
  children: z.array(DocumentNodeSchema),
});

export const ConditionNodeSchema = z.object({
  type: z.literal('condition'),
  id: nodeIdSchema,
  when: ExpressionSchema,
  children: z.array(DocumentNodeSchema),
});
