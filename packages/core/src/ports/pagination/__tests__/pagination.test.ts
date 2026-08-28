import { describe, expect, it } from 'vitest';
import {
  FRAGMENT_STATES,
  KeepTogetherFallbackNoticeSchema,
  NODE_TYPES_COVER_THE_UNION,
  OccurrenceReferenceSchema,
  PAGE_TYPE_SATISFIES_SCHEMA,
  PAGINATION_NOTICE_CODES,
  PAGINATION_REGIONS,
  PAGINATION_RESULT_SCHEMA_SATISFIES_TYPE,
  PAGINATION_RESULT_TYPE_SATISFIES_SCHEMA,
  PagePlacementSchema,
  type PaginationResult,
  PaginationResultSchema,
  PLACEMENT_ROLES,
} from '../pagination.js';

const occurrence = {
  nodeId: 'detail',
  nodeType: 'tableRow',
  declarationPath: ['root', 'children', 1, 'body', 0, 'rows', 0],
  iterations: [{ declarationPath: ['root', 'children', 1, 'body', 0], index: 3 }],
} as const;

/** One complete envelope, which every refusal below is a single mutation of. */
const result: PaginationResult = {
  sheet: { width: 210, height: 297 },
  html: '<!doctype html><html><head></head><body></body></html>',
  pages: [
    {
      number: 1,
      placements: [{ occurrence, region: 'root', role: 'flow', fragment: 'first' }],
      report: { incoming: 0, completedBy: [] },
    },
    {
      number: 2,
      placements: [{ occurrence, region: 'header', role: 'page-band', fragment: 'whole' }],
      report: { incoming: 1234.56, completedBy: [occurrence] },
    },
  ],
  notices: [{ code: 'keep-together-fallback', occurrence, pages: [1, 2] }],
};

/** The path a refusal points at, so a caller is told which field of which page is wrong. */
function refusalPath(payload: unknown): readonly (string | number | symbol)[] {
  const parsed = PaginationResultSchema.safeParse(payload);
  expect(parsed.success).toBe(false);
  return parsed.error?.issues[0]?.path ?? [];
}

describe('the pagination result schema', () => {
  it('accepts a complete result', () => {
    expect(PaginationResultSchema.safeParse(result).success).toBe(true);
  });

  it('is mutually assignable with the type it validates', () => {
    expect(PAGINATION_RESULT_SCHEMA_SATISFIES_TYPE).toBe(true);
    expect(PAGINATION_RESULT_TYPE_SATISFIES_SCHEMA).toBe(true);
    expect(PAGE_TYPE_SATISFIES_SCHEMA).toBe(true);
    expect(NODE_TYPES_COVER_THE_UNION).toBe(true);
  });

  it('parses into frozen lists, so a consumer cannot edit the cuts it was handed', () => {
    const parsed = PaginationResultSchema.parse(result);
    expect(Object.isFrozen(parsed.pages)).toBe(true);
    expect(Object.isFrozen(parsed.notices)).toBe(true);
    expect(Object.isFrozen(parsed.pages[0]?.placements)).toBe(true);
  });

  it('strips a field it does not know rather than carrying it forward', () => {
    const parsed = PaginationResultSchema.parse({ ...result, cursor: { index: 0 } });
    expect('cursor' in parsed).toBe(false);
  });

  it('refuses a page rank that is not a whole page, at that page', () => {
    expect(refusalPath({ ...result, pages: [{ ...result.pages[0], number: 0 }] })).toStrictEqual([
      'pages',
      0,
      'number',
    ]);
    expect(refusalPath({ ...result, pages: [{ ...result.pages[0], number: 1.5 }] })).toStrictEqual([
      'pages',
      0,
      'number',
    ]);
  });

  it('refuses a region, a role and a fragment outside their closed vocabulary', () => {
    const placementOf = (patch: Record<string, unknown>): unknown => ({
      ...result,
      pages: [
        {
          ...result.pages[0],
          placements: [{ occurrence, region: 'root', role: 'flow', fragment: 'whole', ...patch }],
        },
      ],
    });
    expect(refusalPath(placementOf({ region: 'margin' }))).toStrictEqual([
      'pages',
      0,
      'placements',
      0,
      'region',
    ]);
    expect(refusalPath(placementOf({ role: 'watermark' }))).toStrictEqual([
      'pages',
      0,
      'placements',
      0,
      'role',
    ]);
    expect(refusalPath(placementOf({ fragment: 'partial' }))).toStrictEqual([
      'pages',
      0,
      'placements',
      0,
      'fragment',
    ]);
  });

  it('refuses a notice code it does not name', () => {
    expect(
      refusalPath({
        ...result,
        notices: [{ code: 'widow-moved', occurrence, pages: [1] }],
      }),
    ).toStrictEqual(['notices', 0, 'code']);
  });

  it('refuses a carried sum that is not a finite number', () => {
    for (const incoming of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        refusalPath({
          ...result,
          pages: [{ ...result.pages[0], report: { incoming, completedBy: [] } }],
        }),
      ).toStrictEqual(['pages', 0, 'report', 'incoming']);
    }
  });

  it('accepts a carried sum below zero, which a credit note produces', () => {
    expect(
      PaginationResultSchema.safeParse({
        ...result,
        pages: [{ ...result.pages[0], report: { incoming: -42.5, completedBy: [] } }],
      }).success,
    ).toBe(true);
  });
});

