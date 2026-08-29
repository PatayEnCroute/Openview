import { z } from 'zod/v4';
import { InvalidProtectedConfigurationError } from './resource/errors.js';

/** Every bound of this package is a whole count, so one schema describes all of them. */
export const boundedBy = (ceiling: number): z.ZodType<number> =>
  z
    .number()
    .int('A protection limit must be a whole number')
    .min(1, 'A protection limit may not go below 1')
    .max(ceiling, `A protection limit may not exceed ${ceiling}`);

/** What a caller may name for a set of bounds: any of them, none, or an explicit `undefined`. */
export type Overrides<TLimits> = {
  readonly [K in keyof TLimits]?: TLimits[K] | undefined;
};

/**
 * Fills the bounds a caller left out and refuses the ones it got wrong.
 *
 * One implementation for every set of bounds this package validates: two copies would be two
 * ceiling semantics to keep in step, and the whole point of a hard ceiling is that it means the
 * same thing wherever it is written.
 */
export function resolveBounds<TLimits extends object>(
  defaults: TLimits,
  schema: z.ZodType<TLimits>,
  overrides: Overrides<TLimits> | undefined,
  message: string,
): TLimits {
  if (overrides === undefined) {
    return defaults;
  }
  const filled: Record<string, unknown> = Object.fromEntries(Object.entries(defaults));
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      filled[key] = value;
    }
  }
  const parsed = schema.safeParse(filled);
  if (!parsed.success) {
    throw new InvalidProtectedConfigurationError(message, { cause: parsed.error });
  }
  return parsed.data;
}
