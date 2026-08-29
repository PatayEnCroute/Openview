# Plan d'implémentation — `@openview/engine` lot E9 : la documentation du moteur

> **Statut :** plan prêt à exécuter, **sans mandat** — 2026-08-29
> **Lot :** E9 — poids S annoncé, **S confirmé** si les exclusions du §2.2 restent fermées
> **Dépend de :** E7 selon la roadmap ; baseline réelle E1 à E8
> **Condition de :** J7 (publication groupée)
> **Décision d'exécution attendue :** ADR 0022

E9 écrit la documentation d'usage du moteur, **en français et en anglais**, pour un développeur
qui ne connaît pas le projet. Elle tient deux promesses et pas une de plus : **obtenir un PDF en
une dizaine de lignes**, et **comprendre chaque refus** que le moteur peut opposer.

Deux paquets sont documentés ensemble, parce qu'ils ne servent à rien séparément :
`@openview/engine` décide de la mise en page, `@openview/adapter-puppeteer` imprime. Un lecteur
qui installe le premier seul n'obtient aucun document, et c'est délibéré
([AGENTS.md §3.C](../../AGENTS.md)).

E9 n'écrit **aucune ligne de production**. Il n'ajoute ni option, ni export, ni message d'erreur :
si une page ne peut pas être écrite sans changer le code, c'est le code qui a un défaut, et ce
défaut appartient au lot qui l'a livré — pas à celui-ci.

---

## 0. Résultat attendu

### 0.1 Les dix lignes

La page d'entrée montre ceci, et rien de plus long :

```ts
import { readFile, writeFile } from 'node:fs/promises';
import { createPuppeteerPdfStrategy } from '@openview/adapter-puppeteer';
import { parseTemplate } from '@openview/core';
import { createPdfRenderPort } from '@openview/engine';
import { INVOICE_DATA } from './invoice-data.js';

export async function renderFirstInvoice(templatePath: string, outputPath: string): Promise<void> {
  const stored: unknown = JSON.parse(await readFile(templatePath, 'utf8'));
  const port = createPdfRenderPort(createPuppeteerPdfStrategy(), {
    presentationSelection: { amount: 'fr-eur' },
  });
  const { bytes } = await port.render({ template: parseTemplate(stored), data: INVOICE_DATA });
  await writeFile(outputPath, bytes);
}
```

Onze lignes, imports compris : « dix lignes » est la formule de la roadmap, le budget exécutoire
est de **quinze lignes au plus**. Trois détails de cet extrait sont des décisions, pas des
accidents, et la page les explique en une phrase chacun :

- `stored: unknown` — `JSON.parse` rend `any`, et le renommer `unknown` est la seule façon
  d'atteindre `parseTemplate` sans écrire un cast que ce dépôt interdit
  ([AGENTS.md §1.1](../../AGENTS.md)) ;
- `presentationSelection` — sans elle, le premier montant formaté rend `presentation-refused`.
  C'est le refus n° 1 d'un premier essai : il est dans l'extrait, pas dans une note de bas de page ;
- `data: INVOICE_DATA` — le jeu de données est **typé chez l'appelant** et jamais reparsé par
  Openview : sa forme ne nous appartient pas
  ([ADR 0015](../adr/0015-le-catalogue-de-donnees-de-l-integrateur.md)).

### 0.2 Ce que « sans nous écrire » veut dire

La roadmap dit : *prêt quand quelqu'un d'extérieur produit sa première facture sans nous écrire*.
L'énoncé n'est pas mesurable tel quel avant la publication (décision 2 : rien de public avant J7).
Ce lot le remplace par une **répétition à froid**, jouable aujourd'hui, décrite au §9 :

```text
pnpm pack des trois paquets  →  installation des .tgz dans un dossier vide hors du dépôt  →
la page 01 suivie à la lettre, sans ouvrir une ligne de source  →  un PDF valide sort
```

Un participant obligé d'ouvrir un fichier de `packages/` pour avancer fait échouer la répétition.
C'est le seul critère qui prouve la promesse ; tout le reste empêche la documentation de pourrir,
sans prouver qu'elle sert.

### 0.3 Ce que cette documentation n'est pas

- Ce n'est pas une **référence d'API exhaustive**. Les deux paquets exportent plus de soixante
  symboles ; la documentation en nomme une quinzaine et assume le reste comme surface avancée,
  lisible dans les types publiés.
- Ce n'est pas le **manuel du contrat de modèle**. Écrire un `Template` à la main relève de
  `@openview/core` et de l'éditeur ; ici, le modèle est **fourni**.
- Ce n'est ni une ADR, ni un journal de lot. Aucun numéro de lot, aucun hash de commit, aucune
  histoire de brouillon rejeté n'entre dans une page destinée à un lecteur extérieur — l'esprit de
  [AGENTS.md §1.6](../../AGENTS.md) vaut ici même si sa lettre vise le code.

