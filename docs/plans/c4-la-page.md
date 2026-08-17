# Plan d'implémentation — `@openview/core` lot C4 : la page

> **Document d'implémentation.** Il dit *comment* livrer un lot : découpage, fichiers touchés,
> contrat définitif, tests, ordre des commits. Il ne dit ni *quoi* ni *pourquoi* — cela vit dans
> `docs/roadmap/` — ni les *décisions* structurantes, qui se consignent dans `docs/adr/`. Il est
> **périssable** : une fois le lot livré, il ne fait plus foi, et c'est l'ADR 0006 qui reste.
>
> **Statut à l'exécution :** ✅ **prêt à exécuter. Les sept arbitrages de la [§8] sont TRANCHÉS** —
> propriétaire du produit, **2026‑08‑18**. Six sont tranchés sur la recommandation de ce plan ; **un
> seul en diverge, et c'est le n° 6 : `firstOnly` et `exceptFirst` entrent dans le lot.** Le contrat de
> la [§3] est donc écrit dans sa forme définitive, sans branche conditionnelle. Les ⛔ de la [§8] sont
> conservés comme **trace** de ce qui aurait coûté une réécriture : ils ne gouvernent plus rien.
>
> | # | Arbitrage | Décision | Effet sur ce plan |
> | :-- | :--- | :--- | :--- |
> | 1 | la numérotation | **A** — le marqueur `pageField`, sans expression ni clé réservée | conforme, sept incréments |
> | 2 | la feuille | **A** — millimètres fractionnaires, `STANDARD_SHEETS_MM` hors contrat | conforme |
> | 3 | `orientation` | **A** — pas de champ ; question dérivée du n° 2, pas un arbitrage autonome | conforme |
> | 4 | la migration `4 → 5` | **A** — transformante, feuille de compatibilité **A4 portrait 20 mm explicitement validée** | conforme, et le mandat de D11 est levé |
> | 5 | `collectTemplateDataPaths` | **A** — dans le lot ; tient un contrat déjà publié, ce n'est pas une décision produit | conforme |
> | 6 | variantes de première page | **B — `firstOnly` et `exceptFirst` MAINTENANT** | **cinq occurrences**, table de compatibilité à cinq entrées, un refus retiré de D13 |
> | 7 | `printableAreaOf` | **A** — motivée par la **centralisation du calcul**, pas par une garantie au pixel | conforme, motif reformulé |
>
> **Ce que le n° 6 change, et ce qu'il ne change pas.** Il change `PAGE_BAND_OCCURRENCES` (trois → cinq
> membres), la table de compatibilité de [§2, D6], quatre lignes de refus en [§5.1], un `it` de [§6.2] et
> la liste de D13 (vingt refus → **dix‑neuf**). Il ne change **ni le nombre d'incréments, ni l'estampille,
> ni un seul export du barrel** — les 22 noms sont inchangés, parce que les deux membres entrent dans un
> tuple déjà exporté. C'est exactement ce que le coût de réouverture annonçait.
>
> **Date :** 2026-08-17 · **Brique :** `@openview/core`, vague 1 · **Jalon visé :** J1
>
> ---
>
> **La baseline de ce plan a changé pendant sa rédaction, et c'est la première chose à lire.** Au
> début de la session, `packages/core/src` était encore à `schemaVersion` **3** : pas de tableau, pas
> de `BlockNode`, pas de découpage `ast/types.ts` / `ast/schemas.ts`. Le lot C3 était **planifié et
> non livré**, et une version antérieure de ce document raisonnait donc sur une baseline hypothétique
> — « si C3 livre avant C4, l'estampille est 5 ; sinon 4 ». **Pendant la rédaction, la PR #18 a été
> fusionnée.** Relevé : `git log` rend `c5e0006 Merge pull request #18 from
> PatayEnCroute/feat/c3-tableau-de-lignes`, `template.ts:80` déclare `CURRENT_SCHEMA_VERSION = 4`,
> `ast/` est découpé, `BlockNode` existe, `errors.ts:80` porte le site `tableRowGroup`, et
> `docs/adr/0005-le-tableau-de-lignes.md` fait foi. **Trois conséquences, et aucune n'est
> cosmétique :** l'estampille de ce lot est **5** sans condition [§2, D11] ; l'ADR de ce lot est la
> **0006** ; et le lot **n'a pas d'incrément de refactor**, parce que C3 a déjà payé le découpage de
> `ast/` dont C4 hérite. Les citations de ce plan portent les numéros de ligne **d'après la fusion**
> — ceux d'avant ont tous bougé de douze lignes dans `docs/roadmap/core.md`.
>
> ---
>
> **Ce qui a été mesuré, et ce qui ne l'a pas été.** Le protocole complet est en tête de [§3]. En
> résumé : un bac à sable **hors du dépôt** (aucune écriture dans l'arbre de travail, `git status`
> identique avant et après), un `tsconfig` qui **étend `tsconfig.base.json`** et reprend les options
> de `packages/core/tsconfig.json` — donc `strict`, `noUncheckedIndexedAccess`,
> `exactOptionalPropertyTypes`, NodeNext —, une jonction vers le `zod@3.25.76` du dépôt, le `tsc`
> **7.0.2** du dépôt, Node **v24.11.1**, et les mesures d'exécution jouées contre un **build de
> `main`** produit hors du dépôt.
>
> - **Les cinq fichiers de contrat de la [§3] compilent à exit 0** sous ces options, contre les
>   déclarations réelles de C3.
> - **Les trente-et-un refus et contrôles de la [§5.1] ont été exécutés** : codes, chemins et
>   messages sont des chaînes relevées, pas des chaînes espérées. ⚠️ **Sept d'entre eux — R13b à R13h —
>   ont été mesurés dans une SECONDE passe**, après la correction de l'invariant de bandes et après la
>   décision du 2026‑08‑18 ; il en va de même du tableau exhaustif des 31 combinaisons de [§3.2] et des
>   deux contrôles `tsc` de la table de compatibilité. La distinction est écrite parce que la première
>   campagne, elle, portait sur un contrat qui refusait moins.
> - **Deux contrôles de calibrage** rendent les chiffres de profondeur comparables à ceux du plan C3 :
>   `RECIPE_TEMPLATE` mesure **18 niveaux / 231 valeurs** et un texte de `root` accepte **56** `round`
>   imbriqués — les deux chiffres exacts que C3 annonce. Sans eux, les neuf autres mesures de
>   [§2, D12] seraient invérifiables.
> - **Ce qui n'est PAS mesuré :** la porte 1 (`biome check`), la porte 4 (aucun chiffre de couverture
>   produit), l'orchestration `turbo`, et les quatre autres paquets. Le type-check du playground, en
>   particulier, est **raisonné** à partir de ses deux sites d'appel relevés (`App.tsx:439` et `:556`)
>   et non exécuté.
>
> **Revue de contradiction.** Trois conceptions concurrentes du même contrat ont été rédigées
> indépendamment — l'une gouvernée par le contrat minimal, l'une conçue à rebours depuis les besoins du
> moteur, l'une par la cohérence avec C5/C6/C7/C11 — puis confrontées décision par décision. Elles
> convergent sur l'essentiel : la page est un **champ requis** du document, la numérotation est un
> **segment marqueur** et non une expression, l'estampille est **5** avec une migration
> **transformante**. Elles divergent sur trois points, tous portés en [§8] plutôt que tranchés
> discrètement : l'**unité de longueur** (millimètres fractionnaires ou unité entière commensurable —
> arbitrage n° 2), la **feuille nommée ou dimensionnée** (même arbitrage), et le **confinement du
> marqueur** aux seules bandes (écarté, avec son coût mesuré en [§2, D7]). La confrontation a par
> ailleurs produit **sept signalements** — des faits que ce lot met au jour sans avoir à les trancher,
> dont un énoncé faux du dépôt et une docstring publiée qui contredit ce plan ([§8], signalements A à G).
> La contre-analyse ci-dessous en a ajouté un **huitième** ([§8], signalement H).
>
> Une **relecture adverse** a ensuite attaqué le consensus plutôt que de l'améliorer, et **quatre de ses
> objections ont modifié ce document** : l'ordre d'étalement d'une migration écrase ou préserve une page
> d'auteur selon la position d'une clé — **mesuré**, d'où le test explicite plutôt qu'une astuce
> d'écriture [§3.7] ; l'empreinte réelle du lot C3 — **20 fichiers, +2 312/−275** — calibre la
> réestimation de poids, qui sans elle n'était qu'une lettre [§4] ; la variante dont E3 aura besoin est
> probablement celle de **première** page et non de dernière, ce qui change le statut de l'arbitrage n° 6
> [§8] ; et rien ne borne le contenu d'une bande, dont la hauteur peut donc dépendre du jeu de données
> [§2, D6]. Les autres attaques portaient sur des conceptions concurrentes que ce plan ne retient pas.
>
> ---
>
> **Une contre-analyse externe a ensuite relu ce document, et six de ses sept constats ont modifié le
> contrat. Le septième — présenté comme bloquant — est faux, et sa réfutation est écrite ici plutôt
> qu'ailleurs parce que la suivre aurait détruit une convention de ce dépôt.**
>
> - **Rejeté : « il faut fusionner INC‑1, INC‑2 et INC‑4 en un commit atomique ».** La convention du
>   dépôt est l'inverse, et elle est écrite dans le code : `template.ts:16-21` — « *It is stamped ONCE,
>   after the last persisted shape of the lot, and not once per increment* », avec pour corollaire la
>   règle de conduite « *no commit before this one was publishable* ». Trois précédents la tiennent —
>   `58ae2b6` estampille 3 après `ae88b92`, `e816bba` estampille 4 après `e4149a1` et `c6d5940`. Le
>   « *in the same commit* » de `template.ts:23` apparie **l'estampille et son entrée de migration**,
>   ce que fait INC‑4 ; et le « pas de dérogation pré‑v1.0 au versionnement » d'`AGENTS.md` répond à
>   « peut-on sauter l'estampille ? », jamais à « à quel commit ? ». **Le lot garde ses sept
>   incréments.**
> - **Retenu de ce même constat, en revanche : sa prémisse est juste et ce plan la sous-estimait.**
>   INC‑1 **rétrécit** là où C1, C2 et C3 **élargissaient** : un build de mi‑lot ne se contentait pas
>   d'ignorer les documents du build suivant, il refuse **tous les documents v4 existants**, fixtures du
>   dépôt comprises. « Non publiable » ne décrit donc pas le même état qu'en C3, et deux conséquences
>   sont écrites : la règle de conduite de [§2, D11] est renforcée, et le critère de sortie d'INC‑1 est
>   corrigé — il était contradictoire [§4, INC‑1].
> - **Retenu : les occurrences de bandes étaient incohérentes.** L'invariant refusait deux occurrences
>   **identiques** quand le texte annonçait un système sans **chevauchement** : `every` + `lastOnly`
>   posait deux bandes sur la dernière page, `every` + `exceptLast` deux bandes sur toutes les autres —
>   exactement l'état ambigu que l'invariant prétendait supprimer. L'invariant devient une **table de
>   compatibilité déclarée** [§2, D6]. **Et c'est la correction qui a le plus profité de la décision du
>   2026‑08‑18 :** la table est passée à cinq occurrences dans le même geste, là où la découvrir *après*
>   l'ajout de `firstOnly` aurait signifié quatre couples fautifs de plus, silencieusement acceptés.
> - **Retenu : deux raisonnements de versionnement étaient faux.** Le caractère **requis** de `page` ne
>   protège d'aucune perte silencieuse — un build antérieur supprime un champ inconnu qu'il soit requis
>   ou optionnel chez son successeur ; seule l'estampille protège. La conflation apparaissait **quatre
>   fois** ([§2, D2], deux docstrings de [§3.1], celle de [§3.7]) et elle est corrigée partout : `page`
>   reste requis, pour le motif juste.
> - **Retenu, et RE-MESURÉ : un build v4 ne rend aucun `invalid_union` sur un chemin sous `page`.** Il
>   supprime `page` **sans regarder dedans**, donc sans jamais voir le marqueur. Mesuré contre le build
>   du dépôt (`dist`, `CURRENT_SCHEMA_VERSION = 4`, `zod@3.25.76`) : le document est **accepté**, clés
>   de sortie `schemaVersion,id,name,version,root`. Le refus se démontre en plaçant le marqueur dans
>   `root`, où il est également licite — `invalid_union`, chemin `root.children.0.content.1.kind`,
>   « No matching discriminator ». C'était une contradiction interne : [§5.1, R24] mesurait déjà la
>   suppression silencieuse.
> - **Retenu : `parsePageSetup` n'est pas une frontière de persistance, et le dire est obligatoire.**
>   Le constat est juste et la nuance compte : **ce n'est pas nouveau**. `parseExpression`,
>   `parseDocumentNode` et `parseBlockNode` sont déjà exportés par le barrel avec la même propriété
>   (`index.ts:175-177`). C4 en ajoute la quatrième instance, pas la première — d'où une phrase de
>   docstring et un signalement [§8, H], et **non** des schémas stricts.
> - **Retenu : la borne de 5 080 mm était mal qualifiée.** « La plus grande page qu'un lecteur PDF est
>   tenu de traiter » est faux comme énoncé général : le facteur `UserUnit` de PDF 1.6 permet des pages
>   plus grandes. C'est une **borne d'interopérabilité Openview**, et elle est réécrite comme telle
>   [§2, D3], [§3.1], [§9, hypothèse 9].
> - **Retenu : quatre incohérences de rédaction.** Le protocole de [§3] décrivait encore un `src` en
>   version 3 ; `orientation` était renvoyé deux fois à l'arbitrage n° 2 au lieu du n° 3 ; le barrel
>   comptait alternativement 21 et 22 noms ; et la comparaison de poids opposait **14** fichiers de
>   production de C4 aux **20** fichiers hors documentation de C3. À périmètre égal, C4 en touche
>   **22** — la conclusion « donc plus petit que C3 » ne tenait pas et elle est retirée [§4].
> - **Une cinquième, trouvée en vérifiant les quatre autres :** [§2, D3] énumérait six formats de
>   commodité quand [§3.1] en déclare sept.
>
> **Cinq mesures ont renversé une intuition. Trois portent une décision, deux ont corrigé une erreur
> de ce plan.**
>
> 1. **Les entiers en millimètres rendraient US Letter inexprimable** — 215,9 × 279,4 mm — et la
>    borne « au plus deux décimales » qui semble raisonnable **refuse Letter** :
>    `279.4 * 100 = 27939.999999999996`. D'où : millimètres fractionnaires, aucune contrainte de
>    décimales [§2, D3].
> 2. **`w - (l + r)` et `(w - l) - r` ne rendent pas le même nombre** — `165.10000000000002` contre
>    `165.1` sur Letter à marges d'un pouce — et l'écart est invisible sur A4 à marges entières. D'où :
>    l'aire imprimable est calculée **une** fois, dans `core`, et exportée [§2, D5].
> 3. **Le patron d'assertion de C3 ne compile pas sur `PageSetup`** — `TS2322`, parce que `z.array`
>    infère un tableau mutable là où le type déclare `readonly`. D'où : une assertion
>    **unidirectionnelle**, et un test d'aller-retour comme filet réel [§3.2].
> 4. **`noUncheckedIndexedAccess` mord aussi sur l'accès par point** dès qu'un type porte une signature
>    d'index : une première rédaction de ce plan affirmait le contraire — sans l'avoir mesuré — et
>    typait le tableau des formats `Readonly<Record<string, Sheet>>`, ce qui rendait
>    `STANDARD_SHEETS_MM.a4` de type `Sheet | undefined` et cassait la fixture de recette. Corrigé en
>    `as const satisfies` [§3.1].
> 5. **Un critère mécanique du plan C3 devient ambigu à cause de ce lot** : sa sonde de couverture
>    cherche « le premier fichier finissant par `fixtures.ts` », et C4 en crée un second. Mesuré : il y
>    en a **un** aujourd'hui. La forme corrigée filtre au lieu de chercher, et échoue bruyamment
>    [§6.4].

---

## 0. Le cadre : la brique décrit une feuille, elle n'en imprime aucune

Tout ce qui suit en découle, et un lot de **page** est l'endroit le plus glissant de la vague 1 :
une page *ressemble* à un objet de rendu. Elle a une taille, des marges, un haut, un bas, un
numéro. Elle donne donc l'illusion qu'en la décrivant on décide de la mise en page — alors que
`docs/roadmap/core.md:283-286` dit l'inverse sans détour :

> « Elle **décrit**, elle ne **produit** rien : aucune page, aucun pixel, aucun PDF. […] Si une
> question commence par « à quoi ça ressemble », elle appartient au moteur ou au viewer. »

Le lot C4 écrit donc un **contrat de feuille**, pas un algorithme de pagination. La distinction
n'est pas rhétorique : elle décide, champ par champ, ce qui entre dans le contrat et ce qui est
refusé. Un modèle dit *quelle feuille*, *quelles marges*, *ce qui se répète en haut et en bas*, et
*ce qui n'apparaît que sur la dernière page*. Il ne dit ni où couper, ni comment répartir, ni quoi
faire quand ça ne tient pas.

La table d'arbitrage de `docs/roadmap/core.md:34-49`, croisée avec les lots du moteur, place la
frontière au champ près — et pour ce lot elle est plus tranchante que pour C3, parce que la
pagination est **la** chose que C4 frôle sans y toucher :

| Sujet | Position écrite | Où |
| :--- | :--- | :--- |
| Le **format**, l'**orientation**, les **marges** de la feuille | **Le modèle les impose** (lot C4) | `core.md:175-184` |
| Ce qui **se répète** en haut et en bas de chaque page | **Le modèle le déclare** (lot C4) | `core.md:181-182` |
| Ce qui **n'apparaît que sur la dernière** page | **Le modèle le déclare** (lot C4) | `core.md:182` |
| **Où** la page se coupe, la veuve, l'orpheline, la répétition effective | **Le moteur** (E2, E3) | `engine.md:44-50`, `:56-67` |
| Le **report de page** (« report : 12 480,00 € ») | **Le moteur** : seul lui sait où il coupe | `core.md:48`, `engine.md:63-67` |
| La **valeur** du numéro de page et du nombre de pages | **Le moteur**, après pagination | `engine.md:44-47` |
| Le **format** d'affichage de ce numéro (langue, chiffres) | **C6** | `core.md:198-212` |
| L'**insécabilité** d'un bloc | **C7**, honorée par E3 | `core.md:214-223` |
| La **police**, la **couleur**, le **filet**, l'**espacement** d'une bande | **C5** | `core.md:186-196` |
| Le **fond de page**, le **filigrane**, le **cachet** | **C11** et D10 de l'éditeur | `core.md:265-279`, `designer.md:168-182` |
| La **conformité** du document produit | **L'intégrateur** | `core.md:49` |

> 🔑 **La règle qui coupe la dérive, appliquée à la page.** La capacité s'arrête à **une feuille et
> des emplacements**. Elle ne va jamais jusqu'à **une politique de coupe** — pas de
> `pageBreakBefore`, pas de `keepTogether`, pas d'`orphanControl`, pas de `widowControl` : le plan
> C3 a déjà refusé ces cinq noms (`c3, §2 D13`), et C4 est le lot où l'on pourrait croire qu'ils
> reviennent chez eux. Ils ne reviennent pas : déclarer *où se place* une bande n'est pas décider
> *où couper* un flux. Elle ne va jamais jusqu'à une **hauteur de bande** : aucun nœud du contrat
> ne déclare de hauteur, et en introduire une pour la seule page ferait du contrat le juge d'une
> mesure que seul un moteur de mise en page peut prendre [§2, D8]. Elle ne va jamais jusqu'à un
> **numéro formaté** : « Page 2 sur 4 » et « Page 2 of 4 » sont le même marqueur dans deux langues,
> et la langue est C6 [§2, D7]. Elle ne va jamais jusqu'à une **valeur de numéro** : le contrat pose
> un marqueur, il ne calcule rien — c'est la différence exacte entre un champ substitué et une
> variable évaluée, et c'est ce qui permet à `core` de ne rien savoir de la pagination [§2, D7].
> Et elle ne va jamais jusqu'à une **feuille déduite de quoi que ce soit** : ni de la locale de la
> machine (interdit et outillé), ni du jeu de données de l'intégrateur (règle de périmètre
> d'`AGENTS.md`), ni d'un défaut caché dans le schéma [§2, D3].

**Une précision de périmètre qui vaut d'être écrite, parce que C4 est le premier lot qui la
rencontre.** « Multi-pages comptable » est le niveau d'exigence du projet (décision 1,
`docs/roadmap/README.md:49`), et ce lot est celui qui rend ce niveau *exprimable*. Il ne le rend
pas *atteint*. Après C4, aucun document ne sortira sur deux pages : il n'existe pas de moteur. Ce
que C4 livre, c'est l'ensemble des faits sans lesquels E2 et E3 n'auraient rien à respecter — et
le plan doit le dire franchement, parce qu'un lecteur qui croirait la pagination livrée chercherait
dans `core` un code qui n'y sera jamais [§6.3].

Les fichiers du dépôt qui portent ce cadre et qu'il faut avoir lus avant d'écrire une ligne :
`AGENTS.md` (« Ce qu'Openview n'est pas », le tableau « ce qui est vérifié par une machine », §1.1,
§1.2, §1.4, §3), `README.md` §« Calculs, conformité et responsabilité », `docs/roadmap/README.md`
(décisions 1, 5, 7, 8, 11, 16, les jalons, §5 hors périmètre, §7 ordre de sacrifice),
`docs/roadmap/core.md` (table d'arbitrage `:34-49`, lot C4 `:163-172`, et ses voisins C3 `:150-161`,
C5 `:174-184`, C6 `:186-200`, C7 `:202-211`, C8 `:213-224`, C9 `:226-234`, C11 `:253-265`),
`docs/roadmap/engine.md` (E1 `:30-40`, **E2 `:42-52`**, **E3 `:54-76`**, E4 `:77-85`, **E5 `:87-98`**,
E6 `:100-119`, E8 `:137-151`), `docs/roadmap/viewer.md`, `docs/adr/0002-data-binding-and-loop-scope.md`
(ce que `collectDataPaths` promet, et les trous qu'il consigne), `docs/adr/0003-formules-agregations-et-dates-civiles.md`
(décision 8 sur les portes bornées, la charge d'erreur `:417`), `docs/adr/0004-les-arrondis-declares-par-le-modele.md`
(décision 10 : *si une déclaration ne peut changer que ce qu'un lecteur voit, elle est C6*), le plan
[C3](c3-tableau-de-lignes.md) en entier — c'est la **baseline** de ce lot, et sa §2 D13 énumère déjà
cinq refus qui sont la moitié du périmètre de C4 —, et `apps/playground/src/App.tsx:171-176`, où le
dépôt écrit déjà, en français et pour un lecteur de passage, qu'il ne réserve aucun nom de champ.

---

## 1. Pourquoi C4, et pourquoi maintenant

### Ce que la roadmap impose

`docs/roadmap/core.md:175-184`, dans son intégralité, parce que chaque membre de phrase devient un
champ ou un refus :

> ### C4. La page
>
> **Pourquoi.** Rien ne décrit aujourd'hui la feuille : format, orientation, marges, en-tête et pied
> de page répétés, numérotation. Or l'exigence retenue est **multi-pages comptable** : sans ces
> notions, le moteur n'a rien à respecter.
>
> **Prêt quand** un modèle impose son format et ses marges, déclare ce qui se répète en haut et en
> bas de chaque page, et ce qui n'apparaît que sur la dernière.
>
> **Poids :** M — **Dépend de :** rien

Trois verbes, et ils ne disent pas la même chose. Le modèle **impose** une feuille et des marges :
c'est une contrainte, pas une suggestion, donc rien en aval n'a le droit de la choisir à sa place —
ni le moteur par un défaut, ni l'appelant par un paramètre de rendu [§2, D2]. Le modèle **déclare**
ce qui se répète : une déclaration d'emplacement, pas une politique de répétition — le moteur reste
le seul à décider *où* il coupe et donc *combien de fois* la bande apparaît [§0]. Et le modèle
déclare **ce qui n'apparaît que sur la dernière** page : c'est le seul membre de phrase qui exige du
contrat une notion de **rang de page**, et c'est celui qui coûte le plus cher à l'aval [§2, D6].

### L'écart est réel, et il est mesuré

Le contrat ne connaît **aucun** vocabulaire de page. **Mesuré** le 2026-08-17 sur `main` :

```bash
git grep -niE '\b(page|sheet|margin|orientation|portrait|landscape|a4|letter|footer|header)\b' \
  -- packages/core/src | grep -v '__tests__'
```

rend **trois** lignes, et aucune ne parle d'une feuille : `evaluate.ts:58`, `limits.ts:48` et
`guard.ts:39` emploient le mot **`margin`** au sens de *marge de sécurité* d'un plafond. Il n'y a ni
`page`, ni `sheet`, ni `orientation`, ni `header`, ni `footer` — le contrat sait décrire un texte, une
image, un conteneur, une boucle, une condition et (après C3) un tableau, tous **hors de toute
feuille**. `Template` porte sept champs (`template.ts:96-105`) et pas un ne concerne le support.

> ⚠️ **Ce relevé est aussi un piège pour la [§6.4], et il faut le dire ici pour qu'il ne soit pas
> recopié naïvement.** Un critère mécanique « aucun vocabulaire de page hors du lot » écrit sur le
> mot `margin` rend **trois faux positifs sur un dépôt sain**, exactement comme le
> `remise` / `p-remise` du plan C3 (`c3, §6.4`). Le critère doit porter sur une **déclaration de
> champ**, jamais sur un mot dans un commentaire [§6.4].

Ce que cet écart interdit, en une phrase : **le lot E1 du moteur ne peut pas commencer.** Son
périmètre est « une facture courte, un tableau qui tient sur la page, les formules du modèle
évaluées, le logo, l'apparence du modèle respectée » (`engine.md:33-36`) — et *« qui tient sur la
page »* n'a aucun sens tant qu'aucune page n'est déclarée. Un moteur qui devrait inventer la feuille
choisirait A4 ou Letter à la place de l'auteur, et le premier PDF sortirait d'une décision prise
dans un fichier de rendu.

### Ce que C4 débloque, et ce qu'il ne débloque pas

| Lot | Ce que C4 lui apporte | Reste bloqué par |
| :--- | :--- | :--- |
| **E1** — une facture d'une page en PDF | La feuille, ses marges, la zone imprimable | C5 (apparence), C3 (tableau) |
| **E2** — le tableau déborde proprement | Les bandes à répéter, et le marqueur « page 2 / 4 » à substituer | E1 |
| **E3** — les exigences comptables | La bande « dernière page seulement » où posent les mentions et le cadre de paiement | E2, C7 |
| **E5** — le moteur sait dire où il coupe | La géométrie qui rend une découpe calculable et comparable | E3 |
| **C7** — les blocs insécables | Le seul lot du contrat qui **dépend de C4** (`core.md:223`) | rien d'autre |
| **C6** — langue, devise et formats | Le marqueur de numéro à formater, jamais une chaîne déjà formatée [§2, D7] | C2, C5 |
| **C11** — grille, colonnes et calques | Une feuille sur laquelle poser une grille et un fond | C10, J3 |

Et ce qu'il ne débloque **pas**, écrit franchement : **aucun document ne sortira sur deux pages
après C4**. Le lot ne produit ni pixel ni PDF, et sa démonstration est un test plus un dessin à
l'échelle dans le playground [§6.3]. Un lecteur qui attendrait de C4 une pagination chercherait dans
`core` un code qui n'y sera jamais.

### Pourquoi maintenant, et non plus tôt ni plus tard

C4 **ne dépend de rien** (`core.md:184`) : il aurait pu être le premier lot de la vague 1. Il arrive
quatrième pour une raison de capacité, pas de dépendance — décision 3, « solo, temps partiel »
(`docs/roadmap/README.md:51`), qui impose « un seul chantier ouvert à la fois ». L'ordre C1 → C2 → C3
était **contraint** (C2 dépend de C1, C3 dépend de C1) ; C4 est le premier lot de la vague dont la
position est un **choix**, et il faut donc justifier le choix plutôt que l'hériter.

Trois raisons de le prendre maintenant, dans cet ordre de force :

1. **C4 est le dernier verrou de E1 qui ne dépende de personne.** Après C4, il ne reste que C5 entre
   la vague 1 et le premier PDF ; avant C4, il en reste deux, dont un qu'aucun autre lot ne peut
   préparer.
2. **La feuille est ce sur quoi C5 va écrire.** C5 est l'apparence, et une apparence se règle *dans*
   une zone imprimable : livrer C5 avant C4, ce serait décrire des espacements et des filets sans
   savoir de quelle largeur on parle. Le lien n'est pas déclaré par la roadmap — C5 dépend de C3, pas
   de C4 — et c'est justement pour cela qu'il faut l'écrire : rien n'empêcherait mécaniquement de les
   inverser, et l'inversion coûterait une reprise de C5.
3. **Le lot est petit et il est isolé.** Aucun nœud nouveau, aucun kind d'expression nouveau, aucun
   code d'erreur nouveau, un seul champ de premier niveau et un seul kind de segment [§2] : la
   surface est plus étroite que celle de C3, et elle ne touche **pas** l'algèbre. C'est le bon
   moment pour un lot qui n'entre en collision avec rien.

### Arguments contraires, examinés et écartés

**(a) « Attendre le moteur pour savoir ce dont il a besoin. »** C'est l'argument que la roadmap
elle-même retient — pour la **vague 2**, et en donnant sa raison : « une partie du contrat ne sert
**qu'à l'éditeur** […] la décrire avant d'avoir vu une seule page sortir, c'est concevoir à
l'aveugle » (`core.md:63-74`). La page n'est pas dans ce cas : elle ne sert pas à l'éditeur, elle
sert au **moteur**, et le moteur est bloqué sans elle. Appliquer à C4 le raisonnement de la vague 2
serait une inversion : on attendrait de voir sortir une page pour décrire la page.

**(b) « La page est un paramètre de rendu, pas un champ du modèle. »** L'argument est sérieux — un
même modèle rendu en A4 puis en Letter est un besoin plausible — et il est écarté par trois textes
qui convergent. Le critère de recette dit « un modèle **impose** son format » : un paramètre
n'impose rien. `ports/render.ts:25-29` déclare `RenderRequest` avec deux champs et écrit « *There is
no third field on purpose* » ; le troisième champ que cette phrase refuse est un contexte ambiant, et
une géométrie passée à l'appel en serait un. Et la décision 7 (`README.md:55`) exige un aperçu
**identique** au PDF : une géométrie hors du modèle devrait être transmise à l'identique au viewer et
au moteur, par deux appelants différents, sans qu'aucun schéma ne le vérifie — l'écart deviendrait
invisible. *Signal de réouverture nommé :* un intégrateur qui demande le même modèle en deux formats.
La réponse d'aujourd'hui est « deux modèles », et le coût de cette réponse est réel : deux documents
à maintenir en phase, comme les deux tableaux du contournement de colonne conditionnelle de C3
(`c3, §2 D13`).

**(c) « Commencer par C8, le refus compréhensible, puisqu'il grandit à chaque lot. »** C8 dépend de
C1 à C7 (`core.md:236`) : le prendre maintenant, ce serait écrire les messages de lots qui n'existent
pas. C4 lui apporte au contraire le meilleur cadeau possible, celui que C3 a nommé — **aucun code
d'erreur nouveau** [§2, D9] : non pas un message de plus à écrire, mais un état de moins.

**(d) « Attendre que C3 soit livré, puisque C4 en hérite le découpage de `ast/`. »** Ce n'est pas un
argument contre C4, c'est une contrainte d'ordonnancement, et elle est réelle : ce plan est écrit en
supposant C3 **livré**, donc `packages/core/src/ast/types.ts` et `schemas.ts` existants, `BlockNode`
déclaré, et `CURRENT_SCHEMA_VERSION` à 4 [§9, hypothèse 1]. Si l'ordre s'inverse, ce n'est pas le
contrat de C4 qui change, ce sont trois choses nommées et localisées : le numéro d'estampille, le
fichier où les types atterrissent, et le nom de l'union que les bandes acceptent [§2, D11].

---

## 2. Ce qui est décidé, et ce que ça engage

**Treize décisions.** Chacune porte son énoncé, son motif, les options écartées avec l'argument qui
les écarte, un verdict de réversibilité, et son **signal de réouverture** quand elle en a un. Le
format est celui du plan C3, et pour la raison qu'il donne : une décision dont on n'a pas écrit ce
qui la rendrait fausse est une décision qu'on rouvrira sans le savoir.

Vue d'ensemble, pour lire la suite sans se perdre :

| # | Décision | Forme stockée ? | Réversible ? |
| :-- | :--- | :--- | :--- |
| **D1** | Le critère d'appartenance, écrit avant la liste des champs | — | — |
| **D2** | `Template.page` **requis** : ni paramètre de rendu, ni nœud, ni option | **oui** | non |
| **D3** | La feuille est **deux longueurs en millimètres** ; aucun nom de format stocké | **oui** | non |
| **D4** | Quatre marges, et l'invariant croisé **dans le schéma**, avec son garde | **oui** | non |
| **D5** | L'aire imprimable est calculée **une fois**, dans `core`, et exportée | non | oui |
| **D6** | Deux listes de bandes, **cinq** occurrences, une seule bande applicable par page | **oui** | non |
| **D7** | La numérotation est un **segment marqueur**, jamais une expression | **oui** | non |
| **D8** | Aucune hauteur de bande, aucune politique de coupe, aucun saut de page | — | oui |
| **D9** | **Zéro** code d'erreur nouveau, **zéro** site nouveau | non | — |
| **D10** | `collectTemplateDataPaths` : la promesse « le modèle dit ce qu'il lit » couvre les bandes | non | oui |
| **D11** | `CURRENT_SCHEMA_VERSION = 5`, et la **première migration transformante** du dépôt | **oui** | non |
| **D12** | Aucun plafond nouveau, et les mesures qui l'autorisent | non | dans un seul sens |
| **D13** | Ce que le lot refuse, par écrit — **dix-neuf refus** | — | selon |

**Toutes les mesures citées dans cette section ont été prises**, protocole en [§3]. Deux d'entre
elles reproduisent à l'identique des chiffres du plan C3 — `RECIPE_TEMPLATE` à **18 niveaux et 231
valeurs**, et **56** `round` imbriqués acceptés sous un texte de `root` — ce qui est la seule preuve
disponible que la sonde de ce plan et celle de C3 mesurent la même chose.

---

### D1 — Le critère d'appartenance, écrit **avant** la liste des champs

**Décision.** Un fait entre dans le contrat de page **si et seulement si** les trois conditions
suivantes sont réunies :

1. **Il est inexprimable hors d'une feuille.** Pas « il concerne la mise en page » — *inexprimable
   ailleurs*. Une marge n'a de sens que par rapport à un bord de papier ; une couleur de fond, un
   espacement, un filet s'écrivent sur n'importe quel bloc, donc ils appartiennent à C5.
2. **Il est décidé par l'auteur du modèle, pas calculé par un moteur.** Une taille de feuille est un
   choix ; un numéro de page est un résultat. Le premier est un champ, le second ne peut être qu'un
   **emplacement** [§2, D7].
3. **Il est décidable sans données et sans pagination.** Tout ce que le contrat déclare doit pouvoir
   être refusé au *save time*, sur le seul document, sans jeu de données et sans savoir combien de
   pages sortiront. C'est cette condition qui donne « zéro code d'erreur nouveau » [§2, D9], et c'est
   elle qui exclut toute politique de coupe [§2, D8].

**Pourquoi un critère avant une liste, et pourquoi celui-ci.** Le plan C3 a appris la leçon à ses
frais : sa première formulation de la condition (2) — « elle cesse d'exister avec la structure » —
« ne discriminait rien » et a dû être remplacée par « elle est **inexprimable** hors d'une colonne »
(`c3, en-tête, constat C-15`). La condition 1 ci-dessus est exactement cette forme corrigée, transposée à la
feuille. Les conditions 2 et 3 sont neuves, et elles sont nécessaires parce que C4 touche un objet
que C3 ne touchait pas : **le rendu**. Sans la condition 2, `numbering: { position: 'footer-center' }`
passe le test 1 (une position sur la feuille est inexprimable ailleurs) alors que c'est une règle de
mise en page. Sans la condition 3, `keepTogether` passe les tests 1 et 2 (l'auteur le décide, et
cela ne se dit que par rapport à une coupure de page) alors que c'est C7 et E3.

**Ce que le critère admet**, et il faut le vérifier champ par champ, sinon il est décoratif :

| Champ retenu | (1) inexprimable ailleurs | (2) décidé par l'auteur | (3) décidable sans données |
| :--- | :--- | :--- | :--- |
| `sheet.width`, `sheet.height` | oui — c'est le papier | oui | oui |
| `margins.{top,right,bottom,left}` | oui — un bord de papier | oui | oui |
| `header[]`, `footer[]` | oui — « en haut de chaque page » n'existe pas hors d'une page | oui | oui |
| `PageBand.on` | oui — un rang de page | oui | oui |
| `TextPageFieldSegment` | oui — un numéro de page | **l'emplacement, oui ; la valeur, non** | oui *(l'emplacement)* |

**La cinquième ligne est une exception, et elle est nommée plutôt que dissimulée.** Le marqueur de
numéro échoue à la lecture naïve de la condition 2 : sa *valeur* est calculée par le moteur. Il entre
quand même, parce que ce que le contrat déclare n'est pas la valeur mais **la place où elle
s'imprime** — et cette place, personne d'autre que l'auteur ne peut la choisir. C'est la même
distinction que C3 a dû écrire pour `align`, retenu « par **deux arguments mécaniques**, pas par le
critère » (`c3, §2 D1`) : une exception écrite est une exception qu'on peut discuter, une exception
tacite est une brèche.

**Écarté.** (a) **Un critère en une condition** (« tout ce qui concerne la feuille ») : il admet la
couleur du papier, la hauteur des bandes et la politique de coupe, c'est-à-dire C5, E2 et C7. (b)
**Le critère de C3 recopié tel quel** : sa condition unique ne dit rien du rendu, et C4 est le
premier lot du contrat qui frôle un algorithme. (c) **Pas de critère, une liste de champs justifiés
un par un** : c'est la forme qui laisse entrer le champ de trop, parce qu'un champ isolé se justifie
toujours.

---

### D2 — `Template.page` est un champ **requis** : ni paramètre de rendu, ni nœud de l'arbre

**Décision.** `Template` gagne **un** champ, `page: PageSetup`, **requis**, au premier niveau du
document. Ce n'est pas un nœud (il n'entre ni dans `DocumentNode`, ni dans `BlockNode`), ce n'est pas
un argument de `RenderRequest`, et ce n'est pas un champ optionnel avec un défaut de schéma. Les
bandes qu'il porte contiennent des `ContainerNode` — la **même** forme que `Template.root`.

**Pourquoi requis, et pas optionnel.** Deux raisons, et il faut d'abord écarter celle qu'une première
rédaction de ce plan avançait, **parce qu'elle est fausse et qu'un relecteur externe l'a épinglée**.

> ⚠️ **Ce n'est PAS la perte silencieuse qui décide du caractère requis, et confondre les deux fait
> reposer une décision juste sur un motif faux.** La perte silencieuse — **mesurée**, `probe1`, Node
> v24.11.1, `zod@3.25.76` via `zod/v4`, schémas du dépôt : un document portant un champ `page` parsé
> par le schéma qui l'ignore ressort avec les clés `schemaVersion,id,name,version,root`, `page`
> supprimée sans une seule issue [§5.1, R24] — est le fait d'un **build antérieur** qui rencontre un
> champ **inconnu**. Elle se produirait à l'identique si `page` était optionnelle chez son successeur :
> un `z.object` v4 ne sait pas que la clé existe, et sa facultativité en v5 ne lui apprend rien.
> **Ce qui protège de cette perte, et la seule chose qui en protège, c'est l'estampille** [§2, D11].
> Le motif est donc rangé où il vaut, et il n'est pas répété ici.

**Raison 1 — le critère de recette emploie le verbe « impose ».** « Un modèle **impose** son format et
ses marges » (`core.md:181-182`) ; un champ optionnel n'impose rien, il autorise. La proposition P1 de
[§6.1] n'est démontrable que par un refus, et un champ optionnel n'en produit aucun.

**Raison 2 — un champ optionnel force le moteur à inventer une feuille, donc à décider à la place de
l'auteur, dans un fichier de rendu.** C'est le déplacement que [§1, argument (b)] refuse pour le
paramètre de rendu, et il revient par la porte du champ facultatif : `page === undefined` oblige E1 à
écrire un format quelque part, sans qu'aucun schéma ne vérifie que le viewer écrit le même.

Le coût de « requis » — et le fait qu'il ne soit **pas** un rétrécissement — est écrit plus bas, dans
son propre paragraphe.

**Et pourquoi pas un défaut de schéma, qui semble concilier les deux.** **Mesuré** : avec
`page: PageSetupSchema.default(PAGE_A4)`, un document **sans** page parse sans erreur et ressort avec
`{ width: 210, height: 297 }` — une feuille qu'Openview a choisie, écrite dans un document que son
auteur n'a jamais vu, et cela **à chaque parse**, silencieusement. Un défaut de schéma rend le champ
optionnel en pratique tout en le déclarant requis dans le type : c'est le pire des deux mondes, et
c'est le mécanisme exact que la décision 16 refuse pour l'arrondi (« Openview n'impose aucune règle
par défaut »). La feuille de compatibilité existe malgré tout dans ce lot, mais elle est écrite
**une fois, par la migration**, où elle est visible et datée [§2, D11].

**Pourquoi un champ de premier niveau et non un nœud.** Trois raisons, dont deux mécaniques.
La page n'a **pas de position dans le flux** : un nœud a des frères et un rang, une feuille n'en a
pas. Un `PageNode` obligerait `visitNode` à traiter un membre qui ne peut apparaître qu'à la racine —
donc une règle positionnelle que le contrat n'a nulle part ailleurs, et qu'aucun `switch` ne peut
faire respecter. Et `childrenOf` devrait décider si les bandes sont des « enfants » : si oui,
`collectDataPaths(root)` les visiterait *par accident* et la portée d'alias deviendrait fausse (une
bande n'est pas dans la portée d'une boucle du flux) ; si non, le nœud serait un conteneur qui ment
sur ses enfants. Le champ de premier niveau supprime la question — et il la remplace par une autre,
honnête et traitée : les bandes sont hors de `root`, donc `collectDataPaths` ne les voit pas
[§2, D10].

