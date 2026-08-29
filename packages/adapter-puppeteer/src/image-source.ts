import {
  type DocumentImage,
  DocumentRenderError,
  type ResolvedDocumentImage,
} from '@openview/engine';

/**
 * Accepted embedded base64 bitmap image MIME prefixes for Puppeteer rendering.
 */
export const ACCEPTED_IMAGE_PREFIXES = [
  'data:image/png;base64,',
  'data:image/jpeg;base64,',
  'data:image/webp;base64,',
] as const;

const UNSUPPORTED =
  'This backend prints only png, jpeg and webp bitmaps embedded as base64 `data:` sources. An http source, a file path, an asset key and svg are refused here, which is a limit of this backend and not of the template.';

const NOT_INLINE =
  'An image reached the browser under a source that is not self-contained. Every occurrence is resolved to inline bytes before a page exists, so the network policy is applied by this process rather than by Chromium.';

const isEmbedded = (src: string): boolean =>
  ACCEPTED_IMAGE_PREFIXES.some((prefix) => src.startsWith(prefix));

/** Refuses every source this backend cannot print, before a page exists to load them into. */
export function assertPrintableImages(images: readonly DocumentImage[]): void {
  for (const image of images) {
    if (!isEmbedded(image.src)) {
      throw new DocumentRenderError(UNSUPPORTED, 'unsupported-image-source', {
        nodeId: image.nodeId,
        path: image.path,
      });
    }
  }
}

/** Refuses a resolved source that is not inline bytes, whatever decided it. */
export function assertInlineSources(images: readonly ResolvedDocumentImage[]): void {
  for (const image of images) {
    if (!isEmbedded(image.src)) {
      throw new DocumentRenderError(NOT_INLINE, 'resource-policy-refused', {
        phase: 'resource',
        resourceKind: 'embedded-image',
      });
    }
  }
}