---

## 1. Baseline et écarts

### 1.1 Sources qui font foi

- [roadmap moteur, E9](../roadmap/engine.md) et la [vue d'ensemble](../roadmap/README.md) —
  chantier transverse « documentation d'intégration », condition de J7 ;
- [AGENTS.md](../../AGENTS.md) : périmètre, §1.1 typage, §1.6 hygiène documentaire, §7 fichiers
  protégés ;
- [README](../../README.md), section « Calculs, conformité et responsabilité » — la clause de la
  décision 16, **à reprendre dans la documentation de chaque brique** ;
- de l'[ADR 0012](../adr/0012-une-facture-d-une-page-sort-en-pdf.md) à
  l'[ADR 0021](../adr/0021-le-moteur-survit-a-un-document-hostile.md) : ce sont elles qui disent
  ce qui est garanti, et surtout ce qui ne l'est pas ;
- le code publié : [`packages/engine/src/index.ts`](../../packages/engine/src/index.ts),
  [`packages/adapter-puppeteer/src/index.ts`](../../packages/adapter-puppeteer/src/index.ts),
  [`packages/engine/src/errors.ts`](../../packages/engine/src/errors.ts).

### 1.2 Ce que le dépôt livre déjà

| Besoin E9 | Baseline | Réemploi imposé |
| :--- | :--- | :--- |
| exemple exécutable | `packages/adapter-puppeteer/src/__tests__/` lance un vrai Chromium sous Vitest | l'extrait publié est un module de ce dossier, jamais un bloc recopié |
| outillage hors paquet | `tools/golden/*.mjs` + `*.d.mts`, importés par un test type-checké | même patron pour `tools/docs/` : aucun tsconfig, aucun workflow à ouvrir |
| vocabulaire de refus | 31 codes, 10 phases, détails structurés (`errors.ts`) | la table des refus est **comparée** à ces constantes, jamais recopiée à la main |
| bornes par défaut | `DEFAULT_RENDER_SAFETY_LIMITS`, `DEFAULT_RUNTIME_LIMITS`, `DEFAULT_RESOURCE_LIMITS` | les chiffres publiés sont relus dans le code par la porte |
| clause de responsabilité | README racine, section dédiée | citée et liée, jamais reformulée |
| réserves honnêtes | ADR 0019, 0020, 0021, § « ce qui reste ouvert » | recopiées sans être adoucies |
| licence des polices | `NOTICE` de `packages/engine` (SIL OFL 1.1) | cité par la page des garanties |

### 1.3 Les sept écarts à combler

1. **Aucun paquet n'a de README.** `engine` et `adapter-puppeteer` n'exposent que `LICENSE` et
   `NOTICE` : une page npm serait vide.
2. **Aucune documentation en anglais** n'existe dans le dépôt, alors que la publication est
   open-source et que l'anglais est la langue d'un intégrateur inconnu.
3. **Aucun exemple installable** : le seul modèle complet vit dans le playground
   (`apps/playground/src/examples/reference-invoice.ts`, 31 ko), qui n'est pas publié.
4. **Aucun extrait vérifié** : rien n'empêche aujourd'hui d'écrire dans un document un appel qui
   ne compile pas.
5. **Aucune table des refus** : les 31 codes ne se lisent que dans le source, et un intégrateur ne
   sait pas lequel est de sa faute, lequel est celle du modèle, lequel signale un abus.
6. **Le chemin durci n'est documenté nulle part** hors ADR 0021, alors qu'il est la seule façade
   qu'un service peut pointer vers un document non fiable.
7. **Deux textes du dépôt sont en retard sur le dépôt** :
   l'[ADR 0020](../adr/0020-le-lot-de-documents-figes-de-non-regression.md) et la
   [roadmap moteur](../roadmap/engine.md) annoncent le corpus E7 « en attente d'amorçage » alors
   que les six PDF de référence sont committés (`tests/golden/e7/references/`, commit `b370698`).
   Une documentation publique qui recopierait ce statut publierait un mensonge.

### 1.4 Vérifications faites pendant la planification

| Question | Réponse constatée | Conséquence sur le plan |
| :--- | :--- | :--- |
| Un test peut-il lancer Chromium dans la suite standard ? | oui — `puppeteer-pdf-strategy.test.ts` le fait, budget 120 s | l'exemple est **exécuté** par `pnpm run test`, sans job CI nouveau |
| Un test peut-il importer un module de `tools/` ? | oui — `golden-tooling.test.ts` en importe sept, typés par `.d.mts` | la porte documentaire est un module `tools/docs/`, pas une dépendance |
| Le seuil de couverture est-il menacé ? | `coverage.include` vaut `packages/*/src/**` | `tools/docs/` n'est pas instrumenté ; le module d'exemple, sous `src/__tests__/`, l'est et est exécuté |
| Combien de codes et de phases, exactement ? | **31 codes**, **10 phases** | la table des refus a 31 lignes, vérifiées par égalité d'ensembles |
| Le chemin direct fuit-il un navigateur ? | non : une session par rendu, fermée par le pipeline | la page 01 n'apprend aucun `close()` inutile |
| npm publie-t-il un README absent de `files` ? | **oui, et `README.fr.md` aussi** — sonde jetable : `files: ["dist","LICENSE"]`, `npm pack --dry-run` embarque `README.md` **et** `README.fr.md`, mais pas `NOTICE` | **aucun mandat** : les deux langues partent dans le paquet sans qu'un `package.json` soit ouvert |
| Un module de `src/__tests__/` part-il dans le tarball ? | non : `files` porte `!dist/**/__tests__/**` | le module d'exemple y vit sans être publié |

---

## 2. Périmètre fermé

### 2.1 Inclus dans E9

- deux README de paquet en anglais, et leur jumeau français ;
- un guide de **cinq pages plus un sommaire**, dans les deux langues ;
- un modèle d'exemple et son jeu de données, écrits une seule fois, langue-neutres ;
- un module d'exemple **compilé et exécuté**, dont les pages citent des régions *verbatim* ;
- une porte documentaire outillée (`tools/docs/check.mjs`), jouée par la suite de tests ;
- la correction des deux textes en retard nommés au §1.3, point 7 ;
- l'ADR 0022 de clôture, et la mise à jour du statut E9 dans la roadmap moteur.

### 2.2 Exclus, avec leur propriétaire

| Exclu | Propriétaire |
| :--- | :--- |
| documentation de `@openview/core` (contrat, AST, formules) | `core` — **aucun lot ne la porte**, voir §12 |
| documentation de l'aperçu | [viewer](../roadmap/viewer.md), V6 |
| documentation de l'éditeur et guide de l'utilisateur final | [designer](../roadmap/designer.md), D12 |
| documentation du service, et « où ne pas le déployer » | [service](../roadmap/service-de-rendu.md), S4 |
| exemples d'intégration complets à copier | chantier transverse, après J5 |
| démo en ligne | chantier transverse, après J6 |
| site de documentation, recherche, versionnement des pages | hors v1 : six fichiers Markdown par langue se lisent sur GitHub |
| traduction dans une troisième langue | hors v1 ; la porte du §7 accepte n langues sans modification |

### 2.3 Le budget de lignes — une concision qui n'est pas outillée n'existe pas

| Fichier (par langue) | Plafond | Raison |
| :--- | ---: | :--- |
| `README` de `engine` | 120 | page d'atterrissage, pas manuel |
| `README` de `adapter-puppeteer` | 80 | il redirige vers le guide du moteur |
| `00-contents` | 40 | six liens, une phrase chacun |
| `01-first-pdf` | 150 | installer, exécuter, comprendre le premier échec |
| `02-template-and-data` | 150 | d'où vient un modèle, d'où viennent les données |
| `03-when-it-fails` | 220 | 31 lignes de table, plus les détails d'erreur |
| `04-untrusted-documents` | 150 | la façade durcie et ses réserves |
| `05-guarantees-and-limits` | 120 | ce qui est promis, ce qui ne l'est pas |
| **Total par langue** | **1 030** | un dépassement fait échouer la porte, il ne fait pas l'objet d'une remarque de revue |

Trois contraintes de forme complètent le budget, toutes vérifiées : **largeur de ligne ≤ 100**
(celle de Biome, [`biome.jsonc`](../../biome.jsonc)), **profondeur de titre ≤ 3**, **un seul H1**.

### 2.4 Aucun contrat, aucun code de production ne bouge

Ni `Template`, ni `RenderRequest`, ni un code d'erreur ne gagnent quoi que ce soit : **pas
d'incrément de `schemaVersion`, pas de migration**. **Aucun fichier protégé par
[AGENTS.md §7](../../AGENTS.md) n'est touché** — ni `package.json`, ni un `tsconfig`, ni un
workflow.

---

## 3. Mandats : aucun

Un mandat était prévu ici — inscrire `README.fr.md` dans le champ `files` des deux paquets, faute
de quoi npm ne l'aurait pas embarqué. **La sonde du §1.4 l'a rendu inutile** : `npm pack --dry-run`
embarque tout fichier `README*`, quelle que soit la liste `files`. Le français part donc dans le
paquet sans qu'un `package.json` soit ouvert.

C'est la règle du dépôt appliquée à ce plan : une sonde jetable plutôt qu'un souvenir, et le
mandat disparaît avec la raison qui le motivait. La vérification reste jouée en INC-0, parce qu'une
montée de npm peut changer cette règle en silence.

### 3.1 Ce que l'exécution n'a pas à demander

- **Aucun job CI.** La porte documentaire s'exécute dans la suite Vitest, donc déjà dans
  `build-and-test`. `.github/workflows/ci.yml` n'est pas ouvert.
- **Aucune vérification d'emballage à écrire.** Si le chantier `tools/packaging/surface.mjs`, en
  cours au moment de ce plan, est livré, il lit déjà `npm pack --dry-run` et verra les nouveaux
  README sans une ligne de plus. Sinon, INC-0 joue la commande à la main : dans les deux cas, E9
  n'écrit pas de second contrôle.
- **Aucune dépendance.** `node:fs`, `node:path` et Vitest suffisent : pas de linter Markdown, pas
  de générateur de site, aucune entrée `minimumReleaseAgeExclude`.
- **Aucun `tsconfig`, `turbo.json` ni `biome.jsonc`.** Le patron `tools/*.mjs` + `.d.mts` existe
  pour cela.
- **Aucun changement du playground.** Il garde son catalogue ; la documentation a le sien, plus
  petit et lisible.

---

## 4. Décisions

### D1 — Un seul guide pour deux paquets

Le lecteur ne cherche pas « la doc de l'adaptateur » : il cherche un PDF. Le guide est celui du
moteur ; le README de l'adaptateur dit ce qu'il est, ce qu'il télécharge, et renvoie.

### D2 — L'anglais est publié, le français est du dépôt, aucun des deux n'est généré

`README.md` est en anglais parce que c'est ce que voit un inconnu sur npm et sur GitHub.
`README.fr.md` est son jumeau. Les deux sont **écrits**, jamais traduits automatiquement : une
traduction générée vieillit sans que personne ne la relise, et ce dépôt n'a pas de relecteur de
plus. Ce qui est vérifié par une machine, c'est leur **structure**, pas leur sens (§7.2).

### D3 — Mêmes noms de fichiers dans les deux arbres

`docs/engine/en/03-when-it-fails.md` et `docs/engine/fr/03-when-it-fails.md`. Un nom traduit
rendrait l'appariement heuristique, donc faux un jour. Le titre H1, lui, est dans la langue de la
page.

### D4 — Les blocs de code sont identiques octet pour octet entre les deux langues

Le code et ses commentaires sont en anglais partout ([AGENTS.md §1.6](../../AGENTS.md)), donc rien
dans un extrait ne dépend de la langue de la page. La porte compare les blocs à l'octet : une page
modifiée seule est refusée.

### D5 — Aucun extrait n'est écrit dans une page

Chaque bloc `ts` est une **région d'un module réel**, compilé par `type-check` et exécuté par
Vitest. La page cite la région ; la porte compare. Un extrait ne peut donc pas mentir, et c'est le
seul mécanisme de ce plan qui empêche la documentation de vieillir toute seule.

### D6 — Les actifs d'exemple existent une fois, hors des arbres de langue

`docs/engine/examples/invoice.template.json` est le modèle de démonstration : un document stocké,
donc du JSON, donc langue-neutre. Le jeu de données, lui, est une **région TypeScript** du module
d'exemple : il est typé chez l'appelant, et le montrer sous forme de fichier JSON à reparser
apprendrait exactement le geste que l'ADR 0015 refuse.

### D7 — La table des refus est fermée dans les deux sens

Elle contient les 31 codes, ni plus ni moins. Un code ajouté plus tard sans sa ligne fait échouer
la porte ; une ligne inventée aussi. C'est le même principe que le registre fermé d'E7.

### D8 — Aucun chiffre de borne n'est recopié à la main

Les plafonds publiés (250 000 objets, 100 pages, 32 Mio d'HTML, 64 Mio de PDF, 1 slot…) sont
comparés aux constantes exportées. Le jour où un défaut change, la page qui l'annonce échoue.

### D9 — Les réserves des ADR sont recopiées sans être adoucies

La page des documents non fiables dit ce que dit
l'[ADR 0021](../adr/0021-le-moteur-survit-a-un-document-hostile.md) : `resourceLimits` ne borne ni
les `ArrayBuffer`, ni Chromium ; le corpus hostile outillé, le
job CI dédié et la mesure 60 pages / 60 000 lignes ne sont pas livrés ; aucune socket TLS n'a été
ouverte dans ce dépôt. Une page de sécurité qui promet plus que son ADR est pire qu'une page
absente.

### D10 — La clause de responsabilité est citée et liée, jamais reformulée

La décision 16 exige qu'elle figure dans la documentation de chaque brique. Elle est reprise en
trois phrases et **renvoie au README racine**, qui reste la source. Une reformulation créerait deux
textes, donc un jour deux périmètres.

### D11 — La porte documentaire vit dans la suite de tests

Un contrôle qui n'appartient à aucune des quatre portes n'est pas un contrôle. Il vit dans Vitest,
il est donc joué par `pnpm run test:coverage` en local et par `build-and-test` en CI, sans qu'un
fichier de workflow soit ouvert.

### D12 — E9 corrige les deux textes en retard avant de publier quoi que ce soit

L'ADR 0020 et la roadmap moteur sont mises à jour dans le premier incrément : E9 ne documente pas
un état que le dépôt a dépassé. La correction est **factuelle** — le corpus est committé — et
n'ouvre aucune décision d'E7.

---

## 5. Carte des fichiers

```text
packages/engine/README.md                      en — publié par npm
packages/engine/README.fr.md                   fr
packages/adapter-puppeteer/README.md           en
packages/adapter-puppeteer/README.fr.md        fr

docs/engine/en/00-contents.md                  sommaire
docs/engine/en/01-first-pdf.md
docs/engine/en/02-template-and-data.md
docs/engine/en/03-when-it-fails.md
docs/engine/en/04-untrusted-documents.md
docs/engine/en/05-guarantees-and-limits.md
docs/engine/fr/…                               les six mêmes noms

docs/engine/examples/invoice.template.json     le modèle de démonstration, langue-neutre

packages/adapter-puppeteer/src/__tests__/documentation/example.ts        régions citées
packages/adapter-puppeteer/src/__tests__/documentation.test.ts           exécute et vérifie

tools/docs/check.mjs                           la porte : parité, budget, extraits, liens
tools/docs/check.d.mts                         ses types, pour que le test soit type-checké

docs/adr/0022-la-documentation-du-moteur.md    clôture
```

Fichiers modifiés, et rien d'autre : `README.md` (un lien vers le guide),
`docs/roadmap/engine.md` (statut E9 et correction du §1.3.7),
`docs/adr/0020-…md` (statut). **Aucun `package.json`, aucun `tsconfig`, aucun workflow.**

---

## 6. Le contenu exact des pages

Chaque page s'ouvre sur deux phrases : **ce qu'elle répond**, **pour qui**. Chaque section tient en
vingt lignes. Chaque page se termine par un lien « suite ».

### 6.1 `README` de `@openview/engine` — 120 lignes

1. une phrase : un moteur de rendu de documents embarquable, qui reçoit un modèle et un jeu de
   données et rend un PDF ;
2. ce qu'il n'est pas : ni source de données, ni logiciel de gestion, ni moteur fiscal, ni horloge ;
3. installation, en trois gestionnaires de paquets, avec la mention Node ≥ 24 ;
4. l'extrait du §0.1 ;
5. **« Il vous faut aussi un imprimeur »** : `@openview/adapter-puppeteer`, et pourquoi il est un
   paquet séparé (Chromium, 150–300 Mo) ;
6. la clause « calculs, conformité et responsabilité », en trois phrases, avec son lien ;
7. les six liens du guide, en anglais et en français ;
8. licence, et le renvoi `NOTICE` pour les polices.

### 6.2 `README` de `@openview/adapter-puppeteer` — 80 lignes

Ce qu'il est (le dos d'impression du port PDF), ce qu'il télécharge, **le piège pnpm 11** —
l'installation ne joue pas le script de Puppeteer sans une entrée `allowBuilds`, donc pas de
Chromium et un premier appel qui échoue —, les deux façades en trois lignes (`…PdfStrategy` pour un
document que vous contrôlez, `…RenderRuntime` pour un document que vous ne contrôlez pas), et un
renvoi vers le guide.

### 6.3 `00-contents` — 40 lignes

Six liens, une phrase chacun, plus la bascule de langue. Rien d'autre : un sommaire qui explique
est un doublon de ce qu'il annonce.

### 6.4 `01-first-pdf` — 150 lignes

- prérequis : Node ≥ 24, un Chromium téléchargé, ce que coûte le premier `install` ;
- les trois fichiers à créer, dont le modèle d'exemple à télécharger ;
- l'extrait du §0.1, cité de `example.ts` ;
- l'exécution, et à quoi ressemble le PDF obtenu (une page, un tableau, un total) ;
- **« ça n'a pas marché »** : les quatre refus d'un premier essai — `presentation-refused`,
  `template-refused`, `missing-binding-value`, `unsupported-font-family` — chacun en deux lignes,
  avec un renvoi vers la page 03 ;
- suite : page 02.

### 6.5 `02-template-and-data` — 150 lignes

- d'où vient un modèle : de l'éditeur, ou d'un JSON stocké par vous ; `parseTemplate` valide et
  migre, `schemaVersion` vaut 11 aujourd'hui et un document plus récent est refusé par un message
  qui le dit ;
- d'où viennent les données : **de vous**. Openview ne réserve aucun nom de champ, n'attend aucune
  structure et ne valide pas votre jeu de données — c'est à vous de le faire, contre votre propre
  catalogue ;
- ce que le modèle lit : `collectDataPaths()` ;
- **écritures et langues** : le modèle déclare ses écritures, l'appelant choisit un profil à la
  construction du port. Une ligne changée dans l'extrait (`{ amount: 'en-usd' }`) donne la facture
  anglais/dollars ; c'est la démonstration d'E4, elle tient en un diff de trois caractères ;
- « aujourd'hui » est une **donnée**, pas une valeur que le moteur fabrique ;
- suite : page 03.

### 6.6 `03-when-it-fails` — 220 lignes

- la forme d'un refus : `DocumentRenderError`, son `code`, ses `details` (`nodeId`, `path`,
  `occurrence`, `phase`, `limit`, `observed`, `pageNumber`, `diagnostics`) ;
