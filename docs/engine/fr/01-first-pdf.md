# Votre premier PDF

Cette page vous mène d'un dossier vide à une facture que vous pouvez ouvrir, en un quart d'heure.
Elle suppose que vous découvrez Openview, et que le modèle vous est fourni.

## Ce qu'il vous faut

- Node 24 ou plus.
- Un dossier hors de tout projet existant. Rien ici ne dépend de la façon dont ce dépôt est réglé.
- De la place pour Chromium : le paquet imprimeur télécharge un navigateur de 150 à 300 Mo.

## Préparer le dossier

Openview ne livre que de l'ESM, le projet doit donc le déclarer.

```bash
npm init -y
npm pkg set type=module
npm install @openview/core @openview/engine @openview/adapter-puppeteer
npm install --save-dev typescript @types/node
```

Avec pnpm, il y a une étape de plus : `pnpm approve-builds`, faute de quoi le téléchargement de
Chromium n'a jamais lieu et le premier rendu échoue en `pdf-export-failed`. Voir la
[page de l'imprimeur](../../../packages/adapter-puppeteer/README.fr.md).

## Les trois fichiers

**`invoice.template.json`** — le document. Prenez
[la facture de démonstration](../examples/invoice.template.json) et enregistrez-la sous ce nom.
C'est une facture d'une page : un titre, un tableau de lignes, un total, une échéance.

**`invoice-data.ts`** — les chiffres. Ils sont à vous : Openview ne réserve aucun nom de champ et
ne parse jamais cet objet.

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

**`example.ts`** — le rendu lui-même.

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

Deux lignes de ce fichier méritent une phrase. `stored: unknown` est la façon dont le JSON parsé
atteint `parseTemplate` sans cast — `JSON.parse` rend `any`, et c'est `parseTemplate` qui en fait un
modèle ou le refuse. `presentationSelection` associe le profil d'écriture que le modèle nomme,
`amount`, à l'une des écritures qu'il déclare : `fr-eur` ici, `en-usd` dans le même fichier.

## Exécuter

```bash
npx tsc example.ts invoice-data.ts --target ES2022 --module NodeNext --moduleResolution NodeNext
node example.js
```

`invoice.pdf` tient sur une page A4 : le numéro de facture, le client, l'échéance calculée à partir
d'`issuedOn` et de `termDays`, trois lignes avec leurs montants, un total, et un numéro de page en
pied. Les montants sont écrits en français et en euros parce que c'est l'écriture sélectionnée —
remplacez `fr-eur` par `en-usd` et le même document stocké s'imprime en dollars.

## Ça n'a pas marché

Quatre échecs couvrent presque tous les premiers essais.

- **`pdf-export-failed` d'emblée, avec un message qui parle du navigateur.** Chromium n'a pas été
  téléchargé. C'est le cas pnpm ci-dessus ; `npx puppeteer browsers install chrome` le règle aussi.
- **`TemplateShapeError` ou `TemplateMigrationError` à `parseTemplate`.** Le JSON n'est pas un
  modèle, ou il a été écrit par une version d'Openview plus récente que la vôtre.
- **`presentation-refused`.** Un site du modèle demande un profil d'écriture que vous n'avez pas
  sélectionné. Vérifiez que chaque profil de `presentationSelection` correspond à ce que le modèle
  nomme.
- **`missing-binding-value`.** Le modèle lit un chemin que votre jeu de données ne porte pas. Le
  refus nomme l'adresse lue, jamais la valeur.

Tous les codes, et la conduite à tenir, sont en [page 03](./03-when-it-fails.md).

Suite : [d'où viennent un modèle et un jeu de données](./02-template-and-data.md).
