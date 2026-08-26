# Plan d'implémentation — lot C11 : grille, colonnes et calques

> **Document d'implémentation.** Il ferme le périmètre, le contrat persistant, les invariants de
> mise en page, la consommation par le moteur, les mesures navigateur, les tests et l'ordre
> d'exécution de C11. Une fois le lot livré, son ADR d'exécution fera foi et ce plan sera marqué
> périmé.
>
> **Statut : prêt à exécuter sous gate.** La conception est fermée. L'exécution attend la
> stabilisation de C10 dans la branche et, sauf dérogation explicite du propriétaire du produit,
> l'atteinte complète de J3 — E4 et la relecture métier restent dues au 2026-08-26. Les enseignements
> multi-pages dont C11 dépend sont, eux, disponibles dans les ADR 0013 et 0014.
>
> **Baseline relevée le 2026-08-26 :** `CURRENT_SCHEMA_VERSION` vaut **9** ; C10 est livré par
> l'ADR 0015 mais ses changements sont encore présents dans l'arbre de travail ; le moteur pagine
> explicitement, réserve les bandes à hauteur constante, vérifie la suite finale dans Chromium et
> ne connaît aucun calque ni bloc de grille.
>
> **Briques touchées :** `@openview/core`, `@openview/engine`, l'adaptateur Puppeteer, le playground
> et les coutures de type des consommateurs · **ADR cible :** 0016 si la baseline ne change pas ·
> **Poids roadmap :** L, **poids prévisible réel : XL** dès lors que l'on tient la promesse « un
> modèle accepté n'est jamais ignoré par le moteur ».

---

## 0. Résultat attendu

C11 livre deux capacités de mise en page strictement séparées :

1. un bloc de **grille** dans le flux, découpé en colonnes égales et en lignes d'un pas vertical
   déclaré, dont chaque zone contient un conteneur de blocs ;
2. des **calques de page** ordonnés, derrière ou devant le contenu, répétés à l'identique sur toutes
   les pages et ne consommant aucune place dans le flux.

La recette principale est une facture multi-pages dont l'en-tête est une grille à douze colonnes :
logo, coordonnées et cadre de référence occupent trois zones alignées. Un fond de papier et un
filigrane sont peints derrière les quatre pages ; un cachet bitmap est peint devant. Ajouter ou
retirer ces calques ne change ni le nombre de pages, ni les coupures du tableau, ni les reports.

Le lot est fini lorsque les quatre propriétés suivantes sont prouvées ensemble :

- le modèle parsé conserve exactement la grille et les calques qu'il stocke ;
- la géométrie d'une grille dépend uniquement de nombres déclarés et de la largeur de contenu de son
  parent, jamais d'une locale, d'une horloge, d'un aléa ou d'un défaut navigateur ;
- la pagination traite une grille comme un bloc atomique et traite les calques comme une peinture
  hors flux ;
- le navigateur rapporte tout contenu de cellule qui dépasse sa zone, et le moteur refuse avant
  l'impression au lieu de le rogner ou de le laisser chevaucher un voisin.

---

## 1. Sources de vérité et écart réel

### 1.1 Ce que la roadmap impose

La décision produit 8 retient « colonnes + grille complète pas à pas + calques ». C11 est prêt quand
un modèle décrit un découpage en lignes et colonnes, un pas de grille, puis un fond de page,
filigrane ou cachet placé sur un calque distinct. D5 doit construire un en-tête à trois colonnes ;
D10 doit répéter fond et filigrane sur toutes les pages sans perturber la pagination.

Trois restrictions de la vue d'ensemble s'appliquent directement :

- le positionnement libre au millimètre est hors v1 ;
- les calques restent limités aux fonds, filigranes et cachets ;
- si le temps manque, les calques sortent avant la grille et les colonnes.

### 1.2 Ce que C4, C5, E2 et E3 ont déjà décidé

| Fait livré | Conséquence obligatoire pour C11 |
| :--- | :--- |
| une bande occupe une réserve haute ou basse | un calque n'est jamais une bande et ne modifie aucune réserve |
| la largeur d'un bloc est la largeur de contenu de son parent | une grille ne stocke aucune largeur horizontale en millimètres |
| le `padding` retranche la largeur et la hauteur de contenu | les pistes de grille se résolvent dans la boîte de contenu, après padding |
| les bandes réservent une hauteur constante sur toutes les pages | les calques doivent être encore plus simples : zéro hauteur réservée, quel que soit leur contenu |
| les marqueurs gardent une largeur indépendante de leur valeur | un marqueur dans un calque suit la même réserve et ne peut repaginer |
| la pagination gloutonne garantit un progrès strict | une grille atomique consomme une occurrence entière ou est reportée/refusée ; elle n'ajoute aucun curseur 2D |
| la suite finale est mesurée avant impression | le dépassement d'une zone de grille rejoint cette vérification, jamais un `overflow: hidden` silencieux |

### 1.3 Les contradictions documentaires que C11 doit fermer

- L'ADR 0006 attribue une fois la couleur du papier à C5 et une fois aux calques C11/D10. L'ADR
  0007 a retenu la seconde lecture. C11 la confirme : la couleur d'un bloc reste C5 ; la couleur de
  la feuille entière est le fond d'un calque arrière.
- L'ADR 0006 parle de « colonnes de texte sur la page ». C11 interprète cette phrase comme des
  **colonnes de mise en page**, conformément au critère de D5. Le flux automatique d'un texte de la
  colonne 1 vers la colonne 2 n'entre pas dans C11.
- L'ADR 0007 renvoie opacité, ombre, dégradé et canal alpha au modèle de composition. C11 ne les
  prend pas en bloc : il livre l'**opacité d'un calque entier**, nécessaire au filigrane, et refuse
  ombres, dégradés, modes de fusion et canal alpha dans `Color`.

### 1.4 Pourquoi le plan inclut le moteur

Ajouter `grid` à `BlockNode` casse volontairement les visiteurs exhaustifs du moteur. Ajouter
`page.layers` sans le consommer serait pire : le code compilerait, le parse conserverait la donnée,
mais le PDF l'ignorerait.

