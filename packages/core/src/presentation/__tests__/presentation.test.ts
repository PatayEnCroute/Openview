import { describe, expect, it } from 'vitest';
import type { z } from 'zod/v4';
import type { MutuallyAssignable } from '../../ast/__tests__/fixtures.js';
import { MAX_ROUND_DECIMALS } from '../../expression/types.js';
import * as core from '../../index.js';
import { parseTemplate, TEMPLATE_MIGRATIONS } from '../../template/migrate.js';
import { CURRENT_SCHEMA_VERSION } from '../../template/template.js';
import { formatDate, formatDecimal, formatMoney } from '../format.js';
import { honouredLocale, wellFormedLocale } from '../locale.js';
import { resolvePresentation } from '../resolve.js';
import { PresentationSchema, PresentationTableSchema } from '../schemas.js';
import {
  DATE_STYLES,
  MAX_FRACTION_DIGITS,
  MIN_FRACTION_DIGITS,
  type Presentation,
  type PresentationRefusal,
  type PresentationTable,
} from '../types.js';

/**
 * The two assertions the compiler plays, rather than the runner.
 *
 * `keyof` catches presence -- a field removed from the schema, or added to it -- and the value pair
 * catches a type drift, such as a schema saying `string` where the interface says `number`. Neither
 * subsumes the other; both together stay blind to a field that turns optional in an object whose
 * every field would be, and that blind spot does not exist here because `Presentation` has no
 * optional field at all.
 *
 * Measured: an optional field added to the interface alone, or to the schema alone, passes all four
 * gates at exit 0 without these two annotations, and yields `TS2322` with them.
 *
 * They are `const` and not `it` because there is nothing to run: the guard is the annotation, and
 * `pnpm run type-check` plays it. They are exported so `noUnusedLocals` does not flag them.
 */
export const PRESENTATION_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof PresentationSchema>,
  keyof Presentation
> = true;

export const PRESENTATION_VALUES_IN_STEP: MutuallyAssignable<
  z.infer<typeof PresentationSchema>,
  Presentation
> = true;

/** A sound writing, with fields overridden. Typed loose on purpose, so no cast is ever needed. */
const writing = (overrides: Record<string, unknown> = {}): unknown => ({
  locale: 'fr-FR',
  currency: 'EUR',
  minFractionDigits: 2,
  maxFractionDigits: 2,
  dateStyle: 'long',
  ...overrides,
});

/**
 * The first issue of a refused parse, or `undefined` when the candidate was accepted.
 *
 * It takes `unknown`, which is what removes the need for a cast anywhere in this file.
 */
const firstIssue = (
  schema: typeof PresentationSchema | typeof PresentationTableSchema,
  candidate: unknown,
): { code: string; message: string; path: string } | undefined => {
  const parsed = schema.safeParse(candidate);
  if (parsed.success) {
    return undefined;
  }
  const issue = parsed.error.issues[0];
  if (issue === undefined) {
    return undefined;
  }
  return { code: issue.code, message: issue.message, path: issue.path.join('.') };
};

/** How many issues one fault produced. The cut-off rule says: always exactly one. */
const issueCount = (
  schema: typeof PresentationSchema | typeof PresentationTableSchema,
  candidate: unknown,
): number => {
  const parsed = schema.safeParse(candidate);
  return parsed.success ? 0 : parsed.error.issues.length;
};

/**
 * Every digit of a printed value, separators and symbols removed.
 *
 * The general tool of this file: it survives any CLDR release because it removes everything CLDR
 * put there. No formatted string is pinned anywhere here -- `1 234,50 €` in `fr-FR` carries U+202F
 * between the digits and U+00A0 before the symbol, and the U+202F arrived with CLDR 42, while the
 * CI runs two Node majors and therefore two CLDR data sets.
 */
const digitsOf = (printed: string | undefined): string => (printed ?? '').replace(/[^0-9]/gu, '');

/** Two declared writings differing in every field, and a table that holds both. */
const FR: Presentation = {
  locale: 'fr-FR',
  currency: 'EUR',
  minFractionDigits: 2,
  maxFractionDigits: 2,
  dateStyle: 'long',
};

const EN: Presentation = {
  locale: 'en-US',
  currency: 'USD',
  minFractionDigits: 2,
  maxFractionDigits: 2,
  dateStyle: 'long',
};

const TABLE: PresentationTable = { 'montant-en': EN, 'montant-fr': FR };

/**
 * A table whose writing carries a `locale` of `null` rather than a bad string.
 *
 * A source string parsed at use, because a caller in plain JavaScript can hand this and the
 * repository forbids the cast that would express it in TypeScript.
 */
