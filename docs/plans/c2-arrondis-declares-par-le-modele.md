# Plan d'implémentation — `@openview/core` lot C2 : les arrondis, déclarés par le modèle

> **Document d'implémentation.** Il dit *comment* livrer un lot : découpage, fichiers touchés,
> tests, ordre des commits. Il ne dit ni *quoi* ni *pourquoi* — cela vit dans `docs/roadmap/` —
> ni les *décisions* structurantes, qui se consignent dans `docs/adr/`. Il est **périssable** :
> une fois le lot livré, il ne fait plus foi, et c'est l'ADR 0004 qui reste.
>
> **Statut :** ✅ **prêt à exécuter.** Les cinq arbitrages de la [§8] ont été tranchés par le
> propriétaire du produit le **2026-08-14**, conformément aux cinq recommandations : **1-A**
> (deux modes), **2-A** (`decimals` dans `[-15, 15]`), **3-A** (vocabulaire ECMA-402), **4-C**
> (un second jeu de lignes au playground), **5-C** (rien dans le gabarit de PR). INC-1 peut
> démarrer.
>
> **Date :** 2026-08-14 · **Brique :** `@openview/core`, vague 1 · **Jalon visé :** J1
>
> **Révision du 2026-08-14 (revue de contradiction).** **Quatre** relectures adverses — deux de
> doctrine, une technique, une d'exécution — ont produit **trente-deux objections, dont trois
> bloquantes** (le corollaire impératif de D10, le gabarit de PR, le budget de temps de la matrice
> de propriétés). Chacune est **intégrée** ou **écartée avec son motif écrit** ; aucune ne disparaît
> en silence. Celles qui corrigent un raisonnement faux sont écrites comme telles, avec l'énoncé
> fautif cité entre guillemets : le motif de la fenêtre `decimals` [§2, D4], l'enveloppe chiffrée du
> critère comptable [§2, D7], la cellule `0.145` du tableau des sémantiques [§2, D2], la contrainte
> de compilation inventée d'INC-1 [§4], le budget de temps de la matrice de propriétés [§5], et le
> silence sur `biome.jsonc:273` [§2, D10]. Aucune décision de fond n'est rouverte : ce sont des
> corrections de **moyens** et de **motifs**.
>
> **Relecture du 2026-08-14 (revue de la revue).** La passe qui devait vérifier le travail
> ci-dessus n'avait jamais tourné ; elle a tourné depuis, sur trois lentilles — intégration des
> objections, exactitude mesurée, complétude du découpage — et **le décompte de l'encadré
> précédent était lui-même faux** (« trois relectures », « vingt-six objections », « une
> bloquante »), c'est-à-dire le seul paragraphe qui permet de vérifier qu'aucune objection n'a
> disparu. Corrigé ici, plus **trente-huit constats**, dont un seul rouvre un arbitrage : la ligne
> d'échecs du tableau des paliers de D7, **qui ne se reproduisait sous aucune lecture de son
> protocole** — celui-ci est désormais écrit jusqu'à sa loi de tirage et à sa graine [§2, D7] ; la
> fourchette de coût en temps mural, qui contredisait les chiffres du plan deux paragraphes plus
> haut [§3.3] ; le budget des tests de propriété, optimiste de 35 % [§5.2] ; **la couverture 100 %
> d'INC-1, mesurée inatteignable** avec les vecteurs annoncés — deux branches n'étaient exercées
> par aucun d'eux, deux vecteurs de plus les couvrent [§5.1] ; l'arbitrage n°5, tranché **C**
> plutôt que B, et la classification de la table devise → décimales retirée de D10, faute de
> mandat [§2, D10 et §8] ; les constructeurs manquants de la fixture du critère de recette
> [§6.2] ; six références internes ou `fichier:ligne` fausses. **Ce que la relecture a confirmé et
> qui ne bouge pas :** les 34 vecteurs figés (0 écart, douze divergences de mode), les mesures de
> D2, la borne prouvée de D7, les six chaînes de refus au parse, et l'implémentation de la [§3.3]
> confrontée à une référence BigInt réécrite pour l'occasion — **0 divergence sur 440 000 cas**.
>
> **Analyse externe du 2026-08-14.** Huit constats reçus d'une analyse extérieure au dépôt, rejoués
> un par un. **Trois sont retenus, trois étaient déjà au plan, un est mesurément faux**, et le
> premier est le plus important du document : **`roundDecimal` n'avait pas de garde de finitude, et
> `roundDecimal(NaN, 2, m)` rendait `0.01`** — un `NaN` converti en centime, ni propagé ni refusé
> ([§3.3]). L'analyse l'annonçait comme une troncature inoffensive ; la mesure a montré un montant
> faux. Retenus aussi : le vecteur `-5e-324` qui épingle le zéro non signé, le `describe` qui rend la
> matrice de propriétés partageable [§5.2], les deux causes de l'écart nommées séparément au
> playground [§4, INC-4], et les trois options transmises à C6 [§4, INC-5]. **Déjà au plan** :
> `EnumeratedMembers` (qui porte sa propre ligne de tableau en [§4]), la section d'affichage
> distincte des refus au parse (INC-4), et les six chaînes de refus [§5.3]. **Faux** : la crainte
> que le message global de `z.number({ error })` écrase `.int()`, `.min()` et `.max()` — mesuré sur
> `zod@3.25.76` via `zod/v4`, chaque validateur rend bien **son** message.

---

## 0. Le cadre : Openview est un moteur d'édition, il fournit la capacité et jamais la règle

Tout ce qui suit en découle, et un lot d'arrondis est exactement l'endroit où l'on s'en écarte
sans le voir.

Openview est un **moteur d'édition embarquable** installé dans l'application d'un tiers. Il
n'est ni un logiciel de gestion, ni une source de vérité. La facture est le **document de
référence** du projet — le niveau d'exigence à atteindre — jamais le périmètre.

La clause du README, section « Calculs, conformité et responsabilité », dit la limite dans les
termes qui tranchent ce lot :

> « **Openview ne décide d'aucune règle fiscale, comptable ou légale.** Il ne détermine jamais,
> notamment : […] une règle d'**arrondi légal** — **l'arrondi est déclaré par le modèle, donc
> choisi par son auteur**. »

Et la table d'arbitrage de `docs/roadmap/core.md` place la frontière au nœud près :

| Sujet | Position écrite |
| :--- | :--- |
| **Comment** un montant s'arrondit | **Le modèle le déclare** (lot C2) — la décision reste celle de son auteur |
| Taux de TVA, exigibilité, exonération, mentions | **Jamais Openview.** Données ou choix de l'intégrateur |
| Report de page | **Le moteur** : seul lui sait où il coupe (E3) |
| Conformité du document | **L'intégrateur**, énoncé sans détour dans le README |

> 🔑 **La règle qui coupe la dérive, appliquée aux arrondis.** La capacité s'arrête au **kind qui
> exécute une déclaration**. Elle ne va jamais jusqu'à une valeur par défaut, jusqu'à un mode
> privilégié, jusqu'à un arrondi automatique d'une opération, ni jusqu'à une table qui
> associerait une devise à un nombre de décimales. Un défaut d'arrondi serait une **position
> d'arrondi de fait**, c'est-à-dire une règle, c'est-à-dire une violation de la décision 16 de la
> roadmap et de la clause du README.

Les fichiers du dépôt qui portent déjà ce cadre et qu'il faut avoir lus : `AGENTS.md`
(« Ce qu'Openview n'est pas »), `README.md` §« Calculs, conformité et responsabilité »,
`docs/roadmap/README.md` §§2, 5, 7 et 8, `docs/roadmap/core.md` (table d'arbitrage et lot C2),
`docs/adr/0003-formules-agregations-et-dates-civiles.md` (décisions 4 et 10),
`.github/pull_request_template.md` §« Périmètre ».

---

## 1. Pourquoi C2, et pourquoi maintenant

### Ce que la roadmap impose

`docs/roadmap/core.md`, lot C2 :

> « **Poids :** S — **Dépend de :** C1 — *jamais reporté : des arrondis ajoutés après coup
> faussent tous les modèles déjà écrits.* »
>
> « **Prêt quand** deux modèles arrondissant différemment produisent deux résultats différents et
> prévisibles sur le même jeu de données, **et qu'aucun total ne diffère de la somme des montants
> affichés au-dessus de lui**. »
>
> « C'est **le point exact où naît le fameux « écart d'un centime »** […] : **chaque montant
> calculé déclare comment il s'arrondit** (précision, sens de l'arrondi). »

`docs/roadmap/README.md` §7 range C2 parmi les **quatre choses jamais sacrifiées**. `engine.md`
E6 en fait une condition du déterminisme : « Les arrondis déclarés par le modèle (core C2)
doivent être honorés **à la lettre**. Sans ce lot, ni contrôle automatique, ni confiance
possible. » E1 attend « les formules du modèle évaluées (totaux, agrégations, échéance, arrondis
déclarés) » dans la toute première facture PDF.

### L'écart est réel, et il est central

| Verrou | Où | Ce qu'il impose |
| :--- | :--- | :--- |
| Aucun arrondi n'existe dans l'algèbre | `expression/types.ts`, 18 kinds, aucun n'arrondit | tout montant est un binary64 brut, jusque dans `text()` |
| Un message **rendu à l'auteur du modèle** est sans remède | `evaluator/guards.ts:204` : « Round the value first: the algebra has no rounding of its own » | `dateAdd(d, x)` fractionnaire est aujourd'hui inactionnable |
| La couture est annoncée dans une docstring **publique** | `expression/types.ts:132-134` (`PercentOfExpression`) | la forme est due ; ne pas la livrer laisse un contrat qui ment |
| Le playground annonce C2 nommément | `apps/playground/src/App.tsx:55` et `:481-482` | idem, côté démonstration |

### Argument contraire, examiné et écarté

**« C4 (la page) ou C3 ne dépendent de rien non plus : autant les faire d'abord. »** C4 et C3 ne
débloquent aucun lot en aval — mais **C3 hérite d'une contrainte que ce plan doit lui transmettre**,
écrite ici et reprise dans l'ADR 0004 : la dernière ligne d'un tableau C3 est « une somme de ce qui
précède » (`docs/roadmap/core.md`, lot C3), et c'est le premier endroit où la seconde moitié du
critère de C2 rencontrera un document réel. Cette somme est une **expression du modèle**,
`round(sum(...), d, m)`, jamais un total calculé par le tableau : un tableau qui sommerait ses
propres colonnes réintroduirait l'arrondi implicite que D8 refuse, et le ferait **hors de l'arbre**,
là où aucun relecteur ne le verrait. Cela dit, C2 débloque **C6** (`Poids L — Dépend de : C2, C5`), et E6 ne
peut pas être déclaré satisfait sans lui. Surtout, C2 est le seul des trois qui soit
**rétroactivement destructeur** : un arrondi ajouté après C6 change la valeur de tous les
modèles déjà écrits, sans qu'aucune migration ne puisse le rattraper — c'est exactement ce que
désigne la classe « jamais reporté ». C4 différé coûte du temps ; C2 différé coûte des documents
faux.

**« Le lot est S, il peut passer en dernier dans la vague 1. »** Non : `docs/roadmap/core.md`
écrit que la brique est finie quand la facture calcule « totaux calculés par le modèle,
**arrondis déclarés**, échéance calculée ». Le poids S décrit le coût, pas la position.

---

## 2. Ce qui est décidé, et ce que ça engage

Douze entrées, et leur réversibilité n'est pas uniforme — **une version antérieure de cette phrase
écrivait « chacune est irréversible », ce que les décisions elles-mêmes démentent dix lignes plus
bas.** Le relevé exact, parce que l'ADR 0004 le recopiera : **quatre sont strictement
irréversibles** (D1, D2, D8, D9) ; **deux ne le sont que dans un sens** (D3 ne se rouvre que vers
l'élargissement, D4 que vers l'élargissement de la fenêtre) ; **cinq sont réversibles** et le disent
en fin de section (D5, D6, D7, D10, D11) ; et **D12 n'est pas une décision mais le hors-périmètre**,
numéroté pour que l'ADR le reprenne au même titre. Ce qui vaut de toutes, c'est le coût de retour :
une migration transformante, un changement de valeur des modèles déjà écrits, ou une contradiction
de textes. **Chacune doit donc figurer dans l'ADR 0004**, et la [§4] INC-5 en dresse le sommaire
obligatoire.

### D1 — Un seul kind enveloppe : la couture posée par C1 est **constatée**, pas rouverte

**Décision.** `{ kind: 'round'; value: PrintableExpression; decimals: number; mode: RoundMode }`,
membre de `PrintableExpression`, **trois champs requis**. Aucun second kind, aucune option
d'arrondi sur `aggregate`, aucun champ `precision?`.

**Pourquoi.** La forme est écrite dans une docstring publiée (`types.ts:132-134`) et dans la
décision 4 de l'ADR 0003 ; la rouvrir coûterait une contradiction de textes pour un gain nul,
car elle est bonne. Et la mesure la confirme au lieu de s'en accommoder : sur les cinq lignes de
référence de la [§6], `round(sum(…))` vaut **63.25** et `sum(…, round(…))` vaut **63.26**. La
**position dans l'arbre *est* la déclaration** ; un champ `precision?` n'aurait pas su exprimer
le premier cas, faute de nœud intermédiaire où l'accrocher.

Ce que la décision 4 laissait à C2, ce sont les **types des trois champs** et la **sémantique**.
D2 à D5 ne tranchent rien d'autre.

**Écarté.** (a) Un second kind `roundTo(value, step, mode)` pour l'arrondi au multiple :
`mul(round(div(x, step), 0, m), step)` l'exprime, et la règle anti-sur-ingénierie tranche —
extraire un kind plus tard est facile, retirer une abstraction inutile ne l'est jamais. *Signal
de réouverture : une demande nommant un pas qui ne soit pas une puissance de dix.* (b) Un
`roundEach` sur `aggregate` : optionalité conditionnelle, refusée par l'ADR 0003 décision 3
(« la composition remplace l'optionalité, et tous les champs restent requis partout »).

**Irréversible.**

---

### D2 — L'arrondi porte sur le nombre **tel qu'il s'écrit**, pas sur le binaire dessous

**Décision.** L'opération est définie sur **la plus courte décimale qui fait aller-retour** vers
le double — exactement ce que `toExponential()` rend et ce que `text()` imprime. Donc
`round(1.005, 2, 'halfExpand')` vaut `1.01`, `round(0.615, 2, m)` vaut `0.62`,
`round(2.675, 2, m)` vaut `2.68`.

**Les trois sémantiques possibles, mesurées.**

| Sémantique | `1.005`@2 | `0.615` | `2.675` | `0.145` | `8.575` | `1.255` |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| **binaire exacte** (`Number(x.toFixed(d))`) | `1` | `0.61` | `2.67` | `0.14` | `8.57` | `1.25` |
| **mise à l'échelle** (`Math.round(x*10**d)/10**d`) | `1` | **`0.62`** | **`2.68`** | `0.14` | `8.57` | `1.25` |
| **décimale imprimée** (retenue) | `1.01` | `0.62` | `2.68` | `0.15` | `8.58` | `1.26` |

> ⚠️ **Correction d'un raisonnement faux, à ne pas recopier dans l'ADR 0004.** Une version
> antérieure de ce tableau donnait `0.15` à la mise à l'échelle sur `0.145`, et n'en citait que
> trois divergences. C'est faux, et c'est mesuré : `0.145 * 100 === 14.499999999999998`, donc
> `Math.round(0.145*100)/100 === 0.14`. L'erreur allait *contre* l'argument qu'elle servait. La
> formulation juste est : **la mise à l'échelle est juste sur `0.615` et `2.675`, fausse sur
> `1.005`, `0.145`, `8.575` et `1.255`** — quatre exemples sur six, ce qui sert bien mieux la
> thèse d'inconstance que la version précédente.

**Quatre mesures, toutes rejouables (Node 24.11.1).**

1. Sur les **100 000 ties exacts** `.xx5` à deux décimales, la sémantique binaire diverge de la
   décimale imprimée sur **48 000 (48,00 %)**. `Number(x.toFixed(2))` diverge exactement autant :
   c'est la même sémantique.
2. La mise à l'échelle diverge sur **4 588 de ces ties (4,59 %)** et sur **0,459 %** de toutes
   les valeurs `k/1000`. Elle n'est pas seulement fausse, elle est **inconstamment** fausse, et
   « prévisible » est un mot du critère de recette.
3. `Intl.NumberFormat` implémente la sémantique décimale imprimée. Confronté sur **720 012 cas**
   (2 modes × 6 précisions × 60 001 valeurs `k/1000`) : **0 divergence**. La référence normative
   que tout intégrateur ouvrira dans sa console donne notre résultat, et contredit la sémantique
   binaire.
4. **Décisif : sous la sémantique binaire, le champ `mode` serait quasi décoratif.** Sur le
   million de valeurs `k/1000` arrondies à deux décimales, le mode change le résultat **2 000
   fois (0,200 %)** en sémantique binaire contre **50 000 fois (5,00 %)** en sémantique décimale
   imprimée — vingt-cinq fois plus. En sémantique binaire, un tie exact n'existe que sur les
   dyadiques : l'auteur qui déclare `halfEven` pour `0.145` obtient le même chiffre qu'en
   `halfExpand` et croit le champ cassé. **Un lot dont la raison d'être est « deux modèles
   arrondissant différemment produisent deux résultats différents » ne peut pas se payer une
   sémantique qui rend le mode inopérant dans 99,8 % des cas.**

**Le déterminisme est plus fort ici que pour `textCase`, pas plus faible.** ECMA-262 fixe la forme
décimale la plus courte (« f as small as possible ») et fixe la conversion chaîne → nombre comme
la valeur exacte arrondie **une seule fois** au plus proche. Ni l'une ni l'autre n'est indexée sur
une version d'ICU, là où `textCase` dépend de la version Unicode du moteur.

**Écarté.** (a) `Number(x.toFixed(d))` : exact et spécifié, mais c'est la sémantique binaire, il
rend une **chaîne** — donc préempte C6 — et il n'offre qu'un mode sur deux. (b)
`Math.round(x * 10 ** d) / 10 ** d`. (c) Un correctif `toPrecision(15)` avant mise à l'échelle :
une constante magique, c'est-à-dire une règle de pouce déguisée en contrat.

**Irréversible, et c'est le renversement le plus coûteux du lot** : revoir cette décision après le
premier modèle client changerait la valeur de tous les modèles déjà écrits, sans qu'aucune
migration ne le rattrape.

---

### D3 — Deux modes, vocabulaire ECMA-402 : `halfExpand` et `halfEven`

**Décision.** `ROUND_MODES = ['halfExpand', 'halfEven'] as const`. Requis, sans défaut. Les modes
dirigés (`ceil`, `floor`, `expand`, `trunc`) et les demi-modes directionnels (`halfCeil`,
`halfFloor`, `halfTrunc`) sont hors périmètre de C2.

**Pourquoi le champ existe.** Un mode unique ne serait pas un contrat plus petit, ce serait une
**règle** : Openview déclarerait comment un montant s'arrondit. Deux est le plus petit nombre qui
rende vraie la phrase du README.

**Pourquoi pas plus — et sur quel motif exactement.**

> ⚠️ **Correction d'un raisonnement faux, à ne pas recopier dans l'ADR 0004.** Une version
> antérieure de cette décision écrivait « **le refus porte sur le danger, pas sur la
> faisabilité** ». Ce motif n'a **aucun précédent écrit** dans le dépôt, et il contredit ce qui y
> est écrit : `docs/roadmap/README.md` §2 dit « on ajoute volontiers une opération », et l'ADR
> 0003 a délibérément rendu les surprises binary64 **visibles et contractuelles** plutôt que de
> les masquer — le test `does NOT round a division` et `add(0.1, 0.2) = 0.30000000000000004`
> existent pour cela. Refuser une opération correcte au motif qu'elle exposerait l'auteur à une
> surprise numérique **inventerait un critère d'admissibilité**, et ce critère servirait ensuite
> à refuser autre chose.
>
> **Le motif retenu est celui que le dépôt a déjà écrit : aucun usage nommé aujourd'hui, règle
> anti-sur-ingénierie, et un ajout ultérieur au coût d'une seule migration d'estampille qui
> n'invalide aucun modèle stocké.** C'est la décision la moins chère à différer du lot.

**La mesure de fragilité est conservée dans l'ADR 0004, comme information consignée et non comme
critère.** Elle sera précieuse le jour de la réouverture. Mesuré sur 200 000 sommes de deux montants
à deux décimales tirés uniformément dans [0, 1000] : **21,4 %** des doubles **ne sont pas la valeur
décimale à deux décimales que leurs deux termes annoncent** (`842.96 + 919.07 === 1762.0300000000002`),
et un `ceil` à deux décimales rend alors un centime **trop haut dans ~10,6 %** des cas,
silencieusement. Sur les mêmes tirages, `halfExpand` s'est trompé **0,00 %** du temps. Les modes
dirigés restent parfaitement implémentables — vérifiés contre `Intl` sur 400 000 cas, 0 divergence :
ce n'est pas une limite de l'algorithme.

> ⚠️ **Correction d'un libellé faux, à ne pas recopier.** Une version antérieure écrivait
> « **21,41 %** des doubles portent un **résidu au 16ᵉ chiffre significatif** », et illustrait le
> taux par `379481.54 - 378040.16 === 1441.3800000000047` — une **différence** de deux opérandes de
> l'ordre de 3,8·10⁵, c'est-à-dire un cas **hors de la population annoncée**. Deux défauts : le
> nombre est bon mais le libellé ne l'est pas (**12,6 %** seulement des sommes portent réellement
> plus de seize chiffres significatifs, contre **21,4 %** qui portent un résidu décimal), et un taux
> mesuré ne s'illustre pas par un cas qui n'appartient pas à sa population. L'exemple ci-dessus est
> tiré de la population elle-même.
>
> **Et ces chiffres sortent de la docstring de `ROUND_MODES` ([§3.1]) pour n'exister que dans
> l'ADR.** `packages/core/package.json` déclare `publishConfig.access: public` et `files: ["dist"]`
> : une docstring est émise telle quelle dans `dist/**/*.d.ts`, donc **publiée**. Le lot vient de
> refuser une table devise → décimales « y compris dans un exemple de docstring » (D12) ; y laisser
> un taux de fragilité mesuré serait le même geste, une ligne plus bas. La docstring garde le
> **motif** et le **mécanisme** — un mode dirigé lit tous les chiffres écartés, un demi-mode un
> seul — et renvoie à l'ADR pour les nombres.

