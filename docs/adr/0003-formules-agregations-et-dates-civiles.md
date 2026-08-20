# ADR 0003 — Formules, agrégations et dates civiles

- **Statut :** 🟢 **Accepté** (2026-08-13), implémentée dans `@openview/core`
- **Date :** 2026-08-13
- **Impact :** `@openview/core` (algèbre et évaluation), `@openview/engine` (E1 évaluera ces formules, E6 honorera ces choix numériques et calendaires), `@openview/designer` (D7 éditera ces kinds)
- **Amende :** [ADR 0001](0001-expression-language.md) — le paragraphe « Rien d'autre. Pas
  d'arithmétique, pas d'appel de fonction » ; [ADR 0002](0002-data-binding-and-loop-scope.md) —
  l'argument de rejet de l'option A3 et la conséquence « `CURRENT_SCHEMA_VERSION` reste à 1 »
- **⛔ Amendée par :** [ADR 0008](0008-langue-devise-et-formats.md) (2026-08-20) — la condition 2
  du **critère d'admissibilité de la décision 5** (« *elle ne lit rien de l'environnement — ni
  horloge, ni fuseau, ni locale, ni ICU* ») et la position sur `toLocaleUpperCase` sont **amendées**
  par l'*Amendement C6*, écrit en toutes lettres sous la décision 5. Ce qui reste vrai sans réserve :
  **aucune opération de l'algèbre d'expressions ne lit ICU**, et le lot C6 n'en ajoute aucune.
- **Complétée par :** [ADR 0004](0004-les-arrondis-declares-par-le-modele.md) (2026-08-15) — la
  **décision 4** ci-dessous annonçait le kind enveloppe `round` dans sa *forme* et laissait sa
  sémantique, ses modes et la nature de `decimals` au lot C2. L'ADR 0004 les tranche, porte
  `CURRENT_SCHEMA_VERSION` à **3**, et amende `AGENTS.md` §3.B sur la portée du Visitor.
- **Plan d'implémentation :** [docs/plans/c1-formules-et-agregations.md](../plans/c1-formules-et-agregations.md)
  — périmé une fois le lot livré, comme le dit son propre en-tête