const NULL_LOCALE_TABLE =
  '{"x":{"locale":null,"currency":"EUR","minFractionDigits":2,"maxFractionDigits":2,"dateStyle":"long"}}';

/** A writing built from {@link FR} with fields replaced. Typed, so only legal values pass. */
const like = (overrides: Partial<Presentation>): Presentation => ({ ...FR, ...overrides });

describe('a locale is judged twice, and the two judgements are deliberately not the same', () => {
  it('accepts at parse the tags a hand-written tuple forgets', () => {
    // A tuple of the six obvious tags refuses the last four, all of which are legitimate. A closed
    // list would also make Openview the holder of a language referential.
    for (const locale of ['fr-FR', 'en-US', 'de-DE', 'br-FR', 'es-419', 'zh-Hans-CN']) {
      expect(PresentationSchema.safeParse(writing({ locale })).success).toBe(true);
    }
  });

  it('stores a well-formed tag this engine does not know, and refuses it only at render', () => {
    // The seam. These tags are grammatically impeccable and merely unknown, and being unknown is a
    // property of the reader rather than of the document: measured, 527 tags are honoured on ICU
    // 77.1 against 525 on 76.1, `en-FR` among the two that move. Gating a stored field on that
    // answer would make one template open on one Node and fail to open on another.
    for (const locale of ['zz', 'fr-XX', 'xx-YY']) {
      expect(PresentationSchema.safeParse(writing({ locale })).success).toBe(true);
      expect(honouredLocale(locale)).toBeUndefined();
    }
  });

  it('refuses at render a tag ICU knows but resolves to something shorter', () => {
    // The render gate is a policy stricter than ICU's capability: a writing is honoured only if both
    // formatters resolve its tag to itself. Measured, `en-Latn-US` and `ca-ES-valencia` are
    // supported by ICU and minimised to `en` and `ca-ES`. The price is the author's -- write the
    // minimised tag -- and it buys a document that says what it prints, character for character.
    for (const locale of ['en-Latn-US', 'ca-ES-valencia']) {
      expect(wellFormedLocale(locale)).toBe(locale);
      expect(honouredLocale(locale)).toBeUndefined();
    }
    expect(honouredLocale('en')).toBe('en');
    expect(honouredLocale('ca-ES')).toBe('ca-ES');
  });

  it('refuses a "-u-" extension by name, on the canonical form and not on the tag as written', () => {
    // Measured, `fr-FR-u-nu-thai` passes the equality test -- both formatters resolve it to itself
    // -- so the extension has to be refused by name or not at all.
    expect(wellFormedLocale('fr-FR-u-nu-thai')).toBeUndefined();
    // And `en-US-posix` carries no `-u-` while canonicalising into one that does. A check on the raw
    // string would let this one through and then hand `Intl` the extension the contract refuses.
    expect(Intl.getCanonicalLocales('en-US-posix')[0]).toBe('en-US-u-va-posix');
    expect(wellFormedLocale('en-US-posix')).toBeUndefined();
  });

  it('refuses a malformed tag through the RangeError, and canonicalises a legitimate spelling', () => {
    // Measured: each of these raises `RangeError: Incorrect locale information provided`.
    // `en-GB-oed` raises too, though it is a valid grandfathered BCP-47 tag -- which is why the
    // published message says ECMA-402 and not BCP-47.
    for (const locale of ['i-klingon', '', 'fr_FR', 'root', 'en-GB-oed']) {
      expect(wellFormedLocale(locale)).toBeUndefined();
      // And through `honouredLocale` directly, because the resolver parses first: the schema has
      // already refused every malformed tag, so this branch is no longer reachable through it. A
      // branch covered by a unit test is not a dead branch.
      expect(honouredLocale(locale)).toBeUndefined();
    }
    // The canonical spelling is what comes back, because comparing the raw tag would accept
    // `FR-fr` while having compared against `fr-FR`.
    expect(wellFormedLocale('FR-fr')).toBe('fr-FR');
    expect(honouredLocale('FR-fr')).toBe('fr-FR');
  });

  it('shows the hole it exists to close, without ever naming the host locale', () => {
    // The tag is explicit, so the `no-environment-read` plugin does not bite -- an arity-zero
    // `Intl.NumberFormat()` is refused, and no spelling of `biome-ignore` rescues a plugin
    // diagnostic. The property shown is that an unknown tag falls back to the machine, and it is
    // shown without pinning what the machine is, so the test is true on any host.
    expect(new Intl.NumberFormat('zz').resolvedOptions().locale).not.toBe('zz');
  });
});