- **la règle qui rassure et qui contraint** : un refus ne transporte jamais une valeur de votre jeu
  de données. Vous ne trouverez pas le montant fautif dans le message — vous trouverez son adresse ;
- les dix phases, dans l'ordre, en une ligne chacune ;
- **la table des 31 codes**, groupée par phase : *code · quand il tombe · ce que vous faites*.
  Trois colonnes, une ligne par code, aucune prose ;
- les trois autres erreurs qu'un appelant peut voir : `TemplateShapeError`,
  `TemplateMigrationError`, `ExpressionEvaluationError`, plus `diagnosticsOf()` pour un message
  destiné à l'auteur du modèle ;
- suite : page 04.

### 6.7 `04-untrusted-documents` — 150 lignes

- la question à se poser : **qui a écrit le modèle ?** Si ce n'est pas vous, la suite est
  obligatoire ;
- l'extrait du runtime durci : `await createPuppeteerRenderRuntime({ … })`, `runtime.pdf.render`,
  `finally { await runtime.close() }`, un `AbortSignal` ;
- la table des défauts (slots, file, délais, tas du worker, images, PDF, pages, HTML), lue dans le
  code par la porte ;
- **les images distantes** : rien n'est chargé qui ne figure au manifeste avec son SHA-256 ;
- l'audit : `node:diagnostics_channel`, canal `openview.render.audit`, cinq issues
  (`succeeded`, `refused`, `timed-out`, `cancelled`, `failed`), aucune donnée dans l'événement ;