**Signal de réouverture, à écrire dans l'ADR 0004 :** *une demande nommant un besoin métier qui
doit arrondir dans une direction **dans** le modèle* (« toute unité commencée est due », prorata
au centime supérieur).

**Pourquoi ces noms.** `halfUp` signifie « vers +∞ » pour la moitié de l'industrie (ECMA-402
appelle cela `halfCeil`) et « à l'opposé de zéro » pour l'autre (Java `HALF_UP`) ; sur un avoir,
les deux diffèrent d'un centime à chaque ligne. **Un champ qui décide un centime ne se nomme pas
d'un mot qui veut dire deux choses.** Le vocabulaire ECMA-402 reste de plus cohérent si le jeu est
un jour élargi (`expand`/`trunc`/`ceil`/`floor` rejoindraient un vocabulaire qui les nomme déjà),
et il rend la vérification par oracle auto-documentée.

**Écarté.** (a) Les neuf modes d'ECMA-402 : quatre n'ont aucun usage nommé, et la règle
anti-sur-ingénierie tranche. (b) `halfUp`/`halfEven` : ambigu sur le signe, incohérent avec une
réouverture. (c) `bankers`, `commercial`, `legal`, `arrondiLegal`, `swedish`, `cash`, `fiscal` :
décision 10 de l'ADR 0003 — un nom désigne une opération, jamais une règle. `halfEven` est le nom
de « l'arrondi du banquier » quand on le **décrit** au lieu de l'**invoquer**.

**Réversible dans le sens de l'élargissement uniquement** ([§8], arbitrage n°1).

---

### D4 — `decimals` est un littéral entier borné à `[-15, 15]`

**Décision.** `z.number({ error }).int().min(-15).max(15)`, champ scalaire du nœud, **jamais une
expression**.

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

**Pourquoi ces bornes — et sur quelle preuve exactement.**

> ⚠️ **Correction d'un raisonnement faux, à ne pas recopier dans l'ADR 0004.** Une version
> antérieure écrivait, des deux bornes : « arrondir à 16, 17, 20 ou 50 décimales a rendu la valeur
> **inchangée à chaque fois** — un champ dont les valeurs admissibles sont décoratives n'a pas sa
> place dans un contrat stocké », et « une position sous `-15` nommerait une unité que la
> représentation ne sait plus compter ». **Les deux énoncés sont réfutables par un contre-exemple
> d'une ligne**, et un rétrécissement irréversible dont le motif écrit est faux est le pire cas de
> figure pour un document opposable.
>
> Mesuré : `roundDecimal(0.12345678901234566, 16, 'halfExpand')` rend `0.1234567890123457` —
> **différent** de l'entrée. `roundDecimal(1.23456789e20, -16, 'halfExpand')` rend `1.2346e20` —
> **différent**, et `1.2346e20 === 12346 * 1e16` est `true`, donc la valeur est exactement sur la
> grille : « la représentation sait la compter ». Sur 300 000 motifs de bits aléatoires,
> `d ∈ {17, 18, 20, 50}` a changé la valeur **579 075 fois**.
>
> **Les motifs justes sont les suivants, et l'un des deux est une preuve, pas un tirage.**
>
> - **Borne haute, prouvée.** Le nombre de chiffres d'une forme décimale la plus courte est au
>   plus 17, et le nombre de chiffres à écarter vaut `drop = len − 1 − exp − d`. Pour tout
>   `|valeur| ≥ 1` on a `exp ≥ 0`, donc `drop ≤ 17 − 1 − 0 − 16 = 0` dès `d = 16` :
>   **`16` est la première position qui est l'identité pour toute valeur de magnitude ≥ 1, et
>   `15` est donc la dernière qui puisse encore changer un montant.** Ce n'est pas `DBL_DIG`
>   invoqué comme un slogan, c'est une inégalité.
> - **Borne basse, assumée.** Elle n'est **pas** une décorativité : c'est un **rétrécissement
>   délibéré sur le domaine documentaire** — aucun montant de facture n'a de sens au-delà de
>   `1e15` — ancré sur le fait que `Number.isSafeInteger(1e15)` est `true` et
>   `Number.isSafeInteger(1e16)` est `false`. Elle refuse des positions atteignables, et c'est
>   écrit.
> - **Et la même réserve vaut en haut, pour les petites valeurs :** pour `|valeur| < 1` la borne
>   `15` refuse elle aussi des positions atteignables (`d = 16` sur `0.1234…` fait quelque chose).
>   Aucune borne finie ne rend la décorativité universelle. **La fenêtre est donc documentaire des
>   deux côtés, et sa borne haute coïncide avec le point exact où elle devient décorative pour
>   toute magnitude ≥ 1.** C'est la phrase à mettre dans l'ADR.

**Ce qui suit d'un `decimals` littéral, et qu'il faut nommer avant que C6 ne le subisse.** Le
critère de recette de C6 est écrit : « un unique modèle de facture produit deux documents corrects
dans deux langues et **deux devises**, sans duplication du modèle » (`docs/roadmap/core.md`, lot
C6, poids L, dépend de C2 et C5). Avec un `decimals` littéral, une précision par devise n'est pas
pilotée par les données : elle passe par un `if` dans l'arbre.

> 🔑 **Porte de sortie, écrite ici pour que C6 ne la découvre pas en la subissant.** La précision
> par devise **reste ouverte** et ne passera **pas** par le nœud `round` : elle relèvera d'un
> mécanisme de C6 — une déclaration au niveau du **modèle** associant un couple locale/devise à une
> échelle — que C2 ne préempte ni ne fournit. Ce que C2 fixe, c'est que l'échelle **de calcul** est
> dans l'arbre ; l'échelle **d'affichage** appartient à C6, et D10 dit à quelles conditions.

**Écarté.** (a) `decimals: PrintableExpression` : coûte un site de descente, un segment `at`, un
garde runtime et un message neuf, pour un cas d'usage déjà exprimable, et rend la propriété
comptable invérifiable statiquement. (b) `[0, 15]` : ampute le négatif — un tableau de synthèse
« en milliers » est une capacité, pas une règle — sans économiser une ligne, l'algorithme étant
symétrique. (c) Non borné : `Number('1e1000000000')` vaut `Infinity`, et surtout aucune liste
fermée n'est possible pour D7.

**Irréversible dans le sens du rétrécissement** : aucune migration ne ramène dans l'intervalle une
valeur stockée hors bornes. Repose seule sur l'hypothèse pré-v1.0 [§9, hypothèse 1].

---

### D5 — L'implémentation : chirurgie sur la chaîne de chiffres, une seule conversion binaire

**Décision.** `toExponential()` pour les chiffres les plus courts, retenue manuelle sur la chaîne,
reconstruction par un unique `Number(...)`. Ni `10 ** d`, ni `toFixed`, ni `BigInt` en production,
ni dépendance.

**Pourquoi.** Une seule conversion chaîne → nombre, donc **un seul arrondi binaire**, à la fin :
aucune mise à l'échelle intermédiaire n'apporte son erreur. `10 ** d` est exclu parce que
l'exponentiation est *implementation-approximated* en ECMA-262 — l'argument que le dépôt a déjà
employé pour tenir `Math.pow` hors de l'algèbre.

