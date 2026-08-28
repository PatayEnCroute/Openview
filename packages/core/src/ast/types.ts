import type { Expression, PrintableExpression, RoundMode } from '../expression/expression.js';
import type { BoxStyle, Typography } from '../style/style.js';

interface NodeBase {
  /** Unique and stable identifier of the node. */
  readonly id: string;
  /**
   * Asks renderer to keep each materialised occurrence of this node on a single page.
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

/**
 * The writing functions a stored site can name, one per presentation formatter.
 *
 * Closed on purpose: a percentage, a unit or a scientific notation would be a fourth function with
 * no contract behind it, and inferring one from a path or a value would reserve a business meaning.
 */
export const PRESENTATION_FORMAT_KINDS = ['money', 'decimal', 'date'] as const;

export type PresentationFormatKind = (typeof PRESENTATION_FORMAT_KINDS)[number];

/**
 * The writing one site asks for: which function, and under which logical profile.
 *
 * The profile is a name its author owns -- `amount`, `quantity`, anything -- and never a key of the
 * presentation table. The caller maps profiles to declared writings at render time, so the same
 * stored site prints in another language and another currency without being edited.
 */
export interface PresentationFormat {
  readonly kind: PresentationFormatKind;
  readonly profile: string;
}

/** A site whose value is a number: an amount or a plain decimal, never a date. */
export interface NumericPresentationFormat {
  readonly kind: 'money' | 'decimal';
  readonly profile: string;
}

/** A site whose value is a plain decimal: a counter is neither money nor a date. */
export interface DecimalPresentationFormat {
  readonly kind: 'decimal';
  readonly profile: string;
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
  /** The writing this position asks for. Absent means the canonical, unlocalised form. */
  readonly format?: PresentationFormat | undefined;
  readonly typography?: Typography | undefined;
}

/** Available pagination fields for text segments. */
export const PAGE_FIELDS = ['number', 'count', 'report'] as const;

export type PageField = (typeof PAGE_FIELDS)[number];

/** Pagination text segment counting pages: the rank of this one, or how many there are. */
export interface TextPageCountSegment {
  readonly kind: 'pageField';
  readonly field: 'number' | 'count';
  /** A counter is a whole number of pages: a currency or a date would have nothing to write. */
  readonly format?: DecimalPresentationFormat | undefined;
  readonly typography?: Typography | undefined;
}

/**
 * Pagination text segment showing what the pages before this one carried forward.
 *
 * Rounding is declared, never guessed: `decimals` and `mode` are the two parameters of a round
 * expression and are required here for the same reason. Without `format` the writing is the
 * canonical decimal one and a symbol belongs to a literal beside it; with one, the rounding still
 * runs before the formatter sees the value.
 */
export interface TextPageReportSegment {
  readonly kind: 'pageField';
  readonly field: 'report';
  readonly decimals: number;
  readonly mode: RoundMode;
  /** An amount or a plain decimal. The rounding above still runs first, whatever the writing. */
  readonly format?: NumericPresentationFormat | undefined;
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

/** Minimum allowed width value for table columns. */
export const MIN_COLUMN_WIDTH = 1;

/** Maximum allowed width value for table columns. */
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

/** Union of row types allowed in table body section. */
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

/** Minimum number of tracks a grid declares on each axis. */
export const MIN_GRID_TRACKS = 1;

/** Maximum number of tracks a grid declares on each axis. */
export const MAX_GRID_TRACKS = 1000;

/**
 * One rectangular zone of a grid: a 1-based position, optional spans, and a container of blocks.
 *
 * A structural value, not a document node: the container carries the stable id, the style and the
 * children. An absent span means one track; a written span starts at two, so one fact has one
 * persisted spelling.
 */
export interface GridItem {
  readonly row: number;
  readonly column: number;
  readonly rowSpan?: number | undefined;
  readonly columnSpan?: number | undefined;
  readonly content: ContainerNode;
}

/**
 * Grid block node: equal-width columns, rows of a declared vertical step, and rectangular zones
 * that never overlap.
 *
 * The width of a column is derived from the parent's content width; only the vertical step is
 * stored, in millimeters. The grid's content height is exactly `rows * step`: content never
 * resizes a track.
 */
export interface GridNode extends NodeBase {
  readonly type: 'grid';
  readonly columns: number;
  readonly rows: number;
  /** Height of one grid row inside the content box, in millimeters. */
  readonly step: number;
  readonly items: readonly GridItem[];
  readonly box?: BoxStyle | undefined;
}

/** Nodes allowed in the block flow. */
export type BlockNode =
  | TextNode
  | ImageNode
  | ContainerNode
  | LoopNode
  | ConditionNode
  | TableNode
  | GridNode;

/** Complete union of document AST nodes. */
export type DocumentNode = BlockNode | TableRowNode | TableRowGroupNode;

export type BlockNodeType = BlockNode['type'];
export type DocumentNodeType = DocumentNode['type'];
