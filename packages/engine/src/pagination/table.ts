import type { MaterialRow, MaterialTable } from '../document/types.js';
import { refusal } from '../errors.js';
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
 * The longest run of rows of a table that fits, with its declared header repeated in front.
 *
 * The header is a preface: it is cloned onto every fragment that carries content and never advances
 * the cursor, so a fragment holding nothing but a repeated header is refused rather than kept. The
 * footer is not a preface: its rows follow the body once, and may start a page of their own.
 *
 * A row that no longer fits where it stands but would fit on a page of its own is moved there
 * whole. A row that fits on no page at all is split down its columns instead.
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
