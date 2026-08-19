import { z } from 'zod/v4';
import { ContainerNodeSchema } from '../ast/nodes.js';
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
 * One issue is raised PER SUPERNUMERARY BAND, never per offending couple -- but never more
 * than MAX_BANDS_PER_SIDE of them, because past that count the array bound has already
 * spoken and this function yields to it. That early return is what keeps the refusal COST
 * bounded: without it a hostile side of 100 000 bands produced 99 998 issue objects and a
 * 2.8 MB `error.message`, which is the denial of service the bound exists to prevent,
 * performed by the refusal.
 *
 * Extracted rather than inlined because the same check serves both sides, and because a
 * named function is what a coverage report can point at.
 */
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
    // The scan runs over the CONFLICT ROW, never over the bands seen so far, and the
    // difference is the cost: a row holds at most five occurrences, so this is O(1) per
    // band where `claimed.some(...)` over an array was O(n). MEASURED on the earlier
    // spelling, through the exported `PageSetupSchema.safeParse`: `exceptFirst × k` then
    // `firstOnly × k` never matches before index k, so 16 000 bands took 1 793 ms and
    // 100 000 took 62 s of blocked CPU -- against 59 ms for the same count all `every`,
    // which matched at index 0. A `Set` of five possible values removes the ordering
    // sensitivity entirely.
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

/**
 * The ceiling the conflict table already proves, written down so it BOUNDS rather than
 * merely holds.
 *
 * Of the twenty-five couples exactly two are compatible, and since they share no member a
 * valid side can never carry more than two bands -- so this refuses no page
 * `checkBandsCannotOverlap` did not already refuse. What it adds is a COST bound. Without
 * it the array is unbounded, and `assertBoundedShape` is no help: `maxNodes = 100_000`
 * admits some 16 600 bands at six values each, and MEASURED, `parseTemplate` on a 1.17 MB
 * document spent 1 961 ms and 27 MB producing 16 598 issues for a document it then refused.
 *
 * It is a VACUOUS narrowing in the sense of AGENTS.md 1.2 -- no document a former build
 * accepted becomes unopenable -- so it carries no schema version of its own.
 */
export const MAX_BANDS_PER_SIDE = 2;

/**
 * A band list with its invariant, EXPORTED, and that is the point rather than a detail.
 *
 * `PageBandSchema` alone validates one band and knows nothing of its neighbours, so an
 * integrator composing the obvious `z.array(PageBandSchema)` accepts `every` + `lastOnly`,
 * stores it, and meets the refusal only later from `parseTemplate`, on a path far from the
 * code that accepted it -- the trap `parseDocumentNode` documents for a bare `tableRow`,
 * one lot on. Exporting the refined list is what lets a caller reproduce the refusal
 * `PageSetupSchema` gives, which is the whole reason the invariants live in a schema.
 *
 * Compose from THIS, never from `z.array(PageBandSchema)`.
 */
export const PageBandsSchema = z
  .array(PageBandSchema)
  .max(MAX_BANDS_PER_SIDE, 'A side carries at most two bands.')
  .check(z.superRefine(checkBandsCannotOverlap));

/**
 * The page, with its two cross-field invariants.
 *
 * The invariants live INSIDE the schema, not in a separate validation function, because
 * this schema is exported: an integrator validating a page before storing it must get
 * the same refusal `parseTemplate` gives.
 *
 * ## ⚠️ DERIVING FROM THIS SCHEMA DROPS THESE INVARIANTS. Do not.
 *
 * An earlier version of this docstring said a `superRefine` leaves a `ZodObject` in zod 4,
 * so `.shape` and `.extend` stay available. Both halves are true and the reassurance they
 * carry is FALSE, which is worse than a warning that is missing: in zod 4 `.extend()`,
 * `.omit()`, `.pick()` and `.partial()` all RESET the schema's checks. MEASURED --
 * `{ margins: { top: 200, right: 20, bottom: 200, left: 20 } }` on a 210 x 297 sheet is
 * refused here and ACCEPTED through `PageSetupSchema.extend({ bleed: z.number() })`, on
 * which `printableAreaOf` then returns a NEGATIVE area. The band invariant survives all
 * four, because it lives on the `header`/`footer` field schemas rather than on this object
 * -- so a derived schema half-validates, which is the shape of the bug that gets shipped.
 *
 * What DOES preserve them, both measured: `.strict()`, and nesting the schema as a field
 * (`z.object({ page: PageSetupSchema })` -- which is how `TemplateSchema` carries it, and
 * why `parseTemplate` is unaffected). An integrator needing extra fields beside a page
 * wraps it in a field; it never widens it in place.
 *
 * The gap is NAMED here rather than disguised, on the precedent `template/guard.ts` sets
 * for `ExpressionSchema` ("bounds nothing, and it stays exported"): zod exposes no way to
 * carry an object-level check across a derivation, so the honest move is to say so.
 *
 * ## The two guards, one per axis
 *
 * Each direction is gated on ITS OWN dimension, and both facts behind that are measured.
 *
 * The gate exists because without it a sheet of width `0` yields TWO issues -- the
 * `too_small` of the width, then the `custom` of the horizontal margins, since `30 >= 0`
 * holds. The second is collateral damage of the first, and lot C8 was promised one message
 * at a time.
 *
 * It reads `>= MIN_SHEET_MM` and not `> 0`, because the floor it mirrors is
 * `sheetLengthSchema`'s, not zero: written `> 0` the whole band [0.0001, 1) slipped past
 * and a width of `0.5` produced the cascade again -- two issues, four for a `0.5 x 0.5`
 * sheet.
 *
 * And the two gates are SEPARATE rather than one conjunction, because a bad width is no
 * evidence about the margins of the other axis: written `width > 0 && height > 0`, a sheet
 * of width `0` with margins summing to 300 mm on a 297 mm height reported the width alone,
 * so the author fixed it, re-saved, and only then learnt the page had never been valid.
 * Vertical margins impossible at EVERY width are not collateral damage, and the test that
 * pins "two independent faults, not a cascade" says exactly that.
 *
 * What neither gate rescues: an ABANDONING issue skips this refinement entirely, while a
 * CONTINUABLE one does not. The rule is `too_small`/`too_big`/`custom` continue,
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
    header: PageBandsSchema,
    footer: PageBandsSchema,
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

/**
 * One direction only, and the other is unavailable: `z.array` infers a MUTABLE array
 * where the hand-written type is `readonly`, so mutual assignability is measurably
 * `false` and cannot be asserted -- unlike `TextSegment`, which carries no array and on
 * which `nodes.test.ts` does assert both directions.
 *
 * What this catches: a schema field whose output no longer satisfies the type.
 *
 * What it does NOT catch, stated because an earlier version of this docstring named a
 * remedy that does not work: a field added to the type and not to the schema. An OPTIONAL
 * one leaves this assertion at `true`, since an optional key is satisfied by absence -- and
 * the JSON round trip in `page.test.ts` cannot see it either, because `RECIPE_PAGE` is
 * annotated `PageSetup` and would never carry the new field. That is the *perte silencieuse*
 * of AGENTS.md 1.2, and the guard for it is the `keyof` pair, which compares KEY SETS and so
 * escapes the array variance that pins this assertion to one direction. The four pairs live
 * beside the other `*_KEYS_IN_STEP` of the repository, in `page/__tests__/page.test.ts`.
 *
 * Not exported by the package barrel: it is a compile-time assertion, not an API.
 */
export const PAGE_SETUP_SCHEMA_SATISFIES_TYPE: z.infer<typeof PageSetupSchema> extends PageSetup
  ? true
  : false = true;