describe('every refusal is named once, with a path and a legible message', () => {
  it('reports one issue per fault, never two', () => {
    // The cut-off rule. A continuable fault on one bound leaves that field out of the payload's
    // value, so a naive cross-field predicate reads `undefined`, compares it, and adds a second
    // issue for the same fault.
    expect(issueCount(PresentationSchema, writing({ currency: 'eur' }))).toBe(1);
    expect(issueCount(PresentationSchema, writing({ minFractionDigits: -1 }))).toBe(1);
    expect(issueCount(PresentationSchema, writing({ minFractionDigits: 2.5 }))).toBe(1);
    expect(
      issueCount(PresentationSchema, writing({ maxFractionDigits: 2, minFractionDigits: 3 })),
    ).toBe(1);
    expect(issueCount(PresentationSchema, writing({ locale: 'i-klingon' }))).toBe(1);
    expect(issueCount(PresentationSchema, writing({ dateStyle: 'iso' }))).toBe(1);
  });

  it('puts an inverted pair of bounds on a field and not on the object', () => {
    // An issue with an empty path names the object, and an editor has nothing to mark.
    const issue = firstIssue(
      PresentationSchema,
      writing({ maxFractionDigits: 2, minFractionDigits: 3 }),
    );
    expect(issue?.code).toBe('custom');
    expect(issue?.path).toBe('maxFractionDigits');
    expect(issue?.message).toContain('minFractionDigits is above maxFractionDigits');
  });

  it('publishes a locale message that names the other gate, and accuses the author of nothing', () => {
    // A parse message has to be true on every machine that will read the document, so it cannot say
    // the engine honours the tag "exactly as written" -- that accuses an author of a fault belonging
    // to the reader's ICU build. The negative assertion is what makes a return to it red.
    const issue = firstIssue(PresentationSchema, writing({ locale: 'i-klingon' }));
    expect(issue?.path).toBe('locale');
    expect(issue?.message).toContain('structurally valid language tag under ECMA-402');
    expect(issue?.message).toContain('render time');
    expect(issue?.message).not.toContain('honours exactly as written');
  });

  it('refuses a currency by shape, and says why lower case is not a second spelling', () => {
    // Measured, ICU accepts `eur`, so accepting it here would give one currency two spellings.
    const issue = firstIssue(PresentationSchema, writing({ currency: 'eur' }));
    expect(issue?.code).toBe('invalid_format');
    expect(issue?.path).toBe('currency');
    expect(issue?.message).toContain('ISO 4217 alphabetic code in upper case');
  });

  it('names each of the five missing fields on its own path, with the code zod actually gives', () => {
    // The codes are not uniform between fields: `z.enum` compares against a member list, so an
    // absent `dateStyle` is `invalid_value` and not `invalid_type`. The table is written code by
    // code rather than asserted uniform, because the field a Designer will most often leave absent
    // is exactly the one that breaks the uniform claim.
    const expected: ReadonlyArray<readonly [string, string]> = [
      ['locale', 'invalid_type'],
      ['currency', 'invalid_type'],
      ['minFractionDigits', 'invalid_type'],
      ['maxFractionDigits', 'invalid_type'],
      ['dateStyle', 'invalid_value'],
    ];
    for (const [field, code] of expected) {
      const candidate: Record<string, unknown> = { ...(writing() as Record<string, unknown>) };
      delete candidate[field];
      const issue = firstIssue(PresentationSchema, candidate);
      expect(issue?.path).toBe(field);
      expect(issue?.code).toBe(code);
    }
  });

  it('refuses a date style it does not name, and an empty writing name', () => {
    // The empty key is refused by a hand-written predicate: measured,
    // `z.record(z.string().min(1), ...)` yields `invalid_key` with zod's own message on the empty
    // path, which names the table rather than the entry. Written by hand, the path is the key.
    const style = firstIssue(PresentationSchema, writing({ dateStyle: 'iso' }));
    expect(style?.code).toBe('invalid_value');
    expect(style?.path).toBe('dateStyle');
    expect(style?.message).toContain('A date style is one of');

    const unnamed = firstIssue(PresentationTableSchema, { '': writing() });
    expect(unnamed?.code).toBe('custom');
    expect(unnamed?.path).toBe('');
    expect(unnamed?.message).toContain('A writing needs a name');

    // The cut-off across two levels: a continuable fault inside an entry whose name is also empty
    // yields one issue, and it is the entry's rather than the name's.
    expect(issueCount(PresentationTableSchema, { '': writing({ currency: 'eur' }) })).toBe(1);
    expect(firstIssue(PresentationTableSchema, { '': writing({ currency: 'eur' }) })?.path).toBe(
      '.currency',
    );

    // An ordinary name is accepted: refusing one would make Openview the owner of the key space.
    expect(PresentationTableSchema.safeParse({ montant: writing() }).success).toBe(true);
  });

  it('tells an author once when one bound is both out of range and inverted', () => {
    // Without the cut-off the author is told twice for one mistake: measured at two issues, one
    // with the cut-off in place.
    expect(issueCount(PresentationSchema, writing({ minFractionDigits: 99 }))).toBe(1);
  });

  it('pins both ends of the declarable fraction range', () => {
    // Both ends, because a schema that refuses 15 is as wrong as one that accepts 16 -- and because
    // a ceiling loosened from 15 to 50 survives a suite whose only case is 99.
    expect(
      PresentationSchema.safeParse(writing({ maxFractionDigits: 15, minFractionDigits: 0 }))
        .success,
    ).toBe(true);
    const tooFine = firstIssue(PresentationSchema, writing({ maxFractionDigits: 16 }));
    expect(tooFine?.code).toBe('too_big');
    expect(tooFine?.path).toBe('maxFractionDigits');
    const negative = firstIssue(PresentationSchema, writing({ minFractionDigits: -1 }));
    expect(negative?.code).toBe('too_small');
    expect(negative?.path).toBe('minFractionDigits');
  });

  it('refuses a currency of four letters, of two, and one carrying a digit', () => {
    // An exact length loosened to "three or four" survives a suite that never writes `ZZZZ`.
    for (const currency of ['ZZZZ', 'ZZ', '12A', 'ZZ1']) {
      const issue = firstIssue(PresentationSchema, writing({ currency }));
      expect(issue?.code).toBe('invalid_format');
      expect(issue?.path).toBe('currency');
    }
    // And a well-formed code ICU does not know is accepted: Openview holds no ISO 4217 register.
    expect(PresentationSchema.safeParse(writing({ currency: 'ZZZ' })).success).toBe(true);
  });

  it('refuses a candidate that is not an object, and an entry that is not one', () => {
    const notAnObject = firstIssue(PresentationSchema, 'fr-FR');
    expect(notAnObject?.code).toBe('invalid_type');
    expect(notAnObject?.path).toBe('');

    const badEntry = firstIssue(PresentationTableSchema, { montant: 3 });
    expect(badEntry?.code).toBe('invalid_type');
    expect(badEntry?.path).toBe('montant');
  });

  it('drops a `__proto__` key on the way out, and still returns an object that inherits', () => {
    // `JSON.parse` and not a literal, and that is obligatory rather than stylistic: a literal
    // `{ __proto__: ... }` sets the prototype instead of creating an own key, so the test would test
    // nothing. The first simplification of this line empties it.
    const entry =
      '{"locale":"fr-FR","currency":"EUR","minFractionDigits":2,"maxFractionDigits":2,"dateStyle":"long"}';
    const raw: unknown = JSON.parse(`{"montant-fr":${entry},"__proto__":${entry}}`);
    expect(Object.keys(raw as Record<string, unknown>)).toStrictEqual(['montant-fr', '__proto__']);

    const parsed = PresentationTableSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    // The table parses, the `__proto__` entry is gone from the result, and nothing on
    // `Object.prototype` moved. That is the half `z.record` gives for free.
    expect(parsed.success ? Object.keys(parsed.data) : null).toStrictEqual(['montant-fr']);
    expect(Reflect.get(Object.prototype, 'locale')).toBeUndefined();

    // And the half it does not give, which is why `resolvePresentation` guards its read: the
    // returned object still inherits, so an index read answers a plausible non-`undefined` for
    // names nobody declared.
    expect(parsed.success ? typeof parsed.data.constructor : null).toBe('function');
    expect(parsed.success ? Object.hasOwn(parsed.data, 'constructor') : null).toBe(false);
  });
});

