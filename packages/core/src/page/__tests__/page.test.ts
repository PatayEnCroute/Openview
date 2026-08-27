import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import type { MutuallyAssignable } from '../../ast/__tests__/fixtures.js';
import { parseTemplate } from '../../template/migrate.js';
import { CURRENT_SCHEMA_VERSION } from '../../template/template.js';
import {
  MAX_BANDS_PER_SIDE,
  MAX_SHEET_MM,
  MIN_SHEET_MM,
  PAGE_BAND_OCCURRENCES,
  type PageBand,
  type PageBandOccurrence,
  PageBandSchema,
  PageBandsSchema,
  type PageMargins,
  type PageMarginsSchema,
  type PageSetup,
  PageSetupSchema,
  printableAreaOf,
  type Sheet,
  SheetSchema,
  STANDARD_SHEETS_MM,
} from '../page.js';
import { RECIPE_PAGE } from './fixtures.js';

/**
 * Key set verification for page setup schemas and types, ensuring bidirectional assignability.
 */
export const SHEET_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof SheetSchema>,
  keyof Sheet
> = true;

export const PAGE_MARGINS_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof PageMarginsSchema>,
  keyof PageMargins
> = true;

export const PAGE_BAND_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof PageBandSchema>,
  keyof PageBand
> = true;

export const PAGE_SETUP_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof PageSetupSchema>,
  keyof PageSetup
> = true;

/** Both header and footer sides for band assertions. */
const SIDES = ['header', 'footer'] as const;

type BandSide = (typeof SIDES)[number];

/** A page carrying the given bands on ONE side, and nothing else worth refusing. */
function withBands(side: BandSide, occurrences: readonly PageBandOccurrence[]): unknown {
  const bands = occurrences.map((on, index) => ({
    on,
    content: { type: 'container', id: `b${index}`, children: [] },
  }));
  return {
    sheet: { width: 210, height: 297 },
    margins: { top: 20, right: 15, bottom: 25, left: 15 },
    header: side === 'header' ? bands : [],
    footer: side === 'footer' ? bands : [],
  };
}

const acceptsOn = (side: BandSide, occurrences: readonly PageBandOccurrence[]): boolean =>
  PageSetupSchema.safeParse(withBands(side, occurrences)).success;

/** Verifies acceptance on both page sides. */
const accepts = (occurrences: readonly PageBandOccurrence[]): boolean => {
  const verdicts = SIDES.map((side) => acceptsOn(side, occurrences));
  const [onHeader, onFooter] = verdicts;
  if (onHeader !== onFooter) {
    throw new Error(`The two sides disagree on [${occurrences.join(', ')}]`);
  }
  return onHeader === true;
};

/** Predicate mapping for page band occurrences over rank and count. */
const APPLIES_TO: Readonly<
  Record<PageBandOccurrence, (rank: number, pageCount: number) => boolean>
> = {
  every: () => true,
  firstOnly: (rank) => rank === 1,
  exceptFirst: (rank) => rank !== 1,
  exceptLast: (rank, pageCount) => rank !== pageCount,
  lastOnly: (rank, pageCount) => rank === pageCount,
};

/**
 * The pages an occurrence applies to, on a document of `pageCount` pages.
 *
 * The derivation the schema's table PRECOMPUTES. Written out here so the two can be compared:
 * "declared, not computed" is only a shortcut if it is the same rule, and nothing but this
 * test says it is.
 */
