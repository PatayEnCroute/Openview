# Openview — Règles pour les agents IA

Ce document définit les règles de codage et l'architecture que tout assistant IA
(Claude, Gemini, Copilot, Codex, ChatGPT) **DOIT** suivre dans le monorepo Openview.

Il vit à la racine parce que c'est là que les agents le cherchent. Les humains
lisent [CONTRIBUTING.md](CONTRIBUTING.md), qui en reprend l'essentiel.

---

## 🧭 Ce qu'Openview n'est pas — règle de périmètre

Openview est un **moteur d'édition embarquable** : un concepteur visuel de modèles
et un moteur de rendu, installés dans l'application d'un tiers. Il n'est ni un
logiciel de gestion, ni une source de données. Trois interdits en découlent, et ils
tranchent la plupart des questions de conception :

- **Ne réservez aucun nom de champ et n'attendez aucune structure de données.** Le
  jeu de données appartient à l'application intégratrice, qui le nomme. Pas de
  schéma Zod pour `RenderRequest.data` : sa forme n'est pas à nous (§1.2).
- **N'écrivez aucune règle métier** — taux, barème, arrondi « légal », numérotation.
  La facture est le document de référence du projet, c'est-à-dire le niveau
  d'exigence à atteindre, jamais le périmètre.
- **N'introduisez ni horloge, ni fuseau, ni locale système, ni aléa** dans `core` et
  `engine`. « Aujourd'hui » est une donnée fournie, nommée par l'intégrateur : un
  moteur qui lit son environnement ne peut pas produire deux fois le même document
  ([roadmap moteur](docs/roadmap/engine.md), lot E6). Formater une date fournie ou
  un montant dans une locale que le **modèle** déclare reste permis : c'est le lot
  C6. Ce qui est refusé, c'est de lire la machine.

> **Le test, en cas de doute :** si une fonctionnalité oblige l'intégrateur à nommer
> un champ comme Openview l'a décidé, elle est à refuser.

---

## ⚖️ Ce qui est vérifié par une machine, et ce qui ne l'est pas

Un audit des fondations a montré qu'une règle non outillée n'est pas une règle :
cinq violations explicites de ce document passaient `type-check` en exit code 0.
La colonne de droite dit ce qui vous arrêtera réellement.

| Règle | Appliquée par |
| :--- | :--- |
| `any`, `!`, `@ts-ignore`, `catch` vide, double cast `as unknown as` | **Biome** (`pnpm run lint`) — bloquant en CI et au pre-commit |
| Sens des dépendances entre paquets | **Biome** `noRestrictedImports` |
| DOM interdit dans `core`/`engine`, Node interdit dans les paquets navigateur | **tsc** (`lib`/`types` par paquet) |
| Extensions `.js` sur les imports relatifs de `core`/`engine` | **tsc** (`NodeNext`) |
| Couverture ≥ 90 %, tests type-checkés | **Vitest** + `tsconfig.typecheck.json` |
| Aucune lecture d'environnement dans `core`/`engine` : constructeur `Date` à toute arité, `Date.now`, `Date.parse`, `Math.random`, `process.env`, `performance.*`, `globalThis.*`, `toLocale*`, les neuf getters locaux de `Date`, `Intl.*` sans locale, `Intl.DateTimeFormat` sans `timeZone` | **Biome** (`noJsRestrictedProperties` + plugin `no-environment-read`) — *avec les trois angles morts et les deux faux positifs ci-dessous* |
| Assertion `<X>v`, promesses non attendues, patrons de conception, Zod-first | **Revue humaine uniquement** |

La dernière ligne du tableau est votre responsabilité directe : rien ne vous
rattrapera.

**Et la ligne « lecture d'environnement » n'est couverte qu'en partie — il faut le
dire, sinon le tableau fait exactement ce qu'il existe pour empêcher.** Une version
antérieure de cette section annonçait *cinq* contournements « tous vérifiés muets » ;
la vérification a montré que **deux d'entre eux ne sont pas muets, ce sont des faux
positifs**. Le motif `$args <: not contains \`timeZone\`` compare du **texte source**,
pas une valeur : tout objet d'options qui n'est pas un littéral en ligne déclenche donc
la règle.

