import { CURRENT_SCHEMA_VERSION, type PaginationResult, STANDARD_SHEETS_MM } from '@openview/core';
import type {
  DocumentImage,
  PdfLayoutMeasurement,
  PdfRenderResources,
  PdfRenderSession,
  PdfSourceDocument,
  ResolvedDocumentImage,
} from '@openview/engine';
import { PDFDocument } from 'pdf-lib';
import { type CallChannel, runTask } from '../handler.js';
import {
  type ParentMessage,
  parseParentMessage,
  type SessionCall,
  WORKER_PROTOCOL_VERSION,
} from '../protocol.js';
import type { BrowserFactory, SlotBrowser, WorkerFactory, WorkerHandle } from '../slot.js';

/** Css pixels per millimetre at the default device ratio, which is what Chromium reports. */
export const PX_PER_MM = 96 / 25.4;

/** A template of one text block, which is the smallest document a pipeline really renders. */
export const SMALL_TEMPLATE: Record<string, unknown> = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  id: 'tpl_runtime',
  name: 'Runtime template',
  version: '1.0.0',
  page: {
    sheet: { ...STANDARD_SHEETS_MM.a4 },
    margins: { top: 10, right: 10, bottom: 10, left: 10 },
    header: [],
    footer: [],
  },
  root: {
    type: 'container',
    id: 'root',
    children: [
      {
        type: 'text',
        id: 'line',
        content: [{ kind: 'binding', value: { kind: 'path', path: 'ledger.label' } }],
      },
    ],
  },
};

export const SMALL_DATA: Record<string, unknown> = { ledger: { label: 'hello' } };

/** One real, minimal pdf, so canonicalisation has something it can actually parse. */
export const ONE_PAGE_PDF: Uint8Array = await (async () => {
  const document = await PDFDocument.create();
  document.addPage([595, 842]);
  return await document.save();
})();

const KEYED = /<(\w+)((?:[^\w>][^>]*)?)>/g;
const ATTRIBUTE = /\s([\w-]+)="([^"]*)"/g;
const PRINTABLE = /\.ov-printable\{[^}]*width:([\d.]+)mm;height:([\d.]+)mm/;

/** Every occurrence key the engine annotated, read back from the markup it really produced. */
function keysOf(html: string): readonly string[] {
  const found: string[] = [];
  for (const tag of html.matchAll(KEYED)) {
    for (const attribute of (tag[2] ?? '').matchAll(ATTRIBUTE)) {
      if (attribute[1] === 'data-openview-key') {
        found.push(attribute[2] ?? '');
      }
    }
  }
  return found;
}

/** A layout answer as regular as squared paper, keyed by what the engine asked about. */
function measurementOf(source: PdfSourceDocument): PdfLayoutMeasurement {
  const declared = PRINTABLE.exec(source.html);
  const printable = {
    width: Number(declared?.[1] ?? source.sheet.width) * PX_PER_MM,
    height: Number(declared?.[2] ?? source.sheet.height) * PX_PER_MM,
  };
  const sheets = Math.max(1, source.html.split('class="ov-page"').length - 1);
  return {
    pages: Array.from({ length: sheets }, () => ({
      page: { width: source.sheet.width * PX_PER_MM, height: source.sheet.height * PX_PER_MM },
      printable,
      regions: (['header', 'root', 'footer'] as const).map((region) => ({
        region,
        height: 0,
        contentHeight: 0,
      })),
    })),
    boxes: keysOf(source.html).map((key) => ({ key, width: 100, height: 10 })),
    lines: [],
    images: [],
    escaping: [],
    overflowingGridItems: [],
    clippedMarkerCount: 0,
  };
}

/** What one fake browser was asked to do, so a test can prove a context is never shared. */
export interface BrowserLog {
  readonly opened: PdfRenderResources[];
  contexts: number;
  closedContexts: number;
  browsers: number;
  closedBrowsers: number;
  /** Contexts open at the same moment, at its highest: one render, one context. */
  concurrentContexts: number;
}

export interface FakeBrowserOptions {
  /** Makes every context refuse to close, so a slot has to treat its browser as unprovable. */
  readonly cleanupHangs?: boolean | undefined;
  /** Makes the browser refuse to close gracefully. */
  readonly closeFails?: boolean | undefined;
}

/** A browser that answers from a table instead of launching Chromium. */
export function fakeBrowsers(options: FakeBrowserOptions = {}): {
  readonly factory: BrowserFactory;
  readonly log: BrowserLog;
} {
  const log: BrowserLog = {
    opened: [],
    contexts: 0,
    closedContexts: 0,
    browsers: 0,
    closedBrowsers: 0,
    concurrentContexts: 0,
  };
  let live = 0;
  return {
    log,
    factory: {
      create(): Promise<SlotBrowser> {
        log.browsers += 1;
        return Promise.resolve({
          openContext(resources: PdfRenderResources): Promise<PdfRenderSession> {
            log.opened.push(resources);
            log.contexts += 1;
            live += 1;
            log.concurrentContexts = Math.max(log.concurrentContexts, live);
            return Promise.resolve({
              resolveImages(
                images: readonly DocumentImage[],
              ): Promise<readonly ResolvedDocumentImage[]> {
                return Promise.resolve(images.map((image) => ({ key: image.key, src: image.src })));
              },
              measure(source: PdfSourceDocument): Promise<PdfLayoutMeasurement> {
                return Promise.resolve(measurementOf(source));
              },
              print(): Promise<Uint8Array> {
                return Promise.resolve(ONE_PAGE_PDF);
              },
              close(): Promise<void> {
                if (options.cleanupHangs === true) {
                  return Promise.reject(new Error('this context will not close'));
                }
                live -= 1;
                log.closedContexts += 1;
                return Promise.resolve();
              },
            });
          },
          close(): Promise<boolean> {
            log.closedBrowsers += 1;
            return Promise.resolve(options.closeFails !== true);
          },
        });
      },
    },
  };
}

