import { createHash } from 'node:crypto';
import { type EvaluationScope, parseTemplate, type Template } from '@openview/core';
import { createPdfRenderPort, DocumentRenderError } from '@openview/engine';
import puppeteer from 'puppeteer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProtectedImageManifest } from '../resource/types.js';
import { createNodeWorkerFactory } from '../runtime/node-worker.js';
import {
  createPuppeteerRenderRuntime,
  type PuppeteerRenderRuntimeOptions,
} from '../runtime/runtime.js';
import {
  HOST_LAUNCH_OPTIONS,
  hostStrategy,
  inspectPdf,
  LOGO_PNG,
  pageOf,
  templateOf,
  text,
} from './fixtures.js';

/**
 * Room for Chromium to launch and lay a document out under a loaded machine.
 *
 * A watchdog against a hung browser, never a performance budget.
 */
const CHROMIUM_TIMEOUT_MS = 180_000;

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

const image = (id: string, src: string): Record<string, unknown> => ({
  type: 'image',
  id,
  src,
  alt: id,
});

const DOCUMENT: Template = templateOf({
  page: pageOf(120, 120),
  root: {
    type: 'container',
    id: 'root',
    children: [text('caption', 'hardened'), image('logo', LOGO_PNG)],
  },
});

const DATA: EvaluationScope = {};

/** The bytes of the logo, so a manifest can name it without an http server. */
const LOGO_BYTES = new Uint8Array(
  Buffer.from(LOGO_PNG.slice('data:image/png;base64,'.length), 'base64'),
);

/**
 * The compiled worker entry, which is where a published runtime finds it.
 *
 * These tests run from `src`, so the sibling the runtime resolves by default does not exist here;
 * `node-worker.test.ts` is what proves the default resolution itself.
 */
const workers = createNodeWorkerFactory(
  { oldSpaceMb: 256, stackMb: 4 },
  new URL('../../dist/runtime/worker.js', import.meta.url),
);

const hardened = (options: PuppeteerRenderRuntimeOptions = {}) =>
  createPuppeteerRenderRuntime({ ...options, launch: HOST_LAUNCH_OPTIONS, workers });

afterEach(() => {
  vi.restoreAllMocks();
});

async function refusalOf(run: Promise<unknown>): Promise<DocumentRenderError> {
  const caught: unknown = await run.catch((error: unknown) => error);
  if (caught instanceof DocumentRenderError) {
    return caught;
  }
  throw new Error(`expected a refusal, got ${String(caught)}`);
}

describe('the hardened runtime against a real browser', () => {
  it(
    'prints exactly the bytes the direct path prints',
    async () => {
      /* The whole point of the second façade: it isolates a render, it does not change one. A
         divergence here would mean the hardened path renders a different document, which no
         security property is worth. */
      const direct = await createPdfRenderPort(hostStrategy()).render({
        template: DOCUMENT,
        data: DATA,
      });
      const runtime = await hardened();
      try {
        const isolated = await runtime.pdf.render({ template: DOCUMENT, data: DATA });
        expect(sha256(isolated.bytes)).toBe(sha256(direct.bytes));
        expect((await inspectPdf(isolated.bytes)).pages).toBe(1);
      } finally {
        await runtime.close();
      }
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'prints the same document twice, through two renders of one slot',
    async () => {
      const runtime = await hardened();
      try {
        const first = await runtime.pdf.render({ template: DOCUMENT, data: DATA });
        const second = await runtime.pdf.render({ template: DOCUMENT, data: DATA });
        /* A reused browser must not carry anything from one render into the next. */
        expect(sha256(second.bytes)).toBe(sha256(first.bytes));
      } finally {
        await runtime.close();
      }
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'prints the same document from a manifest entry as from the inline source',
    async () => {
      const manifest: ProtectedImageManifest = [
        {
          kind: 'bytes',
          source: 'asset:logo',
          mediaType: 'image/png',
          bytes: LOGO_BYTES,
          sha256: sha256(LOGO_BYTES),
        },
      ];
      const byKey = templateOf({
        page: pageOf(120, 120),
        root: {
          type: 'container',
          id: 'root',
          children: [text('caption', 'hardened'), image('logo', 'asset:logo')],
        },
      });
      const runtime = await hardened({ imageManifest: manifest });
      try {
        const embedded = await runtime.pdf.render({ template: DOCUMENT, data: DATA });
        const brokered = await runtime.pdf.render({ template: byKey, data: DATA });
        /* An authorised asset produces the document its bytes would have produced inline: the
           broker embeds, it does not hand Chromium anything new. */
        expect(sha256(brokered.bytes)).toBe(sha256(embedded.bytes));
      } finally {
        await runtime.close();
      }
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'refuses an https source no manifest authorises, without opening a context',
    async () => {
      const remote = templateOf({
        page: pageOf(120, 120),
        root: {
          type: 'container',
          id: 'root',
          children: [image('logo', 'https://assets.example.invalid/logo.png')],
        },
      });
      let contexts = 0;
      const launch = puppeteer.launch.bind(puppeteer);
      vi.spyOn(puppeteer, 'launch').mockImplementation(async (options) => {
        const browser = await launch(options);
        const create = browser.createBrowserContext.bind(browser);
        browser.createBrowserContext = async (...args) => {
          contexts += 1;
          return await create(...args);
        };
        return browser;
      });
      const runtime = await hardened();
      try {
        const refused = await refusalOf(runtime.pdf.render({ template: remote, data: DATA }));
        expect(refused.code).toBe('resource-policy-refused');
        expect(refused.message).not.toContain('assets.example.invalid');
        /* Refused before a context exists, which is what "refused before loading" has to mean:
           the browser is launched with the slot, but nothing of this document reached it. */
        expect(contexts).toBe(0);
        /* And the runtime is still usable straight afterwards. */
        const witness = await runtime.pdf.render({ template: DOCUMENT, data: DATA });
        expect((await inspectPdf(witness.bytes)).pages).toBe(1);
        expect(contexts).toBe(1);
      } finally {
        await runtime.close();
      }
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'refuses a document past a logical ceiling before any browser work',
    async () => {
      const runtime = await hardened({ engine: { safetyLimits: { maxMaterializedUnits: 2 } } });
      try {
        const refused = await refusalOf(runtime.pdf.render({ template: DOCUMENT, data: DATA }));
        expect(refused.code).toBe('materialization-limit-exceeded');
      } finally {
        await runtime.close();
      }
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'refuses a data set that is not json, and survives it',
    async () => {
      const runtime = await hardened();
      try {
        /* One valid render first, so the refusal that follows is unmistakably the data set's. */
        const renamed = parseTemplate({ ...JSON.parse(JSON.stringify(DOCUMENT)), id: 'ok' });
        await runtime.pdf.render({ template: renamed, data: DATA });
        const refused = await refusalOf(
          runtime.pdf.render({
            template: DOCUMENT,
            /* A data set carrying a function is not json, and never crosses the boundary. */
            data: { trap: () => 1 },
          }),
        );
        expect(refused.code).toBe('template-refused');
        expect(refused.details.phase).toBe('transport');
      } finally {
        await runtime.close();
      }
    },
    CHROMIUM_TIMEOUT_MS,
  );
});
