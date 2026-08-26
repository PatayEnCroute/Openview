import type { ContainerNode } from '../ast/nodes.js';

/** Sheet dimensions in millimeters. */
export interface Sheet {
  readonly width: number;
  readonly height: number;
}

/** Page margins in millimeters on all four sides. */
export interface PageMargins {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/** Page domain occurrences for header/footer bands. */
export const PAGE_BAND_OCCURRENCES = [
  'every',
  'firstOnly',
  'exceptFirst',
  'exceptLast',
  'lastOnly',
] as const;

export type PageBandOccurrence = (typeof PAGE_BAND_OCCURRENCES)[number];

/** Repeated page band (header or footer) containing a block container. */
export interface PageBand {
  readonly on: PageBandOccurrence;
  readonly content: ContainerNode;
}

/** The two planes a page layer can be painted on, behind or in front of the paged content. */
export const PAGE_LAYER_PLANES = ['background', 'foreground'] as const;

export type PageLayerPlane = (typeof PAGE_LAYER_PLANES)[number];

/**
 * One page layer: painted on every page, stretched to the whole sheet, out of the flow.
 *
 * Within a plane, the stored order is the back-to-front order. The content carries the layer's
 * identity, exactly as a band's content does; `opacity` applies to the whole layer and is strictly
 * between 0 and 1 -- absence means opaque.
 */
export interface PageLayer {
  readonly plane: PageLayerPlane;
  readonly opacity?: number | undefined;
  readonly content: ContainerNode;
}

/** Global page layout configuration: sheet size, margins, page bands, and page layers. */
export interface PageSetup {
  readonly sheet: Sheet;
  readonly margins: PageMargins;
  readonly header: readonly PageBand[];
  readonly footer: readonly PageBand[];
  /** Absent means no layer; an empty list is refused so absence has one spelling. */
  readonly layers?: readonly PageLayer[] | undefined;
}

/** Usable printable area dimensions in millimeters. */
export interface PrintableArea {
  readonly width: number;
  readonly height: number;
}

export const MIN_SHEET_MM = 1;
export const MAX_SHEET_MM = 5080;

/** Standard sheet dimensions in millimeters. */
export const STANDARD_SHEETS_MM = {
  a3: { width: 297, height: 420 },
  a4: { width: 210, height: 297 },
  a5: { width: 148, height: 210 },
  a6: { width: 105, height: 148 },
  letter: { width: 215.9, height: 279.4 },
  legal: { width: 215.9, height: 355.6 },
  tabloid: { width: 279.4, height: 431.8 },
} as const satisfies Readonly<Record<string, Sheet>>;

export type StandardSheetName = keyof typeof STANDARD_SHEETS_MM;
