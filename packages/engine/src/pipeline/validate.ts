import { parseTemplate, type ShapeLimits, type Template } from '@openview/core';
import { refusalOf } from '../errors.js';

const TEMPLATE_REFUSED =
  'This template could not be brought to the current schema version and validated. Read `details.diagnostics` for the field-level reasons.';

/**
 * Bounds, migrates and validates the incoming template once, at the pipeline entry.
 *
 * Runs even though the static type already says `Template`: the type is a promise made to the
 * compiler, not to a JavaScript caller, and a historic document must be migrated before any
 * recursion of the engine touches it.
 */
export function validateTemplate(raw: unknown, shapeLimits?: Partial<ShapeLimits>): Template {
  try {
    return parseTemplate(raw, undefined, shapeLimits);
  } catch (error) {
    throw refusalOf(error, TEMPLATE_REFUSED, 'template-refused');
  }
}