**Pourquoi pas un paramètre de rendu.** Développé en [§1, argument (b)] : `ports/render.ts:17` écrit
« *There is no third field on purpose* », le critère de recette emploie le verbe **imposer**, et la
décision 7 exigerait que la même géométrie parvienne au viewer et au moteur par deux appelants
distincts sans qu'aucun schéma ne le vérifie.

**Ce que « requis » coûte, et ce que ça ne coûte pas.** Cela **casse** tout document v4 qui ne
migrerait pas — **mesuré** : `invalid_type` sur le chemin `page`, message
`Invalid input: expected object, received undefined`. Ce n'est pas un rétrécissement pour autant,
parce que la migration transformante de D11 remplit le champ : **aucun document v4 ne devient
irrecevable**, et C4 n'ajoute donc **aucun cinquième rétrécissement** à la liste des quatre que porte
l'hypothèse pré-v1.0 (`c3, §2 D11`). C'est la propriété que la migration achète, et c'est la raison
pour laquelle elle transforme au lieu d'estampiller.

**Le point à traiter frontalement : le playground cassera bruyamment, et c'est voulu.**
`apps/playground/src/App.tsx:163` appelle `parseTemplate` **au chargement du module**, sur un littéral
sans page. Après INC-1, cette ligne lève, la page blanchit, et personne ne peut oublier la
démonstration. C'est le seul endroit du dépôt où un champ requis se paie comptant, et c'est le
meilleur détecteur que le lot possède — [§3.8] explique pourquoi les autres coutures hors de `core`
n'en ont aucun.

**Écarté.** (a) **`page?: PageSetup | undefined`** : perte silencieuse mesurée ci-dessus, et le
moteur devrait inventer une feuille — donc décider à la place de l'auteur, dans un fichier de rendu.
(b) **Un défaut de schéma** : mesuré, il réécrit le document à chaque parse. (c) **`PageNode` à la
racine de l'arbre** : règle positionnelle non outillable, et `childrenOf` piégé. (d) **`root` devient
un `PageNode` portant `header`/`body`/`footer`** : réécrit le champ `root` de tous les documents et
change le type de la racine, donc une migration transformante **beaucoup** plus lourde que celle de
D11, pour ranger trois listes dans un nœud qui ne participe à aucun parcours. (e) **Un champ
`pages: readonly PageSetup[]`** pour un document à formats mixtes : personne ne l'a demandé, la
roadmap ne le nomme pas, et une page par section suppose des sections que le contrat n'a pas.
*Signal de réouverture :* un modèle livré dont une annexe doit sortir en paysage.

**Irréversible** — c'est une forme stockée de premier niveau.

---

### D3 — La feuille est **deux longueurs en millimètres** ; aucun nom de format dans la forme stockée

**Décision.** `sheet: { width: number; height: number }`, en **millimètres**, finis, dans
`[MIN_SHEET_MM, MAX_SHEET_MM] = [1, 5080]`, **fractionnaires autorisés**. Aucun champ
`format: 'a4' | 'letter'`, aucun champ `orientation`. Un tableau de commodité
`STANDARD_SHEETS_MM` — **sept** entrées : A3, A4, A5, A6, Letter, Legal, Tabloid — est **exporté** pour que l'éditeur et le
playground **écrivent** des dimensions, mais il ne fait **pas** partie de la forme stockée : personne
n'enregistre un nom.

**Pourquoi des dimensions et non un nom : parce qu'un nom se paie en estampilles.** Une énumération
fermée de formats est une **forme stockée**. Y ajouter `a3` plus tard élargit une union stockée,
donc rejoue le cas « refus illisible » de `template.ts:35-43` et exige `CURRENT_SCHEMA_VERSION + 1`
avec sa migration — pour un format de papier. **Mesuré**, sur l'énumération candidate :
`Invalid option: expected one of "a4"|"a5"|"letter"|"legal"` (code `invalid_value`, chemin
`page.sheet.name`) est ce qu'un auteur obtient aujourd'hui s'il écrit `a3` ; et un build antérieur
devant un `a3` légitime rendrait le `No matching discriminator` que ce dépôt refuse. Avec des
dimensions, l'ensemble des feuilles exprimables est **infini** et aucune estampille n'est jamais due.
Le tableau de commodité, lui, grandit d'une ligne sans toucher au contrat : c'est exactement la
différence entre une donnée du document et une donnée du paquet.

**Pourquoi les millimètres, et pourquoi fractionnaires : la mesure est décisive et contre-intuitive.**
**MESURÉ** — les formats normalisés ne sont **pas** tous entiers en millimètres :

| Format | Largeur (mm) | Hauteur (mm) | Entier ? |
| :--- | ---: | ---: | :--- |
| A4 | 210 | 297 | oui |
| A5 | 148 | 210 | oui |
| Letter | **215,9** | **279,4** | **non** |
| Legal | **215,9** | **355,6** | **non** |
| Tabloid | **279,4** | **431,8** | **non** |

Une longueur **entière** en millimètres rendrait donc **US Letter inexprimable**, dans un produit dont
la décision 11 impose le multi-langue et dont le critère de recette du moteur nomme
« anglais/dollars ». Le fractionnaire n'est pas un confort ici, c'est une condition d'existence.

**Et la borne « au plus deux décimales », qui semble raisonnable, est un piège MESURÉ.** Écrite de la
manière évidente — `Number.isInteger(value * 100)` — elle **refuse Letter** :

```
215.9 * 100 = 21590            (entier)
279.4 * 100 = 27939.999999999996   (PAS entier)
355.6 * 100 = 35560            (entier)
431.8 * 100 = 43180            (entier)
```

Une hauteur de page normalisée sur quatre échoue au contrôle censé la protéger. Le lot n'écrit donc
**aucune contrainte de décimales** : la finitude et les deux bornes suffisent, et cette mesure est la
raison — pas un goût pour la permissivité. *À ne pas recopier :* la même formule apparaîtra tentante
en C5 pour une taille de police.

**Ce que la finitude coûte : rien, c'est déjà acquis.** **Mesuré** : `z.number()` refuse déjà
`Infinity` et `NaN` avec un `invalid_type`. Aucun `.finite()` n'est nécessaire. Réserve honnête à
verser à C8 : le message rendu pour l'infini est
`Invalid input: expected number, received number` — littéralement inexploitable pour un auteur. Ce
n'est pas un défaut de ce lot (il préexiste sur toutes les positions numériques du contrat), mais
c'est une ligne à donner à C8, et la donner est moins cher que de la laisser trouver.

**Pourquoi aucun champ `orientation`, alors que la roadmap le nomme.** Parce que la paire le dit
déjà : un A4 paysage est `{ width: 297, height: 210 }`. Un champ séparé serait une **seconde source
de vérité** sur le même fait, donc un invariant à faire respecter (`portrait ⇒ height ≥ width`) et un
refus de plus pour une incohérence qui ne devrait pas être exprimable. La roadmap énumère les notions
manquantes en prose, elle ne prescrit pas de champs : la **capacité** « décrire une page en paysage »
est livrée, entière. **C'est néanmoins une lecture, et elle est portée en arbitrage n° 3**
[§8] — parce qu'un relecteur de bonne foi peut estimer que « orientation » nomme un champ, et parce
que l'ajouter plus tard serait une estampille de plus. Le n° 3 n'est pas indépendant du n° 2 : l'option
« format nommé » du n° 2 apporte le champ, donc elle tranche le n° 3 sans le poser.

**Les deux bornes, et d'où elles viennent.** `MIN_SHEET_MM = 1` : une feuille de zéro millimètre n'a
pas d'aire imprimable, et `gt(0)` laisserait passer `0,0001` mm — une valeur qui n'est pas une
feuille. `MAX_SHEET_MM = 5080` = **200 pouces**, et c'est une **borne d'interopérabilité qu'Openview se
donne**, jamais une limite du format PDF.

> ⚠️ **La qualification de cette borne était fausse, et un relecteur externe l'a corrigée.** Une
> première rédaction écrivait « la plus grande page qu'un lecteur PDF est **tenu** de traiter ». Les
> 200 pouces sont le plafond historique de l'espace utilisateur par défaut — 14 400 unités à 1/72 de
> pouce — au-delà duquel Acrobat a longtemps refusé une page ; mais PDF 1.6 a introduit le facteur
> d'échelle `UserUnit`, qui rend des pages plus grandes **exprimables**. « Tenu de traiter » ne décrit
> donc aucune obligation générale du format. **Connaissance externe, non vérifiée dans ce dépôt** —
> aucun moteur n'existe, donc rien ici ne la confirme, et la sonde appartient à E1, qui devra
> l'éprouver **contre l'adaptateur réellement retenu** plutôt que contre une spécification.
>
> Ce que la borne protège est en revanche indépendant de sa valeur : sans plafond, `1e308` mm est un
> document valide dont le moteur calculera une aire imprimable infinie. C'est pour cela qu'elle reste,
> et qu'elle reste à 5 080 : une borne produit défendable, pas un fait rapporté.

**Écarté.** (a) **Format nommé seul** : Letter et A4 échappent à la question d'unité, mais chaque
format nouveau coûte une estampille, et un format non listé devient inexprimable — dans un produit
dont le hors-périmètre ne mentionne aucune restriction de papier. (b) **Union
`{ kind: 'named' } | { kind: 'custom' }`** : les deux coûts additionnés, deux formes à honorer dans
le moteur et dans le viewer, et C3 a déjà refusé ce motif exact — « une union à un seul membre habité
est exactement la cérémonie que la règle anti-sur-ingénierie nomme » (`c3, §2 D7`) ; ici les deux
membres seraient habités, mais le second rend le premier inutile. (c) **Millimètres entiers** :
mesuré ci-dessus, refuse Letter. (d) **Dixièmes de millimètre entiers** (`2159` pour Letter) : exact
pour tous les formats **et** entier — c'est la seule option écartée qui n'a pas de défaut technique.
Elle est écartée sur la lisibilité : le contrat est lu par un intégrateur et écrit, à terme, par une
interface pour non-développeur (D2 de l'éditeur), et `2159` n'est le nom de rien. *Signal de
réouverture :* une divergence mesurée entre l'aperçu et le PDF imputée à l'arrondi d'une longueur
fractionnaire. (e) **Points typographiques** (1/72 pouce) : exacts vers le PDF et homogènes avec les
tailles de police de C5, illisibles pour l'auteur d'un modèle (« marge de 57 points »). (f) **Pixels
CSS** : un pixel dans un contrat de papier est un contresens durable. (g) **Un objet
`{ value, unit }`** : deux modèles deviennent incomparables sans conversion, et le dépôt aurait deux
unités à honorer partout — la cérémonie que la règle anti-sur-ingénierie nomme. (h) **Marges et
formats nommés** (`étroite`, `normale`) : Openview décide alors des valeurs, c'est-à-dire une position
par défaut de fait, et une enveloppe à fenêtre ne se règle pas avec trois préréglages.

> ⚠️ **L'option (i) est la seule qui attaque le problème à la racine, et elle est écartée sur
> l'ergonomie seule — donc elle est portée en arbitrage.** Une **unité entière commensurable** — le
> pas de 1/914400 pouce d'OOXML, dit *EMU* — divise **exactement** le millimètre (36 000), le point
> (12 700), le pouce (914 400) et le pixel CSS (9 525). Toute longueur devient un **entier**, toute
> conversion devient une multiplication ou une division **exacte**, et le défaut mesuré qui porte
> [§2, D5] **disparaît** : il n'y a plus de `165.10000000000002`, parce qu'il n'y a plus de flottant.
> A4 vaut `7 560 000 × 10 692 000`, Letter `7 772 400 × 10 058 400` — exactement.
>
> Ce que cela coûte est réel et il ne faut pas le minimiser : **un document devient illisible pour un
> humain**. `{ width: 7560000, height: 10692000 }` dans un JSON n'est le nom de rien, et l'ergonomie du
> contrat dépendrait alors de fabriques (`millimetres(20)`) que rien n'oblige un intégrateur à utiliser
> — il peut écrire l'entier à la main, et se tromper d'un facteur mille sans qu'aucune borne ne le
> voie. Le choix est donc entre **un contrat lisible dont une soustraction se fait en un seul endroit**
> [§2, D5] et **un contrat exact que personne ne lit**. Ce plan recommande le premier ; **l'arbitrage
> n° 2 de la [§8] porte les deux**, et il est marqué ⛔ parce que l'option EMU réécrit [§3.1] à [§3.3]
> en entier.

**Irréversible** — forme stockée. Le tableau `STANDARD_SHEETS_MM`, lui, est **réversible à volonté** :
c'est du code, pas un document.

---

### D4 — Quatre marges, et l'invariant croisé **dans le schéma**, avec son garde

**Décision.** `margins: { top: number; right: number; bottom: number; left: number }`, en
millimètres, `>= 0`, plafonnées comme la feuille. Quatre champs **requis** : aucun raccourci, aucune
valeur par défaut, aucun héritage. Deux invariants croisés vivent dans un `superRefine` de
`PageSetupSchema` : les marges horizontales laissent une largeur imprimable **strictement
positive**, et les verticales une hauteur imprimable strictement positive. Le refinement porte un
**garde** qui sort tôt quand la feuille est elle-même invalide.

**Pourquoi l'invariant est dans le schéma, et pas dans une fonction de validation à part.** Parce que
`PageSetupSchema` est exporté par le barrel, et qu'un intégrateur qui valide sa page avant de la
stocker doit obtenir le même refus que `parseTemplate`. C'est le raisonnement de C3 pour
`checkTableWiring`, et il repose sur une propriété de zod qu'il faut re-vérifier à chaque position :
**MESURÉ**, un `superRefine` laisse un `ZodObject` — `pageRefined instanceof z.ZodObject` rend
`true`, `.shape` et `.extend` restent disponibles, et `TemplateSchema.extend({ page: pageRefined })`
reste lui-même un `ZodObject`. La composition est donc intacte : `z.infer`, `Pick<Template, …>` et
`TemplateSchema.parse` dans `migrate.ts:229` continuent de fonctionner.

**Les deux messages, et le chemin qu'ils désignent.** **MESURÉ**, sur le document candidat :

```
{"code":"custom","path":["page","margins"],"message":"Horizontal margins leave no printable width."}
{"code":"custom","path":["page","margins"],"message":"Vertical margins leave no printable height."}
```

Le chemin s'arrête à `page.margins` et **ne désigne pas un champ** : c'est délibéré, parce qu'aucun
des quatre n'est fautif isolément — c'est leur somme, rapportée à la feuille, qui ne tient pas.
Désigner `margins.left` accuserait un champ que l'auteur a peut-être écrit juste. Et les messages
sont **constants** : aucune interpolation du contenu du modèle, conformément à la règle de l'ADR 0003
(`:417`) que C3 a dû faire appliquer à trois de ses messages (`c3, en-tête, constat C-04`).

**Le garde, et la mesure qui le justifie.** Sans garde, une feuille de largeur `0` produit **deux**
issues au lieu d'une : le `too_small` de la largeur, **puis** le `custom` des marges horizontales —
parce que `30 >= 0` est vrai. **MESURÉ** : `2` issues sans le garde, `1` avec. La seconde est un
**dommage collatéral** de la première, et la promesse que C3 a faite à C8 est « un message à la fois,
jamais une cascade » (`c3, §9, hypothèse 2`). Le garde s'écrit
`if (!(width > 0 && height > 0)) return;` et il est **atteint** à chaque feuille de dimension
invalide, donc couvert par un `it` — jamais du code mort. C'est la transposition littérale du garde
`declared.size === 0` de C3, y compris dans sa forme de mesure (« 1 issue avec, 13 sans »).

**Et il faut dire ce que le garde ne rattrape pas, parce que la règle de zod est plus subtile qu'un
« les refus s'additionnent ».** **MESURÉ**, et cohérent avec l'hypothèse 2 du plan C3 : un refus
**abandonnant** saute le `superRefine`, un refus **continuable** le laisse tourner. Une marge
fractionnaire refusée par un `.int()` — donc un `invalid_type` — **masquerait** l'invariant croisé ;
une marge hors borne — un `too_small` ou `too_big` — ne le masque pas. La formule juste est celle de
C3 : *un refus de type masque le croisé, un refus de borne ne le masque pas.* Conséquence pratique
pour ce lot : comme D3 refuse toute contrainte de décimales, **aucun `invalid_type` n'est atteignable
sur une marge numérique** hors `NaN`, `Infinity` et une valeur non numérique — et l'invariant croisé
est donc rendu dans tous les cas qui comptent.

**Pourquoi quatre champs requis et pas de raccourci.** Un `margins: 20` scalaire, ou un
`margins: { vertical, horizontal }`, serait une seconde orthographe de la même donnée : deux formes
stockées pour un fait, donc deux chemins de refus, deux branches de migration, et un `printableAreaOf`
qui commence par normaliser. Le dépôt a déjà tranché ce genre de question dans le même sens — « une
seconde orthographe dériverait de la première » (`c3, §2 D13`).

**Pourquoi `>= 0` et non `> 0`.** Une marge nulle est un choix légitime (une étiquette à fond perdu,
un modèle qui gère lui-même sa gouttière), et **mesuré**, un document à quatre marges nulles est
accepté. Refuser zéro serait poser une règle de typographie, ce que D1 condition 2 interdit.

**Écarté.** (a) **L'invariant dans `parseTemplate` seul** : l'intégrateur qui valide
`PageSetupSchema` directement ne l'obtiendrait pas. (b) **Aucun invariant croisé** : une page dont les
marges dépassent la feuille est un document que le moteur ne peut pas rendre, et le laisser passer
reporte le refus au rendu — là où il n'y a plus de chemin Zod pour le dire, donc là où il faudrait un
code d'erreur [§2, D9]. (c) **Un invariant qui exige une aire imprimable *utile*** (« au moins
10 mm ») : c'est une règle de typographie, et 10 mm ne se justifie par aucune mesure. (d) **Des
marges nommées** : voir D3 (h). (e) **Une marge de reliure, des marges en vis-à-vis** : refusé en
[§2, D13], personne ne les demande.

**Irréversible** pour les quatre champs ; **réversible** pour les deux invariants — les retirer
n'invaliderait aucun document déjà écrit, alors que les ajouter plus tard serait un rétrécissement.
*Signal de réouverture :* aucun.

---

### D5 — L'aire imprimable est calculée **une fois**, dans `core`, et exportée

**Décision.** `core` exporte `printableAreaOf(page: PageSetup): PrintableArea`, avec
`PrintableArea = { readonly width: number; readonly height: number }`, en millimètres. Ce n'est pas
une forme stockée : c'est une **fonction**, la seule du lot, et la soustraction s'écrit **une** fois
dans le dépôt.

**Pourquoi une fonction dans un paquet qui ne produit rien.** Parce que le contraire est un accord
entre deux implémentations, et que le dépôt a déjà refusé exactement cela. La garantie de la
décision 7 est un aperçu **identique** au PDF ; le moteur et le viewer doivent donc obtenir la même
zone de texte à partir de la même page. Or `largeur - gauche - droite` n'est pas une opération
unique : `(w - l) - r` et `w - (l + r)` peuvent différer du dernier bit en IEEE-754, et deux auteurs
qui écrivent la soustraction chacun de leur côté n'écrivent pas la même formule. C3 a nommé ce
défaut en refusant une largeur mesurée sur le contenu, parce qu'elle « déplacerait la garantie
“identique au PDF” du **contrat** vers un **accord entre deux moteurs de mise en page** »
(`c3, §2 D13`). Exporter la fonction est la parade la moins chère : cinq lignes, un test, et l'accord
devient une **dépendance**.

**Ce n'est pas de la sur-ingénierie, et voici le test.** La règle anti-sur-ingénierie d'`AGENTS.md`
porte sur les **abstractions spéculatives** — un port sans second adaptateur, une fabrique sans
seconde implémentation. `printableAreaOf` n'abstrait rien : c'est un calcul concret, dont **deux**
consommateurs sont nommés dans la roadmap (le moteur en E1, le viewer en V1) et dont le troisième
existe déjà (le playground de [§6.3], qui dessine la page à l'échelle). Le précédent est écrit dans
le dépôt, et il est exactement de cette forme : `nodeReads` (`visitor.ts:210`) existe parce que
« *this primitive is what they can share, and sharing it is what keeps “a loop's children are read
under its alias” stated once: two copies of that rule are free to disagree* ».

**Ce que la fonction ne fait pas.** Elle ne rend ni origine, ni décalage, ni rectangle : `{ x, y }`
supposerait un système de coordonnées, donc une convention d'origine (coin haut-gauche ? unité ?
sens de l'axe vertical ?) que rien dans le contrat ne fixe et que C11 pourrait vouloir fixer
autrement. Deux nombres suffisent aux trois consommateurs nommés. Elle ne soustrait pas non plus la
hauteur des bandes : le contrat ne les mesure pas [§2, D8], et une aire imprimable qui prétendrait
tenir compte de l'en-tête serait fausse.

**Écarté.** (a) **Ne rien exporter** : chacun soustrait, et la garantie de la décision 7 repose sur
deux formules qu'aucun test ne compare. (b) **Un rectangle `{ x, y, width, height }`** : impose une
convention d'origine hors mandat. (c) **Des méthodes sur un objet page** : le contrat est de la
donnée plate, validée par Zod, et une classe rendrait `Template` non sérialisable — ce que
`parseTemplate` et l'aller-retour JSON interdisent. (d) **La calculer dans le moteur et la publier
dans son résultat de pagination** (lot E5) : trop tard pour le viewer, qui doit dessiner une page
avant qu'un moteur existe, et trop tard pour la démonstration de ce lot.

**Réversible** — c'est du code sans forme stockée. Retirer la fonction ne casse aucun document.


### D6 — Deux listes de bandes, **cinq** occurrences, et **une seule bande applicable par page**

**Décision.** `header: readonly PageBand[]` et `footer: readonly PageBand[]`, deux listes **requises**
et éventuellement vides. Une bande est `{ on: PageBandOccurrence; content: ContainerNode }` —
**deux** champs, pas trois : elle ne porte pas d'identifiant propre, parce que son conteneur en a un.
`PAGE_BAND_OCCURRENCES = ['every', 'firstOnly', 'exceptFirst', 'exceptLast', 'lastOnly']`, tuple fermé
de **cinq** membres. Un invariant refuse **deux bandes du même côté qui peuvent s'appliquer à la même
page** — ce qui inclut, mais dépasse, deux occurrences identiques.

L'ordre du tuple est l'ordre de **lecture d'un document** — tout, puis la paire du début, puis celle de
la fin — et il n'est pas indifférent : c'est celui que rendra le message de `z.enum`, donc celui qu'un
auteur lira dans son refus [§5.1, R12].

**Pourquoi une liste et non un champ unique.** Parce que le critère de recette demande deux choses à
la fois : « ce qui se répète en haut et en bas de **chaque** page » **et** « ce qui n'apparaît que sur
la **dernière** ». Un modèle réel veut les deux en bas : un pied courant, et un pied de dernière page
qui porte les mentions et le cadre de paiement (`engine.md:61`). Avec un `footer?: PageBand` unique il
faudrait deux champs (`footer` et `lastPageFooter`), puis un troisième le jour où la première page
diffère, puis un quatrième — c'est-à-dire une énumération de cas déguisée en champs. La liste porte
l'énumération **une** fois, dans un tuple fermé que C8 peut lire.

**Pourquoi `content: ContainerNode` et non `readonly BlockNode[]`.** Parce qu'une bande est un
**fragment de document**, exactement comme `Template.root` — qui est un `ContainerNode`
(`template.ts:102`). Le conteneur apporte trois choses gratuites : un `id` stable, donc une bande
adressable par une `Command` de l'éditeur (D2/D3 du designer) sans champ nouveau ; la compatibilité
immédiate avec **tous** les parcours existants (`walk`, `findNodeById`, `childrenOf`,
`collectDataPaths` acceptent déjà un `ContainerNode`) ; et l'héritage automatique de la coupure
`BlockNode` de C3 — **mesuré** : une `tableRow` nue dans le contenu d'une bande est refusée sur
`page.footer.0.content.children.1.type` avec « No matching discriminator », sans qu'une ligne de C4
s'en occupe.

**L'occurrence, et pourquoi exactement cinq valeurs.** `every` livre la première moitié du critère de
recette. `lastOnly` livre la seconde, **littéralement** — c'est le champ que la roadmap exige nommément.
`exceptLast` n'est pas une commodité : sans elle, un modèle qui veut un pied différent sur la dernière
page obtient les **deux** bandes sur cette page, puisque `every` inclut la dernière. Et
`firstOnly` / `exceptFirst` sont la même paire, à l'autre bout du document : le papier à en‑tête complet
en page 1, le rappel discret ensuite.

> 🗳️ **Les deux membres de première page entrent par décision du propriétaire du produit, 2026‑08‑18,
> arbitrage n° 6 tranché en B contre la recommandation de ce plan.** Le motif retenu est celui de
> l'objection la plus sérieuse du lot : `engine.md:59` exige de E3 « le **total reporté** de page en
> page », or un report est un montant **entrant**, donc imprimé en **haut**, et **il n'existe pas en
> page 1**. Sans `exceptFirst`, un modèle qui pose un report dans son en‑tête imprime « Report : 0,00 € »
> sur la première page — exactement l'anomalie qu'un comptable relève, alors que E3 est « prêt quand un
> utilisateur métier … ne relève aucune anomalie ». Ce plan recommandait d'attendre au motif que C4 ne
> livre **aucun marqueur de report** [§2, D7, écarté (i)] et que le lot qui livrerait le report
> livrerait l'occurrence ; la décision est de livrer l'occurrence maintenant, et **le marqueur de report
> reste hors du lot** — E3 trouvera la moitié du mécanisme en place, pas le tout.

**Les cinq valeurs forment un système à deux paires et un cas total :** `every` seul, ou la paire
`firstOnly` + `exceptFirst`, ou la paire `exceptLast` + `lastOnly`. **Et il n'existe aucune troisième
paire** — c'est un fait mesuré, pas une intention [§3.2] : sur les vingt‑cinq couples d'occurrences,
**deux seulement** sont compatibles, et comme elles ne partagent aucun membre, **un côté ne peut jamais
porter plus de deux bandes**. Mesuré aussi : `firstOnly` + `exceptFirst` + `lastOnly` est **refusé**, sur
la troisième bande.

**Ce que la paire de première page apporte que celle de dernière page n'a pas : elle est décidable sans
paginer.** La page 1 est connue avant la moindre mise en page, alors que « la dernière » ne se sait qu'à
la fin. Deux conséquences, et la seconde vaut d'être écrite dans l'ADR : la paire de première page
satisfait la condition 3 du critère d'appartenance [§2, D1] **plus** confortablement que `lastOnly`, et
elle **n'ajoute aucun risque d'oscillation** — l'attente adressée à E3 ci‑dessous ne porte que sur les
bandes de fin, et ce lot ne l'élargit pas.

**L'invariant est une DISJONCTION, pas une unicité — et une première rédaction de ce plan écrivait
l'un en croyant écrire l'autre.**

> ⚠️ **Le défaut, relevé par une contre-analyse externe, était réel.** Le paragraphe ci-dessus annonce
> un système fermé — `every` seul, ou `exceptLast` + `lastOnly` — mais l'invariant rédigé ne refusait
> que **deux occurrences identiques**. Il acceptait donc `every` + `lastOnly`, qui pose **deux bandes
> sur la dernière page**, et `every` + `exceptLast`, qui en pose **deux sur toutes les autres** : c'est
> précisément l'état ambigu que l'invariant existait pour supprimer, laissé exprimable par l'invariant
> lui-même. Un invariant qui ne couvre pas le cas de son propre motif ne protège rien ; il documente
> une intention.

**Ce que l'invariant refuse, énoncé sur les pages et non sur les valeurs :** deux bandes du même côté
dont les **domaines d'application se recoupent**. Avec cinq occurrences, les contenus admissibles d'un
côté sont exactement **huit**, et le compte est **mesuré** sur les trente‑et‑un cas de zéro, une et deux
bandes — dix acceptés, vingt‑et‑un refusés [§3.2] :

| Contenu d'un côté | Verdict | Pourquoi |
| :--- | :--- | :--- |
| `[]` | **accepté** | un modèle sans bande est légitime [§5.1, R19] |
| `[every]` | **accepté** | ce qui se répète sur **chaque** page |
| `[firstOnly]`, `[exceptFirst]`, `[exceptLast]`, `[lastOnly]` | **accepté** | une seule bande, aucun recoupement possible |
| `[firstOnly, exceptFirst]` | **accepté** | **partition** : page 1 d'un côté, le reste de l'autre — vraie à tout `n`, la seconde étant vide à `n = 1` |
| `[exceptLast, lastOnly]` | **accepté** | **partition** symétrique, la première étant vide à `n = 1` |
| `[every, *]` | **refusé** | `every` recoupe tout, par construction |
| `[firstOnly, exceptLast]` | **refusé** | dès deux pages, les deux tombent sur la page 1 |
| `[exceptFirst, lastOnly]` | **refusé** | dès deux pages, les deux tombent sur la dernière |
| `[exceptFirst, exceptLast]` | **refusé** | dès **trois** pages, les deux tombent sur les pages du milieu |
| `[firstOnly, lastOnly]` | **refusé** | sur un document d'**une** page, la première **est** la dernière |
| deux fois la même occurrence | **refusé** | cas dégénéré du même refus |

**La disjonction doit être DÉCLARÉE, pas calculée — et c'est la contrainte de conception à retenir.**
Le contrat ne connaît pas le nombre de pages : c'est le moteur qui le découvre [§0]. Un contrôle qui
intersecterait des ensembles de rangs supposerait donc un `n`, que le *save time* n'a pas. L'invariant
s'écrit ainsi comme une **table de compatibilité sur le tuple**, indépendante de `n` : deux occurrences
sont compatibles si et seulement si leurs domaines sont disjoints **pour tout** nombre de pages ≥ 1.
**Mesuré** — la table écrite à la main et la dérivation depuis les domaines de rangs coïncident sur les
vingt‑cinq couples, pour `n = 1` à `8` [§3.2]. Elle est aussi **symétrique**, et cette symétrie est
porteuse : sans elle, `[a, b]` et `[b, a]` ne rendraient pas le même verdict. Un `it` l'épingle [§6.2].

> ⚠️ **Le refus de `[firstOnly, lastOnly]` est le seul qui coûte une capacité réelle, et il faut
> l'écrire.** Sur un document de deux pages ou plus, « un en‑tête particulier en première page **et** un
> autre en dernière » est un besoin sensé, et ces deux domaines sont bien disjoints — **sauf sur un
> document d'une page**, où ils désignent la même feuille. Accepter la paire ferait donc dépendre la
> validité du **nombre de pages**, c'est‑à‑dire d'une information que le *save time* n'a pas : ce serait
> abandonner la condition 3 du critère d'appartenance [§2, D1] et rendre un document licite chez un
> client et ambigu chez un autre. Le refus est donc forcé par le critère, pas choisi.
>
> **Le contournement, et il est honnête :** placer l'une des deux bandes de l'autre côté de la feuille
> (un en‑tête de première page, un **pied** de dernière page), ou fusionner les deux intentions dans une
> `exceptFirst`. *Signal de réouverture :* un modèle livré qui a besoin des deux bouts du **même** côté —
> et le jour où il arrive, la réponse n'est pas d'assouplir l'invariant, c'est de décider ce que le
> contrat dit d'un document d'une seule page.

**Pourquoi refuser plutôt que définir l'empilement.** Définir l'empilement demanderait trois choses que
le contrat ne peut pas porter : un **ordre** (la bande la plus spécifique en premier ? la plus haute ?),
une **hauteur cumulée** — donc une mesure, que [§2, D8] refuse — et une règle de résolution qu'aucun
type n'exprime, donc que deux implémentations écriront différemment [§2, D6, écarté (d)]. Et le refus
**ne retire presque aucune capacité** : un pied courant sur toutes les pages *plus* une bande de dernière
page s'écrit `exceptLast` (le pied courant) + `lastOnly` (le pied courant enrichi), et un papier à
en‑tête *plus* un rappel s'écrit `firstOnly` + `exceptFirst`. Le contenu commun est recopié dans le
document, ce qui est le prix visible et assumé — la formule que C3 emploie pour son propre compte, « un
état de moins ». **Le mot « presque » désigne exactement un cas**, `[firstOnly, lastOnly]`, traité dans
l'encadré ci‑dessus.

**MESURÉ**, sur chacune des combinaisons refusées — le tableau complet des onze cas est en [§3.2] :

```
{"code":"custom","path":["page","footer",1,"on"],"message":"Two bands on the same side can apply to the same page."}
```

Le message est **constant** et il ne nomme pas l'occurrence fautive, pour la raison de l'ADR 0003 : une
charge d'erreur reste sûre à journaliser. Le chemin désigne la **seconde** bande, celle qui arrive en
trop, et le champ `on` plutôt que la bande entière : c'est là que l'auteur corrige. Et **mesuré** aussi :
ce `custom` et celui des marges [§2, D4] **coexistent** dans le même refus (deux issues, chacune sur son
chemin), parce que les deux sont continuables — la promesse « un message à la fois » porte sur les
**cascades**, pas sur deux fautes indépendantes.

**Ce que le contrat ne dit pas, et qui devient une attente envers E2 et E3.** Le contrat déclare
**où** une bande se place et **sur quelles pages**. Il ne dit ni comment le moteur la répète, ni ce
qu'il fait si elle ne tient pas. C'est la règle que C3 a apprise en retirant de ses propres
docstrings « *Repeated page after page by the engine* » (`c3, en-tête, constat C-01`) : écrire dans le contrat ce que
le moteur décidera est une faute, même quand c'est vrai. L'attente part donc dans la section
« Conséquences » de l'ADR 0006, et l'une d'elles doit y être écrite **explicitement**, parce qu'elle
n'est pas évidente et qu'elle décide de la convergence de la pagination :

> ⚠️ **Attente envers E3 : la hauteur réservée pour une bande ne doit pas dépendre de la bande
> effectivement dessinée.** Si le moteur réserve la hauteur de la bande `lastOnly` seulement sur la
> page qu'il croit dernière, il crée une boucle : une bande de dernière page plus haute que la
> courante réduit la zone de texte de cette page, ce qui peut renvoyer du contenu sur une page
> suivante, qui devient alors la dernière — et la page précédente doit reprendre le pied courant, ce
> qui lui rend de la place, ce qui rappelle le contenu. La pagination **oscille**, sans qu'aucune
> horloge ni aucun aléa ne soit en cause, et le déterminisme de E6 tombe sur un document
> parfaitement licite. La parade connue est de réserver, sur **chaque** page, la hauteur de la plus
> haute bande applicable de ce côté — donc de rendre la zone de texte indépendante du rang. Le
> contrat ne peut pas l'imposer (il ne mesure aucune hauteur, [§2, D8]) : il peut seulement l'écrire
> pour que E3 ne le redécouvre pas dans un PDF qui vacille.

**Deux pièges que le contrat autorise et que seul un test peut épingler — ils partent avec l'attente
ci-dessus.**

**(1) Sur un document d'une seule page, la dernière page EST la première.** Un modèle qui écrit un pied
`exceptLast` portant la numérotation et un pied `lastOnly` portant les mentions produit, sur une facture
d'**une** page, un document **sans numérotation** : le pied ordinaire n'est jamais rendu. Et E1 — « une
facture d'une page sort en PDF », jalon J2 — est exactement ce cas. **Le comportement est le bon** : la
page est la dernière, la bande de dernière page s'applique. Ce qui serait faux serait de le *refuser* :
ce serait une règle de mise en page, et le contrat n'en pose aucune. Ce qui est dû, c'est **un test qui
l'épingle** et une phrase dans la docstring de `PageBandOccurrence` [§6.2], pour que l'auteur du premier
modèle livré ne le découvre pas dans un PDF.

Le même piège existe **symétriquement** depuis que la paire de première page entre dans le lot :
`firstOnly` + `exceptFirst` sur une facture d'une page ne rend que la bande de **première** page, et
`exceptFirst` n'apparaît jamais. Là encore le comportement est le bon, et là encore il se paie d'un
test. **Et c'est le même fait qui force le refus de `[firstOnly, lastOnly]`** ci‑dessus : quand `n = 1`,
la première et la dernière page sont une seule feuille — c'est bénin quand un domaine est vide, ambigu
quand deux domaines se rejoignent.

**(2) Rien ne borne ce qu'une bande contient — et son contenu peut dépendre des données.**
`PageBand.content` est un `ContainerNode`, donc ses enfants sont l'union `BlockNode` entière : `loop` et
`table` compris. Un `loop invoice.lines as line` dans un en-tête est donc **accepté**, et sa hauteur
dépend du jeu de données. Ce lot ne le refuse pas, et il faut dire pourquoi plutôt que de le taire :
refuser demanderait un parcours récursif du contenu de chaque bande — le même coût que le confinement du
marqueur, écarté en [§2, D7] — et un en-tête qui répète deux ou trois références client est légitime.
**Le mode de défaillance réel est nommé et confié à E2/E3** : une bande dont la hauteur mesurée dépasse
la zone imprimable rend la pagination impossible — chaque page a une hauteur utile nulle ou négative —
et le moteur doit **refuser proprement** plutôt que boucler. Aucun champ du contrat ne peut l'attraper au
*save time*, puisque cela demande de mesurer. *Signal de réouverture :* le premier modèle livré dont un
en-tête porte une boucle.

**Ce que le critère de recette obtient de ce champ, et ce qu'il obtiendrait sans lui.** Il faut le
dire, parce que c'est le point où un lecteur pressé conclurait que `lastOnly` est inutile : du
**contenu** de fin de document — des mentions légales dans le flux — apparaît déjà « sur la dernière
page » sans aucun champ, simplement parce qu'il est écrit en dernier dans `root`. Ce que `lastOnly`
ajoute, c'est le cas où le contenu doit être **en bas** de la dernière page (un cadre de paiement
ancré au pied, `engine.md:61`) et non à la suite du flux, et le cas où le **pied lui-même** diffère.
Sans `lastOnly`, ces deux besoins sont inexprimables ; avec lui, ils sont déclarés. La roadmap
demande que le modèle « déclare » cela, et c'est cette déclaration-là.