**Vérifié.** **4 400 022 comparaisons** contre une référence BigInt écrite indépendamment
(expansion de la forme décimale la plus courte, arrondi entier exact, départage explicite) :
**0 divergence**. Population : les 120 001 valeurs `k/1000` des deux signes, 40 000 motifs de bits
uniformes, 40 000 montants d'échelle réaliste, aux 11 précisions `{-15, -9, -5, -2, 0, 1, 2, 3, 5,
9, 15}` et sur les deux modes. Idempotence, monotonie, finitude, absence de `-0` : **0 violation**
sur 480 000 vérifications chacune. Complexité cognitive des quatre fonctions : 4 à 7, très en
dessous du plafond SonarQube de 15 établi par `03ab3d2`.

**Coût en temps mural — protocole donné, chiffre donné en fourchette.**

> ⚠️ **Correction d'un raisonnement faux, à ne pas recopier.** Une version antérieure annonçait
> « ~2.7 µs, ~1.8 µs, environ **cinquante fois** un nœud arithmétique » sans machine, sans version
> de Node, sans protocole — et le chiffre ne se reproduit pas. Deux mesures indépendantes ont donné
> 4,8 µs / 1,5 µs (rapport 108× et 33×) et 1,52 µs / 1,23 µs (rapport 31× et 25×). **Un chiffre
> remis à E8 pour dimensionner un plafond doit porter son protocole**, comme le fait le reste de ce
> plan.
>
> Mesure de référence de ce plan, à recopier avec son protocole : Node **24.11.1**, 200 000
> itérations de chauffe puis 2 000 000 d'appels, valeurs pré-tirées, puits de somme.
> `roundDecimal` sur valeurs à 17 chiffres significatifs = **1 521 ns/appel** ; sur un mélange
> type facture (montants au centime) = **1 228 ns** ; `Number(x.toFixed(2))` = **980 ns** ;
> multiplication = **49,8 ns**. Rapports : **25× à 31×** sur cette machine.
>
> **Et la dispersion entre machines est bilatérale, ce qu'une formulation antérieure ratait.**
> Elle écrivait « une seconde machine a mesuré **25 % à 200 % plus haut** » ; sur les quatre
> mesures dont ce plan dispose maintenant (1 521/1 228 · 4 838/1 467 · 2 904/963 · 2 562/1 035
> ns), aucune de ces deux bornes n'en est une, et le second cas descend **sous** la référence.
> L'énoncé juste : **de 0,8× à 3,2× les chiffres de référence**, rapports au nœud arithmétique
> **de 25× à 110×** selon la machine et la population.
>
> **L'énoncé opposable est qualitatif, et il suffit à E8 :** un nœud `round` dépense **un** pas de
> budget mais coûte **un à deux ordres de grandeur** de plus en temps mural qu'un nœud
> arithmétique. Ce n'est pas un problème de borne — la borne compte des pas — mais E8 doit le
> savoir avant de dimensionner un délai de worker.

**Piège vérifié, à ne pas réintroduire.** Une version naïve du cas « tous les chiffres tombent »
répond `130` à `round(120, -1, m)`. Ce qui le répare est la distinction *adjacent* : **seul un
décalage d'exactement une place peut atteindre le demi.** Un vecteur figé l'épingle.

**Écarté.** (a) L'algorithme de Dekker : exact — mais exact pour la sémantique **binaire**, que D2
refuse ; et l'ordre de ses quatre additions porte la correction sans qu'aucun outil ne le protège.
(b) Une expansion décimale exacte en BigInt en production : donnerait `1.005 → 1.00`, c'est-à-dire
encore la sémantique binaire, pour trois fois le coût. (c) `decimal.js` / `big.js` : refusé par
l'ADR 0003 décision 4 et par AGENTS.md §7.

**Réversible** — le corps de trois fonctions, tant que les vecteurs figés restent verts.

---

### D6 — Politique d'erreur : **zéro code nouveau**, un garde de sortie conservé, une réserve nommée

**Décision.** Absence → propage `undefined`. Présent non numérique → `operand-type` en `['value']`.
`NaN` / infini → `not-finite` en `['value']`. Débordement en sortie → `not-finite` en `[]`.
`decimals` fractionnaire, non fini, hors bornes, ou `mode` inconnu → refusés **par Zod au save
time**, jamais au rendu. Aucune entrée ajoutée à `OPERAND_ERROR_CODES` ni à `LIMIT_ERROR_CODES` ;
`ExpressionErrorSite` s'élargit tout seul par dérivation d'`ExpressionKind` (`errors.ts:80`).

**Pourquoi.** C'est le meilleur résultat que C2 puisse offrir à C8 : **aucun message neuf à
écrire**. La politique de C1 s'applique mot pour mot, et l'absence propagée compose **gratuitement**
avec l'agrégation, qui ignore un élément absent — d'où D7 sans une ligne dans `aggregate.ts`.

**Le garde de sortie n'est pas décoratif, et c'est vérifié.** Dans la fenêtre `[-15, 15]` il ne peut
pas se déclencher, et 480 000 tirages n'ont produit aucun résultat non fini. Mais
`evaluateExpression` est **publique** et prend un `Expression` de n'importe où — l'argument que la
borne de profondeur documente déjà — et un `{ decimals: -308 }` construit à la main sur
`Number.MAX_VALUE` reconstruit `Infinity`. Un document ne doit jamais en porter un : le garde
reste, et un test construit ce nœud à la main.

> ⚠️ **Réserve nommée, mesurée, et corrigée dans le contrat.** Une version antérieure de ce plan
> écrivait que `NaN` et `Infinity` étaient « refusés avec le message par défaut de Zod, vérifié ».
> Le message est bien un refus, mais il est **auto-contradictoire pour les infinis** : mesuré sur
> `zod@3.25.76` via `zod/v4`, `decimals: Infinity` rend **`Invalid input: expected number, received
> number`**. C'est exactement le défaut de charge que C1 a corrigé en créant `not-a-whole-number`
> (`guards.ts:199-200` : « Reporting `operand-type` with `actualType: 'number'` made the payload
> contradict itself »). Laisser ce message serait livrer, dans le seul lot dont la promesse est
> « zéro message neuf », le seul message illisible.
>
> **Correction, mesurée : `z.number({ error: '…' })`.** Un `.refine(Number.isFinite, …)` **ne
> marche pas** — `z.number()` refuse l'infini avant que le refine ne tourne, vérifié. Avec le
> paramètre `error`, les six messages du champ deviennent tous lisibles ([§5.3]). Coût : un
> argument. La promesse de D6 tient toujours : zéro code d'erreur nouveau.

**Écarté.** (a) Un code `precision-out-of-range` : il n'existerait que pour un arbre non parsé.
(b) Réutiliser `not-a-whole-number` pour `decimals: 40` : 40 *est* entier, la charge mentirait.
(c) Supprimer `requireFiniteResult` au motif d'une branche non couverte : elle est atteignable
*et* testable.

**Réversible.**

---

### D7 — L'agrégation n'est pas touchée : le critère est une propriété du **MODÈLE**

**Décision.** Zéro ligne modifiée dans `aggregate.ts`. L'ordre d'accumulation reste positionnel et
contractuel, l'absence reste ignorée, `sum` d'une liste vide reste `0`. Le modèle qui satisfait le
critère de recette arrondit **aux deux niveaux** :
`round(sum(lignes, l, round(mul(l.q, l.p), 2, m)), 2, m)`. Openview ne l'impose pas.

**Pourquoi l'arrondi extérieur est nécessaire, et mesuré.** La somme des lignes arrondies
`20 + 30 + 10 + 2.13 + 1.13` vaut **`63.260000000000005`**, et `text()` l'imprimerait tel quel : le
playground afficherait lui-même le contre-exemple. Avec l'enveloppe, `round(63.260000000000005, 2,
m)` vaut `63.26` — et **la même somme dans un autre ordre** (`2.13 + 1.13 + 20 + 30 + 10 === 63.26`)
donne le même total arrondi.

**Jusqu'où la propriété tient — et là encore, une preuve plutôt qu'un tirage.**

> ⚠️ **Correction d'un raisonnement faux, à ne pas recopier dans l'ADR 0004.** Une version
> antérieure écrivait : « sur 1 000 lignes, la propriété tient jusqu'à des totaux de l'ordre de
> **5·10⁹** (0/2000 échecs), et se rompt vers **5·10¹⁰** (501/2000) ». Le point de rupture est faux
> de plus de **deux ordres de grandeur**, et il est faux de façon *démontrable* : à 5·10¹⁰ un échec
> est arithmétiquement impossible.
>
> **La borne prouvée.** Pour `N` lignes, l'erreur de chaque addition est bornée par la demi-`ulp`
> du total, donc la dérive totale est bornée par `N · ulp(T)/2`. La propriété est garantie tant que
> `N · ulp(T)/2 < 0,005`. À `N = 1 000` : `ulp(T)/2 < 5·10⁻⁶` exige `ulp(T) < 10⁻⁵`, or
> `2⁻¹⁷ ≈ 7,63·10⁻⁶` couvre `T < 2³⁶ ≈ 6,87·10¹⁰`. **La propriété est donc garantie, sans tirage,
> pour tout total inférieur à ~6,9·10¹⁰ sur 1 000 lignes.** Et cette borne se transpose à n'importe
> quel nombre de lignes, ce qu'un tirage ne fait pas.
>
> **La mesure, qui va bien au-delà de la garantie — et dont les comptes dépendent de la loi de
> tirage, laquelle est donc écrite en entier.** Une version antérieure donnait `0 | 48 | 515` aux
> trois derniers paliers avec pour tout protocole « montants au centime tirés uniformément » : sans
> l'intervalle ni la graine, **ce chiffre ne se reproduit pas** — trois relectures indépendantes ont
> rendu trois lignes d'échecs différentes et toutes plus hautes. Un chiffre qu'INC-5 verse à l'ADR
> 0004 porte son protocole, celui-ci :
>
> > `N = 1 000` lignes ; le montant de chaque ligne est tiré **uniformément au centime dans
> > `[0, 2·T/N]`**, où `T` est le total moyen visé ; **2 000 factures par palier** ; PRNG
> > `mulberry32`, **graines 1, 7 et 42** ; accumulation positionnelle en binary64 ; arrondi
> > extérieur `roundDecimal(acc, 2, 'halfExpand')` comparé au **double le plus proche de la somme
> > exacte en centimes** (BigInt). Node 24.11.1.
>
> | Total moyen | `5·10⁹` | `10¹⁰` | `5·10¹⁰` | `10¹¹` | `10¹²` | `2·10¹²` | `5·10¹²` | `10¹³` | `10¹⁴` |
> | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
> | échecs / 2 000 (graine 1) | 0 | 0 | 0 | 0 | 0 | **9** | 488 | 1 110 | 1 866 |
> | étendue sur les trois graines | 0 | 0 | 0 | 0 | 0 | 2–9 | 488–521 | 1 110–1 134 | 1 861–1 866 |
> | écart max (€) | 0 | 0 | 0 | 0 | 0 | 0,0100 | 0,0205 | 0,0313 | 0,3125 |
>
> **Le premier palier en échec est `2·10¹²`**, soit trente fois au-dessus de la garantie prouvée et
> huit ordres de grandeur au-dessus de toute facture. La phrase juste, à écrire dans l'ADR :
> *garantie prouvée jusqu'à ~6,9·10¹⁰ à 1 000 lignes ; mesurée sans un seul échec jusqu'à `10¹²` ;
> premier échec à `2·10¹²` (2 à 9 sur 2 000 selon la graine, écart maximal 0,0100 €), **sous la loi
> de tirage ci-dessus — les comptes en dépendent, la borne prouvée non.*** C'est une borne de
> binary64, pas une borne que C2 introduit.

**Écarté.** (a) Un `sum` qui arrondirait ses termes : arrondi implicite. (b) Un refus au parse d'un
`sum` non enveloppé : ce serait imposer une règle de conception, et rendre **inexprimable** le
modèle « lignes exactes, total arrondi » qui vaut `63.25`. (c) Un drapeau `roundTotals` sur le
template. Le signalement d'un total non enveloppé est un **lint de l'éditeur (D7)**, pas un refus de
`core`.

**Réversible.**

---

### D8 — Aucune déclaration d'arrondi ailleurs que sur le nœud

**Décision.** Le contrat ne porte ni `Template.rounding`, ni défaut de document, ni héritage par
sous-arbre. Un arrondi n'existe que là où un nœud `round` est écrit.

**Pourquoi.** Un défaut au niveau du modèle est un arrondi **implicite** : `mul(q, pu)` rendrait une
valeur arrondie sans qu'aucun `round` ne figure dans l'arbre. Il casse les trois promesses qui
tiennent le lot — « visible dans l'arbre » (ADR 0003 D4), « la barre de formule montre ce qui est
calculé » (D7), « un refus désigne un nœud » (C8) — et il fait dépendre la valeur d'un sous-arbre
d'un champ situé ailleurs, le pire dispositif possible pour qui cherche un écart d'un centime. Il
**dégraderait** aussi C6 : l'échelle d'un nœud deviendrait `surcharge ?? ancêtre ?? document`, une
résolution que C6 devrait réimplémenter et tenir en phase.

Le besoin réel derrière « déclarer une fois » — ne pas retaper `2, 'halfExpand'` quarante fois — est
un problème d'**éditeur**, que D7 règle en pré-remplissant le widget, ce qui écrit un nœud
explicite.

**Écarté.** `Template.rounding?: { decimals, mode }` avec surcharge par nœud, aussi pour son coût de
sortie : un champ de document, une fois stocké, ne se retire qu'avec une migration
**transformante**.

**Irréversible.**

---

### D9 — `schemaVersion` passe à 3, estampille unique en fin de lot

**Décision.** `CURRENT_SCHEMA_VERSION = 3` et
`{ from: 2, to: 3, migrate: (input) => ({ ...input, schemaVersion: 3 }) }` dans le **même commit**,
sans fusionner l'entrée `1 → 2`. Estampille posée **une seule fois**, après la dernière forme
persistée du lot (INC-3). **Tout commit C2 antérieur est déclaré non publiable.** Les sept
assertions littérales de `migrate.test.ts` (L132, L168, L176, L181, L182, L184, L218) sont
délittéralisées vers `CURRENT_SCHEMA_VERSION`.

**Pourquoi.** Ajouter `RoundExpressionSchema` à `printableMembers()` élargit d'un coup
`ExpressionSchema` **et** `PrintableExpressionSchema`, donc `TextBindingSegment.value` : c'est le
« refus illisible » que `template.ts:35-43` décrit mot pour mot — `"No matching discriminator"` /
`"Invalid input"` sur un chemin `root.children.0.content.1.value.kind`, sans version nommée et sans
remède. AGENTS.md §1.2 ferme la porte de sortie : « il n'y a pas de dérogation pré-v1.0 au
versionnement ». Que sept tests rougissent n'est pas un dégât collatéral, c'est la preuve que le
versionnement est outillé.

**Écarté.** « C'est purement additif, donc pas d'incrément » — déjà démoli par l'ADR 0003 (« Faux, et
c'est le pilier qui tombe »). Fusionner `1 → 2` en `1 → 3` — rompt le contrat pas-à-pas de
`migrate.ts:7-9` et le test de composition de `migrate.test.ts:191-211`.

**Irréversible.**

---

### D10 — La frontière C2/C6 est écrite comme un test, et la contradiction de textes est nommée

**Décision.** Le test, à écrire dans la docstring de `RoundExpression` : *si une déclaration peut
changer le résultat d'un `compare`, d'un `sum` ou d'un `dateAdd`, elle est C2 ; si elle ne peut
changer que ce qu'un lecteur voit, elle est C6.* Et C2 **constate** un piège aval, **sans prescrire
l'implémentation de C6**.

> ⚠️ **Correction d'un raisonnement faux, à ne pas recopier dans l'ADR 0004.** Une version
> antérieure de cette décision écrivait, en impératif : « **C6 doit résoudre
> `maximumFractionDigits` depuis l'échelle DÉCLARÉE dans l'arbre** », et proposait de le faire
> respecter par une case du gabarit de PR. Deux défauts, et le second est de méthode.
>
> **Le dépôt a DÉJÀ écrit comment C6 formate, et il l'a écrit dans un fichier protégé par AGENTS.md
> §7.** `biome.jsonc:273`, entrée `toLocaleString` de `noJsRestrictedProperties` : « *Nothing is
> lost, because C6 formats through `Intl.NumberFormat(locale)` and `Intl.DateTimeFormat(locale, {
> timeZone })`, both of which stay allowed and say what they read.* » **Un plan ne peut pas amender
> `biome.jsonc` par une phrase écrite ailleurs.** C'est une contradiction de textes, elle doit être
> nommée, et elle se règle hors de C2.
>
> **Second défaut : la contre-règle n'était pas outillable par C2.** Le plan écarte par ailleurs
> `declaredScaleOf(expression)` — à raison, aucun consommateur aujourd'hui — si bien que
> « l'échelle déclarée dans l'arbre » n'aurait eu **aucun mécanisme**. C'est précisément la « règle
> non outillée » qu'AGENTS.md dénonce en ouverture.

**Ce que C2 fait donc, et rien de plus : il constate, il chiffre, et il consigne.** Mesuré sur Node
24.11.1 :

| Mesure | Résultat |
| :--- | :--- |
| `new Intl.NumberFormat('fr-FR').resolvedOptions()` | `maximumFractionDigits: 3`, `roundingMode: 'halfExpand'` |
| `Intl.NumberFormat('fr-FR').format(1/3)` | `0,333` — donc **un arrondi non déclaré** |
| `style: 'currency'`, `maximumFractionDigits` résolu | EUR **2** · JPY **0** · TND **3** · BHD **3** · CLF **4** |
| `format(63.260000000000005)` en EUR | `63,26 €` — la valeur fautive s'imprime juste |
| `String(round(1.5, 2, m))` | `"1.5"`, pas `"1.50"` |

**Deux conclusions, et elles sont des constats, pas des ordres.** (1) Un C6 qui appellerait
naïvement `Intl.NumberFormat(locale, { style: 'currency', currency })` embarquerait une **table
devise → décimales détenue par ICU**, que ni le modèle ni l'intégrateur n'a déclarée, et un arrondi
non déclaré, le tout silencieusement. **C2 ne qualifie pas cette table** : la liste de ce que le
dépôt refuse est **close** (`docs/roadmap/README.md:132` — « taux de TVA, régimes, barèmes, arrondis
« légaux », conversion de devise **à un taux officiel** ») et l'unité mineure d'une devise
(ISO 4217) n'y figure pas. Le classement appartient à C6, qui l'instruira. (2) Le zéro de
remplissage (`1.50`) est du **remplissage**, il ne peut pas changer une valeur, et il appartient
à C6.

> ⚠️ **Correction d'un raisonnement faux, à ne pas recopier dans l'ADR 0004.** Une version
> antérieure écrivait, de cette table, « **c'est-à-dire une règle** », et faisait de cette
> qualification le fondement d'une case du gabarit de PR ([§8], n°5). **C2 n'a pas mandat pour
> classer ce que C6 n'a pas encore instruit** : ni le README, ni la roadmap, ni aucune des trois
> ADR ne range une convention d'affichage parmi les règles, et un garde-fou opposable à toutes les
> PR du dépôt passe par un amendement d'AGENTS.md, qui « fait foi » (§1.2) — jamais par une
> classification écrite en marge d'un plan de lot.

**Où la contradiction se règle.** Pas ici. Elle se consigne dans l'ADR 0004 sous la forme d'une
question ouverte adressée à C6, avec sa mesure, et l'amendement éventuel du message de
`biome.jsonc:273` demande **un mandat explicite** (AGENTS.md §7) qui n'est pas dans le périmètre de
C2. L'arbitrage n°5 de la [§8] posait la question — faut-il renforcer le gabarit de PR, et
comment — et il a été **tranché C le 2026-08-14** : rien dans le gabarit, le risque reste porté
par l'ADR 0004, faute de mandat pour classer l'échelle décimale d'une devise parmi les barèmes.

**Écarté.** Faire porter au kind une notion de « décimales affichées », ou lui faire produire une
chaîne : position de format *de fait*, et une chaîne ne se somme pas. Écarté aussi : livrer
`declaredScaleOf(expression)` dans C2 — aucun consommateur, un second parcours de l'algèbre, donc
de la sur-ingénierie ; la **forme** rend la fonction possible, C6 l'écrira s'il en a besoin.

**Réversible.**

---

### D11 — Deux `switch` plutôt qu'un Visitor d'expressions : la dérogation est **écrite**, pas constatée

> ⚠️ **Correction d'un raisonnement faux, à ne pas recopier dans l'ADR 0004.** Une version
> antérieure de ce plan classait `visitor.ts` en « ne se touche pas » avec pour toute
> justification : « le Visitor porte sur `DocumentNode.type` ». C'est un **constat**, pas une
> réponse à la règle. AGENTS.md §3.B écrit que le Visitor est « **obligatoire** dès qu'un deuxième
> parcours apparaît » et que « Composite sans Visitor est un demi-patron ». L'algèbre d'expressions
> **est** un Composite, elle compte déjà **deux** parcours écrits en `switch` nu et dupliqué —
> `evaluator/evaluate.ts:77` et `paths.ts:43` — et C2 les porte tous deux à dix-neuf branches.
> **Aucune ADR, aucun plan ne consigne de dérogation pour les expressions.** C'était le seul endroit
> du plan où une règle « obligatoire » du dépôt était contournée par une observation.

**Décision.** Aucun Visitor d'expressions n'est écrit — la règle anti-sur-ingénierie et le poids S
l'interdisent l'un comme l'autre. **La dérogation est écrite, avec son contrôle compensatoire et
son seuil de réouverture**, dans ce plan puis dans l'ADR 0004 :

> **Dérogation à AGENTS.md §3.B, pour l'algèbre d'expressions uniquement.** Les deux parcours
> restent des `switch`, parce que le contrôle compensatoire existe et qu'il est **plus fort** qu'un
> Visitor : `const exhaustive: never = expression` en `evaluate.ts:146` et en `paths.ts:113` rend
> l'oubli d'un kind **impossible à livrer** — ce sont les deux sites qui cassent à la porte 2, pas
> à la revue. Un Visitor d'expressions ajouterait une interface, une indirection et un point de
> dispatch supplémentaire sans ajouter une seule garantie que ces deux `never` ne donnent pas déjà.
> **Seuil de réouverture, nommé : l'apparition d'un troisième parcours d'expression.** Ce jour-là,
> la duplication cesse d'être de deux exemplaires et le Visitor redevient le bon patron.

**Réversible** — et son coût de réouverture est faible, précisément parce que les deux `never`
garantissent que les deux `switch` sont complets.

---

### D12 — Ce que le lot refuse, par écrit

- **Tout arrondi implicite**, y compris au sommet d'un total. Les tests C1
  `does NOT round a division` (`arithmetic.test.ts:74`) et `does not round either` (`:173`) restent
  **intacts** et ne doivent jamais être affaiblis.
- **Toute valeur par défaut** : ni `decimals?`, ni `mode?`, ni mode privilégié. Un défaut ici
  rendrait **irrecevable** la décision ouverte n°6 de `docs/roadmap/README.md`, en tranchant au
  niveau du **contrat** ce qu'elle veut trancher au niveau des modèles livrés.
- **Les modes dirigés et les demi-modes directionnels** (D3), **tout nom à consonance
  réglementaire**, **toute table devise → décimales** — y compris dans un exemple de docstring.
- **`decimals` ou `mode` calculés** (D4). En revanche `decimals` **négatif** est autorisé.
- **Tout formatage** : remplissage, séparateur, symbole, locale, `toFixed` en sortie,
  `toLocaleString` (refusé par la machine dans `core`).
- **Tout changement de représentation numérique** : ni `decimal.js`, ni `big.js`, ni entiers de
  centimes, ni `BigInt` en production. La décision 4 de l'ADR 0003 reste **réversible** ; C2 ne la
  consomme pas.
- **Tout code d'erreur nouveau, tout plafond nouveau, tout champ d'`EvaluationLimits`.**
- **Toute répartition d'un montant arrondi sur N lignes** (plus grand reste, absorption du résidu).
  C'est le seul besoin comptable réel non couvert, et il est refusé pour une raison de périmètre :
  *quelle* ligne absorbe le résidu est une **règle**. Openview donne la capacité de calculer le
  résidu — `sub(round(total, 2, m), sum(lignes, l, round(l.montant, 2, m)))` — et laisse l'auteur
  décider où il tombe.
- **Toute traçabilité de calcul** (écartée du v1 par la roadmap) et **tout arrondi de report de
  page** (E3 : seul le moteur sait où il coupe).
- **Toute lecture d'environnement.** `round` est pur de ses arguments explicites.

---

## 3. Le contrat définitif

Le module numérique de la [§3.3] a été écrit dans le bac à sable de la session, exécuté sur Node
24.11.1 et confronté à une référence BigInt indépendante ; les extraits de type ont été
type-checkés hors du dépôt sous une copie fidèle de `tsconfig.base.json` + `packages/core/tsconfig.json`
(`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`,
`NodeNext`). Aucun `any`, aucun `!`, aucun cast, aucun `@ts-*`, aucun accès indexé.

> 🔒 **Aucune écriture n'a été faite dans `packages/**` pour produire ce plan.** `git status` est
> identique avant et après. Ce qui n'a pas pu être vérifié sans écrire dans le dépôt est signalé
> comme non vérifié en [§9].

### 3.1 `packages/core/src/expression/types.ts` — les modes, la fenêtre, le kind

```ts
/**
 * The two ways a tie is broken, and the whole set.
 *
 * The names are ECMA-402's `roundingMode` values, taken verbatim, and the reason is not
 * fashion:
 *
 * - **They are unambiguous about the sign.** `halfUp` reads as "ties toward +Infinity" to
 *   half the industry (ECMA-402 calls that `halfCeil`) and "ties away from zero" to the
 *   other half (Java's `HALF_UP`). On a credit note the two differ by one cent on every
 *   line, and a field that decides a cent may not be named by a word that means two things.
 * - **They stay coherent if the set is ever widened.** Should a directed mode be admitted
 *   one day (see below), `expand`/`trunc`/`ceil`/`floor` join a vocabulary that already
 *   names them; `halfUp` would have made `ceil` unreadable beside it.
 * - **They make the verification self-documenting.** `Intl.NumberFormat` with the SAME
 *   string is the oracle these two modes were checked against. That oracle is a development
 *   probe, never a committed test: its result is indexed on an ICU build, and a
 *   deterministic engine may not depend on one.
 *
 * `halfExpand` sends a tie AWAY FROM ZERO: `2.125` yields `2.13` and `-2.125` yields
 * `-2.13`. `halfEven` sends it to the even last digit: `2.125` yields `2.12`, `2.135`
 * yields `2.14`. It exists for the one property `halfExpand` does not have -- applied to
 * many amounts it does not drift the total upward.
 *
 * ## What is refused, and on which ground
 *
 * The DIRECTED modes -- `ceil`, `floor`, `expand`, `trunc` -- are not here, and the ground
 * is the one this repository already writes: no named use today, and the anti-over-
 * engineering rule. Adding one later costs a single stamp migration and invalidates no
 * stored template, which makes it the cheapest decision in the lot to defer. The reopening
 * signal is written: a request naming a business need that must round in one direction
 * INSIDE the template.
 *
 * A measurement is recorded with that refusal IN ADR 0004, as information rather than as the
 * criterion, because it will matter on the day it is reopened: a directed mode reads EVERY
 * discarded digit, where a half-mode only looks at the one just past the rounding position,
 * so a `ceil` at two decimals answers a cent too high whenever a sum carries a binary
 * residue. The figures and their protocol live in the ADR, not in a published typing.
 *
 * Refused for another reason entirely: `bankers`, `commercial`, `legal`, `arrondiLegal`,
 * `swedish`, `cash`, `fiscal`. Each names a rule Openview answers for none of (ADR 0003,
 * decision 10). `halfEven` is what "banker's rounding" is called when it is described
 * instead of invoked.
 */
export const ROUND_MODES = ['halfExpand', 'halfEven'] as const;

export type RoundMode = (typeof ROUND_MODES)[number];

/**
 * The rounding position, as a power of ten. `2` is the cent, `0` the unit, `-3` the
 * thousand.
 *
 * **The window is documentary on BOTH sides, and it is a NARROWING no migration can undo.**
 * That is said first because it is what a later reader needs: it rests on the pre-v1.0
 * assumption, exactly like the three bounds of ADR 0003 decision 2.
 *
 * The upper anchor is not a taste, and not a slogan about `DBL_DIG` -- it is an inequality.
 * A shortest round-tripping decimal has at most 17 digits, and the number of digits dropped
 * is `len - 1 - exponent - decimals`. For any `|value| >= 1` the exponent is at least 0, so
 * from `decimals = 16` onward the count is at most `17 - 1 - 0 - 16 = 0`: **16 is the first
 * position that is the identity for every magnitude at or above one, so 15 is the last one
 * that can still change such a value.**
 *
 * Below magnitude one the property does not hold -- rounding `0.12345678901234566` at 16
 * decimals really does change it -- and no finite bound would make it universal. So above
 * 15 and below -15 the window refuses positions that ARE reachable, deliberately: no
 * document amount has a meaning past `1e15`, which is also the last power of ten on
 * binary64's exact-integer grid (`Number.isSafeInteger(1e15)` is true, `1e16` is false).
 *
 * Widening this later is cheap; shrinking it will not be.
 */
export const MIN_ROUND_DECIMALS = -15;
export const MAX_ROUND_DECIMALS = 15;

