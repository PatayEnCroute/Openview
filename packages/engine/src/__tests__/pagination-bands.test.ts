import type { PageBandOccurrence } from '@openview/core';
import { describe, expect, it } from 'vitest';
import {
  bandApplies,
  bandForRole,
  type PageRole,
  pageRole,
  reachableOccurrences,
  rolesOf,
} from '../document/bands.js';
import type {
  MaterialDocument,
  MaterialPageFieldRun,
  ResolvedTypography,
} from '../document/types.js';
import { buildPagedTree } from '../html/build-page.js';
import { serializeHtml } from '../html/serialize.js';
import {
  CANONICAL_NUMBER_ALPHABET,
  CANONICAL_NUMBER_MAX_CHARS,
  type MarkerBounds,
  type MarkerSignature,
  markerReserve,
  markerSignature,
  markerSignatures,
} from '../pagination/markers.js';
import {
  constantMarkers,
  gridPage,
  literalText,
  materializedOf,
  multiPageOf,
  paginateOnGrid,
  refusalOfCut,
  SAMPLE_DATA,
  TINY_PNG,
} from './fixtures.js';

const flow = (children: readonly Record<string, unknown>[]): Record<string, unknown> => ({
  root: { type: 'container', id: 'root', children },
});

const lines = (count: number): string => 'x'.repeat(count * 20);

const band = (
  on: PageBandOccurrence,
  id: string,
  children: readonly Record<string, unknown>[],
): Record<string, unknown> => ({
  on,
  content: { type: 'container', id, children },
});

const PAGINATION = [
  { kind: 'literal', text: 'p ' },
  { kind: 'pageField', field: 'number' },
  { kind: 'literal', text: '/' },
  { kind: 'pageField', field: 'count' },
];

const marked = (id: string): Record<string, unknown> => ({ type: 'text', id, content: PAGINATION });

/** A text block carrying a page report marker, with the rounding the model declares for it. */
const reported = (id: string): Record<string, unknown> => ({
  type: 'text',
  id,
  content: [{ kind: 'pageField', field: 'report', decimals: 2, mode: 'halfExpand' }],
});

describe('which band a page of each role carries', () => {
  const TABLE: readonly (readonly [PageRole, readonly PageBandOccurrence[]])[] = [
    ['only', ['every', 'firstOnly', 'lastOnly']],
    ['first', ['every', 'firstOnly', 'exceptLast']],
    ['middle', ['every', 'exceptFirst', 'exceptLast']],
    ['last', ['every', 'exceptFirst', 'lastOnly']],
  ];

  it.each(TABLE)('a %s page carries exactly %s', (role, applicable) => {
    const all: readonly PageBandOccurrence[] = [
      'every',
      'firstOnly',
      'exceptFirst',
      'exceptLast',
      'lastOnly',
    ];
    expect(all.filter((on) => bandApplies(on, role))).toStrictEqual(
      all.filter((on) => applicable.includes(on)),
    );
  });

  it.each([
    [1, 1, 'only'],
    [1, 4, 'first'],
    [2, 4, 'middle'],
    [3, 4, 'middle'],
    [4, 4, 'last'],
    [1, 2, 'first'],
    [2, 2, 'last'],
  ])('page %i of %i is the %s page', (number, count, role) => {
    expect(pageRole(number, count)).toBe(role);
  });

  it('names the roles a run of pages really has', () => {
    expect(rolesOf(1)).toStrictEqual(['only']);
    expect(rolesOf(2)).toStrictEqual(['first', 'last']);
    expect(rolesOf(7)).toStrictEqual(['first', 'middle', 'last']);
  });

  it('reaches every domain as soon as there are two pages, and only three on one', () => {
    expect([...reachableOccurrences(1)].sort()).toStrictEqual(['every', 'firstOnly', 'lastOnly']);
    expect([...reachableOccurrences(2)].sort()).toStrictEqual([
      'every',
      'exceptFirst',
      'exceptLast',
      'firstOnly',
      'lastOnly',
    ]);
    expect([...reachableOccurrences(9)].sort()).toStrictEqual([...reachableOccurrences(2)].sort());
  });

  it('selects nothing from a side that declares none', () => {
    expect(bandForRole([], 'first')).toBeUndefined();
  });

  it('never stacks two bands of one side, whichever legal pair is declared', () => {
    const document = multiPageOf(
      {
        page: gridPage(2, { footer: [band('exceptLast', 'run', []), band('lastOnly', 'end', [])] }),
        ...flow([literalText('a', lines(5))]),
      },
      {},
    );
    const paginated = paginateOnGrid(document);
    expect(paginated.pages.length).toBeGreaterThan(1);
    for (const page of paginated.pages) {
      expect(page.footer).toHaveLength(1);
    }
    expect(paginated.pages.map((page) => page.footer[0]?.nodeId)).toStrictEqual([
      'run',
      'run',
      'end',
    ]);
  });
});

