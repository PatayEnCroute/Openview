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
 * Collects contributing table rows that completed on this page.
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
        grid: (grid) => walk(grid.source.items.map((item) => wholeFragment(item.content))),
      });
    }
  };

  walk(fragments);
  return found;
}

const rankOf = (row: MaterialRow): number => row.pageReport?.order ?? 0;

const byContribution = (rows: readonly MaterialRow[]): readonly MaterialRow[] =>
  [...rows].sort((left, right) => rankOf(left) - rankOf(right));

function contributionsOf(rows: readonly MaterialRow[]): readonly MaterialPageReport[] {
  const carried: MaterialPageReport[] = [];
  for (const row of byContribution(rows)) {
    if (row.pageReport !== undefined) {
      carried.push(row.pageReport);
    }
  }
  return carried;
}

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
 * Computes the maximum possible cumulative report total magnitude across the document.
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

  blocks(document.root);
  return Number.isFinite(total) ? total : Number.MAX_VALUE;
}

/** Page fragments paired with incoming report value and completed rows. */
export interface ReportedPage {
  readonly root: readonly MaterialFragment[];
  readonly incomingReport: number;
  /** Contributing rows that finished on this page, ordered by report contribution rank. */
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
      completedBy: byContribution(completed),
    });
    carried.push(...completed);
  }
  return reported;
}
