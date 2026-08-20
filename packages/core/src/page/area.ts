import type { PageSetup, PrintableArea } from './types.js';

/**
 * Calculates the usable printable area of a page from sheet dimensions and margins.
 */
export function printableAreaOf(page: PageSetup): PrintableArea {
  const { sheet, margins } = page;
  return {
    width: sheet.width - (margins.left + margins.right),
    height: sheet.height - (margins.top + margins.bottom),
  };
}
