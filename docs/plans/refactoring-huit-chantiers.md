# Analyse de dette — huit chantiers de refactoring transverses

> **Statut :** analyse. **CH3 est engagé et livré** — son plan est
> [`ch3-la-forme-d-un-noeud.md`](ch3-la-forme-d-un-noeud.md), et §2 ci-dessous garde le constat
> d'origine plutôt que d'être réécrit : c'est un registre daté. Les sept autres chantiers ne sont
> pas engagés. Ce document ne planifie rien : il relève, mesure et ordonne. Aucun fichier du dépôt
> n'a été modifié pour le produire, et il ne vaut mandat pour aucun des fichiers protégés par
> [AGENTS.md §7](../../AGENTS.md).
>
> **Baseline relevée le 2026-08-27**, sur `claude/codebase-refactoring-analysis-kesqaa` :
> `CURRENT_SCHEMA_VERSION` = **9** · barrel public de `@openview/core` à **283** valeurs ·
> lots **C1–C11** et **E1–E3** livrés, **E4** et suivants devant · **1 576** tests sur **55**
> fichiers · branches à **90,74 %** pour un plancher à 90 %.
>
> **Date de rédaction :** 2026-08-27 · **Portée :** les cinq paquets et le playground ·
> **Lot :** aucun — l'analyse est transverse par construction

---

## 0. Le résultat attendu : un motif unique, décliné huit fois

Les quatre portes passent au vert. La discipline de typage tient : ni `any`, ni `!`, ni
`@ts-ignore`, ni `as unknown as`, ni `catch` vide, et le sens des dépendances est respecté.
**Aucun des huit chantiers ci-dessous n'est un correctif de bug.**

Ce qui a dérivé relève d'un seul motif, décliné : **une même connaissance est écrite à plusieurs
endroits, et rien ne force les copies à rester d'accord.** Sept fois pour les parcours de blocs
matérialisés, trois fois pour la forme d'un nœud d'AST, trois fois pour le CSS d'une boîte — et
dans ce dernier cas les copies **ont déjà divergé**, avec des décisions opposées assumées de part
et d'autre.

Le classement qui suit est par **gravité**, non par coût. Les quatre premiers chantiers bloquent
ou fragilisent un lot devant nous ; les quatre suivants sont de l'hygiène.

| # | Chantier | Nature | Ce qu'il met en cause |
| :-- | :--- | :--- | :--- |
| CH1 | `MaterialBlock` sans Visiteur | structurel | AGENTS.md §3.B ; la marge de la porte des branches |
| CH2 | `measure.ts` hors de portée de la mesure | risque | E6, E7 |
| CH3 | La forme d'un nœud écrite trois fois | dérive silencieuse | le contrat de `collectDataPaths` — **livré**, [plan](ch3-la-forme-d-un-noeud.md) |
| CH4 | Le CSS du moteur réécrit ailleurs | dette playground | **reclassé par E5** — voir §CH4 |
| CH5 | `App.tsx`, 2 303 lignes sans test | maintenabilité | AGENTS.md §1.6 |
| CH6 | `core/index.ts` réénuméré à la main | frottement | le comptage manuel du barrel |
| CH7 | Deux modules de 600 lignes | hygiène | AGENTS.md §2 |
| CH8 | Le garde d'erreur en triple | petit | — |

---

## 1. Baseline relevée et méthode

### 1.1 Relevé des quatre portes

Exécutées dans cet ordre, sans modifier le dépôt :

| Porte | Résultat |
| :--- | :--- |
| `pnpm run lint` | 215 fichiers vérifiés, aucune correction appliquée |
| `pnpm run build` | 6 tâches sur 6 |
| `pnpm run type-check` | 11 tâches sur 11 |
| `CI=1 pnpm run test:coverage` | 1 576 tests, 55 fichiers |

Couverture : **statements 93,70 %** · **branches 90,74 %** · **functions 98,34 %** ·
**lines 93,60 %**. Le plancher déclaré par [`vitest.config.ts`](../../vitest.config.ts) est de
90 % sur les quatre métriques, globalement et par paquet pour `core` et `engine` seulement.

### 1.2 Ce qui est mesuré et ce qui est déduit

Tout chiffre de ce document est **mesuré** : compté par `grep`, `wc`, la sortie de `tsc`, ou lu
dans le tableau de couverture v8. Les numéros de ligne sont ceux de la baseline et **périmeront** au
premier commit qui touche ces fichiers ; ils sont donnés pour être vérifiables aujourd'hui, pas
pour être recopiés plus tard.

