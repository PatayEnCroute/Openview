import { MAX_SHEET_MM, MIN_SHEET_MM, type Sheet } from '@openview/core';
import { DocumentRenderError } from '@openview/engine';

/**
 * The sheet range this backend was measured against.
 *
 * Chromium honours the whole range the contract allows: probed at 1 mm, 5080 mm and all four
 * combinations of the two, the pdf page box came out at the declared size. The bounds are restated
 * here rather than assumed, so widening the contract without re-probing fails loudly instead of
 * producing a silently rescaled document.
 */
export const HONOURED_SHEET_MM = { min: MIN_SHEET_MM, max: MAX_SHEET_MM } as const;

/**
 * The pdf page box is quantised to 1/300 inch, so a declared size is honoured to within one
 * quantum. Callers comparing a printed page against its declaration need this tolerance; nothing in
 * the adapter rounds a dimension itself.
 */
export const SHEET_TOLERANCE_PT = 0.5;

const OUTSIDE_RANGE =
  'This backend has only been measured for sheets between the contract bounds, and it will not silently rescale one outside them. Read `details.limit` for the bound that was crossed.';

/** Refuses a sheet outside the range this backend was measured on, before anything is launched. */
export function assertHonouredSheet(sheet: Sheet): void {
  for (const length of [sheet.width, sheet.height]) {
    if (length < HONOURED_SHEET_MM.min) {
      throw new DocumentRenderError(OUTSIDE_RANGE, 'adapter-capability-mismatch', {
        limit: HONOURED_SHEET_MM.min,
      });
    }
    if (length > HONOURED_SHEET_MM.max) {
      throw new DocumentRenderError(OUTSIDE_RANGE, 'adapter-capability-mismatch', {
        limit: HONOURED_SHEET_MM.max,
      });
    }
  }
}
