import { refusal } from '../errors.js';

const EXCEEDED =
  'The html of this document passed the size one render may serialise. Read `details.limit` for the ceiling in utf-8 bytes; the markup itself is deliberately not repeated.';

/**
 * Accumulates html fragments while counting the bytes they will really occupy.
 *
 * The count is utf-8, not `String.length`: utf-16 code units under-report every character outside
 * the basic plane, so a document of emoji would pass a ceiling it is three times over.
 */
export interface HtmlWriter {
  /** Appends one fragment, refusing before the accumulated document passes the ceiling. */
  write(fragment: string): void;
  /** Joins everything written so far. */
  toString(): string;
  readonly bytes: number;
  readonly limit: number;
}

/**
 * Utf-8 length of a string, without allocating an encoded copy of it.
 *
 * Lone surrogates are counted as the three bytes an encoder writes for the replacement character
 * they become, so a broken pair is never counted as less than what is emitted.
 */
export function utf8Length(text: string): number {
  let bytes = 0;
  for (let at = 0; at < text.length; at += 1) {
    // `at` never leaves the string, so the fallback is unreachable; it stands in for the `undefined`
    // an out-of-range read would return.
    const code = text.codePointAt(at) ?? 0;
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code < 0x10000) {
      bytes += 3;
    } else {
      // A surrogate pair read as one code point: skip the unit it consumed.
      bytes += 4;
      at += 1;
    }
  }
  return bytes;
}

/** Creates a writer that refuses to build a document larger than `limit` utf-8 bytes. */
export function createHtmlWriter(limit: number): HtmlWriter {
  const parts: string[] = [];
  let bytes = 0;
  return {
    write(fragment: string): void {
      bytes += utf8Length(fragment);
      if (bytes > limit) {
        throw refusal(EXCEEDED, 'html-limit-exceeded', {
          phase: 'serialization',
          limit,
          observed: bytes,
        });
      }
      parts.push(fragment);
    },
    toString(): string {
      return parts.join('');
    },
    get bytes(): number {
      return bytes;
    },
    limit,
  };
}
