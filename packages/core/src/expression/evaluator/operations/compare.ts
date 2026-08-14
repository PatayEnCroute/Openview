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

export function evaluateCompare(
  op: ComparisonOperator,
  left: unknown,
  right: unknown,
  site: ExpressionErrorSite,
): boolean {
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
    const equal = left === right;
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
