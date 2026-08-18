# ADR 0007 — L'apparence

- **Statut :** 🟢 **Accepté** (2026-08-18), implémentée dans `@openview/core`
- **Date :** 2026-08-18
- **Impact :** `@openview/core` (deux formes stockées d'apparence, un champ isolé, **neuf sites
  d'accrochage**, une conversion d'unité exportée, deux résolutions exportées et l'**estampille 6**),
  `@openview/engine` (E1 reçoit de quoi peindre ; E2 et E3 héritent de la **première famille de
  propriétés dont le rendu dépend du point de coupe** ; E6 et E8 héritent du danger d'un nom de
  police), `@openview/viewer` (V1 peut peindre sans moteur ; V3 a enfin une chaîne de largeurs à
  vérifier), `@openview/designer` (D2 doit un panneau de style, et un **normalisateur côté
  producteur**), `@openview/core` lot **C6** — qui « Dépend de : C2, C5 » (`core.md:229`)
- **Complète :** [ADR 0006](0006-la-page.md) — une bande a l'apparence **gratuitement**, parce que
  `PageBand.content` **est** un `ContainerNode`, donc pas une ligne de `page/` ne change ; et
  [ADR 0005](0005-le-tableau-de-lignes.md), dont le critère d'appartenance à la colonne est
  **corrigé** dans le lot plutôt que contourné, et dont la réservation conditionnelle sur
  `TableCell` est **honorée à un autre site**.
- **Rétrécit une docstring publiée par le lot C3, et le geste est écrit ici parce qu'un lot qui
  renverse la consigne d'un lot antérieur le fait explicitement ou pas du tout.**
  `ast/types.ts` décrivait `TableColumn.align` comme « *How the cells of one column sit inside
  their column box* » — un placement de **cellule** que ni C3 ni C5 ne peuvent tenir sans un modèle
  de mise en page de table. Le sens retenu est celui que le contrat peut soutenir : *le défaut de
  `TextNode.align` pour les blocs de texte des cellules de cette colonne*. **Forme stockée
  inchangée, aucune migration due.**
- **N'amende aucune règle de gouvernance.** `AGENTS.md` sort du lot **inchangé**, et le contrôle
  est négatif et rejouable — `git diff --exit-code "$(git merge-base origin/main HEAD)" HEAD --
  AGENTS.md`, exit 0. Même chose pour `packages/core/src/errors.ts` : **zéro code d'erreur nouveau,
  zéro site nouveau**, le fichier sort du lot octet pour octet. Et pour `ast/visitor.ts`,
  `template/paths.ts` et `template/guard.ts` — voir la décision 12, dont c'est la conséquence
  mesurée.
- **Plan d'implémentation :** [docs/plans/c5-l-apparence.md](../plans/c5-l-apparence.md) —
  **périmé** une fois le lot livré, comme le dit son propre en-tête. C'est cette ADR qui fait foi,
  et elle **corrige** son plan en cinq points, tous nommés au [§ Ce que l'exécution a corrigé du
  plan].
- **Implémentation :**
  [`src/style/types.ts`](../../packages/core/src/style/types.ts) (`Color`, `Typography`,
  `BorderEdge`, `BoxBorder`, `BoxSpacing`, `BoxStyle`, `MIN_FONT_SIZE_PT`, `MAX_FONT_SIZE_PT`),
  [`src/style/units.ts`](../../packages/core/src/style/units.ts) (`mmFromPt`, `ptFromMm`),
  [`src/style/schemas.ts`](../../packages/core/src/style/schemas.ts) (les six schémas et le contrôle
  de forme canonique),
  [`src/style/resolve.ts`](../../packages/core/src/style/resolve.ts) (`TypographySources`,
  `resolveTypography`, `TextAlignSources`, `resolveTextAlign`),
  [`src/style/style.ts`](../../packages/core/src/style/style.ts) (la façade),
  [`src/ast/types.ts`](../../packages/core/src/ast/types.ts) et
  [`src/ast/schemas.ts`](../../packages/core/src/ast/schemas.ts) (les onze déclarations de champ sur
  neuf porteurs, `TEXT_ALIGNMENTS`, `TextAlignment`),
  [`src/template/template.ts`](../../packages/core/src/template/template.ts) (l'estampille 6),
  [`src/template/migrate.ts`](../../packages/core/src/template/migrate.ts) (l'entrée 5 → 6),
  [`src/index.ts`](../../packages/core/src/index.ts) (vingt-deux exports),
  [`apps/playground/src/App.tsx`](../../apps/playground/src/App.tsx) (la démonstration).

---

## Contexte

`@openview/core` **décrit**, il ne **produit** rien : aucune page, aucun pixel, aucun PDF. La
roadmap l'écrit sans détour — « si une question commence par *à quoi ça ressemble*, elle appartient
au moteur ou au viewer ».

**Et c'est précisément ce qui rend ce lot différent des quatre précédents : « à quoi ça ressemble »
EST le sujet de C5.** C1 décrivait des calculs, C2 des arrondis, C3 une structure de tableau, C4 une
géométrie de feuille. Tous les quatre pouvaient s'écrire sans jamais frôler la question du rendu.
C5 ne peut pas. Il faut donc dire où passe exactement la ligne — sinon chaque champ la franchira un
peu, et personne ne saura dire lequel.

**La ligne est celle-ci : déclarer n'est pas résoudre.**

- **Déclarer une police**, c'est écrire un nom dans un document. **La résoudre**, c'est chercher un
  fichier de fonte sur une machine, et échouer si elle n'y est pas. Le contrat fait le premier et
  n'a aucun moyen de faire le second : `packages/core` compile avec `types: []` et
  `lib: ["ES2022"]`, donc `document`, `window` et `process` y sont des **erreurs de compilation**.
  Une métrique de police est barrée par le compilateur avant de l'être par une règle.
- **Déclarer une taille**, c'est écrire un nombre. **La mesurer**, c'est demander à un moteur de
  fonte la largeur d'une chaîne. Le contrat ne porte donc **aucun `auto`**, **aucun interligne** et
  **aucune hauteur** — l'ADR 0006 avait déjà tué, sur cet argument exact, une réserve de bande
  exprimée « en lignes de texte ».
- **Déclarer une couleur**, c'est écrire six chiffres hexadécimaux. **La composer**, c'est mélanger
  deux couches dans un espace colorimétrique. Le contrat n'a **aucun canal alpha**, et il dit dans
  quel espace ses six chiffres s'interprètent — parce qu'un contrat de couleur qui ne le dit pas
  laisse deux implémentations peindre deux couleurs différentes.

**Deux exceptions nommées, et une exception écrite est une exception qu'on peut discuter.** Le lot
exporte quatre fonctions, ce qui ressemble à du calcul dans une brique qui n'en fait pas. Les deux
motifs sont **différents**, et les confondre serait emprunter un précédent qui ne s'applique pas.

1. **`mmFromPt` et `ptFromMm` héritent EXACTEMENT du précédent de `printableAreaOf`**, et pour la
   même raison mesurée : le contrat porte **deux unités** — la taille de caractère en points, tout
   le reste en millimètres — et une conversion écrite deux fois donne deux doubles différents.
   **Mesuré : 31,5 % des tailles entières divergent entre les deux formes qu'un relecteur écrirait
   spontanément, 60,9 % si l'on compte quatre formes.** La décision produit 7 promet un aperçu
   *identique au PDF, garanti* ; une conversion dupliquée la casse en silence.
2. **`resolveTypography` et `resolveTextAlign` n'héritent PAS de ce précédent, et le dire est
   obligatoire.** Elles ne font aucune arithmétique : ce sont des chaînes de `??`, donc il n'y a
   aucune variance IEEE-754 à centraliser. Leur motif est autre, et il est plus faible : elles
   énoncent **une règle de précédence**, et une règle de précédence écrite en prose se
   réimplémentera deux fois — une fois dans le moteur, une fois dans le viewer — avec le droit de
   diverger. Ce qu'elles garantissent n'est pas une garantie de bit, c'est une garantie d'**unicité**.

**Ce que le contrat ne fait toujours pas :** il ne mesure rien, il ne charge rien, il ne compose
rien, il ne connaît ni écran, ni imprimante, ni fonte. Les **huit** attentes que ce lot **crée**
envers un moteur futur vivent au [§ Conséquences] et dans **aucune docstring** — c'est la correction
que le lot C3 a dû s'appliquer à lui-même après coup (ADR 0005, constat C-01), et que C4 a
transformée en critère mécanique.

---

## Le critère d'appartenance, écrit AVANT la liste des champs

Une déclaration appartient au lot C5 **si et seulement si** les quatre conditions suivantes sont
vraies. Et la **charge de justification** de chaque champ retenu est l'énumération de
`core.md:207-217` — **dix attributs en six groupes** — **jamais** le critère de recette, qui est un
**seuil minimal de démonstration** et non une définition de fini.

> 1. **Elle est aveugle au contenu** : elle a un sens sans savoir ce que le bloc contient, ni de
>    quel type est la valeur qu'il porte.
> 2. **Elle ne change que ce qu'un lecteur VOIT, jamais les CARACTÈRES qu'il lit** : aucun
>    caractère n'est ajouté, retiré, traduit ni recassé par elle.
> 3. **Un moteur peut l'honorer sans MESURER LA MACHINE et sans INVENTER de politique** : ni
>    lecture d'environnement, ni arbitrage entre deux rendus également légitimes.
> 4. **Sa valeur a un sens sur CHAQUE porteur où le contrat l'autorise.**

**Ce que chaque condition écarte SEULE — sinon elle est décorative.**

| Condition | Ce qu'elle écarte **seule** |
| :-- | :--- |
| **1** (aveugle au contenu) | **tout C6** — séparateur de milliers, position du symbole monétaire, motif de date ; le **formatage conditionnel** (« en rouge si échu ») ; une couleur dérivée du **type** de la valeur. **C'est la seule condition qui partage C5 de C6** |
| **2** (vu, jamais lu) | un **`textTransform`** — il change les caractères, et l'algèbre porte déjà `textCase`, donc ce serait **deux orthographes d'un même fait** ; un **motif formaté** `'Page {n} / {total}'` — « c'est un parseur, avec son échappement et sa surface d'injection » ; un **lien hypertexte** |
| **3** (sans lire la machine, sans politique) | le dimensionnement **`auto`** ; l'**interligne exprimé en lignes** ; **`keepTogether`** et toute politique de coupe (**C7**) ; l'**opacité**, l'**ombre**, le **dégradé** ; la **fusion des filets d'un tableau** ; une **pile de repli** de polices ; une graisse **`450`**, qui ne désigne aucune face ; **la taille d'une image**. **C'est cette condition, et non un choix de politesse, qui laisse la place de C7 vide** |
| **4** (un sens sur chaque porteur) | un **espacement inter-enfants** sur une `image` — aucun enfant, donc un état **sans sujet**, pas « ambigu » : vide ; le même sur un `table` ou un `tableRow` — il y signifie un `border-spacing`, et il insère dans la formule publiée de `TableColumn.width` une soustraction qu'elle n'a pas ; un `box` sur `LoopNode`, `ConditionNode`, `TableRowGroupNode` — ils produisent *N séquences* ou *rien* ; un `Typography` sur un `container` — aucun caractère à styler sans cascade |

⚠️ **La condition 3 a DEUX moitiés, et une rédaction antérieure s'est servie de la mauvaise.**
« Sans mesurer » ne veut pas dire « sans qu'aucune mesure n'intervienne dans le rendu » : cela veut
dire **sans mesurer la MACHINE**. La distinction est réfutable en une ligne — `center` et `end` sont
des membres **publiés depuis C3**, et centrer une ligne exige d'en connaître la largeur composée,
donc une métrique de police, exactement comme justifier. Un critère qui refuserait `justify` sur ce
motif refuserait aussi les deux membres que le dépôt livre déjà : **il prouve trop, donc il ne prouve
rien**. Ce que le lot E6 interdit, c'est qu'un moteur **lise son environnement** — horloge, locale,
fuseau, aléa —, jamais qu'il mesure une fonte **qu'il a lui-même chargée**.

**La ligne de partage n'est donc pas « mesurer ou non » : c'est « la mesure change-t-elle la
GÉOMÉTRIE que le contrat déclare, ou seulement le tracé à l'intérieur d'une géométrie déjà
déterminée ? »** `justify` ne déplace aucune boîte : la boîte du bloc est celle que `padding` et la
largeur du parent déterminent, et la justification ne redistribue que du blanc **à l'intérieur**
d'elle. `auto` déplace la boîte. C'est pour cela que l'un entre et l'autre pas.

**La vérification, jouée dans les deux sens — sinon le critère est décoratif.**

| Champ retenu | porteur(s) | 1 | 2 | 3 | 4 | charge de justification |
| :--- | :--- | :-: | :-: | :-: | :-: | :--- |
| `Typography.family` | 3 segments + `TextNode` | ✓ | ✓ | **✗** | ✓ | « **polices** et tailles » — **exception nommée** |
| `Typography.sizePt` | idem | ✓ | ✓ | ✓ | ✓ | « polices et **tailles** » |
| `Typography.bold` | idem | ✓ | ✓ | ✓ | ✓ | « **graisse** et italique » |
| `Typography.italic` | idem | ✓ | ✓ | ✓ | ✓ | « graisse et **italique** » |
| `Typography.color` | idem | ✓ | ✓ | ✓ | ✓ | « **couleurs de texte** et de fond » |
| `BoxStyle.background` | 5 nœuds | ✓ | ✓ | ✓ | ✓ | « couleurs de texte et **de fond** » |
| `BoxStyle.border` (4 arêtes) | 5 nœuds | ✓ | ✓ | ✓ | ✓ | « **bordures et filets** » |
| `BoxStyle.padding` (4 arêtes) | 5 nœuds | ✓ | ✓ | ✓ | ✓ | « **espacements** » |
| `TextNode.align` | `TextNode` | ✓ | ✓ | ✓ | ✓ | « **alignements** » |

**Deux exceptions, nommées plutôt que dissimulées.**

1. **`family` échoue la condition 3**, et il entre quand même, porté par **deux arguments
   mécaniques** : (a) `core.md` place « **polices** et tailles » en tête du périmètre du lot ;
   (b) la frontière est **déjà tracée dans le dépôt et passe à l'intérieur du sujet** —
   `engine.md:168` distingue **désigner** une ressource de la **charger**. C5 désigne. L'exception
   est **bornée par sa formulation** : C5 stocke **un nom**, jamais une pile, jamais une URL, jamais
   une métrique — et le danger que ce nom soit une **indirection vers la machine** est **inscrit**
   dans la docstring (décision 9) et légué en dette à E6 et E8.
2. **`align` sur `TableColumn` est une exception préexistante du dépôt**, et cette ADR la cite :
   `ast/types.ts` dit que `align` « *FAILS the second* » condition du critère de C3 et y figure
   quand même. Un texte qui invoque ce critère pour délimiter C5 sans citer l'exception invoquerait
   une règle que le dépôt a **déjà mise en défaut lui-même**.

**Le décompte, recompté — un décompte non recompté est un décompte faux.** `core.md:207-217` énumère
**six groupes virgulés** et **dix attributs** : police, taille, graisse, italique, couleur de texte,
couleur de fond, bordure, filet, alignement, espacement. Le contrat les couvre par **neuf
déclarations de champ**, dont deux quadruplets d'arêtes. Cette ADR **ne recopie ni « sept familles »
ni « douze champs »** : ni l'un ni l'autre n'est reproductible sous un découpage nommé.

---
## Les dix-huit décisions

> **Forme imposée du dépôt**, pour chacune : `**Décision.**` à l'indicatif, sans conditionnel ·
> `**Pourquoi.**`, le motif tel qu'il s'écrit **avant** la décision, avec la mention **mesuré** ou
> **raisonné** · `**Écarté.**` avec ses branches · `**Réversible**` / `**Irréversible**` avec son
> **signal de réouverture** quand il en a un.
>
> **Dix-huit**, et le nombre est écrit plutôt que caché : C3 et C4 en portent treize chacun, mais
> tous deux livraient **une** famille de formes. C5 en livre **deux** (la boîte et la typographie),
> sur **neuf** sites d'accrochage, avec une conversion d'unité et deux précédences à écrire.

### Vue d'ensemble

| # | Décision | Forme stockée ? | Réversible ? |
| :-- | :--- | :--- | :--- |
| **1** | Le critère d'appartenance, en **quatre** conditions, écrit avant la liste des champs | — | comme texte |
| **2** | **Deux natures, deux formes stockées** : `BoxStyle` et `Typography` | **oui** | non |
| **3** | `box` sur **cinq** types de nœud, jamais sur `NodeBase`, jamais sur les trois nœuds de contrôle | **oui** | dans un seul sens |
| **4** | `typography` sur `TextNode` **et** sur les trois kinds de segment ; **deux** termes ; pas de type « Resolved » | **oui** | pour la fonction |
| **5** | `align` est **DEUX faits** : `TEXT_ALIGNMENTS` (4 membres) sur `TextNode`, `TableColumnAlignment` (3) inchangé | **oui** | non |
| **6** | **Deux unités**, la conversion exportée **une fois**, et **aucune contrainte de décimales** | **oui** | non |
| **7** | Les bornes sont **importées**, jamais recopiées ; `MAX_FONT_SIZE_PT` est **dérivé** | non | oui |
| **8** | Une couleur est six chiffres hexadécimaux, **dans les deux casses**, en **sRGB** ; aucun alpha | **oui** | dans un seul sens |
| **9** | Le nom de police est une **déclaration** ; le contrat n'en police pas la résolution et **inscrit le danger** | **oui** | non |
| **10** | **La forme canonique est l'ABSENCE** : objet de style vide **refusé**, filet d'épaisseur nulle **refusé** | **oui** | non |
| **11** | Les espacements : **`padding` seul** — **et le modèle de boîte est écrit**, tableau et ligne compris | **oui** | dans un seul sens |
| **12** | Aucune cascade, aucun défaut de document, aucun `z.default()`, **aucune expression de style** | — | non pour l'expression |
| **13** | **La porte de type d'abord** : huit paires `*_KEYS_IN_STEP` avant tout champ de style | non | — |
| **14** | `CURRENT_SCHEMA_VERSION = 6`, **estampille seule** ; la section de version ne recopie pas l'asymétrie de la v5 | **oui** | non |
| **15** | **Zéro** code d'erreur nouveau, **zéro** site nouveau — la ligne de C4, tenue | non | — |
| **16** | Les **huit attentes envers le moteur** vivent ici, **jamais** dans une docstring | non | oui |
| **17** | Les **huit corrections du dépôt** que le lot porte | non | oui |
| **18** | Ce que le lot refuse, **par familles**, avec le lot qui possède chaque refus | — | selon |

---

### Décision 1 — Le critère d'appartenance tient en quatre conditions, et la roadmap porte la charge de justification des champs

**Décision.** Le critère écrit au [§ Le critère d'appartenance] fait foi, et la charge de
justification de chaque champ retenu est l'énumération de `core.md:207-217`, **jamais** le critère
de recette.

**Pourquoi.** *(Raisonné, contre trois constats mesurés par lecture.)* Trois critères concurrents ont
été essayés et **n'écartent pas ce qu'ils prétendent** :

- **Un critère topologique se satisfait en déplaçant le champ.** « Elle est écrite sur un nœud de
  l'arbre » écarte une table de styles nommés parce qu'elle vivrait sur le `Template` — mais posez la
  même table sur le nœud **racine**, qui **est** un `ContainerNode`, et elle passe la condition sans
  avoir changé d'un iota. **Aucune des quatre conditions retenues n'est topologique.**
- **Une condition qu'on n'applique pas à ses propres champs est décorative.** « Un moteur peut
  l'honorer sans aucune politique à inventer » validait un contrat qui **admet `weight: 450`** — et
  aucune fonte n'a cette face. Le tableau de vérification est donc joué **dans les deux sens**.
- **« Son retrait fait tomber le critère de recette » est faux pour la plupart des champs.** Mesuré
  par l'exercice complet — deux factures écrites, puis chaque champ retiré un par un : **seuls
  `family` et `background` font tomber le critère**. Une condition fausse pour 83 % des champs
  qu'elle sert à justifier est décorative au sens que les deux ADR interdisent. Elle **saute**, et la
  charge passe à l'énumération de la roadmap.

**Écarté.** (a) **Le critère de l'ADR 0004 décision 10** (« si une déclaration ne peut changer que ce
qu'un lecteur voit, elle est C6 ») : écrit pour partager **C2/C6**, dans une ADR qui se qualifie
elle-même de « frontière C2/C6 » ; pris pour un test général, il range la police, la couleur et le
filet en **C6**. Il est **signalé** (signalement K), pas réutilisé. (b) Un critère topologique.
(c) Le critère du retrait. (d) **Un critère en une condition** (« tout ce qui concerne l'apparence ») :
il admet le fond de page, le filigrane et la politique de coupe, c'est-à-dire C11, D10 et C7.

**Irréversible dans ses conséquences** — le critère décide de neuf formes stockées. **Réversible
comme texte.**
*Signal de réouverture :* un champ demandé par un intégrateur qui passe les quatre conditions et que
le lot a refusé quand même.

---

### Décision 2 — Le contrat porte deux natures d'apparence, et non un objet `style` unique

**Décision.** Exactement **deux** formes stockées, aux domaines disjoints :

- **`BoxStyle = { background?, border?, padding? }`** — le fond d'une boîte, ses quatre arêtes, son
  inset intérieur. Légal sur les **cinq** types de nœud qui **occupent une boîte dans le flux**.
- **`Typography = { family?, sizePt?, bold?, italic?, color? }`** — la forme des caractères. Légal
  sur les **trois kinds de segment** et sur **`TextNode`**.

Plus **un champ isolé**, `TextNode.align`, qui n'appartient à aucune des deux.

**Pourquoi ce découpage, et non un `style` unique.** *(Raisonné, avec un précédent écrit.)* Parce
qu'il rend la cascade **inexprimable** au lieu de l'**interdire**. Une propriété de boîte **se peint
elle-même** : aucun descendant ne la lit, donc il n'y a rien à faire descendre. Une propriété de
typographie n'a de sens que **là où il y a des caractères**. Un `style` unique posé sur un
`container` obligerait à répondre à « que fait `family` ici ? », et la seule réponse possible est
« il descend » — c'est-à-dire à écrire dans une **docstring** ce que le moteur décidera, la faute
exacte que C3 a dû défaire dans les siennes.

Le dépôt a un précédent exact de cette préférence : `Sheet` n'a **pas** de champ `orientation`,
« *a separate flag would be a second source of truth for one fact, hence an invariant to police for
a state that should not be expressible at all* » (`page/types.ts`). **Une cascade refusée par une
phrase se réintroduit au premier lot pressé ; une cascade sans site d'écriture ne se réintroduit
pas.**

**Pourquoi `align` est à part et non dans `BoxStyle`.** Parce qu'il **échoue la condition 4 sur
quatre des cinq porteurs de boîte** (décision 5). Le sortir de `BoxStyle` est ce qui permet à
`BoxStyle` de passer la condition 4 **sur ses cinq porteurs sans exception**.

**Écarté.** (a) **Un `style?: Style` unique sur tous les nœuds** : il crée l'état sans sujet que la
condition 4 refuse. (b) **`Typography` fusionné dans `BoxStyle`** : un `family` sur une `image` est
vide, un `background` sur un segment n'a pas de boîte. (c) **Un troisième objet pour l'image**
(`ImageStyle` avec un ajustement) : un ajustement d'image est une **politique de recadrage**,
condition 3. (d) **Une table de graisses nommées** : retirée, **aucun consommateur mesuré** — deux
symboles publics, donc deux engagements de compatibilité, pour une correspondance que rien
n'applique.

**Irréversible** pour les deux formes stockées : dès qu'un document les porte, les retirer est une
migration transformante.
*Signal de réouverture :* un modèle livré dans lequel la même famille de police est répétée sur
**plus de la moitié** des runs. C'est le fait observable qui rendrait la question du défaut de
document légitime, et **il se mesure sur le modèle**, pas sur une intuition.

---

### Décision 3 — `box` sur cinq types de nœud, jamais sur `NodeBase`, jamais sur les trois nœuds de contrôle

**Décision.** `readonly box?: BoxStyle | undefined` sur **`TextNode`, `ImageNode`, `ContainerNode`,
`TableNode` et `TableRowNode`**. **Ni** sur `NodeBase`, **ni** sur `LoopNode`, `ConditionNode`,
`TableRowGroupNode`, **ni** sur `TableColumn`, `TableCell`, `PageBand`, `PageSetup`, `Sheet`,
`PageMargins`, `TextSegment`, `Template`.

**Pourquoi la coupe tombe exactement là, et elle se dit d'une phrase vérifiable.** *(Raisonné,
vérifié par lecture intégrale d'`ast/types.ts`, et le refus est tenu par le compilateur.)*

> **Un nœud qui porte directement un champ `Expression` n'est pas une boîte.**
> `LoopNode.each`, `ConditionNode.when`, `TableRowGroupNode.each` — et aucun des cinq autres n'a de
> champ `Expression` direct : une liaison de texte vit dans le **segment**, pas dans le nœud.

Ces trois nœuds produisent *N séquences de blocs*, *leurs enfants ou rien*, *N lignes* : un style y
est **sans sujet**, ce qui échoue la condition 4. Et **le refus ne coûte aucune capacité** : « un
fond par itération » s'écrit `loop > container(box)`, « un fond autour de toutes les itérations »
s'écrit `container(box) > loop`. Les deux intentions sont déjà exprimables, **distinctement**, avec
zéro champ nouveau. Un style sur la boucle serait au contraire la seule forme dont le contrat ne
saurait pas dire laquelle des deux elle signifie.

**Pourquoi `tableRow` reste dans les cinq, et ce que ça coûte.** *(Raisonné, et c'est le porteur le
plus discutable de la liste — il faut le dire.)* Un `tableRow` est une **bande horizontale** :
`background` la peint, `border.top`/`border.bottom` y tracent des filets, `padding` l'insère de son
contenu. Les trois ont un sens. Le bandeau d'en-tête de tableau est le **second dispositif de
différenciation visuelle d'une facture** (mesuré : `background` est l'un des deux seuls champs qui
portent le critère de recette), et sans porteur de ligne il faudrait **un `ContainerNode` par
cellule** pour peindre une bande, soit +5 nœuds pour un en-tête de cinq colonnes. **Ce qui a été
retiré pour que la condition 4 passe, c'est l'espacement inter-enfants (décision 11) et l'alignement
(décision 5)**, les deux champs ambigus sur ce porteur.

**Pourquoi pas `NodeBase`.** *(Deux motifs, dont un mesuré.)* (1) Il donne le champ aux trois nœuds
de contrôle, donc crée l'état sans sujet. (2) **L'économie annoncée est fausse** : `ast/schemas.ts`
**n'a pas de `nodeBaseSchema`**, les huit `z.object` répètent `id: nodeIdSchema` littéralement — un
champ sur `NodeBase` demanderait donc **huit** éditions de schéma au lieu de cinq, et l'oubli d'une
seule est **silencieux**.

**Pourquoi optionnel et non requis, mesuré.** Un `box` **requis** rendrait la migration
**transformante** et l'obligerait à traverser l'AST — le premier code de `migrate.ts` qui
connaîtrait la forme des nœuds — pour un coût mesuré de **+324 valeurs (+59,1 %)** sur le modèle du
playground contre **+8** pour une baseline unique. Et **170 sites de littéral de nœud dans 11
fichiers** rougiraient en `TS2741`.

**Écarté.** (a) **`NodeBase`**. (b) **Les huit types de nœud** : `loop`, `condition`,
`tableRowGroup` échouent la condition 4. (c) **Quatre types seulement, sans `tableRow`** : le
bandeau d'en-tête coûte alors un conteneur par cellule, et le critère de recette perd le meilleur
site de son second champ porteur. (d) **`TableCell`** : une cellule n'est pas un nœud (pas d'`id`),
et y poser un `BoxStyle` complet recréerait sur la cellule ce que le critère de C3 refuse à la
colonne. (e) **`PageBand`** : inutile — `PageBand.content` **est** un `ContainerNode`, donc **dès que
`box` est sur `ContainerNode`, une bande l'a gratuitement, sans une ligne dans `page/`**.
(f) **`Template`** : son type est **inféré de son schéma**, donc aucune paire `*_KEYS_IN_STEP` n'y
est possible (signalement H).

**Irréversible** pour les cinq sites. **Réversible dans le sens de l'élargissement seulement** :
ajouter un sixième porteur plus tard est une estampille ; en retirer un est une migration
transformante.
*Signal de réouverture :* un modèle livré dans lequel une bande porte un fond que `PageBand.content`
ne sait pas exprimer — et à ce jour, **rien ne l'indique**.

---

### Décision 4 — `typography` vit sur `TextNode` et sur les trois kinds de segment ; la résolution a deux termes, elle est exportée, et elle ne s'appelle pas « Resolved »

**Décision.** `readonly typography?: Typography | undefined` sur **`TextLiteralSegment`,
`TextBindingSegment`, `TextPageFieldSegment`** et sur **`TextNode`**. La résolution est
**`resolveTypography({ run, block }): Typography`** — **deux** termes, fusion **par propriété**,
`run` d'abord. Elle rend un **`Typography`**, dont les cinq champs restent optionnels. **Il n'y a
pas de type `ResolvedTypography`.**

**Pourquoi le nom disparaît, et c'est mesuré.** Un type qui rendrait chaque clé de `Typography`
obligatoire **ne résout rien** : rendre la **clé** obligatoire ne rend pas la **valeur** définie, et
le type de la valeur contient déjà `| undefined` puisque `exactOptionalPropertyTypes` l'impose.
Mesuré **deux fois indépendamment**, cinq diagnostics :

```
error TS2322: Type 'string | undefined' is not assignable to type 'string'.
```

Un consommateur qui appelle une fonction nommée `resolve` et reçoit un type nommé `Resolved` doit
encore inventer cinq valeurs. **Un nom qui promet ce que le type ne livre pas est pire qu'aucun
nom** — c'est le reproche que cette même ADR adresse à `Color = string`, et le remède est
symétrique : dire la vérité dans le nom et dans la docstring.

**Pourquoi deux termes et pas un — le chiffre est l'argument.** *(Mesuré sur le modèle du
playground.)* « Une police, une taille, pour toute la facture » — la déclaration la plus banale qu'un
modèle de facture fait — coûte :

| forme d'écriture | coût | facteur |
| :--- | ---: | ---: |
| par **segment** (41 sites) | **+123 valeurs (+22,4 %)** | 41× |
| par **nœud texte** (20 sites) | **+60 valeurs (+10,9 %)** | 20× |
| dans un `Template.style` **unique** | **+3 valeurs (+0,5 %)** | 1× |

Un contrat qui refuse **à la fois** le nœud **et** la baseline n'offre aucun moyen de dire « cette
facture est en Helvetica 10 » autrement qu'en l'écrivant **41 fois**. Le second terme divise le coût
par deux **sans mandat produit** ; le troisième le diviserait par 41 **avec** un mandat — c'est
l'arbitrage n° 1, tranché en **deux termes**.

**Pourquoi la résolution est exportée, et sur quel motif — pas celui de `printableAreaOf`.**
*(Mesuré, et c'est la correction d'un motif faux.)* `a ?? b` n'a **aucune** représentation
flottante : deux implémentations de « la famille du run, sinon celle du bloc » ne peuvent pas
diverger. Le motif de `printableAreaOf` est **arithmétique** — `215.9 - (25.4 + 25.4)` rend
`165.10000000000002` et `(215.9 - 25.4) - 25.4` rend `165.1` — et il **ne s'applique pas**. Le motif
valable est celui de `Template.page` requis : **une convention écrite une fois dans `core` bat une
convention réinventée par chaque rendu**, « *with nothing checking that the viewer invents the same
one* ». Écrire l'autre motif serait invoquer un précédent qui ne s'applique pas, ce que l'ADR 0004 a
reproché à `declaredScaleOf` avant de la refuser.

**Pourquoi `pageField` aussi.** Le numéro de page a une police. Poser un `typography` sur un
marqueur est cohérent ; y poser une **expression** rouvrirait la boucle de rétroaction que
`pageField` existe pour fermer — et la décision 12 refuse l'expression de style partout.

**Ce que la fonction ne fait pas.** Elle ne fournit **aucun défaut** : les cinq valeurs manquantes
sont des **attentes envers le moteur**, écrites au [§ Conséquences] et **jamais** dans une
docstring.

**Écarté.** (a) **Segments seuls** : coûte **41×** la déclaration la plus fréquente, mesuré.
(b) **`TextNode` seul** : « Total : **1 200 €** » — une graisse à l'intérieur d'une phrase — devient
inexprimable, et c'est nommément ce que l'ADR 0002 avait laissé ouvert : « *La porte reste ouverte à
des marques (gras, italique) sur un segment littéral : un champ optionnel de plus, au prix d'un
incrément de `schemaVersion`* ». (c) **Trois termes avec `Template.style` requis** : second
rétrécissement non vacuous du dépôt, **28 tests en échec dans 6 fichiers** (mesuré), et une police
de compatibilité est **pire qu'A4**. (d) **`Typography` sur `ContainerNode`** : une cascade par un
autre nom. (e) **`Typography` sur `TableColumn`** : la police des cellules descendrait, et le
critère de C3 refuse la police sur une colonne dans une docstring publiée. (f) **Un type
`ResolvedTypography`** : impossible sans inventer cinq valeurs dans `core`.

**Irréversible** pour les quatre sites d'accrochage. **Réversible** pour la fonction — c'est du code
sans forme stockée.
*Signal de réouverture :* un modèle livré dont plus de la moitié des nœuds texte répètent la même
famille. C'est le seuil qui rendrait le troisième terme légitime, et il se **mesure**.

---

### Décision 5 — `align` est DEUX faits et non un

**Décision.** Un tuple **neuf**, `TEXT_ALIGNMENTS = [...TABLE_COLUMN_ALIGNMENTS, 'justify']`, et son
type `TextAlignment`. `readonly align?: TextAlignment | undefined` sur **`TextNode` et rien
d'autre**. `TABLE_COLUMN_ALIGNMENTS` **n'est ni élargi ni touché** : trois membres, `justify` exclu.
La fonction exportée est **`resolveTextAlign({ text, column })`**, et ce qu'elle résout est un
**défaut**, pas une rivalité.

**Ce qu'une rédaction antérieure avait confondu, et pourquoi ça ne se rattrape pas par une
précédence.** Elle réutilisait `TableColumnAlignment` sur `TextNode` au motif qu'un second tuple aux
membres identiques serait « une seconde orthographe d'un fait ». **Les membres étaient identiques ;
le fait ne l'était pas.** Un tuple est un **domaine de valeurs**, pas un fait — et deux faits
distincts partagent parfaitement un domaine.

**La démonstration, et elle tient en une cellule.** `TableCell.children` est `readonly BlockNode[]` :
une cellule contient « *a paragraph, two paragraphs, an image, a condition, a nested loop* » — la
docstring publiée l'énumère.

| Ce que la cellule contient | Ce que `TableColumn.align` devrait signifier | Ce que `TextNode.align` peut signifier |
| :--- | :--- | :--- |
| un `text` | *(les deux coïncident, et c'est ce qui a masqué l'erreur)* | la distribution de ses runs dans sa boîte |
| une `image` | pousser l'image vers la droite de la cellule | **rien — il n'y a aucun run** |
| un `container` | placer le bloc dans la cellule | **rien — un conteneur n'a pas de run** |
| deux `text` | le même défaut pour les deux | **un alignement chacun**, et ils peuvent différer |

Le cas dégénéré — une cellule qui contient exactement un paragraphe — les fait coïncider, et c'est
très exactement le cas que la rédaction fautive avait en tête. Les trois autres lignes suffisent à
la réfuter.

**Comment le contrat s'en sort sans écrire de modèle de mise en page.** Il **rétrécit le sens** de
`TableColumn.align` à ce que le lot peut honnêtement soutenir, et il l'écrit dans la docstring :
*le défaut de `TextNode.align` pour les blocs de texte des cellules de cette colonne*. C'est une
**correction de docstring**, pas un rétrécissement de schéma : la forme stockée de `TableColumn` ne
bouge pas d'un caractère, aucune migration n'est due, aucun document existant ne devient invalide.

**`TableColumnAlignment` est un sous-type strict de `TextAlignment`**, et c'est exactement le fait à
exprimer : une **colonne** ne peut pas déclarer `justify`, un **bloc de texte** le peut. Le corps
reste `text ?? column` et **compile sans élargissement ni assertion**. Le tuple est **dérivé par
étalement**, et il vit dans `ast/types.ts` à côté de celui dont il dérive : le dériver depuis
`style/` exigerait d'importer la **valeur** de l'autre tuple, ce qui ajouterait une arête de runtime
`style/ → ast/` dans un graphe où `ast/ → style/` existe déjà — **exactement la configuration
d'initialisation ESM** que ce lot a mesurée sur le barrel de `page/` (signalement O).

**Pourquoi `TextNode` reste le seul porteur.**

| porteur candidat | ce que `align` y signifierait | verdict |
| :--- | :--- | :--- |
| `TextNode` | la disposition de ses runs dans sa boîte | **le seul site qui a un sujet** |
| `ImageNode` | une **politique de recadrage** | condition 3 |
| `ContainerNode` | l'alignement transversal de ses enfants blocs — un **modèle de mise en page** | condition 3 |
| `TableNode` | la position du tableau dans son parent — un tableau occupe la largeur de contenu de son parent, donc **il n'y a rien à aligner** | condition 4 |
| `TableRowNode` | le défaut des cellules — **exactement `TableColumn.align`** | condition 4, et double déclarant |

**Pourquoi `justify` ENTRE.** *(Le motif long est au [§ Le critère d'appartenance].)* Le dépôt le
refusait parce que justifier exige de mesurer les mots, donc une métrique de police, donc « une
lecture de la machine ». **Ce motif prouve trop** : `center` et `end` sont publiés depuis C3 et
exigent la même métrique. Il reste la vraie moitié de la condition 3, la politique, et **elle
s'écrit en deux phrases que le contrat prend, comme il prend sRGB** — ce sont les attentes n° 7 du
[§ Conséquences].

**Et le coût d'incompatibilité est NUL, ce qui rend la branche gratuite.** Élargir
`TABLE_COLUMN_ALIGNMENTS` aurait été la **troisième forme d'incompatibilité** — `invalid_value`,
`Invalid option: expected one of "start"|"center"|"end"`, sur un chemin de discriminant, mesuré —,
une forme qu'`AGENTS.md` §1.2 **ne nomme pas** (signalement A). **Un tuple neuf sur un champ neuf ne
produit rien de tel** : `TextNode.align` n'existe pas avant ce lot, donc un build antérieur qui
rencontre un document v6 tombe sur l'**estampille** et rend le message typé de
`TemplateMigrationError`.

**Écarté.** (a) **Réutiliser `TableColumnAlignment` sur `TextNode`** : deux faits sous un nom.
(b) **`justify` ajouté à `TABLE_COLUMN_ALIGNMENTS`** : la troisième forme d'incompatibilité, et un
`justify` de **colonne** n'aurait de sens que pour les cellules qui contiennent du texte — il
rouvrirait la confusion qu'on vient de fermer. **Le refus est épinglé par un test.** (c) **Un champ
d'alignement sur `TableCell`** : une cellule n'est pas un nœud, elle n'a pas d'`id`, une Command
d'éditeur ne l'adresse pas ; les deux docstrings qui l'annonçaient sont **redirigées**.
(d) **`align` dans `BoxStyle`** : quatre des cinq porteurs échouent la condition 4. (e) **Un
alignement vertical en cellule** : arbitrage n° 9 — aucune hauteur déclarée, aucun porteur.

**Irréversible** pour les deux champs et pour le tuple. **Réversible** pour la fonction.
*Signal de réouverture :* un intégrateur dont le modèle exige un alignement de **cellule** au sens
plein — une image poussée à droite dans sa cellule. La réponse d'aujourd'hui est « un conteneur, et
son `padding` », et le jour où elle ne suffit plus, c'est un **modèle de mise en page de table**
qu'il faut, donc C11, et non un champ de plus ici.

---

### Décision 6 — Deux unités, la conversion exportée une seule fois, et aucune contrainte de décimales

**Décision.** Une taille de police est en **points** et son champ porte l'unité : **`sizePt`**. Toute
autre longueur du contrat est en **millimètres fractionnaires**, et son champ **ne porte pas
l'unité** — parce que le millimètre est l'unité par défaut du contrat depuis C4, et que la seule
exception est celle qui la nomme. La conversion est écrite **une fois** et **exportée** :
**`mmFromPt(pt) => (pt * 25.4) / 72`** et **`ptFromMm(mm) => (mm * 72) / 25.4`**. **Aucune
contrainte de décimales, nulle part.**

**Pourquoi deux unités, et pourquoi ce n'est pas l'écart (e) de l'ADR 0006 retourné contre nous.**
*(Raisonné, avec une mesure.)* L'ADR 0006 a écarté les points typographiques sur un motif de
**lisibilité** : « *illisibles pour l'auteur (« marge de 57 points »)* ». Ce motif **s'inverse** pour
une taille de police : « police de 3,53 mm » est illisible pour exactement la même raison, et
**10 pt n'est pas représentable exactement en millimètres** — mesuré, `mmFromPt(10)` rend
`3.5277777777777777`. Le point est de surcroît l'unité de l'espace utilisateur du PDF, donc une
taille traverse le moteur **sans conversion**.

**Pourquoi la conversion est exportée — et c'est ici que le motif de `printableAreaOf` s'applique
vraiment.** *(MESURÉ.)* Deux unités dans un contrat obligent quelqu'un à convertir, et **la
conversion n'est pas associative** :

```
(14400 * 25.4) / 72  ->  5080                 === MAX_SHEET_MM
14400 * (25.4 / 72)  ->  5079.999999999999    PAS MAX_SHEET_MM
15 pt : (v * 25.4) / 72 -> 5.291666666666667
        v * (25.4 / 72) -> 5.291666666666666
```

**4 538 des 14 400 tailles entières — 31,5 % — rendent un double différent selon la forme**, et
8 774 sur 14 400 (60,9 %) divergent d'au moins une autre si l'on compte quatre formes. **Les deux
chiffres sont exacts, et aucun ne se cite sans dire combien de formes il compare.** La dernière ligne
du relevé est la plus instructive : la conversion naïve de la borne **ne rend pas la borne**.

**La forme retenue est une propriété, pas une préférence : MULTIPLIER D'ABORD, DIVISER ENSUITE.**
C'est la seule des quatre qui reporte le plafond du contrat exactement dans les deux sens, ce qui
est ce qui rend `MAX_FONT_SIZE_PT` **dérivable** au lieu d'être redéclaré.

**Ce que les deux fonctions ne promettent PAS.** *(MESURÉ.)* **Elles ne sont pas inverses** :
`ptFromMm(mmFromPt(v)) !== v` pour **223 des 1 000 premières tailles entières** — 3, 6, 12, 23, 24,
29 parmi elles. Un consommateur convertit **une fois**, dans le sens dont son rendu a besoin, et ne
fait jamais l'aller-retour sur une valeur stockée. Un test épingle l'une de ces valeurs.

**Les consommateurs existent aujourd'hui, et c'est le critère d'export du dépôt.** L'ADR 0004 a
**refusé** `declaredScaleOf` au motif qu'elle n'avait « *aucun consommateur aujourd'hui* ». Ici : le
**playground**, qui dessine désormais deux factures à une échelle déclarée en px/mm et convertit
chaque taille par cette fonction ; **E1**, qui rend en points ; **V1**, qui rend en pixels CSS.
Trois consommateurs nommés, **dont un livré dans ce lot**.

**Pourquoi aucune contrainte de décimales, et le piège nomme le mauvais champ.** *(MESURÉ deux
fois.)* L'ADR 0006 avertit C5 : « *À ne pas recopier : la même formule paraîtra tentante en C5 pour
une **taille de police**.* » **L'avertissement est juste dans son principe et faux dans son
exemple** : des demi-points de 6 à 72 pt, un contrôle d'intégralité à deux décimales n'en refuse
**aucun**. Il mord une **épaisseur de filet de 0,28 mm — c'est-à-dire 0,8 pt, une épaisseur standard
en édition** — et un interligne de 1,15. Recopier l'avertissement sans le remesurer aurait transmis
une justification fausse dans une docstring qui vivra dix ans. Le motif qui suffit seul est celui que
C4 a **appliqué** plutôt qu'écrit : `page/schemas.ts` ne porte **aucune** contrainte de décimales,
seulement `min`/`max`.

**Écarté.** (a) **Tout en millimètres** : rend « 10 pt » inexprimable exactement. (b) **Tout en
points** : rétablit « marge de 57 points ». (c) **Un `{ value, unit }`** : une unité déclarée par le
document, refusée par l'ADR 0006 D13. (d) **Une échelle relative (`em`, `%`)** : relative à un
ancêtre, donc une cascade. (e) **Des dixièmes de millimètre entiers** : rend `10 pt` toujours
inexact. (f) **Deux unités sans conversion exportée** : 31,5 % de divergence mesurée, et c'est la
décision produit 7 qui tombe. (g) **L'unité dans le nom de tous les champs** : divergerait de
`PageMargins { top, right, bottom, left }`.

**Irréversible** — changer d'unité plus tard est **transformant** : chaque valeur stockée se
recalcule.
*Signal de réouverture :* « une divergence mesurée entre l'aperçu et le PDF imputée à l'arrondi
d'une longueur fractionnaire » — le signal que l'ADR 0006 a lui-même écrit pour l'option EMU.

---

### Décision 7 — Une borne s'importe, elle ne se recopie pas ; et `MAX_FONT_SIZE_PT` est dérivé

**Décision.** `packages/core/src/style/` **importe `MAX_SHEET_MM`** et n'en déclare aucun homonyme.
`MAX_FONT_SIZE_PT` est **dérivé** : `ptFromMm(MAX_SHEET_MM)`. Les seules bornes propres au lot sont
**`MIN_FONT_SIZE_PT = 1`** et le plancher `0` des longueurs, qui n'a pas besoin d'un nom.

**Pourquoi.** *(MESURÉ, et le dépôt a déjà tranché ce cas dans une docstring de production.)* Une
constante propre au lot valant `5080` **serait** `MAX_SHEET_MM` sous un second nom, sans lien. Et la
seconde borne est la première dans l'autre unité, **exactement**, dans les deux sens, en binary64 :
`5080 * 72 / 25.4` rend `14400`, et `14400 * 25.4 / 72 === 5080` est `true`.

`template/guard.ts` a écrit la règle : « *The same schema and the same ceiling as
`EvaluationLimits`, **imported rather than restated**: two copies of one bound drift, and raising it
in one file would leave the other refusing values the first accepts.* » **Trois copies d'une même
longueur maximale, c'est la dérive garantie au premier ajustement.**

**Ce que l'import coûte, dit franchement.** `style/` dépend de `page/`, donc le sous-graphe
d'apparence n'est plus une racine indépendante dans `core`. Le précédent existe et il est du même
sens : `template/guard.ts` importe déjà `page/`. Aucune règle `noRestrictedImports` ne s'y oppose —
l'interdit porte sur les paquets **frères**, pas sur les dossiers de `core`.

**Et un test épingle l'égalité**, parce qu'une dérivation muette se « corrige » :
`MAX_FONT_SIZE_PT === 14_400` **et** `mmFromPt(MAX_FONT_SIZE_PT) === MAX_SHEET_MM` **et**
`ptFromMm(MAX_SHEET_MM) === MAX_FONT_SIZE_PT`. Épingler un chiffre exact ici est un service rendu,
pas une redondance : c'est ce qui empêche quelqu'un de « ranger » la conversion en facteur
pré-calculé, qui rend `5079.999999999999`.

**Écarté.** (a) **Recopier `5080`** : la dérive. (b) **Écrire `14_400` à la main** : le nombre est
juste, le **lien** est perdu. (c) **Écrire pourquoi une longueur d'apparence est une borne
*différente* qui coïncide** : c'était l'autre issue honnête, et elle est **plus chère** — il faudrait
justifier par écrit une coïncidence exacte à 14 chiffres significatifs. (d) **Ne pas borner du
tout** : `MAX_SHEET_MM` est documenté comme « *an OPENVIEW INTEROPERABILITY BOUND* », et une taille
sans plafond rouvre la classe de déni de service que `MAX_BANDS_PER_SIDE` a mesurée.

**Réversible** — c'est du code sans forme stockée.
*Signal de réouverture :* aucun.

---
### Décision 8 — Une couleur est six chiffres hexadécimaux derrière un dièse, dans les deux casses, interprétés en sRGB, et sans canal alpha

**Décision.** `ColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'A colour is six hexadecimal
digits behind a hash, as #1b3a6f')`. Le type `Color = string` est un alias **documentaire**, et sa
docstring le dit. **Les six chiffres sont interprétés en sRGB** : le contrat prend la convention
plutôt que de la laisser à chaque moteur. **Aucun canal alpha.**

**Pourquoi la chaîne hexadécimale.** Une valeur, une position, aucune table de correspondance
publiée. Un `{ r, g, b }` coûterait **trois** valeurs par couleur au lieu d'une, et trois bornes à
écrire, pour une expressivité identique. Une table de **noms CSS** ferait dépendre le contrat d'une
convention de rendu qu'il ne publie pas.

**Pourquoi les deux casses — et c'est une décision, pas un oubli.** *(MESURÉ.)* Avec `[0-9a-f]{6}`,
`'#FFAA00'` est **refusé**, et c'est ce que tout outil de design émet ; refuser le copier-coller le
plus banal du métier est hostile. Le contrat garde donc les deux casses — **et il cite le précédent
qu'il contredit** : `page/types.ts` refuse `margins: 20` à côté de quatre arêtes comme « une seconde
orthographe d'un fait ». Le motif qui les distingue est mesurable : `margins: 20` contre quatre arêtes
sont **deux formes qu'un consommateur doit normaliser**, tandis que `#FFAA00` et `#ffaa00` sont **une**
forme lue par la même expression rationnelle, **sans expansion**. La forme courte `#fa0`, elle,
coûterait une expansion : refusée.

**Ce que la double casse coûte, et le contrat le dit.** Une **comparaison d'égalité** entre `#FFAA00`
et `#ffaa00` échoue. Un consommateur qui compare des couleurs — un éditeur qui surligne « les blocs
de la même couleur », un contrôle de parité V3 — **replie la casse**. C'est écrit dans la docstring,
parce qu'un refus non écrit se rouvre au premier client. **Soixante-quatre orthographes** sont
stockables pour une couleur à six chiffres alphabétiques, et un test épingle le fait que le parse ne
replie **rien**.

**Pourquoi l'espace colorimétrique est DÉCLARÉ.** *(MESURÉ : une recherche d'espace colorimétrique sur
`packages apps docs AGENTS.md README.md` rend **zéro occurrence**.)* `#1b3a6f` est un triplet
d'octets ; il n'a de **couleur** que rapporté à un espace. Un moteur PDF peut écrire `DeviceRGB` (dont
l'interprétation est laissée au lecteur), un profil ICC sRGB, ou convertir en CMYK ; un viewer
navigateur rend en sRGB. **Trois couleurs pour un même triplet**, là où la décision produit 7 promet
l'identité et `docs/qa/README.md` la durcit en « au pixel près ». C'est le pendant exact d'une
**unité** manquante. C4 n'a jamais eu ce problème parce qu'il a écrit « millimètres » partout.

**Pourquoi aucun canal alpha, avec son propriétaire.** La **composition** est un modèle de rendu, donc
les **calques de C11 / décision 10**. Le contrat le refuse déjà par la forme — mesuré,
`'#1b3a6fff'` rend `invalid_format` — mais **un refus non écrit se rouvre**, donc il est écrit.

**Ce que la forme refuse, avec son propriétaire.** *(Tous MESURÉS, tous avec le même message
constant, et aucune interpolation du document dans le message.)*

| Refusé | Entrée | `code` mesuré | Propriétaire du besoin |
| :--- | :--- | :--- | :--- |
| noms CSS | `'red'` | `invalid_format` | personne — une convention de rendu |
| forme courte | `'#fa0'` | `invalid_format` | personne — seconde orthographe |
| canal alpha | `'#1b3a6fff'` | `invalid_format` | la composition, donc **C11 / D10** |
| notations fonctionnelles | `'rgb(1,2,3)'` | `invalid_format` | personne — c'est un **parseur** |
| couleurs système | `'Canvas'` | `invalid_format` | **personne, jamais** — lecture de la machine |
| un nombre | `0x1b3a6f` | `invalid_type` | — |
| CMYK, tons directs, profils | — | — | une chaîne d'impression : **E1 / E8**, ou hors v1 |

**Pourquoi `Color = string` reste, et pourquoi la docstring doit le dire.** *(MESURÉ : exit 0.)*
L'alias **n'interdit rien** — `const notAColour: Color = 'Total TTC'` compile. La garantie est
**entièrement** à l'exécution, dans `ColorSchema`. Écrit ainsi, l'alias est honnête ; non écrit, il
fait croire à une garde inexistante — le reproche exact adressé à un type nommé « Resolved ».

**Écarté.** (a) **Un type marqué (*branded*)** : le construire demande une assertion, qu'`AGENTS.md`
§1.1 interdit sous ses deux orthographes. (b) **`{ r, g, b }`**. (c) **Une table de noms** : une
convention de rendu dans un contrat qui n'en publie aucune. (d) **Une casse unique** : refuse
`#FFAA00`, mesuré. (e) **Ne pas déclarer l'espace** : trois couleurs pour un triplet, contre une
promesse d'identité.

**Réversible dans un seul sens** : élargir la regex (accepter `#rrggbbaa`) est un élargissement ; la
rétrécir après qu'un document a été enregistré ne l'est pas.
*Signal de réouverture :* un intégrateur dont l'imprimeur exige un **ton direct** — et la réponse
d'aujourd'hui est « pas exprimable », dont le coût est réel.

---

### Décision 9 — Un nom de police est une déclaration : le contrat n'en police pas la résolution, et il inscrit le danger

**Décision.** `family: z.string().min(1, 'A font family name is required')`. **Aucun refus par le
schéma.** La docstring de `family` **inscrit le danger** : un nom peut être une **indirection vers la
machine**. Et cette ADR porte une **attente nommée envers E6 et E8**.

**Pourquoi aucun refus par le schéma.** *(MESURÉ.)* Un simple contrôle de chaîne non vide accepte
**dix valeurs qui ne désignent aucune police** mais **la police que la machine choisit** :
`system-ui`, les cinq familles génériques CSS, `-apple-system`, `BlinkMacSystemFont`, `ui-rounded`,
`emoji`, `math`, `fangsong`. Et pourtant le schéma ne peut pas les refuser : **refuser la chaîne
`serif` refuserait une police réellement nommée *Serif***, et refuser une liste de valeurs serait une
**table noire de conventions CSS** dans un contrat qui n'en connaît aucune.

**Pourquoi c'est le trou du lot et pas un détail.** `family` est la **seule exception nommée** du
critère, et l'exception est censée être bornée par sa formulation — « C5 stocke un nom, jamais une
pile, jamais une URL, jamais une métrique ». Mais **un nom peut être une indirection**, et la
formulation ne le borne pas. Le résultat est que la seule brèche du critère est la porte par laquelle
rentre exactement ce que le lot **E6** interdit : « *Deux exécutions du même modèle sur deux machines
doivent donner le même document, au caractère près : **polices**, images…* » Et **MESURÉ, le risque
n'était nommé nulle part** dans le dépôt avant ce lot.

**La forme du remède est celle que le dépôt a déjà employée** pour la direction d'écriture : une
phrase dans la docstring — c'est-à-dire **au seul endroit qu'un intégrateur lit** — plus une attente
nommée envers un lot moteur dans l'ADR.

**Ce que le contrat ne peut PAS faire, et pourquoi ça ne l'excuse pas.** La lecture de la machine par
le **code** de C5 est barrée mécaniquement : `packages/core/tsconfig.json` (`lib: ["ES2022"]`,
`types: []`) rend `measureText`, `document.fonts` et `getComputedStyle` **inatteignables par le
compilateur**. Ce qui reste, et que **rien** n'outille, c'est la lecture par la **donnée** — une
chaîne de caractères stockée dans un document. Le plugin `no-environment-read` ne la voit pas.

**Écarté.** (a) **Une énumération fermée de polices** : l'ADR 0006 a mesuré ce qu'elle coûte — « une
estampille par police jamais demandée » — et elle rendrait toute police non listée **inexprimable**.
La liste d'un `<Select />` du designer est une **table de commodité** d'IHM, sur le patron
`as const satisfies` de `STANDARD_SHEETS_MM`, **jamais une forme stockée**. (b) **Une liste noire des
dix valeurs** : refuse une police réellement nommée *Serif*. (c) **Une pile de repli** : le repli est
une **politique**, et `engine.md` la range en E6. (d) **Un `FontPort`** : `AGENTS.md` le refuse
nommément — « *Un port pour le logging, **les polices** ou l'i18n ne se justifie pas* ». (e) **Une
incorporation de police (URL, fichier)** : E8, liste blanche des requêtes sortantes.

**Irréversible** — c'est une forme stockée. Le **danger**, lui, est réversible : c'est de la prose.
*Signal de réouverture :* un rapport de non-reproductibilité entre deux machines imputé à une police,
ce qui est nommément le critère de sortie de **E6**.

---

### Décision 10 — La forme canonique d'un style absent est l'ABSENCE

**Décision.** Trois règles, et elles disent toutes la même chose sous trois formes.

1. **`BorderEdge.width` est `gt(0, 'A rule has a positive width; omit the edge to declare no rule')`**,
   avec son plafond. Une épaisseur nulle **n'est pas** une orthographe de « pas de filet » : l'absence
   de l'arête en est une, et c'est la seule.
2. **`box: {}`, `typography: {}` et `border: {}` sont REFUSÉS**, sur chacun des trois schémas. La forme
   canonique d'« aucun style » est **le champ absent**.
3. **Le plancher de zéro subsiste sur `BoxSpacing`**, dont les quatre arêtes sont **requises** — et
   c'est là, et là seulement, que zéro est la seule façon d'écrire « pas d'espacement ».

**Pourquoi le précédent de `PageMargins` ne transpose pas — et c'est mécanique, pas rhétorique.**
`page/types.ts` écrit que refuser zéro « *would be a rule of typography* ». C'est vrai **là-bas**, et
la raison est dans la ligne du dessus : « *The four edges, in millimetres, **all four required***. »
Une marge ne peut pas être absente, donc `top: 0` est **la seule** manière d'écrire « pas de marge en
haut », et la refuser interdirait un document légitime. **`BoxBorder` a la forme opposée : ses quatre
arêtes sont OPTIONNELLES**, donc l'absence est représentable, et `width: 0` devient une **seconde
orthographe** du même fait. Le précédent ne dit pas « zéro est toujours légal » ; il dit « ne refusez
pas la seule orthographe disponible ». Ici, elle n'est pas seule.

| Longueur | l'absence est-elle représentable ? | orthographes de « rien » | prédicat |
| :--- | :--- | :--- | :--- |
| `PageMargins.top` (dépôt) | **non** — arête requise | une : `0` | `min(0)` ✔ |
| `BoxSpacing.top` (ce lot) | **non** — arête requise, sur la forme de `PageMargins` | une : `0` | `min(0)` ✔ |
| `BoxBorder.top` (ce lot) | **oui** — arête optionnelle | deux : absente, ou `{ width: 0, color }` | **`gt(0)`** |

**Et le second grief contre un prédicat strictement positif ne discrimine rien.** L'objection « il
admet 0,0001 mm, et mesuré, `5e-324` passe » **vaut identiquement pour un plancher à zéro**. Elle
oppose `> 0` à `>= 1`, qui est la question de `MIN_SHEET_MM` ; elle ne dit **rien** de `> 0` contre
`>= 0`. Le sous-pixel reste donc représentable, sur cette longueur comme sur les six autres du
contrat, et c'est assumé : le contrat borne les **fenêtres**, il ne juge pas de l'utilité d'une valeur
à l'intérieur. Un plancher nommé `MIN_RULE_WIDTH_MM` reste refusé pour deux raisons — 96 dpi est une
propriété de la **machine**, et l'ADR 0006 refuse les bornes qu'aucune mesure ne justifie.

**Ce que le message doit dire.** Une rédaction antérieure rendait `'A rule width is greater than
zero'`, qui **est** une prescription typographique, mot pour mot. Le remède n'était pas de changer le
prédicat, c'était de changer la phrase : `'A rule has a positive width; omit the edge to declare no
rule'` **énonce la doctrine et donne le remède**, ce qu'`AGENTS.md` §1.3 attend d'une erreur.

**Pourquoi l'objet de style vide est refusé.** L'accepter en écrivant « équivalent à l'absence » est
vrai **d'une LECTURE DE VALEUR**, et faux de tout le reste. Les consommateurs qui distinguent `{}` de
l'absence sont nombreux, ils sont déjà planifiés, et **aucun ne lit une valeur** :

| Consommateur | Ce qui casse avec deux formes |
| :--- | :--- |
| un **diff** de deux versions d'un modèle | il signale une modification là où rien n'a changé |
| l'**état sale** d'un éditeur | ouvrir un panneau de style et ne rien saisir marque le document modifié |
| un **hachage** de contenu (cache de rendu, empreinte de publication) | deux documents identiques ont deux empreintes |
| l'**undo/redo** du `designer` (patron Command) | une Command qui n'a rien fait entre dans l'historique, et son `undo()` n'est pas neutre |
| l'**aller-retour JSON** des fixtures | `JSON.stringify` conserve `{}` et supprime `undefined` : deux arbres « égaux » ne le sont pas |

**Et le refus est GRATUIT aujourd'hui, impossible demain** — c'est l'asymétrie que ce dépôt invoque
déjà, mot pour mot, pour `MIN_COLUMN_WIDTH` : « *Narrowing a field that no stored document can carry
yet costs nothing.* » Les trois champs sont **neufs dans ce lot** : aucun document existant ne porte
un `box`, donc aucun ne porte un `box: {}`. Le même resserrement après l'estampille serait un
**rétrécissement non vacuous**, c'est-à-dire impossible sans corrompre des documents. **La question
ne se repose pas plus tard ; elle se tranche maintenant ou jamais.**

**⚠️ Le piège du prédicat, et il est nommé parce qu'il est facile à manquer.** Écrire
`Object.keys(o).length > 0` **ne suffit pas** : sous `exactOptionalPropertyTypes`, un objet construit
en mémoire peut porter une clé dont la valeur est `undefined` — la clé est **présente**, la valeur ne
l'est pas, et le compte de clés rend 1. Ce serait une **troisième** orthographe, introduite par le
garde censé n'en laisser qu'une. Le prédicat porte donc sur les **valeurs**, et un test épingle le
cas.

**⚠️ Et le CONTRÔLE se pose par `.check` et non par `.refine` — c'est la correction que l'exécution a
imposée au plan, et elle est mesurée.** Un `.refine` d'objet reçoit la **sortie** du parse, et un
champ **optionnel** qui a échoué son propre contrôle est **retiré** de cette sortie. Donc un document
déclarant exactement une chose, mal, arrive au prédicat comme un objet vide. Mesuré, sur
`{ color: 'red' }` :

```
[["invalid_format",["color"],"A colour is six hexadecimal digits ..."],
 ["custom",[],"An empty style object is not a style; omit the field"]]
```

**DEUX issues pour UNE faute, la seconde FAUSSE** — l'auteur a bien déclaré une couleur — **et son
`path` VIDE**, ce qui est très exactement le défaut pour lequel `z.strictObject` a été refusé. Le
phénomène ne se produit que sur une faute **continuable** (`invalid_format`, `too_small`, `too_big`)
et pas sur une faute **abandonnante** (`invalid_type`), donc il est invisible dans la moitié des cas
— ce qui est pire que systématique.

Le remède n'est pas un autre prédicat, c'est la **RÈGLE DE COUPURE** que ce dépôt énonce et a déjà
mesurée, dans `checkTableWiring` : les lignes ne sont parcourues que si la liste de colonnes est
elle-même saine, parce que « *un auteur qui a une chose à corriger doit se l'entendre dire une fois,
et le lot C8 doit pouvoir le dire une fois* » — mesuré là-bas à **13 issues au lieu d'1**. Lu ici :
**on ne demande à un objet s'il est vide qu'une fois que rien d'autre n'a échoué.** `.check` est la
seule forme zod 4 qui le voie, son payload portant `issues` à côté de `value`. Ce n'est **ni** un
`superRefine`, **ni** un contrôle croisé : il regarde **un** objet, et il rend `code: 'custom'`, donc
`SHAPE_ERROR_CODES` ne bouge pas.

**Ce que ces refus coûtent, compté et non minimisé.**

1. **Trois refus neufs** — l'objet de style vide, le filet d'épaisseur nulle, `justify` sur une
   colonne —, écrits, narrés et testés. **Aucun code d'erreur neuf** pour autant.
2. **Un normalisateur côté producteur.** L'éditeur du `designer` doit **retirer** un `box` devenu vide
   au lieu de le laisser. C'est un geste, il est unique, il est chez le **producteur** — et c'est
   exactement le partage que `page/types.ts` décrit en creux quand il refuse « *a consumer that
   starts by normalising* » : **un producteur qui normalise vaut mieux que N consommateurs qui
   normalisent**. La charte du designer le reprend dans ce lot.
3. **Une fragilité à nommer.** Un contrôle porté par l'**objet** ne survit ni à `.extend()` ni à
   `.pick()` en zod 4, mesuré. Les trois schémas concernés ne sont ni étendus ni découpés dans ce lot
   — et **c'est désormais une contrainte de rédaction**, pas un hasard : une sonde de la définition de
   fini l'interdit.

**Écarté.** (a) **Un plancher à zéro sur `BorderEdge.width`** : sur un précédent qui ne transpose pas.
(b) **Un plancher nommé `MIN_RULE_WIDTH_MM`**. (c) **Accepter `{}` en écrivant « équivalent à
l'absence »** : une équivalence proclamée qu'aucun `diff`, aucun hachage et aucun `undo` n'honore.
(d) **Normaliser par un `.transform()` qui supprime l'objet vide au parse** : c'est l'issue élégante,
et elle est refusée pour une raison mesurable — un `.transform` qui rend `undefined` sur un champ
`.optional()` **laisse la clé présente** avec la valeur `undefined`, donc produit la troisième
orthographe au lieu de la supprimer ; et il ferait de `parseTemplate` une fonction qui rend autre
chose que ce qu'elle a reçu. (e) **`z.strictObject`** : mesuré, son `path` est vide et la clé fautive
n'est que dans `keys` et dans le message.

**Irréversible dans les deux sens** — un refus posé maintenant ne se retire qu'en élargissant (ce qui
est gratuit), et il ne se poserait plus après l'estampille.
*Signal de réouverture :* un éditeur pour lequel le retrait du `box` vide s'avère coûteux à tenir —
auquel cas la question n'est pas le contrat mais l'endroit où la normalisation vit, et la réponse
resterait « chez le producteur ».

---

### Décision 11 — Les espacements sont `padding` seul, et le modèle de boîte est écrit

**Décision.** `BoxStyle.padding?: BoxSpacing` où `BoxSpacing = { top, right, bottom, left }`, **les
quatre requises**, en millimètres, plancher `0`. **Pas d'espacement inter-enfants. Pas de marge.** Pas
de raccourci scalaire, pas de paire `{ vertical, horizontal }`. **Et le contrat écrit ce que ce
`padding` fait sur chacun des cinq porteurs**, y compris les deux porteurs de tableau — sans quoi il
stocke une valeur dont il ne sait pas dire le sens.

#### Le modèle de boîte, en quatre phrases — et pourquoi il DOIT être écrit

*(Raisonné. C'est le trou que la revue a nommé : donner `BoxStyle` entier à `TableRowNode` et à
`TableNode` sans dire ce qu'un `padding` y signifie laisse un padding de ligne insérer dans la largeur
disponible une soustraction que la formule publiée de `TableColumn.width` n'a pas — c'est-à-dire
**désaligner les colonnes d'une ligne à l'autre**. Le contrat ne peut pas laisser un renderer inventer
la réponse : deux moteurs conformes rendraient deux factures différentes.)*

> **① La largeur.** Un bloc occupe **la largeur de contenu de son parent**. Il n'y a pas d'exception,
> et **un tableau n'en est pas une** : c'est ce qui clôt l'arbitrage n° 4.
>
> **② Le `padding` retranche.** La largeur de contenu d'une boîte est sa largeur, moins
> `padding.left + padding.right`. Idem en hauteur. C'est la seule chose que `padding` fait.
>
> **③ Sur un `table`, les poids de colonne se résolvent contre la largeur de CONTENU du tableau.**
> La formule publiée dit « *A column receives `width / (sum of the widths of its table)` of whatever
> width **the table itself is given*** ». Ce lot dit ce que le tableau *reçoit* : la largeur de contenu
> de son parent ; et ce qu'il *partage* : sa propre largeur de contenu.
>
> **④ Sur un `tableRow`, le `padding` insète le contenu de CHAQUE CELLULE de la ligne, à l'identique
> — il ne déplace AUCUNE frontière de colonne.** `background` peint la bande, `border.top` /
> `border.bottom` tracent des filets en travers, `border.left` / `border.right` aux deux bouts.

**Pourquoi ④ et pas « la bande entière est insérée ».** Les deux lectures sont représentables, et une
seule est tenable. Insérer la **bande** déplacerait, pour cette ligne seule, l'origine et la largeur
sur lesquelles les poids se résolvent : les colonnes de la ligne d'en-tête ne tomberaient plus en face
de celles du corps. **C'est le défaut visuel que le lot existe pour empêcher.** Insérer le **contenu
de chaque cellule** ne touche à aucune frontière, donne le seul espacement qu'un tableau réclame
vraiment — de l'air dans les cellules — et laisse la formule publiée intacte.

**Et c'est le même critère qui a tué l'espacement inter-cellules sur ce porteur**, appliqué cette fois
jusqu'au bout : **le critère ne se joue pas sur le nom du champ.** Écrit comme en ④, `padding` ne
touche pas la formule ; écrit autrement, il tombait sous le même argument et sortait avec lui.

**Ce que le modèle de boîte débloque.** La chaîne de largeurs devient **entièrement déterminée par des
millimètres déclarés**, sans une mesure :

```
printableAreaOf(page)              largeur imprimable       [C4, exportée]
  └─ root: ContainerNode           − padding.left/right     [ce lot]
       └─ container                − padding.left/right     [ce lot]
            └─ table               − padding.left/right     [ce lot]
                 └─ colonne i      × width_i / Σ width      [C3, formule publiée]
                      └─ cellule   − padding.left/right de la LIGNE   [ce lot, ④]
```

**Aucun terme de cette chaîne n'est une mesure, une métrique de police ou une lecture de la machine** :
ce sont des additions et une division correctement arrondie, sur des entiers pour les poids. C'est
très exactement ce que la décision produit 7 promet — « le même nombre dans l'aperçu et dans le
PDF » —, et c'est la garantie que refuser d'écrire la règle **dégradait**. **V3 peut la vérifier ;
sans elle, V3 n'avait rien à comparer.**

**L'objection à laquelle il fallait répondre, et elle est levée.** Déclarer que « un bloc occupe la
largeur de contenu de son parent » était écarté au motif qu'« il faudrait alors répondre à *la largeur
du parent, moins quoi ?*, donc au `padding` du parent, donc à un modèle de boîte complet ». **La revue
a rendu ce modèle obligatoire pour une autre raison** — le `padding` de ligne —, donc son coût est
**déjà payé**. Une objection dont le prix est acquis n'est plus une objection : l'arbitrage n° 4 se
referme **sans un champ de plus**.

**Ce que ce modèle n'est PAS.** Il ne dit rien de la **hauteur d'une ligne** (mesurée sur le contenu —
condition 3), rien de la **fusion de deux filets adjacents** (attente n° 6), rien du **flottement** ni
d'une **fusion des bordures de tableau** — qui reste refusée comme modèle de mise en page. Il dit ce
qu'un `padding` retranche, et rien d'autre. Quatre phrases, et elles sont le prix d'un champ qui, sans
elles, ne voulait rien dire.

**Pourquoi la forme du quadruplet est imposée, et par un texte.** `page/types.ts` : « *The four edges,
in millimetres, all four required. No shorthand (`margins: 20`), no pair (`{ vertical, horizontal }`),
no inheritance: **a second spelling of one fact** means two stored shapes, two refusal paths and a
`printableAreaOf` that starts by normalising.* » C5 reproduit la forme trait pour trait, y compris le
plancher zéro, y compris les noms de champ sans suffixe d'unité.

**Pourquoi l'espacement inter-enfants sort du lot — et c'est un constat bloquant.** Il serait légal sur
**cinq** types de nœud. Passons-le sur chacun :

| Porteur | Enfants réels | Ce qu'il y signifie |
| :--- | :--- | :--- |
| `container` | `readonly children: readonly BlockNode[]` | espace entre blocs frères — **le seul cas qui a un sujet** |
| `image` | **aucun** (`src`, `alt?`) | **rien.** Un état sans sujet |
| `text` | `readonly content: readonly TextSegment[]` — des runs **inline** | de l'interlettrage à l'échelle du mot, **non déclaré** |
| `tableRow` | `readonly cells: readonly TableCell[]` | espace **inter-cellule** — voir ci-dessous |
| `table` | `columns` / `header` / `body` / `footer` | un `border-spacing` : un **modèle de mise en page de table** |

**Et sur `tableRow`, ce n'est pas seulement vide, c'est destructeur.** La docstring **publiée** de
`TableColumn.width` définit la part d'une colonne, et cette formule n'a **aucune** soustraction ; un
espacement entre cellules en insère une. **C5 modifierait donc la définition de `TableColumn.width`
par un champ posé sur un autre nœud** — et `TableColumn` est précisément le site dont le critère en
quatre conditions dit qu'un espacement n'y appartient pas. Le contrat ne peut pas obtenir par un
détour ce que le critère publié lui refuse en face.

**Pourquoi `margin` reste dehors.** *(Raisonné.)* Deux marges adjacentes **s'additionnent ou
fusionnent** : CSS fusionne, plusieurs moteurs PDF additionnent, et **choisir est une politique de
rendu** — condition 3. Le contrat pourrait **prendre** la convention (« les marges s'additionnent,
elles ne fusionnent jamais »), comme il prend sRGB, mais ce serait un troisième espacement qui
s'additionne aux deux autres, et l'ADR devrait alors écrire la somme. **Le lot ne le fait pas**, et
c'est l'arbitrage n° 6, tranché en refus.

**Le coût du refus, écrit et chiffré.** Sans les deux, un **rythme vertical non uniforme** — « plus
d'air avant le bloc des totaux » — se paie en **un `ContainerNode` par valeur d'air**, comptés par
`assertBoundedShape`. Le coût est mesurable, et le plafond n'est pas en cause : la fixture stylée du
lot occupe **0,29 %** de `maxNodes`.

**Écarté.** (a) **Un espacement inter-enfants sur les cinq porteurs** : trois n'ont pas de sujet, et
deux réécrivent une formule publiée. (b) **Le même sur `ContainerNode` seul, via un
`ContainerBoxStyle extends BoxStyle`** : c'était l'issue honnête, et elle coûte **une seconde forme
stockée** plus deux exports, pour un fait qu'un `padding` sur chaque enfant exprime déjà —
l'anti-sur-ingénierie penche dans l'autre sens. (c) **`margin`** : arbitrage n° 6. (d) **Un raccourci
scalaire ou une paire** : deux orthographes d'un fait. (e) **Un interligne** : condition 3, et c'est
**le** champ que le piège des deux décimales mord.

**Irréversible** pour `padding`. **Réversible dans le sens de l'élargissement** pour les deux refusés :
les ajouter plus tard est une estampille.
*Signal de réouverture :* un modèle livré dont le rythme vertical exige plus de **trois** conteneurs
d'espacement — c'est le fait observable, et il se compte sur le modèle.

---

### Décision 12 — Aucune cascade, aucun défaut de document, aucun `z.default()`, et aucune expression de style

**Décision.** Aucune valeur d'apparence n'est décidée ailleurs que sur le nœud ou le run qui la porte,
à **deux** exceptions nommées : les précédences à deux termes des décisions 4 et 5. Pas de
`Template.defaultStyle`, pas d'héritage par sous-arbre, pas de `inherit`, pas de `currentColor`,
**aucun `z.default()`**. Et **aucune position de style n'accepte une `Expression`**.

**Pourquoi la cascade est refusée, et le précédent contraire doit être cité honnêtement.**
*(Raisonné, sur deux textes qui coupent en sens opposés.)* L'ADR 0004 décision 8 refuse tout arrondi
par défaut **et tout héritage d'arrondi par sous-arbre**, et se déclare **irréversible**. Cinq motifs
y sont écrits, et **ils ne transposent pas tous** :

| motif de la décision 8 | transpose à l'apparence ? |
| :--- | :--- |
| « visible dans l'arbre » — une valeur décidée hors du nœud qu'un relecteur regarde | **oui, intégralement** |
| un champ de document stocké ne se retire qu'avec une **migration transformante** | **oui, intégralement** |
| la résolution devient `surcharge ?? ancêtre ?? document`, « *que C6 devrait réimplémenter et tenir en phase* » | **oui** |
| « un refus désigne un nœud » | **partiellement** — un refus de style ne désigne pas un montant faux |
| « le **pire dispositif possible** pour qui cherche un écart d'un centime » | **non** — une police héritée ne fausse aucun chiffre |

**Cette ADR écrit la distinction plutôt que de s'abriter derrière une analogie de forme.** Et elle cite
le **contre-précédent** : `TableColumn.align`, « *Inherited by every cell of this column* » — un
héritage **structurel, à un niveau, non surchargeable** existe déjà et n'a été contesté par personne.
La différence tenable : il descend d'une **déclaration de géométrie** vers les cellules **de cette
colonne**, pas d'un **ancêtre arbitraire** vers un **sous-arbre**.

**Et le besoin réel est déjà rangé.** L'ADR 0004 : « *ne pas retaper `2, 'halfExpand'` quarante fois …
est un problème d'**éditeur**, que la décision 7 règle en pré-remplissant le widget, ce qui écrit un
nœud explicite.* » Transposé : « ne pas retaper la police quarante fois » est **D2 du designer**, pas
un champ de contrat. ⚠️ **Mais le coût de cette réponse est mesuré, et il est de 41×** : cette ADR le
publie **dans cette décision**, pas dans une note de bas de page.

**Pourquoi aucun `z.default()` — et pourquoi la règle ne s'écrit pas en absolu.** *(MESURÉ deux fois.)*
`template/template.ts` : « *A `z.default()` would be worse than optional, and that IS measured: a
document with no page parses and comes out carrying a sheet Openview chose, **at every parse,
silently**.* » Re-mesuré sur une forme de style : un objet portant un défaut ressort **réécrit**.

⚠️ **Cette ADR n'écrit PAS « aucun `z.default()` dans ce dépôt ».** Il en existe **un, vivant** :
`version: z.string().default('1.0.0')`, couvert par un test qui en dépend, et qui est aussi la raison
pour laquelle **tous** les littéraux de test écrivent `version: '1.0.0'`. La règle juste est : **pas de
`z.default()` sur une forme que l'auteur du modèle est censé décider**. La révision d'auteur ne pilote
aucune migration et n'a aucune conséquence visuelle ; une feuille et une police en ont. Une ADR qui
poserait la règle en absolu se ferait contredire par son propre `grep`.

**Pourquoi aucune expression de style — et c'est une condition de validité, pas une remarque.** La
condition 1 l'écarte par le critère. Mais **la raison mécanique est plus grave que le critère** :

1. **`READS_VISITOR` a huit branches, et rien ne force un style-expression à y être reporté.** Mesuré
   comme un trou intégral : une branche compile qu'il y ait deux ou trois sources. Le symptôme est
   celui que la docstring de `collectDataPaths` décrit : **un blanc, pas une erreur**. L'intégrateur
   n'est jamais averti de la clé, et le formatage conditionnel ne se déclenche jamais.
2. **Un `ExpressionErrorSite` neuf serait dû** — donc **C4 a livré zéro site, C5 en livrerait un**.
3. **`LIST_CALLER_SUBJECTS` est un `Record` partiel sans garde `never`** : un site ajouté seul **passe
   les quatre portes** et rend « *An expression needs a list…* » à qui a écrit un style.
4. **La gratuité du lot sur `visitor.ts` NE TIENT QUE SOUS CETTE CONDITION.** Mesuré : `visitNode`,
   `childrenOf`, `walk`, `findNodeById`, `nodeReads` et `collectDataPaths` commutent sur `type` et
   rendent des enfants **explicites**, donc un champ de style non-expression coûte **zéro** reprise de
   parcours — et c'est vérifié, `walk(root)` rend toujours 19 nœuds et `collectTemplateDataPaths` les
   deux mêmes chemins après le lot. Le jour où une position accepte une `Expression`, `nodeReads` doit
   la rapporter, sinon `collectDataPaths` cesse de réclamer à l'intégrateur une clé que le document
   lit — le défaut exact que l'ADR 0002 a corrigé pour les boucles.

**Écarté.** (a) **Une cascade complète** : ADR 0004 décision 8, motifs 1, 2 et 3. (b) **Un
`Template.defaultStyle` optionnel** : arbitrage n° 1 — et un champ de document optionnel est
**irréversible** au même titre qu'un requis dès qu'un document le porte. (c) **Un `z.default()`** :
mesuré, réécrit le document. (d) **Une expression de style** : condition 1, plus les quatre trous
mécaniques ci-dessus, dont **aucun n'est outillé** — c'est le risque le plus grave du lot, et le
contrat l'écarte par **la forme** plutôt que par la vigilance. (e) **Les zébrures** (alternance de
lignes dérivée d'un index) : condition 1, et elles seraient calculées ; un `tableRow.box.background`
déclaré ligne par ligne les exprime, explicitement.

**Irréversible** pour le refus de l'expression : l'admettre plus tard est un élargissement d'union sur
chaque position de style, donc une estampille **et** une reprise des huit branches de `READS_VISITOR`.
*Signal de réouverture :* une demande de **formatage conditionnel** par un intégrateur. C'est un besoin
réel de facture (« en rouge si échu »), et le refus d'aujourd'hui a un coût réel : le contournement est
un `ConditionNode` par variante, écrit dans l'arbre — ce qui est précisément la réponse que la
décision 8 de l'ADR 0004 a donnée à l'arrondi.

---
### Décision 13 — La porte de type d'abord : huit paires `*_KEYS_IN_STEP` avant tout champ de style

**Décision.** **Le premier incrément du lot écrit les huit paires `*_KEYS_IN_STEP` manquantes, avant
qu'un seul champ de style existe.** Puis, par forme stockée neuve, **une paire** `keyof` + **une
paire** valeur — dix assertions, toutes dans `packages/core/src/style/__tests__/style.test.ts`,
**jamais dans `src/`**. Plus **dix-sept allers-retours à l'exécution**, un par champ de style. Et
**aucun schéma de style ne porte d'annotation `z.ZodType<T>`**.

**Pourquoi les huit paires d'abord — c'est la mesure la plus décisive du lot.** *(MESURÉ, une mutation
par site, compilée séparément.)*

```
site d'accrochage        | exit | l'assertion qui refuse
TextLiteralSegment       |    0 | AUCUNE — la porte est AVEUGLE
TextBindingSegment       |    0 | AUCUNE — la porte est AVEUGLE
TextPageFieldSegment     |    0 | AUCUNE — la porte est AVEUGLE
TextNode                 |    0 | AUCUNE — la porte est AVEUGLE
ImageNode                |    0 | AUCUNE — la porte est AVEUGLE
ContainerNode            |    0 | AUCUNE — la porte est AVEUGLE
LoopNode                 |    0 | AUCUNE — la porte est AVEUGLE
ConditionNode            |    0 | AUCUNE — la porte est AVEUGLE
Template                 |    0 | AUCUNE — la porte est AVEUGLE
TableColumn / TableCell / TableRowNode / TableRowGroupNode / TableNode / PageBand | 1 | nodes.test.ts / page.test.ts
```

**Neuf sites aveugles sur quinze**, et le motif est mécanique : les six sites gardés sont
**exactement** ceux qui possédaient une paire `*_KEYS_IN_STEP` — les cinq de C3 et les quatre de C4.
**Les huit sites où C5 accroche naturellement un style sont précisément les huit que la porte ne
surveillait pas.** Et la couverture ne rattrape rien : mesuré, **tous les tests passent** avec quatre
schémas divergents de leur type.

**Pourquoi ce trou est structurel, et non accidentel.** `nodes.test.ts` l'a mesuré et écrit : sous
`exactOptionalPropertyTypes`, `{ columnId, children }` et
`{ columnId, children, rowSpan?: number | undefined }` sont **mutuellement assignables**, donc « *An
OPTIONAL field added to one side only — precisely the shape a backward-compatible new field takes —
slips through. A field present in the TYPE and absent from the SCHEMA is worse than a compile error:
`parseTemplate` strips it at runtime (measured), so an editor writes it, the next open erases it,
`onSave` persists the loss, and `schemaVersion` never moves.* » **C5 est le lot dont *tous* les champs
sont optionnels** — conséquence directe du refus de cascade et de défaut. C'est exactement la forme de
dérive que la porte ne voit pas.

**Les huit paires, nommées.** `TEXT_LITERAL_SEGMENT_KEYS_IN_STEP`, `TEXT_BINDING_SEGMENT_KEYS_IN_STEP`,
`TEXT_PAGE_FIELD_SEGMENT_KEYS_IN_STEP`, `TEXT_NODE_KEYS_IN_STEP`, `IMAGE_NODE_KEYS_IN_STEP`,
`CONTAINER_NODE_KEYS_IN_STEP`, `LOOP_NODE_KEYS_IN_STEP`, `CONDITION_NODE_KEYS_IN_STEP`. **Les deux
dernières sont des contre-épreuves de la coupe de la décision 3** : `loop` et `condition` ne portent
**aucun** style, et leur paire rougit le jour où quelqu'un y ajoute un champ d'un seul côté.

**Le critère de sortie est mécaniquement vérifiable, et il a été vérifié : la matrice complète passe
d'exit 0 à exit 1, DOUZE mutations sur DOUZE**, chacune traçable à une paire nommée — dix qui retirent
un champ d'un schéma dont le type le déclare, deux qui en ajoutent un aux nœuds de contrôle.

**Le neuvième site est structurellement ingardable, et cette ADR le dit.** `Template` **est** inféré de
son schéma (`export type Template = z.infer<typeof TemplateSchema>`) : une paire
`TEMPLATE_KEYS_IN_STEP` serait **tautologique**. Le seul filet est l'**aller-retour JSON** sur un
littéral qui **porte** le champ, et les deux allers-retours existants du dépôt ne voient que les sites
que leur propre fixture atteint. Le lot ajoute donc **un littéral d'aller-retour qui porte un style aux
neuf sites** (signalement H).

**Pourquoi les assertions vont dans `__tests__/` et jamais dans `src/`.** *(MESURÉ par lecture : dans
le dépôt, **toutes** les `*_IN_STEP` vivent dans un fichier de test.)* Trois conséquences, toutes
vérifiables : (a) **la métrique de couverture est faussée** — `vitest.config.ts` exclut
`src/**/*.{test,spec}.{ts,tsx}` et rien d'autre, et neuf `export const X = true` dans `src/` sont neuf
`statements` couverts par le simple fait qu'un test importe le module, **pour zéro assertion à
l'exécution** — littéralement le test tautologique qu'`AGENTS.md` §5 interdit, sauf qu'il gonfle le
numérateur **et** le dénominateur du bon côté ; (b) elles **partent dans `dist`**, donc dans le tarball
publié ; (c) elles deviennent des **symboles de contrat**, donc des engagements de compatibilité.

**Pourquoi dix assertions et non neuf, et pourquoi les unidirectionnelles sautent.** *(MESURÉ, une
matrice de mutation.)* `keyof` et « valeur » sont **complémentaires, jamais interchangeables** :
`keyof` voit la présence et rate la dérive de type ; « valeur » fait l'inverse. Les assertions
**unidirectionnelles ne refusent jamais seules** — elles ne déclenchent que là où une mutuelle
déclenche aussi. Le contrat garde donc **une paire par forme**, soit **dix** assertions pour cinq
formes.

**Pourquoi dix-sept allers-retours à l'exécution — c'est la seule garde qui franchit l'amputation d'une
arête.** *(MESURÉ : exit 0.)* Une **arête de filet entière** retirée de `BoxBorderSchema` passe **les
dix assertions**, et le filet du haut disparaît **sans erreur**. Motif : `BoxBorder` est
tout-optionnel, donc l'amputation reste mutuellement assignable, et `keyof BoxStyle` ne bouge pas
puisque `border` est toujours là. **La couverture ne rattrape rien non plus** : un champ absent du
schéma n'est pas une branche non couverte, c'est une branche qui n'existe pas. Le dépôt a déjà écrit le
remède, deux fois : « *Only a runtime parsing test catches that, and that is why there is one per node
type.* » **Cette ADR reprend la phrase et remplace « node type » par « champ de style ».** Décompte :
5 (`Typography`) + 3 (`BoxStyle`) + 4 (arêtes de `BoxBorder`) + 4 (`BoxSpacing`) + 1
(`TextNode.align`) = **17**.

**Pourquoi aucune annotation `z.ZodType<T>`.** *(MESURÉ deux fois : exit 0.)* Annoter
`TypographySchema` **et** amputer `italic` compile — les dix assertions passent, `keyof` comprises,
parce que `z.infer` d'un schéma annoté rend l'**annotation**, donc son ensemble de clés **est** celui
du type par construction. Le patron obligatoire d'`AGENTS.md` §1.2 vise l'**AST récursif**, et
seulement lui ; les schémas de style ne sont pas récursifs, l'annotation ne leur achète rien et
**désactive silencieusement la seule garde de compilation du lot**. L'interdiction est écrite dans la
docstring de `style/schemas.ts`, sur le modèle de celle qu'`ast/schemas.ts` porte déjà pour
`TextSegmentSchema`.

**Écarté.** (a) **Écrire les champs d'abord et les paires ensuite** : les huit sites sont aveugles,
donc l'oubli d'un schéma serait silencieux **pendant tout le lot**, et un incrément intermédiaire
pourrait passer les quatre portes avec un type et un schéma divergents. (b) **Un fichier
`style/instep.ts` dans `src/`** : les trois conséquences ci-dessus. (c) **Les assertions
unidirectionnelles seules** : elles ne refusent jamais seules, mesuré. (d) **Se fier à l'aller-retour
JSON des fixtures existantes** : les filets du dépôt ne voient un champ que si le littéral qu'ils
comparent le **porte**.

**Ce n'est pas une forme stockée**, donc **réversible** au sens strict — mais retirer une paire rouvre
exactement le trou que cette décision ferme.
*Signal de réouverture :* aucun.

---

### Décision 14 — `CURRENT_SCHEMA_VERSION = 6`, migration par estampille seule

**Décision.** `CURRENT_SCHEMA_VERSION = 6`. Une entrée **`{ from: 5, to: 6 }`** ajoutée à
`TEMPLATE_MIGRATIONS` **sans fusionner les quatre existantes**, dont la fonction est
`(input) => ({ ...input, schemaVersion: 6 })` — **estampille seule, aucune transformation**.
Estampillée **une fois**, après la dernière forme persistée du lot, avec sa règle de conduite :
**aucun commit avant celui-là n'est publiable**. Et la section `## What version 6 means` **ne recopie
pas** le paragraphe d'asymétrie `root`/`page` de la v5.

**Pourquoi l'incrément est dû, et il est mesuré sur le vrai build.** Un document portant les formes
nouvelles aux neuf sites, estampillé 5, relu par le build **qui précède ce lot** — compilé pour la
mesure depuis le commit d'avant, pas simulé :

```
verdict  : ACCEPTÉ SANS AUCUNE ERREUR
entrée   : 81 valeurs, profondeur 10
sortie   : 37 valeurs, profondeur 9
EFFACÉ   : 44 sur 81 (-54,3 %)
  box présent ? avant true / après false | typography ? avant true / après false
```

**Quarante-quatre valeurs sur quatre-vingt-une effacées, aucune erreur**, et un `onSave` persiste la
totalité de la perte. C'est la **perte silencieuse** d'`AGENTS.md` §1.2, ici constatée sur le vrai
build plutôt que raisonnée. **Le chiffre appartient à CE document et ne se cite pas sans lui** : un
document portant moins de positions de style perd proportionnellement moins.

**Pourquoi l'estampille seule est un travail complet.** `AGENTS.md` §1.2 : « *Une migration qui ne
transforme rien n'est pas une migration fantôme. Elle estampille, et l'estampille est **tout** ce qui
produit le second message.* » Vérifié sur le build antérieur, **et le refus ne dépend pas des formes
nouvelles** — l'estampille seule suffit :

```
classe        : TemplateMigrationError      instanceof : true
champs propres: ["name","fromVersion"]
fromVersion   : 6      code : undefined      to : undefined
message       : "Template uses schema version 6 but this build understands at most 5. It was
                 written by a newer release of Openview; upgrade before opening it."
```

**Les trois assertions exactes du plan de test sont donc** `err instanceof TemplateMigrationError`,
`err.fromVersion === CURRENT_SCHEMA_VERSION + 1`, et la chaîne **au caractère près**. **Ni `err.code`,
ni `err.to`** : `TemplateMigrationError` ne porte que `fromVersion`, vérifié dans le source et mesuré
sur le build émis (signalement G). Les deux premières **existaient déjà** dans le dépôt, sous la même
forme relative ; le lot **greffe la troisième** sur le test en place plutôt que d'écrire un doublon —
deux sites pour un contrat, c'est deux sites à corriger le jour où le message bouge, et l'un des deux
rougirait sans qu'on sache lequel fait foi.

**Pourquoi PAS une migration transformante.** *(MESURÉ.)* Écrire une baseline dans chaque document
existant exigerait que `migrate.ts` **traverse l'AST** — il n'a aujourd'hui aucune traversée — et
coûterait **+324 valeurs (+59,1 %)** sur le modèle du playground contre **+8** pour une baseline
unique. Et une baseline **exige un mandat produit** : la page de compatibilité A4/20 mm est « *une
décision produit, prise par le propriétaire du produit le 2026-08-18, **not a deduction*** », et **une
police de compatibilité est un cran pire** — A4 est une constante de papier, fausse pour une partie du
monde mais qui **existe** partout ; une `family: 'Helvetica'` désigne une ressource qui **peut ne pas
exister** sur la machine de rendu, et la résoudre est une lecture de la machine, refusée et outillée.

**⚠️ Ce que la section de version NE recopie PAS — et c'est un constat mesuré.**
`template/template.ts` écrit, pour la v5 : « *The path is in `root` and not under `page`, and the
reason matters: a version 4 build does not KNOW the `page` key, so it strips the whole field without
validating anything inside it.* » **C'est exact pour v4 → v5 et faux pour v5 → v6** : un build v5
**connaît** `page`, y descend et valide. Mesuré, une forme nouvelle dans une bande est rapportée sous
`page.header.0.content.children.0.type` exactement comme sous `root.…`, une issue, `invalid_union`. La
phrase écrite est donc : « *Unlike version 5, there is no `root`/`page` asymmetry* ». **Le plan C4 fait
autorité de forme ; c'est précisément pour ça que la phrase périmée aurait été recopiée.**

**Ce que le lot n'écrit pas non plus, et pourquoi.** Cette ADR **n'écrit pas** « la seconde borne de
`parseTemplate` ne gagne rien ». L'étape 5 → 6 n'y contribue rien — delta 0/0, mesuré sur
`RECIPE_TEMPLATE` — mais **la seconde passe reste porteuse pour tout document estampillé ≤ 4**, que la
4 → 5 transforme. **C'est le seul constat dont la mauvaise lecture ferait perdre un garde-fou.** Et le
lot **ne recopie pas** l'erreur de la reconnaissance : la 4 → 5 teste la **valeur**,
`page: input.page ?? compatibilityPage()`, et non `'page' in input`, dont `migrate.ts` consigne qu'il
était la **mauvaise** version.

**Les filets sous l'estampille, et ils sont plus nombreux que le plan ne l'annonçait.** Le littéral de
chaîne de `migrate.test.ts` passe à `[[1,2],[2,3],[3,4],[4,5],[5,6]]`, et la seconde assertion
(`toHaveLength(CURRENT_SCHEMA_VERSION - 1)`) s'ajuste seule. Le commentaire qui suit dit que ce
littéral est « *the ONLY mechanical net under the stamp of lots C1, C2 and C3* ». **Mesuré, ce n'est
plus vrai en 2026-08-18 : estampiller 6 sans enregistrer l'entrée fait rougir DOUZE tests de ce
fichier** — tous ceux qui partent sous le timbre courant —, sur `No migration registered from schema
version 5`. Le littéral reste néanmoins le seul qui dise que la chaîne n'a pas été **fusionnée** en un
convertisseur direct. **Un second filet mécanique existe, et aucun document de reconnaissance ne le
citait** : `ast/__tests__/table.test.ts` épingle la **liste exacte des clés** de `RECIPE_TABLE`, et
l'arrivée de `box` la fait rougir. Il attrape un champ **optionnel**, ce qu'aucune paire
`*_KEYS_IN_STEP` ne fait — **mais seulement parce que la fixture le porte** (signalement P).

**Écarté.** (a) **Pas d'incrément** : 44 valeurs sur 81 effacées sans erreur, mesuré. (b) **Une
migration transformante** : +324 valeurs, une traversée de l'AST, et un mandat produit. (c) **Fusionner
les quatre entrées existantes** : `migrate.test.ts` teste la promesse de C9 — « *brings a template
written before C1 up to the current stamp* » — et la chaîne est ce qui la tient. (d) **Estampiller une
fois par incrément** : `template.ts` l'écarte, « le numéro désignerait un commit plutôt qu'un
contrat ».

**Irréversible** — c'est le numéro d'une forme stockée. Le garde ne protège **que vers le haut** : un
document sous-estampillé n'est pas refusé, il est migré silencieusement et ressort à l'estampille
courante. **Un test épingle le cas** : un document estampillé 5 portant déjà un `box` — fait main, ou
écrit par un build intermédiaire non estampillé — n'est pas refusé, il ressort estampillé 6 **avec son
`box` intact**.
*Signal de réouverture :* aucun. Une estampille ne se rouvre pas.

---

### Décision 15 — Zéro code d'erreur nouveau, zéro site nouveau

**Décision.** `packages/core/src/errors.ts` **n'est pas modifié**. `SHAPE_ERROR_CODES` reste à trois
membres, `EXPRESSION_ERROR_CODES` inchangé, `ExpressionErrorSite` inchangé. **Aucun `superRefine`, et
aucun invariant CROISÉ** dans le contrat de style : les trois contrôles de forme canonique portent
chacun sur **un seul objet**, sans regarder ni un frère ni un ancêtre. Et le lot **compte** ce qu'il
lègue à C8 plutôt que de renvoyer au précédent.

> ⚠️ **Une rédaction antérieure écrivait « aucun `.refine` » et l'a payé en décision 10.** Le refus de
> principe est tombé sur un constat : sans lui, le contrat stockait **trois orthographes** d'« aucun
> style ». La ligne qui tient — et c'est celle de C4 — n'a jamais été « aucune vérification » : c'est
> **zéro code d'erreur neuf**, et un contrôle de forme rend `code: 'custom'`. `SHAPE_ERROR_CODES` ne
> bouge pas, le catalogue de C8 ne s'allonge pas d'une entrée, et ce que C8 hérite est **trois messages
> de plus**, comptés ci-dessous plutôt que découverts par lui.

**Pourquoi c'est possible, et le précédent est écrit.** *(MESURÉ : tous les refus du lot portent un
`code` ∈ {`invalid_format`, `invalid_type`, `too_small`, `too_big`, `invalid_value`, `custom`}, et
aucun n'entre dans `SHAPE_ERROR_CODES`.)* L'ADR 0006 décision 9 a livré « **ZÉRO code d'erreur
nouveau, ZÉRO site nouveau** … *Pourquoi c'est possible : les dix-neuf fautes du lot sont **décidables
au save time*** ». C5 tient la même ligne pour la même raison, et le précédent est explicite dans
`ast/schemas.ts` : « *Everything a column can get wrong is decidable without any data, so it is
refused when the template is SAVED and **adds no entry to the error catalogue lot C8 enumerates***. »

Tout ce que C5 refuse est décidable au save time et **sans données** : une couleur mal formée, une
taille hors fenêtre, une longueur négative, une arête sans couleur, un `padding` incomplet, un
alignement inconnu, un objet de style vide.

**Les deux exceptions possibles sont écartées PAR DÉCISION.**

1. **Une référence de style pendante** exigerait un `superRefine` sur `TemplateSchema` — le
   **premier** de ce fichier. Elle n'ajouterait **aucun code**, mais elle ajouterait **un refus à
   écrire, à narrer et à tester**, plus la **règle de coupure** de C3, plus la question d'une
   **sixième porte bornée**. **C'est le vrai coût d'une table de styles nommés**, et c'est pourquoi
   l'arbitrage n° 3 ne se déduit pas d'une mesure de coût. Le contrat retenu **n'a pas de table
   nommée**, donc pas de référence pendante.
2. **Un style qui est une expression** exigerait un `ExpressionErrorSite` neuf **et** un libellé dans
   `LIST_CALLER_SUBJECTS`, un `Record` **partiel et sans garde `never`**. C'est un argument de plus pour
   le refus de la décision 12, et il est mécanique.

**Ce que le lot lègue à C8, compté plutôt que renvoyé.**

| défaut légué | sites dans le contrat retenu | statut |
| :--- | :--- | :--- |
| `Infinity` rend `Invalid input: expected number, received number` (mesuré) | **six** positions numériques : `sizePt`, les quatre champs de `BoxSpacing`, la `width` d'une arête | réserve déjà versée à C8 par l'ADR 0006 ; C5 **compte ses sites** |
| un `z.enum` requis absent rend le **même** message qu'un `z.enum` erroné | **aucun** — `TextNode.align` est **optionnel**, et c'est un argument mesuré pour l'optionalité | défaut déjà consigné pour `pageField` ; **C5 n'en crée aucun site** |
| une graisse fractionnaire rendrait `invalid_type`, pas `invalid_format` — zod 4 range `.int()` sous `invalid_type` | **aucun** : `bold` est un booléen, ce qui supprime le site | à ne pas réintroduire par une échelle numérique |
| un refus `strictObject` rend un `path` vide (mesuré) | **aucun** — le contrat garde `z.object` | le prix est la perte silencieuse **intra-version**, que l'estampille ne couvre pas, et un test l'épingle |

**Les trois messages légués, comptés.**

| refus neuf | message | `code` | `path` |
| :--- | :--- | :--- | :--- |
| objet de style vide | `An empty style object is not a style; omit the field` | `custom` | le champ (`…,"box"`) |
| filet d'épaisseur nulle | `A rule has a positive width; omit the edge to declare no rule` | `too_small` | `…,"border","top","width"` |
| `justify` sur une **colonne** | `Invalid option: expected one of "start"\|"center"\|"end"` | `invalid_value` | `…,"columns",0,"align"` |

Les trois portent un **remède dans le message** — le reproche exact que la décision 10 adresse à
`'A rule width is greater than zero'`, qui prescrivait sans dire quoi faire.

**Écarté.** (a) **Un code `'invalid-colour'` ou `'style-not-declared'`** : C4 a démontré qu'un lot de
contrat peut n'en ajouter aucun, et chaque code est une entrée dans le catalogue que **C8** doit
raconter. (b) **Un `superRefine` sur `TemplateSchema`** : c'est ce que la table de styles nommés
exigerait. (c) **Une sixième porte bornée `parseStyle`** : la doctrine de `parsePageSetup`
s'appliquerait, mais **aucun intégrateur n'en a besoin aujourd'hui** — le style n'est jamais un
fragment autonome, il vit toujours dans un nœud, et `parseBlockNode` le valide déjà.

⚠️ **Et la faiblesse structurelle est nommée ici plutôt que cachée.** Le contrat porte **zéro invariant
croisé**, là où C4 en portait deux (la marge contre la feuille, les occurrences de bandes deux à deux).
Les trois contrôles de la décision 10 ne comblent pas ce trou : ils refusent des **formes non
canoniques**, jamais une **incohérence entre deux champs**. **La surface de refus de C5 reste donc plus
faible que celle de C4** — un contrat tout-optionnel n'a presque rien à refuser. Ce n'est pas une
vertu, c'est une conséquence du refus de cascade (signalement N).

**Ce n'est pas une forme stockée** — **réversible**. Mais un code ajouté plus tard est un élargissement
du catalogue de C8, donc une reprise de son périmètre.
*Signal de réouverture :* la décision de l'arbitrage n° 3.

---

### Décision 16 — Les attentes envers le moteur vivent dans cette ADR, et jamais dans une docstring

**Décision.** Le [§ Conséquences] porte les **attentes envers `@openview/engine` et
`@openview/viewer`**, nommées et datées. **Aucune docstring du contrat n'écrit ce qu'un moteur fera.**

**Pourquoi cette règle, et elle est une correction du dépôt.** ADR 0005, constat C-01 : les docstrings
de C3 annonçaient « *Repeated page after page by the engine* », et il a fallu les **retirer**. C4 en a
fait un critère mécanique de sa définition de fini :
`git grep -niE "the engine (will|must|repeats|paginates|decides)"` doit rendre **rien**. C5 hérite du
critère, et il en a plus besoin que C4 : **la moitié de ce qu'il déclare n'a de sens qu'une fois
rendue.**

**Le patron du dépôt pour une attente est déjà écrit**, et cette ADR le suit : `page/types.ts` —
« *EXTERNAL KNOWLEDGE, not verified in this repository … **lot E1 owes it a throwaway probe*** ».
**Une attente nommée est une dette datée ; un silence est un bug futur que personne ne pourra
imputer.**

**Écarté.** (a) **Écrire les attentes dans les docstrings** : la faute que C3 a dû défaire, et que C4 a
transformée en critère mécanique. (b) **Décider soi-même du comportement à la coupe** : la coupe
appartient à E2/E3, et C4 s'est explicitement retenu de la préempter. (c) **Ne rien écrire** : deux
moteurs conformes rendraient deux factures différentes à partir du même document, contre la décision
produit 7.

**Réversible** — c'est de la prose d'ADR.
*Signal de réouverture :* le premier écart mesuré entre l'aperçu et le PDF sur une propriété
d'apparence. C'est le lot **V3** qui le verra, et c'est lui qui portera la réponse.

---

### Décision 17 — Le lot porte huit corrections du dépôt, parce qu'il est le lot dont le nom est mal employé

**Décision.** Un incrément dédié, hors `packages/core/src` pour partie, corrige **huit énoncés
publiés** que C5 périme ou honore autrement que promis.

**Pourquoi le lot le fait, alors que les précédents s'en sont abstenus.** *(Raisonné, avec un précédent
d'exécution.)* La doctrine est écrite : « *Une ADR est un journal, et un lot ne réécrit pas les
documents d'un autre* » (ADR 0005). Mais **C5 est le lot dont le nom est mal employé** :
`docs/roadmap/engine.md:79` attribuait le modèle bilingue à « core C5 » alors que c'est **C6**, dont
`core.md:229` écrit lui-même « Dépend de : C2, C5 ». C'était le **troisième relevé** — ADR 0005, plan
C3, et la campagne de mesure — et **personne ne l'avait corrigé**. C5 a le plus d'intérêt à ce que
l'énoncé soit juste, et le moins de titre à réécrire le document d'un autre. **Le précédent d'exécution
existe et il est de C4** : le commit `366c28a`, « docs(core): rediriger les trois promesses que le lot
C4 a périmées ».

**Les huit, avec leur nature.**

| # | Site | Ce que le dépôt promettait | Ce que C5 en a fait |
| :-- | :--- | :--- | :--- |
| 1 | `ast/types.ts` — en-tête de `TABLE_COLUMN_ALIGNMENTS` | « *How **the cells** of one column **sit inside their column box*** (lot C3). » | **RÉTRÉCI**, et c'est le correctif que la revue a rendu obligatoire. La phrase décrit un placement de **cellule** que ni C3 ni C5 ne peuvent tenir sans un modèle de mise en page de table, et une cellule qui contient une **image** ou un **conteneur** le montre en une ligne. Forme stockée inchangée, aucune migration due |
| 2 | `ast/types.ts` — les trois membres | « *Three members and no `justify`: … typography is lot C5.* » | **TENU, ET AILLEURS.** `justify` entre, sur `TEXT_ALIGNMENTS`, **pas** sur ce tuple-ci — parce qu'une **colonne** ne justifie rien. Et le motif d'origine, « mesurer les mots c'est lire la machine », **prouve trop** : il n'est pas repris |
| 3 | `ast/types.ts` — le critère de C3 | « *A font, a rule, a background, a spacing … are written on **any block whatsoever**, and lot C5 defines them there.* » | **REDIRIGÉ** : « *written on any block that **OCCUPIES SPACE*** », et le motif d'exclusion de `loop`/`condition`/`tableRowGroup` écrit **une fois**. Cette phrase est le **critère d'appartenance** qui a servi à exclure la police de `TableColumn` : le texte qui a justifié une exclusion doit être corrigé en même temps que l'inclusion qu'il annonçait |
| 4 | `ast/types.ts` — `TableColumn.align` | « *Inherited by every cell of this column. **A per-cell override belongs to lot C5.*** » | **REDIRIGÉ.** La surcharge existe, mais elle vit sur le **bloc dans la cellule**, pas sur la cellule — une cellule n'est pas un nœud, elle n'a pas d'`id`, et une Command d'éditeur ne l'adresse pas |
| 5 | `ast/types.ts` — ce que `TableNode` ne porte pas | « *No border, no shading, no font, no spacing, no per-cell alignment override (lot C5).* » | **PARTIELLEMENT PÉRIMÉ.** `TableNode` porte désormais `box`, donc « no border, no shading, no spacing » **devient faux**. La phrase est réécrite ; « no font » reste vrai, et la largeur **n'est plus manquante** : elle est dérivée |
| 6 | `ast/__tests__/nodes.test.ts` | « *`TableCell` is first because it is the likeliest site: **a per-cell alignment override is lot C5's declared future***.* » | **REDIRIGÉ.** Le test écrivait « declared future » là où l'ADR 0005 écrit « ***s'il** la décide* » : une réservation conditionnelle durcie en promesse. La paire `TABLE_CELL_KEYS_IN_STEP` **reste** — elle est l'une des six qui ont réellement rougi — et sa justification est réécrite |
| 7 | `page/__tests__/page.test.ts` | « *lot C5 has a **bleed** and a **gutter** in its declared future, and both are optional by nature.* » | **DÉCLINÉ** (arbitrage n° 7). L'ADR 0006 décision 13 range la marge de reliure et le fond perdu dans « un **silence** que ce lot décide de ne pas rompre », attribué à **personne**, et le besoin est déjà couvert **sans champ** : `page/types.ts`, « *Zero is legal -- a **full-bleed** label, or a template that manages its own **gutter*** ». C'était la **seule** source de cette attribution |
| 8 | `docs/roadmap/engine.md:79` | « *Le contrat sait décrire un modèle bilingue (**core C5**) …* » | **CORRIGÉ en C6.** Troisième relevé, jamais corrigé |

**Et deux corrections de test, qui ne sont pas des promesses mais des filets.**

- `page/__tests__/page.test.ts` — l'assertion de refus de `page` est désormais **ancrée sur le chemin**
  au lieu d'une sous-chaîne du message agrégé. Le contrat retenu n'ajoute aucun champ requis à
  `Template`, donc le danger ne tire pas — mais **mesuré**, avec un champ requis le parse rend **deux**
  issues, la nouvelle **avant** `page`, et la regex non ancrée **matche toujours** : le test resterait
  **vert en n'assurant plus rien**. C'est pire qu'un test rouge, parce qu'un test rouge se voit. Geste
  préventif, et **vérifié** : ancré, il rougit sur `toHaveLength(1)`.
- `template/migrate.test.ts` — le littéral de la chaîne passe à `[[1,2],[2,3],[3,4],[4,5],[5,6]]`.

**Et une neuvième, hors du périmètre annoncé par le plan mais rendue nécessaire par le même
raisonnement.** `packages/designer/DESIGN.md` écrivait que le tableau ne porte « *ni filet, ni fond, ni
police, ni espacement (lot C5)* ». **Le lot C5 est arrivé, et trois des quatre deviennent faux.** La
charte est corrigée, et elle reprend les deux précisions qui décident de la forme du panneau d'édition :
le `padding` d'une **ligne** insète le contenu de **chaque cellule**, et un objet de style vide est
**refusé** — c'est à l'éditeur, **côté producteur**, de retirer un `box` qu'il vient de vider.

**Ce que le lot NE corrige PAS, et pourquoi.** (a) **`docs/plans/c4-la-page.md`** : le plan se déclare
**périmé par son propre en-tête**, et un lot ne réécrit pas un plan mort — le fait part en signalement.
(b) **Les citations `core.md` décalées** dans cinq documents, dont deux ADR qui font foi : la classe
entière part en signalement, et C5 **recompte toutes ses citations** plutôt que de corriger les
documents des autres. (c) **`AGENTS.md`** : aucune entrée. La troisième forme d'incompatibilité part en
signalement A — **un lot ne s'auto-délivre pas de dérogation**, et le véhicule d'un amendement est une
ADR sous mandat explicite.

**Réversible** — c'est de la prose.
*Signal de réouverture :* aucun. Un énoncé faux corrigé ne se rouvre pas.

---

### Décision 18 — Ce que le lot refuse, par familles, avec le lot qui possède chaque refus

**Décision.** Le lot refuse **vingt-six** choses, groupées en **sept familles**. Chaque refus porte son
motif adossé à un **texte du dépôt ou à une mesure** — jamais à un goût — et le **nom du lot qui le
possède**, ou la mention explicite qu'il n'a **aucun propriétaire**. Soit 6 + 4 + 4 + 4 + 3 + 2 + 3 = 26.

**Famille 1 — ce qui exigerait de LIRE LA MACHINE ou de mesurer la géométrie : six refus.**

| Refus | Motif | Propriétaire |
| :--- | :--- | :--- |
| l'**interligne** sous toute forme | « une ligne n'a de hauteur qu'avec une police, donc une **métrique de police** » — et c'est **le** champ que le piège des deux décimales mord, `1,15` mesuré. ⚠️ **Le motif tient ici et pas sur `justify`** : la hauteur de ligne entre dans la **pagination**, donc dans la géométrie que le contrat déclare, là où la justification ne redistribue que du blanc **à l'intérieur** d'une boîte déjà déterminée | **E6**, et rien dans `core` |
| l'**interlettrage** | même motif ; et **MESURÉ** : le mot n'apparaît nulle part dans le dépôt, donc aucun texte ne le promet | personne |
| la **taille d'une image** | arbitrage n° 5 — toute forme utile a besoin du **ratio intrinsèque de la ressource**, qui est une mesure de la ressource et non du document. Contournement **exact** : une image occupe la largeur de contenu de son parent, donc un conteneur et son `padding` la dimensionnent au millimètre | **E1** pour la place effective |
| le dimensionnement **`auto`** | « *a width resolved by measuring content needs font metrics, which is reading the machine* » (`ast/types.ts`) | refusé pour tout le produit |
| une **largeur** ou une **hauteur** de bloc **stockée** | arbitrage n° 4, tranché **sans champ** : la largeur n'est pas déclarée, elle est **dérivée**, et la décision 11 écrit la chaîne complète. Ce qui reste refusé, c'est de **stocker** une longueur ici | **C11** si les calques survivent au v1 |
| une **réserve exprimée en lignes de texte** | ADR 0006, décision 8 | E2 |

**Famille 2 — ce qui exigerait d'INVENTER une politique : quatre refus.**

| Refus | Motif | Propriétaire |
| :--- | :--- | :--- |
| l'**opacité**, l'**ombre**, le **dégradé** | un **modèle de composition**, pas une déclaration ; et **MESURÉ** : aucun texte du dépôt ne les promet ni ne les refuse — C5 est le premier à devoir l'écrire | **C11 / D10** (calques) |
| le **canal alpha** d'une couleur | la composition, encore ; refusé par la forme, et **le refus est écrit** | **C11 / D10** |
| la **fusion des bordures** d'un tableau | un modèle de mise en page de table, pas une déclaration de boîte | personne |
| une **pile de repli** de polices | le repli est une politique ; `AGENTS.md` refuse en outre un `FontPort` nommément | **E6** |

**Famille 3 — ce qui serait dérivé d'une position, d'un index ou du contenu : quatre refus.**

| Refus | Motif | Propriétaire |
| :--- | :--- | :--- |
| le **formatage conditionnel** (un style qui est une `Expression`) | condition 1, **plus quatre trous mécaniques dont aucun n'est outillé** (décision 12). Symptôme : **un blanc, pas une erreur** | personne — et c'est le refus le plus susceptible d'être demandé |
| les **zébrures** dérivées d'un index | calculées, condition 1. Contournement : un `tableRow.box.background` déclaré ligne par ligne | personne |
| un style **dérivé d'une clé de données** (« tout champ nommé `total` en gras ») | obligerait l'intégrateur à nommer un champ comme Openview l'a décidé — **l'interdit de périmètre** | refusé pour tout le produit |
| un refus **positionnel** (« pas de style dans une bande ») | exigerait de connaître les **ancêtres** : « *it would be the contract's first positional rule* » | refusé pour tout le produit |

**Famille 4 — ce qui changerait les CARACTÈRES : quatre refus.**

| Refus | Motif | Propriétaire |
| :--- | :--- | :--- |
| **`textTransform`**, petites capitales | change les caractères, et l'algèbre porte déjà `textCase` : **deux orthographes d'un fait** | **C1**, livré |
| le **soulignement** / `text-decoration` | **MESURÉ** : aucun texte du dépôt ne le nomme, il n'est **pas** dans les dix attributs de `core.md`, et le critère ne le fait pas entrer par la charge de justification | personne |
| le **lien hypertexte** | l'ADR 0002 l'agrège à gras/italique ; c'est une **cible sortante** (E8) **et** un contenu à traduire (C6). Le classer sous « graisse et italique » est une erreur de famille | **sans propriétaire** |
| un **motif formaté** (`'Page {n} / {total}'`) | « c'est un parseur, avec son échappement et **sa surface d'injection** » | refusé en décision 13 de C4 |

**Famille 5 — ce que le dépôt attribue ailleurs par un texte : trois refus.**

| Refus | Motif | Propriétaire |
| :--- | :--- | :--- |
| le **fond de page**, le **filigrane**, le **cachet**, la **couleur du papier** | ADR 0006 : ce sont des **calques**, « une bande **occupe** de la place, un filigrane est **derrière** le flux ». ⚠️ **L'ADR 0006 se contredit ici** : elle attribue « la couleur du papier » à **C5** à un endroit et à C11/D10 à un autre ; C5 retient la seconde, et le fait est dans une **décision** (signalement L) | **C11 / D10** |
| le **positionnement libre au millimètre** | hors périmètre v1, `docs/roadmap/README.md` | hors v1 |
| l'**insécabilité**, la **veuve**, l'**orpheline**, le **report**, la **répétition effective**, le **point de coupe** | condition 3 : ce sont des politiques. **C4 s'est retenu de préempter C7, C5 fait de même** | **C7**, **E2**, **E3** |

**Famille 6 — ce que le dépôt attribue à C5 et que C5 refuse quand même : deux refus.**

| Refus | Motif | Propriétaire |
| :--- | :--- | :--- |
| le **fond perdu** et la **gouttière** sur `Sheet` / `PageMargins` | l'ADR 0006 décision 13 les range dans un **silence** que C4 « décide de ne pas rompre », et `page/types.ts` couvre le besoin **sans champ**. C5 ne rompt pas un silence qu'il n'a pas ouvert — et **corrige la docstring** | **personne** — un silence non attribué |
| une **surcharge d'alignement sur `TableCell`** | la surcharge existe, sur le **bloc dans la cellule** ; une cellule n'est pas un nœud. **Redirigé, pas décliné** | C5, à un autre site |

**Famille 7 — les SECONDES ORTHOGRAPHES d'un fait que le contrat sait déjà écrire : trois refus.**
*(Ces trois-là ne retirent aucune capacité : chacune est déjà exprimable, et d'une seule façon. Le
motif commun est celui de `page/types.ts` — « *two shapes to store, two refusal paths, and a consumer
that starts by normalising* » — et il est **vacuous aujourd'hui**, puisque aucun document ne porte
encore un de ces champs.)*

| Refus | Motif | Propriétaire |
| :--- | :--- | :--- |
| **`box: {}`**, **`typography: {}`**, **`border: {}`** | l'absence du champ dit le même fait, et elle le dit **une seule fois**. Deux formes cassent un diff, un état sale, un hachage et un `undo` — quatre consommateurs déjà planifiés, dont **aucun ne lit une valeur** | C5, et la normalisation est chez le **producteur** |
| un **filet d'épaisseur nulle** | l'arête est **optionnelle**, donc son absence est la première orthographe. Le précédent `min(0)` de `PageMargins` ne transpose pas : **ses quatre arêtes sont requises** | C5 |
| **`justify` sur une COLONNE** | une colonne ne justifie rien — elle fournit un **défaut**, et c'est le bloc qui justifie. L'élargir serait en outre la **troisième forme d'incompatibilité** | C5, à un autre site |

**Les trois qui seront demandés dès la première vraie facture** — avec leur **contournement daté** et
leur **coût de réouverture**.

1. **Une police pour tout le document.** Contournement : l'écrire sur chaque nœud texte, **mesuré à
   +60 valeurs (+10,9 %)** contre +3 pour une baseline. Coût de réouverture : un champ de document,
   donc **une estampille** s'il est optionnel, **un mandat produit et 28 tests** s'il est requis.
2. **Le formatage conditionnel** (« en rouge si échu »). Contournement : un `ConditionNode` par
   variante, écrit dans l'arbre. Coût de réouverture : un élargissement d'union sur chaque position de
   style, plus les **huit branches de `READS_VISITOR`**, plus un `ExpressionErrorSite`, plus le piège
   de `LIST_CALLER_SUBJECTS` — donc **le refus le plus cher à rouvrir du lot**.
3. **Un rythme vertical non uniforme.** Contournement : un `ContainerNode` par valeur d'air, compté par
   `assertBoundedShape`. Coût de réouverture : `margin` est un **élargissement** (une estampille), mais
   il oblige l'ADR à écrire si deux marges adjacentes s'additionnent ou fusionnent.

**Réversibilité — selon.** Les refus des familles 1, 2 et 3 sont **définitifs pour le produit**. Ceux
des familles 4, 5 et 6 sont **réversibles par élargissement**, donc au prix d'une estampille. Ceux de
la **famille 7** sont **réversibles sans estampille** — accepter à nouveau une forme est un
élargissement pur — mais ils sont **irréversibles dans l'autre sens** : les poser après l'estampille
serait un rétrécissement non vacuous, c'est-à-dire impossible. C'est ce qui les rendait urgents et non
facultatifs.
*Signal de réouverture, pour l'ensemble :* une facture réelle d'un intégrateur qu'un de ces vingt-six
refus rend indécrivable. C'est le seul fait observable qui compte, et il ne s'anticipe pas depuis le
dépôt.

---
## Conséquences

### Les HUIT attentes envers le moteur, chacune adossée à un constat

**Aucune de ces huit phrases ne vit dans une docstring**, et c'est la décision 16. Chacune porte son
**propriétaire** et son **vérificateur**, parce qu'une attente sans propriétaire est un trou.

1. **Le comportement d'une boîte au point de coupe.** Deux états banals que le contrat rend
   représentables et ne décrit pas : un bloc portant `background` que la pagination **scinde** — le
   fond se répète-t-il sur les deux fragments ? est-il peint jusqu'au bas de la première page ? — et un
   bloc portant `border: { top, bottom }` que la pagination scinde — le filet du bas apparaît-il **au
   point de coupe** (deux boîtes fermées) ou seulement **à la fin du bloc** (une boîte ouverte) ?
   **Les deux réponses sont légitimes, aucune n'est déductible du contrat**, or la décision produit 7
   promet l'identité entre l'aperçu (mono-page) et le PDF. **C5 est la première famille de propriétés
   dont le rendu dépend du point de coupe** : C4 pouvait se taire, il ne déclarait qu'une géométrie, et
   une géométrie ne se coupe pas. Propriétaires : **E2, E3**. Vérificateur : **V3**.
2. **La résolution d'un nom de police.** Ce que le moteur fait d'un `family` qu'il ne trouve pas, et ce
   qu'il fait des dix valeurs qui désignent la machine (décision 9). Propriétaires : **E6**
   (déterminisme, « au caractère près : polices, images »), **E8** (liste blanche des requêtes
   sortantes, polices incluses).
3. **Les cinq valeurs typographiques absentes.** `resolveTypography` rend cinq `T | undefined` : c'est
   le moteur qui décide de la police, de la taille, de la graisse, de l'italique et de la couleur d'un
   run qui n'en déclare aucune. **Cette ADR les nomme comme une dette**, et l'argument de réouverture
   est mesurable : si un modèle réel répète la même famille sur plus de la moitié de ses runs, le
   troisième terme redevient légitime. Propriétaires : **E1**, **V1**.
4. **L'espace colorimétrique.** Le contrat **déclare** sRGB ; c'est au moteur d'écrire un `DeviceRGB`
   avec profil, ou de convertir, et de **dire ce qu'il fait**. Propriétaire : **E1**. Vérificateur :
   **V3**.
5. **La conversion pt → unité de rendu.** Le contrat exporte `mmFromPt` et `ptFromMm` avec **une**
   orthographe ; l'attente est que le moteur **les emploie** plutôt que de réécrire la division —
   31,5 % des tailles entières divergent selon l'ordre des opérations, mesuré. Propriétaires : **E1**,
   **V1**, et **le playground de ce lot, qui est le premier consommateur nommé et qui l'emploie déjà**.
6. **La rencontre de deux filets adjacents.** Le contrat n'a **aucun modèle de fusion**, et la fusion
   des bordures est refusée comme modèle de mise en page. Or l'état est banal et **irréfusable** : la
   ligne *n* porte `border.bottom`, la ligne *n+1* porte `border.top`, et le `table` porte les quatre
   arêtes. Trois filets peuvent donc se superposer sur un même trait. **S'additionnent-ils, se
   recouvrent-ils, le plus épais l'emporte-t-il ?** Les trois réponses sont légitimes, aucune n'est
   déductible du contrat, et **c'est exactement le mécanisme d'une « grille complète »** — donc la
   propriété la plus visible du critère de recette. Propriétaires : **E1**, **E2**. Vérificateur :
   **V3**.
7. **Les deux conventions de justification.** Le contrat **prend** la convention plutôt que de la
   laisser ouverte, comme il prend sRGB : **la dernière ligne d'un paragraphe justifié n'est pas
   justifiée** — elle s'aligne sur `start` — et **le résidu se répartit uniformément entre les blancs
   INTER-MOT**, jamais entre les lettres. L'attente est que le moteur les honore. Sans elles, `justify`
   serait le premier champ du contrat dont le rendu est un arbitrage laissé au renderer. Propriétaires :
   **E1**, **V1**.
8. **Une image sans dimension déclarée.** L'arbitrage n° 5 est tranché en « aucune dimension », donc le
   contrat ne dit **rien** de la place qu'une image occupe — et le contournement écrit (un conteneur
   dont le `padding` façonne l'espace) fixe la **largeur**, jamais la **hauteur**, qui suit le ratio de
   la ressource. **Ce ratio est une mesure, et elle appartient au moteur.** L'attente est qu'il dise ce
   qu'il fait, et qu'il le fasse identiquement dans l'aperçu et dans le PDF. Propriétaires : **E1** ;
   **E8** pour la ressource elle-même.

### Ce que le lot lègue aux autres briques

- **`@openview/designer` (D2)** doit un **panneau de style** sur cinq types de nœud et sur les runs, et
  surtout un **normalisateur côté producteur** : un `box` que l'auteur vide doit être **retiré**, pas
  enregistré vide. La charte `DESIGN.md` porte désormais les deux précisions qui décident de la forme du
  panneau. Et la réponse au « ne pas retaper la police quarante fois » est **D2, en pré-remplissant le
  widget**, ce qui écrit un nœud explicite — pas un champ de contrat.
- **`@openview/viewer` (V1)** peut peindre sans attendre un moteur, et **V3** reçoit enfin une **chaîne
  de largeurs** entièrement déterminée par des millimètres déclarés : sans le modèle de boîte de la
  décision 11, V3 n'avait rien à comparer.
- **`@openview/core` lot C6** hérite d'un contrat qui **n'a pas préempté son périmètre** : aucun format
  de nombre, aucun séparateur, aucun symbole monétaire, aucun motif de date. La condition 1 du critère
  est ce qui partage les deux lots, et elle est écrite.
- **`@openview/core` lot C8** hérite de **trois messages**, comptés à la décision 15, et de **zéro code
  d'erreur nouveau**. Plus **six positions numériques** qui portent le défaut de message d'`Infinity`,
  comptées plutôt que renvoyées au précédent.

---

## Ce qui reste ouvert

1. **Le troisième terme de la résolution typographique.** Un `Template.style` diviserait par 41 le coût
   de « une police pour toute la facture », mesuré. Il **exige un mandat produit** — une police de
   compatibilité est un cran pire qu'A4 —, et le fait observable qui le rendrait légitime est nommé :
   **plus de la moitié des nœuds texte d'un modèle livré répétant la même famille**. Il se mesure sur le
   modèle, pas sur une intuition.
2. **La table de styles nommés.** Elle n'entre pas, et son vrai coût est écrit à la décision 15 : un
   `superRefine` sur `TemplateSchema` — le premier de ce fichier —, un refus de référence pendante à
   écrire, à narrer et à tester, la règle de coupure de C3, et la question d'une sixième porte bornée.
   **Ce coût ne se déduit pas d'une mesure d'économie de valeurs.**
3. **La forme de la graisse.** `bold?: boolean` est ce que la roadmap écrit littéralement, « graisse et
   italique » côte à côte. L'élargir en échelle plus tard est un **élargissement d'union**, donc une
   estampille — la classe de changement la moins chère. Ce qui est refusé aujourd'hui, c'est une fenêtre
   numérique qui **admet `450`**, une face qu'aucune fonte ne porte, et qui obligerait donc un moteur à
   **choisir** — une politique que le contrat n'énonce pas.
4. **`margin`.** Refusé, avec son coût chiffré, parce que deux marges adjacentes s'additionnent ou
   fusionnent et que **choisir est une politique**. Le contrat pourrait prendre la convention ; il ne
   l'a pas fait, et l'ADR devrait alors écrire la somme.
5. **L'alignement vertical dans une cellule ou une bande.** Refusé : le contrat ne déclare **aucune
   hauteur**, donc il n'y a rien contre quoi aligner. Le jour où une hauteur serait déclarée, la
   question se rouvre — et une hauteur est une mesure.
6. **La direction d'écriture contre laquelle `start` et `end` se résolvent.** **Question héritée de
   C3**, consignée ouverte dans l'ADR 0005, et ce lot en devient le **second site** : `TEXT_ALIGNMENTS`
   la porte comme `TABLE_COLUMN_ALIGNMENTS` la portait. Un interdit reste réglé : **aucun moteur ne la
   dérive de la machine sur laquelle il tourne** (E6).

---

## Ce que l'exécution a corrigé du plan

Le plan `docs/plans/c5-l-apparence.md` est **périmé** ; il reste consultable comme trace de ce que le
dépôt a cru. **Cinq de ses énoncés ont été corrigés par l'exécution**, et ils sont nommés ici parce
qu'une ADR qui recopierait son plan sans dire où il s'est trompé transmettrait l'erreur.

| # | Ce que le plan écrivait | Ce que l'exécution a mesuré |
| :-- | :--- | :--- |
| 1 | La forme canonique se refuse par un **`.refine`** d'objet, et les refus rendent **une** issue | **FAUX.** Un `.refine` d'objet voit la **sortie** du parse, dont un champ optionnel en échec est retiré : mesuré, **deux** issues pour une faute, la seconde fausse et son `path` vide. Le remède est la **règle de coupure** de `checkTableWiring`, et `.check` est la seule forme zod 4 qui la permette (décision 10) |
| 2 | Le refus d'un filet négatif rend le message `'A length cannot be negative'` | **FAUX**, et c'est un reste de la révision 1 : `BorderEdge.width` porte un prédicat **strictement positif**, donc `-1` rend le message de ce prédicat. Le plan de test citait la borne de l'autre schéma |
| 3 | Estampiller 6 sans l'entrée de migration fait rougir **un** test | **FAUX, et dans le bon sens** : **douze** tests rougissent, tous ceux qui partent sous le timbre courant. Le littéral de chaîne reste néanmoins le seul filet qui dise que la chaîne n'a pas été **fusionnée** |
| 4 | Les sondes 3, 6, 7 et 8 de la définition de fini cherchent un **mot** | **INEXÉCUTABLES en l'état** : chacune rougit sur sa **propre justification** — la docstring qui explique pourquoi la chose n'existe pas contient le mot. Les quatre sont refaites au [§ La définition de fini], et elles cherchent une **déclaration** |
| 5 | Le barrel de `style/` a un ordre de lignes **fonctionnel**, à ne pas ranger par alphabet | **NON TENABLE** : l'assistant `organizeImports` de Biome **impose** l'ordre par chemin de module, et `pnpm run lint` échoue autrement. La docstring dit désormais pourquoi c'est **sans danger ici** (aucun des quatre modules n'a d'import de valeur vers un frère) et ce qu'il faudra faire le jour où ça cesserait de l'être : **casser la dépendance, pas réordonner** |

---

## La définition de fini, refaite — chaque sonde avec sa contre-épreuve de non-inertie

Une commande de vérification qui rend toujours zéro ne prouve rien. **Quatre sondes du plan étaient
inexécutables**, toutes pour la même raison : elles cherchaient un **mot** là où le critère porte sur
une **déclaration**, et le mot apparaît dans les docstrings du lot — qui expliquent précisément pourquoi
la déclaration n'existe pas. Les quatre sont corrigées ici, et le motif de chaque correction est écrit,
parce qu'une sonde corrigée sans son motif se refera casser au lot suivant.

| # | Sonde | Attendu | Contre-épreuve de non-inertie |
| :-- | :--- | :--- | :--- |
| 1 | `pnpm run lint && pnpm run build && pnpm run type-check && pnpm run test:coverage` | exit 0 | — (c'est la CI) |
| 2 | `git diff --exit-code "$(git merge-base origin/main HEAD)" HEAD -- AGENTS.md` | **exit 0** — aucun amendement | la même commande sur `packages/core/src/ast/types.ts` **doit** rendre exit 1 |
| 3 | `git grep -nE "(const\|let\|var) +[A-Za-z_]+ *= *5080" -- packages/core/src/style` | **zéro** — la borne s'**importe**, sous quelque nom que ce soit | la même sur `packages/core/src/page/types.ts` **doit** rendre `MAX_SHEET_MM` |
| 4 | `git grep -nE "(type\|interface) +ResolvedTypography" -- packages` | **zéro** — le **type** n'existe pas ; la docstring qui explique pourquoi, si | `git grep -n "resolveTypography" -- packages/core/src/style` **doit** rendre au moins une ligne |
| 5 | `git grep -nE "\bgap\b *\??:" -- packages/core/src/style` | **zéro** — aucun **champ** et aucune **clé de schéma** | `git grep -nE "\bpadding\b *\??:" -- packages/core/src/style` **doit** rendre au moins une ligne |
| 6 | `git grep -nE ": *z\.ZodType<" -- packages/core/src/style` | **zéro** — annoter détruit la porte de type | la même sur `packages/core/src/ast` **doit** rendre **deux** lignes (l'AST récursif, lui, en a besoin) |
| 7 | `git grep -n "core C5" -- docs/roadmap` | **zéro** — l'**attribution** vit dans la roadmap | la même sur `docs/adr` **doit** rendre une ligne : l'ADR 0005 **signale** la faute, elle ne la commet pas, et un lot ne réécrit pas le journal d'un autre |
| 8 | `git grep -nE "^ *(readonly )?(bleed\|gutter)\??:" -- packages/core/src/page` | **zéro** — aucun **champ déclaré** sur `Sheet` ni sur `PageMargins` | `git grep -nE "^ *(readonly )?(top\|bottom)\??:" -- packages/core/src/page/types.ts` **doit** rendre **deux** lignes : de vraies arêtes, elles, sont déclarées ainsi |
| 9 | `git grep -n "TABLE_COLUMN_ALIGNMENTS = " -- packages/core/src/ast/types.ts` | **une ligne, et son tuple porte TROIS membres** | `git grep -n "TEXT_ALIGNMENTS = " -- packages/core/src/ast/types.ts` **doit** rendre une ligne, **dérivée par étalement** et portant `'justify'` |
| 10 | `git grep -c "_KEYS_IN_STEP" -- packages/core/src/ast/__tests__/nodes.test.ts` | **13** — 5 à l'entrée du lot, +8 | retirer une paire **doit** faire rougir la porte 3 |
| 11 | `node -e "import('./packages/core/dist/index.js').then(m => console.log(Object.keys(m).length))"` | **117** valeurs | la même commande sur le `dist` du commit précédant le lot **doit** rendre **104** |
| 12a | `git grep -n "CURRENT_SCHEMA_VERSION = 6" -- packages/core/src/template/template.ts` | **une ligne** | `git grep -n "CURRENT_SCHEMA_VERSION = 5"` **doit** rendre zéro |
| 12b | `git grep -nE "migrate: .*schemaVersion: 6" -- packages/core/src/template/migrate.ts` | **une ligne** — l'estampille de l'entrée 5 → 6. Le motif retient `migrate:` **exprès** : sans lui la sonde rend **deux** lignes, la seconde étant la docstring qui explique la première, et c'est le même faux positif que les sondes 3, 6, 7, 8 et 15 | `git grep -n "from: 5" -- packages/core/src/template/migrate.ts` **doit** rendre une ligne |
| 13 | `git grep -nE "(BoxStyleSchema\|TypographySchema\|BoxBorderSchema)\.(extend\|pick\|omit)" -- packages` | **zéro** — un contrôle d'objet **ne survit pas** à ces trois appels, mesuré | `git grep -c "check(refuseEmptyStyle)" -- packages/core/src/style/schemas.ts` **doit** rendre **trois** |
| 14 | `git grep -nE "widthMm\|heightMm" -- packages/core/src` | **zéro** — le lot ne stocke **aucune** dimension | `git grep -n "MIN_COLUMN_WIDTH" -- packages/core/src/ast` **doit** rendre au moins une ligne (le poids de colonne, lui, existe) |
| 15 | `git grep -niE "the engine (will\|must\|repeats\|paginates\|decides)" -- packages/core/src \| grep -v '"the engine'` | **zéro** — **le critère mécanique de la décision 16, hérité de C4** : aucune docstring ne prescrit au moteur | `git grep -n "Repeated page after page by the engine" -- packages/core/src` **doit** rendre **zéro** aussi — c'est la prescription que C3 a dû retirer, et la contre-épreuve vérifie qu'elle n'est pas revenue |

**Les quatre corrections, avec leur motif.**

1. **Sonde 3.** Chercher `MAX_STYLE_LENGTH_MM` attendait zéro **et aurait rendu une ligne** : la
   docstring de `MAX_FONT_SIZE_PT` **nomme** cette constante pour dire qu'elle n'existe pas. Chercher la
   **valeur** `5080` dans `style/` échoue pour la même raison — les docstrings de `units.ts`
   l'**expliquent**. La sonde corrigée cherche une **déclaration** valant 5080, sous n'importe quel nom.
2. **Sonde 6.** Chercher `z.ZodType` rend trois lignes de **docstring**, dont celle qui interdit
   l'annotation. La sonde corrigée cherche l'**annotation** elle-même, `: z.ZodType<`.
3. **Sonde 7.** Chercher `core C5` sur `docs/roadmap docs/adr` rend l'ADR 0005, qui **cite** la chaîne
   fautive pour la signaler. Le pathspec est resserré sur `docs/roadmap`, où vit l'**attribution**, et
   la contre-épreuve exige que le signalement **reste** dans l'ADR.
4. **Sonde 8.** Chercher `bleed|gutter` sur `packages/core/src` rendait **treize lignes déjà avant ce
   lot** — le mot est un **nom de champ de sonde** dans les tests de `page/`, et il apparaît dans deux
   docstrings de `page/types.ts` qui expliquent que le besoin est couvert sans champ. La sonde ne rendait
   donc pas zéro pour la mauvaise raison : elle ne rendait pas zéro du tout. La sonde corrigée cherche une
   **déclaration de champ en début de ligne** — et il faut aller jusque-là, parce qu'une prose de test de
   C4 **cite** l'annotation `readonly bleed?: number | undefined` entre accents graves pour raconter une
   mesure. Un motif qui n'ancre pas le début de ligne attrape la citation.
5. **Sonde 15, et c'est un critère HÉRITÉ dont ce lot découvre le faux positif.** C4 s'est imposé
   `git grep -niE "the engine (will|must|repeats|paginates|decides)"` comme critère mécanique de sa
   décision 16, et ce lot en hérite. **Joué tel quel, il ÉCHOUAIT DÉJÀ AVANT ce lot** : mesuré au commit
   qui le précède, `expression/limits.ts` porte « *so "the engine will bound the time" is unkeepable
   short of killing a worker* » — la phrase est **entre guillemets** et dit exactement le contraire d'une
   prescription, puisqu'elle la déclare intenable. Le critère est donc corrigé plutôt que reconduit : il
   exclut les occurrences **citées**. Et sa contre-épreuve n'est pas « au moins une ligne » mais « zéro
   aussi », sur la prescription nommée que l'ADR 0005 a fait retirer de C3 — une contre-épreuve qui
   vérifie qu'une faute réparée n'est pas revenue.

**Ce que la définition de fini ne peut pas cocher**, et qui reste une revue : « deux factures
visuellement très différentes », la conformité d'`App.tsx` (hors du glob de Vitest), et la justesse des
huit attentes envers le moteur — elles ne seront vérifiables qu'au lot E2.

**Ce que l'exécution a néanmoins pu vérifier de la démonstration, par la machine plutôt que par l'œil,**
et qui est plus fort qu'une capture d'écran : les deux factures rendues côte à côte produisent **40
`<span>` chacune** — même structure, même nombre de runs —, les **cinq** propriétés typographiques du
titre diffèrent toutes, le cadre passe d'un filet de 1 px et 10,4 px d'inset à aucun filet et 5,2 px, la
bande d'en-tête d'un fond clair à un filet bas de 3 px, `justify` n'apparaît que dans la seconde et sur
deux blocs, les **huit** chemins de données sont identiques, et la console est vide. La conversion est
vérifiée de bout en bout : **17 pt → `mmFromPt` → 5,997 mm → × 2,6 px/mm → 15,5928 px**, exactement ce
que le navigateur calcule.

---

## Les signalements, qui ne sont pas des décisions

Un signalement est un fait constaté que **ce lot ne corrige pas**, avec la raison de son abstention.

| # | Le fait | Pourquoi ce lot ne le corrige pas |
| :-- | :--- | :--- |
| **A** | Il existe une **troisième forme d'incompatibilité** que `AGENTS.md` §1.2 ne nomme pas : une union **élargie sur un `z.enum`** rend `invalid_value` avec `Invalid option: expected one of …` sur un chemin de discriminant — plus lisible que « No matching discriminator », toujours sans erreur typée, sans version nommée et sans remède. Mesuré | **Un lot ne s'auto-délivre pas de dérogation.** Le véhicule d'un amendement à `AGENTS.md` est une ADR **sous mandat explicite** (précédent unique : C2 D11, mandat du 2026-08-15). Le lot **évite** la forme au lieu de l'amender : il n'élargit aucun tuple existant |
| **B** | Les citations de `core.md` au-delà de la ligne 175 sont **décalées de 31 lignes** dans cinq documents, dont **deux ADR qui font foi** | Un lot ne réécrit pas le document d'un autre. C5 **recompte toutes ses propres citations** — la citation canonique de ce lot est `core.md:207-217`, jamais `:174-184` |
| **C** | `docs/plans/c4-la-page.md` cite un chiffre de calibrage à quatre endroits qui ne correspond plus | Le plan **se déclare périmé par son propre en-tête**. Réécrire un plan mort efface la trace de ce que le dépôt a cru |
| **G** | `TemplateMigrationError` ne porte **que** `fromVersion` : ni `code`, ni `to`. Mesuré sur le build émis — champs propres `["name","fromVersion"]` | Ce n'est pas un défaut, c'est une **contrainte de rédaction de test** : un `expect(err.code)` échouerait. Elle est écrite ici, et le test du dépôt l'observe déjà |
| **H** | **`Template` est structurellement ingardable** par une paire `*_KEYS_IN_STEP` : son type **est** `z.infer` de son schéma, donc l'assertion comparerait une annotation avec elle-même | Le lot fait ce qui est possible : un **aller-retour JSON sur un littéral qui porte un style aux neuf sites**. C'est le seul filet, et il est écrit comme tel |
| **K** | Le critère de l'**ADR 0004 décision 10** (« si une déclaration ne peut changer que ce qu'un lecteur voit, elle est C6 ») **range tout C5 en C6** s'il est pris pour un test général | Il a été écrit pour partager **C2/C6**, dans une ADR qui se qualifie elle-même de « frontière C2/C6 ». Il est **signalé**, pas réutilisé, et le critère de ce lot repose sur ses propres quatre conditions |
| **L** | **L'ADR 0006 se contredit** sur « la couleur du papier » : elle l'attribue à **C5** à un endroit et aux calques **C11 / D10** à un autre | C5 retient la seconde, et le fait est dans une **décision** plutôt que dans une note. Corriger l'ADR d'un autre lot n'est pas de ce lot ; **choisir explicitement** l'est |
| **N** | **Le contrat porte ZÉRO invariant croisé**, là où C4 en portait deux. Sa surface de refus est donc **strictement plus faible** que celle de C4 | Ce n'est pas une vertu de simplicité : c'est la conséquence mécanique du refus de cascade et du choix de tout rendre optionnel. **Un contrat dont chaque champ est facultatif et indépendant n'a presque rien à refuser**, et le dire est le seul remède honnête |
| **O** | **`style/types.ts` importe `../page/types.js` et NON le barrel `page/page.js`**, contre la convention que `page/page.ts` demande. Le barrel ferme un cycle ESM et rend `ReferenceError: Cannot access 'ContainerNodeSchema' before initialization` — **exit 0 aux portes 2 et 3, casse à la 4**, mesuré dans les deux sens | La dérogation est écrite **avec sa mesure**, dans la docstring de `MAX_FONT_SIZE_PT` et dans celle du barrel de `style/`. Et la règle générale qui en découle est énoncée : dans `core`, un import de **valeur** entre dossiers passe par le module **feuille**, pas par le barrel, dès que le dossier cible importe le dossier source |
| **P** | **`ast/__tests__/table.test.ts` est un SECOND filet mécanique** sous l'estampille, qu'aucun document de reconnaissance ne citait. Il attrape un champ **optionnel** — ce qu'aucune paire `*_KEYS_IN_STEP` ne fait — **mais seulement parce que la fixture le porte** | Nommé comme **la forme générale du filet** : une assertion de liste de clés sur une fixture qui **porte** le champ. C'est plus fort qu'un `keyof` sur un site que la fixture ignore. Conséquence de rédaction : l'ordre d'insertion du champ dans la fixture est **porteur**, et le lot l'écrit dans le commentaire |
| **Q** | **`Array.prototype.toSorted` est `TS2550` sous `lib: ["ES2022"]`**, et le diagnostic **suggère lui-même de desserrer le `tsconfig`** (« *Do you need to change your target library?* ») | C'est le cas d'école d'`AGENTS.md` §7 : **un compilateur qui propose la dérogation**. La réponse est `.sort()` sur le tableau frais de `Object.keys`, et la contrainte est **rencontrée plutôt qu'esquivée** |
| **S** | Le **critère mécanique de C4** sur les prescriptions au moteur — `git grep -niE "the engine (will\|must\|…)"` — **échouait déjà avant ce lot**, sur `expression/limits.ts`, où la phrase est **citée** pour être déclarée intenable | Corrigé **en tant que sonde**, pas en tant que code : la ligne de `limits.ts` est juste, c'est le motif qui était trop large. La sonde 15 exclut désormais les occurrences citées, et sa contre-épreuve vérifie que la prescription que C3 a dû retirer n'est pas revenue |
| **R** | Le **pre-commit** rapporte trois `suppressions/unused` sur trois `biome-ignore` **préexistants** d'`App.tsx`, là où `pnpm run lint` — la porte réelle — n'en rapporte aucun | Constaté, et **hors périmètre** : ces trois suppressions précèdent le lot, la porte de la CI est verte dans les deux états, et la divergence vient du chemin « contenu indexé » de Biome. Le lot **n'ajoute aucune suppression** de son côté |

---

## Le relevé des neuf arbitrages, tranchés le 2026-08-18

Le plan portait neuf arbitrages, dont deux marqués **bloquants**. Ils sont tous tranchés, et **les
branches non retenues sont conservées avec leur motif** — parce qu'un plan est périssable et qu'une ADR
fait foi : effacer les branches non retenues laisserait l'ADR **sans les motifs des décisions**, et
c'est le motif, pas la décision, qu'on relit le jour d'une réouverture.

| # | Arbitrage | Tranché | La branche non retenue, et ce qu'elle aurait coûté |
| :-- | :--- | :--- | :--- |
| 1 | Le **troisième terme** de la résolution typographique (`Template.style`) | **Deux termes** | Trois termes divisaient par 41 le coût de « une police pour toute la facture », mesuré. Ils exigeaient **un mandat produit** — une police de compatibilité désigne une ressource qui peut ne pas exister, là où A4 existe partout — et, si le champ était requis, **28 tests en échec dans 6 fichiers** et le second rétrécissement non vacuous du dépôt. Reste ouvert, avec son seuil de réouverture mesurable |
| 2 | La **graisse** : booléen, neuf paliers, ou échelle continue | **`bold?: boolean`** | Une fenêtre numérique de 100 à 900 **admet `450`**, que 792 des 801 valeurs ne sont pas des multiples de 100, et qu'aucune fonte ne porte : l'honorer obligerait un moteur à **choisir**, donc à inventer une politique. Élargir plus tard est une **estampille**, la classe de changement la moins chère |
| 3 | La **table de styles nommés** | **Aucune** | Elle économiserait des valeurs sur un modèle répétitif, mais son vrai coût n'est pas là : un `superRefine` sur `TemplateSchema` — le premier de ce fichier —, un refus de référence pendante à écrire, narrer et tester, la règle de coupure de C3, et la question d'une sixième porte bornée. **La décision 15 tomberait** |
| 4 | Qui déclare la **largeur d'un tableau** | **Sémantique déclarée, AUCUN champ** | Un `widthMm` sur `TableNode` aurait été une longueur stockée là où le produit n'en stocke aucune, et il aurait rouvert « la largeur du parent, moins quoi ? ». L'objection était que répondre exigeait un modèle de boîte complet — **et la revue l'a rendu obligatoire pour une autre raison**, le `padding` de ligne, donc son prix était déjà payé |
| 5 | Une **image** peut-elle déclarer sa taille | **Aucune dimension** | Toute forme utile (`widthMm` seul, ou les deux) a besoin du **ratio intrinsèque de la ressource**, qui est une mesure de la ressource et non du document, et une convention d'ajustement à écrire. Contournement **exact** : un conteneur et son `padding` fixent la largeur au millimètre. La hauteur devient l'attente n° 8 |
| 6 | **`margin`** entre-t-il | **Non** | Deux marges adjacentes s'additionnent ou fusionnent — CSS fusionne, plusieurs moteurs PDF additionnent — et **choisir est une politique de rendu**. Le contrat pourrait prendre la convention, comme il prend sRGB, mais il devrait alors écrire la somme d'un troisième espacement. Coût du refus : un `ContainerNode` par valeur d'air, chiffré |
| 7 | Le **fond perdu** et la **gouttière** | **Déclinés, docstring corrigée** | Les admettre aurait fait toucher `page/` à ce lot et **réviser la décision 13 de l'ADR 0006**, qui les range dans un silence attribué à personne. Le besoin est déjà couvert **sans champ** : « *Zero is legal -- a full-bleed label, or a template that manages its own gutter* » |
| 8 | **`justify`** : refusé ou admis | **Admis, sur un tuple propre au texte** | Le refuser demandait de garder un motif qui **prouve trop** — `center` exige la même métrique et est publié depuis C3. L'admettre **sur le tuple de colonne** aurait été la **troisième forme d'incompatibilité**, et un `justify` de colonne n'a de sens que pour les cellules qui contiennent du texte : il rouvrirait la confusion que la décision 5 ferme |
| 9 | L'**alignement vertical** en cellule ou en bande | **Refusé** | Il exigerait une **hauteur** contre laquelle aligner, et le contrat n'en déclare aucune — une hauteur de ligne se mesure sur le contenu. Le porteur n'existe donc pas : `TableCell` n'est pas un nœud, et une bande n'a pas de hauteur déclarée |

---

## Le protocole des mesures

**Toutes les mesures citées dans cette ADR ont été prises sur le dépôt lui-même**, à l'exception de
celles marquées *raisonné*. Ce qui a été employé :

- **Les quatre portes de la CI**, dans leur ordre :
  `pnpm run lint && pnpm run build && pnpm run type-check && pnpm run test:coverage`.
- **La matrice de mutation** : douze mutations de `ast/schemas.ts`, appliquées une par une, chacune
  compilée par `tsc -p packages/core/tsconfig.typecheck.json`, puis annulée. **Douze exit 1 sur douze**,
  chacune traçable à une paire nommée. Le harnais est **valide parce qu'il rougit** : la même matrice
  jouée avant l'écriture des huit paires laissait passer les mutations des segments et des trois nœuds.
- **Le calibrage de la forme bornée**, par **bisection sur le vrai `assertBoundedShape` du `dist` émis**
  et non par un compteur répliqué — un compteur maison s'était déjà révélé décalé d'une unité en
  profondeur. `RECIPE_TEMPLATE` exige `maxNodes ≥ 285` et `maxDepth ≥ 18`, soit **0,29 %** et **28,13 %**
  des plafonds par défaut.
- **La compatibilité arrière**, contre le build **réellement compilé depuis le commit qui précède le
  lot** : le source d'alors extrait par `git archive`, compilé avec le `tsconfig` du dépôt et les
  dépendances du dépôt. C'est ce build qui a rendu « accepté sans aucune erreur, 44 valeurs sur 81
  effacées » et le message typé de `TemplateMigrationError`.
- **Les deux contrôles négatifs de la dérogation d'import**, dans les deux sens : le barrel de `page/`
  passe les portes 2 et 3 à **exit 0** et casse à la porte 4 sur `ReferenceError`.
- **Le compte d'exports**, sur le JavaScript **émis** : `Object.keys` du `dist`. **104 avant, 117
  après.** Le compte des **types** reste *raisonné* — un type n'apparaît pas dans les clés d'un module
  JavaScript, et la limite est écrite dans le test plutôt que dissimulée.
- **La démonstration**, dans un navigateur réel, par lecture des **styles calculés** des deux factures
  plutôt que par capture d'écran.

**Ce qui n'est PAS mesuré**, et cette ADR le dit plutôt que de le laisser croire : le rendu **PDF** (il
n'existe aucun moteur), le comportement au **point de coupe** (aucun paginateur), la **fusion de deux
filets adjacents**, la **résolution d'un nom de police** sur deux machines différentes, et le jugement
« **visuellement très différentes** », qui est une **revue humaine** que le propriétaire du produit
porte. Les cinq premiers seront vérifiables au lot **E2** ; le dernier ne le sera jamais par une
machine, et c'est pour cela qu'il est nommé.
