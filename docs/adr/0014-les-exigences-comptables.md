# ADR 0014 — Les exigences comptables

- **Statut :** 🟢 **Accepté** (2026-08-25), implémenté dans `@openview/core`,
  `@openview/engine` et `@openview/adapter-puppeteer`
- **Date :** 2026-08-25
- **Impact :** `@openview/core` (un champ optionnel sur la ligne de tableau, un troisième
  `pageField`, une opération d'arrondi publiée, `CURRENT_SCHEMA_VERSION` **8 → 9** et sa
  migration), `@openview/engine` (contributions matérialisées, groupes transparents,
  politique `keepTogether`, préférence de veuves et orphelines, calcul des reports, réserve
  de marqueur sur un second alphabet, un refus neuf), `@openview/adapter-puppeteer` (une
  observation numérique de plus dans la mesure), `apps/playground` (la facture de référence
  gagne le report, deux blocs insécables et un texte long), `@openview/designer` et
  `@openview/viewer` (**intacts**)
- **Ferme :** [ADR 0009](0009-les-blocs-insecables.md) **D3, D4 et D5** — la sémantique par
  occurrence matérialisée, la survie d'une marque descendante au repli de son parent, et la
  politique ordonnée dont la troisième branche garantit la terminaison. C7 avait livré la marque ;
  ce lot est le premier à l'honorer. Ferme aussi [ADR 0006](0006-la-page.md) D6 pour le domaine
  `lastOnly` ;
  [ADR 0004](0004-les-arrondis-declares-par-le-modele.md) D2 — l'opération d'arrondi devient
  atteignable hors de l'évaluateur, sans seconde implémentation
- **Rompt :** le contrat de mesure — `PdfLayoutMeasurement` gagne `clippedMarkerCount`, requis —
  et `MarkerReserve.widthOf()` reçoit désormais le **run** et non sa seule typographie. Les deux
  ruptures sont internes au moteur et à son adaptateur ; `RenderPort`, `RenderRequest` et
  `RenderResult` sortent du lot **inchangés**.
