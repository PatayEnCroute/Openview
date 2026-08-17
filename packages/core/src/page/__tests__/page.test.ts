import { describe, expect, it } from 'vitest';
import {
  MAX_SHEET_MM,
  MIN_SHEET_MM,
  PAGE_BAND_OCCURRENCES,
  type PageBandOccurrence,
  type PageSetup,
  PageSetupSchema,
  printableAreaOf,
  SheetSchema,
  STANDARD_SHEETS_MM,
} from '../page.js';
import { RECIPE_PAGE } from './fixtures.js';

/** A page carrying the given bands on its footer, and nothing else worth refusing. */
function withFooter(occurrences: readonly PageBandOccurrence[]): unknown {
  return {
    sheet: { width: 210, height: 297 },
    margins: { top: 20, right: 15, bottom: 25, left: 15 },
    header: [],
    footer: occurrences.map((on, index) => ({
      on,
      content: { type: 'container', id: `b${index}`, children: [] },
    })),
  };
}

const accepts = (occurrences: readonly PageBandOccurrence[]): boolean =>
  PageSetupSchema.safeParse(withFooter(occurrences)).success;

/**
 * The pages an occurrence applies to, on a document of `pageCount` pages.
 *
 * The derivation the schema's table PRECOMPUTES. Written out here so the two can be compared:
 * "declared, not computed" is only a shortcut if it is the same rule, and nothing but this
 * test says it is.
 */
function domainOf(on: PageBandOccurrence, pageCount: number): ReadonlySet<number> {
  const ranks = Array.from({ length: pageCount }, (_unused, index) => index + 1);
  const applies = (rank: number): boolean => {
    switch (on) {
      case 'every':
        return true;
      case 'firstOnly':
        return rank === 1;
      case 'exceptFirst':
        return rank !== 1;
      case 'exceptLast':
        return rank !== pageCount;
      case 'lastOnly':
        return rank === pageCount;
      default: {
        const exhaustive: never = on;
        throw new TypeError(`Unhandled occurrence: ${String(exhaustive)}`);
      }
    }
  };
  return new Set(ranks.filter(applies));
}

/** Disjoint for EVERY page count, which is what save time has to decide without knowing `n`. */
function areDisjointAtEveryCount(
  left: PageBandOccurrence,
  right: PageBandOccurrence,
  upTo: number,
): boolean {
  for (let pageCount = 1; pageCount <= upTo; pageCount += 1) {
    const rightDomain = domainOf(right, pageCount);
    for (const rank of domainOf(left, pageCount)) {
      if (rightDomain.has(rank)) {
        return false;
      }
    }
  }
  return true;
}

const COUPLES: readonly (readonly [PageBandOccurrence, PageBandOccurrence])[] =
  PAGE_BAND_OCCURRENCES.flatMap((left) =>
    PAGE_BAND_OCCURRENCES.map((right) => [left, right] as const),
  );

describe('the recipe page', () => {
  it('is accepted as written, and survives a JSON round trip', () => {
    const parsed = PageSetupSchema.parse(RECIPE_PAGE);

    expect(parsed.header).toHaveLength(1);
    expect(parsed.footer).toHaveLength(2);
    // The round trip is the net that replaces the mutual-assignability assertion `z.array`
    // makes unavailable here: a field the fixture carries and the schema ignores is STRIPPED
    // by `z.object`, and only this comparison sees it.
    expect(JSON.parse(JSON.stringify(parsed))).toStrictEqual(RECIPE_PAGE);
  });

  it('declares what repeats at the top, at the bottom, and on the last page only', () => {
    const parsed = PageSetupSchema.parse(RECIPE_PAGE);

    // Reading `RECIPE_PAGE.header[0].on` alone would be tautological. What this pins is that
    // the PARSE keeps both bands, in order, with their occurrences: a mis-composed `z.array`
    // would lose one.
    expect(parsed.header.map((band) => band.on)).toStrictEqual(['every']);
    expect(parsed.footer.map((band) => band.on)).toStrictEqual(['exceptLast', 'lastOnly']);
    expect(parsed.footer.map((band) => band.content.id)).toStrictEqual(['ftr', 'ftr-last']);
  });

  it('strips a key it does not know, so a fragment parse is not a persistence boundary', () => {
    const parsed = PageSetupSchema.parse({ ...RECIPE_PAGE, bleed: 3 });

    expect(Object.keys(parsed)).toStrictEqual(['sheet', 'margins', 'header', 'footer']);
  });
});

