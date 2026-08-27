import { createServer } from 'node:http';
import { inflateSync } from 'node:zlib';
import { MAX_SHEET_MM, mmFromPt, type Sheet } from '@openview/core';
import {
  DocumentRenderError,
  type PdfLayoutMeasurement,
  type PdfRenderSession,
  type PdfSourceDocument,
} from '@openview/engine';
import puppeteer from 'puppeteer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SHEET_TOLERANCE_PT } from '../capability.js';
import { createPuppeteerPdfStrategy } from '../puppeteer-pdf-strategy.js';
import { PDF_OPTIONS } from '../session.js';
import {
  CORRUPT_PNG,
  HOST_LAUNCH_OPTIONS,
  hostStrategy,
  inspectPdf,
  LOGO_PNG,
  pageOf,
  renderCapturing,
  TINY_PNG,
  templateOf,
  text,
} from './fixtures.js';

/**
 * Room for Chromium to launch and lay a document out, under a loaded machine.
 *
 * A watchdog against a hung browser, never a performance budget: the slowest case of this package
 * measures 28 s when it runs alone, and the whole suite holds several browsers at once, so a
 * threshold near the uncontended figure fails on contention rather than on a fault.
 */
const CHROMIUM_TIMEOUT_MS = 120_000;

const PT_PER_MM = 72 / 25.4;

