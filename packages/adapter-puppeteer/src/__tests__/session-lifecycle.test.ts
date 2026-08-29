import { MAX_SHEET_MM, MIN_SHEET_MM, type Sheet } from '@openview/core';
import { DocumentRenderError, type PdfRenderResources } from '@openview/engine';
import { PDFDocument } from 'pdf-lib';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assertHonouredSheet } from '../capability.js';

const launch = vi.hoisted(() => vi.fn());

vi.mock('puppeteer', () => ({ default: { launch } }));

const { openPuppeteerSession } = await import('../session.js');

const A4: Sheet = { width: 210, height: 297 };

/**
 * One real, minimal pdf for the fake browser to answer with.
 *
 * `print()` canonicalises what the page hands back, so a handful of arbitrary bytes would fail to
 * parse and hide the lifecycle behaviour these tests are about.
 */
const ONE_PAGE_PDF: Uint8Array = await (async () => {
  const document = await PDFDocument.create();
  document.addPage([595, 842]);
  return await document.save();
})();

const RESOURCES: PdfRenderResources = { sheet: A4, images: [] };

/** One observation a mocked page answers with: one sheet, nothing painted in it. */
const OBSERVATION = {
  pages: [
    {
      rect: { top: 0, left: 0, right: 800, bottom: 1100, width: 800, height: 1100 },
      printable: { top: 40, left: 40, right: 760, bottom: 1060, width: 720, height: 1020 },
      regions: (['header', 'root', 'footer'] as const).map((region) => ({
        region,
        rect: { top: 40, left: 40, right: 760, bottom: 100, width: 720, height: 60 },
        contentBottom: 40,
      })),
    },
  ],
  boxes: [],
  images: [],
  nodes: [],
  gridItems: [],
  markers: [],
};

/** What the font probe answers with when every declared face loaded. */
const FONTS_LOADED = { declared: 12, broken: 0 };

interface Recorder {
  readonly closedBrowser: () => number;
  readonly closedContext: () => number;
  readonly closedPage: () => number;
  readonly setContent: () => number;
  readonly requestHandler: () => ((request: unknown) => void) | undefined;
  readonly launchArguments: () => Record<string, unknown> | undefined;
}

/** A puppeteer whose every step succeeds, unless a step is told to fail. */
function fakePuppeteer(
  failing: 'context' | 'page' | 'none' = 'none',
  fonts: { declared: number; broken: number } = FONTS_LOADED,
): Recorder {
  let closedBrowser = 0;
  let closedContext = 0;
  let closedPage = 0;
  let setContent = 0;
  let requestHandler: ((request: unknown) => void) | undefined;
  let launchArguments: Record<string, unknown> | undefined;

  const page = {
    setJavaScriptEnabled: async () => undefined,
    setRequestInterception: async () => undefined,
    on: (event: string, handler: (request: unknown) => void) => {
      if (event === 'request') {
        requestHandler = handler;
      }
    },
    setContent: async () => {
      setContent += 1;
    },
    /* `load()` evaluates two different functions -- the font probe, then the collector -- and
       answering the same value to both would leave `broken` undefined, so the guard would never
       fire and these tests would pass by stepping around it. Told apart by what the serialised
       source reads, rather than by a call counter that a reordering would silently break. */
    evaluate: async (fn: unknown) => {
      if (typeof fn !== 'function') {
        return undefined;
      }
      return String(fn).includes('document.fonts') ? fonts : OBSERVATION;
    },
    /* The printer reads a stream now, so the fake hands one back: a `pdf()` that answered bytes
       would leave the bounded reader untested on the very path it guards. */
    createPDFStream: async () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(ONE_PAGE_PDF);
          controller.close();
        },
      }),
    close: async () => {
      closedPage += 1;
    },
  };
  const context = {
    newPage: async () => {
      if (failing === 'page') {
        throw new Error('no page');
      }
      return page;
    },
    close: async () => {
      closedContext += 1;
    },
  };
  launch.mockImplementation(async (options: Record<string, unknown>) => {
    launchArguments = options;
    return {
      createBrowserContext: async () => {
        if (failing === 'context') {
          throw new Error('no context');
        }
        return context;
      },
      close: async () => {
        closedBrowser += 1;
      },
    };
  });
  return {
    closedBrowser: () => closedBrowser,
    closedContext: () => closedContext,
    closedPage: () => closedPage,
    setContent: () => setContent,
    requestHandler: () => requestHandler,
    launchArguments: () => launchArguments,
  };
}

