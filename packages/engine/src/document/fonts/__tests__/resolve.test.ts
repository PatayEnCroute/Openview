import { describe, expect, it } from 'vitest';
import { DocumentRenderError } from '../../../errors.js';
import { DEFAULT_FONT_FAMILY, FONT_CATALOGUE } from '../catalogue.js';
import { resolveFontFace } from '../resolve.js';

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

describe('the family a declaration resolves to', () => {
  it('takes the engine default when the site declares none', () => {
    expect(resolveFontFace(undefined, false, false, {}).family).toBe(DEFAULT_FONT_FAMILY);
    expect(DEFAULT_FONT_FAMILY).toBe('noto-sans-2.015');
  });

  it.each([
    ['sans-serif', 'noto-sans-2.015'],
    ['serif', 'noto-serif-2.015'],
    ['Noto Sans', 'noto-sans-2.015'],
    ['Noto Serif', 'noto-serif-2.015'],
    ['Inter', 'inter-4.1'],
  ])('resolves the declared name %s to the embedded family %s', (declared, family) => {
    expect(resolveFontFace(declared, false, false, {}).family).toBe(family);
  });

  it('answers a face whose css family is internal, whatever the declared name was', () => {
    for (const declared of FONT_CATALOGUE.keys()) {
      expect(resolveFontFace(declared, false, false, {}).cssFamily).toMatch(/^__openview_/);
    }
  });

  it.each([
    ['Arial'],
    ['Georgia'],
    ['Helvetica'],
    ['Times New Roman'],
    ['system-ui'],
    ['monospace'],
    ['cursive'],
    ['fantasy'],
    ['emoji'],
    ['math'],
    ['-apple-system'],
    ['ui-sans-serif'],
    ['BlinkMacSystemFont'],
  ])('refuses %s, which would be the machine answering', (declared) => {
    expect(refusalOf(() => resolveFontFace(declared, false, false, {})).code).toBe(
      'unsupported-font-family',
    );
  });

  it.each([
    ['noto sans'],
    ['NOTO SANS'],
    ['Noto  Sans'],
    [' Noto Sans'],
    ['Noto Sans '],
    ['NotoSans'],
    ['Sans-Serif'],
    ['SERIF'],
    ['inter'],
    ['INTER'],
  ])('refuses %s rather than guessing which catalogued name it meant', (declared) => {
    /* Never trimmed and never case-folded: deciding two spellings mean the same family would be a
       rule about the host's fonts, and folding depends on a locale this engine must not read. */
    expect(refusalOf(() => resolveFontFace(declared, false, false, {})).code).toBe(
      'unsupported-font-family',
    );
  });

  it('refuses the internal css family itself, which no template may name', () => {
    expect(
      refusalOf(() => resolveFontFace('__openview_noto_sans_2_015', false, false, {})).code,
    ).toBe('unsupported-font-family');
  });

  it('names the site of the refusal, and never the name that was asked for', () => {
    const refused = refusalOf(() =>
      resolveFontFace('Comic Sans MS', false, false, {
        nodeId: 'heading',
        path: ['root', 'children', 2],
        region: 'header',
        occurrence: {
          declarationPath: ['root'],
          iterations: [{ declarationPath: ['root', 'children'], index: 0 }],
        },
      }),
    );
    expect(refused.details.nodeId).toBe('heading');
    expect(refused.details.region).toBe('header');
    expect(refused.details.path).toStrictEqual(['root', 'children', 2]);
    expect(refused.message).not.toContain('Comic Sans');
    expect(JSON.stringify(refused.details)).not.toContain('Comic Sans');
  });
});

describe('the face a weight and a slant select', () => {
  it.each([
    [false, false, 400, 'normal'],
    [true, false, 700, 'normal'],
    [false, true, 400, 'italic'],
    [true, true, 700, 'italic'],
  ])('selects weight %s slant %s as the %s %s face', (bold, italic, weight, style) => {
    const face = resolveFontFace('Noto Serif', bold === true, italic === true, {});
    expect(face.weight).toBe(weight);
    expect(face.style).toBe(style);
    expect(face.family).toBe('noto-serif-2.015');
  });

  it('gives the four combinations of one family the same css family', () => {
    const faces = [
      resolveFontFace('Inter', false, false, {}),
      resolveFontFace('Inter', true, false, {}),
      resolveFontFace('Inter', false, true, {}),
      resolveFontFace('Inter', true, true, {}),
    ];
    expect(new Set(faces.map((face) => face.cssFamily)).size).toBe(1);
    expect(new Set(faces.map((face) => `${face.weight} ${face.style}`)).size).toBe(4);
  });

  it('gives two families two different css families', () => {
    expect(resolveFontFace('Noto Sans', false, false, {}).cssFamily).not.toBe(
      resolveFontFace('Noto Serif', false, false, {}).cssFamily,
    );
  });
});
