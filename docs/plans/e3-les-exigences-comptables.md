# Plan d'implémentation — `@openview/engine` lot E3 : les exigences comptables

> **Document d'implémentation.** Il décrit le périmètre fermé, les décisions techniques, les
> représentations internes, les sondes, les tests et l'ordre d'exécution du lot. Une fois E3 livré,
> l'ADR d'exécution prendra le relais et ce plan sera marqué périmé.
>
> **Statut : prêt à exécuter.** Les choix nécessaires à `INC-0` sont fermés. Les mesures Chromium
> restent des critères de sortie des incréments concernés, pas des hypothèses présentées comme des
> faits.
>
> **Baseline relevée le 2026-08-22 :** `HEAD=e216de4`, branche
> `feat/e2-le-tableau-deborde-proprement`, worktree propre, schéma stocké en version **8**. E2 est
> livré et fait foi par l'[ADR 0013](../adr/0013-le-tableau-deborde-proprement.md). Le prochain numéro
> d'ADR attendu est **0014**, à confirmer au début de l'exécution ; le prochain numéro de schéma est
> **9**, lui aussi à confirmer avant modification.
>
> **Briques principales :** `@openview/core`, `@openview/engine`,
> `@openview/adapter-puppeteer`, facture de référence du playground · **Dépend de :** E2 ·
> **Poids roadmap :** XL · **Jalon préparé :** J3, qui ne sera atteint qu'après E4.

---

## 0. Résultat attendu

E3 transforme la pagination générale d'E2 en pagination comptable. Sur une facture de référence de
**soixante lignes et trois pages**, le résultat doit réunir les propriétés suivantes :

1. le haut des pages 2 et 3 affiche un **report entrant exact**, calculé à partir des lignes qui se
   sont achevées sur les pages précédentes ;
2. chaque occurrence portant `keepTogether: true` reste entière dans la page courante si elle y
   tient, passe entière à la prochaine page admissible sinon, et retombe sur la politique ordinaire
   de son kind si aucune page neuve ne peut la contenir ;
3. le repli d'un parent trop grand n'efface jamais une marque descendante encore satisfaisable ;
4. un texte coupé conserve deux lignes en bas et deux lignes en haut lorsque cette préférence est
   réalisable, sans introduire un nouveau refus lorsqu'elle ne l'est pas ;
5. les mentions et le cadre de paiement écrits par le **modèle** apparaissent sur la dernière page
   uniquement, au moyen de la bande `lastOnly` déjà déclarée par `core` ;
6. aucune donnée n'est perdue, répétée ou tronquée, et la suite finale est mesurée avant impression
   comme en E2.

Le moteur ne reconnaît ni une facture, ni un montant, ni une mention légale. Le modèle désigne la
valeur numérique que chaque ligne apporte au report ; le moteur décide seulement quelles
occurrences précèdent une page, information que ni le modèle ni l'intégrateur ne peuvent connaître
avant la mesure.

E3 reste antérieur à E4. Le report sort donc dans l'écriture numérique canonique du moteur. Le
groupement des chiffres, la devise et le choix des sites de formatage appartiennent toujours à E4.
L'exemple « 12 480,00 € » de la roadmap exprime la sémantique comptable ; E3 en livre la valeur et
la position, E4 en livrera l'écriture localisée.

---

## 1. État du dépôt et écart à combler

### 1.1 Ce qu'E2 livre déjà

| Besoin d'E3 | Baseline disponible | Règle de réemploi |
| :--- | :--- | :--- |
| Décision de coupe | `paginate()` et `fillFlow()` composent des pages explicites | étendre cette politique ; ne jamais rendre la pagination à Chromium |
| Mesures | hauteurs naturelles, lignes visuelles et clés d'occurrence internes | aucune nouvelle lecture DOM dans `engine` |
| Fragments | `whole/first/middle/last` pour textes, conteneurs, tables et lignes | les utiliser pour savoir quand une ligne contributrice est achevée |
| Progression | curseurs réversibles et `assertAdvanced()` | toute préférence E3 doit conserver la preuve de terminaison |
| Bandes | réserves haute/basse constantes, domaines `firstOnly` à `lastOnly` | le report entrant vit dans `exceptFirst`; les mentions vivent dans `lastOnly` |
| Marqueurs | `pageField` survit à la liaison et reçoit une largeur fixe | ajouter le report au même mécanisme, sans expression de page ni clé de donnée réservée |
| Tableaux | en-tête répété, pied terminal, ligne entière si une page neuve la contient | la contribution suit la fin de la ligne, jamais l'en-tête répété |
| Vérification | la suite peinte est remesurée avant `print()` | vérifier aussi qu'aucun marqueur n'est rogné |
| Adaptateur | session unique, inerte et hors ligne | conserver un adaptateur générique qui ne connaît ni report ni facture |
| Erreurs | catalogue fermé et détails sûrs à journaliser | un refus de contribution numérique rejoint ce catalogue sans transporter sa valeur |

### 1.2 Les quatre écarts réels

**La marque n'ordonne encore rien.** `placeBlock()` ne lit pas `keepTogether`. Pour un texte ou un
conteneur, le document marqué et le document non marqué ont volontairement la même coupe E2.

**Trois frontières sont perdues à la liaison.** Les occurrences d'un `loop` et d'une `condition`
sont aplaties en blocs ; les lignes d'un `tableRowGroup` sont aplaties dans `MaterialTable.body`.
Le moteur ne peut donc pas garder « chaque itération » entière, bien que l'ADR 0009 l'exige. Les clés
opaques d'E2 suffisent pour le rendu courant ; l'identité publique et stable reste à E5.

**Le contrat ne désigne aucune contribution au report.** Les liaisons deviennent du texte et un
tableau ne calcule rien. Déduire un montant d'un nom de colonne, d'un chemin de donnée ou d'une
chaîne imprimée violerait directement la règle de périmètre. Une déclaration Zod-first est donc
nécessaire dans `@openview/core`.

**Le texte est purement glouton.** `sliceText()` garde le plus long préfixe qui tient, même si cela
laisse une seule ligne sur l'une des deux pages. Les curseurs Chromium nécessaires à une politique
2/2 sont déjà disponibles.

### 1.3 Ce qui est déjà satisfait et ne doit pas être réécrit

- `lastOnly` place déjà une bande sur la dernière page uniquement ; E3 doit en apporter la recette
  comptable, pas une seconde notion de « dernière page ».
