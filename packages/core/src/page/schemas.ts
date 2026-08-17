import { z } from 'zod/v4';
import { ContainerNodeSchema } from '../ast/schemas.js';
import {
  MAX_SHEET_MM,
  MIN_SHEET_MM,
  PAGE_BAND_OCCURRENCES,
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

/**
 * Which occurrences may NOT share a side, because their page domains can overlap.
 *
 * DECLARED, never computed, and that is the whole design: overlap is a property of page
 * RANKS, and the number of pages is not a datum of the document -- the engine discovers it.
 * A check that intersected rank sets would need an `n` that save time does not have. So two
 * occurrences are declared compatible when they are disjoint for EVERY page count >= 1.
 *
 * `every` overlaps everything by construction. The two partitions are `firstOnly`/`exceptFirst`
 * and `exceptLast`/`lastOnly`: disjoint at any count, the open-ended half being simply empty at
 * n = 1, which is a behaviour and not a conflict. Everything else collides at some count, and
 * three of those are worth naming because they look harmless: `firstOnly`/`exceptLast` meet on
 * page 1 from two pages on, `exceptFirst`/`lastOnly` meet on the last page from two pages on,
 * and `exceptFirst`/`exceptLast` meet in the middle from THREE pages on.
 *
 * `firstOnly`/`lastOnly` is the one refusal that costs a real capability -- on two pages or more
 * the two are disjoint. It is refused because on a ONE-page document they are the same sheet, so
 * accepting the pair would make validity depend on the page count: a document legal for one
 * caller and ambiguous for another, which is condition 3 of the membership criterion abandoned.
 *
 * TWO PROPERTIES THIS TABLE MUST KEEP, both measured, both covered by a test:
 * - it is SYMMETRIC -- `checkBandsCannotOverlap` compares each band against EARLIER ones using
 *   the current band's row, so an asymmetric row would make `[a, b]` and `[b, a]` disagree;
 * - it matches the rank-domain derivation for every page count (verified n = 1..8), which is
 *   what makes "declared, not computed" a shortcut rather than a different rule.
 *
 * Widening PAGE_BAND_OCCURRENCES without extending this table does not compile: `Record` over
 * the union demands one row per member (measured, TS2741).
 */
const BAND_OCCURRENCE_CONFLICTS: Readonly<
  Record<PageBandOccurrence, readonly PageBandOccurrence[]>
> = {
  every: ['every', 'firstOnly', 'exceptFirst', 'exceptLast', 'lastOnly'],
  firstOnly: ['every', 'firstOnly', 'exceptLast', 'lastOnly'],
  exceptFirst: ['every', 'exceptFirst', 'exceptLast', 'lastOnly'],
  exceptLast: ['every', 'firstOnly', 'exceptFirst', 'exceptLast'],
  lastOnly: ['every', 'firstOnly', 'exceptFirst', 'lastOnly'],
};

/**
 * Refuses two bands on one side that can apply to the same page.
 *
 * Not a matter of taste: two applicable bands are an ambiguous intent (stack them? in which
 * order? at what cumulative height?), and defining the stacking would demand an order rule
 * and a measurement, neither of which this contract carries. The intent is already
 * expressible without a new field -- a running footer plus a last-page footer is
 * `exceptLast` + `lastOnly`, a letterhead plus a running header is `firstOnly` +
 * `exceptFirst`, with the shared content written twice. The refusal removes a state without
 * removing a capability -- with one named exception, `firstOnly` + `lastOnly`, see above.
 *
 * The message names no occurrence: a constant payload stays safe to log (ADR 0003). The path
 * points at the SECOND band's `on`, which is where the author fixes it.
 *
 * One issue is raised PER SUPERNUMERARY BAND, never per offending couple, so three mutually
 * incompatible bands yield two messages naming two distinct bands to remove.
 *
 * Extracted rather than inlined because the same check serves both sides, and because a
 * named function is what a coverage report can point at.
 */
function checkBandsCannotOverlap(
  bands: readonly PageBand[],
  ctx: z.RefinementCtx<readonly PageBand[]>,
): void {
  const claimed: PageBandOccurrence[] = [];
  for (const [index, band] of bands.entries()) {
    const conflicts = BAND_OCCURRENCE_CONFLICTS[band.on];
    if (claimed.some((earlier) => conflicts.includes(earlier))) {
      ctx.addIssue({
        code: 'custom',
        path: [index, 'on'],
        message: 'Two bands on the same side can apply to the same page.',
      });
    }
    claimed.push(band.on);
  }
}

const bandsSchema = z.array(PageBandSchema).superRefine(checkBandsCannotOverlap);

/**
 * The page, with its two cross-field invariants.
 *
 * The invariants live INSIDE the schema, not in a separate validation function, because
 * this schema is exported: an integrator validating a page before storing it must get
 * the same refusal `parseTemplate` gives. That rests on a library behaviour which is
 * measured and must be replayed on every zod upgrade -- a `superRefine` leaves a
 * `ZodObject` in zod 4 (`.shape` and `.extend` stay available, and
 * `TemplateSchema.extend({ page: PageSetupSchema })` is itself still a `ZodObject`).
 *
 * The GUARD is load-bearing, and it is measured: without it, a sheet of width `0`
 * yields TWO issues -- the `too_small` of the width, then the `custom` of the horizontal
 * margins, because `30 >= 0` holds. The second is collateral damage of the first, and lot
 * C8 was promised one message at a time. The branch is reached by every ill-dimensioned
 * sheet, so it is covered by a test rather than dead.
 *
 * What the guard does NOT rescue: an ABANDONING issue skips this refinement entirely,
 * while a CONTINUABLE one does not. The rule is `too_small`/`too_big`/`custom` continue,
 * `invalid_type`/`invalid_value` abandon -- so a non-numeric margin masks the cross-field
 * check until it is fixed, and a margin merely out of bounds does not.
 *
 * Both messages are CONSTANT: no interpolation of the document's content, per ADR 0003 --
 * an error payload must stay safe to log even when the document is not.
 */
export const PageSetupSchema = z
  .object({
    sheet: SheetSchema,
    margins: PageMarginsSchema,
    header: bandsSchema,
    footer: bandsSchema,
  })
  .superRefine((page, ctx) => {
    const { width, height } = page.sheet;
    if (!(width > 0 && height > 0)) {
      return;
    }
    const { top, right, bottom, left } = page.margins;
    if (left + right >= width) {
      ctx.addIssue({
        code: 'custom',
        path: ['margins'],
        message: 'Horizontal margins leave no printable width.',
      });
    }
    if (top + bottom >= height) {
      ctx.addIssue({
        code: 'custom',
        path: ['margins'],
        message: 'Vertical margins leave no printable height.',
      });
    }
  });

/**
 * One direction only, and the other is unavailable: `z.array` infers a MUTABLE array
 * where the hand-written type is `readonly`, so mutual assignability is measurably
 * `false` and cannot be asserted -- unlike `TextSegment`, which carries no array and on
 * which `nodes.test.ts` does assert both directions.
 *
 * What this catches: a schema field whose output no longer satisfies the type. What
 * nothing catches at the type level: a field added to the type and not to the schema --
 * for that, see the JSON round trip in `page.test.ts`, which reddens because `z.object`
 * strips a key it does not know.
 *
 * Not exported by the package barrel: it is a compile-time assertion, not an API.
 */
export const PAGE_SETUP_SCHEMA_SATISFIES_TYPE: z.infer<typeof PageSetupSchema> extends PageSetup
  ? true
  : false = true;