**Trois angles morts, réellement muets, barrés par la revue seule :** un **alias**
(`const C = Date; new C()`), une **locale `undefined` explicite**
(`Intl.NumberFormat(undefined, opts)`), et une **diffusion d'arguments sur
`NumberFormat`** (`Intl.NumberFormat(...args)`).

**Deux faux positifs, à connaître avant de perdre une heure dessus :**
`Intl.DateTimeFormat('fr-FR', options)` avec `options` déclaré ailleurs, et
`Intl.DateTimeFormat(...args)`, sont **refusés** alors qu'ils sont corrects. Le lot C6
doit donc écrire son objet d'options **en ligne** — c'est la contrainte à accepter, et
elle est écrite ici pour que le prochain contributeur ne cherche ni un `biome-ignore`
(§1.1 l'interdit sans justification) ni une retouche du plugin (§7 l'interdit sans
mandat).

Ce qui **passe** délibérément, parce que C6 et E4 en ont besoin :
`Intl.NumberFormat('fr-FR')`, `Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' })`
**littéral**, leurs homologues `new`, et `Date.UTC(…)`. Formater dans une locale que le
**modèle** déclare est permis ; lire celle de la **machine** ne l'est pas.

> ⚠️ `noJsRestrictedProperties` est une règle **nursery**, hors versionnement
> sémantique : une montée de Biome peut la renommer ou la retirer **en silence**. La
> sonde jetable décrite dans l'ADR 0003 doit être rejouée à chaque montée ; si la
> règle disparaît, le repli est de rapatrier ses entrées dans le plugin, qui
> appartient au dépôt.

---

## 🛑 1. Règles d'or & typage strict

### 1.1 Typage strict sans concession

Interdits, sans exception et sans négociation avec le linter :

- **`any`** sous toutes ses formes, y compris `any[]` et `Record<string, any>`.
- **`as unknown as X`** — le double cast qui contourne le compilateur sans écrire `any`.
- **`<X>valeur`** — l'assertion en chevrons. *Non détectée par le linter*
  (GritQL parse ce dialecte en TSX) : c'est à vous de ne pas l'écrire.
- **`!`** — l'assertion non-nulle. Elle annule intégralement `noUncheckedIndexedAccess` :
  écrire `items[0]!` revient à désactiver le garde-fou le plus utile de la config.
  Utilisez une garde (`if (!first) return`) ou `at()` avec vérification.
- **`@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`** — l'échappatoire n°1.
- **`biome-ignore`** — sauf justification écrite dans le commentaire *et* dans la PR.

Si le compilateur vous bloque, le type est faux ou la donnée n'est pas validée.
Corrigez la cause, jamais le symptôme.

### 1.2 Validation des schémas (Zod d'abord)

Tout contrat **de donnée** d'Openview — modèle, nœuds, expressions — est défini et
validé dans `@openview/core` avec **Zod** avant d'être consommé ailleurs. Les
**ports** font exception par nature : ce sont des interfaces TypeScript, elles
portent des fonctions, et Zod ne valide pas une fonction — c'est le *contenu*
qu'elles transportent qui l'est. Aucune donnée externe n'est jamais utilisée sans
parsing préalable.

**Une exception, et elle est structurante : le jeu de données de l'intégrateur.**
Il n'a pas de schéma dans `core`, et il n'en aura jamais — sa forme appartient à
l'application hôte. `RenderRequest.data` est un sac opaque de clés que l'appelant
nomme. N'écrivez pas de `RenderDataSchema`, ne réservez aucune clé, n'attendez
aucune structure : c'est à l'appelant de valider son jeu de données contre son
propre catalogue. Ce que le modèle déclare, ce sont ses **lectures**, et
`collectDataPaths()` les restitue.