**Écarté.** (a) **`header?: PageBand | undefined` + `lastPageFooter?: PageBand | undefined`** :
l'énumération des cas devient une liste de champs, et chaque cas nouveau est une estampille. (b) **Une
seule liste avec un champ `side: 'top' | 'bottom'`** : l'invariant de doublon devient un contrôle sur
deux dimensions, les deux listes disparaissent au profit d'un filtre, et le moteur doit trier pour
savoir ce qu'il dessine en haut. Deux listes disent la même chose et la disent structurellement. (c)
**Une occurrence exprimée par une `ConditionNode` autour du contenu** : élégant sur le papier, et
c'est le mécanisme qui exige que le numéro de page soit lisible par un prédicat — donc la porte du
point fixe grande ouverte [§2, D7]. Écarté pour cette raison, et pour elle seule. (d) **Un ordre
implicite (« la bande la plus spécifique gagne »)** : une règle de résolution non écrite dans le type,
donc une règle que deux implémentations écriront différemment. Le **recoupement** est refusé, il n'y a
donc rien à résoudre — et c'est la version corrigée de cet argument : tant que seul le doublon était
refusé, `every` + `lastOnly` laissait bel et bien une résolution à écrire. (e) **Une bande avec un `id`
propre** : le conteneur en a un ; un second identifiant serait deux noms pour une chose, et le premier
`findNodeById` qui en rencontrerait deux devrait choisir.

**Irréversible** pour les deux listes, pour le champ `on` et pour les **cinq** membres du tuple — un
membre retiré rendrait irrecevable un document qui l'emploie, ce qu'aucune migration ne rattrape. Le
tuple reste **élargissable** au prix d'une estampille, et l'élargir demande **aussi** d'étendre la table
de compatibilité ci‑dessus : coût de rédaction, jamais de migration, et **l'oubli est impossible à
compiler** — mesuré, `TS2741` [§5.2]. *Signal de réouverture :* une occurrence dont le domaine ne serait
ni « tout », ni un bord — les pages paires, une section — et ce jour‑là c'est la notion de **section**
qu'il faut trancher, pas un membre de tuple.

---

### D7 — La numérotation est un **segment marqueur**, jamais une expression

**Décision.** Un troisième membre de `TextSegment` :
`{ kind: 'pageField'; field: PageField }` avec `PAGE_FIELDS = ['number', 'count']`. Le contrat déclare
**où** le numéro s'imprime ; il ne le calcule pas, ne l'évalue pas, ne le formate pas. `core` ne gagne
**aucune** entrée d'évaluation, **aucun** kind d'expression, **aucun** nom réservé dans le jeu de
données.

« Page 2 / 4 » s'écrit donc dans un `TextNode` d'une bande :

```ts
content: [
  { kind: 'literal', text: 'Page ' },
  { kind: 'pageField', field: 'number' },
  { kind: 'literal', text: ' / ' },
  { kind: 'pageField', field: 'count' },
]
```

**Pourquoi ce sujet est le seul arbitrage réellement ouvert du lot.** La roadmap le nomme **deux
fois, des deux côtés de la frontière** : `core.md:177` met la « numérotation » dans le *pourquoi* de
C4, `engine.md:47` met « numéroter “page 2 / 4” » dans E2. Et le critère de recette de C4
(`core.md:181-182`) **ne la reprend pas** — de sorte qu'un lecteur de bonne foi peut livrer C4 sans
une ligne de numérotation et se croire conforme. La phrase qui devrait trancher, « elle décrit, elle
ne produit rien » (`core.md:283`), ne tranche que la moitié facile : elle interdit à `core` de
**calculer** le numéro, elle ne dit pas si `core` doit permettre de le **placer**. Ce plan tranche
qu'il doit, parce que `core.md:3-5` est plus fort que le silence : « Tout ce que le contrat ne sait
pas exprimer est impossible à rendre **et impossible à éditer** » — un numéro de page que le contrat
ne sait pas placer est un numéro que l'utilisateur de D2 ne pourra ni déplacer, ni traduire, ni
supprimer.

**Le critère qui départage les sept mécanismes, et il ne dépend d'aucun goût : le point fixe.**
Dès que le numéro de page devient lisible par un **prédicat**, le contenu peut dépendre de la
pagination, qui dépend du contenu. `if(eq(page.numero, page.total), mentions, rien)` change ce qui
tient sur la dernière page, donc peut changer le total, donc peut changer la condition. Il n'existe
aucune garantie de point fixe : le symptôme est une pagination qui **oscille** ou qui dépend d'un
nombre d'itérations arbitraire, c'est-à-dire un rendu non déterministe produit par un moteur qui ne
lit pourtant ni horloge ni aléa. E6 — « le même document, à chaque fois » — figure parmi les **quatre
choses qui ne se sacrifient jamais** (`docs/roadmap/README.md:167-170`). Un mécanisme qui ouvre cette
porte la met en cause pour un confort d'écriture.

| Mécanisme | Coût au contrat | Exige de l'évaluateur | Point fixe ? | Réserve un nom ? | Traduisible par C6 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A** — kind d'expression `pageNumber` | union élargie + estampille | **une troisième entrée** | **oui** | non | oui |
| **B** — kind de segment *(retenu)* | union élargie + estampille | **rien** | **non** | non | **oui, gratuitement** |
| **C** — nœud dédié `PageNumberNode` | union élargie + estampille | rien | non | non | non — c'est un bloc, pas de l'inline |
| **D** — clé réservée injectée (`page.numero`) | **zéro** | rien | non | **oui — interdit** | oui |
| **E** — portée enfant sous un alias déclaré | un champ + estampille | rien | **oui** | non | oui |
| **F** — rien dans le contrat (compteurs CSS) | zéro | rien | non | non | **non** |
| **G** — champ déclaratif `numbering: { pattern }` | un champ + estampille | un **parseur** | non | non | non — doublon de C6 |

**Pourquoi B, mécanisme par mécanisme.**

- **A, le kind d'expression, est le piège le plus séduisant.** Il rendrait `lastOnly` *dérivable* au
  lieu de déclaré, ce qui supprimerait un champ — un vrai gain. Il le paie trois fois : il élargit
  l'algèbre de 19 à 21 kinds, donc **toutes** les positions d'opérande ; il exige une troisième entrée
  à `evaluateExpression`, alors que `ports/render.ts:17` écrit « *There is no third field on purpose* »
  et que `scope.ts` écrit que le seul nom ajouté à la portée est « *an alias declared by the
  template … never one the engine invents* » — deux docstrings à réécrire pour dire le contraire de
  ce qu'elles promettent ; et il ouvre le point fixe. Accessoirement, il rendrait une expression
  **inévaluable hors d'un paginateur**, donc la barre de formule de D7 du designer devrait fabriquer
  un faux numéro pour afficher « le résultat en direct » (`designer.md:126`).
- **B ne demande rien à l'évaluateur, et le dépôt explique déjà pourquoi.** `ast/types.ts:25-26` :
  « *a segment is not a node — it is the inline content of one* ». Un segment n'est pas une expression :
  il est résolu par le pipeline de rendu, pas par `evaluateExpression`. La branche que B ajoute dans
  `SEGMENT_EXPRESSIONS` (`visitor.ts:167-172`) rend `[]` : **aucun chemin de données inventé**, donc
  `collectDataPaths` inchangé. Et le `const exhaustive: never` de `visitSegment` (`visitor.ts:152`)
  **force** la branche à exister : on ne peut pas ajouter le kind et oublier de le traiter.
- **B offre C6 gratuitement**, et c'est l'argument qui achève A et G. « Page », « / », « sur », « of »
  sont des `literal` du **même** `TextNode` : C6 se branche sur `TextNode.content` et sur rien
  d'autre, sans position de contenu nouvelle. C'est mot pour mot l'argument que C3 a écrit pour les
  libellés de son en-tête (`c3, §7`).
- **D est interdit, et c'est le seul mécanisme dont l'exclusion ne se discute pas.** Injecter
  `{ page: { numero, total } }` dans le scope coûte **zéro** au contrat — c'est ce qui le rend
  tentant. Il viole frontalement `AGENTS.md` (« Ne réservez aucun nom de champ »), il contredit
  `scope.ts` dans le code et non seulement dans un document, et il produit **deux défauts
  mesurables** : un intégrateur dont le jeu de données porte déjà `page` voit sa donnée masquée selon
  l'ordre du spread, et `collectDataPaths` **réclamerait `page.numero` à l'appelant** — le playground
  l'affiche à l'écran (`App.tsx:1110`), donc le défaut serait visible à la première démonstration.
- **E respecte l'interdiction de réserver un nom** (le modèle nomme l'alias, comme `LoopNode.as`) et
  ne demande rien à l'évaluateur : c'est le meilleur candidat après B. Il tombe sur le point fixe — un
  `compare` sur l'alias est immédiatement écrivable, sans qu'aucun champ ne l'autorise — et sur un
  quatrième site de masquage d'alias, que `collectDataPaths` ne filtrerait pas puisqu'il démarre avec
  un ensemble d'alias vide (`visitor.ts:308`).
- **F laisse tout au moteur.** Il tombe sur `core.md:3-5` (inéditable), sur la décision 11
  (multi-langue **dès le contrat**) pour ce libellé précis, et sur `viewer.md:35-39`, qui dit
  l'inverse — « le viewer affiche la découpe que le moteur lui donne ». Il faut noter honnêtement le
  seul texte du dépôt qui le soutient : l'ADR 0002, sous-décision 4, écrit que « la numérotation se
  traite souvent en CSS côté rendu » — mais il parle des **lignes** d'une boucle, pas des pages, et
  C4 apporte l'élément nouveau qui manquait pour rouvrir cet arbitrage : une page n'est pas une ligne.
- **G est un parseur déguisé.** `pattern: 'Page {n} / {total}'` réintroduit exactement ce que
  l'ADR 0001 a fermé et que `expression/types.ts:4-7` écrit comme une propriété du dépôt : « *An expression is a
  validated tree, **never a string to parse** … There is no parser, so there is no injection
  surface* ». Sous forme d'énumération fermée (`'n/total'`), il devient **intraduisible** et
  collisionne avec C6.

> ⚠️ **Le dépôt écrit aujourd'hui le contraire, dans une docstring PUBLIÉE, et il faut le traiter de
> front.** `packages/core/src/ast/types.ts:325`, livré par C3, énumère ce qu'un `TableNode` ne porte
> pas et **à qui chaque chose appartient** : « *No “repeat the header on every page”, no widow or orphan
> policy, **no page numbering**, no carry-forward (**lots E2 and E3**)* ». Une phrase du code attribue
> donc la numérotation au **moteur**, et elle est opposable telle quelle.
>
> **Elle n'est pas fausse, et ce plan ne la contredit pas — il la précise.** Ce que C3 refusait, c'est
> qu'un *tableau* porte une numérotation, et ce que la parenthèse nomme, c'est qui **produit la
> valeur** : E2 la calcule, et rien dans ce lot ne la calcule. Mais la phrase, lue littéralement, dit
> « pas de numérotation dans `core` » — et un relecteur de bonne foi peut l'opposer à D7.
>
> **Deux gestes en découlent, et aucun n'est optionnel.** (1) L'arbitrage n° 1 de la [§8] est
> **réellement ouvert** : ce n'est pas une formalité, c'est une phrase du dépôt à confirmer ou à
> renverser, et l'ADR 0006 doit le faire **par écrit** — un plan qui renverse la consigne d'un lot
> antérieur le fait explicitement ou pas du tout, comme C3 a dû l'écrire pour `errors.ts`. (2) Si
> l'arbitrage est tranché en A, **cette docstring devient trompeuse et se corrige dans le même
> incrément** — c'est le geste que C2 a fait pour `limits.ts` et C3 pour `guard.ts` : la liste doit
> distinguer la **valeur** (E2, E3) de l'**emplacement** (C4, un segment marqueur). La ligne à écrire
> est en [§3.5], et le critère de sortie d'INC‑2 l'épingle.

**Ce que B coûte, écrit sans l'atténuer.** Trois choses. **(1)** Une union stockée élargie, donc
l'estampille [§2, D11] — **mesuré**, un build antérieur devant un `pageField` rend
`{"code":"invalid_union","path":["page","footer",0,"content","children",0,"content",1,"kind"],"message":"Invalid input"}`,
c'est-à-dire le « refus illisible » que l'estampille convertit en instruction. **(2)** Une
**troisième nature** de contenu inline : littéral, liaison, et maintenant marqueur. C'est le seul
reproche doctrinal formulable, et il est réel — le lecteur de `TextSegment` doit désormais savoir que
tout segment n'est pas résoluble à partir des données. **(3)** Une conséquence de mise en page que le
contrat ne peut pas traiter : la largeur de « 2 » n'est pas celle de « 10 », donc un pied peut changer
de hauteur entre la page 9 et la page 10. C'est un cas pathologique réel, il appartient au moteur, et
il rejoint l'attente écrite en [§2, D6].

**Pourquoi `field: 'number' | 'count'` et non deux kinds.** Parce que c'est l'idiome du dépôt : un
kind nomme une **nature**, un champ fermé nomme l'**instance** — `arithmetic` porte `op`, `aggregate`
porte `op`, `textCase` porte `op`, `round` porte `mode`. Deux kinds diraient qu'un numéro et un
compte sont deux natures de contenu ; ils sont la même — un fait que seul le paginateur connaît — et
le tuple `PAGE_FIELDS` laisse à un lot ultérieur la possibilité d'en ajouter un troisième sans
ajouter un membre d'union. **Mesuré**, une valeur inconnue est refusée par le message d'énumération
habituel : `Invalid option: expected one of "number"|"count"`.

**Pourquoi le marqueur est licite PARTOUT, et pas seulement dans une bande.** Le restreindre exigerait
de connaître les **ancêtres** d'un segment, ce qu'aucun schéma Zod local ne peut faire : il faudrait
un contrôle au niveau du `Template`, donc un parcours de l'arbre au *save time*, donc un refus qui
n'est pas décidable localement — et ce serait la **première règle positionnelle** du contrat. Pour
quel gain ? Imprimer « page 3 » dans le flux d'un document paginé est licite et utile. Le contrat
l'autorise, et l'attente envers le moteur est écrite : il substitue le numéro de la page **où le
segment atterrit**.

**Écarté.** (a) À (g) : les six mécanismes du tableau, chacun avec l'argument ci-dessus. (h) **Ne rien
livrer et laisser E2 inventer l'emplacement** : c'est l'option que le silence du critère de recette
rend possible, et elle est refusée par `core.md:3-5` — un numéro inéditable. (i) **Livrer aussi un
marqueur de report de page** (« report : 12 480,00 € ») : le report appelle **le même** mécanisme, et
c'est précisément pourquoi il n'est pas livré ici — sa **valeur** est un montant, donc une échelle et
un arrondi, donc l'ADR 0004 décision 12, et son libellé est C6. Le refuser maintenant coûte une
estampille plus tard ; le livrer maintenant coûterait une décision d'arrondi prise en passant.
*Signal de réouverture :* le lot E3, quand il aura besoin de placer un report — et le mécanisme sera
déjà là, en un `field` de plus. (j) **Confiner le marqueur aux bandes**, par un `superRefine` de niveau
`Template` : l'idée est défendable — un numéro de page au milieu d'un paragraphe est probablement une
erreur d'auteur — et elle est écartée sur son **coût mesuré**. Il faut un parcours complet du Composite
qui rende un **chemin** et non un booléen (pour que C8 puisse désigner le segment fautif), donc une
fonction d'une soixantaine de lignes descendant par `visitNode` champ par champ — `childrenOf` ne
convient pas, il aplatit le champ sous lequel un enfant était rangé, donc le chemin ne désignerait
rien. Cela ajoute **un parcours d'AST**, un refus, et une règle **positionnelle** que le contrat n'a
nulle part ailleurs. Et le confinement obtenu ne serait pas une propriété du **type** mais d'un **point
d'entrée** : `TextNodeSchema` seul continuerait d'accepter le marqueur, donc l'intégrateur qui valide un
bloc isolé ne verrait rien. *Signal de réouverture :* un modèle livré où un marqueur s'est glissé dans
le flux et a été imprimé au milieu d'une phrase.

**Irréversible** — forme stockée. Le tuple `PAGE_FIELDS` est élargissable au prix d'une estampille.

---

### D8 — Aucune hauteur de bande, aucune politique de coupe, aucun saut de page

**Décision.** Le contrat ne déclare **ni** la hauteur d'une bande, **ni** la réserve verticale qu'elle
consomme, **ni** un saut de page, **ni** l'insécabilité d'un bloc, **ni** une politique de veuve ou
d'orpheline. Aucun de ces cinq champs n'existe après C4.

**Pourquoi aucune hauteur, alors que le moteur en a besoin : parce que le contrat n'en déclare nulle
part.** C'est l'argument décisif, et il est vérifiable : **aucun nœud du contrat ne porte de
dimension**. Un `TextNode` n'a pas de hauteur, un `ContainerNode` non plus, une `TableColumn` porte un
**poids** sans dénominateur et « la largeur du tableau lui-même n'est pas déclarée par C3 »
(`c3, en-tête, constat C-02`). La hauteur de tout bloc est donc déjà mesurée par le moteur de mise en page. Introduire
une hauteur pour la seule bande de page ne serait pas la continuation de ce que fait le dépôt, ce
serait une **exception** — et elle créerait une classe de faute que rien ne peut trancher : une
hauteur déclarée trop petite pour son contenu. Que fait le moteur alors ? Il coupe, il déborde, ou il
refuse : trois politiques, aucune dans le contrat, et le champ n'aurait servi qu'à créer le
désaccord.

**Ce que ce refus coûte, dit franchement.** Il laisse à E2 et E3 la mesure des bandes, donc il laisse
la garantie de la décision 7 dépendre du fait que l'aperçu et le PDF mesurent la même chose. Ce n'est
pas une dette que C4 crée : c'est celle que le contrat porte **déjà** pour tous les blocs, et V3 est
le lot qui la vérifie (`viewer.md:71-85`). La seule chose que C4 doit à E3 sur ce point est écrite en
[§2, D6] : réserver la hauteur de la plus haute bande applicable, pour que la zone de texte ne dépende
pas du rang de la page.

> ⚠️ **Et il faut reconnaître une seconde boucle, que ce lot ouvre lui-même en refusant la hauteur
> déclarée.** Le marqueur de numéro [§2, D7] est substitué **par page** : « 9 » et « 10 » n'ont pas la
> même largeur, donc un pied peut passer d'une ligne à deux entre la page 9 et la page 10, donc la
> hauteur utile de cette page change, donc la pagination peut changer — et le nombre total de pages
> avec elle. C'est exactement la forme de boucle que [§2, D7] revendique d'avoir fermée en refusant un
> numéro lisible par un prédicat, et elle se rouvre par la **largeur du glyphe** au lieu de la logique.
> **Trois choses à dire, et aucune n'est un renoncement.** (1) Elle est **d'une autre nature** : elle
> ne dépend d'aucune écriture de l'auteur, elle est bornée — le nombre de pages ne change que si un
> pied déborde d'une ligne — et elle n'a pas de point fixe à chercher dans un espace de conditions,
> seulement une hauteur à réserver. (2) Elle **appartient au moteur**, comme toute mesure de contenu :
> le contrat ne mesure aucune hauteur, ici pas plus qu'ailleurs. (3) La **parade est déjà écrite** et
> c'est la même qu'en [§2, D6] — réserver, sur chaque page, la hauteur de la plus haute bande
> applicable, en tenant compte du plus large numéro possible. L'attente envers E3 gagne donc ce membre
> de phrase, et l'ADR 0006 la porte : *le contrat ne permet pas de calculer cette réserve, il oblige à
> la prendre*.

**Pourquoi aucun saut de page.** Il passe les conditions 1 et 2 de D1 — un saut ne se dit que par
rapport à une page, et l'auteur le décide — et il échoue à la 3 : il n'est pas décidable sans
pagination, puisque son effet **est** la pagination. Il tombe par ailleurs sous le refus que C3 a déjà
écrit nommément, `pageBreakBefore` (`c3, §2 D13`). Et il est le premier candidat au « c'est peu de code »,
donc le premier à écrire ici. *Signal de réouverture :* un modèle livré dont une annexe doit
commencer sur une page neuve — et le champ sera alors un membre de C7 ou un lot à lui, jamais un ajout
discret à `PageSetup`.

**Pourquoi l'insécabilité n'est pas dans ce lot alors qu'elle en dépend.** `core.md:223` :
« **C7 — Poids : S — Dépend de : C4** ». C7 est **après**. Livrer `keepTogether` ici préempterait le
seul lot que C4 débloque, exactement comme C3 s'est retenu de le faire (`c3, §1`). Le lot suivant
a besoin de trouver sa place vide.

**Écarté.** (a) **Une hauteur de bande optionnelle** : un champ optionnel sur une forme stockée est le
cas « perte silencieuse » de `template.ts:31-34`, pour un champ dont le moteur n'a pas besoin. (b)
**Une réserve exprimée en lignes de texte** : une ligne de texte n'a de hauteur qu'avec une police,
donc C5, donc une métrique de police, donc une lecture de la machine — refusée et outillée. (c)
**`avoidBreak: boolean` sur une bande** : une bande ne se coupe pas, la question ne se pose pas pour
elle ; pour un bloc du flux, c'est C7.

**Réversible** — ce sont des champs non écrits.

---

### D9 — **Zéro** code d'erreur nouveau, **zéro** site nouveau

**Décision.** `OPERAND_ERROR_CODES` (neuf entrées, `errors.ts:32-42`), `LIMIT_ERROR_CODES` (quatre,
`:52-57`), `SHAPE_ERROR_CODES` (trois, `:215`) et `ExpressionErrorSite` (`:80`) sortent du lot
**octet pour octet**. `EXPRESSION_ERROR_CODES` reste à **treize** entrées. `errors.ts` **n'est pas
modifié par C4** — pas même d'une ligne de type, contrairement à C3.

**Pourquoi c'est possible : les dix-neuf fautes du lot sont décidables au save time.** C'est la
condition 3 du critère d'appartenance [§2, D1], et elle a été écrite pour obtenir ce résultat. Le
[§5.1] mesure les refus un par un ; ils se répartissent ainsi : une page absente ; six sur les
dimensions de la feuille (absente, nulle, hors borne, `NaN`, infinie, non numérique) ; quatre sur les
marges (négative, hors borne, somme horizontale, somme verticale) ; trois sur les bandes (occurrence
inconnue, doublon d'occurrence, contenu qui n'est pas un conteneur) ; deux héritées de C3 sans une
ligne de code (une `tableRow` nue dans une bande, un nœud inconnu) ; une sur le marqueur (`field`
inconnu) ; deux sur la forme (trop profond, trop de valeurs) rendues par le garde existant. **Aucune
n'a besoin d'un jeu de données, aucune n'a besoin de savoir combien de pages sortiront.**

**Pourquoi aucun site, alors que C3 en a ajouté un.** Un `ExpressionErrorSite` existe pour nommer une
**position qui porte une expression sans en être une** — `LoopNode.each`, `ConditionNode.when`,
`TableRowGroupNode.each`. `PageSetup` n'en porte aucune : la feuille et les marges sont des nombres,
l'occurrence est une énumération, et le contenu d'une bande est un `ContainerNode` dont les
expressions internes sont déjà couvertes par les sites existants — une condition dans un pied de page
échoue au site `condition`, ce qui est exact. Et le marqueur de numéro n'est pas une expression
[§2, D7] : il ne s'évalue pas, donc il n'échoue pas.

**Ce que cela donne à C8, et pourquoi c'est mieux qu'un message de plus.** C3 a écrit la formule :
« non pas un message de plus, mais **un état de moins** » (`c3, §2 D13`). C4 la répète et ajoute la
seule chose qu'un lot puisse offrir de mieux : **il ne touche pas `errors.ts`**, donc il ne rejoue pas
la discussion que C3 a dû tenir pour justifier de l'ouvrir (`c3, §2 D10`). La consigne que C3 écrit
pour lui-même — « `errors.ts` : une ligne de type et une docstring, rien d'autre » — devient pour C4 :
**rien du tout**.

**Une réserve à écrire, parce qu'elle est réelle et qu'elle n'est pas de ce lot.** Deux messages que
le lot fait apparaître sont mauvais, et aucun ne vient de C4 : `Invalid input: expected number,
received number` pour une dimension infinie [§2, D3], et la cascade de **deux** issues pour un
contenu de bande qui n'est pas un conteneur — **mesuré** :
`invalid_value` sur `page.footer.0.content.type` **et** `invalid_type` sur
`page.footer.0.content.children`, parce que `ContainerNodeSchema` est un objet et non une union
discriminée. Les deux sont des propriétés de zod et du contrat existant ; les corriger serait un
travail de C8, sur un périmètre qui dépasse la page. Ils sont écrits ici pour que C8 les trouve.

**Écarté.** (a) **Un code `page-geometry` pour l'invariant croisé** : la faute est refusée par Zod au
save time, avec un chemin et un message constants ; un code de rendu n'existerait que pour un arbre
construit à la main et jamais chargé par `parseTemplate` — lectorat que l'ADR 0004 décision 6 a déjà
écarté nommément. (b) **Un site `page`** : rien dans `PageSetup` n'évalue une expression. (c) **Un
code `no-page-context`** pour un marqueur rendu hors pagination : il n'existerait que si le marqueur
était une expression, et il ne l'est pas — c'est l'un des bénéfices de D7 qu'il faut compter.

**Sans objet** en réversibilité : rien n'est ajouté.


### D10 — `collectTemplateDataPaths` : la promesse « le modèle dit ce qu'il lit » couvre les bandes

**Décision.** `core` exporte `collectTemplateDataPaths(template: Template): readonly string[]`, qui
réunit les chemins lus par `template.root` **et** par le contenu de chaque bande. `collectDataPaths`
n'est **pas** modifié : sa signature, son comportement et sa docstring restent intacts.

**Pourquoi c'est obligatoire, et pas une commodité.** Parce que sans cette fonction, C4 **casse une
promesse écrite**, en silence. `ports/render.ts:9-15` dit que le jeu de données appartient à
l'appelant et que « *`collectDataPaths` tells the caller which ones* » ; `template.ts:89-93` dit qu'un
`Template` enregistre ce qu'il **lit**, et que « *`collectDataPaths` recovers exactly that* ». Après
D2, les bandes vivent hors de `root` : un `{ kind: 'binding', value: { kind: 'path', path:
'client.nom' } }` dans un en-tête devient **invisible** pour toute analyse. Le symptôme n'est pas une
erreur, c'est un blanc dans le document : l'appelant, à qui l'on avait dit de fournir
`facture.numero`, ne fournit pas `client.nom`, et l'en-tête s'imprime vide.

**Et le défaut est déjà visible dans le dépôt, à une ligne près.** `apps/playground/src/App.tsx:486`
appelle `collectDataPaths(sampleTemplate.root)` et **affiche la liste à l'écran**
(`App.tsx:1110`). Après C4, cet écran dirait au visiteur « voici ce que ce modèle lit » en omettant
l'en-tête. C'est le meilleur banc d'essai que ce lot possède, et c'est aussi pourquoi la
démonstration du [§6.3] n'est pas décorative : elle est le seul endroit où l'oubli se **voit**.

**Pourquoi une fonction nouvelle et pas une signature élargie.** Trois options existaient :

- **Élargir `collectDataPaths` à `DocumentNode | Template`** : une union en entrée oblige à
  discriminer un `Template` d'un `ContainerNode` à l'exécution — les deux sont des objets — donc à
  tester une propriété (`'root' in value`), c'est-à-dire à écrire un contrôle de forme dans une
  fonction d'analyse. Et la fonction la plus regardée du paquet changerait de contrat pour tous ses
  appelants actuels.
- **Semer l'ensemble d'alias depuis l'extérieur** : ne résout rien, le problème n'est pas la portée
  mais le **périmètre du parcours**.
- **Une fonction de niveau document** *(retenu)* : `collectDataPaths` garde son contrat de nœud,
  `collectTemplateDataPaths` porte le contrat de document. Le nom dit lequel des deux on appelle, et
  la seconde est écrite en trois lignes au-dessus de la première — aucune logique dupliquée, donc
  aucune règle de portée en double.

**Ce que la fonction ne fait pas, et il faut l'écrire pour ne pas rejouer le défaut que l'ADR 0002
reproche à une ancienne docstring — *elle promettait, et elle mentait*.** Elle **dé-duplique** entre
les bandes et le flux : un `facture.numero` lu dans l'en-tête et dans le corps sort une fois, comme
`collectDataPaths` le fait déjà pour deux blocs du flux. Elle n'ordonne rien de garanti au-delà de
« ordre de parcours », et le parcours retenu est **`root` d'abord, puis `header`, puis `footer`** —
écrit ici parce qu'un test qui compare une liste ordonnée épingle un choix, et qu'un choix non écrit
se change par accident. Elle hérite des **trois limites** que `visitor.ts:271-306` consigne déjà (un
champ d'item invisible, un alias qui masque une clé de l'appelant, un alias lié dans une expression) :
C4 n'en corrige aucune et n'en ajoute aucune. Et elle ne rend **rien** pour un marqueur de numéro de
page, parce que la branche que D7 ajoute à `SEGMENT_EXPRESSIONS` rend `[]` — c'est exactement ce qu'on
veut, et c'est l'un des trois arguments qui écartent le mécanisme de la clé réservée [§2, D7].

> ⚠️ **Un second trou s'ouvre avec les bandes, il n'est pas celui-ci, et C4 ne le referme pas :
> l'unicité des identifiants de nœud.** Jusqu'ici un modèle avait **une** racine, `root`, et
> `findNodeById(root, id)` voyait tout. Avec les bandes, un document a **une racine par bande, plus
> `root`** : deux nœuds de deux bandes différentes peuvent porter le même `id` sans qu'aucun schéma ne
> s'en plaigne, et `findNodeById(template.root, id)` ne trouvera jamais un nœud d'en-tête. Aucune règle
> d'unicité n'est ajoutée, et le motif est **mécanique plutôt que doctrinal** : une règle d'unicité
> inter-racines devrait vivre dans un `superRefine` de niveau `Template`, et la migration de [§2, D11]
> écrit des bandes **vides** — donc aucun identifiant — mais le jour où une migration ultérieure
> injecterait une bande garnie, elle produirait un document que son propre parse pourrait refuser. La
> limite est donc **écrite** ici et dans l'ADR, et son *signal de réouverture* est daté : le jour où
> l'éditeur adresse un nœud par identifiant à travers tout le modèle (D2/D3 du designer), il lui faudra
> soit un `findNodeInTemplate`, soit cette règle d'unicité — et ce sera un lot de designer, pas un
> rattrapage de C4.

