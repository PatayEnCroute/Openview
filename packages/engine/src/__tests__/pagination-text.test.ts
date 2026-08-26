import { describe, expect, it } from 'vitest';
import type { MaterialRun, MaterialText } from '../document/types.js';
import { sliceRuns, sliceText } from '../pagination/text.js';
import type { Metrics, TextFragment } from '../pagination/types.js';
import {
  gridPage,
  literalText,
  materializedOf,
  paginateOnGrid,
  refusalOfCut,
  textPerPage,
} from './fixtures.js';
import { GRID, gridLines, gridMetrics } from './metrics.js';

const flow = (children: readonly Record<string, unknown>[]): Record<string, unknown> => ({
  root: { type: 'container', id: 'root', children },
});

const lines = (count: number): string =>
  Array.from({ length: count }, (_unused, index) => `line${String(index).padStart(15, '.')}`).join(
    '',
  );

/** The single text block of a one-block document, with the metrics of the grid beside it. */
function textOf(content: readonly Record<string, unknown>[]): {
  block: MaterialText;
  metrics: Metrics;
} {
  const document = materializedOf(
    { page: gridPage(40), ...flow([{ type: 'text', id: 't', content }]) },
    {},
  );
  const [container] = document.root;
  const block = container?.kind === 'container' ? container.children[0] : undefined;
  if (block?.kind !== 'text') {
    throw new Error('the fixture does not hold a text block');
  }
  return { block, metrics: gridMetrics(document) };
}

const written = (fragment: TextFragment): string =>
  fragment.runs.map((run) => (run.kind === 'text' ? run.text : `<${run.field}>`)).join('');

describe('slicing runs between two cursors', () => {
  const runs: readonly MaterialRun[] = [
    { kind: 'text', text: 'alpha', typography: GRID_TYPOGRAPHY() },
    { kind: 'pageField', field: 'number', typography: GRID_TYPOGRAPHY() },
    { kind: 'text', text: 'omega', typography: GRID_TYPOGRAPHY() },
  ];

  function GRID_TYPOGRAPHY() {
    return { family: 'sans-serif', sizePt: 10, bold: false, italic: false, color: '#000000' };
  }

  it('keeps every character of a slice that spans several runs', () => {
    const sliced = sliceRuns(runs, { run: 0, offset: 2 }, { run: 2, offset: 3 });
    expect(sliced.map((run) => (run.kind === 'text' ? run.text : '#'))).toStrictEqual([
      'pha',
      '#',
      'ome',
    ]);
  });

  it('treats a marker as one position, present or absent as a whole', () => {
    expect(sliceRuns(runs, { run: 1, offset: 0 }, { run: 1, offset: 1 })).toHaveLength(1);
    expect(sliceRuns(runs, { run: 1, offset: 1 }, { run: 2, offset: 0 })).toStrictEqual([]);
  });

  it('drops nothing and invents nothing when the slice is the whole block', () => {
    const whole = sliceRuns(runs, { run: 0, offset: 0 }, { run: 2, offset: 5 });
    expect(whole).toHaveLength(3);
    expect(whole[0]).toStrictEqual(runs[0]);
    expect(whole[1]).toBe(runs[1]);
  });

  it('keeps the typography of each run rather than merging them', () => {
    const bold = { ...GRID_TYPOGRAPHY(), bold: true };
    const mixed: readonly MaterialRun[] = [
      { kind: 'text', text: 'plain', typography: GRID_TYPOGRAPHY() },
      { kind: 'text', text: 'heavy', typography: bold },
    ];
    const sliced = sliceRuns(mixed, { run: 0, offset: 3 }, { run: 1, offset: 2 });
    expect(
      sliced.map((run) => (run.kind === 'text' ? run.typography.bold : undefined)),
    ).toStrictEqual([false, true]);
  });

  it('yields nothing for a slice that starts past the runs it was given', () => {
    expect(sliceRuns(runs, { run: 9, offset: 0 }, { run: 9, offset: 1 })).toStrictEqual([]);
  });
});

