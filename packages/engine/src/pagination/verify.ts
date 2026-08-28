import { refusal } from '../errors.js';
import type { PageMeasurement, PdfLayoutMeasurement } from '../strategy/pdf.js';
import type { PaginatedDocument } from './types.js';
import { TOLERANCE_PX } from './validate-measurement.js';

const WRONG_PAGE_COUNT =
  'The laid-out document does not hold one box per composed page, so the sequence that would be printed is not the sequence that was measured.';

const WRONG_SHEET =
  'A page of the laid-out document is not at the declared sheet or does not leave the declared printable area. Read `details.pageNumber` for which one.';

const BAND_OVERFLOWS =
  'The band of a page reaches past the height reserved for it on every page. Read `details.region` for which side and `details.pageNumber` for the page.';

const IMAGE_FAILED =
  'An embedded image did not decode, so the document would print a blank where a picture belongs. Alternative text does not stand in for a picture in a pdf.';

const PAINTS_OUTSIDE =
  'A block paints outside the sheet it belongs to. Read `details.nodeId` for the declaration it came from.';

const GRID_CONTENT_OVERFLOWS =
  'The content of a grid zone reaches past the zone the model declared for it. A zone is never clipped and never resized, so the document is refused. Read `details.nodeId` for the zone container.';

const MARKER_CLIPPED =
  'A page marker holds more than the width reserved for it, so the printed document would show a truncated figure. Read `details.limit` for how many markers are involved; what they read is deliberately not reported.';

/** Information about a flow region height overflow on a paginated page. */
export interface FlowOverflow {
  readonly pageNumber: number;
  readonly excess: number;
}

/** Checks and refuses unrecoverable layout anomalies such as failed images or off-sheet paints. */
function refuseUnrepairable(paginated: PaginatedDocument, measurement: PdfLayoutMeasurement): void {
  if (measurement.pages.length !== paginated.pages.length) {
    throw refusal(WRONG_PAGE_COUNT, 'layout-measurement-failed', {
      limit: paginated.pages.length,
    });
  }

  for (const image of measurement.images) {
    if (!image.decoded || image.naturalWidth === 0 || image.naturalHeight === 0) {
      throw refusal(IMAGE_FAILED, 'image-load-failed', { nodeId: image.nodeId });
    }
  }

  const [escaped] = measurement.escaping;
  if (escaped !== undefined) {
    throw refusal(PAINTS_OUTSIDE, 'layout-measurement-failed', { nodeId: escaped });
  }

  const [overflowingZone] = measurement.overflowingGridItems;
  if (overflowingZone !== undefined) {
    throw refusal(GRID_CONTENT_OVERFLOWS, 'grid-content-overflow', { nodeId: overflowingZone });
  }

  if (measurement.clippedMarkerCount > 0) {
    throw refusal(MARKER_CLIPPED, 'layout-measurement-failed', {
      limit: measurement.clippedMarkerCount,
    });
  }
}

interface ExpectedPageBox {
  readonly width: number;
  readonly height: number;
  readonly printableWidth: number;
  readonly printableHeight: number;
}

function checkPageBox(page: PageMeasurement, expected: ExpectedPageBox, pageNumber: number): void {
  const off =
    Math.abs(page.page.width - expected.width) > TOLERANCE_PX ||
    Math.abs(page.page.height - expected.height) > TOLERANCE_PX ||
    Math.abs(page.printable.width - expected.printableWidth) > TOLERANCE_PX ||
    Math.abs(page.printable.height - expected.printableHeight) > TOLERANCE_PX;
  if (off) {
    throw refusal(WRONG_SHEET, 'layout-measurement-failed', { pageNumber });
  }
}

function worstFlowOverflow(
  page: PageMeasurement,
  pageNumber: number,
  worst: FlowOverflow | undefined,
): FlowOverflow | undefined {
  let found = worst;
  for (const region of page.regions) {
    const excess = region.contentHeight - region.height;
    if (excess <= TOLERANCE_PX) {
      continue;
    }
    if (region.region !== 'root') {
      throw refusal(BAND_OVERFLOWS, 'page-band-overflow', {
        pageNumber,
        region: region.region,
      });
    }
    if (found === undefined || excess > found.excess) {
      found = { pageNumber, excess };
    }
  }
  return found;
}

/**
 * Validates measured layout against pagination expectations and returns any flow overflow to settle.
 */
export function verifyLayout(
  paginated: PaginatedDocument,
  measurement: PdfLayoutMeasurement,
  pxPerMm: number,
): FlowOverflow | undefined {
  refuseUnrepairable(paginated, measurement);

  const expected = {
    width: paginated.sheet.width * pxPerMm,
    height: paginated.sheet.height * pxPerMm,
    printableWidth: paginated.printable.width * pxPerMm,
    printableHeight: paginated.printable.height * pxPerMm,
  };

  let worst: FlowOverflow | undefined;
  for (const [index, page] of measurement.pages.entries()) {
    const pageNumber = index + 1;
    checkPageBox(page, expected, pageNumber);
    worst = worstFlowOverflow(page, pageNumber, worst);
  }
  return worst;
}
