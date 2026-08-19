import type { ExpressionErrorSite } from '../../../errors.js';
import type { ArithmeticOperator } from '../../types.js';
import { fail } from '../context.js';
import { requireFiniteResult, requireNumber } from '../guards.js';

/**
 * The four operations, dispatched by an exhaustive `switch` rather than by a `default` that
 * divides -- and that is not style.
 *
 * `div` used to BE the `default`, so an operator outside `ARITHMETIC_OPERATORS` answered with a
 * quotient: measured, `op: 'mod'` over 7 and 2 yielded `3.5` -- a plausible AMOUNT where a
 * refusal was owed, which is the one failure mode a document engine cannot afford.
 * `z.enum(ARITHMETIC_OPERATORS)` refuses that op, so only an untyped caller of the public
 * `evaluateExpression` reaches here; that is the same reserve `goesUp` keeps for a mode outside
 * `ROUND_MODES`, for the same reason, and it is pinned by the same kind of test.
 *
 * The `never` is what turns a future omission into a COMPILE error instead of a silent
 * division -- the control AGENTS.md 3.B's amendment rests on, applied where the operator is
 * actually read.
 */
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
 * `add`, `sub`, `mul` and `div` over two already-evaluated operands.
 *
 * `site` is a PARAMETER here where `evaluateRound` hard-codes its own, and the criterion is the
 * one that docstring states: a body that reads a kind's own fields cannot be copy-pasted onto
 * another kind, a generic binary operation can. So the site keeps coming from the node being
 * evaluated, which is what holds `payload.site === expression.kind` from the one place that
 * knows the kind -- what `requireDate` argues from the other side.
 *
 * The three policies of ADR 0003 decision 6, in the order the code applies them, which is not
 * the order a reader assumes:
 *
 * - **Shape BEFORE absence.** Both operands are shape-checked first, so `add(missing, '2')`
 *   raises `operand-type` rather than propagating absence: a present-but-wrong operand is a
 *   fault whatever its sibling does.
 * - **Then absence propagates,** and never becomes `0`: `sub(total, missing)` yields nothing,
 *   and THAT is what earns the `if` kind its place.
 * - **A divisor that is present and equal to zero raises `division-by-zero`** -- but only once
 *   BOTH operands are present, so `div(missing, 0)` propagates absence and raises nothing. `-0`
 *   is such a divisor: it is `=== 0`, and dividing by it would yield an infinity.
 *
 * Nothing here rounds -- `div(1, 3)` yields `0.3333333333333333`, and a test pins it. The exit
 * normalises exactly one value, `-0`, and {@link requireFiniteResult} says why that is a sign
 * on an exact zero rather than a rounding.
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
    // Not missing data -- a WRONG FORMULA. Never Infinity, never NaN. The absent divisor
    // is the other case entirely, and it propagates.
    return fail(
      { code: 'division-by-zero', site, at: ['right'], actualType: 'number' },
      'This formula divides by zero. A divisor that is present and equal to zero is a wrong formula, not missing data: guard it with an `if`, or the document would carry Infinity.',
    );
  }
  return requireFiniteResult(apply(op, first, second), site, []);
}

/**
 * `base * rate / 100`, with the rate expressed in POINTS: `percentOf(1500, 20)` is 300.
 *
 * The three policies of {@link evaluateArithmetic} apply unchanged, at this kind's own field
 * names, and so does the absence of rounding: `percentOf(10, 3)` yields `0.3`, not a rounded
 * amount. `(base * rate) / 100` is computed in THAT order -- the order is part of the result
 * under binary64 -- and the multiplication is also where an overflow lives, which is why the
 * finiteness of the RESULT is checked and not only that of the operands: `percentOf(1e308, 10)`
 * reaches an infinity before the division ever runs.
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
