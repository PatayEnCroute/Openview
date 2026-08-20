import { honouredLocale } from './locale.js';
import { PresentationSchema } from './schemas.js';
import type { PresentationResolution, PresentationTable } from './types.js';

/**
 * Picks one writing out of a template's table, by the name the CALLER asks for, and hands back a
 * validated copy whose locale is canonical -- or the reason there is none.
 *
 * The name is an argument: never a field of `RenderRequest`, never a key of the integrator's data,
 * never the machine. So the three questions separate -- the model declares what it SAYS and HOW a
 * value is WRITTEN, the caller picks WHICH declared writing, and the machine is never asked.
 *
 * This is the only gate that asks the machine, and it asks about the whole writing:
 *
 * - `Object.hasOwn` guards the lookup, because a parsed table inherits from `Object.prototype`. An
 *   index read would answer a non-`undefined` for names nobody declared, whose `locale` is
 *   `undefined` -- the arity-zero call to `Intl` this contract exists to make unreachable.
 * - The whole object is re-parsed, and the order matters: `safeParse` runs BEFORE any field is
 *   read. `Presentation` is structural, so a caller in plain JavaScript can hand a `locale` of
 *   `null`, and reading it first would let a `TypeError` escape a signature that promises a
 *   resolution. Three of the five fields are unprotected by the type.
 * - `honouredLocale` then runs on a tag the schema has already accepted.
 *
 * On success the writing is a COPY built by zod, with the canonical tag substituted, so it is never
 * the stored object and carries no key the schema does not know.
 *
 * What it cannot reach is a caller that skips it and formats with a writing of its own making; that
 * is an obligation on the engine rather than a type.
 *
 * @see docs/adr/0008-langue-devise-et-formats.md
 */
export function resolvePresentation(
  presentations: PresentationTable | undefined,
  writing: string,
): PresentationResolution {
  // One conditional read rather than an early return followed by a narrowing: with
  // `noUncheckedIndexedAccess`, a separate `if (declared === undefined)` after a successful
  // `Object.hasOwn` would be a branch no test can reach.
  const declared =
    presentations !== undefined && Object.hasOwn(presentations, writing)
      ? presentations[writing]
      : undefined;
  if (declared === undefined) {
    // The call is wrong: a name nobody declared, or no table at all.
    return { ok: false, refusal: 'unknown-writing' };
  }
  const parsed = PresentationSchema.safeParse(declared);
  if (!parsed.success) {
    // The document is wrong, and portably so: this entry never met the schema, so no engine would
    // have accepted it. The issues are not forwarded -- a caller that wants them parses the table.
    return { ok: false, refusal: 'invalid-writing' };
  }
  const locale = honouredLocale(parsed.data.locale);
  if (locale === undefined) {
    // Neither is wrong: the document is portable and the call is correct, and this engine does not
    // honour the tag as written. The one refusal a Designer must not blame on the author.
    return { ok: false, refusal: 'unhonoured-locale' };
  }
  return { ok: true, writing: { ...parsed.data, locale } };
}
