/**
 * Structured diagnostics: one discriminated union for every refusal `@openview/core` can name.
 *
 * A diagnostic pairs a ready-to-show English sentence with stable fields a host application can
 * translate or lay out itself. `source` + `code` is the translation key; `message` never carries a
 * render value, a model excerpt, an original cause or an environment reading, so a diagnostic stays
 * safe to log even when the document is not.
 *
 * Barrel by design: consumers import from here, never from the files behind it.
 *
 * @see docs/adr/0010-un-refus-comprehensible.md
 */
export { diagnosticOfPresentationRefusal, diagnosticsOf } from './diagnose.js';
export type {
  ConfigurationDiagnostic,
  ConfigurationDiagnosticCode,
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
  DIAGNOSTIC_SOURCES,
  TEMPLATE_VALIDATION_CODES,
} from './types.js';
