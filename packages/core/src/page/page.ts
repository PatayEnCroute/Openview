/**
 * The page contract: what a template says about the paper it prints on.
 *
 * Barrel by design -- consumers import from here, never from ./types.js or ./schemas.js,
 * so the split inside this folder stays free to change. Lot C3 had to pay for that split
 * after the fact, in a dedicated increment; this folder is born divided.
 *
 * `PAGE_FIELDS`, `PageField` and the page-field SEGMENT are deliberately NOT here: they
 * live in `ast/`, beside `TextSegment`, because a marker is inline content. So `page/`
 * depends on `ast/` and never the other way round -- if the tuple lived here,
 * `ast/schemas.ts` would import a VALUE from `page/` while `page/schemas.ts` already
 * imports `ContainerNodeSchema` from `ast/schemas.ts`, which is the configuration where
 * ESM initialisation order starts to matter.
 */
export { printableAreaOf } from './area.js';
export {
  PAGE_SETUP_SCHEMA_SATISFIES_TYPE,
  PageBandSchema,
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
