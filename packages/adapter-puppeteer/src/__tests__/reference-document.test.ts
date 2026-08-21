import { collectTemplateDataPaths, type EvaluationScope } from '@openview/core';
import { createPdfRenderPort, DocumentRenderError, type PdfSourceDocument } from '@openview/engine';
import { describe, expect, it } from 'vitest';
import { CORRUPT_PNG, hostStrategy, inspectPdf } from './fixtures.js';
import {
  APPEARANCES,
  type Appearance,
  BARE,
  DATASETS,
  FRAMED,
  ONE_ROW,
  referenceDocument,
  THREE_ROWS,
} from './reference-document.js';

const CHROMIUM_TIMEOUT_MS = 60_000;
const PT_PER_MM = 72 / 25.4;

/** The html the pipeline produced, captured without printing it. */
async function preparedHtml(
  appearance: Appearance,
  data: EvaluationScope,
): Promise<PdfSourceDocument> {
  const calls: PdfSourceDocument[] = [];
  const port = createPdfRenderPort({
    format: 'pdf',
    render(source: PdfSourceDocument): Promise<Uint8Array> {
      calls.push(source);
      return Promise.resolve(new Uint8Array());
    },
  });
  await port.render({ template: referenceDocument(appearance), data });
  const [source] = calls;
  if (source === undefined) {
    throw new Error('the pipeline produced no source document');
  }
  return source;
}

const printed = createPdfRenderPort(hostStrategy());

describe('the two appearances declare the same document', () => {
  it('reads exactly the same data paths', () => {
    const framed = collectTemplateDataPaths(referenceDocument(FRAMED));
    const bare = collectTemplateDataPaths(referenceDocument(BARE));
    expect([...framed].sort()).toStrictEqual([...bare].sort());
    expect(framed.length).toBeGreaterThan(0);
  });

  it('keeps the same node ids in the same order', () => {
    const idsOf = (appearance: Appearance): readonly string[] =>
      JSON.stringify(referenceDocument(appearance)).match(/"id":"[^"]+"/g) ?? [];
    expect(idsOf(FRAMED)).toStrictEqual(idsOf(BARE));
  });

  it('differs only in its appearance fields', () => {
    expect(referenceDocument(FRAMED).root.box).not.toStrictEqual(referenceDocument(BARE).root.box);
  });
});

