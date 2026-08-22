/**
 * @openview/engine
 * Backend document data binding, pagination and PDF rendering pipeline.
 *
 * Exports the port an integrator calls and the contract a print adapter implements. The
 * materialised document, the fragments, the html vocabulary and the css helpers stay internal: they
 * are how a render is produced, not something a caller may depend on.
 */

export type { DocumentImage } from './document/images.js';
export type {
  DocumentRegion,
  DocumentRenderErrorCode,
  DocumentRenderErrorDetails,
} from './errors.js';
export { DOCUMENT_REGIONS, DOCUMENT_RENDER_ERROR_CODES, DocumentRenderError } from './errors.js';
export { createPdfRenderPort, PDF_CONTENT_TYPE } from './pipeline/render-pdf.js';
export type {
  BoxMeasurement,
  ImageMeasurement,
  LayoutBoxMeasurement,
  PageMeasurement,
  PdfLayoutMeasurement,
  PdfRenderResources,
  PdfRenderSession,
  PdfRenderStrategy,
  PdfSourceDocument,
  RegionMeasurement,
  RenderEngineOptions,
  TextLineMeasurement,
} from './strategy/pdf.js';

export const ENGINE_VERSION = '0.1.0';