describe('the sheet', () => {
  it('accepts both bounds of the window', () => {
    const square = (side: number): unknown => ({
      sheet: { width: side, height: side },
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      header: [],
      footer: [],
    });

    expect(PageSetupSchema.safeParse(square(MIN_SHEET_MM)).success).toBe(true);
    expect(PageSetupSchema.safeParse(square(MAX_SHEET_MM)).success).toBe(true);
  });

  it.each([
    ['missing', undefined, 'invalid_type'],
    ['zero', 0, 'too_small'],
    ['past the ceiling', MAX_SHEET_MM + 920, 'too_big'],
    ['NaN', Number.NaN, 'invalid_type'],
    ['infinite', Number.POSITIVE_INFINITY, 'invalid_type'],
    ['not a number', '210mm', 'invalid_type'],
  ])('refuses a width that is %s', (_label, width, code) => {
    const result = PageSetupSchema.safeParse({
      ...RECIPE_PAGE,
      sheet: { width, height: 297 },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.code).toBe(code);
      expect(result.error.issues[0]?.path).toStrictEqual(['sheet', 'width']);
    }
  });

  it('accepts the fractional millimetres a standard sheet needs', () => {
    // US Letter is 215.9 x 279.4 mm. Whole millimetres would make it INEXPRESSIBLE, and the
    // obvious "at most two decimals" bound refuses it outright -- `279.4 * 100` is
    // `27939.999999999996`. Every entry of the convenience table has to clear the bounds the
    // contract advertises, or the table would offer sizes the schema refuses.
    for (const sheet of Object.values(STANDARD_SHEETS_MM)) {
      expect(SheetSchema.safeParse(sheet).success).toBe(true);
    }
    expect(SheetSchema.safeParse(STANDARD_SHEETS_MM.letter).success).toBe(true);
  });
});

describe('the margins', () => {
  it('accepts four zeroes: refusing them would be a rule of typography', () => {
    expect(
      PageSetupSchema.safeParse({
        ...RECIPE_PAGE,
        margins: { top: 0, right: 0, bottom: 0, left: 0 },
      }).success,
    ).toBe(true);
  });

  it('refuses a negative margin, and one past the ceiling', () => {
    const negative = PageSetupSchema.safeParse({
      ...RECIPE_PAGE,
      margins: { ...RECIPE_PAGE.margins, top: -1 },
    });
    const huge = PageSetupSchema.safeParse({
      ...RECIPE_PAGE,
      margins: { ...RECIPE_PAGE.margins, top: MAX_SHEET_MM + 920 },
    });

    expect(negative.success).toBe(false);
    if (!negative.success) {
      expect(negative.error.issues[0]?.message).toBe('A margin cannot be negative');
      expect(negative.error.issues[0]?.path).toStrictEqual(['margins', 'top']);
    }
    expect(huge.success).toBe(false);
    if (!huge.success) {
      expect(huge.error.issues[0]?.message).toBe(`A margin is at most ${MAX_SHEET_MM} mm`);
    }
  });

  it('refuses margins that leave nothing to print on, once per direction', () => {
    const horizontal = PageSetupSchema.safeParse({
      ...RECIPE_PAGE,
      margins: { top: 20, right: 105, bottom: 25, left: 105 },
    });
    const vertical = PageSetupSchema.safeParse({
      ...RECIPE_PAGE,
      margins: { top: 150, right: 15, bottom: 150, left: 15 },
    });
    const both = PageSetupSchema.safeParse({
      ...RECIPE_PAGE,
      margins: { top: 150, right: 105, bottom: 150, left: 105 },
    });

    expect(horizontal.success).toBe(false);
    if (!horizontal.success) {
      expect(horizontal.error.issues).toHaveLength(1);
      // The path stops at `margins` and names no field: none of the four is wrong on its own,
      // it is their sum against the sheet. Naming `margins.left` would accuse a value the
      // author may well have written correctly.
      expect(horizontal.error.issues[0]?.path).toStrictEqual(['margins']);
      expect(horizontal.error.issues[0]?.message).toBe(
        'Horizontal margins leave no printable width.',
      );
    }
    expect(vertical.success).toBe(false);
    if (!vertical.success) {
      expect(vertical.error.issues[0]?.message).toBe('Vertical margins leave no printable height.');
    }
    // Two independent faults, not a cascade: the "one message at a time" promise made to lot
    // C8 bears on collateral damage, not on two things genuinely wrong at once.
    expect(both.success).toBe(false);
    if (!both.success) {
      expect(both.error.issues.map((issue) => issue.message)).toStrictEqual([
        'Horizontal margins leave no printable width.',
        'Vertical margins leave no printable height.',
      ]);
    }
  });

  it('says ONE thing about an ill-dimensioned sheet, thanks to the guard', () => {
    // Measured: without the early return in the refinement, a width of `0` yields TWO issues
    // -- the `too_small` of the width, then the `custom` of the horizontal margins, because
    // `30 >= 0` holds. The second is collateral damage of the first. The guard is reached by
    // every ill-dimensioned sheet, so it is covered rather than dead.
    const result = PageSetupSchema.safeParse({
      sheet: { width: 0, height: 297 },
      margins: { top: 20, right: 15, bottom: 25, left: 15 },
      header: [],
      footer: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0]?.code).toBe('too_small');
    }
  });
});

