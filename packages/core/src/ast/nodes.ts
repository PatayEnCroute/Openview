/**
 * The document AST (Composite pattern, ADR 0002; widened by ADR 0005).
 *
 * Facade module re-exporting the hand-written node types and their Zod schemas, on the
 * pattern `expression/expression.ts` already executes. Consumers import from here; the split
 * between `types.ts` and `schemas.ts` is internal, and no consumer changed one line when it
 * happened.
 */

export {
  BlockNodeSchema,
  ConditionNodeSchema,
  ContainerNodeSchema,
  DocumentNodeSchema,
  ImageNodeSchema,
  LoopNodeSchema,
  TableBodyNodeSchema,
  TableCellSchema,
  TableColumnSchema,
  TableNodeSchema,
  TableRowGroupNodeSchema,
  TableRowNodeSchema,
  TextBindingSegmentSchema,
  TextLiteralSegmentSchema,
  TextNodeSchema,
  TextPageFieldSegmentSchema,
  TextSegmentSchema,
} from './schemas.js';
export type {
  BlockNode,
  BlockNodeType,
  ConditionNode,
  ContainerNode,
  DocumentNode,
  DocumentNodeType,
  ImageNode,
  LoopNode,
  PageField,
  TableBodyNode,
  TableCell,
  TableColumn,
  TableColumnAlignment,
  TableNode,
  TableRowGroupNode,
  TableRowNode,
  TextBindingSegment,
  TextLiteralSegment,
  TextNode,
  TextPageFieldSegment,
  TextSegment,
} from './types.js';
export {
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  PAGE_FIELDS,
  TABLE_COLUMN_ALIGNMENTS,
} from './types.js';
