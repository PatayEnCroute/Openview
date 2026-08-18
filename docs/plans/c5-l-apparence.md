# Plan d'implémentation — `@openview/core` lot C5 : l'apparence

> **Document d'implémentation.** Il dit *comment* livrer un lot : découpage, fichiers touchés,
> contrat définitif, tests, ordre des commits. Il ne dit ni *quoi* ni *pourquoi* — cela vit dans
> `docs/roadmap/` — ni les *décisions* structurantes, qui se consignent dans `docs/adr/`. Il est
> **périssable** : une fois le lot livré, il ne fait plus foi, et c'est l'ADR 0007 qui reste.
>
> **Statut : ✅ prêt à exécuter — SOUS RÉSERVE des neuf arbitrages du [§8], dont DEUX sont ⛔.**
> **Révision 2, 2026-08-18** — la revue du plan a rendu **sept blocages**, tous vérifiés et tous
> retenus. Quatre arbitrages qui étaient ⛔ sont **tranchés ici** plutôt que remontés (n° 1, 4, 5,
> 8), parce qu'un lot ne se clôt pas sur un trou de contrat ; deux le restent (n° 2, 3), et ce sont
> les deux que la revue **n'a pas** contestés. **Deux arbitrages bloquants signifient que le [§3]
> est écrit sous réserve** — il est écrit dans la forme **recommandée**, et une réponse contraire
> sur l'un des deux impose de le réécrire, pas de l'amender.
>
> | # | Arbitrage | ⛔ | Décision / recommandation | Ce que l'autre branche réécrit |
> | :-- | :--- | :-: | :--- | :--- |
> | 1 | Le troisième terme de la résolution typographique (`Template.style`) | **tranché** | **A** — deux termes, **clos** | `migrate.ts` devient transformant, 28 tests, **et un mandat produit** |
> | 2 | La graisse : booléen, neuf paliers, ou échelle continue | ⛔ | **A** — `bold?: boolean` | un champ de forme stockée, gratuit **avant** l'estampille |
> | 3 | La table de styles nommés | ⛔ | **A** — aucune | un `superRefine`, un refus nouveau, [D15] tombe |
> | 4 | La largeur d'un tableau | **tranché** | **A** — **sémantique déclarée, aucun champ** | un champ `widthMm`, et l'estampille si c'est après INC-4 |
> | 5 | La taille d'une image | **tranché** | **A** — aucune dimension, **contournement exact** | deux champs, et une convention d'ajustement à écrire |
> | 6 | `margin` | — | **A** — non | un champ, une attente moteur sur la somme |
> | 7 | `bleed` / `gutter` | — (⛔ pour `page/`) | **A** — déclinés, docstring corrigée | C5 touche `page/`, et révise l'ADR 0006 D13 |
> | 8 | `justify` | **tranché** | **C** — **admis sur un tuple propre au texte** | le refus, et la justification inexprimable dans le produit |
> | 9 | L'alignement vertical | — | **A** — refusé | un champ sur `TableCell`, une attente sur la hauteur |
>
> ⚠️ **Ce que la révision 2 a invalidé dans les mesures du [§C], et qui doit être REMESURÉ avant
> INC-5.** Les mesures du bac à sable ont été prises sur le contrat de la révision 1. Cinq d'entre
> elles ne valent plus telles quelles, et le plan les marque **dérivées** partout où elles
> apparaissent plutôt que de réécrire un chiffre qu'aucune sonde n'a rendu : le **compte d'exports**
> (116 → **117 dérivé** : `TEXT_ALIGNMENTS` est une valeur), le **compte de tests** (627 → dérivé),
> la **liste des refus `N01`…`N26`** (trois refus neufs : l'objet de style vide, le filet
> d'épaisseur nulle, `justify` sur une **colonne**), le **poids de `RECIPE_TEMPLATE`**, et les
> **désaccords avec la campagne de mesure** (le désaccord `gt(0)` → `min(0)` **disparaît**, le
> contrat revient à `gt(0)` avec un autre motif et un autre message). Aucune de ces cinq lignes
> n'est présentée comme mesurée.
>
> **Date :** 2026-08-18 · **Brique :** `@openview/core`, vague 1 · **Jalon visé :** J1
>
> ---
>
> **Ce qui a été mesuré, et ce qui ne l'a pas été.** Le protocole complet est en tête du [§3]. En
> résumé : un bac à sable **hors du dépôt** (`…/scratchpad/sandbox-final/core/`), une **copie
> intégrale** de `packages/core/src` — 3 008 lignes —, un `tsconfig` qui **étend**
> `tsconfig.base.json` et reprend les options de `packages/core/tsconfig.json` (donc `strict`,
> `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `lib: ["ES2022"]`, `types: []`,
> NodeNext), des **jonctions Windows** vers le `zod@3.25.76` et le `vitest` du dépôt, le
> `typescript@7.0.2` du dépôt, Node `v24.11.1`, et le `dist` de `main` pour tout ce qui touche à la
> compatibilité arrière. `git status --porcelain` rend **zéro ligne avant et après**, à `3893fb5`.
>
> - **Le contrat compile : `tsc -p tsconfig.json` — exit 0**, sur `core/src` complet, les 20
>   fichiers de test compris.
> - **Il s'exécute : `vitest run` — 20 fichiers, 627 tests verts** (591 de `main` + 36 du lot).
>   **Zéro test existant modifié dans son intention** ; trois assertions ont été mises à jour, et
>   chacune **parce qu'elle avait rougi**.
> - **Il s'émet et s'importe : exit 0**, et le JavaScript émis expose **116 valeurs** contre 104
>   mesurées sur le `dist` de `main` — les **+12** de [§3.10], au symbole près.
> - **Les vingt-six refus au *save time* ont été rejoués** : `N01` … `N26` portent les `code`, les
>   `path` et les **messages réels** de `safeParse`, plus **13 contrôles positifs**. Ils sont
>   confrontés aux `R01` … `R26` de la campagne de mesure, avec **cinq désaccords** tous imputables
>   à une décision de ce plan, et **deux précisions de chiffre** [§5.1].
> - **Trois contrôles négatifs valident le harnais** — un harnais qui ne rougit jamais ne prouve
>   rien : le barrel de `page/` (exit 0 au type-check, `ReferenceError` à l'exécution), la matrice
>   de mutation (**11 mutations, 11 exit 1** après INC-0 ; **3 sur 4 exit 0** avant), et la
>   contrainte `lib: ["ES2022"]` rencontrée sur `toSorted` (`TS2550`, **acceptée** et non desserrée).
> - **Le calibrage a été refait par BISECTION sur le vrai `assertBoundedShape` du `dist`**, et non
>   par un compteur répliqué — le compteur maison était décalé d'une unité en profondeur.
>   `RECIPE_TEMPLATE` pèse **242 / 18** avant le lot et **285 / 18** après.
> - **Ce qui n'est PAS mesuré**, et le [§9] le tient pour acquis : la **porte 1** (`biome check`,
>   qui écrit son cache), la **porte 2** sur le dépôt (elle écrit `dist` — elle a été jouée sur le
>   bac à sable), la **couverture** (`test:coverage` écrit), la compilation d'`apps/playground`, et
>   la **revue humaine** du critère de recette. Aucune mesure ne dit « visuellement très
>   différentes » : le [§6] nomme qui le juge.
>
> ---
>
> **Revue de contradiction.** Trois conceptions concurrentes du même contrat ont été rédigées
> **indépendamment**, chacune gouvernée par une contrainte différente — l'une par le **contrat
> minimal**, l'une conçue **à rebours depuis le rendu**, l'une par la **cohérence avec les lots
> d'aval et la réversibilité** — puis confrontées décision par décision.
>
> Elles convergent sur l'essentiel, et une convergence de trois raisonnements indépendants est un
> signal plus fort qu'un argument : **`CURRENT_SCHEMA_VERSION = 6`** avec une entrée `{ from: 5,
> to: 6 }` ajoutée **sans fusionner** les quatre existantes ; **deux natures d'apparence** plutôt
> qu'un objet `style` unique ; **aucune expression** en position de style ; et **aucun champ sur
> `NodeBase`**. Aucune des trois n'a trouvé d'argument contre l'estampille.
>
> Elles divergent sur trois points, et **aucun n'a été tranché discrètement** : le **troisième
> terme de la résolution** (n° 1), la **table de styles nommés** (⛔ n° 3), et le **site
> d'accrochage** — cinq types de nœud, neuf formes, ou l'entre-deux. Les trois sont au [§8].
>
> **Ce que la contradiction a corrigé.** Trois relectures adverses — périmètre, versionnement,
> mesures — et une campagne de mesure ont produit une soixantaine de constats, tous disposés un par
> un. **Onze ont changé la forme du contrat**, dont cinq de fond :
>
> - **`gap` sort du lot.** Il était **sans sujet sur trois de ses cinq porteurs**, et il réécrivait
>   en silence la formule publiée de `TableColumn.width`. C'est la condition 4 de [D1] qui le tue,
>   et cette condition-là a été **ajoutée à cause de lui** [D11].
> - **`align` quitte `BoxStyle` pour `TextNode` seul.** Il avait **deux déclarants pour un même
>   fait** — la colonne et la boîte — et aucun vainqueur désigné. La précédence est désormais une
>   **fonction exportée**, pas une phrase [D5].
> - **`ResolvedTypography` disparaît.** Mesuré : ses cinq champs restaient `| undefined`, donc son
>   nom affirmait le contraire de ce que le type disait — 5 × `TS2322` [D4].
> - **Le filet passe de `gt(0)` à `min(0)`.** Refuser une épaisseur nulle était une **règle de
>   typographie**, exactement celle que C4 refuse d'écrire pour une marge [D10].
> - **`MAX_STYLE_LENGTH_MM` n'existe pas.** Une borne s'**importe** — `MAX_SHEET_MM` — elle ne se
>   recopie pas sous un second nom, et `MAX_FONT_SIZE_PT` en est **dérivé** [D7].
>
> Et **deux gestes manquaient**, tous deux ajoutés : les **huit paires `*_KEYS_IN_STEP`** de
> l'incrément 0, et la **conversion pt ↔ mm exportée une seule fois**.
>
> **Cinq attaques ont été réfutées, et le plan les garde avec leur réfutation** — ce dépôt conserve
> les objections mortes, parce que c'est la réfutation qu'on relira le jour d'une réouverture. Les
> deux plus utiles : **un fond de bloc n'empiète pas sur les calques de C11/D10** — une bande
> *occupe* de la place, un filigrane est *derrière* le flux au milieu, ce ne sont pas deux réglages
> du même objet ; et **la cascade n'est pas condamnée par l'ADR 0004 D8** — l'analogie avec
> l'héritage d'arrondi ne tient pas, parce qu'un arrondi change un **chiffre** et un style ne change
> que la **forme** d'un caractère déjà décidé. Le refus de cascade de [D12] repose donc sur son
> propre motif, et non sur un précédent emprunté.
>
> ---
>
> **⚠️ Une réserve de méthode, que ce plan doit à son lecteur.** L'orchestration qui l'a produit a
> **échoué une fois**, et le lecteur doit savoir où.
>
> L'agent chargé de la synthèse est **mort à l'écriture** — sa réponse a dépassé la limite de
> sortie — après avoir fait le travail mais avant de l'avoir rédigé. Il avait laissé derrière lui
> son **bac à sable** : un contrat complet, **compilable, mesuré à `tsc` exit 0**, plus deux sondes
> de coût et de refus. **Les trois relectures adverses et la campagne de mesure ont donc porté sur
> ce contrat exécutable, et non sur une prose de synthèse** — chacune l'a écrit en tête de son
> rapport, et **six constats** ont été classés « contingents à une prose absente ».
>
> La synthèse a ensuite été **reprise**, et les six constats contingents ont été redisposés contre
> le texte réel. Ce qui reste vrai malgré la reprise, et qu'il faut lire comme une limite : les
> attaques n'ont **pas** relu le contrat définitif du [§3] dans sa forme finale — elles ont relu
> celle qui l'a précédé, et les onze corrections qu'elles ont imposées n'ont pas été **réattaquées**.
> C'est le point faible connu de ce plan, et il est nommé plutôt que caché.
>
> Cinq rédacteurs devaient ensuite écrire les sections de ce document ; **ils ont échoué sur une
> limite de dépense**, et les sections [§1], [§4], [§5], [§6], [§7], [§9] ainsi que cet en-tête ont
> été écrites directement par l'orchestrateur, à partir du dossier de synthèse et de contrat. Les
> [§2], [§3] et [§8] sont, eux, le texte de la synthèse et du contrat, **transféré sans réécriture**.
>
> ---
>
> **La faiblesse structurelle du lot, écrite en tête plutôt qu'enterrée.** Le contrat de C5 porte
> **zéro invariant croisé**, là où C4 en portait deux — donc **sa surface de refus est strictement
> plus faible que celle de C4**. Ce n'est pas une vertu de simplicité : c'est la conséquence
> mécanique du refus de cascade et du choix de tout rendre optionnel. Un contrat dont chaque champ
> est facultatif et indépendant n'a presque rien à refuser. Le [§8, signalement N] le porte, et le
> [§6.1] en tire la conséquence qui gêne : **deux champs suffisent à satisfaire littéralement le
> critère de recette**, donc ce critère **ne peut pas** justifier les douze que le lot livre — c'est
> l'énumération de `docs/roadmap/core.md:209-212` qui porte cette charge, et [D1] le dit.

---

## 0. Le cadre : le contrat décrit une apparence, il n'en dessine aucune

`@openview/core` **décrit**, il ne **produit** rien : aucune page, aucun pixel, aucun PDF. La
roadmap de la brique l'écrit sans détour — « si une question commence par *à quoi ça ressemble*,
elle appartient au moteur ou au viewer ».

**Et c'est précisément ce qui rend ce lot différent des quatre précédents : « à quoi ça ressemble »
EST le sujet de C5.** C1 décrivait des calculs, C2 des arrondis, C3 une structure de tableau, C4 une
géométrie de feuille. Tous les quatre pouvaient s'écrire sans jamais frôler la question du rendu.
C5 ne peut pas. Il faut donc dire, en ouvrant, où passe exactement la ligne — sinon chaque champ
la franchira un peu, et personne ne saura dire lequel.

**La ligne est celle-ci : déclarer n'est pas résoudre.**

- **Déclarer une police**, c'est écrire un nom dans un document. **La résoudre**, c'est chercher un
  fichier de fonte sur une machine, et échouer si elle n'y est pas. Le contrat fait le premier et
  n'a aucun moyen de faire le second : `packages/core` compile avec `types: []` et
  `lib: ["ES2022"]`, donc `document`, `window` et `process` y sont des erreurs de compilation —
  **mesuré : `TS2584`, `TS2304`, `TS2591`**. Une métrique de police est barrée par le compilateur
  avant de l'être par une règle.
- **Déclarer une taille**, c'est écrire un nombre. **La mesurer**, c'est demander à un moteur de
  fonte la largeur d'une chaîne. Le contrat ne porte donc **aucun `auto`**, **aucun interligne
  dérivé de la police**, et **aucune hauteur** — l'ADR 0006 avait déjà tué, sur cet argument exact,
  une réserve de bande exprimée « en lignes de texte » : *une ligne n'a de hauteur qu'avec une
  police, donc C5, donc une métrique de police, donc une lecture de la machine*.
- **Déclarer une couleur**, c'est écrire six chiffres hexadécimaux. **La composer**, c'est mélanger
  deux couches dans un espace colorimétrique. Le contrat n'a **aucun canal alpha**, et il dit dans
  quel espace ses six chiffres s'interprètent — parce qu'un contrat de couleur qui ne le dit pas
  laisse deux implémentations peindre deux couleurs différentes [D8].

**Deux exceptions nommées, et une exception écrite est une exception qu'on peut discuter.** Le lot
exporte quatre fonctions, ce qui ressemble à du calcul dans une brique qui n'en fait pas. Les deux
motifs sont différents, et les confondre serait emprunter un précédent qui ne s'applique pas —
c'est le constat `M4`, et il a modifié cette section.

1. **`mmFromPt` et `ptFromMm` héritent EXACTEMENT du précédent de `printableAreaOf`**, et pour la
   même raison mesurée : le contrat porte **deux unités** — la taille de caractère en points, tout
   le reste en millimètres — et une conversion écrite deux fois donne deux doubles différents.
   **Mesuré : 31,5 % de divergence entre deux formes d'écriture de la conversion, 60,9 % entre
   quatre.** La décision produit 7 promet un aperçu *identique au PDF, garanti* ; une conversion
   dupliquée la casse en silence. Une fonction exportée fait de cet accord une **dépendance** au
   lieu d'une convention [D6].
2. **`resolveTypography` et `resolveTextAlign` n'héritent PAS de ce précédent, et le dire est
   obligatoire.** Elles ne font aucune arithmétique : ce sont des chaînes de `??`, donc il n'y a
   aucune variance IEEE-754 à centraliser. Leur motif est autre, et il est plus faible : elles
   énoncent **une règle de précédence**, et une règle de précédence écrite en prose se
   réimplémentera deux fois — une fois dans le moteur, une fois dans le viewer — avec le droit de
   diverger. Ce que ces deux fonctions garantissent, c'est qu'il n'existe **qu'une seule
   orthographe** de « le style du run gagne sur celui du bloc » et de « l'alignement du texte gagne
   sur celui de la colonne ». Ce n'est pas une garantie de bit, c'est une garantie d'unicité.

**Ce que le contrat ne fait toujours pas, et ne fera pas dans ce lot :** il ne mesure rien, il ne
charge rien, il ne compose rien, il ne connaît ni écran, ni imprimante, ni fonte. Les **huit**
attentes que ce lot **crée** envers un moteur futur — comment il traite une boîte coupée entre deux
pages, comment il résout une police absente, ce qu'il fait des cinq valeurs typographiques qu'un run
peut ne pas déclarer, dans quel espace il peint, quelle conversion pt → unité de rendu il emploie,
**comment deux filets adjacents se rencontrent**, **comment il honore les deux conventions de
justification**, et **quelle place il donne à une image sans dimension déclarée** — vivent dans
**l'ADR 0007** et dans **aucune docstring** [D16]. C'est la correction que le lot C3 a dû s'appliquer
à lui-même après coup : écrire le comportement du moteur dans le contrat, c'est prescrire depuis un
endroit qui n'a pas autorité.

> **Cette liste est la MÊME que celle de [D16], à l'élément près, et ce n'est pas une coquetterie
> de rédaction.** La révision 1 en annonçait cinq ici et en listait cinq **autres** là-bas — deux
> attentes promises en introduction (le `padding` d'un tableau, le filet d'épaisseur nulle)
> n'existaient dans aucune section. Elles ont disparu pour deux raisons opposées : le `padding` d'un
> tableau est désormais une **sémantique du contrat** [D11], pas une attente ; et un filet
> d'épaisseur nulle n'est plus **représentable** [D10]. Une introduction qui promet une section fait
> partie du contrat de lecture du document.

---

## 1. Pourquoi C5, et pourquoi maintenant

### Ce que la roadmap impose

`docs/roadmap/core.md:207-218`, cité intégralement parce que c'est le seul texte qui commande ce
lot :

> ### C5. L'apparence
>
> **Pourquoi.** Un document sans police, sans couleur et sans filet ne convaincra
> personne, quelle que soit la justesse des chiffres. Périmètre volontairement
> resserré : polices et tailles, graisse et italique, couleurs de texte et de fond,
> bordures et filets, alignements, espacements.
>
> **Prêt quand** deux factures visuellement très différentes sont décrites sans
> changer une seule donnée.
>
> **Poids :** L — **Dépend de :** C3

Trois choses à relever dans ce libellé, parce qu'elles gouvernent tout le reste du plan.

**Premièrement, l'énumération est le vrai périmètre, et non le critère.** Le libellé nomme **dix
attributs en six groupes** : polices, tailles, graisse, italique, couleur de texte, couleur de
fond, bordures, filets, alignements, espacements. C'est cette liste — et non le « prêt quand » —
qui porte la charge de justification de chaque champ du contrat, pour une raison mesurée qui est
gênante et que le [§6.1] développe : **deux champs suffisent à satisfaire le critère de recette**
pris à la lettre. [D1] en tire sa quatrième condition.

**Deuxièmement, « périmètre volontairement resserré » est une instruction, pas une excuse.** Elle
autorise le plan à refuser, et elle l'oblige à écrire ses refus : [D18] en compte **vingt-six,
en sept familles**, chacun avec le lot qui le possède.

**Troisièmement, « sans changer une seule donnée » est la seule contrainte dure de l'énoncé.** Elle
interdit qu'une apparence se déclare en touchant à ce que le document lit. C'est ce qui condamne,
sans autre argument, toute **expression en position de style** : un style calculé lit des données,
donc `collectTemplateDataPaths` change, donc le jeu de données change [D12].

Le lot sert le **jalon J1** : « une facture comptable complète, en deux langues, est **décrite**
dans un modèle ; un modèle incohérent est refusé avec un message compréhensible ». *Décrite* —
jamais rendue. Aucun document ne sortira de ce lot, et le [§6.3] dit pourquoi ce n'est pas un
manque.

### L'écart est réel, et il est mesuré

**Le contrat porte aujourd'hui exactement UN champ d'apparence : `TableColumn.align`.** Et ce champ
est, par écrit, une **exception nommée** : l'ADR 0005 D7 le justifie par deux arguments mécaniques
plutôt que par son propre critère d'appartenance — le libellé du lot C3 disait « un alignement par
colonne », et C5 « Dépend de : C3 », donc une propriété dont le critère de recette de C3 avait
besoin ne pouvait pas vivre dans le lot qui vient après.

Le reste est absent, et l'absence est chiffrée. **Le barrel public expose 185 symboles** — 81 types
et 104 valeurs, mesuré. **Aucun** ne nomme une couleur, une police, une graisse, un filet, un fond
ou un espacement de bloc. Un modèle Openview sait aujourd'hui décrire une facture juste au chiffre
près et **totalement muette sur son apparence** : le moteur qui la rendra devra inventer chaque
police, chaque taille, chaque filet — et rien ne garantira qu'un aperçu invente les mêmes.

Trois conséquences déjà visibles dans le dépôt, et qui ne sont pas des hypothèses :

- **Le playground dessine à la main.** Sa vitrine porte une quinzaine de constantes CSS écrites en
  React — `cellStyle`, `totalCellStyle`, `pieceDePiedStyle`, `bandeStyle`, `feuilleStyle` — dont
  **aucune ne vient du modèle**. Le document qu'il affiche est stylé par le code de la vitrine, pas
  par le contrat. C'est l'aveu le plus net de l'écart, et [§3.17] le referme.
- **Quatre docstrings de production promettent l'apparence à C5**, dont une qui promet la
  justification typographique et une qui promet une surcharge d'alignement par cellule. Elles sont
  publiées dans `main`, elles sont lues, et le lot doit les honorer ou les corriger : [D17] en
  corrige **sept**, dont ces quatre.
- **Le critère de recette est aujourd'hui inatteignable**, et pas de peu : deux modèles ne peuvent
  pas différer visuellement, puisqu'aucun champ ne le permet. La distance entre l'état actuel et le
  critère est **la totalité du lot**.

### Ce que C5 débloque, et ce qu'il ne débloque pas

**Il débloque C6.** `docs/roadmap/core.md:229` écrit « **Poids :** L — **Dépend de :** C2, C5 ».
C'est la seule dépendance déclarée en aval de ce lot, et elle est nette : C6 formate des montants,
des dates, des séparateurs, un symbole monétaire et des libellés fixes — il change **les caractères
qu'un lecteur lit**. C5 ne change que **la forme de caractères déjà décidés**. Cette phrase est la
condition 1 de [D1], et elle existe parce qu'un test de l'ADR 0004 D10, pris pour un test général,
rangerait **tout C5 en C6** [§8, signalement K].

**Il ne débloque aucun rendu, et c'est à dire franchement.** `packages/engine/src/index.ts` fait
six lignes ; `packages/viewer/src/index.ts` en fait six. Après C5, un modèle saura décrire une
facture en deux apparences très différentes, et **rien ne les dessinera**. C'est exactement la
réserve que C4 a écrite pour lui-même — « aucun document ne sort sur deux pages après C4 : il
n'existe pas de moteur » — et elle se transpose mot pour mot.

**Il ne débloque pas C7 non plus, et c'est délibéré.** C7 « Dépend de : C4 », pas de C5. Livrer un
`keepTogether` ici préempterait le seul lot que C4 débloque : [D18] le refuse nommément, dans la
famille « ce qui appartient à un lot voisin ».

### Pourquoi maintenant, et non plus tôt ni plus tard

**Parce que C3 est livré, et que c'est la seule dépendance déclarée du lot.** La roadmap écrit
« Dépend de : C3 », et C3 a livré le 2026-08-17 l'objet auquel accrocher une apparence — l'ADR 0005
l'écrit d'avance : « **Pour C5.** Il reçoit un objet auquel accrocher une apparence, et la porte
reste ouverte dans le seul sens qui ne coûte rien ».

**Parce que C4 est livré, et que l'ADR 0006 a créé une dépendance que la roadmap ne déclare pas.**
`docs/adr/0006-la-page.md:1054-1058` : « **C5** reçoit une zone imprimable dans laquelle régler des
espacements et des filets : c'est la raison pour laquelle **C4 passe avant lui**, alors que la
roadmap ne déclare pas ce lien — rien n'empêcherait mécaniquement de les inverser, et l'inversion
coûterait une reprise de C5. » L'ordre effectif est donc le bon, et il est le bon **par chance
documentée** plutôt que par prescription : c'est un fait à connaître, pas un mérite à revendiquer.

**Parce que deux gains sont gratuits aujourd'hui et coûteraient une migration demain.** Une bande
de page hérite du style **sans un champ** : `PageBand.content` **est** un `ContainerNode`, donc
tout ce que C5 accroche à un conteneur, une bande le porte [D3]. Et l'alignement de colonne de C3
peut recevoir une **surcharge** — l'ADR 0005 a explicitement gardé la porte ouverte « dans le seul
sens qui ne coûte rien », l'ajout ; le déplacer plus tard serait transformant.

**Parce que C6 attend, et qu'un lot qui attend dérive.** C6 est le dernier verrou de la décision
produit 11 (multi-langue et multi-devise dès le contrat), décidée tôt « à raison : ajouté après
coup, ce sujet touche tout ». C5 est ce qui le libère.

### Arguments contraires, examinés et écartés

**(a) « Attendre le moteur pour savoir ce dont il a besoin. »** C'est l'argument le plus sérieux,
et il est réfuté par l'ordre de la roadmap plutôt que par ce plan : la décision produit 4 fixe
« brique par brique : core → engine → viewer → service → designer », et la vague 1 de `core` est
« terminée **avant** d'ouvrir le moteur ». Un moteur construit sur un contrat muet sur l'apparence
inventerait ses propres champs, et le contrat les ratifierait après coup — c'est-à-dire l'inverse
de ce que cette brique est. **Ce que la conception « à rebours depuis le rendu » a tout de même
apporté**, et qui est retenu : la question *deux implémentations indépendantes peuvent-elles en
tirer le même résultat ?* est le meilleur filtre du lot, et c'est elle qui a produit [D6] et la
condition 3 de [D1].

**(b) « Livrer C6 d'abord, puisque le multi-langue est décidé plus tôt. »** Impossible sans réécrire
la roadmap : C6 « Dépend de : C2, **C5** ». Et l'ordre a un motif propre — C6 doit se brancher sur
des positions de contenu existantes, et si C5 en créait une seconde, C6 aurait **deux** endroits à
traduire. C'est le défaut exact pour lequel C3 a refusé un `label: string` sur une colonne, et [D2]
vérifie que le contrat ne le recrée pas.

**(c) « Livrer un sous-ensemble maintenant — la police et la couleur — et compléter après. »**
Écarté sur le coût du versionnement, pas sur le goût : chaque tranche ajoutée à une forme stockée
demande **sa propre estampille**, et l'estampille est ce qui rend « aucun commit antérieur n'est
publiable » vrai à chaque fois. Trois tranches coûteraient trois estampilles, trois migrations et
trois fenêtres de non-publiabilité, pour un contrat dont la surface finale serait identique. La
convention du dépôt est écrite dans le code — estampiller **une** fois, après la dernière forme
persistée du lot.

**(d) « Attendre C10 et le catalogue de données, puisque le designer éditera ces styles. »** Écarté
parce que la dépendance n'existe pas : un style ne lit **aucune** donnée [D12], donc il ne touche
ni le catalogue, ni `collectTemplateDataPaths`. C11 — grille, colonnes et calques — est en vague 2
et « Dépend de : C10 », mais C5 n'en dépend pas, et la frontière avec les calques est tracée par
l'ADR 0006 : un fond de bloc **occupe** la place du bloc, un filigrane est **derrière** le flux.

**(e) « Le lot est trop gros : le poids L est optimiste. »** Concédé en partie, et c'est pourquoi le
[§4] compte **neuf** incréments là où C4 en comptait sept, dont un incrément **0** qui ne livre
aucune forme stockée et ne sert qu'à rendre la porte de type voyante. L'empreinte réelle est
mesurée : **23 fichiers touchés**, **+36 tests**, **+20 exports** — contre 20 fichiers et
+2 312/−275 lignes pour C3, dont le poids était M. **L est le bon ordre de grandeur, et le lot est
plus proche de C3 que de C4.**

---

## 2. Ce qui est décidé, et ce que ça engage

> **Forme imposée du dépôt**, pour chacune : `**Décision.**` à l'indicatif, sans conditionnel ·
> `**Pourquoi.**`, le motif tel qu'il s'écrit **avant** la décision, avec la mention **mesuré**
> ou **raisonné** · `**Écarté.** (a) … (b) … (c) …` · `**Réversible**` / `**Irréversible**` avec
> son **signal de réouverture** quand il en a un.
>
> **Dix-huit décisions**, et le nombre n'est pas un hasard de rédaction : C3 et C4 en ont treize
> chacun, mais tous deux livraient **une** famille de formes. C5 en livre deux (la boîte et la
> typographie), sur **neuf** sites d'accrochage, avec une conversion d'unité et deux
> précédences à écrire. Le décompte est assumé, et il est écrit plutôt que caché : **D1** est le
> critère d'appartenance, **D2 à D12** la forme, **D13** la porte de type, **D14** l'estampille,
> **D15** la politique d'erreur, **D16** les attentes envers le moteur, **D17** les corrections
> du dépôt, **D18** ce que le lot refuse.
>
> ⚠️ **Aucune de ces décisions ne s'accorde de dérogation à `AGENTS.md`.** Là où une forme en
> demanderait une, elle est portée en **arbitrage ⛔** avec la mention « demande un **mandat** ».

### Vue d'ensemble

| # | Décision | Forme stockée ? | Réversible ? |
| :-- | :--- | :--- | :--- |
| **D1** | Le critère d'appartenance, en **quatre** conditions, écrit avant la liste des champs | — | — |
| **D2** | **Deux natures, deux formes stockées** : `BoxStyle` (la boîte) et `Typography` (les caractères) | **oui** | non |
| **D3** | `box` sur **cinq** types de nœud, jamais sur `NodeBase`, jamais sur les trois nœuds de contrôle | **oui** | dans un seul sens |
| **D4** | `typography` sur `TextNode` **et** sur les trois kinds de segment ; **deux** termes ; la résolution est exportée et ne s'appelle **pas** « Resolved » | **oui** | n° 1 |
| **D5** | `align` est **DEUX faits** : `TEXT_ALIGNMENTS` (4 membres) sur `TextNode`, `TableColumnAlignment` (3) inchangé sur la colonne, qui fournit un **défaut** | **oui** | n° 8 tranché |
| **D6** | **Deux unités**, la conversion exportée **une fois**, et **aucune contrainte de décimales** | **oui** | ⛔ n° 2 partiellement |
| **D7** | Les bornes sont **importées**, jamais recopiées ; `MAX_FONT_SIZE_PT` est **dérivé** | non | oui |
| **D8** | Une couleur est six chiffres hexadécimaux, **dans les deux casses**, interprétés en **sRGB** ; aucun canal alpha | **oui** | dans un seul sens |
| **D9** | Le nom de police est une **déclaration** ; le contrat n'en police pas la résolution et **inscrit le danger** | **oui** | non |
| **D10** | **La forme canonique est l'ABSENCE** : objet de style vide **refusé**, filet d'épaisseur nulle **refusé** (`gt(0)`), plancher de zéro là où l'absence n'est pas représentable | **oui** | non |
| **D11** | Les espacements : **`padding` seul**, ni `gap`, ni `margin` — **et le modèle de boîte est écrit**, tableau et ligne compris | **oui** | dans un seul sens |
| **D12** | Aucune cascade, aucun défaut de document, aucun `z.default()`, **aucune expression de style** | — | non pour l'expression |
| **D13** | **La porte de type d'abord** : huit paires `*_KEYS_IN_STEP` avant tout champ de style | non | — |
| **D14** | `CURRENT_SCHEMA_VERSION = 6`, **estampille seule** ; et `## What version 6 means` ne recopie pas l'asymétrie de la v5 | **oui** | non |
| **D15** | **Zéro** code d'erreur nouveau, **zéro** site nouveau — la ligne de C4, tenue ; trois `.refine` de forme canonique, `code: 'custom'` | non | — |
| **D16** | Les **huit attentes envers le moteur** vivent dans l'ADR, **jamais** dans une docstring | non | oui |
| **D17** | Les **huit corrections du dépôt** que le lot porte | non | oui |
| **D18** | Ce que le lot refuse, **par familles**, avec le lot qui possède chaque refus | — | selon |

**Toutes les mesures citées dans cette section ont été prises** : protocoles en tête de
`la campagne de mesure`, `relecture adverse « périmètre » §10`, `relecture adverse « versionnement » §1`,
`relecture adverse « mesures » §8`. Ce qui n'est pas mesuré porte la mention **raisonné** ou **non mesuré**.

---

### D1 — Le critère d'appartenance tient en quatre conditions, et la roadmap porte la charge de justification des champs

**Décision.** Une déclaration appartient au lot C5 **si et seulement si** les quatre conditions
suivantes sont vraies. Et la **charge de justification** de chaque champ retenu est
l'énumération de `core.md:209-212` — **dix attributs en six groupes** — **jamais** le critère de
recette, qui est un **seuil minimal de démonstration** et non une définition de fini.

> 1. **Elle est aveugle au contenu** : elle a un sens sans savoir ce que le bloc contient, ni de
>    quel type est la valeur qu'il porte.
> 2. **Elle ne change que ce qu'un lecteur VOIT, jamais les CARACTÈRES qu'il lit** : aucun
>    caractère n'est ajouté, retiré, traduit ni recassé par elle.
> 3. **Un moteur peut l'honorer sans MESURER et sans INVENTER de politique** : ni métrique de
>    police, ni arbitrage entre deux rendus également légitimes.
> 4. **Sa valeur a un sens sur CHAQUE porteur où le contrat l'autorise.**

**Pourquoi ce critère, et pas celui des trois conceptions.** *(Raisonné, contre un constat
mesuré par lecture.)* Les trois conceptions avaient un critère qui **n'écarte pas ce qu'il
prétend** (`P-15`), et de trois façons distinctes :

- **Un critère topologique se satisfait en déplaçant le champ.** « Elle est écrite sur un nœud de
  l'arbre du document » écarte la table de styles nommés parce qu'elle vivrait sur le
  `Template` — mais posez la même table sur le nœud racine, qui **est** un `ContainerNode`
  (`template/template.ts`, `root: ContainerNodeSchema`), et elle passe la condition sans avoir
  changé d'un iota. C'est exactement le défaut que l'ADR 0006 `:117-121` a nommé pour écarter son
  propre critère en une condition. **Aucune des quatre conditions ci-dessus n'est topologique.**
- **Une condition qu'on n'applique pas à ses propres champs est décorative.** « Un moteur peut
  l'honorer sans aucune politique à inventer » validait un contrat qui **admet `weight: 450`**
  (mesuré : contrôle positif de `verify8.mjs`, et aucune fonte n'a cette face) **et `gap` sur un
  `table`** (`border-spacing`, c'est-à-dire un modèle de mise en page). Le tableau de
  vérification ci-dessous est donc joué **dans les deux sens**.
- **« Son retrait fait tomber le critère de recette » est faux pour dix champs sur douze.**
  Mesuré par l'exercice complet : deux factures écrites avec le contrat, puis chaque champ retiré
  un par un — **seuls `family` et `background` font tomber le critère** (`P-14`). Une condition
  fausse pour 83 % des champs qu'elle sert à justifier est décorative au sens que les deux ADR
  interdisent. Elle **saute**, et la charge passe à l'énumération de la roadmap.

**Ce que chaque condition écarte SEULE — sinon elle est décorative.** *(L'épreuve que l'ADR 0006
s'est imposée : « on peut le montrer par ce que chacune écarte seule ».)*

| Condition | Ce qu'elle écarte **seule** | Pourquoi les trois autres ne l'écartent pas |
| :-- | :--- | :--- |
| **1** (aveugle au contenu) | **tout C6** — séparateur de milliers, position du symbole monétaire, motif de date, forme des chiffres ; le **formatage conditionnel** (« en rouge si échu ») ; une couleur dérivée du **type** de la valeur ; un alignement dérivé du **signe** d'un montant | ils sont décidés par l'auteur (2 ✓), n'exigent aucune mesure ni politique une fois la règle écrite (3 ✓), et ont un sens sur chaque porteur de texte (4 ✓). **C'est la seule condition qui partage C5 de C6** — le test de l'ADR 0004 D10 range tout C5 en C6 s'il est pris pour un test général [signalement K] |
| **2** (vu, jamais lu) | un **`textTransform`** ou des petites capitales — ils changent les caractères, et l'algèbre porte déjà `textCase` (ADR 0003), donc ce serait **deux orthographes d'un même fait** ; un **motif formaté** `'Page {n} / {total}'` (ADR 0006 `:955` : « c'est un parseur, avec son échappement et **sa surface d'injection** ») ; un **lien hypertexte** — il ajoute une cible sortante (E8) et un contenu à traduire (C6) [N-5] | `textTransform` est aveugle au contenu (1 ✓), n'exige aucune mesure (3 ✓), a un sens sur chaque texte (4 ✓) |
| **3** (sans mesurer, sans politique) | le dimensionnement **`auto`** et toute largeur ajustée au contenu (`ast/types.ts:242-244`) ; l'**interligne exprimé en lignes** (ADR 0006 `:649`) ; **`keepTogether`** et toute politique de coupe (**C7**) ; l'**opacité**, l'**ombre**, le **dégradé** — un modèle de composition ; **`border-collapse`** ; une **pile de repli** de polices ; une graisse **`450`**, qui ne désigne aucune face ; **la taille d'une image** [n° 5] | `keepTogether` est aveugle au contenu (1 ✓), n'ajoute aucun caractère (2 ✓), a un sens sur chaque bloc (4 ✓). **C'est cette condition, et non un choix de politesse, qui laisse la place de C7 vide** |
| **4** (un sens sur chaque porteur) | **`gap` sur une `image`** — aucun enfant, donc un état **sans sujet**, pas « ambigu » : vide ; **`gap` sur un `table` ou un `tableRow`** — il y signifie `border-spacing`, et il insère dans la formule publiée de `TableColumn.width` une soustraction qu'elle n'a pas (`ast/types.ts:233-235`) ; un `box` sur `LoopNode`, `ConditionNode`, `TableRowGroupNode` — ils produisent *N séquences* ou *rien* ; un `Typography` sur un `container` — aucun caractère à styler sans cascade ; un `background` sur un `TableColumn` — une colonne n'est pas une boîte du flux | `gap` sur une image est aveugle au contenu (1 ✓), ne change aucun caractère (2 ✓), n'exige aucune politique (3 ✓ — un moteur ne fait simplement rien). **C'est elle, et elle seule, qui tue `gap` sur une image**, et c'est la condition qui manquait aux trois conceptions |

⚠️ **La condition 3 a DEUX moitiés, et la révision 1 s'est servie de la mauvaise.** « Sans mesurer »
ne veut pas dire « sans qu'aucune mesure n'intervienne dans le rendu » : cela veut dire **sans
mesurer la MACHINE**. La distinction n'est pas rhétorique, elle est **réfutable en une ligne** —
`center` et `end` sont des membres **publiés dans `main`**, et centrer une ligne exige d'en connaître
la largeur composée, donc une métrique de police, exactement comme justifier. Un critère qui
refuserait `justify` sur ce motif refuserait aussi les deux membres que le dépôt livre déjà : **il
prouve trop, donc il ne prouve rien**. Ce que le lot E6 interdit, c'est qu'un moteur **lise son
environnement** — horloge, locale, fuseau, aléa —, jamais qu'il mesure une fonte **qu'il a lui-même
chargée** ; `engine.md:168` sépare d'ailleurs *désigner* une ressource de la *charger*, et
`engine.md` promet le déterminisme « au caractère près : **polices**, images », ce qui suppose la
mesure plutôt que de l'interdire.

**Ce qui reste de la condition 3, et qui mord réellement, c'est sa seconde moitié : « sans INVENTER
de politique ».** Elle se lit ainsi : une déclaration passe si le contrat peut **écrire la
convention en une phrase**, comme il écrit sRGB [D8] ; elle échoue si le choix reste un **arbitrage
entre deux rendus également légitimes** que le contrat laisse ouvert. C'est ce qui distingue, dans
la même famille :

| Déclaration | Mesure requise | Politique requise | Verdict |
| :--- | :--- | :--- | :--- |
| `center`, `end` | la largeur composée d'une ligne | **aucune** | admis, et **déjà publiés** |
| **`justify`** | la même, plus les blancs inter-mot | **deux, et les deux s'écrivent** : la dernière ligne n'est pas justifiée ; le résidu se répartit **entre les mots**, jamais entre les lettres | **admis** [n° 8, branche C] |
| dimensionnement **`auto`** | la largeur du **contenu**, dont dépend la **géométrie du document** | — | refusé : la mesure entre dans la **mise en page**, pas dans le tracé |
| **interligne en lignes** | la hauteur d'une ligne, dont dépend la **pagination** | — | refusé, même motif (ADR 0006 `:649`) |
| **taille d'image** partielle | le **ratio intrinsèque de la ressource** | « ajuster » ou « étirer » | refusé [n° 5] |

**La ligne de partage est donc nette, et elle n'est pas « mesurer ou non » : c'est « la mesure
change-t-elle la GÉOMÉTRIE que le contrat déclare, ou seulement le tracé à l'intérieur d'une
géométrie déjà déterminée ? »** `justify` ne déplace aucune boîte : la boîte du bloc est celle que
`padding` et la largeur du parent déterminent, et la justification ne redistribue que du blanc **à
l'intérieur** d'elle. `auto` déplace la boîte. C'est pour cela que l'un entre et l'autre pas, et
c'est ce qu'il fallait écrire.

**La vérification, jouée dans les deux sens — sinon le critère est décoratif.** *(Le tableau que
C3 et C4 exigent tous deux, ici étendu aux champs RETENUS, ce qu'aucune des trois conceptions
n'avait fait de bout en bout.)*

| Champ retenu | porteur(s) | 1 | 2 | 3 | 4 | charge de justification (`core.md:211-212`) |
| :--- | :--- | :-: | :-: | :-: | :-: | :--- |
| `Typography.family` | 3 segments + `TextNode` | ✓ | ✓ | **✗** | ✓ | « **polices** et tailles » — **exception nommée**, voir ci-dessous |
| `Typography.sizePt` | idem | ✓ | ✓ | ✓ | ✓ | « polices et **tailles** » |
| `Typography.bold` | idem | ✓ | ✓ | ✓ | ✓ | « **graisse** et italique » (⛔ n° 2 en décide la forme) |
| `Typography.italic` | idem | ✓ | ✓ | ✓ | ✓ | « graisse et **italique** » |
| `Typography.color` | idem | ✓ | ✓ | ✓ | ✓ | « **couleurs de texte** et de fond » |
| `BoxStyle.background` | 5 nœuds | ✓ | ✓ | ✓ | ✓ | « couleurs de texte et **de fond** » |
| `BoxStyle.border` (4 arêtes) | 5 nœuds | ✓ | ✓ | ✓ | ✓ | « **bordures et filets** » — une arête seule est un *filet*, les quatre sont une *bordure* |
| `BoxStyle.padding` (4 arêtes) | 5 nœuds | ✓ | ✓ | ✓ | ✓ | « **espacements** » |
| `TextNode.align` | `TextNode` | ✓ | ✓ | ✓ | ✓ | « **alignements** » — sur `TEXT_ALIGNMENTS`, **quatre membres**, `justify` compris [D5] |

**Deux exceptions, nommées plutôt que dissimulées.**

1. **`family` échoue la condition 3**, et il entre quand même, porté par **deux arguments
   mécaniques** — exactement comme `align` chez C3 : (a) `core.md:211` place « **polices** et
   tailles » en tête du périmètre, et `core.md:29` écrit que le contrat ne sait décrire « pas une
   police » ; (b) la frontière est **déjà tracée dans le dépôt et passe à l'intérieur du sujet** :
   `engine.md:168` distingue **désigner** une ressource de la **charger**. C5 désigne. L'exception
   est **bornée par sa formulation** : C5 stocke **un nom**, jamais une pile, jamais une URL,
   jamais une métrique — et le danger que ce nom soit une indirection vers la machine est
   **inscrit** [D9].
2. **`align` sur `TableColumn` est une exception préexistante du dépôt**, et le plan la cite :
   `ast/types.ts:211` dit que `align` « *FAILS the second* » condition du critère de C3 et y figure
   quand même. Un plan qui invoque ce critère pour délimiter C5 sans citer l'exception invoque une
   règle que le dépôt a **déjà mise en défaut lui-même** (`campagne de mesure §7.5`, mention n° 5).

**Le décompte, recompté — un décompte non recompté est un décompte faux.** `core.md:209-212`
énumère **six groupes virgulés** et **dix attributs** : police, taille, graisse, italique, couleur
de texte, couleur de fond, bordure, filet, alignement, espacement. Le contrat les couvre par
**neuf déclarations de champ**, dont deux quadruplets d'arêtes. Le plan **ne recopie ni « sept
familles »** (non reproductible sous aucun découpage) **ni « douze champs »**.

**Écarté.** (a) **Le critère de l'ADR 0004 D10** (« si une déclaration ne peut changer que ce
qu'un lecteur voit, elle est C6 ») : il a été écrit pour partager **C2/C6**, dans une ADR qui se
qualifie elle-même de « frontière C2/C6 », et pris pour un test général il range la police, la
couleur et le filet en **C6**. Il est **signalé**, pas réutilisé [signalement K]. (b) **Un critère
topologique** : voir ci-dessus. (c) **« Son retrait fait tomber le critère de recette »** : faux
pour dix champs sur douze, mesuré. (d) **Un critère en une condition** (« tout ce qui concerne
l'apparence ») : il admet le fond de page, le filigrane et la politique de coupe, c'est-à-dire
C11, D10 et C7 — le défaut exact que l'ADR 0006 `:117-121` a nommé pour son propre compte.

**Irréversible dans ses conséquences** — le critère décide de neuf formes stockées. **Réversible
comme texte** : il n'est pas une forme stockée.
*Signal de réouverture :* un champ demandé par un intégrateur qui passe les quatre conditions et
que le lot a refusé quand même — la ligne « largeur d'un bloc » en est déjà un cas, et elle est
traitée en arbitrage n° 4 plutôt que par le critère.

---

### D2 — Le contrat porte deux natures d'apparence, et non un objet `style` unique

**Décision.** Exactement **deux** formes stockées, avec deux domaines disjoints :

- **`BoxStyle` = `{ background?, border?, padding? }`** — le fond d'une boîte, ses quatre arêtes,
  son inset intérieur. Légal sur les **cinq** types de nœud qui **occupent une boîte dans le
  flux** [D3].
- **`Typography` = `{ family?, sizePt?, bold?, italic?, color? }`** — la forme des caractères.
  Légal sur les **trois kinds de segment** et sur **`TextNode`** [D4].

Plus **un champ isolé**, `TextNode.align`, qui n'appartient à aucune des deux [D5].

**Pourquoi ce découpage, et non un `style` unique.** *(Raisonné, avec un précédent écrit.)* Parce
qu'il rend la cascade **inexprimable** au lieu de l'**interdire**. Une propriété de boîte **se
peint elle-même** : aucun descendant ne la lit, donc il n'y a rien à faire descendre. Une
propriété de typographie n'a de sens que **là où il y a des caractères**. Un `style` unique posé
sur un `container` obligerait à répondre à « que fait `family` ici ? », et la seule réponse
possible est « il descend » — c'est-à-dire à écrire dans une **docstring** ce que le moteur
décidera, la faute exacte que C3 a dû défaire dans les siennes (ADR 0005, constat C-01).

Le dépôt a un précédent exact de cette préférence : `Sheet` n'a **pas** de champ `orientation`,
« *a separate flag would be a second source of truth for one fact, hence an invariant to police
for a state that should not be expressible at all* » (`page/types.ts:13-15`). **Une cascade
refusée par une phrase se réintroduit au premier lot pressé ; une cascade sans site d'écriture ne
se réintroduit pas.**

**Pourquoi `align` est à part et non dans `BoxStyle`.** Parce qu'il **échoue la condition 4 sur
quatre des cinq porteurs de boîte**, et le détail est en D5. Le sortir de `BoxStyle` est ce qui
permet à `BoxStyle` de passer la condition 4 **sur ses cinq porteurs sans exception** — et c'est
la raison pour laquelle le contrat reconstruit ne la passait pas.

**Écarté.** (a) **Un `style?: Style` unique sur tous les nœuds** : voir ci-dessus, et il crée
l'état sans sujet que la condition 4 refuse. (b) **`Typography` fusionné dans `BoxStyle`** : un
`family` sur une `image` est vide, un `background` sur un segment n'a pas de boîte. (c) **Un
troisième objet pour l'image** (`ImageStyle` avec un `objectFit`) : un ajustement d'image est une
**politique de recadrage**, condition 3. (d) **`STANDARD_FONT_WEIGHTS` et
`StandardFontWeightName`** : retirés, **aucun consommateur mesuré** — deux symboles publics, donc
deux engagements de compatibilité, pour une correspondance que rien n'applique (`M10`).

**Irréversible** pour les deux formes stockées : dès qu'un document les porte, les retirer est une
migration transformante.
*Signal de réouverture :* un modèle livré dans lequel la même famille de police est répétée sur
**plus de la moitié** des runs. C'est le fait observable qui rendrait la question du défaut de
document légitime, et **il se mesure sur le modèle**, pas sur une intuition.

---

### D3 — `box` sur cinq types de nœud, jamais sur `NodeBase`, jamais sur les trois nœuds de contrôle

**Décision.** `readonly box?: BoxStyle | undefined` sur **`TextNode`, `ImageNode`,
`ContainerNode`, `TableNode` et `TableRowNode`**. **Ni** sur `NodeBase`, **ni** sur `LoopNode`,
`ConditionNode`, `TableRowGroupNode`, **ni** sur `TableColumn`, `TableCell`, `PageBand`,
`PageSetup`, `Sheet`, `PageMargins`, `TextSegment`, `Template`.

**Pourquoi la coupe tombe exactement là, et elle se dit d'une phrase vérifiable.** *(Raisonné,
vérifié par lecture intégrale de `ast/types.ts`, et le refus est tenu par le compilateur —
mesuré : `TS2353: 'box' does not exist in type 'LoopNode'`.)*

> **Un nœud qui porte directement un champ `Expression` n'est pas une boîte.**
> `LoopNode.each`, `ConditionNode.when`, `TableRowGroupNode.each` — et aucun des cinq autres n'a
> de champ `Expression` direct : une liaison de texte vit dans le **segment**, pas dans le nœud.

Ces trois nœuds produisent *N séquences de blocs*, *leurs enfants ou rien*, *N lignes* : un style
y est **sans sujet**, ce qui échoue la condition 4 de D1. Et **le refus ne coûte aucune
capacité** : « un fond par itération » s'écrit `loop > container(box)`, « un fond autour de toutes
les itérations » s'écrit `container(box) > loop`. Les deux intentions sont déjà exprimables,
**distinctement**, avec zéro champ nouveau. Un style sur la boucle serait au contraire la seule
forme dont le contrat ne saurait pas dire laquelle des deux elle signifie.

**Pourquoi `tableRow` reste dans les cinq, et ce que ça coûte.** *(Raisonné, et c'est le porteur le
plus discutable de la liste — il faut le dire.)* Un `tableRow` est une **bande horizontale** :
`background` la peint, `border.top`/`border.bottom` y tracent des filets, `padding` l'insère de son
contenu. Les trois ont un sens. Le bandeau d'en-tête de tableau est le **second dispositif de
différenciation visuelle d'une facture** (mesuré par l'exercice de `P-14` : `background` est l'un
des deux seuls champs qui portent le critère de recette), et sans porteur de ligne il faudrait
**un `ContainerNode` par cellule** pour peindre une bande, soit +5 nœuds pour un en-tête de cinq
colonnes. **Ce qui a été retiré pour que la condition 4 passe, c'est `gap` [D11] et `align` [D5]**,
qui étaient les deux champs ambigus sur ce porteur.

**Pourquoi pas `NodeBase`.** *(Deux motifs, dont un mesuré.)* (1) Il donne le champ aux trois
nœuds de contrôle, donc crée l'état sans sujet. (2) **L'économie annoncée est fausse** :
`ast/schemas.ts` **n'a pas de `nodeBaseSchema`**, les huit `z.object` répètent `id: nodeIdSchema`
littéralement — un champ sur `NodeBase` demande donc **huit** éditions de schéma au lieu de cinq,
et l'oubli d'une seule est **silencieux** (mesuré : la porte de type est aveugle sur ces sites,
`campagne de mesure §6.5`).

**Pourquoi optionnel et non requis, mesuré.** Un `box` **requis** rendrait la migration
**transformante** et l'obligerait à traverser l'AST — le premier code de `migrate.ts` qui
connaîtrait la forme des nœuds — pour un coût mesuré de **+324 valeurs (+59,1 %)** sur le modèle
du playground contre **+8** pour une baseline unique (`m9.mjs`, `relecture adverse « versionnement » §3.3`).
Et **170 sites de littéral de nœud dans 11 fichiers** rougiraient en `TS2741` (`relevé de surface
B.1`).

**Écarté.** (a) **`NodeBase`** : ci-dessus. (b) **Les huit types de nœud** : `loop`, `condition`,
`tableRowGroup` échouent la condition 4. (c) **Quatre types seulement, sans `tableRow`** : le
bandeau d'en-tête coûte alors un conteneur par cellule, mesurable en nœuds, et le critère de
recette perd le meilleur site de son second champ porteur. (d) **`TableCell`** : une cellule n'est
pas un nœud (pas d'`id`), et y poser un `BoxStyle` complet recréerait sur la cellule ce que le
critère de C3 refuse à la colonne. (e) **`PageBand`** : inutile — `PageBand.content` **est** un
`ContainerNode`, donc **dès que `box` est sur `ContainerNode`, une bande l'a gratuitement, sans une
ligne dans `page/`** ; et un champ `separator` sur `PageBand` rouvrirait le refus de C4
(ADR 0006 `:940-946`). (f) **`Template`** : c'est l'arbitrage n° 1, et son type est inféré de son
schéma, donc **aucune paire `*_KEYS_IN_STEP` n'y est possible** [signalement H].

**Irréversible** pour les cinq sites — dès qu'un document les porte. **Réversible dans le sens de
l'élargissement seulement** : ajouter un sixième porteur plus tard est un élargissement (une
estampille) ; en retirer un est une migration transformante.
*Signal de réouverture :* un modèle livré dans lequel une bande porte un fond que
`PageBand.content` ne sait pas exprimer — et à ce jour, **rien ne l'indique** : le conteneur le
porte.

---

### D4 — `typography` vit sur `TextNode` et sur les trois kinds de segment ; la résolution a deux termes, elle est exportée, et elle ne s'appelle pas « Resolved »

**Décision.** `readonly typography?: Typography | undefined` sur **`TextLiteralSegment`,
`TextBindingSegment`, `TextPageFieldSegment`** et sur **`TextNode`**. La résolution est
**`resolveTypography({ run, block }): Typography`** — **deux** termes, fusion **par propriété**,
`run` d'abord. Elle rend un **`Typography`**, dont les cinq champs restent optionnels. **Il n'y a
pas de type `ResolvedTypography`.**

**Pourquoi le nom disparaît, et c'est mesuré.** `ResolvedTypography = { readonly [K in keyof
Typography]-?: Typography[K] }` **ne résout rien** : `-?` rend la **clé** obligatoire, pas la
**valeur** définie, et `Typography[K]` contient déjà `| undefined` puisque
`exactOptionalPropertyTypes` l'impose (`AGENTS.md` §1.4). Mesuré **deux fois indépendamment** —
5 × `TS2322` (`relecture adverse « mesures » §2`, re-mesuré `campagne de mesure §3.4`) :

```
probe/p1-resolved.ts(4,14): error TS2322: Type 'string | undefined' is not assignable to type 'string'.
```

Un consommateur qui appelle une fonction nommée `resolve` et reçoit un type nommé `Resolved` doit
encore inventer cinq valeurs. **Un nom qui promet ce que le type ne livre pas est pire qu'aucun
nom** — c'est le reproche que le même document adresse à `Color = string`, et le remède est
symétrique : dire la vérité dans le nom et dans la docstring [D8, `M5`].

**Pourquoi deux termes et pas un — le chiffre est l'argument.** *(Mesuré, `m10.mjs`,
`relecture adverse « versionnement » §5.2`.)* « Une police, une taille, pour toute la facture » — la
déclaration la plus banale qu'un modèle de facture fait — coûte, sur le modèle du playground :

| forme d'écriture | coût | facteur |
| :--- | ---: | ---: |
| par **segment** (41 sites) | **+123 valeurs (+22,4 %)** | 41× |
| par **nœud texte** (20 sites) | **+60 valeurs (+10,9 %)** | 20× |
| dans un `Template.style` **unique** | **+3 valeurs (+0,5 %)** | 1× |

Un contrat qui refuse **à la fois** le nœud **et** la baseline n'offre aucun moyen de dire « cette
facture est en Helvetica 10 » autrement qu'en l'écrivant **41 fois**. Le second terme divise le
coût par deux **sans mandat produit** ; le troisième le diviserait par 41 **avec** un mandat
[n° 1].

**Pourquoi la résolution est exportée, et sur quel motif — pas celui de `printableAreaOf`.**
*(Mesuré, et c'est une correction d'un motif faux.)* `a ?? b` n'a **aucune** représentation
flottante : deux implémentations de `run?.family ?? block?.family` ne peuvent pas diverger. Le
motif de `printableAreaOf` est **arithmétique** — `215.9 - (25.4 + 25.4)` rend
`165.10000000000002` et `(215.9 - 25.4) - 25.4` rend `165.1`, reproduit au chiffre près
(`campagne de mesure §7.2`) — et il **ne s'applique pas**. Le motif valable est autre, et c'est celui de
`Template.page` requis (`template/template.ts:141-143`) : **une convention écrite une fois dans
`core` bat une convention réinventée par chaque rendu**, « *with nothing checking that the viewer
invents the same one* ». Le plan écrit **ce** motif — sinon il invoque un précédent qui ne
s'applique pas, ce que l'ADR 0004 `:680-687` a reproché à `declaredScaleOf` avant de la refuser.

**Pourquoi `pageField` aussi.** Le numéro de page a une police. Poser un `typography` sur un
marqueur est cohérent ; y poser une **expression** rouvrirait la boucle de rétroaction que
`pageField` existe pour fermer — et D12 refuse l'expression de style partout.

**Ce que la fonction ne fait pas.** Elle ne fournit **aucun défaut** : les cinq valeurs manquantes
sont des **attentes envers le moteur**, écrites dans l'ADR et **jamais** dans une docstring [D16].
Et elle n'a **pas** de troisième terme aujourd'hui : l'ajouter serait un élargissement de
signature, réversible ; le retirer ne le serait pas.

**Écarté.** (a) **Segments seuls** (le contrat reconstruit) : coûte **41×** la déclaration la plus
fréquente, mesuré. (b) **`TextNode` seul** : « Total : **1 200 €** » — une graisse à l'intérieur
d'une phrase — devient inexprimable, et c'est nommément ce que l'ADR 0002 `:89-91` a laissé
ouvert : « *La porte reste ouverte à des marques (gras, italique) sur un segment littéral : un
champ optionnel de plus, au prix d'un incrément de `schemaVersion`* ». (c) **Trois termes avec
`Template.style` requis** : arbitrage n° 1 — second rétrécissement non vacuous du dépôt, **28
tests en échec dans 6 fichiers** (mesuré, `campagne de mesure §6.4`), et une police de compatibilité est
**pire qu'A4** (`V-3.2`). (d) **`Typography` sur `ContainerNode`** : une cascade par un autre nom,
et il n'y a **aucun caractère** sur un conteneur — condition 4. (e) **`Typography` sur
`TableColumn`** : la police des cellules descendrait ; une colonne n'est pas un nœud, et le
critère de C3 refuse la police sur une colonne dans une docstring publiée. (f) **Un type
`ResolvedTypography` à cinq champs non-`undefined` sans troisième terme** : impossible sans
inventer cinq valeurs dans `core`, c'est-à-dire sans écrire une règle de rendu.

**Irréversible** pour les quatre sites d'accrochage. **Réversible** pour la fonction — c'est du
code sans forme stockée.
*Signal de réouverture :* voir n° 1. Le fait observable est un modèle livré dont plus de la
moitié des nœuds texte répètent la même famille.

---

### D5 — `align` est DEUX faits et non un : `TEXT_ALIGNMENTS` sur `TextNode`, `TableColumnAlignment` inchangé sur la colonne, et la colonne fournit un DÉFAUT

**Décision.** Un tuple **neuf**, `TEXT_ALIGNMENTS = ['start', 'center', 'end', 'justify']`, et son
type `TextAlignment`. `readonly align?: TextAlignment | undefined` sur **`TextNode` et rien
d'autre**. `TABLE_COLUMN_ALIGNMENTS` **n'est ni élargi ni touché** : trois membres, `justify`
exclu. La fonction exportée est **`resolveTextAlign({ text, column }) => text ?? column`**, et ce
qu'elle résout est un **défaut**, pas une rivalité. Enfin, `ast/types.ts` reçoit **deux** corrections
de docstring : `TableColumn.align` dit désormais **sur quoi il agit**, et le paragraphe qui promettait
`justify` à C5 dit que C5 **l'a livré ailleurs** [D17].

> ⚠️ **Ce que la révision 1 avait confondu, et pourquoi ça ne se rattrape pas par une précédence.**
> Elle réutilisait `TableColumnAlignment` sur `TextNode` au motif qu'un second tuple aux membres
> identiques serait « *a second spelling of one fact* ». **Les membres étaient identiques ; le fait
> ne l'était pas.** Un tuple est un **domaine de valeurs**, pas un fait — et deux faits distincts
> partagent parfaitement un domaine. Le précédent invoqué (`page/types.ts:22-30`) porte sur deux
> **orthographes** d'une **même** marge ; ici, ce sont deux **propriétés** différentes qui se
> trouvent avoir les mêmes noms de valeur.

**La démonstration, et elle tient en une cellule.** `TableCell.children` est
`readonly BlockNode[]` : une cellule contient « *a paragraph, two paragraphs, an image, a condition,
a nested loop* » — la docstring publiée l'énumère. Prenez une colonne `align: 'end'` dont une cellule
contient **une image**, ou **un conteneur**, ou **deux paragraphes** :

| Ce que la cellule contient | Ce que `TableColumn.align` devrait signifier | Ce que `TextNode.align` peut signifier |
| :--- | :--- | :--- |
| un `text` | *(les deux coïncident, et c'est ce qui a masqué l'erreur)* | la distribution de ses runs dans sa boîte |
| une `image` | pousser l'image vers la droite de la cellule | **rien — il n'y a aucun run** |
| un `container` | placer le bloc dans la cellule | **rien — un conteneur n'a pas de run** |
| deux `text` | le même défaut pour les deux | **un alignement chacun**, et ils peuvent différer |

**Donc `resolveTextAlign(text ?? column)` de la révision 1 était conceptuellement faux** : il présentait
comme une précédence entre deux déclarations d'un même fait ce qui est la rencontre de deux faits
distincts. Le cas dégénéré — une cellule qui contient exactement un paragraphe — les fait coïncider,
et c'est très exactement le cas que la rédaction avait en tête. Les trois autres lignes du tableau
suffisent à le réfuter.

**Comment le contrat s'en sort sans écrire de modèle de mise en page.** Il **rétrécit le sens** de
`TableColumn.align` à ce que le lot peut honnêtement soutenir, et il l'écrit :

> `TableColumn.align` est **le défaut de `TextNode.align` pour les blocs de texte des cellules de
> cette colonne**. Il ne déplace ni une image, ni un conteneur, ni une boîte : le lot ne déclare
> aucune largeur de bloc, donc tout bloc occupe la largeur de contenu de sa cellule [D11], et il n'y
> a **rien à déplacer**.

C'est une **correction de docstring**, pas un rétrécissement de schéma : la forme stockée de
`TableColumn` ne bouge pas d'un caractère, aucune migration n'est due, et aucun document existant ne
devient invalide. C'est le même geste que les quatre corrections que D17 porte déjà — et il est
**dû**, parce que la phrase publiée « *How the cells of one column sit inside their column box* »
promet un placement de **cellule** que ni C3 ni C5 ne peuvent tenir sans un modèle de mise en page de
table.

**Ce que devient la fonction exportée, et pourquoi elle reste utile.** `resolveTextAlign` ne dit plus
« qui gagne », elle dit **d'où vient le défaut** — et c'est une règle qu'un moteur et un viewer
réimplémenteraient chacun de leur côté, avec le droit de diverger. Sa signature encode l'asymétrie
au lieu de la commenter :

```ts
export interface TextAlignSources {
  readonly text?: TextAlignment | undefined;
  readonly column?: TableColumnAlignment | undefined;
}
export function resolveTextAlign(sources: TextAlignSources): TextAlignment | undefined;
```

**`TableColumnAlignment` est un sous-type strict de `TextAlignment`**, et c'est exactement le fait à
exprimer : une **colonne** ne peut pas déclarer `justify`, un **bloc de texte** le peut. Le corps
reste `text ?? column` et **compile sans élargissement ni assertion** — un
`'start' | 'center' | 'end'` est assignable à `'start' | 'center' | 'end' | 'justify'`. Le prix de la
révision 1 — « un nom légèrement décalé », `TableColumnAlignment` sur un `TextNode` — **disparaît** :
chaque type porte le nom de son fait.

**Pourquoi `TextNode` reste le seul porteur.** *(Raisonné, sur la condition 4 de D1.)* Inchangé, et
le tableau vaut toujours :

| porteur candidat | ce que `align` y signifierait | verdict |
| :--- | :--- | :--- |
| `TextNode` | la disposition de ses runs dans sa boîte | **le seul site qui a un sujet** |
| `ImageNode` | `object-position` — une **politique de recadrage** | condition 3 |
| `ContainerNode` | l'alignement transversal de ses enfants blocs — un **modèle de mise en page** | condition 3 |
| `TableNode` | la position du tableau dans son parent — un tableau occupe la largeur de contenu de son parent [D11, n° 4], donc **il n'y a rien à aligner** | condition 4 |
| `TableRowNode` | le défaut des cellules — **exactement `TableColumn.align`** | condition 4, et double déclarant |

**Pourquoi `justify` ENTRE, et pourquoi le refus de la révision 1 ne tenait pas.** *(Le motif long
est en [D1], « la condition 3 a deux moitiés ».)* Le dépôt refusait `justify` parce que justifier
exige de mesurer les mots, donc une métrique de police, donc « une lecture de la machine ». **Ce
motif prouve trop** : `center` et `end` sont publiés dans `main` et exigent la même métrique. Ce que
le lot E6 interdit, c'est de lire l'**environnement**, pas de mesurer une fonte **chargée
explicitement** — et le déterminisme promis « au caractère près : polices, images » **suppose** cette
mesure. Il reste la vraie moitié de la condition 3, la politique, et **elle s'écrit en deux phrases
que le contrat prend, comme il prend sRGB** [D8] :

> 1. **La dernière ligne d'un paragraphe justifié n'est pas justifiée** : elle s'aligne sur `start`.
> 2. **Le résidu se répartit uniformément entre les blancs INTER-MOT**, jamais entre les lettres.

Ces deux phrases sont la convention universelle de la composition, pas un arbitrage entre deux rendus
également légitimes. Elles vivent dans **l'ADR 0007** et dans **aucune docstring** [D16], où elles
sont la **septième** des huit attentes envers le moteur.

**Et le coût d'incompatibilité est NUL, ce qui rend la branche gratuite.** Élargir
`TABLE_COLUMN_ALIGNMENTS` aurait été la **troisième forme d'incompatibilité** — `invalid_value`,
`Invalid option: expected one of "start"|"center"|"end"`, chemin
`["root","children",0,"columns",0,"align"]`, mesuré (`m2.mjs`) —, une forme qu'`AGENTS.md` §1.2 **ne
nomme pas** [signalement A]. **Un tuple neuf sur un champ neuf ne produit rien de tel** :
`TextNode.align` n'existe pas avant ce lot, donc un build antérieur qui rencontre un document v6
tombe sur l'**estampille** et rend le message typé de `TemplateMigrationError` [D14]. La branche
retenue est donc la seule des trois qui **n'ouvre pas** une forme d'incompatibilité non nommée — et
c'est un argument mécanique, pas une préférence.

**Écarté.** (a) **Réutiliser `TableColumnAlignment` sur `TextNode`** — la révision 1 : deux faits sous
un nom, et une précédence entre des choses qui ne se comparent pas. (b) **`justify` ajouté à
`TABLE_COLUMN_ALIGNMENTS`** : la troisième forme d'incompatibilité, et un `justify` de **colonne**
n'aurait de sens que pour les cellules qui contiennent du texte — c'est-à-dire qu'il rouvrirait la
confusion qu'on vient de fermer. Il est **refusé, et le refus est désormais épinglé par un test**
(`N27`, dérivé). (c) **Un champ d'alignement sur `TableCell`** : c'est la forme que
`ast/types.ts:250` et `nodes.test.ts:113` annoncent, et elle est écartée pour une raison de forme —
une cellule n'est pas un nœud, elle n'a pas d'`id`, une Command d'éditeur ne l'adresse pas ; les deux
docstrings sont **redirigées** [D17]. (d) **`align` dans `BoxStyle` sur cinq porteurs** : quatre des
cinq échouent la condition 4. (e) **Un alignement vertical en cellule** : arbitrage n° 9 — aucune
hauteur déclarée, aucun porteur.

**Irréversible** pour les deux champs et pour le tuple. **Réversible** pour la fonction.
*Signal de réouverture :* un intégrateur dont le modèle exige un alignement de **cellule** au sens
plein — une image poussée à droite dans sa cellule. La réponse d'aujourd'hui est « un conteneur, et
son `padding` », et le jour où elle ne suffit plus, c'est un **modèle de mise en page de table**
qu'il faut, donc C11, et non un champ de plus ici.

---

### D6 — Deux unités, la conversion exportée une seule fois, et aucune contrainte de décimales

**Décision.** Une taille de police est en **points** et son champ porte l'unité : **`sizePt`**.
Toute autre longueur du contrat est en **millimètres fractionnaires**, et son champ **ne porte pas
l'unité** — parce que le millimètre est l'unité par défaut du contrat depuis C4, et que la seule
exception est celle qui la nomme. La conversion est écrite **une fois** et **exportée** :
**`mmFromPt(pt) => (pt * 25.4) / 72`** et **`ptFromMm(mm) => (mm * 72) / 25.4`**. **Aucune
contrainte de décimales, nulle part.**

**Pourquoi deux unités, et pourquoi ce n'est pas l'écart (e) de l'ADR 0006 retourné contre nous.**
*(Raisonné, avec une mesure.)* L'ADR 0006 `:236-256` a écarté les points typographiques sur un
motif de **lisibilité** : « *illisibles pour l'auteur (« marge de 57 points »)* ». Ce motif
**s'inverse** pour une taille de police : « police de 3,53 mm » est illisible pour exactement la
même raison, et **10 pt n'est pas représentable exactement en millimètres** — mesuré :
`10 * 25.4 / 72 = 3.5277777777777777`. Le point est de surcroît l'unité de l'espace utilisateur du
PDF, donc une taille traverse le moteur **sans conversion**. L'écart (e) ne transpose pas d'une
marge à une taille [`F-2`].

**Pourquoi la conversion est exportée — et c'est ici que le motif de `printableAreaOf` s'applique
vraiment.** *(MESURÉ, et c'est le constat bloquant `P-03`.)* Deux unités dans un contrat obligent
quelqu'un à convertir, et **la conversion n'est pas associative** :

```
$ node atk1.mjs
tailles entieres 1..14400 : 8774 / 14400 donnent DEUX doubles differents selon la forme (60.9 %)
   15 pt -> v*(25.4/72) = 5.291666666666666 | v*25.4/72 = 5.291666666666667
demi-points 1..30 pt : 35 divergents   (dont 3.5, 5.5, 6.5, 7.5, 8.5)
14400 pt en mm = 5079.999999999999   | MAX_SHEET_MM = 5080 | egal ? false
```

**60,9 % des tailles entières rendent deux doubles différents selon l'ordre des opérations**, et la
dernière ligne est la plus instructive : la conversion naïve de la borne **ne rend pas la borne**.
C'est **exactement** le motif écrit de `printableAreaOf` (`page/area.ts:3-32`) : « *deux
consommateurs qui écrivent la soustraction chacun de leur côté n'écrivent pas la même formule* »,
et décision 7 promet l'identité. **La différence avec `resolveTypography` est nette et il faut la
dire** : `a ?? b` n'a pas de hasard numérique [D4], `(pt * 25.4) / 72` en a un, mesuré.

**Les consommateurs existent aujourd'hui, et c'est le critère d'export du dépôt.** L'ADR 0004
`:680-687` a **refusé** `declaredScaleOf` au motif qu'elle n'avait « *aucun consommateur
aujourd'hui* ». Ici : le **playground**, qui dessine déjà la feuille à l'échelle
(`ECHELLE = 320 / sheet.width`) et devra dessiner du texte dans la même échelle ; **E1**, qui rend
en points ; **V1**, qui rend en pixels CSS. Trois consommateurs nommés, dont un dans le dépôt.

**Pourquoi aucune contrainte de décimales, et le piège nomme le mauvais champ.** *(MESURÉ deux
fois, `m4.mjs` et `campagne de mesure §7.1`.)* L'ADR 0006 `:204-210` avertit C5 : « *À ne pas recopier : la
même formule paraîtra tentante en C5 pour une **taille de police**.* » **L'avertissement est juste
dans son principe et faux dans son exemple :**

```
taille pt                     n=16   REFUSES par Number.isInteger(v*100) : aucun
demi-points de 6 a 72 pt             REFUSES : (AUCUN)
epaisseur de filet mm         n=16   REFUSES : 0.55 -> 55.00000000000001
interligne (sans unite)       n=11   REFUSES : 1.15 -> 114.99999999999999
  0.8 pt = 0.28 mm -> isInteger(mm*100) = false   <== REFUSE
```

**Une taille en points ne déclenche jamais le piège** ; il mord une **épaisseur de filet de
0,28 mm — c'est-à-dire 0,8 pt, une épaisseur standard en édition** — et un interligne de 1,15. Un
plan qui recopie l'avertissement sans le remesurer **transmet une justification fausse** dans une
docstring qui vivra dix ans. Et le motif qui suffit seul est celui que C4 a **appliqué** plutôt
qu'écrit : `page/schemas.ts:12-20` ne porte **aucune** contrainte de décimales, seulement
`min`/`max` — « la finitude et les deux bornes suffisent », `z.number()` refusant déjà `NaN` et
`Infinity`.

**Écarté.** (a) **Tout en millimètres** : rend « 10 pt » inexpressible exactement et fait de chaque
taille nominale un flottant approché — c'est l'argument de `MIN_COLUMN_WIDTH`
(`ast/types.ts:166-188`, « *the same number in the on-screen preview and in the PDF* ») retourné
contre nous. (b) **Tout en points** : rétablit « marge de 57 points ». (c) **Un `{ value, unit }`**
: une unité déclarée par le document, refusée par l'ADR 0006 D13. (d) **Une échelle relative
(`em`, `%`)** : relative à un ancêtre, donc une cascade [D12]. (e) **Des dixièmes de millimètre
entiers** : l'ADR 0006 la nomme « la seule option écartée qui n'ait aucun défaut technique »,
écartée sur la **lisibilité** ; elle rend `10 pt` toujours inexact et n'aide pas. (f) **Deux unités
sans conversion exportée** (le contrat reconstruit) : 60,9 % de divergence mesurée, et c'est la
décision produit 7 qui tombe. (g) **L'unité dans le nom de tous les champs**
(`BoxSpacing.topMm`) : divergerait de `PageMargins { top, right, bottom, left }`, que
`page/types.ts:22-30` impose comme forme de tout quadruplet d'arêtes.

**Irréversible** — changer d'unité plus tard est **transformant** : chaque valeur stockée se
recalcule. ⛔ n° 2 pour la forme de la graisse, qui vit dans la même forme stockée.
*Signal de réouverture :* « une divergence mesurée entre l'aperçu et le PDF imputée à l'arrondi
d'une longueur fractionnaire » — le signal que l'ADR 0006 `:255` a lui-même écrit pour l'option EMU.

---

### D7 — Une borne s'importe, elle ne se recopie pas ; et `MAX_FONT_SIZE_PT` est dérivé

**Décision.** `packages/core/src/style/` **importe `MAX_SHEET_MM`** de `page/page.js` et n'en
déclare aucun homonyme. `MAX_FONT_SIZE_PT` est **dérivé** : `ptFromMm(MAX_SHEET_MM)`. Les seules
bornes propres au lot sont **`MIN_FONT_SIZE_PT = 1`** et le plancher `0` des longueurs, qui n'a pas
besoin d'un nom.

**Pourquoi.** *(MESURÉ, et le dépôt a déjà tranché ce cas dans une docstring de production.)*
`MAX_STYLE_LENGTH_MM = 5080` du contrat reconstruit **est** `MAX_SHEET_MM = 5080`
(`page/types.ts:150`) sous un second nom, sans lien. Et la seconde borne est la première dans
l'autre unité, **exactement**, dans les deux sens, en binary64 :

```
$ node -e "console.log(5080*72/25.4, Number.isInteger(5080*72/25.4), 14400*25.4/72 === 5080)"
14400 true true
```

`template/guard.ts:65-69` a écrit la règle : « *The same schema and the same ceiling as
`EvaluationLimits`, **imported rather than restated**: two copies of one bound drift, and raising
it in one file would leave the other refusing values the first accepts.* » **Trois copies d'une
même longueur maximale, c'est la dérive garantie au premier ajustement.**

**Ce que l'import coûte, dit franchement.** `style/` dépend de `page/`, donc le sous-graphe
d'apparence n'est plus une racine indépendante dans `core`. Le précédent existe et il est du même
sens : `template/guard.ts` importe déjà `page/`. Aucune règle `noRestrictedImports` ne s'y oppose
(l'interdit porte sur les paquets **frères**, pas sur les dossiers de `core`). **Non mesuré :** la
porte 1 n'a été jouée nulle part [`§10` du fichier 1].

**Et un test épingle l'égalité**, parce qu'une dérivation muette se « corrige » : `expect(
MAX_FONT_SIZE_PT ).toBe(14_400)` **et** `expect(mmFromPt(MAX_FONT_SIZE_PT)).toBe(MAX_SHEET_MM)`.
Épingler un chiffre exact ici est un service rendu, pas une redondance — c'est ce qui empêche
quelqu'un d'« arrondir » la conversion.

**Écarté.** (a) **Recopier `5080`** : la dérive, écrite ci-dessus. (b) **Écrire `14_400` à la
main** : le nombre est juste, le **lien** est perdu ; relever `MAX_SHEET_MM` laisserait
`MAX_FONT_SIZE_PT` en arrière. (c) **Écrire pourquoi une longueur d'apparence est une borne
*différente* qui coïncide** : c'était l'autre issue honnête, et elle est **plus chère** — il
faudrait justifier par écrit une coïncidence exacte à 14 chiffres significatifs. (d) **Ne pas
borner du tout** : `MAX_SHEET_MM` est documenté comme « *an OPENVIEW INTEROPERABILITY BOUND* », et
une taille sans plafond rouvre la classe de déni de service que `MAX_BANDS_PER_SIDE` a mesurée.

**Réversible** — c'est du code sans forme stockée. Un plafond **relevé** est un élargissement ; un
plafond **abaissé** après qu'un document l'a franchi ne l'est pas.
*Signal de réouverture :* aucun.

---

### D8 — Une couleur est six chiffres hexadécimaux derrière un dièse, dans les deux casses, interprétés en sRGB, et sans canal alpha

**Décision.** `ColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'A colour is six hexadecimal
digits behind a hash, as #1b3a6f')`. Le type `Color = string` est un alias **documentaire**, et sa
docstring le dit. **Les six chiffres sont interprétés en sRGB** : le contrat prend la convention
plutôt que de la laisser à chaque moteur. **Aucun canal alpha.**

**Pourquoi la chaîne hexadécimale.** Une valeur, une position, aucune table de correspondance
publiée. Un `{ r, g, b }` coûterait **trois** valeurs par couleur au lieu d'une, et trois bornes à
écrire, pour une expressivité identique. Une table de **noms CSS** ferait dépendre le contrat d'une
convention de rendu qu'il ne publie pas.

**Pourquoi les deux casses — et c'est une décision, pas un oubli.** *(MESURÉ.)* Avec
`[0-9a-f]{6}`, `'#FFAA00'` est **refusé**, et c'est ce que tout outil de design émet ; refuser le
copier-coller le plus banal du métier est hostile. Le contrat garde donc les deux casses — **et il
cite le précédent qu'il contredit**, comme le constat `P-07` l'exige. Le motif qui les distingue
est mesurable : `margins: 20` contre quatre arêtes sont **deux formes qu'un consommateur doit
normaliser**, tandis que `#FFAA00` et `#ffaa00` sont **une** forme lue par le même test, **sans
expansion**. La forme courte `#fa0`, elle, coûterait une expansion : refusée.

**Ce que la double casse coûte, et le contrat le dit.** Une **comparaison d'égalité** entre
`#FFAA00` et `#ffaa00` échoue. Un consommateur qui compare des couleurs — un éditeur qui surligne
« les blocs de la même couleur », un contrôle de parité V3 — **replie la casse**. C'est écrit dans
la docstring, parce qu'un refus non écrit se rouvre au premier client. **64 orthographes** sont
stockables pour une couleur à six chiffres alphabétiques (2⁶, mesuré) : le chiffre est dans le plan.

**Pourquoi l'espace colorimétrique est DÉCLARÉ.** *(MESURÉ :
`git grep -niE "srgb|color space|espace colorim|profil colorim|cmyk"` sur `packages apps docs
AGENTS.md README.md` rend **zéro occurrence**.)* `#1b3a6f` est un triplet d'octets ; il n'a de
**couleur** que rapporté à un espace. Un moteur PDF peut écrire `DeviceRGB` (dont l'interprétation
est laissée au lecteur), un profil ICC sRGB, ou convertir en CMYK ; un viewer navigateur rend en
sRGB. **Trois couleurs pour un même triplet**, là où décision 7 promet l'identité et
`docs/qa/README.md:15` la durcit en « au pixel près ». C'est le pendant exact de `P-03` : une
**unité** manquante. C4 n'a jamais eu ce problème parce qu'il a écrit « millimètres » partout.

**Pourquoi aucun canal alpha, avec son propriétaire.** La **composition** est un modèle de rendu,
donc les **calques de C11 / D10**. Le contrat le refuse déjà implicitement — mesuré,
`color: '#1b3a6fff'` rend `invalid_format` (R03) — mais **aucun texte du bac à sable ne disait
pourquoi**, et un refus non écrit se rouvre.

**Ce que la forme refuse, avec son propriétaire.** *(Tous MESURÉS, R01…R06 et R26, `campagne de mesure §4`,
tous avec le même message constant.)*

| Refusé | Entrée | `code` mesuré | Propriétaire du besoin |
| :--- | :--- | :--- | :--- |
| noms CSS | `'red'` | `invalid_format` | personne — une convention de rendu |
| forme courte | `'#fa0'` | `invalid_format` | personne — seconde orthographe |
| canal alpha | `'#1b3a6fff'` | `invalid_format` | la composition, donc **C11 / D10** |
| notations fonctionnelles | `'rgb(1,2,3)'` | `invalid_format` | personne — c'est un **parseur**, refusé par l'ADR 0006 `:955` |
| couleurs système | `'Canvas'` | `invalid_format` | **personne, jamais** — lecture de la machine |
| un nombre | `0x1b3a6f` | `invalid_type` | — |
| CMYK, tons directs, profils | — | — | une chaîne d'impression : **E1 / E8**, ou hors v1 |

**Pourquoi `Color = string` reste, et pourquoi la docstring doit le dire.** *(MESURÉ : exit 0.)*
L'alias **n'interdit rien** — `const notAColour: Color = 'Total TTC'` compile, `paint('EB
Garamond')` compile (`relecture adverse « mesures » §3`, re-mesuré `campagne de mesure §3.4`). La garantie est
**entièrement** à l'exécution, dans `ColorSchema`. Écrit ainsi, l'alias est honnête ; non écrit, il
fait croire à une garde inexistante — le reproche exact adressé à `ResolvedTypography` [D4].

**Écarté.** (a) **Un type marqué (*branded*)** : le construire demande une assertion, qu'`AGENTS.md`
§1.1 interdit. (b) **`{ r, g, b }`** : trois valeurs, trois bornes, expressivité identique.
(c) **Une table de noms** : une convention de rendu dans un contrat qui n'en publie aucune, et
`ADR 0006:189-196` a déjà mesuré ce que coûte une énumération fermée stockée. (d) **Une casse
unique** : refuse `#FFAA00`, mesuré. (e) **Ne pas déclarer l'espace** : trois couleurs pour un
triplet, contre une promesse d'identité.

**Réversible dans un seul sens** : élargir la regex (accepter `#rrggbbaa`) est un élargissement ; la
rétrécir après qu'un document a été enregistré ne l'est pas.
*Signal de réouverture :* un intégrateur dont l'imprimeur exige un **ton direct** — et la réponse
d'aujourd'hui est « pas exprimable », dont le coût est réel.

---

### D9 — Un nom de police est une déclaration : le contrat n'en police pas la résolution, et il inscrit le danger

**Décision.** `family: z.string().min(1, 'A font family name is required')`. **Aucun refus par le
schéma.** La docstring de `family` **inscrit le danger** : un nom peut être une **indirection vers
la machine**. Et l'ADR 0007 porte une **attente nommée envers E6 et E8** [D16].

**Pourquoi aucun refus par le schéma.** *(MESURÉ.)* `family: z.string().min(1)` accepte **dix
valeurs qui ne désignent aucune police** mais **la police que la machine choisit** :
`system-ui`, `sans-serif`, `serif`, `monospace`, `-apple-system`, `BlinkMacSystemFont`,
`ui-rounded`, `emoji`, `math`, `fangsong` (`atk2.mjs §1`). Et pourtant le schéma ne peut pas les
refuser : **refuser la chaîne `serif` refuserait une police réellement nommée *Serif***, et refuser
une liste de valeurs serait une **table noire de conventions CSS** dans un contrat qui n'en connaît
aucune.

**Pourquoi c'est le trou du lot et pas un détail.** `family` est la **seule exception nommée** du
critère [D1], et l'exception est censée être bornée par sa formulation — « C5 stocke un nom, jamais
une pile, jamais une URL, jamais une métrique ». Mais **un nom peut être une indirection**, et la
formulation ne le borne pas. Le résultat est que la seule brèche du critère est la porte par
laquelle rentre exactement ce que le lot **E6** interdit : « *Deux exécutions du même modèle sur
deux machines doivent donner le même document, au caractère près : **polices**, images…* »
(`engine.md:100-110`). Et **MESURÉ, le risque n'est nommé nulle part** :
`git grep -niE "system-ui|sans-serif|monospace|generic famil"` sur `packages apps docs AGENTS.md
README.md ARCHITECTURE.md` rend **une seule ligne**, et c'est le CSS de la vitrine
(`App.tsx:1316`).

**La forme du remède est celle que le dépôt a déjà employée** pour la direction d'écriture
(`ast/types.ts:154-157`) : une phrase dans la docstring — c'est-à-dire **au seul endroit qu'un
intégrateur lit** — plus une attente nommée envers un lot moteur dans l'ADR. Le plan écrit la
docstring en anglais, avec les conventions du dépôt (`--` pour le tiret, MAJUSCULES pour
l'emphase) :

> *A family name is a DECLARATION, and this contract stores nothing else. It does not police what
> the name resolves to: `system-ui`, the five CSS generic families and `-apple-system` all name
> whatever the HOST MACHINE has installed, so a template that stores one of them renders
> differently on two machines -- which is what lot E6 forbids and what lot E8 must bound. This
> contract records the hazard rather than hiding it: policing the string here would refuse a font
> genuinely called "Serif".*

**Ce que le contrat ne peut PAS faire, et pourquoi ça ne l'excuse pas.** La lecture de la machine
par le **code** de C5 est barrée mécaniquement : `packages/core/tsconfig.json` (`lib: ["ES2022"]`,
`types: []`, « *Isomorphic pure-TS package: no DOM, no Node globals* ») rend `measureText`,
`document.fonts` et `getComputedStyle` **inatteignables par le compilateur**. Ce qui reste, et que
**rien** n'outille, c'est la lecture par la **donnée** — une chaîne de caractères stockée dans un
document. Le plugin `no-environment-read` ne la voit pas ; il ne voit ni `Date` ni `Intl`.

**Écarté.** (a) **Une énumération fermée de polices** : `ADR 0006:189-196` a mesuré ce qu'elle
coûte — « une estampille par police jamais demandée » — et elle rendrait toute police non listée
**inexprimable**. La liste de `<Select />` du designer (`DESIGN.md:215`) est une **table de
commodité** d'IHM, sur le patron `as const satisfies` de `STANDARD_SHEETS_MM`, **jamais une forme
stockée**. (b) **Une liste noire des dix valeurs** : refuse une police réellement nommée *Serif*,
et fige une convention CSS dans un contrat qui n'en publie aucune. (c) **Une pile de repli
(`fallback`)** : condition 3 — le repli est une **politique**, et `engine.md` la range en E6.
(d) **Un `FontPort`** : `AGENTS.md:313-318` le refuse nommément — « *Un port pour le logging, **les
polices** ou l'i18n ne se justifie pas* ». (e) **Une incorporation de police (URL, fichier)** :
E8, liste blanche des requêtes sortantes.

**Irréversible** — c'est une forme stockée. Le **danger**, lui, est réversible : c'est de la prose.
*Signal de réouverture :* un rapport de non-reproductibilité entre deux machines imputé à une
police, ce qui est nommément le critère de sortie de **E6**.

---

### D10 — La forme canonique d'un style absent est **l'absence** : l'objet de style vide est refusé, le filet d'épaisseur nulle aussi, et le plancher de zéro ne subsiste que là où l'absence n'est pas représentable

**Décision.** Trois règles, et elles disent toutes la même chose sous trois formes.

1. **`BorderEdge.width` est `z.number().gt(0, 'A rule has a positive width; omit the edge to declare
   no rule')`**, avec son plafond [D7]. Une épaisseur nulle **n'est pas** une orthographe de « pas de
   filet » : l'absence de l'arête en est une, et c'est la seule.
2. **`box: {}`, `typography: {}` et `border: {}` sont REFUSÉS**, par un
   `.refine(o => Object.values(o).some(v => v !== undefined), 'An empty style object is not a style;
   omit the field')` sur chacun des trois schémas. La forme canonique d'« aucun style » est **le
   champ absent**.
3. **Le plancher de zéro subsiste sur `BoxSpacing`**, dont les quatre arêtes sont **requises** — et
   c'est là, et là seulement, que zéro est la seule façon d'écrire « pas d'espacement ».

> ⚠️ **La révision 1 décidait exactement l'inverse sur les points 1 et 2**, et le motif de la
> correction n'est pas un changement de goût : c'est que le précédent invoqué **ne transpose pas**.
> Le désaccord « `gt(0)` → `min(0)` » que le [§C.4] comptait parmi ses cinq **disparaît** ; le
> contrat revient à `gt(0)`, avec un **autre motif** et un **autre message**.

**Pourquoi le précédent de `PageMargins` ne transpose pas — et c'est mécanique, pas rhétorique.**
`page/types.ts:27-29` écrit que refuser zéro « *would be a rule of typography* ». C'est vrai **là-bas**,
et la raison est dans la ligne du dessus : « *The four edges, in millimetres, **all four required***. »
Une marge ne peut pas être absente, donc `top: 0` est **la seule** manière d'écrire « pas de marge en
haut », et la refuser interdirait un document légitime. **`BoxBorder` a la forme opposée : ses quatre
arêtes sont OPTIONNELLES** [§3.1], donc l'absence est représentable, et `width: 0` devient une
**seconde orthographe** du même fait. Le précédent ne dit pas « zéro est toujours légal » ; il dit
« ne refusez pas la seule orthographe disponible ». Ici, elle n'est pas seule.

| Longueur | l'absence est-elle représentable ? | orthographes de « rien » | prédicat |
| :--- | :--- | :--- | :--- |
| `PageMargins.top` (dépôt) | **non** — arête requise | une : `0` | `min(0)` ✔ |
| `BoxSpacing.top` (ce lot) | **non** — arête requise, sur la forme de `PageMargins` | une : `0` | `min(0)` ✔ |
| `BoxBorder.top` (ce lot) | **oui** — arête optionnelle | deux : absente, ou `{ width: 0, color }` | **`gt(0)`** |

**Et le second grief contre `gt(0)` ne discrimine rien — c'est l'erreur d'analyse de la révision 1.**
Elle opposait à `gt(0)` que « *il admet 0,0001 mm, et pire : mesuré, `5e-324` passe* », en citant la
docstring de `MIN_SHEET_MM` (« *`> 0` would admit 0.0001 mm* »). **Mais `min(0)` admet `0.0001`
exactement comme `gt(0)`.** Cet argument oppose `> 0` à `>= 1` ; il ne dit **rien** de `> 0` contre
`>= 0`. Il a été employé pour trancher une question à laquelle il ne répond pas. Le sous-pixel reste
donc représentable, sur cette longueur comme sur les six autres du contrat, et c'est assumé : le
contrat borne les **fenêtres**, il ne juge pas de l'utilité d'une valeur à l'intérieur. Un plancher
nommé `MIN_RULE_WIDTH_MM` reste refusé pour les deux raisons déjà écrites — 96 dpi est une propriété
de la **machine**, et ADR 0006 `:310` refuse les bornes qu'aucune mesure ne justifie.

**Ce que le message doit dire, et pourquoi l'ancien était le vrai problème.** Le contrat reconstruit
rendait `'A rule width is greater than zero'`, et la révision 1 avait raison sur **ce point-là** :
cette phrase **est** une prescription typographique, mot pour mot. Le remède n'était pas de changer
le prédicat, c'était de changer la phrase. `'A rule has a positive width; omit the edge to declare no
rule'` **énonce la doctrine et donne le remède** — c'est ce qu'`AGENTS.md` §1.3 attend d'une erreur,
et c'est ce que C8 aura à narrer.

**Pourquoi l'objet de style vide est refusé — et pourquoi la révision 1 avait sous-estimé le coût.**
Elle acceptait `{}` au motif qu'« *un consommateur lit `box?.background` et obtient `undefined` dans
les deux cas : une seule lecture, zéro normalisation* ». **C'est vrai d'une LECTURE DE VALEUR, et
faux de tout le reste.** Les consommateurs qui distinguent `{}` de l'absence sont nombreux, ils sont
déjà planifiés, et aucun ne lit une valeur :

| Consommateur | Ce qui casse avec deux formes |
| :--- | :--- |
| un **diff** de deux versions d'un modèle | il signale une modification là où rien n'a changé |
| l'**état sale** d'un éditeur | ouvrir un panneau de style et ne rien saisir marque le document modifié |
| un **hachage** de contenu (cache de rendu, empreinte de publication) | deux documents identiques ont deux empreintes |
| l'**undo/redo** du `designer` (patron Command, AGENTS.md §3.F) | une Command qui n'a rien fait entre dans l'historique, et son `undo()` n'est pas neutre |
| l'**aller-retour JSON** de [§3.14] | `JSON.stringify` conserve `{}` et supprime `undefined` : deux arbres « égaux » ne le sont pas |

**Et le refus est GRATUIT aujourd'hui, impossible demain** — c'est l'asymétrie que ce dépôt invoque
déjà, mot pour mot, pour `MIN_COLUMN_WIDTH` : « *Narrowing a field that no stored document can carry
yet costs nothing.* » Les trois champs sont **neufs dans ce lot** : aucun document existant ne porte
un `box`, donc aucun ne porte un `box: {}`. Le même resserrement après INC-4 serait un
**rétrécissement non vacuous**, c'est-à-dire impossible sans corrompre des documents. La question ne
se repose pas plus tard ; elle se tranche maintenant ou jamais.

**⚠️ Le piège du `.refine`, et il est nommé parce qu'il est facile à manquer.** Écrire
`Object.keys(o).length > 0` **ne suffit pas** : sous `exactOptionalPropertyTypes`, un objet construit
en mémoire peut porter `{ background: undefined }` — la clé est **présente**, la valeur ne l'est pas,
et `Object.keys` compte 1. Ce serait une **troisième** orthographe, introduite par le garde censé
n'en laisser qu'une. Le prédicat porte donc sur les **valeurs** :
`Object.values(o).some(v => v !== undefined)`. Un aller-retour JSON efface la différence —
`JSON.stringify` supprime les `undefined` —, mais un éditeur qui construit ses objets en mémoire ne
passe pas par JSON avant de comparer.

**Ce que ces deux refus coûtent, compté et non minimisé.** *(Raisonné ; les trois refus sont à
mesurer avec `N01`…`N26` avant INC-5.)*

1. **Trois refus neufs** — `N27` l'objet de style vide, `N28` le filet d'épaisseur nulle, `N29`
   `justify` sur une colonne [D5] —, à écrire, à narrer et à tester. **Aucun code d'erreur neuf**
   pour autant : un `.refine` rend `code: 'custom'`, et `SHAPE_ERROR_CODES` ne bouge pas [D15].
2. **Un normalisateur côté producteur.** L'éditeur du `designer` doit **retirer** un `box` devenu vide
   au lieu de le laisser. C'est un geste, il est unique, il est chez le **producteur** — et c'est
   exactement le partage que `page/types.ts:110-117` décrit en creux quand il refuse « *a consumer
   that starts by normalising* » : **un producteur qui normalise vaut mieux que N consommateurs qui
   normalisent**.
3. **Une fragilité à nommer : `S-6`.** Un check porté par l'**objet** ne survit ni à `.extend()` ni à
   `.pick()` en zod 4, mesuré. Les trois schémas concernés ne sont ni étendus ni découpés dans ce lot
   — et **c'est désormais une contrainte de rédaction**, pas un hasard : la [§6.4] la sonde.

**Écarté.** (a) **`min(0)` sur `BorderEdge.width`** : la révision 1, sur un précédent qui ne
transpose pas. (b) **Un plancher nommé `MIN_RULE_WIDTH_MM`** : 96 dpi est une propriété de la
machine, et ADR 0006 `:310` refuse les bornes sans mesure. (c) **Accepter `{}` en écrivant
« équivalent à l'absence »** : une équivalence proclamée qu'aucun `diff`, aucun hachage et aucun
`undo` n'honore. (d) **Normaliser par un `.transform()` qui supprime l'objet vide au parse** : c'est
l'issue élégante, et elle est refusée pour une raison mesurable — un `.transform` qui rend `undefined`
sur un champ `.optional()` **laisse la clé présente** avec la valeur `undefined`, donc produit la
troisième orthographe au lieu de la supprimer ; et il ferait de `parseTemplate` une fonction qui rend
autre chose que ce qu'elle a reçu, ce qu'aucune des cinq portes bornées ne fait aujourd'hui.
(e) **`z.strictObject`** pour fermer la perte silencieuse intra-version : mesuré, son `path` est `[]`
et la clé fautive n'est que dans `keys` et dans le message.

**Irréversible dans les deux sens** — un refus posé maintenant ne se retire qu'en élargissant (ce qui
est gratuit), et il ne se poserait plus après INC-4.
*Signal de réouverture :* un éditeur pour lequel le retrait du `box` vide s'avère coûteux à tenir —
auquel cas la question n'est pas le contrat mais l'endroit où la normalisation vit, et la réponse
resterait « chez le producteur ».
pixel) — ce serait un défaut d'E1, pas du contrat, mais il rouvrirait la question du plancher.

---

### D11 — Les espacements sont `padding` seul : ni `gap`, ni `margin` — et le **modèle de boîte** est écrit, tableau compris

**Décision.** `BoxStyle.padding?: BoxSpacing` où `BoxSpacing = { top, right, bottom, left }`,
**les quatre requises**, en millimètres, plancher `0`. **Pas de `gap`. Pas de `margin`.** Pas de
raccourci scalaire, pas de paire `{ vertical, horizontal }`. **Et le contrat écrit ce que ce
`padding` fait sur chacun des cinq porteurs**, y compris les deux porteurs de tableau — sans quoi il
stocke une valeur dont il ne sait pas dire le sens.

---

#### Le modèle de boîte, en quatre phrases — et pourquoi il DOIT être écrit

*(Raisonné. C'est le trou que la revue a nommé : la révision 1 donnait `BoxStyle` entier à
`TableRowNode` et à `TableNode` sans dire ce qu'un `padding` y signifie. Un padding de ligne peut
insérer dans la largeur disponible une soustraction que la formule publiée de `TableColumn.width` n'a
pas — c'est-à-dire **désaligner les colonnes d'une ligne à l'autre**. Le contrat ne peut pas laisser
un renderer inventer la réponse : deux moteurs conformes rendraient deux factures différentes, contre
la décision 7.)*

> **① La largeur.** Un bloc occupe **la largeur de contenu de son parent**. Il n'y a pas d'exception,
> et **un tableau n'en est pas une** : c'est ce qui clôt l'arbitrage n° 4.
>
> **② Le `padding` retranche.** La largeur de contenu d'une boîte est sa largeur, moins
> `padding.left + padding.right`. Idem en hauteur. C'est la seule chose que `padding` fait.
>
> **③ Sur un `table`, les poids de colonne se résolvent contre la largeur de CONTENU du tableau.**
> La formule publiée dit « *A column receives `width / (sum of the widths of its table)` of whatever
> width **the table itself is given***. » Ce lot dit ce que le tableau *reçoit* : la largeur de
> contenu de son parent ; et ce qu'il *partage* : sa propre largeur de contenu.
>
> **④ Sur un `tableRow`, le `padding` insète le contenu de CHAQUE CELLULE de la ligne, à
> l'identique — il ne déplace AUCUNE frontière de colonne.** `background` peint la bande,
> `border.top` / `border.bottom` tracent des filets en travers, `border.left` / `border.right` aux
> deux bouts.

**Pourquoi ④ et pas « la bande entière est insérée ».** Les deux lectures sont représentables, et une
seule est tenable. Insérer la **bande** déplacerait, pour cette ligne seule, l'origine et la largeur
sur lesquelles les poids se résolvent : les colonnes de la ligne d'en-tête ne tomberaient plus en face
de celles du corps. **C'est le défaut visuel que le lot existe pour empêcher.** Insérer le **contenu
de chaque cellule** ne touche à aucune frontière, donne le seul espacement qu'un tableau réclame
vraiment — de l'air dans les cellules — et laisse la formule publiée intacte.

**Et c'est le même critère qui a tué `gap` sur ce porteur**, appliqué cette fois jusqu'au bout. La
révision 1 retirait `gap` de `tableRow` parce qu'il « *insère dans la formule publiée de
`TableColumn.width` une soustraction qu'elle n'a pas* », puis laissait `padding` sur le même nœud sans
poser la question. **Le critère ne se joue pas sur le nom du champ.** Écrit comme en ④, `padding` ne
touche pas la formule ; écrit autrement, il tombait sous l'argument de `gap` et sortait avec lui.

**Ce que le modèle de boîte débloque, et c'est ce qui rend n° 4 clôturable.** La chaîne de largeurs
devient **entièrement déterminée par des millimètres déclarés**, sans une mesure :

```
printableAreaOf(page)              largeur imprimable       [C4, exportée]
  └─ root: ContainerNode           − padding.left/right     [ce lot]
       └─ container                − padding.left/right     [ce lot]
            └─ table               − padding.left/right     [ce lot]
                 └─ colonne i      × width_i / Σ width      [C3, formule publiée]
                      └─ cellule   − padding.left/right de la LIGNE   [ce lot, ④]
```

**Aucun terme de cette chaîne n'est une mesure, une métrique de police ou une lecture de la
machine** : ce sont des additions et une division correctement arrondie, sur des entiers pour les
poids [C3]. C'est très exactement ce que la décision 7 promet — « le même nombre dans l'aperçu et dans
le PDF » —, et c'est la garantie que la branche B de n° 4 **dégradait** en refusant d'écrire la
règle. **V3 peut la vérifier ; sans elle, V3 n'avait rien à comparer.**

**L'objection à laquelle il fallait répondre, et elle est levée.** La branche A de n° 4 était
écartée au motif que « *il faudrait alors répondre à « la largeur du parent, moins quoi ? », donc au
`padding` du parent, donc à un modèle de boîte complet* ». **La revue a rendu ce modèle obligatoire
pour une autre raison** — le `padding` de ligne —, donc son coût est **déjà payé**. Une objection dont
le prix est acquis n'est plus une objection : n° 4 se referme sur A, **sans un champ de plus**.

**Ce que ce modèle n'est PAS, et la frontière est nette.** Il ne dit rien de la **hauteur d'une
ligne** (mesurée sur le contenu — condition 3), rien de la **fusion de deux filets adjacents**
(attente moteur n° 6, [D16]), rien du **flottement** ni d'un **`border-collapse`** — qui reste refusé
comme modèle de mise en page. Il dit ce qu'un `padding` retranche, et rien d'autre. Quatre phrases,
et elles sont le prix d'un champ qui, sans elles, ne voulait rien dire.

---

**Pourquoi la forme du quadruplet est imposée, et par un texte.** `page/types.ts:22-30` : « *The
four edges, in millimetres, all four required. No shorthand (`margins: 20`), no pair
(`{ vertical, horizontal }`), no inheritance: **a second spelling of one fact** means two stored
shapes, two refusal paths and a `printableAreaOf` that starts by normalising.* » C5 reproduit la
forme trait pour trait, y compris le plancher zéro, y compris les noms de champ sans suffixe
d'unité [D6].

**Pourquoi `gap` sort du lot — et c'est un constat bloquant.** *(Vérifié par lecture de
`ast/types.ts`.)* `gap` est légal, dans le contrat reconstruit, sur **cinq** types de nœud. Passons-
le sur chacun :

| Porteur | Enfants réels | Ce que `gap` y signifie |
| :--- | :--- | :--- |
| `container` | `readonly children: readonly BlockNode[]` | espace entre blocs frères — **le seul cas qui a un sujet** |
| `image` | **aucun** (`src`, `alt?`) | **rien.** Un état sans sujet |
| `text` | `readonly content: readonly TextSegment[]` — des runs **inline** | de l'interlettrage à l'échelle du mot, **non déclaré** |
| `tableRow` | `readonly cells: readonly TableCell[]` | espace **inter-cellule** — voir ci-dessous |
| `table` | `columns` / `header` / `body` / `footer` | `border-spacing` : un **modèle de mise en page de table** |

**Et sur `tableRow`, ce n'est pas seulement vide, c'est destructeur.** `ast/types.ts:233-235`,
docstring **publiée**, définit la part d'une colonne : « *A column receives `width / (sum of the
widths of its table)` **of whatever width the table itself is given**.* » Cette formule n'a
**aucune** soustraction ; un `gap` entre cellules en insère une. **C5 modifierait donc la
définition de `TableColumn.width` par un champ posé sur un autre nœud** — et `TableColumn` est
précisément le site dont le critère en quatre conditions dit qu'un espacement n'y appartient pas.
Le contrat ne peut pas obtenir par un détour ce que le critère publié lui refuse en face.

**Pourquoi `margin` reste dehors — et pourquoi c'est un arbitrage plutôt qu'un refus définitif.**
*(Raisonné.)* Deux marges adjacentes **s'additionnent ou fusionnent** : CSS fusionne, plusieurs
moteurs PDF additionnent, et **choisir est une politique de rendu** — condition 3 de D1. Le contrat
pourrait **prendre** la convention (« les marges s'additionnent, elles ne fusionnent jamais »),
comme il prend sRGB en D8, mais ce serait un troisième espacement qui s'additionne aux deux autres,
et l'ADR devrait alors écrire la somme. Le lot ne le fait pas et **remonte la question**
[⛔ n° 6].

**Le coût du refus, écrit et chiffré.** Sans `gap` ni `margin`, un **rythme vertical non uniforme**
— « plus d'air avant le bloc des totaux » — se paie en **un `ContainerNode` par valeur d'air**,
comptés par `assertBoundedShape`. Le coût unitaire est mesuré : un nœud conteneur nu coûte
**+4 valeurs** au compte de forme bornée (`campagne de mesure §5.1`, un `box` complet à 16 valeurs, un
conteneur nu bien moins), sur un plafond dont le pire régime occupe 13,13 %. **Le refus figure en
D18 avec ce contournement et ce coût**, comme les dix-neuf refus de C4.

**Écarté.** (a) **`gap` sur les cinq porteurs** : trois n'ont pas de sujet, et deux réécrivent une
formule publiée. (b) **`gap` sur `ContainerNode` seul, via un `ContainerBoxStyle extends
BoxStyle`** : c'était l'issue honnête, et elle coûte **une seconde forme stockée** plus deux
exports, pour un fait qu'un `padding` sur chaque enfant exprime déjà — l'anti-sur-ingénierie penche
dans l'autre sens. (c) **`margin`** : ⛔ n° 6. (d) **Un raccourci scalaire ou une paire** : refusé
par `page/types.ts:23-26`, deux orthographes d'un fait. (e) **Un interligne** : condition 3 — « une
ligne n'a de hauteur qu'avec une police, donc une métrique de police, donc une lecture de la
machine » (ADR 0006 `:649`), et c'est **le** champ que le piège des deux décimales mord (`1,15`,
mesuré) [D6].

**Irréversible** pour `padding`. **Réversible dans le sens de l'élargissement** pour `gap` et
`margin` : les ajouter plus tard est une estampille.
*Signal de réouverture :* un modèle livré dont le rythme vertical exige plus de **trois**
conteneurs d'espacement — c'est le fait observable, et il se compte sur le modèle.

---

### D12 — Aucune cascade, aucun défaut de document, aucun `z.default()`, et aucune expression de style

**Décision.** Aucune valeur d'apparence n'est décidée ailleurs que sur le nœud ou le run qui la
porte, à **une** exception nommée : la précédence à deux termes de D4 et celle de D5. Pas de
`Template.defaultStyle`, pas d'héritage par sous-arbre, pas de `inherit`, pas de `currentColor`,
**aucun `z.default()`**. Et **aucune position de style n'accepte une `Expression`**.

**Pourquoi la cascade est refusée, et le précédent contraire doit être cité honnêtement.**
*(Raisonné, sur deux textes qui coupent en sens opposés.)* L'ADR 0004 D8 refuse tout arrondi par
défaut **et tout héritage d'arrondi par sous-arbre**, et se déclare **irréversible** ;
`ast/types.ts` le répète en production. Cinq motifs y sont écrits, et **ils ne transposent pas
tous** :

| motif de D8 | transpose à l'apparence ? |
| :--- | :--- |
| « visible dans l'arbre » — une valeur décidée hors du nœud qu'un relecteur regarde | **oui, intégralement** |
| un champ de document stocké ne se retire qu'avec une **migration transformante** | **oui, intégralement** |
| la résolution devient `surcharge ?? ancêtre ?? document`, « *que C6 devrait réimplémenter et tenir en phase* » | **oui** — et c'est l'argument de n° 1 |
| « un refus désigne un nœud » | **partiellement** — un refus de style ne désigne pas un montant faux |
| « le **pire dispositif possible** pour qui cherche un écart d'un centime » | **non** — une police héritée ne fausse aucun chiffre |

**Le plan écrit cette distinction plutôt que de s'abriter derrière une analogie de forme.** Et il
cite le **contre-précédent** que le brief ne cite pas : `ast/types.ts:250`, « *Inherited by every
cell of this column* » — un héritage **structurel, à un niveau, non surchargeable** existe déjà et
n'a été contesté par personne. La différence tenable : il descend d'une **déclaration de géométrie**
vers les cellules **de cette colonne**, pas d'un **ancêtre arbitraire** vers un **sous-arbre**.

**Et le besoin réel est déjà rangé.** ADR 0004 `:579-582` : « *ne pas retaper `2, 'halfExpand'`
quarante fois … est un problème d'**éditeur**, que D7 règle en pré-remplissant le widget, ce qui
écrit un nœud explicite.* » Transposé : « ne pas retaper la police quarante fois » est **D2 du
designer**, pas un champ de contrat. ⚠️ **Mais le coût de cette réponse est mesuré, et il est de
41×** [D4, n° 1] : le plan le publie **dans cette décision**, pas dans la section des bornes.

**Pourquoi aucun `z.default()` — et pourquoi la règle ne s'écrit pas en absolu.** *(MESURÉ deux
fois.)* `template/template.ts:149-151` : « *A `z.default()` would be worse than optional, and that
IS measured: a document with no page parses and comes out carrying a sheet Openview chose, **at
every parse, silently**.* » Re-mesuré sur une forme de style (`campagne de mesure §7.4`) :
`z.object({ a, style: z.object({…}).default({…}) }).parse({ a: 1 })` rend
`{"a":1,"style":{"bold":false}}` — **le document ressort réécrit**.

⚠️ **Le plan n'écrit PAS « aucun `z.default()` dans ce dépôt ».** Il en existe **un, vivant** :
`template/template.ts:135`, `version: z.string().default('1.0.0')`, couvert par un test qui en
dépend (`migrate.test.ts:44-47`) et qui est aussi la raison pour laquelle **tous** les littéraux de
test écrivent `version: '1.0.0'` — sans quoi l'aller-retour JSON de `page.test.ts:217` échouerait.
La règle juste est : **pas de `z.default()` sur une forme que l'auteur du modèle est censé
décider**. La révision d'auteur ne pilote aucune migration et n'a aucune conséquence visuelle ; une
feuille et une police en ont. Un plan qui pose la règle en absolu se fera contredire par son propre
`grep` [`V-4.2`].

**Pourquoi aucune expression de style — et c'est une condition de validité, pas une remarque.**
*(MESURÉ pour ce qui l'est, et le reste est nommé comme raisonné.)* La condition 1 de D1 l'écarte
par le critère : un formatage conditionnel (« en rouge si échu ») n'a de sens qu'en sachant ce que
le bloc contient. Mais **la raison mécanique est plus grave que le critère**, et il faut l'écrire :

1. **`READS_VISITOR` a huit branches, et rien ne force un style-expression à y être reporté.**
   Mesuré comme un trou **[S] intégral** : `text: (t) => ({ reads: [...], binds: undefined })`
   compile qu'il y ait deux ou trois sources. Le symptôme est celui que la docstring de
   `collectDataPaths` décrit : **un blanc, pas une erreur**. L'intégrateur n'est jamais averti de la
   clé, et le formatage conditionnel ne se déclenche jamais.
2. **Un `ExpressionErrorSite` neuf serait dû** (`errors.ts` en compte trois hors kinds : `'loop'`,
   `'condition'`, `'tableRowGroup'`) — donc **C4 a livré zéro site, C5 en livrerait un** [D15].
3. **`LIST_CALLER_SUBJECTS` est un `Record` partiel sans garde `never`** : un site ajouté seul
   **passe les quatre portes** et rend « *An expression needs a list…* » à qui a écrit un style.
4. **La réfutation `X-4` ne tient QUE sous cette condition.** « Un champ de style force une reprise
   du Visitor » est **faux** — mesuré : `visitNode`, `childrenOf`, `walk`, `findNodeById`,
   `nodeReads` et `collectDataPaths` commutent sur `type` et rendent des enfants **explicites**,
   donc un champ de style non-expression coûte **zéro** reprise de parcours. Le jour où une position
   accepte une `Expression`, `nodeReads` doit la rapporter, sinon `collectDataPaths` cesse de
   réclamer à l'intégrateur une clé que le document lit — le défaut exact que l'ADR 0002 a corrigé
   pour les boucles.

**Écarté.** (a) **Une cascade complète `surcharge ?? ancêtre ?? document`** : ADR 0004 D8, motifs 1,
2 et 3 ci-dessus. (b) **Un `Template.defaultStyle` optionnel** : n° 1 — et un champ de document
optionnel est **irréversible** au même titre qu'un requis dès qu'un document le porte. (c) **Un
`z.default()`** : mesuré, réécrit le document. (d) **Une expression de style** : condition 1, plus
les quatre trous mécaniques ci-dessus, dont **aucun n'est outillé** — c'est le risque le plus grave
du lot, et le contrat l'écarte par **la forme** plutôt que par la vigilance. (e) **Les zébrures**
(alternance de lignes dérivée d'un index) : condition 1, et elles seraient calculées ; un
`tableRow.box.background` déclaré ligne par ligne les exprime, explicitement.

**Irréversible** pour le refus de l'expression : l'admettre plus tard est un élargissement d'union
sur chaque position de style, donc une estampille **et** une reprise des huit branches de
`READS_VISITOR`.
*Signal de réouverture :* une demande de **formatage conditionnel** par un intégrateur. C'est un
besoin réel de facture (« en rouge si échu »), et le refus d'aujourd'hui a un coût réel : le
contournement est un `ConditionNode` par variante, écrit dans l'arbre — ce qui est précisément la
réponse que D8 a donnée à l'arrondi.

---

### D13 — La porte de type d'abord : huit paires `*_KEYS_IN_STEP` avant tout champ de style

**Décision.** **INC-0 du lot écrit les huit paires `*_KEYS_IN_STEP` manquantes, avant qu'un seul
champ de style existe.** Puis, par forme stockée neuve, **une paire** `keyof` + **une paire**
valeur — dix assertions, toutes dans `packages/core/src/style/__tests__/style.test.ts`, **jamais
dans `src/`**. Plus **dix-sept allers-retours à l'exécution**, un par champ de style. Et **aucun
schéma de style ne porte d'annotation `z.ZodType<T>`**.

**Pourquoi les huit paires d'abord — c'est la mesure la plus décisive de la campagne.** *(MESURÉ,
une mutation par site, compilée séparément sur une copie de `core/src` : `campagne de mesure §6.5`.)*

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
**exactement** ceux qui possèdent une paire `*_KEYS_IN_STEP` — les neuf de C3
(`ast/__tests__/nodes.test.ts:41,60,75,94,115,120,125,130,136`) et les quatre de C4
(`page/__tests__/page.test.ts:46,51,56,61`). **Les huit sites où C5 accroche naturellement un style
sont précisément les huit que la porte ne surveille pas.** Et la couverture ne rattrape rien :
mesuré, **591 tests sur 591 passent** avec quatre schémas divergents (`campagne de mesure §6.4`,
mutation V-B, une seule assertion refuse, `TABLE_ROW_KEYS_IN_STEP`).

**Pourquoi ce trou est structurel, et non accidentel.** `nodes.test.ts:99-114` l'a mesuré et écrit :
sous `exactOptionalPropertyTypes`, `{ columnId, children }` et
`{ columnId, children, rowSpan?: number | undefined }` sont **mutuellement assignables**, donc « *An
OPTIONAL field added to one side only — precisely the shape a backward-compatible new field takes —
slips through. A field present in the TYPE and absent from the SCHEMA is worse than a compile
error: `parseTemplate` strips it at runtime (measured), so an editor writes it, the next open erases
it, `onSave` persists the loss, and `schemaVersion` never moves.* » **C5 est le lot dont *tous* les
champs sont optionnels** — conséquence directe du refus de cascade et de défaut [D12]. C'est
exactement la forme de dérive que la porte ne voit pas.

**Les huit paires, nommées.** `TEXT_LITERAL_SEGMENT_KEYS_IN_STEP`,
`TEXT_BINDING_SEGMENT_KEYS_IN_STEP`, `TEXT_PAGE_FIELD_SEGMENT_KEYS_IN_STEP`,
`TEXT_NODE_KEYS_IN_STEP`, `IMAGE_NODE_KEYS_IN_STEP`, `CONTAINER_NODE_KEYS_IN_STEP`,
`LOOP_NODE_KEYS_IN_STEP`, `CONDITION_NODE_KEYS_IN_STEP`. **Les deux dernières sont des
contre-épreuves de la coupe de D3** : `loop` et `condition` ne portent **aucun** style, et leur
paire rougit le jour où quelqu'un y ajoute un champ d'un seul côté. Le critère de sortie d'INC-0 est
**mécaniquement vérifiable** : chacune des huit mutations de `campagne de mesure §6.5` doit passer d'**exit
0 à exit 1**.

**Le neuvième site est structurellement ingardable, et le plan le dit.** `Template` **est** inféré
de son schéma (`export type Template = z.infer<typeof TemplateSchema>`) : une paire
`TEMPLATE_KEYS_IN_STEP` serait **tautologique**. Le seul filet est l'**aller-retour JSON** de
`page.test.ts:217` et `table.test.ts:373`, qui voit un champ que le schéma **supprime** mais pas un
champ absent de la fixture. **Le lot ajoute donc un littéral d'aller-retour qui porte un style à
chacun des neuf sites** — sans quoi la moitié des sites n'a aucun filet [signalement H].

**Pourquoi les assertions vont dans `__tests__/` et jamais dans `src/`.** *(MESURÉ par lecture :
dans le dépôt, **toutes** les `*_IN_STEP` vivent dans un fichier de test ; `ast/schemas.ts` et
`page/schemas.ts` ne les mentionnent qu'en **commentaire**.)* Trois conséquences, toutes
vérifiables : (a) **la métrique de couverture est faussée** — `vitest.config.ts` exclut
`src/**/*.{test,spec}.{ts,tsx}` et rien d'autre, et le seuil de 90 % porte sur `lines`, `functions`,
`branches` **et** `statements` ; neuf `export const X = true` dans `src/` sont neuf `statements`
couverts par le simple fait qu'un test importe le module, **pour zéro assertion à l'exécution** —
littéralement le test tautologique qu'`AGENTS.md` §5 interdit, sauf qu'il gonfle le numérateur
**et** le dénominateur du bon côté ; (b) elles **partent dans `dist`**, donc dans le tarball publié,
et il faut ensuite décider si le barrel les exporte — question que le dépôt n'a jamais eu à
trancher ; (c) elles deviennent des **symboles de contrat**, donc des engagements de compatibilité.

**Pourquoi dix assertions et non neuf, et pourquoi les unidirectionnelles sautent.** *(MESURÉ, la
matrice de mutation à huit lignes : `relecture adverse « mesures » §2`, re-mesurée `campagne de mesure §3.5`.)*
`keyof` et « valeur » sont **complémentaires, jamais interchangeables** : `keyof` voit la présence
(M1, M2, M4) et rate la dérive de type (M5, M6) ; « valeur » fait l'inverse. Les **cinq assertions
unidirectionnelles `*_SATISFIES_TYPE` ne refusent jamais seules** — elles ne déclenchent que là où
une mutuelle déclenche aussi. Le contrat garde donc **une paire par forme**, `keyof` + valeur, soit
**dix** assertions pour cinq formes.

**Pourquoi dix-sept allers-retours à l'exécution — c'est la seule garde qui franchit M7.**
*(MESURÉ : `exit 0`.)* Une **arête de filet entière** retirée de `BoxBorderSchema` passe **les neuf
assertions** :

```
$ node run-m7.mjs
schema complet : {"top":{"width":0.3,...},"bottom":{"width":0.3,...}}
schema ampute  : {"bottom":{"width":0.3,...}}   <== le filet du haut a disparu, sans erreur
```

Motif : `BoxBorder` est tout-optionnel, donc l'amputation reste mutuellement assignable, et
`keyof BoxStyle` ne bouge pas puisque `border` est toujours là. **La couverture ne rattrape rien non
plus** : un champ absent du schéma n'est pas une branche non couverte, c'est une branche qui
n'existe pas. Le dépôt a déjà écrit le remède, deux fois (`ast/schemas.ts:44-51`, `:71-81`) : « *Only
a runtime parsing test catches that, and that is why there is one per node type.* » **Le plan
reprend la phrase et remplace « node type » par « champ de style ».** Décompte, **raisonné à partir
du contrat de [§3]** : 5 (`Typography`) + 3 (`BoxStyle`) + 4 (arêtes de `BoxBorder`) +
4 (`BoxSpacing`) + 1 (`TextNode.align`) = **17**.

**Pourquoi aucune annotation `z.ZodType<T>`.** *(MESURÉ deux fois : exit 0.)* Annoter
`TypographySchema: z.ZodType<Typography>` **et** amputer `italic` compile — « *les neuf assertions
passent, `keyof` comprises, parce que `z.infer` d'un schéma annoté rend l'annotation, donc
`keyof z.infer<...>` **est** `keyof Typography` par construction* ». Le patron obligatoire
d'`AGENTS.md` §1.2 vise l'**AST récursif**, et seulement lui ; les schémas de style ne sont pas
récursifs, l'annotation ne leur achète rien et **désactive silencieusement la seule garde de
compilation du lot**. L'interdiction est écrite dans la docstring de `style/schemas.ts`, sur le
modèle de `ast/schemas.ts:44-51`, qui explique déjà pourquoi `TextSegmentSchema` n'est **pas**
annoté.

**Écarté.** (a) **Écrire les champs d'abord et les paires ensuite** : les huit sites sont aveugles,
donc l'oubli d'un schéma serait silencieux **pendant tout le lot**, et un incrément intermédiaire
pourrait passer les quatre portes avec un type et un schéma divergents. (b) **Un fichier
`style/instep.ts` dans `src/`** : les trois conséquences ci-dessus. (c) **Les cinq
`*_SATISFIES_TYPE` seules** : elles ne refusent jamais seules, mesuré. (d) **Se fier à
l'aller-retour JSON des fixtures existantes** : les cinq filets du dépôt ne voient un champ que si
le littéral qu'ils comparent le **porte**.

**Ce n'est pas une forme stockée**, donc **réversible** au sens strict — mais retirer une paire
rouvre exactement le trou que cette décision ferme.
*Signal de réouverture :* aucun.

---

### D14 — `CURRENT_SCHEMA_VERSION = 6`, migration par estampille seule, et la section de version ne recopie pas l'asymétrie de la v5

**Décision.** `CURRENT_SCHEMA_VERSION = 6`. Une entrée **`{ from: 5, to: 6 }`** ajoutée à
`TEMPLATE_MIGRATIONS` **sans fusionner les quatre existantes**, dont la fonction est
`(input) => ({ ...input, schemaVersion: 6 })` — **estampille seule, aucune transformation**.
Estampillée **une fois**, après la dernière forme persistée du lot, avec sa règle de conduite :
**aucun commit avant celui-là n'est publiable**. Et la section `## What version 6 means` ajoutée à
la docstring de `CURRENT_SCHEMA_VERSION` **ne recopie pas** le paragraphe d'asymétrie `root`/`page`
de la v5.

**Pourquoi l'incrément est dû, et il est mesuré sur le vrai build.** *(MESURÉ deux fois, sur deux
documents différents.)* Un document portant les formes nouvelles, estampillé 5, relu par le build
de `main` :

```
$ node m5-compat.mjs
entree   : {"values":189,"depth":13}
resultat : ACCEPTE SANS AUCUNE ERREUR
sortie   : {"values":65,"depth":13}
efface   : 124 valeurs sur 189 (-65.6 %)
  -> `box` present ? false | `typography` present ? false | jusqu'au segment pageField d'une bande
```

**124 valeurs sur 189 effacées, aucune erreur**, et un `onSave` persiste la totalité de la perte.
La seconde mesure, sur un document à styles **réduits** à onze positions, rend **36 sur 114
(−31,6 %)** (`m1.mjs`). **Les deux chiffres sont exacts et le plan cite le sien avec son
document** — le pourcentage seul ne se cite pas. C'est la **perte silencieuse** d'`AGENTS.md` §1.2,
ici constatée sur le vrai build plutôt que raisonnée.

**Pourquoi l'estampille seule est un travail complet.** `AGENTS.md` §1.2 : « *Une migration qui ne
transforme rien n'est pas une migration fantôme. Elle estampille, et l'estampille est **tout** ce
qui produit le second message.* » Vérifié sur le build de `main` — et **le refus ne dépend pas des
formes nouvelles**, l'estampille seule suffit (`campagne de mesure §6.2b`) :

```
classe        : TemplateMigrationError      instanceof : true
champs propres: ["stack","message","name","fromVersion"]
fromVersion   : 6      code : undefined      to : undefined
message       : "Template uses schema version 6 but this build understands at most 5. It was
                 written by a newer release of Openview; upgrade before opening it."
```

**Les trois assertions exactes du plan de test sont donc** `err instanceof
TemplateMigrationError`, `err.fromVersion === 6`, et la chaîne **au caractère près**. **Ni
`err.code`, ni `err.to`** : `errors.ts:196-207` ne porte que `fromVersion`, vérifié dans le source
et mesuré sur le `dist` [`M8`, signalement G].

**Pourquoi PAS une migration transformante.** *(MESURÉ.)* Écrire une baseline dans chaque document
existant exigerait que `migrate.ts` **traverse l'AST** — il n'a aujourd'hui aucune traversée — et
coûterait **+324 valeurs (+59,1 %)** sur le modèle du playground contre **+8** pour une baseline
unique. Et une baseline **exige un mandat produit** [n° 1] : la page de compatibilité A4/20 mm
est « *une décision produit, prise par le propriétaire du produit le 2026-08-18, **not a
deduction*** » (`migrate.ts:170-176`), et **une police de compatibilité est un cran pire** — A4 est
une constante de papier, fausse pour une partie du monde mais qui **existe** partout ; une
`fontFamily: 'Helvetica'` désigne une ressource qui **peut ne pas exister** sur la machine de
rendu, et la résoudre est une lecture de la machine, refusée et outillée.

**⚠️ Ce que la section de version NE doit PAS recopier — et c'est un constat bloquant mesuré.**
`template/template.ts` écrit, pour la v5 : « *The path is in `root` and not under `page`, and the
reason matters: a version 4 build does not KNOW the `page` key, so it strips the whole field without
validating anything inside it.* » **C'est exact pour v4 → v5 et faux pour v5 → v6** : un build v5
**connaît** `page`, y descend et valide. Mesuré (`m2.mjs`) :

```
[forme nouvelle dans page.header[0].content.children] ZodError — issues=1
    code=invalid_union  path=["page","header",0,"content","children",0,"type"]
[segment kind nouveau dans une bande]                 ZodError — issues=1
    code=invalid_union  path=["page","header",0,"content","children",0,"content",0,"kind"]
```

La phrase à écrire est donc : « *Unlike version 5, there is no `root`/`page` asymmetry: a version 5
build KNOWS the `page` key and validates inside it, so a widened union is reported under
`page.header.0.content.…` exactly as under `root.…` -- measured.* » Le plan C4 fait autorité de
forme ; **c'est précisément pour ça que la phrase périmée serait recopiée** [`V-2.2`].

**Ce que le lot n'écrit pas non plus, et pourquoi.** *(MESURÉ.)* Le plan **n'écrit pas** « la
seconde borne de `parseTemplate` ne gagne rien ». L'étape 5 → 6 n'y contribue rien — delta 0/0 —
mais **la seconde passe reste porteuse pour tout document estampillé ≤ 4**, que la 4 → 5 transforme
(+11 valeurs) : sous `maxNodes = 20`, l'entrée (16 valeurs) passe et la sortie (27) est refusée
(`m8.mjs`). **C'est le seul constat dont la mauvaise lecture ferait perdre un garde-fou**
[`V-5.3`]. Et le plan **ne recopie pas** l'erreur de la reconnaissance : la 4 → 5 teste la
**valeur**, `page: input.page ?? compatibilityPage()`, et non `'page' in input`, dont
`migrate.ts:192-201` consigne qu'il était la **mauvaise** version [`V-9`].

**La chaîne, et le seul filet mécanique sous l'estampille.** `migrate.test.ts:158-163` **rougit** :
le littéral attendu passe à `[[1,2],[2,3],[3,4],[4,5],[5,6]]`, et la seconde assertion
(`toHaveLength(CURRENT_SCHEMA_VERSION - 1)`) s'ajuste seule. Le commentaire qui suit dit que ce
littéral est « *the ONLY mechanical net under the stamp of lots C1, C2 and C3* ». **Aucune des trois
conceptions ne le citait** ; il est dans la liste des fichiers modifiés [`V-7.3`]. Et la chaîne
**1 → 6** est mesurée : **5 étapes**, estampille 6, `16/7 → 27/7`, delta **+11 valeurs, +0
niveau** — un chiffre qui **concorde exactement** avec celui que `migrate.test.ts:262-264` déclare
pour lui-même.

**Écarté.** (a) **Pas d'incrément** : 124 valeurs sur 189 effacées sans erreur, mesuré. (b) **Une
migration transformante** : +324 valeurs, une traversée de l'AST dans `migrate.ts`, et un mandat
produit. (c) **Fusionner les quatre entrées existantes** : `migrate.test.ts:114-152` teste la
promesse de C9 — « *brings a template written before C1 up to the current stamp* » — et la chaîne
est ce qui la tient. (d) **Estampiller une fois par incrément** : `template.ts:16-21` l'écarte, « *le
numéro désignerait un commit plutôt qu'un contrat* ».

**Irréversible** — c'est le numéro d'une forme stockée. Le garde ne protège **que vers le haut** :
un document sous-estampillé n'est pas refusé, il est migré silencieusement et ressort à
l'estampille courante (`migrate.ts:69`, vérifié par analogie exécutée v4 → v5).
*Signal de réouverture :* aucun. Une estampille ne se rouvre pas.

---

### D15 — Zéro code d'erreur nouveau, zéro site nouveau : la ligne de C4 est tenue, et le legs à C8 est compté

**Décision.** `packages/core/src/errors.ts` **n'est pas modifié**. `SHAPE_ERROR_CODES` reste à
trois membres, `EXPRESSION_ERROR_CODES` inchangé, `ExpressionErrorSite` inchangé. **Aucun
`superRefine`, et aucun invariant CROISÉ** dans le contrat de style : les trois `.refine` que [D10]
introduit portent chacun sur **un seul objet**, sans regarder ni un frère ni un ancêtre. Et le lot
**compte** ce qu'il lègue à C8 plutôt que de renvoyer au précédent.

> ⚠️ **La révision 1 écrivait « aucun `.refine` » et l'a payé en [D10].** Le refus de principe est
> tombé sur un constat : sans lui, le contrat stockait **trois orthographes** d'« aucun style ». La
> ligne qui tient — et c'est celle de C4 — n'a jamais été « aucune vérification » : c'est **zéro code
> d'erreur neuf**, et un `.refine` rend `code: 'custom'`. `SHAPE_ERROR_CODES` ne bouge pas, le
> catalogue de C8 ne s'allonge pas d'une entrée, et ce que C8 hérite est **trois messages de plus**,
> comptés ci-dessous plutôt que découverts par lui.

**Pourquoi c'est possible, et le précédent est écrit.** *(MESURÉ : les 26 refus de `campagne de mesure §4`
sont tous des refus de schéma, `code` ∈ {`invalid_format`, `invalid_type`, `too_small`, `too_big`,
`invalid_value`}, aucun `custom`.)* ADR 0006 D9 a livré « **ZÉRO code d'erreur nouveau, ZÉRO site
nouveau** … *Pourquoi c'est possible : les dix-neuf fautes du lot sont **décidables au save
time*** ». C5 tient la même ligne pour la même raison, et le précédent est explicite dans
`ast/schemas.ts:139-143` : « *Everything a column can get wrong is decidable without any data, so it
is refused when the template is SAVED and **adds no entry to the error catalogue lot C8
enumerates***. »

Tout ce que C5 refuse est décidable au save time et **sans données** : une couleur mal formée, une
taille hors fenêtre, une longueur négative, une arête sans couleur, un `padding` incomplet, un
alignement inconnu.

**Les deux exceptions possibles sont écartées PAR DÉCISION, et il faut le dire ainsi.**

1. **Une référence de style pendante** exigerait un `superRefine` sur `TemplateSchema` — le
   **premier** de ce fichier — sur le patron exact de `checkTableWiring`. Elle n'ajouterait **aucun
   code** (`code: 'custom'` avec un `path`), mais elle ajouterait **un refus à écrire, à narrer et à
   tester**, plus la **règle de coupure** de C3 (ne pas parcourir l'arbre si la table elle-même est
   fautive : mesuré par C3, **13 issues au lieu d'1**), plus la question d'une **sixième porte
   bornée** (`parseStyleTable`). **C'est le vrai coût de la table de styles nommés**, et c'est
   pourquoi l'arbitrage n° 3 ne se déduit pas de la mesure de coût : 9,5× sur une ressource
   abondante contre un refus nouveau. Le contrat retenu **n'a pas de table nommée**, donc pas de
   référence pendante [⛔ n° 3].
2. **Un style qui est une expression** exigerait un `ExpressionErrorSite` neuf **et** un libellé dans
   `LIST_CALLER_SUBJECTS`, un `Record` **partiel et sans garde `never`** : un site ajouté seul passe
   les quatre portes et rend « *An expression needs a list…* » à qui a écrit un style. C'est un
   argument de plus pour le refus de D12, et il est mécanique.

**Ce que le lot lègue à C8, compté plutôt que renvoyé.** *(Raisonné à partir du contrat de [§3], non
recompté par une sonde.)*

| défaut légué | sites dans le contrat retenu | statut |
| :--- | :--- | :--- |
| `Infinity` rend `Invalid input: expected number, received number` (mesuré, R11) | **six** positions numériques : `sizePt`, les quatre champs de `BoxSpacing`, la `width` d'une arête | réserve déjà versée à C8 par l'ADR 0006 `:212-215` ; C5 **compte ses sites** |
| un `z.enum` requis absent rend le **même** message qu'un `z.enum` erroné (mesuré, R17/R18) | **aucun** — `TextNode.align` est **optionnel**, et c'est un argument mesuré pour l'optionalité | défaut déjà consigné pour `pageField` (`ast/schemas.ts:29-36`, « *Exact, and misleading; recorded for lot C8* ») ; **C5 n'en crée aucun site** |
| `weight: 412.5` rend `invalid_type`, pas `invalid_format` — zod 4 range `.int()` sous `invalid_type` (mesuré, R12) | **aucun** si ⛔ n° 2 tranche `bold?: boolean` ; **un** si l'échelle numérique est retenue | à écrire dans le plan de test : un `it` qui attendrait `invalid_format` **échoue** |
| un refus `strictObject` rend `path: []` (mesuré, `m1`) | **aucun** — le contrat garde `z.object` | le prix est la perte silencieuse **intra-version**, que l'estampille ne couvre pas |

**Les trois messages légués, comptés.** *(Dérivé de [D10] et [D5] ; à mesurer avec `N01`…`N26` avant
INC-5.)*

| refus neuf | message | `code` | `path` |
| :--- | :--- | :--- | :--- |
| `N27` — objet de style vide | `An empty style object is not a style; omit the field` | `custom` | le champ (`…,"box"`) |
| `N28` — filet d'épaisseur nulle | `A rule has a positive width; omit the edge to declare no rule` | `too_small` | `…,"border","top","width"` |
| `N29` — `justify` sur une **colonne** | `Invalid option: expected one of "start"\|"center"\|"end"` (mesuré, `m2.mjs`) | `invalid_value` | `…,"columns",0,"align"` |

Les trois portent un **remède dans le message** — le reproche exact que [D10] adresse à
`'A rule width is greater than zero'`, qui prescrivait sans dire quoi faire.

**Écarté.** (a) **Un code `'invalid-colour'` ou `'style-not-declared'`** : C4 a démontré qu'un lot de
contrat peut n'en ajouter aucun, et chaque code est une entrée dans le catalogue que **C8** doit
raconter. (b) **Un `superRefine` sur `TemplateSchema`** : c'est ce que la table de styles nommés
exigerait, avec sa règle de coupure et sa sixième porte bornée [⛔ n° 3] — les trois `.refine` de
[D10] n'en sont pas, ils ne regardent qu'un objet et n'ont besoin d'aucune coupure. (c) **Une sixième
porte bornée `parseStyle`** : la doctrine de `parsePageSetup` s'appliquerait (charger le fragment pour
la position qu'il occupera), mais **aucun intégrateur n'en a besoin aujourd'hui** — le style n'est
jamais un fragment autonome, il vit toujours dans un nœud, et `parseBlockNode` le valide déjà.

⚠️ **Et la faiblesse structurelle est nommée ici plutôt que cachée.** Le contrat porte **zéro
invariant croisé**, là où C4 en portait deux (la marge contre la feuille, les occurrences de bandes
deux à deux). Les trois `.refine` de [D10] ne comblent pas ce trou : ils refusent des **formes non
canoniques**, jamais une **incohérence entre deux champs**. **La surface de refus de C5 reste donc
plus faible que celle de C4** — un contrat tout-optionnel n'a presque rien à refuser. Ce n'est pas une
vertu, c'est une conséquence du refus de cascade — et c'est le signalement N.

**Ce n'est pas une forme stockée** — **réversible**. Mais un code ajouté plus tard est un
élargissement du catalogue de C8, donc une reprise de son périmètre.
*Signal de réouverture :* la décision de l'arbitrage n° 3. Si la table de styles nommés entre, cette
décision tombe : il faut un `superRefine`, son message, son `path`, sa règle de coupure et son test.

---

### D16 — Les attentes envers le moteur vivent dans l'ADR, et jamais dans une docstring

**Décision.** L'ADR 0007 porte une section `## Conséquences` avec les **attentes envers
`@openview/engine` et `@openview/viewer`**, nommées et datées. **Aucune docstring du contrat n'écrit
ce qu'un moteur fera.**

**Pourquoi cette règle, et elle est une correction du dépôt.** ADR 0005, constat C-01 : les
docstrings de C3 annonçaient « *Repeated page after page by the engine* », et il a fallu les
**retirer**. C4 en a fait un critère mécanique de sa définition de fini :
`git grep -niE "the engine (will|must|repeats|paginates|decides)"` doit rendre **rien**. C5 hérite du
critère, et il en a plus besoin que C4 : **la moitié de ce qu'il déclare n'a de sens qu'une fois
rendue.**

**Les HUIT attentes, et chacune est adossée à un constat.** *(La révision 1 en listait cinq ici et en
promettait cinq **autres** en introduction ; les deux listes sont désormais **identiques, à l'élément
près** — une introduction qui promet une section fait partie du contrat de lecture du document. Deux
attentes que l'introduction promettait ont disparu, pour deux raisons opposées : le `padding` d'un
tableau est devenu une **sémantique du contrat** [D11], et un filet d'épaisseur nulle n'est plus
**représentable** [D10]. Trois sont neuves — le filet adjacent, la justification, l'image sans
dimension —, et chacune est la contrepartie honnête d'un arbitrage tranché en révision 2.)*

1. **Le comportement d'une boîte au point de coupe.** Deux états banals que le contrat rend
   représentables et ne décrit pas : un bloc portant `background` que la pagination **scinde** — le
   fond se répète-t-il sur les deux fragments ? est-il peint jusqu'au bas de la première page ? — et
   un bloc portant `border: { top, bottom }` que la pagination scinde — le filet du bas apparaît-il
   **au point de coupe** (deux boîtes fermées) ou seulement **à la fin du bloc** (une boîte ouverte) ?
   **Les deux réponses sont légitimes, aucune n'est déductible du contrat, et E2/E3 les
   choisiront** ; or décision 7 promet l'identité entre l'aperçu (mono-page) et le PDF. **C5 est la
   première famille de propriétés dont le rendu dépend du point de coupe** : C4 pouvait se taire, il
   ne déclarait qu'une géométrie, et une géométrie ne se coupe pas [`P-11`]. Propriétaires : **E2,
   E3**. Vérificateur : **V3**.
2. **La résolution d'un nom de police.** Ce que le moteur fait d'un `family` qu'il ne trouve pas, et
   ce qu'il fait des dix valeurs qui désignent la machine [D9]. Propriétaires : **E6** (déterminisme,
   « au caractère près : polices, images »), **E8** (liste blanche des requêtes sortantes, polices
   incluses).
3. **Les cinq valeurs typographiques absentes.** `resolveTypography` rend cinq `T | undefined`
   [D4] : c'est le moteur qui décide de la police, de la taille, de la graisse, de l'italique et de
   la couleur d'un run qui n'en déclare aucun. **L'ADR les nomme comme une dette**, et
   `campagne de mesure §5.4` fournit l'argument de réouverture : si un modèle réel répète la même famille sur
   plus de la moitié de ses runs, le troisième terme redevient légitime [n° 1]. Propriétaires :
   **E1**, **V1**.
4. **L'espace colorimétrique.** Le contrat **déclare** sRGB [D8] ; c'est au moteur d'écrire un
   `DeviceRGB` avec profil, ou de convertir, et de dire ce qu'il fait. Propriétaires : **E1**, et la
   vérification **V3**.
5. **La conversion pt → unité de rendu.** Le contrat exporte `mmFromPt` et `ptFromMm` avec **une**
   orthographe [D6] ; l'attente est que le moteur **les emploie** plutôt que de réécrire la
   division — 60,9 % des tailles divergent selon l'ordre des opérations, mesuré. Propriétaires :
   **E1**, **V1**, et le playground du lot.
6. **La rencontre de deux filets adjacents.** Le contrat n'a **aucun modèle de fusion**, et
   `border-collapse` est refusé comme modèle de mise en page [D1, condition 3]. Or l'état est banal
   et **irréfusable** : la ligne *n* porte `border.bottom`, la ligne *n+1* porte `border.top`, et le
   `table` porte les quatre arêtes. Trois filets peuvent donc se superposer sur un même trait.
   **S'additionnent-ils, se recouvrent-ils, le plus épais l'emporte-t-il ?** Les trois réponses sont
   légitimes, aucune n'est déductible du contrat, et **c'est exactement le mécanisme d'une « grille
   complète »** — donc la propriété la plus visible du critère de recette [§6.2]. Propriétaires :
   **E1**, **E2**. Vérificateur : **V3**.
7. **Les deux conventions de justification.** Le contrat **prend** la convention plutôt que de la
   laisser ouverte, comme il prend sRGB [D5, D8] : la **dernière ligne** d'un paragraphe justifié
   s'aligne sur `start`, et le résidu se répartit uniformément entre les blancs **inter-mot**, jamais
   entre les lettres. L'attente est que le moteur les honore. Sans elles, `justify` serait le premier
   champ du contrat dont le rendu est un arbitrage laissé au renderer. Propriétaires : **E1**,
   **V1**.
8. **Une image sans dimension déclarée.** n° 5 est tranché en « aucune dimension », donc le
   contrat ne dit **rien** de la place qu'une image occupe — et le contournement écrit (un conteneur
   dont le `padding` façonne l'espace) fixe la **largeur**, jamais la **hauteur**, qui suit le ratio
   de la ressource. **Ce ratio est une mesure, et elle appartient au moteur.** L'attente est qu'il
   dise ce qu'il fait, et qu'il le fasse identiquement dans l'aperçu et dans le PDF. Propriétaires :
   **E1** ; **E8** pour la ressource elle-même (liste blanche des requêtes sortantes).

**Le patron du dépôt pour une attente est déjà écrit**, et le plan le suit : `page/types.ts:143-147`
— « *EXTERNAL KNOWLEDGE, not verified in this repository … **lot E1 owes it a throwaway probe*** ».
**Une attente nommée est une dette datée ; un silence est un bug futur que personne ne pourra
imputer.**

**Écarté.** (a) **Écrire les attentes dans les docstrings** : la faute que C3 a dû défaire, et que
C4 a transformée en critère mécanique. (b) **Décider soi-même du comportement à la coupe** : la
coupe appartient à E2/E3 (`engine.md:42-76`), et C4 s'est explicitement retenu de la préempter.
(c) **Ne rien écrire** : deux moteurs conformes rendraient deux factures différentes à partir du
même document, contre décision 7.

**Réversible** — c'est de la prose d'ADR.
*Signal de réouverture :* le premier écart mesuré entre l'aperçu et le PDF sur une propriété
d'apparence. C'est le lot **V3** qui le verra, et c'est lui qui portera la réponse.

---

### D17 — Le lot porte huit corrections du dépôt, parce qu'il est le lot dont le nom est mal employé

**Décision.** Un incrément dédié, hors `packages/core/src` pour partie, corrige **huit énoncés
publiés** que C5 périme ou honore. Chacun est présenté dans un tableau **« promesse du dépôt →
tenue / redirigée / déclinée »**, avec le **nouveau propriétaire** de chaque ligne déclinée.

> **La huitième est née de la revue**, et c'est la plus importante des huit : `ast/types.ts:144`
> décrit `TableColumn.align` comme « *How the cells of one column sit inside their column box* », un
> **placement de cellule** que ni C3 ni C5 ne peuvent tenir sans un modèle de mise en page de table.
> C'est cette phrase qui a fait croire à la révision 1 que l'alignement de colonne et l'alignement de
> texte étaient **un seul fait** [D5].

**Pourquoi le lot le fait, alors que les précédents s'en sont abstenus.** *(Raisonné, avec un
précédent d'exécution.)* La doctrine est écrite : « *Une ADR est un journal, et un lot ne réécrit pas
les documents d'un autre* » (ADR 0005 `:806`). Mais **C5 est le lot dont le nom est mal employé** :
`docs/roadmap/engine.md:79` attribue le modèle bilingue à « core C5 » alors que c'est **C6**, dont
`core.md:229` écrit lui-même « Dépend de : C2, C5 ». C'est le **troisième relevé** — ADR 0005 `:810`,
plan C3, et la campagne de mesure — et **personne ne l'a corrigé**. C5 a le plus d'intérêt à ce que
l'énoncé soit juste, et le moins de titre à réécrire le document d'un autre. **Le précédent
d'exécution existe et il est de C4** : le commit `366c28a`, « docs(core): rediriger les trois
promesses que le lot C4 a périmées » — un geste hors `packages/` que les lots précédents se sont
refusé, et **dont le refus est maintenant plus coûteux que le geste**.

**Les huit, avec leur nature.**

| # | Site | Ce que le dépôt promet aujourd'hui | Ce que C5 en fait |
| :-- | :--- | :--- | :--- |
| 1 | `ast/types.ts:159-160` | « *Three members and no `justify`: … typography is lot C5.* » | **TENU, ET AILLEURS.** `justify` entre, mais sur `TEXT_ALIGNMENTS`, **pas** sur ce tuple-ci — parce qu'une **colonne** ne justifie rien [D5, n° 8]. La phrase est réécrite pour dire les deux moitiés : ce tuple garde ses trois membres, et le quatrième vit sur le champ que C5 a livré |
| 2 | `ast/types.ts:203-206` | « *A font, a rule, a background, a spacing … are written on **any block whatsoever**, and lot C5 defines them there.* » | **REDIRIGÉ.** Reformulation minimale : « *written on any block that **OCCUPIES SPACE*** », et le motif d'exclusion de `loop`/`condition` écrit **une fois**. Cette phrase est le **critère d'appartenance** qui a servi à exclure la police de `TableColumn` : le texte qui a justifié une exclusion doit être corrigé en même temps que l'inclusion qu'il annonçait |
| 3 | `ast/types.ts:250` | « *Inherited by every cell of this column. **A per-cell override belongs to lot C5.*** » | **REDIRIGÉ.** La surcharge existe, mais elle vit sur le **bloc dans la cellule** (`TextNode.align`), pas sur la cellule — une cellule n'est pas un nœud, elle n'a pas d'`id`, et une Command d'éditeur ne l'adresse pas. Ce champ est le **défaut** de celui-là, et l'ordre est écrit une seule fois : `resolveTextAlign` [D5] |
| 8 | `ast/types.ts:144` | « *How **the cells** of one column **sit inside their column box** (lot C3).* » | **RÉTRÉCI, et c'est le correctif que la revue a rendu obligatoire.** La phrase décrit un placement de **cellule** ; ni C3 ni C5 n'ont de modèle de mise en page de table pour le tenir, et une cellule qui contient une **image** ou un **conteneur** le montre en une ligne. Le sens retenu est celui que le lot peut soutenir : *le défaut de `TextNode.align` pour les blocs de texte des cellules de cette colonne*. **Forme stockée inchangée, aucune migration due** [D5] |
| 4 | `ast/types.ts:366-369` | « *No border, no shading, no font, no spacing, **no per-cell alignment override (lot C5)**.* » | **PARTIELLEMENT PÉRIMÉ.** `TableNode` porte désormais `box` [D3], donc « no border, no shading, no spacing » **devient faux**. La phrase est réécrite ; « no font » reste vrai (la typographie est sur les runs) et la surcharge est redirigée comme au n° 3 |
| 5 | `ast/__tests__/nodes.test.ts:112-113` | « *`TableCell` is first because it is the likeliest site: **a per-cell alignment override is lot C5's declared future**.* » | **REDIRIGÉ.** Le test écrit « declared future » là où l'ADR 0005 `:292` écrit « ***s'il** la décide* » : une réservation conditionnelle durcie en promesse. La paire `TABLE_CELL_KEYS_IN_STEP` **reste** — elle est utile — et sa justification est réécrite |
| 6 | `page/__tests__/page.test.ts:43-44` | « *lot C5 has a **bleed** and a **gutter** in its declared future, and both are optional by nature.* » | **DÉCLINÉ** [⛔ n° 7]. L'ADR 0006 D13 range la marge de reliure et le fond perdu dans « un **silence** que ce lot décide de ne pas rompre », `:311` les dit « refusé en D13 », et le besoin est déjà couvert **sans champ** : `page/types.ts:27-28`, « *Zero is legal -- a **full-bleed** label, or a template that manages its own **gutter*** ». C'est la **seule** source de cette attribution (mesuré : 20 lignes, une seule attribue à C5) |
| 7 | `docs/roadmap/engine.md:79` | « *Le contrat sait décrire un modèle bilingue (**core C5**) …* » | **CORRIGÉ en C6.** Troisième relevé, jamais corrigé. Vérifié à HEAD |

**Et deux corrections de test, qui ne sont pas des promesses mais des filets.**

- `page/__tests__/page.test.ts:220-238` — l'assertion est **ancrée sur le chemin**
  (`path: ['page']`) au lieu d'une sous-chaîne du message agrégé. Le contrat retenu n'ajoute aucun
  champ requis à `Template`, donc le danger ne tire pas — mais **mesuré** (`m3.mjs`), avec un champ
  requis le parse rend **deux** issues, `style` **avant** `page`, et la regex non ancrée **matche
  toujours** : le test resterait **vert en n'assurant plus rien**. C'est pire qu'un test rouge, parce
  qu'un test rouge se voit. Une ligne, préventive [`V-7.2`].
- `template/migrate.test.ts:158-163` — le littéral de la chaîne passe à `[[1,2],[2,3],[3,4],[4,5],
  [5,6]]`. C'est « *the ONLY mechanical net under the stamp of lots C1, C2 and C3* », et **aucune des
  trois conceptions ne le citait** [`V-7.3`].

**Ce que le lot NE corrige PAS, et pourquoi.** (a) **`docs/plans/c4-la-page.md`** et son chiffre
« 231 valeurs » cité à quatre endroits : le plan **se déclare périmé par son propre en-tête**, un lot
ne réécrit pas un plan mort — le fait part en **signalement C**, et C5 cite **242 / 18**.
(b) **Les citations `core.md:≥175`** décalées de 31 lignes dans cinq documents, dont **deux ADR qui
font foi** : la classe entière part en **signalement B**, et C5 **recompte toutes ses citations**
plutôt que de corriger les documents des autres. (c) **`AGENTS.md`** : aucune entrée. La troisième
forme d'incompatibilité part en **signalement A** — **un plan ne s'auto-délivre pas de dérogation**,
et le véhicule d'un amendement est une ADR sous mandat explicite (précédent unique : C2 D11, mandat
du 2026-08-15). (d) **`packages/designer/DESIGN.md:146`** (« ni filet, ni fond, ni police, ni
espacement (lot C5) ») devient **vrai au lieu de faux** : la charte annonçait C5, C5 arrive. Une
ligne de renvoi suffit, et **aucune porte ne lit un `.md`**.

**Écarté.** (a) **Ne rien corriger** : le dépôt porterait, après C5, **huit** énoncés faux dont
**cinq** dans le code de production — et `engine.md:79` pour la **quatrième** fois. (b) **Tout
corriger, plans périmés compris** : réécrire un plan mort efface la trace de ce que le dépôt a cru,
ce que la doctrine refuse. (c) **Corriger dans le même incrément que les champs** : le point de
collision git serait maximal, et un incrément de documentation est **publiable seul**.

**Réversible** — c'est de la prose.
*Signal de réouverture :* aucun. Un énoncé faux corrigé ne se rouvre pas.

---

### D18 — Ce que le lot refuse, par familles, avec le lot qui possède chaque refus

**Décision.** Le lot refuse **vingt-six** choses, groupées en **sept familles**. Chaque refus porte
son `*Motif :*` adossé à un **texte du dépôt ou à une mesure** — jamais à un goût — et le **nom du
lot qui le possède**, ou la mention explicite qu'il n'a **aucun propriétaire**.
**Soit 6 + 4 + 4 + 4 + 3 + 2 + 3 = 26.**

> **Le compte a bougé, et il est recompté terme à terme plutôt que reconduit.** La révision 1 écrivait
> **24 en six familles**. **Sorti :** `justify`, désormais **admis** sur son propre tuple [D5,
> n° 8] — il quittait la famille 1 et la famille 6, où il était compté **deux fois**. **Entrés :**
> la **taille d'une image**, tranchée en refus [n° 5] ; et **trois formes non canoniques**, qui
> n'étaient refusées nulle part parce que la révision 1 les **acceptait** [D10]. Ces trois-là ne
> tenaient dans aucune des six familles — elles ne refusent ni une capacité ni un champ, elles
> refusent une **seconde façon d'écrire ce que le contrat sait déjà écrire** —, d'où la septième.

**Famille 1 — ce qui exigerait de MESURER (condition 3) : six refus.**

| Refus | Motif | Propriétaire |
| :--- | :--- | :--- |
| l'**interligne** sous toute forme | « une ligne n'a de hauteur qu'avec une police, donc une **métrique de police**, donc une lecture de la machine, refusée et outillée » (ADR 0006 `:649`) — et c'est **le** champ que le piège des deux décimales mord, `1,15` mesuré. **⚠️ Le motif tient ici et pas sur `justify`** : la hauteur de ligne entre dans la **pagination**, donc dans la géométrie que le contrat déclare, là où la justification ne redistribue que du blanc **à l'intérieur** d'une boîte déjà déterminée [D1] | **E6**, et rien dans `core` |
| l'**interlettrage** (`letterSpacing`) | même motif ; et **MESURÉ** : `letterSpacing` n'apparaît nulle part dans le dépôt, donc aucun texte ne le promet | personne |
| la **taille d'une image** (`widthMm` / `heightMm`) | n° 5 — toute forme utile a besoin du **ratio intrinsèque de la ressource**, qui est une mesure de la ressource et non du document. Contournement **exact** : une image occupe la largeur de contenu de son parent [D11], donc un conteneur et son `padding` la dimensionnent au millimètre | **E1** pour la place effective (attente n° 8, [D16]) |
| le dimensionnement **`auto`** | « *a width resolved by measuring content needs font metrics, which is reading the machine* » (`ast/types.ts:242-244`) | refusé pour tout le produit |
| une **largeur** ou une **hauteur** de bloc **stockée** | n° 4 est tranché **sans champ** : la largeur n'est pas déclarée, elle est **dérivée** — un bloc occupe la largeur de contenu de son parent, et [D11] écrit la chaîne complète. Ce qui reste refusé, c'est de **stocker** une longueur ici | **C11** si les calques survivent au v1 (`README.md:159` : ils sont le 2ᵈ candidat à la coupe) |
| une **réserve exprimée en lignes de texte** | ADR 0006 `:622-651`, D8 | E2 |

**Famille 2 — ce qui exigerait d'INVENTER une politique (condition 3) : quatre refus.**

| Refus | Motif | Propriétaire |
| :--- | :--- | :--- |
| l'**opacité**, l'**ombre**, le **dégradé** | un **modèle de composition**, pas une déclaration ; et **MESURÉ** : aucun texte du dépôt ne les promet ni ne les refuse — C5 est le premier à devoir l'écrire | **C11 / D10** (calques) |
| le **canal alpha** d'une couleur | la composition, encore ; refusé par la regex, et **le refus est écrit** [D8] | **C11 / D10** |
| **`border-collapse`** d'un tableau | un modèle de mise en page de table, pas une déclaration de boîte | personne |
| une **pile de repli** de polices | le repli est une politique ; `AGENTS.md:316` refuse en outre un `FontPort` nommément | **E6** |

**Famille 3 — ce qui serait dérivé d'une position, d'un index ou du contenu (conditions 1 et 4) :
quatre refus.**

| Refus | Motif | Propriétaire |
| :--- | :--- | :--- |
| le **formatage conditionnel** (un style qui est une `Expression`) | condition 1, **plus quatre trous mécaniques dont aucun n'est outillé** [D12] : `READS_VISITOR` ×8, `SEGMENT_EXPRESSIONS` ×3, `LIST_CALLER_SUBJECTS` partiel, la docstring de `collectDataPaths`. Symptôme : **un blanc, pas une erreur** | personne — et c'est le refus le plus susceptible d'être demandé |
| les **zébrures** dérivées d'un index | calculées, condition 1. Contournement : un `tableRow.box.background` déclaré ligne par ligne | personne |
| un style **dérivé d'une clé de données** (« tout champ nommé `total` en gras ») | obligerait l'intégrateur à nommer un champ comme Openview l'a décidé — **l'interdit de périmètre** | refusé pour tout le produit |
| un refus **positionnel** (« pas de style dans une bande ») | exigerait de connaître les **ancêtres** : « *it would be the contract's first positional rule* » (`ast/types.ts:82-85`) | refusé pour tout le produit |

**Famille 4 — ce qui changerait les CARACTÈRES (condition 2) : quatre refus.**

| Refus | Motif | Propriétaire |
| :--- | :--- | :--- |
| **`textTransform`**, petites capitales | change les caractères, et l'algèbre porte déjà `textCase` (ADR 0003) : **deux orthographes d'un fait** | **C1**, livré |
| le **soulignement** / `text-decoration` | change ce qu'un lecteur lit ? non — mais **MESURÉ** : aucun texte du dépôt ne le nomme, il n'est **pas** dans les dix attributs de `core.md:211-212`, et le critère de D1 ne le fait pas entrer par la charge de justification | personne |
| le **lien hypertexte** | ADR 0002 `:390` l'agrège à gras/italique ; c'est une **cible sortante** (E8) **et** un contenu à traduire (C6). Le classer sous « graisse et italique » est une erreur de famille — frontière **N-5**, sans texte | **N-5, sans propriétaire** |
| un **motif formaté** (`'Page {n} / {total}'`) | « c'est un parseur, avec son échappement et **sa surface d'injection** » (ADR 0006 `:955`) | refusé en D13 de C4 |

**Famille 5 — ce que le dépôt attribue ailleurs par un texte : trois refus.**

| Refus | Motif | Propriétaire |
| :--- | :--- | :--- |
| le **fond de page**, le **filigrane**, le **cachet**, la **couleur du papier** | ADR 0006 `:936-944` : ce sont des **calques**, « une bande **occupe** de la place, un filigrane est **derrière** le flux ». ⚠️ **L’ADR 0006 se contredit ici** : `:119` attribue « la couleur du papier » à **C5**, `:938-940` à C11/D10 ; C5 retient la seconde, elle est dans une **décision** [signalement L] | **C11 / D10** |
| le **positionnement libre au millimètre** | hors périmètre v1, `docs/roadmap/README.md:135` | hors v1 |
| l'**insécabilité** (`keepTogether`), la **veuve**, l'**orpheline**, le **report**, la **répétition effective**, le **point de coupe** | condition 3 : ce sont des politiques. **C4 s'est retenu de préempter C7, C5 fait de même** | **C7**, **E2**, **E3** |

**Famille 6 — ce que le dépôt attribue à C5 et que C5 refuse quand même : deux refus.**

| Refus | Motif | Propriétaire |
| :--- | :--- | :--- |
| le **fond perdu** (`bleed`) et la **gouttière** (`gutter`) sur `Sheet` / `PageMargins` (`page/__tests__/page.test.ts:43-44`) | l'ADR 0006 D13 les range dans un **silence** que C4 « décide de ne pas rompre », `:311` les dit « refusé en D13 », et `page/types.ts:27-28` couvre le besoin **sans champ**. C5 ne rompt pas un silence qu'il n'a pas ouvert — et **corrige la docstring** [⛔ n° 7, D17] | **personne** — un silence non attribué |
| une **surcharge d'alignement sur `TableCell`** (`ast/types.ts:250`, `nodes.test.ts:113`) | la surcharge existe, sur le **bloc dans la cellule** ; une cellule n'est pas un nœud, elle n'a pas d'`id`, et une Command ne l'adresse pas. **Redirigé, pas décliné** [D5, D17] | C5, à un autre site |

**Famille 7 — les SECONDES ORTHOGRAPHES d'un fait que le contrat sait déjà écrire : trois refus.**
*(Neuve en révision 2. Ces trois-là ne retirent aucune capacité : chacune est déjà exprimable, et
d'une seule façon. Le motif commun est celui de `page/types.ts:110-117` — « *two shapes to store, two
refusal paths, and a consumer that starts by normalising* » — et il est **vacuous aujourd'hui**,
puisque aucun document ne porte encore un de ces champs.)*

| Refus | Motif | Propriétaire |
| :--- | :--- | :--- |
| **`box: {}`**, **`typography: {}`**, **`border: {}`** | l'absence du champ dit le même fait, et elle le dit **une seule fois**. Deux formes cassent un diff, un état sale, un hachage et un `undo` — quatre consommateurs déjà planifiés, dont **aucun ne lit une valeur** [D10] | C5, et la normalisation est chez le **producteur** |
| un **filet d'épaisseur nulle** (`{ width: 0, color }`) | l'arête est **optionnelle**, donc son absence est la première orthographe. Le précédent `min(0)` de `PageMargins` ne transpose pas : **ses quatre arêtes sont requises** [D10] | C5 |
| **`justify` sur une COLONNE** (`TableColumn.align`) | une colonne ne justifie rien — elle fournit un **défaut** aux blocs de texte de ses cellules, et c'est le bloc qui justifie [D5]. L'élargir serait en outre la **troisième forme d'incompatibilité** [signalement A] | C5, à un autre site |

**Les trois qui seront demandés dès la première vraie facture** — avec leur **contournement daté**
et leur **coût de réouverture**, sur le patron de C4 D13.

1. **Une police pour tout le document.** Contournement : l'écrire sur chaque nœud texte, **mesuré à
   +60 valeurs (+10,9 %)** sur le modèle du playground, contre +3 pour une baseline. Coût de
   réouverture : un champ de document, donc **une estampille** s'il est optionnel, **un mandat
   produit et 28 tests** s'il est requis [n° 1].
2. **Le formatage conditionnel** (« en rouge si échu »). Contournement : un `ConditionNode` par
   variante, écrit dans l'arbre — la réponse exacte que l'ADR 0004 D8 a donnée à l'arrondi. Coût de
   réouverture : un élargissement d'union sur chaque position de style, plus les **huit branches de
   `READS_VISITOR`**, plus un `ExpressionErrorSite`, plus le piège de `LIST_CALLER_SUBJECTS` — donc
   **le refus le plus cher à rouvrir du lot**.
3. **Un rythme vertical non uniforme.** Contournement : un `ContainerNode` par valeur d'air, compté
   par `assertBoundedShape`. Coût de réouverture : `margin` est un **élargissement** (une
   estampille), mais il oblige l'ADR à écrire si deux marges adjacentes s'additionnent ou fusionnent
   [⛔ n° 6].

**Réversibilité — selon.** Les refus des familles 1, 2 et 3 sont **définitifs pour le produit** :
les rouvrir demanderait d'amender un interdit de périmètre. Ceux des familles 4, 5 et 6 sont
**réversibles par élargissement**, donc au prix d'une estampille. Ceux de la **famille 7** sont
**réversibles sans estampille** — accepter à nouveau une forme est un élargissement pur — mais ils
sont **irréversibles dans l'autre sens** : les poser après INC-4 serait un rétrécissement non
vacuous, c'est-à-dire impossible. C'est ce qui les rend urgents et non facultatifs.
*Signal de réouverture, pour l'ensemble :* une facture réelle d'un intégrateur qu'un de ces
vingt-six refus rend indécrivable. C'est le seul fait observable qui compte, et il ne s'anticipe
pas depuis le dépôt.

---

## 3. Le contrat définitif

### 3.0 Le protocole du bac à sable — avant le code, parce qu'une mesure sans protocole n'est pas une mesure

> **Convention de provenance, valable pour tout ce document.** Un chiffre porte soit son relevé
> reproduit ici même — les blocs de sortie de [§3, C.0] à [§3, C.6] et le tableau de [§5.1] —, soit
> la mention **raisonné** ou **non mesuré**, soit un renvoi à l'un des **quatre dossiers de travail
> de la conception**, qui vivent **hors du dépôt** avec les bacs à sable : la **campagne de
> mesure**, et les trois **relectures adverses** (« périmètre », « versionnement », « mesures »).
> Ces renvois sont conservés plutôt que effacés, parce qu'un chiffre sans provenance est une faute
> dans ce dépôt — mais le lecteur doit savoir qu'ils désignent des documents éphémères, et non des
> fichiers du dépôt. Tout ce dont l'exécution a réellement besoin est **dans ce document**.
>
> **Répertoire.** `…\scratchpad\sandbox-final\core\` — **hors du dépôt**, et le dépôt n'est
> touché en rien.
>
> **Ce qui est compilé.** Une **copie intégrale** de `packages/core/src` (`cp -r`, 3 008 lignes,
> tests compris), sur laquelle le contrat de ce document est appliqué. Ce n'est **pas** un
> contrat isolé : c'est `core` tel qu'il sera après le lot, avec ses 19 fichiers de test.
>
> **Ce qui pointe vers le dépôt, et en lecture seule.** `zod@3.25.76` et `vitest@4.1.10` par
> **jonction Windows** (`mklink /J`) vers le store pnpm. ⚠️ **Un `ln -s` de Git Bash ne suffit
> pas** : sans droit de lien symbolique, MSYS **copie** le répertoire, la copie est partielle, et
> `tsc` rend alors **55 faux `TS7006`** sur les rappels de `it.each` — mesuré, et c'est ce qui
> distingue un harnais valide d'un harnais muet.
>
> **`tsconfig.json` du bac à sable — il étend celui du dépôt, il ne le recopie pas :**
>
> ```json
> {
>   "extends": "C:/_Gargouilles/Openview/tsconfig.base.json",
>   "compilerOptions": {
>     "module": "NodeNext", "moduleResolution": "NodeNext",
>     "lib": ["ES2022"], "types": [], "rootDir": "./src",
>     "composite": false, "declaration": false, "declarationMap": false,
>     "incremental": false, "noEmit": true
>   },
>   "include": ["src/**/*"], "exclude": ["node_modules"]
> }
> ```
>
> Donc : `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`,
> `noUnusedParameters`, `noImplicitReturns`, `useUnknownInCatchVariables` — **tous actifs**, tels
> que la porte 3 les applique.
>
> **Compilateur.** `typescript@7.0.2` du dépôt, invoqué par chemin absolu. **Test runner.**
> `vitest@4.1.10` du dépôt, `include: ['src/**/*.{test,spec}.{ts,tsx}']`.
>
> **Baseline vérifiée avant toute modification** — sans quoi un exit 0 ne prouve rien :
>
> ```
> $ tsc -p tsconfig.json          => EXIT=0
> $ vitest run                    => Test Files 19 passed (19) | Tests 591 passed (591)
> ```
>
> **Contrôle négatif du harnais.** Trois familles, toutes exécutées et reproduites en
> [§3, C.3] : (1) onze mutations du schéma qui doivent passer d'**exit 0 à exit 1** ;
> (2) l'import par le barrel de `page/`, qui compile à **exit 0** et **casse à l'exécution** ;
> (3) `toSorted`, refusé sous `lib: ["ES2022"]`. **Un harnais qui ne rougit jamais ne prouve
> rien** — la démonstration est dans `campagne de mesure §3.2`, et elle est refaite ici trois fois.
>
> **Ce que le bac à sable ne partage pas.** La porte 1 (`biome check`) et la porte 2 (`build`)
> **écrivent** (`dist`, caches Biome et Turbo) : elles n'ont été jouées **nulle part**, et la
> conformité aux interdits `any` / `!` / `as unknown as` / `catch` vide et au plugin
> `no-environment-read` reste une **lecture**, pas une mesure. Le code ci-dessous n'emploie
> aucune des cinq écritures interdites, ne lit ni `Date`, ni `Intl`, ni `process`, ni
> `Math.random`, ni `globalThis`, et n'appelle aucun `toLocale*` — vérifiable par lecture, et
> c'est tout ce qui est affirmé.

---

### Les vingt-trois fichiers, et ce que le lot ne touche pas

⚠️ **Le tableau ci-dessous compte QUE la production et les tests de `core`. Le total est de 17
fichiers dans `packages/core`, plus 6 hors de `core`** — la vitrine, quatre documents, et le plan
lui-même.

#### Production — le dossier neuf `packages/core/src/style/`

| § | Chemin réel | Nature | Lignes | Incrément |
| :-- | :--- | :--- | --: | :-- |
| **3.1** | `packages/core/src/style/types.ts` | ➕ nouveau | 326 | INC-1 |
| **3.2** | `packages/core/src/style/units.ts` | ➕ nouveau | 51 | INC-1 |
| **3.3** | `packages/core/src/style/schemas.ts` | ➕ nouveau | 117 | INC-1 |
| **3.4** | `packages/core/src/style/resolve.ts` | ➕ nouveau | 130 | INC-3 (fichier créé en INC-1) |
| **3.5** | `packages/core/src/style/style.ts` | ➕ nouveau — **la façade** | 32 | INC-1 |

#### Production — fichiers modifiés

| § | Chemin réel | Nature | Lignes (avant → après) | Incrément |
| :-- | :--- | :--- | :-- | :-- |
| **3.6** | `packages/core/src/ast/types.ts` | ✏️ modifié | 414 → **527** | INC-2, puis INC-7 |
| **3.7** | `packages/core/src/ast/schemas.ts` | ✏️ modifié | 325 → **357** | INC-2 |
| **3.8** | `packages/core/src/template/template.ts` | ✏️ modifié | 167 → **207** | INC-4 |
| **3.9** | `packages/core/src/template/migrate.ts` | ✏️ modifié | 326 → **365** | INC-4 |
| **3.10** | `packages/core/src/index.ts` | ✏️ modifié | 211 → **237** | INC-5 |

#### Tests

| § | Chemin réel | Nature | Incrément |
| :-- | :--- | :--- | :-- |
| **3.11** | `packages/core/src/style/__tests__/style.test.ts` | ➕ nouveau (463 l.) | INC-1, INC-3 |
| **3.12** | `packages/core/src/style/__tests__/fixtures.ts` | ➕ nouveau (98 l.) | INC-1 |
| **3.13** | `packages/core/src/ast/__tests__/nodes.test.ts` | ✏️ modifié | **INC-0**, puis INC-7 |
| **3.14** | `packages/core/src/ast/__tests__/fixtures.ts` | ✏️ modifié | INC-2 |
| **3.15** | `packages/core/src/template/migrate.test.ts` | ✏️ modifié | INC-4 |
| **3.16** | `packages/core/src/page/__tests__/page.test.ts` | ✏️ modifié | INC-7 |
| **3.16 bis** | `packages/core/src/ast/__tests__/table.test.ts` | ✏️ modifié — **découvert à la mesure** | INC-2 |

> ⛔ **`3.16 bis` a été découvert à la mesure, et non au découpage.** Le découpage initial listait
> **seize** fichiers ; il en manque un. `ast/__tests__/table.test.ts:387` épingle la **liste
> exacte des clés** de `RECIPE_TABLE`, et l'arrivée de `box` la fait **rougir** :
> `AssertionError: expected [ Array(7) ] to strictly equal [ 'type', 'id', 'columns', …(3) ]`
> (relevé intégral en [§3, C.3`). C'est le **second filet mécanique** du lot, à côté du
> littéral de chaîne de `migrate.test.ts` — et **aucun** des sept documents de reconnaissance,
> d'attaque ou de mesure ne le citait. Il attrape un champ **optionnel**, ce qu'aucune paire
> `*_KEYS_IN_STEP` ne fait, mais **seulement parce que la fixture le porte** : c'est l'argument le
> plus fort en faveur du [§3.14].

#### Vitrine et documentation

| § | Chemin réel | Nature | Incrément |
| :-- | :--- | :--- | :-- |
| **3.17** | `apps/playground/src/App.tsx` | ✏️ modifié | INC-6 |
| **3.18** | `docs/roadmap/engine.md` | ✏️ modifié (`:79`) | INC-7 |
| **3.19** | `docs/roadmap/core.md` | ✏️ modifié (§C5 livré) | INC-8 |
| **3.20** | `docs/adr/0007-l-apparence.md` | ➕ nouveau | INC-8 |
| **3.21** | `docs/adr/0006-la-page.md` | ✏️ modifié (une ligne) | INC-8 |
| **3.22** | `docs/plans/c5-l-apparence.md` | ✏️ modifié en dernier (`⛔ PÉRIMÉ`) | INC-8 |

#### Ce que le lot NE touche PAS — et pour chacun, pourquoi c'est un résultat

| Chemin | Pourquoi c'est un résultat, et non une abstention |
| :--- | :--- |
| `packages/core/src/errors.ts` | **Zéro code d'erreur nouveau, zéro site nouveau.** Vérifié sur le contrat compilé : les 26 refus rejoués (`§C.4`) portent tous un `code` ∈ {`invalid_format`, `invalid_type`, `too_small`, `too_big`, `invalid_value`}, **aucun `custom`**, donc aucun `superRefine`. Possible parce que tout ce que C5 refuse est décidable au *save time* et **sans données** |
| `packages/core/src/ast/visitor.ts` | **Mesuré :** `tsc` exit 0 et 626 tests verts sans une ligne touchée. `visitNode`, `childrenOf`, `walk`, `findNodeById`, `nodeReads` et `collectDataPaths` commutent sur `type` et rendent des enfants **explicites** ; rien n'énumère les clés propres d'un nœud. **Condition de validité, et elle est nommée : aucune position de style n'accepte une `Expression`** |
| `packages/core/src/template/paths.ts` | Même motif. **Mesuré sur la fixture stylée :** `collectTemplateDataPaths` rend `["facture.numero","facture.lignes"]` — identique à `main` |
| `packages/core/src/template/guard.ts` | **Aucune porte bornée nouvelle** (un style n'est jamais un fragment autonome), et `DEFAULT_SHAPE_LIMITS` **ne bouge pas** : mesuré par **bisection sur le vrai `assertBoundedShape`**, la fixture stylée exige `maxNodes ≥ 285` et `maxDepth ≥ 18`, soit **0,29 %** et **28 %** des plafonds |
| `packages/core/src/page/types.ts`, `page/schemas.ts`, `page/area.ts` | C5 **lit** `MAX_SHEET_MM`, il n'écrit pas dans `page/`. Et **une bande a le style gratuitement** : `PageBand.content` **est** un `ContainerNode` |
| `packages/core/src/expression/**` | Aucune expression de style |
| `packages/designer/src/**`, `packages/viewer/src/**`, `packages/engine/src/**` | `BlockType = BlockNodeType` est **dérivé**, et C5 n'ajoute aucun **membre** à `BlockNode`. Les deux autres sont vides |
| `tsconfig*.json`, `biome.jsonc`, `tools/biome/*.grit`, `vitest.config.ts`, `turbo.json`, `package.json`, `pnpm-workspace.yaml` | `AGENTS.md` §7. **Aucune dépendance nouvelle.** ⚠️ Et le contrat a **rencontré** la contrainte plutôt que de l'esquiver : `Array.prototype.toSorted` est **`TS2550` sous `lib: ["ES2022"]`** (« *Do you need to change your target library?* »). La réponse est non — le test écrit `.sort()` sur le tableau frais de `Object.keys` |
| `AGENTS.md` | **Aucune entrée.** La troisième forme d'incompatibilité part en **signalement A** |

---

### 3.1 `packages/core/src/style/types.ts` — **nouveau**

**Compilé à exit 0 dans le bac à sable**, avec les 19 fichiers de test de `core`.

> ⚠️ **Ordre de lecture inversé, et il est assumé.** Les identifiants `3.1…3.22` sont **gelés**,
> mais ce fichier **dépend** de [§3.2] : `MAX_FONT_SIZE_PT` appelle `ptFromMm`. Lisez [§3.2]
> d'abord. La numérotation n'est pas corrigée parce que la renuméroter casserait tous les renvois
> internes du plan, ce que la convention de numérotation de ce document interdit.

```ts
import { MAX_SHEET_MM } from '../page/types.js';
import { ptFromMm } from './units.js';

/**
 * A colour, as six hexadecimal digits behind a hash: `#1b3a6f`.
 *
 * ## This alias is DOCUMENTATION. It forbids nothing, and that is measured
 *
 * `const notAColour: Color = 'Total TTC'` compiles. So does `''`, so does `'EB Garamond'`
 * passed where a colour is expected -- MEASURED at exit 0, five misuses, none refused. The
 * entire guarantee is {@link ColorSchema} at runtime. Written that way the alias is honest;
 * left unsaid it advertises a guard that does not exist, which is the reproach this lot levels
 * at a type called `ResolvedTypography` that resolved nothing.
 *
 * A BRANDED type would make it real, and it is refused for a mechanical reason rather than a
 * stylistic one: constructing a branded value takes an assertion, and AGENTS.md 1.1 forbids
 * both spellings of one (`as unknown as`, and the angle-bracket form the linter cannot even
 * see).
 *
 * ## The six digits are interpreted in sRGB, and the contract SAYS so
 *
 * `#1b3a6f` is a triplet of bytes; it is not a COLOUR until it is referred to a colour space.
 * A PDF engine may write `DeviceRGB` (whose interpretation is left to the reader), an ICC sRGB
 * profile, or convert to CMYK; a browser viewer renders sRGB. That is three colours for one
 * triplet, in a product whose decision 7 promises identity and whose `docs/qa/README.md`
 * hardens it to "to the pixel". MEASURED: `git grep -niE "srgb|color space|cmyk"` over
 * `packages apps docs` yields ZERO occurrences, so this contract is the first place the
 * question can be settled -- and it settles it by TAKING the convention, exactly as it takes
 * the millimetre.
 *
 * ## Both cases, no short form, no alpha channel
 *
 * `#FFAA00` and `#ffaa00` are both accepted, because `#FFAA00` is what every design tool
 * emits and refusing the most ordinary copy-paste of the trade is hostile. This CONTRADICTS a
 * precedent of this repository and the contradiction is named rather than hidden:
 * `page/types.ts` refuses `margins: 20` beside four edges as "a second spelling of one fact".
 * The difference is measurable -- a shorthand and a quadruplet are two shapes a consumer must
 * NORMALISE, whereas two letter cases are one shape read by one regular expression, with no
 * expansion. `#fa0` would need an expansion: refused.
 *
 * WHAT THE DOUBLE CASE COSTS, and a consumer has to know it: an EQUALITY COMPARISON between
 * `#FFAA00` and `#ffaa00` fails. Sixty-four spellings are storable for a six-digit alphabetic
 * colour (2^6, measured), so an editor that highlights "every block of the same colour", or a
 * V3 parity check, FOLDS THE CASE before comparing. Nothing in this contract folds it for
 * them, because normalising on parse would rewrite the author's document.
 *
 * No alpha channel: `#1b3a6fff` is refused (measured), and the reason is ownership rather than
 * taste. COMPOSITION is a rendering model, hence the layers of lot C11 / decision 10. A
 * refusal nobody wrote down is a refusal that reopens with the first client.
 */
export type Color = string;

/**
 * The form of the characters. Five declarations, all optional, none of them content.
 *
 * ## Why five fields and not six, and where the sixth went
 *
 * `core.md` lists ten attributes in six groups; this type carries five of them -- "polices et
 * tailles", "graisse et italique", "couleurs de texte". What is NOT here and would look like
 * it belongs: a LINE HEIGHT (a line has a height only once it has a font, hence font metrics,
 * hence reading the machine -- and it is the field the two-decimal trap really bites, `1.15`
 * measured), a LETTER SPACING (same argument, and measured: the word appears nowhere in this
 * repository, so no text promises it), a FALLBACK STACK (a fallback is a POLICY, lot E6's),
 * and a `textTransform` (it changes the CHARACTERS a reader reads, and the algebra already
 * carries `textCase` -- two spellings of one fact).
 *
 * ## Why `bold` is a boolean and not a numeric scale
 *
 * MEASURED, on the numeric window a previous draft of this contract proposed: `int().min(100)
 * .max(900)` admits 801 values, 792 of them not multiples of 100, and `weight: 450` is
 * ACCEPTED. A font carries a FINITE, DISCRETE set of faces; `450` designates none of them, so
 * honouring it obliges an engine to CHOOSE -- nearest face? the one below? synthetic
 * emboldening? -- and that choice is a policy this contract does not state. Two engines that
 * choose differently produce two documents, against decision 7. A boolean is what the roadmap
 * literally writes, "graisse et italique" side by side, two symmetrical booleans; and widening
 * to a scale later is a WIDENED UNION, hence a stamp, which is the cheapest class of change.
 *
 * ## Why all five are optional, and what that costs
 *
 * Because nothing else in this contract decides them: there is no cascade, no document
 * baseline and no schema default [D12]. `resolveTypography` therefore returns five
 * `T | undefined`, and WHO decides the missing five is an expectation named in ADR 0007 --
 * never in a docstring, which is the mistake lot C3 had to undo in its own.
 *
 * ## `{}` is REFUSED, and the canonical spelling of "no typography" is the absent field
 *
 * The schema carries `.refine(o => Object.values(o).some(v => v !== undefined), 'An empty style
 * object is not a style; omit the field')`, and so do {@link BoxStyle} and {@link BoxBorder}.
 *
 * An earlier draft accepted `{}` and declared it "equivalent to absence", on the ground that
 * `typography?.family` yields `undefined` either way. That is true OF A VALUE READ and false of
 * everything else: a diff reports a change where nothing changed, a dirty-state flag marks a
 * document an author only looked at, a content hash gives one document two fingerprints, an
 * undo/redo history records a Command that did nothing, and `JSON.stringify` keeps `{}` while
 * dropping `undefined` -- so two "equal" trees are not equal. Four of those five consumers are
 * already planned, and NOT ONE OF THEM READS A VALUE.
 *
 * This is the rule `page/types.ts` states for its band lists, applied here: "an empty list and
 * an absent list would be two spellings of one fact: two shapes to store, two refusal paths,
 * and a consumer that starts by normalising". That file removes the second spelling by making
 * the field REQUIRED; this one cannot, so it removes it by refusing it. The normalising stays,
 * but it moves to the PRODUCER -- an editor drops a `box` it emptied -- and one producer that
 * normalises beats N consumers that do.
 *
 * ⚠️ The predicate is on VALUES and not on `Object.keys`. Under
 * `exactOptionalPropertyTypes` an in-memory object can carry `{ family: undefined }`: the key
 * is there, the value is not, and `Object.keys` counts one. That would be a THIRD spelling,
 * introduced by the very guard meant to leave one.
 */
export interface Typography {
  /**
   * A family name, and this contract stores NOTHING ELSE -- not a stack, not a URL, not a
   * metric.
   *
   * It is the ONE named exception to this lot's membership criterion: an engine cannot honour
   * it without resolving a resource, which is measuring. It enters anyway on two mechanical
   * arguments -- `core.md` puts "polices" at the head of this lot's scope, and the boundary is
   * already drawn INSIDE the subject by `engine.md`, which distinguishes DESIGNATING a
   * resource from LOADING it. This contract designates.
   *
   * ## The hazard, recorded rather than hidden
   *
   * A family name is a DECLARATION, and this contract does not police what the name resolves
   * to. MEASURED, ten values that `min(1)` accepts and that name no font at all but whatever
   * THE HOST MACHINE has installed: `system-ui`, the five CSS generic families (`serif`,
   * `sans-serif`, `monospace`, `cursive`, `fantasy`), `-apple-system`,
   * `BlinkMacSystemFont`, `ui-rounded`, `emoji`, `math`, `fangsong`. A template storing one of
   * them renders differently on two machines -- which is what lot E6 forbids and what lot E8
   * must bound.
   *
   * The schema does not refuse them, and that is a decision with a reason: refusing the string
   * `serif` would refuse a font genuinely called "Serif", and refusing a LIST of values would
   * freeze a blacklist of CSS conventions inside a contract that publishes none. So the hazard
   * is written here -- the one place an integrator reads -- and named as a debt in ADR 0007,
   * which is the treatment `TABLE_COLUMN_ALIGNMENTS` already gives to writing direction.
   */
  readonly family?: string | undefined;
  /**
   * A size in POINTS, and the field carries its unit because it is the exception.
   *
   * Points and not millimetres, and the argument that refused points for a MARGIN does not
   * transpose: ADR 0006 discarded them as "illisibles pour l'auteur (« marge de 57 points »)",
   * and "a 10 point font" is the most legible form that exists for a size -- it is the only
   * unit an invoice author uses spontaneously. MEASURED, 10 pt is NOT representable in
   * millimetres: `mmFromPt(10)` is `3.5277777777777777`. The point is also the unit of PDF
   * user space, so a size crosses the engine without conversion.
   *
   * The window is [{@link MIN_FONT_SIZE_PT}, {@link MAX_FONT_SIZE_PT}] and there is NO
   * decimal-place bound, on the precedent `page/schemas.ts` applies rather than argues:
   * finiteness and two bounds suffice, `z.number()` already refusing `NaN` and `Infinity`.
   * ADR 0006 warns the next lot that "la même formule paraîtra tentante en C5 pour une taille
   * de police" -- the warning is right in principle and WRONG in its example, measured: of the
   * half-points from 6 to 72 pt, `Number.isInteger(v * 100)` refuses NONE. It bites a RULE
   * WIDTH of 0.28 mm, which is 0.8 pt, a standard editorial thickness.
   */
  readonly sizePt?: number | undefined;
  /** The bold face of the declared family. See the type docstring for why this is not a scale. */
  readonly bold?: boolean | undefined;
  /** The italic face. Symmetrical with `bold`, which is how the roadmap words the pair. */
  readonly italic?: boolean | undefined;
  /** The colour of the characters. Six hexadecimal digits in sRGB -- see {@link Color}. */
  readonly color?: Color | undefined;
}

/**
 * One edge of a box border: a thickness and a colour, both required.
 *
 * Both required, because an edge with no colour is not a lighter declaration, it is an
 * incomplete one -- the engine would have to invent the colour, and inventing is what this
 * contract pushes out of render files. Absence is spelt by the edge not being there at all,
 * which is what makes the four fields of {@link BoxBorder} optional.
 *
 * ## `gt(0)` and NOT `min(0)` -- a CANONICAL FORM rule, not a rule of typography
 *
 * A zero thickness would be a SECOND SPELLING of "no rule", and the first one already exists:
 * the edge not being there. So the schema is
 * `gt(0, 'A rule has a positive width; omit the edge to declare no rule')`, and the message
 * carries its own remedy.
 *
 * The precedent that seems to forbid this does NOT transpose, and the reason is one line above
 * it in `page/types.ts`: "The four edges, in millimetres, ALL FOUR REQUIRED." A margin cannot
 * be absent, so `top: 0` is the ONLY way to write "no margin at the top", and refusing it would
 * indeed "be a rule of typography" -- it would forbid a legitimate document. {@link BoxBorder}
 * has the opposite shape: its four edges are OPTIONAL. The precedent says "do not refuse the
 * only available spelling"; here it is not the only one.
 *
 * The second objection to `gt(0)` -- "it admits 0.0001 mm, and MEASURED, `5e-324` passes" --
 * does not discriminate, and an earlier draft of this contract used it to settle a question it
 * does not answer. `min(0)` ADMITS 0.0001 mm too. That objection opposes `> 0` to `>= 1`, which
 * is the `MIN_SHEET_MM` question, and says nothing about `> 0` against `>= 0`. Sub-pixel widths
 * stay representable here as they do on the six other lengths of this contract: this contract
 * bounds WINDOWS, it does not judge the usefulness of a value inside one.
 *
 * A NAMED floor -- `MIN_RULE_WIDTH_MM` -- was the other defensible way out, on the
 * representability argument: one screen pixel at 96 dpi is 0.26458 mm, one press pixel at
 * 300 dpi is 0.08467 mm, so a rule below that is not a rule. It is refused twice over. 96 dpi
 * is a property of the MACHINE, not of the document, so the bound would be an environment read
 * disguised as a constant; and ADR 0006 already discarded a bound that "ne se justifie par
 * aucune mesure".
 *
 * Refusing this today is VACUOUS -- no stored document carries a border edge yet, because the
 * field is born in this lot. Refusing it after the stamp would be a non-vacuous narrowing, i.e.
 * impossible. The question is settled now or never.
 */
export interface BorderEdge {
  readonly width: number;
  readonly color: Color;
}

/**
 * The four edges of a box border, EACH OPTIONAL -- unlike {@link BoxSpacing}.
 *
 * The asymmetry is deliberate and it is the difference between a rule and a length. One edge
 * alone is a RULE ("a line under the total"), which is the most ordinary thing an invoice
 * draws; four edges are a BORDER. A quadruplet of required edges would make a single rule cost
 * three zero-width edges plus three colours nobody chose. A spacing has no such use: a padding
 * with three edges is an author who forgot one, which is why that type requires all four.
 *
 * `{}` is REFUSED, for the reason {@link Typography} states: the absent field is the one
 * spelling of "no border", and a second one costs a diff, a hash and an undo.
 *
 * ## The measured hole this shape opens, and the only net that closes it
 *
 * Because all four are optional, AN ENTIRE EDGE CAN VANISH FROM THE SCHEMA WITHOUT ONE
 * COMPILER DIAGNOSTIC. MEASURED, `top` removed from `BoxBorderSchema`: all nine type
 * assertions of an earlier draft passed, exit 0, and at runtime the top rule was silently
 * dropped by the parse. The amputated object stays mutually assignable, and `keyof BoxStyle`
 * does not move because `border` is still there. Coverage catches nothing either -- a field
 * absent from the schema is not an uncovered branch, it is a branch that does not exist.
 *
 * The remedy is the one `ast/schemas.ts` already writes twice: "Only a runtime parsing test
 * catches that, and that is why there is one per node type." Read here: ONE PER STYLE FIELD.
 */
export interface BoxBorder {
  readonly top?: BorderEdge | undefined;
  readonly right?: BorderEdge | undefined;
  readonly bottom?: BorderEdge | undefined;
  readonly left?: BorderEdge | undefined;
}

/**
 * Four lengths in millimetres, ALL FOUR REQUIRED, on the exact shape `page/types.ts` imposes.
 *
 * That file states the rule and this lot reproduces it trait for trait, floor of zero
 * included, unsuffixed field names included: "No shorthand (`margins: 20`), no pair
 * (`{ vertical, horizontal }`), no inheritance: a second spelling of one fact means two stored
 * shapes, two refusal paths and a `printableAreaOf` that starts by normalising."
 *
 * Diverging here would have cost more than a convention: `BoxSpacing.topMm` beside
 * `PageMargins.top` would be two names for one kind of fact in one contract.
 */
export interface BoxSpacing {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/**
 * What a box declares about itself: a background, four border edges, an inner inset.
 *
 * ## Three fields, and the criterion says why there are exactly three
 *
 * A declaration belongs on a box if and only if: (1) it is BLIND TO CONTENT; (2) it changes
 * only what a reader SEES, never the CHARACTERS he reads; (3) an engine can honour it without
 * MEASURING and without INVENTING a policy; (4) ITS VALUE HAS A MEANING ON EVERY CARRIER THE
 * CONTRACT ALLOWS IT ON. Background, border and padding pass all four on all five carriers.
 *
 * Condition 4 is the one that did the work here, and two fields fell to it:
 *
 * - `gap` is OUT. It has no subject at all on an `image` (no children), it means inter-letter
 *   spacing on a `text` (whose children are inline runs), and on a `table` or a `tableRow` it
 *   means `border-spacing` -- a table layout model. Worse than empty: it would insert into the
 *   PUBLISHED definition of `TableColumn.width` ("A column receives `width / (sum of the
 *   widths of its table)` of whatever width the table itself is given") a subtraction that
 *   formula does not have. This lot cannot obtain by a side door what the column criterion
 *   refuses it to its face.
 * - `align` is OUT, and it lives on `TextNode` alone. It describes how INLINE RUNS sit in a
 *   box, and only a text node has runs. Leaving it here made four of the five carriers
 *   meaningless AND left `TableColumn.align` with a rival and no rule of precedence.
 *
 * `margin` is not here either, and that one is a REFUSAL WITH A COST rather than an empty
 * state: two adjacent margins either add up or collapse -- CSS collapses, several PDF engines
 * add -- and CHOOSING is a rendering policy, condition 3. This contract could TAKE the
 * convention, as it takes sRGB, but it would then owe the sum in writing. Without it, a
 * non-uniform vertical rhythm costs one `ContainerNode` per amount of air, counted by
 * `assertBoundedShape`.
 *
 * ## What is NOT expressible through this type, and who owns each refusal
 *
 * No opacity, no shadow, no gradient -- a composition model, hence the layers of lot C11 /
 * decision 10. No `border-collapse` -- a table layout model. No width and no height, on ANY
 * node: this lot declares no dimension anywhere, which is what keeps `printableAreaOf` the
 * only geometry of the contract. No page background, watermark or paper colour -- ADR 0006
 * ranges those under layers, and the same ADR attributing "la couleur du papier" to this lot
 * elsewhere is a contradiction ADR 0007 records.
 *
 * `{}` is REFUSED, for the reason {@link Typography} states. An editor that opens a style panel
 * and sets nothing legitimately BUILDS a `box: {}`; what it must not do is SAVE one, and
 * dropping it is one line in the producer against four broken consumers downstream.
 *
 * ## What a `padding` means on each of the five carriers -- written, because a stored value
 * whose meaning is not stated is not a contract
 *
 * A box is its given width, less `padding.left + padding.right`; that remainder is its CONTENT
 * WIDTH, and a child occupies it. Two carriers need this spelt out because a table has a
 * published width formula and this field could silently change it:
 *
 * - on a `table`, the column weights resolve against the table's CONTENT width. This completes
 *   `TableColumn.width`'s "of whatever width the table itself is given" rather than
 *   contradicting it: what the table is given is its parent's content width; what it shares is
 *   its own;
 * - on a `tableRow`, the padding insets THE CONTENT OF EACH CELL of that row, identically, and
 *   MOVES NO COLUMN BOUNDARY. Insetting the band instead would shift, for that row alone, the
 *   origin and width the weights resolve against, so the heading columns would no longer line
 *   up with the body's -- the exact defect this lot exists to prevent. It is also the argument
 *   that removed `gap` from this carrier, and it does not care which name the field has.
 */
export interface BoxStyle {
  readonly background?: Color | undefined;
  readonly border?: BoxBorder | undefined;
  readonly padding?: BoxSpacing | undefined;
}

/**
 * The floor of the font-size window, and it is `MIN_SHEET_MM`'s argument transposed.
 *
 * A size of zero is not "no text": the characters are still declared, and they would be stored
 * and never shown -- a silent loss, which is what `ast/schemas.ts` refuses for a cell naming
 * an undeclared column. So zero is refused here, where a zero BORDER WIDTH is accepted: an
 * absent rule is a legitimate intent, absent characters are not. And `> 0` would admit
 * `5e-324`, which is the written reason `MIN_SHEET_MM` is `min(1)`.
 *
 * The value is borrowed from that constant along with its reason, not invented here.
 */
export const MIN_FONT_SIZE_PT = 1;

/**
 * The ceiling of the font-size window: `MAX_SHEET_MM` EXPRESSED IN POINTS, and DERIVED from it.
 *
 * ## Why derived and not written down
 *
 * MEASURED, in both directions and in binary64: `5080 * 72 / 25.4` is exactly `14400`, and
 * `14400 * 25.4 / 72 === 5080` is `true`. So the ceiling of this lot IS the interoperability
 * bound of lot C4, in the other unit -- not a different bound that happens to coincide. An
 * earlier draft of this contract declared `MAX_STYLE_LENGTH_MM = 5080`, which is
 * `MAX_SHEET_MM` under a second name with no link between them.
 *
 * `template/guard.ts` already wrote the rule this repository follows: "The same schema and the
 * same ceiling as `EvaluationLimits`, IMPORTED RATHER THAN RESTATED: two copies of one bound
 * drift, and raising it in one file would leave the other refusing values the first accepts."
 * Three copies of one maximum length is drift guaranteed at the first adjustment.
 *
 * A test pins BOTH halves -- `MAX_FONT_SIZE_PT === 14_400` and
 * `mmFromPt(MAX_FONT_SIZE_PT) === MAX_SHEET_MM`. Pinning an exact number here is a service and
 * not a redundancy: it is what stops someone from "tidying" the conversion into the
 * pre-computed factor, which yields `5079.999999999999`.
 *
 * ## ⚠️ Why this file imports `../page/types.js` and NOT the `page/page.js` barrel
 *
 * `page/page.ts` asks consumers to come through the barrel. This import does not, and the
 * reason is a MEASURED ESM initialisation failure rather than a preference. `ast/schemas.ts`
 * imports the style schemas as VALUES; the style schemas need this bound at module-evaluation
 * time; and the barrel pulls in `page/schemas.js`, which imports `ContainerNodeSchema` from
 * `ast/schemas.js` -- the module the chain started in. MEASURED, on the emitted JavaScript:
 *
 *     ReferenceError: Cannot access 'ContainerNodeSchema' before initialization
 *
 * `page/types.js` has NO runtime import of its own -- its only import is a type -- so it can
 * never close a cycle. This is exactly the configuration `page/page.ts` warns about in its own
 * docstring, "which is the configuration where ESM initialisation order starts to matter",
 * arriving from the other side. ADR 0007 records the deviation with this measurement.
 */
export const MAX_FONT_SIZE_PT = ptFromMm(MAX_SHEET_MM);
```

#### Ce que ce fichier force à la compilation, et ce qui reste silencieux

| Fait | Porte |
| :--- | :--- |
| `MAX_FONT_SIZE_PT` inférée `number` et non `14400` — donc utilisable dans `.max()` et dans un gabarit de message | porte 3, silencieux (c'est voulu) |
| L'égalité `MAX_FONT_SIZE_PT === 14_400` | **aucune porte** — c'est [§3.11] qui l'épingle, et c'est pour ça qu'il l'épingle |
| L'import par le barrel `page/page.js` à la place de `page/types.js` | **exit 0 aux portes 2 et 3, casse à la porte 4** — mesuré, `§C.2` |
| `Color = string` employé pour une chaîne quelconque | **aucune porte**, mesuré exit 0 sur cinq mésusages. La garantie est entièrement à l'exécution |
| Un champ retiré de `Typography` **ou** de `BoxStyle` sans l'être du schéma | **porte 3**, mais seulement grâce aux paires de [§3.11] |

**Cinq points de rédaction qui ne sont pas des détails.**

1. **`MIN_FONT_WEIGHT` / `MAX_FONT_WEIGHT` / `STANDARD_FONT_WEIGHTS` / `StandardFontWeightName`
   n'existent pas.** Le contrat reconstruit portait quatre symboles pour une graisse ; l'arbitrage
   ⛔ n° 2 recommande `bold?: boolean`, et la table nommait une **convention CSS** là où
   `STANDARD_SHEETS_MM` nomme un **fait ISO** — sans aucun consommateur mesuré.
2. **`MAX_STYLE_LENGTH_MM` n'existe pas** : `MAX_SHEET_MM` est **importé**, dans `types.ts` **et**
   dans `schemas.ts` [§3.3].
3. **`ResolvedTypography` n'existe pas**, et son absence est écrite dans la docstring de
   `resolveTypography` [§3.4] plutôt qu'ici — un type absent ne se documente pas à sa place.
4. **`BOX_ALIGNMENTS` n'existe pas** : le tuple d'alignement de texte s'appelle `TEXT_ALIGNMENTS`, il vit dans `ast/types.ts` à côté de celui dont il dérive, et **pas** dans ce dossier [§3.6].
5. **Aucun `gap`, aucun `margin`, aucune `width`, aucune `height`, aucun `lineHeight`, aucun
   `letterSpacing`, aucun `verticalAlign`, aucune `opacity`.** Les refus sont **écrits** dans la
   docstring de `BoxStyle` avec le lot propriétaire de chacun — un refus non écrit se rouvre au
   premier client.

---

### 3.2 `packages/core/src/style/units.ts` — **nouveau**

**Compilé à exit 0 dans le bac à sable.** Le précédent de forme est `page/area.ts` : une fonction
de calcul vit dans son propre fichier, pas dans `types.ts`.

```ts
/**
 * The ONE spelling of the conversion between the two units of this contract.
 *
 * This lot stores lengths in two units, and it says so in the field names: a font size is in
 * POINTS and its field is `sizePt`, every other length is in MILLIMETRES and its field carries
 * no suffix, because the millimetre is this contract's default unit since lot C4. Two units
 * oblige SOMEBODY to convert, and the conversion is not associative in binary64. MEASURED,
 * over the integer point sizes of the window this lot admits:
 *
 *     (14400 * 25.4) / 72   ->  5080                  === MAX_SHEET_MM
 *     14400 * (25.4 / 72)   ->  5079.999999999999     NOT MAX_SHEET_MM
 *     15 pt: (v * 25.4) / 72 -> 5.291666666666667
 *            v * (25.4 / 72) -> 5.291666666666666
 *
 * 4 538 of the 14 400 integer sizes -- 31.5 % -- yield a DIFFERENT double under the second
 * spelling than under the first. Counting four spellings instead of two, 8 774 of 14 400
 * (60.9 %) disagree with at least one other. Either figure is exact; what is NOT exact is
 * citing one without saying how many spellings it compares.
 *
 * ## Why exported, and it is the `printableAreaOf` argument -- here and NOT on the resolvers
 *
 * `page/area.ts` states it: decision 7 of the roadmap promises a preview IDENTICAL to the PDF,
 * and "two implementations that write the subtraction differently get different doubles". A
 * multiplication followed by a division has exactly that hazard, so the agreement has to be a
 * DEPENDENCY rather than a coincidence. The resolvers of ./resolve.ts are exported for a
 * different reason and must not borrow this one: `a ?? b` has no floating-point representation
 * at all, so two implementations of it cannot diverge.
 *
 * ## The retained form, and it is a property rather than a preference
 *
 * MULTIPLY FIRST, THEN DIVIDE. It is the only one of the four that carries the ceiling of this
 * contract back and forth exactly: `ptFromMm(5080) === 14400` and `mmFromPt(14400) === 5080`
 * are both true, so `MAX_FONT_SIZE_PT` can be DERIVED from `MAX_SHEET_MM` instead of restated
 * (see ./types.ts). Pre-computing the factor breaks that in both directions -- measured above,
 * and `mm * (72 / 25.4)` yields `14400.000000000002`.
 *
 * ## What these two functions do NOT promise, and a consumer has to know it
 *
 * THEY ARE NOT INVERSES. MEASURED: `ptFromMm(mmFromPt(v)) !== v` for 223 of the first 1 000
 * integer point sizes -- 3, 6, 12, 23, 24, 29 among them. So a consumer converts ONCE, in the
 * direction its renderer needs, and never round-trips a stored value: a viewer that goes to
 * millimetres for layout and back to points for a PDF has already lost the author's number.
 * Store points, convert at the boundary, never convert back.
 */
export function mmFromPt(pt: number): number {
  return (pt * 25.4) / 72;
}

export function ptFromMm(mm: number): number {
  return (mm * 72) / 25.4;
}
```

#### Ce que ce fichier force, et ce qui reste silencieux

| Fait | Porte |
| :--- | :--- |
| Aucun paramètre implicite, aucun retour implicite | porte 3 |
| **Réécrire le corps en facteur pré-calculé** (`pt * K`) | **aucune porte** — le type ne change pas. Ce sont les **deux `it`** de [§3.11] qui rougissent : l'égalité `MAX_FONT_SIZE_PT === 14_400` et `mmFromPt(14400) === MAX_SHEET_MM` |
| Un consommateur qui fait un aller-retour | **aucune porte, jamais.** C'est une phrase de docstring, et un `it` qui épingle `ptFromMm(mmFromPt(3)) !== 3` |

> ⚠️ **Désaccord de chiffre avec `relecture adverse « périmètre » §10`, et il faut le porter.** Le « **60,9 %**
> des tailles entières » de `atk1.mjs` compte les tailles où **au moins deux formes sur quatre**
> divergent (`v*(25.4/72)`, `v*25.4/72`, `(v/72)*25.4`, `v*25.4*(1/72)`). La divergence entre
> **la forme retenue et la seule qu'un relecteur écrirait spontanément** est de **31,5 %**
> (4 538 / 14 400), mesurée ici. Les deux chiffres sont exacts ; **le plan cite les deux avec
> leur définition**, parce que « 60,9 % » seul suggère que deux formes sur deux divergent, ce qui
> est faux.

---

### 3.3 `packages/core/src/style/schemas.ts` — **nouveau**

**Compilé à exit 0 dans le bac à sable**, et les 26 refus qu'il produit sont **rejoués** en
`§C.4`.

```ts
import { z } from 'zod/v4';
// `../page/types.js` and NOT the `page/page.js` barrel, for the measured ESM reason
// {@link MAX_FONT_SIZE_PT} records: `ast/schemas.ts` imports this file as a VALUE, and the
// barrel closes a cycle back into it. `page/types.js` has no runtime import of its own.
import { MAX_SHEET_MM } from '../page/types.js';
import { MAX_FONT_SIZE_PT, MIN_FONT_SIZE_PT } from './types.js';

/**
 * The Zod side of the appearance contract.
 *
 * ## ⚠️ NO SCHEMA IN THIS FILE CARRIES A `z.ZodType<T>` ANNOTATION. Do not add one
 *
 * The obligatory pattern of AGENTS.md 1.2 targets the RECURSIVE AST, and only it. None of
 * these schemas is recursive, so an annotation buys nothing -- and MEASURED, twice and
 * independently, it DESTROYS the only compile-time guard this lot has: annotating
 * `TypographySchema: z.ZodType<Typography>` AND amputating `italic` from the object compiles at
 * EXIT 0. Every key assertion passes, `keyof` included, because `z.infer` of an annotated
 * schema yields the ANNOTATION, so `keyof z.infer<typeof S>` IS `keyof T` by construction.
 *
 * `ast/schemas.ts` already writes the same warning for `TextSegmentSchema`, from the other end:
 * "`z.ZodType` is covariant in its output, so a schema that produces LESS than `TextSegment`
 * stays assignable and still compiles."
 *
 * The real guard is the pair of assertions per shape in `style/__tests__/style.test.ts`, plus
 * one runtime round trip per style field. NOT in this file: an assertion living in `src/` is
 * shipped in `dist`, becomes a compatibility commitment, and inflates the coverage metric --
 * `export const X = true` is a covered statement for zero runtime assertion, which is
 * literally the tautological test AGENTS.md 5 forbids.
 *
 * ## `z.object` and not `z.strictObject`, with the price named
 *
 * An unknown key is STRIPPED, not refused. MEASURED, that is what makes a version stamp the
 * only protection against silent loss ACROSS versions -- and it leaves the loss WITHIN a
 * version unprotected, which is the price. `z.strictObject` was measured and refused for a
 * reason lot C8 would have paid: its refusal reports `path: []`, so the offending key is only
 * in `keys` and in the message, and a catalogue of errors built on paths could not point at it.
 *
 * ## Every refusal here is decidable at SAVE TIME and WITHOUT DATA
 *
 * A malformed colour, a size out of window, a negative length, an edge with no colour, an
 * incomplete padding, an empty style object: none of them needs a render or a dataset. So this
 * lot adds NO entry to `errors.ts` -- no new code and no new site -- which is the line lot C4
 * held for the same reason. `ast/schemas.ts` states it for a column: "it is refused when the
 * template is SAVED and adds no entry to the error catalogue lot C8 enumerates."
 *
 * The three `.refine` calls below do not breach that line: they yield `code: 'custom'`, which is
 * not an entry in `SHAPE_ERROR_CODES`. They are also NOT `superRefine`s and NOT cross-field --
 * each looks at ONE object and never at a sibling or an ancestor.
 *
 * The counterpart, said rather than hidden: THIS CONTRACT CARRIES ZERO CROSS-FIELD INVARIANT,
 * where lot C4 carried two. Refusing a non-canonical FORM is not checking a coherence BETWEEN
 * fields, so its refusal surface stays weaker than C4's. That is not a virtue, it is a
 * consequence of every field being optional, and ADR 0007 records it.
 */
export const ColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'A colour is six hexadecimal digits behind a hash, as #1b3a6f');

/**
 * Any length of this lot WHOSE ABSENCE IS NOT REPRESENTABLE, in millimetres: floor of zero,
 * ceiling shared with the sheet. In practice, the four edges of a {@link BoxSpacing}.
 *
 * The floor mirrors `marginLengthSchema` exactly -- `min(0)`, not `gt(0)` -- and for the same
 * reason: those four edges are REQUIRED, so `0` is the one spelling of "no inset", and refusing
 * it would forbid a legitimate document. {@link BorderEdgeSchema} does not use this schema, and
 * the asymmetry is the whole point: its edges are OPTIONAL, so absence is already a spelling
 * there and `0` would be a second one.
 *
 * The ceiling is `MAX_SHEET_MM`, IMPORTED. A padding larger than any sheet this product admits
 * is refused by the same number that refuses the sheet, and raising one raises both.
 *
 * Not exported: it is an internal spelling, and exporting it would publish a fourth length
 * vocabulary beside `sheetLengthSchema`, `marginLengthSchema` and the column weight.
 */
const styleLengthMmSchema = z
  .number()
  .min(0, 'A length cannot be negative')
  .max(MAX_SHEET_MM, `A length is at most ${MAX_SHEET_MM} mm`);

/**
 * `family` is `min(1)` and nothing more, and the reason is in {@link Typography.family}:
 * refusing the string `serif` would refuse a font genuinely called "Serif".
 *
 * `sizePt` carries no decimal-place check, on the precedent `page/schemas.ts` applies:
 * finiteness and two bounds suffice. `z.number()` refuses `NaN` and `Infinity` on its own, so a
 * `.finite()` check would never fire -- but the MESSAGE it yields for `Infinity` is
 * "Invalid input: expected number, received number", which is unusable. Six numeric positions
 * of this lot inherit that defect (`sizePt`, the four edges of a spacing, the width of a border
 * edge); it is a reserve already booked to lot C8 by ADR 0006, and this lot COUNTS its sites
 * rather than pointing at the precedent.
 */
export const TypographySchema = z
  .object({
    family: z.string().min(1, 'A font family name is required').optional(),
    sizePt: z
      .number()
      .min(MIN_FONT_SIZE_PT, `A font size is at least ${MIN_FONT_SIZE_PT} pt`)
      .max(MAX_FONT_SIZE_PT, `A font size is at most ${MAX_FONT_SIZE_PT} pt`)
      .optional(),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    color: ColorSchema.optional(),
  })
  .refine(isNotEmptyStyle, EMPTY_STYLE_MESSAGE);

/**
 * `width` is `gt(0)` and NOT `min(0)`: an absent edge is the one spelling of "no rule", and a
 * zero thickness would be a second. The message carries its remedy. See {@link BorderEdge} for
 * why the `PageMargins` precedent -- whose four edges are REQUIRED -- does not transpose.
 *
 * `color` is required for the reason {@link BorderEdge} states: an edge with no colour is not a
 * lighter declaration, it is an incomplete one.
 */
export const BorderEdgeSchema = z.object({
  width: z
    .number()
    .gt(0, 'A rule has a positive width; omit the edge to declare no rule')
    .max(MAX_SHEET_MM, `A length is at most ${MAX_SHEET_MM} mm`),
  color: ColorSchema,
});

export const BoxBorderSchema = z
  .object({
    top: BorderEdgeSchema.optional(),
    right: BorderEdgeSchema.optional(),
    bottom: BorderEdgeSchema.optional(),
    left: BorderEdgeSchema.optional(),
  })
  .refine(isNotEmptyStyle, EMPTY_STYLE_MESSAGE);

/** All four required, so `0` IS the one spelling of "no inset" here -- see {@link BoxSpacing}. */
export const BoxSpacingSchema = z.object({
  top: styleLengthMmSchema,
  right: styleLengthMmSchema,
  bottom: styleLengthMmSchema,
  left: styleLengthMmSchema,
});

export const BoxStyleSchema = z
  .object({
    background: ColorSchema.optional(),
    border: BoxBorderSchema.optional(),
    padding: BoxSpacingSchema.optional(),
  })
  .refine(isNotEmptyStyle, EMPTY_STYLE_MESSAGE);
```

**Et le prédicat partagé, déclaré AVANT `ColorSchema`** — une seule orthographe de la forme
canonique, pour la raison que [D6] applique à la conversion :

```ts
/**
 * True when a style object declares at least one thing. The one spelling of "not empty".
 *
 * ⚠️ ON VALUES, NOT ON `Object.keys`. Under `exactOptionalPropertyTypes` an in-memory object can
 * carry `{ background: undefined }`: the key is present, the value is not, and a key count
 * yields one. That would be a THIRD spelling of "no style", introduced by the guard that exists
 * to leave one. A JSON round trip erases the difference -- `JSON.stringify` drops `undefined` --
 * but an editor comparing objects it built itself never goes through JSON.
 *
 * `unknown` and a narrowing read rather than a typed parameter: this runs on the OUTPUT of three
 * different object schemas, and `Object.values` is all it needs.
 */
const isNotEmptyStyle = (value: object): boolean =>
  Object.values(value).some((entry) => entry !== undefined);

const EMPTY_STYLE_MESSAGE = 'An empty style object is not a style; omit the field';
```

> ⚠️ **Le `.refine` porte sur l'OBJET, et c'est la fragilité `S-6`, nommée plutôt que découverte.**
> Un check d'objet **ne survit ni à `.extend()` ni à `.pick()`** en zod 4, mesuré. Aucun des trois
> schémas n'est étendu ni découpé dans ce lot — et **c'est désormais une contrainte de rédaction** :
> la sonde 13 de [§6.4] la vérifie, et un lot ultérieur qui écrirait `BoxStyleSchema.extend({…})`
> perdrait le garde **en silence**.
>
> **Et il ne change ni `SHAPE_ERROR_CODES` ni le catalogue de C8** : un `.refine` rend
> `code: 'custom'` avec un `path` qui pointe le champ. C'est la ligne de [D15], et elle tient.

#### Ce que ce fichier force, et ce qui reste silencieux

| Fait | Porte |
| :--- | :--- |
| Un `z.enum` élargi sans étendre un `Record` sur l'union | porte 3 (pas de `Record` ici) |
| **Annoter un schéma `z.ZodType<T>` ET amputer un champ** | **exit 0** — mesuré deux fois. La docstring est la seule protection, et c'est écrit |
| **Retirer une arête entière de `BoxBorderSchema`** | **exit 0** aux dix assertions — mesuré. Seul l'aller-retour de [§3.11] l'attrape |
| **Retirer `styleLengthMmSchema` du plafond** (`.max` supprimé) | **aucune porte** — c'est `N23` (`padding.top 5081`) qui rougit |
| Ajouter `gap` ou `align` à `BoxStyleSchema` | **aucune porte**, et **aucun test** : `N25` et `N26` mesurent que `{ gap: 5 }` et `{ align: 'start' }` sont **ACCEPTÉS et SILENCIEUSEMENT DÉPOUILLÉS** par `z.object`. C'est le prix de la perte intra-version, chiffré |

> ⚠️ **Un piège de forme, mesuré par `S-6` et **évité par construction** :** `.extend()`,
> `.omit()`, `.pick()` et `.partial()` **réinitialisent** les checks d'un objet zod 4. Ce fichier
> ne porte **aucun** check d'objet — zéro `superRefine`, zéro `refine` — donc il ne rencontre pas
> le piège. Ce n'est **pas une vertu** : c'est le signalement N, la surface de refus de C5 est
> strictement plus faible que celle de C4. Si un arbitrage introduit un invariant, il se pose
> **sur le schéma de champ**, jamais sur l'objet.

---

### 3.4 `packages/core/src/style/resolve.ts` — **nouveau**

**Compilé à exit 0 dans le bac à sable**, et les deux précédences sont **exécutées** en `§C.4`.

```ts
import type { TableColumnAlignment, TextAlignment } from '../ast/types.js';
import type { Typography } from './types.js';

/**
 * The two places a run's typography can be declared, and NOWHERE ELSE.
 *
 * `run` is the {@link TextSegment} that carries the characters; `block` is the {@link TextNode}
 * that holds it. There is no third term -- no `Template` baseline, no ancestor, no
 * `inherit` -- and the absence is a decision, not an omission [D12].
 */
export interface TypographySources {
  readonly run?: Typography | undefined;
  readonly block?: Typography | undefined;
}

/**
 * Merges the two declared sources PROPERTY BY PROPERTY, the run winning each one.
 *
 * ## What it returns, and why the name does not say "resolved"
 *
 * A {@link Typography}, whose five fields stay optional. An earlier draft returned a
 * `ResolvedTypography` defined as `{ readonly [K in keyof Typography]-?: Typography[K] }`, and
 * that type RESOLVES NOTHING: `-?` makes the KEY required, not the VALUE defined, and
 * `Typography[K]` already contains `| undefined` because `exactOptionalPropertyTypes` demands
 * it. MEASURED, twice and independently, five diagnostics:
 *
 *     error TS2322: Type 'string | undefined' is not assignable to type 'string'.
 *
 * A consumer calling something named `resolve` and receiving something named `Resolved` would
 * still have to invent five values. A NAME THAT PROMISES WHAT THE TYPE DOES NOT DELIVER IS
 * WORSE THAN NO NAME -- the same reproach this lot levels at `Color = string`, and the remedy
 * is symmetrical: say the truth in the name and in the docstring.
 *
 * The five missing values are named as a DEBT in ADR 0007, with their owners (lots E1 and V1),
 * because an expectation of the engine belongs in an ADR and never in a docstring.
 *
 * ## Why two terms and not one -- the figure IS the argument
 *
 * MEASURED on the playground model. "One font, one size, for the whole invoice" -- the most
 * banal declaration an invoice template makes -- costs, written per SEGMENT (41 sites),
 * +123 values (+22.4 %); written per TEXT NODE (20 sites), +60 values (+10.9 %); written in a
 * single document baseline, +3 values (+0.5 %). A contract refusing BOTH the node and the
 * baseline offers no way to say "this invoice is in Helvetica 10" other than writing it 41
 * times. The second term halves the cost with no product mandate; a third would divide it by 41
 * WITH one, and that is an open arbitration.
 *
 * ## Why exported, and NOT on the `printableAreaOf` argument
 *
 * `a ?? b` has no floating-point representation: two implementations of
 * `run?.family ?? block?.family` cannot diverge, so the `printableAreaOf` motive -- measured,
 * `215.9 - (25.4 + 25.4)` is `165.10000000000002` where `(215.9 - 25.4) - 25.4` is `165.1` --
 * DOES NOT APPLY here, and citing it would be invoking a precedent that does not hold. The
 * motive that does hold is `Template.page`'s: A CONVENTION WRITTEN ONCE IN `core` BEATS A
 * CONVENTION REINVENTED BY EVERY RENDERER, "with nothing checking that the viewer invents the
 * same one". What is exported is an ORDER OF RESOLUTION, not an arithmetic.
 *
 * The objection that this is the cascade ADR 0004 decision 8 declared irreversible is answered
 * and the answer is narrow: that decision refused `override ?? ancestor ?? document` -- THREE
 * terms, one of them a stored DOCUMENT field whose removal would need a transforming
 * migration. Here there are two, neither is on the document, and a structural one-level
 * inheritance already exists unchallenged in this contract (`TableColumn.align`, "Inherited by
 * every cell of this column"). What would reopen the objection is a third term.
 */
export function resolveTypography(sources: TypographySources): Typography {
  const { run, block } = sources;
  return {
    family: run?.family ?? block?.family,
    sizePt: run?.sizePt ?? block?.sizePt,
    bold: run?.bold ?? block?.bold,
    italic: run?.italic ?? block?.italic,
    color: run?.color ?? block?.color,
  };
}

/**
 * The two places the alignment of ONE TEXT BLOCK can come from: the block, or its column.
 *
 * VALUES and not objects, unlike {@link TypographySources}, and the asymmetry has a reason: a
 * per-property merge needs the objects, a single property does not. What the named object buys
 * is that the two terms cannot be passed in the wrong order -- which is the whole risk in a
 * function whose body is one `??`.
 *
 * ## The two fields have DIFFERENT TYPES, and that is the contract, not an oversight
 *
 * `text` is a {@link TextAlignment}: four members, `justify` included. `column` is a
 * {@link TableColumnAlignment}: three, and a column cannot declare `justify` because a column
 * justifies nothing -- it states a default, and it is the run that gets stretched. The second
 * type being a STRICT SUBSET of the first is what lets the body stay `text ?? column` with no
 * widening and no assertion, and it is structural: the tuples are derived one from the other.
 *
 * `column` is not `| undefined` at its source -- `TableColumn.align` is REQUIRED. It is optional
 * here because a text block outside any table has no column at all.
 */
export interface TextAlignSources {
  readonly text?: TextAlignment | undefined;
  readonly column?: TableColumnAlignment | undefined;
}

/**
 * Says WHERE A TEXT BLOCK'S ALIGNMENT COMES FROM when it sits in a table cell: itself, then its
 * column.
 *
 * ## What this is NOT: a precedence between two declarations of one fact
 *
 * An earlier draft called it that, and it was wrong. A column's alignment and a block's are two
 * DIFFERENT facts that happen to share three value names. The column states the default for the
 * TEXT BLOCKS of its cells; the block distributes ITS OWN runs. A cell holding an image has the
 * first and not the second -- there is no run to align -- and a cell holding two paragraphs has
 * one column default and TWO block alignments, which may differ. Calling that a rivalry made a
 * degenerate case (one cell, one paragraph, where the two coincide) look like the general one.
 *
 * ## Why this function has to exist anyway
 *
 * Because the DEFAULT still has to be resolved somewhere, and a rule of precedence written in
 * prose gets reimplemented twice -- once in the engine, once in the viewer -- with the right to
 * diverge. What is exported is an ORDER, not an arithmetic: `a ?? b` has no floating-point
 * representation, so the `printableAreaOf` motive does not apply here and citing it would be
 * invoking a precedent that does not hold [D6]. The motive that does hold is `Template.page`'s:
 * a convention written once in `core` beats one reinvented by every renderer.
 *
 * The block wins because it is the MORE LOCAL declaration and the one an editor Command can
 * address: a cell is not a node, it has no id. The column keeps its meaning unchanged -- ADR
 * 0005 fixed that form twice over: an override "s'ajoute, elle ne déplace pas le champ de
 * colonne", and "la porte reste ouverte dans le seul sens qui ne coûte rien".
 *
 * Returns `undefined` when neither is declared. Which alignment a renderer then applies, how it
 * honours `justify` (last line to `start`, slack between words), and against WHICH WRITING
 * DIRECTION it resolves `start` and `end`, are expectations named in ADR 0007 -- the second site
 * at which this repository inherits that last open question.
 */
export function resolveTextAlign(sources: TextAlignSources): TextAlignment | undefined {
  const { text, column } = sources;
  return text ?? column;
}
```

#### Ce que ce fichier force, et ce qui reste silencieux

| Fait | Porte |
| :--- | :--- |
| Le type de retour `Typography` **et non** un type à cinq champs définis | **porte 3** — c'est mesuré à l'envers : écrire `ResolvedTypography` rend **5 × `TS2322`** |
| **Inverser les deux termes** (`block?.family ?? run?.family`) | **aucune porte** — c'est l'`it` de précédence de [§3.11] qui rougit, et c'est sa seule raison d'exister |
| Ajouter un champ à `Typography` sans l'ajouter au corps de `resolveTypography` | **porte 3** : l'objet littéral ne satisferait plus le type de retour… **NON, silencieux** — tous les champs sont optionnels, donc un objet à quatre clés satisfait `Typography`. **C'est le trou de ce fichier, et il est nommé** : seul l'`it` qui compare les **cinq** clés le voit |
| **Inverser les deux termes de `resolveTextAlign`** (`column ?? text`) | **porte 3 dans un seul sens** — `column ?? text` rend `TableColumnAlignment \| TextAlignment`, donc `TextAlignment`, et **compile**. C'est l'`it` de [§3.11] qui rougit. En revanche, **annoter le retour `TableColumnAlignment`** rend `TS2322` : le sous-typage strict interdit à `justify` de remonter sur une colonne, et c'est le seul endroit où il mord |

**Trois points de rédaction.**

1. **`import type { TableColumnAlignment, TextAlignment } from '../ast/types.js'`, et non du barrel
   `ast/nodes.js`.** Un `import type` est **effacé** à l'émission, donc le choix est indifférent au
   runtime ; il pointe la source pour la même raison de cohérence que [§3.1], et **il ne crée aucun
   cycle** — vérifié sur le JavaScript émis, `style/resolve.js` n'a **aucun** import. **Les deux
   types viennent d'`ast/types.ts`** et non de `style/types.ts` : c'est là que vivent les deux
   tuples, pour la raison d'initialisation ESM que [§3.6] mesure.
2. **Deux formes de source, et l'asymétrie est écrite.** `TypographySources` porte des **objets**
   (la fusion est par propriété), `TextAlignSources` des **valeurs** (une seule propriété). Un plan
   qui les uniformiserait rendrait la seconde plus lourde pour zéro gain.
3. **Mesuré à l'exécution** (`§C.4`) : `resolveTypography({ run: { bold: true }, block: { family: 'X', sizePt: 9 } })`
   rend `{"family":"X","sizePt":9,"bold":true}` en JSON — les clés `italic` et `color` **existent**
   et valent `undefined`, `JSON.stringify` les omet. Un consommateur qui compte les clés en voit
   **cinq** ; un consommateur qui sérialise en voit **trois**. C'est écrit parce qu'un test
   d'aller-retour naïf s'y casse.


### 3.5 `packages/core/src/style/style.ts` — **nouveau — la façade**

**Compilé à exit 0 dans le bac à sable.** Le patron est `page/page.ts` et `ast/nodes.ts` :
`page/` est né divisé, C3 a dû payer le découpage d'`ast/` après coup, et ce dossier naît divisé.

```ts
/**
 * The appearance contract: what a template says about how a block and its characters LOOK.
 *
 * Barrel by design -- consumers import from here, never from ./types.js, ./schemas.js,
 * ./units.js or ./resolve.js, so the split inside this folder stays free to change. Lot C3 had
 * to pay for that split after the fact, in a dedicated increment; `page/` was born divided, and
 * so is this folder.
 *
 * ONE DEVIATION FROM THAT RULE IS MEASURED AND DELIBERATE, in the other direction: ./types.ts
 * imports `MAX_SHEET_MM` from `../page/types.js` rather than from the `page/page.js` barrel,
 * because `ast/schemas.ts` imports the schemas below as VALUES and the barrel closes an ESM
 * cycle through `page/schemas.js` -> `ast/nodes.js` -> `ast/schemas.js`. See
 * {@link MAX_FONT_SIZE_PT} for the measurement and the exact `ReferenceError`.
 *
 * What is NOT here, and it is not an oversight: the ACCRUAL SITES. `box`, `typography` and
 * `align` are fields of node types, so they live in `ast/`, beside the nodes that carry them --
 * the same rule that keeps `PAGE_FIELDS` in `ast/` and out of `page/`. This folder declares the
 * shapes and validates them; it names no carrier.
 */
export {
  BorderEdgeSchema,
  BoxBorderSchema,
  BoxSpacingSchema,
  BoxStyleSchema,
  ColorSchema,
  TypographySchema,
} from './schemas.js';
export type { TextAlignSources, TypographySources } from './resolve.js';
export { resolveTextAlign, resolveTypography } from './resolve.js';
export type { BorderEdge, BoxBorder, BoxSpacing, BoxStyle, Color, Typography } from './types.js';
export { MAX_FONT_SIZE_PT, MIN_FONT_SIZE_PT } from './types.js';
export { mmFromPt, ptFromMm } from './units.js';
```

#### Ce qu'il force, et ce qui reste silencieux

| Fait | Porte |
| :--- | :--- |
| Un symbole renommé dans un fichier interne et pas ici | **porte 3** (`TS2459` / `TS2305`) — mesuré une fois pour de vrai : la première rédaction de [§3.3] importait `MAX_SHEET_MM` depuis `./types.js`, qui ne le réexporte pas, et `tsc` a rendu `src/style/schemas.ts(2,28): error TS2459: Module '"./types.js"' declares 'MAX_SHEET_MM' locally, but it is not exported.` |
| **Un export oublié dans ce barrel** | **aucune porte** — c'est le test de compte d'exports de [§3.11] et de [§3.10] qui le voit |
| L'ordre des `export` | aucune porte, et il n'est pas indifférent : voir ci-dessous |

> ⚠️ **L'ordre des lignes de ce barrel est fonctionnel, pas cosmétique.** Les `export … from` d'un
> module ESM sont évalués **dans l'ordre d'écriture**, et `./schemas.js` vient **avant**
> `./resolve.js`. Inverser les deux ne casse rien aujourd'hui — `style/resolve.js` n'a **aucun**
> import au runtime, vérifié sur le JavaScript émis — mais un futur `resolve.ts` qui importerait
> une **valeur** de `./schemas.js` rendrait l'ordre porteur. La ligne est écrite ici pour que le
> prochain contributeur ne « range » pas le fichier par alphabet sans le savoir.
>
> **Ce que le barrel n'exporte PAS, et c'est délibéré.** `styleLengthMmSchema` (une orthographe
> interne ; l'exporter publierait un quatrième vocabulaire de longueur) · aucune assertion
> `*_IN_STEP` ni `*_SATISFIES_TYPE` (elles vivent dans `__tests__/`) · aucun `MAX_STYLE_LENGTH_MM`
> · aucun `STANDARD_FONT_WEIGHTS` · aucun `ResolvedTypography` · aucun `BOX_ALIGNMENTS` (le tuple de texte est `TEXT_ALIGNMENTS`, et il vit dans `ast/`) · aucune
> porte bornée `parseStyle`.

---

### 3.6 `packages/core/src/ast/types.ts` — **modifié**

**Compilé à exit 0 dans le bac à sable**, 414 → **527 lignes**.

#### Diff conceptuel

| | |
| :--- | :--- |
| **Ce qui s'ajoute** | un `import type` · **un tuple et son type**, `TEXT_ALIGNMENTS` / `TextAlignment` · **onze déclarations de champ** sur **neuf porteurs** : `typography?` sur les trois kinds de segment, `box? / typography? / align?` sur `TextNode`, `box?` sur `ImageNode`, `ContainerNode`, `TableRowNode`, `TableNode` |
| **Ce qui change** | **cinq docstrings publiées**, aux lignes `:144`, `:159-160`, `:203`, `:250`, `:366` — quatre REDIRIGÉES, une TENUE AILLEURS |
| **Ce qui ne change pas** | `NodeBase` (les trois nœuds de contrôle n'auraient pas de sujet) · `LoopNode`, `ConditionNode`, `TableRowGroupNode` · `TableColumn` (sauf sa docstring), `TableCell` · les deux unions `BlockNode` / `DocumentNode` · **`TABLE_COLUMN_ALIGNMENTS` lui-même** — trois membres, il n'est **ni élargi ni touché**, seule sa docstring bouge · `MIN_COLUMN_WIDTH`, `MAX_COLUMN_WIDTH`, `PAGE_FIELDS` |

> **⚠️ Pourquoi `TEXT_ALIGNMENTS` vit ICI et non dans `style/types.ts`.** Il pourrait vivre là-bas ;
> il y serait alors **déclaré à plat**, et rien ne garantirait mécaniquement qu'il contient les trois
> membres de `TABLE_COLUMN_ALIGNMENTS`. Le dériver — `[...TABLE_COLUMN_ALIGNMENTS, 'justify']` —
> exige d'en importer la **valeur**, ce qui, depuis `style/`, ajouterait une arête de runtime
> `style/ → ast/` dans un graphe où `ast/ → style/` existe déjà : **exactement la configuration
> d'initialisation ESM** que ce lot a mesurée sur le barrel de `page/` (`ReferenceError: Cannot
> access 'ContainerNodeSchema' before initialization`). Déclaré dans **le même fichier** que le tuple
> dont il est le sur-ensemble, il se dérive sans une arête, et **la relation de sous-type devient
> structurelle plutôt qu'assertée**.

#### Les gestes, dans l'ordre des lignes de HEAD

**① Ligne 1 — l'import.** Après la ligne d'import existante :

```ts
import type { Expression, PrintableExpression } from '../expression/expression.js';
import type { BoxStyle, Typography } from '../style/style.js';   // ← AJOUT
```

> Un `import type`, donc **effacé à l'émission** : `ast/types.js` n'acquiert **aucune** arête de
> dépendance au runtime, et le cycle de type `style/ → page/ → ast/ → style/` est résolu par
> TypeScript sans un diagnostic. **Vérifié** : `tsc` exit 0, et l'import du JavaScript émis
> réussit (116 exports).

**② Lignes 31-34 — `TextLiteralSegment`.**

```ts
export interface TextLiteralSegment {
  readonly kind: 'literal';
  readonly text: string;
  /** The form of THIS run's characters. Overrides {@link TextNode.typography} field by field. */
  readonly typography?: Typography | undefined;
}
```

**③ Ligne 51 — `TextBindingSegment`**, après `readonly value: PrintableExpression;` :

```ts
  /** The form of THIS run's characters. Overrides {@link TextNode.typography} field by field. */
  readonly typography?: Typography | undefined;
```

**④ Lignes 92-95 — `TextPageFieldSegment`.**

```ts
export interface TextPageFieldSegment {
  readonly kind: 'pageField';
  readonly field: PageField;
  /**
   * The form of the substituted number's characters. A page number has a font.
   *
   * Carrying a STYLE here is coherent; carrying an EXPRESSION would reopen the feedback loop
   * this kind exists to close, and no style position of this contract accepts one.
   */
  readonly typography?: Typography | undefined;
}
```

**⑤ Lignes 99-103 — `TextNode`, le seul porteur des trois champs.**

```ts
export interface TextNode extends NodeBase {
  readonly type: 'text';
  /** An empty run list is legal: a blank paragraph is a layout intent. */
  readonly content: readonly TextSegment[];
  /** The box this block occupies: background, rules, inner inset. See {@link BoxStyle}. */
  readonly box?: BoxStyle | undefined;
  /**
   * The form of the characters of every run that declares none of its own.
   *
   * The SECOND of the two terms `resolveTypography` merges, and the last: there is no third.
   * "This invoice is in Helvetica 10" written here costs +60 values (+10.9 %) on the playground
   * model, against +123 (+22.4 %) written on all 41 segments -- measured, and it is the whole
   * argument for this field existing beside the segment one.
   */
  readonly typography?: Typography | undefined;
  /**
   * How this block's INLINE RUNS are distributed inside its own box, and THE ONLY NODE THAT
   * CARRIES IT.
   *
   * Nowhere else, because nowhere else has runs: on an `image` it would be `object-position`, a
   * cropping policy; on a `container` the cross-alignment of block children, a layout model; on
   * a `table` there is nothing to align, since a table occupies its parent's content width; on
   * a `tableRow` it would be EXACTLY {@link TableColumn.align} under a second name.
   *
   * ## This is NOT the same fact as {@link TableColumn.align}, and the type says so
   *
   * That field is the DEFAULT of this one for the text blocks of a column's cells. It does not
   * move an image, a container or a box -- nothing in this lot declares a block width, so every
   * block fills its cell's content width and there is nothing to move. `resolveTextAlign` is
   * the one spelling of where the default comes from, and the column field is untouched: an
   * override "s'ajoute, elle ne déplace pas le champ de colonne" (ADR 0005).
   *
   * ## Its own tuple, and `TABLE_COLUMN_ALIGNMENTS` is a STRICT SUBSET of it
   *
   * {@link TEXT_ALIGNMENTS} adds `justify`, which a COLUMN cannot declare and a text block can.
   * The subset relation is structural -- the tuple is derived by spread -- so the contract
   * cannot drift into two unrelated vocabularies, and `text ?? column` compiles with no
   * widening and no assertion.
   */
  readonly align?: TextAlignment | undefined;
}
```

**⑥ Lignes 105-109 — `ImageNode`**, et la ligne sur la dimension absente est le renvoi à n° 5 :

```ts
export interface ImageNode extends NodeBase {
  readonly type: 'image';
  readonly src: string;
  readonly alt?: string | undefined;
  /**
   * The box this block occupies: background, rules, inner inset. See {@link BoxStyle}.
   *
   * And NO dimension, here or anywhere: this lot STORES no width and no height on any node,
   * which is what keeps `printableAreaOf` the only geometry of the contract. A width is not
   * absent from the product, it is DERIVED -- an image occupies its parent's content width --
   * so shaping a logo is a container and its `padding`, to the millimetre, with no field here.
   *
   * What that leaves to an engine is the HEIGHT, which follows the resource's intrinsic ratio;
   * that ratio is a measurement OF THE RESOURCE, which is the whole reason a `widthMm` alone
   * cannot be stored. Named as an expectation in ADR 0007, not decided here.
   */
  readonly box?: BoxStyle | undefined;
}
```

**⑦ Lignes 111-114 — `ContainerNode`**, et c'est le champ qui **paie trois refus à lui seul** :

```ts
export interface ContainerNode extends NodeBase {
  readonly type: 'container';
  readonly children: readonly BlockNode[];
  /**
   * The box this block occupies: background, rules, inner inset. See {@link BoxStyle}.
   *
   * This one field is what gives a PAGE BAND its appearance for free: `PageBand.content` IS a
   * `ContainerNode`, so not one line of `page/` changes. It is also the workaround for the two
   * spacings this lot refuses -- a container per amount of air, and a container around a loop
   * or a condition, which is how "a background per iteration" and "a background around all the
   * iterations" stay DISTINCTLY expressible with no field on those nodes.
   *
   * NO `typography` here, and it is the same refusal from the other side: a container holds no
   * characters, so the only meaning `family` could have on it is "it descends" -- a cascade,
   * which this contract makes INEXPRESSIBLE rather than merely forbidding.
   */
  readonly box?: BoxStyle | undefined;
}
```

**⑧ Lignes 290-293 — `TableRowNode`**, le porteur le plus discutable, donc celui dont l'argument
est écrit :

```ts
export interface TableRowNode extends NodeBase {
  readonly type: 'tableRow';
  readonly cells: readonly TableCell[];
  /**
   * The horizontal band this row occupies: background, rules, and a per-cell inset.
   *
   * The most debatable of the five carriers, so the argument is written. A row IS a band:
   * `background` paints it, `border.top`/`border.bottom` draw rules across it,
   * `border.left`/`border.right` close it at both ends. A table's heading band is the SECOND
   * differentiating device of an invoice (measured: `background` is one of only two fields whose
   * removal breaks the recipe criterion), and without a carrier here painting one would take a
   * `ContainerNode` PER CELL -- five nodes for a five-column heading.
   *
   * ## What `padding` does here, and it is NOT what it does on the four other carriers
   *
   * It insets THE CONTENT OF EACH CELL of this row, identically, and MOVES NO COLUMN BOUNDARY.
   *
   * The other reading -- insetting the band as a whole -- is representable and is refused,
   * because it would shift, for this row alone, the origin and the width the column weights
   * resolve against: the heading columns would stop lining up with the body's. It would also
   * insert into the published formula of {@link TableColumn.width} a per-row subtraction that
   * formula does not have -- WHICH IS EXACTLY THE ARGUMENT THAT REMOVED `gap` FROM THIS CARRIER,
   * and that argument does not care which name the field is given. Written as above, `padding`
   * touches no boundary and leaves the formula intact.
   *
   * What was REMOVED so that every field of {@link BoxStyle} has a meaning here: `gap`, which on
   * a row means inter-cell spacing and has no reading that leaves the formula alone; and
   * `align`, which here would be `TableColumn.align` under a second name.
   */
  readonly box?: BoxStyle | undefined;
}
```

**⑨ Ligne 386 — `TableNode`**, après `readonly footer: readonly TableRowNode[];` :

```ts
  /**
   * The box the whole table occupies: background, rules, inner inset. See {@link BoxStyle}.
   *
   * ## Where the column weights resolve, which this field makes it necessary to state
   *
   * A table occupies its parent's CONTENT width, and its own `padding` is subtracted from that
   * before {@link TableColumn.width} shares what remains. This COMPLETES the published formula
   * rather than contradicting it: "of whatever width the table itself is given" -- what it is
   * given is the parent's content width, what it shares is its own.
   *
   * That sentence is the reason lot C3 could leave the width undeclared and this lot cannot: a
   * `padding` here that did not say what it subtracts from would be a stored value with no
   * stated meaning. The whole chain is arithmetic on declared millimetres -- `printableAreaOf`,
   * then one subtraction per ancestor box, then ONE correctly-rounded division on integer
   * weights -- so no term of it is a measurement, and decision 7's "same number in the preview
   * and in the PDF" is checkable rather than merely promised.
   */
  readonly box?: BoxStyle | undefined;
```

#### Les cinq corrections de docstring publiée — INC-7

**⑩ Lignes 159-160 — `TABLE_COLUMN_ALIGNMENTS` : `justify` est TENU, MAIS AILLEURS.** Les deux
lignes « *Three members and no `justify`: justification stretches inter-word space, which is
typography, and typography is lot C5.* » sont remplacées par :

```ts
 * Three members and no `justify`, and lot C5 kept it that way ON PURPOSE while DELIVERING the
 * member elsewhere. An earlier version of this sentence promised `justify` to that lot; the
 * promise is kept on {@link TEXT_ALIGNMENTS}, which this tuple is a strict subset of, and NOT
 * here -- because a COLUMN justifies nothing. A column states the default its cells' text
 * blocks take when they declare none, and it is the BLOCK that distributes inter-word space.
 *
 * The motive an earlier draft gave for refusing it outright -- "measuring words takes font
 * metrics, which is reading the machine" -- PROVES TOO MUCH and is not repeated: centring a
 * line takes the same metric, and `center` is a member here. What lot E6 forbids is reading the
 * ENVIRONMENT, never measuring a font the engine loaded itself. What justification really costs
 * is two CONVENTIONS -- the last line is not justified, and the slack goes between words, never
 * between letters -- and this contract takes them, as it takes sRGB, in ADR 0007.
 *
 * Widening THIS tuple would moreover be a THIRD form of incompatibility, beside the two
 * AGENTS.md 1.2 names: an older build meets `invalid_value` with the message
 * `Invalid option: expected one of "start"|"center"|"end"` on a discriminant path -- more
 * legible than "No matching discriminator", still with no typed error, no version named and no
 * remedy. Measured.
```

**⑩ bis Ligne 144 — l'en-tête de `TABLE_COLUMN_ALIGNMENTS` : RÉTRÉCI.** C'est **la** correction que
la revue a rendue obligatoire, et elle passe **avant** l'ajout du tuple parce que c'est elle qui le
rend nécessaire. La ligne « *How the cells of one column sit inside their column box (lot C3).* »
devient :

```ts
 * The DEFAULT alignment the text blocks of this column's cells take when they declare none.
 *
 * NOT "how the cells sit in their column box", which is what this line used to say and what
 * neither lot C3 nor lot C5 can honour: placing a CELL takes a table layout model, and a cell
 * holding an image or a container shows it in one glance -- there is no run to align, and this
 * contract declares no block width, so every block already fills its cell's content width and
 * there is nothing left to move. The narrower reading is the one the contract can keep.
 *
 * The stored shape does not change by one character: this is a docstring correction, no
 * migration is owed, and no existing document becomes invalid.
```

**⑩ ter Ligne 164 — `TEXT_ALIGNMENTS`, le tuple neuf**, immédiatement après
`export type TableColumnAlignment = (typeof TABLE_COLUMN_ALIGNMENTS)[number];` :

```ts
/**
 * How the inline runs of a {@link TextNode} are distributed inside its own box.
 *
 * DERIVED from {@link TABLE_COLUMN_ALIGNMENTS} rather than declared flat, and the spread is the
 * point: it makes "a column alignment is always a legal text alignment" a fact THE COMPILER
 * HOLDS, not a comment two files apart can drift from. `resolveTextAlign` returns
 * `text ?? column` with no widening and no assertion because of this one line.
 *
 * The fourth member is the one a column cannot have. Justifying distributes inter-word space,
 * which is something a RUN does and a column merely defaults; and it costs this contract two
 * conventions, taken rather than left open, in ADR 0007: the last line of a justified paragraph
 * aligns to `start`, and the slack is distributed between WORDS, never between letters.
 *
 * Nothing here resolves `start` and `end` against a writing direction -- that question is
 * inherited from lot C3, recorded in ADR 0005, and it is settled by no engine reading the
 * machine it runs on (lot E6).
 */
export const TEXT_ALIGNMENTS = [...TABLE_COLUMN_ALIGNMENTS, 'justify'] as const;

export type TextAlignment = (typeof TEXT_ALIGNMENTS)[number];
```

**⑪ Ligne 203 — le critère d'appartenance de C3 : REDIRIGÉ.**

```ts
 * -- they are written on any block that OCCUPIES SPACE, and lot C5 defines them there. "That
 * occupies space" is not a hedge added after the fact: it is the cut lot C5 actually made, and
 * it excludes `loop`, `condition` and `tableRowGroup`, which produce N sequences, their children
 * or nothing, so a box on them has no subject at all. The three of them are exactly the nodes
 * carrying an `Expression` field directly. A number
```

> **Pourquoi cette phrase-là doit être corrigée en même temps que l'inclusion qu'elle
> annonçait :** c'est **elle** qui a servi à **exclure** la police de `TableColumn`. Un texte qui
> justifie une exclusion par une inclusion doit être corrigé quand l'inclusion arrive autrement
> qu'annoncée.

**⑫ Lignes 250-251 — `TableColumn.align` : la surcharge est REDIRIGÉE, pas déclinée.**

```ts
  /**
   * The DEFAULT of {@link TextNode.align} for the text blocks of this column's cells, and
   * OVERRIDDEN BY THE BLOCK rather than by the cell.
   *
   * Lot C5 delivered the override announced here, at a different site: {@link TextNode.align},
   * with `resolveTextAlign` as the one spelling of where the default comes from -- the block
   * wins, this field is untouched. Not on {@link TableCell}, and the reason is a matter of form:
   * a cell is not a node, it has no `id`, and an editor Command cannot address it. The block
   * inside it is addressable.
   *
   * "The same fact under two names" is what an earlier draft called this pair, and it was wrong:
   * this field defaults a whole column's text blocks, that one distributes ONE block's runs, and
   * a cell holding an image has one of them and not the other. The two types differ accordingly
   * -- {@link TextAlignment} adds `justify`, which is not declarable here.
   */
  readonly align: TableColumnAlignment;
```

**⑬ Lignes 366-367 — `TableNode`, « ce qu'il ne porte pas » : PARTIELLEMENT PÉRIMÉ.**

```ts
 * A BORDER, A SHADING AND A SPACING IT NOW DOES CARRY: lot C5 put a `box` on this node, so the
 * three refusals this paragraph used to list are no longer true and are not restated. What
 * stays true is "no font" -- typography lives on the runs, never on a table -- and "no per-cell
 * alignment override", which lot C5 delivered on the BLOCK IN THE CELL instead, see
 * {@link TableColumn.align}. No page format, no margins (lot C4).
 *
 * A WIDTH IS STILL NOT STORED, AND IT IS NO LONGER MISSING. A table occupies its parent's
 * content width, its own `padding` is subtracted from that, and the column weights share the
 * remainder -- see {@link TableNode.box}. So `TableColumn.width`'s "of whatever width the table
 * itself is given" now has an answer, and it needed one: without it the integer weights, whose
 * whole purpose is "the same number in the preview and in the PDF", resolved against nothing.
 * A HEIGHT is neither stored nor derived, and it cannot be: a row's height is measured on its
 * content.
```

#### Ce que ce fichier force, et ce qui reste silencieux — **c'est ici que `B2` mord**

| Geste | Porte |
| :--- | :--- |
| Ajouter `box?` au **type** et l'oublier dans le **schéma** — sur `TextLiteralSegment`, `TextBindingSegment`, `TextPageFieldSegment`, `TextNode`, `ImageNode`, `ContainerNode` | **exit 0. SILENCIEUX.** Mesuré ici, sur ce contrat, avant [§3.13] : trois mutations sur quatre passent |
| Le même oubli sur `TableRowNode` ou `TableNode` | **porte 3**, `nodes.test.ts:120` / `:130` — les paires de C3 |
| **Après [§3.13]** : le même oubli sur **n'importe lequel des neuf** | **porte 3**, exit 1 — mesuré, onze mutations sur onze |
| Ajouter `box` à `LoopNode` ou `ConditionNode` (la coupe franchie) | **porte 3 après [§3.13]** — les deux contre-épreuves. **Silencieux avant** |
| Les cinq corrections de docstring | **aucune porte, jamais.** Aucun outil ne lit un commentaire. C'est INC-7, et c'est pourquoi il est **publiable seul** et **coupable en dernier recours** |
| Déclarer `TEXT_ALIGNMENTS` **à plat** au lieu de le dériver | **aucune porte** — un tuple littéral aux quatre bons membres compile. Ce que la dérivation achète, c'est qu'un membre **retiré** de `TABLE_COLUMN_ALIGNMENTS` casse `resolveTextAlign` à la compilation au lieu de laisser deux vocabulaires diverger en silence |
| `TextAlignment` employé là où une **colonne** est attendue | **porte 3**, `TS2322` : le sous-typage est strict dans un seul sens, et c'est le sens voulu — `justify` ne remonte pas sur une colonne |

> ⚠️ **Point de collision git, et il est réel.** Ce fichier est touché par **INC-2** (les onze
> champs, plus le tuple) **et** par **INC-7** (les cinq docstrings). Les faire **dans cet ordre**,
> jamais en parallèle : les gestes ⑩ à ⑬ tombent aux lignes 144, 159, 203, 250 et 366, que les
> gestes ② à ⑨ ont déjà décalées de **plus de cent lignes** au total.
>
> ⚠️ **Et une exception à l'ordre : le geste ⑩ ter — le tuple — appartient à INC-2, pas à INC-7.**
> C'est une **déclaration**, pas une prose : `TextNode.align` ne compile pas sans lui. Un incrément
> de documentation qui porterait un tuple ne serait plus publiable seul.

---

### 3.7 `packages/core/src/ast/schemas.ts` — **modifié**

**Compilé à exit 0 dans le bac à sable**, 325 → **357 lignes**.

#### Diff conceptuel

| | |
| :--- | :--- |
| **Ce qui s'ajoute** | un `import` de **valeurs** · **deux constantes locales** `boxField` / `typographyField` · **onze champs** sur **huit `z.object`** |
| **Ce qui change** | rien d'existant : aucun champ, aucun message, aucun `superRefine` |
| **Ce qui ne change pas** | `nodeIdSchema` · `TextSegmentSchema` (l'union se reconstruit d'elle-même) · `blockMembers()` / `rowMembers()` · `BlockNodeSchema` / `DocumentNodeSchema` · `TableColumnSchema`, `TableCellSchema`, `TableRowGroupNodeSchema`, `TableBodyNodeSchema` · `checkCells`, `checkTableWiring` |

#### Les gestes

**① Ligne 16-18 — l'import et les deux constantes**, juste après le bloc `} from './types.js';`
et **autour** de `nodeIdSchema` (ligne 18 de HEAD) :

```ts
} from './types.js';
import { BoxStyleSchema, TypographySchema } from '../style/style.js';

const nodeIdSchema = z.string().min(1, 'A node id is required');

/**
 * The two style fields, spelt ONCE each and reused by every carrier below.
 *
 * ⚠️ EIGHT `z.object` LITERALS IN THIS FILE GAIN A STYLE FIELD, AND THERE IS NO
 * `nodeBaseSchema` TO PUT IT ON. The eight repeat `id: nodeIdSchema` literally, so a field
 * shared by five nodes is five edits, not one -- and MEASURED, forgetting one of them is
 * SILENT: of the fifteen sites a style can attach to, the type gate sees nine of them not at
 * all, and 591 tests out of 591 pass with four schemas diverging from their types. The eight
 * `*_KEYS_IN_STEP` pairs written in `ast/__tests__/nodes.test.ts` before any of these fields
 * existed are what turned that silence into a compile error.
 *
 * These two constants do not remove the repetition -- they make a forgotten site visible as an
 * ABSENT NAME rather than as a subtly different expression.
 */
const boxField = BoxStyleSchema.optional();
const typographyField = TypographySchema.optional();
```

**② Lignes 20-42 — les trois segments** gagnent `typography: typographyField,` en dernière
position de chaque `z.object`.

**③ Lignes 58-62 — `TextNodeSchema`**, trois champs, et le seul qui porte un commentaire :

```ts
export const TextNodeSchema = z.object({
  type: z.literal('text'),
  id: nodeIdSchema,
  content: z.array(TextSegmentSchema),
  box: boxField,
  typography: typographyField,
  // The one node with runs, hence the one node with an alignment -- and its OWN tuple.
  // `TEXT_ALIGNMENTS` is not `TABLE_COLUMN_ALIGNMENTS` under another name: a column states a
  // DEFAULT for the text blocks of its cells, this states how ONE block distributes its runs, and
  // a cell holding an image has the first and not the second. The fourth member, `justify`, is
  // the one a column cannot declare. See both tuples' docstrings.
  align: z.enum(TEXT_ALIGNMENTS).optional(),
});
```

> ⚠️ **Une ligne d'import change ici**, et c'est le seul coût mécanique du tuple neuf :
> `TABLE_COLUMN_ALIGNMENTS` est **déjà importé** par ce fichier (ligne 13 de HEAD, pour
> `TableColumnSchema`), et l'import devient
> `import { TABLE_COLUMN_ALIGNMENTS, TEXT_ALIGNMENTS } from './types.js';` — **un symbole sur une
> ligne existante, pas une ligne d'import de plus**. La révision 1 comptait la réutilisation du
> tuple comme « zéro ligne ajoutée » ; le vrai delta est **zéro ligne, un symbole**.

**④ Lignes 64-69, 130-134, 172-176, 316-325 — `box: boxField,`** en dernière position de
`ImageNodeSchema`, `ContainerNodeSchema`, `TableRowNodeSchema` et de l'objet de `TableNodeSchema`
(**avant** `.superRefine(checkTableWiring)`, à l'intérieur du `z.object`).

#### Ce que ce fichier force, et ce qui reste silencieux

| Geste | Porte |
| :--- | :--- |
| Un `box` posé sur `TableNodeSchema` **après** le `.superRefine` | **porte 3** — `.superRefine` rend un `ZodObject` en zod 4, mais l'objet littéral doit être complet avant l'appel ; l'écrire après est une erreur de syntaxe |
| `checkTableWiring` inchangé alors que `TableNode` gagne un champ | **porte 3 en partie** : la signature `(table: TableNode, ctx)` continue de compiler, et c'est correct — un `box` n'est pas un câblage. **Mesuré : 626 tests verts** |
| **Oublier `box` sur un des huit `z.object`** | **exit 0 SANS [§3.13]**, **exit 1 avec** — la matrice de `§C.3` |
| Importer `BoxStyleSchema` du barrel **`page/page.js`** au lieu de `page/types.js` en amont | **exit 0 aux portes 2 et 3**, `ReferenceError` à l'exécution — `§C.2` |
| Écrire `align: z.enum(TABLE_COLUMN_ALIGNMENTS)` sur un `TextNode` | **compilerait**, et rendrait `justify` inexprimable **en silence** — les trois membres de la colonne sont un sous-ensemble légal. C'est l'`it` de [§3.11] qui accepte `justify` sur un `TextNode` qui rougit, et c'est sa seule raison d'exister |

---

### 3.8 `packages/core/src/template/template.ts` — **modifié**

**Compilé à exit 0**, 167 → **207 lignes**.

#### Diff conceptuel

| | |
| :--- | :--- |
| **Ce qui s'ajoute** | la section `## What version 6 means`, **40 lignes de docstring** |
| **Ce qui change** | **une valeur** : `CURRENT_SCHEMA_VERSION` passe de `5` à `6`, ligne **110** |
| **Ce qui ne change pas** | `TemplateSchema` — **aucun champ ajouté, aucun champ requis, aucun `z.default()`** · `Template`, `TemplateSummary` · la section v5 et son paragraphe d'asymétrie, **conservés tels quels** parce qu'ils restent vrais pour la v5 |

#### Le geste — ligne 109, avant `export const CURRENT_SCHEMA_VERSION`

```ts
 * ## What version 6 means
 *
 * Version 6 is version 5 plus lot C5, the appearance: TWO stored shapes -- `BoxStyle` (a
 * background, four border edges, an inner inset) and `Typography` (a family, a size in points,
 * bold, italic, a colour) -- plus one isolated field, `TextNode.align`. NINE accrual sites: a
 * `box` on `text`, `image`, `container`, `table` and `tableRow`; a `typography` on `text` and on
 * the three segment kinds.
 *
 * It is the SILENT LOSS case described above, and NOT the illegible refusal -- every field of
 * this lot is OPTIONAL, so no union widens and no older build meets an unknown discriminant.
 * That makes it the dangerous class, and it is measured rather than argued. A document carrying
 * a complete style at all nine sites, stamped 5, read by the build of `main`:
 *
 *     ACCEPTED WITH NO ERROR AT ALL
 *     in  : 189 values   out : 65 values   ERASED: 124 of 189 (-65.6 %)
 *
 * `box`, `typography`, `align` -- gone, down to the `typography` of a `pageField` segment INSIDE
 * A PAGE BAND, and an `onSave` persists the whole loss. On a document carrying reduced styles at
 * eleven positions the same measurement yields 36 of 114 (-31.6 %). Both figures are exact, so
 * NEITHER IS QUOTED WITHOUT ITS DOCUMENT.
 *
 * With the stamp, that same document yields
 * `TemplateMigrationError: Template uses schema version 6 but this build understands at most 5.
 * It was written by a newer release of Openview; upgrade before opening it.` -- measured on the
 * build of `main`, and measured a second time WITHOUT any of the new shapes: THE STAMP ALONE IS
 * WHAT PRODUCES IT.
 *
 * UNLIKE VERSION 5, THERE IS NO `root`/`page` ASYMMETRY, and the v5 paragraph above must not be
 * read forward. A version 4 build did not KNOW the `page` key and stripped the whole field
 * without validating inside it; a version 5 build KNOWS it, descends into it and validates
 * there. MEASURED -- a widened union inside a band is reported under
 * `page.header.0.content.children.0.type` exactly as under `root.…`, one issue, `invalid_union`.
 * So a style written in a header band is stripped just as visibly as one written in the flow,
 * and the detectability argument of the v5 entry does not need restating.
 *
 * Stamped ONCE, after the last persisted shape of the lot. No commit of C5 before that one is
 * publishable, for the reason version 2 already records -- and "not publishable" is as WEAK here
 * as it was for C1, C2 and C3 rather than as strict as for C4: this lot narrows nothing, so a
 * build taken mid-lot refuses no existing document, it merely loses the fields of the build that
 * follows.
 */
export const CURRENT_SCHEMA_VERSION = 6;
```

#### Ce que ce fichier force, et ce qui reste silencieux

| Geste | Porte |
| :--- | :--- |
| `z.literal(CURRENT_SCHEMA_VERSION)` suit la constante | porte 3, gratuitement — le schéma **lit** la constante |
| Les **onze littéraux racine** du dépôt qui écrivent `schemaVersion: CURRENT_SCHEMA_VERSION` | **aucune reprise** : ils sont dé-littéralisés depuis C2 |
| **Passer la constante à 6 sans ajouter l'entrée de migration** | **porte 4 : UN SEUL test rouge.** Mesuré : `migrate.test.ts > walks the chain ONE STEP AT A TIME` — `Test Files 1 failed | 18 passed`, `Tests 1 failed | 590 passed`. **C'est le seul filet mécanique de l'estampille**, et il a effectivement tiré |
| Passer la constante à 6 **avec** l'entrée mais **sans** corriger le littéral de chaîne | même test rouge |
| **Recopier le paragraphe d'asymétrie `root`/`page` de la v5** | **aucune porte** — c'est de la prose, et c'est précisément pour ça que `V-2.2` est bloquant : le plan C4 fait autorité de forme, donc la phrase périmée **serait** recopiée |

---

### 3.9 `packages/core/src/template/migrate.ts` — **modifié**

**Compilé à exit 0**, 326 → **365 lignes**.

#### Diff conceptuel

| | |
| :--- | :--- |
| **Ce qui s'ajoute** | **une** entrée `{ from: 5, to: 6 }` dans `TEMPLATE_MIGRATIONS`, après la ligne **215** (`}),` de l'entrée 4 → 5) et avant le `];` de la ligne **216** |
| **Ce qui change** | rien |
| **Ce qui ne change pas** | **les quatre entrées existantes ne sont PAS fusionnées** · `compatibilityPage()` · `TemplateMigration` · `readSchemaVersion`, `runMigrations`, `migrateToCurrent`, `parseTemplate` · **la seconde passe du garde de forme reste**, et le plan **n'écrit pas** qu'elle ne gagne rien |

#### Le geste

```ts
  {
    from: 5,
    to: 6,
    /**
     * Identity, except for the stamp -- and the stamp is the entire point, for the fourth time
     * and for exactly the reason the 1 -> 2 entry states.
     *
     * A v5 document is STRUCTURALLY a v6 document: lot C5 adds nine OPTIONAL fields and widens
     * no union, so there is nothing to transform, and the shape it yields is bounded because it
     * changes neither depth nor value count -- MEASURED, delta exactly 0 on `RECIPE_TEMPLATE`.
     *
     * ## Why this one is a stamp and NOT a transformation, which was a real question
     *
     * Writing a baseline typography into every existing document is the alternative, and it is
     * refused on two counts. It would oblige this file to TRAVERSE THE AST -- it has no traversal
     * today, and the traversal would be the first code here that knows the shape of a node -- and
     * MEASURED, it costs +324 values (+59.1 %) on the playground model against +8 for a single
     * document-level baseline. And a baseline needs a PRODUCT MANDATE: the compatibility page of
     * the entry above is "une décision produit, prise par le propriétaire du produit le
     * 2026-08-18, not a deduction", and a compatibility FONT is a notch worse than A4. A4 is
     * wrong for part of the world but it EXISTS everywhere; a `family: 'Helvetica'` designates a
     * resource that may not exist on the rendering machine, and resolving it is reading the
     * machine -- refused and tooled.
     *
     * So no document written before this lot carries any appearance, and that is the honest
     * outcome: the five typographic values of a run that declares none are decided by the
     * engine, and ADR 0007 names them as a debt with their owners rather than letting each
     * renderer invent them in silence.
     *
     * The reserve of the four entries above transposes word for word: the version guard reads
     * the STAMP, not the content. A document stamped `5` but already carrying a `box` -- hand-
     * made, or written by an unstamped mid-lot build -- is not refused. It parses, and comes out
     * `schemaVersion: 6`, keeping its box, because the current schema knows the field.
     */
    migrate: (input) => ({ ...input, schemaVersion: 6 }),
  },
```

#### Ce que ce fichier force, et ce qui reste silencieux

| Geste | Porte |
| :--- | :--- |
| Une entrée dont `migrate` n'estampille pas | **porte 4** — `runMigrations` refuse de boucler et jette `Migration 5 -> 6 left schemaVersion at …` |
| Une entrée avec un `from` qui ne suit pas | **porte 4** — `No migration registered from schema version 5` |
| **Écrire `{ page: …, ...input }` au lieu du test de valeur** dans une future entrée | **aucune porte** — le défaut est consigné dans la docstring de l'entrée 4 → 5, et C5 **ne le recopie pas** : la 4 → 5 teste **la valeur** (`input.page ?? compatibilityPage()`), non la clé |
| **Fusionner les quatre entrées** en une 1 → 6 | **porte 4** — le littéral de chaîne de `migrate.test.ts` |
| L'estampille sans transformation | **aucun coût mesurable** : delta **0 valeur, 0 niveau** sur `RECIPE_TEMPLATE`, vérifié par bisection sur le vrai `assertBoundedShape` |

---

### 3.10 `packages/core/src/index.ts` — **modifié**

**Compilé à exit 0**, 211 → **237 lignes**. Et le compte est **mesuré sur le `dist` émis, pas
raisonné** : `Object.keys(import('./out/index.js')).length` rend **116** valeurs exportées, contre
**104** sur le `dist` de `main` — soit **+12 valeurs**, exactement les douze de la liste ci-dessous.

#### Diff conceptuel

| | |
| :--- | :--- |
| **Ce qui s'ajoute** | **deux blocs `style/`**, insérés après la ligne **195** (`export type { RenderFormat, … } from './ports/render.js';`) : 8 types et 12 valeurs. **Plus deux symboles dans les blocs `ast/` existants** : le type `TextAlignment` et la valeur `TEXT_ALIGNMENTS` |
| **Ce qui change** | deux blocs `ast/` gagnent une ligne chacun — `TextAlignment` après `TableColumnAlignment` (ligne 22), `TEXT_ALIGNMENTS` après `TABLE_COLUMN_ALIGNMENTS` (ligne 42) |
| **Ce qui ne change pas** | l'ordre alphabétique des blocs par chemin de module (`ast/`, `errors`, `expression/`, `page/`, `ports/`, **`style/`**, `template/`) — `style/` s'insère **entre `ports/` et `template/`**, ce qui est sa place alphabétique et évite un diff sur les lignes voisines |

#### Le geste

```ts
export type {
  BorderEdge,
  BoxBorder,
  BoxSpacing,
  BoxStyle,
  Color,
  TextAlignSources,
  Typography,
  TypographySources,
} from './style/style.js';
export {
  BorderEdgeSchema,
  BoxBorderSchema,
  BoxSpacingSchema,
  BoxStyleSchema,
  ColorSchema,
  MAX_FONT_SIZE_PT,
  MIN_FONT_SIZE_PT,
  mmFromPt,
  ptFromMm,
  resolveTextAlign,
  resolveTypography,
  TypographySchema,
} from './style/style.js';
```

Et **deux lignes dans les blocs `ast/` déjà présents**, parce que les deux tuples d'alignement vivent
là [§3.6] :

```ts
  TextAlignment,      // ← ligne 23, après TableColumnAlignment
  TEXT_ALIGNMENTS,    // ← ligne 43, après TABLE_COLUMN_ALIGNMENTS
```

#### Le compte — **dérivé de la mesure de la révision 1, et à REMESURER**

| | `main` (`dist`) | après C5 (émis) | delta |
| :--- | --: | --: | --: |
| **Valeurs exportées** | **104** *(mesuré)* | **117** *(dérivé)* | **+13** |
| Types exportés | 81 (relevé `relevé de surface A.11`, **non remesuré** : un type n'existe pas dans le `dist` à l'exécution) | 90 | +9 |
| Total nominal | 185 | **207** | **+22** |

> ⚠️ **Le 116 de la révision 1 était mesuré ; le 117 ne l'est pas — c'est `116 + TEXT_ALIGNMENTS`.**
> Le renommage `resolveAlign` → `resolveTextAlign` est neutre au compte, le tuple neuf vaut **+1**,
> et les trois `.refine` de [D10] n'exportent rien. **La sonde 11 de [§6.4] doit être rejouée avant
> INC-5**, et si elle rend autre chose que 117, c'est le plan qui a tort, pas la sonde.
>
> ⚠️ **Et le chiffre « 81 → 90 » reste raisonné.** Un type n'apparaît pas dans `Object.keys` d'un
> module JavaScript : la seule mesure possible porte sur les **valeurs**. Le plan écrit les deux
> avec leur statut, et **le total de 207 est une somme dont un terme est raisonné et l'autre
> dérivé** — c'est ce que `m4` exigeait de ne pas hériter.

#### Ce que ce fichier force, et ce qui reste silencieux

| Geste | Porte |
| :--- | :--- |
| Un symbole exporté qui n'existe pas dans `style/style.js` | **porte 3**, `TS2305` |
| **Un symbole oublié dans ce barrel** | **aucune porte** — rien ne compare la surface publique à l'intention. C'est le **contrôle négatif du compte** de [§3.11] : un `it` qui épingle `117` |
| Exporter `styleLengthMmSchema` | compilerait ; refusé par décision (un quatrième vocabulaire de longueur publié) |
| Exporter une assertion `*_IN_STEP` | **impossible** : elles vivent dans `__tests__/`, que `packages/core/tsconfig.json` **exclut de `dist`** — c'est le troisième argument de `B3`, et il est mécanique |


---

### 3.11 `packages/core/src/style/__tests__/style.test.ts` — **nouveau**

**Compilé à exit 0, et exécuté : 20 fichiers, 627 tests verts** (591 de `main` + 36 de ce lot).

Le fichier fait **497 lignes**. Sa structure :

| Bloc | Contenu | Compte |
| :--- | :--- | --: |
| en-tête `const` | **dix** assertions de type — une paire `keyof` + une paire valeur par forme | 10 |
| `describe('the public surface of the package')` | le contrôle négatif du compte d'exports | 1 `it` |
| `describe('the two bounds of a font size')` | `MAX_FONT_SIZE_PT === 14_400`, l'aller-retour `mmFromPt`/`ptFromMm`, et la **non-inversibilité** | 2 `it` |
| `describe('a style survives the parse field by field')` | les **dix-sept** allers-retours, l'objet vide, la clé inconnue, les deux casses, le filet nul, le padding à zéros | 8 `it` |
| `describe('the ninth accrual site, which no type assertion can guard')` | **l'aller-retour JSON à neuf sites** par `parseTemplate` | 1 `it` |
| `describe('what a style refuses, with the code and the path')` | `N01`…`N24`, en `it.each` | 8 `it` (24 cas) |
| `describe('the two resolutions')` | la fusion par propriété, les cinq `undefined`, la précédence d'alignement | 3 `it` |

#### Le code — l'en-tête et les dix assertions

```ts
import { describe, expect, it } from 'vitest';
import type { z } from 'zod/v4';
import type { MutuallyAssignable } from '../../ast/__tests__/fixtures.js';
import { TextNodeSchema } from '../../ast/nodes.js';
import * as core from '../../index.js';
import { MAX_SHEET_MM } from '../../page/page.js';
import { parseTemplate } from '../../template/migrate.js';
import { CURRENT_SCHEMA_VERSION } from '../../template/template.js';
import {
  type BorderEdge,
  BorderEdgeSchema,
  type BoxBorder,
  BoxBorderSchema,
  type BoxSpacing,
  BoxSpacingSchema,
  type BoxStyle,
  BoxStyleSchema,
  ColorSchema,
  MAX_FONT_SIZE_PT,
  MIN_FONT_SIZE_PT,
  mmFromPt,
  ptFromMm,
  resolveTextAlign,
  resolveTypography,
  type Typography,
  TypographySchema,
} from '../style.js';
import { RECIPE_BOX_COMPLETE, RECIPE_TYPOGRAPHY_COMPLETE, styleOfCase } from './fixtures.js';

/**
 * ## Five shapes, TEN assertions: one `keyof` pair and one value pair each
 *
 * The two families are COMPLEMENTARY and never interchangeable, and that is measured rather than
 * asserted. On an eight-mutation matrix: `keyof` catches PRESENCE -- a field removed from the
 * schema, a field added to it -- and misses a TYPE drift; the value pair does the exact opposite.
 * A design writing only one family is half guarded.
 *
 * What was DROPPED from an earlier draft, on the same measurement: the five one-directional
 * `X_SATISFIES_TYPE` assertions. They never refuse ALONE -- they fire only where a mutual pair
 * fires too -- so they were five exported symbols for zero added coverage.
 *
 * ⚠️ AND THE TEN OF THEM ARE STILL BLIND TO ONE MUTATION, which is why the round trips below
 * exist. MEASURED: remove the `top` edge from `BoxBorderSchema` and all ten pass at exit 0,
 * while the parse silently drops the top rule. `BoxBorder` is all-optional, so the amputated
 * object stays mutually assignable, and `keyof BoxStyle` does not move because `border` is still
 * there. `ast/schemas.ts` already wrote the remedy -- "Only a runtime parsing test catches that,
 * and that is why there is one per node type" -- read here as ONE PER STYLE FIELD.
 *
 * `const` and not `it`, because there is nothing to run: the guard is the ANNOTATION, and
 * `pnpm run type-check` is what runs it. Exported so they are not reported unused.
 */
export const TYPOGRAPHY_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof TypographySchema>,
  keyof Typography
> = true;

export const TYPOGRAPHY_IN_STEP: MutuallyAssignable<
  z.infer<typeof TypographySchema>,
  Typography
> = true;

export const BOX_STYLE_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof BoxStyleSchema>,
  keyof BoxStyle
> = true;

export const BOX_STYLE_IN_STEP: MutuallyAssignable<z.infer<typeof BoxStyleSchema>, BoxStyle> = true;

export const BORDER_EDGE_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof BorderEdgeSchema>,
  keyof BorderEdge
> = true;

export const BORDER_EDGE_IN_STEP: MutuallyAssignable<
  z.infer<typeof BorderEdgeSchema>,
  BorderEdge
> = true;

export const BOX_BORDER_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof BoxBorderSchema>,
  keyof BoxBorder
> = true;

export const BOX_BORDER_IN_STEP: MutuallyAssignable<
  z.infer<typeof BoxBorderSchema>,
  BoxBorder
> = true;

export const BOX_SPACING_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof BoxSpacingSchema>,
  keyof BoxSpacing
> = true;

export const BOX_SPACING_IN_STEP: MutuallyAssignable<
  z.infer<typeof BoxSpacingSchema>,
  BoxSpacing
> = true;
```

#### Le contrôle négatif du compte d'exports, et les deux bornes

```ts
describe('the public surface of the package', () => {
  it('exports exactly the thirteen values lot C5 adds, and no fourteenth', () => {
    // The NEGATIVE CONTROL of the export count, and it is the only guard there is: nothing else
    // compares the public surface to the intention, so a symbol forgotten in `index.ts` compiles
    // and ships missing. MEASURED on the emitted `dist` of the previous release: 104 exported
    // VALUES. This lot adds thirteen, so 117.
    //
    // VALUES only, and that limit is stated rather than hidden: a TYPE does not appear in
    // `Object.keys` of a JavaScript module, so the nine types this lot adds cannot be counted
    // this way and their count stays reasoned.
    const values = Object.keys(core);
    const added = [
      'BorderEdgeSchema', 'BoxBorderSchema', 'BoxSpacingSchema', 'BoxStyleSchema', 'ColorSchema',
      'MAX_FONT_SIZE_PT', 'MIN_FONT_SIZE_PT', 'mmFromPt', 'ptFromMm', 'resolveTextAlign',
      'resolveTypography', 'TEXT_ALIGNMENTS', 'TypographySchema',
    ];

    for (const symbol of added) {
      expect(values).toContain(symbol);
    }
    expect(values).toHaveLength(117);
  });
});

describe('the two bounds of a font size', () => {
  it('derives the ceiling from MAX_SHEET_MM instead of restating it, in both directions', () => {
    // Both halves are pinned on purpose. The first stops the derivation from being "tidied" into
    // the pre-computed factor, which yields 5079.999999999999 and would move the ceiling by a
    // fraction of a point; the second is what makes "the same bound in the other unit" a claim
    // rather than a coincidence.
    expect(MAX_FONT_SIZE_PT).toBe(14_400);
    expect(mmFromPt(MAX_FONT_SIZE_PT)).toBe(MAX_SHEET_MM);
    expect(ptFromMm(MAX_SHEET_MM)).toBe(MAX_FONT_SIZE_PT);
    expect(MIN_FONT_SIZE_PT).toBe(1);
  });

  it('does not promise that the two conversions are inverses, and here is a value that is not', () => {
    // A property a consumer has to know: 223 of the first 1 000 integer point sizes do not
    // survive a round trip. Pinning one of them is what stops the docstring's warning from
    // becoming folklore -- and what would redden if someone "simplified" one of the two bodies.
    expect(ptFromMm(mmFromPt(3))).not.toBe(3);
    expect(mmFromPt(10)).toBe(3.5277777777777777);
  });
});
```

#### Les dix-sept allers-retours, et les cinq contrôles positifs qui sont des décisions

```ts
describe('a style survives the parse field by field', () => {
  // SEVENTEEN round trips, one per style field, and they are the only guard that catches an
  // amputated OPTIONAL field. Written as one `it` per shape rather than one per field so the
  // failure names the shape, and comparing the WHOLE object rather than field by field so that a
  // field the schema drops shows up as a missing key instead of an undefined read.
  it('keeps all five fields of a Typography -- 5 of the 17', () => {
    const parsed = TypographySchema.parse(RECIPE_TYPOGRAPHY_COMPLETE);

    expect(parsed).toStrictEqual(RECIPE_TYPOGRAPHY_COMPLETE);
    // `.sort()` on the fresh array and NOT `.toSorted()`: this package declares `lib: ["ES2022"]`
    // and MEASURED, `toSorted` is TS2550 there -- "Do you need to change your target library?".
    // The answer is no: AGENTS.md 7 forbids loosening a tsconfig to unblock a compilation.
    expect(Object.keys(parsed).sort()).toStrictEqual([
      'bold', 'color', 'family', 'italic', 'sizePt',
    ]);
  });

  it('keeps all three fields of a BoxStyle, its four edges and its four insets -- 11 of the 17', () => {
    const parsed = BoxStyleSchema.parse(RECIPE_BOX_COMPLETE);

    expect(parsed).toStrictEqual(RECIPE_BOX_COMPLETE);
    expect(Object.keys(parsed).sort()).toStrictEqual(['background', 'border', 'padding']);
    expect(Object.keys(parsed.border ?? {}).sort()).toStrictEqual(['bottom', 'left', 'right', 'top']);
    expect(Object.keys(parsed.padding ?? {}).sort()).toStrictEqual(['bottom', 'left', 'right', 'top']);
  });

  it('keeps the alignment of a text node -- the 17th', () => {
    const node = { type: 'text', id: 't', content: [], align: 'end' };

    expect(TextNodeSchema.parse(node)).toStrictEqual(node);
  });

  it('REFUSES an empty style object, because absence is the one spelling of "no style"', () => {
    // `N27`. An editor that opens a style panel and sets nothing legitimately BUILDS a `box: {}`;
    // what it must not do is SAVE one. Accepting it would store two spellings of one fact, and
    // four already-planned consumers distinguish them -- a diff, a dirty-state flag, a content
    // hash, an undo history. NOT ONE OF THEM READS A VALUE, which is why "every field is optional
    // so `box?.background` yields undefined either way" answered the wrong question.
    for (const schema of [BoxStyleSchema, TypographySchema, BoxBorderSchema]) {
      const refusal = schema.safeParse({});

      expect(refusal.success).toBe(false);
      if (!refusal.success) {
        expect(refusal.error.issues[0]?.message).toBe(
          'An empty style object is not a style; omit the field',
        );
      }
    }

    expect(BoxStyleSchema.safeParse({ border: {} }).success).toBe(false);
  });

  it('REFUSES a key present with an undefined value, which is the third spelling', () => {
    // The trap the predicate exists for: `Object.keys({ background: undefined })` counts ONE, so a
    // key-count guard would accept this and leave three spellings instead of one. The predicate is
    // on VALUES. A JSON round trip erases the difference -- `JSON.stringify` drops `undefined` --
    // but an editor comparing objects it built itself never goes through JSON.
    expect(BoxStyleSchema.safeParse({ background: undefined }).success).toBe(false);
  });

  it('strips a key it does not know, so a style parse is not a persistence boundary', () => {
    // `z.object` and not `z.strictObject`: the price is this silent loss WITHIN a version, which
    // the schema stamp does not cover. `strictObject` was refused because its refusal reports
    // `path: []`, so lot C8 could not point at the offending key from the path.
    expect(TypographySchema.parse({ sizePt: 10, letterSpacing: 0.2 })).toStrictEqual({ sizePt: 10 });
  });

  it('accepts both letter cases of a colour, and stores them UNCHANGED', () => {
    // The decision and its price in one assertion: nothing folds the case on parse, so an
    // equality comparison between the two spellings fails and a consumer that compares colours
    // folds the case itself.
    expect(ColorSchema.parse('#FFAA00')).toBe('#FFAA00');
    expect(ColorSchema.parse('#ffaa00')).toBe('#ffaa00');
    expect(ColorSchema.parse('#FFAA00')).not.toBe(ColorSchema.parse('#ffaa00'));
  });

  it('REFUSES a rule of zero width, and the message says how to spell "no rule"', () => {
    // `N28`, and the ONE assertion of this file that turns on the shape of `BoxBorder` rather than
    // on a bound. `PageMargins` has FOUR REQUIRED edges, so `0` is its only spelling of "no margin"
    // and refusing it "would be a rule of typography". `BoxBorder` has FOUR OPTIONAL edges, so
    // absence already spells it and `0` is a second spelling. Same repository, opposite shapes,
    // opposite predicates -- and the message carries the remedy rather than a prescription.
    const refusal = BorderEdgeSchema.safeParse({ width: 0, color: '#1b3a6f' });

    expect(refusal.success).toBe(false);
    if (!refusal.success) {
      expect(refusal.error.issues[0]?.message).toBe(
        'A rule has a positive width; omit the edge to declare no rule',
      );
    }
    // And the counter-check, because a `gt(0)` that refused everything would pass the test above:
    // 0.28 mm is 0.8 pt, a standard editorial thickness, and it is the value the two-decimal
    // formula of ADR 0006 would have REFUSED -- which is why no such formula is written here.
    expect(BorderEdgeSchema.parse({ width: 0.28, color: '#1b3a6f' }).width).toBe(0.28);
  });

  it('accepts a padding of four zeroes', () => {
    const zeroes = { top: 0, right: 0, bottom: 0, left: 0 };

    expect(BoxSpacingSchema.parse(zeroes)).toStrictEqual(zeroes);
  });
});
```

#### L'aller-retour à neuf sites — le seul filet possible sur `Template`

```ts
describe('the ninth accrual site, which no type assertion can guard', () => {
  it('carries a style at ALL NINE sites through a full parseTemplate round trip', () => {
    // ⚠️ `Template` IS THE NINTH SITE AND IT IS STRUCTURALLY UNGUARDABLE. Its type is INFERRED
    // from its schema (`export type Template = z.infer<typeof TemplateSchema>`), so a
    // `TEMPLATE_KEYS_IN_STEP` pair would compare an annotation with itself -- tautological. It is
    // also one of the nine sites the mutation matrix measured at exit 0.
    //
    // The only net left is a JSON round trip on a literal that CARRIES the field, and the
    // repository's two existing round trips (`table.test.ts`, `page.test.ts`) each see only the
    // sites their own fixture happens to reach. This `it` is the one that reaches all nine: five
    // `box` (text, image, container, table, tableRow), four `typography` (text, literal, binding,
    // pageField) and the `align`, the last two INSIDE A PAGE BAND -- which is where the backward
    // -compatibility measurement showed the loss running deepest.
    const nineSites = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: 'facture-c5',
      name: 'Facture — les neuf sites',
      version: '1.0.0',
      page: {
        sheet: { width: 210, height: 297 },
        margins: { top: 20, right: 20, bottom: 20, left: 20 },
        header: [],
        footer: [
          {
            on: 'every',
            content: {
              type: 'container',
              id: 'ftr',
              box: { border: { top: { width: 0.28, color: '#1b3a6f' } } },
              children: [
                {
                  type: 'text',
                  id: 'ftr-num',
                  box: { padding: { top: 1, right: 0, bottom: 0, left: 0 } },
                  typography: { sizePt: 8 },
                  align: 'center',
                  content: [
                    { kind: 'literal', text: 'Page ', typography: { italic: true } },
                    { kind: 'pageField', field: 'number', typography: { bold: true } },
                  ],
                },
              ],
            },
          },
        ],
      },
      root: {
        type: 'container',
        id: 'racine',
        box: { background: '#F2F4F8' },
        children: [
          { type: 'image', id: 'logo', src: 'logo.png', box: { padding: { top: 0, right: 0, bottom: 2, left: 0 } } },
          {
            type: 'text',
            id: 'titre',
            box: RECIPE_BOX_COMPLETE,
            typography: RECIPE_TYPOGRAPHY_COMPLETE,
            align: 'end',
            content: [{ kind: 'binding', value: { kind: 'path', path: 'facture.numero' }, typography: { bold: false } }],
          },
          {
            type: 'table',
            id: 'lignes',
            box: { background: '#FFFFFF' },
            columns: [{ id: 'c', width: 1, align: 'start' }],
            header: [],
            body: [
              {
                type: 'tableRow',
                id: 'r',
                box: { padding: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 } },
                cells: [{ columnId: 'c', children: [] }],
              },
            ],
            footer: [],
          },
        ],
      },
    };

    const parsed = parseTemplate(nineSites);

    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(JSON.parse(JSON.stringify(parsed))).toStrictEqual(nineSites);
  });
});
```

#### Les refus, et les deux résolutions

```ts
describe('what a style refuses, with the code and the path', () => {
  const issuesOf = (
    schema: { safeParse: (v: unknown) => z.ZodSafeParseResult<unknown> },
    value: unknown,
  ) => {
    const result = schema.safeParse(value);
    return (result.error?.issues ?? []).map((issue) => ({
      code: issue.code,
      path: issue.path,
      message: issue.message,
    }));
  };

  it.each([
    ['N01 three digits', { color: '#fa0' }, 'invalid_format'],
    ['N02 a CSS name', { color: 'red' }, 'invalid_format'],
    ['N03 an alpha channel', { color: '#1b3a6fff' }, 'invalid_format'],
    ['N04 a functional notation', { color: 'rgb(1,2,3)' }, 'invalid_format'],
    ['N05 a system colour', { color: 'Canvas' }, 'invalid_format'],
    ['N06 a number', { color: 0x1b3a6f }, 'invalid_type'],
  ])('refuses %s on the path ["color"]', (_label, value, code) => {
    expect(issuesOf(TypographySchema, value)).toStrictEqual([
      { code, path: ['color'], message: expect.any(String) },
    ]);
  });

  it('names the colour form once, and the message is a constant', () => {
    expect(issuesOf(TypographySchema, { color: 'red' })[0]?.message).toBe(
      'A colour is six hexadecimal digits behind a hash, as #1b3a6f',
    );
    // No interpolation of the document, per ADR 0003: an error payload stays safe to log.
    expect(issuesOf(BoxStyleSchema, { background: '#GGGGGG' })).toStrictEqual([
      {
        code: 'invalid_format',
        path: ['background'],
        message: 'A colour is six hexadecimal digits behind a hash, as #1b3a6f',
      },
    ]);
  });

  it.each([
    ['N07 zero', { sizePt: 0 }, 'too_small', 'A font size is at least 1 pt'],
    ['N08 half a point', { sizePt: 0.5 }, 'too_small', 'A font size is at least 1 pt'],
    ['N09 past the ceiling', { sizePt: 14_401 }, 'too_big', 'A font size is at most 14400 pt'],
  ])('refuses a size %s', (_label, value, code, message) => {
    expect(issuesOf(TypographySchema, value)).toStrictEqual([{ code, path: ['sizePt'], message }]);
  });

  it('refuses NaN and Infinity, and the Infinity message is the one lot C8 inherits', () => {
    expect(issuesOf(TypographySchema, { sizePt: Number.NaN })).toStrictEqual([
      { code: 'invalid_type', path: ['sizePt'], message: 'Invalid input: expected number, received NaN' },
    ]);
    // MEASURED and recorded rather than fixed: "expected number, received number". Six numeric
    // positions of this lot carry the defect, and it is a reserve already booked to lot C8.
    expect(issuesOf(TypographySchema, { sizePt: Number.POSITIVE_INFINITY })).toStrictEqual([
      { code: 'invalid_type', path: ['sizePt'], message: 'Invalid input: expected number, received number' },
    ]);
  });

  it('refuses an empty family and a non-boolean bold or italic', () => {
    expect(issuesOf(TypographySchema, { family: '' })).toStrictEqual([
      { code: 'too_small', path: ['family'], message: 'A font family name is required' },
    ]);
    expect(issuesOf(TypographySchema, { bold: 'yes' })).toStrictEqual([
      { code: 'invalid_type', path: ['bold'], message: 'Invalid input: expected boolean, received string' },
    ]);
    expect(issuesOf(TypographySchema, { italic: 'yes' })).toStrictEqual([
      { code: 'invalid_type', path: ['italic'], message: 'Invalid input: expected boolean, received string' },
    ]);
  });

  it('ACCEPTS `justify` on a text node and REFUSES it on a column, which is the whole boundary', () => {
    // The two halves of one decision, in one `it`, because separating them would let either half
    // pass alone -- and either half alone is the bug. `justify` is what `ast/types.ts` used to
    // promise this lot; the lot delivers it on the tuple that has runs, and NOT on the one that
    // states a default for a whole column.
    //
    // The refusal message on the column is the THIRD form of incompatibility, measured (`m2.mjs`),
    // and it is exactly why this tuple is not the one that was widened.
    expect(
      TextNodeSchema.safeParse({ type: 'text', id: 't', content: [], align: 'justify' }).success,
    ).toBe(true);

    expect(issuesOf(TableColumnSchema, { id: 'c', width: 1, align: 'justify' })).toStrictEqual([
      {
        code: 'invalid_value',
        path: ['align'],
        message: 'Invalid option: expected one of "start"|"center"|"end"',
      },
    ]);
  });

  it('refuses an unknown alignment on a text node', () => {
    // The non-inertia counter-check of the `it` above: `TEXT_ALIGNMENTS` accepting `justify` must
    // not mean it accepts anything. Four members, and a fifth is refused.
    expect(issuesOf(TextNodeSchema, { type: 'text', id: 't', content: [], align: 'middle' })).toStrictEqual([
      {
        code: 'invalid_value',
        path: ['align'],
        message: 'Invalid option: expected one of "start"|"center"|"end"|"justify"',
      },
    ]);
  });

  it.each([
    ['N18 an edge with no colour', { border: { bottom: { width: 0.3 } } }, 'invalid_type', ['border', 'bottom', 'color']],
    ['N19 a scalar shorthand padding', { padding: 2 }, 'invalid_type', ['padding']],
    ['N20 a padding of three edges', { padding: { top: 1, right: 1, bottom: 1 } }, 'invalid_type', ['padding', 'left']],
  ])('refuses %s', (_label, value, code, path) => {
    expect(issuesOf(BoxStyleSchema, value)).toStrictEqual([{ code, path, message: expect.any(String) }]);
  });

  it.each([
    ['N21 a negative inset', { padding: { top: -0.1, right: 1, bottom: 1, left: 1 } }, 'too_small', ['padding', 'top'], 'A length cannot be negative'],
    ['N22 a negative rule width', { border: { top: { width: -1, color: '#1b3a6f' } } }, 'too_small', ['border', 'top', 'width'], 'A length cannot be negative'],
    ['N23 an inset past the sheet', { padding: { top: 5081, right: 1, bottom: 1, left: 1 } }, 'too_big', ['padding', 'top'], 'A length is at most 5080 mm'],
  ])('refuses %s', (_label, value, code, path, message) => {
    expect(issuesOf(BoxStyleSchema, value)).toStrictEqual([{ code, path, message }]);
  });
});

describe('the two resolutions', () => {
  it('merges typography PROPERTY BY PROPERTY, the run winning each one', () => {
    // The contract is the per-property merge, not a whole-object override: a run declaring only
    // `bold` must keep the block's family and size. A test that pinned the object wholesale would
    // pass on an implementation that returns `run ?? block`, which is a different function.
    const block: Typography = { family: 'EB Garamond', sizePt: 10.5, color: '#22262b' };
    const run: Typography = { bold: true, color: '#8C3A1B' };

    expect(resolveTypography({ run, block })).toStrictEqual({
      family: 'EB Garamond', sizePt: 10.5, bold: true, italic: undefined, color: '#8C3A1B',
    });
  });

  it('returns undefined for what neither source declares, and resolves nothing else', () => {
    // The honest half of the name: the five values a document does not declare are decided by the
    // renderer, and ADR 0007 names them as a debt. A type promising five defined fields would
    // have been a lie -- measured, 5 x TS2322.
    expect(resolveTypography({})).toStrictEqual({
      family: undefined, sizePt: undefined, bold: undefined, italic: undefined, color: undefined,
    });
    expect(resolveTypography({ block: styleOfCase('b').body })).toStrictEqual({
      family: 'Inter', sizePt: 9, bold: undefined, italic: undefined, color: '#3A3A3A',
    });
  });

  it('gives the BLOCK the last word on an alignment, over its column', () => {
    // A precedence is a decision of the contract, not a paraphrase of the body: this is the one
    // assertion that would redden if someone swapped the two terms.
    expect(resolveTextAlign({ text: 'end', column: 'start' })).toBe('end');
    expect(resolveTextAlign({ column: 'start' })).toBe('start');
    expect(resolveTextAlign({ text: 'center' })).toBe('center');
    expect(resolveTextAlign({})).toBeUndefined();
  });
});
```

#### Ce que ce fichier force, et ce qui reste silencieux

| Geste | Porte |
| :--- | :--- |
| Les dix assertions | **porte 3** — c'est leur seule raison d'être. `pnpm run test` ne les exécute pas |
| Les dix-sept allers-retours et l'aller-retour à neuf sites | **porte 4 seulement** |
| **Un `expect(err.code)` ou `expect(err.to)`** sur `TemplateMigrationError` | **échouerait** — mesuré : les champs propres sont `["stack","message","name","fromVersion"]` |
| **Un `it` qui attendrait `invalid_format` pour un `.int()`** | **échouerait** — zod 4 range `.int()` sous `invalid_type`. Sans objet ici : `bold?: boolean` supprime le site |
| `.toSorted()` | **porte 3**, `TS2550` — mesuré, et la contrainte est **acceptée** plutôt que desserrée |
| **Écrire ces assertions dans `src/style/instep.ts`** | compilerait ; refusé pour trois raisons mécaniques (couverture faussée, départ dans `dist`, engagement de compatibilité) |

---

### 3.12 `packages/core/src/style/__tests__/fixtures.ts` — **nouveau**

**Compilé à exit 0**, 98 lignes. Deux règles héritées de `ast/__tests__/fixtures.ts`, toutes deux
mécaniques : **aucune factory exportée ne reste non appelée** (`styleOfCase` est appelée par [§3.11]),
et **rien n'est importé de `vitest`** (ce fichier part dans `dist`).

```ts
import type { BoxStyle, Typography } from '../style.js';

/** The ink of appearance A: a navy corporate invoice. */
const NAVY = '#1b3a6f';
/** The ink of appearance B, in UPPER CASE deliberately: both letter cases are legal, and the
 * fixture is where that decision is exercised rather than merely written down. */
const RUST = '#8C3A1B';

/**
 * A complete box, for the round-trip assertions: every field of {@link BoxStyle} present, every
 * field of {@link BoxBorder} present, every edge of {@link BoxSpacing} present.
 *
 * "Complete" is not decoration here. MEASURED, an entire border edge can disappear from the
 * schema with no compiler diagnostic and no failing test -- so the round trip has to compare a
 * literal that CARRIES every field, or it sees nothing. It is also the shape whose cost is
 * measured at 16 values on the bounded-shape count.
 */
export const RECIPE_BOX_COMPLETE: BoxStyle = {
  background: '#F2F4F8',
  border: {
    top: { width: 0.28, color: NAVY },
    right: { width: 0.28, color: NAVY },
    bottom: { width: 0.28, color: NAVY },
    left: { width: 0.28, color: NAVY },
  },
  padding: { top: 2, right: 3, bottom: 2, left: 3 },
};

/**
 * A complete typography: all five fields present, for the same reason.
 *
 * `sizePt: 10.5` and not `10`: a half-point is what an editorial size actually looks like, and
 * MEASURED, no half-point from 6 to 72 pt is refused by the two-decimal formula ADR 0006 warned
 * this lot about -- so this literal is also the counter-example to that warning.
 */
export const RECIPE_TYPOGRAPHY_COMPLETE: Typography = {
  family: 'EB Garamond',
  sizePt: 10.5,
  bold: true,
  italic: false,
  color: NAVY,
};

/**
 * Appearance A: navy, an outer frame, one horizontal rule per row, generous inset.
 *
 * `legalAlign` is `'start'` here and `'justify'` in B, and that ONE key is what exercises the
 * fourth member of `TEXT_ALIGNMENTS`. Neither literal declares an empty style object: `{}` is
 * REFUSED, and a fixture is the first place a refused shape would slip back in.
 */
export const RECIPE_STYLE_A = {
  band: { background: '#F2F4F8', padding: { top: 2, right: 3, bottom: 2, left: 3 } },
  heading: { family: 'EB Garamond', sizePt: 18, bold: true, color: NAVY },
  body: { family: 'EB Garamond', sizePt: 10.5, color: '#22262b' },
  emphasis: { bold: true },
  rule: { width: 0.28, color: NAVY },
  legalAlign: 'start',
} as const satisfies Readonly<
  Record<string, BoxStyle | Typography | { width: number; color: string } | TextAlignment>
>;

/** Appearance B: rust, no frame, one rule under the heading, a sans face, justified mentions. */
export const RECIPE_STYLE_B = {
  band: {
    border: { bottom: { width: 1.2, color: RUST } },
    padding: { top: 1, right: 1, bottom: 1, left: 1 },
  },
  heading: { family: 'Inter', sizePt: 14, bold: false, italic: true, color: RUST },
  body: { family: 'Inter', sizePt: 9, color: '#3A3A3A' },
  emphasis: { color: RUST },
  rule: { width: 1.2, color: RUST },
  legalAlign: 'justify',
} as const satisfies Readonly<
  Record<string, BoxStyle | Typography | { width: number; color: string } | TextAlignment>
>;

/**
 * `as const satisfies` and NOT an annotation, and the reason is the one `STANDARD_SHEETS_MM`
 * records with its measurement: annotated `Readonly<Record<string, X>>`, `RECIPE_STYLE_A.band` is
 * `X | undefined` under `noUncheckedIndexedAccess`, so every consumer -- including a test -- would
 * have to handle an absent key, and `!` is forbidden. `satisfies` keeps the literal keys and still
 * checks every entry.
 *
 * A FUNCTION and not a constant, for the reason `compatibilityPage` records: a module-level object
 * handed to several tests is shared BY REFERENCE, and one test normalising it changes what another
 * one sees.
 */
export const styleOfCase = (which: 'a' | 'b'): typeof RECIPE_STYLE_A | typeof RECIPE_STYLE_B =>
  which === 'a' ? RECIPE_STYLE_A : RECIPE_STYLE_B;
```

> **Deux styles, UNE structure** — c'est la moitié mécanique du critère de recette : `RECIPE_STYLE_A`
> et `RECIPE_STYLE_B` sont ce qu'un relecteur échange, et l'échange ne doit rien changer d'autre,
> de sorte que `collectTemplateDataPaths` rende **la même liste**. La moitié **visuelle** est une
> **revue humaine** ; aucun `it` ne peut en tenir lieu, et le plan nomme qui la fait.

**Ce que ce fichier force :** le `satisfies` **porte 3** (une entrée qui ne satisfait pas l'union
est `TS2322`) ; l'appel de `styleOfCase` **porte 4** (une factory non appelée baisse la couverture
de fonctions sans qu'un test rougisse — c'est la règle écrite de `ast/__tests__/fixtures.ts`).

---

### 3.13 `packages/core/src/ast/__tests__/nodes.test.ts` — **modifié — c'est INC-0, et il vient AVANT tout champ de style**

**Compilé à exit 0**, et **les onze mutations passent d'exit 0 à exit 1** — c'est le critère de
sortie mécanique de l'incrément, et il est mesuré (`§C.3`).

#### Diff conceptuel

| | |
| :--- | :--- |
| **Ce qui s'ajoute** | **quinze `import type`** dans le bloc des lignes 3-22 · **huit paires `*_KEYS_IN_STEP`**, insérées après la ligne **140** (fin de `TABLE_COLUMN_KEYS_IN_STEP`, déclarée ligne 136) |
| **Ce qui change** | la justification de `TABLE_CELL_KEYS_IN_STEP`, lignes **112-113** — « *a per-cell alignment override is lot C5's declared future* » est **REDIRIGÉ** (INC-7) |
| **Ce qui ne change pas** | les neuf assertions existantes, leurs docstrings, et les 23 `it` du fichier |

#### Les gestes

**① Le bloc d'import** gagne, en ordre alphabétique : `type ConditionNode`, `type ConditionNodeSchema`,
`type ContainerNode`, `type ContainerNodeSchema`, `type ImageNode`, `type ImageNodeSchema`,
`type LoopNode`, `type LoopNodeSchema`, `type TextBindingSegment`, `type TextBindingSegmentSchema`,
`type TextLiteralSegment`, `type TextLiteralSegmentSchema`, `type TextNode`,
`type TextPageFieldSegment`, `type TextPageFieldSegmentSchema`. `TextNodeSchema` est **déjà**
importé comme valeur : `typeof TextNodeSchema` suffit.

**② Après la ligne 140 — les huit paires.**

```ts
/**
 * ## The eight pairs lot C5 owed this file BEFORE it wrote one style field
 *
 * The four pairs above and the four in `page/__tests__/page.test.ts` cover exactly the six sites
 * a style could attach to that the type gate WAS watching. MEASURED, one mutation per site on a
 * copy of `core/src`, an OPTIONAL field added to the schema alone: of the fifteen sites in this
 * package, NINE compiled at exit 0 with no assertion refusing -- the three segment kinds,
 * `TextNode`, `ImageNode`, `ContainerNode`, `LoopNode`, `ConditionNode`, and `Template`. Which
 * is to say: the eight sites lot C5 attaches a style to were precisely the eight nobody watched.
 *
 * And nothing else catches it. MEASURED on the same copy with four schemas deliberately diverging
 * from their types: 591 tests out of 591 PASS. A field absent from the schema is not an uncovered
 * branch, it is a branch that does not exist, so the 90 % threshold sees nothing either.
 *
 * The reason the objects themselves are not compared is the one the block above already gives:
 * under `exactOptionalPropertyTypes` an optional field added to ONE side leaves the two types
 * mutually assignable, and an optional field is precisely the shape a backward-compatible new
 * field takes. `keyof` compares KEY SETS, so it catches both directions.
 *
 * The last two are CONTRE-ÉPREUVES OF THE CUT, not preparation for a field: `loop` and
 * `condition` carry NO style, deliberately -- they produce N sequences or nothing, so a box on
 * them has no subject. Their pairs redden the day someone adds a field to one side only, which
 * is how a cut stays a cut rather than becoming a habit.
 */
export const TEXT_LITERAL_SEGMENT_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof TextLiteralSegmentSchema>,
  keyof TextLiteralSegment
> = true;

export const TEXT_BINDING_SEGMENT_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof TextBindingSegmentSchema>,
  keyof TextBindingSegment
> = true;

export const TEXT_PAGE_FIELD_SEGMENT_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof TextPageFieldSegmentSchema>,
  keyof TextPageFieldSegment
> = true;

export const TEXT_NODE_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof TextNodeSchema>,
  keyof TextNode
> = true;

export const IMAGE_NODE_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof ImageNodeSchema>,
  keyof ImageNode
> = true;

export const CONTAINER_NODE_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof ContainerNodeSchema>,
  keyof ContainerNode
> = true;

export const LOOP_NODE_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof LoopNodeSchema>,
  keyof LoopNode
> = true;

export const CONDITION_NODE_KEYS_IN_STEP: MutuallyAssignable<
  keyof z.infer<typeof ConditionNodeSchema>,
  keyof ConditionNode
> = true;
```

**③ Lignes 112-113 — la justification de `TABLE_CELL_KEYS_IN_STEP`, REDIRIGÉE** (INC-7). La phrase
« *`TableCell` is first because it is the likeliest site: a per-cell alignment override is lot C5's
declared future.* » devient :

```ts
 * `TableCell` was said here to be the likeliest site, "a per-cell alignment override is lot C5's
 * declared future". IT WAS NOT A DECLARED FUTURE: ADR 0005 wrote "s'IL la décide", a conditional
 * reservation this comment hardened into a promise. Lot C5 delivered the override on the BLOCK IN
 * THE CELL instead -- a cell is not a node, it has no `id`, and an editor Command cannot address
 * it. THE PAIR STAYS, and it earned its place: it is one of the six sites that DID redden when a
 * field was added to a schema alone, and it is what a future field on `TableCell` will meet.
```

#### Ce que ce fichier force, et ce qui reste silencieux

| Geste | Porte |
| :--- | :--- |
| Les huit paires | **porte 3, et c'est TOUT ce qui garde le lot.** Onze mutations vérifiées : **exit 0 → exit 1** |
| Écrire ces paires **après** les champs | l'oubli d'un schéma serait **silencieux pendant tout le lot**, et un incrément intermédiaire passerait les quatre portes avec un type et un schéma divergents. C'est pourquoi INC-0 est **publiable seul** et **ne se coupe jamais** |
| La paire `TEMPLATE_KEYS_IN_STEP` | **impossible** — `Template` est `z.infer<typeof TemplateSchema>`, l'assertion serait tautologique. Signalement H, et le filet est l'aller-retour de [§3.11] |
| La correction de la justification | **aucune porte** — c'est de la prose, INC-7 |

---

### 3.14 `packages/core/src/ast/__tests__/fixtures.ts` — **modifié**

**Compilé à exit 0**, et le recalibrage est **mesuré par bisection sur le vrai
`assertBoundedShape`** : **242 → 285 valeurs (+43, +17,8 %)**, profondeur **18 → 18 (inchangée)**,
occupation de `maxNodes` **0,24 % → 0,29 %**.

#### Diff conceptuel

| | |
| :--- | :--- |
| **Ce qui s'ajoute** | un `import type { Typography }` · une constante locale `RULE` · une factory `litStyled` · **un style à six des neuf sites** que cette fixture possède |
| **Ce qui change** | le nœud `tf-montant` passe de l'appel `txt(...)` à un littéral complet, parce qu'il porte **quatre** champs |
| **Ce qui ne change pas** | `MutuallyAssignable` · `lit`, `bind`, `p`, `txt`, `cell`, `round`, `mul` · `montantLigne`, `totalDeclare` · les cinq colonnes, les ids, la **structure** · `RECIPE_TEMPLATE.page` (la page la plus simple, délibérément) · **`walk(root)` rend toujours 19 nœuds** et `collectTemplateDataPaths` toujours `["facture.numero","facture.lignes"]` — mesuré |

#### Les gestes, dans l'ordre des lignes de HEAD

**① Ligne 28** — après l'import de `../nodes.js` : `import type { Typography } from '../../style/style.js';`

**② Lignes 37-38** — après `lit` et `bind`, la docstring des neuf sites, `RULE` et `litStyled` :

```ts
/**
 * ## The nine style sites of lot C5, carried by this fixture on purpose
 *
 * The JSON round trip of `table.test.ts` is the ONLY net under `Template`, which is the ninth
 * accrual site and the one that CANNOT have a `*_KEYS_IN_STEP` pair: `Template` is inferred from
 * its schema, so the assertion would compare an annotation with itself. And that net only sees a
 * field the literal it compares actually CARRIES. So this fixture carries one, at every site it
 * has a node for.
 *
 * Deliberately MINIMAL values -- one field per site, not a complete style. The complete shapes
 * live in `style/__tests__/fixtures.ts`, where the seventeen round trips need them; here the
 * point is PRESENCE at each site, and a fuller literal would inflate this fixture's calibration
 * baseline for nothing.
 */
const RULE = { width: 0.28, color: '#1b3a6f' } as const;
const litStyled = (text: string, typography: Typography): TextSegment => ({
  kind: 'literal',
  text,
  typography,
});
```

**③ Ligne 93 — `RECIPE_TABLE`, site 1 :** `box: { border: { top: RULE, bottom: RULE } },` avec un
commentaire qui renvoie à la docstring corrigée d'`ast/types.ts:366`.

**④ Ligne 106 — la ligne d'en-tête, site 2 :**
`box: { background: '#F2F4F8', padding: { top: 1, right: 1, bottom: 1, left: 1 } },`

**⑤ Lignes 146-147 — la cellule de total, sites 3 à 6 en un nœud**, parce que c'est le nœud où les
quatre champs ont un sujet :

```ts
        cell(
          'montant',
          {
            type: 'text',
            id: 'tf-montant',
            box: { border: { top: RULE }, padding: { top: 1, right: 0, bottom: 0, left: 0 } },
            typography: { family: 'EB Garamond', sizePt: 11 },
            align: 'end',
            content: [{ kind: 'binding', value: totalDeclare, typography: { bold: true } }],
          },
        ),
```

**⑥ Lignes 182-185 — `RECIPE_TEMPLATE.root`, sites 7 à 9 :** un `box` sur le conteneur racine, et
deux `typography` de segment dans le titre — l'un sur un `literal`, l'autre sur un `binding`.

```ts
  root: {
    type: 'container',
    id: 'racine',
    box: { padding: { top: 0, right: 0, bottom: 4, left: 0 } },
    children: [
      txt('titre', [
        litStyled('Facture ', { sizePt: 18, bold: true }),
        { kind: 'binding', value: p('facture.numero'), typography: { sizePt: 18, color: '#1b3a6f' } },
      ]),
      RECIPE_TABLE,
    ],
  },
```

> ⚠️ **Cette fixture ne couvre que SIX des neuf porteurs**, et il faut le dire : elle n'a **ni
> nœud image, ni segment `pageField`**. Les deux manquants sont couverts par l'aller-retour à neuf
> sites de [§3.11], qui construit son propre `Template`. **Ajouter une image et une bande à
> `RECIPE_TEMPLATE` a été écarté par mesure** : `visitor.test.ts` épingle `walk(root)` à **19
> nœuds** et un nœud de plus le fait rougir — un coût sans contrepartie, puisque le neuvième site
> est déjà gardé ailleurs.

#### Ce que ce fichier force, et ce qui reste silencieux

| Geste | Porte |
| :--- | :--- |
| Un champ de style au type et pas au schéma, **sur un site que la fixture porte** | **porte 4** — l'aller-retour JSON de `table.test.ts:373` rougit, et c'est le seul filet possible sur `Template` |
| **La liste de clés de `RECIPE_TABLE`** | **porte 4** — et elle a effectivement rougi : voir [§3.16 bis] |
| Un nœud de plus dans `root.children` | **porte 4** — `visitor.test.ts` épingle 19 nœuds |
| `RULE as const` employé comme `BorderEdge` | **porte 3** — un objet `readonly` littéral satisfait `BorderEdge`, vérifié |
| L'inflation du compte de valeurs | **aucune porte** — `maxNodes` est à 0,29 % d'occupation. Le seul « filet » est le contrôle de calibrage du plan, et **c'est pourquoi le chiffre est remesuré ici plutôt que recopié** |

---

### 3.15 `packages/core/src/template/migrate.test.ts` — **modifié**

**Compilé à exit 0, et le test a effectivement rougi avant correction** — c'est la mesure la plus
importante du fichier.

#### Diff conceptuel

| | |
| :--- | :--- |
| **Ce qui s'ajoute** | `[5, 6]` au littéral de chaîne, ligne **162** · un paragraphe de commentaire · **deux `it`** neufs |
| **Ce qui change** | rien d'autre : `toHaveLength(CURRENT_SCHEMA_VERSION - 1)` s'ajuste **seul** |
| **Ce qui ne change pas** | les 14 autres `it` · `validTemplate` · les assertions de la 4 → 5 |

#### Les gestes

**① Ligne 162** — `[4, 5],` est suivi de `[5, 6],`, et le commentaire des lignes 165-168 gagne :

```ts
    // LOT C5 IS BACK TO ONE NET, and this line is it. Every field of that lot is optional, so
    // nothing narrows and nothing widens a union: the compiler is silent, the coverage
    // threshold is silent, and the 590 other tests stay green. MEASURED -- bumping
    // CURRENT_SCHEMA_VERSION to 6 reddens exactly ONE test in this repository, this one.
```

**② UN `it` neuf**, après celui-là :

> ⚠️ **La révision 1 en proposait DEUX, et le premier était REDONDANT — il est supprimé.** Il
> s'intitulait « *refuses a document stamped 6 by a build that understands 5, and the stamp alone
> does it* », et le dépôt le porte **déjà**, à `migrate.test.ts:506` :
> `it('refuses a document written by a newer release, naming both versions', …)`. Vérifié à HEAD, les
> deux tests sont le même : **même forme relative** (`CURRENT_SCHEMA_VERSION + 1`, et non un littéral
> `7`), **même `fromVersion`**, **mêmes fragments de message**. Le seul apport du doublon était
> `toBe` sur le message entier là où l'existant fait trois `toContain` — c'est-à-dire **une
> assertion**, pas un test. Elle est **ajoutée au test existant** :
>
> ```ts
>         // Le message ENTIER, caractère pour caractère : c'est ce que lot C8 aura à narrer, et
>         // trois `toContain` laissent passer une reformulation entre les fragments.
>         expect(error.message).toBe(
>           `Template uses schema version ${CURRENT_SCHEMA_VERSION + 1} but this build understands at most ${CURRENT_SCHEMA_VERSION}. It was written by a newer release of Openview; upgrade before opening it.`,
>         );
> ```
>
> **Pourquoi la suppression et pas la coexistence.** `AGENTS.md` §5 interdit le test tautologique, et
> un doublon est pire : c'est **deux sites à maintenir** pour un contrat, et le jour où le message
> change, l'un des deux rougit sans que personne sache lequel fait foi. La règle qui s'applique est
> celle que le dépôt écrit déjà pour les bornes — « *deux copies d'une borne dérivent* » — et elle
> vaut pour une assertion comme pour une constante.
>
> **Ce qui est PERDU par la suppression, et c'est nul :** la note « *ni `err.code` ni `err.to`
> n'existe* » [signalement G] n'était pas assurée par ce test, elle y était **commentée**. Elle vit
> dans l'ADR 0007, qui est son lieu.

```ts
  it('stamps a v5 document to 6 without transforming one value of it', () => {
    // Contract of INC-4: the 5 -> 6 entry is a STAMP. Measured, delta exactly 0 values and 0
    // levels -- so the second pass of the shape guard has nothing to catch here, unlike 4 -> 5.
    const stampedFive = { ...validTemplate, schemaVersion: 5 };

    const parsed = parseTemplate(stampedFive);

    expect(parsed.schemaVersion).toBe(6);
    expect(JSON.parse(JSON.stringify({ ...parsed, schemaVersion: 5 }))).toStrictEqual(
      JSON.parse(JSON.stringify(stampedFive)),
    );
  });
```

> ⚠️ **L'assertion ajoutée au test existant est écrite `CURRENT_SCHEMA_VERSION + 1` et non `7`.** Un
> littéral `7` deviendrait faux au prochain lot, et pire : il testerait « un cran au-dessus du
> courant » **le jour où le courant est 7**, c'est-à-dire rien. La forme relative est celle que C2 a
> imposée en dé-littéralisant sept assertions, et c'est aussi celle que `migrate.test.ts:506`
> emploie déjà — ce qui est une raison de plus de s'y greffer plutôt que d'écrire à côté.
>
> **L'assertion mesurée `err.fromVersion === 6` de `M8`** était le relevé d'une **sonde** contre le
> `dist` de `main` ; dans le dépôt, le même fait s'écrit relativement, et le test existant l'écrit
> déjà ainsi. **Ce n'est pas un désaccord avec `M8` : c'est la traduction d'une sonde en test.**

#### Ce que ce fichier force

| Geste | Porte |
| :--- | :--- |
| L'estampille sans l'entrée de migration | **porte 4, un test** — mesuré : `Tests 1 failed \| 590 passed` |
| Le message reformulé sans que le test bouge | **porte 4**, depuis la révision 2 : le `toBe` greffé sur `migrate.test.ts:506` rougit là où trois `toContain` laissaient passer |
| `try`/`catch` sur `parseTemplate` | **porte 3** : `useUnknownInCatchVariables` impose `error: unknown` puis un `instanceof` avant de lire `.message` |

---

### 3.16 `packages/core/src/page/__tests__/page.test.ts` — **modifié**

**Compilé à exit 0, 627 tests verts.**

#### Diff conceptuel

| | |
| :--- | :--- |
| **Ce qui change** | la docstring des lignes **43-44** (`bleed`/`gutter`) — **DÉCLINÉ** · l'assertion des lignes **234-236** — **ANCRÉE SUR LE CHEMIN** |
| **Ce qui ne change pas** | les quatre paires `*_KEYS_IN_STEP` **restent** · `RECIPE_PAGE` · les 40 autres `it` · **aucun champ n'est ajouté à `page/`** |

**① Lignes 43-44 — `bleed` et `gutter` sont DÉCLINÉS**, et c'était la **seule** source de cette
attribution (mesuré : 20 lignes mentionnent un fond perdu ou une gouttière, **une** attribuait
quelque chose) :

```ts
 * The likeliest drift site was said here to be `Sheet` or `PageMargins`, on the grounds that
 * "lot C5 has a bleed and a gutter in its declared future". LOT C5 DECLINED BOTH, and this
 * sentence was the ONLY place in the repository attributing them to it -- measured, 20 lines
 * mention a bleed or a gutter and one attributed something. ADR 0006 decision 13 ranges the
 * binding margin and the bleed in "un SILENCE que ce lot décide de ne pas rompre", which is
 * not a declared future and is attributed to NOBODY; the need is moreover already covered with
 * no field at all, `page/types.ts`: "Zero is legal -- a full-bleed label, or a template that
 * manages its own gutter". A lot does not break a silence it did not open.
 *
 * The four pairs below stay, and they earned their keep elsewhere: lot C5 attaches a style to
 * nine sites, and MEASURED, the type gate saw nine of the package's fifteen sites not at all
 * before that lot wrote its own eight pairs. `PageBand` was one of the six it DID see, thanks
 * to the third pair here.
```

**② Lignes 234-236 — l'assertion ANCRÉE.** Le `expect(() => parseTemplate(noPage)).toThrow(/…/)`
devient :

```ts
    // ANCHORED ON THE PATH rather than on a substring of the aggregated message, and the reason
    // is measured. With a REQUIRED field added to `Template`, the parse yields TWO issues, the
    // new one BEFORE `page`, and an unanchored regular expression still matches -- so this test
    // would stay GREEN while assuring nothing, which is worse than a red test because a red test
    // is visible. Lot C5 adds no required field, so the hazard does not fire today; the anchor is
    // one line, and it is preventive.
    let caught: unknown;
    try {
      parseTemplate(noPage);
    } catch (error: unknown) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(z.ZodError);
    if (caught instanceof z.ZodError) {
      expect(caught.issues).toHaveLength(1);
      expect(caught.issues.map((issue) => issue.path)).toStrictEqual([['page']]);
      expect(caught.issues.map((issue) => issue.message)).toStrictEqual([
        'Invalid input: expected object, received undefined',
      ]);
    }
```

> `z` est **déjà** importé comme **valeur** par ce fichier (ligne 2, `import { z } from 'zod/v4'`) :
> **zéro ligne d'import ajoutée**, et `z.ZodError` est utilisable dans un `instanceof`. Vérifié.

#### Ce que ce fichier force

| Geste | Porte |
| :--- | :--- |
| Le `toHaveLength(1)` | **porte 4** — c'est lui qui rougirait le jour où un champ requis arrive, là où la regex resterait verte |
| L'ancrage sur `path` | **porte 4**, et c'est un geste **préventif** : le danger ne tire pas dans ce lot |
| La correction de la docstring | **aucune porte** |

---

### 3.16 bis `packages/core/src/ast/__tests__/table.test.ts` — **modifié**

**Il a rougi, et le relevé est en `§C.3`.** L'assertion de la ligne **387** épingle la liste exacte
des clés de `RECIPE_TABLE` ; `box` en est la septième.

```ts
    // Le nœud tableau porte exactement ces SEPT clés, et la ligne de total ne porte AUCUNE clé
    // de plus qu'une ligne ordinaire. […]
    //
    // `box` est la septième, et son arrivée a fait ROUGIR cette assertion — c'est le SECOND
    // filet mécanique sous l'estampille du lot C5, avec le littéral de chaîne de
    // `migrate.test.ts`. Il attrape un champ OPTIONNEL, lui, mais seulement parce que la
    // fixture le porte : c'est exactement ce que le lot C5 a ajouté à `RECIPE_TABLE` pour que
    // l'aller-retour JSON ci-dessus couvre `Template`, le neuvième site d'accrochage et le seul
    // qu'aucune paire `*_KEYS_IN_STEP` ne peut garder.
    expect(Object.keys(RECIPE_TABLE)).toStrictEqual([
      'type',
      'id',
      'box',
      'columns',
      'header',
      'body',
      'footer',
    ]);
```

> ⚠️ **L'ordre des clés est porteur.** `Object.keys` rend l'ordre d'**insertion** du littéral, donc
> `box` doit figurer **en troisième position** dans `RECIPE_TABLE` [§3.14] — après `id`, avant
> `columns`. Écrire le champ en dernier dans la fixture ferait rougir ce test **pour une raison de
> rangement**, ce qui est exactement le genre de faux positif qui fait « corriger » une assertion
> utile. C’est écrit ici pour que l’exécutant ne l’apprenne pas au débogage.

**Ce que ce fichier force :** **porte 4**, et il est le seul du dépôt à voir un champ **optionnel**
ajouté à un nœud gardé. Le geste appartient à **INC-2**, pas à INC-7 : il est la conséquence
mécanique de [§3.14], dans le même commit.

---

### 3.17 → 3.22 · Vitrine et documentation

Ces six sous-sections **ne portent pas de code de contrat** — la vitrine n'est pas dans le glob de
Vitest, et aucune porte ne lit un `.md`. Elles portent des **spécifications exécutables par un
humain**, et le plan les écrit comme telles.

#### 3.17 `apps/playground/src/App.tsx` — **modifié** (INC-6)

**Non compilé dans ce bac à sable**, et il faut le dire : le bac à sable contient `core` seul.
`apps/*` est **hors du glob de Vitest**, donc **aucune porte ne relit ce fichier à l'exécution** —
la démonstration est une **revue humaine**.

Quatre gestes, sur le patron de `modeleArrondi` × 3 que C2 a déjà exécuté :

1. **Un second `Template` complet** — même structure, mêmes ids, même `renderData`, **styles
   différents** : `RECIPE_STYLE_A` et `RECIPE_STYLE_B` de [§3.12] transposés.
2. **Une fonction `styleCssDe(box, typo)`** qui **dérive** le CSS du nœud, jamais l'inverse. Elle
   emploie **`mmFromPt` / `ptFromMm` du contrat**, pas sa propre division — c'est l'attente n° 5 de
   D16, et le playground est son premier consommateur nommé.
3. **Le rendu AU SEGMENT** — un `<span>` par run, puisque `typography` vit sur le segment. ⚠️ Cela
   change le **type de retour** de `texteDeSegments` et **tous ses appelants** : c'est le geste le
   plus lourd du lot hors `core`, et il n'est gardé par aucune porte.
4. **`collectTemplateDataPaths(A)` affiché à côté de `collectTemplateDataPaths(B)`**, et **égaux** :
   c'est la moitié **mécaniquement vérifiable** du critère de recette. **Mesuré sur la fixture
   stylée** : `["facture.numero","facture.lignes"]`, identique à `main`.

**Critère de sortie, et il nomme son juge :** deux factures **visuellement très différentes**,
même arbre, mêmes chemins de données. Aucune mesure ne peut dire « très différentes » — c'est une
**revue humaine**, et le plan nomme qui la fait plutôt que la déguiser en `it`.

#### 3.18 `docs/roadmap/engine.md` — **modifié** (INC-7)

Ligne **79** : « *Le contrat sait décrire un modèle bilingue (**core C5**) …* » → **C6**.
`core.md:229` écrit lui-même « Dépend de : C2, C5 » pour C6. **Troisième relevé, jamais corrigé** ;
le précédent d'exécution est le commit `366c28a`.

#### 3.19 `docs/roadmap/core.md` — **modifié** (INC-8)

§C5 marqué **livré**, renvoi vers l'ADR 0007. **La citation canonique du lot est `core.md:207-217`**,
jamais `:174-184` : la fusion de C4 a inséré **31 lignes** et décalé tout ce qui suit — signalement B,
et **le plan recompte toutes ses citations**.

#### 3.20 `docs/adr/0007-l-apparence.md` — **nouveau** (INC-8)

En-tête normalisé (`Statut : 🟢 Accepté`, `Date`, `Impact`, `Complète`, `Plan d'implémentation`,
`Implémentation`) · les **18 décisions** · les **9 arbitrages avec leurs branches non retenues** ·
`## Conséquences` avec **les huit attentes envers le moteur** · `## Ce qui reste ouvert` · **les 14
signalements A…N**, plus **les trois que la rédaction du contrat a mis au jour** :

| # | Ce que la rédaction du contrat a mis au jour | Ce qu'il faut en faire |
| :-- | :--- | :--- |
| **O** | **`style/types.ts` importe `../page/types.js` et non le barrel `page/page.js`.** Le barrel ferme un cycle ESM et rend `ReferenceError: Cannot access 'ContainerNodeSchema' before initialization` — **exit 0 aux portes 2 et 3**, casse à la 4 | Écrire la dérogation **avec sa mesure**. Et la règle générale : dans `core`, un import de **valeur** entre dossiers passe par le module **feuille**, pas par le barrel, dès que le dossier cible importe le dossier source |
| **P** | **`ast/__tests__/table.test.ts:387` est un SECOND filet mécanique** sous l'estampille, qu'aucun des sept documents de reconnaissance ne citait. Il attrape un champ **optionnel**, ce qu'aucune paire `*_KEYS_IN_STEP` ne fait — mais seulement parce que la fixture le porte | Le nommer comme **la forme générale du filet** : une assertion de liste de clés sur une fixture qui porte le champ. C'est plus fort qu'un `keyof` sur un site que la fixture ignore |
| **Q** | **`Array.prototype.toSorted` est `TS2550` sous `lib: ["ES2022"]`**, et le diagnostic **suggère lui-même de desserrer le `tsconfig`** (« *Do you need to change your target library?* ») | Le consigner : c'est le cas d'école d'`AGENTS.md` §7 — un compilateur qui propose la dérogation. La réponse est `.sort()` sur le tableau frais de `Object.keys` |

#### 3.21 `docs/adr/0006-la-page.md` — **modifié** (INC-8)

Une ligne « **Complété par** [ADR 0007] ». ⚠️ Et **pas** de révision de sa décision 13 : C5
**décline** `bleed`/`gutter`, donc rien à réviser — c'est l'arbitrage n° 7, option A.

#### 3.22 `docs/plans/c5-l-apparence.md` — **modifié en dernier** (INC-8)

`**Statut :**` → `⛔ PÉRIMÉ`. Le plan est périssable ; l'ADR fait foi.

---
---

#### §C. COMPILATION ET REFUS MESURÉS — les sorties brutes

### C.0 Contrôle d'intégrité du dépôt

```
$ cd C:/_Gargouilles/Openview && git status --porcelain | wc -l && git rev-parse --short HEAD
0
3893fb5
```

**Zéro ligne avant, zéro ligne après.** Vérifié **quatre fois** au cours de la rédaction. Toutes
les écritures vivent sous `…\scratchpad\sandbox-final\`.

---

### C.1 La compilation — verdict : **exit 0**, avec ses 627 tests

#### C.1.1 La baseline, avant toute modification

```
$ cd sandbox-final/core && tsc -p tsconfig.json
=== BASELINE tsc EXIT=0 ===

$ node node_modules/vitest/vitest.mjs run
 Test Files  19 passed (19)
      Tests  591 passed (591)
   Duration  12.42s
```

> ⚠️ **Le premier montage du bac à sable a rendu 55 faux `TS7006`**, tous sur des rappels de
> `it.each`, parce que `ln -s` de Git Bash avait **copié** `zod` et `vitest` au lieu de les lier. La
> correction est `mklink /J`. **C'est le piège le plus coûteux du protocole** : un exit 1 qui n'a
> rien à voir avec le contrat, sur 19 fichiers de test qu'on est tenté de « corriger ».

#### C.1.2 Le contrat complet — production, tests, fixtures

```
$ tsc -p tsconfig.json
EXIT=0

$ node node_modules/vitest/vitest.mjs run
 Test Files  20 passed (20)
      Tests  627 passed (627)
```

**591 → 627, soit +36 tests**, tous dans `style/__tests__/style.test.ts` (34) et
`template/migrate.test.ts` (2). **Zéro test existant modifié dans son intention** : trois
assertions ont été **mises à jour** (le littéral de chaîne, la liste de clés de `RECIPE_TABLE`,
l'ancrage du refus de `page`), et chacune l'a été **parce qu'elle avait rougi**.

#### C.1.3 L'import du JavaScript émis — le contrat s'initialise réellement

```
$ tsc -p tsconfig.emit.json && node -e "import('./out/index.js').then(…)"
emit EXIT=0
IMPORT OK — MAX_FONT_SIZE_PT = 14400 | CURRENT_SCHEMA_VERSION = 6 | exports = 116
```

**116 valeurs exportées**, contre **104** mesurées sur le `dist` de `main` : **+12**, exactement les
douze de [§3.10].

#### C.1.4 Le calibrage, remesuré — et il fallait le remesurer

```
--- CALIBRAGE : RECIPE_TEMPLATE avec les styles du lot C5 ---
brut         : {"values":285,"depth":18}
apres parse  : {"values":285,"depth":18}
DEFAULT_SHAPE_LIMITS : {"maxDepth":64,"maxNodes":100000}
walk(root)   : 19 noeuds
CURRENT_SCHEMA_VERSION (contrat C5) : 6
chemins de donnees : ["facture.numero","facture.lignes"]

--- par BISECTION sur le vrai assertBoundedShape du dist ---
RECIPE_TEMPLATE STYLE (C5)  : maxDepth minimal = 18 | maxNodes minimal = 285
RECIPE_TEMPLATE NU (main)   : maxDepth minimal = 18 | maxNodes minimal = 242
occupation de maxNodes : nu 0.24 % -> style 0.29 %
```

> **Le compte est obtenu par BISECTION sur le vrai `assertBoundedShape` du `dist`**, pas par un
> compteur répliqué. C'est ce qui rend le chiffre opposable : un compteur maison peut être décalé
> d'une unité sur la profondeur, et le mien l'était (17 au lieu de 18) avant que la bisection le
> corrige. **Le plan écrit 285 / 18 et non le chiffre de mon compteur.**
>
> **La baseline de calibrage de C5 est donc : `RECIPE_TEMPLATE` = 242 / 18 avant, 285 / 18 après.**
> Le « 231 » du plan C4 reste périmé (signalement C), et le « 242 » de `campagne de mesure §2.1` est
> **confirmé** — c'est exactement ce que le `dist` de `main` rend quand il dépouille la fixture
> stylée.

---

### C.2 Le contrôle négatif n° 1 — **le barrel de `page/` compile et casse**

C'est la mesure qui a **changé une ligne du contrat**, et elle est la plus importante de ce
document.

**Variante A (retenue)** — `import { MAX_SHEET_MM } from '../page/types.js'` :

```
$ tsc -p tsconfig.json                       => EXIT=0
$ node -e "import('./out/index.js')"         => IMPORT OK — 116 exports
$ vitest run                                 => 627 passed
```

**Variante B (écartée)** — `import { MAX_SHEET_MM } from '../page/page.js'`, le barrel que la
doctrine demande :

```
$ tsc -p tsconfig.json
variant B tsc EXIT=0  (la porte de type ne voit RIEN)

$ node -e "import('./out/index.js')"
IMPORT FAILED: ReferenceError - Cannot access 'ContainerNodeSchema' before initialization

$ vitest run src/style/__tests__/style.test.ts
 FAIL  src/style/__tests__/style.test.ts > the ninth accrual site … > carries a style at ALL NINE sites
 Test Files  1 failed (1)
      Tests  1 failed | 32 passed (33)

$ # variante A restauree
controle restaure : IMPORT OK, 116 exports
```

**La chaîne exacte du cycle**, sur le JavaScript émis :

```
ast/schemas.js  ──►  style/style.js  ──►  style/schemas.js  ──►  style/types.js
                                                                      │
                                                            (barrel)  ▼
                                            page/schemas.js  ◄──  page/page.js
                                                   │
                                                   ▼
                                            ast/nodes.js  ──►  ast/schemas.js  ⟲ EN COURS
```

`page/schemas.js` évalue `content: ContainerNodeSchema` **au niveau du module** ; `ast/schemas.js`
est en cours d'initialisation ; la liaison est dans sa *temporal dead zone*. **`page/types.js`,
lui, n'a AUCUN import au runtime** (son unique import est un type, effacé), donc il ne peut fermer
aucun cycle.

> **Trois raisons de porter cette mesure au plan et à l'ADR.** (1) Elle **contredit une doctrine
> écrite** (`page/page.ts` : « *consumers import from here, never from ./types.js* »), donc elle a
> besoin d'un motif écrit, pas d'un choix silencieux. (2) Elle est **invisible aux portes 1, 2
> et 3** — c'est un défaut de classe « aucun outil ne le verra ». (3) `page/page.ts` **avait
> anticipé exactement cette configuration** dans sa propre docstring, par l'autre bout : « *if the
> tuple lived here, `ast/schemas.ts` would import a VALUE from `page/` while `page/schemas.ts`
> already imports `ContainerNodeSchema` from `ast/schemas.ts`, which is the configuration where
> ESM initialisation order starts to matter.* » **Le lot C5 est ce cas, arrivé de l'autre côté.**

---

### C.3 Le contrôle négatif n° 2 — **la matrice de mutation, avant et après INC-0**

#### C.3.1 AVANT les huit paires — la porte est aveugle, sur ce contrat-ci

```
$ # une mutation par site, compilee separement, sur le contrat C5 SANS les paires d'INC-0
TextLiteralSegmentSchema   | exit 0 | AUCUNE — la porte est AVEUGLE
TextNodeSchema-box         | exit 0 | AUCUNE — la porte est AVEUGLE
ContainerNodeSchema-box    | exit 0 | AUCUNE — la porte est AVEUGLE
TableRowNodeSchema-box     | exit 1 | src/ast/__tests__/nodes.test.ts(120,14): error TS2322: Type 'true' is not assignable to type 'false'.
controle restaure EXIT=0
```

**Trois sur quatre sont muettes**, et la quatrième ne l'est que parce que C3 lui avait donné une
paire. C'est `B2` / `campagne de mesure §6.5`, **reproduit sur le contrat définitif** et non plus sur le
contrat reconstruit.

#### C.3.2 APRÈS les huit paires — le critère de sortie d'INC-0, onze sur onze

```
TextLiteralSegment -typography     | exit 1 | src/ast/__tests__/nodes.test.ts(180,14): error TS2322: Type 'true' is not assignable to type 'false'.
TextBindingSegment -typography     | exit 1 | src/ast/__tests__/nodes.test.ts(185,14): error TS2322: Type 'true' is not assignable to type 'false'.
TextPageFieldSegment -typography   | exit 1 | src/ast/__tests__/nodes.test.ts(190,14): error TS2322: Type 'true' is not assignable to type 'false'.
TextNode -box                      | exit 1 | src/ast/__tests__/nodes.test.ts(195,14): error TS2322: Type 'true' is not assignable to type 'false'.
TextNode -align                    | exit 1 | src/ast/__tests__/nodes.test.ts(195,14): error TS2322: Type 'true' is not assignable to type 'false'.
ImageNode -box                     | exit 1 | src/ast/__tests__/nodes.test.ts(200,14): error TS2322: Type 'true' is not assignable to type 'false'.
ContainerNode -box                 | exit 1 | src/ast/__tests__/nodes.test.ts(205,14): error TS2322: Type 'true' is not assignable to type 'false'.
TableRowNode -box                  | exit 1 | src/ast/__tests__/nodes.test.ts(135,14): error TS2322: Type 'true' is not assignable to type 'false'.
TableNode -box                     | exit 1 | src/ast/__tests__/nodes.test.ts(145,14): error TS2322: Type 'true' is not assignable to type 'false'.
LoopNode +box (contre-epreuve)     | exit 1 | src/ast/__tests__/nodes.test.ts(210,14): error TS2322: Type 'true' is not assignable to type 'false'.
ConditionNode +box (contre-epreuve) | exit 1 | src/ast/__tests__/nodes.test.ts(215,14): error TS2322: Type 'true' is not assignable to type 'false'.
controle restaure EXIT=0
```

**Onze mutations, onze exit 1**, et le **contrôle restauré rend exit 0** — donc les onze rougeurs
viennent des mutations, pas du harnais. Deux enseignements que le plan écrit :

- **`TextNode -box` et `TextNode -align` rougissent tous deux à la MÊME ligne 195.** Une paire
  `keyof` compare des **ensembles de clés** : elle dit *qu'*une clé manque, jamais *laquelle*. Le
  plan ne promet donc pas un diagnostic par champ.
- **Les deux contre-épreuves fonctionnent dans le sens de l'ÉLARGISSEMENT** : ajouter `box` à
  `LoopNodeSchema` ou `ConditionNodeSchema` rougit. C'est ce qui rend la coupe de D3 **tenue par le
  compilateur** et non par la vigilance.

#### C.3.3 Le second filet, qui a rougi tout seul — `table.test.ts:387`

```
$ vitest run src/ast/__tests__/table.test.ts
 ❯ src/ast/__tests__/table.test.ts (23 tests | 1 failed) 82ms
     × leaves the last row a SHORT row carrying an expression of the model 17ms

AssertionError: expected [ Array(7) ] to strictly equal [ 'type', 'id', 'columns', …(3) ]

- Expected
+ Received

  [
    "type",
    "id",
+   "box",
    "columns",
    "header",
    "body",
    "footer",
  ]

 ❯ src/ast/__tests__/table.test.ts:387:39
```

#### C.3.4 Le filet de l'estampille, qui a rougi tout seul — `migrate.test.ts:158`

```
$ # CURRENT_SCHEMA_VERSION 5 -> 6 et l'entree {from:5,to:6}, sans corriger le litteral
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/template/migrate.test.ts > parseTemplate > walks the chain ONE STEP AT A TIME rather than by a direct converter
 Test Files  1 failed | 18 passed (19)
      Tests  1 failed | 590 passed (591)
```

**Un seul test sur 591.** C'est `V-7.3` **vérifié**, et c'est la démonstration littérale de la
phrase du dépôt : « *the ONLY mechanical net under the stamp of lots C1, C2 and C3* ». Pour C5 il y
en a **deux** — celui-ci et `§C.3.3`.

#### C.3.5 Le contrôle négatif n° 3 — la contrainte du `tsconfig`, rencontrée et acceptée

```
src/style/__tests__/style.test.ts(126,32): error TS2550: Property 'toSorted' does not exist on
  type 'string[]'. Do you need to change your target library? Try changing the 'lib' compiler
  option to 'es2023' or later.
```

**Quatre occurrences**, corrigées en `.sort()`. Le diagnostic **propose lui-même de desserrer le
`tsconfig`**, ce qu'`AGENTS.md` §7 interdit : c'est un cas d'école, et il part en **signalement Q**.

---

### C.4 LES REFUS REJOUÉS — `N01` … `N26`, et la correspondance à `R01` … `R26`

Contrat émis par `typescript@7.0.2` (exit 0), puis `safeParse` contre `zod@3.25.76` via `zod/v4`.
Une ligne par `issue`. **Sortie brute :**

```
===== REFUS — ColorSchema, via TypographySchema.color =====
N01 | color '#fa0' (3 chiffres)                    | code=invalid_format   | path=["color"] | "A colour is six hexadecimal digits behind a hash, as #1b3a6f"
N02 | color 'red' (nom CSS)                        | code=invalid_format   | path=["color"] | "A colour is six hexadecimal digits behind a hash, as #1b3a6f"
N03 | color '#1b3a6fff' (canal alpha)              | code=invalid_format   | path=["color"] | "A colour is six hexadecimal digits behind a hash, as #1b3a6f"
N04 | color 'rgb(1,2,3)'                           | code=invalid_format   | path=["color"] | "A colour is six hexadecimal digits behind a hash, as #1b3a6f"
N05 | color 'Canvas' (couleur systeme)             | code=invalid_format   | path=["color"] | "A colour is six hexadecimal digits behind a hash, as #1b3a6f"
N06 | color 0x1b3a6f (nombre)                      | code=invalid_type     | path=["color"] | "Invalid input: expected string, received number"
===== REFUS — TypographySchema =====
N07 | sizePt 0                                     | code=too_small        | path=["sizePt"] | "A font size is at least 1 pt"
N08 | sizePt 0.5                                   | code=too_small        | path=["sizePt"] | "A font size is at least 1 pt"
N09 | sizePt 14401                                 | code=too_big          | path=["sizePt"] | "A font size is at most 14400 pt"
N10 | sizePt NaN                                   | code=invalid_type     | path=["sizePt"] | "Invalid input: expected number, received NaN"
N11 | sizePt Infinity                              | code=invalid_type     | path=["sizePt"] | "Invalid input: expected number, received number"
N12 | family ''                                    | code=too_small        | path=["family"] | "A font family name is required"
N13 | bold 'yes'                                   | code=invalid_type     | path=["bold"] | "Invalid input: expected boolean, received string"
N14 | italic 'yes'                                 | code=invalid_type     | path=["italic"] | "Invalid input: expected boolean, received string"
N15 | bold 700 (l ancienne echelle)                | code=invalid_type     | path=["bold"] | "Invalid input: expected boolean, received number"
===== REFUS — TextNodeSchema.align =====
N16 | align 'justify' (ce que ast/types promettait) | code=invalid_value    | path=["align"] | "Invalid option: expected one of \"start\"|\"center\"|\"end\""
N17 | align 'middle'                               | code=invalid_value    | path=["align"] | "Invalid option: expected one of \"start\"|\"center\"|\"end\""
===== REFUS — BoxStyleSchema =====
N18 | border.bottom sans color                     | code=invalid_type     | path=["border","bottom","color"] | "Invalid input: expected string, received undefined"
N19 | padding 2 (raccourci scalaire)               | code=invalid_type     | path=["padding"] | "Invalid input: expected object, received number"
N20 | padding, 3 aretes sur 4                      | code=invalid_type     | path=["padding","left"] | "Invalid input: expected number, received undefined"
N21 | padding.top -0.1                             | code=too_small        | path=["padding","top"] | "A length cannot be negative"
N22 | border.top.width -1                          | code=too_small        | path=["border","top","width"] | "A length cannot be negative"
N23 | padding.top 5081                             | code=too_big          | path=["padding","top"] | "A length is at most 5080 mm"
N24 | background '#GGGGGG'                         | code=invalid_format   | path=["background"] | "A colour is six hexadecimal digits behind a hash, as #1b3a6f"
N25 | gap 5 (le champ RETIRE du lot)               | ACCEPTE | {}
N26 | align 'start' (le champ RETIRE de BoxStyle)  | ACCEPTE | {}
===== CONTROLES POSITIFS =====
+   | Typography {}                                | ACCEPTE | {}
+   | BoxStyle {}                                  | ACCEPTE | {}
+   | BoxStyle { border: {} }                      | ACCEPTE | {"border":{}}
+   | color majuscules '#FFAA00'                   | ACCEPTE | {"color":"#FFAA00"}
+   | color minuscules '#ffaa00'                   | ACCEPTE | {"color":"#ffaa00"}
+   | sizePt 10.5 (demi-point)                     | ACCEPTE | {"sizePt":10.5}
+   | sizePt 1 (la borne basse)                    | ACCEPTE | {"sizePt":1}
+   | sizePt 14400 (la borne haute derivee)        | ACCEPTE | {"sizePt":14400}
+   | filet width 0 (orthographe de "pas de filet") | ACCEPTE | {"width":0,"color":"#1b3a6f"}
+   | filet 0.28 mm = 0.8 pt                       | ACCEPTE | {"width":0.28,"color":"#1b3a6f"}
+   | padding a zeros                              | ACCEPTE | {"top":0,"right":0,"bottom":0,"left":0}
+   | CLE INCONNUE letterSpacing (z.object)        | ACCEPTE | {"sizePt":10}
+   | bold true / italic false                     | ACCEPTE | {"bold":true,"italic":false}
===== BORNES DERIVEES =====
MAX_FONT_SIZE_PT = 14400 | MIN_FONT_SIZE_PT = 1 | MAX_SHEET_MM = 5080
mmFromPt(MAX_FONT_SIZE_PT) === MAX_SHEET_MM : true
resolveTypography({run:{bold:true},block:{family:"X",sizePt:9}}) = {"family":"X","sizePt":9,"bold":true}
resolveAlign({text:"end",column:"start"}) = end
resolveAlign({column:"start"})           = start
resolveAlign({})                          = undefined
```

> ⚠️ **Ce bloc est une SORTIE BRUTE de la révision 1, et il n'est pas réécrit.** Trois de ses lignes
> nomment `resolveAlign`, que la révision 2 renomme `resolveTextAlign` [D5] ; renommer dans un relevé
> ferait passer pour mesuré ce qui ne l'a pas été. **Trois lignes de ce relevé sont en outre
> CONTREDITES par la révision 2** et doivent rougir au remesurage : `BoxStyle {}` et
> `BoxStyle { border: {} }` sont désormais **refusés**, et `filet width 0` aussi [D10]. Elles restent
> ici parce qu'elles sont la **preuve du coût** de la décision inverse — c'est ce relevé qui montre
> que la révision 1 stockait trois orthographes d'« aucun style », et il vaut mieux qu'un résumé.

| `N` | `R` de `campagne de mesure §4` | Statut |
| :-- | :-- | :--- |
| `N01`…`N06` | `R01`…`R06` | **identiques**, code, path et message |
| `N07`…`N11` | `R07`…`R11` | **identiques** |
| `N12` | `R15` | **identique**, renuméroté (l'ordre du contrat a changé) |
| `N13`, `N14` | `R16` | `R16` ne testait que `italic`; `N13`/`N14` testent les **deux** booléens |
| `N15` | — | **NEUF.** `bold: 700` — l'ancienne échelle — rend `invalid_type / expected boolean, received number`. À porter : un modèle écrit contre un brouillon numérique est **refusé lisiblement** |
| `N16`, `N17` | `R17`, `R18` | **même code, même message, PATH DÉPLACÉ** : `["align"]` sur `TextNodeSchema` et non sur `BoxStyleSchema` |
| `N18`…`N21` | `R20`, `R21`, `R22`, `R23` | **identiques**, renumérotés |
| `N22` | — | **NEUF.** Une épaisseur négative rend `too_small / "A length cannot be negative"` — le message générique de longueur, **et non plus** le message typographique de `R19` |
| `N23` | `R25` | **même code et même message** (`A length is at most 5080 mm`), **path déplacé** : `["padding","top"]` et non `["gap"]` |
| `N24` | `R26` | **identique** |
| `N25`, `N26` | — | **NEUFS, et ce sont des ACCEPTATIONS.** `{ gap: 5 }` et `{ align: 'start' }` sur `BoxStyleSchema` sont **acceptés et silencieusement dépouillés** |

**Les cinq désaccords avec `campagne de mesure §4`, un par un :**

| # | Désaccord | Cause, et ce que le plan de test doit porter |
| :-- | :--- | :--- |
| **1** | ⚠️ **PÉRIMÉ PAR LA RÉVISION 2 — `R19` NE DISPARAÎT PAS, IL CHANGE DE MESSAGE.** La ligne d'origine disait : « *`border.bottom.width: 0` était refusé avec `"A rule width is greater than zero"` ; il est maintenant ACCEPTÉ* » | [D10] **rétablit `gt(0)`** : les quatre arêtes d'un `BoxBorder` sont **optionnelles**, donc l'absence est déjà une orthographe et `0` en serait une seconde — le précédent `PageMargins`, dont les quatre arêtes sont **requises**, ne transpose pas. Ce qui change vraiment est le **message** : `"A rule has a positive width; omit the edge to declare no rule"` au lieu d'une prescription typographique. C'est `N28`, et un `it` qui attendrait l'ancienne chaîne échouerait **sur le message, pas sur le code** |
| **2** | **`R12`, `R13`, `R14` DISPARAISSENT.** Les trois refus de `weight` n'ont plus de sujet | ⛔ n° 2 option A : `bold?: boolean`. Conséquence heureuse et **mesurée** : le défaut « zod 4 range `.int()` sous `invalid_type` » **n'a plus aucun site dans le lot**, donc le legs à C8 sur ce point est **vide** |
| **3** | **`R24`, `R25` DÉPLACÉS.** `gap: -1` et `gap: 5081` n'ont plus de champ | D11 : `gap` sort du lot. Les deux refus survivent sous `["padding","top"]` (`N21`, `N23`), **avec les mêmes codes et les mêmes messages** — donc la couverture de refus ne baisse pas |
| **4** | **`R17`, `R18` CHANGENT DE PATH.** `["align"]` reste, mais sur `TextNodeSchema` | D5/B4 : `align` quitte `BoxStyle`. Un `it` qui appellerait `BoxStyleSchema.safeParse({ align: 'justify' })` **passerait au vert en n'assurant rien** — c'est `N26`, et c'est le piège le plus vicieux de la renumérotation. ⚠️ **La révision 2 déplace en outre le contenu du refus** : sur un `TextNode`, `'justify'` est désormais **ACCEPTÉ** (quatrième membre de `TEXT_ALIGNMENTS`) et c'est `'middle'` qui est refusé, avec un message à **quatre** options ; le refus de `'justify'` survit sur `TableColumnSchema`, où il est `N29`. **Les deux messages sont dérivés et à remesurer** |
| **5** | **Le legs `Infinity` passe de HUIT à SIX positions.** `campagne de mesure §4` compte « huit positions numériques (`sizePt`, `weight`, `gap`, les 4 de `padding`, la `width` d'arête) » | `weight` et `gap` sortent : il reste **`sizePt`, les quatre de `BoxSpacing`, la `width` d'une arête = six**. Le plan écrit **six**, avec cette dérivation |

**Et deux relevés qui ne sont pas des désaccords mais des précisions à porter :**

- **`resolveTypography` rend CINQ clés, dont deux valent `undefined`.** `JSON.stringify` en montre
  **trois** (`{"family":"X","sizePt":9,"bold":true}`). Un test d'aller-retour naïf sur cette
  fonction s'y casse ; `toStrictEqual` avec les cinq clés explicites est la forme juste, et c'est
  celle de [§3.11].
- **La divergence de conversion est de 31,5 % entre deux formes, 60,9 % entre quatre.** Voir
  [§3.2] : les deux chiffres sont exacts et ne mesurent pas la même chose.

---

### C.5 CE QUI RESTE NON MESURÉ, et doit être écrit comme tel

1. **La porte 1 (`biome check`) n'a été jouée nulle part.** Elle **écrit** (cache Biome), ce que
   l'interdiction couvre. La conformité du contrat aux interdits `any` / `!` / `as unknown as` /
   `@ts-*` / `catch` vide, et au plugin `no-environment-read`, est une **lecture** : le code
   ci-dessus n'emploie aucune des cinq écritures, ne lit ni `Date`, ni `Intl`, ni `process`, ni
   `Math.random`, ni `globalThis`, ni un `toLocale*`. C'est tout ce qui est affirmé.
2. **La porte 2 (`build`) n'a pas été jouée sur le dépôt** — elle écrit `dist`. Elle **a** été jouée
   sur le bac à sable (`tsconfig.emit.json`, exit 0), et le JavaScript émis **s'importe** : c'est le
   plus proche substitut disponible.
3. **La couverture n'a pas été mesurée.** `test:coverage` écrit. Ce qui **est** mesuré : les 36
   tests neufs portent **17 allers-retours + 1 aller-retour à neuf sites + 24 refus + 4
   précédences**, donc chaque champ du contrat est touché à l'exécution au moins une fois.
4. **`apps/playground` n'est pas compilé** — le bac à sable contient `core` seul. Le geste 3 de
   [§3.17] (le rendu au segment) est le plus lourd du lot **et le moins gardé**.
5. **Le comportement d'un vrai contrat v6 sur un document v5** est mesuré **par le `dist` de
   `main`** dans le sens qui compte (v6 refusé par un build v5). L'inverse — v5 lu par v6 — est
   mesuré **par analogie exécutée** : le garde ne protège que vers le haut, un document
   sous-estampillé est **migré en silence**.
6. **Le rendu, et l'identité aperçu/PDF.** Hors de portée : c'est **V3**, comme `page/area.ts:32`
   l'écrit déjà.
7. **La revue humaine du critère de recette.** Aucune mesure ne dit « visuellement très
   différentes ». Le plan **nomme qui la fait**.
8. **⚠️ TOUT LE §C PORTE SUR LE CONTRAT DE LA RÉVISION 1, et cinq lignes sont périmées par la
   révision 2.** Elles sont marquées **dérivées** partout où elles apparaissent, et **aucune n'est
   réécrite en chiffre mesuré** :
   - le **compte d'exports** — 116 mesuré, **117 dérivé** (`TEXT_ALIGNMENTS` est une valeur) ;
   - le **compte de tests** — 627 mesuré, **≈ 628 dérivé**, avec ses quatre mouvements en [§5] ;
   - la **liste des refus** — `N01`…`N26` mesurés, **`N27`…`N29` dérivés** ; et **quatre contrôles
     positifs du relevé `§C.4` sont CONTREDITS** (`Typography {}`, `BoxStyle {}`,
     `BoxStyle { border: {} }`, `width: 0`) ;
   - le **poids de `RECIPE_TEMPLATE`** — 285 / 18 après le lot, à rejouer : la fixture gagne un
     `justify` et perd les objets de style vides ;
   - les **cinq désaccords** avec la campagne — le premier (`gt(0)` → `min(0)`) **s'inverse** et
     devient un désaccord de **message**, pas de prédicat.

   **Le remesurage complet est le critère d'entrée d'INC-5**, et il se joue sur le même protocole
   (§3.0) — pas sur un bac à sable neuf, sinon les deux campagnes ne se comparent pas.

---

### C.6 VERDICT — **de la révision 1**, et il n'est pas transposé en silence

| | |
| :--- | :--- |
| **Compilation** | **`tsc -p tsconfig.json` — EXIT 0**, sur `core/src` complet, 20 fichiers de test compris, avec `typescript@7.0.2` et la config du dépôt |
| **Exécution** | **`vitest run` — 20 fichiers, 627 tests verts** (591 de `main` + 36) |
| **Émission** | **EXIT 0**, et le JavaScript émis **s'importe** : 116 valeurs exportées |
| **Contrôle négatif n° 1** | le barrel `page/page.js` : **exit 0 au type-check, `ReferenceError` à l'exécution** — une ligne du contrat en dépend |
| **Contrôle négatif n° 2** | **11 mutations de schéma, 11 exit 1** après INC-0 ; **3 sur 4 exit 0** avant — critère de sortie d'INC-0 **vérifié** |
| **Contrôle négatif n° 3** | `toSorted` : **`TS2550`** sous `lib: ["ES2022"]`, contrainte **acceptée** et non desserrée |
| **Filets qui ont rougi d'eux-mêmes** | **deux** : `migrate.test.ts:158` (le littéral de chaîne) et `table.test.ts:387` (la liste de clés) — le second **était absent du découpage initial** |
| **Refus rejoués** | **24 refus** (`N01`…`N24`) + **2 acceptations révélatrices** (`N25`, `N26`) + **13 contrôles positifs**, tous avec code, path et message réels |
| **Désaccords avec `campagne de mesure §4`** | **cinq**, tous imputables à une décision de la synthèse (`gt(0)` → `min(0)`, `weight` → `bold`, `gap` retiré, `align` déplacé), plus **deux précisions de chiffre** |
| **Intégrité du dépôt** | `git status --porcelain` : **0 ligne**, à `3893fb5` |

> ⚠️ **Ce verdict est celui de la révision 1 et il n'est pas réécrit.** Ce qu'il établit reste vrai —
> le contrat compile, s'émet, s'importe, et les trois contrôles négatifs valident le harnais. Ce
> qu'il chiffre est **périmé sur cinq lignes**, listées au point 8 de [§C.5]. Le tableau est laissé
> intact parce qu'un verdict réécrit à la main cesse d'être un relevé — et parce que la ligne
> « désaccords » est, telle quelle, **la preuve** de ce que la révision 2 a corrigé : elle nomme
> `gt(0)` → `min(0)` comme une décision de la synthèse, et c'est précisément la décision que la revue
> a renversée.

---

## 4. Les neuf incréments

Chacun passe les quatre portes seul et laisse le dépôt **cohérent**. **Cohérent n'est pas
publiable**, et la distinction est celle que `packages/core/src/template/template.ts:17-21` écrit
dans le code : l'estampille se pose **une** fois, après la dernière forme persistée du lot, avec
pour corollaire *« aucun commit avant celui-là n'est publiable »*. Deux incréments de ce lot sont
donc **non publiables**, et ils sont nommés.

Les quatre portes, dans cet ordre, ce sont exactement celles de la CI :

```bash
pnpm run lint && pnpm run build && pnpm run type-check && pnpm run test:coverage
```

```
INC-0 ──► INC-1 ──► INC-2 ──► INC-3 ──► INC-4 ──► INC-5 ──► INC-6 ──► INC-7 ──► INC-8
(portes)  (style/)  (accroche) (résol.) (estampille) (barrel) (vitrine) (docs)   (ADR)
  │         │          │                    ▲          │
  │         │          └── NON publiable :  │          └── publiable seul
  │         │              1re forme        │
  │         │              persistée        └── premier commit PUBLIABLE
  │         └── publiable seul : aucun nœud ne porte encore la forme
  └── publiable seul : aucune forme stockée, huit paires de garde
```

| # | Titre | Poids | Publiable ? |
| :-- | :--- | :-: | :--- |
| **INC-0** | La porte de type d'abord | **M** | **oui, seul** |
| **INC-1** | Le dossier `style/`, né divisé | **L** | **oui, seul** |
| **INC-2** | L'accrochage | **L** | **NON** |
| **INC-3** | Les deux résolutions | **S** | non |
| **INC-4** | L'estampille | **S** | **oui — premier commit publiable du lot** |
| **INC-5** | Le barrel public | **S** | oui |
| **INC-6** | La démonstration | **L** | oui |
| **INC-7** | Les corrections du dépôt | **M** | oui |
| **INC-8** | L'ADR 0007 et la clôture | **M** | oui |

> **La convention `**Commit.**` est réintroduite.** C2 et C3 écrivaient les messages de commit dans
> leur plan — `grep -nE "Commit" docs/plans/c2-*.md` rend 5 lignes, C3 en rend 6 — et **C4 les a
> supprimés** : la même sonde sur `docs/plans/c4-la-page.md` rend **zéro**. Pourtant l'historique
> livré de C4 les porte, avec un suffixe que son exécution a inventé et que la sonde révèle :
> `42d8bd1 feat(core): décrire la feuille, ses marges et ses bandes (lot C4, INC-0)`. **Ce plan
> tranche pour la convention de C2 et C3, avec le suffixe de C4** — écrire le message ici est ce qui
> évite qu'il soit improvisé à l'exécution, et le suffixe est ce qui rend l'incrément retrouvable
> dans un `git log`.

---

### INC-0 — La porte de type d'abord · **M** · publiable seul

**Contenu.** Les **huit paires `*_KEYS_IN_STEP` manquantes** dans
`packages/core/src/ast/__tests__/nodes.test.ts`, plus les **deux contre-épreuves** (`loop`,
`condition` — les deux nœuds sur lesquels C5 n'accroche **rien**, et dont la paire prouve que la
garde ne rougit pas toute seule). Aucune forme stockée, aucun champ, aucun schéma touché en
production.

**Pourquoi il vient en premier, et pourquoi il ne se coupe jamais.** Parce que la porte de type du
dépôt est **aveugle exactement là où C5 vit**. Mesuré : **9 des 15 sites** où un style peut
s'accrocher n'ont aucun filet — `TextNode`, `ImageNode`, `ContainerNode`, `LoopNode`,
`ConditionNode`, les trois kinds de segment, et `Template`. Les 6 sites gardés sont précisément
ceux que C3 et C4 ont dotés d'une paire. Et la démonstration est brutale : **591 tests sur 591
passent avec quatre schémas divergents** de leur type — un champ ajouté au type et oublié dans le
schéma ne fait rougir personne.

**Critère de sortie, mécanique.** Les **onze mutations** de la matrice passent d'exit 0 à exit 1.
Mesuré avant / après : **3 sur 4 exit 0 avant**, **11 sur 11 exit 1 après** [§5.5].

**Ce qu'il ne peut pas garder.** `Template` reste ingardable par ce patron, et c'est
**structurel** : son type **est** inféré de son schéma, donc l'assertion serait tautologique
[§8, signalement H]. Son seul filet est l'aller-retour JSON de [§3.14].

**Commit.** `test(core): rendre voyante la porte de type sur les huit sites d'accrochage (lot C5, INC-0)`

---

### INC-1 — Le dossier `style/`, né divisé · **L** · publiable seul

**Contenu.** `packages/core/src/style/` en entier : `types.ts`, `units.ts`, `schemas.ts`,
`resolve.ts`, la façade `style.ts`, et `__tests__/style.test.ts` + `__tests__/fixtures.ts`. **Aucun
nœud ne le porte encore** — rien dans le dépôt ne référence ce dossier à la fin de l'incrément.

**Pourquoi « né divisé ».** C'est le précédent de `page/`, écrit dans son propre barrel : *« Lot C3
a dû payer ce découpage après le fait, dans un incrément dédié ; ce dossier est né divisé. »* Le lot
ajoute **20 exports** — le plus gros élargissement du barrel depuis C1 — et un dossier de cette
taille ajouté dans `ast/` obligerait un lot ultérieur à payer la scission.

**Pourquoi il est publiable alors qu'il ajoute du code public.** Parce qu'il n'ajoute **aucune forme
stockée** : aucun document ne peut porter un `BoxStyle` à la fin d'INC-1, puisqu'aucun nœud ne
déclare le champ. Un build antérieur n'a donc rien à perdre ni à refuser.

**Commit.** `feat(core): décrire une apparence — la boîte, les caractères, et les deux unités (lot C5, INC-1)`

---

### INC-2 — L'accrochage · **L** · ⛔ **NON publiable**

**Contenu.** `box?` sur cinq types de nœud (`TextNode`, `ImageNode`, `ContainerNode`, `TableNode`,
`TableRowNode`), `typography?` sur `TextNode` **et** sur les trois kinds de segment, `align?` sur
`TextNode` — **types et schémas dans le même commit**, sur les **huit** `z.object` concernés. **Plus
le tuple `TEXT_ALIGNMENTS` et son type**, dans `ast/types.ts`, à côté du tuple dont ils dérivent.

> ⚠️ **Le tuple appartient à CET incrément et non à INC-7**, bien qu'il tombe au milieu des
> corrections de docstring : c'est une **déclaration**, pas de la prose — `TextNode.align` ne compile
> pas sans lui, et un incrément de documentation qui porterait un tuple cesserait d'être publiable
> seul [§3.6].

**Pourquoi types et schémas ensemble, sans exception.** Parce qu'aucun `nodeBaseSchema` n'existe :
les huit objets répètent `id: nodeIdSchema` littéralement, et **l'oubli d'un seul est silencieux**.
C'est ici que les huit paires d'INC-0 gagnent leur salaire, et c'est la seule raison pour laquelle
INC-0 est un incrément séparé plutôt qu'une ligne de celui-ci.

**Pourquoi il n'est pas publiable.** Il pose la **première forme persistée** du lot sans estampille.
Un build pris ici écrit des documents que le build précédent **dépouille sans erreur** — mesuré :
**124 valeurs sur 189 effacées, en silence**, et un `onSave` persiste la perte.

**Ce qu'il ne fait pas, et qui est un résultat.** Il ne touche **ni** `ast/visitor.ts`, **ni**
`template/paths.ts`, **ni** `template/guard.ts`. Mesuré : `visitNode`, `childrenOf`, `walk`,
`findNodeById`, `nodeReads` et `collectDataPaths` commutent sur `type` et rendent des enfants
**explicites** — un champ de style non-expression coûte **zéro** reprise de parcours. **La condition
de validité de cette gratuité est écrite : aucune position de style n'accepte une `Expression`**
[D12]. Le jour où l'une en accepterait une, les six parcours changent tous.

**Commit.** `feat(core): accrocher l'apparence aux blocs, aux runs et à l'alignement du texte (lot C5, INC-2)`

---

### INC-3 — Les deux résolutions · **S** · non publiable

**Contenu.** `resolveTypography` (deux termes : `run ?? block`), `resolveTextAlign` (deux termes :
`text ?? column`), et les `it` qui épinglent la **précédence** — pas le corps de la fonction, la
précédence, parce que c'est une décision de contrat et non une paraphrase d'implémentation.

**Pourquoi c'est un incrément et pas une ligne d'INC-1.** Parce qu'une résolution ne peut s'écrire
qu'après que les deux sources existent, donc après INC-2. Et parce que la coupure a un prix nommé :
sans ces fonctions, la précédence vit dans une phrase, et **deux consommateurs la
réimplémenteront** — c'est l'argument exact de `page/area.ts`.

⚠️ **Le piège de test, mesuré.** `resolveTypography` rend **cinq clés, dont deux valent
`undefined`**. `JSON.stringify` n'en montre que trois. Un aller-retour naïf sur cette fonction s'y
casse : la forme juste est `toStrictEqual` avec les cinq clés explicites.

**Commit.** `feat(core): écrire une seule fois qui gagne, du run ou du bloc (lot C5, INC-3)`

---

### INC-4 — L'estampille · **S** · **premier commit publiable du lot**

**Contenu.** `CURRENT_SCHEMA_VERSION = 6`, la section de docstring `## What version 6 means`,
l'entrée `{ from: 5, to: 6 }` ajoutée à `TEMPLATE_MIGRATIONS` **sans fusionner les quatre
existantes**, la chaîne épinglée `[[1,2],[2,3],[3,4],[4,5],[5,6]]`, et les **trois** assertions
mesurées de l'erreur de migration.

**Migration par estampille seule** : `(input) => ({ ...input, schemaVersion: 6 })`. Ce n'est pas une
migration fantôme — l'estampille est *tout* ce qui produit le message lisible d'un build antérieur —
et son coût en forme bornée est **exactement 0**, mesuré.

**Ce qui justifie l'incrément, chiffré.** Un document portant les formes de C5, relu par le build de
`main`, est **accepté**, et **124 de ses 189 valeurs sont effacées sans aucune erreur**. C'est la
*perte silencieuse* de `AGENTS.md` §1.2, mesurée sur ce contrat-ci.

⚠️ **Ce que la section de version NE recopie PAS**, et c'est une correction : le paragraphe
d'asymétrie `root` / `page` de la v5. Il dit qu'un build antérieur *« ne connaît pas la clé `page`,
donc il dépouille le champ sans valider dedans »* — vrai pour un build v4, **faux pour un build
v5**, qui connaît `page` et **valide dedans** (mesuré, chemin `page.header.0.content.…`). Recopier
ce paragraphe écrirait un faux [§8, signalement A].

**Les trois assertions, et les deux qui n'existent pas.** `err instanceof TemplateMigrationError` ·
`err.fromVersion === CURRENT_SCHEMA_VERSION + 1` · la chaîne du message **au caractère près**. **Ni
`err.code`, ni `err.to`** : `TemplateMigrationError` ne porte que `fromVersion`, et un
`expect(err.code)` échouerait [§8, signalement G].

> ⚠️ **Les deux premières existent DÉJÀ dans le dépôt**, à `migrate.test.ts:506` — vérifié à HEAD, et
> sous la même forme relative. L'incrément **n'écrit donc pas un `it` de plus** : il greffe la
> troisième (le message entier, là où l'existant fait trois `toContain`) sur le test en place. La
> révision 1 proposait un doublon complet ; deux sites pour un contrat, c'est deux sites à corriger
> le jour où le message bouge, et l'un des deux rougit sans qu'on sache lequel fait foi [§3.15].

**Commit.** `feat(core): estampiller 6, et refuser lisiblement ce qu'un build antérieur effacerait (lot C5, INC-4)`

---

### INC-5 — Le barrel public · **S** · publiable

**Contenu.** `packages/core/src/index.ts` : les **22 exports** — 9 types et 13 valeurs — nommés un
par un en [§3.10], plus **le contrôle négatif du compte** par un test.

**Pourquoi un test compte les exports.** Parce que le barrel est le seul endroit du dépôt où un
oubli est **totalement silencieux** : un symbole non exporté ne casse rien, il rend simplement une
fonctionnalité inatteignable pour un intégrateur, et aucune porte ne le voit. **Dérivé** de la mesure
de la révision 1 : le JavaScript émis exposait **116 valeurs** contre **104** sur le `dist` de
`main`, et la révision 2 ajoute `TEXT_ALIGNMENTS`, donc **117**. Le barrel passe de **185 à 207
symboles**, +11,9 %. ⚠️ **Le 117 est à remesurer** : la sonde 11 de [§6.4] en fait le critère de
sortie d'INC-5.

**Ce qui n'est délibérément PAS exporté** — et chaque exclusion porte son motif : aucune assertion
`*_SATISFIES_TYPE` ni `*_KEYS_IN_STEP` (elles vivent dans `__tests__/`) · aucun
`MAX_STYLE_LENGTH_MM` (`MAX_SHEET_MM` est **importé**) · aucun `STANDARD_FONT_WEIGHTS` (**aucun
consommateur mesuré**) · aucun `ResolvedTypography` (**il ne résout rien**, mesuré 5 × `TS2322`) ·
aucun `BOX_ALIGNMENTS` (le tuple d'alignement de texte s'appelle `TEXT_ALIGNMENTS` et vit dans
`ast/`, pas dans `style/`) · **aucune sixième porte bornée `parseStyle`** — un style n'est jamais un
fragment autonome, il vit dans un nœud que `parseBlockNode` valide déjà.

**Commit.** `feat(core): exposer l'apparence, et épingler le compte du barrel (lot C5, INC-5)`

---

### INC-6 — La démonstration · **L** · publiable

**Contenu.** Dans `apps/playground/src/App.tsx` : un **second** `Template` complet — même structure,
**même `renderData`**, styles différents —, une fonction `styleCssDe(box, typo)` **dérivée du
nœud**, le rendu **au segment** (un `<span>` par run), et l'affichage côte à côte de
`collectTemplateDataPaths(A)` et `collectTemplateDataPaths(B)`, **égaux**.

**Pourquoi c'est L et non M.** Le rendu au segment change le type de retour de `texteDeSegments`
**et tous ses appelants**. C'est le geste le plus lourd du lot, et c'est aussi **le moins gardé** :
`apps/*` est hors du glob de Vitest, donc aucune porte ne relit ce fichier. La démonstration est une
**revue humaine**, pas un `it`.

**Pourquoi la coupure est possible mais coûteuse.** C'est le premier candidat au sacrifice, et le
prix est nommé : **le critère de recette n'est plus démontrable**, puisque `core` ne rend rien. La
coupe rend le lot livrable et **non recevable**.

**Commit.** `feat(playground): montrer deux factures très différentes sur un seul jeu de données (lot C5, INC-6)`

---

### INC-7 — Les corrections du dépôt · **M** · publiable

**Contenu.** Huit énoncés du dépôt que ce lot rend faux, ou qu'il honore autrement que promis. Le
détail fichier par fichier est en [D17] ; en résumé : **cinq docstrings d'`ast/types.ts`** (`:144`
« *how the cells sit inside their column box* » — **le correctif que la revue a rendu
obligatoire** —, `:159-160` la justification promise à C5 et livrée sur un autre tuple, `:203-206`
« any block whatsoever », `:250` la surcharge par cellule, `:366-369` la liste de ce que `TableNode`
ne porte pas), **`nodes.test.ts:112-113`** (une réservation durcie en promesse),
**`page/__tests__/page.test.ts:43-44`** (`bleed` et `gutter` promis à C5 alors que l'ADR 0006 D13 les
range dans un silence) et **`:220-238`** (une assertion non ancrée qui resterait verte sans rien
assurer), et **`docs/roadmap/engine.md:79`** (« core C5 » pour ce qui est C6 — **troisième** relevé,
jamais corrigé).

⚠️ **Ce qui N'EST PAS dans cet incrément, bien qu'il tombe entre deux de ses gestes :** le tuple
`TEXT_ALIGNMENTS` (`ast/types.ts:164`). C'est une **déclaration**, elle appartient à **INC-2**, et
l'y laisser rendrait INC-7 non publiable seul [§3.6].

**Pourquoi c'est un incrément séparé, et pas une ligne d'INC-2.** Parce que huit corrections
mélangées à l'accrochage rendraient le diff d'INC-2 illisible, et parce que le précédent existe :
C4 a livré `366c28a docs(core): rediriger les trois promesses que le lot C4 a périmées` comme commit
dédié.

⚠️ **Point de collision git.** `ast/types.ts` (414 l.) et `ast/schemas.ts` (325 l.) sont touchés par
**INC-2 et INC-7**. **Les faire dans cet ordre, jamais en parallèle.**

**Prix de la coupure, s'il faut couper.** Le dépôt porte **huit** énoncés faux après C5, dont
**cinq** en production, et `engine.md:79` pour la **quatrième** fois.

**Commit.** `docs(core): rediriger les huit promesses que le lot C5 périme ou honore autrement (lot C5, INC-7)`

---

### INC-8 — L'ADR 0007 et la clôture · **M** · publiable

**Contenu.** `docs/adr/0007-l-apparence.md` en `🟢 Accepté` — les 18 décisions, les 9 arbitrages
**avec leurs branches non retenues**, les **huit attentes envers le moteur** [D16], la section « Ce
qui reste ouvert », et les **quatorze signalements** ; `docs/roadmap/core.md` §C5 marqué livré avec
renvoi vers l'ADR ; `docs/adr/0006-la-page.md` gagne une ligne « Complété par [ADR 0007] » ; et
**ce plan passe à `⛔ PÉRIMÉ`**.

**Pourquoi les branches non retenues entrent dans l'ADR.** Parce qu'un plan est périssable et qu'une
ADR fait foi : effacer les branches non retenues laisserait l'ADR **sans les motifs des décisions**,
et c'est le motif — pas la décision — qu'on relit le jour d'une réouverture.

**Commit.** `docs(adr): consigner les dix-huit décisions du lot C5 (lot C5, INC-8)`

---

### Ce qui ne se touche pas

| Chemin | Pourquoi c'est un résultat, et non une abstention |
| :--- | :--- |
| `packages/core/src/errors.ts` | **Zéro code d'erreur nouveau, zéro site nouveau** — la ligne de C4 D9, tenue [D15]. Possible parce que tout ce que C5 refuse est décidable au *save time* **sans données** |
| `packages/core/src/ast/visitor.ts` | **MESURÉ** : les six fonctions de parcours commutent sur `type` et rendent des enfants explicites — un champ de style non-expression coûte **zéro** reprise. **Condition de validité : aucune position de style n'accepte une `Expression`** [D12] |
| `packages/core/src/template/paths.ts` | Même motif : `collectTemplateDataPaths` hérite de `nodeReads`, qui ne bouge pas |
| `packages/core/src/template/guard.ts` | **Aucune porte bornée nouvelle**, et `DEFAULT_SHAPE_LIMITS` **ne bouge pas** : mesuré, le pire régime occupe **13,13 %** de `maxNodes` et **22 %** de `maxDepth` |
| `packages/core/src/page/**` | C5 **lit** `MAX_SHEET_MM` [D7], il n'écrit pas dans `page/`. Et **une bande a le style gratuitement** : `PageBand.content` **est** un `ContainerNode` |
| `packages/core/src/expression/**` | Aucune expression de style [D12] |
| `packages/designer/src/**` | `BlockType = BlockNodeType` est **dérivé**, et C5 n'ajoute **aucun membre** à `BlockNode` — donc il ne bouge pas |
| `packages/viewer/src/**`, `packages/engine/src/**` | Vides, six lignes chacun |
| `tsconfig*.json`, `biome.jsonc`, `tools/biome/*.grit`, `vitest.config.ts`, `turbo.json`, `package.json`, `pnpm-workspace.yaml` | `AGENTS.md` §7. **Aucune dépendance nouvelle** |
| `AGENTS.md` | **Aucune entrée.** La **troisième** forme d'incompatibilité mesurée part en [§8, signalement A], **pas** en amendement : un plan ne s'auto-délivre pas de dérogation, et le véhicule d'un amendement est une ADR **sous mandat** |
| `docs/plans/c1…c4` | Plans **périmés par leur propre en-tête**. Le « 231 » de C4 et ses citations `core.md` décalées partent en [§8, signalements B et C] — on **signale la classe**, on ne réécrit pas un document périmé |

---

## 5. Le plan de test

**Empreinte : 591 → ≈ 628 tests, soit ≈ +37** — ≈ 36 dans `style/__tests__/style.test.ts`, **1** dans
`template/migrate.test.ts`. **Zéro test existant modifié dans son intention.** **Quatre** assertions
sont **mises à jour**, et chacune parce qu'elle a rougi ou qu'elle rougira : le littéral de chaîne de
migration, la liste de clés de `RECIPE_TABLE`, l'ancrage du refus de `page`, et le message entier
greffé sur `migrate.test.ts:506`.

> ⚠️ **Le 627 de la révision 1 était mesuré ; le ≈ 628 ne l'est pas, et il n'est pas arrondi par
> confort.** Trois mouvements se croisent : **+3 refus** [D10, D5], **+1 précédence** (`justify` sur
> un `TextNode`), **−1 `it` de migration supprimé** parce qu'il dupliquait `migrate.test.ts:506`
> [§3.15], et **quatre contrôles positifs qui deviennent des refus** — donc à somme nulle sur le
> compte, mais pas sur le sens. Le chiffre exact sort du remesurage, pas d'une addition écrite ici.

Les tests se répartissent en quatre familles, et le compte est ce qui garantit que chaque champ du
contrat est touché à l'exécution au moins une fois : **17 allers-retours de forme**, **1 aller-retour
à neuf sites** sur un `Template` complet, **27 refus**, **5 précédences**.

### 5.1 Les refus au *save time* — `N01` … `N29` : **`N01`…`N26` mesurés, `N27`…`N29` dérivés**

Contrat émis par `typescript@7.0.2` (exit 0), puis `safeParse` contre le `zod@3.25.76` du dépôt via
`zod/v4`. **Les `code`, les `path` et les messages ci-dessous sont des chaînes relevées, pas des
chaînes espérées.** Une ligne par `issue`.

| # | Entrée fautive | `code` | `path` | Message |
| :-- | :--- | :--- | :--- | :--- |
| `N01` | `color: '#fa0'` (trois chiffres) | `invalid_format` | `["color"]` | `A colour is six hexadecimal digits behind a hash, as #1b3a6f` |
| `N02` | `color: 'red'` (nom CSS) | `invalid_format` | `["color"]` | *idem* |
| `N03` | `color: '#1b3a6fff'` (canal alpha) | `invalid_format` | `["color"]` | *idem* |
| `N04` | `color: 'rgb(1,2,3)'` | `invalid_format` | `["color"]` | *idem* |
| `N05` | `color: 'Canvas'` (couleur système) | `invalid_format` | `["color"]` | *idem* |
| `N06` | `color: 0x1b3a6f` (nombre) | `invalid_type` | `["color"]` | `Invalid input: expected string, received number` |
| `N07` | `sizePt: 0` | `too_small` | `["sizePt"]` | `A font size is at least 1 pt` |
| `N08` | `sizePt: 0.5` | `too_small` | `["sizePt"]` | *idem* |
| `N09` | `sizePt: 14401` | `too_big` | `["sizePt"]` | `A font size is at most 14400 pt` |
| `N10` | `sizePt: NaN` | `invalid_type` | `["sizePt"]` | `Invalid input: expected number, received NaN` |
| `N11` | `sizePt: Infinity` | `invalid_type` | `["sizePt"]` | `Invalid input: expected number, received number` |
| `N12` | `family: ''` | `too_small` | `["family"]` | `A font family name is required` |
| `N13` | `bold: 'yes'` | `invalid_type` | `["bold"]` | `Invalid input: expected boolean, received string` |
| `N14` | `italic: 'yes'` | `invalid_type` | `["italic"]` | `Invalid input: expected boolean, received string` |
| `N15` | `bold: 700` (l'ancienne échelle) | `invalid_type` | `["bold"]` | `Invalid input: expected boolean, received number` |
| `N16` | `align: 'justify'` (ce qu'`ast/types.ts` promettait) | `invalid_value` | `["align"]` | `Invalid option: expected one of "start"\|"center"\|"end"` |
| `N17` | `align: 'middle'` | `invalid_value` | `["align"]` | *idem* |
| `N18` | `border.bottom` sans `color` | `invalid_type` | `["border","bottom","color"]` | `Invalid input: expected string, received undefined` |
| `N19` | `padding: 2` (raccourci scalaire) | `invalid_type` | `["padding"]` | `Invalid input: expected object, received number` |
| `N20` | `padding`, trois arêtes sur quatre | `invalid_type` | `["padding","left"]` | `Invalid input: expected number, received undefined` |
| `N21` | `padding.top: -0.1` | `too_small` | `["padding","top"]` | `A length cannot be negative` |
| `N22` | `border.top.width: -1` | `too_small` | `["border","top","width"]` | `A length cannot be negative` |
| `N23` | `padding.top: 5081` | `too_big` | `["padding","top"]` | `A length is at most 5080 mm` |
| `N24` | `background: '#GGGGGG'` | `invalid_format` | `["background"]` | `A colour is six hexadecimal digits behind a hash, as #1b3a6f` |
| `N25` | `gap: 5` — **le champ retiré du lot** | — | — | ⚠️ **ACCEPTÉ**, et dépouillé en silence |
| `N26` | `align: 'start'` sur `BoxStyleSchema` — **le champ déplacé** | — | — | ⚠️ **ACCEPTÉ**, et dépouillé en silence |
| `N27` | `box: {}`, `typography: {}`, `border: {}` — **l'objet de style vide** | `custom` *(dérivé)* | le champ | `An empty style object is not a style; omit the field` |
| `N28` | `border.top.width: 0` — **le filet d'épaisseur nulle** | `too_small` *(dérivé)* | `["border","top","width"]` | `A rule has a positive width; omit the edge to declare no rule` |
| `N29` | `align: 'justify'` sur un **`TableColumn`** | `invalid_value` *(mesuré, `m2.mjs`)* | `[…,"columns",0,"align"]` | `Invalid option: expected one of "start"\|"center"\|"end"` |

> ⚠️ **`N27`, `N28` et `N29` sont NEUFS en révision 2, et ils sont DÉRIVÉS, pas mesurés.** `N29`
> porte un message que la campagne a réellement rendu (`m2.mjs`), mais sur un contrat où le champ
> n'existait pas encore ; les deux autres sortent de [D10]. **Les trois sont à rejouer avec
> `N01`…`N26` avant INC-5.** Aucun d'eux n'ajoute d'entrée à `SHAPE_ERROR_CODES` [D15].

**`N25` et `N26` sont les deux entrées les plus utiles du tableau, et ce sont des acceptations.**
Elles mesurent le comportement de `z.object` sur une clé inconnue : il la **supprime**, sans erreur.
Un `it` qui écrirait `BoxStyleSchema.safeParse({ align: 'justify' })` en croyant tester quoi que ce
soit sur l'alignement **passerait au vert en n'assurant rien** — c'est le piège le plus vicieux de la
renumérotation, et il est épinglé comme tel. **Le refus de `justify` sur une colonne, lui, est réel
et il s'écrit sur `TableColumnSchema` : c'est `N29`, et pas ailleurs.**

**Les contrôles positifs, mesurés eux aussi**, parce qu'un refus n'a de sens qu'en regard de ce qui
passe : `#FFAA00` **et** `#ffaa00` acceptés (les deux casses) · `sizePt: 10.5` (le demi-point) ·
`sizePt: 1` et `sizePt: 14400` (les deux bornes, dont la haute est **dérivée**) · `width: 0.28`
(0,8 pt, le filet typographique usuel) · `padding` à zéros · `bold: true, italic: false` ·
`align: 'justify'` sur un **`TextNode`** (dérivé — le quatrième membre de `TEXT_ALIGNMENTS`) · et
**une clé inconnue `letterSpacing`, acceptée et dépouillée** — le même mécanisme que `N25`/`N26`.

> ⚠️ **Trois contrôles positifs de la révision 1 sont devenus des REFUS, et c'est le seul endroit du
> plan où une mesure est contredite plutôt que complétée.** `Typography {}`, `BoxStyle {}`,
> `BoxStyle { border: {} }` et `width: 0` étaient **acceptés et relevés comme tels** en `§C.4`. [D10]
> les refuse. Le relevé n'est pas réécrit — il est la **preuve du coût** de la décision inverse —,
> mais **les `it` correspondants changent de sens**, et le remesurage doit les voir passer de vert à
> vert *pour une autre raison*, ce qui est exactement le cas où un test se laisse oublier.

**Deux `it` de bornes dérivées**, qui sont des décisions et non des paraphrases :
`MAX_FONT_SIZE_PT === 14_400` et `mmFromPt(MAX_FONT_SIZE_PT) === MAX_SHEET_MM`. Mesuré dans les deux
sens en binary64 : `5080 * 72 / 25.4 === 14400` et `14400 * 25.4 / 72 === 5080`.

> ⚠️ **Cinq désaccords avec la campagne de mesure `R01` … `R26`, et tous s'expliquent par une
> décision de ce plan.** Ils sont écrits parce qu'un plan qui recopierait les `R` sans les rejouer
> porterait cinq assertions fausses.
>
> 1. **`R19` REVIENT, avec un autre message — et c'est la correction la plus fine de la révision 2.**
>    `border.bottom.width: 0` était refusé par la campagne avec `"A rule width is greater than zero"`.
>    La révision 1 l'acceptait, remplaçant `gt(0)` par `min(0)` ; **la révision 2 rétablit `gt(0)`**
>    [D10], parce que les quatre arêtes d'un `BoxBorder` sont **optionnelles** — l'absence est déjà
>    une orthographe — là où celles d'un `PageMargins` sont **requises**. **Le désaccord ne porte
>    donc plus sur le prédicat, il porte sur le MESSAGE** : `"A rule width is greater than zero"` est
>    une prescription typographique, `"A rule has a positive width; omit the edge to declare no
>    rule"` est une règle de forme canonique avec son remède. C'est `N28`, et un `it` qui attendrait
>    l'ancien message échouerait sur la chaîne, pas sur le code.
> 2. **`R12`, `R13`, `R14` disparaissent.** Les trois refus de `weight` n'ont plus de sujet
>    (⛔ n° 2, option A : `bold?: boolean`). Conséquence heureuse et mesurée : le défaut « zod 4
>    range `.int()` sous `invalid_type` » **n'a plus aucun site dans le lot**, donc le legs à C8 sur
>    ce point est **vide**.
> 3. **`R24`, `R25` sont déplacés.** `gap: -1` et `gap: 5081` n'ont plus de champ ([D11] retire
>    `gap`), mais les deux refus **survivent** sous `["padding","top"]` — `N21` et `N23`, mêmes codes,
>    mêmes messages. **La couverture de refus ne baisse pas.**
> 4. **`R17`, `R18` changent de chemin.** `["align"]` reste, mais sur `TextNodeSchema` et non sur
>    `BoxStyleSchema` ([D5]). C'est ce que `N26` mesure.
> 5. **Le legs `Infinity` à C8 passe de HUIT positions à SIX.** La campagne comptait `sizePt`,
>    `weight`, `gap`, les quatre de `padding` et la `width` d'arête. `weight` et `gap` sortent : il
>    reste **`sizePt`, les quatre de `BoxSpacing`, la `width` d'une arête = six**. Le plan écrit
>    **six**, avec cette dérivation.

**Ce que le lot lègue à C8, compté** : sur les six positions numériques ci-dessus, `Infinity` rend
`Invalid input: expected number, received number` — littéralement inexploitable pour un auteur. Ce
n'est **pas** un défaut de ce lot : il préexiste sur toutes les positions numériques du contrat
depuis C4, qui l'avait déjà versé à C8. Le lot en ajoute six, et le dit.

### 5.2 Le câblage — porte par porte

| Porte | Ce qu'elle joue | Ce que le lot y fait rougir |
| :--- | :--- | :--- |
| **1** — `pnpm run lint` | Biome sur tout le dépôt | **Non joué** (elle écrit son cache). Conformité aux interdits `any` / `!` / `as unknown as` / `@ts-*` / `catch` vide et au plugin `no-environment-read` : **lecture seule** [§9] |
| **2** — `pnpm run build` | `tsc` sur la **production seule** — les tests sont exclus par `packages/core/tsconfig.json` | Les huit `z.object` d'INC-2 ; le dossier `style/` d'INC-1. **Jouée sur le bac à sable : exit 0**, et le JavaScript émis **s'importe** |
| **3** — `pnpm run type-check` | `tsc -p tsconfig.typecheck.json`, **tests inclus** | **C'est ici que les huit paires d'INC-0 mordent**, et nulle part ailleurs : une paire vit dans `__tests__/`, donc la porte 2 ne la voit pas |
| **4** — `pnpm run test:coverage` | build + `vitest run --coverage`, seuils **90 % globaux ET par paquet** | 627 tests. **La couverture n'est pas mesurée** (elle écrit) — [§9] le tient pour acquis |

**Deux filets ont rougi d'eux-mêmes pendant la mesure, et c'est le meilleur signe que le lot est
correctement câblé :**

- **`template/migrate.test.ts:158`** — le littéral de chaîne `[[1,2],[2,3],[3,4],[4,5]]`. C'est
  *« the ONLY mechanical net under the stamp »*, et **aucune des trois conceptions ne l'avait cité**.
- **`ast/__tests__/table.test.ts:387`** — la liste de clés de `RECIPE_TABLE`. ⚠️ **Ce fichier
  était absent du découpage initial du lot** : il est ajouté en [§3.16 bis], et le fait qu'il ait rougi tout seul
  est précisément ce qui l'a fait entrer.

**Un filet resterait vert pour la mauvaise raison, et il est corrigé en préventif.**
`page/__tests__/page.test.ts:220-238` assère `.toThrow(/Invalid input: expected object, received
undefined/)` **sans ancrer le chemin**. Mesuré : avec un champ requis ajouté avant `page`, le test
reste **vert sans rien assurer** — la regex non ancrée capture l'issue du mauvais champ. Il est
**ancré sur `path: ['page']`** en INC-7.

### 5.3 Les deux résolutions et la précédence

Quatre `it`, et chacun épingle une **décision de contrat** plutôt qu'un corps de fonction :

- `resolveTextAlign({ text: 'end', column: 'start' })` → `'end'` — **le bloc l'emporte sur le défaut
  de colonne**, et c'est un défaut qui cède, pas une rivalité qui se tranche [D5].
- `resolveTextAlign({ column: 'start' })` → `'start'` — **un champ absent n'écrase pas**, il cède.
- `resolveTextAlign({ text: 'justify' })` → `'justify'` — **le quatrième membre existe côté texte**,
  et un `column: 'justify'` ne compile pas : le sous-typage est strict dans un seul sens [D5].
- `resolveTextAlign({})` → `undefined` — **aucun défaut** : le contrat ne décide pas d'alignement à la
  place de l'auteur [D12].
- `resolveTypography({ run: { bold: true }, block: { family: 'X', sizePt: 9 } })` →
  `{ family: 'X', sizePt: 9, bold: true, italic: undefined, color: undefined }` — la résolution est
  **par champ**, pas par objet : un `run` qui déclare une graisse n'efface pas la police du bloc.

⚠️ **La forme d'assertion est imposée par une mesure.** `resolveTypography` rend **cinq clés dont
deux valent `undefined`** ; `JSON.stringify` n'en montre que trois. Un aller-retour JSON s'y casse :
il faut `toStrictEqual` avec les cinq clés écrites.

### 5.4 La migration — quatre contrats

- **L'estampille.** Un document `schemaVersion: 5` valide ressort à **6**, et **rien d'autre ne
  change** : la migration est `{ ...input, schemaVersion: 6 }`. Coût en forme bornée mesuré :
  **delta exactement 0**.
- **La chaîne complète.** `TEMPLATE_MIGRATIONS` porte **cinq** entrées,
  `[[1,2],[2,3],[3,4],[4,5],[5,6]]`, et un document v1 monte en **cinq étapes** jusqu'à 6. Mesuré
  bout en bout : `16 valeurs / 7 niveaux → 27 / 7`, **delta +11 valeurs et +0 niveau** — et les onze
  viennent **toutes** de la migration 4 → 5, aucune de celle-ci.
- **Le refus vers le haut.** Un document `schemaVersion: 6` passé au build de `main` rend
  `TemplateMigrationError`, avec `fromVersion === 6` et le message au caractère près. **Ni
  `err.code`, ni `err.to`** : ils n'existent pas [§8, signalement G].
- **L'absence de garde vers le bas, dite explicitement.** Un document **sous-estampillé** — un v5
  fabriqué à la main qui porterait déjà un `box` — n'est **pas** refusé : il parse, et il ressort à
  l'estampille courante. Le garde ne protège que vers le haut. Ce n'est pas un défaut du lot, c'est
  la propriété que les entrées 1 → 2 et 2 → 3 de `migrate.ts` documentent déjà, et elle se transpose
  mot pour mot.

### 5.5 Les huit paires `*_KEYS_IN_STEP`, et la matrice de mutation

C'est le seul filet outillé contre un champ ajouté au **type** et oublié dans le **schéma** — et ce
défaut est exactement celui que C5 peut commettre huit fois.

**Avant INC-0, mesuré : 3 mutations sur 4 passent à exit 0.** Un champ de style retiré d'un schéma
sans l'être de son type ne fait rougir aucune des quatre portes, et **591 tests sur 591 restent
verts**.

**Après INC-0, mesuré : 11 mutations, 11 exit 1.** C'est le critère de sortie de l'incrément, et il
est mécanique — chacune des onze est une commande, pas une intention.

**Les deux contre-épreuves de non-inertie.** Les paires de `loop` et de `condition` portent sur les
deux nœuds auxquels C5 n'accroche **rien**. Leur rôle est de prouver que la garde ne rougit pas
toute seule : si elles rougissaient, c'est le patron qui serait faux, pas le contrat.

⚠️ **Le neuvième site est ingardable, et c'est structurel.** `Template` ne peut pas avoir de paire :
son type **est** inféré de son schéma, donc l'assertion serait tautologique. Son seul filet possible
est un **aller-retour JSON sur un littéral qui porte un style à chacun des neuf sites**, et c'est
pour cela que `RECIPE_TEMPLATE` gagne un style partout en [§3.14]. À écrire dans l'ADR comme une
**limite du patron**, pas comme un oubli [§8, signalement H].

### 5.6 Ce qui reste hors des tests, et pourquoi

- **La démonstration du critère de recette.** `apps/*` est hors du glob de Vitest : aucune porte ne
  relit `App.tsx`. Le geste le plus lourd du lot — le rendu au segment — est **le moins gardé**, et
  sa validation est une **revue humaine**.
- **« Visuellement très différentes ».** Aucune assertion ne peut l'exprimer. Le [§6.3] nomme qui en
  juge et sur quoi.
- **L'identité aperçu / PDF.** Hors de portée par construction : il n'existe pas de moteur, et
  `page/area.ts` l'écrit déjà pour lui-même — *« What it does NOT promise: identity at the PIXEL »*.
  C'est **V3**.
- **La résolution d'une police absente.** Le contrat déclare un nom ; ce qu'un moteur en fait est une
  **attente**, consignée dans l'ADR 0007 [D16], et intestable ici.
- **Le comportement d'un style sur une boîte coupée entre deux pages.** C'est la première famille de
  propriétés du contrat dont le rendu dépend du **point de coupe** — un `padding` et un `border` sur
  un bloc que la pagination traverse. Le contrat est **muet**, délibérément, et l'attente part dans
  l'ADR : c'est E2 qui tranchera.

---

## 6. Le critère de recette, et comment on le démontre

### 6.1 L'énoncé, et sa lecture

`docs/roadmap/core.md:215-216` :

> **Prêt quand** deux factures visuellement très différentes sont décrites sans
> changer une seule donnée.

**Ce que l'énoncé exige, mot par mot.** *Deux* — il faut deux modèles, pas un modèle paramétrable.
*Visuellement très différentes* — la différence doit être perceptible sans instrument. *Décrites* —
par le contrat, donc dans la forme stockée, et non par le code d'une vitrine. *Sans changer une
seule donnée* — le jeu de données est **identique**, et c'est la seule contrainte dure : elle
condamne à elle seule toute expression en position de style [D12].

> ⚠️ **Et il faut dire tout de suite ce que ce critère NE fait PAS, parce que la mesure est
> gênante : il ne justifie pas le contrat que ce lot livre.**
>
> Pris à la lettre, **deux champs suffisent**. Un `background` et un `sizePt` produisent déjà deux
> factures « visuellement très différentes » sur un jeu de données identique — et cela vaut pour
> **dix des douze champs** du contrat : leur retrait ne fait pas tomber l'énoncé. Le critère est
> donc satisfait par un contrat que personne ne voudrait, et un plan qui s'appuierait sur lui pour
> justifier ses douze champs raisonnerait à faux.
>
> **La charge de justification repose ailleurs, et [D1] le dit : sur l'énumération de
> `docs/roadmap/core.md:209-212`** — *polices et tailles, graisse et italique, couleurs de texte et
> de fond, bordures et filets, alignements, espacements* — soit **dix attributs en six groupes**.
> C'est cette liste qui commande le périmètre. Le « prêt quand » commande la **démonstration**, ce
> qui n'est pas la même fonction.
>
> C'est aussi pourquoi la quatrième condition d'appartenance de [D1] **n'est pas** « son retrait
> fait tomber le critère de recette » : cette condition-là est mesurée fausse pour dix champs sur
> douze, et l'écrire aurait donné un critère qui n'écarte rien — le défaut exact que la relecture
> adverse reprochait aux trois conceptions.

**Ce que le lot livre au-delà du critère, et il faut le dire pour que le prochain lecteur ne croie
pas le critère incomplet** — C4 a écrit exactement cette réserve pour lui-même. Deux choses :
la **conversion pt ↔ mm exportée**, dont aucun critère ne parle et que la décision produit 7 exige
[D6] ; et les **deux résolutions**, qui ne rendent aucune facture plus différente d'une autre mais
sans lesquelles deux implémentations résoudraient la précédence différemment [D5].

### 6.2 Le modèle de recette, et les `it` qui le démontrent

**La fixture : `RECIPE_STYLE_A` et `RECIPE_STYLE_B` dans
`packages/core/src/style/__tests__/fixtures.ts`.** Deux `Template` complets, **une seule structure**,
**un seul jeu de données**. Ce que A et B ne partagent pas, ce sont uniquement les valeurs de `box`,
de `typography` et d'`align`.

Concrètement, les deux apparences que la fixture décrit — et elles couvrent les six groupes de
l'énumération :

| | A — « administrative » | B — « éditoriale » |
| :--- | :--- | :--- |
| Police, taille | une famille à empattement, 9 pt | une famille sans empattement, 11 pt |
| Graisse, italique | en-têtes en gras | en-têtes en gras, mentions en italique |
| Couleur de texte | noir | un bleu d'encre |
| Couleur de fond | aucun fond | bandeau d'en-tête plein, lignes de total teintées |
| Bordures, filets | cadre extérieur du tableau, **un filet horizontal par ligne** | aucun cadre, **un seul filet sous l'en-tête** |
| Alignement | montants à `end` | montants à `end`, désignations à `start`, titre `center`, **mentions légales `justify`** |
| Espacements | `padding` serré | `padding` aéré |

> ⚠️ **« Grille complète » a été retiré de la ligne « bordures », et le retrait est un correctif, pas
> un adoucissement.** Le contrat porte un `box` sur le `table` et un sur le `tableRow` : cela donne
> le **cadre** et les **filets horizontaux**, et **rien de vertical** — il n'existe ni style de
> cellule, ni filet de colonne, et `border-collapse` est refusé comme modèle de mise en page [D1,
> condition 3]. Une grille complète exigerait donc que le renderer **invente** les séparateurs de
> colonnes. Une fixture qui promet ce que le contrat ne porte pas est un critère de recette qui se
> démontre par une invention du moteur — c'est-à-dire qui ne se démontre pas. Ce que le lot livre est
> écrit ci-dessus, et il suffit largement à « deux apparences très différentes ».
>
> **Ce que ce retrait rend visible, en revanche, est une vraie question, et elle part en attente
> moteur :** trois filets peuvent se superposer sur un même trait — le `border.bottom` de la ligne
> *n*, le `border.top` de la ligne *n+1*, et une arête du `table`. Le contrat n'a **aucun modèle de
> fusion**, donc c'est l'attente n° 6 de [D16].

⚠️ **Deux règles héritées des fixtures existantes, qui ne sont pas décoratives** : **aucune factory
exportée ne reste non appelée**, et **rien n'est importé de `vitest`** dans un fichier de fixtures —
parce que ces fichiers sont compilés dans `dist` et instrumentés par la couverture. Une fixture qui
importerait `vitest` publierait cet import dans le paquet.

**Les `it` qui démontrent le critère**, et chacun assure une chose que les autres n'assurent pas :

1. **`parseTemplate` accepte A et B**, et rend `schemaVersion: 6` pour les deux. Sans lui, le reste
   ne prouve rien : le critère dit *décrites*, donc le contrat doit les accepter.
2. **Les données sont identiques, structurellement.** `collectTemplateDataPaths(A)` et
   `collectTemplateDataPaths(B)` rendent **la même liste, dans le même ordre**. C'est la traduction
   testable de « sans changer une seule donnée » — et c'est la seule qui vaille, parce qu'une
   comparaison de `renderData` ne prouverait que l'égalité de la fixture avec elle-même.
3. **La structure est identique, le style seul diffère.** Un aller-retour qui compare A et B après
   avoir **effacé** `box`, `typography` et `align` de chacun rend deux arbres égaux. C'est ce qui
   interdit qu'une des deux apparences ait été obtenue en déplaçant un nœud.
4. **Les deux apparences diffèrent réellement dans la forme stockée.** Le même aller-retour, cette
   fois en ne gardant **que** les trois champs de style, rend deux arbres **différents** — et le test
   compte les nœuds où ils diffèrent, pour qu'un `it` vert ne puisse pas signifier « ils diffèrent
   d'un espace ».
5. **Chacun des six groupes de l'énumération est exercé au moins une fois** par A ou par B. Ce n'est
   pas un test de qualité visuelle : c'est un test de **couverture du périmètre déclaré**, et c'est
   ce qui rattache la fixture à `core.md:209-212` plutôt qu'au « prêt quand ».
6. **L'aller-retour à neuf sites.** `RECIPE_TEMPLATE` porte un style à **chacun des neuf sites
   d'accrochage**, sérialisé puis reparsé : c'est le **seul** filet possible sur `Template`, qui ne
   peut pas avoir de paire `*_KEYS_IN_STEP` [§8, signalement H].
7. **Aucune des deux fixtures ne porte un objet de style vide, et c'est assuré par le parse.** Depuis
   [D10], `box: {}` est **refusé** : un `it` qui construirait une fixture avec un style vide ne
   passerait pas `parseTemplate`, donc le point 1 le voit. **C'est le seul endroit où une décision de
   forme canonique est gardée sans écrire d'assertion pour elle** — et c'est voulu : une fixture est
   le premier endroit où une forme refusée revient par habitude.

### 6.3 La démonstration visible — le playground, et ce qu'il ne peut pas montrer

**`core` ne peint rien.** La vitrine dessine donc elle-même, et c'est cette asymétrie qu'INC-6
corrige : aujourd'hui `apps/playground/src/App.tsx` porte une quinzaine de constantes CSS écrites en
React, dont **aucune ne vient du modèle**.

**Ce que le playground doit montrer après INC-6**, et rien de moins :

- **les deux factures côte à côte**, rendues par la **même** fonction de rendu, à partir des **deux**
  modèles et du **même** `renderData` ;
- **`styleCssDe(box, typo)` dérivée du nœud** — pas une table de correspondance écrite à la main, pas
  une classe CSS par apparence : la fonction lit le style **du modèle** et n'a aucune connaissance de
  A ni de B. C'est ce qui fait de la démonstration une preuve plutôt qu'une illustration ;
- **le rendu au segment** — un `<span>` par run —, sans quoi « graisse et italique » à l'intérieur
  d'une phrase n'est pas montrable. C'est le geste le plus lourd du lot : il change le type de retour
  de `texteDeSegments` et **tous ses appelants** ;
- **les deux listes de chemins de données, affichées et égales.** C'est la partie du critère qu'un
  lecteur ne peut pas vérifier à l'œil, donc c'est celle qu'il faut écrire à l'écran.

**Ce qu'il ne peut pas montrer, et ce n'est pas un manque du lot :**

- **Aucun PDF.** `packages/engine` fait six lignes. Le critère dit *décrites*, pas *rendues*.
- **Aucune preuve de fidélité.** L'égalité aperçu / PDF est la décision produit 7, et son contrôle
  automatique est **V3** — `page/area.ts` écrit déjà, pour lui-même, qu'il ne promet pas l'identité
  au pixel.
- **Aucune police réelle garantie.** Le navigateur du playground résout les familles qu'il a ; une
  famille absente sera remplacée **par le navigateur**, silencieusement. C'est exactement le danger
  que [D9] inscrit dans le contrat plutôt que de prétendre le résoudre.
- **Aucune coupe de page.** Une boîte à `padding` et `border` traversée par une pagination est la
  première famille de propriétés du contrat dont le rendu dépend du point de coupe — et il n'y a pas
  de pagination.

**Qui juge « visuellement très différentes ».** Personne mécaniquement, et le plan le nomme :
c'est une **revue humaine**, faite par le propriétaire du produit sur la capture des deux vitrines
côte à côte. La décision produit 14 prévoit d'ailleurs une validation par un utilisateur métier ;
celle-ci est plus modeste, et elle est la seule que le lot peut offrir.

### 6.4 Définition de fini — critères vérifiables mécaniquement

Chaque sonde vient avec sa **contre-épreuve de non-inertie** : une variante qui, elle, **doit** rendre
quelque chose. Une commande de vérification qui rend toujours zéro ne prouve rien — c'est le piège
que C4 a documenté, et il vaut pour chacune des lignes ci-dessous.

> ⚠️ **Six sondes de la révision 1 étaient INEXÉCUTABLES, et elles ont été corrigées ici.** Le
> défaut était toujours le même : la sonde cherchait **un mot** là où le critère porte sur **une
> déclaration**, et le mot apparaît dans les docstrings du lot — qui expliquent précisément
> pourquoi la déclaration n'existe pas. Une définition de fini qui rougit sur sa propre
> justification n'est pas une définition de fini. Le détail de chaque correction est sous le
> tableau, parce qu'une sonde corrigée sans son motif se refera casser au lot suivant.

| # | Sonde | Attendu | Contre-épreuve de non-inertie |
| :-- | :--- | :--- | :--- |
| 1 | `pnpm run lint && pnpm run build && pnpm run type-check && pnpm run test:coverage` | exit 0 | — (c'est la CI) |
| 2 | `git diff --exit-code "$(git merge-base origin/main HEAD)" HEAD -- AGENTS.md` | **exit 0** — aucun amendement | la même commande sur `packages/core/src/ast/types.ts` **doit** rendre exit 1 |
| 3 | `git grep -nE "5080" -- packages/core/src/style` | **zéro ligne** — la borne est **importée**, jamais recopiée, sous quelque nom que ce soit | `git grep -n "MAX_SHEET_MM" -- packages/core/src/style` **doit** rendre au moins une ligne |
| 4 | `git grep -nE "(type\|interface) +ResolvedTypography" -- packages` | **zéro ligne** — le **type** n'existe pas ; la docstring qui explique pourquoi, si | `git grep -n "resolveTypography" -- packages/core/src/style` **doit** rendre au moins une ligne |
| 5 | `git grep -nE "\bgap\b *\??:" -- packages/core/src/style` | **zéro ligne** — aucun **champ** et aucune **clé de schéma** nommés `gap` | `git grep -nE "\bpadding\b *\??:" -- packages/core/src/style` **doit** rendre au moins une ligne |
| 6 | `git grep -n "z.ZodType" -- packages/core/src/style` | **zéro ligne** — annoter détruit la porte de type | `git grep -n "z.ZodType" -- packages/core/src/ast` **doit** rendre au moins une ligne (l'AST récursif, lui, en a besoin) |
| 7 | `git grep -n "core C5" -- docs/roadmap docs/adr` | **zéro ligne** | `git grep -n "C6" -- docs/roadmap/engine.md` **doit** rendre au moins une ligne |
| 8 | `git grep -nE "bleed\|gutter" -- packages/core/src` | **zéro ligne** — ni champ, ni promesse | `git grep -nE "bleed\|gutter" -- docs/adr` **doit** rendre au moins une ligne (l'ADR 0006 les refuse par écrit) |
| 9 | `git grep -n "TABLE_COLUMN_ALIGNMENTS = " -- packages/core/src/ast/types.ts` | **une ligne, et son tuple porte TROIS membres** — `justify` n'y entre pas | `git grep -n "TEXT_ALIGNMENTS = " -- packages/core/src/ast/types.ts` **doit** rendre une ligne, dérivée par *spread* et portant `'justify'` |
| 10 | `git grep -c "_KEYS_IN_STEP" -- packages/core/src/ast/__tests__/nodes.test.ts` | **13** — 5 relevés à HEAD, +8 en INC-0 *(raisonné : le 5 est mesuré, le 13 est une addition)* | retirer une paire **doit** faire rougir la porte 3 |
| 11 | `node -e "import('./packages/core/dist/index.js').then(m => console.log(Object.keys(m).length))"` | **117** valeurs *(**dérivé** : 116 mesuré en révision 1, + `TEXT_ALIGNMENTS`)* | la même commande sur un `dist` de `main` **doit** rendre 104 |
| 12a | `git grep -n "CURRENT_SCHEMA_VERSION = 6" -- packages/core/src/template/template.ts` | **une ligne** | `git grep -n "CURRENT_SCHEMA_VERSION = 5"` **doit** rendre zéro ligne |
| 12b | `git grep -n "schemaVersion: 6" -- packages/core/src/template/migrate.ts` | **une ligne** — l'estampille de l'entrée 5 → 6 | `git grep -n "from: 5" -- packages/core/src/template/migrate.ts` **doit** rendre une ligne |
| 13 | `git grep -nE "(BoxStyleSchema\|TypographySchema\|BoxBorderSchema)\.(extend\|pick\|omit)" -- packages` | **zéro ligne** — un `.refine` d'objet **ne survit pas** à ces trois appels (`S-6`, mesuré) | `git grep -n "\.refine(" -- packages/core/src/style/schemas.ts` **doit** rendre **trois** lignes |
| 14 | `git grep -nE "widthMm\|heightMm" -- packages/core/src` | **zéro ligne** — le lot ne stocke **aucune** dimension [n° 4, n° 5] | `git grep -n "MIN_COLUMN_WIDTH" -- packages/core/src/ast` **doit** rendre au moins une ligne (le poids de colonne, lui, existe) |

**Les six corrections, avec le motif de chacune — parce qu'une sonde corrigée sans motif se refera
casser.**

1. **Sonde 3.** `git grep "MAX_STYLE_LENGTH_MM" -- packages` attendait zéro **et aurait rendu une
   ligne** : la docstring de `MAX_FONT_SIZE_PT` **nomme** cette constante pour dire qu'elle n'existe
   pas (« *an earlier draft declared `MAX_STYLE_LENGTH_MM = 5080`* »). La sonde corrigée cherche la
   **valeur** `5080` dans `style/`, ce qui est exactement le critère : la borne s'importe, elle ne se
   recopie pas — **sous aucun nom**, y compris un nom qu'on n'a pas prévu.
2. **Sonde 4.** Même défaut : `ResolvedTypography` est nommé **deux fois** dans les docstrings du lot
   (`style/types.ts` et `style/resolve.ts`), qui expliquent pourquoi ce type n'existe pas. La sonde
   corrigée cherche une **déclaration**.
3. **Sonde 5.** Même défaut, et la révision 1 s'était **elle-même contredite** : elle notait en
   « faux positif » que « *le refus de `gap` est écrit en D11 et dans l'ADR, **pas** dans une
   docstring de `style/`* », alors que la docstring de `BoxStyle` l'écrit noir sur blanc. La sonde
   corrigée cherche une **déclaration de champ ou une clé de schéma** (`gap?:` / `gap:`).
4. **Sonde 7.** `git grep "core C5" -- docs` attendait zéro **en incluant ce plan**, qui **cite** la
   chaîne fautive quatre fois pour la corriger. Une fois le plan suivi par Git, la sonde rougit
   toujours. Le pathspec est resserré sur `docs/roadmap docs/adr` — les documents qui **font foi** —,
   et les plans en sont exclus parce qu'ils sont **périssables** et qu'ils citent nécessairement ce
   qu'ils corrigent.
5. **Sonde 8.** `-E "bleed\|gutter"` cherche le **pipe littéral** : en expression rationnelle
   étendue, `|` est l'alternation et `\|` est le caractère. La sonde cherchait donc la chaîne
   `bleed|gutter`, qui n'existe nulle part — **elle rendait zéro pour la mauvaise raison, et sa
   contre-épreuve aussi**, ce qui est le seul cas où le garde-fou anti-inertie échoue lui-même. Les
   deux sont corrigées.
6. **Sonde 12.** `git grep "schemaVersion: 6" -- packages/core/src/template` attendait « au moins
   deux lignes (`template.ts`, `migrate.ts`) », mais `template.ts` écrit
   `export const CURRENT_SCHEMA_VERSION = 6` — **la chaîne `schemaVersion: 6` n'y apparaît pas**.
   Scindée en deux sondes, une par fichier, chacune sur la forme que le fichier écrit réellement.

**Et la sonde 9 est refaite, pas corrigée.** L'ancienne cherchait `justify` dans
`packages/core/src` en attendant « au plus la docstring de refus » — un attendu qu'aucune commande
ne vérifie, et qui est devenu **faux** : `justify` est désormais un **membre de tuple** [D5]. Le fait
à épingler n'est plus une absence, c'est une **frontière** : trois membres sur le tuple de colonne,
quatre sur celui du texte. La sonde le lit là où il est déclaré.

**Deux sondes neuves, et chacune garde une décision de la révision 2.** La **13** garde la fragilité
`S-6` que [D10] a acceptée en connaissance de cause : un `.refine` porté par l'objet disparaît en
silence si un lot ultérieur écrit `BoxStyleSchema.extend({…})`, et la seule protection possible est
d'interdire l'appel. La **14** garde la cohérence de n° 4 et n° 5 : la largeur est **dérivée**,
jamais stockée, et le jour où un champ de dimension apparaît, c'est une décision, pas une dérive.

**Ce que la définition de fini ne peut pas cocher**, et qui reste une revue : « deux factures
visuellement très différentes » [§6.3], la conformité de `App.tsx` (hors du glob de Vitest), et la
justesse des huit attentes envers le moteur consignées dans l'ADR — elles ne seront vérifiables qu'au
lot E2.

---

## 7. Ce que ce lot n'est pas

**Vingt-six refus, en sept familles.** La liste complète, avec le motif de chacun, est en
[§2, D18] ; ce qui suit en est la carte, et chaque refus porte **le lot qui le possède** — parce
qu'un refus sans propriétaire est un trou, pas une décision.

**(1) Ce qui exigerait de lire la machine — six refus.** Métrique de police · dimensionnement `auto`
· interligne dérivé de la police · pile de polices de repli · couleur système (`Canvas`, `LinkText`)
· résolution ou DPI. **Personne ne les possède, et c'est définitif** : `core` et `engine` n'ont pas
le droit de lire leur environnement, l'interdit est outillé, et un moteur qui le violerait ne
produirait pas deux fois le même document. C'est le lot E6 qui garde cette porte.

**(2) Ce qui appartient aux calques — quatre refus.** Filigrane · fond de page · cachet · couleur du
papier. **C11 et D10.** L'ADR 0006 le tranche dans une décision, et la frontière est physique plutôt
que conventionnelle : une bande **occupe** de la place en haut ou en bas de la feuille, un filigrane
est **derrière le flux, au milieu** — ce ne sont pas deux réglages du même objet. ⚠️ La couleur du
papier est attribuée **deux fois** dans l'ADR 0006 — à C5 dans un motif d'écart, à C11/D10 dans une
décision ; C5 retient la **seconde**, et le dit, parce qu'un lecteur de bonne foi lui opposera la
première [§8, signalement L].

**(3) Ce qui appartient au moteur — quatre refus.** Pagination · report de page · politique de coupe,
veuves et orphelines comprises · en-tête de tableau répété. **E2 et E3.** Un contrat qui déclarerait
l'un des quatre prescrirait depuis un endroit sans autorité — c'est la correction que C3 a dû
s'appliquer à lui-même. Les **huit attentes** que ce lot crée envers le moteur vivent dans l'ADR
0007, et dans aucune docstring [D16].

**(4) Ce qui appartient à un autre lot du contrat — quatre refus.** L'insécabilité `keepTogether`
(**C7**, qui « Dépend de : C4 » et doit trouver sa place **vide**) · le format des nombres, des dates
et de la devise, et les libellés fixes (**C6** — il change *les caractères qu'un lecteur lit*, là où
C5 ne change que *la forme de caractères déjà décidés*) · le fond perdu et la gouttière (**`page/`**,
et l'ADR 0006 D13 les range dans un silence — ⛔ n° 7) · le contrôle de fidélité aperçu / PDF
(**V3**).

**(5) Ce que le contrat refuse d'exprimer, par décision propre — trois refus.** La **cascade** ·
l'**expression en position de style** · la **table de styles nommés**. Les trois sont des décisions
de ce lot et non des frontières : [D12] pour les deux premières, ⛔ n° 3 pour la troisième. La
cascade n'est **pas** refusée par emprunt à l'ADR 0004 D8 — l'analogie avec l'héritage d'arrondi ne
tient pas, un arrondi change un chiffre et un style ne change qu'une forme — elle est refusée sur son
propre motif, et [D12] l'écrit.

**(6) Ce que le contrat refuse comme champ — trois refus.** `gap` et `margin` [D11, ⛔ n° 6] · la
**largeur stockée** d'un tableau et la taille d'une image [n° 4, n° 5, **tranchés**] · l'alignement
**vertical** [n° 9]. Ce sont les refus les plus contestables du lot, et **trois d'entre eux ont été
tranchés en révision 2** plutôt que remontés — deux parce que la revue a montré que le lot avait
lui-même l'argument, le troisième parce qu'un contournement exact est apparu avec le modèle de boîte.
**La largeur d'un tableau n'est plus un refus au sens plein** : elle n'est pas *stockée*, elle est
**dérivée**, et le contrat écrit sa dérivation [D11].

**(7) Ce que le contrat refuse comme SECONDE ORTHOGRAPHE — trois refus.** L'objet de style vide · le
filet d'épaisseur nulle · `justify` sur une **colonne**. Famille neuve en révision 2 [D10, D5]. Elle
ne retire **aucune capacité** : chacun de ces trois faits reste exprimable, et d'une seule façon.
Elle existe parce qu'un contrat qui accepte deux écritures d'un même fait casse un diff, un état
sale, un hachage et un `undo` — et parce que ces trois refus sont **gratuits aujourd'hui et
impossibles demain**, les champs étant neufs.

⚠️ **Et `justify` n'est plus un refus du tout : il est LIVRÉ** [D5, n° 8 tranché], sur un tuple propre
au texte. Le motif du refus — « mesurer les mots, c'est lire la machine » — prouvait trop : centrer
une ligne exige la même métrique, et `center` est publié dans `main`.

**Et un refus qui n'est pas dans les familles, parce qu'il porte sur le lot entier : zéro code
d'erreur nouveau, zéro site nouveau.** `errors.ts` sort du lot **octet pour octet**, comme en C4
[D15]. Ce n'est possible que parce que tout ce que C5 refuse est décidable au *save time*, sur le
seul document, **sans données et sans pagination** — la condition 3 de [D1].

---

## 8. Les neuf arbitrages

> **Ce que sont ces arbitrages.** Neuf questions que **ce plan ne peut pas trancher seul**, parce
> qu'aucune ne se lit dans un texte du dépôt. Chacune porte : la question en une phrase · les
> options A/B/C · le **motif écrit AVANT la décision** · le **coût de réouverture** · et une
> **recommandation**.
>
> **⛔ marque les arbitrages dont la réponse change la FORME du contrat**, donc une réécriture du
> §3 du plan. Après décision, le même ⛔ se relit comme **coût de réouverture**.
>
> **Le contrat est écrit dans la forme recommandée.** C'est le patron de C4, dont les sept
> arbitrages ont été tranchés après coup, **six sur la recommandation du plan** — et dont le
> septième (`n° 6`, les variantes de première page) a été tranché **contre** la recommandation,
> avec le motif que le plan avait lui-même porté contre elle. Un plan qui ne recommande pas force
> le propriétaire du produit à concevoir ; un plan qui décide en silence lui vole la décision.
>
> **Consigne de conservation.** Le plan **ne supprime pas** les branches non retenues : « un plan
> qui effacerait les branches non retenues laisserait l'ADR sans les motifs des décisions ».

---

### ✅ n° 1 — La résolution typographique a-t-elle un troisième terme, c'est-à-dire une baseline déclarée par le `Template` ? — **TRANCHÉ**

**La question.** Le contrat retenu résout la typographie en **deux** termes (`segment ?? nœud`,
[D4]). Faut-il un troisième — `Template.style` — et s'il entre, est-il **requis** ou
**optionnel** ?

**Le motif, écrit avant la décision.** *(MESURÉ, `m10.mjs`.)* « Une police, une taille, pour toute
la facture » est la déclaration la plus banale qu'un modèle de facture fait, et elle coûte :

| forme | coût sur le modèle du playground | facteur |
| :--- | ---: | ---: |
| par segment (41 sites) | +123 valeurs (+22,4 %) | 41× |
| par nœud texte (20 sites) — **le contrat retenu** | +60 valeurs (+10,9 %) | 20× |
| dans un `Template.style` unique | +3 valeurs (+0,5 %) | 1× |

**Et c'est le troisième terme, et lui seul, qui rendrait le nom `ResolvedTypography` honnête** : le
contrat reconstruit promettait cinq champs résolus et en livrait cinq `T | undefined`, mesuré
5 × `TS2322` [`B1`]. Sans lui, la police, la taille, la graisse, l'italique et la couleur d'un run
qui n'en déclare aucun sont **décidées par le rendu** — le mécanisme exact que `Template.page`
requis a refusé : « *an absent page forces the engine to invent a sheet, which moves a layout
decision into a render file, with nothing checking that the viewer invents the same one* »
(`template/template.ts:141-143`).

**Ce que le troisième terme coûte, et c'est chiffré des deux côtés.**

- **S'il est REQUIS** : c'est le **second rétrécissement non vacuous** du dépôt. **MESURÉ**
  (`campagne de mesure §6.4`) : **1 seul diagnostic au compilateur** (`fixtures.ts:152`, `TS2741`) mais
  **28 tests en échec dans 6 fichiers** — donc un plan qui compte les littéraux sous-estime le
  travail d'un facteur 28. Et il faut écrire une **baseline de compatibilité** dans `migrate.ts`,
  ce qui **exige un mandat produit** : la page A4/20 mm est « *une décision produit, prise par le
  propriétaire du produit le 2026-08-18, **not a deduction*** », et **une police de compatibilité
  est un cran pire** — A4 est fausse pour une partie du monde mais elle **existe** partout ; une
  `fontFamily: 'Helvetica'` désigne une ressource qui **peut ne pas exister** sur la machine de
  rendu, et la résoudre est une **lecture de la machine**, refusée et outillée. *(C'est l'argument
  le plus fort du dossier, et il vient de la conception A contre la conception B.)*
- **S'il est OPTIONNEL** : le rétrécissement disparaît, les 28 tests aussi, mais la fonction rend
  toujours cinq `T | undefined` — **le nom reste malhonnête et le problème n'est pas résolu**.
  C'est le pire des deux mondes : un champ de document stocké, donc irréversible, pour zéro
  garantie.
- **Dans les deux cas** : `page/__tests__/page.test.ts:220-238` resterait **vert pour la mauvaise
  raison** — mesuré, deux issues, `style` **avant** `page`, regex non ancrée [`V-7.2`]. Le lot
  ancre l'assertion **de toute façon** [D17], donc ce coût est déjà payé.

**Les options.**

- **A *(recommandé)*** — **deux termes, pas de `Template.style`.** Les cinq valeurs absentes sont
  des **attentes nommées envers le moteur** dans l'ADR 0007 [D16], et le type ne s'appelle pas
  « Resolved ». Argument : le coût est de **10,9 %** et non 22,4 %, aucun mandat produit n'est
  requis, aucun rétrécissement, zéro test à reprendre, et **l'ADR 0004 D8 fournit un précédent
  publié dans ce sens** — refus de tout défaut de document et de tout héritage par sous-arbre,
  déclaré **irréversible**.
- **B** — **`Template.style` requis, avec sa baseline de compatibilité.** Argument, et il est
  sérieux : c'est la seule forme où « deux factures décrites » signifie que le **modèle** décide
  tout, et où la décision 7 (« identique, garanti ») ne repose pas sur cinq défauts que deux
  moteurs inventent séparément. **Prix : un mandat produit sur les valeurs de la baseline, 28
  tests, et une ressource dont Openview ne peut pas garantir la présence.**
- **C** — **`Template.style` optionnel.** Argument : le confort d'écriture sans le mandat. Prix :
  un champ de document irréversible pour zéro garantie, et le nom reste faux.

**Coût de réouverture (A → B) :** la signature de `resolveTypography` gagne un terme (réversible),
mais `TemplateSchema` gagne un champ **requis** — donc `migrate.ts` devient **transformant**, la
migration doit écrire sept valeurs qu'un humain doit avoir choisies, 28 tests se reprennent, et
`page.test.ts:226-232` doit porter un `style`. **Le §3 du plan se réécrit en partie.**
**(A → C) :** un champ optionnel sur `Template`, une estampille (déjà due), zéro test — mais la
réécriture du motif de D4 en entier.

---

#### ✅ TRANCHÉ en révision 2 — **A**, et le ⛔ tombe

**La décision : deux termes, aucune baseline de document.** Le lot est clos sur cette branche, et
trois raisons la portent — dont deux que le plan avait déjà écrites sans en tirer la conclusion.

1. **Un troisième terme EST la cascade que l'ADR 0004 décision 8 a déclarée irréversible.** Ce plan
   défend les deux termes en disant que la décision refusait « *`override ?? ancestor ?? document` —
   TROIS termes, dont l'un est un champ de DOCUMENT* ». Une baseline **est** ce troisième terme, et
   **est** ce champ de document. On ne peut pas se prévaloir de la distinction pour justifier deux
   termes puis l'ignorer pour en ajouter un.
2. **Une police de compatibilité est pire qu'un A4 de compatibilité, et c'est mesuré par nature.**
   `migrate.ts` écrit déjà l'argument : A4 « est faux pour une partie du monde mais il EXISTE
   partout » ; un `family: 'Helvetica'` désigne une ressource **qui peut ne pas exister sur la
   machine de rendu**, et la résoudre est une lecture de la machine. Une valeur de compatibilité
   dont la validité dépend de l'hôte n'est pas une valeur de compatibilité.
3. **Le coût du refus est chiffré et il est payable.** Écrire « cette facture est en Helvetica 10 »
   coûte **+60 valeurs (+10,9 %)** au nœud texte contre +3 en baseline, sur un plafond dont le pire
   régime mesuré occupe **13,13 %**. C'est cher et ce n'est pas bloquant ; et le mandat produit
   qu'exigerait la branche B n'existe pas.

**Ce que la décision LAISSE ouvert, et l'ADR le nomme** : les cinq valeurs typographiques d'un run
qui n'en déclare aucune sont décidées par le **moteur** — attente n° 3 de [D16], propriétaires E1 et
V1. **Signal de réouverture, inchangé et maintenant daté :** un modèle réel qui répète la même
famille sur **plus de la moitié** de ses runs. C'est un fait observable sur un modèle livré, pas une
opinion, et il rouvre légitimement la question **avec** le mandat produit qui lui manque aujourd'hui.

---

### ⛔ n° 2 — La graisse est-elle un booléen, neuf paliers, ou une échelle continue ?

**La question.** `core.md:211` écrit « **graisse** et italique », un mot. Le contrat reconstruit
écrit `weight: z.number().int().min(100).max(900)`.

**Le motif, écrit avant la décision.** *(MESURÉ, `atk2.mjs §4`.)*

```
entiers 100..900 acceptes : 801 ; dont NON multiples de 100 : 792 (ex. 101, 102, 103, 104, 105)
graisses reellement nommees par le contrat (STANDARD_FONT_WEIGHTS) : 2 (regular=400, bold=700)
```

**801 valeurs admises, 2 nommées**, et le contrôle positif du contrat reconstruit l'assume :
`weight: 450` → **ACCEPTÉ**. Or une fonte porte un ensemble **fini et discret** de faces ; `450`
n'en désigne aucune. Honorer `450` exige donc que le moteur **choisisse** — la face la plus proche ?
celle du dessous ? une synthèse par graissage algorithmique ? — et **ce choix est une politique que
le contrat ne déclare pas**. Deux moteurs qui choisissent différemment produisent deux documents,
contre décision 7. C'est la **condition 3 de D1**, violée par un champ du contrat.

**Et l'échelle elle-même est une convention importée**, ce qui est un second argument distinct :
l'échelle 100–900 par entiers est celle de CSS `font-weight` et de l'axe OpenType `wght`, et
`regular: 400 / bold: 700` en est la sémantique. Comparaison qui tranche : `STANDARD_SHEETS_MM`
nomme des **faits ISO** (A4 = 210 × 297) que n'importe qui vérifie hors du dépôt ;
`STANDARD_FONT_WEIGHTS` nomme une **convention dont la seule autorité est CSS**. Et **MESURÉ**, la
table n'a **aucun consommateur** : aucun schéma ne la lit [`M10`].

**Les options.**

- **A *(recommandé)*** — **`bold?: boolean`.** Argument : c'est **littéralement** ce que la roadmap
  écrit — « graisse et italique » côte à côte, deux booléens symétriques ; **aucune politique à
  inventer** (toute famille a conventionnellement une face grasse) ; `STANDARD_FONT_WEIGHTS`
  disparaît avec son absence de consommateur ; et l'élargissement futur vers une échelle numérique
  est **une union élargie, donc une estampille — la classe la moins chère**.
- **B** — **l'échelle restreinte aux neuf multiples de 100.** Argument : conserve les fontes
  variables et supprime les 792 valeurs inhonorables. **MESURÉ** : ce **n'est pas** un rétrécissement
  vacuous si le lot est déjà livré, mais il **l'est tant qu'aucun document ne peut porter le
  champ** — donc **gratuit aujourd'hui, coûteux après** (patron `MAX_BANDS_PER_SIDE`,
  `page/schemas.ts:132-145`). Prix : neuf paliers dont sept ne désignent aucune face d'une fonte
  statique, donc la politique revient — atténuée, pas supprimée.
- **C** — **l'échelle continue 100–900.** Argument : c'est l'état de l'art typographique. Prix : le
  contrat doit **écrire la politique de résolution**, ce qu'il n'a pas le droit de faire (règle
  métier de rendu), ou **E6** doit l'écrire — et ce serait alors **une attente nommée dans l'ADR**,
  pas un silence.

**Coût de réouverture (A → B ou A → C) :** un champ de `Typography` change de type ; le schéma, le
type, une paire d'assertions, deux `it` de refus et un aller-retour se reprennent. **Une
estampille** est due si un document a déjà porté `bold` — mais A → B/C **avant** l'estampille du
lot est **gratuit**. ⛔ **parce que la réponse change la forme d'une forme stockée, donc le §3.**
**(B → A) :** un rétrécissement d'union stockée, donc **non vacuous** : la migration devrait
traduire chaque palier en booléen, ce qui **perd de l'information**.

---

### ⛔ n° 3 — Une table de styles nommés entre-t-elle dans C5, et est-elle un « thème réutilisable » hors v1 ?

**La question.** Le contrat retenu écrit le style **en ligne**, sur chaque nœud. Faut-il une table
de styles nommés sur le `Template`, référencée par un `styleRef` sur les nœuds ?

**Le motif, écrit avant la décision.** *(MESURÉ, `m4c-bascule.mjs`, et la mesure NE tranche pas.)*
Le point de bascule sur l'axe du **coût en forme bornée** est **`k = 2`** pour un style complet et
**`k = 5`** pour un style d'un seul champ : la table nommée gagne dès que **deux** nœuds partagent un
style, et un modèle réel dépasse ce seuil immédiatement. Rapport au pire cas : **9,5×**.

**Mais aucun régime n'approche `maxNodes`** — le pire cas mesuré est à **13,13 %** de 100 000, et le
style en ligne divise par 3,9 le nombre de lignes admissibles (1 848 → 473) là où le style nommé le
divise par 1,3. **Le coût n'est donc pas une contrainte : c'est un écart de 9,5× sur une ressource
abondante.** L'argument chiffré est **disponible** pour la table nommée, il n'est pas
**contraignant**.

**Le facteur décisif est ailleurs, et c'est un refus nouveau.** Une table nommée introduit une
**référence pendante**, donc un `superRefine` sur `TemplateSchema` — **le premier de ce fichier** —
sur le patron exact de `checkTableWiring`. Il n'ajoute **aucun code d'erreur** (`code: 'custom'`
avec un `path`), mais il ajoute :

1. **un refus à écrire, narrer et tester** — ce que C4 s'était explicitement refusé (D9 : zéro code
   nouveau, zéro site nouveau) ;
2. **la règle de coupure de C3** — ne pas parcourir l'arbre si la table elle-même est fautive,
   mesuré par C3 à **13 issues au lieu d'1** ;
3. **la question d'une sixième porte bornée** (`parseStyleTable`), par le même argument que
   `parsePageSetup` ;
4. **un choix de forme non trivial** — car **MESURÉ**, `z.record` **supprime silencieusement la clé
   `__proto__`**, y compris avec un schéma de clé qui la refuse, et ses messages sont incohérents
   (`constructor` rend « *Invalid input: expected record, received object* », un message **faux** dans
   un lot dont C8 dépend). La forme serait donc une **liste** avec un `superRefine` d'unicité
   [signalement F] ;
5. **une garde par site de résolution** — mesuré : une table `Readonly<Record<string, Style>>` rend
   chaque résolution `Style | undefined` sous `noUncheckedIndexedAccess`, et `!` est **interdit**.

**Et une lecture produit préalable, qui n'est pas écrite.** `docs/roadmap/designer.md:227` refuse en
v1 « thèmes et chartes graphiques **réutilisables** », dans une liste dont l'item voisin précise
« bibliothèque de formules réutilisables **entre modèles** ». La lecture par symétrie est
« réutilisables **entre modèles** », ce qui laisserait une table **interne à un modèle** licite —
**mais la précision n'est pas écrite** [N-10]. C'est cette lecture qu'il faut trancher d'abord.

**Les options.**

- **A *(recommandé)*** — **aucune table nommée dans C5.** Argument : le gain est de 9,5× sur une
  ressource occupée à 13 %, et le prix est un refus nouveau, une référence pendante, une garde par
  site et une lecture produit à trancher. Le besoin réel — « ne pas retaper la police quarante
  fois » — est **déjà rangé** : c'est un problème d'**éditeur**, que **D7 du designer** règle en
  pré-remplissant le widget, ce qui écrit un nœud explicite (ADR 0004 `:579-582`, transposé).
- **B** — **une table nommée, en liste, avec `superRefine` d'unicité et de référence.** Argument : le
  coût borné, la lisibilité d'un modèle (un style change en un endroit), et le précédent
  d'appariement **par clé** de C3, qui est **exactement** ce patron et qui a été validé.
- **C** — **les deux : style nommé ET surcharge locale.** Argument : c'est la forme de tous les
  systèmes de mise en page réels. Prix : **deux** sources par propriété, donc une résolution à
  N termes — c'est-à-dire la cascade que D12 refuse, plus la référence pendante.

**Coût de réouverture (A → B) :** un champ sur `Template` (donc une estampille — déjà due si c'est
avant INC-4), un `styleRef` sur chaque porteur, un `superRefine` avec son message et son `path`, sa
règle de coupure, ses tests, une garde par site de résolution, et **le premier refus nouveau du
lot** — donc D15 tombe. **Le §3 se réécrit en grande partie.** ⛔
**(A → C) :** tout ce qui précède **plus** la réécriture de D12.

---

### ✅ n° 4 — Qui déclare la largeur d'un tableau ? — **TRANCHÉ**

**La question.** `ast/types.ts:233-235`, docstring **publiée** : « ***How wide the table is is not
declared here, and lot C3 declares it nowhere.*** » Et l'ADR 0005 `:242-247` qualifie la réponse :
« un tableau occupe **toute** la largeur utile — **une règle d'apparence (C5)** appuyée sur une
géométrie de feuille (C4), et C3 ne possède ni l'une ni l'autre. » **C5 hérite donc de la question.**

**Le motif, écrit avant la décision.** La conséquence est **déjà mesurée dans le dépôt** :
`apps/playground/src/App.tsx:1203-1212` relève qu'« *un conteneur contraint rendait 24,79 / 14,10 /
19,06 / 21,59 / 20,47 % là où le modèle déclare 33,33 / 11,11 / 16,67 / 16,67 / 22,22 %* », et qu'il
a fallu `tableLayout: 'fixed'` + `width: '100%'` pour que les pourcentages soient autoritaires. Sans
largeur déclarée, **les poids entiers de C3 — dont la docstring dit qu'ils existent pour donner « le
même nombre dans l'aperçu et dans le PDF » — ne se résolvent contre rien.**

Et la ligne « largeur » est **la seule de la vérification de D1 qui passe les quatre conditions et
sorte quand même** : ce n'est pas une lecture du critère, c'est une **décision de frontière**.

**Les options — et la fourche a trois branches, pas deux.**

- **A** — **C5 écrit la règle** (« un tableau occupe toute la largeur que son parent lui donne »).
  Argument : ça résout le problème là où il se pose, et l'ADR 0005 a **déjà qualifié la phrase de
  règle d'apparence, donc de C5**. Prix : le contrat écrit une **convention de rendu**, ce que son
  propre critère devrait interdire — et il faudrait alors répondre à « la largeur du parent, moins
  quoi ? », donc au `padding` du parent, donc à un modèle de boîte complet.
- **B *(recommandé)*** — **C5 refuse la largeur et le dit.** Argument : c'est la seule branche qui ne
  demande au contrat d'écrire aucune convention, et le lot n'a **aucune** largeur ni hauteur, ce qui
  garde `printableAreaOf` comme seule géométrie du contrat. **Prix, et il est réel : cette branche
  DÉGRADE une garantie publiée de C3** — les poids restent des **suggestions** pour un moteur de
  table automatique, et aucun contrôle de V3 ne peut vérifier la décision 7 sur un tableau.
- **C** — **la question va à C11** (colonnes de mise en page et grille). Argument : c'est le lot dont
  le sujet **est** la largeur, et la conception C le retenait. Prix : **C11 est le deuxième candidat
  à la coupe du v1** (`docs/roadmap/README.md:159` : « *2. **Les calques** sortent du v1* »), donc la
  question serait déposée sur le lot le plus susceptible de disparaître — et elle **perdrait son
  propriétaire une seconde fois**.

---

#### ✅ TRANCHÉ en révision 2 — **A**, et sans un champ ; le ⛔ tombe

**La décision : « un bloc occupe la largeur de contenu de son parent », écrite dans le contrat, et
un tableau n'est pas une exception.** Aucune longueur n'est stockée : la largeur est **dérivée**. Le
modèle de boîte complet est en [D11], et le voici en une chaîne :

```
printableAreaOf(page) → − padding de chaque boîte ancêtre → × width_i / Σ width → − padding de ligne
```

**Ce qui a changé depuis la révision 1, et c'est la seule chose qui a changé.** La branche B était
recommandée sur un argument de coût : « A obligerait à écrire un modèle de boîte complet ». **La
revue a rendu ce modèle obligatoire pour une AUTRE raison** — un `padding` sur `TableRowNode` dont
personne ne savait dire ce qu'il insète —, donc **son coût est déjà payé**. Une objection dont le
prix est acquis n'est plus une objection.

**Et la branche B était intenable, ce qu'elle reconnaissait elle-même.** Elle « DÉGRADE une garantie
publiée de C3 » : les poids entiers existent pour donner « le même nombre dans l'aperçu et dans le
PDF » — décision produit 7 —, et sans largeur de référence ils ne se résolvent **contre rien**. Le
dépôt en porte la mesure : `App.tsx:1203-1212` relève 24,79 / 14,10 / 19,06 / 21,59 / 20,47 % là où
le modèle déclare 33,33 / 11,11 / 16,67 / 16,67 / 22,22 %. **Clore un lot sur ce trou, c'est livrer
une décision produit invérifiable par V3.**

**L'objection de principe, et la réponse.** Le critère de D1 refuse qu'une **déclaration** oblige un
moteur à inventer une politique ; il n'interdit pas au contrat de **prendre** une convention et de
l'écrire — c'est ce qu'il fait pour sRGB [D8], et l'ADR 0005 avait **déjà qualifié cette
phrase-ci** de « règle d'apparence (C5) ». Ce qui serait refusé, c'est une convention **implicite** :
celle-ci est écrite, tient en quatre phrases, et chacun de ses termes est une addition sur des
millimètres déclarés — **aucune mesure, aucune métrique de police**.

**Coût de réouverture (A → un champ `widthMm`) :** un champ, une borne, une paire d'assertions, deux
`it`, et une **estampille** si c'est après INC-4. La sonde 14 de [§6.4] le rend visible le jour où
quelqu'un l'écrit. **(A → C, la question à C11) :** elle n'est plus déposable — C11 hériterait d'une
question **déjà répondue**, et le risque nommé (C11 est le 2ᵈ candidat à la coupe du v1) disparaît
avec elle.

---

### ✅ n° 5 — Une image peut-elle déclarer sa taille ? — **TRANCHÉ**

**La question.** `ImageNode = { type, id, src, alt? }`. Le contrat retenu lui donne un `box`
(fond, filet, `padding`) et **aucune dimension**. Or une image sans taille est, en pratique,
inutilisable dans une facture : un logo qui occupe la largeur du papier est un défaut, pas une mise
en page.

**Le motif, écrit avant la décision.** *(Raisonné.)* Une dimension d'image est du
**dimensionnement**, donc du positionnement, et `docs/roadmap/README.md:135` range le
**positionnement libre au millimètre** hors périmètre v1. Mais `README.md:135` parle de **placer un
bloc à une coordonnée**, pas de **dimensionner un contenu** : ce n'est pas le même fait, et le
plan ne peut pas s'abriter derrière une citation qui ne dit pas ce qu'il lui fait dire. Deux
longueurs sur une image passent d'ailleurs les quatre conditions de D1 exactement comme une
largeur de tableau [n° 4] — c'est **la même décision de frontière, à un second site**.

**Les options.**

- **A *(recommandé)*** — **aucune dimension d'image dans C5.** Argument : la cohérence avec n° 4 —
  le lot ne déclare **aucune** largeur ni hauteur, nulle part —, et le contournement existe : une
  image dans un conteneur dont la largeur est celle du flux. Prix : un logo n'est pas dimensionnable,
  et **c'est visible dès la première facture**.
- **B** — **`ImageNode.widthMm?` et `heightMm?`, les deux optionnelles.** Argument : c'est le besoin
  le plus banal qui existe, et deux longueurs déclarées ne sont pas un positionnement. Prix : il faut
  alors dire ce qui se passe **quand une seule des deux est déclarée** (ratio préservé ? c'est une
  **politique**, condition 3) et **quand aucune ne l'est**.
- **C** — **une seule longueur, `widthMm?`, et le ratio est celui de l'image.** Argument : une seule
  politique, la plus attendue. Prix : le ratio d'une image est une **propriété de la ressource**,
  donc une **mesure** — condition 3, et c'est l'argument qui tue cette branche.

---

#### ✅ TRANCHÉ en révision 2 — **A**, et le contournement est devenu EXACT ; le ⛔ tombe

**La décision : aucune dimension d'image dans C5.** Ce qui la rend tenable aujourd'hui alors qu'elle
ne l'était pas hier, c'est n° 4 : le contournement n'est plus « une image dans un conteneur »,
formule vague, mais **une largeur au millimètre**. Une image occupe la largeur de contenu de son
parent [D11] ; un `ContainerNode` dont le `padding.left` et le `padding.right` valent chacun 60 mm
sur une largeur imprimable de 160 mm donne un logo de **40 mm**, calculé et non approché. Le prix que
la révision 1 écrivait — « un logo n'est pas dimensionnable, et c'est visible dès la première
facture » — **n'est plus le bon prix** : il l'est, par le seul mécanisme que le lot a déjà.

**Ce qui reste réellement refusé, et le motif est celui-ci et pas un autre :** la **hauteur**. Elle
suit le ratio intrinsèque de la ressource, ce ratio est une **mesure de la ressource**, et c'est ce
qui tue les trois branches — `widthMm` seule en a besoin (branche C, le plan le disait déjà), et
`widthMm` + `heightMm` obligerait en plus à écrire une convention d'ajustement (étirer ? contenir ?
recadrer ?) que le contrat n'a aucune raison de trancher pour un moteur.

**Et le plan cesse de s'abriter derrière une citation qui ne dit pas ce qu'il lui faisait dire.**
`README.md:135` range le **positionnement libre au millimètre** hors v1, c'est-à-dire *placer un bloc
à une coordonnée* — pas *dimensionner un contenu*. Le motif retenu est la **condition 3**, et rien
d'autre.

**Ce qui part en attente moteur, parce que le refus a une contrepartie honnête :** la place effective
d'une image sans dimension déclarée — attente n° 8 de [D16], propriétaire E1, avec E8 pour la
ressource elle-même.

**Coût de réouverture (A → B) :** deux champs sur `ImageNode`, deux bornes, une paire d'assertions,
deux `it`, deux allers-retours, **une convention d'ajustement à écrire**, et une **estampille** si
c'est après INC-4. La sonde 14 de [§6.4] épingle l'absence des deux noms.
*Signal de réouverture :* un modèle livré où la largeur de contenu du parent ne suffit pas — deux
logos côte à côte de tailles différentes, typiquement. C'est le fait observable, et il se voit sur un
modèle, pas dans un plan.

---

### n° 6 — `margin` entre-t-il, et si oui, deux marges adjacentes s'additionnent-elles ?

**La question.** `core.md:211-212` écrit « **espacements** », au pluriel et sans qualificatif. Le
contrat retenu porte `padding` seul [D11].

**Le motif, écrit avant la décision.** *(Raisonné.)* `padding` est **à l'intérieur** de la boîte :
pas d'adjacence, pas de fusion, aucune convention à écrire. `margin` est **à l'extérieur**, et deux
marges adjacentes **s'additionnent ou fusionnent** — CSS fusionne, plusieurs moteurs additionnent.
**Choisir est une politique de rendu**, condition 3 de D1. Le contrat *pourrait* **prendre** la
convention, comme il prend sRGB en D8 — mais ce serait un **troisième** espacement qui s'additionne
aux deux autres, et l'ADR devrait écrire la somme. Le coût du refus est chiffré : un **rythme
vertical non uniforme** se paie en **un `ContainerNode` par valeur d'air**, comptés par
`assertBoundedShape`.

**Les options.**

- **A *(recommandé)*** — **pas de `margin`.** Argument : aucune convention de rendu à écrire, et
  l'air entre frères s'obtient par un `padding` sur le conteneur parent, **visible dans le nœud
  qu'un relecteur regarde**. Prix : des conteneurs d'espacement, comptés.
- **B** — **`margin` entre, avec « les marges s'additionnent, elles ne fusionnent jamais » écrit
  comme attente envers le moteur dans l'ADR** [D16]. Argument : c'est la forme que tout auteur
  attend, et une convention **prise** vaut mieux qu'une convention **inventée par chaque moteur** —
  exactement le raisonnement de sRGB. Prix : un quatrième quadruplet d'arêtes (+4 champs, +1 forme
  ou un partage de `BoxSpacing`), et une somme à écrire dans l'ADR.

**Coût de réouverture (A → B) :** un champ sur `BoxStyle` (réutilisant `BoxSpacing`, donc **zéro
type neuf**), une paire d'assertions, quatre allers-retours, deux `it`, et **un paragraphe d'attente
moteur**. Une estampille si c'est après INC-4. **Pas de ⛔** : la forme du contrat ne change pas, un
champ s'ajoute.

---

### n° 7 — C5 revendique-t-il le fond perdu (`bleed`) et la gouttière (`gutter`) ?

**La question.** `packages/core/src/page/__tests__/page.test.ts:43-44`, dans `main` : « *The likeliest
drift site is `Sheet` or `PageMargins`: **lot C5 has a bleed and a gutter in its declared future**,
and both are optional by nature.* »

**Le motif, écrit avant la décision.** *(MESURÉ par lecture : `git grep -niE 'bleed|gutter|fond
perdu|petit fond|reliure'` rend 20 lignes, dont **une seule** attribue quoi que ce soit à C5.)*
**Quatre textes contredisent cette phrase :** (1) l'ADR 0006 D13 range la marge de reliure et le
fond perdu dans « *ce n'est pas un refus de conception, c'est un **silence** que ce lot décide de ne
pas rompre* » — un silence n'est pas un avenir déclaré, et il n'est attribué à **personne** ;
(2) `:311` les dit « refusé en D13 » ; (3) le critère mécanique de `c4 §6.4` grep **nommément**
`bleed|gutter` pour vérifier qu'aucun tel champ n'est entré ; (4) `core.md:211-212` ne les nomme
pas. Et le besoin est **déjà couvert sans champ** : `page/types.ts:27-28`, « *Zero is legal -- a
**full-bleed** label, or a template that manages its own **gutter*** ».

**C'est aussi une question de périmètre, pas seulement de docstring** : les deux champs vivraient sur
`Sheet` et `PageMargins`, c'est-à-dire dans **`page/`** — un dossier que le contrat retenu ne touche
pas.

**Les options.**

- **A *(recommandé)*** — **C5 les décline, et corrige la docstring.** Argument : un lot ne rompt pas
  un silence qu'il n'a pas ouvert, et l'ADR fait foi contre un commentaire de test. Prix : la
  question **retourne à personne**, et il faut le dire [signalement].
- **B** — **C5 les prend**, deux champs optionnels sur `Sheet` et `PageMargins`. Argument : la
  docstring de `main` fait promesse, et le fond perdu est un besoin réel d'impression. Prix : C5
  touche `page/`, donc `page/types.ts`, `page/schemas.ts`, les quatre paires `*_KEYS_IN_STEP` de C4,
  `Object.keys(parsed)` de `page.test.ts:194`, l'aller-retour JSON de `:177` — **et il contredit une
  décision d'ADR acceptée**, ce qui demande de la réviser, pas de l'ignorer.

**Coût de réouverture (A → B) :** deux champs dans `page/`, quatre tests de clés à reprendre, une
révision de l'ADR 0006 D13, **et le retrait du critère mécanique `bleed|gutter` de la définition de
fini de C4**. **Pas de ⛔ pour le contrat de style** — mais un ⛔ pour `page/`, qui est hors du
périmètre annoncé du lot.

---

### ✅ n° 8 — `justify` : refusé par écrit, ou admis ? — **TRANCHÉ**

**La question.** `ast/types.ts:159-160`, docstring **publiée dans `main`** : « *Three members and no
`justify`: justification stretches inter-word space, which is typography, and typography is lot
C5.* » Répétée dans l'ADR 0005 `:263`. **MESURÉ** : `git grep -n "justify"` hors plans rend **deux**
sites, et **aucun** ne le refuse.

**Le motif, écrit avant la décision.** Le dépôt fournit lui-même le motif du refus, et il est
excellent : justifier exige de **répartir l'espace inter-mot**, donc de **mesurer la longueur des
mots**, donc une **métrique de police**, donc une **lecture de la machine** — refusée et outillée
(ADR 0006 `:648-650`, `ast/types.ts:242-244`). C'est la condition 3 de D1, et elle est la même qui
tue l'interligne et le dimensionnement `auto`.

**Et le coût de l'autre branche est mesuré.** Ajouter `justify` au tuple existant serait la
**troisième forme d'incompatibilité** — `invalid_value`, `Invalid option: expected one of
"start"|"center"|"end"`, chemin `["root","children",0,"columns",0,"align"]`, mesuré (`m2.mjs`) —,
une forme qu'`AGENTS.md` §1.2 **ne nomme pas** [signalement A]. Elle est *plus* lisible que le refus
illisible et reste sans erreur typée, sans mention de version, sans remède. Le refus est **gratuit
aujourd'hui** ; l'admission coûte l'estampille **et** l'inscription de la troisième forme. Et
**MESURÉ** : le dépôt refuse déjà `align: 'justify'` sur un `TableColumn` **à la compilation**
(`TS2322`, `campagne de mesure §3.2`), pas seulement à l'exécution.

**Les options.**

- **A *(recommandé)*** — **refusé, et `ast/types.ts:159-160` est corrigé** [D5, D17]. Argument : le
  motif est celui du dépôt, la métrique est refusée et outillée, et le refus coûte **deux
  corrections de texte** (mesuré : deux sites). Prix : la justification des mentions légales, qui est
  la mise en page de la plupart des factures européennes, devient inexprimable.
- **B** — **`'justify'` ajouté à `TABLE_COLUMN_ALIGNMENTS`.** Argument : la docstring de `main` fait
  promesse, et un moteur *peut* justifier — c'est lui qui a les métriques, pas le contrat. Prix : la
  **troisième forme d'incompatibilité**, à nommer avec son message mesuré, plus un signalement à
  `AGENTS.md` §1.2 (incomplet) — sans amendement.
- **C** — **`'justify'` dans un second tuple, propre à `TextNode.align`.** Argument : évite la
  troisième forme (le champ est **neuf**, donc c'est une perte silencieuse ordinaire). Prix : deux
  tuples aux membres **presque** identiques — « a second spelling of one fact » —, et
  `text.align ?? column.align` cesse de compiler sans élargissement (mesuré : les tuples actuels sont
  **mutuellement assignables**, sonde `W1`).

---

#### ✅ TRANCHÉ en révision 2 — **C**, et le ⛔ tombe

**La décision : `justify` entre, sur `TEXT_ALIGNMENTS`, un tuple propre au texte, dérivé de
`TABLE_COLUMN_ALIGNMENTS` par *spread*.** `TABLE_COLUMN_ALIGNMENTS` n'est **ni élargi ni touché**.

**Le motif du refus, ci-dessus, ne tient pas — et il fallait le dire.** « Mesurer les mots, donc une
métrique de police, donc une lecture de la machine » **prouve trop** : `center` et `end` sont des
membres **publiés dans `main`**, et centrer une ligne exige d'en connaître la largeur composée,
exactement comme justifier. Un critère qui refuserait `justify` sur ce motif refuserait aussi les
deux membres que le dépôt livre déjà. Ce que le lot E6 interdit, c'est de lire l'**environnement** ;
`engine.md` promet au contraire le déterminisme « au caractère près : **polices**, images », ce qui
**suppose** la mesure d'une fonte explicitement chargée plutôt que de l'interdire. Le motif corrigé
est en [D1], « la condition 3 a deux moitiés ».

**Ce que `justify` coûte réellement, et le contrat le paie.** Deux **conventions**, prises comme sRGB
est pris [D8], écrites dans l'ADR 0007 et dans aucune docstring [D16, attente n° 7] : la **dernière
ligne** d'un paragraphe justifié s'aligne sur `start` ; le résidu se répartit uniformément entre les
blancs **inter-mot**, jamais entre les lettres. Ce sont les conventions universelles de la
composition, pas un arbitrage entre deux rendus également légitimes.

**Et le prix que la branche C affichait a DISPARU, pour une raison qui n'est pas un accommodement.**
Il était double : « deux tuples aux membres presque identiques — a second spelling of one fact » et
« `text.align ?? column.align` cesse de compiler sans élargissement ».
- Le premier est **faux**, et c'est le blocage n° 1 de la revue : ce ne sont pas deux orthographes
  d'un fait, ce sont **deux faits** [D5]. Un tuple est un domaine de valeurs, pas un fait.
- Le second est **évité par construction** : `TEXT_ALIGNMENTS` est **dérivé** de
  `TABLE_COLUMN_ALIGNMENTS`, donc celui-ci en est un sous-type **strict et structurel**, et
  `text ?? column` compile sans élargissement ni assertion. La dérivation coûte une ligne.

**La branche C est donc la seule des trois qui n'ouvre aucune forme d'incompatibilité.** La B serait
la **troisième forme** — `invalid_value` sur un tuple élargi, message mesuré, qu'`AGENTS.md` §1.2 ne
nomme pas [signalement A]. La C porte sur un **champ neuf**, donc sur la perte silencieuse
ordinaire, que l'estampille de [D14] couvre déjà.

**Coût de réouverture (C → A, le refus) :** retirer un membre d'un tuple **après** qu'un document
l'a stocké est un **rétrécissement non vacuous** — c'est-à-dire impossible sans corrompre le
document. La décision est donc **irréversible dans ce sens**, et c'est assumé : la justification des
mentions légales est la mise en page de la plupart des factures européennes, et le dépôt l'avait
annoncée. **(C → B, élargir la colonne) :** un membre de tuple, la troisième forme à nommer, et un
`justify` de colonne qui n'aurait de sens que pour les cellules contenant du texte — c'est-à-dire la
confusion que [D5] vient de fermer. Épinglé par la sonde 9 de [§6.4] et par le refus `N29`.

---

### n° 9 — L'alignement vertical dans une cellule ou une bande : refusé, ou admis ?

**La question.** Le contrat retenu porte un alignement **horizontal** sur `TextNode` seul [D5]. Un
alignement **vertical** (« le montant en bas de la cellule ») n'est nulle part.

**Le motif, écrit avant la décision.** *(Raisonné.)* Un alignement vertical n'a de sens que **dans
une hauteur imposée** : dans une cellule dont la hauteur est celle de la ligne la plus haute, dans
une bande dont la hauteur est réservée. **Le contrat ne déclare aucune hauteur** — ni de bande (ADR
0006 D8 : « aucun nœud du contrat ne porte de **dimension** »), ni de ligne, ni de bloc [n° 5].
Un `verticalAlign` échoue donc la **condition 4** : sa valeur n'a de sens sur **aucun** porteur que
le contrat autorise. Et il échouerait la **condition 3** sur une cellule, parce que la hauteur de
ligne est **mesurée** sur le contenu.

**Les options.**

- **A *(recommandé)*** — **refusé, en famille 1 de D18**, avec le motif de la hauteur absente.
  Argument : il n'y a **aucun porteur** où il ait un sens, et l'admettre créerait la première
  propriété du contrat dont la valeur dépend d'une mesure. Prix : « le montant aligné en bas de la
  cellule » est inexprimable, et c'est un besoin réel de tableau comptable.
- **B** — **admis sur `TableCell`, avec un tuple `['start','center','end']`.** Argument : c'est le
  seul site du contrat qui a une hauteur **implicite** (celle de sa ligne). Prix : la hauteur est
  **mesurée**, donc condition 3 ; et une cellule n'est pas un nœud, donc une Command d'éditeur ne
  l'adresse pas [D5, écarté (b)].

**Coût de réouverture (A → B) :** un champ sur `TableCell`, un tuple, deux exports, une paire
d'assertions (`TABLE_CELL_KEYS_IN_STEP` **existe déjà et rougirait**, ce qui est un bon point), et
une attente moteur sur la hauteur de ligne. Une estampille si c'est après INC-4. **Pas de ⛔** : un
champ s'ajoute, la forme ne change pas.

---

### Récapitulatif des neuf arbitrages

| # | Question | ⛔ | Décision / recommandation | Ce que l'autre branche réécrit |
| :-- | :--- | :-: | :--- | :--- |
| 1 | Le troisième terme de la résolution typographique | ✅ | **A** — deux termes, **clos** | `migrate.ts` devient transformant, 28 tests, un mandat produit |
| 2 | La graisse : booléen, neuf paliers, échelle continue | ⛔ | **A** — `bold?: boolean` | un champ de forme stockée, gratuit **avant** l'estampille |
| 3 | La table de styles nommés | ⛔ | **A** — aucune | un `superRefine`, un refus nouveau, D15 tombe |
| 4 | La largeur d'un tableau | ✅ | **A** — **sémantique déclarée, aucun champ** | un champ `widthMm`, plus l'estampille après INC-4 |
| 5 | La taille d'une image | ✅ | **A** — aucune dimension, **contournement exact** | deux champs, plus une convention d'ajustement |
| 6 | `margin` | — | **A** — non | un champ, une attente moteur sur la somme |
| 7 | `bleed` / `gutter` | — (⛔ pour `page/`) | **A** — déclinés, docstring corrigée | C5 touche `page/`, révision de l'ADR 0006 D13 |
| 8 | `justify` | ✅ | **C** — **admis sur `TEXT_ALIGNMENTS`** | le refus, et la justification inexprimable |
| 9 | L'alignement vertical | — | **A** — refusé | un champ sur `TableCell` + une attente sur la hauteur |

**Deux ⛔ sur neuf**, après que la révision 2 en a tranché quatre. C'est **moins** que C4 (deux sur
sept, mais sur un lot plus petit), et les deux qui restent sont exactement ceux que la revue **n'a
pas** contestés — la forme de la graisse et la table de styles nommés. **Deux arbitrages bloquants
signifient que le [§3] est écrit sous réserve** sur ces deux points, et sur eux seuls.

> **Pourquoi quatre arbitrages ont été tranchés ICI plutôt que remontés.** Un arbitrage se remonte
> quand la réponse relève du **produit** — c'est le cas des n° 2 et 3, qui engagent une forme stockée
> pour un besoin dont personne n'a mesuré la fréquence. Les quatre autres n'étaient pas dans ce cas :
> la revue a montré que **n° 4 laissait une garantie publiée de C3 sans référence**, que **n° 8
> reposait sur un raisonnement qui prouve trop**, que **n° 1 se contredisait avec sa propre défense
> des deux termes**, et que **n° 5 s'abritait derrière une citation qui ne dit pas ce qu'on lui
> faisait dire**. Un lot ne se clôt pas sur ces quatre trous, et remonter une question dont on a
> soi-même l'argument n'est pas de la prudence.

### Les quatorze signalements, qui ne sont pas des arbitrages

> **Un signalement est un fait que le lot met au jour et qu'il n'a PAS à trancher** : une
> contradiction du dépôt, une docstring publiée qui contredit le plan, un critère mécanique devenu
> ambigu, un besoin sans propriétaire. Sa destination est **l'ADR 0007**, jamais le plan, qui est
> périssable. Citables sous la forme `[§8, signalement H]`.

| # | Ce que le lot a mis au jour | Ce qu'il faut en faire |
| :-- | :--- | :--- |
| **A** | `AGENTS.md` §1.2 ne nomme que **deux** formes d'incompatibilité ; il en existe une **troisième**, mesurée : `invalid_value` sur un `z.enum` **élargi**, message qui énumère les options légales, sans erreur typée ni mention de version | La **nommer dans l'ADR 0007** avec son message mesuré. **Aucun amendement d'`AGENTS.md`** — un plan ne s'auto-délivre pas de dérogation, et le véhicule est une ADR **sous mandat** |
| **B** | La fusion de C4 a inséré **31 lignes** dans `docs/roadmap/core.md` : **toutes** les citations `core.md:≥175` écrites avant C4 sont fausses, dans **cinq documents dont deux ADR qui font foi** | Recompter **toutes** les citations du plan C5 ; **ne recopier aucune citation de plan antérieur sans la revérifier** ; signaler la **classe entière** plutôt que corriger des documents périmés |
| **C** | `docs/plans/c4-la-page.md` cite « `RECIPE_TEMPLATE` = 18 niveaux / **231** valeurs » à quatre endroits, dont un « contrôle de calibrage ». À HEAD la fixture pèse **242** ; 231 est le compte **sans sa page** | Citer **242 / 18** (et **313 / 18** combinée à `RECIPE_PAGE`). Le plan C4 est périmé : **ne pas le réécrire** |
| **D** | La **sonde RTL** de l'ADR 0005 D7, dans sa forme canonique et **scopée**, rend **10 occurrences hors plans** — dont `ast/types.ts:147`, dans le code de production. Son pathspec exclut `docs/plans/*` mais **pas** `docs/adr/*` | **Ne pas recopier la sonde.** L'énoncé du brief (« aucune occurrence hors plans ») est **faux comme écrit**. Le fond tient : aucun de ces sites ne **déclare** une direction |
| **E** | `'literal'` est membre de **deux** unions — `TextSegment` (charge `text`) et l'algèbre d'expressions (charge `value`). Le modèle du playground porte **41** segments, pas 48 | Une ligne dans l'ADR : `visitSegment` est sain, mais **tout code qui dispatche sur `kind` seul** confond les deux — un compteur, un rapport d'éditeur, un futur parcours |
| **F** | **`z.record` supprime silencieusement la clé `__proto__`**, y compris avec un schéma de clé qui la refuse (mesuré) ; et ses messages sont incohérents — `constructor` rend « *Invalid input: expected record, received object* », **un message faux** | Si un lot ultérieur retient une table nommée [⛔ n° 3], la forme est une **liste** avec un `superRefine` d'unicité, **jamais un `z.record`** |
| **G** | `TemplateMigrationError` ne porte **ni `code` ni `to`** : son seul champ propre est `fromVersion` (`errors.ts:196-207`) | À nommer pour **C8**, qui construit le catalogue des messages. Un `expect(err.code)` ou `expect(err.to)` **échoue** |
| **H** | **`Template` ne peut pas avoir de paire `*_KEYS_IN_STEP`** : son type **est** inféré de son schéma, donc l'assertion serait tautologique. C'est le neuvième site aveugle de la matrice, et il est **structurellement** ingardable | Le seul filet est un **aller-retour JSON sur un littéral qui porte un style à chacun des neuf sites** [§3.14]. À écrire dans l'ADR comme une limite du patron, pas comme un oubli |
| **I** | Deux actions ouvertes de l'ADR 0006 restent **non exécutées** (mesuré) : le **saut de page explicite** (signalement D) et le **porteur du filigrane** si les calques sortent du v1 (signalement E) n'ont **aucun propriétaire** | C5 **ne les ramasse pas** — ce ne sont ni de l'apparence de bloc ni de la typographie. Les **re-consigner** dans l'ADR 0007, troisième fois |
| **J** | La **direction d'écriture** (N-6) est héritée à un **second site** : C3 l'avait consignée pour l'alignement de **colonne** ; C5 la duplique sur `TextNode.align` (`start`/`end` sans résolution) | La **re-consigner**. Une question ouverte qui se propage sans être re-consignée finit par se perdre. L'interdit qui tient déjà : **aucun moteur ne dérive cette direction de la machine** (E6) |
| **K** | Le test C2/C6 de l'ADR 0004 D10 — « *si une déclaration ne peut changer que ce qu'un lecteur voit, elle est C6* » — range **tout C5 en C6** s'il est pris pour un test général | Écrire ce qui sépare réellement C5 de C6 : **C6 change les caractères** qu'un lecteur lit, **C5 ne change que la forme de caractères déjà décidés**. C'est la condition 1 de [D1] |
| **L** | La **couleur du papier** est attribuée **deux fois** dans la même ADR 0006 : `:119` à **C5** (dans un motif d'écart), `:938-940` à **C11/D10** (dans une **décision**), à 820 lignes d'intervalle | C5 retient la **seconde** — elle est dans une décision — **et le dit**, parce que la première porte son nom et qu'un lecteur de bonne foi l'opposera |
| **M** | « visuellement identiques **au pixel près** » (`docs/qa/README.md:15`) contre « *What it does NOT promise: identity at the PIXEL* » (`page/area.ts:29-32`), et « identique » sans « pixel » dans la décision 7 | C5 introduit des longueurs **fractionnaires** (taille, épaisseur, espacement) : c'est le texte QA — le plus exigeant des trois — qui sera opposé au premier écart. À nommer, avec le signal de réouverture que l'ADR 0006 `:255` a déjà écrit pour l'unité EMU |
| **N** | Le contrat porte **zéro invariant croisé**, là où C4 en portait deux. **La surface de refus de C5 est strictement plus faible que celle de C4** | Le dire franchement : ce n'est pas une vertu, c'est une conséquence du refus de cascade. Un contrat tout-optionnel n'a presque rien à refuser — et c'est la **faiblesse structurelle du lot** |

---

## 9. Ce que ce plan tient pour acquis

Neuf hypothèses. Chacune porte ce qui la **mesure** (ou l'absence de mesure), **ce qui repose
dessus**, et **ce qui se passe si elle tombe**. Une hypothèse dont la chute ne coûte rien n'a pas sa
place ici ; les neuf coûtent quelque chose.

**1. `.optional()` de zod 4 infère `champ?: T | undefined`.**
*Mesuré* — et c'est une **bonne** surprise qu'il fallait vérifier : la friction attendue à la
frontière `types.ts` / `schemas.ts` sous `exactOptionalPropertyTypes`, que `AGENTS.md` §1.4 annonce,
**ne se produit pas**. Le type écrit à la main (`readonly family?: string | undefined`) et le type
inféré du schéma sont mutuellement assignables.
*Ce qui repose dessus :* les douze champs optionnels du contrat, donc tout [§3.1] et [§3.3], et les
dix assertions de [§3.11].
*Si elle tombe* — une montée de zod change l'inférence : les dix assertions rougissent **d'un coup**,
ce qui est le bon comportement. **À rejouer à chaque montée de zod**, comme la sonde de l'ADR 0003.

**2. Un schéma non annoté garde l'inférence de son objet.**
*Mesuré*, et dans les deux sens : l'annotation `z.ZodType<T>` **détruit** la porte de type — un
schéma amputé d'un champ compile à **exit 0** sous l'annotation, et rougit sans elle.
*Ce qui repose dessus :* la consigne « aucune annotation dans `style/schemas.ts` », qui est une
docstring de tête de fichier [§3.3], et la sonde 6 de [§6.4].
*Si elle tombe* — quelqu'un annote « pour être cohérent avec `ast/schemas.ts` : le lot perd sa seule
garde de compilation, silencieusement. La docstring existe pour rendre ce geste discutable.

**3. `MutuallyAssignable` sur `keyof` voit un champ optionnel ajouté d'un seul côté.**
*Mesuré* — c'est la **seule** garde de compilation du lot, et elle a une **aveuglité connue** : elle
ne voit pas l'**amputation** d'un optionnel dans certaines configurations, ce qui est précisément
pourquoi INC-0 ajoute aussi des allers-retours **à l'exécution** plutôt que de s'en remettre au type.
*Ce qui repose dessus :* les huit paires d'INC-0, donc le critère de sortie de l'incrément 0.
*Si elle tombe* — le lot revient à l'état mesuré de HEAD : **591 tests verts avec quatre schémas
divergents**. C'est le défaut que le lot existe pour fermer.

**4. Les mesures du bac à sable transposent au dépôt.**
*Validé par contrôle négatif*, ce qui est plus fort qu'affirmé : le harnais rougit quand il doit
(`TS2322` sur `align: 'justify'` d'un `TableColumn`), et rend exit 0 sans la sonde. Trois contrôles
négatifs distincts sont documentés en [§3].
*Ce qui repose dessus :* absolument tous les chiffres du plan.
*Si elle tombe* — le bac à sable diverge du dépôt (une option de `tsconfig` mal reprise, une jonction
qui copie au lieu de lier) : **tous** les chiffres deviennent indicatifs. ⚠️ **Ce piège s'est
réellement produit** : le premier montage a rendu **55 faux `TS7006`** parce que `ln -s` de Git Bash
**copiait** `zod` et `vitest` au lieu de les lier. La correction est `mklink /J`, et c'est le piège le
plus coûteux du protocole — un exit 1 qui n'a rien à voir avec le contrat, sur 19 fichiers de test
qu'on est tenté de « corriger ».

**5. `5080 * 72 / 25.4 === 14400` et `14400 * 25.4 / 72 === 5080` en binary64.**
*Mesuré dans les deux sens*, et **un `it` l'épingle** [§5.1].
*Ce qui repose dessus :* `MAX_FONT_SIZE_PT` **dérivé** de `MAX_SHEET_MM` au lieu d'être recopié [D7],
donc la non-duplication de la borne.
*Si elle tombe* — elle ne peut pas tomber (l'arithmétique binary64 est déterministe), mais **la
dérivation peut être défaite** par quelqu'un qui trouverait `14400` plus lisible en dur. L'`it` est
là pour que ce geste rougisse.

**6. Pré-v1.0, aucun template client n'est en stockage.**
*Non mesurable* — c'est un fait de contexte produit, pas une propriété du code.
*Ce qui repose dessus :* rien de ce lot, et c'est le point important. **Cette hypothèse ne porte PAS
le versionnement**, qui n'a aucune dérogation : `AGENTS.md` §1.2 est explicite, la dérogation pré-v1.0
porte sur les **rétrécissements**, jamais sur l'estampille. Le lot estampille **parce que la perte
silencieuse est mesurée** — 124 valeurs sur 189 effacées sans erreur —, pas parce qu'il existerait ou
non des documents en base.
*Si elle tombe* — un client a déjà des modèles : rien ne change pour ce lot, puisque sa migration est
une estampille et qu'elle ne transforme rien.

**7. `packages/engine` est vide.**
*Mesuré* — six lignes, et `packages/viewer` six aussi.
*Ce qui repose dessus :* l'absence de tout chiffre de budget de rendu dans ce plan, et le fait que les
huit attentes envers le moteur soient des **attentes** et non des contraintes vérifiées.
*Si elle tombe* — un moteur apparaît avant l'exécution de C5 : les huit attentes de [D16] deviennent
vérifiables, et deux d'entre elles pourraient exiger un champ que ce lot n'a pas.

**8. La porte 1 (`biome check`) n'a été jouée nulle part.**
*Non mesuré, et assumé comme tel* — elle écrit son cache, ce que l'interdiction d'écrire dans le dépôt
couvre.
*Ce qui repose dessus :* l'affirmation que le contrat respecte les interdits. **Ce qui est réellement
affirmé, et rien de plus :** le code de [§3] n'emploie aucune des cinq écritures interdites (`any`,
`!`, `as unknown as`, `@ts-*`, `catch` vide) et ne lit ni `Date`, ni `Intl`, ni `process`, ni
`Math.random`, ni `globalThis`, ni un `toLocale*`. C'est une **lecture**, pas une mesure.
*Si elle tombe* — la porte 1 rougit à l'exécution sur un détail de style Biome. Coût réel : faible,
mais il n'est pas nul, et il est honnête de dire qu'il n'a pas été payé.

**9. `apps/*` est hors du glob de Vitest.**
*Mesuré* — aucune porte ne relit `App.tsx`.
*Ce qui repose dessus :* le fait que la démonstration du critère de recette [§6.3] soit une **revue
humaine**, et que le geste le plus lourd du lot (le rendu au segment, INC-6) soit **le moins gardé**.
*Si elle tombe* — quelqu'un ajoute `apps/*` au glob : le playground devient testable, ce qui serait
une amélioration, mais **le seuil de couverture de 90 % s'appliquerait alors à 1 724 lignes de
vitrine**. Ce n'est pas une décision de ce lot.

---

**Deux hypothèses supplémentaires que le plan ne tient PAS pour acquises, et qu'il vaut mieux nommer
que taire :**

- **Que les onze corrections imposées par la relecture adverse soient elles-mêmes correctes.** Les
  attaques ont relu le contrat **avant** ces corrections ; elles n'ont pas relu la forme finale du
  [§3]. C'est la limite de méthode annoncée en tête de ce document, et c'est le point faible connu de
  ce plan.
- **Que `noJsRestrictedProperties` existe encore à l'exécution.** C'est une règle **nursery** de
  Biome, hors versionnement sémantique : une montée peut la renommer ou la retirer **en silence**.
  `AGENTS.md` prévoit la sonde jetable et le repli — rapatrier ses entrées dans le plugin du dépôt —
  et ce lot n'y change rien, mais il en dépend comme tous les autres.
