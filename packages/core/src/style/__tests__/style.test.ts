import { describe, expect, it } from 'vitest';
import type { z } from 'zod/v4';
import type { MutuallyAssignable } from '../../ast/__tests__/fixtures.js';
import { TableColumnSchema, TextNodeSchema } from '../../ast/nodes.js';
import { MAX_SHEET_MM } from '../../page/page.js';
import { parseTemplate } from '../../template/migrate.js';
import { CURRENT_SCHEMA_VERSION } from '../../template/template.js';
import {
  type BorderEdge,
  BorderEdgeSchema,
  type BoxBorder,
  BoxBorderSchema,
  type BoxSpacing,
  BoxSpacingSchema,
  type BoxStyle,
  BoxStyleSchema,
  ColorSchema,
  MAX_FONT_SIZE_PT,
  MIN_FONT_SIZE_PT,
  mmFromPt,
  ptFromMm,
  resolveTextAlign,
  resolveTypography,
  type Typography,
  TypographySchema,
} from '../style.js';
import { RECIPE_BOX_COMPLETE, RECIPE_TYPOGRAPHY_COMPLETE, styleOfCase } from './fixtures.js';

/**
 * ## Five shapes, TEN assertions: one `keyof` pair and one value pair each
 *
 * The two families are COMPLEMENTARY and never interchangeable, and that is measured rather than
 * asserted. On an eight-mutation matrix: `keyof` catches PRESENCE -- a field removed from the
 * schema, a field added to it -- and misses a TYPE drift; the value pair does the exact opposite.
 * A design writing only one family is half guarded.
 *
 * What was DROPPED from an earlier draft, on the same measurement: the five one-directional
 * `X_SATISFIES_TYPE` assertions. They never refuse ALONE -- they fire only where a mutual pair
 * fires too -- so they were five exported symbols for zero added coverage.
 *
 * AND THE TEN OF THEM ARE STILL BLIND TO ONE MUTATION, which is why the round trips below
 * exist. MEASURED: remove the `top` edge from `BoxBorderSchema` and all ten pass at exit 0,
 * while the parse silently drops the top rule. `BoxBorder` is all-optional, so the amputated
 * object stays mutually assignable, and `keyof BoxStyle` does not move because `border` is still
 * there. `ast/schemas.ts` already wrote the remedy -- "Only a runtime parsing test catches that,
 * and that is why there is one per node type" -- read here as ONE PER STYLE FIELD.
 *
 * `const` and not `it`, because there is nothing to run: the guard is the ANNOTATION, and
 * `pnpm run type-check` is what runs it. Exported so they are not reported unused.
 */
export const TYPOGRAPHY_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof TypographySchema>,
  keyof Typography
> = true;

export const TYPOGRAPHY_IN_STEP: MutuallyAssignable<
  z.infer<typeof TypographySchema>,
  Typography
> = true;

export const BOX_STYLE_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof BoxStyleSchema>,
  keyof BoxStyle
> = true;

export const BOX_STYLE_IN_STEP: MutuallyAssignable<z.infer<typeof BoxStyleSchema>, BoxStyle> = true;

export const BORDER_EDGE_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof BorderEdgeSchema>,
  keyof BorderEdge
> = true;

export const BORDER_EDGE_IN_STEP: MutuallyAssignable<
  z.infer<typeof BorderEdgeSchema>,
  BorderEdge
> = true;

export const BOX_BORDER_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof BoxBorderSchema>,
  keyof BoxBorder
> = true;

export const BOX_BORDER_IN_STEP: MutuallyAssignable<
  z.infer<typeof BoxBorderSchema>,
  BoxBorder
> = true;

export const BOX_SPACING_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof BoxSpacingSchema>,
  keyof BoxSpacing
> = true;

export const BOX_SPACING_IN_STEP: MutuallyAssignable<
  z.infer<typeof BoxSpacingSchema>,
  BoxSpacing
> = true;