- La hauteur maximale de chaque côté est déjà réservée sur **toutes** les pages. Une grande bande
  finale peut augmenter le nombre de pages, mais ne peut pas déplacer à son tour la notion de page
  finale.
- Une ligne de tableau et une image sont déjà atomiques lorsqu'une page neuve les contient.
- Les marqueurs `number` et `count` ont déjà une géométrie indépendante de leur valeur.
- Le PDF reste le seul résultat public et `RenderResult` ne révèle aucune pagination.

---

## 2. Périmètre fermé

### 2.1 Inclus dans E3

- une déclaration de **contribution de ligne** au report, évaluée dans la portée locale de cette
  occurrence ;
- un troisième `pageField`, `report`, avec `decimals` et `mode` requis ;
- l'estampille de schéma et la migration correspondantes ;
- le report entrant cumulatif sur les pages postérieures à la première ;
- la politique ordonnée de `keepTogether` sur les huit kinds, y compris les occurrences répétées ;
- le maintien des marques descendantes après repli d'un parent ;
- une préférence veuve/orpheline 2/2 pour les lignes visuelles d'un `TextNode` ;
- la composition de mentions et d'un cadre de paiement **fournis par la fixture** dans une bande
  `lastOnly` ;
- la détection d'un marqueur rogné dans la mesure finale ;
- une facture de recette de 60 lignes calibrée à trois pages ;
- les tests sans navigateur, les sondes Chromium, la recette visuelle et les ablations.

### 2.2 Exclus, avec leur propriétaire

| Exclu d'E3 | Motif | Propriétaire |
| :--- | :--- | :--- |
| « à reporter » sortant en bas de page | la roadmap ne demande que le report entrant ; ajouter deux directions est une convention comptable nouvelle | futur besoin explicite + version de contrat |
| nom ou nombre arbitraire d'accumulateurs | aucun document de référence n'en demande plusieurs ; un canal unique évite une référence croisée globale | signal de réouverture : deux reports indépendants dans un modèle réel |
| report porté par un bloc non tabulaire | l'ordre et l'achèvement sont sans ambiguïté sur une ligne de corps ; généraliser avant un besoin réel serait une politique neuve | futur lot `core` versionné |
| synthèse de mentions, taux, identifiants légaux ou échéances | ce sont des données et des règles de l'intégrateur | jamais le moteur |
| formatage monétaire, locale, devise, libellés fixes | E3 produit un nombre canonique et le modèle écrit le libellé | E4 |
| résultat public de pagination et observation du repli | E3 emploie des clés internes à un rendu seulement | E5 |
| égalité entre machines, fontes embarquées | E3 reste cohérent dans une session ; il ne promet pas l'identité multi-machine | E6 |
| corpus complet de PDF figés | E3 a une recette ciblée, pas le filet global | E7 |
| plafond de pages, temps, mémoire, concurrence | la terminaison logique n'est pas le durcissement opérationnel | E8 |
| `keepWithNext`, saut manuel, priorité de coupe | relations ou ordres absents du contrat actuel | futur lot `core` + estampille |
| seuils configurables de veuve/orpheline | aucun besoin ne justifie un nouveau champ ; E3 fixe une préférence moteur | futur besoin explicite |
| HTML et image comme formats publics | roadmap PDF-only | hors v1 |

### 2.3 Ce que « mentions sur la dernière page » signifie

Le modèle place les textes et le cadre qu'il souhaite dans `page.footer[].content` avec
`on: 'lastOnly'`. Le jeu de données et les expressions portent leur contenu. Le moteur :

- ne connaît aucun vocabulaire légal ;
- n'impose aucune position dans le cadre ;
- ne valide aucune conformité ;
- applique la bande à la dernière page et la refuse par `page-band-overflow` si elle est trop haute.

La facture est le niveau d'épreuve, pas une structure spéciale du moteur.

---

## 3. Décisions d'architecture

### D1 — Le modèle désigne une contribution de LIGNE ; le moteur décide la frontière de page

Le contrat cible est :

```ts
export interface PageReportContribution {
  readonly value: PrintableExpression;
}

export interface TableRowNode extends NodeBase {
  readonly type: 'tableRow';
  readonly pageReport?: PageReportContribution | undefined;
  // Existing fields stay unchanged.
}
```

`pageReport.value` est évalué une fois par occurrence matérialisée de la ligne, dans la même portée
que ses cellules. Il doit produire un nombre fini. Une ligne sans ce champ ne contribue rien.
`PageReportContributionSchema` est défini avec `PrintableExpressionSchema` dans `ast/schemas.ts` et
exporté avec le type par les façades usuelles : la forme publique n'existe jamais sans son schéma
Zod.

La déclaration est limitée aux lignes du **corps**. `TableNodeSchema` refuse un `pageReport` dans
`header` ou `footer` : un en-tête est répété et un pied n'est pas une ligne de détail. Cette règle
est décidée au save time, là où la position est encore connue.

Pourquoi la ligne :

- sa fin est observable dans `RowFragment.edge` ;
- sa répétition par `tableRowGroup` fournit la bonne portée d'alias ;
- le modèle choisit l'expression, donc Openview ne reconnaît aucun nom de champ ou de colonne ;
- une ligne de corps est la plus petite unité comptable que le document de référence demande ;
- le tableau continue de **ne rien sommer** : il transporte des occurrences, le paginateur agrège
  les contributions dont il a lui-même décidé la page.

Écartés : inspecter les liaisons numériques d'une cellule ; nommer une colonne « montant » ; faire
référence à un `tableId` ou `columnId` global ; injecter un sous-ensemble de données dans une portée ;
ajouter une expression qui lirait le numéro de page.

### D2 — `pageField: report` porte l'arrondi, jamais la devise

`PAGE_FIELDS` devient `['number', 'count', 'report']`. La forme `report` exige les deux paramètres
du contrat C2 :

```ts
export interface TextPageReportSegment {
  readonly kind: 'pageField';
  readonly field: 'report';
  readonly decimals: number;
  readonly mode: RoundMode;
  readonly typography?: Typography | undefined;
}
```

Les formes `number` et `count` gardent exactement leurs clés actuelles. Le type public
`TextPageFieldSegment` devient l'union du compteur et du report ; le visiteur de segment conserve sa
branche `pageField`, donc aucun quatrième kind inline n'apparaît.

Le libellé est un `literal` ou une expression du modèle placée à côté. E3 n'ajoute ni symbole
monétaire, ni `format`, ni nom d'écriture. E4 pourra ajouter son champ de site sur ce segment dans la
version suivante disponible.

### D3 — Une seule estampille, posée avec toute la forme stockée