describe('the bounds this contract publishes are derived, never restated', () => {
  it('derives its fraction ceiling from the rounding algebra, and pins both halves', () => {
    // Both halves on purpose: the first stops the derivation from being tidied into a literal, the
    // second stops the algebra's ceiling from drifting unnoticed. It is not ICU's ceiling --
    // measured, `maximumFractionDigits: 100` is accepted and 101 raises -- because ICU's ceiling
    // belongs to the engine, and a document is not reparsed when the host is upgraded.
    expect(MAX_FRACTION_DIGITS).toBe(MAX_ROUND_DECIMALS);
    expect(MAX_FRACTION_DIGITS).toBe(15);
    expect(MIN_FRACTION_DIGITS).toBe(0);
    expect(DATE_STYLES).toStrictEqual(['short', 'medium', 'long', 'full']);
  });
});

describe('picking a writing out of a table', () => {
  it('distinguishes two declared writings by the name the caller passes', () => {
    const fr = resolvePresentation(TABLE, 'montant-fr');
    const en = resolvePresentation(TABLE, 'montant-en');
    expect(fr).toStrictEqual({ ok: true, writing: FR });
    expect(en).toStrictEqual({ ok: true, writing: EN });
  });

  it('reads only the own entries of a table, never the inherited ones', () => {
    // A parsed table inherits from `Object.prototype`, so an index read answers a function for at
    // least eleven names nobody declared -- and a function's `.locale` is `undefined`, which is the
    // arity-zero call to `Intl` this contract exists to make unreachable. The guard is on the READ
    // and not on the key, because a writing legitimately called `constructor` is silly, not illegal.
    for (const name of ['constructor', 'toString', 'valueOf', 'hasOwnProperty']) {
      expect(resolvePresentation(TABLE, name)).toStrictEqual({
        ok: false,
        refusal: 'unknown-writing',
      });
    }
    const inherited: PresentationTable = Object.create(TABLE);
    expect(resolvePresentation(inherited, 'montant-fr')).toStrictEqual({
      ok: false,
      refusal: 'unknown-writing',
    });
  });

  it('answers unknown-writing for an absent table and for a name nobody declared', () => {
    expect(resolvePresentation(undefined, 'montant-fr')).toStrictEqual({
      ok: false,
      refusal: 'unknown-writing',
    });
    expect(resolvePresentation(TABLE, 'montant-de')).toStrictEqual({
      ok: false,
      refusal: 'unknown-writing',
    });
  });

  it('revalidates all five fields, because three of them are unprotected by the type', () => {
    // `Presentation` is structural: `currency` is a `string` and the two bounds are `number`s, so
    // only `dateStyle` is protected. Measured, a hand-built writing reaches ICU with four RangeError
    // families -- an invalid currency code, an inverted pair, a negative minimum, a malformed locale
    // -- plus one non-integer bound that ICU accepts and the schema refuses.
    const unsound: ReadonlyArray<Record<string, unknown>> = [
      { currency: 'AB' },
      { maxFractionDigits: 2, minFractionDigits: 5 },
      { minFractionDigits: -1 },
      { minFractionDigits: 2.5 },
      { locale: 'i-klingon' },
      { locale: '' },
    ];
    for (const overrides of unsound) {
      const table = JSON.parse(JSON.stringify({ x: { ...FR, ...overrides } })) as PresentationTable;
      expect(resolvePresentation(table, 'x')).toStrictEqual({
        ok: false,
        refusal: 'invalid-writing',
      });
    }
  });

  it('answers invalid-writing, and does not throw, for a writing whose locale is null', () => {
    // The order of the two gates is a correctness decision. Measured,
    // `Intl.getCanonicalLocales(null)` raises a `TypeError`, which `wellFormedLocale` re-throws by
    // design, so reading the locale before validating it would let an exception escape a total
    // signature. `JSON.parse` builds the untyped caller without a cast.
    const table = JSON.parse(NULL_LOCALE_TABLE) as PresentationTable;
    expect(() => resolvePresentation(table, 'x')).not.toThrow();
    // And the cause must be the document rather than this engine: a null locale is wrong everywhere.
    expect(resolvePresentation(table, 'x')).toStrictEqual({
      ok: false,
      refusal: 'invalid-writing',
    });
  });

  it('names the unhonoured locale as such, and not as a fault of the document', () => {
    // The one refusal a Designer must not blame on the author. `en-Latn-US` is the case that states
    // the policy: ICU supports it and minimises it to `en`.
    for (const locale of ['zz', 'fr-XX', 'en-Latn-US']) {
      expect(resolvePresentation({ x: like({ locale }) }, 'x')).toStrictEqual({
        ok: false,
        refusal: 'unhonoured-locale',
      });
    }
  });

  it('reaches all three refusals, and keeps them distinct', () => {
    // Before the result was discriminated, these outcomes were one `undefined`, so a mutation that
    // swapped two refusals was invisible to every test.
    const refusals: readonly PresentationRefusal[] = [
      resolvePresentation(TABLE, 'nobody-declared-this'),
      resolvePresentation(JSON.parse(NULL_LOCALE_TABLE) as PresentationTable, 'x'),
      resolvePresentation({ x: like({ locale: 'zz' }) }, 'x'),
    ].map((resolution) => (resolution.ok ? 'unknown-writing' : resolution.refusal));
    expect(refusals).toStrictEqual(['unknown-writing', 'invalid-writing', 'unhonoured-locale']);
    expect(new Set(refusals).size).toBe(3);
  });

  it('hands back a copy, canonicalised, carrying exactly the five declared keys', () => {
    // `FR-fr` in, `fr-FR` out: both are the same locale and only the second compares equal to
    // itself. The object is the one zod built, so a key the schema does not know is already gone --
    // and it is never the stored object, which a caller could otherwise normalise from underneath.
    const stored = { ...FR, horsSchema: 'ignored', locale: 'FR-fr' };
    const table = JSON.parse(JSON.stringify({ x: stored })) as PresentationTable;
    const resolved = resolvePresentation(table, 'x');
    expect(resolved).toStrictEqual({ ok: true, writing: { ...FR, locale: 'fr-FR' } });
    if (resolved.ok) {
      expect(Object.keys(resolved.writing)).toHaveLength(5);
      expect(resolved.writing).not.toBe(table.x);
    }
  });
});

