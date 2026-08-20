import { honouredLocale } from './locale.js';
import { PresentationSchema } from './schemas.js';
import type { PresentationResolution, PresentationTable } from './types.js';

/**
 * Resolves and canonicalizes a presentation writing from the table by name.
 * Returns a PresentationResolution indicating success with the canonical writing, or a typed refusal code.
 */
export function resolvePresentation(
  presentations: PresentationTable | undefined,
  writing: string,
): PresentationResolution {
  const declared =
    presentations !== undefined && Object.hasOwn(presentations, writing)
      ? presentations[writing]
      : undefined;
  if (declared === undefined) {
    return { ok: false, refusal: 'unknown-writing' };
  }
  const parsed = PresentationSchema.safeParse(declared);
  if (!parsed.success) {
    return { ok: false, refusal: 'invalid-writing' };
  }
  const locale = honouredLocale(parsed.data.locale);
  if (locale === undefined) {
    return { ok: false, refusal: 'unhonoured-locale' };
  }
  return { ok: true, writing: { ...parsed.data, locale } };
}
