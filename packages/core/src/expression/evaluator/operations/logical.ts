import type { EvaluationBudget } from '../../limits.js';
import type { Expression } from '../../types.js';
import { isEmptyValue, requireBoolean } from '../guards.js';
import type { EvaluationScope } from '../scope.js';

export function evaluateIf(
  whenRaw: unknown,
  whenTrueExpr: Expression,
  whenFalseExpr: Expression,
  scope: EvaluationScope,
  budget: EvaluationBudget,
  evaluateWithinFn: (
    expr: Expression,
    at: readonly (string | number)[],
    scope: EvaluationScope,
    budget: EvaluationBudget,
  ) => unknown,
): unknown {
  // The short circuit is a CORRECTNESS rule, not an optimisation: `and`/`or` already
  // short-circuit, so an author legitimately assumes the "if" does too -- and the
  // surprise would be paid in a division by zero on a branch that was not taken.
  // Written "naturally" (evaluate both, then choose), this is the one test of the lot
  // that fails.
  const taken = requireBoolean(whenRaw, 'if', ['when']);
  return taken
    ? evaluateWithinFn(whenTrueExpr, ['whenTrue'], scope, budget)
    : evaluateWithinFn(whenFalseExpr, ['whenFalse'], scope, budget);
}

export function evaluateLogical(
  op: 'and' | 'or',
  operands: readonly Expression[],
  scope: EvaluationScope,
  budget: EvaluationBudget,
  evaluateWithinFn: (
    expr: Expression,
    at: readonly (string | number)[],
    scope: EvaluationScope,
    budget: EvaluationBudget,
  ) => unknown,
): boolean {
  // Short-circuits, so `and(hasCustomer, customer.age > 18)` never evaluates
  // the right-hand side against missing data.
  const decide = (operand: Expression, index: number): boolean =>
    requireBoolean(evaluateWithinFn(operand, ['operands', index], scope, budget), 'logical', [
      'operands',
      index,
    ]);

  // `decide` is applied through an explicit arrow rather than passed by reference:
  // its second parameter is the index, on purpose, and a bare `every(decide)` reads
  // the same as the accident that rule S7727 exists to catch -- a callback silently
  // fed the index and the array it never meant to take.
  if (op === 'and') {
    return operands.every((operand, index) => decide(operand, index));
  }
  return operands.some((operand, index) => decide(operand, index));
}

export function evaluateNot(operandRaw: unknown): boolean {
  return !requireBoolean(operandRaw, 'not', ['operand']);
}

export function evaluateIsEmpty(operandRaw: unknown): boolean {
  return isEmptyValue(operandRaw);
}
