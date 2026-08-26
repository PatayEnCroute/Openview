import { refusal } from '../errors.js';
import type { PdfLayoutMeasurement } from '../strategy/pdf.js';
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

/** A page whose flow reached past its slot, and by how much. */
export interface FlowOverflow {
  readonly pageNumber: number;
  readonly excess: number;
}

/**
 * Checks the composed sequence against what the browser really laid out, before anything is printed.
 *
 * A flow that reached past its slot is returned rather than thrown: it is the one divergence the
 * paginator can answer, by withholding that much height from the page and cutting again. Everything
 * else -- a missing page, a wrong sheet, a band over its reserve, an image that did not decode, a
 * box painted off the sheet -- is a refusal, because no cut of the flow would repair it.
 */
export function verifyLayout(
  paginated: PaginatedDocument,
  measurement: PdfLayoutMeasurement,
  pxPerMm: number,
): FlowOverflow | undefined {
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

  /* A refusal, not an overflow to settle: no cut of the flow shrinks the content of a zone, and a
     grid is atomic anyway. */
  const [overflowingZone] = measurement.overflowingGridItems;
  if (overflowingZone !== undefined) {
    throw refusal(GRID_CONTENT_OVERFLOWS, 'grid-content-overflow', { nodeId: overflowingZone });
  }

  /* A refusal, not an overflow to settle: no cut of the flow makes a marker narrower, and the
     `overflow: hidden` that keeps a marker inside its box is a visual barrier, never a licence to
     print half a number. */
  if (measurement.clippedMarkerCount > 0) {
    throw refusal(MARKER_CLIPPED, 'layout-measurement-failed', {
      limit: measurement.clippedMarkerCount,
    });
  }

  const expected = {
    width: paginated.sheet.width * pxPerMm,
    height: paginated.sheet.height * pxPerMm,
    printableWidth: paginated.printable.width * pxPerMm,
    printableHeight: paginated.printable.height * pxPerMm,
  };

  let worst: FlowOverflow | undefined;
  for (const [index, page] of measurement.pages.entries()) {
    const pageNumber = index + 1;
    const off =
      Math.abs(page.page.width - expected.width) > TOLERANCE_PX ||
      Math.abs(page.page.height - expected.height) > TOLERANCE_PX ||
      Math.abs(page.printable.width - expected.printableWidth) > TOLERANCE_PX ||
      Math.abs(page.printable.height - expected.printableHeight) > TOLERANCE_PX;
    if (off) {
      throw refusal(WRONG_SHEET, 'layout-measurement-failed', { pageNumber });
    }
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
      if (worst === undefined || excess > worst.excess) {
        worst = { pageNumber, excess };
      }
    }
  }
  return worst;
}