Ce qui relève du jugement est signalé comme tel. Un cas est explicitement classé **dette et non
défaut** en §2.4 après vérification qu'il est inatteignable — la vérification compte autant que le
constat.

### 1.3 Une remarque d'environnement, pas un défaut du dépôt

En conteneur, la quatrième porte échoue tant que `CI` n'est pas positionnée : les 62 tests de
`adapter-puppeteer` meurent à `puppeteer.launch` sur « *Running as root without `--no-sandbox` is
not supported* ». C'est le comportement voulu — `HOST_LAUNCH_OPTIONS`
(`packages/adapter-puppeteer/src/__tests__/fixtures.ts:37-38`) ne passe `--no-sandbox` que si
`process.env.CI` est défini, et son commentaire dit pourquoi ce n'est pas le défaut de
`createPuppeteerPdfStrategy`. Avec `CI=1`, les 1 576 tests passent.

**Aucune action demandée.** La remarque est consignée parce qu'un lecteur qui rejoue les portes
dans un conteneur croira à une régression.

---

## 2. Les quatre chantiers structurels

### CH1 — `MaterialBlock` est un Composite sans Visiteur, et sept parcours l'écrivent à la main

`MaterialBlock` (`packages/engine/src/document/types.ts:148`) est une union de quatre *kinds* :
`text`, `image`, `container`, `table`. Elle est parcourue **cinq fois hors tests** et **deux fois
de plus** dans les aides de test. Chaque site réécrit son `switch`, son `default` exhaustif et sa
descente de table.

| Fichier | Rôle du parcours | Descend la table |
| :--- | :--- | :--- |
| `document/images.ts:13` | collecte les images du document | oui, l. 21 |
| `pagination/markers.ts:33` | collecte les typographies de marqueur | oui, `collectRows` l. 23 |
| `pagination/progress.ts:38` | compte les unités de progression | oui, `rowUnits` l. 24 |
| `pagination/whole.ts:26` | fabrique le fragment non coupé | oui, `wholeRow` l. 8 |
| `pagination/flow.ts:98` | place un bloc dans la hauteur restante | délègue à `placeTable` |
| `__tests__/metrics.ts:88` | hauteurs simulées | oui, l. 105 |
| `__tests__/metrics.ts:164` | clés mesurables | oui, l. 176 |

Deux duplications supplémentaires, mesurées :

- le littéral `'Unhandled materialised block'` apparaît **sept fois** ;
- le parcours du document entier — `headerBands`, puis `root`, puis `footerBands` — est réécrit
  **quatre fois** : `images.ts:46`, `markers.ts:65`, `progress.ts:70`, `metrics.ts:139`.

#### La règle, et pourquoi l'amendement de C2 ne couvre pas ce cas

> « Composite sans Visitor est un demi-patron : sans lui, `switch (node.type)` se duplique dans le
> rendu, la validation, la collecte de variables et la recherche par id — et chaque nouveau type de
> bloc impose de toucher huit fichiers. »
>
> — [AGENTS.md §3.B](../../AGENTS.md)

L'amendement obtenu au lot C2 ([ADR 0004](../adr/0004-les-arrondis-declares-par-le-modele.md),
décision 11 ; `c2-arrondis-declares-par-le-modele.md:774-818`) a une portée écrite noir sur blanc :
**« l'algèbre d'expressions uniquement »**. Il ne dispense pas les Composites de document, et il
réaffirme la règle pour eux. `MaterialBlock` en est un.

#### Le coût, aujourd'hui et au prochain *kind*

Un cinquième *kind* de bloc oblige à toucher sept fichiers. Et seuls les `switch` casseraient à la
porte 2 : la descente de table et le parcours des bandes ne sont vérifiés par rien. **Un nouveau
bloc porteur d'enfants serait silencieusement non descendu** — pas d'erreur, une image manquante
dans la liste remise à l'adaptateur, ou une typographie de marqueur non réservée.

Un second effet est mesurable, et c'est celui qui rend le chantier chiffrable. Les sept `default:`
dupliqués sont inatteignables, donc jamais couverts, et ils pèsent sur la porte la plus tendue du
dépôt — **branches à 90,74 % pour un plancher à 90 %**, soit 0,74 point de marge. Le dépôt compte
**15** sites `const exhaustive: never` hors tests, **18** en les comptant.

