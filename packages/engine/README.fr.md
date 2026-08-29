# @openview/engine

Un moteur de documents embarquable. Vous lui donnez un modèle et un jeu de données, il rend un PDF.

Openview met en page et imprime. Ce n'est ni un logiciel de gestion, ni une source de données : il
ne conserve rien, n'interroge rien, ne réserve aucun nom de champ et n'a pas d'horloge —
« aujourd'hui » est une valeur que vous fournissez, comme toute autre date.

## Installation

Node 24 ou plus. Le moteur décide de la mise en page ; un paquet imprimeur fait l'impression.

```bash
npm install @openview/core @openview/engine @openview/adapter-puppeteer
pnpm add @openview/core @openview/engine @openview/adapter-puppeteer
yarn add @openview/core @openview/engine @openview/adapter-puppeteer
```

## Votre premier PDF

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

Trois détails de cet extrait sont des décisions, pas des accidents :

- `stored: unknown` — `JSON.parse` rend `any`, et nommer la valeur `unknown` est la façon de la
  faire arriver jusqu'à `parseTemplate` sans écrire de cast.
- `presentationSelection` — le modèle nomme des profils d'écriture ; vous associez chacun d'eux à
  une écriture que le modèle déclare. Sans cela, le premier montant formaté est refusé.
- `data: INVOICE_DATA` — votre jeu de données est typé chez vous et jamais reparsé par Openview.
  Sa forme ne nous appartient pas.

Le déroulé complet, avec le fichier de modèle et les quatre premiers échecs possibles, est en
[page 01 du guide](../../docs/engine/fr/01-first-pdf.md).

## Il vous faut aussi un imprimeur

Le moteur décide où tombe chaque ligne ; il ne possède pas de navigateur. L'impression vit derrière
un port, et [`@openview/adapter-puppeteer`](../adapter-puppeteer/README.fr.md) en est
l'implémentation livrée ici. C'est un paquet séparé parce que Puppeteer télécharge Chromium
(150–300 Mo), et qu'un intégrateur qui ne veut que la mise en page n'a pas à le payer.

## Ce qu'Openview calcule, et ce qu'il ne calcule pas

Openview calcule ce que le modèle lui demande de calculer, et rien d'autre. Il ne décide aucun taux
de taxe, aucun arrondi légal, aucun taux de change, aucune mention obligatoire : l'arrondi est
déclaré par le modèle, et tous les chiffres viennent de vous.

L'exactitude et la conformité d'un document produit relèvent de l'application intégratrice et de
l'auteur du modèle. La clause complète est dans le [README du projet](../../README.md).

## Le guide

Six pages, en [français](../../docs/engine/fr/00-contents.md) et en
[anglais](../../docs/engine/en/00-contents.md) : un premier PDF, d'où viennent un modèle et un jeu
de données, ce que veut dire un refus, que faire d'un document qu'on ne contrôle pas, et ce qui est
garanti — avec ce qui ne l'est pas.

## Licence

Apache-2.0. Le moteur incorpore trois familles de polices sous SIL Open Font License 1.1, épinglée
face par face dans [NOTICE](./NOTICE).
