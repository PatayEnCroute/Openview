# Plan d'implémentation — `@openview/engine` lot E5 : le moteur sait dire où il coupe

> **Statut :** plan prêt à exécuter — 2026-08-28  
> **Lot :** E5 — poids M — dépend de E3, exécuté sur la baseline E4 livrée  
> **Condition de :** viewer V1, puis jalon J4  
> **Décision d'exécution attendue :** ADR 0018

Ce plan part de l'état réellement livré par E1 à E4. Le moteur choisit déjà les coupures,
matérialise des fragments fermés, recalcule les reports sur la suite finale, stabilise cette suite
contre une mesure Chromium et imprime exactement l'HTML vérifié. E5 ne doit donc écrire **aucun
second paginateur**. Il doit rendre publique une projection sûre de ce résultat interne et fournir
une voie qui s'arrête avant `print()`.

Les sources normatives sont :

- la [roadmap moteur](../roadmap/engine.md#e5-le-moteur-sait-dire-où-il-coupe) ;
- la [roadmap viewer](../roadmap/viewer.md#une-dépendance-à-assumer-demblée) ;
- [ADR 0009](../adr/0009-les-blocs-insecables.md), D3 et D5, pour l'identité d'occurrence et
  l'observabilité du repli `keepTogether` ;
- [ADR 0010](../adr/0010-un-refus-comprehensible.md), D2, pour la distinction entre chemin de
  déclaration et occurrence matérialisée ;
- [ADR 0013](../adr/0013-le-tableau-deborde-proprement.md), D-1 et D-4, pour la propriété des
  coupures et le caractère strictement interne des clés de mesure ;
- [ADR 0014](../adr/0014-les-exigences-comptables.md), D-15, pour les reports et la dette E5 ;
- [ADR 0017](../adr/0017-langue-et-devise-au-rendu.md), pour la dette E4-9 sur ICU.

---

## 0. Résultat attendu

Une nouvelle façade publique permet ceci, sans produire un octet PDF :

```ts
const pagination = createPaginationPort(strategy, options);
const result = await pagination.paginate({ template, data });
```

`result` contient :

- l'HTML autonome **exactement issu de la composition finale vérifiée** ;
- la feuille déclarée et le nombre ordonné de pages ;
- pour chaque page, les occurrences qu'elle contient, leur région et leur état de fragmentation ;
- les lignes contributrices qui s'achèvent sur cette page et le report brut entrant ;
- les replis `keepTogether` réellement présents dans la suite finale.

La facture de référence de soixante lignes rend donc quatre entrées de page. Chaque occurrence de
ligne de détail apparaît sur la page où elle est peinte ; une ligne fragmentée apparaît sur chaque
page concernée avec `first`, `middle` ou `last` ; l'en-tête de table répété est explicitement
distingué ; les reports entrants valent ceux employés pour composer l'HTML ; aucun appel
`PdfRenderSession.print()` n'a lieu.

Le PDF existant continue d'emprunter le même chemin jusqu'à la composition, puis appelle `print()`
sur l'HTML combiné. Il n'existe qu'une source de vérité pour :

- les coupures ;
- les pages et leurs bandes ;
- les fragments de texte, de conteneur, de table et de ligne ;
- les champs `number`, `count` et `report` ;
- le CSS et l'échappement ;
- les écritures ICU déjà résolues côté moteur.

E5 est **une condition de J4**, pas J4 lui-même : il livre la source que le viewer devra afficher.
V1 à V3 restent propriétaires de l'encastrement, de la navigation et de la comparaison visuelle
automatique avec le PDF.

---

## 1. État du dépôt et écarts à combler

### 1.1 Ce que E2 à E4 ont délibérément préparé

| Besoin E5 | Baseline disponible | Consigne de réemploi |
| :--- | :--- | :--- |
| Coupures choisies par le moteur | `paginate()` produit `PaginatedDocument.pages` | ne jamais demander à Chromium ni au viewer de repaginer |
| Fragments explicites | `MaterialFragment`, `RowFragment`, `FragmentEdge` | projeter, ne pas reconstruire depuis l'HTML |
| Suite vérifiée | `settle()` mesure l'HTML composé jusqu'à absence de débordement | seul le dernier tour réussi peut devenir public |
| HTML fermé | `buildPagedTree()` puis `serializeHtml()` | publier l'artefact final comme opaque, pas les helpers internes |
| Reports exacts | `withIncomingReports()` part des fragments finaux | enrichir son résultat sans refaire la somme ailleurs |
| Occurrences mesurables | `MaterialBase.key` et `MaterialRowGroupOccurrence.key` | conserver ces clés internes aux sondes |
| Chemins d'occurrence | `MaterialBase.path` mêle chemin AST et rangs de boucle | séparer avant de figer le contrat public |
| Repli insécable | `decideKeepTogether()` rend `fallBack` | observer la suite finale, sans diagnostic persistant dans le modèle |
| ICU | les valeurs sont écrites avant `buildPagedTree()` | transmettre les caractères produits ; le viewer ne reformate rien |
| Cycle de session | une session par rendu, `close()` dans un `finally` | même invariant pour une pagination sans impression |
| Adaptateur | Puppeteer sait déjà mesurer et imprimer | aucune seconde dépendance ni second navigateur |

### 1.2 Les six écarts réels

1. **Le pipeline public ne sait que rendre un PDF.** `createPdfRenderPort()` encapsule validation,
   liaison, mesure, pagination, composition et impression dans une seule fonction privée.
2. **Le résultat interne n'est pas publiable.** Il contient les nœuds matérialisés, les textes liés,
   les écritures résolues, des maps et des fonctions de mesure.
3. **L'identité est encore insuffisante.** `key: "o17"` relie une sonde à sa réponse, mais ne dit ni
   quelle déclaration ni quelle ascendance de répétition a produit l'occurrence.
4. **`path` remplit deux rôles incompatibles.** Les chaînes et indices du modèle et les rangs de
   boucle sont intercalés ; l'ADR 0010 exige pourtant que le chemin de diagnostic désigne une
   déclaration.
5. **Le repli `keepTogether` disparaît après placement.** Le résultat final permet de le constater,
   mais aucune projection publique ne le raconte.
6. **E4-9 n'a pas de couture publique.** Les caractères ICU du moteur existent dans l'HTML final,
   mais aucun contrat ne permet au viewer de les recevoir sans les recalculer.

### 1.3 Ce qui n'est pas un écart E5

- Le moteur connaît déjà la page de chaque fragment : aucune nouvelle politique de coupe n'est
  requise.
- Le nombre de pages et le report entrant existent déjà : aucune formule ni règle métier nouvelle
  n'est requise.
- L'HTML final est déjà assaini par construction, échappé et muni d'une CSP restrictive.
- Puppeteer sait déjà mesurer l'HTML sans l'imprimer.
- `RenderRequest` possède exactement les deux champs autorisés, `template` et `data`.

---

## 2. Périmètre fermé

### 2.1 Inclus dans E5

- un `PaginationPort` public et son `PaginationResult` ;
- les schémas Zod v4 de l'enveloppe de résultat et de ses branches de données ;
- une fonction `createPaginationPort(strategy, options)` ;
- l'extraction d'une étape commune « composer et vérifier les pages » ;
- une identité structurée de déclaration et d'ascendance d'itération ;
- un manifeste ordonné des occurrences peintes par page ;
- la distinction `flow`, `page-band`, `table-header` et `page-layer` ;
- l'état `whole | first | middle | last` des fragments ;
- les lignes de report achevées sur chaque page et le report brut entrant ;
- une notice fermée `keep-together-fallback` ;
- la propagation optionnelle de l'identité d'occurrence dans les détails d'erreur moteur lorsque
  l'erreur survient pendant une occurrence répétée ;
- l'HTML autonome final, opaque pour l'appelant et identique à la source de composition PDF ;
- les preuves que la voie pagination ne lance aucune impression et ferme toujours sa session ;
- la recette sans navigateur, puis avec le vrai adaptateur Puppeteer ;
- l'ADR d'exécution et la mise à jour des roadmaps après livraison.

### 2.2 Exclus, avec leur propriétaire

| Exclu d'E5 | Motif | Propriétaire |
| :--- | :--- | :--- |
| Composant React, zoom, navigation, plein écran | le moteur n'affiche rien | V1/V4 |
| `dangerouslySetInnerHTML` dans la page hôte | l'HTML autonome doit vivre dans un contexte isolé | V1 |
| Comparaison pixel aperçu/PDF | exige le viewer réel et le corpus | V3 + E7 |
| Garantie multi-machine | fontes, images et environnement restent ouverts | E6 |
| Golden PDF/HTML | E5 teste des invariants structurels, pas un corpus figé | E7 |
| Plafond de pages, timeout, pooling, concurrence | classe de risque opérationnelle distincte | E8 |
| Export HTML téléchargeable | l'artefact est un transport d'aperçu, pas une Strategy d'export | hors v1 |
| Nouveau format dans `RenderFormat` | `html` existe déjà dans le type historique, mais E5 ne l'active pas | aucun lot E5 |
| Nouvelle donnée ou convention réservée dans `RenderRequest.data` | interdit par le périmètre produit | jamais |
| Changement de l'AST, nouvelle version de template | aucune forme stockée ne change | aucun |
| Persistance ou endpoint HTTP | le service de rendu reste une brique séparée | service |
| Refonte générale du CSS partagé | l'aperçu reçoit l'HTML du moteur ; la dette playground reste indépendante | chantier CH4, réévalué |
| Nouvelle dépendance ou modification de `package.json` | toutes les primitives existent | interdit sans mandat |

### 2.3 Définition exacte de « ce que chaque page contient »

Le manifeste décrit les **occurrences de nœuds peintes**, dans l'ordre de peinture : arrière-plan,
bande haute, flux, bande basse, premier plan. Il inclut les tables et leurs lignes ; il ne copie ni
le texte lié, ni les sources d'image, ni les styles.

Un `LoopNode` ou un `ConditionNode` non marqué reste structurel : il ne peint pas de boîte propre.
Ses descendants portent néanmoins toute son ascendance d'itération. Un groupe marqué, qui possède
un wrapper transparent réel, peut apparaître comme occurrence. Un `TableRowGroupNode` n'ajoute pas
de boîte DOM ; son occurrence apparaît dans une notice de repli si nécessaire et dans l'ascendance
des lignes, pas sous la forme d'un faux élément peint.

Cette règle empêche le manifeste de prétendre qu'un nœud invisible occupe une boîte tout en rendant
les lignes répétées et les replis entièrement attribuables.

---

## 3. Décisions d'architecture

### D1 — E5 publie un résultat de pagination, pas le modèle matérialisé

`MaterialDocument`, `PaginatedDocument`, les fragments, les curseurs, les métriques, les écritures
résolues et `MarkerReserve` restent internes. Leur exposition figerait l'algorithme de E2 à E4 et
permettrait à un appelant de recomposer une page différemment du PDF.

Le contrat public est une projection en lecture seule : géométrie minimale, pages, placements,
reports, notices et HTML autonome. Aucun appelant ne reçoit un curseur qu'il pourrait modifier ni
une fonction qu'il pourrait rappeler.

### D2 — L'HTML d'aperçu est l'HTML final du moteur, pas un second renderer

La source publiée est celle produite après le dernier tour réussi de `settle()`. Le PDF passe cette
même chaîne à `session.print()`. Le port de pagination la retourne avant cette étape.

Conséquences :

- le viewer ne réévalue aucune expression ;
- il ne résout aucune écriture ;
- il n'appelle pas `Intl` ;
- il ne recalcule aucun style, aucune largeur de colonne ni aucun filet ;
- il ne choisit aucune coupure ;
- les caractères ICU sont produits une fois, côté moteur.

L'HTML reste **opaque** : sa structure, ses classes et l'ordre de ses attributs ne sont pas un
contrat d'intégration. L'appelant reçoit le manifeste pour comprendre les pages ; il n'analyse pas
le DOM avec des sélecteurs internes.

Cette sortie n'est pas un export HTML. Elle n'implémente pas `RenderPort`, ne renvoie pas
`RenderResult`, ne promet pas un document web interactif et n'autorise aucune ressource distante.

### D3 — Un port distinct s'arrête avant `print()`

Le contrat cible est :

```ts
export interface PaginationPort {
  paginate(request: RenderRequest): Promise<PaginationResult>;
}
```

`createPaginationPort()` accepte le même `PdfRenderStrategy` que le port PDF. Ce choix est
délibéré : la stratégie retenue représente l'environnement dans lequel le PDF serait mesuré et
imprimé. Introduire un `LayoutStrategy` générique ou un second adaptateur sans seconde
implémentation violerait la règle anti-sur-ingénierie.

La session ouverte possède donc une méthode `print()`, mais la voie pagination ne l'appelle jamais.
Le fake de session et l'adaptateur réel le prouvent. Si un second backend de mesure apparaît, ce
fait réel sera le signal pour extraire un port plus étroit.

### D4 — La composition devient l'étape commune des deux façades

`renderInSession()` est séparé en deux responsabilités :

```text
composeInSession()
  validation déjà faite
  -> matérialisation déjà faite
  -> réserve des marqueurs
  -> mesure naturelle
  -> éventuel élargissement des bandes
  -> pagination et stabilisation
  -> arbre HTML final + sérialisation

printComposed()
  HTML final -> session.print() -> octets PDF
```

Le résultat interne de `composeInSession()` porte au minimum le document lié final, le
`PaginatedDocument`, l'arbre HTML et sa sérialisation. `createPdfRenderPort()` imprime cette
composition ; `createPaginationPort()` la projette.

Aucune façade n'appelle l'autre. Elles appellent la même opération interne, ce qui évite une
dépendance circulaire et garde les erreurs d'impression strictement absentes du port de pagination.

### D5 — Une occurrence possède un chemin de déclaration et une ascendance d'itération séparés

La forme cible est structurelle :

```ts
export interface IterationAddress {
  readonly declarationPath: readonly (string | number)[];
  readonly index: number;
}

export interface OccurrenceAddress {
  readonly declarationPath: readonly (string | number)[];
  readonly iterations: readonly IterationAddress[];
}

export interface OccurrenceReference extends OccurrenceAddress {
  readonly nodeId: string;
  readonly nodeType: DocumentNodeType;
}
```

`declarationPath` est le chemin canonique dans le template stocké. `iterations` est ordonné de la
répétition la plus extérieure à la plus intérieure ; chaque entrée nomme la déclaration répétable
par son propre chemin et son rang zéro-based.

Exemple conceptuel : une ligne sous la deuxième itération d'une boucle externe et la quatrième
itération d'un groupe interne possède le chemin de sa déclaration de ligne, puis deux entrées
d'itération. Une autre ligne ayant le même `id` ailleurs dans le template possède un autre chemin.

Propriétés garanties :

- deux occurrences d'un même rendu n'ont pas la même adresse ;
- deux matérialisations du même template et des mêmes séquences ordonnées produisent les mêmes
  adresses ;
- aucune horloge, aucun aléa et aucune valeur métier n'entre dans l'adresse ;
- une insertion dans le template ou dans une séquence peut déplacer les rangs : l'adresse n'est
  pas un identifiant métier durable et ne doit pas être persistée.

`nodeId` reste un libellé utile, jamais la clé d'unicité. La clé interne `o17` reste réservée à la
mesure et n'apparaît pas dans le résultat public.

### D6 — Le chemin de diagnostic redevient un chemin de déclaration

Le contexte de matérialisation porte séparément :

- `declarationPath` ;
- `iterations` ;
- la région ;
- la portée de données.

Les détails d'erreur existants continuent d'écrire `path` avec le **chemin de déclaration** exigé
par ADR 0010. Quand une occurrence existe déjà, un nouveau détail optionnel `occurrence` peut porter
l'adresse complète. Il ne contient ni valeur liée, ni source d'image, ni texte HTML : il reste sûr
à journaliser.

Cette correction doit inclure un cas latent : `materializeCell()` utilise aujourd'hui le rang de
colonne comme segment `cells`, alors que les cellules déclarées peuvent être ordonnées autrement ou
omettre une colonne. Avant de publier une adresse, le chemin doit prendre l'index réel de la cellule
dans `row.cells`.

### D7 — Le manifeste est plat, ordonné et attribuable

Une page expose une liste plate de placements. Une arborescence publique recopierait le Composite
interne et obligerait chaque évolution de fragment à devenir une rupture de contrat. La liste plate
répond directement aux questions E5 : « sur quelle page ? », « dans quelle région ? », « entier ou
coupé ? ».

```ts
export type PaginationRegion =
  | 'background'
  | 'header'
  | 'root'
  | 'footer'
  | 'foreground';

export type PlacementRole = 'flow' | 'page-band' | 'table-header' | 'page-layer';

export interface PagePlacement {
  readonly occurrence: OccurrenceReference;
  readonly region: PaginationRegion;
  readonly role: PlacementRole;
  readonly fragment: 'whole' | 'first' | 'middle' | 'last';
}
```

L'ordre est celui de peinture, puis celui des descendants. Une ligne d'en-tête répétée est présente
sur chaque page où elle est peinte avec `role: 'table-header'`. Une ligne du corps garde `flow`. Une
bande et ses descendants gardent `page-band`; un calque et ses descendants gardent `page-layer`.

Les cellules ne deviennent pas des occurrences publiques : elles n'ont ni `id` ni statut de
`DocumentNode`. Leurs enfants apparaissent normalement dans la liste.

### D8 — Les reports sont observés depuis les fragments finaux

Chaque page publique porte :

```ts
export interface PageReportResult {
  readonly incoming: number;
  readonly completedBy: readonly OccurrenceReference[];
}
```

`incoming` est le cumul brut, non arrondi, réellement donné aux marqueurs de cette page.
`completedBy` liste les occurrences de lignes contributrices qui se terminent sur cette page, dans
l'ordre de contribution. Une ligne fragmentée n'apparaît que sur la page portant son fragment
`last`; une ligne entière apparaît sur sa page unique.

`withIncomingReports()` devient la source unique des deux informations. Le manifeste ne reparcourt
pas l'HTML et ne recalcule pas les nombres. Les valeurs de contribution individuelles ne sont pas
publiées : l'identité des lignes suffit pour expliquer la frontière et évite une copie inutile de
données métier.

### D9 — Le repli `keepTogether` est une notice du succès final

La forme initiale est une union fermée à un membre :

```ts
export interface KeepTogetherFallbackNotice {
  readonly code: 'keep-together-fallback';
  readonly occurrence: OccurrenceReference;
  readonly pages: readonly number[];
}

export type PaginationNotice = KeepTogetherFallbackNotice;
```

La notice signifie exactement : cette occurrence portait `keepTogether: true`, aucune page neuve
admissible ne pouvait la contenir entière, et sa politique ordinaire l'a répartie sur les pages
indiquées. Elle n'est ni une erreur ni un avertissement stocké dans le template.

Les notices sont **dérivées de la suite finale** ou collectées dans un traceur local à chaque appel
de `paginate()` puis abandonnées avec le tour de stabilisation refusé. Elles ne sont jamais
accumulées dans un objet partagé à travers `settle()`, faute de quoi un repli d'un essai transitoire
survivrait à une suite finale qui ne le fait plus.

L'ordre des notices est l'ordre de première apparition sur les pages. Une occurrence ne produit
qu'une notice, même si elle possède trois fragments. Les groupes de lignes marqués, qui n'ont pas de
boîte propre, sont détectés par leur frontière interne et reçoivent leur adresse de groupe.

### D10 — Le résultat public reste une enveloppe de port, sans version de template

La cible complète est :

```ts
export interface PaginationPageResult {
  readonly number: number;
  readonly placements: readonly PagePlacement[];
  readonly report: PageReportResult;
}

export interface PaginationResult {
  readonly sheet: Sheet;
  readonly html: string;
  readonly pages: readonly PaginationPageResult[];
  readonly notices: readonly PaginationNotice[];
}
```

Ces types vivent avec les ports publics de `@openview/core`, afin que le futur paquet navigateur
puisse les importer sans dépendre d'`engine`. `PaginationPort` est l'interface fonctionnelle ; le
contenu qu'elle transporte reste un contrat de données et reçoit donc ses schémas Zod v4, selon la
règle Zod-first. Le moteur construit ce résultat depuis des valeurs déjà validées et ne reparcourt
pas sa propre sortie avec `safeParse`; le futur consommateur externe emploiera le schéma à sa
frontière de désérialisation.

Aucun schéma de **document stocké** ne change. La compatibilité de l'enveloppe de port suit les
versions de paquet jusqu'à l'existence d'un transport réseau officiel ; ce transport recevra alors
son propre discriminant de protocole plutôt qu'un faux `schemaVersion` de template.

Il n'y a donc :

- ni `schemaVersion` de template ;
- ni migration ;
- ni nouveau champ de l'AST ;
- ni parsing dans une boucle de rendu.

Le futur service qui sérialisera cette enveloppe devra versionner et valider **son** transport à sa
frontière. E5 n'anticipe pas un protocole réseau inexistant.

### D11 — L'HTML autonome conserve les barrières de sécurité existantes

`serializeHtml()` demeure le seul sérialiseur. Le vocabulaire de tags et d'attributs reste fermé,
les caractères et attributs restent échappés, les images restent des URI admises par l'adaptateur,
et la CSP conserve `default-src 'none'`, `script-src 'none'` et `connect-src 'none'`.

Le contrat documente que `html` est destiné à un contexte de document isolé. V1 devra l'afficher
avec `iframe srcDoc` et `sandbox` sans scripts, pas l'injecter dans le DOM de l'application hôte.
E5 ne peut pas imposer le sandbox depuis une chaîne, mais il livre une source qui fonctionne sous
cette contrainte et un test hostile qui le prouve.

Le résultat contient des données rendues et doit être traité comme le PDF : aucun log, aucune
notice et aucune erreur ne recopient `html`.

### D12 — E4-9 est fermé côté moteur, pas déclaré livré côté viewer

La composition E4 écrit les nombres, monnaies et dates avant la sérialisation. `PaginationResult`
transporte ces caractères tels quels. Aucune locale ni clé d'écriture n'est fournie au viewer, car
il n'a rien à résoudre.

E5 ferme donc la moitié moteur de E4-9 : il existe une voie publique sans second ICU. La roadmap et
l'ADR d'exécution conservent la moitié viewer ouverte jusqu'à ce que V1 affiche cette source sans
reformatage et que V3 compare effectivement l'aperçu au PDF.

### D13 — Aucune nouvelle abstraction de Strategy

Un `HtmlRenderStrategy`, un `PreviewAdapter`, un `PaginationBackend` ou une factory générique de
formats sont rejetés. Il existe un backend réel, Puppeteer, et une seule composition HTML. Le port
de pagination réemploie le contrat de session actuel et la Strategy PDF reste la seule Strategy
d'export.

Signal de réouverture : un second adaptateur de mesure réel, planifié et testé, dont la session ne
sait pas imprimer. Avant ce fait, une interface supplémentaire ne ferait que déplacer cinq
méthodes.

---

## 4. Flux cible

### 4.1 Voie pagination

```text
RenderRequest
  -> validateTemplate
  -> materializeDocument(one-page domains)
  -> strategy.open
  -> reserveMarkers
  -> measureNaturally
  -> pageCountOf
  -> extendBands si multi-page
  -> nouvelle réserve + nouvelle mesure
  -> settle jusqu'à suite vérifiée
  -> buildPagedTree + serializeHtml
  -> buildPaginationResult
  -> session.close dans finally
  -> PaginationResult
```

`print()` n'est pas dans cette chaîne.

### 4.2 Voie PDF après factorisation

```text
RenderRequest
  -> même préparation
  -> même composeInSession
  -> session.print(composed source)
  -> session.close dans finally
  -> RenderResult PDF inchangé
```

### 4.3 Construction de l'adresse

La matérialisation transporte un contexte immuable :

```text
declarationPath = position du nœud dans le template
iterations      = ascendance ordonnée des répétitions actives
```

- entrer dans `children[i]` étend seulement `declarationPath` ;
- entrer dans l'itération `i` d'un `loop` ajoute `{ pathDuLoop, index: i }` ;
- entrer dans l'itération `i` d'un `tableRowGroup` fait de même ;
- une condition vraie n'ajoute pas de rang, mais conserve l'ascendance extérieure ;
- une bande, un calque, une section de table et une cellule étendent le chemin de déclaration avec
  leur position réelle dans le tableau stocké.

### 4.4 Projection des fragments

Un visiteur interne parcourt chaque page composée :

```text
page
  background layers
  header blocks
  root fragments
  footer blocks
  foreground layers
```

Il produit un `PagePlacement` pour chaque source de nœud peinte, puis descend :

- texte, image, grille : occurrence terminale ;
- conteneur : occurrence puis enfants ;
- table : occurrence, en-têtes répétés, lignes de la page, puis contenu des cellules ;
- ligne : occurrence puis contenu des cellules.

Le parcours doit être exhaustif sur l'union des fragments. C'est un nouveau parcours du Composite
matérialisé ; il ne justifie pas à lui seul une refonte générale, mais il doit déclencher une
vérification du seuil du chantier CH1 avant implémentation.

---

## 5. Organisation cible des fichiers

### 5.1 `@openview/core`

| Fichier | Modification attendue |
| :--- | :--- |
| `packages/core/src/ports/pagination/types.ts` | types purs du port, du résultat, des adresses, placements, reports et notices |
| `packages/core/src/ports/pagination/schemas.ts` | schémas Zod v4 des seules branches de données, liés explicitement aux types |
| `packages/core/src/ports/pagination/pagination.ts` | façade locale du sous-système |
| `packages/core/src/index.ts` | exports publics strictement nécessaires |
| `packages/core/src/ports/render.ts` | inchangé, sauf réemploi d'import de `RenderRequest` si utile |

Aucun fichier sous `ast/`, `template/`, `expression/` ou `presentation/` ne change. Aucun schéma
Zod stocké et aucune migration ne sont requis.

### 5.2 `@openview/engine`

| Fichier | Modification attendue |
| :--- | :--- |
| `packages/engine/src/pipeline/compose.ts` | extraction de la préparation et stabilisation communes |
| `packages/engine/src/pipeline/render-pdf.ts` | délégation à `compose`, impression seule après composition |
| `packages/engine/src/pipeline/paginate.ts` | factory `createPaginationPort`, projection et cycle de session |
| `packages/engine/src/pagination/result.ts` | visiteur de pages/fragments vers le manifeste public |
| `packages/engine/src/pagination/notices.ts` | détection finale et déduplication des replis |
| `packages/engine/src/pagination/reports.ts` | retourner les contributions achevées avec le cumul entrant |
| `packages/engine/src/pagination/types.ts` | résultat interne enrichi, sans exporter les détails |
| `packages/engine/src/document/types.ts` | `nodeType`, `declarationPath`, `iterations`; clé de mesure inchangée |
| `packages/engine/src/document/materialize.ts` | construction des adresses et correction du chemin des cellules |
| `packages/engine/src/errors.ts` | détail optionnel d'occurrence, toujours sûr à journaliser |
| `packages/engine/src/html/build-page.ts` | aucune surface publique ; seulement retourner l'arbre commun si l'extraction l'exige |
| `packages/engine/src/index.ts` | exporter la factory et les types de stratégie déjà nécessaires |

Les noms de fichiers peuvent être ajustés si l'extraction réelle montre une couture plus petite.
Les responsabilités, elles, ne doivent pas se recombiner dans `render-pdf.ts`.

### 5.3 Adaptateur Puppeteer

| Fichier | Modification attendue |
| :--- | :--- |
| `packages/adapter-puppeteer/src/__tests__/reference-document.test.ts` | recette réelle pagination sans impression et équivalence structurelle avec le PDF |
| `packages/adapter-puppeteer/src/session.ts` | normalement inchangé |
| `packages/adapter-puppeteer/src/puppeteer-pdf-strategy.ts` | inchangé |

Aucune nouvelle factory d'adaptateur n'est prévue. Si l'implémentation exige une modification de
production ici, elle doit être justifiée par une sonde, pas par symétrie.

### 5.4 Documentation après exécution

| Fichier | Résultat attendu |
| :--- | :--- |
| `docs/adr/0018-le-moteur-sait-dire-ou-il-coupe.md` | décisions exécutées, sondes, écarts au plan et conséquences |
| `docs/roadmap/engine.md` | E5 livré, surface exacte et recette mesurée |
| `docs/roadmap/viewer.md` | V1 reçoit l'HTML autonome et le manifeste ; aucune repagination |
| `docs/plans/refactoring-huit-chantiers.md` | CH4 n'est plus un préalable au viewer si celui-ci affiche l'HTML moteur ; dette playground conservée |
| `README.md` / roadmap globale | J4 reste ouvert tant que V3 n'a pas comparé aperçu et PDF |

---

## 6. Sondes bloquantes avant production

### P1 — Une adresse distingue les doublons sous deux boucles imbriquées

Construire un template avec deux sous-arbres partageant le même `id`, une boucle dans une boucle et
un `tableRowGroup` interne. Matérialiser deux fois le même jeu de données.

Doit prouver :

- unicité de toutes les adresses du rendu ;
- égalité profonde entre les deux matérialisations ;
- présence des deux rangs d'ascendance ;
- chemins de déclaration différents malgré les `id` identiques ;
- aucune clé `oN` dans la projection publique.

### P2 — Le chemin d'une cellule suit la cellule stockée, pas la colonne

Déclarer trois colonnes, omettre la cellule centrale et ordonner les deux cellules restantes à
l'inverse des colonnes. Une erreur de binding dans la dernière cellule doit pointer l'index réel de
`row.cells` et son occurrence doit rester attribuable.

Cette sonde est bloquante : publier le chemin actuel rendrait une erreur de conception interne
irréversible dans l'identité E5.

### P3 — La source de pagination est la source que le PDF imprimerait

Sur le fake de session, capturer l'HTML final de la voie PDF et celui de la voie pagination pour la
même demande et les mêmes mesures. Ils doivent être strictement égaux. Modifier volontairement
`buildPagedTree()` doit faire échouer les deux preuves, pas une seule.

### P4 — La voie pagination n'imprime jamais

Le fake ouvre une session, répond à toutes les mesures et fait échouer `print()` si cette méthode
est appelée. `paginate()` doit réussir, `printed` rester vide et `closed` valoir exactement un.

Rejouer les variantes : succès, erreur de mesure, pagination impossible, résultat final incohérent
et échec de fermeture. Toute promesse asynchrone est attendue.

### P5 — Un tour de stabilisation abandonné ne laisse aucune notice

Forcer un premier tour avec débordement qui fragmente une occurrence marquée, puis un second tour
dont la coupure finale ne produit pas ce même repli. Le résultat ne contient que les notices de la
suite acceptée.

Si la géométrie rend ce scénario impossible, la sonde doit démontrer la dérivation depuis les
fragments finaux et interdire tout accumulateur partagé à travers les tours.

### P6 — L'HTML hostile reste inerte dans un contexte d'aperçu

Lier du texte contenant balises, attributs, fermeture de `style`, script et URL locale. Charger
l'HTML retourné dans Chromium avec la politique d'isolement prévue pour V1.

Doit prouver :

- le texte reste du texte ;
- aucun script ne s'exécute ;
- aucune requête n'atteint un serveur local joignable ;
- la CSP est présente ;
- aucune clé, notice ou erreur ne recopie l'HTML.

### P7 — L'ICU n'est pas réexécuté par le consommateur

Sur les deux profils E4, vérifier que l'HTML de pagination contient les mêmes caractères monétaires,
séparateurs et espaces que l'HTML donné à l'impression. Le contrat public ne transporte ni locale,
ni `Presentation`, ni valeur brute à reformater.

Ce test reste structurel entre versions ICU : il ne fige pas une chaîne monétaire produite par un
autre build.

### P8 — Le manifeste répond à la facture de recette

Avec la vraie facture de soixante lignes :

- quatre pages ;
- chaque ligne de détail sur la page où son `<tr>` est peint ;
- en-tête de table présent sur chaque fragment avec le rôle exact ;
- reports entrants et lignes achevées cohérents ;
- bandes `firstOnly`, `exceptFirst`, `exceptLast`, `lastOnly` sur les bonnes pages ;
- calques sur toutes les pages sans modifier une seule coupure ;
- même résultat en français/euros et anglais/dollars depuis le même template.

---

## 7. Matrice de tests

### 7.1 Contrat et surface publique

| Contrat | Cas obligatoires |
| :--- | :--- |
| Port | `paginate(RenderRequest)` rend un `PaginationResult` |
| Immutabilité | tableaux et champs `readonly`, optionnels écrits avec `| undefined` s'il y en a |
| Adresse | chemin vide interdit par construction du moteur, rangs entiers positifs ou nuls |
| Types | régions, rôles, fragments et codes fermés |
| Schémas | Zod v4, objets fermés selon la convention du dépôt, formes type/schéma mutuellement assignables |
| Résultat | succès complet accepté ; rang, région, rôle, fragment ou notice invalide refusé au chemin exact |
| Surface | aucun type matérialisé, curseur, métrique, writing ou clé de sonde exporté |
| Architecture | viewer peut importer le contrat depuis core sans importer engine |
| Versionnement | aucune version de template ni migration ajoutée |

L'interface fonctionnelle du port reste vérifiée par TypeScript. Le schéma valide son résultat de
données ; il ne prétend pas rendre un HTML arbitraire sûr. L'isolation et la CSP de D11 restent les
barrières de sécurité. Aucun parsing n'est exécuté dans une boucle de pagination.

### 7.2 Matérialisation et identité

| Cas | Attendu |
| :--- | :--- |
| Nœud statique | chemin de déclaration, ascendance vide |
| Boucle simple | même chemin, rang distinct par item |
| Boucles imbriquées | ascendance complète extérieur → intérieur |
| Condition dans boucle | rang extérieur conservé, aucun rang inventé pour la condition |
| Loop marqué | wrapper référencé comme `loop`, une occurrence par item |
| Groupe de lignes | adresse du groupe + adresse de chaque ligne |
| `id` dupliqués | adresses distinctes |
| Boucle vide / condition fausse | aucune occurrence fantôme |
| Bandes liées tardivement | adresses stables, session de présentation réemployée |
| Cellules omises/réordonnées | chemin AST réel |
| Deux rendus identiques | égalité profonde des références |
| Données différentes | aucun engagement de stabilité des rangs déplacés |

### 7.3 Projection des pages

| Kind / région | Cas obligatoires |
| :--- | :--- |
| Texte | whole, first, middle, last ; ordre des descendants |
| Image / grille | whole seulement sur succès |
| Conteneur | occurrence puis enfants ; groupe transparent marqué |
| Table | table, header répété, body, footer, contenu de cellules |
| Ligne fragmentée | fragments sur plusieurs pages, même occurrence |
| Bande | chaque domaine de page et rôle `page-band` |
| Calque | arrière puis avant, toutes les pages, rôle `page-layer` |
| Flux vide | une page, liste de flux vide mais bandes/calques présents |
| Page | rang 1..N sans trou et `pages.length` égal à la suite interne |

### 7.4 Reports

| Cas | Attendu |
| :--- | :--- |
| Première page | `incoming: 0` |
| Ligne entière contributrice | présente dans `completedBy` de sa page |
| Ligne fragmentée | présente une fois, sur la page du fragment final |
| Plusieurs contributions | ordre de matérialisation conservé |
| Sommes sensibles à l'ordre | même cumul que le marqueur composé |
| Tour de settle repris | reports recalculés depuis la nouvelle suite |
| Aucun `pageReport` | listes vides, cumul zéro |

### 7.5 `keepTogether`

| Politique | Notice attendue |
| :--- | :--- |
| tient dans le reste | aucune |
| différé puis entier | aucune |
| texte trop grand fragmenté | une notice, pages exactes |
| conteneur parent replié | notice parent ; descendant honoré sans notice |
| descendant lui-même trop grand | notices parent et descendant, ordre stable |
| groupe de lignes trop grand | une notice de groupe, pas une par ligne |
| ligne marquée trop grande | une notice de ligne |
| image/grille atomique trop grande | refus existant, aucun résultat partiel |
| marque dans une bande | politique de bande inchangée, aucune fausse notice |
| settle avec reprise | notices du dernier tour seulement |

### 7.6 Pipeline et erreurs

| Chemin | Preuve |
| :--- | :--- |
| validation refusée | aucune session ouverte |
| open échoue | erreur de layout, pas `pdf-export-failed` mensonger |
| mesure échoue | code existant, cause conservée |
| pagination échoue | aucun résultat partiel, fermeture attendue |
| composition réussit | HTML et manifeste retournés |
| impression PDF échoue | port PDF seul rend `pdf-export-failed` |
| fermeture | attendue sur tous les chemins après ouverture |
| détails | occurrence présente si connue, aucune donnée liée |

Le reclassement d'un échec inconnu de `strategy.open()` doit être sondé avant modification : ouvrir
une session est commun au layout et au PDF, donc `layout-measurement-failed` est plus exact, mais un
contrat E1 existant peut devoir être conservé. L'ADR d'exécution consignera le choix mesuré.

### 7.7 Adaptateur Chromium

- la voie pagination mesure la facture réelle sans produire de PDF ;
- les quatre pages annoncées correspondent aux quatre boîtes `.ov-page` ;
- le PDF produit séparément possède quatre feuilles ;
- les lignes et reports du manifeste correspondent à l'HTML final ;
- les deux diagonales E4 passent ;
- le document hostile reste inerte et hors ligne ;
- les calques ne déplacent aucune ligne ;
- la session et le navigateur ferment sur succès et refus.

### 7.8 Ablations obligatoires

| Mutation volontaire | Test qui doit rougir |
| :--- | :--- |
| retourner le premier tour de `settle()` | débordement final / suite vérifiée |
| appeler `print()` depuis `paginate()` | log `printed` vide |
| rebâtir l'HTML dans `result.ts` | égalité avec la source PDF |
| exposer `MaterialBase.key` | surface et absence de `oN` |
| supprimer un rang d'itération externe | boucles imbriquées |
| utiliser `nodeId` comme clé | ids dupliqués |
| mêler le rang dans `declarationPath` | séparation chemin/ascendance |
| utiliser l'index de colonne pour `cells` | cellule réordonnée |
| accumuler les notices à travers `settle()` | notice transitoire |
| compter une ligne au premier fragment | contribution fragmentée |
| omettre les en-têtes de table du manifeste | répétition sur quatre pages |
| reformater un report dans la projection | égalité du cumul/HTML |
| retirer la CSP ou l'échappement | fixture hostile |
| ajouter `RenderResult.format = 'html'` | test de surface / hors périmètre |

---

## 8. Incréments d'exécution

### INC-0 — Baseline et huit sondes

1. lancer les quatre portes dans l'ordre prescrit ;
2. écrire P1 à P8 comme tests rouges ou sondes jetables reproductibles ;
3. confirmer le comportement d'erreur de `open()` et le nombre de mesures de la facture ;
4. confirmer qu'aucun travail concurrent ne touche les fichiers visés ;
5. figer l'interface publique proposée avant toute extraction du pipeline.

**Sortie :** aucune décision publique encore écrite, risques techniques mesurés.

### INC-1 — Contrat public et adresses internes

1. ajouter les types et l'interface du port sous `core/src/ports/pagination/` ;
2. écrire et tester les schémas Zod v4 du résultat ;
3. exporter la surface minimale ;
4. séparer chemin de déclaration et ascendance dans la matérialisation ;
5. porter `nodeType` sur les sources internes ;
6. corriger le chemin des cellules ;
7. ajouter l'occurrence optionnelle aux détails moteur si la sonde confirme la couture.

**Sortie :** toute occurrence matérialisée possède une adresse complète, aucune page n'est encore
publique.

### INC-2 — Factorisation de la composition

1. extraire `composeInSession()` sans changement de comportement ;
2. faire repasser tous les tests PDF existants ;
3. conserver strictement le nombre et l'ordre des mesures ;
4. isoler l'emballage des erreurs de mesure et d'impression ;
5. tuer l'ablation qui ferait diverger la source composée.

**Sortie :** le PDF est une fine étape d'impression au-dessus d'une composition testable.

### INC-3 — Projection des pages, reports et notices

1. écrire le visiteur de fragments ;
2. enrichir le collecteur de reports ;
3. dériver les replis depuis la suite finale ;
4. ordonner et dédupliquer les placements/notices ;
5. vérifier tous les kinds, bandes, calques et tables imbriquées.

**Sortie :** un `PaginationResult` pur peut être construit depuis la composition interne.

### INC-4 — Port de pagination et cycle de session

1. ajouter `createPaginationPort()` ;
2. réemployer validation, options, sélection de présentation et limites ;
3. ouvrir une session, composer, projeter, fermer ;
4. prouver zéro impression ;
5. couvrir tous les chemins d'erreur et de fermeture.

**Sortie :** critère de roadmap atteignable sans navigateur réel.

### INC-5 — Recette Puppeteer et E4-9

1. paginer la facture de référence réelle dans les deux diagonales E4 ;
2. comparer le manifeste à l'HTML final ;
3. comparer la source d'aperçu à la source donnée au PDF ;
4. jouer les bandes, reports, blocs insécables, calques et grille ;
5. jouer la fixture hostile dans le contexte isolé prévu.

**Sortie :** quatre pages expliquées, aucun PDF produit par le port E5, caractères ICU transmis.

### INC-6 — Ablations, ADR et fermeture

1. jouer toutes les mutations du §7.8 ;
2. lancer les quatre portes ;
3. écrire ADR 0018 avec résultats mesurés et écarts ;
4. marquer E5 livré seulement si toute la définition de terminé est satisfaite ;
5. mettre à jour la dette E4-9 sans annoncer J4 ;
6. reclasser CH4 comme dette playground si l'HTML moteur est confirmé comme entrée du viewer.

---

## 9. Risques, signaux et réponses prévues

| Risque | Signal précoce | Réponse |
| :--- | :--- | :--- |
| L'HTML public fige les classes internes | un consommateur veut les sélectionner | déclarer la chaîne opaque ; fournir le manifeste, pas des sélecteurs |
| Une adresse change à données identiques | P1 diffère entre deux matérialisations | retirer toute dépendance au compteur de mesure et à l'ordre des maps |
| Le chemin AST actuel est faux dans une cellule | P2 | corriger avant publication, jamais après |
| Un repli transitoire fuit | P5 | dérivation finale ou traceur par appel de `paginate()` |
| Le manifeste double fortement le payload | facture de référence anormalement volumineuse | mesurer ; garder liste plate et références minimales, aucune donnée liée |
| Le visiteur du Composite matérialisé devient un troisième parcours | audit CH1 | introduire le Visitor interne prévu par la règle, pas un switch de plus |
| `open()` conserve un code PDF sur la voie pagination | test d'erreur trompeur | séparer l'ouverture/layout de l'impression avec compatibilité documentée |
| Le viewer injecte l'HTML dans son DOM | première maquette V1 | contrat `srcDoc` sandboxé et test d'intégration V1 bloquant |
| Une CSP `meta` diffère selon navigateur | P6 | sandbox obligatoire ; documenter les navigateurs supportés à V1 |
| Les fontes déplacent les coupures entre machines | même entrée, résultats différents | dette E6 inchangée ; E5 ne sur-promet pas |
| Le PDF et la pagination sont appelés dans deux environnements différents | divergence V3 | même stratégie/configuration requise ; E6 épingle l'environnement, V3 compare |
| Un appelant persiste l'adresse comme id métier | usage externe observé | JSDoc explicite et absence de champ `id` opaque présenté comme durable |
| Le rapport brut est journalisé | instrumentation du host | documenter le résultat comme sensible au même titre que le PDF |

### Signaux de réouverture ultérieure

- besoin réel de sélectionner un nœud dans l'aperçu : ajouter alors une corrélation DOM publique,
  sans exposer les clés de mesure ;
- second backend de mesure réel : extraire un `LayoutStrategy` ;
- transport HTTP officiel : versionner et valider l'enveloppe sérialisée ;
- besoin de persister des annotations entre jeux de données : concevoir un identifiant métier
  distinct des rangs d'occurrence ;
- manifeste trop volumineux sur des documents réels : ajouter une représentation compacte mesurée,
  jamais supprimer l'attribution des lignes ;
- aperçu devant fonctionner sans backend : décision produit nouvelle, car elle réintroduit un
  second moteur de composition.

---

## 10. Définition de terminé

- [ ] `createPaginationPort()` est exporté et n'ajoute aucun champ à `RenderRequest` ;
- [ ] les données de `PaginationResult` possèdent des schémas Zod v4 et leurs tests de forme ;
- [ ] une facture peut être paginée sans appeler `print()` ;
- [ ] la session est fermée et chaque promesse asynchrone est attendue sur tous les chemins ;
- [ ] l'HTML retourné est celui de la composition finale vérifiée ;
- [ ] le port PDF imprime la même composition et conserve son `RenderResult` ;
- [ ] quatre pages sont annoncées pour la facture de soixante lignes dans les deux diagonales E4 ;
- [ ] chaque ligne de table est attribuée à sa ou ses pages avec le bon `FragmentEdge` ;
- [ ] les en-têtes répétés, bandes et calques sont distingués ;
- [ ] le report entrant et les lignes contributrices achevées proviennent du collecteur E3 ;
- [ ] une ligne fragmentée ne contribue qu'à sa page de fin ;
- [ ] les replis `keepTogether` finaux sont observables et dédupliqués ;
- [ ] aucune notice transitoire d'un tour de stabilisation abandonné ne survit ;
- [ ] deux boucles imbriquées et des `id` dupliqués produisent des adresses uniques ;
- [ ] deux rendus identiques produisent les mêmes adresses ;
- [ ] `declarationPath` et `iterations` sont séparés ;
- [ ] le chemin des cellules réordonnées est exact ;
- [ ] aucune clé interne `oN`, métrique, curseur, écriture ou donnée liée n'est exposée ;
- [ ] les détails d'erreur restent sûrs à journaliser ;
- [ ] l'HTML hostile reste échappé, inerte et hors ligne ;
- [ ] le résultat ne constitue pas un export HTML et ne modifie pas `RenderFormat` ;
- [ ] aucun schéma de template, aucune migration, aucune dépendance et aucun manifeste npm ne
  changent ;
- [ ] les ablations obligatoires sont tuées ;
- [ ] `pnpm run lint`, `pnpm run build`, `pnpm run type-check` et
  `pnpm run test:coverage` passent dans cet ordre ;
- [ ] ADR 0018 consigne les mesures, corrections au plan et limites ;
- [ ] la roadmap marque E5 livré sans marquer J4 atteint ;
- [ ] E4-9 est déclaré fermé côté moteur et toujours ouvert côté viewer jusqu'à V1/V3.

---

## 11. Contrôle avant démarrage

Avant la première modification de production, relever et joindre à INC-0 :

1. le `git status --short` et les fichiers concurrents éventuels ;
2. les quatre portes de la baseline E4 ;
3. les exports publics actuels de `core` et `engine` ;
4. les attentes existantes sur `pdf-export-failed` lors d'un échec d'ouverture ;
5. le nombre et l'ordre des appels `measure()` / `print()` de la facture de référence ;
6. la forme exacte des chemins de boucle, groupe, cellule, bande et calque ;
7. les parcours actuels de `MaterialBlock` et `MaterialFragment`, pour appliquer le seuil Visitor ;
8. la taille de l'HTML final et du manifeste projeté sur 1, 60 et plusieurs centaines de lignes ;
9. le comportement de la CSP dans le contexte `iframe srcDoc` sandboxé visé par V1 ;
10. les versions Node/ICU des jobs CI, sans modifier le workflow.

E5 peut démarrer quand ces dix relevés sont reproductibles, que P1 et P2 valident la forme de
l'identité, et que P3 confirme que la composition commune peut être extraite sans modifier un seul
octet de la source PDF existante.
