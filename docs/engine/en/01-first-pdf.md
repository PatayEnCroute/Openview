# Your first PDF

This page takes you from an empty folder to an invoice you can open, in about fifteen minutes.
It assumes you have never seen Openview, and that the template is given to you.

## What you need

- Node 24 or later.
- A folder outside any existing project. Nothing here depends on how this repository is set up.
- Room for Chromium: the printer package downloads a browser build of 150–300 MB on install.

## Set up the folder

Openview ships ESM only, so the project has to say so.

```bash
npm init -y
npm pkg set type=module
npm install @openview/core @openview/engine @openview/adapter-puppeteer
npm install --save-dev typescript @types/node
```

With pnpm, add one step: `pnpm approve-builds`, or the Chromium download never runs and the first
render fails with `pdf-export-failed`. See the
[printer's page](../../../packages/adapter-puppeteer/README.md).

## The three files

**`invoice.template.json`** — the document. Take
[the demonstration invoice](../examples/invoice.template.json) and save it under that name. It is a
one-page invoice: a title, a table of lines, a total, a due date.

**`invoice-data.ts`** — the figures. They are yours: Openview reserves no field name and never
parses this object.

<!-- docs-region: invoice-data.ts#invoice-data -->

```ts
/** One billed line. `units` times `rate` is computed by the template, never by the caller. */
export interface InvoiceLine {
  readonly label: string;
  readonly units: number;
  readonly rate: number;
}

export interface Invoice {
  readonly reference: string;
  readonly customer: string;
  /** A civil date, `YYYY-MM-DD`. The engine owns no clock: today is a value you pass in. */
  readonly issuedOn: string;
  readonly termDays: number;
  readonly lines: readonly InvoiceLine[];
  readonly notice: string;
}

export const INVOICE_DATA: { readonly invoice: Invoice } = {
  invoice: {
    reference: 'F-2026-0117',
    customer: 'Longacre Works',
    issuedOn: '2026-03-02',
    termDays: 30,
    lines: [
      { label: 'Site survey', units: 2, rate: 480 },
      { label: 'Cabling, second floor', units: 1, rate: 1250.5 },
      { label: 'Commissioning', units: 3.5, rate: 120 },
    ],
    notice: 'Payment by transfer, quoting the invoice reference.',
  },
};
```

**`example.ts`** — the render itself.

<!-- docs-api: @openview/engine createPdfRenderPort -->
<!-- docs-region: example.ts#first-pdf -->

```ts
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
```

Two lines of that file are worth a sentence each. `stored: unknown` is how the parsed JSON reaches
`parseTemplate` without a cast — `JSON.parse` returns `any`, and `parseTemplate` is what turns it
into a template or refuses it. `presentationSelection` maps the writing profile the template names,
`amount`, to one of the writings the template declares: `fr-eur` here, `en-usd` in the same file.

## Run it

```bash
npx tsc example.ts invoice-data.ts --target ES2022 --module NodeNext --moduleResolution NodeNext
node example.js
```

`invoice.pdf` is one A4 page: the invoice number, the customer, the due date computed from
`issuedOn` plus `termDays`, three lines with their amounts, a total, and a page number in the foot.
Amounts are written in French and in euros because that is the writing you selected — swap
`fr-eur` for `en-usd` and the same stored document prints in dollars.

## It did not work

Four failures account for almost every first attempt.

- **`pdf-export-failed` right away, and the message mentions the browser.** Chromium was not
  downloaded. This is the pnpm case above; `npx puppeteer browsers install chrome` also fixes it.
- **`TemplateShapeError` or `TemplateMigrationError` at `parseTemplate`.** The JSON is not a
  template, or it was written by a newer release of Openview than the one you installed.
- **`presentation-refused`.** A site of the template asks for a writing profile you did not select.
  Check that every profile in `presentationSelection` matches what the template names.
- **`missing-binding-value`.** The template reads a path your data set does not hold. The refusal
  names the address it read, never the value.

Every code, and what to do about it, is on [page 03](./03-when-it-fails.md).

Next: [where a template and a data set come from](./02-template-and-data.md).