describe('a number is written the way the model declared, and never the way ICU would', () => {
  it('round-trips through Number() when the writing has no grouping to do', () => {
    // The precision tool, and it has two preconditions that belong in the title: a decimal point
    // rather than a comma, and a value below the grouping threshold. Both belong to CLDR, so a
    // realistic amount substituted here would go red for a reason nobody could see.
    const printed = formatDecimal(123.5, EN);
    expect(Number(printed)).toBe(123.5);
    expect(digitsOf(printed)).toBe('12350');
  });

  it('makes the CLDR currency-to-minor-units table unreachable', () => {
    // Measured: by default `1234.5678` prints with zero decimals in JPY and three in TND, so digits
    // disappear from a document nobody rounded. Naming both bounds removes that table, and the
    // proof is a digit count rather than a pinned string.
    const counts = ['EUR', 'JPY', 'TND', 'ZZZ'].map((currency) =>
      digitsOf(formatMoney(1234.5678, like({ currency }))),
    );
    expect(new Set(counts).size).toBe(1);
    expect(counts[0]).toBe('123457');
  });

  it('pads to the minimum and truncates at the maximum, both as declared', () => {
    // A minimum below the maximum is a trailing-zero policy, and a document that decides it per
    // value has decided it by accident.
    expect(digitsOf(formatDecimal(1.5, like({ maxFractionDigits: 2, minFractionDigits: 2 })))).toBe(
      '150',
    );
    expect(digitsOf(formatDecimal(1.5, like({ maxFractionDigits: 2, minFractionDigits: 0 })))).toBe(
      '15',
    );
    expect(
      digitsOf(formatDecimal(1.23456789, like({ maxFractionDigits: 4, minFractionDigits: 0 }))),
    ).toBe('12346');
  });

  it('pins the numbering system, on the amounts and not only on the dates', () => {
    // Without the pin, `ar-EG` prints eastern digits, and `digitsOf` keeps only the latin ones, so
    // the assertion goes red on an empty string rather than on a wrong one.
    expect(digitsOf(formatMoney(1234.5, like({ locale: 'ar-EG' })))).toBe('123450');
    expect(digitsOf(formatDecimal(1234.5, like({ locale: 'ar-EG' })))).toBe('123450');
  });

  it('refuses the three non-finite doubles rather than printing them', () => {
    // Measured, ICU prints them rather than refusing: three characters that look like a value on a
    // total line are worse than no characters at all.
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(formatMoney(value, FR)).toBeUndefined();
      expect(formatDecimal(value, FR)).toBeUndefined();
    }
  });

  it('folds the negative zero, and only the exact one', () => {
    // `0 * -1` and a discount of nothing both produce it, and ICU prints its sign.
    expect(formatMoney(-0, FR)).toBe(formatMoney(0, FR));
    expect(formatDecimal(-0, FR)).toBe(formatDecimal(0, FR));
    // A value that really is negative keeps its sign, because hiding it would invent a number.
    expect(formatDecimal(-0.001, FR)).not.toBe(formatDecimal(0, FR));
  });

  it('writes one value two ways, with the same digits, from one model', () => {
    // The testable translation of "two writings of one value", and the only form that survives two
    // CLDR data sets. Asserted with no currency too, so the property does not rest on the symbol.
    expect(formatMoney(1234.5, FR)).not.toBe(formatMoney(1234.5, EN));
    expect(digitsOf(formatMoney(1234.5, FR))).toBe(digitsOf(formatMoney(1234.5, EN)));
    expect(formatDecimal(1234.5, FR)).not.toBe(formatDecimal(1234.5, EN));
    expect(digitsOf(formatDecimal(1234.5, FR))).toBe(digitsOf(formatDecimal(1234.5, EN)));
  });

  it('prints a well-formed currency ICU does not know, rather than refusing it', () => {
    // Openview holds no ISO 4217 register, so an unknown money degrades to a legible document.
    expect(formatMoney(1234.5, like({ currency: 'ZZZ' }))).toContain('ZZZ');
  });
});

