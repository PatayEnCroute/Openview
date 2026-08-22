import type { PageBandOccurrence } from '@openview/core';
import type { MaterialPageBand } from './types.js';

/** Which page of a run of pages a band is being selected for. */
export const PAGE_ROLES = ['only', 'first', 'middle', 'last'] as const;

export type PageRole = (typeof PAGE_ROLES)[number];

/**
 * Which occurrences apply to each role a page can take.
 *
 * A one-page document is its own first and last page at once, so `exceptFirst` and `exceptLast`
 * both name a page it is and neither applies. The schema forbids two applicable occurrences on the
 * same side, which is what makes the choice unique rather than a priority to invent.
 */
const APPLIES: Readonly<Record<PageRole, Readonly<Record<PageBandOccurrence, boolean>>>> = {
  only: { every: true, firstOnly: true, exceptFirst: false, exceptLast: false, lastOnly: true },
  first: { every: true, firstOnly: true, exceptFirst: false, exceptLast: true, lastOnly: false },
  middle: { every: true, firstOnly: false, exceptFirst: true, exceptLast: true, lastOnly: false },
  last: { every: true, firstOnly: false, exceptFirst: true, exceptLast: false, lastOnly: true },
};

/** Whether an occurrence is painted on a page holding this role. */
export function bandApplies(on: PageBandOccurrence, role: PageRole): boolean {
  return APPLIES[role][on];
}

/** The role of page `number` in a run of `count` pages. */
export function pageRole(number: number, count: number): PageRole {
  if (count <= 1) {
    return 'only';
  }
  if (number === 1) {
    return 'first';
  }
  return number === count ? 'last' : 'middle';
}

/** The single band of one side that applies to a page holding this role, or none. */
export function bandForRole(
  bands: readonly MaterialPageBand[],
  role: PageRole,
): MaterialPageBand | undefined {
  return bands.find((band) => bandApplies(band.on, role));
}

/** Every role a document of `count` pages actually has. */
export function rolesOf(count: number): readonly PageRole[] {
  if (count <= 1) {
    return ['only'];
  }
  return count === 2 ? ['first', 'last'] : ['first', 'middle', 'last'];
}

/** The occurrences that can appear at least once in a document of `count` pages. */
export function reachableOccurrences(count: number): ReadonlySet<PageBandOccurrence> {
  const reachable = new Set<PageBandOccurrence>();
  for (const role of rolesOf(count)) {
    for (const [occurrence, applies] of Object.entries(APPLIES[role])) {
      if (applies) {
        reachable.add(occurrence as PageBandOccurrence);
      }
    }
  }
  return reachable;
}
