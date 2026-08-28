import { describe, expect, it } from 'vitest';
import { deriveMeasurement, linesOf, TOLERANCE } from '../derive.js';
import type {
  LayoutObservation,
  ObservedBox,
  ObservedInsets,
  ObservedRect,
  ObservedUnit,
} from '../observation.js';

const NO_INSETS: ObservedInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/** A rectangle from its edges, so a test states the two numbers a line decision reads. */
function rect(top: number, bottom: number, left = 0, right = 10): ObservedRect {
  return { top, bottom, left, right, width: right - left, height: bottom - top };
}

const BLANK: ObservedRect = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };

/** One unit of a text block: which cursor it ends at, and the ink the browser reported for it. */
const unit = (run: number, offset: number, box: ObservedRect): ObservedUnit => ({
  run,
  offset,
  rect: box,
});

function boxOf(units: readonly ObservedUnit[], overrides: Partial<ObservedBox> = {}): ObservedBox {
  return {
    key: 'k',
    rect: rect(0, 40),
    insets: NO_INSETS,
    units,
    ...overrides,
  };
}

describe('the visual lines derived from one block', () => {
  it('closes a line when the next unit starts at or below everything already on it', () => {
    const lines = linesOf(
      boxOf([
        unit(0, 1, rect(0, 10)),
        unit(0, 2, rect(0, 10)),
        unit(0, 3, rect(10, 20)),
        unit(0, 4, rect(10, 20)),
      ]),
    );
    expect(lines.map(({ index, run, offset }) => ({ index, run, offset }))).toStrictEqual([
      { index: 0, run: 0, offset: 2 },
      { index: 1, run: 0, offset: 4 },
    ]);
  });

  it('keeps two font sizes on one line rather than cutting between them', () => {
    /* The tall unit starts above the bottom of the short one, so it belongs to the same line; a
       comparison on whole prefixes would have opened a second one here. */
    const lines = linesOf(
      boxOf([unit(0, 1, rect(0, 8)), unit(1, 1, rect(0, 14))], { rect: rect(0, 14) }),
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]?.height).toBe(14);
  });

  it('does not merge a blank line into the line after it', () => {
    const lines = linesOf(
      boxOf([unit(0, 1, rect(0, 10)), unit(0, 2, rect(10, 20)), unit(0, 3, rect(20, 30))], {
        rect: rect(0, 30),
      }),
    );
    expect(lines.map((line) => line.height)).toStrictEqual([10, 20, 30]);
  });

  it('treats a gap smaller than the tolerance as the same line, and one larger as a new one', () => {
    const within = linesOf(boxOf([unit(0, 1, rect(0, 10)), unit(0, 2, rect(10 - TOLERANCE, 20))]));
    expect(within).toHaveLength(2);
    const under = linesOf(
      boxOf([unit(0, 1, rect(0, 10)), unit(0, 2, rect(10 - TOLERANCE - 0.01, 20))]),
    );
    expect(under).toHaveLength(1);
  });

  it('skips a unit the browser reported no ink for', () => {
    const lines = linesOf(boxOf([unit(0, 1, BLANK), unit(0, 2, rect(0, 10))]));
    expect(lines).toStrictEqual([{ key: 'k', index: 0, run: 0, offset: 2, height: 40 }]);
  });

  it('stretches the last line to the content box, so the fragments sum to the whole box', () => {
    const lines = linesOf(
      boxOf([unit(0, 1, rect(0, 10)), unit(0, 2, rect(10, 20))], { rect: rect(0, 55) }),
    );
    expect(lines.map((line) => line.height)).toStrictEqual([10, 55]);
  });

  it('measures a line from the content top, not from the border box', () => {
    const lines = linesOf(
      boxOf([unit(0, 1, rect(6, 16))], {
        rect: rect(0, 30),
        insets: { top: 6, right: 0, bottom: 4, left: 0 },
      }),
    );
    /* 16 - (0 + 6) = 10 of ink, stretched to the content height 30 - 6 - 4 = 20. */
    expect(lines[0]?.height).toBe(20);
  });

  it('answers nothing for a block with no unit, and clamps no phantom line', () => {
    expect(linesOf(boxOf([]))).toStrictEqual([]);
    expect(linesOf(boxOf([unit(0, 1, BLANK)]))).toStrictEqual([]);
  });

  it('ends a line on a marker as one atomic position', () => {
    const lines = linesOf(boxOf([unit(0, 3, rect(0, 10)), unit(1, 1, rect(0, 10))]));
    expect(lines).toStrictEqual([{ key: 'k', index: 0, run: 1, offset: 1, height: 40 }]);
  });
});

const PAGE = {
  rect: rect(0, 100, 0, 80),
  printable: rect(10, 90, 10, 70),
  regions: [
    { region: 'header' as const, rect: rect(10, 20, 10, 70), contentBottom: 18 },
    { region: 'root' as const, rect: rect(20, 80, 10, 70), contentBottom: 75 },
    { region: 'footer' as const, rect: rect(80, 90, 10, 70), contentBottom: 80 },
  ],
};

function observationOf(overrides: Partial<LayoutObservation> = {}): LayoutObservation {
  return {
    pages: [PAGE],
    boxes: [],
    images: [],
    nodes: [],
    gridItems: [],
    markers: [],
    ...overrides,
  };
}

