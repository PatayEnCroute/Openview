# Plan d'implémentation — chantier CH3 : la forme d'un nœud d'AST, écrite une seule fois

> **Chantier :** CH3 de [l'analyse de dette](refactoring-huit-chantiers.md) — *premier* de
> l'ordonnancement proposé (§4 de l'analyse), et prérequis annoncé de CH7.
>
> **Nature :** refactoring interne à `@openview/core`. Aucun correctif de bug, aucune
> fonctionnalité, **aucun changement de contrat de donnée**, aucun incrément de
> `schemaVersion`, aucun mandat [AGENTS.md §7](../../AGENTS.md) demandé ni pris.
>
> **Baseline relevée le 2026-08-27**, sur `claude/premier-refactor-complet-lbs9tr`, les quatre
> portes rejouées : `lint` 215 fichiers sans correction · `build` 6/6 · `type-check` 11/11 ·
> `CI=1 test:coverage` **1 576** tests sur **55** fichiers, **93,70 %** statements ·
> **90,74 %** branches · **98,34 %** functions · **93,60 %** lines. Barrel public de
> `@openview/core` à **283** noms. `CURRENT_SCHEMA_VERSION` = **9**.
> `ast/` et `data-catalogue/` sont à **100 %** sur les quatre métriques : ce plan part d'un
> sous-système déjà couvert, et doit le rendre tel quel.
>
> **Date de rédaction :** 2026-08-27 · **Portée :** `@openview/core` seul · **Poids :** S

---

## 0. Résultat attendu

Aujourd'hui, trois tables décrivent la même chose — *ce qu'un nœud d'AST porte* — et rien ne force
les trois à rester d'accord :

| Site | Ce qu'il énumère |
| :--- | :--- |
| `ast/visitor.ts:62` — `childrenOf` | les enfants, par *kind* |
| `ast/visitor.ts:133` — `READS_VISITOR` | les expressions **et** l'alias, par *kind* |
| `data-catalogue/compatibility.ts:468` — `SHAPE` | les expressions **et l'attente et le chemin**, l'alias **et son chemin**, les enfants **et leur chemin** |

Après CH3, il en reste **une** : `nodeShape(node)`, dans `ast/shape.ts`. `childrenOf` et
`nodeReads` en dérivent, `checkTemplateDataCompatibility` la consomme, et **donner une nouvelle
fente d'expression à un *kind* existant devient impossible à faire à moitié** — la fente est
déclarée une fois et les deux fonctions publiques la rapportent toutes les deux.

Trois faits mesurables à la clôture :

1. **Un seul site énumère les huit *kinds*** dans `core` hors dispatch — contre trois.
2. **Un seul site énumère les trois *kinds* de segment de texte** — contre deux
   (`SEGMENT_EXPRESSIONS` et le `visitSegment` en ligne de `SHAPE`).
3. **Le barrel public reste à 283 noms, exactement les mêmes**, vérifiés par `diff` sur la liste
   triée extraite de `packages/core/dist/index.d.ts`. CH3 ne se paie pas en surface publique.

Ce que CH3 **ne** produit **pas** : aucune fonction publique nouvelle, aucun comportement
observable modifié — y compris le contrat d'identité de `childrenOf`, qu'un test existant épingle
et que ce plan préserve exactement (D5).

---

## 1. Sources de vérité et écart réel

### 1.1 Ce que l'analyse de dette impose

[`refactoring-huit-chantiers.md`](refactoring-huit-chantiers.md), CH3 :

> Faire de `SHAPE` la source unique, dans `ast/` : un `ast/shape.ts` exportant
> `nodeShape(node): NodeShape`, puis `childrenOf` et `nodeReads` **dérivés** de lui, et
> `compatibility.ts` qui l'importe au lieu de le redire.

Et son effet secondaire, nommé comme valant mieux que la déduplication :

> l'**attente de type** — « le `when` d'une condition est booléen », « une contribution de report
> est un nombre » — ne vit aujourd'hui que dans `data-catalogue`. C'est une propriété de l'AST. La
> remonter la met là où elle est vraie.

Ce plan retient les deux, et **la seconde n'est pas cosmétique** : c'est elle qui décide où vit
`DataExpectation`, donc le sens du graphe de dépendances entre `ast/` et `data-catalogue/` (D6).

### 1.2 La règle qui rend le risque concret

[AGENTS.md §1.2](../../AGENTS.md) :

> *Ce que le modèle déclare, ce sont ses **lectures**, et `collectDataPaths()` les restitue.*

C'est une promesse publique. Aujourd'hui, une fente d'expression ajoutée à un *kind* existant —
un `ImageNode` dont le `src` deviendrait une liaison, l'exemple que l'analyse donne — se déclare
dans `READS_VISITOR` **ou** dans `SHAPE`. Écrire l'une et oublier l'autre ne produit :

- **aucune erreur de compilation** — les deux tables sont complètes et exhaustives ;
- **aucun test rouge** — sauf si quelqu'un a pensé à écrire le test des deux côtés ;
- **aucune trace à l'exécution** — le modèle déclare une lecture, et l'une des deux fonctions
  publiques ne la restitue pas.

C'est exactement la forme de dette que l'analyse appelle « dérive silencieuse ».

### 1.3 Ce qui est déjà vrai et doit rester vrai

Ces faits sont vérifiés à la baseline et ne doivent pas bouger d'un caractère :

- **`visitNode` est le Visiteur du Composite de document**, et il est correctement bâti
  (`ast/visitor.ts:36`). CH3 ne le remplace pas : il s'en sert.
- **Les trois tables sont déjà réconciliables** — vérifié branche par branche en §5.1. Aucune des
  trois ne dit aujourd'hui quelque chose que les deux autres contredisent. CH3 arrive **avant** la
  première divergence, pas après.
- **`collectDataPaths` filtre les alias par deux mécanismes distincts** — `binds` au niveau du
  nœud, et le contexte d'alias propre de `pathsOf` au niveau de l'expression. Le test
  `ast/__tests__/visitor.test.ts:339` dit que si l'un tombait, l'autre ne rattraperait rien. CH3
  touche au premier ; ce test est l'un des garde-fous à garder verts.
- **`ast/` et `data-catalogue/` sont à 100 %** sur les quatre métriques. Un fichier neuf mal
  couvert se verrait immédiatement.
- **Les positions rapportées par `checkTemplateDataCompatibility` sont testées nommément** —
  `data-catalogue/__tests__/compatibility.test.ts` compte 46 cas, dont « walks the header rows,
  the body and the footer rows of a table, in that order » et « reads a row group alias inside its
  rows, its cells and its page report ». Ces chemins (`['cells', i, 'children', j]`,
  `['pageReport', 'value']`, …) sont un contrat vérifié : les reproduire **au segment près** est
  une condition de sortie, pas un souhait.

