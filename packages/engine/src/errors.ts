import {
  diagnosticsOf,
  type ExpressionValueType,
  type OpenviewDiagnostic,
  OpenviewError,
} from '@openview/core';

/**
 * Every refusal the render pipeline can name.
 *
 * A render either produces bytes or throws one of these: no step returns a partial document, and
 * no message carries a bound value, an image source, a serialised template, generated html or a
 * flattened cause.
 */
export const DOCUMENT_RENDER_ERROR_CODES = [
  'template-refused',
  'expression-refused',
  'missing-binding-value',
  'non-printable-binding-value',
  'unsupported-image-source',
  'image-load-failed',
  'oversized-atomic-resource',
  'single-page-overflow',
  'pdf-export-failed',
  'adapter-capability-mismatch',
] as const;

export type DocumentRenderErrorCode = (typeof DOCUMENT_RENDER_ERROR_CODES)[number];

/** The three vertical regions of a page, in the order the engine builds them. */
export const DOCUMENT_REGIONS = ['header', 'root', 'footer'] as const;

export type DocumentRegion = (typeof DOCUMENT_REGIONS)[number];

/**
 * Location and shape facts attached to a refusal. Every field is safe to log: none of them can
 * hold a bound value, an image source, a serialised template or the render data.
 */
export interface DocumentRenderErrorDetails {
  /** Id of the declaration being materialised, when the site is known. */
  readonly nodeId?: string | undefined;
  /** Segments from the template root to the offending declaration. */
  readonly path?: readonly (string | number)[] | undefined;
  /** Closed category of an unusable value, from the core value-type vocabulary. */
  readonly actualType?: ExpressionValueType | undefined;
  /** Which vertical region of the page was being built. */
  readonly region?: DocumentRegion | undefined;
  /** A declared bound the render exceeded, in the unit of that bound. */
  readonly limit?: number | undefined;
  /** Structured diagnostics, when the underlying refusal came from `@openview/core`. */
  readonly diagnostics?: readonly OpenviewDiagnostic[] | undefined;
}

/**
 * A render refusal, with a message constant per site and structured details beside it.
 *
 * `cause` exists for a caller debugging locally and is never read to build the message: a cause
 * raised inside a strategy or a browser is not known to be free of render values.
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

/** Builds a refusal the engine names on its own, with no underlying error to attribute. */
export function refusal(
  message: string,
  code: DocumentRenderErrorCode,
  details: DocumentRenderErrorDetails = {},
): DocumentRenderError {
  return new DocumentRenderError(message, code, details);
}

/**
 * Wraps an error raised by `@openview/core` at a site where the node and its path are known.
 *
 * A refusal core can name becomes structured diagnostics; anything else -- an unknown error or a
 * programming fault -- keeps the constant message and travels as `cause` only.
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
