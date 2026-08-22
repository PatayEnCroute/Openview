import type {
  BoxStyle,
  Color,
  PageMargins,
  PrintableArea,
  Sheet,
  TableColumn,
  TextAlignment,
} from '@openview/core';

/**
 * A typography with no absent property left. Every run of the document carries one, resolved from
 * the run then the block then the engine defaults -- never inherited from an enclosing dom node.
 */
export interface ResolvedTypography {
  readonly family: string;
  readonly sizePt: number;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly color: Color;
}

/** One inline run: text already produced, typography already complete. */
export interface MaterialRun {
  readonly text: string;
  readonly typography: ResolvedTypography;
}

interface MaterialBase {
  /** Id of the declaration this occurrence came from. Not unique once a loop has repeated it. */
  readonly nodeId: string;
  /**
   * Path from the template root to this occurrence, with the index of a repetition interleaved
   * where one happened. Carried for diagnostics only; nothing in the paint reads it.
   */
  readonly path: readonly (string | number)[];
  readonly box: BoxStyle | undefined;
  readonly keepTogether: boolean;
}

export interface MaterialText extends MaterialBase {
  readonly kind: 'text';
  readonly runs: readonly MaterialRun[];
  readonly align: TextAlignment;
}

export interface MaterialImage extends MaterialBase {
  readonly kind: 'image';
  readonly src: string;
  readonly alt: string | undefined;
}

export interface MaterialContainer extends MaterialBase {
  readonly kind: 'container';
  readonly children: readonly MaterialBlock[];
}

/** One cell per declared column, in column order. An unfilled column keeps an empty cell. */
export interface MaterialCell {
  readonly columnId: string;
  readonly children: readonly MaterialBlock[];
}

export interface MaterialRow extends MaterialBase {
  readonly cells: readonly MaterialCell[];
}

export interface MaterialTable extends MaterialBase {
  readonly kind: 'table';
  readonly columns: readonly TableColumn[];
  readonly header: readonly MaterialRow[];
  readonly body: readonly MaterialRow[];
  readonly footer: readonly MaterialRow[];
}

/**
 * A block that survived data binding. Loops and conditions have no counterpart here: a loop became
 * its ordered occurrences, and a false condition became nothing at all.
 */
export type MaterialBlock = MaterialText | MaterialImage | MaterialContainer | MaterialTable;

/**
 * A whole document with no expression left to run: the sheet, its margins, its printable area and
 * the three vertical regions in paint order.
 *
 * Internal to the engine on purpose. It never enters from outside, is never stored and is never
 * exported as an integration payload, so it carries no Zod schema and no schema version.
 */
export interface MaterialDocument {
  readonly sheet: Sheet;
  readonly margins: PageMargins;
  readonly printable: PrintableArea;
  readonly header: readonly MaterialBlock[];
  readonly root: readonly MaterialBlock[];
  readonly footer: readonly MaterialBlock[];
}
