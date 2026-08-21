import type { PageBand, PageBandOccurrence } from '@openview/core';

/**
 * Which occurrences apply to a page that is the first page and the last one at once.
 *
 * `exceptFirst` and `exceptLast` both name a page this one is, so neither applies. The schema
 * forbids two applicable occurrences on the same side, which is what makes the choice unique.
 */
const APPLIES_TO_THE_ONLY_PAGE: Readonly<Record<PageBandOccurrence, boolean>> = {
  every: true,
  firstOnly: true,
  exceptFirst: false,
  exceptLast: false,
  lastOnly: true,
};

/** The single band of one side that applies to a one-page document, or none. */
export function bandOfTheOnlyPage(bands: readonly PageBand[]): PageBand | undefined {
  return bands.find((band) => APPLIES_TO_THE_ONLY_PAGE[band.on]);
}