**Écarté.** (a) **Ne rien livrer et documenter le trou** : c'est l'option la moins chère, et elle est
refusée parce que la promesse est écrite dans **deux** fichiers de production et affichée dans le
playground. (a′) **Exporter la LISTE des racines** (`documentRootsOf(template): readonly ContainerNode[]`)
plutôt qu'un collecteur : l'idée est meilleure sur un point et perd sur un autre. Elle rendrait toute
traversée future complète **par construction** — un lot qui écrirait `findNodeInTemplate` ou un
validateur d'ids n'aurait pas à réénumérer les racines, et l'oubli d'une racine deviendrait impossible
au lieu d'être invisible. Elle est écartée parce que **personne ne l'appelle aujourd'hui** : elle ne
sert que des lots non écrits, et la règle anti‑sur‑ingénierie s'applique littéralement. *Signal de
réouverture, et il est proche :* le **deuxième** consommateur — le premier `findNodeInTemplate`, ou le
validateur d'unicité ci-dessus. Ce jour-là, `collectTemplateDataPaths` se réécrit **au-dessus** de
`documentRootsOf`, et c'est trois lignes. Un trou documenté qui contredit une docstring existante n'est pas de la transparence,
c'est deux textes qui se contredisent. (b) **Livrer aussi un `findNodeInTemplate`** : personne ne
l'appelle. Le designer en aura besoin (D1/D2 : « un clic sur le total », « remplacer le logo » — et le
logo est dans l'en-tête), mais le designer est une coquille vide, et la règle anti-sur-ingénierie
d'`AGENTS.md` s'applique littéralement. Le manque est **nommé** en [§7] avec son propriétaire, ce qui
est la forme correcte : un besoin daté, pas une abstraction spéculative. (c) **Faire de
`collectTemplateDataPaths` la seule fonction exportée et masquer `collectDataPaths`** : l'éditeur
analysera des fragments (un bloc sélectionné, une bande en cours d'édition), donc les deux ont un
appelant.

**Réversible** — c'est du code sans forme stockée.

---

### D11 — `CURRENT_SCHEMA_VERSION` passe à **5**, et c'est la **première migration transformante** du dépôt

**Décision.** `CURRENT_SCHEMA_VERSION = 5`. L'entrée `{ from: 4, to: 5 }` est **ajoutée** à
`TEMPLATE_MIGRATIONS`, jamais fusionnée avec les trois précédentes, et son `migrate` **transforme** :
il écrit une page de compatibilité sur tout document qui n'en a pas, puis estampille. La docstring de
`CURRENT_SCHEMA_VERSION` gagne sa section « ## What version 5 means ». Estampille posée **une seule
fois**, en INC-4, après la dernière forme persistée du lot ; tout commit C4 antérieur est déclaré
**non publiable**.

```ts
{
  from: 4,
  to: 5,
  migrate: (input) => ({
    ...input,
    page: 'page' in input ? input.page : COMPATIBILITY_PAGE,
    schemaVersion: 5,
  }),
}
```

**Deux formes stockées changent, dans les deux directions, et une seule estampille les couvre.**
Vers le large : `TextSegment` accueille `pageField` — **mesuré**, un build v4 rend `invalid_union` /
« No matching discriminator » sur `root.children.0.content.1.kind`, un chemin qui désigne un `kind`
correctement orthographié. Vers l'étroit : `Template` exige `page` — **mesuré**, un build v4 ignore le
champ et le **supprime** sans une issue. Le second cas est le plus dangereux des deux, parce qu'il est
**silencieux** : un éditeur qui ouvre puis enregistre efface la page. Une version, deux directions, un
numéro — la formule est celle de C3 (`c3, §2 D11`), et elle vaut ici pour des raisons différentes.

> ⚠️ **Le chemin de démonstration doit être dans `root`, et une première rédaction de ce plan le
> plaçait sous `page.footer…` — c'était impossible.** Une contre-analyse externe l'a relevé, et la
> mesure a été **rejouée** contre le build du dépôt (`packages/core/dist`,
> `CURRENT_SCHEMA_VERSION = 4`, `zod@3.25.76` via `zod/v4`) :
>
> | Où le marqueur est écrit | Ce que le build v4 rend, mesuré |
> | :--- | :--- |
> | sous `page.footer.0.content…` | **accepté**, `success = true`, clés de sortie `schemaVersion,id,name,version,root` |
> | sous `root.children.0.content.1` | `invalid_union`, chemin `root.children.0.content.1.kind`, note `No matching discriminator`, message `Invalid input` |
>
> **La raison est celle de la ligne d'à côté :** un `z.object` v4 ne connaît pas la clé `page`, donc il
> la **supprime sans regarder dedans**. Rien de ce qui vit sous `page` n'est validé par un build
> antérieur, donc rien de ce qui vit sous `page` ne peut produire d'issue. Les deux affirmations de ce
> plan se contredisaient : [§5.1, R24] mesurait déjà la suppression silencieuse.
>
> **Et l'erreur n'affaiblit pas l'argument, elle le durcit.** Le marqueur est licite **partout** où un
> `TextNode` existe, `root` compris — le confinement aux seules bandes est écarté en [§2, D7]. Donc
> l'élargissement est bien détectable par un build antérieur, à l'endroit où les modèles réels
> l'écriront le plus souvent ; et là où il ne l'est pas — sous `page` — c'est parce que la **seconde**
> incompatibilité, silencieuse, l'a déjà avalé. Deux directions, un numéro : l'estampille est ce qui
> convertit les deux en un message.

**Pourquoi la migration transforme, alors que les trois précédentes se contentent d'estampiller.**
Parce que `page` est **requis** [§2, D2] et qu'une migration identité laisserait tout document v4
irrecevable — **mesuré** : `invalid_type` sur le chemin `page`,
`Invalid input: expected object, received undefined`. Ce serait un **rétrécissement** réel, le
cinquième de la liste que porte l'hypothèse pré-v1.0, et le premier qui ne soit pas vide en extension :
les quatre existants refusent des valeurs qu'aucun document ne pouvait porter, celui-ci refuserait
**tous** les documents v4. La migration transformante supprime le rétrécissement : après elle, aucun
document valide ne devient invalide, et C4 **n'ajoute aucune borne à cette liste**.

**Ce que la migration écrit, et pourquoi c'est assumé plutôt que caché.**
`COMPATIBILITY_PAGE = { sheet: { width: 210, height: 297 }, margins: { top: 20, right: 20, bottom: 20,
left: 20 }, header: [], footer: [] }` — un A4 portrait à marges de 20 mm, sans bande. **Openview
choisit donc une feuille**, une fois, pour des documents écrits avant que la question existe. Il faut
le dire dans ces termes, parce que trois choses en dépendent :

1. **Ce n'est pas une lecture de l'environnement — mais c'est un défaut culturel, et aucun outil ne le
   verra.** A4 est une **constante** du code : ni locale, ni fuseau, ni horloge, donc le plugin
   `no-environment-read` est muet et il a raison de l'être — un défaut assumé est déterministe, une
   adaptation ne l'est pas (`docs/roadmap/README.md:127`). Il faut néanmoins concéder l'autre moitié :
   **A4 est le format d'une partie du monde**, et l'écrire dans une migration est une **locale
   déguisée en constante**. C'est précisément la raison pour laquelle ce choix ne doit pas être
   *déduit* d'un plan, mais **argumenté dans l'ADR et confirmé par le propriétaire du produit** — c'est
   l'arbitrage n° 4 de la [§8], et son option C existe pour cela. Un lot qui écrirait A4 sans le dire
   ferait passer une décision de produit pour un détail d'implémentation.
2. **Ce n'est pas un défaut de schéma.** La différence est mesurable, et elle est le cœur de D2 : un
   `z.default()` réécrit le document **à chaque parse**, en silence, pour toujours ; la migration
   l'écrit **une fois**, sur un document estampillé 4, et le résultat est visible dans le document
   enregistré. La première forme est une règle cachée, la seconde une conversion datée.
3. **Ce n'est pas une position par défaut de fait pour les nouveaux modèles.** Aucun modèle écrit
   après C4 ne passe par cette migration : le champ étant requis, son auteur l'écrit. Le contraste
   avec la question ouverte n° 6 de la roadmap (`README.md:189`, « ce choix sera recopié par tous ceux
   qui partiront de ces modèles ») est exact : là, le défaut se recopie ; ici, il ne se propage pas.
   Ce qui se recopiera, c'est la page du **modèle livré** de D9 du designer — et ce choix-là
   appartient à ce lot-là.

**La règle de conduite du lot, écrite noir sur blanc : INC-0 à INC-3 sont NON PUBLIABLES. Le premier
commit publiable est INC-4.** Et il faut la précision que C3 a dû s'écrire (`c3, §2 D11`) : INC-0 serait
publiable seul — il ajoute des fichiers que rien ne consomme — et c'est **INC-1** qui laisse une forme
persistée sans estampille, INC-2 et INC-3 héritant de cet état. La règle porte néanmoins sur le
**lot**, parce que ce qu'elle protège n'est pas la propreté d'un commit : c'est qu'aucun build en
circulation ne refuse illisiblement les documents du build suivant. **Cohérent n'est pas publiable.**

> ⚠️ **Et « non publiable » ne décrit PAS le même état qu'en C1, C2 et C3 — c'est la prémisse juste
> d'une contre-analyse dont la conclusion était fausse [en-tête].** Les trois estampilles précédentes
> couvraient des lots **purement élargissants** : un build de mi-lot lisait encore **tous** les
> documents existants, et le seul danger était qu'un document *plus récent* le déroute. INC-1
> **rétrécit** : `page` devient requis avant que la migration existe, donc un build pris à INC-1, INC-2
> ou INC-3 **refuse tout document v4**, et le dépôt n'aurait aucun moyen de les rouvrir. La règle de
> conduite se durcit donc de deux crans, et les deux sont opérationnels :
>
> 1. **Le lot atterrit en une seule PR**, et jamais par fusions successives d'incréments sur `main`.
>    Ce n'est pas une préférence de rédaction : entre INC-1 et INC-4, `main` porterait un build qui
>    refuse les documents que `main` produisait la veille.
> 2. **Aucun artefact intermédiaire ne quitte la branche** — ni tag, ni paquet, ni `dist` partagé. Le
>    dépôt n'a aucun `npm publish` [§9, hypothèse 6], ce qui rend la règle tenable sans outillage :
>    c'est la revue de la PR qui la tient, et il n'y a rien d'autre pour la tenir.
>
> **Ce que la règle ne peut PAS faire, et il faut le dire :** rien de mécanique ne l'applique. Un
> `git push` d'INC-1 sur `main` passe les quatre portes. C'est une règle de la septième colonne du
> tableau d'`AGENTS.md` — « revue humaine uniquement ».

**Le double garde de `parseTemplate` sert enfin à quelque chose, et c'est mesuré.**
`migrate.ts:206-217` explique que le garde tourne deux fois parce qu'« *une future migration
TRANSFORME […] donc elle peut PRODUIRE une forme hors bornes à partir d'une entrée conforme* ». C4 est
cette migration, la première. **Mesuré** : un document v4 de **7 niveaux et 16 valeurs** ressort à
**7 niveaux et 27 valeurs** — la page ajoute onze valeurs et **aucun niveau**, parce que `page.margins`
est aussi profond que `root.children`. La règle que le dépôt s'était donnée — « *une migration ne rend
jamais une forme hors bornes* » — est donc tenue par cette entrée, et le second passage du garde le
vérifie à l'exécution plutôt que sur parole.

**Écarté.** (a) **Ne pas estampiller au motif que l'ajout est additif** : il ne l'est pas — il retire
un champ facultatif de fait et élargit une union —, et `AGENTS.md` §1.2 ferme la porte d'une phrase :
« il n'y a pas de dérogation pré-v1.0 au versionnement ». (b) **Fusionner avec `{ from: 3, to: 4 }`** :
rompt le contrat pas-à-pas de `migrate.ts:7-12`, et fait mentir le test de composition. (c) **Une
migration identité plus un rétrécissement assumé** : ajoute un cinquième rétrécissement pour économiser
quatre lignes, et rend un message qui ne nomme que `page`. (d) **Une migration qui déduirait la
feuille du contenu** (« ce modèle a un tableau large, donc paysage ») : une migration qui devine une
intention corrompt — l'argument est déjà écrit en C3 (`c3, §2 D11`). (e) **Deux estampilles, une par forme
stockée** : le numéro désignerait un état de branche, jamais une forme.

**Irréversible.**

> ⚠️ **La conséquence à ne pas perdre de vue : rien de mécanique n'exige ce bump.** Comme pour C3, le
> seul test qui rougit est celui qui énumère la chaîne — l'attendu littéral passe de
> `[[1,2],[2,3],[3,4]]` à `[[1,2],[2,3],[3,4],[4,5]]`. Aucun compilateur, aucun lint, aucune
> couverture ne réclame l'incrément. **En revanche, et c'est nouveau par rapport à C3, la
> transformation a bien un filet** : `page` étant requis, un document v4 non transformé échoue au
> parse, donc tout test qui charge un document v4 rougit si le `migrate` oublie d'écrire la page. Le
> critère de sortie d'INC-4 épingle les deux : `CURRENT_SCHEMA_VERSION === 5`,
> `TEMPLATE_MIGRATIONS.length === 4` avec sa première entrée toujours `{ from: 1, to: 2 }`, **et** un
> aller-retour v4 → v5 qui rend une page de compatibilité complète.

---

### D12 — Aucun plafond nouveau, et les mesures qui l'autorisent

**Décision.** Ni plafond de bandes, ni plafond de profondeur propre à une bande, ni champ nouveau
d'`EvaluationLimits`. `DEFAULT_SHAPE_LIMITS` reste `{ maxDepth: 64, maxNodes: 100_000 }`. Trois bornes
de bonne formation seulement, toutes sur des champs neufs : une dimension de feuille dans
`[1, 5080]`, une marge dans `[0, 5080]`, et au plus une bande par occurrence et par côté.

**Les mesures qui l'autorisent — protocole en [§3], unité exacte du garde : niveaux JSON, racine au
niveau 1 ; valeurs = un par élément de tableau et un par propriété propre, plus la racine, le `length`
d'un tableau non compté ; bornes obtenues par bissection.**

| Ce qui est mesuré | Profondeur | Valeurs | Refus rendu |
| :--- | ---: | ---: | :--- |
| `RECIPE_TEMPLATE` de C3, seul *(contrôle de calibrage)* | **18** / 64 | **231** / 100 000 | — |
| Modèle de recette **C4** seul (page, un en-tête, deux pieds) | **11** | **105** | — |
| `page` seule, dans ce modèle | 10 | 84 | — |
| Une bande, seule | 8 | 31 | — |
| **Modèle de recette combiné C3 + C4** | **18** | **271** | — |
| Un **tableau de C3 placé dans une bande** | **21** | 474 | — |
| Document v4 avant migration → après | 7 → **7** | 16 → **27** | — |
| `round` imbriqués sous un texte de `root` *(contrôle de calibrage)* | **56 acceptés** | — | `too-deep` au 57ᵉ |
| `round` imbriqués sous un texte de **bande** | **53 acceptés** | — | `too-deep` au 54ᵉ |
| Bandes sous le défaut `maxNodes` | — | **6 248 acceptées** | `too-many-nodes` à la 6 249ᵉ |
| 2 000 conteneurs imbriqués dans une bande, via `assertBoundedShape` | — | — | `too-deep`, limite 64 |

**Les deux lignes de calibrage sont là pour une raison, et c'est la seule preuve disponible que ces
chiffres sont comparables à ceux du plan C3.** `RECIPE_TEMPLATE` mesuré ici rend **18 / 231**, ce que
le plan C3 annonce exactement (`c3, §2 D12`) ; et **56** `round` sous un texte nu est également son
chiffre (`c3, §2 D12`). Une sonde qui reproduit deux mesures indépendantes d'un autre plan mesure la même
chose que lui. Sans ces deux lignes, les neuf autres seraient invérifiables.

**Ce que ces mesures autorisent à conclure.** **Une bande coûte exactement trois niveaux JSON** —
`page`, la liste, l'indice, moins celui que `root` coûtait déjà : 56 − 53 = 3, mesuré par bissection
dans les deux positions. La marge sous `maxDepth` reste de **46 niveaux** sur le modèle de recette
combiné, soit un rapport de **3,5×**, identique à celui que C3 mesure — parce que le chemin le plus
profond passe par le tableau, pas par la page.

> ✅ **Le défaut C-13 du plan C3 ne se rejoue pas, et c'est vérifié plutôt que supposé.** C3 a dû
> réécrire la docstring de `ShapeLimits.maxDepth` parce que son modèle de recette rendait fausse la
> mesure qu'elle annonce, et D12 de C3 s'appuyait sur cette même mesure — « fonder un refus sur un
> chiffre que le code contredit trois lignes plus haut » (`c3, §2 D12`). La question se pose donc à
> l'identique ici. **Réponse mesurée : non.** Après C3, la docstring dira « *18 for the five-column
> table of lot C3 […] 64 leaves a threefold margin* » ; le modèle de recette combiné pèse **18**, donc
> la phrase reste vraie **au mot**. Le seul cas qui la dépasse est un **tableau placé dans une bande**,
> à 21 niveaux — un modèle que personne n'écrit (un en-tête de page ne porte pas le tableau des
> lignes), et qui laisse encore un rapport de 64/21 = **3,05×**, donc « threefold » tient toujours.
> **`packages/core/src/template/guard.ts` n'est donc pas touché par C4** — et ce non-geste est écrit
> ici parce que les deux lots précédents ont chacun dû faire le geste, et qu'un lecteur s'attendrait à
> le retrouver.

**Pourquoi aucun plafond de bandes.** Parce que `maxNodes` borne déjà, indirectement et mieux :
**mesuré**, 6 248 bandes sont acceptées sous le défaut et la suivante est refusée avec
`too-many-nodes`. Un `MAX_PAGE_BANDS` serait une seconde chose à tenir en phase avec la première, pour
un cas qu'aucune mesure ne montre — un modèle réel en porte deux ou trois. Et il constituerait un
rétrécissement à adosser à l'hypothèse pré-v1.0 pour un besoin inexistant.

**Côté évaluation, C4 n'ajoute aucun coût que le contrat puisse borner, et il faut dire pourquoi.**
Le contenu d'une bande est évalué **une fois par page** par un moteur qui n'existe pas encore, donc le
budget d'évaluation d'un document paginé n'est pas mesurable dans ce dépôt : le seul consommateur réel
est le playground, qui n'a aucune page. Ce que l'on peut dire sans mesure abusive est une **forme** :
le coût d'évaluation des bandes est linéaire en nombre de pages, et le nombre de pages n'est pas une
donnée du modèle. C'est exactement la situation que le plan C3 décrit pour ses propres chiffres — « le
modèle `12·N + 4` décrit la boucle de la sonde, pas la boucle du moteur » (`c3, §2 D12`) — sauf qu'ici il
n'y a même pas de sonde honnête à écrire. **Aucun chiffre de budget n'est donc avancé pour ce lot**, et
c'est E8 qui remettra la mesure.

**Écarté.** (a) **Un `MAX_PAGE_BANDS`** : mesuré inutile ci-dessus. (b) **Un plafond de pages** : le
nombre de pages n'est pas dans le modèle, il est produit par le moteur ; le borner demanderait un champ
d'`EvaluationLimits`, donc une méthode de budget, donc un code de refus — les trois refusés, le dernier
par D9. (c) **Relever `maxDepth` parce qu'une bande coûte trois niveaux** : 46 niveaux de marge
subsistent, et relever un défaut parce qu'un lot neuf s'en approche est la manière ordinaire dont un
garde devient décoratif. (d) **Refuser un tableau dans une bande** : irréalisable sans refuser aussi
les conteneurs, et `too-deep` répond déjà avec un code typé qui existe.

**Réversible dans un seul sens**, et il faut le nommer : ne rien borner ne coûte rien à défaire côté
code, mais l'ajouter plus tard serait un rétrécissement, sans migration possible. *Signal de
réouverture :* un chiffre remis par E8 montrant qu'un grand nombre de bandes fait exploser une
ressource que `maxNodes` ne borne pas.

---

### D13 — Ce que le lot refuse, par écrit

**Décision.** **Dix-neuf refus**, groupés en **six familles**, chacun adossé à un texte déjà écrit du
dépôt et jamais à un goût, chacun assorti de son signal de réouverture quand il en a un. Un refus
qu'on n'écrit pas est un refus qui sera demandé, accordé, et découvert trop tard. Cette liste est le
contenu de la dernière décision de l'ADR 0006.

**Pagination — cinq refus.**

- **Le saut de page manuel** (`pageBreakBefore`, `breakAfter`). *Motif :* il échoue à la condition 3 du
  critère d'appartenance — son effet **est** la pagination — et C3 l'a déjà refusé nommément
  (`c3, §2 D13`). *Signal :* un modèle livré dont une annexe doit commencer sur une page neuve [§2, D8].
  ⚠️ **Et il faut ajouter ce que C4 découvre en le refusant : ce besoin n'a AUCUN propriétaire dans le
  dépôt.** Vérifié — aucun lot de `docs/roadmap/core.md` ni de `docs/roadmap/engine.md` ne nomme le saut
  de page explicite ; les seules occurrences de « saut de page » sont la décision 7
  (`README.md:55`, aperçu et PDF doivent décider les coupes de la même manière) et le lot V3 du viewer,
  qui **compare** des coupes. C7 ne couvre que l'insécabilité. Le refuser ici est donc juste, mais le
  refuser **sans le signaler** laisserait un besoin orphelin qu'on accorderait un jour en catastrophe :
  l'ADR 0006 le nomme, et demande qu'un propriétaire soit désigné ou que le besoin passe explicitement
  hors v1.
- **L'insécabilité** (`keepTogether`, `breakInside`). *Motif :* `core.md:223` — « C7 — Dépend de :
  C4 ». C7 est après, et C4 ne préempte pas le seul lot qu'il débloque. *Irréversible au sens faible :*
  le champ appartient à un lot nommé.
- **La veuve, l'orpheline, le point de coupe.** *Motif :* `engine.md:44-50` les attribue au moteur, et
  `core.md:283-286` les interdit à la brique.
- **La hauteur ou la réserve verticale d'une bande.** *Motif :* aucun nœud du contrat ne déclare de
  dimension, et une hauteur trop petite pour son contenu créerait une classe de faute que le contrat ne
  peut pas trancher [§2, D8].
- **Le report de page et son libellé** (`carryForwardLabel`). *Motif :* « le seul calcul que le moteur
  décide lui-même » (`core.md:48`, `engine.md:63-67`) ; sa valeur est un montant, donc une échelle et un
  arrondi, donc l'ADR 0004 décision 12. *Signal :* le lot E3, qui trouvera le mécanisme de D7 déjà en
  place — un `field` de plus, pas une invention.

**Format et unité — trois refus.**

- **Tout nom de format stocké** (`format: 'a4' | 'letter'`). *Motif :* une énumération stockée coûte une
  estampille à chaque format nouveau [§2, D3]. Le tableau `STANDARD_SHEETS_MM` reste du **code**.
- **Un champ `orientation`.** *Motif :* la paire de dimensions le dit déjà ; un second champ serait une
  seconde source de vérité et un invariant à faire respecter [§2, D3]. **Porté en arbitrage n° 3** [§8],
  lui-même tranché par construction si le n° 2 retient le format nommé.
- **Une unité déclarée par le document** (`{ value, unit }`, `'210mm'`). *Motif :* deux modèles
  deviendraient incomparables sans conversion, et le dépôt aurait deux unités à honorer partout ;
  `c3, §2 D7` a déjà refusé ce motif d'union.

**Apparence — deux refus.**

- **Le fond de page, le filigrane, le cachet, la couleur du papier.** *Motif :* périmètre de C11 et de
  D10 du designer (`core.md:265-279`, `designer.md:168-182`), et ce sont explicitement des **calques** —
  « ce qui se place derrière ou devant le contenu sans participer au flux ». ⚠️ **Une bande ne peut pas
  les récupérer, et il faut le dire parce que la tentation viendra :** une bande **occupe de la place**
  en haut ou en bas de la feuille, un filigrane est **derrière le flux, au milieu**. Ce ne sont pas deux
  réglages du même objet. Le point de vigilance à verser à l'ADR : l'ordre de sacrifice
  (`README.md:157-161`) fait des **calques le deuxième candidat à la coupe**, et si les calques sortent
  du v1, le filigrane perd son porteur. Ce ne sera toujours pas à C4 de le reprendre.
- **Toute police, filet, couleur, espacement ou alignement dans `PageSetup`.** *Motif :* périmètre de
  C5 (`core.md:186-196`), et la condition 1 du critère les tue tous — ils s'écrivent sur n'importe quel
  bloc, donc ils sont exprimables hors d'une feuille. Un champ d'apparence écrit ici serait à
  **déplacer**, et déplacer un champ stocké est une migration transformante.

**Numérotation — trois refus.**

- **Tout motif formaté** (`'Page {n} / {total}'`). *Motif :* `expression/types.ts:4-7` — « *an expression is a
  validated tree, **never a string to parse*** » ; un `{n}` dans une chaîne est un parseur, avec son
  échappement et sa surface d'injection.
- **Toute position déclarée** (`position: 'footer-center'`). *Motif :* les bandes disent déjà **où**
  ; deux façons de dire où va un contenu, c'est une règle de résolution à écrire.
- **Un numéro de départ, une remise à zéro, des chiffres romains, une numérotation par section.**
  *Motif :* les sections n'existent pas dans le contrat, et la forme des chiffres est C6
  (`core.md:198-212`). *Signal :* un modèle livré avec une page de garde non numérotée.

**Données — deux refus.**

- **Toute clé réservée dans le jeu de données ou dans la portée** (`page.numero`, `openview.page`).
  *Motif :* `AGENTS.md`, règle de périmètre, et `scope.ts` dans le code — « *never one the engine
  invents* ». Deux défauts mesurables l'accompagnent [§2, D7]. **Irréversible au sens fort.**
- **Toute feuille déduite de quelque chose** : du jeu de données, de la locale de la machine, d'un
  en-tête HTTP, d'une préférence système. *Motif :* outillé par Biome dans `core` et `engine`, et E6 en
  dépend. A4 dans la migration est une **constante assumée**, jamais une adaptation [§2, D11].

**Structure — quatre refus.**

- **Plusieurs pages ou sections aux formats différents** (`pages: PageSetup[]`). *Motif :* une page par
  section suppose des sections que le contrat n'a pas, et personne ne l'a demandé. *Signal :* une
  annexe en paysage [§2, D2].
- **Le recto-verso, les pages en vis-à-vis, la marge de reliure, le fond perdu, les repères de coupe.**
  *Motif :* aucun document du dépôt ne les mentionne. Ce n'est pas un refus de conception, c'est un
  **silence** que ce lot décide de ne pas rompre — les inventer serait de la sur-ingénierie.
- **Les colonnes de texte sur la page** (deux colonnes de flux). *Motif :* périmètre de C11
  (`core.md:267-274`), qui porte « un découpage en lignes et colonnes ».
- **Tout plafond nouveau.** Repris ici pour que la liste soit complète ; la décision, ses mesures et son
  signal sont en [§2, D12].

Soit **5 + 3 + 2 + 3 + 2 + 4 = 19**.

> 🗳️ **Ce refus‑ci a été RETIRÉ de la liste par la décision du 2026‑08‑18, et c'est le seul.** Une
> rédaction antérieure refusait « **les variantes de première page** (`firstOnly`, `exceptFirst`) » au
> motif que le critère de recette nomme la dernière page et jamais la première, en le qualifiant de
> « refus le plus fragile de la liste ». L'arbitrage n° 6 a été tranché en **B** : les deux membres
> entrent dans le lot [§2, D6]. La liste passe donc de **vingt** refus à **dix‑neuf**, et la famille
> « Structure » de cinq à quatre.
>
> **Ce que le retrait ne fait pas :** il n'ouvre ni le saut de page, ni la hauteur de bande, ni la
> numérotation par section. Et il **ne livre pas le report** — le marqueur de report reste refusé
> (famille « Pagination »), ce qui laisse E3 avec l'occurrence dont il a besoin et sans la valeur qu'il
> devra produire lui‑même.

**Les trois qui seront demandés dès la première vraie facture.** Ce ne sont pas les plus discutables,
ce sont les plus **prévisibles** : les écrire ici avec leur contournement daté évite qu'ils soient
accordés en catastrophe.

**1. La page de garde non numérotée** — et elle remplace, dans cette liste, « la variante de première
page », que la décision du 2026‑08‑18 vient de livrer. **C'est précisément parce que `firstOnly` existe
que celle‑ci devient prévisible :** dès qu'un modèle peut donner une allure propre à sa première page,
la demande suivante est « et ne la numérote pas », puis « et compte les pages à partir de la deuxième ».
**Contournement d'aujourd'hui :** poser la numérotation dans une bande `exceptFirst`, ce qui supprime le
numéro de la page 1 — **et ne renumérote rien** : le marqueur `number` rendra `2` sur la deuxième page,
pas `1`. Le contournement couvre donc la moitié du besoin, et la moitié qu'il ne couvre pas est un
**numéro de départ**, refusé dans la famille « Numérotation » ci‑dessus. **Coût de la réouverture :** un
champ sur `PageSetup` ou un `field` de plus, une estampille — mais surtout une décision de C6 sur ce que
« numéro » veut dire, qui n'est pas de ce lot.

**2. Le saut de page manuel.** Il sera demandé par la première annexe. **Contournement :** aucun ; le
document coupe où il coupe. **Coût de la réouverture :** un champ sur un nœud de flux, donc une
décision de C7 ou un lot à lui, et une estampille. **Ce qu'il faut refuser en attendant :** un
`PageSetup.breakBefore: string[]` qui listerait des identifiants de nœuds — une référence croisée dans
un contrat qui n'en a aucune, et un identifiant devenu orphelin par une simple suppression de bloc.

**3. Une hauteur d'en-tête.** Elle sera demandée par le premier en-tête qui déborde sur le contenu.
**Contournement :** aucun dans le contrat — c'est au moteur de mesurer, et l'attente écrite en
[§2, D6] lui dit comment ne pas osciller. **Ce qu'il faut refuser en attendant :** la version
« inoffensive » du champ, `minHeight`, qui est le même champ avec un nom qui promet moins.

**Écarté.** (a) **Livrer l'un de ces refus « parce que c'est peu de code »** : un champ stocké livré ne
se retire plus qu'avec une migration transformante. (b) **Livrer un exemple de page nommé « facture
A4 » dans le contrat** : un exemple est un contrat de fait, et celui-là ferait de A4 la position par
défaut que D11 prend soin de confiner à une migration.

**Irréversible pour les deux refus de la famille Données** ; **réversible pour les autres** au prix,
chaque fois, d'un champ neuf et d'une estampille — jamais d'une migration transformante, ce qui est
précisément la propriété que cette liste protège.

---

## 3. Le contrat définitif

Tout ce qui suit a été **écrit et compilé** dans un bac à sable, sous les options du dépôt. Le
protocole, avant le code, parce qu'une mesure sans protocole n'est pas une mesure :

> **Le bac à sable, et ce qu'il partage avec le dépôt.** Un répertoire **hors du dépôt** (aucune
> écriture dans `C:\_Gargouilles\Openview`, `git status` identique avant et après), portant un
> `tsconfig.json` qui **étend `tsconfig.base.json` du dépôt** et reprend les options de
> `packages/core/tsconfig.json` — `module`/`moduleResolution` **NodeNext**, `lib: ["ES2022"]`,
> `types: []` — donc `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
> `noUnusedLocals`, `noImplicitReturns` et `noFallthroughCasesInSwitch` **actifs**. Une **jonction**
> vers `packages/core/node_modules` donne le `zod@3.25.76` réel du dépôt, importé via `zod/v4`.
> `tsc` **7.0.2** du dépôt, Node **v24.11.1**.
>
> **Ce que le bac à sable a compilé contre : les déclarations `.d.ts` du build C3 présent dans
> `packages/core/dist`.** Ce build **n'est pas dans git** (`dist/` est ignoré, `.gitignore:6`) et il
> déclare `CURRENT_SCHEMA_VERSION = 4`, `BlockNode`, les six schémas de tableau, `parseBlockNode` et la
> fixture `RECIPE_TABLE`. **L'aubaine :** les types de C4 ont été compilés contre le contrat **réel** de
> C3, pas contre sa description dans un plan.
>
> ⚠️ **Ce paragraphe portait un avertissement qui est désormais PÉRIMÉ, et le laisser tel quel faisait
> mentir le protocole.** Au moment de la mesure, `dist` était **en avance sur `src`** — l'implémentation
> de C3 avait été écrite, compilée, puis retirée de `src`, et son `dist` était resté (relevé :
> `dist/template/template.js` daté du 2026-08-17 20:37, `src/template/template.ts` retouché à 21:39).
> Le piège annoncé était donc que « le premier `pnpm run build` remplacera ce `dist` par un build v3 ».
> **La fusion de la PR #18 l'a supprimé** : `src` porte maintenant `CURRENT_SCHEMA_VERSION = 4`
> (`template.ts:80`), `src` et `dist` déclarent le même contrat, et un `pnpm run build` reproduit celui
> contre lequel les mesures ont été prises. **Les mesures de ce plan n'ont donc plus de rejeu dû à cet
> écart** — ce qui reste à rejouer est ce que l'en-tête nomme : les portes 1 et 4, jamais mesurées ici.
>
> **Ce que le bac à sable ne partage pas :** l'orchestration `turbo`, la résolution d'espace de
> travail pnpm, les quatre autres paquets, `biome check`, et **aucun chiffre de couverture** n'a été
> produit. Les portes 1 et 4 ne sont donc pas mesurées ici ; la porte 3 l'est sur les fichiers de ce
> lot, en isolation.
>
> **Deux contrôles de calibrage** rendent les chiffres comparables à ceux du plan C3 : la fixture
> `RECIPE_TEMPLATE` mesure **18 niveaux / 231 valeurs** et un texte de `root` accepte **56** `round`
> imbriqués — les deux chiffres exacts de `c3, §2 D12` et `c3, §2 D12` [§2, D12].

Ce que le lot ajoute, en un coup d'œil : **cinq fichiers neufs** de production, **neuf fichiers
touchés**, **zéro fichier supprimé**, **zéro fichier déplacé** — contrairement à C3, il n'y a aucun
refactor à faire, parce que C3 a déjà payé le découpage de `ast/` dont ce lot hérite.

⚠️ **Le tableau ci-dessous ne compte QUE la production. Le total hors documentation est de 22
fichiers** — les huit fichiers de test que [§4] énumère s'y ajoutent. Le chiffre est écrit ici parce
que c'est celui qui se compare à C3, et qu'une première rédaction comparait les 14 de ce tableau aux 20
de C3 [§4].

| Fichier | Nature | Incrément |
| :--- | :--- | :--- |
| ➕ `packages/core/src/page/types.ts` | les types écrits à la main, les tuples, les bornes, le tableau de commodité | INC-0 |
| ➕ `packages/core/src/page/schemas.ts` | les schémas Zod et les deux contrôles croisés | INC-0 |
| ➕ `packages/core/src/page/area.ts` | `printableAreaOf` | INC-0 |
| ➕ `packages/core/src/page/page.ts` | la façade du dossier | INC-0 |
| ✏️ `packages/core/src/template/template.ts` | le champ `page`, l'estampille, la docstring de version | INC-1, INC-4 |
| ✏️ `packages/core/src/template/guard.ts` | `parsePageSetup`, la porte bornée | INC-1 |
| ✏️ `packages/core/src/ast/types.ts` | le troisième membre de `TextSegment` | INC-2 |
| ✏️ `packages/core/src/ast/schemas.ts` | son schéma, et l'union élargie | INC-2 |
| ✏️ `packages/core/src/ast/nodes.ts` | la façade de `ast/` : deux noms de plus | INC-2 |
| ✏️ `packages/core/src/ast/visitor.ts` | la branche de `visitSegment` et celle de `SEGMENT_EXPRESSIONS` | INC-2 |
| ➕ `packages/core/src/template/paths.ts` | `collectTemplateDataPaths` | INC-3 |
| ✏️ `packages/core/src/template/migrate.ts` | la migration transformante `4 → 5` | INC-4 |
| ✏️ `packages/core/src/index.ts` | le barrel | INC-5 |
| ✏️ `apps/playground/src/App.tsx` | la démonstration | INC-5 |

Et ce que le lot **ne touche pas**, alors qu'un lecteur de C3 s'y attendrait : `errors.ts` (aucun
code, aucun site — [§2, D9]), `packages/designer/src/types.ts` (aucun type de nœud nouveau, donc
`BlockType` est inchangé — [§3.11]), la docstring de `ShapeLimits.maxDepth` (vérifié : C4 ne la rend
pas fausse — [§2, D12]), et l'algèbre d'expressions dans son entier (`expression/**` sort du lot
octet pour octet).

---

### 3.1 `packages/core/src/page/types.ts` — nouveau

**Compilé à exit 0** dans le bac à sable.

```ts
import type { ContainerNode } from '../ast/types.js';

/**
 * The sheet a template prints on, in millimetres.
 *
 * Millimetres, and FRACTIONAL ones, for a measured reason: US Letter is 215.9 mm by
 * 279.4 mm, so whole millimetres would make it inexpressible -- in a product whose
 * decision 11 requires two languages and two currencies. And no decimal-place bound
 * polices those values either: `279.4 * 100` is `27939.999999999996` in IEEE-754, so
 * the obvious "at most two decimals" check REFUSES a standard paper size. Finiteness
 * is already covered -- `z.number()` refuses `NaN` and `Infinity` on its own.
 *
 * Orientation is NOT a field: a landscape A4 is `{ width: 297, height: 210 }`. A
 * separate flag would be a second source of truth for one fact, hence an invariant to
 * police for a state that should not be expressible at all.
 */
export interface Sheet {
  readonly width: number;
  readonly height: number;
}

/**
 * The four edges, in millimetres, all four required.
 *
 * No shorthand (`margins: 20`), no pair (`{ vertical, horizontal }`), no inheritance: a
 * second spelling of one fact means two stored shapes, two refusal paths and a
 * `printableAreaOf` that starts by normalising. Zero is legal -- a full-bleed label, or
 * a template that manages its own gutter -- because refusing it would be a rule of
 * typography, and this contract states no rules.
 */