| Fichier | Branches | Lignes non couvertes |
| :--- | ---: | :--- |
| `pagination/whole.ts` | 77,77 % | 62–63 — le `default` |
| `document/images.ts` | 80,00 % | 30–31 — le `default` |
| `html/serialize.ts` | 85,71 % | 65–66 — le `default` |
| `html/build.ts` | 86,66 % | 76–77 et 241–242 — deux `default` |
| `pagination/markers.ts` | 90,90 % | 55–56 — le `default` |
| `pagination/progress.ts` | 97,29 % | 52–53 — le `default` |

#### Piste

Un `engine/src/document/traverse.ts` portant **les deux formes**, parce qu'elles ne sont pas
interchangeables :

1. `MaterialBlockVisitor<TResult>` et `visitBlock()`, calqués sur `visitNode` de `core`
   (`packages/core/src/ast/visitor.ts:36`), pour les deux sites de **vraie répartition par
   *kind*** : `flow.ts` et `whole.ts` font des choses réellement différentes selon le bloc.
2. `walkBlocks(document)`, un générateur qui aplatit bandes, racine, tables, lignes, cellules et
   enfants, pour les quatre **replis purs** : `images.ts`, `markers.ts`, `progress.ts` et
   `metrics.ts` ne veulent qu'énumérer.

Un seul site `exhaustive` au lieu de sept. `images.ts` passe d'environ 55 lignes à une vingtaine.

**Second Composite dans le même état, à traiter dans le même fichier :** `MaterialFragment`
(`pagination/types.ts:77`), quatre *kinds* lui aussi, parcouru dans `html/build.ts:194`,
`pagination/reports.ts:47-50` et `__tests__/fixtures.ts:162-196`.

### CH2 — 227 lignes d'arithmétique de coupe hors de portée de la mesure, par construction

`packages/adapter-puppeteer/src/measure.ts` est sérialisé et évalué **dans Chromium**
(`session.ts:129` : `page.evaluate(measureInPage)`). La couverture v8 tourne dans le processus
Node : elle ne peut pas l'instrumenter. Le rapport annonce **0 % sur les lignes 11 à 226**, et il
annoncera toujours 0 %.

C'est le plus gros fichier source du dépôt sans mesure possible, et il porte la logique la plus
lourde de conséquences du pipeline : les hauteurs et les frontières de ligne qui **décident où les
pages sont coupées**.

| Dans la fonction | Lignes | Ce qu'elle décide |
| :--- | ---: | :--- |
| `boundariesOf` | 55–91 | où une ligne de texte se termine — donc où un paragraphe se coupe |
| `contentHeightOf` | 22–32 | la hauteur réelle, prise sur les bords des descendants plutôt que `scrollHeight` |
| `contentBoxOf` | 35–42 | ce que `padding` et filets laissent à l'intérieur |
| `tolerance` | 11 | 0,5 px — le seuil qui sépare un débordement d'un arrondi sous-pixel |

Seconde moitié du problème : **`adapter-puppeteer` n'a aucun plancher par paquet.**
`vitest.config.ts` n'en déclare que pour `core` et `engine`, et son propre commentaire explique
pourquoi ce choix a été fait — sans anticiper qu'un troisième paquet porterait 227 lignes
critiques. L'agrégat passe à 93,7 % parce que `core` le porte.

#### La contrainte à respecter, et non à contourner

Le JSDoc de `measureInPage` a raison :

> *Self-contained on purpose: the function is serialised and evaluated in the page, so it can close
> over nothing from this module.*

On ne peut rien y importer. **Ce n'est donc pas un découpage en modules qui résout ce chantier**, et
toute proposition qui commence par « extraire dans un fichier voisin et importer » est fausse.

#### Piste

Réduire la fonction en page à de la **collecte** — interroger le DOM, renvoyer les rectangles bruts
indexés par clé — et déplacer toute la **dérivation** dans un module Node voisin qui consomme des
enregistrements de rectangles ordinaires. La fonction sérialisée reste autonome et devient
mécanique ; l'arithmétique qui décide des coupes devient testable en Node, sur des fixtures, sans
navigateur. Puis déclarer un plancher pour `adapter-puppeteer` — ce qui n'a de sens qu'une fois la
partie pure extraite.

