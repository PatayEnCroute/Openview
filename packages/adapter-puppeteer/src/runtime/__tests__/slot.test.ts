import { parseTemplate } from '@openview/core';
import { DocumentRenderError, type PdfRenderResources } from '@openview/engine';
import { describe, expect, it } from 'vitest';
import { WORKER_PROTOCOL_VERSION } from '../protocol.js';
import type { SlotLimits, SlotTask, WorkerHandle } from '../slot.js';
import { createRenderSlot } from '../slot.js';
import { fakeBrowsers, fakeWorkers, SMALL_DATA, SMALL_TEMPLATE } from './fixtures.js';

const LIMITS: SlotLimits = {
  renderTimeoutMs: 400,
  maxRendersPerWorker: 100,
  workerStartTimeoutMs: 5_000,
};

const job = (): SlotTask => ({
  renderId: 'r1',
  task: {
    format: 'pdf',
    template: parseTemplate(SMALL_TEMPLATE),
    data: SMALL_DATA,
    options: undefined,
  },
  signal: undefined,
});

async function refusalOf(run: Promise<unknown>): Promise<DocumentRenderError> {
  const caught: unknown = await run.catch((error: unknown) => error);
  if (caught instanceof DocumentRenderError) {
    return caught;
  }
  throw new Error(`expected a refusal, got ${String(caught)}`);
}

describe('a slot that cannot be built', () => {
  it('fails at creation rather than at its first client', async () => {
    const browsers = fakeBrowsers();
    const broken = {
      create: (): Promise<WorkerHandle> => Promise.reject(new Error('no thread')),
    };
    await expect(createRenderSlot(broken, browsers.factory, LIMITS)).rejects.toThrow('no thread');
  });

  it('fails at creation when its worker stops before announcing itself', async () => {
    const browsers = fakeBrowsers();
    const stillborn = {
      create: (): Promise<WorkerHandle> =>
        Promise.resolve({
          post: () => undefined,
          listen: (listeners) => {
            queueMicrotask(() => {
              listeners.onExit(1);
            });
          },
          terminate: () => Promise.resolve(),
        }),
    };
    await expect(createRenderSlot(stillborn, browsers.factory, LIMITS)).rejects.toBeInstanceOf(
      DocumentRenderError,
    );
  });
});

describe('what a slot recycles, and when', () => {
  it('replaces its worker once it has served the renders one may', async () => {
    const workers = fakeWorkers();
    const browsers = fakeBrowsers();
    const slot = await createRenderSlot(workers.factory, browsers.factory, {
      renderTimeoutMs: 2_000,
      maxRendersPerWorker: 2,
      workerStartTimeoutMs: 5_000,
    });
    try {
      await slot.run(job());
      expect(slot.generation).toBe(0);
      await slot.run(job());
      /* Recycled on the count alone, without a fault: an isolate is replaced on a rhythm rather
         than on evidence of a leak. */
      expect(slot.generation).toBe(1);
      expect(workers.log.terminated).toBe(1);
      expect(browsers.log.closedBrowsers).toBe(0);
    } finally {
      await slot.close();
    }
  });

  it('replaces the browser too when a context will not close', async () => {
    const workers = fakeWorkers();
    const browsers = fakeBrowsers({ cleanupHangs: true });
    const slot = await createRenderSlot(workers.factory, browsers.factory, LIMITS);
    try {
      await refusalOf(slot.run(job()));
      /* A cleanup that never answers makes the browser unprovable, so it is not kept. */
      expect(browsers.log.closedBrowsers).toBeGreaterThanOrEqual(1);
      expect(browsers.log.browsers).toBeGreaterThanOrEqual(2);
    } finally {
      await slot.close();
    }
  });
});

describe('a closed slot', () => {
  it('refuses a render with its own code, and closes only once', async () => {
    const workers = fakeWorkers();
    const browsers = fakeBrowsers();
    const slot = await createRenderSlot(workers.factory, browsers.factory, LIMITS);
    await slot.close();
    await slot.close();
    expect((await refusalOf(slot.run(job()))).code).toBe('runtime-closed');
    expect(workers.log.terminated).toBe(1);
    expect(browsers.log.closedBrowsers).toBe(1);
  });
});