describe('the bands', () => {
  it('accepts a page with no band at all', () => {
    expect(accepts([])).toBe(true);
  });

  it('accepts every occurrence on its own', () => {
    for (const on of PAGE_BAND_OCCURRENCES) {
      expect(accepts([on])).toBe(true);
    }
  });

  it('accepts exactly the two partitions, in either writing order', () => {
    // The property is ONE, so it is one `it` -- but it carries all twenty-five couples rather
    // than two cases, because this is precisely where an invariant that only refused DUPLICATE
    // occurrences was green while `every` + `lastOnly` put two bands on the last page.
    const accepted = COUPLES.filter(([left, right]) => accepts([left, right]));

    expect(accepted).toStrictEqual([
      ['firstOnly', 'exceptFirst'],
      ['exceptFirst', 'firstOnly'],
      ['exceptLast', 'lastOnly'],
      ['lastOnly', 'exceptLast'],
    ]);
  });

  it('refuses the twenty-one overlapping couples on the SECOND band', () => {
    for (const [left, right] of COUPLES) {
      const result = PageSetupSchema.safeParse(withFooter([left, right]));
      if (result.success) {
        continue;
      }
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0]?.code).toBe('custom');
      // The second band is the one in excess, and `on` is where the author fixes it. The
      // message names no occurrence: a constant payload stays safe to log (ADR 0003).
      expect(result.error.issues[0]?.path).toStrictEqual(['footer', 1, 'on']);
      expect(result.error.issues[0]?.message).toBe(
        'Two bands on the same side can apply to the same page.',
      );
    }
  });

  it('is SYMMETRIC, so validity never depends on the order the bands were written in', () => {
    // `checkBandsCannotOverlap` compares each band to the EARLIER ones using the CURRENT
    // band's row, so a single asymmetric row would make `[a, b]` and `[b, a]` disagree. A
    // hand-written table's real failure mode is a mis-copied row, and this is what catches it.
    for (const [left, right] of COUPLES) {
      expect(accepts([left, right])).toBe(accepts([right, left]));
    }
  });

  it('matches the rank-domain derivation for every page count from 1 to 8', () => {
    // What makes "declared, not computed" a shortcut rather than a different rule. The schema
    // cannot compute this -- it has no `n` -- so the equivalence is verified here instead.
    for (const [left, right] of COUPLES) {
      expect(accepts([left, right])).toBe(areDisjointAtEveryCount(left, right, 8));
    }
  });

  it('lets the legal pair through and names only the intruder, on three bands', () => {
    const result = PageSetupSchema.safeParse(withFooter(['firstOnly', 'exceptFirst', 'lastOnly']));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0]?.path).toStrictEqual(['footer', 2, 'on']);
    }
  });

  it('refuses an occurrence it does not know, listing the five in tuple order', () => {
    const result = PageSetupSchema.safeParse({
      ...RECIPE_PAGE,
      footer: [{ on: 'oddPages', content: { type: 'container', id: 'b', children: [] } }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.code).toBe('invalid_value');
      expect(result.error.issues[0]?.path).toStrictEqual(['footer', 0, 'on']);
      expect(result.error.issues[0]?.message).toBe(
        'Invalid option: expected one of "every"|"firstOnly"|"exceptFirst"|"exceptLast"|"lastOnly"',
      );
    }
  });

  it('answers an ABSENT occurrence with the same message, which lot C8 has to know', () => {
    // `z.enum` treats `undefined` as an unknown option, so an author who forgot the field
    // reads "expected one of ..." rather than "this field is required" -- exact, and
    // misleading. Recorded here rather than corrected: fixing it would mean replacing both
    // enums of this lot with literal unions, which changes the message above too.
    const result = PageSetupSchema.safeParse({
      ...RECIPE_PAGE,
      footer: [{ content: { type: 'container', id: 'b', children: [] } }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('expected one of "every"');
    }
  });

  it('refuses a band whose content is not a container', () => {
    const result = PageSetupSchema.safeParse({
      ...RECIPE_PAGE,
      footer: [{ on: 'every', content: { type: 'text', id: 't', content: [] } }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      // TWO issues for one fault, and it is structural rather than this lot's doing:
      // `ContainerNodeSchema` is a `z.object`, not a discriminated union, so a text node fails
      // both on the discriminant and on the missing `children`. Written down for lot C8.
      expect(result.error.issues.map((issue) => issue.path.join('.'))).toStrictEqual([
        'footer.0.content.type',
        'footer.0.content.children',
      ]);
    }
  });

  it('inherits the BlockNode cut of lot C3 without one line of this lot', () => {
    // A bare `tableRow` in a band is refused because `PageBand.content` is a `ContainerNode`,
    // whose children are the block union. That is the whole return on choosing the type.
    const result = PageSetupSchema.safeParse({
      ...RECIPE_PAGE,
      footer: [
        {
          on: 'every',
          content: {
            type: 'container',
            id: 'b',
            children: [
              { type: 'text', id: 't', content: [] },
              { type: 'tableRow', id: 'nue', cells: [] },
            ],
          },
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.code).toBe('invalid_union');
      expect(result.error.issues[0]?.path).toStrictEqual([
        'footer',
        0,
        'content',
        'children',
        1,
        'type',
      ]);
    }
  });
});

describe('printableAreaOf', () => {
  it('subtracts the four margins of the recipe page', () => {
    expect(printableAreaOf(RECIPE_PAGE)).toStrictEqual({ width: 180, height: 252 });
  });

  it('yields the UGLY number, and pinning it is the point', () => {
    // `215.9 - (25.4 + 25.4)` is `165.10000000000002`, while `(215.9 - 25.4) - 25.4` is
    // `165.1`. Both are correct IEEE-754; they are not the same double. Pinning the ugly one
    // is what stops someone "tidying" the formula into the sequential form -- the expected
    // value would change, the test would redden, and the question would be asked in review
    // instead of slipping through a diff.
    //
    // The parenthesised form is retained for a property, not a preference: `left + right`
    // equals `right + left` exactly, so the result cannot depend on which margin an
    // implementer names first.
    const letter: PageSetup = {
      sheet: { ...STANDARD_SHEETS_MM.letter },
      margins: { top: 25.4, right: 25.4, bottom: 25.4, left: 25.4 },
      header: [],
      footer: [],
    };

    expect(printableAreaOf(letter)).toStrictEqual({
      width: 165.10000000000002,
      height: 228.59999999999997,
    });
    expect(printableAreaOf(letter).width).not.toBe(165.1);
  });

  it('returns two lengths and no origin', () => {
    // `{ x, y }` would impose an origin convention -- which corner, which axis direction --
    // that nothing in the contract fixes and that lot C11 may want to fix differently.
    expect(Object.keys(printableAreaOf(RECIPE_PAGE))).toStrictEqual(['width', 'height']);
  });
});
