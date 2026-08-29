import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import puppeteer from 'puppeteer';
import { afterEach, expect, it, vi } from 'vitest';
import { renderFirstInvoice } from './documentation/example.js';
import { HOST_LAUNCH_OPTIONS } from './fixtures.js';

/** Room for Chromium to launch and lay the example out on a loaded machine. */
const CHROMIUM_TIMEOUT_MS = 120_000;

const TEMPLATE = fileURLToPath(
  new URL('../../../../docs/engine/examples/invoice.template.json', import.meta.url),
);

const HOST_ARGS = HOST_LAUNCH_OPTIONS.args;

/**
 * Lends the example the launch arguments this host needs, without writing them into the example.
 *
 * A published snippet must not teach `--no-sandbox`: dropping the sandbox is a decision only a
 * caller running without one can take, so the adaptation belongs to the test. The rebuilt options
 * are the ones the adapter itself sends, plus the arguments of the host.
 */
function launchAsHostCan(): void {
  const launch = puppeteer.launch.bind(puppeteer);
  vi.spyOn(puppeteer, 'launch').mockImplementation(
    async () =>
      await launch({
        headless: true,
        ...(HOST_ARGS === undefined ? {} : { args: [...HOST_ARGS] }),
      }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

it(
  'renders the published example into a real one-page pdf',
  async () => {
    launchAsHostCan();
    const directory = await mkdtemp(join(tmpdir(), 'openview-docs-'));
    try {
      const output = join(directory, 'invoice.pdf');
      await renderFirstInvoice(TEMPLATE, output);
      const bytes = await readFile(output);
      expect(bytes.byteLength).toBeGreaterThan(0);
      expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      const pdf = await PDFDocument.load(bytes);
      expect(pdf.getPageCount()).toBe(1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  CHROMIUM_TIMEOUT_MS,
);
