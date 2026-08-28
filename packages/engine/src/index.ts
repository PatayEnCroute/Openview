/**
 * @openview/engine
 * Backend document data binding, pagination, and PDF rendering engine.
 */

export type { DocumentImage } from './document/images.js';
export type { PresentationSelection } from './document/presentation.js';
export type {
  DocumentArea,
  DocumentRegion,
  DocumentRenderErrorCode,
  DocumentRenderErrorDetails,
} from './errors.js';
export {
  DOCUMENT_AREAS,
  DOCUMENT_REGIONS,
  DOCUMENT_RENDER_ERROR_CODES,
  DocumentRenderError,
} from './errors.js';
export { createPaginationPort } from './pipeline/paginate.js';
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