describe('the prepared document', () => {
  it('holds the computed figures and no expression at all', async () => {
    const { html } = await preparedHtml(FRAMED, THREE_ROWS);
    /* 2x10 + 1x30 + 4x2.5 = 60; 10% of it is 6; 60 - 6 = 54. */
    expect(html).toContain('>60<');
    expect(html).toContain('>6<');
    expect(html).toContain('>54<');
    /* 2026-01-20 plus 30 days, then the end of that month. */
    expect(html).toContain('>2026-02-19<');
    expect(html).toContain('>2026-02-28<');
    /* Two of the three rows carry a reduction. */
    expect(html).toContain('>2<');
    expect(html).not.toContain('"kind"');
    expect(html).not.toContain('aggregate');
    expect(html).not.toContain('percentOf');
    expect(html).not.toContain('row.');
  });

  it('materialises one row per element of the selected dataset', async () => {
    const three = await preparedHtml(FRAMED, THREE_ROWS);
    const one = await preparedHtml(FRAMED, ONE_ROW);
    const rows = (html: string): number =>
      (html.match(/data-openview-node="detail"/g) ?? []).length;
    expect(rows(three.html)).toBe(3);
    expect(rows(one.html)).toBe(1);
  });

  it('drops a false condition and prints no note for an unreduced row', async () => {
    expect((await preparedHtml(FRAMED, ONE_ROW)).html).not.toContain('reduced-note');
    /* The same declaration, on a dataset where two rows do carry a reduction. */
    const three = await preparedHtml(FRAMED, THREE_ROWS);
    expect((three.html.match(/data-openview-node="reduced-note"/g) ?? []).length).toBe(2);
  });

  it('renders both page markers as 1 and keeps the final-page band', async () => {
    const { html } = await preparedHtml(FRAMED, THREE_ROWS);
    expect(html).toContain('data-openview-node="final-foot-num"');
    expect(html).toContain('Page ');
    expect(html).toContain('>1<');
    /* The running foot is `exceptLast`, and the only page is the last one. */
    expect(html).not.toContain('running-foot');
    expect(html).toContain('No early-payment discount');
  });

  it('shows every adjacent pair of rules as one band, and it is the wider one', async () => {
    /* Counted inside the rows table alone, found by its declaration id: the page band and its own
       grid declare rules of their own, and none of them competes for a boundary of this table. */
    const inTable = (html: string, band: string): number => {
      const chunk =
        html.split('<table').find((part) => part.includes('data-openview-node="rows"')) ?? '';
      const table = chunk.slice(0, chunk.indexOf('</table>'));
      return (table.match(new RegExp(band.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? [])
        .length;
    };

    /* Framed: the head declares 0.28 and each detail row 1.2, so every one of the three detail
       rows takes its top boundary -- one band on each of five cells. The head's own 0.28 bottom
       loses and paints nowhere. */
    const framed = await preparedHtml(FRAMED, THREE_ROWS);
    expect(inTable(framed.html, 'inset 0 1.2mm 0 0 #1b3a6f')).toBe(15);
    expect(inTable(framed.html, 'inset 0 -0.28mm 0 0 #1b3a6f')).toBe(1);
    expect(framed.html).not.toContain('1.48mm');

    /* Bare: the widths are reversed, so the head keeps the boundary it shares with the first
       detail row, and only the two later row-to-row boundaries fall to a detail row's top. */
    const bare = await preparedHtml(BARE, THREE_ROWS);
    expect(inTable(bare.html, 'inset 0 -1.2mm 0 0 #8C3A1B')).toBe(5);
    expect(inTable(bare.html, 'inset 0 0.28mm 0 0 #8C3A1B')).toBe(10);
    expect(bare.html).not.toContain('1.48mm');
  });

  it('switches the title on a value of the dataset', async () => {
    expect((await preparedHtml(FRAMED, THREE_ROWS)).html).toContain('Statement 20260014 for ACME');
    expect((await preparedHtml(FRAMED, ONE_ROW)).html).toContain('BRONTIDE / 20260015');
  });

  it('names the logo as the only image, and it is embedded', async () => {
    const { images } = await preparedHtml(FRAMED, THREE_ROWS);
    expect(images).toHaveLength(1);
    expect(images[0]?.nodeId).toBe('logo');
    expect(images[0]?.src.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('mutates neither the template nor the dataset', async () => {
    const template = referenceDocument(FRAMED);
    const templateBefore = structuredClone(template);
    const dataBefore = structuredClone(THREE_ROWS);
    const port = createPdfRenderPort({
      format: 'pdf',
      render: () => Promise.resolve(new Uint8Array()),
    });
    await port.render({ template, data: THREE_ROWS });
    expect(template).toStrictEqual(templateBefore);
    expect(THREE_ROWS).toStrictEqual(dataBefore);
  });
});

describe('every appearance and every dataset prints', () => {
  for (const appearance of APPEARANCES) {
    for (const dataset of DATASETS) {
      it(
        `prints ${appearance.name} with ${dataset.name} as one A4 page`,
        async () => {
          const result = await printed.render({
            template: referenceDocument(appearance),
            data: dataset.data,
          });
          expect(result.format).toBe('pdf');
          expect(result.contentType).toBe('application/pdf');
          expect(Buffer.from(result.bytes.subarray(0, 5)).toString('latin1')).toBe('%PDF-');
          const { pages, sizes } = await inspectPdf(result.bytes);
          expect(pages).toBe(1);
          expect(Math.abs((sizes[0]?.width ?? 0) - 210 * PT_PER_MM)).toBeLessThan(0.5);
          expect(Math.abs((sizes[0]?.height ?? 0) - 297 * PT_PER_MM)).toBeLessThan(0.5);
        },
        CHROMIUM_TIMEOUT_MS,
      );
    }
  }
});

describe('the same document, mutated to fail', () => {
  const withoutKey = (key: string): EvaluationScope => {
    const { order, ...rest } = THREE_ROWS;
    if (typeof order !== 'object' || order === null) {
      throw new Error('the fixture changed shape');
    }
    const kept: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(order)) {
      if (name !== key) {
        kept[name] = value;
      }
    }
    return { ...rest, order: kept };
  };

  async function refusalFrom(data: EvaluationScope): Promise<DocumentRenderError> {
    const caught: unknown = await printed
      .render({ template: referenceDocument(FRAMED), data })
      .catch((error: unknown) => error);
    if (caught instanceof DocumentRenderError) {
      return caught;
    }
    throw new Error(`expected a refusal, got ${String(caught)}`);
  }

  it('refuses a missing visible value rather than printing a blank', async () => {
    const refused = await refusalFrom(withoutKey('holder'));
    expect(refused.code).toBe('missing-binding-value');
    expect(refused.details.nodeId).toBe('title');
  });

  it('refuses a bound object rather than serialising it', async () => {
    const refused = await refusalFrom({
      ...THREE_ROWS,
      issuer: { notice: { text: 'nested' } },
    });
    expect(refused.code).toBe('non-printable-binding-value');
    expect(refused.details.actualType).toBe('object');
    expect(refused.message).not.toContain('nested');
  });

  it(
    'refuses a corrupt logo rather than printing its alternative text',
    async () => {
      const source = await preparedHtml(FRAMED, THREE_ROWS);
      const broken: PdfSourceDocument = {
        html: source.html.replace(source.images[0]?.src ?? '', CORRUPT_PNG),
        sheet: source.sheet,
        images: [{ nodeId: 'logo', path: [], src: CORRUPT_PNG }],
      };
      const caught: unknown = await hostStrategy()
        .render(broken)
        .catch((error: unknown) => error);
      expect(caught).toBeInstanceOf(DocumentRenderError);
      if (caught instanceof DocumentRenderError) {
        expect(caught.code).toBe('image-load-failed');
      }
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'refuses a body too long for the sheet, with nothing truncated',
    async () => {
      const many = {
        ...THREE_ROWS,
        order: {
          ...(typeof THREE_ROWS.order === 'object' && THREE_ROWS.order !== null
            ? THREE_ROWS.order
            : {}),
          rows: Array.from({ length: 400 }, (_unused, index) => ({
            sku: `X-${index}`,
            units: 1,
            rate: 1,
            reduction: 0,
          })),
        },
      };
      const refused = await refusalFrom(many);
      expect(refused.code).toBe('single-page-overflow');
    },
    CHROMIUM_TIMEOUT_MS,
  );
});
