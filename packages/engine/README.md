# @openview/engine

An embeddable document engine. Give it a template and a data set; get a PDF back.

Openview lays out and prints. It is not a management system and not a data source: it stores
nothing, queries nothing, reserves no field name, and owns no clock — "today" is a value you pass
in, like every other date.

## Install

Node 24 or later. The engine decides the layout; a printer package does the printing.

```bash
npm install @openview/core @openview/engine @openview/adapter-puppeteer
pnpm add @openview/core @openview/engine @openview/adapter-puppeteer
yarn add @openview/core @openview/engine @openview/adapter-puppeteer
```

## Your first PDF

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

Three details of that snippet are decisions, not accidents:

- `stored: unknown` — `JSON.parse` returns `any`, and naming the value `unknown` is how it reaches
  `parseTemplate` without a cast.
- `presentationSelection` — the template names writing profiles; you map each one to a writing the
  template declares. Without it, the first formatted amount is refused.
- `data: INVOICE_DATA` — your data set is typed by you and never parsed by Openview. Its shape is
  not ours to know.

The walkthrough, with the template file and the first four things that can go wrong, is
[page 01 of the guide](../../docs/engine/en/01-first-pdf.md).

## You also need a printer

The engine decides where every line falls; it does not own a browser. Printing lives behind a port,
and [`@openview/adapter-puppeteer`](../adapter-puppeteer/README.md) is the implementation this
project ships. It is a separate package because Puppeteer downloads Chromium (150–300 MB), and an
integrator who only wants layout should not pay for one.

## What Openview computes, and what it does not

Openview computes what the template asks it to compute, and nothing else. It decides no tax rate,
no legal rounding, no exchange rate, no mandatory wording: rounding is declared by the model, and
every figure comes from you.

The accuracy and the compliance of a produced document belong to the integrating application and to
the author of the template. The clause in full is in the [project README](../../README.md).

## The guide

Six pages, in [English](../../docs/engine/en/00-contents.md) and in
[French](../../docs/engine/fr/00-contents.md): a first PDF, where a template and a data set come
from, what a refusal means, what to do with a document you do not control, and what is guaranteed
— along with what is not.

## Licence

Apache-2.0. The engine embeds three font families under the SIL Open Font License 1.1, pinned face
by face in [NOTICE](./NOTICE).