- **Implémentation :** [`src/expression/expression.ts`](../../packages/core/src/expression/expression.ts)
  (les 18 kinds et les trois sous-algèbres),
  [`src/expression/evaluate.ts`](../../packages/core/src/expression/evaluate.ts) (évaluation,
  `fail()`, `evaluateWithin`),
  [`src/expression/value-type.ts`](../../packages/core/src/expression/value-type.ts) (le *tag*
  d'une valeur, jamais son contenu),
  [`src/expression/civil-date.ts`](../../packages/core/src/expression/civil-date.ts)
  (arithmétique calendaire pure),
  [`src/expression/limits.ts`](../../packages/core/src/expression/limits.ts) (budget d'évaluation),
  [`src/template/guard.ts`](../../packages/core/src/template/guard.ts) (garde de forme au parsing)

---

## Contexte

L'ADR 0001 a tranché **comment** une expression est représentée : un arbre typé, validé par
Zod, jamais une chaîne à parser. Elle a délibérément arrêté l'algèbre à six kinds —
`literal`, `path`, `compare`, `logical`, `not`, `isEmpty` — et écrit, sans réserve :

> Rien d'autre. Pas d'arithmétique, pas d'appel de fonction, pas d'accès indexé dynamique
> tant qu'un cas d'usage réel ne l'exige pas.

Le cas d'usage réel est arrivé, et c'est le premier de la
[roadmap du contrat](../roadmap/core.md) : le lot **C1 — Formules et agrégations**. Un modèle
sait aujourd'hui *comparer*, pas *calculer*. Il ne peut pas dire « total = somme des lignes »,
ni « échéance = date de facture + 30 jours ». La fonction n°1 d'une facture n'est pas
exprimable.

Cette ADR élargit donc l'algèbre. Elle est écrite **avant** le code, parce qu'un lot qui
élargit un contrat sans amender la décision qui le fermait fait diverger la décision écrite et
le code dès le premier commit — ce que `core.md` signale nommément comme le risque de ce lot.
Elle ferme aussi la moitié restante de la **décision ouverte n°5** de la
[roadmap](../roadmap/README.md) (« jusqu'où vont les calculs de dates ? »), déclarée bloquante
pour C1.

### Le cadre, qui n'est pas rediscuté ici

Openview est un **moteur d'édition embarquable**. Le jeu de données appartient à l'application
intégratrice, qui le nomme ; Openview ne réserve aucun nom de champ, n'attend aucune structure,
n'écrit aucune règle métier et **ne lit rien de son environnement**. Ce cadre vit dans
[AGENTS.md](../../AGENTS.md) (« Ce qu'Openview n'est pas »), dans le
[README](../../README.md) et en tête de la [roadmap](../roadmap/README.md). Tout ce qui suit
en découle ; la facture est le **jeu d'épreuve** de ce lot, jamais son périmètre.

---

## Décision 1 — L'algèbre reste **close et structurée**, et passe de 6 à 18 kinds

Pas de parseur, pas de `{ fn, args }` générique, pas de fonctions définies par l'utilisateur,
pas de référence par nom. L'arbre reste **fini et terminant par construction**, et chaque
opérateur porte des **champs nommés** d'arité fixe.

Trois ensembles nommés, et c'est la structure qui remplace le rétrécissement de position :

| Ensemble | Membres | Rôle |
| :--- | :--- | :--- |
| `PrintableExpression` (13) | `literal`, `path`, `arithmetic`, `percentOf`, `aggregate`, `count`, `if`, `concat`, `text`, `textCase`, `dateAdd`, `dateDiff`, `endOfMonth` | Ce qu'une liaison de texte accepte |
| `PredicateExpression` (4) | `compare`, `logical`, `not`, `isEmpty` | Valeur booléenne, refusée à l'impression |
| `FilterExpression` (1) | `filter` | Valeur de liste, refusée à l'impression |

### Le refus central : aucun `call`

Un `{ kind: 'call'; fn: string; args: Expression[] }` était l'option la plus courte. Elle est
refusée, et pour cinq raisons qui tiennent toutes ensemble :

- un espace de noms générique se remplit et ne se vide jamais ;
- il exige une table d'arité maintenue à côté du schéma — deux sources libres de diverger ;
- il force une garde sur `args[0]`/`args[1]` à chaque évaluation, puisque
  `noUncheckedIndexedAccess` est actif et que `!` est bloquant (AGENTS.md §1.1) ;
- il dégrade le message Zod de « champ `days` manquant » à « 2 éléments attendus, 1 reçu », ce
  qui rate frontalement l'exigence du lot C8 (« un refus compréhensible ») ;
- il rouvre la place où `tva()` finira par s'écrire.

**Champs nommés partout.** C'est aussi ce qui rend le lot D7 de l'éditeur possible : une barre
de formule édite des champs, pas une liste positionnelle.

### `text(value)` — la mise en chaîne est **explicite**, jamais implicite

`concat` refuse un nombre, comme toute l'algèbre refuse la coercion depuis l'ADR 0001. Mais le
cas canonique — coller un libellé à un numéro que l'intégrateur livre en nombre — doit rester
écrivable : `concat('N° ', text(cmd.numero))`.

Un kind d'un seul champ, qui rend visible **dans l'arbre** l'endroit exact où une valeur
devient du texte. Sans lui, la famille « Textes » serait inutilisable dès que la donnée est
numérique ; avec une mise en chaîne implicite, on aurait un opérateur qui additionne ou
concatène selon la donnée — ininterprétable dans une barre de formule.

> ⚠️ **`text()` produit une chaîne, pas un affichage.** Il rend la forme canonique —
> `String(valeur)` pour un nombre fini, la chaîne inchangée pour une chaîne — **sans séparateur
> de milliers, sans symbole monétaire, sans locale**. Le formatage appartient au lot C6 ;
> l'écrire ici serait une position de format *de fait*, la même erreur que l'arrondi implicite
> refusé en décision 4. Un booléen, une liste et un objet sont **refusés** : `text(true)`
> imprimerait `true` dans un document, exactement ce que la position d'impression interdit
> depuis l'ADR 0002. Une valeur absente propage l'absence, comme partout ailleurs (décision 6).

---

## Décision 2 — Aucune **position** rétrécie ; trois **valeurs** bornées

`compare.left/right`, `logical.operands`, `not.operand`, `isEmpty.operand`, `LoopNode.each` et
`ConditionNode.when` gardent tous le type `Expression`. **Aucune position du contrat n'accepte
moins qu'avant.**

`TextBindingSegment.value` passe de `LiteralExpression | PathExpression` à
`PrintableExpression` : c'est un **élargissement**. Les prédicats et les listes restent refusés
**au parsing**, où le refus ne coûte aucune migration.

> ⚠️ **C1 est additif en FORME, restrictif en VALEURS.** Il serait faux d'écrire « aucun
> document auparavant valide ne devient invalide ». Trois bornes introduites par la revue de
> sûreté refusent désormais des documents qui parsaient :
>
> | Borne | Ce qu'elle refuse maintenant |
> | :--- | :--- |
> | `.max(256)` sur un chemin | un chemin de plus de 256 caractères, **au parsing** |
> | `maxDepth = 64` (garde de forme) | une imbrication de plus de 64 niveaux **JSON**, au parsing |
> | `maxSteps` par défaut (budget) | un `logical` à 1,5 M d'opérandes, **au rendu** — donc sur un document qui reste *parse-valide*. Celui-là ne se voit pas à l'ouverture |
>
> Les trois ne sont **pas** rattrapables par une migration : tronquer un chemin ou aplatir un
> arbre corromprait le document. Elles reposent donc, et elles seules, sur l'hypothèse
> **pré-v1.0** — vérifiée : aucun tag git, aucun workflow de publication, `packages/core` en
> `0.1.0`. Si un template client existe quelque part, ces trois bornes se rediscutent une par
> une.

### Une garantie à énoncer correctement

Un raisonnement faux a circulé pendant la conception de ce lot et ne doit pas être recopié :
« un `if` à branches booléennes n'est pas représentable, donc rien de booléen n'entre en
position d'impression ». C'est **factuellement faux** : `LiteralValue` inclut `boolean`, donc
`{ kind: 'binding', value: { kind: 'literal', value: true } }` parse depuis l'ADR 0002.

La garantie réelle se dit ainsi : *une position d'impression refuse les **opérateurs** à valeur
booléenne et à valeur de liste ; elle n'a jamais interdit un **booléen littéral**, et ne le
peut pas sans retirer `boolean` de `LiteralValue` — ce qui serait un rétrécissement.* Un test
épingle le comportement réel, pour que la prochaine lecture ne recommence pas l'erreur.

---

## Décision 3 — Les agrégations : **trois champs nommés**, et la machinerie de l'ADR 0002 telle quelle

```jsonc
{ "kind": "aggregate", "op": "sum",
  "source": { "kind": "path", "path": "invoice.lines" },
  "as": "line",
  "value": { "kind": "path", "path": "line.total" } }
```

C'est **exactement la forme d'un `LoopNode`** (`each`/`as`/`children`) : l'éditeur réutilisera
le widget de boucle, et l'exigence D7 « comprendre **où** s'applique la formule » est satisfaite
parce que la portée est explicite et affichable.

**L'évaluation réutilise `evaluateSequence` et `childScope` sans les modifier.** C'est le
résultat le plus important du lot : la machinerie livrée par l'ADR 0002 est exactement ce dont
le lot le plus lourd du contrat avait besoin. Aucun second primitif de portée, aucun nom
réservé, **aucun *mécanisme* de masquage nouveau**.

> ⚠️ La formule exacte est « aucun mécanisme nouveau », pas « aucun masquage nouveau ».
> `aggregate.as` et `filter.as` sont **deux nouveaux sites** où un alias peut masquer une clé de
> l'appelant : `sum(invoice.lines, invoice, invoice.total)` est écrivable. Ce qui ne change pas,
> c'est la **règle de résolution** : `childScope` la porte déjà pour `LoopNode.as`, à
> l'identique. `collectDataPaths` gagne donc une **troisième limite documentée** — écrire
> « aucun masquage nouveau » ferait exactement ce que cette ADR reproche à l'ancienne docstring
> de `collectDataPaths` : *elle promet, elle mentait*.

### `filter` plutôt qu'un `where?` optionnel

Un `where?` entraîne un `as?` couplé — un `count` sans `where` n'a pas besoin d'alias, avec
`where` si : optionalité conditionnelle à deux étages sous `exactOptionalPropertyTypes`, et un
message Zod « requis sauf si… » que C8 ne peut pas rendre lisible. La composition remplace
l'optionalité, et **tous les champs restent requis partout**.

Bénéfice non facturé : `LoopNode.each` étant déjà typé `Expression`, « ne répéter que les lignes
non annulées » devient exprimable **sans toucher au nœud boucle**.

`count` est un kind distinct à un seul champ, pas un opérateur d'agrégat : « nombre de lignes
remisées » s'écrit `count(filter(…))`, et `AGGREGATE_OPERATORS` retombe à `sum/avg/min/max`,
homogènes en type de retour.

---

## Décision 4 — **IEEE-754 binary64**, le `number` de la plateforme. Aucune dépendance ajoutée.

Trois faits qu'il faut tenir **séparés** — les confondre est le piège du lot :

1. **Déterminisme (E6) : acquis.** Les quatre opérations sont *correctement arrondies* par la
   norme et leur résultat est imposé par ECMA-262 : `a + b` produit le même bit sur deux
   machines. Corollaire : `Math.pow`, `Math.sqrt` et les transcendantes ne sont **pas** obligées
   d'être correctement arrondies — aucune n'est au périmètre, et c'est une raison de plus de ne
   pas les y mettre.
2. **Exactitude décimale : non acquise, et ce n'est pas le problème de C1.** Le critère de fin
   du lot C2 (« aucun total ne diffère de la somme des montants affichés au-dessus ») est une
   propriété d'**arrondi déclaré et ordonné**, pas de représentation. **Déclarer E6 satisfait
   puis découvrir l'écart d'un centime en C2 est exactement l'erreur à ne pas commettre**, et
   elle vient de cette confusion.
3. **Une bibliothèque décimale n'est pas justifiable ici.** `decimal.js`/`big.js` élargiraient
   la surface supply-chain d'un projet public dont `core` n'a qu'**une** dépendance (AGENTS.md
   §7) ; des entiers de centimes préempteraient C2 **et** C6 en inscrivant une échelle monétaire
   dans le contrat. Et la décision reste **réversible** : changer de représentation plus tard ne
   touche ni les kinds, ni les schémas, ni un seul modèle stocké — seulement le corps de trois
   fonctions.

**Aucun arrondi implicite, nulle part** — en particulier pas sur `div` ni sur `percentOf`. Un
arrondi par défaut serait une position d'arrondi **de fait**, donc une règle, donc une violation
de la décision 16 de la roadmap et de la clause du README. `div(1, 3)` rend
`0.3333333333333333`, et un test épingle ce résultat pour interdire qu'un futur contributeur
« arrange » la division.

**La couture laissée à C2**, écrite ici pour qu'elle ne se fasse pas ailleurs : un **kind
enveloppe** `{ kind: 'round'; value; decimals; mode }`, purement additif, composable, **visible
dans l'arbre** — et non un champ `precision?` sur chaque nœud de calcul, qui ferait porter à
chaque intermédiaire un champ que personne ne remplit.

**L'ordre d'accumulation fait partie du contrat** : positionnel, jamais réordonné. L'addition
binary64 n'étant **pas associative**, la promesse « le même bit sur deux machines » ne tient
pour une somme *que* si rien ne réordonne. C'est une propriété épinglée par un test, pas un
détail d'implémentation.

---

## Décision 5 — Dates : bornage **« date civile pure »**

*Ferme la moitié restante de la décision ouverte n°5 de la [roadmap](../roadmap/README.md).*

**Le critère d'admissibilité, écrit avant la liste**, pour que la prochaine demande se tranche
sans rouvrir le débat. Une opération de date entre dans l'algèbre **si et seulement si** :

1. son résultat est une fonction pure de ses arguments explicites — **aucune convention à
   choisir, aucune table de règles embarquée** ;
2. elle ne lit **rien** de l'environnement — ni horloge, ni fuseau, ni locale, ni ICU.

Une date est une chaîne **`YYYY-MM-DD`**, grégorien proleptique, sans heure ni fuseau, bornée
`0001-01-01 … 9999-12-31`.

> ### ⛔ Amendement C6 (2026-08-20) — la dépendance à ICU, et ce qui reste garanti
>
> **Ce qui ne change pas, et il faut le lire d'abord.** Le critère ci-dessus gouverne **l'algèbre
> d'expressions**, et le sujet de sa phrase est « *une opération de date* ». Le lot C6 n'ajoute
> **aucune** opération à l'algèbre : `git grep -c "case 'round':" -- packages/core/src/expression`
> reste à **2**, aucune union stockée ne s'élargit, et **aucune fonction d'expression ne lit ICU**.
> La condition 2 reste donc **intégralement vraie de l'algèbre**.
>
> **Ce qui est amendé** est sa portée au-delà de l'algèbre, parce que
> [`presentation/format.ts`](../../packages/core/src/presentation/format.ts) dépend d'ICU :
>
> Une fonction de `presentation/` peut appeler `Intl` **si et seulement si** la locale lui est
> **déclarée par le modèle**, **structurellement valide au sens d'ECMA-402** (`wellFormedLocale`, au
> parse) et **honorée telle quelle** par ce moteur (`honouredLocale`, au rendu), et si `timeZone`,
> `calendar` et `numberingSystem` sont **épinglés en littéral en ligne**.
>
> **La garantie de déterminisme devient :** *deux rendus du même document par le **même build**
> produisent la **même chaîne** ; deux builds portant deux versions d'ICU peuvent produire deux
> **caractères d'espace** différents.*
>
> **Le second point est la contrainte que le lot moteur E6 hérite, et il est mesuré :**
> `1 234,50 €` en `fr-FR` porte **U+202F** entre les chiffres et **U+00A0** avant le symbole, et le
> U+202F est arrivé avec **CLDR 42 / ICU 72**. La CI tourne deux majeures de Node, donc deux jeux
> CLDR. Conséquence opposable : **aucun test d'or ne fige une chaîne formatée.**
>
> **Ce que l'amendement ne concède PAS.** `core` ne lit toujours **rien** de son environnement : pas
> d'horloge, pas de fuseau autre qu'`UTC` épinglé, **aucune locale de machine**, aucun aléa, et pas
> un seul objet `Date` construit. Le seul appel qui interroge la machine est l'**honorat**, et il
> demande « *ce build connaît-il **ce tag*** », jamais « *quelle est la langue de ce build* ». Sans
> lui, `Intl` retomberait **en silence** sur la locale de l'hôte — le défaut exact que la condition 2
> existe pour interdire, et que ce lot supprime plutôt qu'il ne l'introduit.

| Kind | Couvre | Convention à choisir ? |
| :--- | :--- | :--- |
| `dateAdd(date, days)` | « échéance = date de facture + 30 jours » | aucune |
| `dateDiff(from, to)` → jours | « nombre de jours entre deux dates fournies » — le retard, par exemple, entre l'échéance et une date de traitement transmise par l'hôte | aucune |
| `endOfMonth(date)` | « 45 jours fin de mois » = `endOfMonth(dateAdd(d, 45))` | aucune |

### Exclus par écrit, avec le critère qui les élimine

- **`addMonths`/`addYears`** — « 31 janvier + 1 mois » est une **convention** (28 ? 29 ? 3
  mars ?). Échoue au critère 1. C'est la porte d'entrée du nid à cas particuliers, et
  `endOfMonth` couvre le besoin réel sans jamais l'ouvrir. **La distinction est le cœur de la
  borne.**
- **Jours ouvrés, fériés, calendriers nationaux** — un calendrier de fériés est une **donnée de
  l'intégrateur** : il se périme et change par pays. Échoue au critère 1. Si le besoin arrive,
  l'extension est `addBusinessDays(date, days, holidays)` avec les fériés **en argument**, jamais
  une table interne — et le piège à traiter en C8 est « liste absente = résultat faux en
  silence », donc **refus explicite** plutôt que valeur par défaut.
- **Heures, fuseaux, `today()`** — échouent au critère 2. **C'est le point le plus important de
  toute la décision :** sans lui, E6 est *mathématiquement* impossible et le lot de factures de
  référence E7 devient instable.

> **« Aujourd'hui » n'existe pas dans l'algèbre, et il n'y a rien à réserver pour autant.**
> « Nombre de jours de retard » s'écrit `dateDiff(cmd.echeance, X)` où `X` est **une donnée que
> l'intégrateur fournit sous le nom qu'il veut**, au même titre que le total ou le numéro.
> Openview ne réserve aucun nom de champ, n'en attend aucun, n'en documente aucun comme
> obligatoire. La seule règle qui subsiste est technique : **le moteur ne lit pas l'horloge**,
> sinon deux exécutions ne peuvent pas produire le même document (E6).

### `YYYY-MM-DD` est une représentation d'ÉCHANGE, pas un format d'affichage

Comme `TextBindingSegment.value` accepte désormais `dateAdd`, un modèle imprimerait cette chaîne
telle quelle : jusqu'à C6, le playground puis le moteur afficheraient de l'ISO dans une facture
française. **C6 possède l'affichage** ; la conversion se fera au même endroit que la mise en
chaîne des nombres — la question 2 de l'ADR 0001, donc `DataBindingStep`. Le playground étiquette
les dates comme valeurs brutes, exactement comme il le fait déjà pour les autres liaisons.

### Le module calendaire est **pur par construction**, pas par vigilance

`civil-date.ts` fait de l'arithmétique entière (*days-from-civil* de Hinnant) : **aucun `Date`,
aucun `Intl`, aucune horloge**. Le bénéfice n'est pas la performance, c'est que la contrainte
« aucune lecture d'environnement » devient **vérifiable**. Les trois pièges classiques —
`new Date(y, m, d)` en fuseau hôte, `Intl`/ICU dépendant de la version, `new Date(chaîne)` non
spécifié hors ISO — ne sont pas évités, ils sont rendus **inatteignables**.

La validation **est** l'aller-retour : `daysFromCivil` puis `civilFromDays`, puis comparaison
des trois composantes. `2026-02-30`, `2025-02-29`, `2026-13-01` et `2026-02-00` tombent tous là,
**sans table de longueurs de mois ni règle bissextile écrite à la main** — donc sans une seule
ligne qui puisse être fausse.

---

## Décision 6 — Les cinq politiques d'erreur que le dépôt ne tranchait nulle part

Chacune s'aligne sur la règle déjà écrite dans `evaluate.ts` : *l'absence n'interrompt pas le
document, un type présent mais faux si*.

| Situation | Décision | Pourquoi |
| :--- | :--- | :--- |
| Donnée absente, opération scalaire | **propage `undefined`** | Choisir `0` serait `core` décidant à la place de `DataBindingStep` la question laissée ouverte par l'ADR 0001 Q2 — et `0` est juste pour une somme, faux pour une division |
| Opérande **présente**, mauvais type (`1 * '2'`) | **lève** `operand-type` | Aucune coercion : la règle de l'ADR 0001 est **étendue**, pas érodée |
| Opérande présente et **non finie** | **lève** `not-finite` | `Number.isFinite`, pas `typeof === 'number'` : un NaN traverserait sinon trois niveaux de formule jusque dans une facture. Scellé **en amont** |
| Division par zéro (diviseur **présent** valant 0) | **lève** `division-by-zero` | Ce n'est pas une donnée manquante, c'est une **formule fausse**. Jamais `Infinity`, jamais `NaN` |
| Agrégat/filtre/boucle sur une **non-liste** | **lève** `not-a-list` ; sur liste **vide** : `sum` → 0, `count` → 0, `avg`/`min`/`max` → absence | Une liste vide n'est pas une faute |

> ⚠️ **« `avg` évite la division par zéro par construction » est faux.** Ce n'est vrai que pour
> la liste *vide*. Une liste de 60 lignes dont **aucune** ne porte de remise donne **zéro valeur
> présente** — donc `0/0`. La règle exacte est : **absence dès que le nombre de valeurs
> présentes est nul**, quelle que soit la longueur de la liste.

> ⚠️ **Une seule règle pour le non-fini, en scalaire comme en agrégat :**
>
> > **`operand-type` répond de la *forme* d'une valeur ; `not-finite` répond de sa *finitude*.**
> > Une chaîne, un booléen, une liste, un objet → `operand-type`, partout. `NaN`, `Infinity`,
> > `-Infinity` → `not-finite`, partout, **à l'entrée comme à la sortie**.
>
> Deux codes pour une seule situation auraient obligé C8 à écrire deux messages pour la même
> faute. La règle est cohérente avec le reste : `ExpressionValueType` porte `not-finite` comme
> **tag distinct** de `number`, donc rendre `operand-type` sur une telle valeur ferait dire à la
> charge d'erreur le contraire de ce que dit son propre `actualType`.

**Quatre précisions de sémantique d'agrégat :**

- `sum`/`avg`/`min`/`max` travaillent sur des nombres **finis**. Une valeur d'élément présente et
  non finie → `not-finite` à `['value', i]`.
- Un **débordement d'accumulation** (60 000 lignes à 1e307) → `not-finite` **à la sortie**, jamais
  un `Infinity` imprimé dans un document.
- `min`/`max` sont **numériques**. Les laisser ordonner des chaînes rendrait l'ordre
  lexicographique sur les dates, ce que `civil-date.ts` existe précisément pour rendre
  inatteignable.
- L'ordre d'accumulation est positionnel (décision 4).

**En agrégation, la politique diffère et c'est assumé :** un élément dont la valeur est absente
est **ignoré**, `avg` divise par le nombre de valeurs **présentes**. En scalaire l'auteur a nommé
deux opérandes, et l'absence de l'un dit que la prémisse n'est pas remplie ; en agrégation il a
nommé **une** expression appliquée à N éléments — faire tomber la somme de 60 lignes parce
qu'une ligne n'a pas de remise serait le maximum de surprise.

**Corollaire à assumer :** `total - remise` avec une remise absente rend `undefined`, pas
`total`. C'est honnête, et **c'est exactement ce qui fait gagner sa place au kind `if`** :
l'auteur écrit `sub(total, if(isEmpty(remise), 0, remise))`. La politique de repli appartient à
l'auteur du modèle, jamais à un repli deviné par l'évaluateur.

**Le court-circuit de `if` est une règle de correction, pas une optimisation :** `and`/`or`
court-circuitent déjà, donc un auteur suppose légitimement que le « si » le fait aussi, et la
surprise se paierait en division par zéro sur une branche non prise.
`if(qty > 0, div(total, qty), 0)` avec `qty = 0` rend `0` et ne lève pas.

---

## Décision 7 — La charge d'erreur : **une seule** taxonomie, **aucune donnée** dans le message

Le lot C8 (« un refus compréhensible ») dépend de C1. Ajouter une charge machine à une API qui
n'a **aucun consommateur** coûte zéro aujourd'hui ; la rétrofitter après le moteur et l'éditeur,
non.

```ts
/** Codes d'OPÉRANDE : il existe une valeur fautive, donc une FORME à nommer. */
export const OPERAND_ERROR_CODES = [
  'operand-type', 'division-by-zero', 'not-finite',
  'not-a-list', 'not-a-boolean', 'not-comparable', 'not-orderable', 'not-a-date',
] as const;

/** Codes de BORNE : aucune valeur fautive, mais un plafond à nommer. */
export const LIMIT_ERROR_CODES = [
  'step-limit-exceeded', 'item-limit-exceeded',
  'string-limit-exceeded', 'depth-limit-exceeded',
] as const;

/** C8 énumère CELUI-CI. La partition reste une union, jamais deux catalogues rivaux. */
export const EXPRESSION_ERROR_CODES = [...OPERAND_ERROR_CODES, ...LIMIT_ERROR_CODES] as const;
```

Des tableaux `as const`, parce que C8 doit pouvoir **énumérer** les codes et qu'un type nu ne
s'énumère pas. Quatre codes de borne et pas un fourre-tout : un `limit-exceeded` unique est
inactionnable pour C8, qui doit dire **quoi** réduire — le nombre d'opérations, la taille des
listes, la longueur d'un texte ou la profondeur de la formule. `not-orderable` reste distinct de
`not-comparable` : le dépôt distingue déjà « cannot compare » de « cannot order », les fusionner
perdrait une distinction écrite.

### Une union discriminée, pas quatre champs requis

Un dépassement du nombre de pas n'a aucune « valeur fautive ». Rendre `actualType` obligatoire
pour tous les codes n'aurait laissé que trois issues, toutes mauvaises : inventer un
`ExpressionValueType` menteur, ajouter une constante `'none'` qui polluerait `describe()`, ou
rendre le champ optionnel — ce que `exactOptionalPropertyTypes` et la doctrine « tous les champs
requis » de la décision 3 refusent également.

La partition est celle qui existe déjà dans le lot : **une erreur d'opérande désigne une valeur,
une erreur de borne désigne un plafond.** `limit` est le pendant exact d'`actualType` — la seule
information actionnable de sa branche, et elle est sûre à journaliser par construction puisqu'elle
vient d'`EvaluationLimits`, pas des données. Le narrowing est celui de tout le dépôt :
`if (details.code === 'step-limit-exceeded')` donne `limit`, jamais `actualType`. Aucun cast,
donc aucun conflit avec AGENTS.md §1.1.

`site` est typé `ExpressionKind | 'loop' | 'condition'` : `ExpressionKind` ne suffit pas, parce
que `LoopNode.each` et `ConditionNode.when` portent une expression **sans être** des expressions.

### La charge doit rester sûre à journaliser même quand le document ne l'est pas

Un champ `sample` — la valeur fautive, tronquée — a été proposé puis retiré. La justification
initiale était une **clause de lectorat** (« l'éditeur l'affiche, son lecteur est l'auteur du
modèle ») : elle est fausse dans le modèle de menace de ce lot, où cet auteur *est* l'attaquant
et où la donnée appartient à l'application hôte.

Le critère juste n'est pas non plus « le canal d'erreur fuit ». Un auteur qui peut écrire
`dateAdd(customer.apiToken, 0)` peut tout aussi bien imprimer `customer.apiToken` dans une
liaison de texte. Ce qui distingue les deux, c'est **où ils vont** : la charge d'erreur voyage
vers l'exploitant, vers le journal qu'exige E8 et vers la réponse HTTP du service J5 — trois
endroits que le document n'atteint pas. D'où la règle :

> **La charge d'erreur doit rester sûre à journaliser même quand le document ne l'est pas.**

`actualType` est une liste fermée de neuf constantes, dérivée du *tag* de la valeur — nullité,
`Array.isArray`, `typeof`, finitude — et **jamais** de son contenu. `describe()` cesse de prendre
`unknown` pour prendre `ExpressionValueType` : la règle « aucun message ne contient une valeur de
rendu » passe de la vigilance au **type**. Effet second réglé au passage : un message ne peut
plus faire 10 Mo parce que la donnée en faisait 10 Mo.

**Et l'éditeur n'y perd rien.** Il tient la portée et l'arbre ; avec un `at` depuis la racine il
**rejoue** le sous-arbre fautif et affiche localement la valeur qu'il possède déjà. L'évaluation
étant pure et sans horloge (décision 5), le rejeu est fidèle.

### `at` part de la racine, et le mécanisme est écrit

Un chemin *local* ne peut pas décrire `aggregate.value[3].arithmetic.right` : si l'erreur garde
le site `arithmetic` elle perd l'index de ligne, si elle prend le site `aggregate` elle perd
l'opérande. `fail()` continue d'écrire un chemin **local**, et un unique helper
`evaluateWithin(expression, at, scope, budget)` enveloppe chaque descente, rattrape par
`instanceof`, **préfixe son segment** et relance le *même* objet d'erreur. Coût en
O(profondeur), et **uniquement sur le chemin d'erreur**.

« Préfixer puis relancer le même objet » et `readonly at` se contrediraient si le mécanisme
n'était pas écrit : muter un `readonly (string|number)[]` ne compile pas, et le seul moyen de
forcer est un cast que AGENTS.md §1.1 bloque. **L'état mutable est donc privé à la classe
d'erreur, le contrat public reste immuable** — un champ `#reversedPath` privé, un `prefix()`
appelé uniquement par `evaluateWithin`, et un getter `details` qui copie et renverse. Trois
propriétés sont épinglées par un test parce qu'aucune porte ne les voit : `details.at` rend bien
la racine → la feuille, deux lectures successives rendent le **même** chemin, et un `at` déjà
obtenu n'est pas affecté par un `prefix()` ultérieur.

La variante « créer une nouvelle erreur à chaque niveau avec `cause` » est écartée : elle empile
*N* erreurs pour une faute, et le `cause` réservé à `DataBindingStep` cesserait de désigner la
frontière core/moteur. Enrichir puis relancer une erreur typée n'est pas l'avaler : AGENTS.md
§1.3 est respecté.

### Le garde de forme a sa propre classe d'erreur

`assertBoundedShape` s'exécute **au parsing**, sur de l'`unknown` : aucun nœud n'existe encore,
donc aucun `ExpressionErrorSite`. Il lève `TemplateShapeError`, sur le patron de
`TemplateMigrationError`, avec son catalogue fermé
`SHAPE_ERROR_CODES = ['too-deep', 'too-many-nodes', 'not-plain-data']`.

**Frontière retenue :** *core sait quel **opérateur** et quel **chemin**, le moteur saura quel
**bloc**.* `evaluateExpression` ne connaît honnêtement aucun id de bloc — il n'en existe pas à ce
niveau. `DataBindingStep` enveloppera avec `cause`, déjà supporté par `OpenviewError`.

**C1 ajoute la charge machine ; C8 possède la formulation.** Les messages existants sont
recopiés caractère pour caractère. Seuls changements de vocabulaire assumés : `describe()` dit
`a list` au lieu de `an array`, cesse de qualifier `NaN` de `a number`, et le message de
`evaluateSequence` nomme l'opérateur appelant au lieu de dire « loop » à un agrégat.

---

## Décision 8 — Le bornage : ce que C1 doit rendre **possible** pour E8

C'est l'ajout de périmètre le plus discutable du lot, et il repose sur une mesure.

**Mesuré, pas supposé.** Sur 200 lignes de facture, le coût d'agrégats imbriqués n'est pas
O(n × m) mais **O(nᵏ)**, où *k* est choisi par l'auteur du modèle : 1 imbrication → 202 pas et
1,3 ms ; 3 → 8 080 402 pas et **17,5 s** ; 4 → ≈ 58 min ; 6 → des siècles. Aucun champ, aucune
longueur, aucune profondeur n'est anormale — c'est le **produit des cardinalités** qui explose,
et rien dans le contrat ne le regarde. La formule fait 327 octets.

**Le point qui rend cela structurel :** `evaluateExpression` est **synchrone et ne rend jamais la
main**. Pas d'`await`, pas de générateur, pas d'`AbortSignal`. Une boucle qui ne cède jamais
l'*event loop* ne peut pas être interrompue par un timer — donc « E8 bornera le temps » est
**impossible à tenir** autrement qu'en tuant un worker. Laisser le bornage à E8 imposerait en
silence une architecture worker-par-rendu, alors qu'E8 est déclaré condition de J5.

**Deuxième mesure, qui déplace le problème :** le débordement de pile ne frappe pas à
l'évaluation, il frappe **au parsing**. Sur une chaîne de `not` postée en JSON, Node 24 :
`JSON.parse` tient au-delà de 100 000 ; **Zod tombe vers 1 874** ; `JSON.stringify` vers 8 000 ;
`evaluateExpression` vers 20 000. Le premier échec est donc un `RangeError` **de Zod**, sur un
modèle d'environ 35–50 Ko, qui traverse `parseTemplate` **sans être enveloppé** : violation
directe d'AGENTS.md §1.3 et du critère de C8 — « Maximum call stack size exceeded » n'est pas un
message qu'un gestionnaire corrige. Et le moteur ne peut rien inspecter : il faut parser pour
regarder, et c'est le parsing qui tombe.

### Pièce 1 — le garde de forme, au parsing

```ts
export interface ShapeLimits {
  readonly maxDepth: number;  // 64 — en niveaux JSON, PAS en nœuds du document
  readonly maxNodes: number;  // 100_000 — sans lui le garde ne TERMINE pas
}
export function assertBoundedShape(raw: unknown, limits?: Partial<ShapeLimits>): void;
```

Un scan **itératif** à pile explicite, donc lui-même insensible à la profondeur. Avec
`maxDepth = 64`, tout le reste devient inatteignable **par construction** : Zod ne voit jamais
1 874, l'évaluateur jamais 20 000, `JSON.stringify` jamais 8 000. **Un seul garde-fou, quatre
trous fermés**, et le refus est typé donc racontable par C8.

Cinq propriétés sans lesquelles ce garde est un faux garde, toutes mesurées :

- **`maxNodes` est la condition de terminaison**, pas un confort. Un arbre de profondeur 40 à
  **sous-arbres partagés** provoque **5 000 000 de visites en 846 ms** sans jamais atteindre
  `maxDepth` : la profondeur est bornée, le travail ne l'est pas.
- **Le scan lit par descripteur et refuse tout accesseur.** Un `get` sur une propriété **est
  invoqué** par un scan naïf — donc du code de l'appelant s'exécute *avant* toute validation, avec
  en prime une fenêtre TOCTOU entre le garde et Zod. Le refus est `not-plain-data` :
  `parseTemplate` attend de la donnée, pas un objet vivant.
- **Un cycle est attrapé par `maxDepth`** — un cycle excède toute profondeur finie — mais
  seulement si **chaque entrée de pile porte sa propre profondeur**. C'est une propriété de
  l'implémentation, pas du concept : elle est écrite dans le fichier et épinglée par un test,
  sinon le premier refactor qui hisse la profondeur hors de la pile fait boucler le garde à
  l'infini.
- **`maxDepth` compte des niveaux JSON, pas des nœuds du document.** Mesuré sur un modèle
  réaliste : 10 niveaux, 12 avec un `aggregate(filter(…))`. 64 laisse une marge de cinq fois.
  L'unité doit être écrite : un lecteur qui croit compter des blocs choisira une valeur absurde.
- **`ShapeLimits` se valide comme `EvaluationLimits`**, avec le même refus bruyant :
  `assertBoundedShape(raw, { maxDepth: 0 })` neutraliserait le garde en silence, et
  `{ maxNodes: NaN }` le ferait ne jamais terminer — la panne exacte que `maxNodes` existe pour
  empêcher. `InvalidShapeLimitsError` sur le patron d'`InvalidEvaluationLimitsError`.

**Le garde s'exécute AVANT et APRÈS la migration.** En tête, il protège `migrateToCurrent` **et**
Zod tant que la chaîne est vide ou identitaire. Mais une migration future **transforme** — donc
elle peut *produire* une forme hors limites à partir d'une entrée conforme, et c'est alors Zod
qui reçoit l'arbre trop profond. La règle : garde sur l'entrée brute, puis **sur la sortie de la
chaîne lorsqu'au moins une étape a tourné**. Coût nul dans le cas courant, et la contrepartie
est une règle de ce dépôt :

> **Une migration ne rend jamais une forme hors limites.**

**Le garde arrête un accesseur, il n'arrête pas un Proxy — et il faut le dire.** Lire par
`Object.getOwnPropertyDescriptor` empêche un **getter** d'objet ordinaire de s'exécuter. Mais sur
un `Proxy`, `getOwnPropertyDescriptor` et `ownKeys` sont **eux-mêmes des traps** : du code de
l'appelant s'exécute quand même, et la fenêtre TOCTOU se rouvre entière. Le garde promet donc
« aucun **getter déclaré** ne s'exécute », jamais « aucun code de l'appelant ne s'exécute ». Un
Proxy passé à `parseTemplate` est **hors modèle de menace, par écrit** (voir « Ce que cette
décision tient pour acquis »).

### Pièce 2 — le budget d'évaluation, au rendu

```ts
export interface EvaluationLimits {   // CONFIGURATION, validée, immuable
  readonly maxSteps: number;          // nœuds évalués
  readonly maxDepth: number;          // descentes imbriquées
  readonly maxItemsVisited: number;   // éléments traversés, CUMULÉS
  readonly maxStringLength: number;   // concat / textCase / text
}

export interface EvaluationBudget {   // COMPTEURS MUTABLES, partagés
  // Chacune rend `false` au dépassement et NE LÈVE PAS : seul `fail()` lève, parce
  // que lui seul connaît le `site` et le `at` qu'exige ExpressionErrorDetails.
  spend(steps: number): boolean;
  enter(): boolean;                      // appairé à leave()
  leave(): void;
  visit(items: number): boolean;
  acceptString(length: number): boolean;
  readonly spent: { readonly steps: number; readonly itemsVisited: number; readonly depth: number };
  readonly limits: EvaluationLimits;     // pour que fail() remplisse details.limit
}
```

**Deux types, et la distinction est structurante.** Une configuration ne transporte que des
plafonds ; elle ne dit pas *où* vivent `steps` et `itemsVisited`. Un compteur local à
`evaluateExpression` se réinitialise à **chaque appel de haut niveau** : un document de 500
liaisons obtiendrait 500 × 1 000 000 de pas, et la borne serait décorative. **Le budget est créé
une fois par rendu**, par le pipeline, et traverse tout : les appels récursifs,
`evaluatePredicate`, `evaluateSequence`, les N éléments d'un agrégat, et toutes les expressions
du même document.

**Un budget ne lève jamais.** Il ne reçoit ni `site`, ni `at` — les deux champs que porte toute
branche d'`ExpressionErrorDetails` : il n'a littéralement pas de quoi construire l'erreur. Il
lèverait donc soit une erreur d'un autre type — qu'`evaluateWithin`, qui rattrape par
`instanceof ExpressionEvaluationError`, laisserait traverser sans jamais préfixer son chemin —
soit une erreur aux champs inventés. Et `fail()` est déclaré **unique site de levée** : un budget
qui lève en ouvrirait un second. Le risque du retour booléen — un appelant qui oublie de tester —
se traite par la structure : `spend` et `enter` n'ont qu'**un seul** site d'appel,
`evaluateWithin`, qui est déjà le point de passage unique de chaque descente ; `visit` un par
forme de liste ; `acceptString` un par forme productrice de texte. **Sept sites, tous couverts
par un test de borne.**

**Un champ d'`EvaluationLimits` sans méthode de budget est un plafond décoratif** — c'est la
raison d'être d'`acceptString`, sans laquelle `maxStringLength` n'aurait été qu'une déclaration.

**Sac d'options plutôt que troisième paramètre positionnel**, parce que `evaluatePredicate` et
`evaluateSequence` ont besoin d'une seconde chose (`caller`, ce qui leur fait cesser de dire
« loop » à un agrégat) et que trois fonctions dont le 3ᵉ paramètre a trois formes différentes est
l'asymétrie qu'un appelant se trompe à remplir. Les signatures restent
**source-compatibles** : les appelants actuels continuent d'appeler à deux arguments.

