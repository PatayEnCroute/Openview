import type { MaterialRow } from '../document/types.js';
import type {
  CellFragment,
  FlowCursor,
  FlowFill,
  Metrics,
  RowBlockCursor,
  RowFragment,
} from './types.js';
import { boxPaddingPx, FLOW_START } from './types.js';

/** One fragment of a row split down its columns, and what the split consumed. */
export interface RowPlacement {
  readonly fragment: RowFragment;
  readonly height: number;
  /** Where each cell stands afterwards, or `undefined` once every cell is spent. */
  readonly remaining: RowBlockCursor | undefined;
}

const spent = (cursor: FlowCursor, cells: number): boolean =>
  cursor.index >= cells && cursor.inner === undefined;

/**
 * Splits one row into a fragment by advancing the vertical flow of each of its cells at once.
 *
 * A row is atomic while a fresh page can hold it; this is the case where none can, which is what
 * makes a table nested inside a cell paginable at all. Every cell keeps its column and its width,
 * a cell whose own flow is spent stays present and empty, and the fragment is as tall as its
 * tallest cell. At least one cell must advance, or nothing is placed.
 */
export function placeRow(
  row: MaterialRow,
  cursor: RowBlockCursor | undefined,
  available: number,
  fresh: number,
  metrics: Metrics,
  fill: FlowFill,
): RowPlacement | undefined {
  const padding = boxPaddingPx(row.box, metrics.pxPerMm);
  const room = available - padding;
  const freshRoom = fresh - padding;
  if (room <= 0) {
    return undefined;
  }

  const before = row.cells.map((_cell, index) => cursor?.cells[index] ?? FLOW_START);
  const cells: CellFragment[] = [];
  const after: FlowCursor[] = [];
  let tallest = 0;
  let advanced = false;

  for (const [index, cell] of row.cells.entries()) {
    const from = before[index] ?? FLOW_START;
    if (spent(from, cell.children.length)) {
      cells.push({ source: cell, children: [] });
      after.push(from);
      continue;
    }
    const placed = fill(cell.children, from, room, freshRoom, metrics);
    cells.push({ source: cell, children: placed.fragments });
    after.push(placed.cursor);
    if (placed.fragments.length > 0) {
      advanced = true;
      tallest = Math.max(tallest, placed.height);
    }
  }

  if (!advanced) {
    return undefined;
  }

  const done = row.cells.every((cell, index) => {
    const at = after[index];
    return at !== undefined && spent(at, cell.children.length);
  });
  const first = cursor === undefined;
  return {
    height: padding + tallest,
    remaining: done ? undefined : { cells: after },
    fragment: {
      source: row,
      cells,
      edge: first && done ? 'whole' : first ? 'first' : done ? 'last' : 'middle',
    },
  };
}
