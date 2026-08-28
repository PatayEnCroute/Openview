# ADR 0018 — Le moteur sait dire où il coupe

- **Statut :** 🟢 **Accepté** (2026-08-28), implémenté dans `@openview/core`, `@openview/engine`,
  avec la recette réelle dans `@openview/adapter-puppeteer`
- **Date :** 2026-08-28
- **Impact :** `@openview/core` (un `PaginationPort`, son enveloppe de résultat et ses schémas
  Zod v4, sous `ports/pagination/`), `@openview/engine` (une étape de composition commune aux deux
  façades, une adresse d'occurrence structurée, un visiteur de fragments, une projection publique,
  la factory `createPaginationPort`), `@openview/adapter-puppeteer` (deux recettes réelles, sans
  une ligne de production modifiée). `@openview/designer`, `@openview/viewer` et `apps/playground`
  sortent du lot **inchangés**.
- **`RenderRequest` reste `{ template, data }`.** Le port de pagination lit la même requête que le
  port PDF ; il n'ajoute aucun champ, ne réserve aucune clé du jeu de données et ne prend aucune
  option nouvelle — `RenderEngineOptions` est réemployé tel quel.
- **Aucune version de template, aucune migration.** Rien de la forme *stockée* ne change :
  l'enveloppe publiée est un contrat de **port**, pas un document, et suit les versions de paquet.
- **Aucun format d'export nouveau.** `RenderFormat` ne bouge pas, `'html'` n'est pas activé, et le
  résultat n'implémente pas `RenderPort`. Ce n'est pas un export HTML.
- **N'amende aucune règle de gouvernance.** `AGENTS.md`, `tsconfig*.json`, `biome.jsonc`, les
  plugins GritQL, les workflows et les seuils de couverture sortent du lot **inchangés**.
  **Aucune dépendance n'est ajoutée.**
- **J4 n'est pas atteint.** E5 est une *condition* de J4 : le moteur sait dire où il coupe, mais
  aucun viewer n'affiche encore cette source et aucune comparaison aperçu/PDF n'a eu lieu.
