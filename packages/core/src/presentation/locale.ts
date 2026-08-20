const UNICODE_EXTENSION = '-u-';

/**
 * Validates that a language tag is well-formed under ECMA-402 and contains no Unicode extensions (-u-).
 * Returns the canonical locale string, or undefined if invalid.
 */
export function wellFormedLocale(tag: string): string | undefined {
  let canonical: string | undefined;
  try {
    const canonicalised = Intl.getCanonicalLocales(tag);
    canonical = canonicalised[0];
  } catch (error) {
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
 * Validates that the engine honours the language tag exactly as written without silent host locale fallback.
 * Returns the canonical locale string, or undefined if not supported.
 */
export function honouredLocale(tag: string): string | undefined {
  const canonical = wellFormedLocale(tag);
  if (canonical === undefined) {
    return undefined;
  }
  if (
    new Intl.NumberFormat(canonical).resolvedOptions().locale !== canonical ||
    new Intl.DateTimeFormat(canonical, { timeZone: 'UTC' }).resolvedOptions().locale !== canonical
  ) {
    return undefined;
  }
  return canonical;
}
