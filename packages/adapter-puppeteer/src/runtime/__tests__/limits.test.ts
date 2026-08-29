import { describe, expect, it } from 'vitest';
import { InvalidProtectedConfigurationError } from '../../resource/errors.js';
import { DEFAULT_RUNTIME_LIMITS, RUNTIME_HARD_CEILINGS, resolveRuntimeLimits } from '../limits.js';

const refusalOf = (overrides: Record<string, unknown>): InvalidProtectedConfigurationError => {
  try {
    resolveRuntimeLimits(overrides);
  } catch (error) {
    if (error instanceof InvalidProtectedConfigurationError) {
      return error;
    }
    throw error;
  }
  throw new Error('the limits were accepted');
};

describe('the bounds a hardened runtime lives under', () => {
  it('are active without the caller naming any of them', () => {
    expect(resolveRuntimeLimits()).toStrictEqual(DEFAULT_RUNTIME_LIMITS);
  });

  it('default to one slot, chosen without reading the machine', () => {
    /* A capacity derived from `availableParallelism()` would make one document behave differently
       on two hosts, which is the environment read this engine refuses everywhere else. */
    expect(DEFAULT_RUNTIME_LIMITS.slots).toBe(1);
  });

  it('keep the default of every field the caller left out', () => {
    expect(resolveRuntimeLimits({ slots: 3 })).toStrictEqual({
      ...DEFAULT_RUNTIME_LIMITS,
      slots: 3,
    });
  });

  it('read an explicit `undefined` as an omission', () => {
    expect(resolveRuntimeLimits({ slots: undefined })).toStrictEqual(DEFAULT_RUNTIME_LIMITS);
  });

  it('accept each hard ceiling exactly and refuse one past it', () => {
    /* Every bound, not one of them: a ceiling nobody exercises is a ceiling that can be mistyped
       in the schema and never noticed. */
    const ceilings = Object.entries(RUNTIME_HARD_CEILINGS);
    expect(ceilings.length).toBeGreaterThan(1);
    for (const [name, ceiling] of ceilings) {
      expect(resolveRuntimeLimits({ [name]: ceiling })).toHaveProperty(name, ceiling);
      expect(refusalOf({ [name]: ceiling + 1 })).toBeInstanceOf(InvalidProtectedConfigurationError);
    }
  });

  it('refuse zero slots, a fraction, a NaN and an infinity', () => {
    for (const value of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(refusalOf({ slots: value })).toBeInstanceOf(InvalidProtectedConfigurationError);
    }
  });

  it('refuse a key they do not know rather than dropping it in silence', () => {
    /* A misspelt bound would otherwise leave the caller believing it had configured one. */
    expect(refusalOf({ maxConcurrency: 4 }).cause).toBeDefined();
  });

  it('keep a deadline well above the warm target one render aims at', () => {
    /* Thirty seconds against a two-second target: a ratio that leaves a slow host room without
       turning the deadline into the thing a document has to beat. */
    expect(DEFAULT_RUNTIME_LIMITS.renderTimeoutMs / 2_000).toBeGreaterThanOrEqual(15);
  });
});
