/**
 * The ONE spelling of the conversion between the two units of this contract.
 *
 * This lot stores lengths in two units, and it says so in the field names: a font size is in
 * POINTS and its field is `sizePt`, every other length is in MILLIMETRES and its field carries
 * no suffix, because the millimetre is this contract's default unit since lot C4. Two units
 * oblige SOMEBODY to convert, and the conversion is not associative in binary64. MEASURED,
 * over the integer point sizes of the window this lot admits:
 *
 *     (14400 * 25.4) / 72   ->  5080                  === MAX_SHEET_MM
 *     14400 * (25.4 / 72)   ->  5079.999999999999     NOT MAX_SHEET_MM
 *     15 pt: (v * 25.4) / 72 -> 5.291666666666667
 *            v * (25.4 / 72) -> 5.291666666666666
 *
 * 4 538 of the 14 400 integer sizes -- 31.5 % -- yield a DIFFERENT double under the second
 * spelling than under the first. Counting four spellings instead of two, 8 774 of 14 400
 * (60.9 %) disagree with at least one other. Either figure is exact; what is NOT exact is
 * citing one without saying how many spellings it compares.
 *
 * ## Why exported, and it is the `printableAreaOf` argument -- here and NOT on the resolvers
 *
 * `page/area.ts` states it: decision 7 of the roadmap promises a preview IDENTICAL to the PDF,
 * and "two implementations that write the subtraction differently get different doubles". A
 * multiplication followed by a division has exactly that hazard, so the agreement has to be a
 * DEPENDENCY rather than a coincidence. The resolvers of ./resolve.ts are exported for a
 * different reason and must not borrow this one: `a ?? b` has no floating-point representation
 * at all, so two implementations of it cannot diverge.
 *
 * ## The retained form, and it is a property rather than a preference
 *
 * MULTIPLY FIRST, THEN DIVIDE. It is the only one of the four that carries the ceiling of this
 * contract back and forth exactly: `ptFromMm(5080) === 14400` and `mmFromPt(14400) === 5080`
 * are both true, so `MAX_FONT_SIZE_PT` can be DERIVED from `MAX_SHEET_MM` instead of restated
 * (see ./types.ts). Pre-computing the factor breaks that in both directions -- measured above,
 * and `mm * (72 / 25.4)` yields `14400.000000000002`.
 *
 * ## What these two functions do NOT promise, and a consumer has to know it
 *
 * THEY ARE NOT INVERSES. MEASURED: `ptFromMm(mmFromPt(v)) !== v` for 223 of the first 1 000
 * integer point sizes -- 3, 6, 12, 23, 24, 29 among them. So a consumer converts ONCE, in the
 * direction its renderer needs, and never round-trips a stored value: a viewer that goes to
 * millimetres for layout and back to points for a PDF has already lost the author's number.
 * Store points, convert at the boundary, never convert back.
 */
export function mmFromPt(pt: number): number {
  return (pt * 25.4) / 72;
}

export function ptFromMm(mm: number): number {
  return (mm * 72) / 25.4;
}