**La configuration est validée, et le refus est bruyant.** `z.number().int().min(1)` rejette
`NaN`, `Infinity`, `0`, les négatifs et les fractions ; un plafond dur à 10⁹ borne le haut. Un
champ **absent** prend le défaut ; un champ **présent et inutilisable** lève
`InvalidEvaluationLimitsError` — **jamais de repli silencieux**, sans quoi un appelant désactive
la protection par accident en passant `0`. Défauts **actifs**, jamais opt-in : *une bibliothèque
dont la sûreté se demande est une bibliothèque non sûre.*

Deux règles de comptage sans lesquelles le compteur ment : un pas par nœud évalué **et** un pas
**par élément** dans `aggregate`/`filter`/`count`, sinon 200³ itérations comptent pour 3.

> **`EvaluationLimits.maxDepth` et `ShapeLimits.maxDepth` portent le même nom, la même valeur et
> PAS tout à fait la même unité.** Le garde de forme compte des **niveaux JSON** ; le budget
> compte des **descentes d'expression**.
>
> ⚠️ **Correction du 2026-08-13, après revue.** Ce paragraphe affirmait qu'un nœud d'expression
> « pèse au moins deux niveaux JSON », donc qu'un modèle passant le garde à 64 descend au plus
> ~32 fois, donc que **la borne d'évaluation ne peut pas se déclencher sur un arbre issu de
> `parseTemplate`**. La prémisse est **fausse pour tout kind à opérande unique** — `not`,
> `isEmpty`, `text`, `textCase`, `endOfMonth`, `count` — dont l'objet enfant est à exactement
> `profondeur + 1`. Mesuré : le garde accepte une chaîne de 63 `not` et refuse à 64, tandis
> qu'`enter()` refuse la 65ᵉ descente. **Un niveau JSON par nœud à opérande unique : la marge est
> d'UN NŒUD, pas d'un facteur deux.**
>
> Et la conclusion ne tient pas non plus, parce que la limite de forme est un paramètre :
> `parseTemplate(raw, undefined, { maxDepth: 256 })` est un appel supporté, et sous lui une
> chaîne de 70 `not` dans un `ConditionNode.when` **parse proprement** puis échoue au rendu en
> `depth-limit-exceeded`. L'énoncé honnête est donc plus étroit : **avec la limite de forme par
> défaut le garde refuse le premier, à un nœud près ; relevez-la et cette borne devient
> atteignable depuis un modèle parsé.** Qui règle l'un des deux nombres doit déplacer l'autre.

