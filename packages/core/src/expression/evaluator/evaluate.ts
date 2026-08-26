import type { ExpressionErrorSite } from '../../errors.js';
import { createBudget, type EvaluationBudget } from '../limits.js';
import type { Expression } from '../types.js';
import { valueTypeOf } from '../value-type.js';
import { type ExpressionVisitor, visitExpression } from '../visitor.js';
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

/** What every evaluation branch needs: the data in scope, and the shared budget. */
interface EvaluationContext {
  readonly scope: EvaluationScope;
  readonly budget: EvaluationBudget;
}

const EVALUATION_VISITOR: ExpressionVisitor<unknown, EvaluationContext> = {
  literal: (expression) => expression.value,
  path: (expression, { scope }) => resolvePath(expression.path, scope),
  arithmetic: (expression, { scope, budget }) =>
    evaluateArithmetic(
      expression.op,
      evalWithin(expression.left, ['left'], scope, budget),
      evalWithin(expression.right, ['right'], scope, budget),
      'arithmetic',
    ),
  percentOf: (expression, { scope, budget }) =>
    evaluatePercentOf(
      evalWithin(expression.base, ['base'], scope, budget),
      evalWithin(expression.rate, ['rate'], scope, budget),
      'percentOf',
    ),
  round: (expression, { scope, budget }) =>
    evaluateRound(
      evalWithin(expression.value, ['value'], scope, budget),
      expression.decimals,
      expression.mode,
    ),
  concat: (expression, { scope, budget }) =>
    evaluateConcat(expression.parts, scope, budget, evalWithin),
  text: (expression, { scope, budget }) =>
    evaluateText(evalWithin(expression.value, ['value'], scope, budget), budget),
  textCase: (expression, { scope, budget }) =>
    evaluateTextCase(evalWithin(expression.text, ['text'], scope, budget), expression.op, budget),
  dateAdd: (expression, { scope, budget }) =>
    evaluateDateAdd(
      evalWithin(expression.date, ['date'], scope, budget),
      evalWithin(expression.days, ['days'], scope, budget),
    ),
  dateDiff: (expression, { scope, budget }) =>
    evaluateDateDiff(
      evalWithin(expression.from, ['from'], scope, budget),
      evalWithin(expression.to, ['to'], scope, budget),
    ),
  endOfMonth: (expression, { scope, budget }) =>
    evaluateEndOfMonth(evalWithin(expression.date, ['date'], scope, budget)),
  aggregate: (expression, { scope, budget }) =>
    evaluateAggregate(expression, scope, budget, evaluateExpression, evaluateSequence),
  count: (expression, { scope, budget }) =>
    evaluateCount(expression.source, scope, budget, evaluateSequence),
  filter: (expression, { scope, budget }) =>
    evaluateFilter(expression, scope, budget, evaluatePredicate, evaluateSequence),
  if: (expression, { scope, budget }) =>
    evaluateIf(
      evalWithin(expression.when, ['when'], scope, budget),
      expression.whenTrue,
      expression.whenFalse,
      scope,
      budget,
      evalWithin,
    ),
  compare: (expression, { scope, budget }) =>
    evaluateCompare(
      expression.op,
      evalWithin(expression.left, ['left'], scope, budget),
      evalWithin(expression.right, ['right'], scope, budget),
      'compare',
    ),
  logical: (expression, { scope, budget }) =>
    evaluateLogical(expression.op, expression.operands, scope, budget, evalWithin),
  not: (expression, { scope, budget }) =>
    evaluateNot(evalWithin(expression.operand, ['operand'], scope, budget)),
  isEmpty: (expression, { scope, budget }) =>
    evaluateIsEmpty(evalWithin(expression.operand, ['operand'], scope, budget)),
};

/**
 * Evaluates an algebraic expression against an evaluation scope and budget.
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
    return visitExpression(expression, EVALUATION_VISITOR, { scope, budget });
  } finally {
    budget.leave();
  }
}

/**
 * Evaluates a predicate expression, ensuring the result is boolean.
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
 * The subject of the "needs a list" refusal. A loop and a table body share one word because both
 * are blocks an author sees on the page; `site` is what still tells them apart.
 */
const LIST_CALLER_SUBJECTS: Readonly<Partial<Record<ExpressionErrorSite, string>>> = {
  loop: 'This block',
  tableRowGroup: 'This block',
  aggregate: 'An aggregation',
  count: 'A count',
  filter: 'A filter',
};

/**
 * Evaluates a sequence expression for loops and list aggregations.
 */
export function evaluateSequence(
  expression: Expression,
  scope: EvaluationScope,
  options?: AttributedEvaluationOptions | undefined,
): readonly unknown[] {
  const budget = options?.budget ?? createBudget();
  const value = evaluateExpression(expression, scope, { budget });
  if (isAbsent(value)) {
    return [];
  }
  const site = options?.caller ?? 'loop';
  if (!Array.isArray(value)) {
    return fail(
      { code: 'not-a-list', site, at: [], actualType: valueTypeOf(value) },
      `${LIST_CALLER_SUBJECTS[site] ?? 'An expression'} needs a list to repeat, but the selected value is ${describe(valueTypeOf(value))}.`,
    );
  }

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
