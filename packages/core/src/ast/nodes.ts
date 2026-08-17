/**
 * The document AST (Composite pattern, ADR 0002).
 *
 * Facade module re-exporting the hand-written node types and their Zod schemas, on the
 * pattern `expression/expression.ts` already executes. Consumers import from here; the split
 * between `types.ts` and `schemas.ts` is internal, and no consumer changed one line when it
 * happened.
 */

export {
  ConditionNodeSchema,
  ContainerNodeSchema,
  DocumentNodeSchema,
  ImageNodeSchema,
  LoopNodeSchema,
  TextBindingSegmentSchema,
  TextLiteralSegmentSchema,
  TextNodeSchema,
  TextSegmentSchema,
} from './schemas.js';
export type {
  ConditionNode,
  ContainerNode,
  DocumentNode,
  DocumentNodeType,
  ImageNode,
  LoopNode,
  TextBindingSegment,
  TextLiteralSegment,
  TextNode,
  TextSegment,
} from './types.js';
