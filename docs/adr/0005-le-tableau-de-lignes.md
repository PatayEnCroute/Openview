# ADR 0005 — Le tableau de lignes

- **Statut :** 🟢 **Accepté** (2026-08-17), implémentée dans `@openview/core`
- **Date :** 2026-08-17
- **Impact :** `@openview/core` (AST, estampille 4, site d'erreur `tableRowGroup`),
  `@openview/engine` (E2 et E3 héritent d'une section `header` **nommée** et de la pagination d'un
  tableau imbriqué ; E5 rapportera quelle ligne est tombée sur quelle page),
  `@openview/designer` (D6 éditera colonnes et cellules, D7 la barre de formule d'une cellule),
  `@openview/core` lot C5 (« **Dépend de :** C3 », `core.md:184`)
- **Complète :** [ADR 0004](0004-les-arrondis-declares-par-le-modele.md) — sa **décision 8**
  transmettait la contrainte « le tableau ne somme rien » au lot qui décrirait un tableau ; cette
  ADR l'honore **par le type**. Et [ADR 0002](0002-data-binding-and-loop-scope.md), dont la
  garantie de collecte est étendue à un **quatrième site d'alias**.
- **N'amende aucune règle de gouvernance.** C'est la différence exacte avec l'ADR 0004, qui amendait
  `AGENTS.md` §3.B sous mandat. Le seul point de gouvernance que ce lot soulève est tranché par la
  **décision 7-A** ci-dessous, qui ne demande rien : `AGENTS.md` sort du lot **inchangé**, et le
  contrôle est négatif et rejouable —
  `git diff --exit-code "$(git merge-base origin/main HEAD)" HEAD -- AGENTS.md`, exit 0.
- **Plan d'implémentation :**
  [docs/plans/c3-tableau-de-lignes.md](../plans/c3-tableau-de-lignes.md) — **périmé** une fois le
  lot livré, comme le dit son propre en-tête. C'est cette ADR qui fait foi.
- **Implémentation :**
  [`src/ast/types.ts`](../../packages/core/src/ast/types.ts) (`TABLE_COLUMN_ALIGNMENTS`,
  `TableColumnAlignment`, `MIN_COLUMN_WIDTH`, `MAX_COLUMN_WIDTH`, `TableColumn`, `TableCell`,
  `TableRowNode`, `TableRowGroupNode`, `TableBodyNode`, `TableNode`, `BlockNode`, `BlockNodeType`),
  [`src/ast/schemas.ts`](../../packages/core/src/ast/schemas.ts) (`blockMembers()`, `rowMembers()`,
  les sept schémas neufs et le `superRefine` `checkTableWiring`),
  [`src/ast/visitor.ts`](../../packages/core/src/ast/visitor.ts) (trois `case`, trois branches),
  [`src/template/guard.ts`](../../packages/core/src/template/guard.ts) (`parseBlockNode`),
  [`src/template/template.ts`](../../packages/core/src/template/template.ts) et
  [`src/template/migrate.ts`](../../packages/core/src/template/migrate.ts) (l'estampille 4 et sa
  migration)

---

## Contexte

Avant ce lot, la **répétition** existait — `LoopNode` répète ses enfants — et la notion de
**tableau** n'existait pas. Un auteur qui voulait une facture écrivait une ligne comme **un seul
nœud texte** dont les segments miment des colonnes : rien ne disait qu'il y avait des colonnes,
aucune largeur, aucun alignement, et l'en-tête n'existait nulle part. Le playground le faisait
exactement ainsi (`line-label`), et c'est cette maquette que le lot fait disparaître.

L'écart était structurel plutôt que cosmétique. Un moteur de pagination (E2) ne pouvait pas savoir
quelle ligne répéter en haut d'une page, parce qu'aucun champ ne disait « ceci est un en-tête ».
Un éditeur (D6) ne pouvait pas proposer d'insérer une colonne, parce qu'il n'y avait pas de colonne.
Et C5, qui « **Dépend de :** C3 », attendait un objet auquel accrocher une apparence.

**Ce que le lot ne fait pas, et c'est la moitié de la décision.** Il n'introduit aucune règle
métier. Le tableau ne somme rien, ne formate rien, ne trie rien, ne pagine rien et ne réserve aucun
nom. Il **décrit** — et la brique le dit d'elle-même : « elle décrit, elle ne produit rien »
(`core.md:271-274`).

---

## Le critère d'appartenance, écrit AVANT la liste des champs

Cette section vient en premier délibérément. Une liste de champs sans critère est une liste qui
grossira : chaque demande sera examinée pour elle-même, et chacune paraîtra raisonnable.

> Une déclaration entre dans le nœud tableau ou dans une colonne **si et seulement si** :
> 1. elle est **partagée** par les N cellules de cette colonne ;
> 2. elle est **inexprimable hors d'une colonne** — supprimez la notion de colonne, et l'attribut
>    n'a plus de site où s'écrire ;
> 3. elle ne peut changer ni un `compare`, ni un `sum`, ni un `dateAdd` ;
> 4. elle n'oblige l'intégrateur à nommer aucun champ de ses données.

L'identité et la largeur passent les quatre. Une police, un filet, un fond, un espacement échouent
à la **deuxième** — ils s'écrivent sur n'importe quel bloc, et C5 les y définit. Un format de
nombre, un séparateur, un symbole monétaire, une échelle d'affichage y échouent aussi : ils sont à
C6. Un total, un sous-total, un opérateur d'agrégation échouent à la **troisième**. Un en-tête
déduit d'une clé de données, des colonnes déduites des clés, un alignement déduit du type de la
valeur échouent à la **quatrième**.

> ⚠️ **La condition (2) a d'abord été écrite faux, et la correction est instructive.** Elle
> s'énonçait « **elle cesse d'exister avec la structure** ». **Contre-exemple immédiat :** une
> hypothétique `TableColumn.font` cesserait d'exister avec la colonne exactement comme `width`. La
> condition était donc vraie de **tout** attribut posé sur une colonne — elle n'excluait rien de ce
> qu'on lui demandait d'exclure. Un critère qui absout tout ce qu'on lui présente n'est pas un
> critère. La reformulation retenue est le test d'**inexprimabilité**.
>
> **Et il faut dire qu'`align` échoue au test reformulé.** Il n'est retenu ni par le critère ni par
> un goût, mais par **deux arguments mécaniques** : la roadmap écrit « un alignement **par
> colonne** » sous le lot C3 (`core.md:153-154`), et C5 lit « **Dépend de :** C3 »
> (`core.md:184`) — une propriété dont le critère de recette de C3 a besoin ne peut pas vivre dans
> le lot qui vient après lui. **C'est une exception nommée**, et elle est écrite comme telle plutôt
> que dissimulée dans une lecture large du critère.

---

## Les treize décisions

### D1 — Le critère d'appartenance précède la liste des champs

**Décision.** Le critère ci-dessus, appliqué aux treize déclarations candidates que le lot a
examinées. Douze sont tranchées par le critère seul ; la treizième, `align`, est l'exception nommée.

**Écarté.** Reprendre tel quel le test de l'ADR 0004 décision 10 — « si une déclaration ne peut
changer que ce qu'un lecteur voit, elle est C6 » : il trie l'apparence du calcul, il ne trie pas ce
qui appartient à une **colonne** plutôt qu'à un **bloc**, et c'est cette seconde frontière que C3
doit tenir.

**Réversible** — mais rouvrir le critère rouvre les treize lignes qu'il tranche, dont douze qu'il
tranche à lui seul.

### D2 — Trois types de nœud, et une seconde union `BlockNode`

**Décision.** `DocumentNode` s'élargit de `TableNode`, `TableRowGroupNode` et `TableRowNode` —
**huit** types de nœud. Une **seconde** union, `BlockNode`, dit ce qu'un **flux de blocs** accepte :
les enfants d'un conteneur, d'une boucle, d'une condition, d'une cellule, et la racine d'un modèle.
`DocumentNode = BlockNode | TableRowNode | TableRowGroupNode`.

**Pourquoi la coupure.** Une ligne et un groupe **sont** des nœuds de document — ils ont un id, ils
sont parcourus, ils déclarent ce qu'ils lisent — mais ils ne veulent **rien dire hors d'un
tableau**. Scinder l'union est la manière de le dire au compilateur **et** à Zod d'un seul geste,
sans passe de validation sémantique et sans refus à écrire : une `tableRow` égarée sous un
conteneur n'a simplement aucun membre à apparier. **Mesuré** — une ligne nue glissée dans
`root.children` est refusée sur `root.children.2.type` / « No matching discriminator », ce qui est
le bon endroit, le flux de blocs, et non « quelque part dans un tableau ».

`BlockNodeType` est nommé pour que `DocumentNodeType` cesse de se présenter au Registry : après C3
ce dernier vaut huit membres dont `tableRow`, et un Registry de blocs qui validerait contre lui
**accepterait une ligne là où le schéma la refuse**.

**Écarté.** (a) Un seul type `table` portant colonnes et cellules à plat : le corps perd sa
répétition déclarée. (b) Ne pas scinder l'union : une `tableRow` nue devient représentable dans un
flux de blocs, et il faut une passe sémantique pour la refuser — exactement ce que l'ADR 0002 D2 a
refusé.

**Réversible dans un seul sens** : le flux de blocs peut se réélargir, les trois nœuds ne se
retirent plus.

### D3 — La cellule NOMME sa colonne

**Décision.** `TableCell { columnId, children }`. L'appariement colonne ↔ cellule est **par clé**,
jamais par position. Une **ligne courte** est licite ; une **cellule orpheline** est refusée au
save time, sur le nœud tableau qui voit les deux côtés.

**Pourquoi.** Ce seul choix règle trois choses à la fois. Une ligne qui ne remplit que certaines
colonnes est une **forme naturelle** plutôt qu'une suite de remplissages — et la dernière ligne
d'une facture, un libellé et un montant, est exactement cette forme. Réordonner les colonnes est
**une** édition de tableau au lieu d'une permutation par ligne, toutes devant s'accorder. Et aucun
parcours n'indexe un tableau avec l'index d'un autre, ce qui sous `noUncheckedIndexedAccess`
rendrait `T | undefined` à **chaque** appariement, avec `!` interdit pour le déréférencer.

**L'asymétrie des deux fautes est délibérée.** Une ligne qui remplit **moins** de colonnes est
légale. Une cellule nommant une colonne inexistante est refusée : c'est du contenu qui ne serait
**jamais affiché**, donc une **perte silencieuse** — la classe de défaut contre laquelle toute la
doctrine de versionnement de ce paquet existe. Deux cellules pour une colonne dans une ligne sont
refusées pour la même raison : la seconde serait perdue.

**Le garde `declared.size === 0` de `checkTableWiring` reste, et il a failli être supprimé.** La
revue de contradiction l'avait classé « code mort à supprimer » au motif que « *Zod n'exécute pas le
`superRefine` tant que le parse de base a échoué* ». **Cet énoncé est faux, et la mesure qui le
portait avait été prise contre un build qui contenait encore le garde.** Zod 4 ne saute un
`superRefine` que sur une issue **abandonnante** — `invalid_type`, `invalid_value`,
`invalid_union` ; les issues **continuables** — `too_small`, `too_big`, `custom` — le laissent
tourner. `columns.min(1)` rend un `too_small`, donc **il n'arrête rien**. **Rejeu décisif :** le
`dist` compilé a été dupliqué, les quatre lignes du garde retirées de la copie, rien d'autre
changé — sur un tableau sans colonne portant douze cellules, le résultat est **1 issue avec le
garde et 13 sans**. C'est **le seul renversement du lot**, et il vaut d'être écrit : ce qu'on
croyait impossible à couvrir est le seul `it` qui protège la lisibilité des refus de C3.

**Écarté.** L'appariement positionnel : il exige des cellules de remplissage vides pour une ligne
de total, et il produit un `T | undefined` à chaque appariement.

**Irréversible.**

### D4 — L'en-tête est une SECTION DE LIGNES ; une colonne ne porte aucun libellé

**Décision.** `TableNode.header: readonly TableRowNode[]`. Un intitulé de colonne est le contenu
d'une cellule d'une ligne d'en-tête, comme n'importe quel autre contenu.

**Pourquoi.** Un `label: string` sur la colonne donnerait à C6 une **seconde position de contenu à
traduire** à côté de `TextNode.content`, et le remplacer plus tard serait une migration
transformante sur tous les modèles écrits entre-temps. Le critère de recette dit « **en-tête
compris** » : il ne demande pas qu'on puisse *afficher* des intitulés — un `TextNode` au-dessus du
tableau en afficherait — mais qu'ils soient **dans** le tableau et **identifiés comme tels**, faute
de quoi E2 devrait deviner quelle ligne répéter.

**Écarté.** `TableColumn.header: readonly TextSegment[]` : plus compact, et il crée la position de
contenu que le paragraphe ci-dessus refuse.

**Réversible dans un seul sens** : un libellé de colonne peut s'ajouter plus tard, en surcharge.

### D5 — Une cellule contient des BLOCS, pas des segments

**Décision.** `TableCell.children: readonly BlockNode[]`. Une cellule peut donc contenir un
paragraphe, deux paragraphes, une image, une condition, une boucle imbriquée — et un tableau
imbriqué, qui **n'est pas refusé**.

**Pourquoi, et c'est un argument de RÉVERSIBILITÉ et non d'expressivité.** `readonly TextSegment[]`
est le seul point de ce contrat où un revirement coûterait une migration **transformante** :
envelopper les segments de chaque cellule dans un nœud texte doté d'un id **inventé**. Et la
première demande sera un logo, un picto ou un QR code dans une cellule. Le choix rend en prime le
libellé d'en-tête un `TextNode` ordinaire, donc **zéro position de contenu nouvelle** pour C6.

Refuser le tableau imbriqué serait une clôture avec un portillon : un `container` placé dans la
cellule en porterait un de toute façon. Ce qui borne l'imbrication est `assertBoundedShape`, qui la
borne déjà et répond `too-deep` — un refus **typé** que C8 saura raconter. **Mesuré : neuf tableaux
imbriqués sont acceptés, le dixième est refusé.**

**Ce que la décision accepte, et par écrit :** E2 hérite de la pagination d'un tableau imbriqué.
C'est le seul coût que le lot transfère à un lot non écrit.

**Réversible** — et c'est le motif de la décision, non son accident.

### D6 — La largeur est un POIDS entier, borné à `[1, 1000]`

**Décision.** `TableColumn.width: number`, **entier**, `MIN_COLUMN_WIDTH = 1`,
`MAX_COLUMN_WIDTH = 1000`. Une colonne de poids 3 à côté d'une de poids 1 est trois fois plus
large. **La largeur du tableau lui-même n'est déclarée nulle part par C3.**

**Pourquoi un entier borné : la borne est LOAD-BEARING.** La somme des poids d'un tableau est
**exacte** en binary64 et la part d'une colonne est **une** division correctement arrondie — le
même nombre dans l'aperçu et dans le PDF, sur tout moteur conforme. C'est ce que la décision
produit 7 promet, et ce qu'un poids flottant ne pourrait qu'approcher. Sans borne haute, la preuve
tombe et la part redevient un **accord entre deux implémentations**.

> ⚠️ **La preuve publiée a été fausse trois fois dans la même phrase, et elle est reconstruite sur
> la borne qui existe vraiment.** L'énoncé retiré : « *`assertBoundedShape` caps a stored template
> at `maxNodes` values, so a table carries at most 100 000 columns* ». Trois erreurs : `maxNodes`
> est un **défaut surchargeable** et non une borne de contrat ; le garde compte des **valeurs** et
> non des colonnes (**mesuré par bissection : 24 998 colonnes acceptées sous le défaut, la 24 999ᵉ
> refusée**) ; et `TableNodeSchema.parse` n'applique **aucun** garde. **Le chiffre « 100 000
> colonnes » est supprimé partout.**
>
> **La preuve de remplacement, et elle ne dépend d'aucun défaut :** `limitSchema` plafonne
> `maxNodes` à `LIMIT_HARD_CEILING = 1e9`, une colonne `{ id, width, align }` pèse **quatre**
> valeurs, donc au plus 2,5·10⁸ colonnes et Σ ≤ 2,5·10¹¹ < 2⁵³. **Hors du garde** — et
> `TableNodeSchema.parse` ne le passe pas — la longueur maximale d'un tableau JavaScript,
> `2**32 - 1`, borne Σ à 4,3·10¹² < 2⁵³. La somme est exacte dans tous les cas représentables,
> quelle que soit la valeur de `DEFAULT_SHAPE_LIMITS` le jour où on lit ceci. **Sans cette note, un
> relèvement de `DEFAULT_SHAPE_LIMITS` par E8 aurait l'air d'invalider la preuve.**

> ⚠️ **Un second énoncé retiré : la largeur était adossée à la page.** La docstring disait qu'une
> part valait « *`width / (sum of the widths of its table)` **of the width the page leaves
> available*** ». La seconde moitié décrète qu'un tableau occupe **toute** la largeur utile — une
> règle d'apparence (C5) appuyée sur une géométrie de feuille (C4), et C3 ne possède ni l'une ni
> l'autre. Le rapport inter-colonnes suffit, et **la preuve d'exactitude est intégralement
> préservée : elle ne porte que sur le rapport.**

**Écarté.** (a) Un poids **réel** : Σ dépend de l'ordre de sommation, la part cesse d'être une
propriété du contrat. (b) Des **millimètres** : la géométrie de la feuille est à C4, et le
positionnement libre au millimètre est hors périmètre v1. (c) Un **pourcentage** : il ne se comporte
que si les valeurs somment à cent — donc soit le contrat police cette somme, soit ajouter une
sixième colonne invalide les cinq autres. (d) `auto` : une largeur mesurée sur le contenu exige des
**métriques de police**, c'est-à-dire une lecture de la machine.

**Réversible dans le sens de l'élargissement uniquement.** *Signal de réouverture :* une demande
citant un rapport plus fin que 1:1 000, ou un gabarit préimprimé imposant une largeur physique —
auquel cas c'est **l'unité** qu'il faut rouvrir, pas la borne.

### D7 — L'alignement est `start | center | end`, par colonne, et il appartient à C3

**Décision.** `TABLE_COLUMN_ALIGNMENTS = ['start', 'center', 'end'] as const`, une valeur par
colonne, héritée par ses cellules. Trois membres et **pas** de `justify` : la justification étire
l'espace inter-mots, c'est de la typographie, et la typographie est C5.

**Pourquoi `start`/`end` et non `left`/`right` : C3 ne résout rien, il DIFFÈRE.** Une colonne qui
stocke `left` a déjà décidé la direction d'écriture de **toutes** les langues dans lesquelles le
modèle sera un jour rendu. Là où la direction est gauche-droite, `start` **est** `left` : le choix
ne coûte rien aujourd'hui, et il évite un revirement qui serait à la fois **transformant** —
réécrire une valeur stockée dans tous les modèles — et **sémantiquement indécidable** : d'un `left`
stocké, personne ne peut dire si l'auteur voulait « gauche » ou « début ».

> ⚠️ **Le motif initialement écrit prêtait à C6 une compétence qu'aucun texte ne lui donne.**
> Énoncé retiré : « *the reason is lot C6 rather than taste* » et « *resolution belongs to whoever
> knows the direction* ». **MESURÉ** — la sonde RTL, dans sa forme canonique et **scopée**, ne rend
> **aucune occurrence** :
>
> ```bash
> git grep -niE 'rtl|droite à gauche|right-to-left|direction d.écriture|writing direction|bidi' -- docs packages README.md ARCHITECTURE.md AGENTS.md ':!docs/plans/*'
> ```
>
> Et le périmètre de C6 (`core.md:186-196`) énumère montants, dates, séparateurs, symbole monétaire
> et libellés fixes — **pas** la direction. **Les deux défauts de la sonde initiale sont recopiés
> ici exprès**, parce qu'une sonde dont on ne sait pas pourquoi elle est scopée sera « simplifiée »
> au premier ménage : écrite `grep -rni` sans `-E`, elle cherchait une **chaîne littérale** et non
> six alternatives ; et elle est **auto-falsifiante** une fois le plan commité — la forme non scopée
> rend **18** occurrences, toutes dans ce seul fichier.

**Pourquoi dans C3 et pas dans C5.** Deux arguments mécaniques, et c'est l'exception nommée de D1 :
le libellé du lot dit « un alignement par colonne » (`core.md:153-154`), et C5 dépend de C3
(`core.md:184`). Une propriété dont le critère de recette de C3 a besoin ne peut pas vivre dans le
lot qui vient après. Si C5 décide d'une surcharge par cellule, il l'ajoutera **en surcharge**, sans
toucher au champ de colonne.

**Écarté.** (a) `left | center | right` : voir ci-dessus ; la lisibilité invoquée est un problème
d'**étiquette dans l'éditeur**, pas de contrat. (b) Tout l'alignement à C5 : contredit le libellé du
lot et la chaîne de dépendances. (c) L'alignement de colonne **et** la surcharge par cellule dès
maintenant : écrit un champ optionnel **à la place de C5**, et le retirer plus tard exigerait une
migration transformante.

**Réversible dans le sens de l'élargissement du jeu de valeurs uniquement.** *Signal de
réouverture :* le RTL déclaré hors périmètre à jamais.

**Ce que la décision NE fait PAS :** désigner un destinataire de la résolution différée. La question
part dans « Ce qui reste ouvert », **sans recommandation**.

### D8 — La répétition vit sur `tableRowGroup` : quatrième site d'alias

**Décision.** `TableRowGroupNode { each: Expression; as: string; rows: readonly TableRowNode[] }`,
avec **au moins une** ligne. `TableBodyNode = TableRowNode | TableRowGroupNode`, et le corps accepte
les deux, dans l'ordre du flux.

**Pourquoi la répétition n'est pas sur le tableau.** `NodeReads` a exactement **deux** cases — les
expressions lues dans la portée **englobante**, et les enfants pour lesquels l'alias est en portée —
et pas de troisième. Un nœud ne peut donc pas à la fois lire une liste **et** porter l'en-tête qui
ne doit pas la voir. Lier sur le tableau mettrait l'alias de ligne en portée pour l'en-tête **et**
le pied : un intitulé ou un total qui le mentionnerait serait traité comme une référence interne, et
`collectDataPaths` **cesserait en silence de réclamer à l'intégrateur une clé que le document lit
réellement** — le défaut exact que l'ADR 0002 a corrigé pour les boucles.

**Pourquoi pas un simple `LoopNode`.** Une boucle répète des `BlockNode`, et une ligne n'est pas un
bloc. La forme est par ailleurs celle que le dépôt écrit déjà **deux fois**, `each`/`as` contre
`source`/`as` sur une agrégation : le Designer réutilise le widget de boucle, et l'évaluation
réutilise `evaluateSequence` et `childScope` **inchangés** — pas de seconde primitive de portée,
pas de nom réservé, **aucun mécanisme de masquage nouveau**.

**C'est en échange un QUATRIÈME site où un alias peut masquer une clé d'appelant, et la docstring
de `collectDataPaths` le dit** plutôt que de promettre autrement — l'omettre referait exactement ce
que l'ADR 0002 reproche à l'ancienne docstring : *elle promet, elle ment.* Ce que le site ne fait
**pas**, c'est élargir le trou : un groupe lie sur ses propres lignes et sur rien d'autre.

**Mesuré sur le modèle de recette.** `collectDataPaths` rend exactement
`['facture.numero', 'facture.lignes']`, alors que le modèle écrit **huit** lectures enracinées sur
`ligne` — six dans les cellules du corps, **deux** dans le pied sous l'agrégat. **Deux mécanismes
distincts les filtrent**, et il faut les nommer séparément : les six du corps parce que
`nodeReads(group)` déclare `binds: 'ligne'`, les deux du pied parce que `pathsOf` porte son
**propre** contexte d'alias. Si l'un tombait, l'autre ne rattraperait rien — c'est pour cela que le
pied du modèle de recette lit l'alias, et non seulement le corps.

**La contre-épreuve, qui est le vrai test :** un alias de groupe employé **hors** de son groupe
**redevient une clé d'appelant** — mesuré, `['facture.lignes', 'ligne.montant']`.

**Écarté.** `TableNode.each` / `TableNode.as` : l'alias fuit sur l'en-tête et le pied.

**Réversible dans un seul sens** : la porte ouverte est l'ajout.

### D9 — Le pied ne contient aucune agrégation : le TYPE dit que le tableau ne somme rien

**Décision.** `TableNode.footer: readonly TableRowNode[]`. Aucun `TableRowGroupNode` dans le pied,
et **surtout aucun champ d'agrégation** : il n'y a nulle part sur ce nœud où en poser un.

**Pourquoi, et le motif a été réécrit.** Le pied ne se justifie **pas** par « le moteur ne saurait
pas qu'elle doit rester en fin de flux » — c'est de la **pagination**, elle appartient à E2, et le
lot la refuse nommément. Il se justifie par la seule raison qui appartienne à C3 : **c'est la
section dont le TYPE interdit d'agréger.** Un tableau ne peut donc pas sommer ses propres colonnes,
et la dernière ligne d'une facture est ce que la roadmap dit qu'elle est — une **EXPRESSION DU
MODÈLE**, `round(sum(...), d, m)`, écrite par l'auteur et **debout dans l'arbre**, là où un
relecteur, la barre de formule de D7 et un refus peuvent tous la désigner. Un total calculé par la
structure arrondirait **hors de l'arbre**, où aucun relecteur ne regarde : ADR 0004 décision 8.

> ⚠️ **Le pied n'est pas « fixe », il est sans répétition de LIGNES, et la nuance est mesurée.**
> Énoncé retiré : « *`footer` holds fixed rows only: no `each`, no alias, nowhere to put one* ».
> D5 le rend faux — une cellule contient des `BlockNode[]`, et `LoopNode ∈ BlockNode`. **MESURÉ :**
> un `footer` dont une cellule porte un `loop` avec son `each` et son `as` **parse**. **Le refus
> structurel porte sur le CHAMP**, pas sur la présence d'expressions ou d'alias dans le pied.

> ⚠️ **Et le refus n'a pas la même force des deux côtés — le dire est ce qui empêche de croire le
> contrat mieux gardé qu'il ne l'est.** **Sur le pied, c'est le TYPE :**
> `footer: readonly TableRowNode[]` n'a littéralement nulle part où poser un agrégat, et aucun champ
> optionnel ne contourne cela. **Sur `TableColumn`, c'est la doctrine plus un grep :** rien dans le
> type n'empêche d'ajouter un `total?: AggregateOperator`, et l'assertion `Object.keys` du test ne
> mord que sur un champ **requis** — un `total?:` optionnel, précisément la forme qu'on choisirait
> pour éviter une migration, laisse le test **vert**. Annoncer le second comme du type serait
> exactement la « règle non outillée » qu'`AGENTS.md` nomme.

**Écarté.** `TableColumn.total?: AggregateOperator` : arrondi implicite hors de l'arbre.

**Irréversible au sens fort** pour le refus de l'auto-somme.

### D10 — Zéro code d'erreur nouveau ; un SITE `tableRowGroup`, et son libellé dans le même commit

**Décision.** `OPERAND_ERROR_CODES`, `LIMIT_ERROR_CODES` et `SHAPE_ERROR_CODES` sont **inchangés** :
`EXPRESSION_ERROR_CODES` reste à **treize** entrées, et C8 n'hérite d'**aucun message neuf à
écrire**. `ExpressionErrorSite` devient `ExpressionKind | 'loop' | 'condition' | 'tableRowGroup'`,
et `LIST_CALLER_SUBJECTS` gagne `tableRowGroup: 'A table body'` **dans le même commit**.

**Pourquoi zéro code : un tableau ne calcule rien, il dispose.** Onze fautes sont possibles dans la
déclaration d'un tableau, et les onze sont décidables **sans données** — donc refusées par Zod au
save time. C'est le meilleur résultat qu'un lot puisse offrir à C8 : non pas un message de plus,
mais **un état de moins**. La cellule orpheline n'a pas besoin d'un `unknown-column` parce qu'elle
est refusée avant d'exister.

**Pourquoi un site n'est pas un code.** Le `code` dit **ce qui est faux** : catalogue **fermé**,
exporté en tuple parce que C8 doit apparier chaque code à un message — l'élargir crée une obligation
d'écriture dans un lot aval. Le `site` dit **où** : type **dérivé**, `ExpressionKind` plus des
membres écrits à la main, et sa docstring donne la raison de ces membres — `LoopNode.each` et
`ConditionNode.when` portent une expression **sans en être une**. `TableRowGroupNode.each` est la
**troisième occurrence exacte de cette forme**. Un type conçu pour recevoir des membres écrits à la
main n'est pas violé quand on lui en ajoute un — il est utilisé.

**L'asymétrie, vérifiée dans les deux sens à l'exécution du lot.** Le **libellé sans le site** rend
`TS2353` à la porte 2 : le compilateur impose donc l'ordre, et le libellé ne *peut pas* précéder le
site. Le **site sans le libellé** passe les portes 1, 2 et 3 **en vert** — `LIST_CALLER_SUBJECTS`
est un `Readonly<Partial<Record<…>>>` où l'absence est légale — et le message retombe
silencieusement sur « *An expression needs a list to iterate over* », dit à un auteur qui n'a écrit
aucune expression, mais un tableau. C'est **mot pour mot** le défaut que la docstring de cette table
existe pour empêcher, dans l'autre sens. Un test épingle donc la chaîne **entière**, mesurée :
`A table body needs a list to iterate over, got a number.`

**Pourquoi « A table body » et non « A table ».** Le **site** est une clé de machine et nomme le
**type de nœud** — le nœud qui appelle `evaluateSequence` s'appelle `tableRowGroup`. Le **libellé**
est de la prose pour un humain et nomme **ce que l'auteur a écrit** : une répétition dans le corps
d'un tableau. Les deux ne coïncident pas, et c'est réglé plutôt que subi.

> **`errors.ts` est modifié alors que le plan C2 avait consigné « ne pas modifier », et ce n'est pas
> une contradiction.** Trois raisons, écrites ici pour que le prochain plan n'hérite pas d'un
> précédent de désobéissance silencieuse. **(1)** La consigne était de **périmètre, pas de statut** :
> elle vivait dans la table « Ce qui ne se touche pas » des cinq incréments de C2 — une discipline
> de lot, pas une immutabilité de dépôt, et `errors.ts` ne figure pas dans la liste protégée
> d'`AGENTS.md` §7. **(2)** Le motif de C2 était **vrai pour C2** : `round` **est** un kind, donc
> `ExpressionKind` a grandi et le site avec lui, zéro ligne modifiée. C3 est sur l'autre branche de
> la même union. **(3)** La promesse voisine — « zéro code d'erreur nouveau » — est celle qu'il
> serait interdit de franchir, et les trois catalogues sortent du lot **octet pour octet**.

**Écarté.** (a) Réutiliser le site `'loop'` : un message qui dit « A loop » à qui n'a écrit aucune
boucle. (b) Un site `'table'` : nomme le mauvais nœud. (c) Un code `unknown-column` : la faute est
décidable au parse. (d) Rendre `LIST_CALLER_SUBJECTS` **total** pour que le compilateur exige le
libellé — l'idée est bonne et ne passe pas : elle exigerait une prose pour les dix-neuf kinds, dont
la quasi-totalité n'appelle jamais `evaluateSequence`, et une prose écrite pour `add` serait de la
prose morte qui ment ; une liste restreinte serait un **second catalogue à tenir en phase**.

**Réversible**, avec une réserve : `ExpressionErrorSite` est exporté par le barrel, donc retirer le
membre plus tard serait un rétrécissement de **type public**, jamais un refus de document.

### D11 — `CURRENT_SCHEMA_VERSION` passe à 4, estampille unique

**Décision.** `CURRENT_SCHEMA_VERSION = 4`. L'entrée `{ from: 3, to: 4 }` est **ajoutée** à
`TEMPLATE_MIGRATIONS`, **jamais fusionnée**. Estampille posée **une seule fois**, après la dernière
forme persistée du lot.

**Pourquoi : le cas « refus illisible », rejoué et mesuré.** Un document estampillé 3 portant un
nœud `table`, ouvert par un build v3, rend

```json
{"code":"invalid_union","note":"No matching discriminator","path":["root","children",0,"type"],"message":"Invalid input"}
```

Lisez-le comme l'auteur du modèle : aucune version nommée, aucun remède, et un chemin qui désigne
`type` — un champ **correctement orthographié**. Le message envoie chercher une faute de frappe là
où il n'y en a pas. Avec l'estampille, le même document rend, **mesuré** :

```
Template uses schema version 5 but this build understands at most 4. It was written by a newer
release of Openview; upgrade before opening it.
```

L'écart n'est pas d'ergonomie, il est de **nature** : le premier message est un cul-de-sac, le
second est une instruction. « Purement additif » n'est pas un argument contre l'incrément, **c'est
l'argument pour**. Et `AGENTS.md` §1.2 ferme la porte de sortie : *il n'y a pas de dérogation
pré-v1.0 au versionnement.*

**L'élargissement va dans les deux sens, ce qu'une seule estampille couvre.** Vers le large :
`DocumentNodeSchema` accueille trois membres. Vers l'étroit : la coupure `BlockNode` retire la ligne
des enfants d'un conteneur, d'une boucle et d'une condition. Un build v3 ne voit jamais le second —
il n'a pas de ligne à refuser — et bute violemment sur le premier.

**La règle de conduite du lot, et elle porte sur le LOT.** INC-0, INC-1 et INC-2 sont **non
publiables** ; le premier commit publiable est **INC-3**. La précision qui change ce qu'on relit en
cas de doute : INC-0 **serait** publiable seul — refactor pur — et c'est **INC-1** qui laisse une
forme persistée sans estampille. La règle porte néanmoins sur les trois, parce que ce qu'elle
protège n'est pas la propreté d'un commit isolé : c'est qu'aucun build en circulation ne refuse
illisiblement les documents du build suivant. Une règle formulée sur le lot se vérifie d'un coup
d'œil au journal. **Cohérent n'est pas publiable.**

**Aucun cinquième rétrécissement de valeur n'est ajouté**, et il faut l'écrire longuement parce que
le plan C2 en avait fait un point de vigilance. Les quatre bornes qui reposent sur l'hypothèse
pré-v1.0 sont les trois de l'ADR 0003 décision 2 et la fenêtre `decimals` de l'ADR 0004 décision 4.
Deux choses de C3 pourraient en avoir l'air :

- **Les trois bornes neuves** — au moins une colonne, au moins une ligne par groupe, `width` entier
  dans `[1, 1000]` — portent toutes sur des **champs qui n'existaient pas**. Aucun document v3 ne
  peut porter une largeur : rien de valide ne devient invalide, et **il n'y a rien à retrofitter**.
  C'est mot pour mot l'argument que la migration 2 → 3 a écrit pour `decimals`.
- **La coupure `BlockNode` rétrécit trois positions stockées**, et c'est un rétrécissement **réel
  dans le type**. Il est **vide en extension sur tout document v3** : l'unique chose qu'il retire de
  chaque position est un `tableRow` ou un `tableRowGroup`, types qui n'existent pas en v3.

Le jour où l'hypothèse pré-v1.0 tombe, ce sont donc **quatre** bornes à rediscuter, pas cinq.

**Écarté.** (a) Ne pas estampiller au motif que l'ajout est additif : argument retourné par le dépôt
lui-même. (b) Fusionner l'entrée avec `2 → 3` : rompt le contrat pas-à-pas écrit dans `migrate.ts`.
(c) Attendre C4 : laisserait publiable un build qui refuse illisiblement les documents du suivant.
(d) Une migration transformante enveloppant les `loop` existants dans un `table` : une migration qui
devine une intention **corrompt**.

**Irréversible.**

> ⚠️ **Rien de mécanique n'exige ce bump, et c'est vérifié plutôt qu'affirmé.** Sans l'entrée de
> migration, les portes 1, 2 et 3 restent **vertes** et seul `migrate.test.ts` rougit. L'estampille
> est un **point de plan**, pas un résultat de build : si l'incrément saute, le dépôt publie un
> contrat qui mente sur son numéro. C'est pourquoi le critère de sortie vérifie
> `CURRENT_SCHEMA_VERSION === 4` **et** `TEMPLATE_MIGRATIONS.length === 3` avec sa première entrée
> toujours `{ from: 1, to: 2 }` — la preuve que l'entrée a été **ajoutée** et non fusionnée.

### D12 — Aucun plafond nouveau, et les mesures qui l'autorisent

**Décision.** Ni plafond de colonnes, ni de lignes, ni d'imbrication. `DEFAULT_SHAPE_LIMITS` reste
`{ maxDepth: 64, maxNodes: 100_000 }`, `DEFAULT_EVALUATION_LIMITS` n'est pas touché, et **aucun
champ nouveau d'`EvaluationLimits`** — un champ de limite sans méthode de budget serait un plafond
décoratif.

**Les mesures, avec leur unité.** Niveaux JSON, racine = niveau 1 ; valeurs = un par élément de
tableau et un par propriété propre, plus la racine.

| Ce qui est mesuré | Profondeur | Valeurs |
| :--- | ---: | ---: |
| Modèle de recette **complet** | **18** / 64 | **231** / 100 000 |
| **Nœud tableau seul** | **15** | **210** |
| Tableaux imbriqués | **9 acceptés**, le **10ᵉ** refusé `too-deep` | — |
| `round` imbriqués dans une cellule d'un `tableRowGroup` | **48** | — |
| `round` imbriqués dans une cellule d'une ligne de corps **fixe** | **50** | — |
| `round` imbriqués sous un **texte nu** | **56** | — |

> ⚠️ **Deux chiffres justes mais mal étiquetés, corrigés — et un chiffre juste sous une étiquette
> fausse est un chiffre faux.** Une rédaction antérieure attachait **231** au *nœud tableau seul* :
> 231 est le compte du **modèle complet**, le nœud seul en pèse **210**. Et elle donnait « 48 »
> comme chiffre **unique** pour deux positions également licites : 48 vaut dans une cellule portée
> par un `tableRowGroup`, **50** dans une cellule d'une ligne de corps fixe — le groupe coûte **deux
> niveaux JSON**.

**Le modèle de coût d'évaluation est linéaire et mesuré :** `pas = 12·N + 4`, `éléments = 2·N`. Les
plafonds sont atteints vers **N ≈ 83 333 lignes** pour `maxSteps` : c'est le **pas** qui mord en
premier, et la facture comptable réelle que la roadmap nomme — « une soixantaine de lignes » —
consomme **0,072 %** du budget. Et il faut rappeler ce que `maxNodes` borne : **le modèle, pas le
jeu de données**. Une facture de soixante mille lignes ne pèse rien ici.

**Le contre-exemple quadratique, documenté parce qu'il ne peut pas être empêché.** Une colonne
« cumul » posant un `sum(...)` **dans** le corps répété fait passer le rendu de linéaire à
quadratique : à N = 1 000, **4 003 001 pas**, les deux plafonds dépassés. **Aucun champ ne peut
l'empêcher** — c'est une expression parfaitement licite, et aucune borne déclarative ne distingue
« un `sum` utile » de « un `sum` recopié N fois ». Le tableau est précisément ce qui **invite** à
l'écrire. C'est la seconde raison, indépendante de la doctrine, pour que la ligne de total soit
**sœur** de la répétition et non dedans. Et c'est un motif de **documenter** plutôt que de borner :
un plafond de lignes refuserait l'honnête facture de mille lignes tout en acceptant la quadratique
de deux cents.

> **Les chiffres de budget mesurent une boucle de rendu écrite à la main, et il faut le dire.**
> `packages/engine/src` ne contient qu'une constante de version, et le `DataBindingStep` reste à
> écrire. Si un lot E mémoïse l'expression d'une cellule, **la constante change**. Ce qui ne change
> pas, et qui porte la décision, c'est la **forme** : linéaire dans la disposition sœur, quadratique
> dans la disposition en corps.

**Corollaire exécuté : la docstring de `maxDepth` mentait, et elle est réécrite dans le même lot.**
Elle annonçait « *10 levels […] 64 leaves a fivefold margin* » ; le modèle réaliste du dépôt pèse
désormais **18** niveaux et la marge vaut **3,5×**. D12 refuse tout plafond nouveau **en s'appuyant
sur cette mesure** : laisser le fichier qui la porte dire le contraire aurait fondé un refus sur un
chiffre que le code contredit. Le précédent est écrit et opposable — le plan C2 a consacré sa §3.6
exactement à ce geste. « threefold » arrondit **vers le bas** le 3,5 mesuré, délibérément.

**Écarté.** (a) Un `MAX_TABLE_COLUMNS` : `maxNodes` borne déjà, indirectement et mieux, et c'est
cette borne qui porte la preuve de D6. (b) Refuser l'imbrication : irréalisable sans refuser aussi
les conteneurs, et `too-deep` répond déjà. (c) Un plafond de lignes : les lignes sont des
**données**. (d) Relever `maxDepth` « puisque C3 en consomme un tiers » : 46 niveaux de marge
subsistent, et relever un défaut parce qu'un lot neuf s'en approche est la manière ordinaire dont un
garde devient décoratif.

**Réversible dans un seul sens.** Ne rien borner ne coûte rien à défaire ; **ajouter** un plafond
plus tard serait un **rétrécissement**, sans migration possible. *Signal de réouverture :* un
chiffre remis par E8 montrant qu'un tableau large fait exploser une ressource que `maxNodes` ne
borne pas.

### D13 — Ce que le lot refuse, par écrit

**Vingt refus.** Un refus qu'on n'écrit pas est un refus qui sera demandé, accordé, et découvert
trop tard.

**Ils se rangent en trois CLASSES, et la distinction est structurante** — sans elle la liste se lit
comme un hors-périmètre **produit** alors qu'elle est un hors-périmètre de **champ** :

- **(i) Interdit définitivement, pour tout le produit** : l'auto-somme et tout champ de total ; le
  report ; la répartition d'un résidu d'arrondi ; tout nom de colonne réservé ; l'en-tête ou les
  colonnes déduits des clés du jeu de données ; l'alignement déduit du type ; tout vocabulaire à
  consonance réglementaire ; toute lecture d'environnement.
- **(ii) Refusé DANS C3 et livré ailleurs sous une autre forme** : l'apparence (C5), le format (C6),
  la pagination (E2/E3), l'insécabilité (C7), le tri et le filtre — déjà dans l'algèbre C1. **Un
  refus de cette classe porte sur le CHAMP, jamais sur la capacité**, et le motif est toujours le
  même : **déplacer un champ stocké est une migration transformante.**
- **(iii) Refusé aujourd'hui, avec un signal de réouverture daté** : la fusion de cellules, la
  colonne conditionnelle, le type de colonne.

**Les trois qui seront demandés dès la première vraie facture** — pas les plus discutables, les plus
**prévisibles** :

**1. La fusion de cellules.** Elle détruit l'invariant sur lequel tout le nœud repose : **une
cellule appartient à une colonne**. Trois choses cassent ensemble. La **largeur** : la preuve de D6
porte sur le rapport entre **colonnes** ; une cellule fusionnée n'a pas de colonne, donc pas de
part. L'**alignement** : une cellule à cheval sur trois colonnes en hérite trois. La **coupure** :
avec `rowspan`, la pagination devient un problème à deux dimensions, et E2 hériterait d'un cas que
personne n'a spécifié. **Contournement, écrit ici plutôt que caché :** le libellé d'une ligne de
total occupe **une** colonne et les voisines restent vides — sur une facture réelle, cela se voit.
**Et le contournement se voit déjà dans le dépôt** : le `<table>` comparatif du playground porte un
`colSpan={3}` qu'aucun `TableNode` ne peut décrire — c'est l'une des deux raisons pour lesquelles il
**reste du JSX écrit à la main** après C3. *Signal :* un modèle livré dont le libellé de total ne
tient dans aucune colonne existante.

**2. La colonne conditionnelle.** Elle casse D6 par un chemin qu'on n'attend pas : `Σ widths`
deviendrait fonction du **jeu de données**, donc la part d'une colonne aussi, donc la garantie
« même nombre dans l'aperçu et dans le PDF » ne tiendrait plus que si les deux côtés évaluaient la
même expression de la même manière — **un accord d'implémentation, exactement ce que D6 a été écrit
pour remplacer par une propriété démontrable**. **Contournement daté :** elle s'écrit **aujourd'hui**,
en deux tableaux sous deux `condition`, puisque `ConditionNode.children` porte des blocs et que
`TableNode ∈ BlockNode`. **Le prix, nommé :** les deux tableaux doivent être maintenus en phase et
**rien ne les lie**. *Signal :* une facture réelle où les deux divergent en maintenance.

**3. Le type de colonne.** Il appelle une **échelle** et un **symbole**, donc un arrondi implicite ;
le formatage appartient à C6 ; et le trancher ici **préempterait par la porte de service** la
question que C2 a explicitement laissée ouverte — *qui déclare l'échelle d'affichage d'un montant*.
*Signal :* la décision ouverte de C2 tranchée en faveur d'une table de devises.

**Les cinq colonnes du critère de recette sont un JEU D'ÉPREUVE, et le lot le fait dire par trois
gestes plutôt que par une phrase.** `designation`, `quantite`, `prixUnitaire`, `remise`, `montant` :
c'est la vitrine du lot, donc **ce qui sera recopié**. Le dépôt nomme déjà ce mécanisme — « c'est
donc une **position par défaut de fait** : autant la choisir sciemment »
(`docs/roadmap/README.md:189`). Une phrase dans un plan périmé à la livraison ne protège personne ;
trois gestes dans le code, si : l'avertissement au-dessus du `TableNode` du playground, le même en
tête de la fixture `RECIPE_TABLE`, et un **critère mécanique** dont la forme naïve était fausse
(voir « Les corrections nées de l'exécution », point 2).

**Écarté.** (a) Livrer l'un de ces refus « parce que c'est peu de code » : un champ stocké livré ne
se retire plus qu'avec une migration transformante. (b) Livrer une colonne « TVA » ou « montant HT »
dans un exemple : **un exemple est un contrat de fait**, et celui-là appellerait une fonction à nom
fiscal dans le lot suivant.

**Irréversible pour les deux premiers refus de la famille Calcul, réversible pour les autres** au
prix, chaque fois, d'un champ neuf et d'une estampille — **jamais d'une migration transformante**,
ce qui est précisément la propriété que cette liste protège.

---

## Le point de gouvernance, et il est unique

Le test de discriminant `if (entry.type === 'tableRow')` dans `checkTableWiring` **n'est pas** un
second parcours du Composite au sens d'`AGENTS.md` §3.B : il ne descend dans aucun enfant, il lit
l'union à **deux** membres du corps d'**un** nœud, dans le schéma de ce nœud, et Zod l'a déjà
discriminé. Router le contrôle par `visitNode` obligerait `ast/schemas.ts` à dépendre de
`ast/visitor.ts` et à écrire **huit** branches pour en dispatcher **deux**.

C'est la **décision 7-A**, relevée le 2026-08-17, et elle **ne demande aucun amendement**. Elle a
été *relevée* et non présumée, parce qu'**un plan ne se délivre pas la dérogation lui-même**.

> ⚠️ **Le MOTIF de cette décision a été réécrit après mesure, l'option restant la même.** Énoncé
> retiré : « *la garantie qu'achète le Visitor est ici achetée par le rétrécissement lui-même —
> `entry.rows` ne type-check que tant que `TableBodyNode` a exactement ces deux membres* ». **La
> seconde moitié est fausse d'une classe d'élargissement sur deux, et c'est la plus probable :**
>
> | Élargissement de `TableBodyNode` | `if / else` | Assertion sur `TableBodyNode['type']` |
> | :--- | :--- | :--- |
> | un 3ᵉ membre **sans** `rows` | TS2339 | TS2322 |
> | un 3ᵉ membre **avec** `rows: readonly TableRowNode[]` | **exit 0 — absorbé en silence** | **TS2322** |
>
> Un membre portant un `rows` de forme compatible — un groupement par famille, une bande
> d'intitulé — est traité comme un groupe **sans que rien ne le dise**. Un accident de compatibilité
> n'est pas une garantie.
>
> **Ce que le remède ne doit PAS être, et deux mesures l'écartent.** Une branche `else` terminée par
> `const exhaustive: never` restaure la garantie et coûte deux choses à refuser. *(a)* Elle est
> **inatteignable** : `invalid_union` sur une entrée de corps est **abandonnante**, donc le
> `superRefine` est **sauté** et `checkTableWiring` ne voit jamais une troisième forme — une branche
> inatteignable est non couvrable, contre un seuil `branches: 90`. *(b)* **MESURÉ :** un `throw`
> dans un `superRefine` **s'échappe de `safeParse`**, qui lève au lieu de rendre
> `{ success: false }` — l'erreur non enveloppée que l'ADR 0003 décision 8 existe pour supprimer.
>
> **Le remède retenu ne touche pas une ligne de production** : l'assertion de type
> `TABLE_BODY_MEMBERS_IN_STEP`, à la porte 3, trois lignes de test et zéro ligne d'exécution. La
> règle du plan C2 s'applique telle quelle : *une contre-mesure qui réfute un chiffre réécrit le
> motif ; une contre-mesure qui réfute une prémisse rejoue l'option.* **Ici c'est le motif.**

---

## Ce que cette décision tient pour acquis

**Deux dépendances au comportement de Zod, et non une. À rejouer à chaque montée**, comme l'ADR 0004
le fait pour la règle nursery de Biome.

1. **Un `z.object().superRefine()` reste un `ZodObject` en zod 4** — les refinements vivent **dans**
   le schéma plutôt que de l'envelopper — donc `TableNodeSchema` demeure membre légal des deux unions
   discriminées, `lazy` comprises. **Toute la propriété « zéro code d'erreur nouveau » repose
   là-dessus.**
2. **Zod ne saute un `superRefine` que sur une issue ABANDONNANTE** — `invalid_type`,
   `invalid_value`, `invalid_union` ; les **continuables** — `too_small`, `too_big`, `custom` — le
   laissent tourner. Deux conséquences à consigner ensemble : *(a)* `invalid_union` étant
   abandonnante, l'exhaustivité de `TableBodyNode` se garde par une **assertion de type** à la porte
   3 et non par une branche défensive dans le schéma ; *(b)* `columns.min(1)` rendant un `too_small`
   n'arrête **rien**, ce qui est la raison pour laquelle le garde `declared.size === 0` **existe** —
   sans lui, un tableau sans colonne rend **13** fautes au lieu d'**1**. La formule juste :
   *un refus de type masque le câblage, un refus de borne ne le masque pas.*

**La note qui empêche une fausse alarme :** l'exactitude de D6 **ne dépend pas** du défaut
`maxNodes`. Sans elle, un relèvement de `DEFAULT_SHAPE_LIMITS` par E8 **aurait l'air** d'invalider la
preuve. Le détail est en D6.

---

## Les corrections nées de l'EXÉCUTION du lot

Trois choses que la livraison a apprises et que le plan ne pouvait pas savoir. Elles sont écrites
ici parce que **deux d'entre elles invalident un critère mécanique du plan**, et qu'un critère faux
non consigné se recopie.

**1. Le critère `switch (node.type)` était auto-falsifiant.** Le plan exigeait que
`git grep -l "switch (node.type)" -- packages/core/src | wc -l` rende **1**. **Mesuré après
livraison : 2.** La seconde occurrence est le **commentaire que le plan prescrit lui-même** en
`ast/schemas.ts` — « *Not a second `switch (node.type)`, and not a traversal…* ». C'est la même
classe de défaut que la sonde RTL, et la même origine : un critère qui compte des **fichiers
contenant une chaîne** là où il veut compter des **instructions**. Forme corrigée, mesurée à **1** :

```bash
git grep -cE "^[[:space:]]*switch \(node\.type\)" -- packages/core/src
```

La propriété de fond est intacte : il existe **une seule** instruction `switch (node.type)` dans le
dépôt, dans `visitNode`.

**2. Le pathspec du critère « jeu d'épreuve » est plus étroit que son intention.** Le critère exclut
`':!*__tests__*'`, mais le dépôt porte des fichiers de test **hors** d'un dossier `__tests__/` —
`template/guard.test.ts` et `template/migrate.test.ts`. Un identifiant de colonne écrit dans l'un
d'eux fait donc échouer un critère qu'il ne devrait pas concerner. Constaté à l'exécution : le test
d'estampille employait `montant` et rendait trois lignes là où le critère en attend zéro. **Résolu
en neutralisant le test** — qui n'avait aucune raison de recopier ce vocabulaire — plutôt qu'en
élargissant le pathspec, pour que le critère reste vérifiable **tel qu'il est écrit**.

**3. Le playground a détecté ce que ni la porte 2 ni la porte 3 ne voyaient**, et c'est exactement le
rôle que le dépôt lui prête. Après le remplacement de la maquette, un `requireNode(root, 'lines')`
devenu caduc subsistait : le `if (loopNode.type !== 'loop')` **comptait comme un usage**, donc
`noUnusedLocals` restait muet, et les deux `tsc` sortaient à 0. **Seule l'exécution de la page l'a
dit.** À reverser au crédit de l'argument de §3.8 du plan : le playground est le seul consommateur
réel du barrel, et son intérêt n'est pas théorique.

---

## Conséquences

**Pour `@openview/engine`.** E2 et E3 héritent de **trois sections nommées** et n'ont aucun drapeau
à lire pour savoir quoi répéter : c'est la raison pour laquelle `header` existe. Mais **ce que le
moteur en fera n'est écrit nulle part dans le contrat** — ni la répétition page à page, ni le point
de coupe, ni la veuve et l'orpheline. **C'est une attente envers un lot non écrit, et elle est
qualifiée comme telle** : la brique **décrit**, elle ne **produit** rien, et D13 refuse nommément
`repeatHeaderOnEachPage`, `keepTogether` et `orphanControl`. On ne peut pas refuser un champ au motif
que le choix appartient au moteur **et** écrire dans le contrat ce que le moteur décidera.

E2 hérite aussi de la **pagination d'un tableau imbriqué**, conséquence acceptée de D5.

**Pour `@openview/designer`.** D6 éditera colonnes et cellules ; D7 la barre de formule d'une
cellule. `BlockType` est désormais **dérivé** de `BlockNodeType` : la liste écrite à la main
contenait déjà `'table'` alors que `core` n'avait pas ce nœud — elle était juste **par accident**, et
rien dans les quatre portes ne le signalait. La dérivation est une **confirmation indépendante que
la coupure `BlockNode` désigne la bonne chose** : la liste que le designer avait écrite pour
répondre à « qu'est-ce qu'un utilisateur peut insérer ? » est, membre pour membre, l'union que C3
écrit pour répondre à « qu'est-ce qu'un flux de blocs accepte ? ». Deux questions, deux moments, la
même réponse.

**Pour C5.** Il reçoit un objet auquel accrocher une apparence, et la porte reste ouverte dans le
seul sens qui ne coûte rien : une surcharge d'alignement par cellule s'**ajoute**, elle ne déplace
pas le champ de colonne.

**Pour l'aplatissement des cellules dans `childrenOf`.** C'est un **choix, pas un oubli**, et il a un
coût nommé : il rend `collectDataPaths` correct sans effort, et il rend **impossible** de retrouver
la colonne d'un nœud depuis le parcours. Un consommateur qui a besoin de la colonne lit le **nœud
tableau** — id de table plus `columnId` de la cellule. Aucun index précalculé n'est écrit tant
qu'aucun consommateur réel ne le demande. Et une règle pour le consommateur : **quatre** branches
sur huit rendent la référence stockée, les quatre autres allouent — `childrenOf(text) ===
childrenOf(text)` est **`false`** — donc **rien ne se mémoïse sur l'identité du résultat**.

---

## Ce qui reste ouvert

**1. Qui déclare la direction d'écriture d'un document ?** Les options : une déclaration de modèle
rattachée à C6, une entrée du `RenderRequest`, ou rien et un défaut de moteur. **Sans
recommandation**, sur le patron exact de la question d'échelle d'affichage léguée par C2 — la
décision 5-A *diffère* cette résolution, elle ne l'attribue à personne. La mesure qui justifie de la
poser ainsi est la sonde RTL de D7, **dans sa forme canonique et scopée**. L'interdit qui tient
déjà : **aucun moteur ne dérive cette direction de la machine** (E6).

**2. Le recalcul parallèle du total.** Le critère de recette dit « une somme de ce qui précède », et
le modèle produit en réalité **deux écritures de la même arithmétique** —
`round(mul(ligne.quantite, ligne.prixUnitaire), 2)` dans la cellule du corps, la même sous l'agrégat
du pied — qu'**aucun mécanisme du contrat ne lie**. Un auteur qui corrige l'une et pas l'autre
obtient un total qui contredit sa propre colonne, **en silence** : `core` ne le refuse pas — les deux
expressions sont licites —, `collectDataPaths` ne le voit pas (mesuré : il rend les deux mêmes
chemins), et le seul outil qui pourrait le voir est le **lint d'éditeur de D7**, très loin en aval.

**C'est le prix, assumé, du refus des références croisées de C1** : une cellule ne peut pas dire « la
somme de la colonne au-dessus », parce qu'aucune expression ne référence une autre valeur du
document. Le remède n'est **pas** un champ dans le contrat — ce serait l'auto-somme, refusée — mais
**un lint d'éditeur**, et il est nommé comme tel. Deux gestes en découlent, tous deux appliqués : le
modèle de recette emploie **le même nom d'alias `ligne`** dans le groupe et dans l'agrégat, pour que
la duplication soit **comparable à l'œil** — les deux portées sont disjointes, le masquage est
purement lexical, cela ne coûte rien —, et la question est consignée ici, reliée à la décision déjà
prise par l'ADR 0002.

---

## Trois contradictions constatées dans le dépôt, nommées et non corrigées

Une ADR est un **journal**, et un lot ne réécrit pas les documents d'un autre.

| Contradiction | Où | Ce qu'il faut en savoir |
| :--- | :--- | :--- |
| Le modèle bilingue attribué à « core C5 » | `docs/roadmap/engine.md:79` | C'est **C6** : `core.md:186-196` énumère montants, dates, séparateurs, symbole monétaire et libellés fixes. **C5 est l'apparence.** |
| « C4 et C3 ne débloquent aucun lot en aval » | `docs/plans/c2-…md:186-187` | **Faux pour C3** : `core.md:184` écrit « C5 — **Dépend de :** C3 ». Phrase à ne pas recopier ; le plan C2 est périmé et le reste. |
| « Colonnes », homonyme non désambiguïsé | `core.md` (C3, vague 1) et décision produit 8 (lot C11, vague 2) | Colonnes **de tableau** contre colonnes **de mise en page**. L'éditeur de tableau de D6 dépend justement des deux. |

**Et une réestimation de poids, dite plutôt que laissée trouver.** `core.md:161` écrit « **Poids :**
M » pour C3. Le M est l'estimation **produit**, faite avant qu'un contrat n'existe ; après
conception, le lot pèse **L** — six incréments, dix fichiers de production dans `core`, cinq
fichiers de test et une fixture. Deux lettres pour deux objets, et la seconde n'annule pas la
première. **La roadmap n'est pas corrigée pour autant** : une réestimation de poids n'est pas un
mandat pour réécrire le tableau des poids d'une brique entière, ce qui rouvrirait l'ordonnancement de
la vague 1 en passant.

---

## Le relevé des sept arbitrages, tranchés le 2026-08-17

Sur le patron de l'ADR 0004, qui a recopié les cinq de C2 : la question, l'option retenue, les
options écartées, et le **motif tel qu'il a été écrit avant la décision** — parce que c'est lui
qu'il faudra relire le jour d'une réouverture.

| # | Question | Retenu | Écarté | Motif, tel qu'écrit avant la décision |
| :-- | :--- | :--- | :--- | :--- |
| **1** ⛔ | Que veut dire « **typé** » dans le critère de recette ? | **A** — « décrit dans un contrat typé » : les cinq colonnes sont un **jeu d'épreuve**, aucune ne porte de type de donnée. | B — chaque colonne porte un type, dont le moteur déduit format et alignement. | L'écart n'est pas cosmétique, **il change le lot**. Un type de colonne appelle une échelle et un symbole ; une échelle non déclarée **est** un arrondi implicite ; le formatage appartient à C6, dont C2 a explicitement laissé ouverte la question de l'échelle d'affichage. Trancher B aurait préempté cette décision **par la porte de service**. |
| **2** | La frontière C3 / C5 sur l'alignement n'est arbitrée par **aucun texte** du dépôt. | **A** — C3 possède l'alignement **de colonne** ; C5 garde l'alignement de bloc et la surcharge par cellule s'il la décide. | B — tout à C5. C — C3 déclare les deux dès maintenant. | B contredit le libellé du lot **et** la chaîne de dépendances. C écrit un champ optionnel **à la place de C5** ; le retirer plus tard exigerait une migration transformante, l'ajouter plus tard n'est qu'un élargissement. A garde la porte ouverte dans le seul sens qui ne coûte rien. **À consigner comme une DÉCISION, pas comme une lecture.** |
| **3** ⛔ | Une cellule contient-elle des **blocs** ou des **segments** ? | **A** — `readonly BlockNode[]`. | B — `readonly TextSegment[]`. | **A sur la RÉVERSIBILITÉ, pas sur l'expressivité.** B est le seul point du contrat où un revirement coûterait une migration **transformante**, et la première demande sera un logo dans une cellule. A rend en prime le libellé d'en-tête un `TextNode` ordinaire, donc **zéro position de contenu nouvelle** pour C6. |
| **4** | Le `superRefine` — **le premier du dépôt** — est-il accepté ? | **A** — le garder. | B — le retirer, et laisser C8 nommer le défaut plus tard. | L'appariement par clé ne laisse qu'**un** état représentable, la cellule orpheline, et c'est une **perte silencieuse**. Ce n'est **pas** la passe sémantique qu'ADR 0002 D2 a refusée : le contrôle est **local** — un nœud, un niveau, aucune descente — là où le masquage d'alias exigeait toute l'ascendance. B aurait laissé C8 découvrir la faute des mois plus tard. |
| **5** | `start / center / end` ou `left / center / right` ? | **A** — `start / center / end`. | B — `left / center / right`. | **A, mais pas sur l'argument initialement écrit.** L'argument qui tient : C3 diffère une résolution qu'il n'a **aucune information** pour trancher, et le revirement serait **transformant** et **sémantiquement indécidable**. C'est le **seul** arbitrage dont la **prémisse** a été réfutée sans que l'option change : ce qui a disparu est le **destinataire** de la résolution différée, d'où l'entrée « Ce qui reste ouvert ». |
| **6** | `MAX_COLUMN_WIDTH = 1000` — faut-il une borne du tout ? | **A** — garder `[1, 1000]`. | B — entier sans borne haute. C — une borne plus large, 10 000. | La borne n'est pas un jugement de mise en page, elle est **load-bearing** : sans elle, la preuve qui adosse la décision produit 7 disparaît et la part d'une colonne redevient un **accord entre deux implémentations**. C reste arithmétiquement correct mais **aucun besoin ne le motive**. |
| **7** ⛔ | Le lot a-t-il besoin d'un **mandat de gouvernance** ? | **A** — non : ce n'est pas un parcours du Composite. **Aucun amendement d'`AGENTS.md`.** | B — router par `visitNode`. C — amender §3.B sous mandat. | **A**, et c'était le **seul** point de gouvernance du lot. B obligerait `ast/schemas.ts` à dépendre de `ast/visitor.ts` et à écrire huit branches pour en dispatcher deux. **Et un plan ne s'auto-délivre pas de dérogation** : cette lecture a été **relevée** et non présumée. |

**Le marquage ⛔ reste, et il change de sens.** Avant la décision il signalait les arbitrages dont
l'option non recommandée réécrivait du contrat déjà rédigé ; ce coût ne disparaît pas, il devient le
**coût de réouverture** — n° 1 (le lot est **rejoué**, pas amendé : D1, D6, D7, D10 et D13 se
reprennent avec un axiome différent), n° 3 (`TableCell`, la branche `tableRow` de `childrenOf`,
**toutes** les mesures de profondeur, la fixture et le décompte de dix-sept nœuds) et n° 7 (le
découpage change, ou un couplage s'inverse entre `ast/schemas.ts` et `ast/visitor.ts`). Rouvrir l'un
des quatre autres ne coûterait qu'un champ, une borne, une étiquette ou un contrôle — nommé et
localisé.

**Trois signaux de réouverture survivent à la décision :** n° 1 — la question ouverte de C2 sur
l'échelle d'**affichage** tranchée en faveur d'une table de devises ; n° 5 — le RTL déclaré hors
périmètre à jamais ; n° 6 — une demande citant un rapport plus fin que 1:1 000 ou une largeur
physique imposée.

---

## Le protocole des mesures

Les chiffres marqués **MESURÉ** dans ce document ont été obtenus ainsi, et distingués de ce qui n'est
que **lu** : bac à sable, copie intégrale de `packages/core`, jonctions vers le `zod@3.25.76`
(importé via `zod/v4`) et le `vitest@4.1.10` du dépôt, `tsc` 7.0.2 avec les `tsconfig.json` **et**
`tsconfig.typecheck.json` **du dépôt**, Node v24.11.1, `biome check` avec le `biome.jsonc` du dépôt,
baseline vérifiée à **exit 0** avant toute édition, `git status` du dépôt **identique avant et
après**. Les bornes de profondeur et de valeurs ont été obtenues par **bissection**.

**Les mesures rejouées à la livraison**, sur le dépôt lui-même et non dans un bac à sable : les
quatre portes vertes à chaque incrément ; la couverture à **100 % de branches et de fonctions** ; les
**trois ablations** de `blockMembers()` et `rowMembers()`, chacune laissant les portes 1, 2 et 3 à
exit 0 et ne faisant rougir que l'`it` d'union ; la contre-épreuve `align`, quatre sites à la porte 2
(un TS6133, deux TS2375, un TS2345) et un cinquième à la porte 3 ; l'asymétrie site/libellé dans les
deux sens ; l'absence de toute porte réclamant l'estampille ; et le rendu du tableau dans le
navigateur — largeurs 33,33 / 11,11 / 16,67 / 16,67 / 22,22 % pour des poids 6/2/3/3/4 sur une somme
de 18, alignements `start end end end start`, et un pied de **deux** cellules pour cinq colonnes.