E3 élargit une union (`field: 'report'`) et ajoute un champ optionnel (`TableRowNode.pageReport`). Les
deux classes exigent un incrément de `schemaVersion`. Si la baseline n'a pas changé :

- `CURRENT_SCHEMA_VERSION` passe de 8 à 9 ;
- `TEMPLATE_MIGRATIONS` gagne **une** entrée 8→9 d'estampille seule ;
- la fixture historique v9 porte au moins une ligne contributrice et un marqueur report ;
- un build v8 doit refuser lisiblement le document v9 par sa version au lieu de dépouiller le champ
  ou de rendre « discriminant inconnu ».

Le contrat, la migration, les tests de compatibilité et la fixture entrent dans le **même commit**.
Le numéro 9 n'est pas réservé par ce plan : s'il est pris avant exécution, l'incrément emploie la
prochaine version disponible.

### D4 — Le report d'une page est ENTRANT et cumulatif

Pour une page `p`, la valeur brute du report est la somme des contributions des lignes dont
l'occurrence est achevée sur une page strictement antérieure à `p`.

- une ligne `whole` contribue sur sa page ;
- une ligne fragmentée contribue sur la page de son fragment `last`, jamais sur `first` ou
  `middle` ;
- l'en-tête répété n'est jamais parcouru comme source de contribution ;
- le report brut de la page 1 vaut zéro, mais la facture de référence ne l'affiche pas : son
  marqueur vit dans la bande `exceptFirst` ;
- chaque marqueur applique son `decimals` et son `mode` au cumul brut avec l'algorithme exact de C2 ;
- le résultat est converti en texte canonique, sans locale.

Les contributions achevées sont identifiées par leur clé d'occurrence et ordonnées par leur rang de
matérialisation avant sommation. Le cumul de chaque page est recalculé depuis cet ordre stable, et
non obtenu en additionnant au hasard les cellules que le DOM a retournées. Toute somme non finie est
refusée.

Cette définition tranche le cas d'une ligne surdimensionnée : son montant entre dans le report une
fois son dernier fragment placé. Elle privilégie l'unicité et l'explicabilité à une heuristique
basée sur la cellule où les chiffres sont visibles.

### D5 — L'arrondi du report réemploie l'opération C2

`roundDecimal()` devient une utilité publique de `@openview/core`, documentée en anglais et testée
par les oracles existants. `engine` ne recopie pas l'algorithme et ne construit pas une expression
artificielle pour réentrer dans l'évaluateur.

Cette publication ajoute une valeur au barrel de `core` : le test qui épingle le compte d'exports
est remesuré et incrémenté, jamais supprimé. La fonction garde les préconditions déjà garanties par
`RoundExpressionSchema` (`decimals` borné, `mode` fermé) ; E3 ne crée pas une seconde politique de
validation autour d'elle.

Le budget d'évaluation porte sur les expressions de contribution, évaluées une fois. Arrondir le
cumul déjà numérique est une opération de rendu bornée, pas une nouvelle lecture du jeu de données.

### D6 — La géométrie du report ne dépend jamais de sa valeur

Un report modifie une bande qui modifie la hauteur du flux qui modifie les coupures qui modifient le
report. Pour fermer ce cycle, le marqueur reçoit avant pagination une largeur majorante fixe.

La forme canonique d'un `number` JavaScript fini n'emploie que
`0123456789-+.e` et tient dans **25 caractères**. E3 mesure, pour chaque signature typographique de
marqueur, le glyphe le plus large de cet alphabet et réserve :

```text
25 × largeur du glyphe le plus large
```

`number` et `count` conservent leur réserve plus étroite fondée sur le nombre maximal de chiffres.
`MarkerReserve.widthOf()` reçoit le run complet plutôt que la seule typographie afin de choisir la
bonne famille de borne.

La valeur 25 est couverte par des contre-exemples aux deux écritures décimales limites et aux formes
exponentielles. E4 devra réexaminer cette borne : une chaîne localisée peut contenir des séparateurs,
un symbole et des espaces qui ne sont pas dans l'alphabet canonique.

La mesure finale rapporte en plus le nombre de `.ov-marker` dont `scrollWidth` dépasse
`clientWidth`. Toute valeur non nulle provoque `layout-measurement-failed`. `overflow:hidden` reste
une barrière visuelle, jamais une façon de faire passer un marqueur trop étroit.

### D7 — `keepTogether` suit exactement l'ordre de l'ADR 0009

Au début d'une occurrence marquée, après mesure naturelle :

1. si sa hauteur entière tient dans l'espace restant, `wholeFragment()` est placé ;
2. sinon, si elle tient dans une page neuve admissible, la page courante se ferme sans elle ;
3. sinon, la marque cesse de bloquer et le kind emploie sa politique E2 ordinaire.

La troisième branche n'est ni un avertissement, ni un refus neuf. Elle est la preuve de terminaison.
Une fois le repli engagé pour un parent, son curseur ne retente pas l'occurrence entière à chaque
page ; les enfants, eux, conservent leurs propres marques.

Pour `text`, `image`, `container` et `table`, `metrics.height(key)` donne la hauteur entière. La
ligne de tableau possède déjà cette politique par défaut ; E3 l'épingle dans la matrice des huit
kinds sans inventer une seconde implémentation.

### D8 — Les occurrences de boucle et de condition deviennent des groupes transparents seulement
quand la marque en a besoin

Une itération d'un `loop` marqué et le résultat vrai d'une `condition` marquée sont matérialisés en
`MaterialContainer` synthétique : clé neuve, `nodeId` de la déclaration, chemin d'occurrence,
`box: undefined`, enfants liés dans leur portée. Le HTML correspondant est un conteneur sans style.

Un nœud non marqué reste aplati comme en E2. Cette asymétrie évite d'élargir toute la représentation
pour une information qui n'a d'effet que lorsqu'elle est demandée.

Une sonde Chromium doit démontrer qu'un wrapper sans boîte garde exactement les largeurs et hauteurs
du flux aplati. Si elle échoue, l'implémentation devra introduire un fragment de groupe transparent
dans le constructeur HTML ; elle ne pourra pas accepter un changement de géométrie silencieux.

La boucle est traitée **par itération**. Soixante éléments donnent soixante groupes éventuels, pas
un groupe contenant les soixante. Une condition fausse ne produit aucune occurrence à garder.

### D9 — `tableRowGroup` conserve une frontière d'occurrence sans changer le contrat de table

