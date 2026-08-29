import {
  type DocumentImage,
  DocumentRenderError,
  type PdfLayoutMeasurement,
  type PdfRenderResources,
  type PdfRenderSession,
  type PdfSourceDocument,
  type ResolvedDocumentImage,
} from '@openview/engine';
import type { Browser, BrowserContext, Page } from 'puppeteer';
import { launchBrowser, type PuppeteerLaunchOptions } from './browser.js';
import { canonicalizePdf } from './canonicalize-pdf.js';
import { assertHonouredSheet } from './capability.js';
import { deriveMeasurement } from './derive.js';
import { assertInlineSources, assertPrintableImages } from './image-source.js';
import { collectInPage } from './measure.js';
import { assertCanonicalSize, readBoundedPdf } from './pdf-stream.js';
import { DEFAULT_RESOURCE_LIMITS, type ProtectedResourceLimits } from './resource/types.js';

export type { PuppeteerLaunchOptions } from './browser.js';

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

const FONT_NOT_LOADED =
  'A face the document embeds did not load in the browser, so the layout would have been measured in whatever font the machine offers instead. Read `details.limit` for how many faces the document declared.';

const AFTER_CLOSE =
  'This layout session is closed. A session belongs to one render, and reopening a browser mid-render would measure a document in one environment and print it in another.';

/**
 * How a session decides what each image occurrence really loads.
 *
 * The direct path answers with the stored source, once it has refused everything it cannot print.
 * The hardened runtime answers with bytes it fetched, checked and embedded itself.
 */
export interface SessionImagePolicy {
  resolve(images: readonly DocumentImage[]): Promise<readonly ResolvedDocumentImage[]>;
}

/**
 * The policy of the direct path: print the inline source the template stored, and nothing else.
 *
 * Identical to what this backend has always accepted, which is what keeps a document rendered
 * through the direct path byte for byte the document the hardened runtime produces.
 */
export function embeddedImagePolicy(): SessionImagePolicy {
  return {
    resolve(images: readonly DocumentImage[]): Promise<readonly ResolvedDocumentImage[]> {
      assertPrintableImages(images);
      return Promise.resolve(images.map((image) => ({ key: image.key, src: image.src })));
    },
  };
}

/** What a context session needs beyond the browser that hosts it. */
export interface ContextSessionOptions {
  readonly images: SessionImagePolicy;
  readonly limits?: ProtectedResourceLimits | undefined;
}

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
 * Opens one render's context inside a browser the caller owns.
 *
 * The context, not the browser, is what a render owns: cookies, cache, storage and service workers
 * belong to it, so a fresh one per render is what keeps two callers from sharing anything, while
 * the process itself can be kept and reused.
 */
export async function openContextSession(
  browser: Browser,
  resources: PdfRenderResources,
  options: ContextSessionOptions,
): Promise<PdfRenderSession> {
  /* Before a context exists, which is what "refused before loading" has to mean for a sheet this
     backend was never measured on. */
  assertHonouredSheet(resources.sheet);
  const limits = options.limits ?? DEFAULT_RESOURCE_LIMITS;

  const context = await browser.createBrowserContext();
  let page: Page;
  try {
    page = await context.newPage();
    /* Scripting off before anything loads. `page.evaluate` still works -- it is a debugger call, not
       page script -- so the document stays inert while the adapter can still measure it. */
    await page.setJavaScriptEnabled(false);
    await refuseNetwork(page);
  } catch (error) {
    await closeContext(context, undefined);
    throw error;
  }

  let closed = false;
  let loaded: string | undefined;

  const load = async (source: PdfSourceDocument): Promise<void> => {
    if (closed) {
      throw new DocumentRenderError(AFTER_CLOSE, 'layout-measurement-failed');
    }
    /* The session resolved these, and nothing but an inline bitmap may reach a page: the check
       is repeated here so that a backend which stopped embedding stops the render rather than
       relying on the policy header to catch it. */
    assertInlineSources(source.images);
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
    async resolveImages(
      images: readonly DocumentImage[],
    ): Promise<readonly ResolvedDocumentImage[]> {
      return await options.images.resolve(images);
    },
    async measure(source: PdfSourceDocument): Promise<PdfLayoutMeasurement> {
      await load(source);
      return deriveMeasurement(await page.evaluate(collectInPage));
    },
    async print(source: PdfSourceDocument): Promise<Uint8Array> {
      /* The same html the last measurement ran on stays loaded, so the bytes are the layout that
         was proved rather than a second one that happens to look like it. */
      await load(source);
      const raw = await readBoundedPdf(
        await page.createPDFStream(PDF_OPTIONS),
        limits.maxRawPdfBytes,
      );
      /* Canonicalised before it leaves: the raw file carries the instant of printing and the
         browser's own name, so two identical renders a second apart would differ. No caller can
         reach the unnormalised bytes through this port. */
      return assertCanonicalSize(await canonicalizePdf(raw), limits.maxCanonicalPdfBytes);
    },
    async close(): Promise<void> {
      closed = true;
      await closeContext(context, page);
    },
  };
}

/**
 * Opens a dedicated browser session for layout measurement and PDF printing during a single render.
 *
 * One browser per render, closed with the session: the direct path is for an integrator who
 * controls its own input, and it keeps the lifetime that has always been proved for it.
 */
export async function openPuppeteerSession(
  resources: PdfRenderResources,
  options?: PuppeteerLaunchOptions | undefined,
): Promise<PdfRenderSession> {
  /* Both refusals happen before a browser exists, which is what "refused before loading" has to
     mean for a source this backend cannot print. */
  assertHonouredSheet(resources.sheet);
  assertPrintableImages(resources.images);

  const browser = await launchBrowser(options);
  let session: PdfRenderSession;
  try {
    session = await openContextSession(browser, resources, { images: embeddedImagePolicy() });
  } catch (error) {
    await browser.close();
    throw error;
  }
  return {
    resolveImages: session.resolveImages.bind(session),
    measure: session.measure.bind(session),
    print: session.print.bind(session),
    async close(): Promise<void> {
      try {
        await session.close();
      } finally {
        await browser.close();
      }
    },
  };
}

async function closeContext(context: BrowserContext, page: Page | undefined): Promise<void> {
  try {
    if (page !== undefined) {
      await page.close();
    }
  } finally {
    await context.close();
  }
}
