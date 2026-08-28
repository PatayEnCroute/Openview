import { describe, expect, it } from 'vitest';
import type { MaterialRun, MaterialText } from '../document/types.js';
import { sliceText } from '../pagination/text.js';
import type { Metrics } from '../pagination/types.js';
import { gridPage, literalText, materializedOf, paginateOnGrid, textPerPage } from './fixtures.js';
import { GRID, gridMetrics } from './metrics.js';

const flow = (children: readonly Record<string, unknown>[]): Record<string, unknown> => ({
  root: { type: 'container', id: 'root', children },
});

/** One grid line is twenty characters; every line is numbered so a seam is visible in the text. */
const lines = (count: number): string =>
  Array.from({ length: count }, (_unused, index) => `line ${String(index).padEnd(14, '.')}`)
    .join('')
    .slice(0, count * 20);

const room = (visualLines: number): number => visualLines * GRID.lineHeight;

/** A single text block of `count` grid lines, with the metrics the grid would report for it. */
function textOf(count: number, content?: readonly unknown[]): [MaterialText, Metrics] {
  const document = materializedOf(
    {
      page: gridPage(40),
      ...flow([
        content === undefined ? literalText('t', lines(count)) : { type: 'text', id: 't', content },
      ]),
    },
    {},
  );
  const [root] = document.root;
  const block = root?.kind === 'container' ? root.children[0] : undefined;
  if (block?.kind !== 'text') {
    throw new Error('the fixture should hold a text block');
  }
  return [block, gridMetrics(document)];
}

/** How many visual lines the first fragment keeps, or `deferred` when the page closes instead. */
function keptBy(total: number, available: number, fresh: number): number | 'deferred' {
  const [block, metrics] = textOf(total);
  const placed = sliceText(block, 0, room(available), room(fresh), metrics);
  return placed === undefined ? 'deferred' : (placed.nextLine ?? total);
}

describe('a text short enough that two on each side is impossible', () => {
  it.each([1, 2, 3])('takes the greedy cut for a block of %i lines', (total) => {
    // Two on each side needs four: below that the preference does not apply, and no artificial cut
    // is introduced -- one line still goes where one line fits.
    expect(keptBy(total, 1, 10)).toBe(1);
  });

  it('still places a single line when a whole page holds no more', () => {
    expect(keptBy(3, 1, 1)).toBe(1);
  });
});

