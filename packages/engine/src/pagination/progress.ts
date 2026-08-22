import { kindOf } from '@openview/core';
import type {
  MaterialBlock,
  MaterialDocument,
  MaterialRow,
  MaterialRun,
} from '../document/types.js';
import { refusal } from '../errors.js';
import type { BlockCursor, FlowCursor, RowBlockCursor } from './types.js';

/** A document with nothing in it still produces one page, so the bound is never zero. */
const AT_LEAST_ONE_PAGE = 1;

function runUnits(runs: readonly MaterialRun[]): number {
  let units = 0;
  for (const run of runs) {
    /* A visual line holds at least one code unit, so characters bound the lines a text can be cut
       into. A marker is one atomic position. */
    units += run.kind === 'text' ? run.text.length : 1;
  }
  return units;
}

function rowUnits(rows: readonly MaterialRow[]): number {
  let units = 0;
  for (const row of rows) {
    units += 1;
    for (const cell of row.cells) {
      units += blockUnits(cell.children);
    }
  }
  return units;
}

function blockUnits(blocks: readonly MaterialBlock[]): number {
  let units = 0;
  for (const block of blocks) {
    switch (block.kind) {
      case 'text':
        units += 1 + runUnits(block.runs);
        break;
      case 'image':
        units += 1;
        break;
      case 'container':
        units += 1 + blockUnits(block.children);
        break;
      case 'table':
        units += 1 + rowUnits(block.header) + rowUnits(block.body) + rowUnits(block.footer);
        break;
      default: {
        const exhaustive: never = block;
        throw new TypeError(`Unhandled materialised block: ${kindOf(exhaustive, 'kind')}`);
      }
    }
  }
  return units;
}

/**
 * How many pages this document can possibly need.
 *
 * Every page that is kept has consumed at least one progression unit -- a character of bound text,
 * an atomic block or a structural position -- so the count of those units bounds the count of
 * pages. Computed before any measurement, because the width reserved for a page marker depends on
 * how many digits a page number can reach and that width in turn changes where the cuts fall.
 */
export function progressionBound(document: MaterialDocument): number {
  let units = blockUnits(document.root);
  for (const band of [...document.headerBands, ...document.footerBands]) {
    units += blockUnits([band.content]);
  }
  return Math.max(AT_LEAST_ONE_PAGE, units);
}

/** How many decimal digits the largest reachable page number writes. */
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

/** Whether two cursors name the same position, which is what a page must never leave unchanged. */
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
 * Refuses a page that left the flow cursor exactly where it found it.
 *
 * This is the whole termination argument: a finite number of progression units, and a strict
 * advance per kept page. No pass counter and no time limit stand in for it.
 */
export function assertAdvanced(before: FlowCursor, after: FlowCursor, pageNumber: number): void {
  if (sameFlow(before, after)) {
    throw refusal(NO_PROGRESS, 'pagination-impossible', { pageNumber });
  }
}
