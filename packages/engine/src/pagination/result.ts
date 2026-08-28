import type {
  FragmentState,
  OccurrenceReference,
  PagePlacement,
  PageReportResult,
  PaginationPageResult,
  PaginationRegion,
  PaginationResult,
  PlacementRole,
} from '@openview/core';
import { occurrenceOf } from '../document/occurrence.js';
import type { MaterialBlock, MaterialPageLayer } from '../document/types.js';
import { noticesOf } from './notices.js';
import type {
  CellFragment,
  MaterialFragment,
  MaterialPage,
  PaginatedDocument,
  RowFragment,
} from './types.js';
import { visitFragment } from './visit.js';
import { wholeFragment } from './whole.js';

/** Where a placement is being collected, which decides its region and its role at once. */
interface Site {
  readonly region: PaginationRegion;
  readonly role: PlacementRole;
}

const FLOW: Site = { region: 'root', role: 'flow' };

/**
 * The repeated header of a table, told apart from the body rows that follow it on the same page.
 *
 * Only inside the flow: a band and a layer keep their own role throughout, because what repeats
 * there is the whole band, not the header of a table inside it.
 */
const asHeader = (site: Site): Site =>
  site.role === 'flow' ? { region: site.region, role: 'table-header' } : site;

/** One painted occurrence, appended in paint order. */
function place(
  into: PagePlacement[],
  source: OccurrenceReference,
  site: Site,
  fragment: FragmentState,
): void {
  into.push({
    occurrence: occurrenceOf(source),
    region: site.region,
    role: site.role,
    fragment,
  });
}

/**
 * One painted fragment, then everything painted inside it, in descendant order.
 *
 * A cell is not an occurrence: it carries no declaration id, so a row is followed directly by the
 * blocks its cells hold, in column order.
 */
function collect(into: PagePlacement[], fragment: MaterialFragment, site: Site): void {
  const fragments = (list: readonly MaterialFragment[], at: Site): void => {
    for (const one of list) {
      collect(into, one, at);
    }
  };
  const cells = (list: readonly CellFragment[], at: Site): void => {
    for (const cell of list) {
      fragments(cell.children, at);
    }
  };
  const row = (one: RowFragment, at: Site): void => {
    place(into, one.source, at, one.edge);
    cells(one.cells, at);
  };

  visitFragment(fragment, {
    text: (text) => {
      place(into, text.source, site, text.edge);
    },
    image: (image) => {
      place(into, image.source, site, 'whole');
    },
    /* A grid is atomic, so it and every zone of it are painted whole on this one page. Its zones
       are descended all the same: a contributing row inside one finishes here, and the manifest
       would otherwise name in its report an occurrence it never placed. */
    grid: (grid) => {
      place(into, grid.source, site, 'whole');
      for (const item of grid.source.items) {
        collect(into, wholeFragment(item.content), site);
      }
    },
    container: (container) => {
      place(into, container.source, site, container.edge);
      fragments(container.children, site);
    },
    table: (table) => {
      place(into, table.source, site, table.edge);
      for (const header of table.header) {
        row(header, asHeader(site));
      }
      for (const body of table.rows) {
        row(body, site);
      }
    },
  });
}

/** Bands and layers are painted whole on every page their domain reaches, never cut. */
function collectWhole(into: PagePlacement[], blocks: readonly MaterialBlock[], site: Site): void {
  for (const block of blocks) {
    collect(into, wholeFragment(block), site);
  }
}

function collectLayers(
  into: PagePlacement[],
  layers: readonly MaterialPageLayer[],
  region: 'background' | 'foreground',
): void {
  for (const layer of layers) {
    collectWhole(into, [layer.content], { region, role: 'page-layer' });
  }
}

/**
 * Everything one composed page paints, in paint order: layers behind, bands, flow, layers in front.
 *
 * A flat list rather than a tree: what a caller asks is which page, which region and whole or cut,
 * and a public tree would turn every change to a fragment into a broken contract.
 */
function placementsOf(page: MaterialPage, paginated: PaginatedDocument): readonly PagePlacement[] {
  const placements: PagePlacement[] = [];
  collectLayers(placements, paginated.backgroundLayers, 'background');
  collectWhole(placements, page.header, { region: 'header', role: 'page-band' });
  for (const fragment of page.root) {
    collect(placements, fragment, FLOW);
  }
  collectWhole(placements, page.footer, { region: 'footer', role: 'page-band' });
  collectLayers(placements, paginated.foregroundLayers, 'foreground');
  return placements;
}

/** The boundary of one page: the raw sum carried in, and the rows that closed it here. */
const reportOf = (page: MaterialPage): PageReportResult => ({
  incoming: page.incomingReport,
  completedBy: page.completedBy.map(occurrenceOf),
});

const pageResultOf = (page: MaterialPage, paginated: PaginatedDocument): PaginationPageResult => ({
  number: page.number,
  placements: placementsOf(page, paginated),
  report: reportOf(page),
});

/**
 * Projects one settled composition into the read-only result the pagination port returns.
 *
 * Reads the accepted sequence and the html it serialised to: it never re-cuts, never re-sums and
 * never rebuilds markup. No measured height, no cursor and no occurrence key crosses over.
 */
export function paginationResultOf(paginated: PaginatedDocument, html: string): PaginationResult {
  return {
    sheet: paginated.sheet,
    html,
    pages: paginated.pages.map((page) => pageResultOf(page, paginated)),
    notices: noticesOf(paginated),
  };
}