describe('the two bounds of a font size', () => {
  it('derives the ceiling from MAX_SHEET_MM instead of restating it, in both directions', () => {
    // Both halves are pinned on purpose. The first stops the derivation from being "tidied" into
    // the pre-computed factor, which yields 5079.999999999999 and would move the ceiling by a
    // fraction of a point; the second is what makes "the same bound in the other unit" a claim
    // rather than a coincidence.
    expect(MAX_FONT_SIZE_PT).toBe(14_400);
    expect(mmFromPt(MAX_FONT_SIZE_PT)).toBe(MAX_SHEET_MM);
    expect(ptFromMm(MAX_SHEET_MM)).toBe(MAX_FONT_SIZE_PT);
    expect(MIN_FONT_SIZE_PT).toBe(1);
  });

  it('does not promise that the two conversions are inverses, and here is a value that is not', () => {
    // A property a consumer has to know: 223 of the first 1 000 integer point sizes do not
    // survive a round trip. Pinning one of them is what stops the docstring's warning from
    // becoming folklore -- and what would redden if someone "simplified" one of the two bodies.
    expect(ptFromMm(mmFromPt(3))).not.toBe(3);
    expect(mmFromPt(10)).toBe(3.5277777777777777);
  });
});

describe('a style survives the parse field by field', () => {
  // SEVENTEEN round trips, one per style field, and they are the only guard that catches an
  // amputated OPTIONAL field. Written as one `it` per shape rather than one per field so the
  // failure names the shape, and comparing the WHOLE object rather than field by field so that a
  // field the schema drops shows up as a missing key instead of an undefined read.
  it('keeps all five fields of a Typography -- 5 of the 17', () => {
    const parsed = TypographySchema.parse(RECIPE_TYPOGRAPHY_COMPLETE);

    expect(parsed).toStrictEqual(RECIPE_TYPOGRAPHY_COMPLETE);
    // `.sort()` on the fresh array and NOT `.toSorted()`: this package declares `lib: ["ES2022"]`
    // and MEASURED, `toSorted` is TS2550 there -- "Do you need to change your target library?".
    // The answer is no: AGENTS.md 7 forbids loosening a tsconfig to unblock a compilation.
    expect(Object.keys(parsed).sort()).toStrictEqual([
      'bold',
      'color',
      'family',
      'italic',
      'sizePt',
    ]);
  });

  it('keeps all three fields of a BoxStyle, its four edges and its four insets -- 11 of the 17', () => {
    const parsed = BoxStyleSchema.parse(RECIPE_BOX_COMPLETE);

    expect(parsed).toStrictEqual(RECIPE_BOX_COMPLETE);
    expect(Object.keys(parsed).sort()).toStrictEqual(['background', 'border', 'padding']);
    expect(Object.keys(parsed.border ?? {}).sort()).toStrictEqual([
      'bottom',
      'left',
      'right',
      'top',
    ]);
    expect(Object.keys(parsed.padding ?? {}).sort()).toStrictEqual([
      'bottom',
      'left',
      'right',
      'top',
    ]);
  });

  it('keeps the alignment of a text node -- the 17th', () => {
    const node = { type: 'text', id: 't', content: [], align: 'end' };

    expect(TextNodeSchema.parse(node)).toStrictEqual(node);
  });

  it('REFUSES an empty style object, because absence is the one spelling of "no style"', () => {
    // An editor that opens a style panel and sets nothing legitimately BUILDS an empty box; what
    // it must not do is SAVE one. Accepting it would store two spellings of one fact, and four
    // already-planned consumers distinguish them -- a diff, a dirty-state flag, a content hash,
    // an undo history. NOT ONE OF THEM READS A VALUE, which is why "every field is optional so
    // the read yields undefined either way" answered the wrong question.
    for (const schema of [BoxStyleSchema, TypographySchema, BoxBorderSchema]) {
      const refusal = schema.safeParse({});

      expect(refusal.success).toBe(false);
      if (!refusal.success) {
        expect(refusal.error.issues[0]?.message).toBe(
          'An empty style object is not a style; omit the field',
        );
      }
    }

    expect(BoxStyleSchema.safeParse({ border: {} }).success).toBe(false);
  });

  it('REFUSES a key present with an undefined value, which is the third spelling', () => {
    // The trap the predicate exists for: a key count on an object carrying one undefined value
    // yields ONE, so a key-count guard would accept this and leave three spellings instead of
    // one. The predicate is on VALUES. A JSON round trip erases the difference --
    // `JSON.stringify` drops `undefined` -- but an editor comparing objects it built itself
    // never goes through JSON.
    expect(BoxStyleSchema.safeParse({ background: undefined }).success).toBe(false);
  });

  it('strips a key it does not know, so a style parse is not a persistence boundary', () => {
    // `z.object` and not `z.strictObject`: the price is this silent loss WITHIN a version, which
    // the schema stamp does not cover. `strictObject` was refused because its refusal reports an
    // EMPTY path, so lot C8 could not point at the offending key from the path.
    expect(TypographySchema.parse({ sizePt: 10, letterSpacing: 0.2 })).toStrictEqual({
      sizePt: 10,
    });
  });

  it('accepts both letter cases of a colour, and stores them UNCHANGED', () => {
    // The decision and its price in one assertion: nothing folds the case on parse, so an
    // equality comparison between the two spellings fails and a consumer that compares colours
    // folds the case itself.
    expect(ColorSchema.parse('#FFAA00')).toBe('#FFAA00');
    expect(ColorSchema.parse('#ffaa00')).toBe('#ffaa00');
    expect(ColorSchema.parse('#FFAA00')).not.toBe(ColorSchema.parse('#ffaa00'));
  });

  it('REFUSES a rule of zero width, and the message says how to spell "no rule"', () => {
    // The ONE assertion of this file that turns on the shape of `BoxBorder` rather than on a
    // bound. `PageMargins` has FOUR REQUIRED edges, so zero is its only spelling of "no margin"
    // and refusing it "would be a rule of typography". `BoxBorder` has FOUR OPTIONAL edges, so
    // absence already spells it and zero is a second spelling. Same repository, opposite shapes,
    // opposite predicates -- and the message carries the remedy rather than a prescription.
    const refusal = BorderEdgeSchema.safeParse({ width: 0, color: '#1b3a6f' });

    expect(refusal.success).toBe(false);
    if (!refusal.success) {
      expect(refusal.error.issues[0]?.message).toBe(
        'A rule has a positive width; omit the edge to declare no rule',
      );
    }
    // And the counter-check, because a predicate that refused everything would pass the test
    // above: 0.28 mm is 0.8 pt, a standard editorial thickness, and it is the value the
    // two-decimal formula of ADR 0006 would have REFUSED -- which is why no such formula is
    // written here.
    expect(BorderEdgeSchema.parse({ width: 0.28, color: '#1b3a6f' }).width).toBe(0.28);
  });

  it('accepts a padding of four zeroes', () => {
    const zeroes = { top: 0, right: 0, bottom: 0, left: 0 };

    expect(BoxSpacingSchema.parse(zeroes)).toStrictEqual(zeroes);
  });
});

