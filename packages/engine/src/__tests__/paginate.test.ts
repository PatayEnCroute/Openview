import { PaginationResultSchema, type RenderRequest, type Template } from '@openview/core';
import { describe, expect, it } from 'vitest';
import { DocumentRenderError } from '../errors.js';
import { createPaginationPort } from '../pipeline/paginate.js';
import { createPdfRenderPort } from '../pipeline/render-pdf.js';
import type {
  PdfLayoutMeasurement,
  PdfRenderResources,
  PdfRenderSession,
  PdfRenderStrategy,
} from '../strategy/pdf.js';
import {
  type FakeLayout,
  failingMeasureStrategy,
  failingStrategy,
  fakeStrategy,
} from './fake-session.js';
import { SAMPLE_DATA, TINY_PNG, templateOf, unvalidatableTemplate } from './fixtures.js';

const requestOf = (template: Template, data: RenderRequest['data'] = {}): RenderRequest => ({
  template,
  data,
});

const PAGE_MARKERS = [
  { kind: 'pageField', field: 'number' },
  { kind: 'literal', text: '/' },
  { kind: 'pageField', field: 'count' },
];

/** Three tall blocks on a small sheet, with a band on each side: the multi-page shape of E1. */
const threeTall = templateOf({
  page: {
    sheet: { width: 100, height: 100 },
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
    header: [
      {
        on: 'every',
        content: {
          type: 'container',
          id: 'top',
          children: [{ type: 'text', id: 'top-t', content: PAGE_MARKERS }],
        },
      },
    ],
    footer: [
      {
        on: 'lastOnly',
        content: {
          type: 'container',
          id: 'end',
          children: [{ type: 'text', id: 'end-t', content: PAGE_MARKERS }],
        },
      },
    ],
  },
  root: {
    type: 'container',
    id: 'root',
    children: ['a', 'b', 'c'].map((id) => ({
      type: 'text',
      id,
      content: [{ kind: 'literal', text: id }],
    })),
  },
});

/** Two hundred pixels for each of the three flow blocks, ten for everything else. */
const TALL: FakeLayout = {
  heightOf: (_tag, nodeId) => (['a', 'b', 'c'].includes(nodeId ?? '') ? 200 : 10),
};

/** A block asking to stay whole that no page can hold, so its mark always falls back. */
const oversizedMark = templateOf({
  page: {
    sheet: { width: 100, height: 100 },
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
    header: [],
    footer: [],
  },
  root: {
    type: 'container',
    id: 'root',
    children: [
      {
        type: 'text',
        id: 'big',
        keepTogether: true,
        content: [{ kind: 'literal', text: 'x'.repeat(200) }],
      },
    ],
  },
});

/** Eight visual lines of a hundred pixels each, which no sheet of this fixture can hold. */
const CUT_LINES: FakeLayout = {
  heightOf: (_tag, nodeId) => (nodeId === 'big' ? 800 : 10),
  linesOf: (nodeId) =>
    nodeId === 'big'
      ? Array.from({ length: 8 }, (_unused, index) => ({
          index,
          run: 0,
          offset: (index + 1) * 25,
          height: (index + 1) * 100,
        }))
      : [],
};

/** A strategy whose session refuses to close, to prove the refusal is not swallowed. */
function failingCloseStrategy(error: unknown): PdfRenderStrategy {
  const { strategy } = fakeStrategy();
  return {
    format: 'pdf',
    async open(resources: PdfRenderResources): Promise<PdfRenderSession> {
      const session = await strategy.open(resources);
      return {
        resolveImages: session.resolveImages.bind(session),
        measure: session.measure.bind(session),
        print: session.print.bind(session),
        close: (): Promise<void> => Promise.reject(error),
      };
    },
  };
}

/** A session that fails the moment printing is asked for, so a single call reddens the suite. */
function noPrintStrategy(layout: FakeLayout = {}): {
  readonly strategy: PdfRenderStrategy;
  readonly log: { readonly printed: unknown[]; closed: number };
} {
  const { strategy, log } = fakeStrategy(layout);
  return {
    log,
    strategy: {
      format: 'pdf',
      async open(resources: PdfRenderResources): Promise<PdfRenderSession> {
        const session = await strategy.open(resources);
        return {
          resolveImages: session.resolveImages.bind(session),
          measure: session.measure.bind(session),
          close: session.close.bind(session),
          print(): Promise<Uint8Array> {
            return Promise.reject(new Error('this session must never print'));
          },
        };
      },
    },
  };
}

