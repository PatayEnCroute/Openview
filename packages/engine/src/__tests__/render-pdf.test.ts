import type { RenderRequest, Template } from '@openview/core';
import { describe, expect, it } from 'vitest';
import { DocumentRenderError } from '../errors.js';
import { createPdfRenderPort, PDF_CONTENT_TYPE } from '../pipeline/render-pdf.js';
import {
  FAKE_PDF_BYTES,
  type FakeLayout,
  failingMeasureStrategy,
  failingPrintStrategy,
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

const labelText = templateOf({
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
});

describe('createPdfRenderPort', () => {
  it('announces the pdf format on the port itself', () => {
    expect(createPdfRenderPort(fakeStrategy().strategy).format).toBe('pdf');
  });

  it('returns the session bytes with the pdf format and media type', async () => {
    const port = createPdfRenderPort(fakeStrategy().strategy);
    const result = await port.render(requestOf(templateOf()));
    expect(result).toStrictEqual({
      format: 'pdf',
      bytes: FAKE_PDF_BYTES,
      contentType: PDF_CONTENT_TYPE,
    });
    expect(PDF_CONTENT_TYPE).toBe('application/pdf');
  });

  it('opens one session, prints once through it, and closes it', async () => {
    const { strategy, log } = fakeStrategy();
    await createPdfRenderPort(strategy).render(requestOf(templateOf()));
    expect(log.opened).toHaveLength(1);
    expect(log.printed).toHaveLength(1);
    expect(log.closed).toBe(1);
  });

  it('hands the session the declared sheet and the images before it measures anything', async () => {
    const { strategy, log } = fakeStrategy();
    await createPdfRenderPort(strategy).render(
      requestOf(
        templateOf({
          page: {
            sheet: { width: 123.45, height: 234.56 },
            margins: { top: 1, right: 2, bottom: 3, left: 4 },
            header: [],
            footer: [],
          },
          root: {
            type: 'container',
            id: 'root',
            children: [{ type: 'image', id: 'logo', src: TINY_PNG }],
          },
        }),
      ),
    );
    const [opened] = log.opened;
    expect(opened?.sheet).toStrictEqual({ width: 123.45, height: 234.56 });
    expect(opened?.images.map((image) => image.nodeId)).toStrictEqual(['logo']);
    const [printed] = log.printed;
    expect(printed?.html.startsWith('<!doctype html>')).toBe(true);
    expect(printed?.html).toContain('@page{size:123.45mm 234.56mm;margin:0}');
  });

  it('measures before it prints, and prints exactly what it last measured', async () => {
    const { strategy, log } = fakeStrategy();
    await createPdfRenderPort(strategy).render(requestOf(templateOf()));
    expect(log.measured.length).toBeGreaterThan(0);
    expect(log.printed[0]?.html).toBe(log.measured.at(-1)?.html);
  });

  it('validates the template even when the static type already announced one', async () => {
    const { strategy, log } = fakeStrategy();
    await expect(
      createPdfRenderPort(strategy).render(requestOf(unvalidatableTemplate())),
    ).rejects.toMatchObject({ code: 'template-refused' });
    expect(log.opened).toHaveLength(0);
  });

  it('never opens a session when a binding refuses', async () => {
    const { strategy, log } = fakeStrategy();
    await expect(
      createPdfRenderPort(strategy).render(requestOf(labelText, {})),
    ).rejects.toMatchObject({ code: 'missing-binding-value' });
    expect(log.opened).toHaveLength(0);
  });

  it('keeps the host dataset opaque and unmutated', async () => {
    const port = createPdfRenderPort(fakeStrategy().strategy);
    const before = structuredClone(SAMPLE_DATA);
    await port.render(requestOf(labelText, SAMPLE_DATA));
    expect(SAMPLE_DATA).toStrictEqual(before);
  });

  it('wraps an unknown open failure without summarising its cause', async () => {
    const boom = new Error('chromium said something with a total of 1200 in it');
    const port = createPdfRenderPort(failingStrategy(boom));
    const caught: unknown = await port
      .render(requestOf(templateOf()))
      .catch((error: unknown) => error);
    expect(caught).toBeInstanceOf(DocumentRenderError);
    if (caught instanceof DocumentRenderError) {
      expect(caught.code).toBe('pdf-export-failed');
      expect(caught.message).not.toContain('1200');
      expect(caught.cause).toBe(boom);
    }
  });

  it('wraps an unknown print failure and still closes the session', async () => {
    const boom = new Error('the printer gave up on 1200');
    const { strategy, log } = failingPrintStrategy(boom);
    const caught: unknown = await createPdfRenderPort(strategy)
      .render(requestOf(templateOf()))
      .catch((error: unknown) => error);
    expect(caught).toBeInstanceOf(DocumentRenderError);
    if (caught instanceof DocumentRenderError) {
      expect(caught.code).toBe('pdf-export-failed');
      expect(caught.message).not.toContain('1200');
    }
    expect(log.closed).toBe(1);
  });

  it('wraps an unknown measurement failure without summarising its cause', async () => {
    const boom = new Error('the layout engine choked on 1200');
    const { strategy, log } = failingMeasureStrategy(boom);
    const caught: unknown = await createPdfRenderPort(strategy)
      .render(requestOf(templateOf()))
      .catch((error: unknown) => error);
    expect(caught).toBeInstanceOf(DocumentRenderError);
    if (caught instanceof DocumentRenderError) {
      expect(caught.code).toBe('layout-measurement-failed');
      expect(caught.message).not.toContain('1200');
      expect(caught.cause).toBe(boom);
    }
    expect(log.closed).toBe(1);
    expect(log.printed).toHaveLength(0);
  });

  it('lets a refusal a measurement already named travel unchanged', async () => {
    const named = new DocumentRenderError('no room', 'page-band-overflow', { region: 'header' });
    const { strategy } = failingMeasureStrategy(named);
    await expect(createPdfRenderPort(strategy).render(requestOf(templateOf()))).rejects.toBe(named);
  });

  it('lets a refusal the session already named travel unchanged', async () => {
    const named = new DocumentRenderError('no room', 'page-band-overflow', { region: 'root' });
    const port = createPdfRenderPort(failingStrategy(named));
    await expect(port.render(requestOf(templateOf()))).rejects.toBe(named);
  });

  it('closes the session after a refusal raised inside it', async () => {
    const { strategy, log } = failingPrintStrategy(
      new DocumentRenderError('no room', 'page-band-overflow', {}),
    );
    await expect(
      createPdfRenderPort(strategy).render(requestOf(templateOf())),
    ).rejects.toMatchObject({ code: 'page-band-overflow' });
    expect(log.closed).toBe(1);
  });

  it('applies configured shape bounds, which are engine options and not request fields', async () => {
    const port = createPdfRenderPort(fakeStrategy().strategy, { shapeLimits: { maxNodes: 4 } });
    await expect(port.render(requestOf(templateOf()))).rejects.toMatchObject({
      code: 'template-refused',
    });
  });

  it('applies configured evaluation bounds to the formulas of the document', async () => {
    const port = createPdfRenderPort(fakeStrategy().strategy, {
      evaluationLimits: { maxSteps: 1 },
    });
    await expect(port.render(requestOf(labelText, SAMPLE_DATA))).resolves.toMatchObject({
      format: 'pdf',
    });
    const tight = createPdfRenderPort(fakeStrategy().strategy, {
      evaluationLimits: { maxSteps: 1 },
    });
    const two = templateOf({
      root: {
        type: 'container',
        id: 'root',
        children: [
          {
            type: 'text',
            id: 'twice',
            content: [
              { kind: 'binding', value: { kind: 'path', path: 'sample.label' } },
              { kind: 'binding', value: { kind: 'path', path: 'sample.label' } },
            ],
          },
        ],
      },
    });
    await expect(tight.render(requestOf(two, SAMPLE_DATA))).rejects.toMatchObject({
      code: 'expression-refused',
    });
  });
});

/** A template of three blocks the fake makes tall, on a sheet with no margin to subtract. */
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
        on: 'exceptLast',
        content: {
          type: 'container',
          id: 'run',
          children: [{ type: 'text', id: 'run-t', content: PAGE_MARKERS }],
        },
      },
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

