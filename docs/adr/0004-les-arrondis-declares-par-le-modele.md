# ADR 0004 — Les arrondis, déclarés par le modèle

- **Statut :** 🟢 **Accepté** (2026-08-15), implémentée dans `@openview/core`
- **Date :** 2026-08-15
- **Impact :** `@openview/core` (algèbre, schéma stocké, estampille), `@openview/engine` (E1
  évaluera ces arrondis, E6 les honorera « à la lettre », E8 dimensionnera un délai de worker
  avec le coût mesuré en décision 5), `@openview/designer` (D7 éditera `decimals` et `mode`),
  `@openview/core` lot C6 (le formatage hérite de la frontière écrite en décision 10)
- **Complétée par :** [ADR 0005](0005-le-tableau-de-lignes.md) — sa **décision 8** transmettait la
  contrainte « le tableau ne somme rien » au lot qui décrirait un tableau ; l'ADR 0005 l'honore **par
  le type**, `TableNode.footer` n'ayant nulle part où poser un agrégat.
- **Complète :** [ADR 0003](0003-formules-agregations-et-dates-civiles.md) — sa **décision 4**
  annonçait le kind enveloppe `{ kind: 'round'; value; decimals; mode }` dans sa *forme* et
  laissait à C2 sa *sémantique*, ses *modes* et la *nature* de `decimals`. Cette ADR les tranche.
- **Amende :** [AGENTS.md](../../AGENTS.md) §3.B — la portée du Visitor obligatoire (décision 11),
  sous mandat explicite du propriétaire du produit obtenu le 2026-08-15
- **Plan d'implémentation :**
  [docs/plans/c2-arrondis-declares-par-le-modele.md](../plans/c2-arrondis-declares-par-le-modele.md)
  — périmé une fois le lot livré, comme le dit son propre en-tête
