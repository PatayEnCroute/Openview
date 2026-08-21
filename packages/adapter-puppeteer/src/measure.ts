import { type DocumentRegion, DocumentRenderError } from '@openview/engine';

/** Sub-pixel layout rounding. Far below one line of text, so a real overflow still fails. */
const TOLERANCE_PX = 0.5;

export interface BoxMeasurement {
  readonly width: number;
  readonly height: number;
}

export interface RegionMeasurement {
  readonly region: DocumentRegion;
  /** Height of the region's own box, which is what the layout gave it. */
  readonly height: number;
  /** Height its content actually reaches, from the lowest descendant edge. */
  readonly contentHeight: number;
}

export interface ImageMeasurement {
  readonly nodeId: string;
  readonly decoded: boolean;
  readonly naturalWidth: number;
  readonly naturalHeight: number;
  readonly renderedWidth: number;
  readonly renderedHeight: number;
}

export interface Measurement {
  readonly page: BoxMeasurement;
  readonly printable: BoxMeasurement;
  readonly regions: readonly RegionMeasurement[];
  readonly images: readonly ImageMeasurement[];
  /** Declaration ids whose painted box left the sheet. */
  readonly escaping: readonly string[];
}

/**
 * Runs inside Chromium. Self-contained on purpose: the function is serialised and evaluated in the
 * page, so it can close over nothing from this module.
 */
export async function measureInPage(): Promise<Measurement> {
  const tolerance = 0.5;
  const need = (selector: string): Element => {
    const found = document.querySelector(selector);
    if (found === null) {
      throw new Error(`The rendered document has no ${selector}`);
    }
    return found;
  };

  /* Measured from descendant edges rather than scrollHeight, which is an integer and would make a
     sub-pixel layout look like an overflow. */
  const contentHeightOf = (element: Element): number => {
    const own = element.getBoundingClientRect();
    let bottom = own.top;
    for (const descendant of element.querySelectorAll('*')) {
      const rect = descendant.getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0) {
        bottom = Math.max(bottom, rect.bottom);
      }
    }
    return bottom - own.top;
  };

  const pageBox = need('.ov-page').getBoundingClientRect();
  const printableBox = need('.ov-printable').getBoundingClientRect();

  const regions = (['header', 'root', 'footer'] as const).map((region) => {
    const element = need(`[data-openview-region="${region}"]`);
    return {
      region,
      height: element.getBoundingClientRect().height,
      contentHeight: contentHeightOf(element),
    };
  });

  const images: ImageMeasurement[] = [];
  for (const image of document.querySelectorAll('img')) {
    let decoded = true;
    try {
      await image.decode();
    } catch {
      /* A failed decode is the observation, not an incident: `complete` is true either way, so the
         rejection and the natural sizes are the only evidence there is. */
      decoded = false;
    }
    const rect = image.getBoundingClientRect();
    images.push({
      nodeId: image.closest('[data-openview-node]')?.getAttribute('data-openview-node') ?? '',
      decoded,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      renderedWidth: rect.width,
      renderedHeight: rect.height,
    });
  }

  const escaping: string[] = [];
  for (const node of document.querySelectorAll('[data-openview-node]')) {
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      continue;
    }
    const outside =
      rect.left < pageBox.left - tolerance ||
      rect.top < pageBox.top - tolerance ||
      rect.right > pageBox.right + tolerance ||
      rect.bottom > pageBox.bottom + tolerance;
    if (outside) {
      escaping.push(node.getAttribute('data-openview-node') ?? '');
    }
  }

  return {
    page: { width: pageBox.width, height: pageBox.height },
    printable: { width: printableBox.width, height: printableBox.height },
    regions,
    images,
    escaping,
  };
}

const IMAGE_FAILED =
  'An embedded image did not decode, so the document would print a blank where a picture belongs. Alternative text does not stand in for a picture in a pdf.';

const IMAGE_TOO_TALL =
  'An image is taller than the printable area of the declared sheet, so no page can hold it. An image is atomic: it is not cut and not scaled down to fit.';

const BAND_TOO_TALL =
  'A page band is taller on its own than the printable area of the declared sheet. Read `details.region` for which side.';

const NO_ROOM_LEFT =
  'The two page bands leave no room for the flow of the document on the declared sheet.';

const FLOW_OVERFLOWS =
  'The content does not fit on the single page this release prints. Nothing is truncated and nothing is scaled: shorten the content, enlarge the sheet, or reduce its margins.';

const PAINTS_OUTSIDE =
  'A block paints outside the sheet. Read `details.nodeId` for the declaration it came from.';

/**
 * Refuses before printing, so that `overflow: hidden` on the sheet stays a last barrier rather than
 * the thing that decides what a reader sees.
 *
 * Images are checked first: a picture that did not decode measures zero and would otherwise look
 * like content that fits, and one too tall for any page deserves its own refusal rather than a
 * generic overflow.
 */
export function assertFits(measurement: Measurement): void {
  for (const image of measurement.images) {
    if (!image.decoded || image.naturalWidth === 0 || image.naturalHeight === 0) {
      throw new DocumentRenderError(IMAGE_FAILED, 'image-load-failed', { nodeId: image.nodeId });
    }
    if (image.renderedHeight > measurement.printable.height + TOLERANCE_PX) {
      throw new DocumentRenderError(IMAGE_TOO_TALL, 'oversized-atomic-resource', {
        nodeId: image.nodeId,
      });
    }
  }

  let bandHeight = 0;
  for (const region of measurement.regions) {
    if (region.region === 'root') {
      continue;
    }
    bandHeight += region.height;
    if (region.contentHeight > measurement.printable.height + TOLERANCE_PX) {
      throw new DocumentRenderError(BAND_TOO_TALL, 'single-page-overflow', {
        region: region.region,
      });
    }
  }
  if (bandHeight > measurement.printable.height + TOLERANCE_PX) {
    throw new DocumentRenderError(NO_ROOM_LEFT, 'single-page-overflow', { region: 'root' });
  }

  for (const region of measurement.regions) {
    if (region.contentHeight > region.height + TOLERANCE_PX) {
      throw new DocumentRenderError(FLOW_OVERFLOWS, 'single-page-overflow', {
        region: region.region,
      });
    }
  }

  const [first] = measurement.escaping;
  if (first !== undefined) {
    throw new DocumentRenderError(PAINTS_OUTSIDE, 'single-page-overflow', { nodeId: first });
  }
}
