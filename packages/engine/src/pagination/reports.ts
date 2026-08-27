import type { MaterialPageReport, OccurrenceKey } from '../document/types.js';
import { refusal } from '../errors.js';
import type { CellFragment, MaterialFragment, TableFragment } from './types.js';
import { wholeFragment } from './whole.js';

const NOT_FINITE =
  'The contributions a page carries forward add up to something that is not a finite number, so no page report can be written from them. Read `details.pageNumber` for the page involved; the values themselves are deliberately not repeated.';

/**
 * The contributions whose row FINISHED on this page, in the order the fragments carry them.
 *
 * A row that spans several pages is counted once, on the page carrying its last fragment: an amount
 * counted where the row started would be carried forward before the row it belongs to was printed.
 * A repeated header is never a source, and a set of keys makes a second visit of one occurrence
 * impossible.
 */
export function completedOn(fragments: readonly MaterialFragment[]): readonly MaterialPageReport[] {
  const found: MaterialPageReport[] = [];
  const seen = new Set<OccurrenceKey>();

  const cells = (list: readonly CellFragment[]): void => {
    for (const cell of list) {
      walk(cell.children);
    }
  };

  const table = (fragment: TableFragment): void => {
    /* `header` is the declared header, cloned onto every fragment that continues the table: reading
       it as a source would raise the report on each page with no new row of the body. */
    for (const row of fragment.rows) {
      const contribution = row.source.pageReport;
      if (
        contribution !== undefined &&
        (row.edge === 'whole' || row.edge === 'last') &&
        !seen.has(contribution.key)
      ) {
        seen.add(contribution.key);
        found.push(contribution);
      }
      /* Descended whatever the edge, not only on the finishing ones: a table nested in a cell has
         rows of its own, and one of them may finish here while the row holding it does not. */
      cells(row.cells);
    }
  };

  function walk(list: readonly MaterialFragment[]): void {
    for (const fragment of list) {
      if (fragment.kind === 'container') {
        walk(fragment.children);
      }
      if (fragment.kind === 'table') {
        table(fragment);
      }
      if (fragment.kind === 'grid') {
        /* A grid is atomic, so every zone -- and every contributing row inside one -- finishes on
           the page that holds the grid. */
        walk(fragment.source.items.map((item) => wholeFragment(item.content)));
      }
    }
  }

  walk(fragments);
  return found;
}

/** Adds the terms in the rank they were materialised at, and refuses a total that is not finite. */
function totalOf(carried: readonly MaterialPageReport[], pageNumber: number): number {
  const ordered = [...carried].sort((left, right) => left.order - right.order);
  let total = 0;
  for (const contribution of ordered) {
    total += contribution.value;
  }
  if (!Number.isFinite(total)) {
    throw refusal(NOT_FINITE, 'page-report-refused', { pageNumber });
  }
  return total;
}

/** One page's fragments, with the raw total the pages before it carry into them. */
export interface ReportedPage {
  readonly root: readonly MaterialFragment[];
  readonly incomingReport: number;
}

/**
 * Pairs each page fragment root with its incoming cumulative page report sum.
 */
export function withIncomingReports(
  roots: readonly (readonly MaterialFragment[])[],
): readonly ReportedPage[] {
  const reported: ReportedPage[] = [];
  const carried: MaterialPageReport[] = [];

  for (const [index, root] of roots.entries()) {
    reported.push({ root, incomingReport: index === 0 ? 0 : totalOf(carried, index + 1) });
    carried.push(...completedOn(root));
  }
  return reported;
}
