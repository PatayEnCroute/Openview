import type { Sheet } from '@openview/core';
import { describe, expect, it } from 'vitest';
import { fillFlow } from '../pagination/flow.js';
import { FLOW_START, type Metrics, type PaginatedDocument } from '../pagination/types.js';
import { validateMeasurement } from '../pagination/validate-measurement.js';
import { verifyLayout } from '../pagination/verify.js';
import type { PdfLayoutMeasurement } from '../strategy/pdf.js';
import { PX_PER_MM } from './fake-session.js';
import {
  constantMarkers,
  gridPage,
  literalText,
  materializedOf,
  paginateOnGrid,
  refusalOfCut,
} from './fixtures.js';
import { gridMetrics } from './metrics.js';

const SHEET: Sheet = { width: 100, height: 100 };

const box = (width: number, height: number) => ({ width, height });

function reply(overrides: Partial<PdfLayoutMeasurement> = {}): PdfLayoutMeasurement {
  return {
    pages: [
      {
        page: box(SHEET.width * PX_PER_MM, SHEET.height * PX_PER_MM),
        printable: box(SHEET.width * PX_PER_MM, SHEET.height * PX_PER_MM),
        regions: (['header', 'root', 'footer'] as const).map((region) => ({
          region,
          height: 10,
          contentHeight: 10,
        })),
      },
    ],
    boxes: [{ key: 'a', width: 5, height: 20 }],
    lines: [],
    images: [],
    escaping: [],
    clippedMarkerCount: 0,
    ...overrides,
  };
}

const ASKED = new Set(['a']);

const refusalFrom = (run: () => unknown) => refusalOfCut(run);

describe('a session reply the algorithm may read', () => {
  it('answers a height and no line for a box that holds no run', () => {
    const metrics = validateMeasurement(reply(), ASKED, SHEET);
    expect(metrics.height('a')).toBe(20);
    expect(metrics.lines('a')).toStrictEqual([]);
    expect(metrics.pxPerMm).toBeCloseTo(PX_PER_MM, 9);
  });

  it('keeps the visual lines of a block in the order they were reported', () => {
    const metrics = validateMeasurement(
      reply({
        lines: [
          { key: 'a', index: 0, run: 0, offset: 4, height: 10 },
          { key: 'a', index: 1, run: 1, offset: 2, height: 20 },
        ],
      }),
      ASKED,
      SHEET,
    );
    expect(metrics.lines('a')).toStrictEqual([
      { run: 0, offset: 4, height: 10 },
      { run: 1, offset: 2, height: 20 },
    ]);
  });
});

describe('a session reply the algorithm refuses', () => {
  const refused = (overrides: Partial<PdfLayoutMeasurement>, asked = ASKED) =>
    refusalFrom(() => validateMeasurement(reply(overrides), asked, SHEET));

  it.each([
    ['no page at all', { pages: [] }],
    ['a height that is not a number', { boxes: [{ key: 'a', width: 1, height: Number.NaN }] }],
    [
      'a height that is infinite',
      { boxes: [{ key: 'a', width: 1, height: Number.POSITIVE_INFINITY }] },
    ],
    ['a negative height', { boxes: [{ key: 'a', width: 1, height: -1 }] }],
    ['a negative width', { boxes: [{ key: 'a', width: -1, height: 1 }] }],
    ['a box nobody asked about', { boxes: [{ key: 'ghost', width: 1, height: 1 }] }],
    [
      'the same box twice',
      {
        boxes: [
          { key: 'a', width: 1, height: 1 },
          { key: 'a', width: 1, height: 2 },
        ],
      },
    ],
    ['fewer boxes than were asked for', { boxes: [] }],
    ['a negative count of clipped markers', { clippedMarkerCount: -1 }],
    ['a fractional count of clipped markers', { clippedMarkerCount: 0.5 }],
    ['a count of clipped markers that is not finite', { clippedMarkerCount: Number.NaN }],
    [
      'a line of a box nobody asked about',
      { lines: [{ key: 'g', index: 0, run: 0, offset: 1, height: 1 }] },
    ],
    [
      'a line of no finite height',
      { lines: [{ key: 'a', index: 0, run: 0, offset: 1, height: Number.NaN }] },
    ],
    [
      'a run that is not a whole number',
      { lines: [{ key: 'a', index: 0, run: 1.5, offset: 1, height: 1 }] },
    ],
    ['a negative offset', { lines: [{ key: 'a', index: 0, run: 0, offset: -1, height: 1 }] }],
    [
      'a line rank that skips one',
      { lines: [{ key: 'a', index: 3, run: 0, offset: 1, height: 1 }] },
    ],
    [
      'a cursor that goes back a run',
      {
        lines: [
          { key: 'a', index: 0, run: 2, offset: 1, height: 10 },
          { key: 'a', index: 1, run: 1, offset: 9, height: 20 },
        ],
      },
    ],
    [
      'a cursor that goes back inside a run',
      {
        lines: [
          { key: 'a', index: 0, run: 0, offset: 9, height: 10 },
          { key: 'a', index: 1, run: 0, offset: 4, height: 20 },
        ],
      },
    ],
    [
      'a line that climbs back up the block',
      {
        lines: [
          { key: 'a', index: 0, run: 0, offset: 1, height: 20 },
          { key: 'a', index: 1, run: 0, offset: 2, height: 5 },
        ],
      },
    ],
    [
      'a page of negative height',
      { pages: [{ page: box(1, -1), printable: box(1, 1), regions: [] }] },
    ],
    [
      'a region of no finite height',
      {
        pages: [
          {
            page: box(1, 1),
            printable: box(1, 1),
            regions: [{ region: 'root' as const, height: Number.NaN, contentHeight: 0 }],
          },
        ],
      },
    ],
    [
      'a sheet of no width at all',
      { pages: [{ page: box(0, 1), printable: box(1, 1), regions: [] }] },
    ],
  ])('refuses %s', (_label, overrides) => {
    expect(refused(overrides).code).toBe('layout-measurement-failed');
  });

  it('refuses to answer for a box it was never given', () => {
    const metrics = validateMeasurement(reply(), ASKED, SHEET);
    expect(() => metrics.height('ghost')).toThrow(
      expect.objectContaining({ code: 'layout-measurement-failed' }),
    );
  });
});

