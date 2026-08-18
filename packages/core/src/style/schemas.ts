import { z } from 'zod/v4';
// `../page/types.js` and NOT the `page/page.js` barrel, for the measured ESM reason
// {@link MAX_FONT_SIZE_PT} records: `ast/schemas.ts` imports this file as a VALUE, and the
// barrel closes a cycle back into it. `page/types.js` has no runtime import of its own.
import { MAX_SHEET_MM } from '../page/types.js';
import { MAX_FONT_SIZE_PT, MIN_FONT_SIZE_PT } from './types.js';

const EMPTY_STYLE_MESSAGE = 'An empty style object is not a style; omit the field';

/**
 * Refuses a style object that declares nothing. The one spelling of "no style" is the ABSENT
 * FIELD, and this is what keeps it the only one.
 *
 * ## Why `.check` and not `.refine`, and it is a MEASURED correction rather than a preference
 *
 * A `.refine` on the object was the obvious spelling, and it is WRONG here for a reason that
 * only a measurement shows. The predicate receives the object's OUTPUT, and an OPTIONAL field
 * that failed its own check is DROPPED from that output -- so a document declaring exactly one
 * thing, badly, arrives at the predicate as an empty object. MEASURED, on `{ color: 'red' }`:
 *
 *     [["invalid_format",["color"],"A colour is six hexadecimal digits ..."],
 *      ["custom",[],"An empty style object is not a style; omit the field"]]
 *
 * TWO issues for ONE fault, the second one FALSE -- the author did declare a colour -- and its
 * path EMPTY, which is precisely the defect for which `z.strictObject` was refused. It happens
 * on every continuable fault (`invalid_format`, `too_small`, `too_big`) and not on an aborting
 * one (`invalid_type`), so it is invisible in half the cases, which is worse than systematic.
 *
 * The remedy is not a different predicate, it is the CUT-OFF RULE this repository already
 * states and already measured, in `checkTableWiring`: the rows are walked only when the column
 * list itself is sound, because "an author who has one thing to fix must be told once, and lot
 * C8 has to be able to say it once" -- measured there at 13 issues instead of 1. Read here: an
 * object is only asked whether it is EMPTY once nothing else has gone wrong with it. `.check`
 * is the one zod 4 form that can see that, because its payload carries `issues` beside `value`.
 *
 * It is NOT a `superRefine` and NOT cross-field: it looks at ONE object, never at a sibling or
 * an ancestor, and it yields `code: 'custom'`, which is not an entry in `SHAPE_ERROR_CODES`. So
 * the line lot C4 held -- zero new error code, zero new site -- holds here too.
 *
 * ## Two properties of the predicate that are decisions
 *
 * ON VALUES, NOT ON `Object.keys`. Under `exactOptionalPropertyTypes` an in-memory object can
 * carry a key whose value is `undefined`: the key is present, the value is not, and a key count
 * yields one. That would be a THIRD spelling of "no style", introduced by the guard that exists
 * to leave one. A JSON round trip erases the difference -- `JSON.stringify` drops `undefined` --
 * but an editor comparing objects it built itself never goes through JSON.
 *
 * A widened `object` payload rather than a per-shape one: this runs on three different object
 * schemas, and `Object.values` is all it needs.
 *
 * ## The fragility, named rather than discovered
 *
 * A check borne by the OBJECT survives neither `.extend()` nor `.pick()` in zod 4, measured.
 * None of the three schemas below is extended or narrowed anywhere in this repository, and that
 * is now a WRITING CONSTRAINT rather than a happy accident: a later lot calling one of those
 * methods would lose this guard IN SILENCE. If an arbitration ever introduces an invariant, it
 * goes on the FIELD schema, never on the object.
 */
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
 * The Zod side of the appearance contract.
 *
 * ## NO SCHEMA IN THIS FILE CARRIES A `z.ZodType<T>` ANNOTATION. Do not add one
 *
 * The obligatory pattern of AGENTS.md 1.2 targets the RECURSIVE AST, and only it. None of
 * these schemas is recursive, so an annotation buys nothing -- and MEASURED, twice and
 * independently, it DESTROYS the only compile-time guard this lot has: annotating
 * `TypographySchema` as `z.ZodType<Typography>` AND amputating `italic` from the object
 * compiles at EXIT 0. Every key assertion passes, `keyof` included, because `z.infer` of an
 * annotated schema yields the ANNOTATION, so its key set IS the type's by construction.
 *
 * `ast/schemas.ts` already writes the same warning for `TextSegmentSchema`, from the other end:
 * "`z.ZodType` is covariant in its output, so a schema that produces LESS than `TextSegment`
 * stays assignable and still compiles."
 *
 * The real guard is the pair of assertions per shape in `style/__tests__/style.test.ts`, plus
 * one runtime round trip per style field. NOT in this file: an assertion living in `src/` is
 * shipped in `dist`, becomes a compatibility commitment, and inflates the coverage metric --
 * an exported `true` is a covered statement for zero runtime assertion, which is literally the
 * tautological test AGENTS.md 5 forbids.
 *
 * ## `z.object` and not `z.strictObject`, with the price named
 *
 * An unknown key is STRIPPED, not refused. MEASURED, that is what makes a version stamp the
 * only protection against silent loss ACROSS versions -- and it leaves the loss WITHIN a
 * version unprotected, which is the price. `z.strictObject` was measured and refused for a
 * reason lot C8 would have paid: its refusal reports an EMPTY path, so the offending key is
 * only in `keys` and in the message, and a catalogue of errors built on paths could not point
 * at it.
 *
 * ## Every refusal here is decidable at SAVE TIME and WITHOUT DATA
 *
 * A malformed colour, a size out of window, a negative length, an edge with no colour, an
 * incomplete padding, an empty style object: none of them needs a render or a dataset. So this
 * lot adds NO entry to `errors.ts` -- no new code and no new site -- which is the line lot C4
 * held for the same reason. `ast/schemas.ts` states it for a column: "it is refused when the
 * template is SAVED and adds no entry to the error catalogue lot C8 enumerates."
 *
 * The three {@link refuseEmptyStyle} checks below do not breach that line, and the argument is
 * written once, on that function, rather than restated here: two copies of one motive drift.
 *
 * The counterpart, said rather than hidden: THIS CONTRACT CARRIES ZERO CROSS-FIELD INVARIANT,
 * where lot C4 carried two. Refusing a non-canonical FORM is not checking a coherence BETWEEN
 * fields, so its refusal surface stays weaker than C4's. That is not a virtue, it is a
 * consequence of every field being optional, and ADR 0007 records it.
 */
