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

/**
 * Options every entry point accepts.
 *
 * An options bag rather than a third positional parameter, because two of the three entry
 * points need a second thing and three functions whose third parameter has three
 * different shapes is the asymmetry a caller fills in wrong. Every field is optional, so
 * existing two-argument calls keep compiling.
 */
export interface EvaluationOptions {
  /**
   * The work budget for the WHOLE render, created once by the pipeline and shared by
   * every expression in the document (ADR 0003, decision 8).
   *
   * Optional, and the residual risk is named rather than hidden: a caller who omits it
   * falls back to a per-call budget, so a document with 500 bindings gets 500 separate
   * allowances. Two counterweights -- a budget-REQUIRED helper on the engine side, and a
   * test pinning that two top-level calls sharing one budget do accumulate.
   */
  readonly budget?: EvaluationBudget | undefined;
}

/**
 * Options for the two entry points that something else calls on an expression's behalf.
 *
 * Separate from {@link EvaluationOptions} so `caller` cannot be passed to
 * `evaluateExpression`, where it would be silently ignored: an expression already knows
 * its own kind.
 */
export interface AttributedEvaluationOptions extends EvaluationOptions {
  /**
   * The site to report when this call itself fails, for the positions that carry an
   * expression without being one. Defaults to `'condition'` for a predicate and `'loop'`
   * for a sequence -- the node positions those entry points were written for.
   */
  readonly caller?: ExpressionErrorSite | undefined;
}

/**
 * Prose for a value's tag, and it takes the TAG rather than the value on purpose:
 * that is what makes "no message ever contains render data" a property of the type
 * instead of a rule a reviewer has to remember (ADR 0003, decision 7).
 *
 * A total `Record` rather than a `switch`: TypeScript then refuses a missing tag, and
 * there is no branch to cover for a mapping that has no logic.
 *
 * Two wordings changed with ADR 0003, both deliberate and neither asserted by a test:
 * a list is `a list` and no longer `an array`, and `NaN` stops being described as
 * `a number`.
 */
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

export function describe(type: ExpressionValueType): string {
  return VALUE_DESCRIPTIONS[type];
}

/**
 * The one place this module raises an {@link ExpressionEvaluationError}.
 *
 * Everything that could throw funnels through here, and that is a structural claim
 * rather than a tidiness one: the machine payload has two required fields, `site` and
 * `at`, that only the evaluator knows. A helper that raised on its own -- a budget
 * counter, say -- would either invent them or throw a different error class, which the
 * descent wrapper below rethrows without ever prefixing its path. So counters return a
 * boolean and their caller comes here.
 */
export function fail(details: ExpressionErrorDetails, message: string): never {
  throw new ExpressionEvaluationError(message, details);
}

/**
 * Prefixes the path of a propagating failure with the position that was descended
 * into, and rethrows the same object.
 *
 * Wrapping only the "binding" forms was considered and rejected: it leaves
 * `add(mul(a, b), c)` ambiguous, because both multiplications sit at the same reported
 * position.
 */
export function prefixing<TResult>(
  at: readonly (string | number)[],
  descend: () => TResult,
): TResult {
  try {
    return descend();
  } catch (error) {
    if (error instanceof ExpressionEvaluationError) {
      // Innermost segment first, so the accumulated path stays reversed: `at` is
      // read back-to-front for that reason, through a copy rather than an index,
      // which `noUncheckedIndexedAccess` would type as possibly undefined.
      for (const segment of [...at].reverse()) {
        error[prefixPath](segment);
      }
    }
    // Enriching a typed error and rethrowing it is not swallowing it (AGENTS.md 1.3):
    // nothing is caught and dropped, and the original object reaches the caller.
    throw error;
  }
}

/**
 * The single point every descent into a sub-expression goes through: it names the
 * position for the error path, and threads the shared budget down.
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