/** How a fixture worker misbehaves, if it does. */
export interface FakeWorkerOptions {
  /** Never answers a task, the way a synchronous loop in a real thread would not. */
  readonly hangs?: boolean | undefined;
  /** Reports an exhausted heap the way Node does, through an error rather than an exit code. */
  readonly outOfMemory?: boolean | undefined;
  /** Stops without answering. */
  readonly exits?: boolean | undefined;
  /** Answers from a generation this runtime has already replaced. */
  readonly staleGeneration?: boolean | undefined;
}

/** What the fixture workers did, across every generation of one slot. */
export interface WorkerLog {
  created: number;
  terminated: number;
  started: number;
}

/**
 * A worker that runs the real handler in this thread.
 *
 * The protocol is exercised for real -- every session operation is a message, replied to by the
 * parent -- while the thread itself is a fixture, so a test proves the wiring rather than Node.
 */
export function fakeWorkers(
  options: FakeWorkerOptions | ((round: number) => FakeWorkerOptions) = {},
): { readonly factory: WorkerFactory; readonly log: WorkerLog } {
  const log: WorkerLog = { created: 0, terminated: 0, started: 0 };
  return {
    log,
    factory: {
      create(): Promise<WorkerHandle> {
        const round = log.created;
        log.created += 1;
        const behaviour = typeof options === 'function' ? options(round) : options;
        let listeners:
          | {
              onMessage: (raw: unknown) => void;
              onExit: (code: number) => void;
              onError: (error: unknown) => void;
            }
          | undefined;
        let dead = false;
        const pending = new Map<number, (value: unknown) => void>();
        const failures = new Map<number, (error: unknown) => void>();
        let sequence = 0;

        const send = (message: unknown): void => {
          if (!dead) {
            listeners?.onMessage(message);
          }
        };

        const channelFor = (renderId: string, generation: number): CallChannel => ({
          call(call: SessionCall): Promise<unknown> {
            sequence += 1;
            const at = sequence;
            return new Promise<unknown>((resolve, reject) => {
              pending.set(at, resolve);
              failures.set(at, reject);
              send({
                formatVersion: WORKER_PROTOCOL_VERSION,
                generation,
                kind: 'call',
                renderId,
                sequence: at,
                call,
              });
            });
          },
        });

        const handle: WorkerHandle = {
          post(message: ParentMessage): void {
            const parsed = parseParentMessage(message);
            if (parsed === undefined || dead) {
              return;
            }
            if (parsed.kind === 'reply') {
              const resolve = pending.get(parsed.sequence);
              const reject = failures.get(parsed.sequence);
              pending.delete(parsed.sequence);
              failures.delete(parsed.sequence);
              if (parsed.reply.ok) {
                resolve?.(parsed.reply.value);
              } else {
                reject?.(new Error(parsed.reply.error.code));
              }
              return;
            }
            if (parsed.kind === 'shutdown') {
              dead = true;
              return;
            }
            log.started += 1;
            if (behaviour.hangs === true) {
              return;
            }
            if (behaviour.outOfMemory === true) {
              const error = new Error('worker out of memory');
              Object.defineProperty(error, 'code', { value: 'ERR_WORKER_OUT_OF_MEMORY' });
              queueMicrotask(() => {
                listeners?.onError(error);
              });
              return;
            }
            if (behaviour.exits === true) {
              queueMicrotask(() => {
                listeners?.onExit(1);
              });
              return;
            }
            const generation = behaviour.staleGeneration === true ? 99 : parsed.generation;
            void runTask(parsed.task, channelFor(parsed.renderId, generation)).then((outcome) => {
              send({
                formatVersion: WORKER_PROTOCOL_VERSION,
                generation,
                kind: 'done',
                renderId: parsed.renderId,
                outcome,
              });
            });
          },
          listen(next): void {
            listeners = next;
            /* Answered on a later turn, the way a real thread reports itself started. */
            queueMicrotask(() => {
              send({ formatVersion: WORKER_PROTOCOL_VERSION, generation: 0, kind: 'ready' });
            });
          },
          terminate(): Promise<void> {
            dead = true;
            log.terminated += 1;
            return Promise.resolve();
          },
        };
        return Promise.resolve(handle);
      },
    },
  };
}

/** The shape a pagination answer really has, for a test asserting on one. */
export type { PaginationResult };
