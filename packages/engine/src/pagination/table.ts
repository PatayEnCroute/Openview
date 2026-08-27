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
import { boxPaddingPx, fragmentEdge } from './types.js';
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
  return group?.firstRow === index ? group : undefined;
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

/** A table with no row is a legitimate document: it is painted once, header and all. */
function placeHeaderOnly(
  table: MaterialTable,
  start: number,
  overhead: number,
  available: number,
): TablePlacement | undefined {
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

/** The rows taken for the page being filled, and where the sequence stands as the scan advances. */
interface RowScan {
  readonly rows: RowFragment[];
  used: number;
  room: number;
  index: number;
  inner: RowBlockCursor | undefined;
}

/** Takes every row of a marked group occurrence at once, and steps the scan past it. */
function takeWholeGroup(
  sequence: readonly MaterialRow[],
  group: MaterialRowGroupOccurrence,
  metrics: Metrics,
  scan: RowScan,
): void {
  for (let at = scan.index; at < group.firstRow + group.rowCount; at += 1) {
    const kept = sequence[at];
    if (kept === undefined) {
      break;
    }
    const height = metrics.height(kept.key);
    scan.rows.push(wholeRow(kept));
    scan.used += height;
    scan.room -= height;
  }
  scan.index = group.firstRow + group.rowCount;
}

/** What the keep-together mark of a group occurrence settles where the scan stands. */
type GroupOutcome = 'taken' | 'defer' | 'row-by-row';

/**
 * Reads the mark of a group occurrence starting where the scan stands.
 *
 * `row-by-row` covers both "no group starts here" and a group that fell back: its rows then take
 * the ordinary policy one by one, and a row of its own that asks to stay whole is still honoured.
 */
function settleGroup(
  sequence: readonly MaterialRow[],
  freshRoom: number,
  metrics: Metrics,
  scan: RowScan,
): GroupOutcome {
  const group = scan.inner === undefined ? groupStartingAt(sequence, scan.index) : undefined;
  if (group === undefined) {
    return 'row-by-row';
  }
  const decision = decideKeepTogether(groupHeight(sequence, group, metrics), scan.room, freshRoom);
  if (decision === 'defer') {
    return 'defer';
  }
  if (decision === 'whole') {
    takeWholeGroup(sequence, group, metrics, scan);
    return 'taken';
  }
  return 'row-by-row';
}

/** Takes one row, whole or cut, and answers whether the scan may go on past it. */
function takeRow(
  row: MaterialRow,
  freshRoom: number,
  metrics: Metrics,
  fill: FlowFill,
  scan: RowScan,
): boolean {
  const height = metrics.height(row.key);
  if (scan.inner === undefined && height <= scan.room) {
    scan.rows.push(wholeRow(row));
    scan.used += height;
    scan.room -= height;
    scan.index += 1;
    return true;
  }
  if (scan.inner === undefined && height <= freshRoom) {
    /* It fits on a page of its own, so it is moved there entire rather than cut. */
    return false;
  }
  const placed = placeRow(row, scan.inner, scan.room, freshRoom, metrics, fill);
  if (placed === undefined) {
    return false;
  }
  scan.rows.push(placed.fragment);
  scan.used += placed.height;
  scan.room -= placed.height;
  if (placed.remaining !== undefined) {
    scan.inner = placed.remaining;
    return false;
  }
  scan.inner = undefined;
  scan.index += 1;
  return true;
}

/** Fills the page with the longest run of rows it takes, from where the cursor stands. */
function scanRows(
  sequence: readonly MaterialRow[],
  freshRoom: number,
  metrics: Metrics,
  fill: FlowFill,
  scan: RowScan,
): void {
  while (scan.index < sequence.length) {
    const row = sequence[scan.index];
    if (row === undefined) {
      break;
    }
    const outcome = settleGroup(sequence, freshRoom, metrics, scan);
    if (outcome === 'defer') {
      break;
    }
    if (outcome === 'taken') {
      continue;
    }
    if (!takeRow(row, freshRoom, metrics, fill, scan)) {
      break;
    }
  }
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
    return placeHeaderOnly(table, start, overhead, available);
  }

  const freshRoom = fresh - overhead;
  const scan: RowScan = {
    rows: [],
    used: 0,
    room: available - overhead,
    index: start,
    inner: cursor?.inner,
  };
  scanRows(sequence, freshRoom, metrics, fill, scan);

  if (scan.rows.length === 0) {
    if (freshRoom <= 0) {
      throw refusal(HEADER_TOO_TALL, 'pagination-impossible', {
        nodeId: table.nodeId,
        path: table.path,
      });
    }
    return undefined;
  }

  const done = scan.index >= sequence.length && scan.inner === undefined;
  const first = start === 0 && cursor?.inner === undefined;
  /* A row of `sequence` belongs to the footer once it is past the body, so where the footer starts
     inside this fragment is where the body ran out. */
  const footerFrom = Math.min(scan.rows.length, Math.max(0, table.body.length - start));
  return {
    height: overhead + scan.used,
    remaining: done ? undefined : { kind: 'table', row: scan.index, inner: scan.inner },
    fragment: {
      kind: 'table',
      source: table,
      header: table.header.map(wholeRow),
      rows: scan.rows,
      footerFrom,
      includesFooterEnd: done,
      edge: fragmentEdge(first, done),
    },
  };
}
