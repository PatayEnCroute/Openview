import {
  collectTemplateDataPaths,
  type EvaluationScope,
  roundDecimal,
  type Template,
} from '@openview/core';
import { createPdfRenderPort, DocumentRenderError, type PdfSourceDocument } from '@openview/engine';
import { describe, expect, it } from 'vitest';
import {
  type CapturedRender,
  CORRUPT_PNG,
  hostStrategy,
  inspectPdf,
  LOGO_PNG,
  renderCapturing,
} from './fixtures.js';
import {
  APPEARANCES,
  type Appearance,
  BARE,
  DATASETS,
  FRAMED,
  layeredReferenceDocument,
  ONE_ROW,
  referenceDocument,
  SIXTY_ROWS,
  THREE_ROWS,
} from './reference-document.js';

const CHROMIUM_TIMEOUT_MS = 60_000;
const PT_PER_MM = 72 / 25.4;

const prepared = new Map<string, Promise<PdfSourceDocument>>();

/**
 * The document the pipeline really printed, measured in a real browser and kept.
 *
 * Cached by appearance and dataset: every case below reads the same four renders, so the suite
 * launches four browsers rather than one per assertion.
 */
function preparedHtml(appearance: Appearance, data: EvaluationScope): Promise<PdfSourceDocument> {
  const at = `${appearance.name}|${JSON.stringify(data)}`;
  const found = prepared.get(at);
  if (found !== undefined) {
    return found;
  }
  const running = renderCapturing(referenceDocument(appearance), data).then(
    (render) => render.printed,
  );
  prepared.set(at, running);
  return running;
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
  it(
    'holds the computed figures and no expression at all',
    async () => {
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
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'materialises one row per element of the selected dataset',
    async () => {
      const three = await preparedHtml(FRAMED, THREE_ROWS);
      const one = await preparedHtml(FRAMED, ONE_ROW);
      const rows = (html: string): number =>
        (html.match(/data-openview-node="detail"/g) ?? []).length;
      expect(rows(three.html)).toBe(3);
      expect(rows(one.html)).toBe(1);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'drops a false condition and prints no note for an unreduced row',
    async () => {
      expect((await preparedHtml(FRAMED, ONE_ROW)).html).not.toContain('reduced-note');
      /* The same declaration, on a dataset where two rows do carry a reduction. */
      const three = await preparedHtml(FRAMED, THREE_ROWS);
      expect((three.html.match(/data-openview-node="reduced-note"/g) ?? []).length).toBe(2);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'renders both page markers as 1 and keeps the final-page band',
    async () => {
      const { html } = await preparedHtml(FRAMED, THREE_ROWS);
      expect(html).toContain('data-openview-node="final-foot-num"');
      expect(html).toContain('Page ');
      expect(html).toContain('>1<');
      /* The running foot is `exceptLast`, and the only page is the last one. */
      expect(html).not.toContain('running-foot');
      expect(html).toContain('No early-payment discount');
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'shows every adjacent pair of rules as one band, and it is the wider one',
    async () => {
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
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'switches the title on a value of the dataset',
    async () => {
      expect((await preparedHtml(FRAMED, THREE_ROWS)).html).toContain(
        'Statement 20260014 for ACME',
      );
      expect((await preparedHtml(FRAMED, ONE_ROW)).html).toContain('BRONTIDE / 20260015');
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'names the logo as the only image, and it is embedded',
    async () => {
      const { images } = await preparedHtml(FRAMED, THREE_ROWS);
      expect(images).toHaveLength(1);
      expect(images[0]?.nodeId).toBe('logo');
      expect(images[0]?.src.startsWith('data:image/png;base64,')).toBe(true);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'mutates neither the template nor the dataset',
    async () => {
      const template = referenceDocument(FRAMED);
      const templateBefore = structuredClone(template);
      const dataBefore = structuredClone(THREE_ROWS);
      await renderCapturing(template, THREE_ROWS);
      expect(template).toStrictEqual(templateBefore);
      expect(THREE_ROWS).toStrictEqual(dataBefore);
    },
    CHROMIUM_TIMEOUT_MS,
  );
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
    /* The other keys of the issuer are kept: replacing the whole of it would make the run stop on
       the first ABSENT value instead of on the object this case is about. */
    const issuer = THREE_ROWS.issuer;
    if (typeof issuer !== 'object' || issuer === null || Array.isArray(issuer)) {
      throw new Error('the fixture should carry an issuer object');
    }
    const refused = await refusalFrom({
      ...THREE_ROWS,
      issuer: { ...issuer, notice: { text: 'nested' } },
    });
    expect(refused.code).toBe('non-printable-binding-value');
    expect(refused.details.actualType).toBe('object');
    expect(refused.message).not.toContain('nested');
  });

  it(
    'refuses a corrupt logo rather than printing its alternative text',
    async () => {
      const broken = JSON.parse(
        JSON.stringify(referenceDocument(FRAMED)).replaceAll(LOGO_PNG, CORRUPT_PNG),
      ) as Template;
      const caught: unknown = await printed
        .render({ template: broken, data: THREE_ROWS })
        .catch((error: unknown) => error);
      expect(caught).toBeInstanceOf(DocumentRenderError);
      if (caught instanceof DocumentRenderError) {
        expect(caught.code).toBe('image-load-failed');
      }
    },
    CHROMIUM_TIMEOUT_MS,
  );
});

describe('the paginated recette: sixty lines on the same model', () => {
  const paginated = new Map<string, Promise<CapturedRender>>();

  const renderSixty = (appearance: Appearance): Promise<CapturedRender> => {
    const found = paginated.get(appearance.name);
    if (found !== undefined) {
      return found;
    }
    const running = renderCapturing(referenceDocument(appearance), SIXTY_ROWS);
    paginated.set(appearance.name, running);
    return running;
  };

  const count = (html: string, needle: string): number => html.split(needle).length - 1;

  /** Everything one sheet of the printed document holds, split on the boxes themselves. */
  const sheets = (html: string): readonly string[] => html.split('class="ov-page"').slice(1);

  for (const appearance of APPEARANCES) {
    it(
      `prints ${appearance.name} on exactly four A4 sheets`,
      async () => {
        const { bytes } = await renderSixty(appearance);
        const { pages, sizes } = await inspectPdf(bytes);
        expect(pages).toBe(4);
        for (const size of sizes) {
          expect(Math.abs(size.width - 210 * PT_PER_MM)).toBeLessThan(0.5);
          expect(Math.abs(size.height - 297 * PT_PER_MM)).toBeLessThan(0.5);
        }
      },
      CHROMIUM_TIMEOUT_MS,
    );
  }

  it(
    'repeats the column header on every sheet the table reaches',
    async () => {
      const { html } = (await renderSixty(FRAMED)).printed;
      expect(count(html, 'class="ov-page"')).toBe(4);
      expect(count(html, 'data-openview-node="head"')).toBe(4);
      for (const sheet of sheets(html)) {
        expect(count(sheet, 'data-openview-node="head"')).toBe(1);
      }
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'prints every body row exactly once and in order, with no fragment of header alone',
    async () => {
      const { html } = (await renderSixty(FRAMED)).printed;
      expect(count(html, 'data-openview-node="detail"')).toBe(60);
      const written = [...html.matchAll(/>(\d{3}) - /g)].map((match) => match[1]);
      expect(written).toHaveLength(60);
      expect(written).toStrictEqual([...written].sort());
      for (const sheet of sheets(html)) {
        expect(count(sheet, 'data-openview-node="detail"')).toBeGreaterThan(0);
      }
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'never repeats the footer of the table, nor the blocks that follow it',
    async () => {
      const { html } = (await renderSixty(FRAMED)).printed;
      expect(count(html, 'data-openview-node="total"')).toBe(1);
      expect(count(html, 'data-openview-node="totals"')).toBe(1);
      expect(count(html, 'data-openview-node="dates"')).toBe(1);
      /* The footer of the table follows the body: it is on the last sheet the table reaches. */
      const last = sheets(html).at(-1) ?? '';
      expect(count(last, 'data-openview-node="total"')).toBe(1);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'numbers the sheets one to four and shows the same count on all of them',
    async () => {
      const { html } = (await renderSixty(FRAMED)).printed;
      /* Read by REGION, not by rank: a sheet holds a report marker in its top band and the two
         counters in its bottom one, and the top band comes first in the markup. Matching digits
         only would have hidden that, and would have passed or failed on whether the report of the
         day happened to round to a whole number. */
      const markersIn = (sheet: string, region: 'header' | 'footer'): readonly string[] => {
        const band = sheet.split(`data-openview-region="${region}"`)[1] ?? '';
        const slot = band.slice(0, band.indexOf('data-openview-region='));
        return [...slot.matchAll(/class="ov-marker"[^>]*>([^<]*)</g)].map(
          (match) => match[1] ?? '',
        );
      };

      expect(sheets(html).map((sheet) => markersIn(sheet, 'footer'))).toStrictEqual([
        ['1', '4'],
        ['2', '4'],
        ['3', '4'],
        ['4', '4'],
      ]);
      /* One report box on every sheet but the first, whose band domain excludes it. */
      expect(sheets(html).map((sheet) => markersIn(sheet, 'header').length)).toStrictEqual([
        0, 1, 1, 1,
      ]);
      /* Nothing of the measuring pass survives: no placeholder digit and no unresolved marker. */
      expect(html).not.toContain('pageField');
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'paints the running foot on every sheet but the last, and the final foot only there',
    async () => {
      const { html } = (await renderSixty(FRAMED)).printed;
      const running = sheets(html).map((sheet) =>
        count(sheet, 'data-openview-node="running-foot-num"'),
      );
      const final = sheets(html).map((sheet) =>
        count(sheet, 'data-openview-node="final-foot-num"'),
      );
      expect(running).toStrictEqual([1, 1, 1, 0]);
      expect(final).toStrictEqual([0, 0, 0, 1]);
      /* `firstOnly` plus `exceptFirst` covers every sheet exactly once, so the banner appears
         four times even though no single domain names all four. */
      expect(count(html, 'data-openview-node="stripe"')).toBe(4);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'reserves the same height for each band on all four sheets',
    async () => {
      const { printed, measured } = await renderSixty(FRAMED);
      const last = measured.at(-1);
      expect(last?.html).toBe(printed.html);
      /* One declaration each, so a short band leaves white space in its slot rather than lending
         its height to the flow: turning the last sheet into an intermediate one cannot change how
         much fits on it. */
      expect(printed.html.match(/\.ov-top\{height:[\d.]+mm/g)).toHaveLength(1);
      expect(printed.html.match(/\.ov-bottom\{height:[\d.]+mm/g)).toHaveLength(1);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'measures a bounded number of candidates rather than one per cut',
    async () => {
      const { measured } = await renderSixty(FRAMED);
      /* Digits and natural heights for the one-page hypothesis, the same two again once the run of
         pages widened the band domains, then the composed sequence. Sixty rows do not add a sixth. */
      expect(measured).toHaveLength(5);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  /** The text of one declaration on one sheet, in order of appearance. */
  const written = (sheet: string, nodeId: string): readonly string[] =>
    sheet
      .split(`data-openview-node="${nodeId}"`)
      .slice(1)
      .map((piece) =>
        [...piece.slice(0, piece.indexOf('</div>')).matchAll(/>([^<]*)</g)]
          .map((match) => match[1] ?? '')
          .join('')
          .trim(),
      );

  it(
    'carries forward exactly the amounts of the rows that ended on the sheets before',
    async () => {
      // The oracle is DERIVED from the printed sheets: the amounts each sheet shows are summed and
      // rounded the way the model declared, and compared with what the next sheet brought forward.
      // Nothing here is a number copied out of the engine.
      const { html } = (await renderSixty(FRAMED)).printed;
      const perSheet = sheets(html).map((sheet) => ({
        amounts: written(sheet, 'd-amount').map(Number),
        carried: written(sheet, 'stripe-carried'),
      }));

      expect(perSheet[0]?.carried).toStrictEqual([]);
      let running = 0;
      for (const [index, sheet] of perSheet.entries()) {
        if (index > 0) {
          expect(sheet.carried).toStrictEqual([
            `Brought forward ${String(roundDecimal(running, 2, 'halfExpand'))}`,
          ]);
        }
        for (const amount of sheet.amounts) {
          expect(Number.isFinite(amount)).toBe(true);
          running += amount;
        }
      }

      /* And the last carried figure plus the last sheet's rows is the total the model computed. */
      expect(written(html, 'f-amount')).toStrictEqual([String(running)]);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'shows the notice and the payment details on the last sheet only',
    async () => {
      const { html } = (await renderSixty(FRAMED)).printed;
      const counted = (nodeId: string) =>
        sheets(html).map((sheet) => count(sheet, `data-openview-node="${nodeId}"`));
      expect(counted('final-foot-notice')).toStrictEqual([0, 0, 0, 1]);
      expect(counted('final-foot-payment')).toStrictEqual([0, 0, 0, 1]);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'never cuts the settlement frame, and never repeats it',
    async () => {
      // The block asks to stay whole and fits on a fresh page, so it is on exactly one sheet -- and
      // being one box on one sheet is what keeps its frame closed.
      const { html } = (await renderSixty(FRAMED)).printed;
      const perSheet = sheets(html).map((sheet) => count(sheet, 'data-openview-node="settlement"'));
      expect(perSheet.filter((seen) => seen > 0)).toStrictEqual([1]);
      expect(count(html, 'data-openview-node="settlement-body"')).toBe(1);
      expect(count(html, 'data-openview-node="totals"')).toBe(1);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'prints the long terms whole, losing nothing at whatever seam they fall on',
    async () => {
      // What this proves is RESTORATION, not the two-line preference: html carries runs and not
      // visual lines, so the count on each side of a seam is not observable from here. That count
      // is proven where lines exist, in `engine`'s widow matrix on the measured grid.
      const { html } = (await renderSixty(FRAMED)).printed;
      const pieces = sheets(html).flatMap((sheet) => written(sheet, 'terms'));
      expect(pieces.length).toBeGreaterThan(0);
      for (const piece of pieces) {
        expect(piece.length).toBeGreaterThan(0);
      }
      /* Concatenated, the fragments are the notice the data supplied -- start, end and everything
         between, with nothing repeated at a seam. */
      const restored = pieces.join('');
      expect(restored.startsWith('Payment is due on the date shown above')).toBe(true);
      expect(restored.endsWith('is taken as accepted.')).toBe(true);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'keeps a row that wraps onto two visual lines whole, on one sheet',
    async () => {
      const { html } = (await renderSixty(FRAMED)).printed;
      /* Every description is longer than a single line of the column it sits in, and no row is
         split: sixty rows for sixty openings of a detail row. */
      const rows = html.split('data-openview-node="detail"').slice(1);
      expect(rows).toHaveLength(60);
      for (const row of rows) {
        expect(row).toContain(' - ');
      }
    },
    CHROMIUM_TIMEOUT_MS,
  );
});

describe('the C11 recette: a gridded heading and three page layers on the same model', () => {
  const layered = new Map<string, Promise<CapturedRender>>();

  const renderLayered = (withLayers: boolean): Promise<CapturedRender> => {
    const at = withLayers ? 'layered' : 'grid-only';
    const found = layered.get(at);
    if (found !== undefined) {
      return found;
    }
    const running = renderCapturing(layeredReferenceDocument(FRAMED, withLayers), SIXTY_ROWS);
    layered.set(at, running);
    return running;
  };

  const count = (html: string, needle: string): number => html.split(needle).length - 1;
  const sheets = (html: string): readonly string[] => html.split('class="ov-page"').slice(1);

  it('parses and comes out of a JSON round trip identical', () => {
    const template = layeredReferenceDocument(FRAMED);
    const snapshot: unknown = JSON.parse(JSON.stringify(template));
    expect(JSON.parse(JSON.stringify(referenceDocument(FRAMED)))).not.toStrictEqual(snapshot);
    const grid = template.root.children[0];
    if (grid?.type !== 'grid') {
      throw new Error('the recette should open on a heading grid');
    }
    expect(grid.columns).toBe(12);
    expect(template.page.layers?.map((layer) => layer.plane)).toStrictEqual([
      'background',
      'background',
      'foreground',
    ]);
  });

  it(
    'gives the three heading zones their exact shares of one width',
    async () => {
      // The oracle of aligned columns: each zone's measured width is its span's share of one grid,
      // so the vertical edges the shares imply are common ones.
      const { measured } = await renderLayered(true);
      const probe = measured.find(
        (document) =>
          document.html.includes('data-openview-grid-item') &&
          document.html.includes('data-openview-key'),
      );
      if (probe === undefined) {
        throw new Error('the pipeline should have measured a keyed probe of the grid');
      }
      const keyOf = (nodeId: string): string => {
        const found = new RegExp(
          `data-openview-node="${nodeId}"[^>]*data-openview-key="([^"]+)"`,
        ).exec(probe.html)?.[1];
        if (found === undefined) {
          throw new Error(`the probe should key ${nodeId}`);
        }
        return found;
      };
      const session = await hostStrategy().open({ sheet: probe.sheet, images: probe.images });
      try {
        const measurement = await session.measure(probe);
        const widthOf = (nodeId: string): number =>
          measurement.boxes.find((box) => box.key === keyOf(nodeId))?.width ?? 0;
        const mark = widthOf('zone-mark');
        const title = widthOf('zone-title');
        const reference = widthOf('zone-reference');
        expect(mark).toBeGreaterThan(0);
        expect(Math.abs(mark / 3 - title / 5)).toBeLessThan(1);
        expect(Math.abs(title / 5 - reference / 4)).toBeLessThan(1);
      } finally {
        await session.close();
      }
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'prints four sheets, each carrying the three layers in paint order',
    async () => {
      const { bytes, printed } = await renderLayered(true);
      expect((await inspectPdf(bytes)).pages).toBe(4);
      const perSheet = sheets(printed.html);
      expect(perSheet).toHaveLength(4);
      for (const sheet of perSheet) {
        const paper = sheet.indexOf('data-openview-node="paper"');
        const watermark = sheet.indexOf('data-openview-node="watermark"');
        const printable = sheet.indexOf('class="ov-printable"');
        const stamp = sheet.indexOf('data-openview-node="stamp"');
        expect(paper).toBeGreaterThanOrEqual(0);
        expect(watermark).toBeGreaterThan(paper);
        expect(printable).toBeGreaterThan(watermark);
        expect(stamp).toBeGreaterThan(printable);
        expect(count(sheet, 'DUPLICATA')).toBe(1);
      }
      expect(printed.html).toContain('style="opacity:0.12"');
      expect(printed.html).toContain('style="opacity:0.85"');
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'adds and removes the layers without moving one cut, one row or one carried figure',
    async () => {
      const withLayers = (await renderLayered(true)).printed.html;
      const without = (await renderLayered(false)).printed.html;
      const rowsPerSheet = (html: string): readonly number[] =>
        sheets(html).map((sheet) => count(sheet, 'data-openview-node="detail"'));
      const carried = (html: string): readonly string[] =>
        [...html.matchAll(/Brought forward [^<]*<[^>]*>([^<]*)</g)].map((hit) => hit[1] ?? '');
      expect(sheets(withLayers).length).toBe(sheets(without).length);
      expect(rowsPerSheet(withLayers)).toStrictEqual(rowsPerSheet(without));
      expect(carried(withLayers)).toStrictEqual(carried(without));
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'refuses a zone whose content no longer fits, and prints nothing',
    async () => {
      const noisy = {
        ...SIXTY_ROWS,
        order: {
          ...(SIXTY_ROWS.order as Record<string, unknown>),
          holder: 'a holder whose name is far too long for the zone the model gave it '.repeat(4),
        },
      };
      const inner = hostStrategy();
      let printedAnything = false;
      const observing = createPdfRenderPort({
        format: 'pdf',
        async open(resources) {
          const session = await inner.open(resources);
          return {
            measure: (source: PdfSourceDocument) => session.measure(source),
            print: (source: PdfSourceDocument) => {
              printedAnything = true;
              return session.print(source);
            },
            close: () => session.close(),
          };
        },
      });
      const caught: unknown = await observing
        .render({ template: layeredReferenceDocument(FRAMED), data: noisy })
        .catch((error: unknown) => error);
      expect(caught).toBeInstanceOf(DocumentRenderError);
      if (caught instanceof DocumentRenderError) {
        expect(caught.code).toBe('grid-content-overflow');
        expect(caught.details.nodeId).toBe('zone-title');
        expect(caught.message).not.toContain('holder whose name');
      }
      expect(printedAnything).toBe(false);
    },
    CHROMIUM_TIMEOUT_MS,
  );
});