Ce chantier sert directement deux lots devant nous :
[**E6**](../roadmap/engine.md#e6-le-même-document-à-chaque-fois) (« le même document, à chaque
fois ») et [**E7**](../roadmap/engine.md#e7-le-lot-de-documents-figés-de-non-régression) (le corpus
figé de non-régression). Aucun des deux n'est solide si la mesure qui décide des coupes n'est
vérifiée que par deux tests d'intégration Chromium.

### CH3 — La forme d'un nœud d'AST est écrite trois fois dans `core`

Trois énumérations des huit *kinds* de nœud, qui répondent à des variantes de la même question —
« quelles expressions ce nœud porte, quel alias il ouvre, quels enfants il a » :

| Site | Ce qu'il énumère |
| :--- | :--- |
| `ast/visitor.ts:64` — `childrenOf` | les enfants, par *kind* |
| `ast/visitor.ts:133` — `READS_VISITOR` | les expressions **et** l'alias, par *kind* |
| `data-catalogue/compatibility.ts:468` — `SHAPE` | les expressions **et l'attente de type et le chemin**, l'alias **et son chemin**, les enfants **et leur chemin** |

`SHAPE` est un **sur-ensemble strict** des deux autres. Les consommateurs, eux, sont distincts :
`collectDataPaths` / `collectTemplateDataPaths` d'un côté, `checkTemplateDataCompatibility` de
l'autre. Rien dans le système de types ne les relie.

#### Le risque, précisément

Donnez une nouvelle fente d'expression à un *kind* existant — un `ImageNode` dont le `src`
devient une liaison, par exemple — et **une seule des deux fonctions publiques la rapportera**. Pas
d'erreur de compilation, pas de test rouge, sauf si quelqu'un a pensé à écrire le test des deux
côtés. Le modèle déclarerait une lecture que `collectDataPaths` ne restituerait pas, alors que
c'est la promesse publique de cette fonction, et celle que
[AGENTS.md §1.2](../../AGENTS.md) énonce : « *Ce que le modèle déclare, ce sont ses lectures, et
`collectDataPaths()` les restitue.* »

#### Piste

Faire de `SHAPE` la source unique, dans `ast/` : un `ast/shape.ts` exportant
`nodeShape(node): NodeShape`, puis `childrenOf` et `nodeReads` **dérivés** de lui, et
`compatibility.ts` qui l'importe au lieu de le redire. Environ 75 lignes quittent
`compatibility.ts`, et la dérive devient une erreur de compilation.

Effet secondaire qui vaut mieux qu'une déduplication : l'**attente de type** — « le `when` d'une
condition est booléen », « une contribution de report est un nombre » — ne vit aujourd'hui que dans
`data-catalogue`. C'est une propriété de l'AST. La remonter la met là où elle est vraie.

### CH4 — Le CSS du moteur est réécrit ailleurs, avec des décisions opposées

> 🔻 **Reclassé le 2026-08-28 par E5** ([ADR 0018](../adr/0018-le-moteur-sait-dire-ou-il-coupe.md)).
> Ce chantier n'est **plus un préalable au viewer**. Le raisonnement « le viewer butera sur le même
> mur et produira une quatrième orthographe du même CSS » supposait qu'un paquet navigateur doive
> *écrire* le CSS du document. E5 tranche autrement : le viewer reçoit l'**HTML autonome du moteur**,
> style compris, et l'affiche dans un contexte isolé sans le retoucher. Il n'écrit aucun CSS de
> document, donc il ne peut pas en produire une quatrième orthographe.
>
> Ce qui reste est réel et inchangé : **la dette du playground**, qui écrit son propre CSS et
> **diverge déjà sur la géométrie des boîtes** — filets en `border` là où le moteur peint en
> `box-shadow: inset`. Cette divergence-là reste une fausse promesse de fidélité dans la vitrine, et
> la piste ci-dessous reste la bonne réponse. Elle n'ordonnance simplement plus V2 ni V3.
>
> **Signal de réouverture en tant que bloquant :** un besoin réel, pour le viewer ou l'éditeur,
> d'écrire lui-même le CSS d'un document — un aperçu partiel pendant l'édition, par exemple, qui ne
> passerait pas par une composition du moteur.

Le playground réimplémente trois primitives internes du moteur. **Une seule des trois divergences
est bénigne**, et c'est vérifié plutôt que supposé.

