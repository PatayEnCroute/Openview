import type { ExpressionErrorSite } from '../../errors.js';
import { createBudget, type EvaluationBudget } from '../limits.js';
import type { Expression } from '../types.js';
import { kindOf, valueTypeOf } from '../value-type.js';
import {
  type AttributedEvaluationOptions,
  describe,
  type EvaluationOptions,
  evaluateWithin,
  fail,
} from './context.js';
import { isAbsent, requireBoolean } from './guards.js';
import { evaluateAggregate, evaluateCount, evaluateFilter } from './operations/aggregate.js';
import { evaluateArithmetic, evaluatePercentOf } from './operations/arithmetic.js';
import { evaluateCompare } from './operations/compare.js';
import { evaluateDateAdd, evaluateDateDiff, evaluateEndOfMonth } from './operations/dates.js';
import { evaluateIf, evaluateIsEmpty, evaluateLogical, evaluateNot } from './operations/logical.js';
import { evaluateRound } from './operations/round.js';
import { evaluateConcat, evaluateText, evaluateTextCase } from './operations/text.js';
import { type EvaluationScope, resolvePath } from './scope.js';

function evalWithin(
  expression: Expression,
  at: readonly (string | number)[],
  scope: EvaluationScope,
  budget: EvaluationBudget,
): unknown {
  return evaluateWithin(expression, at, scope, budget, evaluateExpression);
}

/**
 * Evaluates an expression to a raw value.
 *
 * Every node of the tree passes through here exactly once, which is why the two work
 * counters sit at the head: one step per node evaluated, and a depth that rises on the way
 * in and falls on the way out.
 */
export function evaluateExpression(
  expression: Expression,
  scope: EvaluationScope,
  options?: EvaluationOptions | undefined,
): unknown {
  const budget = options?.budget ?? createBudget();

  if (!budget.spend(1)) {
    return fail(
      {
        code: 'step-limit-exceeded',
        site: expression.kind,
        at: [],
        limit: budget.limits.maxSteps,
      },
      `This formula asked for more than ${budget.limits.maxSteps} operations. Reduce the number of nested aggregations: the cost is the product of the list lengths, so one level more multiplies it rather than adding to it.`,
    );
  }
  if (!budget.enter()) {
    // With the DEFAULT shape limit this bound does not fire on a tree that came through
    // `parseTemplate` -- the guard refuses first, by ONE node, and the exact margin is
    // worked out on `EvaluationLimits.maxDepth`. It is reachable as soon as a caller
    // raises that limit, because `parseTemplate(raw, undefined, { maxDepth: 256 })` is a
    // supported call: the two bounds share a default and have to be moved together.
    // It also exists because `evaluateExpression` is public and takes an `Expression`
    // from wherever: a tree built in a loop by an integrator overflows the stack around
    // 20 000 levels and raises a bare `RangeError`. Refusing that unwrapped error at
    // parse time and accepting it at render time would be incoherent.
    return fail(
      {
        code: 'depth-limit-exceeded',
        site: expression.kind,
        at: [],
        limit: budget.limits.maxDepth,
      },
      `This formula nests more than ${budget.limits.maxDepth} levels deep. Reduce the nesting, or raise maxDepth on the evaluation budget AND on parseTemplate's shape limits -- the two share a default, and the shape guard refuses first.`,
    );
  }

  try {
    switch (expression.kind) {
      case 'literal':
        return expression.value;
      case 'path':
        return resolvePath(expression.path, scope);
      case 'arithmetic':
        return evaluateArithmetic(
          expression.op,
          evalWithin(expression.left, ['left'], scope, budget),
          evalWithin(expression.right, ['right'], scope, budget),
          'arithmetic',
        );
      case 'percentOf':
        return evaluatePercentOf(
          evalWithin(expression.base, ['base'], scope, budget),
          evalWithin(expression.rate, ['rate'], scope, budget),
          'percentOf',
        );
      case 'round':
        return evaluateRound(
          evalWithin(expression.value, ['value'], scope, budget),
          expression.decimals,
          expression.mode,
        );
      case 'concat':
        return evaluateConcat(expression.parts, scope, budget, evalWithin);
      case 'text':
        return evaluateText(evalWithin(expression.value, ['value'], scope, budget), budget);
      case 'textCase':
        return evaluateTextCase(
          evalWithin(expression.text, ['text'], scope, budget),
          expression.op,
          budget,
        );
      case 'dateAdd':
        return evaluateDateAdd(
          evalWithin(expression.date, ['date'], scope, budget),
          evalWithin(expression.days, ['days'], scope, budget),
        );
      case 'dateDiff':
        return evaluateDateDiff(
          evalWithin(expression.from, ['from'], scope, budget),
          evalWithin(expression.to, ['to'], scope, budget),
        );
      case 'endOfMonth':
        return evaluateEndOfMonth(evalWithin(expression.date, ['date'], scope, budget));
      case 'aggregate':
        return evaluateAggregate(expression, scope, budget, evaluateExpression, evaluateSequence);
      case 'count':
        return evaluateCount(expression.source, scope, budget, evaluateSequence);
      case 'filter':
        return evaluateFilter(expression, scope, budget, evaluatePredicate, evaluateSequence);
      case 'if':
        return evaluateIf(
          evalWithin(expression.when, ['when'], scope, budget),
          expression.whenTrue,
          expression.whenFalse,
          scope,
          budget,
          evalWithin,
        );
      case 'compare':
        return evaluateCompare(
          expression.op,
          evalWithin(expression.left, ['left'], scope, budget),
          evalWithin(expression.right, ['right'], scope, budget),
          'compare',
        );
      case 'logical':
        return evaluateLogical(expression.op, expression.operands, scope, budget, evalWithin);
      case 'not':
        return evaluateNot(evalWithin(expression.operand, ['operand'], scope, budget));
      case 'isEmpty':
        return evaluateIsEmpty(evalWithin(expression.operand, ['operand'], scope, budget));
      default: {
        const exhaustive: never = expression;
        // `kindOf` rather than `JSON.stringify`: stringifying overflows the stack around
        // 8 000 levels, so the exhaustiveness guard would crash while describing the
        // payload that reached it.
        throw new TypeError(`Unhandled expression: ${kindOf(exhaustive, 'kind')}`);
      }
    }
  } finally {
    budget.leave();
  }
}

