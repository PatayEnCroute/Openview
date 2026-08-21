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
    case 'div':
      return left / right;
    default: {
      const exhaustive: never = op;
      throw new TypeError(`Unhandled arithmetic operator: ${String(exhaustive)}`);
    }
  }
}

/**
 * Evaluates binary arithmetic operators (add, sub, mul, div).
 */
export function evaluateArithmetic(
  op: ArithmeticOperator,
  left: unknown,
  right: unknown,
  site: ExpressionErrorSite,
): number | undefined {
  const first = requireNumber(left, site, ['left']);
  const second = requireNumber(right, site, ['right']);
  if (first === undefined || second === undefined) {
    return undefined;
  }
  if (op === 'div' && second === 0) {
    return fail(
      { code: 'division-by-zero', site, at: ['right'], actualType: 'number' },
      'This formula divides by zero. Guard the divisor with an "if" before dividing.',
    );
  }
  return requireFiniteResult(apply(op, first, second), site, []);
}

/**
 * Evaluates percentOf expressions (`(base * rate) / 100`).
 */
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
  return requireFiniteResult((amount * points) / 100, site, []);
}
