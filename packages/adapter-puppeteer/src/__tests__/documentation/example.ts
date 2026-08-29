/**
 * The example the published guide quotes, verbatim and region by region.
 *
 * It lives in the suites because a printed example that is neither compiled nor run rots the day
 * the code moves. `documentation.test.ts` renders it through a real browser and compares the pages
 * to these regions.
 */

// #region first-pdf
import { readFile, writeFile } from 'node:fs/promises';
import { createPuppeteerPdfStrategy } from '@openview/adapter-puppeteer';
import { parseTemplate } from '@openview/core';
import { createPdfRenderPort } from '@openview/engine';
import { INVOICE_DATA } from './invoice-data.js';

export async function renderFirstInvoice(templatePath: string, outputPath: string): Promise<void> {
  const stored: unknown = JSON.parse(await readFile(templatePath, 'utf8'));
  const { bytes } = await createPdfRenderPort(createPuppeteerPdfStrategy(), {
    presentationSelection: { amount: 'fr-eur' },
  }).render({ template: parseTemplate(stored), data: INVOICE_DATA });
  await writeFile(outputPath, bytes);
}

if (process.argv[1] === import.meta.filename) {
  await renderFirstInvoice('./invoice.template.json', './invoice.pdf');
}
// #endregion first-pdf
