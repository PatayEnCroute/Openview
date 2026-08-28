/**
 * The embedded font catalogue: what a declared family resolves to, which characters it can draw,
 * and the stylesheet that carries its bytes.
 *
 * Local facade. Nothing here is exported from `@openview/engine`: which faces a build embeds is a
 * capability of the adapter chain, not a contract a caller writes against.
 */
export {
  BUNDLED_FACES,
  bundledFace,
  CATALOGUE_ORDER,
  DEFAULT_FONT_FAMILY,
  FONT_CATALOGUE,
} from './catalogue.js';
export { usedFaces } from './collect.js';
export { assertCoveredText } from './coverage.js';
export { fontFaceCss } from './css.js';
export { resolveFontFace } from './resolve.js';
export type {
  BundledFontFace,
  BundledFontFamilyId,
  BundledFontStyle,
  BundledFontWeight,
  ResolvedFontFace,
} from './types.js';