describe('the visual lines the grid reports', () => {
  it('closes a line on a newline and on the width of the column alike', () => {
    const runs: readonly MaterialRun[] = [
      {
        kind: 'text',
        text: 'ab\ncd',
        typography: { family: 'x', sizePt: 10, bold: false, italic: false, color: '#000000' },
      },
    ];
    expect(gridLines(runs, GRID)).toStrictEqual([
      { run: 0, offset: 3, height: 10 },
      { run: 0, offset: 5, height: 20 },
    ]);
  });

  it('reports no line for a block with no character at all', () => {
    expect(gridLines([], GRID)).toStrictEqual([]);
  });

  it('paints a block with no run at all as one empty fragment', () => {
    const paginated = paginateOnGrid(
      materializedOf({ page: gridPage(4), ...flow([{ type: 'text', id: 't', content: [] }]) }, {}),
    );
    expect(paginated.pages).toHaveLength(1);
    expect(textPerPage(paginated, 't')).toStrictEqual(['']);
  });
});

describe('the longest run of lines that fits', () => {
  it('takes every line it can and stops at the first that does not', () => {
    const { block, metrics } = textOf([{ kind: 'literal', text: lines(5) }]);
    const placed = sliceText(block, 0, 25, 100, metrics);
    expect(placed?.height).toBe(20);
    expect(placed?.nextLine).toBe(2);
    expect(placed?.fragment.edge).toBe('first');
    expect(written(placed?.fragment ?? emptyFragment(block))).toBe(lines(5).slice(0, 40));
  });

  it('starts the next fragment exactly where the one before it stopped', () => {
    const { block, metrics } = textOf([{ kind: 'literal', text: lines(4) }]);
    const first = sliceText(block, 0, 20, 100, metrics);
    const second = sliceText(block, first?.nextLine ?? 0, 100, 100, metrics);
    expect(first?.fragment.to).toStrictEqual(second?.fragment.from);
    expect(
      written(first?.fragment ?? emptyFragment(block)) +
        written(second?.fragment ?? emptyFragment(block)),
    ).toBe(lines(4));
    expect(second?.fragment.edge).toBe('last');
    expect(second?.nextLine).toBeUndefined();
  });

  it('places nothing when not even one line fits in the room that is left', () => {
    const { block, metrics } = textOf([{ kind: 'literal', text: lines(3) }]);
    expect(sliceText(block, 0, 5, 100, metrics)).toBeUndefined();
  });

  it('places nothing when the cursor is already past the last line', () => {
    const { block, metrics } = textOf([{ kind: 'literal', text: lines(2) }]);
    expect(sliceText(block, 2, 100, 100, metrics)).toBeUndefined();
  });

  it('refuses a line taller than any page can offer, and names the declaration', () => {
    const { block, metrics } = textOf([{ kind: 'literal', text: lines(3) }]);
    const refused = refusalOfCut(() => sliceText(block, 0, 5, 5, metrics));
    expect(refused.code).toBe('pagination-impossible');
    expect(refused.details.nodeId).toBe('t');
  });

  it('treats a block with no line as atomic, and refuses it when no page holds it', () => {
    const { block, metrics } = textOf([]);
    const whole = sliceText(block, 0, 100, 100, metrics);
    expect(whole?.fragment.edge).toBe('whole');
    expect(whole?.nextLine).toBeUndefined();
    expect(whole?.height).toBe(0);
  });

  it('charges the padding of the block to every fragment it is cut into', () => {
    const padded = materializedOf(
      {
        page: gridPage(40),
        ...flow([
          {
            type: 'text',
            id: 't',
            box: { padding: { top: 1, right: 0, bottom: 1, left: 0 } },
            content: [{ kind: 'literal', text: lines(4) }],
          },
        ]),
      },
      {},
    );
    const [container] = padded.root;
    const block = container?.kind === 'container' ? container.children[0] : undefined;
    if (block?.kind !== 'text') {
      throw new Error('the fixture does not hold a text block');
    }
    const metrics = gridMetrics(padded);
    const padding = 2 * GRID.pxPerMm;
    /* Two lines on each side: a four-line block cut one-and-three would leave an orphan, and the
       preference would move the whole block rather than charge the padding twice for one line. */
    const one = sliceText(block, 0, padding + 20, 100, metrics);
    expect(one?.height).toBeCloseTo(padding + 20, 6);
    const rest = sliceText(block, 2, padding + 20, 100, metrics);
    expect(rest?.height).toBeCloseTo(padding + 20, 6);
  });
});

