import {
  type ExpressionErrorDetails,
  type ExpressionErrorSite,
  ExpressionEvaluationError,
  prefixPath,
} from '../../errors.js';
import type { EvaluationBudget } from '../limits.js';
import type { Expression } from '../types.js';
import type { ExpressionValueType } from '../value-type.js';
import type { EvaluationScope } from './scope.js';

export interface EvaluationOptions {
  /** Optional evaluation budget shared across the render operation. */
  readonly budget?: EvaluationBudget | undefined;
}

export interface AttributedEvaluationOptions extends EvaluationOptions {
  /** Evaluation site reported on error (defaults to 'condition' or 'loop'). */
  readonly caller?: ExpressionErrorSite | undefined;
}

const VALUE_DESCRIPTIONS: Readonly<Record<ExpressionValueType, string>> = {
  absent: 'nothing',
  string: 'a string',
  number: 'a number',
  'not-finite': 'a number that is not finite',
  boolean: 'a boolean',
  list: 'a list',
  object: 'an object',
  function: 'a function',
  unsupported: 'an unsupported value',
};

/**
 * Returns a human-readable English noun phrase describing a value type.
 */
export function describe(type: ExpressionValueType): string {
  return VALUE_DESCRIPTIONS[type];
}

/**
 * Throws a typed ExpressionEvaluationError with structured details.
 */
export function fail(details: ExpressionErrorDetails, message: string): never {
  throw new ExpressionEvaluationError(message, details);
}

/**
 * Executes a descent thunk, prefixing any caught ExpressionEvaluationError with the given path segments.
 */
export function prefixing<TResult>(
  at: readonly (string | number)[],
  descend: () => TResult,
): TResult {
  try {
    return descend();
  } catch (error) {
    if (error instanceof ExpressionEvaluationError) {
      for (const segment of [...at].reverse()) {
        error[prefixPath](segment);
      }
    }
    throw error;
  }
}

/**
 * Evaluates a sub-expression at a given path segment while maintaining error attribution and budget.
 */
export function evaluateWithin(
  expression: Expression,
  at: readonly (string | number)[],
  scope: EvaluationScope,
  budget: EvaluationBudget,
  evaluateFn: (
    expr: Expression,
    scope: EvaluationScope,
    opts?: EvaluationOptions | undefined,
  ) => unknown,
): unknown {
  return prefixing(at, () => evaluateFn(expression, scope, { budget }));
}
