import { z } from 'zod/v4';
import { MAX_SHEET_MM } from '../page/types.js';
import { MAX_FONT_SIZE_PT, MIN_FONT_SIZE_PT } from './types.js';

const EMPTY_STYLE_MESSAGE = 'An empty style object is not a style; omit the field';

const refuseEmptyStyle = (payload: z.core.ParsePayload<object>): void => {
  if (payload.issues.length > 0) {
    return;
  }
  if (Object.values(payload.value).some((entry) => entry !== undefined)) {
    return;
  }
  payload.issues.push({
    code: 'custom',
    message: EMPTY_STYLE_MESSAGE,
    input: payload.value,
  });
};

/**
 * Zod schema for 6-digit hex color strings (#RRGGBB).
 */
export const ColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'A colour is six hexadecimal digits behind a hash, as #1b3a6f');

const styleLengthMmSchema = z
  .number()
  .min(0, 'A length cannot be negative')
  .max(MAX_SHEET_MM, `A length is at most ${MAX_SHEET_MM} mm`);

/**
 * Zod schema for typographic attributes.
 */
export const TypographySchema = z
  .object({
    family: z.string().min(1, 'A font family name is required').optional(),
    sizePt: z
      .number()
      .min(MIN_FONT_SIZE_PT, `A font size is at least ${MIN_FONT_SIZE_PT} pt`)
      .max(MAX_FONT_SIZE_PT, `A font size is at most ${MAX_FONT_SIZE_PT} pt`)
      .optional(),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    color: ColorSchema.optional(),
  })
  .check(refuseEmptyStyle);

/**
 * Zod schema for an individual border edge.
 */
export const BorderEdgeSchema = z.object({
  width: z
    .number()
    .gt(0, 'A rule has a positive width; omit the edge to declare no rule')
    .max(MAX_SHEET_MM, `A length is at most ${MAX_SHEET_MM} mm`),
  color: ColorSchema,
});

/**
 * Zod schema for box borders.
 */
export const BoxBorderSchema = z
  .object({
    top: BorderEdgeSchema.optional(),
    right: BorderEdgeSchema.optional(),
    bottom: BorderEdgeSchema.optional(),
    left: BorderEdgeSchema.optional(),
  })
  .check(refuseEmptyStyle);

/**
 * Zod schema for box padding in millimeters.
 */
export const BoxSpacingSchema = z.object({
  top: styleLengthMmSchema,
  right: styleLengthMmSchema,
  bottom: styleLengthMmSchema,
  left: styleLengthMmSchema,
});

/**
 * Zod schema for box visual styles (background, border, padding).
 */
export const BoxStyleSchema = z
  .object({
    background: ColorSchema.optional(),
    border: BoxBorderSchema.optional(),
    padding: BoxSpacingSchema.optional(),
  })
  .check(refuseEmptyStyle);