- **ce que ce runtime ne fait pas** (D9) : la mémoire du processus n'est pas bornée, Chromium non
  plus ; il faut une limite de conteneur. Et la liste de ce qui n'est pas prouvé à ce jour ;
- suite : page 05.

### 6.8 `05-guarantees-and-limits` — 120 lignes

- **PDF uniquement** ; ni HTML, ni image en v1 ;
- **le même document à chaque fois — sous le même profil** : treize champs comparés, et la réserve
  ICU (`U+202F` contre `U+00A0`) écrite noir sur blanc ;
- **les polices** : trois familles, douze faces, SIL OFL 1.1 ; une famille hors catalogue est
  refusée, jamais remplacée ;
- **jamais tronqué** : ce qui ne tient pas est refusé ;
- **la découpe est lisible sans produire un PDF** : `createPaginationPort` ;
- **le filet** : le lot figé E7 et ce qu'il ne tue pas ;
- ce qui reste hors périmètre, et la clause de responsabilité, une dernière fois liée.

### 6.9 Règles de rédaction, communes aux deux langues

- une idée par section, une phrase par idée, la voix active ;
- aucun superlatif, aucun « simplement », aucun « il suffit de » ;
- toute garantie porte le lien de l'ADR qui la tranche ;
- toute limite est écrite comme une limite, jamais comme une précaution ;
- le français suit la typographie des documents existants (guillemets français, insécables) ;
- l'anglais est direct et court : ce n'est pas une traduction mot à mot du français.