/**
 * Evaluates a condition.
 *
 * See `requireBoolean` for the truthiness policy this enforces. `caller` names
 * the position for the error payload, and defaults to `'condition'`: a top-level
 * predicate call is a `ConditionNode.when`.
 */
export function evaluatePredicate(
  expression: Expression,
  scope: EvaluationScope,
  options?: AttributedEvaluationOptions | undefined,
): boolean {
  return requireBoolean(
    evaluateExpression(expression, scope, options),
    options?.caller ?? 'condition',
    [],
  );
}

/**
 * How a message names the operator that asked for a list.
 *
 * `evaluateSequence` is not reusable "as is", and this table is why: its message was
 * hard-coded to `A loop needs a list to iterate over`. Wired to the list-reducing
 * expression kinds ADR 0003 adds, it would say **loop** to whoever wrote a sum -- a
 * direct C8 miss, in the lot C8 depends on. The article belongs to each entry because
 * `A loop` and `An aggregation` do not share one.
 *
 * Deliberately partial, and it grows with the algebra: each kind adds its own wording
 * in the increment that adds the kind, because a wording for a kind that does not exist
 * yet does not type-check. Anything unlisted gets a neutral subject rather than a wrong
 * one.
 */
const LIST_CALLER_SUBJECTS: Readonly<Partial<Record<ExpressionErrorSite, string>>> = {
  loop: 'A loop',
  aggregate: 'An aggregation',
  count: 'A count',
  filter: 'A filter',
};

/**
 * Evaluates a list source, for a loop node or for one of the three expression kinds
 * that reduce a list.
 *
 * Missing data yields no iterations rather than throwing: a loop over a section
 * the caller did not supply should render nothing, not abort the document. A
 * value that is present but not a list is a genuine template/data mismatch and
 * does throw.
 */
export function evaluateSequence(
  expression: Expression,
  scope: EvaluationScope,
  options?: AttributedEvaluationOptions | undefined,
): readonly unknown[] {
  // Resolved here rather than left to `evaluateExpression`: the element count below needs
  // the same budget the descent spent from, and a budget created deeper down would be
  // invisible to it.
  const budget = options?.budget ?? createBudget();
  const value = evaluateExpression(expression, scope, { budget });
  if (isAbsent(value)) {
    return [];
  }
  const site = options?.caller ?? 'loop';
  if (!Array.isArray(value)) {
    return fail(
      { code: 'not-a-list', site, at: [], actualType: valueTypeOf(value) },
      `${LIST_CALLER_SUBJECTS[site] ?? 'An expression'} needs a list to iterate over, got ${describe(valueTypeOf(value))}.`,
    );
  }

  // The one place elements are counted, rather than one site per list-reducing operator:
  // every list in a document -- a loop's and an aggregation's alike -- comes through here,
  // so the cumulated count is what detects the O(n^k) blow-up. A nested aggregation calls
  // this once per element of the enclosing one, which is exactly the multiplication the
  // bound is looking for.
  if (!budget.visit(value.length)) {
    return fail(
      {
        code: 'item-limit-exceeded',
        site,
        at: [],
        limit: budget.limits.maxItemsVisited,
      },
      `This render traversed more than ${budget.limits.maxItemsVisited} list elements. Nested aggregations multiply the lists they walk, so removing one level of nesting usually costs far more than shortening a list.`,
    );
  }
  return value;
}
