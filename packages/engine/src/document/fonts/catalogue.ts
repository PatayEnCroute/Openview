/**
 * The closed table of families this build can paint, and the faces behind each of them.
 *
 * A closed table rather than a port: a second font backend does not exist, and resolving a name
 * against the host is exactly what E6 exists to stop. Adding a family is a change to this file, a
 * new pin in `tools/fonts/sources.mjs` and a new entry in `NOTICE` -- never a runtime lookup.
 */
import { GENERATED_FACES } from './generated.js';
import type {
  BundledFontFace,
  BundledFontFamilyId,
  BundledFontStyle,
  BundledFontWeight,
} from './types.js';

/**
 * The family a run gets when neither it nor its block names one.
 *
 * A concrete embedded family, not a css generic: `sans-serif` selects whatever the machine has
 * installed, which is the machine speaking rather than the template.
 */
export const DEFAULT_FONT_FAMILY: BundledFontFamilyId = 'noto-sans-2.015';

/**
 * Every name a template may declare, and the embedded family it selects.
 *
 * Case-sensitive, never trimmed and never canonicalised by a locale: two spellings that differ are
 * two different declarations, and deciding they mean the same thing would be a rule about the
 * host's fonts. `Arial`, `Georgia`, `Helvetica`, `system-ui`, `monospace`, `cursive`, `fantasy`,
 * `emoji`, `math` and `-apple-system` are absent on purpose -- accepting one and painting Noto
 * would be lying about the declaration, and passing it to the browser would read the machine.
 */
export const FONT_CATALOGUE: ReadonlyMap<string, BundledFontFamilyId> = new Map([
  ['sans-serif', DEFAULT_FONT_FAMILY],
  ['serif', 'noto-serif-2.015'],
  ['Noto Sans', DEFAULT_FONT_FAMILY],
  ['Noto Serif', 'noto-serif-2.015'],
  ['Inter', 'inter-4.1'],
]);

/** The families, in the fixed order every emitted stylesheet lists them in. */
export const CATALOGUE_ORDER: readonly BundledFontFamilyId[] = [
  'inter-4.1',
  'noto-sans-2.015',
  'noto-serif-2.015',
];

/** Every embedded face, in the fixed order of the catalogue. */
export const BUNDLED_FACES: readonly BundledFontFace[] = GENERATED_FACES;

const key = (family: BundledFontFamilyId, weight: BundledFontWeight, style: BundledFontStyle) =>
  `${family} ${weight} ${style}`;

const BY_KEY: ReadonlyMap<string, BundledFontFace> = new Map(
  BUNDLED_FACES.map((face) => [key(face.family, face.weight, face.style), face]),
);

/**
 * The face of a family at one weight and style.
 *
 * Every family carries all four, so this never falls back: a missing entry is a broken build, not a
 * document the engine should paint with a synthesised slant.
 */
export function bundledFace(
  family: BundledFontFamilyId,
  weight: BundledFontWeight,
  style: BundledFontStyle,
): BundledFontFace {
  const found = BY_KEY.get(key(family, weight, style));
  if (found === undefined) {
    throw new TypeError(`the embedded catalogue has no ${key(family, weight, style)}`);
  }
  return found;
}

/** The rank a face is emitted at, so one document always writes its faces in one order. */
export function faceOrder(face: {
  readonly cssFamily: string;
  readonly weight: number;
  readonly style: string;
}): string {
  return `${face.cssFamily} ${face.weight} ${face.style}`;
}