C11 reste un lot de contrat dans sa décision de produit : `core` ne mesure et ne peint rien. Mais le
monorepo possède désormais un moteur réel. La fermeture du lot comprend donc la consommation
minimale et complète de la nouvelle forme par ce moteur et par son port de mesure. Aucun modèle C11
ne doit être « accepté aujourd'hui, peut-être rendu plus tard ».

---

## 2. Périmètre fermé

### 2.1 Inclus

- un nouveau `GridNode` insérable partout où un `BlockNode` est admis ;
- une grille rectangulaire, colonnes égales, lignes de hauteur fixe ;
- un nombre déclaré de colonnes et de lignes ;
- un pas vertical en millimètres ;
- des zones positionnées par ligne/colonne, avec spans optionnels ;
- un `ContainerNode` comme contenu de chaque zone ;
- le refus des zones hors bornes ou qui se recouvrent ;
- un `BoxStyle` sur la grille et sur le conteneur de chaque zone ;
- une liste optionnelle non vide de calques sur `PageSetup` ;
- deux plans : `background` et `foreground` ;
- l'ordre du tableau comme ordre de profondeur à l'intérieur d'un plan ;
- une opacité optionnelle sur le calque entier ;
- la répétition de chaque calque sur toutes les pages ;
- le fond de feuille par `PageLayer.content.box.background` ;
- les textes, images, conditions, boucles, tableaux et marqueurs déjà existants dans les zones et
  dans les calques ;
- la collecte de chemins, la compatibilité avec le catalogue et les recherches par id ;
- le rendu HTML/CSS, la matérialisation, la pagination atomique et la vérification Chromium ;
- l'estampille de schéma 10 et la migration 9 → 10 par estampille seule ;
- une recette multi-pages et sa démonstration dans le playground.

### 2.2 Exclus, avec leur motif

| Exclu | Motif / propriétaire |
| :--- | :--- |
| position `x/y` en mm et taille libre d'un bloc | hors v1 ; la grille impose des coordonnées discrètes |
| largeur absolue d'une grille ou d'une colonne | la largeur reste dérivée du parent ; C5 a fermé cette chaîne |
| colonnes de largeur arbitraire | les spans sur une grille fine couvrent D5 sans second système de poids |
| hauteur automatique d'une ligne de grille | rendrait le pas décoratif et réintroduirait une mesure dans la géométrie déclarée |
| flux de texte automatique de colonne en colonne | autre algorithme de composition, sans critère de recette ni propriétaire v1 |
| fragmentation d'une grille entre deux pages | ajouterait un curseur 2D et des règles de cellules traversantes ; la grille d'en-tête n'en a pas besoin |
| recouvrement de deux zones dans une grille | la profondeur appartient aux calques, pas à une collision implicite |
| calque limité à l'aire imprimable | fonds et couleur du papier ont pour repère la feuille entière |
| calque `firstOnly`, `lastOnly` ou conditionné par le rang | D10 exige la répétition sur toutes les pages ; l'élargissement restera possible avec une estampille |
| opacité par bloc, alpha `#RRGGBBAA`, ombre, dégradé, mode de fusion | C11 livre seulement la composition nécessaire au filigrane ; le PNG peut porter son alpha propre |
| rotation, transformation et texte diagonal | aucune source de vérité ne les promet ; ajout ultérieur additif |
| clipping volontaire | un contenu rogné est un refus, comme un marqueur rogné |
| guides, magnétisme, raccourcis clavier et undo/redo | Designer D5/D10 ; C11 fournit la forme que les Commands modifieront |
| aperçu React fidèle au PDF | Viewer V1/V3 ; le playground n'est qu'une démonstration interne |
| nouvelle règle métier, champ de donnée réservé ou validation de `RenderRequest.data` | interdits permanents d'Openview |

### 2.3 Test de périmètre

Une proposition appartient à C11 si elle change la **géométrie déclarée** d'une grille ou l'**ordre
de peinture** d'un calque sans lire les données de l'hôte. Si elle choisit une coupure complexe,
invente une valeur métier, dépend d'une mesure de fonte ou autorise une coordonnée continue, elle
sort du lot.

---

## 3. Décisions d'architecture

### D1 — La grille est un nœud, pas un mode optionnel de `ContainerNode`

`GridNode` rejoint `BlockNode`. Un `ContainerNode.layout?: ...` est écarté : le moteur actuel
matérialiserait un conteneur en ignorant facilement le champ, et les visiteurs ne seraient pas
forcés de reconnaître la nouvelle sémantique. Un nouveau discriminant casse la compilation à chaque
parcours exhaustif ; c'est la garantie recherchée.

Un `GridItem` n'est pas un `DocumentNode`. Il porte la position et un `ContainerNode content` ; ce
conteneur fournit déjà l'id stable, le style, les enfants et la participation au Composite. Cette
forme évite un pseudo-nœud supplémentaire qui ne pourrait jamais vivre dans un flux.

### D2 — Douze colonnes n'est pas une constante du produit

Le modèle déclare `columns` et `rows`. Les colonnes ont toutes la même largeur dans la boîte de
contenu de la grille. Une zone plus large emploie `columnSpan`.

La recette utilise douze colonnes parce que 3, 4 et 6 les divisent proprement ; le code ne réserve ni
12, ni le vocabulaire d'une facture. Les bornes publiques sont `1..MAX_GRID_TRACKS`, avec
`MAX_GRID_TRACKS = 1000` sur chaque axe. La surface maximale est donc un million de coordonnées,
borne suffisante pour valider les recouvrements sans algorithme quadratique.

### D3 — Le pas est vertical et déclaré en millimètres

`step` est la hauteur d'une ligne de la **boîte de contenu** de la grille. La largeur d'un pas
horizontal est `contentWidth / columns`. Un déplacement élémentaire vaut donc une colonne sur l'axe
horizontal et `step` millimètres sur l'axe vertical.

Cette asymétrie est volontaire : la largeur doit suivre le parent pour préserver la chaîne de C5,
alors que la hauteur a besoin d'une unité déclarée pour que deux blocs alignés le restent. Stocker
un `stepX` en millimètres ferait d'une grille imbriquée une boîte de largeur concurrente de son
parent.

`step` est fini, strictement positif et au plus `MAX_SHEET_MM`. Aucune contrainte de nombre de
décimales n'est ajoutée, pour la même raison que les feuilles et les espacements existants.

