import { describe, expect, it } from 'vitest';
import { DocumentRenderError } from '../../../errors.js';
import { assertCoveredText } from '../coverage.js';
import { resolveFontFace } from '../resolve.js';
import type { ResolvedFontFace } from '../types.js';

const NOTO_SANS: ResolvedFontFace = resolveFontFace('Noto Sans', false, false, {});
const NOTO_SERIF: ResolvedFontFace = resolveFontFace('Noto Serif', false, false, {});
const INTER: ResolvedFontFace = resolveFontFace('Inter', false, false, {});

function refusalOf(run: () => unknown): DocumentRenderError {
  try {
    run();
  } catch (error: unknown) {
    if (error instanceof DocumentRenderError) {
      return error;
    }
    throw error;
  }
  throw new Error('the call was expected to refuse, and did not');
}

describe('the characters an embedded face accepts', () => {
  it.each([
    ['ascii letters and digits', 'The quick brown fox 0123456789'],
    ['french accents and ligatures', 'àâäçéèêëîïôöùûüÿ œuf Æsop ŒUVRE'],
    ['german and nordic letters', 'Größe Straße Ærø Þingvellir øre å'],
    ['greek', 'Ἀθῆναι αβγδε ΑΒΓΔΕ'],
    ['cyrillic', 'Привет мир Здравствуйте'],
    ['the two no-break spaces ICU inserts', '1 234 56'],
    ['currency symbols', '€ $ £ ¥ ¢'],
    ['the minus sign, distinct from the hyphen', '−123 -123'],
    ['punctuation and dashes', '« quoted » — en–dash … ‹ › “ ” ‘ ’'],
    ['combining marks', 'é à ñ ç'],
    ['a latin extended-g letter, which is a surrogate pair', '\u{1df00}'],
  ])('accepts %s', (_name, text) => {
    expect(() => assertCoveredText(text, NOTO_SANS, {})).not.toThrow();
    expect(() => assertCoveredText(text, NOTO_SERIF, {})).not.toThrow();
  });

  it('accepts the structural characters html carries, which no face has to draw', () => {
    /* Tab, line feed and carriage return are layout instructions under `white-space: pre-wrap`,
       not glyphs: a face that omits them still prints the document correctly. */
    expect(() => assertCoveredText('a\tb\nc\r\nd', NOTO_SANS, {})).not.toThrow();
  });

  it('accepts the empty string', () => {
    expect(() => assertCoveredText('', NOTO_SANS, {})).not.toThrow();
  });

  it.each([
    ['an emoji', '\u{1f469}'],
    ['a zero-width joiner sequence', '\u{1f469}‍\u{1f4bb}'],
    ['a CJK ideograph', '中文'],
    ['hiragana', 'こん'],
    ['arabic', 'مرحبا'],
    ['hebrew', 'שלום'],
    ['devanagari', 'नमस्ते'],
    ['a private use character', ''],
    ['a lone high surrogate', '\ud800'],
    ['a lone low surrogate', '\udc00'],
    ['an unassigned plane-15 character', '\u{f0000}'],
  ])('refuses %s rather than letting the browser borrow a glyph', (_name, text) => {
    expect(refusalOf(() => assertCoveredText(text, NOTO_SANS, {})).code).toBe(
      'unsupported-font-character',
    );
  });

  it('refuses on the first uncovered character, wherever it sits in the run', () => {
    for (const text of ['\u{1f600}abc', 'abc\u{1f600}', 'ab\u{1f600}cd']) {
      expect(refusalOf(() => assertCoveredText(text, NOTO_SANS, {})).code).toBe(
        'unsupported-font-character',
      );
    }
  });

  it('carries neither the character, its code point nor the string it came from', () => {
    const refused = refusalOf(() =>
      assertCoveredText('total 中文 42', NOTO_SANS, {
        nodeId: 'amount',
        path: ['root', 'children', 1],
        region: 'root',
        pageNumber: 3,
      }),
    );
    /* A character can come from the caller's data set, and a message is a thing that gets logged:
       the site travels, the value never does. */
    const written = `${refused.message} ${JSON.stringify(refused.details)}`;
    expect(written).not.toContain('中');
    expect(written).not.toContain('文');
    expect(written).not.toContain('total');
    expect(written).not.toContain('20013');
    expect(written).not.toContain('4e2d');
    expect(refused.details.nodeId).toBe('amount');
    expect(refused.details.region).toBe('root');
    expect(refused.details.pageNumber).toBe(3);
  });

  it('judges each face on its own coverage rather than on its family', () => {
    /* Inter and Noto do not cover the same set: a character has to be checked against the face the
       run really resolved to, not against whichever face happens to be handy. */
    const inter = new Set<string>();
    const noto = new Set<string>();
    for (const code of [0x2212, 0x20ac, 0x0141, 0x1df00, 0x0400, 0x03b1]) {
      const character = String.fromCodePoint(code);
      try {
        assertCoveredText(character, INTER, {});
        inter.add(character);
      } catch (error: unknown) {
        if (!(error instanceof DocumentRenderError)) {
          throw error;
        }
      }
      try {
        assertCoveredText(character, NOTO_SANS, {});
        noto.add(character);
      } catch (error: unknown) {
        if (!(error instanceof DocumentRenderError)) {
          throw error;
        }
      }
    }
    expect(inter.size).toBeGreaterThan(0);
    expect(noto.size).toBeGreaterThan(0);
  });

  it('checks the bold and italic faces of a family as strictly as the regular one', () => {
    for (const [bold, italic] of [
      [true, false],
      [false, true],
      [true, true],
    ] as const) {
      const face = resolveFontFace('Noto Sans', bold, italic, {});
      expect(() => assertCoveredText('Total 1 234,56 €', face, {})).not.toThrow();
      expect(refusalOf(() => assertCoveredText('中', face, {})).code).toBe(
        'unsupported-font-character',
      );
    }
  });
});