/**
 * The rounding a template DECLARES: `round(percentOf(total, rate), 2, 'halfExpand')`.
 *
 * The wrapper ADR 0003 decision 4 announced, confirmed here without reopening it -- a kind
 * of its own, additive, composable and VISIBLE IN THE TREE, never a `precision?` field on
 * every intermediate node that nobody fills in. What decision 4 left to this lot is
 * everything below: the semantics, the mode set and the nature of `decimals`.
 *
 * ## It rounds the number AS IT IS WRITTEN, not the binary value underneath
 *
 * The operation is defined on the SHORTEST decimal that round-trips to the double -- what
 * `toExponential()` returns, and what `text()` prints. So `0.615` yields `0.62`, and the
 * whole explanation is "0.615 rounds up to 0.62". Nothing about IEEE-754 has to be said,
 * which is the entire point: lot C8 exists so a document author never has to learn that
 * `0.615` is stored as `0.614999999999999991118...`.
 *
 * Both alternatives were measured and both fail that test. Rounding the exact binary value
 * -- what `Number(x.toFixed(d))` implements -- disagrees with the printed decimal on 48,00 %
 * of the 100 000 exact `.xx5` ties at two decimals, and worse, it makes THIS KIND'S `mode`
 * FIELD NEARLY DECORATIVE: over the million values `k/1000`, the mode changes the result
 * 2 000 times under binary semantics against 50 000 times here. Scaling by `10 ** decimals`
 * disagrees on 4,59 % of those ties and does so INCONSISTENTLY -- right on `0.615` and
 * `2.675`, wrong on `1.005`, `0.145`, `8.575` and `1.255` -- and "predictable" is a word in
 * this lot's acceptance criterion.
 *
 * Determinism is stronger here than for `textCase`, not weaker: ECMA-262 fixes the shortest
 * round-tripping form exactly ("f as small as possible") and fixes string-to-number as the
 * exact value rounded once to nearest. Neither is indexed on an ICU version.
 *
 * ## Composable, and the position IS the declaration
 *
 * Measured on five lines (17 x 0.125, 3 x 0.375, 2 x 10, 1 x 30, 4 x 2.5):
 *
 * - rounding each line, then the total, in `halfExpand` -> 2.13 | 1.13 | 20 | 30 | 10, total 63.26
 * - the same in `halfEven`                              -> 2.12 | 1.12 | 20 | 30 | 10, total 63.24
 * - rounding only the total, lines left exact           -> 63.25
 *
 * Three cents of spread between three templates nobody could call wrong. A `precision?`
 * field could not have expressed the third at all: there is no intermediate node to hang it
 * on.
 *
 * ## What it is NOT
 *
 * It yields a NUMBER, never a string, and a double carries no scale: `round(1.5, 2, m)` is
 * `1.5` and prints `1.5`, not `1.50`. The trailing zero is padding, padding cannot change a
 * value, and it belongs to lot C6 -- writing it here would be a format position *de facto*,
 * the same mistake as the implicit rounding refused for `percentOf`.
 *
 * **The frontier, as a test:** if a declaration can change the result of a `compare`, a
 * `sum` or a `dateAdd`, it is C2; if it can only change what a reader sees, it is C6.
 */
export interface RoundExpression {
  readonly kind: 'round';
  readonly value: PrintableExpression;
  /**
   * A LITERAL whole number in `[MIN_ROUND_DECIMALS, MAX_ROUND_DECIMALS]`, never an
   * expression -- checked when the template is SAVED, which is the doctrine
   * `PathExpressionSchema` already states at exactly this point.
   *
   * The decisive reason is neither of those, though: **"does this total round like the
   * lines above it?" has to be answerable WITHOUT the data.** With a literal it is a
   * comparison of two integers in the tree, done by a reviewer, by a reader of the JSON, or
   * by lot D7's formula bar. With an expression it becomes undecidable until a document
   * renders, and a criterion nobody can check before rendering is not a criterion.
   *
   * The cost is named and accepted: a per-scale precision is not data-driven, and a
   * template that needs two scales writes the choice into the tree with an `if`, where it
   * can be seen. That is ADR 0003 decision 3 applied again: composition replaces
   * optionality, and every field stays required everywhere. Choosing a DISPLAY scale from
   * something the template declares is lot C6's problem, not this field's.
   */
  readonly decimals: number;
  readonly mode: RoundMode;
}
```

Et la seule édition de l'union — `Expression` (`:348`) et `ExpressionKind` (`:350`) en dérivent,
aucune autre ligne n'est touchée :

```ts
export type PrintableExpression =
  | LiteralExpression
  | PathExpression
  | ArithmeticExpression
  | PercentOfExpression
  | RoundExpression // <- la seule édition de cette union
  | AggregateExpression
  | CountExpression
  | ConditionalExpression
  | ConcatExpression
  | TextExpression
  | TextCaseExpression
  | DateAddExpression
  | DateDiffExpression
  | EndOfMonthExpression;
```

> ⚠️ **Deux phrases de docstring deviennent fausses à la livraison, et une troisième doit être
> reformulée.** `types.ts:132-134` (`PercentOfExpression`) annonce le kind « in lot C2 » : la
> phrase se réécrit au présent, en conservant l'interdit qui la portait —
> « *How an amount rounds is declared by the template through the `round` wrapper kind -- not
> through a `precision?` field on every intermediate node that nobody fills in. `div` and
> `percentOf` still round nothing, and two tests pin that.* » `types.ts:243-259` (`TextExpression`)
> cite « the implicit rounding refused for `percentOf` » : la phrase reste **vraie** et ne bouge
> pas. Enfin, ne jamais écrire dans une docstring qu'un résultat est « un multiple de
> `10 ** -decimals` » : c'est faux du double rendu, `0,01` n'étant pas représentable — mesuré,
> **11,35 %** de 200 000 résultats à deux décimales ne satisfont pas `r * 100 === Math.round(r * 100)`.
> La formulation juste est : *le résultat est le double le plus proche du multiple de
> `10^-decimals`, et sa forme décimale la plus courte **est** ce multiple.*

### 3.2 `packages/core/src/expression/schemas.ts`

```ts
import {
  AGGREGATE_OPERATORS,
  ARITHMETIC_OPERATORS,
  type Expression,
  MAX_ROUND_DECIMALS,
  MIN_ROUND_DECIMALS,
  type PrintableExpression,
  ROUND_MODES,
  TEXT_CASE_OPERATORS,
} from './types.js';

/**
 * Everything a rounding can get wrong about ITSELF is settled here, when the template is
 * saved: a fractional position, a non-finite one, a position outside the window, an unknown
 * mode. That is what lets lot C2 introduce **zero new error codes** -- worth more to lot C8
 * than any wording, and only true because these two fields are literals.
 *
 * The `error` argument on `z.number()` is not decoration. Measured on the installed Zod
 * (3.25.76 via `zod/v4`), the default message for `Infinity` is `Invalid input: expected
 * number, received number` -- a payload that contradicts itself, which is the exact defect
 * lot C1 fixed by creating `not-a-whole-number`. A `.refine(Number.isFinite, ...)` does NOT
 * fix it: `z.number()` rejects the infinities before any refinement runs.
 *
 * There is deliberately NO refinement on a literal in the `value` position, unlike
 * `dateOperandSchema`. That position is exactly `arithmetic.left`; giving the same class of
 * operand two different save-time strictnesses is an inconsistency lot C8 could not explain
 * ("why does the sum accept it and the rounding not?"). A date position is different: it
 * has a FORMAT, and the refinement there carries information nothing else does.
 */
export const RoundExpressionSchema = z.object({
  kind: z.literal('round'),
  value: PrintableExpressionSchema,
  decimals: z
    .number({ error: 'A rounding position is a finite whole number of decimal places' })
    .int('A rounding position is a whole number of decimal places')
    .min(MIN_ROUND_DECIMALS, `A rounding position may not go below ${MIN_ROUND_DECIMALS}`)
    .max(MAX_ROUND_DECIMALS, `A rounding position may not exceed ${MAX_ROUND_DECIMALS}`),
  mode: z.enum(ROUND_MODES),
});
```

Et **un seul point d'ajout**, dans `printableMembers()` — `ExpressionSchema` (`:60-62`) et
`PrintableExpressionSchema` (`:68-70`) sont *construits* depuis cette fonction, les deux
`discriminatedUnion` n'ont rien à éditer :

```ts
function printableMembers() {
  return [
    LiteralExpressionSchema,
    PathExpressionSchema,
    ArithmeticExpressionSchema,
    PercentOfExpressionSchema,
    RoundExpressionSchema, // <- l'ajout
    AggregateExpressionSchema,
    CountExpressionSchema,
    ConditionalExpressionSchema,
    ConcatExpressionSchema,
    TextExpressionSchema,
    TextCaseExpressionSchema,
    DateAddExpressionSchema,
    DateDiffExpressionSchema,
    EndOfMonthExpressionSchema,
  ] as const;
}
```

> ⚠️ **Cet ajout-là ne casse rien si on l'oublie**, et c'est le trou le plus vicieux du lot :
> `z.ZodType` est **covariant en sortie**, donc un corps de `z.lazy` qui produit *moins* que son
> annotation reste assignable. Il n'est rattrapé que parce que `SAMPLES` (`schemas.test.ts:76-144`)
> casse d'abord la compilation et que le test de parse itère dessus. **Les deux gardes sont
> couplés : ne pas ajouter l'un rend l'autre décoratif.**

### 3.3 `packages/core/src/expression/evaluator/operations/round.ts` — nouveau

```ts
import type { RoundMode } from '../../types.js';
import { requireFiniteResult, requireNumber } from '../guards.js';

const ZERO = 48;
const NINE = 57;

/** Adds one to a decimal digit string, growing it by one digit on a full carry. */
function increment(digits: string): string {
  let cursor = digits.length;
  while (cursor > 0 && digits.charCodeAt(cursor - 1) === NINE) {
    cursor -= 1;
  }
  if (cursor === 0) {
    return `1${'0'.repeat(digits.length)}`;
  }
  const raised = digits.charCodeAt(cursor - 1) - ZERO + 1;
  return `${digits.slice(0, cursor - 1)}${raised}${'0'.repeat(digits.length - cursor)}`;
}

/**
 * Whether any digit from `from` on is non-zero -- a loop rather than a regex over a
 * substring, so nothing is allocated to answer a yes/no question on the hot path.
 */
function hasNonZero(digits: string, from: number): boolean {
  for (let index = from; index < digits.length; index += 1) {
    if (digits.charCodeAt(index) !== ZERO) {
      return true;
    }
  }
  return false;
}

/**
 * Whether the kept digits carry. `lastKept` decides an EXACT tie, and only for `halfEven`
 * -- which is the one place in this lot where the declared mode changes anything.
 */
function goesUp(mode: RoundMode, first: number, restNonZero: boolean, lastKept: number): boolean {
  if (first !== 5) {
    return first > 5;
  }
  if (restNonZero || mode === 'halfExpand') {
    return true;
  }
  return lastKept % 2 === 1;
}

/**
 * The kept digits, as an integer string of the result in units of `10 ** -decimals`.
 *
 * The `drop >= digits.length` branch is the case where every digit falls. Only when
 * EXACTLY one place separates them can the value still reach the tie; any further out it is
 * strictly below half, whatever the digits say. Getting that wrong is how a naive version
 * answers `130` to `round(120, -1, ...)`, and a frozen vector pins it.
 */
function keptDigits(digits: string, drop: number, mode: RoundMode): string {
  if (drop >= digits.length) {
    const adjacent = drop === digits.length;
    const first = adjacent ? digits.charCodeAt(0) - ZERO : 0;
    return goesUp(mode, first, adjacent && hasNonZero(digits, 1), 0) ? '1' : '0';
  }
  const cut = digits.length - drop;
  const kept = digits.slice(0, cut);
  const up = goesUp(
    mode,
    digits.charCodeAt(cut) - ZERO,
    hasNonZero(digits, cut + 1),
    digits.charCodeAt(cut - 1) - ZERO,
  );
  return up ? increment(kept) : kept;
}

/**
 * Rounds a value at a declared position, in a declared mode, on the number AS IT IS
 * WRITTEN.
 *
 * The value goes through its SHORTEST round-tripping decimal form, is rounded on the digit
 * string, and is rebuilt by a single string-to-number conversion -- so there is exactly ONE
 * binary rounding in the whole operation, at the end, and no intermediate scaling
 * contributing an error of its own. `10 ** decimals` appears nowhere: exponentiation is
 * implementation-approximated in ECMA-262, which is the very reason `Math.pow` was kept out
 * of the algebra (see ARITHMETIC_OPERATORS).
 *
 * PRECONDITION, and it is enforced by the first line rather than merely documented: the
 * value must be FINITE. In the normal flow `evaluateRound` has already refused a non-finite
 * operand through `requireNumber`, but this function is exported and a test, a property
 * draw or a future caller reaches it directly. Without the guard, `NaN` does not propagate
 * and does not throw -- it returns an AMOUNT.
 *
 * Verified over 4 400 022 comparisons against an independently written exact BigInt
 * reference -- every `k/1000` in both signs up to 60 000, 40 000 uniform random bit
 * patterns, 40 000 realistic amounts, at eleven precisions including both bounds, in both
 * modes -- with ZERO divergence. Idempotent, monotone, finite on every finite input, and a
 * negative zero cannot come out of it by the structure of the code rather than by a patch.
 *
 * Cost, Node 24.11.1, 200 000 warm-up iterations then 2 000 000 calls on pre-drawn values:
 * ~1.52 us on 17-digit values, ~1.23 us on a realistic invoice mix, against ~50 ns for a
 * multiplication. Three other machines measured between 0.8x and 3.2x those two figures --
 * in BOTH directions -- so the one to carry forward is a RANGE: a `round` node costs one to
 * two orders of magnitude more wall time
 * than an arithmetic node while spending the SAME single step of the budget. Not a bound
 * problem -- the bound counts steps -- but lot E8 needs it before it sizes a worker timeout.
 */
export function roundDecimal(value: number, decimals: number, mode: RoundMode): number {
  // A non-finite input leaves UNCHANGED, and this guard is load-bearing rather than
  // defensive decoration: without it `NaN` returns a plausible AMOUNT. See the note below.
  if (!Number.isFinite(value)) {
    return value;
  }
  if (value === 0) {
    return 0;
  }
  const shortest = Math.abs(value).toExponential();
  const marker = shortest.indexOf('e');
  const exponent = Number(shortest.slice(marker + 1));
  const digits = shortest.slice(0, marker).replace('.', '');
  const drop = digits.length - 1 - exponent - decimals;
  if (drop <= 0) {
    // Already on the lattice: the identity, and the mode never gets a say.
    return value;
  }
  const sign = value < 0 ? '-' : '';
  const rounded = Number(`${sign}${keptDigits(digits, drop, mode)}e${-decimals}`);
  // `round(-0.004, 2, m)` yields zero, not minus zero: a negative zero is not part of a
  // document's vocabulary, and it would be visible in a test and in a min/max fold.
  return rounded === 0 ? 0 : rounded;
}

/**
 * The kind's evaluation.
 *
 * `site` is hard-coded here, unlike in the shared guards, and for the reason `requireDate`'s
 * docstring gives from the other side: this function serves ONE kind and cannot be
 * copy-pasted onto another, exactly like `evaluateText`.
 *
 * The three policies of ADR 0003 decision 6 apply unchanged, and none of them needed a new
 * error code: absence propagates -- so `sum(lines, l, round(l.total, 2, m))` ignores a line
 * with no total exactly as `sum(lines, l, l.total)` does today -- a present non-number
 * raises `operand-type`, and `NaN` or an infinity raises `not-finite`.
 *
 * `requireFiniteResult` looks unreachable and is not, which is why it stays. Within the
 * declared window it cannot fire, and no non-finite result appeared over 480 000 draws. But
 * `evaluateExpression` is PUBLIC and takes an `Expression` from wherever -- the argument the
 * depth bound already documents -- and a hand-built `{ decimals: -308 }` on
 * `Number.MAX_VALUE` reconstructs `Infinity`. A document must never carry one, so the guard
 * stays and a test builds that node by hand.
 */
export function evaluateRound(
  raw: unknown,
  decimals: number,
  mode: RoundMode,
): number | undefined {
  const value = requireNumber(raw, 'round', ['value']);
  if (value === undefined) {
    return undefined;
  }
  return requireFiniteResult(roundDecimal(value, decimals, mode), 'round', []);
}
```

> 🚫 **Correction d'un défaut réel, trouvé par une analyse externe le 2026-08-14 — et il était
> pire que ce que cette analyse en disait.** Une version antérieure de cette section n'ouvrait pas
> `roundDecimal` par une garde de finitude. L'analyse annonçait une troncature inoffensive de
> `"Infinity"` en `"Infinit"` ; **la mesure dit autre chose**, et c'est le seul cas où ce lot
> aurait pu écrire un montant faux dans un document :
>
> | Entrée | Sans la garde | Avec la garde |
> | :--- | ---: | ---: |
> | `roundDecimal(NaN, 2, m)` | **`0.01`** | `NaN` |
> | `roundDecimal(NaN, 0, m)` | **`1`** | `NaN` |
> | `roundDecimal(NaN, -2, m)` | **`100`** | `NaN` |
> | `roundDecimal(±Infinity, d, m)` | `±Infinity` | `±Infinity` |
>
> **Le mécanisme, parce qu'il ne se devine pas.** `Math.abs(NaN).toExponential()` rend `"NaN"`, où
> `indexOf('e')` vaut `-1` ; `exponent` devient `NaN`, donc `drop` aussi — et **`NaN <= 0` est
> `false`**, si bien que le retour anticipé « déjà sur le réseau » **ne se déclenche pas**. Le
> calcul continue sur la chaîne `"Na"`, `keptDigits` rend `'1'`, et `Number('1e-2')` vaut `0.01`.
> Un `NaN` n'est donc ni propagé ni refusé : il est **converti en centime**. C'est exactement la
> faute que l'ADR 0003 décision 6 avait scellée en amont pour l'arithmétique (« un NaN traverserait
> sinon trois niveaux de formule jusque dans une facture »), et elle se rouvrait ici par une porte
> que personne ne regardait.
>
> `±Infinity`, lui, sortait déjà **correctement** — par le retour anticipé, `-Infinity <= 0` étant
> vrai et `+Infinity` donnant `drop = -Infinity`. La troncature en `"Infinit"` a bien lieu, mais
> elle est sans effet : c'est la moitié du constat externe qui était fausse, et la noter évite
> qu'un relecteur cherche un bug là où il n'y en a pas.
>
> **Pourquoi rendre la valeur plutôt que lever.** La levée appartient à `evaluateRound`, qui refuse
> déjà par `requireNumber` en amont et par `requireFiniteResult` en aval (D6, ADR 0003 décision 6).
> Un helper numérique pur qui lèverait ouvrirait un **second site de levée** hors de `fail()`, ce
> que l'invariant d'INC-1 du lot C1 interdit. Rendre l'entrée inchangée aligne `NaN` sur ce que
> `±Infinity` faisait déjà : **le helper n'invente jamais un nombre, l'évaluateur refuse.**

### 3.4 Les deux parcours — un `case` chacun, et rien d'autre

```ts
// packages/core/src/expression/evaluator/evaluate.ts, dans le switch
      case 'round':
        return evaluateRound(
          evalWithin(expression.value, ['value'], scope, budget),
          expression.decimals,
          expression.mode,
        );
```

```ts
// packages/core/src/expression/paths.ts, dans collectPaths
    case 'text':
    case 'round':
      // `decimals` and `mode` are literals, so a rounding reads nothing of its own.
      collectPaths(expression.value, aliases, into);
      break;
```

> La fusion de `case` est type-sûre : `TextExpression` et `RoundExpression` portent tous deux un
> champ `value: PrintableExpression`, donc le narrowing de l'union sur les deux étiquettes expose
> `expression.value`. Vérifié à la compilation hors dépôt.

### 3.5 `packages/core/src/expression/evaluator/guards.ts` — le message que C1 a laissé faux

```ts
    return fail(
      { code: 'not-a-whole-number', site, at, actualType: 'number' },
      'A date shift is a whole number of days. Wrap the value in a `round` first, with a `decimals` of 0 and a `mode` of `halfExpand` or `halfEven`.',
    );