---

## 7. La porte documentaire

`tools/docs/check.mjs` rend une liste de violations, chacune nommant le fichier, la ligne et la
règle. Le test échoue sur la première liste non vide.

### 7.1 Les huit vérifications

| # | Vérification | Ce qu'elle empêche |
| :--- | :--- | :--- |
| G1 | même ensemble de fichiers dans chaque arbre de langue | une page ajoutée dans une seule langue |
| G2 | même nombre, même ordre et mêmes niveaux de titres | une section ajoutée d'un côté seulement |
| G3 | blocs de code identiques octet pour octet entre langues | un extrait corrigé une seule fois |
| G4 | chaque bloc `ts` est une région *verbatim* d'un module compilé | un exemple qui ne compile pas, ou qui a vieilli |
| G5 | plafonds du §2.3, largeur ≤ 100, profondeur ≤ 3, un seul H1 | la dérive vers un manuel que personne ne lit |
| G6 | tout lien relatif résout ; toute URL de dépôt désigne un fichier suivi | le lien mort, la page fantôme |
| G7 | tout symbole cité existe dans la surface publiée ; la table des refus égale les 31 codes | la doc qui nomme un export retiré, ou qui oublie un refus |
| G8 | tout chiffre de borne publié égale la constante correspondante | un défaut changé sans que la page suive |