function domainOf(on: PageBandOccurrence, pageCount: number): ReadonlySet<number> {
  const applies = APPLIES_TO[on];
  const ranks = Array.from({ length: pageCount }, (_unused, index) => index + 1);
  return new Set(ranks.filter((rank) => applies(rank, pageCount)));
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

  it('is a valid DOCUMENT, not only a valid fragment', () => {
    // The `it` that ties the seven above to a real document, and the exact form of
    // `table.test.ts`: parse, then compare the JSON round trip. A template is what gets
    // STORED, so this is where a field the schema silently drops would show.
    const document = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: 'facture-c4',
      name: 'Facture — la page',
      version: '1.0.0',
      page: RECIPE_PAGE,
      root: {
        type: 'container',
        id: 'racine',
        children: [{ type: 'text', id: 'corps', content: [{ kind: 'literal', text: 'Corps' }] }],
      },
    };

    const parsed = parseTemplate(document);

    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(JSON.parse(JSON.stringify(parsed))).toStrictEqual(document);
  });

  it('refuses a document with no page at all, on the path `page`', () => {
    // Verifies that the page field is strictly required on Template.
    const { page: _dropped, ...noPage } = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: 'facture-c4',
      name: 'Facture — la page',
      version: '1.0.0',
      page: RECIPE_PAGE,
      root: { type: 'container', id: 'racine', children: [] },
    };

    // Asserts exact issue path on missing page field.
    let caught: unknown;
    try {
      parseTemplate(noPage);
    } catch (error: unknown) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(z.ZodError);
    if (caught instanceof z.ZodError) {
      expect(caught.issues).toHaveLength(1);
      expect(caught.issues.map((issue) => issue.path)).toStrictEqual([['page']]);
      expect(caught.issues.map((issue) => issue.message)).toStrictEqual([
        'Invalid input: expected object, received undefined',
      ]);
    }
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

  it.each([
    ['zero', 0],
    // The case the guard USED to miss. Written `> 0`, the whole band [0.0001, 1) slipped
    // past it -- so `0.5` produced the very cascade the guard exists to suppress, and a
    // `0.5 x 0.5` sheet produced four issues. The gate mirrors `sheetLengthSchema`'s floor,
    // so the value here has to be a sub-minimum one, not merely a non-positive one.
    ['a sub-minimum fraction', 0.5],
    ['negative', -5],
  ])('says ONE thing about a width that is %s, thanks to the gate', (_label, width) => {
    const result = PageSetupSchema.safeParse({
      sheet: { width, height: 297 },
      margins: { top: 20, right: 15, bottom: 25, left: 15 },
      header: [],
      footer: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0]?.code).toBe('too_small');
      expect(result.error.issues[0]?.path).toStrictEqual(['sheet', 'width']);
    }
  });

  it('says ONE thing about a sub-minimum HEIGHT too, and names the height', () => {
    const result = PageSetupSchema.safeParse({
      sheet: { width: 210, height: 0.5 },
      margins: { top: 20, right: 15, bottom: 25, left: 15 },
      header: [],
      footer: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0]?.path).toStrictEqual(['sheet', 'height']);
    }
  });

  it('still reports a vertical fault the width could never have caused', () => {
    // The gates are per-axis, and this is why. Written as one conjunction, a bad WIDTH
    // silenced the VERTICAL check as well: 150 + 150 on a 297 mm height is impossible at
    // every width, so it is not collateral damage of the width at all -- yet the author saw
    // the width alone, fixed it, re-saved, and only then learnt the page had never been
    // valid. Two round trips, which is exactly what "two independent faults, not a cascade"
    // forbids one `it` above.
    const result = PageSetupSchema.safeParse({
      sheet: { width: 0, height: 297 },
      margins: { top: 150, right: 15, bottom: 150, left: 15 },
      header: [],
      footer: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.code)).toStrictEqual(['too_small', 'custom']);
      expect(result.error.issues[1]?.message).toBe('Vertical margins leave no printable height.');
    }
  });
});

