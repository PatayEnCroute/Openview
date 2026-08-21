import type { ExpressionKind } from './expression/expression.js';
import type { ExpressionValueType } from './expression/value-type.js';

const programmingFaults = new WeakSet<object>();

function referenceOf(error: unknown): object | undefined {
  if ((typeof error === 'object' && error !== null) || typeof error === 'function') {
    return error;
  }
  return undefined;
}

/** Marks a callback failure that diagnostics must leave untouched. */
export function markAsProgrammingFault(error: unknown): void {
  const reference = referenceOf(error);
  if (reference !== undefined) {
    programmingFaults.add(reference);
  }
}

/** Reports whether an error came unchanged from caller-provided code. */
export function isProgrammingFault(error: unknown): boolean {
  const reference = referenceOf(error);
  return reference !== undefined && programmingFaults.has(reference);
}

/** Base class for all typed Openview errors. */
export class OpenviewError extends Error {
  constructor(message: string, options?: ErrorOptions | undefined) {
    super(message, options);
    this.name = 'OpenviewError';
  }
}

/** Error codes for invalid operands during expression evaluation. */
export const OPERAND_ERROR_CODES = [
  'operand-type',
  'division-by-zero',
  'not-finite',
  'not-a-whole-number',
  'not-a-list',
  'not-a-boolean',
  'not-comparable',
  'not-orderable',
  'not-a-date',
] as const;

/** Error codes for exceeded evaluation safety limits. */
export const LIMIT_ERROR_CODES = [
  'step-limit-exceeded',
  'item-limit-exceeded',
  'string-limit-exceeded',
  'depth-limit-exceeded',
] as const;

/** Complete catalogue of expression error codes. */
export const EXPRESSION_ERROR_CODES = [...OPERAND_ERROR_CODES, ...LIMIT_ERROR_CODES] as const;

export type OperandErrorCode = (typeof OPERAND_ERROR_CODES)[number];
export type LimitErrorCode = (typeof LIMIT_ERROR_CODES)[number];
export type ExpressionErrorCode = (typeof EXPRESSION_ERROR_CODES)[number];

export type ExpressionErrorSite = ExpressionKind | 'loop' | 'condition' | 'tableRowGroup';

interface ExpressionErrorLocation {
  readonly site: ExpressionErrorSite;
  readonly at: readonly (string | number)[];
}

/** Discriminated error details attached to an ExpressionEvaluationError. */
export type ExpressionErrorDetails =
  | (ExpressionErrorLocation & {
      readonly code: OperandErrorCode;
      readonly actualType: ExpressionValueType;
    })
  | (ExpressionErrorLocation & {
      readonly code: LimitErrorCode;
      readonly limit: number;
    });

/** Internal symbol key used to prepend path segments during recursive unwinding. */
export const prefixPath = Symbol('openview.prefixPath');

/** Error raised when an expression fails evaluation against supplied data. */
export class ExpressionEvaluationError extends OpenviewError {
  readonly #details: ExpressionErrorDetails;
  readonly #reversedPath: (string | number)[];

  constructor(
    message: string,
    details: ExpressionErrorDetails,
    options?: ErrorOptions | undefined,
  ) {
    super(message, options);
    this.name = 'ExpressionEvaluationError';
    this.#details = details;
    this.#reversedPath = [...details.at].reverse();
  }

  [prefixPath](segment: string | number): void {
    this.#reversedPath.push(segment);
  }

  get details(): ExpressionErrorDetails {
    return { ...this.#details, at: [...this.#reversedPath].reverse() };
  }
}

/** Error codes naming why a template could not be brought up to the current schema version. */
export const TEMPLATE_MIGRATION_ERROR_CODES = [
  'invalid-template',
  'missing-schema-version',
  'newer-schema-version',
  'missing-migration',
  'invalid-migration-result',
] as const;

export type TemplateMigrationErrorCode = (typeof TEMPLATE_MIGRATION_ERROR_CODES)[number];

/**
 * Source-compatible with `ErrorOptions`, so an existing two-argument call still compiles; a caller
 * that omits `code` gets `invalid-migration-result`.
 */
export interface TemplateMigrationErrorOptions extends ErrorOptions {
  readonly code?: TemplateMigrationErrorCode | undefined;
}

/** Error raised when template migration fails. */
export class TemplateMigrationError extends OpenviewError {
  readonly code: TemplateMigrationErrorCode;

  constructor(
    message: string,
    readonly fromVersion: number,
    options?: TemplateMigrationErrorOptions | undefined,
  ) {
    super(message, options);
    this.name = 'TemplateMigrationError';
    this.code = options?.code ?? 'invalid-migration-result';
  }
}

/** Error codes for template structural shape violations. */
export const SHAPE_ERROR_CODES = ['too-deep', 'too-many-nodes', 'not-plain-data'] as const;

export type ShapeErrorCode = (typeof SHAPE_ERROR_CODES)[number];

/** Error raised when a raw template payload violates shape bounds. */
export class TemplateShapeError extends OpenviewError {
  constructor(
    message: string,
    readonly code: ShapeErrorCode,
    readonly limit: number | undefined,
    options?: ErrorOptions | undefined,
  ) {
    super(message, options);
    this.name = 'TemplateShapeError';
  }
}

/** Error raised when evaluation limits are invalid. */
export class InvalidEvaluationLimitsError extends OpenviewError {
  constructor(message: string, options?: ErrorOptions | undefined) {
    super(message, options);
    this.name = 'InvalidEvaluationLimitsError';
  }
}

/** Error raised when shape limits are invalid. */
export class InvalidShapeLimitsError extends OpenviewError {
  constructor(message: string, options?: ErrorOptions | undefined) {
    super(message, options);
    this.name = 'InvalidShapeLimitsError';
  }
}
