import type {
  BoxStyle,
  Color,
  PageBandOccurrence,
  PageLayerPlane,
  PageMargins,
  PrintableArea,
  RoundMode,
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
 * A page counter that survived data binding unresolved.
 *
 * Its value is the rank of the page that ends up holding it, which is not known until the cuts are
 * chosen, so binding leaves the marker in place and page composition writes the digits.
 */
export interface MaterialPageCountRun {
  readonly kind: 'pageField';
  readonly field: 'number' | 'count';
  readonly typography: ResolvedTypography;
}

/**
 * A page report that survived data binding unresolved, with the rounding it is written at.
 *
 * Which rows ended before the page holding it is decided by the cuts, so the sum is composed with
 * them; the rounding travels here because the model declared it and nothing measures it.
 */
export interface MaterialPageReportRun {
  readonly kind: 'pageField';
  readonly field: 'report';
  readonly decimals: number;
  readonly mode: RoundMode;
  readonly typography: ResolvedTypography;
}

export type MaterialPageFieldRun = MaterialPageCountRun | MaterialPageReportRun;

export type MaterialRun = MaterialTextRun | MaterialPageFieldRun;

interface MaterialBase {
  /**
   * An occurrence key: unique inside one render, opaque outside it.
   *
   * A declaration id repeats once a loop has run, so it cannot address one measured box. This key
   * comes from a counter local to the render: it is never stored, never returned to the caller and
   * never promised stable between two renders.
   */
  readonly key: string;
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
  /** Occurrence key, unique inside one render. */
  readonly key: string;
  readonly columnId: string;
  readonly children: readonly MaterialBlock[];
}

/**
 * What one materialised occurrence of a row is worth to the pages that follow it.
 *
 * `order` is the rank the row was materialised at, zero-based and reset per render. Summing in that
 * order rather than in the order boxes come back makes the total reproducible, which an IEEE-754
 * addition of the same terms in another order does not guarantee.
 */
export interface MaterialPageReport {
  /** Occurrence key, unique inside one render. */
  readonly key: string;
  readonly order: number;
  readonly value: number;
}

/**
 * One occurrence of a marked row group: the rows a single item produced, as one unit.
 *
 * Shared by the rows it spans, so recognising the start of a group is comparing keys rather than
 * re-deriving a boundary. `firstRow` indexes the table's body-then-footer sequence; groups live in
 * the body, so it is also the index in the body.
 */
export interface MaterialRowGroupOccurrence {
  /** Occurrence key, unique inside one render. */
  readonly key: string;
  readonly nodeId: string;
  readonly path: readonly (string | number)[];
  readonly firstRow: number;
  readonly rowCount: number;
}

export interface MaterialRow extends MaterialBase {
  readonly cells: readonly MaterialCell[];
  readonly pageReport: MaterialPageReport | undefined;
  /** The marked group occurrence this row belongs to, when one asked to be kept whole. */
  readonly keptGroup: MaterialRowGroupOccurrence | undefined;
}

export interface MaterialTable extends MaterialBase {
  readonly kind: 'table';
  readonly columns: readonly TableColumn[];
  readonly header: readonly MaterialRow[];
  readonly body: readonly MaterialRow[];
  readonly footer: readonly MaterialRow[];
}

/** One zone of a materialised grid, with its spans resolved to at least one track. */
export interface MaterialGridItem {
  readonly row: number;
  readonly column: number;
  readonly rowSpan: number;
  readonly columnSpan: number;
  readonly content: MaterialContainer;
}

/**
 * A grid that survived data binding: declared tracks, a vertical step in millimetres, and one
 * bound container per zone. Atomic for pagination -- it is placed whole, deferred whole or refused.
 */
export interface MaterialGrid extends MaterialBase {
  readonly kind: 'grid';
  readonly columns: number;
  readonly rows: number;
  readonly step: number;
  readonly items: readonly MaterialGridItem[];
}

/**
 * A block that survived data binding. Loops and conditions have no counterpart here: a loop became
 * its ordered occurrences, and a false condition became nothing at all.
 */
export type MaterialBlock =
  | MaterialText
  | MaterialImage
  | MaterialContainer
  | MaterialTable
  | MaterialGrid;

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
 * One declared page layer, bound once per render and painted identically on every page.
 *
 * The markers of its content stay unresolved until composition, so each page writes its own rank
 * into the same materialised layer without re-running any expression.
 */
export interface MaterialPageLayer {
  readonly plane: PageLayerPlane;
  readonly opacity: number | undefined;
  readonly content: MaterialContainer;
}

/**
 * A whole document with no expression left to run: the sheet, its margins, its printable area, the
 * bands declared on each side, the page layers of each plane and the root flow.
 *
 * Internal to the engine on purpose. It never enters from outside, is never stored and is never
 * exported as an integration payload, so it carries no Zod schema and no schema version.
 */
export interface MaterialDocument {
  readonly sheet: Sheet;
  readonly margins: PageMargins;
  readonly printable: PrintableArea;
  readonly backgroundLayers: readonly MaterialPageLayer[];
  readonly headerBands: readonly MaterialPageBand[];
  readonly root: readonly MaterialBlock[];
  readonly footerBands: readonly MaterialPageBand[];
  readonly foregroundLayers: readonly MaterialPageLayer[];
}
