import { flowBlocks, rowsOf, walkBlocks } from '../document/traverse.js';
import type { MaterialBlock, MaterialDocument, MaterialRun } from '../document/types.js';
import { refusal } from '../errors.js';
import type { BlockCursor, FlowCursor, RowBlockCursor } from './types.js';

/** Minimum bound of at least one page. */
const AT_LEAST_ONE_PAGE = 1;

function runUnits(runs: readonly MaterialRun[]): number {
  let units = 0;
  for (const run of runs) {
    units += run.kind === 'text' ? run.text.length : 1;
  }
  return units;
}

/** Computes the count of discrete progression units in a block subtree. */
function unitsOf(blocks: readonly MaterialBlock[]): number {
  let units = 0;
  for (const block of walkBlocks(blocks)) {
    units += 1 + rowsOf(block).length;
    if (block.kind === 'text') {
      units += runUnits(block.runs);
    }
  }
  return units;
}

/**
 * Computes an upper bound on the total number of pages needed for a document.
 */
export function progressionBound(document: MaterialDocument): number {
  return Math.max(AT_LEAST_ONE_PAGE, unitsOf(flowBlocks(document)));
}

/** Computes the decimal digit count needed to represent a page bound. */
export function digitsOf(bound: number): number {
  return String(Math.trunc(bound)).length;
}

const NO_PROGRESS =
  'A page was composed without consuming anything from the flow, so the next page would repeat it forever. Read `details.pageNumber` for where the flow stopped advancing.';

function sameRow(left: RowBlockCursor, right: RowBlockCursor): boolean {
  return (
    left.cells.length === right.cells.length &&
    left.cells.every((cell, index) => {
      const other = right.cells[index];
      return other !== undefined && sameFlow(cell, other);
    })
  );
}

function sameBlock(left: BlockCursor, right: BlockCursor): boolean {
  if (left.kind === 'text' && right.kind === 'text') {
    return left.line === right.line;
  }
  if (left.kind === 'container' && right.kind === 'container') {
    return sameFlow(left.flow, right.flow);
  }
  if (left.kind === 'table' && right.kind === 'table') {
    if (left.row !== right.row) {
      return false;
    }
    if (left.inner === undefined || right.inner === undefined) {
      return left.inner === right.inner;
    }
    return sameRow(left.inner, right.inner);
  }
  return false;
}

/** Compares two flow cursors for equality. */
export function sameFlow(left: FlowCursor, right: FlowCursor): boolean {
  if (left.index !== right.index) {
    return false;
  }
  if (left.inner === undefined || right.inner === undefined) {
    return left.inner === right.inner;
  }
  return sameBlock(left.inner, right.inner);
}

/**
 * Asserts that pagination made forward progress between pages.
 */
export function assertAdvanced(before: FlowCursor, after: FlowCursor, pageNumber: number): void {
  if (sameFlow(before, after)) {
    throw refusal(NO_PROGRESS, 'pagination-impossible', { pageNumber });
  }
}
