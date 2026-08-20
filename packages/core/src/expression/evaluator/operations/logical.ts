import type { EvaluationBudget } from '../../limits.js';
import type { Expression } from '../../types.js';
import { isEmptyValue, requireBoolean } from '../guards.js';
import type { EvaluationScope } from '../scope.js';

/** Evaluates a conditional `if(when, whenTrue, whenFalse)` expression with short-circuiting. */
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
  const taken = requireBoolean(whenRaw, 'if', ['when']);
  return taken
    ? evaluateWithinFn(whenTrueExpr, ['whenTrue'], scope, budget)
    : evaluateWithinFn(whenFalseExpr, ['whenFalse'], scope, budget);
}

/** Evaluates logical `and` / `or` expressions across operands with short-circuiting. */
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
  const decide = (operand: Expression, index: number): boolean =>
    requireBoolean(evaluateWithinFn(operand, ['operands', index], scope, budget), 'logical', [
      'operands',
      index,
    ]);

  if (op === 'and') {
    return operands.every((operand, index) => decide(operand, index));
  }
  return operands.some((operand, index) => decide(operand, index));
}

/** Evaluates logical `not` negation. */
export function evaluateNot(operandRaw: unknown): boolean {
  return !requireBoolean(operandRaw, 'not', ['operand']);
}

/** Evaluates `isEmpty` check. */
export function evaluateIsEmpty(operandRaw: unknown): boolean {
  return isEmptyValue(operandRaw);
}