| Playground | Moteur | Divergence |
| :--- | :--- | :--- |
| `App.tsx:251` `partsDeLargeur` | `html/css.ts` `columnWidths` | Même formule. Le garde `cssNumber` sur la forme exponentielle manque — mais il est **inatteignable** pour un modèle valide : `MIN_COLUMN_WIDTH = 1` et `MAX_COLUMN_WIDTH = 1000` (`ast/types.ts:111-112`) placent le plancher du quotient bien au-dessus du seuil de notation exponentielle. **Dette, pas défaut.** |
| `App.tsx:369` `familleDePoliceCss` | `html/escape.ts` `cssFontFamily` | **Décisions opposées, assumées des deux côtés.** Le moteur garde `serif`, `sans-serif`, `monospace`, `cursive` et `fantasy` comme mots-clés génériques ; le playground cite tout, `serif` compris, et son JSDoc argumente ce choix. Un modèle qui déclare `serif` ne résout pas pareil dans l'aperçu et dans le PDF. |
| `App.tsx:430` `styleCssDe`, `filetCss:391` | `html/css.ts` `boxCss`, `runCss` | Le moteur peint les filets en `box-shadow: inset` **précisément** pour qu'ils n'entrent pas dans la formule de largeur et que deux filets voisins n'additionnent pas leurs épaisseurs — c'est l'une des six corrections que l'[ADR 0012](../adr/0012-une-facture-d-une-page-sort-en-pdf.md) a apportées au plan E1. Le playground écrit `borderTop`/`Right`/`Bottom`/`Left` : **il reproduit l'artefact que le moteur a écarté**, sur la géométrie des boîtes. |

#### Pourquoi c'est structurel et non du laisser-aller

Le barrel du moteur le dit noir sur blanc — « *the html vocabulary and the css helpers stay
internal: they are how a render is produced, not something a caller may depend on* » — et
[AGENTS.md §2](../../AGENTS.md) interdit à `designer` et `viewer` d'importer `engine`, pour ne pas
embarquer Chromium dans le bundle client. **Le playground ne *peut pas* réutiliser ces fonctions.**

Or ce sont des fonctions de chaîne **pures**, sans DOM ni Node, sur des types de `core` :
`BoxStyle`, `BorderEdge`, `Typography`, `TableColumn`. Elles ne sont dans `engine` que par accident
d'ordre de livraison.

#### Ce que ça coûtera si on ne le fait pas maintenant

> « La fidélité promise est **« identique au PDF, garanti »**. C'est le mot *garanti* [qui
> engage]. »
>
> — [`docs/roadmap/viewer.md:27`](../roadmap/viewer.md)

