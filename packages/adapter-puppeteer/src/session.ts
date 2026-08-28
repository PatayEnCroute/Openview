import {
  DocumentRenderError,
  type PdfLayoutMeasurement,
  type PdfRenderResources,
  type PdfRenderSession,
  type PdfSourceDocument,
} from '@openview/engine';
import puppeteer, { type Browser, type BrowserContext, type Page } from 'puppeteer';
import { canonicalizePdf } from './canonicalize-pdf.js';
import { assertHonouredSheet } from './capability.js';
import { deriveMeasurement } from './derive.js';
import { assertPrintableImages } from './image-source.js';
import { collectInPage } from './measure.js';

/**
 * Explicit Puppeteer PDF generation options ensuring CSS page dimensions and backgrounds are preserved.
 *
 * @see https://pptr.dev/api/puppeteer.pdfoptions
 */
export const PDF_OPTIONS = {
  preferCSSPageSize: true,
  printBackground: true,
  displayHeaderFooter: false,
  scale: 1,
  waitForFonts: true,
} as const;

export interface PuppeteerLaunchOptions {
  /** Chromium executable, when the host pins its own build instead of the downloaded one. */
  readonly executablePath?: string | undefined;
  /** Extra launch arguments, for a sandbox a container needs configured differently. */
  readonly args?: readonly string[] | undefined;
}

const FONT_NOT_LOADED =
  'A face the document embeds did not load in the browser, so the layout would have been measured in whatever font the machine offers instead. Read `details.limit` for how many faces the document declared.';

const AFTER_CLOSE =
  'This layout session is closed. A session belongs to one render, and reopening a browser mid-render would measure a document in one environment and print it in another.';

/**
 * Aborts external network requests while allowing inline data URIs and blank documents.
 *
 * @see https://pptr.dev/guides/network-interception
 */
async function refuseNetwork(page: Page): Promise<void> {
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.isInterceptResolutionHandled()) {
      return;
    }
    const url = request.url();
    /* Deliberately not awaited: the interception handler must stay synchronous, and Puppeteer owns
       the lifetime of the resolution it returns. */
    if (url.startsWith('data:') || url === 'about:blank') {
      void request.continue();
      return;
    }
    void request.abort();
  });
}

/**
 * Opens a dedicated browser session for layout measurement and PDF printing during a single render.
 */
export async function openPuppeteerSession(
  resources: PdfRenderResources,
  options?: PuppeteerLaunchOptions | undefined,
): Promise<PdfRenderSession> {
  /* Both refusals happen before a browser exists, which is what "refused before loading" has to
     mean for a source this backend cannot print. */
  assertHonouredSheet(resources.sheet);
  assertPrintableImages(resources.images);

  const browser = await puppeteer.launch({
    headless: true,
    ...(options?.executablePath === undefined ? {} : { executablePath: options.executablePath }),
    ...(options?.args === undefined ? {} : { args: [...options.args] }),
  });
  let context: BrowserContext;
  let page: Page;
  try {
    context = await browser.createBrowserContext();
  } catch (error) {
    await browser.close();
    throw error;
  }
  try {
    page = await context.newPage();
    /* Scripting off before anything loads. `page.evaluate` still works -- it is a debugger call, not
       page script -- so the document stays inert while the adapter can still measure it. */
    await page.setJavaScriptEnabled(false);
    await refuseNetwork(page);
  } catch (error) {
    await closeAll(browser, context, undefined);
    throw error;
  }

  let closed = false;
  let loaded: string | undefined;

  const load = async (source: PdfSourceDocument): Promise<void> => {
    if (closed) {
      throw new DocumentRenderError(AFTER_CLOSE, 'layout-measurement-failed');
    }
    assertPrintableImages(source.images);
    if (loaded === source.html) {
      return;
    }
    await page.setContent(source.html, { waitUntil: 'load' });
    const faces = await page.evaluate(async () => {
      /* Forced, not awaited: a declared face the current page does not happen to paint stays
         `unloaded` for ever, so `fonts.ready` alone proves nothing about its bytes. Loading each
         one turns a corrupt face or a refused uri into an observable failure here. */
      const declared = [...document.fonts];
      const settled = await Promise.allSettled(declared.map(async (face) => await face.load()));
      await document.fonts.ready;
      /* Only counts travel back: the family names belong to the document, not to this adapter. */
      return {
        declared: declared.length,
        broken:
          settled.filter((one) => one.status === 'rejected').length +
          declared.filter((face) => face.status !== 'loaded').length,
      };
    });
    if (faces.broken > 0) {
      throw new DocumentRenderError(FONT_NOT_LOADED, 'layout-measurement-failed', {
        limit: faces.declared,
      });
    }
    loaded = source.html;
  };

  return {
    async measure(source: PdfSourceDocument): Promise<PdfLayoutMeasurement> {
      await load(source);
      return deriveMeasurement(await page.evaluate(collectInPage));
    },
    async print(source: PdfSourceDocument): Promise<Uint8Array> {
      /* The same html the last measurement ran on stays loaded, so the bytes are the layout that
         was proved rather than a second one that happens to look like it. */
      await load(source);
      /* Canonicalised before it leaves: the raw file carries the instant of printing and the
         browser's own name, so two identical renders a second apart would differ. No caller can
         reach the unnormalised bytes through this port. */
      return await canonicalizePdf(await page.pdf(PDF_OPTIONS));
    },
    async close(): Promise<void> {
      closed = true;
      await closeAll(browser, context, page);
    },
  };
}

async function closeAll(
  browser: Browser,
  context: BrowserContext,
  page: Page | undefined,
): Promise<void> {
  try {
    if (page !== undefined) {
      await page.close();
    }
  } finally {
    try {
      await context.close();
    } finally {
      await browser.close();
    }
  }
}
