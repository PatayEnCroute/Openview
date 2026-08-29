import { subscribe, unsubscribe } from 'node:diagnostics_channel';
import { parseTemplate, type RenderRequest } from '@openview/core';
import { DocumentRenderError } from '@openview/engine';
import { afterEach, describe, expect, it } from 'vitest';
import { type ProtectedRenderAuditEvent, RENDER_AUDIT_CHANNEL } from '../audit.js';
import type { ParentMessage } from '../protocol.js';
import { WORKER_PROTOCOL_VERSION } from '../protocol.js';
import {
  admitRequest,
  createPuppeteerRenderRuntime,
  manifestAuthorises,
  type PuppeteerRenderRuntime,
  type PuppeteerRenderRuntimeOptions,
} from '../runtime.js';
import type { WorkerListeners } from '../slot.js';
import {
  type BrowserLog,
  type FakeWorkerOptions,
  fakeBrowsers,
  fakeWorkers,
  SMALL_DATA,
  SMALL_TEMPLATE,
  type WorkerLog,
} from './fixtures.js';

interface Harness {
  readonly runtime: PuppeteerRenderRuntime;
  readonly workers: WorkerLog;
  readonly browsers: BrowserLog;
}

const open: PuppeteerRenderRuntime[] = [];

async function harness(
  options: Omit<PuppeteerRenderRuntimeOptions, 'workers' | 'browsers'> = {},
  worker: FakeWorkerOptions | ((round: number) => FakeWorkerOptions) = {},
): Promise<Harness> {
  const workers = fakeWorkers(worker);
  const browsers = fakeBrowsers();
  const runtime = await createPuppeteerRenderRuntime({
    ...options,
    workers: workers.factory,
    browsers: browsers.factory,
  });
  open.push(runtime);
  return { runtime, workers: workers.log, browsers: browsers.log };
}

/* The runtime copies and revalidates the template inside its worker anyway; parsing it here is
   what lets the request be the one the port declares rather than a cast. */
const request = (): RenderRequest => ({
  template: parseTemplate(SMALL_TEMPLATE),
  data: SMALL_DATA,
});

async function refusalOf(run: Promise<unknown>): Promise<DocumentRenderError> {
  const caught: unknown = await run.catch((error: unknown) => error);
  if (caught instanceof DocumentRenderError) {
    return caught;
  }
  throw new Error(`expected a refusal, got ${String(caught)}`);
}

/** Lets the pool's own microtasks run, without the test deciding how many it needs. */
const turns = async (count = 20): Promise<void> => {
  for (let at = 0; at < count; at += 1) {
    await Promise.resolve();
  }
};

afterEach(async () => {
  for (const runtime of open.splice(0)) {
    await runtime.close();
  }
});

describe('a render through the hardened runtime', () => {
  it('produces a pdf, through a worker and a browser context it owns', async () => {
    const { runtime, browsers } = await harness();
    const result = await runtime.pdf.render(request());
    expect(result.format).toBe('pdf');
    expect(Buffer.from(result.bytes.subarray(0, 5)).toString('latin1')).toBe('%PDF-');
    expect(browsers.contexts).toBe(1);
  });

  it('answers a pagination with the projection the port declares', async () => {
    const { runtime } = await harness();
    const result = await runtime.pagination.paginate(request());
    expect(result.pages.length).toBeGreaterThan(0);
    expect(result.html).toContain('<!doctype html>');
  });

  it('opens a fresh context for every render, and never shares one', async () => {
    const { runtime, browsers } = await harness();
    await runtime.pdf.render(request());
    await runtime.pdf.render(request());
    expect(browsers.contexts).toBe(2);
    expect(browsers.closedContexts).toBe(2);
    expect(browsers.browsers).toBe(1);
  });
});

