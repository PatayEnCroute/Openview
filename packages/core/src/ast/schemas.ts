import { z } from 'zod/v4';
import {
  aliasSchema,
  ExpressionSchema,
  PrintableExpressionSchema,
} from '../expression/expression.js';
import type { DocumentNode } from './types.js';

const nodeIdSchema = z.string().min(1, 'A node id is required');

export const TextLiteralSegmentSchema = z.object({
  kind: z.literal('literal'),
  text: z.string(),
});

export const TextBindingSegmentSchema = z.object({
  kind: z.literal('binding'),
  value: PrintableExpressionSchema,
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
 *
 * **`.parse` on this schema bounds nothing.** A deep enough payload raises a bare
 * `RangeError` from Zod's own recursion rather than a typed refusal; use
 * `parseDocumentNode` from `template/guard.ts` for the bounded door.
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
  as: aliasSchema,
  children: z.array(DocumentNodeSchema),
});

export const ConditionNodeSchema = z.object({
  type: z.literal('condition'),
  id: nodeIdSchema,
  when: ExpressionSchema,
  children: z.array(DocumentNodeSchema),
});