describe('deriving from PageSetupSchema', () => {
  /** A page that only the object-level refinement refuses: the margins leave no height. */
  const noPrintableHeight = {
    ...RECIPE_PAGE,
    margins: { top: 200, right: 20, bottom: 200, left: 20 },
  };

  it('is refused by the schema itself', () => {
    expect(PageSetupSchema.safeParse(noPrintableHeight).success).toBe(false);
  });

  it.each([
    ['extend', PageSetupSchema.extend({ bleed: z.number().optional() })],
    ['omit', PageSetupSchema.omit({})],
    ['pick', PageSetupSchema.pick({ sheet: true, margins: true, header: true, footer: true })],
    ['partial', PageSetupSchema.partial()],
  ])(
    'LOSES the margin invariant through .%s(), which is why the docstring forbids it',
    (_label, derived) => {
      // Pinned rather than lamented. In zod 4 these four RESET the object's checks, so a
      // derived page schema accepts a page with no printable area -- on which
      // `printableAreaOf` returns a negative width. If a zod upgrade ever fixes this, THIS
      // test reddens, which is the signal to delete the warning in `page/schemas.ts` rather
      // than discover the change by accident.
      expect(derived.safeParse(noPrintableHeight).success).toBe(true);
    },
  );

  it.each([
    ['strict', PageSetupSchema.strict()],
    ['a nested field', z.object({ page: PageSetupSchema })],
  ])('KEEPS it through %s, which is the composition to use', (label, schema) => {
    const payload = label === 'a nested field' ? { page: noPrintableHeight } : noPrintableHeight;

    expect(schema.safeParse(payload).success).toBe(false);
  });

  it('keeps the BAND invariant through all of them, which is what makes the loss deceptive', () => {
    // The band refinement lives on the field schemas, not on the object, so it survives
    // every derivation. A derived schema therefore HALF-validates -- still refusing
    // `every` + `lastOnly` while accepting a page with no printable area -- and a reader
    // who checks one invariant concludes the other travelled too.
    const overlapping = {
      ...RECIPE_PAGE,
      header: [],
      footer: [
        { on: 'every', content: { type: 'container', id: 'a', children: [] } },
        { on: 'lastOnly', content: { type: 'container', id: 'b', children: [] } },
      ],
    };

    expect(
      PageSetupSchema.extend({ bleed: z.number().optional() }).safeParse(overlapping).success,
    ).toBe(false);
  });
});

describe('PageBandsSchema', () => {
  const band = (on: PageBandOccurrence): unknown => ({
    on,
    content: { type: 'container', id: on, children: [] },
  });

  it('carries the overlap invariant', () => {
    // Verifies that overlapping band occurrences are refused by PageBandsSchema.
    const overlapping = [band('every'), band('lastOnly')];

    expect(z.array(PageBandSchema).safeParse(overlapping).success).toBe(true);
    expect(PageBandsSchema.safeParse(overlapping).success).toBe(false);
  });

  it('gives the SAME verdict as PageSetupSchema, on both partitions and on a conflict', () => {
    for (const couple of [
      ['firstOnly', 'exceptFirst'],
      ['exceptLast', 'lastOnly'],
      ['every', 'lastOnly'],
    ] as const) {
      expect(PageBandsSchema.safeParse(couple.map(band)).success).toBe(
        accepts([couple[0], couple[1]]),
      );
    }
  });

  it('bounds a side at MAX_BANDS_PER_SIDE', () => {
    expect(MAX_BANDS_PER_SIDE).toBe(2);
    expect(PageBandsSchema.safeParse([band('firstOnly'), band('exceptFirst')]).success).toBe(true);
    expect(
      PageBandsSchema.safeParse([band('firstOnly'), band('exceptFirst'), band('lastOnly')]).success,
    ).toBe(false);
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

  it.each(SIDES)('refuses the twenty-one overlapping couples on the SECOND band (%s)', (side) => {
    // The count is asserted rather than assumed: reading `issues[0]` inside `if
    // (!result.success)` would let this `it` pass VACUOUSLY the day nothing is refused,
    // which is the one failure it exists to catch.
    let refused = 0;
    for (const [left, right] of COUPLES) {
      const result = PageSetupSchema.safeParse(withBands(side, [left, right]));
      if (result.success) {
        continue;
      }
      refused += 1;
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0]?.code).toBe('custom');
      // The second band is the one in excess, and `on` is where the author fixes it. The
      // message names no occurrence: a constant payload stays safe to log (ADR 0003).
      expect(result.error.issues[0]?.path).toStrictEqual([side, 1, 'on']);
      expect(result.error.issues[0]?.message).toBe(
        'Two bands on the same side can apply to the same page.',
      );
    }
    expect(refused).toBe(21);
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
    for (const [left, right] of COUPLES) {
      expect(accepts([left, right])).toBe(areDisjointAtEveryCount(left, right, 8));
    }
  });

  it.each(SIDES)('refuses a third band by the COUNT, still one message at a time (%s)', (side) => {
    const result = PageSetupSchema.safeParse(
      withBands(side, ['firstOnly', 'exceptFirst', 'lastOnly']),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0]?.code).toBe('too_big');
      expect(result.error.issues[0]?.path).toStrictEqual([side]);
      expect(result.error.issues[0]?.message).toBe('A side carries at most two bands.');
    }
  });

  it('answers a hostile band list in one message, not one per band', () => {
    const hostile = Array.from({ length: 5_000 }, (_unused, index) => ({
      on: index < 2_500 ? 'exceptFirst' : 'firstOnly',
      content: { type: 'container', id: `b${index}`, children: [] },
    }));
    const result = PageSetupSchema.safeParse({ ...RECIPE_PAGE, header: [], footer: hostile });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0]?.code).toBe('too_big');
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

  it('answers an ABSENT occurrence with the same message', () => {
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
      expect(result.error.issues.map((issue) => issue.path.join('.'))).toStrictEqual([
        'footer.0.content.type',
        'footer.0.content.children',
      ]);
    }
  });

  it('inherits the BlockNode cut of lot C3 without one line of this lot', () => {
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
    // Only width and height are returned without imposing origin coordinate conventions.
    expect(Object.keys(printableAreaOf(RECIPE_PAGE))).toStrictEqual(['width', 'height']);
  });
});

