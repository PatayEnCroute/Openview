/**
 * Structured diagnostics for every refusal `@openview/core` can name.
 * Stable fields support translation and layout without exposing render values or causes.
 * @see docs/adr/0010-un-refus-comprehensible.md
 */
export { diagnosticOfPresentationRefusal, diagnosticsOf } from './diagnose.js';
export type {
  ConfigurationDiagnostic,
  ConfigurationDiagnosticCode,
  DataCompatibilityCode,
  DataCompatibilityDiagnostic,
  DiagnosticContext,
  DiagnosticSource,
  ExpressionEvaluationDiagnostic,
  OpenviewDiagnostic,
  PresentationResolutionDiagnostic,
  TemplateMigrationDiagnostic,
  TemplateShapeDiagnostic,
  TemplateValidationCode,
  TemplateValidationDiagnostic,
} from './types.js';
export {
  CONFIGURATION_DIAGNOSTIC_CODES,
  DATA_COMPATIBILITY_CODES,
  DIAGNOSTIC_SOURCES,
  TEMPLATE_VALIDATION_CODES,
} from './types.js';
