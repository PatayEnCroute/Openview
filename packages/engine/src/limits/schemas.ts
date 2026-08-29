import { z } from 'zod/v4';
import { InvalidRenderSafetyLimitsError } from '../errors.js';
import {
  DEFAULT_RENDER_SAFETY_LIMITS,
  RENDER_SAFETY_HARD_CEILINGS,
  type RenderSafetyLimits,
  type RenderSafetyLimitsOverrides,
} from './types.js';

const INVALID =
  'A safety limit must be a whole number between 1 and its hard ceiling. Omit a field to take its default; a present but unusable value is refused rather than replaced, because `maxPages: 0` refuses every document and `maxHtmlBytes: NaN` bounds nothing.';

const bounded = (ceiling: number): z.ZodType<number> =>
  z
    .number()
    .int('A safety limit must be a whole number')
    .min(1, 'A safety limit may not go below 1')
    .max(ceiling, `A safety limit may not exceed ${ceiling}`);

/** Validation of the three logical ceilings, refusing unknown keys rather than dropping them. */
export const RenderSafetyLimitsSchema: z.ZodType<RenderSafetyLimits> = z
  .strictObject({
    maxMaterializedUnits: bounded(RENDER_SAFETY_HARD_CEILINGS.maxMaterializedUnits),
    maxPages: bounded(RENDER_SAFETY_HARD_CEILINGS.maxPages),
    maxHtmlBytes: bounded(RENDER_SAFETY_HARD_CEILINGS.maxHtmlBytes),
  })
  .readonly();

/**
 * Fills the ceilings the caller left out and refuses the ones it got wrong.
 *
 * Called once per render, before any work: an unusable configuration must stop the port rather than
 * a document halfway through its first page.
 */
export function resolveRenderSafetyLimits(
  overrides?: RenderSafetyLimitsOverrides | undefined,
): RenderSafetyLimits {
  if (overrides === undefined) {
    return DEFAULT_RENDER_SAFETY_LIMITS;
  }
  const filled: Record<string, unknown> = { ...DEFAULT_RENDER_SAFETY_LIMITS };
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      filled[key] = value;
    }
  }
  const parsed = RenderSafetyLimitsSchema.safeParse(filled);
  if (!parsed.success) {
    throw new InvalidRenderSafetyLimitsError(INVALID, { cause: parsed.error });
  }
  return parsed.data;
}
