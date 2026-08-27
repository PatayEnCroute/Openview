import type { EvaluationLimits, ShapeLimits, Sheet } from '@openview/core';
import type { DocumentImage } from '../document/images.js';
import type { PresentationSelection } from '../document/presentation.js';
import type { DocumentRegion } from '../errors.js';

/**
 * The only thing a print backend ever receives: a closed, escaped html document, the sheet the
 * template declared, and the sources of the images that document references.
 *
 * Never the render data, never the template, never the AST. A backend that needed one of those
 * would be deciding layout, which is the pipeline's job.
 */
export interface PdfSourceDocument {
  readonly html: string;
  readonly sheet: Sheet;
  readonly images: readonly DocumentImage[];
}

/**
 * What a session must know before it opens.
 *
 * Which image sources a backend can print is a capability of that backend, so the list is checked
 * once at open time rather than after a fetch was already attempted.
 */
export interface PdfRenderResources {
  readonly sheet: Sheet;
  readonly images: readonly DocumentImage[];
}

/** Width and height of one painted box, in css pixels. */
export interface BoxMeasurement {
  readonly width: number;
  readonly height: number;
}

/** One of the three vertical regions of one page. */
export interface RegionMeasurement {
  readonly region: DocumentRegion;
  /** Height of the region's own box, which is what the layout gave it. */
  readonly height: number;
  /** Height its content actually reaches, from the lowest descendant edge. */
  readonly contentHeight: number;
}

/** One sheet of the loaded document, with the boxes the engine reserved on it. */
export interface PageMeasurement {
  readonly page: BoxMeasurement;
  readonly printable: BoxMeasurement;
  readonly regions: readonly RegionMeasurement[];
}

/** One box the engine asked about, under the occurrence key it annotated it with. */
export interface LayoutBoxMeasurement {
  readonly key: string;
  readonly width: number;
  readonly height: number;
}

/**
 * The end of one visual line of a text block, as a cursor into runs the engine already holds.
 *
 * The browser never returns the bound text itself: `run` indexes the block's runs and `offset` is a
 * utf-16 offset inside that run, so a cut is expressed in the engine's own coordinates.
 */
export interface TextLineMeasurement {
  readonly key: string;
  /** Zero-based rank of the visual line inside its block. */
  readonly index: number;
  readonly run: number;
  readonly offset: number;
  /** Height from the content top of the block down to the bottom of this line. */
  readonly height: number;
}

export interface ImageMeasurement {
  readonly nodeId: string;
  readonly decoded: boolean;
  readonly naturalWidth: number;
  readonly naturalHeight: number;
  readonly renderedWidth: number;
  readonly renderedHeight: number;
}

/**
 * Everything one loaded document can say about itself.
 *
 * `pages` is a list rather than a single box because a paginated document carries several sheets
 * and the engine checks each one; a document of one sheet is its one-element case.
 */
export interface PdfLayoutMeasurement {
  readonly pages: readonly PageMeasurement[];
  readonly boxes: readonly LayoutBoxMeasurement[];
  readonly lines: readonly TextLineMeasurement[];
  readonly images: readonly ImageMeasurement[];
  /** Declaration ids whose painted box left the sheet it belongs to. */
  readonly escaping: readonly string[];
  /**
   * Ids of grid-zone containers whose content reaches past the zone's content box, on either axis.
   *
   * The id and nothing else: what the content reads is render data. A zone is never clipped, so
   * without this observation an overflowing cell would print over its neighbour with every other
   * check still green.
   */
  readonly overflowingGridItems: readonly string[];
  /**
   * How many page markers hold more than their reserved width shows.
   *
   * A count and nothing else: which value was clipped, and what it read, are render data. The
   * reserve clips rather than reflows on purpose, so without this number a marker one character too
   * narrow prints a truncated figure with every other check still green.
   */
  readonly clippedMarkerCount: number;
}

/**
 * One browser, held open across every measurement and the single print of one render.
 *
 * Measuring in one environment and printing in another would compare heights the print never had:
 * the same fonts, the same decoded images and the same layout engine decide the cuts and then paint
 * them. `close()` is awaited on every path, success or refusal.
 */
export interface PdfRenderSession {
  measure(document: PdfSourceDocument): Promise<PdfLayoutMeasurement>;
  print(document: PdfSourceDocument): Promise<Uint8Array>;
  close(): Promise<void>;
}

/**
 * A print backend. The single implementation lives in its own adapter package so that installing
 * the engine never downloads a browser.
 */
export interface PdfRenderStrategy {
  readonly format: 'pdf';
  open(resources: PdfRenderResources): Promise<PdfRenderSession>;
}

/**
 * Engine configuration, distinct from the render request: bounds are how the host protects itself,
 * not a third business field beside the template and the data.
 */
export interface RenderEngineOptions {
  readonly shapeLimits?: Partial<ShapeLimits> | undefined;
  readonly evaluationLimits?: Partial<EvaluationLimits> | undefined;
  /**
   * Which declared writing each profile the template names stands for, for this port.
   *
   * A construction argument, not a third field of a render request: the same stored template is
   * rendered in another language by opening a second port, and no key of the caller's data set is
   * ever read to find it. Read with `Object.hasOwn`, so an inherited name selects nothing.
   */
  readonly presentationSelection?: PresentationSelection | undefined;
}
