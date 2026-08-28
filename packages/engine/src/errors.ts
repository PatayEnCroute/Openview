import {
  diagnosticsOf,
  type ExpressionValueType,
  type OccurrenceAddress,
  type OpenviewDiagnostic,
  OpenviewError,
  type PresentationFormatKind,
  type PresentationRefusal,
} from '@openview/core';

/** Error codes emitted by the document rendering engine. */
export const DOCUMENT_RENDER_ERROR_CODES = [
  'template-refused',
  'expression-refused',
  'missing-binding-value',
  'non-printable-binding-value',
  'presentation-refused',
  'unformattable-binding-value',
  'unsupported-font-family',
  'unsupported-font-character',
  'unsupported-image-source',
  'image-load-failed',
  'oversized-atomic-resource',
  'page-band-overflow',
  'page-report-refused',
  'grid-content-overflow',
  'pagination-impossible',
  'layout-measurement-failed',
  'pdf-export-failed',
  'adapter-capability-mismatch',
] as const;

export type DocumentRenderErrorCode = (typeof DOCUMENT_RENDER_ERROR_CODES)[number];

/** The three vertical regions of a page, in layout order. */
export const DOCUMENT_REGIONS = ['header', 'root', 'footer'] as const;

export type DocumentRegion = (typeof DOCUMENT_REGIONS)[number];

/** The five paint areas of a page, in paint order. */
export const DOCUMENT_AREAS = ['background', 'header', 'root', 'footer', 'foreground'] as const;

export type DocumentArea = (typeof DOCUMENT_AREAS)[number];

/** Structured contextual details attached to a rendering error. */
export interface DocumentRenderErrorDetails {
  /** Id of the declaration being materialised, when the site is known. */
  readonly nodeId?: string | undefined;
  /** Segments from the template root to the offending declaration. */
  readonly path?: readonly (string | number)[] | undefined;
  /** Repetition ancestry of the occurrence being built. */
  readonly occurrence?: OccurrenceAddress | undefined;
  /** Closed category of an unusable value. */
  readonly actualType?: ExpressionValueType | undefined;
  /** Writing format kind requested at the error site. */
  readonly formatKind?: PresentationFormatKind | undefined;
  /** Underlying refusal from presentation resolution. */
  readonly presentationRefusal?: PresentationRefusal | undefined;
  /** Page area being constructed. */
  readonly region?: DocumentArea | undefined;
  /** Declared limit that was exceeded. */
  readonly limit?: number | undefined;
  /** One-based page number where the refusal occurred. */
  readonly pageNumber?: number | undefined;
  /** Diagnostic list when forwarded from `@openview/core`. */
  readonly diagnostics?: readonly OpenviewDiagnostic[] | undefined;
}

/**
 * Error raised during document materialization, pagination, or PDF rendering.
 */
export class DocumentRenderError extends OpenviewError {
  readonly code: DocumentRenderErrorCode;
  readonly details: DocumentRenderErrorDetails;

  constructor(
    message: string,
    code: DocumentRenderErrorCode,
    details: DocumentRenderErrorDetails = {},
    options?: ErrorOptions | undefined,
  ) {
    super(message, options);
    this.name = 'DocumentRenderError';
    this.code = code;
    this.details = details;
  }
}

/** Builds an engine-originated render error. */
export function refusal(
  message: string,
  code: DocumentRenderErrorCode,
  details: DocumentRenderErrorDetails = {},
): DocumentRenderError {
  return new DocumentRenderError(message, code, details);
}

/**
 * Wraps an error from `@openview/core` with structured diagnostics and location details.
 */
export function refusalOf(
  error: unknown,
  message: string,
  code: DocumentRenderErrorCode,
  details: DocumentRenderErrorDetails = {},
): DocumentRenderError {
  const diagnostics = diagnosticsOf(error, {
    nodeId: details.nodeId,
    pathPrefix: details.path,
  });
  return new DocumentRenderError(message, code, { ...details, diagnostics }, { cause: error });
}
