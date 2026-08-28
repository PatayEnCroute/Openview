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

/** Region and role placement context for output reporting. */
interface Site {
  readonly region: PaginationRegion;
  readonly role: PlacementRole;
}

const FLOW: Site = { region: 'root', role: 'flow' };

const asHeader = (site: Site): Site =>
  site.role === 'flow' ? { region: site.region, role: 'table-header' } : site;

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
 * Builds the public PaginationResult object from paginated document data and serialized HTML.
 */
export function paginationResultOf(paginated: PaginatedDocument, html: string): PaginationResult {
  return {
    sheet: paginated.sheet,
    html,
    pages: paginated.pages.map((page) => pageResultOf(page, paginated)),
    notices: noticesOf(paginated),
  };
}