### 7.2 Ce que la porte ne peut pas vérifier

**Elle ne lit pas le sens.** Deux pages peuvent avoir la même structure, les mêmes extraits, les
mêmes chiffres, et dire deux choses différentes. Aucune des huit règles ne l'attrape.

Trois vérifications restent donc humaines, et il faut le dire ici plutôt que de laisser croire au
tableau ci-dessus :

1. **la parité de sens** entre le français et l'anglais — relecture, à chaque modification ;
2. **l'exactitude des réserves** recopiées des ADR — relecture, à chaque montée d'ADR ;
3. **l'utilité** : seule la répétition à froid du §9 en dit quelque chose.

---

## 8. Plan de tests

Un seul fichier de test, `documentation.test.ts`, et huit contrats.

| # | Contrat | Preuve |
| :--- | :--- | :--- |
| P1 | l'exemple rend un PDF | `renderFirstInvoice` sur le modèle publié, dans un dossier temporaire : octets non vides, en-tête `%PDF-`, une page |
| P2 | l'exemple est celui de la page | les blocs `ts` des deux langues égalent les régions de `example.ts`, désindentées |
| P3 | parité de structure | G1, G2, G3 sur les six pages et les deux README |
| P4 | budget et forme | G5 sur chaque fichier, plus le total par langue |
| P5 | liens | G6 sur tous les liens relatifs et toutes les URL du dépôt |
| P6 | surface publique | G7 : chaque symbole cité est exporté ; la table des refus égale `DOCUMENT_RENDER_ERROR_CODES` ; les phases égalent `DOCUMENT_RENDER_PHASES` |
| P7 | bornes | G8 : chaque chiffre publié égale sa constante |
| P8 | la porte échoue quand elle doit | huit fixtures fautives en mémoire, une par règle, chacune refusée par la règle attendue et par elle seule |