**`depth-limit-exceeded` ferme le trou de pile côté évaluation.** `evaluateExpression` est
**public** et reçoit un `Expression` d'où qu'il vienne : un arbre construit en boucle par un
intégrateur, jamais passé par `parseTemplate`, déborde la pile vers 20 000 niveaux et rend un
`RangeError` nu. Il serait incohérent de refuser cette erreur non enveloppée au parsing et de
l'accepter au rendu.

**`concat` mérite sa propre borne**, parce que c'est le seul kind qui **produit** de la donnée au
lieu d'en réduire. Mesuré, arbre équilibré `concat(x, x)` sur 1 Ko : profondeur 12 → modèle de
237 Ko → chaîne de 4 Mo ; profondeur 18 → modèle de 15 Mo → chaîne de **268 Mo**, 858 Mo de RSS.
Amplification en 2^profondeur × la plus longue chaîne des données. La borne —
`budget.acceptString(resultat.length)` — est vérifiée **après chaque construction**, pas
seulement à la fin : c'est le seul ordre qui empêche la chaîne intermédiaire d'exister avant
d'être refusée. Les trois kinds producteurs de texte (`concat`, `textCase`, `text`) passent par
la même porte, sans quoi la borne se contournerait par `upper(concat(…))`.

**Risque résiduel, assumé et nommé :** `budget` reste *optionnel*, donc un appelant peut
l'oublier et retomber sur un budget par appel. Deux contrepoids : côté `engine`, un helper à
budget **requis** ; et un test « deux appels de haut niveau, un seul budget,
`step-limit-exceeded` » qui épingle le cumul.