describe('a band whose container holds together', () => {
  /**
   * A minimal page carrying one band, with the mark on the band's container or without it, plus a
   * slot for writing something on the BAND. The unmarked form OMITS the key rather than spelling
   * it `undefined`, because absence is the shape every document written before version 8 has.
   */
  const pageWith = (keepTogether: true | undefined, band: object = {}): unknown => ({
    sheet: { width: 210, height: 297 },
    margins: { top: 20, right: 15, bottom: 25, left: 15 },
    header: [],
    footer: [
      {
        on: 'every',
        ...band,
        content: {
          type: 'container',
          id: 'ftr',
          ...(keepTogether === undefined ? {} : { keepTogether }),
          children: [
            { type: 'text', id: 'ftr-note', content: [{ kind: 'literal', text: 'Mentions' }] },
          ],
        },
      },
    ],
  });

  it('is accepted and kept, because a band content IS a container node', () => {
    // Structural reuse, and nothing more: `PageBand.content` is a `ContainerNode`, so the mark
    // reaches a band with no line of `page/` changing. What this pins is that the page schema
    // neither refuses it nor strips it.
    const parsed = PageSetupSchema.parse(pageWith(true));

    expect(parsed.footer[0]?.content.keepTogether).toBe(true);
    expect(JSON.parse(JSON.stringify(parsed))).toStrictEqual(pageWith(true));
  });

  it('gives a band NO fragmentation policy of its own', () => {
    // A band is already atomic between two pages, so the mark on its container changes neither its
    // measure nor its failure mode. What the contract must refuse is a policy on the BAND: written
    // at band level the key is unknown to `PageBandSchema`, so it is stripped. The band's own key
    // set is therefore spelled out rather than compared with itself -- comparing a marked page to a
    // bare one cannot fail, since the mark sits three levels below every quantity it would move.
    const marked = PageSetupSchema.parse(pageWith(true));
    const bare = PageSetupSchema.parse(pageWith(undefined));
    const onTheBand = PageSetupSchema.parse(pageWith(undefined, { keepTogether: true }));

    expect(Object.keys(marked.footer[0] ?? {})).toStrictEqual(['on', 'content']);
    expect(Object.keys(onTheBand.footer[0] ?? {})).toStrictEqual(['on', 'content']);
    expect(bare.footer[0]?.content.keepTogether).toBeUndefined();
    expect(Object.hasOwn(bare.footer[0]?.content ?? {}, 'keepTogether')).toBe(false);
  });

  it('travels through a stored template, in a band as in the flow', () => {
    const document = (keepTogether: true | undefined): unknown => ({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: 'facture-c7',
      name: 'Facture — bande insécable',
      version: '1.0.0',
      page: pageWith(keepTogether),
      root: {
        type: 'container',
        id: 'racine',
        ...(keepTogether === undefined ? {} : { keepTogether }),
        children: [],
      },
    });

    const parsed = parseTemplate(document(true));

    expect(parsed.root.keepTogether).toBe(true);
    expect(parsed.page.footer[0]?.content.keepTogether).toBe(true);
    expect(JSON.parse(JSON.stringify(parsed))).toStrictEqual(document(true));
  });
});