- **Amende un diagnostic public** : le refus d'un `pageField` inconnu passe de `invalid-value`
  à `invalid-structure` et perd son `acceptedValues`. C'est le seul recul du lot, il est
  compensé et il est expliqué en
  [C-2](#c-2--le-refus-dun-marqueur-inconnu-change-de-code-et-gagne-une-phrase).
- **N'amende aucune règle de gouvernance.** `AGENTS.md`, `tsconfig*.json`, `biome.jsonc`, les
  plugins GritQL, `turbo.json`, `sonar-project.properties`, les workflows, la configuration
  Vitest et les seuils de couverture sortent du lot **inchangés**. **Aucune dépendance n'est
  ajoutée.**
- **Plan d'implémentation :**
  [docs/plans/e3-les-exigences-comptables.md](../plans/e3-les-exigences-comptables.md)
  — **périmé** une fois le lot livré. C'est cette ADR qui fait foi, et elle **corrige** son plan
  sur sept points nommés au
  [§ Ce que l'exécution a corrigé du plan](#ce-que-lexécution-a-corrigé-du-plan).
- **Implémentation :**
  [`core/src/ast/types.ts`](../../packages/core/src/ast/types.ts) et
  [`schemas.ts`](../../packages/core/src/ast/schemas.ts) (contribution de ligne, marqueur de
  report, refus dans l'en-tête et le pied),
  [`core/src/ast/visitor.ts`](../../packages/core/src/ast/visitor.ts) (la contribution entre au
  catalogue des lectures),
  [`core/src/template/`](../../packages/core/src/template/) (estampille 9 et migration 8 → 9),
  [`engine/src/document/materialize.ts`](../../packages/engine/src/document/materialize.ts)
  (contributions, groupes transparents, frontières de groupe de lignes),
  [`engine/src/pagination/reports.ts`](../../packages/engine/src/pagination/reports.ts) et
  [`keep-together.ts`](../../packages/engine/src/pagination/keep-together.ts) (les deux
  calculs neufs),
  [`engine/src/pagination/text.ts`](../../packages/engine/src/pagination/text.ts) (préférence
  2/2),
  [`engine/src/pagination/markers.ts`](../../packages/engine/src/pagination/markers.ts)
  (alphabet canonique et sa borne),
  [`engine/src/pagination/verify.ts`](../../packages/engine/src/pagination/verify.ts) (le
  marqueur rogné devient un refus),
  [`adapter-puppeteer/src/measure.ts`](../../packages/adapter-puppeteer/src/measure.ts)

---

## Contexte

L'[ADR 0013](0013-le-tableau-deborde-proprement.md) a livré une pagination explicite : le moteur
décide les coupes, Chromium mesure, une facture de soixante lignes sort en quatre feuilles avec
l'en-tête de colonnes répété et « page n / N » exact. Ce qu'elle n'a pas livré, l'ADR le dit
elle-même : « Les veuves, les orphelines typographiques et le report de total restent à E3. »

E3 transforme cette pagination générale en pagination **comptable**. Quatre écarts la séparaient de
ce niveau d'exigence, et ils étaient réels, pas rhétoriques :

- **La marque n'ordonnait rien.** `keepTogether` traversait la liaison depuis le lot C7 et
  `placeBlock()` ne la lisait pas : le document marqué et le document non marqué avaient la même
  coupe, délibérément.
- **Trois frontières étaient perdues à la liaison.** Les occurrences d'un `loop` et d'une
  `condition` étaient aplaties en blocs, les lignes d'un `tableRowGroup` aplaties dans
  `MaterialTable.body`. « Garder chaque itération entière » était donc inexprimable.
- **Aucun contrat ne désignait une contribution au report.** Les liaisons devenaient du texte et un
  tableau ne calculait rien. Déduire un montant d'un nom de colonne ou d'une chaîne imprimée aurait
  violé la règle de périmètre d'`AGENTS.md` en une ligne.
- **Le texte était purement glouton.** `sliceText()` gardait le plus long préfixe qui tenait, même
  quand cela laissait une seule ligne sur l'une des deux pages.

Le lot a commencé par sept sondes bloquantes, pour la raison qui vaut depuis E1 : une décision de
conception prise sans mesurer le navigateur est une hypothèse déguisée en contrat. **Une de ces
sondes a corrigé le plan** — pas en le contredisant, en montrant que sa marge de sécurité n'existait
pas.

---

## Ce que le lot n'est pas

Il faut le dire avant les décisions, parce que la moitié de la conception d'E3 consiste à **ne pas**
faire quelque chose que la facture semble demander.

**Openview ne reconnaît ni une facture, ni un montant, ni une mention légale.** Le modèle désigne la
valeur numérique que chaque ligne apporte au report ; le moteur décide seulement quelles occurrences
précèdent une page — la seule information que ni le modèle ni l'intégrateur ne peuvent connaître
avant la mesure. Aucun nom de champ n'est réservé, aucune colonne n'est inspectée, aucun texte
imprimé n'est relu.

**Le report sort dans l'écriture numérique canonique.** Le groupement des chiffres, la devise et le
choix des sites de formatage appartiennent à E4. L'exemple « 12 480,00 € » de la roadmap exprime la
sémantique comptable ; E3 en livre la valeur et la position, E4 en livrera l'écriture localisée.

**Un seul cumul, entrant, porté par une ligne de corps.** Pas de « à reporter » sortant en bas de
page, pas d'accumulateur nommé, pas de report porté par un bloc non tabulaire. Chacun de ces trois
élargissements est une convention comptable neuve ; aucun document de référence ne la demande, et le
jour où un modèle réel la demandera, elle passera par un lot `core` versionné plutôt que par une
convention cachée dans `engine`.

**Rien de ce qui appartient aux lots suivants.** Pas de résultat public de pagination ni
d'observation du repli (E5), pas d'égalité entre machines ni de fontes embarquées (E6), pas de
corpus figé de PDF (E7), pas de plafond de pages, de temps, de mémoire ou de concurrence (E8).

---

## Les sondes, et ce qu'elles ont dit

Cinq sondes ont mesuré Chromium avant qu'une ligne de politique ne soit écrite ; deux étaient des
oracles de moteur et sont devenues des tests plutôt que des scripts jetables.

### P1 — Un conteneur sans style ne change pas la géométrie : **passée**

Le même flux, aplati puis entouré d'un `div` sans style, mesuré à trois sites : à la racine, dans
une cellule de tableau, et autour d'un tableau. Largeur et hauteur identiques au pixel près dans les
trois cas (718,11 × 72,00 à la racine ; 430,86 × 90,00 en cellule ; 718,11 × 36,00 autour d'un
tableau).

C'est cette sonde qui autorise [D-8](#d-8--une-occurrence-marquée-devient-un-groupe-transparent-et-seulement-alors) :
un groupe synthétique peut être un `MaterialContainer` sans boîte, sans fragment HTML dédié et sans
changement de mise en page. Si elle avait échoué, le constructeur HTML aurait dû recevoir un
fragment de groupe transparent — le lot n'acceptait pas « assez proche » sur une décision de coupe.

### P2 — La hauteur naturelle prédit un placement entier : **passée**

`metrics.height(key)` comparé à la hauteur de la même occurrence peinte entière dans une page de
hauteur suffisante, pour un texte avec padding, un conteneur avec padding et fond, un tableau avec
en-tête et cellules padées, et un groupe transparent : **51,09 / 66,22 / 76,59 / 36,00** des deux
côtés, à zéro près.

Sans elle, la première branche de `keepTogether` reposerait sur une hauteur qui ignore un padding ou
une ligne, et un bloc « qui tient » déborderait à l'impression.

### P3 — Un groupe de lignes marqué garde la géométrie du tableau : **passée**

Trois lignes portant une référence de groupe interne, comparées aux mêmes trois lignes sans elle :
hauteurs, largeurs de colonnes et filets identiques, et **zéro** enfant de `tbody` autre qu'un `tr`.
La frontière de groupe est une donnée du moteur et **rien** dans le balisage — c'est ce qui la rend
gratuite pour la mise en page.

### P4 — Les curseurs autorisent réellement une coupe 2/2 : **passée**

Le lecteur de lignes de l'adaptateur, rejoué sur des textes de une à sept lignes visuelles, plus un
texte à ligne vide et un texte mêlant deux tailles de police : **1→1, 2→2, 3→3, 4→4, 5→5, 6→6, 7→7**,
ligne vide → 3, tailles mêlées → 3. Aucun caractère perdu, et une fin de ligne exploitable à l'index
1 comme à l'index *n*−2.

### P5 — La réserve canonique contient toutes les formes limites : **passée, et elle a corrigé le plan**

Trois résultats, dont un qui a changé une phrase du plan.

1. **L'alphabet est clos.** `String(value)` sur un double fini n'emploie que
   `0123456789-+.e`. Vérifié sur les formes limites choisies à la main, puis sur trois millions de
   doubles tirés au hasard : **aucun caractère hors alphabet**.
2. **La borne de 25 caractères est exacte, pas généreuse.** Le plan la présentait comme un majorant
   confortable. Le balayage aléatoire a produit `-0.0000018102898948056846` — **exactement 25
   caractères** — et une recherche dirigée sur la fenêtre d'écriture décimale a confirmé le pire
   cas : signe, `0.`, les cinq zéros que la notation décimale accepte encore, et dix-sept chiffres
   significatifs, soit `-0.0000012345678901234567`. **Il n'y a aucune marge.** Cette phrase est la
   correction la plus importante que le lot apporte à son plan.
3. **Un chiffre ne borne pas un report.** Pour la même typographie, le glyphe canonique le plus
   large mesure **9,031 px** quand le chiffre le plus large mesure **8,000 px**. Réserver un report
   sur l'alphabet des chiffres le rogne — c'est mesuré, pas déduit.

Enfin, la réserve elle-même : 25 × le glyphe le plus large, appliquée aux seize formes limites sous
quatre signatures typographiques (deux familles × deux graisses), soit **soixante-quatre marqueurs,
zéro rogné**.

### P6 — Une contribution fragmentée est comptée une fois : **oracle de moteur, devenue un test**

Elle ne demandait pas de navigateur : une ligne trop haute pour toute page se fragmente par flux de
cellules, et sa contribution ne doit apparaître qu'après son dernier fragment. Elle vit dans
`pagination-reports.test.ts` sous « is counted on the page holding its last fragment, and never
before » — une ligne de quatre lignes visuelles sur des pages de deux, quatre feuilles de report à
zéro puis la valeur.

### P7 — Une grande bande finale ne fait pas osciller la suite : **oracle de moteur, devenue un test**

Même raison. Elle vit sous « reserves a band on every page, so the report cannot make the run
oscillate » : la même distribution de lignes, à un report de six chiffres près, puis à un report
négatif à huit décimales près.

---

## Les décisions

### D-1 — Le modèle désigne une contribution de LIGNE ; le moteur décide la frontière de page

`TableRowNode` gagne un champ optionnel :

```ts
export interface PageReportContribution {
  readonly value: PrintableExpression;
}
```

`pageReport.value` est évalué **une fois par occurrence matérialisée** de la ligne, dans la même
portée que ses cellules, et doit produire un nombre fini. Une ligne sans ce champ ne contribue rien.

La ligne, et pas la cellule ni le bloc, pour cinq raisons qui tiennent ensemble : sa fin est
observable dans `RowFragment.edge` ; sa répétition par `tableRowGroup` fournit la bonne portée
d'alias ; le modèle choisit l'expression, donc Openview ne reconnaît aucun nom de champ ; une ligne
de corps est la plus petite unité comptable que le document de référence demande ; et le tableau
continue de **ne rien sommer** — il transporte des occurrences, le paginateur agrège les
contributions dont il a lui-même décidé la page.

**Écartés, et nommés pour que la question ne se rouvre pas par inadvertance :** inspecter les
liaisons numériques d'une cellule ; nommer une colonne « montant » ; référencer un `tableId` ou un
`columnId` global ; injecter un sous-ensemble de données dans une portée ; ajouter une expression
qui lirait le numéro de page.

La déclaration est **limitée aux lignes du corps**. `TableNodeSchema` refuse un `pageReport` dans
`header` ou `footer`, au save time, là où la position est encore connue : un en-tête est répété sur
chaque page que le tableau atteint, un pied n'est pas une ligne de détail, et ni l'un ni l'autre n'a
une occurrence unique à compter.

### D-2 — `pageField: report` porte l'arrondi, jamais la devise

`PAGE_FIELDS` devient `['number', 'count', 'report']`, et le marqueur de report exige les deux
paramètres du contrat C2 :

```ts
export interface TextPageReportSegment {
  readonly kind: 'pageField';
  readonly field: 'report';
  readonly decimals: number;
  readonly mode: RoundMode;
  readonly typography?: Typography | undefined;
}
```

Les formes `number` et `count` gardent exactement leurs clés. Le type public
`TextPageFieldSegment` devient l'union du compteur et du report, et le schéma est discriminé **deux
fois** — sur `kind`, puis sur le champ nommé. Un objet plat aurait dû accepter un report sans
arrondi ou un compteur en portant un.

Les bornes de `decimals` et la liste des modes ne sont **pas** réécrites : `RoundingPositionSchema`
est extrait de `RoundExpressionSchema` et partagé. Une seconde écriture des bornes aurait été une
seconde politique, libre de dériver de la première.

E3 n'ajoute ni symbole monétaire, ni `format`, ni nom d'écriture. E4 pourra ajouter son champ de
site sur ce segment, dans la version suivante disponible.

### D-3 — Une seule estampille, posée avec toute la forme stockée

E3 élargit une union (`field: 'report'`) et ajoute un champ optionnel (`TableRowNode.pageReport`).
Les deux classes de changement exigent l'incrément, et pour deux raisons différentes qu'`AGENTS.md`
§1.2 nomme déjà : un build antérieur **efface en silence** le champ optionnel, et **refuse
illisiblement** l'union élargie sur un discriminant inconnu.

`CURRENT_SCHEMA_VERSION` passe donc de **8 à 9**, `TEMPLATE_MIGRATIONS` gagne une entrée 8 → 9
d'estampille seule, et la fixture historique v9 porte une ligne contributrice et un marqueur de
report. Le contrat, la migration, les tests de compatibilité et la fixture entrent dans le **même
commit**.

L'estampille est *tout* le travail de cette migration, et c'est un travail complet : sans elle, un
document v9 ouvert par un build v8 perd ses contributions sans erreur, ou est refusé sur
« No matching discriminator » — ni erreur typée, ni mention de version, aucun remède.

### D-4 — Le report d'une page est ENTRANT et cumulatif

Pour une page `p`, la valeur brute du report est la somme des contributions des lignes dont
l'occurrence **s'est achevée** sur une page strictement antérieure à `p`.

- une ligne `whole` contribue sur sa page ;
- une ligne fragmentée contribue sur la page de son fragment `last`, jamais sur `first` ni
  `middle` ;
- l'en-tête répété n'est **jamais** parcouru comme source ;
- le report brut de la page 1 vaut zéro — c'est le modèle qui choisit de ne pas l'afficher, en
  plaçant son marqueur dans la bande `exceptFirst` ;
- chaque marqueur applique son `decimals` et son `mode` au cumul **brut** ;
- le résultat est converti en texte canonique, sans locale.

Le cas d'une ligne surdimensionnée est ainsi tranché : son montant entre dans le report une fois son
dernier fragment placé. Cette convention privilégie l'unicité et l'explicabilité à une heuristique
fondée sur la cellule où les chiffres sont visibles. Une autre convention exigerait un champ
indiquant où le montant « vit » dans la ligne ; ce champ est refusé tant qu'aucun besoin réel ne
l'exige.

### D-5 — L'ordre de sommation est la matérialisation, jamais le parcours

Les contributions portent un **rang** attribué à la matérialisation, remis à zéro par rendu. Le
cumul de chaque page est recalculé **depuis ce rang**, et non accumulé depuis la page précédente ni
obtenu en additionnant les cellules dans l'ordre où le DOM les a rendues.

Ce n'est pas une précaution de style : une somme IEEE-754 dépend de l'ordre de ses termes.
`1e16 + 1 + 1 + 1 + 1` rend `10000000000000000` et `1 + 1 + 1e16 + 1 + 1` rend `10000000000000004`,
et un rapport comptable ne doit pas dépendre de l'ordre dans lequel un paginateur a visité des
boîtes. Le test qui l'épingle construit une disposition où les deux ordres **peuvent** diverger —
une ligne externe dont la cellule porte un tableau plus haut qu'une page, donc rangée avant les
lignes internes et achevée après elles — puis épingle l'ordre de collecte (`1, 2, 0, 3, 4`) et la
somme.

Toute somme non finie est refusée, avec le numéro de page et **sans la valeur**.

### D-6 — L'arrondi du report réemploie l'opération C2

`roundDecimal()` devient une utilité publique de `@openview/core`. `engine` ne recopie pas
l'algorithme et ne construit pas une expression artificielle pour réentrer dans l'évaluateur : il
appelle la même fonction qu'une formule `round` appelle.

Un seul symbole est publié — ni `evaluateRound`, ni les gardes, ni `RoundingPositionSchema` — et un
test épingle les deux listes, celle des noms qui apparaissent et celle des noms qui ne doivent pas
apparaître.

Le budget d'évaluation porte sur les expressions de contribution, évaluées une fois. Arrondir le
cumul déjà numérique est une opération de rendu bornée, pas une nouvelle lecture du jeu de données.

### D-7 — La géométrie d'un marqueur ne dépend jamais de sa valeur

Un report modifie une bande, qui modifie la hauteur du flux, qui modifie les coupures, qui modifient
le report. Ce cycle se ferme par une largeur majorante fixe, réservée **avant** pagination — la
même parade que l'ADR 0013 avait retenue pour `number` et `count`, étendue à un alphabet plus large.

```text
report       : 25 x largeur du glyphe le plus large de « 0123456789-+.e »
number/count : nombre de chiffres du majorant de pages x largeur du chiffre le plus large
```

`MarkerReserve.widthOf()` reçoit donc le **run complet** et non sa seule typographie : c'est le
champ nommé qui décide de l'alphabet, et une signature typographique ne le porte pas. La sonde de
glyphes mesure les quatorze caractères de l'alphabet canonique par signature et en retient deux
maxima, celui des dix chiffres et celui de l'alphabet entier.

**La borne de 25 est exacte** — voir P5. E4 devra la réexaminer entièrement : une chaîne localisée
contient des séparateurs, un symbole et des espaces qui ne sont pas dans cet alphabet.

### D-8 — Une occurrence marquée devient un groupe transparent, et seulement alors

Une itération d'un `loop` marqué et la branche vraie d'une `condition` marquée sont matérialisées en
`MaterialContainer` synthétique : clé neuve, `nodeId` de la déclaration, chemin d'occurrence,
`box: undefined`, enfants liés dans leur portée. Le HTML correspondant est un conteneur sans style,
et P1 montre qu'il est géométriquement inerte.

**Un nœud non marqué reste aplati comme en E2.** Cette asymétrie est délibérée : elle évite
d'élargir toute la représentation pour une information qui n'a d'effet que lorsqu'elle est demandée,
et aucun document qui n'utilise pas la marque ne paie une frontière que personne ne lit.

La boucle est traitée **par itération**. Soixante éléments donnent soixante groupes éventuels, pas
un groupe contenant les soixante — un groupe de soixante serait un bloc qu'aucune page ne peut
tenir, ce qui est l'inverse de ce que la marque demande. Une condition fausse ne produit aucune
occurrence à garder.

### D-9 — `tableRowGroup` conserve une frontière d'occurrence sans changer le contrat de table

Chaque ligne matérialisée depuis un groupe marqué porte une référence interne vers son occurrence de
groupe : clé, `nodeId`, chemin, index de sa première ligne dans la séquence du corps, et nombre de
lignes. `placeTable()` reconnaît le **début** d'une occurrence en comparant cet index à sa position
courante, somme les hauteurs naturelles des lignes de l'occurrence, puis applique les trois branches
de D-10.

L'index est compté sur le **corps aplati** et non sur l'entrée qui l'a produit : un corps peut mêler
des lignes fixes et des groupes, et un décalage pris sur l'entrée seule pointerait le paginateur sur
la mauvaise ligne. Un test l'épingle avec une ligne d'ouverture avant le groupe.

Si le groupe dépasse toute page neuve, `placeTable()` reprend la ligne courante avec sa politique
ordinaire, et une ligne descendante marquée reste entière si elle le peut. Le curseur reste celui
d'E2 : aucune identité publique E5 n'est figée.

### D-10 — `keepTogether` suit exactement l'ordre de l'ADR 0009

Au début d'une occurrence marquée, après mesure naturelle, et dans cet ordre :

1. si sa hauteur entière tient dans l'espace restant, elle est placée entière ;
2. sinon, si elle tient dans une page neuve admissible, la page courante se ferme sans elle ;
3. sinon, la marque **cesse de bloquer** et le kind emploie sa politique E2 ordinaire.

Les trois branches vivent dans une seule fonction, `decideKeepTogether()`, appelée par le flux et
par le tableau : leur ordre est écrit une fois.

La troisième branche n'est ni un avertissement, ni un refus neuf : **c'est la preuve de
terminaison**. Sans elle, une occurrence plus haute que toute page serait reportée éternellement, et
une marque pourrait transformer un document imprimable en refus ou en boucle.

Deux invariants de curseur la rendent sûre. La décision n'est prise qu'au **premier** curseur de
l'occurrence — un fragment déjà produit signifie que la marque a déjà replié, et re-décider à chaque
page reporterait le même bloc pour toujours. Et la récursion continue de lire la marque de **chaque
descendant** : un parent replié ne fait taire aucun enfant qui peut encore être honoré.

### D-11 — Les veuves et les orphelines sont une préférence 2/2, pas une cause de refus

Pour un texte qui doit être coupé et possède au moins quatre lignes visuelles restantes : le
fragment courant garde au moins deux lignes, le suivant en reçoit au moins deux. Si l'espace restant
ne le permet pas mais qu'une page neuve le permet — en portant le texte entier ou en autorisant la
même coupe 2/2 — rien n'est placé et la page se ferme. Si aucune page ne le permet, la coupe
gloutonne tient : une préférence peut coûter une page, jamais un refus et jamais une page qui n'a
rien consommé.

Sous quatre lignes restantes, deux de chaque côté est arithmétiquement impossible : la coupe
gloutonne tient et **aucune coupure artificielle n'est introduite**.

La préférence s'applique à tout `TextNode`, y compris dans une cellule. Elle ne s'applique pas aux
lignes de tableau : l'ADR 0009 parle d'un seuil dépendant de la fonte, donc des lignes visuelles
d'un texte. **Aucun champ `orphanControl` et aucun nombre minimal n'entre dans le modèle** : E3 fixe
une préférence moteur, et un seuil configurable demanderait un besoin qui n'existe pas.

Ordre des politiques, fixe : `keepTogether` essaie d'abord l'occurrence entière ; si son repli est
nécessaire, la politique ordinaire du texte inclut alors la préférence 2/2. Les contraintes ne sont
jamais optimisées globalement et n'ont aucune priorité numérique.

### D-12 — Une contribution dans une bande est refusée, pas ignorée

Ce cas n'était pas dans le plan. Une bande est un `ContainerNode`, donc elle peut contenir un
tableau, donc une ligne portant `pageReport` — et le collecteur ne parcourt que le flux racine.
Laisser passer aurait évalué l'expression puis **jeté son résultat en silence**, ce qui est
exactement la classe de défaut que ce contrat existe pour refuser.

Le refus est levé à la matérialisation, là où la région est connue, sous `page-report-refused`.
C'est le même raisonnement que le refus d'un `pageReport` dans un en-tête de tableau (D-1) : ce qui
se répète n'a pas d'occurrence unique à compter.

### D-13 — Un marqueur rogné est un refus mesuré, jamais un chiffre coupé

`PdfLayoutMeasurement` gagne `clippedMarkerCount: number` — un entier, et rien d'autre : quelle
valeur a été rognée et ce qu'elle disait sont des données de rendu. L'adaptateur compte les
`.ov-marker` dont `scrollWidth` dépasse `clientWidth`, la validation exige un entier fini positif ou
nul, et la vérification finale exige **zéro**.

C'est un refus et non un débordement à stabiliser : aucune coupe du flux ne rend un marqueur plus
étroit. L'`overflow: hidden` qui maintient un marqueur dans sa boîte reste une barrière visuelle,
jamais une autorisation d'imprimer la moitié d'un nombre.

Cette garde survit à E4 : même si la borne de E4 se révèle fausse, le PDF sera **refusé** plutôt que
tronqué.

### D-14 — Le Pipeline reste un Pipeline

L'ordre complet devient :

```text
validation et migration
  -> liaison des blocs, bandes et contributions
  -> réservation des marqueurs
  -> mesure naturelle
  -> pagination avec keepTogether et seuils 2/2
  -> calcul des reports entrants depuis les fragments finaux
  -> construction HTML
  -> mesure et stabilisation de la suite
  -> impression
```

Chaque reprise de `settle()` repagine depuis le début et **recalcule** les reports : un tour qui
déplace une ligne change quelles lignes se sont achevées avant quelle page. Aucun report d'un essai
précédent n'est patché dans une nouvelle suite. Leur largeur étant fixe, leur valeur ne peut pas
modifier une ligne ni une hauteur, donc ce recalcul ne peut pas relancer la stabilisation.

Aucune étape ne retourne un succès partiel et aucun `next()` n'autorise une interruption
silencieuse.

### D-15 — E3 ne publie ni page, ni occurrence, ni diagnostic de repli

`OccurrenceKey`, le rang de contribution, les frontières de groupe et les reports bruts restent des
types **internes**. `RenderResult` reste `{ format, bytes, contentType }`. E5 choisira une identité
capable de survivre entre deux rendus et rendra les replis observables ; E3 ne préempte pas cette
surface.

---

## Ce que le lot mesure

### Sans navigateur, sur papier quadrillé

Cinq fichiers neufs, quatre-vingt-quinze cas, tous sur la grille déterministe d'E2 — hauteur de ligne
fixe, vingt caractères par ligne — de sorte qu'un test qui rougit parle d'une décision de coupe et
jamais de l'arithmétique en dessous.

**Le contrat** (`core/src/ast/__tests__/page-report.test.ts`, 16 cas). Les deux compteurs inchangés ;
le report exigeant ses deux paramètres ; les bornes et les messages de C2 réemployés tels quels ; un
nom de champ hors liste refusé **avec la liste** ; la contribution acceptée sur une ligne fixe comme
sur une ligne répétée, refusée dans `header` et dans `footer` au chemin exact ; l'absence restant une
absence plutôt qu'un `undefined` écrit ; `collectDataPaths()` remontant la valeur de contribution et
masquant l'alias du groupe ; la marque n'ajoutant aucune lecture implicite ; le barrel gagnant
exactement `roundDecimal` et aucun autre helper d'évaluateur ; l'estampille à 9 et sa migration.

**La matérialisation** (`engine/src/__tests__/materialize-report.test.ts`, 23 cas). La contribution
lue dans la portée de sa ligne et non dans la racine ; les rangs de zéro à *n*−1 sans trou ; la clé de
la ligne ; deux rendus donnant les mêmes rangs ; le budget partagé — une contribution coûte des pas
que les cellules n'ont plus, et un plafond de deux pas refuse trois entrées ; une chaîne, un booléen,
une séquence, un objet, une absence et un non-fini refusés **avec la catégorie et jamais la valeur** ;
la division par zéro gardant `expression-refused` et ses diagnostics ; la contribution dans une bande
refusée ; un groupe par itération de boucle marquée, aucun pour une boucle vide ; un groupe pour une
condition vraie marquée, aucun pour une fausse ; une frontière par item de groupe de lignes, avec
plusieurs lignes par item et un décalage correct derrière une ligne fixe.

**La politique `keepTogether`** (`engine/src/__tests__/pagination-keep-together.test.ts`, 24 cas).
Les trois branches unitaires, y compris l'égalité stricte au pixel ; puis, pour **chacun** des kinds
mesurables — texte, image, conteneur, tableau — les trois cas : il tient là où il est, il ne tient
que sur une page neuve, il ne tient nulle part. L'image garde son refus
`oversized-atomic-resource` en troisième branche, puisqu'elle ne se coupe pas. Puis les cas
spécifiques : une boucle marquée qui garde chaque itération sans jamais les grouper toutes ; un
groupe de lignes qui garde les lignes d'un item et non de tous ; un parent replié dont l'enfant
marqué reste entier ; une occurrence qui ne se retente pas à chaque page une fois repliée ; une
marque dans une bande qui ne change aucune coupe et garde `page-band-overflow`.

**Les veuves et les orphelines** (`engine/src/__tests__/pagination-widows.test.ts`, 16 cas). Une, deux
et trois lignes : aucune coupure artificielle. Quatre lignes : deux et deux plutôt que trois et une.
Cinq, six et sept lignes sous plusieurs capacités. Le report sur page neuve quand une orpheline
menace ; le repli glouton quand aucune page ne peut satisfaire la préférence ; l'absence de report sur
une page qui ne tient déjà rien d'autre. Puis les invariants d'E2, inchangés : le bloc restitué
caractère pour caractère, chaque run et sa typographie conservés à la couture, une ligne vide et un
marqueur comptés comme des lignes, la préférence appliquée dans une cellule et sous un parent replié.

**Les reports** (`engine/src/__tests__/pagination-reports.test.ts`, 16 cas). Zéro sur la première
page et la somme exacte ensuite ; l'en-tête répété jamais compté ; les valeurs négatives et le zéro ;
une contribution comptée une seule fois sur toute la suite ; l'ordre de sommation épinglé par deux
valeurs IEEE-754 qui diffèrent ; la somme non finie refusée avec la page et sans la valeur ; la ligne
fragmentée comptée à son dernier fragment ; une ligne d'un tableau imbriqué comptée alors que la
ligne qui la porte ne l'est pas encore ; les deux modes d'arrondi écrivant deux valeurs du même
cumul ; une position d'arrondi négative ; l'écriture canonique sans locale ni devise ; l'absence de
report en première page par domaine de bande ; et la non-oscillation, à six chiffres et à huit
décimales près.

### Avec Chromium

La recette de bout en bout vit dans `adapter-puppeteer/src/__tests__/reference-document.test.ts`, sur
les **deux** apparences du document de référence et sur le jeu de soixante lignes.

- exactement **quatre** feuilles A4 à la taille déclarée, pour les deux apparences ;
- soixante lignes de corps, une seule fois chacune, dans l'ordre ;
- l'en-tête de colonnes répété sur les quatre feuilles, et jamais seul ;
- **le report de chaque feuille égal à la somme des montants réellement imprimés sur les feuilles
  précédentes**, arrondi comme le modèle l'a déclaré — l'oracle est *dérivé du PDF*, pas recopié du
  moteur, et il se referme sur le total final que la formule du modèle calcule ;
- le cadre de règlement entier, sur une seule feuille, jamais répété ;
- le cadre de totaux entier ;
- les mentions et les coordonnées de paiement sur la **dernière feuille seulement** — mesuré
  `[0, 0, 0, 1]` ;
- le texte long restitué en entier à travers ses coupures ;
- les deux compteurs ouvrant chaque feuille, et une troisième boîte de marqueur exactement sur les
  trois feuilles qui portent un report ;
- **aucun marqueur rogné** — non pas par une assertion de plus, mais parce que la vérification
  finale refuse tout rendu dont la mesure en rapporte un : la recette qui imprime est la preuve ;
- le document imprimé identique au dernier HTML mesuré.

### La facture de recette

Le modèle du playground gagne exactement ce que le scénario demande, et rien d'autre : un en-tête
`firstOnly` sans report et un en-tête `exceptFirst` qui reprend le même bandeau en ajoutant le
libellé et le marqueur ; `pageReport: { value: lineAmount }` sur la ligne de détail répétée — **la
même formule que la colonne « Montant » imprime**, pas une seconde ; un cadre de totaux et un cadre
de règlement marqués `keepTogether` ; les mentions et les coordonnées de paiement dans la bande
`lastOnly` ; et un texte de conditions assez long pour être coupé par un bord de page.

La duplication du bandeau entre `firstOnly` et `exceptFirst` est le coût qu'un domaine de bande fait
payer, déjà accepté par l'ADR 0006. Il est assumé ici — le bandeau est construit par une fonction du
fichier de fixture et écrit deux fois — plutôt que caché derrière un troisième domaine inventé pour
l'occasion.

---

## La recette visuelle

Les huit feuilles — quatre par apparence — ont été rendues par Chromium à partir du HTML **réellement
remis à l'impression**, puis regardées une par une. Ce que la recette technique prouve par des
sélecteurs, cette relecture le confirme à l'œil, et elle a trouvé une chose que les assertions ne
voyaient pas.

**Ce qui est juste.**

- La première feuille porte le bandeau **sans report**, et les trois suivantes le portent **avec** :
  `Brought forward 898.25` sur la deuxième feuille encadrée, `2900.75` sur la quatrième, `2030.25`
  sur la troisième de l'apparence sans cadre. La valeur de la deuxième feuille a été **recalculée à
  la main** depuis les dix-huit montants imprimés sur la première : 898,25 exactement.
- L'écriture est bien **canonique** : ni séparateur de milliers, ni symbole, ni zéro de queue —
  `2900.75` et non « 2 900,75 € ». C'est la frontière avec E4, visible à l'œil sur le document.
- Le report est aligné à droite en fin de ligne, donc la réserve de vingt-cinq glyphes **ne laisse
  aucun blanc visible** : c'est le placement que le plan recommandait, et il tient.
- L'en-tête de colonnes est répété sur les quatre feuilles, jamais seul, jamais doublé.
- Le cadre de règlement est **fermé** et entier sur la dernière feuille : ses quatre filets sont là,
  aucun bord n'est ouvert derrière une coupure.
- La ligne de totaux — `Net 3305 less 247.88 leaves 3057.12` — est entière, sur une seule feuille.
- Les mentions et les coordonnées de paiement ne paraissent **que** sur la quatrième feuille.
- La numérotation lit « Page 1 / 4 » à « Page 4 / 4 », et les deux apparences se coupent aux mêmes
  lignes : la structure est bien une fonction du modèle et non de son habillage.
- Aucune ligne isolée en tête ou en pied de feuille, aucun chiffre tronqué, aucun marqueur rogné.

**Ce que la relecture a trouvé, et qui a changé un test.** Sur le jeu de soixante lignes, le texte
de conditions **n'est pas coupé** : il tient entier sur la dernière feuille. Le test Chromium qui
s'appelait « leaves at least two visual lines on each side of a seam it cuts the terms at »
n'observait donc aucune couture, et n'aurait rien vu si la préférence 2/2 avait disparu. Il portait
un nom que son corps ne tenait pas.

Il a été réécrit pour dire ce qu'il établit vraiment — la **restitution** du texte long à travers
ses fragments, quel que soit l'endroit où ils tombent — et la raison est écrite dedans : le HTML
transporte des runs et non des lignes visuelles, donc le compte de part et d'autre d'une couture
n'est pas observable depuis là. Ce compte est prouvé là où les lignes existent : dans la matrice de
veuves et orphelines d'`engine`, sur la grille mesurée, une à sept lignes sous plusieurs capacités.

C'est conforme à ce que le plan demandait — sa liste d'oracles Chromium ne contenait aucune
assertion 2/2 — mais le nom du test le laissait croire, et un nom qui promet plus que son corps est
exactement ce qu'une recette ne doit pas produire.

**Ce qui reste laid sans être faux.** Les colonnes « Amount » et « Note » se touchent : la fixture
lit `12.5less 2`, et sur l'apparence sans cadre l'en-tête lit `AmountNote`. C'est une largeur de
colonne de la fixture d'E2, antérieure à ce lot et inchangée par lui ; ce n'est ni un défaut du
moteur ni une régression, et le corriger appartient à qui écrit le modèle.

---

## Les preuves d'ablation

Vingt-deux mutations, appliquées une par une par un script : la substitution est écrite dans la
source, les tests nommés sont lancés, le fichier est restauré. Une mutation qui laisse la suite
verte est un **trou dans la suite**, pas un test qui passe.

| Mutation | Preuve obtenue |
| :--- | :--- |
| ne pas incrémenter le schéma | 🔴 la compatibilité détecte la perte silencieuse |
| retirer `report` de l'union de schéma | 🔴 la fixture v9 et le round-trip échouent |
| ne pas collecter `pageReport.value` | 🔴 le catalogue de chemins perd la donnée externe |
| évaluer une contribution dans la portée racine | 🔴 le groupe répété rend les mauvais montants |
| accepter une valeur non finie comme contribution | 🔴 les six refus typés disparaissent |
| laisser passer une contribution dans une bande | 🔴 le refus de région disparaît |
| aplatir une boucle marquée | 🔴 deux enfants d'une itération sont séparés |
| faire commencer chaque item d'un groupe à la même ligne | 🔴 les frontières par item disparaissent |
| sommer dans l'ordre du parcours | 🔴 la somme diverge sur le cas imbriqué |
| compter une ligne sur son fragment `first` | 🔴 la ligne surdimensionnée apparaît trop tôt |
| compter aussi l'en-tête répété | 🔴 le garde du collecteur ne filtre plus |
| ne pas arrondir le cumul | 🔴 les deux modes rendent la même écriture |
| réserver la largeur des chiffres pour un report | 🔴 la réserve du report tombe à celle d'un compteur |
| ignorer `clippedMarkerCount` | 🔴 un document volontairement rogné passe la vérification |
| ignorer `keepTogether` dans l'espace courant | 🔴 un bloc est inutilement déplacé |
| ne pas essayer la page neuve | 🔴 un bloc satisfaisable est coupé |
| ne pas replier un bloc surdimensionné | 🔴 le bloc n'atteint plus deux pages |
| perdre une marque descendante au repli du parent | 🔴 la ligne de total marquée se coupe |
| ne pas garder les lignes d'un groupe marqué | 🔴 l'item est coupé au bord de page |
| supprimer le minimum de deux lignes sous la coupure | 🔴 une orpheline apparaît |
| supprimer le minimum de deux lignes au-dessus | 🔴 une veuve apparaît |
| refuser quand 2/2 est impossible | 🔴 le cas de repli ne termine plus en succès |

### Trois mutations ont d'abord SURVÉCU, et c'est le résultat le plus utile du lot

Les passes successives en ont laissé trois vertes. Les trois tests concernés passaient, portaient le
bon nom, et n'assuraient pas ce que ce nom promettait.

**« sommer dans l'ordre du parcours ».** Le test épinglait bien deux valeurs IEEE-754 distinctes,
mais son scénario ne pouvait pas les faire diverger : sur une simple répétition de lignes, l'ordre de
collecte **est** l'ordre de matérialisation, donc retirer le tri ne changeait rien. Il fallait une
occurrence matérialisée **tôt** et achevée **tard** — une ligne externe dont la cellule porte un
tableau plus haut qu'une page : elle est rangée avant les lignes internes qu'elle contient, et
pourtant elle s'achève après elles. L'ordre de collecte devient `1, 2, 0, 3, 4`, il est épinglé tel
quel, et les deux ordres rendent alors `10000000000000000` et `10000000000000004` — deux unités du
dernier bit d'écart, ce qui suffit à faire rougir le test.

**« compter aussi l'en-tête répété ».** Ici la mutation était **équivalente par le contrat** : le
schéma refusant déjà un `pageReport` sur une ligne d'en-tête ([D-1](#d-1--le-modèle-désigne-une-contribution-de-ligne--le-moteur-décide-la-frontière-de-page)),
aucun document ne pouvait atteindre le garde du collecteur. Un scénario ne pouvait donc pas le
prouver. Le garde est désormais testé **directement** : le fragment est construit à la main, avec un
en-tête contributeur qu'aucun modèle ne peut écrire, et le collecteur doit l'ignorer quand même.

**« refuser quand 2/2 est impossible ».** Le test visait bien le repli glouton, mais son scénario
donnait au reste de page et à une page neuve **la même** hauteur. La fonction sort alors sur le garde
précédent — « déjà sur une page qui ne tient rien d'autre » — et la ligne mutée n'était jamais
atteinte. Le cas qui l'atteint demande un reste de page **strictement plus petit** qu'une page neuve,
et une page neuve **quand même trop courte** pour deux lignes : une demi-ligne de marge suffit à
produire cette disposition, et elle est désormais épinglée pour six et pour huit lignes.

C'est exactement ce que le tableau d'ablations existe pour trouver, et c'est la raison pour laquelle
il est rejoué plutôt que raisonné. Les trois trous partageaient une même forme : **un scénario qui
n'atteint pas la branche que son nom décrit**. Aucun ne se voyait à la couverture, qui les comptait
tous les trois comme parcourus.

### Une mutation qui rougit en bouclant ne prouve rien

Une vingt-troisième substitution avait d'abord été écrite : donner à une occurrence de groupe un
`rowCount` de `Number.MAX_SAFE_INTEGER`. Elle « rougissait », mais par **expiration de délai** — la
somme des hauteurs du groupe boucle alors neuf mille milliards de fois. Un test tué par un
`timeout` n'atteste aucune assertion : la mutation a été remplacée par celle du tableau ci-dessus,
qui fait commencer chaque item à la ligne zéro et **termine**, donc redonne un verdict lisible.

### Ce que les ablations ne couvrent pas

Trois mutations du plan n'ont pas de substitution mécanique honnête et restent à la revue : compter
une évaluation par page plutôt que par occurrence (le compteur d'évaluations n'existe pas comme
valeur observable), réserver un nom de donnée dans le moteur (un balayage `grep` du périmètre le
couvre déjà), et omettre un `await` de mesure, d'impression ou de fermeture (les tests de cycle de
vie de l'adaptateur le couvrent, mais la mutation ne se réduit pas à une chaîne).

---

## Conséquences

**Ce que le lot rend possible.** Un modèle peut désigner ce que chaque ligne apporte au report,
placer ce report où il veut et à l'arrondi qu'il déclare, demander qu'un cadre reste entier, et
réserver ses mentions à la dernière feuille. Aucune de ces quatre capacités n'exige que
l'intégrateur nomme un champ comme Openview l'a décidé.

**Ce que le lot coûte.** Une estampille de plus, donc une migration de plus dans la chaîne. Un
troisième `pageField`, donc un `switch` de peinture à garder exhaustif. Deux modules neufs dans
`pagination/`, tous deux petits et tous deux appelés depuis deux sites. Une observation de plus dans
le contrat de mesure, donc un adaptateur qui doit la fournir. Et une réserve de marqueur de report
large de vingt-cinq glyphes, qui laisse du blanc quand le report est court — c'est le prix d'une
géométrie indépendante de la valeur, et la facture de référence le rend naturel en alignant le
marqueur à droite.

**Ce que le lot ne change pas.** `RenderPort`, `RenderRequest` et `RenderResult` sont identiques.
`createPdfRenderPort()` a la même signature. Les factures courtes d'E1 tiennent toujours sur une
page, la facture E2 non enrichie garde sa pagination et sa numérotation, et aucune stratégie
n'importe Puppeteer dans `engine`.

**La dette que le lot n'a pas créée.** Aucune règle de gouvernance amendée, aucune dépendance
ajoutée, aucun seuil de couverture touché, aucun `biome-ignore`, aucun `!`, aucun cast.

---

## Ce que l'exécution a corrigé du plan

Sept points. Le plan n'est plus une consigne : c'est cette ADR qui fait foi.

### C-1 — La borne de vingt-cinq caractères est exacte, pas généreuse

Le plan écrivait que l'écriture canonique d'un `number` fini « tient dans 25 caractères » et
présentait cette valeur comme un majorant confortable. Elle est **atteinte** :
`-0.0000012345678901234567` fait exactement vingt-cinq caractères — signe, `0.`, les cinq zéros que
la notation décimale accepte encore avant de basculer en exponentielle, et dix-sept chiffres
significatifs. Un balayage de trois millions de doubles a produit la même longueur.

Conséquence pratique : **la borne ne peut pas être réduite**, et le commentaire qui la porte le dit
plutôt que de laisser croire à une marge. La garde de rognage de [D-13](#d-13--un-marqueur-rogné-est-un-refus-mesuré-jamais-un-chiffre-coupé)
existe précisément parce qu'une borne exacte ne pardonne rien.

### C-2 — Le refus d'un marqueur inconnu change de code, et gagne une phrase

Discriminer deux fois — sur `kind`, puis sur le champ nommé — a un coût que le plan n'avait pas vu :
un `field` hors liste ne correspond plus à aucun membre de l'union, donc Zod rend `invalid_union`
« No matching discriminator » et non `invalid_value`. Le diagnostic public passe de `invalid-value` à
`invalid-structure` et **perd son `acceptedValues`**. C'est le seul recul du lot, et il touche un des
dix exemples de recette de l'[ADR 0010](0010-un-refus-comprehensible.md).

Il est compensé sur les deux plans. Le schéma écrit désormais **sa propre phrase** —

> A page marker names one of "number", "count" or "report". A report also declares the rounding it
> is written at.

— et `from-zod.ts` honore le message d'une union qui a nommé son discriminant, exactement comme il
honore déjà celui d'une borne ou d'un format. Sans cela, la phrase générique aurait nommé « type »
ou « kind », ce qui est faux ici. L'auteur lit donc **plus** qu'avant ; c'est la machine qui lit
moins, et la liste des marqueurs reste atteignable par `PAGE_FIELDS`, exporté.

Les deux alternatives ont été mesurées avant d'être écartées. Un objet plat avec un `superRefine`
gardait `acceptedValues` mais rendait le type inféré non narrowable, donc obligeait à un cast ou à
la suppression du garde `MutuallyAssignable` — ce que §7 d'`AGENTS.md` interdit. Un `looseObject`
piped dans l'union **compile mais casse à l'exécution** dans un `discriminatedUnion` parent : vérifié,
`TypeError: Cannot read properties of undefined (reading 'kind')`.

### C-3 — Une contribution dans une bande est refusée, cas que le plan ne nommait pas

Le plan disait que le collecteur ne parcourt que le flux racine. Il n'en tirait pas la conséquence :
une bande est un `ContainerNode`, elle peut donc contenir un tableau et une ligne contributrice, et
cette contribution aurait été **évaluée puis silencieusement jetée**. [D-12](#d-12--une-contribution-dans-une-bande-est-refusée-pas-ignorée)
la refuse.

### C-4 — La recette sort sur quatre feuilles, pas trois

Le plan annonçait trois pages pour soixante lignes et prévoyait de calibrer la fixture pour les
obtenir. Deux faits s'y opposent. D'abord, **E2 en produisait déjà quatre** : l'ADR 0013 le dit mot
pour mot, et la roadmap moteur aussi. Ensuite, E3 **ajoute** du contenu au document de référence —
une ligne de report dans le bandeau, un cadre de règlement, un texte de conditions long. Descendre à
trois aurait exigé de réduire la typographie ou les marges, c'est-à-dire de rendre la facture
artificielle, ce que le plan lui-même interdit au même paragraphe.

Quatre feuilles éprouvent **trois** reports entrants au lieu de deux : la recette est strictement
plus forte, pas plus faible. Le nombre a été corrigé dans la roadmap moteur et dans la vue
d'ensemble plutôt que laissé en contradiction.

### C-5 — L'ordre des incréments a changé, pour fermer une fenêtre d'erreur silencieuse

Le plan ordonnait INC-3 (`keepTogether`) et INC-4 (veuves) avant INC-5 (reports). Élargir
`PAGE_FIELDS` à `report` laissait `markerText()` peindre **le nombre de pages** à la place d'un
report — un ternaire, aucune erreur de compilation, aucun test rouge. Cette fenêtre était un état
intermédiaire silencieusement faux.

INC-5 a donc été exécuté juste après INC-2, avec le rendu du marqueur rendu exhaustif dans le même
geste. Les incréments du plan restent une bonne granularité de revue ; leur ordre n'est pas une
contrainte quand le respecter produit un état faux.

### C-6 — Les bornes d'arrondi sont extraites, pas réécrites

Le plan exigeait qu'E3 « ne crée pas une seconde politique de validation » autour de l'arrondi, sans
dire comment. `RoundingPositionSchema` est extrait de `RoundExpressionSchema` et partagé par les
deux sites. Une seconde écriture des mêmes bornes aurait compilé, passé les tests, et été libre de
dériver au premier changement.

### C-7 — Le rang de contribution vit dans la source de clés

Le plan décrivait un rang « remis à zéro par rendu, comme les clés ». Il a été mis **dans** la source
de clés (`KeySource.nextReportOrder()`) plutôt que dans un compteur parallèle enfilé à travers le
contexte, la matérialisation et `extendBands()`. Même durée de vie, même garantie de déterminisme,
et rien de neuf à faire suivre.

---

## Ce qui reste ouvert

**La relecture métier n'a pas eu lieu.** La recette technique et la recette visuelle sont
consignées ; aucun gestionnaire ni comptable n'a relu le PDF. La phrase de la roadmap — « un
utilisateur métier lit une facture paginée et ne relève aucune anomalie » — n'est donc **pas**
démontrée. C'est la séance que la vue d'ensemble prévoit à J3, et elle reste à planifier.

**J3 n'est pas atteint.** E3 livre la pagination comptable ; le jalon exige aussi français/euros
puis anglais/dollars, propriété d'**E4**. La roadmap moteur annonce E3 livré et la vue d'ensemble
laisse J3 ouvert.

**Le contrat de report est volontairement étroit.** Une contribution par ligne de corps, un seul
cumul, entrant. Signal de réouverture : un modèle réel demande deux cumuls indépendants, un report
hors tableau, ou un « à reporter » sortant en bas de page. La réponse sera un lot `core` versionné,
jamais une convention cachée dans `engine`.

**E4 doit reprendre la réserve de marqueur entièrement.** Une écriture localisée emploie des
séparateurs, un symbole et des espaces qui ne sont pas dans l'alphabet canonique, et la borne de
vingt-cinq n'a aucune marge. La garde de rognage reste en place quoi qu'il arrive : une borne fausse
produira un **refus**, pas un chiffre tronqué.

**L'identité d'occurrence et l'observabilité du repli restent à E5.** Les clés, les rangs et les
frontières de groupe de ce lot sont internes à un rendu, et le sont restés délibérément.

**Le déterminisme entre machines reste à E6.** La somme est ordonnée et reproductible dans une
session ; l'égalité de deux machines dépend des fontes, que ce lot ne fige pas.
