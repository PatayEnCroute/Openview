import type {
  ExpressionErrorSite,
  LimitErrorCode,
  OperandErrorCode,
  ShapeErrorCode,
  TemplateMigrationErrorCode,
} from '../errors.js';
import type { ExpressionValueType } from '../expression/value-type.js';
import type { PresentationRefusal } from '../presentation/types.js';

/** Diagnostic families. `source` and `code` select a stable translation branch. */
export const DIAGNOSTIC_SOURCES = [
  'template-validation',
  'template-migration',
  'template-shape',
  'expression-evaluation',
  'presentation-resolution',
  'configuration',
] as const;

export type DiagnosticSource = (typeof DIAGNOSTIC_SOURCES)[number];

/** Stable vocabulary for schema validation refusals, independent of the validator's own codes. */
export const TEMPLATE_VALIDATION_CODES = [
  'invalid-type',
  'invalid-value',
  'invalid-format',
  'out-of-range',
  'invalid-structure',
  'invalid-relation',
] as const;

export type TemplateValidationCode = (typeof TEMPLATE_VALIDATION_CODES)[number];

/** Limits supplied by the caller, refused rather than replaced. */
export const CONFIGURATION_DIAGNOSTIC_CODES = [
  'invalid-evaluation-limits',
  'invalid-shape-limits',
] as const;

export type ConfigurationDiagnosticCode = (typeof CONFIGURATION_DIAGNOSTIC_CODES)[number];

/**
 * Location facts the consumer already holds. Never read from the template or the render data:
 * `nodeId` is the id of the declaration being evaluated, `pathPrefix` its path in the model.
 */
export interface DiagnosticContext {
  readonly nodeId?: string | undefined;
  readonly pathPrefix?: readonly (string | number)[] | undefined;
}

/**
 * Fields every diagnostic carries. `path` and `nodeId` stay separate from `message` and are never
 * interpolated into it: a host application renders them as text and escapes them itself.
 */
interface DiagnosticBase {
  /** Actionable English sentence, safe to log: it never carries a render value. */
  readonly message: string;
  /** Segments from the model root to the offending field, root first. */
  readonly path: readonly (string | number)[];
  /** Supplied by the consumer; node ids are not unique document-wide, so `path` is canonical. */
  readonly nodeId: string | undefined;
}

interface TemplateValidationDiagnosticBase extends DiagnosticBase {
  readonly source: 'template-validation';
}

/** Schema validation facts needed to translate a diagnostic without parsing its English message. */
export type TemplateValidationDiagnostic =
  | (TemplateValidationDiagnosticBase & {
      readonly code: 'invalid-type';
      readonly expected: string;
    })
  | (TemplateValidationDiagnosticBase & {
      readonly code: 'invalid-value';
      readonly acceptedValues: readonly string[];
    })
  | (TemplateValidationDiagnosticBase & {
      readonly code: Exclude<TemplateValidationCode, 'invalid-type' | 'invalid-value'>;
    });

export interface TemplateMigrationDiagnostic extends DiagnosticBase {
  readonly source: 'template-migration';
  readonly code: TemplateMigrationErrorCode;
  readonly fromVersion: number | undefined;
}

export interface TemplateShapeDiagnostic extends DiagnosticBase {
  readonly source: 'template-shape';
  readonly code: ShapeErrorCode;
  readonly limit: number | undefined;
}

interface ExpressionDiagnosticBase extends DiagnosticBase {
  readonly source: 'expression-evaluation';
  readonly site: ExpressionErrorSite;
}

/**
 * Keeps the narrowing of `ExpressionErrorDetails`: `actualType` on an operand branch, `limit` on a
 * bound branch, and neither widened into an optional field the other branch cannot mean.
 */
export type ExpressionEvaluationDiagnostic =
  | (ExpressionDiagnosticBase & {
      readonly code: OperandErrorCode;
      readonly actualType: ExpressionValueType;
    })
  | (ExpressionDiagnosticBase & {
      readonly code: LimitErrorCode;
      readonly limit: number;
    });

export interface PresentationResolutionDiagnostic extends DiagnosticBase {
  readonly source: 'presentation-resolution';
  readonly code: PresentationRefusal;
}

export interface ConfigurationDiagnostic extends DiagnosticBase {
  readonly source: 'configuration';
  readonly code: ConfigurationDiagnosticCode;
}

/** Every refusal `@openview/core` can name, as one discriminated union. */
export type OpenviewDiagnostic =
  | TemplateValidationDiagnostic
  | TemplateMigrationDiagnostic
  | TemplateShapeDiagnostic
  | ExpressionEvaluationDiagnostic
  | PresentationResolutionDiagnostic
  | ConfigurationDiagnostic;