describe('the measurement derived from one pass', () => {
  it('refuses an observation with no page rather than reporting an empty layout', () => {
    expect(() => deriveMeasurement(observationOf({ pages: [] }))).toThrow(/no \.ov-page/);
  });

  it('reports the height of a region and how far its content reached below its top', () => {
    const measured = deriveMeasurement(observationOf());
    expect(measured.pages[0]?.page).toStrictEqual({ width: 80, height: 100 });
    expect(measured.pages[0]?.printable).toStrictEqual({ width: 60, height: 80 });
    expect(measured.pages[0]?.regions).toStrictEqual([
      { region: 'header', height: 10, contentHeight: 8 },
      { region: 'root', height: 60, contentHeight: 55 },
      { region: 'footer', height: 10, contentHeight: 0 },
    ]);
  });

  it('reports a box by the key the engine annotated, and its painted size', () => {
    const measured = deriveMeasurement(
      observationOf({ boxes: [boxOf([], { key: 'b1', rect: rect(0, 12, 3, 23) })] }),
    );
    expect(measured.boxes).toStrictEqual([{ key: 'b1', width: 20, height: 12 }]);
  });

  it('names a declaration that left its sheet, on each of the four edges', () => {
    const sheet = rect(0, 100, 0, 100);
    const escaping = (box: ObservedRect) =>
      deriveMeasurement(observationOf({ nodes: [{ nodeId: 'out', rect: box, sheet }] })).escaping;
    expect(escaping(rect(10, 20, 10, 20))).toStrictEqual([]);
    expect(escaping(rect(10, 20, -1, 20))).toStrictEqual(['out']);
    expect(escaping(rect(-1, 20, 10, 20))).toStrictEqual(['out']);
    expect(escaping(rect(10, 20, 10, 101))).toStrictEqual(['out']);
    expect(escaping(rect(10, 101, 10, 20))).toStrictEqual(['out']);
  });

  it('forgives a sheet overrun no wider than the tolerance', () => {
    const sheet = rect(0, 100, 0, 100);
    const at = (right: number) =>
      deriveMeasurement(
        observationOf({ nodes: [{ nodeId: 'edge', rect: rect(10, 20, 10, right), sheet }] }),
      ).escaping;
    expect(at(100 + TOLERANCE)).toStrictEqual([]);
    expect(at(100 + TOLERANCE + 0.01)).toStrictEqual(['edge']);
  });

  it('ignores a declaration the browser painted nothing for', () => {
    const measured = deriveMeasurement(
      observationOf({ nodes: [{ nodeId: 'ghost', rect: BLANK, sheet: rect(0, 100, 0, 100) }] }),
    );
    expect(measured.escaping).toStrictEqual([]);
  });

  it('names a grid zone whose content left its cell, on each of the four edges', () => {
    const overflowing = (spread: ObservedRect | undefined) =>
      deriveMeasurement(
        observationOf({
          gridItems: [
            {
              nodeId: 'zone',
              rect: rect(0, 50, 0, 50),
              insets: { top: 5, right: 5, bottom: 5, left: 5 },
              descendants: spread,
            },
          ],
        }),
      ).overflowingGridItems;
    expect(overflowing(rect(10, 40, 10, 40))).toStrictEqual([]);
    expect(overflowing(rect(10, 40, 4, 40))).toStrictEqual(['zone']);
    expect(overflowing(rect(4, 40, 10, 40))).toStrictEqual(['zone']);
    expect(overflowing(rect(10, 40, 10, 46))).toStrictEqual(['zone']);
    expect(overflowing(rect(10, 46, 10, 40))).toStrictEqual(['zone']);
    expect(overflowing(undefined)).toStrictEqual([]);
  });

  it('counts a marker whose value needs more width than its reserve, and no other', () => {
    const measured = deriveMeasurement(
      observationOf({
        markers: [
          { scrollWidth: 20, clientWidth: 20 },
          { scrollWidth: 20 + TOLERANCE, clientWidth: 20 },
          { scrollWidth: 21, clientWidth: 20 },
          { scrollWidth: 30, clientWidth: 20 },
        ],
      }),
    );
    expect(measured.clippedMarkerCount).toBe(2);
  });

  it('carries an image observation through untouched', () => {
    const image = {
      nodeId: 'logo',
      decoded: false,
      naturalWidth: 120,
      naturalHeight: 40,
      renderedWidth: 60,
      renderedHeight: 20,
    };
    expect(deriveMeasurement(observationOf({ images: [image] })).images).toStrictEqual([image]);
  });

  it('files every line under the box it belongs to, block after block', () => {
    const measured = deriveMeasurement(
      observationOf({
        boxes: [
          boxOf([unit(0, 1, rect(0, 10))], { key: 'first', rect: rect(0, 10) }),
          boxOf([], { key: 'empty' }),
          boxOf([unit(0, 2, rect(0, 10))], { key: 'last', rect: rect(0, 10) }),
        ],
      }),
    );
    expect(measured.lines.map((line) => line.key)).toStrictEqual(['first', 'last']);
  });

  it('is the same measurement for the same observation, twice', () => {
    const observation = observationOf({
      boxes: [boxOf([unit(0, 1, rect(0, 10)), unit(0, 2, rect(10, 20))], { rect: rect(0, 20) })],
      markers: [{ scrollWidth: 30, clientWidth: 20 }],
    });
    expect(deriveMeasurement(observation)).toStrictEqual(deriveMeasurement(observation));
  });
});
