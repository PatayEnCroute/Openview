import { parseTemplate } from '@openview/core';
import { describe, expect, it } from 'vitest';
import { attachWorker, type WorkerPort } from '../attach.js';
import {
  type ParentMessage,
  parseWorkerMessage,
  WORKER_PROTOCOL_VERSION,
  type WorkerMessage,
} from '../protocol.js';
import { ONE_PAGE_PDF, SMALL_DATA, SMALL_TEMPLATE } from './fixtures.js';

/** The parent side of one port, as a test drives it. */
interface Wired {
  readonly sent: WorkerMessage[];
  post(message: unknown): void;
  closed(): boolean;
  /** Waits until a message satisfying `matches` has been sent, or the turn budget runs out. */
  until(matches: (message: WorkerMessage) => boolean): Promise<WorkerMessage>;
}

function wire(): Wired {
  const sent: WorkerMessage[] = [];
  let listener: ((raw: unknown) => void) | undefined;
  let closed = false;
  const port: WorkerPort = {
    postMessage(message: unknown): void {
      const parsed = parseWorkerMessage(message);
      if (parsed !== undefined) {
        sent.push(parsed);
      }
    },
    on(_event, next): void {
      listener = next;
    },
    close(): void {
      closed = true;
    },
  };
  attachWorker(port);
  return {
    sent,
    post: (message) => {
      listener?.(message);
    },
    closed: () => closed,
    async until(matches): Promise<WorkerMessage> {
      for (let turn = 0; turn < 200; turn += 1) {
        const found = sent.find(matches);
        if (found !== undefined) {
          return found;
        }
        await Promise.resolve();
      }
      throw new Error('no message of that shape was ever sent');
    },
  };
}

const envelope = { formatVersion: WORKER_PROTOCOL_VERSION, generation: 0 } as const;

const start = (generation = 0): ParentMessage => ({
  formatVersion: WORKER_PROTOCOL_VERSION,
  generation,
  kind: 'start',
  renderId: 'r1',
  task: {
    format: 'pdf',
    template: parseTemplate(SMALL_TEMPLATE),
    data: SMALL_DATA,
    options: undefined,
  },
});

describe('a worker wired to its parent', () => {
  it('announces itself before anything else', () => {
    expect(wire().sent[0]?.kind).toBe('ready');
  });

  it('turns every session operation into a message, and awaits its reply', async () => {
    const worker = wire();
    worker.post(start());
    const opened = await worker.until((message) => message.kind === 'call');
    expect(opened.kind === 'call' && opened.call.op).toBe('open');
    expect(opened.kind === 'call' && opened.renderId).toBe('r1');
  });

  it('runs a whole render, replying to each operation in turn', async () => {
    const worker = wire();
    const answered = new Set<number>();
    worker.post(start());
    const answer = (call: WorkerMessage): void => {
      if (call.kind !== 'call') {
        return;
      }
      const value =
        call.call.op === 'measure'
          ? measurementFor(call.call.document.html, call.call.document.sheet)
          : call.call.op === 'print'
            ? ONE_PAGE_PDF
            : call.call.op === 'resolve'
              ? call.call.images.map((image) => ({ key: image.key, src: image.src }))
              : undefined;
      worker.post({
        ...envelope,
        kind: 'reply',
        renderId: call.renderId,
        sequence: call.sequence,
        reply: { ok: true, value },
      });
    };
    for (let turn = 0; turn < 400; turn += 1) {
      for (const message of [...worker.sent]) {
        if (message.kind === 'call' && !answered.has(message.sequence)) {
          answered.add(message.sequence);
          answer(message);
        }
      }
      if (worker.sent.some((message) => message.kind === 'done')) {
        break;
      }
      await Promise.resolve();
    }
    const done = await worker.until((message) => message.kind === 'done');
    expect(done.kind === 'done' && done.outcome.ok).toBe(true);
  });

  it('reports a refusal of the browser side as its own outcome, with no cause', async () => {
    const worker = wire();
    worker.post(start());
    const call = await worker.until((message) => message.kind === 'call');
    if (call.kind !== 'call') {
      throw new Error('the worker should have called out');
    }
    worker.post({
      ...envelope,
      kind: 'reply',
      renderId: 'r1',
      sequence: call.sequence,
      reply: {
        ok: false,
        error: { code: 'resource-policy-refused', message: 'refused', details: {} },
      },
    });
    const done = await worker.until((message) => message.kind === 'done');
    expect(done.kind === 'done' && done.outcome.ok).toBe(false);
    if (done.kind === 'done' && !done.outcome.ok) {
      expect(done.outcome.error.code).toBe('resource-policy-refused');
    }
  });

  it('answers under the generation the parent named', async () => {
    const worker = wire();
    worker.post(start(4));
    const call = await worker.until((message) => message.kind === 'call');
    expect(call.generation).toBe(4);
  });

  it('ignores a message it cannot read, rather than acting on part of it', () => {
    const worker = wire();
    const before = worker.sent.length;
    worker.post({ formatVersion: 99, generation: 0, kind: 'start' });
    expect(worker.sent).toHaveLength(before);
  });

  it('closes its port when the parent shuts it down', () => {
    const worker = wire();
    worker.post({ ...envelope, kind: 'shutdown' });
    expect(worker.closed()).toBe(true);
  });

  it('ignores a reply to an operation it never asked for', async () => {
    const worker = wire();
    worker.post({
      ...envelope,
      kind: 'reply',
      renderId: 'r1',
      sequence: 99,
      reply: { ok: true, value: undefined },
    });
    await Promise.resolve();
    expect(worker.sent.map((message) => message.kind)).toStrictEqual(['ready']);
  });
});

const PX_PER_MM = 96 / 25.4;
const KEYED = /data-openview-key="([^"]+)"/g;

/** A layout answer as regular as squared paper, keyed by what the html really annotated. */
function measurementFor(html: string, sheet: { width: number; height: number }): unknown {
  const printable = /\.ov-printable\{[^}]*width:([\d.]+)mm;height:([\d.]+)mm/.exec(html);
  return {
    pages: Array.from({ length: Math.max(1, html.split('class="ov-page"').length - 1) }, () => ({
      page: { width: sheet.width * PX_PER_MM, height: sheet.height * PX_PER_MM },
      printable: {
        width: Number(printable?.[1] ?? sheet.width) * PX_PER_MM,
        height: Number(printable?.[2] ?? sheet.height) * PX_PER_MM,
      },
      regions: (['header', 'root', 'footer'] as const).map((region) => ({
        region,
        height: 0,
        contentHeight: 0,
      })),
    })),
    boxes: [...html.matchAll(KEYED)].map((hit) => ({ key: hit[1], width: 100, height: 10 })),
    lines: [],
    images: [],
    escaping: [],
    overflowingGridItems: [],
    clippedMarkerCount: 0,
  };
}
