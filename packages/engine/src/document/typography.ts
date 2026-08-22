import { resolveTypography, type Typography } from '@openview/core';
import type { ResolvedTypography } from './types.js';

/**
 * What a run gets when neither it nor its block says otherwise.
 *
 * `sans-serif` is a generic family, so the glyphs it selects belong to the host: this default makes
 * a document printable, not identical between two machines.
 */
export const DEFAULT_TYPOGRAPHY: ResolvedTypography = {
  family: 'sans-serif',
  sizePt: 10,
  bold: false,
  italic: false,
  color: '#000000',
};

/**
 * Completes a run's typography: run over block through the core resolver, then the engine defaults
 * property by property. Nothing is inherited from an enclosing container.
 */
export function resolveRunTypography(
  run: Typography | undefined,
  block: Typography | undefined,
): ResolvedTypography {
  const merged = resolveTypography({ run, block });
  return {
    family: merged?.family ?? DEFAULT_TYPOGRAPHY.family,
    sizePt: merged?.sizePt ?? DEFAULT_TYPOGRAPHY.sizePt,
    bold: merged?.bold ?? DEFAULT_TYPOGRAPHY.bold,
    italic: merged?.italic ?? DEFAULT_TYPOGRAPHY.italic,
    color: merged?.color ?? DEFAULT_TYPOGRAPHY.color,
  };
}
