/**
 * Reference style fixtures used across style tests and playground examples.
 */

import type { TextAlignment } from '../../ast/nodes.js';
import type { BoxStyle, Typography } from '../style.js';

/** The ink of appearance A: a navy corporate invoice. */
const NAVY = '#1b3a6f';
/**
 * The ink of appearance B, in UPPER CASE deliberately: both letter cases are legal, and the
 * fixture is where that decision is exercised rather than merely written down.
 */
const RUST = '#8C3A1B';

/** Complete BoxStyle test fixture with all fields present. */
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

/** Complete Typography test fixture with all fields present. */
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
 * `legalAlign` is `'start'` here and `'justify'` in B, and that ONE key is what exercises the
 * fourth member of `TEXT_ALIGNMENTS` -- the member a COLUMN cannot declare. Neither literal
 * declares an empty style object: an empty one is REFUSED, and a fixture is the first place a
 * refused shape would slip back in.
 */
export const RECIPE_STYLE_A = {
  band: { background: '#F2F4F8', padding: { top: 2, right: 3, bottom: 2, left: 3 } },
  heading: { family: 'EB Garamond', sizePt: 18, bold: true, color: NAVY },
  body: { family: 'EB Garamond', sizePt: 10.5, color: '#22262b' },
  emphasis: { bold: true },
  rule: { width: 0.28, color: NAVY },
  legalAlign: 'start',
} as const satisfies Readonly<
  Record<string, BoxStyle | Typography | { width: number; color: string } | TextAlignment>
>;

/** Appearance B: rust, no frame, one rule under the heading, a sans face, justified mentions. */
export const RECIPE_STYLE_B = {
  band: {
    border: { bottom: { width: 1.2, color: RUST } },
    padding: { top: 1, right: 1, bottom: 1, left: 1 },
  },
  heading: { family: 'Inter', sizePt: 14, bold: false, italic: true, color: RUST },
  body: { family: 'Inter', sizePt: 9, color: '#3A3A3A' },
  emphasis: { color: RUST },
  rule: { width: 1.2, color: RUST },
  legalAlign: 'justify',
} as const satisfies Readonly<
  Record<string, BoxStyle | Typography | { width: number; color: string } | TextAlignment>
>;

/** Returns a fresh reference to recipe style objects. */
export const styleOfCase = (which: 'a' | 'b'): typeof RECIPE_STYLE_A | typeof RECIPE_STYLE_B =>
  which === 'a' ? RECIPE_STYLE_A : RECIPE_STYLE_B;
