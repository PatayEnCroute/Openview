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
 * A reduction over a list.
 *
 * ## Where the aggregate policy differs from the scalar one, and why that is deliberate
 *
 * An element whose value is ABSENT is **ignored**, and `avg` divides by the number of
 * values PRESENT. In a scalar operation the author named two operands, so one missing says
 * the premise does not hold; in an aggregation they named ONE expression applied to N
 * elements -- dropping the total of 60 lines because one line has no discount would be the
 * maximum of surprise.
 *
 * `avg` does NOT avoid the division by zero by construction, which an earlier version of
 * this design claimed. That is only true of the *empty* list: 60 lines of which none
 * carries a discount give zero present values, hence 0/0. The exact rule is **absence as
 * soon as the number of present values is nil**, whatever the list's length.
 *
 * The accumulation order is part of the contract: positional, never reordered. Binary64
 * addition is not associative, so "the same bit on two machines" holds for a sum only if
 * nothing reorders -- a property pinned by a test, not an implementation detail.
 *
 * `min`/`max` fold rather than spread: `Math.min(...values)` overflows the stack on 60 000
 * elements, which is a realistic invoice and not a stress test.
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

  // Hoisted out of the loop. Left inside, the operator test ran per element and the ternary
  // made `sum` fall through to the max branch -- 60 000 pointless comparisons on the
  // 60 000-line aggregate, and a reader left to wonder what `extremum` means for a sum.
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
    // The additive identity, so an empty list sums to 0 -- an empty list is not a fault.
    // The result is still checked: 60 000 lines at 1e307 must not print Infinity.
    return requireFiniteResult(total, 'aggregate', []);
  }
  if (expression.op === 'avg') {
    return present === 0 ? undefined : requireFiniteResult(total / present, 'aggregate', []);
  }
  // min and max have no identity element, so no present value means no result.
  return extremum;
}

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
    // Through `evaluatePredicate`, so there is no truthiness in a filter either: a
    // `where` of `{ path: 'line.total' }` must not silently drop the zero lines.
    const keep = prefixing(['where', index], () =>
      evaluatePredicateFn(expression.where, itemScope, { budget, caller: 'filter' }),
    );
    if (keep) {
      kept.push(item);
    }
  }
  return kept;
}

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
