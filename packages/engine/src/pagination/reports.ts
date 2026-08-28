import type {
  MaterialBlock,
  MaterialDocument,
  MaterialPageReport,
  MaterialRow,
} from '../document/types.js';
import { refusal } from '../errors.js';
import type { CellFragment, MaterialFragment, TableFragment } from './types.js';
import { visitFragment } from './visit.js';
import { wholeFragment } from './whole.js';

const NOT_FINITE =
  'The contributions a page carries forward add up to something that is not a finite number, so no page report can be written from them. Read `details.pageNumber` for the page involved; the values themselves are deliberately not repeated.';

/**
 * The contributing rows that FINISHED on this page, in the order the fragments carry them.
 *
 * A row that spans several pages is counted once, on the page carrying its last fragment: an amount
 * counted where the row started would be carried forward before the row it belongs to was printed.
 * A repeated header is never a source, and a set of keys makes a second visit of one occurrence
 * impossible.
 */
export function completedOn(fragments: readonly MaterialFragment[]): readonly MaterialRow[] {
  const found: MaterialRow[] = [];
  const seen = new Set<string>();

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
        found.push(row.source);
      }
      /* Descended whatever the edge, not only on the finishing ones: a table nested in a cell has
         rows of its own, and one of them may finish here while the row holding it does not. */
      cells(row.cells);
    }
  };

  const walk = (list: readonly MaterialFragment[]): void => {
    for (const fragment of list) {
      visitFragment(fragment, {
        text: () => undefined,
        image: () => undefined,
        container: (container) => walk(container.children),
        table,
        /* A grid is atomic, so every zone -- and every contributing row inside one -- finishes on
           the page that holds the grid. */
        grid: (grid) => walk(grid.source.items.map((item) => wholeFragment(item.content))),
      });
    }
  };

  walk(fragments);
  return found;
}

const rankOf = (row: MaterialRow): number => row.pageReport?.order ?? 0;

/** The same rows, ranked the way they were materialised rather than the way a page walks them. */
const byContribution = (rows: readonly MaterialRow[]): readonly MaterialRow[] =>
  [...rows].sort((left, right) => rankOf(left) - rankOf(right));

/** The contributions the rows carry, in the rank they were materialised at. */
function contributionsOf(rows: readonly MaterialRow[]): readonly MaterialPageReport[] {
  const carried: MaterialPageReport[] = [];
  for (const row of byContribution(rows)) {
    if (row.pageReport !== undefined) {
      carried.push(row.pageReport);
    }
  }
  return carried;
}

/** Adds the terms in the rank they were materialised at, and refuses a total that is not finite. */
function totalOf(carried: readonly MaterialRow[], pageNumber: number): number {
  let total = 0;
  for (const contribution of contributionsOf(carried)) {
    total += contribution.value;
  }
  if (!Number.isFinite(total)) {
    throw refusal(NOT_FINITE, 'page-report-refused', { pageNumber });
  }
  return total;
}

/**
 * The largest absolute value any incoming page report of this document can reach.
 *
 * The saturated sum of the ABSOLUTE contributions. Every page carries forward some subset of the
 * contributions that finished before it, and the absolute value of any such subset sum is bounded
 * by this one whatever cancels out inside it -- which is what lets a marker reserve its width once,
 * before the cuts that decide the subsets exist.
 *
 * Saturating at `Number.MAX_VALUE` stays safe: the bound only grows, so a document whose amounts
 * overflow asks for an absurd reserve and is refused, never quietly cropped.
 */
export function reportMagnitudeBound(document: MaterialDocument): number {
  let total = 0;

  const rows = (list: readonly MaterialRow[]): void => {
    for (const row of list) {
      if (row.pageReport !== undefined) {
        total += Math.abs(row.pageReport.value);
      }
      for (const cell of row.cells) {
        blocks(cell.children);
      }
    }
  };

  function blocks(list: readonly MaterialBlock[]): void {
    for (const block of list) {
      if (block.kind === 'container') {
        blocks(block.children);
      }
      if (block.kind === 'table') {
        rows(block.header);
        rows(block.body);
        rows(block.footer);
      }
      if (block.kind === 'grid') {
        for (const item of block.items) {
          blocks([item.content]);
        }
      }
    }
  }

  /* The flow alone: a contribution declared inside a band or a layer is refused at binding, since
     the occurrence it would be counted on does not exist. */
  blocks(document.root);
  return Number.isFinite(total) ? total : Number.MAX_VALUE;
}

/**
 * One page's fragments, the raw total the pages before it carry in, and what closed the boundary.
 *
 * Both facts come from the same walk on purpose: the sum a marker writes and the rows a caller is
 * told about it can never name two different sets of contributions.
 */
export interface ReportedPage {
  readonly root: readonly MaterialFragment[];
  readonly incomingReport: number;
  /** The contributing rows whose occurrence FINISHED on this page, in contribution order. */
  readonly completedBy: readonly MaterialRow[];
}

/**
 * Pairs each page fragment root with its incoming cumulative page report sum.
 */
export function withIncomingReports(
  roots: readonly (readonly MaterialFragment[])[],
): readonly ReportedPage[] {
  const reported: ReportedPage[] = [];
  const carried: MaterialRow[] = [];

  for (const [index, root] of roots.entries()) {
    const completed = completedOn(root);
    reported.push({
      root,
      incomingReport: index === 0 ? 0 : totalOf(carried, index + 1),
      /* Ranked, not left in walk order: a table nested in a cell finishes rows out of the order the
         enclosing flow visits them, and what a caller reads must be the order the sum used. */
      completedBy: byContribution(completed),
    });
    carried.push(...completed);
  }
  return reported;
}