Chaque ligne matérialisée depuis un groupe marqué porte une référence interne vers son occurrence
de groupe : clé, `nodeId`, chemin et bornes de la sous-séquence. Au début de cette sous-séquence,
`placeTable()` compare la somme des hauteurs naturelles de ses lignes à la place courante puis à une
page neuve.

Si le groupe dépasse toute page neuve, `placeTable()` reprend la ligne courante avec sa politique
ordinaire. Une ligne descendante marquée reste donc entière si elle le peut. Le curseur reste celui
d'E2 (`row` puis éventuel curseur de cellules) ; aucune identité publique E5 n'est figée.

Un groupe non marqué reste une simple séquence de lignes. Plusieurs lignes déclarées dans un même
groupe sont gardées ensemble **pour chaque item**, jamais pour la séquence complète.

### D10 — Les veuves et orphelines sont une préférence 2/2, pas une cause de refus

Pour un texte qui doit être coupé et possède au moins quatre lignes visuelles restantes :

- le fragment courant garde au moins deux lignes ;
- le fragment suivant en reçoit au moins deux ;
- si l'espace restant ne permet pas deux lignes mais qu'une page neuve peut porter le texte entier,
  le texte est reporté ;
- si aucune coupure 2/2 n'est possible sur une page neuve, le moteur revient à la coupe E2 qui fait
  progresser d'au moins une ligne.

La préférence s'applique à tout `TextNode`, y compris dans une cellule. Elle ne s'applique pas aux
lignes de tableau : l'ADR 0009 parle d'un seuil dépendant de la fonte, donc des lignes visuelles du
texte. Aucun champ `orphanControl` ou nombre minimal n'entre dans le modèle.

Ordre des politiques : `keepTogether` essaie d'abord l'occurrence entière ; si son repli est
nécessaire, la politique ordinaire du texte inclut alors la préférence 2/2.

### D11 — Les bandes restent atomiques et étrangères au flux

`keepTogether` sur le conteneur d'une bande n'entre dans aucune des branches D7. Une bande ne passe
jamais sur une page suivante et ne se fragmente jamais. Sa hauteur est mesurée ; si elle dépasse sa
réserve ou rend la feuille impossible, les refus E2 restent inchangés.

Le report `exceptFirst` et le cadre `lastOnly` participent au calcul de la réserve maximale du côté
où ils vivent. Leur présence peut réduire le nombre de lignes par page, mais la réserve constante
interdit toute oscillation « dernière page ↔ page précédente ».

### D12 — Le Pipeline reste un Pipeline

L'ordre complet devient :

```text
validation et migration
  → liaison des blocs, bandes et contributions
  → réservation des marqueurs
  → mesure naturelle
  → pagination avec keepTogether et seuils 2/2
  → calcul des reports entrants depuis les fragments finaux
  → construction HTML
  → mesure et stabilisation de la suite
  → impression
```

Chaque reprise de `settle()` repagine depuis le début et recalcule les reports. Leur largeur étant
fixe, leur valeur ne peut pas modifier une ligne ni une hauteur. Aucune étape ne retourne un succès
partiel et aucun `next()` n'autorise une interruption silencieuse.

### D13 — Un refus neuf nomme une contribution inutilisable

Le tuple public gagne `page-report-refused`. Il couvre :

- une expression de contribution qui produit autre chose qu'un nombre fini ;
- une somme de contributions qui devient non finie ;
- une configuration interne de report incohérente après validation, si une stratégie tierce remet
  une mesure impossible.

Les détails autorisés sont `nodeId`, `path`, `actualType` et `pageNumber`. Le message ne transporte
jamais la valeur, le texte, le nom d'un champ de l'intégrateur ou le HTML.

Une expression qui échoue déjà dans `@openview/core` garde `expression-refused` et ses diagnostics.
Le nouveau code ne remplace pas une erreur plus précise.

### D14 — E3 ne publie ni page, ni occurrence, ni diagnostic de repli

`OccurrenceKey`, le rang de contribution, les frontières de groupe et les reports bruts restent des
types internes. `RenderResult` reste `{ format, bytes, contentType }`. E5 choisira une identité
capable de survivre entre deux rendus et rendra les replis observables ; E3 ne préempte pas cette
surface.

---

## 4. Représentations internes cibles

Les noms ci-dessous sont des formes de travail. Ils peuvent être ajustés pendant l'exécution si les
invariants restent ceux de cette section.

### 4.1 Contribution matérialisée

```ts
export interface MaterialPageReport {
  readonly key: OccurrenceKey;
  readonly order: number;
  readonly value: number;
}

export interface MaterialRow extends MaterialBase {
  readonly cells: readonly MaterialCell[];
  readonly pageReport: MaterialPageReport | undefined;
  readonly keptGroup: MaterialRowGroupOccurrence | undefined;
}
```

Le rang est remis à zéro par rendu, comme les clés. Il est déterministe et ne sort jamais du paquet.

### 4.2 Groupe de lignes matérialisé

```ts
export interface MaterialRowGroupOccurrence {
  readonly key: OccurrenceKey;
  readonly nodeId: string;
  readonly path: readonly (string | number)[];
  readonly firstRow: number;
  readonly rowCount: number;
}
```

L'implémentation peut stocker les bornes sur le groupe ou partager l'objet sur ses lignes. Le test
porte sur une occurrence distincte par item et sur le repli, pas sur la disposition mémoire.

### 4.3 Marqueur matérialisé

`MaterialPageFieldRun` devient une union interne : compteur sans configuration supplémentaire, ou
report avec `decimals` et `mode`. `MarkerReserve.widthOf(run)` rend une largeur pour le run exact.

### 4.4 Page composée

```ts
export interface MaterialPage {
  readonly number: number;
  readonly count: number;
  readonly incomingReport: number;
  readonly header: readonly MaterialBlock[];
  readonly root: readonly MaterialFragment[];
  readonly footer: readonly MaterialBlock[];
}
```

Le collecteur de contributions parcourt uniquement `root`. Dans un `TableFragment`, il ignore
`header`, descend dans `rows` et dans leurs cellules, et retient la contribution de la ligne source
seulement pour `edge: whole | last`. Un `Set<OccurrenceKey>` interdit un double compte ; l'ordre de
sommation vient ensuite de `order`.

### 4.5 Mesure de session

`PdfLayoutMeasurement` gagne une information numérique sûre, par exemple
`clippedMarkerCount: number`. L'adaptateur ne retourne ni texte ni valeur. La validation exige un
entier fini positif ou nul ; la vérification finale exige zéro.

---

## 5. Algorithmes