```

> ⚠️ **Ceci est un changement de vocabulaire assumé, et il doit être déclaré comme tel** — l'ADR
> 0003 attribue la formulation des messages à C8 et C1 a dû énumérer nommément ses trois exceptions.
> **C2 en fait une, et une seule.** Le motif : l'ancienne formulation
> (`guards.ts:204` — « *Round the value first: the algebra has no rounding of its own, and inventing
> one here would be a rounding position by stealth* ») devient **mensongère** à la livraison, et
> c'est un message rendu à l'**auteur du modèle**. C1 l'a écrite en sachant que C2 la rendrait
> actionnable ; ne pas la réécrire serait laisser le moteur mentir à son utilisateur.
>
> **Le remède affiché doit être écrivable.** Une version antérieure de ce plan proposait
> `round(value, 0, ...)` : `mode` étant requis sans défaut (D3, D12), l'ellipse livrerait un remède
> incomplet **exactement là où un refus ne doit pas être inactionnable**. Les deux modes sont donc
> écrits.
>
> **Et il ne s'écrit pas comme un appel.** Une deuxième version proposait
> `round(value, 0, 'halfExpand')` : cette forme donnerait à l'auteur du modèle une **syntaxe
> textuelle qui n'existe nulle part dans le produit**. Openview refuse le parseur (ADR 0001 :
> « pas de parseur — l'expression reste un arbre validé par Zod »), une expression est un arbre
> JSON, et **aucun message du dépôt n'emploie la forme `f(x, y)`** — ils nomment un kind entre
> backticks, comme `arithmetic.ts:37` nomme le kind `if`. Le message final nomme donc le **kind**
> et ses **champs**.
>
> À savoir avant de toucher au fichier : **aucun test ne fige cette chaîne** —
> `dates.test.ts:124-134` n'assertit que `details` — donc rien ne rougira si on la laisse fausse.
> **La conséquence n'est pas d'ajouter un test de chaîne, c'est de prouver le remède**, et les
> deux `it` qui le font sont aussi les deux moitiés manquantes du test de frontière de D10 (qui
> nomme `compare`, `sum` et `dateAdd` là où les tests d'INC-2 n'exerçaient que `sum`). Dans
> `evaluator/__tests__/round.test.ts` : un `dateAdd` dont `days` est un `round` de position 0 sur
> une valeur fractionnaire **rend une date**, là où le même `dateAdd` sans l'enveloppe lève
> `not-a-whole-number` ; et un `compare` d'égalité entre `round(sum(…), 2, 'halfExpand')` et
> `literal(63.26)` rend **`true`**, là où il rend `false` sans l'enveloppe. Vérifié que le remède
> est écrivable sans toucher un schéma : `schemas.ts:168` déclare `days: dayCountOperandSchema`,
> et ce schéma (`:141`) est un `PrintableExpressionSchema.refine(...)` dont le raffinement ne mord
> que sur un `literal` — un nœud `round` y passe tel quel.

### 3.6 `packages/core/src/expression/limits.ts` — la liste qui mentirait sinon

```ts
   * ...**The premise is false for every single-operand kind** -- `not`, `isEmpty`, `text`,
   * `textCase`, `endOfMonth`, `count`, `round` -- whose operand object sits at exactly
   * `parentDepth + 1`...
```

`decimals` et `mode` étant scalaires, `round` est un kind à **opérande unique** : **un** niveau JSON,
**une** descente d'évaluateur, **un** pas de budget, **+4 valeurs** pour le garde de forme (le nœud
plus ses trois propriétés propres). Zéro `visit`, zéro `acceptString` — les chaînes de chiffres qu'il
construit sont bornées par les 17 chiffres d'un binary64 et n'atteignent jamais un document.
**Aucun champ nouveau d'`EvaluationLimits`, aucune méthode nouvelle de budget** : un champ de limite
sans méthode serait un plafond décoratif (ADR 0003, décision 8).

Mesure de profondeur reprise de la cartographie : la facture la plus lourde du critère de recette
(`round` dans l'agrégat **et** au sommet) atteint **14 niveaux JSON** et **100 valeurs**, contre 12
et 84 sans arrondi. Marge restante sous `DEFAULT_SHAPE_LIMITS` (`maxDepth: 64`, `maxNodes: 100_000`) :
**50 niveaux**. **Aucun ajustement de `DEFAULT_SHAPE_LIMITS` n'est requis, et en modifier un
relèverait d'AGENTS.md §7.** `guard.ts` est agnostique aux kinds : **aucune modification.**

### 3.7 `packages/core/src/template/template.ts` et `migrate.ts` — l'estampille

```ts
/**
 * ## What version 3 means
 *
 * Version 3 is version 2 plus ONE stored shape: the `round` kind -- a printable wrapper
 * carrying a literal position in [-15, 15] and one of two tie-breaking modes. Nineteen
 * expression kinds. That widens `PrintableExpressionSchema`, hence
 * `TextBindingSegment.value`, hence every operand position of the algebra.
 *
 * It is the ILLEGIBLE REFUSAL case described above, unchanged: a version 2 build meeting
 * `{ kind: 'round', ... }` answers `"No matching discriminator"` / `"Invalid input"` on a
 * path like `root.children.0.content.1.value.kind`, with no version named and no remedy.
 * "Purely additive" is not an argument against the bump, it is the argument FOR it.
 *
 * Stamped ONCE, after the last persisted shape of the lot. No commit of C2 before that one
 * is publishable, for the reason version 2 already records.
 */
export const CURRENT_SCHEMA_VERSION = 3;
```

```ts
  {
    from: 2,
    to: 3,
    /**
     * Identity, except for the stamp -- and the stamp is the entire point, for the second
     * time and for exactly the reason the 1 -> 2 entry states.
     *
     * A v2 document is STRUCTURALLY a v3 document: lot C2 only WIDENED a union, so there is
     * nothing to transform, and the shape it yields is bounded because it changes neither
     * depth nor value count -- which is what the repository owes itself since the guard runs
     * twice.
     *
     * The reserve transposes word for word: **the version guard reads the STAMP, not the
     * content.** A document stamped `2` but already carrying a `round` node -- hand-made, or
     * written by an unstamped mid-lot build -- still falls back to `Invalid input`, even from
     * a v3 build. The migration stamps; it does not validate.
     *
     * And the `decimals` window is NOT retrofitted here, because there is nothing to
     * retrofit: no v2 document can carry a `decimals` field at all. That is the whole
     * difference between adding a kind and tightening an existing one -- the narrowings of
     * ADR 0003 decision 2 rested on the pre-v1.0 assumption, this one does not have to.
     */
    migrate: (input) => ({ ...input, schemaVersion: 3 }),
  },
```

> ⚠️ **Ne pas transformer l'entrée `1 → 2` en `1 → 3`.** La marche pas-à-pas est le contrat écrit
> de `migrate.ts:7-9` (« *a v1 document opened by a v12 release walks v1 -> v2 -> ... -> v12* »), et
> `migrate.test.ts:191-211` compose une étape synthétique **avec le registre réel**.

### 3.8 Les deux barrels — le point aveugle des quatre portes

```ts
// packages/core/src/expression/expression.ts
export { RoundExpressionSchema } from './schemas.js';
export type { RoundExpression, RoundMode } from './types.js';
export { MAX_ROUND_DECIMALS, MIN_ROUND_DECIMALS, ROUND_MODES } from './types.js';

// packages/core/src/index.ts  --  mêmes six symboles, dans l'ordre alphabétique des blocs
```

> 🔑 **Aucune des quatre portes ne voit un export oublié ici.** Le seul révélateur est
> `apps/playground/src/App.tsx`, qui le dit de lui-même : « *the ONLY real consumer of the package
> barrel […] a blind spot of all four gates on the core side* ». C'est une raison de plus pour
> qu'INC-4 existe.

**Pourquoi exporter `MIN_ROUND_DECIMALS` et `MAX_ROUND_DECIMALS`, alors que `declaredScaleOf` est
refusé.** Le critère est le même et la réponse diffère, il faut donc l'écrire : `declaredScaleOf`
n'a **aucun consommateur aujourd'hui** et coûterait un second parcours de l'algèbre. Les deux bornes,
elles, ont un consommateur **immédiat et hors du dépôt** : l'intégrateur qui construit un nœud
`round` par programme et veut valider son `decimals` avant de le stocker — un cas qui existe dès la
première intégration, pas dans trois mois. **Ce n'est pas D7 qui les justifie**, et l'ADR 0004 doit
le dire dans ces termes, sinon la justification tombera avec le calendrier de D7 (poids XL, dépend
de D6).

---

## 4. Les cinq incréments

Chacun passe les quatre portes seul et laisse le dépôt cohérent. **Cohérent n'est pas publiable.**

> ⚠️ **Correction d'un raisonnement faux, à ne pas recopier.** Une version antérieure écrivait
> « INC-1 **et** INC-2 laissent une forme persistée sans estampille ». Faux pour INC-1 : il ne livre
> qu'une fonction pure, sans kind, sans schéma, sans champ stocké. **INC-1 serait publiable seul ;
> c'est INC-2 qui laisse une forme persistée sans estampille, et le premier commit publiable du LOT
> est INC-3.**

Enchaînement des portes, identique à la CI (`AGENTS.md` §4) :

```bash
pnpm run lint && pnpm run build && pnpm run type-check && pnpm run test:coverage
```

Dépendances entre incréments :

```
INC-1 ──► INC-2 ──► INC-3 ──► INC-4 ──► INC-5
 (pur)     (kind)   (estampille) (démo)   (ADR)
```

Aucune parallélisation utile : le lot est S et la chaîne est linéaire. Point de collision git :
**`types.ts` seul** est touché par INC-1 **et** INC-2 ; ne pas ouvrir de branche concurrente dessus.
(`schemas.ts` n'apparaît que dans INC-2 depuis que les quatre symboles sont posés dès INC-1 : le
nommer ici était un reste de la version corrigée ci-dessus.)

**Point de coupe, du plus sacrifiable au moins.** Un lot « jamais reporté » sans ordre de sacrifice
écrit est le lot où l'on coupe l'estampille ou l'ADR sous la pression, c'est-à-dire les deux seules
pièces qui ne se rattrapent pas. Le critère « prêt quand » de C2 nomme deux choses, et les deux
vivent dans `round.test.ts`. Tout le reste est coupable, dans cet ordre :

1. **La troisième colonne du playground** — deux modèles au lieu de trois démontrent encore l'écart.
2. **Le refus au parse du playground** et sa seconde fonction de rapport.
3. **INC-4 en entier**, qui ne coûte alors qu'une démonstration, aucun contrat.

**Ne se coupe jamais :** INC-3 (sinon le lot ne produit aucun commit publiable et D9 n'aura servi à
rien), les **vecteurs figés** d'INC-1 (sinon la pièce qui porte tout le risque de correction n'a plus
de filet), et INC-5 (sinon les douze décisions vivent dans un document que son propre en-tête déclare
périssable).

---

### INC-1 — L'arrondi décimal, seul et prouvé · **M**

**Fichiers.** ➕ `packages/core/src/expression/evaluator/operations/round.ts` (`roundDecimal`
**uniquement** — pas `evaluateRound`) · ✏️ `packages/core/src/expression/types.ts` (`ROUND_MODES`,
`RoundMode`, `MIN_ROUND_DECIMALS`, `MAX_ROUND_DECIMALS`, **avec leurs docstrings**) · ➕
`packages/core/src/expression/evaluator/__tests__/round.test.ts`

**Pourquoi d'abord, et où la coupure passe exactement.**

> ⚠️ **Correction d'un raisonnement faux, à ne pas recopier.** Une version antérieure écrivait :
> « *aucune ligne de `round.ts` n'importe autre chose que le type `RoundMode`… lequel n'existe pas
> encore — donc INC-1 déclare `RoundMode` localement dans `round.ts` et INC-2 le déplace dans
> `types.ts`* ». **Cette contrainte n'existe pas.** Ce qui bloque en INC-1, c'est `evaluateRound`,
> parce que `requireNumber(raw, 'round', …)` exige que `'round'` soit membre d'`ExpressionErrorSite`
> (`errors.ts:80`, dérivé d'`ExpressionKind`) — et le plan sort déjà `evaluateRound` d'INC-1.
> `ROUND_MODES` et les deux bornes n'entrent dans **aucune union**, **aucun schéma**, **aucune forme
> persistée** : `types.ts` n'importe rien de `schemas.ts`, et le patron existant
> (`ARITHMETIC_OPERATORS:35`, `AGGREGATE_OPERATORS:50`, `TEXT_CASE_OPERATORS:68`) est exactement
> celui de tuples `as const` qui vivent dans `types.ts` sans être membres d'une union.
>
> **Conséquences de la correction :** INC-1 pose les quatre symboles dans `types.ts` dès maintenant,
> INC-2 n'a **rien à déplacer**, `round.ts` n'est **pas réécrit** entre les deux incréments, et le
> « commit de déplacement » disparaît — c'était du bruit de revue payé pour une contrainte
> imaginaire, et une déclaration locale d'un contrat de type public dans un fichier d'opération
> contredit AGENTS.md §2.
>
> **La variante d'INC-1 du fichier, dite explicitement, parce que « pas réécrit » ne veut pas dire
> « identique ».** INC-1 livre le bloc de la [§3.3] **privé de `evaluateRound` et de sa ligne
> d'import** : `import { requireFiniteResult, requireNumber } from '../guards.js';` n'a **aucun
> consommateur** tant qu'`evaluateRound` n'existe pas, et `noUnusedLocals`
> (`tsconfig.base.json:33`) le fait rougir dès la **porte 2**. Un implémenteur qui recopierait la
> [§3.3] telle quelle livrerait INC-1 rouge. INC-2 ajoute cette ligne d'import **en même temps**
> que la fonction : c'est un **ajout**, jamais une réécriture.

La coupure reste heureuse pour la raison qui vaut : **la pièce qui porte tout le risque de
correction atterrit seule, revue seule, sur un diff qu'aucun câblage ne dilue.** C'est exactement ce
que C1 a fait de `civil-date.ts`.

**À faire une fois, à la main — et à consigner dans l'ADR, pas à commiter.** Rejouer la
confrontation à `Intl.NumberFormat` (2 modes × 6 précisions). **Le test committé ne doit PAS appeler
`Intl`** : son résultat est indexé sur un build d'ICU, et le dépôt a déjà tranché ce type
d'arbitrage pour `textCase` en gelant des vecteurs plutôt qu'en comparant à une bibliothèque
vivante.

**Tests.** Les **33** vecteurs figés de la [§5.1] · la propriété contre une référence **BigInt**
écrite dans le fichier de test, **découpée par précision et budgétée** ([§5.2]) · idempotence,
monotonie, finitude · `roundDecimal(120, -1, m) === 120` (le piège de l'adjacence) ·
`Object.is(roundDecimal(-0.004, 2, m), 0)` — **pas `-0`** ·
`roundDecimal(1.7976931348623157e308, -308, 'halfExpand')` rend `Infinity` (la réserve du garde de
sortie, épinglée ici parce que la fonction pure ne garde rien).

**Commit.** `feat(core): arrondir un nombre sur la décimale que le document imprime`

**Condition de fin.** Les quatre portes vertes ; couverture de `round.ts` à **100 %, atteinte par les
vecteurs figés et non par le hasard des tirages** ; **aucun `it` ne dépasse 3 s** ([§5.2]). Publiable
seul, mais sans intérêt à l'être.

> ⚠️ **Correction d'une condition de fin inatteignable, à ne pas recopier.** Cette ligne exigeait
> déjà 100 %, mais les vecteurs annoncés ne pouvaient pas l'atteindre : **instrumentée sur les 31
> vecteurs d'alors, deux branches de `round.ts` restaient à zéro passage** — `if (value === 0)`
> (l'entrée nulle, que **le tirage continu n'atteint jamais**) et la disjonction `restNonZero` de
> `if (restNonZero || mode === 'halfExpand')`, seul chemin par lequel `halfEven` monte malgré un
> dernier chiffre pair. À comparer aux branches réellement couvertes : retenue totale **10
> passages**, identité **6**. L'implémenteur livrait sous le seuil sans avoir écrit *lequel* des
> deux cas manquait. **Deux vecteurs de la [§5.1] existent maintenant pour cela** — `[0, 2, 0, 0]`
> et `[2.1251, 2, 2.13, 2.13]` (au-delà du demi d'un cheveu : la disjonction l'emporte, en
> `halfEven` comme en `halfExpand`) — et l'assertion `Object.is(roundDecimal(-0, 2, m), 0)` se pose
> à côté de celle de `-0.004`. Re-mesuré avec les 33 (34 depuis la relecture externe) : **plus une seule branche à zéro**.

---

### INC-2 — Le kind `round`, câblé de bout en bout · **M**

**Fichiers.** ✏️ `types.ts` (`RoundExpression`, union `PrintableExpression`, docstring de
`PercentOfExpression`) · ✏️ `schemas.ts` (`RoundExpressionSchema`, **une ligne** dans
`printableMembers()`) · ✏️ `evaluator/operations/round.ts` (`evaluateRound`) · ✏️
`evaluator/evaluate.ts` (un `case`) · ✏️ `paths.ts` (un `case`, joint à `text`) · ✏️
`evaluator/guards.ts` (message de `requireDays`) · ✏️ `limits.ts` (liste des kinds mono-opérande) ·
✏️ `expression/expression.ts` · ✏️ `index.ts` · ✏️ `__tests__/schemas.test.ts` (`EnumeratedMembers`,
`SAMPLES`, `PRINTABLE_KINDS`, **plus les six refus au parse de la [§5.3] avec leur pendant positif,
et le `round` dans un `TextBindingSegment.value`**) · ✏️ `__tests__/paths.test.ts` · ✏️
`evaluator/__tests__/round.test.ts`

**Ce qui casse à la compilation si l'incrément est incomplet** — c'est le filet, et il est suffisant
pour les deux parcours d'exécution :

| Site | Fichier | Porte |
| :--- | :--- | :--- |
| `const exhaustive: never = expression` | `evaluator/evaluate.ts:146` | **build** (porte 2) |
| `const exhaustive: never = expression` | `paths.ts:113` | **build** (porte 2) |
| `SAMPLES`, type **mappé** sur `ExpressionKind` | `__tests__/schemas.test.ts:76-144` | type-check (porte 3) |
| `PRINTABLE_KINDS`, type **mappé** | `__tests__/schemas.test.ts:153-167` | type-check (porte 3) |
| `kindsInStep` s'effondre en `false` si `EnumeratedMembers` manque | `__tests__/schemas.test.ts:48-66`, `:403` | type-check (porte 3) |

Nuance de porte : `packages/core/tsconfig.json` **exclut** les `*.test.ts`, mais
`tsconfig.typecheck.json` les réinclut. Les deux `never` rougissent dès la porte 2 ; les trois
harnais de test seulement à la porte 3.

> ⚠️ **Trois oublis ne cassent rien, et c'est la revue qui les porte.** Le membre de
> `printableMembers()` ([§3.2]). Les deux barrels ([§3.8]) — révélés par le seul playground. Et
> l'absence d'estampille, que rien ne fait rougir : c'est INC-3 qui existe pour ça.

**À faire une fois, à la main :** retirer temporairement `RoundExpressionSchema` du corps de
`printableMembers()`, constater que `tsc` reste **vert** et que le test de parse de `SAMPLES`
**rougit**, puis annuler. Le couplage des deux gardes est alors **prouvé, pas supposé**.

**Tests.** Absence propagée → `undefined` · `'12'` en position `value` → `operand-type` à
`['value']`, site `'round'` · `NaN` → `not-finite` à `['value']` · un `round` construit **à la main**
avec `decimals: -308` sur `Number.MAX_VALUE` → `not-finite` à `[]` · les six refus au parse de la
[§5.3] **et leur pendant positif** (`-15`, `0`, `15` acceptés), **dans
`packages/core/src/expression/__tests__/schemas.test.ts`, à côté des refus de schéma que ce fichier
possède déjà** · `pathsOf(round(path))` rend le chemin, et `round` dans
`sum(lignes, l, round(l.total, 2, m))` **ne réclame pas la clé `l`** · un `round` dans un
`TextBindingSegment.value` parse, **dans le même fichier de schémas** ·
`sum(lignes, l, round(l.total, 2, m))` **ignore** la ligne dont le total est absent, exactement
comme sans l'enveloppe · **les trois `it` du critère de recette de la [§6.2], avec leur fixture et
leurs constructeurs** · **les deux `it` qui prouvent le remède du message de `requireDays`**
([§3.5]) — c'est aussi la moitié manquante du test de frontière de D10, qui nomme `compare` et
`dateAdd` autant que `sum` · le budget, **en deux assertions distinctes** :

> ⚠️ **Deux tests annoncés sans fichier, corrigé ci-dessus.** Les six refus au parse et le `round`
> dans un `TextBindingSegment.value` ne relèvent pas de `round.test.ts`, qui est un test
> d'**évaluation** ; ils relèvent de `expression/__tests__/schemas.test.ts`, qui porte déjà le
> `describe('ExpressionSchema')` et le harnais `it.each(Object.entries(SAMPLES))`. La ligne
> « Fichiers » ci-dessus ne le citait que pour `EnumeratedMembers`, `SAMPLES` et `PRINTABLE_KINDS` :
> l'implémenteur devait deviner.

> ⚠️ **`budget.spent.depth` n'est pas observable après coup, et une version antérieure de ce plan
> demandait de l'asserter.** `limits.ts:186-205` : `depth` est incrémenté par `enter()` et décrémenté
> par `leave()`, lequel est dans le `finally` de `evaluate.ts:154`. **À la sortie de
> `evaluateExpression`, `spent.depth` vaut toujours 0.** Un implémenteur qui suit la consigne écrit
> soit un test faux, soit un test tautologique.
>
> **L'assertion se scinde :** le **pas** se lit sur `spent.steps` après l'appel (mesurable
> directement) ; le **niveau** s'épingle par la **borne**, sur le patron déjà en place à
> `evaluator/__tests__/limits-scope.test.ts:88-89` — `createBudget({ maxDepth: N })`, et vérifier
> qu'un `round` intercalé fait passer la même formule d'acceptée à `depth-limit-exceeded` à `N-1`.
> Cela **prouve** le niveau au lieu de le déclarer.

**Commit.** `feat(core)!: le kind round — l'arrondi que le modèle déclare`

