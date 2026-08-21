import { z } from 'zod/v4';
import {
  ExpressionEvaluationError,
  InvalidEvaluationLimitsError,
  InvalidShapeLimitsError,
  TemplateMigrationError,
  TemplateShapeError,
} from '../errors.js';
import type { PresentationRefusal } from '../presentation/types.js';
import {
  diagnosticOfConfiguration,
  diagnosticOfExpressionError,
  diagnosticOfMigrationError,
  diagnosticOfShapeError,
} from './from-error.js';
import { diagnosticsOfZodError } from './from-zod.js';
import { PRESENTATION_MESSAGES } from './messages.js';
import { joinPath } from './paths.js';
import type {
  DiagnosticContext,
  OpenviewDiagnostic,
  PresentationResolutionDiagnostic,
} from './types.js';

/**
 * Names a refusal Openview raised, or returns `undefined` for anything else so the caller can
 * rethrow it. A programming fault is never turned into a sentence a model author would try to fix:
 *
 * ```ts
 * const diagnostics = diagnosticsOf(error, context);
 * if (diagnostics === undefined) {
 *   throw error;
 * }
 * ```
 *
 * A validation error carries one diagnostic per issue; every other family carries exactly one.
 */
export function diagnosticsOf(
  error: unknown,
  context?: DiagnosticContext,
): readonly OpenviewDiagnostic[] | undefined {
  if (error instanceof z.core.$ZodError) {
    return diagnosticsOfZodError(error, context);
  }
  if (error instanceof ExpressionEvaluationError) {
    return [diagnosticOfExpressionError(error, context)];
  }
  if (error instanceof TemplateMigrationError) {
    return [diagnosticOfMigrationError(error, context)];
  }
  if (error instanceof TemplateShapeError) {
    return [diagnosticOfShapeError(error, context)];
  }
  if (error instanceof InvalidEvaluationLimitsError) {
    return [diagnosticOfConfiguration('invalid-evaluation-limits', context)];
  }
  if (error instanceof InvalidShapeLimitsError) {
    return [diagnosticOfConfiguration('invalid-shape-limits', context)];
  }
  return undefined;
}

/**
 * Names a `resolvePresentation` refusal. Separate from {@link diagnosticsOf} because a refusal is a
 * normal return value, not an exception, and the language it refuses never picks this sentence's
 * language: a diagnostic addresses the author's tooling, a writing addresses the printed document.
 */
export function diagnosticOfPresentationRefusal(
  refusal: PresentationRefusal,
  context?: DiagnosticContext,
): PresentationResolutionDiagnostic {
  return {
    source: 'presentation-resolution',
    code: refusal,
    message: PRESENTATION_MESSAGES[refusal],
    path: joinPath(context?.pathPrefix, []),
    nodeId: context?.nodeId,
  };
}
