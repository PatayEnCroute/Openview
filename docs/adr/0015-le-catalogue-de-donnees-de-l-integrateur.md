# ADR 0015 — Le catalogue de données de l'intégrateur

- **Statut :** 🟢 **Accepté** (2026-08-26), implémenté dans `@openview/core`, avec une couture de
  type dans `@openview/designer` et une démonstration dans `apps/playground`
- **Date :** 2026-08-26
- **Impact :** `@openview/core` (un sous-système `data-catalogue/` neuf, un Visitor d'expressions
  qui remplace deux `switch` parallèles, une septième famille de diagnostics),
  `@openview/designer` (la prop `dataCatalogue` cesse d'être opaque), `apps/playground` (le
  catalogue de la facture de référence et la carte de recette), `@openview/engine`,
  `@openview/adapter-puppeteer` et `@openview/viewer` (**intacts**)
- **Ne rompt rien.** `collectDataPaths()`, `collectTemplateDataPaths()`, `pathsOf()`,
  l'évaluateur, `RenderPort`, `RenderRequest` et `RenderResult` sortent du lot **inchangés**,
  valeur et ordre compris. `CURRENT_SCHEMA_VERSION` reste **9**, `TEMPLATE_MIGRATIONS` reste
  identique, et le corpus historique n'est pas touché.
- **Ferme :** [ADR 0001](0001-expression-language.md) **question 3** (le typage des lectures) ;
  [ADR 0002](0002-data-binding-and-loop-scope.md) **les deux questions restées ouvertes** — les
  lectures par élément, et l'alias qui masque une clé racine ;
  [ADR 0003](0003-formules-agregations-et-dates-civiles.md) la reprise de ces deux questions et
  les **deux sites d'alias** que C1 leur avait ajoutés
- **Amende [AGENTS.md §3.B](../../AGENTS.md) sans le réécrire :** l'amendement temporaire de
  l'[ADR 0004](0004-les-arrondis-declares-par-le-modele.md) décision 11 avait pour **seuil de
  retrait l'apparition d'un troisième parcours d'expression**. Ce lot est ce troisième parcours.
  Le Visitor devient donc le patron de l'algèbre, comme §3.B le prescrivait, et l'amendement
  s'éteint de lui-même — il n'a jamais eu besoin d'être supprimé, seulement atteint.
- **N'amende aucune règle de gouvernance.** `AGENTS.md`, `tsconfig*.json`, `biome.jsonc`, les
  plugins GritQL, `turbo.json`, `sonar-project.properties`, les workflows, la configuration
  Vitest et les seuils de couverture sortent du lot **inchangés**. **Aucune dépendance n'est
  ajoutée.**
