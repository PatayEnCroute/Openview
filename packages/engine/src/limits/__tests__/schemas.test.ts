import { describe, expect, it } from 'vitest';
import { InvalidRenderSafetyLimitsError } from '../../errors.js';
import { resolveRenderSafetyLimits } from '../schemas.js';
import { DEFAULT_RENDER_SAFETY_LIMITS, MIB, RENDER_SAFETY_HARD_CEILINGS } from '../types.js';

const refusalOf = (overrides: Record<string, unknown>): InvalidRenderSafetyLimitsError => {
  try {
    resolveRenderSafetyLimits(overrides);
  } catch (error) {
    if (error instanceof InvalidRenderSafetyLimitsError) {
      return error;
    }
    throw error;
  }
  throw new Error('the limits were accepted');
};

describe('the ceilings a render is configured with', () => {
  it('are active by default, without the caller naming any of them', () => {
    expect(resolveRenderSafetyLimits()).toStrictEqual({
      maxMaterializedUnits: 250_000,
      maxPages: 100,
      maxHtmlBytes: 32 * MIB,
    });
  });

  it('keeps the default of every field the caller left out', () => {
    expect(resolveRenderSafetyLimits({ maxPages: 12 })).toStrictEqual({
      ...DEFAULT_RENDER_SAFETY_LIMITS,
      maxPages: 12,
    });
  });

  it('reads an explicit `undefined` as an omission rather than as a value', () => {
    expect(resolveRenderSafetyLimits({ maxPages: undefined })).toStrictEqual(
      DEFAULT_RENDER_SAFETY_LIMITS,
    );
  });

  it('accepts each hard ceiling exactly, and refuses one past it', () => {
    expect(
      resolveRenderSafetyLimits({ maxPages: RENDER_SAFETY_HARD_CEILINGS.maxPages }).maxPages,
    ).toBe(RENDER_SAFETY_HARD_CEILINGS.maxPages);
    expect(refusalOf({ maxPages: RENDER_SAFETY_HARD_CEILINGS.maxPages + 1 })).toBeInstanceOf(
      InvalidRenderSafetyLimitsError,
    );
  });

  it('refuses a ceiling that would switch the guard off rather than raise it', () => {
    /* The whole point of a hard ceiling: `1e9` is otherwise a documented spelling of "no limit". */
    expect(refusalOf({ maxMaterializedUnits: 1_000_000_000 }).name).toBe(
      'InvalidRenderSafetyLimitsError',
    );
  });

  it('refuses zero, a negative, a fraction, a NaN and an infinity', () => {
    for (const value of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(refusalOf({ maxPages: value })).toBeInstanceOf(InvalidRenderSafetyLimitsError);
    }
  });

  it('refuses a key it does not know rather than dropping it in silence', () => {
    /* A caller that misspells a ceiling would otherwise believe it set one. */
    expect(refusalOf({ maxPagesEver: 4 })).toBeInstanceOf(InvalidRenderSafetyLimitsError);
  });

  it('carries the parsing failure as its cause, for a caller debugging its configuration', () => {
    expect(refusalOf({ maxPages: 0 }).cause).toBeDefined();
  });
});