### 5.1 Matérialisation d'une ligne contributrice

1. construire la portée de la ligne comme aujourd'hui ;
2. évaluer `pageReport.value` avec le budget partagé ;
3. affiner le résultat vers un nombre fini ;
4. attribuer clé et rang de contribution ;
5. matérialiser les cellules une seule fois ;
6. attacher la contribution à `MaterialRow`.

Une répétition de 60 items effectue 60 évaluations de contribution, jamais une par page ni une par
tour de stabilisation.

### 5.2 Placement d'un bloc marqué

Au premier curseur du bloc :

```text
wholeHeight <= available  → placer entier
wholeHeight <= fresh      → ne rien placer, fermer la page
wholeHeight > fresh       → appeler la politique ordinaire du kind
```

Avec un curseur interne, la troisième branche est déjà engagée : ne pas remesurer ni reporter le
parent. Les appels récursifs continuent à examiner les marques des descendants.

### 5.3 Placement d'un groupe de lignes marqué

1. reconnaître le début d'une occurrence de groupe ;
2. sommer les hauteurs naturelles des lignes de cette occurrence ;
3. appliquer les trois branches D7 ;
4. si le groupe tient, placer ses lignes entières dans l'ordre ;
5. s'il replie, reprendre `placeRow()` à la ligne courante ;
6. ne pas retenter le groupe une fois un curseur interne produit.

### 5.4 Coupe 2/2 d'un texte

À partir des `LineMetric` restantes :

1. calculer le plus grand nombre de lignes qui tient ;
2. si toutes tiennent, terminer le bloc ;
3. borner le candidat pour en laisser au moins deux après la coupe ;
4. exiger au moins deux lignes avant la coupe ;
5. si le seuil échoue dans un espace partiel, reporter sur page neuve ;
6. s'il échoue aussi sur page neuve, prendre le préfixe E2 non vide ;
7. conserver exactement les curseurs et les runs d'E2.

### 5.5 Calcul du report entrant

Après chaque pagination candidate :

1. parcourir les pages dans l'ordre et relever les clés des lignes contributrices achevées ;
2. pour la page courante, filtrer toutes les contributions achevées sur les pages précédentes ;
3. trier par rang de matérialisation ;
4. sommer dans cet ordre et refuser le premier résultat non fini ;
5. stocker le cumul brut sur la page ;
6. au paint, arrondir selon le marqueur et écrire `String(result)`.

La pagination suivante de `settle()` recommence ce calcul. Aucun report d'un essai précédent n'est
patché dans une nouvelle suite.

---

## 6. Organisation cible des fichiers

| Zone | Fichiers | Travail |
| :--- | :--- | :--- |
| Contrat AST | `packages/core/src/ast/types.ts`, `schemas.ts`, `nodes.ts` | contribution de ligne, report field, schémas et exports |
| Parcours | `packages/core/src/ast/visitor.ts` | inclure l'expression de contribution dans `nodeReads()` |
| Arrondi | `packages/core/src/expression/evaluator/operations/round.ts`, façades | exporter l'opération pure sans dupliquer son corps |
| Version | `packages/core/src/template/template.ts`, `migrate.ts`, tests et fixtures de compatibilité | estampille et migration |
| Matérialisation | `packages/engine/src/document/types.ts`, `materialize.ts` | contributions, groupes synthétiques, frontières de groupe de lignes |
| Pagination | `packages/engine/src/pagination/flow.ts`, `table.ts`, `text.ts`, `paginate.ts`, `types.ts`, `whole.ts`, `progress.ts` | politiques E3 et calcul des pages |
| Modules neufs | `packages/engine/src/pagination/reports.ts`, `keep-together.ts` si l'extraction réduit réellement les fichiers | calculs unitaires, sans façade cérémonielle |
| Marqueurs | `packages/engine/src/pagination/markers.ts`, `html/build.ts`, `html/build-page.ts` | réserves et substitution du report |
| Pipeline | `packages/engine/src/pipeline/render-pdf.ts` | ordre des mesures, recomposition des reports |
| Erreurs | `packages/engine/src/errors.ts` | `page-report-refused` et détails sûrs |
| Port PDF | `packages/engine/src/strategy/pdf.ts` | compteur de marqueurs rognés |
| Adaptateur | `packages/adapter-puppeteer/src/measure.ts` et tests | observation générique du rognage |
| Recette | `apps/playground/src/examples/reference-invoice.ts` et tests de document de référence | 60 lignes, report, dernière page |

Les tests nouveaux de chaque sous-système rejoignent un `__tests__/` local. Aucun manifeste,
tsconfig, fichier Biome, workflow, `turbo.json` ou seuil de couverture ne doit changer.

---

## 7. Sondes bloquantes d'INC-0

Les sondes sont jetables ou deviennent des tests si leur oracle reste utile. Un résultat contraire
fait réviser le plan avant la production correspondante.

### P1 — Un wrapper transparent ne change pas la géométrie

Mesurer le même flux aplati puis entouré d'un `div` sans style, à la racine, dans une cellule et
autour d'un tableau. Largeur et hauteur doivent rester égales à la tolérance E2. Sinon, le groupe
reçoit une représentation HTML dédiée au lieu de réemployer le conteneur.

### P2 — La hauteur naturelle prédit un placement entier

Pour texte, conteneur, table et groupe synthétique, comparer `metrics.height(key)` à la hauteur de
la même occurrence peinte entière. La décision `keepTogether` ne peut pas s'appuyer sur une hauteur
qui ignore un padding ou une ligne.

### P3 — Un groupe de lignes reconstruit garde la géométrie du tableau

Une occurrence de trois lignes, entière puis repliée, conserve colonnes, filets et hauteur. Le
marquage interne ne doit produire aucun élément HTML dans `tbody` autre que des `tr`.

### P4 — Les curseurs autorisent réellement 2/2

Sur textes de 1 à 7 lignes, avec runs de tailles différentes et ligne vide, démontrer que les
curseurs E2 sélectionnent exactement deux lignes en tête et en queue sans perdre de caractère.

### P5 — La réserve canonique contient toutes les formes limites

Tester au minimum : zéro, négatif, 17 chiffres significatifs, seuils d'écriture décimale, exposants
positif et négatif, deux polices et deux graisses. Aucun `.ov-marker` ne doit avoir
`scrollWidth > clientWidth + 0.5`.

### P6 — Une contribution de ligne fragmentée est comptée une fois