export interface PageMargins {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/**
 * Which pages a band appears on.
 *
 * Five values, and they form a system rather than a menu: `every` alone, or the pair
 * `firstOnly` + `exceptFirst`, or the pair `exceptLast` + `lastOnly`. Without `exceptLast`, a
 * template wanting a different last-page footer would get BOTH bands on that page, because
 * `every` includes the last one; `exceptFirst` is the same argument at the other end of the
 * document. The order of this tuple is reading order -- all, then the opening pair, then the
 * closing one -- and it is what `z.enum` prints in a refusal.
 *
 * THERE IS NO THIRD PAIR, and that is measured rather than intended: of the twenty-five
 * couples, exactly TWO are compatible, and since they share no member A SIDE CAN NEVER CARRY
 * MORE THAN TWO BANDS. It is also why the occurrence is a tuple and not a set of booleans:
 * booleans would make the incompatible combinations expressible.
 *
 * The system is ENFORCED, not merely described: `PageSetupSchema` refuses two bands on one
 * side whose page domains can overlap -- see BAND_OCCURRENCE_CONFLICTS. Refusing only
 * DUPLICATE occurrences would leave `every` + `lastOnly` expressible, which is two bands on
 * the last page: the very ambiguity the refusal exists to remove.
 *
 * ON A ONE-PAGE DOCUMENT, THE LAST PAGE IS ALSO THE FIRST. A template whose running footer is
 * `exceptLast` prints no running footer at all on a single-page invoice, because `exceptLast`
 * applies to no page; symmetrically, `exceptFirst` never appears. That is the correct
 * behaviour -- the page IS both -- and refusing it would be a layout rule, which this contract
 * does not state. It is written here because the author of the first delivered template must
 * not discover it in a PDF. The same fact is why `firstOnly` + `lastOnly` IS refused: an empty
 * domain is benign, two domains meeting on one sheet is ambiguous.
 *
 * `firstOnly` and `exceptFirst` are DECIDABLE WITHOUT PAGINATING -- page 1 is known before any
 * layout -- so unlike the closing pair they add no oscillation hazard for the engine.
 */
export const PAGE_BAND_OCCURRENCES = [
  'every',
  'firstOnly',
  'exceptFirst',
  'exceptLast',
  'lastOnly',
] as const;

export type PageBandOccurrence = (typeof PAGE_BAND_OCCURRENCES)[number];

/**
 * A repeated region of the sheet, and a document fragment exactly like
 * `Template.root` -- which is why `content` is a `ContainerNode` and not a bare block
 * list. The container brings three things for free: a stable id, so an editor Command
 * can address a band without a field of its own; compatibility with every existing
 * traversal, all of which already accept a `ContainerNode`; and the `BlockNode` cut of
 * lot C3, so a bare `tableRow` inside a band is refused without one line of this lot.
 *
 * The band says WHERE it goes and ON WHICH pages. It says nothing about how the engine
 * repeats it, nor what happens when it does not fit: that belongs to E2 and E3, and
 * writing engine behaviour into the contract is the mistake lot C3 had to undo in its
 * own docstrings.
 */
export interface PageBand {
  readonly on: PageBandOccurrence;
  readonly content: ContainerNode;
}

/**
 * Everything a template says about the paper.
 *
 * Not a node. A sheet has no position in the flow, no siblings and no rank, so it is a
 * field of the document rather than a member of `DocumentNode` -- which also spares
 * `visitNode` a member that could only ever appear at the root, a positional rule this
 * contract has nowhere else and that no `switch` could enforce.
 *
 * Both band lists are REQUIRED and may be empty, and NOT because of the "silent loss" case
 * of `template/template.ts` -- that one is about a key an OLDER build strips, which happens
 * whether the key is optional or required in the newer one. They are required because an
 * empty list and an absent list would be two spellings of one fact: two shapes to store, two
 * refusal paths, and a consumer that starts by normalising.
 */
export interface PageSetup {
  readonly sheet: Sheet;
  readonly margins: PageMargins;
  readonly header: readonly PageBand[];
  readonly footer: readonly PageBand[];
}

/** What `printableAreaOf` returns: two lengths in millimetres, and no origin. */
export interface PrintableArea {
  readonly width: number;
  readonly height: number;
}

/** Below this, a sheet has no printable area at all; `> 0` would admit 0.0001 mm. */
export const MIN_SHEET_MM = 1;

/**
 * 200 inches, and it is an OPENVIEW INTEROPERABILITY BOUND -- not a limit of the PDF format.
 *
 * Saying "the largest page a PDF reader is required to handle" would be wrong, and an
 * earlier draft of this file said it: 200 inches is the historical ceiling of PDF's default
 * user space (14 400 units at 1/72 inch), but PDF 1.6 added the `UserUnit` scale factor,
 * which makes larger pages expressible. So this is a bound this product chooses, at a value
 * borrowed from what readers have historically accepted without scaling.
 *
 * EXTERNAL KNOWLEDGE, not verified in this repository: no engine exists yet, so nothing here
 * confirms the figure, and lot E1 owes it a throwaway probe -- against the PDF adapter
 * actually chosen, not against a specification. What the bound protects is independent of
 * its exact value: without a ceiling, `1e308` mm is a valid document whose printable area
 * the engine will compute as infinite.
 */
export const MAX_SHEET_MM = 5080;

/**
 * Standard sheets, in millimetres, as a CONVENIENCE and never as a stored shape.
 *
 * A designer writes `{ ...STANDARD_SHEETS_MM.a4 }` into a template; the template stores
 * two numbers. That is the whole point: a size added here costs nothing, where a stored
 * `format: 'a4' | 'a5'` enum would cost a schema version and a migration for every paper
 * size ever asked for -- and would make an unlisted size inexpressible.
 *
 * Openview reserves no name here either: this table is read by whoever wants it and
 * ignored by the contract.
 *
 * `as const satisfies` rather than an annotation, and the reason is measured: annotated
 * `Readonly<Record<string, Sheet>>`, `STANDARD_SHEETS_MM.a4` is `Sheet | undefined` under
 * `noUncheckedIndexedAccess` -- so every consumer, the recipe fixture included, would have
 * to handle an absent A4. `satisfies` keeps the literal keys and still checks every entry
 * against `Sheet`.
 */
export const STANDARD_SHEETS_MM = {
  a3: { width: 297, height: 420 },
  a4: { width: 210, height: 297 },
  a5: { width: 148, height: 210 },
  a6: { width: 105, height: 148 },
  letter: { width: 215.9, height: 279.4 },
  legal: { width: 215.9, height: 355.6 },
  tabloid: { width: 279.4, height: 431.8 },
} as const satisfies Readonly<Record<string, Sheet>>;

/** The names of the convenience table, for a picker. Never a stored value. */
export type StandardSheetName = keyof typeof STANDARD_SHEETS_MM;
```

**Trois points de rédaction qui ne sont pas des détails.**

> ⚠️ **La première rédaction de ce fichier était fautive, et c'est une mesure qui l'a montré — à ne
> pas recopier.** `STANDARD_SHEETS_MM` était annoté `Readonly<Record<string, Sheet>>`, au motif qu'un
> type `keyof typeof STANDARD_SHEETS_MM` deviendrait « une énumération de fait, réintroduite par la
> porte des types », et le plan affirmait — sans l'avoir mesuré — que « l'accès par point sur un
> `Record<string, Sheet>` rend bien `Sheet` ». **C'est faux. Mesuré :**
>
> ```
> src/page/checks.ts(5,7): error TS2322: Type 'Sheet | undefined' is not assignable to type 'Sheet'.
> ```
>
> `noUncheckedIndexedAccess` mord **aussi** sur l'accès par point dès que le type porte une signature
> d'index. Conséquence : `{ ...STANDARD_SHEETS_MM.a4 }` ne compilerait pas dans la fixture de [§6.2],
> et chaque appelant devrait traiter une A4 absente — une friction pure, pour protéger d'un danger qui
> n'existe pas. **L'objection initiale était trop subtile pour être vraie** : un type de *nom* ne
> devient jamais une forme stockée, puisque le document n'enregistre que deux nombres [§2, D3] ; et
> l'éditeur a besoin de cette liste pour offrir un sélecteur (D2 de l'éditeur). La forme retenue est
> donc `as const satisfies`, **mesurée sur les quatre usages** : `SHEETS.a4` rend `Sheet` ; `SHEETS[nom]`
> avec `nom: keyof typeof SHEETS` rend `Sheet` ; indexer par un `string` quelconque est une **erreur**
> de compilation, et non un `undefined` silencieux ; et l'étalement dans une fixture compile.

`PAGE_BAND_OCCURRENCES` est un tuple `as const` **exporté**, et non un type seul, pour la raison
qu'`errors.ts:59-65` écrit déjà : « *a type cannot be iterated and C8 has to pair every code with a
message* ». Une énumération que C8 devra présenter à un utilisateur doit être **itérable** ; un type ne
l'est pas. Même règle pour `PAGE_FIELDS`, qui vit dans `ast/types.ts` [§3.5].

Aucun champ n'est optionnel dans ce fichier. C'est la doctrine de l'ADR 0003 (« chaque champ
requis »), et la seconde justification n'est **pas** celle qu'une première rédaction avançait : un
`prop?: T | undefined` sur une forme stockée n'est pas le cas « perte silencieuse » de
`template.ts:31-34`. Cette perte-là est le fait d'un build **antérieur** devant une clé **inconnue**,
et elle se produit que le champ soit requis ou optionnel chez son successeur [§2, D2]. Ce qu'un champ
optionnel coûte réellement ici est plus simple, et suffisant : deux formes stockées pour un fait,
donc deux chemins de refus et un consommateur qui commence par normaliser.

---

### 3.2 `packages/core/src/page/schemas.ts` — nouveau

**Compilé à exit 0** dans le bac à sable, contre le `zod@3.25.76` du dépôt.

```ts
import { z } from 'zod/v4';
import { ContainerNodeSchema } from '../ast/schemas.js';
import {
  MAX_SHEET_MM,
  MIN_SHEET_MM,
  PAGE_BAND_OCCURRENCES,
  type PageBand,
  type PageBandOccurrence,
  type PageSetup,
} from './types.js';

const sheetLengthSchema = z
  .number()
  .min(MIN_SHEET_MM, `A sheet is at least ${MIN_SHEET_MM} mm`)
  .max(MAX_SHEET_MM, `A sheet is at most ${MAX_SHEET_MM} mm`);

const marginLengthSchema = z
  .number()
  .min(0, 'A margin cannot be negative')
  .max(MAX_SHEET_MM, `A margin is at most ${MAX_SHEET_MM} mm`);

export const SheetSchema = z.object({
  width: sheetLengthSchema,
  height: sheetLengthSchema,
});

export const PageMarginsSchema = z.object({
  top: marginLengthSchema,
  right: marginLengthSchema,
  bottom: marginLengthSchema,
  left: marginLengthSchema,
});

export const PageBandSchema = z.object({
  on: z.enum(PAGE_BAND_OCCURRENCES),
  content: ContainerNodeSchema,
});

/**
 * Which occurrences may NOT share a side, because their page domains can overlap.
 *
 * DECLARED, never computed, and that is the whole design: overlap is a property of page
 * RANKS, and the number of pages is not a datum of the document -- the engine discovers it.
 * A check that intersected rank sets would need an `n` that save time does not have. So two
 * occurrences are declared compatible when they are disjoint for EVERY page count >= 1.
 *
 * `every` overlaps everything by construction. The two partitions are `firstOnly`/`exceptFirst`
 * and `exceptLast`/`lastOnly`: disjoint at any count, the open-ended half being simply empty at
 * n = 1, which is a behaviour and not a conflict. Everything else collides at some count, and
 * three of those are worth naming because they look harmless: `firstOnly`/`exceptLast` meet on
 * page 1 from two pages on, `exceptFirst`/`lastOnly` meet on the last page from two pages on,
 * and `exceptFirst`/`exceptLast` meet in the middle from THREE pages on.
 *
 * `firstOnly`/`lastOnly` is the one refusal that costs a real capability -- on two pages or more
 * the two are disjoint. It is refused because on a ONE-page document they are the same sheet, so
 * accepting the pair would make validity depend on the page count: a document legal for one
 * caller and ambiguous for another, which is condition 3 of the membership criterion abandoned.
 *
 * TWO PROPERTIES THIS TABLE MUST KEEP, both measured, both covered by a test:
 * - it is SYMMETRIC -- `checkBandsCannotOverlap` compares each band against EARLIER ones using
 *   the current band's row, so an asymmetric row would make `[a, b]` and `[b, a]` disagree;
 * - it matches the rank-domain derivation for every page count (verified n = 1..8), which is
 *   what makes "declared, not computed" a shortcut rather than a different rule.
 *
 * Widening PAGE_BAND_OCCURRENCES without extending this table does not compile: `Record` over
 * the union demands one row per member (measured, TS2741).
 */
const BAND_OCCURRENCE_CONFLICTS: Readonly<
  Record<PageBandOccurrence, readonly PageBandOccurrence[]>
> = {
  every: ['every', 'firstOnly', 'exceptFirst', 'exceptLast', 'lastOnly'],
  firstOnly: ['every', 'firstOnly', 'exceptLast', 'lastOnly'],
  exceptFirst: ['every', 'exceptFirst', 'exceptLast', 'lastOnly'],
  exceptLast: ['every', 'firstOnly', 'exceptFirst', 'exceptLast'],
  lastOnly: ['every', 'firstOnly', 'exceptFirst', 'lastOnly'],
};

/**
 * Refuses two bands on one side that can apply to the same page.
 *
 * Not a matter of taste: two applicable bands are an ambiguous intent (stack them? in which
 * order? at what cumulative height?), and defining the stacking would demand an order rule
 * and a measurement, neither of which this contract carries. The intent is already
 * expressible without a new field -- a running footer plus a last-page footer is
 * `exceptLast` + `lastOnly`, a letterhead plus a running header is `firstOnly` +
 * `exceptFirst`, with the shared content written twice. The refusal removes a state without
 * removing a capability -- with one named exception, `firstOnly` + `lastOnly`, see above.
 *
 * The message names no occurrence: a constant payload stays safe to log (ADR 0003). The path
 * points at the SECOND band's `on`, which is where the author fixes it.
 *
 * Extracted rather than inlined because the same check serves both sides, and because a
 * named function is what a coverage report can point at.
 */
function checkBandsCannotOverlap(
  bands: readonly PageBand[],
  ctx: z.RefinementCtx<readonly PageBand[]>,
): void {
  const claimed: PageBandOccurrence[] = [];
  for (const [index, band] of bands.entries()) {
    const conflicts = BAND_OCCURRENCE_CONFLICTS[band.on];
    if (claimed.some((earlier) => conflicts.includes(earlier))) {
      ctx.addIssue({
        code: 'custom',
        path: [index, 'on'],
        message: 'Two bands on the same side can apply to the same page.',
      });
    }
    claimed.push(band.on);
  }
}

const bandsSchema = z.array(PageBandSchema).superRefine(checkBandsCannotOverlap);

/**
 * The page, with its two cross-field invariants.
 *
 * The invariants live INSIDE the schema, not in a separate validation function, because
 * this schema is exported: an integrator validating a page before storing it must get
 * the same refusal `parseTemplate` gives. That rests on a library behaviour which is
 * measured and must be replayed on every zod upgrade -- a `superRefine` leaves a
 * `ZodObject` in zod 4 (`.shape` and `.extend` stay available, and
 * `TemplateSchema.extend({ page: PageSetupSchema })` is itself still a `ZodObject`).
 *
 * The GUARD is load-bearing, and it is measured: without it, a sheet of width `0`
 * yields TWO issues -- the `too_small` of the width, then the `custom` of the horizontal
 * margins, because `30 >= 0` holds. The second is collateral damage of the first, and lot
 * C8 was promised one message at a time. The branch is reached by every ill-dimensioned
 * sheet, so it is covered by a test rather than dead.
 *
 * What the guard does NOT rescue: an ABANDONING issue skips this refinement entirely,
 * while a CONTINUABLE one does not. The rule is `too_small`/`too_big`/`custom` continue,
 * `invalid_type`/`invalid_value` abandon -- so a non-numeric margin masks the cross-field
 * check until it is fixed, and a margin merely out of bounds does not.
 *
 * Both messages are CONSTANT: no interpolation of the document's content, per ADR 0003 --
 * an error payload must stay safe to log even when the document is not.
 */
export const PageSetupSchema = z
  .object({
    sheet: SheetSchema,
    margins: PageMarginsSchema,
    header: bandsSchema,
    footer: bandsSchema,
  })
  .superRefine((page, ctx) => {
    const { width, height } = page.sheet;
    if (!(width > 0 && height > 0)) {
      return;
    }
    const { top, right, bottom, left } = page.margins;
    if (left + right >= width) {
      ctx.addIssue({
        code: 'custom',
        path: ['margins'],
        message: 'Horizontal margins leave no printable width.',
      });
    }
    if (top + bottom >= height) {
      ctx.addIssue({
        code: 'custom',
        path: ['margins'],
        message: 'Vertical margins leave no printable height.',
      });
    }
  });
```

> ✅ **La table de compatibilité a été compilée et exécutée séparément, après la correction — les
> chiffres qui suivent ne viennent pas de la campagne initiale de mesure.** `tsc` **7.0.2** du dépôt,
> `tsconfig` étendant `tsconfig.base.json` : **exit 0**. En particulier, `BAND_OCCURRENCE_CONFLICTS[band.on]`
> rend `readonly PageBandOccurrence[]` et **non** `| undefined` — `Record<Union, X>` produit des clés
> littérales, pas une signature d'index, donc `noUncheckedIndexedAccess` ne mord pas ici. C'est le
> contraire du cas mesuré en [§3.1] sur `Record<string, Sheet>`, et la différence est la nature de la
> clé : ne « corrigez » pas l'un avec la parade de l'autre.
>
> **Exécuté contre le `zod@3.25.76` du dépôt, sur l'ENSEMBLE des cas de zéro, une et deux bandes — 31
> cas, aucun échantillonnage : 10 acceptés, 21 refusés.** Les dix acceptés sont exactement les huit
> contenus admissibles de [§2, D6], les deux paires comptant deux ordres d'écriture chacune :
>
> | Contenu du côté | Résultat mesuré |
> | :--- | :--- |
> | `[]` et les **cinq** singletons | **accepté** — 6 cas |
> | `[firstOnly, exceptFirst]` **et** `[exceptFirst, firstOnly]` | **accepté** — l'ordre d'écriture est indifférent |
> | `[exceptLast, lastOnly]` **et** `[lastOnly, exceptLast]` | **accepté** — idem |
> | les **21** autres couples | **refusé**, `custom`, `footer.1.on`, message constant |
> | `[firstOnly, exceptFirst, lastOnly]` | **refusé** sur `footer.2.on` seulement — la paire licite passe, l'intruse est désignée |
>
> **Trois propriétés de plus, mesurées, et chacune est un test :**
>
> 1. **La table est symétrique** — `CONFLICTS[a].includes(b) === CONFLICTS[b].includes(a)` sur les
>    vingt‑cinq couples. Elle est **porteuse** : `checkBandsCannotOverlap` compare chaque bande aux
>    **précédentes** avec la ligne de la bande **courante**, donc une ligne asymétrique ferait diverger
>    `[a, b]` et `[b, a]`. C'est exactement ce que la deuxième ligne du tableau ci‑dessus vérifie.
> 2. **La table déclarée coïncide avec la dérivation depuis les domaines de rangs**, pour `n = 1` à `8`,
>    sur les vingt‑cinq couples. C'est ce qui autorise à écrire « déclarée, pas calculée » sans que ce
>    soit une autre règle : c'est la même, précalculée.
> 3. **Aucun côté ne peut porter trois bandes** — conséquence des deux paires disjointes, et vérifiée
>    par la dernière ligne du tableau.
>
> **Et une remarque à verser à C8 :** une issue est produite **par bande surnuméraire**, jamais par
> couple fautif. Trois bandes toutes incompatibles rendent donc deux messages, chacun désignant une
> bande distincte à retirer. Ce ne sont pas des cascades, mais C8 devra les présenter comme deux
> corrections et non comme une erreur répétée.

> ⚠️ **Le patron d'assertion de C3 ne s'applique PAS à `PageSetup`, et c'est mesuré.** Le plan C3
> protège ses types par une **assignabilité mutuelle** (`MutuallyAssignable<TLeft, TRight>`), et la
> transposition naïve ici **ne compile pas** :
>
> ```
> src/page/schemas.ts(93,14): error TS2322: Type 'true' is not assignable to type 'false'.
> ```
>
> **La raison n'est pas une faute du schéma, c'est la variance des tableaux en lecture seule.**
> `z.array(...)` infère `PageBand[]` ; le type écrit à la main déclare `readonly PageBand[]`. Mesuré,
> les deux directions séparément :
>
> | Assertion | Résultat mesuré |
> | :--- | :--- |
> | `MutuallyAssignable<PageSetup, z.infer<typeof PageSetupSchema>>` | **`false`** |
> | `z.infer<typeof PageSetupSchema> extends PageSetup` | **`true`** |
> | `PageSetup extends z.infer<typeof PageSetupSchema>` | **`false`** |
>
> C'est cohérent avec le dépôt : l'assertion mutuelle de `nodes.test.ts` porte sur `TextSegment`,
> **un type sans tableau**, et pas sur `TextNode` qui en a un. **Conséquence à assumer :** seule la
> direction « ce que Zod produit satisfait le type » est vérifiable au type, et la direction inverse
> — **un champ présent dans le type et absent du schéma** — n'est attrapée par aucune porte de types.
> Le filet réel est en [§5.2] et il est mécanique : la fixture `RECIPE_PAGE` est annotée `PageSetup`,
> donc un champ **requis** ajouté au type fait rougir la porte 3 sur la fixture ; et un champ que la
> fixture porte mais que le schéma ignore fait rougir l'aller-retour `toStrictEqual`, parce que
> `z.object` **supprime** les clés inconnues — mesuré [§5.1, R23].
>
> L'assertion retenue est donc la seule qui compile, et elle est écrite avec ce qu'elle ne couvre
> pas :
>
> ```ts
> /**
>  * One direction only, and the other is unavailable: `z.array` infers a MUTABLE array
>  * where the hand-written type is `readonly`, so mutual assignability is measurably
>  * `false` and cannot be asserted. What this catches: a schema field whose output no
>  * longer satisfies the type. What nothing catches: a field added to the type and not to
>  * the schema -- for that, see the round-trip test.
>  */
> export const PAGE_SETUP_SCHEMA_SATISFIES_TYPE: z.infer<typeof PageSetupSchema> extends PageSetup
>   ? true
>   : false = true;
> ```

---

### 3.3 `packages/core/src/page/area.ts` — nouveau, et la mesure qui le justifie

**Compilé à exit 0.**

```ts
import type { PageSetup, PrintableArea } from './types.js';

/**
 * The area a page leaves for content, in millimetres.
 *
 * This lives in the contract, not in each consumer, because decision 7 of the roadmap
 * promises a preview IDENTICAL to the PDF -- and `width - left - right` is not one
 * operation. MEASURED, on US Letter with one-inch margins:
 *
 *     215.9 - (25.4 + 25.4)  ->  165.10000000000002
 *     (215.9 - 25.4) - 25.4  ->  165.1
 *
 * Two implementations that write the subtraction differently get different doubles, and
 * the divergence appears exactly on the sheet the project needs for its English/dollars
 * criterion while staying invisible on A4 with whole margins (both give 180). One
 * exported function turns that agreement into a dependency -- the reason `nodeReads`
 * exists in ast/visitor.ts.
 *
 * The parenthesised form is the one retained, and the reason is a property rather than a
 * preference: `left + right === right + left` exactly, so the result cannot depend on
 * which margin an implementer names first. The sequential form has no such property --
 * MEASURED, `(229.61 - 38.59) - 33.3` is `157.72000000000003` and
 * `(229.61 - 33.3) - 38.59` is `157.72`.
 *
 * It returns two lengths and NO origin: `{ x, y }` would impose an origin convention
 * (which corner, which axis direction) that nothing in the contract fixes and that lot
 * C11 may want to fix differently. And it does not subtract band heights -- the contract
 * measures none, so an area claiming to account for the header would be false.
 */
export function printableAreaOf(page: PageSetup): PrintableArea {
  const { sheet, margins } = page;
  return {
    width: sheet.width - (margins.left + margins.right),
    height: sheet.height - (margins.top + margins.bottom),
  };
}
```

**Ce que la fonction ne promet pas, et qu'il faut écrire pour ne pas promettre trop.** Elle rend un
nombre **exact au sens IEEE-754** — le résultat correctement arrondi de l'expression écrite — et rien
de plus. Deux consommateurs qui **quantifient** ensuite ce nombre différemment (arrondi au pixel de
l'écran, au point du PDF) peuvent encore différer : l'identité au pixel ne découle pas de l'identité
du nombre, et c'est V3 qui vérifie la décision 7 elle-même. Le raisonnement est celui que C3 a écrit
pour ses largeurs de colonnes (`c3, §2 D6`), en trois niveaux qu'il ne faut pas empiler.

---

### 3.4 `packages/core/src/page/page.ts` — la façade

Le dossier expose une façade, sur le modèle de `expression/expression.ts` : les consommateurs
importent `./page/page.js`, jamais `./page/types.js` ni `./page/schemas.js`. Cela laisse le découpage
interne libre — c'est exactement ce que C3 a payé pour `ast/` (`c3`, INC-0) et qu'il n'y a pas à
repayer ici, puisque le dossier naît découpé.

```ts
/**
 * The page contract: what a template says about the paper it prints on.
 *
 * Barrel by design -- consumers import from here, never from ./types.js or ./schemas.js,
 * so the split inside this folder stays free to change. Lot C3 had to pay for that split
 * after the fact, in a dedicated increment; this folder is born divided.
 */
export {
  printableAreaOf,
} from './area.js';
export {
  PageBandSchema,
  PageMarginsSchema,
  PAGE_SETUP_SCHEMA_SATISFIES_TYPE,
  PageSetupSchema,
  SheetSchema,
} from './schemas.js';
export type {
  PageBand,
  PageBandOccurrence,
  PageMargins,
  PageSetup,
  PrintableArea,
  Sheet,
  StandardSheetName,
} from './types.js';
export {
  MAX_SHEET_MM,
  MIN_SHEET_MM,
  PAGE_BAND_OCCURRENCES,
  STANDARD_SHEETS_MM,
} from './types.js';
```

> **Une question de découpage qui se pose ici, et dont la mauvaise réponse coûte un cycle.**
> `PAGE_FIELDS`, `PageField` et le segment marqueur **ne sont pas dans ce dossier** : ils vivent dans
> `ast/types.ts`, à côté de `TextSegment`. Le dossier `page/` dépend donc de `ast/`, **dans ce sens et
> dans celui-là seulement**.
>
> La raison est mécanique. Le marqueur est du **contenu inline** : sa place est dans l'union
> `TextSegment`, sinon `visitSegment` devrait importer `page/` pour dispatcher un membre de sa propre
> union. Si le tuple `PAGE_FIELDS` vivait ici, `ast/schemas.ts` importerait une **valeur** de `page/`
> pour écrire son `z.enum(...)`, tandis que `page/schemas.ts` importe déjà `ContainerNodeSchema` de
> `ast/schemas.ts` : un aller-retour de valeurs entre deux dossiers, c'est-à-dire la configuration où
> l'ordre d'initialisation ESM commence à compter. Une dépendance unidirectionnelle supprime la
> question au lieu de l'argumenter.
>
> *L'objection à laquelle il faut répondre :* `ast/types.ts` gagne alors un mot de vocabulaire de
> page. C'est vrai, et c'est sans conséquence — ce fichier référence déjà l'algèbre d'expressions
> pour `TextBindingSegment`, et un segment **est** un objet de l'AST quoi que son contenu désigne.
> *L'alternative franchement écartée :* dupliquer le tuple des deux côtés — deux catalogues à tenir
> en phase, ce que `errors.ts:59-65` refuse nommément.


### 3.5 `packages/core/src/ast/types.ts` et `schemas.ts` — le troisième segment

**Ce qui s'ajoute à `types.ts`**, après `TextBindingSegment` et avant l'union :

```ts
/**
 * A page fact only a paginator knows: which page this is, or how many there are.
 *
 * NOT an expression, and that distinction carries the whole decision. A segment is
 * resolved by the render pipeline, never by `evaluateExpression`, so `core` gains no
 * third evaluation input, no page-aware operand and no reserved key in the caller's
 * data. `nodes.ts` already writes the underlying rule: "a segment is not a node -- it
 * is the inline content of one".
 *
 * The consequence to accept: a page field is NOT readable by a predicate. "Only on the
 * last page" stays a declared region rather than a derived condition -- and that is a
 * property, not a limitation. A page number a predicate can read lets content depend on
 * pagination, which depends on content: `if(eq(page, pages), mentions, nothing)` changes
 * what fits on the last page, hence the total, hence the condition. There is no fixed
 * point to converge to, and the symptom is a pagination that oscillates -- a
 * non-deterministic render from an engine that reads neither clock nor randomness. E6 is
 * one of the four things the roadmap never sacrifices.
 *
 * One kind carrying a closed field rather than two kinds, because that is this
 * repository's idiom: a kind names a NATURE, a closed tuple names the instance --
 * `arithmetic` carries `op`, `textCase` carries `op`, `round` carries `mode`.
 *
 * Legal ANYWHERE a text segment is legal, not only inside a page band. Restricting it
 * would require knowing a segment's ANCESTORS, which no local Zod schema can do: it
 * would take a template-wide walk at save time, and it would be the contract's first
 * positional rule. Printing "page 3" inside the flow is legitimate; the engine
 * substitutes the number of the page the segment lands on.
 */
export interface TextPageFieldSegment {
  readonly kind: 'pageField';
  readonly field: PageField;
}

export type TextSegment = TextLiteralSegment | TextBindingSegment | TextPageFieldSegment;
```

et, à côté des autres tuples du fichier :

```ts
/** The two page facts a template can print. Exported as a tuple: a type cannot be iterated. */
export const PAGE_FIELDS = ['number', 'count'] as const;

export type PageField = (typeof PAGE_FIELDS)[number];
```

**Ce qui s'ajoute à `schemas.ts` :**

```ts
export const TextPageFieldSegmentSchema = z.object({
  kind: z.literal('pageField'),
  field: z.enum(PAGE_FIELDS),
});
```

et le troisième membre de l'union existante :

```ts
export const TextSegmentSchema = z.discriminatedUnion('kind', [
  TextLiteralSegmentSchema,
  TextBindingSegmentSchema,
  TextPageFieldSegmentSchema,
]);
```

**Le trou de covariance de C3 se rejoue ici à l'identique, et il faut le dire dans les mêmes termes.**
La docstring de `TextSegmentSchema` (`ast/schemas.ts:30-36`) l'écrit déjà : « *zod declares
`ZodType<out Output, …>`, so it is covariant in its output and a schema that produces less than
`TextSegment` stays assignable and still compiles. The real guard is the mutual-assignability
assertion in nodes.test.ts, which fails in both directions.* » Cette assertion existe déjà, elle
porte sur `TextSegment` — **un type sans tableau**, donc l'assertion mutuelle y **fonctionne**,
contrairement à `PageSetup` [§3.2]. Elle passera au rouge le jour où `TextPageFieldSegmentSchema`
sortira de l'union sans que le type bouge. **Aucune ligne à écrire** : le test existe et il couvre
exactement ce cas. C'est le meilleur retour sur investissement du lot, et il est dû à C1.

**Et une docstring du même fichier devient trompeuse : elle se corrige ici, dans le même incrément.**
`ast/types.ts:325` énumère aujourd'hui ce qu'un `TableNode` ne porte pas, avec le lot propriétaire de
chaque chose : « *no page numbering, no carry-forward (lots E2 and E3)* ». Après ce lot, la
**valeur** reste à E2 mais l'**emplacement** est un segment de C4, et la ligne ne le dit pas. Elle
devient donc l'un de ces énoncés que le dépôt refuse de laisser traîner — le précédent est écrit deux
fois, C2 pour `limits.ts` et C3 pour `guard.ts`. La correction est d'un membre de phrase, et elle ne
touche **aucune valeur** :

```
 * page numbering VALUE and no carry-forward (lots E2 and E3 compute those; lot C4 lets a
 * template PLACE a page number, with a `pageField` segment inside a page band -- see page/).
```

**Une conséquence à ne pas manquer, et elle est gratuite :** `PrintableExpression`,
`PrintableExpressionSchema` et l'algèbre entière sont **inchangés**. Un marqueur n'est pas une
expression, donc `TextBindingSegment.value` ne s'élargit pas, donc **aucune position d'opérande** ne
bouge, donc `case 'round':` reste à **2** fichiers et `const exhaustive: never` à **6** occurrences
[§6.4]. C4 est le premier lot depuis C1 qui ajoute une forme stockée **sans toucher à l'algèbre**.

---

### 3.6 `packages/core/src/ast/visitor.ts` — deux coutures, et l'une est forcée par le compilateur

**Le `SegmentVisitor` gagne un membre**, et c'est le point de rupture volontaire du lot :

```ts
export interface SegmentVisitor<TResult> {
  readonly literal: (segment: TextLiteralSegment) => TResult;
  readonly binding: (segment: TextBindingSegment) => TResult;
  readonly pageField: (segment: TextPageFieldSegment) => TResult;
}
```

```ts
export function visitSegment<TResult>(
  segment: TextSegment,
  visitor: SegmentVisitor<TResult>,
): TResult {
  switch (segment.kind) {
    case 'literal':
      return visitor.literal(segment);
    case 'binding':
      return visitor.binding(segment);
    case 'pageField':
      return visitor.pageField(segment);
    default: {
      const exhaustive: never = segment;
      throw new TypeError(`Unhandled text segment: ${kindOf(exhaustive, 'kind')}`);
    }
  }
}
```

**Ce que le compilateur exige, et dans quel ordre.** Élargir l'union **sans** ajouter le `case` fait
échouer la ligne `const exhaustive: never = segment` — c'est le garde que `visitor.ts:19-28` décrit,
et il fonctionne dans ce sens. Élargir l'interface **sans** ajouter le `case` casse `visitSegment` sur
la propriété non utilisée ; ajouter le `case` **sans** élargir l'interface casse sur `visitor.pageField`
qui n'existe pas. Les trois gestes sont donc **liés par la porte 3** : il n'existe pas d'état
intermédiaire vert. C'est la différence avec le site d'erreur de C3, dont le libellé pouvait être
oublié en silence (`c3, §2 D10`) — ici, rien ne peut être oublié.

**Et la conséquence hors de `core`, qui est le seul détecteur réel du lot.**
`apps/playground/src/App.tsx` appelle `visitSegment(segment, { … })` avec un **objet littéral** à
**deux** endroits — `:439` et `:556`, le second ajouté par C3 pour les cellules de tableau.
Un membre de plus sur l'interface fait donc **échouer la porte 3 du playground** — pas une porte de
`core`, pas un test : le type-check de l'application. Trois choses en découlent, et il faut les écrire
parce que le lecteur du plan C3 s'attend au contraire : le playground **ne peut pas** rester en
retard sur ce lot ; la démonstration d'INC-5 n'est donc pas facultative comme celle de C3 l'était
(`c3, §4`) ; et le [§4] ne peut pas placer INC-2 avant INC-5 sans laisser le dépôt rouge —
**c'est la seule contrainte d'ordre non triviale du lot** [§4].

**`SEGMENT_EXPRESSIONS` gagne une branche, et elle rend le vide :**

```ts
const SEGMENT_EXPRESSIONS: SegmentVisitor<readonly Expression[]> = {
  literal: () => [],
  binding: (segment) => [segment.value],
  // A page field reads no data: its value comes from the paginator, not from the
  // caller's dataset. Returning [] is what keeps `collectDataPaths` from demanding a key
  // no integrator can supply -- the exact defect that sinks the "reserved scope key"
  // mechanism for page numbering.
  pageField: () => [],
};
```

**Ce qui ne change pas dans ce fichier, et pourquoi c'est une bonne nouvelle.** `NodeVisitor`,
`visitNode`, `childrenOf`, `walk`, `findNodeById`, `nodeReads` et `collectDataPaths` sortent du lot
**octet pour octet** : C4 n'ajoute aucun type de nœud. `switch (node.type)` garde son **site unique**,
et les six `const exhaustive: never` du paquet restent six — celui de `visitSegment` gagne un `case`,
il ne se dédouble pas [§6.4].

---

### 3.7 `packages/core/src/template/template.ts` et `migrate.ts` — le champ, l'estampille, la transformation

**Le champ, dans `TemplateSchema` :**

```ts
export const TemplateSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  id: z.string().min(1, 'A template id is required'),
  name: z.string().min(1, 'A template name is required'),
  version: z.string().default('1.0.0'),
  /**
   * The sheet, its margins and its repeated bands.
   *
   * REQUIRED, with no schema default, for two reasons and NOT for a third that looks like
   * one. The recipe criterion says a template IMPOSES its format, and an optional field
   * imposes nothing -- it permits. And an absent page forces the engine to invent a sheet,
   * which moves a layout decision into a render file, with nothing checking that the viewer
   * invents the same one.
   *
   * NOT because required-ness prevents silent loss: it does not. An older build strips a key
   * it does not know whether the newer schema calls it required or optional -- only the schema
   * version protects against that, see CURRENT_SCHEMA_VERSION.
   *
   * A `z.default()` would be worse than optional, and that IS measured: a document with no
   * page parses and comes out carrying a sheet Openview chose, at every parse, silently.
   *
   * The compatibility sheet exists all the same -- but it is written ONCE, by the 4 -> 5
   * migration, where it is visible and dated.
   */
  page: PageSetupSchema,
  root: ContainerNodeSchema,
  createdAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime().optional(),
});
```

**La position du champ dans le littéral n'est pas indifférente**, et c'est un détail de revue plutôt
que de contrat : `page` est écrit **avant** `root`, parce que la géométrie précède le contenu dans
l'ordre de lecture d'un document — et parce qu'un diff qui insère un champ au milieu d'un objet est
plus lisible qu'un champ ajouté à la fin, où il se confond avec les horodatages optionnels.

**La docstring de `CURRENT_SCHEMA_VERSION` gagne sa section**, sur le patron exact des trois
précédentes :

```
 * ## What version 5 means
 *
 * Version 5 is version 4 plus TWO stored shapes, and they move in opposite directions.
 *
 * TOWARDS THE WIDE -- `TextSegment` gains `pageField`, a marker the paginator substitutes.
 * A version 4 build meeting one answers `"No matching discriminator"` / `"Invalid input"`
 * on a path like `root.children.0.content.1.kind`: no version named, no remedy, and a path
 * pointing at a `kind` that is spelt correctly.
 *
 * The path is in `root` and not under `page`, and the reason matters: a version 4 build does
 * not KNOW the `page` key, so it strips the whole field without validating anything inside
 * it. Measured -- a marker written under `page.footer` yields no issue at all. The marker is
 * legal wherever a `TextNode` lives, `root` included, so the widening is detectable exactly
 * where real templates write it.
 *
 * TOWARDS THE NARROW -- `Template.page` becomes REQUIRED. This is the SILENT case, and it
 * is the dangerous one: a version 4 build does not refuse the field, it STRIPS it, and an
 * editor that opens then saves erases the page with no error at all.
 *
 * One version, two directions, one number. And unlike versions 2, 3 and 4, this one comes
 * with a migration that TRANSFORMS rather than stamps: `page` being required, a v4
 * document with no page would otherwise be refused outright -- a real narrowing, and the
 * first that would not be vacuous.
