import type {
  BoxStyle,
  Color,
  OccurrenceReference,
  PageBandOccurrence,
  PageLayerPlane,
  PageMargins,
  PrintableArea,
  RoundMode,
  Sheet,
  TableColumn,
  TextAlignment,
} from '@openview/core';
import type { DocumentRenderErrorDetails } from '../errors.js';
import type { ResolvedFontFace } from './fonts/types.js';
import type { MarkerWriting } from './presentation.js';

/**
 * A typography with no property left to resolve, carried by every run of the document.
 *
 * The face is a resolved identity rather than the declared name: no free string reaches the css, so
 * the browser can neither prefer a local installation of the same typeface nor continue past it.
 * Weight and slant live in the face, so a run cannot ask for a boldness its face does not carry.
 */
export interface ResolvedTypography {
  readonly face: ResolvedFontFace;
  readonly sizePt: number;
  readonly color: Color;
}

/** One inline run of text produced by data binding. */
export interface MaterialTextRun {
  readonly kind: 'text';
  readonly text: string;
  readonly typography: ResolvedTypography;
}

/** A page counter run to be populated during page composition. */
export interface MaterialPageCountRun {
  readonly kind: 'pageField';
  readonly field: 'number' | 'count';
  /**
   * Where this marker was declared, kept so a late refusal can name its site.
   *
   * The digits of a marker are written long after binding -- in the width probe and again when a
   * page knows its own rank -- and both places may meet a character the face cannot draw. Location
   * only: no value, no text, and it crosses no public contract.
   */
  readonly site: DocumentRenderErrorDetails;
  /** The writing this counter resolved, when its site declared one. */
  readonly writing?: MarkerWriting | undefined;
  readonly typography: ResolvedTypography;
}

/** A page report run to be populated during page composition with cumulative values. */
export interface MaterialPageReportRun {
  readonly kind: 'pageField';
  readonly field: 'report';
  readonly decimals: number;
  readonly mode: RoundMode;
  /** Where this marker was declared, kept so a late refusal can name its site. */
  readonly site: DocumentRenderErrorDetails;
  /** Resolved writing format for this report marker. */
  readonly writing?: MarkerWriting | undefined;
  readonly typography: ResolvedTypography;
}

export type MaterialPageFieldRun = MaterialPageCountRun | MaterialPageReportRun;

export type MaterialRun = MaterialTextRun | MaterialPageFieldRun;

/** Base interface for materialized occurrences with render-internal keys and box styles. */
interface MaterialBase extends OccurrenceReference {
  /** Unique occurrence key within a single render execution. */
  readonly key: string;
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

/** One cell per declared column in column order. */
export interface MaterialCell {
  readonly key: string;
  readonly columnId: string;
  readonly children: readonly MaterialBlock[];
}

/** Page report contribution declared on a table row. */
export interface MaterialPageReport {
  readonly key: string;
  readonly order: number;
  readonly value: number;
}

/** Group occurrence spanning rows produced by a single iterated table item. */
export interface MaterialRowGroupOccurrence extends OccurrenceReference {
  readonly key: string;
  readonly firstRow: number;
  readonly rowCount: number;
}

export interface MaterialRow extends MaterialBase {
  readonly cells: readonly MaterialCell[];
  readonly pageReport: MaterialPageReport | undefined;
  /** Group occurrence this row belongs to, when marked to stay whole. */
  readonly keptGroup: MaterialRowGroupOccurrence | undefined;
}

export interface MaterialTable extends MaterialBase {
  readonly kind: 'table';
  readonly columns: readonly TableColumn[];
  readonly header: readonly MaterialRow[];
  readonly body: readonly MaterialRow[];
  readonly footer: readonly MaterialRow[];
}

/** Grid zone with resolved track spans and bound container content. */
export interface MaterialGridItem {
  readonly row: number;
  readonly column: number;
  readonly rowSpan: number;
  readonly columnSpan: number;
  readonly content: MaterialContainer;
}

/** Materialized grid block with track definitions and zone items. */
export interface MaterialGrid extends MaterialBase {
  readonly kind: 'grid';
  readonly columns: number;
  readonly rows: number;
  readonly step: number;
  readonly items: readonly MaterialGridItem[];
}

/** Block element in the materialized document hierarchy. */
export type MaterialBlock =
  | MaterialText
  | MaterialImage
  | MaterialContainer
  | MaterialTable
  | MaterialGrid;

/** Page band with its occurrence domain and bound container content. */
export interface MaterialPageBand {
  readonly on: PageBandOccurrence;
  readonly content: MaterialContainer;
}

/** Page layer with its plane, opacity, and bound container content. */
export interface MaterialPageLayer {
  readonly plane: PageLayerPlane;
  readonly opacity: number | undefined;
  readonly content: MaterialContainer;
}

/** Fully bound document hierarchy ready for layout measurement and pagination. */
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
