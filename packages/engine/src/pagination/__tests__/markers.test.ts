import {
  type EvaluationScope,
  formatDecimal,
  formatMoney,
  type PresentationTable,
  roundDecimal,
} from '@openview/core';
import { describe, expect, it } from 'vitest';
import { gridPage, materializedOf, multiPageOf, paginateOnGrid } from '../../__tests__/fixtures.js';
import { createPresentationSession, type MarkerWriting } from '../../document/presentation.js';
import type {
  MaterialDocument,
  MaterialPageFieldRun,
  MaterialText,
  ResolvedTypography,
} from '../../document/types.js';
import { buildFragment, type PageValues } from '../../html/build.js';
import { serializeHtml } from '../../html/serialize.js';
import {
  CANONICAL_NUMBER_MAX_CHARS,
  type MarkerBounds,
  markerReserve,
  markerSignature,
  markerSignatures,
} from '../markers.js';
import { reportMagnitudeBound } from '../reports.js';
import type { MarkerReserve } from '../types.js';
import { wholeFragment } from '../whole.js';

/** Narrow no-break space and no-break space: what a French writing puts around its figures. */
const NARROW_NO_BREAK = ' ';
const NO_BREAK = ' ';

const WRITINGS: PresentationTable = {
  'fr-eur-2': {
    locale: 'fr-FR',
    currency: 'EUR',
    minFractionDigits: 2,
    maxFractionDigits: 2,
    dateStyle: 'long',
  },
  'en-usd-2': {
    locale: 'en-US',
    currency: 'USD',
    minFractionDigits: 2,
    maxFractionDigits: 2,
    dateStyle: 'medium',
  },
  'fr-zzz-2': {
    locale: 'fr-FR',
    currency: 'ZZZ',
    minFractionDigits: 2,
    maxFractionDigits: 2,
    dateStyle: 'long',
  },
  'fr-whole': {
    locale: 'fr-FR',
    currency: 'EUR',
    minFractionDigits: 0,
    maxFractionDigits: 0,
    dateStyle: 'short',
  },
  'fr-decimal-4': {
    locale: 'fr-FR',
    currency: 'EUR',
    minFractionDigits: 0,
    maxFractionDigits: 4,
    dateStyle: 'short',
  },
};

const TYPOGRAPHY: ResolvedTypography = {
  family: 'sans-serif',
  sizePt: 10,
  bold: false,
  italic: false,
  color: '#000000',
};

/** One resolved writing, taken through the real session so nothing here assembles one. */
function markerAt(key: string, kind: 'money' | 'decimal', id = 'w1'): MarkerWriting {
  const session = createPresentationSession(WRITINGS, { probe: key });
  const found = session.resolve({ kind, profile: 'probe' }, {});
  return { presentation: found.presentation, id, kind };
}

const counterRun = (writing?: MarkerWriting): MaterialPageFieldRun => ({
  kind: 'pageField',
  field: 'number',
  typography: TYPOGRAPHY,
  ...(writing === undefined ? {} : { writing }),
});

const reportRun = (
  writing?: MarkerWriting,
  decimals = 2,
  mode: 'halfEven' | 'halfExpand' = 'halfEven',
): MaterialPageFieldRun => ({
  kind: 'pageField',
  field: 'report',
  decimals,
  mode,
  typography: TYPOGRAPHY,
  ...(writing === undefined ? {} : { writing }),
});

const textOf = (runs: readonly MaterialPageFieldRun[]): MaterialText => ({
  kind: 'text',
  key: 'o1',
  nodeId: 'markers',
  path: [],
  box: undefined,
  keepTogether: false,
  align: 'start',
  runs,
});

/** A document made of one text block of markers, so a shape can be collected from a real walk. */
function documentOf(runs: readonly MaterialPageFieldRun[]): MaterialDocument {
  const bare = materializedOf({ root: { type: 'container', id: 'root', children: [] } }, {});
  return { ...bare, root: [textOf(runs)] };
}

/** The samples of one run's shape, as the width probe would put them in boxes. */
function samplesOf(run: MaterialPageFieldRun, bounds: MarkerBounds): readonly string[] {
  const shape = markerSignatures(documentOf([run]), bounds).get(markerSignature(run));
  if (shape === undefined) {
    throw new Error('a marker of the document should have a shape');
  }
  return shape.samples;
}

