import { describe, expect, it } from 'vitest';
import * as core from '../../index.js';
import {
  CONFIGURATION_DIAGNOSTIC_CODES,
  type ConfigurationDiagnosticCode,
  DIAGNOSTIC_SOURCES,
  type DiagnosticSource,
  EXPRESSION_ERROR_CODES,
  type ExpressionErrorCode,
  PRESENTATION_REFUSALS,
  type PresentationRefusal,
  SHAPE_ERROR_CODES,
  type ShapeErrorCode,
  TEMPLATE_MIGRATION_ERROR_CODES,
  TEMPLATE_VALIDATION_CODES,
  type TemplateMigrationErrorCode,
  type TemplateValidationCode,
} from '../../index.js';

/**
 * Every closed catalogue is enumerated from its own tuple, and every tuple is covered by a total
 * `Record`. Adding a member without a scenario stops compiling; removing one stops compiling too.
 */
describe('the diagnostic catalogues', () => {
  it('names six families', () => {
    const covered: Readonly<Record<DiagnosticSource, true>> = {
      'template-validation': true,
      'template-migration': true,
      'template-shape': true,
      'expression-evaluation': true,
      'presentation-resolution': true,
      configuration: true,
    };
    expect([...DIAGNOSTIC_SOURCES].sort()).toEqual(Object.keys(covered).sort());
  });

  it('names six validation codes', () => {
    const covered: Readonly<Record<TemplateValidationCode, true>> = {
      'invalid-type': true,
      'invalid-value': true,
      'invalid-format': true,
      'out-of-range': true,
      'invalid-structure': true,
      'invalid-relation': true,
    };
    expect([...TEMPLATE_VALIDATION_CODES].sort()).toEqual(Object.keys(covered).sort());
  });

  it('names five migration codes', () => {
    const covered: Readonly<Record<TemplateMigrationErrorCode, true>> = {
      'invalid-template': true,
      'missing-schema-version': true,
      'newer-schema-version': true,
      'missing-migration': true,
      'invalid-migration-result': true,
    };
    expect([...TEMPLATE_MIGRATION_ERROR_CODES].sort()).toEqual(Object.keys(covered).sort());
  });

  it('names two configuration codes', () => {
    const covered: Readonly<Record<ConfigurationDiagnosticCode, true>> = {
      'invalid-evaluation-limits': true,
      'invalid-shape-limits': true,
    };
    expect([...CONFIGURATION_DIAGNOSTIC_CODES].sort()).toEqual(Object.keys(covered).sort());
  });

  it('turns the presentation union into a real tuple', () => {
    const covered: Readonly<Record<PresentationRefusal, true>> = {
      'unknown-writing': true,
      'invalid-writing': true,
      'unhonoured-locale': true,
    };
    expect([...PRESENTATION_REFUSALS].sort()).toEqual(Object.keys(covered).sort());
  });

  it('keeps the expression and shape catalogues as the only source of their codes', () => {
    // C8 copies neither into a list of its own: a member added upstream must land in the scenario
    // matrices of this folder, not in a second catalogue that could drift from the first.
    const expression: Readonly<Record<ExpressionErrorCode, true>> = {
      'operand-type': true,
      'division-by-zero': true,
      'not-finite': true,
      'not-a-whole-number': true,
      'not-a-list': true,
      'not-a-boolean': true,
      'not-comparable': true,
      'not-orderable': true,
      'not-a-date': true,
      'step-limit-exceeded': true,
      'item-limit-exceeded': true,
      'string-limit-exceeded': true,
      'depth-limit-exceeded': true,
    };
    const shape: Readonly<Record<ShapeErrorCode, true>> = {
      'too-deep': true,
      'too-many-nodes': true,
      'not-plain-data': true,
    };
    expect([...EXPRESSION_ERROR_CODES].sort()).toEqual(Object.keys(expression).sort());
    expect([...SHAPE_ERROR_CODES].sort()).toEqual(Object.keys(shape).sort());
  });
});

describe('the public surface of the diagnostic façade', () => {
  it('publishes the two functions and the three tuples', () => {
    // By name, never by total: a symbol left out of `index.ts` compiles and ships unreachable, and
    // that is the only failure this can catch.
    const values = Object.keys(core);
    for (const symbol of [
      'diagnosticsOf',
      'diagnosticOfPresentationRefusal',
      'DIAGNOSTIC_SOURCES',
      'TEMPLATE_VALIDATION_CODES',
      'CONFIGURATION_DIAGNOSTIC_CODES',
      'TEMPLATE_MIGRATION_ERROR_CODES',
      'PRESENTATION_REFUSALS',
    ]) {
      expect(values).toContain(symbol);
    }
  });
});