describe('a band that is never painted is never bound', () => {
  const withBoth = (bind: (overrides: Record<string, unknown>) => MaterialDocument) =>
    bind({
      page: gridPage(4, {
        footer: [
          band('exceptLast', 'run', [literalText('run-t', 'running')]),
          band('lastOnly', 'end', [literalText('end-t', 'final')]),
        ],
      }),
      ...flow([literalText('a', lines(1))]),
    });

  it('binds only the domains a one-page document can reach', () => {
    const document = withBoth((overrides) => materializedOf(overrides, {}));
    expect(document.footerBands.map((entry) => entry.on)).toStrictEqual(['lastOnly']);
  });

  it('binds the complementary domains once a run of pages needs them', () => {
    const document = withBoth((overrides) => multiPageOf(overrides, {}));
    expect(document.footerBands.map((entry) => entry.on)).toStrictEqual(['exceptLast', 'lastOnly']);
  });

  it('does not evaluate a formula of a band no page will show', () => {
    /* `exceptFirst` is painted nowhere on one page, and the path it reads is absent from the data:
       binding it would refuse a document that is perfectly printable. */
    const overrides = {
      page: gridPage(4, {
        header: [
          band('exceptFirst', 'later', [
            {
              type: 'text',
              id: 'later-t',
              content: [{ kind: 'binding', value: { kind: 'path', path: 'nowhere.at.all' } }],
            },
          ]),
        ],
      }),
      ...flow([literalText('a', lines(1))]),
    };
    expect(() => materializedOf(overrides, SAMPLE_DATA)).not.toThrow();
    expect(() => multiPageOf(overrides, SAMPLE_DATA)).toThrow();
  });
});

describe('the two reserves are the same on every page', () => {
  const tall = (id: string, count: number) =>
    band('every', id, [literalText(`${id}-t`, lines(count))]);

  it('reserves the height of the tallest band a side can ever show', () => {
    const paginated = paginateOnGrid(
      multiPageOf(
        {
          /* The tall band is declared FIRST, so the reserve cannot be the last one measured: only
             taking the maximum gives three lines on every sheet. */
          page: gridPage(8, {
            footer: [
              band('exceptLast', 'run', [literalText('run-t', lines(3))]),
              band('lastOnly', 'end', [literalText('end-t', lines(1))]),
            ],
          }),
          ...flow([literalText('a', lines(20))]),
        },
        {},
      ),
    );
    /* Three lines on every page, including those showing the one-line running foot. */
    expect(paginated.footerReserve).toBeCloseTo(3 * 10 * (25.4 / 96), 6);
    expect(paginated.headerReserve).toBe(0);
    /* Eight lines of printable, three reserved: five for the flow, so twenty lines take four pages. */
    expect(paginated.pages).toHaveLength(4);
  });

  it('refuses a band taller on its own than the printable area', () => {
    const refused = refusalOfCut(() =>
      paginateOnGrid(
        materializedOf(
          {
            page: gridPage(2, { header: [tall('big', 5)] }),
            ...flow([literalText('a', lines(1))]),
          },
          {},
        ),
      ),
    );
    expect(refused.code).toBe('page-band-overflow');
    expect(refused.details.region).toBe('header');
    expect(refused.details.nodeId).toBe('big');
  });

  it('refuses two bands that together leave the page no room', () => {
    const refused = refusalOfCut(() =>
      paginateOnGrid(
        materializedOf(
          {
            page: gridPage(4, { header: [tall('top', 3)], footer: [tall('bottom', 3)] }),
            ...flow([literalText('a', lines(1))]),
          },
          {},
        ),
      ),
    );
    expect(refused.code).toBe('page-band-overflow');
    expect(refused.details.region).toBe('root');
  });

  it('refuses a flow that has no height left once the bands have taken theirs', () => {
    const refused = refusalOfCut(() =>
      paginateOnGrid(
        materializedOf(
          {
            page: gridPage(4, { header: [tall('top', 2)], footer: [tall('bottom', 2)] }),
            ...flow([literalText('a', lines(1))]),
          },
          {},
        ),
      ),
    );
    expect(refused.code).toBe('pagination-impossible');
    expect(refused.details.nodeId).toBe('root');
  });

  it('prints a page of bands alone when the flow holds nothing', () => {
    const paginated = paginateOnGrid(
      materializedOf(
        {
          page: gridPage(4, { header: [tall('top', 2)], footer: [tall('bottom', 2)] }),
          ...flow([]),
        },
        {},
      ),
    );
    expect(paginated.pages).toHaveLength(1);
    expect(paginated.pages[0]?.header.map((block) => block.nodeId)).toStrictEqual(['top']);
    expect(paginated.pages[0]?.footer.map((block) => block.nodeId)).toStrictEqual(['bottom']);
  });
});

