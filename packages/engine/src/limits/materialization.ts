import { type DocumentRenderErrorDetails, refusal } from '../errors.js';

const EXCEEDED =
  'This template builds more document objects than one render may hold. A loop over a large sequence spends few evaluation steps and still materialises millions of blocks, so the two budgets are counted apart. Read `details.limit` for the ceiling and `details.nodeId` for the declaration that crossed it.';

/**
 * The count of persistent document objects one render is allowed to build.
 *
 * Reserved before allocation rather than measured after it: a check that runs once the array
 * exists has already paid for the array it was meant to refuse.
 */
export interface MaterializationBudget {
  /** Reserves `units` objects, or refuses at the site described by `at`. */
  reserve(units: number, at: DocumentRenderErrorDetails): void;
  readonly spent: number;
  readonly limit: number;
}

/**
 * Creates a budget shared by every pass of one render.
 *
 * The band extension pass takes the same instance as the first materialisation: two passes each
 * staying under the ceiling would let a document reach twice it. The refusal names the ceiling and
 * the site, never the running total, which would hint at the caller's row count.
 */
export function createMaterializationBudget(limit: number): MaterializationBudget {
  let spent = 0;
  return {
    reserve(units: number, at: DocumentRenderErrorDetails): void {
      spent += units;
      if (spent > limit) {
        throw refusal(EXCEEDED, 'materialization-limit-exceeded', {
          ...at,
          phase: 'materialization',
          limit,
        });
      }
    },
    get spent(): number {
      return spent;
    },
    limit,
  };
}
