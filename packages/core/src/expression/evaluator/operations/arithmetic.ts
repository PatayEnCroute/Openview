import type { ExpressionErrorSite } from '../../../errors.js';
import type { ArithmeticOperator } from '../../types.js';
import { fail } from '../context.js';
import { requireFiniteResult, requireNumber } from '../guards.js';

function apply(op: ArithmeticOperator, left: number, right: number): number {
  switch (op) {
    case 'add':
      return left + right;
    case 'sub':
      return left - right;
    case 'mul':
      return left * right;
    default:
      return left / right;
  }
}

export function evaluateArithmetic(
  op: ArithmeticOperator,
  left: unknown,
  right: unknown,
  site: ExpressionErrorSite,
): number | undefined {
  // Both operands are shape-checked before absence is considered, so a present-but-wrong
  // operand still raises when its sibling is missing.
  const first = requireNumber(left, site, ['left']);
  const second = requireNumber(right, site, ['right']);
  if (first === undefined || second === undefined) {
    return undefined;
  }
  if (op === 'div' && second === 0) {
    // Not missing data -- a WRONG FORMULA. Never Infinity, never NaN. The absent divisor
    // is the other case entirely, and it propagates.
    return fail(
      { code: 'division-by-zero', site, at: ['right'], actualType: 'number' },
      'This formula divides by zero. A divisor that is present and equal to zero is a wrong formula, not missing data: guard it with an `if`, or the document would carry Infinity.',
    );
  }
  return requireFiniteResult(apply(op, first, second), site, []);
}

export function evaluatePercentOf(
  base: unknown,
  rate: unknown,
  site: ExpressionErrorSite,
): number | undefined {
  const amount = requireNumber(base, site, ['base']);
  const points = requireNumber(rate, site, ['rate']);
  if (amount === undefined || points === undefined) {
    return undefined;
  }
  // `(base * rate) / 100`, in that order and with no rounding: the order is part of the
  // result under binary64, and a default rounding would be a rounding position de facto.
  return requireFiniteResult((amount * points) / 100, site, []);
}