describe('an occurrence address', () => {
  it('accepts a path of names and ranks with an ordered iteration ancestry', () => {
    expect(OccurrenceReferenceSchema.safeParse(occurrence).success).toBe(true);
  });

  it('refuses a rank that is negative or fractional, in the path and in the ancestry', () => {
    const refuse = (payload: unknown): boolean =>
      OccurrenceReferenceSchema.safeParse(payload).success;
    expect(refuse({ ...occurrence, declarationPath: ['root', -1] })).toBe(false);
    expect(refuse({ ...occurrence, declarationPath: ['root', 1.5] })).toBe(false);
    expect(refuse({ ...occurrence, iterations: [{ declarationPath: ['root'], index: -1 }] })).toBe(
      false,
    );
  });

  it('refuses a node kind the ast does not declare', () => {
    expect(
      OccurrenceReferenceSchema.safeParse({ ...occurrence, nodeType: 'watermark' }).success,
    ).toBe(false);
  });

  it('accepts an occurrence under no repetition at all', () => {
    expect(OccurrenceReferenceSchema.safeParse({ ...occurrence, iterations: [] }).success).toBe(
      true,
    );
  });
});

describe('the closed vocabularies', () => {
  it('names the five areas of a page in paint order', () => {
    expect(PAGINATION_REGIONS).toStrictEqual([
      'background',
      'header',
      'root',
      'footer',
      'foreground',
    ]);
  });

  it('names four placement roles and four fragment states', () => {
    expect(PLACEMENT_ROLES).toStrictEqual(['flow', 'page-band', 'table-header', 'page-layer']);
    expect(FRAGMENT_STATES).toStrictEqual(['whole', 'first', 'middle', 'last']);
  });

  it('names exactly the notice codes the schema accepts', () => {
    expect(PAGINATION_NOTICE_CODES).toStrictEqual(['keep-together-fallback']);
    for (const code of PAGINATION_NOTICE_CODES) {
      expect(
        KeepTogetherFallbackNoticeSchema.safeParse({ code, occurrence, pages: [1] }).success,
      ).toBe(true);
    }
  });

  it('refuses a placement whose occurrence is missing entirely', () => {
    expect(
      PagePlacementSchema.safeParse({ region: 'root', role: 'flow', fragment: 'whole' }).success,
    ).toBe(false);
  });
});
