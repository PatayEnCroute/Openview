import type { Expression, PrintableExpression } from '../expression/expression.js';
import type { BoxStyle, Typography } from '../style/style.js';

interface NodeBase {
  /** Unique and stable identifier of the node. */
  readonly id: string;
  /**
   * Asks a renderer to keep each materialised occurrence of this node on a single page. Absence
   * permits fragmentation without ordering it, and an occurrence no fresh page can hold falls back
   * to the ordinary policy of its kind.
   *
   * @see docs/adr/0009-les-blocs-insecables.md
   */
  readonly keepTogether?: true | undefined;
}

/** Static raw text segment. */
export interface TextLiteralSegment {
  readonly kind: 'literal';
  readonly text: string;
  readonly typography?: Typography | undefined;
}

/** Dynamic text segment bound to a printable expression. */
export interface TextBindingSegment {
  readonly kind: 'binding';
  readonly value: PrintableExpression;
  readonly typography?: Typography | undefined;
}

/** Available pagination fields for text segments. */
export const PAGE_FIELDS = ['number', 'count'] as const;

export type PageField = (typeof PAGE_FIELDS)[number];

/** Pagination text segment (current page number or total page count). */
export interface TextPageFieldSegment {
  readonly kind: 'pageField';
  readonly field: PageField;
  readonly typography?: Typography | undefined;
}

export type TextSegment = TextLiteralSegment | TextBindingSegment | TextPageFieldSegment;

/** Text block node composed of inline text segments. */
export interface TextNode extends NodeBase {
  readonly type: 'text';
  readonly content: readonly TextSegment[];
  readonly box?: BoxStyle | undefined;
  readonly typography?: Typography | undefined;
  readonly align?: TextAlignment | undefined;
}

/** Image block node. */
export interface ImageNode extends NodeBase {
  readonly type: 'image';
  readonly src: string;
  readonly alt?: string | undefined;
  readonly box?: BoxStyle | undefined;
}

/** Container block node holding child blocks. */
export interface ContainerNode extends NodeBase {
  readonly type: 'container';
  readonly children: readonly BlockNode[];
  readonly box?: BoxStyle | undefined;
}

/** Loop block node repeating children for each item in the `each` sequence. */
export interface LoopNode extends NodeBase {
  readonly type: 'loop';
  readonly each: Expression;
  readonly as: string;
  readonly children: readonly BlockNode[];
}

/** Conditional block node rendering children only when `when` evaluates to true. */
export interface ConditionNode extends NodeBase {
  readonly type: 'condition';
  readonly when: Expression;
  readonly children: readonly BlockNode[];
}

/** Supported table column alignments. */
export const TABLE_COLUMN_ALIGNMENTS = ['start', 'center', 'end'] as const;

export type TableColumnAlignment = (typeof TABLE_COLUMN_ALIGNMENTS)[number];

/** Supported text block alignments (includes justify). */
export const TEXT_ALIGNMENTS = [...TABLE_COLUMN_ALIGNMENTS, 'justify'] as const;

export type TextAlignment = (typeof TEXT_ALIGNMENTS)[number];

export const MIN_COLUMN_WIDTH = 1;
export const MAX_COLUMN_WIDTH = 1000;

/** Table column definition (id, relative width weight, and alignment). */
export interface TableColumn {
  readonly id: string;
  readonly width: number;
  readonly align: TableColumnAlignment;
}

/** Table row cell bound to a column via `columnId`. */
export interface TableCell {
  readonly columnId: string;
  readonly children: readonly BlockNode[];
}

/** Table row node. */
export interface TableRowNode extends NodeBase {
  readonly type: 'tableRow';
  readonly cells: readonly TableCell[];
  readonly box?: BoxStyle | undefined;
}

/** Group of rows repeated for each item in the `each` sequence. */
export interface TableRowGroupNode extends NodeBase {
  readonly type: 'tableRowGroup';
  readonly each: Expression;
  readonly as: string;
  readonly rows: readonly TableRowNode[];
}

export type TableBodyNode = TableRowNode | TableRowGroupNode;

/** Table block node structured into columns, header, body, and footer. */
export interface TableNode extends NodeBase {
  readonly type: 'table';
  readonly columns: readonly TableColumn[];
  readonly header: readonly TableRowNode[];
  readonly body: readonly TableBodyNode[];
  readonly footer: readonly TableRowNode[];
  readonly box?: BoxStyle | undefined;
}

/** Nodes allowed in the block flow. */
export type BlockNode = TextNode | ImageNode | ContainerNode | LoopNode | ConditionNode | TableNode;

/** Complete union of document AST nodes. */
export type DocumentNode = BlockNode | TableRowNode | TableRowGroupNode;

export type BlockNodeType = BlockNode['type'];
export type DocumentNodeType = DocumentNode['type'];