P8 est le test qui compte : sans lui, une porte qui rend toujours « rien à signaler » passerait pour
verte pendant des mois.

---

## 9. La répétition à froid

Jouée **une fois**, avant l'ADR, par une personne qui n'a pas écrit les pages. Le protocole :

1. `pnpm run build`, puis `npm pack` dans `core`, `engine` et `adapter-puppeteer` ;
2. hors du dépôt, un dossier vide, `npm init -y`, installation des trois `.tgz` ;
3. la page 01 est suivie **à la lettre** : rien d'autre n'est ouvert, ni le source, ni le
   playground, ni ce plan ;
4. chronomètre déclenché à la première ligne lue, arrêté quand le PDF s'ouvre ;
5. tout blocage est noté avec la ligne de la page qui a manqué.

**Critère de réussite :** un PDF valide, aucun fichier de `packages/` ouvert, et — objectif tenu
pour indicatif, non bloquant — moins de quinze minutes. Le compte rendu, y compris les blocages,
entre dans l'ADR 0022. Un blocage se corrige dans la page, jamais dans le compte rendu.

---

## 10. Incréments d'exécution

| # | Contenu | Fin de l'incrément |
| :--- | :--- | :--- |
| **INC-0** | `npm pack --dry-run` rejoué sur les deux paquets ; correction des deux textes en retard (§1.3.7) | le dépôt ne se contredit plus, et la règle d'emballage est vérifiée, pas supposée |
| **INC-1** | modèle d'exemple, `example.ts`, P1 vert | l'exemple rend un vrai PDF sous Vitest |
| **INC-2** | `tools/docs/check.mjs` et ses types ; P3 à P8 sur un jeu de fixtures | la porte refuse les huit fautes, sur des pages qui n'existent pas encore |
| **INC-3** | les six pages anglaises, les deux README anglais | porte verte en anglais ; P2 lie les extraits aux régions |
| **INC-4** | les six pages françaises, les deux README français, liens croisés | porte verte dans les deux langues |
| **INC-5** | répétition à froid, corrections qu'elle impose, ADR 0022, statut roadmap | le lot est clos |

L'ordre n'est pas décoratif : la porte existe **avant** les pages, sinon la première rédaction fixe
la règle au lieu de s'y plier. L'anglais précède le français parce que c'est la langue publiée, et
qu'une page traduite d'une page provisoire est écrite deux fois.

**Commits attendus**, un par incrément, en français comme le reste du dépôt :