### 1.4 La quatrième duplication, que l'analyse ne relève pas

L'analyse compte trois énumérations de *kinds de nœud*. Il y en a une quatrième, du même motif, sur
les **segments de texte** :

| Site | Ce qu'il énumère |
| :--- | :--- |
| `ast/visitor.ts:127` — `SEGMENT_EXPRESSIONS` | l'expression d'un segment, par *kind* |
| `data-catalogue/compatibility.ts:471` — `visitSegment` en ligne dans `SHAPE.text` | l'expression **et son chemin**, par *kind* |

Le second est un sur-ensemble strict du premier, exactement comme `SHAPE` l'est de
`READS_VISITOR`. Le risque est identique et la correction est la même : la branche `text` de
`nodeShape` devient le seul site, et `SEGMENT_EXPRESSIONS` disparaît. C'est relevé ici parce que
le corriger ne coûte rien de plus **une fois qu'on est dans le fichier**, et qu'un second passage
pour trois lignes n'aurait pas lieu.

Le périmètre ne s'élargit pas pour autant : `visitSegment` lui-même reste exporté et inchangé —
`engine/document/materialize.ts:144` et le playground s'en servent pour du **vrai dispatch**, ce
qui est son rôle.

---

## 2. Périmètre fermé

### 2.1 Inclus

1. **`packages/core/src/ast/shape.ts`** (nouveau) : `nodeShape()` et ses types, plus le
   vocabulaire d'attente de position rapatrié depuis `data-catalogue/types.ts`.
2. **`packages/core/src/ast/traverse.ts`** (nouveau) : `childrenOf`, `walk`, `findNodeById`,
   `nodeReads`, `NodeReads`, `collectDataPaths` — les parcours **dérivés** de la forme.
3. **`packages/core/src/ast/visitor.ts`** (réduit) : le dispatch et rien d'autre — `NodeVisitor`,
   `visitNode`, `SegmentVisitor`, `visitSegment`.
4. **`packages/core/src/data-catalogue/compatibility.ts`** : consomme `nodeShape` ; ses quatre
   interfaces locales de forme, `NO_BINDING`, `blockChildren` et `SHAPE` disparaissent.
5. **`packages/core/src/data-catalogue/types.ts`** : réexporte le vocabulaire d'attente au lieu de
   le déclarer, avec la ligne de commentaire qui dit pourquoi.
6. **`packages/core/src/index.ts`** et **`packages/core/src/template/paths.ts`** : chemins
   d'import mis à jour. **Aucun nom ajouté ni retiré.**
7. **Tests** : `ast/__tests__/visitor.test.ts` scindé selon le découpage de production, plus un
   `ast/__tests__/shape.test.ts` neuf portant la forme par *kind* **et** la preuve d'accord des
   deux fonctions publiques (§7.4).
8. **Le bloc de statut de l'analyse de dette**, pour qu'il cesse d'annoncer « aucun chantier
   engagé » alors que le premier l'est.

### 2.2 Exclus, avec leur motif

| Exclu | Motif |
| :--- | :--- |
| CH1 (`MaterialBlock` sans Visiteur, dans `engine`) | Chantier distinct, paquet distinct. CH3 ne lui apporte rien et ne lui coûte rien : l'analyse les déclare indépendants. |
| CH7 (découpage de `compatibility.ts` et `materialize.ts`) | **Suit** CH3 par ordonnancement explicite. CH3 sort ~95 lignes de `compatibility.ts` ; découper ce qui reste est le travail de CH7, pas d'ici. |
| Le renommage `ast/nodes.ts` → `ast/ast.ts` | La convention de façade du dépôt est `<dossier>/<dossier>.ts` (`expression/expression.ts`, `style/style.ts`, …) et `ast/` y échappe. Corriger cela touche tous les importateurs pour zéro garantie gagnée. Hors périmètre. |
| Élargir la surface publique à `nodeShape` | D8. Aucun consommateur hors `core` n'en a besoin, et CH6 documente déjà le coût d'un barrel qui grossit. |
| Toucher `ACCEPTED` / `satisfies` / `acceptedKindsOf` (`data-catalogue/expectations.ts`) | La table d'acceptation est une propriété du **catalogue**, pas de l'AST (D6). Elle ne bouge pas. |
| Le troisième parcours d'expressions | `READING_VISITOR` reste où il est. L'amendement de l'ADR 0004 (décision 11) porte sur l'algèbre d'expressions ; CH3 porte sur le Composite de document, que l'amendement exclut nommément. |
| Une règle de lint interdisant la duplication de tables par *kind* | Demanderait un mandat §7 sur `tools/biome/*.grit`. Non demandé, non pris. |

### 2.3 Test de périmètre

> **Si un changement de ce chantier modifie la sortie d'une fonction publique de
> `@openview/core` pour une entrée valide, il est hors périmètre.**

Le corollaire opérationnel : les 1 576 tests de la baseline doivent passer **sans qu'une seule
assertion de comportement soit réécrite**. Les seules réécritures autorisées sont des
**déplacements** de tests entre fichiers et des **corrections de chemin d'import**. Cette
contrainte est ce qui rend le chantier vérifiable ; §11 en fait une condition de sortie.

---

## 3. Décisions d'architecture

### D1 — `nodeShape()` est la description unique, et les deux autres en dérivent

`nodeShape(node): NodeShape` répond à la question complète : *quelles expressions ce nœud lit et
sous quelle attente, quel alias il ouvre et depuis quelle source, quels enfants il a et où ils sont
rangés.* `childrenOf` en prend les enfants, `nodeReads` en prend les expressions et l'alias,
`analyseNode` en prend tout.

La direction est celle que l'analyse impose : `SHAPE` est le sur-ensemble strict, donc c'est lui
qui monte dans `ast/`, et non les deux autres qui descendent.

**Le coût, dit franchement :** `childrenOf` construit désormais la forme *entière* — y compris les
lectures — pour n'en lire que les enfants. `walk` et `findNodeById` paient donc, par nœud de texte,
un parcours de ses segments dont ils n'ont pas l'usage. C'est accepté pour trois raisons
mesurables :

- **la boucle de rendu ne passe pas par là.** `engine/document/materialize.ts` appelle `visitNode`
  directement ; `childrenOf` sert `walk`, `findNodeById` et `collectDataPaths`, qui sont des
  parcours d'outillage et d'analyse, pas de rendu ([AGENTS.md §1.2](../../AGENTS.md), « coût du
  parsing ») ;
