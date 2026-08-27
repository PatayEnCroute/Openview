import type { Expression, PrintableExpression, RoundMode } from '../expression/expression.js';
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

/**
 * What the runtime requires at the exact position a value is read.
 *
 * A closed vocabulary, not a type system. It lives with the AST because a position is a property of
 * the AST; which declared natures satisfy a position is a property of the catalogue.
 */
export const DATA_EXPECTATIONS = [
  'any',
  'printable',
  'number',
  'boolean',
  'text',
  'civil-date',
  'primitive',
  'orderable',
  'list',
] as const;

export type DataExpectation = (typeof DATA_EXPECTATIONS)[number];

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
export const PAGE_FIELDS = ['number', 'count', 'report'] as const;

export type PageField = (typeof PAGE_FIELDS)[number];

/** Pagination text segment counting pages: the rank of this one, or how many there are. */
export interface TextPageCountSegment {
  readonly kind: 'pageField';
  readonly field: 'number' | 'count';
  readonly typography?: Typography | undefined;
}

/**
 * Pagination text segment showing what the pages before this one carried forward.
 *
 * Rounding is declared, never guessed: `decimals` and `mode` are the two parameters of a round
 * expression and are required here for the same reason. The writing is the canonical decimal one;
 * a currency symbol or a digit grouping belongs to a literal the model places beside it.
 */
export interface TextPageReportSegment {
  readonly kind: 'pageField';
  readonly field: 'report';
  readonly decimals: number;
  readonly mode: RoundMode;
  readonly typography?: Typography | undefined;
}

export type TextPageFieldSegment = TextPageCountSegment | TextPageReportSegment;

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

/**
 * What one materialised occurrence of a row adds to the report the pages carry forward.
 *
 * Evaluated in the row's own scope, once per occurrence, and required to yield a finite number.
 * The renderer decides which page an occurrence ends on; the model decides only what it is worth.
 */
export interface PageReportContribution {
  readonly value: PrintableExpression;
}

/** Table row node. */
export interface TableRowNode extends NodeBase {
  readonly type: 'tableRow';
  readonly cells: readonly TableCell[];
  /** Declarable on a body row alone: a header repeats and a footer is not a detail line. */
  readonly pageReport?: PageReportContribution | undefined;
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
