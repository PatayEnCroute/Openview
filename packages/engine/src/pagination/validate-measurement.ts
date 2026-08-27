import type { Sheet } from '@openview/core';
import { refusal } from '../errors.js';
import type {
  PageMeasurement,
  PdfLayoutMeasurement,
  TextLineMeasurement,
} from '../strategy/pdf.js';
import type { LineMetric, Metrics } from './types.js';

/** Sub-pixel layout rounding. Far below one line of text, so a real overflow still fails. */
export const TOLERANCE_PX = 0.5;

const INCOMPLETE =
  'The layout session did not return a complete and finite measurement of the document it was handed. Read `details.limit` for the count involved, when one is meaningful.';

const UNKNOWN_KEY =
  'The paginator asked for a box the layout session never measured. A cut cannot be chosen from a height that was not observed.';

const WRONG_SHEET =
  'The layout session laid the document out on a sheet other than the declared one, so every height it returned belongs to a page that will not be printed.';

function refuse(detail: Record<string, number> = {}): never {
  throw refusal(INCOMPLETE, 'layout-measurement-failed', detail);
}

/** A length that a box cannot have: not a number, not finite, or below zero. */
function assertLength(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    refuse();
  }
}

/** A count that must be a whole number of things, so never fractional and never negative. */
function assertCount(value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    refuse();
  }
}

/** Every length one page reports about itself, its printable area and its three regions. */
function assertPageLengths(page: PageMeasurement): void {
  assertLength(page.page.width);
  assertLength(page.page.height);
  assertLength(page.printable.width);
  assertLength(page.printable.height);
  for (const region of page.regions) {
    assertLength(region.height);
    assertLength(region.contentHeight);
  }
}

/** The scale the reply implies, refused when the session laid the document on another sheet. */
function scaleOf(firstPage: PageMeasurement, sheet: Sheet): number {
  const pxPerMm = firstPage.page.width / sheet.width;
  if (!Number.isFinite(pxPerMm) || pxPerMm <= 0) {
    throw refusal(WRONG_SHEET, 'layout-measurement-failed');
  }
  return pxPerMm;
}

/**
 * Refuses a line cursor that goes backwards from the one before it.
 *
 * A cursor that went backwards would let a fragment repeat characters the page before it already
 * printed, which no later check could see.
 */
function assertLineFollows(line: TextLineMeasurement, previous: LineMetric | undefined): void {
  if (previous === undefined) {
    return;
  }
  if (
    line.run < previous.run ||
    (line.run === previous.run && line.offset < previous.offset) ||
    line.height + TOLERANCE_PX < previous.height
  ) {
    refuse({ limit: line.index });
  }
}

/** One height per measured box, refusing a box unasked for, doubled, or impossibly sized. */
function collectHeights(
  measurement: PdfLayoutMeasurement,
  expected: ReadonlySet<string>,
): Map<string, number> {
  const heights = new Map<string, number>();
  for (const box of measurement.boxes) {
    if (!expected.has(box.key) || heights.has(box.key)) {
      refuse({ limit: measurement.boxes.length });
    }
    assertLength(box.height);
    assertLength(box.width);
    heights.set(box.key, box.height);
  }
  if (heights.size !== expected.size) {
    refuse({ limit: expected.size });
  }
  return heights;
}

/** The visual lines of every measured text box, in the order the session emitted them. */
function collectLines(
  measurement: PdfLayoutMeasurement,
  expected: ReadonlySet<string>,
): Map<string, LineMetric[]> {
  const lines = new Map<string, LineMetric[]>();
  for (const line of measurement.lines) {
    if (!expected.has(line.key)) {
      refuse({ limit: measurement.lines.length });
    }
    assertLength(line.height);
    assertCount(line.run);
    assertCount(line.offset);
    assertCount(line.index);
    const collected = lines.get(line.key) ?? [];
    if (collected.length !== line.index) {
      refuse({ limit: line.index });
    }
    assertLineFollows(line, collected.at(-1));
    collected.push({ run: line.run, offset: line.offset, height: line.height });
    lines.set(line.key, collected);
  }
  return lines;
}

/**
 * Checks a session reply before a single height of it reaches the algorithm.
 *
 * A box that is missing, doubled, unasked for, negative or infinite is a defect of the port, not a
 * short document: turning one into a cut would produce a silently wrong pdf, so it is refused here
 * with nothing of the render in the message.
 *
 * @param expected every occurrence key the probe annotated, so a reply can be compared to the ask
 */
export function validateMeasurement(
  measurement: PdfLayoutMeasurement,
  expected: ReadonlySet<string>,
  sheet: Sheet,
): Metrics {
  if (measurement.pages.length === 0) {
    refuse({ limit: 0 });
  }
  const [firstPage] = measurement.pages;
  if (firstPage === undefined) {
    refuse({ limit: 0 });
  }
  for (const page of measurement.pages) {
    assertPageLengths(page);
  }
  const pxPerMm = scaleOf(firstPage, sheet);

  assertCount(measurement.clippedMarkerCount);

  if (
    !Array.isArray(measurement.overflowingGridItems) ||
    measurement.overflowingGridItems.some((id) => typeof id !== 'string')
  ) {
    refuse({ limit: 0 });
  }

  const heights = collectHeights(measurement, expected);
  const lines = collectLines(measurement, expected);

  return {
    pxPerMm,
    height(key: string): number {
      const found = heights.get(key);
      if (found === undefined) {
        throw refusal(UNKNOWN_KEY, 'layout-measurement-failed');
      }
      return found;
    },
    lines(key: string): readonly LineMetric[] {
      return lines.get(key) ?? [];
    },
  };
}
