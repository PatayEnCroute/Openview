# Openview — Règles pour les agents IA

Ce document définit les règles de codage et l'architecture que tout assistant IA
(Claude, Gemini, Copilot, Codex, ChatGPT) **DOIT** suivre dans le monorepo Openview.

Il vit à la racine parce que c'est là que les agents le cherchent. Les humains
lisent [CONTRIBUTING.md](CONTRIBUTING.md), qui en reprend l'essentiel.

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
| Assertion `<X>v`, promesses non attendues, patrons de conception, Zod-first | **Revue humaine uniquement** |

Les quatre dernières lignes de la colonne de droite sont votre responsabilité
directe : rien ne vous rattrapera.

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

Tout contrat de donnée est défini et validé dans `@openview/core` avec **Zod**
avant d'être consommé ailleurs. Aucune donnée externe n'est jamais utilisée sans
parsing préalable.

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
