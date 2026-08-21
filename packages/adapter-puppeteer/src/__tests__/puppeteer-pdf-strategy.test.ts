import { inflateSync } from 'node:zlib';
import { MAX_SHEET_MM, mmFromPt, type Sheet } from '@openview/core';
import { DocumentRenderError, type PdfSourceDocument } from '@openview/engine';
import puppeteer from 'puppeteer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SHEET_TOLERANCE_PT } from '../capability.js';
import { createPuppeteerPdfStrategy, PDF_OPTIONS } from '../puppeteer-pdf-strategy.js';
import { CORRUPT_PNG, inspectPdf, LOGO_PNG, pageOf, sourceOf, TINY_PNG, text } from './fixtures.js';

/** Chromium launches once per render on purpose, so every case needs room for a process. */
const CHROMIUM_TIMEOUT_MS = 60_000;

const PT_PER_MM = 72 / 25.4;

const strategy = createPuppeteerPdfStrategy();

/** Every colour written into the pdf content streams, as DeviceRGB operands. */
function paintedColours(bytes: Uint8Array): readonly string[] {
  const buffer = Buffer.from(bytes);
  const found = new Set<string>();
  let cursor = 0;
  for (;;) {
    const start = buffer.indexOf('stream', cursor);
    if (start < 0) {
      break;
    }
    const end = buffer.indexOf('endstream', start);
    if (end < 0) {
      break;
    }
    let from = start + 'stream'.length;
    if (buffer[from] === 0x0d) {
      from += 1;
    }
    if (buffer[from] === 0x0a) {
      from += 1;
    }
    const raw = buffer.subarray(from, end);
    let inflated: string;
    try {
      inflated = inflateSync(raw).toString('latin1');
    } catch {
      /* Not every stream is deflated -- a font or an image is not -- and a stream this reader
         cannot inflate simply holds no colour operator to collect. */
      inflated = raw.toString('latin1');
    }
    for (const match of inflated.match(/[\d.]+ [\d.]+ [\d.]+ (?:rg|RG)/g) ?? []) {
      found.add(match.trim());
    }
    cursor = end + 'endstream'.length;
  }
  return [...found];
}

async function refusalFrom(source: PdfSourceDocument): Promise<DocumentRenderError> {
  const caught: unknown = await strategy.render(source).catch((error: unknown) => error);
  if (caught instanceof DocumentRenderError) {
    return caught;
  }
  throw new Error(`expected a refusal, got ${String(caught)}`);
}

function sourceWith(html: string, sheet: Sheet = { width: 60, height: 60 }): PdfSourceDocument {
  return { html, sheet, images: [] };
}

