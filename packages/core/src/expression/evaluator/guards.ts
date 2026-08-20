import type { ExpressionErrorSite } from '../../errors.js';
import { dayNumberOf } from '../civil-date.js';
import type { EvaluationBudget } from '../limits.js';
import { valueTypeOf } from '../value-type.js';
import { describe, fail } from './context.js';

export function isAbsent(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

export function isPrimitive(value: unknown): value is string | number | boolean | null | undefined {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

/**
 * Ensures a value is boolean without JavaScript truthiness coercion. Absence (null/undefined) resolves to false.
 */
export function requireBoolean(
  value: unknown,
  site: ExpressionErrorSite,
  at: readonly (string | number)[],
): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (isAbsent(value)) {
    return false;
  }
  return fail(
    { code: 'not-a-boolean', site, at, actualType: valueTypeOf(value) },
    `A condition must evaluate to a boolean, got ${describe(valueTypeOf(value))}. Wrap it in isEmpty, not, or a comparison instead of relying on truthiness.`,
  );
}

/**
 * Validates that an operand is a finite number, propagating absence as undefined.
 */
export function requireNumber(
  value: unknown,
  site: ExpressionErrorSite,
  at: readonly (string | number)[],
): number | undefined {
  if (isAbsent(value)) {
    return undefined;
  }
  if (typeof value !== 'number') {
    return fail(
      { code: 'operand-type', site, at, actualType: valueTypeOf(value) },
      `A calculation operates on numbers, got ${describe(valueTypeOf(value))}. The algebra refuses coercion, so turn the value into what you need explicitly.`,
    );
  }
  if (!Number.isFinite(value)) {
    return fail(
      { code: 'not-finite', site, at, actualType: 'not-finite' },
      'A calculation needs a finite number. NaN and the infinities are numbers to JavaScript and faults to a document.',
    );
  }
  return value;
}

/**
 * Validates that a numeric operation output is finite, normalizing -0 to 0.
 */
export function requireFiniteResult(
  value: number,
  site: ExpressionErrorSite,
  at: readonly (string | number)[],
): number {
  if (!Number.isFinite(value)) {
    return fail(
      { code: 'not-finite', site, at, actualType: 'not-finite' },
      'This calculation overflowed to a number that is not finite. A document must never print Infinity or NaN.',
    );
  }
  return value === 0 ? 0 : value;
}

/**
 * Enforces string length limits on evaluation results.
 */
export function acceptText(
  value: string,
  site: ExpressionErrorSite,
  at: readonly (string | number)[],
  budget: EvaluationBudget,
): string {
  if (!budget.acceptString(value.length)) {
    return fail(
      { code: 'string-limit-exceeded', site, at, limit: budget.limits.maxStringLength },
      `This formula built a text longer than ${budget.limits.maxStringLength} characters. Nested concatenations double at every level, so removing one level usually helps far more than shortening a value.`,
    );
  }
  return value;
}

/**
 * Validates that an operand is a string, propagating absence as undefined.
 */
export function requireText(
  value: unknown,
  site: ExpressionErrorSite,
  at: readonly (string | number)[],
): string | undefined {
  if (isAbsent(value)) {
    return undefined;
  }
  if (typeof value !== 'string') {
    return fail(
      { code: 'operand-type', site, at, actualType: valueTypeOf(value) },
      `Joining and case folding operate on text, got ${describe(valueTypeOf(value))}. Wrap a number in text(...) rather than relying on a coercion the algebra refuses.`,
    );
  }
  return value;
}

/**
 * Validates an ISO civil date string operand and returns its day number.
 */
export function requireDate(
  value: unknown,
  site: ExpressionErrorSite,
  at: readonly (string | number)[],
): number | undefined {
  if (isAbsent(value)) {
    return undefined;
  }
  if (typeof value !== 'string') {
    return fail(
      { code: 'operand-type', site, at, actualType: valueTypeOf(value) },
      `A date is a text in the YYYY-MM-DD form, got ${describe(valueTypeOf(value))}.`,
    );
  }
  const dayNumber = dayNumberOf(value);
  if (dayNumber === undefined) {
    return fail(
      { code: 'not-a-date', site, at, actualType: 'string' },
      'A date must be written YYYY-MM-DD, between 0001-01-01 and 9999-12-31. There is no time and no time zone: a civil date has no stable rendering in any zone but an explicit one.',
    );
  }
  return dayNumber;
}

/**
 * Validates that an operand represents an integer number of days.
 */
export function requireDays(
  value: unknown,
  site: ExpressionErrorSite,
  at: readonly (string | number)[],
): number | undefined {
  const days = requireNumber(value, site, at);
  if (days === undefined) {
    return undefined;
  }
  if (!Number.isInteger(days)) {
    return fail(
      { code: 'not-a-whole-number', site, at, actualType: 'number' },
      'A date shift is a whole number of days. Wrap the value in a `round` first, with a `decimals` of 0 and a `mode` of `halfExpand` or `halfEven`.',
    );
  }
  return days;
}

/**
 * Checks if a value is empty (null, undefined, empty string, empty array, or empty object).
 */
export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }
  return false;
}