### D4 — Les coordonnées sont physiques, discrètes et commencent à 1

`row: 1` est la première ligne depuis le haut ; `column: 1` est la première colonne depuis le bord
gauche physique de la feuille ou du parent. Les marges du contrat sont déjà physiques
(`left/right`) : C11 n'usurpe donc pas la question ouverte de la direction d'écriture. `start/end`
continuent de gouverner le texte ; les coordonnées de mise en page ne sont pas une direction
typographique.

Les spans absents valent un. Un span présent commence à deux : accepter `columnSpan: 1` donnerait
deux orthographes persistées au même fait. La même règle vaut pour `rowSpan`.

### D5 — Une grille est rectangulaire et sans recouvrement

Chaque zone doit rester dans `[1, rows] × [1, columns]`. Deux rectangles ne peuvent partager aucune
coordonnée. Les zones peuvent laisser des trous et la grille peut être vide : les cases vides et un
rectangle de fond sont des états de conception valides.

Le contrôle de recouvrement remplit un `Set<number>` avec `key = (row - 1) * columns + column - 1`.
Avec les deux axes bornés à 1000, aucune clé ne dépasse 999 999, aucune collision numérique n'est
possible et l'espace exploré ne dépasse jamais un million de cases. Le schéma signale la seconde
zone fautive à son chemin `items.i`.

### D6 — La hauteur d'une grille est entièrement déclarée

La hauteur de contenu vaut `rows × step`. Le padding vertical de `GridNode.box` s'ajoute autour de
cette aire, selon le modèle de boîte déjà publié. Les bordures sont peintes en inset comme les
autres blocs et ne changent pas la géométrie.

Le contenu d'une zone ne redimensionne ni sa ligne, ni la grille. S'il dépasse, le document est
refusé après mesure. Il n'existe ni `min-content`, ni `auto`, ni redistribution silencieuse.

### D7 — La grille est atomique pour la pagination

Une occurrence de grille est placée entière dans le reste de page, reportée entière sur une page
neuve si elle y tient, ou refusée comme ressource atomique surdimensionnée si aucune page admissible
ne peut la porter. Le moteur ne coupe ni entre les lignes, ni dans une zone.

`keepTogether` reste accepté parce que tous les `BlockNode` le portent ; sur une grille, il est
redondant comme sur une image. Cette redondance ne crée aucune seconde politique.

### D8 — Un calque est une propriété de `PageSetup`, jamais un bloc du flux

`PageSetup.layers?: readonly PageLayer[]` est optionnel. L'absence signifie « aucun calque » ; un
tableau vide est refusé avec le remède « omit the field ». Une migration n'ajoute donc pas des
tableaux vides à tous les documents historiques.

`PageLayer.content` est un `ContainerNode`. Son border-box est étiré à la feuille entière ; son
`box.background` peint donc réellement la couleur du papier, marges comprises. Son padding définit
une aire intérieure si l'auteur veut aligner une grille sur un retrait.

### D9 — Deux plans et un ordre suffisent

`PAGE_LAYER_PLANES = ['background', 'foreground']`.

- tous les `background` sont peints avant le contenu paginé ;
- tous les `foreground` sont peints après ;
- dans chaque plan, l'ordre du tableau est l'ordre arrière → avant ; une entrée plus tardive couvre
  une entrée antérieure lorsqu'elles se rencontrent.

Il n'existe ni entier `zIndex`, ni noms de calques réservés, ni tri. Un tableau ordonné ne peut pas
porter deux valeurs concurrentes pour la même profondeur et ne réclame aucune normalisation.

### D10 — Tous les calques se répètent sur toutes les pages

Un calque est matérialisé une fois par rendu et peint sur chaque page. Les expressions et images de
son contenu ne sont pas réévaluées par page. Les marqueurs `number`, `count` et `report` restent des
marqueurs jusqu'à la peinture et reçoivent donc la valeur de chaque page sans exécuter à nouveau le
modèle.

La restriction est le cœur de la maîtrise du risque multi-pages : aucun domaine de dernière page,
aucune passe d'élargissement, aucune ressource tardive et aucune boucle entre l'existence d'un
calque et le nombre de pages.

### D11 — Les calques ne participent à aucune mesure de pagination

Ils n'entrent ni dans `printableAreaOf`, ni dans les réserves de bandes, ni dans `fillFlow`, ni dans
le calcul de slack. Ajouter un fond de page à un modèle déjà rendu doit laisser la séquence de
curseurs et les reports strictement identiques.

Ils participent en revanche à trois observations qui ne choisissent aucune coupure : décodage des
images, réserve typographique des marqueurs, et vérification qu'aucune boîte ne sort de la feuille.

### D12 — L'opacité est une propriété de composition, pas une couleur alpha

`opacity?: number | undefined` s'applique au calque entier. L'absence signifie opaque. Une valeur
présente doit être strictement comprise entre 0 et 1 :

- `1` duplique l'absence et doit être retiré par le producteur ;
- `0` stocke un calque invisible, qui doit être retiré ou gardé derrière une `ConditionNode` ;
- l'alpha d'un PNG embarqué reste intrinsèque à l'image ;
- `ColorSchema` reste `#RRGGBB` et ne change pas.

### D13 — Aucun dépassement n'est une technique de mise en page

Les cellules de grille ne portent pas `overflow: hidden`. L'adaptateur mesure leurs rectangles et
le bord le plus éloigné de leurs descendants. Toute largeur ou hauteur dépassée au-delà de la
tolerance existante produit l'id du conteneur fautif, jamais son texte ni sa source d'image.

`PdfLayoutMeasurement` gagne `overflowingGridItems: readonly string[]`. Le moteur valide cette
liste comme les autres observations et lève `grid-content-overflow` avant impression. Un contenu de
calque sortant de la feuille continue d'être couvert par `escaping`.

### D14 — Les lectures de données couvrent les deux nouvelles positions

Le Visitor de l'AST descend de `GridNode` vers `items[i].content`. Les deux façades C10 parcourent
également `page.layers[i].content`.

Pour ne pas casser l'ordre public livré par C10, les lectures restent : flux, en-tête, pied, puis
calques dans l'ordre stocké. Le chemin local d'une lecture de calque commence par
`['page', 'layers', i, 'content']`. Aucun alias ne traverse d'une zone de grille ou d'un calque vers
son voisin.

