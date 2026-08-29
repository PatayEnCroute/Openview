import { describe, expect, it } from 'vitest';
import { DocumentRenderError } from '../../errors.js';
import { createMaterializationBudget } from '../materialization.js';

const refusalOf = (run: () => unknown): DocumentRenderError => {
  try {
    run();
  } catch (error) {
    if (error instanceof DocumentRenderError) {
      return error;
    }
    throw error;
  }
  throw new Error('the reservation was accepted');
};

describe('the objects one render may build', () => {
  it('accepts exactly the ceiling and refuses the next unit', () => {
    const budget = createMaterializationBudget(3);
    for (let at = 0; at < 3; at += 1) {
      budget.reserve(1, {});
    }
    expect(budget.spent).toBe(3);
    expect(refusalOf(() => budget.reserve(1, {})).code).toBe('materialization-limit-exceeded');
  });

  it('refuses a single reservation that would cross the ceiling on its own', () => {
    const budget = createMaterializationBudget(10);
    expect(refusalOf(() => budget.reserve(11, {})).details.limit).toBe(10);
  });

  it('names the stage and the site, and never the running total', () => {
    const budget = createMaterializationBudget(1);
    budget.reserve(1, {});
    const refused = refusalOf(() => budget.reserve(1, { nodeId: 'rows', region: 'root' }));
    expect(refused.details.phase).toBe('materialization');
    expect(refused.details.nodeId).toBe('rows');
    /* The total would only ever restate the ceiling, while hinting at how many rows the caller's
       data set holds. */
    expect(refused.details.observed).toBeUndefined();
  });

  it('publishes the ceiling it was created with', () => {
    expect(createMaterializationBudget(7).limit).toBe(7);
  });
});
