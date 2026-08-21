import type {
  ExpressionEvaluationError,
  TemplateMigrationError,
  TemplateShapeError,
} from '../errors.js';
import { CONFIGURATION_MESSAGES, MIGRATION_MESSAGES, SHAPE_MESSAGES } from './messages.js';
import { joinPath } from './paths.js';
import type {
  ConfigurationDiagnostic,
  ConfigurationDiagnosticCode,
  DiagnosticContext,
  ExpressionEvaluationDiagnostic,
  TemplateMigrationDiagnostic,
  TemplateShapeDiagnostic,
} from './types.js';

/**
 * Keeps the error's own sentence: an expression message already names the expectation and the fix.
 * The path is `pathPrefix` then the path within the expression, and the error is never mutated.
 */
export function diagnosticOfExpressionError(
  error: ExpressionEvaluationError,
  context: DiagnosticContext | undefined,
): ExpressionEvaluationDiagnostic {
  const details = error.details;
  const common = {
    source: 'expression-evaluation',
    message: error.message,
    path: joinPath(context?.pathPrefix, details.at),
    nodeId: context?.nodeId,
    site: details.site,
  } as const;
  return 'actualType' in details
    ? { ...common, code: details.code, actualType: details.actualType }
    : { ...common, code: details.code, limit: details.limit };
}

/** `Number.NaN` is how the migration chain says "no version was readable"; it travels as absent. */
export function diagnosticOfMigrationError(
  error: TemplateMigrationError,
  context: DiagnosticContext | undefined,
): TemplateMigrationDiagnostic {
  return {
    source: 'template-migration',
    code: error.code,
    message: MIGRATION_MESSAGES[error.code],
    path: joinPath(context?.pathPrefix, []),
    nodeId: context?.nodeId,
    fromVersion: Number.isFinite(error.fromVersion) ? error.fromVersion : undefined,
  };
}

export function diagnosticOfShapeError(
  error: TemplateShapeError,
  context: DiagnosticContext | undefined,
): TemplateShapeDiagnostic {
  return {
    source: 'template-shape',
    code: error.code,
    message: SHAPE_MESSAGES[error.code],
    path: joinPath(context?.pathPrefix, []),
    nodeId: context?.nodeId,
    limit: error.limit,
  };
}

export function diagnosticOfConfiguration(
  code: ConfigurationDiagnosticCode,
  context: DiagnosticContext | undefined,
): ConfigurationDiagnostic {
  return {
    source: 'configuration',
    code,
    message: CONFIGURATION_MESSAGES[code],
    path: joinPath(context?.pathPrefix, []),
    nodeId: context?.nodeId,
  };
}
