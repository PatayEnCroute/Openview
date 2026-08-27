import type { MaterialRow, MaterialRowGroupOccurrence, MaterialTable } from '../document/types.js';
import { refusal } from '../errors.js';
import { decideKeepTogether } from './keep-together.js';
import { placeRow } from './row.js';
import type {
  FlowFill,
  Metrics,
  RowBlockCursor,
  RowFragment,
  TableBlockCursor,
  TableFragment,
} from './types.js';
import { boxPaddingPx } from './types.js';
import { wholeRow } from './whole.js';

const HEADER_TOO_TALL =
  'The repeated header of a table leaves no room for a single row of its body on a page of its own, so continuing the table would print header after header. Read `details.nodeId` for the table.';

/** One table fragment and what it consumed. */
export interface TablePlacement {
  readonly fragment: TableFragment;
  readonly height: number;
  readonly remaining: TableBlockCursor | undefined;
}

function headerHeight(header: readonly MaterialRow[], metrics: Metrics): number {
  let total = 0;
  for (const row of header) {
    total += metrics.height(row.key);
  }
  return total;
}

/**
 * The rows of a marked group occurrence starting exactly at `index`, or nothing.
 *
 * The occurrence has to START here: resuming inside a group that already fell back would offer it
 * a fresh page on every page it spans, and the sequence would never advance.
 */
function groupStartingAt(
  sequence: readonly MaterialRow[],
  index: number,
): MaterialRowGroupOccurrence | undefined {
  const group = sequence[index]?.keptGroup;
  return group !== undefined && group.firstRow === index ? group : undefined;
}

/** The natural height of the rows one group occurrence spans, header excluded. */
function groupHeight(
  sequence: readonly MaterialRow[],
  group: MaterialRowGroupOccurrence,
  metrics: Metrics,
): number {
  let total = 0;
  for (let at = group.firstRow; at < group.firstRow + group.rowCount; at += 1) {
    const row = sequence[at];
    if (row !== undefined) {
      total += metrics.height(row.key);
    }
  }
  return total;
}

/**
 * Places the maximum fitting slice of table rows onto a page with repeated header rows.
 */
export function placeTable(
  table: MaterialTable,
  cursor: TableBlockCursor | undefined,
  available: number,
  fresh: number,
  metrics: Metrics,
  fill: FlowFill,
): TablePlacement | undefined {
  const padding = boxPaddingPx(table.box, metrics.pxPerMm);
  const header = headerHeight(table.header, metrics);
  const overhead = padding + header;
  const sequence = [...table.body, ...table.footer];
  const start = cursor?.row ?? 0;

  if (overhead > fresh) {
    throw refusal(HEADER_TOO_TALL, 'pagination-impossible', {
      nodeId: table.nodeId,
      path: table.path,
    });
  }

  if (sequence.length === 0) {
    /* A table with no row is a legitimate document: it is painted once, header and all. */
    if (start > 0 || overhead > available) {
      return undefined;
    }
    return {
      height: overhead,
      remaining: undefined,
      fragment: {
        kind: 'table',
        source: table,
        header: table.header.map(wholeRow),
        rows: [],
        footerFrom: 0,
        includesFooterEnd: true,
        edge: 'whole',
      },
    };
  }

  const freshRoom = fresh - overhead;
  const rows: RowFragment[] = [];
  let used = 0;
  let room = available - overhead;
  let index = start;
  let inner: RowBlockCursor | undefined = cursor?.inner;

  while (index < sequence.length) {
    const row = sequence[index];
    if (row === undefined) {
      break;
    }
    const group = inner === undefined ? groupStartingAt(sequence, index) : undefined;
    if (group !== undefined) {
      const decision = decideKeepTogether(groupHeight(sequence, group, metrics), room, freshRoom);
      if (decision === 'defer') {
        break;
      }
      if (decision === 'whole') {
        for (let at = index; at < group.firstRow + group.rowCount; at += 1) {
          const kept = sequence[at];
          if (kept === undefined) {
            break;
          }
          const height = metrics.height(kept.key);
          rows.push(wholeRow(kept));
          used += height;
          room -= height;
        }
        index = group.firstRow + group.rowCount;
        continue;
      }
      /* Fell back: the rows of this occurrence take the ordinary policy from here on, one by one,
         and a row of its own that asks to stay whole is still honoured below. */
    }
    const height = metrics.height(row.key);
    if (inner === undefined && height <= room) {
      rows.push(wholeRow(row));
      used += height;
      room -= height;
      index += 1;
      continue;
    }
    if (inner === undefined && height <= freshRoom) {
      /* It fits on a page of its own, so it is moved there entire rather than cut. */
      break;
    }
    const placed = placeRow(row, inner, room, freshRoom, metrics, fill);
    if (placed === undefined) {
      break;
    }
    rows.push(placed.fragment);
    used += placed.height;
    room -= placed.height;
    if (placed.remaining !== undefined) {
      inner = placed.remaining;
      break;
    }
    inner = undefined;
    index += 1;
  }

  if (rows.length === 0) {
    if (freshRoom <= 0) {
      throw refusal(HEADER_TOO_TALL, 'pagination-impossible', {
        nodeId: table.nodeId,
        path: table.path,
      });
    }
    return undefined;
  }

  const done = index >= sequence.length && inner === undefined;
  const first = start === 0 && cursor?.inner === undefined;
  /* A row of `sequence` belongs to the footer once it is past the body, so where the footer starts
     inside this fragment is where the body ran out. */
  const footerFrom = Math.min(rows.length, Math.max(0, table.body.length - start));
  return {
    height: overhead + used,
    remaining: done ? undefined : { kind: 'table', row: index, inner },
    fragment: {
      kind: 'table',
      source: table,
      header: table.header.map(wholeRow),
      rows,
      footerFrom,
      includesFooterEnd: done,
      edge: first && done ? 'whole' : first ? 'first' : done ? 'last' : 'middle',
    },
  };
}
