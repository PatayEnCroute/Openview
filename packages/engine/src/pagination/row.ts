import type { MaterialRow } from '../document/types.js';
import type {
  CellFragment,
  FlowCursor,
  FlowFill,
  Metrics,
  RowBlockCursor,
  RowFragment,
} from './types.js';
import { boxPaddingPx, FLOW_START, fragmentEdge } from './types.js';

/** Placement result for a split row fragment across columns. */
export interface RowPlacement {
  readonly fragment: RowFragment;
  readonly height: number;
  /** Where each cell stands afterwards, or `undefined` once every cell is spent. */
  readonly remaining: RowBlockCursor | undefined;
}

const spent = (cursor: FlowCursor, cells: number): boolean =>
  cursor.index >= cells && cursor.inner === undefined;

/**
 * Splits a table row across pages by advancing vertical flow inside each cell.
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
      edge: fragmentEdge(first, done),
    },
  };
}
