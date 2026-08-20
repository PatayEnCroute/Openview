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
    case 'lte':
      return left <= right;
    default: {
      const exhaustive: never = op;
      throw new TypeError(`Unhandled comparison operator: ${String(exhaustive)}`);
    }
  }
}

function refuseNonFinite(value: unknown, site: ExpressionErrorSite, field: 'left' | 'right'): void {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    fail(
      { code: 'not-finite', site, at: [field], actualType: 'not-finite' },
      'A comparison needs a finite number. NaN and the infinities are numbers to JavaScript and faults to a document.',
    );
  }
}

function evaluateEquality(
  op: 'eq' | 'neq',
  left: unknown,
  right: unknown,
  site: ExpressionErrorSite,
): boolean {
  if (!isPrimitive(left) || !isPrimitive(right)) {
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
  const equal =
    isAbsent(left) || isAbsent(right) ? isAbsent(left) && isAbsent(right) : left === right;
  return op === 'eq' ? equal : !equal;
}

function evaluateOrdering(
  op: Exclude<ComparisonOperator, 'eq' | 'neq'>,
  left: unknown,
  right: unknown,
  site: ExpressionErrorSite,
): boolean {
  if (isAbsent(left) || isAbsent(right)) {
    return false;
  }
  if (typeof left === 'number' && typeof right === 'number') {
    return order(op, left, right);
  }
  if (typeof left === 'string' && typeof right === 'string') {
    return order(op, left, right);
  }
  return fail(
    { code: 'not-orderable', site, at: ['left'], actualType: valueTypeOf(left) },
    `Cannot order ${describe(valueTypeOf(left))} against ${describe(valueTypeOf(right))}: ${op} needs two numbers or two strings.`,
  );
}

/**
 * Evaluates comparison operators (eq, neq, gt, gte, lt, lte) across primitive values.
 */
export function evaluateCompare(
  op: ComparisonOperator,
  left: unknown,
  right: unknown,
  site: ExpressionErrorSite,
): boolean {
  refuseNonFinite(left, site, 'left');
  refuseNonFinite(right, site, 'right');

  return op === 'eq' || op === 'neq'
    ? evaluateEquality(op, left, right, site)
    : evaluateOrdering(op, left, right, site);
}