describe('the final check before anything is printed', () => {
  /** One grid line a page and two lines of text: a sequence of two sheets to check. */
  const paginated = (): PaginatedDocument =>
    paginateOnGrid(
      materializedOf({ page: gridPage(1), ...literalFlow() }, {}),
      {},
      constantMarkers(),
    );

  const literalFlow = () => ({
    root: { type: 'container', id: 'root', children: [literalText('a', 'x'.repeat(40))] },
  });

  const laidOut = (
    document: PaginatedDocument,
    overrides: Partial<PdfLayoutMeasurement> = {},
  ): PdfLayoutMeasurement => ({
    boxes: [],
    lines: [],
    images: [],
    escaping: [],
    clippedMarkerCount: 0,
    pages: document.pages.map(() => ({
      page: box(document.sheet.width * PX_PER_MM, document.sheet.height * PX_PER_MM),
      printable: box(document.printable.width * PX_PER_MM, document.printable.height * PX_PER_MM),
      regions: (['header', 'root', 'footer'] as const).map((region) => ({
        region,
        height: 20,
        contentHeight: 20,
      })),
    })),
    ...overrides,
  });

  it('accepts a sequence the browser laid out exactly as it was composed', () => {
    const document = paginated();
    expect(verifyLayout(document, laidOut(document), PX_PER_MM)).toBeUndefined();
  });

  it('refuses a sequence with a different number of sheets', () => {
    const document = paginated();
    const short = { ...laidOut(document), pages: laidOut(document).pages.slice(1) };
    expect(refusalFrom(() => verifyLayout(document, short, PX_PER_MM)).code).toBe(
      'layout-measurement-failed',
    );
  });

  it('refuses a sheet that is not the declared one', () => {
    const document = paginated();
    const measurement = laidOut(document);
    const [first, ...rest] = measurement.pages;
    if (first === undefined) {
      throw new Error('the fixture holds no page');
    }
    const wrong = {
      ...measurement,
      pages: [{ ...first, page: box(first.page.width + 5, first.page.height) }, ...rest],
    };
    const refusal = refusalFrom(() => verifyLayout(document, wrong, PX_PER_MM));
    expect(refusal.code).toBe('layout-measurement-failed');
    expect(refusal.details.pageNumber).toBe(1);
  });

  it('refuses a printable area that is not the declared one', () => {
    const document = paginated();
    const measurement = laidOut(document);
    const [first, ...rest] = measurement.pages;
    if (first === undefined) {
      throw new Error('the fixture holds no page');
    }
    const wrong = {
      ...measurement,
      pages: [
        { ...first, printable: box(first.printable.width, first.printable.height + 5) },
        ...rest,
      ],
    };
    expect(refusalFrom(() => verifyLayout(document, wrong, PX_PER_MM)).code).toBe(
      'layout-measurement-failed',
    );
  });

  it('refuses an image that did not decode rather than printing a blank', () => {
    const document = paginated();
    const broken = laidOut(document, {
      images: [
        {
          nodeId: 'logo',
          decoded: false,
          naturalWidth: 0,
          naturalHeight: 0,
          renderedWidth: 0,
          renderedHeight: 0,
        },
      ],
    });
    const refusal = refusalFrom(() => verifyLayout(document, broken, PX_PER_MM));
    expect(refusal.code).toBe('image-load-failed');
    expect(refusal.details.nodeId).toBe('logo');
  });

  it('accepts an image that decoded', () => {
    const document = paginated();
    const fine = laidOut(document, {
      images: [
        {
          nodeId: 'logo',
          decoded: true,
          naturalWidth: 4,
          naturalHeight: 2,
          renderedWidth: 40,
          renderedHeight: 20,
        },
      ],
    });
    expect(verifyLayout(document, fine, PX_PER_MM)).toBeUndefined();
  });

  it('refuses a block that painted outside its sheet', () => {
    const document = paginated();
    const escaped = laidOut(document, { escaping: ['wide'] });
    const refusal = refusalFrom(() => verifyLayout(document, escaped, PX_PER_MM));
    expect(refusal.code).toBe('layout-measurement-failed');
    expect(refusal.details.nodeId).toBe('wide');
  });

  it('refuses a page marker that holds more than the width reserved for it', () => {
    // The reserve clips rather than reflows, so a marker one character too narrow is invisible in
    // every other check: without this count a truncated figure prints with the suite still green.
    const document = paginated();
    const clipped = laidOut(document, { clippedMarkerCount: 2 });
    const refusal = refusalFrom(() => verifyLayout(document, clipped, PX_PER_MM));
    expect(refusal.code).toBe('layout-measurement-failed');
    expect(refusal.details.limit).toBe(2);
    expect(refusal.message).toContain('truncated');
  });

  it('accepts the sequence when no marker is clipped', () => {
    const document = paginated();
    expect(verifyLayout(document, laidOut(document), PX_PER_MM)).toBeUndefined();
  });

  it('refuses a band that reached past the height reserved for it', () => {
    const document = paginated();
    const measurement = laidOut(document);
    const [first, ...rest] = measurement.pages;
    if (first === undefined) {
      throw new Error('the fixture holds no page');
    }
    const over = {
      ...measurement,
      pages: [
        {
          ...first,
          regions: first.regions.map((region) =>
            region.region === 'footer' ? { ...region, contentHeight: region.height + 4 } : region,
          ),
        },
        ...rest,
      ],
    };
    const refusal = refusalFrom(() => verifyLayout(document, over, PX_PER_MM));
    expect(refusal.code).toBe('page-band-overflow');
    expect(refusal.details.region).toBe('footer');
    expect(refusal.details.pageNumber).toBe(1);
  });

  it('reports the worst flow overflow rather than refusing, so the cut can be taken again', () => {
    const document = paginated();
    const measurement = laidOut(document);
    const over = {
      ...measurement,
      pages: measurement.pages.map((page, index) => ({
        ...page,
        regions: page.regions.map((region) =>
          region.region === 'root'
            ? { ...region, contentHeight: region.height + (index === 1 ? 9 : 3) }
            : region,
        ),
      })),
    };
    expect(verifyLayout(document, over, PX_PER_MM)).toStrictEqual({ pageNumber: 2, excess: 9 });
  });
});