describe('what a slot does when its worker stops answering', () => {
  it('terminates it, refuses the render, and answers the next one', async () => {
    const { runtime, workers } = await harness({ limits: { renderTimeoutMs: 60 } }, (round) =>
      round === 0 ? { hangs: true } : {},
    );
    const refused = await refusalOf(runtime.pdf.render(request()));
    expect(refused.code).toBe('render-timeout');
    expect(refused.details.limit).toBe(60);
    /* Terminated, not abandoned: a rejected promise is not a freed capacity. */
    expect(workers.terminated).toBeGreaterThanOrEqual(1);
    await expect(runtime.pdf.render(request())).resolves.toHaveProperty('format', 'pdf');
  });

  it('reports an exhausted worker heap as its own refusal, and recovers', async () => {
    const { runtime } = await harness({}, (round) => (round === 0 ? { outOfMemory: true } : {}));
    expect((await refusalOf(runtime.pdf.render(request()))).code).toBe(
      'render-memory-limit-exceeded',
    );
    await expect(runtime.pdf.render(request())).resolves.toHaveProperty('format', 'pdf');
  });

  it('reports a worker that stopped, and recovers', async () => {
    const { runtime } = await harness({}, (round) => (round === 0 ? { exits: true } : {}));
    expect((await refusalOf(runtime.pdf.render(request()))).code).toBe('render-worker-failed');
    await expect(runtime.pdf.render(request())).resolves.toHaveProperty('format', 'pdf');
  });

  it('destroys a slot that answers from a generation it has already replaced', async () => {
    /* A late message must not be able to terminate the promise of the render that took the slot
       next, which is what the generation counter exists for. */
    const { runtime } = await harness({}, (round) =>
      round === 0 ? { staleGeneration: true } : {},
    );
    expect((await refusalOf(runtime.pdf.render(request()))).code).toBe('render-worker-failed');
    await expect(runtime.pdf.render(request())).resolves.toHaveProperty('format', 'pdf');
  });
});

describe('the capacity a burst finds', () => {
  it('refuses at once once every slot and every place in the queue is taken', async () => {
    const { runtime } = await harness(
      { limits: { slots: 1, queueDepth: 1, renderTimeoutMs: 400 } },
      (round) => (round === 0 ? { hangs: true } : {}),
    );
    const held = refusalOf(runtime.pdf.render(request()));
    const queued = refusalOf(runtime.pdf.render(request()));
    const refused = await refusalOf(runtime.pdf.render(request()));
    expect(refused.code).toBe('render-capacity-exceeded');
    expect(refused.details.limit).toBe(1);
    await runtime.close();
    await Promise.all([held, queued]);
  });

  it('refuses a request that waited longer than one may', async () => {
    const { runtime } = await harness(
      { limits: { slots: 1, queueDepth: 2, queueTimeoutMs: 40, renderTimeoutMs: 400 } },
      (round) => (round === 0 ? { hangs: true } : {}),
    );
    const held = refusalOf(runtime.pdf.render(request()));
    const waited = await refusalOf(runtime.pdf.render(request()));
    expect(waited.code).toBe('render-timeout');
    expect(waited.details.phase).toBe('admission');
    await runtime.close();
    await held;
  });

  it('never runs two renders on one slot at once', async () => {
    const { runtime, browsers } = await harness({ limits: { slots: 1, queueDepth: 4 } });
    await Promise.all([
      runtime.pdf.render(request()),
      runtime.pdf.render(request()),
      runtime.pdf.render(request()),
    ]);
    expect(browsers.contexts).toBe(3);
    expect(browsers.closedContexts).toBe(3);
    /* One slot, so one context at a time however many callers arrived together. */
    expect(browsers.concurrentContexts).toBe(1);
  });

  it('runs as many renders at once as it has slots, and no more', async () => {
    const { runtime, browsers } = await harness({ limits: { slots: 2, queueDepth: 4 } });
    await Promise.all([
      runtime.pdf.render(request()),
      runtime.pdf.render(request()),
      runtime.pdf.render(request()),
      runtime.pdf.render(request()),
    ]);
    expect(browsers.browsers).toBe(2);
    expect(browsers.concurrentContexts).toBeLessThanOrEqual(2);
    expect(browsers.contexts).toBe(4);
  });
});

describe('cancelling a render', () => {
  it('is refused before admission when the signal has already fired', async () => {
    const { runtime, browsers } = await harness();
    const controller = new AbortController();
    controller.abort();
    const refused = await refusalOf(runtime.pdf.render(request(), { signal: controller.signal }));
    expect(refused.code).toBe('render-cancelled');
    expect(browsers.contexts).toBe(0);
  });

  it('wakes no worker for a task cancelled while it waited', async () => {
    const { runtime, workers } = await harness(
      { limits: { slots: 1, queueDepth: 2, renderTimeoutMs: 60_000 } },
      { hangs: true },
    );
    const holder = new AbortController();
    const held = refusalOf(runtime.pdf.render(request(), { signal: holder.signal }));
    await turns();
    expect(workers.started).toBe(1);
    const controller = new AbortController();
    const queued = refusalOf(runtime.pdf.render(request(), { signal: controller.signal }));
    controller.abort();
    expect((await queued).code).toBe('render-cancelled');
    /* Only the render that took the slot was ever started: a task cancelled while it waited is
       removed without waking anything. */
    expect(workers.started).toBe(1);
    holder.abort();
    await held;
  });
});