- **la description par tranches (D4) supprime une allocation par enfant** que `SHAPE` payait
  jusqu'ici — un objet `{ node, at }` et un tableau `at` de deux éléments, pour chaque enfant de
  chaque nœud. Sur un document réel, ce que `childrenOf` perd d'un côté, `analyseNode` le rend de
  l'autre ;
- **`collectDataPaths` y gagne franchement** : il appelait `nodeReads` **puis** `childrenOf`, donc
  visitait deux fois chaque nœud. Il n'en visite plus qu'une.

### D2 — `nodeShape` réemploie `visitNode` plutôt que d'écrire un neuvième `switch`

`nodeShape` est implémenté comme un `NodeVisitor<NodeShape>` passé à `visitNode`. C'est ce que
[AGENTS.md §3.B](../../AGENTS.md) demande, et c'est ce qui garantit qu'un neuvième *kind* de nœud
**casse à la compilation** en un point unique.

L'alternative — un `switch` propre à `shape.ts`, terminé par `const exhaustive: never` — donnerait
la même garantie de compilation et éviterait le découpage en trois fichiers de D3. Elle est écartée
parce qu'elle rétablit deux énumérations là où le chantier existe pour n'en laisser qu'une : le
dispatch et la description énumèrent alors les huit *kinds* chacun.

### D3 — Trois fichiers dans `ast/`, parce que le cycle l'impose

`shape.ts` a besoin de `visitNode` et `visitSegment`. Si `childrenOf` et `nodeReads` restaient dans
`visitor.ts`, `visitor.ts` aurait besoin de `nodeShape` : **cycle**. Un cycle ESM entre deux
modules dont les constantes de niveau module sont des littéraux d'objet fonctionnerait
probablement — les fonctions déclarées sont hoistées, et rien n'est lu à l'évaluation — mais
« fonctionne probablement » n'est pas un choix d'architecture.

Le découpage retenu est acyclique et chaque fichier a une seule responsabilité, ce que
[AGENTS.md §2](../../AGENTS.md) demande explicitement :

```
ast/visitor.ts    dispatch          →  (rien de ast/)
ast/shape.ts      description       →  visitor.ts
ast/traverse.ts   parcours dérivés  →  shape.ts
```

C'est le motif de `expression/evaluator/`, que l'analyse désigne comme le modèle du dépôt.

### D4 — Les enfants sont décrits par **tranches**, pas un par un

`SHAPE` décrit aujourd'hui un enfant à la fois : `{ node, at: ['children', index] }`. La forme
retenue décrit la **tranche** : `{ nodes: node.children, at: ['children'] }`, le chemin d'un enfant
étant `[...slot.at, index]`.

Trois conséquences, toutes voulues :

- **le chemin d'un enfant reste identique au segment près** — vérifié branche par branche en §5.1 ;
- **une allocation par enfant disparaît**, ce qui paie une partie du coût de D1 ;
- **`childrenOf` peut rendre le tableau stocké**, ce qui est la condition de D5.

Une tranche est *un `readonly DocumentNode[]` rangé sous une clé du parent*. Une ligne de tableau
en a une par cellule ; un tableau en a trois (`header`, `body`, `footer`) ; un conteneur, une
boucle, une condition et un groupe de lignes en ont une ; un texte et une image, aucune.

### D5 — `childrenOf` garde **exactement** son contrat d'identité

`ast/__tests__/visitor.test.ts:177` épingle un fait, avec son motif écrit :

> Four of the eight branches hand back the stored array; the four others allocate. A consumer that
> memoised on the identity of the result would be wrong six times out of eight.

Ce test est une décision consignée, pas un accident. La règle qu'il décrit se réénonce en une
phrase sur les tranches, et elle rend **les huit branches d'un coup** :

> Le tableau stocké lorsque le nœud garde ses enfants en **une seule** tranche ; un tableau neuf
> sinon — zéro tranche comme plusieurs.

Vérifié contre la baseline : conteneur, boucle, condition et groupe de lignes ont une tranche →
tableau stocké, comme aujourd'hui. Le tableau en a trois → aplatissement, comme aujourd'hui. Texte
et image en ont zéro → `[]` neuf, comme aujourd'hui. **Les trois assertions d'identité existantes
passent sans être touchées.**

Un seul cas change, et il n'est ni testé ni atteignable dans une fixture du dépôt : une ligne de
tableau à **exactement une** cellule rendait un tableau neuf et rendra le tableau stocké. Le
signaler ici plutôt que de le taire est le point : c'est un écart, il est nommé, et le contrat
publié dans le JSDoc de `childrenOf` interdit d'en dépendre.

L'alternative — « toujours un tableau neuf », plus simple à énoncer — est écartée : elle échange une
décision consignée contre une simplification, dans un chantier dont la §2.3 dit qu'il ne modifie
aucun comportement.

### D6 — L'attente de position descend dans `ast/`, la table d'acceptation reste au catalogue

`DATA_EXPECTATIONS` et `DataExpectation` sont déclarés dans `ast/shape.ts` et **réexportés** par
`data-catalogue/types.ts`. `ACCEPTED`, `satisfies` et `acceptedKindsOf` ne bougent pas.

Le partage est celui que l'analyse décrit : *« le `when` d'une condition est booléen »* est une
propriété de l'AST — c'est la position qui l'impose, pas le catalogue ; *« un `civil-date` déclaré
satisfait `text` »* est une propriété du catalogue, et n'a rien à faire dans `ast/`.

**Ce que l'autre choix coûtait.** Laisser `DataExpectation` dans `data-catalogue/types.ts` et
l'importer depuis `ast/shape.ts` marche techniquement — l'import est un `import type`, donc effacé,
et `data-catalogue/types.ts` n'importe rien, donc il n'y a pas de cycle de fichiers. Mais le graphe
de **dossiers** devient cyclique (`ast → data-catalogue → ast`) alors que rien dans l'outillage ne
l'interdit : `noRestrictedImports` ne porte que sur les frontières de paquets. C'est précisément le
genre de règle que [AGENTS.md](../../AGENTS.md) classe en « revue humaine uniquement », donc
précisément celui qu'on ne laisse pas se dégrader en silence.

**Le nom ne change pas.** `DATA_EXPECTATIONS` reste `DATA_EXPECTATIONS`, préfixe compris. Le
renommer serait plus juste et casserait la surface publique pour un gain d'esthétique : refusé.

### D7 — La liaison porte sa source **comme une lecture**, pas comme un champ nu

`NodeBinding` est `{ source: NodeReading; alias: string }`, et non
`{ source: Expression; alias: string; at: […] }`.

Motif : `analyseNode` écrit aujourd'hui `expectation: 'list'` en dur pour la source d'une liaison.
C'est la dernière attente de position restée chez le consommateur, et le chantier existe pour les
faire toutes vivre dans la description. Réutiliser `NodeReading` la fait voyager avec la source,
sans inventer de champ qui ne pourrait porter qu'une seule valeur — ce que
[AGENTS.md, règle anti-sur-ingénierie](../../AGENTS.md) refuse.