### Les entrées non bornées restent exportées, et la différence est épinglée

`packages/core/src/index.ts` exporte `TemplateSchema` : le contournement le plus court n'est pas
`ExpressionSchema.parse`, c'est `TemplateSchema.parse(raw)` — une ligne, qui est *exactement* le
corps de `parseTemplate` privé de son garde. **On ne dé-exporte rien**, et la raison n'est pas la
décision 2 — qui porte sur les positions du contrat persistant et n'a jamais rien dit de la
surface d'exports. La raison qui suffit : un schéma Zod est le point d'attache de `z.infer`, de
la composition (`z.array(DocumentNodeSchema)`) et de la validation partielle dont l'éditeur a
besoin — trois usages qu'aucune fonction `parse*` ne remplace.

**Le risque résiduel se nomme donc au lieu de se déguiser :** ces trois entrées restent **non
bornées**. Ce qui les rend acceptables est une mesure : la récursion de Zod tombe elle-même vers
1 874 niveaux, donc la voie non bornée n'ouvre pas la profondeur — elle ouvre le `RangeError`
**non enveloppé**. Un test épingle exactement cela : la même entrée profonde rend un
`TemplateShapeError` par `parseTemplate` et un `RangeError` par `TemplateSchema.parse`. Deux
entrées bornées manquantes sont ajoutées — `parseExpression`, `parseDocumentNode` — et la
docstring de chaque schéma exporté renvoie vers la sienne.

