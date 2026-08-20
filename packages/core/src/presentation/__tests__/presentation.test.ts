import { describe, expect, it } from 'vitest';
import type { z } from 'zod/v4';
import type { MutuallyAssignable } from '../../ast/__tests__/fixtures.js';
import { MAX_ROUND_DECIMALS } from '../../expression/types.js';
import { honouredLocale, wellFormedLocale } from '../locale.js';
import { PresentationSchema, PresentationTableSchema } from '../schemas.js';
import {
  DATE_STYLES,
  MAX_FRACTION_DIGITS,
  MIN_FRACTION_DIGITS,
  type Presentation,
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
