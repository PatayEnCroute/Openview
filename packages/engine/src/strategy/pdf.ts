import type { EvaluationLimits, ShapeLimits, Sheet } from '@openview/core';
import type { DocumentImage } from '../document/images.js';
import type { PresentationSelection } from '../document/presentation.js';
import type { DocumentRegion } from '../errors.js';

/** Payload handed to a PDF print adapter (HTML source, target sheet, image references). */
export interface PdfSourceDocument {
  readonly html: string;
  readonly sheet: Sheet;
  readonly images: readonly DocumentImage[];
}

/** Pre-render resources required when opening a PDF layout session. */
export interface PdfRenderResources {
  readonly sheet: Sheet;
  readonly images: readonly DocumentImage[];
}

/** Width and height of one painted box, in CSS pixels. */
export interface BoxMeasurement {
  readonly width: number;
  readonly height: number;
}

/** Layout and content measurements of a vertical page region. */
export interface RegionMeasurement {
  readonly region: DocumentRegion;
  /** Height of the region's own box allocated by layout. */
  readonly height: number;
  /** Actual content height reached by descendant elements. */
  readonly contentHeight: number;
}

/** Page sheet and region dimensions from a layout pass. */
export interface PageMeasurement {
  readonly page: BoxMeasurement;
  readonly printable: BoxMeasurement;
  readonly regions: readonly RegionMeasurement[];
}

/** Dimensions of an annotated element box from layout measurement. */
export interface LayoutBoxMeasurement {
  readonly key: string;
  readonly width: number;
  readonly height: number;
}

/** Visual text line break position and cumulative height from layout measurement. */
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

/** Complete layout measurement report returned by a headless browser session. */
export interface PdfLayoutMeasurement {
  readonly pages: readonly PageMeasurement[];
  readonly boxes: readonly LayoutBoxMeasurement[];
  readonly lines: readonly TextLineMeasurement[];
  readonly images: readonly ImageMeasurement[];
  /** Declaration ids whose painted box escaped the page sheet boundaries. */
  readonly escaping: readonly string[];
  /** Declaration ids of grid-zone containers whose content overflows their allocated cell. */
  readonly overflowingGridItems: readonly string[];
  /** Count of page markers whose rendered width exceeded their reserved container width. */
  readonly clippedMarkerCount: number;
}

/** Active browser session handling layout measurements and final PDF printing. */
export interface PdfRenderSession {
  measure(document: PdfSourceDocument): Promise<PdfLayoutMeasurement>;
  print(document: PdfSourceDocument): Promise<Uint8Array>;
  close(): Promise<void>;
}

/** Strategy port for PDF rendering backends. */
export interface PdfRenderStrategy {
  readonly format: 'pdf';
  open(resources: PdfRenderResources): Promise<PdfRenderSession>;
}

/** Configuration options for the rendering engine. */
export interface RenderEngineOptions {
  readonly shapeLimits?: Partial<ShapeLimits> | undefined;
  readonly evaluationLimits?: Partial<EvaluationLimits> | undefined;
  /** Mapping from template presentation profile names to declared writing keys. */
  readonly presentationSelection?: PresentationSelection | undefined;
}
