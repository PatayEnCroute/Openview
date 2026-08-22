import type { MaterialDocument, MaterialPageBand } from '../document/types.js';
import type { DocumentRegion } from '../errors.js';
import { refusal } from '../errors.js';
import type { Metrics } from './types.js';
import { TOLERANCE_PX } from './validate-measurement.js';

const BAND_TOO_TALL =
  'A page band is taller on its own than the printable area of the declared sheet. A band is atomic: it is not cut, not carried over and not stacked. Read `details.region` for which side.';

const NO_ROOM_LEFT =
  'The two page bands reserve more height together than the printable area of the declared sheet leaves, so no page can hold both and a flow.';

/** The two constant slots and what they leave the flow, all in css pixels. */
export interface BandReserves {
  readonly header: number;
  readonly footer: number;
  readonly root: number;
}

function reserveOf(
  bands: readonly MaterialPageBand[],
  region: DocumentRegion,
  printableHeight: number,
  metrics: Metrics,
): number {
  let tallest = 0;
  for (const band of bands) {
    const height = metrics.height(band.content.key);
    if (height > printableHeight + TOLERANCE_PX) {
      throw refusal(BAND_TOO_TALL, 'page-band-overflow', {
        region,
        nodeId: band.content.nodeId,
      });
    }
    tallest = Math.max(tallest, height);
  }
  return tallest;
}

/**
 * The height each side reserves on every page, and what the flow gets.
 *
 * The tallest band a side can ever show is reserved on all pages, whichever band a page actually
 * paints. A shorter band leaves white space in its slot instead of lending it to the flow: were the
 * flow to grow when a band is short, turning a page that was going to be the last one into an
 * intermediate one would change how much fits on it, and the page count would chase itself.
 */
export function bandReserves(
  document: MaterialDocument,
  printableHeight: number,
  metrics: Metrics,
): BandReserves {
  const header = reserveOf(document.headerBands, 'header', printableHeight, metrics);
  const footer = reserveOf(document.footerBands, 'footer', printableHeight, metrics);
  if (header + footer > printableHeight + TOLERANCE_PX) {
    throw refusal(NO_ROOM_LEFT, 'page-band-overflow', { region: 'root' });
  }
  return { header, footer, root: printableHeight - header - footer };
}
