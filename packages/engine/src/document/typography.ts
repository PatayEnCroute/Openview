import { resolveTypography, type Typography } from '@openview/core';
import type { DocumentRenderErrorDetails } from '../errors.js';
import { resolveFontFace } from './fonts/index.js';
import type { ResolvedTypography } from './types.js';

/** What a run gets for the properties its site left unsaid. Family is resolved separately. */
const DEFAULTS = { sizePt: 10, bold: false, italic: false, color: '#000000' } as const;

/**
 * Completes a run's typography: run over block through the core resolver, then the engine defaults
 * property by property, then the declared family against the embedded catalogue.
 *
 * Nothing is inherited from an enclosing dom node, and the family is resolved here rather than at
 * paint time: a name outside the catalogue is refused at the occurrence that reached it, with the
 * site the caller can act on.
 */
export function resolveRunTypography(
  run: Typography | undefined,
  block: Typography | undefined,
  details: DocumentRenderErrorDetails = {},
): ResolvedTypography {
  const merged = resolveTypography({ run, block });
  return {
    face: resolveFontFace(
      merged?.family,
      merged?.bold ?? DEFAULTS.bold,
      merged?.italic ?? DEFAULTS.italic,
      details,
    ),
    sizePt: merged?.sizePt ?? DEFAULTS.sizePt,
    color: merged?.color ?? DEFAULTS.color,
  };
}

/** The typography a run with nothing declared anywhere paints in. */
export const DEFAULT_TYPOGRAPHY: ResolvedTypography = resolveRunTypography(undefined, undefined);