**Zod 4** est la cible : importez depuis `zod/v4`, pas depuis `zod`. Le parsing
y est nettement plus rapide et le support des types récursifs — votre cas
principal — est meilleur.

**Coût du parsing :** `safeParse` aux frontières uniquement (entrée HTTP, chargement
de template, désérialisation). Jamais dans une boucle de rendu : valider un AST de
5 000 nœuds à chaque frame est une erreur de conception.

**Patron obligatoire pour l'AST récursif.** Les types récursifs Zod sont un piège
à `any` : l'inférence casse et la tentation est de « corriger » avec un cast.
Écrivez le type à la main, puis liez-le explicitement. Ce patron compile sous la
config ultra-stricte, il est vérifié :

```ts
export type DocumentNode =
  | { readonly type: 'text'; readonly id: string; readonly content: string }
  | { readonly type: 'container'; readonly id: string; readonly children: readonly DocumentNode[] };

export const DocumentNodeSchema: z.ZodType<DocumentNode> = z.lazy(() =>
  z.discriminatedUnion('type', [TextNodeSchema, ContainerNodeSchema]),
);
```

**Versionnement de l'AST.** Tout schéma de document porte un `schemaVersion`
discriminant, et toute évolution s'accompagne d'une migration `migrate(from, to)`.
Un template enregistré en v1 doit pouvoir être rendu en v12. Cette décision est
irréversible dès le premier template client : ne la reportez pas.

« Toute évolution » se lit au sens large, et deux formes d'incompatibilité l'exigent —
la seconde a été découverte à l'ADR 0003, et aucune des deux ne produit d'erreur
lisible sans l'incrément :

- **La perte silencieuse.** `z.object` **supprime** les clés qu'il ne connaît pas. Un
  champ ajouté, même purement **optionnel**, est donc effacé par un build antérieur
  qui ouvre le document — sans erreur, puisque la version n'a pas bougé — et un
  `onSave` persiste la perte.
