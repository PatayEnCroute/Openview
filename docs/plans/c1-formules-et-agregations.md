# Plan d'implémentation — `@openview/core` lot C1 : formules et agrégations

> **Document d'implémentation.** Il dit *comment* livrer un lot : découpage, fichiers
> touchés, tests, ordre des commits. Il ne dit ni *quoi* ni *pourquoi* — cela vit dans
> [docs/roadmap/](../roadmap/README.md) — ni les *décisions* structurantes, qui se
> consignent dans [docs/adr/](../adr/). Il est **périssable** : une fois le lot livré,
> ce qui compte est passé dans l'ADR, dans le code et dans ses tests, et ce fichier
> n'est plus qu'une trace.
>
> **Statut :** ✅ **prêt à exécuter.** Les cinq arbitrages ouverts ont été tranchés par
> le propriétaire du produit le 2026-08-13 — relevé en [§8](#8-les-cinq-arbitrages-tranchés).
> **Date :** 2026-08-13 · **Brique :** `@openview/core`, vague 1 · **Jalon visé :** J1
>
> **Révision du 2026-08-13 (revue de cohérence).** Cinq défauts bloquants corrigés, chacun
> à l'endroit où il se lisait : le **versionnement** n'était attribué à aucun incrément —
> il en a un désormais, [INC-8bis](#inc-8bis--lestampille-de-schéma--s), et les commits
> intermédiaires sont déclarés non publiables ; le **budget** n'avait pas d'API pour
> `maxStringLength` et levait sans pouvoir remplir `site`/`at` — il rend des booléens et
> `fail()` reste l'unique site de levée ; la **charge d'erreur** exigeait un `actualType`
> des codes de borne, qui n'ont pas de valeur fautive — c'est une union discriminée, et le
> mécanisme de préfixage de `at` est écrit au lieu d'être supposé ; le **bornage** laissait
> `ShapeLimits` non validé, le garde aveugle après migration et la pile d'évaluation
> ouverte — les trois sont fermés ; l'**outillage d'environnement** laissait passer
> `Intl.DateTimeFormat('fr-FR')` et `new Date(2026, 0, 1)`, deux lectures du **fuseau
> hôte** — vérifié sur Biome 2.5.8, corrigé, et les artefacts de
> [INC-3](#inc-3--les-trois-garde-fous--m-arbitrages-n°1-et-n°5-tranchés-a) sont ceux qui
> ont été exécutés. Aucune décision de la [§8](#8-les-cinq-arbitrages-tranchés) n'est
> rouverte : ce sont des corrections de **moyens**, pas de fond.

---

## 0. Le cadre : Openview est un moteur d'édition

Tout ce qui suit en découle, et une version antérieure de ce plan s'en est écartée.

**Openview est un éditeur visuel de modèles et un moteur de rendu, embarqués dans
l'application d'un tiers.** Ce n'est ni un logiciel de gestion, ni un moteur de
facturation, ni une source de données. **L'application intégratrice décide entièrement de
ce que contient le document** : elle possède ses données et leurs noms, elle déclare son
catalogue, elle fournit le jeu de données. Openview met en page et exécute les formules
du modèle — fidèlement, sans rien juger et sans rien réclamer.

**La facture est le document de référence, pas le périmètre.** Elle est choisie parce
qu'elle concentre les contraintes les plus dures — multi-pages comptable, totaux
reportés, blocs insécables, deux langues, deux devises — et que **ce qui rend une facture
possible rend possibles toutes les autres éditions** : rapports, relevés, bons de
livraison, contrats, étiquettes, courriers, bordereaux. Quand un critère de recette de ce
plan parle de facture, c'est un **jeu d'épreuve**, jamais une définition du produit.

> **La règle qui coupe la dérive :** Openview **ne réserve aucun nom de donnée**, n'en
> attend aucun, n'en documente aucun comme obligatoire. Toute proposition qui conduirait
> le contrat à connaître une donnée métier — un champ réservé, une convention de nommage,
> une structure attendue — est à refuser, quelle que soit sa commodité apparente.

Ce cadre n'est plus seulement dans ce document : il vit dans le dépôt depuis le
repositionnement du 2026-08-13, dans la section **« Ce qu'Openview n'est pas »**
d'[AGENTS.md](../../AGENTS.md), dans le [README](../../README.md), dans
[ARCHITECTURE.md](../../ARCHITECTURE.md) et en tête de la
[roadmap](../roadmap/README.md). Ce plan en découle et ne le rediscute pas.

---

## 1. Pourquoi C1, et pourquoi maintenant

La roadmap ne laisse pas le choix. [`docs/roadmap/README.md`](../roadmap/README.md)
décision 4 impose l'ordre « brique par brique : core → engine → viewer → service →
designer », et décision 3 « un seul chantier ouvert à la fois ».
[`docs/roadmap/core.md`](../roadmap/core.md) ouvre la vague 1 par **C1 — Formules et
agrégations**, poids L, **dépend de rien**, et le désigne comme *« le lot le plus lourd
du contrat »*. C2 (arrondis), C3 (tableau) et C8 (refus compréhensible) en dépendent
tous ; E1 (première facture PDF) dépend de la vague 1 entière.

**L'écart est réel et il est central.** L'algèbre actuelle
([`expression.ts`](../../packages/core/src/expression/expression.ts)) sait *comparer*, pas
*calculer* : `literal`, `path`, `compare`, `logical`, `not`, `isEmpty`. Un modèle ne
peut pas dire « total = somme des lignes », ni « échéance = date + 30 jours ». La
fonction n°1 d'une facture n'est pas exprimable.

**Deux verrous à lever avant la première ligne de code :**

| Verrou | Où | Ce qu'il impose |
| :--- | :--- | :--- |
| L'ADR 0001 interdit **explicitement** l'arithmétique et l'appel de fonction (§« Décision retenue », « Rien d'autre ») | [`docs/adr/0001`](../adr/0001-expression-language.md) | Une ADR 0003 doit l'amender **avant** le code, sinon la décision écrite et le code divergent au premier commit — ce que `core.md` signale nommément comme le risque de ce lot |
| La **décision ouverte n°5** (« jusqu'où vont les calculs de dates ? ») est déclarée **bloquante pour C1** | [`docs/roadmap/README.md`](../roadmap/README.md) §8 | Le bornage doit être tranché par écrit avant d'écrire la première fonction de date. Une moitié l'est déjà : le §8 porte depuis le 2026-08-13 la mention « ce qui est déjà tranché, et ne se rouvre pas — l'algèbre n'a pas d'horloge ». Reste à borner **quelles opérations** de date entrent : c'est [D5](#d5--dates--bornage--date-civile-pure--décision-ouverte-n°5-tranchée) |

**Argument contraire, examiné et écarté.** C4 (la page) ne dépend de rien non plus et
pèse M au lieu de L : commencer par lui donnerait un lot court. Mais C4 ne débloque
aucun lot en aval, alors que C1 débloque C2 — que la roadmap classe *« jamais reporté »*
— et alimente C3, C8, E1 et D7. Reporter C1 revient à reporter tout ce qui compte, et à
concevoir la page avant de savoir ce qu'elle contiendra.

---

## 2. Ce qui est décidé, et ce que ça engage

Neuf décisions. Chacune est irréversible au sens où la renverser après le premier
template client coûterait une migration ; chacune doit donc figurer dans l'ADR 0003.

### D1 — L'algèbre reste **close et structurée**, elle passe de 6 à 18 kinds

Pas de parseur, pas de `{ fn, args }` générique, pas de fonctions définies par
l'utilisateur, pas de référence par nom. L'arbre reste **fini et terminant par
construction**.

Trois ensembles nommés :

| Ensemble | Membres | Rôle |
| :--- | :--- | :--- |
| `PrintableExpression` (13) | `literal`, `path`, `arithmetic`, `percentOf`, `aggregate`, `count`, `if`, `concat`, `text`, `textCase`, `dateAdd`, `dateDiff`, `endOfMonth` | Ce qu'une liaison de texte accepte |
| `PredicateExpression` (4) | `compare`, `logical`, `not`, `isEmpty` | Valeur booléenne, refusée à l'impression |
| `FilterExpression` (1) | `filter` | Valeur de liste, refusée à l'impression |

> **Le refus central du lot :** aucun `{ kind: 'call'; fn: string; args: Expression[] }`.
> Un espace de noms générique se remplit et ne se vide jamais ; il exige une table
> d'arité maintenue à côté du schéma (deux sources libres de diverger) ; il force une
> garde sur `args[0]`/`args[1]` à chaque évaluation puisque `noUncheckedIndexedAccess`
> est actif et que `!` est bloquant ; il dégrade le message Zod de « champ `days`
> manquant » à « 2 éléments attendus, 1 reçu », ce qui rate frontalement l'exigence de
> C8 ; et il rouvre la place où `tva()` finira par s'écrire. **Champs nommés partout.**

**`text(value)` — la mise en chaîne est explicite, jamais implicite** *(arbitrage n°2,
tranché A)*. `concat` refuse un nombre, comme toute l'algèbre refuse la coercion depuis
l'ADR 0001. Mais le cas canonique — coller un libellé à un numéro que l'intégrateur
livre en nombre — doit rester écrivable : `concat('N° ', text(cmd.numero))`. Un kind
d'un seul champ, qui rend visible **dans l'arbre** l'endroit exact où une valeur devient
du texte. Sans lui, la famille « Textes » serait inutilisable dès que la donnée est
numérique ; avec une mise en chaîne implicite, on aurait un `+` qui additionne ou
concatène selon la donnée — ininterprétable dans une barre de formule.

> ⚠️ **`text()` produit une chaîne, pas un affichage.** Il rend la forme canonique —
> `String(valeur)` pour un nombre fini, la chaîne inchangée pour une chaîne — sans
> séparateur de milliers, sans symbole monétaire, sans locale. **Le formatage appartient
> à C6** ; l'écrire ici serait une position de format *de fait*, même erreur que
> l'arrondi implicite refusé en D4. Un booléen, une liste et un objet sont **refusés** :
> `text(true)` imprimerait `true` dans un document, exactement ce que la position
> d'impression interdit depuis l'ADR 0002. Une valeur absente propage l'absence, comme
> partout ailleurs (D6).

### D2 — Aucune **position** rétrécie ; trois **valeurs** bornées, et il faut le dire

`compare.left/right`, `logical.operands`, `not.operand`, `isEmpty.operand`,
`LoopNode.each` et `ConditionNode.when` gardent tous le type `Expression`. Aucune
position du contrat n'accepte moins qu'avant.

`TextBindingSegment.value` passe de `LiteralExpression | PathExpression` à
`PrintableExpression` : c'est un **élargissement**, pas une ouverture. Les prédicats et
les listes restent refusés **au parsing**.

> ⚠️ **Une version antérieure de ce plan écrivait « aucun document auparavant valide ne
> devient invalide ». C'est faux, et c'est mesuré.** Sur le code actuel, non modifié : un
> chemin de 591 caractères parse, une chaîne de 100 `not` parse, un arbre de 101
> conteneurs parse. Trois bornes introduites par la revue de sûreté les refusent
> désormais :
>
> | Borne | Où | Ce qu'elle refuse maintenant |
> | :--- | :--- | :--- |
> | `.max(256)` sur un chemin | [§3.1](#31-packagescoresrcexpressionexpressionts) | un chemin de plus de 256 caractères, **au parsing** |
> | `maxDepth = 64` | [D8](#d8--le-bornage--ce-que-c1-doit-rendre-possible-pour-e8) | une imbrication de plus de 64 niveaux **JSON**, au parsing |
> | `maxSteps` par défaut | [D8](#d8--le-bornage--ce-que-c1-doit-rendre-possible-pour-e8) | un `logical` à 1,5 M d'opérandes, **au rendu** — donc sur un document qui reste *parse-valide*. Celui-là ne se voit pas à l'ouverture |
>
> La distinction est exactement celle qui compte : **C1 est additif en FORME, restrictif
> en VALEURS.** Le premier fait autorise l'élargissement des unions sans transformation ;
> le second interdit de prétendre que rien ne change pour les documents existants. C'est
> la raison pour laquelle [D9](#d9--schemaversion-passe-à-2-avec-une-migration-identité)
> a été renversée.
>
> Les trois bornes ne sont pas rattrapables par une migration — tronquer un chemin ou
> aplatir un arbre corromprait le document. Elles reposent donc, et elles seules, sur
> l'hypothèse **pré-v1.0** vérifiée en [§9](#9-ce-que-ce-plan-tient-pour-acquis) : aucun
> tag git, aucun workflow de publication, `packages/core` en `0.1.0`.

> ⚠️ **Correction d'un raisonnement faux à ne pas recopier dans l'ADR.** L'argument
> « un `if` à branches booléennes n'est pas représentable, donc rien de booléen n'entre
> en position d'impression » est **factuellement faux** : `LiteralValue` inclut
> `boolean` ([`expression.ts:19,69`](../../packages/core/src/expression/expression.ts)), donc
> `{ kind:'binding', value:{ kind:'literal', value:true } }` **parse déjà aujourd'hui**.
> La garantie réelle, à énoncer sous cette forme : *une position d'impression refuse les
> **opérateurs** à valeur booléenne et à valeur de liste ; elle n'a jamais interdit un
> **booléen littéral**, et ne le peut pas sans retirer `boolean` de `LiteralValue` — ce
> qui serait un rétrécissement.* Un test doit épingler le comportement réel, sinon la
> prochaine lecture du docstring recommencera l'erreur.

### D3 — Les agrégations : **trois champs nommés**, et la machinerie de l'ADR 0002 telle quelle

```jsonc
{ "kind": "aggregate", "op": "sum",
  "source": { "kind": "path", "path": "invoice.lines" },
  "as": "line",
  "value": { "kind": "path", "path": "line.total" } }
```

C'est **exactement la forme d'un `LoopNode`** (`each`/`as`/`children`) : le Designer
réutilisera le widget de boucle, et l'exigence D7 « comprendre **où** s'applique la
formule » est satisfaite parce que la portée est explicite et affichable.

**L'évaluation réutilise `evaluateSequence` et `childScope` sans les modifier.** C'est
le résultat le plus important du lot : la machinerie livrée par l'ADR 0002 est
exactement ce dont le lot le plus lourd du contrat avait besoin. Aucun second primitif
de portée, aucun nom réservé, **aucun *mécanisme* de masquage nouveau**.

> ⚠️ **La formule exacte est « aucun mécanisme nouveau », pas « aucun masquage
> nouveau ».** `aggregate.as` et `filter.as` sont **deux nouveaux sites** où un alias
> peut masquer une clé de l'appelant — `sum(invoice.lines, invoice, invoice.total)` est
> écrivable, et [INC-6](#inc-6--agrégations-filtre-et-compte--l) le documente comme la
> *troisième* limite de `collectDataPaths`. Ce qui ne change pas, c'est la **règle de
> résolution** : `childScope` la porte déjà pour `LoopNode.as`, à l'identique. Écrire
> « aucun masquage nouveau » ferait exactement ce que l'ADR 0002 reproche à l'ancienne
> docstring de `collectDataPaths` : *elle promet, elle ment*.

**`filter` plutôt qu'un `where?` optionnel.** Un `where?` entraîne un `as?` couplé (un
`count` sans `where` n'a pas besoin d'alias, avec `where` si) : optionalité
conditionnelle à deux étages sous `exactOptionalPropertyTypes`, et un message Zod
« requis sauf si… » que C8 ne peut pas rendre lisible. La composition remplace
l'optionalité — **tous les champs restent requis partout**. Bénéfice non facturé :
`LoopNode.each` étant déjà typé `Expression`, « ne répéter que les lignes non annulées »
devient exprimable **sans toucher au nœud boucle**.

`count` est un kind distinct à un seul champ, pas un opérateur d'agrégat : « nombre de
lignes remisées » s'écrit `count(filter(…))`, et `AGGREGATE_OPERATORS` retombe à
`sum/avg/min/max`, homogènes en type de retour.

### D4 — **IEEE-754 binary64**, le `number` de la plateforme. Aucune dépendance ajoutée.

Trois faits qu'il faut tenir **séparés** — les confondre est le piège du lot :

1. **Déterminisme (E6) : acquis.** Les quatre opérations sont *correctement arrondies*
   par la norme et leur résultat est imposé par ECMA-262 : `a + b` produit le même bit
   sur deux machines. Corollaire : `Math.pow`, `Math.sqrt` et les transcendantes ne sont
   **pas** obligées d'être correctement arrondies — aucune n'est au périmètre, et c'est
   une raison de plus de ne pas les y mettre.
2. **Exactitude décimale : non acquise, et ce n'est pas le problème de C1.** Le critère
   de fin de C2 (« aucun total ne diffère de la somme des montants affichés au-dessus »)
   est une propriété d'**arrondi déclaré et ordonné**, pas de représentation.
   **Déclarer E6 satisfait puis découvrir l'écart d'un centime en C2 est exactement
   l'erreur à ne pas commettre**, et elle vient de cette confusion.
3. **Une bibliothèque décimale n'est pas justifiable ici.** `decimal.js`/`big.js`
   élargiraient la surface supply-chain d'un projet public dont `core` n'a qu'**une**
   dépendance (AGENTS.md §7) ; des entiers de centimes préempteraient C2 **et** C6 en
   inscrivant une échelle monétaire dans le contrat. Et la décision reste **réversible** :
   changer de représentation plus tard ne touche ni les kinds, ni les schémas, ni un
   seul modèle stocké — seulement le corps de trois fonctions.

**Aucun arrondi implicite, nulle part** — en particulier pas sur `div` ni sur
`percentOf`. Un arrondi par défaut serait une position d'arrondi **de fait**, donc une
règle, donc une violation de la décision 16 et de la clause du README.

**La couture laissée à C2**, à écrire dès maintenant pour qu'elle ne se fasse pas
ailleurs : un **kind enveloppe** `{ kind:'round'; value; decimals; mode }`, purement
additif, composable, **visible dans l'arbre** — et non un champ `precision?` sur chaque
nœud de calcul, qui ferait porter à chaque intermédiaire un champ que personne ne
remplit.

### D5 — Dates : bornage **« date civile pure »** (décision ouverte n°5, tranchée)

**Le critère d'admissibilité, écrit avant la liste** pour que la prochaine demande se
tranche sans rouvrir le débat. Une opération de date entre dans C1 **si et seulement
si** :

1. son résultat est une fonction pure de ses arguments explicites — **aucune convention
   à choisir, aucune table de règles embarquée** ;
2. elle ne lit **rien** de l'environnement — ni horloge, ni fuseau, ni locale, ni ICU.

Une date est une chaîne **`YYYY-MM-DD`**, grégorien proleptique, sans heure ni fuseau,
bornée `0001-01-01 … 9999-12-31`.

| Kind | Couvre | Convention à choisir ? |
| :--- | :--- | :--- |
| `dateAdd(date, days)` | « échéance = date de facture + 30 jours » | aucune |
| `dateDiff(from, to)` → jours | « nombre de jours entre deux dates fournies » — le retard, par exemple, entre l'échéance et une date de traitement transmise par l'hôte | aucune |
| `endOfMonth(date)` | « 45 jours fin de mois » = `endOfMonth(dateAdd(d, 45))` | aucune |

**Exclus par écrit, avec le critère qui les élimine :**

- **`addMonths`/`addYears`** — « 31 janvier + 1 mois » est une **convention** (28 ? 29 ?
  3 mars ?). Échoue au critère 1. C'est la porte d'entrée du nid à cas particuliers, et
  `endOfMonth` couvre le besoin réel sans jamais l'ouvrir. **La distinction est le cœur
  de la borne.**
- **Jours ouvrés, fériés, calendriers nationaux** — un calendrier de fériés est une
  **donnée de l'intégrateur** : il se périme et change par pays. Échoue au critère 1. Si
  le besoin arrive, l'extension est `addBusinessDays(date, days, holidays)` avec les
  fériés **en argument**, jamais une table interne — et le piège à traiter en C8 est
  « liste absente = résultat faux en silence », donc **refus explicite** plutôt que
  valeur par défaut.
- **Heures, fuseaux, `today()`** — échouent au critère 2. **C'est le point le plus
  important de toute la décision :** sans lui, E6 est *mathématiquement* impossible et
  le lot de factures de référence E7 devient instable.

> **« Aujourd'hui » n'existe pas dans l'algèbre, et il n'y a rien à réserver pour
> autant.** « Nombre de jours de retard » s'écrit `dateDiff(cmd.echeance, X)` où `X` est
> **une donnée que l'intégrateur fournit sous le nom qu'il veut**, au même titre que le
> total ou le numéro. Openview ne réserve aucun nom de champ, n'en attend aucun, n'en
> documente aucun comme obligatoire : **le contrat de données appartient entièrement à
> l'application hôte** (voir [§0](#0-le-cadre--openview-est-un-moteur-dédition)). La seule
> règle qui subsiste est technique : **le moteur ne lit pas l'horloge**, sinon deux
> exécutions ne peuvent pas produire le même document (E6).

**`YYYY-MM-DD` est une représentation d'ÉCHANGE, pas un format d'affichage.** Comme
`TextBindingSegment.value` accepte désormais `dateAdd`, un modèle imprimerait cette
chaîne telle quelle : jusqu'à C6, le playground puis le moteur afficheraient de l'ISO
dans une facture française. C6 possède l'affichage ; la conversion se fera au même
endroit que la mise en chaîne des nombres (question 2 de l'ADR 0001, donc
`DataBindingStep`). À écrire dans l'ADR, et le playground doit étiqueter les dates
comme valeurs brutes, exactement comme `rawSegments` le fait aujourd'hui.

### D6 — Les cinq politiques d'erreur que le dépôt ne tranchait nulle part

Chacune s'aligne sur la règle déjà écrite dans `evaluate.ts` : *l'absence n'interrompt
pas le document, un type présent mais faux si*.

| Situation | Décision | Pourquoi |
| :--- | :--- | :--- |
| Donnée absente, opération scalaire | **propage `undefined`** | Choisir `0` serait `core` décidant à la place de `DataBindingStep` la question laissée ouverte par l'ADR 0001 Q2 — et `0` est juste pour une somme, faux pour une division |
| Opérande **présente**, mauvais type (`1 * '2'`) | **lève** `operand-type` | Aucune coercion : la règle de l'ADR 0001 est **étendue**, pas érodée |
| Opérande présente et **non finie** (NaN venu de la donnée) | **lève** `not-finite` | `Number.isFinite`, pas `typeof === 'number'` : un NaN traverserait sinon trois niveaux de formule jusque dans une facture. Scellé **en amont** |
| Division par zéro (diviseur **présent** valant 0) | **lève** | Ce n'est pas une donnée manquante, c'est une **formule fausse**. Jamais `Infinity`, jamais `NaN` |
| Agrégat/filtre/boucle sur une **non-liste** | **lève** ; sur liste **vide** : `sum` → 0, `count` → 0, `avg`/`min`/`max` → absence | Une liste vide n'est pas une faute |

> ⚠️ **Correction : « `avg` évite la division par zéro par construction » était faux.**
> Ce n'est vrai que pour la liste *vide*. Une liste de 60 lignes dont **aucune** ne porte
> de remise donne **zéro valeur présente** — donc `0/0`. La règle exacte est : **absence
> dès que le nombre de valeurs présentes est nul**, quelle que soit la longueur de la
> liste.

> ⚠️ **Une seule règle pour le non-fini, en scalaire comme en agrégat.** Une version
> antérieure de ce plan levait `operand-type` sur un NaN scalaire et `not-finite` sur un
> NaN d'élément d'agrégat : deux codes pour une seule situation, et C8 aurait dû écrire
> deux messages pour la même faute. La règle est désormais unique et se dit en une
> phrase :
>
> > **`operand-type` répond de la *forme* d'une valeur ; `not-finite` répond de sa
> > *finitude*.** Une chaîne, un booléen, une liste, un objet → `operand-type`, partout.
> > `NaN`, `Infinity`, `-Infinity` → `not-finite`, partout, **à l'entrée comme à la
> > sortie**.
>
> Elle est cohérente avec le reste du lot : `ExpressionValueType` porte déjà `not-finite`
> comme **tag distinct** de `number` — c'est même le seul changement de vocabulaire de
> `describe()` que [D7](#d7--la-charge-derreur--trois-champs-une-seule-taxonomie-aucune-donnée-dans-le-message)
> assume. Rendre `operand-type` sur une valeur dont le tag est `not-finite` ferait dire à
> la charge d'erreur le contraire de ce que dit son propre `actualType`.

**Quatre précisions de sémantique d'agrégat, qu'aucune version antérieure n'écrivait.**
`Number.isFinite` n'apparaissait qu'en position *scalaire* :

- `sum`/`avg`/`min`/`max` travaillent sur des nombres **finis**. Une valeur d'élément
  présente et non finie → `not-finite` à `['value', i]`.
- Un **débordement d'accumulation** (60 000 lignes à 1e307) → `not-finite` à la sortie,
  jamais un `Infinity` imprimé dans un document.
- `min`/`max` sont **numériques**. Les laisser ordonner des chaînes rendrait l'ordre
  lexicographique sur les dates, ce que `civil-date.ts` existe précisément pour rendre
  inatteignable.
- **L'ordre d'accumulation fait partie du contrat** : positionnel, jamais réordonné.
  L'addition binary64 n'étant **pas associative**, la promesse « le même bit sur deux
  machines » de [D4](#d4--ieee-754-binary64-le-number-de-la-plateforme-aucune-dépendance-ajoutée)
  ne tient pour une somme *que* si rien ne réordonne. C'est une propriété à épingler par
  un test, pas un détail d'implémentation.

**En agrégation, la politique diffère et c'est assumé :** un élément dont la valeur est
absente est **ignoré**, `avg` divise par le nombre de valeurs **présentes**. En scalaire
l'auteur a nommé deux opérandes et l'absence de l'un dit que la prémisse n'est pas
remplie ; en agrégation il a nommé **une** expression appliquée à N éléments — faire
tomber la somme de 60 lignes parce qu'une ligne n'a pas de remise serait le maximum de
surprise.

**Corollaire à assumer :** `total - remise` avec une remise absente rend `undefined`,
pas `total`. C'est honnête, et **c'est exactement ce qui fait gagner sa place au kind
`if`** : l'auteur écrit `sub(total, if(isEmpty(remise), 0, remise))`. La politique de
repli appartient à l'auteur du modèle, jamais à un repli deviné par l'évaluateur.

### D7 — La charge d'erreur : trois champs, **une seule** taxonomie, **aucune donnée dans le message**

```ts
/** Codes d'OPÉRANDE : il existe une valeur fautive, donc une FORME à nommer. */
export const OPERAND_ERROR_CODES = [
  'operand-type', 'division-by-zero', 'not-finite',
  'not-a-list', 'not-a-boolean', 'not-comparable', 'not-orderable', 'not-a-date',
] as const;

/**
 * Codes de BORNE : aucune valeur fautive, mais un plafond à nommer. Quatre, et pas un
 * fourre-tout : un « limit-exceeded » unique est inactionnable pour C8, qui doit dire
 * QUOI réduire — le nombre d'opérations, la taille des listes, la longueur d'un texte
 * ou la profondeur de la formule.
 */
export const LIMIT_ERROR_CODES = [
  'step-limit-exceeded', 'item-limit-exceeded',
  'string-limit-exceeded', 'depth-limit-exceeded',
] as const;

/** C8 énumère CELUI-CI. La partition reste une union, jamais deux catalogues rivaux. */
export const EXPRESSION_ERROR_CODES = [...OPERAND_ERROR_CODES, ...LIMIT_ERROR_CODES] as const;
export type ExpressionErrorCode = (typeof EXPRESSION_ERROR_CODES)[number];

/**
 * Où l'erreur s'est produite. `ExpressionKind` ne suffit pas : `LoopNode.each` et
 * `ConditionNode.when` portent une expression sans être des expressions.
 */
export type ExpressionErrorSite = ExpressionKind | 'loop' | 'condition';

/** Ce que TOUTE erreur porte, quelle que soit sa branche. */
interface ExpressionErrorLocation {
  /** Typé, pas `string` : une faute de frappe dans un `fail()` doit casser la compilation. */
  readonly site: ExpressionErrorSite;
  /** Chemin depuis la RACINE de l'expression : ['value', 3, 'right']. */
  readonly at: readonly (string | number)[];
}

export type ExpressionErrorDetails =
  | (ExpressionErrorLocation & {
      readonly code: (typeof OPERAND_ERROR_CODES)[number];
      /** La FORME de la valeur fautive, jamais la valeur. Liste fermée. */
      readonly actualType: ExpressionValueType;
    })
  | (ExpressionErrorLocation & {
      readonly code: (typeof LIMIT_ERROR_CODES)[number];
      /** Le plafond atteint — un CHIFFRE DE CONFIGURATION, jamais une donnée de rendu. */
      readonly limit: number;
    });
```

Un tableau `as const`, parce que C8 doit pouvoir **énumérer** les codes et qu'un type nu
ne s'énumère pas. `not-orderable` est conservé distinct de `not-comparable` : le dépôt
distingue déjà « cannot compare » de « cannot order », les fusionner perdrait une
distinction écrite.

> ⚠️ **Une union discriminée, pas quatre champs requis — et c'est une correction.** Une
> version antérieure de ce plan rendait `actualType` **obligatoire pour tous les codes**.
> Un dépassement du nombre de pas n'a aucune « valeur fautive » : l'implémenteur n'aurait
> eu que trois issues, toutes mauvaises — inventer un `ExpressionValueType` menteur (le
> tag de la dernière valeur vue), ajouter une dixième constante `'none'` qui polluerait
> `describe()`, ou rendre le champ optionnel, ce que `exactOptionalPropertyTypes` et la
> doctrine « tous les champs requis » de [D3](#d3--les-agrégations--trois-champs-nommés-et-la-machinerie-de-ladr-0002-telle-quelle)
> refusent également.
>
> La partition est celle qui existe déjà dans le lot : **une erreur d'opérande désigne une
> valeur, une erreur de borne désigne un plafond.** `limit` est le pendant exact
> d'`actualType` — la seule information actionnable de sa branche, et elle est sûre à
> journaliser par construction puisqu'elle vient d'`EvaluationLimits`, pas des données.
>
> Le narrowing est celui de tout le dépôt : `if (details.code === 'step-limit-exceeded')`
> donne `limit`, jamais `actualType`. Aucun cast, donc aucun conflit avec §1.1.

**`depth-limit-exceeded` ferme le trou de pile côté évaluation.** Le garde de forme borne
la profondeur **au parsing** ([D8](#d8--le-bornage--ce-que-c1-doit-rendre-possible-pour-e8)),
mais `evaluateExpression` est **public** et reçoit un `Expression` — d'où qu'il vienne. Un
arbre construit en boucle par un intégrateur, jamais passé par `parseTemplate`, déborde la
pile vers 20 000 niveaux et rend un `RangeError` nu : exactement l'erreur non enveloppée
que ce plan refuse au parsing, et il serait incohérent de l'accepter au rendu. Le compteur
ne coûte rien parce que `evaluateWithin` **est déjà** le point de passage unique de chaque
descente : une profondeur qui monte à l'entrée, redescend à la sortie.

> 🔒 **`sample` a disparu, et c'est une correction, pas un durcissement.** Une version
> antérieure de ce plan énonçait le scénario d'exfiltration puis le refermait par une
> **clause de lectorat** — « la valeur voyage tronquée dans `details.sample` ; le
> Designer l'affiche, son lecteur est l'auteur du modèle ». C'était faux **dans le modèle
> de menace du plan lui-même** : cet auteur *est* l'attaquant, et la donnée appartient à
> l'application hôte. Le champ rouvrait le trou qu'il devait fermer.
>
> **Le critère juste n'est pas non plus celui que le plan croyait.** Le canal d'erreur
> n'est pas la fuite principale : un auteur qui peut écrire `dateAdd(customer.apiToken,
> 0)` peut tout aussi bien imprimer `customer.apiToken` dans une liaison de texte. Ce
> qui distingue les deux, c'est **où ils vont** : la charge d'erreur voyage vers
> l'exploitant, vers le journal qu'exige E8 et vers la réponse HTTP du service J5 — trois
> endroits que le document n'atteint pas. D'où la règle :
>
> > **La charge d'erreur doit rester sûre à journaliser même quand le document ne l'est
> > pas.**
>
> `actualType` est une liste fermée de neuf constantes, dérivée du *tag* de la valeur —
> nullité, `Array.isArray`, `typeof`, finitude — et jamais de son contenu. `describe()`
> cesse de prendre `unknown` pour prendre `ExpressionValueType` : la règle « aucun
> message ne contient une valeur de rendu » passe de la vigilance au **type**. Effet
> second réglé au passage : un message ne peut plus faire 10 Mo parce que la donnée en
> faisait 10 Mo.
>
> **Et le Designer n'y perd rien.** Il tient la portée et l'arbre ; avec un `at` depuis la
> racine il **rejoue** le sous-arbre fautif et affiche localement la valeur qu'il possède
> déjà. L'évaluation étant pure et sans horloge ([D5](#d5--dates--bornage--date-civile-pure--décision-ouverte-n°5-tranchée)), le rejeu est fidèle.

**`at` part de la racine, et sans threading.** Un chemin *local* ne peut pas décrire
`aggregate.value[3].arithmetic.right` : si l'erreur garde le site `arithmetic` elle perd
l'index de ligne, si elle prend le site `aggregate` elle perd l'opérande. Les deux
exemples qu'une version antérieure donnait — `['right']` et `['value','3']` —
n'appartenaient pas à la même grammaire. La correction ne threade rien : `fail()`
continue d'écrire un chemin **local**, et un unique helper `evaluateWithin(expression,
at, scope, budget)` enveloppe chaque descente, rattrape par `instanceof`, **préfixe son
segment** et relance le *même* objet d'erreur. Coût en O(profondeur), et **uniquement sur
le chemin d'erreur**.

> ⚠️ **« Préfixer puis relancer le même objet » et `readonly at` se contredisent, tant
> que le mécanisme n'est pas écrit.** Un implémenteur qui prend le plan au mot n'a que
> deux voies, et la première est **interdite** : muter un `readonly (string|number)[]`
> ne compile pas, et le seul moyen de forcer est un cast que §1.1 bloque. Le mécanisme
> est donc à écrire noir sur blanc — **l'état mutable est privé à la classe d'erreur, le
> contrat public reste immuable** :
>
> ```ts
> export class ExpressionEvaluationError extends OpenviewError {
>   // Segments accumulés du plus INTERNE au plus externe : `evaluateWithin` pousse en
>   // O(1) au lieu d'insérer en tête, et seule la lecture paie le renversement.
>   readonly #reversedPath: (string | number)[];
>
>   /** Appelé UNIQUEMENT par evaluateWithin, sur le chemin d'erreur. */
>   prefix(segment: string | number): void { this.#reversedPath.push(segment); }
>
>   get details(): ExpressionErrorDetails {
>     return { ...this.#payload, at: [...this.#reversedPath].reverse() };
>   }
> }
> ```
>
> Trois propriétés à épingler par un test, parce qu'aucune porte ne les voit :
> `details.at` rend bien la racine → la feuille (et non l'inverse) ; deux lectures
> successives de `details` rendent le **même** chemin ; et un `at` obtenu d'un `details`
> n'est pas affecté par un `prefix()` ultérieur — la copie du getter est ce qui le
> garantit.
>
> La variante « créer une nouvelle erreur à chaque niveau avec `cause` » a été écartée :
> elle empile *N* erreurs pour une faute, et le `cause` que
> [D7](#d7--la-charge-derreur--trois-champs-une-seule-taxonomie-aucune-donnée-dans-le-message)
> réserve à `DataBindingStep` cesserait de désigner la frontière core/moteur.

> Enrichir puis relancer une erreur typée n'est pas l'avaler : AGENTS.md §1.3 est
> respecté, et le plugin `no-silent-catch` l'accepte — vérifié à l'exécution. Résultat
> épinglé : `{ code:'operand-type', site:'arithmetic', at:['value',3,'right'],
> actualType:'text' }`. L'index est un **nombre**, pas la chaîne `'3'`.
>
> La variante « n'enrichir qu'aux formes liantes » est écartée : elle laisse
> `add(mul(a,b), c)` ambigu.

**Le garde de forme a sa propre classe d'erreur.** `assertBoundedShape` s'exécute **au
parsing**, sur de l'`unknown` : aucun nœud n'existe encore, donc aucun
`ExpressionErrorSite`. Il lève `TemplateShapeError`, sur le patron de
`TemplateMigrationError`, avec son catalogue fermé `SHAPE_ERROR_CODES = ['too-deep',
'too-many-nodes', 'not-plain-data']`.

**Frontière retenue et à écrire :** *core sait quel **opérateur** et quel **chemin**, le
moteur saura quel **bloc**.* `evaluateExpression` ne connaît honnêtement aucun id de bloc
— il n'en existe pas à ce niveau. `DataBindingStep` enveloppera avec `cause`, déjà
supporté par `OpenviewError`.

**Les quatre messages existants sont recopiés caractère pour caractère** dans les appels
à `fail()` : trois tests matchent sur le texte (`/operate on primitives/`,
`/must evaluate to a boolean/`, `/needs a list/`). C1 ajoute la charge machine, **C8
possède la formulation**. Seul changement de vocabulaire assumé : `describe()` dit
désormais `a list` au lieu de `an array` (aucun test n'assert `an array`) et cesse de
qualifier `NaN` de `a number`.

### D8 — Le bornage : ce que C1 doit rendre **possible** pour E8

Voir [arbitrage n°1](#8-les-cinq-arbitrages-tranchés) — c'est l'ajout de
périmètre le plus discutable du plan, et il repose sur une mesure.

**Mesuré, pas supposé.** Portage fidèle du corps `aggregate()` proposé, 200 lignes de
facture :

| Imbrication d'agrégats | Pas | Temps | Taille de la formule |
| ---: | ---: | ---: | ---: |
| 1 | 202 | 1,3 ms | 131 o |
| 2 | 40 402 | 96 ms | 229 o |
| 3 | 8 080 402 | **17,5 s** | 327 o |
| 4 | — | ≈ 58 min | ≈ 420 o |
| 6 | 6,4 × 10¹³ | des siècles | ≈ 520 o |

Le coût n'est pas O(n × m) mais **O(nᵏ)**, où *k* est choisi par l'auteur du modèle.
Aucun champ, aucune longueur, aucune profondeur n'est anormale : c'est le **produit des
cardinalités** qui explose, et rien dans le contrat ne le regarde.

**Le point qui rend cela structurel :** `evaluateExpression` est **synchrone et ne rend
jamais la main**. Pas d'`await`, pas de générateur, pas d'`AbortSignal`, pas de
compteur. Une boucle qui ne cède jamais l'*event loop* ne peut pas être interrompue par
un timer — donc « E8 bornera le temps » est **impossible à tenir** autrement qu'en tuant
un worker. C1 imposerait en silence à E8 une architecture worker-par-rendu, alors qu'E8
est déclaré condition de J5.

**Deuxième mesure, qui déplace le problème :** le débordement de pile ne frappe pas à
l'évaluation, il frappe **au parsing**. Chaîne `{kind:'not', operand: …}` postée en JSON,
Node 24 :

| Étape | Seuil de `RangeError` |
| :--- | ---: |
| `JSON.parse` (V8 parse itérativement) | > 100 000 |
| **Zod, l’algèbre élargie et 2 `z.lazy` imbriqués** *(mesuré à 17 kinds, avant l’ajout de `text()`)* | **≈ 1 874** |
| `JSON.stringify` (branche `never`) | ≈ 8 000 |
| `evaluateExpression` / `pathsOf` | ≈ 20 000 |

Le premier échec est donc un `RangeError` **de Zod**, sur un modèle d'environ 35–50 Ko,
qui traverse `parseTemplate` **sans être enveloppé** : ni `OpenviewError`, ni
`TemplateMigrationError`. Violation directe d'AGENTS.md §1.3 et du critère de C8
(« Maximum call stack size exceeded » n'est pas un message qu'un gestionnaire corrige).
Et le moteur ne peut rien inspecter : il faut parser pour regarder, et c'est le parsing
qui tombe.

**La réponse tient en deux pièces, toutes deux dans C1 :**

```ts
// packages/core/src/template/guard.ts — scan ITÉRATIF, insensible à la profondeur
export interface ShapeLimits {
  readonly maxDepth: number;  // 64 — en niveaux JSON, PAS en nœuds du document
  readonly maxNodes: number;  // 100_000 — sans lui le garde ne TERMINE pas, voir ci-dessous
}
export function assertBoundedShape(raw: unknown, limits?: Partial<ShapeLimits>): void
```

Appelé **deux fois** dans `parseTemplate` — voir ci-dessous. Avec `maxDepth = 64`, tout le reste devient
inatteignable **par construction** : Zod ne voit jamais 1 874, l'évaluateur jamais
20 000, `JSON.stringify` jamais 8 000. **Un seul garde-fou, quatre trous fermés**, et le
refus est typé donc racontable par C8.

> ⚠️ **Trois précisions sans lesquelles ce garde est un faux garde**, toutes mesurées.
>
> **`maxNodes` n'est pas un confort, c'est la condition de terminaison.** Un arbre de
> profondeur 40 à **sous-arbres partagés** — le même objet référencé deux fois par
> niveau — provoque **5 000 000 de visites en 846 ms** sans jamais atteindre `maxDepth` :
> la profondeur est bornée, le travail ne l'est pas. Un scan borné en profondeur seule ne
> termine pas.
>
> **Le scan doit lire par descripteur et refuser tout accesseur.** Mesuré : un `get` sur
> une propriété **est invoqué** par un scan naïf — donc du code de l'appelant s'exécute
> *avant* toute validation, avec en prime une fenêtre TOCTOU entre le garde et Zod (le
> getter peut rendre une valeur au garde et une autre à Zod). Le refus est
> `not-plain-data` : `parseTemplate` attend de la donnée, pas un objet vivant.
>
> **Un cycle est déjà attrapé par `maxDepth`** — un cycle excède toute profondeur finie —
> mais seulement si **chaque entrée de pile porte sa propre profondeur**. C'est une
> propriété de l'implémentation, pas du concept : elle doit être écrite dans le fichier
> et **épinglée par un test**, sinon le premier refactor qui hisse la profondeur hors de
> la pile fait boucler le garde à l'infini.
>
> **`maxDepth` compte des niveaux JSON, pas des nœuds du document.** Mesuré sur un modèle
> réaliste : 10 niveaux, et 12 avec un `aggregate(filter(…))`. 64 laisse donc une marge
> de cinq fois. L'unité doit être écrite : un lecteur qui croit compter des blocs
> choisira une valeur absurde.

> ⚠️ **Trois corrections de plus, sans lesquelles le garde promet plus qu'il ne tient.**
>
> **`ShapeLimits` se valide comme `EvaluationLimits`, avec le même refus bruyant.** Une
> version antérieure typait `limits?: Partial<ShapeLimits>` et n'en vérifiait rien, à
> deux paragraphes d'une section qui exige `z.number().int().min(1)` sur
> `EvaluationLimits` *« sans quoi un appelant désactive la protection par accident en
> passant `0` »*. L'asymétrie n'a aucune justification : `assertBoundedShape(raw, {
> maxDepth: 0 })` neutralise le garde en silence, et `{ maxNodes: NaN }` le fait ne
> jamais terminer — la panne exacte que `maxNodes` existe pour empêcher. Même schéma,
> même plafond dur à 10⁹, et `InvalidShapeLimitsError` sur le patron
> d'`InvalidEvaluationLimitsError`.
>
> **Le garde s'exécute AVANT et APRÈS la migration.** `parseTemplate` vaut aujourd'hui
> `TemplateSchema.parse(migrateToCurrent(raw, migrations))`
> ([`migrate.ts:98-103`](../../packages/core/src/template/migrate.ts)) : le garde en tête
> protège `migrateToCurrent` **et** Zod tant que la chaîne est vide ou identitaire. Mais
> une migration future **transforme** — envelopper un nœud, éclater un champ — donc elle
> peut *produire* une forme hors limites à partir d'une entrée conforme, et c'est alors
> Zod qui reçoit l'arbre trop profond, avec le `RangeError` nu que tout ce garde existe
> pour empêcher. La règle : garde sur l'entrée brute, puis **sur la sortie de la chaîne
> lorsqu'au moins une étape a tourné**. Coût nul dans le cas courant — un document déjà
> estampillé à la version courante ne migre pas, donc ne scanne qu'une fois — et la
> contrepartie doit être écrite dans l'ADR 0003 : *une migration ne rend jamais une forme
> hors limites.*
>
> **Le garde arrête un accesseur, il n'arrête pas un Proxy — et il faut le dire.** Lire
> par `Object.getOwnPropertyDescriptor` empêche bien un **getter** d'objet ordinaire de
> s'exécuter, et c'est ce que le test épingle. Mais sur un `Proxy`, `getOwnPropertyDescriptor`
> et `ownKeys` sont **eux-mêmes des traps** : du code de l'appelant s'exécute quand même,
> et la fenêtre TOCTOU vis-à-vis de Zod se rouvre entière. Le garde ne peut donc pas
> promettre « aucun code de l'appelant ne s'exécute » ; il promet « aucun **getter**
> déclaré ne s'exécute ». C'est le pendant, côté `parseTemplate`, de l'hypothèse 2 de la
> [§9](#9-ce-que-ce-plan-tient-pour-acquis) — laquelle ne couvre que la *portée
> d'évaluation* et laissait donc l'entrée de parsing sans énoncé. Un Proxy passé à
> `parseTemplate` est **hors modèle de menace, par écrit**, pas parce que personne n'y a
> pensé.

```ts
// packages/core/src/expression/limits.ts
// DEUX types, et la distinction est la correction la plus importante de cette section.
export interface EvaluationLimits {   // CONFIGURATION, validée, immuable
  readonly maxSteps: number;          // nœuds évalués            — câblé en INC-3
  readonly maxDepth: number;          // descentes imbriquées     — câblé en INC-3
  readonly maxItemsVisited: number;   // éléments traversés, CUMULÉS — câblé en INC-6
  readonly maxStringLength: number;   // concat / textCase / text — câblé en INC-8
}

export interface EvaluationBudget {   // COMPTEURS MUTABLES, partagés
  // Chacune rend `false` au dépassement et NE LÈVE PAS : seul `fail()` lève, parce que
  // lui seul connaît le `site` et le `at` qu'exige ExpressionErrorDetails.
  spend(steps: number): boolean;      // -> step-limit-exceeded
  enter(): boolean;                   // -> depth-limit-exceeded  (appairé à leave())
  leave(): void;
  visit(items: number): boolean;      // -> item-limit-exceeded
  acceptString(length: number): boolean; // -> string-limit-exceeded
  readonly spent: { readonly steps: number; readonly itemsVisited: number; readonly depth: number };
  /** Lecture seule, pour que `fail()` puisse remplir `details.limit`. */
  readonly limits: EvaluationLimits;
}
export function createBudget(limits?: Partial<EvaluationLimits>): EvaluationBudget;
export const DEFAULT_EVALUATION_LIMITS: EvaluationLimits = {
  maxSteps: 1_000_000, maxDepth: 64,
  maxItemsVisited: 1_000_000, maxStringLength: 1_048_576,
};
```

> ⚠️ **Deux corrections sur cette interface, et la première rendait INC-8 inapplicable.**
>
> **`maxStringLength` n'avait aucune méthode.** Le champ était déclaré « câblé en INC-8 »
> face à un budget qui ne savait que `spend` et `visit` : INC-8 devait faire respecter une
> borne à laquelle l'API ne donnait pas accès. `acceptString(length)` la rend applicable,
> et `depth` accompagne le code que
> [D7](#d7--la-charge-derreur--trois-champs-une-seule-taxonomie-aucune-donnée-dans-le-message)
> ajoute. **Règle générale à retenir : un champ d'`EvaluationLimits` sans méthode de
> budget est un plafond décoratif** — c'est mot pour mot le reproche que cette section
> fait déjà au troisième paramètre positionnel.
>
> **`spend()` et `visit()` ne peuvent pas lever, et c'était l'erreur de conception.** Une
> version antérieure les annotait *« lève step-limit-exceeded au dépassement »*. Un budget
> ne reçoit ni `site`, ni `at` — **les deux champs que porte toute branche
> d'`ExpressionErrorDetails`** : il n'a littéralement pas de quoi construire l'erreur. Il
> lèverait donc soit une erreur d'un autre type (et `evaluateWithin`, qui rattrape par
> `instanceof ExpressionEvaluationError`, la laisserait traverser sans jamais préfixer son
> chemin), soit une erreur aux champs inventés. S'y ajoute que INC-1 pose `fail()` comme
> **unique site de levée** : un budget qui lève en ouvre un second, dans l'incrément même
> qui déclare l'invariant.
>
> Le risque du retour booléen — un appelant qui oublie de tester — est réel et se traite
> par la structure, pas par la vigilance : **`spend` et `enter` n'ont qu'un seul site
> d'appel**, `evaluateWithin`, qui est déjà le point de passage unique de chaque descente.
> `visit` en a un par forme de liste (`aggregate`, `count`, `filter`) et `acceptString` un
> par forme productrice de texte (`concat`, `textCase`, `text`). Sept sites au total, tous
> nommés ici, tous couverts par un test de borne.

> ⚠️ **Une version antérieure de ce plan passait `EvaluationLimits` en troisième
> paramètre et s'arrêtait là. Ça ne borne rien.** Une configuration ne transporte que des
> plafonds ; elle ne dit pas *où* vivent `steps` et `itemsVisited`. Un compteur local à
> `evaluateExpression` se réinitialise à **chaque appel de haut niveau** : un document de
> 500 liaisons obtient 500 × 1 000 000 de pas, et la borne devient décorative. Il faut
> donc **deux types** : une configuration validée, et un budget à compteurs **partagé**.

**Le budget est créé une fois par rendu, par le pipeline**, et traverse tout : les appels
récursifs, `evaluatePredicate`, `evaluateSequence`, les N éléments d'un agrégat, et
toutes les expressions du même document. Signatures publiques après correction —
**source-compatibles**, les appelants actuels (playground, tests) continuent d'appeler à
deux arguments :

```ts
export function evaluateExpression(
  expression: Expression, scope: EvaluationScope,
  options?: { readonly budget?: EvaluationBudget | undefined },
): unknown;

export function evaluatePredicate(
  expression: Expression, scope: EvaluationScope,
  options?: { readonly budget?: EvaluationBudget | undefined;
              readonly caller?: ExpressionErrorSite | undefined },
): boolean;
// idem evaluateSequence — `caller` est ce qui lui fait cesser de dire « loop » à un agrégat.
```

Un **sac d'options** plutôt qu'un troisième paramètre positionnel, parce que
`evaluatePredicate` et `evaluateSequence` ont besoin d'une seconde chose (`caller`) et que
trois fonctions dont le 3ᵉ paramètre a trois formes différentes est l'asymétrie qu'un
appelant se trompe à remplir.

**La configuration est validée, et le refus est bruyant.** `z.number().int().min(1)` de
Zod 4 rejette `NaN`, `Infinity`, `0`, les négatifs et les fractions ; un plafond dur à
10⁹ borne le haut. Un champ **absent** prend le défaut ; un champ **présent et
inutilisable** lève `InvalidEvaluationLimitsError` — **jamais de repli silencieux**, sans
quoi un appelant désactive la protection par accident en passant `0`.

Défauts **actifs**, jamais opt-in : *une bibliothèque dont la sûreté se demande est une
bibliothèque non sûre.* Deux règles de comptage sans lesquelles le compteur ment : un pas
par nœud évalué **et** un pas **par élément** dans `aggregate`/`filter`, sinon 200³
itérations comptent pour 3.

> **`EvaluationLimits.maxDepth` et `ShapeLimits.maxDepth` portent le même nom, la même
> valeur et PAS la même unité.** Le garde de forme compte des **niveaux JSON** ; le budget
> compte des **descentes d'expression**, et un nœud d'expression pèse au moins deux
> niveaux JSON (l'objet, puis le champ qui porte son opérande). Un modèle qui passe le
> garde à 64 niveaux JSON descend donc au plus ~32 fois : **la borne d'évaluation ne peut
> pas se déclencher sur un arbre issu de `parseTemplate`**, et c'est voulu. Elle n'existe
> que pour les arbres construits à la main, qui ne passent par aucun garde. Les deux
> valeurs sont égales pour que personne n'ait à arbitrer laquelle est la plus basse ;
> l'écart d'unité est ce qui donne la marge.

> **Risque résiduel, assumé et nommé :** `budget` reste *optionnel*, donc un appelant peut
> l'oublier et retomber sur un budget par appel. Deux contrepoids : côté `engine`, un
> helper à budget **requis** ; et un test « deux appels de haut niveau, un seul budget,
> `step-limit-exceeded` » qui épingle le cumul.

C'est mot pour mot l'argument que le plan emploie lui-même pour la charge d'erreur :
*ajouter un champ à une API qui n'a aucun consommateur coûte zéro ; la rétrofitter après
le moteur et le Designer, non.*

**`concat` mérite sa propre borne**, parce que c'est le seul kind qui **produit** de la
donnée au lieu d'en réduire. Mesuré, arbre équilibré `concat(x, x)` sur 1 Ko :
profondeur 12 → modèle de 237 Ko → chaîne de 4 Mo ; profondeur 18 → modèle de 15 Mo →
chaîne de **268 Mo**, 858 Mo de RSS. Amplification en 2^profondeur × la plus longue
chaîne des données. La borne — `budget.acceptString(resultat.length)` — doit être vérifiée
**après chaque construction**, pas seulement à la fin : c'est le seul ordre qui empêche la
chaîne intermédiaire d'exister avant d'être refusée.

### D9 — `schemaVersion` passe à **2**, avec une migration identité

> ⚠️ **Renversement.** Ce plan a d'abord décidé l'inverse — version 1 maintenue,
> `TEMPLATE_MIGRATIONS` vide — en s'appuyant sur trois arguments. **Les trois sont tombés
> à la mesure.**

**1. « Une migration 1 → 2 serait fantôme. »** Elle ne l'est pas : elle **estampille**, et
l'estampille est la seule chose qui produise un refus exploitable. Mesuré, sur un document
portant un kind de C1 :

| | Ce que rend un build antérieur |
| :--- | :--- |
| **version 1 maintenue** | `ZodError` — `"note": "No matching discriminator"`, `"message": "Invalid input"`, path `root.children.0.content.1.value.kind`. Ni `OpenviewError`, ni `TemplateMigrationError`, aucune mention de version, **aucun remède** |
| **version 2** | `TemplateMigrationError: Template uses schema version 2 but this build understands at most 1. It was written by a newer release of Openview; upgrade before opening it.` |

Le second message est rendu par **le code déjà présent dans le dépôt** : la garde de
`migrate.ts` existe, aucune coordination n'est requise. C'est exactement le message que
C8 attend, et C1 est le lot dont C8 dépend.

**2. « L'incrément passerait les quatre portes en silence. »** **Faux, et c'est le pilier
qui tombe.** Mesuré sur une copie patchée : dans **les deux cas** — avec migration comme
sans — `migrate.test.ts` lève `No migration registered from schema version 1. The upgrade
chain to 2 is broken.` La quatrième porte rougit. Le versionnement était **déjà outillé**,
contrairement à ce que le plan supposait. Correctif du test, vérifié : lui faire composer
`[...chain, ...TEMPLATE_MIGRATIONS]` au lieu de sa chaîne synthétique seule.

**3. « C1 est purement additif, donc l'incrément ne se justifie pas. »** La prémisse est
fausse : voir [D2](#d2--aucune-position-rétrécie--trois-valeurs-bornées-et-il-faut-le-dire).

### Ce que la migration fait, et ce qu'elle ne fait surtout pas

```ts
// packages/core/src/template/migrate.ts
export const TEMPLATE_MIGRATIONS: readonly TemplateMigration[] = [
  {
    from: 1,
    to: 2,
    /**
     * Identité, sauf l'estampille — et c'est tout l'intérêt. Un document v1 est
     * structurellement un document v2 : C1 n'a fait qu'ÉLARGIR des unions, donc rien
     * n'est à transformer. Ce que l'estampille achète est à l'autre bout : un build
     * antérieur qui ouvre un document v2 dit « écrit par une version plus récente »
     * au lieu de « Invalid input » sur un discriminant.
     */
    migrate: (input) => ({ ...input, schemaVersion: 2 }),
  },
];
```

> 🚫 **La migration ne rattrape PAS les trois bornes de D2.** Tronquer un chemin de 591
> caractères ou aplatir un arbre de 101 niveaux **corromprait** le document. Ces
> rétrécissements restent couverts par l'hypothèse **pré-v1.0** — vérifiée : aucun tag
> git, aucun workflow de publication, `packages/core` en `0.1.0`. C'est le seul endroit
> du lot où l'argument pré-v1.0 reste le bon argument.

> ⚠️ **Réserve mesurée, à écrire dans l'ADR 0003.** La garde de version porte sur
> l'**estampille**, pas sur le contenu. Un document estampillé `1` mais portant un kind de
> C1 — fabriqué à la main, ou par un outil tiers — retombe sur `Invalid input` **même
> depuis un build v2**. La migration estampille, elle ne valide pas. Ce cas appartient à
> C8.

### Où l'estampille se pose — et pourquoi une seule fois

**Le versionnement ne suit pas le découpage en incréments, et ce n'est pas un oubli.**
INC-4, INC-5, INC-6 et INC-8 ajoutent chacun des formes persistées. Trois lectures
seulement sont cohérentes, et deux se rejettent :

| Lecture | Pourquoi elle tombe |
| :--- | :--- |
| **Une version par incrément de schéma** — 2, 3, 4, 5 | Quatre estampilles et quatre migrations identité pour **un seul** lot fonctionnel. Le numéro cesserait de désigner un contrat pour désigner un commit, et C9 hériterait d'une chaîne dont trois maillons ne veulent rien dire |
| **Un incrément unique portant toutes les formes persistées** | Détruit le découpage : c'est INC-4 à INC-8 fusionnés en un seul commit **L+**, exactement la revue illisible que le découpage existe pour éviter |
| ✅ **Une estampille unique, posée après la dernière forme, et des commits intermédiaires déclarés non publiables** | Le numéro `2` désigne alors **l'algèbre C1 complète** — ce que D9 dit qu'il désigne |

**La conséquence, à assumer explicitement : entre INC-2 et INC-8bis, le dépôt produit des
builds qui ne sont pas interchangeables.** Un build pris à INC-4 lit `CURRENT_SCHEMA_VERSION
= 1` et rendrait `Invalid input` sur un document écrit à INC-8 — précisément le défaut que
D9 corrige. Ces builds n'existent que sur la branche, entre deux commits d'un même lot :
l'hypothèse 1 de la [§9](#9-ce-que-ce-plan-tient-pour-acquis) — aucun tag git, aucun
workflow de publication, `packages/core` en `0.1.0` — n'est pas invoquée ici pour couvrir
un rétrécissement, mais pour établir qu'**aucun de ces builds intermédiaires ne sort du
dépôt**. C'est une contrainte de conduite du lot, et elle est courte :

> **Aucun commit de C1 antérieur à INC-8bis n'est publiable, et aucun document produit par
> un build intermédiaire n'est conservé.** Le premier commit publiable de ce lot est celui
> qui pose l'estampille.

**L'estampille a donc son propre incrément**, [INC-8bis](#inc-8bis--lestampille-de-schéma--s),
placé après toutes les formes persistées et avant le playground. Aucune version antérieure
de ce plan ne l'attribuait à personne : D9 la décidait, la [§6](#6-ce-qui-ne-se-touche-pas)
et la [§7](#7-définition-de-fini) la constataient, et les dix incréments — la seule partie
exécutable du document — ne la portaient nulle part. Une décision que personne n'exécute
n'est pas une décision.

### La contradiction de textes, et où elle se règle

`AGENTS.md` §1.2 dit, **sans réserve** : *« toute évolution s'accompagne d'une migration
`migrate(from, to)` »*. L'ADR 0002 en crée une, pré-v1.0 — et se contredit elle-même
ailleurs. **`AGENTS.md` fait foi** : c'est le fichier que `CLAUDE.md` importe et que tous
les agents lisent, et une ADR qui entend l'amender doit le dire, ce que 0002 ne fait pas.

Une version antérieure de ce plan « réglait » cela en ajoutant une réserve au docstring de
`template.ts` : c'était ajouter un **cinquième** texte au lieu d'en supprimer un. La
correction va donc dans les trois documents qui portent la règle, et INC-0 en est chargé :

- **`AGENTS.md` §1.2** — *clarifier*, jamais assouplir : nommer les **deux** formes
  d'incompatibilité (la perte silencieuse par le `strip` de Zod ; le refus illisible par
  élargissement d'union), écrire qu'*une migration qui ne transforme rien n'est pas une
  migration fantôme*, et qu'*il n'y a pas de dérogation pré-v1.0 au versionnement — la
  dérogation pré-v1.0 porte sur les rétrécissements*.
- **ADR 0002** — marquer la conséquence « `CURRENT_SCHEMA_VERSION` reste à 1 » **révisée
  par l'ADR 0003**, sans la réécrire : une ADR est un journal.
- **`template.ts`** — n'y écrire **aucune** réserve pré-v1.0 ; y ajouter au contraire le
  cas qui manquait, l'élargissement d'union, avec les deux messages mesurés ci-dessus.

---

## 3. Le contrat définitif

### 3.1 `packages/core/src/expression/expression.ts`

> **Contrainte d'ordre, non outillée, à écrire en commentaire :** les **deux liaisons
> `z.lazy` sont déclarées AVANT tous les schémas membres**, parce qu'un membre les
> référence dans un champ. Un membre placé au-dessus lèverait un `ReferenceError` de TDZ
> à l'import — ni erreur de type, ni erreur de lint, seul `vitest` casse. Vérifié :
> l'ordre ci-dessous ne lève rien.

```ts
export const ARITHMETIC_OPERATORS = ['add', 'sub', 'mul', 'div'] as const;
export const AGGREGATE_OPERATORS  = ['sum', 'avg', 'min', 'max'] as const;
export const TEXT_CASE_OPERATORS  = ['upper', 'lower'] as const;

/* ── Nombres ── */
export interface ArithmeticExpression {
  readonly kind: 'arithmetic';
  readonly op: ArithmeticOperator;
  readonly left: PrintableExpression;
  readonly right: PrintableExpression;
}
export interface PercentOfExpression {   // base * rate / 100, taux en POINTS
  readonly kind: 'percentOf';
  readonly base: PrintableExpression;
  readonly rate: PrintableExpression;
}

/* ── Agrégations ── */
export interface AggregateExpression {
  readonly kind: 'aggregate';
  readonly op: AggregateOperator;
  readonly source: Expression;          // accepte un path comme un filter
  readonly as: string;
  readonly value: PrintableExpression;
}
export interface CountExpression  { readonly kind: 'count';  readonly source: Expression; }
export interface FilterExpression {       // à valeur de LISTE, donc hors de Printable
  readonly kind: 'filter';
  readonly source: Expression;
  readonly as: string;
  readonly where: Expression;
}

/* ── Condition ── */
export interface ConditionalExpression {
  readonly kind: 'if';
  readonly when: Expression;
  readonly whenTrue: PrintableExpression;   // ⚠️ PAS `then` — voir ci-dessous
  readonly whenFalse: PrintableExpression;  // requis : un optionnel trancherait la politique d'absence
}

/* ── Textes et dates ── */
export interface ConcatExpression   { readonly kind: 'concat'; readonly parts: readonly PrintableExpression[]; }
/** Mise en chaîne EXPLICITE. Forme canonique, jamais un format d'affichage (C6). */
export interface TextExpression     { readonly kind: 'text'; readonly value: PrintableExpression; }
export interface TextCaseExpression { readonly kind: 'textCase'; readonly op: TextCaseOperator; readonly text: PrintableExpression; }
export interface DateAddExpression  { readonly kind: 'dateAdd'; readonly date: PrintableExpression; readonly days: PrintableExpression; }
export interface DateDiffExpression { readonly kind: 'dateDiff'; readonly from: PrintableExpression; readonly to: PrintableExpression; }
export interface EndOfMonthExpression { readonly kind: 'endOfMonth'; readonly date: PrintableExpression; }
```

Et le schéma correspondant, déclaré **après** les deux liaisons `z.lazy` comme tous les
autres membres :

```ts
export const TextExpressionSchema = z.object({
  kind: z.literal('text'),
  value: PrintableExpressionSchema,
});
```

```ts
// evaluate.ts — la branche. Aucun format, aucune locale : la forme canonique.
    case 'text': {
      const raw = evaluateExpression(expression.value, scope);
      if (isAbsent(raw)) { return undefined; }
      if (typeof raw === 'string') { return raw; }
      if (typeof raw === 'number' && Number.isFinite(raw)) { return String(raw); }
      // Booléen, liste, objet : refusés. `text(true)` imprimerait `true` dans un
      // document, ce que la position d'impression interdit depuis l'ADR 0002.
      fail('operand-type', expression, ['value'],
        `Only a number or a text can be turned into text, got ${describe(raw)}.`);
    }
```

> 🚫 **`then` est interdit, et je l'ai vérifié en exécutant la porte réelle.**
> `npx biome check` rend `× This object defines a then property` sur tout **littéral
> d'objet** portant ce champ — donc sur le schéma Zod, sur chaque échantillon de test et
> sur chaque formule du playground. `lint/suspicious/noThenProperty` est **error** dans
> le preset `recommended` activé par `biome.jsonc`. `pnpm run lint` échoue, donc la CI
> aussi. Un `biome-ignore` n'est pas une issue : AGENTS.md §1.1 l'interdit sans
> justification écrite, et il faudrait le poser à **chaque site littéral**. Le renommage
> `whenTrue`/`whenFalse` coûte zéro aujourd'hui — et une migration après la v1.0.

**Autres points du contrat :**

- `aliasSchema` est **hissé** depuis `nodes.ts` : trois sites lient désormais une clé de
  portée (`loop.as`, `aggregate.as`, `filter.as`). C'est le moment où la règle se
  factorise, ou bien elle diverge.
- `PathExpressionSchema` gagne `.max(256, 'A path may not exceed 256 characters')`.
  `PATH_PATTERN` n'est **pas** vulnérable au backtracking (vérifié : 200 002 caractères
  en 9,4 ms, linéaire) — le problème est que `resolvePath` refait `path.split('.')` à
  **chaque** lecture, et les agrégations font passer ce nombre de O(1) à O(n), voire
  O(n²).
- `ConcatExpressionSchema` : `.min(2, 'A concat needs at least two parts')`.
- **Validation des dates littérales au parsing.** Un `.refine` sur les positions de date
  qui, **lorsque l'opérande est un `literal` à valeur `string`**, exige
  `dayNumberOf(value) !== undefined`, et ne dit rien sinon. Le plan initial affirmait que
  « la validation de forme ne peut pas remonter au parsing » — c'est un non-sequitur :
  qu'un `path` soit invérifiable au save-time n'empêche rien pour un `literal`, et la
  doctrine du dépôt est explicite à cet endroit précis (`PathExpressionSchema` : *« so a
  malformed path fails when the template is saved instead of when a document renders »*).

### 3.2 `pathsOf` — filtrage d'alias **en interne**, signature publique inchangée

Le filtre existant (`addCallerPaths`, [`visitor.ts:175-195`](../../packages/core/src/ast/visitor.ts))
opère au niveau du **nœud** et ne verra jamais un alias enfoui dans une expression. Sans
traitement, `sum(invoice.lines, l, l.total)` ferait **réclamer à l'intégrateur une clé
`l` qu'il ne fournira jamais** — le bug exact que l'ADR 0002 vient de corriger pour les
boucles, réintroduit par les agrégations.

`pathsOf` porte donc un contexte d'alias interne. `addCallerPaths` **ne bouge pas d'une
ligne**, à une condition : extraire `rootSegment`, aujourd'hui inline.

> ⚠️ **Piège de renommage.** La variable locale de `visitor.ts:190` s'appelle **déjà**
> `rootSegment`. Ajouter l'import sans supprimer les deux lignes locales fait masquer
> l'import par la locale : `noUnusedImports` (Biome, error) **et** `noUnusedLocals` (tsc)
> refusent le fichier. Il faut supprimer `const dot = …` et `const rootSegment = …` et
> écrire `if (!aliases.has(rootSegment(dataPath))) { into.add(dataPath); }`.

### 3.3 `packages/core/src/ast/nodes.ts` — le bloc d'import final

Une fois `printableExpressionSchema` local et `loopAliasSchema` supprimés, **cinq imports
deviennent morts** (`isIdentifier`, `LiteralExpression`, `LiteralExpressionSchema`,
`PathExpression`, `PathExpressionSchema`). Le bloc final est exactement :

```ts
import {
  aliasSchema,
  type Expression, ExpressionSchema,
  type PrintableExpression, PrintableExpressionSchema,
} from '../expression/expression.js';
```

### 3.4 `packages/core/src/expression/civil-date.ts` — nouveau, pur

Arithmétique entière (*days-from-civil* de Hinnant), **aucun `Date`, aucun `Intl`,
aucune horloge**. Le bénéfice n'est pas la performance : c'est que la contrainte « aucune
lecture d'environnement » devient **vérifiable** plutôt que confiée à la vigilance d'un
relecteur. Les trois pièges classiques — `new Date(y,m,d)` en fuseau hôte, `Intl`/ICU
dépendant de la version, `new Date(chaîne)` non spécifié hors ISO — ne sont pas évités,
ils sont rendus **inatteignables**.

**La validation EST l'aller-retour** : `daysFromCivil` puis `civilFromDays`, puis
comparaison des trois composantes. `2026-02-30`, `2025-02-29`, `2026-13-01` et
`2026-02-00` tombent tous là, **sans table de longueurs de mois ni règle bissextile
écrite à la main** — donc sans une seule ligne qui puisse être fausse.

`slice` et non des groupes de capture : sous `noUncheckedIndexedAccess`, `matched[1]` est
`string | undefined`, donc il faudrait une garde **jamais prise à l'exécution** — une
branche morte qui ferait tomber le seuil de couverture de branches.

Résultats vérifiés : `2026-01-31 +30j → 2026-03-02` · `2024-01-31 +30j → 2024-03-01` ·
`endOfMonth('2024-02-05') → 2024-02-29` · `dateDiff('2026-01-01','2026-03-01') → 59` ·
`endOfMonth(dateAdd('2026-01-20', 45)) → 2026-03-31`.

### 3.5 Le seul point du lot **sans aucun signal automatique**

`zod` déclare `ZodType<out Output, …>` : **un corps `z.lazy` qui omet un membre reste
assignable et compile sans un mot.** Vérifié en retirant `EndOfMonthExpressionSchema` du
corps — `tsc` reste **silencieux**, Biome aussi, et seul un test runtime échoue.

Trois gardes, dans cette forme exacte :

```ts
// (a) et (b) — DANS un it(), sinon noUnusedLocals (tsc) ET noUnusedVariables (Biome) refusent.
//     Le dépôt a déjà ce patron : nodes.test.ts:83, « a compile-time assertion wearing
//     a runtime expectation ».
it('keeps the schema union and the hand-written type in step', () => {
  const membersFit: EnumeratedMembers extends Expression ? true : false = true;
  const kindsInStep: MutuallyAssignable<EnumeratedMembers['kind'], ExpressionKind> = true;
  expect([membersFit, kindsInStep]).toStrictEqual([true, true]);
});

// (c) LA garde qui couvre le runtime. Le type doit être MAPPÉ, pas Record<K, Expression> :
//     `{ endOfMonth: { kind: 'literal', value: 1 } }` compile sans un mot sous Record,
//     et la garde devient décorative pile pour le kind qu'on voulait protéger.
const SAMPLES: { readonly [K in ExpressionKind]: Extract<Expression, { kind: K }> } = { /* 18 */ };
```

> ⚠️ **Deux formes qui ne marchent pas, à ne pas écrire.**
> `MutuallyAssignable<z.infer<typeof ExpressionSchema>, Expression>` est une
> **tautologie** : `z.infer` rend l'annotation, pas le corps. Et l'assignabilité
> **mutuelle** sur les membres **ne compile pas** : Zod infère `operands: Expression[]`
> (mutable) face à `readonly Expression[]`, donc l'échec porte sur la variance des
> tableaux, pas sur un membre manquant.

> ⚠️ **Imports de test.** Les **18** schémas membres — un par kind, `text()` compris —
> n'apparaissent que dans `z.infer<typeof X>`. `lint/style/useImportType` (recommended, error) l'interdit :
> préfixer chacun par `type`. Le dépôt applique déjà la règle (`nodes.test.ts:8`).
> Vérifié : `z.infer<typeof X>` fonctionne parfaitement sur un import type-only.

### 3.6 bis — Le garde de forme se contourne par le barrel, et c'est à écrire

`assertBoundedShape` vit dans `parseTemplate`. Or `packages/core/src/index.ts` exporte
**`TemplateSchema` lui-même** : le contournement le plus court n'est pas
`ExpressionSchema.parse`, c'est `TemplateSchema.parse(raw)` — une ligne, qui est
*exactement* le corps de `parseTemplate` privé de son garde.

**Tranché : on ne dé-exporte rien.** On ajoute les entrées bornées qui manquent, et **on
épingle la différence par un test** — c'est la doctrine que ce plan applique déjà au corps
`z.lazy` : *ce qu'aucune porte ne rattrape, un test le constate.*

> ⚠️ **Mais pas pour la raison que ce plan invoquait.** Une version antérieure justifiait
> le maintien de ces exports par
> [D2](#d2--aucune-position-rétrécie--trois-valeurs-bornées-et-il-faut-le-dire). C'est un
> abus : D2 porte sur les **positions du contrat persistant** — ce qu'un modèle stocké a
> le droit de contenir — et n'a jamais rien dit de la **surface d'exports**. Retirer
> `TemplateSchema` du barrel ne rendrait invalide aucun document ; ce serait une rupture
> d'API, pas un rétrécissement de contrat. Invoquer D2 ici, c'est se donner un interdit
> pour ne pas avoir à peser une décision.
>
> **La vraie raison, qui suffit :** un schéma Zod est le point d'attache de `z.infer`, de
> la composition (`z.array(DocumentNodeSchema)`) et de la validation partielle dont le
> Designer a besoin — trois usages qu'aucune fonction `parse*` ne remplace. Les dé-exporter
> forcerait les consommateurs à redéclarer le contrat, ce qui est pire que la voie non
> bornée qu'on ferme.
>
> **Le risque résiduel se nomme donc au lieu de se déguiser :** `TemplateSchema.parse`,
> `DocumentNodeSchema.parse` et `ExpressionSchema.parse` restent des entrées **non
> bornées**, atteignables en une ligne depuis le barrel. Ce qui les rend acceptables n'est
> pas un principe, c'est une mesure : la récursion de Zod tombe elle-même vers 1 874
> niveaux, donc la voie non bornée n'ouvre pas la profondeur — elle ouvre le `RangeError`
> **non enveloppé**, celui que `parseTemplate` évite. Le test qui épingle la différence
> doit constater exactement cela : la même entrée profonde rend un `TemplateShapeError`
> par `parseTemplate` et un `RangeError` par `TemplateSchema.parse`. La docstring de
> chaque schéma exporté renvoie vers son entrée bornée.

```ts
/** Parse une expression isolée EN LA BORNANT. `ExpressionSchema.parse` ne borne rien. */
export function parseExpression(raw: unknown, limits?: Partial<ShapeLimits>): Expression;
export function parseDocumentNode(raw: unknown, limits?: Partial<ShapeLimits>): DocumentNode;
```

Le garde ne peut **pas** aller dans le schéma : un `.superRefine` en tête d'un corps
`z.lazy` se réexécuterait à chaque niveau de la récursion.

### 3.6 Les noms d'opérations : **aucun test outillé** — arbitrage n°4, tranché B

Une version antérieure de ce plan proposait un test itérant les trois enums fermés
contre une expression rationnelle, pour interdire par une machine tout nom d'opération à
consonance fiscale. **Écarté.** La limite de responsabilité reste tenue par la **clause
du [README](../../README.md)** et par elle seule — c'est la position déjà retenue par
`docs/roadmap/core.md`, et C1 ne la rouvre pas.

Ce que cela laisse à la revue humaine, et qu'il faut donc énoncer dans l'ADR 0003 pour
que la règle soit au moins *lisible* :

> **Un nom est interdit s'il désigne une RÈGLE, pas une OPÉRATION.** `sum`, `percentOf`,
> `round` (à venir en C2) décrivent un calcul et sont légitimes. `tva()`, `taxe()`,
> `arrondiLegal()`, `tauxDeChange()` nomment une règle dont Openview ne répond pas : par
> leur seule existence ils déplacent la responsabilité, quoi qu'en dise la documentation.

**Le risque accepté, en clair.** `docs/roadmap/README.md` §6 le nomme déjà — *« une
clause seule est une protection déclarative »* — et sa colonne « ce qui l'atténue » dit
*« Rien pour l'instant »*. Cet arbitrage la laisse dire vrai. Le signal de réouverture
reste celui qu'écrit la roadmap : **le jour où une fonction à nom fiscal est demandée**.
Ce jour-là, le renommage coûtera une migration, parce que la liste ne sera plus vide.

*Aucune ligne de code, aucun test : cette section existe pour que la décision soit
écrite, et pour que personne ne rajoute le test « pendant qu'on y est ».*

---

## 4. Les onze incréments

Chacun passe les quatre portes seul et laisse le dépôt cohérent. **Cohérent n'est pas
publiable** : jusqu'à INC-8bis inclus, aucun build intermédiaire ne sort du dépôt, pour la
raison écrite en [D9](#où-lestampille-se-pose--et-pourquoi-une-seule-fois).

### INC-0 — L'ADR 0003, et les textes qu'elle rend faux · **M**

**Fichiers.** ➕ `docs/adr/0003-formules-agregations-et-dates-civiles.md` ·
✏️ `docs/adr/0001-expression-language.md` (ligne « Amendé par », réécriture du paragraphe
« Rien d'autre. Pas d'arithmétique, pas d'appel de fonction » — l'interdiction du parseur
et de l'accès indexé dynamique **reste**) · ✏️ `docs/roadmap/README.md` (décision ouverte
n°5 marquée tranchée sur le **bornage des opérations** de date) ·
✏️ `docs/roadmap/core.md` (**§« l'ADR devra être amendé dans le même mouvement » →
marqué fait**) · ✏️ **`AGENTS.md`** (§1.2 « Versionnement de l'AST », clarifié — voir
[D9](#d9--schemaversion-passe-à-2-avec-une-migration-identité)) · ✏️ **`docs/adr/0002`**
(deux amendements, ci-dessous) · ✏️ `packages/core/src/template/template.ts` (**docstring
seul** : le cas de l'élargissement d'union et ses deux messages mesurés — **et aucune
réserve pré-v1.0**).

> **Les deux amendements à l'ADR 0002**, tous deux vérifiés nécessaires :
>
> 1. **Option A3, l'argument de rejet de `concat`.** L'ADR écrit qu'ajouter un opérateur
>    `concat` *« reviendrait à réimplémenter un moteur de gabarit dans le langage
>    d'expression, précisément ce que l'ADR 0001 refuse »* — sans borne, dans un document
>    au statut « Accepté ». C1 ajoute `concat` : l'argument devient faux tel qu'il est
>    écrit. La **décision** de 0002 (A1 + B1) n'est pas touchée ; c'est la généralité d'un
>    argument de rejet qui doit être resserrée, avec le critère opposable qui la remplace :
>    *un opérateur de l'algèbre ne remplace jamais une **structure** du document.* `concat`
>    compose deux **valeurs** dans une liaison ; il ne prétend pas remplacer
>    `TextSegment[]`, qui reste la structure inline d'un paragraphe.
> 2. **La conséquence « `CURRENT_SCHEMA_VERSION` reste à 1 »** est marquée *révisée par
>    l'ADR 0003*, sans être réécrite.

> **Ne PAS toucher, arbitrage n°4 tranché B :** le §« recommandation non retenue » de
> `core.md` sur les noms à consonance fiscale, et la ligne de risque §6 du README de
> roadmap dont le « Ce qui l'atténue : **Rien pour l'instant** ». Les deux restent vrais
> tels quels — voir [§3.6](#36-les-noms-dopérations--aucun-test-outillé--arbitrage-n°4-tranché-b).

**Pourquoi d'abord.** Le dépôt a procédé ainsi pour 0001 et 0002, et la décision ouverte
n°5 bloque formellement C1 : écrire la première fonction de date avant d'avoir borné le
périmètre, c'est figer l'API des dates avant que la borne existe.

> **Déjà fait par le repositionnement du 2026-08-13, à ne pas refaire :** la moitié
> « horloge » de la décision n°5 est close dans `docs/roadmap/README.md` §8 ; `core.md`
> C1 dit désormais « nombre de jours entre deux dates fournies » ; le hors-périmètre §5
> porte les trois non permanents. **Reste entièrement à faire :** l'ADR 0003, l'amendement
> de l'ADR 0001, la clôture du **bornage des opérations** de date, la clarification
> d'`AGENTS.md` §1.2 et les deux amendements de l'ADR 0002.
>
> ⚠️ **Et à ne PAS faire, contrairement à ce que ce plan disait :** écrire une réserve
> pré-v1.0 dans le docstring de `CURRENT_SCHEMA_VERSION`. La décision a été renversée —
> voir [D9](#d9--schemaversion-passe-à-2-avec-une-migration-identité).

**Tests.** Aucun — les quatre portes passent inchangées sur une modification de
commentaire.
**Commit.** `docs(adr): ADR 0003 — formules, agrégations et dates civiles`

### INC-1 — Une erreur qui désigne l'endroit fautif · **S**

**Fichiers.** ✏️ `errors.ts` (les **deux** catalogues en `as const` et leur union,
`ExpressionErrorDetails` en **union discriminée** — `site` et `at` racine partout,
`actualType` sur la branche opérande, `limit` sur la branche borne ; et le champ **privé**
d'`ExpressionEvaluationError` qui rend `prefix()` possible sans muter un `readonly`) · ➕
**`packages/core/src/expression/value-type.ts`** (`ExpressionValueType`, neuf constantes,
et la fonction qui lit le *tag* d'une valeur sans jamais lire son contenu) ·
✏️ `evaluate.ts` (`fail()` unique site de throw ; **`evaluateWithin`**, le helper qui
préfixe le chemin ; `compare` reçoit le nœud ; **`evaluateSequence` reçoit le site
appelant** ; `describe()` prend désormais un `ExpressionValueType`) · ✏️
`evaluate.test.ts` · ✏️ `index.ts`.

> ⚠️ **`evaluateSequence` n'est pas réutilisable « tel quel ».** Son message est codé en
> dur : `A loop needs a list to iterate over`. Branché sur `aggregate`, `count` et
> `filter`, il dirait **« loup »** à un gestionnaire qui a écrit une somme — un manqué C8
> direct, dans le lot dont C8 dépend. Le test existant n'assert que `/needs a list/`,
> donc la reformulation dérivée du `kind` est sûre.

**Pourquoi maintenant.** La signature d'`ExpressionEvaluationError` change : la faire
changer une fois sur **4 appelants** coûte une heure ; sur trente, un après-midi et une
revue illisible.

> 🚫 **Le test de complétude, écrit naïvement, NE COMPILE PAS à cet incrément.** Le
> catalogue déclare douze codes ; `evaluate.ts` n'a que **quatre sites de levée** à INC-1,
> donc **huit codes sur douze** n'ont aucun producteur avant INC-3, INC-4, INC-6 ou INC-8.
> Un test « chaque code est produit par au moins un cas » rougirait au commit où ce plan
> le fait écrire — et pour deux de ces codes, c'est `type-check` qui tombe avant
> `test:coverage`, parce que `tsconfig.typecheck.json` inclut `src/**/*`.
>
> **Le catalogue reste néanmoins déclaré COMPLET dès INC-1** — C8 doit pouvoir l'énumérer,
> et ajouter un champ requis à une interface publique en cours de lot serait le seul vrai
> coût. Ce qui change, c'est le test : une **partition** contre une constante datée.
>
> ```ts
> /** Codes déclarés dont le producteur arrive plus tard. Chaque incrément en retire les siens. */
> const PENDING_CODES = {
>   'operand-type': 'INC-4', 'division-by-zero': 'INC-4', 'not-finite': 'INC-4',
>   'not-a-date': 'INC-8',
>   'step-limit-exceeded': 'INC-3', 'depth-limit-exceeded': 'INC-3',
>   'item-limit-exceeded': 'INC-6', 'string-limit-exceeded': 'INC-8',
> } as const;
>
> // Deux assertions, et c'est leur CONJONCTION qui fait le travail :
> // (1) produit ∪ dette == catalogue   -> aucun code orphelin
> // (2) produit ∩ dette == ∅           -> aucune dette périmée
> ```
>
> Elle **se vide toute seule** : INC-3 retire ses deux codes de borne, INC-4 les trois
> codes d'arithmétique, INC-6 le sien, INC-8 les deux derniers. Le dernier incrément qui la vide
> **supprime la constante**, et le test exhaustif de la [§7](#7-définition-de-fini)
> apparaît par soustraction. Une dette qu'on oublie de solder fait rougir l'assertion (2) :
> elle ne peut pas pourrir en silence.

**Tests.** Un cas par code **effectivement productible à cet incrément**, avec assertion
sur `code`, `site`, `at` et — la branche opérande étant la seule en jeu ici —
`actualType` ; plus les trois propriétés de `prefix()`
([D7](#d7--la-charge-derreur--trois-champs-une-seule-taxonomie-aucune-donnée-dans-le-message)) ;
plus la partition ci-dessus. Elle interdit deux
dérives symétriques : un code que rien ne produit (C8 promettrait un message pour une
situation impossible) et une levée sans étiquette (C8 n'aurait rien où accrocher un
message). Helper `expectEvaluationError` qui narrowe par `instanceof` — **aucun cast**,
le plugin `no-double-cast` et `noExplicitAny` bloquent l'alternative.
**Commit.** `feat(core)!: donner à ExpressionEvaluationError de quoi désigner l'erreur`

### INC-2 — La couture, à comportement **strictement inchangé** · **L**

**Fichiers.** ✏️ `expression.ts` (`PrintableExpression`/`PredicateExpression` — ensemble
identique à aujourd'hui — les deux liaisons `z.lazy`, `aliasSchema` hissé, `rootSegment`
extrait, `pathsOf` réécrit avec contexte) · ✏️ `nodes.ts` (bloc d'import final §3.3,
`value: PrintableExpression`, `as: aliasSchema`) · ✏️ `visitor.ts` (import de
`rootSegment`, **suppression des lignes locales**) · ✏️ `expression.test.ts` (les trois
gardes §3.5) · ✏️ `nodes.test.ts` · ✏️ `index.ts`.

> 🔑 **Le point non négociable du séquençage.** Les gardes anti-dérive doivent exister
> **avant** qu'il y ait quelque chose à faire dériver, sans quoi le premier kind ajouté
> sans son schéma passe les quatre portes en silence. INC-2 est aussi le seul incrément
> à comportement strictement inchangé : s'il casse un test, c'est le refactor qui est
> faux, pas la conception. C'est un filet qu'aucun autre incrément n'offre.

**À faire une fois, à la main :** retirer temporairement un membre du corps `z.lazy`,
constater que `tsc` reste vert et que le test `SAMPLES` rougit, puis annuler. Le
garde-fou est alors **prouvé, pas supposé**.
**Commit.** `refactor(core): la couture des formules — sous-algèbre imprimable, alias unique, gardes`

### INC-3 — Les trois garde-fous · **M** *(arbitrages n°1 et n°5, tranchés A)*

**Fichiers.** ➕ `packages/core/src/template/guard.ts` (`assertBoundedShape`, scan
**itératif** à pile explicite, donc lui-même insensible à la profondeur ; validation de
`ShapeLimits` et `InvalidShapeLimitsError`) · ➕
`packages/core/src/expression/limits.ts` (`EvaluationLimits`, `createBudget`,
`InvalidEvaluationLimitsError`) · ✏️ `migrate.ts` (appel du garde **en tête de
`parseTemplate` et sur la sortie de la chaîne quand une étape a tourné**) ·
✏️ `evaluate.ts` (**sac d'options**, comptage des pas dans `evaluateWithin`, profondeur
`enter()`/`leave()`) · ✏️ `index.ts` · ✏️ **`biome.jsonc`** ·
➕ **`tools/biome/no-environment-read.grit`** · ✏️ `AGENTS.md`.

> `errors.ts` **n'est pas touché ici** : les douze codes — dont
> `step-limit-exceeded` et `depth-limit-exceeded` — sont déclarés **en entier dès INC-1**.
> INC-3 ne fait que leur donner leurs deux premiers producteurs et retirer leurs deux
> lignes de `PENDING_CODES`.

Retirer aussi la donnée de la branche `never` : `JSON.stringify(exhaustive)` déborde à
~8 000 de profondeur, donc **le garde-fou d'exhaustivité se transforme en second crash**.
Un helper `kindOf(value: unknown): string` suffit — sans cast interdit.

**Le troisième garde-fou, sous mandat explicite du propriétaire — et il tient en DEUX
pièces, pas une.** L'énoncé « un `override` Biome refuse les appels qui lisent la
machine » n'est pas réalisable tel quel, et c'est **vérifié en exécutant Biome 2.5.8** :

| Moyen | Ce qu'il attrape | Ce qu'il ne peut pas faire |
| :--- | :--- | :--- |
| `noRestrictedGlobals` | un **nom** global | il ne connaît QUE des noms : bannir `Date` refuse aussi `new Date('2026-01-01')`, bannir `Intl` refuse aussi `Intl.NumberFormat('fr-FR')` — dont C6 et E4 ont besoin. **Inutilisable ici**, alors que c'est le moyen nommé lors de l'arbitrage |
| `noJsRestrictedProperties` (nursery, ≥ 2.5.6) | un couple **objet/propriété**, y compris la forme calculée `Date['now']()` et la forme déstructurée `const { now } = Date` | il ne regarde **jamais la liste d'arguments** : une entrée `{ "object": "Intl" }` refuse `Intl.NumberFormat('fr-FR')` autant que `Intl.NumberFormat()` |
| **plugin GritQL** `tools/biome/no-environment-read.grit` | tout ce qui se joue **dans la liste d'arguments** : le constructeur `Date`, `Intl.*()` sans locale, et `Intl.DateTimeFormat` sans `timeZone` | rien de sémantique : un alias (`const C = Date; new C()`) lui échappe |

Les deux pièces sont **complémentaires, pas redondantes**. La règle de configuration porte
les interdits de propriété — `Date.now`, `Date.parse`, `Math.random`, `process.env`,
`performance.*`, `globalThis.*`, `toLocale*` et les **neuf getters locaux** de `Date` :
c'est elle, et non le plugin, qui voit `Date['now']()`. Le plugin porte tout ce qui dépend
des **arguments** : c'est lui, et non la règle, qui sait **laisser passer**
`Intl.NumberFormat('fr-FR')` et `Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' })`.

> ⚠️ **Deux trous mesurés dans une version antérieure de ces artefacts, tous deux
> refermés — et la correction porte sur la distinction locale / fuseau.**
>
> **1. Une locale explicite ne suffit pas pour une date.** Le plan laissait passer
> `Intl.DateTimeFormat('fr-FR')` au motif que la locale était fournie. **Vérifié sur
> Biome 2.5.8 : la forme passait effectivement le garde** — or sans option `timeZone`,
> `Intl.DateTimeFormat` lit **le fuseau de la machine**, et `resolvedOptions().timeZone`
> le rend tel quel. Un garde-fou dont la raison d'être est E6 laissait donc entrer la
> lecture d'environnement la plus facile à écrire sans y penser. La règle exacte est en
> deux parties, et elles ne se remplacent pas : **une locale explicite ET un fuseau
> explicite.** Pour une date civile `YYYY-MM-DD`, le fuseau à écrire est `'UTC'` — non
> par préférence, mais parce qu'une date sans heure n'a de représentation stable dans
> aucun autre.
>
> **2. `new Date(y, m, d)` construit en fuseau HÔTE.** Le plugin n'interdisait que
> l'arité zéro, avec le commentaire *« `new Date(value)` stays allowed »* : `new Date(2026,
> 0, 1)` et ses getters locaux passaient. Mesuré, la version corrigée refuse **le
> constructeur `Date` à toutes les arités** — ce que le motif `new Date($args)` couvre
> d'un seul tenant, `$args` matchant la liste entière, y compris vide. C'est réalisable
> parce que `core` et `engine` n'ont **aucun besoin** du constructeur : `civil-date.ts`
> couvre le calendaire, `Date.UTC(…)` reste disponible pour C6 — **vérifié non refusé** —
> et `Intl.*.format()` accepte un nombre d'époque sans qu'aucun `Date` n'ait à exister.

**Mesuré sur les 21 formes du fichier sonde : 14 refus, tous voulus ; 7 acceptations,
aucun faux positif** — dont `Intl.NumberFormat('fr-FR')`, `new Intl.NumberFormat('fr-FR')`,
`Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' })`, son homologue `new`, `Date.UTC(2026,
0, 1)` et `new Map()`, cette dernière prouvant que `new Date($args)` reste ancré sur le
nom. Vérifié aussi avec le `"preset": "recommended"` réel du dépôt, et qu'un quatrième
`override` ne réinitialise **pas** les `noRestrictedImports` des trois premiers — les
gardes d'architecture restent vivants.

> 🔑 **Trois comportements de GritQL vérifiés, contre-intuitifs, et à ne pas redécouvrir.**
> Une **métavariable seule** dans une liste d'arguments matche **la liste entière, y
> compris vide** : `new Date($a)` fire sur `new Date()` comme sur `new Date(2026, 0, 1)`.
> **Deux** métavariables ou plus, en revanche, imposent l'arité **exacte** :
> `new Date($a, $b)` ignore un appel à trois arguments. Et une **liste vide** dans le
> motif impose l'arité zéro : `Intl.$f()` ne touche pas `Intl.NumberFormat('fr-FR')`. Le
> corollaire utile est le troisième : `$args <: not contains \`timeZone\`` sur la liste
> entière exprime « où qu'il soit dans les arguments, le fuseau doit être nommé » — ce
> qu'aucune règle de configuration Biome ne sait dire.

> ⚠️ **Ce qu'il ne faut PAS écrire à la place :** une entrée
> `{ "object": "Intl", "property": "DateTimeFormat" }` dans `noJsRestrictedProperties`.
> Mesuré : elle refuse **aussi** `Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' })`,
> c'est-à-dire la seule forme correcte, et casserait C6 exactement comme
> `noRestrictedGlobals` l'aurait fait. La distinction fuseau est du ressort du plugin, et
> de lui seul.

> 🔑 **Le plugin se déclare DANS l'`override`, pas à la racine.** Un `plugins` d'override
> s'ajoute au `plugins` racine et se borne aux chemins de cet override : les deux plugins
> existants continuent de s'appliquer, et `designer`, `viewer` et `apps/playground`
> gardent le droit d'appeler `new Date()` — ce dont INC-9 a besoin. Déclaré à la racine,
> il ferait rougir le playground.

> ✅ **Mandat élargi, accordé le 2026-08-13.** La solution exige un fichier **neuf** sous
> `tools/biome/`, répertoire que la [§6](#6-ce-qui-ne-se-touche-pas) et AGENTS.md §7
> déclarent intouchables, alors que l'arbitrage n°5 ne visait que `biome.jsonc` — ce plan
> mettait donc l'implémenteur devant un choix impossible : violer §6, livrer un garde-fou
> aveugle à `new Date()`, ou casser C6. Le propriétaire a levé la contradiction : le
> mandat porte sur **deux fichiers** — un `override` dans `biome.jsonc`, et
> `no-environment-read.grit`, **fichier neuf et lui seul**. Les deux plugins existants
> (`no-double-cast`, `no-silent-catch`) ne se touchent pas. Hors de ces deux ajouts,
> AGENTS.md §7 s'applique intégralement.

> ⚠️ **`noJsRestrictedProperties` est une règle *nursery*** — hors versionnement
> sémantique : une montée de Biome peut la renommer ou la retirer **en silence**. La sonde
> jetable ci-dessous doit être rejouée à chaque montée, et le repli, si la règle
> disparaît, est de rapatrier ses entrées dans le plugin, qui appartient au dépôt.

Ce n'est pas la manœuvre qu'AGENTS.md §7 interdit : §7 refuse de **desserrer** une
contrainte pour débloquer une compilation, on en **ajoute** une ici. La PR doit le dire.

**Une fois les deux pièces en place**, la ligne du tableau d'AGENTS.md devient
« **Biome** (`noJsRestrictedProperties` + plugin `no-environment-read`) — *sauf alias,
locale `undefined` explicite et options construites ailleurs, qui restent en revue* ». La
mention « à outiller » disparaît, mais **pas l'aveu du reste** : **cinq** contournements
restent muets et le resteront — l'alias, `Intl.NumberFormat(undefined, opts)`, la diffusion
`Intl.NumberFormat(...args)`, un `timeZone` porté par une variable plutôt que par un
littéral, et toute indirection par une valeur. Une couverture partielle déclarée totale est
exactement le défaut que ce tableau existe pour empêcher.

> Fait de terrain qui rend l'opération indolore : `git grep -nE "new Date|Date\.(now|parse)|Intl\.|toLocale|Math\.random|process\.env|performance\.now|globalThis|get(FullYear|Month|Date|Day|Hours|Minutes|Seconds|Milliseconds|TimezoneOffset)" -- packages/core packages/engine`
> **ne rend rien aujourd'hui**. La règle est verte dès le commit qui l'introduit, sans une
> seule correction préalable — elle est purement préventive, ce qui est le bon moment pour
> la poser.

> 🚫 **Les tests que ce plan demandait ici NE COMPILAIENT PAS.** « Agrégat triplement
> imbriqué » et « `concat` en escalier » supposent des kinds qui n'arrivent qu'à INC-6 et
> INC-8 : `tsc` rend `TS2322: Type '"aggregate"' is not assignable to …`, et comme
> `tsconfig.typecheck.json` inclut `src/**/*`, c'est la porte **`type-check`** qui tombe,
> avant `test:coverage`. Deux des trois compteurs du budget n'ont d'ailleurs à cet
> incrément **aucun code appelant**, pas seulement aucun test.

**Tests, réécrits avec les seuls kinds qui existent à INC-3.** Profondeur 65 refusée avec
un `TemplateShapeError` (`too-deep`) ; profondeur 64 acceptée ; **nombre de nœuds**
dépassé → `too-many-nodes`, éprouvé sur un arbre à **sous-arbres partagés** qui n'atteint
jamais `maxDepth` ; un objet porteur d'un accesseur → `not-plain-data`, avec l'assertion
que le getter **n'a pas été invoqué** ; un objet **cyclique** → `too-deep` et non une
boucle infinie ; le scan ne déborde pas sur 100 000 niveaux ; **une migration jetable qui
approfondit son entrée fait rougir le second passage du garde**, pas Zod. Pour `maxSteps` :
une chaîne de `not` et un `and` large, avec un `maxSteps` **injecté bas**, plus le test de
cumul « deux appels de haut niveau, un seul budget ». Pour `maxDepth` d'évaluation : un
arbre **construit en boucle** (jamais parsé), avec l'assertion que l'erreur est un
`ExpressionEvaluationError` de code `depth-limit-exceeded` portant `limit`, **et non un
`RangeError`**. La configuration invalide (`0`, `-1`, `NaN`, `Infinity`, `1.5`) →
`InvalidEvaluationLimitsError` côté budget, `InvalidShapeLimitsError` côté garde — **les
deux, pas seulement le premier**.

> L'agrégat triplement imbriqué part en **INC-6**, le `concat` en escalier en **INC-8** —
> là où leurs kinds existent. `EvaluationLimits` est en revanche déclarée **entière** dès
> INC-3 : un champ non lu est une donnée, pas une branche, et il ne coûte rien à la
> couverture.

#### Les deux artefacts, vérifiés à l'exécution — à copier, pas à redériver

**(a) Le quatrième `override` de `biome.jsonc`**, ajouté **après** les trois existants :

```jsonc
{
  /* Vérifié : `plugins` déclaré dans un override S'AJOUTE au `plugins` racine — les deux
     plugins existants continuent de s'appliquer ici. Vérifié aussi : ce quatrième
     override ne réinitialise PAS les `noRestrictedImports` des trois premiers.
     `noJsRestrictedProperties` est une règle NURSERY : hors versionnement sémantique,
     une montée de Biome peut la renommer ou la retirer. Rejouer la sonde à chaque montée. */
  "includes": ["packages/core/**", "packages/engine/**"],
  "plugins": ["./tools/biome/no-environment-read.grit"],
  "linter": {
    "rules": {
      "nursery": {
        "noJsRestrictedProperties": {
          "level": "error",
          "options": {
            "entries": [
              { "object": "Date", "property": "now", "message": "Date.now() reads the host clock, so two renders of one template cannot produce the same document (E6). The render date is data the integrator supplies, under whatever name it chooses." },
              { "object": "Date", "property": "parse", "message": "Date.parse() is only specified for the ISO form; anywhere else its result is engine-dependent. Use civil-date.ts." },
              { "object": "Math", "property": "random", "message": "Math.random() makes a render irreproducible (E6)." },
              { "object": "process", "property": "env", "message": "process.env makes the render depend on the execution environment (E6)." },
              { "object": "performance", "message": "performance.now() is a clock, exactly like Date.now()." },
              { "object": "globalThis", "message": "globalThis.* is the back door to every global refused above. Deliberately broader than it needs to be: core and engine reference no global through it today, so the entry costs nothing. If a deterministic use ever appears, name it in the PR rather than widening the rule." },
              { "property": "getFullYear", "message": "The local Date getters read the host time zone: the same instant yields a different civil date in Auckland and in Los Angeles (E6). Use getUTC*, or civil-date.ts, which needs no Date at all." },
              { "property": "getMonth", "message": "The local Date getters read the host time zone (E6). Use getUTC*, or civil-date.ts." },
              { "property": "getDate", "message": "The local Date getters read the host time zone (E6). Use getUTC*, or civil-date.ts." },
              { "property": "getDay", "message": "The local Date getters read the host time zone (E6). Use getUTC*, or civil-date.ts." },
              { "property": "getHours", "message": "The local Date getters read the host time zone (E6). Use getUTC*, or civil-date.ts." },
              { "property": "getMinutes", "message": "The local Date getters read the host time zone (E6). Use getUTC*, or civil-date.ts." },
              { "property": "getSeconds", "message": "The local Date getters read the host time zone (E6). Use getUTC*, or civil-date.ts." },
              { "property": "getMilliseconds", "message": "The local Date getters read the host time zone (E6). Use getUTC*, or civil-date.ts." },
              { "property": "getTimezoneOffset", "message": "getTimezoneOffset() IS the host time zone (E6)." },
              { "property": "toLocaleString", "message": "toLocale* falls back to the host locale, and for a date to the host time zone as well. This ban is an over-approximation: it also refuses value.toLocaleString('fr-FR'), which does carry a locale -- the rule cannot see an argument list. Nothing is lost, because C6 formats through Intl.NumberFormat(locale) and Intl.DateTimeFormat(locale, { timeZone }), both of which stay allowed and say what they read." },
              { "property": "toLocaleDateString", "message": "toLocale* falls back to the host locale and, for a date, to the host time zone. Over-approximated on purpose: use Intl.DateTimeFormat(locale, { timeZone: 'UTC' }), which the plugin lets through." },
              { "property": "toLocaleTimeString", "message": "toLocale* falls back to the host locale and, for a date, to the host time zone. Over-approximated on purpose: use Intl.DateTimeFormat(locale, { timeZone: 'UTC' }), which the plugin lets through." },
              { "property": "toLocaleUpperCase", "message": "toLocale* reads the host locale, and toUpperCase() is what INC-8 mandates instead." },
              { "property": "toLocaleLowerCase", "message": "toLocale* reads the host locale, and toLowerCase() is what INC-8 mandates instead." }
            ]
          }
        }
      }
    }
  }
}
```

**(b) `tools/biome/no-environment-read.grit`** — fichier neuf, exécuté et vérifié :

```grit
// Enforces AGENTS.md, "Ce qu'Openview n'est pas": core and engine never read the machine.
//
// Everything that depends on the ARGUMENT LIST lives here, because no Biome rule reasons
// about arguments. Verified on 2.5.8:
//   - `noRestrictedGlobals` knows names only, so denying `Intl` also denies
//     `Intl.NumberFormat('fr-FR')`, which lot C6 and lot E4 need.
//   - `noJsRestrictedProperties` matches an object/property pair and never an argument
//     list, so an `{ "object": "Intl", "property": "DateTimeFormat" }` entry fires on the
//     one correct spelling, `Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' })`, too.
//
// Everything that is a plain property ban -- Date.now, Date.parse, Math.random,
// process.env, performance.*, globalThis.*, toLocale*, the nine local Date getters --
// stays in biome.jsonc. That rule, not this plugin, catches the computed spelling
// Date['now']() and the destructured spelling const { now } = Date.
//
// TWO DISTINCTIONS THIS FILE EXISTS FOR:
//   1. LOCALE. `Intl.X()` with no argument falls back to the host locale.
//   2. TIME ZONE. A locale is NOT enough for a date: `Intl.DateTimeFormat('fr-FR')`
//      formats in the host zone, and resolvedOptions().timeZone hands it back. A civil
//      date YYYY-MM-DD has no stable rendering in any zone but an explicit one.
// The `Date` constructor is refused at EVERY arity, not just the empty one: `new Date()`
// reads the clock and `new Date(2026, 0, 1)` reads the zone. core and engine need none
// of it -- civil-date.ts covers the calendar, `Date.UTC(...)` stays available (verified
// not refused), and Intl formatters accept an epoch number with no Date in sight.
//
// GRITQL BEHAVIOUR, VERIFIED, because none of it is obvious:
//   - ONE metavariable in an argument list matches THE WHOLE LIST, empty included:
//     `new Date($args)` fires on `new Date()` and on `new Date(2026, 0, 1)` alike.
//   - TWO OR MORE metavariables pin the arity exactly: `new Date($a, $b)` skips a
//     three-argument call. That is why the whole-list form is the one used here.
//   - An EMPTY list in the pattern pins arity zero: `Intl.$f()` leaves
//     `Intl.NumberFormat('fr-FR')` alone.
//   - `new Date` without parentheses is a DISTINCT node; `new Date($args)` does not
//     cover it, hence its own branch.
//
// KNOWN GAPS, barred by review and not by this plugin, all verified silent:
//   - aliasing: `const Clock = Date; new Clock();`
//   - an explicitly undefined locale: `Intl.NumberFormat(undefined, options)`
//   - a spread argument list: `Intl.NumberFormat(...args)`
//   - a timeZone passed through a variable: `Intl.DateTimeFormat(l, opts)` where `opts`
//     is built elsewhere. The matcher sees the identifier, not its value.
//   - any indirection through a value the matcher cannot follow.
language js(typescript)

or {
  `new Date($args)` as $clock where {
    register_diagnostic(span=$clock, message="The `Date` constructor reads the machine in core/engine: `new Date()` reads the clock, and `new Date(2026, 0, 1)` reads the host time zone -- so two renders of one template cannot produce the same document (AGENTS.md: no environment read in core/engine, roadmap E6). Use civil-date.ts for calendar work, take the render date from the scope, and `Date.UTC(...)` if you need an instant.", severity="error")
  },
  `new Date` as $clock where {
    register_diagnostic(span=$clock, message="`new Date` reads the host clock, so two renders of one template cannot produce the same document (AGENTS.md: no environment read in core/engine, roadmap E6). Take the date from the render scope; use civil-date.ts for calendar work.", severity="error")
  },
  `Intl.$formatter()` as $icu where {
    register_diagnostic(span=$icu, message="`Intl.*` called with no argument falls back to the host locale, which is an environment read (AGENTS.md). Pass the locale the template declares: `Intl.NumberFormat('fr-FR')` stays allowed.", severity="error")
  },
  `new Intl.$formatter()` as $icu where {
    register_diagnostic(span=$icu, message="`new Intl.*` called with no argument falls back to the host locale, which is an environment read (AGENTS.md). Pass the locale the template declares: `new Intl.NumberFormat('fr-FR')` stays allowed.", severity="error")
  },
  `Intl.DateTimeFormat($args)` as $zone where {
    $args <: not contains `timeZone`,
    register_diagnostic(span=$zone, message="`Intl.DateTimeFormat` without an explicit `timeZone` formats in the HOST time zone, even when the locale is explicit: the same instant prints two different civil dates in Auckland and in Los Angeles (roadmap E6). A locale says how to spell it, not which day it is. Pass both: `Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' })`.", severity="error")
  },
  `new Intl.DateTimeFormat($args)` as $zone where {
    $args <: not contains `timeZone`,
    register_diagnostic(span=$zone, message="`new Intl.DateTimeFormat` without an explicit `timeZone` formats in the HOST time zone, even when the locale is explicit (roadmap E6). Pass both: `new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' })`.", severity="error")
  }
}
```

**Pour les deux pièces Biome**, la vérification n'est pas un test unitaire mais une **sonde
jetable**, et elle a **deux moitiés d'égale importance**. Doivent faire **rougir**
`pnpm run lint` dans `packages/core/src` : `new Date()`, `new Date('2026-01-01')`,
`new Date(2026, 0, 1)`, `Intl.NumberFormat()`, `Intl.DateTimeFormat('fr-FR')`,
`Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' })`, `d.getFullYear()`,
`(5).toLocaleString('fr-FR')`. Doivent rester **verts** : `Intl.NumberFormat('fr-FR')`,
`Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' })`, leurs homologues `new`,
`Date.UTC(2026, 0, 1)` et `new Map()`. **C'est cette seconde moitié qui prouve qu'on n'a
cassé ni C6 ni E4** — et la dernière ligne, qu'un motif ancré sur `Date` ne déborde pas sur
les autres constructeurs. Puis supprimer la sonde.
**Commit.** `feat(core): borner la forme d'un modèle et le travail d'une formule`
**Second commit, séparé, parce qu'il touche deux fichiers protégés :**
`chore(tooling): interdire la lecture d'environnement dans core et engine`

### INC-4 — Nombres : les quatre opérations et le pourcentage · **M**

`arithmetic` (binaire, comme `compare` : `sub`/`div` ne sont pas associatifs, et deux
champs nommés n'exigent aucune garde sous `noUncheckedIndexedAccess`) et `percentOf`.
**Les parenthèses sont gratuites** : l'imbrication *est* la parenthèse, il n'y a ni
précédence ni parseur.

**Tests.** Les quatre opérations · `(a+b)*c` par imbrication · diviseur **présent** à 0
→ `division-by-zero` à `['right']`, explicitement distingué du diviseur **absent** qui
propage · `'2' * 1` → `operand-type` (là où JavaScript rendrait 2) · `true + 1` →
`operand-type` · NaN venu de la donnée → **`not-finite`** à l'entrée · `1e308 * 10` →
`not-finite` **à la sortie** — **le même code aux deux bouts**, et le test doit le dire
explicitement, sans quoi la politique unique de
[D6](#d6--les-cinq-politiques-derreur-que-le-dépôt-ne-tranchait-nulle-part) se re-fracture
au premier copier-coller · `percentOf(1500, 20) = 300` · **`div(1, 3)` rend
`0.3333333333333333`, pas une valeur tronquée** — ce dernier est le plus important à
conserver dans le temps : il interdit qu'un futur contributeur « arrange » la division
pour faire joli, ce qui serait une position d'arrondi de fait.
**Commit.** `feat(core): les quatre opérations et le pourcentage dans l'algèbre d'expressions`

### INC-5 — Condition dans la formule · **S**

`if` avec `whenTrue`/`whenFalse` **requis**. Le `when` passe par `evaluatePredicate` —
c'est ce qui interdit la truthiness ici comme ailleurs — mais le nœud rend une **valeur**,
donc il reste dans `evaluateExpression`.

**Le court-circuit est une règle de correction, pas une optimisation :** `and`/`or`
court-circuitent déjà, donc un auteur de modèle suppose légitimement que le « si » le
fait aussi, et la surprise se paierait en division par zéro sur une branche non prise.

**Test qui compte.** `if(qty > 0, div(total, qty), 0)` avec `qty = 0` rend `0` **et ne
lève pas** — c'est le seul test du lot qui échoue si l'implémentation est écrite
« naturellement » (évaluer les deux branches puis choisir).
**Commit.** `feat(core): un si… alors… sinon à l'intérieur d'une formule`

### INC-6 — Agrégations, filtre et compte · **L**

`aggregate`, `count`, `filter`. `where` passe par `evaluatePredicate` : **pas de
truthiness dans un filtre non plus**. `min`/`max` par `reduce`, **jamais**
`Math.min(...values)` : 60 000 lignes débordent la pile.

`visitor.ts` : **aucun changement de code**, une seule ligne de docstring —
`collectDataPaths` gagne une **troisième limite** : un alias d'expression qui masque une
clé de l'appelant (`sum(invoice.lines, invoice, invoice.total)`) produit le même trou
silencieux que le masquage d'alias de boucle. Documentée et non corrigée, pour la même
raison que les deux autres — mais **la laisser non écrite recommencerait exactement le
défaut que l'ADR 0002 reproche à l'ancienne docstring : « elle promet, elle ment »**.

> ⚠️ **Ne pas élargir `NodeReads.binds` en tableau par réflexe.** L'alias d'un
> `aggregate`/`filter` est confiné à son sous-arbre ; l'élargir ferait fuiter l'alias
> vers des enfants qui n'ont aucun droit de le lire, et les trois `toStrictEqual` de
> `visitor.test.ts:119-147` casseraient pour la mauvaise raison.

**Tests.** Les quatre opérateurs sur des lignes dont le montant est **lui-même un
calcul** · liste vide (`sum` 0, `avg`/`min`/`max` absence) · source absente = liste vide
· source non-liste → `not-a-list` **avec le vocabulaire de l'opérateur appelant** ·
valeur d'élément absente ignorée, `avg` divise par les présentes · valeur mal typée →
`operand-type` à `['value', 1]` — **un nombre, pas la chaîne `'1'`**, et le chemin part de
la racine · un agrégat **triplement imbriqué** → `item-limit-exceeded` en temps borné
(le test déplacé depuis INC-3) · l'ordre d'accumulation d'une somme, épinglé ·
`count(filter(…))` · `filter` en `LoopNode.each` sans avoir retypé le nœud · 60 000
éléments sans `RangeError` · **l'alias ne fuit jamais jusqu'à `collectDataPaths`**.
**Commit.** `feat(core): agrégations, filtre et compte sur une liste`

### INC-7 — Le module de date civile, pur · **M**

➕ `civil-date.ts` **et** ➕ `civil-date.test.ts` — le test est obligatoire, pas
optionnel : mesuré, couvert **uniquement** à travers l'évaluateur, le module tombe à
**91,3 % de branches**, une seule branche de marge au-dessus du plancher de 90 %, et
`shiftDay` n'exerce ni `Number.isSafeInteger` faux ni le débordement de plage.

**Tests.** Aller-retour `parse`/`format` sur une plage large (la **propriété**, pas trois
exemples) · bissextiles 2024/2025/2000/1900 · `endOfMonth` **en décembre** (la branche
non couverte) · bornes `0001-01-01` et `9999-12-31` · année < 1000 · refus de
`'2026-13-01'`, `'2026-02-30'`, `'2026-1-5'`, `'20260105'`, `' 2026-01-05'`,
`'2026-01-05T00:00:00Z'`, `'0000-01-01'`, `''`.

> Le module reste inutilisé pendant **exactement un commit** : c'est le prix pour que
> l'incrément des dates ne mêle pas l'algorithme calendaire et cinq nouveaux kinds dans
> la même revue.

**Commit.** `feat(core): une arithmétique de date civile pure, sans horloge ni fuseau`

### INC-8 — Textes et dates · **L**

`concat`, **`text`**, `textCase`, `dateAdd`, `dateDiff`, `endOfMonth`.

> ⚠️ **`dayOperand` reçoit le `kind` du nœud appelant, jamais `'dateAdd'` codé en dur.**
> C'est l'erreur de copier-coller la plus probable du lot, et elle passe les quatre
> portes en désignant le mauvais opérateur à l'utilisateur — exactement ce que C8 doit
> éviter. **Le test doit porter sur `dateDiff`, pas seulement sur `dateAdd`.**

`toUpperCase`/`toLowerCase`, **jamais** `toLocaleUpperCase` : la variante locale dépend
d'ICU et casse E6.

> ⚠️ **`textCase` est le seul endroit de tout C1 où E6 tient par convention plutôt que
> par spécification** — arbitrage n°3, tranché A, avec cette réserve **écrite dans
> l'ADR 0003**. Mesuré : `'ß'.toUpperCase()` rend `"SS"`, un caractère devient deux,
> **la longueur change** — donc la mise en page, donc la pagination. Ce n'est pas un cas
> de laboratoire : une raison sociale allemande suffit. `toUpperCase` est spécifié, mais
> **indexé sur la version d'Unicode du moteur**. La réserve s'outille par des **vecteurs
> de test figés** — `ß`, `ﬀ`, `İ`, plus du latin accentué — dont les attendus sont
> écrits en dur : le jour où une montée de Node change un résultat, c'est le test qui le
> dit, pas une facture.

Ce lot livre aussi **`text(value)`** (arbitrage n°2, tranché A), la mise en chaîne
explicite qui rend `concat('N° ', text(cmd.numero))` écrivable sans réintroduire la
moindre coercion. Sa branche d'évaluation est en [§3.1](#31-packagescoresrcexpressionexpressionts).

> 🔑 **C'est ici que `maxStringLength` devient une borne au lieu d'un champ.** Les trois
> kinds producteurs de texte — `concat`, `textCase`, `text` — appellent
> `budget.acceptString(resultat.length)` **après chaque construction** et lèvent
> `string-limit-exceeded` par `fail()` au refus. `concat` est le cas qui compte
> ([D8](#d8--le-bornage--ce-que-c1-doit-rendre-possible-pour-e8) : profondeur 18 → 268 Mo
> de chaîne), mais les trois passent par la même porte, sans quoi la borne se contourne
> par `upper(concat(…))`.

**Tests.** `concat` de deux et trois parts · partie absente → propagation · **nombre →
`operand-type`** (le collage n'est pas un `+` surchargé) · 100 000 caractères ·
**le `concat` en escalier** (le test déplacé depuis INC-3) avec un `maxStringLength`
**injecté bas** → `string-limit-exceeded` portant `limit`, **en mémoire bornée** — c'est la
vérification par la borne, pas par le crash · la même borne atteinte par `upper(concat(…))`
et par `text(…)`, prouvant que les trois portes sont fermées ·
`text(1234)` → `'1234'`, **sans séparateur de milliers** — la preuve qu'aucun format ne
s'est glissé dans C1 · `text('déjà du texte')` inchangé · `text(true)`, `text([1,2])` et
`text({})` → `operand-type` · `text(absent)` → `undefined` · `upper`/`lower` sur chaîne
accentuée · **les vecteurs Unicode figés ci-dessus** · `dateAdd('2026-01-31', 30) =
'2026-03-02'` · `dateDiff` positif et négatif · `endOfMonth(dateAdd('2026-01-20', 45)) =
'2026-03-31'` · décalage non entier → `operand-type` · **la date de rendu lue comme une
clé de la portée**, prouvée en changeant sa valeur et en observant le résultat changer.
**Commit.** `feat(core): concaténation, casse et dates civiles dans l'algèbre d'expressions`

### INC-8bis — L'estampille de schéma · **S**

**Le premier commit publiable du lot** — voir
[D9, « Où l'estampille se pose »](#où-lestampille-se-pose--et-pourquoi-une-seule-fois). Il
ne se fusionne qu'**après INC-4, INC-5, INC-6 et INC-8**, c'est-à-dire après la dernière
forme persistée de C1, parce que le numéro `2` doit désigner l'algèbre **complète** et non
l'état d'une branche un mardi.

**Fichiers.** ✏️ `packages/core/src/template/template.ts` (`CURRENT_SCHEMA_VERSION`
passe à **2** ; le docstring dit ce que la version 2 signifie — *les 18 kinds de C1* — et
non « la version courante ») · ✏️ `packages/core/src/template/migrate.ts` (l'entrée
`1 → 2` de [D9](#d9--schemaversion-passe-à-2-avec-une-migration-identité), avec son
docstring) · ✏️ `packages/core/src/template/migrate.test.ts` (**composer
`[...chain, ...TEMPLATE_MIGRATIONS]`** au lieu de la chaîne synthétique seule).

> 🚫 **Sans le correctif de `migrate.test.ts`, la quatrième porte rougit — mesuré, et dans
> les DEUX cas**, avec migration comme sans : `No migration registered from schema version
> 1. The upgrade chain to 2 is broken.` Ce n'est pas un dommage collatéral, c'est la preuve
> que le versionnement était **déjà outillé** ; le test fait son travail, il faut lui donner
> la vraie chaîne.

**Tests.** Un document v1 (le littéral de `evaluate.test.ts`, laissé intact) traverse
`parseTemplate` **et en ressort estampillé 2** · un document v2 portant un kind de C1 parse
· un document estampillé `3` rend un `TemplateMigrationError` nommant les deux versions ·
la migration ne modifie **rien d'autre** que `schemaVersion`, épinglé par un `toStrictEqual`
sur le reste de l'objet.
**Commit.** `feat(core)!: estampiller le contrat de formules en schemaVersion 2`

### INC-9 — Le playground démontre le jalon · **M**

Sept sections, dont : le montant de ligne **calculé** (aucun montant n'est fourni par
`renderData` — c'est le point) ; les quatre montants (total HT, remise, reste à payer,
prix moyen en division gardée) ; échéance, « 45 jours fin de mois » et jours de retard ;
`count(filter(…))` ; et une section **« refus compréhensible »** qui évalue volontairement
une formule fautive dans un `try/catch` narrowé par `instanceof` et affiche
`details.code`, **`details.site`** et `details.at` — l'avant-goût de C8. Le champ s'appelle
`site` et non `kind` depuis
[D7](#d7--la-charge-derreur--trois-champs-une-seule-taxonomie-aucune-donnée-dans-le-message) :
`LoopNode.each` et `ConditionNode.when` portent une expression sans être des expressions,
donc `ExpressionKind` ne suffisait pas.

La section « Données requises » doit montrer qu'**aucun alias** (`line`, `l`) n'y figure.

> Le playground est le **seul consommateur réel du barrel** : c'est lui qui révèle un
> export oublié dans `index.ts`, angle mort des quatre portes côté core. Raison pour
> laquelle il est dernier.

Règle de tenue héritée du commit `4661a8a` : **le playground tombe plutôt que de
dégrader**. Aucun repli, aucun `?? 0`, aucun catch silencieux hors de la section 6 où le
catch **est** la démonstration.

Clôture : ADR 0003 passe en 🟢 avec ses liens d'implémentation.
**Commit.** `feat(playground): une facture qui calcule son total, sa remise et son échéance`

---

## 5. Séquençage, parallélisation, point de coupe

```
INC-0 (ADR) → INC-1 (erreur) → INC-2 (couture) → INC-3 (bornes)
                                      ├─→ INC-4 (nombres) → INC-5 (si) ─┐
                                      ├─→ INC-6 (agrégations) ──────────┤
                                      └─→ INC-7 (dates pures) → INC-8 ──┤
                                                                        ▼
                                                        INC-8bis (estampille v2)
                                                                        ▼
                                                            INC-9 (playground)
```

**INC-8bis est un point de rendez-vous, et c'est sa seule contrainte forte** : il attend
les **trois** branches, parce qu'estampiller `2` avant la dernière forme persistée ferait
mentir le numéro. C'est aussi le premier commit publiable du lot.

**INC-4 à INC-8 ne sont PAS tous indépendants**, contrairement à ce que ce plan a d'abord
écrit : le graphe ci-dessus porte lui-même deux arêtes — **INC-4 → INC-5** (le test de
court-circuit `if(qty > 0, div(total, qty), 0)` a besoin de la division) et
**INC-7 → INC-8** (les cinq kinds de date ont besoin du module civil). Les deux chaînes
`INC-4 → INC-5` et `INC-7 → INC-8` sont en revanche **indépendantes l'une de l'autre**, et
INC-6 est indépendant des deux. Points de collision :
les deux corps `z.lazy`, le `switch` d'`evaluateExpression`, le `Record SAMPLES` — tous
en ajout pur, conflit git mécanique et sans piège. INC-6 revient à qui a fait INC-2 (le
contexte d'alias de `pathsOf` en tête).

> **Un kind ne peut pas être séparé de son évaluation.** Les deux branches `never`
> refusent de compiler tant que le `case` manque : un commit « types seulement » ne passe
> pas `type-check`. C'est une contrainte du dépôt, pas un choix de découpage.

**Point de coupe, du plus sacrifiable au moins.** Le critère « prêt quand » de C1 nomme
quatre choses (total de lignes, remise, reste à payer, échéance) plus « une formule
fautive refusée avec un message qui désigne l'erreur ». Tout ce qui n'y figure pas est
coupable, dans cet ordre :

1. La section « refus » du playground se réduit à un exemple au lieu de deux.
2. **`endOfMonth`** — la seule opération de date que le critère de fin ne nomme pas. Un
   kind, un schéma, un case, six tests : la coupe la moins chère du lot.
3. **`textCase`** — la roadmap le nomme, mais aucun montant n'en dépend, et il se
   rattrape en un commit ultérieur sans migration.
4. **`filter`** — coupe **douloureuse**, en dernier recours. Sans lui il faudra plus tard
   soit l'ajouter (facile, additif), soit avoir cédé sur un `where?` optionnel (coûteux,
   et alors définitif). **Mieux vaut décaler le lot d'un jour que de choisir
   l'optionnel.**

**Ne se coupe jamais :** INC-0 (sinon le code contredit la décision écrite dès le premier
lot), les gardes d'INC-2 (sinon le seul défaut sans signal du lot devient permanent), la
charge d'erreur d'INC-1 (sinon C8 sera à rétrofiter sur trente appelants), **INC-8bis**
(sinon le lot ne produit aucun commit publiable et D9 n'aura servi à rien), et la
politique numérique **écrite** — la laisser implicite ferait découvrir l'écart d'un
centime en C2, lot « jamais reporté ».

> **Une coupe déplace l'estampille, elle ne la supprime pas.** Couper `endOfMonth`,
> `textCase` ou `filter` retire des kinds de l'algèbre : INC-8bis se fusionne alors après
> ce qui **reste**, et le docstring de `CURRENT_SCHEMA_VERSION` énumère ce que la version 2
> contient réellement. Un numéro de schéma qui promet des formes non livrées est pire
> qu'un numéro non incrémenté.

---

## 6. Ce qui ne se touche pas

| Fichier | Consigne |
| :--- | :--- |
| `README.md` | **Ne pas modifier.** La section « Calculs, conformité et responsabilité » nomme déjà l'addition, l'agrégation, les conditions et l'échéance dans le périmètre. La clause couvre C1 telle qu'elle est écrite |
| `packages/core/package.json` | **Ne pas modifier.** Aucune dépendance : ni bibliothèque décimale, ni `date-fns`, ni polyfill Temporal |
| `packages/core/src/template/migrate.ts` | **Deux ajouts, dans deux incréments distincts** : les appels à `assertBoundedShape` — avant la chaîne **et** après elle si une étape a tourné — en [INC-3](#inc-3--les-trois-garde-fous--m-arbitrages-n°1-et-n°5-tranchés-a) ; **l'entrée de migration 1 → 2** en [INC-8bis](#inc-8bis--lestampille-de-schéma--s) et **pas avant** ([D9](#où-lestampille-se-pose--et-pourquoi-une-seule-fois)). L'ancienne consigne « `TEMPLATE_MIGRATIONS` reste vide » est **annulée** : sa justification — « une migration fantôme passerait les quatre portes en silence » — a été mesurée fausse |
| `packages/core/src/template/template.ts` | **Deux modifications, deux incréments** : le docstring seul en [INC-0](#inc-0--ladr-0003-et-les-textes-quelle-rend-faux--m) ; `CURRENT_SCHEMA_VERSION` **passe à 2** en [INC-8bis](#inc-8bis--lestampille-de-schéma--s), jamais dans un incrément qui ajoute une forme |
| `tsconfig*.json`, `tools/biome/*.grit`, `turbo.json`, `vitest.config.ts`, `.github/workflows/*`, `sonar-project.properties`, `pnpm-workspace.yaml` | **AGENTS.md §7.** Si `noUncheckedIndexedAccess` bloque un helper d'agrégation, la réponse est une garde ou `.at()` vérifié, **jamais** un desserrage. Si le seuil de couverture tombe, la réponse est un test, **jamais** un seuil abaissé |
| `biome.jsonc` | **Une seule modification autorisée, sous mandat explicite du propriétaire** (arbitrage n°5) : l'ajout d'un **quatrième** `override` portant `noJsRestrictedProperties` et déclarant le plugin, décrit en [INC-3](#inc-3--les-trois-garde-fous--m-arbitrages-n°1-et-n°5-tranchés-a). Rien d'autre. Aucune règle **assouplie**, aucun `override` existant retouché |
| `tools/biome/*.grit` | **Un seul ajout autorisé — mandat élargi accordé le 2026-08-13** : le fichier **neuf** `no-environment-read.grit`, sans lequel la règle est aveugle à `new Date()` ou casse C6. Les deux plugins existants (`no-double-cast`, `no-silent-catch`) **ne se touchent pas**. Hors de cet ajout, AGENTS.md §7 s'applique intégralement |
| `packages/engine/`, `packages/designer/` | Le *ripple* est de conception, pas de code : E1 évaluera ces formules, E6 devra honorer les choix numériques et calendaires figés ici, D7 éditera ces kinds — ce qui est la raison des champs nommés et de l'arité fixe |

---

## 7. Définition de fini

- Les quatre portes passent en local **à chaque commit**, pas seulement au dernier :
  ```bash
  pnpm run lint && pnpm run build && pnpm run type-check && pnpm run test:coverage
  ```
- Couverture ≥ 90 % sur les quatre métriques pour `packages/core/src/**`, **sans qu'aucun
  seuil ni aucune exclusion n'ait été touché**.
- `git grep -n "as unknown as\|@ts-ignore\|@ts-expect-error" packages/core/src` ne rend
  rien de nouveau, et aucun `!` d'assertion non nulle n'a été ajouté.
- `git grep -n "new Date\|Intl\.\|toLocale" packages/core/src` **ne rend rien** — et
  cette fois **une machine le vérifie en partie** : les deux pièces d'INC-3 sont en place,
  une sonde `new Date()` fait rougir `pnpm run lint`, une sonde `new Date('2026-01-01')`
  et une sonde `Intl.NumberFormat('fr-FR')` **restent vertes**, et la ligne du tableau
  d'AGENTS.md nomme la règle **et ses quatre angles morts** au lieu de dire « à outiller ».
- `CURRENT_SCHEMA_VERSION` vaut **2**, `TEMPLATE_MIGRATIONS` porte l'entrée `1 → 2`, et
  `migrate.test.ts` compose `[...chain, ...TEMPLATE_MIGRATIONS]` — les trois **dans le
  même commit**, celui d'INC-8bis, et après la dernière forme persistée.
- Un document estampillé `2` ouvert par un build antérieur rend
  `TemplateMigrationError`, **pas** `Invalid input` — vérifié à la main une fois.
- Aucun message d'erreur ne contient de valeur de rendu, et le **type** l'interdit :
  `describe()` prend un `ExpressionValueType`, jamais un `unknown`.
- Deux appels de haut niveau partageant un budget lèvent `step-limit-exceeded` : le cumul
  est prouvé, pas supposé.
- Le garde de forme refuse un accesseur **sans l'invoquer**, et termine sur un cycle.
- `packages/core/package.json` inchangé ; `pnpm-workspace.yaml` sans dérogation nouvelle.
- `biome.jsonc` ne porte **qu'un ajout** : l'`override` d'INC-3. Aucune règle assouplie.
- **Retirer temporairement un membre du corps `z.lazy` fait rougir la suite** (à vérifier
  une fois à la main, puis annuler).
- `nodes.test.ts` « rejects a predicate expression in a print position » est **vert sans
  avoir été modifié**, et son équivalent pour `filter` existe.
- Chaque code de `EXPRESSION_ERROR_CODES` est produit par au moins un cas de test, et
  chaque levée porte un **code**, un **site**, un **chemin** — puis un `actualType` si
  c'est un code d'opérande, un `limit` si c'est un code de borne. `PENDING_CODES` a
  **disparu du fichier**, pas seulement vidé.
- **Aucun message d'erreur ne contient une valeur issue des données de rendu.**
- Aucun nom d'opérateur ni de kind ne désigne une **règle** plutôt qu'une **opération**.
  Rien ne le vérifie : c'est un point de revue, et c'est assumé (arbitrage n°4, §3.6).
- `collectDataPaths`, sur un template contenant un agrégat et un filtre imbriqués dans
  une boucle, **ne rend aucun alias**.
- Le playground affiche les quatre montants, l'échéance, les jours de retard, le nombre
  de lignes remisées et un refus lisible.
- L'ADR 0003 est en statut accepté avec ses liens ; l'ADR 0001 ne la contredit plus ; la
  décision ouverte n°5 est fermée ; le docstring de `template.ts` ne dit plus le
  contraire de l'ADR 0002 ; `docs/roadmap/core.md` et le risque §6 du README de roadmap
  sont à jour.
- **Un modèle écrit avant ce lot parse toujours** — désormais **par la migration 1 → 2**,
  et non « sans migration » comme l'écrivait une version antérieure de cette liste : D9 a
  été renversée, la chaîne n'est plus vide. Vérifiable avec le littéral de template de
  `evaluate.test.ts`, laissé intact, qui ressort estampillé `2` sans qu'aucun autre champ
  ait bougé.

---

## 8. Les cinq arbitrages, tranchés

Décidés par le propriétaire du produit le **2026-08-13**. Ils ne sont plus ouverts : ce
qui suit est le relevé, pour que l'ADR 0003 le reprenne et que personne ne les rejoue.

| # | Question | Décision | Ce que ça change dans ce plan |
| :-- | :--- | :--- | :--- |
| **1** | Les bornes de sûreté : dans C1, ou déportées en E8 ? | **A — dans C1** | [INC-3](#inc-3--les-trois-garde-fous--m-arbitrages-n°1-et-n°5-tranchés-a) est confirmé et n'est plus conditionnel : `assertBoundedShape` au parsing, et un **budget partagé** — passé dans un **sac d'options**, pas en 3ᵉ paramètre positionnel — à défauts **actifs**. La forme a été corrigée deux fois depuis l'arbitrage, jamais le fond : un paramètre positionnel ne portait pas `caller`, et une configuration seule ne cumule rien ([D8](#d8--le-bornage--ce-que-c1-doit-rendre-possible-pour-e8)) |
| **2** | `concat` refuse les nombres. Faut-il un kind `text(value)` ? | **A — refus strict + `text()` explicite** | L'algèbre passe à **18 kinds**, `PrintableExpression` à 13. Voir [D1](#d1--lalgèbre-reste-close-et-structurée-elle-passe-de-6-à-18-kinds) et [§3.1](#31-packagescoresrcexpressionexpressionts) |
| **3** | `concat` et `textCase` restent-ils dans C1 ? | **A — les deux, réserve E6 écrite** | Livrés en [INC-8](#inc-8--textes-et-dates--l), avec des **vecteurs Unicode figés** (`ß`, `ﬀ`, `İ`) et la réserve consignée dans l'ADR 0003 |
| **4** | Outiller l'interdiction des noms à consonance fiscale ? | **B — clause du README seule** | Le test outillé **sort du plan**. Voir [§3.6](#36-les-noms-dopérations--aucun-test-outillé--arbitrage-n°4-tranché-b). `core.md` et le risque §6 du README de roadmap **ne bougent pas** |
| **5** | Outiller l'interdiction de lire la machine dans `core`/`engine` ? | **A — oui, mandat accordé, sur le RÉSULTAT et non sur le moyen** | Troisième garde-fou d'[INC-3](#inc-3--les-trois-garde-fous--m-arbitrages-n°1-et-n°5-tranchés-a), en **commit séparé**. ⚠️ Le moyen nommé lors de l'arbitrage — `noRestrictedGlobals` — **ne convient pas** : vérifié sur Biome 2.5.8, il refuse un *nom*, donc il refuserait aussi `new Date(valeur)` et `Intl.NumberFormat('fr-FR')`, dont C6 et E4 ont besoin. Le mandat porte donc sur **deux** fichiers : `biome.jsonc` **et** un fichier neuf sous `tools/biome/` — **élargissement accordé le 2026-08-13** |

### Les deux conséquences qu'il faut avoir en tête

**Le n°4 laisse une protection déclarative, et c'est le choix assumé.** La roadmap le dit
déjà d'elle-même en §6 : *« une phrase ne résiste pas à une demande client pressante »*,
et sa colonne « ce qui l'atténue » dit *« Rien pour l'instant »*. Cet arbitrage la laisse
dire vrai. Le signal de réouverture reste écrit noir sur blanc — **le jour où une
fonction à nom fiscal est demandée** — et ce jour-là le renommage coûtera une migration,
parce que la liste des opérateurs ne sera plus vide.

**Le n°5 crée le seul précédent de modification d'un fichier protégé par AGENTS.md §7 —
et la vérification l'a élargi à deux fichiers.** Il est accordé parce qu'il **ajoute** une
contrainte au lieu d'en desserrer une, dans le lot dont le déterminisme est la raison
d'être. Il ne vaut que pour l'`override` décrit et pour le fichier `.grit` **neuf** : il
n'ouvre ni `biome.jsonc`, ni `tools/biome/`, et la PR doit le dire dans ces termes.

> **Chronologie de ce mandat, à conserver** — c'est le seul du lot qui ait été rendu deux
> fois. Accordé le 2026-08-13 sur `biome.jsonc` et sur le moyen `noRestrictedGlobals` ;
> la vérification a établi que ce moyen refusait `new Date(valeur)` et
> `Intl.NumberFormat('fr-FR')`, donc qu'il cassait C6 et E4 ; **élargi le même jour** à un
> fichier neuf sous `tools/biome/`, sans lequel aucune couverture correcte n'existe. Les
> deux artefacts sont figés en [INC-3](#inc-3--les-trois-garde-fous--m-arbitrages-n°1-et-n°5-tranchés-a),
> vérifiés sur 25 formes : 18 refus voulus, 7 acceptations, aucun faux positif.

**Une remarque de méthode, parce qu'elle se reproduira.** Un arbitrage a été rendu sur un
*moyen* (« ajouter un `noRestrictedGlobals` ») et la vérification a montré que ce moyen ne
tenait pas la promesse. La décision reste valide parce que ce qui a été arbitré est le
**résultat** — outiller l'interdiction — et non l'outil. C'est ainsi que les quatre autres
lignes de ce tableau doivent se lire.

---

## 9. Ce que ce plan tient pour acquis

Trois hypothèses. Si l'une est fausse, le plan change.

1. **Le projet est toujours en pré-v1.0, aucun template client n'existe en stockage.**
   Vérifié : aucun tag git, aucun workflow de publication, aucun changesets,
   `packages/core` en `0.1.0`. Cette hypothèse n'autorise plus D9 — qui a été renversée et
   livre désormais une migration — mais elle porte **seule** les trois rétrécissements de
   [D2](#d2--aucune-position-rétrécie--trois-valeurs-bornées-et-il-faut-le-dire) : borne de
   chemin, profondeur, budget de pas. Aucun des trois n'est rattrapable par une migration.
   Si un template client existe quelque part, ces trois bornes doivent être rediscutées une
   par une — pas le lot entier.
2. **Les deux entrées d'Openview reçoivent de la donnée simple** — résultat d'un
   `JSON.parse` ou d'un `structuredClone` — **sans accesseur ni proxy**. L'hypothèse porte
   sur deux endroits, et une version antérieure n'en nommait qu'un :
   - **La portée d'évaluation.** Le dépôt documente qu'un accesseur est invoqué à chaque
     lecture, et `childScope` en invoque un par itération : avec les agrégations, le
     nombre de lectures d'un même chemin passe de O(1) à O(n).
   - **L'entrée de `parseTemplate`.** `assertBoundedShape` lit par descripteur, ce qui
     empêche un **getter** déclaré de s'exécuter — mais sur un `Proxy`,
     `getOwnPropertyDescriptor` et `ownKeys` sont **eux-mêmes des traps** : du code de
     l'appelant s'exécute quand même, et la fenêtre TOCTOU vis-à-vis de Zod se rouvre.
     Le garde promet « aucun getter déclaré ne s'exécute », jamais « aucun code ne
     s'exécute », et un `Proxy` passé à `parseTemplate` est **hors modèle de menace, par
     écrit**.

   Ce n'est pas une recommandation, c'est **la condition sous laquelle le déterminisme est
   promis**, et elle doit être écrite dans l'ADR 0003 — **dans ses deux moitiés**.
3. **`core.md` décrit le périmètre voulu de C1.** Le plan le respecte à la lettre et ne
   le réécrit pas — un lot ne réécrit pas son propre cahier des charges. Le seul ajout
   au-delà du périmètre annoncé est `text()` (arbitrage n°2), et il ne fait que rendre
   utilisable la famille « Textes » que `core.md` nomme déjà.
   Un ajustement a déjà eu lieu, hors de ce plan : la famille « Textes et dates » disait
   « nombre de jours de retard », ce qui postulait une horloge dans le moteur ; elle dit
   désormais « nombre de jours entre deux dates fournies ». Le périmètre est inchangé,
   c'est l'énoncé qui a cessé de contredire le lot E6.