const PROBE_TYPOGRAPHY: ResolvedTypography = {
  family: 'sans-serif',
  sizePt: 10,
  bold: false,
  italic: false,
  color: '#000000',
};

/** Bounds a counter of three digits and no contribution at all: the canonical case. */
const PROBE_BOUNDS: MarkerBounds = { pages: 100, report: 0 };

/** The shape map the reserve reads, filed under the key the run really answers to. */
function shapeOf(
  run: MaterialPageFieldRun,
  shape: Partial<MarkerSignature>,
): {
  readonly signatures: ReadonlyMap<string, MarkerSignature>;
  readonly key: string;
} {
  const key = markerSignature(run);
  return {
    key,
    signatures: new Map([
      [
        key,
        {
          typography: run.typography,
          css: '',
          samples: ['0'],
          repeat: 1,
          placeholder: '0',
          ...shape,
        },
      ],
    ]),
  };
}

const counterRun = (): MaterialPageFieldRun => ({
  kind: 'pageField',
  field: 'number',
  typography: PROBE_TYPOGRAPHY,
});

const reportRun = (): MaterialPageFieldRun => ({
  kind: 'pageField',
  field: 'report',
  decimals: 2,
  mode: 'halfExpand',
  typography: PROBE_TYPOGRAPHY,
});

