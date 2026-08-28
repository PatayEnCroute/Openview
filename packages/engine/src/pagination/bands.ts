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
 * Computes constant height reserves for header and footer band slots across all pages.
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
