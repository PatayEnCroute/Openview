import { bandForRole, type PageRole, pageRole } from '../document/bands.js';
import type { MaterialBlock, MaterialDocument, MaterialPageBand } from '../document/types.js';
import { refusal } from '../errors.js';
import { bandReserves } from './bands.js';
import { fillFlow } from './flow.js';
import { assertAdvanced } from './progress.js';
import { withIncomingReports } from './reports.js';
import type {
  FlowCursor,
  MarkerReserve,
  MaterialFragment,
  MaterialPage,
  Metrics,
  PaginatedDocument,
} from './types.js';
import { FLOW_START } from './types.js';

const NO_HEIGHT =
  'The bands of this page reserve more height than the printable area has, so the flow is left less than nothing. Read `details.pageNumber` for where it stopped.';

const NOTHING_FITS =
  'The smallest legal fragment of the flow does not fit on a page of its own, so no cut of this document can be printed. Read `details.pageNumber` for where it stopped.';

/** What the paginator needs beyond the document itself. */
export interface PaginationOptions {
  readonly metrics: Metrics;
  /** Height of the printable area, in css pixels. */
  readonly printableHeight: number;
  readonly markers: MarkerReserve;
  /**
   * Height withheld from one page's flow, in css pixels, after a measurement of an earlier attempt
   * found it over its slot. Keyed by page rank, empty on the first attempt.
   */
  readonly slack: ReadonlyMap<number, number>;
}

const spent = (cursor: FlowCursor, blocks: number): boolean =>
  cursor.index >= blocks && cursor.inner === undefined;

function bandBlocks(bands: readonly MaterialPageBand[], role: PageRole): readonly MaterialBlock[] {
  const band = bandForRole(bands, role);
  return band === undefined ? [] : [band.content];
}

/**
 * Partitions the root block flow into discrete pages applying greedy layout cuts and page band roles.
 */
export function paginate(
  document: MaterialDocument,
  options: PaginationOptions,
): PaginatedDocument {
  const { metrics, markers } = options;
  const reserves = bandReserves(document, options.printableHeight, metrics);
  const roots: (readonly MaterialFragment[])[] = [];

  let cursor = FLOW_START;
  while (!spent(cursor, document.root.length)) {
    const number = roots.length + 1;
    const room = reserves.root - (options.slack.get(number) ?? 0);
    if (room < 0) {
      throw refusal(NO_HEIGHT, 'pagination-impossible', { pageNumber: number });
    }
    const placed = fillFlow(document.root, cursor, room, reserves.root, metrics);
    if (placed.fragments.length === 0) {
      throw refusal(NOTHING_FITS, 'pagination-impossible', { pageNumber: number });
    }
    assertAdvanced(cursor, placed.cursor, number);
    roots.push(placed.fragments);
    cursor = placed.cursor;
  }
  if (roots.length === 0) {
    /* A flow with no block at all still prints: its bands are the page. */
    roots.push([]);
  }

  const count = roots.length;
  /* Composed from the cuts that were just chosen, never patched from an earlier attempt: a settling
     round that moves one row to the next page changes which rows finished before which page. */
  const pages: MaterialPage[] = withIncomingReports(roots).map((reported, index) => {
    const number = index + 1;
    const role = pageRole(number, count);
    return {
      number,
      count,
      root: reported.root,
      incomingReport: reported.incomingReport,
      completedBy: reported.completedBy,
      header: bandBlocks(document.headerBands, role),
      footer: bandBlocks(document.footerBands, role),
    };
  });

  return {
    pages,
    markers,
    sheet: document.sheet,
    margins: document.margins,
    printable: document.printable,
    /* Carried through untouched: layers reserve nothing, so the cuts above never read them. */
    backgroundLayers: document.backgroundLayers,
    foregroundLayers: document.foregroundLayers,
    headerReserve: reserves.header / metrics.pxPerMm,
    footerReserve: reserves.footer / metrics.pxPerMm,
  };
}
