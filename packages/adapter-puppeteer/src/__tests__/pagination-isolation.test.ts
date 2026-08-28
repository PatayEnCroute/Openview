import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { EvaluationScope } from '@openview/core';
import puppeteer, { type Browser } from 'puppeteer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HOST_LAUNCH_OPTIONS, paginateCapturing, templateOf } from './fixtures.js';

const CHROMIUM_TIMEOUT_MS = 120_000;

/** Every path a hostile document tried to reach, so "no request" is observed and not assumed. */
const reached: string[] = [];
let server: Server;
let origin: string;
let browser: Browser;

beforeAll(async () => {
  server = createServer((request, response) => {
    reached.push(request.url ?? '');
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('reachable');
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address() as AddressInfo;
  origin = `http://127.0.0.1:${address.port}`;
  browser = await puppeteer.launch({
    headless: true,
    ...(HOST_LAUNCH_OPTIONS.args === undefined ? {} : { args: [...HOST_LAUNCH_OPTIONS.args] }),
  });
}, CHROMIUM_TIMEOUT_MS);

/* The same watchdog the launch gets, and for the same reason: shutting a browser down while the
   whole suite holds several of them open takes longer than a default hook timeout allows. */
afterAll(async () => {
  await browser.close();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) {
        resolve();
        return;
      }
      reject(error);
    });
  });
}, CHROMIUM_TIMEOUT_MS);

/** A document whose every visible character comes from the dataset, and whose dataset attacks. */
const hostile = templateOf({
  root: {
    type: 'container',
    id: 'root',
    children: ['tags', 'closer', 'attribute', 'remote', 'local'].map((key) => ({
      type: 'text',
      id: key,
      content: [{ kind: 'binding', value: { kind: 'path', path: `payload.${key}` } }],
    })),
  },
});

const attackOf = (at: string): EvaluationScope => ({
  payload: {
    tags: `<script>window.__pwned = 1;</script><b>bold</b>`,
    closer: `</style><style>body{display:none}</style>`,
    attribute: `" onload="window.__pwned = 2" data-x="`,
    remote: `<img src="${at}/beacon.png"><script src="${at}/pwn.js"></script>`,
    local: `<iframe src="file:///etc/passwd"></iframe>`,
  },
});

/**
 * Loads the composed source the way V1 must: one sandboxed frame, with no script permission.
 *
 * `sandbox=""` gives the frame an opaque origin, so the host page cannot reach into it: what the
 * frame really holds is read through the debugger, which is exactly the isolation being proved.
 */
async function inSandboxedFrame(html: string): Promise<{
  readonly text: string;
  readonly pwned: unknown;
  readonly elements: number;
}> {
  const page = await browser.newPage();
  try {
    await page.setContent(
      '<!doctype html><html><body><iframe id="preview" sandbox=""></iframe></body></html>',
    );
    await page.evaluate((source: string) => {
      document.querySelector('#preview')?.setAttribute('srcdoc', source);
    }, html);
    const frame = await page.waitForFrame((one) => one.url() === 'about:srcdoc', {
      timeout: 30_000,
    });
    await frame.waitForSelector('.ov-page', { timeout: 30_000 });
    const read = await frame.evaluate(() => ({
      text: document.body.textContent ?? '',
      elements: document.querySelectorAll('script, iframe, img, object, embed').length,
    }));
    const pwned = await page.evaluate(() => (globalThis as Record<string, unknown>).__pwned);
    return { ...read, pwned };
  } finally {
    await page.close();
  }
}

describe('the source a pagination hands over, opened the way a preview must open it', () => {
  it(
    'keeps hostile text as text, runs no script and reaches no server',
    async () => {
      const { result } = await paginateCapturing(hostile, attackOf(origin));
      const before = reached.length;

      /* The policy travels in the markup, so it applies wherever the document is opened. It sits
         in an attribute, so the quotes a directive needs are written escaped. */
      const NONE = '&#39;none&#39;';
      expect(result.html).toContain('http-equiv="Content-Security-Policy"');
      expect(result.html).toContain(`script-src ${NONE}`);
      expect(result.html).toContain(`connect-src ${NONE}`);
      expect(result.html).toContain(`default-src ${NONE}`);
      /* Escaped at the source: the characters survive as text, and none of them opened a tag or
         an attribute. `onload=` still reads in the source -- with its quotes escaped, so it is
         character data inside a span rather than a handler on an element. */
      expect(result.html).not.toContain('<script');
      expect(result.html).not.toContain('onload="');
      expect(result.html).toContain('&lt;script&gt;');
      expect(result.html).toContain('&quot; onload=&quot;');

      const loaded = await inSandboxedFrame(result.html);
      expect(loaded.text).toContain('<script>window.__pwned = 1;</script>');
      expect(loaded.text).toContain('<b>bold</b>');
      expect(loaded.text).toContain('file:///etc/passwd');
      expect(loaded.elements).toBe(0);
      expect(loaded.pwned).toBeUndefined();
      expect(reached.length).toBe(before);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'never copies the composed source into a page entry or a notice',
    async () => {
      const { result } = await paginateCapturing(hostile, attackOf(origin));
      const manifest = JSON.stringify({ pages: result.pages, notices: result.notices });
      expect(manifest).not.toContain('script');
      expect(manifest).not.toContain('<');
      expect(manifest).not.toContain('doctype');
    },
    CHROMIUM_TIMEOUT_MS,
  );
});
