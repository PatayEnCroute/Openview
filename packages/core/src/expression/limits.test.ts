import { describe, expect, it } from 'vitest';
import { InvalidEvaluationLimitsError } from '../errors.js';
import { createBudget, DEFAULT_EVALUATION_LIMITS, resolveEvaluationLimits } from './limits.js';

describe('createBudget', () => {
  it('counts steps against the ceiling and then keeps refusing', () => {
    const budget = createBudget({ maxSteps: 3 });

    expect(budget.spend(1)).toBe(true);
    expect(budget.spend(2)).toBe(true);
    expect(budget.spend(1)).toBe(false);
    expect(budget.spent.steps).toBe(4);
  });

  it('refuses a descent BEFORE incrementing, so no leave() is owed', () => {
    // Keeps `spent.depth` honest: a refusal must not report a descent that did not happen,
    // and the caller must not have to pair a `leave()` with a refused `enter()`.
    const budget = createBudget({ maxDepth: 2 });

    expect(budget.enter()).toBe(true);
    expect(budget.enter()).toBe(true);
    expect(budget.enter()).toBe(false);
    expect(budget.spent.depth).toBe(2);

    budget.leave();
    expect(budget.enter()).toBe(true);
  });

  it('cumulates visited elements rather than measuring one list', () => {
    // What catches the O(n^k) blow-up: a nested aggregation walks the inner list once per
    // element of the outer one, and it is the running total that notices.
    const budget = createBudget({ maxItemsVisited: 10 });

    expect(budget.visit(6)).toBe(true);
    expect(budget.visit(4)).toBe(true);
    expect(budget.visit(1)).toBe(false);
    expect(budget.spent.itemsVisited).toBe(11);
  });

  it('measures a string against the ceiling without accumulating', () => {
    // Unlike the others: two 1 kB strings are not a 2 kB string, and the bound is about
    // one value's size, not the total text a render produces.
    const budget = createBudget({ maxStringLength: 8 });

    expect(budget.acceptString(8)).toBe(true);
    expect(budget.acceptString(8)).toBe(true);
    expect(budget.acceptString(9)).toBe(false);
  });

  it('never raises, so fail() stays the one site that does', () => {
    // A budget receives neither a `site` nor an `at`, the two fields every branch of
    // ExpressionErrorDetails requires: it has nothing to build an error from. Raising a
    // different class would slip past the descent wrapper, which catches by instanceof and
    // would never prefix the path.
    const budget = createBudget({ maxSteps: 1, maxDepth: 1, maxItemsVisited: 1 });

    expect(() => {
      budget.spend(99);
      budget.enter();
      budget.enter();
      budget.visit(99);
      budget.acceptString(Number.MAX_SAFE_INTEGER);
    }).not.toThrow();
  });

  it('exposes its limits so a failure can report a configured number', () => {
    // `details.limit` must come from configuration and never from the data, which is what
    // makes an error payload safe to log.
    expect(createBudget({ maxSteps: 42 }).limits.maxSteps).toBe(42);
    expect(createBudget().limits).toStrictEqual(DEFAULT_EVALUATION_LIMITS);
  });
});

describe('resolveEvaluationLimits', () => {
  it('takes the default for an omitted field', () => {
    expect(resolveEvaluationLimits({ maxSteps: 7 })).toStrictEqual({
      ...DEFAULT_EVALUATION_LIMITS,
      maxSteps: 7,
    });
    expect(resolveEvaluationLimits()).toStrictEqual(DEFAULT_EVALUATION_LIMITS);
  });

  it.each([
    [{ maxSteps: 0 }],
    [{ maxSteps: -1 }],
    [{ maxDepth: Number.NaN }],
    [{ maxItemsVisited: Number.POSITIVE_INFINITY }],
    [{ maxStringLength: 1.5 }],
    [{ maxSteps: 2_000_000_000 }],
  ])('refuses the unusable limits %o loudly', (limits) => {
    // Never a silent fallback, because that is how a caller turns the protection off by
    // accident: `{ maxSteps: 0 }` replaced by the default would look like it worked.
    expect(() => resolveEvaluationLimits(limits)).toThrow(InvalidEvaluationLimitsError);
  });

  it('defaults are active, not opt-in', () => {
    // A library whose safety has to be asked for is not a safe library.
    expect(DEFAULT_EVALUATION_LIMITS.maxSteps).toBeGreaterThan(0);
    expect(DEFAULT_EVALUATION_LIMITS.maxDepth).toBeGreaterThan(0);
    expect(DEFAULT_EVALUATION_LIMITS.maxItemsVisited).toBeGreaterThan(0);
    expect(DEFAULT_EVALUATION_LIMITS.maxStringLength).toBeGreaterThan(0);
  });
});