describe('a closed runtime', () => {
  it('admits nothing more, and says so with its own code', async () => {
    const { runtime } = await harness();
    await runtime.close();
    expect((await refusalOf(runtime.pdf.render(request()))).code).toBe('runtime-closed');
    expect((await refusalOf(runtime.pagination.paginate(request()))).code).toBe('runtime-closed');
  });

  it('closes every worker and every browser it owned', async () => {
    const { runtime, workers, browsers } = await harness({ limits: { slots: 2 } });
    await runtime.close();
    expect(workers.terminated).toBe(2);
    expect(browsers.closedBrowsers).toBe(2);
  });

  it('is idempotent', async () => {
    const { runtime, browsers } = await harness();
    await runtime.close();
    await runtime.close();
    expect(browsers.closedBrowsers).toBe(1);
  });
});

describe('the audit one render publishes', () => {
  const collected: ProtectedRenderAuditEvent[] = [];
  const listener = (message: unknown): void => {
    collected.push(message as ProtectedRenderAuditEvent);
  };

  afterEach(() => {
    unsubscribe(RENDER_AUDIT_CHANNEL, listener);
    collected.length = 0;
  });

  it('is exactly one terminal event per call, for a success and for a refusal', async () => {
    subscribe(RENDER_AUDIT_CHANNEL, listener);
    const { runtime } = await harness();
    await runtime.pdf.render(request());
    expect(collected).toHaveLength(1);
    expect(collected[0]?.outcome).toBe('succeeded');
    expect(collected[0]?.renderId).toBe('r1');
    await runtime.close();
    await refusalOf(runtime.pdf.render(request()));
    expect(collected).toHaveLength(2);
    expect(collected[1]?.outcome).toBe('refused');
    expect(collected[1]?.code).toBe('runtime-closed');
  });

  it('carries durations and a code, and nothing of the document', async () => {
    subscribe(RENDER_AUDIT_CHANNEL, listener);
    const { runtime } = await harness();
    await runtime.pdf.render(request());
    const event = collected[0];
    expect(Object.keys(event ?? {}).sort()).toStrictEqual([
      'code',
      'outcome',
      'phase',
      'queueMs',
      'renderId',
      'renderMs',
    ]);
    const written = JSON.stringify(event);
    for (const forbidden of ['hello', 'ledger', 'doctype', 'tpl_runtime', 'data:']) {
      expect(written).not.toContain(forbidden);
    }
  });
});

describe('what the pool answers about itself', () => {
  it('cancels a render that is already running, and rebuilds its slot', async () => {
    const { runtime, workers } = await harness({ limits: { renderTimeoutMs: 60_000 } }, (round) =>
      round === 0 ? { hangs: true } : {},
    );
    const controller = new AbortController();
    const running = refusalOf(runtime.pdf.render(request(), { signal: controller.signal }));
    await Promise.resolve();
    controller.abort();
    expect((await running).code).toBe('render-cancelled');
    expect(workers.terminated).toBeGreaterThanOrEqual(1);
    await expect(runtime.pdf.render(request())).resolves.toHaveProperty('format', 'pdf');
  });

  it('recycles a worker once it has served the renders one may', async () => {
    const { runtime, workers } = await harness({ limits: { maxRendersPerWorker: 1 } });
    await runtime.pdf.render(request());
    await runtime.pdf.render(request());
    /* Recycled on the count alone, without a fault. */
    expect(workers.terminated).toBeGreaterThanOrEqual(2);
  });

  it('closes every slot when one of them could not be built at all', async () => {
    const browsers = fakeBrowsers();
    let created = 0;
    const failing = {
      create: async () => {
        created += 1;
        if (created > 1) {
          throw new Error('no second thread');
        }
        return await fakeWorkers().factory.create();
      },
    };
    await expect(
      createPuppeteerRenderRuntime({
        limits: { slots: 2 },
        workers: failing,
        browsers: browsers.factory,
      }),
    ).rejects.toThrow('no second thread');
    /* A half-built pool owns threads and browsers nobody would ever close. */
    expect(browsers.log.closedBrowsers).toBe(1);
  });
});

