import type { BoxStyle, PageMargins, PrintableArea, Sheet } from '@openview/core';
import type {
  MaterialBlock,
  MaterialCell,
  MaterialContainer,
  MaterialGrid,
  MaterialImage,
  MaterialPageFieldRun,
  MaterialPageLayer,
  MaterialRow,
  MaterialRun,
  MaterialTable,
  MaterialText,
} from '../document/types.js';

/** Where a fragment sits in the sequence its source was cut into. */
export type FragmentEdge = 'whole' | 'first' | 'middle' | 'last';

/**
 * A position inside the runs of a text block: the run, then a utf-16 offset inside it.
 *
 * Only ever built from a line end the browser reported, never from an index the engine guessed.
 */
export interface TextCursor {
  readonly run: number;
  readonly offset: number;
}

export interface TextFragment {
  readonly kind: 'text';
  readonly source: MaterialText;
  /** The sliced runs, in source order, with the source typography of each kept intact. */
  readonly runs: readonly MaterialRun[];
  readonly from: TextCursor;
  readonly to: TextCursor;
  readonly edge: FragmentEdge;
}

/** An image is atomic: it has no fragment other than itself. */
export interface ImageFragment {
  readonly kind: 'image';
  readonly source: MaterialImage;
}

/** A grid is atomic: placed whole, deferred whole, or refused. Never cut between its rows. */
export interface GridFragment {
  readonly kind: 'grid';
  readonly source: MaterialGrid;
}

export interface ContainerFragment {
  readonly kind: 'container';
  readonly source: MaterialContainer;
  readonly children: readonly MaterialFragment[];
  readonly edge: FragmentEdge;
}

export interface CellFragment {
  readonly source: MaterialCell;
  /** Empty once the cell's own flow is spent: the column keeps its place and its width. */
  readonly children: readonly MaterialFragment[];
}

export interface RowFragment {
  readonly source: MaterialRow;
  readonly cells: readonly CellFragment[];
  readonly edge: FragmentEdge;
}

export interface TableFragment {
  readonly kind: 'table';
  readonly source: MaterialTable;
  /** The declared header rows, repeated whole on every fragment that continues the table. */
  readonly header: readonly RowFragment[];
  /** The body-then-footer rows this fragment carries, in order. */
  readonly rows: readonly RowFragment[];
  /** Index in `rows` where the table's own footer begins; equal to `rows.length` when it has none. */
  readonly footerFrom: number;
  /** Whether this fragment carries the end of the table, footer included. */
  readonly includesFooterEnd: boolean;
  readonly edge: FragmentEdge;
}

export type MaterialFragment =
  | TextFragment
  | ImageFragment
  | ContainerFragment
  | TableFragment
  | GridFragment;

/** Progress through a vertical sequence of blocks. Spent when `index` reaches the sequence length. */
export interface FlowCursor {
  readonly index: number;
  /** Partial progress inside the block at `index`, when one was started but not finished. */
  readonly inner: BlockCursor | undefined;
}

export type BlockCursor = TextBlockCursor | ContainerBlockCursor | TableBlockCursor;

export interface TextBlockCursor {
  readonly kind: 'text';
  /** Index of the next visual line to place. */
  readonly line: number;
}

export interface ContainerBlockCursor {
  readonly kind: 'container';
  readonly flow: FlowCursor;
}

export interface TableBlockCursor {
  readonly kind: 'table';
  /** Index into the body-then-footer sequence; the header is a preface and never advances it. */
  readonly row: number;
  readonly inner: RowBlockCursor | undefined;
}

/** One flow cursor per cell of a row being split down its columns. */
export interface RowBlockCursor {
  readonly cells: readonly FlowCursor[];
}

export const FLOW_START: FlowCursor = { index: 0, inner: undefined };

/** One finished page: its rank, the run it belongs to, and the boxes painted on it. */
export interface MaterialPage {
  readonly number: number;
  readonly count: number;
  /**
   * The sum the rows finished on earlier pages carry into this one, unrounded.
   *
   * Raw on purpose: every report marker declares the rounding it is written at, so two markers of
   * two roundings write two spellings of this one total.
   */
  readonly incomingReport: number;
  readonly header: readonly MaterialBlock[];
  readonly root: readonly MaterialFragment[];
  readonly footer: readonly MaterialBlock[];
}

/** The reserved width of one page marker, in css pixels, for the exact run being painted. */
export interface MarkerReserve {
  widthOf(run: MaterialPageFieldRun): number;
  /**
   * What a probe shows in a marker whose value the cuts have not decided yet.
   *
   * One of the strings the reserve was measured from, so it fits the box by construction: a probe
   * that overflowed its own marker would measure a line the print never has.
   */
  placeholderOf(run: MaterialPageFieldRun): string;
}

export interface PaginatedDocument {
  readonly sheet: Sheet;
  readonly margins: PageMargins;
  readonly printable: PrintableArea;
  /** Height reserved for the top band on every page, in millimetres. */
  readonly headerReserve: number;
  readonly footerReserve: number;
  /** Painted identically behind every page, in stored order; they reserve no height anywhere. */
  readonly backgroundLayers: readonly MaterialPageLayer[];
  /** Painted identically in front of every page, in stored order. */
  readonly foregroundLayers: readonly MaterialPageLayer[];
  readonly pages: readonly MaterialPage[];
  readonly markers: MarkerReserve;
}

/** One measured box, addressed by the occurrence key the engine annotated it with. */
export interface LineMetric {
  readonly run: number;
  readonly offset: number;
  /** Height from the content top of the block down to the bottom of this line. */
  readonly height: number;
}

/** Everything the paginator may read about a laid-out document. */
export interface Metrics {
  readonly pxPerMm: number;
  /** Natural border-box height of one occurrence, in css pixels. */
  height(key: string): number;
  /** Visual line ends of one text occurrence, in order. */
  lines(key: string): readonly LineMetric[];
}

/** What one attempt to fill a vertical sequence produced. */
export interface Placement {
  readonly fragments: readonly MaterialFragment[];
  readonly height: number;
  /** Where the sequence stands afterwards; equal to the incoming cursor when nothing fitted. */
  readonly cursor: FlowCursor;
}

/**
 * The recursion point of the paginator: the longest prefix of a vertical sequence that fits.
 *
 * @param available room left where the sequence starts on the page being filled
 * @param fresh room the same position would have on a page holding nothing else, which is what
 * decides whether an atomic block is deferred or refused
 */
export type FlowFill = (
  blocks: readonly MaterialBlock[],
  cursor: FlowCursor,
  available: number,
  fresh: number,
  metrics: Metrics,
) => Placement;

/**
 * Which part of its whole a fragment is, read from whether it opened it and whether it closed it.
 *
 * Spelt once because a flow, a row and a table all answer it the same way, and an edge that drifted
 * between them would paint a continuation rule where a document ends.
 */
export function fragmentEdge(first: boolean, done: boolean): FragmentEdge {
  if (first) {
    return done ? 'whole' : 'first';
  }
  return done ? 'last' : 'middle';
}

/** Vertical padding of a box in css pixels, which a fragment repeats on every page it spans. */
export function boxPaddingPx(box: BoxStyle | undefined, pxPerMm: number): number {
  const padding = box?.padding;
  return padding === undefined ? 0 : (padding.top + padding.bottom) * pxPerMm;
}