export const ColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'A colour is six hexadecimal digits behind a hash, as #1b3a6f');

/**
 * Any length of this lot WHOSE ABSENCE IS NOT REPRESENTABLE, in millimetres: floor of zero,
 * ceiling shared with the sheet. In practice, the four edges of a {@link BoxSpacing}.
 *
 * The floor mirrors `marginLengthSchema` exactly -- at least zero, not greater than zero -- and
 * for the same reason: those four edges are REQUIRED, so zero is the one spelling of "no
 * inset", and refusing it would forbid a legitimate document. {@link BorderEdgeSchema} does not
 * use this schema, and the asymmetry is the whole point: its edges are OPTIONAL, so absence is
 * already a spelling there and zero would be a second one.
 *
 * The ceiling is `MAX_SHEET_MM`, IMPORTED. A padding larger than any sheet this product admits
 * is refused by the same number that refuses the sheet, and raising one raises both.
 *
 * Not exported: it is an internal spelling, and exporting it would publish a fourth length
 * vocabulary beside `sheetLengthSchema`, `marginLengthSchema` and the column weight.
 */
const styleLengthMmSchema = z
  .number()
  .min(0, 'A length cannot be negative')
  .max(MAX_SHEET_MM, `A length is at most ${MAX_SHEET_MM} mm`);

/**
 * `family` is a non-empty string and nothing more, and the reason is in
 * {@link Typography.family}: refusing the string `serif` would refuse a font genuinely called
 * "Serif".
 *
 * `sizePt` carries no decimal-place check, on the precedent `page/schemas.ts` applies:
 * finiteness and two bounds suffice. `z.number()` refuses `NaN` and `Infinity` on its own, so a
 * `.finite()` check would never fire -- but the MESSAGE it yields for `Infinity` is
 * "Invalid input: expected number, received number", which is unusable. Six numeric positions
 * of this lot inherit that defect (`sizePt`, the four edges of a spacing, the width of a border
 * edge); it is a reserve already booked to lot C8 by ADR 0006, and this lot COUNTS its sites
 * rather than pointing at the precedent.
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
 * `width` must be POSITIVE and not merely non-negative: an absent edge is the one spelling of
 * "no rule", and a zero thickness would be a second. The message carries its remedy. See
 * {@link BorderEdge} for why the `PageMargins` precedent -- whose four edges are REQUIRED --
 * does not transpose.
 *
 * `color` is required for the reason {@link BorderEdge} states: an edge with no colour is not a
 * lighter declaration, it is an incomplete one.
 */
export const BorderEdgeSchema = z.object({
  width: z
    .number()
    .gt(0, 'A rule has a positive width; omit the edge to declare no rule')
    .max(MAX_SHEET_MM, `A length is at most ${MAX_SHEET_MM} mm`),
  color: ColorSchema,
});

export const BoxBorderSchema = z
  .object({
    top: BorderEdgeSchema.optional(),
    right: BorderEdgeSchema.optional(),
    bottom: BorderEdgeSchema.optional(),
    left: BorderEdgeSchema.optional(),
  })
  .check(refuseEmptyStyle);

/** All four required, so zero IS the one spelling of "no inset" here -- see {@link BoxSpacing}. */
export const BoxSpacingSchema = z.object({
  top: styleLengthMmSchema,
  right: styleLengthMmSchema,
  bottom: styleLengthMmSchema,
  left: styleLengthMmSchema,
});

export const BoxStyleSchema = z
  .object({
    background: ColorSchema.optional(),
    border: BoxBorderSchema.optional(),
    padding: BoxSpacingSchema.optional(),
  })
  .check(refuseEmptyStyle);