```

**La migration, et c'est la première du dépôt qui transforme :**

```ts
{
  from: 4,
  to: 5,
  /**
   * The first TRANSFORMING migration of this repository, and the reason `parseTemplate`
   * guards the shape twice.
   *
   * `Template.page` is required, so a v4 document carries nothing that satisfies it.
   * Stamping alone would refuse every v4 document with `Invalid input: expected object,
   * received undefined` on the path `page` -- a fifth narrowing on the pre-v1.0
   * assumption, and the first one that is not vacuous: the four existing ones refuse
   * values no document could hold, this one would refuse EVERY document.
   *
   * So it writes a compatibility page. Openview therefore CHOOSES a sheet, once, for
   * documents written before the question existed, and that has to be said in those
   * terms:
   *
   * - it is NOT an environment read -- A4 is a constant of this file, not the machine's
   *   locale, and the difference is exactly what makes it deterministic;
   * - it is NOT a schema default -- a `z.default()` would rewrite the document at every
   *   parse, in silence, forever; this writes it once, on a document stamped 4, and the
   *   result is visible in what gets saved;
   * - it is NOT a de-facto default for new templates -- no template written after this
   *   lot goes through this migration, because the field is required and its author
   *   fills it in. What WILL be copied is the page of the delivered template of designer
   *   lot D9, and that choice belongs to that lot.
   *
   * The `'page' in input` test is not defensive noise, and it is not replaceable by a spread
   * order. A hand-made document stamped 4 may already carry a page -- the stamp only ever
   * guards upward, see the 1 -> 2 entry -- and MEASURED, the two spellings do opposite
   * things: `{ ...input, page: DEFAULT }` OVERWRITES the author's page, while
   * `{ page: DEFAULT, ...input }` preserves it. The second one happens to be right, which is
   * worse than being wrong: it is correct by key order, so the next reader who reorders the
   * object for tidiness silently destroys layouts. The explicit test says what it means.
   *
   * Measured: a v4 document of 7 JSON levels and 16 values comes out at 7 levels and 27
   * values. The page adds eleven values and NO level, so the rule this repository owes
   * itself -- a migration never yields an out-of-bounds shape -- holds for this entry, and
   * the second pass of the guard verifies it at runtime rather than on trust.
   */
  migrate: (input) => ({
    ...input,
    page: 'page' in input ? input.page : COMPATIBILITY_PAGE,
    schemaVersion: 5,
  }),
}
```

avec, au-dessus du registre :

```ts
/**
 * The sheet the 4 -> 5 migration writes on a document that has none: A4 portrait, 20 mm
 * all round, no band. Not a default -- see the migration's own docstring for why the
 * distinction is measurable and not rhetorical.
 */
const COMPATIBILITY_PAGE = {
  sheet: { width: 210, height: 297 },
  margins: { top: 20, right: 20, bottom: 20, left: 20 },
  header: [],
  footer: [],
} as const;
```

> ⚠️ **La constante doit être ANNOTÉE `PageSetup`, et pas seulement figée par `as const` — mesuré.**
> `TemplateMigration.migrate` est typé `(input: Record<string, unknown>) => Record<string, unknown>`
> (`migrate.ts:17`), donc la valeur écrite dans `page` est reçue comme `unknown` : **les deux
> écritures compilent**, et le type du registre ne vérifie rien. Le contrôle vient de l'annotation
> seule. **Mesuré** dans le bac à sable, sur une constante privée de son champ `footer` :
>
> ```
> error TS2741: Property 'footer' is missing in type '{ sheet: …; margins: …; header: never[]; }'
>   but required in type 'PageSetup'.
> ```
>
> Sans l'annotation, la même constante incomplète passe la porte 3 en silence, et la migration produit
> une page que le parse refuse **ensuite** — avec un message qui accuse le document alors que la faute
> est dans la migration. C'est le genre de couture qu'aucune porte ne surveille par elle-même, et
> l'annotation coûte huit caractères.

---

### 3.8 `packages/core/src/template/guard.ts` — la porte bornée, et la docstring qui ne change pas

**La porte bornée**, sur le patron de `parseExpression`, `parseDocumentNode` et `parseBlockNode` :

```ts
/**
 * Parses a standalone page setup WHILE BOUNDING IT.
 *
 * `PageSetupSchema.parse` bounds nothing, and a band carries a `ContainerNode`: measured,
 * 2 000 nested containers inside one band raise a bare `RangeError: Maximum call stack
 * size exceeded` -- the unwrapped error the bounded doors of ADR 0003 decision 8 exist to
 * remove, reopened for the one shape this lot adds. Three lines close it, exactly as
 * `parseBlockNode` did for lot C3.
 *
 * THIS IS NOT A PERSISTENCE BOUNDARY, and neither are its three siblings. It VALIDATES a
 * fragment -- for an editor's partial check, for an integrator's pre-storage check -- and its
 * output is not what you store. `z.object` strips keys it does not know (measured: a `bleed`
 * key is gone after the parse), so round-tripping a fragment through this door and saving the
 * result would silently drop any field a later schema version adds. The only shape whose
 * round trip is guaranteed is the VERSIONED `Template`, because only it carries the
 * `schemaVersion` that turns a future field into a legible refusal instead of a deletion.
 * Same caveat, unchanged, for `parseExpression`, `parseDocumentNode` and `parseBlockNode`:
 * store templates, validate fragments.
 */
export function parsePageSetup(raw: unknown, limits?: Partial<ShapeLimits>): PageSetup {
  assertBoundedShape(raw, limits);
  return PageSetupSchema.parse(raw);
}
```

**Compilé à exit 0** dans le bac à sable, et le `RangeError` est **mesuré** [§5.1, R21] — comme il
l'était pour `parseBlockNode`, qui n'est entré dans le plan C3 qu'à sa revue de contradiction
(`c3, en-tête, constat C-10`). Le schéma reste exporté : « *a zod schema is the attachment point for `z.infer`, for
composition and for the partial validation a Designer needs* » (`guard.ts:253`), et le risque
résiduel est nommé plutôt que déguisé.

> ⚠️ **Le second paragraphe de la docstring répond à une objection externe, et la nuance compte : la
> faille n'est pas créée par C4.** L'objection était qu'exporter un parseur autonome **sans
> `schemaVersion`** ouvre une perte silencieuse — un intégrateur qui parse une page isolée puis
> l'enregistre effacera un champ futur. C'est **exact**, et c'est déjà vrai de `parseExpression`,
> `parseDocumentNode` et `parseBlockNode`, tous trois exportés par le barrel (`index.ts:175-177`). C4
> ajoute la **quatrième** instance d'une propriété du dépôt, pas la première.
>
> **Trois issues ont été pesées, et la seule tenable est de documenter la frontière.** (a) **Rendre les
> schémas autonomes `strict()`** : `TemplateSchema.extend({ page: PageSetupSchema })` cesserait d'être
> composable de la même manière, un champ inconnu deviendrait un **refus dur** au lieu d'une suppression
> version-gardée — donc un rétrécissement pour tout intégrateur qui transporte ses propres métadonnées —
> et les trois portes existantes divergeraient de la quatrième. (b) **Ne pas exporter `parsePageSetup`** :
> réouvre le `RangeError` nu que la porte existe pour supprimer [§5.1, R21]. (c) **Écrire la frontière
> dans la docstring et la signaler** — retenu, et porté en [§8, signalement H] parce que la propriété est
> celle des quatre portes et non de celle-ci.

> ✅ **Ce fichier ne change PAS ailleurs, et le non-geste est vérifié plutôt que supposé.** Les deux
> lots précédents ont chacun dû corriger une docstring que leur propre contenu rendait fausse — C2
> pour la liste de `limits.ts`, C3 pour la mesure de `ShapeLimits.maxDepth` (`c3, §2 D12`). La
> question se pose donc ici, et la réponse est **mesurée** : après C3, la docstring annoncera
> « *18 for the five-column table of lot C3 […] 64 leaves a threefold margin* » ; le modèle de recette
> **combiné C3 + C4** pèse **18** niveaux, donc la phrase reste vraie au mot. Le seul cas qui la
> dépasse est un tableau **placé dans une bande**, à **21** niveaux — un modèle que personne n'écrit,
> et qui laisse encore un rapport de 3,05×. **Aucune ligne de docstring à retoucher** [§2, D12].

---

### 3.9 `packages/core/src/template/paths.ts` — nouveau

**Compilé à exit 0** dans le bac à sable.

```ts
import { collectDataPaths } from '../ast/visitor.js';
import type { PageBand } from '../page/page.js';
import type { Template } from './template.js';

/**
 * Every data path a TEMPLATE reads from the caller's data -- the flow AND the page bands --
 * in traversal order and de-duplicated.
 *
 * `collectDataPaths` takes a NODE, and lot C4 put the repeated bands outside `root`. Without
 * this function, a binding in a header is invisible to every analysis, and the symptom is
 * not an error but a blank: the caller was told to supply `facture.numero`, was never told
 * about `client.nom`, and the header prints empty. Two docstrings in production promise
 * otherwise -- `ports/render.ts` ("collectDataPaths tells the caller which ones") and
 * `template.ts` ("collectDataPaths recovers exactly that") -- so leaving the hole would put
 * two texts of this repository in contradiction.
 *
 * Order is `root`, then `header`, then `footer`, and it is written down because a test that
 * compares an ordered list pins a choice, and an unwritten choice changes by accident.
 *
 * It lives in `template/` rather than in `ast/` because it takes a `Template`: the
 * dependency runs template -> ast, never the other way.
 *
 * The three limits `collectDataPaths` documents are inherited UNCHANGED: a per-item field
 * is invisible, an alias that shadows a caller key is not reported, and an alias bound
 * inside an expression is not either. This lot fixes none and adds none. And it returns
 * nothing for a page-field marker, because that segment reads no data -- which is one of
 * the three arguments that sink the "reserved scope key" mechanism for page numbering.
 */
export function collectTemplateDataPaths(template: Template): readonly string[] {
  const found = new Set<string>(collectDataPaths(template.root));
  const bands: readonly PageBand[] = [...template.page.header, ...template.page.footer];
  for (const band of bands) {
    for (const dataPath of collectDataPaths(band.content)) {
      found.add(dataPath);
    }
  }
  return [...found];
}
```

**Pourquoi un `Set` amorcé par le premier appel plutôt qu'une concaténation dé-dupliquée à la fin.**
Parce que l'ordre est un contrat [§5.3] : `new Set(collectDataPaths(root))` conserve l'ordre
d'insertion de `root`, puis chaque bande ajoute ses chemins **nouveaux** à la suite. Une
concaténation suivie d'un `new Set` donnerait le même résultat ici, mais elle matérialiserait un
tableau intermédiaire de tous les chemins, doublons compris — sans intérêt, et la version ci-dessus
est plus courte.

**Pourquoi `collectDataPaths` n'est pas modifié.** Trois options ont été pesées en [§2, D10] ;
retenue : une fonction de niveau document. Le contrat de nœud reste intact pour ses appelants —
`App.tsx:486` aujourd'hui, l'éditeur qui analysera un fragment demain — et **aucune règle de portée
n'est dupliquée** : la descente reste écrite une seule fois, dans `collectFrom`.

---

### 3.10 `packages/core/src/index.ts` — le barrel, et le point aveugle

**Vingt-deux symboles nouveaux**, en cinq blocs. Le décompte est explicite parce que [§6.4] en fait un
critère, et parce que le plan C3 a dû corriger le sien deux fois (`c3, §6.4`) : *un décompte non
recompté est un décompte faux.*

```ts
export type {
  PageBand,
  PageBandOccurrence,
  PageMargins,
  PageSetup,
  PrintableArea,
  Sheet,
  StandardSheetName,
} from './page/page.js';
export {
  MAX_SHEET_MM,
  MIN_SHEET_MM,
  PAGE_BAND_OCCURRENCES,
  PageBandSchema,
  PageMarginsSchema,
  PageSetupSchema,
  printableAreaOf,
  SheetSchema,
  STANDARD_SHEETS_MM,
} from './page/page.js';
```

soit **7 types** et **9 valeurs** depuis `page/page.js` ; plus, dans les blocs existants :
`PageField` et `TextPageFieldSegment` (types) et `PAGE_FIELDS`, `TextPageFieldSegmentSchema`
(valeurs) depuis `./ast/nodes.js` ; `parsePageSetup` depuis `./template/guard.js` ;
`collectTemplateDataPaths` depuis `./template/paths.js`. **Total : 9 types et 13 valeurs, 22 noms.**
`PAGE_SETUP_SCHEMA_SATISFIES_TYPE` **n'est pas exporté par le barrel** : c'est une assertion de
compilation, pas une API — et l'exporter en ferait une valeur publique dont un consommateur pourrait
dépendre.

> ⚠️ **Le point aveugle, et il est le même que celui du plan C3 : aucune des quatre portes ne voit un
> export oublié.** Un symbole absent du barrel compile, passe le lint, passe les tests et passe la
> couverture — il est simplement inaccessible à un intégrateur. C3 a mesuré que son seul détecteur
> réel était la consommation par le playground, et **partielle** (`c3, §6.4`). Ici la situation
> est meilleure sur un point et identique sur le reste : la démonstration d'INC-5 importe
> `printableAreaOf`, `STANDARD_SHEETS_MM`, `PageSetup`, `collectTemplateDataPaths` et le marqueur, ce
> qui couvre **5 des 22 noms** ; les **17 autres** — dont les quatre schémas et `parsePageSetup` — ne
> sont vérifiés par rien d'autre que le décompte de [§6.4] et la relecture de la PR. Le dire est la
> seule protection disponible ; prétendre le contraire serait la même faute que le plan C3 a corrigée
> chez lui.

---

### 3.11 `packages/designer/src/types.ts` — **non touché**, et pourquoi c'est un résultat

`BlockType` (`designer/src/types.ts:3`) est la liste des types de bloc que l'éditeur autorise. C3 la
fait **dériver** de `BlockNode['type']` pour qu'elle cesse d'être juste par accident. **C4 n'y touche
pas, et n'a pas à y toucher** : le lot n'ajoute **aucun type de nœud**. Le marqueur est un *segment*,
la page est un *champ de document* : ni l'un ni l'autre n'est un bloc que l'utilisateur insère.

C'est écrit ici parce qu'un lecteur du plan C3 s'attendrait à un troisième commit dans INC-5, et que
son absence est une information : **le lot ne modifie qu'un seul paquet de production**,
`@openview/core`. Le playground est une application de démonstration, pas un paquet publié.

**Ce qui viendra plus tard, et qui n'est pas de ce lot :** l'éditeur devra offrir un panneau « mise en
page » (choisir une feuille dans `STANDARD_SHEETS_MM`, régler quatre marges, éditer les bandes) et un
moyen d'insérer un marqueur de numéro. C'est D2 et D4 de l'éditeur, et la roadmap le place après
C10 — donc après la vague 2. Rien à faire aujourd'hui, et rien à réserver.

---

## 4. Les sept incréments

Chacun passe les quatre portes seul et laisse le dépôt cohérent. **Cohérent n'est pas publiable.**
Trois des sept laissent le dépôt dans un état où un document enregistré porterait une estampille qui
ne décrit plus sa forme, et [§2, D11] en tire une règle de conduite plutôt qu'une évaluation au cas
par cas : **INC‑1, INC‑2 et INC‑3 sont non publiables ; le premier commit publiable du lot est
INC‑4.** INC‑0, lui, **serait publiable seul** — il ajoute un dossier que rien ne consomme, sans
toucher à une forme stockée.

⚠️ **Et « non publiable » est plus strict ici qu'en C1, C2 et C3, parce qu'INC‑1 RÉTRÉCIT.** Un build
pris entre INC‑1 et INC‑4 ne dérange pas seulement les documents du build suivant : il **refuse tous les
documents v4 existants**. Conséquence opérationnelle écrite en [§2, D11] : **le lot atterrit en une seule
PR**, jamais par fusions successives d'incréments sur `main`, et aucun artefact intermédiaire ne quitte
la branche. Aucune porte ne l'applique — c'est une règle de revue.

Enchaînement des portes, identique à la CI (`AGENTS.md` §4) :

```bash
pnpm run lint && pnpm run build && pnpm run type-check && pnpm run test:coverage
```

Dépendances entre incréments :

```
INC-0 ──► INC-1 ──► INC-2 ──► INC-3 ──► INC-4 ──► INC-5 ──► INC-6
(page/)   (champ)  (segment)  (chemins) (estampille) (barrel)  (ADR)
  │         │         │                     ▲         │ (a) core
  │         │         └── casse le          │         └─ (b) playground
  │         │             playground        │
  │         └── seule forme persistée       └── premier commit PUBLIABLE
  │             sans estampille
  └── publiable seul, aucune forme stockée