describe('what a style refuses, with the code and the path', () => {
  const issuesOf = (
    schema: { safeParse: (value: unknown) => z.ZodSafeParseResult<unknown> },
    value: unknown,
  ) => {
    const result = schema.safeParse(value);
    return (result.error?.issues ?? []).map((issue) => ({
      code: issue.code,
      path: issue.path,
      message: issue.message,
    }));
  };

  it.each([
    ['N01 three digits', { color: '#fa0' }, 'invalid_format'],
    ['N02 a CSS name', { color: 'red' }, 'invalid_format'],
    ['N03 an alpha channel', { color: '#1b3a6fff' }, 'invalid_format'],
    ['N04 a functional notation', { color: 'rgb(1,2,3)' }, 'invalid_format'],
    ['N05 a system colour', { color: 'Canvas' }, 'invalid_format'],
    ['N06 a number', { color: 0x1b3a6f }, 'invalid_type'],
  ])('refuses %s on the path ["color"]', (_label, value, code) => {
    expect(issuesOf(TypographySchema, value)).toStrictEqual([
      { code, path: ['color'], message: expect.any(String) },
    ]);
  });

  it('names ONE fault at a time: a declared-but-wrong field is not ALSO reported as empty', () => {
    // The cut-off rule of `checkTableWiring`, applied to the emptiness check -- and it is what
    // makes every other assertion in this block a single-element array. Without it, MEASURED,
    // `{ color: 'red' }` yields TWO issues: the real one, plus a FALSE "An empty style object is
    // not a style" whose path is EMPTY, because an optional field that failed its own check is
    // DROPPED from the output the check inspects. An author who has one thing to fix is told
    // once, and lot C8 has one thing to narrate.
    expect(issuesOf(TypographySchema, { color: 'red' })).toHaveLength(1);
    expect(
      issuesOf(BoxStyleSchema, { padding: { top: -1, right: 0, bottom: 0, left: 0 } }),
    ).toHaveLength(1);
    // The counter-check, so the cut-off can never be read as "the emptiness check never fires".
    expect(issuesOf(TypographySchema, {})).toStrictEqual([
      { code: 'custom', path: [], message: 'An empty style object is not a style; omit the field' },
    ]);
  });

  it('names the colour form once, and the message is a constant', () => {
    expect(issuesOf(TypographySchema, { color: 'red' })[0]?.message).toBe(
      'A colour is six hexadecimal digits behind a hash, as #1b3a6f',
    );
    // No interpolation of the document, per ADR 0003: an error payload stays safe to log.
    expect(issuesOf(BoxStyleSchema, { background: '#GGGGGG' })).toStrictEqual([
      {
        code: 'invalid_format',
        path: ['background'],
        message: 'A colour is six hexadecimal digits behind a hash, as #1b3a6f',
      },
    ]);
  });

  it.each([
    ['N07 zero', { sizePt: 0 }, 'too_small', 'A font size is at least 1 pt'],
    ['N08 half a point', { sizePt: 0.5 }, 'too_small', 'A font size is at least 1 pt'],
    ['N09 past the ceiling', { sizePt: 14_401 }, 'too_big', 'A font size is at most 14400 pt'],
  ])('refuses a size %s', (_label, value, code, message) => {
    expect(issuesOf(TypographySchema, value)).toStrictEqual([{ code, path: ['sizePt'], message }]);
  });

  it('refuses NaN and Infinity, and the Infinity message is the one lot C8 inherits', () => {
    expect(issuesOf(TypographySchema, { sizePt: Number.NaN })).toStrictEqual([
      {
        code: 'invalid_type',
        path: ['sizePt'],
        message: 'Invalid input: expected number, received NaN',
      },
    ]);
    // MEASURED and recorded rather than fixed: "expected number, received number". Six numeric
    // positions of this lot carry the defect, and it is a reserve already booked to lot C8.
    expect(issuesOf(TypographySchema, { sizePt: Number.POSITIVE_INFINITY })).toStrictEqual([
      {
        code: 'invalid_type',
        path: ['sizePt'],
        message: 'Invalid input: expected number, received number',
      },
    ]);
  });

  it('refuses an empty family and a non-boolean bold or italic', () => {
    expect(issuesOf(TypographySchema, { family: '' })).toStrictEqual([
      { code: 'too_small', path: ['family'], message: 'A font family name is required' },
    ]);
    expect(issuesOf(TypographySchema, { bold: 'yes' })).toStrictEqual([
      {
        code: 'invalid_type',
        path: ['bold'],
        message: 'Invalid input: expected boolean, received string',
      },
    ]);
    expect(issuesOf(TypographySchema, { italic: 'yes' })).toStrictEqual([
      {
        code: 'invalid_type',
        path: ['italic'],
        message: 'Invalid input: expected boolean, received string',
      },
    ]);
  });

  it.each([
    [
      'N18 an edge with no colour',
      { border: { bottom: { width: 0.3 } } },
      'invalid_type',
      ['border', 'bottom', 'color'],
    ],
    ['N19 a scalar shorthand padding', { padding: 2 }, 'invalid_type', ['padding']],
    [
      'N20 a padding of three edges',
      { padding: { top: 1, right: 1, bottom: 1 } },
      'invalid_type',
      ['padding', 'left'],
    ],
  ])('refuses %s', (_label, value, code, path) => {
    expect(issuesOf(BoxStyleSchema, value)).toStrictEqual([
      { code, path, message: expect.any(String) },
    ]);
  });

  it('ACCEPTS justify on a text node and REFUSES it on a column, the whole boundary', () => {
    // The two halves of one decision, in one `it`, because separating them would let either half
    // pass alone -- and either half alone is the bug. `justify` is what `ast/types.ts` used to
    // promise this lot; the lot delivers it on the tuple that has runs, and NOT on the one that
    // states a default for a whole column.
    //
    // The refusal message on the column is the THIRD form of incompatibility -- an older build
    // meets `invalid_value` on a discriminant path, with no typed error and no version named --
    // and it is exactly why this tuple is not the one that was widened.
    expect(
      TextNodeSchema.safeParse({ type: 'text', id: 't', content: [], align: 'justify' }).success,
    ).toBe(true);

    expect(issuesOf(TableColumnSchema, { id: 'c', width: 1, align: 'justify' })).toStrictEqual([
      {
        code: 'invalid_value',
        path: ['align'],
        message: 'Invalid option: expected one of "start"|"center"|"end"',
      },
    ]);
  });

  it('refuses an unknown alignment on a text node', () => {
    // The non-inertia counter-check of the `it` above: `TEXT_ALIGNMENTS` accepting `justify` must
    // not mean it accepts anything. Four members, and a fifth is refused.
    expect(
      issuesOf(TextNodeSchema, { type: 'text', id: 't', content: [], align: 'middle' }),
    ).toStrictEqual([
      {
        code: 'invalid_value',
        path: ['align'],
        message: 'Invalid option: expected one of "start"|"center"|"end"|"justify"',
      },
    ]);
  });

  it.each([
    [
      'N21 a negative inset',
      { padding: { top: -0.1, right: 1, bottom: 1, left: 1 } },
      'too_small',
      ['padding', 'top'],
      'A length cannot be negative',
    ],
    [
      'N22 a negative rule width',
      { border: { top: { width: -1, color: '#1b3a6f' } } },
      'too_small',
      ['border', 'top', 'width'],
      'A rule has a positive width; omit the edge to declare no rule',
    ],
    [
      'N23 an inset past the sheet',
      { padding: { top: 5081, right: 1, bottom: 1, left: 1 } },
      'too_big',
      ['padding', 'top'],
      'A length is at most 5080 mm',
    ],
  ])('refuses %s', (_label, value, code, path, message) => {
    expect(issuesOf(BoxStyleSchema, value)).toStrictEqual([{ code, path, message }]);
  });
});

