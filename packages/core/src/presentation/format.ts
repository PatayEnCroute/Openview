import { dayNumberOf } from '../expression/civil-date.js';
import type { Presentation } from './types.js';

/**
 * Milliseconds in a civil day: the only arithmetic between a date of this package and `Intl`.
 *
 * `civil-date.ts` yields a day number and `format` accepts a number of milliseconds, so the whole
 * conversion is one multiplication and no `Date` object is built anywhere. That is not a style
 * choice: `new Date(y, m, d)` builds in the host time zone, and `Date.UTC` maps years 0 to 99 onto
 * 1900 to 1999, which would silently misplace a date this package accepts.
 */
const MS_PER_DAY = 86_400_000;

/**
 * The zero every writing prints. `Object.is(-0, 0)` is false, and ICU can tell: a negative zero
 * prints with its sign, and `-0,00` on a total line is a defect a reader reports.
 *
 * Folded here and not in the algebra, whose `-0` is arithmetically correct -- only its writing is
 * wrong. It folds the exact negative zero and nothing else: `-0.001` at two decimals still prints
 * negative, because the value really is.
 */
function withoutNegativeZero(value: number): number {
  return value === 0 ? 0 : value;
}

/**
 * A number written as money in a declared writing, or `undefined` when the value is not finite --
 * the single cause of absence here.
 *
 * Total over any writing `resolvePresentation` returned, and over nothing else: `Presentation` is
 * structural, so a hand-built writing can carry values the schema would have refused, and ICU
 * raises on several of them out of this signature. Use only a resolved writing.
 *
 * Both fraction bounds are always passed, which is what makes CLDR's currency-to-minor-units table
 * unreachable and keeps the arithmetic declared by the model. `numberingSystem` is pinned, because
 * it reaches the amounts and not only the dates. `roundingMode` is deliberately not passed: it
 * would be a second spelling of the mode a `round` expression already declares, so callers round
 * first and format second. A formatter is built per call and never cached, since a cache would be
 * state in this package.
 *
 * @see docs/adr/0008-langue-devise-et-formats.md
 */
export function formatMoney(value: number, writing: Presentation): string | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return new Intl.NumberFormat(writing.locale, {
    style: 'currency',
    currency: writing.currency,
    numberingSystem: 'latn',
    minimumFractionDigits: writing.minFractionDigits,
    maximumFractionDigits: writing.maxFractionDigits,
  }).format(withoutNegativeZero(value));
}

/**
 * A number written as a plain quantity in a declared writing -- no currency symbol -- or
 * `undefined` when the value is not finite.
 *
 * Two functions rather than one with a `style` parameter: a parameter would need a dispatch, and a
 * dispatch would buy nothing over two total functions the compiler already keeps apart.
 *
 * Which of the two a given site needs is not decided here and cannot be: nothing in a stored
 * document distinguishes an order number from a total, and recognising one would mean reserving a
 * field name. That choice belongs to whoever wires the values.
 *
 * @see docs/adr/0008-langue-devise-et-formats.md
 */
export function formatDecimal(value: number, writing: Presentation): string | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return new Intl.NumberFormat(writing.locale, {
    numberingSystem: 'latn',
    minimumFractionDigits: writing.minFractionDigits,
    maximumFractionDigits: writing.maxFractionDigits,
  }).format(withoutNegativeZero(value));
}

/**
 * A civil date written in a declared writing, or `undefined` when the string is not a civil date
 * this package recognises.
 *
 * Three options are pinned, and only `timeZone` is tooled by the linter -- the silence on the other
 * two is a blind spot rather than a permission. Without `calendar` and `numberingSystem`, a correct
 * date prints a year off by centuries in some locales, with no error anywhere. `calendar: 'gregory'`
 * is pinned for good: another calendar would be a conversion of the datum, not a second spelling.
 *
 * The options object is written inline because the `no-environment-read` plugin compares source
 * text and needs the `timeZone` token in this call's argument list. Hoisting it would be refused,
 * and no `biome-ignore` rescues a plugin diagnostic.
 *
 * The date is parsed by `dayNumberOf` rather than sliced, which validates by round trip and keeps
 * the accepted range identical to the algebra's.
 *
 * @see docs/adr/0008-langue-devise-et-formats.md
 */
export function formatDate(value: string, writing: Presentation): string | undefined {
  const dayNumber = dayNumberOf(value);
  if (dayNumber === undefined) {
    return undefined;
  }
  return new Intl.DateTimeFormat(writing.locale, {
    timeZone: 'UTC',
    calendar: 'gregory',
    numberingSystem: 'latn',
    dateStyle: writing.dateStyle,
  }).format(dayNumber * MS_PER_DAY);
}
