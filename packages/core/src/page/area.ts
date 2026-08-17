import type { PageSetup, PrintableArea } from './types.js';

/**
 * The area a page leaves for content, in millimetres.
 *
 * This lives in the contract, not in each consumer, because decision 7 of the roadmap
 * promises a preview IDENTICAL to the PDF -- and `width - left - right` is not one
 * operation. MEASURED, on US Letter with one-inch margins:
 *
 *     215.9 - (25.4 + 25.4)  ->  165.10000000000002
 *     (215.9 - 25.4) - 25.4  ->  165.1
 *
 * Two implementations that write the subtraction differently get different doubles, and
 * the divergence appears exactly on the sheet the project needs for its English/dollars
 * criterion while staying invisible on A4 with whole margins (both give 180). One
 * exported function turns that agreement into a dependency -- the reason `nodeReads`
 * exists in ast/visitor.ts.
 *
 * The parenthesised form is the one retained, and the reason is a property rather than a
 * preference: `left + right === right + left` exactly, so the result cannot depend on
 * which margin an implementer names first. The sequential form has no such property --
 * MEASURED, `(229.61 - 38.59) - 33.3` is `157.72000000000003` and
 * `(229.61 - 33.3) - 38.59` is `157.72`.
 *
 * It returns two lengths and NO origin: `{ x, y }` would impose an origin convention
 * (which corner, which axis direction) that nothing in the contract fixes and that lot
 * C11 may want to fix differently. And it does not subtract band heights -- the contract
 * measures none, so an area claiming to account for the header would be false.
 *
 * What it does NOT promise: identity at the PIXEL. It returns a number exact in the
 * IEEE-754 sense, and two consumers that quantise it differently -- to the screen pixel,
 * to the PDF point -- can still diverge. Verifying decision 7 itself is lot V3's.
 */
export function printableAreaOf(page: PageSetup): PrintableArea {
  const { sheet, margins } = page;
  return {
    width: sheet.width - (margins.left + margins.right),
    height: sheet.height - (margins.top + margins.bottom),
  };
}