describe('a date is written in the calendar the contract pins, not the one the locale prefers', () => {
  it('prints the Gregorian year, in locales whose own calendar would print another', () => {
    // Measured without the pins: `th-TH` prints the Buddhist year 2569 and `fa-IR` the Persian year
    // 1405, from a correct date and with no error anywhere. The positive half only holds because the
    // fixture declares `dateStyle: 'long'`: `th-TH` with `short` prints a two-digit year, so
    // simplifying the fixture would disarm this assertion without touching it.
    for (const locale of ['th-TH', 'fa-IR', 'ja-JP']) {
      const printed = formatDate('2026-08-19', like({ locale })) ?? '';
      expect(printed).toContain('2026');
      expect(printed).not.toContain('2569');
      expect(printed).not.toContain('1405');
    }
  });

  it('prints latin digits, in a locale whose own numbering system is not latin', () => {
    expect(digitsOf(formatDate('2026-08-19', like({ locale: 'fa-IR' })))).toContain('2026');
  });

  it('honours the declared date style rather than one of its own', () => {
    const short = formatDate('2026-08-19', like({ dateStyle: 'short' })) ?? '';
    const long = formatDate('2026-08-19', like({ dateStyle: 'long' })) ?? '';
    expect(short).not.toBe(long);
    expect(short.length).toBeLessThan(long.length);
    // All four declared styles produce an output: a declared style must never be unusable.
    for (const dateStyle of DATE_STYLES) {
      expect(formatDate('2026-08-19', like({ dateStyle }))).toBeDefined();
    }
  });

  it('writes one date two ways, from one model', () => {
    expect(formatDate('2026-02-19', FR)).not.toBe(formatDate('2026-02-19', EN));
  });

  it('accepts exactly the dates the algebra accepts, and builds no Date object', () => {
    // The range is the algebra's, with no month-length table and no leap-year rule written here.
    for (const value of ['0001-01-01', '9999-12-31', '2000-02-29', '2026-08-19']) {
      expect(formatDate(value, FR)).toBeDefined();
    }
    for (const value of ['2026-02-30', '2025-02-29', '10000-01-01', 'not-a-date', '']) {
      expect(formatDate(value, FR)).toBeUndefined();
    }
    // The proof that `Date.UTC` was not used: it maps years 0 to 99 onto 1900 to 1999, so it would
    // print these two dates identically.
    expect(formatDate('0042-01-01', FR)).not.toBe(formatDate('1942-01-01', FR));
  });
});