describe('the ninth accrual site, which no type assertion can guard', () => {
  it('carries a style at ALL NINE sites through a full parseTemplate round trip', () => {
    // `Template` IS THE NINTH SITE AND IT IS STRUCTURALLY UNGUARDABLE. Its type is INFERRED from
    // its schema, so a `TEMPLATE_KEYS_IN_STEP` pair would compare an annotation with itself --
    // tautological. It is also one of the nine sites the mutation matrix measured at exit 0.
    //
    // The only net left is a JSON round trip on a literal that CARRIES the field, and the
    // repository's two existing round trips (`table.test.ts`, `page.test.ts`) each see only the
    // sites their own fixture happens to reach. This `it` is the one that reaches all nine: five
    // `box` (text, image, container, table, tableRow), four `typography` (text, literal, binding,
    // pageField) and the `align`, the last two INSIDE A PAGE BAND -- which is where the
    // backward-compatibility measurement showed the loss running deepest.
    const nineSites = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: 'facture-c5',
      name: 'Facture — les neuf sites',
      version: '1.0.0',
      page: {
        sheet: { width: 210, height: 297 },
        margins: { top: 20, right: 20, bottom: 20, left: 20 },
        header: [],
        footer: [
          {
            on: 'every',
            content: {
              type: 'container',
              id: 'ftr',
              box: { border: { top: { width: 0.28, color: '#1b3a6f' } } },
              children: [
                {
                  type: 'text',
                  id: 'ftr-num',
                  box: { padding: { top: 1, right: 0, bottom: 0, left: 0 } },
                  typography: { sizePt: 8 },
                  align: 'center',
                  content: [
                    { kind: 'literal', text: 'Page ', typography: { italic: true } },
                    { kind: 'pageField', field: 'number', typography: { bold: true } },
                  ],
                },
              ],
            },
          },
        ],
      },
      root: {
        type: 'container',
        id: 'racine',
        box: { background: '#F2F4F8' },
        children: [
          {
            type: 'image',
            id: 'logo',
            src: 'logo.png',
            box: { padding: { top: 0, right: 0, bottom: 2, left: 0 } },
          },
          {
            type: 'text',
            id: 'titre',
            box: RECIPE_BOX_COMPLETE,
            typography: RECIPE_TYPOGRAPHY_COMPLETE,
            align: 'end',
            content: [
              {
                kind: 'binding',
                value: { kind: 'path', path: 'facture.numero' },
                typography: { bold: false },
              },
            ],
          },
          {
            type: 'table',
            id: 'lignes',
            box: { background: '#FFFFFF' },
            columns: [{ id: 'c', width: 1, align: 'start' }],
            header: [],
            body: [
              {
                type: 'tableRow',
                id: 'r',
                box: { padding: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 } },
                cells: [{ columnId: 'c', children: [] }],
              },
            ],
            footer: [],
          },
        ],
      },
    };

    const parsed = parseTemplate(nineSites);

    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(JSON.parse(JSON.stringify(parsed))).toStrictEqual(nineSites);
  });
});