**Condition de fin.** Quatre portes vertes, couverture ≥ 90 % sur `packages/core/src/**`.
**Non publiable** : la forme persistée existe sans estampille.

---

### INC-3 — L'estampille · **S**

**Fichiers.** ✏️ `packages/core/src/template/template.ts` (`= 3`, section « What version 3 means ») ·
✏️ `packages/core/src/template/migrate.ts` (entrée `2 → 3`) · ✏️
`packages/core/src/template/migrate.test.ts` (délittéralisation + les six contrats)

**Pourquoi ici et pas ailleurs.** Après la dernière forme persistée du lot — le kind — et avant tout
ce qui la consomme. Une estampille par incrément ferait désigner **un commit** au lieu **d'un
contrat**.

**Tests.** Les six contrats de la [§5.4]. Les sept assertions littérales (L132, L168, L176, L181,
L182, L184, L218) passent à `CURRENT_SCHEMA_VERSION` et `CURRENT_SCHEMA_VERSION + 1`, sur le modèle
du test L230-234 qui le fait déjà correctement. **Et le titre du test L213 —
`stamps a v1 document as v2 and changes nothing else` — devient
`walks a v1 document up to the current stamp and changes nothing else`** : avec l'entrée `2 → 3` la
chaîne marche v1 → v2 → v3, l'assertion de L218 vaut désormais 3, et le document n'est plus
estampillé « v2 ». **Un nom de test qui porte un numéro de version se périme à chaque estampille, et
rien ne le fait rougir** — l'inventaire des sept assertions ne le voyait pas parce qu'il s'arrêtait
aux assertions. Hors `template/`, rien ne casse :
`guard.test.ts:189` porte un `schemaVersion: 2` littéral mais dans un payload passé à
`assertBoundedShape`, qui ne valide aucun schéma.

**Commit.** `feat(core)!: estampiller l'arrondi déclaré en schemaVersion 3`

**Condition de fin.** Quatre portes vertes. **Premier commit publiable du lot.**

---

### INC-4 — Trois modèles, un jeu de données, trois totaux · **M**

**Fichiers.** ✏️ `apps/playground/src/App.tsx`

**Contenu.** Le jeu de lignes de démonstration ([§8], arbitrage n°4) — dont les deux lignes ajoutées
ne portent que des **quantités** et des **prix unitaires** (17 × 0,125 et 3 × 0,375), jamais un
montant, de sorte que la phrase déjà écrite en `App.tsx:456` (« *Aucun montant de ligne n'est fourni
par le jeu de données* ») reste vraie du second jeu comme du premier · trois `parseTemplate`
partageant les mêmes données et le même budget : **A** (lignes puis total, `halfExpand`), **B**
(idem, `halfEven`), **A′** (total seul) · une section comparative — une ligne de facture par ligne,
trois colonnes de montants, trois totaux, l'écart mis en évidence · **un refus au parse**, avec son
véhicule · la phrase l. 481-482 réécrite · la docstring de `remise` l. 55 réécrite.

> **« Mis en évidence » ne suffit pas, et il faut dire ce que la page doit énoncer.** Trois chiffres
> qui diffèrent d'un centime sans explication enseignent qu'un moteur d'arrondi est capricieux —
> l'inverse exact de ce que ce lot démontre. Les **deux causes sont distinctes** et la page les
> nomme séparément, parce qu'un auteur de modèle qui les confond écrira le mauvais modèle :
>
> - **`63,26` contre `63,24` — c'est le MODE.** Même position d'arrondi, même ordre : seules les
>   deux lignes dyadiques `2,125` et `1,125` sont des *ties* exacts, et `halfEven` les renvoie vers
>   le chiffre pair là où `halfExpand` les éloigne de zéro.
> - **`63,25` — c'est la POSITION de la déclaration dans l'arbre.** Aucune ligne n'est arrondie ;
>   l'arrondi porte sur le total. Les deux modes rendent ici le **même** chiffre, ce qui prouve que
>   l'écart précédent ne venait pas d'eux.
>
> Le contraste est le contenu pédagogique du lot : **un même jeu de données, trois totaux, deux
> causes indépendantes.** Et la démonstration se lit d'autant mieux que le premier jeu de lignes,
> laissé intact ([§8], arbitrage n°4), montre l'arrondi **identité** sur des montants déjà exacts.

