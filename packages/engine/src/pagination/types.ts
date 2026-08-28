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

/** Position within text runs indicated by run index and character offset. */
export interface TextCursor {
  readonly run: number;
  readonly offset: number;
}

export interface TextFragment {
  readonly kind: 'text';
  readonly source: MaterialText;
  readonly runs: readonly MaterialRun[];
  readonly from: TextCursor;
  readonly to: TextCursor;
  readonly edge: FragmentEdge;
}

export interface ImageFragment {
  readonly kind: 'image';
  readonly source: MaterialImage;
}

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
  readonly header: readonly RowFragment[];
  readonly rows: readonly RowFragment[];
  readonly footerFrom: number;
  readonly includesFooterEnd: boolean;
  readonly edge: FragmentEdge;
}

export type MaterialFragment =
  | TextFragment
  | ImageFragment
  | ContainerFragment
  | TableFragment
  | GridFragment;

/** Progress cursor through a vertical sequence of blocks. */
export interface FlowCursor {
  readonly index: number;
  readonly inner: BlockCursor | undefined;
}

export type BlockCursor = TextBlockCursor | ContainerBlockCursor | TableBlockCursor;

export interface TextBlockCursor {
  readonly kind: 'text';
  readonly line: number;
}

export interface ContainerBlockCursor {
  readonly kind: 'container';
  readonly flow: FlowCursor;
}

export interface TableBlockCursor {
  readonly kind: 'table';
  readonly row: number;
  readonly inner: RowBlockCursor | undefined;
}

/** Progress cursors for individual cells across columns in a split table row. */
export interface RowBlockCursor {
  readonly cells: readonly FlowCursor[];
}

export const FLOW_START: FlowCursor = { index: 0, inner: undefined };

/** Composed page output with metadata, fragments, and band blocks. */
export interface MaterialPage {
  readonly number: number;
  readonly count: number;
  readonly incomingReport: number;
  readonly completedBy: readonly MaterialRow[];
  readonly header: readonly MaterialBlock[];
  readonly root: readonly MaterialFragment[];
  readonly footer: readonly MaterialBlock[];
}

/** Marker reservation mapping for placeholder and width calculation. */
export interface MarkerReserve {
  widthOf(run: MaterialPageFieldRun): number;
  placeholderOf(run: MaterialPageFieldRun): string;
}

/** Fully paginated document containing sliced pages and layout metadata. */
export interface PaginatedDocument {
  readonly sheet: Sheet;
  readonly margins: PageMargins;
  readonly printable: PrintableArea;
  readonly headerReserve: number;
  readonly footerReserve: number;
  readonly backgroundLayers: readonly MaterialPageLayer[];
  readonly foregroundLayers: readonly MaterialPageLayer[];
  readonly pages: readonly MaterialPage[];
  readonly markers: MarkerReserve;
}

/** Visual line metric details for text boxes. */
export interface LineMetric {
  readonly run: number;
  readonly offset: number;
  readonly height: number;
}

/** Layout measurement query interface for pagination. */
export interface Metrics {
  readonly pxPerMm: number;
  height(key: string): number;
  lines(key: string): readonly LineMetric[];
}

/** Result of placing a flow slice into available vertical space. */
export interface Placement {
  readonly fragments: readonly MaterialFragment[];
  readonly height: number;
  readonly cursor: FlowCursor;
}

/** Flow fill function signature for recursive block placement. */
export type FlowFill = (
  blocks: readonly MaterialBlock[],
  cursor: FlowCursor,
  available: number,
  fresh: number,
  metrics: Metrics,
) => Placement;

/** Determines the fragment edge position based on open/close flags. */
export function fragmentEdge(first: boolean, done: boolean): FragmentEdge {
  if (first) {
    return done ? 'whole' : 'first';
  }
  return done ? 'last' : 'middle';
}

/** Computes vertical padding of a box style in CSS pixels. */
export function boxPaddingPx(box: BoxStyle | undefined, pxPerMm: number): number {
  const padding = box?.padding;
  return padding === undefined ? 0 : (padding.top + padding.bottom) * pxPerMm;
}