### D15 — Une contribution comptable reste attachée à une occurrence du flux

Une table contributrice dans une grille du flux est licite : la grille est atomique, la ligne finit
sur la page qui reçoit la grille, et le collecteur de reports descend dans ses zones.

Une contribution dans un calque est refusée comme elle l'est déjà dans une bande : le calque est
répété, il n'existe donc aucune occurrence de flux à compter. Le contexte interne de
matérialisation distingue cinq aires (`background`, `header`, `root`, `footer`, `foreground`) sans
élargir la liste des trois régions verticales que le port de mesure rapporte.

### D16 — Le schéma passe à 10, par estampille seule

C11 ajoute un membre à `BlockNode` et un champ optionnel à `PageSetup`. Un build v9 refuserait un
`grid` sans message de version et supprimerait `layers` en silence : l'estampille est obligatoire.

La migration 9 → 10 ne transforme rien. Un document v9 déclarait exactement « aucun grid et aucun
calque » ; lui ajouter des structures vides inventerait une seconde forme canonique. L'entrée est :

```ts
{ from: 9, to: 10, migrate: (input) => ({ ...input, schemaVersion: 10 }) }
```

### D17 — Pas de nouveau Port pour la grille ou les calques

Le moteur et l'adaptateur PDF existants constituent déjà les deux côtés du port de mesure. C11
élargit `PdfLayoutMeasurement` parce qu'une observation navigateur est réellement nécessaire. Il
n'introduit ni `GridRendererPort`, ni `LayerPort`, ni service de composition.

### D18 — La fidélité est testée sur la géométrie, pas par capture seule

Les tests principaux comparent coordonnées, tailles, ordre DOM, coupures et observations de
dépassement. Un PDF de recette est rendu pour l'oracle humain, mais aucune capture pixel n'est le
seul filet sous une décision. V3 ajoutera la comparaison aperçu/PDF quand le Viewer existera.

---

## 4. Contrat public cible

### 4.1 Types AST

La forme cible est conceptuellement :

```ts
export interface GridItem {
  readonly row: number;
  readonly column: number;
  readonly rowSpan?: number | undefined;
  readonly columnSpan?: number | undefined;
  readonly content: ContainerNode;
}

export interface GridNode extends NodeBase {
  readonly type: 'grid';
  readonly columns: number;
  readonly rows: number;
  readonly step: number;
  readonly items: readonly GridItem[];
  readonly box?: BoxStyle | undefined;
}
```

`GridNode` rejoint `BlockNode`, `DocumentNode`, `BlockNodeType`, `DocumentNodeType` et le
`NodeVisitor`. `GridItem` reste une valeur de structure, exportée et validée, mais pas un nœud.

### 4.2 Types de page

```ts
export const PAGE_LAYER_PLANES = ['background', 'foreground'] as const;
export type PageLayerPlane = (typeof PAGE_LAYER_PLANES)[number];

export interface PageLayer {
  readonly plane: PageLayerPlane;
  readonly opacity?: number | undefined;
  readonly content: ContainerNode;
}

export interface PageSetup {
  readonly sheet: Sheet;
  readonly margins: PageMargins;
  readonly header: readonly PageBand[];
  readonly footer: readonly PageBand[];
  readonly layers?: readonly PageLayer[] | undefined;
}
```

Le contenu porte l'identité du calque, exactement comme `PageBand.content` porte aujourd'hui
l'identité d'une bande. Aucun champ `id` concurrent n'est ajouté sur `PageLayer`.

### 4.3 Constantes publiques

- `MIN_GRID_TRACKS = 1` ;
- `MAX_GRID_TRACKS = 1000` ;
- `MIN_GRID_STEP_MM` n'est pas une constante numérique distincte : le prédicat est strictement
  positif, comme un filet ;
- `MAX_GRID_STEP_MM = MAX_SHEET_MM` est réexporté sous son nom propre uniquement si les messages ou
  le Designer en ont besoin ; sinon le schéma importe la borne existante ;
- `PAGE_LAYER_PLANES`.

Une constante n'est exportée que si un consommateur peut s'en servir pour produire une valeur
valide. Les détails de la clé d'occupation et la tolérance navigateur restent internes.

### 4.4 Schémas Zod

- `GridItemSchema` valide coordonnées et spans localement ;
- `GridNodeSchema` valide les bornes croisées et le recouvrement par `.check(z.superRefine(...))` ;
- `PageLayerSchema` valide le plan, l'opacité et le conteneur ;
- `PageLayersSchema = z.array(PageLayerSchema).min(1, 'A page layer list is non-empty; omit the field to declare no layer')` ;
- `PageSetupSchema.layers = PageLayersSchema.optional()`.

Les messages donnent le remède et les issues pointent sur la seconde valeur fautive. Aucun code
d'erreur `core` neuf n'est nécessaire : tout est décidable au parsing.

### 4.5 Façade publique

`packages/core/src/index.ts` et les barrels spécialisés exportent types, schémas, tuple et bornes.
Il n'existe pas de fonction `renderGrid`, de coordonnée calculée ni de type DOM dans `core`.

---

## 5. Algorithmes et invariants

### 5.1 Validation d'une zone

Pour chaque item, le schéma calcule les spans effectifs (`1` si absents), puis vérifie :

1. ligne et colonne entières, positives ;
2. spans entiers et au moins 2 lorsqu'ils sont présents ;
3. `row + rowSpan - 1 <= rows` ;
4. `column + columnSpan - 1 <= columns` ;
5. aucune coordonnée occupée n'est déjà dans le `Set`.

Si les bornes simples du nœud ou de l'item ont déjà produit une issue, le contrôle croisé ne crée
pas de cascade. Il suit la règle de coupure de `checkTableWiring`.

### 5.2 Géométrie de rendu

Pour une grille de largeur de contenu `W`, `columns = C`, `rows = R`, `step = S` :

```text
columnWidth = W / C
contentHeight = R × S
itemLeft = (column - 1) × columnWidth
itemTop = (row - 1) × S
itemWidth = columnSpan × columnWidth
itemHeight = rowSpan × S
```

