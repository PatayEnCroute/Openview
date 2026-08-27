import {
  CURRENT_SCHEMA_VERSION,
  type EvaluationScope,
  parseTemplate,
  STANDARD_SHEETS_MM,
  type Template,
} from '@openview/core';
import {
  createPdfRenderPort,
  type PdfLayoutMeasurement,
  type PdfRenderSession,
  type PdfRenderStrategy,
  type PdfSourceDocument,
  type RenderEngineOptions,
} from '@openview/engine';
import { PDFDocument } from 'pdf-lib';
import {
  createPuppeteerPdfStrategy,
  type PuppeteerPdfStrategyOptions,
} from '../puppeteer-pdf-strategy.js';

/**
 * Test launcher options with container flags for CI execution.
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

/** A template built from the same overrides the engine fixtures use. */
export function templateOf(overrides: Record<string, unknown> = {}): Template {
  return parseTemplate({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'tpl_adapter',
    name: 'Adapter fixture',
    version: '1.0.0',
    page: A4_PAGE,
    root: { type: 'container', id: 'root', children: [] },
    ...overrides,
  });
}

/** What one render through a real browser produced, and what was handed to the printer. */
export interface CapturedRender {
  readonly bytes: Uint8Array;
  readonly printed: PdfSourceDocument;
  readonly measured: readonly PdfSourceDocument[];
}

/**
 * Renders through Chromium and keeps what the printer was handed.
 *
 * The html is therefore the html the pipeline really produced after measuring in that same browser,
 * rather than a hand-written page nothing generates.
 */
export async function renderCapturing(
  template: Template,
  data: EvaluationScope = {},
  options?: RenderEngineOptions | undefined,
): Promise<CapturedRender> {
  const inner = hostStrategy();
  const measured: PdfSourceDocument[] = [];
  let printed: PdfSourceDocument | undefined;
  const strategy: PdfRenderStrategy = {
    format: 'pdf',
    async open(resources): Promise<PdfRenderSession> {
      const session = await inner.open(resources);
      return {
        async measure(source: PdfSourceDocument): Promise<PdfLayoutMeasurement> {
          measured.push(source);
          return await session.measure(source);
        },
        async print(source: PdfSourceDocument): Promise<Uint8Array> {
          printed = source;
          return await session.print(source);
        },
        close: () => session.close(),
      };
    },
  };
  const result = await createPdfRenderPort(strategy, options).render({ template, data });
  if (printed === undefined) {
    throw new Error('the pipeline printed nothing');
  }
  return { bytes: result.bytes, printed, measured };
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
