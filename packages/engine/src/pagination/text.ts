import type { MaterialRun, MaterialText } from '../document/types.js';
import { refusal } from '../errors.js';
import type { FragmentEdge, LineMetric, Metrics, TextCursor, TextFragment } from './types.js';
import { boxPaddingPx } from './types.js';

const START: TextCursor = { run: 0, offset: 0 };

const TOO_TALL =
  'A single visual line of a text block is taller than a whole page can offer it, so no cut of that block can ever be printed. Read `details.nodeId` for the declaration.';

/** A page marker occupies one position: before it, or after it. */
const runLength = (run: MaterialRun): number => (run.kind === 'text' ? run.text.length : 1);

const cursorAfterAll = (runs: readonly MaterialRun[]): TextCursor => {
  const last = runs.length - 1;
  const run = runs[last];
  return run === undefined ? START : { run: last, offset: runLength(run) };
};

/** The cursor a visual line starts at: the end of the line before it, or the start of the block. */
function cursorBefore(lines: readonly LineMetric[], index: number): TextCursor {
  const previous = lines[index - 1];
  return previous === undefined ? START : { run: previous.run, offset: previous.offset };
}

/** Extracts text runs spanning between two text cursors. */
export function sliceRuns(
  runs: readonly MaterialRun[],
  from: TextCursor,
  to: TextCursor,
): readonly MaterialRun[] {
  const sliced: MaterialRun[] = [];
  for (let index = from.run; index <= to.run && index < runs.length; index += 1) {
    const run = runs[index];
    if (run === undefined) {
      continue;
    }
    const start = index === from.run ? from.offset : 0;
    const end = index === to.run ? to.offset : runLength(run);
    if (end <= start) {
      continue;
    }
    if (run.kind === 'pageField') {
      sliced.push(run);
      continue;
    }
    sliced.push({ kind: 'text', text: run.text.slice(start, end), typography: run.typography });
  }
  return sliced;
}

const edgeOf = (first: boolean, last: boolean): FragmentEdge => {
  if (first) {
    return last ? 'whole' : 'first';
  }
  return last ? 'last' : 'middle';
};

/** Minimum line count for orphan and widow management. */
const MIN_LINES_PER_SIDE = 2;

/**
 * Determines text line cut points respecting widow and orphan line preferences.
 */
function keptLines(
  greedy: (room: number) => number,
  total: number,
  line: number,
  available: number,
  fresh: number,
): number | undefined {
  const end = greedy(available);
  if (end === total) {
    return end === line ? undefined : end;
  }
  if (end === line) {
    return undefined;
  }
  if (total - line < MIN_LINES_PER_SIDE * 2) {
    return end;
  }

  const bounded = (candidate: number): number => Math.min(candidate, total - MIN_LINES_PER_SIDE);
  const satisfied = (candidate: number): boolean =>
    candidate === total || bounded(candidate) >= line + MIN_LINES_PER_SIDE;

  if (satisfied(end)) {
    return bounded(end);
  }
  if (available >= fresh) {
    return end;
  }
  return satisfied(greedy(fresh)) ? undefined : end;
}

/** Result of placing a slice of visual text lines. */
export interface TextPlacement {
  readonly fragment: TextFragment;
  readonly height: number;
  /** Index of the next visual line, or `undefined` once the block is spent. */
  readonly nextLine: number | undefined;
}

/**
 * Slices a text block to fit available vertical room along visual line boundaries.
 */
export function sliceText(
  block: MaterialText,
  line: number,
  available: number,
  fresh: number,
  metrics: Metrics,
): TextPlacement | undefined {
  const padding = boxPaddingPx(block.box, metrics.pxPerMm);
  const lines = metrics.lines(block.key);
  if (lines.length === 0) {
    /* No line to cut between: an empty text block is atomic, like a rule or a spacer. */
    const height = metrics.height(block.key);
    if (height > fresh) {
      throw refusal(TOO_TALL, 'pagination-impossible', {
        nodeId: block.nodeId,
        path: block.declarationPath,
      });
    }
    if (height > available) {
      return undefined;
    }
    const whole = cursorAfterAll(block.runs);
    return {
      height,
      nextLine: undefined,
      fragment: {
        kind: 'text',
        source: block,
        runs: block.runs,
        from: START,
        to: whole,
        edge: 'whole',
      },
    };
  }

  const before = lines[line - 1]?.height ?? 0;
  const firstLine = lines[line];
  if (firstLine === undefined) {
    return undefined;
  }
  if (padding + (firstLine.height - before) > fresh) {
    throw refusal(TOO_TALL, 'pagination-impossible', {
      nodeId: block.nodeId,
      path: block.declarationPath,
    });
  }

  const greedy = (room: number): number => {
    let end = line;
    while (end < lines.length) {
      const candidate = lines[end];
      if (candidate === undefined || padding + (candidate.height - before) > room) {
        break;
      }
      end += 1;
    }
    return end;
  };

  const end = keptLines(greedy, lines.length, line, available, fresh);
  if (end === undefined) {
    return undefined;
  }

  const last = lines[end - 1];
  if (last === undefined) {
    return undefined;
  }
  const to: TextCursor = { run: last.run, offset: last.offset };
  const from = cursorBefore(lines, line);
  return {
    height: padding + (last.height - before),
    nextLine: end === lines.length ? undefined : end,
    fragment: {
      kind: 'text',
      source: block,
      runs: sliceRuns(block.runs, from, to),
      from,
      to,
      edge: edgeOf(line === 0, end === lines.length),
    },
  };
}