Le lot [**V3**](../roadmap/viewer.md#v3-la-garantie-est-vérifiée-automatiquement) « compare
automatiquement l'aperçu et le PDF sur les factures de référence, et refuse toute divergence », et
la roadmap ajoute que ce lot **est** la décision « identique, garanti » : le retirer oblige à
réécrire le README.

**Ce paragraphe concluait que le `viewer` butera sur le même mur. E5 l'a rendu faux** : le viewer
affiche l'HTML du moteur, style compris, et n'écrit donc aucun CSS de document. La conséquence qui
subsiste est celle du playground, qui diverge déjà sur la géométrie des boîtes — une vitrine qui
promet la fidélité et ne la tient pas.

#### Piste

Déplacer les primitives d'écriture CSS dans `@openview/core`, par exemple
`core/src/style/css.ts` : `cssNumber`, `mm`, `px`, `cssString`, `cssFontFamily`, `columnWidths`,
`boxCss`, `runCss`, `textCss`. Les réexporter depuis `engine`, pour que rien n'y change de forme.
Aucune dépendance nouvelle, aucun DOM, aucun Node : les `lib`/`types` de `core` restent satisfaits.

**Une question de conception à trancher au passage :** `ResolvedTypography` vit dans
`engine/document/types.ts:19` et `runCss` en dépend. Soit ce type descend dans `core`, soit `runCss`
prend ses champs résolus en paramètres. Le second choix est le moins engageant — la *résolution*
d'une typographie est une décision du moteur, son *écriture* ne l'est pas.

---

## 3. Les quatre chantiers d'hygiène

### CH5 — `App.tsx` : 2 303 lignes, aucun test, et §1.6 non tenu de bout en bout

| Mesure | Valeur | Détail |
| :--- | ---: | :--- |
| lignes | 2 303 | dont 1 731 de code, 451 de commentaire, 121 vides |
| déclarations de module | 102 | toutes exécutées à l'import |
| composants React | 3 | `Bloc`:484, `Tableau`:555, `App`:1480 |
| avant le premier composant | 64 % | l. 1–1479 : fixtures et dérivations |
| le JSX de `App` | ~820 | un seul `return`, 23 sections `<h2>`/`<h3>` |
| lignes d'import | 273 | — |
| tests | 0 | `apps/` est hors de `projects` **et** hors de `coverage.include` |

Le fichier est **linté et type-checké, jamais testé** : `vitest.config.ts` déclare
`projects: ['packages/*']` et `coverage.include: ['packages/*/src/**']`.

[AGENTS.md §1.6](../../AGENTS.md) y est enfreint sur toute la longueur : 451 lignes de commentaire
en français, **208** jetons en capitales d'emphase (`DÉRIVÉ`, `IDENTIQUE`, `MÊME`, `NE fait PAS`),
des JSDoc à sous-titres `##` et argumentation sur plusieurs paragraphes, et des renvois explicites
à `lot C5`, `lot C6`, `C10`. Chacun de ces points est nommé comme interdit par §1.6.

#### La direction est déjà écrite

- `e1-une-facture-d-une-page-sort-en-pdf.md:545` — « Le client ajoute un composant isolé — **pas
  200 lignes de plus dans `App.tsx`** ».
- `e1-une-facture-d-une-page-sort-en-pdf.md:895` — « extraire proprement l'exemple de facture **du
  monolithe du playground** ».

La position existe donc. Elle n'a simplement pas été appliquée aux 23 sections accumulées depuis.

#### Piste

Découper selon la couture qui existe déjà : `examples/` est le motif en place pour
`reference-invoice.ts`, `catalogue.ts` et `logo.ts`. Les fixtures dans `examples/`, les valeurs
dérivées que chaque section affiche dans `demonstrations/`, un composant par `<h2>` dans
`sections/`, et `App.tsx` réduit à une coquille de mise en page. Faire la passe §1.6 dans le même
commit : les commentaires voyagent avec le code de toute façon.

#### Et le point que AGENTS.md fait sur lui-même

§1.6 n'est outillé par rien — le tableau « ce qui est vérifié par une machine » le classe en revue
humaine. Or ce même document écrit qu'« *une règle non outillée n'est pas une règle* », après un
audit où cinq violations explicites passaient `type-check` en exit code 0. Le correctif durable est
une règle de lint : non-ASCII en commentaire, séquences de capitales, renvois `lot [A-Z]\d`.

**§7 exige un mandat explicite pour toucher `tools/biome/*.grit`.** Ce document ne se l'accorde pas ;
il note que ce mandat vaut d'être demandé.

### CH6 — `core/index.ts` réénumère à la main des façades déjà complètes

326 lignes, 34 blocs d'export, **283 noms** exportés. Confronté module par module à sa source :
**12 des 20 modules sont réexportés à 100 % à l'identique.**

| Module source | Dans l'index | Dans le module | Ce que l'index retient |
| :--- | ---: | ---: | :--- |
| `ast/nodes.js` | 50 | 50 | rien — la liste est redite |
| `data-catalogue/data-catalogue.js` | 32 | 32 | rien |
| `style/style.js` | 20 | 20 | rien |
| `diagnostics/diagnostics.js` | 19 | 19 | rien |
| `presentation/presentation.js` | 15 | 15 | rien |
| `expression/expression.js` | 57 | 67 | **10 noms** — `isIdentifier`, `visitExpression`, `ExpressionVisitor`, `rootSegment`, `aliasSchema`, `IDENTIFIER_*`, `PATH_PATTERN`, `RoundingPositionSchema` |
| `expression/limits.js` | 5 | 9 | **4 noms** — `LIMIT_MIN`, `LIMIT_HARD_CEILING`, `limitSchema`, `resolveLimits` |
| `errors.js` | 19 | 22 | **3 noms** — `markAsProgrammingFault`, `isProgrammingFault`, `prefixPath` |
| `expression/evaluate.js` | 8 | 9 | **1 nom** — `resolvePath` |
| `page/page.js` | 18 | 19 | **1 nom** — `PAGE_SETUP_SCHEMA_SATISFIES_TYPE` |

Les huit modules qui **diffèrent** font un vrai travail : ils dessinent une frontière
public/interne. Mais rien ne distingue une réserve délibérée d'un oubli, et un nouveau symbole
d'AST doit être tapé dans **deux** listes tenues à la main — `ast/nodes.ts`, puis `index.ts`.

Le coût se voit dans le processus : `c8-un-refus-comprehensible.md:15-16` suit le barrel **au
comptage manuel** — « barrel public à **126** valeurs. Après livraison : … barrel à **133** ».
Le relevé de ce jour donne 283.

#### Piste

`export * from './<dossier>/<façade>.js'` pour les 12 identiques ; garder la liste explicite pour
les 8 qui restreignent réellement, chacune avec une ligne de commentaire nommant ce qui est retenu
et pourquoi. Puis **un test qui fige la surface publique**, pour que le décompte des plans devienne
une porte au lieu d'un pointage.

**Le compromis, dit franchement :** `export *` rend la surface implicite, et c'est une perte
réelle. Le test de surface est ce qui la paie. **Sans ce test, ce chantier ne vaut pas d'être
fait** — il échangerait une liste explicite fastidieuse contre une frontière qu'on ne voit plus.
Noter aussi que `c8-…md:78` s'intitule « Aucun compte absolu » : un test de surface doit donc
figer des **noms**, pas un nombre.

### CH7 — Deux modules de 600 lignes contre la règle de modularité de §2

| Fichier | Lignes | Ce qu'il mélange |
| :--- | ---: | :--- |
| `data-catalogue/compatibility.ts` | 616 | 9 interfaces locales · indexation et résolution du catalogue (`indexFields`, `membersOf`, `lookupAlias`, `memberOf`, `rootOf`, `descend`) · le visiteur de lecture et ses diagnostics (`READING_VISITOR`, `read`, `readPath`, `refuseUndeclared`, `suspend`, `bind`, `elementBinding`, `withElement`) · le parcours de nœuds (`SHAPE`, `analyseNode`, `analyseBands`) |
| `document/materialize.ts` | 621 | source de clés · contexte · 3 constantes de message · matérialiseurs par *kind* · corps de table, lignes, cellules · bandes · assemblage du document · `extendBands` |

[AGENTS.md §2](../../AGENTS.md) demande d'isoler les types purs, d'isoler les schémas Zod, de
découper les moteurs de runtime en opérations unitaires sous un dossier dédié, et d'exposer des
façades claires. **Le patron à suivre est déjà dans le dépôt et il est bon :**
`expression/evaluator/` — `context`, `evaluate`, `guards`, `scope`, `index`, plus un fichier par
opération sous `operations/`.

#### Piste

`compatibility/{types,lookup,reading,traverse,index}.ts` et
`materialize/{context,keys,blocks,table,bands,document,index}.ts`.

**Ordonnancement :** faire **CH3** d'abord. Il sort `SHAPE` de `compatibility.ts` et rend ce
découpage nettement plus petit.

### CH8 — Le garde de ré-emballage d'erreur, trois fois dans un fichier

`pipeline/render-pdf.ts` écrit trois fois « si c'est déjà une `DocumentRenderError`, relance telle
quelle, sinon emballe » : l. 59–70 dans `measured`, l. 219–224 autour de `print`, l. 274–279 dans
`openSession`. **Les deux dernières sont identiques au caractère.**

`engine/errors.ts` a déjà `refusal()` et `refusalOf()` ; il lui manque ce combinateur. Un
`preserving(message, code, run)` ramène environ 25 lignes à 8, et donne un seul endroit où la règle
« une cause déjà nommée garde son code » est écrite — règle que le commentaire de la l. 219 énonce
déjà, mais à un seul des trois sites.

---

## 4. Ordonnancement proposé

1. **CH3** — la forme de nœud. Il rétrécit CH7 avant qu'on l'ouvre.
2. **CH1** — le Visiteur de `MaterialBlock`. Le plus gros gain structurel, et il rend de la marge
   sur la porte des branches.
3. **CH4** — les primitives CSS dans `core`. À faire **avant** que V2 démarre, sinon il est à
   refaire, et V3 le découvrira au pire moment.
4. **CH2** — le découpage de `measure.ts`. À faire avant E6 et E7, qui s'appuient dessus.
5. **CH5, CH6, CH7, CH8** — selon la capacité. CH8 tient en une demi-heure ; CH6 ne vaut d'être
   fait qu'avec son test de surface.

Chaque chantier est indépendant des autres à deux exceptions près, et elles sont dans la liste :
CH3 avant CH7, CH4 avant les lots V du viewer.

---

## 5. Ce qui est sain, et qu'il faut dire

Une analyse de dette qui ne liste que des manques donne une image fausse du dépôt.

- **Les quatre portes passent.** `lint` sur 215 fichiers sans correction, `build` 6/6,
  `type-check` 11/11, 1 576 tests sur 55 fichiers.
- **La discipline de typage tient réellement.** Zéro `any`, `!`, `@ts-ignore`, `as unknown as` ou
  `catch` vide. La porte Biome n'est pas décorative.
- **Le sens des dépendances tient.** `core` n'importe aucun frère ; aucun paquet navigateur
  n'importe `engine`.
- **Le Visiteur est correctement bâti là où les documents l'exigeaient** — `ast/visitor.ts`,
  `expression/visitor.ts`, `data-catalogue/visitor.ts`. Le manque de CH1 est dans `engine` seul,
  qui a fait pousser ses propres Composites plus tard.
- **L'évaluateur d'expressions est le modèle** à copier pour CH7 : une opération par fichier,
  façade claire, tests sous `__tests__/`.
- **`vitest.config.ts` porte la mémoire écrite de deux pannes de porte réelles** — les chemins LCOV
  résolus depuis `sonar.projectBaseDir`, et `threshold` écrit au singulier qui avait désactivé la
  porte de couverture en silence avec toutes les portes vertes. C'est exactement
  l'institutionnalisation que §« ce qui est vérifié par une machine » réclame.

---

## 6. Ce que cette analyse ne fait pas

- **Elle ne planifie rien.** Pas de découpage en incréments, pas de plan de test, pas de définition
  de fini. Un chantier retenu mérite son propre plan, au format des autres fichiers de ce dossier.
- **Elle n'accorde aucun mandat §7.** Ni `tsconfig*`, ni `biome.jsonc`, ni `tools/biome/*.grit`, ni
  `.github/workflows/*`, ni `turbo.json`, ni `package.json`. CH5 et CH2 en demanderaient un ; ils le
  disent et s'arrêtent là.
- **Elle ne propose aucune dépendance nouvelle.** Les huit chantiers se font à graphe npm constant.
- **Elle ne touche à aucun contrat de donnée.** Aucun chantier ne change le format stocké, ne
  réserve un nom de champ, ni n'exige un incrément de `schemaVersion`. CH4 déplace des fonctions
  entre paquets sans changer leur signature ; CH3 déplace un type interne.
- **Elle ne juge pas les lots livrés.** Les décisions des ADR 0001 à 0015 sont prises pour acquises,
  y compris celles qui expliquent une duplication constatée ici — la peinture des filets en ombres
  insérées, par exemple, est une correction de l'ADR 0012 et non une piste ouverte.

---

## 7. Hypothèses et limites

1. **Les numéros de ligne périment au premier commit** touchant les fichiers cités. Ils sont donnés
   pour être vérifiés aujourd'hui.
2. **La marge de 0,74 point sur les branches est un instantané.** L'argument de CH1 selon lequel
   collapser sept `default` rend de la marge est arithmétiquement vrai mais non chiffré : le gain
   exact dépend du dénominateur après refactoring, qui n'a pas été simulé.
3. **CH2 suppose que la dérivation est séparable de la collecte.** La lecture de `measure.ts`
   suggère fortement que oui — `contentHeightOf`, `contentBoxOf` et `boundariesOf` opèrent sur des
   rectangles et des styles calculés, pas sur le DOM lui-même — mais la séparation n'a pas été
   écrite, et une dépendance résiduelle à `Range` ou à `getComputedStyle` en cours de dérivation
   changerait le découpage.
4. **CH6 n'a pas été vérifié contre `verbatimModuleSyntax`.** Le passage à `export *` compile en
   principe pour les types comme pour les valeurs ; ce n'est pas mesuré.
5. **La divergence de `familleDePoliceCss` n'a pas été observée dans un navigateur.** Elle est
   établie par lecture des deux implémentations et de la spécification CSS — un littéral entre
   guillemets est toujours un nom de famille, jamais un mot-clé — non par capture d'écran. La
   résolution effective de `"serif"` cité dépend du système de polices, ce qui est en soi le motif
   d'inquiétude pour un projet qui promet le déterminisme.
6. **L'analyse est statique.** Aucun profilage, aucune mesure de performance, aucune revue de
   sécurité. §6 de AGENTS.md (SSRF, `file://`, plafonds) n'est pas couvert ici.