describe('a text long enough for the preference', () => {
  it('cuts a four-line block two and two rather than three and one', () => {
    expect(keptBy(4, 3, 10)).toBe(2);
    expect(keptBy(4, 2, 10)).toBe(2);
  });

  it('leaves two lines behind in a five, six and seven-line block', () => {
    for (const total of [5, 6, 7]) {
      for (let available = 2; available < total; available += 1) {
        const kept = keptBy(total, available, 10);
        expect(kept).not.toBe('deferred');
        expect(kept).toBeGreaterThanOrEqual(2);
        expect(total - Number(kept)).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('takes as many lines as fit, once two are left for the page after', () => {
    expect(keptBy(7, 4, 10)).toBe(4);
    expect(keptBy(7, 6, 10)).toBe(5);
    expect(keptBy(7, 7, 10)).toBe(7);
  });

  it('closes the page when one line would be orphaned and a fresh page holds the block', () => {
    expect(keptBy(4, 1, 10)).toBe('deferred');
    expect(keptBy(6, 1, 10)).toBe('deferred');
  });

  it('closes the page when a fresh page could not hold the block but could cut it two and two', () => {
    // Six lines, a fresh page holding four: the fresh page cannot take the block whole, but it can
    // cut it four and two, which the room here cannot.
    expect(keptBy(6, 1, 4)).toBe('deferred');
  });

  it('takes the greedy cut when no page could satisfy the preference either', () => {
    // A fresh page holds one line: two on each side is unreachable anywhere, so the block advances
    // one line at a time rather than refusing or deferring for ever.
    expect(keptBy(6, 1, 1)).toBe(1);
  });

  it('takes the greedy cut even where a fresh page is roomier but still too short', () => {
    // The case the guard above cannot reach: the room here is STRICTLY smaller than a fresh page,
    // so deferring is not obviously pointless -- and yet a fresh page holds one line too, because
    // the second needs more room than the half-line it has spare. Deferring would then move the
    // block to a page that cuts it exactly the same way, one page later and for ever.
    expect(keptBy(6, 1, 1.5)).toBe(1);
    expect(keptBy(8, 1, 1.9)).toBe(1);
  });

  it('never defers on a page that already holds nothing else', () => {
    // Deferring there would offer the same room again and consume nothing, which is the one thing
    // a page may never do.
    expect(keptBy(5, 3, 3)).toBe(3);
    expect(keptBy(5, 1, 1)).toBe(1);
  });
});

describe('the characters a preferred cut moves', () => {
  it('restores the block exactly, with no character lost or repeated', () => {
    const paginated = paginateOnGrid(
      materializedOf({ page: gridPage(3), ...flow([literalText('t', lines(6))]) }, {}),
    );
    expect(textPerPage(paginated, 't').join('')).toBe(lines(6));
  });

  it('keeps every run and its typography across the seam', () => {
    const [block, metrics] = textOf(0, [
      { kind: 'literal', text: 'a'.repeat(40), typography: { bold: true } },
      { kind: 'literal', text: 'b'.repeat(40), typography: { italic: true } },
    ]);
    const first = sliceText(block, 0, room(3), room(10), metrics);
    if (first?.nextLine === undefined) {
      throw new Error('the fixture should be cut');
    }
    /* Two of the four lines here and two after, rather than three and one. */
    expect(first.nextLine).toBe(2);
    const second = sliceText(block, first.nextLine, room(3), room(10), metrics);
    const written = (runs: readonly MaterialRun[]): string =>
      runs.map((run) => (run.kind === 'text' ? run.text : '')).join('');
    expect(written(first.fragment.runs) + written(second?.fragment.runs ?? [])).toBe(
      'a'.repeat(40) + 'b'.repeat(40),
    );
    expect(first.fragment.runs[0]?.typography.face.weight).toBe(700);
    expect(second?.fragment.runs.at(-1)?.typography.face.style).toBe('italic');
  });

  it('counts a blank line and a marker as lines like any other', () => {
    // A marker is one atomic position and an empty line is a line: neither is skipped when the two
    // sides of the cut are counted.
    const [block, metrics] = textOf(0, [
      { kind: 'literal', text: 'a'.repeat(20) },
      { kind: 'literal', text: '\n\n' },
      { kind: 'pageField', field: 'number' },
      { kind: 'literal', text: `\n${'b'.repeat(20)}` },
    ]);
    expect(metrics.lines(block.key).length).toBeGreaterThanOrEqual(4);
    const placed = sliceText(block, 0, room(3), room(10), metrics);
    expect(placed?.nextLine).toBeDefined();
    expect(metrics.lines(block.key).length - Number(placed?.nextLine)).toBeGreaterThanOrEqual(2);
  });

  it('applies inside a table cell as it does in the flow', () => {
    const paginated = paginateOnGrid(
      materializedOf(
        {
          page: gridPage(3),
          ...flow([
            {
              type: 'table',
              id: 'grid',
              columns: [{ id: 'c', width: 1, align: 'start' }],
              header: [],
              body: [
                {
                  type: 'tableRow',
                  id: 'r',
                  cells: [{ columnId: 'c', children: [literalText('t', lines(4))] }],
                },
              ],
              footer: [],
            },
          ]),
        },
        {},
      ),
    );
    const pieces = textPerPage(paginated, 't');
    expect(pieces).toHaveLength(2);
    expect(pieces[0]).toBe(lines(4).slice(0, 40));
    expect(pieces[1]).toBe(lines(4).slice(40));
  });

  it('applies to the text of a parent whose own mark had to fall back', () => {
    // The container is taller than any page, so its mark yields; the text inside is then cut by the
    // ordinary policy, which includes the preference.
    const paginated = paginateOnGrid(
      materializedOf(
        {
          page: gridPage(3),
          ...flow([
            {
              type: 'container',
              id: 'outer',
              keepTogether: true,
              children: [literalText('t', lines(6))],
            },
          ]),
        },
        {},
      ),
    );
    for (const piece of textPerPage(paginated, 't')) {
      expect(piece.length).toBeGreaterThanOrEqual(40);
    }
  });
});