### D8 — `nodeShape` reste **interne** à `core`

`nodeShape`, `NodeShape`, `NodeReading`, `NodeBinding` et `NodeChildSlot` ne sont pas exportés par
`packages/core/src/index.ts`. Deux raisons, et la seconde est vérifiable :

- aucun consommateur hors `core` n'en a l'usage : `engine` fait du dispatch (`visitNode`), les
  paquets navigateur ne parcourent rien de tel ;
- **le barrel reste à 283 noms**, ce qui rend la §0.3 mesurable et évite de payer CH3 en surface
  publique alors que CH6 documente déjà ce coût.

Extraire ces types plus tard est facile ; retirer un nom publié ne l'est jamais.

### D9 — L'ordre de `nodeReads.reads` est déclaré, faute d'être observable

`nodeReads` rend les lectures dans l'ordre de déclaration, **puis** la source de la liaison. Aucun
*kind* actuel ne porte les deux à la fois, donc l'ordre n'est aujourd'hui **pas observable** et
aucun test ne peut l'épingler sans fabriquer un nœud qui n'existe pas.

Il est donc écrit dans le JSDoc de `nodeReads`, et il est choisi pour coïncider avec l'ordre dans
lequel `analyseNode` traite les deux — lectures d'abord, liaison ensuite. Le jour où un *kind*
portera les deux, les deux fonctions rapporteront dans le même ordre parce que c'est écrit, pas
parce que ça tombe bien.

### D10 — Les segments de texte cessent d'être énumérés deux fois

`SEGMENT_EXPRESSIONS` (`ast/visitor.ts:127`) disparaît. La branche `text` de `nodeShape` est le seul
site qui énumère les trois *kinds* de segment pour en extraire une expression, et elle en porte le
chemin (`['content', index, 'value']`) — ce que `SEGMENT_EXPRESSIONS` ne savait pas faire.
`visitSegment` et `SegmentVisitor` restent exportés et inchangés (§1.4).

### D11 — Ni `schemaVersion`, ni contrat de donnée, ni mandat §7

- **Aucun incrément de `schemaVersion`.** [AGENTS.md §1.2](../../AGENTS.md) l'exige pour toute
  évolution d'un schéma **stocké** : perte silencieuse d'une clé, ou union élargie. CH3 ne touche
  aucun `z.object`, n'ajoute ni ne retire aucune clé persistée, et n'élargit aucune union. La
  version reste **9**.
- **Aucun nom de champ réservé, aucun schéma pour `RenderRequest.data`.**
- **Aucun fichier §7 modifié** : ni `tsconfig*`, ni `biome.jsonc`, ni `tools/biome/*.grit`, ni
  `.github/workflows/*`, ni `turbo.json`, ni `package.json`, ni `vitest.config.ts`. Aucune
  dépendance nouvelle : le graphe npm est constant.

### D12 — La preuve est l'accord des deux fonctions publiques, jamais l'égalité des dérivations

Un test qui asserte que `nodeReads(n).reads` égale les expressions de `nodeShape(n)` serait
tautologique — il réécrirait la dérivation qu'il prétend vérifier, ce que
[AGENTS.md §5](../../AGENTS.md) interdit nommément.

Le test qui porte la charge est autre : sur un modèle qui lit **une racine distincte du catalogue à
chaque position déclarable**, `collectTemplateDataPaths` et `checkTemplateDataCompatibility`
rapportent **le même ensemble de chemins écrits**, et **cinq** positions. Les deux fonctions ont des
contrats publics indépendants ; leur accord est un fait, pas une reformulation. C'est le test qui
serait rouge si CH3 était fait à moitié, et c'est celui que l'ablation §10.1 met à l'épreuve.

### D13 — Les tests suivent le découpage de production

`ast/__tests__/visitor.test.ts` (638 lignes) devient trois fichiers alignés sur les trois modules :
`visitor.test.ts` (dispatch), `traverse.test.ts` (parcours dérivés), `shape.test.ts` (la forme et
son accord). Les `describe` existants sont **déplacés sans être réécrits** ; c'est ce qui rend la
§2.3 vérifiable au `git diff`.

---

## 4. Contrat cible

### 4.1 `ast/shape.ts` — la description

```ts
/** The natures a position accepts. Closed vocabulary; the acceptance table belongs to the catalogue. */
export const DATA_EXPECTATIONS = [
  'any', 'printable', 'number', 'boolean', 'text',
  'civil-date', 'primitive', 'orderable', 'list',
] as const;

export type DataExpectation = (typeof DATA_EXPECTATIONS)[number];

/** One expression a node reads, under the expectation its position imposes. */
export interface NodeReading {
  readonly expression: Expression;
  readonly expectation: DataExpectation;
  /** Segments from the node to the expression. */
  readonly at: readonly (string | number)[];
}

/** The sequence a node repeats and the alias it opens for its children. */
export interface NodeBinding {
  readonly source: NodeReading;
  readonly alias: string;
}

/** A run of children stored under one key of their parent, in flow order. */
export interface NodeChildSlot {
  readonly nodes: readonly DocumentNode[];
  /** Segments from the node to the array; a child appends its own index. */
  readonly at: readonly (string | number)[];
}

/** Everything a traversal needs of one node: what it reads, the alias it opens, its children. */
export interface NodeShape {
  readonly readings: readonly NodeReading[];
  readonly binding: NodeBinding | undefined;
  readonly children: readonly NodeChildSlot[];
}

export function nodeShape(node: DocumentNode): NodeShape;
```

### 4.2 `ast/traverse.ts` — les parcours dérivés

Signatures **inchangées**, à l'octet :

```ts
export interface NodeReads {
  readonly reads: readonly Expression[];
  readonly binds: string | undefined;
}

export function childrenOf(node: DocumentNode): readonly DocumentNode[];
export function walk(root: DocumentNode): Generator<DocumentNode>;
export function findNodeById(root: DocumentNode, id: string): DocumentNode | undefined;
export function nodeReads(node: DocumentNode): NodeReads;
export function collectDataPaths(root: DocumentNode): readonly string[];
```

### 4.3 `ast/visitor.ts` — le dispatch, réduit

`NodeVisitor`, `visitNode`, `SegmentVisitor`, `visitSegment`. Inchangés. Le fichier passe de
**191** à environ **120** lignes et n'importe plus `Expression`, `pathsOf` ni `rootSegment`.

### 4.4 `data-catalogue/types.ts` — la réexportation

