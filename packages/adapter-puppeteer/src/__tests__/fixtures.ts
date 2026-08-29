import type { PaginationResult } from '@openview/core';
import {
  CURRENT_SCHEMA_VERSION,
  type EvaluationScope,
  parseTemplate,
  STANDARD_SHEETS_MM,
  type Template,
} from '@openview/core';
import {
  createPaginationPort,
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

/**
 * The same 120x40 logo, encoded as jpeg and as webp.
 *
 * Three decoders rather than one: the adapter accepts png, jpeg and webp, and a lot rests on each
 * of them producing the same intrinsic size and the same layout on every run. Generated once by
 * Chromium and committed, so nothing encodes an image at test time.
 */
export const LOGO_JPEG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAoAHgDASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAAAAYFCP/EACQQAQAABQIGAwAAAAAAAAAAAAARFmSj4QUGEhNEYYLBFSNC/8QAGQEBAAMBAQAAAAAAAAAAAAAAAAQGBwUI/8QAJBEAAQIEBQUAAAAAAAAAAAAAAAECAwQFERYxU6LSBjVBgrL/2gAMAwEAAhEDEQA/AOfAGZG6gAAAAE/uzpfP0oE/uzpfP0tHTHd4Pt8uKr1T2eN6/TSfAb0efwAAAAAACgmyluYJspbmE+KvhikaO53ItWKaxrbW8SgmyluYJspbmE+GGKRo7nchimsa21vEoJspbmCbKW5hPhhikaO53IYprGttbxKCbKW5hn6tq3ynK+rlcEf1GMYduzPEqVoVOkozY8CFZyZLdy5pbyqpkRZqv1Kdgul5iLdq5pZqZLfwiLmgAd4r4AAAAAAAAAAAAAAAAAAAAAAAAAH/2Q==';

export const LOGO_WEBP =
  'data:image/webp;base64,UklGRqACAABXRUJQVlA4WAoAAAAgAAAAdwAAJwAASUNDUMgBAAAAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADZWUDggsgAAABAJAJ0BKngAKAA+MRiKQ6IhoRQMBAAgAwSygErn/APwA2OjgH4jUYD8VfYB/APwAu//cAN4A/s38AAQGO/BKPzjGhfpU+HmBOQpaUORFsoIAAD+9w1mZkmS/XSDp5wHnAf0UofEZhnY2xRV0Rz+dY1b3r08ESkNLoq+847JGKhDDO6Dy98arVyS+Xn0OXVh36WAFI62xrnlpaHUaB0X2+A6uqXOq5ZdghXViwgxpKwAAAA=';

/** The same pair at 4x2, for a test that needs an image too small to change a layout. */
export const TINY_JPEG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAACAAQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAZEAEAAwEBAAAAAAAAAAAAAAACAAEDETH/xAAVAQEBAAAAAAAAAAAAAAAAAAAGB//EABoRAAAHAAAAAAAAAAAAAAAAAAABAwQ0crH/2gAMAwEAAhEDEQA/AI+00erttJq/Ur7dxESltI6dSwFHchSx6P/Z';

export const TINY_WEBP =
  'data:image/webp;base64,UklGRjgCAABXRUJQVlA4WAoAAAAgAAAAAwAAAQAASUNDUMgBAAAAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADZWUDggSgAAAPACAJ0BKgQAAgAAwBIloAJ0ugDJAP0AywD9AAUrQiMAAP7++z2vMAETL5WA53/zmNnTr/+Wh/HrxgN+/F/n7TH3+N2FwHwvzCAA';

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
        resolveImages: session.resolveImages.bind(session),
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

/** Every info entry a reader would show, read back through a parser rather than matched in bytes. */
export async function metadataOf(bytes: Uint8Array): Promise<Record<string, string | undefined>> {
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  const asIso = (date: Date | undefined): string | undefined => date?.toISOString();
  return {
    title: pdf.getTitle(),
    author: pdf.getAuthor(),
    subject: pdf.getSubject(),
    keywords: pdf.getKeywords(),
    creator: pdf.getCreator(),
    producer: pdf.getProducer(),
    creationDate: asIso(pdf.getCreationDate()),
    modificationDate: asIso(pdf.getModificationDate()),
  };
}

/** Whether the trailer carries a file identifier, which is redrawn at every print. */
export async function hasTrailerId(bytes: Uint8Array): Promise<boolean> {
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  return pdf.context.trailerInfo.ID !== undefined;
}

/** What one pagination through a real browser produced, and what it was asked to measure. */
export interface CapturedPagination {
  readonly result: PaginationResult;
  readonly measured: readonly PdfSourceDocument[];
}

/**
 * Paginates through Chromium, and fails the moment the port asks the session to print.
 *
 * The refusal is the proof: a preview path that reached `print()` would produce a document nobody
 * asked for, so it reddens here rather than being counted afterwards.
 */
export async function paginateCapturing(
  template: Template,
  data: EvaluationScope = {},
  options?: RenderEngineOptions | undefined,
): Promise<CapturedPagination> {
  const inner = hostStrategy();
  const measured: PdfSourceDocument[] = [];
  const strategy: PdfRenderStrategy = {
    format: 'pdf',
    async open(resources): Promise<PdfRenderSession> {
      const session = await inner.open(resources);
      return {
        resolveImages: session.resolveImages.bind(session),
        async measure(source: PdfSourceDocument): Promise<PdfLayoutMeasurement> {
          measured.push(source);
          return await session.measure(source);
        },
        print(): Promise<Uint8Array> {
          return Promise.reject(new Error('a pagination must never print'));
        },
        close: () => session.close(),
      };
    },
  };
  const result = await createPaginationPort(strategy, options).paginate({ template, data });
  return { result, measured };
}
