import type { DocumentRenderErrorDetails } from '../../errors.js';
import { refusal } from '../../errors.js';
import { bundledFace, DEFAULT_FONT_FAMILY, FONT_CATALOGUE } from './catalogue.js';
import type { ResolvedFontFace } from './types.js';

const UNSUPPORTED_FAMILY =
  'A block asks for a font family this build does not embed, and the engine will not resolve one from the machine it runs on: the same document would then print differently elsewhere. Read `details.nodeId` for the declaration.';

/**
 * The embedded face a run paints in.
 *
 * The declared name is resolved here and nowhere else, so no free string ever reaches the css. An
 * absent name takes the engine default; a name outside the catalogue is refused at the occurrence
 * that reached it, never at a branch the render never painted.
 *
 * The refusal carries the site and nothing else -- not the name asked for, which may have come from
 * a template a caller does not control, and not the text the run holds.
 */
export function resolveFontFace(
  family: string | undefined,
  bold: boolean,
  italic: boolean,
  details: DocumentRenderErrorDetails,
): ResolvedFontFace {
  const id = family === undefined ? DEFAULT_FONT_FAMILY : FONT_CATALOGUE.get(family);
  if (id === undefined) {
    throw refusal(UNSUPPORTED_FAMILY, 'unsupported-font-family', details);
  }
  const face = bundledFace(id, bold ? 700 : 400, italic ? 'italic' : 'normal');
  return { family: face.family, cssFamily: face.cssFamily, weight: face.weight, style: face.style };
}