> ⚠️ **Le refus au parse n'a pas de véhicule, et une version antérieure de ce plan le demandait sans
> le dire.** `App.tsx:353-372` : `reportRefusal(title, expression: Expression)` appelle
> `evaluateExpression`, ne capture que `ExpressionEvaluationError` et **relance** tout le reste ; les
> appels sont au **module scope** (`:375-401`), donc un `ZodError` remonterait à l'import et
> **blanchirait la page au chargement**. `RefusalReport` (`:344-351`) exige `code`, `site`, `at`,
> `detail` — un `ZodError` n'en porte aucun. Et `{ kind: 'round', …, mode: 'halfUp' }` ne
> type-checke même pas comme `Expression` : l'argument ne peut pas être construit.
>
> **INC-4 écrit donc une SECONDE fonction**, p. ex.
> `reportParseRefusal(title: string, raw: unknown)`, qui appelle
> `ExpressionSchema.safeParse(raw)` (exporté par `index.ts:121` — la ligne 129 porte
> `PrintableExpressionSchema`, qui refuserait un prédicat : la confusion n'est pas anodine), narrowe par
> `result.success === false`, et rend `{ title, path: issue.path.join(' → '), message: issue.message }`
> — **avec sa propre section d'affichage**, parce que la charge n'a ni `code` ni `site`. Message
> vérifié : `mode: 'halfUp'` → `Invalid option: expected one of "halfExpand"|"halfEven"`.

**Ce qui vérifie ce fichier, et ce qui ne le vérifie pas.** `vitest.config.ts:27` déclare
`projects: ['packages/*']` : **`apps/playground` n'est ni collecté, ni instrumenté, ni couvert**, et
`sonar-project.properties:23` l'exclut de la couverture tout en l'incluant dans `sonar.sources`
comme **code de production**. Seuls mordent : `lint`, `build` (`vite build`), `type-check`
(`tsc --noEmit`) et la quality gate SonarQube (`sonar.qualitygate.wait=true`).

> 🔑 **Corollaire, à ne pas perdre : aucun chiffre affiché par le playground n'est un contrat tant
> qu'un vecteur figé de `core` ne le porte pas.** D'où l'exigence que `63.26 / 63.24 / 63.25`
> figurent aussi dans `round.test.ts` ([§6.2]).

> ⚠️ **Un point de rupture typé, pas de compilation, à connaître :** `App.tsx:365-368` écrit
> `'actualType' in details ? details.actualType : details.limit`. C2 n'ajoute **aucune** branche à
> `ExpressionErrorDetails` (D6), donc rien ne bouge — mais c'est la ligne à regarder le jour où un
> code nouveau sera ajouté.

**Commit.** `feat(playground): trois modèles, un jeu de données, trois totaux`

**Condition de fin.** Le playground affiche l'écart d'un centime, **nomme ses deux causes
séparément** — le mode pour `63,26` contre `63,24`, la position de déclaration pour `63,25` — et
présente le refus au parse dans une section distincte de celle des refus d'évaluation, parce que
l'un se produit à la sauvegarde du modèle et l'autre au rendu.

---

### INC-5 — L'ADR et les documents · **S**

**Fichiers.** ➕ `docs/adr/0004-les-arrondis-declares-par-le-modele.md` — **en-tête au gabarit des
trois ADR existantes**, qui n'est pas facultatif : **Statut 🟢 · Date · Impact · Complète : ADR 0003,
décision 4 · Plan d'implémentation : ce fichier · Implémentation :** liens vers `types.ts`,
`schemas.ts`, `evaluator/operations/round.ts`, `template.ts` · ✏️ `docs/adr/0003-…md` (**ligne
« Complétée par : ADR 0004 » dans l'en-tête**, sur le patron de la ligne « Amendé par » de l'ADR 0001
— sans elle, l'ADR 0003 ne pointe nulle part vers celle qui la complète ; plus la section « Ce qui
reste ouvert » : l'arrondi n'est plus ouvert, *tranché par l'ADR 0004* — **annoter, ne pas
réécrire**, une ADR est un journal ; plus les chiffres de la l. 826 si l'arbitrage n°4 est tranché A)
· ✏️ `docs/roadmap/core.md` (C2 livré) · ✏️ `docs/plans/c1-…md` (D4 marqué périmé) · ✏️
`docs/plans/c2-…md` (ce fichier, marqué périmé).

> ⚠️ **`.github/pull_request_template.md` ne figure plus dans cette liste**, conséquence de
> l'arbitrage n°5 tranché **C** ([§8]). Deux raisons, et la seconde est interne à ce plan : le
> classement de l'échelle décimale d'une devise n'appartient pas à C2 (D10), et un commit de portée
> `docs(adr)` qui modifie un fichier de **gouvernance du dépôt** — ni une ADR, ni de la documentation
> de lot — rend son propre sujet faux au sens de la convention du dépôt. Si le propriétaire du
> produit maintenait malgré tout un amendement du gabarit, ce serait un **second commit séparé** :
> `chore(governance): nommer l'échelle décimale résolue par Intl dans la checklist de périmètre`,
> exactement comme le plan C1 sépare le commit qui touche deux fichiers protégés.

**Contenu obligatoire de l'ADR 0004**, faute de quoi il sera improvisé sous pression — c'est la liste
des décisions de la [§2] que l'ADR doit reprendre, plus ce que ce plan a mesuré :

1. **D1** — le kind enveloppe constaté, et les deux alternatives écartées avec leurs signaux.
2. **D2** — la sémantique décimale imprimée, ses quatre mesures, et sa réserve
   (`round(1.005, 2, 'halfExpand') = 1.01`, et pourquoi c'est le bon résultat).
3. **D3** — le refus des modes dirigés **sur le motif anti-sur-ingénierie**, la mesure de fragilité
   consignée **ici et nulle part ailleurs** — surtout pas dans une docstring, qui est publiée —, le
   contournement `round(add(x, 0.005), 2, m)` consigné **comme contournement daté**, et le signal de
   réouverture.
4. **D4** — la fenêtre `[-15, 15]` : la **preuve** de la borne haute, l'**aveu** que les deux bornes
   sont documentaires, et le classement en **rétrécissement** adossé à l'hypothèse pré-v1.0.
5. **D5** — l'algorithme, son protocole de vérification (rejouable), et le coût en temps mural pour
   E8, **en fourchette et avec sa machine**.
6. **D6** — zéro code nouveau, la réserve du message d'infini et sa correction par `z.number({ error })`.
7. **D7** — l'enveloppe **prouvée** (`N · ulp(T)/2 < 0,005`) et **mesurée** (0/2 000 jusqu'à `10¹²`,
   premier échec à `2·10¹²`), **avec la loi de tirage et la graine sans lesquelles les comptes ne se
   reproduisent pas**.
8. **D8** — l'absence de déclaration au niveau du document, et son coût de sortie.
9. **D9** — l'estampille, la migration d'identité, et sa réserve (« la migration estampille ; elle ne
   valide pas »).
10. **D10** — le piège `Intl` de C6, ses cinq mesures, **et la contradiction nommée avec
    `biome.jsonc:273`**, laissée ouverte parce que son amendement demande un mandat. **Plus, dans
    « Ce qui reste ouvert », la question adressée à C6 telle quelle :** *qui déclare l'échelle
    d'affichage d'un montant — le modèle, l'intégrateur, ou une table de devises ?* C2 ne la
    tranche pas et ne classe pas la table.

    **La question s'accompagne des trois options, sans recommandation.** Une question ouverte
    sans options se relit comme une inquiétude ; avec elles, C6 hérite d'un point de départ. Ce
    qu'aucune des trois ne doit faire — et c'est le seul énoncé que C2 se permet ici, parce qu'il
    découle de D2 et non d'un arbitrage de C6 — est de **ré-arrondir en silence un montant que le
    modèle a déjà arrondi** : `round(x, 2, m)` puis un affichage à trois décimales rendrait visible
    un chiffre que l'auteur a déclaré ne pas vouloir.

    | Option | Qui déclare | Ce qu'elle coûte |
    | :--- | :--- | :--- |
    | **1 — le modèle** | une échelle d'affichage écrite dans le nœud de format de C6, à côté de la locale | cohérent avec C2, où l'échelle de calcul est déjà **lisible dans l'arbre** ; mais elle se déclare deux fois, et rien n'oblige les deux à s'accorder |
    | **2 — l'intégrateur** | un catalogue devise → échelle injecté par l'application hôte | aucune table dans Openview, cohérent avec la décision 9 de la roadmap ; mais c'est une charge d'amorçage de plus, et un catalogue absent doit **refuser**, pas deviner |
    | **3 — ICU** | `Intl.NumberFormat(locale, { style: 'currency', currency })` | le moyen que `biome.jsonc:273` autorise déjà et le seul qui tienne le critère de fin de C6 sans duplication ; mais il **résout `maximumFractionDigits` tout seul**, donc applique une échelle qu'aucun modèle n'a déclarée — les cinq mesures de D10 en pièce jointe |
11. **D11** — la **dérogation écrite** à AGENTS.md §3.B pour l'algèbre d'expressions, son contrôle
    compensatoire et son seuil de réouverture.
12. **D12** — le hors-périmètre, dont la répartition du résidu et sa raison.

**Commit.** `docs(adr): consigner les douze décisions du lot C2`

**Clôture :** l'ADR 0004 passe en 🟢 avec ses liens d'implémentation.

---

### Ce qui ne se touche pas

| Fichier | Consigne |
| :--- | :--- |
| `packages/core/src/template/guard.ts` | **Ne pas modifier.** Agnostique aux kinds ; `assertBoundedShape` et `childValuesOf` marchent sur du JSON brut. |
| `packages/core/src/ast/visitor.ts` | **Ne pas modifier.** Le Visitor porte sur `DocumentNode.type` et `TextSegment.kind`. La dérogation qui autorise cette abstention est écrite en **D11** — sans elle, l'abstention n'est pas motivée. |
| `packages/core/src/errors.ts` | **Ne pas modifier.** `ExpressionErrorSite` s'élargit par dérivation (D6). |
| `packages/core/src/expression/evaluator/operations/aggregate.ts` | **Ne pas modifier** (D7). |
| `packages/core/src/expression/evaluator/__tests__/arithmetic.test.ts:74` et `:173` | **Ne pas affaiblir.** Ce sont les deux tests qui interdisent l'arrondi implicite. |
| `DEFAULT_SHAPE_LIMITS`, `DEFAULT_EVALUATION_LIMITS` | **Ne pas modifier** — la marge mesurée est de 50 niveaux. |
| `tsconfig*.json`, `biome.jsonc`, `tools/biome/*.grit`, `turbo.json`, `.github/workflows/*`, `sonar-project.properties` | **AGENTS.md §7.** En particulier : **ne pas amender le message de `biome.jsonc:273`** malgré D10 — cela demande un mandat explicite, hors périmètre de C2. |
| `package.json` | **Aucune dépendance nouvelle.** L'implémentation est en JavaScript pur. |
| `.github/pull_request_template.md` | **Ne pas modifier.** Non protégé par AGENTS.md §7 — le plan a raison sur ce point — mais l'arbitrage n°5 est tranché **C** : le risque aval est porté par l'ADR 0004, et un garde-fou opposable à **toutes** les PR du dépôt passerait par un amendement d'AGENTS.md, qui « fait foi » (§1.2). |

---

## 5. Le plan de test

### 5.1 Vecteurs figés — 34 lignes, toutes mesurées

```ts
it.each([
  //  valeur                    d    halfExpand               halfEven
  [0.615,                       2,   0.62,                    0.62],
  [1.005,                       2,   1.01,                    1],
  [2.675,                       2,   2.68,                    2.68],
  [8.575,                       2,   8.58,                    8.58],
  [0.145,                       2,   0.15,                    0.14],
  [1.255,                       2,   1.26,                    1.26],
  [2.125,                       2,   2.13,                    2.12],   // un tie EXACT
  [-2.125,                      2,   -2.13,                   -2.12],  // symétrique sur le signe
  [0.125,                       2,   0.13,                    0.12],
  [0.5,                         0,   1,                       0],
  [1.5,                         0,   2,                       2],
  [2.5,                         0,   3,                       2],
  [-2.5,                        0,   -3,                      -2],     // Math.round rendrait -2
  [-0.5,                        0,   -1,                      0],
  [50,                         -2,   100,                     0],
  [150,                        -2,   200,                     200],
  [1250,                       -2,   1300,                    1200],
  [-1250,                      -2,   -1300,                   -1200],
  [1234.5,                     -2,   1200,                    1200],
  [120,                        -1,   120,                     120],    // le piège de l'adjacence
  [0.30000000000000004,         2,   0.3,                     0.3],
  [63.260000000000005,          2,   63.26,                   63.26],
  [0.3333333333333333,          2,   0.33,                    0.33],
  [5e-324,                      2,   0,                       0],
  [9007199254740991,            2,   9007199254740991,        9007199254740991],
  [1.7976931348623157e308,    -15,   1.7976931348623157e308,  1.7976931348623157e308],
  // La retenue TOTALE : la seule branche qui fait grandir la chaîne de chiffres d'une
  // position ("99" -> "100"). Aucun des vingt-six vecteurs ci-dessus ne l'atteint.
  [0.999,                       2,   1,                       1],
  [9.99,                        1,   10,                      10],
  [-9.995,                      2,   -10,                     -10],    // signe reconstruit APRÈS la retenue
  [9.5,                         0,   10,                      10],
  [999.5,                       0,   1000,                    1000],
  // Les deux branches qu'aucun vecteur ci-dessus n'exerçait, mesuré à l'instrumentation.
  [0,                           2,   0,                       0],      // l'entrée nulle : le tirage continu ne l'atteint jamais
  [2.1251,                      2,   2.13,                    2.13],   // au-delà du demi d'un cheveu : `restNonZero` l'emporte, halfEven compris
  [-5e-324,                     2,   0,                       0],      // subnormal négatif : `toBe` étant `Object.is`, ce vecteur SEUL épingle le zéro non signé
])('pins the frozen rounding vector round(%o, %o)', (v, d, expand, even) => {
  expect(roundDecimal(v, d, 'halfExpand')).toBe(expand);
  expect(roundDecimal(v, d, 'halfEven')).toBe(even);
});
```

> ⚠️ **Deux corrections de comptage, à ne pas recopier.** Une version antérieure annonçait
> « 23 vecteurs » pour une table qui en comptait 26, et « **neuf** des vingt-six » divergences de
> mode. Les deux sont faux et le second sert précisément l'argument que le champ `mode` n'est pas
> décoratif — le sous-estimer affaiblit gratuitement la démonstration. **Mesuré : douze
> divergences** (`1.005`, `0.145`, `2.125`, `-2.125`, `0.125`, `0.5`, `2.5`, `-2.5`, `-0.5`, `50`,
> `1250`, `-1250`). Avec les cinq vecteurs de retenue totale **et les deux vecteurs de couverture
> ci-dessous**, la table compte **34 lignes, dont douze divergent sur le mode** — les sept ajouts
> n'ajoutent aucune divergence, et c'est vérifié.
>
> Et **trois** corrections de couverture, toutes découvertes à l'instrumentation, toutes rejouées.
> (1) **Aucun des vingt-six vecteurs initiaux n'exerçait la branche `cursor === 0` d'`increment`** —
> la plus fragile de l'algorithme, celle qui fait grandir la chaîne d'une position. Les cinq
> vecteurs de retenue totale la portent maintenant à **dix passages**. (2) Aucun des **trente-et-un**
> n'exerçait `if (value === 0)` : une entrée exactement nulle **ne sort pas d'un tirage continu**,
> jamais, et la ligne `[0, 2, 0, 0]` est le seul moyen de la couvrir. (3) Aucun n'exerçait la
> disjonction `restNonZero` de `goesUp` — le seul chemin par lequel `halfEven` monte malgré un
> dernier chiffre pair —, d'où `[2.1251, 2, 2.13, 2.13]`. Les trois étaient laissées sous la seule
> garde des tirages aléatoires, ce que la doctrine du dépôt contredit : le dépôt **gèle des
> vecteurs** plutôt que d'appeler une bibliothèque vivante ou de s'en remettre au hasard
> (`text.test.ts:152-166`). **Les 34 vecteurs ne laissent plus une seule branche à zéro passage** —
> et c'est ce qui rend la condition de fin d'INC-1 (« couverture à 100 % ») atteignable, ce qu'elle
> n'était pas.

Assertion structurelle qui double la valeur des vecteurs, sur le patron des vecteurs Unicode de
`textCase` (`text.test.ts:152-166`) :

```ts
// Sous une sémantique BINAIRE, cette assertion serait FAUSSE : `0.145` n'y est pas un tie
// exact, donc les deux modes rendraient le même chiffre. C'est ce qui rend `mode` réel.
expect(roundDecimal(0.145, 2, 'halfExpand')).not.toBe(roundDecimal(0.145, 2, 'halfEven'));
```

**Et la précondition de finitude, dans son propre `it`** — elle n'entre pas dans le tableau des
vecteurs, parce que le tableau dit *comment un montant s'arrondit* et que ceci dit *ce qui n'est pas
un montant* :

```ts
it.each([Number.NaN, Infinity, -Infinity])('leaves the non-finite %o unchanged', (value) => {
  for (const decimals of [-2, 0, 2]) {
    // Sans la garde de la §3.3, `NaN` sortait d'ici en `100`, `1` et `0.01` respectivement.
    expect(roundDecimal(value, decimals, 'halfExpand')).toBe(value);
    expect(roundDecimal(value, decimals, 'halfEven')).toBe(value);
  }
});
```

> `toBe` s'appuie sur `Object.is`, donc `expect(roundDecimal(NaN, 2, m)).toBe(NaN)` **passe**
> là où `toEqual` sur un `NaN` serait ambigu — et c'est la même propriété qui fait que le vecteur
> `[-5e-324, 2, 0, 0]` épingle à lui seul le zéro **non signé** : `expect(-0).toBe(0)` échoue.
> Aucune assertion `Object.is` explicite n'est donc à écrire en plus ; l'ajouter laisserait croire
> que `toBe` ne suffit pas.

### 5.2 Propriétés — avec leur budget de temps, qui est une condition de passage

> 🚫 **Correction d'un défaut bloquant, à ne pas recopier.** Une version antérieure demandait une
> matrice de « 200 000 tirages × 10 précisions × 2 modes, impl **et** référence BigInt » dans un
> seul `it`. **Cette suite ne peut pas passer la porte 4** : mesuré, `roundDecimal` coûte ~1,5 µs et
> une référence BigInt ~3,2 µs par appel, soit une projection de **~19 s** pour la matrice annoncée.
> Le délai par défaut de Vitest est de **5 000 ms**, et le dépôt ne le surcharge nulle part —
> vérifié : aucune clé `testTimeout` dans `vitest.config.ts`, aucune occurrence de `timeout` dans
> les tests de `packages/core`. **L'incrément aurait été livré rouge.**

**Forme prescrite :** un `it.each` **par précision**, **20 000 tirages** par précision, sur les onze
positions `{-15, -9, -5, -2, 0, 1, 2, 3, 5, 9, 15}` et les deux modes. La référence BigInt (~25
lignes, exacte, spécifiée, **sans ICU**) est écrite dans le fichier de test.

**Budget mesuré**, et non projeté — la forme exacte ci-dessus, rejouée hors dépôt sur Node 24.11.1,
implémentation **et** référence BigInt : **200 à 360 ms par `it`, 2,84 s au total**, pour 440 000 cas
et **0 divergence**. Une version antérieure annonçait « ~190 ms par `it`, ~2,1 s au total » : c'est
optimiste de **35 %**, dans la section même qui existe parce qu'une projection de temps avait raté.
La marge reste de **quatorze fois** sous le délai par défaut de 5 000 ms, et de sept fois sur une
machine de CI deux fois plus lente — c'est l'ordre de grandeur des tests de charge existants
(60 000 éléments à `aggregate.test.ts:206`).

| Propriété | Attendu | Mesuré hors CI (bac à sable, Node 24.11.1) |
| :--- | :--- | :--- |
| exactitude contre la référence BigInt | 0 divergence | **0 / 4 400 022** |
| idempotence `R(R(x)) === R(x)` | 0 violation | **0 / 480 000** |
| monotonie sur des valeurs triées | 0 violation | **0 / 480 000** |
| finitude sur entrée finie, `decimals` dans la fenêtre | 0 résultat non fini | **0 / 480 000** |
| jamais `-0` | `Object.is(…, 0)` | **0 / 480 000** |

Les 4,4 M de cas sont consignés dans l'ADR 0004 comme **sonde de développement rejouable**, pas
comme test committé — même arbitrage que pour l'oracle `Intl` ([§5.5]).

**Ces onze `it` vivent sous un `describe` à eux**, et c'est une consigne d'ergonomie, pas de style :

```ts
describe('roundDecimal — property matrix against the BigInt reference', () => { /* les onze it */ });
```

2,84 s est acceptable pour les quatre portes et intenable dans une boucle d'édition. Le `describe`
rend le partage praticable : `pnpm vitest round -t "frozen"` rejoue les 34 vecteurs en quelques
millisecondes pendant un refactor de `keptDigits`, et la matrice complète ne repasse qu'au moment de
committer. Sans ce découpage, la seule granularité disponible est le fichier entier, et un
développeur qui paie 2,84 s à chaque sauvegarde finit par désactiver la suite — ce qui est la façon
ordinaire dont un oracle exact meurt.

### 5.3 Refus au parse — les six chaînes, mesurées, pour que le test soit copiable

Mesuré sur `zod@3.25.76` importé via `zod/v4`, avec le schéma exact de la [§3.2] :

| Entrée | Message |
| :--- | :--- |
| `decimals: 2.5` | `A rounding position is a whole number of decimal places` |
| `decimals: 16` | `A rounding position may not exceed 15` |
| `decimals: -16` | `A rounding position may not go below -15` |
| `decimals: NaN` | `A rounding position is a finite whole number of decimal places` |
| `decimals: Infinity` | `A rounding position is a finite whole number of decimal places` |
| `mode: 'halfUp'` | `Invalid option: expected one of "halfExpand"\|"halfEven"` |

**Et le pendant positif :** `decimals: -15`, `0`, `15` **acceptés** — c'est cette seconde moitié qui
prouve qu'on n'a pas fermé la fenêtre d'un cran de trop. Ajouter `mode: 'bankers'` et `mode: 'ceil'`
à la liste des refus : ils tombent sous D3 et sous la décision 10 de l'ADR 0003.

### 5.4 Migration — les six contrats

1. **L'estampille et rien d'autre**, épinglée *par exclusion* : déstructurer `schemaVersion` des deux
   côtés puis `toStrictEqual` sur le reste (patron `migrate.test.ts:213-224`). Sans cette forme, une
   migration qui reformerait un document en douce passerait inaperçue.
2. **La chaîne complète v1 → v3 en deux pas**, sur le document antérieur à C1 de
   `migrate.test.ts:97-134` : la seule assertion qui prouve que `1 → 2` n'a pas été fusionnée en
   `1 → 3`.
3. **Le message que l'estampille achète** : `schemaVersion: CURRENT_SCHEMA_VERSION + 1` →
   `TemplateMigrationError` contenant `schema version 4`, `at most 3`, `upgrade before opening it`,
   et `fromVersion === 4`.
4. **Un document v3 portant un `round`** imbriqué dans une position réelle (`aggregate.value` sous un
   `TextBindingSegment.value`) parse, et `schemaVersion === 3`.
5. **La réserve, en test négatif** : un document estampillé `2` mais portant un `round` échoue sur un
   `ZodError`, **pas** sur un `TemplateMigrationError`. *La migration estampille ; elle ne valide
   pas.*
6. **La forme reste bornée après migration** — `migrate.test.ts:56-79` couvre déjà le mécanisme
   générique ; rien de neuf, l'identité ne change ni profondeur ni compte de valeurs. **Aucun
   rétrécissement à retrofitter** : aucun document v2 ne peut porter un champ `decimals`.

### 5.5 Ce qui reste hors des tests, et pourquoi

La confrontation à `Intl.NumberFormat` (720 012 cas mesurés, 0 divergence) est une **sonde de
développement consignée dans l'ADR**, jamais un test committé : son résultat est indexé sur un build
d'ICU, et le dépôt a déjà tranché ce type d'arbitrage en gelant des vecteurs pour `textCase`. La
rejouer fait partie du protocole à chaque montée de Node, au même titre que la sonde
`noJsRestrictedProperties` de l'ADR 0003.

---

## 6. Le critère de recette, et comment on le démontre

### 6.1 L'énoncé, et sa lecture

> « **Prêt quand** deux modèles arrondissant différemment produisent deux résultats différents et
> prévisibles sur le même jeu de données, **et qu'aucun total ne diffère de la somme des montants
> affichés au-dessus de lui**. » — `docs/roadmap/core.md`, lot C2

Deux moitiés, et la seconde est la difficile. **Elle porte sur des VALEURS, jamais sur des glyphes** :
un formateur monétaire imprimerait « 63,26 € » pour `63.26` comme pour `63.260000000000005`, tandis
qu'un `compare` contre `63.26` échouerait sur le second. C'est pourquoi seul un kind qui rend un
`number` peut la satisfaire — une chaîne ne se somme pas (`concat` refuse un nombre, `arithmetic`
refuse une chaîne) — et c'est la démonstration structurelle que l'arrondi n'est pas du formatage.

### 6.2 Les trois `it` qui la démontrent, et où ils vivent

> ⚠️ **Correction d'un défaut d'exécution, à ne pas recopier.** Une version antérieure de ce plan
> écrivait ces trois tests **sans les rattacher à aucun incrément**, avec trois helpers
> (`totalOf`, `perLine`, `totalOnly`) définis nulle part. Ils ne pouvaient pas non plus vivre dans le
> fichier d'INC-1 : ils construisent un `aggregate` et exigent `evaluateExpression`, donc
> `evaluateRound`, qui n'existe qu'à INC-2. **Ils appartiennent à INC-2**, dans
> `packages/core/src/expression/evaluator/__tests__/round.test.ts`, et leur fixture est écrite
> ci-dessous.
>
> **La correction n'était qu'à moitié faite, et l'autre moitié est ici.** La fixture de *données*
> était écrite ; les **constructeurs** que les `it` appellent ne l'étaient toujours pas — `totalOf`,
> `perLine`, `totalOnly` restaient définis nulle part, et le troisième `it` invoquait `compute` et
> `literal`, deux helpers **locaux à `arithmetic.test.ts`** (`:53` et `:30`), non exportés, donc
> invisibles ici. Le bloc ne se recopiait pas. Il se recopie maintenant : les constructeurs sont
> écrits, sur le patron des constructeurs locaux minuscules d'`aggregate.test.ts:17-26`, et une
> information qu'aucune ligne du plan ne donnait est écrite avec eux — **`AggregateExpression`
> porte un champ `as`, pas `alias`** (`types.ts:191-198`).

**Fixture, sur le patron des constructeurs locaux minuscules d'`aggregate.test.ts:17-26`** — cinq
lignes dont deux dyadiques exactes, pour que le demi soit **le** demi et non un artefact de
représentation (`0.125 = 2⁻³`, `0.375 = 3·2⁻³`, et leurs produits par 17 et 3 le sont aussi) :

| ligne | quantité | prix unitaire | montant exact |
| :--- | ---: | ---: | ---: |
| A | 2 | 10 | 20 |
| B | 1 | 30 | 30 |
| C | 4 | 2.5 | 10 |
| D | **17** | **0.125** | **2.125** |
| E | **3** | **0.375** | **1.125** |
| | | **somme exacte** | **63.25** |

```ts
const path = (p: string): PathExpression => ({ kind: 'path', path: p });
const round = (
  value: PrintableExpression,
  decimals: number,
  mode: RoundMode,
): RoundExpression => ({ kind: 'round', value, decimals, mode });

const rows = {
  facture: {
    lignes: [
      { q: 2, p: 10 },
      { q: 1, p: 30 },
      { q: 4, p: 2.5 },
      { q: 17, p: 0.125 },
      { q: 3, p: 0.375 },
    ],
  },
};

const lineAmount: ArithmeticExpression = {
  kind: 'arithmetic',
  op: 'mul',
  left: path('l.q'),
  right: path('l.p'),
};

// Le champ est `as`, pas `alias` -- `types.ts:191-198`.
const sumOf = (value: PrintableExpression): AggregateExpression => ({
  kind: 'aggregate',
  op: 'sum',
  source: path('facture.lignes'),
  as: 'l',
  value,
});

// A / B : chaque ligne arrondie, puis le total. Le MODE change le résultat.
const perLine = (mode: RoundMode): RoundExpression =>
  round(sumOf(round(lineAmount, 2, mode)), 2, mode);

// A' : lignes exactes, total seul arrondi. La POSITION change le résultat.
const totalOnly = (mode: RoundMode): RoundExpression => round(sumOf(lineAmount), 2, mode);

const totalOf = (expression: Expression): unknown => evaluateExpression(expression, rows);
```

```ts
it('makes the accumulation ORDER visible, and the model repairs it with the outer rounding', () => {
  // Les mêmes cinq montants à deux décimales, sommés dans deux ordres, sont deux doubles.
  expect(20 + 30 + 10 + 2.13 + 1.13).toBe(63.260000000000005);
  expect(2.13 + 1.13 + 20 + 30 + 10).toBe(63.26);
  // L'enveloppe extérieure les réconcilie -- c'est ce que le modèle DÉCLARE, pas ce que le
  // moteur décide. Le critère porte sur des VALEURS, jamais sur des glyphes.
  expect(roundDecimal(20 + 30 + 10 + 2.13 + 1.13, 2, 'halfExpand')).toBe(63.26);
  expect(roundDecimal(2.13 + 1.13 + 20 + 30 + 10, 2, 'halfExpand')).toBe(63.26);
});

it('gives three different and PREDICTABLE totals for three legitimate templates', () => {
  expect(totalOf(perLine('halfExpand'))).toBe(63.26); // lignes arrondies, puis le total
  expect(totalOf(perLine('halfEven'))).toBe(63.24);   // le MODE change le résultat
  expect(totalOf(totalOnly('halfExpand'))).toBe(63.25); // la POSITION change le résultat
});

it('leaves the C1 guarantee intact -- the algebra still rounds nothing on its own', () => {
  // Le contrat « la division ne s'arrondit pas » est DÉJÀ épinglé par `arithmetic.test.ts:74`
  // et `:173`, que ce lot ne touche pas. Ce qui se vérifie ICI, c'est l'autre moitié : un
  // arrondi n'apparaît QUE là où le modèle l'écrit, et il est l'identité sur une valeur déjà
  // à l'échelle.
  expect(roundDecimal(0.3333333333333333, 2, 'halfExpand')).toBe(0.33);
  expect(roundDecimal(63.25, 2, 'halfExpand')).toBe(63.25);
});
```

> ⚠️ **Le troisième `it` ne recopie plus `does NOT round a division`.** Une version antérieure le
> dupliquait mot pour mot — `expect(compute('div', literal(1), literal(3)))` — c'est-à-dire
> `arithmetic.test.ts:79`, un test que la table « Ce qui ne se touche pas » et la définition de fini
> exigent **inchangé, `git diff` vide**. Le dupliquer aurait créé **deux sources de vérité pour le
> test dont toute la valeur est d'être unique et intact**, et il n'aurait de toute façon pas compilé
> ici : `compute` et `literal` sont locaux à l'autre fichier. Le contrat vérifié à cette place est
> celui que C2 ajoute, pas celui que C1 protège.

Les trois totaux et les deux accumulations intermédiaires (`63.260000000000005`,
`63.239999999999995`) sont **mesurés**, pas calculés à la main.

### 6.3 La démonstration visible — le playground

INC-4 affiche les trois modèles côte à côte, une ligne de facture par ligne, trois colonnes de
montants, trois totaux, et **l'écart d'un centime nommé**. C'est la seule mise en scène qui démontre
*pourquoi* le kind est une **enveloppe composable** et non un champ `precision?` : la position de
`round` dans l'arbre change le résultat, et le modèle la déclare. `JSON.stringify(sampleTemplate)`
(`App.tsx:540-541`) rend l'argument « visible dans l'arbre » de la décision 4 de l'ADR 0003
**observable**.

### 6.4 Définition de fini — critères vérifiables mécaniquement

- `git grep -l "case 'round':" -- packages/core/src | wc -l` rend **2** (`evaluate.ts`, `paths.ts`) ;
  toute autre valeur signale soit un parcours oublié, soit un troisième parcours qui rouvre **D11**.
  *(La forme `git grep -c` était fausse : elle imprime une ligne `fichier:compte` par fichier
  apparié, jamais l'entier — un critère « vérifiable mécaniquement » dont on ne peut pas comparer la
  sortie à la valeur annoncée n'en est pas un.)*
- `git grep -n "10 \*\* \|Math.pow\|toFixed\|toLocale" -- packages/core/src/expression/evaluator/operations/round.ts`
  ne rend **rien**.
- `git grep -n "declaredScaleOf\|Template.rounding\|precision?" -- packages/core/src` ne rend
  **rien** (D8, D10).
- `CURRENT_SCHEMA_VERSION === 3` et `TEMPLATE_MIGRATIONS.length === 2`, la première entrée étant
  toujours `{ from: 1, to: 2 }`.
- Les six symboles de la [§3.8] sont importables depuis `@openview/core` — **vérifié par le
  playground**, aucune porte ne le voit.
- `arithmetic.test.ts:74` et `:173` sont **inchangés dans leurs assertions**. `git diff` ne montre
  qu'une chose sur ces deux tests : le commentaire de `:78` — « *How an amount rounds is declared by
  the template **in lot C2*** » — passe au présent, « *through the `round` wrapper kind* ». C'est le
  seul « in lot C2 » des fichiers de test du dépôt, et le recensement des docstrings à réécrire ne
  le voyait pas parce qu'il excluait les tests. **Un commentaire n'est pas une assertion**, et
  laisser un renvoi au futur dans le test le plus important du dépôt serait le laisser mentir.
- Les quatre portes vertes, couverture ≥ 90 % sur `packages/core/src/**`, **et aucun `it` de
  `round.test.ts` au-delà de 3 s** — et **la machine en dit une partie**, contrairement à ce
  qu'écrivait une version antérieure : le seuil `slowTestThreshold` de Vitest vaut **300 ms** par
  défaut (`vitest/dist/chunks/defaults…js:78`, aucune surcharge dans `vitest.config.ts`), et
  `getDurationPrefix` **imprime la durée en jaune** de tout `it` au-dessus. Les `it` de propriété se
  situent juste à ce seuil (200–360 ms, [§5.2]) : leur durée sera visible en CI, il suffit de la
  lire.
- La docstring de `PercentOfExpression` ne contient plus « in lot C2 », et `guards.ts` ne contient
  plus « the algebra has no rounding of its own ».
- L'ADR 0004 existe, est en 🟢, et couvre les douze points de la liste d'INC-5.

---

## 7. Ce que ce lot n'est pas

Le hors-périmètre est écrit en **D12** ([§2]) et n'est pas répété ici. Trois refus méritent
cependant d'être redits parce qu'ils seront demandés :

**Ce n'est pas un lot de formatage.** Le kind rend un `number`, jamais une chaîne. Séparateurs,
symbole monétaire, locale, zéro de remplissage, échelle par devise : **C6**. La ligne de partage est
le test de D10.

**Ce n'est pas un lot de conformité.** Aucun arrondi « légal », aucune table devise → décimales,
aucune valeur par défaut. `docs/roadmap/README.md` décision 6 (« quels arrondis dans les modèles
livrés ? ») **bloque D9, pas C2** : elle *présuppose* que la capacité existe. Elle deviendrait
**irrecevable** si C2 introduisait un défaut, en tranchant au niveau du contrat ce qu'elle veut
trancher au niveau des modèles livrés.

**Ce n'est pas un lot de répartition.** Le résidu d'un total arrondi sur N lignes est calculable
(`sub(round(total, 2, m), sum(lignes, l, round(l.montant, 2, m)))`) ; *quelle* ligne l'absorbe est
une **règle**, et Openview n'en écrit aucune.

---

## 8. Les cinq arbitrages, tranchés

**Décidés par le propriétaire du produit le 2026-08-14**, conformément aux cinq recommandations
de ce plan. Ils ne sont plus ouverts : ce qui suit est le **relevé**, pour que l'ADR 0004 le
reprenne et que personne ne les rejoue. La colonne « Options » porte ☑ sur l'option retenue ; la
colonne de droite conserve le motif tel qu'il a été écrit **avant** la décision, parce que c'est
lui qui devra être relu le jour où l'un d'eux sera rouvert.

**Deux d'entre eux nomment leur signal de réouverture**, et c'est délibéré : le n°1 (le jour où
un usage réel de mode dirigé est nommé) et le n°2 (le jour où l'hypothèse pré-v1.0 tombe). Les
reconnaître le moment venu fait partie de la décision.

| # | Question | Options | Conséquence | Motif de la décision |
| :-- | :--- | :--- | :--- | :--- |
| **1** | Tenir à deux modes, ou livrer aussi les modes dirigés (`ceil`, `floor`, `expand`, `trunc`) ? | ☑ **A — deux modes** *(retenu)* | Un besoin réel (« toute unité commencée est due », prorata au centime supérieur) n'est **pas exprimable dans le modèle** ; l'auteur pré-arrondit dans ses données. Le contournement `round(add(x, 0.005), 2, m)` reste un bricolage aussi sensible au résidu que le mode refusé : **il se consigne dans l'ADR 0004 comme contournement daté, avec sa mesure**, et non dans une documentation d'usage — un refus dont on cache le contournement devient du folklore, et la formulation rendue à l'auteur du modèle appartient de toute façon à C8 (ADR 0003, décision 7). | ☑ **A.** Motif : **aucun usage nommé aujourd'hui**, règle anti-sur-ingénierie, et un ajout ultérieur au coût d'une seule migration d'estampille qui n'invalide aucun modèle stocké. La mesure de fragilité (~10,6 % de centimes trop hauts sur un `ceil`) est **consignée dans l'ADR comme information**, pas comme critère — un refus motivé par la fragilité créerait un précédent que le dépôt n'a jamais écrit. Signal de réouverture à inscrire dans l'ADR 0004. |
| | | ☐ **B — six modes** | Couvre le besoin ; deux branches de plus dans `keptDigits`, aucun coût structurel. | |
| **2** | La fenêtre de `decimals` : `[-15, 15]`, `[0, 15]`, ou `[-9, 9]` ? | ☑ **A — `[-15, 15]`** (31 positions) *(retenu)* | Borne haute **prouvée** (`16` est la première position identité pour tout `\|v\| ≥ 1`) ; borne basse **documentaire assumée**, ancrée sur `1e15`. Liste de 31 entrées pour D7. | ☑ **A.** C'est la seule des trois dont la borne haute repose sur une inégalité plutôt que sur un usage supposé, et la seule qui écrive honnêtement que les deux bornes refusent des positions atteignables. **Rétrécissement non rattrapable** : si un template client existe quelque part, c'est cette borne qui se rediscute, pas le lot. |
| | | ☐ **B — `[0, 15]`** | Supprime « en milliers », pour zéro ligne économisée. | |
| | | ☐ **C — `[-9, 9]`** (19 positions) | Liste plus courte pour D7 ; refuse un prix unitaire à 10+ décimales. Aucune justification mesurée de la valeur 9. | |
| **3** | Le vocabulaire des modes : `halfExpand`/`halfEven` (ECMA-402) ou `halfUp`/`halfEven` (Java, .NET) ? | ☑ **A — ECMA-402** *(retenu)* | Non ambigu sur le signe ; cohérent si le n°1 est un jour rouvert ; vérification par oracle `Intl` auto-documentée. Obscur pour un non-développeur — mais D7 affiche un **libellé**, pas la valeur brute. | ☑ **A.** Un champ qui décide un centime sur un avoir ne se nomme pas d'un mot qui veut dire deux choses. Le coût d'obscurité est un libellé d'IHM ; le coût d'ambiguïté est un ticket qu'on ne sait pas clore. |
| | | ☐ **B — Java** | Familier ; mais `halfUp` = `HALF_UP` (à l'opposé de zéro) chez Java et `halfCeil` (vers +∞) chez ECMA-402, et le jour où `ceil` arrive, le couple `halfUp` + `ceil` devient illisible. | |
| **4** | Le jeu de données du playground contient des montants exacts au centime que l'ADR 0003 **cite nommément**. Comment démontrer C2 sans rien fausser ? | ☐ **A — étendre `commande.lignes`** avec les deux lignes dyadiques *(écarté)* | Le critère est démontré, mais **quatre chiffres** de l'ADR 0003 l. 826 deviennent faux, pas un seul : total `60 → 63,25`, remise `6 → 6,325`, reste `54 → 56,925`, prix moyen `20 → 12,65` — plus le paragraphe `App.tsx:475-483`. Tous mesurés. | ☑ **C.** Le dilemme A/B était **faux** : une version antérieure de ce plan n'examinait que « étendre » et « laisser », et sous-évaluait la portée de A à « une phrase ». La troisième voie démontre tout et ne périme rien. Elle a de plus une vertu propre : **deux jeux côte à côte montrent que l'arrondi est l'identité sur des montants déjà exacts** — ce que l'auteur d'un modèle doit comprendre en premier. Et une propriété survit dans les trois options, qu'il faut dire parce que le produit l'affirme par écrit : les valeurs ajoutées sont des **quantités** et des **prix unitaires**, jamais des montants, donc « *Aucun montant de ligne n'est fourni par le jeu de données* » (`App.tsx:456`) reste vrai. |
| | | ☐ **B — laisser** | L'ADR reste exacte ; `round(x, 2, m)` est l'**identité** pour les deux modes sur toutes les valeurs actuelles : le playground afficherait le critère « satisfait » **en ne prouvant rien**. | |
| | | ☑ **C — un SECOND jeu de lignes**, dédié à la démonstration d'arrondi *(retenu)* | La facture existante garde 60 / 6 / 54 / 20 et l'ADR 0003 reste exacte à la virgule ; les modèles A / A′ / B lisent le second jeu. Coût : une clé de plus dans `renderData`, une section de plus. | |
| **5** | Faut-il outiller le piège `Intl` de C6 dans le gabarit de PR ? | ☐ **A — une quatrième case** *(écarté)* | ⚠️ Redondant : le gabarit porte **déjà** l. 12 (« Aucune lecture d'environnement… `Intl.*` sans locale explicite ») et l. 13 (« Aucune règle métier (taux, barème, arrondi « légal ») »). Une case qui en redit deux affaiblit la checklist. | ☑ **C.** Trois motifs écrits, et le deuxième est **interne à ce plan**. (1) Ce que le dépôt interdit est une **liste close** — `docs/roadmap/README.md:132` : « taux de TVA, régimes, barèmes, arrondis « légaux », conversion de devise **à un taux officiel** » — où l'unité mineure d'une devise (ISO 4217) ne figure pas. C2 n'a pas mandat pour l'y ajouter, et un garde-fou opposable à **toutes** les PR du dépôt passe par un amendement d'AGENTS.md, qui « fait foi » (§1.2), jamais par une case ajoutée en marge d'un plan de lot. (2) **D10 écrit qu'« un plan ne peut pas amender `biome.jsonc` par une phrase écrite ailleurs ».** Or `biome.jsonc:273` déclare le chemin `Intl.NumberFormat(locale)` **autorisé et attendu** pour C6 ; une case qui rangerait l'échelle décimale résolue par `Intl` parmi les barèmes dirait l'inverse — **le même amendement par une autre porte**, sans le mandat qu'AGENTS.md §7 exige. (3) La mesure de D10 établit enfin que cette case rendrait le critère de fin de C6 — « deux devises, sans duplication du modèle » — inatteignable par le moyen normal : chaque montant devrait porter un `if(eq(devise, …), round(x, 0, m), round(x, 2, m))`, c'est-à-dire une duplication déguisée. Le risque reste porté par l'**ADR 0004**, sous forme de question ouverte adressée à C6 — *qui déclare l'échelle d'affichage d'un montant : le modèle, l'intégrateur, ou une table de devises ?* — avec les cinq mesures de D10 en pièce jointe. |
| | | ☐ **B — amender la case l. 13** en y ajoutant « *y compris une échelle décimale résolue par `Intl` à partir d'un code devise* » | Une ligne, au bon endroit — mais elle **classe** l'échelle décimale d'une devise parmi les barèmes, ce que ni le README, ni la roadmap, ni aucune ADR n'écrit, et ce que C6 n'a pas encore instruit. | |
| | | ☑ **C — rien dans le gabarit**, l'ADR 0004 porte le risque *(retenu)* | Le risque reste porté par un document que C6 doit penser à ouvrir — **et c'est le document que C6 ouvrira de toute façon**, puisqu'il complète l'ADR 0003 dont C6 hérite. | |

### Les trois conséquences qu'il faut avoir en tête

**Le risque accepté par le n°1, et son signal.** Refuser les modes dirigés retire une capacité réelle
sans échappatoire propre dans l'algèbre. Le jour où la demande arrive, la décision se rejoue en
entier ; **c'est le signal, il faut le reconnaître** au lieu de l'enterrer dans un `if` alambiqué ou
dans un `add(x, 0.005)` dont personne n'a écrit qu'il en est un.

**Le précédent créé par le n°2.** C2 introduit un **quatrième** rétrécissement de valeur, après les
trois de l'ADR 0003 décision 2. Il s'ajoute à la même hypothèse et à la même liste : le jour où
l'hypothèse pré-v1.0 tombe, ce sont **quatre bornes à rediscuter une par une**, pas un lot à rouvrir.

**Une remarque de méthode, parce qu'elle se reproduira.** **Quatre** des cinq lignes de ce tableau
ont bougé après qu'une relecture adverse a montré que le texte écrit était réfutable, et les deux cas
ne se lisent pas de la même façon — une version antérieure de ce paragraphe comptait trois lignes et
les rangeait toutes sous « changement de motif », ce qui masquait exactement ce qu'il faut relire.

- **Deux ont changé de motif, à décision constante** : le n°1 (fragilité → anti-sur-ingénierie) et le
  n°2 (décorativité → borne prouvée plus rétrécissement assumé). **Un motif réfuté se réécrit sans
  rouvrir l'arbitrage**, parce que ce qui est arbitré est le résultat, pas le moyen.
- **Deux ont changé d'option recommandée** : le n°4 (A → C) et le n°5 (A → B → **C**). **Un
  changement d'option *est* un arbitrage rejoué**, et il doit être relu comme tel : le n°4 parce que
  le dilemme A/B était faux, le n°5 parce que les deux premières options supposaient une
  classification que C2 n'a pas mandat pour écrire.

Si une contre-mesure réfute un chiffre, c'est le motif qui se réécrit ; si elle réfute une prémisse,
c'est l'option qui se rejoue. **Les deux se disent, aucun des deux ne se fait en silence.**

---

## 9. Ce que ce plan tient pour acquis

**Six hypothèses. Si l'une est fausse, le plan change — une pièce nommée, pas le lot.**

1. **Le projet est toujours en pré-v1.0, et aucun template client n'existe en stockage.**
   *Vérifié :* `git tag` ne rend rien ; aucun workflow de publication (`.github/workflows/` contient
   `ci.yml`, `codeql.yml`, `security.yml`, `sonar.yml`, aucun `npm publish`) ; aucun `.changeset/` ;
   les quatre paquets sont en `0.1.0`.
   *Ce qui repose dessus :* **la seule** borne nouvelle de C2, la fenêtre `decimals ∈ [-15, 15]`
   (D4), qui est un rétrécissement qu'aucune migration ne rattrape. Elle s'ajoute aux trois de l'ADR
   0003 décision 2.
   *Ce qui n'y repose PAS :* le versionnement. AGENTS.md §1.2 est explicite, et D9 livre son
   estampille et sa migration quoi qu'il arrive.
   *Si elle tombe :* cette borne se rediscute, **elle seule**.

2. **Zod se comporte comme mesuré, sur la version installée.**
   *Vérifié à l'exécution* contre `zod@3.25.76` résolu (`packages/core/package.json` déclare
   `"zod": "^3.25.76"`), importé via `zod/v4` : les six messages de la [§5.3] sont ceux rendus, et
   `z.enum(ROUND_MODES)` accepte le tuple `as const`.
   *Ce qui repose dessus :* **la totalité de D6** — « zéro code d'erreur nouveau » n'est vrai que
   parce que `decimals` et `mode` sont tranchés au parse. Si Zod cessait de refuser une de ces
   formes, C2 devrait un garde runtime, un code, et C8 un message.
   *Réserve mesurée et déjà corrigée :* sans le paramètre `error`, le message des infinis est
   auto-contradictoire ([§2, D6]).

3. **ECMA-262 fixe la forme décimale la plus courte et la conversion inverse, sans ICU.**
   `Number.prototype.toExponential` sans argument est spécifiée « f as small as possible » ;
   `Number(string)` est spécifiée comme la valeur exacte arrondie **une fois** au plus proche.
   **C'est la condition sous laquelle D2 promet le déterminisme**, et elle doit être écrite dans
   l'ADR 0004 **dans ses deux moitiés**. Elle est plus forte que celle de `textCase`, qui dépend de
   la version Unicode du moteur.
   *Vérifié indirectement :* 720 012 cas coïncident avec `Intl` sur Node 24.11.1, et 4 400 022 avec
   une référence BigInt qui ne dépend d'aucune de ces deux implémentations. Également vérifié :
   `String(x)` et `x.toExponential()` rendent les **mêmes chiffres significatifs** — « on arrondit
   ce que le lecteur voit » n'est pas une figure de style.

4. **`toExponential` n'est restreint ni par Biome ni par les plugins GritQL, aujourd'hui.**
   *Vérifié par lecture, pas par exécution dans le dépôt :* `toExponential`, `toFixed`,
   `toPrecision` et `Number` n'apparaissent dans aucune des 20 entrées de `noJsRestrictedProperties`
   (`biome.jsonc:206-292`, override `packages/core/**`) ni dans les trois `.grit` —
   `no-environment-read.grit` ne filtre que `new Date`, `new Date($args)`, `Intl.$f()`,
   `new Intl.$f()`, `Intl.DateTimeFormat($args)`. `Math.round`, `Math.trunc`, `Math.floor`,
   `Math.ceil`, `Math.abs`, `Math.sign` sont autorisés ; seul `Math.random` est banni. Le code
   proposé n'emploie ni `Math.pow` (qui déclencherait `useExponentiationOperator`, sévérité *info*),
   ni `toFixed`, ni `toLocale*`, ni `Intl`.
   > 🔑 **Non vérifié par exécution dans ce dépôt, et signalé comme tel :** aucune sonde `biome lint`
   > n'a été écrite sous `packages/core/src` pour produire ce plan — l'interdiction d'écrire dans le
   > dépôt était absolue. **INC-1 doit rejouer la sonde jetable avant de commiter**, et la supprimer.
   *Réserve :* `noJsRestrictedProperties` est une règle **nursery**, hors versionnement sémantique.
   `toExponential` doit rejoindre la liste de la sonde jetable de l'ADR 0003, rejouée à chaque montée
   de Biome. Si la règle s'élargissait aux méthodes de conversion numérique, c'est le cœur de
   l'implémentation qui serait bloqué.

5. **Le test committé tient dans le délai par défaut de Vitest.**
   *Vérifié :* aucune clé `testTimeout` dans `vitest.config.ts`, aucune occurrence de `timeout` dans
   les tests de `packages/core`, Vitest **4.1.10** — donc **5 000 ms** par `it`. Le budget de la
   [§5.2] est calculé sur des coûts par appel mesurés (~1,5 µs et ~3,2 µs), pas supposés.
   *Si elle est fausse* (machine de CI plus lente d'un facteur 2), la parade est écrite : réduire le
   nombre de tirages par précision, **jamais** ajouter un `testTimeout` — ce serait desserrer une
   contrainte pour débloquer un test (AGENTS.md §7).

6. **Un arbre construit à la main, hors `parseTemplate`, est hors modèle de menace — par écrit, pas
   par omission.**
   `evaluateExpression` est publique et prend un `Expression` de n'importe où ; le dépôt le documente
   déjà pour la borne de profondeur. Conséquences nommées : un `decimals: -308` construit à la main
   atteint `requireFiniteResult` — **vérifié**, et c'est pourquoi le garde reste et qu'un test
   construit ce nœud ; un `decimals: 2.5` construit à la main rend `NaN` à la reconstruction et lève
   donc `not-finite` plutôt que d'imprimer un nombre faux — **vérifié**, un message imparfait pour
   une entrée impossible, ce qui est la bonne dégradation.