beforeEach(() => {
  launch.mockReset();
});

describe('the sheet range this backend answers for', () => {
  it('refuses a sheet below the contract minimum, naming the bound it crossed', () => {
    let refused: DocumentRenderError | undefined;
    try {
      assertHonouredSheet({ width: MIN_SHEET_MM - 0.5, height: 297 });
    } catch (error: unknown) {
      refused = error instanceof DocumentRenderError ? error : undefined;
    }
    expect(refused?.code).toBe('adapter-capability-mismatch');
    expect(refused?.details.limit).toBe(MIN_SHEET_MM);
  });

  it('refuses a height above the maximum as readily as a width', () => {
    let refused: DocumentRenderError | undefined;
    try {
      assertHonouredSheet({ width: 210, height: MAX_SHEET_MM + 1 });
    } catch (error: unknown) {
      refused = error instanceof DocumentRenderError ? error : undefined;
    }
    expect(refused?.details.limit).toBe(MAX_SHEET_MM);
  });

  it('accepts both bounds themselves', () => {
    expect(() => assertHonouredSheet({ width: MIN_SHEET_MM, height: MAX_SHEET_MM })).not.toThrow();
  });
});

describe('what a session closes when it cannot finish opening', () => {
  it('closes the browser when no context can be created, and reports the cause', async () => {
    const fake = fakePuppeteer('context');
    await expect(openPuppeteerSession(RESOURCES)).rejects.toThrow('no context');
    expect(fake.closedBrowser()).toBe(1);
    expect(fake.closedContext()).toBe(0);
  });

  it('closes the context and the browser when no page can be opened', async () => {
    const fake = fakePuppeteer('page');
    await expect(openPuppeteerSession(RESOURCES)).rejects.toThrow('no page');
    expect(fake.closedContext()).toBe(1);
    expect(fake.closedBrowser()).toBe(1);
    expect(fake.closedPage()).toBe(0);
  });

  it('closes page, context and browser when the session is closed', async () => {
    const fake = fakePuppeteer();
    const session = await openPuppeteerSession(RESOURCES);
    await session.close();
    expect([fake.closedPage(), fake.closedContext(), fake.closedBrowser()]).toStrictEqual([
      1, 1, 1,
    ]);
  });

  it('refuses to measure after close rather than reopening a browser mid-render', async () => {
    fakePuppeteer();
    const session = await openPuppeteerSession(RESOURCES);
    await session.close();
    const source = { html: '<html></html>', sheet: A4, images: [] };
    await expect(session.measure(source)).rejects.toThrow(DocumentRenderError);
  });
});

