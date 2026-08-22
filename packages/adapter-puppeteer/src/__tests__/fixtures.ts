import {
  CURRENT_SCHEMA_VERSION,
  type EvaluationScope,
  parseTemplate,
  STANDARD_SHEETS_MM,
} from '@openview/core';
import { createPdfRenderPort, type PdfSourceDocument } from '@openview/engine';
import { PDFDocument } from 'pdf-lib';
import {
  createPuppeteerPdfStrategy,
  type PuppeteerPdfStrategyOptions,
} from '../puppeteer-pdf-strategy.js';

/**
 * Launch options the HOST needs, decided by the caller and never by the strategy.
 *
 * Chromium's own sandbox needs unprivileged user namespaces, and the Ubuntu image the pipeline runs
 * on restricts them through AppArmor: the browser aborts with "No usable sandbox" before a single
 * test runs. `--no-sandbox` is the documented answer for a runner that is already an ephemeral
 * isolated container rendering nothing but these fixtures.
 *
 * It stays HERE, in the tests, and is not the default of `createPuppeteerPdfStrategy`. Printing a
 * template is executing arbitrary content, so the process boundary is a real defence: trading it
 * away for every integrator in order to turn a pipeline green would be exactly the wrong move. A
 * local run therefore keeps the sandbox an integrator gets, and only a host that cannot provide one
 * asks for it to be dropped.
 *
 * `CI` is set by the runner itself, so no workflow had to be edited to say this.
 */
export const HOST_LAUNCH_OPTIONS: PuppeteerPdfStrategyOptions =
  process.env.CI === undefined ? {} : { args: ['--no-sandbox'] };

/** The strategy under test, launched the way this host can launch a browser. */
export const hostStrategy = () => createPuppeteerPdfStrategy(HOST_LAUNCH_OPTIONS);

/** A valid 4x2 navy png. */
export const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAIAAADwyuo0AAAAEElEQVR4nGOQtsqHIwZkDgBNGgYhi5XcagAAAABJRU5ErkJggg==';

/** A valid 120x40 navy png, sized like a small logo. */
export const LOGO_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAAoCAIAAAC6iKlyAAAAZklEQVR4nO3QQQkAIADAQHvYxFL2/9lCYR4swLgx19aFxvODTwINuhVo0K1Ag24FGnQr0KBbgQbdCjToVqBBtwINuhVo0K1Ag24FGnQr0KBbgQbdCjToVqBBtwINuhVo0K1Ag251AEd4W9Pz3UCaAAAAAElFTkSuQmCC';

/** Base64 whose bytes are not an image at all. */
export const CORRUPT_PNG = 'data:image/png;base64,QUJD';

const A4_PAGE = {
  sheet: { ...STANDARD_SHEETS_MM.a4 },
  margins: { top: 10, right: 10, bottom: 10, left: 10 },
  header: [],
  footer: [],
};

/**
 * Builds the source document the strategy will receive, through the engine's public port.
 *
 * The html therefore is the html the pipeline really produces, rather than a hand-written page that
 * would prove the adapter works on markup nothing generates.
 */
export async function sourceOf(
  overrides: Record<string, unknown> = {},
  data: EvaluationScope = {},
): Promise<PdfSourceDocument> {
  const calls: PdfSourceDocument[] = [];
  const port = createPdfRenderPort({
    format: 'pdf',
    render(source: PdfSourceDocument): Promise<Uint8Array> {
      calls.push(source);
      return Promise.resolve(new Uint8Array());
    },
  });
  await port.render({
    template: parseTemplate({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: 'tpl_adapter',
      name: 'Adapter fixture',
      version: '1.0.0',
      page: A4_PAGE,
      root: { type: 'container', id: 'root', children: [] },
      ...overrides,
    }),
    data,
  });
  const [source] = calls;
  if (source === undefined) {
    throw new Error('the pipeline produced no source document');
  }
  return source;
}

/** A page setup with a declared sheet and no band. */
export function pageOf(width: number, height: number, margin = 10): Record<string, unknown> {
  return {
    sheet: { width, height },
    margins: { top: margin, right: margin, bottom: margin, left: margin },
    header: [],
    footer: [],
  };
}

export const text = (id: string, value: string): Record<string, unknown> => ({
  type: 'text',
  id,
  content: [{ kind: 'literal', text: value }],
});

/** Page count and page sizes in points, read from the real bytes. */
export async function inspectPdf(
  bytes: Uint8Array,
): Promise<{ pages: number; sizes: readonly { width: number; height: number }[] }> {
  const pdf = await PDFDocument.load(bytes);
  return {
    pages: pdf.getPageCount(),
    sizes: pdf.getPages().map((page) => page.getSize()),
  };
}
