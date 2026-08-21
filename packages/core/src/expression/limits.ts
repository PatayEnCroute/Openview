import { z } from 'zod/v4';
import { InvalidEvaluationLimitsError } from '../errors.js';
import { LIMIT_TYPE_MESSAGE } from '../validation-messages.js';

/**
 * Safety ceilings for expression evaluation.
 */
export interface EvaluationLimits {
  /** Maximum number of expression nodes/steps evaluated during a render. */
  readonly maxSteps: number;
  /** Maximum recursive descent depth in expressions. */
  readonly maxDepth: number;
  /** Maximum cumulative items visited in lists and sequences. */
  readonly maxItemsVisited: number;
  /** Maximum length allowed for strings produced by string operations. */
  readonly maxStringLength: number;
}

/**
 * Mutable evaluation budget threaded through all evaluation operations.
 */
export interface EvaluationBudget {
  spend(steps: number): boolean;
  enter(): boolean;
  leave(): void;
  visit(items: number): boolean;
  acceptString(length: number): boolean;
  readonly spent: {
    readonly steps: number;
    readonly itemsVisited: number;
    readonly depth: number;
  };
  readonly limits: EvaluationLimits;
}

export const LIMIT_MIN = 1;
export const LIMIT_HARD_CEILING = 1_000_000_000;

export const limitSchema = z
  .number({ error: LIMIT_TYPE_MESSAGE })
  .int('A limit must be a whole number')
  .min(LIMIT_MIN, `A limit may not go below ${LIMIT_MIN}`)
  .max(LIMIT_HARD_CEILING, `A limit may not exceed ${LIMIT_HARD_CEILING}`);

const evaluationLimitsSchema = z.object({
  maxSteps: limitSchema,
  maxDepth: limitSchema,
  maxItemsVisited: limitSchema,
  maxStringLength: limitSchema,
});

/** Default evaluation limits. */
export const DEFAULT_EVALUATION_LIMITS: EvaluationLimits = evaluationLimitsSchema.parse({
  maxSteps: 1_000_000,
  maxDepth: 64,
  maxItemsVisited: 100_000,
  maxStringLength: 1_000_000,
});

/**
 * Resolves configured limits by filling missing properties with defaults.
 */
export function resolveLimits<T extends object>(
  defaults: T,
  schema: z.ZodType<T>,
  overrides: Partial<T> | undefined,
  toError: (cause: z.ZodError) => Error,
): T {
  if (overrides === undefined) {
    return defaults;
  }
  const filled = { ...defaults };
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      Reflect.set(filled, key, value);
    }
  }
  const result = schema.safeParse(filled);
  if (!result.success) {
    throw toError(result.error);
  }
  return result.data;
}

/** Validates and resolves evaluation limits against default limits. */
export function resolveEvaluationLimits(limits?: Partial<EvaluationLimits>): EvaluationLimits {
  return resolveLimits(
    DEFAULT_EVALUATION_LIMITS,
    evaluationLimitsSchema,
    limits,
    (cause) =>
      new InvalidEvaluationLimitsError(
        'An evaluation limit must be a whole number between 1 and 1 000 000 000. Omit a field to take its default; a present but unusable value is refused rather than replaced, because `maxDepth: 0` disables the guard and `maxSteps: NaN` makes it run forever.',
        { cause },
      ),
  );
}

/** Creates an evaluation budget with fresh zeroed counters. */
export function createBudget(configuredLimits?: Partial<EvaluationLimits>): EvaluationBudget {
  const limits = resolveEvaluationLimits(configuredLimits);
  let stepsSpent = 0;
  let itemsVisited = 0;
  let currentDepth = 0;

  return {
    spend(steps: number): boolean {
      stepsSpent += steps;
      return stepsSpent <= limits.maxSteps;
    },
    enter(): boolean {
      if (currentDepth >= limits.maxDepth) {
        return false;
      }
      currentDepth += 1;
      return true;
    },
    leave(): void {
      currentDepth -= 1;
    },
    visit(items: number): boolean {
      itemsVisited += items;
      return itemsVisited <= limits.maxItemsVisited;
    },
    acceptString(length: number): boolean {
      return length <= limits.maxStringLength;
    },
    get spent() {
      return {
        steps: stepsSpent,
        itemsVisited,
        depth: currentDepth,
      };
    },
    limits,
  };
}
