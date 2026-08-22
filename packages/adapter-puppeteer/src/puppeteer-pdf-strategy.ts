import type { PdfRenderStrategy, PdfSourceDocument } from '@openview/engine';
import puppeteer, { type Browser, type BrowserContext, type Page } from 'puppeteer';
import { assertHonouredSheet } from './capability.js';
import { assertPrintableImages } from './image-source.js';
import { assertFits, measureInPage } from './measure.js';

/**
 * Print options, every one of them stated.
 *
 * `preferCSSPageSize` is what makes the sheet come from the template: without it Chromium prints
 * Letter whatever `@page` says. `printBackground` keeps fills and rules. `displayHeaderFooter` stays
 * off because the bands belong to the model. No `path`, so the bytes are returned without a
 * temporary file, and no `format`, because this adapter decides no sheet.
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

export interface PuppeteerPdfStrategyOptions {
  /** Chromium executable, when the host pins its own build instead of the downloaded one. */
  readonly executablePath?: string | undefined;
  /** Extra launch arguments, for a sandbox a container needs configured differently. */
  readonly args?: readonly string[] | undefined;
}

/**
 * Aborts every request the page attempts.
 *
 * The handler stays synchronous and checks `isInterceptResolutionHandled`, as the interception guide
 * requires. `data:` URIs are let through because they raise no request in the first place, and
 * about:blank is the document the page starts on.
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

async function printInPage(page: Page, source: PdfSourceDocument): Promise<Uint8Array> {
  /* Scripting off before anything loads. `page.evaluate` still works -- it is a debugger call, not
     page script -- so the document stays inert while the adapter can still measure it. */
  await page.setJavaScriptEnabled(false);
  await refuseNetwork(page);
  await page.setContent(source.html, { waitUntil: 'load' });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  assertFits(await page.evaluate(measureInPage));
  return await page.pdf(PDF_OPTIONS);
}

async function printInContext(
  context: BrowserContext,
  source: PdfSourceDocument,
): Promise<Uint8Array> {
  const page = await context.newPage();
  try {
    return await printInPage(page, source);
  } finally {
    await page.close();
  }
}

async function printInBrowser(browser: Browser, source: PdfSourceDocument): Promise<Uint8Array> {
  const context = await browser.createBrowserContext();
  try {
    return await printInContext(context, source);
  } finally {
    await context.close();
  }
}

/**
 * The Chromium print backend behind the engine's pdf port.
 *
 * One browser per render, and page, context and browser are all closed in a `finally`: this trades
 * throughput for the absence of a leak and for a semantics with no shared state. Pooling,
 * concurrency ceilings and timeouts belong to the hardening that comes with remote resources.
 */
export function createPuppeteerPdfStrategy(
  options?: PuppeteerPdfStrategyOptions | undefined,
): PdfRenderStrategy {
  return {
    format: 'pdf',
    async render(source: PdfSourceDocument): Promise<Uint8Array> {
      /* Both refusals happen before a browser exists, which is what "refused before loading" has to
         mean for a source this backend cannot print. */
      assertHonouredSheet(source.sheet);
      assertPrintableImages(source.images);
      const browser = await puppeteer.launch({
        headless: true,
        ...(options?.executablePath === undefined
          ? {}
          : { executablePath: options.executablePath }),
        ...(options?.args === undefined ? {} : { args: [...options.args] }),
      });
      try {
        return await printInBrowser(browser, source);
      } finally {
        await browser.close();
      }
    },
  };
}
