/**
 * Dispatch over the document Composite: one exhaustive entry point per union.
 *
 * The traversals derived from a node -- children, reads, data paths -- live in `traverse.ts`, and
 * the single description they derive from lives in `shape.ts`.
 */
import { kindOf } from '../expression/value-type.js';
import type {
  ConditionNode,
  ContainerNode,
  DocumentNode,
  ImageNode,
  LoopNode,
  TableNode,
  TableRowGroupNode,
  TableRowNode,
  TextBindingSegment,
  TextLiteralSegment,
  TextNode,
  TextPageFieldSegment,
  TextSegment,
} from './nodes.js';

/**
 * Visitor interface for exhaustive traversal over the Composite AST.
 */
export interface NodeVisitor<TResult> {
  readonly text: (node: TextNode) => TResult;
  readonly image: (node: ImageNode) => TResult;
  readonly container: (node: ContainerNode) => TResult;
  readonly loop: (node: LoopNode) => TResult;
  readonly condition: (node: ConditionNode) => TResult;
  readonly table: (node: TableNode) => TResult;
  readonly tableRowGroup: (node: TableRowGroupNode) => TResult;
  readonly tableRow: (node: TableRowNode) => TResult;
}

/**
 * Dispatches an AST node to the matching visitor method with compile-time exhaustiveness check.
 */
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
    case 'table':
      return visitor.table(node);
    case 'tableRowGroup':
      return visitor.tableRowGroup(node);
    case 'tableRow':
      return visitor.tableRow(node);
    default: {
      const exhaustive: never = node;
      throw new TypeError(`Unhandled document node: ${kindOf(exhaustive, 'type')}`);
    }
  }
}

/** Visitor for inline text segments. */
export interface SegmentVisitor<TResult> {
  readonly literal: (segment: TextLiteralSegment) => TResult;
  readonly binding: (segment: TextBindingSegment) => TResult;
  readonly pageField: (segment: TextPageFieldSegment) => TResult;
}

/** Dispatches a text segment to the matching visitor method. */
export function visitSegment<TResult>(
  segment: TextSegment,
  visitor: SegmentVisitor<TResult>,
): TResult {
  switch (segment.kind) {
    case 'literal':
      return visitor.literal(segment);
    case 'binding':
      return visitor.binding(segment);
    case 'pageField':
      return visitor.pageField(segment);
    default: {
      const exhaustive: never = segment;
      throw new TypeError(`Unhandled text segment: ${kindOf(exhaustive, 'kind')}`);
    }
  }
}
