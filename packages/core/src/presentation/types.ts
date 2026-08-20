import { MAX_ROUND_DECIMALS } from '../expression/types.js';

/** Standard date formatting styles supported by Intl.DateTimeFormat. */
export const DATE_STYLES = ['short', 'medium', 'long', 'full'] as const;

export type DateStyle = (typeof DATE_STYLES)[number];

export const MIN_FRACTION_DIGITS = 0;

/** Maximum fraction digits allowed in presentation writing. */
export const MAX_FRACTION_DIGITS = MAX_ROUND_DECIMALS;

/**
 * Presentation configuration for currency, numbers, and dates.
 */
export interface Presentation {
  /** Canonical BCP-47 language tag (e.g. "fr-FR", "en-US"). */
  readonly locale: string;
  /** ISO 4217 uppercase 3-letter currency code (e.g. "EUR", "USD"). */
  readonly currency: string;
  /** Minimum fraction digits, bounded by MIN_FRACTION_DIGITS and maxFractionDigits. */
  readonly minFractionDigits: number;
  /** Maximum fraction digits, bounded by minFractionDigits and MAX_FRACTION_DIGITS. */
  readonly maxFractionDigits: number;
  /** Date formatting style. */
  readonly dateStyle: DateStyle;
}

/** Presentation table mapping custom writing names to configurations. */
export type PresentationTable = Readonly<Record<string, Presentation>>;

/** Refusal reasons when resolving a presentation writing. */
export type PresentationRefusal = 'unknown-writing' | 'invalid-writing' | 'unhonoured-locale';

/** Result of resolving a presentation writing by name. */
export type PresentationResolution =
  | { readonly ok: true; readonly writing: Presentation }
  | { readonly ok: false; readonly refusal: PresentationRefusal };