Une ligne trop haute se fragmente sur trois pages. Sa contribution n'apparaît pas au report de la
deuxième page, apparaît à celui de la page suivant son fragment final et n'est jamais doublée par
un en-tête répété ou une cellule terminée.

### P7 — Une grande bande finale ne fait pas osciller la suite

Le pied `lastOnly` est plus haut que le pied `exceptLast`. La réserve maximale reste identique sur
toutes les pages et deux compositions successives rendent le même nombre de pages et les mêmes
coupures.

---

## 8. Facture de recette

### 8.1 Modèle

La facture de référence conserve ses noms de données, qui appartiennent à la fixture. Elle gagne :

- un en-tête `firstOnly` sans report ;
- un en-tête `exceptFirst` reprenant le contenu commun et ajoutant le libellé puis
  `{ kind: 'pageField', field: 'report', decimals: 2, mode: 'halfExpand' }` ;
- `pageReport: { value: lineAmount }` sur la ligne de détail répétée ;
- un bloc de totaux `keepTogether: true` ;
- une adresse ou un cadre de paiement `keepTogether: true` dans le flux lorsque le scénario doit
  éprouver le report sur page neuve ;
- mentions et cadre de paiement fournis par les données dans la bande `lastOnly` ;
- un texte assez long pour exercer une coupe 2/2 sans rendre la facture artificielle.

La duplication des contenus communs entre `firstOnly` et `exceptFirst` est le coût déjà accepté par
l'ADR 0006. Aucun helper de production ne synthétise ces bandes.

### 8.2 Oracles sans navigateur

La session quadrillée fixe trois pages et une distribution connue de lignes. Les attentes portent
sur les valeurs calculées depuis la fixture, pas sur des nombres recopiés dans le moteur :

- page 1 : aucun marqueur de report peint ;
- page 2 : somme exacte des contributions achevées page 1 ;
- page 3 : somme exacte des contributions achevées pages 1 et 2 ;
- total final du modèle inchangé et égal à la somme des 60 contributions ;
- chaque contribution utilisée une fois ;
- bloc de totaux entier ;
- mentions et cadre de paiement absents des pages 1 et 2, présents une fois page 3 ;
- chaque texte fragmenté respecte 2/2 lorsque possible.

### 8.3 Oracles avec Chromium

- exactement trois feuilles à la taille déclarée ;
- soixante lignes dans l'ordre, aucune dupliquée ;
- en-tête de table répété sur les trois pages ;
- reports des pages 2 et 3 égaux aux sommes des lignes réellement terminées avant elles ;
- numérotation `1/3`, `2/3`, `3/3` ;
- aucun marqueur rogné ;
- cadre de totaux non coupé s'il tient sur une page neuve ;
- mentions et paiement sur la troisième feuille seulement ;
- document imprimé identique au dernier HTML mesuré.

La feuille, la typographie ou les espacements de la fixture sont calibrés dans `INC-6` pour obtenir
trois pages. Le nombre de lignes par page n'est pas inscrit comme règle du moteur.

### 8.4 Oracle humain

Le PDF des deux apparences est ouvert page par page. La revue vérifie : continuité de lecture,
report compréhensible, aucune ligne isolée choquante, cadres fermés, dernière page équilibrée,
mentions lisibles et absence de blanc ou de rognage autour des marqueurs.

La validation par un utilisateur métier demandée par la roadmap est une action de recette à
planifier. Si aucun relecteur métier n'est disponible, l'implémentation peut être techniquement
verte, mais la phrase « un utilisateur métier ne relève aucune anomalie » ne doit pas être annoncée
comme démontrée.

---

## 9. Stratégie de tests

### 9.1 `@openview/core`

- les formes `number` et `count` restent inchangées ;
- `report` exige `decimals` et `mode`, refuse bornes et modes inconnus avec les messages C2 ;
- les clés propres des types et des schémas restent en accord ;
- une contribution est acceptée sur une ligne de corps fixe et répétée ;
- une contribution est refusée dans `header` et `footer` ;
- `collectDataPaths()` collecte la valeur de contribution et masque correctement l'alias du
  `tableRowGroup` ;
- la marque n'ajoute aucun nom de donnée implicite ;
- migration courante→suivante, chaîne 1→courante, version future refusée ;
- fixture historique courante distincte des précédentes ;
- `roundDecimal` garde tous ses oracles et son repli de `-0` ;
- le barrel public gagne exactement l'export prévu, sans fuite d'un autre helper d'évaluateur.

### 9.2 Matérialisation

- contribution fixe et contribution répétée évaluées dans la bonne portée ;
- une évaluation par occurrence, budget partagé avec cellules et bandes ;
- chaîne, booléen, date, absence et nombre non fini refusés sans valeur dans le message ;
- deux rendus donnent les mêmes clés et rangs internes ;
- boucle marquée : un groupe par item ; boucle vide : aucun groupe ;
- condition vraie marquée : un groupe ; condition fausse : aucun ;
- groupe de lignes marqué : une frontière par item, avec plusieurs lignes par item.

### 9.3 `keepTogether`

Pour chacun des huit kinds : tient dans le reste, ne tient que sur page neuve, dépasse toute page
neuve. Les cas spécifiques obligatoires :

- un parent trop grand replie, son enfant marqué est reporté entier ;
- une boucle marquée ne rassemble jamais toutes ses itérations ;
- un groupe de lignes marqué garde les lignes d'un item, pas celles de tous les items ;
- une ligne marquée surdimensionnée emploie la fragmentation de cellules E2 ;
- une image marquée surdimensionnée garde `oversized-atomic-resource` ;
- une marque dans une bande garde `page-band-overflow` ;
- aucun cas ne laisse le curseur inchangé.

### 9.4 Veuves et orphelines

- 1, 2 et 3 lignes : aucune coupure artificielle ;
- 4 lignes : 2/2 ;
- 5, 6 et 7 lignes sous plusieurs capacités ;
- une seule ligne disponible en bas et texte tenant sur page neuve : report ;
- impossibilité 2/2 même sur page neuve : repli non vide et terminaison ;
- runs mixtes, lignes vides, emoji et paires de substitution toujours reconstruits exactement ;
- texte dans une cellule et texte sous parent `keepTogether` replié.

### 9.5 Reports

- valeurs positives, négatives et zéro ;
- arrondis `halfExpand` et `halfEven`, décimales positives, nulles et négatives ;
- ordre de sommation stable ;
- ligne entière, ligne fragmentée et table imbriquée ;
- en-tête répété ignoré ;
- aucun report visible page 1 avec `exceptFirst` ;
- reprise de `settle()` déplace une ligne et recalcule les deux reports ;
- somme non finie refusée avec page et sans valeur ;
- deux marqueurs report avec deux arrondis explicitement différents rendent deux écritures
  différentes du même cumul, sans ambiguïté sur la responsabilité du modèle.