```ts
/* The expectation vocabulary is a property of the AST -- a position imposes it. What a declared
   nature satisfies is a property of the catalogue and stays in `expectations.ts`. */
export { DATA_EXPECTATIONS } from '../ast/shape.js';
export type { DataExpectation } from '../ast/shape.js';
```

`data-catalogue/data-catalogue.ts` et `packages/core/src/index.ts` continuent de les exporter
depuis `./types.js` : **aucune ligne à changer** dans les deux façades.

### 4.5 Surface publique

**283 noms, inchangés.** Ce qu'on compare est la **liste triée des noms exportés**, extraite de
`packages/core/dist/index.d.ts`, et non le fichier lui-même : un `.d.ts` de barrel nomme le module
d'origine de chaque réexport, donc scinder `./ast/visitor.js` en deux modules **change forcément le
fichier** sans rien changer pour un appelant, qui importe depuis `@openview/core`. Le premier
brouillon de ce plan demandait un fichier identique octet pour octet ; c'était le mauvais oracle, et
la première exécution l'a montré. Vérifié en §7.6.

---

## 5. Algorithmes et invariants

### 5.1 La réconciliation des trois tables, branche par branche

C'est la table de vérité du chantier. Elle est vérifiée avant d'écrire une ligne : si une case
divergeait, CH3 serait un correctif de comportement et non un refactoring.

| *kind* | `childrenOf` (baseline) | `SHAPE.children` (baseline) | Tranches (cible) | Chemin d'un enfant |
| :--- | :--- | :--- | :--- | :--- |
| `text` | `[]` | `[]` | — | — |
| `image` | `[]` | `[]` | — | — |
| `container` | `children` | `children[i]` @ `['children', i]` | `children` @ `['children']` | `['children', i]` ✓ |
| `loop` | `children` | idem | idem | ✓ |
| `condition` | `children` | idem | idem | ✓ |
| `table` | `[...header, ...body, ...footer]` | `['header', i]`, `['body', i]`, `['footer', i]` | trois tranches, même ordre | ✓ |
| `tableRowGroup` | `rows` | `rows[i]` @ `['rows', i]` | `rows` @ `['rows']` | `['rows', i]` ✓ |
| `tableRow` | `cells.flatMap(c => c.children)` | `['cells', ci, 'children', chi]` | une tranche par cellule @ `['cells', ci, 'children']` | ✓ |

| *kind* | `READS_VISITOR` (baseline) | `SHAPE` (baseline) | `nodeShape` (cible) |
| :--- | :--- | :--- | :--- |
| `text` | expressions des segments `binding` | idem + `['content', i, 'value']` + attente `printable` | `readings` |
| `image` | rien | rien | rien |
| `container` | rien | rien | rien |
| `loop` | `reads: [each]`, `binds: as` | `binding` @ `['each']`, attente `list` | `binding` |
| `condition` | `reads: [when]` | `readings` @ `['when']`, attente `boolean` | `readings` |
| `table` | rien | rien | rien |
| `tableRowGroup` | `reads: [each]`, `binds: as` | `binding` @ `['each']`, attente `list` | `binding` |
| `tableRow` | `[pageReport.value]` ou rien | idem + `['pageReport', 'value']` + attente `number` | `readings` |

**Aucune divergence.** `SHAPE` est bien le sur-ensemble strict que l'analyse décrit, et
`READS_VISITOR` s'en déduit en oubliant l'attente et le chemin.

### 5.2 `childrenOf`

```
tranches ← nodeShape(node).children
si tranches compte exactement 1  → rendre ses `nodes` (le tableau stocké)
sinon                            → aplatir (tableau neuf, y compris [] pour zéro tranche)
```

Le cas « exactement une » se lit sans assertion non-nulle : `slots.length === 1 ? slots[0] :
undefined` a le type `NodeChildSlot | undefined` sous `noUncheckedIndexedAccess`, et le `undefined`
retombe sur l'aplatissement.

### 5.3 `nodeReads`

```
forme ← nodeShape(node)
lectures ← forme.readings mappées sur leur `expression`
si forme.binding est absent → { reads: lectures, binds: undefined }
sinon                       → { reads: [...lectures, binding.source.expression], binds: binding.alias }
```

L'ordre est celui de D9. `binds: undefined` est écrit explicitement : `toStrictEqual` exige la clé
présente, et trois tests de la baseline la comparent ainsi.

### 5.4 `analyseNode`, après

L'ordre des effets est **exactement** celui de la baseline, parce que l'ordre des lectures
rapportées est un contrat testé (`data-catalogue/__tests__/compatibility.test.ts:107` et `:115`) :

```
1. les lectures, dans l'ordre de `shape.readings`, chacune sous son attente et à son chemin
2. la liaison si elle existe : lire la source sous SON attente, puis empiler l'alias au chemin ['as']
3. les enfants, tranche par tranche, dans l'ordre, chacun à [...path, ...slot.at, index]
4. dépiler l'alias si une liaison l'a empilé
```

La variable locale `site`, aujourd'hui construite pour n'être lue que par `site.nodeId`, disparaît.

### 5.5 Ce que la dérivation garantit, et ce qu'elle ne garantit pas

**Garanti :** un neuvième *kind* de nœud casse la compilation en un point (`NodeVisitor` via
`nodeShape`). Une fente d'expression ajoutée à un *kind* existant est vue par `collectDataPaths` et
par `checkTemplateDataCompatibility` **sans qu'on ait à y penser**. Un enfant nouveau est descendu
par `walk`, `findNodeById`, `collectDataPaths` et l'analyse de catalogue, tous les quatre.

**Non garanti, et il faut le dire :** rien ne force l'auteur d'une fente nouvelle à choisir la
*bonne* attente. Écrire `expectation: 'text'` là où le runtime veut un nombre reste une erreur que
seul un test attrape. CH3 supprime la classe « déclaré une fois sur deux » ; il ne crée pas de
vérificateur d'attentes, et §5 de l'analyse de dette ne le lui demande pas.

---

## 6. Organisation cible des fichiers

### 6.1 Production — nouveaux

| Fichier | Contenu | Lignes visées |
| :--- | :--- | ---: |
| `packages/core/src/ast/shape.ts` | vocabulaire d'attente, `NodeReading`, `NodeBinding`, `NodeChildSlot`, `NodeShape`, `nodeShape` | ~130 |
| `packages/core/src/ast/traverse.ts` | `childrenOf`, `walk`, `findNodeById`, `NodeReads`, `nodeReads`, `collectDataPaths` | ~95 |

### 6.2 Production — modifiés