describe('a document that needs more than one page', () => {
  it('binds the bands the run of pages adds, and only once', async () => {
    const { strategy, log } = fakeStrategy(TALL);
    await createPdfRenderPort(strategy).render(requestOf(threeTall));
    const [printed] = log.printed;
    const html = printed?.html ?? '';
    expect(html.split('class="ov-page"').length - 1).toBe(3);
    /* `exceptLast` was unreachable on the one-page hypothesis and is bound on the second pass. */
    expect(html).toContain('data-openview-node="run"');
    expect(html).toContain('data-openview-node="end"');
    expect(html.split('data-openview-node="top"').length - 1).toBe(3);
  });

  it('measures the digits and the natural heights again once the bands widened', async () => {
    const { strategy, log } = fakeStrategy(TALL);
    await createPdfRenderPort(strategy).render(requestOf(threeTall));
    /* Digits and heights for one page, the same two again for the run of pages, then the sequence. */
    expect(log.measured).toHaveLength(5);
  });

  it('reserves one box per marker, as wide as the bound allows', async () => {
    const { strategy, log } = fakeStrategy(TALL);
    await createPdfRenderPort(strategy).render(requestOf(threeTall));
    const widths = [
      ...(log.printed[0]?.html ?? '').matchAll(/class="ov-marker" style="[^"]*width:([\d.]+)px/g),
    ].map((match) => match[1]);
    expect(widths.length).toBeGreaterThan(0);
    expect(new Set(widths).size).toBe(1);
  });

  it('writes the rank of each page and the same count on all of them', async () => {
    const { strategy, log } = fakeStrategy(TALL);
    await createPdfRenderPort(strategy).render(requestOf(threeTall));
    const sheets = (log.printed[0]?.html ?? '').split('class="ov-page"').slice(1);
    const shown = sheets.map((sheet) =>
      [...sheet.matchAll(/class="ov-marker"[^>]*>([^<]*)</g)].map((match) => match[1]),
    );
    expect(shown).toStrictEqual([
      ['1', '3', '1', '3'],
      ['2', '3', '2', '3'],
      ['3', '3', '3', '3'],
    ]);
  });
});

