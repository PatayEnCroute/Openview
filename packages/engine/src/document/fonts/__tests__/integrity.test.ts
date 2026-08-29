import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { BUNDLED_FACES, CATALOGUE_ORDER } from '../catalogue.js';
import type { BundledFontFace } from '../types.js';
import { coverageOf, namesOf, sfntVersionOf, stylesOf } from './ttf.js';

/** The bytes of a face, decoded from what the module embeds. */
const bytesOf = (face: BundledFontFace): Uint8Array =>
  new Uint8Array(Buffer.from(face.data, 'base64'));

const sha256Of = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/** What each family calls itself, so a substituted file fails on its own name. */
const FAMILY_NAMES = {
  'inter-4.1': 'Inter',
  'noto-sans-2.015': 'Noto Sans',
  'noto-serif-2.015': 'Noto Serif',
} as const;

const SUBFAMILY_NAMES = {
  '400 normal': 'Regular',
  '700 normal': 'Bold',
  '400 italic': 'Italic',
  '700 italic': 'Bold Italic',
} as const;

describe('the catalogue this build embeds', () => {
  it('carries exactly the three families, four faces each', () => {
    expect(BUNDLED_FACES).toHaveLength(12);
    for (const family of CATALOGUE_ORDER) {
      const faces = BUNDLED_FACES.filter((face) => face.family === family);
      expect(faces.map((face) => `${face.weight} ${face.style}`)).toStrictEqual([
        '400 normal',
        '700 normal',
        '400 italic',
        '700 italic',
      ]);
    }
  });

  it('lists its faces family by family, in the catalogue order', () => {
    const families = [...new Set(BUNDLED_FACES.map((face) => face.family))];
    expect(families).toStrictEqual([...CATALOGUE_ORDER]);
  });

  it('gives every family an internal name no template could ask for', () => {
    for (const face of BUNDLED_FACES) {
      expect(face.cssFamily).toMatch(/^__openview_[a-z0-9_]+$/);
      /* Never the name a model declares: a template asking for `Noto Sans` must not be able to
         name the css family directly, or a local installation could answer for it. */
      expect(face.cssFamily).not.toBe(FAMILY_NAMES[face.family]);
    }
    const perFamily = new Map(BUNDLED_FACES.map((face) => [face.family, face.cssFamily]));
    expect(new Set(perFamily.values()).size).toBe(CATALOGUE_ORDER.length);
  });
});

describe.each(BUNDLED_FACES.map((face) => [`${face.family} ${face.weight} ${face.style}`, face]))(
  'the embedded bytes of %s',
  (_name, face) => {
    const bytes = bytesOf(face);

    it('decode to exactly the length the module declares', () => {
      expect(bytes).toHaveLength(face.byteLength);
    });

    it('hash to exactly the digest the module declares', () => {
      expect(sha256Of(bytes)).toBe(face.sha256);
    });

    it('are a truetype file with glyf outlines', () => {
      /* 0x00010000, the sfnt version of a file carrying `glyf`. A `OTTO` file would be cff, which
         the local reader below does not claim to understand. */
      expect(sfntVersionOf(bytes)).toBe(0x0001_0000);
    });

    it('cover exactly the code points the module wrote down', () => {
      /* Re-derived from the `cmap` of the face by a reader that shares no code with the generator:
         a face replaced without regenerating its coverage reddens here. */
      expect(coverageOf(bytes)).toStrictEqual(face.codePoints);
    });

    it('name the family and the face the catalogue files them under', () => {
      const names = namesOf(bytes);
      expect(names.get(1)).toBe(FAMILY_NAMES[face.family]);
      expect(names.get(1)).toBe(face.familyName);
      expect(names.get(2)).toBe(SUBFAMILY_NAMES[`${face.weight} ${face.style}`]);
      expect(names.get(2)).toBe(face.subfamilyName);
    });

    it('declare the weight and the slant the catalogue selects them for', () => {
      const styles = stylesOf(bytes);
      expect(styles.weight).toBe(face.weight);
      expect(styles.italic).toBe(face.style === 'italic');
    });

    it('list their coverage as sorted, disjoint, non-adjacent ranges', () => {
      let previous = -2;
      for (const [from, to] of face.codePoints) {
        expect(from).toBeGreaterThan(previous + 1);
        expect(to).toBeGreaterThanOrEqual(from);
        previous = to;
      }
    });

    it('draw the characters a latin document needs', () => {
      const drawn = (text: string): boolean =>
        [...text].every((character) => {
          const code = character.codePointAt(0) ?? -1;
          return face.codePoints.some(([from, to]) => code >= from && code <= to);
        });
      /* Ascii, the french accents, the nbsp and narrow nbsp ICU inserts, the euro and the dollar,
         the minus sign and the digits: everything the recette prints. */
      expect(drawn('ABCdef0123456789 .,;:!?()[]-–—')).toBe(true);
      expect(drawn('àâäçéèêëîïôöùûüÿœæÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸŒÆ')).toBe(true);
      expect(drawn('  −€$£%')).toBe(true);
    });
  },
);

describe('a mutation of the embedded bytes', () => {
  it('is caught by the digest, even when the length is unchanged', () => {
    const face = BUNDLED_FACES[0];
    expect(face).toBeDefined();
    if (face === undefined) {
      return;
    }
    const mutated = bytesOf(face);
    const at = Math.floor(mutated.length / 2);
    const before = mutated[at] ?? 0;
    mutated[at] = before ^ 0xff;
    expect(mutated).toHaveLength(face.byteLength);
    expect(sha256Of(mutated)).not.toBe(face.sha256);
  });

  it('is caught by the coverage, when a range is widened by one code point', () => {
    const face = BUNDLED_FACES[0];
    expect(face).toBeDefined();
    if (face === undefined) {
      return;
    }
    const first = face.codePoints[0];
    expect(first).toBeDefined();
    if (first === undefined) {
      return;
    }
    const widened = [[first[0], first[1] + 1], ...face.codePoints.slice(1)];
    expect(coverageOf(bytesOf(face))).not.toStrictEqual(widened);
  });
});