describe('a cursor that does not match the block it points at', () => {
  const metricsOf = () => {
    const document = materializedOf(
      {
        page: gridPage(4),
        root: {
          type: 'container',
          id: 'root',
          children: [
            literalText('t', 'x'.repeat(40)),
            { type: 'container', id: 'c', children: [literalText('inner', 'y')] },
            {
              type: 'table',
              id: 'grid',
              columns: [{ id: 'only', width: 1, align: 'start' }],
              header: [],
              body: [
                {
                  type: 'tableRow',
                  id: 'r',
                  cells: [{ columnId: 'only', children: [literalText('cellt', 'z')] }],
                },
              ],
              footer: [],
            },
          ],
        },
      },
      {},
    );
    const [container] = document.root;
    if (container?.kind !== 'container') {
      throw new Error('the fixture does not hold a container');
    }
    return { blocks: container.children, metrics: gridMetrics(document) as Metrics };
  };

  it.each([
    ['a text', 0, { kind: 'container' as const, flow: FLOW_START }],
    ['a container', 1, { kind: 'text' as const, line: 0 }],
    ['a table', 2, { kind: 'text' as const, line: 0 }],
  ])('is refused rather than restarted for %s', (_label, index, inner) => {
    const { blocks, metrics } = metricsOf();
    const refusal = refusalFrom(() => fillFlow(blocks, { index, inner }, 1000, 1000, metrics));
    expect(refusal.code).toBe('pagination-impossible');
  });
});
