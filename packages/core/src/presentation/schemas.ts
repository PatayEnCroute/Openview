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

/**
 * Refuses a pair of fraction bounds in the wrong order, once the rest of the object is sound.
 *
 * The cut-off is the point: a continuable fault on one bound leaves that field out of the
 * payload's value, so a predicate that read it would add a second issue for the same fault. An
 * author who has one thing to fix must be told once.
 *
 * `.check` with a payload is the only zod 4 form that can express it, because the payload carries
 * `issues` beside `value`. The path names the field and not the object, so an editor can place a
 * marker; the `custom` code belongs to no error catalogue.
 */
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
  .int(
    'A number of fraction digits is a whole number, present on every writing: 2 for cents, 0 for a count, never 2.5',
  )
  .min(
    MIN_FRACTION_DIGITS,
    `A number of fraction digits cannot be negative (minimum ${MIN_FRACTION_DIGITS})`,
  )
  .max(
    MAX_FRACTION_DIGITS,
    `A writing declares at most ${MAX_FRACTION_DIGITS} fraction digits, the finest rounding a model can declare (MAX_ROUND_DECIMALS). Past it, the digits could only come from a value nobody rounded`,
  );

/**
 * The Zod side of the writing contract.
 *
 * The locale check asks {@link wellFormedLocale} and only that: grammar, no `-u-` extension. It
 * must not ask whether the reader's ICU honours the tag, because that answer moves between builds
 * and a stored document gated on a moving answer opens on one machine and not on another.
 * `resolvePresentation` asks that half, at render.
 *
 * It is a `.refine` on the FIELD, so a refusal carries the path `['locale']` and produces exactly
 * one issue. It does not normalise, it does not check a currency against a register, and it does
 * not decide that a locale and a currency belong together -- that would be a business rule.
 *
 * No schema in this file carries a `z.ZodType<T>` annotation: nothing here is recursive, and the
 * annotation would destroy the key assertions in `__tests__/` that guard against a field drifting
 * out of step.
 *
 * @see docs/adr/0008-langue-devise-et-formats.md
 */
export const PresentationSchema = z
  .object({
    locale: z
      .string()
      .refine(
        (tag) => wellFormedLocale(tag) !== undefined,
        'A locale must be a structurally valid language tag under ECMA-402, carrying no "-u-" extension: "fr-FR", "en-GB", "zh-Hans-CN". Whether a given engine HONOURS the tag -- resolves it to itself rather than to something shorter -- is a separate question, asked at render time, because its answer depends on the ICU build that opens the document rather than on the document',
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

const UNNAMED_WRITING_MESSAGE =
  'A writing needs a name, and the empty string is not one: it is the one name a caller cannot ask for on purpose.';

/**
 * Refuses a table entry whose key is empty, once nothing else is wrong with the table.
 *
 * Written by hand rather than declared as `z.record(z.string().min(1), ...)`, because a failing key
 * schema yields zod's own message on the empty path -- naming the table instead of the entry.
 * Here the path IS the offending key, so a Designer can highlight the row.
 */
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
 * The stored table: writings by the name the model author chose. The key is validated minimally --
 * it must not be empty -- and nothing else about a name is this package's business.
 *
 * `z.record` drops a `__proto__` key, so this field cannot pollute a prototype, but the object it
 * returns still inherits from `Object.prototype`. That is why `resolvePresentation` exists as a
 * function rather than as a property read.
 */
export const PresentationTableSchema = z
  .record(z.string(), PresentationSchema)
  .check(refuseUnnamedWriting);