Le moteur n'a pas à effectuer ces multiplications en pixels. Il émet une grille CSS avec
`repeat(C, minmax(0, 1fr))` et `repeat(R, Smm)`, puis la même session Chromium qui mesure le reste
du document mesure les boîtes. Les formules ci-dessus restent l'oracle du contrat et des tests.

### 5.3 Matérialisation

- le `GridNode` devient un `MaterialGrid` ;
- chaque `GridItem` conserve sa géométrie et matérialise son conteneur dans la portée courante ;
- boucles et conditions restent locales au contenu ;
- une couche devient un `MaterialPageLayer`, matérialisé une fois avant le flux ;
- le budget d'évaluation est partagé entre calques, bandes et flux ;
- l'ordre d'évaluation est fermé : calques `background` dans l'ordre stocké, bandes hautes, flux,
  bandes basses, puis calques `foreground` dans l'ordre stocké. Il ne varie jamais par page.

Cet ordre suit l'ordre de peinture. Il reste observable lorsqu'un budget ou une première erreur
arrête l'évaluation ; les tests de budget et l'ADR d'exécution l'épinglent donc explicitement.

### 5.4 Pagination atomique

`MaterialGrid` gagne un `GridFragment` entier. `fillFlow` réemploie la branche atomique de l'image :
mesurer la clé de la grille, placer si elle tient, reporter si une page neuve la porte, refuser sinon.
Les curseurs existants ne gagnent aucun membre `grid`.

Les reports parcourent le fragment entier pour trouver les lignes contributrices qu'il contient.
Une grille posée sur une page termine tous ses contenus sur cette page ; elle ne peut donc pas
produire une contribution à moitié placée.

### 5.5 Composition des pages

Pour chaque `.ov-page`, le DOM fermé est :

```text
page
├── background layers, dans l'ordre
├── printable
│   ├── header
│   ├── root
│   └── footer
└── foreground layers, dans l'ordre
```

Chaque wrapper de calque est positionné absolument sur la feuille. Aucun `z-index` venant du modèle
n'entre dans le CSS. La position DOM et les classes fermées suffisent.

### 5.6 Mesure des zones de grille

L'adaptateur repère chaque wrapper de zone par un attribut fermé. Pour chaque zone :

- il lit son content box ;
- il trouve les bords extrêmes de ses descendants visibles ;
- il compare sur les deux axes avec `TOLERANCE_PX` ;
- il retourne uniquement l'id du `ContainerNode` si un bord sort.

Le moteur valide que `overflowingGridItems` est une liste de chaînes et refuse le premier id. Une
future stratégie non Chromium doit fournir la même observation : le contrat du port porte le fait,
pas la manière DOM de l'obtenir.

### 5.7 Collecte et compatibilité des données

`collectDataPaths(grid)` descend dans les contenus dans l'ordre des items. Les positions de grille
ne lisent aucune expression. `collectTemplateDataPaths` et `checkTemplateDataCompatibility`
ajoutent les calques après les positions existantes, sans dédupliquer les occurrences de la seconde
API.

Les chemins de diagnostic gardent la forme stockée :

- `root.children.0.items.2.content.children.0...` pour une grille du flux ;
- `page.layers.1.content.children.0...` pour un calque.

---

## 6. Organisation cible des fichiers

### 6.1 `@openview/core` — production

| Fichier | Changement |
| :--- | :--- |
| `packages/core/src/ast/types.ts` | `GridItem`, `GridNode`, unions et constantes |
| `packages/core/src/ast/schemas.ts` | schémas, validation croisée et membre `grid` |
| `packages/core/src/ast/nodes.ts` | exports spécialisés |
| `packages/core/src/ast/visitor.ts` | branche exhaustive et descente dans les items |
| `packages/core/src/page/types.ts` | `PageLayerPlane`, `PageLayer`, `PageSetup.layers` |
| `packages/core/src/page/schemas.ts` | schémas de calques et champ optionnel |
| `packages/core/src/page/page.ts` | exports spécialisés |
| `packages/core/src/template/template.ts` | estampille 10 et commentaire de forme |
| `packages/core/src/template/migrate.ts` | étape 9 → 10 |
| `packages/core/src/template/paths.ts` | collecte des calques |
| `packages/core/src/data-catalogue/compatibility.ts` | forme `grid` et analyse des calques |
| `packages/core/src/index.ts` | façade publique |

Le découpage existant `types.ts` / `schemas.ts` reste suffisant. Aucun nouveau dossier abstrait
`layout/` n'est créé : les formes récursives appartiennent à l'AST et les calques à la page.

### 6.2 `@openview/engine` — production

| Fichier / zone | Changement |
| :--- | :--- |
| `document/types.ts` | formes matérielles de grille et de calque |
| `document/materialize.ts` | branche `grid`, matérialisation des calques, aires de document |
| `document/images.ts` | images des grilles et calques |
| `pagination/types.ts` | `GridFragment`, calques dans le document paginé |
| `pagination/flow.ts`, `whole.ts` | placement atomique et fragment entier |
| `pagination/reports.ts`, `progress.ts`, `markers.ts` | traversées exhaustives du nouveau bloc et des calques |
| `pagination/verify.ts`, `validate-measurement.ts` | refus des zones débordantes et validation du reply |
| `html/build.ts` | construction d'une grille et de ses items |
| `html/build-page.ts` | composition arrière-plan / contenu / avant-plan |
| `html/css.ts` | classes fermées, pistes et wrappers de calque |
| `strategy/pdf.ts` | observation `overflowingGridItems` |
| `errors.ts`, `index.ts` | code `grid-content-overflow` et types exportés |

Un petit module `document/layers.ts` est justifié si la sélection/partition des plans dépasse une
fonction. Aucun Port neuf n'est justifié.

### 6.3 Adaptateur et consommateurs

| Fichier / zone | Changement |
| :--- | :--- |
| `packages/adapter-puppeteer/src/measure.ts` | observation des dépassements de zone |
| tests de l'adaptateur | preuve réelle sur largeur et hauteur, reply stable |
| `apps/playground/src/App.tsx` | branche de démonstration `grid`, calques visibles dans l'aperçu interne |
| `apps/playground/src/examples/reference-invoice.ts` | grille d'en-tête et calques de recette |
| `packages/designer/src/types.ts` | aucune liste à maintenir : `BlockType` dérivé gagne `grid` automatiquement |
| `packages/designer/DESIGN.md` | contrat que D5/D10 recevra, sans implémenter l'éditeur |
| `packages/viewer/DESIGN.md` | attente de composition pour V1/V3 |

