import { describe, expect, it } from 'vitest';
import { DocumentRenderError } from '../../errors.js';
import { DEFAULT_RENDER_SAFETY_LIMITS } from '../../limits/types.js';
import { createHtmlWriter, utf8Length } from '../writer.js';

const refusalOf = (run: () => unknown): DocumentRenderError => {
  try {
    run();
  } catch (error) {
    if (error instanceof DocumentRenderError) {
      return error;
    }
    throw error;
  }
  throw new Error('the fragment was accepted');
};

describe('the utf-8 length of a fragment', () => {
  it('counts one byte per ascii character', () => {
    expect(utf8Length('abc')).toBe(3);
  });

  it('counts two bytes for a latin letter with a diacritic', () => {
    expect(utf8Length('é')).toBe(2);
    expect(utf8Length('déjà')).toBe(6);
  });

  it('counts three bytes for a character outside latin-1', () => {
    expect(utf8Length('€')).toBe(3);
    expect(utf8Length('漢')).toBe(3);
  });

  it('counts four bytes for a character built from a surrogate pair', () => {
    /* The reason the counter cannot be `String.length`: this emoji is two utf-16 code units and
       four utf-8 bytes, so a ceiling read from `length` is half of what a browser receives. */
    expect('🧾').toHaveLength(2);
    expect(utf8Length('🧾')).toBe(4);
  });

  it('counts a lone surrogate as the replacement character an encoder writes', () => {
    expect(utf8Length('\ud83d')).toBe(3);
    expect(utf8Length('\udca9')).toBe(3);
    expect(utf8Length('\ud83da')).toBe(4);
  });

  it('agrees with the encoder itself on a mixed string', () => {
    const mixed = 'a é € 🧾 fin';
    expect(utf8Length(mixed)).toBe(Buffer.byteLength(mixed, 'utf8'));
  });
});

describe('the writer a document is serialised through', () => {
  it('joins what it accepted, in order', () => {
    const out = createHtmlWriter(64);
    out.write('<p>');
    out.write('hi');
    out.write('</p>');
    expect(out.toString()).toBe('<p>hi</p>');
    expect(out.bytes).toBe(9);
  });

  it('accepts a document of exactly the ceiling', () => {
    const out = createHtmlWriter(4);
    out.write('abcd');
    expect(out.toString()).toBe('abcd');
  });

  it('refuses the fragment that crosses the ceiling, and keeps nothing of it', () => {
    const out = createHtmlWriter(4);
    out.write('abc');
    const refused = refusalOf(() => out.write('de'));
    expect(refused.code).toBe('html-limit-exceeded');
    expect(refused.details.limit).toBe(4);
    expect(refused.details.phase).toBe('serialization');
    expect(out.toString()).toBe('abc');
  });

  it('measures the ceiling in bytes, not in code units', () => {
    /* Four emoji are eight code units and sixteen bytes: a counter on `length` would let this
       document through a ceiling it is twice over. */
    const out = createHtmlWriter(15);
    expect(refusalOf(() => out.write('🧾🧾🧾🧾')).details.observed).toBe(16);
  });

  it('publishes the ceiling it was created with', () => {
    expect(createHtmlWriter(9).limit).toBe(9);
  });
});

describe('a value written through its escaping', () => {
  it('produces exactly what escaping the whole of it would', () => {
    /* The pieces are an allocation strategy, never a change of output: escaping is per character
       and no entity crosses a boundary. */
    const escaping = (piece: string): string => piece.replaceAll('&', '&amp;');
    const value = `${'a&b'.repeat(9_000)}🧾${'&'.repeat(9_000)}`;
    const out = createHtmlWriter(DEFAULT_RENDER_SAFETY_LIMITS.maxHtmlBytes);
    out.writeEscaped(value, escaping);
    expect(out.toString()).toBe(escaping(value));
  });

  it('never splits the two halves of one character', () => {
    /* A split inside a surrogate pair would count two replacement characters where the document
       holds one, and the ceiling would read three bytes too many. */
    const value = '🧾'.repeat(20_000);
    const out = createHtmlWriter(DEFAULT_RENDER_SAFETY_LIMITS.maxHtmlBytes);
    out.writeEscaped(value, (piece) => piece);
    expect(out.bytes).toBe(utf8Length(value));
    expect(out.toString()).toBe(value);
  });

  it('refuses before the whole expanded value exists', () => {
    /* An entity costs five characters for one, so a run of ampersands allocates several times the
       ceiling if it is escaped whole first. */
    const out = createHtmlWriter(64);
    const refused = refusalOf(() => {
      out.writeEscaped('&'.repeat(100_000), (piece) => piece.replaceAll('&', '&amp;'));
    });
    expect(refused.code).toBe('html-limit-exceeded');
    /* Only the pieces that fit were ever built: the observed count is a piece past the ceiling,
       not five hundred kilobytes of it. */
    expect(refused.details.observed).toBeLessThan(64 * 1_000);
  });

  it('writes an empty value without writing anything at all', () => {
    const out = createHtmlWriter(8);
    out.writeEscaped('', (piece) => piece);
    expect(out.toString()).toBe('');
    expect(out.bytes).toBe(0);
  });
});
