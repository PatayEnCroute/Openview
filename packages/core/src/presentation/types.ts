import { MAX_ROUND_DECIMALS } from '../expression/types.js';

/**
 * The four date skeletons a writing may declare.
 *
 * Skeletons, not patterns: `long` means "the long form of THIS locale", so one stored model
 * prints a date correctly in every declared language. A pattern such as `dd/MM/yyyy` is refused,
 * because it would make the template the owner of the field order.
 *
 * @see docs/adr/0008-langue-devise-et-formats.md
 */
export const DATE_STYLES = ['short', 'medium', 'long', 'full'] as const;

export type DateStyle = (typeof DATE_STYLES)[number];

/** No writing prints a negative number of decimals. */
export const MIN_FRACTION_DIGITS = 0;

/**
 * The finest writing a template may declare, imported from the rounding algebra rather than
 * restated: a writing finer than the finest declarable rounding could only print unrounded noise.
 *
 * Not ICU's ceiling, which is a property of the engine and would be wrong to publish in a stored
 * contract.
 */
export const MAX_FRACTION_DIGITS = MAX_ROUND_DECIMALS;

/**
 * One writing of the values a document prints: which language, which money, how many decimals,
 * which date form. A template declares a table of these and the caller picks one by name.
 *
 * Every field is required and none carries a default, so Openview never owns a language or a
 * money. Naming both fraction bounds is what makes CLDR's currency-to-minor-units table
 * unreachable, which keeps the arithmetic declared by the model.
 *
 * It does not say WHICH SITES of a document are written this way; that is the engine's half of
 * the seam.
 *
 * @see docs/adr/0008-langue-devise-et-formats.md
 */
export interface Presentation {
  /**
   * A language tag, judged by two gates: `PresentationSchema` checks its grammar at parse, and
   * `resolvePresentation` checks that this engine honours it at render.
   *
   * The second verdict depends on the reader's ICU build, so a well-formed but unknown tag is
   * storable and refused only at render. "Honoured" means both formatters resolve the tag to
   * itself, which obliges the author to write the minimised form.
   */
  readonly locale: string;
  /** An ISO 4217 alphabetic code, checked by shape (`^[A-Z]{3}$`) and never against a register. */
  readonly currency: string;
  /** Lower bound, in `[MIN_FRACTION_DIGITS, MAX_FRACTION_DIGITS]` and never above the maximum. */
  readonly minFractionDigits: number;
  /**
   * Upper bound, in `[MIN_FRACTION_DIGITS, MAX_FRACTION_DIGITS]`.
   *
   * Below the value's own scale ICU rounds, with its own default mode. Callers round before
   * formatting.
   */
  readonly maxFractionDigits: number;
  /** The form dates take in this writing. One per writing, not one per site. */
  readonly dateStyle: DateStyle;
}

/**
 * The table a template stores: writings, by a name the model author chose.
 *
 * Openview reserves no key. Read it through `resolvePresentation` and never by index: the object
 * inherits from `Object.prototype`, so an index read answers a non-`undefined` for names nobody
 * declared.
 */
export type PresentationTable = Readonly<Record<string, Presentation>>;

/**
 * Why a writing could not be resolved. The three causes have three different remedies, so a
 * caller must not merge them.
 *
 * `'unknown-writing'` -- the CALL is wrong: no entry under that name, or no table at all.
 * `'invalid-writing'` -- the DOCUMENT is wrong, portably: the entry never met the schema.
 * `'unhonoured-locale'` -- neither is wrong: this engine does not honour the tag as written.
 *
 * A closed list of this package's own gates, not a referential. It is a return type, never
 * persisted, so widening it moves no `schemaVersion`.
 */
export type PresentationRefusal = 'unknown-writing' | 'invalid-writing' | 'unhonoured-locale';

/**
 * What `resolvePresentation` answers: one writing, or the reason there is none.
 *
 * Discriminated on `ok`, so a consumer narrows with one `if` and an exhaustive `switch` over
 * {@link PresentationRefusal} closes with `const exhaustive: never`. It is an answer and not an
 * error: nothing is thrown, and the caller decides whether it is fatal.
 */
export type PresentationResolution =
  | { readonly ok: true; readonly writing: Presentation }
  | { readonly ok: false; readonly refusal: PresentationRefusal };
