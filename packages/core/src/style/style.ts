/**
 * Style module barrel: typography, box style, colors, borders, and unit conversions.
 */
export type { TextAlignSources, TypographySources } from './resolve.js';
export { resolveTextAlign, resolveTypography } from './resolve.js';
export {
  BorderEdgeSchema,
  BoxBorderSchema,
  BoxSpacingSchema,
  BoxStyleSchema,
  ColorSchema,
  TypographySchema,
} from './schemas.js';
export type { BorderEdge, BoxBorder, BoxSpacing, BoxStyle, Color, Typography } from './types.js';
export { MAX_FONT_SIZE_PT, MIN_FONT_SIZE_PT } from './types.js';
export { mmFromPt, ptFromMm } from './units.js';