describe('an operation on a session that was never opened', () => {
  it('is refused, and the reply says so without ending the render', async () => {
    const browsers = fakeBrowsers();
    let listeners: Parameters<WorkerHandle['listen']>[0] | undefined;
    const posted: unknown[] = [];
    const rogue = {
      create: (): Promise<WorkerHandle> =>
        Promise.resolve({
          post: (message) => {
            posted.push(message);
            if (message.kind === 'start') {
              /* A measurement before any `open`, which no real worker sends. */
              listeners?.onMessage({
                formatVersion: WORKER_PROTOCOL_VERSION,
                generation: message.generation,
                kind: 'call',
                renderId: message.renderId,
                sequence: 1,
                call: { op: 'close' },
              });
            }
          },
          listen: (next) => {
            listeners = next;
            queueMicrotask(() => {
              next.onMessage({
                formatVersion: WORKER_PROTOCOL_VERSION,
                generation: 0,
                kind: 'ready',
              });
            });
          },
          terminate: () => Promise.resolve(),
        }),
    };
    const slot = await createRenderSlot(rogue, browsers.factory, {
      renderTimeoutMs: 200,
      maxRendersPerWorker: 100,
      workerStartTimeoutMs: 5_000,
    });
    try {
      await refusalOf(slot.run(job()));
      const reply = posted.find(
        (message): message is { kind: string; reply: { ok: boolean } } =>
          typeof message === 'object' && message !== null && 'reply' in message,
      );
      expect(reply?.reply.ok).toBe(false);
    } finally {
      await slot.close();
    }
  });
});

describe('the resources a session is opened on', () => {
  it('are the sheet and the images the worker named', async () => {
    const workers = fakeWorkers();
    const browsers = fakeBrowsers();
    const slot = await createRenderSlot(workers.factory, browsers.factory, {
      renderTimeoutMs: 2_000,
      maxRendersPerWorker: 100,
      workerStartTimeoutMs: 5_000,
    });
    try {
      await slot.run(job());
      const opened: PdfRenderResources | undefined = browsers.log.opened[0];
      expect(opened?.sheet).toStrictEqual({ width: 210, height: 297 });
      expect(opened?.images).toStrictEqual([]);
    } finally {
      await slot.close();
    }
  });
});

describe('a deadline that beats the opening of a context', () => {
  it('finds the context that arrived late, and closes it anyway', async () => {
    const browsers = fakeBrowsers();
    let listeners: Parameters<WorkerHandle['listen']>[0] | undefined;
    const slow = {
      create: (): Promise<WorkerHandle> =>
        Promise.resolve({
          post: (message) => {
            if (message.kind !== 'start') {
              return;
            }
            listeners?.onMessage({
              formatVersion: WORKER_PROTOCOL_VERSION,
              generation: message.generation,
              kind: 'call',
              renderId: message.renderId,
              sequence: 1,
              call: { op: 'open', sheet: { width: 210, height: 297 }, images: [] },
            });
          },
          listen: (next) => {
            listeners = next;
            queueMicrotask(() => {
              next.onMessage({
                formatVersion: WORKER_PROTOCOL_VERSION,
                generation: 0,
                kind: 'ready',
              });
            });
          },
          terminate: () => Promise.resolve(),
        }),
    };
    const slot = await createRenderSlot(slow, browsers.factory, {
      /* Short enough that the deadline lands while the context is still being opened. */
      renderTimeoutMs: 1,
      maxRendersPerWorker: 100,
      workerStartTimeoutMs: 5_000,
    });
    try {
      expect((await refusalOf(slot.run(job()))).code).toBe('render-timeout');
      /* A context left open in a browser this process keeps is exactly the leak the cleanup is
         for, whether or not the render ever learnt about it. */
      expect(browsers.log.contexts).toBe(browsers.log.closedContexts);
    } finally {
      await slot.close();
    }
  });
});

