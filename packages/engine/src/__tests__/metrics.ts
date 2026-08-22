import { kindOf } from '@openview/core';
import type {
  MaterialBlock,
  MaterialDocument,
  MaterialRow,
  MaterialRun,
} from '../document/types.js';
import type { LineMetric, Metrics } from '../pagination/types.js';
import { boxPaddingPx } from '../pagination/types.js';
import { PX_PER_MM } from './fake-session.js';

/** A layout as regular as squared paper: fixed line height, fixed characters per line. */
export interface GridLayout {
  readonly lineHeight: number;
  readonly charsPerLine: number;
  /** Height of an image box, which the grid cannot derive from characters. */
  readonly imageHeight: number;
  readonly pxPerMm: number;
}

export const GRID: GridLayout = {
  lineHeight: 10,
  charsPerLine: 20,
  imageHeight: 40,
  pxPerMm: PX_PER_MM,
};

/** A page marker occupies one position, whatever digits it shows. */
const runLength = (run: MaterialRun): number => (run.kind === 'text' ? run.text.length : 1);

/**
 * Where a fixed-width font would break a block, as cursors into its own runs.
 *
 * The cursors are exact positions in the runs the engine holds, so slicing at them and
 * concatenating the slices restores the block: the grid is a stand-in for a browser, not a
 * different coordinate system.
 */
export function gridLines(runs: readonly MaterialRun[], grid: GridLayout): readonly LineMetric[] {
  const lines: LineMetric[] = [];
  let column = 0;
  let height = 0;
  const close = (run: number, offset: number): void => {
    height += grid.lineHeight;
    lines.push({ run, offset, height });
    column = 0;
  };
  for (const [index, run] of runs.entries()) {
    const length = runLength(run);
    for (let offset = 1; offset <= length; offset += 1) {
      const character = run.kind === 'text' ? run.text.at(offset - 1) : undefined;
      if (character === '\n') {
        close(index, offset);
        continue;
      }
      column += 1;
      if (column === grid.charsPerLine) {
        close(index, offset);
      }
    }
  }
  const last = runs.length - 1;
  const tail = runs[last];
  if (column > 0 && tail !== undefined) {
    close(last, runLength(tail));
  }
  return lines;
}

function rowHeight(row: MaterialRow, grid: GridLayout, into: Map<string, number>): number {
  const padding = boxPaddingPx(row.box, grid.pxPerMm);
  let tallest = 0;
  for (const cell of row.cells) {
    let stacked = 0;
    for (const child of cell.children) {
      stacked += blockHeight(child, grid, into);
    }
    into.set(cell.key, padding + stacked);
    tallest = Math.max(tallest, stacked);
  }
  const height = padding + tallest;
  into.set(row.key, height);
  return height;
}

function blockHeight(block: MaterialBlock, grid: GridLayout, into: Map<string, number>): number {
  const padding = boxPaddingPx(block.box, grid.pxPerMm);
  let height: number;
  switch (block.kind) {
    case 'text':
      height = padding + gridLines(block.runs, grid).length * grid.lineHeight;
      break;
    case 'image':
      height = padding + grid.imageHeight;
      break;
    case 'container': {
      let stacked = 0;
      for (const child of block.children) {
        stacked += blockHeight(child, grid, into);
      }
      height = padding + stacked;
      break;
    }
    case 'table': {
      let stacked = 0;
      for (const row of [...block.header, ...block.body, ...block.footer]) {
        stacked += rowHeight(row, grid, into);
      }
      height = padding + stacked;
      break;
    }
    default: {
      const exhaustive: never = block;
      throw new TypeError(`Unhandled materialised block: ${kindOf(exhaustive, 'kind')}`);
    }
  }
  into.set(block.key, height);
  return height;
}

/**
 * The metrics a squared-paper browser would return for this document.
 *
 * Every height is the sum the paginator would compute for the same boxes, so a test that fails is
 * a test about where the cut fell, never about the arithmetic underneath it.
 */
export function gridMetrics(
  document: MaterialDocument,
  overrides: Partial<GridLayout> = {},
): Metrics {
  const grid = { ...GRID, ...overrides };
  const heights = new Map<string, number>();
  const lines = new Map<string, readonly LineMetric[]>();
  const walk = (blocks: readonly MaterialBlock[]): void => {
    for (const block of blocks) {
      blockHeight(block, grid, heights);
      collectLines(block, grid, lines);
    }
  };
  for (const band of document.headerBands) {
    walk([band.content]);
  }
  walk(document.root);
  for (const band of document.footerBands) {
    walk([band.content]);
  }
  return {
    pxPerMm: grid.pxPerMm,
    height(key: string): number {
      const found = heights.get(key);
      if (found === undefined) {
        throw new Error(`the grid measured no box under ${key}`);
      }
      return found;
    },
    lines: (key: string) => lines.get(key) ?? [],
  };
}

function collectLines(
  block: MaterialBlock,
  grid: GridLayout,
  into: Map<string, readonly LineMetric[]>,
): void {
  switch (block.kind) {
    case 'text':
      into.set(block.key, gridLines(block.runs, grid));
      break;
    case 'image':
      break;
    case 'container':
      for (const child of block.children) {
        collectLines(child, grid, into);
      }
      break;
    case 'table':
      for (const row of [...block.header, ...block.body, ...block.footer]) {
        for (const cell of row.cells) {
          for (const child of cell.children) {
            collectLines(child, grid, into);
          }
        }
      }
      break;
    default: {
      const exhaustive: never = block;
      throw new TypeError(`Unhandled materialised block: ${kindOf(exhaustive, 'kind')}`);
    }
  }
}