const strategy = hostStrategy();

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
    } catch (_error: unknown) {
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

const sheetOf = (width = 60, height = 60): Sheet => ({ width, height });

function sourceWith(html: string, sheet: Sheet = sheetOf()): PdfSourceDocument {
  return { html, sheet, images: [] };
}

/** Opens a session, runs one thing through it, and closes it the way the pipeline does. */
async function inSession<TResult>(
  resources: { sheet: Sheet; images: PdfSourceDocument['images'] },
  run: (session: PdfRenderSession) => Promise<TResult>,
): Promise<TResult> {
  const session = await strategy.open(resources);
  try {
    return await run(session);
  } finally {
    await session.close();
  }
}

const measureOnly = async (source: PdfSourceDocument): Promise<PdfLayoutMeasurement> =>
  await inSession(
    { sheet: source.sheet, images: source.images },
    async (session) => await session.measure(source),
  );

const printOnly = async (source: PdfSourceDocument): Promise<Uint8Array> =>
  await inSession({ sheet: source.sheet, images: source.images }, async (session) => {
    await session.measure(source);
    return await session.print(source);
  });

async function refusalFrom(run: Promise<unknown>): Promise<DocumentRenderError> {
  const caught: unknown = await run.catch((error: unknown) => error);
  if (caught instanceof DocumentRenderError) {
    return caught;
  }
  throw new Error(`expected a refusal, got ${String(caught)}`);
}

/** A hand-written sequence of sheets, for markup the pipeline would not produce. */
function rawPages(bodies: readonly string[], sheet = sheetOf()): string {
  const pages = bodies
    .map(
      (body, index) => `<div class="ov-page" data-openview-page="${index + 1}">
    <div class="ov-printable">
      <div class="ov-band ov-top" data-openview-region="header"></div>
      <div class="ov-flow" data-openview-region="root">${body}</div>
      <div class="ov-band ov-bottom" data-openview-region="footer"></div>
    </div></div>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:${sheet.width}mm ${sheet.height}mm;margin:0}
    html,body{margin:0;padding:0}*{box-sizing:border-box}
    .ov-page{position:relative;width:${sheet.width}mm;height:${sheet.height}mm;overflow:hidden;break-after:page}
    .ov-page:last-child{break-after:auto}
    .ov-printable{position:absolute;top:5mm;left:5mm;width:${sheet.width - 10}mm;height:${sheet.height - 10}mm;display:flex;flex-direction:column}
    .ov-band{flex:0 0 auto;overflow:hidden;display:flex;flex-direction:column}
    .ov-flow{flex:1 1 auto;min-height:0}
    .ov-text{white-space:pre-wrap}
    .ov-marker{display:inline-block;font-kerning:none;font-variant-ligatures:none;vertical-align:baseline}
    .ov-image{display:block;width:100%;height:auto}
  </style></head><body>${pages}</body></html>`;
}

const rawPage = (body: string) => rawPages([body]);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('printing a real document', () => {
  it(
    'produces a readable pdf of exactly one page',
    async () => {
      const { bytes } = await renderCapturing(
        templateOf({ root: { type: 'container', id: 'root', children: [text('t', 'hello')] } }),
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
      const { bytes } = await renderCapturing(
        templateOf({
          page: pageOf(width, height),
          root: { type: 'container', id: 'root', children: [text('t', 'x')] },
        }),
      );
      const { pages, sizes } = await inspectPdf(bytes);
      expect(pages).toBe(1);
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
      const { bytes } = await renderCapturing(
        templateOf({
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
      const { bytes } = await renderCapturing(
        templateOf({ root: { type: 'container', id: 'root', children: [text('t', 'body')] } }),
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
      const { bytes } = await renderCapturing(
        templateOf({
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

describe('one explicit box prints as one page', () => {
  it.each([
    ['one sheet', 1, 60, 60],
    ['two sheets', 2, 60, 60],
    ['four sheets', 4, 210, 297],
    ['three sheets of a custom size', 3, 123.45, 234.56],
  ])(
    'prints %s and adds no blank one after the last',
    async (_label, count, width, height) => {
      const sheet = sheetOf(width, height);
      const bodies = Array.from({ length: count }, (_unused, index) => `<div>page ${index}</div>`);
      const bytes = await printOnly({ html: rawPages(bodies, sheet), sheet, images: [] });
      const { pages, sizes } = await inspectPdf(bytes);
      expect(pages).toBe(count);
      for (const size of sizes) {
        expect(Math.abs(size.width - width * PT_PER_MM)).toBeLessThan(SHEET_TOLERANCE_PT);
        expect(Math.abs(size.height - height * PT_PER_MM)).toBeLessThan(SHEET_TOLERANCE_PT);
      }
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'measures every sheet of the sequence, not only the first',
    async () => {
      const sheet = sheetOf(60, 60);
      const measurement = await measureOnly({
        html: rawPages(['a', 'b', 'c'], sheet),
        sheet,
        images: [],
      });
      expect(measurement.pages).toHaveLength(3);
      for (const page of measurement.pages) {
        expect(page.page.width).toBeCloseTo(page.printable.width + 10 * (96 / 25.4), 0);
        expect(page.regions.map((region) => region.region)).toStrictEqual([
          'header',
          'root',
          'footer',
        ]);
      }
    },
    CHROMIUM_TIMEOUT_MS,
  );
});

describe('measuring in a session that is reused', () => {
  it(
    'returns the same heights for the same content, before and after another document',
    async () => {
      const stable = rawPage(
        '<div data-openview-key="s" data-openview-node="s" class="ov-text">' +
          '<span data-openview-run="0" style="font-family:sans-serif;font-size:3.5mm">measured twice</span></div>',
      );
      const heights = await inSession({ sheet: sheetOf(), images: [] }, async (session) => {
        const first = await session.measure(sourceWith(stable));
        await session.measure(sourceWith(rawPage('<div>something else entirely</div>')));
        const again = await session.measure(sourceWith(stable));
        return [first, again].map(
          (measurement) => measurement.boxes.find((box) => box.key === 's')?.height ?? 0,
        );
      });
      expect(heights[0]).toBeGreaterThan(0);
      expect(Math.abs((heights[0] ?? 0) - (heights[1] ?? 0))).toBeLessThan(0.5);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'answers under exactly the keys the document annotated',
    async () => {
      const measurement = await measureOnly(
        sourceWith(
          rawPage('<div data-openview-key="a">one</div><div data-openview-key="b">two</div>'),
        ),
      );
      expect(measurement.boxes.map((box) => box.key)).toStrictEqual(['a', 'b']);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'refuses to measure once the session is closed',
    async () => {
      const session = await strategy.open({ sheet: sheetOf(), images: [] });
      await session.close();
      const refused = await refusalFrom(session.measure(sourceWith(rawPage('x'))));
      expect(refused.code).toBe('layout-measurement-failed');
    },
    CHROMIUM_TIMEOUT_MS,
  );
});

describe('visual lines come back as reversible cursors', () => {
  const runsOf = (parts: readonly Part[]): string =>
    parts
      .map((part, index) =>
        part.marker === true
          ? `<span class="ov-marker" style="font-family:sans-serif;font-size:3.5mm;width:16px" data-openview-run="${index}">00</span>`
          : `<span style="font-family:sans-serif;font-size:${part.size ?? '3.5mm'}" data-openview-run="${index}">${part.text ?? ''}</span>`,
      )
      .join('');

  /** Concatenating the slices between the reported cursors must restore the runs exactly. */
  const rebuild = (parts: readonly Part[], lines: PdfLayoutMeasurement['lines']): string => {
    const length = (index: number): number =>
      parts[index]?.marker === true ? 1 : (parts[index]?.text?.length ?? 0);
    let from = { run: 0, offset: 0 };
    let rebuilt = '';
    for (const line of lines) {
      for (let index = from.run; index <= line.run; index += 1) {
        const start = index === from.run ? from.offset : 0;
        const end = index === line.run ? line.offset : length(index);
        if (end <= start) {
          continue;
        }
        rebuilt +=
          parts[index]?.marker === true ? '\u0001' : (parts[index]?.text ?? '').slice(start, end);
      }
      from = { run: line.run, offset: line.offset };
    }
    return rebuilt;
  };

  interface Part {
    readonly text?: string;
    readonly marker?: boolean;
    readonly size?: string;
  }

  const CASES: readonly (readonly [string, readonly Part[], number])[] = [
    ['one wrapped sentence', [{ text: 'The quick brown fox jumps over the lazy dog again.' }], 2],
    ['leading and trailing spaces', [{ text: '   padded and trailing spaces follow this    ' }], 2],
    ['a blank line from two newlines', [{ text: 'first\n\nthird line after a blank one' }], 3],
    [
      'a run of another size mid-line',
      [
        { text: 'small text then ' },
        { text: 'BIG TEXT IN THE MIDDLE ', size: '6mm' },
        { text: 'and small again to the end' },
      ],
      3,
    ],
    [
      'combining marks, a surrogate pair and a zwj sequence',
      [{ text: 'école nai\u0308ve 👩‍💻 with 👨‍👩‍👧 and 🇫🇷 over two lines' }],
      2,
    ],
    [
      'a marker between two literals',
      [
        { text: 'page ' },
        { marker: true },
        { text: ' of ' },
        { marker: true },
        { text: ' end of a foot long enough to wrap onto a second line' },
      ],
      2,
    ],
  ] as const;

  it.each(CASES)(
    'slices %s with nothing lost and nothing repeated',
    async (_label, parts, expected) => {
      const sheet = sheetOf(70, 60);
      const html = rawPages(
        [
          `<div class="ov-text" style="padding:2mm 0 3mm 0" data-openview-key="t" data-openview-node="t">${runsOf(parts)}</div>`,
        ],
        sheet,
      );
      const measurement = await measureOnly(sourceWith(html, sheet));
      const lines = measurement.lines.filter((line) => line.key === 't');
      const original = parts
        .map((part) => (part.marker === true ? '\u0001' : (part.text ?? '')))
        .join('');
      expect(rebuild(parts, lines)).toBe(original);
      expect(lines).toHaveLength(expected);
      expect(lines.map((line) => line.index)).toStrictEqual(lines.map((_line, index) => index));
      /* The cursors never go backwards and the heights never shrink, which is what lets one
         fragment start exactly where the one before it stopped. */
      for (const [index, line] of lines.entries()) {
        const previous = lines[index - 1];
        if (previous === undefined) {
          continue;
        }
        expect(line.height).toBeGreaterThanOrEqual(previous.height);
        expect(line.run > previous.run || line.offset > previous.offset).toBe(true);
      }
      const box = measurement.boxes.find((entry) => entry.key === 't');
      expect(lines.at(-1)?.height).toBeGreaterThan(0);
      expect(lines.at(-1)?.height).toBeLessThanOrEqual(box?.height ?? 0);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'reports no line for a block with no run at all',
    async () => {
      const measurement = await measureOnly(
        sourceWith(rawPage('<div class="ov-text" data-openview-key="empty"></div>')),
      );
      expect(measurement.lines).toStrictEqual([]);
      expect(measurement.boxes.map((box) => box.key)).toStrictEqual(['empty']);
    },
    CHROMIUM_TIMEOUT_MS,
  );
});

describe('the reserved width of a page marker', () => {
  it.each([
    ['sans-serif', '3.5mm'],
    ['serif', '2.5mm'],
  ])(
    'bounds every value a document could show in %s at %s',
    async (family, size) => {
      const digits = Array.from(
        { length: 10 },
        (_unused, digit) =>
          `<span class="ov-marker" style="font-family:${family};font-size:${size}" data-openview-key="d${digit}">${digit}</span>`,
      ).join('');
      const measured = await measureOnly(sourceWith(rawPage(digits)));
      const widest = Math.max(...measured.boxes.map((box) => box.width));
      expect(widest).toBeGreaterThan(0);

      const reserve = widest * 3;
      const values = [0, 1, 8, 9, 10, 11, 99, 100, 101, 120];
      const cells = values
        .map(
          (value) =>
            `<div class="ov-text" data-openview-key="v${value}"><span class="ov-marker" style="font-family:${family};font-size:${size};width:${reserve}px" data-openview-run="0">${value}</span></div>`,
        )
        .join('');
      const shown = await measureOnly(sourceWith(rawPage(cells)));
      const heights = new Set(shown.boxes.map((box) => Number(box.height.toFixed(2))));
      /* 9 to 10 and 99 to 100 change the digits and nothing else: same height, same box. */
      expect(heights.size).toBe(1);
      for (const box of shown.boxes) {
        expect(box.width).toBeGreaterThan(0);
      }
    },
    CHROMIUM_TIMEOUT_MS,
  );
});

describe('capability refusals, raised before a browser exists', () => {
  it('refuses a sheet outside the range it was measured on', async () => {
    const refused = await refusalFrom(
      strategy.open({ sheet: { width: MAX_SHEET_MM + 1, height: 100 }, images: [] }),
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
    const refused = await refusalFrom(
      strategy.open({
        sheet: sheetOf(),
        images: [{ nodeId: 'logo', path: ['root', 'children', 0], src }],
      }),
    );
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
      /* Opening at all is the assertion: the sources passed the capability gate. */
      await inSession({ sheet: sheetOf(), images: accepted }, async (session) => {
        const measured = await session.measure({
          html: rawPage(''),
          sheet: sheetOf(),
          images: accepted,
        });
        expect(measured.pages).toHaveLength(1);
      });
    },
    CHROMIUM_TIMEOUT_MS,
  );
});

describe('what the page reports about itself', () => {
  it(
    'reports an image that did not decode instead of leaving it look empty',
    async () => {
      const measurement = await measureOnly({
        html: rawPage(
          `<div data-openview-node="logo"><img class="ov-image" src="${CORRUPT_PNG}" alt="a logo"></div>`,
        ),
        sheet: sheetOf(),
        images: [{ nodeId: 'logo', path: [], src: CORRUPT_PNG }],
      });
      expect(measurement.images).toHaveLength(1);
      expect(measurement.images[0]?.decoded).toBe(false);
      expect(measurement.images[0]?.nodeId).toBe('logo');
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'names a block that paints outside the sheet it belongs to',
    async () => {
      const measurement = await measureOnly(
        sourceWith(
          rawPage(
            '<div data-openview-node="wide" style="position:absolute;left:80mm;top:0;width:20mm;height:5mm"></div>',
          ),
        ),
      );
      expect(measurement.escaping).toStrictEqual(['wide']);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'reports a region whose content reaches past the height it was given',
    async () => {
      const long = Array.from({ length: 60 }, (_unused, index) => `<div>line ${index}</div>`).join(
        '',
      );
      const measurement = await measureOnly(
        sourceWith(rawPage(`<div data-openview-node="long">${long}</div>`)),
      );
      const root = measurement.pages[0]?.regions.find((region) => region.region === 'root');
      expect((root?.contentHeight ?? 0) > (root?.height ?? 0)).toBe(true);
    },
    CHROMIUM_TIMEOUT_MS,
  );
});

describe('what a grid zone reports about its content', () => {
  /** A hand-written two-by-two grid, one zone, with the content the case injects. */
  const gridWith = (zoneContent: string, zoneStyle = ''): string =>
    rawPage(
      '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,10mm)">' +
        `<div data-openview-grid-item="zone-a" style="grid-row:1/span 1;grid-column:1/span 1;min-width:0;min-height:0;position:relative;${zoneStyle}">` +
        `${zoneContent}</div></div>`,
    );

  it(
    'reports nothing for content that stays inside its zone, even exactly at the edge',
    async () => {
      const measurement = await measureOnly(
        sourceWith(gridWith('<div style="height:10mm">x</div>')),
      );
      expect(measurement.overflowingGridItems).toStrictEqual([]);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'reports a vertical overflow by the zone id alone',
    async () => {
      const measurement = await measureOnly(
        sourceWith(gridWith('<div style="height:25mm">a text the reply must not repeat</div>')),
      );
      expect(measurement.overflowingGridItems).toStrictEqual(['zone-a']);
      expect(JSON.stringify(measurement)).not.toContain('a text the reply must not repeat');
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'reports a horizontal overflow, past the padding of the zone',
    async () => {
      const measurement = await measureOnly(
        sourceWith(gridWith('<div style="width:40mm;height:2mm"></div>', 'padding:0 2mm 0 2mm')),
      );
      expect(measurement.overflowingGridItems).toStrictEqual(['zone-a']);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'answers the same observation twice in one session',
    async () => {
      const overflowing = gridWith('<div style="height:25mm"></div>');
      const observations = await inSession({ sheet: sheetOf(), images: [] }, async (session) => {
        const first = await session.measure(sourceWith(overflowing));
        await session.measure(sourceWith(rawPage('<div>elsewhere</div>')));
        const again = await session.measure(sourceWith(overflowing));
        return [first.overflowingGridItems, again.overflowingGridItems];
      });
      expect(observations[0]).toStrictEqual(['zone-a']);
      expect(observations[1]).toStrictEqual(['zone-a']);
    },
    CHROMIUM_TIMEOUT_MS,
  );
});

describe('the page is inert and offline', () => {
  it(
    'runs no script the document carries, on every load of the session',
    async () => {
      const hostile = rawPage(
        '<div data-openview-node="flag" data-openview-key="flag" style="width:10mm;height:5mm"></div>' +
          '<script>document.querySelector("[data-openview-key=flag]").style.height = "50mm";</script>',
      );
      const heights = await inSession({ sheet: sheetOf(), images: [] }, async (session) => {
        const first = await session.measure(sourceWith(hostile));
        await session.measure(sourceWith(rawPage('<div>a different document</div>')));
        const again = await session.measure(sourceWith(hostile));
        return [first, again].map(
          (measurement) => measurement.boxes.find((box) => box.key === 'flag')?.height ?? 0,
        );
      });
      /* 5mm is 18.9 px; had the script run it would read 189. */
      for (const height of heights) {
        expect(height).toBeLessThan(30);
      }
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'aborts a request to a host that is up, on every load of the session',
    async () => {
      /* A reachable origin, so a failed decode really means the request was stopped rather than
         that the address happened to be dead. The server counts what reached it: nothing. */
      const bitmap = Buffer.from(TINY_PNG.split(',')[1] ?? '', 'base64');
      const reached: string[] = [];
      const server = createServer((request, response) => {
        reached.push(request.url ?? '');
        response.writeHead(200, { 'content-type': 'image/png' });
        response.end(bitmap);
      });
      await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', resolve);
      });
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      try {
        expect(port).toBeGreaterThan(0);
        /* The same server, reached directly, does answer: the fixture is not a dead address. */
        expect((await fetch(`http://127.0.0.1:${port}/probe.png`)).status).toBe(200);
        expect(reached).toStrictEqual(['/probe.png']);

        const html = rawPage(
          `<div data-openview-node="i"><img class="ov-image" src="http://127.0.0.1:${port}/logo.png"></div>`,
        );
        const decoded = await inSession({ sheet: sheetOf(), images: [] }, async (session) => {
          const first = await session.measure(sourceWith(html));
          await session.measure(sourceWith(rawPage('<div>elsewhere</div>')));
          const again = await session.measure(sourceWith(html));
          return [first, again].map((measurement) => measurement.images[0]?.decoded);
        });
        expect(decoded).toStrictEqual([false, false]);
        /* Nothing but the direct probe ever reached the server, on either load. */
        expect(reached).toStrictEqual(['/probe.png']);
      } finally {
        await new Promise<void>((resolve) => {
          server.close(() => {
            resolve();
          });
        });
      }
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'lets an embedded bitmap through, so the refusal above is a policy and not a failure',
    async () => {
      const measurement = await measureOnly({
        html: rawPage(`<div data-openview-node="i"><img class="ov-image" src="${TINY_PNG}"></div>`),
        sheet: sheetOf(),
        images: [{ nodeId: 'i', path: [], src: TINY_PNG }],
      });
      expect(measurement.images[0]?.decoded).toBe(true);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'refuses an image source the document smuggled past the resources it opened on',
    async () => {
      const refused = await refusalFrom(
        inSession(
          { sheet: sheetOf(), images: [] },
          async (session) =>
            await session.measure({
              html: rawPage(''),
              sheet: sheetOf(),
              images: [{ nodeId: 'late', path: [], src: 'http://example.test/late.png' }],
            }),
        ),
      );
      expect(refused.code).toBe('unsupported-image-source');
      expect(refused.details.nodeId).toBe('late');
    },
    CHROMIUM_TIMEOUT_MS,
  );
});

describe('resource lifetime', () => {
  it(
    'launches one browser for a whole render and closes it afterwards',
    async () => {
      const launched: { connected: boolean }[] = [];
      const seen: (readonly string[] | undefined)[] = [];
      const launch = puppeteer.launch.bind(puppeteer);
      vi.spyOn(puppeteer, 'launch').mockImplementation(async (options) => {
        seen.push(options?.args);
        const browser = await launch(options);
        launched.push(browser);
        return browser;
      });
      const { measured } = await renderCapturing(
        templateOf({ root: { type: 'container', id: 'root', children: [text('t', 'x')] } }),
      );
      /* Several measurements, one browser: the cuts and the print share one set of fonts. */
      expect(measured.length).toBeGreaterThan(1);
      expect(launched).toHaveLength(1);
      expect(launched[0]?.connected).toBe(false);
      /* The launch arguments the caller asked for reach the browser, and the ones it did not ask
         for are absent: the strategy adds none of its own, and the sandbox stays on by default. */
      expect(seen[0]).toStrictEqual(HOST_LAUNCH_OPTIONS.args);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it('names no launch argument of its own, so the sandbox an integrator gets stays on', async () => {
    const seen: unknown[] = [];
    vi.spyOn(puppeteer, 'launch').mockImplementation((options) => {
      seen.push(options);
      return Promise.reject(new Error('this launch is observed, not performed'));
    });
    await createPuppeteerPdfStrategy()
      .open({ sheet: sheetOf(), images: [] })
      .catch(() => undefined);
    /* Exactly this, and nothing more: no `args`, so Chromium keeps its own sandbox, and no
       `executablePath`, so it keeps the build the install pinned. Dropping the sandbox is a
       decision only a caller can take, and only for a host that cannot provide one. */
    expect(seen).toStrictEqual([{ headless: true }]);
  });

  it(
    'closes the browser after a refusal raised mid-render',
    async () => {
      const launched: { connected: boolean }[] = [];
      const launch = puppeteer.launch.bind(puppeteer);
      vi.spyOn(puppeteer, 'launch').mockImplementation(async (options) => {
        const browser = await launch(options);
        launched.push(browser);
        return browser;
      });
      await refusalFrom(
        renderCapturing(
          templateOf({
            page: pageOf(60, 60),
            root: {
              type: 'container',
              id: 'root',
              children: [{ type: 'image', id: 'tall', src: CORRUPT_PNG }],
            },
          }),
        ),
      );
      expect(launched[0]?.connected).toBe(false);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it('launches no browser at all when a capability refuses first', async () => {
    const spy = vi.spyOn(puppeteer, 'launch');
    await refusalFrom(
      strategy.open({
        sheet: sheetOf(),
        images: [{ nodeId: 'logo', path: [], src: 'http://example.test/a.png' }],
      }),
    );
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('unit conversion', () => {
  it('uses the conversion of core rather than a second constant', () => {
    expect(mmFromPt(72)).toBeCloseTo(25.4, 12);
    expect(SHEET_TOLERANCE_PT).toBeGreaterThan(0.24);
  });

  it(
    'refuses an image too tall for the flow rather than scaling it',
    async () => {
      /* 120x40 across a 56 mm content width is 18.7 mm tall, on a flow 16 mm high. An image is
         atomic: no page can hold it, and it is neither cut nor scaled down to fit. */
      const refused = await refusalFrom(
        renderCapturing(
          templateOf({
            page: pageOf(60, 20, 2),
            root: {
              type: 'container',
              id: 'root',
              children: [{ type: 'image', id: 'tall', src: LOGO_PNG, alt: 'a wide mark' }],
            },
          }),
        ),
      );
      expect(refused.code).toBe('oversized-atomic-resource');
      expect(refused.details.nodeId).toBe('tall');
    },
    CHROMIUM_TIMEOUT_MS,
  );
});