### 6.4 Tests nouveaux ou fortement étendus

- `packages/core/src/ast/__tests__/grid.test.ts` ;
- `packages/core/src/page/__tests__/layers.test.ts` ;
- `packages/core/src/ast/__tests__/nodes.test.ts` ;
- `packages/core/src/ast/__tests__/visitor.test.ts` ;
- `packages/core/src/data-catalogue/__tests__/compatibility.test.ts` ;
- `packages/core/src/template/__tests__/compatibility-fixtures.ts` et `compatibility.test.ts` ;
- tests de matérialisation, HTML, pagination atomique, reports, images et marqueurs du moteur ;
- `packages/engine/src/__tests__/grid-layout.test.ts` ;
- `packages/engine/src/__tests__/page-layers.test.ts` ;
- tests de mesure Puppeteer et document de référence.

### 6.5 Fichiers à ne pas toucher

`tsconfig*`, `biome.jsonc`, les plugins Biome, les workflows, les seuils de couverture, les
manifests de paquets et les dépendances. C11 s'implémente avec Zod, TypeScript, CSS et l'adaptateur
déjà présents.

---

## 7. Stratégie de tests

### 7.1 TypeScript ↔ Zod

- paires `keyof` bidirectionnelles pour `GridItem`, `GridNode` et `PageLayer` ;
- paire mise à jour pour `PageSetup` ;
- discriminants exacts de `BlockNode` et `DocumentNode` ;
- `NodeVisitor` impossible à construire sans `grid` ;
- `BlockType` du Designer inclut `grid` sans union écrite à la main.

### 7.2 Forme locale de la grille

- minimum et maximum de colonnes/lignes ;
- entier exigé pour axes, coordonnées et spans ;
- pas nul, négatif, infini ou trop grand refusé ;
- coordonnées 0 refusées, coordonnées 1 acceptées ;
- span absent accepté, span 1 refusé, span 2 accepté ;
- grille vide et zones vides acceptées ;
- aller-retour JSON exact d'une grille avec `box`, spans et contenus imbriqués.

### 7.3 Invariants croisés

- item terminant exactement sur le dernier track accepté ;
- dépassement d'une ligne, d'une colonne et de chaque span localisé ;
- recouvrement simple, inclusion complète et croisement de spans refusés ;
- zones adjacentes acceptées ;
- un grand pavage aux bornes termine sans algorithme quadratique ;
- une faute locale empêche la cascade du contrôle croisé.

### 7.4 Calques

- absence conservée comme absence ;
- tableau vide refusé avec remède ;
- `background` et `foreground` acceptés, valeur inconnue refusée ;
- opacité absente, 0.5 acceptée ; 0, 1, NaN, ±Infinity refusés ;
- plusieurs calques du même plan conservés dans l'ordre ;
- conteneur, styles, grille, image et texte dynamiques conservés après parsing.

### 7.5 Visitor et données

- `walk` et `findNodeById` atteignent tous les contenus d'items ;
- `collectDataPaths` respecte les portées d'une boucle dans une zone ;
- `collectTemplateDataPaths` garde l'ordre historique puis ajoute les calques ;
- la compatibilité C10 localise une lecture dans une grille et dans chaque plan ;
- un alias d'un item ne fuit ni vers l'item suivant, ni vers un calque voisin ;
- aucun chemin de position (`row`, `column`, `step`) n'est pris pour une donnée hôte.

### 7.6 Versionnement

- `CURRENT_SCHEMA_VERSION === 10` ;
- registre exact `1→2→…→9→10` ;
- v9 → v10 ne change que l'estampille ;
- un v9 fabriqué à la main avec un `grid` ou `layers` conserve ces champs après estampille ;
- une fixture v10 complète traverse `parseTemplate` et le round trip ;
- un build v9 simulé refuse la version 10 avec le message « newer release » avant d'atteindre le
  discriminant ou de supprimer le champ.

### 7.7 Matérialisation

- expressions d'une zone évaluées dans la bonne portée et une seule fois ;
- calque évalué une fois sur un PDF de quatre pages ;
- budget partagé : le coût d'un calque est soustrait au même plafond que le flux ;
- marqueurs gardés non substitués jusqu'à la composition ;
- contribution dans une grille racine acceptée ; contribution dans un calque refusée avec aire et
  `nodeId` ;
- image de calque incluse dans les ressources ouvertes avant toute mesure.

### 7.8 Pagination

- grille qui tient dans le reste de page y reste ;
- grille qui tient seulement sur page neuve est reportée entière ;
- grille trop haute pour une page neuve est refusée ;
- aucune nouvelle variante de curseur n'existe ;
- une table contributrice dans la grille alimente le report de la page suivante ;
- ajouter les calques à un document conserve exactement pages, fragments et reports.

### 7.9 HTML/CSS

- nombre de pistes et pas écrits depuis les valeurs validées ;
- placement 1-based et spans exacts ;
- padding de grille laisse les tracks dans la boîte de contenu ;
- DOM : arrière-plans, printable, avant-plans ;
- ordre stable de deux calques du même plan ;
- contenu racine du calque à la taille exacte de la feuille ;
- aucune chaîne du modèle n'entre dans le CSS structurel ;
- aucune règle `overflow:hidden` sur une zone de grille.

### 7.10 Port de mesure et adaptateur réel

- `overflowingGridItems` manquant, non tableau ou instable refusé comme reply incomplet ;
- dépassement horizontal et vertical détecté dans Chromium ;
- contenu exactement au bord accepté avec la tolérance ;
- id seul remonté, aucun texte ou src ;
- la même page mesurée deux fois dans la session rend la même observation ;
- le moteur lève `grid-content-overflow` avant `print` ;
- une boîte de calque sortant de la feuille reste couverte par `escaping`.

### 7.11 Régressions

