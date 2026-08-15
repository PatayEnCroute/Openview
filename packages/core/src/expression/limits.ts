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
   * Same name and same value as the shape guard's `maxDepth`, and NOT quite the same unit:
   * the guard counts JSON levels, this counts expression descents.
   *
   * ## The true relationship, because an earlier version of this comment doubled it
   *
   * That earlier version claimed "an expression node weighs at least two JSON levels (the
   * object, then the field carrying its operand)", concluded a template passing the guard
   * at 64 descends at most ~32 times, and therefore that this bound "cannot fire on a tree
   * that came through `parseTemplate`". **The premise is false for every single-operand
   * kind** -- `not`, `isEmpty`, `text`, `textCase`, `endOfMonth`, `count`, `round` -- whose
   * operand object sits at exactly `parentDepth + 1`. Measured: the guard accepts a bare 63-node
   * `not` chain and refuses at 64, while `enter()` refuses the 65th descent. **One JSON
   * level per single-operand node, so the margin is ONE NODE, not a factor of two.**
   *
   * And the conclusion does not hold either, because the shape limit is a parameter:
   * `parseTemplate(raw, undefined, { maxDepth: 256 })` is a supported call, and under it a
   * 70-node `not` chain in a `ConditionNode.when` parses cleanly and then fails at render
   * with `depth-limit-exceeded`. So the honest statement is narrower: **with the DEFAULT
   * shape limit the guard refuses first, by one node; raise the shape limit and this bound
   * becomes reachable from a parsed template.** Anyone tuning one number has to move the
   * other.
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
 * `int().min(1)` rejects `NaN`, the infinities, `0`, negatives and fractions in one
 * expression; the hard cap bounds the top, so a caller cannot pass `Number.MAX_VALUE` and
 * call the result a bound.
 *
 * Exported because the shape guard needs the SAME ceiling and the same field shape. Two
 * copies of one bound drift: raising it in one file would leave the other refusing values
 * the first accepts.
 */
export const LIMIT_HARD_CEILING = 1_000_000_000;

export const limitSchema = z.number().int().min(1).max(LIMIT_HARD_CEILING);

const evaluationLimitsSchema = z.object({
  maxSteps: limitSchema,
  maxDepth: limitSchema,
  maxItemsVisited: limitSchema,
  maxStringLength: limitSchema,
});

/**
 * Active by default, never opt-in: *a library whose safety has to be asked for is not a
 * safe library.*
 *
 * Parsed through the same schema an override goes through, AT MODULE LOAD, so the "loud
 * refusal, never a silent fallback" property covers the defaults themselves: a typo turning
 * one of these into `0` or `NaN` would otherwise be accepted in silence, since
 * `resolveLimits` hands an omitted-overrides call straight back without validating.
 *
 * `maxDepth` matches the shape guard's value -- see {@link EvaluationLimits.maxDepth} for
 * what the identical number does and does not buy.
 */
export const DEFAULT_EVALUATION_LIMITS: EvaluationLimits = evaluationLimitsSchema.parse({
  maxSteps: 1_000_000,
  maxDepth: 64,
  maxItemsVisited: 1_000_000,
  maxStringLength: 1_048_576,
});

/**
 * Merges overrides onto defaults and validates the result, or raises.
 *
 * Shared with the shape guard, which had an identical body: an ABSENT field takes the
 * default; a field that is PRESENT and unusable raises. Never a silent fallback -- that is
 * how a caller disables the protection by accident.
 *
 * The DEFAULTS are validated too, at module load, by the caller passing them through the
 * same schema. Without that, a typo turning a default into `0` or `NaN` would be accepted
 * in silence -- the exact accidental disabling the typed errors exist to prevent for
 * caller input -- because this function hands an omitted-overrides call straight back.
 */
export function resolveLimits<TLimits extends object>(
  defaults: TLimits,
  schema: z.ZodType<TLimits>,
  overrides: Partial<TLimits> | undefined,
  makeError: (cause: unknown) => Error,
): TLimits {
  if (overrides === undefined) {
    return defaults;
  }
  const parsed = schema.safeParse({ ...defaults, ...overrides });
  if (!parsed.success) {
    throw makeError(parsed.error);
  }
  return parsed.data;
}

export function resolveEvaluationLimits(limits?: Partial<EvaluationLimits>): EvaluationLimits {
  return resolveLimits(
    DEFAULT_EVALUATION_LIMITS,
    evaluationLimitsSchema,
    limits,
    (cause) =>
      new InvalidEvaluationLimitsError(
        'An evaluation limit must be a whole number between 1 and 1 000 000 000. Omit a field to take its default; a present but unusable value is refused rather than replaced, because a silent fallback is how a caller turns the protection off by accident.',
        { cause },
      ),
  );
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
