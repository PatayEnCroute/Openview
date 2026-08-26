import { z } from 'zod/v4';
import { ContainerNodeSchema } from '../ast/nodes.js';
import {
  MAX_SHEET_MM,
  MIN_SHEET_MM,
  PAGE_BAND_OCCURRENCES,
  PAGE_LAYER_PLANES,
  type PageBand,
  type PageBandOccurrence,
  type PageSetup,
} from './types.js';

const sheetLengthSchema = z
  .number()
  .min(MIN_SHEET_MM, `A sheet is at least ${MIN_SHEET_MM} mm`)
  .max(MAX_SHEET_MM, `A sheet is at most ${MAX_SHEET_MM} mm`);

const marginLengthSchema = z
  .number()
  .min(0, 'A margin cannot be negative')
  .max(MAX_SHEET_MM, `A margin is at most ${MAX_SHEET_MM} mm`);

export const SheetSchema = z.object({
  width: sheetLengthSchema,
  height: sheetLengthSchema,
});

export const PageMarginsSchema = z.object({
  top: marginLengthSchema,
  right: marginLengthSchema,
  bottom: marginLengthSchema,
  left: marginLengthSchema,
});

export const PageBandSchema = z.object({
  on: z.enum(PAGE_BAND_OCCURRENCES),
  content: ContainerNodeSchema,
});

const BAND_OCCURRENCE_CONFLICTS: Readonly<
  Record<PageBandOccurrence, readonly PageBandOccurrence[]>
> = {
  every: ['every', 'firstOnly', 'exceptFirst', 'exceptLast', 'lastOnly'],
  firstOnly: ['every', 'firstOnly', 'exceptLast', 'lastOnly'],
  exceptFirst: ['every', 'exceptFirst', 'exceptLast', 'lastOnly'],
  exceptLast: ['every', 'firstOnly', 'exceptFirst', 'exceptLast'],
  lastOnly: ['every', 'firstOnly', 'exceptFirst', 'lastOnly'],
};

function checkBandsCannotOverlap(
  bands: readonly PageBand[],
  ctx: z.RefinementCtx<readonly PageBand[]>,
): void {
  if (bands.length > MAX_BANDS_PER_SIDE) {
    return;
  }
  const claimed = new Set<PageBandOccurrence>();
  for (const [index, band] of bands.entries()) {
    const conflicts = BAND_OCCURRENCE_CONFLICTS[band.on];
    if (conflicts.some((occurrence) => claimed.has(occurrence))) {
      ctx.addIssue({
        code: 'custom',
        path: [index, 'on'],
        message: 'Two bands on the same side can apply to the same page.',
      });
    }
    claimed.add(band.on);
  }
}

export const MAX_BANDS_PER_SIDE = 2;

/**
 * Zod schema for a page band list ensuring at most two non-overlapping bands per side.
 */
export const PageBandsSchema = z
  .array(PageBandSchema)
  .max(MAX_BANDS_PER_SIDE, 'A side carries at most two bands.')
  .check(z.superRefine(checkBandsCannotOverlap));

export const PageLayerSchema = z.object({
  plane: z.enum(PAGE_LAYER_PLANES),
  opacity: z
    .number()
    .gt(
      0,
      'An opacity of 0 stores an invisible layer; remove the layer or guard it with a condition',
    )
    .lt(1, 'An opacity of 1 duplicates the absence of the field; omit it')
    .optional(),
  content: ContainerNodeSchema,
});

/**
 * Zod schema for the page layer list. Non-empty on purpose: an absent field already says
 * "no layer", and a second spelling of that fact would have to be normalised everywhere.
 */
export const PageLayersSchema = z
  .array(PageLayerSchema)
  .min(1, 'A page layer list is non-empty; omit the field to declare no layer');

/**
 * Zod schema for PageSetup validating positive printable dimensions on both axes.
 */
export const PageSetupSchema = z
  .object({
    sheet: SheetSchema,
    margins: PageMarginsSchema,
    header: PageBandsSchema,
    footer: PageBandsSchema,
    layers: PageLayersSchema.optional(),
  })
  .check(
    z.superRefine((page, ctx) => {
      const { width, height } = page.sheet;
      const { top, right, bottom, left } = page.margins;
      if (width >= MIN_SHEET_MM && left + right >= width) {
        ctx.addIssue({
          code: 'custom',
          path: ['margins'],
          message: 'Horizontal margins leave no printable width.',
        });
      }
      if (height >= MIN_SHEET_MM && top + bottom >= height) {
        ctx.addIssue({
          code: 'custom',
          path: ['margins'],
          message: 'Vertical margins leave no printable height.',
        });
      }
    }),
  );

export const PAGE_SETUP_SCHEMA_SATISFIES_TYPE: z.infer<typeof PageSetupSchema> extends PageSetup
  ? true
  : false = true;
