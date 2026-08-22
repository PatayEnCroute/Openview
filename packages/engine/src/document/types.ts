import type {
  BoxStyle,
  Color,
  PageBandOccurrence,
  PageField,
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

/** One inline run of text already produced by data binding. */
export interface MaterialTextRun {
  readonly kind: 'text';
  readonly text: string;
  readonly typography: ResolvedTypography;
}

/**
 * A page marker that survived data binding unresolved.
 *
 * Its value is the rank of the page that ends up holding it, which is not known until the cuts are
 * chosen, so binding leaves the marker in place and page composition writes the digits.
 */
export interface MaterialPageFieldRun {
  readonly kind: 'pageField';
  readonly field: PageField;
  readonly typography: ResolvedTypography;
}

export type MaterialRun = MaterialTextRun | MaterialPageFieldRun;

/**
 * An occurrence key: unique inside one render, opaque outside it.
 *
 * A declaration id repeats once a loop has run, so it cannot address one measured box. This key
 * comes from a counter local to the render: it is never stored, never returned to the caller and
 * never promised stable between two renders.
 */
export type OccurrenceKey = string;

interface MaterialBase {
  readonly key: OccurrenceKey;
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
  readonly key: OccurrenceKey;
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
 * One declared band, bound once, with the page domain that decides where it appears.
 *
 * The domain is kept beside the content rather than resolved at binding time: the same band is
 * painted on several pages, and which pages those are is only known once the cuts exist.
 */
export interface MaterialPageBand {
  readonly on: PageBandOccurrence;
  readonly content: MaterialContainer;
}

/**
 * A whole document with no expression left to run: the sheet, its margins, its printable area, the
 * bands declared on each side and the root flow.
 *
 * Internal to the engine on purpose. It never enters from outside, is never stored and is never
 * exported as an integration payload, so it carries no Zod schema and no schema version.
 */
export interface MaterialDocument {
  readonly sheet: Sheet;
  readonly margins: PageMargins;
  readonly printable: PrintableArea;
  readonly headerBands: readonly MaterialPageBand[];
  readonly root: readonly MaterialBlock[];
  readonly footerBands: readonly MaterialPageBand[];
}