Le garde ne peut **pas** aller dans le schéma : un `.superRefine` en tête d'un corps `z.lazy` se
réexécuterait à chaque niveau de la récursion.

---

## Décision 9 — `schemaVersion` passe à **2**, avec une migration identité

Trois arguments plaidaient pour maintenir la version 1. **Les trois sont tombés à la mesure.**

**1. « Une migration 1 → 2 serait fantôme. »** Elle ne l'est pas : elle **estampille**, et
l'estampille est la seule chose qui produise un refus exploitable. Mesuré, sur un document
portant un kind de C1 ouvert par un build antérieur :

| | Ce que rend un build antérieur |
| :--- | :--- |
| **version 1 maintenue** | `ZodError` — « No matching discriminator », « Invalid input », path `root.children.0.content.1.value.kind`. Ni `OpenviewError`, ni `TemplateMigrationError`, aucune mention de version, **aucun remède** |
| **version 2** | `TemplateMigrationError: Template uses schema version 2 but this build understands at most 1. It was written by a newer release of Openview; upgrade before opening it.` |

Le second message est rendu par **le code déjà présent dans le dépôt** : la garde de `migrate.ts`
existe, aucune coordination n'est requise. C'est exactement le message que C8 attend, et C1 est
le lot dont C8 dépend.

