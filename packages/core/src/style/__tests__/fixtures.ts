/**
 * The two appearances of lot C5, shared by `style.test.ts` and by the playground -- one pair of
 * inks, two files, no copy.
 *
 * Two rules are inherited from `ast/__tests__/fixtures.ts`, and both are mechanical: NO EXPORTED
 * FACTORY GOES UNCALLED (`styleOfCase` is called by `style.test.ts`, and an uncalled one would
 * lower this package's function coverage without a test going red), and NOTHING IS IMPORTED FROM
 * `vitest` (this file is compiled into `dist/` and shipped in the tarball).
 */

import type { BoxStyle, Typography } from '../style.js';

/** The ink of appearance A: a navy corporate invoice. */
const NAVY = '#1b3a6f';
/**
 * The ink of appearance B, in UPPER CASE deliberately: both letter cases are legal, and the
 * fixture is where that decision is exercised rather than merely written down.
 */
const RUST = '#8C3A1B';

/**
 * A complete box, for the round-trip assertions: every field of {@link BoxStyle} present, every
 * field of `BoxBorder` present, every edge of `BoxSpacing` present.
 *
 * "Complete" is not decoration here. MEASURED, an entire border edge can disappear from the
 * schema with no compiler diagnostic and no failing test -- so the round trip has to compare a
 * literal that CARRIES every field, or it sees nothing. It is also the shape whose cost is
 * measured at 16 values on the bounded-shape count.
 */
export const RECIPE_BOX_COMPLETE: BoxStyle = {
  background: '#F2F4F8',
  border: {
    top: { width: 0.28, color: NAVY },
    right: { width: 0.28, color: NAVY },
    bottom: { width: 0.28, color: NAVY },
    left: { width: 0.28, color: NAVY },
  },
  padding: { top: 2, right: 3, bottom: 2, left: 3 },
};

/**
 * A complete typography: all five fields present, for the same reason.
 *
 * `sizePt: 10.5` and not `10`: a half-point is what an editorial size actually looks like, and
 * MEASURED, no half-point from 6 to 72 pt is refused by the two-decimal formula ADR 0006 warned
 * this lot about -- so this literal is also the counter-example to that warning.
 */
export const RECIPE_TYPOGRAPHY_COMPLETE: Typography = {
  family: 'EB Garamond',
  sizePt: 10.5,
  bold: true,
  italic: false,
  color: NAVY,
};

/**
 * Appearance A: navy, an outer frame, one horizontal rule per row, generous inset.
 *
 * Neither literal declares an empty style object: an empty one is REFUSED, and a fixture is the
 * first place a refused shape would slip back in.
 */
export const RECIPE_STYLE_A = {
  band: { background: '#F2F4F8', padding: { top: 2, right: 3, bottom: 2, left: 3 } },
  heading: { family: 'EB Garamond', sizePt: 18, bold: true, color: NAVY },
  body: { family: 'EB Garamond', sizePt: 10.5, color: '#22262b' },
  emphasis: { bold: true },
  rule: { width: 0.28, color: NAVY },
} as const satisfies Readonly<
  Record<string, BoxStyle | Typography | { width: number; color: string }>
>;

/** Appearance B: rust, no frame, one rule under the heading, a sans face. */
export const RECIPE_STYLE_B = {
  band: {
    border: { bottom: { width: 1.2, color: RUST } },
    padding: { top: 1, right: 1, bottom: 1, left: 1 },
  },
  heading: { family: 'Inter', sizePt: 14, bold: false, italic: true, color: RUST },
  body: { family: 'Inter', sizePt: 9, color: '#3A3A3A' },
  emphasis: { color: RUST },
  rule: { width: 1.2, color: RUST },
} as const satisfies Readonly<
  Record<string, BoxStyle | Typography | { width: number; color: string }>
>;

/**
 * `as const satisfies` and NOT an annotation, and the reason is the one `STANDARD_SHEETS_MM`
 * records with its measurement: annotated as a record of a union, `RECIPE_STYLE_A.band` would be
 * `X | undefined` under `noUncheckedIndexedAccess`, so every consumer -- including a test --
 * would have to handle an absent key, and a non-null assertion is forbidden. `satisfies` keeps
 * the literal keys and still checks every entry.
 *
 * A FUNCTION and not a constant, for the reason `compatibilityPage` records: a module-level
 * object handed to several tests is shared BY REFERENCE, and one test normalising it changes
 * what another one sees.
 */
export const styleOfCase = (which: 'a' | 'b'): typeof RECIPE_STYLE_A | typeof RECIPE_STYLE_B =>
  which === 'a' ? RECIPE_STYLE_A : RECIPE_STYLE_B;
