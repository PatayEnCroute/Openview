import type { Sheet } from '@openview/core';
import type {
  LayoutBoxMeasurement,
  PageMeasurement,
  PdfLayoutMeasurement,
  PdfRenderResources,
  PdfRenderSession,
  PdfRenderStrategy,
  PdfSourceDocument,
  TextLineMeasurement,
} from '../strategy/pdf.js';

/** Css pixels per millimetre at the default device ratio, which is what Chromium reports. */
export const PX_PER_MM = 96 / 25.4;

/** A four-byte pdf signature. Enough for a session that must not print anything real. */
export const FAKE_PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

/** How tall the fake says each measured box is, by the declaration it came from. */
export interface FakeLayout {
  /** Height of one box, in css pixels. Consulted by declaration id first, then by tag name. */
  heightOf?: ((tag: string, nodeId: string | undefined) => number) | undefined;
  /** Visual lines of one text block, by declaration id. Absent means the block is atomic. */
  linesOf?:
    | ((nodeId: string | undefined) => readonly Omit<TextLineMeasurement, 'key'>[])
    | undefined;
  /** Height every region of the printed document reports as content, in css pixels. */
  readonly regionContent?: number | undefined;
  /**
   * How many measurements of a composed sequence report the flow over its slot, before the fake
   * relents. Drives the loop that withholds height from a page and cuts again.
   */
  readonly overflowRounds?: number | undefined;
  /** Declaration ids the fake says painted outside their sheet. */
  readonly escaping?: readonly string[] | undefined;
  /** Grid-zone container ids the fake says hold content past their zone. */
  readonly overflowingGridItems?: readonly string[] | undefined;
  /** Images the fake says the page holds. */
  readonly images?: PdfLayoutMeasurement['images'] | undefined;
  /** How many page markers the fake says hold more than their reserved width shows. */
  readonly clippedMarkers?: number | undefined;
}

/** A composed sequence declares a break after every sheet but the last; a probe declares none. */
const isComposed = (html: string): boolean => html.includes('break-after:page');

/* `[^>]*` rather than a repeated attribute group: the group would let the engine split one run
   of whitespace across its iterations, which backtracks super-linearly on a tag that never closes.
   ATTRIBUTE reads the pairs out of the blob, so nothing is lost by not parsing them twice. */
const KEYED = /<(\w+)([^>]*)>/g;
const ATTRIBUTE = /([\w-]+)="([^"]*)"/g;

interface KeyedBox {
  readonly tag: string;
  readonly key: string;
  readonly nodeId: string | undefined;
}

/** Every box the probe annotated, read back from the markup the engine really produced. */
export function keyedBoxes(html: string): readonly KeyedBox[] {
  const found: KeyedBox[] = [];
  for (const tag of html.matchAll(KEYED)) {
    const attributes = new Map<string, string>();
    for (const attribute of (tag[2] ?? '').matchAll(ATTRIBUTE)) {
      attributes.set(attribute[1] ?? '', attribute[2] ?? '');
    }
    const key = attributes.get('data-openview-key');
    if (key !== undefined) {
      found.push({ tag: tag[1] ?? '', key, nodeId: attributes.get('data-openview-node') });
    }
  }
  return found;
}

/** How many sheets the document holds, counted the way the printer will. */
export const pageBoxes = (html: string): number => html.split('class="ov-page"').length - 1;

const PRINTABLE = /\.ov-printable\{[^}]*width:([\d.]+)mm;height:([\d.]+)mm/;

/**
 * The printable box the stylesheet itself declares.
 *
 * Read back rather than configured, so the fake answers about the document it was handed instead of
 * about a geometry a test remembered separately. A probe leaves the height open and gets the sheet.
 */
function printableOf(html: string, sheet: Sheet): { width: number; height: number } {
  const declared = PRINTABLE.exec(html);
  return {
    width: Number(declared?.[1] ?? sheet.width) * PX_PER_MM,
    height: Number(declared?.[2] ?? sheet.height) * PX_PER_MM,
  };
}

function pagesOf(
  html: string,
  sheet: Sheet,
  layout: FakeLayout,
  overflowing: boolean,
): readonly PageMeasurement[] {
  const content = layout.regionContent ?? 0;
  const page = { width: sheet.width * PX_PER_MM, height: sheet.height * PX_PER_MM };
  const printable = printableOf(html, sheet);
  return Array.from({ length: Math.max(1, pageBoxes(html)) }, () => ({
    page,
    printable,
    regions: (['header', 'root', 'footer'] as const).map((region) => ({
      region,
      height: content,
      contentHeight: overflowing && region === 'root' ? content + 5 : content,
    })),
  }));
}