| Fichier | Changement |
| :--- | :--- |
| `ast/visitor.ts` | 191 → ~120 lignes : dispatch seul |
| `data-catalogue/compatibility.ts` | 616 → ~520 lignes : importe `nodeShape`, perd `NodeReading`/`NodeChild`/`NodeBinding`/`NodeShape`/`NO_BINDING`/`blockChildren`/`SHAPE` |
| `data-catalogue/types.ts` | 130 → ~120 lignes : réexporte le vocabulaire d'attente |
| `template/paths.ts` | un chemin d'import |
| `index.ts` | le bloc `./ast/visitor.js` se scinde en deux ; **aucun nom ne change** |

### 6.3 Tests

| Fichier | Changement |
| :--- | :--- |
| `ast/__tests__/visitor.test.ts` | ne garde que `visitNode` et `visitSegment` |
| `ast/__tests__/traverse.test.ts` | **nouveau** : `nodeReads`, `childrenOf`, `walk`, `findNodeById`, `collectDataPaths`, `keepTogether` — déplacés tels quels |
| `ast/__tests__/shape.test.ts` | **nouveau** : la forme par *kind*, les chemins, et la preuve d'accord (§7.4) |
| `ast/__tests__/page-report.test.ts` | un chemin d'import |
| `template/__tests__/compatibility.test.ts` | un import scindé (`visitSegment` d'un côté, `findNodeById`/`walk` de l'autre) |
| `template/__tests__/paths.test.ts` | un chemin d'import |

### 6.4 Documentation

`docs/plans/refactoring-huit-chantiers.md` : le bloc de statut cesse d'annoncer « aucun chantier
engagé » et renvoie à ce plan pour CH3. Rien d'autre n'y est réécrit — c'est un registre, et ses
mesures de baseline gardent leur valeur de date.

### 6.5 Fichiers qui ne se touchent pas

`vitest.config.ts`, `biome.jsonc`, `tools/biome/*.grit`, `tsconfig*.json`, `turbo.json`,
`package.json`, `.github/workflows/*` — §7 (D11). `data-catalogue/expectations.ts`,
`data-catalogue/visitor.ts`, `ast/schemas.ts`, `ast/types.ts`, `ast/nodes.ts` — hors périmètre.
`packages/engine/**`, `packages/designer/**`, `packages/viewer/**`,
`packages/adapter-puppeteer/**`, `apps/playground/**` — aucun n'importe un chemin interne de `ast/`.

---

## 7. Stratégie de tests

### 7.1 Le socle : les 1 576 tests de la baseline

Ils sont l'oracle principal, et la §2.3 en fait une condition de sortie : aucune assertion de
comportement réécrite. Un `git diff --stat` sur les fichiers de test doit ne montrer que des
déplacements et des chemins d'import.

Cinq d'entre eux portent la charge et sont nommés ici parce qu'ils sont les plus susceptibles de
révéler une erreur de dérivation :

| Test | Ce qu'il tient |
| :--- | :--- |
| `visitor.test.ts:177` « reports the rows of a group as the STORED reference » | le contrat d'identité de D5, dans ses trois cas |
| `visitor.test.ts:250` « reaches every node of the table through childrenOf, cells included » | 17 et 19 nœuds : une tranche oubliée se voit au comptage |
| `visitor.test.ts:339` « asks the integrator for two keys, and for no per-item field » | les deux mécanismes de filtrage d'alias, dont `binds` |
| `compatibility.test.ts:115` et `:130` (data-catalogue) | l'ordre flux → header → footer, et header → body → footer dans un tableau |
| `compatibility.test.ts:220` « reads a row group alias inside its rows, its cells and its page report » | les chemins `['cells', ci, 'children', chi]` et `['pageReport', 'value']` |

### 7.2 La forme, par *kind* (`shape.test.ts`)

Un cas par *kind*, sur des nœuds validés par `DocumentNodeSchema`, qui asserte les trois champs de
`NodeShape` : les lectures avec leur attente **et leur chemin**, la liaison, les tranches avec leur
chemin. C'est la table §5.1, exécutée.

Non tautologique : les valeurs attendues sont écrites en littéral d'après le contrat, non calculées
depuis la production.

### 7.3 Les huit *kinds*, sans liste périssable

Un test qui parcourt un arbre portant les huit *kinds* et vérifie que `nodeShape` répond pour chacun
sans jeter. Il ne recopie pas la liste des *kinds* : il la dérive de l'arbre parcouru, de sorte
qu'un neuvième *kind* ajouté à la fixture fasse échouer le test tant que `nodeShape` ne le connaît
pas — et non l'inverse.

### 7.4 La preuve d'accord (D12)

Un modèle où **chaque position déclarable lit une racine distincte du catalogue**, sans alias :

| Position | Chemin lu | Attente |
| :--- | :--- | :--- |
| `TextNode.content[i].value` (segment `binding`) | `epreuve.libelle` | `printable` |
| `ConditionNode.when` | `epreuve.affiche` | `boolean` |
| `LoopNode.each` | `epreuve.elements` | `list` |
| `TableRowGroupNode.each` | `epreuve.postes` | `list` |
| `TableRowNode.pageReport.value` | `epreuve.report` | `number` |

Plus un `ImageNode`, un `ContainerNode` et le `TableNode` lui-même, qui ne lisent rien — pour
qu'aucune position ne soit conforme par absence.

Trois assertions :

1. `collectTemplateDataPaths(modèle)` et les `writtenPath` de
   `checkTemplateDataCompatibility(modèle, catalogue)` rendent **le même ensemble** ;
2. l'analyse rapporte **cinq** lectures — une position perdue en silence est un ensemble encore
   égal si les deux fonctions la perdent, mais pas un compte de cinq ;
3. l'analyse est `compatible: true` contre un catalogue qui déclare les cinq racines aux natures
   ci-dessus — ce qui vérifie du même coup que chaque position transporte la **bonne** attente et
   pas seulement une attente.

### 7.5 Le vocabulaire d'attente, après déplacement

Un test asserte que `DATA_EXPECTATIONS` importé depuis `@openview/core` et depuis
`data-catalogue/types.js` est la **même** valeur, et que `acceptedKindsOf` répond pour chacune de
ses entrées. Le second point existe déjà (`data-catalogue/__tests__/compatibility.test.ts:415`) ; le
premier vérifie que la réexportation de D6 n'a pas dédoublé la constante.

### 7.6 La surface publique, par `diff` sur les noms

```bash
pnpm run build
# extraire les noms des accolades de chaque réexport de dist/index.d.ts, trier, comparer
diff <baseline>/core-surface.txt <apres>/core-surface.txt   # doit être vide
```

283 noms avant, 283 après, **le même ensemble**. Le `.d.ts` lui-même diffère de quatre lignes — les
réexports de `./ast/visitor.js` se scindent en `./ast/traverse.js` et `./ast/visitor.js` — et c'est
attendu (§4.5). C'est la vérification de D8.

### 7.7 Les quatre portes

