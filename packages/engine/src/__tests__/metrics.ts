import { documentAreas, rowsOf, visitBlock, walkBlocks } from '../document/traverse.js';
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
  const stack = (blocks: readonly MaterialBlock[]): number => {
    let stacked = 0;
    for (const child of blocks) {
      stacked += blockHeight(child, grid, into);
    }
    return stacked;
  };
  const height = visitBlock<number>(block, {
    text: (text) => padding + gridLines(text.runs, grid).length * grid.lineHeight,
    image: () => padding + grid.imageHeight,
    container: (container) => padding + stack(container.children),
    table: (table) => {
      let stacked = 0;
      for (const row of rowsOf(table)) {
        stacked += rowHeight(row, grid, into);
      }
      return padding + stacked;
    },
    /* Fully declared: rows times step, whatever the zone contents measure. The contents are still
       walked so their own boxes have heights when a test reads them. */
    grid: (zone) => {
      stack(zone.items.map((item) => item.content));
      return padding + zone.rows * zone.step * grid.pxPerMm;
    },
  });
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
  for (const { blocks } of documentAreas(document)) {
    for (const block of blocks) {
      blockHeight(block, grid, heights);
    }
    for (const block of walkBlocks(blocks)) {
      if (block.kind === 'text') {
        lines.set(block.key, gridLines(block.runs, grid));
      }
    }
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
