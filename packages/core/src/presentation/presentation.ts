/**
 * The writing contract: what a template says about the language, the money and the shape of the
 * digits its values take.
 *
 * Barrel by design -- consumers import from here, never from `./types.js`, `./schemas.js` or
 * `./locale.js`, so the split inside this folder stays free to change.
 *
 * Deliberately not exported: `wellFormedLocale` and `honouredLocale`, which no consumer outside
 * this package names; any list of locales or currencies, since Openview holds no referential; any
 * bounded parse door of its own, since a writing lives on a `Template` that `parseTemplate`
 * already validates.
 *
 * @see docs/adr/0008-langue-devise-et-formats.md
 */
export { PresentationSchema, PresentationTableSchema } from './schemas.js';
export type {
  DateStyle,
  Presentation,
  PresentationRefusal,
  PresentationResolution,
  PresentationTable,
} from './types.js';
export { DATE_STYLES, MAX_FRACTION_DIGITS, MIN_FRACTION_DIGITS } from './types.js';