- **Implémentation :**
  [`src/expression/types.ts`](../../packages/core/src/expression/types.ts) (`ROUND_MODES`,
  `RoundMode`, `MIN_ROUND_DECIMALS`, `MAX_ROUND_DECIMALS`, `RoundExpression`),
  [`src/expression/schemas.ts`](../../packages/core/src/expression/schemas.ts)
  (`RoundExpressionSchema`, et l'unique ajout à `printableMembers()`),
  [`src/expression/evaluator/operations/round.ts`](../../packages/core/src/expression/evaluator/operations/round.ts)
  (`roundDecimal`, `evaluateRound`),
  [`src/template/template.ts`](../../packages/core/src/template/template.ts) et
  [`src/template/migrate.ts`](../../packages/core/src/template/migrate.ts) (l'estampille 3 et sa
  migration)

---

## Contexte

`docs/roadmap/core.md` range le lot C2 parmi les lots **jamais reportés** : « des arrondis
ajoutés après coup faussent tous les modèles déjà écrits ». C'est la seule classe du contrat
qui soit **rétroactivement destructrice** — un arrondi introduit après le premier modèle client
change la valeur de tout ce qui a été écrit, sans qu'aucune migration ne le rattrape.

Avant ce lot, l'algèbre n'arrondissait nulle part et ne le pouvait nulle part. Trois verrous le
disaient :

- aucun des 18 kinds de l'ADR 0003 n'arrondissait, si bien que tout montant restait un binary64
  brut jusque dans `text()` ;
- un message **rendu à l'auteur du modèle** était sans remède — « *Round the value first: the
  algebra has no rounding of its own* » sur un `dateAdd` fractionnaire ;
- la forme du kind était annoncée dans une **docstring publiée**, donc due.

### Le cadre, qui n'est pas rediscuté ici

Openview est un **moteur d'édition embarquable**. Il fournit la **capacité** et jamais la
**règle**. La clause du README dit la limite dans les termes qui tranchent ce lot :

> « **Openview ne décide d'aucune règle fiscale, comptable ou légale.** Il ne détermine jamais,
> notamment : […] une règle d'**arrondi légal** — **l'arrondi est déclaré par le modèle, donc
> choisi par son auteur**. »

> 🔑 **La règle qui coupe la dérive, appliquée aux arrondis.** La capacité s'arrête au **kind qui
> exécute une déclaration**. Elle ne va jamais jusqu'à une valeur par défaut, jusqu'à un mode
> privilégié, jusqu'à un arrondi automatique d'une opération, ni jusqu'à une table qui
> associerait une devise à un nombre de décimales. Un défaut d'arrondi serait une **position
> d'arrondi de fait**, c'est-à-dire une règle.

### Ce que les mesures de ce document valent

Toutes les mesures ci-dessous ont été **rejouées le 2026-08-15 sur Node 24.11.1**, machine de
livraison, contre l'implémentation livrée. Chacune porte son protocole, parce qu'une mesure sans
protocole n'est pas rejouable et qu'un chiffre non rejouable finit par être recopié faux. Les
sondes qui dépendent d'un build d'ICU (`Intl`) sont consignées **ici** et **jamais committées
en test** : le dépôt a déjà tranché ce type d'arbitrage pour `textCase` en gelant des vecteurs.

---

## Décision 1 — Un seul kind enveloppe, et la couture posée par C1 est **constatée**, pas rouverte

`{ kind: 'round'; value: PrintableExpression; decimals: number; mode: RoundMode }`, membre de
`PrintableExpression`, **trois champs requis**. Aucun second kind, aucune option d'arrondi sur
`aggregate`, aucun champ `precision?`.

**Pourquoi.** La forme est écrite dans une docstring publiée et dans la décision 4 de l'ADR
0003 ; la rouvrir coûterait une contradiction de textes pour un gain nul, car elle est bonne. Et
la mesure la confirme au lieu de s'en accommoder : sur les cinq lignes de référence du lot,
`round(sum(…))` vaut **63,25** et `sum(…, round(…))` vaut **63,26**. La **position dans l'arbre
*est* la déclaration** ; un champ `precision?` n'aurait pas su exprimer le premier cas, faute de
nœud intermédiaire où l'accrocher.

**Écarté.**

- Un second kind `roundTo(value, step, mode)` pour l'arrondi au multiple : `mul(round(div(x,
  step), 0, m), step)` l'exprime, et extraire un kind plus tard est facile là où retirer une
  abstraction inutile ne l'est jamais. *Signal de réouverture : une demande nommant un pas qui ne
  soit pas une puissance de dix.*
- Un `roundEach` sur `aggregate` : optionalité conditionnelle, refusée par l'ADR 0003 décision 3
  (« la composition remplace l'optionalité, et tous les champs restent requis partout »). *Signal
  de réouverture : aucun — c'est la composition qui répond.*

**Irréversible.**

---

## Décision 2 — L'arrondi porte sur le nombre **tel qu'il s'écrit**, pas sur le binaire dessous

L'opération est définie sur **la plus courte décimale qui fait aller-retour** vers le double —
exactement ce que `toExponential()` rend et ce que `text()` imprime. Donc
`round(1.005, 2, 'halfExpand')` vaut **`1.01`**, `round(0.615, 2, m)` vaut `0.62`,
`round(2.675, 2, m)` vaut `2.68`.

**La réserve, énoncée d'abord :** `1.005` est stocké comme `1.00499999999999989…`, et une
sémantique binaire répondrait donc `1`. Notre réponse est `1.01`. C'est le **bon** résultat, et
le motif est le lot C8 : *un auteur de modèle ne doit jamais avoir à apprendre l'IEEE-754 pour
comprendre son document*. « 0,615 s'arrondit à 0,62 » est une explication complète ; « 0,615 est
en réalité 0,614999999999999991118 » ne l'est pas, c'est un aveu.

### Les trois sémantiques possibles, mesurées

| Sémantique | `1.005` | `0.615` | `2.675` | `0.145` | `8.575` | `1.255` |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| **binaire exacte** (`Number(x.toFixed(d))`) | `1` | `0.61` | `2.67` | `0.14` | `8.57` | `1.25` |
| **mise à l'échelle** (`Math.round(x*100)/100`) | `1` | **`0.62`** | **`2.68`** | `0.14` | `8.57` | `1.25` |
| **décimale imprimée** (retenue) | `1.01` | `0.62` | `2.68` | `0.15` | `8.58` | `1.26` |

La mise à l'échelle est **juste sur `0.615` et `2.675`, fausse sur `1.005`, `0.145`, `8.575` et
`1.255`** : quatre exemples sur six. Elle n'est pas seulement fausse, elle est **inconstamment**
fausse — et « prévisible » est un mot du critère de recette.

### Quatre mesures, toutes rejouables (Node 24.11.1)

1. Sur les **100 000 ties exacts** `.xx5` à deux décimales, la sémantique binaire diverge de la
   décimale imprimée sur **48 000 (48,00 %)**. `Number(x.toFixed(2))` diverge exactement autant :
   c'est la même sémantique.
2. La mise à l'échelle diverge sur **4 588 de ces ties (4,59 %)** et sur **4 588 des 1 000 001
   valeurs `k/1000` (0,459 %)**.
3. `Intl.NumberFormat` implémente la sémantique décimale imprimée. Confronté sur **720 012 cas**
   (2 modes × 6 précisions × 60 001 valeurs `k/1000`) : **0 divergence**. La référence normative
   que tout intégrateur ouvrira dans sa console donne notre résultat, et contredit la sémantique
   binaire.
4. **Décisif : sous la sémantique binaire, le champ `mode` serait quasi décoratif.** Sur le
   million de valeurs `k/1000` arrondies à deux décimales, le mode change le résultat **2 000
   fois (0,200 %)** en sémantique binaire contre **50 000 fois (5,000 %)** en sémantique décimale
   imprimée — **vingt-cinq fois plus**. La raison est structurelle : un tie exact au sens binaire
   n'existe que sur les **odd multiples de 1/8**, dont il n'y a que **4 000** dans cette
   population. L'auteur qui déclare `halfEven` pour `0.145` obtiendrait le même chiffre qu'en
   `halfExpand` et croirait le champ cassé. **Un lot dont la raison d'être est « deux modèles
   arrondissant différemment produisent deux résultats différents » ne peut pas se payer une
   sémantique qui rend le mode inopérant dans 99,8 % des cas.**

### Le déterminisme est plus fort ici que pour `textCase`, pas plus faible

ECMA-262 fixe la forme décimale la plus courte (« f as small as possible ») **et** fixe la
conversion chaîne → nombre comme la valeur exacte arrondie **une seule fois** au plus proche.
Ni l'une ni l'autre n'est indexée sur une version d'ICU, là où `textCase` dépend de la version
Unicode du moteur. **Ces deux moitiés sont la condition sous laquelle cette décision promet le
déterminisme** ; elles sont énoncées ici pour que la condition soit relisable.

**Un piège de formulation, à ne pas réintroduire :** ne jamais écrire qu'un résultat est « un
multiple de `10 ** -decimals` ». C'est faux du double rendu, `0,01` n'étant pas représentable —
mesuré, **11,81 %** de 200 000 résultats à deux décimales ne satisfont pas
`r * 100 === Math.round(r * 100)`. La formulation juste est : *le résultat est le double le plus
proche du multiple de `10^-decimals`, et sa forme décimale la plus courte **est** ce multiple.*

**Écarté.** (a) `Number(x.toFixed(d))` : exact et spécifié, mais c'est la sémantique binaire, il
rend une **chaîne** — donc préempte C6 — et il n'offre qu'un mode sur deux. (b)
`Math.round(x * 10 ** d) / 10 ** d`. (c) Un correctif `toPrecision(15)` avant mise à l'échelle :
une constante magique, c'est-à-dire une règle de pouce déguisée en contrat.

**Irréversible, et c'est le renversement le plus coûteux du lot** : revoir cette décision après
le premier modèle client changerait la valeur de tous les modèles déjà écrits, sans qu'aucune
migration ne le rattrape.

---

## Décision 3 — Deux modes, vocabulaire ECMA-402 : `halfExpand` et `halfEven`

`ROUND_MODES = ['halfExpand', 'halfEven'] as const`. Requis, sans défaut. Les modes dirigés
(`ceil`, `floor`, `expand`, `trunc`) et les demi-modes directionnels (`halfCeil`, `halfFloor`,
`halfTrunc`) sont **hors périmètre de C2**.

**Pourquoi le champ existe.** Un mode unique ne serait pas un contrat plus petit, ce serait une
**règle** : Openview déclarerait comment un montant s'arrondit. Deux est le plus petit nombre qui
rende vraie la phrase du README.

### Pourquoi pas plus — et sur quel motif exactement

Le motif est **celui que le dépôt a déjà écrit : aucun usage nommé aujourd'hui, règle
anti-sur-ingénierie, et un ajout ultérieur au coût d'une seule migration d'estampille qui
n'invalide aucun modèle stocké.** C'est la décision la moins chère à différer du lot.

Le motif **n'est pas** le danger. Refuser une opération correcte au motif qu'elle exposerait
l'auteur à une surprise numérique **inventerait un critère d'admissibilité** sans précédent
écrit, et ce critère servirait ensuite à refuser autre chose : `docs/roadmap/README.md` §2 dit
« on ajoute volontiers une opération », et l'ADR 0003 a délibérément rendu les surprises binary64
**visibles et contractuelles** plutôt que de les masquer.

### La mesure de fragilité, consignée **ici et nulle part ailleurs**

Elle sera précieuse le jour de la réouverture. Elle ne figure **pas** dans la docstring de
`ROUND_MODES` : `packages/core/package.json` déclare `publishConfig.access: public` et
`files: ["dist"]`, donc une docstring est émise telle quelle dans `dist/**/*.d.ts` et
**publiée**. Le lot refuse une table devise → décimales « y compris dans un exemple de
docstring » (décision 12) ; y laisser un taux de fragilité mesuré serait le même geste.

> **Protocole.** 200 000 sommes de deux montants à deux décimales tirés uniformément dans
> `[0, 1000]`, PRNG `mulberry32` graine 1, Node 24.11.1.
>
> - **21,5 %** des doubles ne sont pas la valeur décimale à deux décimales que leurs deux termes
>   annoncent. Exemple tiré de la population elle-même : `627.08 + 2.73 === 629.8100000000001`.
> - **12,7 %** seulement portent réellement plus de seize chiffres significatifs — le libellé
>   « résidu au 16ᵉ chiffre » serait donc faux, c'est un **résidu décimal**, pas un dépassement de
>   précision.
> - Un `ceil` à deux décimales rend un centime **trop haut dans 10,7 %** des cas, silencieusement.
> - Sur les mêmes tirages, `halfExpand` s'est trompé **0,00 %** du temps.
>
> Le mécanisme, qui est la vraie information : **un mode dirigé lit TOUS les chiffres écartés**,
> là où un demi-mode ne regarde que celui qui suit immédiatement la position d'arrondi.

Les modes dirigés restent **parfaitement implémentables** — ce n'est pas une limite de
l'algorithme, et l'ajouter coûterait deux branches dans `keptDigits`.

### Le contournement, consigné comme contournement daté

`round(add(x, 0.005), 2, m)` approche un `ceil` au centime. **C'est un bricolage**, aussi
sensible au résidu que le mode refusé, et il est écrit **ici** plutôt que dans une documentation
d'usage : un refus dont on cache le contournement devient du folklore. La formulation rendue à
l'auteur du modèle appartient de toute façon à C8 (ADR 0003, décision 7). *Daté du 2026-08-15 ;
il disparaît le jour où un mode dirigé est admis.*

**Signal de réouverture :** *une demande nommant un besoin métier qui doit arrondir dans une
direction **dans** le modèle* (« toute unité commencée est due », prorata au centime supérieur).
Le reconnaître le moment venu fait partie de la décision — au lieu de l'enterrer dans un `if`
alambiqué ou dans un `add(x, 0.005)` dont personne n'a écrit qu'il en est un.

### Pourquoi ces noms

`halfUp` signifie « vers +∞ » pour la moitié de l'industrie (ECMA-402 appelle cela `halfCeil`) et
« à l'opposé de zéro » pour l'autre (Java `HALF_UP`) ; sur un avoir, les deux diffèrent d'un
centime à chaque ligne. **Un champ qui décide un centime ne se nomme pas d'un mot qui veut dire
deux choses.** Le vocabulaire ECMA-402 reste de plus cohérent si le jeu est un jour élargi, et il
rend la vérification par oracle auto-documentée.

**Une précision sur ce que `halfEven` garantit, à ne pas transformer en promesse plus forte.**
`halfExpand` déplace tout tie dans le même sens, à l'opposé de zéro : sur des montants positifs,
ses ties tirent donc toujours le total **vers le haut**. `halfEven` n'a pas de direction propre —
où va un tie est décidé par la parité du chiffre précédent, qu'aucun montant ne choisit. Il **ne
s'ensuit pas** qu'un total ne dérive jamais vers le haut : un jeu dont tous les montants
finissent en `.135` monte tous ses ties en `halfEven` aussi. La propriété est **l'absence de
direction systématique dans le mode**, jamais une garantie sur un jeu de montants arbitraire.

**Écarté.** (a) Les neuf modes d'ECMA-402 : quatre n'ont aucun usage nommé. (b)
`halfUp`/`halfEven` : ambigu sur le signe, incohérent avec une réouverture. (c) `bankers`,
`commercial`, `legal`, `arrondiLegal`, `swedish`, `cash`, `fiscal` : décision 10 de l'ADR 0003 —
un nom désigne une opération, jamais une règle. `halfEven` est le nom de « l'arrondi du banquier »
quand on le **décrit** au lieu de l'**invoquer**.

**Réversible dans le sens de l'élargissement uniquement.**

---

## Décision 4 — `decimals` est un littéral entier borné à `[-15, 15]`

`z.number({ error }).int().min(-15).max(15)`, champ scalaire du nœud, **jamais une expression**.

**Pourquoi littéral.** Trois raisons, la troisième est décisive.

1. Il est tranché au **save time**, doctrine que `PathExpressionSchema` énonce déjà à cet endroit
   exact.
2. Il permet à D7 (l'éditeur) d'offrir un compteur ou une liste fermée de 31 entrées, plutôt qu'un
   éditeur de formule imbriqué.
3. **« Ce total arrondit-il comme les lignes au-dessus ? » doit être répondable sans données.**
   Avec un littéral, c'est la comparaison de deux entiers dans l'arbre, faite par un relecteur, par
   un lecteur du JSON, ou par la barre de formule de D7. Avec une expression, la question devient
   indécidable avant un rendu — et un critère que personne ne peut vérifier avant de rendre n'est
   pas un critère.

### Pourquoi ces bornes — une preuve d'un côté, un aveu des deux

- **Borne haute, prouvée.** Le nombre de chiffres d'une forme décimale la plus courte est au plus
  17, et le nombre de chiffres à écarter vaut `drop = len − 1 − exp − d`. Pour tout `|valeur| ≥ 1`
  on a `exp ≥ 0`, donc `drop ≤ 17 − 1 − 0 − 16 = 0` dès `d = 16` : **`16` est la première position
  qui est l'identité pour toute valeur de magnitude ≥ 1, et `15` est donc la dernière qui puisse
  encore changer un montant.** Ce n'est pas `DBL_DIG` invoqué comme un slogan, c'est une inégalité.
- **Borne basse, assumée.** Ce n'est **pas** une décorativité : c'est un **rétrécissement
  délibéré sur le domaine documentaire** — aucun montant de facture n'a de sens au-delà de `1e15`
  — ancré sur le fait que `Number.isSafeInteger(1e15)` est `true` et `Number.isSafeInteger(1e16)`
  est `false`.
- **Et la même réserve vaut en haut, pour les petites valeurs.** Mesuré :
  `roundDecimal(0.12345678901234566, 16, 'halfExpand')` rend `0.1234567890123457`, **différent**
  de l'entrée ; `roundDecimal(1.23456789e20, -16, 'halfExpand')` rend `1.2346e20`, **différent**,
  et `1.2346e20 === 12346 * 1e16` est `true` — la valeur est exactement sur la grille. **Aucune
  borne finie ne rend la décorativité universelle. La fenêtre est donc documentaire des deux
  côtés, et sa borne haute coïncide avec le point exact où elle devient décorative pour toute
  magnitude ≥ 1.**

### Ce qui suit d'un `decimals` littéral, et qu'il faut nommer avant que C6 ne le subisse

Le critère de recette de C6 est écrit : « un unique modèle de facture produit deux documents
corrects dans deux langues et **deux devises**, sans duplication du modèle ». Avec un `decimals`
littéral, une précision par devise n'est pas pilotée par les données : elle passerait par un `if`
dans l'arbre.

> 🔑 **Porte de sortie, écrite ici pour que C6 ne la découvre pas en la subissant.** La précision
> par devise **reste ouverte** et ne passera **pas** par le nœud `round` : elle relèvera d'un
> mécanisme de C6 — une déclaration au niveau du **modèle** associant un couple locale/devise à
> une échelle — que C2 ne préempte ni ne fournit. Ce que C2 fixe, c'est que l'échelle **de
> calcul** est dans l'arbre ; l'échelle **d'affichage** appartient à C6, et la décision 10 dit à
> quelles conditions.

**Écarté.** (a) `decimals: PrintableExpression` : coûte un site de descente, un segment `at`, un
garde runtime et un message neuf, pour un cas d'usage déjà exprimable, et rend la propriété
comptable invérifiable statiquement. (b) `[0, 15]` : ampute le négatif — un tableau de synthèse
« en milliers » est une capacité, pas une règle — sans économiser une ligne, l'algorithme étant
symétrique. (c) Non borné : `Number('1e1000000000')` vaut `Infinity`, et surtout aucune liste
fermée n'est possible pour D7.

**Irréversible dans le sens du rétrécissement** : aucune migration ne ramène dans l'intervalle
une valeur stockée hors bornes. C'est le **quatrième** rétrécissement de valeur du contrat, après
les trois de l'ADR 0003 décision 2, et il s'adosse à la **même hypothèse pré-v1.0** : aucun
template client n'existe en stockage (`git tag` ne rend rien, aucun workflow de publication,
aucun `.changeset/`, les quatre paquets en `0.1.0`). Le jour où cette hypothèse tombe, ce sont
**quatre bornes à rediscuter une par une**, pas un lot à rouvrir.

---

## Décision 5 — L'implémentation : chirurgie sur la chaîne de chiffres, une seule conversion binaire

`toExponential()` pour les chiffres les plus courts, retenue manuelle sur la chaîne,
reconstruction par un unique `Number(...)`. Ni `10 ** d`, ni `toFixed`, ni `BigInt` en
production, ni dépendance.

**Pourquoi.** Une seule conversion chaîne → nombre, donc **un seul arrondi binaire**, à la fin :
aucune mise à l'échelle intermédiaire n'apporte son erreur. `10 ** d` est exclu parce que
l'exponentiation est *implementation-approximated* en ECMA-262 — l'argument que le dépôt a déjà
employé pour tenir `Math.pow` hors de l'algèbre.

**Une garde de finitude en tête de fonction, et elle porte.** Sans elle,
`roundDecimal(NaN, 2, m)` rendait **`0.01`** — un `NaN` ni propagé ni refusé, **converti en
centime**. Le mécanisme ne se devine pas : `Math.abs(NaN).toExponential()` rend `"NaN"`, où
`indexOf('e')` vaut `-1` ; `exponent` devient `NaN`, donc `drop` aussi — et **`NaN <= 0` est
`false`**, si bien que le retour anticipé « déjà sur le réseau » ne se déclenche pas. C'était le
seul endroit où ce lot pouvait écrire un montant faux dans un document. `±Infinity`, lui, sortait
déjà correctement par ce même retour anticipé.

La garde **rend la valeur inchangée** plutôt que de lever : la levée appartient à
`evaluateRound`, qui refuse en amont par `requireNumber` et en aval par `requireFiniteResult`. Un
helper numérique pur qui lèverait ouvrirait un **second site de levée hors de `fail()`**, ce que
l'invariant de C1 interdit. **Le helper n'invente jamais un nombre ; l'évaluateur refuse.**

### Le protocole de vérification, rejouable

- **Sonde de développement, consignée et non committée :** 4 400 022 comparaisons contre une
  référence BigInt écrite indépendamment (expansion de la forme décimale la plus courte, arrondi
  entier exact, départage explicite) — **0 divergence**.
- **Test committé, qui est la version rejouable en CI :** onze `it`, un par position de
  `{-15, -9, -5, -2, 0, 1, 2, 3, 5, 9, 15}`, **20 000 tirages chacun**, deux modes — soit
  **440 000 cas** — contre la même référence BigInt, écrite dans le fichier de test. **0
  divergence.** Le tirage porte sa loi et sa graine : PRNG `mulberry32`, graine
  `0x9E3779B9 ^ (decimals + 16)` — **une par position**, et chaque `it` repart de la sienne, pour
  qu'un `-t` sur un seul `it` rejoue exactement la même population. La population est en deux
  moitiés : 10 000 « montants » (`signe · entier dans [0, 10¹²) / 10^p`, `p` dans `[0, 6]` —
  écriture décimale courte, donc des *ties* exacts) et 10 000 « doubles quelconques » (mantisse de
  52 bits, exposant dans `[-40, 40]` — écriture décimale longue, donc la chirurgie sur la chaîne).
- `Math.random` est **refusé par la machine** sous `packages/core/**` (`noJsRestrictedProperties`,
  `biome.jsonc`), tests compris. Un test irreproductible ne mesure rien.
- **34 vecteurs figés**, dont **douze divergent sur le mode** — trois d'entre eux existent parce que
  l'instrumentation a montré que rien ne les atteignait : `[0, 2, 0, 0]` (l'entrée nulle, qu'un
  tirage continu n'atteint jamais), `[2.1251, 2, 2.13, 2.13]` (la disjonction `restNonZero`) et
  `[-5e-324, 2, 0, 0]` (le zéro non signé, `toBe` étant `Object.is`).
  **Ce qui couvre `round.ts` à 100 %, c'est la SUITE, pas les vecteurs seuls**, et la distinction
  compte pour qui voudrait élaguer : mesuré au filtre `-t "frozen"`, les 34 vecteurs atteignent
  **88,88 % des instructions et 91,17 % des branches**. Aucun d'eux n'est non fini, donc la garde
  de finitude n'est jamais franchie, et aucun n'appelle `evaluateRound`. Ce sont les `it` de
  non-finitude, de débordement et d'évaluation qui ferment les 100 % — retirer l'un des trois fait
  passer le paquet sous le seuil de 90 %.
- **Piège vérifié, à ne pas réintroduire.** Une version naïve du cas « tous les chiffres tombent »
  répond `130` à `round(120, -1, m)`. Ce qui le répare est la distinction *adjacent* : **seul un
  décalage d'exactement une place peut atteindre le demi.** Un vecteur figé l'épingle.
- Idempotence, monotonie, finitude et absence de `-0` : **0 violation**, sur les onze positions et
  les deux modes.

### Le coût en temps mural, pour E8 — et pourquoi c'est un **rapport** et pas un chiffre

> **Protocole.** Node 24.11.1, 200 000 itérations de chauffe puis **2 000 000 d'appels**, valeurs
> pré-tirées, puits de somme.

| Machine | `roundDecimal`, 17 chiffres | mélange facture | `Number(x.toFixed(2))` | multiplication | rapports |
| :--- | ---: | ---: | ---: | ---: | ---: |
| référence du plan | 1 521 ns | 1 228 ns | 980 ns | 49,8 ns | 31× / 25× |
| machine de livraison (2026-08-15) | **378 ns** | **120 ns** | 110 ns | 6 ns | **67× / 21×** |
| trois autres machines | 4 838 / 2 904 / 2 562 ns | 1 467 / 963 / 1 035 ns | — | — | jusqu'à 110× |

**Les chiffres absolus ne voyagent pas** : douze fois d'écart entre les extrêmes, dans les deux
sens autour de la référence. Une version antérieure annonçait une dispersion de « 0,8× à 3,2× » ;
la machine de livraison la réfute d'un facteur 4 à 10.

**Et le RAPPORT ne voyage pas davantage, ce qu'une version antérieure de cette section affirmait
pourtant** en donnant « 21× à 110× » pour énoncé opposable. Une multiplication en boucle serrée
se mesure de 1,2 ns à 50 ns selon ce que V8 sort de la boucle : le dénominateur bouge autant que
le numérateur, et sur la machine de livraison le même `round` vaut 21× ou 52× selon le harnais.

**Deux chemins rapides ajoutés le 2026-08-16** (revue de code, constats 6 et 7) changent la forme
plutôt que l'échelle. Mesurés avant/après sur une machine, à puits identique et **0 divergence sur
16 800 624 comparaisons** : entiers **102 → 6 ns**, mélange facture **114 → 61 ns**, 17 chiffres
**369 → 338 ns**. Un `round` qui tombe sur l'identité — une position déjà atteinte, un montant
entier — ne coûte plus qu'un petit multiple d'un nœud arithmétique.

> **L'énoncé opposable est qualitatif, et il suffit à E8 :** un nœud `round` qui **arrondit
> vraiment** dépense **un** pas de budget et coûte **un à deux ordres de grandeur** de plus qu'un
> nœud arithmétique en temps mural ; un `round` qui rend l'identité coûte désormais un petit
> multiple. Ce n'est pas un problème de borne, la borne compte des pas ; c'est un problème de délai
> de worker — **et il se re-mesure sur la machine qui dimensionne le délai**, jamais ici.

**Écarté.** (a) L'algorithme de Dekker : exact — mais exact pour la sémantique **binaire**, que la
décision 2 refuse ; et l'ordre de ses quatre additions porte la correction sans qu'aucun outil ne
le protège. (b) Une expansion décimale exacte en BigInt en production : donnerait `1.005 → 1.00`,
c'est-à-dire encore la sémantique binaire, pour trois fois le coût. (c) `decimal.js` / `big.js` :
refusé par l'ADR 0003 décision 4 et par AGENTS.md §7.

**Réversible** — le corps de trois fonctions, tant que les vecteurs figés restent verts.

---

## Décision 6 — Politique d'erreur : **zéro code nouveau**

| Situation | Réponse |
| :--- | :--- |
| Opérande absent | propage `undefined` |
| Opérande présent non numérique | `operand-type` en `['value']`, site `'round'` |
| Opérande `NaN` / infini | `not-finite` en `['value']` |
| Débordement en **sortie** | `not-finite` en `[]` |
| `decimals` fractionnaire, non fini, hors bornes ; `mode` inconnu | refusés **par Zod au save time**, jamais au rendu |

Aucune entrée ajoutée à `OPERAND_ERROR_CODES` ni à `LIMIT_ERROR_CODES` ; `ExpressionErrorSite`
s'élargit tout seul par dérivation d'`ExpressionKind`.

**Pourquoi.** C'est le meilleur résultat que C2 puisse offrir à C8 : **aucun message neuf à
écrire**. La politique de C1 s'applique mot pour mot, et l'absence propagée compose
**gratuitement** avec l'agrégation, qui ignore un élément absent — d'où la décision 7 sans une
ligne dans `aggregate.ts`.

**Le garde de sortie n'est pas décoratif.** Dans la fenêtre `[-15, 15]` il ne peut pas se
déclencher, et aucun tirage n'a produit de résultat non fini. Mais `evaluateExpression` est
**publique** et prend un `Expression` de n'importe où — l'argument que la borne de profondeur
documente déjà — et un `{ decimals: -308 }` construit à la main sur `Number.MAX_VALUE` reconstruit
`Infinity`. Un document ne doit jamais en porter un : le garde reste, et un test construit ce nœud
à la main.

### La réserve du message d'infini, et sa correction

Une version antérieure de ce lot tenait `NaN` et `Infinity` pour « refusés avec le message par
défaut de Zod ». Le message est bien un refus, mais il est **auto-contradictoire pour les
infinis** : mesuré sur `zod@3.25.76` via `zod/v4`, `decimals: Infinity` rend **`Invalid input:
expected number, received number`**. C'est exactement le défaut de charge que C1 a corrigé en
créant `not-a-whole-number`. Laisser ce message serait livrer, dans le seul lot dont la promesse
est « zéro message neuf », le seul message illisible.

**Correction, mesurée : `z.number({ error: '…' })`.** Un `.refine(Number.isFinite, …)` **ne marche
pas** — `z.number()` refuse l'infini avant que le refine ne tourne. Avec le paramètre `error`, les
six messages du champ deviennent tous lisibles, et **chaque validateur rend bien le sien** (la
crainte que le message global écrase `.int()`, `.min()` et `.max()` est mesurément fausse) :

| Entrée | Message |
| :--- | :--- |
| `decimals: 2.5` | `A rounding position is a whole number of decimal places` |
| `decimals: 16` | `A rounding position may not exceed 15` |
| `decimals: -16` | `A rounding position may not go below -15` |
| `decimals: NaN` | `A rounding position is a finite whole number of decimal places` |
| `decimals: Infinity` | `A rounding position is a finite whole number of decimal places` |
| `mode: 'halfUp'` | `Invalid option: expected one of "halfExpand"\|"halfEven"` |

**Une conséquence de dépendance, à noter :** *la totalité de cette décision repose sur le
comportement de Zod.* « Zéro code d'erreur nouveau » n'est vrai que parce que `decimals` et `mode`
sont tranchés au parse. Si Zod cessait de refuser une de ces formes, C2 devrait un garde runtime,
un code, et C8 un message.

**Écarté.** (a) Un code `precision-out-of-range` : il n'existerait que pour un arbre non parsé.
(b) Réutiliser `not-a-whole-number` pour `decimals: 40` : 40 *est* entier, la charge mentirait.
(c) Supprimer `requireFiniteResult` au motif d'une branche non couverte : elle est atteignable
*et* testable.

**Réversible.**

---

## Décision 7 — L'agrégation n'est pas touchée : le critère est une propriété du **MODÈLE**

Zéro ligne modifiée dans `aggregate.ts`. L'ordre d'accumulation reste positionnel et contractuel,
l'absence reste ignorée, `sum` d'une liste vide reste `0`. Le modèle qui satisfait le critère de
recette arrondit **aux deux niveaux** : `round(sum(lignes, l, round(mul(l.q, l.p), 2, m)), 2, m)`.
**Openview ne l'impose pas.**

**Pourquoi l'arrondi extérieur est nécessaire, et mesuré.** La somme des lignes arrondies
`20 + 30 + 10 + 2.13 + 1.13` vaut **`63.260000000000005`**, et `text()` l'imprimerait tel quel.
Avec l'enveloppe, `round(63.260000000000005, 2, m)` vaut `63.26` — et **la même somme dans un
autre ordre** (`2.13 + 1.13 + 20 + 30 + 10 === 63.26`) donne le même total arrondi.

### Jusqu'où la propriété tient — une preuve, puis une mesure, et il ne faut pas les confondre

**La borne prouvée.** L'erreur de la `k`-ième addition est bornée par la demi-`ulp` de son
**résultat**, c'est-à-dire de la somme partielle `s_k`, **jamais du total final**. La dérive est
donc bornée par `N · ulp(M)/2`, où `M = max_k |s_k|` est la plus grande magnitude atteinte en
cours d'accumulation. La propriété est garantie tant que `N · ulp(M)/2 < 0,005`. À `N = 1 000` :
`ulp(M)/2 < 5·10⁻⁶` exige `ulp(M) < 10⁻⁵`, or `2⁻¹⁷ ≈ 7,63·10⁻⁶` couvre `M < 2³⁶ ≈ 6,87·10¹⁰`.

**Écrire `T` au lieu de `M` est faux, et il faut dire pourquoi.** C'est vrai **uniquement** si les
sommes partielles restent bornées par le total, donc si tous les montants sont de **même signe**.
Openview ne peut pas l'imposer : un avoir, une remise, une régularisation portent un montant
négatif. Le contre-exemple tient en une ligne, déjà au centime :

```
100000000000000 + 0,01 - 100000000000000
```

Mesuré : l'accumulation positionnelle rend **`0,015625`** — soit exactement `ulp(10¹⁴)`, la
demi-`ulp` de la **somme partielle**, pas du total — et l'arrondi extérieur à deux décimales donne
**`0,02`** là où la somme exacte vaut `0,01`. Le total final est ici `0,01`, douze ordres de
grandeur **sous** la borne annoncée : une borne lue sur `T` l'aurait déclaré couvert.

> **L'énoncé juste, indépendant du modèle, et il garde le même nombre.** Comme `M ≤ Σ|montants|`,
> la garantie se lit sur la somme des **valeurs absolues** : **la propriété est garantie, sans
> tirage, tant que `Σ|montants| < ~6,9·10¹⁰` sur 1 000 lignes** — et elle se transpose à n'importe
> quel nombre de lignes, ce qu'un tirage ne fait pas. Sur des montants tous de même signe,
> `Σ|montants| = |T|` et la lecture « sur le total » redevient exacte : c'est le cas usuel d'une
> facture, ce n'est pas le cas général d'un modèle.

**La mesure, qui va bien au-delà de la garantie.**

> **Protocole.** `N = 1 000` lignes ; le montant de chaque ligne est tiré **uniformément au
> centime dans `[0, 2·T/N]`** ; **2 000 factures par palier** ; PRNG `mulberry32`, **graines 1, 7
> et 42** ; accumulation positionnelle en binary64 ; arrondi extérieur
> `roundDecimal(acc, 2, 'halfExpand')` comparé au **double le plus proche de la somme exacte en
> centimes** (BigInt). Node 24.11.1.
>
> ⚠️ **Cette loi tire dans `[0, 2·T/N]`, donc des montants tous POSITIFS**, donc
> `Σ|montants| = T` : le tableau ci-dessous mesure le **cas de même signe**, et il ne dit **rien**
> d'un jeu de lignes mélangeant crédits et débits. C'est la restriction à recopier **avec** les
> chiffres, pas à côté.

| Total moyen | `5·10⁹` | `10¹⁰` | `5·10¹⁰` | `10¹¹` | `10¹²` | `2·10¹²` | `5·10¹²` | `10¹³` | `10¹⁴` |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| échecs / 2 000, graines 1 / 7 / 42 | 0 | 0 | 0 | 0 | 0 | **7 / 3 / 2** | 539 / 504 / 514 | 1 180 / 1 112 / 1 104 | 1 855 / 1 863 / 1 858 |
| écart max (€) | 0 | 0 | 0 | 0 | 0 | 0,0100 | 0,0205 | 0,0313 | 0,3438 |

**Le premier palier en échec est `2·10¹²`**, soit trente fois au-dessus de la garantie prouvée et
huit ordres de grandeur au-dessus de toute facture. La phrase juste : *garantie prouvée tant que
`Σ|montants| < ~6,9·10¹⁰` à 1 000 lignes ; mesurée sans un seul échec jusqu'à `10¹²` ; premier
échec à `2·10¹²` (2 à 7 sur 2 000 selon la graine, écart maximal 0,0100 €), **sous la loi de
tirage ci-dessus, qui est à montants positifs — les comptes en dépendent, la borne prouvée
non.*** C'est une borne de binary64, pas une borne que C2 introduit.

**Et la conséquence de périmètre, qui est la vraie raison de tenir la borne juste :** un modèle
mélangeant des signes peut sortir de la garantie **très en dessous** du total qui la nomme. Ce
n'est pas un motif de rouvrir cette décision — `aggregate.ts` ne change pas, et aucun
réordonnancement des termes ne serait légitime : l'ordre d'accumulation est **contractuel** (ADR
0003) et le trier par magnitude ferait dépendre un total de l'implémentation. C'est un motif de
**ne pas promettre à l'auteur d'un modèle une propriété qui ne tient que sur ses factures
ordinaires**.

**Écarté.** (a) Un `sum` qui arrondirait ses termes : arrondi implicite. (b) Un refus au parse
d'un `sum` non enveloppé : ce serait imposer une règle de conception, et rendre **inexprimable**
le modèle « lignes exactes, total arrondi » qui vaut `63.25`. (c) Un drapeau `roundTotals` sur le
template. Le signalement d'un total non enveloppé est un **lint de l'éditeur (D7)**, pas un refus
de `core`.

**Réversible.**

---

## Décision 8 — Aucune déclaration d'arrondi ailleurs que sur le nœud

Le contrat ne porte ni `Template.rounding`, ni défaut de document, ni héritage par sous-arbre. Un
arrondi n'existe que là où un nœud `round` est écrit.

**Pourquoi.** Un défaut au niveau du modèle est un arrondi **implicite** : `mul(q, pu)` rendrait
une valeur arrondie sans qu'aucun `round` ne figure dans l'arbre. Il casse les trois promesses qui
tiennent le lot — « visible dans l'arbre » (ADR 0003, décision 4), « la barre de formule montre ce
qui est calculé » (D7), « un refus désigne un nœud » (C8) — et il fait dépendre la valeur d'un
sous-arbre d'un champ situé ailleurs, le pire dispositif possible pour qui cherche un écart d'un
centime. Il **dégraderait** aussi C6 : l'échelle d'un nœud deviendrait
`surcharge ?? ancêtre ?? document`, une résolution que C6 devrait réimplémenter et tenir en phase.

Le besoin réel derrière « déclarer une fois » — ne pas retaper `2, 'halfExpand'` quarante fois —
est un problème d'**éditeur**, que D7 règle en pré-remplissant le widget, ce qui écrit un nœud
explicite.

**Écarté.** `Template.rounding?: { decimals, mode }` avec surcharge par nœud, aussi pour son coût
de sortie : un champ de document, une fois stocké, ne se retire qu'avec une migration
**transformante**.

**Irréversible.**

---

## Décision 9 — `schemaVersion` passe à 3, estampille unique en fin de lot

`CURRENT_SCHEMA_VERSION = 3` et `{ from: 2, to: 3, migrate: (input) => ({ ...input,
schemaVersion: 3 }) }`, dans le **même commit**, **sans fusionner** l'entrée `1 → 2`. Estampille
posée **une seule fois**, après la dernière forme persistée du lot. **Tout commit C2 antérieur est
déclaré non publiable.**

**Pourquoi.** Ajouter `RoundExpressionSchema` à `printableMembers()` élargit d'un coup
`ExpressionSchema` **et** `PrintableExpressionSchema`, donc `TextBindingSegment.value` : c'est le
« refus illisible » que `template.ts` décrit mot pour mot — `"No matching discriminator"` /
`"Invalid input"` sur un chemin `root.children.0.content.1.value.kind`, sans version nommée et
sans remède. AGENTS.md §1.2 ferme la porte de sortie : « il n'y a pas de dérogation pré-v1.0 au
versionnement ». **Que sept assertions de test rougissent n'est pas un dégât collatéral, c'est la
preuve que le versionnement est outillé.**

### La réserve, énoncée dans le bon sens

*« La migration estampille ; elle ne valide pas »* décrit exactement `migrate`. Mais la conséquence
qu'on en tirait était **fausse, et elle était écrite dans le dépôt** : un document
**sous**-estampillé n'est **pas** refusé, il est **silencieusement accepté**. Mesuré : un document
estampillé `1` portant un kind C1 rend `ACCEPTED, schemaVersion=2`.

La raison est dans le pipeline : `parseTemplate` borne la forme, **migre**, puis valide au schéma
**courant** — jamais au schéma de l'estampille lue. Le garde de version protège contre un document
écrit par un build **plus récent**, et contre rien en sens inverse ; c'est un garde de **stamp**,
pas de contenu. La docstring fautive de `migrate.ts` a été réécrite dans le commit qui pose
l'estampille, et le test correspondant est un test d'**acceptation** pour cette raison et pour
aucune autre.

**Le pipeline reste tolérant, et c'est une décision.** Valider chaque document contre le schéma de
**son** estampille exigerait de figer et de conserver un schéma par version passée, à perpétuité —
exactement le coût que la chaîne pas-à-pas existe pour éviter, et que `migrate.ts` énonce comme
contrat. C'est un lot à soi seul, pas une ligne de C2. *Si un lot futur l'introduisait, le test
d'acceptation redeviendrait un test négatif, et c'est la seule pièce à rejouer.*

**Écarté.** « C'est purement additif, donc pas d'incrément » — déjà démoli par l'ADR 0003 (« Faux,
et c'est le pilier qui tombe »). Fusionner `1 → 2` en `1 → 3` — rompt le contrat pas-à-pas de
`migrate.ts` et le test de composition qui compose une étape synthétique avec le registre réel.

**Irréversible.**

---

## Décision 10 — La frontière C2/C6, écrite comme un test, et la contradiction de textes, nommée

**Le test**, écrit dans la docstring de `RoundExpression` : *si une déclaration peut changer le
résultat d'un `compare`, d'un `sum` ou d'un `dateAdd`, elle est **C2** ; si elle ne peut changer
que ce qu'un lecteur voit, elle est **C6**.*

C2 **constate** un piège aval, **sans prescrire l'implémentation de C6**. Mesuré sur Node 24.11.1 :

| Mesure | Résultat |
| :--- | :--- |
| `new Intl.NumberFormat('fr-FR').resolvedOptions()` | `maximumFractionDigits: 3`, `roundingMode: 'halfExpand'` |
| `Intl.NumberFormat('fr-FR').format(1/3)` | `0,333` — donc **un arrondi non déclaré** |
| `style: 'currency'`, `maximumFractionDigits` résolu | EUR **2** · JPY **0** · TND **3** · BHD **3** · CLF **4** |
| `format(63.260000000000005)` en EUR | `63,26 €` — la valeur fautive s'imprime juste |
| `String(round(1.5, 2, m))` | `"1.5"`, pas `"1.50"` |

**Deux conclusions, et ce sont des constats, pas des ordres.**

1. Un C6 qui appellerait naïvement `Intl.NumberFormat(locale, { style: 'currency', currency })`
   embarquerait une **table devise → décimales détenue par ICU**, que ni le modèle ni
   l'intégrateur n'a déclarée, **et** un arrondi non déclaré, le tout silencieusement.
   **C2 ne qualifie pas cette table** : la liste de ce que le dépôt refuse est **close**
   (`docs/roadmap/README.md` — « taux de TVA, régimes, barèmes, arrondis "légaux", conversion de
   devise **à un taux officiel** ») et l'unité mineure d'une devise (ISO 4217) n'y figure pas. Le
   classement appartient à C6, qui l'instruira.
2. Le zéro de remplissage (`1.50`) est du **remplissage**, il ne peut pas changer une valeur, et il
   appartient à C6.

### La contradiction de textes, nommée et laissée ouverte

Le dépôt a **déjà écrit** comment C6 formate, et il l'a écrit dans un fichier protégé par
AGENTS.md §7 : `biome.jsonc`, entrée `toLocaleString` de `noJsRestrictedProperties` — « *Nothing
is lost, because C6 formats through `Intl.NumberFormat(locale)` and `Intl.DateTimeFormat(locale,
{ timeZone })`, both of which stay allowed and say what they read.* »

**Une ADR de lot ne peut pas amender `biome.jsonc` par une phrase écrite ailleurs.** La
contradiction est donc **nommée ici et laissée ouverte** : son amendement demande un **mandat
explicite** (AGENTS.md §7) qui n'est pas dans le périmètre de C2. Rien n'a été ajouté au gabarit
de PR non plus, pour la même raison — un garde-fou opposable à **toutes** les PR du dépôt passe
par un amendement d'AGENTS.md, qui « fait foi », jamais par une case ajoutée en marge d'un lot.

**Écarté.** Faire porter au kind une notion de « décimales affichées », ou lui faire produire une
chaîne : position de format *de fait*, et une chaîne ne se somme pas. Écarté aussi : livrer
`declaredScaleOf(expression)` dans C2 — aucun consommateur, un second parcours de l'algèbre, donc
de la sur-ingénierie ; la **forme** rend la fonction possible, C6 l'écrira s'il en a besoin.

> **Pourquoi `MIN_ROUND_DECIMALS` et `MAX_ROUND_DECIMALS` sont exportés alors que
> `declaredScaleOf` est refusé.** Le critère est le même et la réponse diffère : `declaredScaleOf`
> n'a **aucun consommateur aujourd'hui**. Les deux bornes, elles, ont un consommateur **immédiat
> et hors du dépôt** — l'intégrateur qui construit un nœud `round` par programme et veut valider
> son `decimals` avant de le stocker, un cas qui existe dès la première intégration. **Ce n'est
> pas D7 qui les justifie**, sinon la justification tomberait avec le calendrier de D7.

**Réversible.**

---

## Décision 11 — Deux `switch` plutôt qu'un Visitor d'expressions : AGENTS.md §3.B est **amendé**

AGENTS.md §3.B écrit que le Visitor est « **obligatoire** dès qu'un deuxième parcours apparaît » et
que « Composite sans Visitor est un demi-patron ». **L'algèbre d'expressions *est* un Composite**,
elle compte déjà **deux** parcours écrits en `switch` nu et dupliqué — `evaluator/evaluate.ts` et
`paths.ts` — et C2 les porte tous deux à dix-neuf branches. **La règle s'y applique.**

Aucun Visitor d'expressions n'est écrit, et **AGENTS.md §3.B est amendé pour le dire** — par cette
ADR, qui est le véhicule qu'AGENTS.md nomme lui-même (« *Ce fichier fait foi : une ADR qui entend
l'amender doit le dire explicitement* », §1.2). L'amendement est **une ligne dans AGENTS.md**,
écrite là où la règle vit, posée dans son propre commit `chore(governance)`, sous **mandat
explicite du propriétaire du produit obtenu le 2026-08-15**. Sans ce mandat, rien de ceci ne
s'écrit.

> **Amendement — portée : l'algèbre d'expressions uniquement.** Le Visitor reste obligatoire pour
> le Composite qu'énumère §3.A, l'arbre de nœuds de document. Il ne l'est pas pour l'algèbre
> d'expressions, dont les deux parcours restent des `switch`, parce que le contrôle compensatoire y
> est **plus fort** qu'un Visitor : `const exhaustive: never = expression` en `evaluate.ts` et en
> `paths.ts` rend l'oubli d'un kind **impossible à livrer** — ce sont les deux sites qui cassent à
> la **porte 2**, pas à la revue, là où un Visitor ne casserait qu'à l'exécution d'un test.
> **Seuil de retrait de l'amendement : l'apparition d'un troisième parcours d'expression.**

**Pourquoi un amendement plutôt qu'un Visitor.** C'est l'argument du `never` qui a tranché, et pas
le coût : l'exhaustivité **au compilateur** est une garantie strictement plus forte qu'une
interface à dix-neuf méthodes, et c'est le seul cas du dépôt où la règle demanderait d'échanger la
plus forte contre la plus faible. **Une règle qu'on ne peut suivre sans dégrader la garantie
qu'elle vise doit être corrigée, pas contournée** — et corriger une règle, ici, c'est écrire une
ligne dans le fichier qui la porte.

**Deux arguments explicitement retirés, parce qu'ils ne tenaient pas.** (a) La règle
anti-sur-ingénierie : sa phrase opérante vise l'introduction d'un **Port**, et ailleurs c'est un
conseil de prudence — jamais un interdit opposable à une règle écrite « obligatoire ». (b) Le poids
S du lot : **circulaire**, puisque le lot est pesé S *parce qu'*on a décidé de ne pas écrire le
Visitor. Une estimation d'effort enregistre une décision, elle ne la fonde pas.

**Le seuil est surveillé mécaniquement**, ce qui distingue cet amendement d'une exception :
`git grep -n "case 'round':" -- packages/core/src | wc -l` rend **2**. Toute autre valeur signale
soit un parcours oublié, soit le troisième parcours qui retire l'amendement.

> ⚠️ **`-n` et non `-l`, et la différence est le garde-fou lui-même.** `-l` liste les **fichiers**
> appariés : un troisième parcours ajouté *dans un fichier existant* — un second `switch` sur les
> kinds dans `evaluate.ts`, par exemple — laisserait le compte à 2 et le critère muet, au moment
> précis où la condition de retrait de l'amendement serait remplie. `-n` compte les **lignes**
> appariées, donc les `case` eux-mêmes, et passe à 3 où que le parcours atterrisse. Un critère
> aveugle à une forme réaliste de l'événement qu'il surveille ne surveille rien.

**Réversible**, et son coût de réouverture est faible — précisément parce que les deux `never`
garantissent que les deux `switch` sont complets.

> 🏁 **Seuil atteint le 2026-08-26 : l'amendement est retiré.** Le lot C10
> ([ADR 0015](0015-le-catalogue-de-donnees-de-l-integrateur.md)) a apporté le troisième parcours
> d'expressions — l'analyse des attentes et des portées — et le Visitor est devenu le patron de
> l'algèbre, comme [AGENTS.md §3.B](../../AGENTS.md) le prescrivait hors amendement.
>
> **La sonde a fait son travail, et son résultat mérite d'être lu exactement.**
> `grep -rn "case 'round':" packages/core/src | wc -l` rend désormais **1** et non 2 : les deux
> `switch` n'ont pas été rejoints par un troisième, ils ont été **remplacés** par un dispatcher
> unique. Toute valeur autre que 2 devait alerter ; c'est le cas, et l'événement est bien celui
> que la clause de retrait décrivait.
>
> **Rien n'est cédé de ce que l'amendement protégeait.** `visitExpression()` garde son
> `const exhaustive: never`, et le type du visiteur est un **type mappé sur `ExpressionKind`** :
> un kind ajouté à l'union fait échouer la compilation de *chaque* visiteur, pas seulement du
> dispatcher. La garantie à la porte 2 est donc conservée, et même élargie — c'est ce qui rendait
> le retrait indolore, et c'est pourquoi il n'a demandé aucun arbitrage.
>
> **Ce qui n'a pas été fait, et pourquoi :** le paragraphe d'AGENTS.md §3.B qui porte l'amendement
> n'a **pas** été réécrit. §7 réserve ce fichier à un mandat explicite, et l'amendement s'éteint
> par sa propre clause plutôt que par une suppression. La correction du texte reste due.

---

## Décision 12 — Ce que le lot refuse, par écrit

- **Tout arrondi implicite**, y compris au sommet d'un total. Les tests C1 `does NOT round a
  division` et `does not round either` restent **intacts dans leurs assertions** et ne doivent
  jamais être affaiblis.
- **Toute valeur par défaut** : ni `decimals?`, ni `mode?`, ni mode privilégié. Un défaut ici
  rendrait **irrecevable** la décision ouverte n°6 de `docs/roadmap/README.md`, en tranchant au
  niveau du **contrat** ce qu'elle veut trancher au niveau des **modèles livrés**.
- **Les modes dirigés et les demi-modes directionnels**, **tout nom à consonance réglementaire**,
  **toute table devise → décimales** — y compris dans un exemple de docstring.
- **`decimals` ou `mode` calculés.** En revanche `decimals` **négatif** est autorisé.
- **Tout formatage** : remplissage, séparateur, symbole, locale, `toFixed` en sortie,
  `toLocaleString` (refusé par la machine dans `core`).
- **Tout changement de représentation numérique** : ni `decimal.js`, ni `big.js`, ni entiers de
  centimes, ni `BigInt` en production. La décision 4 de l'ADR 0003 reste **réversible** ; C2 ne la
  consomme pas. *BigInt vit dans le fichier de test, comme oracle exact, et nulle part ailleurs.*
- **Tout code d'erreur nouveau, tout plafond nouveau, tout champ d'`EvaluationLimits`.** `round`
  est un kind à **opérande unique** : un niveau JSON, une descente, **un pas de budget**, quatre
  valeurs pour le garde de forme. La facture la plus lourde du critère de recette atteint 14
  niveaux JSON contre 12 sans arrondi, pour une marge de **50 niveaux** sous
  `DEFAULT_SHAPE_LIMITS`.
- **Toute répartition d'un montant arrondi sur N lignes** (plus grand reste, absorption du résidu).
  C'est le seul besoin comptable réel non couvert, et il est refusé pour une raison de périmètre :
  ***quelle* ligne absorbe le résidu est une règle.** Openview donne la capacité de calculer le
  résidu — `sub(round(total, 2, m), sum(lignes, l, round(l.montant, 2, m)))` — et laisse l'auteur
  décider où il tombe.
- **Toute traçabilité de calcul** (écartée du v1 par la roadmap) et **tout arrondi de report de
  page** (E3 : seul le moteur sait où il coupe).
- **Toute lecture d'environnement.** `round` est pur de ses arguments explicites.

---

## Conséquences

**Pour `@openview/engine`.** E1 peut évaluer « les formules du modèle (totaux, agrégations,
échéance, **arrondis déclarés**) » dans la première facture PDF. E6 tient sa condition : les
arrondis déclarés sont honorés **à la lettre**, et rien dans `round.ts` ne lit l'environnement. E8
dispose du rapport de coût de la décision 5 avant de dimensionner un délai de worker.

**Pour `@openview/designer`.** D7 édite deux champs scalaires : un compteur ou une liste fermée de
31 entrées pour `decimals`, deux **libellés** pour `mode` — la valeur brute ECMA-402 n'a pas à
apparaître dans l'IHM. Le lint « ce total n'est pas enveloppé » lui appartient ; ce n'est pas un
refus de `core`.

**Pour C3 (le tableau de lignes).** La dernière ligne d'un tableau est « une somme de ce qui
précède ». Cette somme est une **expression du modèle**, `round(sum(...), d, m)`, **jamais un total
calculé par le tableau** : un tableau qui sommerait ses propres colonnes réintroduirait l'arrondi
implicite que la décision 8 refuse, et le ferait **hors de l'arbre**, là où aucun relecteur ne le
verrait.

**Pour C6.** Voir la décision 10, et la question ouverte ci-dessous.

---

## Ce qui reste ouvert

**Qui déclare l'échelle d'AFFICHAGE d'un montant — le modèle, l'intégrateur, ou une table de
devises ?** C2 ne la tranche pas et **ne classe pas la table** ICU. Les trois options sont posées
sans recommandation, pour que C6 hérite d'un point de départ plutôt que d'une inquiétude.

| Option | Qui déclare | Ce qu'elle coûte |
| :--- | :--- | :--- |
| **1 — le modèle** | une échelle d'affichage écrite dans le nœud de format de C6, à côté de la locale | cohérent avec C2, où l'échelle de calcul est déjà **lisible dans l'arbre** ; mais elle se déclare deux fois, et rien n'oblige les deux à s'accorder |
| **2 — l'intégrateur** | un catalogue devise → échelle injecté par l'application hôte | aucune table dans Openview, cohérent avec la décision 9 de la roadmap ; mais c'est une charge d'amorçage de plus, et un catalogue absent doit **refuser**, pas deviner |
| **3 — ICU** | `Intl.NumberFormat(locale, { style: 'currency', currency })` | le moyen que `biome.jsonc` autorise déjà, et le seul qui tienne le critère de fin de C6 sans duplication ; mais il **résout `maximumFractionDigits` tout seul**, donc applique une échelle qu'aucun modèle n'a déclarée — les cinq mesures de la décision 10 en pièce jointe |

**Ce qu'aucune des trois ne doit faire**, et c'est le seul énoncé que C2 se permet ici parce qu'il
découle de la décision 2 et non d'un arbitrage de C6 : **ré-arrondir en silence un montant que le
modèle a déjà arrondi.** `round(x, 2, m)` suivi d'un affichage à trois décimales rendrait visible
un chiffre que l'auteur a déclaré ne pas vouloir.

**L'amendement du message de `biome.jsonc`** (décision 10) demande un mandat explicite et reste à
demander.

**La répartition d'un résidu sur N lignes** (décision 12) : refusée par périmètre, pas par
difficulté. Le jour où un intégrateur la demande, c'est *quelle ligne absorbe* qui devra être
répondu — et ce n'est pas à Openview de le faire.

**Les modes dirigés** (décision 3) : leur signal de réouverture est écrit, et le contournement daté
avec lui.

---

## Les sondes à rejouer

- **`Intl.NumberFormat` comme oracle** (décision 2, mesure 3) : 720 012 cas, 0 divergence.
  Consignée ici, **jamais committée** — son résultat est indexé sur un build d'ICU. À rejouer **à
  chaque montée de Node**, au même titre que la sonde `noJsRestrictedProperties` de l'ADR 0003.
- **`toExponential` reste non restreint par Biome** : il n'apparaît dans aucune entrée de
  `noJsRestrictedProperties` ni dans les trois `.grit`. `noJsRestrictedProperties` est une règle
  **nursery**, hors versionnement sémantique : si elle s'élargissait aux méthodes de conversion
  numérique, c'est le cœur de l'implémentation qui serait bloqué. À joindre à la sonde jetable de
  l'ADR 0003.
- **Le coût en temps mural** (décision 5) : à rejouer sur la machine qui doit décider d'un délai,
  jamais recopié d'ici.
