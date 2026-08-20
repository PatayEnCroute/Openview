/**
 * Page setup barrel: sheet definitions, page margins, occurrences, bands, and printable area.
 */
export { printableAreaOf } from './area.js';
export {
  MAX_BANDS_PER_SIDE,
  PAGE_SETUP_SCHEMA_SATISFIES_TYPE,
  PageBandSchema,
  PageBandsSchema,
  PageMarginsSchema,
  PageSetupSchema,
  SheetSchema,
} from './schemas.js';
export type {
  PageBand,
  PageBandOccurrence,
  PageMargins,
  PageSetup,
  PrintableArea,
  Sheet,
  StandardSheetName,
} from './types.js';
export { MAX_SHEET_MM, MIN_SHEET_MM, PAGE_BAND_OCCURRENCES, STANDARD_SHEETS_MM } from './types.js';
