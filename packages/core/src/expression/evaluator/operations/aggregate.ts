import type { ExpressionErrorSite } from '../../../errors.js';
import type { EvaluationBudget } from '../../limits.js';
import type { AggregateExpression, Expression, FilterExpression } from '../../types.js';
import { type AttributedEvaluationOptions, type EvaluationOptions, prefixing } from '../context.js';
import { requireFiniteResult, requireNumber } from '../guards.js';
import { childScope, type EvaluationScope } from '../scope.js';

export function sourceItems(
  source: Expression,
  scope: EvaluationScope,
  budget: EvaluationBudget,
  caller: ExpressionErrorSite,
  evaluateSequenceFn: (
    expr: Expression,
    scope: EvaluationScope,
    opts?: AttributedEvaluationOptions | undefined,
  ) => readonly unknown[],
): readonly unknown[] {
  return prefixing(['source'], () => evaluateSequenceFn(source, scope, { budget, caller }));
}

/**
 * Evaluates list aggregations (sum, avg, min, max) over an iterable source.
 */
export function evaluateAggregate(
  expression: AggregateExpression,
  scope: EvaluationScope,
  budget: EvaluationBudget,
  evaluateExpressionFn: (
    expr: Expression,
    scope: EvaluationScope,
    opts?: EvaluationOptions | undefined,
  ) => unknown,
  evaluateSequenceFn: (
    expr: Expression,
    scope: EvaluationScope,
    opts?: AttributedEvaluationOptions | undefined,
  ) => readonly unknown[],
): number | undefined {
  const items = sourceItems(expression.source, scope, budget, 'aggregate', evaluateSequenceFn);
  let total = 0;
  let present = 0;
  let extremum: number | undefined;

  const tracksExtremum = expression.op === 'min' || expression.op === 'max';
  const wantsSmallest = expression.op === 'min';

  for (const [index, item] of items.entries()) {
    const itemScope = childScope(scope, expression.as, item);
    const raw = prefixing(['value', index], () =>
      evaluateExpressionFn(expression.value, itemScope, { budget }),
    );
    const value = requireNumber(raw, 'aggregate', ['value', index]);
    if (value === undefined) {
      continue;
    }
    present += 1;
    total += value;
    if (
      tracksExtremum &&
      (extremum === undefined || (wantsSmallest ? value < extremum : value > extremum))
    ) {
      extremum = value;
    }
  }

  if (expression.op === 'sum') {
    return requireFiniteResult(total, 'aggregate', []);
  }
  if (expression.op === 'avg') {
    return present === 0 ? undefined : requireFiniteResult(total / present, 'aggregate', []);
  }
  return extremum;
}

/**
 * Filters source items using a predicate expression evaluated in an item scope.
 */
export function evaluateFilter(
  expression: FilterExpression,
  scope: EvaluationScope,
  budget: EvaluationBudget,
  evaluatePredicateFn: (
    expr: Expression,
    scope: EvaluationScope,
    opts?: AttributedEvaluationOptions | undefined,
  ) => boolean,
  evaluateSequenceFn: (
    expr: Expression,
    scope: EvaluationScope,
    opts?: AttributedEvaluationOptions | undefined,
  ) => readonly unknown[],
): readonly unknown[] {
  const items = sourceItems(expression.source, scope, budget, 'filter', evaluateSequenceFn);
  const kept: unknown[] = [];

  for (const [index, item] of items.entries()) {
    const itemScope = childScope(scope, expression.as, item);
    const keep = prefixing(['where', index], () =>
      evaluatePredicateFn(expression.where, itemScope, { budget, caller: 'filter' }),
    );
    if (keep) {
      kept.push(item);
    }
  }
  return kept;
}

/**
 * Evaluates the count of items in a source expression.
 */
export function evaluateCount(
  source: Expression,
  scope: EvaluationScope,
  budget: EvaluationBudget,
  evaluateSequenceFn: (
    expr: Expression,
    scope: EvaluationScope,
    opts?: AttributedEvaluationOptions | undefined,
  ) => readonly unknown[],
): number {
  return sourceItems(source, scope, budget, 'count', evaluateSequenceFn).length;
}