```

> 🔑 **Le poids réel du lot est L, et la roadmap écrit M — c'est une réestimation, pas une correction.**
> `core.md:184` écrit « **Poids :** M », et [§1] défend ce M tel quel : c'est l'estimation **produit**,
> faite avant qu'un contrat n'existe. Après conception, le lot pèse **L** : sept incréments, cinq
> fichiers de production neufs, neuf touchés, deux formes stockées, la première migration transformante
> du dépôt, et une démonstration qui n'est pas facultative. Deux lettres pour deux objets, et la seconde
> n'annule pas la première.
>
> **Et il faut calibrer cette lettre sur une mesure, sinon elle ne veut rien dire.** C3 était coté
> **M** par la même roadmap, s'est réestimé **L** dans son propre plan, et a coûté — **mesuré sur le
> dépôt** — **20 fichiers, +2 312 insertions et −275 suppressions**, dont `App.tsx` à lui seul +496.
>
> ⚠️ **La comparaison qui suivait ce chiffre était fausse, et un relecteur externe l'a épinglée.** Elle
> opposait « C4 touche **14** fichiers » aux 20 de C3 pour conclure « donc plus petit ». Les deux
> nombres ne comptent pas la même chose : les 20 de C3 sont `git diff --stat` **hors `docs/`** — donc
> code **et tests** —, quand les 14 de C4 sont les seuls fichiers de **production** du tableau de [§3].
> **À périmètre égal, C4 touche 22 fichiers** : les 14 de production plus les huit fichiers de test
> qu'énumèrent les sept incréments ci-dessous (`page/__tests__/page.test.ts`,
> `page/__tests__/fixtures.ts`, `ast/__tests__/fixtures.ts`, `ast/__tests__/nodes.test.ts`,
> `ast/__tests__/visitor.test.ts`, `template/__tests__/paths.test.ts`, `template/migrate.test.ts`,
> `template/guard.test.ts`). **22 > 20 : l'argument « plus petit parce que 14 < 20 » est retiré.**
>
> Ce qui reste vrai et ce qui n'est pas mesurable : C4 n'ajoute aucun type de nœud, ne déplace rien et
> n'a aucun refactor, donc son **volume d'insertions** sera vraisemblablement inférieur à celui de C3 —
> mais c'est une prévision, pas une mesure, et un plan ne l'inscrit pas au même rang que les 20 fichiers
> de C3. La conclusion défendable est donc plus faible et suffit : **les deux lots sont du même ordre**,
> et la lettre est **L** pour les deux. La conclusion utile n'est pas « C4 est sous-estimé » mais
> « **les deux lots que la roadmap cote M sortent à L** » — c'est une information sur l'échelle du
> tableau des poids, pas sur ce lot, et c'est à ce titre qu'elle est portée en signalement plutôt qu'en
> correction. **La roadmap n'est pas corrigée pour autant** : INC‑6 ne touche `core.md`
> §C4 que pour son renvoi et sa mention de livraison, exactement comme C3 s'est interdit de réécrire le
> tableau des poids d'une brique entière — ce serait rouvrir l'ordonnancement de la vague 1 en passant.
> L'écart est **porté en [§8], signalement A** : au propriétaire du produit de corriger la roadmap ou
> d'assumer l'écart par écrit.

**La chaîne est linéaire, et une seule dépendance n'est pas de commodité mais de compilation.**
INC‑2 élargit `SegmentVisitor` : `apps/playground/src/App.tsx` appelle `visitSegment` avec un objet
littéral à **deux** endroits — `:439` et `:556`, le second ajouté par C3 pour les cellules de tableau
— donc la porte 3 du playground **casse** dès qu'un membre s'ajoute. INC‑2 emporte par conséquent le
**correctif minimal** du playground (deux branches qui rendent un placeholder), et INC‑5 seul porte la
démonstration visible. C'est la différence avec C3, dont la démonstration était le premier candidat
au sacrifice (`c3, §4`) : ici, **le lot ne peut pas laisser le playground en retard**.

**Point de collision git, et il est franchement plus doux que celui de C3.** Aucun fichier n'est
déplacé, aucun n'est scindé : INC‑0 crée quatre fichiers **neufs** dans un dossier qui n'existe pas.
Les fichiers touchés sont mono‑incrément, à une exception près : `template/template.ts` est écrit par
INC‑1 (le champ) **et** par INC‑4 (l'estampille et sa docstring), sur deux zones disjointes du
fichier. Une branche concurrente sur `packages/core/src/page/` est impossible — le dossier n'existe
pas encore ; une branche concurrente sur `ast/types.ts` ou `ast/schemas.ts` entrerait en conflit avec
INC‑2, sur une union de trois lignes.

**Point de coupe, du plus sacrifiable au moins.** Un lot sans ordre de sacrifice écrit est le lot où
l'on coupe l'estampille ou l'ADR sous la pression, c'est-à-dire les deux seules pièces qui ne se
rattrapent pas.

1. **INC‑5 (b), la démonstration au playground.** Elle coûte une démonstration et aucun contrat. Le
   prix est nommé : le seul détecteur d'un export oublié disparaît avec elle [§3.10], et l'écart de
   [§6.3] devient un critère qu'on affirme au lieu de le montrer. **Attention** : le *correctif
   minimal* du playground, lui, n'est pas coupable — il est dans INC‑2, et sans lui le dépôt est
   rouge.
2. **INC‑3, `collectTemplateDataPaths`.** Coupable au sens strict — rien ne compile moins bien sans
   lui. Le prix est une **promesse rompue en silence** dans deux docstrings de production
   (`ports/render.ts:9-15`, `template.ts:89-93`) et un écran du playground qui mentirait
   (`App.tsx:486`). À ne couper qu'en sachant que le rattrapage est un `feat(core)` séparé, jamais une
   retouche.
3. **INC‑6, l'ADR 0006.** Sans elle, les treize décisions vivent dans un document que son propre
   en‑tête déclare périssable. C'est le dernier à couper, et le plan C3 a écrit pourquoi.

**Ne se coupe jamais**, et chacun pour une raison mesurée :

- **INC‑4.** Sans lui, le lot ne produit aucun commit publiable, un build en circulation **supprime
  en silence** la page des documents du build suivant [§5.1, R23], et [§2, D11] n'aura servi à rien.
- **`parsePageSetup`** (INC‑1, trois lignes). Sans elle, l'union que le lot expose rouvre le
  `RangeError` nu que les portes bornées de l'ADR 0003 décision 8 existent pour supprimer —
  **mesuré** [§5.1, R21].
- **Le garde du contrôle croisé** (INC‑0). Quatre lignes, et **mesuré** : 1 issue avec, 2 sans
  [§5.1, R03].

---

### INC-0 — Le dossier `page/` : types, schémas, aire imprimable, façade · **M**

**Fichiers.** ➕ `packages/core/src/page/types.ts` · ➕ `packages/core/src/page/schemas.ts` ·
➕ `packages/core/src/page/area.ts` · ➕ `packages/core/src/page/page.ts` ·
➕ `packages/core/src/page/__tests__/page.test.ts` · ➕ `packages/core/src/page/__tests__/fixtures.ts`

**Contenu.** Le contrat de [§3.1] à [§3.4], intégralement, plus ses tests. Rien ne le consomme
encore : `Template` n'a pas de champ `page`, le barrel n'exporte rien, et le playground ignore
l'existence du dossier.

**Pourquoi un incrément séparé alors que rien ne l'utilise.** Parce que c'est la revue la plus lourde
du lot — un contrat de dix types et cinq schémas — et qu'elle mérite un diff qui ne contienne **que**
lui. Le plan C3 a fait le même choix pour son INC‑0 (un refactor pur, revu seul) et pour la même
raison : « le travail de la revue est précisément de vérifier que rien d'autre n'a changé ».

**Le sous-dossier `__tests__/` est obligatoire, pas décoratif.** `AGENTS.md` §5 le demande dès qu'un
sous-système multiplie ses tests, et `ast/__tests__/` en est le précédent immédiat. La fixture y suit
les **deux régimes** que le plan C3 a dû découvrir (`c3, §6.4`) : elle est compilée dans `dist/`
et embarquée dans le tarball, **et** elle est instrumentée par la couverture — d'où les deux critères
mécaniques de [§6.4].

**Critère de sortie.** Les quatre portes vertes. `packages/core/src/index.ts` **inchangé octet pour
octet** (`git diff -- packages/core/src/index.ts` vide) : c'est la preuve mécanique qu'aucune surface
publique n'a bougé. Couverture de `page/**` à **100 %** lignes et fonctions — le dossier est neuf,
tout y est atteignable, et un `printableAreaOf` non appelé serait une fonction morte dans un paquet
publié.

---

### INC-1 — Le champ `page`, requis, et la porte bornée · **S**

**Fichiers.** ✏️ `packages/core/src/template/template.ts` (le champ seul, pas l'estampille) ·
✏️ `packages/core/src/template/guard.ts` (`parsePageSetup`) · ✏️ `packages/core/src/ast/__tests__/fixtures.ts`
(`RECIPE_TEMPLATE` gagne sa page) · ✏️ `packages/core/src/template/migrate.test.ts` ·
✏️ `packages/core/src/template/guard.test.ts` · ✏️ `apps/playground/src/App.tsx` (le littéral gagne une page)

**Ce que le compilateur casse, et c'est la liste exacte — mesurée.** `RECIPE_TEMPLATE` est **annoté
`Template`** (`fixtures.ts:151`), donc la porte 3 rougit immédiatement avec
`TS2741: Property 'page' is missing` : c'est le **point d'entrée unique** des tests, et tout ce qui le
diffuse (`table.test.ts:270`, `:328`, `:368`, `visitor.test.ts:254`) suit sans retouche. Ce qui ne
casse **pas** à la compilation, en revanche, ce sont les littéraux **non annotés** de
`migrate.test.ts` (**29** occurrences de `schemaVersion`) et de `guard.test.ts` : ceux-là échouent à
l'**exécution**, au parse, et c'est la porte 4 qui les attrape. Le playground, lui, casse à
l'exécution au chargement du module (`App.tsx:177`, `parseTemplate` appelé au niveau du module), donc
en écran blanc — le détecteur le plus brutal et le plus utile du lot [§2, D2].

> ⚠️ **Ce paragraphe disait le contraire de lui-même, et la correction change le travail d'INC‑1.** Il
> affirmait que les littéraux de `migrate.test.ts` estampillés **en dessous** de la version courante
> « continuent de passer », puis, dans la même phrase, qu'« ils échouent au parse comme les autres », et
> concluait sur « le seul endroit du lot où un test rouge redevient vert sans qu'on le touche ». Les
> trois ne peuvent pas être vrais ensemble, et le troisième contredit l'ouverture de [§4] : *chacun des
> sept incréments passe les quatre portes seul.*
>
> **Ce qui se passe réellement, et c'est mécanique.** `parseTemplate` migre **puis** valide contre le
> schéma **courant**. À INC‑1, le schéma courant exige `page` et aucune migration n'en écrit : **tout**
> littéral de test qui traverse `parseTemplate` échoue, quelle que soit son estampille — v1, v2, v3 ou
> v4. Il n'y a pas de sous-ensemble épargné.
>
> **Conséquence sur le contenu d'INC‑1 :** il **doit** donner une `page` à ces littéraux, sinon la
> porte 4 est rouge et l'incrément ne tient pas sa propre règle. C'est pour cela que
> `migrate.test.ts` et `guard.test.ts` figurent dans la liste des fichiers ci-dessus, et le geste n'est
> pas symbolique : **29** occurrences de `schemaVersion` dans `migrate.test.ts`.
>
> **Conséquence sur INC‑4 :** la migration rend alors la page **facultative dans le littéral**, pas dans
> le schéma. INC‑4 n'a donc pas à défaire le geste d'INC‑1 — il **ajoute** un littéral v4 délibérément
> **sans** page, qui est le sujet du contrat 2 de [§5.4]. Deux littéraux voisins, deux propriétés
> distinctes : celui d'INC‑1 vérifie qu'un document complet traverse la chaîne, celui d'INC‑4 que la
> migration remplit ce qui manque. **Aucun test ne redevient vert tout seul.**

**Critère de sortie.** Les quatre portes vertes — y compris la porte 4, ce qui **exige** que les
littéraux de `migrate.test.ts` et `guard.test.ts` portent une page. `parsePageSetup` exporté depuis
`guard.ts` et **pas encore** depuis le barrel. Un `it` mesure le `RangeError` que la porte bornée
supprime [§5.1, R21]. `CURRENT_SCHEMA_VERSION` **toujours à 4** — l'estampille est INC‑4, et
l'incrément qui la pose n'est pas celui qui casse la forme. **Et le rappel qui vaut plus que les
autres :** ce commit ne quitte pas la branche seul [§2, D11].

---

### INC-2 — Le segment marqueur, et le playground qui ne compile plus sans lui · **S**

**Fichiers.** ✏️ `packages/core/src/ast/types.ts` (`TextPageFieldSegment`, `PAGE_FIELDS`, l'union
élargie) · ✏️ `packages/core/src/ast/schemas.ts` (le schéma, l'union élargie) ·
✏️ `packages/core/src/ast/nodes.ts` (la façade) · ✏️ `packages/core/src/ast/visitor.ts`
(`SegmentVisitor`, `visitSegment`, `SEGMENT_EXPRESSIONS`) · ✏️ `packages/core/src/ast/__tests__/nodes.test.ts` ·
✏️ `packages/core/src/ast/__tests__/visitor.test.ts` · ✏️ `apps/playground/src/App.tsx` (**correctif
minimal**, deux sites)

**L'ordre des trois gestes de `core` est imposé par le compilateur**, et il n'existe aucun état
intermédiaire vert [§3.6] : l'union, l'interface et le `case` se posent ensemble ou rien ne compile.
C'est la meilleure propriété de cet incrément — la faute que C3 a dû surveiller par un critère de
sortie (le libellé oublié, `c3, §2 D10`) est ici **impossible**.

**Le correctif minimal du playground, et pourquoi il n'est pas la démonstration.** Deux branches
`pageField:` qui rendent une chaîne visible — par exemple `'1'` pour `number` et `'1'` pour `count`,
avec un commentaire disant que le playground **n'a pas de paginateur** et que ces valeurs sont des
espaces réservés. Trois lignes, aucune mise en page. La démonstration — dessiner la feuille à
l'échelle, montrer les bandes et leurs occurrences — est en INC‑5, et elle est coupable ; celui‑ci ne
l'est pas.

**Et la docstring de `ast/types.ts:325` est corrigée dans ce commit, pas dans un autre.** Elle
attribue aujourd'hui la numérotation à E2 et E3 sans distinguer la valeur de l'emplacement ; après ce
commit, elle mentirait. C'est le geste que C2 a fait pour `limits.ts` et C3 pour `guard.ts`, et le
libellé exact est en [§3.5].

**Critère de sortie.** Les quatre portes vertes, y compris le type‑check du playground. L'assertion
d'assignabilité mutuelle **existante** de `nodes.test.ts` couvre le nouveau membre sans une ligne
nouvelle [§3.5] — à vérifier une fois à la main en retirant `TextPageFieldSegmentSchema` de l'union :
les portes 1, 2 et 3 restent vertes, la porte 4 rougit. `git grep -c "case 'round':"` toujours à **2**
fichiers, `const exhaustive: never` toujours à **6** [§6.4]. Et
`git grep -n "no page numbering" -- packages/core/src` ne rend **plus** la forme non qualifiée : c'est
le critère qui épingle la correction de docstring, faute de quoi elle se perd dans un diff de trois
fichiers.

---

### INC-3 — `collectTemplateDataPaths`, la promesse qui couvrirait les bandes · **S**

**Fichiers.** ➕ `packages/core/src/template/paths.ts` ·
➕ `packages/core/src/template/__tests__/paths.test.ts`

**Contenu.** [§3.9], et les tests de [§5.3] — dont celui qui **échouerait aujourd'hui** : une liaison
dans un en‑tête, invisible pour `collectDataPaths(template.root)`.

**Pourquoi ce n'est pas dans INC‑1.** Parce que le champ et la promesse d'analyse sont deux revues
différentes : l'une porte sur une forme stockée, l'autre sur une garantie faite à l'appelant. Et
parce que couper l'un ne doit pas couper l'autre — [§4, point de coupe] met INC‑3 en deuxième
position, et un incrément fusionné n'aurait pas cette propriété.

**Critère de sortie.** Un `it` qui compare la liste **ordonnée** — `root`, puis `header`, puis
`footer` — et un `it` qui vérifie la dé‑duplication d'un chemin lu des deux côtés. La fonction
exportée depuis `paths.ts` et **pas encore** depuis le barrel.

---

### INC-4 — L'estampille 5, et la première migration transformante · **S**

**Fichiers.** ✏️ `packages/core/src/template/template.ts` (`CURRENT_SCHEMA_VERSION`, la section
« What version 5 means ») · ✏️ `packages/core/src/template/migrate.ts` (`COMPATIBILITY_PAGE`, l'entrée
`4 → 5`) · ✏️ `packages/core/src/template/migrate.test.ts`

**Contenu.** [§3.7] et les quatre contrats de test de [§5.4].

**Premier commit publiable du lot.** À partir d'ici, un build en circulation ne supprime plus la page
des documents du build suivant, et un document v4 s'ouvre en v5 avec sa feuille de compatibilité.

**Critère de sortie.** `CURRENT_SCHEMA_VERSION === 5` ; `TEMPLATE_MIGRATIONS.length === 4`, première
entrée toujours `{ from: 1, to: 2 }`, chaîne `[[1,2],[2,3],[3,4],[4,5]]` ; un document v4 **sans**
page ressort avec `COMPATIBILITY_PAGE` complet ; un document v4 **avec** une page hand‑made la
conserve ; un document estampillé 6 rend `TemplateMigrationError` en nommant la version ;
`COMPATIBILITY_PAGE` **annoté `PageSetup`** [§3.7].

---

### INC-5 — Le barrel, et la démonstration · **M**

**(a) `core`.** ✏️ `packages/core/src/index.ts` — les **22** noms de [§3.10], en cinq blocs. Aucun
autre fichier.

**(b) le playground.** ✏️ `apps/playground/src/App.tsx` — la démonstration de [§6.3] : la feuille
dessinée **à l'échelle** depuis `sheet` et `margins`, la zone imprimable obtenue par
`printableAreaOf` et non recalculée sur place, les bandes rendues avec leur occurrence lisible, le
marqueur de numéro rendu tel que le playground peut honnêtement le rendre, et la liste des chemins de
données produite par `collectTemplateDataPaths` — donc **incluant** ceux de l'en‑tête, ce qui est
visible à l'écran (`App.tsx:486`).

L'avertissement de `App.tsx:171-176` est **complété** dans le même geste : les dimensions ci‑dessous
sont celles d'une feuille A4 **parce que l'auteur du modèle l'a écrit**, et Openview n'impose aucun
format — même règle que pour les noms de champs et les identifiants de colonnes.

**Critère de sortie.** Les quatre portes vertes ; les 22 noms importables depuis `@openview/core` ;
**5 d'entre eux réellement importés par le playground**, les 17 autres listés dans la PR [§3.10].

---

### INC-6 — L'ADR 0006, et les documents qui pointent vers elle · **M**

**Fichiers.** ➕ `docs/adr/0006-la-page.md` · ✏️ `docs/roadmap/core.md` (§C4 : la mention de livraison
et le renvoi) · ✏️ `docs/plans/c4-la-page.md` (ce plan : son `**Statut :**` passe à périmé) ·
✏️ `docs/adr/0005-le-tableau-de-lignes.md` (une ligne « Complété par », sur le modèle de
l'ADR 0001 amendée par l'ADR 0003)

**Contenu.** Les treize décisions de [§2], chacune avec son motif, ses alternatives écartées, son
verdict de réversibilité et son signal de réouverture. Plus **quatre** choses qui n'appartiennent
qu'à l'ADR :

1. **La section « Conséquences — attentes envers E2, E3 et V1 »**, dont l'attente d'oscillation de
   [§2, D6] : réserver la hauteur de la plus haute bande applicable de chaque côté, pour que la zone
   de texte ne dépende pas du rang de la page. C'est la seule pièce du lot qui parle du moteur, et
   elle est hors du code exprès — écrire le comportement du moteur dans une docstring est la faute
   que C3 a dû réparer (`c3, en-tête, constat C-01`).
2. **La correction d'un énoncé faux du dépôt**, et il est opposable : `c1, §1` écrit « Mais **C4 ne
   débloque aucun lot en aval** » et `c2, §1` « **C4 et C3 ne débloquent aucun lot en aval** ».
   C'est faux — `core.md:223` donne « C7 — Dépend de : C4 », et C8 dépend de « C1 à C7 »
   (`core.md:236`). Le plan C3 a déjà corrigé la moitié « C3 » de cette phrase (`c3, §7`) en laissant
   la moitié « C4 » debout. L'ADR 0006 nomme les deux lignes **sans réécrire les plans périmés** :
   c'est la forme que C3 a retenue, et elle évite de retoucher des documents que leur en‑tête déclare
   sans autorité.
3. **La question laissée ouverte**, et il en reste **exactement une** maintenant que les sept
   arbitrages sont tranchés [§8] : *qui déclare qu'un document change de format en cours de route ?*
   Elle n'est attribuée à personne, et ce lot n'a aucune information pour la trancher — exactement le
   traitement que C3 a réservé à la direction d'écriture (`c3, en-tête`).
   ⚠️ **Et l'ADR doit consigner les sept décisions du 2026‑08‑18 avec leurs branches non retenues**, y
   compris celle que la décision a écartée (n° 6, recommandation A). Une ADR qui ne garderait que les
   options gagnantes ferait passer sept décisions de produit pour des évidences de conception, et le
   prochain lot qui voudra rouvrir l'une d'elles n'aurait ni le motif ni le coût sous les yeux.
4. **Un avis à l'ADR 0005 sur l'un de ses critères mécaniques.** Sa sonde de couverture par fichier
   cherche « le premier chemin finissant par `fixtures.ts` » ; C4 crée le second, et la sonde se
   mettrait à mesurer un fichier au hasard **en restant verte**. La forme corrigée est en [§6.4]. Ce
   n'est pas une correction de l'ADR 0005 — elle fait foi sur ses décisions — c'est un signalement, et
   il doit être écrit là où le prochain lecteur le trouvera.

**Critère de sortie.** L'ADR existe, est en 🟢, couvre les treize décisions ; `core.md` §C4 porte sa
mention de livraison ; ce plan porte son `**Statut :**` périmé ; et `AGENTS.md` ne gagne **aucune**
entrée — vérifié par la commande de [§6.4], sur la base du point de branche.

---

### Ce qui ne se touche pas

| Fichier | Consigne |
| :--- | :--- |
| `packages/core/src/errors.ts` | **Rien.** Aucun code, aucun site — [§2, D9]. C4 ne rouvre pas la discussion que C3 a dû tenir pour y écrire une ligne |
| `packages/core/src/expression/**` | **Rien.** Le marqueur n'est pas une expression ; l'algèbre reste à 19 kinds |
| `packages/core/src/ast/visitor.ts`, partie nœuds | `NodeVisitor`, `visitNode`, `childrenOf`, `walk`, `findNodeById`, `nodeReads`, `collectDataPaths` **inchangés** |
| `packages/core/src/template/guard.ts`, docstrings de bornes | **Inchangées** — vérifié : le modèle de recette combiné pèse 18 niveaux, la phrase de `guard.ts:43-46` reste vraie [§2, D12] |
| `packages/designer/src/types.ts` | **Rien.** Aucun type de nœud nouveau [§3.11] |
| `packages/viewer/**`, `packages/engine/**` | **Rien.** Aucun consommateur à écrire dans ce lot |
| `tsconfig*.json`, `biome.jsonc`, `tools/biome/*.grit`, `turbo.json`, `vitest.config.ts` | **Rien** (`AGENTS.md` §7) |
| `packages/*/package.json`, `pnpm-workspace.yaml` | **Rien.** Aucune dépendance nouvelle |
| `AGENTS.md` | **Aucune entrée.** Ce lot n'amende aucune règle de gouvernance — la différence avec C2, dont la définition de fini en exigeait une |

---

## 5. Le plan de test

Quatre familles, et une règle qui les gouverne : **aucun test tautologique** (`AGENTS.md` §5). Un test
qui n'assure aucun contrat rend la métrique mensongère, et le seuil de 90 % est mesuré sur *tout*
`packages/core/src/**` — pas seulement sur ce qu'un test importe (`vitest.config.ts:39-41`).

### 5.1 Les refus au *save time* — messages et chemins **mesurés**

Tous les refus ci-dessous ont été **exécutés** contre un build de `main` (commit `c5e0006`) produit
dans le bac à sable, avec le contrat de [§3] écrit tel qu'il y figure. Colonne « chemin » = le `path`
Zod tel qu'il sort, joint par des points ; colonne « message » = la chaîne exacte.

| # | Ce qui est écrit | Code | Chemin | Message |
| :-- | :--- | :--- | :--- | :--- |
| R01 | pas de `page` | `invalid_type` | `page` | `Invalid input: expected object, received undefined` |
| R02 | `sheet.width` absente | `invalid_type` | `page.sheet.width` | `Invalid input: expected number, received undefined` |
| R03 | `sheet.width: 0` | `too_small` | `page.sheet.width` | `Too small: expected number to be >=1` |
| R04 | `sheet.width: 6000` | `too_big` | `page.sheet.width` | `Too big: expected number to be <=5080` |
| R05 | `sheet.width: NaN` | `invalid_type` | `page.sheet.width` | `Invalid input: expected number, received NaN` |
| R06 | `sheet.height: Infinity` | `invalid_type` | `page.sheet.height` | `Invalid input: expected number, received number` |
| R07 | `margins.top: -1` | `too_small` | `page.margins.top` | `A margin cannot be negative` |
| R08 | `margins.top: 6000` | `too_big` | `page.margins.top` | `A margin is at most 5080 mm` |
| R09 | `margins.left + right >= width` | `custom` | `page.margins` | `Horizontal margins leave no printable width.` |
| R10 | `margins.top + bottom >= height` | `custom` | `page.margins` | `Vertical margins leave no printable height.` |
| R11 | les deux à la fois | `custom` ×2 | `page.margins` ×2 | les deux messages, **dans cet ordre** |
| R12 | `on: 'oddPages'` | `invalid_value` | `page.footer.0.on` | `Invalid option: expected one of "every"\|"firstOnly"\|"exceptFirst"\|"exceptLast"\|"lastOnly"` |
| R13 | deux bandes `every` du même côté | `custom` | `page.footer.1.on` | `Two bands on the same side can apply to the same page.` |
| R13b | `every` **+** `lastOnly` | `custom` | `page.footer.1.on` | **le même message que R13** |
| R13c | `every` **+** `exceptLast` | `custom` | `page.footer.1.on` | **le même message que R13** |
| R13d | `firstOnly` **+** `exceptLast` | `custom` | `page.footer.1.on` | idem — les deux tombent sur la page 1 dès deux pages |
| R13e | `exceptFirst` **+** `lastOnly` | `custom` | `page.footer.1.on` | idem — les deux tombent sur la dernière dès deux pages |
| R13f | `exceptFirst` **+** `exceptLast` | `custom` | `page.footer.1.on` | idem — les deux tombent au milieu dès **trois** pages |
| R13g | `firstOnly` **+** `lastOnly` | `custom` | `page.footer.1.on` | idem — sur un document d'**une** page, c'est la même feuille |
| R13h | `firstOnly` + `exceptFirst` + `lastOnly` | `custom` | `page.footer.2.on` **seulement** | la paire licite passe, l'intruse est désignée |
| R14 | `content` n'est pas un conteneur | `invalid_value` **+** `invalid_type` | `…content.type` **et** `…content.children` | `Invalid input: expected "container"` / `… expected array, received undefined` |
| R15 | une `tableRow` nue dans une bande | `invalid_union` | `page.footer.0.content.children.1.type` | `Invalid input` (« No matching discriminator ») |
| R16 | `field: 'total'` sur le marqueur | `invalid_value` | `…content.1.field` | `Invalid option: expected one of "number"\|"count"` |
| R17 | `field` **absent** sur le marqueur | `invalid_value` | `…content.1.field` | **le même message que R16** |

> ⚠️ **Sept lignes de ce tableau — R13b à R13h — n'existaient pas, et deux causes s'y ajoutent.** Les
> trois premières comblent un invariant trop faible : `every` + `lastOnly` et `every` + `exceptLast`
> étaient **acceptés** par la rédaction initiale, qui ne refusait que les doublons [§2, D6]. Les quatre
> suivantes viennent de l'arbitrage n° 6 tranché en **B** : `firstOnly` et `exceptFirst` créent quatre
> couples nouveaux, **tous refusés sauf leur propre paire**. Toutes ont été **mesurées après coup**,
> contre une réplique fidèle du schéma sur le `zod@3.25.76` du dépôt — le tableau exhaustif des 31 cas
> est en [§3.2] — et non pendant la campagne initiale.
>
> **Deux lignes du tableau initial changent aussi.** R12 ne peut plus mesurer `on: 'firstOnly'`, qui est
> désormais **licite** : la valeur invalide est `'oddPages'`, et le message énumère les **cinq** options
> dans l'ordre du tuple. Et R13 ne dit plus « *claim the same occurrence* » mais « *can apply to the same
> page* » — le message a été réécrit **parce que le refus a changé de portée**, et un message qui
> décrirait encore le doublon serait faux sur les sept lignes qui suivent.

**Cinq de ces lignes portent une information qu'un plan écrit sans mesurer n'aurait pas eue.**

**R03 est une cascade, et c'est le garde qui la supprime.** Sans le garde de `PageSetupSchema`
[§3.2], une largeur nulle rend **deux** issues : le `too_small` de la largeur **et** le `custom` des
marges horizontales, parce que `30 >= 0` est vrai. Mesuré : **2 issues sans le garde, 1 avec.** La
seconde était un dommage collatéral de la première, et la promesse faite à C8 est un message à la
fois. Le garde est **atteint** par toute feuille mal dimensionnée — donc couvert par un `it`, jamais
du code mort ; c'est la transposition exacte du garde `declared.size === 0` de C3, dont la mesure
était « 1 issue avec, 13 sans ».

**R06 rend un message inexploitable, et il ne vient pas de ce lot.** `Invalid input: expected number,
received number` est ce que zod dit d'un `Infinity`. C'est vrai de **toutes** les positions
numériques du contrat depuis C1 ; C4 ne l'aggrave pas et ne le corrige pas. La ligne est écrite pour
que C8 la trouve.

**R14 est une cascade de deux, et elle est structurelle.** `ContainerNodeSchema` est un `z.object`, pas
une union discriminée : un `TextNode` mis à la place d'un conteneur échoue **deux fois**, sur le
discriminant et sur le champ absent. Rien à corriger dans ce lot — la forme vient de C1 — mais deux
messages pour une faute est exactement ce que [§2, D9] promet d'éviter ailleurs, et il faut donc dire
que celui-là subsiste.

**R15 est gratuit.** La coupure `BlockNode` de C3 s'applique au contenu d'une bande sans une ligne de
C4, parce que `PageBand.content` est un `ContainerNode` [§2, D6]. C'est le meilleur retour sur
investissement du choix de type, et il est mesuré.

**R17 est un piège pour C8, et il vaut pour les DEUX énumérations du lot.** Un `field` **absent** rend
le message des options invalides, pas « champ requis » : `z.enum` traite `undefined` comme une option
inconnue. Un utilisateur qui a oublié le champ lira donc « expected one of "number"|"count" », ce qui
est **exact mais trompeur**. **Mesuré aussi sur `on`** : une bande sans occurrence rend
`Invalid option: expected one of "every"|"firstOnly"|"exceptFirst"|"exceptLast"|"lastOnly"`, jamais
« champ requis ». À consigner pour C8, pas à corriger ici : le corriger demanderait de remplacer les
énumérations par des unions de littéraux, donc de changer les messages de R12 et R16 aussi.

**Trois contrôles positifs**, parce qu'une liste de refus sans contrôle positif ne prouve pas que le
schéma accepte quoi que ce soit :

| # | Ce qui est écrit | Résultat mesuré |
| :-- | :--- | :--- |
| R18 | le modèle de recette de [§6.2] | **accepté** |
| R19 | `header: []`, `footer: []` | **accepté** — un modèle sans bande est légitime |
| R20 | quatre marges à `0` | **accepté** — refuser zéro serait une règle de typographie |

**Et trois mesures qui ne sont pas des refus de schéma mais des propriétés du dépôt :**

| # | Ce qui est mesuré | Résultat |
| :-- | :--- | :--- |
| R21 | `PageSetupSchema.parse` de 2 000 conteneurs dans une bande | **`RangeError: Maximum call stack size exceeded`** — nu, non typé |
| R22 | la même charge via `parsePageSetup` / `assertBoundedShape` | **`TemplateShapeError`**, code `too-deep`, limite `64` |
| R23 | une clé inconnue (`bleed: 3`) dans une page | **supprimée** : les clés après parse sont `sheet,margins,header,footer` |
| R24 | un document portant `page`, parsé par un build **v4** | **`page` supprimée**, zéro issue — la perte silencieuse de [§2, D2] |

R21 et R22 sont l'argument entier de la porte bornée [§3.8] : la même charge, deux erreurs, et une
seule est narrable par C8. R23 est le filet qui remplace l'assertion d'assignabilité mutuelle
indisponible [§3.2] : un champ que la fixture porte et que le schéma ignore fait rougir l'aller-retour
`toStrictEqual`, **et ce test existe déjà** — `table.test.ts:368-373` parse `RECIPE_TEMPLATE` puis
compare `JSON.parse(JSON.stringify(parsed))` à la fixture. Il suffit que la fixture gagne sa page pour
que ce test couvre aussi la page. R24 est ce que l'estampille de [§2, D11] convertit en message.

**R23 a une seconde lecture, et elle est moins agréable : c'est aussi la démonstration que
`parsePageSetup` n'est pas une frontière de persistance.** La même suppression qui sert de filet aux
tests efface un champ futur chez un intégrateur qui parserait une page isolée puis l'enregistrerait.
Ce n'est pas une nouveauté de C4 — les trois portes de C1 et C3 exportées par le barrel ont la même
propriété — mais c'est écrit dans la docstring de la porte et porté en [§8, signalement H], parce
qu'une propriété vraie de quatre fonctions publiques ne se laisse pas dans un plan périssable.

---

### 5.2 Le câblage — ce qui casse à la compilation, et ce qui ne casse pas

C'est la section que le plan C3 a rendue obligatoire : « *ce qui NE casse PAS, donc ce que seule une
revue ou un test attrape* ».

| Geste fautif | Porte 1 (lint) | Porte 2 (build) | Porte 3 (type-check) | Porte 4 (tests) |
| :--- | :--- | :--- | :--- | :--- |
| Élargir `TextSegment` sans ajouter le `case` de `visitSegment` | vert | **ROUGE** | **ROUGE** | — |
| Ajouter le `case` sans élargir `SegmentVisitor` | vert | **ROUGE** | **ROUGE** | — |
| Élargir `SegmentVisitor` sans toucher au playground | vert | vert *(core)* | **ROUGE** *(playground)* | — |
| Retirer `TextPageFieldSegmentSchema` de `TextSegmentSchema` | vert | vert | **vert** | **ROUGE** *(assertion de `nodes.test.ts`)* |
| Élargir `PAGE_BAND_OCCURRENCES` sans étendre `BAND_OCCURRENCE_CONFLICTS` | vert | **ROUGE** *(TS2741)* | **ROUGE** | — |
| Rendre `page` requis sans mettre à jour `RECIPE_TEMPLATE` | vert | **ROUGE** | **ROUGE** | — |
| Rendre `page` requis sans mettre à jour `migrate.test.ts` | vert | vert | vert | **ROUGE** *(au parse)* |
| Oublier un champ dans `COMPATIBILITY_PAGE` **annoté** | vert | **ROUGE** *(TS2741)* | **ROUGE** | — |
| Oublier un champ dans `COMPATIBILITY_PAGE` **non annoté** | vert | vert | vert | **ROUGE** *(au parse, message trompeur)* |
| Ajouter un champ à `PageSetup` sans l'ajouter au schéma | vert | vert | vert | **ROUGE** *(aller-retour `toStrictEqual`)* |
| Oublier `printableAreaOf` dans le barrel | vert | vert | vert | vert — **rien ne le voit** |
| Oublier l'un des 22 exports du barrel | vert | vert | vert | vert — **rien ne le voit** |
| Oublier l'estampille d'INC-4 | vert | vert | vert | **ROUGE** *(l'attendu littéral de la chaîne)* |
| Oublier la migration mais poser l'estampille | vert | vert | vert | **ROUGE** *(tout document v4 échoue au parse)* |

**Trois lignes de ce tableau sont les seules qui comptent vraiment.**

La troisième — *élargir `SegmentVisitor` sans toucher au playground* — est la meilleure nouvelle du
lot : la porte 3 d'une **application** attrape un changement de contrat, à deux sites mesurés
(`App.tsx:439` et `:556`). C3 n'avait pas cet avantage : son détecteur était partiel et sacrifiable.

La quatrième — *retirer un membre de l'union de schémas* — est le **trou de covariance** que
`ast/schemas.ts:30-36` et `:61` documentent déjà. C4 n'a **aucune ligne à écrire** pour s'en protéger :
l'assertion mutuelle de `nodes.test.ts` porte sur `TextSegment`, un type **sans tableau**, donc elle
fonctionne — contrairement à celle qu'on voudrait écrire sur `PageSetup` [§3.2]. À vérifier une fois à
la main, puis annuler.

Les deux lignes « **rien ne le voit** » sont le point aveugle assumé de [§3.10]. Le seul contrepoids
est le décompte de [§6.4] et la relecture de la PR — et l'écrire est la seule protection disponible.

---

### 5.3 Les chemins de données, et l'ordre

Quatre `it`, dont un qui **échouerait sur le dépôt d'aujourd'hui** — c'est la définition d'un test qui
assure un contrat.

1. **Une liaison dans l'en-tête est rendue.** Un modèle dont l'en-tête lit `client.nom` et dont le
   corps lit `facture.total` : `collectTemplateDataPaths` rend les deux ; `collectDataPaths(root)` ne
   rend que le second. Le second appel est **dans le test**, explicitement, pour que le test dise ce
   qu'il protège au lieu de le supposer.
2. **L'ordre est `root`, puis `header`, puis `footer`** — comparé sur une liste ordonnée, pas sur un
   ensemble. Un ordre non épinglé change par accident [§3.9].
3. **La dé-duplication traverse les frontières.** `facture.numero` lu dans l'en-tête **et** dans le
   corps sort **une** fois.
4. **Un marqueur de numéro ne produit aucun chemin.** Un pied de page qui ne contient que
   `Page ⟨number⟩ / ⟨count⟩` rend une liste **vide** pour cette bande. C'est ce qui distingue le
   mécanisme retenu de la clé réservée dans le scope, qui aurait réclamé `page.numero` à l'intégrateur
   [§2, D7].

**Ce qui n'est PAS testé, et pourquoi ce n'est pas un oubli.** Les trois limites que
`collectDataPaths` documente — un champ d'item invisible, un alias qui masque une clé de l'appelant, un
alias lié dans une expression — sont **inchangées** et déjà couvertes par les tests de C1 et C3. Les
retester ici ne prouverait rien de neuf ; les mentionner dans la docstring de la fonction nouvelle est
en revanche obligatoire, sinon elle promet plus qu'elle ne tient.

---

### 5.4 Migration — les quatre contrats

1. **La chaîne.** `TEMPLATE_MIGRATIONS.map((m) => [m.from, m.to])` rend `[[1,2],[2,3],[3,4],[4,5]]`, et
   la première entrée est **toujours** `{ from: 1, to: 2 }`. C'est le test que C3 a vu rougir pour la
   seule raison de son attendu littéral, et c'est **le seul filet mécanique de l'estampille**.
2. **Un document v4 sans page ressort complet.** `parseTemplate` d'un document estampillé 4 rend
   `schemaVersion: 5` et une `page` **égale à `COMPATIBILITY_PAGE`** — comparée champ par champ, pas
   seulement testée pour sa présence : une migration qui écrirait une page partielle passerait un test
   d'existence.
3. **Un document v4 qui porte déjà une page la conserve.** Le cas existe : l'estampille ne garde que
   vers le haut, donc un document hand-made ou produit par un build de mi-lot peut porter une page en
   étant estampillé 4. La migration ne doit pas l'écraser — c'est ce que teste ce contrat, et c'est la
   raison du `'page' in input` de [§3.7].
4. **Un document estampillé 6 est refusé en nommant la version.** `TemplateMigrationError`, avec le
   message que `migrate.ts` produit déjà : *« Template uses schema version 6 but this build
   understands at most 5. It was written by a newer release of Openview; upgrade before opening
   it. »* **Mesuré** dans sa forme v4/v5 sur le build actuel.

**Et un cinquième contrôle, qui n'est pas un test mais une vérification à la main, une fois :** la
sortie de la migration reste **bornée**. Mesuré — un document v4 de **7 niveaux et 16 valeurs** sort à
**7 niveaux et 27 valeurs**. La règle que `migrate.ts:206-217` s'est donnée (« *une migration ne rend
jamais une forme hors bornes* ») est tenue par cette entrée, et le **second passage** du garde dans
`parseTemplate` le vérifie à l'exécution — ce qui fait de C4 le premier lot où ce second passage sert
réellement à quelque chose.

---

### 5.5 Ce qui reste hors des tests, et pourquoi

- **La couverture de `page/**` doit être à 100 %**, pas à 90 %. Le dossier est neuf et tout y est
  atteignable : une branche non couverte y désigne du code mort, pas une difficulté de test. Le seuil
  global reste celui du dépôt ; ce critère-là est **par fichier** et vit en [§6.4], sur le patron que
  C3 a dû inventer pour sa fixture.
- **La fixture de `page/__tests__/` ne porte que des constantes et les fabriques qui les
  construisent.** Elle est compilée dans `dist/` et embarquée dans le tarball, **et** instrumentée par
  la couverture : les deux régimes que C3 a découverts. D'où les deux critères mécaniques de [§6.4], et
  la règle : **aucun import depuis `vitest`**, **aucune fabrique exportée non appelée**.
- **Aucun test de rendu, aucun test de pagination, aucune image de référence.** Le lot ne produit ni
  page ni pixel : un test qui affirmerait « la bande se répète » testerait un moteur qui n'existe pas.
  C'est E7 qui portera le lot de documents figés.
- **Aucun test de performance.** [§2, D12] explique pourquoi aucun chiffre de budget n'est avancé : le
  coût d'évaluation des bandes est linéaire en nombre de **pages**, et le nombre de pages n'est pas
  une donnée du modèle. Mesurer une boucle écrite pour la sonde donnerait un chiffre qui décrit la
  sonde.
- **Aucun test de l'exactitude flottante de `printableAreaOf` au-delà d'un cas.** Un `it` épingle le
  cas Letter — `printableAreaOf` d'une feuille `215.9 × 279.4` à marges de `25.4` rend
  `165.10000000000002`, et non `165.1`. C'est laid, c'est exact, et c'est **le** test qui empêche
  quelqu'un de « corriger » la formule en la réécrivant `(w - l) - r` : la valeur attendue change, donc
  le test rougit, donc la question se pose en revue au lieu de se glisser dans un diff. Épingler un
  chiffre laid est ici un service rendu, pas une négligence.

---

## 6. Le critère de recette, et comment on le démontre

### 6.1 L'énoncé, et sa lecture

`core.md:181-182` : « **Prêt quand** un modèle impose son format et ses marges, déclare ce qui se
répète en haut et en bas de chaque page, et ce qui n'apparaît que sur la dernière. »

Décomposé en propositions vérifiables une par une — chacune doit être **démontrable par un test**, pas
par une lecture bienveillante :

| # | Proposition | Ce qui la démontre |
| :-- | :--- | :--- |
| **P1** | un modèle **impose** son format | `page.sheet` requis : un document sans page est refusé [§5.1, R01] ; aucun défaut de schéma ne le remplit [§2, D2] |
| **P2** | un modèle **impose** ses marges | quatre champs requis, et une page dont les marges dépassent la feuille est refusée [§5.1, R09-R11] |
| **P3** | il **déclare** ce qui se répète **en haut** | une bande `header` d'occurrence `every` |
| **P4** | il **déclare** ce qui se répète **en bas** | une bande `footer` d'occurrence `every` |
| **P5** | il déclare ce qui **n'apparaît que sur la dernière** | une seconde bande `footer` d'occurrence `lastOnly`, et l'occurrence `exceptLast` qui rend la paire cohérente [§2, D6] |
| **P7** | *(la première page)* | **absente de l'énoncé**, livrée par décision du 2026‑08‑18 : la paire `firstOnly` + `exceptFirst`. Le critère de recette n'en demande pas la démonstration, donc la fixture ne la porte pas — un `it` d'invariant s'en charge [§6.2, n° 6] |
| **P6** | *(la numérotation)* | **absente de cet énoncé**, présente dans le *pourquoi* du lot (`core.md:177-179`) : c'est l'arbitrage n° 1 de [§8], et ce plan la livre |

**Le mot qui décide de P1 et P2 est « impose ».** Un champ optionnel ne l'honore pas, un défaut de
schéma le contredit, et un paramètre de rendu le déplace ailleurs. Les trois sont mesurés en
[§2, D2] plutôt qu'affirmés — c'est la raison pour laquelle le champ est requis et pour laquelle la
feuille de compatibilité vit dans une migration.

**Le mot qui décide de P3 à P5 est « déclare ».** Le modèle déclare un **emplacement** et un **rang** ;
il ne déclare ni la répétition (le moteur la fait), ni la hauteur (le moteur la mesure), ni le point de
coupe. C'est la frontière de [§0], et elle est ce qui empêche ce lot de devenir un demi-moteur.

### 6.2 Le modèle de recette, et les `it` qui le démontrent

Le modèle vit dans `packages/core/src/page/__tests__/fixtures.ts`, il est **unique**, et il est
partagé par les tests de la page, des chemins de données et de la migration — un modèle, trois
fichiers, aucune copie. C'est la règle que C3 s'est donnée pour `RECIPE_TABLE`.

```ts
export const RECIPE_PAGE: PageSetup = {
  // A4 portrait. Les dimensions sont écrites par l'auteur du modèle : Openview n'impose
  // aucun format et n'en réserve aucun nom. `STANDARD_SHEETS_MM.a4` est une commodité
  // d'écriture, pas une valeur du contrat.
  sheet: { width: 210, height: 297 },
  margins: { top: 20, right: 15, bottom: 25, left: 15 },
  header: [
    {
      on: 'every',
      content: container('hdr', [
        text('hdr-title', [lit('Facture n° '), bind(p('facture.numero'))]),
      ]),
    },
  ],
  footer: [
    {
      on: 'exceptLast',
      content: container('ftr', [
        text('ftr-num', [lit('Page '), pageField('number'), lit(' / '), pageField('count')]),
      ]),
    },
    {
      on: 'lastOnly',
      content: container('ftr-last', [
        text('ftr-last-num', [lit('Page '), pageField('number'), lit(' / '), pageField('count')]),
        text('ftr-last-note', [bind(p('facture.mentions'))]),
      ]),
    },
  ],
};
```

**Pourquoi `exceptLast` et non `every` pour le pied courant.** Parce que le modèle porte **aussi** un
pied de dernière page, et que depuis la correction de [§2, D6] `every` + `lastOnly` n'est plus seulement
indésirable : **il est refusé par le schéma** [§5.1, R13b]. La fixture n'est donc pas un choix de style,
c'est la seule écriture licite de ce modèle — et elle démontre P5 **et** la raison d'exister de la
troisième occurrence. C'est le genre de détail qu'une fixture doit porter, parce qu'elle est ce qui sera
recopié.

Et le piège de la page unique, écrit ici comme il l'est dans la docstring de `PageBandOccurrence`
[§3.1] : sur une facture d'**une** page — le cas de E1 — ce modèle rend le pied `lastOnly` et **pas** le
pied `exceptLast`, donc la numérotation vient de la bande de dernière page. C'est correct, et c'est
pourquoi les deux bandes de la fixture portent toutes deux le marqueur.

**Pourquoi la fixture n'utilise PAS `firstOnly` / `exceptFirst`, alors que le lot les livre.** Parce que
`RECIPE_PAGE` a un seul travail : démontrer le critère de recette, mot pour mot. Or l'en‑tête doit y
porter `every` — « ce qui se répète en haut de **chaque** page » est la proposition P3, et une paire de
première page ne la démontre pas. Mettre la paire dans la fixture coûterait donc P3 pour illustrer une
capacité que le critère ne demande pas, et une fixture est **ce qui sera recopié** : elle doit montrer le
cas nominal, pas le cas nouveau. La paire est couverte par l'`it` d'invariant [§6.2, n° 6] et par les
libellés du playground [§6.3]. *Ce qui changerait cette décision :* un critère de recette réécrit, ou un
modèle livré — et le modèle livré est D9 du designer, pas ce lot.

**Les neuf `it` qui démontrent le critère**, et aucun n'est tautologique :

1. **P1/P2 — la page est acceptée telle qu'elle est écrite.** `parsePageSetup(RECIPE_PAGE)` réussit, et
   l'aller-retour JSON rend `toStrictEqual` : c'est ce qui attrape un champ que le schéma supprimerait
   [§5.1, R23].
2. **P1 — un modèle sans page est refusé, sur le chemin `page`.** Le message exact est épinglé
   [§5.1, R01] : c'est ce qui interdit à quiconque de « faciliter la migration » en rendant le champ
   optionnel.
3. **P2 — une page dont les marges ne laissent rien est refusée**, une fois par direction, sur le chemin
   `page.margins` [§5.1, R09-R10].
4. **P2 — l'aire imprimable est celle qu'on attend, y compris quand elle est laide.**
   `printableAreaOf(RECIPE_PAGE)` rend `{ width: 180, height: 252 }` ; et sur une feuille Letter à
   marges de 25,4 mm, `{ width: 165.10000000000002, height: 228.59999999999997 }`. Le second chiffre
   est le test qui protège la formule [§5.5].
5. **P3/P4 — les deux côtés portent leurs bandes**, et l'occurrence de chacune est celle qu'on a
   écrite. Un `it` qui lit `header[0].on` seul serait tautologique ; celui-ci vérifie que le **parse**
   les conserve toutes les deux, dans l'ordre, ce qu'un `z.array` mal composé perdrait.
6. **P5 — deux bandes du même côté sont acceptées si leurs domaines de pages sont disjoints, refusées
   sinon.** La propriété est **une**, donc un seul `it`, mais il porte **les deux paires licites et les
   sept couples fautifs** et non deux cas, parce que c'est exactement là que l'invariant était trop
   faible [§2, D6] : `exceptLast` + `lastOnly` et `firstOnly` + `exceptFirst` **acceptés**, dans les deux
   ordres d'écriture ; les sept autres **refusés** sur `page.footer.1.on` [§5.1, R13 à R13g], plus le cas
   à trois bandes qui n'en désigne qu'une [§5.1, R13h]. Un `it` qui ne testerait que le doublon serait
   vert sur le schéma **fautif** — c'est la définition d'un test qui n'assure rien.
7. **P6 — le marqueur traverse le parse et ne produit aucun chemin de données.** Le modèle porte quatre
   marqueurs ; `collectTemplateDataPaths` rend exactement `['facture.numero', 'facture.mentions']` —
   deux chemins, pas six, et **pas** un chemin inventé pour la page [§5.3].
8. **Le modèle complet est un `Template` valide.** `parseTemplate({ …, page: RECIPE_PAGE, root })` rend
   `schemaVersion: 5`, et l'aller-retour JSON rend `toStrictEqual`. C'est l'`it` qui relie les sept
   précédents au document réel, et c'est la forme exacte de `table.test.ts:368-373`.
9. **La table de compatibilité est symétrique — le seul `it` du lot qui protège un détail
   d'implémentation plutôt qu'un contrat, et c'est assumé.** `checkBandsCannotOverlap` compare chaque
   bande aux **précédentes** en lisant la ligne de la bande **courante** : une ligne asymétrique rendrait
   `[a, b]` licite et `[b, a]` refusé, ou l'inverse — donc un contrat qui dépend de l'ordre d'écriture,
   ce que le tableau de [§3.2] mesure comme indifférent. L'`it` parcourt les vingt‑cinq couples et
   vérifie `CONFLICTS[a].includes(b) === CONFLICTS[b].includes(a)`. Ce n'est pas tautologique : il échoue
   sur une table mal recopiée, qui est le mode de défaillance réel d'une table écrite à la main. **C'est
   le neuvième `it`, et il n'existe que parce que l'arbitrage n° 6 fait passer la table de trois à cinq
   lignes** — à trois, une relecture suffisait.

### 6.3 La démonstration visible — le playground, et ce qu'il ne peut pas montrer

Le contrat ne produit aucun pixel : la démonstration est donc un **dessin du modèle**, pas un rendu du
document. Ce que le playground peut montrer honnêtement, après INC‑5 :

- **la feuille à l'échelle** — un rectangle dont le rapport largeur/hauteur est celui de `sheet`, avec
  les quatre marges tracées et la zone imprimable obtenue par **`printableAreaOf`**, jamais recalculée
  sur place : le playground devient ainsi le troisième consommateur de la fonction, ce qui est
  l'argument de [§2, D5] rendu visible ;
- **les bandes, avec leur occurrence en clair** — « en haut, sur toutes les pages », « en bas, sauf la
  dernière », « en bas, dernière page seulement », et les deux libellés de la paire de première page,
  « en haut, première page seulement » et « en haut, sauf la première » : **les cinq occurrences ont un
  libellé**, sans quoi le playground montrerait un tuple partiel ;
- **le marqueur de numéro**, rendu tel que le playground peut le rendre : `1` et `1`, avec la mention
  écrite qu'il **n'y a pas de paginateur** et que ces valeurs sont des espaces réservés ;
- **la liste des chemins de données**, produite par `collectTemplateDataPaths` — donc **incluant
  `facture.numero` lu dans l'en-tête**. C'est l'écran (`App.tsx:486`) où l'absence de cette fonction
  se verrait, et c'est pour cela que la démonstration n'est pas décorative [§2, D10].

**Ce qu'il ne peut pas montrer, écrit franchement :** la répétition (il n'y a qu'une page), la
dernière page (il n'y en a pas d'autre), le débordement, le report, et la moindre coupure. Un
visiteur qui voudrait voir une bande se répéter devra attendre E2. Le dire est nécessaire : une
démonstration qui laisserait croire le contraire ferait passer pour livré ce qui ne l'est pas, et
c'est précisément la faute que [§1] reproche à une lecture optimiste du lot.

### 6.4 Définition de fini — critères vérifiables mécaniquement

Toutes les commandes se jouent sous **Git Bash**, que le dépôt suppose déjà pour ses quatre portes.

- **Les quatre portes vertes**, couverture ≥ 90 % sur `packages/core/src/**`.
- `CURRENT_SCHEMA_VERSION === 5` et `TEMPLATE_MIGRATIONS.length === 4`, première entrée toujours
  `{ from: 1, to: 2 }`, chaîne `[[1,2],[2,3],[3,4],[4,5]]` ([§5.4], contrat 1).
- **Le `switch` de segments reste unique** :

  ```bash
  git grep -lE "^[[:space:]]*switch \(segment\.kind\) \{" -- packages/core/src | wc -l
  ```

  rend **1** — `ast/visitor.ts:146`. C4 ne crée aucun second parcours de segments ; il complète celui
  qui existe.
- **Le `switch` de nœuds reste unique, et la forme naïve de ce critère est FAUSSE — mesuré.**

  ```bash
  git grep -lE "^[[:space:]]*switch \(node\.type\) \{" -- packages/core/src | wc -l
  ```

  rend **1**. La forme du plan C3 — `git grep -l "switch (node.type)"` sans ancre ni accolade — rend
  **2** sur `main` **aujourd'hui**, parce que `ast/schemas.ts:267` **cite la chaîne dans un
  commentaire** (« *Not a second `switch (node.type)`* ») que C3 a lui-même ajouté. Le critère de C3
  s'est donc périmé au moment de sa propre fusion : un critère dont la sortie attendue est un nombre
  doit porter sur du **code**, jamais sur une chaîne qu'un commentaire peut contenir.
- `git grep -n "const exhaustive: never" -- packages/core/src | wc -l` rend **6** — **inchangé**. Le
  `case` de C4 entre dans un `switch` existant.
- `git grep -l "case 'round':" -- packages/core/src | wc -l` rend **2**. C4 n'ouvre **aucun** troisième
  parcours d'expression : le seuil de retrait de l'amendement d'`AGENTS.md` §3.B n'est pas franchi.
  Ce critère ne consigne pas une exception, il surveille sa condition de validité.
- **Aucun champ refusé n'est entré dans le contrat**, et **le critère est scopé — mesuré** :

  ```bash
  git grep -nE "^[[:space:]]*(readonly[[:space:]]+)?(orientation|format|bleed|gutter|pageBreak|keepTogether|widowControl|orphanControl|minHeight|reservedHeight|numbering|carryForward)[?]?:" \
    -- packages/core/src/page packages/core/src/ast
  ```

  ne rend **rien**. ⚠️ **Sans le scope, il rend deux résultats sur un dépôt sain** —
  `ports/render.ts:32` et `:48`, qui déclarent légitimement `readonly format: RenderFormat`. Un critère
  dont la sortie attendue est « rien » et qui rend deux lignes n'est pas vérifiable, il est décoratif :
  c'est le même piège que le `remise` / `p-remise` du plan C3, et la contre-épreuve montre que la forme
  scopée n'est pas inerte (la même expression sur `width|height|align` rend **4** déclarations réelles).
- **Aucune docstring ne prescrit le comportement du moteur**, et c'est le défaut C‑01 du plan C3 :

  ```bash
  git grep -niE "the engine (will|must|repeats|paginates|decides)" -- packages/core/src/page packages/core/src/ast
  ```

  ne rend **rien**. ⚠️ Non scopé, il rend **une** ligne sur un dépôt sain — `expression/limits.ts:18`,
  qui cite une promesse intenable pour l'écarter. Non inerte : `the engine` sans verbe rend **19**
  lignes.
- **Aucun message n'interpole le contenu du modèle** (ADR 0003, la charge d'erreur sûre à journaliser) :

  ```bash
  git grep -n '\${' -- packages/core/src/page/schemas.ts
  ```

  ne rend **que** des chaînes de bornes constantes — `MIN_SHEET_MM` et `MAX_SHEET_MM`. Les guillemets
  simples comptent : sous double quote, le shell mangerait le `${`.
- **Les 22 symboles nouveaux sont importables depuis `@openview/core`.** Aucune porte ne le voit
  ([§5.2]), et **le playground n'en vérifie que cinq** — `printableAreaOf`, `STANDARD_SHEETS_MM`,
  `PageSetup`, `collectTemplateDataPaths` et le type du marqueur. Ce qui est mécanique ici est donc le
  **décompte de noms** des blocs d'export : **9 types** (`PageBand`, `PageBandOccurrence`, `PageField`,
  `PageMargins`, `PageSetup`, `PrintableArea`, `Sheet`, `StandardSheetName`, `TextPageFieldSegment`) et
  **13 valeurs**
  (`MAX_SHEET_MM`, `MIN_SHEET_MM`, `PAGE_BAND_OCCURRENCES`, `PAGE_FIELDS`, `PageBandSchema`,
  `PageMarginsSchema`, `PageSetupSchema`, `SheetSchema`, `STANDARD_SHEETS_MM`,
  `TextPageFieldSegmentSchema`, `collectTemplateDataPaths`, `parsePageSetup`, `printableAreaOf`). Le
  reste est listé dans la PR. *Un décompte non recompté est un décompte faux* : celui-ci se recompte au
  moment d'INC‑5.
- **Les cinq occurrences sont dans le tuple, et la table de compatibilité en a cinq lignes** :

  ```bash
  git grep -c "'\(every\|firstOnly\|exceptFirst\|exceptLast\|lastOnly\)'" -- packages/core/src/page/types.ts
  ```

  Le décompte n'est pas le critère utile — la porte 2 le tient déjà (`TS2741` sur une table incomplète,
  [§5.2]). **Le critère mécanique qui compte est l'`it` de symétrie de [§6.2, n° 9]**, parce qu'une table
  complète mais mal recopiée compile. Un critère qui compterait des chaînes ici serait décoratif ; il est
  écrit pour dire **où** est la vraie protection.
- **`PAGE_SETUP_SCHEMA_SATISFIES_TYPE` n'apparaît pas dans le barrel** :

  ```bash
  git grep -n "PAGE_SETUP_SCHEMA_SATISFIES_TYPE" -- packages/core/src/index.ts
  ```

  ne rend rien. C'est une assertion de compilation, pas une API.
- **La fixture de `page/__tests__/` — les DEUX critères**, parce que le fichier tombe sous deux régimes
  que rien d'autre ne surveille ([§5.5]) :

  *(a) l'accident de publication.*
  `git grep -n "from 'vitest'" -- packages/core/src/page/__tests__/fixtures.ts` ne rend **rien**.

  *(b) la non-régression de couverture, par fichier.* Le seuil global de 90 % agrège et ne verrait pas
  une fabrique exportée jamais appelée. La sonde de C3, **corrigée** — voir l'avertissement ci-dessous :

  ```bash
  node --input-type=commonjs -e "const s=require('./coverage/coverage-summary.json');const k=Object.keys(s).filter((p)=>p.endsWith('fixtures.ts')&&p.includes('page'));if(k.length!==1)throw new Error('attendu 1 fixture de page/, trouve '+k.length);console.log(s[k[0]].functions.pct, s[k[0]].lines.pct);"
  ```

  doit rendre **`100 100`**. Forme **vérifiée sur le rapport actuel du dépôt**, jouée sur la fixture de
  C3 (`&&p.includes('ast')`), qui rend bien `100 100`. `--input-type=commonjs` parce que le
  `package.json` racine déclare `"type": "module"`.

  > ⚠️ **La sonde de C3 devient AMBIGUË le jour où ce lot atterrit — mesuré.** Elle s'écrit
  > `Object.keys(s).find((p) => p.endsWith('fixtures.ts'))`, et `find` rend **le premier**. Mesuré sur
  > le rapport actuel : il existe **une** clé finissant par `fixtures.ts` aujourd'hui ; C4 en crée une
  > **seconde** (`page/__tests__/fixtures.ts`), et la sonde de C3 se mettrait alors à mesurer un fichier
  > **au hasard de l'ordre des clés**, en restant verte. La forme ci-dessus corrige les deux défauts à
  > la fois : elle **filtre** au lieu de chercher, et elle **échoue bruyamment** si le compte n'est pas
  > celui qu'on attend. Les clés étant des chemins absolus à séparateurs Windows, la discrimination se
  > fait par `includes('page')` — un fragment sans barre oblique inverse, donc une commande qu'aucun
  > shell ne déforme. **L'ADR 0006 doit signaler à l'ADR 0005 que son critère est à reformuler**, sinon
  > le dépôt garde un critère vert qui ne mesure plus ce qu'il nomme.
- **`page/**` est couvert à 100 %** en lignes et en fonctions, pas seulement à 90 % : le dossier est
  neuf, une branche non couverte y désigne du code mort. Même sonde que ci-dessus, sur `area.ts`,
  `schemas.ts` et `types.ts`.
- **`errors.ts` sort du lot octet pour octet** :
  `git diff --exit-code "$(git merge-base origin/main HEAD)" HEAD -- packages/core/src/errors.ts`
  rend **exit 0**. C'est la différence exacte avec C3, dont la définition de fini autorisait « une ligne
  de type et une docstring ».
- **`packages/designer/src/types.ts` sort du lot octet pour octet**, même commande, même exit 0
  ([§3.11]).
- **`AGENTS.md` ne gagne aucune entrée** :

  ```bash
  git diff --exit-code "$(git merge-base origin/main HEAD)" HEAD -- AGENTS.md
  ```

  exit **0**. La base est le **point de branche**, *calculé* et non recopié : un hash écrit ici se
  périmerait à la première réécriture d'historique. ⚠️ La forme naïve — « `git log --oneline -- AGENTS.md`
  ne montre aucune entrée nouvelle » — n'est pas rejouable : sa sortie compte l'historique entier du
  fichier, et il faut connaître le compte d'avant pour conclure.
- `packages/core/package.json` **inchangé** ; `pnpm-workspace.yaml` **sans dérogation nouvelle** ;
  `biome.jsonc`, `vitest.config.ts` et les `tsconfig*.json` **inchangés**.
- **L'ADR 0006 existe, est en 🟢, et couvre les treize décisions** avec, pour chacune, son motif, ses
  alternatives écartées, son verdict de réversibilité et son signal de réouverture quand il y en a un.
  `docs/roadmap/core.md` §C4 porte le renvoi vers ce plan puis la mention de livraison, et ce plan
  porte son propre `**Statut :**` périmé.

---

## 7. Ce que ce lot n'est pas

Le hors-périmètre **de conception** est écrit en **D13** ([§2]) et n'est pas répété ici. Ce qui suit
est d'une autre nature : ce sont les **méprises** qu'un lecteur pressé pourrait faire sur ce que le lot
livre.

**Ce n'est pas de la pagination.** Après C4, aucun document ne sort sur deux pages, aucune bande ne se
répète, aucun numéro n'est calculé. Le lot livre les **faits** qu'un paginateur devra respecter, et
rien d'autre. Un lecteur qui chercherait dans `core` le code qui répète un en-tête chercherait
longtemps : il n'y en aura jamais.

**Ce n'est pas une mise en page.** La feuille et les marges ne disent pas où va un bloc. Le contrat n'a
ni coordonnées, ni grille, ni colonnes, ni calques : c'est C11, et c'est la vague 2. Un modèle C4
décrit une feuille et un flux, pas une composition.

**Ce n'est pas de l'apparence.** Une bande n'a ni police, ni filet, ni couleur, ni fond. Deux factures
décrites avec ce lot sont visuellement identiques : c'est C5 qui les différencie, et il dépend de C3,
pas de C4.

**Ce n'est pas un système d'unités.** Le contrat déclare des **millimètres**, un point. Il n'y a pas de
conversion, pas de deuxième unité, pas d'objet `{ value, unit }`, et la conversion vers le point PDF ou
le pixel CSS appartient au moteur — avec une réserve écrite en [§2, D3] : la formule de conversion est
une **connaissance externe non vérifiée** dans ce dépôt, et E1 lui doit une sonde.

**Ce n'est pas une bibliothèque de formats.** `STANDARD_SHEETS_MM` est une commodité d'écriture, pas
une donnée du contrat. Un modèle n'enregistre jamais « A4 » ; il enregistre `210 × 297`. Ajouter un
format à cette table ne change ni le schéma, ni la version, ni un document.

**Ce n'est pas une numérotation.** Le lot livre un **marqueur** — un emplacement. La valeur vient du
paginateur, le format vient de C6, et la langue du libellé qui l'entoure vient de C6 aussi. Un modèle
qui écrit `Page ⟨number⟩ / ⟨count⟩` n'a rien calculé.

**Ce n'est pas la fin du sujet « dernière page ».** Le lot livre `lastOnly`, donc la capacité de
déclarer une bande de dernière page. Il ne livre **pas** la garantie que le moteur y arrivera sans
osciller : l'attente est écrite en [§2, D6], elle est adressée à E3, et elle n'est vérifiée par rien
aujourd'hui.

**Ce n'est pas non plus le report.** Le lot livre `firstOnly` et `exceptFirst` — décision du 2026‑08‑18,
arbitrage n° 6 — donc l'**emplacement** où un total reporté peut vivre sans polluer la page 1. Il ne
livre ni la valeur du report, ni son libellé, ni son marqueur : ils restent refusés en [§2, D13], et
c'est E3 qui les apporte. Un lecteur qui verrait `exceptFirst` et conclurait que « le report est fait »
se tromperait de moitié — et c'est la moitié la plus chère.

**Et ce n'est pas C7.** L'insécabilité dépend de C4 (`core.md:223`) et arrive après. Ce lot lui laisse
sa place vide, délibérément : c'est le seul lot du contrat que C4 débloque, et le préempter serait lui
retirer sa raison d'être.

---

## 8. Les sept arbitrages, **tranchés le 2026‑08‑18**

Sept questions que **ce plan ne pouvait pas trancher seul**, parce qu'aucune ne se lit dans un texte du
dépôt. **Le propriétaire du produit les a tranchées le 2026‑08‑18**, et cette section est conservée
**dans son intégralité** : elle porte les options, les arguments et les coûts de réouverture, c'est‑à‑dire
la matière que l'ADR 0006 doit reprendre. Un plan qui effacerait les branches non retenues laisserait
l'ADR sans les motifs des décisions.

**Ce qui change dans la lecture de cette section :** chaque arbitrage porte désormais un verdict
🗳️ **DÉCIDÉ**. Les recommandations d'origine restent écrites telles quelles, y compris celle que la
décision a écartée — c'est le n° 6, et le savoir importe : le contrat de la [§3] est celui de la
**décision**, pas celui de la recommandation. Les ⛔ subsistent comme trace du coût qu'ils annonçaient ;
ils ne gouvernent plus l'ordre du travail, puisque tout est tranché **avant INC‑0**.

| # | Décidé | Écart avec la recommandation de ce plan |
| :-- | :--- | :--- |
| 1 | **A** | aucun |
| 2 | **A** | aucun |
| 3 | **A** | aucun (question reconnue dérivée du n° 2) |
| 4 | **A**, feuille de compatibilité **A4 portrait 20 mm validée explicitement** | aucun — et le mandat que D11 réclamait est **levé** |
| 5 | **A** | aucun |
| 6 | **B** | ⚠️ **la décision écarte la recommandation A** |
| 7 | **A**, motif reformulé sur la centralisation | motif, pas verdict |

### ⛔ n° 1 — La numérotation entre-t-elle dans C4 ? · 🗳️ **DÉCIDÉ : A**

**Ce qui est en jeu.** `core.md:177-179` nomme la « numérotation » dans le *pourquoi* du lot ;
`core.md:181-182`, le critère de recette, **ne la reprend pas** ; `engine.md:47` la met dans E2. Un
lecteur de bonne foi peut donc livrer C4 sans une ligne de numérotation et se croire conforme.

- **A *(recommandé)*** — C4 livre le **marqueur** (`TextPageFieldSegment`), pas la valeur. Argument :
  `core.md:3-5` — ce que le contrat ne sait pas dire est impossible à rendre **et à éditer** ; un numéro
  que le contrat ne place pas est un numéro que l'utilisateur de D2 ne pourra ni déplacer ni traduire.
- **B** — C4 ne livre rien, et E2 invente l'emplacement. Argument : le critère de recette est muet, et
  l'ADR 0002 sous-décision 4 a déjà écrit que « la numérotation se traite souvent en CSS côté rendu »
  — pour les **lignes**, mais la phrase existe et sera citée.

**Coût de réouverture (A → B) :** D7 disparaît, [§3.5] et [§3.6] avec elle, INC‑2 disparaît, le
correctif du playground n'est plus nécessaire — et l'estampille de D11 perd **une** de ses deux formes
stockées, donc sa docstring se réécrit. Le lot passe de sept à six incréments. **C'est le seul
arbitrage qui change le nombre d'incréments.**

### ⛔ n° 2 — Comment la feuille est-elle exprimée : dimensions, nom, ou unité entière ? · 🗳️ **DÉCIDÉ : A**

- **A *(recommandé)*** — `sheet: { width, height }` en **millimètres fractionnaires**, plus
  `STANDARD_SHEETS_MM` comme commodité **hors contrat**. Arguments mesurés : une énumération stockée
  coûte une estampille par format nouveau ; Letter mesure `215,9 × 279,4` mm, donc les entiers en
  millimètres sont exclus ; et une contrainte « au plus deux décimales » **refuse Letter**
  (`279.4 * 100 = 27939.999999999996`). Le prix assumé est un flottant, payé une fois par
  `printableAreaOf` [§2, D5].
- **B** — `format: 'a4' | 'a5' | 'letter' | 'legal'` + `orientation`. Argument : c'est ce qu'un
  intégrateur attend d'une API, le moteur peut passer le nom tel quel à son adaptateur, et **aucune
  longueur de feuille n'entre dans le document** — seule reste la question de l'unité des marges.
- **C** — une **unité entière commensurable** (EMU, 1/914400 pouce) pour toutes les longueurs.
  Argument, et il est fort : **le problème de flottant disparaît**, pas seulement pour l'aire
  imprimable mais pour toute conversion vers le point, le pouce et le pixel CSS — toutes exactes, toutes
  entières. Prix : un document que personne ne lit (`7 560 000 × 10 692 000` pour A4), et une ergonomie
  qui dépend de fabriques qu'un intégrateur peut ignorer [§2, D3].

**Coût de réouverture (A → B) :** D3 se rejoue, [§3.1] et [§3.2] pour moitié, la migration change de
valeur écrite, la fixture change, et **la table des formats devient une donnée du contrat** — donc une
chose à maintenir et à versionner. **(A → C) :** [§3.1] à [§3.3] se réécrivent en entier, D5 change de
motif (l'exactitude n'est plus en cause, seule l'unicité de la formule reste), la fixture et la
migration changent de valeurs, et il faut décider si les fabriques sont dans le contrat ou hors de lui.
Dans les deux cas, **le plan est à rejouer, pas à amender** — d'où le ⛔.

### n° 3 — `orientation` est-il un champ ? · 🗳️ **DÉCIDÉ : A**

> ⚠️ **Cet arbitrage n'était pas autonome, et le présenter comme tel a été relevé de l'extérieur.** Il
> est **subordonné au n° 2** : si le n° 2 avait retenu l'option B (`format` nommé), le champ
> `orientation` serait arrivé avec elle et le n° 3 aurait été tranché sans être posé. Le n° 2 ayant été
> décidé en **A**, la question restait ouverte, et elle est décidée en **A** : **pas de champ**.

- **A *(recommandé)*** — non : la paire de dimensions le dit déjà, un A4 paysage est `297 × 210`. Un
  second champ serait une seconde source de vérité, donc un invariant à faire respecter pour un état qui
  ne devrait pas être exprimable.
- **B** — oui, parce que la roadmap le nomme. Il faudrait alors décider ce que `orientation:
  'landscape'` signifie sur une feuille déjà plus large que haute : l'ignorer (le champ est décoratif),
  échanger les dimensions (le champ est un modificateur, donc la feuille stockée ne dit plus la
  vérité), ou refuser (un invariant de plus).

**Coût de réouverture (A → B) :** un champ, un invariant, un refus de plus en [§5.1], une estampille.
Localisé.

### n° 4 — Que fait la migration `4 → 5` d'un document sans page ? · 🗳️ **DÉCIDÉ : A**, feuille validée

> 🗳️ **La décision porte les DEUX moitiés que cet arbitrage demandait, et la seconde lève un mandat.**
> Migration **transformante** (option A), et la feuille de compatibilité — **A4 portrait, marges de
> 20 mm, aucune bande** — est **explicitement validée** par le propriétaire du produit, 2026‑08‑18.
> [§2, D11] exigeait que ce choix soit « argumenté dans l'ADR **et confirmé par le propriétaire du
> produit** » plutôt que déduit d'un plan ; **la confirmation existe, et l'ADR 0006 la date.** Ce qui
> reste dû à l'ADR est l'argument, pas l'autorisation — et notamment la concession écrite en D11 :
> **A4 est le format d'une partie du monde**, et l'écrire dans une migration est un choix culturel
> assumé, non une adaptation à l'environnement.

- **A *(recommandé)*** — elle écrit une page de compatibilité : **A4 portrait, marges de 20 mm, aucune
  bande**. Aucun document v4 ne devient irrecevable, donc **aucun cinquième rétrécissement** n'est
  ajouté à la liste que porte l'hypothèse pré‑v1.0.
- **B** — elle estampille seulement, et le rétrécissement est assumé : tout document v4 est refusé avec
  `Invalid input: expected object, received undefined` sur le chemin `page`. Argument : Openview ne
  choisit alors aucune feuille — et l'hypothèse pré‑v1.0 couvre les rétrécissements.
- **C** — elle écrit une autre feuille (Letter, ou une feuille « minimale »). Argument : A4 est un choix
  européen.

**Coût de réouverture (A → B) :** D11 se réécrit, la migration redevient une estampille, **et il faut
compter un cinquième rétrécissement** — le premier qui ne soit pas vide en extension. (A → C) : une
constante, et une phrase d'ADR. **La question est produit, pas technique** : elle demande si Openview
préfère qu'un ancien document s'ouvre sur une feuille qu'il n'a pas choisie, ou ne s'ouvre pas.

### n° 5 — `collectTemplateDataPaths` entre-t-il dans C4 ? · 🗳️ **DÉCIDÉ : A**

- **A *(recommandé)*** — oui. Sans lui, deux docstrings **de production** promettent ce que le code ne
  tient plus (`ports/render.ts:9-15`, `template.ts:89-93`), et un écran du playground affiche une liste
  incomplète (`App.tsx:486`). Le symptôme n'est pas une erreur, c'est un en‑tête vide.
- **B** — non, le trou est documenté et laissé au moteur. Argument : la fonction n'a pas encore
  d'appelant réel dans le dépôt, et la règle anti‑sur‑ingénierie existe.

**Coût de réouverture (A → B) :** INC‑3 disparaît (un fichier, un test). Mais **les deux docstrings
doivent alors être corrigées dans le même lot**, sinon le dépôt porte deux textes qui se contredisent
— et cette correction n'est pas moins de travail que la fonction.

### n° 6 — Les variantes de **première** page entrent-elles ? · 🗳️ **DÉCIDÉ : B — elles entrent**

> 🗳️ **C'est le seul des sept où la décision écarte la recommandation de ce plan, et il faut le dire
> ainsi plutôt que de réécrire la recommandation après coup.** Ce plan recommandait **A** (attendre) ;
> le propriétaire du produit a tranché **B** le 2026‑08‑18. `firstOnly` et `exceptFirst` entrent dans
> `PAGE_BAND_OCCURRENCES`, qui passe à **cinq** membres.
>
> **Le motif retenu est celui que ce plan avait lui‑même porté contre sa propre recommandation** —
> l'encadré ci‑dessous, qui dégradait déjà le statut de A : le besoin aval concret est le **total
> reporté** de `engine.md:59`, il s'imprime en haut de page, et il n'existe pas en page 1. Les deux
> arguments de ce plan pour attendre tiennent toujours et sont **assumés comme insuffisants** : que C4 ne
> livre aucun marqueur de report [§2, D7, écarté (i)], et que la convention comptable à deux faces ne
> soit pas vérifiée dans le dépôt.
>
> **Ce que la décision NE fait pas, et c'est la limite à retenir :** elle livre l'**occurrence**, pas le
> **report**. Le marqueur de report reste refusé en [§2, D13], famille « Pagination ». E3 trouvera donc
> la moitié du mécanisme, ce qui est exactement ce que ce plan promettait au lot qui livrerait l'autre.
>
> **Et ce que la décision coûte, mesuré :** cinq membres au lieu de trois, une table de compatibilité à
> cinq lignes au lieu de trois, **sept** couples refusés au lieu de trois [§5.1], un `it` de plus [§6.2],
> et un refus retiré de D13. **Zéro export nouveau, zéro incrément nouveau, zéro estampille
> supplémentaire** — les deux membres entrent avant INC‑4, donc dans la même version 5.

- **A *(recommandé par ce plan, ÉCARTÉ par la décision)*** — non. Le critère de recette nomme la dernière
  page et jamais la première ; aucun document du dépôt ne demande un papier à en‑tête.
- **B** — oui, `firstOnly` et `exceptFirst` en même temps que les trois autres. Argument : presque tous
  les formats de document réels ont cette notion, et le contournement d'aujourd'hui est mauvais — mettre
  l'en‑tête complet dans le flux le fait **participer au flux** au lieu de vivre dans la marge haute
  [§2, D13].

**Ce que B a coûté, mesuré après application — et c'est le chiffre qui a servi à décider.** Deux membres
de tuple, **et l'extension de la table de compatibilité** de [§2, D6], puisque l'invariant de bandes est
une disjonction déclarée et non une unicité. Il fallait statuer sur quatre couples nouveaux : **un seul
est licite** (`firstOnly` + `exceptFirst`) et **trois sont refusés** — `firstOnly` + `exceptLast`,
`exceptFirst` + `lastOnly`, `firstOnly` + `lastOnly` —, auxquels s'ajoute `exceptFirst` + `exceptLast`,
refusé lui aussi. **Aucune estampille supplémentaire**, parce que les deux membres entrent **avant**
INC‑4 : ils sont dans la version 5, pas dans une version 6. Aucune ligne du contrat de type à réécrire,
aucun export nouveau, aucun incrément nouveau.

**Et la propriété qui a rendu le coût acceptable : l'oubli est impossible à compiler.** Le type
`Readonly<Record<PageBandOccurrence, …>>` exige une entrée par occurrence, donc élargir le tuple sans
étendre la table est une **erreur de compilation** — mesuré, `tsc` 7.0.2 du dépôt :
`TS2741: Property 'firstOnly' is missing` [§5.2]. Le travail est **forcé et visible**, jamais un trou
silencieux. C'est aussi ce qui rend le prochain élargissement défendable, s'il vient.

> 🗣️ **Trace de la contre-analyse : elle recommandait B, et la décision l'a suivie.** L'argument avancé
> était celui de l'encadré ci‑dessous — « E3 fournit déjà un besoin concret ». Ce plan n'a pas tranché
> lui‑même, et c'était juste : cet arbitrage appartenait au propriétaire du produit, et le trancher dans
> un plan aurait été la faute que [§2, D11] refuse pour A4. Ce que le plan devait fournir, c'était un
> chiffre exact — il l'a corrigé à la hausse — et la décision est tombée avec ce chiffre sous les yeux.

> ⚠️ **Une objection a été formulée contre la recommandation A, et elle est la plus sérieuse du lot : le
> besoin réel n'est peut-être pas sur la dernière page, mais sur la PREMIÈRE.** `engine.md:59` exige de
> E3 « le **total reporté** de page en page (« report : 12 480,00 € ») ». Un report est un montant
> **entrant**, donc il s'imprime en **haut** de page — et sur la **page 1 il n'existe pas**. Un modèle
> qui poserait un report dans son en‑tête imprimerait donc « Report : 0,00 € » sur la première page,
> c'est-à-dire exactement l'anomalie qu'un comptable relève, alors que E3 est « prêt quand un
> utilisateur métier … **ne relève aucune anomalie** ». Ce dont E3 aurait besoin est donc une variante
> de **première** page en haut — **et c'est l'argument qui a emporté la décision : C4 la rend désormais
> exprimable.**
>
> **Les trois raisons d'attendre restent écrites, parce que l'ADR doit les porter, et elles sont
> assumées comme insuffisantes.** (1) **C4 ne livre aucun marqueur de report** [§2, D7, écarté (i)] : le
> scénario complet n'est pas réalisable avant E3 — **et c'est toujours vrai après la décision**, qui
> livre l'occurrence et pas la valeur. (2) **La convention comptable à deux faces — « report » en haut,
> « à reporter » en bas — n'est pas vérifiée dans le dépôt** : `engine.md` écrit « report » et jamais
> « à reporter ». C'est une lecture argumentée, pas un fait. (3) Le coût de l'ajout ultérieur était
> **une estampille**, pas une réécriture — et l'ajout **immédiat** n'en coûte aucune, ce qui retire à
> cette raison sa force : différer n'économisait rien. (4) Ce n'était donc pas « l'arbitrage le moins
> coûteux des sept » mais celui au scénario aval le plus concret, **et il a été tranché en sachant que
> le demandeur est E3, pas un papier à en‑tête.**

### n° 7 — `printableAreaOf` entre-t-elle dans C4 ? · 🗳️ **DÉCIDÉ : A**, sur le motif de la centralisation

- **A *(recommandé, et retenu — avec son motif reformulé par la décision)*** — oui, et **le motif est la
  centralisation du calcul, pas une garantie de rendu.**
  La soustraction s'écrit **une** fois dans le dépôt, donc la garantie « aperçu identique au PDF » de la
  décision 7 repose sur une **dépendance partagée** et non sur un accord entre deux implémentations qui
  écrivent chacune leur formule — c'est l'argument de [§2, D5], et le précédent `nodeReads` a exactement
  cette forme. Le flottant vient **en appui** : `215.9 - (25.4 + 25.4)` rend `165.10000000000002` et
  `(215.9 - 25.4) - 25.4` rend `165.1`, donc l'accord n'est pas seulement fragile en théorie, il est
  déjà rompu en pratique sur la feuille dont le critère anglais/dollars a besoin.
- **B** — non : chacun soustrait, la règle anti‑sur‑ingénierie s'applique, et l'écart est de l'ordre de
  `2 × 10⁻¹⁴` mm — très en dessous du pixel.

**Coût de réouverture (A → B) :** un fichier et un test disparaissent. Ce qui disparaît aussi, c'est la
**seule** protection contre un contrôle automatique aperçu/PDF (décision 7) qui comparerait deux
nombres calculés par deux formules.

⚠️ **Et il faut être précis sur ce que A n'achète PAS**, parce qu'une rédaction antérieure laissait
entendre le contraire : `2 × 10⁻¹⁴` mm ne déplace **aucun pixel**, et A ne protège d'aucun défaut
visible. B est donc **honnête sur la géométrie** et faux seulement sur l'**égalité** — un contrôle
automatique qui compare deux nombres échoue sur `165.1 !== 165.10000000000002`, quelle que soit la
petitesse de l'écart. Ce que A achète est une **formule unique**, pas une garantie au pixel.

---

### Huit signalements, qui ne sont pas des arbitrages

Ceux-là ne demandent pas de choisir : ils demandent d'**inscrire quelque part** un fait que ce lot a
mis au jour. Les laisser dans un plan périssable serait les perdre ; ils vont donc dans l'ADR 0006, et
quatre d'entre eux appellent une action qui n'est pas de C4.

| # | Ce que le lot a mis au jour | Ce qu'il faut en faire |
| :--- | :--- | :--- |
| **A** | **Le poids réel est L**, la roadmap écrit M (`core.md:184`) | Corriger la roadmap, ou assumer l'écart par écrit — même geste que l'ADR 0005 [§4] |
| **B** | « **C4 ne débloque aucun lot en aval** » (`c1, §1`, repris par `c2, §1`) est **faux** : `core.md:223` donne « C7 — Dépend de : C4 » | Nommer les deux lignes dans l'ADR 0006, **sans réécrire** les plans périmés [§4, INC-6] |
| **C** | `ast/types.ts:325`, docstring **publiée**, attribue la numérotation à E2/E3 sans distinguer valeur et emplacement | La corriger dans INC‑2 si l'arbitrage n° 1 est tranché en A [§3.5] |
| **D** | Le **saut de page explicite** n'a **aucun propriétaire** — vérifié sur `core.md` et `engine.md` | Désigner un lot, ou l'inscrire hors v1 [§2, D13] |
| **E** | Le **filigrane** dépend des calques, et les calques sont le **deuxième candidat à la coupe** (`README.md:157-161`) | Arbitrer **hors de C4** : une bande ne peut pas les porter [§2, D13] |
| **F** | L'**unicité des identifiants** de nœud n'est plus garantie : un document passe d'une racine à une racine par bande | Accepter le trou par écrit, avec son signal daté [§2, D10] |
| **G** | Le **critère de couverture** de l'ADR 0005 devient **ambigu** dès que ce lot crée un second `fixtures.ts` | Signaler la reformulation dans l'ADR 0006 [§6.4] |
| **H** | **Aucune des quatre portes bornées publiques n'est une frontière de persistance**, et rien ne le dit : `parseExpression`, `parseDocumentNode`, `parseBlockNode` (`index.ts:175-177`) et `parsePageSetup` rendent un objet dont les clés inconnues ont été **supprimées** [§5.1, R23]. Un intégrateur qui parse un fragment puis l'enregistre efface un champ d'une version future, sans erreur | Écrire la frontière dans l'ADR 0006 : **seul le `Template` estampillé est persistable**. Les docstrings des trois portes de C1 et C3 sont à compléter — **hors de C4**, parce que ce lot ne touche pas à leurs lignes [§3.8] |

---

## 9. Ce que ce plan tient pour acquis

**Neuf hypothèses. Si l'une est fausse, le plan change — une pièce nommée, pas le lot.**

1. **C3 est livré, et le dépôt est à `schemaVersion` 4.**
   *Vérifié le 2026-08-17, et cette vérification a renversé une version antérieure de ce plan.* Au
   début de la rédaction, `packages/core/src` était encore à la version **3** sans tableau, et le plan
   était écrit en supposant C3 « livré avant C4 ». Pendant la rédaction, la PR #18 a été fusionnée :
   `git log` rend `c5e0006 Merge pull request #18 from PatayEnCroute/feat/c3-tableau-de-lignes`,
   `CURRENT_SCHEMA_VERSION = 4` (`template.ts:80`), `ast/` est découpé en `types.ts` / `schemas.ts` /
   `nodes.ts`, `BlockNode` existe, `ExpressionErrorSite` porte `tableRowGroup` (`errors.ts:80`), et
   `docs/adr/0005-le-tableau-de-lignes.md` existe. **L'hypothèse n'est donc plus une hypothèse, c'est un
   relevé** — et c'est pour cela que ce lot estampille **5** sans condition, et que son ADR est la
   **0006**.
   *Ce qui repose dessus :* la valeur de l'estampille [§2, D11], le fait que les bandes acceptent des
   `BlockNode` [§2, D6], l'existence du découpage de `ast/` qui dispense C4 d'un INC‑0 de refactor, et la
   totalité de [§3].
   *Si le dépôt reculait* — une révocation de la fusion : trois choses nommées changent, l'estampille (4
   au lieu de 5), le fichier où les types atterrissent, et le nom de l'union que `PageBand.content`
   accepte. Le contrat, lui, ne change pas.

2. **Un `superRefine` laisse un `ZodObject` — et un `ZodArray` — en zod 4.**
   *Mesuré* contre le `zod@3.25.76` résolu du dépôt, importé via `zod/v4` : `PageSetupSchema instanceof
   z.ZodObject` rend `true`, `.shape` et `.extend` restent disponibles, `bandsSchema instanceof
   z.ZodArray` rend `true`, et `TemplateSchema.extend({ page: PageSetupSchema })` est **lui-même** encore
   un `ZodObject`. La signature de la bibliothèque le confirme au type : `superRefine(...): this`.
   *Ce qui repose dessus :* les deux contrôles croisés de [§2, D4] et l'unicité d'occurrence de
   [§2, D6] — donc « zéro code d'erreur nouveau » [§2, D9], puisque ces trois refus n'existent que parce
   que le raffinement voyage **dans** le schéma.
   *Si elle tombe* — une montée de zod qui rendrait un wrapper : `TemplateSchema.extend` cesse de
   compiler, et la parade n'est pas d'assouplir mais de sortir les contrôles vers `parsePageSetup`, au
   prix d'un contrôle qui ne s'applique plus quand l'intégrateur valide une page isolée. **À rejouer à
   chaque montée de zod**, comme l'ADR 0004 le fait pour la règle nursery de Biome.

3. **Un `superRefine` n'est sauté que sur une issue ABANDONNANTE.**
   *Mesuré* : `invalid_type`, `invalid_value` et `invalid_union` le sautent ; `too_small`, `too_big` et
   `custom` le laissent tourner. Conséquences directes, toutes deux mesurées : une largeur `0` produit
   **2** issues sans le garde et **1** avec [§5.1, R03] ; et un contenu de bande non conforme
   (`invalid_union`) **masque** le contrôle des marges.
   *Ce qui repose dessus :* la promesse « un message à la fois » faite à C8, et le garde qui la tient.
   *Si elle tombe* — `too_small` deviendrait abandonnant : le garde devient inatteignable et son `it`
   **rougit**, ce qui est le signal souhaité. C'est la seule des neuf hypothèses dont la chute est
   rattrapée par une porte.

4. **`z.array` infère un tableau MUTABLE, donc l'assertion d'assignabilité mutuelle est indisponible sur
   `PageSetup`.**
   *Mesuré* : `MutuallyAssignable<PageSetup, z.infer<typeof PageSetupSchema>>` vaut **`false`** et refuse
   de compiler (`TS2322: Type 'true' is not assignable to type 'false'`) ; la direction
   `z.infer<…> extends PageSetup` vaut **`true`**, l'inverse **`false`**.
   *Ce qui repose dessus :* la forme de l'assertion de [§3.2], et le fait que le filet contre « un champ
   dans le type, absent du schéma » soit un **test d'aller-retour** et non une assertion de types
   [§5.1, R23].
   *Pourquoi c'est écrit :* parce que la transposition naïve du patron de C3 ne compile pas, et qu'un
   lecteur qui la tenterait conclurait à une faute de son schéma. Le patron de C3 n'est pas en cause :
   son assertion porte sur `TextSegment`, **un type sans tableau**.

5. **Les mesures du bac à sable transposent au dépôt.**
   *Ce que le bac à sable est :* [§3], protocole. Un `tsconfig` qui **étend celui du dépôt**, une
   jonction vers le `zod` du dépôt, le `tsc` **7.0.2** du dépôt, Node **v24.11.1**, et les mesures
   d'exécution jouées contre un **build de `main`** produit dans le bac à sable (`tsc -p
   packages/core/tsconfig.json --outDir <hors du dépôt>`), qui rend `CURRENT_SCHEMA_VERSION = 4`,
   **89** exports et la chaîne `[[1,2],[2,3],[3,4]]` — identiques au `dist` présent.
   *Ce qu'il ne partage pas :* l'orchestration `turbo`, la résolution pnpm, les quatre autres paquets,
   `biome check`, et **aucun chiffre de couverture**. Les portes 1 et 4 ne sont donc pas mesurées.
   *Ce qui repose dessus :* les trente-et-une lignes de [§5.1], les mesures de profondeur de [§2, D12], et
   la compilation à exit 0 des cinq fichiers de [§3].
   *Si elle tombe :* les deux coutures **hors** de `packages/core` sont les premières exposées — les deux
   sites `visitSegment` du playground et la consommation du barrel — et ce sont précisément celles
   qu'aucune porte de `core` ne voit.

6. **Le projet est en pré‑v1.0, et aucun template client n'existe en stockage.**
   *Vérifié le 2026-08-17 :* `git tag` ne rend rien ; les six `package.json` sont en `0.1.0` ;
   `.github/workflows/` contient `ci.yml`, `codeql.yml`, `security.yml`, `sonar.yml` et **aucun**
   `npm publish`.
   *Ce qui repose dessus, et il faut dire que c'est peu :* **rien de neuf.** C4 n'ajoute **aucun
   cinquième rétrécissement** — c'est la propriété que la migration transformante achète [§2, D11], et
   les bornes neuves du lot (`[1, 5080]`, `[0, 5080]`, une bande par occurrence) portent toutes sur des
   champs **qu'aucun document v4 ne peut remplir**.
   *Où elle ne sert PAS :* elle ne porte **pas** le versionnement. `AGENTS.md` §1.2 est explicite — « il
   n'y a pas de dérogation pré‑v1.0 au versionnement ».

7. **`packages/engine` est vide, donc aucun chiffre de budget n'est avancé.**
   *Vérifié :* `packages/engine/src` contient `index.ts` et son test, rien d'autre.
   *Ce qui repose dessus :* le refus de tout plafond nouveau [§2, D12] — mais **par une voie différente
   de celle de C3** : C3 pouvait mesurer une boucle de rendu écrite à la main et en tirer une forme
   linéaire ; C4 ne peut pas, parce que le coût des bandes est linéaire en nombre de **pages** et qu'il
   n'existe aucune page. Le plan ne présente donc **aucun** tableau de budget, et c'est un choix : un
   chiffre mesuré sur une sonde sans paginateur décrirait la sonde.
   *Si elle tombe*, c'est-à-dire quand E2 existera : c'est E8 qui remet le chiffre, et le contre-exemple
   à surveiller est nommé — une bande dont le contenu porte une agrégation, réévaluée à chaque page.

8. **~~Le critère de recette se lit comme l'arbitrage n° 1 le décidera.~~ — CESSE D'ÊTRE UNE HYPOTHÈSE
   le 2026‑08‑18.**
   Tout ce que ce plan écrit sur la numérotation supposait que « la numérotation » du *pourquoi* de C4
   appartient au lot, alors que le critère « prêt quand » ne la nomme pas. **L'arbitrage n° 1 est tranché
   en A** : le lot livre le marqueur. Ce n'est donc plus une lecture ni une hypothèse, c'est une
   décision datée, et la même remarque vaut pour les six autres — **aucun des sept arbitrages n'est
   encore une inconnue** [§8].
   *Ce qui reposait dessus :* D7 entière, [§3.5], [§3.6], INC‑2, et deux des neuf `it` de [§6.2] — tous
   confirmés.
   *Ce qui reste vrai malgré la décision :* le critère de recette, lui, **ne nomme toujours pas** la
   numérotation. L'ADR 0006 doit donc écrire que le lot livre **plus** que son critère « prêt quand »
   n'exige — pour le marqueur (n° 1) comme pour la paire de première page (n° 6) — faute de quoi le
   prochain lecteur croira le critère incomplet alors que c'est le lot qui est plus large.

9. **`MAX_SHEET_MM = 5080` est une borne d'interopérabilité qu'Openview se donne, pas une limite du
   format PDF.**
   *Cette hypothèse a été REQUALIFIÉE par une contre-analyse externe, et sa formulation antérieure était
   fausse.* Elle affirmait : « 200 pouces est, à notre connaissance, la plus grande page qu'un lecteur
   PDF est **tenu** de traiter ». Les 200 pouces sont le plafond historique de l'espace utilisateur par
   défaut — 14 400 unités à 1/72 de pouce — mais **PDF 1.6 a introduit le facteur `UserUnit`**, qui rend
   des pages plus grandes exprimables. Il n'y a donc pas d'obligation générale du format à invoquer :
   c'est une borne **produit**, à une valeur empruntée à ce que les lecteurs ont historiquement accepté
   sans mise à l'échelle. **Connaissance externe, non vérifiée dans ce dépôt** — il n'y a **aucun
   moteur**.
   *Ce qui repose dessus :* la **valeur** de la borne, jamais son existence — sans plafond, `1e308` mm
   est un document valide dont l'aire imprimable est infinie.
   *Si elle tombe :* une constante change, et un test change avec elle. **La sonde qui la vérifie
   appartient à E1**, et elle doit être jouée **contre l'adaptateur PDF réellement retenu**, pas contre
   une spécification — ce plan l'y inscrit plutôt que de faire semblant de l'avoir jouée.