Dans l'ordre, sans exception :

```bash
pnpm run lint && pnpm run build && pnpm run type-check && CI=1 pnpm run test:coverage
```

Cible de couverture : `ast/` et `data-catalogue/` **restent à 100 %** sur les quatre métriques.
L'agrégat ne doit pas régresser sous la baseline (93,70 / 90,74 / 98,34 / 93,60).

---

## 8. Recette

CH3 n'a pas d'oracle humain : il ne change rien de visible. Sa recette est la démonstration que
**rien** n'a changé, et elle a trois pièces.

### 8.1 Le playground rend le même écran

`pnpm run build` inclut `@openview/playground`. Le playground affiche
`collectTemplateDataPaths(sampleTemplate)` en deux endroits (`App.tsx:194` et `:2205`) et compare
deux modèles (`App.tsx:639-640`). Les deux listes doivent rester identiques, ce que le build vérifie
par compilation et ce que les tests de `template/__tests__/paths.test.ts` vérifient par valeur.

### 8.2 Les 1 576 tests, sans réécriture d'assertion

Voir §7.1. C'est la pièce principale.

### 8.3 Le `.d.ts` du barrel, identique

Voir §7.6.

---

## 9. Incréments d'exécution

Chaque incrément passe les quatre portes avant le suivant. Aucun n'est un point d'arrêt
intermédiaire livrable seul : le chantier est atomique du point de vue de la revue, mais découpé du
point de vue de l'exécution pour que la porte dise *où* ça casse.

### INC-0 — Baseline et oracles

Rejouer les quatre portes sans rien modifier. Archiver `packages/core/dist/index.d.ts` et la liste
triée de ses 283 noms. C'est fait : les chiffres sont dans le bloc de statut de ce plan, et ils
concordent avec ceux de l'analyse de dette au centième.

### INC-1 — `ast/shape.ts`, sans consommateur

Créer `shape.ts` avec le vocabulaire d'attente, les types et `nodeShape`. Déplacer
`DATA_EXPECTATIONS` / `DataExpectation` et poser la réexportation dans
`data-catalogue/types.ts`. **Rien ne consomme encore `nodeShape`** : les trois tables coexistent le
temps d'un incrément.

Portes : les quatre. La couverture de `shape.ts` sera incomplète à cet instant — c'est attendu et
c'est la raison pour laquelle INC-1 et INC-2 sont un seul commit.

### INC-2 — `ast/traverse.ts` et réduction de `visitor.ts`

Créer `traverse.ts` avec les cinq parcours dérivés de `nodeShape`. Retirer de `visitor.ts` tout ce
qui n'est pas du dispatch. Mettre à jour `index.ts`, `template/paths.ts`, et les imports des tests.
Scinder `visitor.test.ts` en `visitor.test.ts` + `traverse.test.ts` par **déplacement**.

Portes : les quatre, plus le `diff` du `.d.ts` (§7.6).

### INC-3 — `compatibility.ts` consomme la forme

Remplacer `SHAPE` et ses quatre interfaces locales par `nodeShape`. Réécrire `analyseNode` sur les
tranches. Supprimer `blockChildren`, `NO_BINDING` et l'import de `visitSegment`.

Portes : les quatre. Les 46 cas de `data-catalogue/__tests__/compatibility.test.ts` sont l'oracle,
et aucun ne doit être touché.

### INC-4 — `shape.test.ts` et la preuve d'accord

Écrire les tests §7.2, §7.3, §7.4 et §7.5.

Portes : les quatre, couverture de `ast/` et `data-catalogue/` à 100 %.

### INC-5 — Ablations, statut de l'analyse, clôture

Exécuter les cinq ablations de §10 et consigner leur résultat **mesuré** dans ce fichier. Mettre à
jour le bloc de statut de `refactoring-huit-chantiers.md`. Rejouer les quatre portes une dernière
fois.

---

## 10. Preuves d'ablation

Chaque ablation est une modification temporaire, exécutée, **mesurée**, puis annulée. Une ablation
qui ne fait rien rougir désigne un test manquant, pas une ablation ratée.

**Exécutées le 2026-08-27** sur `pnpm vitest run --project @openview/core` — 38 fichiers,
1 155 tests verts avant chaque ablation, source restaurée après chacune. Les cinq colonnes de
droite sont relevées, pas prévues.

| # | Ablation | Attendu | Mesuré |
| :-- | :--- | :--- | :--- |
| A1 | Retirer la lecture `pageReport` de la branche `tableRow` de `nodeShape` | rouge dans les **deux** familles à la fois | **4 fichiers, 10 tests.** `ast/__tests__/page-report.test.ts` (« *is read by the row that declares it and by no other node* ») **et** `data-catalogue/__tests__/compatibility.test.ts` (« *reads a row group alias inside its rows, its cells and its page report* »), plus `recipe.test.ts` et `shape.test.ts` |
| A2 | Retirer la tranche `footer` de la branche `table` | comptage de nœuds, recherche par id, ordre de l'analyse | **3 fichiers, 5 tests.** `traverse.test.ts`, `data-catalogue/__tests__/compatibility.test.ts`, `shape.test.ts` |
| A3 | Changer `at` d'une tranche de `['cells', ci, 'children']` en `['cells', ci]` | les positions de l'analyse, et **rien** dans `traverse.test.ts` | **2 fichiers, 2 tests.** « *walks the header rows, the body and the footer rows of a table, in that order* » et le cas de tranches de `shape.test.ts`. `traverse.test.ts` **reste vert** |
| A4 | Faire rendre à `childrenOf` un tableau neuf dans tous les cas | le contrat d'identité de D5 | **1 fichier, 1 test.** « *reports the rows of a group as the STORED reference, and computes the rest* » |
| A5 | Remplacer l'attente `boolean` de `ConditionNode.when` par `any` | le cas d'incompatibilité de l'analyse | **2 fichiers, 3 tests.** « *reads a string in a condition as compatible: false* », « *requires a boolean of the guard of a condition* », « *carry the expectation of each position, and not merely an expectation* » |

**Ce que A1 établit, et c'est le chantier entier :** une seule ligne retirée d'un seul fichier rend
rouges *les deux* fonctions publiques. À la baseline, retirer la même chose de `READS_VISITOR`
seul laissait `checkTemplateDataCompatibility` intégralement vert — et l'inverse aussi. C'est la
dérive silencieuse de §1.2, devenue impossible.

**Ce que A3 établit :** les chemins n'existent que pour l'analyse. `traverse.test.ts` reste vert
sous une ablation qui casse toutes les positions, ce qui confirme que `childrenOf` et `nodeReads`
ne dépendent pas de `slot.at` — la description porte plus que ses deux premiers consommateurs, et
c'est voulu.