/** Everything one fake session was asked to do, in order. */
export interface SessionLog {
  readonly opened: PdfRenderResources[];
  readonly measured: PdfSourceDocument[];
  readonly printed: PdfSourceDocument[];
  closed: number;
}

const CLOSED = 'this session is closed';

/**
 * A layout session that answers from a table instead of a browser.
 *
 * It reads back the keys the engine annotated, so a reply is always an answer to the real ask; the
 * heights themselves are the test's, which is what makes a cut oracle deterministic.
 */
export function fakeStrategy(
  layout: FakeLayout = {},
  bytes: Uint8Array = FAKE_PDF_BYTES,
): { readonly strategy: PdfRenderStrategy; readonly log: SessionLog } {
  const log: SessionLog = { opened: [], measured: [], printed: [], closed: 0 };
  let open = false;
  let overflowed = 0;
  return {
    log,
    strategy: {
      format: 'pdf',
      open(resources: PdfRenderResources): Promise<PdfRenderSession> {
        log.opened.push(resources);
        open = true;
        return Promise.resolve({
          measure(document: PdfSourceDocument): Promise<PdfLayoutMeasurement> {
            if (!open) {
              return Promise.reject(new Error(CLOSED));
            }
            log.measured.push(document);
            const boxes: LayoutBoxMeasurement[] = [];
            const lines: TextLineMeasurement[] = [];
            for (const box of keyedBoxes(document.html)) {
              boxes.push({
                key: box.key,
                width: 100,
                height: layout.heightOf?.(box.tag, box.nodeId) ?? 10,
              });
              for (const [index, line] of (layout.linesOf?.(box.nodeId) ?? []).entries()) {
                lines.push({ ...line, key: box.key, index });
              }
            }
            const composed = isComposed(document.html);
            const overflowing = composed && overflowed < (layout.overflowRounds ?? 0);
            if (overflowing) {
              overflowed += 1;
            }
            return Promise.resolve({
              boxes,
              lines,
              images: layout.images ?? [],
              escaping: composed ? (layout.escaping ?? []) : [],
              overflowingGridItems: composed ? (layout.overflowingGridItems ?? []) : [],
              clippedMarkerCount: composed ? (layout.clippedMarkers ?? 0) : 0,
              pages: pagesOf(document.html, document.sheet, layout, overflowing),
            });
          },
          print(document: PdfSourceDocument): Promise<Uint8Array> {
            if (!open) {
              return Promise.reject(new Error(CLOSED));
            }
            log.printed.push(document);
            return Promise.resolve(bytes);
          },
          close(): Promise<void> {
            open = false;
            log.closed += 1;
            return Promise.resolve();
          },
        });
      },
    },
  };
}

/** A strategy whose session refuses every measurement with the error it was given. */
export function failingMeasureStrategy(error: unknown): {
  readonly strategy: PdfRenderStrategy;
  readonly log: SessionLog;
} {
  const { strategy, log } = fakeStrategy();
  return {
    log,
    strategy: {
      format: 'pdf',
      async open(resources: PdfRenderResources): Promise<PdfRenderSession> {
        const session = await strategy.open(resources);
        return {
          print: session.print.bind(session),
          close: session.close.bind(session),
          measure(): Promise<PdfLayoutMeasurement> {
            return Promise.reject(error);
          },
        };
      },
    },
  };
}

/** A strategy whose session cannot be opened, to prove how an unknown failure is wrapped. */
export function failingStrategy(error: unknown): PdfRenderStrategy {
  return {
    format: 'pdf',
    open(): Promise<PdfRenderSession> {
      return Promise.reject(error);
    },
  };
}

/** A strategy that opens, measures, and then fails to print. */
export function failingPrintStrategy(error: unknown): {
  readonly strategy: PdfRenderStrategy;
  readonly log: SessionLog;
} {
  const { strategy, log } = fakeStrategy();
  return {
    log,
    strategy: {
      format: 'pdf',
      async open(resources: PdfRenderResources): Promise<PdfRenderSession> {
        const session = await strategy.open(resources);
        return {
          measure: session.measure.bind(session),
          close: session.close.bind(session),
          print(): Promise<Uint8Array> {
            return Promise.reject(error);
          },
        };
      },
    },
  };
}
