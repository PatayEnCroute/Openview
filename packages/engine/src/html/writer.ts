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
  /**
   * Appends a value through `escape`, in pieces small enough that none of them is the document.
   *
   * Escaping a run whole would build the expanded string before anything counted it, and an entity
   * costs up to five characters for one: a document of ampersands would allocate several times the
   * ceiling that exists to bound exactly that.
   */
  writeEscaped(value: string, escaping: (piece: string) => string): void;
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

/**
 * Characters an escaped piece may hold, before expansion.
 *
 * Small enough that the transient string stays a few tens of kilobytes whatever the entity ratio,
 * and large enough that a document of ordinary text is not cut into thousands of pieces.
 */
const PIECE = 8_192;

/**
 * The end of a piece that starts at `from`, never between the two halves of one character.
 *
 * Escaping is per character and never crosses a boundary, so a split changes no output; a split
 * inside a surrogate pair would still make the counter read two replacement characters where the
 * document holds one.
 */
function pieceEnd(text: string, from: number): number {
  const end = Math.min(from + PIECE, text.length);
  const last = text.charCodeAt(end - 1);
  return end < text.length && last >= 0xd800 && last <= 0xdbff ? end - 1 : end;
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
    writeEscaped(value: string, escaping: (piece: string) => string): void {
      let from = 0;
      do {
        const end = pieceEnd(value, from);
        this.write(escaping(value.slice(from, end)));
        from = end;
      } while (from < value.length);
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