**Une prédiction à corriger.** §7.4 avait été écrit en supposant que son assertion de compatibilité
resterait verte sous A5, et que seul le cas d'incompatibilité de `data-catalogue` rougirait. Mesuré,
`shape.test.ts` rougit **aussi**, sur la carte position → attente : `any` accepte bien un booléen,
donc `compatible` reste vrai, mais l'attente rapportée n'est plus celle déclarée. §7.4 est donc plus
discriminant que le plan ne l'annonçait — la carte d'attentes attrape ce que l'assertion de
compatibilité seule laissait passer.

## 11. Définition de fini

CH3 est fini quand **tout** ce qui suit est vrai, et vérifié plutôt qu'affirmé :

1. `packages/core/src/ast/shape.ts` existe et est le **seul** site de `core`, hors dispatch
   (`visitNode`), qui énumère les huit *kinds* de nœud :
   `grep -rln "tableRow:" packages/core/src --include='*.ts' | grep -v __tests__` ne rend que
   `ast/visitor.ts` et `ast/shape.ts`, et `grep -rn "NodeVisitor<"` hors tests ne rend qu'une seule
   implémentation, `SHAPE`.
2. `SEGMENT_EXPRESSIONS` n'existe plus, et un seul site énumère les trois *kinds* de segment pour
   en extraire une expression.
3. `childrenOf`, `nodeReads` et `analyseNode` dérivent tous de `nodeShape`. Aucune table par
   *kind* ne subsiste dans `data-catalogue/compatibility.ts`.
4. `DATA_EXPECTATIONS` et `DataExpectation` sont déclarés dans `ast/shape.ts` et réexportés par
   `data-catalogue/types.ts`. Aucun import de `ast/` vers `data-catalogue/`.
5. Les **quatre portes** passent : `lint`, `build`, `type-check`, `CI=1 test:coverage`.
6. **Aucune assertion de comportement n'a été réécrite** dans les tests existants. Le `git diff`
   des fichiers de test ne montre que des déplacements et des chemins d'import.
7. **L'ensemble des noms exportés par `packages/core/dist/index.d.ts` est identique** à celui de
   la baseline : 283 noms, `diff` vide sur la liste triée (§4.5, §7.6).
8. `ast/` et `data-catalogue/` sont à **100 %** sur les quatre métriques ; l'agrégat n'est pas
   sous la baseline.
9. Les cinq ablations de §10 ont été exécutées et leur résultat mesuré est consigné dans ce
   fichier.
10. `CURRENT_SCHEMA_VERSION` vaut toujours **9**, et aucun fichier §7 n'a été modifié.
11. Le bloc de statut de `refactoring-huit-chantiers.md` ne dit plus « aucun chantier engagé ».

---

## 12. Risques et réponses prévues

### La dérivation change l'ordre des lectures rapportées

C'est le risque principal, parce que l'ordre est un contrat testé — `TemplateDataCompatibility`
documente « in the order the traversal produced it ». **Réponse :** §5.4 fixe l'ordre des effets
avant d'écrire une ligne, et les cas `compatibility.test.ts:107`, `:115` et `:130` le tiennent. Si
l'un rougit, c'est la dérivation qu'on corrige, jamais le test.

### `childrenOf` devient plus coûteux et personne ne le mesure

**Réponse :** D1 nomme le coût, nomme ce qui le paie, et nomme le chemin qui ne le paie pas (le
rendu, qui passe par `visitNode`). CH3 n'ajoute pas de benchmark : l'analyse de dette est statique
et §7.6 de celle-ci l'écrit. Si le coût devenait un sujet, la réponse serait un `nodeShape` à
tranches paresseuses — pas un retour à trois tables.

### Le déplacement de `DataExpectation` casse la surface publique sans qu'on le voie

**Réponse :** §7.6 le rend impossible à ne pas voir. Le `diff` porte sur l'ensemble des noms, parce
que c'est cela qu'un appelant voit — et non sur le `.d.ts`, qui nomme les modules internes et bouge
donc pour des raisons sans conséquence.

### Le découpage en trois fichiers rend `ast/` plus dur à lire

C'est un coût réel : trois fichiers là où il y en avait un, et un lecteur qui cherche `childrenOf`
doit savoir qu'il est dans `traverse.ts`. **Réponse :** le cycle de D3 ne laisse pas le choix pour
deux des trois, et le troisième découpage suit le motif que le dépôt a déjà validé
(`expression/evaluator/`). Le JSDoc de tête de chaque fichier dit en une ligne ce qu'il porte.

### `nodeShape` devient un fourre-tout à mesure que les *kinds* grossissent

Le vrai risque à moyen terme : `NodeShape` gagne un champ à chaque besoin nouveau, et redevient le
monolithe que CH7 combat ailleurs. **Réponse, et c'est un seuil, pas une intention :** `NodeShape`
porte trois champs — lectures, liaison, enfants — parce que ce sont les trois questions que les
parcours posent. **Un quatrième champ qui ne serait lu que par un seul consommateur est le signal
qu'il faut un second Visiteur, pas un champ de plus.** C'est exactement l'arbitrage que
[la règle anti-sur-ingénierie](../../AGENTS.md) énonce, appliqué ici à l'avance.

### CH3 dérive vers CH7

`compatibility.ts` perd ~95 lignes et la tentation de finir le découpage dans le même commit est
réelle. **Réponse :** §2.2 l'exclut nommément, et l'ordonnancement de l'analyse dit pourquoi — CH7
a son propre plan à écrire, et sa portée dépasse `compatibility.ts`.

### Le test d'accord donne une fausse assurance

Deux fonctions qui perdent la **même** position rendent encore le même ensemble. **Réponse :** la
deuxième assertion de §7.4 compte les positions (cinq), et l'ablation A1 vérifie que le compte
bouge. Sans A1, §7.4 vaudrait moins que ce qu'il prétend.

---

## 13. Contrôle de périmètre avant exécution

Cinq questions, à repasser avant d'ouvrir un fichier. Une réponse « oui » arrête le chantier.

1. Le changement modifie-t-il la sortie d'une fonction publique de `@openview/core` pour une entrée
   valide ? → hors périmètre (§2.3).
2. Ajoute-t-il ou retire-t-il un nom du barrel public ? → hors périmètre (D8, §4.5).
3. Touche-t-il un fichier de [AGENTS.md §7](../../AGENTS.md) ? → hors périmètre, mandat non accordé
   (D11).
4. Réécrit-il l'assertion d'un test existant, plutôt que de la déplacer ? → c'est le signal que la
   dérivation est fausse, pas le test (§2.3, §11.6).
5. Découpe-t-il `compatibility.ts` ou `materialize.ts` en modules ? → c'est CH7 (§2.2).