- facture E1 mono-page inchangée sans C11 ;
- facture E2/E3 reste à quatre pages sans C11 ;
- bandes, marqueurs, images, veuves/orphelines, `keepTogether` et reports gardent leurs suites ;
- `RenderPort`, `RenderRequest` et `RenderResult` restent identiques ;
- aucune lecture d'environnement dans `core` ou `engine` ;
- couverture globale ≥ 90 %, sans exclusion neuve.

---

## 8. Recette C11

### 8.1 Modèle d'épreuve

La facture de référence porte :

- une feuille A4 et ses marges déjà déclarées ;
- une grille d'en-tête à 12 colonnes, 8 lignes, pas de 4 mm ;
- zone logo : colonnes 1–3 ;
- zone coordonnées : colonnes 4–8 ;
- zone référence : colonnes 9–12 ;
- une zone sur deux lignes pour prouver `rowSpan` ;
- un calque `background` opaque portant la couleur du papier ;
- un second calque `background`, opacité 0.12, portant « DUPLICATA » au centre d'une grille de page ;
- un calque `foreground`, opacité 0.85, portant un cachet PNG en bas à droite ;
- le tableau de soixante lignes, les reports, marqueurs et mentions de dernière page déjà livrés.

Les noms de données de la facture restent confinés à la fixture. La production ne connaît ni
client, ni duplicata, ni cachet.

### 8.2 Oracles automatiques

1. le modèle parse et ressort identique après JSON ;
2. les trois zones d'en-tête ont des bords verticaux communs à moins de `TOLERANCE_PX` ;
3. le PDF porte quatre feuilles ;
4. chaque feuille porte les trois calques dans le même ordre ;
5. les numéros de page à l'intérieur d'un calque, s'ils sont présents dans la sonde, valent 1 à 4 ;
6. avec et sans calques, les fragments de flux, reports et réserves de bandes sont identiques ;
7. aucune zone ne déborde et aucune image ne sort de la feuille ;
8. remplacer un texte de zone par un texte trop long produit `grid-content-overflow` et aucun PDF.

### 8.3 Oracle humain

Le PDF conservé pour revue doit montrer :

- trois colonnes visiblement droites ;
- un filigrane lisible sans nuire au tableau ;
- un cachet au-dessus du contenu ;
- la couleur jusque dans les marges ;
- aucun déplacement ou changement d'opacité entre les pages ;
- aucun rognage, chevauchement accidentel ou variation de coupure.

Cette revue n'est pas la validation métier J3/J6. Elle porte uniquement sur la composition C11.

---

## 9. Incréments d'exécution

### INC-0 — Gate, baseline et sondes jetables

- stabiliser ou rebaser les changements C10 ;
- exécuter les quatre portes sur la baseline ;
- confirmer le statut de J3 ou consigner la dérogation explicite ;
- sonder dans Chromium : pistes fixes, padding, calques pleine feuille, ordre de peinture et mesure
  d'un dépassement de zone ;
- supprimer les artefacts jetables après transcription des résultats dans l'ADR.

### INC-1 — Contrat de grille et Visitor

- types, schémas, bornes et contrôle de recouvrement ;
- nouveau membre des unions et du Visitor ;
- tests de type, de parsing, de parcours et de données ;
- compilation volontairement rouge dans les consommateurs exhaustifs jusqu'à INC-4.

### INC-2 — Contrat de calques

- types et schémas de page ;
- collecte de chemins et compatibilité catalogue ;
- tests de forme canonique, ordre et opacité.

### INC-3 — Pérennité et façade publique

- estampille 10 et migration 9 → 10 ;
- fixture historique v10 et chaîne complète ;
- exports publics ;
- aucun merge ou release tant que les consommateurs des incréments suivants ne sont pas verts.

### INC-4 — Matérialisation et pagination de la grille

- formes matérielles ;
- branche exhaustive ;
- grille atomique, fragments entiers et reports ;
- tests sans navigateur sur la grille métrique existante.

### INC-5 — Calques dans le document paginé

- matérialisation unique et budget partagé ;
- images et marqueurs ;
- composition background / printable / foreground ;
- preuve que les coupures ne changent pas.

### INC-6 — CSS, mesure et refus propre

- grille CSS et calques pleine feuille ;
- extension du contrat `PdfLayoutMeasurement` ;
- mesure Puppeteer et validation ;
- code `grid-content-overflow` ;
- tests d'intégration réels.

### INC-7 — Recette et playground

- modèle C11 de référence ;
- aperçu interne et téléchargement PDF ;
- oracles automatiques et revue visuelle ;
- vérification des coutures Designer/Viewer.

### INC-8 — Ablations, ADR et clôture

- jouer les substitutions du §10 ;
- écrire l'ADR 0016 avec les écarts mesurés ;
- marquer ce plan périmé ;
- mettre à jour roadmaps et DESIGN ;
- exécuter les quatre portes dans l'ordre.

Les incréments 1 à 6 forment une seule fenêtre non publiable : l'estampille protège les lecteurs
anciens, mais seul le moteur complet protège les lecteurs courants contre un champ accepté puis
ignoré. La PR ne doit pas être découpée à l'intérieur de cette fenêtre.

---

## 10. Preuves d'ablation

Chaque substitution suivante doit faire rougir au moins un test nommé :

| Ablation | Preuve attendue |
| :--- | :--- |
| retirer `grid` de `BlockNodeSchema` | round trip du modèle C11 |
| retirer la branche Visitor | type-check exhaustif |
| autoriser `span: 1` | forme canonique |
| omettre le contrôle hors bornes | matrice des quatre côtés |
| omettre le contrôle de recouvrement | inclusion/croisement de zones |
| utiliser une largeur horizontale fixe | test de deux parents de largeurs différentes |
| laisser le contenu déterminer la hauteur | mesure d'un texte court puis long |
| rendre la grille fragmentable | scénario au bord de page |
| ignorer les contenus de grille dans les reports | contribution dans une grille racine |
| accepter `layers: []` | forme canonique de PageSetup |
| peindre un background après le printable | ordre DOM et oracle de superposition |
| peindre un foreground avant le printable | même oracle, branche inverse |
| inclure les calques dans les réserves | comparaison des coupures avec/sans calque |
| matérialiser un calque par page | compteur d'évaluation et budget |
| oublier les calques dans les images | cachet de recette |
| oublier les calques dans les marqueurs | marqueur de calque |
| oublier les calques dans C10 | lecture localisée de calque |
| ne pas remonter les dépassements de zone | scénario Chromium trop large/trop haut |
| masquer les dépassements en CSS | recherche et test de refus avant impression |
| ignorer `overflowingGridItems` dans `verifyLayout` | aucun appel à `print` |
| omettre l'estampille ou la migration | refus du build antérieur et chaîne historique |
| accepter opacité 0 ou 1 | tests de forme canonique |
| lire `Date`, `Intl`, `Math.random`, `process` ou `performance` | lint et balayage de périmètre |

