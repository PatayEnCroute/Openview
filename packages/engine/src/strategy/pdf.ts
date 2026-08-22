import type { EvaluationLimits, ShapeLimits, Sheet } from '@openview/core';
import type { DocumentImage } from '../document/images.js';

/**
 * The only thing a print strategy ever receives: a closed, escaped html document, the sheet the
 * template declared, and the sources of the images that document references.
 *
 * Never the render data, never the template, never the AST. A strategy that needed one of those
 * would be deciding layout, which is the pipeline's job. The image list is here because which
 * sources a backend can print is a capability of that backend, and a capability has to be checked
 * before anything is loaded rather than after a fetch was already attempted.
 */
export interface PdfSourceDocument {
  readonly html: string;
  readonly sheet: Sheet;
  readonly images: readonly DocumentImage[];
}

/**
 * A print backend. The single implementation lives in its own adapter package so that installing
 * the engine never downloads a browser.
 */
export interface PdfRenderStrategy {
  readonly format: 'pdf';
  render(document: PdfSourceDocument): Promise<Uint8Array>;
}

/**
 * Engine configuration, distinct from the render request: bounds are how the host protects itself,
 * not a third business field beside the template and the data.
 */
export interface RenderEngineOptions {
  readonly shapeLimits?: Partial<ShapeLimits> | undefined;
  readonly evaluationLimits?: Partial<EvaluationLimits> | undefined;
}