describe('the stored shape, its stamp and its migration', () => {
  /**
   * A page every literal here carries, because `parseTemplate` migrates and THEN validates against
   * the current schema, where `page` is required. Its margins differ from the compatibility page
   * the 4 -> 5 migration writes, so no assertion can pass by coincidence.
   */
  const authoredPage = {
    sheet: { width: 210, height: 297 },
    margins: { top: 12, right: 12, bottom: 12, left: 12 },
    header: [],
    footer: [],
  };

  /** The version from which a build understands `presentations`; it never moves again. */
  const PRESENTATIONS_SCHEMA_VERSION = 7;

  const documentAt = (schemaVersion: number, extra: Record<string, unknown> = {}) => ({
    schemaVersion,
    id: 'tpl_c6',
    name: 'Facture',
    version: '1.0.0',
    page: authoredPage,
    root: { type: 'container', id: 'root', children: [] },
    ...extra,
  });

  it('registers the step that stamped this field, and the chain still passes through it', () => {
    // The stamp of this field is 7, and it stays 7 for ever: it is the version from which a build
    // understands `presentations`. The CURRENT version is not this file's business -- the literal
    // chain lives in `template/migrate.test.ts`, which owns it -- so this assertion names the step
    // and not the end of the chain, and dropping the 6 -> 7 entry is still what reddens it.
    expect(CURRENT_SCHEMA_VERSION).toBeGreaterThanOrEqual(PRESENTATIONS_SCHEMA_VERSION);
    expect(TEMPLATE_MIGRATIONS.map((step) => [step.from, step.to])).toContainEqual([
      PRESENTATIONS_SCHEMA_VERSION - 1,
      PRESENTATIONS_SCHEMA_VERSION,
    ]);
  });

  it('brings a v6 document to the current stamp without transforming one value of it', () => {
    // The identity is asserted on the whole document with the stamp put back, which is stronger
    // than checking the fields someone thought to name. A pre-existing document declares no
    // writing, so the migration has nothing to invent -- and since every entry registered since is
    // a stamp too, the round trip now covers all of them at once.
    const stampedSix = documentAt(6);

    const parsed = parseTemplate(stampedSix);

    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(parsed.presentations).toBeUndefined();
    expect(JSON.parse(JSON.stringify({ ...parsed, schemaVersion: 6 }))).toStrictEqual(
      JSON.parse(JSON.stringify(stampedSix)),
    );
  });

  it('carries a table through the stamp on a document that already had one', () => {
    // The version guard reads the stamp and not the content, so a document stamped 6 that already
    // carries a table -- hand-made, or written by an unstamped mid-lot build -- is not refused.
    const withTable = documentAt(6, { presentations: { 'montant-fr': FR } });

    const parsed = parseTemplate(withTable);

    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(parsed.presentations).toStrictEqual({ 'montant-fr': FR });
    expect(resolvePresentation(parsed.presentations, 'montant-fr')).toStrictEqual({
      ok: true,
      writing: FR,
    });
  });

  it('accepts an empty table and an absent one, as two different statements', () => {
    // Absent says the author never opened the question; empty says the author opened it and
    // declared nothing yet. A template under construction is a legitimate template.
    expect(parseTemplate(documentAt(7, { presentations: {} })).presentations).toStrictEqual({});
    expect(parseTemplate(documentAt(7)).presentations).toBeUndefined();
  });

  it('refuses a stored table whose writing would not parse, after the migration and not before', () => {
    // Validation runs on the migrated document, so an unsound table is refused even when it rode in
    // on an older stamp.
    expect(() =>
      parseTemplate(documentAt(6, { presentations: { x: { ...FR, currency: 'eur' } } })),
    ).toThrow();
  });

  it('refuses a document stamped beyond this build, with a legible message', () => {
    // The whole mechanism of the stamp, in one assertion: without it, a v7 document opened by a v6
    // build is accepted with no error and stripped of its table, after which a save persists the
    // loss. The message names the version and the remedy.
    expect(() => parseTemplate(documentAt(CURRENT_SCHEMA_VERSION + 1))).toThrow(
      `schema version ${CURRENT_SCHEMA_VERSION + 1} but this build understands at most ${CURRENT_SCHEMA_VERSION}`,
    );
  });
});