**2. « L'incrément passerait les quatre portes en silence. »** Faux, et c'est le pilier qui
tombe. Mesuré : dans **les deux cas** — avec migration comme sans — `migrate.test.ts` lève
`No migration registered from schema version 1. The upgrade chain to 2 is broken.` La quatrième
porte rougit. Le versionnement était **déjà outillé** ; le test fait son travail, il faut lui
donner la vraie chaîne (`[...chain, ...TEMPLATE_MIGRATIONS]`).

**3. « C1 est purement additif. »** La prémisse est fausse : voir la décision 2, trois bornes de
valeur.

```ts
export const TEMPLATE_MIGRATIONS: readonly TemplateMigration[] = [
  { from: 1, to: 2, migrate: (input) => ({ ...input, schemaVersion: 2 }) },
];
```

Identité, sauf l'estampille — et c'est tout l'intérêt. Un document v1 est **structurellement** un
document v2 : C1 n'a fait qu'élargir des unions, donc rien n'est à transformer. Ce que
l'estampille achète est à l'autre bout.

> 🚫 **La migration ne rattrape PAS les trois bornes de la décision 2.** Tronquer un chemin de
> 591 caractères ou aplatir un arbre de 101 niveaux **corromprait** le document. Ces
> rétrécissements restent couverts par l'hypothèse pré-v1.0, seul endroit du lot où cet argument
> est le bon.

> ⚠️ **Réserve mesurée.** La garde de version porte sur l'**estampille**, pas sur le contenu. Un
> document estampillé `1` mais portant un kind de C1 — fabriqué à la main, ou par un outil
> tiers — retombe sur `Invalid input` **même depuis un build v2**. La migration estampille, elle
> ne valide pas. Ce cas appartient à C8.

### Où l'estampille se pose, et pourquoi une seule fois

Quatre incréments de C1 ajoutent des formes persistées. Une version par incrément ferait quatre
estampilles et quatre migrations identité pour **un seul** lot fonctionnel : le numéro cesserait
de désigner un contrat pour désigner un commit. Un incrément unique portant toutes les formes
détruirait le découpage. Retenu : **une estampille unique, posée après la dernière forme
persistée**, et des commits intermédiaires **déclarés non publiables**.

> **Aucun commit de C1 antérieur à l'estampille n'est publiable, et aucun document produit par un
> build intermédiaire n'est conservé.** Le premier commit publiable du lot est celui qui pose
> l'estampille.

Le numéro `2` désigne donc **l'algèbre C1 complète**, et le docstring de
`CURRENT_SCHEMA_VERSION` énumère ce que la version 2 contient réellement. Un numéro de schéma qui
promet des formes non livrées est pire qu'un numéro non incrémenté.

### La contradiction de textes, et où elle se règle

`AGENTS.md` §1.2 dit, **sans réserve** : « toute évolution s'accompagne d'une migration
`migrate(from, to)` ». L'ADR 0002 en crée une, pré-v1.0 — et se contredit elle-même ailleurs.
**`AGENTS.md` fait foi** : c'est le fichier que `CLAUDE.md` importe et que tous les agents
lisent, et une ADR qui entend l'amender doit le dire, ce que 0002 ne fait pas. La correction va
donc dans les trois documents qui portent la règle, et pas dans un quatrième texte :