/** A reserve over the real shapes, with one measured width per sample box. */
function reserveOf(
  document: MaterialDocument,
  bounds: MarkerBounds,
  width = 6,
): { readonly reserve: MarkerReserve; readonly shapes: number } {
  const signatures = markerSignatures(document, bounds);
  const widest = new Map([...signatures.keys()].map((key) => [key, width]));
  return { reserve: markerReserve(signatures, widest), shapes: signatures.size };
}

/** The characters one marker prints, for one page's values or for a probe. */
function printed(
  run: MaterialPageFieldRun,
  page: PageValues | undefined,
  bounds: MarkerBounds,
): string {
  const document = documentOf([run]);
  const { reserve } = reserveOf(document, bounds);
  const html = serializeHtml({
    css: '',
    body: [buildFragment(wholeFragment(textOf([run])), { markers: reserve, page, keyed: false })],
  });
  const found = /class="ov-marker"[^>]*>([^<]*)</.exec(html);
  if (found?.[1] === undefined) {
    throw new Error('the fragment should paint one marker');
  }
  return found[1];
}

const PAGES: MarkerBounds = { pages: 100, report: 0 };

describe('the strings a written marker can hold', () => {
  const EUR = markerAt('fr-eur-2', 'money');

  it('holds the currency symbol and the spaces ICU really emits', () => {
    // Not an alphabet someone imagined: the envelope is produced by the same formatter as the
    // print, so the narrow group separator and the no-break space before the symbol are measured.
    const samples = samplesOf(reportRun(EUR), { pages: 4, report: 12_345.67 });
    const joined = samples.join(' ');

    expect(joined).toContain('€');
    expect(joined).toContain(NARROW_NO_BREAK);
    expect(joined).toContain(NO_BREAK);
    expect(samples).toContain(formatMoney(0, EUR.presentation));
  });

  it('holds both signs of the magnitude a report can reach', () => {
    const samples = samplesOf(reportRun(EUR), { pages: 4, report: 900 });

    expect(samples).toContain(formatMoney(900, EUR.presentation));
    expect(samples).toContain(formatMoney(-900, EUR.presentation));
    expect(samples.some((sample) => sample.startsWith('-'))).toBe(true);
  });

  it('reaches one integer digit past the magnitude, because rounding carries', () => {
    // A bound of 999.99 rounded at no decimals writes the four digits of 1000: an envelope stopping
    // at the magnitude's own digit count would reserve one digit too few.
    const whole = markerAt('fr-whole', 'decimal');
    const samples = samplesOf(reportRun(whole, 0), { pages: 4, report: 999.99 });

    expect(samples).toContain(formatDecimal(9999, whole.presentation));
    expect(samples).toContain(formatDecimal(-9999, whole.presentation));
  });

  it('reaches the deepest fraction the writing allows, at every digit', () => {
    const four = markerAt('fr-decimal-4', 'decimal');
    const samples = samplesOf(reportRun(four, 4), { pages: 4, report: 12 });

    expect(samples).toContain(formatDecimal(999.9999, four.presentation));
    expect(samples).toContain(formatDecimal(-888.8888, four.presentation));
  });

  it('holds a run of every digit up to the highest rank a counter can reach', () => {
    // A run of one digit is the widest number of its length, and where a locale inserts a group
    // separator depends on the length alone -- so the longest run bounds every shorter value.
    const rank = markerAt('fr-decimal-4', 'decimal');
    const samples = samplesOf(counterRun(rank), { pages: 1000, report: 0 });

    expect(samples).toContain(formatDecimal(8888, rank.presentation));
    expect(samples).toContain(formatDecimal(0, rank.presentation));
    /* And no sign: a page rank is never negative, so reserving room for one would be waste. */
    expect(samples.some((sample) => sample.startsWith('-'))).toBe(false);
  });

  it('prints an unknown but well-formed currency as itself in the envelope too', () => {
    const exotic = markerAt('fr-zzz-2', 'money');
    const samples = samplesOf(reportRun(exotic), { pages: 4, report: 100 });

    expect(samples.join(' ')).toContain('ZZZ');
    expect(samples.join(' ')).not.toContain('€');
  });

  it('keeps a saturated magnitude bounded, and asks for a very wide reserve rather than none', () => {
    const samples = samplesOf(reportRun(EUR), { pages: 4, report: Number.MAX_VALUE });
    const widest = samples.reduce((left, right) => (right.length > left.length ? right : left), '');

    /* The values that overflow a double are dropped rather than written as `Infinity`, and what is
       left is still a very long figure -- which a page cannot hold, so the render is refused. */
    expect(samples.every((sample) => !sample.includes('∞'))).toBe(true);
    expect(widest.length).toBeGreaterThan(300);
  });
});