describe('a slot whose worker cannot be rebuilt', () => {
  it('keeps the refusal of the render that was running, and admits nothing more', async () => {
    const browsers = fakeBrowsers();
    let created = 0;
    const once = {
      create: async (): Promise<WorkerHandle> => {
        created += 1;
        if (created > 1) {
          throw new Error('no replacement thread');
        }
        return await fakeWorkers({ hangs: true }).factory.create();
      },
    };
    const slot = await createRenderSlot(once, browsers.factory, {
      renderTimeoutMs: 40,
      maxRendersPerWorker: 100,
      workerStartTimeoutMs: 5_000,
    });
    expect((await refusalOf(slot.run(job()))).code).toBe('render-timeout');
    /* A slot that cannot be rebuilt is not capacity: it says so rather than pretending. */
    expect((await refusalOf(slot.run(job()))).code).toBe('runtime-closed');
    await slot.close();
  });
});

describe('a worker that calls out after its round has ended', () => {
  it('opens no context, because a late call is not obeyed', async () => {
    const browsers = fakeBrowsers();
    let listeners: Parameters<WorkerHandle['listen']>[0] | undefined;
    /** The handler of the round itself, kept because the rebuild installs another over it. */
    let ofTheRound: Parameters<WorkerHandle['listen']>[0] | undefined;
    /* Answers nothing until the deadline has fired, then asks for a context. Performing it would
       open one after the cleanup meant to close it, in a browser this process keeps. */
    const late = {
      create: (): Promise<WorkerHandle> =>
        Promise.resolve({
          post: (message) => {
            if (message.kind === 'start') {
              ofTheRound = listeners;
            }
          },
          listen: (next) => {
            listeners = next;
            queueMicrotask(() => {
              next.onMessage({
                formatVersion: WORKER_PROTOCOL_VERSION,
                generation: 0,
                kind: 'ready',
              });
            });
          },
          terminate: () => Promise.resolve(),
        }),
    };
    const slot = await createRenderSlot(late, browsers.factory, {
      renderTimeoutMs: 20,
      maxRendersPerWorker: 100,
      workerStartTimeoutMs: 5_000,
    });
    try {
      const refused = await refusalOf(slot.run(job()));
      expect(refused.code).toBe('render-timeout');
      expect(ofTheRound).toBeDefined();
      ofTheRound?.onMessage({
        formatVersion: WORKER_PROTOCOL_VERSION,
        generation: 0,
        kind: 'call',
        renderId: 'r1',
        sequence: 1,
        call: { op: 'open', sheet: { width: 210, height: 297 }, images: [] },
      });
      await new Promise<void>((resolve) => {
        queueMicrotask(resolve);
      });
      expect(browsers.log.contexts).toBe(0);
    } finally {
      await slot.close();
    }
  });
});

describe('a worker that never announces itself', () => {
  it('is terminated at the start deadline rather than waited on for ever', async () => {
    /* Every other bound of this package is a deadline; a thread that blocks in its entry module
       would otherwise hang the creation of the whole runtime with nothing to stop it. */
    const browsers = fakeBrowsers();
    let terminated = 0;
    const silent = {
      create: (): Promise<WorkerHandle> =>
        Promise.resolve({
          post: () => undefined,
          listen: () => undefined,
          terminate: () => {
            terminated += 1;
            return Promise.resolve();
          },
        }),
    };
    const refused = await createRenderSlot(silent, browsers.factory, {
      renderTimeoutMs: 5_000,
      maxRendersPerWorker: 100,
      workerStartTimeoutMs: 30,
    }).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(DocumentRenderError);
    if (refused instanceof DocumentRenderError) {
      expect(refused.code).toBe('render-worker-failed');
      expect(refused.details.limit).toBe(30);
    }
    /* The thread exists whatever the reason it never answered, and nothing else owns it. */
    expect(terminated).toBe(1);
  });
});