- **Écart d'ordonnancement, assumé et nommé :**
  [le plan](../plans/c10-le-catalogue-de-donnees-de-l-integrateur.md) posait le lot comme
  « non exécutable avant J3 ». **J3 n'est pas atteint** : E4 n'est pas livré et la relecture par
  un gestionnaire n'a pas eu lieu. Le lot a été exécuté sur demande explicite du propriétaire du
  produit. Ce que le gate protégeait — la table d'attentes du § D9 — a été vérifié autrement, et
  le § [Le gate J3](#le-gate-j3--ce-quil-protégeait-et-ce-qui-a-remplacé-sa-protection) dit
  exactement comment, et ce qui reste dû à E4.
- **Plan d'implémentation :**
  [docs/plans/c10-le-catalogue-de-donnees-de-l-integrateur.md](../plans/c10-le-catalogue-de-donnees-de-l-integrateur.md)
  — **périmé** depuis ce lot. C'est cette ADR qui fait foi, et elle **corrige** son plan sur six
  points nommés au [§ Ce que l'exécution a corrigé du plan](#ce-que-lexécution-a-corrigé-du-plan).
- **Implémentation :**
  [`core/src/expression/visitor.ts`](../../packages/core/src/expression/visitor.ts) (le
  dispatcher unique de l'algèbre),
  [`core/src/expression/evaluator/evaluate.ts`](../../packages/core/src/expression/evaluator/evaluate.ts)
  et [`core/src/expression/paths.ts`](../../packages/core/src/expression/paths.ts) (migrés vers
  lui, sans changement de comportement),
  [`core/src/data-catalogue/`](../../packages/core/src/data-catalogue/) (types, schémas Zod,
  Visitor de type, aplatissement ordonné, attentes, compatibilité, façade),
  [`core/src/diagnostics/types.ts`](../../packages/core/src/diagnostics/types.ts) (la septième
  famille), [`core/src/index.ts`](../../packages/core/src/index.ts) (la surface publique),
  [`designer/src/types.ts`](../../packages/designer/src/types.ts) (la prop typée),
  [`apps/playground/src/examples/data-catalogue.ts`](../../apps/playground/src/examples/data-catalogue.ts)
  et [`App.tsx`](../../apps/playground/src/App.tsx) (la recette visible)

---

## Contexte

Trois ADR successives ont buté sur le même trou, et l'ont écrit chacune à leur tour.

L'[ADR 0001](0001-expression-language.md) a livré `collectDataPaths()` : quels chemins un modèle
lit. Sa question 3 notait qu'il manquait « le type attendu à chaque lecture », et que les deux
réunis permettraient de **confronter un modèle au catalogue de l'hôte avant rendu**.

L'[ADR 0002](0002-data-binding-and-loop-scope.md) en a tiré deux conséquences précises. D'abord,
un alias de boucle peut porter le nom d'une clé racine et la masquer sans qu'aucun signal ne
parte. Ensuite, et c'est la plus coûteuse : `collectDataPaths` **exclut** les chemins enracinés
sur un alias, donc un `line.skuu` mal orthographié n'est signalé par rien. Elle concluait qu'une
seule sortie résoudrait les deux — « chaque lecture associée à la portée dont elle dépend » — et
que `nodeReads` en était déjà la matière première.

L'[ADR 0003](0003-formules-agregations-et-dates-civiles.md) a ajouté `aggregate.as` et
`filter.as`, soit **deux sites d'alias de plus**, sans changer la règle ni combler le trou.

Le lot C10 est cette sortie unique. Il ne réunit pas trois demi-décisions : il en applique une
seule, et les trois dettes en tombent ensemble.

---

## Ce que le lot n'est pas

Le risque principal de C10 est sémantique, pas technique : un catalogue mal cadré fait d'Openview
le **propriétaire de la donnée**, ce qu'[AGENTS.md](../../AGENTS.md) interdit dès sa première
section. Quatre refus délimitent le lot, et ils tiennent en une phrase de test.

> **Le catalogue répond à « qu'est-ce que l'hôte permet de lire ? ». Il ne répond jamais à
> « quelles valeurs ce rendu contient-il ? ».**

**Aucun schéma pour `RenderRequest.data`.** Il n'existe pas, il n'existera pas, et la fonction de
compatibilité **ne prend pas de jeu de données**. Sa signature à deux arguments est épinglée par
un test et par une ablation : lui en ajouter un troisième fait rougir la recette.

**Aucune validation d'une instance.** Confondre « déclaré » et « présent dans ce rendu » casserait
`isEmpty`, la boucle absente et la condition absente — les trois comportements que l'ADR 0001
question 2 a délibérément laissés au `DataBindingStep`, et que C8 a épinglés. `undeclared-data-path`
compare un modèle à une **déclaration** ; il ne dit rien d'une valeur manquante, et il ne réemploie
volontairement aucun code `missing-data`.

**Aucune inférence depuis un exemple.** Une liste vide ne révèle ni type d'élément, ni libellé, ni
champ facultatif. Deviner à partir d'un objet d'exemple serait une réservation de noms déguisée.

**Aucun nom métier en production.** Ni `money`, ni devise, ni décimales, ni `required`, ni valeur
par défaut, ni borne. Un montant est un `number` ; son écriture est déclarée par le modèle (C6) et
produite par le moteur (E4). Un balayage sur `packages/core/src/data-catalogue/` hors tests rend
**zéro** occurrence de douze noms de métier ; les seules occurrences de `currency` et `money` dans
`core` sont celles, antérieures, du contrat de présentation, où elles nomment une **écriture** et
non une clé de donnée.

---

## Le gate J3 : ce qu'il protégeait, et ce qui a remplacé sa protection

Le plan gelait le lot jusqu'à J3, et son § 1.4 disait pourquoi : la table d'attentes du § D9 devait
être « classée d'après le moteur livré, pas d'après une anticipation ». Autrement dit, le gate ne
protégeait pas le contrat du catalogue — il protégeait **une seule ligne** : ce qu'une liaison
visible accepte d'imprimer, et par ricochet ce que `text()` accepte de convertir.

Cette ligne est vérifiable aujourd'hui, parce qu'elle est **déjà livrée** :

- [`engine/src/document/printable.ts`](../../packages/engine/src/document/printable.ts) (lot E1)
  n'imprime qu'une chaîne ou un nombre fini ; l'absence est un refus, tout le reste est un refus ;
- `evaluateText` (lot C1) n'accepte qu'une chaîne ou un nombre fini ;
- `requireText`, `requireDate`, `requireDays`, `requireBoolean` et `evaluateCompare` ferment les
  six autres lignes de la table.

E4 choisit **où** formater — les sites — et **dans quelle écriture**. Il n'élargit pas l'ensemble
des natures imprimables : une date civile est une chaîne avant comme après, et un montant formaté
reste produit à partir d'un nombre. La table D9 est donc reprise **telle quelle**, `text()`
compris, et chacune de ses neuf lignes est adossée à une garde runtime nommée.

**Ce qui reste dû.** Si E4 introduit une déclaration persistée qui change ce qu'un site accepte,
c'est la table de [`expectations.ts`](../../packages/core/src/data-catalogue/expectations.ts) qui
doit bouger — un seul objet, neuf entrées, entièrement couvert par une matrice de tests. Le coût
de l'écart est donc borné et localisé, et c'est la raison pour laquelle l'exécution hors gate
était tenable. Elle ne l'aurait pas été si la table avait été dispersée dans les branches du
visiteur.

---

## Les décisions

### D1 — Le catalogue est un contrat hôte transitoire, jamais une propriété du `Template`

`DataCatalogue` est passé **séparément** au Designer et aux fonctions de compatibilité. Aucun champ
`dataCatalogue`, `schema` ou `variables` n'entre dans `TemplateSchema`.

Quatre conséquences, et la dernière est celle qui compte pour la pérennité :

- deux applications ouvrent le même modèle avec deux catalogues différents ;
- la compatibilité change sans réécrire un seul modèle ;
- `CURRENT_SCHEMA_VERSION` reste **9** et `TEMPLATE_MIGRATIONS` ne bouge pas ;
- un build antérieur ne peut pas **dépouiller** un catalogue puis le sauvegarder, puisqu'Openview
  ne le possède ni ne le persiste. C'est exactement la perte silencieuse que l'ADR 0011 décrit, et
  la seule façon sûre de ne pas l'affronter est de ne rien stocker.

Le contrôle négatif est une assertion de la recette : `CURRENT_SCHEMA_VERSION === 9`. L'ablation
qui l'incrémente fait rougir la recette **et** le corpus de migration.

### D2 — La structure est récursive, et sépare le champ de son type

Un champ porte `key`, `label`, `type`. Le type est une union récursive : quatre feuilles, un objet
portant des champs, ou une liste portant le type de ses éléments.

Un dictionnaire plat `Record<chemin, nature>` a été écarté, et pour une raison qui se démontre :
il ne dit pas si `a.b` traverse un objet ou prétend traverser **chaque élément** d'une liste. Il
obligerait donc à inventer une notation `[]` que `PathExpressionSchema` refuse — c'est-à-dire à
créer une seconde grammaire de chemins pour décrire la première. La liste de listes de la suite
`list.test.ts` n'a aucune écriture plate qui ne soit ambiguë.

### D3 — Quatre feuilles : `string`, `number`, `boolean`, `civil-date`

`civil-date` est **distincte** de `string` bien que sa valeur runtime soit une chaîne. Cette
distinction est ce qui permet de proposer les opérations de date sans laisser croire qu'une
date-heure ou un fuseau serait accepté, et elle réemploie le contrat `YYYY-MM-DD` de l'algèbre.

Elle a un coût assumé, et il est asymétrique : une `civil-date` satisfait `text`, `printable`,
`primitive` et `orderable` — parce qu'à l'exécution c'est une chaîne — mais **seule** une
`civil-date` satisfait l'attente homonyme. Traiter la date comme une chaîne quelconque ferait
passer `dateAdd('nom du client', 30)` : l'ablation 13 le vérifie.

Pas de feuille `null` ni `undefined` : l'absence décrit une **instance**, pas une capacité. Pas de
feuille `money` : la devise et l'arrondi relèvent de l'écriture du modèle.

### D4 — Une clé suit exactement la grammaire des chemins existants

`DataField.key` doit satisfaire `isIdentifier()` — même alphabet, même refus de `__proto__`,
`constructor`, `prototype` et des membres hérités d'`Object.prototype`.

Ce n'est **pas** une réservation de nom métier : c'est la frontière de sécurité et d'adressabilité
déjà publique du langage d'expressions. Le refus vient d'une seule fonction, importée et non
recopiée : une seconde grammaire dériverait de la première au premier ajout.

### D5 — L'ordre du tableau est l'ordre du sélecteur ; le libellé n'est pas un identifiant

`fields` est un **tableau**, jamais un `Record`, et son ordre est contractuel :
`listDataCatalogueEntries()` parcourt en profondeur, parent avant enfants, frères dans l'ordre
déclaré. Trier par clé ou par libellé rendrait au concepteur un ordre qui n'est pas celui que
l'hôte a choisi — l'ablation 4 le fait rougir sur deux suites.

Un libellé est une chaîne non vide, sans espaces de bord, bornée à `MAX_DATA_LABEL_LENGTH = 200`.
**Deux frères peuvent porter le même libellé** : leur chaîne complète de libellés et leur clé les
distinguent, et interdire l'homonymie de libellé imposerait au métier une contrainte qui n'est pas
la sienne. En revanche deux frères ne peuvent jamais porter la même **clé** : ils décriraient deux
types concurrents pour une seule donnée, dont un seul serait lisible.

Le refus de doublon vise le **second** champ, à son chemin exact, et son message ne contient ni
clé ni libellé — deux catalogues fautifs différents rendent la même phrase.

### D6 — Le catalogue peut être vide, et un objet peut n'avoir aucun champ

`{ fields: [] }` est valide : un modèle entièrement statique est un modèle valide. Un objet sans
enfant et une liste d'objets sans champ le sont aussi — `isEmpty`, `count` ou une évolution
ultérieure de l'hôte peuvent encore leur donner un sens. Openview ne refuse pas une structure au
motif que l'interface n'aurait rien à afficher dessous.

### D7 — La compatibilité porte sur les occurrences, jamais sur une liste dédupliquée

`collectTemplateDataPaths()` reste la bonne API pour demander « quelles racines dois-je fournir ? »,
une fois chacune. C10 répond à une autre question et produit **une entrée par occurrence**, avec le
chemin écrit, le chemin structurel retrouvé, les libellés, la nature déclarée, l'attente du site,
la position dans le modèle, le `nodeId`, et un statut parmi `available`, `undeclared`,
`incompatible`, `blocked`.

Deux lectures du même champ dans deux nœuds donnent **deux** entrées : le Designer peut souligner
les deux endroits. Dédupliquer ici perdrait précisément l'information que C10 ajoute — c'est
l'ablation 6.

`compatible` vaut `diagnostics.length === 0`. Les avertissements n'y participent pas.

### D8 — Un vocabulaire d'attentes fermé, et surtout pas un vérificateur de types général

Neuf attentes : `any`, `printable`, `number`, `boolean`, `text`, `civil-date`, `primitive`,
`orderable`, `list`. Elles décrivent ce que le runtime exige **à l'endroit exact où un chemin est
lu**.

La limite est explicite et elle est la raison pour laquelle le lot tient dans un poids fini : C10
ne prouve pas l'algèbre. Il sait que les deux opérandes d'un `gt` doivent être ordonnables ; il ne
cherche pas à résoudre toutes les unions d'un `if` pour démontrer qu'elles ont la même nature. Une
faute sans aucune lecture de catalogue — `add('x', true)` — reste un refus d'évaluation de C8.

C'est ce qui sépare une **vérification de compatibilité entre deux contrats** d'un compilateur
statique parallèle au runtime, qui finirait par mentir sur ce que le moteur fait vraiment.

### D9 — La table d'attentes est dérivée de la sémantique runtime, garde par garde

| Contexte | Attente | Garde runtime qui la fonde |
| :--- | :--- | :--- |
| liaison visible, entrée de `text()` | `printable` | `printableText`, `evaluateText` |
| `loop.each`, `tableRowGroup.each`, source de `aggregate` / `count` / `filter` | `list` | `evaluateSequence` |
| arithmétique, pourcentage, arrondi, valeur agrégée, contribution de report | `number` | `requireNumber` |
| `concat`, `textCase` | `text` | `requireText` |
| `dateAdd.date`, `dateDiff.from` / `.to`, `endOfMonth.date` | `civil-date` | `requireDate` |
| `dateAdd.days` | `number` | `requireDays` |
| condition, filtre, logique, négation | `boolean` | `requireBoolean` |
| `eq` / `neq` | `primitive` | `isPrimitive` |
| `gt` / `gte` / `lt` / `lte` | `orderable` | `evaluateOrdering` |
| `isEmpty` | `any` | `isEmptyValue` |
| branches d'un `if` | héritée du parent | `evaluateIf` ne change pas de position |

Les ensembles acceptés vivent dans **un seul objet**, `expectations.ts`, et une matrice de tests
couvre chaque ligne par au moins un cas accepté et un refusé. La dernière ligne mérite d'être lue
deux fois : sans l'héritage, une branche textuelle sous une addition cesse d'être signalée
(ablation 15).

### D10 — Une liste n'est traversable qu'après liaison de son élément

Avec une liste d'objets déclarée :

- la liste satisfait une attente `list` ;
- un alias lié par cette source reçoit le **type de l'élément** ;
- un membre lu sur l'alias résout ce membre ;
- écrire `liste.membre` en direct est **incompatible** : le langage n'effectue aucun `map`
  implicite, et prétendre le contraire ferait passer une expression que le moteur refuserait.

Une liste de scalaires lie directement son type terminal à l'alias — l'alias seul est alors une
lecture valide. Une liste de listes lie une nouvelle liste, qu'une boucle ou un filtre imbriqué
consomme à son tour.

Le chemin structurel rendu ne fabrique **aucun** segment pour la frontière de liste : les membres
d'un élément apparaissent comme descendants du champ liste, exactement comme dans l'aplatissement.
Une notation `[]` inventée ici serait la seconde grammaire refusée en D2.

### D11 — Une source brisée bloque ses lectures locales, sans cascade

Si la source d'une boucle est absente, ou déclarée mais n'est pas une liste, **elle** produit son
diagnostic — un seul. Les lectures enracinées dans l'alias reçoivent le statut `blocked` et
**aucun** second diagnostic : leur base n'a jamais été établie, et prétendre que leurs clés sont
des racines inconnues serait faux.

Elles restent dans `reads`, pour que le Designer puisse expliquer pourquoi leur vérification est
suspendue plutôt que de les faire disparaître. Corriger la source réactive leur analyse au
prochain appel, qui est pur.

L'ablation 12 — un diagnostic par descendant bloqué — fait rougir la recette : sur le modèle
d'épreuve, une seule cause produirait sept symptômes.

### D12 — Les quatre sites d'alias partagent une pile lexicale, et le plus interne gagne

`LoopNode.as`, `TableRowGroupNode.as`, `AggregateExpression.as` et `FilterExpression.as` sont
traités par la même abstraction interne. La pile est dépilée à la **sortie exacte** de la portée :
un alias de boucle ne vaut que pour les enfants de la boucle, un alias de groupe que pour ses
lignes et ses cellules, un alias d'expression que pour le corps qui le déclare.

Les bandes de page repartent du scope racine. Aucune portée du flux ne fuit vers une bande, ni
d'une bande vers la suivante — c'est une assertion, pas une intention.

Un alias qui masque une racine du catalogue ou un alias actif **ne rend pas le modèle
incompatible** : la sémantique runtime est définie, l'alias gagne. Il produit un `DataScopeWarning`
localisé, émis **une fois à la déclaration** et non une fois par lecture descendante. L'ADR 0002
avait identifié un risque d'intention, pas un état impossible ; rendre le masquage bloquant
refuserait un modèle qui rend correctement (ablation 16).

### D13 — « Non déclaré » n'est jamais « absent au rendu »

Deux codes, sous une source neuve `data-compatibility` :

- `undeclared-data-path` — le catalogue ne décrit pas le segment demandé ;
- `incompatible-data-kind` — le chemin existe, mais sa nature ne satisfait pas l'usage ; il porte
  `expectedKinds` et `actualKind` en champs structurés.

Le chemin de donnée vit dans `dataPath` et **n'est jamais interpolé dans `message`**, exactement
comme `nodeId` et le chemin du modèle depuis l'[ADR 0010](0010-un-refus-comprehensible.md) : c'est
un nom que l'hôte a choisi, et c'est l'hôte qui l'échappe. Deux chemins et deux catalogues
différents rendent la même phrase — l'ablation 17 le vérifie en interpolant.

Aucune valeur de `RenderRequest.data` n'est lue, stockée ni journalisée, pour la raison la plus
simple qui soit : la fonction n'en reçoit pas.

### D14 — Le troisième parcours retire l'amendement temporaire de l'ADR 0004

Avant ce lot, l'algèbre avait **deux** `switch (expression.kind)` exhaustifs : l'évaluation et la
collecte de chemins. L'ADR 0004 décision 11 les avait autorisés à rester des `switch` — au motif,
juste, que `const exhaustive: never` est **strictement plus fort** qu'un Visitor, puisqu'il rend
l'oubli d'un kind impossible à compiler. Elle avait écrit son propre seuil de retrait :
**l'apparition d'un troisième parcours**.

C'est ce lot. `ExpressionVisitor<TResult, TContext>` et `visitExpression()` portent désormais
l'unique `switch`, et l'évaluateur comme `pathsOf()` y ont été migrés **avant** que l'analyse C10
soit écrite. La garantie n'est pas perdue en route : le dispatcher garde son `const exhaustive:
never`, **et** le type du visiteur est un type mappé sur `ExpressionKind` — un kind ajouté à
l'union fait échouer la compilation de chaque visiteur, pas seulement du dispatcher. On gagne le
Visitor sans rien céder de ce que l'amendement protégeait.

La migration était un refactor **comportementalement neutre** : même valeur, même budget, même
`at`, même ordre de parcours, mêmes erreurs. Elle est démontrée par les 1 006 tests de `core`
inchangés, et le contrôle de structure est mécanique — une recherche de `switch (expression.kind)`
dans les sources de production rend **un** site.

### D15 — Le Composite de document réemploie `visitNode()`, avec des descripteurs localisés

L'analyse des nœuds ne crée **aucun** nouveau `switch (node.type)`. Elle passe par `visitNode()` et
porte des descripteurs d'enfants localisés, ce qui produit les chemins exacts : `root`, bandes,
conteneurs, sections de table, groupes, lignes, cellules et segments.

`collectDataPaths()` garde son parcours optimisé et son résultat public : fusionner une analyse
riche avec une API ancienne aurait changé son ordre ou sa déduplication au premier détail.

### D16 — Un Visitor pour le type déclaré, parce qu'il y a trois parcours

Le type déclaré est lui-même un Composite, et trois parcours le traversent : le contrôle de
doublons du schéma, l'aplatissement ordonné, et la résolution de membre de l'analyse. C'est
exactement le symptôme qu'[AGENTS.md §3.B](../../AGENTS.md) décrit — le `switch` dupliqué entre
validation, rendu et collecte — donc `visitDataType()` existe, sur le modèle de `visitNode()` et
de `visitExpression()`.

Trois branches seulement : `scalar`, `object`, `list`. Les quatre natures terminales partagent une
branche **parce qu'aucune n'est traversée** ; ce qui les distingue reste `type.kind`, que chaque
branche reçoit. Une cinquième nature terminale n'appellera donc aucun parcours nouveau, tandis
qu'une septième forme composite fera échouer la compilation au seul site du dispatcher.

C'est le seul fichier que le plan ne prévoyait pas ; voir
[§ Ce que l'exécution a corrigé du plan](#ce-que-lexécution-a-corrigé-du-plan).

### D17 — La façade est fonctionnelle, synchrone, sans Port et sans cache

Le contrat public expose les types et le schéma du catalogue, `listDataCatalogueEntries()`,
`checkTemplateDataCompatibility()`, `acceptedKindsOf()` et les types de lecture, diagnostic,
avertissement et résultat.

Aucun cache global, registre, horloge, locale, réseau ni adaptateur. Un index éphémère est
construit **par appel** — une `Map` par objet indexé à la première utilisation — et meurt avec lui.
Un catalogue de taille identique produit le même ordre de sortie à chaque appel.

**Aucun Port n'est introduit.** La règle anti-sur-ingénierie d'AGENTS.md est nette : on n'introduit
un Port que lorsqu'un second adaptateur existe ou est planifié à trois mois. Il y a un seul
fournisseur de catalogue — la prop de l'hôte — donc il y a une fonction, pas une interface.

Le `ExpressionVisitor` et le `DataTypeVisitor` restent **internes au paquet** : ils sont exportés
par les façades de sous-système, jamais par `index.ts`. Publier un visiteur figerait la forme
interne de l'algèbre dans le versionnement sémantique de l'API.

### D18 — La prop du Designer reste facultative, mais cesse d'être opaque

`OpenviewDesignerProps.dataCatalogue?: DataCatalogue | undefined` remplace
`Record<string, unknown>`. L'absence équivaut **fonctionnellement** à un catalogue vide : le
Designer ne propose aucun champ et ouvre encore un modèle statique. Elle ne signifie jamais
qu'Openview devrait deviner les champs à partir des données.

Le composant Designer n'existant pas, C10 ne parse **aucune** prop React fictive et n'ajoute ni
composant ni hook pour fabriquer de la couverture. La future frontière devra appeler
`DataCatalogueSchema.safeParse()` **une fois à la réception**, jamais à chaque rendu React — le
playground le fait déjà, au chargement de son module, et c'est le modèle à recopier.

### D19 — Aucun versionnement dans le catalogue

Le catalogue n'est pas un document Openview persistant et ne traverse pas la chaîne de migrations.
Son évolution relève du versionnement sémantique de l'API publique. Lui ajouter un `schemaVersion`
aujourd'hui créerait une chaîne de migrations **sans propriétaire de stockage** et sans besoin
observé — c'est-à-dire la cérémonie que l'ADR 0011 a justement rendue obligatoire pour ce qui est
stocké, et inutile pour ce qui ne l'est pas.

---

## Ce que le lot mesure

**`core` : 36 fichiers de test, 1 139 tests, 99,92 % d'instructions, 99 % de branches, 100 % de
fonctions.** Le seuil est 90 % sur les quatre métriques, et il est appliqué par paquet.

Le sous-système `data-catalogue/` est à **100 %** d'instructions, de fonctions et de lignes. Sa
seule branche non couverte était un garde d'index — deux clés sœurs identiques dans un catalogue
que personne n'a parsé — et elle a reçu un test **direct**, qui construit la valeur à la main
plutôt que d'espérer un scénario : le schéma rend le cas inatteignable par la voie normale, donc
seul un test qui le fabrique prouve que la réponse est définie (premier déclaré gagnant) et non un
`last-one-wins` accidentel.

La recette tourne sur **la facture de référence du playground**, pas seulement sur une fixture de
laboratoire : catalogue complet → compatible, **55 lectures localisées, 0 refus** ; catalogue privé
du prix unitaire → **10 refus**, un par occurrence, chacun à sa position, et aucun jeu de données
n'entre dans l'appel.

---

## Les preuves d'ablation

Le plan en listait vingt-deux. Vingt sont mécaniques : un script du bac à sable substitue une
chaîne littérale dans une source, lance les fichiers de test nommés, **exige le rouge**, puis
restaure. Une substitution qui ne matche pas est signalée `PATTERN NOT FOUND` et comptée comme
survivante ; une sortie qui n'est pas une vraie erreur d'assertion est refusée aussi, pour qu'une
erreur de transpilation ne se déguise pas en preuve.

**Vingt sur vingt sont mortes à la première passe, sans retouche des tests.** C'est un résultat
et non une évidence : sur E3, deux mutations sur vingt-deux avaient survécu et révélé deux tests
qui n'assuraient pas ce que leur nom promettait.

| Mutation | Ce qui rougit |
| :--- | :--- |
| accepter deux clés sœurs identiques | le doublon n'est plus refusé au second champ |
| accepter une clé qu'aucun chemin n'adresse | grammaire et pollution de prototype |
| trier les champs par clé | l'ordre du sélecteur diffère de l'ordre hôte, sur deux suites |
| ne pas descendre dans les bandes | en-tête et pied disparaissent des lectures |
| dédupliquer les occurrences | deux nœuds fautifs ne donnent plus deux positions |
| résoudre un alias comme une racine | tout membre d'élément devient non déclaré |
| traverser une liste implicitement | `liste.membre` passe à tort |
| ne pas lier `filter.as` | la lecture du prédicat devient non déclarée |
| ne pas lier `aggregate.as` | la valeur agrégée perd le type d'élément |
| laisser fuir un alias de document | une branche sœur accepte un chemin local impossible |
| laisser fuir un alias d'expression | idem, dans l'algèbre |
| un diagnostic par descendant bloqué | une cause produit sept symptômes |
| traiter `civil-date` comme toute chaîne | une chaîne générique passe dans `dateAdd` |
| ignorer l'attente `list` | une boucle sur un nombre devient compatible |
| ignorer l'attente héritée d'un `if` | une branche textuelle sous une addition n'est plus signalée |
| rendre un masquage bloquant | un modèle à sémantique définie devient incompatible |
| interpoler `dataPath` dans `message` | le message cesse d'être constant |
| prendre un jeu de données en troisième argument | l'arité épinglée par la recette change |
| changer ce que rend `collectTemplateDataPaths()` | la suite historique des chemins |
| incrémenter `CURRENT_SCHEMA_VERSION` | le contrôle négatif et le corpus de migration |

Deux mutations ne sont pas mécaniques, et il faut le dire plutôt que de gonfler le tableau :

- **remplacer la structure récursive par un enregistrement plat** ne se scripte pas — c'est un
  changement de type, pas de ligne. Son contrôle est la liste de listes de `list.test.ts` : aucune
  écriture plate ne la représente sans ambiguïté (D2) ;
- **ajouter un troisième `switch (expression.kind)`** est un contrôle de **structure**, pas
  d'exécution — le plan écrivait d'ailleurs « une recherche », et c'en est une. Elle rend un seul
  site, dans `expression/visitor.ts`.

La mutation « conserver `Record<string, unknown>` au Designer » est vérifiée par la porte 3 : le
type-check rejette un `DataCatalogue` passé à une prop opaque, et un balayage confirme que le
placeholder a disparu de `designer` comme de `viewer`.

---

## Conséquences

**Pour le Designer.** D1 et D4 consomment un contrat réel : une liste ordonnée de libellés
proposables, et une compatibilité qui pointe des positions. D7 aura les attentes par site sans
avoir à réimplémenter l'algèbre. Aucune de ces interfaces n'est livrée ici, et la carte du
playground le dit en toutes lettres pour qu'on ne la prenne pas pour le sélecteur de champs.

**Pour le moteur.** Rien. Il ne connaît pas le catalogue, ne l'exigera pas, et son refus de rendre
un modèle incompatible reste ce qu'il était : un refus d'évaluation, au rendu, sur des valeurs.

**Pour l'algèbre.** Tout ajout d'opérateur doit désormais toucher trois endroits dans le même
mouvement : le type, le visiteur, et la table d'attentes. Les deux premiers sont tenus par le
compilateur. Le troisième ne l'est pas — c'est la dette que ce lot laisse, et elle est écrite au
§ suivant.

**Pour l'intégrateur.** Il peut, dès aujourd'hui, déclarer son vocabulaire et savoir avant tout
rendu si un modèle tient contre lui. Sans fournir une seule valeur.

---

## Ce que l'exécution a corrigé du plan

**1. Le gate J3 n'a pas été respecté.** Le plan l'exigeait ; le lot a été exécuté sans lui, sur
demande explicite. La protection réelle a été remplacée par une vérification garde par garde, et
le § [Le gate J3](#le-gate-j3--ce-quil-protégeait-et-ce-qui-a-remplacé-sa-protection) dit ce qui
reste dû à E4. C'est l'écart le plus lourd du lot, et le seul qui touche l'ordonnancement.

**2. Le numéro d'ADR est 0015, pas 0016.** Le plan prévoyait 0016 « si E4 prend 0015 ». E4 n'étant
pas livré, 0015 était libre.

**3. Un fichier de plus : `data-catalogue/visitor.ts`.** Le § 6.1 du plan listait cinq fichiers de
production et n'en prévoyait pas de visiteur pour le type déclaré. Trois parcours le traversent ;
le § D16 explique pourquoi le `switch` triplé aurait été le défaut nommé par AGENTS.md §3.B, et
pourquoi trois branches ne sont pas de la cérémonie.

**4. Un fichier de plus, encore : `expectations.ts`.** Le plan mettait la table dans
`compatibility.ts`. La sortir isole une donnée pure d'un moteur de parcours, comme AGENTS.md §2 le
demande, et surtout : c'est **le seul fichier qu'E4 pourra avoir à corriger**. Un objet de neuf
entrées se relit ; le même contenu dispersé dans dix-neuf branches ne se relit pas.

**5. `ExpressionVisitor` est un type mappé, pas une interface écrite à la main.** Le plan décrivait
une interface. Un type mappé sur `ExpressionKind` est **exhaustif par construction** : un kind
ajouté à l'union casse chaque visiteur, pas seulement le dispatcher. C'est une garantie de plus
pour dix-neuf lignes de moins.

**6. Le contrôle « pas de troisième `switch` » n'est pas un test.** Le plan le rangeait au § 7.3
parmi les tests. `packages/core` déclare `types: []` — aucun typage Node — donc un test qui lirait
les sources n'y compile pas, et élargir ce `tsconfig` serait le desserrage qu'AGENTS.md §7
interdit. Le plan écrivait « une recherche » : c'en est une, elle est jouée, et son résultat est
consigné plus haut. Le balayage des noms métier, au § 7.8, est traité de la même façon et pour la
même raison.

---

## Ce qui reste ouvert

**La table d'attentes doit être relue contre E4.** C'est la conséquence directe de l'écart n° 1.
Neuf entrées, un fichier, une matrice de tests : le jour où E4 livre, il faut rejouer la lecture,
pas la deviner.

**Rien ne tient la table d'attentes au compilateur.** Un opérateur ajouté à l'algèbre casse la
compilation du visiteur — donc on n'oublie pas de le *parcourir* — mais rien n'oblige à lui donner
une attente juste : écrire `'any'` compile. C'est la seule garantie que ce lot n'a pas su rendre
mécanique, et le remède, s'il en faut un, est une matrice qui énumère les kinds plutôt que les
attentes.

**La politique de la valeur absente à l'impression** — question 2 de l'ADR 0001 — reste au
`DataBindingStep`. C10 la respecte scrupuleusement : il parle de déclarations, jamais d'instances.

**La profondeur d'un catalogue reçu au runtime n'a pas de garde de forme.** Le schéma récursif
partage ce risque avec l'AST. La première frontière réelle sera le composant Designer, qui devra
appliquer un garde avant `safeParse` ; C10 ne généralise pas `TemplateShapeError` à une charge
utile qui n'est pas un template sans mandat.

**La présentation des avertissements de masquage appartient au Designer.** Ils sont émis une fois
à la déclaration et n'affectent pas `compatible`. Les supprimer exigerait de rouvrir explicitement
la dette de l'ADR 0002.
