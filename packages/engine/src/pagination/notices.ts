import type { OccurrenceReference, PaginationNotice } from '@openview/core';
import { addressKey, occurrenceOf } from '../document/occurrence.js';
import type { MaterialFragment, PaginatedDocument, RowFragment } from './types.js';
import { visitFragment } from './visit.js';

/** One marked occurrence and the pages the accepted sequence really painted it on. */
interface Spread {
  readonly occurrence: OccurrenceReference;
  readonly pages: number[];
}

/** Records that a marked occurrence was painted on this page, once per page. */
function seen(spreads: Map<string, Spread>, source: OccurrenceReference, page: number): void {
  const at = addressKey(source);
  const found = spreads.get(at);
  if (found === undefined) {
    spreads.set(at, { occurrence: occurrenceOf(source), pages: [page] });
    return;
  }
  if (found.pages.at(-1) !== page) {
    found.pages.push(page);
  }
}

function markedRow(spreads: Map<string, Spread>, row: RowFragment, page: number): void {
  if (row.source.keepTogether) {
    seen(spreads, row.source, page);
  }
  /* A marked group owns no box of its own, so it is recognised through the rows that point at it
     and reported under the group's own address rather than once per row. */
  if (row.source.keptGroup !== undefined) {
    seen(spreads, row.source.keptGroup, page);
  }
}

function collect(
  spreads: Map<string, Spread>,
  fragments: readonly MaterialFragment[],
  page: number,
): void {
  for (const fragment of fragments) {
    if (fragment.source.keepTogether) {
      seen(spreads, fragment.source, page);
    }
    visitFragment(fragment, {
      text: () => undefined,
      image: () => undefined,
      grid: () => undefined,
      container: (container) => {
        collect(spreads, container.children, page);
      },
      table: (table) => {
        /* The repeated header is a copy, never a fallback: only the rows this page really carries
           can tell whether a marked group or row was spread. */
        for (const row of table.rows) {
          markedRow(spreads, row, page);
          for (const cell of row.cells) {
            collect(spreads, cell.children, page);
          }
        }
      },
    });
  }
}

/**
 * The keep-together marks the accepted sequence could not honour, in order of first appearance.
 *
 * Derived from the settled pages and from nothing else: a fallback that happened during a settling
 * round the engine then abandoned left no trace here, because that sequence is not the one read.
 * Spanning more than one page IS the fallback -- an occurrence that fits stays whole, and one that
 * was merely deferred is painted whole on the page it moved to.
 */
export function noticesOf(paginated: PaginatedDocument): readonly PaginationNotice[] {
  const spreads = new Map<string, Spread>();
  for (const page of paginated.pages) {
    /* The flow alone: a band and a layer are painted whole on every page their domain names, so no
       mark inside one can fall back. */
    collect(spreads, page.root, page.number);
  }
  const notices: PaginationNotice[] = [];
  for (const spread of spreads.values()) {
    if (spread.pages.length > 1) {
      notices.push({
        code: 'keep-together-fallback',
        occurrence: spread.occurrence,
        pages: spread.pages,
      });
    }
  }
  return notices;
}
