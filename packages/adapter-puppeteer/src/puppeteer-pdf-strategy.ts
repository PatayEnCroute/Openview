import type { PdfRenderResources, PdfRenderSession, PdfRenderStrategy } from '@openview/engine';
import { openPuppeteerSession, type PuppeteerLaunchOptions } from './session.js';

export type PuppeteerPdfStrategyOptions = PuppeteerLaunchOptions;

/**
 * The Chromium print backend behind the engine's pdf port.
 *
 * One session per render, never shared between two: the engine measures several candidates and
 * prints one document, and all of it has to happen with the same fonts and the same decoded images.
 * Page, context and browser are closed in `close()`, which the pipeline awaits on every path.
 */
export function createPuppeteerPdfStrategy(
  options?: PuppeteerPdfStrategyOptions | undefined,
): PdfRenderStrategy {
  return {
    format: 'pdf',
    open(resources: PdfRenderResources): Promise<PdfRenderSession> {
      return openPuppeteerSession(resources, options);
    },
  };
}
