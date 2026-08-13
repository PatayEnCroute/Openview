import { z } from 'zod/v4';
import { InvalidEvaluationLimitsError } from '../errors.js';

/**
 * What bounds the work one render may ask of the evaluator (ADR 0003, decision 8).
 *
 * ## Why this exists in core rather than in the engine
 *
 * Measured, not supposed. Nested aggregations do not cost O(n x m) but **O(n^k)**, where
 * *k* is chosen by the template author: on 200 invoice lines, one nesting level is 202
 * steps and 1.3 ms; three levels are 8 080 402 steps and 17.5 s; four are about 58
 * minutes; six run for centuries. No field, no length and no depth is abnormal -- it is
 * the PRODUCT OF CARDINALITIES that explodes, and nothing in the contract looks at that.
 * The formula fits in 327 bytes.
 *
 * And `evaluateExpression` is synchronous and never yields: no `await`, no generator, no
 * `AbortSignal`. A loop that never returns to the event loop cannot be interrupted by a
 * timer, so "the engine will bound the time" is unkeepable short of killing a worker.
 * Leaving the bound to the engine would silently impose a worker-per-render architecture
 * on a lot that is a condition of milestone J5.
 *
 * ## Two types, and the distinction is the point
 *
 * A configuration carries ceilings; it does not say WHERE the counters live. A counter
 * local to `evaluateExpression` resets on every top-level call, so a document with 500
 * bindings would get 500 x 1 000 000 steps and the bound would be decorative. Hence
 * {@link EvaluationLimits} (validated, immutable) and {@link EvaluationBudget} (mutable
 * counters, created once per render and shared by everything in it).
 */
export interface EvaluationLimits {
  /** Expression nodes evaluated, cumulated across the whole render. */
  readonly maxSteps: number;
  /**
   * Nested descents.
   *
   * Same name and same value as the shape guard's `maxDepth`, and NOT the same unit: the
   * guard counts JSON levels, this counts expression descents, and an expression node
   * weighs at least two JSON levels (the object, then the field carrying its operand). A
   * template that passes the guard at 64 JSON levels therefore descends at most ~32
   * times, so this bound **cannot fire on a tree that came through `parseTemplate`** --
   * which is deliberate. It exists for trees built by hand, which pass no guard at all.
   * The two values are equal so nobody has to decide which is the lower; the difference
   * in unit is what provides the margin.
   */
  readonly maxDepth: number;
  /** List elements traversed, CUMULATED -- this is what catches the O(n^k) blow-up. */
  readonly maxItemsVisited: number;
  /** Length of a string an operator may produce. See {@link EvaluationBudget.acceptString}. */
  readonly maxStringLength: number;
}

/**
 * Mutable counters, created once per render and threaded through everything.
 *
 * **No method here raises.** A budget receives neither a `site` nor an `at` -- the two
 * fields every branch of `ExpressionErrorDetails` requires -- so it has literally nothing
 * to build an error from. It would therefore either invent the fields or throw a
 * different class, which the evaluator's descent wrapper rethrows without ever prefixing
 * its path. `fail()` stays the one site that raises.
 *
 * The obvious risk of a boolean return -- a caller who forgets to test it -- is handled
 * structurally rather than by vigilance: `spend` and `enter` have exactly ONE call site,
 * the single point every descent passes through; `visit` has one, the shared list
 * primitive; and `acceptString` has one per text-producing operator. Every one of them is
 * covered by a bound test.
 */
export interface EvaluationBudget {
  /** `false` once the step ceiling is passed -> `step-limit-exceeded`. */
  spend(steps: number): boolean;
  /** `false` instead of descending when the depth ceiling is reached -> `depth-limit-exceeded`. */
  enter(): boolean;
  /** Paired with {@link EvaluationBudget.enter}, and only called when it returned `true`. */
  leave(): void;
  /** `false` once the traversal ceiling is passed -> `item-limit-exceeded`. */
  visit(items: number): boolean;
  /** `false` for a string longer than the ceiling -> `string-limit-exceeded`. */
  acceptString(length: number): boolean;
  readonly spent: {
    readonly steps: number;
    readonly itemsVisited: number;
    readonly depth: number;
  };
  /** Read-only, so `fail()` can fill `details.limit` from configuration and never from data. */
  readonly limits: EvaluationLimits;
}

/**
 * Active by default, never opt-in: *a library whose safety has to be asked for is not a
 * safe library.*
 *
 * `maxDepth` matches the shape guard's value -- see {@link EvaluationLimits.maxDepth} for
 * why the identical number is not a duplication.
 */
export const DEFAULT_EVALUATION_LIMITS: EvaluationLimits = {
  maxSteps: 1_000_000,
  maxDepth: 64,
  maxItemsVisited: 1_000_000,
  maxStringLength: 1_048_576,
};

/**
 * `int().min(1)` rejects `NaN`, the infinities, `0`, negatives and fractions in one
 * expression; the hard cap bounds the top, so a caller cannot pass `Number.MAX_VALUE` and
 * call the result a bound.
 */
const HARD_CEILING = 1_000_000_000;

const limitSchema = z.number().int().min(1).max(HARD_CEILING);

const evaluationLimitsSchema = z.object({
  maxSteps: limitSchema,
  maxDepth: limitSchema,
  maxItemsVisited: limitSchema,
  maxStringLength: limitSchema,
});

/**
 * An ABSENT field takes the default; a field that is PRESENT and unusable raises. Never a
 * silent fallback -- that is how a caller disables the protection by accident.
 */
export function resolveEvaluationLimits(limits?: Partial<EvaluationLimits>): EvaluationLimits {
  if (limits === undefined) {
    return DEFAULT_EVALUATION_LIMITS;
  }
  const parsed = evaluationLimitsSchema.safeParse({ ...DEFAULT_EVALUATION_LIMITS, ...limits });
  if (!parsed.success) {
    throw new InvalidEvaluationLimitsError(
      'An evaluation limit must be a whole number between 1 and 1 000 000 000. Omit a field to take its default; a present but unusable value is refused rather than replaced, because a silent fallback is how a caller turns the protection off by accident.',
      { cause: parsed.error },
    );
  }
  return parsed.data;
}

export function createBudget(limits?: Partial<EvaluationLimits>): EvaluationBudget {
  const resolved = resolveEvaluationLimits(limits);
  let steps = 0;
  let itemsVisited = 0;
  let depth = 0;

  return {
    limits: resolved,
    get spent() {
      return { steps, itemsVisited, depth };
    },
    spend(count: number): boolean {
      steps += count;
      return steps <= resolved.maxSteps;
    },
    enter(): boolean {
      // Refuses BEFORE incrementing, so a refusal needs no matching `leave()` and
      // `spent.depth` never reports a descent that did not happen.
      if (depth >= resolved.maxDepth) {
        return false;
      }
      depth += 1;
      return true;
    },
    leave(): void {
      depth -= 1;
    },
    visit(items: number): boolean {
      itemsVisited += items;
      return itemsVisited <= resolved.maxItemsVisited;
    },
    acceptString(length: number): boolean {
      return length <= resolved.maxStringLength;
    },
  };
}