describe('the public surface of the writing contract', () => {
  it('publishes its nine values', () => {
    // The barrel is the one place in this package where an omission is completely silent: a symbol
    // left unexported breaks nothing, it merely makes a feature unreachable for an integrator, and
    // no gate sees it. So the names are listed.
    //
    // By name and not by total: a total breaks on every later feature for a reason unrelated to
    // do with this contract, and it misses the one fault that matters -- a rename.
    const values = Object.keys(core);
    for (const symbol of [
      'DATE_STYLES',
      'MAX_FRACTION_DIGITS',
      'MIN_FRACTION_DIGITS',
      'PresentationSchema',
      'PresentationTableSchema',
      'formatDate',
      'formatDecimal',
      'formatMoney',
      'resolvePresentation',
    ]) {
      expect(values).toContain(symbol);
    }
    // Types do not appear in the keys of a JavaScript module, so the five exported types cannot be
    // reached this way. That is the limit these assertions inherit, stated rather than forgotten.
  });

  it('keeps both locale predicates out of the public surface', () => {
    // No consumer outside this package names either, and splitting one predicate into two added
    // nothing to the surface -- which is precisely the point of not exporting them.
    const values = Object.keys(core);
    expect(values).not.toContain('wellFormedLocale');
    expect(values).not.toContain('honouredLocale');
    // Pinned negatively so that folding the two gates back into one predicate goes red here too.
    expect(values).not.toContain('declarableLocale');
  });

  it('publishes no referential, and no function that derives a scale from a value', () => {
    // Openview holds no list of languages or currencies, and the writing is declared by its two
    // bounds rather than inferred from a value's binary form.
    const values = Object.keys(core);
    for (const absent of [
      'PRESENTATION_LOCALES',
      'PRESENTATION_CURRENCIES',
      'scaleOf',
      'declaredScaleOf',
      'parsePresentation',
    ]) {
      expect(values).not.toContain(absent);
    }
  });
});