describe('a sequence the browser lays out taller than it was composed', () => {
  it('withholds that height from the page and cuts again', async () => {
    const { strategy, log } = fakeStrategy({ ...TALL, overflowRounds: 1, regionContent: 100 });
    const result = await createPdfRenderPort(strategy).render(requestOf(threeTall));
    expect(result.format).toBe('pdf');
    /* One more measurement than the settled case: the first composition was measured and refused. */
    expect(log.measured).toHaveLength(6);
    expect(log.printed).toHaveLength(1);
  });

  it('stops rather than print a sequence it could never prove', async () => {
    const { strategy, log } = fakeStrategy({ ...TALL, overflowRounds: 99, regionContent: 100 });
    await expect(createPdfRenderPort(strategy).render(requestOf(threeTall))).rejects.toMatchObject({
      code: 'pagination-impossible',
    });
    expect(log.printed).toHaveLength(0);
    expect(log.closed).toBe(1);
  });

  it('refuses a block that painted outside its sheet instead of printing it', async () => {
    const { strategy, log } = fakeStrategy({ ...TALL, escaping: ['a'] });
    await expect(createPdfRenderPort(strategy).render(requestOf(threeTall))).rejects.toMatchObject({
      code: 'layout-measurement-failed',
    });
    expect(log.printed).toHaveLength(0);
  });
});

describe('the writings the caller selected for one port', () => {
  /** The writings this file names. Their keys belong to the fixture, not to the contract. */
  const WRITINGS = {
    'fr-eur-2': {
      locale: 'fr-FR',
      currency: 'EUR',
      minFractionDigits: 2,
      maxFractionDigits: 2,
      dateStyle: 'long',
    },
    'fr-decimal-3': {
      locale: 'fr-FR',
      currency: 'EUR',
      minFractionDigits: 0,
      maxFractionDigits: 3,
      dateStyle: 'short',
    },
  };

  const writtenAmount = templateOf({
    presentations: WRITINGS,
    root: {
      type: 'container',
      id: 'root',
      children: [
        {
          type: 'text',
          id: 'amount',
          content: [
            {
              kind: 'binding',
              value: { kind: 'path', path: 'sample.reference' },
              format: { kind: 'money', profile: 'amount' },
            },
          ],
        },
      ],
    },
  });

  /** A report marker in a domain a one-page document never reaches. */
  const lateReport = templateOf({
    presentations: WRITINGS,
    page: {
      /* The same small sheet as `threeTall`, so the fake's tall blocks really need three pages. */
      sheet: { width: 100, height: 100 },
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      header: [
        {
          on: 'exceptFirst',
          content: {
            type: 'container',
            id: 'carried',
            children: [
              {
                type: 'text',
                id: 'carried-t',
                content: [
                  {
                    kind: 'pageField',
                    field: 'report',
                    decimals: 2,
                    mode: 'halfEven',
                    format: { kind: 'money', profile: 'amount' },
                  },
                ],
              },
            ],
          },
        },
      ],
      footer: [],
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

  it('writes a value at the selected writing, and leaves the request untouched', async () => {
    const { strategy, log } = fakeStrategy();
    const port = createPdfRenderPort(strategy, { presentationSelection: { amount: 'fr-eur-2' } });
    const request = requestOf(writtenAmount, SAMPLE_DATA);

    await port.render(request);

    expect(log.printed[0]?.html).toContain('42,00');
    /* The selection is an engine option: no third field of the request, and no reserved key. */
    expect(Object.keys(request).sort()).toStrictEqual(['data', 'template']);
  });

  it('refuses before opening a session when a reachable site names an unselected profile', async () => {
    // The writings are resolved during binding, which happens before the browser is asked for
    // anything: no Chromium is launched for a document that cannot print, and nothing to close.
    const { strategy, log } = fakeStrategy();
    const port = createPdfRenderPort(strategy, { presentationSelection: {} });

    await expect(port.render(requestOf(writtenAmount, SAMPLE_DATA))).rejects.toMatchObject({
      code: 'presentation-refused',
      details: { nodeId: 'amount', formatKind: 'money' },
    });
    expect(log.opened).toHaveLength(0);
    expect(log.printed).toHaveLength(0);
    expect(log.closed).toBe(0);
  });

  it('closes the session when a band bound after the first pass refuses its writing', async () => {
    // The report marker lives in a domain the one-page hypothesis never reaches, so its writing is
    // resolved INSIDE the session -- which then has to be closed on the way out. The scale of the
    // selected writing contradicts the rounding the marker declares.
    const { strategy, log } = fakeStrategy(TALL);
    const port = createPdfRenderPort(strategy, {
      presentationSelection: { amount: 'fr-decimal-3' },
    });

    await expect(port.render(requestOf(lateReport))).rejects.toMatchObject({
      code: 'presentation-refused',
      details: { limit: 2 },
    });
    expect(log.closed).toBe(1);
    expect(log.printed).toHaveLength(0);
  });
});
