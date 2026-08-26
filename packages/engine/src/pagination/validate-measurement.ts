import type { Sheet } from '@openview/core';
import type { OccurrenceKey } from '../document/types.js';
import { refusal } from '../errors.js';
import type { PdfLayoutMeasurement } from '../strategy/pdf.js';
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
  expected: ReadonlySet<OccurrenceKey>,
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
    assertLength(page.page.width);
    assertLength(page.page.height);
    assertLength(page.printable.width);
    assertLength(page.printable.height);
    for (const region of page.regions) {
      assertLength(region.height);
      assertLength(region.contentHeight);
    }
  }
  const pxPerMm = firstPage.page.width / sheet.width;
  if (!Number.isFinite(pxPerMm) || pxPerMm <= 0) {
    throw refusal(WRONG_SHEET, 'layout-measurement-failed');
  }

  if (!Number.isInteger(measurement.clippedMarkerCount) || measurement.clippedMarkerCount < 0) {
    refuse();
  }

  const heights = new Map<OccurrenceKey, number>();
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

  const lines = new Map<OccurrenceKey, LineMetric[]>();
  for (const line of measurement.lines) {
    if (!expected.has(line.key)) {
      refuse({ limit: measurement.lines.length });
    }
    assertLength(line.height);
    if (!Number.isInteger(line.run) || line.run < 0) {
      refuse();
    }
    if (!Number.isInteger(line.offset) || line.offset < 0) {
      refuse();
    }
    if (!Number.isInteger(line.index) || line.index < 0) {
      refuse();
    }
    const collected = lines.get(line.key) ?? [];
    if (collected.length !== line.index) {
      refuse({ limit: line.index });
    }
    const previous = collected.at(-1);
    /* A cursor that goes backwards would let a fragment repeat characters the page before it
       already printed, which no later check could see. */
    if (
      previous !== undefined &&
      (line.run < previous.run ||
        (line.run === previous.run && line.offset < previous.offset) ||
        line.height + TOLERANCE_PX < previous.height)
    ) {
      refuse({ limit: line.index });
    }
    collected.push({ run: line.run, offset: line.offset, height: line.height });
    lines.set(line.key, collected);
  }

  return {
    pxPerMm,
    height(key: OccurrenceKey): number {
      const found = heights.get(key);
      if (found === undefined) {
        throw refusal(UNKNOWN_KEY, 'layout-measurement-failed');
      }
      return found;
    },
    lines(key: OccurrenceKey): readonly LineMetric[] {
      return lines.get(key) ?? [];
    },
  };
}