describe('the page markers', () => {
  const document = () =>
    multiPageOf(
      {
        page: gridPage(6, {
          header: [band('every', 'top', [marked('top-t')])],
          footer: [
            band('exceptLast', 'run', [marked('run-t')]),
            band('lastOnly', 'end', [marked('end-t')]),
          ],
        }),
        ...flow([literalText('a', lines(12)), marked('inflow')]),
      },
      {},
    );

  const printedMarkers = (html: string): readonly (readonly string[])[] =>
    html
      .split('class="ov-page"')
      .slice(1)
      .map((page) => [...page.matchAll(/class="ov-marker"[^>]*>([^<]*)</g)].map((m) => m[1] ?? ''));

  it('writes the rank of the page that holds them, and the same count everywhere', () => {
    const paginated = paginateOnGrid(document(), {}, constantMarkers(2, 6));
    const html = serializeHtml(buildPagedTree(paginated));
    const shown = printedMarkers(html);
    expect(shown).toHaveLength(paginated.pages.length);
    const count = String(paginated.pages.length);
    for (const [index, page] of shown.entries()) {
      /* Every marker of a page shows either its own rank or the total, and never anything else. */
      for (const value of page) {
        expect([String(index + 1), count]).toContain(value);
      }
      expect(page).toContain(String(index + 1));
      expect(page).toContain(count);
    }
  });

  it('substitutes a marker in a band, in the flow, and in a table cell alike', () => {
    const paginated = paginateOnGrid(
      multiPageOf(
        {
          page: gridPage(6, { header: [band('every', 'top', [marked('top-t')])] }),
          ...flow([
            marked('inflow'),
            {
              type: 'table',
              id: 'grid',
              columns: [{ id: 'only', width: 1, align: 'start' }],
              header: [],
              body: [
                {
                  type: 'tableRow',
                  id: 'r',
                  cells: [{ columnId: 'only', children: [marked('incell')] }],
                },
              ],
              footer: [],
            },
          ]),
        },
        {},
      ),
      {},
      constantMarkers(1, 6),
    );
    const html = serializeHtml(buildPagedTree(paginated));
    expect(html).not.toContain('pageField');
    for (const id of ['top-t', 'inflow', 'incell']) {
      const at = html.indexOf(`data-openview-node="${id}"`);
      expect(at).toBeGreaterThan(-1);
      expect(html.slice(at, at + 400)).toContain('class="ov-marker"');
    }
  });

  it('reserves the same box whatever digits land in it, so 9 to 10 moves no cut', () => {
    const paginated = paginateOnGrid(document(), {}, constantMarkers(3, 6));
    const html = serializeHtml(buildPagedTree(paginated));
    const widths = [...html.matchAll(/class="ov-marker" style="[^"]*width:([\d.]+)px/g)].map(
      (match) => match[1],
    );
    expect(new Set(widths).size).toBe(1);
    expect(widths[0]).toBe('18');
  });

  it('collects one signature per typography a marker uses, and no other', () => {
    const signatures = markerSignatures(document(), PROBE_BOUNDS);
    expect(signatures.size).toBe(1);
    const [signature] = [...signatures.values()];
    expect(signature?.css).toContain('font-family:sans-serif');
  });

  it('finds a marker wherever it is nested, and ignores what is not one', () => {
    const nested = multiPageOf(
      {
        page: gridPage(20, { header: [band('every', 'top', [marked('top-t')])] }),
        ...flow([
          {
            type: 'container',
            id: 'wrap',
            children: [{ ...marked('deep'), typography: { bold: true } }],
          },
          { type: 'image', id: 'pic', src: TINY_PNG },
          literalText('plain', 'no marker here'),
          {
            type: 'table',
            id: 'grid',
            columns: [{ id: 'only', width: 1, align: 'start' }],
            header: [
              {
                type: 'tableRow',
                id: 'h',
                cells: [
                  {
                    columnId: 'only',
                    children: [{ ...marked('inhead'), typography: { italic: true } }],
                  },
                ],
              },
            ],
            body: [
              {
                type: 'tableRow',
                id: 'r',
                cells: [{ columnId: 'only', children: [literalText('rt', 'body')] }],
              },
            ],
            footer: [
              {
                type: 'tableRow',
                id: 'f',
                cells: [{ columnId: 'only', children: [marked('infoot')] }],
              },
            ],
          },
        ]),
      },
      {},
    );
    const signatures = [...markerSignatures(nested, PROBE_BOUNDS).keys()].sort();
    /* Plain, bold and italic: three typographies, and nothing from the image or the plain text. */
    expect(signatures).toHaveLength(3);
    expect(signatures.some((entry) => entry.includes('b n'))).toBe(true);
    expect(signatures.some((entry) => entry.includes('n i'))).toBe(true);
  });

  it('refuses a width for a shape the width probe never measured', () => {
    const stranger = shapeOf(reportRun(), {});
    expect(() => markerReserve(stranger.signatures, new Map()).widthOf(counterRun())).toThrow(
      expect.objectContaining({ code: 'layout-measurement-failed' }),
    );
  });

  it('multiplies the widest sample by how many of them a value is made of', () => {
    const counter = shapeOf(counterRun(), { repeat: 3 });
    const reserve = markerReserve(counter.signatures, new Map([[counter.key, 5]]));
    expect(reserve.widthOf(counterRun())).toBe(15);
  });

  it('sizes a canonical counter on its digits and a canonical report on the whole writing', () => {
    // A counter draws digits alone; a report may draw a sign, a point or an exponent, and none of
    // those is bounded by a digit. Sizing a report on the digit reserve is what clips it.
    const both = markerSignatures(
      multiPageOf({ page: gridPage(6, {}), ...flow([marked('rank'), reported('carried')]) }, {}),
      PROBE_BOUNDS,
    );
    const counter = [...both.values()].find((shape) => shape.repeat !== CANONICAL_NUMBER_MAX_CHARS);
    const report = [...both.values()].find((shape) => shape.repeat === CANONICAL_NUMBER_MAX_CHARS);

    expect(counter?.samples).toStrictEqual([...'0123456789']);
    expect(counter?.repeat).toBe(3);
    expect(report?.samples).toStrictEqual([...CANONICAL_NUMBER_ALPHABET]);
    expect(CANONICAL_NUMBER_ALPHABET).toBe('0123456789-+.e');
  });
});