describe('a text cut across pages', () => {
  it('restores every character in order, with no seam invented', () => {
    const whole = lines(7);
    const paginated = paginateOnGrid(
      materializedOf({ page: gridPage(2), ...flow([literalText('t', whole)]) }, {}),
    );
    const pieces = textPerPage(paginated, 't');
    expect(pieces).toHaveLength(4);
    expect(pieces.join('')).toBe(whole);
  });

  it('keeps a blank line and the spaces around it exactly as they were', () => {
    const whole = '  leading spaces  \n\n  trailing spaces  \nlast';
    const paginated = paginateOnGrid(
      materializedOf({ page: gridPage(1), ...flow([literalText('t', whole)]) }, {}),
    );
    expect(textPerPage(paginated, 't').join('')).toBe(whole);
  });

  it('keeps a surrogate pair and a combining sequence whole across the seam', () => {
    const whole = `${'a'.repeat(19)}\u{1F469}‍\u{1F4BB}é${'b'.repeat(19)}`;
    const paginated = paginateOnGrid(
      materializedOf({ page: gridPage(1), ...flow([literalText('t', whole)]) }, {}),
    );
    expect(textPerPage(paginated, 't').join('')).toBe(whole);
  });

  it('carries a marker onto the page that really holds it', () => {
    const paginated = paginateOnGrid(
      materializedOf(
        {
          page: gridPage(1),
          ...flow([
            {
              type: 'text',
              id: 't',
              content: [
                { kind: 'literal', text: 'x'.repeat(20) },
                { kind: 'literal', text: 'page ' },
                { kind: 'pageField', field: 'number' },
              ],
            },
          ]),
        },
        {},
      ),
    );
    const pieces = textPerPage(paginated, 't');
    expect(pieces[0]).toBe('x'.repeat(20));
    expect(pieces[1]).toBe('page <number>');
  });

  it('keeps the typography of every run on both sides of the seam', () => {
    const paginated = paginateOnGrid(
      materializedOf(
        {
          page: gridPage(1),
          ...flow([
            {
              type: 'text',
              id: 't',
              content: [
                { kind: 'literal', text: 'x'.repeat(20), typography: { bold: true } },
                { kind: 'literal', text: 'y'.repeat(20), typography: { italic: true } },
              ],
            },
          ]),
        },
        {},
      ),
    );
    const styles = paginated.pages.map((page) => {
      const [container] = page.root;
      const fragment = container?.kind === 'container' ? container.children[0] : undefined;
      const run = fragment?.kind === 'text' ? fragment.runs[0] : undefined;
      return run === undefined ? undefined : [run.typography.bold, run.typography.italic];
    });
    expect(styles).toStrictEqual([
      [true, false],
      [false, true],
    ]);
  });

  it('keeps no minimum number of lines on either side of the seam', () => {
    /* Two lines on a page that holds three: the second block takes the one line left, orphan or
       not. Widows and orphans are a policy of a later lot, and E2 must not smuggle one in. */
    const paginated = paginateOnGrid(
      materializedOf(
        { page: gridPage(3), ...flow([literalText('a', lines(2)), literalText('b', lines(3))]) },
        {},
      ),
    );
    expect(textPerPage(paginated, 'b')).toHaveLength(2);
    expect(textPerPage(paginated, 'b')[0]).toBe(lines(3).slice(0, 20));
  });
});

function emptyFragment(block: MaterialText): TextFragment {
  return {
    kind: 'text',
    source: block,
    runs: [],
    from: { run: 0, offset: 0 },
    to: { run: 0, offset: 0 },
    edge: 'whole',
  };
}