```text
docs(e9): le dépôt cesse d'annoncer un corpus qu'il contient déjà
docs(e9): un exemple qui rend vraiment un PDF
test(e9): une porte documentaire, et huit fautes qu'elle refuse
docs(e9): le guide du moteur, en anglais
docs(e9): le guide du moteur, en français
docs(e9): l'ADR 0022, et ce que la répétition à froid a corrigé
```

---

## 11. Portes de validation

Les quatre portes habituelles, dans l'ordre, plus ce que ce lot y ajoute :

```bash
pnpm run lint && pnpm run build && pnpm run type-check && pnpm run test:coverage
```

- **lint** — inchangé ; aucun fichier de configuration n'est touché ;
- **build** — le module d'exemple compile, comme tout module sous `src/` ;
- **type-check** — `example.ts` et `documentation.test.ts` passent `tsconfig.typecheck.json` :
  l'extrait publié est typé exactement comme le code du dépôt ;
- **test:coverage** — P1 à P8 ; le seuil de 90 % est inchangé, `tools/docs/` n'étant pas instrumenté
  et le module d'exemple étant exécuté.

### 11.1 Mesures à consigner dans l'ADR 0022

- le compte rendu de la répétition à froid : durée, blocages, corrections ;
- le nombre de lignes réel de chaque page, face à son plafond ;
- la sortie de `npm pack --dry-run` : ce que le paquet publié contient réellement, les deux README
  compris ;
- le surcoût en secondes de la suite de tests, avec et sans P1 ;
- la liste des symboles publics cités par la documentation — c'est la surface que le projet
  s'engage à ne pas casser sans le dire.

---

## 12. Risques et signaux de réouverture

**`core` n'a pas de lot de documentation, et J7 en exige une par brique.** C'est le risque
principal, et il n'appartient pas à E9 : la roadmap `core` s'arrête à C11. E9 le contourne en
livrant un modèle d'exemple, de sorte qu'aucun lecteur n'ait besoin du contrat pour son premier
PDF — mais le deuxième modèle, celui qu'il voudra écrire, n'a aujourd'hui aucune documentation.
**À remonter au propriétaire produit avec ce plan**, pas à combler ici.

**La parité de sens n'est pas outillée.** Deux textes peuvent diverger en restant verts (§7.2). Le
signal de réouverture : la première question d'un lecteur français à laquelle la page anglaise
répondait déjà.

**La publication n'existe pas encore.** `pnpm add @openview/engine` ne fonctionne pas aujourd'hui :
les paquets sont en 0.1.0 et rien n'est publié (décision 2). La page 01 doit donc dire à quoi elle
s'applique — et la répétition à froid, qui installe des `.tgz`, est la seule preuve disponible
avant J7.

**E8 n'est livré qu'en partie.** Tant que le corpus hostile, le job CI et la mesure de charge
manquent, la page 04 le dit. Le jour où E8 se ferme, cette page change : c'est un signal, pas une
dette.

**L'exemple coûte du temps de suite.** Un rendu Chromium de plus, mesuré en INC-1. S'il dépasse une
minute sur un runner chargé, l'exemple se réduit — il ne se désactive pas.

**Le budget de lignes peut être trop serré.** Le premier signal sera une page qui l'atteint sans
être complète. La réponse est alors de relever ce plafond-là dans l'ADR, en le disant — jamais de
retirer la porte.

---

## 13. Définition de terminé

1. les huit fichiers anglais et les huit fichiers français existent, sous leurs plafonds ;
2. `pnpm run test:coverage` joue P1 à P8, tous verts ;
3. tout extrait publié est une région d'un module compilé et exécuté ;
4. la table des refus contient les 31 codes, et rien d'autre ;
5. les chiffres publiés égalent les constantes du code ;
6. la clause de responsabilité figure dans les deux README, liée au README racine ;
7. la page 04 recopie les réserves de l'ADR 0021 sans les adoucir ;
8. la répétition à froid a produit un PDF, et son compte rendu est dans l'ADR 0022 ;
9. l'ADR 0020 et la roadmap moteur ne contredisent plus le dépôt ;
10. la roadmap moteur porte E9 ✅ avec sa date et le lien de l'ADR 0022 ;
11. les quatre portes sont vertes en local avant la PR.

---

## 14. Contrôle avant démarrage

Deux questions au propriétaire, et aucune ne bloque le démarrage :

1. **La documentation de `core` est-elle un lot à ouvrir ?** Non bloquant pour E9, structurant
   pour J7 (§12) — c'est la seule question qui change la suite de la roadmap.
2. **Qui joue la répétition à froid ?** Non bloquant avant INC-5, mais la personne ne doit pas
   avoir écrit les pages — et il n'y en a qu'une qui écrit, aujourd'hui.

Aucune des deux ne bloque le démarrage : E9 n'attend ni mandat, ni arbitrage, et INC-0 peut être
joué le jour où ce plan est accepté.
