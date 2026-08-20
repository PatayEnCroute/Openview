/**
 * Presentation contract: locale, currency, fraction digits and date styles, plus the four pure
 * functions that honour a declared writing.
 *
 * Barrel by design: consumers import from here, never from the files behind it.
 *
 * Not exported, deliberately: the two locale predicates, which no consumer outside this package
 * names; any list of locales or currencies, since Openview holds no referential; any bounded parse
 * door, since a writing lives on a `Template` that `parseTemplate` already validates.
 *
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
} from './types.js';
