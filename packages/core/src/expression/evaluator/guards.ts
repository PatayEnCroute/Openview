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
 * The boolean check, without the descent -- so an operand of `logical` can be
 * evaluated at its own position and then checked at that same position.
 *
 * JavaScript truthiness is refused on purpose: it would make `{ path: 'total' }` false
 * for a total of 0, and an invoice silently dropping a zero line is exactly the class
 * of bug a document engine must not have.
 *
 * Absent data is the one exception: null and undefined read as false, so a condition
 * on a field that was never supplied hides its branch instead of aborting the render.
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
 * A finite number, or `undefined` for absence. Everything else raises (ADR 0003,
 * decision 6).
 *
 * Three policies meet here, and the third is the one an earlier design got wrong:
 *
 * - **Absent data propagates.** Choosing `0` would be core deciding, on
 *   `DataBindingStep`'s behalf, the question ADR 0001 left open -- and `0` is right for a
 *   sum and wrong for a division.
 * - **A value that is PRESENT and of the wrong type raises `operand-type`.** No coercion:
 *   the ADR 0001 rule is extended here, not eroded, so `1 * '2'` raises where JavaScript
 *   would have yielded 2.
 * - **A value that is present and NOT FINITE raises `not-finite`,** which is a distinct
 *   code and not a flavour of `operand-type`. One rule, stated once: *`operand-type`
 *   answers for a value's SHAPE, `not-finite` for its FINITENESS.* Two codes for one
 *   situation would have forced lot C8 to write two messages for the same fault.
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
    // Sealed UPSTREAM: `Number.isFinite` rather than `typeof === 'number'`, because a NaN
    // that came in with the data would otherwise travel through three levels of formula
    // and print into a document.
    return fail(
      { code: 'not-finite', site, at, actualType: 'not-finite' },
      'A calculation needs a finite number. NaN and the infinities are numbers to JavaScript and faults to a document.',
    );
  }
  return value;
}

/**
 * The same rule at the OTHER end, and the same code -- plus the one normalisation an exit owes
 * a document.
 *
 * An accumulation overflow -- 60 000 lines at 1e307 -- must not print `Infinity` into a
 * document. `not-finite` at the entry and at the exit, so the policy cannot re-fracture at
 * the first copy-paste.
 *
 * **`-0` collapses to `0` here,** and here rather than in each operator because this is the ONE
 * door every number the algebra PRODUCES comes through: `mul(0, -1)`, `div(0, -5)` and
 * `percentOf(0, -10)` all yield `-0` under binary64, and `roundDecimal` already refused to emit
 * one for the reason it states -- a negative zero is not part of a document's vocabulary. It
 * stays invisible only while nothing formats it: `String(-0)` is `"0"`, but a currency
 * formatter keeps the sign, so lot C6 is where it would have surfaced -- on an invoice, and
 * `Object.is` makes it visible in a test and in a `min`/`max` fold long before that.
 *
 * It is a sign on an exact zero, NOT a rounding. `div` and `percentOf` still round nothing, and
 * the two tests that pin that -- `does NOT round a division` and `does not round either` --
 * keep their assertions untouched, as ADR 0004 requires.
 *
 * What it deliberately does NOT do: rewrite a `-0` the caller's DATA carries. `min`/`max`
 * return an element rather than a computed value, and a `path` returns the datum itself;
 * normalising those would be `core` deciding on `DataBindingStep`'s behalf, which is the
 * boundary ADR 0001 leaves to the integrator.
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
  // `value === 0` is true of both zeros, so this one comparison is the whole normalisation.
  return value === 0 ? 0 : value;
}

/**
 * The bound on a string an operator PRODUCED, checked after every construction.
 *
 * After every construction and not only at the end, because that is the only order that
 * stops the intermediate string from existing before being refused: `concat` amplifies by
 * 2^depth times the longest string in the data, so a depth-18 balanced tree over a 1 kB
 * value reaches 268 MB. All three text-producing kinds come through this one door -- without
 * that, the bound would be sidestepped by `upper(concat(...))`.
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

/** A string operand: absence propagates, anything else that is not text raises. */
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
 * A date operand, as a day number.
 *
 * `site` comes from the CALLING node and is never hard-coded to `'dateAdd'`. That is the most
 * likely copy-paste mistake of the lot, and it passes all four gates while naming the wrong
 * operator to the user -- which is exactly what lot C8 exists to prevent. Hence the tests on
 * `dateDiff` and `endOfMonth`, not only on `dateAdd`.
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

/** A whole number of days. A fraction is a wrong operand shape, not a wrong date. */
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
    // `not-a-whole-number` and NOT `operand-type`: the shape here is right -- it IS a
    // number -- and only its wholeness is wrong. Reporting `operand-type` with
    // `actualType: 'number'` made the payload contradict itself, so lot C8 generating from
    // code plus actualType would have said "operates on numbers, got a number".
    return fail(
      { code: 'not-a-whole-number', site, at, actualType: 'number' },
      'A date shift is a whole number of days. Wrap the value in a `round` first, with a `decimals` of 0 and a `mode` of `halfExpand` or `halfEven`.',
    );
  }
  return days;
}

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
