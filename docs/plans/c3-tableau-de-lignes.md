# Plan d'implémentation — `@openview/core` lot C3 : le tableau de lignes

> **Document d'implémentation.** Il dit *comment* livrer un lot : découpage, fichiers touchés,
> contrat définitif, tests, ordre des commits. Il ne dit ni *quoi* ni *pourquoi* — cela vit dans
> `docs/roadmap/` — ni les *décisions* structurantes, qui se consignent dans `docs/adr/`. Il est
> **périssable** : une fois le lot livré, il ne fait plus foi, et c'est l'ADR 0005 qui reste.
>
> **Statut :** ⏸ **EN ATTENTE D'ARBITRAGE.** Sept arbitrages sont ouverts [§8], **tous les sept
> gatent INC-1**, et **trois sont marqués ⛔ parce que leur option non recommandée réécrit du
> contrat déjà rédigé** :
>
> - **n° 1 — « typé ».** Si le mot, dans le critère de recette « un tableau à cinq colonnes **typé**
>   (désignation, quantité, prix unitaire, remise, montant) » (`docs/roadmap/core.md:157-159`), veut
>   dire « chaque colonne porte un type de donnée » plutôt que « décrit dans un contrat typé », alors
>   le contrat de la [§3] est **à rejouer, pas à amender** : un type de colonne appelle une échelle
>   et un symbole, donc un arrondi implicite, donc il préempte par la porte de service la question
>   que C2 a explicitement laissée ouverte — qui déclare l'échelle d'**affichage** d'un montant.
>   **C'est le seul qui puisse renvoyer le lot entier à sa table de travail.**
> - **n° 3 — blocs ou segments dans une cellule.** L'option « segments » ne change pas un type : elle
>   réécrit `TableCell`, la branche `tableRow` de `childrenOf`, **toutes** les mesures de profondeur
>   du lot, l'argument « zéro position de contenu nouvelle pour C6 » de D4, la fixture de recette et
>   le décompte de nœuds. C'est **la moitié de la [§3]**.
> - **n° 7 — le mandat de gouvernance.** Son option B inverse un couplage entre `ast/schemas.ts` et
>   `ast/visitor.ts` ; son option C ajoute un commit `chore(governance)` et un mandat daté au
>   découpage de la [§4]. Il déplace du travail, il ne le refait pas.
>
> **INC-0 peut démarrer sans aucun des sept** : c'est un refactor pur, sans changement de surface
> publique, et il est juste quelle que soit la lecture retenue [§4, INC-0]. **INC-1 ne le peut pas.**
>
> **Date :** 2026-08-16 · **Brique :** `@openview/core`, vague 1 · **Jalon visé :** J1
>
> **Seconde passe de vérification, 2026-08-16 (rejeu indépendant).** Les mesures porteuses du plan
> ont été **rejouées** contre le dépôt et contre le `zod@3.25.76` installé, et non relues : le
> `superRefine` qui laisse un `ZodObject` et reste membre d'une union discriminée `lazy` comprise ;
> l'asymétrie abandonnante/continuable et son **1 issue contre 13** ; les cinq entrées de largeur
> pour **quatre** messages, aux chaînes exactes ; le message d'énumération
> `Invalid option: expected one of "start"|"center"|"end"` ; le `RangeError` de 2 000 `container` ;
> les deux issues d'un `columnId` vide sur un même chemin ; et les critères mécaniques de la [§6.4]
> — `exhaustive: never` à **6**, `case 'round':` à **2** fichiers, `switch (node.type)` à **1**, les
> greps `-w` du jeu d'épreuve à 0/0/0/0/1 avec la forme naïve bien à **3**. **Aucune ne s'est
> écartée du plan.** Cinq corrections en sont sorties, toutes intégrées, **aucune ne touche une
> décision** :
>
> - **La sonde RTL était doublement défectueuse** (V-01). Écrite `grep -rni`, sans `-E`, elle
>   cherchait une chaîne littérale et non six alternatives ; et elle est **auto-falsifiante** une
>   fois ce plan commité — mesuré, la forme non scopée rend **18** occurrences, toutes dans ce
>   fichier. Forme canonique unique, `git grep -niE … ':!docs/plans/*'`, mesurée à **0** [§2, D7].
> - **Le test `Object.keys(RECIPE_TABLE)` promettait plus qu'il ne tient** (V-02). Il n'attrape un
>   champ d'agrégation que **requis** ; un `total?:` optionnel — la forme sous laquelle il
>   arriverait — le laisse vert, et `TableColumn` n'était pas couvert du tout. Le test gagne la
>   boucle sur les colonnes, la promesse est réécrite, et D9 dit désormais que son refus est **du
>   type sur le pied** et **de la doctrine plus un grep sur la colonne** [§2, D13 ; §6.2].
> - **Le grep anti-agrégat de la [§6.4] était trop étroit pour un filet unique** (V-03). Trois
>   chaînes littérales — `?` n'est pas un quantificateur en regex basique — ne voyaient ni un champ
>   requis, ni `sum?:`, ni `subtotal?:`. Remplacé par un motif de **déclaration de champ**, mesuré à
>   0 sur `ast/` et non inerte ailleurs [§6.4].
> - **La règle de conduite de `fixtures.ts` n'était pas outillée** (V-04). « Aucune fabrique
>   exportée non appelée » était une phrase, et le seuil global de 90 % ne la tient pas — il agrège.
>   Critère par fichier ajouté, sur `coverage-summary.json` que `json-summary` produit déjà, forme
>   vérifiée sur le rapport actuel [§5.5 ; §6.4].
> - **L'arbitrage n°3 était sous-classé, et le décompte d'allocations mal étiqueté** (V-05). Le n°3
>   passe en ⛔ : son option B réécrit plus de [§3] que celle du n°7, qui l'était déjà [§8]. Et
>   « 4 appels allouants sur 19 » comptait les tableaux **calculés non vides** : `text: () => []`
>   alloue aussi, donc **17 des 19 appels allouent** et la règle de non-mémoïsation vaut pour six
>   branches sur huit [§3.4 ; §5.3].
>
> **Revue de contradiction du 2026-08-16.** Trois relectures adverses — doctrine, technique et
> mesure, exécution et complétude — ont produit **vingt et une objections, dont zéro bloquante,
> douze majeures et neuf mineures**, ramenées à **dix-neuf corrections, toutes intégrées.** Aucune
> n'a disparu en silence, et celles qui corrigent un raisonnement faux sont écrites comme telles,
> l'énoncé fautif cité entre guillemets. Les plus importantes :
>
> - **Les docstrings prescrivaient le comportement du moteur** (C-01). Elles annonçaient qu'un
>   en-tête est « *Repeated page after page by the engine* » et qu'un tableau « *repeats `header` at
>   the top of every page, it may cut `body` between two entries* ». C'est la pagination, elle
>   appartient à E2, et D13 la refuse nommément : on ne peut pas refuser le champ parce que le choix
>   appartient au moteur *et* écrire dans le contrat ce que le moteur décidera [§2, D13 ; §3.1].
> - **La largeur était adossée à la page** (C-02). L'énoncé retiré : une part valait
>   « *`width / (sum of the widths of its table)` **of the width the page leaves available*** ».
>   La seconde moitié décrète qu'un tableau occupe toute la largeur utile — une règle d'apparence
>   (C5) appuyée sur une géométrie de feuille (C4). Le rapport inter-colonnes suffit, et **la largeur
>   du tableau lui-même n'est pas déclarée par C3** [§2, D6].
> - **Le motif de D7 prêtait à C6 une direction d'écriture que rien ne lui donne** (C-03). L'énoncé
>   retiré : « *the reason is lot C6 rather than taste* ». **MESURÉ** — la sonde RTL canonique
>   [§2, D7]
>   rend **aucune occurrence**, et le périmètre de C6 (`core.md:186-196`) énumère montants, dates,
>   séparateurs, symbole monétaire et libellés fixes, pas la direction. C3 **diffère** la résolution
>   et n'a aucune information pour la trancher [§2, D7 ; §8, arbitrage n° 5].
> - **Trois messages de refus recopiaient le contenu du modèle** (C-04), dont
>   `This cell fills a column named "${cell.columnId}", …`. L'ADR 0003:417 pose la règle : « la charge
>   d'erreur doit rester sûre à journaliser même quand le document ne l'est pas ». **MESURÉ** —
>   `grep -rn 'message:' packages/core/src --include=*.ts | grep '\${'` rend **zéro résultat**. Les
>   messages redeviennent constants, le `path` désignant seul la faute [§5.1].
> - **La preuve d'exactitude de D6 était bâtie sur un défaut au lieu d'une borne, avec un décompte de
>   colonnes faux d'un facteur quatre** (C-06). L'énoncé retiré : « *`assertBoundedShape` caps a
>   stored template at `maxNodes` values, so a table carries at most 100 000 columns* ». `maxNodes`
>   est un **défaut** surchargeable, plafonné à `LIMIT_HARD_CEILING = 1e9` ; le garde compte des
>   **valeurs**, pas des colonnes — **MESURÉ par bissection, 24 998 colonnes acceptées sous le
>   défaut, la 24 999ᵉ refusée** ; et `TableNodeSchema`, que le barrel exporte, n'applique aucun
>   garde. La preuve se rebâtit sur le plafond dur, puis sur la longueur maximale d'un tableau
>   JavaScript [§2, D6].
> - **Une correction de la revue a été renversée par la mesure, et c'est la seule** (C-07). La revue
>   concluait que le garde `if (declared.size === 0) return;` de `checkTableWiring` était « *du code
>   mort à supprimer* », au motif que « *Zod n'exécute pas le `superRefine` tant que le parse de base
>   a échoué* ». **Cet énoncé est faux, et la mesure qui le portait avait été prise contre un build
>   qui contenait encore le garde.** Re-mesuré : Zod 4 ne saute un `superRefine` que sur une issue
>   **abandonnante** — `invalid_type`, `invalid_value` ; les issues **continuables** — `too_small`,
>   `too_big`, `custom` — le laissent tourner. `columns.min(1)` rend un `too_small`, **donc il
>   n'arrête rien** : sur un tableau sans colonne portant douze cellules, le même `dist` rend **1
>   issue avec le garde et 13 sans**. Le garde reste, et il perd seulement son second argument : la
>   branche n'est pas inatteignable, elle est **atteinte à chaque tableau sans colonne**, donc
>   couverte par un `it` [§2, D3 ; §3.2 ; §5.1 ; §9, hypothèse 2].
> - **Une porte bornée manquait** (C-10). La docstring renvoyait à `parseDocumentNode`, qui valide
>   l'**autre** union et accepte une `tableRow` nue. **MESURÉ** : `BlockNodeSchema.parse` d'une chaîne
>   de 2 000 `container` imbriqués rend `RangeError: Maximum call stack size exceeded` — le
>   `RangeError` nu que les portes bornées de l'ADR 0003 décision 8 existent pour supprimer, rouvert
>   pour la seule union que le lot ajoute. `parseBlockNode` entre dans `template/guard.ts` [§3.6].
> - **Le lot rendait fausse une docstring de `guard.ts`** (C-13). `ShapeLimits.maxDepth` annonce
>   « *Measured on a realistic model: 10 levels […] 64 leaves a fivefold margin* », et le modèle de
>   recette de C3 en pèse **18**. D12 refuse tout plafond nouveau en s'appuyant sur cette mesure, tout
>   en laissant le fichier qui la porte dire autre chose. Le précédent est écrit : le plan C2 a
>   consacré sa §3.6 exactement à ce geste [§3.6].
> - **La condition (2) du critère d'appartenance ne discriminait rien** (C-15). L'énoncé retiré :
>   « (2) elle cesse d'exister avec la structure ». Contre-exemple immédiat — une hypothétique
>   `TableColumn.font` cesserait d'exister avec la colonne exactement comme `width` : la condition
>   est vraie de tout attribut posé sur une colonne, donc elle n'exclut rien de ce qu'on lui demande
>   d'exclure. Remplacement : « **elle est inexprimable hors d'une colonne** ». Et il faut dire
>   qu'`align` échoue lui aussi au test reformulé : il est retenu par **deux arguments mécaniques**,
>   pas par le critère, et c'est une exception nommée [§2, D1 et D7].
>
> **Ce que la revue a confirmé, et qui ne bouge pas.** Re-mesuré dans un bac à sable — copie complète
> de `packages/core`, jonctions vers le `zod@3.25.76` et le `vitest@4.1.10` du dépôt, `tsc` 7.0.2 avec
> les `tsconfig.json` et `tsconfig.typecheck.json` **du dépôt**, Node v24.11.1, `biome check` avec le
> `biome.jsonc` du dépôt, baseline à exit 0 avant toute édition, `git status` du dépôt **identique
> avant et après** : portes 1, 2 et 3 à **exit 0** avec les trois nœuds, les deux unions, le
> `superRefine` et l'estampille ; `parseTemplate` du modèle de recette **OK** et aller-retour JSON
> `toStrictEqual` **true** ; `collectDataPaths` rend exactement `['facture.numero','facture.lignes']` ;
> la chaîne de migration rend `[[1,2],[2,3],[3,4]]`, un document estampillé 3 sort à 4 et un
> estampillé 5 rend `TemplateMigrationError` ; une ligne nue dans `root.children` est refusée sur
> `root.children.2.type` / « No matching discriminator » ; le libellé
> `A table body needs a list to iterate over, got a number.` ; **le trou de covariance est réel** —
> retirer `TableNodeSchema` de `blockMembers()` laisse `tsc -p tsconfig.typecheck.json` **et**
> `tsc -p tsconfig.json` à exit 0, seul le test de parsing rougit [§5.2] ; retirer `align` casse en
> revanche **quatre** sites à la porte 2, plus un cinquième à la porte 3 ; élargir `DocumentNode` seul rend **1** erreur, et **4** une fois les
> trois membres et les trois `case` ajoutés ; un `superRefine` laisse un `ZodObject` en zod 4, donc
> `TableNodeSchema` reste membre légal des deux unions discriminées, `lazy` comprises.
>
> **L'état de l'arbre de travail, à lire avant INC-0.** Relevé le 2026-08-16 par
> `git status --porcelain` sur `main` : **trois fichiers modifiés et non commités** —
> `packages/core/src/expression/evaluator/operations/round.ts`, son test
> `packages/core/src/expression/evaluator/__tests__/round.test.ts`, et
> `apps/playground/src/App.tsx` — pour 3 fichiers, 44 insertions et 16 suppressions. C'est un
> remplacement de `charCodeAt` par `codePointAt` derrière un helper local `codeAt`, **sans aucun
> rapport avec C3**. INC-0 est un refactor de déplacement dont le critère de sortie est que
> `git diff --stat` ne montre **que** des déplacements et que `packages/core/src/index.ts` soit
> inchangé octet pour octet [§4, INC-0] : le lancer sur cet arbre mêle deux diffs dans une revue dont
> le travail est précisément de vérifier que **rien n'a changé**. À commiter ou à remiser avant la
> première ligne du lot.

---

## 0. Le cadre : Openview est un moteur d'édition, il fournit la capacité et jamais la règle

Tout ce qui suit en découle, et un lot de tableau est exactement l'endroit où l'on s'en écarte sans
le voir : un tableau de facture *ressemble* à un objet comptable, il en a les colonnes, l'en-tête et
la ligne de total. Il n'en est pas un.

Openview est un **moteur d'édition embarquable** installé dans l'application d'un tiers. Il n'est ni
un logiciel de gestion, ni une source de vérité. La facture est le **document de référence** du
projet — le niveau d'exigence à atteindre — jamais le périmètre.

La clause du README, section « Calculs, conformité et responsabilité », dit la limite dans les
termes qui tranchent ce lot :

> « Openview **calcule ce que le modèle lui demande de calculer, et rien d'autre**. Un modèle peut
> additionner, **agréger les lignes d'un tableau**, poser des conditions, calculer une échéance :
> c'est une capacité de calcul et de mise en page. **Ce n'est pas un moteur fiscal.** »

Le membre de phrase qui décide ici est « agréger les lignes d'un tableau » : c'est le **modèle** qui
agrège, jamais le tableau. Et la table d'arbitrage de `docs/roadmap/core.md:43-49` place la frontière
au nœud près :

| Sujet | Position écrite | Où |
| :--- | :--- | :--- |
| Additionner, multiplier, **agréger des lignes**, poser une condition | **Openview le fait**, sur demande du modèle | `core.md:45` |
| **Comment** un montant s'arrondit | **Le modèle le déclare** (lot C2) — la décision reste celle de son auteur | `core.md:47` |
| Le **report de page** (« report : 12 480,00 € ») | **Le moteur** : seul lui sait où il coupe | `core.md:48` |
| Le **taux** de TVA, l'exigibilité, l'exonération, les mentions obligatoires | **Jamais Openview.** Données ou choix de l'intégrateur | `core.md:46` |
| La **conformité** du document produit | **L'intégrateur.** Énoncé sans détour dans le README | `core.md:49` |
| Répéter l'en-tête page à page, choisir le point de coupe, numéroter « 2 / 4 » | **Le moteur** (E2) | `engine.md:44-50` |
| « à quoi ça ressemble » | **Le moteur ou le viewer.** La brique **décrit**, elle ne **produit** rien | `core.md:271-274` |

> 🔑 **La règle qui coupe la dérive, appliquée au tableau.** La capacité s'arrête à **une structure
> qui dispose**. Elle ne va jamais jusqu'à **un total calculé par le tableau** — la somme est une
> expression du modèle, `round(sum(...), d, m)`, et l'ADR 0004 « Conséquences — Pour C3 » (`:784-788`)
> l'a déjà écrit : un tableau qui sommerait ses propres colonnes réintroduirait l'arrondi implicite
> que la décision 8 refuse, et le ferait **hors de l'arbre**. Elle ne va jamais jusqu'à **un type de
> colonne** : « monétaire » appelle une échelle et un symbole, donc un arrondi implicite, donc une
> position d'arrondi de fait. Elle ne va jamais jusqu'à **un format**, un séparateur, une locale ou
> une échelle d'affichage : c'est C6, et C2 a laissé la question ouverte plutôt que de la trancher
> en passant. Elle ne va jamais jusqu'à **un en-tête déduit d'un nom de champ** ni jusqu'à des
> colonnes déduites des clés du jeu de données : ce serait réserver une convention de nommage à
> l'intégrateur, et le test d'AGENTS.md (« si une fonctionnalité oblige l'intégrateur à nommer un
> champ comme Openview l'a décidé, elle est à refuser ») la tue sans discussion. Et elle ne va jamais
> jusqu'à **une politique de pagination** — répétition d'en-tête, veuve, orpheline, point de coupe,
> report : `engine.md:44-50` et `:56-67` les attribuent au moteur, et `core.md:271-274` les interdit
> à la brique. Chacun de ces cinq refus est nommé, avec sa raison, en [§2, D13].

Les fichiers du dépôt qui portent déjà ce cadre et qu'il faut avoir lus : `AGENTS.md`
(« Ce qu'Openview n'est pas », et §3 sur les patrons), `README.md` §« Calculs, conformité et
responsabilité », `docs/roadmap/README.md` (les sept jalons, §§2, 5, 7 et 8), `docs/roadmap/core.md`
(table d'arbitrage `:34-49`, lot C3 `:150-161`, lots C5 `:174-184`, C6 `:186-200`, C7 `:202-211`,
C8 `:213-224`, « Ce que cette brique ne fait pas » `:269-278`), `docs/roadmap/engine.md` (E1 `:33-40`,
E2 `:42-52`, E3 `:56-70`, E5 `:87-97`, E6 `:100-119`, E8 `:139-149`), `docs/roadmap/designer.md`
(D6 `:106-115`), `docs/adr/0002-data-binding-and-loop-scope.md` (la portée d'alias et ce que
`collectDataPaths` promet), `docs/adr/0003-formules-agregations-et-dates-civiles.md` (décisions 4, 5,
6 et 8, et la charge d'erreur `:417`), `docs/adr/0004-les-arrondis-declares-par-le-modele.md`
(décision 8, décision 10, et « Conséquences — Pour C3 » `:784-788`), `.github/pull_request_template.md`
§« Périmètre », et enfin `apps/playground/src/App.tsx:157-162`, qui est l'endroit où le dépôt écrit
déjà, en français et à l'intention d'un lecteur de passage, qu'il ne réserve aucun nom de champ.

---

## 1. Pourquoi C3, et pourquoi maintenant

### Ce que la roadmap impose

`docs/roadmap/core.md`, lot C3, mot pour mot (`:150-161`) :

> « ### C3. Le tableau de lignes
>
> **Pourquoi.** La répétition existe, la notion de **tableau** non : des colonnes, une largeur par
> colonne, un en-tête de colonnes, un alignement par colonne (libellés à gauche, montants à droite).
> C'est le cœur visuel d'une facture, et le support des agrégations du lot C1.
>
> **Prêt quand** un tableau à cinq colonnes typé (désignation, quantité, prix unitaire, remise,
> montant) est décrit dans un modèle, en-tête compris, et que sa dernière ligne peut être une somme
> de ce qui précède.
>
> **Poids :** M — **Dépend de :** C1 »

Quatre lectures de ce texte décident la conception, et elles y sont toutes. **Quatre livrables sont
nommés, pas cinq** : des colonnes, une largeur par colonne, un en-tête de colonnes, un alignement par
colonne — tout champ supplémentaire est à justifier contre la règle anti-sur-ingénierie, et c'est
exactement le travail du critère d'appartenance [§2, D1]. **Le verbe est « décrite », jamais
« rendue »** : le tableau de C3 est une forme stockée, pas un algorithme de mise en table. **Le modal
de « sa dernière ligne PEUT être une somme » est décisif** : c'est une capacité offerte au modèle,
pas une ligne que le tableau fabrique — et c'est le point exact où la contrainte transmise par C2
mord [§2, D9]. Enfin, **« le support des agrégations du lot C1 »** dit que le tableau donne un sens
visuel à `sum`/`count`/`avg`/`min`/`max`, pas qu'il les exécute : l'agrégation existe déjà, elle
s'applique à une liste de **données** et non à un tableau rendu.

Le lot n'est pas isolé, et quatre lots en aval attendent de lui des propriétés précises.

**E2, « Le tableau déborde proprement »** (`engine.md:42-52`), demande au moteur de « passer à la page
suivante, **répéter l'en-tête des colonnes**, répéter l'en-tête et le pied de page du modèle, et
numéroter "page 2 / 4" », et sa recette est « une facture de soixante lignes produit quatre pages
lisibles, dont aucune ne commence par une ligne orpheline ou un tableau sans en-tête ». Ce que cela
impose au **contrat**, et rien de plus : l'en-tête de colonnes doit être une partie **distincte et
désignable** du nœud tableau, pas « la première ligne » — un moteur qui doit répéter quelque chose
doit pouvoir le nommer sans heuristique [§2, D4] ; et les lignes doivent former une séquence dont la
coupure entre deux éléments est licite, ce qui interdit une représentation à plat indexée modulo N.

**E1** (`engine.md:33-40`) annonce « une facture courte, **un tableau qui tient sur la page** […]
l'apparence du modèle respectée » et « Dépend de : core vague 1 » : C3 doit être rendable *tel quel*,
sans lot complémentaire. **E5** (`engine.md:87-97`) exige que le moteur puisse dire « **quelle ligne
sur quelle page** » sans produire le PDF — C3 ne doit donc pas rendre l'identité d'une ligne
inconstructible, ce que fait aujourd'hui le playground en fusionnant une ligne entière en un seul
nœud texte. **C7** (`core.md:202-211`) veut marquer « un cadre de totaux » comme insécable : il n'a
rien à marquer si les parties du tableau ne sont pas des nœuds portant un id — et C7 dépend de C4,
pas de C3, donc C3 ne doit surtout pas inventer son propre `keepWithNext`.

**C5, « L'apparence »** (`core.md:174-184`), est le seul lot de la vague 1 qui **nomme C3** dans sa
dépendance (`core.md:184`) — C8 et C9 en dépendent aussi, mais par une clause globale (« C1 à C7 »,
`core.md:224` ; « chaque lot ci-dessus », `core.md:234`). Il attend deux choses opposées : une structure sur laquelle poser l'apparence — la
colonne doit exister comme entité adressable, sinon « filet vertical entre la colonne 3 et la colonne
4 » est inexprimable — et **zéro champ d'apparence dans C3**, puisque déplacer un champ stocké est
une migration transformante. Le recouvrement sur « alignements », qui figure dans le périmètre de C5
(`core.md:179`) *et* dans celui de C3 (`core.md:153-154`), n'est arbitré par aucun texte du dépôt :
c'est [§2, D7] qui le tranche, et [§8, arbitrage n° 2] qui le remonte.

**C6** (`core.md:186-200`) impose une conséquence dure : l'en-tête de colonne est un **libellé fixe
du modèle**. Stocké comme un `label: string`, il obligerait C6 à une migration transformante sur tous
les modèles écrits entre-temps ; fait position de contenu ordinaire, il n'en demande aucune — c'est
l'argument décisif de [§2, D4]. **C8** (`core.md:213-224`, « Dépend de : C1 à C7 ») veut « dire *quel
bloc*, *quel champ*, et *ce qu'on attendait* » à un non-développeur : tout ce que le tableau peut
avoir de mal formé doit donc être refusé au save time avec un chemin qui désigne la faute [§5.1], et
le site d'erreur d'expression doit nommer le corps d'un tableau plutôt que de dire « loop » [§2, D10].

Enfin, la position dans le plan. C3 est un composant de **J1** — « Une facture comptable complète, en
deux langues, est **décrite** dans un modèle » (`docs/roadmap/README.md:92`) — et c'est le seul lot
qui porte les « soixante lignes » de la fin de brique (`core.md:282-288`).

### L'écart est réel, et il est structurel

La notion de tableau n'existe **nulle part** dans le dépôt. Ce n'est pas une insuffisance de forme,
c'est une absence : rien à élargir, rien à renommer, six positions à écrire.

| Verrou | Où | Ce qu'il impose |
| :--- | :--- | :--- |
| Cinq types de nœud, aucun ne dispose en colonnes | `packages/core/src/ast/nodes.ts:107` — `TextNode \| ImageNode \| ContainerNode \| LoopNode \| ConditionNode` | « des colonnes, une largeur par colonne » n'a **aucun site** où s'écrire ; le lot ajoute trois types et une seconde union [§2, D2] |
| Une ligne de facture est **un seul nœud texte concaténé** | `apps/playground/src/App.tsx:173-189` — un `text` dont le `content` colle SKU, montant et remise en cinq segments | E5 ne peut désigner « quelle ligne sur quelle page », C7 n'a rien à marquer, C5 n'a aucune colonne à border, et rien ne peut aligner un montant à droite |
| Le seul `<table>` de la démonstration est du **JSX écrit à la main, hors du modèle** | `App.tsx:827-864` ; la liste des lignes du modèle, elle, s'affiche en `<ol>`/`<li>` (`App.tsx:793-807`) | ce qui est à l'écran ne vient pas du contrat : la vitrine du dépôt ne démontre rien de ce lot tant qu'elle n'en dérive pas [§6.3] |
| `BlockType` déclare déjà `'table'` alors que `core` n'a pas ce nœud | `packages/designer/src/types.ts:3` | l'éditeur propose un bloc que le contrat ne sait pas décrire — **juste par accident**, et aucune des quatre portes ne voit l'écart ; la liste devient dérivée [§3.9] |
| Le site d'erreur d'expression ne connaît ni tableau ni corps de tableau | `packages/core/src/errors.ts:80` — `ExpressionErrorSite = ExpressionKind \| 'loop' \| 'condition'` | un refus de liste dirait « A loop needs a list… » à qui n'a écrit aucune boucle : une régression C8 dans un lot dont C8 dépend [§2, D10 ; §3.5] |
| `ast/nodes.ts` mêle déjà types écrits à la main et schémas Zod dans un seul fichier de 190 lignes | `packages/core/src/ast/nodes.ts` (types `:23-110`, schémas `:112-190`) | C3 le double ; AGENTS.md §2 « Modularité & taille des fichiers » demande d'isoler `types.ts` et `schemas.ts` derrière une façade, ce que `expression/` a déjà exécuté — d'où INC-0 [§4, INC-0] |

La dernière ligne mérite d'être lue comme un verrou et non comme un confort : le lot n'ajoute pas
trois lignes à `nodes.ts`, il y ajoute trois types de nœud, deux enregistrements inertes, une seconde
union, cinq schémas et un `superRefine`. Le déplacement fait après coup coûterait trois fois plus de
lignes déplacées dans une revue trois fois moins lisible.

### Arguments contraires, examinés et écartés

**« C4 (la page) est plus urgente : sans feuille, un tableau ne se pose sur rien. »** Non, et la
dépendance va dans l'autre sens que ne le suggère l'intuition. C4 « Dépend de : rien »
(`core.md:172`) : il peut être fait à tout moment, y compris après. C3, lui, est **bloquant** pour
C5, qui bloque C6, qui conditionne E4. Et le contrat de C3 ne dépend d'aucune géométrie de feuille :
c'est précisément l'objet de la correction C-02 rappelée en tête de ce plan — la largeur d'une
colonne est un rapport inter-colonnes, elle ne référence pas la largeur de la page, et le tableau ne
déclare pas sa propre largeur [§2, D6]. Un lot qui n'a besoin de rien ne devient pas urgent parce
qu'il est facile.

**« Le lot est M, il peut attendre la fin de la vague 1. »** Le poids décrit le coût, pas la
position — c'est l'argument que le plan C2 avait déjà opposé à la même objection, et il vaut ici pour
une raison de plus. C3 est le lot de la vague 1 dont **quatre autres lots de la même vague** dépendent — un
nommément (C5), trois par transitivité ou clause globale (C6, C8, C9) —, et le seul qui porte les
« soixante lignes » de la fin de brique. Le
repousser ne décale pas C3 : il décale C5, C6 et la partie bilingue de J1.

> ⚠️ **Correction d'un raisonnement faux, à ne pas recopier.** Le plan C2 écrit, à ses lignes
> 186-187 : « **C4 et C3 ne débloquent aucun lot en aval** ». C'est **faux au sens strict**, et la
> phrase est dans le dépôt, opposable, prête à être recopiée par le prochain lecteur qui cherchera
> une raison de repousser C3. Le relevé : `docs/roadmap/core.md:184` donne « **C5 — Dépend de : C3** »
> et `core.md:196` donne « **C6 — Dépend de : C2, C5** ». **C3 est donc en tête de la chaîne
> C3 → C5 → C6 → E4**, et C8 dépend de C1 à C7 (`core.md:224`). Ce que le plan C2 voulait dire —
> et qu'il dit correctement trois lignes plus bas — c'est que C3 hérite d'une **contrainte** de C2
> sur la ligne de total ; il a écrit qu'il ne débloquait rien. Deux gestes : le motif est corrigé
> ici, et l'ADR 0005 nomme la phrase du plan C2 sans la corriger là où elle ne vit pas — un plan
> périmé n'est pas un texte qu'on réécrit [§4, INC-5].

---

## 2. Ce qui est décidé, et ce que ça engage

Treize entrées. Elles ne décrivent pas un champ chacune : elles décrivent **ce qu'un tableau est
autorisé à savoir de lui-même**, et c'est là que se joue le lot. Un tableau qui connaît la somme de
sa colonne, la largeur de la feuille, le format d'un montant ou l'endroit où le moteur coupe est un
tableau qui a récupéré, par la bande, quatre décisions qui appartiennent respectivement à l'auteur
du modèle, à C4, à C6 et au moteur. Les treize décisions sont, prises ensemble, la liste de ce que
le nœud **ne** sait **pas** — et la seule qui ajoute véritablement de la matière au dépôt, D2, en
ajoute trois types de nœud et deux enregistrements inertes, pas un comportement.

> **Les trois propositions, citées ci-dessous par leur numéro.** Le contrat a été instruit par trois
> esquisses concurrentes, écrites indépendamment sous trois angles imposés, et les alternatives
> écartées les nomment plutôt que de les paraphraser. La **proposition 1** — *le contrat le plus
> petit* — pose deux types de nœud, une cellule appariée **par position**, et des lignes autorisées
> partout dans le flux. La **proposition 2** — *le contrat lisible par le moteur* — pose trois types
> de nœud, l'appariement **par clé**, et une cellule qui ne contient que des `TextSegment[]`, donc
> une imbrication impossible par construction. La **proposition 3** — *le contrat qui rend l'éditeur
> possible* — pose **un seul** type `table`, la colonne possédant ses cellules, et la répétition
> portée par le tableau lui-même. **Aucune ne survit telle quelle** ; leurs arguments, si, et c'est
> pour cela qu'elles sont citées. Le panachage retenu est celui de la [§3], et chaque décision
> ci-dessous dit à laquelle elle emprunte.

Leur réversibilité n'est pas uniforme, et le relevé compte, parce que l'ADR 0005 le recopiera :
**trois sont strictement irréversibles** (D3, D9, D11), **quatre ne se rouvrent que dans un sens**
(D2 vers l'élargissement du flux de blocs, D4 vers l'ajout d'un libellé de colonne, D6 vers
l'élargissement de la fenêtre de largeur, D8 vers un site d'alias de plus), **cinq sont
réversibles** (D1, D5, D10, D12, D13), et **une reste ouverte jusqu'à INC-1** — D7, dont l'arbitrage
n°5 [§8] doit être rendu avant que le premier modèle ne soit stocké, parce qu'après, le revirement
est à la fois transformant et **sémantiquement indécidable**. Trois d'entre elles méritent d'être
nommées tout de suite, parce que ce sont celles dont un lecteur pressé sous-estimera le coût de
retour.

**D9 est irréversible au sens fort** : elle ne coûte pas une migration, elle coûte un revirement de
doctrine. Le pied d'un tableau n'accepte que des `TableRowNode`, donc le nœud n'a **nulle part** où
poser un champ d'agrégation ; ajouter ce champ plus tard, ce serait réintroduire l'arrondi implicite
que l'ADR 0004 décision 8 refuse, et le réintroduire **hors de l'arbre** — exactement la contrainte
que le plan C2 a transmise à C3 par écrit. **D3 est irréversible au sens du coût de migration** :
revenir de l'appariement par clé à l'appariement positionnel exige de retirer un `columnId` de
chaque cellule, donc d'inférer un ordre que le document ne porte plus, donc une migration
transformante sur tous les tableaux écrits entre-temps ; la proposition qui défendait le positionnel
l'a écrit elle-même comme « la décision la moins réversible du lot ». **D5, à l'inverse, est une
décision *sur* la réversibilité** : entre une cellule de blocs et une cellule de segments, ce n'est
pas l'expressivité qui a tranché mais le sens du revirement — restreindre plus tard est un
rétrécissement, élargir depuis des segments aurait été une migration transformante, et l'un des deux
se paie, l'autre pas.

Ce qui vaut de toutes, en revanche, est identique à ce que le plan C2 avait écrit de ses douze :
le coût de retour n'est jamais nul. C'est soit une migration transformante, soit un changement de
valeur des modèles déjà écrits, soit une contradiction entre deux textes du dépôt. **Chacune doit
donc figurer dans l'ADR 0005**, avec son motif, ses alternatives écartées, son verdict de
réversibilité et, quand il y en a un, son signal de réouverture ; [§4] INC-5 en dresse le sommaire
obligatoire.

| # | Décision | Réversible ? |
| :-- | :--- | :--- |
| **D1** | Le critère d'appartenance, écrit avant la liste des champs | **Oui** — c'est un texte. Mais le rouvrir rouvre les douze refus qu'il porte à lui seul |
| **D2** | Trois types de nœud, et la seconde union `BlockNode` | **Dans un seul sens** : le flux de blocs se réélargit, les trois nœuds ne se retirent plus |
| **D3** | La cellule nomme sa colonne | **Non** — retourner au positionnel est une migration transformante de tous les tableaux stockés |
| **D4** | L'en-tête est une section de lignes | **Dans un seul sens** : un libellé de colonne s'ajoute plus tard ; `header` ne se retire pas |
| **D5** | Une cellule contient des blocs, pas des segments | **Oui**, et c'est le motif même de la décision : le revirement est un rétrécissement, jamais une transformation |
| **D6** | La largeur est un poids entier borné à [1, 1000] | **Dans un seul sens** : la fenêtre s'élargit, l'unité ne change pas sans transformation |
| **D7** | `start \| center \| end`, par colonne, et il appartient à C3 | **Ouverte jusqu'à INC-1** ([§8], arbitrage n°5) ; transformante et indécidable après |
| **D8** | La répétition vit sur `tableRowGroup` | **Dans un seul sens** : un site d'alias s'ajoute, celui-ci ne se déplace plus |
| **D9** | Le pied ne contient que des lignes fixes | **Non, au sens fort** — un champ de total serait un revirement de doctrine, pas une évolution |
| **D10** | Zéro code d'erreur nouveau ; un site `tableRowGroup` | **Oui** — aucune forme persistée n'est touchée par cette décision seule |
| **D11** | `CURRENT_SCHEMA_VERSION` passe à 4 | **Non, par construction** : une estampille posée ne se retire pas |
| **D12** | Aucun plafond nouveau | **Oui** — un plafond s'ajoute plus tard ; ce serait un rétrécissement, avec son signal nommé |
| **D13** | Ce que le lot refuse, par écrit | **Oui, refus par refus** — trois d'entre eux portent un signal de réouverture daté |

---

### D1 — Le critère d'appartenance, écrit **avant** la liste des champs

**Décision.** Une déclaration entre dans le nœud tableau ou dans une colonne **si et seulement si**
les quatre conditions sont réunies :

1. elle est **partagée** par les N cellules d'une colonne, ou par la structure entière ;
2. elle est **inexprimable hors d'une colonne** — supprimez la notion de colonne, et l'attribut n'a
   plus de site où s'écrire ;
3. elle ne peut changer ni un `compare`, ni un `sum`, ni un `dateAdd` ;
4. elle n'oblige l'intégrateur à nommer **aucun** champ de son jeu de données.

Identité de colonne, poids de largeur et sections nommées passent les quatre. **L'alignement de
colonne échoue au (2), et il est retenu quand même : c'est une exception nommée, motivée plus bas
par deux arguments mécaniques et non par le critère.**

**Pourquoi un critère, et pourquoi avant la liste.** Les deux plans qui précèdent montrent qu'un
bornage ne se défend pas champ par champ : l'ADR 0003 décision 5 et l'ADR 0004 décision 10 écrivent
chacune leur test **avant** d'énumérer ce qu'elles acceptent, et la raison est qu'un bornage
justifié au cas par cas fait rouvrir l'arbitrage à chaque demande suivante. C3 en a un besoin
particulier : **le recouvrement sur « alignements » entre C3 et C5 n'est arbitré par aucun texte du
dépôt.** `docs/roadmap/core.md:153-154` écrit « un alignement par colonne » dans le périmètre de C3 ;
`core.md:179` écrit « alignements » dans celui de C5. Deux lectures sont possibles, aucune n'est
écrite, et il faut donc un test — pas une préférence. C'est ce que le critère est, et c'est pour cela
qu'il faut le dire : **sur ce point, C3 arbitre, il ne lit pas.**

> ⚠️ **Correction d'un raisonnement faux, à ne pas recopier.** Une version antérieure de ce critère
> écrivait la condition (2) ainsi : « **elle cesse d'exister avec la structure** », glosée dans la
> docstring de `TableColumn` par « *A font, a rule, a background, a spacing fail the second — they
> outlive the column* ». **L'énoncé ne trie rien, et le contre-exemple tient en une ligne :** une
> hypothétique `TableColumn.font` cesserait d'exister avec la colonne exactement comme `width` et
> comme `align`. La condition est vraie de **tout** attribut posé sur une colonne — c'est une
> tautologie de la structure de données, pas un test — donc elle n'exclut rien de ce qu'on lui
> demande d'exclure, et la glose citée décrit une propriété que ni la police ni le filet n'ont.
>
> **La formulation juste est un test d'INEXPRIMABILITÉ, et il trie réellement.** Police, filet, fond
> et espacement échouent parce qu'ils **s'écrivent sur n'importe quel bloc**, et que C5 les y
> définira : supprimez la notion de colonne, ils gardent un site. Une largeur *partagée* n'en garde
> aucun — une largeur posée bloc par bloc serait du positionnement au millimètre, hors périmètre v1
> (`README.md:135`, repris en `core.md:278`), et la largeur n'apparaît **dans aucune des deux listes
> énumérées** par le dépôt, ni celle de C4 (`core.md:165`), ni celle de C5 (`core.md:177-179`). Elle
> n'est donc dans le périmètre d'aucun autre lot, et C3 la nomme.

**Et `align` échoue au (2) reformulé — il faut l'écrire, sinon le critère ment.** Un alignement
s'écrit sur n'importe quel bloc, et C5 l'y définira : « alignements » est dans sa liste. L'alignement
de colonne reste dans C3 sur **deux arguments mécaniques, extérieurs au critère** :

- **Le libellé du lot le nomme.** « des colonnes, une largeur par colonne, un en-tête de colonnes,
  **un alignement par colonne** » (`core.md:153-154`), et le « Pourquoi » précise l'intention —
  « libellés à gauche, montants à droite » (`core.md:154`).
- **La chaîne de dépendances l'interdit ailleurs.** « C5 […] **Dépend de :** C3 » (`core.md:184`).
  Une propriété dont le **critère de recette de C3** a besoin ne peut pas vivre dans le lot qui vient
  après : sans elle, « libellés à gauche, montants à droite » est indémontrable en [§6].

C'est donc une **exception nommée**, et elle est plus solide écrite comme telle que déguisée en
conséquence du critère : un lecteur qui appliquera le critère à la demande suivante ne trouvera pas
un précédent qui l'autorise à ranger n'importe quelle propriété d'apparence dans C3.

**Ce que le critère tranche seul, sans qu'aucune demande ait à être rediscutée.**

| Demande prévisible | Condition qui la tue | Où elle vit |
| :--- | :---: | :--- |
| Police, graisse, taille, couleur de texte | (2) | C5 |
| Filet, bordure, fond, zébrure | (2) | C5 |
| Espacement, retrait, marge intérieure de cellule | (2) | C5 |
| Alignement **de bloc**, surcharge d'alignement par cellule | (2) | C5 |
| Format numérique, séparateur, symbole monétaire, échelle d'affichage | (2), et le test déjà écrit par l'ADR 0004 décision 10 | C6 |
| Type de colonne (« monétaire », « nombre », « date ») | (2), puis (3) par l'échelle qu'il appelle | C6 ; [§8], arbitrage n°1 |
| `total`, sous-total, opérateur d'agrégation sur la colonne | (3) | le modèle [§2, D9] |
| Colonne calculée portée par la colonne (« montant = q × pu ») | (3) | la cellule |
| Tri, filtre, regroupement déclarés sur le tableau | (2) | l'algèbre C1 [§2, D13] |
| En-tête déduit d'un nom de champ (`designation` → « Désignation ») | (4) | nulle part |
| Colonnes déduites des clés du jeu de données | (4) | nulle part |
| Alignement déduit du type de la valeur (« les nombres à droite ») | (4) | nulle part |
| `colSpan` / `rowSpan` | (1) | nulle part [§2, D13] |

Deux lignes de ce tableau demandent leur phrase, parce que le raccourci s'y voit. **Le tri échoue au
(2) par un argument d'un cran plus long** : trier est une opération de **liste**, les opérations de
liste vivent dans l'algèbre, `TableRowGroupNode.each` accepte n'importe quelle expression, et
`filter` est déjà un kind (`expression/types.ts:375-380`) — le tableau n'a pas à être un second
endroit où une liste se transforme, sans quoi deux orthographes de la même chose dériveraient.
**`colSpan` échoue au (1)** : c'est une propriété d'**une** cellule, ni partagée par les N cellules
d'une colonne, ni portée par la structure entière ; et elle détruit l'invariant « une cellule
appartient à une colonne », dont dépendent la largeur, l'alignement et la coupure entre deux lignes.

**Le critère est un test d'admission, pas une preuve d'inexistence du besoin.** Il dit où une
déclaration doit vivre, jamais que personne ne la demandera. C'est [§2, D13] qui porte les refus
eux-mêmes, avec pour trois d'entre eux un signal de réouverture daté.

**Écarté.** (a) *Reprendre tel quel le test de l'ADR 0004 décision 10* — « si une déclaration peut
changer le résultat d'un `compare`, d'un `sum` ou d'un `dateAdd`, elle est C2 ; si elle ne peut
changer que ce qu'un lecteur voit, elle est C6 » : il rangerait largeur **et** alignement hors de C3,
contredirait frontalement le libellé du lot et rendrait le critère de recette inatteignable, C5
dépendant de C3. Il est repris ici comme la **condition (3)**, à sa juste portée. (b) *N'écrire aucun
critère et justifier chaque champ au cas par cas* : c'est exactement le mécanisme qui fait rouvrir un
arbitrage à chaque demande, et les deux plans existants le nomment comme un défaut.

**Conséquences.** Le critère est **opposable** : une demande se refuse en citant le numéro de la
condition qui la tue, pas un goût. Il est à recopier dans l'ADR 0005, parce qu'il tranche aussi la
frontière C3/C5 que la roadmap laisse ambiguë. Et il rend explicite que C3 **arbitre** un
recouvrement plutôt qu'il ne lit un texte : c'est une décision, elle porte le nom de son auteur, et
elle est révisable comme telle.

**Réversible** — mais la rouvrir rouvre les treize lignes du tableau ci-dessus, dont douze que le critère tranche à lui seul.

---

### D2 — Trois types de nœud, et une seconde union `BlockNode` qui **sépare le flux du contenu de tableau**

**Décision.** `DocumentNode` s'élargit de `TableNode`, `TableRowGroupNode` et `TableRowNode`. Une
seconde union apparaît :

```ts
export type BlockNode = TextNode | ImageNode | ContainerNode | LoopNode | ConditionNode | TableNode;
export type DocumentNode = BlockNode | TableRowNode | TableRowGroupNode;
```

`BlockNode` — **six** membres — devient le type de `ContainerNode.children`, `LoopNode.children`,
`ConditionNode.children` et `TableCell.children`. `DocumentNode` — **huit** membres — reste le
domaine du Visitor, de `walk`, de `findNodeById` et de `collectDataPaths`.

**Pourquoi une ligne doit être un nœud.** Trois consommateurs la désignent, et aucun ne sait
désigner un enregistrement inerte. C7 marque un bloc insécable (`core.md:204-210`) et « en-tête
+ première ligne insécables » n'est exprimable que si la ligne porte un id. E5 restitue « quelle
ligne sur quelle page » (`engine.md:89-97`). Et `childrenOf` doit pouvoir rendre une ligne, parce que
c'est la **seule** voie par laquelle `collectDataPaths` traverse : un sous-arbre que `childrenOf` ne
rend pas est invisible à `walk`, à `findNodeById` et à la collecte, **sans erreur nulle part**.

**Pourquoi deux unions plutôt qu'une.** Une ligne hors d'un tableau ne veut rien dire, et un moteur
qui en rencontrerait une dans un conteneur devrait deviner. Les deux unions le disent **au
compilateur et à Zod d'un seul geste** — pas de passe de validation sémantique, pas de refus à
écrire, pas de message à ajouter au catalogue de C8 : un `tableRow` égaré sous un conteneur n'a
simplement aucun membre d'union à apparier. **MESURÉ** dans le bac à sable (Node v24.11.1,
`zod@3.25.76` via `zod/v4`) : une ligne nue glissée en troisième position de `root.children` est
refusée exactement sur `root.children.2.type`, « No matching discriminator ».

**Ce que la compilation rattrape, en trois temps mesurés.** Protocole : bac à sable, `tsc` 7.0.2,
`tsconfig.typecheck.json` **du dépôt**, baseline vérifiée à exit 0 avant toute édition.

| État de l'incrément | Erreurs `tsc` | Où |
| :--- | ---: | :--- |
| `DocumentNode` élargi, rien d'autre | **1** | `visitor.ts` — `Type 'TableNode' is not assignable to type 'never'` |
| + les trois membres de `NodeVisitor` et les trois `case` de `visitNode` | **4** | `childrenOf`, `READS_VISITOR`, `visitor.test.ts:56`, `visitor.test.ts:82` |
| + `childrenOf`, `READS_VISITOR` et les deux tests complétés | **0** | exit 0 |

La branche `default` de `visitNode` se termine par un `const exhaustive: never = node`, et c'est
elle qui rend la première erreur : **le passage de cinq à huit types de nœud est tenu par la porte 3,
pas par une relecture.** C'est le contrôle qu'AGENTS.md §3.B décrit comme « strictement plus fort
qu'un Visitor » sur l'algèbre d'expressions ; ici, il **est** le Visitor, et il se comporte de la
même manière.

**La seule couture qu'aucune porte ne tient est ailleurs, et elle est mesurée.** Le membre
`TableNodeSchema` dans `blockMembers()` doit être écrit à la main, et son oubli ne produit **aucune**
erreur : `z.ZodType` est covariant en sortie, donc une union qui produit *moins* que son annotation
reste assignable. **MESURÉ, en retirant le membre :** `tsc -p tsconfig.typecheck.json` **exit 0**,
`tsc -p tsconfig.json` **exit 0**, build propre — **seul le test de parsing rougit**. Ce test n'est
donc pas une commodité, c'est la protection unique, et il vit dans le même commit qu'INC-1 ; le
détail est en [§5.2].

**Écarté.** (a) *Un seul type `table` portant colonnes et cellules à plat* (proposition 3) : le corps
n'est plus qu'**une** répétition, une facture groupée par famille avec sous-total intermédiaire
devient irreprésentable, et la proposition l'écrit elle-même — « ce contrat est à **rejouer**, pas à
élargir ». Or C3 fixe le plafond de l'éditeur : « chaque possibilité offerte dans l'éditeur doit déjà
être **décrite par le contrat** » (`designer.md:38-44`), et l'éditeur de tableau D6 arrive en vague 2
(`designer.md:115`, `:104`, `core.md:238`). Un plafond posé maintenant et trop bas ne se relèvera pas
avant deux vagues. (b) *Deux types, la cellule étant un `DocumentNode` positionnel* (proposition 1) :
voir [§2, D3]. (c) *Une seule union, avec des lignes autorisées partout* (proposition 1) : le moteur
devrait refuser **à l'exécution** ce que le contrat aurait accepté au save time, contre l'ADR 0004
décision 6 et contre le garde-fou de D6.

**Conséquences.**

- `ContainerNode.children`, `LoopNode.children` et `ConditionNode.children` **changent de type**.
  C'est un rétrécissement de trois positions stockées, et il ne rétrécit **rien d'existant** : aucun
  document v3 ne peut porter une ligne, puisque le type n'existait pas. À écrire noir sur blanc dans
  la migration 3→4 [§3.7], et à ne pas compter comme un cinquième rétrécissement de valeur [§2, D11].
- **Un concept de plus à comprendre**, et c'est le vrai coût de la décision. Il est atténué par les
  fabriques `blockMembers()` / `rowMembers()` [§3.2], qui rendent impossible la dérive **entre les
  deux unions Zod** — mais pas contre les unions écrites à la main, que seul le test de parsing
  rattrape.
- **`DocumentNodeType` cesse de mentir au Registry, et `BlockNodeType` est nommé.** Aujourd'hui,
  `nodes.ts:109-110` écrit « *Discriminant values, exported so the block Registry can validate a
  type* ». Après C3, `DocumentNodeType` vaut **huit** membres, `tableRow` et `tableRowGroup`
  compris : un Registry de blocs qui validerait contre lui **accepterait une ligne là où le schéma la
  refuse**, et le contrat aurait fabriqué lui-même l'incohérence que la coupure d'union existe pour
  supprimer. `ast/types.ts` gagne donc `export type BlockNodeType = BlockNode['type'];` avec sa
  docstring — « *What a user may INSERT in a block flow — this, and not `DocumentNodeType`, is what a
  block Registry validates against.* » — et celle de `DocumentNodeType` devient « *Every discriminant,
  rows included: the Visitor's domain, and `walk`'s. Not the Registry's.* » [§3.1].
- **`packages/designer/src/types.ts:3` devient dérivable.** La liste écrite à la main —
  `'text' | 'image' | 'container' | 'table' | 'loop' | 'condition'` — est **exactement**
  `BlockNode['type']`, et elle contenait déjà `'table'` alors que `core` n'avait pas ce nœud : juste
  **par accident**, et aucune des quatre portes ne le signalait. Elle s'écrit `export type BlockType =
  BlockNodeType;` [§3.9]. C'est une confirmation indépendante que la coupure désigne la bonne chose.

**Réversible dans un seul sens** : le flux de blocs peut se réélargir, les trois nœuds ne se
retirent plus.

---

### D3 — La cellule **nomme** sa colonne : ligne courte licite, cellule orpheline refusée

**Décision.** `TableCell { columnId, children }`. L'appariement colonne ↔ cellule est **par clé**,
jamais par position. Trois états sont refusés **au parse**, par un `superRefine` porté par
`TableNodeSchema` : deux colonnes de même `id`, une cellule nommant une colonne non déclarée, deux
cellules d'une même ligne pour la même colonne. Un état est **accepté** : une ligne qui remplit moins
de colonnes que le tableau n'en déclare.

**Pourquoi la clé.** Trois problèmes se règlent d'un coup, et le troisième est mécanique.

1. **La ligne courte devient une forme naturelle.** La dernière ligne d'une facture — un libellé et
   un montant — *est* une ligne courte. En positionnel, elle s'écrit avec trois cellules de
   remplissage vides que rien ne distingue d'un oubli.
2. **Réordonner les colonnes est une permutation d'un seul tableau**, au lieu de N permutations qui
   doivent toutes s'accorder dans le même ordre. Et « ajouter une colonne » redevient **une seule
   Command** (`AGENTS.md:296-301`), là où le positionnel en exigerait N+1 dont l'`undo` doit toutes
   défaire — le cas que `AGENTS.md:299-301` désigne comme « bugué de façon non déterministe ».
3. **Rien n'indexe jamais un tableau par l'index d'un autre.** Sous `noUncheckedIndexedAccess`,
   `columns[i]` rend `T | undefined`, et `!` est bloquant par Biome (AGENTS.md §1.1) : le positionnel
   imposerait une garde **à chaque appariement**, dans le moteur, dans le viewer et dans l'éditeur.

**Pourquoi l'asymétrie ligne courte / cellule orpheline.** Une ligne courte est une **intention
légitime**. Une cellule orpheline est du contenu que **rien n'affichera jamais** : l'auteur le voit
dans son JSON, il ne le verra dans aucun document. C'est une **perte silencieuse**, et c'est
précisément la classe de défaut que la doctrine de versionnement du dépôt existe pour empêcher
(AGENTS.md §1.2, « la perte silencieuse »). Deux cellules pour une même colonne sont refusées pour la
même raison : la seconde serait écartée.

**Pourquoi un `superRefine`, alors que ce serait le premier du dépôt.** Le contrôle est **local** —
un nœud, un niveau, aucune descente dans les cellules — là où la passe sémantique que l'ADR 0002
décision 2 a refusée exigeait toute l'ascendance d'un nœud. Il vit dans le schéma du seul nœud qui
voie les deux côtés. **MESURÉ :** `.superRefine()` laisse un `ZodObject` en zod 4 — les refinements
vivent **dans** le schéma plutôt qu'autour — donc `TableNodeSchema` reste membre légal des deux
unions discriminées, `lazy` comprises.

> ⚠️ **Correction d'un raisonnement faux, à ne pas recopier.** Une version antérieure des trois
> messages interpolait le contenu du modèle : « *This cell fills a column named `"${cell.columnId}"`,
> which the table does not declare* » et « *Two columns of this table share the id
> `"${column.id}"`* ». **C'est une violation directe de la règle que l'ADR 0003 écrit en toutes
> lettres** (`adr/0003:417`) : « **La charge d'erreur doit rester sûre à journaliser même quand le
> document ne l'est pas.** » `columnId` est un `z.string().min(1)` — longueur non bornée, contenu
> arbitraire, **choisi par l'auteur du modèle**, qui est l'attaquant du modèle de menace de ce
> dépôt — et la charge d'erreur voyage vers l'exploitant, vers le journal qu'exige E8 et vers la
> réponse HTTP de J5, trois endroits que le document n'atteint pas.
>
> **MESURÉ, et le dépôt était déjà unanime :** `grep -rn 'message:' packages/core/src --include=*.ts
> | grep '\${'` rend **zéro résultat** ; les deux seules interpolations du paquet sont des constantes
> composées à partir de bornes déclarées (`expression/schemas.ts:140-141`), jamais de données.
>
> **Les trois messages retenus sont donc CONSTANTS, et c'est le `path` qui désigne la faute** — il le
> fait déjà exactement, par exemple `['footer', 0, 'cells', 1, 'columnId']` :
>
> - « *This cell names a column the table does not declare. Add that column, or point the cell at one
>   of the declared ids.* »
> - « *Two columns of this table share an id. A cell names its column, so the ids have to be unique
>   within a table.* »
> - « *This row already fills this column. A row fills a column at most once.* »
>
> **L'affichage de l'identifiant fautif appartient à l'éditeur**, qui tient l'arbre et le lit au
> chemin fourni. C'est mot pour mot l'argument que l'ADR 0003 a employé pour le champ `at`, et il est
> à recopier dans l'ADR 0005.

> ⚠️ **Correction d'un raisonnement faux, à ne pas recopier — et celle-ci renverse une correction
> antérieure, ce qui est la seule occurrence du document.** La revue de contradiction a conclu que le
> garde de cascade de `checkTableWiring` — un `return` anticipé quand `declared.size === 0` — était
> **du code mort à supprimer**, sur l'énoncé suivant : « *Zod n'exécute pas le `superRefine` tant que
> le parse de base a échoué (mesuré) : C8 reçoit un message à la fois, et aucun garde de cascade
> n'est nécessaire.* » **Cet énoncé est faux, et la mesure qui le portait avait été prise contre un
> build qui contenait encore le garde** — c'est-à-dire contre le code même dont elle prétendait
> démontrer l'inutilité.
>
> **Ce que Zod 4 fait réellement, re-mesuré** (Node v24.11.1, `zod@3.25.76` importé via `zod/v4`) :
> un `superRefine` posé sur un `ZodObject` n'est sauté que sur une issue **abandonnante** —
> `invalid_type`, `invalid_value`. Les issues **continuables** — `too_small`, `too_big`, `custom` —
> le laissent tourner. Or `columns.min(1)` rend un `too_small` : **il n'arrête rien**, et
> `checkTableWiring` est appelé avec `table.columns` vide. Le protocole complet, son tableau de neuf
> entrées et le rejeu décisif — le `dist` dupliqué, les quatre lignes retirées de la copie, rien
> d'autre changé, **1 issue avec le garde et 13 sans** sur un tableau de douze cellules — vivent en
> [§5.1] et ne sont pas répétés ici.
>
> **Le garde reste donc dans le contrat.** Il perd seulement son second argument : la branche n'est
> pas « prouvablement inatteignable », elle est **atteinte à chaque tableau sans colonne**, donc
> couvrable, donc **testée** [§5.1]. Ce que la correction retirée avait raison de dire, et qui reste
> vrai : une largeur `1.5` — un `invalid_type` — masque bien toutes les fautes de câblage jusqu'à sa
> correction. La formule juste est : *un refus de type masque le câblage, un refus de borne ne le
> masque pas.*
>
> **La conséquence de D3 s'écrit ainsi :** le garde `declared.size === 0` est ce qui tient le compte
> à un message quand aucune colonne n'est déclarée, et un auteur qui a oublié ses colonnes a **une**
> chose à corriger, pas une par cellule. Cette dépendance au comportement de la bibliothèque rejoint
> « ce que le lot tient pour acquis » [§9], **à côté** de celle sur `.superRefine()` dans une union
> discriminée, et les deux sont à rejouer à chaque montée de zod — exactement ce que l'ADR 0004
> impose pour la règle nursery de Biome.

**Écarté.** (a) *L'appariement positionnel* (proposition 1) : la proposition l'admet elle-même comme
« la décision la moins réversible du lot » — y revenir demande un `columnId`, donc une migration
transformante de tous les tableaux écrits entre-temps — et comme un **défaut silencieux jusqu'à
C8**, qui est très loin, C8 dépendant de C1 à C7. (b) *L'appartenance, la colonne possédant ses
cellules* (proposition 3) : elle rend l'orphelin **inreprésentable**, ce qui est strictement mieux,
mais elle supprime la ligne — voir [§2, D2]. (c) *Tolérer une cellule orpheline en l'ignorant au
rendu* : perte silencieuse. (d) *Exiger qu'une ligne remplisse toutes les colonnes* : rendrait la
ligne de total verbeuse, et ferait de la **suppression** d'une colonne un refus au lieu d'une
simplification.

**Conséquences.**

- **« Supprimer une colonne » devient une Command composée** dans l'éditeur : retirer la colonne
  **et** ses cellules, sinon le modèle devient irrecevable au save time. C'est correct — un `undo`
  doit restaurer les deux.
- **`TableNodeSchema` est le premier schéma du dépôt à porter un `superRefine`**, et toute la
  propriété « zéro code d'erreur nouveau » [§2, D10] repose sur un comportement de zod, mesuré et à
  rejouer.
- **Le contrôle ne descend pas dans les cellules** : un tableau imbriqué valide ses propres lignes
  contre ses propres colonnes. Le coût est borné à un niveau, quelle que soit la profondeur.
- **Onze refus au save time**, chacun avec son chemin exact et **zéro code d'erreur nouveau** : le
  relevé complet, avec les messages mesurés, est en [§5.1].

**Irréversible.**

---

### D4 — L'en-tête est une **section de lignes** ; une colonne ne porte aucun libellé

**Décision.** `TableNode.header: readonly TableRowNode[]`. Un intitulé de colonne est le contenu
d'une cellule d'une ligne d'en-tête, exactement comme n'importe quel autre contenu. Une liste vide
est licite — c'est un tableau sans intitulé. Plusieurs lignes d'en-tête sont licites et gratuites.
`TableColumn` ne porte **ni** `label`, **ni** `header`.

**Pourquoi.** Trois raisons, la troisième est décisive et aucune des trois propositions ne l'avait
vue.

1. **`header` est un champ NOMMÉ, donc un consommateur n'a pas à deviner.** Ni « la première ligne »,
   ni un motif à reconnaître — « un conteneur portant une boucle portant des conteneurs » — qui
   exigerait une heuristique. Les propositions 1 et 3 obligeraient au contraire le moteur **et** le
   viewer à **fabriquer** une ligne d'en-tête à partir des colonnes, à l'identique : un accord non
   outillé entre deux implémentations, alors que la décision produit 7 (« identique au PDF,
   garanti », `README.md:55`) est précisément ce que V3 vérifie automatiquement
   (`viewer.md:71-85`).
2. **C7 peut marquer une ligne d'en-tête**, puisque c'est un nœud portant un id : « en-tête +
   première ligne insécables » redevient exprimable, ce qu'un enregistrement inerte interdirait.
3. **DÉCISIVE — zéro position de contenu nouvelle pour C6.** Comme une cellule contient des **blocs**
   [§2, D5], un libellé d'en-tête est un `TextNode` ordinaire. C6 ne branche donc son bilingue que
   sur `TextNode.content`, qu'il devait traiter de toute façon. Un `header: readonly TextSegment[]`
   sur la colonne créerait une **seconde** position de contenu, à traiter en C5 comme en C6, pour
   toujours.

> ⚠️ **Correction d'un raisonnement faux, à ne pas recopier.** Les docstrings du contrat
> **prescrivaient le comportement du moteur**. Sur `header` : « *Repeated page after page by the
> engine.* » Sur `TableNode` : « *it repeats `header` at the top of every page, it may cut `body`
> between two entries, and it keeps `footer` at the end of the flow* ». Sur `checkCells` : « *the
> columns it skips render empty* ».
>
> **Les trois sont hors périmètre, et le dépôt le dit à deux endroits.** `core.md:271-274` : la
> brique « **décrit**, elle ne **produit** rien : aucune page, aucun pixel, aucun PDF […] Si une
> question commence par "à quoi ça ressemble", elle appartient au moteur ou au viewer ». Et [§2, D13]
> refuse **nommément** `repeatHeaderOnEachPage`, la politique de veuve et d'orpheline, et le point de
> coupe. **On ne peut pas refuser le champ parce que le choix appartient au moteur *et* écrire dans
> le contrat ce que le moteur décidera** — ce serait la même règle, posée deux lignes plus bas et
> sans mécanisme, c'est-à-dire ce qu'AGENTS.md appelle « une règle non outillée ». Le grief est
> aggravé par le fait qu'une docstring de `packages/core` est **publiée** : `package.json` déclare
> `publishConfig.access: public` et `files: ["dist"]`, donc elle est émise telle quelle dans
> `dist/**/*.d.ts` — c'est l'argument exact que le plan C2 a employé pour sortir ses taux de
> fragilité de la docstring de `ROUND_MODES`.
>
> **Les rôles retenus sont strictement structurels** [§3.1] : `header` = « les lignes d'intitulé de
> colonnes, identifiées comme telles pour qu'un consommateur n'ait pas à les deviner » ; `body` =
> « les lignes de contenu, fixes ou répétées » ; `footer` = « les lignes de clôture » ; `checkCells`
> = « les colonnes qu'elle ne remplit pas ne reçoivent aucun contenu de cette ligne ».
>
> **Et l'attente envers E2 ne disparaît pas : elle change de véhicule.** Elle part dans l'ADR 0005,
> section « Conséquences », **qualifiée d'attente envers un lot non écrit** — un moteur qui voudra
> répéter l'en-tête trouvera un champ nommé plutôt qu'une heuristique. Une attente consignée dans une
> ADR est révisable par le lot qu'elle vise ; une phrase dans une docstring publiée ne l'est pas.

**Écarté.** (a) *`TableColumn.header: readonly TextSegment[]`* (propositions 1 et 3) : plus compact
de quelques octets, mais il interdit l'en-tête sur deux lignes, il interdit un picto dans un
en-tête, il crée une seconde position de contenu, et il impose l'accord non outillé du point (1).
(b) *`header: string`* : écarté par les **trois** propositions, et pour la même raison — C6 devrait
le remplacer par une forme riche, donc une migration transformante sur tous les modèles écrits
entre-temps. (c) *Un en-tête déduit du nom du champ de données* : réserve une convention de nommage,
refusé par périmètre (`AGENTS.md:31-32`, `designer.md:222` : « Elle ne connaît **aucun nom de champ
d'avance** »).

**Conséquences.** L'en-tête et le corps ont **une seule** représentation, donc C5, C6 et le moteur
n'ont qu'un cas à traiter au lieu de deux. Une ligne d'en-tête peut se désynchroniser des colonnes —
elle est validée exactement comme les autres par le `superRefine` de [§2, D3], et son chemin de refus
commence par `header`. Et `TableColumn` ne porte plus que **trois** champs, tous de géométrie : c'est
la réponse la plus nette possible au critère [§2, D1].

**Réversible dans un seul sens** : un libellé de colonne peut s'ajouter plus tard, en surcharge et
sans toucher à `header` ; retirer `header` d'un contrat stocké ne se fait plus.

---

### D5 — Une cellule contient des **blocs**, pas des segments

**Décision.** `TableCell.children: readonly BlockNode[]`. Une cellule peut donc contenir un
paragraphe, deux paragraphes, une image, une condition, une boucle liant son propre alias, et un
tableau imbriqué. **L'imbrication n'est pas refusée.**

**Pourquoi — et le choix se fait sur la RÉVERSIBILITÉ, pas sur l'expressivité.** Avec des segments
(proposition 2), l'imbrication devient impossible **par construction**, la profondeur du sous-arbre
est fixée, et E2 n'héritera jamais d'un tableau dans un tableau. C'est un contrat plus petit, et
c'est réellement un argument. Mais **élargir plus tard vers des blocs est une migration
TRANSFORMANTE** : il faudrait envelopper les segments de chaque cellule dans un nœud texte doté d'un
`id` **inventé**, donc fabriquer de l'identité que le document ne porte pas — et un `id` inventé par
une migration est un `id` que les Commands de l'éditeur et les marques de C7 adresseront ensuite. La
proposition 2 l'écrit elle-même comme son risque n°1 : « la première demande sera un logo, un QR code
ou une puce dans une cellule ». Avec des blocs, **aucune demande ne peut jamais exiger une migration
transformante** ; refuser l'imbrication plus tard serait un simple rétrécissement, et personne n'a
montré qu'il serait nécessaire.

**Et refuser l'imbrication d'un cran serait de toute façon une clôture avec une porte :** un
`container` placé dans la cellule en porterait un. Ce qui borne réellement l'imbrication existe
**déjà** et rend un refus **typé**. **MESURÉ** par bissection sur `assertBoundedShape` du dépôt
(Node v24.11.1, unité exacte du garde, racine = niveau 1) : **9** tableaux imbriqués les uns dans
les autres passent, **le 10ᵉ est refusé `too-deep`**. Un plafond nouveau serait un plafond qui ne
protège de rien [§2, D12].

**Le coût, chiffré, et il porte son étiquette exacte.** Un cran de conteneur de document coûte
**deux** niveaux JSON — l'objet, puis son tableau `children` — et la chaîne `table > row > cell`
en coûte donc six à elle seule — c'est l'écart mesuré entre une cellule de corps fixe (50) et un texte nu (56). Le choix des **blocs** plutôt que des segments, lui, n'ajoute que **deux** niveaux : l'objet de bloc et son tableau d'enfants [§8, arbitrage n° 3].

| Ce qui est mesuré | Niveaux JSON | Valeurs |
| :--- | ---: | ---: |
| Modèle de recette **complet** (titre + tableau, dans un `Template`) | **18** / 64 | **231** / 100 000 |
| **Nœud tableau seul** | **15** / 64 | **210** / 100 000 |

| Position d'un `round` imbriqué | Profondeur atteinte avant `too-deep` |
| :--- | ---: |
| Cellule d'une ligne portée par un `tableRowGroup` | **48** |
| Cellule d'une ligne de corps **fixe** | **50** |
| Sous un texte nu, hors tableau | **56** |

Les deux positions de cellule sont **également licites**, et c'est pour cela qu'un chiffre unique
serait trompeur : le groupe coûte deux niveaux JSON de plus que la ligne fixe. Dans les trois cas,
c'est le **garde de forme** qui refuse en premier, jamais `depth-limit-exceeded` de l'évaluation.

**Écarté.** (a) *`content: readonly TextSegment[]`* (proposition 2) : le coût du revirement est une
migration transformante, et il est **certain** plutôt qu'hypothétique — la demande est nommée par la
proposition elle-même. (b) *Une union de contenu de cellule excluant `table`* : la clôture avec une
porte, contournée par un `container`, et une règle non outillée n'est pas une règle.

**Conséquences.**

- **E2 hérite de la pagination d'un tableau imbriqué.** C'est le seul coût réel que la décision
  transfère à un lot non écrit, il est nommé ici et nulle part ailleurs, et il est remonté en [§8]
  arbitrage n°3 : si le propriétaire du produit juge ce risque inacceptable, c'est la proposition à
  segments qu'il faut rejouer, et il faut alors accepter par écrit qu'une cellule ne contiendra
  jamais qu'un run de texte.
- **Une cellule qui porte un `loop` lie un alias pour ses propres enfants.** Ce n'est **pas** un site
  de masquage supplémentaire au sens de [§2, D8] — c'est `LoopNode.as`, inchangé, dans une position
  nouvelle. Le mécanisme, la règle du plus interne et la limite consignée par `collectDataPaths` sont
  ceux de l'ADR 0002, mot pour mot.
- **La marge sous `DEFAULT_SHAPE_LIMITS` change de valeur, et le fichier qui l'annonce doit suivre.**
  `ShapeLimits.maxDepth` (`guard.ts:37-40`) écrit aujourd'hui « *Measured on a realistic model: 10
  levels, and 12 with an `aggregate(filter(...))`. 64 leaves a fivefold margin* ». Avec 18 niveaux, la
  marge devient **3,5×**, et le « modèle réaliste » du dépôt n'est plus celui-là. [§3.6] ne porte que
  cette docstring, sur le précédent exact de la §3.6 du plan C2.

**Réversible** — et c'est le motif de la décision, non son accident.

---

### D6 — La largeur est un POIDS entier, borné à `[1, 1000]`

**Décision.** `TableColumn.width: number`, **entier**, `MIN_COLUMN_WIDTH = 1`, `MAX_COLUMN_WIDTH = 1000`,
champ **requis**. Une colonne reçoit `width / Σ widths` de la largeur que le tableau se voit
attribuer, **quelle qu'elle soit**. Cinq entrées sont refusées au parse — le fractionnaire, le zéro,
le négatif, le non fini, le hors-fenêtre — et aucune ne l'est au rendu.

**Ce que l'unité mesure, et ce qu'elle ne mesure pas.** Un poids est délibérément **sans unité** :
une colonne de poids 3 à côté d'une colonne de poids 1 est trois fois plus large, et c'est tout ce
que le champ dit. Il n'existe aucun dénominateur dans le contrat : `Σ widths` est la somme des poids
**du tableau**, jamais une quantité de papier.

> ⚠️ **Correction d'un raisonnement faux, à ne pas recopier.** Une version antérieure de la
> docstring de `TableColumn.width` écrivait : « *A column's share is `width / (sum of the widths of
> its table)` **of the width the page leaves available*** ». La seconde moitié est un décret
> d'apparence déguisé en définition : elle affirme qu'un tableau occupe **toujours 100 %** de la
> largeur utile, ce qui est une décision de mise en page (C5) appuyée sur une géométrie de feuille
> (C4) — deux lots que C3 ne peut ni lire ni préempter, et dont aucun n'existe.
>
> **L'énoncé juste est un pur rapport inter-colonnes :** une colonne reçoit `width / Σ widths` de la
> largeur que le tableau se voit attribuer. La preuve d'exactitude ci-dessous n'en souffre pas d'une
> ligne — elle ne porte que sur le rapport, jamais sur ce qu'on multiplie par lui.
>
> **Conséquence à écrire, et à ne pas laisser deviner : la largeur du tableau lui-même n'est pas
> déclarée par C3.** Aucun champ de ce lot ne dit ce que le tableau occupe. La question appartient à
> C4 (`core.md:163-172` : format, orientation, marges) et à C5 (`core.md:174-184`), et **ni l'un ni
> l'autre ne l'a tranchée aujourd'hui**. Un lecteur pressé lirait dans `width` une promesse de pleine
> largeur ; le contrat n'en fait aucune.

**Pourquoi ni millimètre, ni pourcentage, ni `auto`.** Le millimètre est refusé deux fois plutôt
qu'une : la géométrie de la feuille est le périmètre annoncé de C4, et le positionnement libre au
millimètre est hors périmètre v1 — une longueur absolue ici dupliquerait le premier et
réintroduirait le second. Le pourcentage n'a de sens que si les valeurs somment à cent, donc de deux
choses l'une : ou le contrat police cette somme, ce qui est une **règle** et un refus que personne
n'a demandé, ou ajouter une sixième colonne invalide les cinq autres. `auto` — une largeur mesurée
sur le contenu — exige des métriques de police, c'est-à-dire **lire la machine**, ce que le dépôt
outille comme interdit dans `core` et `engine` (`biome.jsonc:198-199`) ; et il déplacerait la
garantie « identique au PDF » du contrat vers un accord entre deux moteurs de mise en page.

Le poids, lui, normalise totalement, n'impose aucune règle de somme, et survit à un changement de
format de papier sans une seule édition du tableau. Il n'enlève par ailleurs **aucune
expressivité** : tout rapport rationnel s'écrit en montant l'échelle, `[2, 3]` et `[200, 300]`
décrivant la même géométrie.

**Pourquoi l'entier — et la borne haute porte la preuve, elle n'est pas un jugement de goût.** Avec
des poids entiers, `Σ widths` est **exacte** en binary64, donc la part d'une colonne est **une
division correctement arrondie** : le même nombre dans l'aperçu à l'écran et dans le PDF, sur tout
moteur conforme. C'est l'unique manière trouvée d'adosser la décision produit 7 à une propriété
démontrable plutôt qu'à un accord d'implémentation. Un poids réel strictement positif perd tout
cela : `Σ` dépend alors de l'ordre de sommation, et la garantie redevient une approximation.

Reste à montrer que `Σ` ne peut pas sortir de l'exact. C'est là que la version précédente de cette
preuve se trompait, trois fois dans une seule phrase.

> ⚠️ **Correction d'un raisonnement faux, à ne pas recopier.** Énoncé retiré, de la docstring de
> `MAX_COLUMN_WIDTH` : « *`assertBoundedShape` caps a stored template at `maxNodes` values, so a
> table carries at most 100 000 columns, and `100_000 * 1_000 = 1e8 < 2**53`* ». Trois erreurs
> emboîtées.
>
> 1. **`maxNodes` n'est pas une borne du contrat, c'est un défaut.** `parseTemplate(raw, migrations?, limits?)`
>    accepte un override, validé par `shapeLimitsSchema` (`guard.ts:62`), lui-même bâti sur le
>    `limitSchema` de l'évaluation (`limits.ts:111`) : la vraie borne est
>    `LIMIT_HARD_CEILING = 1_000_000_000` (`limits.ts:109`). Écrire la preuve sur `100_000` la fait
>    dépendre d'un chiffre qu'un appelant change en un argument.
> 2. **Le garde compte des VALEURS, pas des colonnes.** `guard.ts:43-47` : une valeur par élément de
>    tableau et une par propriété propre. Une colonne `{ id, width, align }` en coûte donc
>    **quatre** — trois propriétés plus l'élément qui la porte. **Mesuré** par bissection (bac à
>    sable, Node v24.11.1, `assertBoundedShape` du dépôt, `DEFAULT_SHAPE_LIMITS` inchangé) :
>    **24 998** colonnes sont acceptées sous le défaut, la **24 999ᵉ** est refusée. Le chiffre
>    « 100 000 colonnes » est faux d'un facteur quatre, et il **disparaît de tout le plan**.
> 3. **`TableNodeSchema` n'applique aucun garde.** Le barrel l'exporte pour l'intégrateur qui valide
>    un sous-arbre avant de le stocker [§3.8] ; `.parse` ne passe pas par `assertBoundedShape`.
>    **Mesuré** : `TableNodeSchema.parse` accepte un tableau de **250 000** colonnes. Une preuve
>    adossée au garde ne couvre donc pas la porte que le lot ouvre lui-même.
>
> **La preuve de remplacement, en trois lignes, et elle couvre les deux chemins.**
>
> - **Sous le garde** — `shapeLimitsSchema` plafonne `maxNodes` à `LIMIT_HARD_CEILING = 10⁹`
>   (`limits.ts:109-111`, importé plutôt que recopié, `guard.ts:57-62`). Une colonne pesant quatre
>   valeurs, un tableau en porte au plus 2,5·10⁸, donc `Σ ≤ 2,5·10⁸ × 10³ = 2,5·10¹¹`, très en
>   dessous de `2⁵³ ≈ 9,01·10¹⁵`.
> - **Hors du garde** — la longueur maximale d'un tableau JavaScript est `2³²−1 ≈ 4,29·10⁹`, donc
>   `Σ ≤ 4,29·10⁹ × 10³ ≈ 4,3·10¹² < 2⁵³`. **La somme reste exacte dans tous les cas
>   représentables**, garde ou pas.
> - **Et l'exactitude ne dépend donc PAS du défaut `maxNodes`.** C'est à écrire dans la section
>   « ce que cette décision tient pour acquis » de l'ADR 0005 : sans cette phrase, un relèvement de
>   `DEFAULT_SHAPE_LIMITS` par E8 aurait l'air d'invalider la preuve, alors qu'aucune valeur
>   admissible de `maxNodes` ne le peut.

**Les cinq entrées refusées, et les QUATRE messages.** Une version antérieure annonçait que « **les
cinq refus rendent cinq messages lisibles** » : c'est un décompte faux, et il aurait produit deux
`it` épinglant la même chaîne. **Mesuré** dans le bac à sable, `TableColumnSchema.safeParse` sur une
colonne par ailleurs valide :

| Entrée refusée | Valeur d'épreuve | Code Zod | Message mesuré |
| :--- | :--- | :--- | :--- |
| le fractionnaire | `1.5` | `invalid_type` | `A column width is a whole number of weight units, not a length` |
| le zéro | `0` | `too_small` | `A column width may not go below 1` |
| le négatif | `-3` | `too_small` | `A column width may not go below 1` |
| le non fini | `Infinity`, `NaN` | `invalid_type` | `A column width is a finite whole number of weight units` |
| le hors-fenêtre | `1001` | `too_big` | `A column width may not exceed 1000` |

Trois remarques que le tableau seul ne dit pas. **Le zéro et le négatif rendent le même message**,
parce que ce sont la même faute contre la même borne : le test de refus épingle donc **quatre**
chaînes, et [§5.1] le compte ainsi. **Le fractionnaire et le non fini partagent le code
`invalid_type` et diffèrent par le message** — le premier vient de `.int()`, le second du
`z.number({ error })` lui-même, `z.number()` n'acceptant que le fini, ce qui rend un `.finite()`
sans effet ; épingler le code plutôt que le message ne distinguerait donc pas les deux. Enfin les
deux messages de bornes **interpolent `MIN_COLUMN_WIDTH` et `MAX_COLUMN_WIDTH`**, qui sont des
constantes de module et non du contenu de document : la règle de l'ADR 0003 — « la charge d'erreur
doit rester sûre à journaliser même quand le document ne l'est pas » (`0003:417`) — n'est pas
entamée, et [§3.2] dit pourquoi elle l'aurait été pour `columnId`.

**Écarté.** (a) Un poids **réel** strictement positif : `Σ` dépend de l'ordre de sommation, la part
n'est plus exacte, et la garantie aperçu/PDF redevient un accord entre implémentations.
(b) Le **pourcentage** : contrainte de somme invalidable par tout ajout de colonne, et un refus
impossible à écrire, puisque les colonnes se valident une par une. (c) Les **millimètres** : hors
périmètre v1, et duplique C4. (d) **`auto`** : lecture d'environnement, outillée comme interdite.
(e) Une union discriminée `{ kind: 'weight' | 'mm' | 'auto' }` « pour garder la porte ouverte » :
une union à un seul membre habité est exactement la cérémonie que la règle anti-sur-ingénierie
nomme, et l'élargir plus tard n'est qu'un ajout de membre.

**Conséquences.** *(1)* **Ce n'est pas un cinquième rétrécissement de valeur** : aucun document v3
ne peut porter une largeur, donc rien de valide auparavant ne devient invalide — exactement
l'argument que la migration 2 → 3 a écrit pour la fenêtre `decimals`, et la raison pour laquelle
[§9] ne charge pas l'hypothèse pré-v1.0 d'une cinquième dette. *(2)* **Le contrat ne dit pas ce qui
arrive quand le contenu d'une cellule dépasse la part reçue** — rognage, retour à la ligne,
débordement. C'est une question de moteur, tranchée en E1/E2, et il faut l'écrire, parce qu'un
lecteur pressé croirait que `width` y répond. *(3)* **Signal de réouverture nommé** : une demande
citant un rapport plus fin que 1:1000, ou une largeur physique imposée par un gabarit préimprimé ou
un lecteur optique — auquel cas c'est **l'unité** qu'il faut rouvrir, pas la borne [§8, arbitrage
n°6].

**Réversible dans le sens de l'élargissement uniquement.** Élever `MAX_COLUMN_WIDTH` n'invalide
aucun modèle stocké et la preuve tient encore à 10 000 (`10⁴ × 2,5·10⁸ = 2,5·10¹² < 2⁵³`) ;
l'abaisser n'a aucune migration ; changer l'unité est transformant.

---

### D7 — L'alignement est `start | center | end`, par colonne, et il appartient à C3

**Décision.** `TABLE_COLUMN_ALIGNMENTS = ['start', 'center', 'end'] as const`, une valeur
**obligatoire** par colonne, héritée par toutes ses cellules. Aucun `justify`, aucune surcharge par
cellule. La coupure avec C5 : **C3 possède l'alignement DE COLONNE ; C5 possède l'alignement de bloc
et, s'il le décide, la surcharge de cellule qu'il ajoutera lui-même.**

**Pourquoi le champ est dans C3, alors que le critère D1 ne le donne pas.** Il faut le dire dans cet
ordre, parce que l'inverse serait une pétition de principe. Le critère d'appartenance [§2, D1] pose
en condition (2) qu'un attribut de colonne doit être **inexprimable hors d'une colonne** ;
`align` **échoue** à ce test, et il échoue exactement comme la police ou le filet : un alignement
s'écrit sur n'importe quel bloc, et C5 l'y définira. `align` est donc une **exception nommée**, pas
une conséquence du critère — et une exception qui ne se justifie pas la nomme mal.

Les deux arguments qui la justifient sont mécaniques, pas esthétiques. *Premièrement*, la roadmap
écrit « un alignement **par colonne** » dans le libellé même de C3 (`core.md:153-154`), et
« libellés à gauche, montants à droite » est le seul exemple qu'elle donne du lot. *Deuxièmement*,
C5 déclare « **Dépend de : C3** » (`core.md:184`) : une propriété dont le critère de recette de C3 a
besoin ne peut pas vivre dans le lot qui vient après, sous peine de rendre ce critère indémontrable.
Le recouvrement entre `core.md:153-154` et `core.md:179` (« alignements » dans le périmètre de C5)
n'est arbitré par **aucun texte du dépôt** : C3 l'arbitre, c'est une décision et non une lecture, et
elle est remontée telle quelle [§8, arbitrage n°2].

**Pourquoi `start`/`end` plutôt que `left`/`right` — et le motif n'est pas celui qui était écrit.**

> ⚠️ **Correction d'un raisonnement faux, à ne pas recopier.** Énoncés retirés, de la docstring de
> `TABLE_COLUMN_ALIGNMENTS` : « *`start | center | end` rather than `left | center | right`, and
> **the reason is lot C6 rather than taste*** » et « *Nothing is resolved here — **resolution
> belongs to whoever knows the direction**, which is never this package* ». Les deux phrases
> attribuent la direction d'écriture à un propriétaire. Il n'y en a pas.
>
> **Mesuré le 2026-08-16, sur l'arbre de travail du dépôt (HEAD `dab869f`)** — c'est la **sonde RTL
> canonique**, et c'est la seule forme à recopier, ici comme dans l'ADR 0005 :
>
> ```bash
> git grep -niE 'rtl|droite à gauche|right-to-left|direction d.écriture|writing direction|bidi' -- docs packages README.md ARCHITECTURE.md AGENTS.md ':!docs/plans/*'
> ```
>
> → **zéro occurrence**. Et le périmètre écrit de C6 (`core.md:186-196`) énumère les montants, les
> dates, les séparateurs de milliers, la position du symbole monétaire et les libellés fixes — **pas
> la direction**. Faire dire à C6 qu'il la possède, c'est inventer une dépendance et la léguer à un
> lot qui la découvrirait en la subissant.
>
> > ⚠️ **Deux défauts de la commande initiale, corrigés ici, et le second est le plus vicieux.**
> >
> > **(a) Elle était écrite `grep -rni`, sans `-E`.** En expression rationnelle *basique*, `|` est un
> > caractère **littéral** : la commande cherchait la chaîne
> > `rtl|droite à gauche|…|bidi` prise d'un bloc, et non six alternatives. **Mesuré aujourd'hui**,
> > cette forme rend **3** résultats — les trois endroits où *ce plan* écrit la commande. Une sonde
> > dont le « zéro » ne prouve rien est pire qu'une sonde absente : elle donne une confiance qu'elle
> > n'a pas gagnée. Le motif de D7 tient malgré tout, parce que la forme `-E` a bien été jouée ; mais
> > la forme **publiée** ne l'était pas, et c'est elle qu'on recopie.
> >
> > **(b) Elle est AUTO-FALSIFIANTE une fois ce plan commité.** Ce fichier vit dans `docs/` et écrit
> > les six termes une vingtaine de fois. **Mesuré** : la forme `-rniE` non scopée rend **18**
> > occurrences, **toutes** dans `docs/plans/c3-tableau-de-lignes.md`. Un relecteur qui rejouerait la
> > sonde depuis l'ADR conclurait que la mesure est fausse, et il aurait raison de le conclure de ce
> > qu'il voit. D'où `git grep` — qui ignore `node_modules` par construction — et le pathspec
> > d'exclusion `':!docs/plans/*'`, qui rend **0** aujourd'hui **et** après le commit du plan. C'est
> > exactement ce que la [§6.4] exige d'un critère : une commande dont la sortie attendue est vraie
> > sur un dépôt sain, avant comme après le lot.
>
> **La formulation juste, et elle suffit : C3 DIFFÈRE la résolution, et n'a aucune information pour
> la trancher.** `start` ne demande à personne de résoudre quoi que ce soit *aujourd'hui* ; il
> enregistre une intention relative au lieu d'une position absolue. C'est tout ce que le lot peut
> honnêtement affirmer.
>
> **Trois gestes suivent.** *(1)* La question « **qui déclare la direction d'écriture d'un
> document ?** » entre dans « Ce qui reste ouvert » de l'ADR 0005 avec ses options — une déclaration
> de **modèle** rattachée à C6 ; une entrée du `RenderRequest` ; rien du tout, et un défaut de
> moteur — et **sans recommandation**, sur le patron exact de la question d'échelle d'affichage
> léguée par l'ADR 0004. *(2)* L'interdit qui, lui, tient déjà y est écrit à côté : **aucun moteur ne
> dérive cette direction de la machine.** C'est E6 (`engine.md:107-110`, « le moteur ne lit ni
> l'horloge, ni le fuseau, ni la locale de la machine »), et c'est outillé par Biome dans `core` et
> `engine` — `toLocale*`, `Intl.$f()` sans argument, `Intl.DateTimeFormat` sans `timeZone` littéral
> (`biome.jsonc:198-199` et `:272-290`, `tools/biome/no-environment-read.grit:59-72`). La direction
> ne sera donc jamais devinée ; elle sera déclarée par quelqu'un, ou elle aura un défaut écrit.
> *(3)* L'arbitrage n°5 [§8] porte cette information nouvelle : sa recommandation initiale reposait
> sur la prémisse « le moteur résout contre la direction d'écriture », qui suppose une direction
> déclarée quelque part.

**Ce qui reste de l'argument, une fois la prémisse fausse retirée, et il est suffisant.** Il est de
**réversibilité**, et il s'énonce sans savoir qui possède la direction. Stocker `left` inscrit dans
le document une décision de direction que son auteur n'a peut-être pas prise ; y revenir plus tard
coûterait une migration **transformante** *et* **sémantiquement indécidable** — réécrire `left` en
`start` suppose de savoir si l'auteur voulait « gauche » ou « début », et rien dans le document ne
le dit. Stocker `start` ne coûte rien aujourd'hui : là où la direction est gauche-droite, `start`
**est** `left`, et la valeur reste juste quoi qu'on décide ensuite. Le choix se fait donc entre un
revirement possible et un revirement impossible, pas entre deux étiquettes.

**Trois membres, et pas de `justify`.** La justification étire l'espace inter-mot : c'est de la
typographie, donc C5 — et elle n'a aucun sens sur le montant d'une ligne.

**Écarté.** (a) `left | center | right` : voir ci-dessus ; l'argument de lisibilité pour un
utilisateur non développeur est réel, mais c'est un problème d'**étiquette dans l'éditeur** (D6 du
designer), pas de contrat stocké. (b) Reporter tout l'alignement à C5 : contredit le libellé du lot
et la chaîne de dépendances, et rend « libellés à gauche, montants à droite » indémontrable en C3.
(c) Ajouter `justify` : typographie. (d) Une surcharge `align?` par cellule, écrite dès maintenant :
c'est de l'alignement de bloc, il appartient à C5, et un champ optionnel posé par anticipation ne se
retire qu'avec une migration transformante — alors que l'ajouter plus tard n'est qu'un
élargissement. (e) Un alignement **déduit du type de la valeur** (« les nombres à droite ») : c'est
une **règle**, et elle ferait dépendre la mise en page du jeu de données de l'intégrateur, contre la
règle de périmètre.

**Conséquences.** *(1)* **Le vocabulaire `start`/`end` est exposé dans le barrel** [§3.8] : c'est un
choix public, pas un détail d'implémentation. *(2)* Si C5 décide d'une surcharge par cellule, il
devra l'**ajouter en surcharge** sans toucher au champ de colonne — l'autre voie serait
transformante. *(3)* Le champ est **requis**, donc aucune colonne ne porte d'alignement implicite,
et rien n'a à résoudre un `undefined`. *(4)* Le champ est l'un des quatre sites que la porte 3
protège contre une dérive entre l'interface et le schéma : **mesuré**, retirer `align` du schéma
casse **quatre** sites — TS6133 sur l'import devenu inutile, deux TS2375 sur les annotations
`z.ZodType`, TS2345 sur `checkTableWiring` — plus l'assertion `MutuallyAssignable` de [§5.2], qui
n'est pas tautologique parce que `TableColumnSchema` ne porte pas d'annotation.

**Réversible dans le sens de l'élargissement du jeu de valeurs uniquement.** Ajouter un membre est
un ajout ; renommer `start` en `left` est transformant et indécidable, donc, dans les faits,
irréversible. *Signal de réouverture : une décision produit qui exclurait le RTL du périmètre à
jamais* — auquel cas `left | right` redeviendrait défendable, et l'arbitrage n°5 se refermerait.

---

### D8 — La répétition vit sur `tableRowGroup` : quatrième site d'alias, déclaré et non escamoté

**Décision.** `TableRowGroupNode { each: Expression; as: string; rows: readonly TableRowNode[] }`,
`as` validé par le même `aliasSchema` que `LoopNode.as` (`identifiers.ts:50-55`), `rows` d'au moins
une entrée. Côté parcours : `nodeReads(table)` ne lit rien et ne lie rien ;
`nodeReads(group) = { reads: [each], binds: as }` ; `nodeReads(row) = NO_READS`. Et la docstring de
`collectDataPaths` gagne sa **quatrième limite dans le même incrément** [§4, INC-1].

**L'argument central est la mécanique de `collectFrom`, et elle tient en dix lignes.** Le voici tel
qu'il est écrit aujourd'hui, `visitor.ts:210-220` :

```ts
function collectFrom(node: DocumentNode, aliases: ReadonlySet<string>, into: Set<string>): void {
  const { reads, binds } = nodeReads(node);
  for (const expression of reads) {
    addCallerPaths(expression, aliases, into);          // portée ENGLOBANTE
  }
  const inner = binds === undefined ? aliases : new Set(aliases).add(binds);
  for (const child of childrenOf(node)) {
    collectFrom(child, inner, into);                    // portée ENFANT, alias ajouté
  }
}
```

**Il n'y a que deux seaux, et il n'y en aura pas un troisième.** `reads` est collecté dans la portée
**englobante**, c'est-à-dire *avant* que `binds` n'entre en scène — `visitor.ts:124` l'écrit dans le
type lui-même : « *Evaluated in the node's ENCLOSING scope, before `NodeReads.binds`* ». `childrenOf`
est descendu avec l'alias **ajouté**. Il n'existe aucun troisième seau pour « des expressions
évaluées sous l'alias mais qui ne sont pas des nœuds enfants ».

Deux conséquences dures en découlent, et elles commandent la forme du nœud.

**(a) Un nœud ne peut pas à la fois lier une liste et porter ce qui ne doit pas la voir.** Si le
tableau portait `each`/`as`, l'alias de ligne serait en portée pour **tout** ce que `childrenOf(table)`
rend — donc pour l'en-tête et pour le pied. Une lecture `ligne.montant` écrite dans une cellule de
pied serait alors filtrée par `addCallerPaths` comme référence interne (`visitor.ts:179-200`), et
`collectDataPaths` **cesserait en silence de réclamer à l'intégrateur une clé que le document lit
réellement**. C'est mot pour mot le défaut que l'ADR 0002 a corrigé pour les boucles, réintroduit par
le tableau. Il faut donc **deux nœuds** : celui qui lie, et celui qui ne lie pas.

**(b) Toute expression de cellule évaluée sous l'alias doit être atteignable par `childrenOf`, en
tant que `DocumentNode`.** C'est ce qui condamne la forme « plate » — un tableau qui rangerait les
expressions de ses cellules directement sur lui-même, par exemple `columns[i].cell: Expression` :
elles ne pourraient aller que dans `reads`, où elles seraient collectées **sans** l'alias en portée,
et `collectDataPaths` réclamerait `ligne.designation` à l'appelant. Ce n'est pas un argument de
profondeur — le modèle le plus lourd que le critère de recette produise consomme 18 niveaux sur 64 [§2, D12] — c'est un argument de
correction, et c'est le seul qui tranche entre les trois formes de tableau examinées.

**Mesuré**, sur le modèle du critère de recette [§6.2] : `collectDataPaths` rend exactement
`['facture.numero', 'facture.lignes']`. Aucun `ligne.*`, aucun `l.*`, et un alias de groupe utilisé
**hors** de son groupe redevient bien une clé d'appelant — la garantie de l'ADR 0002 tient, et
[§5.3] l'épingle.

**Pourquoi pas un `LoopNode` réutilisé, ni un `each` sur le tableau.** La première voie n'est pas
disponible : avec la coupure `BlockNode` [§2, D2], `LoopNode.children` est une liste de **blocs**, et
une ligne n'est pas un bloc — `loop > tableRow` est **inexprimable**, pas seulement déconseillé. Sans
la coupure, elle laisserait `table > loop > text` représentable et indéfini. La seconde voie, `each`
et `as` portés par le tableau, est celle que le (a) ci-dessus condamne, et elle coûte en plus une
capacité : un tableau ne pourrait plus répéter qu'**une** liste, donc ni ligne fixe intercalée, ni
groupement par famille avec une ligne d'intitulé entre deux groupes.

**Aucun mécanisme nouveau — et la formule exacte compte.** La forme retenue est celle que le dépôt
écrit déjà deux fois : `each`/`as` comme la boucle, `source`/`as` comme l'agrégation, ce que l'ADR
0003 revendique comme un résultat et non une coïncidence. L'éditeur réutilise donc le widget de
boucle, et l'évaluation réutilise `evaluateSequence` et `childScope` **sans les modifier** : aucun
second primitif de portée, aucun nom réservé, **aucun mécanisme de masquage nouveau**. Ce qui serait
faux, c'est d'écrire « aucun masquage nouveau » : c'est un **quatrième site** où un alias peut
masquer une clé d'appelant, après `LoopNode.as`, `AggregateExpression.as` et `FilterExpression.as`,
et un site de plus s'écrit.

**La quatrième limite de la docstring, et pourquoi elle est due dans le même commit.** La docstring
de `collectDataPaths` **compte à voix haute** : `visitor.ts:230-231` dit aujourd'hui « *THREE limits,
all deliberate, and all narrower than an earlier version of this docstring claimed* ». Le mot
`THREE` est porteur : le laisser après C3 referait exactement ce que l'ADR 0002 reproche à l'ancienne
docstring — *elle promet, et elle ment*. Le texte à ajouter, avant la section « What is NOT a
limit », dit trois choses et pas une de plus : le site est le même mécanisme une quatrième fois ; le
masquage y est lexical, le plus interne gagne ; et **le trou ne s'élargit pas** — un groupe lie sur
ses propres `rows` et sur rien d'autre, si bien qu'un intitulé d'en-tête ou un total de pied nommant
l'alias reste une clé d'appelant et continue d'être réclamé à l'intégrateur. Le fichier est déjà dans
la liste d'INC-1 pour les trois `case` du Visitor : la docstring y entre avec eux [§3.4].

**Écarté.** (a) `TableNode.each` / `TableNode.as` : l'alias fuit sur l'en-tête et le pied, et le
tableau perd le corps mixte. (b) Un `LoopNode` autour d'un `tableRow` : rendu inexprimable par la
coupure `BlockNode`. (c) `row: TableRowNode` au **singulier** : une ligne de détail suivie d'une
sous-ligne de description par article est un motif courant, le pluriel est la forme que le dépôt
écrit déjà (`children`, `rows`), et passer du singulier au pluriel plus tard serait transformant.

**Conséquences.** *(1)* **`NodeReads.binds` reste UN seul nom.** L'élargir en liste ferait fuiter
l'alias d'une expression vers des enfants qui n'ont pas à le lire — `visitor.ts:250-256` l'écrit déjà,
et C3 n'apporte aucune raison de rouvrir. *(2)* Un tableau peut **mêler lignes fixes et groupes
répétés** dans son corps, donc grouper par famille avec une ligne d'intitulé entre deux groupes ;
c'est la capacité que la forme à une seule répétition supprimait. *(3)* `childrenOf` rend les rangs
d'un groupe tels qu'ils sont stockés — mais c'est **l'exception, pas la règle** : seules **quatre**
de ses huit branches rendent la référence stockée, les quatre autres allouent, feuilles comprises.
Voir [§3.4], qui dit lesquelles et ce qu'un consommateur ne doit donc pas mémoïser. *(4)* Le nœud est le seul du lot qui
**évalue** quelque chose : c'est lui, et non le tableau, qui donne son nom au site d'erreur
[§2, D10] et au libellé `A table body`.

**Réversible dans un seul sens.** La porte ouverte est l'ajout : rien n'interdit un second type de
groupe plus tard. Le retrait, lui, ne se fait plus — un type de nœud stocké ne se retire qu'avec une
migration transformante.

---

### D9 — Le pied ne contient aucune agrégation : le TYPE dit que le tableau ne somme rien

**Décision.** `TableNode.footer: readonly TableRowNode[]`. Aucun `TableRowGroupNode` dans le pied,
donc **aucun `each` de lignes, aucun alias de ligne, et surtout aucun champ d'agrégation — le nœud
tableau n'a nulle part où en poser un**. Ni `TableColumn.total`, ni `TableNode.footer: 'sum'`, ni
`aggregate` porté par la structure. La dernière ligne d'une facture est une ligne dont une cellule
porte `round(sum(...), d, m)`, **écrit par l'auteur du modèle**.

**La contrainte vient de C2, et elle est citée intégralement plutôt que résumée.** Le plan C2
l'énonce à `docs/plans/c2-arrondis-declares-par-le-modele.md:186-193`, verbatim :

> **« C4 (la page) ou C3 ne dépendent de rien non plus : autant les faire d'abord. »** C4 et C3 ne
> débloquent aucun lot en aval — mais **C3 hérite d'une contrainte que ce plan doit lui transmettre**,
> écrite ici et reprise dans l'ADR 0004 : la dernière ligne d'un tableau C3 est « une somme de ce qui
> précède » (`docs/roadmap/core.md`, lot C3), et c'est le premier endroit où la seconde moitié du
> critère de C2 rencontrera un document réel. Cette somme est une **expression du modèle**,
> `round(sum(...), d, m)`, jamais un total calculé par le tableau : un tableau qui sommerait ses
> propres colonnes réintroduirait l'arrondi implicite que D8 refuse, et le ferait **hors de l'arbre**,
> là où aucun relecteur ne le verrait.

Et l'ADR 0004, section « Conséquences »,
`docs/adr/0004-les-arrondis-declares-par-le-modele.md:784-788`, verbatim :

> **Pour C3 (le tableau de lignes).** La dernière ligne d'un tableau est « une somme de ce qui
> précède ». Cette somme est une **expression du modèle**, `round(sum(...), d, m)`, **jamais un total
> calculé par le tableau** : un tableau qui sommerait ses propres colonnes réintroduirait l'arrondi
> implicite que la décision 8 refuse, et le ferait **hors de l'arbre**, là où aucun relecteur ne le
> verrait.

*(La première phrase de la citation C2 — « C4 et C3 ne débloquent aucun lot en aval » — est fausse :
`core.md:184` fait dépendre C5 de C3. Elle est citée parce qu'on ne tronque pas une contrainte
transmise, et [§4, INC-5] la nomme comme une phrase à ne pas recopier dans l'ADR 0005.)*

**Ce que C3 en fait : un refus STRUCTUREL plutôt que documentaire.** Les trois promesses de la
décision 8 de l'ADR 0004 tiennent exactement à ce que le calcul soit **dans** l'arbre : il est
visible pour un relecteur, la barre de formule de D7 montre ce qui est calculé, et un refus désigne
un nœud. Un champ `total` sur la colonne les casse toutes les trois d'un coup. Le choix du contrat
est de rendre le refus **impossible à contourner et impossible à recopier de travers** : un refus qui
est l'**absence d'un champ** ne se négocie pas. Le précédent existe déjà dans le dépôt, et il est
volontaire : au playground, le nœud texte « total » est le **frère** de la boucle et non son enfant
(`App.tsx:445-454`).

**Pourquoi une section nommée plutôt qu'aucune section du tout.**

> ⚠️ **Correction d'un raisonnement faux, à ne pas recopier.** Une version antérieure justifiait le
> pied contre l'alternative « pas de section pied du tout, la dernière ligne étant une ligne de
> corps » en écrivant que « **le moteur ne saurait pas qu'elle doit rester en fin de flux** ». C'est
> de la **pagination**, donc du comportement de moteur — et D13 refuse nommément la répétition
> d'en-tête, la politique de veuve et d'orpheline et le point de coupe *au motif que le choix
> appartient au moteur*. On ne peut pas refuser le champ parce que la décision est au moteur **et**
> écrire dans le contrat ce que le moteur décidera : `core.md:271-274` dit que la brique **décrit**,
> elle ne **produit** rien.
>
> **Le motif juste est le seul qui appartienne à C3 : `footer` est la section dont le TYPE interdit
> d'agréger.** `body` est une liste de `TableBodyNode`, union à deux membres dont l'un porte `each` et
> `as` ; `footer` est une liste de `TableRowNode`, et rien d'autre. Sans section nommée, la place où
> vit un total serait une position parmi les entrées de `body`, indiscernable dans le type d'une
> entrée répétée — et la propriété « la clôture du tableau n'itère pas et ne lie pas » redeviendrait
> une phrase de docstring, c'est-à-dire une phrase qu'un champ ajouté plus tard démentirait sans que
> rien ne rougisse. La section nommée est ce qui fait de cette propriété un **type**.
>
> Ce que C3 attend d'E2 et d'E3 — qu'un pied reste en fin de flux, qu'un en-tête se répète — est une
> **attente envers un lot non écrit**, et elle part dans la section « Conséquences » de l'ADR 0005,
> qualifiée comme telle. Elle ne s'écrit pas dans une docstring publiée.

**Et « fixe » est le mot faux : ce que le pied refuse, c'est un CHAMP.**

> ⚠️ **Correction d'un raisonnement faux, à ne pas recopier.** Énoncé retiré, de la docstring de
> `TableNode` : « *`footer` holds **fixed rows only**: no `each`, no alias, nowhere to put one* ».
> C'est D5 qui le rend faux : une cellule contient des `BlockNode[]`, et `LoopNode ∈ BlockNode`.
> **Mesuré** dans le bac à sable : un `footer` dont une cellule porte un `loop` avec son `each` et
> son `as` **parse** — `TableNodeSchema.safeParse` rend `success: true`. Écrire « fixe » promet une
> propriété que le schéma n'a pas, et le premier auteur qui écrira ce `loop` découvrira que le
> contrat ment.
>
> **La formulation juste, et elle est plus précise, pas plus faible :** `footer` n'accepte que des
> `TableRowNode` — donc **aucune répétition de LIGNES**, aucun alias de ligne, et surtout **aucun
> champ d'agrégation**, le nœud tableau n'ayant nulle part où en poser un. Ce qui reste possible dans
> une cellule de pied, comme dans n'importe quelle cellule, c'est un bloc ordinaire, `loop` compris ;
> ce n'est pas un total calculé par le tableau, c'est du **contenu**.
>
> **Le refus structurel porte donc sur le CHAMP, pas sur la présence d'expressions ou d'alias dans le
> pied.** C'est la phrase à recopier dans l'ADR 0005 : elle est vraie, elle est vérifiable en une
> ligne, et elle survit à D5.

**Un second motif, indépendant et mesuré : le coût.** Un agrégat recopié **dans** le corps répété —
la colonne « cumul », qu'un tableau invite précisément à écrire — fait passer le rendu de linéaire à
quadratique. **Mesuré** (`probe-budget.mjs`, contre `packages/core/dist`, Node v24.11.1) : pour
1 000 lignes, **4 003 001** pas et **1 001 000** éléments visités, soit **les deux plafonds par
défaut dépassés** (`maxSteps` et `maxItemsVisited` à 1 000 000). Le même tableau avec le total en
ligne à part suit `pas = 12·N + 4` et `éléments = 2·N` : une facture de soixante lignes y consomme
724 pas, **0,072 %** de `maxSteps` [§2, D12]. Que le total soit une ligne **à part** n'est donc pas
qu'une affaire de doctrine.

**Écarté.** (a) `TableColumn.total?: AggregateOperator` : arrondi implicite hors de l'arbre, et un
champ de document stocké ne se retire qu'avec une migration transformante. (b) `TableNode.footer: 'sum'` : même faute, en pire, parce qu'elle a l'air d'une commodité.
(c) Pas de section pied du tout : voir l'encadré ci-dessus. (d) Un pied autorisant un groupe répété « au cas où » : il ouvrirait
la porte au **sous-total de page**, c'est-à-dire au report — le seul chiffre que le moteur décide
lui-même, parce que seul lui sait où il coupe (E3), et que l'ADR 0004 décision 12 refuse d'arrondir.

**Conséquences.** *(1)* **Irréversible au sens fort** : ajouter un champ de total après coup ne
serait pas une évolution, ce serait un revirement de doctrine — celui que C2 a transmis et que
l'ADR 0004 a consigné. *(2)* **La ligne de total est une ligne COURTE** — deux cellules pour cinq
colonnes dans le modèle de [§6.2] — et c'est précisément ce que l'appariement par clé de D3 rend
naturel : le positionnel aurait imposé trois cellules de remplissage vides. *(3)* Le libellé
« Total » **occupe une colonne** et ne peut pas s'étendre sur les colonnes vides qui le précèdent,
faute de fusion de cellules [§2, D13] ; sur une facture réelle, c'est visible, et le contournement
est daté plutôt que caché.

*(4)* **Le prix du refus : le total est un RECALCUL PARALLÈLE, et rien dans le contrat ne le lie à la
colonne qu'il additionne.** C'est la conséquence qu'il faut nommer, parce qu'elle est le revers exact
de la décision. Le modèle du critère de recette écrit **deux fois** la même arithmétique :
`round(mul(ligne.quantite, ligne.prixUnitaire), 2, halfExpand)` dans la cellule « montant » du corps,
et la même expression sous l'agrégat du pied. **Aucun mécanisme du contrat ne les apparie** — c'est
le prix du refus des références croisées posé par C1, pas un oubli de C3. Un auteur qui corrige l'une
et pas l'autre obtient un total qui contredit sa propre colonne, **en silence** : `core` ne le refuse
pas, et `collectDataPaths` ne le voit pas non plus, puisqu'il rend `['facture.numero',
'facture.lignes']` dans les deux cas. Le dépôt connaît déjà le danger et s'en protège **hors du
contrat** : `App.tsx:428-432` dérive le total de l'expression de ligne en TypeScript, avec le
commentaire qui dit pourquoi — « *Épelé deux fois, rien n'obligerait les deux copies à rester
identiques* ». Un modèle stocké en JSON n'a pas ce recours. **L'outil qui peut le voir est un lint
d'éditeur — la barre de formule, D7 du designer, dont le tableau des exigences porte déjà
« Comprendre où s'applique la formule » (`designer.md:128`) — jamais un refus de `core` :** `core`
n'a aucun moyen de savoir que deux expressions *devaient* être la même. Deux gestes en découlent : le
modèle de [§6.2] emploie **le même nom d'alias** (`ligne`) dans le groupe et dans l'agrégat, pour que
la duplication soit comparable à l'œil — les deux portées sont disjointes, le masquage est lexical,
cela ne coûte rien — et la question entre dans « Ce qui reste ouvert » de l'ADR 0005, reliée à la
décision déjà consignée par l'ADR 0002 (`0002:382-388`, « Les lectures par élément ne sont rapportées
à personne »), dont elle est une instance.

---

### D10 — Zéro code d'erreur nouveau ; un SITE `tableRowGroup`, et son libellé dans le même incrément

**Décision.** `OPERAND_ERROR_CODES` (neuf entrées, `errors.ts:32-42`), `LIMIT_ERROR_CODES` (quatre, `errors.ts:52-57`) et `SHAPE_ERROR_CODES` (trois, `errors.ts:215`) sont **inchangés** : `EXPRESSION_ERROR_CODES` reste à **treize** entrées, et C8 n'hérite d'aucun message neuf à écrire. `ExpressionErrorSite` (`errors.ts:80`) devient `ExpressionKind | 'loop' | 'condition' | 'tableRowGroup'`, et `LIST_CALLER_SUBJECTS` (`evaluator/evaluate.ts:198-203` — la façade `expression/evaluate.ts` ne fait que ré-exporter, et toutes les références `evaluate.ts:NNN` de ce plan désignent l'implémentation) gagne `tableRowGroup: 'A table body'` **dans le même incrément** — INC-2 [§4], jamais deux. Tout le reste est refusé par Zod au save time [§5.1].

**Pourquoi zéro code : un tableau ne calcule rien, il dispose.** Onze fautes sont possibles dans la déclaration d'un tableau, et les onze sont décidables **sans données** : largeur non entière, largeur hors fenêtre, largeur non finie, alignement inconnu, colonne sans id, deux colonnes de même id, cellule nommant une colonne non déclarée, deux cellules d'une ligne pour la même colonne, tableau sans colonne, groupe sans ligne, alias refusé par `aliasSchema`. Onze refus, donc, et [§5.1] les mesure un par un avec leur chemin ; la famille des largeurs pèse trois de ces onze entrées et rend **quatre** messages distincts, pas cinq, parce que la fenêtre se refuse par le bas et par le haut avec deux libellés là où le fractionnaire et le non-fini en ont chacun un. Un code de rendu pour une faute décidable au parse n'existerait que pour un arbre **construit à la main**, jamais chargé par `parseTemplate` — et l'ADR 0004 décision 6 a déjà écarté ce lectorat nommément. C'est le meilleur résultat qu'un lot puisse offrir à C8 : non pas un message de plus, mais **un état de moins**. La cellule orpheline n'a pas besoin d'un `unknown-column` parce qu'elle est refusée avant d'exister [§2, D3].

**Pourquoi un site n'est pas un code, et pourquoi ce n'est pas une nuance de vocabulaire.** `ExpressionErrorDetails` porte deux axes distincts, et l'ADR 0003 les a séparés exprès. Le `code` dit **ce qui est faux** : c'est un catalogue **fermé**, exporté sous forme de tuple « *because a type cannot be iterated and C8 has to pair every code with a message* » (`errors.ts:59-65`) — l'élargir crée une obligation d'écriture dans un lot aval. Le `site` dit **où** : c'est un type **dérivé**, `ExpressionKind` plus deux membres écrits à la main, et sa docstring donne la raison de ces deux membres — `LoopNode.each` et `ConditionNode.when` portent une expression **sans en être une**, donc un échec sur la source d'une boucle n'a aucun kind à déclarer. C'est textuellement pour cela que le champ s'appelle `site` et non `kind` (ADR 0003:401-402).

`TableRowGroupNode.each` est la **troisième occurrence exacte de cette forme**. Ajouter `'tableRowGroup'` n'ajoute pas une branche de narrowing à `ExpressionErrorDetails`, pas une ligne au catalogue que C8 énumère, pas une entrée à `EXPRESSION_ERROR_CODES.length`. Cela nomme une **position**, et les positions sont ouvertes par construction : l'union a été écrite avec des membres à la main précisément parce qu'on savait que d'autres nœuds porteraient des expressions. Un type conçu pour recevoir des membres écrits à la main n'est pas violé quand on lui en ajoute un — il est utilisé.

**Et c'est justement pour cela que le libellé doit voyager avec.** `LIST_CALLER_SUBJECTS` est un `Readonly<Partial<Record<ExpressionErrorSite, string>>>`, lu à `evaluator/evaluate.ts:231` sous la forme `LIST_CALLER_SUBJECTS[site] ?? 'An expression'`. **Aucun `const exhaustive: never` ne garde `ExpressionErrorSite`** — vérifié : c'est la seule table du dépôt indexée par lui, et elle est partielle. Un site ajouté seul passe donc les quatre portes, vert partout, et rend à un auteur qui a écrit un tableau : « *An expression needs a list to iterate over, got a number.* » C'est mot pour mot le défaut que la docstring de cette table existe pour empêcher, dans l'autre sens : elle a été créée parce qu'un « *A loop* » codé en dur aurait dit **loop** à qui avait écrit une somme, « *a direct C8 miss, in the lot C8 depends on* ». Livrer le site sans le libellé, ce serait rejouer ce miss dans le lot qui l'a documenté.

L'ordre des deux gestes est d'ailleurs **imposé par le compilateur, et lui seul** : la clé `tableRowGroup` sur un `Partial<Record<ExpressionErrorSite, string>>` dont l'union ignore encore ce membre est une propriété en excès, donc une erreur de porte 3. Le libellé ne **peut pas** précéder le site. La seule défaillance possible est de s'arrêter entre les deux, et rien de mécanique ne l'attrape : c'est pourquoi le critère de sortie d'INC-2 épingle la chaîne exacte, mesurée — `A table body needs a list to iterate over, got a number.` [§5.1].

**Pourquoi « A table body » et non « A table » ni « A table row group ».** Le **site** est une clé de machine et il nomme le **type de nœud**, parce que les sites existants nomment le type de nœud et que le nœud qui appelle `evaluateSequence` s'appelle `tableRowGroup` [§2, D8]. Le **libellé** est de la prose pour un humain et il nomme **ce que l'auteur a écrit** : une répétition dans le corps d'un tableau. Les deux ne coïncident pas, et c'est réglé plutôt que subi — le dépôt sépare déjà la clé et la prose partout où il le peut, `describe()` en étant l'exemple. Le sujet porte son article parce que la table le fait déjà : « *`A loop` and `An aggregation` do not share one* ».

> **Le point à traiter frontalement : `errors.ts` est modifié alors que le plan C2 avait consigné « ne pas toucher ».** Sa table §4 écrit, sans ambiguïté : « `packages/core/src/errors.ts` — **Ne pas modifier.** `ExpressionErrorSite` s'élargit par dérivation (D6). » **Ce n'est pas une contradiction, et il faut dire pourquoi, sinon le prochain plan héritera d'un précédent de désobéissance silencieuse.**
>
> 1. **La consigne est de périmètre, pas de statut.** Elle vit dans la table qui clôt les **cinq incréments de C2** et qui s'intitule « Ce qui ne se touche pas » : c'est une discipline de lot — ne touchez pas ce fichier **dans celui-ci** — et non une immutabilité de dépôt. `errors.ts` ne figure pas dans la liste protégée d'AGENTS.md §7, et rien dans le dépôt ne le déclare figé.
> 2. **Le motif écrit par C2 est vrai, et il est intégralement préservé.** C2 disait « s'élargit par dérivation », et c'était exact **pour C2** : `round` **est** un kind, donc `ExpressionKind` a grandi et le site avec lui, zéro ligne modifiée. C3 est sur l'autre branche de la même union — un nœud qui porte une expression sans en être une. Le motif de C2 ne s'applique pas ici, et C2 n'a jamais prétendu qu'il s'appliquerait aux lots qui ajoutent des nœuds.
> 3. **Ce qui serait une vraie contradiction est la promesse voisine, et elle tient.** « Zéro code d'erreur nouveau » est ce que C2 a promis et ce que C3 répète ; c'est cette ligne-là qu'il serait interdit de franchir, et les trois catalogues sortent du lot octet pour octet. Le critère de sortie d'INC-2 le vérifie par un test sur `EXPRESSION_ERROR_CODES.length`.
>
> C3 écrit à son tour sa consigne dans [§4] : `errors.ts` — **une ligne de type et une docstring, rien d'autre**. Et l'ADR 0005 le consigne, parce qu'un plan qui renverse la consigne d'un plan antérieur doit le faire **par écrit** ou pas du tout.

**Écarté.** (a) **Réutiliser le site `'loop'`** : zéro ligne modifiée, et un message qui dit « A loop needs a list » à qui n'a écrit aucune boucle — une régression C8 dans le lot dont C8 dépend. (b) **Un site `'table'`** : le nœud qui évalue la séquence n'est pas le tableau, c'est le groupe ; nommer le mauvais nœud rendrait le `at` et le `site` incohérents pour l'éditeur qui les lit ensemble. (c) **N'ajouter aucun site** : cohérent avec la proposition où le tableau n'évalue aucune séquence, inapplicable au contrat retenu. (d) **Un code `unknown-column`** : la faute est décidable au parse [§2, D3]. (e) **Rendre `LIST_CALLER_SUBJECTS` total pour que le compilateur exige le libellé** — l'idée est bonne et elle ne passe pas : un `Record` complet exigerait une prose pour les dix-neuf kinds, dont la quasi-totalité n'appelle jamais `evaluateSequence`, et un sujet écrit pour `add` ou `endOfMonth` serait de la prose morte qui ment ; un `Record` restreint à une liste écrite à la main de « sites qui réduisent une liste » serait un **second catalogue à tenir en phase**, exactement ce que `EXPRESSION_ERROR_CODES` refuse (« *two rival exported lists would be two things to keep in step* ») ; et il forcerait, à `evaluator/evaluate.ts:231`, un narrowing de `site` — donc une garde `in` à l'exécution, à couvrir par un test, pour protéger un libellé. Le test coûte moins et épingle la chaîne réelle.

**Réversible** — une ligne de type et une entrée de table, sans forme persistée, donc sans migration. Avec une réserve à écrire : `ExpressionErrorSite` est exporté par le barrel (`index.ts:46`), si bien que retirer le membre plus tard serait un rétrécissement de **type public**, jamais un refus de document.

---

### D11 — `CURRENT_SCHEMA_VERSION` passe à 4, estampille unique, et le lot ne rétrécit aucune valeur

**Décision.** `CURRENT_SCHEMA_VERSION = 4`. L'entrée `{ from: 3, to: 4, migrate: (input) => ({ ...input, schemaVersion: 4 }) }` est **ajoutée** à `TEMPLATE_MIGRATIONS`, jamais fusionnée avec les deux précédentes. La docstring de `CURRENT_SCHEMA_VERSION` gagne sa section « ## What version 4 means », qui énumère ce que la version contient **réellement** [§3.7]. Estampille posée **une seule fois**, en INC-3, après la dernière forme persistée du lot ; tout commit C3 antérieur est déclaré **non publiable**, et aucun document produit par un build intermédiaire n'est conservé.

**Pourquoi : le cas « refus illisible », rejoué et mesuré.** Élargir `DocumentNodeSchema` de trois membres est exactement ce que `template.ts` décrit dans sa propre docstring, pour la troisième fois. **MESURÉ** (bac à sable, Node v24.11.1, `zod@3.25.76` via `zod/v4`, schémas du dépôt) : un document estampillé `3` portant un nœud `table`, ouvert par un build v3, rend

```json
{"code":"invalid_union","note":"No matching discriminator","path":["root","children",0,"type"],"message":"Invalid input"}
```

Lisez-le comme l'auteur du modèle : aucune version nommée, aucun remède, et un chemin qui désigne `type` — un champ qui est **correctement orthographié**. Le message envoie donc chercher une faute de frappe là où il n'y en a pas. Avec l'estampille, le même document rend `TemplateMigrationError: … written by a newer release of Openview; upgrade before opening it.` — une erreur typée, qui nomme la version et l'action. L'écart entre les deux n'est pas d'ergonomie, il est de nature : le premier message est un cul-de-sac, le second est une instruction.

« Purement additif » n'est pas un argument contre l'incrément, **c'est l'argument pour**, et le fichier l'écrit déjà deux fois. AGENTS.md §1.2 ferme la porte de sortie d'une phrase : *il n'y a pas de dérogation pré-v1.0 au versionnement*.

**Et l'élargissement va dans les deux sens, ce qu'une seule estampille couvre.** Vers le large : `DocumentNodeSchema` accueille `table`, `tableRowGroup` et `tableRow` — huit types de nœud. Vers l'étroit : la coupure `BlockNode` retire la ligne des enfants d'un conteneur, d'une boucle et d'une condition [§2, D2]. Un build v3 ne voit jamais le second mouvement — il n'a pas de ligne à refuser — et il bute violemment sur le premier. Une version, deux directions, un numéro.

**Estampille unique, et pourquoi pas une par incrément.** Trois types de nœud, deux enregistrements inertes et une coupure d'union arrivent **ensemble** : c'est un contrat, pas une suite de commits. Une version par incrément ferait désigner par le numéro un état de branche plutôt qu'une forme stockée, et un numéro qui promet des formes non livrées est pire qu'un numéro non incrémenté. **MESURÉ** : la chaîne rend `[[1, 2], [2, 3], [3, 4]]` ; un document estampillé 3 et dépourvu de tableau parse et ressort à 4 ; un document estampillé 5 rend `TemplateMigrationError` en nommant la version. Les contrats de test sont en [§5.4].

**La règle de conduite du lot, écrite noir sur blanc : INC-0, INC-1 et INC-2 sont NON PUBLIABLES. Le premier commit publiable est INC-3.** Il faut ajouter la précision que le plan C2 a dû s'écrire à lui-même, parce qu'elle change ce qu'on relit en cas de doute : **INC-0 serait publiable seul** — c'est un refactor pur dont le critère de sortie exige que `packages/core/src/index.ts` soit inchangé octet pour octet — et **c'est INC-1 qui laisse une forme persistée sans estampille**, INC-2 se contentant d'hériter de cet état sans ajouter de forme. La règle porte néanmoins sur les trois, et sur le **lot** plutôt que sur chaque commit, parce que ce qu'elle protège n'est pas la propreté d'un commit isolé : c'est qu'aucun build en circulation ne refuse illisiblement les documents du build suivant. Une règle formulée sur le lot se vérifie d'un coup d'œil au journal ; une règle formulée commit par commit demande un audit à chaque publication. **Cohérent n'est pas publiable.**

**Aucun cinquième rétrécissement de valeur n'est ajouté.** Les quatre bornes qui reposent sur l'hypothèse pré-v1.0 sont les trois de l'ADR 0003 décision 2 et la fenêtre `decimals ∈ [-15, 15]` de l'ADR 0004 décision 4. **C3 n'en ajoute aucune**, et deux choses pourraient en avoir l'air :

- **Les trois bornes neuves de C3** — au moins une colonne, au moins une ligne par groupe, `width` entier dans `[1, 1000]` — portent toutes sur des **champs qui n'existaient pas**. Aucun document v3 ne peut porter une largeur, donc rien de valide ne devient invalide, et il n'y a **rien à retrofitter** : c'est mot pour mot l'argument que la migration 2 → 3 a écrit pour la fenêtre `decimals`, et c'est la différence entre ajouter une forme et resserrer une forme existante.
- **La coupure `BlockNode` rétrécit trois positions stockées** — `ContainerNode.children`, `LoopNode.children`, `ConditionNode.children` — et c'est un rétrécissement **réel dans le type**. Il est **vide en extension sur tout document v3** : l'unique chose qu'il retire de chaque position est un `tableRow` ou un `tableRowGroup`, et ces types n'existent pas en v3. Ce que l'hypothèse pré-v1.0 couvre, ce sont des documents stockés qui deviennent irrecevables ; aucun document stockable ne peut l'être ici.

Il faut l'écrire ainsi, et pas d'une phrase plus courte, parce que le plan C2 en a fait un point de vigilance : le jour où l'hypothèse pré-v1.0 tombe, ce sont **quatre** bornes à rediscuter une par une, pas cinq, et pas un lot à rouvrir.

**Écarté.** (a) **Ne pas estampiller au motif que l'ajout est additif** : argument retourné par le dépôt lui-même, dans `template.ts` puis dans l'ADR 0003 (« Faux, et c'est le pilier qui tombe »). (b) **Fusionner l'entrée avec `2 → 3`** : rompt le contrat pas-à-pas écrit dans `migrate.ts` — un document v1 ouvert par une release v12 marche v1 → v2 → … → v12 — et le test de composition qui compose une étape synthétique avec le registre réel. (c) **Attendre C4 pour estampiller une seule fois** : laisserait publiable un build qui refuse illisiblement les documents du suivant, ce qui est exactement le dommage que l'estampille supprime. (d) **Une migration transformante enveloppant les `loop` existants dans un `table`** : personne n'a demandé qu'un modèle existant devienne un tableau, et une migration qui devine une intention corrompt.

**Irréversible.**

> ⚠️ **La conséquence à ne pas perdre de vue : rien de mécanique n'exige ce bump.** `migrate.test.ts:140-145` est le **seul** test qui rougit, et seulement parce que son attendu littéral passe de `[[1, 2], [2, 3]]` à `[[1, 2], [2, 3], [3, 4]]` — aucun compilateur, aucun lint, aucune couverture ne réclame l'incrément. L'estampille est donc un **point de plan**, pas un résultat de build : si INC-3 saute, les quatre portes restent vertes et le dépôt publie un contrat qui ment sur son numéro. C'est la raison pour laquelle le critère de sortie d'INC-3 vérifie `CURRENT_SCHEMA_VERSION === 4` **et** `TEMPLATE_MIGRATIONS.length === 3` avec sa première entrée toujours `{ from: 1, to: 2 }`.

---

### D12 — Aucun plafond nouveau, et les mesures qui l'autorisent

**Décision.** Ni plafond de colonnes, ni plafond de lignes, ni plafond d'imbrication de tableaux. `DEFAULT_SHAPE_LIMITS` reste `{ maxDepth: 64, maxNodes: 100_000 }`, `DEFAULT_EVALUATION_LIMITS` n'est pas touché, et **aucun champ nouveau d'`EvaluationLimits`** n'est introduit — un champ de limite sans méthode de budget serait un plafond décoratif (ADR 0003, décision 8). Trois bornes de bonne formation seulement, toutes sur des champs neufs : au moins une colonne, au moins une ligne par groupe, une largeur entière dans `[1, 1000]`.

**Les mesures qui l'autorisent — MESURÉES, avec leur unité et leur protocole.** Bac à sable, Node v24.11.1, `assertBoundedShape` du dépôt, unité exacte du garde (**niveaux JSON**, racine = niveau 1 ; **valeurs** = un par élément de tableau et un par propriété propre, plus la racine, le `length` d'un tableau n'étant pas compté), bornes obtenues par **bissection**.

| Ce qui est mesuré | Profondeur | Valeurs | Plafond | Refus rendu |
| :--- | ---: | ---: | :--- | :--- |
| Modèle de recette **complet** (`Template` + `root` + le tableau) | **18** / 64 | **231** / 100 000 | — | — |
| **Nœud tableau seul** | **15** | **210** | — | — |
| Tableaux imbriqués les uns dans les autres | **9 acceptés**, le **10ᵉ** refusé | — | `maxDepth` | `too-deep` |
| `round` imbriqués dans une cellule d'un `tableRowGroup` | **48** | — | `maxDepth` | `too-deep` |
| `round` imbriqués dans une cellule d'une ligne de corps **fixe** | **50** | — | `maxDepth` | `too-deep` |
| `round` imbriqués sous un **texte nu** | **56** | — | `maxDepth` | `too-deep` |

> ⚠️ **Correction d'un raisonnement faux, à ne pas recopier.** Une rédaction antérieure de ces chiffres écrivait « **18 / 64 pour le modèle complet (nœud tableau seul : 15, 231 valeurs / 100 000)** ». La parenthèse attache **231** au nœud tableau seul : c'est faux, 231 est le compte du **modèle complet**, et le nœud seul en pèse **210**. La même rédaction écrivait « **une cellule laisse 48 `round` imbriqués contre 56 sous un texte nu** », chiffre unique pour **deux positions également licites** : 48 vaut dans une cellule portée par un `tableRowGroup`, **50** dans une cellule d'une ligne de corps fixe — le groupe coûte **deux niveaux JSON**. Un chiffre juste mal étiqueté est un chiffre faux, et c'est exactement celui qu'un lecteur recopie dans l'ADR sans le rejouer.

**Ce que ces mesures autorisent à conclure, et ce qu'elles n'autorisent pas.** La marge est de **46 niveaux** sous `maxDepth` et de **99 769 valeurs** sous `maxNodes` : le rapport est de **3,5×** en profondeur, sur le modèle le plus lourd que le critère de recette produise. Dans les deux cas d'imbrication mesurés, c'est **le garde de forme** qui refuse en premier, jamais `depth-limit-exceeded` — la profondeur d'évaluation n'est pas la profondeur JSON, et confondre les deux ferait chercher le refus dans le mauvais fichier. Et il faut rappeler ce que `maxNodes` borne : **le modèle, pas le jeu de données**. Une facture de soixante mille lignes ne pèse rien ici, puisque les lignes sont des **données** et que le modèle n'en décrit qu'une [§2, D8].

**Côté évaluation, le modèle de coût est mesuré et il est linéaire.** `pas = 12 · N + 4`, `éléments = 2 · N`, contre `packages/core/dist`.

| N lignes | pas | éléments visités | % `maxSteps` | % `maxItemsVisited` |
| --: | --: | --: | --: | --: |
| 5 | 64 | 10 | 0,006 % | 0,001 % |
| 60 | 724 | 120 | **0,072 %** | 0,012 % |
| 200 | 2 404 | 400 | 0,240 % | 0,040 % |
| 1 000 | 12 004 | 2 000 | 1,200 % | 0,200 % |
| 10 000 | 120 004 | 20 000 | 12,00 % | 2,00 % |
| 60 000 | 720 004 | 120 000 | 72,00 % | 12,00 % |

Décomposition vérifiée : **8 pas par ligne** pour l'affichage (quatre cellules `path`, plus la cellule montant `round(mul(p, p))` qui en coûte quatre), **4 pas par ligne** pour le total — l'agrégat réévalue `round(mul(p, p))` une fois par élément —, **4 pas fixes**, et **2 éléments par ligne** parce que la liste est traversée deux fois, une fois par le groupe et une fois par le `source` de l'agrégat, au site unique `evaluator/evaluate.ts:240`. Les plafonds sont atteints vers **N ≈ 83 333 lignes** pour `maxSteps` et **N ≈ 500 000** pour `maxItemsVisited` : c'est le **pas** qui mord en premier, et la facture comptable réelle que la roadmap nomme — « une soixantaine de lignes » — consomme **0,072 %** du budget. Un plafond nouveau serait un plafond qui ne protège de rien, et il constituerait un cinquième rétrécissement à adosser à l'hypothèse pré-v1.0 pour un besoin qu'aucune mesure ne montre [§2, D11]. Le précédent est écrit : l'ADR 0004 a refusé tout plafond nouveau pour son lot sur une mesure du même genre.

**Le contre-exemple quadratique, qui doit être documenté parce qu'il ne peut pas être empêché.** Une colonne « cumul » qui poserait un `sum(...)` **dans** le corps répété — une expression d'agrégat recopiée dans chaque cellule de ligne — fait passer le rendu de linéaire à quadratique. **MESURÉ**, même sonde :

| N lignes | pas | éléments visités |
| --: | --: | --: |
| 60 | 14 581 | 3 660 |
| 200 | 160 601 | 40 200 |
| 1 000 | **4 003 001** | **1 001 000** |

À N = 1 000, **les deux plafonds par défaut sont dépassés** : `step-limit-exceeded` d'abord, `item-limit-exceeded` ensuite. **Aucun champ ne peut l'empêcher** — c'est une expression parfaitement licite, et il n'existe aucune borne déclarative qui distingue « un `sum` utile » de « un `sum` recopié N fois ». Le tableau est précisément ce qui **invite** à l'écrire : une colonne de cumul est la première chose qu'on demande à un tableau de lignes. C'est la seconde raison, indépendante de la doctrine, pour que la ligne de total soit **sœur** de la répétition et non dedans [§2, D9] — la première étant que le pied n'a nulle part où poser un agrégat. Et c'est un motif de **documenter** plutôt que de borner : un plafond de lignes refuserait l'honnête facture de mille lignes tout en acceptant la quadratique de deux cents.

**Les chiffres de budget mesurent une boucle de rendu écrite à la main, et il faut le dire.** `packages/engine/src` ne contient que `index.ts` et son test — une constante de version, rien d'autre — et le `DataBindingStep` du Pipeline (AGENTS.md §3.E) reste à écrire. Le modèle `12 · N + 4` décrit donc la boucle de la sonde, pas la boucle du moteur. Si un lot E mémoïse l'expression d'une cellule, ou évalue l'agrégat une fois au lieu d'une fois par élément, **la constante change**. Ce qui ne change pas, et qui porte la décision, c'est la **forme** : linéaire en N dans la disposition sœur, quadratique dans la disposition en corps. C'est la partie indépendante du moteur, et c'est la seule sur laquelle D12 s'appuie.

> ⚠️ **Le corollaire de cette décision : `guard.ts:37-40` devient faux, et il doit être réécrit dans le même lot.** La docstring de `ShapeLimits.maxDepth` annonce aujourd'hui : « *Measured on a realistic model: 10 levels, and 12 with an `aggregate(filter(...))`. 64 leaves a fivefold margin.* » Après C3, le modèle réaliste du dépôt pèse **18** niveaux et la marge vaut **3,5×**. D12 refuse tout plafond nouveau **en s'appuyant sur cette mesure** ; laisser en l'état le fichier qui la porte reviendrait à fonder un refus sur un chiffre que le code contredit trois lignes plus haut.
>
> **Le précédent est écrit et opposable, et c'est le même geste :** le plan C2 a consacré sa §3.6 — « `limits.ts` — la liste qui mentirait sinon » — à corriger une docstring d'énumération que son propre lot rendait incomplète, sans toucher à une seule valeur. C3 fait exactement cela. `packages/core/src/template/guard.ts` entre donc dans les fichiers d'INC-1 [§4], et [§3.6] ne porte **que** la docstring : « *Measured on a realistic model: 10 levels, 12 with an `aggregate(filter(...))`, and 18 for the five-column table of lot C3 with its header and a `round(sum(round(mul)))` footer. 64 leaves a threefold margin, and nine nested tables are accepted before `too-deep`.* » Les valeurs ne bougent pas ; « threefold » arrondit **vers le bas** le 3,5 mesuré, délibérément.

**Écarté.** (a) **Un `MAX_TABLE_COLUMNS`** : `maxNodes` borne déjà, indirectement et mieux, et c'est cette borne-là qui porte la preuve d'exactitude de D6 [§2, D6] ; un second plafond serait une seconde chose à tenir en phase avec la première. (b) **Refuser l'imbrication d'un tableau dans une cellule** : irréalisable sans refuser aussi les conteneurs, donc une règle non outillée — et `too-deep` répond déjà, avec un code typé qui existe. (c) **Un plafond de lignes** : les lignes sont des **données**, pas du modèle ; le faire respecter demanderait un champ d'`EvaluationLimits`, donc une méthode de budget, donc un code de refus — les trois refusés, le dernier par D10. (d) **Relever `maxDepth` « puisque C3 en consomme un tiers »** : 46 niveaux de marge subsistent, et relever un défaut parce qu'un lot neuf s'en approche est la manière ordinaire dont un garde devient décoratif.

**Réversible dans un seul sens, et il faut le nommer.** Ne rien borner aujourd'hui ne coûte rien à défaire côté code — un plafond s'ajoute en une ligne. Mais l'ajouter plus tard serait un **rétrécissement** : des documents recevables cesseraient de l'être, sans migration possible, et il rejoindrait la liste des quatre que porte l'hypothèse pré-v1.0. **Signal de réouverture** : un chiffre remis par E8 montrant qu'un tableau large fait exploser une ressource que `maxNodes` ne borne pas.

---

### D13 — Ce que le lot refuse, par écrit

**Décision.** **Vingt refus**, groupés en **six familles**, chacun adossé à un texte déjà écrit du dépôt et jamais à un goût, chacun assorti de son **signal de réouverture** quand il en a un. Un refus qu'on n'écrit pas est un refus qui sera demandé, accordé, et découvert trop tard — et cette liste est le contenu de la dernière décision de l'ADR 0005, sur le patron de D12 du plan C2 [§4, INC-5].

**Calcul — quatre refus.**

- **L'auto-somme et tout champ de total** porté par la structure : `TableColumn.total`, `TableNode.footer: 'sum'`, un opérateur d'agrégation déclaré par le tableau ou par la colonne. *Motif :* un tableau qui sommerait ses propres colonnes réintroduirait l'arrondi implicite que l'ADR 0004 décision 8 refuse, et le ferait **hors de l'arbre**, là où aucun relecteur ne le verrait. Ici le refus n'est pas une docstring — mais il n'a pas la **même force des deux côtés**, et le dire est ce qui empêche de croire le contrat mieux gardé qu'il ne l'est. **Sur le pied, c'est le TYPE** : `footer: readonly TableRowNode[]` **n'a nulle part où poser un agrégat** [§2, D9], et aucun champ optionnel ne contourne cela. **Sur `TableColumn`, c'est la doctrine plus un grep** : rien dans le type n'empêche d'y ajouter un `total?: AggregateOperator`, le test `Object.keys` de [§6.2] ne mord que sur un champ **requis**, et le seul filet réel est le critère mécanique de [§6.4]. *Irréversible au sens fort.*
- **Le sous-total et le report de page.** *Motif :* c'est le seul calcul que le moteur décide lui-même, parce que seul lui sait où il coupe (`engine.md:63-67`, `core.md:48`) ; C1 exclut déjà toute référence vers une valeur d'une autre page, et l'ADR 0004 décision 12 refuse tout arrondi de report.
- **La répartition d'un résidu d'arrondi sur N lignes** (plus grand reste, ajustement de la dernière ligne). *Motif :* **quelle** ligne absorbe le résidu est une **règle**. Openview donne la capacité de calculer le résidu, il ne décide pas où il tombe — refus déjà écrit par D12 du plan C2, non rouvert.
- **La colonne calculée portée par la colonne** (« montant = quantité × prix » déclaré une fois sur la colonne). *Motif :* c'est une formule ; elle vit dans la cellule, **visible dans l'arbre** — pour un relecteur, pour la barre de formule de D7 du designer, et pour un refus qui désigne un nœud.

**Format — trois refus.**

- **Tout type de colonne** : monétaire, nombre, date. *Motif :* un type monétaire appelle une échelle et un symbole ; une échelle non déclarée **est** un arrondi implicite, et une table devise → décimales est refusée jusque dans un exemple de docstring. *Signal de réouverture :* la décision ouverte de C2 tranchée par le propriétaire du produit. Développé ci-dessous.
- **Tout format, séparateur, symbole monétaire, locale, échelle d'affichage ou remplissage de zéros** sur une colonne ou une cellule. *Motif :* périmètre de C6, et test de l'ADR 0004 décision 10 — *si une déclaration ne peut changer que ce qu'un lecteur voit, elle est C6*. C6 ne devra par ailleurs jamais ré-arrondir en silence un montant que le modèle a déjà arrondi.
- **Tout défaut ou héritage d'arrondi par sous-arbre** au niveau du tableau. *Motif :* ADR 0004 décision 8 — le contrat ne porte ni `Template.rounding`, ni défaut de document, ni héritage. Un défaut ici rendrait de surcroît **irrecevable** la décision ouverte n° 6 de `docs/roadmap/README.md:189`, en tranchant au niveau du contrat ce qu'elle veut trancher au niveau des modèles livrés.

**Apparence — un refus.**

- **Tout filet, fond, zébrure, police, graisse, couleur, espacement**, ainsi que **l'alignement de bloc** et **toute surcharge d'alignement par cellule**. *Motif :* périmètre de C5, qui dépend de C3 (`core.md:184`). Le critère d'appartenance de D1 les tue tous par sa condition (2) — ils s'écrivent sur n'importe quel bloc, donc ils sont exprimables hors d'une colonne [§2, D1]. Un champ d'apparence écrit ici serait à **déplacer**, et déplacer un champ stocké est une migration transformante. Si C5 décide d'une surcharge par cellule, elle l'ajoutera **en surcharge**, sans toucher au champ de colonne [§2, D7].

**Pagination — un refus.**

- **La répétition d'en-tête page à page, la politique de veuve et d'orpheline, le point de coupe, la numérotation, le saut de page, l'insécabilité.** Nommément : `repeatHeaderOnEachPage`, `keepTogether`, `orphanControl`, `carryForwardLabel`, `pageBreakBefore`. *Motif :* C3 **décrit**, il ne **produit** rien — aucune page, aucun pixel (`core.md:271-274`). L'en-tête étant une **section nommée** [§2, D4], le moteur n'a besoin d'aucun drapeau pour savoir quoi répéter : c'est la raison pour laquelle le champ existe, et c'est aussi la raison pour laquelle le contrat ne dit **pas** ce que le moteur en fera — l'attente envers E2 et E3 part dans la section « Conséquences » de l'ADR 0005, qualifiée d'attente envers un lot non écrit.

**Données — trois refus.**

- **L'en-tête déduit d'un nom de champ, les colonnes déduites des clés du jeu de données, et tout nom de colonne réservé** (`lines`, `amount`, `total`, `vat`). *Motif :* `RenderRequest.data` est un sac opaque de clés que l'appelant nomme (AGENTS.md, règle de périmètre ; §1.2). Le test, en cas de doute : *si une fonctionnalité oblige l'intégrateur à nommer un champ comme Openview l'a décidé, elle est à refuser.*
- **L'alignement déduit du type de la valeur** (« les nombres à droite »). *Motif :* c'est une **règle**, et elle ferait dépendre la mise en page du jeu de données de l'intégrateur. Le texte du lot dit « un alignement **par colonne** », **déclaré** (`core.md:153-154`).
- **Tout vocabulaire à consonance réglementaire** dans le contrat ou dans un exemple — une colonne « TVA », « montant HT », « mentions légales ». *Motif :* c'est nommément le signal de réouverture du risque « une clause, et rien d'autre », et la liste des règles refusées par le dépôt est close (`docs/roadmap/README.md:132`).

**Structure — huit refus.**

- **Le tri, le filtre et le regroupement au niveau du tableau.** *Motif :* `filter` est déjà un kind de l'algèbre et `TableRowGroupNode.each` accepte une expression, donc « seulement les lignes non annulées » s'écrit `filter(lignes, l, not(l.annulee))` sans un champ de plus. Une seconde orthographe dériverait de la première.
- **La fusion de cellules** (`colspan` / `rowspan`). Développée ci-dessous.
- **La colonne conditionnelle.** Développée ci-dessous.
- **L'index de ligne** (`indexAs`). *Motif :* refusé en v1 par l'ADR 0002 sous-décision 4 — « la numérotation se traite souvent en CSS côté rendu » — et **non rouvert** ici : C3 n'a produit aucun élément nouveau qui justifierait de rejouer cet arbitrage.
- **La largeur en millimètres et la largeur ajustée au contenu.** *Motif :* le positionnement libre au millimètre est hors périmètre v1 (`docs/roadmap/README.md`, décision 8) et la géométrie de la feuille appartient à C4 ; une largeur mesurée sur le contenu exige des métriques de police, donc une lecture de la machine, et elle déplacerait la garantie « identique au PDF » du **contrat** vers un **accord entre deux moteurs de mise en page** [§2, D6].
- **Toute lecture d'environnement** dans la résolution d'une largeur ou d'un alignement : DPI, police système, locale machine, horloge, fuseau, aléa. *Motif :* outillé par Biome dans `core` et `engine`, et E6 en dépend.
- **Tout plafond nouveau** — colonnes, lignes, imbrication. Repris ici pour que la liste soit complète ; la décision, ses mesures et son signal de réouverture sont en [§2, D12].
- **Tout code d'erreur nouveau.** Repris ici pour la même raison ; la décision est en [§2, D10], et sa formule est : non pas un message de plus pour C8, mais **un état de moins**.

Soit **4 + 3 + 1 + 1 + 3 + 8 = 20**.

**Les trois qui seront demandés dès la première vraie facture.** Ce ne sont pas les plus discutables, ce sont les plus **prévisibles** : les écrire ici avec leur contournement daté évite qu'ils soient accordés en catastrophe par le premier qui les rencontre.

**1. La fusion de cellules.** Elle détruit l'invariant sur lequel tout le nœud repose : **une cellule appartient à une colonne**. Trois choses en dépendent, et toutes trois cassent ensemble. La **largeur** : la preuve d'exactitude de D6 porte sur le rapport `width / Σ widths` entre **colonnes** [§2, D6] ; une cellule fusionnée n'a pas de colonne, donc pas de part, et il faudrait une seconde règle — sommer les parts des colonnes couvertes — que rien dans le contrat ne dérive. L'**alignement** : `align` est un champ de colonne hérité par ses cellules [§2, D7] ; une cellule à cheval sur trois colonnes en hérite trois. La **coupure** : un moteur qui pagine coupe entre deux lignes ; avec `rowspan`, la coupure devient un problème à deux dimensions, et E2 hériterait d'un cas que personne n'a spécifié. **Contournement, écrit ici plutôt que caché :** le libellé d'une ligne de total occupe **une** colonne et les voisines restent vides — sur une facture réelle, cela se voit [§2, D9]. **Signal de réouverture :** un modèle livré dont le libellé de total ne tient dans aucune colonne existante.

**Le contournement se voit déjà dans le dépôt**, et c'est la meilleure démonstration qu'on puisse en donner : le `<table>` comparatif du playground porte un `colSpan={3}` (`App.tsx:854`) qu'aucun `TableNode` ne peut décrire — c'est l'une des deux raisons pour lesquelles il **reste du JSX écrit à la main** après C3 [§4, INC-4 (c)].

**2. La colonne conditionnelle** (« masquer Remise si aucune ligne n'en porte »). Elle demanderait d'évaluer une expression **par colonne** et de recalculer la géométrie **au rendu**, c'est-à-dire de faire entrer un calcul dans une déclaration de géométrie. Et elle casse D6 par un chemin que l'on n'attend pas : `Σ widths` deviendrait fonction du **jeu de données**, donc la part d'une colonne aussi, donc la garantie « même nombre dans l'aperçu et dans le PDF » ne tiendrait plus que si les deux côtés évaluaient la même expression de la même manière — un accord d'implémentation, exactement ce que D6 a été écrit pour remplacer par une propriété démontrable. **Contournement daté :** elle s'écrit **aujourd'hui**, en deux tableaux sous deux `condition` — c'est exprimable dès INC-1, puisque `ConditionNode.children` porte des blocs et que `TableNode ∈ BlockNode` [§2, D2]. **Le prix du contournement, nommé :** les deux tableaux doivent être maintenus en phase et **rien ne les lie** — c'est la même classe de divergence silencieuse que le recalcul parallèle du total [§2, D9], et c'est un lint d'éditeur, jamais un refus de `core`. **Signal de réouverture :** une facture réelle où les deux tableaux divergent en maintenance.

**3. Le type de colonne** (monétaire, nombre, date, texte). Il appelle une **échelle** et un **symbole**, donc un arrondi implicite ; le formatage appartient à C6 ; et le trancher ici **préempterait par la porte de service** la question que C2 a explicitement laissée ouverte — *qui déclare l'échelle d'affichage d'un montant*. Il ferait de surcroît dépendre la mise en page du jeu de données de l'intégrateur, contre la règle de périmètre. **Ce refus est aussi un arbitrage à rendre, et il est remonté** : l'arbitrage n° 1 de [§8] porte sur le mot « **typé** » du critère de recette de la roadmap — « un tableau à cinq colonnes **typé** (désignation, quantité, prix unitaire, remise, montant) » (`core.md:157-159`). La lecture de ce plan est **A** : « décrit dans un contrat typé », les cinq colonnes ne portant aucun type de donnée. Si le propriétaire du produit lit **B**, « chaque colonne porte un type », **ce contrat est à rejouer, pas à amender** — c'est l'arbitrage à rendre **avant INC-1**. **Signal de réouverture :** la décision ouverte de C2, tranchée par le propriétaire du produit.

**Les cinq colonnes du critère de recette sont un JEU D'ÉPREUVE, et le plan le fait dire par trois gestes plutôt que par une phrase.** `designation`, `quantite`, `prixUnitaire`, `remise`, `montant` : c'est la vitrine du lot, donc c'est **ce qui sera recopié**. Le dépôt nomme déjà ce mécanisme, et il le nomme à propos d'autre chose — « c'est donc une **position par défaut de fait** : autant la choisir sciemment » (`docs/roadmap/README.md:189`). Une phrase dans un plan périmé à la livraison ne protège personne ; trois gestes dans le code, si.

1. **Au-dessus du `TableNode` du playground**, l'avertissement d'`App.tsx:157-162` est recopié et adapté aux colonnes : les noms ci-dessous sont ceux qu'une application intégratrice aurait choisis, Openview n'en réserve aucun et n'en attend aucun.
2. **En tête de la fixture `RECIPE_TABLE`**, dans `packages/core/src/ast/__tests__/fixtures.ts`, le même avertissement — parce que la fixture est le second endroit d'où l'on copie [§5].
3. **Un critère mécanique en [§6.4]** : `git grep -nw 'designation\|quantite\|prixUnitaire\|montant' -- packages/core/src ':!*__tests__*'` ne rend rien, et `git grep -nw remise -- packages/core/src ':!*__tests__*'` rend exactement la ligne préexistante `text.ts:15`, inchangée. La forme naïve — sans `-w` — est fausse et la [§6.4] dit pourquoi. Un critère vérifiable par une commande vaut mieux qu'une intention, et celui-ci échoue bruyamment le jour où un nom du jeu d'épreuve remonte dans le contrat.

**Écarté.** (a) **Livrer l'un de ces refus « parce que c'est peu de code »** : c'est le mécanisme exact que la règle anti-sur-ingénierie décrit, et un champ stocké livré ne se retire plus qu'avec une migration transformante. (b) **Livrer une colonne « TVA » ou « montant HT » dans un exemple du contrat** : c'est nommément le signal de réouverture du risque « une clause, et rien d'autre » — un exemple est un contrat de fait, et celui-là appellerait une fonction à nom fiscal dans le lot suivant.

**Irréversible pour les deux premiers refus de la famille Calcul, réversible pour les autres** au prix, chaque fois, d'un champ neuf et d'une estampille — jamais d'une migration transformante, ce qui est précisément la propriété que cette liste protège.

---

## 3. Le contrat définitif

Tout ce qui suit a été **écrit, compilé et exécuté** dans le bac à sable de la session : copie
intégrale de `packages/core`, jonctions vers le `zod@3.25.76` (importé via `zod/v4`) et le
`vitest@4.1.10` du dépôt, `tsc` 7.0.2 lancé avec les `tsconfig.json` **et**
`tsconfig.typecheck.json` du dépôt, `biome check --config-path` pointant sur le `biome.jsonc` du
dépôt, Node v24.11.1. Baseline vérifiée à **exit 0** avant la première édition. Après édition :
**porte 1** — `biome check`, 48 fichiers, **0 erreur** ; **portes 2 et 3** — `tsc -p tsconfig.json`
et `tsc -p tsconfig.typecheck.json`, **exit 0** l'un et l'autre. Aucun `any`, aucun `!`, aucun
cast, aucun `@ts-*`, aucun accès indexé nu, aucun `biome-ignore`.

> 🔒 **Aucune écriture n'a été faite dans `packages/**` pour produire ce plan.** `git status` du
> dépôt est identique avant et après la session de mesure. Ce qui n'a pas pu être vérifié sans
> écrire dans le dépôt est signalé comme non vérifié en [§9].

Dans les sous-sections qui suivent, **MESURÉ** signifie qu'un protocole rejouable a été exécuté sur
la machine ci-dessus et que son résultat est reproduit ; **LU** signifie qu'une ligne du dépôt a été
lue et qu'elle porte sa référence `fichier:ligne`. Les deux ne se mélangent pas, et un chiffre sans
protocole est traité ici comme un défaut.

Le lot touche **neuf fichiers de `packages/core`** — dont deux qu'il crée — et **un fichier hors
`core`**. Les voici dans l'ordre où le contrat se lit, qui n'est pas l'ordre des incréments [§4] :
le contrat se lit de la forme vers ses portes, les incréments se livrent du refactor vers
l'estampille.

### 3.1 `packages/core/src/ast/types.ts` — nouveau (INC-0 le crée, INC-1 l'élargit)

**Ce que fait le fichier aujourd'hui : il n'existe pas.** `packages/core/src/ast/nodes.ts` fait 190
lignes et mêle deux choses qu'AGENTS.md §2 (« Modularité & taille des fichiers ») demande d'isoler :
les types écrits à la main (`nodes.ts:23-110`) et les schémas Zod (`nodes.ts:112-190`). C3 double ce
fichier. INC-0 exécute donc, **avant** toute fonctionnalité, le découpage que `expression/` a déjà
exécuté : `expression/expression.ts` y est réduit à une façade de six lignes de docstring et vingt
lignes de ré-export, `expression/types.ts` porte les types, `expression/schemas.ts` les schémas. Le
patron existe, il est appliqué tel quel.

**Ce qu'INC-0 déplace, sans une ligne changée** : `nodes.ts:10-26` (la docstring de module et
`NodeBase`), `:28-61` (`TextLiteralSegment`, `TextBindingSegment`, `TextSegment`), `:63-67`
(`TextNode`), `:69-73` (`ImageNode`), `:75-105` (les trois conteneurs), `:107-110` (`DocumentNode` et
`DocumentNodeType`). L'import de tête devient un import de types seuls :

```ts
import type { Expression, PrintableExpression } from '../expression/expression.js';
```

`ExpressionSchema`, `PrintableExpressionSchema` et `aliasSchema` partent avec les schémas [§3.2].
**Piège d'INC-0, et il est bloquant** : laisser l'import inchangé dans `types.ts` fait rougir la
porte 1 sur `noUnusedImports` et la porte 3 sur `noUnusedLocals`. Ce n'est pas une gêne, c'est la
preuve mécanique que le découpage est propre — un fichier de types qui importerait encore un schéma
n'aurait pas été découpé, il aurait été copié.

**Ce qu'INC-1 ajoute et modifie.** Trois interfaces de nœud, deux enregistrements inertes, deux
constantes de bornes, une liste de valeurs, deux alias d'union, un alias de discriminant nouveau —
et **trois lignes** déjà stockées qui changent de type.

#### Les trois `children`, la seule édition d'une forme existante

**AVANT** (`nodes.ts:77`, `:94`, `:104`) :

```ts
export interface ContainerNode extends NodeBase {
  readonly type: 'container';
  readonly children: readonly DocumentNode[];
}
```

**APRÈS** — la même chose pour `LoopNode` et `ConditionNode`, et rien d'autre dans ces trois
interfaces :

```ts
export interface ContainerNode extends NodeBase {
  readonly type: 'container';
  readonly children: readonly BlockNode[]; // <- `DocumentNode` avant C3
}

/** Repeats its children once per item yielded by {@link LoopNode.each}. */
export interface LoopNode extends NodeBase {
  readonly type: 'loop';
  readonly each: Expression;
  /**
   * The name children read the current item under (ADR 0002, option B1).
   *
   * Declared by the template rather than fixed by the engine, for two reasons:
   * nested loops each name their own item instead of the inner one making the
   * outer unreachable, and a template stops depending on its host application to
   * invent the same name -- which is what `evaluatePredicate(when, { line })` in
   * the playground was doing.
   */
  readonly as: string;
  readonly children: readonly BlockNode[]; // <- idem
}

/**
 * Renders its children only when {@link ConditionNode.when} evaluates to true.
 * Strictly true: see evaluatePredicate, which refuses JavaScript truthiness.
 */
export interface ConditionNode extends NodeBase {
  readonly type: 'condition';
  readonly when: Expression;
  readonly children: readonly BlockNode[]; // <- idem
}
```

C'est **le seul rétrécissement de forme stockée du lot**, et il ne rétrécit rien qui existe : aucun
document en version 3 ne peut porter une ligne, puisque le type `tableRow` n'existe pas encore. La
migration 3 → 4 le dit dans sa docstring [§3.7], et l'ADR 0005 doit l'écrire noir sur blanc — **le
lot n'ajoute pas de cinquième rétrécissement de valeur** à la liste des quatre que l'hypothèse
pré-v1.0 porte déjà, parce que ses bornes portent toutes sur des champs neufs [§2, D11].

#### L'alignement de colonne

```ts
/**
 * How the cells of one column sit inside their column box (lot C3).
 *
 * `start | center | end` rather than `left | center | right`, and **nothing is resolved
 * here.** A column that stores `left` has already decided the writing direction of every
 * language the template will ever be rendered in; `start` DEFERS that decision instead of
 * taking it. Wherever the direction is left-to-right, `start` IS `left`, so the choice
 * costs nothing today, and it avoids a reversal that would be transforming AND undecidable
 * -- from a stored `left`, nobody can tell whether the author meant "left" or "start".
 *
 * WHO declares the direction a renderer resolves this against is not settled by this
 * package, and lot C3 holds no information with which to settle it: the question is
 * recorded as open in ADR 0005, with its options and without a recommendation. One
 * interdiction is already settled and is not reopened by it -- no engine derives that
 * direction from the machine it runs on (lot E6).
 *
 * Three members and no `justify`: justification stretches inter-word space, which is
 * typography, and typography is lot C5.
 */
export const TABLE_COLUMN_ALIGNMENTS = ['start', 'center', 'end'] as const;

export type TableColumnAlignment = (typeof TABLE_COLUMN_ALIGNMENTS)[number];
```

> ⚠️ **La docstring a porté un motif faux, retiré ici.** Elle justifiait `start`/`end` par
> « *the reason is lot C6 rather than taste* » et « *resolution belongs to whoever knows the
> direction* » — deux phrases qui attribuent à C6 une compétence qu'aucun texte du dépôt ne lui
> donne. La mesure qui l'établit et la formulation de remplacement sont en [§2, D7] ; ce qui
> compte ici est que le commentaire publié dans le `.d.ts` ne promet **rien** à personne : il dit
> que C3 diffère la résolution, et il s'arrête là.

#### La fenêtre de largeur, et la preuve qu'elle porte

```ts
/**
 * The window a column weight lives in, and the bounds are load-bearing rather than
 * decorative.
 *
 * {@link TableColumn.width} is a whole number, so the sum of a table's weights is EXACT in
 * binary64 and a column's share is ONE correctly-rounded division -- the same number in the
 * on-screen preview and in the PDF, on any conforming engine, which is what product
 * decision 7 promises and what a floating weight could only approximate.
 *
 * ## The proof, and what it does NOT rest on
 *
 * It does not rest on a default. `limitSchema` caps `maxNodes` at
 * `LIMIT_HARD_CEILING = 1_000_000_000`, and a column `{ id, width, align }` costs FOUR
 * values, so a template that goes through the shape guard carries at most 2.5e8 columns and
 * the sum of its weights is at most `2.5e8 * 1e3 = 2.5e11 < 2**53`. Outside the guard --
 * `TableNodeSchema.parse` does not run it -- the maximum length of a JavaScript array,
 * `2**32 - 1`, bounds the sum to `4.3e12 < 2**53`. The sum is exact in every representable
 * case, whatever `DEFAULT_SHAPE_LIMITS` is set to on the day this is read.
 *
 * Both bounds are refused when the template is SAVED, never at render. Narrowing a field
 * that no stored document can carry yet costs nothing -- that is what the 2 -> 3 migration
 * records for `decimals`, word for word.
 */
export const MIN_COLUMN_WIDTH = 1;
export const MAX_COLUMN_WIDTH = 1000;
```

> ⚠️ **La preuve publiée dans cette docstring a été fausse trois fois dans la même phrase**, et
> elle est réécrite ici sur la borne qui existe vraiment. L'énoncé retiré : « *`assertBoundedShape`
> caps a stored template at `maxNodes` values, so a table carries at most 100 000 columns* ».
> `maxNodes` est un **défaut** surchargeable et non une borne de contrat, le garde compte des
> **valeurs** et non des colonnes, et `TableNodeSchema` n'applique aucun garde du tout. Le détail
> des trois erreurs, les mesures par bissection et la preuve de remplacement sont en [§2, D6].
> **Le chiffre « 100 000 colonnes » est supprimé partout dans le dépôt et dans l'ADR.**

#### La colonne

```ts
/**
 * One column of a {@link TableNode}: an identity, and the geometry its cells share.
 *
 * ## Three fields, and the test that says why there are exactly three
 *
 * A declaration belongs on a column if and only if: (1) it is SHARED by the N cells of that
 * column; (2) it is INEXPRESSIBLE outside a column -- remove the notion of a column and the
 * attribute has no site left to be written on; (3) it can change neither a `compare` nor a
 * `sum` nor a `dateAdd`; (4) it asks the integrator to name no field of their data.
 *
 * Identity and width pass all four. A font, a rule, a background, a spacing fail the SECOND
 * -- they are written on any block whatsoever, and lot C5 defines them there. A number
 * format, a separator, a currency symbol, a display scale fail it too, and are lot C6's. A
 * total, a subtotal, an aggregation operator fail the THIRD. A header derived from a data
 * key, columns derived from the keys of the data, an alignment derived from the type of the
 * value fail the FOURTH.
 *
 * `align` FAILS the second, and it is here anyway. It is a NAMED EXCEPTION, carried by two
 * mechanical arguments rather than by the criterion: the roadmap writes "un alignement par
 * colonne" under lot C3, and lot C5 reads "Dépend de : C3" -- so a property lot C3's own
 * acceptance criterion needs cannot live in the lot that comes after it.
 *
 * ## Why a column carries no label
 *
 * Because the header is a ROW, and a heading is a cell of it like any other -- see
 * {@link TableNode.header}. A `label: string` here would give lot C6 a second content
 * position to translate beside {@link TextNode.content}, and replacing it later is a
 * transforming migration on every template written in between.
 */
export interface TableColumn {
  /**
   * Unique within its table, checked when the template is saved. A cell names this;
   * nothing in the contract is matched by position.
   *
   * A column is not a {@link DocumentNode} -- it holds no content and lives in no scope --
   * so `findNodeById` does not reach it, and an editor addresses it as
   * (table id, column id).
   */
  readonly id: string;
  /**
   * A relative WEIGHT, deliberately unitless: a column of weight 3 beside one of weight 1
   * is three times as wide. A column receives `width / (sum of the widths of its table)`
   * of whatever width the table itself is given. **How wide the table is is not declared
   * here, and lot C3 declares it nowhere.**
   *
   * Not millimetres: the geometry of the sheet -- format, orientation, margins -- is lot
   * C4's, and free positioning to the millimetre is out of scope for v1, so an absolute
   * length here would duplicate one and reintroduce the other. Not a percentage: a
   * percentage only behaves if the values sum to a hundred, so either the contract polices
   * that sum -- a rule, and a refusal nobody asked for -- or appending a sixth column
   * invalidates the five others. Not `auto`: a width resolved by measuring content needs
   * font metrics, which is reading the machine, and it would make the preview and the PDF
   * agree only insofar as two layout engines measure identically.
   *
   * A weight normalises totally, needs no sum rule, and survives a change of paper format
   * without one edit to the table.
   */
  readonly width: number;
  /** Inherited by every cell of this column. A per-cell override belongs to lot C5. */
  readonly align: TableColumnAlignment;
}
```

> ⚠️ **Correction de deux raisonnements faux, à ne pas recopier.**
>
> **(a) Le critère d'appartenance.** La condition (2) s'écrivait « *elle cesse d'exister avec la
> structure* », glosée par « *A font, a rule, a background, a spacing fail the second -- they outlive
> the column* ». **Contre-exemple immédiat** : une hypothétique `TableColumn.font` cesserait
> d'exister avec la colonne exactement comme `width` et `align`. La condition est donc vraie de tout
> attribut posé sur une colonne, et **elle n'exclut rien de ce qu'on lui demande d'exclure**. La
> reformulation retenue est le test d'**inexprimabilité** : supprimez la notion de colonne, et
> l'attribut n'a plus de site où s'écrire. Une largeur partagée passe ; police, filet, fond,
> espacement échouent, parce qu'ils s'écrivent sur n'importe quel bloc. **Et il faut dire qu'`align`
> échoue lui aussi au test reformulé** — il est retenu par exception nommée, pas par conséquence du
> critère. Un critère qui absout tout ce qu'on lui présente n'est pas un critère.
>
> **(b) La largeur et la page.** La docstring de `width` disait : « *A column's share is `width /
> (sum of the widths of its table)` **of the width the page leaves available*** ». La seconde moitié
> décrète qu'un tableau occupe toujours 100 % de la largeur utile — c'est une règle d'apparence (C5)
> appuyée sur la géométrie de la feuille (C4), et C3 ne possède ni l'une ni l'autre. Le rapport
> inter-colonnes suffit, et **la preuve d'exactitude est intégralement préservée : elle ne porte que
> sur le rapport.**

#### La cellule

```ts
/**
 * What one row puts in one column.
 *
 * A cell NAMES its column instead of being matched to it by position, and that single
 * choice settles three things at once. A row that fills only some columns is a natural
 * shape rather than a run of placeholders -- and the last row of an invoice, a label and an
 * amount, is exactly that shape. Reordering the columns of a table is one array edit rather
 * than one permutation per row that all have to agree in the same order. And nothing in any
 * traversal indexes one array with another's index, which under `noUncheckedIndexedAccess`
 * would yield `T | undefined` at every single pairing, with `!` forbidden to dereference it.
 *
 * The one state keyed pairing leaves representable -- a cell naming a column the table does
 * not declare -- is refused when the template is saved, on the table node that can see both.
 * See {@link TableNode}.
 */
export interface TableCell {
  readonly columnId: string;
  /**
   * Ordinary blocks, so a cell inherits everything the Composite already does: a paragraph,
   * two paragraphs, an image, a condition, a nested loop.
   *
   * A nested table is representable and is not refused. Refusing it one level down would be
   * a fence with a gate, since a `container` placed in the cell would carry one anyway; what
   * bounds nesting is `assertBoundedShape`, which bounds it already and answers `too-deep`,
   * a typed refusal lot C8 can narrate.
   */
  readonly children: readonly BlockNode[];
}
```

#### La ligne, le groupe, l'union de corps

```ts
/**
 * One row: a set of cells, and no repetition of its own.
 *
 * A row is a NODE so that it has an id. Lot C7 marks a block as unbreakable, an engine cuts
 * a page between two rows, and lot E5 reports which row landed on which page: all three need
 * something to point at, and a row that were an inert record would give them nothing.
 */
export interface TableRowNode extends NodeBase {
  readonly type: 'tableRow';
  readonly cells: readonly TableCell[];
}

/**
 * Rows repeated once per item of {@link TableRowGroupNode.each}.
 *
 * ## Why the repetition is here, and not on the table
 *
 * `NodeReads` has exactly two buckets -- expressions read in the ENCLOSING scope, and the
 * children the alias is in scope for -- and no third. So one node cannot both read a list
 * and hold the header that must not see it. Binding on the table would put the row alias in
 * scope for the header and the footer as well, and a heading or a total that mentioned it
 * would be treated as an internal reference: `collectDataPaths` would quietly stop asking
 * the integrator for a key the document really does read, which is the defect ADR 0002
 * fixed for loops.
 *
 * ## Why not a plain LoopNode
 *
 * A loop repeats {@link BlockNode}s, and a row is not a block -- a row outside a table means
 * nothing, which is precisely what the two unions at the bottom of this file say. The shape
 * is otherwise the one this repository already writes twice, `each`/`as` against
 * `source`/`as` on an aggregation, so the Designer reuses the loop widget and the evaluation
 * reuses `evaluateSequence` and `childScope` untouched: no second scope primitive, no
 * reserved name, no new shadowing MECHANISM. It is, in exchange, a FOURTH SITE at which an
 * alias can shadow a caller key, and `collectDataPaths` says so rather than promising
 * otherwise.
 *
 * `each` takes any expression, so "only the lines that were not cancelled" is `filter(...)`
 * and needs no field here. The table adds no sort, no filter and no grouping of its own:
 * they exist in the algebra, and a second spelling would drift.
 */
export interface TableRowGroupNode extends NodeBase {
  readonly type: 'tableRowGroup';
  /** The list to repeat. Evaluated in the ENCLOSING scope, before `as` is bound. */
  readonly each: Expression;
  /** Same rule, and the same `aliasSchema`, as {@link LoopNode.as}. */
  readonly as: string;
  /** At least one. A group of no rows repeats nothing and describes no intent. */
  readonly rows: readonly TableRowNode[];
}

/** What a table body may hold: a fixed row, or repeated ones. */
export type TableBodyNode = TableRowNode | TableRowGroupNode;
```

#### Le nœud tableau

```ts
/**
 * A table of lines: a declared geometry, and three NAMED sections.
 *
 * ## Why the sections are fields and not a role flag
 *
 * Because a consumer must be able to tell them apart without inferring anything, and the
 * field name is what makes that free. A flag on a row -- `role: 'header' | 'body'` -- would
 * need an ordering rule ("all the headers come first") and a refusal to police it. A pattern
 * -- "a container holding a loop holding containers" -- would need a heuristic, and a
 * heuristic is exactly what a named field removes. What each section is FOR at render time
 * is not decided here, and this contract does not describe it: this brick describes, it
 * produces nothing.
 *
 * ## What the footer CANNOT do, said by the type rather than by a docstring
 *
 * `footer` accepts `TableRowNode` and nothing else: no repetition of rows, no row alias, and
 * above all no AGGREGATION FIELD -- there is nowhere on this node to put one. A table
 * therefore cannot sum its own columns, and the last line of an invoice is what the roadmap
 * says it is -- an EXPRESSION OF THE MODEL, `round(sum(...), d, m)`, written by the author
 * and standing in the tree where a reviewer, lot D7's formula bar and a refusal can all
 * point at it. A total computed by the structure would round somewhere no reviewer looks,
 * outside the tree, which ADR 0004 decision 8 refuses.
 *
 * What stays possible INSIDE a footer cell, as inside any cell, is an ordinary block --
 * `loop` included, with its own `each` and its own alias. That is content, not a total the
 * table computed. The structural refusal bears on the FIELD, not on the presence of
 * expressions or aliases in the footer.
 *
 * ## What it does not carry, and who does
 *
 * No border, no shading, no font, no spacing, no per-cell alignment override (lot C5). No
 * page format, no margins (lot C4). No "repeat the header on every page", no widow or orphan
 * policy, no page numbering, no carry-forward (lots E2 and E3). No number format, no
 * currency, no display scale, no column type (lot C6). No rounding default and no
 * per-subtree rounding inheritance (ADR 0004 decision 8).
 */
export interface TableNode extends NodeBase {
  readonly type: 'table';
  /** At least one, ids unique within the table. Array order IS display order. */
  readonly columns: readonly TableColumn[];
  /**
   * The heading rows, identified as such so a consumer does not have to guess which they
   * are. An empty list is a table with no heading; several heading rows are legal and cost
   * nothing.
   */
  readonly header: readonly TableRowNode[];
  /** The content rows: fixed, repeated, or both, in flow order. */
  readonly body: readonly TableBodyNode[];
  /** The closing rows. `TableRowNode` only, on purpose -- see above. */
  readonly footer: readonly TableRowNode[];
}
```

> ⚠️ **Correction de deux raisonnements faux, à ne pas recopier.**
>
> **(a) Le contrat prescrivait le comportement du moteur.** Trois énoncés sont retirés : sur
> `header`, « *Repeated page after page by the engine.* » ; sur `TableNode`, « *it repeats `header`
> at the top of every page, it may cut `body` between two entries, and it keeps `footer` at the end
> of the flow* » ; et, dans `checkCells` [§3.2], « *the columns it skips render empty* ». Le motif
> est écrit dans le dépôt : `docs/roadmap/core.md:271-274` — la brique « **décrit**, elle ne
> **produit** rien » — et D13 refuse **nommément** `repeatHeaderOnEachPage`, la politique de veuve et
> d'orpheline et le point de coupe. **On ne peut pas refuser un champ au motif que le choix
> appartient au moteur et, dans la même docstring, écrire ce que le moteur décidera.** Les rôles
> retenus sont strictement structurels, et l'attente envers E2 et E3 part dans l'ADR 0005, section
> « Conséquences », qualifiée d'attente envers un lot non écrit. Le motif de D9 se réécrit en
> conséquence : le pied ne se justifie pas par « le moteur ne saurait pas qu'elle doit rester en fin
> de flux » — c'est de la pagination — mais par la seule raison qui appartienne à C3, **c'est la
> section dont le TYPE interdit d'agréger**.
>
> **(b) Le pied n'est pas « fixe », il est sans répétition de LIGNES.** L'énoncé retiré est
> « *`footer` holds fixed rows only: no `each`, no alias, nowhere to put one* ». C'est D5 qui le rend
> faux : une cellule contient des `BlockNode[]`, et `LoopNode ∈ BlockNode`. **MESURÉ** : un `footer`
> dont une cellule porte un `loop` avec son `each` et son `as` **parse**. La formulation juste est
> celle de la docstring ci-dessus, et sa conséquence doit être écrite dans l'ADR : **le refus
> structurel porte sur le CHAMP**, pas sur la présence d'expressions ou d'alias dans le pied.

#### Les deux unions, et les deux alias de discriminant

```ts
/**
 * What may appear in a BLOCK FLOW: the children of a container, of a loop, of a condition,
 * of a table cell, and the root of a template.
 *
 * A row and a row group are document nodes -- they have ids, they are walked, they report
 * what they read -- but they mean nothing outside a table. Splitting the union is how that
 * is said to the compiler and to Zod at once, with no semantic validation pass and no
 * refusal to write: a stray `tableRow` under a container simply has no member to match. It
 * narrows three stored positions, and narrows nothing that exists: no version 3 document can
 * carry a row at all.
 */
export type BlockNode = TextNode | ImageNode | ContainerNode | LoopNode | ConditionNode | TableNode;

/** Every node type, rows included. */
export type DocumentNode = BlockNode | TableRowNode | TableRowGroupNode;

/**
 * What a user may INSERT in a block flow -- this, and NOT {@link DocumentNodeType}, is what
 * a block Registry validates against.
 */
export type BlockNodeType = BlockNode['type'];

/**
 * Every discriminant, rows included: the Visitor's domain, and `walk`'s. Not the Registry's.
 */
export type DocumentNodeType = DocumentNode['type'];
```

`DocumentNodeType` existait déjà (`nodes.ts:109-110`) et sa docstring **LU** dit aujourd'hui :
« *Discriminant values, exported so the block Registry can validate a type.* » Après C3, ce type vaut
**huit** membres — `text`, `image`, `container`, `loop`, `condition`, `table`, `tableRow`,
`tableRowGroup` — dont deux qu'un flux de blocs refuse. Un Registry de blocs qui validerait contre
lui **accepterait une ligne là où le schéma la refuse** : la docstring deviendrait fausse à la
livraison, exactement comme la docstring de `maxDepth` [§3.6]. `BlockNodeType` est donc nommé, et
`DocumentNodeType` cesse de se présenter au Registry. Le seul consommateur repéré est
`packages/designer/src/types.ts:3` [§3.9] ; il consomme désormais `BlockNodeType`.

> 🔑 **`BlockNodeType` n'est pas un helper dérivé.** Le critère d'export du dépôt — un consommateur
> immédiat et hors du dépôt — est satisfait deux fois : l'éditeur de blocs du designer, qui existe
> déjà et se trompe déjà, et l'intégrateur qui restreint `allowedBlocks`
> (`packages/designer/src/types.ts:12`). Écrire `BlockNode['type']` sur place chez le consommateur
> recalculerait la liste ; la nommer une fois interdit à deux copies de diverger.

### 3.2 `packages/core/src/ast/schemas.ts` — nouveau (INC-0 le crée, INC-1 l'élargit)

**Ce que fait le fichier aujourd'hui : il n'existe pas.** INC-0 y déplace `nodes.ts:112-190` sans une
ligne changée — `nodeIdSchema`, `TextLiteralSegmentSchema`, `TextBindingSegmentSchema`,
`TextSegmentSchema` avec sa docstring de covariance (`nodes.ts:124-131`), `TextNodeSchema`,
`ImageNodeSchema`, `DocumentNodeSchema`, et les trois schémas de conteneur.

**Ce qu'INC-1 en fait.** Le fichier passe des cinq membres d'une union à **huit membres répartis en
deux unions**, et la répartition est confiée à deux fabriques plutôt qu'à deux listes recopiées.

#### En-tête, fabriques et unions

```ts
import { z } from 'zod/v4';
import { aliasSchema, ExpressionSchema, PrintableExpressionSchema } from '../expression/expression.js';
import {
  type BlockNode,
  type DocumentNode,
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  TABLE_COLUMN_ALIGNMENTS,
  type TableCell,
  type TableNode,
} from './types.js';

const nodeIdSchema = z.string().min(1, 'A node id is required');

/**
 * The members of each family, as functions for the reason `expression/schemas.ts` already
 * gives: they are called from inside a `z.lazy` body, where the temporal dead zone has
 * closed. The two unions below are BUILT from these lists rather than restated, so they
 * cannot drift from each other.
 *
 * What no compiler catches is a member missing from BOTH -- `z.ZodType` is covariant in its
 * output, so a union producing less than its annotation still compiles, and a
 * mutual-assignability assertion on an ANNOTATED schema is tautological. Only a runtime
 * parsing test catches that, and that is why there is one per node type.
 */
function blockMembers() {
  return [
    TextNodeSchema,
    ImageNodeSchema,
    ContainerNodeSchema,
    LoopNodeSchema,
    ConditionNodeSchema,
    TableNodeSchema,
  ] as const;
}

function rowMembers() {
  return [TableRowNodeSchema, TableRowGroupNodeSchema] as const;
}

/**
 * The recursive binding for a block flow. `z.lazy` defers resolution so the schemas below
 * can reference it before they are initialised, and the explicit `z.ZodType<BlockNode>`
 * annotation keeps the inferred type from collapsing.
 *
 * **`.parse` on this schema bounds nothing.** A deep enough payload raises a bare
 * `RangeError` from Zod's own recursion rather than a typed refusal; use `parseBlockNode`
 * from `template/guard.ts` for the bounded door.
 */
export const BlockNodeSchema: z.ZodType<BlockNode> = z.lazy(() =>
  z.discriminatedUnion('type', blockMembers()),
);

/**
 * Every node type, rows included. A row is only ever reached through its table when a
 * template is parsed; this union exists for `parseDocumentNode`, for a Designer validating a
 * subtree it holds in hand, and so `DocumentNode` has one schema.
 */
export const DocumentNodeSchema: z.ZodType<DocumentNode> = z.lazy(() =>
  z.discriminatedUnion('type', [...blockMembers(), ...rowMembers()]),
);
```

Et les trois conteneurs, dont **seule la ligne `children` bouge** :

```ts
export const ContainerNodeSchema = z.object({
  type: z.literal('container'),
  id: nodeIdSchema,
  children: z.array(BlockNodeSchema), // <- `DocumentNodeSchema` avant C3
});

export const LoopNodeSchema = z.object({
  type: z.literal('loop'),
  id: nodeIdSchema,
  each: ExpressionSchema,
  as: aliasSchema,
  children: z.array(BlockNodeSchema), // <- idem
});

export const ConditionNodeSchema = z.object({
  type: z.literal('condition'),
  id: nodeIdSchema,
  when: ExpressionSchema,
  children: z.array(BlockNodeSchema), // <- idem
});
```

> ⚠️ **C'est ici, et pas dans les types, que le lot est le plus fragile.** `blockMembers()` est le
> seul endroit où l'oubli d'un membre ne casse **rien**. **MESURÉ, sur le contrat complet** : en
> retirant `TableNodeSchema` de la liste, `tsc -p tsconfig.typecheck.json` rend **exit 0**,
> `tsc -p tsconfig.json` rend **exit 0**, le build est propre, `biome check` est propre — et le seul
> témoin est `parseTemplate` du modèle de recette, qui échoue au runtime sur
> `{"code":"invalid_union","note":"No matching discriminator","path":["root","children",1,"type"],`
> `"message":"Invalid input"}`. La raison est écrite dans le dépôt depuis C1 (`nodes.ts:124-131`) :
> `z.ZodType<out Output>` est **covariant en sortie**, donc un `z.lazy` qui produit *moins* que son
> annotation lui reste assignable. Et **aucune assertion `MutuallyAssignable` ne peut le rattraper
> sur une union annotée** : `z.infer<typeof BlockNodeSchema>` **est** `BlockNode` par construction —
> **MESURÉ**, l'assertion compile en exit 0 alors même que le membre manque. **Le test de parsing
> d'INC-1 n'est donc pas une commodité, c'est l'unique protection**, et il vit dans le même commit
> [§5.2].

#### Le schéma de colonne, celui de cellule, ceux de ligne

```ts
/**
 * `z.number()` accepts finite values only, so `Infinity` and `NaN` are already refused and a
 * `.finite()` check would never fire. Everything a column can get wrong is decidable without
 * any data, so it is refused when the template is SAVED and adds no entry to the error
 * catalogue lot C8 enumerates.
 */
export const TableColumnSchema = z.object({
  id: z.string().min(1, 'A table column id is required'),
  width: z
    .number({ error: 'A column width is a finite whole number of weight units' })
    .int('A column width is a whole number of weight units, not a length')
    .min(MIN_COLUMN_WIDTH, `A column width may not go below ${MIN_COLUMN_WIDTH}`)
    .max(MAX_COLUMN_WIDTH, `A column width may not exceed ${MAX_COLUMN_WIDTH}`),
  align: z.enum(TABLE_COLUMN_ALIGNMENTS),
});

export const TableCellSchema = z.object({
  columnId: z.string().min(1, 'A table cell must name the column it fills'),
  children: z.array(BlockNodeSchema),
});

export const TableRowNodeSchema = z.object({
  type: z.literal('tableRow'),
  id: nodeIdSchema,
  cells: z.array(TableCellSchema),
});

export const TableRowGroupNodeSchema = z.object({
  type: z.literal('tableRowGroup'),
  id: nodeIdSchema,
  each: ExpressionSchema,
  as: aliasSchema,
  rows: z.array(TableRowNodeSchema).min(1, 'A table row group needs at least one row'),
});

/**
 * Not lazy, and therefore declared AFTER its two members: `rowMembers()` is called here at
 * module-initialisation time, so the temporal dead zone is still open above this line.
 */
export const TableBodyNodeSchema = z.discriminatedUnion('type', rowMembers());
```

Les deux interpolations de `TableColumnSchema` portent des **constantes de module**, jamais du
contenu de document : c'est la seule forme d'interpolation que le paquet pratique déjà
(`expression/schemas.ts:140-141`, sur `MIN_ROUND_DECIMALS` et `MAX_ROUND_DECIMALS`). Le détail des
refus de largeur — **cinq entrées fautives, quatre messages distincts**, `width: 0` et `width: -3`
partageant le message de `too_small`, `Infinity` et `NaN` celui de `z.number()` — est mesuré et
épinglé en [§5.1].

> 🔑 **`TableBodyNodeSchema` est exporté, comme son type.** Une version antérieure du contrat
> exportait le type `TableBodyNode` en laissant son schéma `const` privé : l'éditeur qui insère dans
> `body` — le cas exact du garde-fou D6 du designer — avait le type pour déclarer et **aucune porte
> pour valider**. Tous les autres membres du contrat vont par paire ; celui-ci aussi. Le schéma part
> dans la façade [§3.3] et dans le barrel [§3.8].

#### Le `superRefine`, et l'asymétrie qu'il installe

```ts
/**
 * The two faults a row can have against its table, and the asymmetry between them is
 * deliberate.
 *
 * A row that fills FEWER columns than the table declares is legal: the columns it does not
 * fill receive no content from this row, and that is exactly the shape of a totals row. A
 * cell naming a column that does not exist is refused -- it is content that would never be
 * shown, so accepting it would be a silent loss, the one thing the versioning doctrine of
 * this package exists to prevent. Two cells for one column in one row is refused for the
 * same reason: the second would be dropped.
 *
 * Checked on the TABLE, which is the one node that can see both sides, and one level deep
 * only: a nested table validates its own rows against its own columns. Iteration goes
 * through `entries()`, so nothing here meets `T | undefined` and nothing needs a non-null
 * assertion.
 *
 * No message interpolates the document. The `path` designates the fault exactly -- e.g.
 * `['footer', 0, 'cells', 1, 'columnId']` -- and displaying the offending id is the editor's
 * job: it holds the tree, and it reads it at the path this reports.
 */
function checkCells(
  cells: readonly TableCell[],
  declared: ReadonlySet<string>,
  at: readonly (string | number)[],
  ctx: z.RefinementCtx,
): void {
  const filled = new Set<string>();
  for (const [index, cell] of cells.entries()) {
    const path = [...at, 'cells', index, 'columnId'];
    if (!declared.has(cell.columnId)) {
      ctx.addIssue({
        code: 'custom',
        path: [...path],
        message:
          'This cell names a column the table does not declare. Add that column, or point the cell at one of the declared ids.',
      });
      // Not recorded as filled: a second cell naming the same absent column has the same
      // fault as the first, and reporting the second as a duplicate would name the wrong one.
      continue;
    }
    if (filled.has(cell.columnId)) {
      ctx.addIssue({
        code: 'custom',
        path: [...path],
        message: 'This row already fills this column. A row fills a column at most once.',
      });
    }
    filled.add(cell.columnId);
  }
}

function checkTableWiring(table: TableNode, ctx: z.RefinementCtx): void {
  const declared = new Set<string>();
  for (const [index, column] of table.columns.entries()) {
    if (declared.has(column.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['columns', index, 'id'],
        message:
          'Two columns of this table share an id. A cell names its column, so the ids have to be unique within a table.',
      });
    }
    declared.add(column.id);
  }

  if (declared.size === 0) {
    // `columns.min(1)` has already named the one fault -- and it does NOT stop this function
    // from running, because `too_small` is a continuable issue in zod 4. Walking the rows now
    // would report every cell in the table as an orphan and bury that one fault: measured, 13
    // issues instead of 1 on a twelve-cell table. An author who forgot to declare the columns
    // has ONE thing to fix, and lot C8 has to say it once.
    return;
  }

  for (const [index, row] of table.header.entries()) {
    checkCells(row.cells, declared, ['header', index], ctx);
  }
  for (const [index, entry] of table.body.entries()) {
    // Not a second `switch (node.type)`, and not a traversal: this descends into no child,
    // it reads one node's own two-member body union, and Zod has already discriminated it.
    // The guarantee the Visitor buys is bought here by the narrowing itself -- `entry.rows`
    // only type-checks while `TableBodyNode` has exactly these two members, so widening it
    // breaks the build at this line. Routing it through `visitNode` would make this module
    // depend on the traversal module in order to dispatch two cases.
    if (entry.type === 'tableRow') {
      checkCells(entry.cells, declared, ['body', index], ctx);
    } else {
      for (const [rowIndex, row] of entry.rows.entries()) {
        checkCells(row.cells, declared, ['body', index, 'rows', rowIndex], ctx);
      }
    }
  }
  for (const [index, row] of table.footer.entries()) {
    checkCells(row.cells, declared, ['footer', index], ctx);
  }
}

/**
 * A refined object stays a `ZodObject` in zod 4 -- refinements live inside the schema rather
 * than wrapping it -- so this remains a legal member of the discriminated unions above, lazy
 * ones included. That is a dependency on library behaviour, it is measured, and it is to be
 * replayed on every zod upgrade.
 */
export const TableNodeSchema = z
  .object({
    type: z.literal('table'),
    id: nodeIdSchema,
    columns: z.array(TableColumnSchema).min(1, 'A table needs at least one column'),
    header: z.array(TableRowNodeSchema),
    body: z.array(TableBodyNodeSchema),
    footer: z.array(TableRowNodeSchema),
  })
  .superRefine(checkTableWiring);
```

> ⚠️ **Le garde `declared.size === 0` a failli être supprimé, et il ne doit pas l'être.** La revue de
> contradiction l'a classé « *code mort à supprimer* » au motif que « *Zod n'exécute pas le
> `superRefine` tant que le parse de base a échoué* ». **Faux** : Zod 4 ne saute un `superRefine` que
> sur une issue **abandonnante** (`invalid_type`, `invalid_value`), et `columns.min(1)` rend un
> `too_small`, qui est **continuable**. `checkTableWiring` est donc bien appelé avec `table.columns`
> vide. Le tableau des neuf entrées mesurées, le protocole et le rejeu — 1 issue avec le garde, **13
> sans**, sur le même `dist` — sont en [§5.1], et l'`it` qui l'épingle aussi. La branche est
> **atteinte à chaque tableau sans colonne** : elle se couvre, elle se teste, et sans elle un auteur
> qui a oublié de déclarer ses colonnes reçoit une faute par cellule au lieu d'une.

> ⚠️ **Correction d'un raisonnement faux, à ne pas recopier.** Les trois messages interpolaient le
> document : `This cell fills a column named "${cell.columnId}", which the table does not declare.`
> et `Two columns of this table share the id "${column.id}".`. La règle du dépôt est écrite et
> opposable — ADR 0003:417, « **La charge d'erreur doit rester sûre à journaliser même quand le
> document ne l'est pas.** » **MESURÉ** : `grep -rn 'message:' packages/core/src --include=*.ts | grep
> '\${'` rend **zéro résultat**, et les deux seules interpolations du paquet portent des constantes.
> `columnId` est un `z.string().min(1)` : longueur non bornée, contenu arbitraire, **choisi par
> l'auteur du modèle — qui est l'attaquant du modèle de menace**. Les messages deviennent constants,
> et le `path` porte la désignation, ce qu'il fait déjà exactement. **L'affichage de l'identifiant
> fautif appartient à l'éditeur**, qui tient l'arbre et le lit au chemin fourni : c'est le même
> argument que l'ADR 0003 a écrit pour le champ `at`.

**Un point de gouvernance, et un seul, à ne pas laisser implicite.** Le test
`if (entry.type === 'tableRow')` de `checkTableWiring` **n'est pas** un second `switch (node.type)`
au sens d'AGENTS.md §3.B : il ne descend dans aucun enfant, il lit l'union à deux membres du corps
d'**un** nœud, dans le schéma de ce nœud, et Zod a déjà discriminé la valeur. La garantie qu'achète
le Visitor est ici achetée par le rétrécissement lui-même — `entry.rows` ne type-check que tant que
`TableBodyNode` a exactement ces deux membres, donc **élargir l'union casse le build à cette
ligne**. Router le contrôle par `visitNode` obligerait `ast/schemas.ts` à dépendre de
`ast/visitor.ts` et à écrire huit branches pour en dispatcher deux. C'est l'arbitrage n° 7 [§8], et
**le plan ne se délivre pas la dérogation lui-même** : si le propriétaire du produit lit autrement,
il faut le dire avant INC-1.

### 3.3 `packages/core/src/ast/nodes.ts` — la façade

**Ce que fait le fichier aujourd'hui** : 190 lignes, dont 100 de types et 78 de schémas. **Ce qu'il
fait après INC-0** : rien d'autre que ré-exporter, et c'est tout ce qu'on lui demande. Les quatre
consommateurs internes — `ast/visitor.ts:3-13`, `template/guard.ts:2`, `template/template.ts:2`,
`src/index.ts:9-31` — continuent d'importer `./nodes.js` **sans une ligne changée**, et
`packages/core/src/index.ts` reste **identique octet pour octet** à la sortie d'INC-0. C'est la
preuve mécanique que la surface publique n'a pas bougé, et c'est le critère de sortie de l'incrément
[§4, INC-0].

```ts
/**
 * The document AST (Composite pattern, ADR 0002; widened by ADR 0005).
 *
 * Facade module re-exporting the hand-written node types and their Zod schemas, on the
 * pattern `expression/expression.ts` already executes. Consumers import from here; the split
 * between `types.ts` and `schemas.ts` is internal, and no consumer changed one line when it
 * happened.
 */

export {
  BlockNodeSchema,
  ConditionNodeSchema,
  ContainerNodeSchema,
  DocumentNodeSchema,
  ImageNodeSchema,
  LoopNodeSchema,
  TableBodyNodeSchema,
  TableCellSchema,
  TableColumnSchema,
  TableNodeSchema,
  TableRowGroupNodeSchema,
  TableRowNodeSchema,
  TextBindingSegmentSchema,
  TextLiteralSegmentSchema,
  TextNodeSchema,
  TextSegmentSchema,
} from './schemas.js';
export type {
  BlockNode,
  BlockNodeType,
  ConditionNode,
  ContainerNode,
  DocumentNode,
  DocumentNodeType,
  ImageNode,
  LoopNode,
  TableBodyNode,
  TableCell,
  TableColumn,
  TableColumnAlignment,
  TableNode,
  TableRowGroupNode,
  TableRowNode,
  TextBindingSegment,
  TextLiteralSegment,
  TextNode,
  TextSegment,
} from './types.js';
export { MAX_COLUMN_WIDTH, MIN_COLUMN_WIDTH, TABLE_COLUMN_ALIGNMENTS } from './types.js';
```

**Le décompte, et il est exact.** La façade expose **38 symboles** : 16 schémas, 19 types, 3
constantes. Avant C3 elle en exposait **19** (9 schémas, 10 types, 0 constante) ; le lot en ajoute
donc **19** — 7 schémas (`BlockNodeSchema`, `TableBodyNodeSchema`, `TableCellSchema`,
`TableColumnSchema`, `TableNodeSchema`, `TableRowGroupNodeSchema`, `TableRowNodeSchema`), 9 types
(`BlockNode`, `BlockNodeType`, `TableBodyNode`, `TableCell`, `TableColumn`, `TableColumnAlignment`,
`TableNode`, `TableRowGroupNode`, `TableRowNode`) et 3 constantes.

> 🔑 **Le chiffre de dix-sept qui circulait avant la revue de contradiction est périmé.** Il ne
> comptait ni `BlockNodeType` (nommé pour que `DocumentNodeType` cesse de mentir au Registry), ni
> `TableBodyNodeSchema` (exporté pour que le type et son schéma restent une paire). **Dix-neuf**, et
> c'est le nombre à vérifier à la relecture de la PR — parce que **rien d'autre ne le vérifiera**
> [§3.8].

Ce que la façade **ne** ré-exporte **pas** : `NodeBase`, qui reste local à `types.ts` comme
aujourd'hui, et `nodeIdSchema`, qui reste local à `schemas.ts`. Aucun des deux n'a de consommateur
hors du fichier, et un `id` de colonne réutilise `z.string().min(1)` avec son propre message — pas
`nodeIdSchema`, parce qu'une colonne n'est pas un nœud et qu'un message parlant de « node id »
mentirait à l'auteur.

### 3.4 `packages/core/src/ast/visitor.ts`

**Ce que fait le fichier aujourd'hui** : il porte **le seul `switch (node.type)` du dépôt**
(`visitor.ts:36-56`), scellé par `const exhaustive: never = node` à la ligne 50, et cinq
consommateurs de ce dispatch — `childrenOf`, `walk`, `findNodeById`, `nodeReads`, `collectFrom`.

**Ce qui change, et ce que le compilateur en rattrape.** **MESURÉ**, en trois étapes, sur le
`tsconfig.typecheck.json` du dépôt (celui de la porte 3), baseline exit 0 :

| Étape | Édition | Résultat |
| :--- | :--- | :--- |
| 1 | Élargir `DocumentNode` seul (`types.ts`) | **1 erreur** — `visitor.ts(50,13): TS2322: Type 'TableNode' is not assignable to type 'never'` |
| 2 | Ajouter les 3 membres d'interface et les 3 `case` | **4 erreurs** — `childrenOf` (`visitor.ts:62`), `READS_VISITOR` (`visitor.ts:141`), `visitor.test.ts:56`, `visitor.test.ts:82`, toutes `TS2741: Property 'table' is missing` |
| 3 | Compléter les quatre littéraux | **exit 0** |

**Six coutures, toutes tenues par le compilateur** — trois dès la porte 2, les trois harnais de
test à la porte 3 [§4, INC-1] —, et c'est exactement ce que le Visitor achète. Ce que
la porte 3 **ne** tient **pas** est en [§3.2] et en [§3.8].

L'interface :

```ts
export interface NodeVisitor<TResult> {
  readonly text: (node: TextNode) => TResult;
  readonly image: (node: ImageNode) => TResult;
  readonly container: (node: ContainerNode) => TResult;
  readonly loop: (node: LoopNode) => TResult;
  readonly condition: (node: ConditionNode) => TResult;
  readonly table: (node: TableNode) => TResult;
  readonly tableRowGroup: (node: TableRowGroupNode) => TResult;
  readonly tableRow: (node: TableRowNode) => TResult;
}
```

Les trois `case`, insérés **avant** la branche `default` de `visitNode` :

```ts
// packages/core/src/ast/visitor.ts, dans le switch
    case 'table':
      return visitor.table(node);
    case 'tableRowGroup':
      return visitor.tableRowGroup(node);
    case 'tableRow':
      return visitor.tableRow(node);
```

Et la liste d'import de tête (`visitor.ts:3-13`) gagne `TableNode`, `TableRowGroupNode` et
`TableRowNode`, en `import type`.

#### `childrenOf` — le site le plus structurant du lot

```ts
/**
 * The direct children of a node; leaves report none.
 *
 * A table reports its three sections in flow order, a group its rows, and a row the blocks
 * of its cells. The column boundary is flattened here on purpose: this function answers a
 * question about DESCENT and SCOPE, not about layout. What matters is that everything a
 * table contains is reachable -- a subtree this function does not report is invisible to
 * `walk`, `findNodeById` and `collectDataPaths` alike, with no error anywhere.
 *
 * Two consequences a consumer has to know.
 *
 * **Only four of the eight branches return the stored reference.** `container`, `loop`,
 * `condition` and `tableRowGroup` do. `table` builds a fresh array by spread and `tableRow`
 * builds one by `flatMap`; and the two leaves return an empty literal, which is a fresh array
 * on every call as well -- `childrenOf(text) === childrenOf(text)` is FALSE. So the identity
 * of the result is not stable between two calls, and NOTHING MAY BE MEMOISED ON IT.
 *
 * **Attributing a node to a COLUMN does not go through here.** The cell boundary is erased
 * by the flattening, so a consumer that needs the column of a node reads the table node
 * itself -- table id plus the cell's `columnId` -- and never the traversal. No precomputed
 * index is provided, because no consumer exists yet to need one.
 */
export function childrenOf(node: DocumentNode): readonly DocumentNode[] {
  return visitNode<readonly DocumentNode[]>(node, {
    text: () => [],
    image: () => [],
    container: (container) => container.children,
    loop: (loop) => loop.children,
    condition: (condition) => condition.children,
    table: (table) => [...table.header, ...table.body, ...table.footer],
    tableRowGroup: (group) => group.rows,
    tableRow: (row) => row.cells.flatMap((cell) => cell.children),
  });
}
```

**MESURÉ**, sur le modèle du critère de recette [§6.2] : `walk` appelle `childrenOf` **19 fois** —
une fois par nœud — et le décompte se ventile en **19 = 4 + 13 + 2** : **4** appels rendent un
tableau **calculé** (le nœud `table` par spread, et les trois `tableRow` par `flatMap` : en-tête,
ligne de détail, ligne de total), **13** rendent le littéral vide des nœuds texte, **2** rendent une
référence stockée (le conteneur racine et le groupe). Le décompte est celui du modèle exécuté, pas
une estimation.

> ⚠️ **Correction d'un décompte mal étiqueté, à ne pas recopier.** Une rédaction antérieure écrivait
> « **4 appels allouants** » sur 19, et [§5.3] reprenait le chiffre. **C'est l'étiquette qui est
> fausse, pas le nombre :** `text: () => []` construit un **tableau neuf à chaque appel**, donc les
> 13 appels de feuille allouent eux aussi — **17 des 19 appels allouent**, et seuls les 2 qui rendent
> une référence stockée n'allouent pas. Ce qui vaut **4**, c'est le nombre d'appels rendant un
> tableau **calculé et non vide**. La règle destinée au consommateur — *ne rien mémoïser sur
> l'identité du résultat* — n'en est pas affaiblie, elle en est **élargie** : elle vaut pour six
> branches sur huit, pas deux, et `childrenOf(text) === childrenOf(text)` est **`false`**. Un chiffre
> juste sous une étiquette fausse est un chiffre faux — c'est la formule que ce plan applique déjà
> aux 231 valeurs de [§2, D12], et elle vaut ici.

> 🔑 **L'aplatissement des cellules est un choix, pas un oubli, et il a un coût nommé.** Il rend
> `collectDataPaths` correct sans effort — le contenu d'une cellule est lu dans la portée de sa
> ligne, donc du groupe qui la porte — et il rend impossible de retrouver la colonne d'un nœud
> depuis le parcours. Le renderer n'en souffre pas : il lit le nœud tableau, qui porte les colonnes
> **et** les cellules avec leur `columnId`. Un index précalculé serait la cérémonie que la règle
> anti-sur-ingénierie nomme : **on l'écrira le jour où un consommateur réel le demandera**, pas
> avant.

#### `READS_VISITOR` — trois branches, et la raison de chacune

```ts
const READS_VISITOR: NodeVisitor<NodeReads> = {
  text: (text) => ({
    reads: text.content.flatMap((segment) => visitSegment(segment, SEGMENT_EXPRESSIONS)),
    binds: undefined,
  }),
  image: () => NO_READS,
  container: () => NO_READS,
  loop: (loop) => ({ reads: [loop.each], binds: loop.as }),
  condition: (condition) => ({ reads: [condition.when], binds: undefined }),
  // A table reads nothing and binds nothing: its geometry holds no expression, and its
  // header and footer must not see a row alias. The repetition is one level down, which is
  // the whole reason `tableRowGroup` is a node of its own.
  table: () => NO_READS,
  tableRowGroup: (group) => ({ reads: [group.each], binds: group.as }),
  // A cell holds nodes, and each of them reports its own reads.
  tableRow: () => NO_READS,
};
```

`NodeReads.binds` reste **un** nom unique. L'élargir en liste ferait fuiter l'alias d'une expression
vers des enfants qui n'ont pas à le lire — c'est écrit dans la docstring de `collectDataPaths`
(`visitor.ts:253-256`), et C3 ne le rouvre pas.

#### La quatrième limite de `collectDataPaths`

La docstring actuelle (`visitor.ts:230-231`) annonce : « *THREE limits, all deliberate, and all
narrower than an earlier version of this docstring claimed.* » **Ce compte devient faux à la
livraison** : `TableRowGroupNode.as` est un quatrième site d'alias. Deux éditions, dans le **même**
commit que le nœud — l'omettre referait exactement ce que l'ADR 0002 reproche à l'ancienne docstring,
*elle promet, elle ment*.

```ts
// packages/core/src/ast/visitor.ts, docstring de collectDataPaths
 * FOUR limits, all deliberate, and all narrower than an earlier version of this
 * docstring claimed.
```

et, inséré **avant** le paragraphe « *What is NOT a limit* » :

```ts
 * Lot C3 adds a FOURTH site, and it is the same one again: `TableRowGroupNode.as`. It
 * shadows exactly as a loop alias does -- innermost wins -- and it is reported here exactly
 * as little. What it does NOT do is widen the hole: a group binds over its own rows and over
 * nothing else, so a heading or a total that names the alias stays a caller key and is still
 * demanded from the integrator.
```

**MESURÉ** sur le modèle de recette : `collectDataPaths` rend
`['facture.numero', 'facture.lignes']` — aucun `ligne.*`, aucun `l.*`. Et un alias de groupe employé
**hors** de son groupe redevient bien une clé d'appelant. Les deux propriétés sont épinglées en
[§5.3].

`collectFrom` (`visitor.ts:210-220`), `walk` (`:75-80`), `findNodeById` (`:82-89`) et `nodeReads`
(`:167-169`) **ne sont pas touchés**, et c'est délibéré : la descente passe par `childrenOf`, comme
`visitor.ts:205-208` l'écrit déjà.

### 3.5 `errors.ts` et `evaluator/evaluate.ts` — le site, et son libellé

**Ce que fait `errors.ts:80` aujourd'hui** : `export type ExpressionErrorSite = ExpressionKind |
'loop' | 'condition';`, avec la docstring qui explique pourquoi le champ s'appelle `site` et non
`kind`. C3 y ajoute **un membre**, et **zéro code**. `OPERAND_ERROR_CODES`, `LIMIT_ERROR_CODES` et
`SHAPE_ERROR_CODES` sont inchangés — c'est le meilleur résultat qu'un lot puisse offrir à C8 [§2,
D10].

```ts
/**
 * Where the failure happened.
 *
 * `ExpressionKind` alone does not cover it: `LoopNode.each`, `ConditionNode.when` and
 * `TableRowGroupNode.each` carry an expression without BEING one, so a failure evaluating a
 * table body's list source has no expression kind to report. The field is called `site` and
 * not `kind` for that reason.
 */
export type ExpressionErrorSite = ExpressionKind | 'loop' | 'condition' | 'tableRowGroup';
```

```ts
// packages/core/src/expression/evaluator/evaluate.ts:198-203
const LIST_CALLER_SUBJECTS: Readonly<Partial<Record<ExpressionErrorSite, string>>> = {
  loop: 'A loop',
  tableRowGroup: 'A table body', // <- l'ajout
  aggregate: 'An aggregation',
  count: 'A count',
  filter: 'A filter',
};
```

> ⚠️ **Les deux lignes vont dans le même commit, et ce n'est pas une préférence de découpage.**
> `LIST_CALLER_SUBJECTS` est un `Partial<Record<…>>` : **ajouter le site sans le libellé ne casse
> rien**, ni à la compilation ni au lint, et le message retombe silencieusement sur le défaut
> `'An expression'` (`evaluate.ts:231`). Un auteur qui a écrit un tableau lirait alors « An
> expression needs a list to iterate over » — ou pire, s'il avait réutilisé le site `'loop'`, « A
> loop needs a list to iterate over », alors qu'il n'a écrit aucune boucle. C'est **exactement le
> défaut que le commentaire de cette table (`evaluate.ts:184-197`) existe pour décrire** : « *Wired
> to the list-reducing expression kinds ADR 0003 adds, it would say **loop** to whoever wrote a sum
> -- a direct C8 miss, in the lot C8 depends on.* » **MESURÉ** :
> `evaluateSequence(path('facture'), { facture: 3 }, { caller: 'tableRowGroup' })` rend
> `A table body needs a list to iterate over, got a number.` Un test épingle cette chaîne [§5.2].

Le site s'appelle `tableRowGroup` et non `table` parce que **le nœud qui appelle `evaluateSequence`
s'appelle `tableRowGroup`**, et que les trois sites existants nomment tous le type du nœud. Aucune
autre ligne d'`evaluate.ts` ne bouge : le `switch` de l'évaluateur (`evaluate.ts:78-159`) ne connaît
que les dix-neuf kinds d'expression, et **un nœud de document n'est pas une expression**.
`evaluator/scope.ts:78-82` (`childScope`) se réutilise inchangé pour l'alias de ligne, comme l'ADR
0003 l'a fait pour `aggregate` et `filter`.

### 3.6 `packages/core/src/template/guard.ts` — la porte bornée manquante, et la docstring qui mentirait sinon

**C'est la sous-section que le découpage initial avait oubliée**, et elle porte **deux** choses sans
rapport l'une avec l'autre, réunies par le seul fait qu'elles vivent dans le même fichier. Les deux
entrent dans INC-1.

#### (a) `parseBlockNode`

**Ce que fait le fichier aujourd'hui** : il expose deux portes bornées, `parseExpression`
(`guard.ts:256-259`) et `parseDocumentNode` (`guard.ts:262-265`), chacune étant
`assertBoundedShape` suivi d'un `.parse`. Leur raison d'être est écrite à `guard.ts:242-255` : un
schéma Zod nu **ne borne rien**, et un payload assez profond rend un `RangeError` **nu**, qui n'est
ni un `OpenviewError` ni un `TemplateMigrationError` — ce que l'ADR 0003 décision 8 existe pour
supprimer.

C3 crée **une union neuve et publique**, `BlockNodeSchema`, et **lui seul n'a pas de porte**.

```ts
// packages/core/src/template/guard.ts, à la suite de parseDocumentNode
/** Parses a standalone BLOCK node WHILE BOUNDING IT. See {@link parseExpression}. */
export function parseBlockNode(raw: unknown, limits?: Partial<ShapeLimits>): BlockNode {
  assertBoundedShape(raw, limits);
  return BlockNodeSchema.parse(raw);
}
```

et l'import de tête (`guard.ts:2`) devient :

```ts
import {
  type BlockNode,
  BlockNodeSchema,
  type DocumentNode,
  DocumentNodeSchema,
} from '../ast/nodes.js';
```

> ⚠️ **Correction d'un raisonnement faux, à ne pas recopier.** La docstring de `BlockNodeSchema`
> renvoyait, dans sa première rédaction, vers la porte de l'**autre** union : « *use
> `parseDocumentNode` from `template/guard.ts` for the bounded door* ». `parseDocumentNode` valide
> `DocumentNodeSchema`, qui **accepte une `tableRow` nue** — exactement ce qu'un flux de blocs
> refuse. Le renvoi n'aurait donc pas seulement été inopérant, il aurait orienté un intégrateur vers
> une validation **plus permissive que le contrat**. Et le trou est réel : **MESURÉ**,
> `BlockNodeSchema.parse` d'une chaîne de 2 000 `container` imbriqués rend `RangeError: Maximum call
> stack size exceeded` — le `RangeError` nu que les portes bornées existent pour supprimer, rouvert
> pour la seule union que le lot ajoute. Trois lignes, un consommateur immédiat et hors du dépôt —
> l'intégrateur qui valide un sous-arbre de blocs avant de le stocker : le critère d'export est
> satisfait, et l'anti-sur-ingénierie ne s'y oppose pas, **parce que ce n'est pas un helper dérivé,
> c'est la porte manquante d'une union neuve.** `parseBlockNode` part dans le barrel [§3.8].

#### (b) La docstring de `maxDepth`

**Ce que dit le fichier aujourd'hui** (`guard.ts:37-40`) :

```ts
   * JSON levels, **not** document nodes. Measured on a realistic model: 10 levels, and 12
   * with an `aggregate(filter(...))`. 64 leaves a fivefold margin. The unit has to be
   * written down -- a reader who thinks these are blocks will pick an absurd value.
```

**Le modèle de recette de C3 pèse 18 niveaux** (MESURÉ, `assertBoundedShape` du dépôt, racine =
niveau 1) : la marge de 64 n'est plus quintuple, elle est de 3,5×, et le « modèle réaliste » du dépôt
n'est plus celui-là. Or **D12 refuse tout plafond nouveau en s'appuyant sur cette mesure** [§2, D12].
Laisser le fichier qui la porte dire le contraire, c'est la faute que le plan C2 a consacré sa §3.6
entière à corriger (« `limits.ts` — la liste qui mentirait sinon ») : le précédent est écrit et
opposable.

```ts
   * JSON levels, **not** document nodes. Measured on a realistic model: 10 levels, 12 with
   * an `aggregate(filter(...))`, and 18 for the five-column table of lot C3 with its header
   * and a `round(sum(round(mul)))` footer. 64 leaves a threefold margin, and nine nested
   * tables are accepted before `too-deep`. The unit has to be written down -- a reader who
   * thinks these are blocks will pick an absurd value.
```

**Rien d'autre ne bouge dans ce fichier.** `DEFAULT_SHAPE_LIMITS` reste
`{ maxDepth: 64, maxNodes: 100_000 }` — le modifier relèverait d'AGENTS.md §7, et rien ne le demande.
La docstring de `maxNodes` (`guard.ts:43-54`) est inchangée. `assertBoundedShape`, `childValuesOf`
et `indicesOf` sont agnostiques aux types de nœud : **aucune modification**.

Les étiquettes de mesure, exactement : **modèle de recette complet — 18 niveaux, 231 valeurs ; nœud
tableau seul — 15 niveaux, 210 valeurs.** Une version antérieure attachait « 231 valeurs » au nœud
tableau seul ; les deux chiffres ne décrivent pas le même objet et ils portent désormais leur
étiquette.

### 3.7 `packages/core/src/template/template.ts` et `migrate.ts` — l'estampille

**Ce que font les fichiers aujourd'hui** : `template.ts:63` porte `CURRENT_SCHEMA_VERSION = 3`, et sa
docstring (`:4-62`) énumère deux sections, « ## What version 2 means » et « ## What version 3
means », précédées de la doctrine complète — la **perte silencieuse** et le **refus illisible**.
`migrate.ts:20-94` porte deux entrées, `1 → 2` et `2 → 3`, toutes deux des estampilles pures.

C3 est le cas **refus illisible**, pour la troisième fois et sans variante. **MESURÉ** : un document
estampillé 3 portant un `{ type: 'table', … }` rend, sur un build v3,
`{"code":"invalid_union","note":"No matching discriminator","path":["root","children",0,"type"],`
`"message":"Invalid input"}` — ni erreur typée, ni version nommée, aucun remède. Avec l'estampille,
le même document rend `TemplateMigrationError: Template uses schema version 4 but this build
understands at most 3. It was written by a newer release of Openview; upgrade before opening it.`

```ts
/**
 * ## What version 4 means
 *
 * Version 4 is version 3 plus lot C3, the table of lines: THREE stored node types --
 * `table`, `tableRowGroup` and `tableRow` -- a declared column list carrying an id, a
 * whole-number width weight and an alignment, and cells keyed by column id. Eight document
 * node types. It also SPLITS the node union in two: the children of a container, of a loop,
 * of a condition and of a table cell are BLOCKS, so a bare row cannot stand in a document
 * flow.
 *
 * It is the ILLEGIBLE REFUSAL case described above, a third time and unchanged: a version 3
 * build meeting `{ type: 'table', ... }` answers `"No matching discriminator"` / `"Invalid
 * input"` on a path like `root.children.0.type`, with no version named and no remedy.
 * "Purely additive" is once more the argument FOR the bump, not against it.
 *
 * Stamped ONCE, after the last persisted shape of the lot. No commit of C3 before that one
 * is publishable, for the reason version 2 already records.
 */
export const CURRENT_SCHEMA_VERSION = 4;
```

```ts
// packages/core/src/template/migrate.ts, TROISIÈME entrée de TEMPLATE_MIGRATIONS
  {
    from: 3,
    to: 4,
    /**
     * Identity, except for the stamp -- and the stamp is the entire point, for the third
     * time and for exactly the reason the 1 -> 2 entry states.
     *
     * A v3 document is STRUCTURALLY a v4 document: lot C3 only WIDENED the node union, so
     * there is nothing to transform, and the shape it yields is bounded because it changes
     * neither depth nor value count -- which is what the repository owes itself since the
     * guard runs twice.
     *
     * The narrowing that comes with it -- a block flow no longer accepting a bare row --
     * cannot bite an existing document either, since no v3 document can carry a row at all.
     * Nor is the column width window retrofitted, for the same reason the `decimals` window
     * was not: there is nothing to retrofit. That is the whole difference between adding a
     * shape and tightening an existing one, and it is why lot C3 adds no fifth value
     * narrowing to the four the pre-v1.0 assumption already carries.
     *
     * The reserve of the two entries above transposes word for word: the version guard reads
     * the STAMP, not the content. A document stamped `3` but already holding a `table` node
     * -- hand-made, or written by an unstamped mid-lot build -- is not refused. It parses,
     * and comes out `schemaVersion: 4`.
     */
    migrate: (input) => ({ ...input, schemaVersion: 4 }),
  },
```

> ⚠️ **Ne pas fusionner l'entrée avec `2 → 3`, et ne pas transformer `1 → 2` en `1 → 4`.** La marche
> pas-à-pas est le contrat écrit de `migrate.ts:7-9` (« *a v1 document opened by a v12 release walks
> v1 -> v2 -> ... -> v12* »), et `migrate.test.ts:313-333` compose une étape synthétique **avec le
> registre réel**. Une migration qui n'estampille que **n'est pas** une migration fantôme : elle
> estampille, et l'estampille est *tout* ce qui produit le second message ci-dessus.
>
> **Et rien ne réclame ce bump.** **MESURÉ** : aucun compilateur, aucun lint, aucune des quatre
> portes n'exige l'incrément. Le seul témoin est `migrate.test.ts:140-145`, dont l'attendu passe de
> `[[1,2],[2,3]]` à `[[1,2],[2,3],[3,4]]` — et il ne rougit que si on l'a écrit avec la bonne
> longueur attendue. C'est pour cette raison que l'estampille est un incrément à elle seule [§4,
> INC-3], et qu'elle est **le premier commit publiable du lot**.

`template.ts:85` — `root: ContainerNodeSchema` — est **inchangé** : un tableau n'est pas une racine,
et la racine reste un conteneur. Le changement de type de `ContainerNode.children` [§3.1] suffit à
faire entrer un tableau dans un document, sans toucher une ligne du schéma de `Template`.

### 3.8 Les deux barrels — le point aveugle des quatre portes

```ts
// packages/core/src/index.ts -- bloc de types de ./ast/nodes.js
export type {
  BlockNode,
  BlockNodeType,
  ConditionNode,
  ContainerNode,
  DocumentNode,
  DocumentNodeType,
  ImageNode,
  LoopNode,
  TableBodyNode,
  TableCell,
  TableColumn,
  TableColumnAlignment,
  TableNode,
  TableRowGroupNode,
  TableRowNode,
  TextBindingSegment,
  TextLiteralSegment,
  TextNode,
  TextSegment,
} from './ast/nodes.js';

// packages/core/src/index.ts -- bloc de valeurs de ./ast/nodes.js
export {
  BlockNodeSchema,
  ConditionNodeSchema,
  ContainerNodeSchema,
  DocumentNodeSchema,
  ImageNodeSchema,
  LoopNodeSchema,
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  TABLE_COLUMN_ALIGNMENTS,
  TableBodyNodeSchema,
  TableCellSchema,
  TableColumnSchema,
  TableNodeSchema,
  TableRowGroupNodeSchema,
  TableRowNodeSchema,
  TextBindingSegmentSchema,
  TextLiteralSegmentSchema,
  TextNodeSchema,
  TextSegmentSchema,
} from './ast/nodes.js';

// packages/core/src/index.ts:153-159 -- bloc de valeurs de ./template/guard.js
export {
  assertBoundedShape,
  DEFAULT_SHAPE_LIMITS,
  parseBlockNode, // <- l'ajout
  parseDocumentNode,
  parseExpression,
  resolveShapeLimits,
} from './template/guard.js';
```

**Le décompte, compté et non estimé : vingt symboles nouveaux — neuf types et onze valeurs.**

*Types (9), depuis `./ast/nodes.js`* : `BlockNode`, `BlockNodeType`, `TableBodyNode`, `TableCell`,
`TableColumn`, `TableColumnAlignment`, `TableNode`, `TableRowGroupNode`, `TableRowNode`.

*Valeurs (11)* : depuis `./ast/nodes.js` — `BlockNodeSchema`, `MAX_COLUMN_WIDTH`,
`MIN_COLUMN_WIDTH`, `TABLE_COLUMN_ALIGNMENTS`, `TableBodyNodeSchema`, `TableCellSchema`,
`TableColumnSchema`, `TableNodeSchema`, `TableRowGroupNodeSchema`, `TableRowNodeSchema` (**10**) ; et
depuis `./template/guard.js` — `parseBlockNode` (**1**).

Le barrel touche donc **trois blocs d'export**, pas deux, et c'est la conséquence directe de [§3.6] :
la porte bornée d'une union vit avec les autres portes bornées, pas avec les schémas.

> 🔑 **Aucune des quatre portes ne voit un export oublié ici.** Ni `biome check`, ni `tsc -p
> tsconfig.json`, ni `tsc -p tsconfig.typecheck.json`, ni `vitest --coverage` : un symbole absent de
> `index.ts` est simplement un symbole que personne à l'extérieur ne peut nommer, et rien dans le
> paquet ne s'en plaint. Le seul détecteur du dépôt est `apps/playground/src/App.tsx`, qui le dit de
> lui-même (`App.tsx:36-37`) : « *the ONLY real consumer of the package barrel, so it is what reveals
> an export forgotten in index.ts -- a blind spot of all four gates on the core side* ». **Encore
> faut-il que le playground s'en serve** : c'est une raison de plus pour qu'INC-4 (c) existe [§4], et
> c'est pourquoi son critère de sortie nomme les vingt symboles.

**Le critère d'export, et pourquoi il ne s'étend à rien de plus.** Le précédent est l'ADR 0004 sur
`RoundExpressionSchema`, `MIN_ROUND_DECIMALS` et `MAX_ROUND_DECIMALS` : un symbole s'exporte quand il
a un **consommateur immédiat et hors du dépôt**. Les onze valeurs l'ont — l'intégrateur ou l'éditeur
qui construit un tableau par programme et le valide avant de le stocker, cas qui existe dès la
première intégration et pas dans trois mois. **Aucun helper dérivé n'est exporté** :
`resolveColumnWidths(table)`, `rowsOf(table)`, `columnOf(table, cell)` n'ont **aucun consommateur
aujourd'hui**, chacun coûterait un parcours de plus, et extraire une fonction plus tard est facile là
où retirer une abstraction ne l'est jamais. Le refus est écrit ici pour qu'il ne soit pas rediscuté à
la première PR d'éditeur.

### 3.9 `packages/designer/src/types.ts` — la liste dérivée

**Ce que fait le fichier aujourd'hui** (`types.ts:1-3`) :

```ts
import type { Template } from '@openview/core';

export type BlockType = 'text' | 'image' | 'container' | 'table' | 'loop' | 'condition';
```

Six membres, écrits à la main, **sans aucun lien de type avec `core`** — et la liste contient déjà
`'table'` alors qu'aucun nœud de ce nom n'existe dans le contrat. Elle est donc, aujourd'hui, **juste
par accident** : elle décrit un contrat que `core` ne porte pas encore, et rien dans les quatre
portes ne le signale. `BlockType` alimente `OpenviewDesignerOptions.allowedBlocks`
(`types.ts:12`) et sort par `packages/designer/src/index.ts`.

**Ce qu'INC-4 (b) en fait** : exactement les mêmes six membres, mais par construction.

```ts
import type { BlockNodeType, Template } from '@openview/core';

/**
 * Derived, not restated. The hand-written list this replaces already contained `'table'`
 * while `core` had no such node: it was right by accident, and nothing in the four gates
 * said so. Derivation makes "what a user may insert" exactly "what a block flow accepts",
 * and a ninth node type cannot slip past it.
 */
export type BlockType = BlockNodeType;
```

**Trois précisions, et la troisième est celle qui compte.**

`BlockNodeType` plutôt que `BlockNode['type']` recalculé sur place : la liste est nommée une fois,
dans `core` [§3.1], et deux calculs de la même chose sont deux choses libres de diverger. C'est le
même argument que `blockMembers()` [§3.2], un cran plus haut.

`BlockNodeType` plutôt que `DocumentNodeType` : après C3, `DocumentNodeType` vaut **huit** membres
dont `tableRow` et `tableRowGroup`. Un `allowedBlocks: ['tableRow']` serait accepté par le type et
refusé par le schéma — un éditeur qui proposerait d'insérer une ligne dans un flux de blocs
produirait un document que `parseTemplate` rejette. C'est précisément ce que C-11 corrige en amont
[§3.1].

Et la dérivation est **une confirmation indépendante que la coupure `BlockNode` désigne la bonne
chose** : la liste que six mois de designer avaient écrite à la main pour répondre à la question
« qu'est-ce qu'un utilisateur peut insérer ? » est, membre pour membre, l'union que C3 écrit pour
répondre à la question « qu'est-ce qu'un flux de blocs accepte ? ». Les deux questions n'étaient pas
posées par les mêmes gens ni au même moment, et elles rendent la même réponse. C'est le seul fichier
hors `core` que le lot corrige, et il le corrige **par dérivation**, pas par recopie.

---

## 4. Les six incréments

Chacun passe les quatre portes seul et laisse le dépôt cohérent. **Cohérent n'est pas publiable.**
Trois des six laissent le dépôt dans un état où un document enregistré porterait une estampille qui
ne décrit plus sa forme, et [§2, D11] en tire une règle de conduite plutôt qu'une évaluation au cas
par cas : **INC‑0, INC‑1 et INC‑2 sont non publiables ; le premier commit publiable du lot est
INC‑3.**

Enchaînement des portes, identique à la CI (`AGENTS.md` §4) :

```bash
pnpm run lint && pnpm run build && pnpm run type-check && pnpm run test:coverage
```

Dépendances entre incréments :

```
INC-0 ──► INC-1 ──► INC-2 ──► INC-3 ──► INC-4 ──► INC-5
(découpe)  (forme)   (site)  (estampille) (barrel)  (ADR)
  │          │                    ▲          │ (a) core
  │          └── seule forme      │          │ (b) designer
  │              persistée du lot │          └─ (c) playground
  └── refactor pur,               │
      surface publique inchangée  └── premier commit PUBLIABLE
```

La chaîne est linéaire et **aucune parallélisation n'est utile**, mais elle ne l'est pas pour la
raison qu'invoquait C2 (« le lot est S ») : C3 est un lot L, et ce qui interdit de le paralléliser
est que ses quatre premiers incréments réécrivent les **mêmes cinq fichiers** dans un ordre imposé.
Les trois commits d'INC‑4, eux, touchent trois paquets disjoints et pourraient se faire en parallèle
— sauf que (b) et (c) ne compilent qu'après (a), ce qui est exactement leur intérêt [§3.8].

**Point de collision git, et il est plus large que celui de C2.** INC‑0 **déplace** deux fichiers de
test (`src/ast/nodes.test.ts` → `src/ast/__tests__/nodes.test.ts`, idem pour `visitor.test.ts`) et
**scinde** un troisième (`nodes.ts`, 190 lignes, types en `:23-110` et schémas en `:112-190`, lu). Un
déplacement plus une scission est le pire cas de la détection de renommage : une branche concurrente
qui éditerait `src/ast/nodes.ts` ou `src/ast/nodes.test.ts` pendant INC‑0 produirait un conflit que
`git merge` ne sait pas résoudre par renommage, parce que le contenu a migré vers **deux** fichiers
nouveaux à la fois. **Ne pas ouvrir de branche concurrente sur `packages/core/src/ast/` tant qu'INC‑1
n'est pas fusionné.** Les autres fichiers du lot sont mono‑incrément : `template/guard.ts` n'est
touché que par INC‑1, `errors.ts` et `evaluator/evaluate.ts` que par INC‑2, `template/` que par
INC‑3, `index.ts` que par INC‑4.

**Point de coupe, du plus sacrifiable au moins.** Un lot L sans ordre de sacrifice écrit est le lot
où l'on coupe l'estampille ou l'ADR sous la pression, c'est‑à‑dire les deux seules pièces qui ne se
rattrapent pas. Le critère « prêt quand » de C3 nomme un modèle et une dernière ligne, et les deux
vivent dans `packages/core/src/ast/__tests__/table.test.ts` [§6.2]. Ce qui est coupable, dans cet
ordre :

1. **INC‑4 (c), la démonstration au playground.** Elle coûte une démonstration et aucun contrat. Le
   prix est nommé : le seul détecteur d'un export oublié disparaît avec elle [§3.8], et l'écart de
   §6.3 devient un critère qu'on affirme au lieu de le montrer.
2. **INC‑4 (b), la dérivation de `BlockType` dans le designer.** La liste écrite à la main reste
   juste **par accident**, comme aujourd'hui. Coupe la moins chère du lot : deux lignes, et le défaut
   qu'elle corrige n'a encore jamais mordu.
3. **INC‑2, le site et son libellé.** Le message d'un corps de tableau non itérable retombe sur
   « *An expression needs a list to iterate over* » — un défaut de C8 dans un lot dont C8 dépend
   [§2, D10]. Coupable parce qu'il ne touche aucune forme persistée ; à ne couper qu'en sachant que
   le rattrapage est un `feat(core)` séparé, pas une retouche.
4. **INC‑0, le découpage de `ast/`** — et **seulement avant qu'INC‑1 n'ait commencé.** Après, ce
   n'est plus une coupe, c'est une réécriture : INC‑1 écrit dans `types.ts` et `schemas.ts`, qui
   n'existent que par INC‑0. Coupé à temps, il laisse `nodes.ts` à ≈ 400 lignes mêlant types,
   schémas, deux unions et un `superRefine`, c'est‑à‑dire exactement le monolithe que
   `AGENTS.md` §2 nomme — et le déplacement différé coûtera alors trois fois plus de lignes.

**Ne se coupe jamais**, et chacun pour une raison mesurée :

- **L'`it` d'union d'INC‑1** (`nodes.test.ts`). Le trou de covariance est réel et re‑mesuré : en
  retirant `TableNodeSchema` de `blockMembers()`, `tsc -p tsconfig.json` **et**
  `tsc -p tsconfig.typecheck.json` sortent tous deux à 0 et le build est propre. Ce test est la
  **seule** protection du dépôt sur ce point, et non une commodité.
- **`parseBlockNode`** (INC‑1, [§3.6]). Trois lignes. Sans elles, l'union que le lot ajoute rouvre le
  `RangeError` nu que les portes bornées de l'ADR 0003 décision 8 existent pour supprimer — mesuré,
  `BlockNodeSchema.parse` d'une chaîne de 2 000 `container` imbriqués rend
  `RangeError: Maximum call stack size exceeded`.
- **INC‑3.** Sans lui, le lot ne produit aucun commit publiable, [§2, D11] n'aura servi à rien, et un
  build intermédiaire refusera illisiblement les documents du suivant.
- **INC‑5.** Sans lui, les treize décisions vivent dans un document que son propre en‑tête déclare
  périssable.

---

### INC-0 — Le découpage de `ast/` : types, schémas, façade · **S**

**Fichiers.** ➕ `packages/core/src/ast/types.ts` (les types écrits à la main, déplacés tels quels) ·
➕ `packages/core/src/ast/schemas.ts` (les schémas Zod et `nodeIdSchema`, déplacés tels quels) · ✏️
`packages/core/src/ast/nodes.ts` (vidé, devient une façade de ré‑export) · ➕
`packages/core/src/ast/__tests__/nodes.test.ts` (déplacé depuis `src/ast/nodes.test.ts`, qui
disparaît) · ➕ `packages/core/src/ast/__tests__/visitor.test.ts` (déplacé depuis
`src/ast/visitor.test.ts`, qui disparaît)

**Pourquoi ici, et pourquoi pas après.** Deux raisons, et la seconde est arithmétique. D'abord
`CONTRIBUTING.md:81-82` : « Une PR = un sujet. Les PR qui mélangent un correctif, un refactor et une
nouvelle dépendance sont renvoyées. » Un refactor de découpage embarqué dans le commit qui ajoute
trois types de nœud rend le diff d'INC‑1 illisible, et c'est précisément le diff dont la revue doit
lire chaque ligne. Ensuite : `nodes.ts` fait **190 lignes** aujourd'hui (lu), types en `:23-110`,
schémas en `:112-190` ; INC‑1 le fait plus que doubler. Déplacer 190 lignes coûte un commit ;
déplacer ce qu'INC‑1 en aura fait en coûte trois fois plus, pour un résultat identique. Le précédent
est exécuté et opposable : `expression/` porte déjà `types.ts`, `schemas.ts`, `identifiers.ts`,
`paths.ts`, `evaluator/operations/*.ts` et une façade `expression.ts` réduite à sa docstring, ce que
`AGENTS.md` §2 (« Modularité & taille des fichiers ») demande. Les deux fichiers de test migrent vers
`__tests__/` parce que C3 les multiplie — trois fichiers dans `src/ast/` après INC‑1 — et
qu'`AGENTS.md` §5 nomme exactement ce seuil.

**Ce qui casse à la compilation si l'incrément est incomplet.**

| Site | Fichier | Porte |
| :--- | :--- | :--- |
| Un import relatif sans `.js` — résolution `NodeNext` | `packages/core/src/ast/schemas.ts`, `types.ts` | **build** (porte 2) |
| Un type ou un schéma déplacé et non ré‑exporté par la façade | `packages/core/src/ast/visitor.ts:3-13`, `template/guard.ts:2`, `packages/core/src/index.ts:9-31` | **build** (porte 2), TS2305 |
| L'import `./nodes.js` laissé tel quel dans un test déplacé (il devient `../nodes.js`) | `packages/core/src/ast/__tests__/nodes.test.ts:9`, `__tests__/visitor.test.ts` | type-check (porte 3), puis porte 4 à l'exécution |
| Un import de `zod` ou d'`expression.js` resté dans `nodes.ts` vidé | `packages/core/src/ast/nodes.ts` | **build** (porte 2), `noUnusedLocals` / `noUnusedImports` |
| `NodeBase` (privé) resté dans `schemas.ts` alors que seuls les types l'utilisent | `packages/core/src/ast/types.ts` | **build** (porte 2) |

**Ce qui ne casse pas, et que la revue seule porte.** Trois choses, toutes silencieuses :

- **Une docstring perdue au déplacement.** Aucune porte ne lit un commentaire. Celle qui compte est
  celle de `DocumentNodeSchema` (`nodes.ts:150-160`), qui porte l'avertissement « *`.parse` on this
  schema bounds nothing* » et le renvoi vers la porte bornée — elle doit voyager intacte vers
  `schemas.ts`, où INC‑1 la corrigera par ailleurs [§3.6].
- **Le contenu de `packages/core/src/index.ts`**, qui doit rester **inchangé octet pour octet**. Rien
  ne le vérifie ; c'est la preuve mécanique que la surface publique n'a pas bougé, et elle se lit
  d'un `git diff -- packages/core/src/index.ts` vide.
- **La nature du diff.** Un déplacement recopié à la main plutôt que déplacé produit le même code et
  une histoire différente : `git diff -M --stat` doit montrer des renommages, pas des créations
  suivies de suppressions.

**Tests.** Aucun test nouveau, et c'est la définition d'un refactor pur. Les deux fichiers déplacés —
`packages/core/src/ast/__tests__/nodes.test.ts` et `packages/core/src/ast/__tests__/visitor.test.ts`
— tournent **sans une assertion modifiée** : leur seule édition légitime est le chemin d'import. Le
glob de collecte de Vitest est `src/**/*.{test,spec}.{ts,tsx}` (`vitest.config.ts:32`, lu), donc le
sous‑dossier `__tests__/` ne change ni la collecte, ni l'exclusion de couverture
(`vitest.config.ts:40`), ni l'exclusion de compilation (`packages/core/tsconfig.json:19`, qui liste
les quatre orthographes). Le compte de tests et le chiffre de couverture sont identiques avant et
après : c'est le critère de sortie.

**Commit.** `refactor(core): scinder l'AST en types, schémas et façade`

**Condition de fin.** Les quatre portes vertes. `git diff -M --stat` ne montre que des déplacements
et le fichier façade. `git diff -- packages/core/src/index.ts` est vide. **Non publiable** au titre
de la règle de conduite de [§2, D11] — non parce qu'INC‑0 laisserait une forme persistée sans
estampille, il n'en laisse aucune, mais parce que « le premier commit publiable du lot est INC‑3 » se
vérifie d'un coup d'œil, là où « publiable sauf si le commit d'avant a élargi une union » demande de
relire le diff.

---

### INC-1 — La forme : trois nœuds, deux unions, sept schémas, et les coutures du Visitor · **L**

**Fichiers.** ✏️ `packages/core/src/ast/types.ts` (`TABLE_COLUMN_ALIGNMENTS`,
`TableColumnAlignment`, `MIN_COLUMN_WIDTH`, `MAX_COLUMN_WIDTH`, `TableColumn`, `TableCell`,
`TableRowNode`, `TableRowGroupNode`, `TableBodyNode`, `TableNode`, `BlockNode`, `BlockNodeType`, et
le `children` des trois conteneurs qui passe de `DocumentNode` à `BlockNode`) · ✏️
`packages/core/src/ast/schemas.ts` (`blockMembers()`, `rowMembers()`, et les **sept** schémas neufs :
`BlockNodeSchema`, `TableColumnSchema`, `TableCellSchema`, `TableRowNodeSchema`,
`TableRowGroupNodeSchema`, `TableBodyNodeSchema`, `TableNodeSchema` avec son `superRefine` ;
`DocumentNodeSchema` est **réécrit**, pas ajouté) · ✏️ `packages/core/src/ast/nodes.ts` (la façade
gagne **19** ré‑exports : 9 types et 10 valeurs) · ✏️ `packages/core/src/ast/visitor.ts` · ✏️
**`packages/core/src/template/guard.ts`** (`parseBlockNode`, et la docstring de `maxDepth`) · ➕
**`packages/core/src/ast/__tests__/fixtures.ts`** · ✏️ `packages/core/src/ast/__tests__/nodes.test.ts`
· ✏️ `packages/core/src/ast/__tests__/visitor.test.ts` · ➕
`packages/core/src/ast/__tests__/table.test.ts`

**Pourquoi ici.** C'est le cœur du lot et la seule forme persistée qu'il produit : tout ce qui suit
la consomme. `guard.ts` entre dans cette liste pour deux raisons distinctes, et aucune des deux n'est
un ajout de confort. La première est **une porte manquante** : `BlockNodeSchema` est une union neuve,
exportée, et `.parse` sur elle ne borne rien — la docstring de `DocumentNodeSchema` renvoyait vers
`parseDocumentNode`, qui valide l'**autre** union et accepte une `tableRow` nue, exactement ce que le
flux de blocs refuse [§3.6]. La seconde est **une docstring qui mentirait sinon** :
`ShapeLimits.maxDepth` (`guard.ts:37-41`) annonce « *Measured on a realistic model: 10 levels, and 12
with an `aggregate(filter(...))`. 64 leaves a fivefold margin* », et le modèle de recette de C3 pèse
**18** niveaux (mesuré) — la marge devient **3,5×**, et le « modèle réaliste » du dépôt n'est plus
celui‑là. [§2, D12] refuse tout plafond nouveau **en s'appuyant sur cette mesure** ; laisser le
fichier qui la porte dire le contraire est le défaut auquel le plan C2 avait consacré sa §3.6
(« `limits.ts` — la liste qui mentirait sinon »). Le précédent est écrit et opposable.

**Ce qui casse à la compilation si l'incrément est incomplet** — mesuré dans le bac à sable en deux
vagues : élargir `DocumentNode` seul rend **une** erreur ; ajouter ensuite les trois membres
d'interface et les trois `case` en rend **quatre**.

| Site | Fichier | Porte |
| :--- | :--- | :--- |
| `const exhaustive: never = node` — `TableNode` non assignable à `never` | `packages/core/src/ast/visitor.ts:50` | **build** (porte 2) |
| `childrenOf` — l'objet littéral ne satisfait plus `NodeVisitor` | `packages/core/src/ast/visitor.ts:61-67` | **build** (porte 2) |
| `READS_VISITOR`, annoté `NodeVisitor<NodeReads>` | `packages/core/src/ast/visitor.ts:140-151` | **build** (porte 2) |
| Le visiteur littéral de `describeNode` | `packages/core/src/ast/__tests__/visitor.test.ts:56-62` | type-check (porte 3) |
| Le visiteur littéral du test de branche défensive | `packages/core/src/ast/__tests__/visitor.test.ts:82-88` | type-check (porte 3) |
| L'annotation `z.ZodType<BlockNode>` / `z.ZodType<DocumentNode>` quand un champ dérive | `packages/core/src/ast/schemas.ts` | **build** (porte 2), TS2375 |
| La signature `checkTableWiring(table: TableNode, …)` | `packages/core/src/ast/schemas.ts` | **build** (porte 2), TS2345 |
| `entry.rows` dans `checkTableWiring` — ne type‑checke que tant que `TableBodyNode` a exactement deux membres | `packages/core/src/ast/schemas.ts` | **build** (porte 2) |
| `TABLE_COLUMN_SCHEMA_IN_STEP` — `MutuallyAssignable` s'effondre en `false`, qui n'assigne pas à `true` | `packages/core/src/ast/__tests__/nodes.test.ts` | type-check (porte 3) |

Soit **six coutures tenues par le compilateur** — les deux premières lignes couvrant à elles seules
l'interface `NodeVisitor` et le `switch` de `visitNode`, que le `never` referme d'un coup — plus **quatre**
gardes de dérive de champ ou d'union : les deux annotations `z.ZodType`, la signature de
`checkTableWiring`, le rétrécissement `entry.rows`, et l'assertion `TABLE_COLUMN_SCHEMA_IN_STEP`. Nuance de porte, identique à celle de C2 : `packages/core/tsconfig.json`
**exclut** les `*.test.ts` (`:19`), `tsconfig.typecheck.json` les réinclut ; les trois premières
lignes rougissent dès la porte 2, les harnais de test à la porte 3. Et la mesure du garde de dérive
est vérifiée dans les deux sens : **retirer `align` du schéma casse quatre sites à la porte 2** —
un TS6133, deux TS2375 sur les annotations `z.ZodType`, un TS2345 sur `checkTableWiring` — **plus
l'assertion `TABLE_COLUMN_SCHEMA_IN_STEP` à la porte 3, soit cinq au total**, et c'est la
cinquième qui attrape aussi la dérive inverse [§5.2].

**Ce qui ne casse pas et que la revue seule porte.** Cinq sites, et le premier porte tout le risque
du lot :

- **Le membre `TableNodeSchema` de `blockMembers()`.** `z.ZodType` est covariant en sortie : une
  union qui produit **moins** que son annotation reste assignable. Mesuré, en le retirant :
  `tsc -p tsconfig.typecheck.json` **exit 0**, `tsc -p tsconfig.json` **exit 0**, build propre —
  seul le test de parsing rougit. Ce test n'est donc pas une commodité, c'est la seule protection, et
  il vit dans le même commit.
- **`parseBlockNode`.** Son absence ne fait rougir rien du tout : `BlockNodeSchema` reste exporté et
  non borné, et le `RangeError` nu est reproductible à la demande (mesuré, 2 000 `container`).
- **La quatrième limite de la docstring de `collectDataPaths`** ([§2, D8]). Aucune porte ne lit une
  docstring, et l'omettre referait ce que l'ADR 0002 reproche à l'ancienne : elle promet, elle ment.
- **La docstring de `maxDepth`**, ci‑dessus, et celle de `DocumentNodeType`, qui dit aujourd'hui
  « *exported so the block Registry can validate a type* » (`nodes.ts:109-110`) alors qu'après C3 le
  type vaut **huit** membres dont `tableRow` et `tableRowGroup` : un Registry de blocs qui validerait
  contre lui accepterait une ligne là où le schéma la refuse [§3.1].
- **Les libellés des messages de refus.** Aucune porte ne lit une chaîne ; c'est [§5.1] qui les
  épingle un par un, avec leur chemin.

**À faire une fois, à la main, et à consigner dans l'ADR plutôt qu'à commiter.** Retirer
temporairement `TableNodeSchema` du corps de `blockMembers()`, constater que les portes 1, 2 et 3
restent **vertes** et que la porte 4 rougit sur le seul `it` d'union, puis annuler. Le garde‑fou est
alors **prouvé, pas supposé** — c'est le geste que le plan C2 a exécuté pour `printableMembers()`, et
la propriété mesurée est la même.

**Tests.** Chacun nomme son fichier.

Dans **`packages/core/src/ast/__tests__/table.test.ts`** :

- une ligne nue glissée dans `root.children` est refusée exactement sur `root.children.2.type` /
  « No matching discriminator » (mesuré) ;
- **les onze refus au save time** avec leur chemin exact, dont les **quatre** messages distincts que
  produisent les **cinq** entrées de largeur — `1.5`, `0`, `-3`, `Infinity`/`NaN`, `1001` : `0` et
  `-3` rendent le **même** `too_small`, `Infinity` et `NaN` le **même** message de `z.number()`
  [§5.1] ;
- le critère de recette : `parseTemplate(RECIPE_TEMPLATE)` passe, l'aller‑retour JSON rend
  `toStrictEqual` **true** [§6.2] ;
- `collectDataPaths(RECIPE_TEMPLATE.root)` rend exactement `['facture.numero', 'facture.lignes']`, et
  un alias de groupe employé hors de son groupe redevient une clé d'appelant [§5.3] ;
- `parseBlockNode` d'une chaîne profonde rend un `TemplateShapeError` `too-deep` là où
  `BlockNodeSchema.parse` rend un `RangeError` nu — le test épingle la **différence**, pas la
  profondeur, qui est dépendante de la taille de pile [§5.2].

Dans **`packages/core/src/ast/__tests__/nodes.test.ts`**, les **deux** gardes anti-dérive du paquet,
et ils y vivent ensemble parce que c'est déjà ce fichier qui les porte :

- `TABLE_COLUMN_SCHEMA_IN_STEP`, l'assertion `MutuallyAssignable` sur `TableColumnSchema`. Elle y vit
  et non ailleurs parce que `SEGMENT_SCHEMA_IN_STEP` (`nodes.test.ts:34-37`) est sa jumelle exacte,
  avec le même argument de covariance ; et elle n'est **pas** tautologique, contrairement à la même
  assertion posée sur `DocumentNodeSchema` : `TableColumnSchema` ne porte aucune annotation
  `z.ZodType<TableColumn>`.
- **l'`it` d'union** — `BlockNodeSchema` accepte `RECIPE_TABLE`, `DocumentNodeSchema` aussi, une
  `tableRow` nue est refusée par le premier et acceptée par le second [§5.2]. Il consomme
  `RECIPE_TABLE`, qu'il importe de `fixtures.ts` comme `table.test.ts` le fait : c'est précisément
  pour que ces deux fichiers partagent une fixture sans la dupliquer que `fixtures.ts` existe.

Dans **`packages/core/src/ast/__tests__/visitor.test.ts`** : `childrenOf` sur un tableau (les trois
sections en ordre de flux), sur un groupe (ses lignes), sur une ligne (les blocs de ses cellules,
aplatis) ; `findNodeById` atteint une ligne d'en‑tête et une cellule de pied — un sous‑arbre que
`childrenOf` ne rend pas est invisible à `walk`, à `findNodeById` et à `collectDataPaths` **sans
erreur nulle part** [§3.4].

Dans **`packages/core/src/ast/__tests__/fixtures.ts`** : rien qui s'exécute comme test.
`RECIPE_TABLE`, `RECIPE_TEMPLATE`, leurs fabriques (`lit`, `bind`, `p`, `txt`, `cell`, `round`,
`mul`) et le type `MutuallyAssignable`, importés par `nodes.test.ts` et par `table.test.ts`.

> ⚠️ **La propriété annoncée pour ce fichier est fausse, et INC-1 en hérite deux conséquences.**
> La note de revue justifiait `fixtures.ts` par « *hors du glob `*.{test,spec}.ts`, donc ni collecté
> par Vitest ni compté dans la couverture* ». **La première moitié est juste, la seconde est
> fausse** : le fichier est instrumenté par la couverture **et** compilé dans `dist/`, donc publié
> dans le tarball. La lecture ligne à ligne des trois configurations, les deux globs identiques qui
> ferment la porte de sortie, et les trois issues examinées vivent en [§5.5] et ne sont pas répétées
> ici. Ce qu'INC-1 doit en retenir tient en deux règles : **`fixtures.ts` ne porte que des constantes
> et les fabriques qui les construisent** — une fabrique exportée et jamais appelée serait
> instrumentée, jamais couverte, et `noUnusedLocals` ne la voit pas puisqu'elle est exportée — et
> **il n'importe rien de `vitest`**, ce qui est le seul accident réel pour un module embarqué dans
> le paquet publié. **Les deux règles ont chacune leur critère mécanique en [§6.4]**, et la seconde
> ne les avait pas : la couverture de fonctions de `fixtures.ts` doit rester à **100 %**, faute de
> quoi la première fabrique morte y baisse le chiffre de `core` sans faire rougir un seul test.

**Commit.** `feat(core)!: décrire un tableau de lignes dans le contrat`

**Condition de fin.** Les quatre portes vertes, couverture ≥ 90 % sur `packages/core/src/**`.
`collectDataPaths` du modèle de recette rend exactement **deux** chemins. Le geste manuel ci‑dessus
joué **puis annulé**. **Non publiable** : la forme persistée existe sans estampille.

---

### INC-2 — Le site d'erreur, et son libellé dans le même commit · **S**

**Fichiers.** ✏️ `packages/core/src/errors.ts` (`| 'tableRowGroup'` sur `ExpressionErrorSite`,
`:80`, et la docstring qui nomme désormais **trois** porteurs d'expression au lieu de deux) · ✏️
`packages/core/src/expression/evaluator/evaluate.ts` (`tableRowGroup: 'A table body'` dans
`LIST_CALLER_SUBJECTS`, `:198-203`) · ✏️
`packages/core/src/expression/evaluator/__tests__/limits-scope.test.ts`

**Pourquoi ici.** Après INC‑1, pour que le test parte d'un vrai `tableRowGroup` plutôt que d'un
`caller` construit à la main — et pas avant, parce qu'un site nommé pour un nœud qui n'existe pas est
une promesse. C'est un **site**, jamais un code : `TableRowGroupNode.each` porte une expression sans
en être une, exactement comme `LoopNode.each` et `ConditionNode.when`, et c'est la raison pour
laquelle le champ s'appelle `site` et non `kind` [§2, D10].

**Ce qui casse à la compilation si l'incrément est incomplet** — et l'asymétrie du tableau est
l'incrément tout entier :

| Site | Fichier | Porte |
| :--- | :--- | :--- |
| Le libellé **sans** le site : la clé `tableRowGroup` n'appartient pas à `ExpressionErrorSite` | `packages/core/src/expression/evaluator/evaluate.ts:198` | **build** (porte 2) |
| Le site **sans** le libellé | — | **aucune.** `LIST_CALLER_SUBJECTS` est un `Readonly<Partial<Record<…>>>` : l'absence est légale |
| Un code ajouté par erreur à l'un des trois catalogues | `packages/core/src/expression/evaluator/__tests__/limits-scope.test.ts:111`, `:123` | **test** (porte 4) |

Le compilateur ne tient donc **qu'un seul des deux sens**, et c'est le sens inoffensif. L'autre est
le défaut que la table existe pour empêcher : `evaluator/evaluate.ts:231` écrit
`${LIST_CALLER_SUBJECTS[site] ?? 'An expression'}`, si bien qu'un site non listé retombe en silence
sur « *An expression needs a list to iterate over* » — dit à un auteur qui n'a écrit aucune
expression, mais un tableau. **Les deux vont dans le même commit, et un test épingle le message.**

**Ce qui ne casse pas et que la revue seule porte.** Le repli silencieux ci‑dessus, et la propriété
« zéro code d'erreur nouveau » : rien n'interdit mécaniquement d'ajouter une entrée à
`OPERAND_ERROR_CODES`, `LIMIT_ERROR_CODES` ou `SHAPE_ERROR_CODES` — c'est le test de complétude de
`limits-scope.test.ts:111` (`Object.keys(PRODUCED_CODES).sort()` contre `EXPRESSION_ERROR_CODES`) qui
rougirait, à la porte 4, et seulement pour un code effectivement produit. La discipline est écrite,
pas outillée.

**Tests.** Dans **`packages/core/src/expression/evaluator/__tests__/limits-scope.test.ts`**, à côté
de l'`it` qui existe déjà — « *reports the site of a predicate position that is not an expression* »,
`:172-182`, lequel épingle aujourd'hui le **détail** (`{ code: 'not-a-list', site: 'loop', at: [],
actualType: 'number' }`) et **pas le message**. Le test de C3 doit épingler la **chaîne**, puisque
c'est elle que le libellé change et que le détail ne la porte pas :
`evaluateSequence(path('facture'), { facture: 3 }, { caller: 'tableRowGroup' })` rend exactement
`A table body needs a list to iterate over, got a number.` (mesuré). Un second `it` vérifie que
`EXPRESSION_ERROR_CODES` n'a pas bougé, sur le patron du `toHaveLength(operand.length + limit.length)`
déjà en place à `:123`.

**Commit.** `feat(core): nommer le corps d'un tableau dans un refus de liste`

**Condition de fin.** Les quatre portes vertes. `EXPRESSION_ERROR_CODES.length` inchangé, et le test
échouerait si le libellé retombait sur « An expression ». **Non publiable**, au titre de la même
règle de conduite qu'INC‑0 : cet incrément n'ajoute aucune forme persistée, mais il vient après celui
qui en ajoute une.

---

### INC-3 — L'estampille de schéma · **S**

**Fichiers.** ✏️ `packages/core/src/template/template.ts` (`CURRENT_SCHEMA_VERSION = 4`, `:63`, et la
section « ## What version 4 means », à la suite de celles des versions 2 et 3, `:8` et `:48`) · ✏️
`packages/core/src/template/migrate.ts` (l'entrée `{ from: 3, to: 4 }`, **ajoutée** après celle de
`:71-92`, jamais fusionnée) · ✏️ `packages/core/src/template/migrate.test.ts`

**Pourquoi ici et pas ailleurs.** Après la **dernière** forme persistée du lot — INC‑1 pour les
nœuds, INC‑2 n'en ajoute aucune — et avant tout ce qui la consomme. Une estampille par incrément
ferait désigner **un commit** au lieu **d'un contrat** : trois types de nœud, deux enregistrements et
la coupure d'union arrivent ensemble, ils portent un numéro ensemble. La section « What version 4
means » énumère ce que la version contient **réellement** ; un numéro qui promet des formes non
livrées est pire qu'un numéro non incrémenté.

**Ce qui casse à la compilation si l'incrément est incomplet.** Rien, et c'est le point.

| Site | Fichier | Porte |
| :--- | :--- | :--- |
| Le bump **sans** l'entrée de migration — `toHaveLength(CURRENT_SCHEMA_VERSION - 1)` | `packages/core/src/template/migrate.test.ts:144` | **test** (porte 4) |
| L'entrée **sans** la mise à jour de l'attendu littéral `[[1,2],[2,3]]` | `packages/core/src/template/migrate.test.ts:140-143` | **test** (porte 4) |
| Le bump seul, sans rien d'autre | — | **portes 1, 2 et 3 vertes.** Aucun compilateur n'exige l'incrément |

C'est exactement ce qu'annonce [§2, D11] : `migrate.test.ts:140-145` est le **seul** site qui
rougisse, et l'estampille est l'incrément dont aucune porte ne réclame l'existence. Hors de
`template/`, rien ne bouge : `guard.test.ts:189` porte un `schemaVersion: 2` littéral, mais dans un
payload passé à `assertBoundedShape`, qui ne valide aucun schéma — le constat est celui du plan C2 et
il tient.

**Ce qui ne casse pas et que la revue seule porte.** Deux choses, et la seconde se périme sans
prévenir :

- **Le contenu de la section « What version 4 means ».** Une section vide, ou qui recopie celle de la
  version 3, passe les quatre portes.
- **Un titre de test qui porte un numéro de version.** C2 en a corrigé trois d'un coup, précisément
  parce qu'« un nom de test qui porte un numéro de version se périme à chaque estampille, et rien ne
  le fait rougir ». Le recensement se refait par `grep` sur les titres de `migrate.test.ts`, pas de
  mémoire — les sept assertions littérales ont été délittéralisées par C2 en
  `CURRENT_SCHEMA_VERSION`, mais un titre n'est pas une assertion.

**Tests.** Dans **`packages/core/src/template/migrate.test.ts`**, les contrats de [§5.4] : la chaîne
rend `[[1,2],[2,3],[3,4]]` et `toHaveLength(CURRENT_SCHEMA_VERSION - 1)` suit · un document estampillé
3 **sans tableau** parse et sort à 4 (mesuré) · un document estampillé 5 rend un
`TemplateMigrationError` qui **nomme la version** — c'est le remède que l'incrément achète, contre le
`{"code":"invalid_union","note":"No matching discriminator","path":["root","children",0,"type"],
"message":"Invalid input"}` que rend un build v3 sur un document portant un `table` (mesuré) · la
migration 3 → 4 ne change ni la profondeur ni le compte de valeurs, donc le **second** passage du
garde de forme l'accepte.

**Commit.** `feat(core)!: estampiller le schéma de document en version 4`

**Condition de fin.** Les quatre portes vertes. `CURRENT_SCHEMA_VERSION === 4`,
`TEMPLATE_MIGRATIONS.length === 3`, et la première entrée toujours `{ from: 1, to: 2 }` — la preuve
que l'entrée a été ajoutée et non fusionnée. **Premier commit publiable du lot :** à partir d'ici, un
build intermédiaire ne peut plus refuser illisiblement le document d'un build suivant.

---

### INC-4 — Le barrel, la liste du designer dérivée, et la facture décrite par un vrai tableau · **M**

**Fichiers.** ✏️ `packages/core/src/index.ts` · ✏️ `packages/designer/src/types.ts` · ✏️
`apps/playground/src/App.tsx`

**Trois commits, parce que trois sujets** — et parce que les deux derniers sont les **détecteurs** du
premier.

#### (a) `feat(core): exporter le contrat de tableau`

Le barrel est l'angle mort des quatre portes [§3.8] : aucune ne voit un export oublié. **Vingt
symboles nouveaux**, recomptés ici parce que trois corrections en ont changé le nombre —
`parseBlockNode` [§3.6], `BlockNodeType` [§3.1] et `TableBodyNodeSchema` [§3.2] portent le compte de
dix‑sept à vingt.

**Neuf types**, depuis `./ast/nodes.js` : `BlockNode`, `BlockNodeType`, `TableBodyNode`, `TableCell`,
`TableColumn`, `TableColumnAlignment`, `TableNode`, `TableRowGroupNode`, `TableRowNode`.

**Onze valeurs** : dix depuis `./ast/nodes.js` — `BlockNodeSchema`, `MAX_COLUMN_WIDTH`,
`MIN_COLUMN_WIDTH`, `TABLE_COLUMN_ALIGNMENTS`, `TableBodyNodeSchema`, `TableCellSchema`,
`TableColumnSchema`, `TableNodeSchema`, `TableRowGroupNodeSchema`, `TableRowNodeSchema` — et **une**
depuis `./template/guard.js`, `parseBlockNode`, qui se pose à côté de `parseDocumentNode`
(`index.ts:156`) parce que c'est là que vivent les portes bornées.

`DocumentNodeType` était déjà exporté (`index.ts:13`) et le reste ; seule sa docstring change, et
c'est le geste qui l'empêche de mentir au Registry [§3.1].

**Critère d'export**, celui que l'ADR 0004 a fixé pour `RoundExpressionSchema` : un consommateur
immédiat **hors du dépôt** — l'intégrateur ou l'éditeur qui construit un tableau par programme et le
valide avant de le stocker. **Aucun helper dérivé** : ni `resolveColumnWidths`, ni `rowsOf`, ni
`columnOf`. Pas de consommateur, donc pas d'export ; c'est la règle anti‑sur‑ingénierie
d'`AGENTS.md` §3, et `parseBlockNode` la satisfait sans discussion — c'est la porte manquante d'une
union neuve, pas une commodité dérivée.

#### (b) `refactor(designer): dériver BlockType du contrat`

`packages/designer/src/types.ts:3` déclare aujourd'hui, à la main,
`'text' | 'image' | 'container' | 'table' | 'loop' | 'condition'`. La liste contenait déjà `'table'`
alors que `core` n'avait pas ce nœud : **juste par accident**, et rien dans les quatre portes ne le
signalait. Elle devient `export type BlockType = BlockNodeType;` — **le type nommé, pas
`BlockNode['type']` recalculé sur place**, pour que le designer et le barrel disent la même chose
d'une seule écriture [§3.1]. Le résultat est le même ensemble de **six** membres ; l'ordre diffère et
n'a aucune importance, une union n'en a pas. Ce que la dérivation achète : `allowedBlocks?: BlockType[]`
ne peut plus accepter `'tableRow'`, et un septième type de bloc ne peut plus se glisser hors de la
liste.

#### (c) `feat(playground): décrire la facture avec un vrai tableau`

> ⚠️ **Correction d'une condition de fin inatteignable, à ne pas recopier.** Une version antérieure
> de cet incrément exigeait : « *Le `<table>` affiché ne contient plus une seule cellule écrite en
> JSX : il est intégralement dérivé du `TableNode`.* » **Aucune écriture du contrat de C3 ne peut la
> satisfaire**, et pour deux raisons indépendantes.
>
> Le `<table>` visé (`App.tsx:827-864`) est la démonstration livrée par C2 : elle compare **trois
> modèles distincts**. Ses colonnes de montants viennent de `lectures` (`App.tsx:531`), qui est
> `modeles.map(lireModele)` sur trois `parseTemplate` séparés (l'appel en `App.tsx:436`, les trois
> invocations en `:462-481`). **Un `TableNode` appartient à un seul document** : il n'existe aucune
> déclaration de C3 qui agrège trois documents dans un tableau, et il n'en existera pas — une
> référence croisée entre documents est refusée par C1.
>
> Second empêchement, qui suffirait seul : la ligne de total de ce tableau porte `colSpan={3}`
> (`App.tsx:854`), et [§2, D13] refuse **nommément** la fusion de cellules.
>
> **Périmètre et sortie réécrits.** Ce qui disparaît, c'est la maquette de la **section facture** :
> le nœud texte concaténé `line-label` (`App.tsx:173-189`), où une ligne entière de facture est **un
> seul** `TextNode` dont les segments miment des colonnes, devient un `TableNode` ; et la liste
> `<ol>` qui l'affiche (`App.tsx:793-807`) devient un `<table>` dérivé de `header`, `body` et
> `footer`, largeurs calculées en `width / Σ width`, alignements lus sur `align`. **Le tableau
> comparatif des trois arrondis reste du JSX écrit à la main, et le plan le dit** — à ajouter en
> conséquence de [§2, D13], à côté du contournement déjà daté sur la fusion de cellules.

Le `biome-ignore lint/suspicious/noArrayIndexKey` déjà présent (`App.tsx:802`) **reste**, avec sa
justification écrite, et suit la liste dans le `<tbody>` : une clé de ligne est positionnelle par
nature, deux lignes de facture identiques doivent rester deux entrées distinctes, et une clé dérivée
du contenu les confondrait.

**Et l'avertissement de périmètre se recopie au‑dessus du `TableNode`.** `App.tsx:157-162` dit déjà,
des noms de champs, qu'Openview n'en réserve aucun et n'en attend aucun. Les **cinq identifiants de
colonne** du modèle de démonstration — `designation`, `quantite`, `prixUnitaire`, `remise`,
`montant` — appellent le même avertissement, adapté : ce sont un **jeu d'épreuve**, choisis par
l'auteur du modèle, et le premier tableau réellement décrit est celui qui sera recopié. Le dépôt
nomme déjà ce mécanisme (`docs/roadmap/README.md:189`, « position par défaut de fait »). Le critère mécanique
associé est en [§6.4].

**Ce qui casse à la compilation si l'incrément est incomplet** — et le tableau dit pourquoi (b) et
(c) valent mieux qu'une relecture du barrel :

| Site | Fichier | Porte |
| :--- | :--- | :--- |
| `export type BlockType = BlockNodeType;` — TS2305 si le barrel oublie `BlockNodeType` | `packages/designer/src/types.ts:3` | **build** (porte 2) |
| Chaque symbole que le playground importe et que le barrel n'exporte pas — TS2305 | `apps/playground/src/App.tsx` | **build** (porte 2, `vite build`) et type-check (porte 3, `tsc --noEmit`) |
| Un symbole exporté par la façade `ast/nodes.ts` et oublié par le barrel, qu'aucun des deux ne consomme | — | **aucune** |

**Ce qui ne casse pas et que la revue seule porte.** La troisième ligne, et il faut la nommer par
extension plutôt que par principe. Le résidu est exactement « les vingt, moins ce que (b) et (c)
importent », et il contient **au moins les trois portes de validation** : `BlockNodeSchema`,
`TableBodyNodeSchema` et `parseBlockNode`. Aucun consommateur du dépôt ne les exerce, par
construction — le playground valide par `parseTemplate`, jamais par un schéma de nœud isolé, et c'est
l'intégrateur hors dépôt qui en a l'usage. **La PR liste ce résidu nommément** ; c'est le seul
contrôle qui existe.

**Ce qui vérifie `App.tsx`, et ce qui ne le vérifie pas.** `vitest.config.ts:27` déclare
`projects: ['packages/*']` : **`apps/playground` n'est ni collecté, ni instrumenté, ni couvert**, et
`sonar-project.properties:23` l'exclut de la couverture tout en l'incluant dans `sonar.sources` comme
code de **production**. Seuls mordent `lint`, `build` (`vite build`), `type-check` (`tsc --noEmit`) et
la quality gate SonarQube. Corollaire à ne pas perdre, hérité de C2 : **aucun chiffre affiché par le
playground n'est un contrat tant qu'un test de `core` ne le porte pas.**

**Commits.** `feat(core): exporter le contrat de tableau` · `refactor(designer): dériver BlockType du
contrat` · `feat(playground): décrire la facture avec un vrai tableau`

**Condition de fin.** Les quatre portes vertes. Le playground construit sa section facture en
important **depuis `@openview/core` seul**, sans un import relatif vers `packages/core/src`. Le
`<table>` de la section facture ne contient plus une cellule écrite à la main : ses colonnes, ses
largeurs et ses alignements sont lus sur le `TableNode` du modèle validé. Le `<table>` comparatif des
trois arrondis (`App.tsx:827-864`) est **inchangé**. `packages/designer/src/types.ts` ne contient plus
aucune liste de types de bloc écrite à la main. **Publiable.**

---

### INC-5 — L'ADR 0005, et les documents qui pointent vers elle · **M**

**Fichiers.** ➕ `docs/adr/0005-le-tableau-de-lignes.md` · ✏️
`docs/adr/0004-les-arrondis-declares-par-le-modele.md` (ligne « **Complétée par :** ADR 0005 » dans
l'en‑tête) · ✏️ `docs/roadmap/core.md` (§C3 : le renvoi vers le plan, puis la mention de livraison
avec le lien vers l'ADR) · ✏️ `docs/plans/c3-tableau-de-lignes.md` (ce fichier, marqué périmé par son
propre `**Statut :**`)

**L'en‑tête n'est pas facultatif**, et il suit le gabarit des quatre ADR existantes
(`docs/adr/0004-…md:1-20`) : **Statut** 🟢 avec sa date · **Impact** (`@openview/core` pour l'AST,
l'estampille et le site d'erreur ; `@openview/engine` pour E2, E3 et E5, qui héritent d'une section
`header` nommée et de la pagination d'un tableau imbriqué ; `@openview/designer` pour D6 et D7 ;
`@openview/core` lot C5, qui dépend de C3) · **Complète :** ADR 0004, dont la décision 8 transmettait
la contrainte « le tableau ne somme rien », et ADR 0002, dont la garantie de collecte est étendue à
un quatrième site d'alias · **Plan d'implémentation :** ce fichier, périmé une fois le lot livré ·
**Implémentation :** liens vers `ast/types.ts`, `ast/schemas.ts`, `ast/visitor.ts`,
`template/guard.ts` et `template/template.ts`.

**Contenu obligatoire de l'ADR 0005**, faute de quoi il sera improvisé sous pression — les treize
décisions de la [§2] avec, pour chacune, son motif, ses alternatives écartées, son verdict de
réversibilité et, quand il y en a un, son signal de réouverture. Plus, nommément :

1. **Le critère d'appartenance de D1, écrit AVANT la liste des champs**, avec sa condition (2)
   énoncée comme un test d'**inexprimabilité** — « supprimez la notion de colonne et l'attribut n'a
   plus de site où s'écrire » — et non comme un test de survie, qui ne trie rien. Et l'aveu qui va
   avec : **`align` échoue à ce test reformulé** et n'est retenu en C3 ni par le critère ni par un
   goût, mais par deux arguments mécaniques — le libellé « un alignement par colonne »
   (`core.md:153-154`) et « C5 **Dépend de :** C3 » (`core.md:184`). **C'est une exception nommée.**
2. **Les mesures avec leur protocole et leur machine**, distinguées de ce qui n'est que lu : bac à
   sable, copie intégrale de `packages/core`, jonctions vers le `zod@3.25.76` et le `vitest@4.1.10`
   du dépôt, `tsc` 7.0.2 avec les `tsconfig.json` / `tsconfig.typecheck.json` **du dépôt**, Node
   v24.11.1, `biome check` avec le `biome.jsonc` du dépôt, baseline à exit 0 avant toute édition,
   `git status` du dépôt identique avant et après.
3. **« Ce que le lot refuse, par écrit »** — les vingt refus de [§2, D13], dont trois portent leur
   signal de réouverture : la fusion de cellules, la colonne conditionnelle et le type de colonne.
4. **« Ce que cette décision tient pour acquis »**, et il y a **deux** dépendances au comportement de
   Zod à rejouer à chaque montée, pas une :
   - un `z.object().superRefine()` reste un `ZodObject` en zod 4 — les refinements vivent **dans** le
     schéma —, donc `TableNodeSchema` demeure membre légal des deux unions discriminées, `lazy`
     comprises. Toute la propriété « zéro code d'erreur nouveau » repose là‑dessus ;
   - Zod ne saute un `superRefine` que sur une issue **abandonnante** — `invalid_type`,
     `invalid_value` ; les issues **continuables** — `too_small`, `too_big`, `custom` — le laissent
     tourner. C'est la raison pour laquelle `columns.min(1)` n'arrête pas `checkTableWiring` et pour
     laquelle le garde `declared.size === 0` **existe** : sans lui, un tableau sans colonne rend une
     faute par cellule au lieu d'une seule (mesuré : **13 contre 1**) [§3.2 ; §5.1]. L'ADR consigne
     aussi que ce point a d'abord été tranché **dans l'autre sens** par la revue de contradiction,
     sur une mesure prise contre un build qui contenait encore le garde : c'est le seul renversement
     du lot, et il vaut d'être écrit.

   Plus la note que l'exactitude de D6 **ne dépend pas** du défaut `maxNodes` : `limitSchema`
   plafonne `maxNodes` à `LIMIT_HARD_CEILING = 1e9`, une colonne pèse quatre valeurs, donc au plus
   2,5·10⁸ colonnes et Σ ≤ 2,5·10¹¹ < 2⁵³ ; et même hors du garde — `TableNodeSchema.parse` ne le
   passe pas — la longueur maximale d'un tableau JavaScript borne Σ à 4,3·10¹² < 2⁵³. Sans cette
   note, un relèvement de `DEFAULT_SHAPE_LIMITS` par E8 **aurait l'air** d'invalider la preuve.
5. **« Ce qui reste ouvert »**, deux entrées :
   - **« Qui déclare la direction d'écriture d'un document ? »**, avec ses options — une déclaration
     de modèle rattachée à C6, une entrée du `RenderRequest`, ou rien et un défaut de moteur — et
     **sans recommandation**, sur le patron exact de la question d'échelle d'affichage léguée par
     C2. La mesure qui justifie de la poser ainsi est écrite avec elle, et **dans la forme canonique
     de [§2, D7], jamais dans une autre** — la sonde scopée par `':!docs/plans/*'`, faute de quoi
     l'ADR publierait une commande qui rend 18 occurrences là où elle en annonce zéro :

     ```bash
     git grep -niE 'rtl|droite à gauche|right-to-left|direction d.écriture|writing direction|bidi' -- docs packages README.md ARCHITECTURE.md AGENTS.md ':!docs/plans/*'
     ```

     Elle ne rend **aucune occurrence**, et le périmètre de C6 (`core.md:186-196`) énumère montants,
     dates, séparateurs, symbole monétaire et libellés fixes — **pas** la direction. C3 **diffère**
     la résolution et n'a aucune information pour la trancher. L'interdit qui tient déjà y est
     écrit : aucun moteur ne dérive cette direction de la machine (E6). **L'ADR recopie aussi les
     deux défauts corrigés de la commande initiale** — le `|` littéral d'une regex basique, et
     l'auto-falsification une fois le plan commité — parce qu'une sonde dont on ne sait pas pourquoi
     elle est scopée sera « simplifiée » au premier ménage.
   - **Le recalcul parallèle du total.** Le critère de recette dit « une somme de ce qui précède », et
     le modèle produit en réalité **deux écritures de la même arithmétique** —
     `round(mul(ligne.quantite, ligne.prixUnitaire), 2)` dans la cellule du corps, la même sous
     l'agrégat du pied — qu'**aucun mécanisme du contrat ne lie**. Un auteur qui corrige l'une et pas
     l'autre obtient un total qui contredit sa propre colonne, **en silence** : `core` ne le refuse
     pas, `collectDataPaths` ne le voit pas (mesuré, il rend `['facture.numero','facture.lignes']`),
     et le lint qui pourrait le voir est D7 du designer, très loin en aval. À relier à la décision
     déjà consignée par l'ADR 0002.
6. **Le point de gouvernance, argumenté et unique** : le test de discriminant
   `if (entry.type === 'tableRow')` dans `checkTableWiring` **n'est pas** un second parcours du
   Composite au sens d'`AGENTS.md` §3.B. Il ne descend dans aucun enfant, il lit l'union à deux
   membres du corps d'**un** nœud, dans le schéma de ce nœud, et Zod l'a déjà discriminé ; la
   garantie que le Visitor achèterait est achetée par le rétrécissement lui‑même, puisque
   `entry.rows` ne type‑checke que tant que `TableBodyNode` a exactement ces deux membres. C'est la
   lecture A de l'arbitrage n°7 [§8], et elle **ne demande aucun amendement**.
7. **`errors.ts` est modifié alors que le plan C2 avait consigné « ne pas modifier ».** Ce n'est pas
   une contradiction, et l'ADR le dit plutôt que de laisser un lecteur la trouver : l'élargissement
   d'un **site** dérivé n'est pas l'ajout d'un **code**, et l'ADR 0003 l'avait déjà prévu.
8. **L'affichage de l'identifiant fautif appartient à l'éditeur.** Aucun message de refus n'interpole
   le contenu du modèle — même argument que l'ADR 0003 pour `at`, et même règle : « la charge
   d'erreur doit rester sûre à journaliser même quand le document ne l'est pas » (ADR 0003:417).
   Mesuré à l'appui : `grep -rn 'message:' packages/core/src --include=*.ts | grep '\${'` ne rend
   **aucun** résultat.
9. **L'attente envers E2 et E3, qualifiée d'attente envers un lot non écrit.** C3 décrit trois
   sections nommées ; ce que le moteur en fera — répéter l'en‑tête, couper le corps, garder le pied
   en fin de flux — n'est écrit nulle part dans le contrat, parce que la brique **décrit** et ne
   **produit** rien (`core.md:271-274`), et parce que D13 refuse nommément `repeatHeaderOnEachPage`,
   la veuve/orpheline et le point de coupe.
10. **Aucun cinquième rétrécissement de valeur** n'est ajouté aux quatre que porte l'hypothèse
    pré‑v1.0 : les bornes de C3 portent toutes sur des champs neufs, et la coupure `BlockNode`
    rétrécit trois positions qu'aucun document v3 ne peut remplir avec une ligne. À écrire noir sur
    blanc, parce que le plan C2 en avait fait un point de vigilance.
11. **Le contre‑exemple quadratique de D12** — une colonne « cumul » posant un `sum(...)` **dans** le
    corps répété — et la mention que les chiffres de budget mesurent une boucle de rendu écrite à la
    main : `packages/engine` ne contient qu'une constante de version, et le `DataBindingStep` reste à
    écrire.

**Et l'ADR nomme trois contradictions constatées dans le dépôt, sans les corriger là où elles ne
vivent pas** — une ADR est un journal, et un lot ne réécrit pas les documents d'un autre :

| Contradiction | Où | Ce que l'ADR en dit |
| :--- | :--- | :--- |
| Le modèle bilingue attribué à « core C5 » | `docs/roadmap/engine.md:79` | C'est **C6** : `core.md:186-196` énumère montants, dates, séparateurs, symbole monétaire et libellés fixes. C5 est l'apparence. |
| « C4 et C3 ne débloquent aucun lot en aval » | `docs/plans/c2-…md:186-187` | **Faux pour C3** : `core.md:184` écrit « C5 — **Dépend de :** C3 ». Phrase à ne pas recopier ; le plan C2 est périmé et le reste. |
| « Colonnes », homonyme non désambiguïsé | `core.md` (C3, vague 1) et décision produit 8 (lot C11, vague 2) | Colonnes **de tableau** contre colonnes **de mise en page**. L'éditeur de tableau de D6 dépend justement des deux. |

**Ce qui casse à la compilation si l'incrément est incomplet.** Rien : les quatre portes ne lisent pas
`docs/`. La totalité de cet incrément est portée par la revue, et le seul contrôle mécanique qui le
concerne est négatif — voir la condition de fin.

**Commit.** `docs(adr): consigner les treize décisions du lot C3`

**Condition de fin.** L'ADR porte son en‑tête complet, avec ses liens croisés **dans les deux sens** :
sans la ligne « Complétée par » dans l'ADR 0004, celle‑ci ne pointe nulle part vers celle qui la
complète. `docs/roadmap/core.md` §C3 porte le renvoi vers le plan, puis la mention de livraison. Ce
plan est marqué périmé par son propre `**Statut :**`. Et le contrôle négatif, qui est le seul du
lot : `git log --oneline -- AGENTS.md` ne montre **aucune entrée nouvelle** pour C3.

**Clôture :** l'ADR 0005 passe en 🟢 avec ses liens d'implémentation.

---

### Ce qui ne se touche pas

| Fichier | Consigne |
| :--- | :--- |
| `AGENTS.md` | **Zéro ligne, et c'est ce qui distingue C3 de C2.** C2 avait obtenu, pour sa D11, un mandat daté du propriétaire du produit et un commit `chore(governance)` séparé. **C3 n'amende aucune règle de gouvernance :** son seul point de gouvernance est tranché par la lecture A de l'arbitrage n°7 [§8], qui ne demande rien. Critère mécanique, en [§6.4] : `git log --oneline -- AGENTS.md` ne gagne aucune entrée. |
| `tsconfig*.json`, `biome.jsonc`, `tools/biome/*.grit`, `turbo.json`, `.github/workflows/*`, `sonar-project.properties` | **AGENTS.md §7.** En particulier : **ne pas ajouter `src/**/__tests__/**` à l'`exclude` de `packages/core/tsconfig.json`** malgré le coût nommé plus haut sur `fixtures.ts` — cela demande un mandat explicite, hors périmètre de C3. |
| `package.json`, `pnpm-workspace.yaml` | **Aucune dépendance nouvelle.** Le lot n'écrit que du TypeScript et du Zod déjà installés. |
| `packages/core/src/expression/evaluator/operations/aggregate.ts` | **Ne pas modifier** ([§2, D9]). Le total d'une facture est une **expression du modèle** ; le tableau ne somme rien, et son `footer` n'a nulle part où poser un agrégat. |
| L'algèbre d'expressions — `expression/types.ts`, `expression/schemas.ts`, `evaluator/evaluate.ts`, `paths.ts` | **Ne pas modifier.** C3 n'ajoute **aucun kind** : la seule ligne d'`evaluate.ts` qui change est une entrée de `LIST_CALLER_SUBJECTS`, qui n'est pas un kind. Critère : `git grep -n "case 'round':" -- packages/core/src \| wc -l` rend toujours **2**, donc le seuil de retrait de l'amendement obtenu par C2 — l'apparition d'un **troisième** parcours d'expression — n'est pas franchi. |
| `OPERAND_ERROR_CODES`, `LIMIT_ERROR_CODES`, `SHAPE_ERROR_CODES` | **Ne pas modifier** ([§2, D10]). `errors.ts` est bien touché par INC‑2, mais pour élargir un **site** dérivé, jamais un catalogue de codes. |
| `DEFAULT_SHAPE_LIMITS`, `DEFAULT_EVALUATION_LIMITS` | **Ne pas modifier** ([§2, D12]). Seule la **docstring** de `maxDepth` change, et uniquement parce qu'elle mentirait sinon [§3.6]. |
| `packages/core/src/template/guard.ts` — le corps d'`assertBoundedShape`, `childValuesOf`, `indicesOf` | **Ne pas modifier.** Le garde marche sur du JSON brut et il est agnostique aux types de nœud. INC‑1 n'y **ajoute** qu'une fonction de trois lignes et n'y **corrige** qu'un commentaire. |
| `apps/playground/src/App.tsx:827-864` — le `<table>` comparatif des trois arrondis | **Ne pas dériver d'un `TableNode`.** Il agrège trois documents distincts et porte un `colSpan={3}` en `:854` ; les deux empêchements sont indépendants et chacun suffit. |
| Les tests d'arrondi de C2 — `evaluator/__tests__/round.test.ts`, `arithmetic.test.ts:74` et `:173` | **Ne pas affaiblir.** Ce sont les tests qui interdisent l'arrondi implicite, et [§2, D9] s'appuie dessus. |

---

## 5. Le plan de test

Ce lot n'ajoute aucun calcul : il ajoute une **forme**, et une forme se teste autrement qu'un
algorithme. Il n'y a donc ni vecteurs figés ni matrice de propriétés ici — la §5.1 du plan C2
existait parce que `roundDecimal` était une fonction numérique, et C3 n'en écrit aucune. Ce qui se
teste, c'est ce que le contrat **refuse**, ce que le compilateur **rattrape**, ce que le compilateur
**ne rattrape pas**, et ce qu'un parcours rend.

Les tests se répartissent sur **cinq fichiers de test et une fixture**, et chacun est nommé pour chaque `it` annoncé
([§6.2] fait de même pour la recette) :

| Fichier | Ce qu'il porte |
| :--- | :--- |
| `packages/core/src/ast/__tests__/fixtures.ts` | `RECIPE_TABLE`, `RECIPE_TEMPLATE`, le type `MutuallyAssignable`. **Aucun `it`** — voir [§5.5] |
| `packages/core/src/ast/__tests__/table.test.ts` | les onze refus [§5.1], le comptage d'issues, le critère de recette [§6.2] |
| `packages/core/src/ast/__tests__/nodes.test.ts` | les deux gardes anti-dérive : l'`it` d'union et `TABLE_COLUMN_SCHEMA_IN_STEP` [§5.2] |
| `packages/core/src/ast/__tests__/visitor.test.ts` | `childrenOf`, `walk`, `nodeReads`, `collectDataPaths`, la portée [§5.3] |
| `packages/core/src/template/migrate.test.ts` | l'estampille et la chaîne [§5.4] |
| `packages/core/src/expression/evaluator/__tests__/limits-scope.test.ts` | le libellé du site `tableRowGroup` [§5.3] |

**Six lignes, cinq fichiers de test** : `fixtures.ts` n'en est pas un — il ne porte aucun `it` —, et
c'est précisément ce qui le rend intéressant ([§5.5]).

### 5.1 Les onze refus au save time — messages et chemins mesurés

**Protocole.** Bac à sable : copie intégrale de `packages/core`, jonctions vers le `zod@3.25.76` et
le `vitest@4.1.10` du dépôt, contrat de la [§3.2] appliqué tel quel et compilé par le `tsc` 7.0.2 du
dépôt avec ses `tsconfig.json` / `tsconfig.typecheck.json`, Node v24.11.1. Chaque entrée est passée
à `TableNodeSchema.safeParse` et on relève `issue.path`, `issue.code` et `issue.message`.
`git status` du dépôt identique avant et après.

| # | Ce qui est refusé | Chemin Zod | Message |
| :--- | :--- | :--- | :--- |
| 1 | un tableau sans colonne | `columns` | `A table needs at least one column` |
| 2 | une colonne sans id | `columns.0.id` | `A table column id is required` |
| 3 | deux colonnes de même id | `columns.1.id` | `Two columns of this table share an id. A cell names its column, so the ids have to be unique within a table.` |
| 4 | une largeur fractionnaire | `columns.0.width` | `A column width is a whole number of weight units, not a length` |
| 5a | une largeur sous la fenêtre (`0`, `-3`) | `columns.0.width` | `A column width may not go below 1` |
| 5b | une largeur au-dessus (`1001`) | `columns.0.width` | `A column width may not exceed 1000` |
| 6 | une largeur non finie (`NaN`, `Infinity`) | `columns.0.width` | `A column width is a finite whole number of weight units` |
| 7 | un alignement inconnu | `columns.0.align` | `Invalid option: expected one of "start"\|"center"\|"end"` |
| 8 | une cellule nommant une colonne non déclarée | `footer.0.cells.1.columnId` | `This cell names a column the table does not declare. Add that column, or point the cell at one of the declared ids.` |
| 9 | deux cellules d'une ligne pour la même colonne | `body.0.cells.1.columnId` | `This row already fills this column. A row fills a column at most once.` |
| 10 | un groupe sans ligne | `body.0.rows` | `A table row group needs at least one row` |
| 11 | un alias interdit sur un groupe | `body.0.as` | `An alias must be a single identifier, and may not be __proto__, constructor or prototype` |

**Onze refus, douze lignes** : la fenêtre de largeur mord des deux côtés et rend deux messages, et
D10 la compte pour un. Les chemins sont ceux du refus qui s'affiche dans C8, et ils descendent
jusqu'au champ : `['footer', 0, 'cells', 1, 'columnId']` désigne la cellule fautive, pas le tableau.
Aucun de ces refus n'ajoute une entrée à `OPERAND_ERROR_CODES`, `LIMIT_ERROR_CODES` ni
`SHAPE_ERROR_CODES`, et le décompte de leur provenance se recompte : **sept** viennent des
combinateurs de Zod (`z.array().min` pour 1 et 10, `z.string().min` pour 2, `z.number().int/min/max`
et son `error` pour 4, 5a, 5b et 6, `z.enum` pour 7), **trois** du `superRefine` (3, 8, 9), et le
onzième d'`aliasSchema`, qui existait avant ce lot. Sept plus trois plus un font onze.

**Le pendant positif, obligatoire** : une **ligne courte** — une cellule pour cinq colonnes — est
**acceptée** (mesuré). Sans cette assertion, rien ne distingue « la ligne courte est licite » d'un
refus qu'on aurait oublié d'écrire, et c'est la forme même de la ligne de total ([§2, D9]).

> ⚠️ **Correction d'un raisonnement faux, à ne pas recopier.** Deux messages du premier contrat
> **interpolaient le contenu du modèle** : « *This cell fills a column named `${cell.columnId}`,
> which the table does not declare.* » et « *Two columns of this table share the id
> `${column.id}`.* ». La règle du dépôt est écrite et opposable — ADR 0003:417, « la charge
> d'erreur doit rester sûre à journaliser même quand le document ne l'est pas » — et la pratique du
> paquet est unanime : **mesuré**, `grep -rn 'message:' packages/core/src --include=*.ts | grep '\${'`
> ne rend **aucun** résultat, les deux seules interpolations du paquet étant des constantes
> (`schemas.ts:140-141`). `columnId` est un `z.string().min(1)` : longueur non bornée, contenu
> arbitraire, choisi par l'auteur du modèle — c'est-à-dire par l'attaquant du modèle de menace. Les
> trois messages du tableau ci-dessus sont donc **constants**, et c'est le `path` qui désigne la
> faute : il le fait déjà exactement. **L'affichage de l'identifiant fautif appartient à l'éditeur**,
> qui tient l'arbre et le lit au chemin fourni — même argument que l'ADR 0003 pour `at`.
>
> Conséquence directe sur les tests : les trois `it` du `superRefine` épinglent une chaîne
> **littérale**, jamais une chaîne construite. Un test qui écrirait
> `expect(issue.message).toContain(columnId)` ré-ouvrirait le trou par la porte de service, en
> rendant vert un message qui recopie le modèle.

> ⚠️ **Correction d'un décompte faux, à ne pas recopier.** Une version antérieure de D6 écrivait
> « *les cinq refus rendent cinq messages lisibles* ». **Mesuré : cinq entrées, quatre messages.**
> Le fractionnaire rend `invalid_type` ; le zéro **et** le négatif rendent le **même** `too_small`
> (« may not go below 1 ») ; le non fini rend le message de `z.number({ error })`, identique pour
> `NaN` et pour `Infinity`, parce que `z.number()` n'accepte que le fini et qu'un `.finite()` ne
> tirerait jamais ; le hors-borne-haute rend `too_big`. **Le test de refus de largeur épingle donc
> quatre messages dans quatre `it`, pas cinq.** Écrire cinq `it` en ferait deux qui épinglent la
> même chaîne — une couverture qui monte sans qu'un contrat de plus soit vérifié, ce que la §5 d'
> `AGENTS.md` nomme un test tautologique.

**Un doublon mesuré, à ne pas prendre pour un défaut.** Une cellule dont le `columnId` est la chaîne
vide rend **deux** issues sur le **même** chemin `['footer', 0, 'cells', 0, 'columnId']` : le
`too_small` du champ, puis le `custom` de la cellule orpheline — la chaîne vide n'est déclarée par
aucune colonne, donc elle est aussi un orphelin. C'est correct et il faut le savoir avant d'écrire
l'`it` : l'assertion porte sur `issues[0]`, ou sur `issues.length === 2`, jamais sur un unique
message.

> ⚠️ **Correction d'un raisonnement faux, à ne pas recopier — et celle-ci renverse une correction
> antérieure.** Le dossier de revue conclut que le garde `if (declared.size === 0) return;` de
> `checkTableWiring` est **du code mort à supprimer**, sur l'énoncé suivant : « *Zod n'exécute pas
> le `superRefine` tant que le parse de base a échoué (mesuré) : C8 reçoit un message à la fois, et
> aucun garde de cascade n'est nécessaire.* » **Cet énoncé est faux, et la mesure qui le portait a
> été prise contre un build qui contenait encore le garde.**
>
> **Ce que Zod 4 fait réellement, mesuré** (Node v24.11.1, `zod@3.25.76` importé via `zod/v4`) : un
> `superRefine` posé sur un `ZodObject` est sauté **uniquement** quand une issue *abandonnante* est
> survenue — `invalid_type` et `invalid_value`. Les issues *continuables* — `too_small`, `too_big`,
> `custom` — le laissent tourner. Le tableau ci-dessous est le rejeu : chaque entrée est un tableau
> dont le pied porte **en outre une cellule nommant une colonne non déclarée**, de sorte qu'une
> issue de câblage existe toujours et que la seule question soit de savoir si elle est rapportée.
>
> | Faute injectée | Code | Le `superRefine` tourne-t-il ? | Issues rendues |
> | :--- | :--- | :--- | :--- |
> | `columns: []` | `too_small` | **oui** | 1 (le garde l'arrête après le contrôle d'unicité) |
> | `width: 1.5` | `invalid_type` | non | 1 |
> | `width: NaN` | `invalid_type` | non | 1 |
> | `align: 'left'` | `invalid_value` | non | 1 |
> | `width: 0` | `too_small` | **oui** | **2** |
> | `width: 1001` | `too_big` | **oui** | **2** |
> | `id: ''` sur une colonne | `too_small` | **oui** | **2** |
> | `rows: []` sur un groupe | `too_small` | **oui** | **2** |
> | `as: '1bad'` | `custom` | **oui** | **2** |
>
> **Donc `columns.min(1)` n'arrête rien**, et le garde n'est pas mort : c'est lui, et lui seul, qui
> tient le compte à un. **Rejeu décisif** : le `dist` compilé du contrat a été dupliqué, les quatre
> lignes du garde retirées de la copie, **rien d'autre changé**, et les deux modules interrogés avec
> la même entrée. Sur un tableau sans colonne déclarée dont l'en-tête porte cinq cellules, le corps
> une ligne de cinq et le pied une ligne de deux — **douze cellules** —, le résultat est **1 issue
> avec le garde et 13 sans**, soit une par cellule plus celle de `columns` ; sur la variante à trois
> cellules d'en-tête, **1 avec et 4 sans**. Le « treize » que le dossier avait relevé était juste :
> c'est la conclusion qu'on en avait tirée qui ne l'était pas.
>
> **Le garde reste donc dans le contrat, et les quatre lignes ne se suppriment pas.** Il perd en
> revanche son second argument : la branche n'est pas « prouvablement inatteignable », elle est
> **atteinte à chaque tableau sans colonne**, donc couvrable, donc testée. C'est le renversement
> exact : ce qu'on croyait impossible à couvrir est le seul `it` qui protège la lisibilité des refus
> de C3.
>
> Ce que la correction retirée avait **raison** de dire, et qui reste vrai : « une largeur `1.5`
> masque les fautes de câblage jusqu'à sa correction ». Mesuré, et c'est le cas `invalid_type`
> ci-dessus. La formule juste est donc : *un refus de type masque le câblage, un refus de borne ne
> le masque pas.*

**Les deux `it` que cela impose**, dans `table.test.ts`, et le premier est celui sans lequel tout le
reste est supposé :

```ts
it('names ONE fault when a table declares no column, whatever its rows hold', () => {
  // Le garde `declared.size === 0` de `checkTableWiring` est ce qui tient ce compte à 1.
  // MESURÉ en le retirant du `dist` compilé, tout le reste inchangé : la même entrée rend 13
  // issues -- une par cellule du tableau, plus celle de `columns`. Un auteur qui a oublié de
  // déclarer ses colonnes a UNE chose à corriger, et C8 doit le lui dire une fois.
  const result = TableNodeSchema.safeParse({ ...RECIPE_TABLE, columns: [] });

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues).toHaveLength(1);
    expect(result.error.issues[0]?.path).toStrictEqual(['columns']);
    expect(result.error.issues[0]?.message).toBe('A table needs at least one column');
  }
});

it('lets a BOUND fault and a wiring fault be reported together, and a TYPE fault mask it', () => {
  // La dépendance de ce lot au comportement de zod 4, épinglée plutôt que supposée : un
  // `superRefine` est sauté sur `invalid_type` / `invalid_value`, jamais sur `too_small`.
  // A rejouer a chaque montee de zod, comme l'ADR 0004 le fait pour la regle nursery de Biome.
  const withOrphan = (column: TableColumn): unknown => ({
    type: 'table',
    id: 't',
    columns: [column],
    header: [],
    body: [],
    footer: [{ type: 'tableRow', id: 'f', cells: [{ columnId: 'tva', children: [] }] }],
  });

  const bound = TableNodeSchema.safeParse(withOrphan({ id: 'a', width: 0, align: 'start' }));
  const masked = TableNodeSchema.safeParse(withOrphan({ id: 'a', width: 1.5, align: 'start' }));

  expect(bound.success).toBe(false);
  expect(masked.success).toBe(false);
  // `too_small` est continuable : la borne ET le câblage sont rapportés.
  if (!bound.success) expect(bound.error.issues).toHaveLength(2);
  // `invalid_type` abandonne : la cellule orpheline reste invisible jusqu'à correction.
  if (!masked.success) expect(masked.error.issues).toHaveLength(1);
});
```

Ce second `it` est la seule chose du dépôt qui rougirait si une montée de Zod changeait la règle
d'abandon — et cette règle est la raison pour laquelle un tableau mal formé reste lisible. Elle
rejoint « ce que le lot tient pour acquis » [§9], **à côté** de la dépendance déjà nommée : un
`z.object().superRefine()` reste un `ZodObject`, donc un membre légal des deux unions discriminées.

### 5.2 Le câblage — ce qui casse à la compilation, et ce qui ne casse pas

Le Visitor n'est pas une politesse d'architecture : c'est le mécanisme qui transforme « un type de
nœud a été oublié » en erreur de compilation à un site unique. Il ne couvre pas tout, et le tableau
dit exactement où il s'arrête.

| Site | Fichier | Porte |
| :--- | :--- | :--- |
| `const exhaustive: never = node` | `ast/visitor.ts:50` | **2** — `TS2322`, `Type 'TableNode' is not assignable to type 'never'` |
| le littéral de `childrenOf` | `ast/visitor.ts:62` | **2** — `TS2741`, `Property 'table' is missing` |
| le littéral `READS_VISITOR` | `ast/visitor.ts:141` | **2** — `TS2741` |
| le visiteur en ligne du premier `it` | `ast/__tests__/visitor.test.ts:56` | **3** — `TS2741` |
| le visiteur en ligne du second `it` | `ast/__tests__/visitor.test.ts:82` | **3** — `TS2741` |
| `TABLE_COLUMN_SCHEMA_IN_STEP` | `ast/__tests__/nodes.test.ts` | **3** — l'annotation s'effondre en `false` |
| **le membre `TableNodeSchema` de `blockMembers()`** | `ast/schemas.ts` | **4 seulement** — aucune porte de type |
| l'estampille `CURRENT_SCHEMA_VERSION` | `template/template.ts` | **4 seulement** — `migrate.test.ts` |
| le libellé `tableRowGroup` de `LIST_CALLER_SUBJECTS` | `expression/evaluator/evaluate.ts` | **4 seulement** — la table est un `Partial` |
| les deux barrels | `core/src/index.ts`, la façade `ast/nodes.ts` | **aucune** — voir [§5.5] |
| `BlockType` du designer | `packages/designer/src/types.ts` | **aucune** avant INC-4, **2** après |

La nuance de porte est la même qu'au lot C2 : `packages/core/tsconfig.json` **exclut** les quatre
orthographes de fichier de test, `tsconfig.typecheck.json` les réinclut. Les trois sites de
`visitor.ts` rougissent donc dès la porte 2 ; les trois sites de test seulement à la porte 3. *Les
numéros de ligne sont ceux mesurés avant INC-0 ; le déplacement vers `__tests__/` les décale sans
rien changer d'autre, et c'est une raison de plus pour qu'INC-0 soit un déplacement pur.*

**Ce que coûte un incrément incomplet, mesuré par étapes** (même bac à sable, `tsc -p
tsconfig.typecheck.json`, baseline à exit 0) :

- élargir `DocumentNode` de `TableNode` **et rien d'autre** → **1 erreur** dans tout le paquet,
  tests compris : `visitor.ts(50,13) TS2322` ;
- ajouter les trois membres à `NodeVisitor` et les trois `case` à `visitNode` → **4 erreurs** :
  `visitor.ts(62,51)`, `visitor.ts(141,7)`, `visitor.test.ts(56,23)`, `visitor.test.ts(82,27)`,
  toutes `TS2741` ;
- compléter les quatre littéraux → **exit 0**.

**La dérive de champ est rattrapée cinq fois, et quatre le sont avant les tests.** Retirer `align`
de `TableColumnSchema` — le geste exact d'une dérive entre le type écrit à la main et le schéma —
rend, **mesuré** : `TS6133` sur l'import devenu inutile de `TABLE_COLUMN_ALIGNMENTS`, **deux**
`TS2375` sur les annotations `z.ZodType<BlockNode>` et `z.ZodType<DocumentNode>`, et `TS2345` sur
l'argument `checkTableWiring` passé à `.superRefine`. Ces quatre-là sont à la **porte 2**.
L'assertion `TABLE_COLUMN_SCHEMA_IN_STEP` de `nodes.test.ts` s'effondre en `false` et fait le
cinquième, à la **porte 3** — et c'est elle qui compte le plus, parce qu'elle est la seule qui
attrape aussi la dérive **inverse**, un champ ajouté au schéma et oublié dans l'interface. Un
décompte qui annonce « quatre au total » a oublié la porte 3 ; la docstring de l'assertion doit donc
lire « *and in four other places besides* », pas trois.

> 🔑 **Le trou de covariance, et la manipulation qui le prouve.** Il reste **un** site que rien
> n'atteint : le membre `TableNodeSchema` de `blockMembers()`. `z.ZodType<out Output>` est
> **covariant** en sa sortie, donc une union qui produit *moins* que `BlockNode` reste assignable à
> `z.ZodType<BlockNode>`, et une assertion de mutuelle assignabilité posée sur un schéma **annoté**
> est tautologique. **Mesuré, en retirant le membre** : `tsc -p tsconfig.json` **exit 0**,
> `tsc -p tsconfig.typecheck.json` **exit 0**, build propre — **seul le test de parsing rougit**.
> Le symptôme au runtime est le mode de défaillance nominal d'un oubli de schéma :
> `DocumentNodeSchema.safeParse({ type: 'table', … })` rend `invalid_union` / « No matching
> discriminator » sur `['type']`, et via `parseTemplate` sur `['root','children',0,'type']` — ni
> version, ni remède, exactement le refus illisible que l'estampille de [§2, D11] existe pour
> supprimer ailleurs.
>
> **À faire une fois, à la main, dans INC-1 :** retirer `TableNodeSchema` du corps de
> `blockMembers()`, constater que les portes 1, 2 et 3 restent **vertes** et que le seul `it`
> d'union de `nodes.test.ts` **rougit**, puis annuler. Le garde-fou est alors **prouvé, pas
> supposé** — et c'est le même geste que le plan C1 prescrivait sur `z.lazy` et le plan C2 sur
> `printableMembers()`. Trois lots, trois fois le même trou : ce n'est pas une précaution, c'est la
> propriété permanente de `z.ZodType`.

Le test qui l'occupe est celui-ci, et il vit dans `nodes.test.ts` parce que c'est ce fichier qui
porte déjà les deux gardes anti-dérive du paquet :

```ts
it('accepts a table through the block union, and a row only through its table', () => {
  expect(BlockNodeSchema.safeParse(RECIPE_TABLE).success).toBe(true);
  expect(DocumentNodeSchema.safeParse(RECIPE_TABLE).success).toBe(true);
  expect(BlockNodeSchema.safeParse({ type: 'tableRow', id: 'r', cells: [] }).success).toBe(false);
  expect(DocumentNodeSchema.safeParse({ type: 'tableRow', id: 'r', cells: [] }).success).toBe(true);
});
```

Les quatre assertions ne sont pas décoratives : les deux premières attrapent l'oubli dans
`blockMembers()`, la troisième prouve que la coupure d'union **mord** — sans elle, `BlockNode`
serait un alias verbeux de `DocumentNode` —, et la quatrième prouve qu'elle ne mord pas trop loin,
puisque `parseDocumentNode` doit continuer à valider un sous-arbre de lignes que l'éditeur tient en
main. **Et l'expression complète du refus se mesure au niveau du modèle** : une ligne nue glissée
dans `root.children` est refusée sur `root.children.2.type` / « No matching discriminator »
(mesuré), ce qui est le bon endroit — le flux de blocs — et non « quelque part dans un tableau ».

### 5.3 Portée, alias et collecte de chemins

C'est la partie du lot où une erreur ne casserait rien et ne se verrait pas : un sous-arbre que
`childrenOf` ne rend pas est invisible pour `walk`, pour `findNodeById` et pour `collectDataPaths`
**sans la moindre erreur**, et `collectFrom` n'est pas à modifier — il descend par `childrenOf`
justement pour ça (`visitor.ts:205-208`).

**Ce que `childrenOf` rend, mesuré sur le modèle de recette :**

| Nœud | Rendu |
| :--- | :--- |
| le tableau `lignes` | `tableRow:entete`, `tableRowGroup:corps`, `tableRow:ligne-total` — les trois sections, dans l'ordre du flux |
| le groupe `corps` | `tableRow:ligne-detail` — la **référence stockée**, `childrenOf(group) === group.rows` est `true` (mesuré) |
| la ligne `ligne-detail` | les **cinq** nœuds texte de ses cinq cellules, à plat |
| la ligne `ligne-total` | les **deux** nœuds texte de ses deux cellules |

Deux `it` en découlent, et le second est celui qu'on oublie : `walk(RECIPE_TABLE)` rend **dix-sept**
nœuds et `walk(RECIPE_TEMPLATE.root)` en rend **dix-neuf** (mesuré ; les deux de plus sont la racine
et le titre). Le dix-sept se recompte à la main, et il faut qu'il se recompte : le tableau (1), la
ligne d'en-tête et ses cinq textes (+6), le groupe, sa ligne et ses cinq textes (+7), la ligne de
pied et ses deux textes (+3). `findNodeById(RECIPE_TABLE, 'td-montant')` trouve par ailleurs le nœud
le plus profond du corps, et `'tf-montant'` celui du pied : sans cette seconde assertion, un
`childrenOf` qui oublierait la section `footer` passerait la première.

**L'allocation, à écrire dans la docstring et pas seulement dans le test — et la formulation juste
est celle par la NÉGATIVE.** **Quatre** branches sur huit rendent la **référence stockée** —
`container`, `loop`, `condition`, `tableRowGroup` — et **les quatre autres allouent** : `table` par
spread, `tableRow` par `flatMap`, et les **deux feuilles**, dont le littéral vide est un tableau neuf
à chaque appel. Mesuré : `childrenOf(table) === table.header` est `false`,
`childrenOf(group) === group.rows` est `true`, et `childrenOf(text) === childrenOf(text)` est
**`false`**. Sur le modèle de recette, `walk` appelle `childrenOf` une fois par nœud, soit **19
appels dont 17 allouent** — les 13 feuilles plus les 4 tableaux calculés — et **2 seulement rendent
une référence** ([§3.4] porte le décompte détaillé et la correction de son étiquette : « 4 » est le
nombre d'appels rendant un tableau **calculé et non vide**, jamais le nombre d'appels **allouants**).
Conséquence à écrire, et elle porte donc sur six branches sur huit et non deux : **un consommateur
ne mémoïse pas sur l'identité du résultat**. Et une seconde, plus lourde de sens : **l'attribution
d'un nœud à une colonne passe par le nœud tableau** — id de table plus `columnId` de la cellule —
jamais par le parcours, puisque la frontière de cellule y est effacée par l'aplatissement. Aucun
précalcul n'est écrit tant qu'aucun consommateur réel n'existe : c'est la règle anti-sur-ingénierie,
et elle s'applique ici comme ailleurs.

**La collecte, qui est la garantie que l'ADR 0002 a payée cher.** Mesuré sur le modèle de recette
complet :

```ts
expect(collectDataPaths(RECIPE_TEMPLATE.root)).toStrictEqual(['facture.numero', 'facture.lignes']);
```

Exactement deux chemins. **Aucun `ligne.*` ne fuit**, alors que le modèle en écrit **huit** — six
dans les cellules du corps (quatre liaisons directes, plus les deux du produit de la cellule
`montant`) et **deux** dans le pied, sous l'agrégat —, pour quatre chemins distincts. Deux
mécanismes distincts les filtrent, et il faut les nommer séparément : les six du corps le sont parce
que `nodeReads(group)` déclare `binds: 'ligne'`, les deux du pied parce que `pathsOf` porte son
**propre** contexte d'alias et voit le `as: 'ligne'` de l'agrégat. Si l'un des deux tombait, l'autre
ne rattraperait rien — c'est pour cela que le pied du modèle de recette lit l'alias, et non
seulement le corps. Et le tableau seul, sans son titre, rend `['facture.lignes']` : c'est la même
assertion vue par l'autre bout, et elle prouve que le tableau **ne lit rien de son côté** —
`nodeReads(table)` est `NO_READS`.

**La contre-épreuve, qui est le vrai test.** Un alias de groupe employé **hors de son groupe**
**redevient une clé d'appelant**, et il faut le montrer plutôt que l'affirmer : dans un tableau dont
le pied lit `ligne.montant` alors que `ligne` n'est lié que par le groupe du corps,
`collectDataPaths` rend `['facture.lignes', 'ligne.montant']` (mesuré). C'est le comportement voulu
et il vaut mieux qu'il soit épinglé : si le tableau liait l'alias — la forme que [§2, D8] écarte —
cette lecture serait filtrée en silence, et l'intégrateur ne serait jamais interrogé sur une donnée
que le document lit réellement. C'est exactement le défaut que l'ADR 0002 a corrigé pour les
boucles, et l'`it` est ce qui empêche de le réintroduire.

**Le site d'erreur et son libellé, dans le même `it`.** Mesuré :

```ts
// packages/core/src/expression/evaluator/__tests__/limits-scope.test.ts
expect(() => evaluateSequence(path('facture'), { facture: 3 }, { caller: 'tableRowGroup' }))
  .toThrow('A table body needs a list to iterate over, got a number.');
```

`LIST_CALLER_SUBJECTS` est un `Partial` : un site non listé retombe **silencieusement** sur « An
expression », et rien dans les quatre portes ne le dit. L'assertion doit donc porter sur la chaîne
entière et non sur un fragment, sinon elle reste verte le jour où le libellé disparaît. Le contrôle
croisé est gratuit et vaut d'être écrit à côté : le même appel avec `caller: 'loop'` rend
`A loop needs a list to iterate over, got a number.` (mesuré) — deux sites, deux sujets, et c'est
tout ce que ce lot demande à `errors.ts`.

### 5.4 Migration — les contrats

Six contrats, tous mesurés sur le bac à sable, et le cinquième est celui qui surprend.

1. **La chaîne pas à pas.** `TEMPLATE_MIGRATIONS.map((step) => [step.from, step.to])` rend
   `[[1, 2], [2, 3], [3, 4]]`, et `expect(TEMPLATE_MIGRATIONS).toHaveLength(CURRENT_SCHEMA_VERSION - 1)`
   suit dans le même `it` (`migrate.test.ts:136-145`, dont l'attendu passe de deux entrées à trois).
   C'est **la seule** assertion qui prouve que `3 → 4` n'a pas été fusionnée dans `2 → 3` : un
   convertisseur direct amènerait le même document à la même estampille, donc le test de bout en
   bout ne saurait pas faire la différence. Seule la forme du registre le dit.
2. **L'estampille et rien d'autre, épinglée par exclusion.** Déstructurer `schemaVersion` des deux
   côtés, puis `toStrictEqual` sur le reste — le patron que `migrate.test.ts:337-346` exécute déjà
   pour `1 → 2`. Sans cette forme, une migration qui reformerait un document en douce passerait
   inaperçue, et c'est la classe de bug la plus difficile à voir.
3. **Un document estampillé 3 sans tableau parse et sort à 4.** Mesuré. C'est la moitié du contrat
   que « purement additif » recouvre : rien de ce qui existait ne devient irrecevable.
4. **Un document estampillé 5 rend `TemplateMigrationError` en nommant la version.** Mesuré, message
   exact : `Template uses schema version 5 but this build understands at most 4. It was written by
   a newer release of Openview; upgrade before opening it.`, avec `fromVersion === 5`. Le test
   existe déjà sous forme générique (`migrate.test.ts:293-307`, écrit contre
   `CURRENT_SCHEMA_VERSION + 1`) : il n'est pas à dupliquer, il est à laisser suivre le bump. **Et
   c'est ce message, et lui seul, qui est le produit de l'incrément 3** : sans l'estampille, un
   build v3 rencontrant `{ type: 'table', … }` rend `"No matching discriminator"` / `"Invalid
   input"` sur `root.children.0.type` — ni erreur typée, ni version, aucun remède.
5. **Le garde ne mord que vers le haut, et c'est un test d'ACCEPTATION.** Un document estampillé
   `3` mais portant **déjà** un tableau — mal estampillé, donc — **n'est pas refusé** : il parse et
   sort à `schemaVersion === 4` (mesuré). Le test porte un commentaire qui dit pourquoi, parce que
   c'est contre-intuitif et que le plan C2 a dû corriger exactement l'inverse dans sa propre §5.4.
   La raison est dans le pipeline : `parseTemplate` borne la forme, **migre**, puis valide au
   schéma **courant** (`migrate.ts:193-203`). Le schéma v4 connaissant `table`, le document passe.
   Le garde de version protège contre un document écrit par un build **plus récent** (contrat 4) ;
   il ne protège contre rien en sens inverse, et il n'a jamais été conçu pour — **c'est un garde
   d'estampille, pas de contenu**. Ce qui reste vrai et ne bouge pas : un document estampillé à la
   version **courante** portant un `type` **inconnu** est bien refusé par Zod, et c'est ce test-là
   qui prouve que l'union discriminée mord.
6. **La forme reste bornée après migration.** La migration `3 → 4` est un spread avec un scalaire
   remplacé : elle ne change **ni la profondeur ni le compte de valeurs**, donc le second passage du
   garde — celui que `parseTemplate` déclenche dès qu'une étape a tourné — accepte ce qu'il vient
   d'accepter. Le mécanisme générique est déjà couvert par `migrate.test.ts:56-79` et rien n'est à
   ajouter ; ce qui est à **écrire**, c'est la contrepartie que le dépôt se doit à lui-même : une
   migration ne rend jamais une forme hors bornes. **Aucun rétrécissement à retrofitter** : aucun
   document v3 ne peut porter une largeur de colonne, donc la fenêtre `[1, 1000]` n'a rien à
   rattraper — même argument, mot pour mot, que la fenêtre `decimals` de la migration `2 → 3`.

### 5.5 Ce qui reste hors des tests, et pourquoi

**Les deux barrels — aucune porte ne les voit.** Ni `biome check`, ni les deux `tsc`, ni Vitest
n'exigent qu'un type ou un schéma soit exporté. Un symbole oublié dans `packages/core/src/index.ts`
ou dans la façade `ast/nodes.ts` passe les quatre portes en vert, et le seul détecteur du dépôt est
le **playground**, à condition qu'il s'en serve : c'est pour cela qu'INC-4 est un incrément et non
une finition, et que la [§6.4] compte les symboles au lieu de les supposer.

**Ce que seul le playground détecte, au-delà du barrel.** Qu'un `TableNode` soit *rendable* — que
`header`/`body`/`footer` suffisent à produire un `<thead>`/`<tbody>`/`<tfoot>`, que
`width / Σ width` donne des colonnes d'aspect crédible, que `align` se traduise sans information
supplémentaire. Aucun test de `core` ne peut le dire, parce que `core` ne rend rien. C'est le rôle
exact de la [§6.3].

**Ce qui relève de la revue humaine, et de rien d'autre.** L'assertion en chevrons `<X>v`, qu'aucun
linter du dépôt ne voit ; la promesse non attendue, `no-floating-promises` étant hors d'atteinte ;
et — propre à ce lot — **la question de savoir si un champ appartient au tableau**. Le critère de
[§2, D1] est écrit pour être opposable, mais c'est un relecteur qui l'applique : aucune machine ne
refusera une `TableColumn.font` ajoutée un vendredi.

> ⚠️ **Une propriété annoncée pour `fixtures.ts` est fausse, et une seconde, tue, l'est aussi.**
> Le dossier justifie le fichier `packages/core/src/ast/__tests__/fixtures.ts` ainsi : « *hors du
> glob `*.{test,spec}.ts`, donc ni collecté par Vitest ni compté dans la couverture* ». La première
> moitié est vraie — `vitest.config.ts:32` ne collecte que `src/**/*.{test,spec}.{ts,tsx}`, donc
> aucun « No test suite found ». **La seconde est fausse, et une troisième propriété que la phrase
> laisse croire sans l'écrire l'est également. Les deux se lisent dans deux fichiers du dépôt.**
>
> **(1) Le fichier EST compté dans la couverture.** `vitest.config.ts:39-40` instrumente
> `packages/*/src/**/*.{ts,tsx}` et n'exclut que `*.{test,spec}.{ts,tsx}` et les `.d.ts`.
> `fixtures.ts` tombe donc sous le seuil de 90 % appliqué à `packages/core/src/**`. Ce n'est pas
> bloquant — les fabriques `lit`, `bind`, `p`, `txt`, `cell`, `round`, `mul` sont toutes appelées à
> l'évaluation du module, donc lignes et fonctions sont couvertes, et le fichier ne porte aucune
> branche — mais **la conséquence est une règle de conduite** : toute fabrique ajoutée à ce fichier
> et non appelée fait baisser la couverture de fonctions de `core`, sans qu'aucun test ne rougisse
> ailleurs. Une fixture n'est pas un bac à sable.
>
> **Et une règle de conduite non outillée n'est pas une règle** — c'est la phrase d'ouverture
> d'`AGENTS.md`, et elle vaut contre ce plan comme contre le reste. La règle ci-dessus est donc
> **adossée à un critère mécanique en [§6.4]** : la couverture de fonctions **et** de lignes de
> `fixtures.ts`, lue dans `coverage/coverage-summary.json` que `json-summary` produit déjà, doit
> rendre `100 100`. Le seuil global de 90 % ne peut pas jouer ce rôle : il agrège, donc une fabrique
> morte s'y dilue, et le jour où il mordrait il désignerait `packages/core` entier plutôt que le
> fichier. Un critère par fichier désigne le coupable.
>
> **(2) Le fichier est COMPILÉ dans `dist/` et embarqué dans le tarball.**
> `packages/core/tsconfig.json` inclut `src/**/*` et n'exclut que les quatre orthographes de test —
> et le commentaire qui accompagne cette liste raconte déjà l'accident : un `*.spec.ts` avait été
> compilé dans `dist/` et publié avec un import `vitest` que les consommateurs n'installent pas.
> **Mesuré** (tsc 7.0.2, le `tsconfig.json` réel, `--outDir` vers un dossier jetable, exit 0) :
> `dist/ast/__tests__/fixtures.js`, `.d.ts` et les deux `.map` sont **émis**. Avec
> `"files": ["dist", "LICENSE"]` dans `packages/core/package.json`, ils partent dans le paquet.
>
> **Trois issues, et celle qui est retenue.** Ajouter une ligne à `exclude` est une édition de
> `tsconfig.json`, que `AGENTS.md` §7 réserve à une demande explicite. Renommer en `fixtures.spec.ts`
> ferait collecter le fichier par Vitest, qui échoue sur un fichier sans suite. **Retenu : garder
> `fixtures.ts` tel quel et refuser l'accident nommé par le commentaire**, c'est-à-dire l'import de
> `vitest`. Le fichier ne porte que des types et des constantes ; `exports` ne publie que `"."`,
> donc rien n'est importable par sous-chemin, et le résidu est de quelques kilo-octets de JS mort.
>
> *(Une quatrième issue a été écartée après coup et vaut d'être notée, pour qu'elle ne soit pas
> reproposée : sortir la fixture de `src/` — dans `packages/core/test/`, par exemple — casse le
> `rootDir: "src"` que l'`AGENTS.md` §5 nomme précisément comme la contrainte que `__tests__/`
> respecte. Aucune des quatre n'est gratuite ; celle qui est retenue est la seule qui ne touche ni
> un fichier protégé par le §7, ni la collecte de Vitest, ni la compilation.)*
>
> **Les DEUX critères mécaniques correspondants sont en [§6.4]** — l'import de `vitest` pour
> l'accident de publication, la couverture à `100 100` pour la fabrique morte. Ce qu'il ne faut
> surtout pas faire, c'est laisser la phrase du dossier telle quelle : elle promet une exclusion qui
> n'existe pas, et c'est exactement le défaut que l'ADR 0002 reproche à une docstring — *elle promet,
> elle ment*.

---

## 6. Le critère de recette, et comment on le démontre

### 6.1 L'énoncé, et sa lecture

> « **Prêt quand** un tableau à cinq colonnes typé (désignation, quantité, prix unitaire, remise,
> montant) est décrit dans un modèle, en-tête compris, et que sa dernière ligne **peut** être une
> somme de ce qui précède. » — `docs/roadmap/core.md:157-159`

Trois membres, et chacun se lit avec une précision qui change le lot.

**« cinq colonnes typé ».** Le mot *typé* porte deux lectures qui ne livrent pas le même produit, et
ce plan retient la première : *décrit dans un contrat typé*, les cinq colonnes étant un **jeu
d'épreuve** et aucune ne portant de type de donnée. La seconde lecture — *chaque colonne porte un
type*, monétaire, nombre, texte, date, dont le moteur déduirait format et alignement — appelle une
échelle et un symbole, donc un arrondi implicite, et préempterait par la porte de service la
question que C2 a explicitement laissée ouverte : qui déclare l'échelle d'**affichage** d'un
montant. **C'est l'arbitrage n°1 [§8], et il est à rendre avant INC-1** : s'il tombe sur la seconde
lecture, ce contrat est à **rejouer**, pas à amender.

**« en-tête compris ».** C'est ce qui interdit de traiter l'en-tête comme une convention. Le
critère ne demande pas qu'on puisse *afficher* des intitulés — un `TextNode` au-dessus du tableau
en afficherait — mais qu'ils soient **dans le tableau** et identifiés comme tels, faute de quoi E2
devrait deviner quelle ligne répéter. `TableNode.header` est un champ nommé, pas « la première
ligne » ([§2, D4]).

**« sa dernière ligne PEUT être une somme ».** Le modal est décisif, et il est la moitié du lot.
Le critère ne demande pas que le tableau **sache** sommer : il demande que la dernière ligne
**puisse** l'être. C'est exactement la différence entre un champ `total` sur la colonne — que
[§2, D9] refuse structurellement — et une cellule de pied qui porte
`round(sum(facture.lignes, ligne, round(mul(ligne.quantite, ligne.prixUnitaire), 2, halfExpand)), 2, halfExpand)`,
écrite par l'auteur du modèle et visible dans l'arbre. Un contrat qui livrerait l'auto-somme
satisferait la lettre du critère et violerait la décision 8 de l'ADR 0004.

> ⚠️ **Ce que le modèle démontre n'est PAS une somme de la colonne, et il faut le dire.** Le
> critère écrit « une somme **de ce qui précède** », et un lecteur pressé comprendra « le total de
> la colonne Montant ». Ce n'est pas ce qui se passe, et rien dans le contrat ne le rend vrai. Le
> modèle produit **deux écritures de la même arithmétique** :
> `round(mul(ligne.quantite, ligne.prixUnitaire), 2, halfExpand)` dans la cellule du corps, et la
> **même** sous l'agrégat du pied. **Aucun mécanisme du contrat ne les lie.** C'est un **recalcul
> parallèle**, pas une somme de colonne.
>
> La conséquence est une divergence **silencieuse** : un auteur qui corrige l'une et pas l'autre
> obtient un total qui contredit sa propre colonne, et personne ne le lui dit. `core` ne le refuse
> pas — les deux expressions sont licites —, `collectDataPaths` ne le voit pas — mesuré, il rend
> `['facture.numero', 'facture.lignes']`, les deux écritures étant indiscernables pour lui —, et le
> seul outil qui pourrait le voir est le lint d'éditeur de D7 du designer, très loin en aval.
>
> **C'est le prix, assumé, du refus des références croisées de C1** : une cellule ne peut pas dire
> « la somme de la colonne au-dessus », parce qu'aucune expression ne référence une autre valeur du
> document. Le remède n'est pas un champ dans le contrat — ce serait l'auto-somme, refusée — mais
> **un lint d'éditeur**, et il est nommé comme tel. Deux gestes en découlent, tous deux appliqués
> ci-dessous : le modèle de recette emploie **le même nom d'alias `ligne`** dans le groupe et dans
> l'agrégat, pour que la duplication soit **comparable à l'œil** — les deux portées sont disjointes,
> le masquage est purement lexical, cela ne coûte rien et c'est mesuré [§6.2] ; et la question part
> dans « Ce qui reste ouvert » de l'ADR 0005, reliée à la décision déjà consignée par l'ADR 0002.

### 6.2 Le modèle, et les `it` qui le démontrent

Le modèle vit dans `packages/core/src/ast/__tests__/fixtures.ts`, importé par `table.test.ts`, par
`nodes.test.ts` et par `visitor.test.ts` — un seul modèle, trois fichiers, aucune recopie. Le
fichier porte aussi le type `MutuallyAssignable`, qui était jusqu'ici **local et non exporté** dans
`nodes.test.ts` (`nodes.test.ts:12-16`) : sans ce déplacement, l'assertion
`TABLE_COLUMN_SCHEMA_IN_STEP` ne peut pas migrer sans dupliquer le type, et un type dupliqué est un
type qui divergera. `SEGMENT_SCHEMA_IN_STEP`, qui l'utilisait déjà, l'importe désormais du même
endroit : le type n'existe qu'une fois, et c'est la condition pour que les deux gardes anti-dérive
soient réellement le même garde.

**L'avertissement se recopie au-dessus de la fixture, et ce n'est pas de la décoration.** Le premier
tableau réellement décrit est celui que tout le monde recopiera — le dépôt nomme déjà ce mécanisme,
« position par défaut de fait » (`docs/roadmap/README.md:189`) — et il porte cinq noms français à consonance de
facture. Le playground applique déjà exactement cette précaution à ses noms de champs
(`App.tsx:157-162`) ; la fixture reçoit le même paragraphe, adapté aux colonnes :

```ts
// Les cinq colonnes ci-dessous — `designation`, `quantite`, `prixUnitaire`, `remise`,
// `montant` — sont un JEU D'ÉPREUVE, celui que le critère de recette de la roadmap nomme.
// Ce ne sont ni des noms réservés, ni une structure attendue, ni un gabarit : Openview
// n'impose aucun identifiant de colonne, exactement comme il n'impose aucun nom de champ
// de données. Un relevé bancaire, un bon de livraison ou un bordereau se décrivent avec un
// tout autre vocabulaire, et le contrat est le même. Le test, en cas de doute : si une
// fonctionnalité oblige l'intégrateur à nommer une colonne comme Openview l'a décidé, elle
// est à refuser (AGENTS.md, « Ce qu'Openview n'est pas »).
```

**Les fabriques, puis les deux expressions, puis le nœud.** Sur le patron des constructeurs locaux
minuscules d'`aggregate.test.ts:17-26` :

```ts
import { CURRENT_SCHEMA_VERSION } from '../../template/template.js';

const lit = (text: string): TextSegment => ({ kind: 'literal', text });
const bind = (value: PrintableExpression): TextSegment => ({ kind: 'binding', value });
const p = (path: string): PathExpression => ({ kind: 'path', path });
const txt = (id: string, content: readonly TextSegment[]): TextNode => ({ type: 'text', id, content });
const cell = (columnId: string, ...children: readonly BlockNode[]): TableCell => ({ columnId, children });
const round = (value: PrintableExpression, decimals: number): RoundExpression => ({
  kind: 'round',
  value,
  decimals,
  mode: 'halfExpand',
});
const mul = (left: PrintableExpression, right: PrintableExpression): ArithmeticExpression => ({
  kind: 'arithmetic',
  op: 'mul',
  left,
  right,
});

/** round(quantite * prixUnitaire, 2, halfExpand) -- the line amount, DECLARED. */
const montantLigne = round(mul(p('ligne.quantite'), p('ligne.prixUnitaire')), 2);

/**
 * round(sum(facture.lignes, ligne, round(ligne.quantite * ligne.prixUnitaire, 2, m)), 2, m).
 *
 * An EXPRESSION OF THE MODEL. The table sums nothing: its `footer` has nowhere to put an
 * aggregate. The alias is `ligne` here AND in the body group on purpose -- the two scopes
 * are disjoint, the shadowing is lexical and costs nothing, and writing the same name twice
 * is what makes the duplication comparable by eye. Nothing in this contract ties the two
 * copies of the arithmetic together; an editor lint is what would.
 */
const totalDeclare = round(
  {
    kind: 'aggregate',
    op: 'sum',
    source: p('facture.lignes'),
    as: 'ligne',
    value: round(mul(p('ligne.quantite'), p('ligne.prixUnitaire')), 2),
  },
  2,
);

export const RECIPE_TABLE: TableNode = {
  type: 'table',
  id: 'lignes',
  columns: [
    { id: 'designation', width: 8, align: 'start' },
    { id: 'quantite', width: 2, align: 'end' },
    { id: 'prixUnitaire', width: 3, align: 'end' },
    { id: 'remise', width: 2, align: 'end' },
    { id: 'montant', width: 3, align: 'end' },
  ],
  header: [
    {
      type: 'tableRow',
      id: 'entete',
      cells: [
        cell('designation', txt('th-designation', [lit('Désignation')])),
        cell('quantite', txt('th-quantite', [lit('Quantité')])),
        cell('prixUnitaire', txt('th-prix', [lit('Prix unitaire')])),
        cell('remise', txt('th-remise', [lit('Remise')])),
        cell('montant', txt('th-montant', [lit('Montant')])),
      ],
    },
  ],
  body: [
    {
      type: 'tableRowGroup',
      id: 'corps',
      each: p('facture.lignes'),
      as: 'ligne',
      rows: [
        {
          type: 'tableRow',
          id: 'ligne-detail',
          cells: [
            cell('designation', txt('td-designation', [bind(p('ligne.designation'))])),
            cell('quantite', txt('td-quantite', [bind(p('ligne.quantite'))])),
            cell('prixUnitaire', txt('td-prix', [bind(p('ligne.prixUnitaire'))])),
            cell('remise', txt('td-remise', [bind(p('ligne.remise'))])),
            cell('montant', txt('td-montant', [bind(montantLigne)])),
          ],
        },
      ],
    },
  ],
  footer: [
    // A SHORT ROW: two cells for five columns. Legal by construction, and exactly the shape
    // of a totals row -- the positional pairing this contract refused would have needed
    // three empty filler cells here.
    {
      type: 'tableRow',
      id: 'ligne-total',
      cells: [
        cell('designation', txt('tf-libelle', [lit('Total')])),
        cell('montant', txt('tf-montant', [bind(totalDeclare)])),
      ],
    },
  ],
};

export const RECIPE_TEMPLATE: Template = {
  // `CURRENT_SCHEMA_VERSION`, never the literal `4`. This fixture is born in INC-1, where the
  // constant is still 3 and `TemplateSchema` declares `z.literal(3)`: a literal `4` would make
  // `parseTemplate` answer `TemplateMigrationError: … written by a newer release`, and INC-1
  // would fail its own gate 4. C2 already de-literalised seven such assertions, and the
  // playground applies the rule at App.tsx:164.
  schemaVersion: CURRENT_SCHEMA_VERSION,
  id: 'facture-c3',
  name: 'Facture — tableau de lignes',
  version: '1.0.0',
  root: {
    type: 'container',
    id: 'racine',
    children: [txt('titre', [lit('Facture '), bind(p('facture.numero'))]), RECIPE_TABLE],
  },
};
```

**Ce que ce modèle pèse, mesuré** (Node v24.11.1, `assertBoundedShape` du dépôt, unité exacte du
garde, racine = niveau 1) : le **modèle complet** atteint **18 niveaux sur 64** et **231 valeurs sur
100 000** ; le **nœud tableau seul** pèse **15 niveaux** et **210 valeurs**. Les deux étiquettes
comptent : attacher 231 au tableau seul ferait croire que le titre pèse zéro.

**Les cinq `it` du critère, chacun avec son fichier.**

```ts
// packages/core/src/ast/__tests__/table.test.ts
it('describes the recipe table in a stored template, header included', () => {
  const parsed = parseTemplate(RECIPE_TEMPLATE);

  expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  // L'aller-retour JSON est ce qui prouve que le modèle est STOCKABLE, pas seulement
  // constructible : un champ que le schéma laisse tomber se voit ici et nulle part ailleurs.
  expect(JSON.parse(JSON.stringify(parsed))).toStrictEqual(RECIPE_TEMPLATE);
});

it('leaves the last row a SHORT row carrying an expression of the model', () => {
  const total = RECIPE_TABLE.footer[0];

  expect(total?.cells).toHaveLength(2);
  expect(RECIPE_TABLE.columns).toHaveLength(5);
  // Le nœud tableau porte exactement ces six clés, et la ligne de total ne porte AUCUNE clé
  // de plus qu'une ligne ordinaire. Ce que cette assertion attrape, et ce qu'elle n'attrape
  // pas, est écrit sous le test : elle mord sur un champ REQUIS, jamais sur un `total?:`.
  expect(Object.keys(RECIPE_TABLE)).toStrictEqual([
    'type',
    'id',
    'columns',
    'header',
    'body',
    'footer',
  ]);
  for (const column of RECIPE_TABLE.columns) {
    expect(Object.keys(column)).toStrictEqual(['id', 'width', 'align']);
  }
});

it('gives every column a whole-number weight inside the window, and an alignment', () => {
  for (const column of RECIPE_TABLE.columns) {
    expect(Number.isInteger(column.width)).toBe(true);
    expect(column.width).toBeGreaterThanOrEqual(MIN_COLUMN_WIDTH);
    expect(column.width).toBeLessThanOrEqual(MAX_COLUMN_WIDTH);
    expect(TABLE_COLUMN_ALIGNMENTS).toContain(column.align);
  }
  // « libellés à gauche, montants à droite » -- le membre du critère que l'alignement sert,
  // et la raison pour laquelle il vit dans C3 et pas dans C5.
  expect(RECIPE_TABLE.columns.map((column) => column.align)).toStrictEqual([
    'start',
    'end',
    'end',
    'end',
    'end',
  ]);
});
```

> ⚠️ **Correction d'une garantie surévaluée, à ne pas recopier.** Le commentaire de ce test annonçait :
> « *Un `total`, un `footer: 'sum'` ou un `aggregate` ajoutés plus tard font rougir cette ligne, ce
> qu'aucune docstring ne fait.* » **C'est faux pour la forme sous laquelle ce champ arriverait
> réellement**, et il faut le dire, sinon D9 se croit outillée là où elle ne l'est pas.
>
> **Ce que `Object.keys` attrape.** Un champ **requis** ajouté à `TableNode` : la fixture cesse de
> compiler à la porte 2, l'auteur l'y ajoute, et l'assertion rougit à la porte 4. La chaîne est
> indirecte mais elle se ferme.
>
> **Ce qu'il n'attrape pas, et c'est le cas probable.** Un `TableNode.total?: AggregateOperator`
> **optionnel** — précisément la forme qu'on choisirait pour éviter une migration — n'apparaît pas
> dans la fixture, donc `Object.keys` ne bouge pas et le test reste **vert**. Et
> `TableColumn.total?`, qui est le site le plus tentant des deux, n'était couvert par **rien** : le
> test portait sur le nœud tableau, pas sur la colonne. D'où la boucle `Object.keys(column)` ajoutée
> ci-dessus — même portée, mêmes limites, mais la colonne cesse d'être un angle mort complet.
>
> **La conséquence à écrire dans l'ADR 0005, parce qu'elle nuance D9 sans l'affaiblir :** le refus
> de l'auto-somme est **structurel au sens du TYPE pour le pied** — `footer: readonly TableRowNode[]`
> n'a littéralement nulle part où poser un agrégat, et cela, aucun champ optionnel ne le contourne —
> et **doctrinal, adossé à un grep, pour `TableColumn`**. Les deux ne se valent pas, et annoncer le
> second comme du type serait exactement la « règle non outillée » qu'`AGENTS.md` nomme. Le grep de
> [§6.4] est renforcé en conséquence : il ne suffisait pas non plus.

```ts
// packages/core/src/ast/__tests__/visitor.test.ts
it('asks the integrator for two keys, and for no per-item field', () => {
  // La garantie de l'ADR 0002, sur la forme qui la met le plus à l'épreuve : HUIT lectures
  // enracinées sur `ligne` sont écrites dans ce modèle, six dans le corps et deux sous
  // l'agrégat du pied, et aucune ne sort.
  expect(collectDataPaths(RECIPE_TEMPLATE.root)).toStrictEqual([
    'facture.numero',
    'facture.lignes',
  ]);
  expect(collectDataPaths(RECIPE_TABLE)).toStrictEqual(['facture.lignes']);
});

it('reaches every node of the table through childrenOf, cells included', () => {
  // Un sous-arbre que `childrenOf` ne rend pas est invisible pour `walk`, `findNodeById` et
  // `collectDataPaths` -- sans erreur nulle part. C'est l'assertion qui l'interdit.
  expect([...walk(RECIPE_TABLE)]).toHaveLength(17);
  expect([...walk(RECIPE_TEMPLATE.root)]).toHaveLength(19);
  expect(findNodeById(RECIPE_TABLE, 'td-montant')?.type).toBe('text');
  expect(findNodeById(RECIPE_TABLE, 'tf-montant')?.type).toBe('text');
});
```

**Les deux chiffres sont mesurés, et ils ne sont pas interchangeables** : **17** nœuds pour le nœud
tableau, **19** pour la racine du modèle — la même distinction d'étiquette que 15/210 contre 18/231
sur la profondeur. Un plan qui écrirait 19 pour le tableau ferait passer la racine et le titre pour
du contenu de tableau, et l'assertion rougirait au premier essai.

### 6.3 La démonstration visible — le playground

INC-4 (c) fait disparaître **la maquette de la section facture**, et rien d'autre. Aujourd'hui une
ligne de facture est **un seul nœud texte concaténé** — `line-label`, `App.tsx:173-189`, où la
désignation, le montant et la remise sont trois `binding` séparés par des littéraux — et la liste
affichée est un `<ol>` de `<li>` (`App.tsx:793-807`). Après INC-4, la ligne est un
`TableRowNode` dans un `tableRowGroup`, et le `<table>` rendu dérive **intégralement** du
`TableNode` : le `<thead>` depuis `header`, le `<tbody>` depuis `body`, le `<tfoot>` depuis
`footer`, les largeurs depuis `width / Σ width`, les alignements depuis `align`. Le
`biome-ignore lint/suspicious/noArrayIndexKey` déjà présent reste, avec sa justification écrite :
une clé de ligne est positionnelle par nature.

**Le tableau comparatif des trois arrondis (`App.tsx:827-864`) reste du JSX écrit à la main**, pour les deux raisons données en [§4, INC-4 (c)] : il agrège trois documents distincts, et sa ligne de total porte un `colSpan` que [§2, D13] refuse. Une condition de fin qui exigerait sa disparition serait inatteignable, et l'encadré d'INC-4 (c) dit pourquoi.

Ce que la démonstration prouve, et qu'aucun test de `core` ne peut prouver : que les quatre
livrables nommés par la roadmap **suffisent** à produire un tableau crédible sans qu'aucune
information supplémentaire soit inventée en chemin. Si le rendu a besoin d'un champ que le contrat
ne porte pas, cela se voit là, et nulle part ailleurs.

### 6.4 Définition de fini — critères vérifiables mécaniquement

- **Les quatre portes vertes**, couverture ≥ 90 % sur `packages/core/src/**`. Toutes les commandes
  ci-dessous se jouent sous Git Bash, que le dépôt suppose déjà pour ses quatre portes.
- `CURRENT_SCHEMA_VERSION === 4` et `TEMPLATE_MIGRATIONS.length === 3`, la première entrée toujours
  `{ from: 1, to: 2 }` et la chaîne `[[1, 2], [2, 3], [3, 4]]` ([§5.4], contrat 1).
- `git grep -l "case 'round':" -- packages/core/src | wc -l` rend **2** (`evaluate.ts`, `paths.ts`).
  C3 n'ouvre **aucun** troisième parcours d'expression, donc le seuil de retrait de l'amendement
  d'`AGENTS.md` §3.B obtenu par C2 n'est pas franchi. Ce critère ne consigne pas une exception : il
  surveille sa condition de validité.
- `git grep -l "switch (node.type)" -- packages/core/src | wc -l` rend **1** — `visitor.ts`, et
  `visitNode` seul. Le test de discriminant de `checkTableWiring` n'en est pas un second : il ne
  descend dans aucun enfant, il lit l'union à deux membres du corps d'**un** nœud, et Zod l'a déjà
  discriminée ([§8], arbitrage n°7).
- `git grep -n "const exhaustive: never" -- packages/core/src | wc -l` rend **6** — inchangé : C3
  n'ajoute aucun `switch`, il complète celui qui existe.
- **Les 20 symboles nouveaux sont importables depuis `@openview/core`** — vérifié par le playground,
  aucune porte ne le voit ([§5.5]). Le compte se recompte : **9 types** (`BlockNode`,
  `BlockNodeType`, `TableBodyNode`, `TableCell`, `TableColumn`, `TableColumnAlignment`, `TableNode`,
  `TableRowGroupNode`, `TableRowNode`), **10 valeurs** de `./ast/nodes.js` (`BlockNodeSchema`,
  `MAX_COLUMN_WIDTH`, `MIN_COLUMN_WIDTH`, `TABLE_COLUMN_ALIGNMENTS`, `TableBodyNodeSchema`,
  `TableCellSchema`, `TableColumnSchema`, `TableNodeSchema`, `TableRowGroupNodeSchema`,
  `TableRowNodeSchema`) et **1 valeur** de `./template/guard.js` (`parseBlockNode`). Après INC-4, le
  bloc `export type { … } from './ast/nodes.js'` de `index.ts` compte **19** noms et le bloc
  `export { … }` en compte **19** ; le bloc de `guard.js` en compte **6**. *Ce n'est pas le 17 du
  contrat figé : `TableBodyNodeSchema`, `BlockNodeType` et `parseBlockNode` sont trois ajouts issus
  de la revue, et un décompte non recompté est un décompte faux.*
- `git grep -nw 'designation\|quantite\|prixUnitaire\|montant' -- packages/core/src ':!*__tests__*'`
  ne rend **rien** : les cinq colonnes du critère sont un jeu d'épreuve, elles vivent dans la
  fixture et dans le playground, jamais dans le contrat.

  > ⚠️ **La forme naïve de ce critère est fausse, à ne pas recopier.** Écrit sans `-w`, comme
  > `git grep -n 'designation\|prixUnitaire\|remise' -- packages/core/src ':!*__tests__*'`, il rend
  > **trois résultats aujourd'hui, avant même que C3 commence** : deux viennent de ce que
  > « p**remise** » contient « remise » (`aggregate.ts:29`, `limits.ts:44`), le troisième d'un vrai
  > `remise` en docstring (`text.ts:15`). Un critère dont la sortie attendue est « rien » et qui
  > rend trois lignes sur un dépôt sain n'est pas vérifiable, il est décoratif. **Mesuré** avec
  > `-w` : `designation`, `quantite`, `prixUnitaire` et `montant` rendent **0** résultat chacun ;
  > `remise` en rend **exactement 1**, `text.ts:15`, une docstring de C1
  > (`concat(remise, text(div(total, remise)))`) qui préexiste et que C3 **ne touche pas**. Le
  > critère se scinde donc en deux : les quatre premiers à zéro, et
  > `git grep -nw remise -- packages/core/src ':!*__tests__*'` rendant cette unique ligne,
  > **inchangée**.
- **`fixtures.ts` — les DEUX critères, parce que le fichier tombe sous deux régimes que rien
  d'autre ne surveille** ([§5.5]). Il est compilé dans `dist/` et embarqué dans le tarball, **et**
  il est instrumenté par la couverture.

  *(a) L'accident de publication.* `git grep -n "from 'vitest'" -- packages/core/src/ast/__tests__/fixtures.ts`
  ne rend **rien** — c'est le seul accident réel d'un module embarqué dans le paquet publié, et
  c'est celui que le commentaire de `packages/core/tsconfig.json:15-18` raconte déjà pour un
  `*.spec.ts`.

  *(b) La non-régression de couverture, qui manquait.* Le fichier compte dans le seuil de 90 %
  appliqué à `packages/core/src/**`, et **une fabrique exportée mais jamais appelée y baisse la
  couverture de fonctions de `core` sans qu'aucun test ne rougisse** : `noUnusedLocals` ne voit pas
  un export, et aucun autre fichier ne s'en plaint. La règle de conduite de [§5.5] — *ce fichier ne
  porte que des constantes et les fabriques qui les construisent* — était écrite sans être outillée,
  c'est-à-dire dans la forme exacte qu'`AGENTS.md` appelle « une règle non outillée ». Le rapport la
  rend vérifiable, `json-summary` étant déjà dans les reporters (`vitest.config.ts:35`) :

  ```bash
  node --input-type=commonjs -e "const s=require('./coverage/coverage-summary.json');const k=Object.keys(s).find((p)=>p.endsWith('fixtures.ts'));if(!k)throw new Error('fixtures.ts absent du rapport de couverture');console.log(s[k].functions.pct, s[k].lines.pct);"
  ```

  doit rendre **`100 100`**. La forme de la sonde est **vérifiée sur le rapport actuel du dépôt**,
  jouée contre `ast/visitor.ts` qui rend bien `100 100` : les clés de `coverage-summary.json` sont
  des chemins **absolus à séparateurs Windows**, d'où la comparaison sur le seul nom de fichier
  plutôt que sur un fragment de chemin, et `--input-type=commonjs` parce que le `package.json`
  racine déclare `"type": "module"`. Un `100` qui tombe à `80` désigne la fabrique morte, et il la
  désigne **dans le bon fichier** — ce qu'un seuil global à 90 % ne ferait jamais.
- `git grep -niE "colspan|rowspan|repeatheader|orphancontrol|carryforward|pagebreak|indexas|keeptogether" -- packages/core/src`
  ne rend **rien** — vérifié à zéro aujourd'hui, donc le critère est une non-régression et non un
  vœu ([§2, D13]).
- **Aucun champ d'agrégation sur une forme stockée du tableau :**

  ```bash
  git grep -nE "^[[:space:]]*(readonly[[:space:]]+)?(total|subtotal|sum|agg|aggregate|rollup|autoSum)[?]?:" -- packages/core/src/ast
  ```

  ne rend **rien** — **mesuré à zéro aujourd'hui**, donc c'est une non-régression et non un vœu.

  > ⚠️ **La forme antérieure de ce critère était trop étroite, à ne pas recopier.** Elle s'écrivait
  > `git grep -n "total?:\|footer: 'sum'\|aggregate?:" -- packages/core/src/ast`, c'est-à-dire trois
  > chaînes **littérales** — `?` n'est pas un quantificateur en regex basique. Elle ne voyait donc ni
  > `total:` **requis**, ni `readonly total?:` en tête de ligne indentée, ni un champ nommé `sum?:`,
  > `subtotal?:` ou `agg?:` : autrement dit, elle ratait tout ce qui n'aurait pas été orthographié
  > exactement comme l'exemple du plan. Or ce grep est, pour `TableColumn`, **le seul filet** — le
  > type n'oppose rien à un champ optionnel, et l'assertion `Object.keys` de [§6.2] ne mord que sur
  > un champ requis [§2, D13]. Un unique filet doit être large. La forme retenue cible une
  > **déclaration de champ** par son nom et non une chaîne, et la contre-épreuve montre qu'elle n'est
  > pas inerte : jouée sur `packages/core/src` entier, elle rend bien les déclarations réelles
  > (`evaluate.ts:200`, les fixtures d'`aggregate.test.ts`), donc son zéro sur `ast/` est un zéro
  > informatif.
- `git grep -n '\${' -- packages/core/src/ast/schemas.ts` ne rend **que** des chaînes de bornes
  constantes (`MIN_COLUMN_WIDTH`, `MAX_COLUMN_WIDTH`) : **aucun message n'interpole le contenu du
  modèle** ([§5.1]). Les guillemets simples comptent — sous double quote, le shell mangerait le
  `${`.
- **INC-0 est un déplacement et rien d'autre** : `git diff --stat` ne montre que des déplacements et
  la façade, et `packages/core/src/index.ts` est **inchangé octet pour octet** — c'est la preuve
  mécanique que la surface publique n'a pas bougé au refactor.
- **Retirer `TableNodeSchema` du corps de `blockMembers()` laisse les portes 1, 2 et 3 vertes et
  fait rougir la porte 4** — à vérifier une fois à la main, puis annuler ([§5.2]).
- **La branche `declared.size === 0` de `checkTableWiring` est couverte**, et le rapport de
  couverture le dit : un tableau sans colonne l'atteint à chaque exécution de l'`it` de [§5.1]. Si
  elle apparaît à zéro passage, c'est que le garde a été retiré — et le compte d'issues aura sauté
  de 1 à 13 sans qu'aucune autre porte ne bronche.
- `packages/core/package.json` **inchangé** ; `pnpm-workspace.yaml` **sans dérogation nouvelle** ;
  `biome.jsonc` et les `tsconfig*.json` **inchangés**.
- `git log --oneline -- AGENTS.md` montre **zéro** entrée nouvelle pour ce lot. C3 n'amende aucune
  règle de gouvernance : c'est la différence exacte avec C2, dont la définition de fini exigeait
  **une** entrée, et c'est ce que l'arbitrage n°7 [§8] doit confirmer avant INC-1.
- **L'ADR 0005 existe, est en 🟢, et couvre les treize décisions** avec, pour chacune, son motif,
  ses alternatives écartées, son verdict de réversibilité et son signal de réouverture quand il y en
  a un. `docs/roadmap/core.md` §C3 porte le renvoi vers ce plan puis la mention de livraison, et ce
  plan porte son propre `**Statut :**` périmé.

---

## 7. Ce que ce lot n'est pas

Le hors-périmètre **de conception** est écrit en **D13** ([§2]) et n'est pas répété ici. Les deux
listes ne disent pas la même chose, et les confondre est la première façon de mal lire ce plan :
D13 énumère ce que C3 **refuse**, chaque refus adossé à un texte déjà écrit, et ce que D13 refuse
ne sera livré par personne — ni par C4, ni par C5, ni par le moteur. Ce qui suit est l'inverse :
des choses qui **seront** livrées, mais ailleurs, et qu'un lecteur de « le tableau de lignes »
pourrait raisonnablement croire dans le lot. Aucune n'est un refus ; toutes sont une adresse.

**Ce n'est pas un lot de rendu.** `core` **décrit**, il ne **produit** rien : aucune page, aucun
pixel, aucun PDF (`docs/roadmap/core.md:270-274`). Un `TableNode` validé ne dessine pas un filet,
ne mesure pas un texte et ne sait pas où il coupe. Les trois lots qui le liront sont E1 (« une
facture d'une page sort en PDF »), E2 (« le tableau déborde proprement ») et E3 (« les exigences
comptables ») ; `packages/engine` contient aujourd'hui **six lignes et une constante de version**,
et le `DataBindingStep` reste à écrire. C'est pourquoi les docstrings du contrat définitif
n'écrivent nulle part ce que le moteur fera d'une section — ni « *repeated page after page* » sur
`header`, ni un point de coupe sur `body` ([§3.1]).

**Ce n'est pas la page.** Format, orientation, marges, en-tête et pied **de page** répétés,
numérotation : **C4**, qui ne dépend de rien et peut être fait avant ou après. Le piège précis, et
il faut le nommer parce que le mot « largeur » l'invite : **C3 ne déclare pas la largeur du
tableau lui-même**. `TableColumn.width` est un poids, et la part d'une colonne vaut
`width / Σ widths` de la largeur que le tableau se voit attribuer, **quelle qu'elle soit**
([§2, D6]). Décréter qu'un tableau occupe la largeur utile de la feuille serait une règle
d'apparence appuyée sur une géométrie que C4 n'a pas encore écrite.

**Ce n'est pas l'apparence.** Filets, fonds, zébrures, polices, graisses, couleurs, espacements,
alignement **de bloc** : **C5**, qui « dépend de : C3 » (`core.md:184`). Un tableau C3 rendu tel
quel est une grille sans une seule ligne tracée, et c'est normal. La seule propriété d'aspect que
C3 déclare est `TableColumn.align`, et elle y est par exception nommée : elle échoue au critère
d'appartenance de D1 comme les autres, et elle est retenue sur deux arguments mécaniques — le
libellé du lot (`core.md:153-154`, « un alignement par colonne ») et la chaîne de dépendances
([§2, D1] et [§2, D7]). Ce n'est pas une frontière lue dans un texte : c'est un arbitrage, le n°2
de la [§8].

**Ce n'est pas la langue ni la devise.** Séparateurs, symbole monétaire, position du symbole,
échelle d'affichage, libellés fixes traduits : **C6** (`core.md:186-196`). C3 ne livre aucun type
de colonne, précisément pour ne pas préempter par la porte de service la question que C2 a laissée
ouverte — *qui déclare l'échelle d'affichage d'un montant ?* Ce que C3 fait pour C6 est
structurel et se mesure en positions : parce qu'un libellé d'en-tête est un `TextNode` ordinaire
dans une cellule ([§2, D4]), C6 branchera le bilingue sur `TextNode.content` et **sur rien
d'autre** — zéro position de contenu nouvelle. C'est une facilité offerte, pas une livraison.

**Ce n'est pas l'insécable.** `keepTogether`, veuve et orpheline, point de coupe, saut de page :
**C7** (`core.md:202-211`), qui dépend de C4. Là encore C3 prépare sans livrer : `TableRowNode`
étant un **nœud** porteur d'un `id`, « en-tête et première ligne insécables » redevient
exprimable le jour où C7 écrit le champ. Aucun champ de ce genre n'existe dans le contrat
définitif, et D13 refuse nommément qu'on l'y ajoute « au cas où ».

**Ce ne sont pas les messages d'erreur travaillés.** Les onze refus au save time de la [§5.1]
portent des messages **constants**, en anglais, qui n'interpolent aucun contenu de modèle
([§2, D3]) ; le chemin Zod désigne la faute, et **l'affichage de l'identifiant fautif appartient à
l'éditeur**, qui tient l'arbre. Les reformuler pour un non-développeur est **C8**
(`core.md:213-224`), qui dépend de C1 à C7. Ce que C3 lui remet n'est pas un message de plus mais
un **état de moins** : la cellule orpheline est refusée avant d'exister, et
`EXPRESSION_ERROR_CODES` est inchangé ([§2, D10]).

**Ce n'est pas le catalogue de données.** C3 ne réserve aucun nom de champ et ne déduit ni les
colonnes des clés du jeu de données, ni un en-tête d'un nom de champ. Ce qu'il rend, c'est la
**liste des lectures** du modèle — mesurée à `['facture.numero', 'facture.lignes']` sur le modèle
de recette ([§5.3]). Savoir si ces deux chemins **existent** chez l'intégrateur est **C10**
(`core.md:240-251`), en vague 2, conditionné à J3.

**Ce n'est pas la grille de mise en page — et ici l'homonymie est un piège de lecture réel.** Le
mot « colonnes » désigne deux choses différentes dans ce dépôt, et **aucun document ne pose la
distinction** :

- les **colonnes d'un tableau**, c'est-à-dire celles de ce lot (`core.md:152`), en **vague 1** ;
- les **colonnes de mise en page**, celles de la décision produit 8 (`README.md:56`, « Colonnes +
  grille complète pas à pas + calques »), de l'ordre de sacrifice (`docs/roadmap/README.md:159`, « grille et
  colonnes suffisent à une facture »), du lot **C11** (`core.md:253-265`) et du lot **D5**
  (`designer.md:96-104`) — en **vague 2**.

Trois conséquences pratiques. Livrer C3 ne ferme **rien** de la décision produit 8 : un lecteur qui
coche la case le fait à tort. La phrase de l'ordre de sacrifice « grille et colonnes suffisent à
une facture » ne parle **pas** de C3. Et l'éditeur de tableau, D6, dépend de la **seconde**
acception, pas de la première (`designer.md:115` → `:104` → `core.md:253`) : la chaîne se lit
D6 → D5 → C11, et elle traverse la frontière de vague. L'ADR 0005 nomme l'homonymie sans la
corriger dans les documents où elle vit — ce n'est pas le mandat de ce lot ([§4], INC-5).

**Ce n'est pas l'éditeur de tableau.** « Un utilisateur ajoute une colonne au tableau des lignes
sans savoir ce qu'est une condition » est **D6**, poids XL, qui dépend de D5 (`designer.md:106-115`).
Ce que C3 fait pour lui est un **plafond**, au sens du garde-fou qui gouverne la brique éditeur —
« l'éditeur ne doit jamais permettre de construire un modèle que le moteur ne sait pas rendre »
(`designer.md:38-44`) : tout ce que D6 offrira devra déjà être décrit ici. Le contrat lui laisse
aussi une obligation, écrite en conséquence de D3 : « supprimer une colonne » devient une
**Command composée** — retirer la colonne *et* ses cellules — sinon le modèle devient irrecevable
au save time, et l'undo doit restaurer les deux. C'est du travail pour D3 et D6, pas pour C3.

**Et ce n'est pas une démonstration de rendu.** Le playground d'INC-4 dérive un `<table>` du
`TableNode` ([§6.3]) ; cela reste une lecture de l'arbre écrite en React, pas le moteur. Le tableau
comparatif des trois arrondis légué par C2 (`App.tsx:827-864`) **reste du JSX écrit à la main** et
ce plan le dit : ses colonnes viennent de trois `parseTemplate` distincts, or un `TableNode`
appartient à **un** document, et sa ligne de total porte un `colSpan={3}` que D13 refuse. Ce qui
disparaît, c'est la maquette de la section facture — le nœud texte concaténé et la liste `<ol>` —
et rien d'autre.

---

## 8. Les sept arbitrages, à trancher

**Contrairement aux plans C1 et C2, ces arbitrages ne sont PAS tranchés.** C1 a fait relever ses
cinq décisions par le propriétaire du produit le 2026-08-13, C2 les siennes le 2026-08-14 ; ce plan
est écrit le 2026-08-16 et **reste en attente**. La colonne de droite porte une **recommandation**,
pas un relevé, et elle sera relue le jour où l'un de ces points sera rouvert — c'est la raison pour
laquelle le motif y est écrit en entier plutôt que résumé.

**Les sept gatent INC-1, et trois sont marqués ⛔.** Le marquage ne dit pas « à rendre plus tôt » —
tous sont à rendre avant qu'une ligne de contrat ne soit écrite. Il dit **ce que coûte l'option
non recommandée** : ⛔ signale les trois dont l'autre branche réécrit du contrat déjà rédigé en [§3],
par opposition aux quatre dont l'autre branche change une valeur, une borne ou une étiquette.

- **Le n°1 ⛔ est bloquant et il change le lot.** Si « typé » se lit B, le contrat des treize
  décisions n'est pas à amender, il est **à rejouer**. C'est le seul qui puisse renvoyer le plan à
  sa table de travail.
- **Le n°3 ⛔ réécrit la moitié de la [§3].** L'option B — la cellule porte des `TextSegment[]` — ne
  change pas « un type » : elle change `TableCell` et sa docstring [§3.1], la branche `tableRow` de
  `childrenOf` [§3.4], **toutes** les mesures de profondeur du lot (18/231, 15/210, 48, 50, 56, et
  les neuf tableaux imbriqués avant `too-deep`), l'argument « **zéro position de contenu nouvelle
  pour C6** » qui porte la troisième raison de D4, la fixture de recette et le décompte de dix-sept
  nœuds de [§5.3]. **Le rang de cet arbitrage a été relevé après relecture** : une version antérieure
  de cette section le rangeait parmi les cinq « non bloquants », alors que son option B touche plus
  de contrat que celle du n°7. Un arbitrage dont on sous-estime le coût est un arbitrage qu'on rend
  vite.
- **Le n°7 ⛔ change le contrat ou le découpage**, pour deux raisons distinctes : l'option B **change
  le contrat** (un import de plus, et un couplage inversé entre `ast/schemas.ts` et
  `ast/visitor.ts`), et l'option C **ajoute un commit `chore(governance)` et un mandat daté** au
  découpage de la [§4]. Il déplace du travail ; il ne le refait pas.
- **Les quatre autres — n°2, n°4, n°5, n°6 — peuvent être rendus pendant INC-0**, qui est un
  refactor pur : il déplace des types et des schémas derrière une façade, ne change aucune surface
  publique, et **aucune des quatre options en jeu n'y touche une ligne**. Le lot peut donc démarrer
  sans eux ; il ne peut pas atteindre INC-1 sans eux, ni sans les trois autres.

| # | Question | Options | Recommandation |
| :-- | :--- | :--- | :--- |
| **1** ⛔ | Que veut dire « typé » dans le critère de recette — « un tableau à cinq colonnes typé (désignation, quantité, prix unitaire, remise, montant) » (`core.md:157-159`, [§6.1]) ? | **A —** « décrit dans un contrat typé » : les cinq colonnes sont un **jeu d'épreuve**, aucune ne porte de type de donnée. C'est la lecture de ce plan. | **A**, et l'écart entre les deux lectures n'est pas cosmétique : **il change le lot**. Un type de colonne appelle une échelle et un symbole ; une échelle non déclarée est un arrondi implicite ; une table devise → décimales est refusée jusque dans un exemple de docstring ; et le formatage appartient à C6, dont C2 a **explicitement laissé ouverte** la question « qui déclare l'échelle d'affichage d'un montant ». Trancher B ici préempterait cette décision par la porte de service, et ferait dépendre la mise en page du jeu de données de l'intégrateur — contre la règle de périmètre. **Si le propriétaire du produit lit B, ce contrat est à rejouer, pas à amender.** |
| | | **B —** « chaque colonne porte un type » (monétaire, nombre, texte, date), dont le moteur déduit format et alignement. | |
| **2** | La frontière C3 / C5 sur l'alignement n'est arbitrée par **aucun texte** du dépôt : `core.md:153-154` donne « un alignement par colonne » à C3, `core.md:179` donne « alignements » à C5, et C5 dépend de C3. | **A —** C3 possède l'alignement **de colonne** ; C5 possède l'alignement de bloc et, s'il le décide, une surcharge par cellule qu'il ajoute lui-même. | **A**. B contredit le libellé du lot **et** la chaîne de dépendances : une propriété dont le critère de recette de C3 a besoin ne peut pas vivre dans le lot qui vient après, et sans elle « libellés à gauche, montants à droite » est indémontrable. C écrit un champ optionnel **à la place de C5** ; le retirer plus tard exigerait une migration transformante, l'ajouter plus tard n'est qu'un élargissement. A garde la porte ouverte dans le seul sens qui ne coûte rien. **À consigner comme une DÉCISION dans l'ADR 0005, pas comme une lecture.** |
| | | **B —** Tout l'alignement va à C5 ; C3 ne livre que colonnes, largeur et en-tête. | |
| | | **C —** C3 déclare l'alignement de colonne **et** la surcharge par cellule, dès maintenant. | |
| **3** ⛔ | Une cellule contient-elle des **blocs** ou des **segments de texte** ? | **A —** `readonly BlockNode[]` : image, deux paragraphes, condition, tableau imbriqué possibles ; l'imbrication est bornée par le garde de forme (mesuré : 9 tableaux imbriqués passent, le 10ᵉ est refusé `too-deep`). Coût mesuré : **+2 niveaux JSON**. | **A**, sur la **réversibilité** et non sur l'expressivité. B est le seul point de ce contrat où un revirement coûterait une migration **transformante** — envelopper les segments de chaque cellule dans un nœud texte doté d'un id inventé — et la première demande sera un logo, un picto ou un QR code dans une cellule. A rend en prime le libellé d'en-tête un `TextNode` ordinaire, donc **zéro position de contenu nouvelle** pour C6. Si le propriétaire du produit juge que la pagination d'un tableau imbriqué est un risque inacceptable pour E2, **B est défendable** — mais il faut alors accepter que la cellule ne contiendra jamais qu'un run de texte, et l'écrire dans l'ADR. **⛔ à rendre avant INC-1 :** B ne change pas un type, il réécrit `TableCell` [§3.1], la branche `tableRow` de `childrenOf` [§3.4], **toutes** les mesures de profondeur du lot, l'argument « zéro position de contenu nouvelle pour C6 » de D4, la fixture et le décompte de dix-sept nœuds de [§5.3]. |
| | | **B —** `readonly TextSegment[]` : l'imbrication devient impossible par construction, la profondeur du sous-arbre est fixée, et E2 n'héritera jamais d'un tableau dans un tableau. | |
| **4** | Le `superRefine` sur `TableNodeSchema` — **le premier du dépôt** — est-il accepté ? | **A —** Le garder : la cellule orpheline, le doublon de cellule et l'id de colonne dupliqué sont refusés au save time, avec un chemin qui désigne la faute, et **zéro code d'erreur nouveau**. | **A**. L'appariement par clé ne laisse qu'**un seul** état représentable — la cellule orpheline — et c'est une **perte silencieuse** : du contenu que l'auteur voit dans son JSON et que rien n'affichera. La doctrine de versionnement du dépôt existe précisément contre cette classe de défaut. Ce n'est pas la passe sémantique qu'ADR 0002 D2 a refusée : le contrôle est **local** — un nœud, un niveau, aucune descente dans les cellules — là où le masquage d'alias exigeait toute l'ascendance. Deux réserves à écrire : « zéro code nouveau » repose sur le fait qu'un `z.object().superRefine()` reste un `ZodObject` en zod 4 (mesuré, à rejouer à chaque montée, [§9]) ; et B laisserait **C8** découvrir la faute des mois plus tard, C8 dépendant de C1 à C7. |
| | | **B —** Le retirer : `core` accepte, et la passe de validation de C8 nomme le défaut plus tard. | |
| **5** | `start / center / end` ou `left / center / right` pour l'alignement de colonne ? | **A —** `start / center / end` : `core` ne résout rien, il **diffère** la résolution, et là où la direction est gauche-droite `start` **est** `left`. | **A**, mais **pas sur l'argument initialement écrit** — voir l'encadré ci-dessous. L'argument qui tient : C3 diffère une résolution qu'il n'a **aucune information** pour trancher, et le revirement serait à la fois **transformant** (réécrire une valeur stockée dans tous les modèles) et **sémantiquement indécidable** (on ne saurait pas si l'auteur voulait « gauche » ou « début »). Différer coûte zéro aujourd'hui ; trancher coûte une migration qu'on ne saurait pas écrire. La lisibilité invoquée par B est un problème d'**étiquette dans l'éditeur**, pas de contrat. |
| | | **B —** `left / center / right` : plus lisible pour un utilisateur non développeur dans l'éditeur de D6, et sans ambiguïté pour un intégrateur. | |
| **6** | La borne `MAX_COLUMN_WIDTH = 1000` — un rapport de 1 à 1 000 suffit-il, et faut-il une borne du tout ? | **A —** Garder `[1, 1000]` : la borne haute **porte la preuve** d'exactitude. | **A**. La borne n'est pas un jugement de mise en page, elle est **load-bearing** : sans elle, la preuve qui adosse la décision produit 7 (« identique au PDF, garanti ») à une propriété démontrable disparaît, et la part d'une colonne redevient un accord entre deux implémentations. C reste arithmétiquement correct, mais **aucun besoin ne le motive** et un rapport de 1 à 1 000 couvre toute géométrie de facture. Signal de réouverture nommé : une demande citant un rapport plus fin que 1:1 000, ou un gabarit préimprimé imposant une largeur physique — auquel cas c'est **l'unité** qu'il faut rouvrir, pas la borne. |
| | | **B —** Entier sans borne haute : la preuve tombe, la garantie aperçu/PDF redevient une approximation. | |
| | | **C —** Une borne plus large, par exemple 10 000 : la preuve tient encore, et le rapport exprimable est de 1 à 10 000. | |
| **7** ⛔ | Le lot a-t-il besoin d'un **mandat de gouvernance** ? Autrement dit, le test de discriminant `if (entry.type === 'tableRow')` dans `checkTableWiring` ([§3.2]) est-il un second `switch (node.type)` au sens d'`AGENTS.md` §3.B ? | **A —** Non : ce n'est pas un parcours du Composite. Il ne descend dans aucun enfant, il lit l'union à **deux** membres du corps d'**un** nœud, dans le schéma de ce nœud, et Zod a déjà discriminé. **Aucun amendement d'`AGENTS.md`.** | **A**, et c'est le **seul** point de gouvernance que le lot soulève. La garantie qu'un Visitor achèterait est déjà achetée par le rétrécissement lui-même : `entry.rows` ne type-check que tant que `TableBodyNode` a exactement ces deux membres. C3 n'ouvre par ailleurs **aucun troisième parcours d'expression** — `git grep -n "case 'round':" -- packages/core/src \| wc -l` doit toujours rendre **2** — donc le seuil de retrait de l'amendement obtenu par C2 n'est pas franchi. **Mais un plan ne s'auto-délivre pas de dérogation** : si le propriétaire du produit lit B ou C, il faut le savoir **avant INC-1**. |
| | | **B —** Oui : router le contrôle par `visitNode`, ce qui oblige `ast/schemas.ts` à dépendre de `ast/visitor.ts` et à écrire **huit** branches pour en dispatcher **deux**. | |
| | | **C —** Oui, et cela exige un amendement d'`AGENTS.md` §3.B sous mandat explicite, dans un commit `chore(governance)` **séparé**, posé avant l'ADR. | |

### Le développement, arbitrage par arbitrage

**n°1 — « typé ». Pourquoi B rejoue le lot au lieu de l'amender.** Sous la lecture B, un
`TableColumn` porterait un champ `type` (ou `kind`), et le moteur en déduirait un format et un
alignement. Trois conséquences en cascade, chacune fatale à une décision déjà écrite. (1) `align`
cesserait d'être déclaré pour devenir **déduit**, ce que D13 refuse nommément — « l'alignement
déduit du type de la valeur » — parce que c'est une **règle** et qu'elle ferait dépendre la mise en
page du jeu de données de l'intégrateur. (2) Un type « monétaire » appelle une **échelle**, donc un
arrondi que le modèle n'a pas déclaré : c'est exactement l'arrondi implicite que la décision 8 de
l'ADR 0004 refuse, et il reviendrait par un champ de géométrie. (3) La question ouverte léguée par
C2 — *qui déclare l'échelle d'affichage d'un montant : le modèle, l'intégrateur, ou une table de
devises ?* — serait tranchée par C3, qui n'a pas mandat pour cela et qui n'a instruit ni C6 ni le
catalogue C10. Le critère d'appartenance de D1 rend d'ailleurs le verdict tout seul : un type de
colonne échoue à la condition (3) — il peut changer ce qu'un `sum` produit à l'affichage — et
frôle la condition (4). C'est pourquoi la recommandation dit « rejouer » : il ne s'agit pas
d'ajouter un champ optionnel à un contrat par ailleurs valide, il s'agit de reprendre D1, D6, D7,
D10 et D13 avec un axiome différent. **Le geste préventif est déjà pris** : le playground et la
fixture `RECIPE_TABLE` portent, en tête, l'avertissement que les cinq colonnes sont un jeu
d'épreuve, et la [§6.4] en fait un critère mécanique, dans la forme exacte — avec `-w` — que cette
section-là établit et mesure.

**n°2 — la frontière C3 / C5, et pourquoi elle ne se lit nulle part.** Le recouvrement est
littéral : le même mot, « alignements », est attribué à deux lots par deux phrases du même fichier.
Aucune ADR ne l'arbitre. Ce plan tranche donc par un **critère écrit avant la liste des champs**
([§2, D1]) plutôt que par une préférence — et il faut être honnête sur ce que le critère fait
ici : **`align` échoue au critère**, exactement comme une police échouerait, parce qu'il
s'écrirait aussi bien sur n'importe quel bloc. Il est retenu en **exception nommée**, sur deux
arguments mécaniques et non sur le critère. C'est pour cela que c'est un arbitrage, et pas une
conséquence. L'option C mérite un mot de plus, parce qu'elle a l'air prudente : ajouter dès
maintenant une surcharge `align?` par cellule « pour éviter un aller-retour ». Elle ne l'est pas.
Un champ optionnel **stocké** ne se retire qu'avec une migration transformante ; et si C5 décide
plus tard d'une surcharge, il devra l'écrire **en surcharge** sans toucher au champ de colonne,
sous peine de la même migration. La porte à laisser ouverte est celle de l'ajout, jamais celle du
retrait.

**n°3 — blocs ou segments, et le seul revirement transformant du contrat.** Les deux options sont
défendables au jour d'aujourd'hui ; elles ne le sont pas de la même façon dans le temps. Avec des
segments, l'imbrication devient impossible **par construction** — c'est un vrai bénéfice pour E2,
qui hérite sinon de la pagination d'un tableau dans un tableau, et ce coût est nommé en
conséquence de D5 et nulle part ailleurs. Mais élargir plus tard des segments vers des blocs oblige
à **envelopper les segments de chaque cellule dans un nœud texte doté d'un id inventé**, sur tous
les modèles écrits entre-temps : c'est la définition d'une migration transformante, et
l'inventaire d'ids est la partie qu'aucune migration n'écrit proprement. À l'inverse, refuser
l'imbrication plus tard serait un **rétrécissement** — que personne n'a montré nécessaire, et que
le garde de forme rend de toute façon superflu : mesuré par bissection, **9** tableaux imbriqués
passent et le **10ᵉ** est refusé avec un code typé qui existe déjà, `too-deep`. Le coût de A est
mesuré et il est petit : **+2 niveaux JSON**, une cellule laissant **48** `round` imbriqués
lorsqu'elle est dans un `tableRowGroup` et **50** dans une ligne de corps fixe, contre **56** sous
un texte nu. Si le propriétaire du produit choisit B, il ne suffit pas de changer un type : il faut
écrire dans l'ADR que la cellule ne contiendra **jamais** qu'un run de texte, sans quoi le refus
redeviendra une docstring que la première demande fera sauter.

**n°4 — le premier `superRefine` du dépôt.** L'objection sérieuse à A n'est pas technique, elle est
doctrinale : l'ADR 0002 D2 a refusé une passe de validation sémantique au save time, et un
relecteur pressé rangera ce contrôle dans la même case. Il faut donc dire précisément en quoi il
n'y est pas. Le masquage d'alias exigeait de connaître **toute l'ascendance** d'un nœud, donc un
parcours, donc une passe. `checkTableWiring` lit **un** nœud : la liste de ses colonnes et, un
niveau plus bas, le `columnId` de chaque cellule de ses propres lignes. Il **ne descend pas** dans
les cellules — un tableau imbriqué valide ses propres lignes contre ses propres colonnes — et le
coût est borné à un niveau. Deux réserves accompagnent la recommandation, toutes deux inscrites en
[§9]. La première est que la propriété « zéro code d'erreur nouveau » repose sur un comportement de
zod 4 : un `z.object().superRefine()` reste un `ZodObject`, donc `TableNodeSchema` reste membre
légal des deux unions discriminées, `lazy` comprises. La seconde est que **le `superRefine` tourne
malgré une issue continuable** — `too_small`, `too_big`, `custom` — et n'est sauté que sur une issue
abandonnante : c'est ce qui rend le garde `declared.size === 0` nécessaire pour donner « un message
à la fois » [§3.2 ; §5.1]. Ces deux mesures sont à rejouer à chaque montée de zod, comme l'ADR 0004
le fait déjà pour la règle nursery de Biome.

**n°5 — `start` / `end`, et une prémisse fausse à ne pas recopier.**

> ⚠️ **Correction d'un raisonnement faux, à ne pas recopier.** La recommandation initiale de cet
> arbitrage justifiait `start`/`end` en écrivant que « *the reason is lot C6 rather than taste* »
> et que « *resolution belongs to whoever knows the direction* ». Les deux énoncés supposent que
> **quelqu'un**, et nommément C6, possède la direction d'écriture d'un document. **Mesuré**
> (2026-08-16) : la sonde RTL canonique de [§2, D7] — `git grep -niE` sur les six termes, scopée par
> `':!docs/plans/*'` — rend **aucune occurrence**, et
> le périmètre de C6 (`core.md:186-196`) énumère montants, dates, séparateurs de milliers, position
> du symbole monétaire et libellés fixes — **pas** la direction. Le dépôt ne l'attribue à personne.

La recommandation **A tient**, mais sur un autre argument, et il est plus faible — il faut le dire
plutôt que de le maquiller. `core` ne diffère pas la résolution *à C6* ; il la diffère **à un lot
qui n'existe pas et qui n'est pas nommé**. Ce qui reste opposable est ceci : entre deux options
dont l'une n'engage rien et l'autre engage une valeur stockée, C3 n'a **aucune information** pour
préférer la seconde, et le revirement de B vers A serait **transformant** — il faut réécrire chaque
`left` dans chaque modèle — **et sémantiquement indécidable**, puisqu'on ne saurait pas si l'auteur
d'un modèle voulait dire « gauche » ou « début ». Un revirement dont on ne peut pas écrire la
fonction de migration n'est pas un revirement, c'est une perte. Trois gestes accompagnent donc
cette recommandation, et ils sont dus quelle que soit la décision : l'ADR 0005 ouvre, dans « Ce qui
reste ouvert », la question **« qui déclare la direction d'écriture d'un document ? »** avec ses
options — une déclaration de modèle rattachée à C6, une entrée du `RenderRequest`, ou rien et un
défaut de moteur — et **sans recommandation**, sur le patron de la question d'échelle d'affichage
léguée par C2 ; elle y écrit l'interdit qui tient déjà, à savoir qu'**aucun moteur ne dérive cette
direction de la machine** (E6, outillé par Biome) ; et si le propriétaire du produit exclut le RTL
du v1 **et** du v2, l'option B devient défendable et l'arbitrage se referme.

**n°6 — la borne de largeur, et ce qu'elle porte exactement.** Il faut d'abord retirer de la
discussion une preuve qui a circulé et qui est fausse : ce n'est **pas** `maxNodes = 100 000` qui
borne le nombre de colonnes. `maxNodes` est un **défaut**, `parseTemplate(raw, migrations?, limits?)` accepte un
override validé par `limitSchema`, et `TableNodeSchema.parse` ne passe **aucun** garde de forme
([§9], hypothèse 3). La preuve qui tient est celle-ci, en trois lignes : `limitSchema` plafonne
`maxNodes` à `LIMIT_HARD_CEILING = 1e9` ; une colonne `{ id, width, align }` pèse **quatre**
valeurs, donc au plus 2,5·10⁸ colonnes, donc Σ ≤ 2,5·10⁸ × 10³ = 2,5·10¹¹ < 2⁵³ ; et même hors du
garde, la longueur maximale d'un tableau JavaScript (2³²−1) borne Σ à 4,3·10¹² < 2⁵³. La somme est
exacte en binary64 **dans tous les cas représentables**, et la part d'une colonne est donc une
division correctement arrondie unique — le même nombre dans l'aperçu et dans le PDF, sur tout
moteur conforme. C'est cela que l'option B détruit : sans borne haute, la somme n'est plus garantie
exacte, et la décision produit 7 retombe sur un accord d'implémentation. L'option C ne casse rien —
1e9 tient encore — mais elle élargit une fenêtre que personne n'a demandé d'élargir, et une borne
qu'on relâche sans besoin est une borne qu'on relâchera encore.

**n°7 — la gouvernance, et pourquoi un plan ne se délivre pas sa propre dérogation.** L'énoncé
d'`AGENTS.md` §3.B est net : le Visitor est **obligatoire dès qu'un deuxième parcours apparaît**,
et sa portée a été restreinte par C2 à l'AST de document. Le test de discriminant de
`checkTableWiring` est-il ce deuxième parcours ? L'argument de A est qu'il ne parcourt rien : il ne
descend dans aucun enfant, il lit une union à deux membres (`TableRowNode | TableRowGroupNode`)
dans le schéma du nœud qui la porte, après que Zod a déjà discriminé. Ce que le Visitor protège —
l'oubli d'un membre le jour où l'union s'élargit — est ici acheté par le **rétrécissement
lui-même** : `entry.rows` ne type-check que tant que `TableBodyNode` a exactement ces deux membres,
et la porte 3 le dit. L'argument contraire est de forme : la règle ne parle pas de « parcours du
Composite », elle parle d'un `switch (node.type)` qui se duplique, et un test de discriminant en
est la forme dégénérée. Ce plan **recommande A** et refuse de trancher seul, parce que les deux
options coûteuses coûtent en des endroits différents. B inverse une dépendance : `ast/schemas.ts`
importerait `ast/visitor.ts` pour écrire huit branches dont six inatteignables, ce qui est
exactement la cérémonie que la règle anti-sur-ingénierie nomme — mais c'est un **changement de
contrat**, pas un ajustement, et il doit être connu avant qu'INC-1 n'écrive les schémas. C ne
change pas le contrat mais change le **découpage** : un commit `chore(governance)` séparé, posé
avant l'ADR, et un mandat daté — le précédent existe, C1 l'a fait pour `biome.jsonc` et le plugin
GritQL, C2 pour `AGENTS.md` §3.B. Sous A, le critère de fin d'INC-5 est mécanique et il est déjà
écrit : `git log --oneline -- AGENTS.md` montre **zéro** entrée nouvelle pour ce lot.

### Les conséquences qu'il faut avoir en tête

**Les sept barrent la route à INC-1 ; trois seulement réécrivent du contrat, et un seul barre la
route au lot.** Le classement compte plus que le décompte, parce que c'est lui qui dit **combien de
[§3] il faut rouvrir** selon la réponse :

| Arbitrage | Si l'option non recommandée est retenue |
| :--- | :--- |
| **n°1** ⛔ | Le lot est **rejoué** : D1, D6, D7, D10 et D13 se reprennent avec un axiome différent |
| **n°3** ⛔ | La **moitié de la [§3]** se réécrit : `TableCell`, `childrenOf`, toutes les mesures de profondeur, la troisième raison de D4, la fixture, le décompte de nœuds |
| **n°7** ⛔ | Le **découpage** change (option C, un `chore(governance)` de plus) ou un couplage s'inverse entre `ast/schemas.ts` et `ast/visitor.ts` (option B) |
| **n°2, n°4, n°5, n°6** | Un champ, une borne, une étiquette ou un contrôle en moins — nommé, localisé, sans effet sur le reste du contrat |

Seul le n°1 peut renvoyer le plan à sa table de travail. Le n°3 y renvoie la moitié de la §3, ce qui
est cher mais borné. Le n°7 déplace du travail, il ne le refait pas. Confondre ces trois degrés
conduirait soit à retarder INC-0, qui n'attend personne, soit — le vrai risque — à **rendre le n°3
vite** parce qu'il n'aurait pas l'air d'en valoir la peine.

**Cinq recommandations sur sept sont des recommandations de non-décision, et c'est un motif, pas
une esquive.** Le n°2 laisse à C5 la surcharge de cellule, le n°3 laisse la cellule ouverte aux
blocs, le n°5 laisse la direction d'écriture non résolue, le n°6 refuse d'élargir une fenêtre sans
besoin, le n°7 refuse d'amender une règle de gouvernance. Le fil commun est mécanique et
opposable : dans chacun de ces cinq cas, **l'option qui décide écrit une valeur stockée**, et
revenir sur une valeur stockée coûte une migration transformante, quand elle est seulement
possible. Le n°5 est celui où elle ne l'est pas — on ne saurait pas quoi écrire.

**Le n°5 est le seul dont la recommandation a survécu à la réfutation de son motif, et il faut
savoir lire cette situation.** Le plan C2 avait déjà nommé la règle et elle vaut ici : si une
contre-mesure réfute un **chiffre**, c'est le motif qui se réécrit ; si elle réfute une
**prémisse**, c'est l'option qui se rejoue. Le cas du n°5 est intermédiaire, et c'est pour cela
qu'il est écrit en entier : la prémisse « C6 possède la direction d'écriture » est fausse, mais
l'option A ne reposait pas **seulement** sur elle — l'indécidabilité du revirement, elle, est
intacte. **Ce qui a disparu, c'est le destinataire de la résolution différée**, et c'est ce qui
justifie d'ouvrir la question dans l'ADR au lieu de la laisser implicite. Un plan qui aurait gardé
la recommandation en silence aurait laissé le lecteur croire que quelqu'un, quelque part, avait la
charge de résoudre `start`.

**Un arbitrage rendu ne clôt pas un signal de réouverture.** Trois des sept en portent un, et ils
doivent être recopiés dans l'ADR 0005 : le n°1 se rouvre si la décision ouverte de C2 sur l'échelle
d'affichage est tranchée en faveur d'une table de devises ; le n°5 se rouvre si le RTL est déclaré
hors périmètre à jamais ; le n°6 se rouvre sur une demande citant un rapport plus fin que 1:1 000
ou une largeur physique imposée. Les reconnaître le moment venu fait partie de la décision.

---

## 9. Ce que ce plan tient pour acquis

**Huit hypothèses. Si l'une est fausse, le plan change — une pièce nommée, pas le lot.** Elles sont
listées parce que trois d'entre elles étaient **tacites** dans les premiers jets, et qu'une
hypothèse tacite est ce qui laisse passer une preuve qui ne tient pas : l'hypothèse 2 a failli faire
supprimer un garde qui est en réalité atteint à chaque tableau sans colonne, et l'hypothèse 3 avait
produit une preuve d'exactitude adossée à un défaut de configuration.

1. **Un `.superRefine()` laisse un `ZodObject` en zod 4, donc un schéma raffiné reste membre légal
   d'une union discriminée, `lazy` comprise.**
   *Vérifié à l'exécution* dans le bac à sable, contre le `zod@3.25.76` résolu du dépôt
   (`packages/core/package.json` déclare `"zod": "^3.25.76"`), importé via `zod/v4` : les
   refinements vivent **dans** le schéma, `TableNodeSchema` est accepté comme membre de
   `BlockNodeSchema` **et** de `DocumentNodeSchema`, et les deux unions parsent un tableau imbriqué.
   *Ce qui repose dessus :* la totalité de D3, et avec elle la propriété **« zéro code d'erreur
   nouveau »** de D10 — les trois fautes de câblage ne sont refusées au save time que parce que le
   raffinement voyage avec le schéma.
   *Si elle tombe* — une montée de zod qui renverrait un `ZodEffects` ou l'équivalent — les deux
   unions cessent de compiler en tant qu'unions discriminées. La parade n'est pas d'assouplir
   l'union : c'est de sortir le contrôle de `TableNodeSchema` et de le rendre à une porte de
   parsing, au prix d'un contrôle qui ne s'applique plus quand l'intégrateur valide un nœud isolé.
   **À rejouer à chaque montée de zod**, comme l'ADR 0004 le fait pour la règle nursery de Biome.

2. **Un `superRefine` n'est sauté que sur une issue ABANDONNANTE.**
   *Mesuré* (Node v24.11.1, `zod@3.25.76` via `zod/v4`) : `invalid_type` et `invalid_value` le
   sautent ; `too_small`, `too_big` et `custom` le laissent tourner. `columns.min(1)` rend un
   `too_small`, **donc il n'arrête pas `checkTableWiring`**, qui est appelé avec `table.columns`
   vide. Contrôle croisé, qui tient : une largeur `1.5` — un `invalid_type` — masque bien les fautes
   de câblage jusqu'à sa correction. La formule juste est *un refus de type masque le câblage, un
   refus de borne ne le masque pas* [§5.1].
   *Ce qui repose dessus :* la promesse faite à C8 — **un message à la fois**, jamais une cascade de
   treize — et le garde `declared.size === 0` qui la tient. Mesuré sur le même `dist`, les quatre
   lignes retirées et rien d'autre changé : **1 issue avec, 13 sans**, sur un tableau de douze
   cellules.
   *Si elle tombe* — une montée de zod qui rendrait `too_small` abandonnant : le garde devient
   inatteignable et son `it` de [§5.1] **rougit**, ce qui est exactement le signal souhaité. C'est
   la seule des huit hypothèses dont la chute est rattrapée par une porte, et elle l'est parce que la
   revue de contradiction s'était trompée dans l'autre sens sur ce point précis : elle avait conclu
   au code mort sur une mesure prise contre un build qui contenait encore le garde. **Un test qui
   épingle un comportement de bibliothèque vaut mieux qu'une note de revue**, et c'est ce que ce
   renversement a coûté pour être appris.

3. **L'exactitude de D6 ne dépend PAS du défaut `maxNodes`.**
   *Mesuré :* `maxNodes = 100 000` est un **défaut** et non une borne de contrat —
   `parseTemplate(raw, migrations?, limits?)` accepte un override validé par `limitSchema`, plafonné à
   `LIMIT_HARD_CEILING = 1_000_000_000` (`limits.ts:109-111`) ; le garde compte des **valeurs**, pas
   des colonnes, et une colonne en coûte quatre — par bissection, **24 998** colonnes sont acceptées
   sous le défaut, la **24 999ᵉ** est refusée ; et `TableNodeSchema`, que le barrel exporte pour
   l'intégrateur qui valide avant de stocker, **n'applique aucun garde** — il accepte **250 000**
   colonnes.
   *Ce qui repose dessus :* la formulation de la preuve d'exactitude de la [§2, D6], qui s'appuie sur
   `LIMIT_HARD_CEILING` et sur la longueur maximale d'un tableau JavaScript, **jamais** sur
   `DEFAULT_SHAPE_LIMITS`.
   *Pourquoi c'est écrit :* pour qu'un relèvement de `DEFAULT_SHAPE_LIMITS` par E8 — qui est un
   ajustement de configuration parfaitement légitime — n'ait pas **l'air** d'invalider une décision
   de contrat. Sous l'ancienne formulation, il l'aurait eu.

4. **Les mesures du bac à sable transposent au dépôt.**
   *Ce que le bac à sable était :* une **copie intégrale de `packages/core`**, avec des jonctions
   vers le `zod@3.25.76` et le `vitest@4.1.10` **du dépôt**, `tsc` **7.0.2** invoqué avec les
   `tsconfig.json` et `tsconfig.typecheck.json` **du dépôt**, `biome check` avec le `biome.jsonc`
   **du dépôt**, sur **Node v24.11.1**. Baseline vérifiée à **exit 0** avant toute édition, et
   `git status` du dépôt **identique avant et après** — aucune écriture dans le dépôt.
   *Ce qu'il ne partageait pas, et c'est là que porte l'hypothèse :* l'orchestration monorepo
   (`turbo`), la résolution d'espace de travail pnpm, et **les quatre autres paquets**. Ni
   `packages/designer`, ni `packages/viewer`, ni `apps/playground` n'ont été compilés. Aucun chiffre
   de **couverture** n'a été produit : le seuil de 90 % sur tout `packages/core/src/**` est une
   contrainte connue, pas une mesure de ce plan.
   *Ce qui repose dessus :* les portes 1 à 3 annoncées vertes, les onze refus et leurs chemins, les
   mesures de profondeur, la mesure de covariance (**1** erreur en élargissant `DocumentNode` seul,
   **4** après les trois membres et les trois `case`), et les **cinq** sites qui cassent si `align`
   est retiré — quatre à la porte 2, l'assertion `TABLE_COLUMN_SCHEMA_IN_STEP` à la porte 3.
   *Si elle tombe :* les deux coutures **hors** de `packages/core` sont les premières exposées — la
   dérivation `BlockType = BlockNode['type']` de `packages/designer/src/types.ts` ([§3.9]) et la
   consommation du barrel par le playground ([§6.3]) — et ce sont précisément celles qu'aucune porte
   ne voit ([§3.8]). Elles se rejouent au moment d'INC-4, à la main, et le plan le dit là-bas.

5. **`packages/engine` est vide, donc les chiffres de budget mesurent une boucle écrite à la main.**
   *Vérifié :* `packages/engine/src/index.ts` fait **six lignes** et ne contient qu'une constante de
   version. Le budget d'évaluation est un budget **par document** créé par le pipeline, mais le
   pipeline n'existe pas : le `DataBindingStep` reste à écrire, et le **seul** consommateur réel
   aujourd'hui est le playground.
   *Ce qui repose dessus :* le modèle de coût de la [§2, D12] — `pas = 12·N + 4`, `éléments = 2·N`,
   une facture de soixante lignes consommant **724** pas soit **0,072 %** de `maxSteps` (défaut
   `1 000 000`) — et donc l'argument « un plafond nouveau serait un plafond qui ne protège de rien ».
   *Si elle tombe*, c'est-à-dire le jour où le `DataBindingStep` s'écrit et consomme autrement : le
   modèle de coût se re-mesure, et c'est E8 qui remet le chiffre. Le contre-exemple à surveiller est
   déjà nommé — une colonne « cumul » posant un `sum(...)` **dans** le corps répété passe de
   linéaire à quadratique et dépasse les deux plafonds vers mille lignes, mesuré à **4 003 001** pas.
   Aucun champ ne peut l'empêcher : c'est une expression licite, et le tableau est précisément ce
   qui invite à l'écrire.

6. **Le projet est toujours en pré-v1.0, et aucun template client n'existe en stockage.**
   *Re-vérifié le 2026-08-16 :* `git tag` ne rend rien ; `.github/workflows/` contient `ci.yml`,
   `codeql.yml`, `security.yml`, `sonar.yml` et **aucun** `npm publish` ; aucun `.changeset/` ; les
   cinq `package.json` sont en `0.1.0`.
   *Ce qui repose dessus, et il faut dire que c'est peu :* rien de neuf. C3 **n'ajoute aucun
   cinquième rétrécissement de valeur** à la liste des quatre déjà consentis. Ses trois bornes de
   bonne formation — au moins une colonne, au moins une ligne par groupe, une largeur entière dans
   `[1, 1000]` — portent toutes sur des **champs neufs**, qu'aucun document v3 ne peut remplir ; et
   la coupure `BlockNode` rétrécit trois positions stockées qu'aucun document v3 ne peut remplir
   avec une ligne, faute que le type existe.
   *Où elle ne sert PAS, et c'est le point :* elle ne porte **pas** le versionnement.
   `AGENTS.md` §1.2 est explicite — « il n'y a pas de dérogation pré-v1.0 au versionnement » — et
   D11 livre son estampille et sa migration `{ from: 3, to: 4 }` quoi qu'il arrive. Un lecteur qui
   verrait dans cette hypothèse une raison de différer le bump lirait exactement l'inverse de ce que
   le dépôt écrit.
   *Si elle tombe :* ce sont les **quatre** bornes existantes qui se rediscutent une par une, et
   aucune des trois de C3, puisqu'elles ne rétrécissent rien d'antérieur.

7. **Le critère de recette se lit comme l'arbitrage n°1 le recommande.**
   Tout ce que ce plan écrit suppose que « un tableau à cinq colonnes **typé** » veut dire « décrit
   dans un contrat typé », et que `designation`, `quantite`, `prixUnitaire`, `remise`, `montant`
   sont un **jeu d'épreuve**, jamais des noms inscrits dans le contrat.
   *Ce qui repose dessus :* le contrat définitif dans son entier, la [§6] tout entière, et cinq des
   treize décisions — D1, D6, D7, D10 et D13.
   *Si elle tombe :* le lot est **rejoué**, pas amendé ([§8], n°1). C'est la seule hypothèse de
   cette liste dont la chute ne se répare pas par une pièce nommée, et c'est pourquoi l'arbitrage
   est bloquant.

8. **C3 n'ouvre aucun troisième parcours d'expression.**
   *Re-mesuré le 2026-08-16 :* `git grep -n "case 'round':" -- packages/core/src | wc -l` rend **2**
   — les deux parcours de l'algèbre, inchangés. C3 n'ajoute aucun kind d'expression, aucun opérateur
   et aucun code d'erreur ([§2, D10]) ; le seul élargissement est `ExpressionErrorSite`, qui est un
   **site** et non un kind, et qui ne se dispatche dans aucun `switch` de l'algèbre.
   *Ce qui repose dessus :* la recommandation A de l'arbitrage n°7, et le fait que le **seuil de
   retrait** de l'amendement d'`AGENTS.md` §3.B obtenu par C2 n'est pas franchi — donc que ce lot
   n'a aucune raison de toucher `AGENTS.md`, ce dont la [§6.4] fait un critère mécanique.
   *Si elle tombe* — un lot ultérieur écrivant un troisième parcours — l'amendement se retire, les
   deux `switch` de l'algèbre deviennent un Visitor, et le test de discriminant de
   `checkTableWiring` **redevient une question**. Ce ne serait pas un travail de C3, mais l'ADR 0005
   doit le dire pour que le lien soit trouvable.
