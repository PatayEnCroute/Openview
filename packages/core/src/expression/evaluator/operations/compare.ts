import type { ExpressionErrorSite } from '../../../errors.js';
import type { ComparisonOperator } from '../../types.js';
import { valueTypeOf } from '../../value-type.js';
import { describe, fail } from '../context.js';
import { isAbsent, isPrimitive } from '../guards.js';

function order<TComparable extends number | string>(
  op: Exclude<ComparisonOperator, 'eq' | 'neq'>,
  left: TComparable,
  right: TComparable,
): boolean {
  switch (op) {
    case 'gt':
      return left > right;
    case 'gte':
      return left >= right;
    case 'lt':
      return left < right;
    default:
      return left <= right;
  }
}

/**
 * The `not-finite` seal, at the position that decides which branch of a document renders.
 *
 * `requireNumber` seals it for a calculation, and leaving a comparison unsealed reopened
 * the hole in the one place it cannot be seen: every ordering operator answers `false` for
 * a `NaN`, so `filter(lines, l, gt(l.total, 0))` DROPS the line and `if(gte(total, 0), …)`
 * takes the other branch -- no error, wrong document. `Infinity` is worse than silent:
 * `gt(total, 100)` answers `true`, so a corrupt total passes a threshold test.
 *
 * Applied to BOTH operands before the eq/neq branch as well as before the ordering one:
 * `NaN === NaN` is `false`, so an equality would report two identical faults as different.
 */
function refuseNonFinite(value: unknown, site: ExpressionErrorSite, field: 'left' | 'right'): void {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    fail(
      { code: 'not-finite', site, at: [field], actualType: 'not-finite' },
      'A comparison needs a finite number. NaN and the infinities are numbers to JavaScript and faults to a document.',
    );
  }
}

export function evaluateCompare(
  op: ComparisonOperator,
  left: unknown,
  right: unknown,
  site: ExpressionErrorSite,
): boolean {
  refuseNonFinite(left, site, 'left');
  refuseNonFinite(right, site, 'right');

  if (op === 'eq' || op === 'neq') {
    // Objects and arrays would compare by reference, which is never what a
    // template author means.
    if (!isPrimitive(left) || !isPrimitive(right)) {
      // The path names the first operand that is at fault, which is the one an
      // author has to look at first.
      const culprit = isPrimitive(left) ? 'right' : 'left';
      return fail(
        {
          code: 'not-comparable',
          site,
          at: [culprit],
          actualType: valueTypeOf(culprit === 'left' ? left : right),
        },
        `Cannot compare ${describe(valueTypeOf(left))} with ${describe(valueTypeOf(right))}: eq/neq operate on primitives.`,
      );
    }
    // `isAbsent` rather than a bare `===`, so `null` and `undefined` are ONE value here as
    // they are everywhere else in the algebra -- in `guards.ts`, and in the ordering branch
    // three lines below. Without it a JSON `null` the caller emitted for "no discount"
    // read as DIFFERENT from a key the caller simply omitted, and `neq` answered `true`
    // for two values the same expression tree orders as equal.
    const equal =
      isAbsent(left) || isAbsent(right) ? isAbsent(left) && isAbsent(right) : left === right;
    return op === 'eq' ? equal : !equal;
  }

  // Absent data orders as false, like eq/neq already treat it and like
  // evaluatePredicate documents. Throwing here meant one invoice line missing an
  // optional `discount` aborted the whole document -- and until loops could bind
  // an item, no condition was ever evaluated against per-item data, so the cost
  // was invisible. A value that is PRESENT and of the wrong type still throws
  // below: that is a data-shape bug, not absence.
  if (isAbsent(left) || isAbsent(right)) {
    return false;
  }

  // Ordering refuses coercion on purpose. JavaScript would happily evaluate
  // '10' < '9' as true, and a template comparing a numeric string to a number
  // is a data-shape bug that must surface rather than silently mis-render.
  if (typeof left === 'number' && typeof right === 'number') {
    return order(op, left, right);
  }
  if (typeof left === 'string' && typeof right === 'string') {
    return order(op, left, right);
  }
  // Here the PAIR is at fault, not one side: two booleans are each fine and still
  // unorderable. The path anchors on `left` -- the message names both shapes, and a
  // payload has to point somewhere.
  return fail(
    { code: 'not-orderable', site, at: ['left'], actualType: valueTypeOf(left) },
    `Cannot order ${describe(valueTypeOf(left))} against ${describe(valueTypeOf(right))}: ${op} needs two numbers or two strings.`,
  );
}
