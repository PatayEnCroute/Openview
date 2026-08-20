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

/** Global page layout configuration: sheet size, margins, and page bands. */
export interface PageSetup {
  readonly sheet: Sheet;
  readonly margins: PageMargins;
  readonly header: readonly PageBand[];
  readonly footer: readonly PageBand[];
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
