/**
 * The Unicode extension marker. A canonical tag carrying it is refused, never trimmed, so a
 * template's stored intent and its printed output cannot disagree.
 *
 * The test runs on the CANONICAL form, because a tag carrying no `-u-` can canonicalise into one
 * that does.
 */
const UNICODE_EXTENSION = '-u-';

/**
 * Whether a language tag is well-formed and free of Unicode extensions -- the question a STORED
 * document is judged on -- returning the canonical spelling, or `undefined` on refusal.
 *
 * The verdict is structural validity under ECMA-402, a strict subset of BCP-47, and it is the same
 * on every ICU build. That portability is why this half sits at parse while {@link honouredLocale}
 * sits at render: a well-formed but unknown tag passes here.
 *
 * It returns the canonical tag rather than a boolean because both callers need it, and it does not
 * normalise what is stored.
 *
 * @see docs/adr/0008-langue-devise-et-formats.md
 */
export function wellFormedLocale(tag: string): string | undefined {
  let canonical: string | undefined;
  try {
    // One tag in, so one element out or a throw. `noUncheckedIndexedAccess` already types this
    // `string | undefined`, so a length test would only add a branch no test can cover.
    const canonicalised = Intl.getCanonicalLocales(tag);
    canonical = canonicalised[0];
  } catch (error) {
    // A malformed tag raises `RangeError`, and that is the refusal this function answers for.
    // Anything else is a platform fault and propagates: swallowing it would turn an engine defect
    // into a document written in a language nobody chose.
    if (!(error instanceof RangeError)) {
      throw error;
    }
    canonical = undefined;
  }
  if (canonical === undefined || canonical.includes(UNICODE_EXTENSION)) {
    return undefined;
  }
  return canonical;
}

/**
 * Whether THIS engine honours a language tag exactly as written -- the question a RENDER is judged
 * on -- returning the canonical spelling, or `undefined` on refusal.
 *
 * The gate exists because `Intl` accepts everything: an unknown tag falls back to the host's
 * locale in silence, which is the environment read this package must not perform. The test is
 * equality with the canonical tag, so it names no locale of its own and holds no list.
 *
 * It is a policy stricter than ICU's capability -- a tag ICU minimises is refused -- and its
 * answer depends on the reader's CLDR data, which is why it never runs at parse.
 *
 * @see docs/adr/0008-langue-devise-et-formats.md
 */
export function honouredLocale(tag: string): string | undefined {
  const canonical = wellFormedLocale(tag);
  if (canonical === undefined) {
    return undefined;
  }
  // Both formatters are asked: they are backed by different CLDR data, and the failure the second
  // call guards is silent. The pinned options of `format.ts` do not move `resolvedOptions().locale`,
  // so a bare locale argument is enough; `DateTimeFormat` keeps its `timeZone` pin all the same.
  // One condition rather than two, so no branch is unreachable where the two agree.
  if (
    new Intl.NumberFormat(canonical).resolvedOptions().locale !== canonical ||
    new Intl.DateTimeFormat(canonical, { timeZone: 'UTC' }).resolvedOptions().locale !== canonical
  ) {
    return undefined;
  }
  return canonical;
}