- **`AGENTS.md` §1.2** est *clarifié*, jamais assoupli : les **deux** formes d'incompatibilité
  sont nommées (la perte silencieuse par le `strip` de Zod ; le refus illisible par élargissement
  d'union), et il est écrit qu'une migration qui ne transforme rien n'est pas une migration
  fantôme, et qu'*il n'y a pas de dérogation pré-v1.0 au versionnement* — la dérogation pré-v1.0
  porte sur les **rétrécissements**.
- **ADR 0002** : la conséquence « `CURRENT_SCHEMA_VERSION` reste à 1 » est marquée *révisée par
  l'ADR 0003*, sans être réécrite — une ADR est un journal.
- **`template.ts`** ne porte **aucune** réserve pré-v1.0 ; il gagne au contraire le cas qui
  manquait, l'élargissement d'union, avec les deux messages mesurés ci-dessus.

---

## Décision 10 — Un nom d'opérateur désigne une **opération**, jamais une **règle**

La limite de responsabilité reste tenue par la **clause du [README](../../README.md)** et par
elle seule. Un test outillé itérant les enums fermés contre une expression rationnelle a été
proposé puis **écarté** : c'est la position déjà retenue par `docs/roadmap/core.md`, et C1 ne la
rouvre pas. Ce que cela laisse à la revue humaine doit au moins être *lisible* :

> **Un nom est interdit s'il désigne une RÈGLE, pas une OPÉRATION.** `sum`, `percentOf`, `round`
> (à venir en C2) décrivent un calcul et sont légitimes. `tva()`, `taxe()`, `arrondiLegal()`,
> `tauxDeChange()` nomment une règle dont Openview ne répond pas : par leur seule existence ils
> déplacent la responsabilité, quoi qu'en dise la documentation.

**Le risque accepté, en clair.** `docs/roadmap/README.md` §6 le nomme déjà — « une clause seule
est une protection déclarative » — et sa colonne « ce qui l'atténue » dit « Rien pour l'instant ».
Cette décision la laisse dire vrai. Le signal de réouverture est écrit noir sur blanc : **le jour
où une fonction à nom fiscal est demandée**. Ce jour-là, le renommage coûtera une migration,
parce que la liste ne sera plus vide.

---

## La réserve E6 de `textCase`, à ne pas perdre

**`textCase` est le seul endroit de tout C1 où E6 tient par convention plutôt que par
spécification.** `toUpperCase`/`toLowerCase` sont spécifiés, mais **indexés sur la version
d'Unicode du moteur**. Mesuré : `'ß'.toUpperCase()` rend `"SS"` — un caractère devient deux, **la
longueur change**, donc la mise en page, donc la pagination. Ce n'est pas un cas de
laboratoire : une raison sociale allemande suffit.

⚠️ **Amendé par l'*Amendement C6* ci-dessus, et sur le motif plutôt que sur la conclusion.** La
conclusion tient : `toLocaleUpperCase` reste **interdite** dans l'algèbre. Mais « elle dépend d'ICU »
n'est plus le critère — `presentation/format.ts` en dépend et est admis. Le critère est celui de
l'amendement : ICU n'est appelable **qu'avec une locale que le modèle déclare, validée et honorée**.
`toLocaleUpperCase` échoue précisément sur ce point, puisqu'elle lit la locale de **l'hôte**.

La variante locale (`toLocaleUpperCase`) est **interdite** : elle dépend d'ICU et casse E6 pour
de bon. La réserve s'outille par des **vecteurs de test figés** — `ß`, `ﬀ`, `İ`, plus du latin
accentué — dont les attendus sont écrits en dur : le jour où une montée de Node change un
résultat, c'est le test qui le dit, pas une facture.

---

## Conséquences, telles qu'implémentées

- **`expression.ts`** : 18 kinds, `PrintableExpression` et `PredicateExpression`, **deux**
  liaisons `z.lazy` déclarées **avant** tous les schémas membres (un membre placé au-dessus
  lèverait un `ReferenceError` de TDZ à l'import — ni erreur de type, ni erreur de lint, seul
  `vitest` casse), `aliasSchema` hissé depuis `nodes.ts` parce que **trois** sites lient
  désormais une clé de portée, `rootSegment` extrait, `pathsOf` porteur d'un contexte d'alias
  interne à signature publique inchangée.
- **`value-type.ts`** (neuf constantes) et **`errors.ts`** : les deux catalogues de codes,
  `ExpressionErrorDetails` en union discriminée, `ExpressionEvaluationError` à chemin préfixable,
  `TemplateShapeError`, `InvalidEvaluationLimitsError`, `InvalidShapeLimitsError`.
- **`evaluate.ts`** : `fail()` unique site de levée, `evaluateWithin` unique point de descente,
  sac d'options portant `budget` et `caller`.
- **`civil-date.ts`** : arithmétique calendaire pure, testée pour elle-même — mesuré, couverte
  *uniquement* à travers l'évaluateur elle tombe à 91,3 % de branches, une seule branche de marge
  au-dessus du plancher.
- **`limits.ts`** et **`guard.ts`** : les deux pièces du bornage.
- **`nodes.ts`** : `TextBindingSegment.value: PrintableExpression`, `as: aliasSchema`, cinq
  imports devenus morts supprimés.
- **`visitor.ts`** : `rootSegment` importé, `addCallerPaths` inchangé, une troisième limite
  documentée sur `collectDataPaths`. `NodeReads.binds` **ne devient pas** un tableau : l'alias
  d'un `aggregate`/`filter` est confiné à son sous-arbre, et l'élargir ferait fuiter l'alias vers
  des enfants qui n'ont aucun droit de le lire.
- **`template.ts`/`migrate.ts`** : `CURRENT_SCHEMA_VERSION = 2`, l'entrée `1 → 2`, le garde de
  forme appelé avant la chaîne **et** après elle si une étape a tourné.
- **Outillage** : un quatrième `override` dans `biome.jsonc` portant `noJsRestrictedProperties`,
  et un fichier neuf `tools/biome/no-environment-read.grit`. Les deux pièces sont
  **complémentaires** : la règle de configuration voit `Date['now']()` et la forme déstructurée,
  mais **jamais la liste d'arguments** ; le plugin voit tout ce qui s'y joue — le constructeur
  `Date` à toutes les arités, `Intl.*()` sans locale, `Intl.DateTimeFormat` sans `timeZone`. La
  ligne du tableau d'AGENTS.md cesse de dire « à outiller » **et** nomme ce que la machine ne
  couvre pas. ⚠️ **Corrigé après revue :** cette ADR annonçait d'abord *cinq* contournements
  « tous muets ». Il y en a **trois** — l'alias, `Intl.NumberFormat(undefined, opts)` et
  `Intl.NumberFormat(...args)` — et **deux FAUX POSITIFS**, parce que le motif
  `$args <: not contains \`timeZone\`` compare du **texte source** et non une valeur :
  `Intl.DateTimeFormat('fr-FR', options)` avec `options` déclaré ailleurs, et
  `Intl.DateTimeFormat(...args)`, sont **refusés alors qu'ils sont corrects**. C6 doit donc écrire
  son objet d'options **en ligne**. *Une couverture partielle déclarée totale est le défaut que ce
  tableau existe pour empêcher — et se tromper de sens sur un angle mort envoie le relecteur
  chercher un trou qui n'existe pas pendant que le vrai défaut bloque le lot d'après.*
- **Playground** : une facture qui calcule son total (60), sa remise (6), son reste à payer
  (54), son prix moyen en division gardée (20), son échéance (`2026-02-19`), son « 45 jours fin
  de mois » (`2026-03-31`) et ses jours de retard (19) — **aucun montant n'est fourni par le jeu
  de données, c'est le point** — plus une section « refus compréhensible » qui évalue quatre
  formules fautives et affiche `details.code`, `details.site` et `details.at`. La section
  « Données requises » ne rend qu'une seule clé, `commande.lignes` : aucun alias n'en sort, ni
  celui de la boucle, ni celui de l'agrégat, ni celui du filtre. C'est aussi le seul
  consommateur réel du barrel, donc le seul endroit qui révèle un export oublié dans
  `index.ts`.

---

## Ce que cette décision tient pour acquis

1. **Le projet est en pré-v1.0, aucun template client n'existe en stockage.** Vérifié : aucun tag
   git, aucun workflow de publication, `packages/core` en `0.1.0`. Cette hypothèse **n'autorise
   pas** la décision 9 — qui livre une migration — mais elle porte **seule** les trois
   rétrécissements de la décision 2, dont aucun n'est rattrapable par une migration.
2. **Les deux entrées d'Openview reçoivent de la donnée simple** — résultat d'un `JSON.parse` ou
   d'un `structuredClone` — **sans accesseur ni proxy**. L'hypothèse porte sur **deux** endroits :
   - **la portée d'évaluation** : un accesseur est invoqué à chaque lecture, et `childScope` en
     invoque un par itération — avec les agrégations, le nombre de lectures d'un même chemin passe
     de O(1) à O(n) ;
   - **l'entrée de `parseTemplate`** : le garde promet « aucun **getter déclaré** ne s'exécute »,
     jamais « aucun code ne s'exécute », et un `Proxy` est hors modèle de menace.

   Ce n'est pas une recommandation, c'est **la condition sous laquelle le déterminisme est
   promis**.

---

## Ce qui reste ouvert

**L'arrondi (C2).** ✅ **Tranché le 2026-08-15 par l'[ADR 0004](0004-les-arrondis-declares-par-le-modele.md).**
Le kind enveloppe `{ kind: 'round'; value; decimals; mode }` était décidé dans sa **forme** par la
décision 4 ; ses modes, son comportement sur les demi-valeurs et son interaction avec les totaux
appartenaient à C2, et rien n'en était préempté ici. L'ADR 0004 arrête : l'arrondi porte sur la
plus courte décimale qui fait aller-retour vers le double, deux modes au vocabulaire ECMA-402,
`decimals` littéral dans `[-15, 15]`, et **zéro ligne dans `aggregate.ts`** — le critère « aucun
total ne diffère de la somme des montants affichés au-dessus de lui » est une propriété du
**modèle**, pas du moteur.

**Le formatage (C6).** `text()` rend une forme canonique, pas un affichage ; `YYYY-MM-DD` est une
représentation d'échange. La mise en forme — séparateurs, devise, date localisée — se fait au même
endroit que la mise en chaîne des nombres, c'est-à-dire dans `DataBindingStep`, avec la locale que
le **modèle** déclare. Formater dans une locale déclarée par le modèle reste permis ; **lire la
locale ou le fuseau de la machine** ne l'est pas, et c'est désormais outillé.

**La politique de la valeur absente à l'impression** — question 2 de l'ADR 0001, toujours à
l'étape 2. C1 la respecte scrupuleusement : il *propage* l'absence, il n'en décide rien.

**Les lectures par élément, et l'alias masquant une clé racine.** Les deux questions laissées
ouvertes par l'ADR 0002 sont inchangées, et C1 ajoute **deux sites** au second (`aggregate.as`,
`filter.as`) sans changer la règle. La sortie qui les résoudrait est la même : chaque lecture
associée à la portée dont elle dépend. `nodeReads` en reste la matière première.

**La traçabilité du calcul** (« d'où vient ce montant ? ») reste hors v1, comme l'écrit
`core.md`. Elle est notée ici parce que la charge d'erreur de la décision 7 — un `site` et un
`at` depuis la racine — en est la première brique involontaire.