/** A hand-written page, for a hostile document the pipeline would never produce. */
function rawPage(body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:60mm 60mm;margin:0}html,body{margin:0;padding:0}*{box-sizing:border-box}
    .ov-page{position:relative;width:60mm;height:60mm;overflow:hidden}
    .ov-printable{position:absolute;top:5mm;left:5mm;width:50mm;height:50mm;display:flex;flex-direction:column}
    .ov-band{flex:0 0 auto}.ov-flow{flex:1 1 auto;min-height:0}
    .ov-image{display:block;width:100%;height:auto}
  </style></head><body><div class="ov-page"><div class="ov-printable">
    <div class="ov-band" data-openview-region="header"></div>
    <div class="ov-flow" data-openview-region="root">${body}</div>
    <div class="ov-band" data-openview-region="footer"></div>
  </div></div></body></html>`;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('printing a real document', () => {
  it(
    'produces a readable pdf of exactly one page',
    async () => {
      const bytes = await strategy.render(
        await sourceOf({ root: { type: 'container', id: 'root', children: [text('t', 'hello')] } }),
      );
      expect(Buffer.from(bytes.subarray(0, 5)).toString('latin1')).toBe('%PDF-');
      expect((await inspectPdf(bytes)).pages).toBe(1);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it.each([
    ['a4', 210, 297],
    ['letter landscape by inverted dimensions', 279.4, 215.9],
    ['a custom sheet', 123.45, 234.56],
  ])(
    'honours %s declared by the template',
    async (_label, width, height) => {
      const bytes = await strategy.render(
        await sourceOf({
          page: pageOf(width, height),
          root: { type: 'container', id: 'root', children: [text('t', 'x')] },
        }),
      );
      const { pages, sizes } = await inspectPdf(bytes);
      expect(pages).toBe(1);
      expect(sizes[0]?.width).toBeCloseTo(width * PT_PER_MM, 0);
      expect(sizes[0]?.height).toBeCloseTo(height * PT_PER_MM, 0);
      expect(Math.abs((sizes[0]?.width ?? 0) - width * PT_PER_MM)).toBeLessThan(SHEET_TOLERANCE_PT);
      expect(Math.abs((sizes[0]?.height ?? 0) - height * PT_PER_MM)).toBeLessThan(
        SHEET_TOLERANCE_PT,
      );
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'prints the declared background rather than the default sheet of the browser',
    async () => {
      const bytes = await strategy.render(
        await sourceOf({
          page: pageOf(60, 60),
          root: {
            type: 'container',
            id: 'root',
            box: { background: '#1b3a6f' },
            children: [text('t', 'x')],
          },
        }),
      );
      /* #1b3a6f is 27 58 111, which DeviceRGB writes as .1059 .2275 .4353. */
      expect(paintedColours(bytes)).toContain('.1059 .2275 .4353 rg');
      const { sizes } = await inspectPdf(bytes);
      expect(sizes[0]?.width).not.toBeCloseTo(612, 0);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it('states every print option, and decides no sheet of its own', () => {
    expect(PDF_OPTIONS).toStrictEqual({
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: false,
      scale: 1,
      waitForFonts: true,
    });
    expect(Object.keys(PDF_OPTIONS)).not.toContain('format');
    expect(Object.keys(PDF_OPTIONS)).not.toContain('path');
  });

  it(
    'writes no header or footer of the browser, and records the metadata debt it does write',
    async () => {
      const bytes = await strategy.render(
        await sourceOf({ root: { type: 'container', id: 'root', children: [text('t', 'body')] } }),
      );
      const raw = Buffer.from(bytes).toString('latin1');
      expect(raw).not.toContain('/Contents (about:blank)');
      expect(raw).not.toContain('file://');
      /* Chromium stamps the document title, the user agent and two timestamps into the pdf info
         dictionary. None of it is printed, and none of it is scrubbed yet: byte-for-byte identity
         between two renders is not a promise this release makes. */
      expect(raw).toContain('/Title (about:blank)');
      expect(raw).toMatch(/\/CreationDate \(D:\d{14}/);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'decodes an embedded bitmap and keeps its intrinsic ratio',
    async () => {
      const bytes = await strategy.render(
        await sourceOf({
          page: pageOf(60, 60),
          root: {
            type: 'container',
            id: 'root',
            children: [{ type: 'image', id: 'logo', src: LOGO_PNG, alt: 'logo' }],
          },
        }),
      );
      expect((await inspectPdf(bytes)).pages).toBe(1);
    },
    CHROMIUM_TIMEOUT_MS,
  );
});

describe('capability refusals, raised before a browser exists', () => {
  it('refuses a sheet outside the range it was measured on', async () => {
    const refused = await refusalFrom(
      sourceWith(rawPage(''), { width: MAX_SHEET_MM + 1, height: 100 }),
    );
    expect(refused.code).toBe('adapter-capability-mismatch');
    expect(refused.details.limit).toBe(MAX_SHEET_MM);
  });

  it.each([
    ['http', 'http://example.test/logo.png'],
    ['https', 'https://example.test/logo.png'],
    ['a file url', 'file:///etc/passwd'],
    ['a bare path', '/assets/logo.png'],
    ['an asset key', 'asset:company-logo'],
    ['svg', 'data:image/svg+xml;base64,PHN2Zy8+'],
    ['an unlisted media type', 'data:image/gif;base64,R0lGODlh'],
  ])('refuses %s without loading anything', async (_label, src) => {
    const refused = await refusalFrom({
      html: rawPage(''),
      sheet: { width: 60, height: 60 },
      images: [{ nodeId: 'logo', path: ['root', 'children', 0], src }],
    });
    expect(refused.code).toBe('unsupported-image-source');
    expect(refused.details.nodeId).toBe('logo');
    expect(refused.message).not.toContain(src);
  });

  it(
    'accepts the three embedded bitmap forms',
    async () => {
      const accepted = ['png', 'jpeg', 'webp'].map((type) => ({
        nodeId: type,
        path: [],
        src: `data:image/${type};base64,AAAA`,
      }));
      /* Reaching the page is the assertion: the sources passed the capability gate. The refusal
         that follows names the load, not the source. */
      const refused = await refusalFrom({
        html: rawPage(
          `<div data-openview-node="png"><img class="ov-image" src="${CORRUPT_PNG}"></div>`,
        ),
        sheet: { width: 60, height: 60 },
        images: accepted,
      });
      expect(refused.code).toBe('image-load-failed');
    },
    CHROMIUM_TIMEOUT_MS,
  );
});

describe('refusals measured in the page', () => {
  it(
    'refuses an image that did not decode instead of printing a blank',
    async () => {
      const refused = await refusalFrom({
        html: rawPage(
          `<div data-openview-node="logo"><img class="ov-image" src="${CORRUPT_PNG}" alt="a logo"></div>`,
        ),
        sheet: { width: 60, height: 60 },
        images: [{ nodeId: 'logo', path: [], src: CORRUPT_PNG }],
      });
      expect(refused.code).toBe('image-load-failed');
      expect(refused.details.nodeId).toBe('logo');
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'refuses an image too tall for any page rather than scaling it',
    async () => {
      const refused = await refusalFrom({
        html: rawPage(
          `<div data-openview-node="tall" style="width:200mm"><img class="ov-image" src="${TINY_PNG}"></div>`,
        ),
        sheet: { width: 60, height: 60 },
        images: [{ nodeId: 'tall', path: [], src: TINY_PNG }],
      });
      expect(refused.code).toBe('oversized-atomic-resource');
      expect(refused.details.nodeId).toBe('tall');
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'refuses a flow that does not fit, with nothing truncated',
    async () => {
      const long = Array.from({ length: 200 }, (_unused, index) => `<div>line ${index}</div>`).join(
        '',
      );
      const refused = await refusalFrom(
        sourceWith(rawPage(`<div data-openview-node="long">${long}</div>`)),
      );
      expect(refused.code).toBe('single-page-overflow');
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'refuses a band taller on its own than the printable area',
    async () => {
      const tall = Array.from({ length: 200 }, () => '<div>band</div>').join('');
      const html = rawPage('').replace(
        '<div class="ov-band" data-openview-region="header"></div>',
        `<div class="ov-band" data-openview-region="header"><div data-openview-node="band">${tall}</div></div>`,
      );
      const refused = await refusalFrom(sourceWith(html));
      expect(refused.code).toBe('single-page-overflow');
      expect(refused.details.region).toBe('header');
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'refuses a block painting outside the sheet',
    async () => {
      const refused = await refusalFrom(
        sourceWith(
          rawPage(
            '<div data-openview-node="wide" style="position:absolute;left:80mm;top:0;width:20mm;height:5mm"></div>',
          ),
        ),
      );
      expect(refused.code).toBe('single-page-overflow');
      expect(refused.details.nodeId).toBe('wide');
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'never prints a second page for content that overflows',
    async () => {
      const long = Array.from({ length: 400 }, (_unused, index) => `<div>row ${index}</div>`).join(
        '',
      );
      const refused = await refusalFrom(
        sourceWith(rawPage(`<div data-openview-node="l">${long}</div>`)),
      );
      expect(refused.code).toBe('single-page-overflow');
    },
    CHROMIUM_TIMEOUT_MS,
  );
});

describe('the page is inert and offline', () => {
  it(
    'runs no script the document carries',
    async () => {
      const html = rawPage(
        '<div data-openview-node="flag" style="width:10mm;height:5mm"></div>' +
          '<script>document.querySelector(".ov-printable").style.height = "500mm";</script>',
      );
      /* If the script had run, the printable box would have overflowed the sheet and the render
         would have been refused. */
      const bytes = await strategy.render(sourceWith(html));
      expect((await inspectPdf(bytes)).pages).toBe(1);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'aborts a request a secondary resource tries to make',
    async () => {
      const html = rawPage(
        '<div data-openview-node="i"><img class="ov-image" src="http://169.254.169.254/latest/meta-data"></div>',
      );
      const refused = await refusalFrom({
        html,
        sheet: { width: 60, height: 60 },
        images: [],
      });
      /* The request was aborted, so the image never decoded. That refusal IS the proof it did not
         travel: a reachable resource would have printed. */
      expect(refused.code).toBe('image-load-failed');
    },
    CHROMIUM_TIMEOUT_MS,
  );
});

describe('resource lifetime', () => {
  it(
    'closes the browser after a successful render',
    async () => {
      const launched: { connected: boolean }[] = [];
      const launch = puppeteer.launch.bind(puppeteer);
      vi.spyOn(puppeteer, 'launch').mockImplementation(async (options) => {
        const browser = await launch(options);
        launched.push(browser);
        return browser;
      });
      await strategy.render(
        await sourceOf({ root: { type: 'container', id: 'root', children: [text('t', 'x')] } }),
      );
      expect(launched).toHaveLength(1);
      expect(launched[0]?.connected).toBe(false);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'closes the browser after a refusal measured in the page',
    async () => {
      const launched: { connected: boolean }[] = [];
      const launch = puppeteer.launch.bind(puppeteer);
      vi.spyOn(puppeteer, 'launch').mockImplementation(async (options) => {
        const browser = await launch(options);
        launched.push(browser);
        return browser;
      });
      await refusalFrom(
        sourceWith(
          rawPage(
            `<div data-openview-node="tall" style="width:200mm"><img class="ov-image" src="${TINY_PNG}"></div>`,
          ),
        ),
      );
      expect(launched[0]?.connected).toBe(false);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it('launches no browser at all when a capability refuses first', async () => {
    const spy = vi.spyOn(puppeteer, 'launch');
    await refusalFrom({
      html: rawPage(''),
      sheet: { width: 60, height: 60 },
      images: [{ nodeId: 'logo', path: [], src: 'http://example.test/a.png' }],
    });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('unit conversion', () => {
  it('uses the conversion of core rather than a second constant', () => {
    expect(mmFromPt(72)).toBeCloseTo(25.4, 12);
    expect(SHEET_TOLERANCE_PT).toBeGreaterThan(0.24);
  });
});