### 9.6 Marqueurs et adaptateur

- mesures de glyphes complètes et attribuables ;
- réponse omettant ou doublant une mesure refusée comme en E2 ;
- `clippedMarkerCount` négatif, fractionnaire ou non fini refusé ;
- marqueur réellement rogné détecté ;
- report limite non rogné ;
- scripts toujours inertes, réseau toujours fermé, une session par rendu, fermeture attendue sur
  succès et refus.

### 9.7 Régressions E1/E2

- les deux factures courtes restent sur une page ;
- la facture E2 non enrichie garde sa pagination et sa numérotation ;
- images, tableaux imbriqués, filets par fragment et bandes seules restent inchangés ;
- l'API publique `createPdfRenderPort()` et le résultat PDF restent identiques ;
- aucune stratégie n'importe Puppeteer dans `engine`.

### 9.8 Portes

À la fin de chaque incrément publiable, exécuter les tests ciblés. À la clôture, dans cet ordre :

```bash
pnpm run lint && pnpm run build && pnpm run type-check && pnpm run test:coverage
```

La couverture reste au-dessus de 90 % pour instructions, branches, fonctions et lignes, sans
exclusion ni seuil modifié. Les tests sont type-checkés et toute promesse asynchrone est attendue.

---

## 10. Incréments d'exécution

### INC-0 — Baseline et sept sondes

**Travail :** confirmer worktree, versions, numéros libres et quatre portes vertes ; exécuter P1 à
P7 ; consigner leurs résultats dans le brouillon d'ADR 0014.

**Sortie :** aucune hypothèse DOM portant une politique E3 ne reste non mesurée.

### INC-1 — Contrat de report et estampille

**Travail :** ajouter contribution, report field, schémas, parcours, export d'arrondi, version,
migration et compatibilité dans un même incrément ; compléter les tests `core`.

**Sortie :** un modèle peut déclarer la valeur d'une ligne et l'emplacement arrondi du report, sans
que `engine` la rende encore. Le commit reste cohérent et aucun document neuf n'est estampillé 8.

### INC-2 — Matérialisation des occurrences comptables

**Travail :** évaluer les contributions, attribuer leur ordre, préserver les groupes marqués de
boucle/condition/ligne, compléter les tests de budget et de portée.

**Sortie :** la représentation interne contient toutes les frontières nécessaires, sans identité
publique et sans réévaluation par page.

### INC-3 — Politique `keepTogether`

**Travail :** appliquer les trois branches aux blocs et groupes de lignes ; couvrir les huit kinds,
les descendants et les bandes ; maintenir les invariants de curseur.

**Sortie :** les six scénarios transmis par l'ADR 0009 et les occurrences répétées sont prouvés.

### INC-4 — Veuves et orphelines 2/2

**Travail :** modifier `sliceText()` au-dessus des curseurs E2, écrire la matrice 1–7 lignes et les
replis de terminaison.

**Sortie :** toute coupure satisfaisable respecte 2/2, toute coupure impossible progresse encore.

### INC-5 — Accumulation, arrondi et réserve des reports

**Travail :** collecter les fins de lignes, calculer le cumul entrant, généraliser les réserves de
marqueurs, substituer le report et recalculer à chaque pagination candidate.

**Sortie :** les oracles quadrillés rendent les reports exacts et leur valeur ne modifie jamais la
géométrie.

### INC-6 — Observation Chromium du rognage

**Travail :** étendre le contrat éphémère de mesure, l'adaptateur, ses gardes et la vérification
finale ; faire passer P5 et les cas hostiles existants.

**Sortie :** une réserve insuffisante devient un refus mesuré, jamais un chiffre coupé dans le PDF.

### INC-7 — Facture de référence et playground

**Travail :** enrichir le modèle, calibrer 60 lignes sur trois pages, ajouter les oracles de report,
de dernière page et d'insécabilité, conserver les jeux courts.

**Sortie :** le scénario E3 est téléchargeable depuis le playground et démontrable sans changer de
surface d'intégration.

### INC-8 — Chromium réel, recette visuelle et validation métier

**Travail :** exécuter les tests de bout en bout sur les deux apparences, ouvrir les six pages,
consigner la revue visuelle et organiser la lecture métier prévue par la roadmap.

**Sortie :** la recette technique est prouvée ; l'acceptation métier est nommée ou explicitement
restée non démontrée.

### INC-9 — Ablations, ADR et clôture

**Travail :** appliquer puis retirer chaque mutation §11 ; écrire l'ADR 0014 avec les résultats
réels et les corrections du plan ; marquer E3 livré dans `docs/roadmap/engine.md` ; mettre à jour la
vue d'ensemble sans cocher J3 avant E4 ; lancer les quatre portes ; relire tous les commentaires
source ajoutés (anglais, concis, sans numéro de lot).

**Sortie :** E3 est livré et E4 peut choisir les sites de formatage sur une pagination comptable
stable.

---

## 11. Preuves d'ablation

Chaque mutation doit compiler, être exécutée et faire rougir le test nommé. Une erreur de syntaxe
ou de type n'est pas comptée comme preuve runtime.