- **Plan d'implémentation :**
  [docs/plans/e5-le-moteur-sait-dire-ou-il-coupe.md](../plans/e5-le-moteur-sait-dire-ou-il-coupe.md)
  — les écarts sont au [§ Ce que l'exécution a corrigé du plan](#ce-que-lexécution-a-corrigé-du-plan).
- **Implémentation :**
  [`core/src/ports/pagination/types.ts`](../../packages/core/src/ports/pagination/types.ts) et
  [`schemas.ts`](../../packages/core/src/ports/pagination/schemas.ts) (contrat et schémas),
  [`engine/src/pipeline/compose.ts`](../../packages/engine/src/pipeline/compose.ts) (l'étape
  commune), [`engine/src/pipeline/paginate.ts`](../../packages/engine/src/pipeline/paginate.ts)
  (la factory), [`engine/src/pagination/result.ts`](../../packages/engine/src/pagination/result.ts)
  (la projection), [`notices.ts`](../../packages/engine/src/pagination/notices.ts) (les replis),
  [`visit.ts`](../../packages/engine/src/pagination/visit.ts) (le visiteur de fragments),
  [`engine/src/document/materialize.ts`](../../packages/engine/src/document/materialize.ts)
  (chemin de déclaration et ascendance séparés, chemin de cellule corrigé),
  [`engine/src/document/occurrence.ts`](../../packages/engine/src/document/occurrence.ts)
  (la projection d'une adresse)

---

## Contexte

E1 à E4 avaient livré un moteur qui **choisit** ses coupures, matérialise des fragments fermés,
recalcule les reports sur la suite finale, stabilise cette suite contre une mesure Chromium et
imprime exactement l'HTML vérifié. Rien de tout cela n'était observable de l'extérieur : le seul
chemin public produisait des octets PDF.

La promesse retenue pour le viewer est un **aperçu identique au PDF, garanti**. Elle n'est tenable
que si le viewer n'a rien à redécider. Un aperçu qui repaginerait, reformaterait ou choisirait ses
propres coupures serait un second moteur, et deux moteurs divergent — c'est la garantie elle-même
qui tombe.

E5 ne devait donc écrire **aucun second paginateur**. Il devait rendre publique une projection sûre
du résultat interne, et fournir une voie qui s'arrête avant `print()`.

## Décisions

### 1. Un résultat de pagination, jamais le modèle matérialisé

`MaterialDocument`, `PaginatedDocument`, les fragments, les curseurs, les métriques, les écritures
résolues et `MarkerReserve` restent internes. Les exposer figerait l'algorithme de E2 à E4 et
permettrait à un appelant de recomposer une page différemment du PDF.

Le contrat public est une projection en lecture seule : la feuille, l'HTML autonome, les pages,
leurs placements, leur frontière de report et les notices. Aucun appelant ne reçoit un curseur
qu'il pourrait modifier, ni une fonction qu'il pourrait rappeler.

### 2. L'HTML d'aperçu est l'HTML final du moteur

La source publiée est celle produite après le dernier tour réussi de la stabilisation. Le PDF passe
cette même chaîne à `session.print()`. Le port de pagination la retourne avant cette étape, **octet
pour octet** — c'est vérifié sur le fake et sur Chromium.

Conséquence : le consommateur ne réévalue aucune expression, ne résout aucune écriture, n'appelle
pas `Intl`, ne recalcule ni style ni largeur de colonne, et ne choisit aucune coupure.

L'HTML reste **opaque** : sa structure, ses classes et l'ordre de ses attributs ne sont pas un
contrat d'intégration. C'est le manifeste qui explique les pages, pas un sélecteur CSS.

### 3. Un port distinct, qui n'appelle jamais `print()`

```ts
export interface PaginationPort {
  paginate(request: RenderRequest): Promise<PaginationResult>;
}
```

`createPaginationPort()` accepte le même `PdfRenderStrategy` que le port PDF, délibérément : la
stratégie retenue **est** l'environnement dans lequel le document serait mesuré et imprimé, et
mesurer ailleurs répondrait sur un autre document. Introduire un `LayoutStrategy` générique sans
seconde implémentation violerait la règle anti-sur-ingénierie (AGENTS.md §3).

La session ouverte possède donc `print()`, et la voie pagination ne l'appelle jamais. Le fake et la
recette Chromium le prouvent en **faisant échouer** `print()` plutôt qu'en comptant après coup.

### 4. La composition est l'étape commune des deux façades

`composeInSession()` porte la réserve des marqueurs, la mesure naturelle, l'élargissement des
bandes, la pagination, la stabilisation et la sérialisation. `createPdfRenderPort()` imprime ce
qu'elle rend ; `createPaginationPort()` le projette. Aucune façade n'appelle l'autre.

Le nombre et l'ordre des mesures sont strictement conservés : les tests E1 à E4 qui les comptent
passent inchangés, et un test compare mesure à mesure les deux voies.

### 5. Une occurrence a un chemin de déclaration et une ascendance d'itération séparés

```ts
export interface IterationAddress {
  readonly declarationPath: readonly (string | number)[];
  readonly index: number;
}
export interface OccurrenceReference {
  readonly declarationPath: readonly (string | number)[];
  readonly iterations: readonly IterationAddress[];
  readonly nodeId: string;
  readonly nodeType: DocumentNodeType;
}
```

`declarationPath` est le chemin canonique dans le template stocké, **sans aucun rang interleavé**.
`iterations` est ordonné de la répétition la plus extérieure à la plus intérieure, et chaque entrée
nomme la déclaration répétable par son propre chemin.

Propriétés vérifiées : deux occurrences d'un rendu n'ont jamais la même adresse ; deux
matérialisations du même template et des mêmes données produisent des adresses profondément
égales ; aucune horloge, aucun aléa et aucune valeur métier n'y entre. `nodeId` reste un libellé,
jamais la clé d'unicité — la clé interne `oN` reste réservée à la mesure et n'apparaît nulle part
dans le résultat.

**Une adresse n'est pas un identifiant métier durable.** Une insertion dans le template ou dans une
séquence déplace les rangs. Le contrat le dit dans son JSDoc, et rien du résultat n'offre d'`id`
opaque qui laisserait croire le contraire.

### 6. Le chemin de diagnostic redevient un chemin de déclaration

Les détails d'erreur continuent d'écrire `path`, désormais avec le **chemin de déclaration** exigé
par [ADR 0010](0010-un-refus-comprehensible.md) D2. Un détail optionnel `occurrence` porte
l'ascendance quand le refus survient à l'intérieur d'une répétition — chemins et rangs seulement,
donc sûr à journaliser au même titre que le reste.

**Un défaut latent corrigé au passage, et il était bloquant.** `materializeCell()` employait le rang
de la **colonne** comme segment `cells`. Une ligne peut omettre une colonne ou déclarer ses cellules
dans un autre ordre : le chemin désignait alors la cellule de quelqu'un d'autre. Il prend maintenant
l'index réel dans `row.cells`. Publier l'ancien chemin aurait rendu ce défaut irréversible.

### 7. Le manifeste est plat, ordonné et attribuable

Une page expose une liste plate de `PagePlacement` — occurrence, région, rôle, état de fragment —
dans l'ordre de peinture : calques d'arrière-plan, bande haute, flux, bande basse, calques de
premier plan, puis l'ordre des descendants.

Une arborescence publique recopierait le Composite interne et ferait de chaque évolution de fragment
une rupture de contrat. La liste plate répond directement aux trois questions du lot : sur quelle
page, dans quelle région, entier ou coupé.

Les cellules ne deviennent pas des occurrences publiques : elles n'ont ni `id` ni statut de
`DocumentNode`. Une ligne est donc suivie directement des blocs de ses cellules, en ordre de colonne.

### 8. Les reports sont observés depuis les fragments finaux

```ts
export interface PageReportResult {
  readonly incoming: number;
  readonly completedBy: readonly OccurrenceReference[];
}
```

`incoming` est le cumul **brut, non arrondi** réellement donné aux marqueurs de la page — chaque
marqueur applique l'arrondi que son site déclare. `completedBy` liste les occurrences de lignes
contributrices qui *se terminent* sur cette page, dans l'ordre de contribution.

`withIncomingReports()` est la source unique des deux informations : elles sortent du même parcours,
donc la somme qu'un marqueur écrit et les lignes qu'un appelant lit ne peuvent pas nommer deux
ensembles différents. Les valeurs de contribution ne sont **pas** publiées : l'identité des lignes
suffit à expliquer la frontière, et copier des montants dans le manifeste serait une duplication de
donnée métier.

### 9. Le repli `keepTogether` est une notice du succès final

```ts
export interface KeepTogetherFallbackNotice {
  readonly code: 'keep-together-fallback';
  readonly occurrence: OccurrenceReference;
  readonly pages: readonly number[];
}
```

La notice signifie exactement : cette occurrence portait `keepTogether: true`, aucune page neuve
admissible ne pouvait la contenir entière, et sa politique ordinaire l'a répartie sur les pages
indiquées.

**Elle est dérivée de la suite acceptée, et de rien d'autre.** `noticesOf()` prend un
`PaginatedDocument` et n'a aucun état : un repli survenu pendant un tour de stabilisation abandonné
ne laisse aucune trace, parce que cette suite-là n'est pas celle qu'on lit. Le critère est
« l'occurrence couvre plus d'une page » : une occurrence qui tient reste entière, et une occurrence
simplement différée est peinte entière sur la page où elle a migré.

Un groupe de lignes marqué n'a pas de boîte propre : il est reconnu par la référence que ses lignes
portent, et reçoit **une** notice sous l'adresse du groupe, pas une par ligne.

### 10. L'enveloppe est un contrat de port, sans version de template

Les types vivent dans `@openview/core`, sous `ports/pagination/`, pour qu'un futur paquet navigateur
puisse les importer **sans dépendre de `engine`**. Le contenu transporté est une donnée : il reçoit
donc ses schémas Zod v4, selon la règle Zod-first (AGENTS.md §1.2). Le moteur construit le résultat
depuis des valeurs déjà validées et **ne parse jamais sa propre sortie** dans une boucle de rendu ;
c'est le consommateur qui emploiera le schéma à sa frontière de désérialisation.

Il n'y a donc ni `schemaVersion` de template, ni migration, ni champ d'AST nouveau. Le futur service
qui sérialisera cette enveloppe devra versionner **son** transport.

### 11. Les barrières de sécurité existantes restent les seules barrières

`serializeHtml()` demeure le seul sérialiseur : vocabulaire de tags fermé, échappement des
caractères et des attributs, images en URI admises par l'adaptateur, et une CSP portée par le
document lui-même (`default-src 'none'`, `script-src 'none'`, `connect-src 'none'`).

Le contrat documente que `html` est destiné à un **contexte de document isolé**. E5 ne peut pas
imposer un bac à sable depuis une chaîne ; il livre une source qui fonctionne sous cette contrainte,
et une sonde hostile qui le prouve dans un `iframe srcdoc sandbox=""` réel.

Le résultat contient des données rendues et se traite comme le PDF : **aucun log, aucune notice et
aucune erreur ne recopient `html`**.

### 12. E4-9 est fermé côté moteur, pas côté viewer

La composition écrit les nombres, monnaies et dates avant la sérialisation ; `PaginationResult`
transporte ces caractères tels quels. Aucune locale, aucune clé d'écriture et aucune valeur brute ne
traverse le contrat, parce qu'il n'y a rien à résoudre de l'autre côté.

La moitié moteur de l'attente E4-9 est donc tenue : il existe une voie publique sans second ICU. La
moitié viewer reste ouverte jusqu'à ce que V1 affiche cette source sans reformatage et que V3
compare effectivement l'aperçu au PDF.

### 13. Aucune abstraction de Strategy nouvelle

Un `HtmlRenderStrategy`, un `PreviewAdapter`, un `PaginationBackend` ou une factory générique de
formats sont rejetés. Il existe un backend réel, Puppeteer, et une seule composition HTML. Le port
de pagination réemploie le contrat de session actuel, et la Strategy PDF reste la seule Strategy
d'export.

**Signal de réouverture :** un second adaptateur de mesure réel, planifié et testé, dont la session
ne sait pas imprimer.

---

## Ce que l'exécution a corrigé du plan

Le plan a été suivi décision par décision. Cinq points l'ont été autrement, et chacun est un fait
mesuré, pas une préférence.

### Un échec d'ouverture garde son code sur la voie PDF, et change sur la voie pagination

Le plan (§7.6) demandait de reclasser un échec inconnu de `strategy.open()` en
`layout-measurement-failed`, en réservant explicitement le cas où « un contrat E1 existant peut
devoir être conservé ». La sonde a montré que ce contrat existe et est testé : le port PDF nomme
cet échec `pdf-export-failed` depuis E1.

**Arbitrage retenu :** le code devient un paramètre de l'ouverture. Le port PDF garde
`pdf-export-failed`, un appelant existant lit donc le même contrat. Le port de pagination nomme
`layout-measurement-failed`, parce qu'il n'a pas d'étape d'export à laquelle attribuer un échec.

### Le manifeste descend dans les zones d'une grille

Le plan (§4.4) faisait de la grille une « occurrence terminale ». L'implémentation descend dans les
zones, et c'est une correction, pas un confort : `completedOn()` descend déjà dans une grille pour
compter les contributions, donc une ligne contributrice peut se trouver dans une zone. Avec une
grille terminale, `report.completedBy` aurait pu nommer une occurrence que `placements` ne plaçait
nulle part — un manifeste qui se contredit lui-même.

La grille reste `whole` en toutes circonstances : elle est atomique, elle n'est jamais coupée.

### Le contrat expose des listes gelées, pas seulement `readonly`

Les tableaux du schéma portent `.readonly()`. Sans cela, `z.infer` produit des tableaux mutables et
le type publié n'est **pas** mutuellement assignable avec son schéma — l'exigence §7.1 échouait à
la compilation. Le bénéfice va au-delà du typage : un consommateur qui parse l'enveloppe reçoit des
listes gelées, donc il ne peut pas éditer les coupures qu'on lui a remises.

### La liste des kinds de nœud est écrite dans le schéma, pas dérivée de l'AST

Le plan interdit de modifier quoi que ce soit sous `core/src/ast/`, et l'AST n'expose aucune liste
runtime de son union. `schemas.ts` déclare donc les neuf kinds, avec un
`satisfies readonly DocumentNodeType[]` qui refuse un kind inventé et un contrôle de type qui refuse
un kind manquant. Un neuvième type de nœud casse **cette compilation**, il ne fuit pas au travers.

### La sonde P5 n'a pas pu être jouée telle qu'écrite, et le plan l'avait prévu

Le plan demandait un premier tour dont le repli disparaît au second. La géométrie l'interdit : la
stabilisation **retire** de la hauteur à une page qui a débordé, donc un tour ultérieur fragmente
au moins autant. Le plan prévoyait ce cas et exigeait alors de démontrer la dérivation et
d'interdire tout accumulateur partagé. C'est ce qui est fait :

- `noticesOf()` ne prend que le `PaginatedDocument` final et ne détient aucun état ;
- le nombre de notices est **invariant** sous 0, 1 et 2 tours refusés — un accumulateur en
  produirait un par tour ;
- les pages d'une notice sont exactement les pages du résultat rendu ;
- l'ablation « accumuler les notices à travers les tours » est **tuée**.

---

## Recette

### Sur le fake de session, sans navigateur

| Preuve | Résultat |
| :--- | :--- |
| `paginate()` rend `{ sheet, html, pages, notices }` et rien d'autre | ✅ |
| Le résultat valide le schéma publié | ✅ |
| `print()` fait échouer la session, et la pagination réussit | ✅, `printed` vide, `closed` = 1 |
| L'HTML rendu est celui remis à l'imprimeur | ✅ égalité stricte |
| Les deux voies mesurent les mêmes documents, dans le même ordre | ✅ |
| Validation refusée → aucune session ouverte | ✅ |
| `open()` inconnu → `layout-measurement-failed`, cause conservée, message sans valeur | ✅ |
| Mesure inconnue → `layout-measurement-failed`, session fermée | ✅ |
| Refus déjà nommé → traverse inchangé | ✅ |
| Suite non prouvable → aucun résultat partiel, session fermée | ✅ |
| Échec de fermeture → remonte, jamais avalé | ✅ |
| Session muette → refus typé, jamais une page inventée | ✅ |

### Sur Chromium, avec la facture de référence

| Preuve | Résultat mesuré |
| :--- | :--- |
| Soixante lignes, apparences *framed* et *bare* | **4 pages** annoncées, 4 boîtes `.ov-page` |
| Source d'aperçu vs source imprimée, même requête | **égalité octet pour octet** |
| Feuilles du PDF vs pages annoncées | 4 = 4 |
| Lignes de détail par page | manifeste = `<tr>` réellement peints, 60 au total |
| En-tête de table répété | `table-header` sur les 4 pages, jamais `flow` |
| État du fragment de table | `first`, `middle`, `middle`, `last` |
| Bandes `firstOnly` / `exceptFirst` / `exceptLast` / `lastOnly` | pages [1], [2,3,4], [1,2,3], [4] |
| Calques des deux plans | sur les 4 pages, sans déplacer une seule coupure |
| Report entrant | égal au marqueur que la page imprime, arrondi déclaré appliqué |
| Lignes contributrices | 60, chacune une fois, sur la page de son fragment final |
| Diagonales E4 fr/EUR et en/USD | 4 pages chacune, mêmes caractères qu'à l'impression |
| Manifeste vs source | 105 940 contre 104 708 caractères — **ratio 1,01**, pas un doublement |
| Aucune clé `oN`, aucun curseur, aucune valeur liée dans le manifeste | ✅ |

### Le document hostile, dans le contexte d'isolement prévu pour V1

Un jeu de données qui porte une balise `script`, une fermeture de `style`, une évasion d'attribut,
une image et un script distants vers un serveur HTTP local **réellement joignable**, et un
`file:///etc/passwd`. La source est chargée dans un `iframe srcdoc sandbox=""` d'un Chromium réel.

| Preuve | Résultat |
| :--- | :--- |
| Le texte reste du texte | ✅ lu tel quel dans le cadre |
| Aucun élément actif dans le document | ✅ zéro `script`, `iframe`, `img`, `object`, `embed` |
| Aucun script exécuté | ✅ le drapeau global reste absent |
| Aucune requête n'atteint le serveur local | ✅ compteur inchangé |
| La CSP est présente dans la source | ✅ `default-src`, `script-src`, `connect-src` à `none` |
| Ni page ni notice ne recopient la source | ✅ |

### Les ablations, jouées et mesurées

Quinze mutations volontaires, chacune rejouée par un script reproductible qui applique la mutation,
lance les tests censés la protéger, exige un ROUGE et restaure la source.

**15 sur 15 tuées.** Une seule a survécu au premier passage, et c'est le résultat le plus utile du
lot : remplacer le chemin de déclaration par le `nodeId` dans la clé de regroupement ne cassait
rien, parce que l'ascendance d'itération portait encore assez de chemins pour séparer les
occurrences du fixture. Deux corrections en découlent, gardées :

- la preuve d'unicité porte désormais sur l'**adresse publiée** elle-même, pas seulement sur la clé
  interne qu'un helper en dérive ;
- un cas nommé prouve que deux occurrences portant les **mêmes rangs** — la feuille d'une boucle
  interne et celle d'un groupe de lignes, sous le même item extérieur — ne sont séparées que par les
  déclarations qu'elles nomment.

| Mutation | Verdict |
| :--- | :--- |
| retourner le premier tour de stabilisation | tuée |
| appeler `print()` depuis `paginate()` | tuée |
| rebâtir l'HTML dans la projection | tuée |
| exposer la clé de mesure d'une occurrence | tuée |
| supprimer le rang extérieur d'une ascendance | tuée |
| distinguer deux occurrences par `nodeId` et rangs seuls | tuée *(après renforcement)* |
| mêler le rang dans le chemin de déclaration | tuée |
| adresser une cellule par le rang de sa colonne | tuée |
| accumuler les notices à travers les tours | tuée |
| compter une ligne contributrice à son premier fragment | tuée |
| omettre l'en-tête de table répété du manifeste | tuée |
| arrondir un report dans la projection | tuée |
| retirer la CSP de la source | tuée |
| cesser d'échapper les données caractère | tuée |
| ajouter un second export à la surface du moteur | tuée |

### Les quatre portes

| Porte | Baseline E4 | Après E5 |
| :--- | :--- | :--- |
| `pnpm run lint` | ✅ | ✅ |
| `pnpm run build` | ✅ | ✅ |
| `pnpm run type-check` | ✅ | ✅ |
| `pnpm run test:coverage` | 64 fichiers, 1 784 tests | **72 fichiers, 1 889 tests** |
| Instructions | 93,57 % | **93,81 %** |
| Branches | 90,42 % | **90,32 %** |
| Fonctions | 98,38 % | 98,35 % |
| Lignes | 93,47 % | **93,71 %** |

---

## Dettes explicites

- **E4-9 reste ouverte côté viewer.** La moitié moteur est tenue : une voie publique existe, sans
  second ICU. L'égalité aperçu/PDF ne sera déclarée qu'une fois V1 affichant cette source sans
  reformatage et V3 la comparant réellement au PDF.
- **J4 reste ouvert.** E5 en est une condition, pas l'atteinte : V1 à V3 restent propriétaires de
  l'encastrement, de la navigation et de la comparaison visuelle.
- **La marge de la porte des branches se resserre.** 90,32 % pour un plancher à 90 %, contre
  90,42 % avant le lot. `visitFragment()` ajoute un seizième `default:` inatteignable au décompte
  que [CH1](../plans/refactoring-huit-chantiers.md) tient : le visiteur suit la convention du dépôt
  (`const exhaustive: never` puis `kindOf`), et c'est CH1 qui traitera les seize sites d'un coup.
- **L'adresse n'est pas persistable.** Les rangs bougent quand le template ou une séquence gagne une
  entrée. Un besoin d'annoter durablement une occurrence entre deux jeux de données demandera un
  identifiant métier distinct, à concevoir.
- **La stabilité entre machines n'est pas promise.** Fontes, images et environnement restent la
  dette E6. E5 ne sur-promet pas : il dit où *ce* moteur, dans *cet* environnement, a coupé.

## Signaux de réouverture

- **Sélectionner un nœud dans l'aperçu** (survol, clic) : ajouter alors une corrélation DOM
  publique, sans jamais exposer les clés de mesure.
- **Un second backend de mesure réel**, dont la session ne sait pas imprimer : extraire un
  `LayoutStrategy` plus étroit que `PdfRenderStrategy`.
- **Un transport HTTP officiel** : versionner et valider l'enveloppe sérialisée, avec son propre
  discriminant de protocole — jamais un faux `schemaVersion` de template.
- **Un manifeste trop volumineux sur des documents réels** : ajouter une représentation compacte
  mesurée, jamais supprimer l'attribution des lignes.
- **Un aperçu devant fonctionner sans backend** : décision produit nouvelle, car elle réintroduit un
  second moteur de composition — exactement ce que ce lot existe pour empêcher.
