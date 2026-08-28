/**
 * The arithmetic that decides where a page is cut, in Node so it can be measured.
 *
 * Every number this module reads came back from the browser as an observation. Nothing here
 * queries a DOM, so the boundaries of a visual line, the sub-pixel threshold and the four overflow
 * comparisons are all reachable from a plain unit test.
 */
import type { PdfLayoutMeasurement, TextLineMeasurement } from '@openview/engine';
import type {
  LayoutObservation,
  ObservedBox,
  ObservedGridItem,
  ObservedInsets,
  ObservedNode,
  ObservedPage,
  ObservedRect,
  ObservedRegion,
} from './observation.js';

/**
 * How far past an edge still counts as inside it, in css pixels.
 *
 * Half a pixel: a layout whose boxes land on thirds of a pixel is not an overflow, and a browser
 * that reports a rectangle a hair past its parent has not lost a glyph.
 */
export const TOLERANCE = 0.5;

/** The vertical content band of a box: what its padding and rules leave inside it. */
function contentBandOf(
  rect: ObservedRect,
  insets: ObservedInsets,
): { readonly top: number; readonly height: number } {
  return { top: rect.top + insets.top, height: rect.height - insets.top - insets.bottom };
}

/** Whether a rectangle painted nothing, in which case it names no position on any line. */
const blank = (rect: ObservedRect): boolean => rect.width === 0 && rect.height === 0;

/**
 * The visual lines one text block was laid out on, and where each one ends.
 *
 * A unit opens a new line when its own box starts at or below everything already on the current
 * one. Comparing whole prefixes instead would split a line that mixes two font sizes, and would
 * merge a blank line into the one after it.
 *
 * The last line is stretched to the content box: a browser reports the ink of a range, and the sum
 * of the fragments has to be the whole box the paginator was told about.
 */
export function linesOf(box: ObservedBox): readonly TextLineMeasurement[] {
  const content = contentBandOf(box.rect, box.insets);
  const lines: TextLineMeasurement[] = [];
  let bottom: number | undefined;
  let ending: { readonly run: number; readonly offset: number } | undefined;
  let index = 0;
  const close = (): void => {
    if (bottom === undefined || ending === undefined) {
      return;
    }
    lines.push({
      key: box.key,
      index,
      run: ending.run,
      offset: ending.offset,
      height: bottom - content.top,
    });
    index += 1;
    bottom = undefined;
  };
  for (const unit of box.units) {
    if (blank(unit.rect)) {
      continue;
    }
    if (bottom !== undefined && unit.rect.top >= bottom - TOLERANCE) {
      close();
    }
    bottom = bottom === undefined ? unit.rect.bottom : Math.max(bottom, unit.rect.bottom);
    ending = { run: unit.run, offset: unit.offset };
  }
  close();
  const last = lines.at(-1);
  if (last !== undefined) {
    lines[lines.length - 1] = { ...last, height: Math.max(last.height, content.height) };
  }
  return lines;
}

/** How far the visible content of a region reached below its own top edge. */
function contentHeightOf(region: ObservedRegion): number {
  return region.contentBottom - region.rect.top;
}

function pageOf(page: ObservedPage): PdfLayoutMeasurement['pages'][number] {
  return {
    page: { width: page.rect.width, height: page.rect.height },
    printable: { width: page.printable.width, height: page.printable.height },
    regions: page.regions.map((region) => ({
      region: region.region,
      height: region.rect.height,
      contentHeight: contentHeightOf(region),
    })),
  };
}

/** Whether a painted box left the sheet it belongs to, on any of the four edges. */
function escapes(node: ObservedNode): boolean {
  if (blank(node.rect)) {
    return false;
  }
  return (
    node.rect.left < node.sheet.left - TOLERANCE ||
    node.rect.top < node.sheet.top - TOLERANCE ||
    node.rect.right > node.sheet.right + TOLERANCE ||
    node.rect.bottom > node.sheet.bottom + TOLERANCE
  );
}

/**
 * Whether the content of a grid zone left the cell it was given.
 *
 * A zone is never clipped, so content past its content box is visible only here; both axes are
 * compared, because a long word widens a track exactly as a tall block deepens one.
 */
function overflows(item: ObservedGridItem): boolean {
  const spread = item.descendants;
  if (spread === undefined) {
    return false;
  }
  const content = {
    left: item.rect.left + item.insets.left,
    top: item.rect.top + item.insets.top,
    right: item.rect.right - item.insets.right,
    bottom: item.rect.bottom - item.insets.bottom,
  };
  return (
    spread.left < content.left - TOLERANCE ||
    spread.top < content.top - TOLERANCE ||
    spread.right > content.right + TOLERANCE ||
    spread.bottom > content.bottom + TOLERANCE
  );
}

/**
 * Turns one pass of observations into the measurement the paginator reads.
 *
 * Pure: the same observation always derives the same measurement, which is what lets a page cut be
 * reproduced without a browser.
 */
export function deriveMeasurement(observation: LayoutObservation): PdfLayoutMeasurement {
  if (observation.pages.length === 0) {
    throw new Error('the rendered document has no .ov-page');
  }
  /* Counted, never read: a marker one character too wide is invisible in the paint because the box
     clips it, and the digits that overflowed are render data. */
  const clipped = observation.markers.filter(
    (marker) => marker.scrollWidth > marker.clientWidth + TOLERANCE,
  );
  return {
    pages: observation.pages.map(pageOf),
    boxes: observation.boxes.map((box) => ({
      key: box.key,
      width: box.rect.width,
      height: box.rect.height,
    })),
    lines: observation.boxes.flatMap(linesOf),
    images: observation.images.map((image) => ({ ...image })),
    escaping: observation.nodes.filter(escapes).map((node) => node.nodeId),
    overflowingGridItems: observation.gridItems.filter(overflows).map((item) => item.nodeId),
    clippedMarkerCount: clipped.length,
  };
}