| Mutation | Preuve attendue |
| :--- | :--- |
| ne pas incrémenter le schéma | compatibilité ancienne/nouvelle détecte la perte silencieuse |
| retirer `report` de l'union de schéma | fixture v9 et round-trip échouent |
| ne pas collecter `pageReport.value` | catalogue de chemins perd la donnée externe |
| évaluer une contribution dans la portée racine | groupe répété refuse l'alias ou rend un mauvais total |
| évaluer la contribution à chaque page | compteur d'évaluation dépasse le nombre d'occurrences |
| accepter une chaîne comme contribution | refus typé attendu disparaît |
| sommer dans l'ordre du DOM | cas de cellules parallèles ou de reprise diverge de l'ordre stable |
| compter une ligne sur son fragment `first` | ligne surdimensionnée apparaît trop tôt dans le report |
| compter aussi l'en-tête répété | report augmente à chaque page sans nouvelle ligne de corps |
| ne pas arrondir le cumul | demi-valeur diffère du mode déclaré |
| recopier un arrondi dans `engine` et le faire diverger | oracle partagé C2/E3 rougit |
| réserver la largeur naturelle du report courant | cas limite rogne ou change une coupure |
| ignorer `clippedMarkerCount` | document volontairement rogné passe la vérification finale |
| ignorer `keepTogether` dans l'espace courant | bloc inutilement déplacé |
| ne pas essayer la page neuve | bloc satisfaisable est coupé |
| ne pas replier un bloc surdimensionné | boucle, page vide ou refus neuf |
| aplatir une boucle marquée | deux enfants d'une itération sont séparés |
| grouper toutes les itérations | document reporté ou replié comme un bloc géant |
| perdre les marques descendantes au repli | ligne de total marquée se coupe |
| appliquer `keepTogether` à une bande | refus `page-band-overflow` est remplacé ou la bande est déplacée |
| supprimer le minimum bas de deux lignes | une orpheline apparaît |
| supprimer le minimum haut de deux lignes | une veuve apparaît |
| refuser quand 2/2 est impossible | cas de repli ne termine plus en succès |
| peindre `lastOnly` sur toutes les pages | mentions apparaissent avant la dernière |
| réserver le grand pied seulement sur la page finale | sonde d'oscillation change les coupures |
| réserver un nom de donnée dans le moteur | balayage de périmètre rougit |
| omettre un `await` de mesure, impression ou fermeture | tests de cycle de vie rougissent |

---

## 12. Définition de fini

E3 est fini lorsque toutes les assertions suivantes sont vraies ensemble :

- le contrat du report est Zod-first, versionné et migré ;
- aucun nom ou schéma de donnée hôte n'a été introduit ;
- les contributions sont évaluées une fois, dans leur portée locale ;
- les reports entrants correspondent aux lignes réellement achevées avant chaque page ;
- leur arrondi suit exactement `decimals` et `mode` du marqueur ;
- aucun marqueur ne peut être rogné silencieusement ;
- les huit kinds satisfont la politique ordonnée de `keepTogether` ;
- les occurrences de boucle et de groupe sont traitées séparément ;
- une marque descendante survit au repli d'un parent ;
- les textes respectent 2/2 lorsque possible et terminent sinon ;
- les mentions et le paiement du modèle n'apparaissent que sur la dernière page ;
- la facture de 60 lignes produit trois pages dans la recette Chromium ;
- les factures courtes E1 et le scénario E2 restent verts ;
- le PDF imprimé est le HTML de la dernière mesure ;
- les ablations sont rouges puis retirées ;
- la recette visuelle est consignée ;
- la validation métier est consignée ou son absence est déclarée ;
- l'ADR d'exécution remplace ce plan ;
- les quatre portes passent dans l'ordre avec au moins 90 % sur les quatre métriques ;
- aucun fichier protégé par `AGENTS.md` §7, aucun manifeste et aucune dépendance n'a changé.

E3 ne suffit pas à cocher J3 : le jalon exige aussi français/euros puis anglais/dollars, propriété
de E4. La roadmap moteur peut annoncer E3 livré ; la vue d'ensemble doit laisser J3 ouvert.

---

## 13. Risques et réponses prévues

### Le contrat de report pourrait être trop étroit

Il couvre une contribution par ligne de corps et un seul cumul. C'est exactement le document de
référence et cela évite une table de noms, des références croisées et une sémantique de bloc
arbitraire. Signal de réouverture : un modèle réel demande deux cumuls indépendants ou un report
hors tableau. La réponse sera un lot `core` versionné, pas une convention cachée dans `engine`.

### La réserve de 25 caractères peut laisser un blanc visible

C'est le coût d'une géométrie indépendante du report. La facture place le marqueur en fin de ligne
ou dans une cellule alignée pour rendre la réserve naturelle. La réduire exige une preuve majorante
plus fine ; elle ne doit jamais être remplacée par une boucle de point fixe non bornée.

### Le wrapper synthétique peut affecter le layout

P1 est bloquante. Si Chromium montre un écart, un fragment de groupe transparent est introduit ; le
lot n'accepte pas « assez proche » sur une décision de coupe.

### Les préférences peuvent entrer en concurrence

L'ordre est fixe : bloc entier `keepTogether`, puis repli ordinaire ; dans le texte ordinaire,
préférence 2/2 puis repli de progression. Les contraintes ne sont jamais optimisées globalement et
n'ont aucune priorité numérique.

### Une ligne contributrice peut être fragmentée

La contribution est comptée au fragment final. Cette règle est déterministe, observable dans les
tests et ne double jamais un montant. Une autre convention demanderait un champ indiquant où le
montant « vit » dans la ligne ; ce champ est refusé tant qu'aucun besoin réel ne l'exige.

### La bande finale réduit la capacité de toutes les pages

C'est la parade déjà décidée contre l'oscillation. Le coût en pages est accepté et rendu visible
par la recette de trois pages. Une réserve variable par rang ne doit pas revenir sous couvert
d'optimisation.

### E4 changera la longueur des reports

E4 doit reprendre la réservation avec les chaînes formatées et leurs glyphes réels. E3 laisse un
test de rognage générique dans le port de mesure : même si la future borne est fausse, le PDF sera
refusé plutôt que tronqué.

### La somme IEEE-754 dépend de l'ordre

L'ordre de matérialisation est explicite et stable. E3 n'introduit pas une représentation décimale
ni une somme associative fictive ; le modèle déclare l'arrondi visible. Le déterminisme
multi-machine et les documents figés restent respectivement à E6 et E7.

---

## 14. Contrôle de périmètre avant exécution

1. préserver tout changement utilisateur du worktree ;
2. confirmer que l'ADR 0014 et la version 9 sont libres ;
3. relire tout amendement aux ADR 0004, 0005, 0006, 0009, 0012 et 0013 ;
4. confirmer que E3 demande toujours un report entrant, pas une paire entrant/sortant ;
5. confirmer que `PAGE_FIELDS` vaut encore `number | count` et que `TableRowNode` ne porte aucune
   contribution concurrente ;
6. confirmer que l'adaptateur mesure toujours les lignes, boîtes et régions sous une session unique ;
7. lancer les quatre portes sur la baseline ;
8. exécuter P1 à P7 avant d'écrire la politique correspondante ;
9. refuser toute proposition qui inspecte un nom de donnée, de colonne ou un texte imprimé ;
10. ne pas ajouter de dépendance, Port, format de sortie ou résultat public de pagination ;
11. ne pas modifier les configs, la CI ou les seuils pour faire passer le lot ;
12. arrêter et faire arbitrer toute demande de conformité légale, de second accumulateur, de saut
    de page ou de seuil configurable : elle change le contrat et le périmètre de ce plan.