describe('the two resolutions', () => {
  it('merges typography PROPERTY BY PROPERTY, the run winning each one', () => {
    // The contract is the per-property merge, not a whole-object override: a run declaring only
    // `bold` must keep the block's family and size. A test that pinned the object wholesale would
    // pass on an implementation that returns the run or else the block, which is a different
    // function.
    const block: Typography = { family: 'EB Garamond', sizePt: 10.5, color: '#22262b' };
    const run: Typography = { bold: true, color: '#8C3A1B' };

    expect(resolveTypography({ run, block })).toStrictEqual({
      family: 'EB Garamond',
      sizePt: 10.5,
      bold: true,
      italic: undefined,
      color: '#8C3A1B',
    });
  });

  it('returns undefined for what neither source declares, and resolves nothing else', () => {
    // The honest half of the name: the five values a document does not declare are decided by the
    // renderer, and ADR 0007 names them as a debt. A type promising five defined fields would
    // have been a lie -- measured, five diagnostics of TS2322.
    expect(resolveTypography({})).toStrictEqual({
      family: undefined,
      sizePt: undefined,
      bold: undefined,
      italic: undefined,
      color: undefined,
    });
    expect(resolveTypography({ block: styleOfCase('b').body })).toStrictEqual({
      family: 'Inter',
      sizePt: 9,
      bold: undefined,
      italic: undefined,
      color: '#3A3A3A',
    });
  });

  it('gives the BLOCK the last word on an alignment, over its column', () => {
    // A precedence is a decision of the contract, not a paraphrase of the body: this is the one
    // assertion that would redden if someone swapped the two terms. And swapping them COMPILES --
    // `column ?? text` yields the wider of the two types, so gate 3 stays silent; only this `it`
    // sees it.
    expect(resolveTextAlign({ text: 'end', column: 'start' })).toBe('end');
    expect(resolveTextAlign({ column: 'start' })).toBe('start');
    expect(resolveTextAlign({ text: 'center' })).toBe('center');
    expect(resolveTextAlign({})).toBeUndefined();
    // `justify` travels UP from the block and can never come from the column: the second call is
    // what a cell holding a justified paragraph inside a `start` column really resolves to.
    expect(resolveTextAlign({ text: 'justify', column: 'start' })).toBe('justify');
  });
});