describe('the shapes a document reserves for', () => {
  it('gives two currencies two shapes, and never one shared bound', () => {
    const { shapes } = reserveOf(
      documentOf([
        reportRun(markerAt('fr-eur-2', 'money', 'w1')),
        reportRun(markerAt('en-usd-2', 'money', 'w2')),
      ]),
      { pages: 4, report: 100 },
    );

    expect(shapes).toBe(2);
  });

  it('gives a written marker and a canonical one two shapes', () => {
    const { shapes } = reserveOf(
      documentOf([counterRun(), counterRun(markerAt('fr-decimal-4', 'decimal'))]),
      PAGES,
    );

    expect(shapes).toBe(2);
  });

  it('names no writing key and no profile in the key it files a shape under', () => {
    // A signature travels into a diagnostic. The writing enters it as the opaque id the session
    // handed out, so nothing the caller named can be read back out of it.
    const key = markerSignature(reportRun(markerAt('fr-eur-2', 'money')));

    expect(key).not.toContain('fr-eur-2');
    expect(key).not.toContain('probe');
  });

  it('multiplies only on the canonical path, and measures the whole value otherwise', () => {
    const canonical = markerSignatures(documentOf([reportRun()]), PAGES);
    const written = markerSignatures(documentOf([reportRun(markerAt('fr-eur-2', 'money'))]), {
      pages: 4,
      report: 100,
    });

    expect([...canonical.values()][0]?.repeat).toBe(CANONICAL_NUMBER_MAX_CHARS);
    expect([...written.values()][0]?.repeat).toBe(1);
  });

  it('shows a probe one of the strings the reserve was measured from', () => {
    // A placeholder wider than the reserve would measure a line the print never has, so it is one
    // of the samples by construction rather than a string of zeros of a guessed length.
    const bounds = { pages: 4, report: 100 };
    const run = reportRun(markerAt('fr-eur-2', 'money'));

    expect(samplesOf(run, bounds)).toContain(printed(run, undefined, bounds));
  });

  it('refuses a width for a shape the probe never answered for', () => {
    const signatures = markerSignatures(documentOf([counterRun()]), PAGES);

    expect(() => markerReserve(signatures, new Map()).widthOf(counterRun())).toThrow(
      expect.objectContaining({ code: 'layout-measurement-failed' }),
    );
  });
});

describe('what a written marker prints once the cuts are chosen', () => {
  const bounds = { pages: 100, report: 1000 };

  it('writes a page rank and a page total in the writing its site declared', () => {
    const rank = markerAt('fr-decimal-4', 'decimal');
    const page: PageValues = { number: 9, count: 10, report: 0 };

    expect(printed(counterRun(rank), page, bounds)).toBe(formatDecimal(9, rank.presentation));
    expect(printed({ ...counterRun(rank), field: 'count' }, page, bounds)).toBe(
      formatDecimal(10, rank.presentation),
    );
  });

  it('keeps a marker with no writing on the canonical form', () => {
    const page: PageValues = { number: 9, count: 10, report: 2.5 };

    expect(printed(counterRun(), page, bounds)).toBe('9');
    expect(printed(reportRun(undefined, 0, 'halfEven'), page, bounds)).toBe('2');
  });

  it.each([
    ['halfEven', 2],
    ['halfExpand', 3],
  ] as const)('rounds a report the declared way, %s, BEFORE writing it', (mode, expected) => {
    // The order is the whole guarantee: handed 2.5 directly, `Intl` applies its own half-expand
    // default and prints 3 whatever the model declared.
    const whole = markerAt('fr-whole', 'decimal');
    const page: PageValues = { number: 2, count: 3, report: 2.5 };

    expect(printed(reportRun(whole, 0, mode), page, bounds)).toBe(
      formatDecimal(expected, whole.presentation),
    );
  });

  it('writes a report rounded to hundreds with no fraction at all', () => {
    const whole = markerAt('fr-whole', 'decimal');
    const page: PageValues = { number: 2, count: 3, report: 1250 };

    expect(printed(reportRun(whole, -2, 'halfEven'), page, bounds)).toBe(
      formatDecimal(roundDecimal(1250, -2, 'halfEven'), whole.presentation),
    );
  });

  it('writes an amount with its symbol and its separators unchanged', () => {
    const eur = markerAt('fr-eur-2', 'money');
    const page: PageValues = { number: 2, count: 3, report: 1234.5 };

    const written = printed(reportRun(eur, 2, 'halfEven'), page, bounds);

    expect(written).toBe(formatMoney(1234.5, eur.presentation));
    expect(written).toContain(NARROW_NO_BREAK);
    expect(written).toContain(NO_BREAK);
  });
});

