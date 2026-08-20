import { z } from 'zod/v4';
import { wellFormedLocale } from './locale.js';
import {
  DATE_STYLES,
  MAX_FRACTION_DIGITS,
  MIN_FRACTION_DIGITS,
  type Presentation,
} from './types.js';

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

const INVERTED_BOUNDS_MESSAGE =
  'minFractionDigits is above maxFractionDigits. A writing prints at least its minimum and at most its maximum, so the pair has to be ordered.';

const refuseInvertedBounds = (payload: z.core.ParsePayload<Presentation>): void => {
  if (payload.issues.length > 0) {
    return;
  }
  if (payload.value.minFractionDigits <= payload.value.maxFractionDigits) {
    return;
  }
  payload.issues.push({
    code: 'custom',
    message: INVERTED_BOUNDS_MESSAGE,
    path: ['maxFractionDigits'],
    input: payload.value,
  });
};

const fractionDigitsSchema = z
  .int('A number of fraction digits is a whole number')
  .min(
    MIN_FRACTION_DIGITS,
    `A number of fraction digits cannot be negative (minimum ${MIN_FRACTION_DIGITS})`,
  )
  .max(MAX_FRACTION_DIGITS, `A writing declares at most ${MAX_FRACTION_DIGITS} fraction digits`);

/**
 * Zod schema for a presentation writing declaration.
 */
export const PresentationSchema = z
  .object({
    locale: z
      .string()
      .refine(
        (tag) => wellFormedLocale(tag) !== undefined,
        'A locale must be a structurally valid language tag under ECMA-402, carrying no "-u-" extension. Whether a given engine honours the tag is asked at render time.',
      ),
    currency: z
      .string()
      .regex(
        CURRENCY_PATTERN,
        'A currency is an ISO 4217 alphabetic code in upper case, three letters: "EUR", "USD", "JPY". Lower case is refused so that one currency has one spelling',
      ),
    minFractionDigits: fractionDigitsSchema,
    maxFractionDigits: fractionDigitsSchema,
    dateStyle: z.enum(DATE_STYLES, 'A date style is one of "short", "medium", "long", "full"'),
  })
  .check(refuseInvertedBounds);

const UNNAMED_WRITING_MESSAGE = 'A writing needs a name, and the empty string is not one.';

const refuseUnnamedWriting = (payload: z.core.ParsePayload<Record<string, Presentation>>): void => {
  if (payload.issues.length > 0) {
    return;
  }
  for (const name of Object.keys(payload.value)) {
    if (name === '') {
      payload.issues.push({
        code: 'custom',
        message: UNNAMED_WRITING_MESSAGE,
        path: [name],
        input: payload.value,
      });
    }
  }
};

/**
 * Zod schema for stored presentation tables.
 */
export const PresentationTableSchema = z
  .record(z.string(), PresentationSchema)
  .check(refuseUnnamedWriting);
