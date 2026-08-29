# Les documents qu'on ne contrôle pas

Cette page traite le cas où le modèle, ou le jeu de données, peut venir de quelqu'un d'autre.
Rendre un document, c'est exécuter les instructions qu'il porte : la question n'est pas sa taille.

## Une question tranche

Qui a écrit le modèle, et qui a écrit le jeu de données ? Si l'un des deux peut venir d'un tiers —
un locataire, un client, un dépôt de fichier — le chemin direct est le mauvais outil. Prenez le
runtime durci.

<!-- docs-api: @openview/adapter-puppeteer createPuppeteerRenderRuntime -->
<!-- docs-api: @openview/adapter-puppeteer PuppeteerRenderRuntimeOptions -->
<!-- docs-region: protected-example.ts#untrusted -->

```ts
import {
  createPuppeteerRenderRuntime,
  type PuppeteerRenderRuntimeOptions,
} from '@openview/adapter-puppeteer';
import type { RenderRequest } from '@openview/core';

/** A service builds one runtime and keeps it; the three gestures are shown here in order. */
export async function renderUntrusted(
  options: PuppeteerRenderRuntimeOptions,
  request: RenderRequest,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const runtime = await createPuppeteerRenderRuntime(options);
  try {
    const { bytes } = await runtime.pdf.render(request, { signal });
    return bytes;
  } finally {
    await runtime.close();
  }
}
```

Le runtime possède des threads et des navigateurs : un service en construit un, le garde, et le
ferme à l'arrêt. `signal` est à vous — une requête HTTP abandonnée ne doit pas retenir un slot.

## Ce qui franchit l'isolat, et ce qui reste derrière

Le rendu s'exécute dans un worker, avec son tas et son contexte de navigateur. Seuls huit champs
d'un refus reviennent : `nodeId`, `path`, `region`, `limit`, `observed`, `pageNumber`, `phase` et
`resourceKind`. Les diagnostics, les causes et les piles restent de l'autre côté, parce que ce sont
eux qui peuvent citer du contenu de document.

## Les défauts

Tout ce qui suit est configurable, et chaque plafond a un maximum dur qu'un appelant ne peut pas
dépasser. Ce qu'un document peut construire, découper et sérialiser :

<!-- docs-defaults: DEFAULT_RENDER_SAFETY_LIMITS -->

| Clé | Défaut | Unité |
| :-- | -----: | :---- |
| `maxMaterializedUnits` | 250 000 | objets |
| `maxPages` | 100 | pages |
| `maxHtmlBytes` | 33 554 432 | octets (32 Mio) |

Ce qu'un runtime s'autorise en isolation, en attente et en recyclage :

<!-- docs-defaults: DEFAULT_RUNTIME_LIMITS -->

| Clé | Défaut | Unité |
| :-- | -----: | :---- |
| `slots` | 1 | rendus simultanés |
| `queueDepth` | 4 | requêtes en attente |
| `queueTimeoutMs` | 5 000 | ms |
| `renderTimeoutMs` | 30 000 | ms |
| `shutdownTimeoutMs` | 5 000 | ms |
| `workerStartTimeoutMs` | 5 000 | ms |
| `workerOldSpaceMb` | 256 | Mio |
| `workerStackMb` | 4 | Mio |
| `maxRendersPerWorker` | 100 | rendus avant recyclage |
| `maxTransportValues` | 500 000 | valeurs par requête |
| `maxTransportStringLength` | 67 108 864 | unités de code utf-16 |

Ce qu'un rendu peut charger, décoder et imprimer :

<!-- docs-defaults: DEFAULT_RESOURCE_LIMITS -->

| Clé | Défaut | Unité |
| :-- | -----: | :---- |
| `maxDistinctImages` | 64 | sources |
| `maxSourceLength` | 16 777 216 | caractères |
| `maxImageBytes` | 8 388 608 | octets (8 Mio) |
| `maxTotalImageBytes` | 33 554 432 | octets (32 Mio) |
| `maxImagePixels` | 25 000 000 | pixels |
| `maxTotalImagePixels` | 100 000 000 | pixels |
| `resourceTimeoutMs` | 10 000 | ms |
| `maxRedirects` | 3 | sauts |
| `maxRawPdfBytes` | 67 108 864 | octets (64 Mio) |
| `maxCanonicalPdfBytes` | 67 108 864 | octets (64 Mio) |

Le slot unique par défaut n'est pas une estimation timide : un runtime dont la capacité dépendrait
de l'hôte refuserait différemment sur deux machines, et lire la machine est exactement ce que ce
moteur refuse partout ailleurs.

## Images : rien n'est chargé qui ne soit épinglé

<!-- docs-api: @openview/adapter-puppeteer ProtectedImageManifest -->

Le runtime durci ne charge une image distante que si le manifeste nomme cette source exacte **et**
que l'empreinte des octets correspond au SHA-256 qu'il déclare. Une origine seule ne donne ni
intégrité, ni document reproductible. Les `data:` autonomes n'ont besoin d'aucune entrée ; tout le
reste est refusé par `resource-policy-refused`.

## Le regarder travailler

<!-- docs-api: @openview/adapter-puppeteer RENDER_AUDIT_CHANNEL -->

Chaque rendu publie un événement terminal sur le canal `node:diagnostics_channel` nommé
`openview.render.audit` : un identifiant local au runtime, l'issue, la phase, le code s'il y en a
un, et les deux durées. Rien d'autre — ni modèle, ni données, ni URL, ni empreinte, ni pile.
Abonnez-vous et ajoutez votre propre identité de requête.

<!-- docs-vocabulary: RENDER_OUTCOMES -->

- `succeeded` — un document est sorti.
- `refused` — le moteur a dit non, et le code dit pourquoi.
- `timed-out` — le rendu a survécu à son slot.
- `cancelled` — l'appelant l'a annulé.
- `failed` — quelque chose a cassé, qui n'est pas un refus.

## Ce que ce runtime ne fait pas

Il faut le dire franchement : une page de sécurité qui promet plus qu'elle ne tient est pire que
pas de page du tout.

- **La mémoire du processus n'est pas bornée.** `workerOldSpaceMb` borne la vieille génération d'un
  isolat V8. Cela ne couvre ni les `ArrayBuffer`, ni Chromium, qui vit dans ses propres processus.
  Un hôte qui expose ce runtime a besoin d'une limite de conteneur ou de cgroup.
- **Le corpus hostile outillé et son job CI ne sont pas livrés.** Les refus et la reprise sont
  prouvés par des suites unitaires et par un test qui tue un thread réellement bloqué ; il n'existe
  pas de registre d'attaques exécutable.
- **La mesure 60 pages / 60 000 lignes n'a pas été jouée.** Aucun chiffre de performance n'est
  avancé.
- **Aucune socket TLS n'est jamais ouverte dans ce dépôt.** La politique distante — manifeste,
  forme canonique, DNS épinglé, classe d'adresse, redirections, plafonds, empreinte — est prouvée
  contre un transport injecté. Un intégrateur qui active une entrée `https` est le premier à
  exercer ce chemin en vrai.

Ce sont les réserves de l'[ADR 0021](../../adr/0021-le-moteur-survit-a-un-document-hostile.md),
recopiées sans être adoucies.

Suite : [ce qui est garanti, et ce qui ne l'est pas](./05-guarantees-and-limits.md).
