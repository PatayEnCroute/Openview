/**
 * @openview/engine
 * Backend document data binding, pagination, and PDF rendering engine.
 */

export type { DocumentImage, ResolvedDocumentImage } from './document/images.js';
export type { PresentationSelection } from './document/presentation.js';
export type {
  DocumentArea,
  DocumentRegion,
  DocumentRenderErrorCode,
  DocumentRenderErrorDetails,
  DocumentRenderPhase,
  DocumentResourceKind,
} from './errors.js';
export {
  DOCUMENT_AREAS,
  DOCUMENT_REGIONS,
  DOCUMENT_RENDER_ERROR_CODES,
  DOCUMENT_RENDER_PHASES,
  DOCUMENT_RESOURCE_KINDS,
  DocumentRenderError,
  InvalidRenderSafetyLimitsError,
} from './errors.js';
export { resolveRenderSafetyLimits } from './limits/schemas.js';
export type { RenderSafetyLimits, RenderSafetyLimitsOverrides } from './limits/types.js';
export {
  DEFAULT_RENDER_SAFETY_LIMITS,
  RENDER_SAFETY_HARD_CEILINGS,
} from './limits/types.js';
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
