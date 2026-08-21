import { type DocumentImage, DocumentRenderError } from '@openview/engine';

/**
 * The image sources this backend can print: base64 bitmaps embedded in the document itself.
 *
 * Narrower than what an `ImageNode` may declare, and deliberately so. An http source is a request
 * leaving the process, a path or an asset key needs a resolution channel, and svg is a document
 * with its own script and reference surface. None of the three has the allow-list, the bounds and
 * the timeouts that would make it safe here yet, so this backend refuses them rather than pretending
 * the model is invalid.
 */
export const ACCEPTED_IMAGE_PREFIXES = [
  'data:image/png;base64,',
  'data:image/jpeg;base64,',
  'data:image/webp;base64,',
] as const;

const UNSUPPORTED =
  'This backend prints only png, jpeg and webp bitmaps embedded as base64 `data:` sources. An http source, a file path, an asset key and svg are refused here, which is a limit of this backend and not of the template.';

/** Refuses every source this backend cannot print, before a page exists to load them into. */
export function assertPrintableImages(images: readonly DocumentImage[]): void {
  for (const image of images) {
    if (!ACCEPTED_IMAGE_PREFIXES.some((prefix) => image.src.startsWith(prefix))) {
      throw new DocumentRenderError(UNSUPPORTED, 'unsupported-image-source', {
        nodeId: image.nodeId,
        path: image.path,
      });
    }
  }
}