- **Le refus illisible.** Une union **élargie** (un kind de plus) rend, sur un build
  antérieur, un `ZodError` « No matching discriminator » / « Invalid input » sur un
  chemin de discriminant : ni erreur typée, ni mention de version, aucun remède.
  Avec l'incrément, le même document rend `TemplateMigrationError: … written by a
  newer release of Openview; upgrade before opening it.`

**Une migration qui ne transforme rien n'est pas une migration fantôme.** Elle
estampille, et l'estampille est *tout* ce qui produit le second message ci-dessus.
Écrire `migrate: (input) => ({ ...input, schemaVersion: n })` est un travail complet.

**Il n'y a pas de dérogation pré-v1.0 au versionnement.** La dérogation pré-v1.0
porte sur les **rétrécissements** — une borne nouvelle qui refuse un document
auparavant valide, qu'aucune migration ne peut rattraper sans corrompre le document.
Le versionnement, lui, n'a pas de coût qui justifierait de l'ajourner. Ce fichier
fait foi : une ADR qui entend l'amender doit le dire explicitement.

### 1.3 Gestion des erreurs

**Aucun `catch` vide, dans aucune écriture.** Les trois formes suivantes sont
équivalentes et toutes interdites — un commentaire n'est pas un traitement, et
préfixer le binding d'un underscore ne l'est pas davantage :

```ts
catch {}
catch { /* ignore */ }
catch (_e) { /* ignore */ }
```

Toute erreur capturée est soit journalisée avec son contexte, soit relancée sous
forme d'erreur typée avec un message explicite. `useUnknownInCatchVariables` est
actif : affinez le type avant de lire `.message`.

### 1.4 Optionnels et `exactOptionalPropertyTypes`

Le dépôt active `exactOptionalPropertyTypes`. Toute propriété optionnelle d'une
interface **écrite à la main** doit être `prop?: T | undefined` :

```ts
interface Options {
  theme?: 'light' | 'dark';              // ❌ TS2379 chez l'appelant
  theme?: 'light' | 'dark' | undefined;  // ✅
}
```

Les types inférés de Zod incluent déjà `| undefined` : la friction n'apparaît
qu'à la frontière avec vos propres interfaces — typiquement les **Ports**.

### 1.5 Asynchrone : pas de filet

TypeScript 7 est le portage natif Go et n'expose plus l'API JS du compilateur.
`typescript-eslint` est donc inutilisable, et avec lui **`no-floating-promises`**.
Aucun outil ne détectera une promesse non attendue.

Conséquence, sur `@openview/engine` en particulier (Puppeteer est intégralement
asynchrone) : `await` explicite sur tout appel asynchrone, sans exception. Une
promesse volontairement non attendue est marquée `void promesse` avec un
commentaire justifiant pourquoi.

### 1.6 Hygiène des commentaires & concision documentaire

Le code source n'est ni un carnet de laboratoire, ni un journal de bord, ni un ADR.
Les commentaires JSDoc et inline doivent rester **stricts, concis et focalisés sur le contrat**.

- **Langue obligatoire en anglais :** Tous les commentaires dans le code source (`*.ts`,
  `*.tsx`, `*.js`) — JSDocs et commentaires inline — **DOIVENT être rédigés en anglais**.
  La documentation de conception et les ADRs (`docs/adr/`) restent en français.
- **Concision du JSDoc (1 à 5 lignes) :** Documentez le *rôle*, les *paramètres/retours*
  et les *invariants critiques* indispensables à l'appelant. Jamais de dissertation.
- **Interdiction du contexte éphémère de développement :** Ne mentionnez **aucun** numéro
  de lot ou de sprint (`lot C5`, `lot C8`), **aucun** hash de commit (`commit bca73f6`),
  ni l'historique des brouillons rejetés (`an earlier draft wrote...`). Ce contexte
  appartient aux commits Git et aux PRs.
- **Interdiction des dépôts de métriques et dumps de tests :** Les listes exhaustives
  de cas limites, benchmarks de versions (ex: comparaisons ICU) et dumps JSON d'erreurs
  vivent dans les suites de tests (`*.test.ts`), jamais dans les JSDoc.
- **Interdiction du style polémique / plaidoirie :** Pas de passages entiers en majuscules
  (*SHOUTING*), pas de justifications défensives répétées de fichier en fichier.
- **Séparation des responsabilités documentaires :**
  - **Code (`*.ts`)** : Contrat public, usage et invariants stricts en anglais.
  - **Tests (`*.test.ts`)** : Preuves empiriques, cas limites et comportement attendu.
  - **ADR (`docs/adr/`)** : Arbitrages d'architecture et comparatifs techniques (en français).
    Dans le code, un simple renvoi suffit : `@see docs/adr/0007-l-apparence.md`.

---

## 🏛️ 2. Architecture & séparation des responsabilités

| Paquet | Rôle | Interdits |
| :--- | :--- | :--- |
| `@openview/core` | Contrats, schémas Zod, AST | React, Node, Puppeteer, **et tout paquet frère** |
| `@openview/engine` | Pipeline de fusion, rendu backend | React, `designer`, `viewer` |
| `@openview/designer` | Édition visuelle React | Puppeteer, **`engine`** |
| `@openview/viewer` | Affichage React léger | Puppeteer, **`engine`** |

`core` est la racine du graphe : il n'importe jamais un frère. Les paquets
navigateur n'importent jamais `engine` — cela embarquerait Chromium dans le
bundle client.

Ces règles sont appliquées par `noRestrictedImports` et par les `lib`/`types`
déclarés par paquet. Ne « corrigez » jamais un blocage en élargissant un
`tsconfig` ou en ajoutant une dépendance : c'est l'architecture qui parle.

**Imports relatifs.** `core` et `engine` sont en résolution `NodeNext` :
`import './foo.js'`, jamais `import './foo'`. L'extension pointe vers le fichier
**émis**, donc `.js` même depuis un `.ts`.

**Modularité & taille des fichiers (Clean Architecture).** Évitez les fichiers
monolithiques regroupant types, schémas, logique de runtime et cas particuliers :
- Isolez les contrats de types TypeScript purs (`types.ts`).
- Isolez les schémas de validation Zod (`schemas.ts`).
- Découpez les moteurs de runtime en opérations unitaires sous un dossier dédié
  (ex: `evaluator/operations/`).
- Exposez des façades claires (barrels) pour la consommation externe sans fuite
  d'implémentation interne.

---

## 🧩 3. Patrons de conception

### A. Composite — l'AST (`core`)
Arbre de nœuds (`BaseNode`, `ContainerNode`, `TextNode`, `ImageNode`, `LoopNode`),
conteneurs et feuilles traités uniformément.

### B. Visitor — le parcours de l'AST (`core`)
**Obligatoire dès qu'un deuxième parcours apparaît.** Composite sans Visitor est
un demi-patron : sans lui, `switch (node.type)` se duplique dans le rendu, la
validation, la collecte de variables et la recherche par id — et chaque nouveau
type de bloc impose de toucher huit fichiers.

> **Portée : l'AST de document, pas l'algèbre d'expressions**
> ([ADR 0004](docs/adr/0004-les-arrondis-declares-par-le-modele.md), décision 11 ; mandat du
> propriétaire du produit, 2026-08-15). La règle ci-dessus vaut pour le Composite qu'énumère
> §3.A. Elle ne vaut **pas** pour l'algèbre d'expressions, dont les deux parcours restent des
> `switch` — **tant qu'ils se terminent par `const exhaustive: never = expression`**. Ce contrôle
> est *strictement plus fort* qu'un Visitor : il rend l'oubli d'un kind impossible à **compiler**
> (porte 2), là où un Visitor ne casserait qu'à l'exécution d'un test. Une règle qu'on ne peut
> suivre sans dégrader la garantie qu'elle vise se corrige, elle ne se contourne pas.
> **Seuil de retrait de l'amendement : l'apparition d'un troisième parcours d'expression.** Ce
> jour-là, la duplication cesse d'être de deux exemplaires et le Visitor redevient le bon patron.

### C. Hexagonal — Ports & Adapteurs (`core`, `engine`)
`core` définit des interfaces (stockage, rendu) ; les implémentations concrètes
(Puppeteer, Playwright, système de fichiers) sont des adapteurs externes.

Puppeteer en particulier **ne doit pas** être une dépendance directe d'`engine` :
il embarque Chromium (~150–300 Mo), que tout intégrateur ne voulant que du HTML
paierait. Il vit derrière un port, dans son propre paquet adapteur.

### D. Strategy — les formats d'export (`engine`)
Une classe par format implémentant `RenderStrategy` (PDF, HTML, Image).

### E. Pipeline — la chaîne de rendu (`engine`)
`ValidationStep` ➔ `DataBindingStep` ➔ `DomBuildStep` ➔ `SanitizeStep` ➔ `PdfExportStep`.

⚠️ **Un Pipeline n'est pas une Chain of Responsibility.** Un Pipeline exécute
**toutes** les étapes en transformant la donnée. Une CoR autorise un maillon à
interrompre la propagation. Le rendu de document exige un Pipeline : n'implémentez
pas de `next()` avec abandon anticipé, vous produiriez des PDF silencieusement
tronqués.

### F. Command — l'historique d'édition (`designer`)
Toute modification de l'AST passe par un objet `Command` (`execute()` / `undo()`).

L'undo/redo n'est fiable que si l'AST est **immuable** ou si la Command stocke un
patch. Avec un arbre muté en place et le rendu concurrent de React 19,
l'historique sera bugué de façon non déterministe.

### G. Registry — les blocs et plugins (`core`, `designer`)
Registre dynamique associant un type de bloc à son schéma Zod et son composant.

### ⛔ Règle anti-sur-ingénierie

Six patrons imposés sur une base encore petite invitent à produire de la cérémonie
(`AbstractRenderStrategyFactoryProvider`). La règle est simple :

> **On n'introduit un Port que lorsqu'un second adaptateur existe réellement ou
> est planifié à trois mois.**

Strategy pour PDF/HTML/Image se justifie : trois implémentations réelles. Un port
de stockage se justifie : c'est la promesse *headless*. Un port pour le logging,
les polices ou l'i18n ne se justifie pas. Dans le doute, écrivez la version
directe : extraire une interface plus tard est facile, retirer une abstraction
inutile ne l'est jamais.

---

## 🔄 4. Workflow d'implémentation

1. **Cœur** — types AST et schémas Zod dans `@openview/core`.
2. **Tests** — le `*.test.ts` correspondant, dans le même commit.
3. **Consommation** — étape de rendu dans `engine` ou interface dans `designer`.
4. **Validation** — les quatre portes, dans cet ordre :

```bash
pnpm run lint && pnpm run build && pnpm run type-check && pnpm run test:coverage
```

Ce sont exactement les commandes de la CI. Une PR qui ne les passe pas en local
ne les passera pas en CI.

---

## 🧪 5. Qualité & tests

- **Tests obligatoires** pour toute fonction de `core` et `engine` : `*.test.ts`
  ou `*.spec.ts` (les deux suffixes sont découverts et exclus de la couverture).
- **Organisation des fichiers de test (`__tests__/`)** : Lorsque les tests d'un
  sous-système ou d'un module se multiplient, rassemblez-les dans un sous-dossier
  `__tests__/` local (ex: `src/expression/__tests__/`, `src/expression/evaluator/__tests__/`).
  Cela aère l'arborescence `src/` tout en restant 100 % compatible avec `vitest`
  et la contrainte TypeScript `rootDir: "src"`.
- **Seuil de couverture : 90 %.** Il est mesuré sur *tout* le code source, pas
  seulement sur les fichiers qu'un test importe. Ne le désactivez jamais, même
  « temporairement » : un seuil neutralisé ne se réactive pas.
- **N'écrivez pas de test tautologique** pour faire monter un chiffre. Un test
  qui n'assure aucun contrat est pire que pas de test : il rend la métrique
  mensongère.
- **Non-duplication** : avant d'écrire un utilitaire, vérifiez `@openview/core`.

---

## 🔒 6. Sécurité

- **XSS** : tout HTML ou template rendu dynamiquement dans `viewer` ou `engine`
  est assaini.
- **Secrets** : jamais dans le code. Gitleaks bloque la CI.
- **Rendu de template = exécution de code arbitraire.** Quand le pipeline
  Puppeteer arrivera, il faudra : liste blanche des requêtes sortantes (un
  `<img src>` vers `169.254.169.254` est une SSRF vers les métadonnées cloud),
  blocage du protocole `file://`, timeouts, plafonds mémoire et de concurrence.
  `pnpm audit` ne voit pas les CVE de Chromium : il est téléchargé comme binaire,
  hors du graphe npm.

---

## 🚫 7. Ce que vous ne modifiez pas sans mandat explicite

Un agent bloqué est tenté de desserrer la contrainte plutôt que de résoudre le
problème. Les fichiers suivants ne se touchent que si la demande porte
explicitement sur eux :

- `tsconfig.base.json`, `tsconfig*.json` — desserrer un flag strict n'est pas un correctif.
- `biome.jsonc`, `tools/biome/*.grit` — la règle qui vous bloque fait son travail.
- `.github/workflows/*`, `sonar-project.properties`, `turbo.json`.
- `package.json` — et **jamais** de nouvelle dépendance sans justification dans la PR.

**Ajout de dépendance.** Toute nouvelle dépendance élargit la surface
supply-chain d'un projet public. Si `pnpm add` inscrit une entrée
`minimumReleaseAgeExclude` dans `pnpm-workspace.yaml`, c'est une **dérogation à
une protection** de pnpm : elle doit être nommée et justifiée dans la PR, jamais
laissée passer en silence.