describe('createPaginationPort', () => {
  it('answers a request of a template and a dataset, and nothing else', async () => {
    const result = await createPaginationPort(fakeStrategy().strategy).paginate(
      requestOf(templateOf()),
    );
    expect(Object.keys(result).sort()).toStrictEqual(['html', 'notices', 'pages', 'sheet']);
    expect(PaginationResultSchema.safeParse(result).success).toBe(true);
  });

  it('never prints, and closes the session exactly once', async () => {
    const { strategy, log } = noPrintStrategy(TALL);
    const result = await createPaginationPort(strategy).paginate(requestOf(threeTall));
    expect(result.pages).toHaveLength(3);
    expect(log.printed).toHaveLength(0);
    expect(log.closed).toBe(1);
  });

  it('returns the sheet the template declared', async () => {
    const result = await createPaginationPort(fakeStrategy().strategy).paginate(
      requestOf(
        templateOf({
          page: {
            sheet: { width: 123.45, height: 234.56 },
            margins: { top: 1, right: 2, bottom: 3, left: 4 },
            header: [],
            footer: [],
          },
        }),
      ),
    );
    expect(result.sheet).toStrictEqual({ width: 123.45, height: 234.56 });
  });

  it('returns the standalone html the printer would have been handed, byte for byte', async () => {
    const paginated = await createPaginationPort(fakeStrategy(TALL).strategy).paginate(
      requestOf(threeTall),
    );
    const { strategy, log } = fakeStrategy(TALL);
    await createPdfRenderPort(strategy).render(requestOf(threeTall));
    expect(paginated.html).toBe(log.printed[0]?.html);
    expect(paginated.pages).toHaveLength(3);
  });

  it('measures the same documents, in the same order, as the pdf path does', async () => {
    const { strategy: laid, log: layout } = fakeStrategy(TALL);
    await createPaginationPort(laid).paginate(requestOf(threeTall));
    const { strategy: printing, log: printed } = fakeStrategy(TALL);
    await createPdfRenderPort(printing).render(requestOf(threeTall));
    expect(layout.measured.map((one) => one.html)).toStrictEqual(
      printed.measured.map((one) => one.html),
    );
    expect(layout.printed).toHaveLength(0);
  });

  it('hands the session the declared sheet and the images before it measures anything', async () => {
    const { strategy, log } = fakeStrategy();
    await createPaginationPort(strategy).paginate(
      requestOf(
        templateOf({
          root: {
            type: 'container',
            id: 'root',
            children: [{ type: 'image', id: 'logo', src: TINY_PNG }],
          },
        }),
      ),
    );
    expect(log.opened).toHaveLength(1);
    expect(log.opened[0]?.images.map((image) => image.nodeId)).toStrictEqual(['logo']);
  });

  it('keeps the host dataset opaque and unmutated', async () => {
    const before = structuredClone(SAMPLE_DATA);
    await createPaginationPort(fakeStrategy().strategy).paginate(
      requestOf(
        templateOf({
          root: {
            type: 'container',
            id: 'root',
            children: [
              {
                type: 'text',
                id: 'who',
                content: [{ kind: 'binding', value: { kind: 'path', path: 'sample.label' } }],
              },
            ],
          },
        }),
        SAMPLE_DATA,
      ),
    );
    expect(SAMPLE_DATA).toStrictEqual(before);
  });
});

