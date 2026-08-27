# ADR 0016 — Grille, colonnes et calques

- **Statut :** 🟢 **Accepté** (2026-08-26), implémenté dans `@openview/core`, `@openview/engine`,
  `@openview/adapter-puppeteer`, avec une démonstration dans `apps/playground`
- **Date :** 2026-08-26
- **Impact :** `@openview/core` (un nœud `grid` dans le flux, des `layers` sur la page,
  estampille **10**), `@openview/engine` (matérialisation, pagination atomique, composition des
  pages, mesure des zones), `@openview/adapter-puppeteer` (l'observation
  `overflowingGridItems`), `apps/playground` (grille d'en-tête, calques, aperçu),
  `@openview/designer` et `@openview/viewer` (chartes mises à jour, code intact —
  `BlockType` étant dérivé, il gagne `grid` sans qu'une ligne bouge)
- **Rompt le port de mesure, volontairement :** `PdfLayoutMeasurement` gagne un champ **requis**
  `overflowingGridItems: readonly string[]`. Une stratégie qui ne le renvoie pas est refusée
  comme reply incomplet — c'est le prix pour qu'aucun modèle accepté ne soit « peut-être rendu ».
  `RenderPort`, `RenderRequest` et `RenderResult` sortent du lot **inchangés**.
- **Estampille 10, migration 9 → 10 par estampille seule.** Un v9 fabriqué à la main qui porte
  déjà un `grid` ou des `layers` traverse la chaîne avec ses champs intacts ; un build v9 refuse
  un document v10 avec le message « newer release » avant d'atteindre un discriminant.
- **Ferme deux contradictions documentaires :** la couleur du papier est le fond d'un calque
  arrière (lecture de l'[ADR 0007](0007-l-apparence.md), confirmée contre
  l'[ADR 0006](0006-la-page.md)) ; les « colonnes de texte » de l'ADR 0006 sont des colonnes de
  **mise en page** — le flux automatique d'un texte de colonne en colonne n'entre pas dans C11.
- **N'amende aucune règle de gouvernance.** `AGENTS.md`, `tsconfig*.json`, `biome.jsonc`, les
  plugins GritQL, les workflows, les seuils de couverture sortent du lot **inchangés**.
  **Aucune dépendance n'est ajoutée.**
- **Écart d'ordonnancement, assumé et nommé :** comme pour C10, **J3 n'est pas atteint** — E4
  n'est pas livré et la relecture métier n'a pas eu lieu. Le lot a été exécuté sur demande du
  propriétaire du produit ; la revue de composition (§ Recette) porte sur C11 seul et ne vaut
  pas validation métier J3/J6.
- **Plan d'implémentation :**
  [docs/plans/c11-grille-colonnes-et-calques.md](../plans/c11-grille-colonnes-et-calques.md) —
  **périmé** depuis ce lot ; les écarts sont au
  [§ Ce que l'exécution a corrigé du plan](#ce-que-lexécution-a-corrigé-du-plan).
- **Implémentation :**
  [`core/src/ast/types.ts`](../../packages/core/src/ast/types.ts) et
  [`schemas.ts`](../../packages/core/src/ast/schemas.ts) (`GridItem`, `GridNode`, bornes et
  recouvrement), [`core/src/page/types.ts`](../../packages/core/src/page/types.ts) et
  [`schemas.ts`](../../packages/core/src/page/schemas.ts) (`PageLayer`, `PageSetup.layers`),
  [`core/src/template/migrate.ts`](../../packages/core/src/template/migrate.ts) (9 → 10),
  [`engine/src/document/materialize.ts`](../../packages/engine/src/document/materialize.ts)
  (grille, calques, cinq aires),
  [`engine/src/pagination/`](../../packages/engine/src/pagination/) (fragment entier, refus
  `grid-content-overflow`),
  [`engine/src/html/`](../../packages/engine/src/html/) (pistes CSS, composition
  arrière-plans / printable / avant-plans),
  [`adapter-puppeteer/src/measure.ts`](../../packages/adapter-puppeteer/src/measure.ts)
  (dépassements de zone mesurés dans Chromium)

---

## Contexte

La décision produit 8 retient « colonnes + grille complète pas à pas + calques » : D5 doit
construire un en-tête à trois colonnes, D10 doit répéter fond et filigrane sur toutes les pages
sans perturber la pagination. Le contrat devait savoir décrire ces deux capacités **avant**
l'éditeur — et, le monorepo possédant désormais un moteur réel, les faire **rendre** dans le même
lot : ajouter `page.layers` sans le consommer aurait produit des documents « acceptés
aujourd'hui, peut-être rendus plus tard », exactement la fausse acceptation que ce dépôt refuse.

## Décisions

Les dix-huit décisions du plan (D1–D18) ont été exécutées telles quelles ; les plus
structurantes, avec ce que l'exécution y a appris :

1. **La grille est un nœud** (`GridNode` dans `BlockNode`), pas un mode de `ContainerNode` : le
   nouveau discriminant a bien cassé la compilation à chaque parcours exhaustif — moteur,
   playground compris — et c'était la garantie recherchée. Un `GridItem` n'est **pas** un nœud :
   il porte la position et un `ContainerNode content` qui a l'id, le style et les enfants.
2. **Géométrie entièrement déclarée.** `columns`/`rows` entiers dans `[1, 1000]`
   (`MIN_GRID_TRACKS`/`MAX_GRID_TRACKS`), `step` vertical en millimètres, fini, strictement
   positif, au plus `MAX_SHEET_MM`. La largeur d'une colonne est `largeurDeContenu / columns` —
   aucune largeur horizontale n'est stockée, la chaîne de C5 est préservée. La hauteur de
   contenu vaut `rows × step` : le contenu d'une zone ne redimensionne **jamais** une piste.
3. **Coordonnées 1-based, spans à partir de 2.** `columnSpan: 1` est refusé : l'absence est la
   seule orthographe persistée d'un span unitaire. Le recouvrement est contrôlé par un
   `Set<number>` de clés `(row-1)*columns+column-1` ; une zone fautive arrête son propre
   balayage à la première case partagée, donc un empilement hostile ne rend pas le contrôle
   quadratique, et le pavage maximal (10⁶ cases) termine avec un verdict lisible.
4. **La grille est atomique.** Placée entière, reportée entière, ou refusée
   `oversized-atomic-resource` — la même branche que l'image, aucun curseur 2D. Une table
   contributrice dans une zone est licite : la grille finit sur une page, ses contributions
   avec elle. Le collecteur de reports descend dans les zones.
5. **Un calque est une propriété de `PageSetup`**, jamais un bloc du flux : liste optionnelle
   **non vide** (le tableau vide est refusé avec le remède « omit the field »), deux plans
   (`background`, `foreground`), l'ordre du tableau comme profondeur — pas de `zIndex`.
   Le contenu (`ContainerNode`) est étiré à la feuille entière, marges comprises : son
   `box.background` peint réellement la couleur du papier.
6. **Tous les calques se répètent sur toutes les pages** et sont matérialisés **une fois** par
   rendu ; les marqueurs `number`/`count`/`report` restent des marqueurs jusqu'à la composition
   et reçoivent la valeur de chaque page sans réévaluer le modèle. Le budget d'évaluation est
   partagé entre calques, bandes et flux ; l'ordre d'évaluation suit l'ordre de peinture
   (`background` → bandes hautes → flux → bandes basses → `foreground`) et ne varie jamais.
7. **Les calques ne participent à aucune mesure de pagination** : ni réserves, ni `fillFlow`,
   ni slack, ni sonde naturelle. Ils participent aux trois observations qui ne choisissent
   aucune coupure : décodage des images, réserve typographique des marqueurs, sortie de feuille
   (`escaping`). La preuve de recette : avec et sans calques, coupures, lignes par feuille et
   reports sont identiques.
8. **L'opacité est une composition de calque**, `opacity` strictement entre 0 et 1 — `0` et `1`
   sont refusés (formes canoniques : retirer le calque, omettre le champ). `ColorSchema` reste
   `#RRGGBB` ; ombres, dégradés, modes de fusion et alpha restent hors lot.
9. **Aucun dépassement n'est une technique de mise en page.** Les zones ne portent pas
   d'`overflow: hidden`. L'adaptateur compare, sur les deux axes et à `TOLERANCE_PX`, la boîte
   de contenu de chaque wrapper `[data-openview-grid-item]` aux bords extrêmes de ses
   descendants visibles, et remonte **l'id du conteneur de zone et rien d'autre**. Le moteur
   valide `overflowingGridItems` comme le reste du reply et lève `grid-content-overflow`
   avant `print`.
10. **Cinq aires internes, trois régions au port.** Le contexte de matérialisation distingue
    `background | header | root | footer | foreground` (`DocumentArea`) ; une contribution
    comptable dans un calque est refusée avec l'aire et le `nodeId`, comme dans une bande. Le
    port de mesure continue de rapporter trois régions verticales.
11. **Pas de nouveau Port.** `PdfLayoutMeasurement` s'élargit d'une observation réellement
    navigateur ; ni `GridRendererPort`, ni `LayerPort`.

## Ce que l'exécution a corrigé du plan

1. **`ATTRIBUTE_ORDER` du sérialiseur.** Le plan ne nommait pas que la liste fermée des
   attributs sérialisés devait gagner `data-openview-grid-item` ; sans cette ligne, l'attribut
   était **silencieusement omis** du HTML et l'observation de dépassement devenait muette. La
   recette Chromium l'a détecté (aucune sonde ne portait l'attribut) ; la leçon est notée ici :
   tout nouvel attribut fermé s'ajoute à `serialize.ts` **et** à `HtmlAttributes`.
2. **La sonde naturelle exclut les calques.** Le plan laissait la composition de la sonde
   implicite ; l'exécution la ferme : aucune boîte de calque n'est annotée ni mesurée — ils ne
   décident aucune coupure — et `validateMeasurement` continue d'exiger l'égalité stricte
   demandes/réponses.
3. **Le contrôle croisé ne cascade pas, dans les deux sens.** Une coordonnée qui a échoué à ses
   bornes locales est ignorée du contrôle croisé (règle du plan), mais une coordonnée entière
   ≥ 1 au-delà des axes — que les bornes locales n'attrapent pas — est bien signalée hors
   bornes : le garde initial d'exécution (`isCoordinate`/`isSpan`) distingue les deux cas, ce
   que la formulation du plan ne faisait pas.
4. **La recette porte le titre dans la grille.** Le plan posait la grille d'en-tête *à côté* du
   titre ; à l'exécution, le titre vit dans la zone centrale (12 colonnes, 6 lignes, pas de
   4 mm, marque sur `rowSpan: 4`) pour que la facture de référence reste à **quatre feuilles**.
   Le filigrane est composé à 26 pt : « DUPLICATA » est un mot insécable, et plus grand il
   déborderait sa zone de 70 mm — le refus mesuré fonctionne, la recette l'exerce avec un
   `holder` trop long (`grid-content-overflow`, aucun `print`).
5. **`MAX_GRID_STEP_MM` n'est pas réexporté.** Le schéma importe `MAX_SHEET_MM` ; aucun
   consommateur n'a eu besoin d'un nom distinct — la règle « une constante n'est exportée que
   si un consommateur peut s'en servir » a tranché.

## Recette

La facture de référence de l'adaptateur (`layeredReferenceDocument`) : soixante lignes, A4,
en-tête sur grille 12 × 6 au pas de 4 mm (marque `rowSpan: 4` × `columnSpan: 3`, titre sur
5 colonnes, référence sur 4), un fond de papier opaque, un filigrane « DUPLICATA » à 0.12,
un cachet bitmap à 0.85. Vérifié dans Chromium :

- le modèle parse et ressort identique après JSON ;
- les trois zones mesurées ont des largeurs proportionnelles exactes à leurs spans (< 1 px) ;
- le PDF porte **quatre feuilles**, chacune composée `paper` → `watermark` → printable →
  `stamp`, opacités `0.12`/`0.85` sur les wrappers ;
- **avec et sans calques : mêmes coupures, mêmes lignes par feuille, mêmes reports** ;
- un texte de zone trop long produit `grid-content-overflow` avec l'id de la zone, le message
  ne répète pas la valeur, et **rien n'est imprimé**.

Cette revue porte sur la composition C11 seule ; la validation métier J3/J6 reste due.

## Preuves d'ablation

Rejouées par script (mutation appliquée, test ciblé exécuté, mutation annulée), chaque
substitution tuée par une assertion nommée — aucun timeout :

| Ablation | Tuée par |
| :--- | :--- |
| retirer `grid` de `BlockNodeSchema` | `grid.test.ts` › round trip |
| autoriser `span: 1` | `grid.test.ts` › one persisted spelling |
| omettre le contrôle hors bornes | `grid.test.ts` › locates a zone that leaves the grid |
| omettre le contrôle de recouvrement | `grid.test.ts` › refuses a simple overlap |
| accepter `layers: []` | `layers.test.ts` › refuses an empty list |
| accepter opacité 0 ou 1 | `layers.test.ts` › strictly intermediate opacity |
| peindre un background après le printable | `page-layers.test.ts` › paints background layers |
| oublier les calques dans les images | `page-layers.test.ts` › lists a layer image |
| oublier les calques dans C10 | `layers.test.ts` › locates a layer reading |
| ignorer les contenus de grille dans les reports | `grid-layout.test.ts` › feeds the next page report |
| ignorer `overflowingGridItems` dans `verifyLayout` | `measurement.test.ts` › grid zone whose content reached |
| omettre la migration 9 → 10 | `compatibility.test.ts` › is continuous, ordered and complete |
| rendre la grille tolérante à la page trop courte | `grid-layout.test.ts` › refuses a grid taller than a fresh page |

Les ablations « lecture d'environnement » restent couvertes par le lint (plugin
`no-environment-read`) ; « largeur fixe » et « hauteur au contenu » sont couvertes par les
oracles de géométrie (`measures a grid at its declared height`, parts de largeur mesurées dans
Chromium).

## Conséquences et dettes

- **Le Designer D5/D10 reçoit un contrat fermé** — voir l'encadré C11 de
  [`packages/designer/DESIGN.md`](../../packages/designer/DESIGN.md). L'attente de composition
  du Viewer est notée dans [`packages/viewer/DESIGN.md`](../../packages/viewer/DESIGN.md).
- **Calque limité, à dessein :** pas de `firstOnly` de calque, pas de rotation, pas de texte
  diagonal, pas de clipping volontaire. Tout élargissement passera par une estampille.
- **Le filigrane incliné attendra la rotation** : un vrai filigrane diagonal n'est pas
  exprimable en v1, c'est nommé et assumé (périmètre §2.2 du plan).
- **J3 reste dû** : E4 et la relecture métier. Deux lots livrés hors gate d'affilée — le
  troisième ne devrait pas exister sans que J3 soit soldé.
