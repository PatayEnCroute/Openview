import { parseTemplate, type RenderRequest } from '@openview/core';
import { DocumentRenderError } from '@openview/engine';
import { describe, expect, it } from 'vitest';
import { createNodeWorkerFactory, WORKER_ENTRY } from '../node-worker.js';
import { createPuppeteerRenderRuntime, type PuppeteerRenderRuntime } from '../runtime.js';
import { fakeBrowsers, SMALL_DATA, SMALL_TEMPLATE } from './fixtures.js';

/**
 * The compiled worker entry, as the published package resolves it.
 *
 * Built by the `build` task the test script runs first: this file is what a real runtime starts a
 * thread on, and a thread cannot be instrumented from the one that spawned it, so it is proved by
 * running it rather than by reading it.
 */
const BUILT_ENTRY = new URL('../../../dist/runtime/worker.js', import.meta.url);

/** A fixture thread that answers once and then never yields to its event loop again. */
const BLOCKED_ENTRY = new URL('./blocked-worker.mjs', import.meta.url);

const request = (): RenderRequest => ({
  template: parseTemplate(SMALL_TEMPLATE),
  data: SMALL_DATA,
});

const WORKER_LIMITS = { oldSpaceMb: 128, stackMb: 4 };

async function refusalOf(run: Promise<unknown>): Promise<DocumentRenderError> {
  const caught: unknown = await run.catch((error: unknown) => error);
  if (caught instanceof DocumentRenderError) {
    return caught;
  }
  throw new Error(`expected a refusal, got ${String(caught)}`);
}

describe('the worker entry a published runtime starts', () => {
  it('is resolved next to the module that starts it', () => {
    expect(WORKER_ENTRY.pathname.endsWith('/runtime/worker.js')).toBe(true);
  });

  it('renders a document end to end in a real thread', async () => {
    const browsers = fakeBrowsers();
    const runtime: PuppeteerRenderRuntime = await createPuppeteerRenderRuntime({
      workers: createNodeWorkerFactory(WORKER_LIMITS, BUILT_ENTRY),
      browsers: browsers.factory,
    });
    try {
      const result = await runtime.pdf.render(request());
      expect(Buffer.from(result.bytes.subarray(0, 5)).toString('latin1')).toBe('%PDF-');
      expect(browsers.log.contexts).toBe(1);
      expect(browsers.log.closedContexts).toBe(1);
    } finally {
      await runtime.close();
    }
  }, 30_000);

  it('reports a refusal of the document without carrying anything of it', async () => {
    const browsers = fakeBrowsers();
    const runtime = await createPuppeteerRenderRuntime({
      workers: createNodeWorkerFactory(WORKER_LIMITS, BUILT_ENTRY),
      browsers: browsers.factory,
      engine: { safetyLimits: { maxMaterializedUnits: 1 } },
    });
    try {
      const refused = await refusalOf(runtime.pdf.render(request()));
      expect(refused.code).toBe('materialization-limit-exceeded');
      expect(refused.details.limit).toBe(1);
      expect(refused.cause).toBeUndefined();
      /* Nothing was measured, so no context was ever opened for it. */
      expect(browsers.log.contexts).toBe(0);
    } finally {
      await runtime.close();
    }
  }, 30_000);
});

describe('a thread that has really stopped answering', () => {
  it('is terminated at the deadline, and the slot serves the next render', async () => {
    const browsers = fakeBrowsers();
    let entry = BLOCKED_ENTRY;
    const runtime = await createPuppeteerRenderRuntime({
      limits: { renderTimeoutMs: 300 },
      workers: {
        create: async () => {
          const handle = await createNodeWorkerFactory(WORKER_LIMITS, entry).create();
          /* The replacement thread is a working one, so the witness after the attack is a real
             render rather than a second refusal. */
          entry = BUILT_ENTRY;
          return handle;
        },
      },
      browsers: browsers.factory,
    });
    try {
      const refused = await refusalOf(runtime.pdf.render(request()));
      expect(refused.code).toBe('render-timeout');
      /* A promise that rejected is not a freed capacity: the thread must really be gone. */
      const witness = await runtime.pdf.render(request());
      expect(Buffer.from(witness.bytes.subarray(0, 5)).toString('latin1')).toBe('%PDF-');
    } finally {
      await runtime.close();
    }
  }, 30_000);
});
