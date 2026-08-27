/**
 * Presentation contract: locale, currency, fraction digits, date styles, and formatting functions.
 * @see docs/adr/0008-langue-devise-et-formats.md
 */
export {
  formatDate,
  formatDecimal,
  formatMoney,
} from './format.js';
export { resolvePresentation } from './resolve.js';
export {
  PresentationSchema,
  PresentationTableSchema,
} from './schemas.js';
export type {
  DateStyle,
  Presentation,
  PresentationRefusal,
  PresentationResolution,
  PresentationTable,
} from './types.js';
export {
  DATE_STYLES,
  MAX_FRACTION_DIGITS,
  MIN_FRACTION_DIGITS,
  PRESENTATION_REFUSALS,
} from './types.js';