describe('what stops a pagination', () => {
  it('validates the template before it opens anything', async () => {
    const { strategy, log } = fakeStrategy();
    await expect(
      createPaginationPort(strategy).paginate(requestOf(unvalidatableTemplate())),
    ).rejects.toMatchObject({ code: 'template-refused' });
    expect(log.opened).toHaveLength(0);
  });

  it('names an unknown open failure a layout failure, not a pdf export it never reached', async () => {
    const boom = new Error('chromium said something with a total of 1200 in it');
    const caught: unknown = await createPaginationPort(failingStrategy(boom))
      .paginate(requestOf(templateOf()))
      .catch((error: unknown) => error);
    expect(caught).toBeInstanceOf(DocumentRenderError);
    if (caught instanceof DocumentRenderError) {
      expect(caught.code).toBe('layout-measurement-failed');
      expect(caught.message).not.toContain('1200');
      expect(caught.cause).toBe(boom);
    }
  });

  it('wraps an unknown measurement failure and still closes the session', async () => {
    const boom = new Error('the layout engine choked on 1200');
    const { strategy, log } = failingMeasureStrategy(boom);
    const caught: unknown = await createPaginationPort(strategy)
      .paginate(requestOf(templateOf()))
      .catch((error: unknown) => error);
    expect(caught).toBeInstanceOf(DocumentRenderError);
    if (caught instanceof DocumentRenderError) {
      expect(caught.code).toBe('layout-measurement-failed');
      expect(caught.message).not.toContain('1200');
    }
    expect(log.closed).toBe(1);
  });

  it('lets a refusal the session already named travel unchanged', async () => {
    const named = new DocumentRenderError('no room', 'page-band-overflow', { region: 'header' });
    const { strategy } = failingMeasureStrategy(named);
    await expect(createPaginationPort(strategy).paginate(requestOf(templateOf()))).rejects.toBe(
      named,
    );
  });

  it('returns no partial result when no sequence could be proved', async () => {
    const { strategy, log } = fakeStrategy({ ...TALL, overflowRounds: 99, regionContent: 100 });
    await expect(
      createPaginationPort(strategy).paginate(requestOf(threeTall)),
    ).rejects.toMatchObject({ code: 'pagination-impossible' });
    expect(log.printed).toHaveLength(0);
    expect(log.closed).toBe(1);
  });

  it('lets a close failure surface rather than swallowing it', async () => {
    const boom = new Error('the browser would not shut down');
    await expect(
      createPaginationPort(failingCloseStrategy(boom)).paginate(requestOf(templateOf())),
    ).rejects.toBe(boom);
  });

  it('applies the shape and evaluation bounds of the port, which are not request fields', async () => {
    await expect(
      createPaginationPort(fakeStrategy().strategy, { shapeLimits: { maxNodes: 4 } }).paginate(
        requestOf(templateOf()),
      ),
    ).rejects.toMatchObject({ code: 'template-refused' });
  });
});

describe('a settling round the engine abandoned', () => {
  const noticesFor = async (rounds: number): Promise<readonly string[]> => {
    const { strategy } = fakeStrategy({
      ...CUT_LINES,
      overflowRounds: rounds,
      regionContent: 100,
    });
    const result = await createPaginationPort(strategy).paginate(requestOf(oversizedMark));
    return result.notices.map((one) => `${one.occurrence.nodeId}:${one.pages.length}`);
  };

  it('leaves no notice of its own behind, however many rounds were refused', async () => {
    const settled = await noticesFor(0);
    expect(settled).toHaveLength(1);
    expect(settled[0]?.startsWith('big:')).toBe(true);
    /* One notice per OCCURRENCE, derived from the accepted sequence. An accumulator shared across
       the settling rounds would report the same mark once per refused round. */
    expect(await noticesFor(1)).toHaveLength(1);
    expect(await noticesFor(2)).toHaveLength(1);
  });

  it('reports the pages of the sequence that was accepted, not of an earlier attempt', async () => {
    const { strategy, log } = fakeStrategy({
      ...CUT_LINES,
      overflowRounds: 1,
      regionContent: 100,
    });
    const result = await createPaginationPort(strategy).paginate(requestOf(oversizedMark));
    const [notice] = result.notices;
    expect(notice?.pages).toStrictEqual(result.pages.map((page) => page.number));
    /* The html measured last is the html returned, so the notice describes that same sequence. */
    expect(result.html).toBe(log.measured.at(-1)?.html);
  });
});

describe('a session that reports nothing measurable', () => {
  it('refuses rather than compose from an empty answer', async () => {
    const silent: PdfRenderStrategy = {
      format: 'pdf',
      open(): Promise<PdfRenderSession> {
        return Promise.resolve({
          resolveImages(): Promise<never[]> {
            return Promise.resolve([]);
          },
          measure(): Promise<PdfLayoutMeasurement> {
            return Promise.resolve({
              pages: [],
              boxes: [],
              lines: [],
              images: [],
              escaping: [],
              overflowingGridItems: [],
              clippedMarkerCount: 0,
            });
          },
          print(): Promise<Uint8Array> {
            return Promise.reject(new Error('this session must never print'));
          },
          close(): Promise<void> {
            return Promise.resolve();
          },
        });
      },
    };
    await expect(
      createPaginationPort(silent).paginate(requestOf(threeTall)),
    ).rejects.toBeInstanceOf(DocumentRenderError);
  });
});
