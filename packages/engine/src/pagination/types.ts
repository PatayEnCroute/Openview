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

/** Fragment of a text block, including run slice and edge classification. */
export interface TextFragment {
  readonly kind: 'text';
  readonly source: MaterialText;
  readonly runs: readonly MaterialRun[];
  readonly from: TextCursor;
  readonly to: TextCursor;
  readonly edge: FragmentEdge;
}

/** Fragment containing a complete image block (images are always atomic). */
export interface ImageFragment {
  readonly kind: 'image';
  readonly source: MaterialImage;
}

/** Fragment containing a complete grid block (grids are always atomic). */
export interface GridFragment {
  readonly kind: 'grid';
  readonly source: MaterialGrid;
}

/** Fragment of a container block with sliced child content. */
export interface ContainerFragment {
  readonly kind: 'container';
  readonly source: MaterialContainer;
  readonly children: readonly MaterialFragment[];
  readonly edge: FragmentEdge;
}

/** Fragment of a table cell with sliced child content. */
export interface CellFragment {
  readonly source: MaterialCell;
  readonly children: readonly MaterialFragment[];
}

/** Fragment of a table row with sliced cell content. */
export interface RowFragment {
  readonly source: MaterialRow;
  readonly cells: readonly CellFragment[];
  readonly edge: FragmentEdge;
}

/** Fragment of a table block, including header, body rows, and optional footer. */
export interface TableFragment {
  readonly kind: 'table';
  readonly source: MaterialTable;
  readonly header: readonly RowFragment[];
  readonly rows: readonly RowFragment[];
  readonly footerFrom: number;
  readonly includesFooterEnd: boolean;
  readonly edge: FragmentEdge;
}

/** Union of all material fragment types produced during pagination. */
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

/** Union of cursor types for different block kinds during pagination. */
export type BlockCursor = TextBlockCursor | ContainerBlockCursor | TableBlockCursor;

/** Cursor tracking line position within a text block. */
export interface TextBlockCursor {
  readonly kind: 'text';
  readonly line: number;
}

/** Cursor tracking nested flow progress within a container block. */
export interface ContainerBlockCursor {
  readonly kind: 'container';
  readonly flow: FlowCursor;
}

/** Cursor tracking row and cell progress within a table block. */
export interface TableBlockCursor {
  readonly kind: 'table';
  readonly row: number;
  readonly inner: RowBlockCursor | undefined;
}

/** Progress cursors for individual cells across columns in a split table row. */
export interface RowBlockCursor {
  readonly cells: readonly FlowCursor[];
}

/** Initial cursor position representing the start of flow content. */
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
