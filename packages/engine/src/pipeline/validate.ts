import { parseTemplate, type ShapeLimits, type Template } from '@openview/core';
import { refusalOf } from '../errors.js';

const TEMPLATE_REFUSED =
  'This template could not be brought to the current schema version and validated. Read `details.diagnostics` for the field-level reasons.';

/**
 * Validates, migrates, and bounds the incoming template at the pipeline entry.
 */
export function validateTemplate(raw: unknown, shapeLimits?: Partial<ShapeLimits>): Template {
  try {
    return parseTemplate(raw, undefined, shapeLimits);
  } catch (error) {
    throw refusalOf(error, TEMPLATE_REFUSED, 'template-refused');
  }
}
