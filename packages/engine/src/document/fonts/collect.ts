import { walkDocument } from '../traverse.js';
import type { MaterialDocument } from '../types.js';
import { BUNDLED_FACES } from './catalogue.js';
import type { ResolvedFontFace } from './types.js';

const rankOf = (face: ResolvedFontFace): number =>
  BUNDLED_FACES.findIndex(
    (bundled) =>
      bundled.family === face.family &&
      bundled.weight === face.weight &&
      bundled.style === face.style,
  );

/**
 * The distinct faces this document paints, in the fixed order of the catalogue.
 *
 * Sorted by catalogue rank rather than by the order the walk met them, so two renders of the same
 * document emit the same stylesheet whatever the data made reachable first. Every area is walked,
 * layers included: a marker in a page layer is painted on every page.
 */
export function usedFaces(document: MaterialDocument): readonly ResolvedFontFace[] {
  const found = new Map<number, ResolvedFontFace>();
  for (const block of walkDocument(document)) {
    if (block.kind !== 'text') {
      continue;
    }
    for (const run of block.runs) {
      const face = run.typography.face;
      found.set(rankOf(face), face);
    }
  }
  return [...found.entries()].sort(([left], [right]) => left - right).map(([, face]) => face);
}