describe('the urls a manifest authorises', () => {
  it('names the exact sources it lists, and nothing else', () => {
    const authorises = manifestAuthorises([
      {
        kind: 'https',
        source: 'https://assets.example.com/logo.png',
        mediaType: 'image/png',
        sha256: '0'.repeat(64),
      },
    ]);
    expect(authorises('https://assets.example.com/logo.png')).toBe(true);
    expect(authorises('https://assets.example.com/other.png')).toBe(false);
    /* An entry cannot authorise a spelling that is not canonical, nor another scheme. */
    expect(authorises('https://assets.example.com/a/../logo.png')).toBe(false);
    expect(authorises('http://assets.example.com/logo.png')).toBe(false);
  });

  it('authorises nothing at all when the manifest is empty', () => {
    expect(manifestAuthorises([])('https://assets.example.com/logo.png')).toBe(false);
  });
});

describe('a worker that answers a value the runtime cannot read', () => {
  it('is treated as unprovable rather than its answer as usable', async () => {
    const browsers = fakeBrowsers();
    const nonsense = {
      create: () =>
        Promise.resolve({
          post: (message: ParentMessage) => {
            if (message.kind !== 'start') {
              return;
            }
            listeners?.onMessage({
              formatVersion: WORKER_PROTOCOL_VERSION,
              generation: message.generation,
              kind: 'done',
              renderId: message.renderId,
              outcome: { ok: true, value: 'not a document' },
            });
          },
          listen: (next: WorkerListeners) => {
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
    let listeners: WorkerListeners | undefined;
    const runtime = await createPuppeteerRenderRuntime({
      workers: nonsense,
      browsers: browsers.factory,
    });
    open.push(runtime);
    expect((await refusalOf(runtime.pdf.render(request()))).code).toBe('render-worker-failed');
    expect((await refusalOf(runtime.pagination.paginate(request()))).code).toBe(
      'render-worker-failed',
    );
  });
});

describe('a slot that could not be rebuilt', () => {
  it('is dropped from the pool rather than kept as a place nobody can use', async () => {
    const browsers = fakeBrowsers();
    let created = 0;
    const once = {
      create: async () => {
        created += 1;
        if (created > 2) {
          throw new Error('no replacement thread');
        }
        return await fakeWorkers({ hangs: true }).factory.create();
      },
    };
    const runtime = await createPuppeteerRenderRuntime({
      limits: { slots: 2, queueDepth: 4, renderTimeoutMs: 40 },
      workers: once,
      browsers: browsers.factory,
    });
    open.push(runtime);
    await Promise.all([
      refusalOf(runtime.pdf.render(request())),
      refusalOf(runtime.pdf.render(request())),
    ]);
    /* The callers were answered as soon as their cleanup was engaged, so the slots finish
       disposing after them. */
    await turns();
    /* Every browser a slot ever launched was closed, including the one a failed rebuild had just
       created: leaving it would keep a Chromium alive for the lifetime of the host. */
    expect(browsers.log.browsers).toBeGreaterThan(2);
    expect(browsers.log.closedBrowsers).toBe(browsers.log.browsers);
    expect((await refusalOf(runtime.pdf.render(request()))).code).toBe('render-capacity-exceeded');
  });
});

describe('what a manifest entry carrying its own bytes authorises', () => {
  it('authorises no connection at all, even when its source reads as a url', () => {
    /* The bytes are the file: reading their source as a reachable target would make a redirect to
       it a request this runtime never meant to allow. */
    const authorises = manifestAuthorises([
      {
        kind: 'bytes',
        source: 'https://assets.example.com/logo.png',
        mediaType: 'image/png',
        bytes: new Uint8Array([1]),
        sha256: '0'.repeat(64),
      },
    ]);
    expect(authorises('https://assets.example.com/logo.png')).toBe(false);
  });
});

describe('a request whose data set is not a set of named values', () => {
  const budget = { maxValues: 1_000, maxStringLength: 1_000 };

  it('is refused rather than replaced by an empty one', () => {
    /* A javascript caller reaches the port with whatever it has, and a document of blanks would be
       a worse answer than saying the request was not one. */
    for (const data of [[1, 2, 3], 'text', 42, null, undefined]) {
      const refused = refusalFrom(() => admitRequest(SMALL_TEMPLATE, data, budget));
      expect(refused.code).toBe('template-refused');
      expect(refused.details.phase).toBe('transport');
    }
  });

  it('admits a set of named values, whatever those names are', () => {
    expect(admitRequest(SMALL_TEMPLATE, { whateverTheHostCallsIt: 1 }, budget).data).toStrictEqual({
      whateverTheHostCallsIt: 1,
    });
  });
});

function refusalFrom(run: () => unknown): DocumentRenderError {
  try {
    run();
  } catch (error) {
    if (error instanceof DocumentRenderError) {
      return error;
    }
    throw error;
  }
  throw new Error('the request was admitted');
}