describe('the faces the browser reports', () => {
  it('measures a document whose every declared face loaded', async () => {
    fakePuppeteer();
    const session = await openPuppeteerSession(RESOURCES);
    await expect(
      session.measure({ html: '<html></html>', sheet: A4, images: [] }),
    ).resolves.toBeDefined();
    await session.close();
  });

  it.each([
    ['one face of twelve', { declared: 12, broken: 1 }],
    ['every face', { declared: 12, broken: 12 }],
    ['the only face', { declared: 1, broken: 1 }],
  ])('refuses to measure when %s failed to load', async (_name, fonts) => {
    /* Without this the browser would lay the document out in whatever the machine has installed,
       which is the substitution the engine embeds its own faces to prevent. */
    fakePuppeteer('none', fonts);
    const session = await openPuppeteerSession(RESOURCES);
    const refused = session.measure({ html: '<html></html>', sheet: A4, images: [] });
    await expect(refused).rejects.toThrow(DocumentRenderError);
    await expect(refused).rejects.toThrow(/did not load in the browser/);
    await session.close();
  });

  it('refuses to print, not only to measure, when a face failed to load', async () => {
    fakePuppeteer('none', { declared: 12, broken: 1 });
    const session = await openPuppeteerSession(RESOURCES);
    await expect(session.print({ html: '<html></html>', sheet: A4, images: [] })).rejects.toThrow(
      DocumentRenderError,
    );
    await session.close();
  });

  it('names how many faces the document declared, and nothing of the document', async () => {
    fakePuppeteer('none', { declared: 7, broken: 2 });
    const session = await openPuppeteerSession(RESOURCES);
    let refused: DocumentRenderError | undefined;
    try {
      await session.measure({ html: '<html>secret</html>', sheet: A4, images: [] });
    } catch (error: unknown) {
      refused = error instanceof DocumentRenderError ? error : undefined;
    }
    expect(refused?.code).toBe('layout-measurement-failed');
    expect(refused?.details.limit).toBe(7);
    expect(`${refused?.message} ${JSON.stringify(refused?.details)}`).not.toContain('secret');
    await session.close();
  });
});

describe('what a session reloads, and what it does not', () => {
  it('keeps the same html loaded rather than setting it a second time', async () => {
    const fake = fakePuppeteer();
    const session = await openPuppeteerSession(RESOURCES);
    const source = { html: '<html>one</html>', sheet: A4, images: [] };
    await session.measure(source);
    await session.measure(source);
    await session.print(source);
    expect(fake.setContent()).toBe(1);
    await session.measure({ ...source, html: '<html>two</html>' });
    expect(fake.setContent()).toBe(2);
    await session.close();
  });
});

describe('the launch options the session passes on', () => {
  it('passes neither an executable nor arguments when the caller declared none', async () => {
    const fake = fakePuppeteer();
    const session = await openPuppeteerSession(RESOURCES);
    expect(fake.launchArguments()).toStrictEqual({ headless: true });
    await session.close();
  });

  it('passes the executable and the arguments a host pinned', async () => {
    const fake = fakePuppeteer();
    const session = await openPuppeteerSession(RESOURCES, {
      executablePath: '/opt/chrome',
      args: ['--no-sandbox'],
    });
    expect(fake.launchArguments()).toStrictEqual({
      headless: true,
      executablePath: '/opt/chrome',
      args: ['--no-sandbox'],
    });
    await session.close();
  });
});

describe('the network the page is allowed to reach', () => {
  /** One request as the interception handler sees it, with what it was asked to do recorded. */
  function requestOf(url: string, handled = false) {
    const done: string[] = [];
    return {
      done,
      request: {
        isInterceptResolutionHandled: () => handled,
        url: () => url,
        continue: async () => {
          done.push('continue');
        },
        abort: async () => {
          done.push('abort');
        },
      },
    };
  }

  it('lets an embedded data uri and a blank document through, and aborts everything else', async () => {
    const fake = fakePuppeteer();
    const session = await openPuppeteerSession(RESOURCES);
    const handler = fake.requestHandler();
    expect(handler).toBeDefined();
    for (const [url, expected] of [
      ['data:image/png;base64,AAAA', 'continue'],
      ['about:blank', 'continue'],
      ['https://example.test/logo.png', 'abort'],
      ['file:///etc/passwd', 'abort'],
      ['http://169.254.169.254/latest/meta-data/', 'abort'],
    ] as const) {
      const { done, request } = requestOf(url);
      handler?.(request);
      await Promise.resolve();
      expect(done).toStrictEqual([expected]);
    }
    await session.close();
  });

  it('leaves a request another handler already resolved alone', async () => {
    const fake = fakePuppeteer();
    const session = await openPuppeteerSession(RESOURCES);
    const { done, request } = requestOf('https://example.test/logo.png', true);
    fake.requestHandler()?.(request);
    await Promise.resolve();
    expect(done).toStrictEqual([]);
    await session.close();
  });
});