Une mutation tuée uniquement par timeout n'est pas une preuve. Le pavage maximal et le recouvrement
hostile doivent terminer avec une assertion lisible.

---

## 11. Définition de fini

- [ ] C10 est stabilisé et la baseline passe les quatre portes ;
- [ ] le gate J3 est satisfait ou sa dérogation est explicitement consignée ;
- [ ] `GridNode` et `PageLayer` sont Zod-first, exportés et couverts par les portes de type ;
- [ ] aucune coordonnée continue ni largeur absolue n'est stockée ;
- [ ] les recouvrements et sorties de grille sont refusés au parsing ;
- [ ] les dépassements de contenu sont refusés après mesure, avant impression ;
- [ ] la grille est atomique et n'ajoute aucun curseur de pagination ;
- [ ] les calques sont pleine feuille, répétés sur toutes les pages et hors flux ;
- [ ] l'opacité est au niveau du calque, `ColorSchema` reste inchangé ;
- [ ] les chemins et diagnostics couvrent grilles et calques sans fuite de données ;
- [ ] la compatibilité C10 garde son ordre historique ;
- [ ] le schéma courant vaut 10 et la migration 9 → 10 ne change que l'estampille ;
- [ ] moteur, adaptateur, playground et coutures de type compilent ensemble ;
- [ ] la facture de recette reste à quatre pages et ses coupures sont invariantes avec/sans calque ;
- [ ] un filigrane, une couleur de papier et un cachet sont visibles sur chaque page ;
- [ ] aucune promesse de rotation, ombre, dégradé, page spécifique ou flux multi-colonne n'a glissé ;
- [ ] aucune dépendance, configuration ou suppression de lint n'a été ajoutée ;
- [ ] les ablations ont un verdict lisible ;
- [ ] ADR 0016, roadmaps et DESIGN reflètent l'exécution réelle ;
- [ ] `pnpm run lint && pnpm run build && pnpm run type-check && pnpm run test:coverage` est vert.

---

## 12. Risques et réponses prévues

### Le mot « grille » dérive vers un canvas libre

Réponse : colonnes égales, lignes discrètes, coordonnées 1-based et spans. Aucune paire `x/y`,
aucune largeur/hauteur de bloc et aucun déplacement fractionnaire.

### Une donnée longue casse une cellule fixe

Réponse : c'est un refus mesuré et localisé, jamais une ligne auto ni un clipping. Le Designer D5
pourra prévenir avant sauvegarde avec les mêmes dimensions, mais le moteur reste la frontière finale.

### La grille devient un second tableau

Réponse : aucune section header/body/footer, aucune répétition de lignes, aucune colonne identifiée,
aucun alignement de données. Le tableau exprime une collection sémantique et paginable ; la grille
exprime une géométrie atomique.

### Les calques font osciller la pagination

Réponse : ils n'ont aucune réserve et sont identiques sur toutes les pages. Le nombre de pages est
calculé sans eux ; seule la peinture finale les ajoute.

### Un foreground masque un contenu important

Réponse : c'est précisément la capacité demandée pour un cachet. Le contrat rend l'ordre explicite ;
le Designer devra rendre le plan visible et sélectionnable. C11 n'invente pas une règle de contraste.

### La mesure navigateur élargit trop le Port

Réponse : le port possède déjà les observations de clipping, d'évasion et de chargement d'image.
Une cellule contrainte est le même genre de fait : sans navigateur, le moteur ne peut pas le savoir.
La charge reste une liste d'ids sûrs à journaliser.

### Le nombre de branches exhaustives explose

Réponse : le Visitor central casse la compilation aux bons sites. Les parcours qui opèrent sur les
formes matérielles restent des unions exhaustives locales ; aucune Registry n'est introduite sans
second plugin réel.

### L'opacité ouvre toute la composition graphique

Réponse : elle ne s'applique qu'au wrapper de calque. Aucun champ n'est ajouté à `BoxStyle` ou
`Color`, et chaque propriété écartée est nommée dans le périmètre.

### Le poids réel dépasse L

Réponse : l'écart est assumé en tête du plan. Couper l'adaptation moteur ne réduit pas le lot, il
crée une acceptation silencieusement fausse. Si une réduction est nécessaire, la roadmap donne la
seule coupe saine : livrer grille/colonnes et retirer **entièrement** `PageLayer` du schéma, du moteur
et de la recette avant l'estampille finale.

---

## 13. Contrôle de périmètre avant exécution

INC-0 doit répondre explicitement à ces questions :

1. C10 est-il dans un état stable et les quatre portes sont-elles vertes avant C11 ?
2. J3 est-il atteint ; sinon, quelle demande explicite autorise l'écart ?
3. le prochain numéro d'ADR est-il toujours 0016 et le prochain schéma toujours 10 ?
4. existe-t-il depuis cette baseline un consommateur exhaustif supplémentaire de `DocumentNode` ?
5. une stratégie PDF autre que Puppeteer existe-t-elle, exigeant la mise à jour d'un second adaptateur ?
6. un texte de décision plus récent promet-il rotation, calque page-spécifique ou flux multi-colonne ?
7. la sonde Chromium confirme-t-elle qu'une grille CSS à pistes fixes garde la géométrie attendue
   avec padding et contenu dynamique ?
8. la mesure de dépassement est-elle stable à `TOLERANCE_PX` dans deux chargements de la même session ?
9. la facture de référence reste-t-elle un bon oracle multi-pages sans calibration artificielle ?
10. toutes les nouvelles formes persistées entrent-elles avant l'unique estampille 10 ?

Tout « non » modifie le plan ou bloque l'exécution ; il ne justifie ni cast, ni assouplissement de
configuration, ni champ de compatibilité inventé.