describe('the magnitude a page report can reach', () => {
  const path = (value: string) => ({ kind: 'path', path: value });
  const COLUMNS = [{ id: 'amount', width: 1, align: 'end' }];

  const cell = (id: string, content: readonly unknown[]) => ({
    columnId: 'amount',
    children: [{ type: 'text', id, content }],
  });

  const ledger = (overrides: Record<string, unknown> = {}) => ({
    type: 'table',
    id: 'ledger',
    columns: COLUMNS,
    header: [
      { type: 'tableRow', id: 'head', cells: [cell('h', [{ kind: 'literal', text: 'A' }])] },
    ],
    body: [
      {
        type: 'tableRowGroup',
        id: 'entries',
        each: path('ledger.entries'),
        as: 'entry',
        rows: [
          {
            type: 'tableRow',
            id: 'entry-row',
            pageReport: { value: path('entry.amount') },
            cells: [cell('entry-amount', [{ kind: 'binding', value: path('entry.amount') }])],
          },
        ],
        ...overrides,
      },
    ],
    footer: [],
  });

  const ledgerOf = (...amounts: readonly number[]): EvaluationScope => ({
    ledger: { entries: amounts.map((amount) => ({ amount })) },
  });

  const boundOf = (...amounts: readonly number[]) =>
    reportMagnitudeBound(
      materializedOf(
        { page: gridPage(4), root: { type: 'container', id: 'root', children: [ledger()] } },
        ledgerOf(...amounts),
      ),
    );

  it('adds the absolute values, so cancellations cannot lower it', () => {
    // A page carries forward SOME subset of what finished before it. Summing the signed values
    // would let +100 and -100 bound a page that carries only the +100.
    expect(boundOf(100, -100)).toBe(200);
    expect(boundOf(-3, -4)).toBe(7);
    expect(boundOf()).toBe(0);
  });

  it('bounds the report of every page a real cut produces', () => {
    // P5, on the cuts the fixtures really make rather than on one hand-picked page.
    const document = materializedOf(
      { page: gridPage(4), root: { type: 'container', id: 'root', children: [ledger()] } },
      ledgerOf(12.5, -40, 7.25, 900, -1000, 0.5),
    );
    const bound = reportMagnitudeBound(document);
    const paginated = paginateOnGrid(document);

    expect(paginated.pages.length).toBeGreaterThan(1);
    for (const page of paginated.pages) {
      expect(Math.abs(page.incomingReport)).toBeLessThanOrEqual(bound);
    }
  });

  it('counts a contribution nested inside another table, once', () => {
    const nested = materializedOf(
      {
        page: gridPage(8),
        root: {
          type: 'container',
          id: 'root',
          children: [
            {
              type: 'table',
              id: 'outer',
              columns: COLUMNS,
              header: [],
              body: [
                {
                  type: 'tableRow',
                  id: 'holder',
                  cells: [{ columnId: 'amount', children: [ledger()] }],
                },
              ],
              footer: [],
            },
          ],
        },
      },
      ledgerOf(5, -6),
    );

    expect(reportMagnitudeBound(nested)).toBe(11);
  });

  it('saturates rather than answer a bound that is not a number', () => {
    // Two halves of the double range add to infinity. The bound only ever grows, so saturating
    // asks for an absurd reserve -- which a page cannot hold -- and never crops a figure.
    expect(boundOf(Number.MAX_VALUE, Number.MAX_VALUE)).toBe(Number.MAX_VALUE);
  });

  it('reads the flow alone, since a band may declare no contribution', () => {
    const banded = multiPageOf(
      {
        page: {
          sheet: { width: 210, height: 297 },
          margins: { top: 10, right: 10, bottom: 10, left: 10 },
          header: [],
          footer: [
            {
              on: 'exceptFirst',
              content: {
                type: 'container',
                id: 'foot',
                children: [
                  {
                    type: 'text',
                    id: 'carried',
                    content: [
                      { kind: 'pageField', field: 'report', decimals: 2, mode: 'halfEven' },
                    ],
                  },
                ],
              },
            },
          ],
        },
        root: { type: 'container', id: 'root', children: [ledger()] },
      },
      ledgerOf(4, 6),
    );

    expect(reportMagnitudeBound(banded)).toBe(10);
  });
});
