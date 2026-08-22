# Plan d'implémentation — `@openview/engine` lot E2 : le tableau déborde proprement

> **Statut :** prêt à exécuter, non livré.
>
> **Baseline relevée le 2026-08-21 :** E1 est livré et fait foi par l'[ADR 0012](../adr/0012-une-facture-d-une-page-sort-en-pdf.md).
> `@openview/engine` valide, matérialise, construit un HTML fermé et délègue l'impression à
> `@openview/adapter-puppeteer`; l'adaptateur mesure une feuille explicite puis refuse tout
> débordement sous le code `single-page-overflow`. Le schéma stocké est toujours en version **8**.
> La dernière ADR est 0012 : l'ADR d'exécution d'E2 prendra donc le prochain numéro libre,
> **0013 si la baseline n'a pas changé**.
>
> **Date :** 2026-08-21 · **Briques principales :** `@openview/engine` et
> `@openview/adapter-puppeteer` · **Dépend de :** E1 · **Poids roadmap :** L

---

## 0. Résultat attendu

La [roadmap moteur](../roadmap/engine.md#e2-le-tableau-déborde-proprement) demande le premier
document réellement paginé d'Openview. Une facture de **soixante lignes** doit produire **quatre
pages** lisibles, à la feuille déclarée, avec les quatre propriétés suivantes ensemble :

1. le flux passe d'une page à la suivante sans perte, duplication, réduction ni découpe arbitraire ;
2. la bande haute et la bande basse applicables sont répétées selon leur domaine
   (`every`, `firstOnly`, `exceptFirst`, `exceptLast`, `lastOnly`) ;
3. chaque fragment d'un tableau qui déclare un en-tête répète la section `header`, tandis que la
   section `footer` du tableau reste à la fin du tableau ;
4. chaque `pageField` reçoit le numéro de sa page et le nombre total de pages : la quatrième feuille
   affiche bien la valeur correspondant à « page 4 / 4 » dans le libellé que le modèle a écrit.

E2 remplace le refus mono-page d'E1 par une pagination explicite. Chromium ne reçoit jamais un long
flux en étant chargé d'en deviner les coupures : le moteur décide des fragments, reconstruit une
suite de boîtes de page explicites, puis l'adaptateur vérifie et imprime cette suite.

Le lot reste plus étroit qu'E3. Il ne calcule aucun report, n'ajoute aucune mention de dernière
page, ne met en œuvre aucun seuil de veuve ou d'orpheline et n'accorde encore aucun comportement
spécial à `keepTogether`. Il construit toutefois les primitives exactes dont E3 aura besoin : des
fragments nommés, des lignes visuelles mesurées, des coupures déterministes et un moteur qui avance
ou refuse sans boucle.

---

## 1. État du dépôt et écart à combler

### 1.1 Ce qu'E1 livre déjà

E2 étend les décisions exécutées d'E1 ; il ne les réécrit pas.

| Besoin d'E2 | Baseline livrée | Règle de réemploi |
| :--- | :--- | :--- |
| Frontière d'entrée | `validateTemplate()` appelle `parseTemplate()` avec les limites de forme | parser une fois ; aucune validation du jeu de données hôte |
| Liaison | `materializeDocument()` évalue boucles, conditions, groupes et liaisons avec un budget partagé | conserver un seul budget par document et ne jamais réévaluer une occurrence pour chaque page |
| Représentation interne | `MaterialDocument`, `MaterialBlock`, `MaterialTable`, `MaterialRow` | l'étendre en types internes ; aucun schéma, aucune persistance, aucune exposition publique |
| Apparence | typographies résolues, boîtes, colonnes, filets adjacents, images | préserver les conventions de l'ADR 0012, notamment les ombres insérées et `mmFromPt` |
| HTML sûr | vocabulaire fermé, échappements distincts, CSP, sérialisation ordonnée | toutes les feuilles de mesure et le document final passent par le même constructeur fermé |
| Feuille | une `.ov-page`, une `.ov-printable`, trois régions, `@page` déclaré | produire plusieurs `.ov-page` explicites de mêmes dimensions |
| Mesure Chromium | `measureInPage()` lit feuille, régions, images et débordements | transformer la mesure terminale en capacité de session utilisable avant l'impression |
| Adaptateur | une stratégie Puppeteer séparée, réseau coupé, JavaScript du document désactivé | Puppeteer reste entièrement hors d'`engine`; une seule session navigateur par rendu |
| Refus | `DocumentRenderError`, dix codes et détails sûrs à journaliser | remplacer le refus mono-page par des refus de pagination précis, sans valeur liée dans les messages |
| Sortie | `createPdfRenderPort()` retourne un `RenderResult` PDF | conserver cette façade et le couple `pdf` / `application/pdf` |

Le contrat stocké ne change pas. E2 n'ajoute ni champ, ni kind, ni valeur persistée :
`CURRENT_SCHEMA_VERSION` reste **8** et aucune migration 8→9 n'est écrite.

### 1.2 Ce qui est mono-page aujourd'hui

Les quatre verrous suivants sont explicites dans le code actuel :

- `materializeDocument()` choisit `bandOfTheOnlyPage()` et remplace tous les marqueurs par la table
  fixe `{ number: '1', count: '1' }` ;
- `MaterialDocument` ne contient qu'un `header`, un `root` et un `footer`, sans notion de page ni de
  fragment ;
- `buildHtmlTree()` construit une unique boîte `.ov-page` avec `overflow: hidden` ;
- `assertFits()` transforme tout dépassement de région ou de feuille en
  `single-page-overflow` avant `page.pdf()`.

E2 doit retirer ces quatre hypothèses ensemble. En retirer une seule produirait soit un PDF
tronqué, soit des bandes fausses, soit une numérotation fausse, soit une coupure abandonnée à
Chromium.

### 1.3 Les dettes transmises nommément à E2

| Dette | Source qui fait foi | Réponse exigée dans E2 |
| :--- | :--- | :--- |
| Répéter la section `header` d'un tableau | ADR 0005 D4 et conséquences ; ADR 0009 D7 | chaque fragment non vide du tableau reprend toutes ses lignes d'en-tête, sans drapeau nouveau |
| Garder le pied du tableau en fin de flux | ADR 0005 D9 | le `footer` n'est jamais répété et suit la dernière ligne du corps |
| Paginer un tableau imbriqué | ADR 0005 D5 | une ligne trop haute à cause du contenu de ses cellules se fragmente par flux de cellule ; un tableau interne répète aussi son propre en-tête |
| Répéter les bandes de page | ADR 0006 D6 | sélectionner une bande par côté et par rôle de page, sans empilement implicite |
| Substituer `number` et `count` | ADR 0006 D7 | conserver le marqueur jusqu'à la composition des pages puis écrire les valeurs canoniques |
| Éviter l'oscillation des bandes de fin et des numéros | ADR 0006, conséquences | réserver sur toutes les pages la hauteur maximale applicable de chaque côté et une largeur de marqueur indépendante du rang réel |
| Refuser une bande impossible | ADR 0006 et ADR 0009 D5 | une bande reste atomique ; elle n'est ni coupée, ni reportée, ni mise en boucle |
| Décider la décoration au point de coupe | ADR 0007, attente moteur 1 | fermer chaque fragment : fond, padding et filets sont clonés sur chaque boîte fragmentée |
| Conserver la règle des filets aux nouvelles frontières | ADR 0007 attente 6 et ADR 0012 D-4/D-5 | recalculer les frontières sur chaque fragment final, jamais copier les ombres calculées avant coupe |
| Refuser une ressource atomique surdimensionnée | ADR 0009 E1/E2-5 | comparer l'image à la hauteur réelle réservée au flux d'une page admissible |
| Préparer, sans livrer, l'observabilité | roadmap E5 ; ADR 0009 D3/D5 | utiliser une clé d'occurrence interne à un rendu, sans en faire encore un résultat public |

### 1.4 La phrase « ligne orpheline » de la roadmap

Le critère E2 dit qu'aucune page ne commence « par une ligne orpheline ou un tableau sans
en-tête ». L'ADR 0009 tranche ensuite plus précisément :

- la répétition effective de l'en-tête appartient à **E2** ;
- les veuves, orphelines et nombres minimaux de lignes avant ou après une coupe appartiennent à
  **E3**.

E2 lit donc « ligne orpheline » au sens structurel : aucune ligne de continuation n'est détachée de
la section `header` déclarée par son tableau. E2 autorise encore une page qui ne porte qu'une ligne
de corps après cet en-tête. Imposer deux lignes, trois lignes ou un seuil typographique serait
préempter E3 et contredire l'ADR qui fait foi.

Un tableau dont `header` est vide reste licite. Le moteur n'invente aucun intitulé, ne réserve aucun
nom de colonne et ne refuse pas un modèle générique au motif que la facture de recette, elle,
déclare un en-tête. La garantie est conditionnelle : **si le modèle porte un en-tête, chaque
fragment le répète**.

---

## 2. Périmètre fermé

### 2.1 Inclus dans E2

- matérialiser les cinq domaines de bandes sans évaluer plusieurs fois une déclaration répétée ;
- conserver `pageField` comme marqueur interne jusqu'à la page finale ;
- construire une suite de pages explicites, toutes à la feuille et aux marges du modèle ;
- réserver une hauteur haute et basse stable sur toutes les pages ;
- couper un flux entre blocs frères ;
- couper un `TextNode` entre deux lignes visuelles mesurées, sans perte de run ni de caractère ;
- garder une image atomique, la reporter sur une page neuve ou la refuser si aucune page ne peut la
  contenir ;
- fragmenter un conteneur entre ses enfants et cloner sa décoration par fragment ;
- fragmenter un tableau entre ses lignes, répéter son en-tête et ne placer son pied qu'à la fin ;
- garder une ligne ordinaire entière dès qu'elle tient sur une page neuve ;
- fragmenter une ligne qui ne tient sur aucune page neuve en coordonnant les flux de ses cellules,
  afin de prendre en charge un tableau imbriqué ;
- recalculer les filets de table par fragment ;
- substituer le numéro et le compte dans les bandes comme dans le flux racine ;
- vérifier chaque page finale dans Chromium avant d'imprimer ;
- faire produire quatre pages à la facture de soixante lignes, dans l'adaptateur et dans le
  playground ;
- documenter les décisions exécutées dans l'ADR E2 et marquer le lot livré dans la roadmap.

### 2.2 Exclus, avec leur propriétaire

| Exclu d'E2 | Motif | Propriétaire |
| :--- | :--- | :--- |
| total reporté de page en page | seul calcul dépendant du point de coupe ; l'arrondi et l'échelle doivent rester déclarés | E3 |
| politique spéciale de `keepTogether` | E2 transporte la marque mais n'ordonne pas encore le report/repli par occurrence | E3 |
| seuils de veuve/orpheline, minimum de lignes | exigent une politique comptable/typographique distincte | E3 |
| mentions et cadre de paiement sur dernière page | responsabilité métier de composition finale | E3 |
| formatage localisé des marqueurs de page | E2 produit des entiers canoniques ; le choix du site de format appartient au rendu localisé | E4 |
| résultat public de pagination et identité stable inter-rendus | E2 ne renvoie toujours que les octets PDF | E5 |
| police embarquée et égalité multi-machine | les mesures restent celles de la session Chromium courante | E6 |
| golden masters PDF | E2 ajoute une recette ciblée, pas le corpus figé complet | E7 |
| nombre maximal de pages configurable, timeout, mémoire, concurrence, réseau distant | durcissement d'un document hostile | E8 |
| saut de page manuel, `keepWithNext`, priorité de coupe | demanderaient un champ stocké, une estampille et un lot `core` mandaté | hors E2 |
| en-tête synthétisé pour un tableau qui n'en déclare pas | réserverait une structure et un vocabulaire à l'intégrateur | interdit |
| HTML ou image comme résultat public | la roadmap v1 reste PDF-only | hors v1 |

### 2.3 Ce qu'E2 fait de `keepTogether`

La propriété reste copiée dans la représentation matérialisée afin qu'E3 ne doive pas refaire la
liaison. Elle n'influence pas la coupure E2.

La politique ordinaire d'E2 est néanmoins prudente par nature : une image et une ligne de tableau
qui tiennent sur une page neuve ne sont pas coupées. Pour les nœuds fragmentables — texte,
conteneur, tableau — E2 utilise l'espace courant et coupe à son prochain point légal. Il ne reporte
pas tout le nœud sur une page neuve simplement parce que `keepTogether: true` est présent. C'est
précisément la différence que la politique ordonnée d'E3 introduira.

---

## 3. Décisions d'architecture

### D1 — La coupure appartient au moteur ; Chromium fournit des mesures

Le moteur construit et choisit les fragments. L'adaptateur fournit les métriques que seul un
navigateur réel connaît : hauteurs de boîtes, lignes visuelles, dimensions intrinsèques des images
et constat de débordement.

Chromium ne reçoit jamais le long document final avec mission de le paginer par ses règles CSS.
Cette délégation serait irréversible pour E5 : le moteur ne pourrait pas expliquer une coupe qu'il
n'a ni représentée ni choisie. Elle rendrait aussi `lastOnly`, les marqueurs dans le flux et les
tableaux imbriqués dépendants de comportements d'impression non observables depuis le DOM écran.

Le partage est donc :

```text
engine                                      adapter-puppeteer
  matérialise                                 ouvre une session Chromium
  propose un fragment sûr            ──────► mesure ses boîtes et ses lignes
  choisit/reconstruit les pages       ◄────── renvoie des nombres + curseurs opaques
  bâtit le HTML paginé final          ──────► vérifie, puis imprime une seule fois
```

L'adaptateur ne reçoit toujours ni jeu de données, ni modèle, ni AST. Chaque sonde est un document
HTML fermé et échappé construit par le moteur.

### D2 — Une session de rendu remplace l'appel d'impression sans état

Le contrat de stratégie E1, `render(source): Promise<Uint8Array>`, est insuffisant : E2 doit mesurer
plusieurs candidats puis imprimer le seul document final **dans le même environnement de fontes et
d'images**.

La surface cible est conceptuellement :

```ts
export interface PdfRenderResources {
  readonly sheet: Sheet;
  readonly images: readonly DocumentImage[];
}

export interface PdfLayoutMeasurement {
  readonly page: BoxMeasurement;
  readonly printable: BoxMeasurement;
  readonly regions: readonly RegionMeasurement[];
  readonly boxes: readonly LayoutBoxMeasurement[];
  readonly lines: readonly TextLineMeasurement[];
  readonly images: readonly ImageMeasurement[];
  readonly escaping: readonly string[];
}

export interface PdfRenderSession {
  measure(document: PdfSourceDocument): Promise<PdfLayoutMeasurement>;
  print(document: PdfSourceDocument): Promise<Uint8Array>;
  close(): Promise<void>;
}

export interface PdfRenderStrategy {
  readonly format: 'pdf';
  open(resources: PdfRenderResources): Promise<PdfRenderSession>;
}
```

Ces noms et ces quatre responsabilités constituent la cible d'INC-1 : ouverture unique, mesure
répétable, impression unique, fermeture attendue dans un `finally`. Une correction imposée par une
sonde est enregistrée comme écart explicite dans l'ADR E2 ; elle ne devient pas un renommage de
convenance pendant l'implémentation.

`createPdfRenderPort()` reste la façade de l'intégrateur. Le changement porte sur le contrat entre
le moteur et son adaptateur réel, pas sur `RenderRequest`, `RenderResult` ou `RenderPort`.

### D3 — Un navigateur, un contexte et une page par rendu

`createPuppeteerPdfStrategy().open()` :

1. vérifie la feuille et toutes les sources d'image avant `puppeteer.launch()` ;
2. lance un navigateur et crée un contexte puis une page ;
3. désactive JavaScript du document et installe l'interception réseau une fois ;
4. réutilise cette page pour chaque `measure()` puis pour `print()` ;
5. ferme page, contexte et navigateur dans `close()`.

Tous les appels asynchrones sont `await`. La session n'est jamais partagée entre deux rendus. Le
pooling et la concurrence restent à E8 ; E2 ne transforme pas une nécessité de cohérence métrique en
abstraction de performance.

### D4 — Le Pipeline gagne une étape, sans devenir une Chain of Responsibility

L'ordre E2 est :

```text
RenderRequest
  → ValidationStep
  → DataBindingStep
  → PaginationStep
  → DomBuildStep
  → SanitizeStep
  → PdfExportStep
  → RenderResult
```

`PaginationStep` peut construire et sérialiser des pages-sondes par les mêmes fonctions fermées que
le document final. Cela ne supprime ni `DomBuildStep` ni `SanitizeStep` : la dernière construction
porte la suite complète des pages et la dernière sérialisation est celle qui part à l'impression.

Une étape ne retourne jamais un résultat partiel. Une mesure impossible ou incohérente lève une
erreur typée ; le pipeline ne saute pas silencieusement à l'impression.

### D5 — Une clé d'occurrence interne, jamais un identifiant public E5 anticipé

Les `id` du modèle ne sont pas uniques entre deux itérations et ne le sont pas globalement dans le
template. E2 attribue donc, pendant une matérialisation, une clé opaque et unique à chaque
occurrence et à chaque sous-position mesurable.

Cette clé :

- est dérivée d'un compteur local au rendu et ne lit ni horloge ni aléa ;
- sert seulement à relier une demande de mesure à sa réponse et à annoter le DOM interne ;
- n'est ni persistée, ni exportée dans `RenderResult`, ni promise stable entre deux rendus ;
- ne remplace pas le `path` de diagnostic et ne devient pas `(id, rang local)`.

E5 choisira l'identité publique avec toute l'ascendance d'itération. E2 lui laisse les fragments et
les curseurs nécessaires, mais ne fige pas en passant un contrat insuffisant.

### D6 — Les marqueurs de page survivent à la liaison

`MaterialRun` devient une union fermée : texte déjà lié ou marqueur de page typographié. Aucun
`pageField` n'est converti en chaîne dans `materializeDocument()`.

La substitution intervient quand une page finale possède :

- son rang 1-based ;
- le nombre total de pages ;
- la typographie déjà résolue du run.

Les valeurs E2 sont des entiers décimaux canoniques, sans `Intl`, locale, séparateur ou chiffre
inventé. E4 branchera le format déclaré sans changer le calcul du rang.

Un marqueur est licite dans une bande, une cellule ou le flux racine. Si un `TextNode` est
fragmenté, le marqueur est substitué selon la page qui contient effectivement ce run.

### D7 — La géométrie d'un marqueur ne dépend pas de sa valeur réelle

Un pied qui passe de `9` à `10` ne doit pas modifier la coupure qui détermine justement le nombre de
pages. E2 réserve à chaque marqueur une boîte en ligne capable de contenir toute valeur de page
possible pour le document matérialisé.

La borne de pages est calculée avant la pagination à partir des unités de progression disponibles :
caractères de texte matérialisés, blocs atomiques et positions structurelles. Une page réussie doit
en consommer au moins une ; le nombre de pages ne peut donc pas dépasser cette somme finie.

Dans la session Chromium, une sonde choisit le chiffre décimal le plus large pour chaque signature
typographique et mesure une réserve sur le nombre de chiffres de cette borne. Le HTML final place
la valeur réelle dans une boîte de cette largeur, avec crénage neutralisé pour le marqueur seul. Il
ne choisit ni famille ni taille nouvelles.

INC-0 doit prouver sur `0..9`, `9→10`, `99→100` et deux typographies que :

- aucune valeur admissible n'excède la réserve ;
- la hauteur du bloc ne change pas quand seule la valeur réelle change ;
- le texte visible reste sélectionnable et présent dans le PDF ;
- aucun `Intl.*`, `Date`, locale hôte ou mesure Node n'entre dans `engine`.

Si la boîte en ligne proposée échoue une de ces quatre portes, la solution de repli est une largeur
en pixels explicitement renvoyée par la session pour la même typographie — jamais une boucle de
pagination cherchant un point fixe.

### D8 — Les bandes occupent deux réserves constantes sur toutes les pages

Pour un document multi-page, E2 matérialise chaque déclaration de bande applicable **une fois**,
mesure son contenu avec la réserve de marqueurs D7, puis prend :

```text
headerReserve = max(hauteur de toute bande haute pouvant apparaître)
footerReserve = max(hauteur de toute bande basse pouvant apparaître)
rootHeight     = printable.height - headerReserve - footerReserve
```

Les deux réserves sont identiques sur toutes les pages. Une bande plus courte ne donne pas plus de
place au flux : elle laisse du blanc dans son slot. La bande haute s'aligne en haut, la bande basse
en bas. Ainsi, transformer une page supposée dernière en page intermédiaire ne modifie jamais la
hauteur offerte au flux.

Le moteur commence par matérialiser les bandes applicables au cas d'une page. Si la coupure produit
plus d'une page, il matérialise les bandes complémentaires de la forme multi-page, les ajoute aux
maxima, puis recommence une fois depuis le début. Une bande évaluée lors du cas une page reste
applicable sur au moins une page du cas multi-page ; aucune expression d'une bande finalement
invisible n'est évaluée par spéculation.

La transition une page → plusieurs pages est monotone : ajouter une bande ou agrandir une réserve
ne peut pas refaire tenir le document sur une page. Il n'existe donc ni oscillation ni nombre
arbitraire de passes.

### D9 — Une bande est atomique et n'entre jamais dans le flux paginé

Une bande est mesurée comme un tout après liaison des données.

- si une bande dépasse à elle seule l'aire imprimable, refus `page-band-overflow` avec `region` ;
- si les deux réserves dépassent ensemble l'aire imprimable, même famille de refus ;
- si elles la remplissent exactement, un document sans flux peut sortir, mais le premier contenu
  du flux déclenche un refus de pagination faute de hauteur admissible ;
- `keepTogether` sur le conteneur de bande ne modifie rien : une bande est déjà atomique par sa
  nature de région.

Le moteur ne coupe, ne réduit, n'empile et ne reporte jamais une bande. C'est la condition de
terminaison léguée par les ADR 0006 et 0009.

### D10 — Une page est un fragment explicite, fermé et vérifié

Le document final contient une suite de `.ov-page`. Chaque page porte :

- les dimensions exactes de `Template.page.sheet` ;
- une `.ov-printable` calculée par `printableAreaOf()` ;
- un slot haut de `headerReserve` ;
- un flux racine de `rootHeight` ;
- un slot bas de `footerReserve` ;
- la bande applicable et la valeur de ses marqueurs ;
- un attribut interne de rang, choisi par le moteur et jamais lu depuis les données.

Une règle de rupture force une page PDF par boîte et n'en ajoute aucune après la dernière. Chaque
boîte garde `overflow: hidden` comme dernière barrière, mais `print()` n'est appelé qu'après une
mesure finale qui a prouvé l'absence de débordement.

### D11 — La politique de coupure est gloutonne, structurée et garantit un progrès

À chaque page, E2 prend le plus long préfixe du flux qui tient, en respectant les points de coupe du
kind. Il ne compare jamais deux mises en page selon une préférence esthétique et n'utilise aucun
aléa.

Lorsqu'un candidat dépasse :

1. le dernier ajout est retiré ;
2. si le kind possède un point de coupe interne, le moteur descend vers ce point ;
3. si le kind est atomique et que la page contient déjà du flux, il ferme la page et réessaie sur
   une page neuve ;
4. si le plus petit fragment légal ne tient pas sur une page neuve, il refuse ;
5. une page n'est validée que si son curseur de flux a strictement avancé.

La dernière règle est mécanique : un tour qui reproduit le même curseur lève
`pagination-impossible`; il ne réessaie jamais indéfiniment. Avec un nombre fini d'unités de
progression et une avance stricte, la pagination termine sans `maxPasses` arbitraire. Les plafonds
de temps et de pages d'un service hostile restent à E8.

### D12 — Les points de coupe ordinaires sont définis par kind

| Kind matérialisé | Point de coupe E2 | Plus petit fragment légal |
| :--- | :--- | :--- |
| `text` | entre deux lignes visuelles mesurées | une ligne complète |
| `image` | aucun | l'image entière |
| `container` | entre deux enfants ; descente dans un enfant trop grand | un fragment légal de l'enfant |
| `table` | entre deux lignes du corps ou du pied ; descente dans une ligne trop grande | en-tête complet + un fragment de ligne, ou table finale vide licite |
| `tableRow` | atomique si elle tient sur une page neuve ; sinon flux coordonnés de cellules | un fragment d'au moins une cellule qui avance |

Les boucles, conditions et groupes de lignes ont déjà disparu comme instructions : leurs
occurrences matérialisées portent les clés et chemins nécessaires. Aucune expression n'est
réévaluée pendant la recherche d'une coupe.

### D13 — Le texte se coupe aux lignes observées, jamais à un indice deviné

La sonde HTML annote chaque run d'un texte par une clé interne. Chromium renvoie, pour chaque ligne
visuelle, un curseur de fin composé d'un rang de run et d'un offset UTF-16 dans le texte que le
moteur possède déjà. Il ne renvoie jamais le texte lié lui-même.

Le moteur tranche uniquement aux curseurs observés. La concaténation des fragments doit restituer
exactement la suite des runs d'origine : mêmes caractères, même ordre, mêmes typographies, mêmes
marqueurs.

INC-0 est bloquant sur :

- `white-space: pre-wrap`, espaces de tête et de fin ;
- ligne vide créée par `\n\n` ;
- passage d'un run typographique à l'autre au milieu d'une ligne ;
- paire de substitution Unicode, accent combiné et séquence emoji ZWJ ;
- marqueur `pageField` entre deux littéraux ;
- texte justifié dont seule la dernière ligne reste à `start`.

Le test d'ablation reconstruit `textContent` avant/après et exige l'égalité exacte. E2 n'appelle pas
`Intl.Segmenter`, n'invente pas de césure et ne coupe jamais au milieu d'un curseur que Chromium a
présenté comme une même ligne.

### D14 — Une ligne de tableau est atomique tant qu'une page neuve peut la contenir

Une ligne qui dépasse l'espace restant passe entière à la page suivante si elle y tient avec
l'en-tête répété. C'est la politique ordinaire du kind, licite même sans `keepTogether` selon l'ADR
0009 D6.

Une ligne plus haute que toute page neuve ne boucle pas. E2 fragmente alors les flux verticaux de
ses cellules :

- toutes les cellules gardent leur colonne et leur largeur ;
- chaque cellule consomme le plus long préfixe qui tient dans la hauteur interne disponible ;
- les cellules déjà terminées restent présentes mais vides dans les fragments suivants ;
- la hauteur du fragment de ligne est celle de la cellule la plus haute ;
- au moins une cellule doit avancer ;
- la décoration de ligne est clonée sur chaque fragment.

Cette règle est ce qui rend réellement paginable un tableau imbriqué. Un tableau interne suit D15
dans sa cellule ; son en-tête se répète sur chaque fragment où il continue. Les autres cellules de
la ligne extérieure ne sont ni répétées ni inventées : leur contenu apparaît une seule fois, puis
la cellule conserve seulement sa place.

### D15 — L'en-tête se répète, le pied termine, et les filets sont recalculés

Pour chaque fragment d'un tableau :

- toutes les lignes de `header` sont clonées avant le contenu continué ;
- aucune ligne de `footer` n'est clonée par répétition ; les lignes du pied suivent le corps et
  peuvent passer à une page suivante entre deux lignes ;
- un fragment ne contient jamais seulement un en-tête répété sans consommer une unité nouvelle du
  corps ou du pied ;
- si l'en-tête complet ne tient pas avec le plus petit fragment suivant sur une page neuve, le
  moteur refuse au lieu de produire des pages d'en-tête en boucle ;
- un tableau vide licite reste rendu une fois, avec son éventuel en-tête et son pied.

`resolveRowRules()` est appelé **après** la coupe, sur la séquence exacte de chaque fragment :
en-tête répété, lignes présentes, pied éventuel. Une frontière située entre deux pages n'est plus
une frontière adjacente. Chaque fragment reprend le périmètre de table ; égalité et largeur restent
régies par l'ADR 0012. Les ombres calculées sur le tableau continu ne sont jamais copiées telles
quelles.

### D16 — Toute boîte fragmentée est fermée sur chaque page

Un `text`, un `container`, un `table` ou une `tableRow` scindé produit plusieurs boîtes complètes.
Sur chaque fragment :

- le fond est peint sur toute la boîte du fragment ;
- le padding des quatre côtés est repris ;
- les quatre filets déclarés sont repris selon les règles de conflit du contexte final.

Cette convention correspond à une décoration clonée, pas à une boîte ouverte dont le fond virtuel
continuerait derrière la page suivante. Elle est volontairement simple à expliquer et vérifiable
dans le PDF : chaque page porte un fragment autonome. Son coût — padding haut et bas répété, donc
moins de lignes par page — est inclus dans la mesure réelle et accepté.

V3 devra reproduire la même convention pour tenir la promesse aperçu/PDF. E2 l'enregistre dans son
ADR afin que le viewer ne la redécouvre pas.

### D17 — Les mesures sont finies, complètes et attribuables

Une réponse de session est refusée avant d'entrer dans l'algorithme si :

- un nombre est `NaN`, infini ou négatif là où une longueur ne peut pas l'être ;
- une clé demandée manque, apparaît deux fois ou revient sans avoir été demandée ;
- un curseur de ligne sort des runs connus ou recule ;
- une dimension de feuille/zone ne correspond pas à la sonde dans la tolérance E1 ;
- une image n'est pas décodée ;
- un nœud peint hors de la feuille candidate.

Le refus `layout-measurement-failed` transporte uniquement un `nodeId`, un `path`, une `region` ou
une borne sûre lorsqu'ils existent. Ni HTML, ni texte lié, ni source d'image, ni réponse brute de
l'adaptateur ne rejoint le message.

Ces types sont des contrats éphémères entre deux paquets du dépôt, construits et consommés dans une
seule session. Ils ne sont ni stockés ni acceptés depuis JSON ; ils ne portent donc ni Zod ni
`schemaVersion`, comme `MaterialDocument` et `PdfSourceDocument` en E1. Les gardes numériques sont
néanmoins obligatoires parce qu'un adaptateur est un port remplaçable.

### D18 — Trois refus remplacent l'ambiguïté `single-page-overflow`

E2 retire `single-page-overflow` des sites de production : un document long n'est plus une erreur.
Le catalogue distingue :

| Code | Sens |
| :--- | :--- |
| `page-band-overflow` | une bande ou la somme des réserves rend la page structurellement impossible |
| `pagination-impossible` | aucun plus petit fragment légal du flux ne tient ou aucun progrès n'est possible |
| `layout-measurement-failed` | la session n'a pas pu fournir une mesure complète et cohérente |

`oversized-atomic-resource` reste le refus d'une image entière trop haute pour la zone racine
admissible. `pdf-export-failed` reste réservé à l'impression finale ; une erreur de mesure ne doit
pas être renommée « export » alors qu'aucun PDF n'a été demandé.

Le type de détails gagne au plus `pageNumber?: number | undefined`, sans valeur de rendu.
`single-page-overflow` est retiré du tuple public et de son type : avant 1.0, conserver un code mort
qui décrit une politique supprimée rendrait le catalogue mensonger. L'ADR E2 nomme cette rupture
du contrat de stratégie et du catalogue ; aucun alias silencieux ne transforme un refus E2 neuf en
ancien refus mono-page.

### D19 — Aucune dépendance et aucun contrat `core` nouveaux

E2 utilise Puppeteer déjà isolé dans l'adaptateur et `pdf-lib` déjà présent pour les tests. Il
n'ajoute ni moteur de layout, ni bibliothèque de césure, ni templating, ni serveur, ni parseur PDF.

Les fichiers `package.json`, `pnpm-workspace.yaml`, `tsconfig*`, Biome, Turbo, Vitest, CI et seuils
de couverture sortent du lot inchangés. Si INC-0 démontre qu'une dépendance est indispensable, le
lot s'arrête pour mandat explicite : le plan n'autorise pas une exception supply-chain implicite.

---

## 4. Représentations internes cibles

### 4.1 Document matérialisé avant pagination

La représentation interne doit distinguer trois choses qui sont confondues en E1 : les bandes
déclarées, le flux et les pages produites.

```ts
interface MaterialPageBand {
  readonly on: PageBandOccurrence;
  readonly content: MaterialContainer;
}

type MaterialRun = MaterialTextRun | MaterialPageFieldRun;

interface MaterialPageFieldRun {
  readonly kind: 'pageField';
  readonly field: PageField;
  readonly typography: ResolvedTypography;
}

interface MaterialDocument {
  readonly sheet: Sheet;
  readonly margins: PageMargins;
  readonly printable: PrintableArea;
  readonly headerBands: readonly MaterialPageBand[];
  readonly root: readonly MaterialBlock[];
  readonly footerBands: readonly MaterialPageBand[];
}
```

La forme exacte peut conserver une matérialisation paresseuse des bandes D8 plutôt que des
contenus déjà évalués dans les deux listes. L'invariant est : une déclaration est évaluée au plus
une fois, et une déclaration jamais applicable n'est pas évaluée.

### 4.2 Fragments

Un fragment ne remplace pas le nœud matérialisé ; il le référence et décrit une tranche :

```ts
type FragmentEdge = 'whole' | 'first' | 'middle' | 'last';

interface TextCursor {
  readonly run: number;
  readonly offset: number;
}

interface TextFragment {
  readonly kind: 'text';
  readonly source: MaterialText;
  readonly from: TextCursor;
  readonly to: TextCursor;
  readonly edge: FragmentEdge;
}

interface TableFragment {
  readonly kind: 'table';
  readonly source: MaterialTable;
  readonly header: readonly MaterialRow[];
  readonly rows: readonly MaterialRowFragment[];
  readonly includesFooterEnd: boolean;
  readonly edge: FragmentEdge;
}
```

Les noms exacts sont secondaires ; les garanties suivantes sont obligatoires : tranche non vide
sauf document/table vide licite, ordre conservé, concaténation réversible, source immuable, edge
explicite et aucune donnée copiée dans un diagnostic.

### 4.3 Pages finales

```ts
interface MaterialPage {
  readonly number: number;
  readonly count: number;
  readonly header: readonly MaterialBlock[];
  readonly root: readonly MaterialFragment[];
  readonly footer: readonly MaterialBlock[];
}

interface PaginatedDocument {
  readonly sheet: Sheet;
  readonly margins: PageMargins;
  readonly printable: PrintableArea;
  readonly headerReserve: number;
  readonly footerReserve: number;
  readonly pages: readonly MaterialPage[];
}
```

`count` n'est rempli qu'après la coupure. La substitution des marqueurs est une vue de construction
HTML sur `MaterialPage`, pas une mutation des runs sources.

### 4.4 Contrat de mesure

Le moteur envoie une liste exacte de clés attendues avec le HTML de sonde. L'adaptateur renvoie des
rectangles et des curseurs sous ces clés. Le moteur compare les deux ensembles avant de lire une
mesure.

Les coordonnées restent en pixels CSS parce qu'elles sont comparées à des boîtes mesurées dans la
même page et la même session. Elles ne sont jamais converties en millimètres pour prendre une
décision de coupe ; cela éviterait un second arrondi. Les millimètres restent la langue de la feuille
déclarée et des styles générés.

---

## 5. Algorithme de pagination

### 5.1 Préparation unique

1. valider et migrer le template ;
2. créer un budget d'évaluation unique ;
3. matérialiser les bandes du cas une page, le flux racine et les images ;
4. attribuer les clés d'occurrence locales ;
5. calculer la borne d'unités de progression et la largeur de réserve des marqueurs ;
6. ouvrir la session après les contrôles de capacité feuille/images ;
7. mesurer les bandes et leurs hauteurs naturelles ;
8. calculer les réserves haute/basse et la hauteur racine.

Ni le modèle ni les données ne sont mutés. Une formule, une boucle et une condition ne sont évaluées
qu'à l'étape 3, jamais lors des essais de coupe.

### 5.2 Première hypothèse : une page

Le moteur pagine avec les bandes applicables à une page à la fois première et dernière :

| Domaine | Applicable |
| :--- | :--- |
| `every` | oui |
| `firstOnly` | oui |
| `exceptFirst` | non |
| `exceptLast` | non |
| `lastOnly` | oui |

Si tout tient, le résultat reste une page et E1 demeure un sous-cas exact d'E2. Les bandes
inapplicables ne sont ni liées ni mesurées.

Si plusieurs pages sont nécessaires, le moteur matérialise les déclarations complémentaires qui
apparaîtront au moins une fois, recalcule les deux maxima, puis recommence la coupure depuis le
curseur initial. Les réserves ne diminuent pas et le résultat ne peut redevenir mono-page.

### 5.3 Rôles des pages multi-pages

Pour un total `N > 1` :

- page 1 : `every`, `firstOnly`, `exceptLast` ;
- pages `2..N-1` : `every`, `exceptFirst`, `exceptLast` ;
- page N : `every`, `exceptFirst`, `lastOnly`.

Le schéma C4 garantit qu'au plus une bande est applicable sur un côté pour un rôle donné. Le moteur
n'empile jamais deux bandes et n'invente pas de priorité « la plus spécifique gagne ».

### 5.4 Remplissage d'une page

Le paginateur maintient un curseur structurel sur le flux racine.

1. construire la page avec ses slots et sa bande de rôle ;
2. proposer le prochain fragment entier ou le prochain préfixe légal ;
3. bâtir un HTML candidat fermé ;
4. mesurer le candidat dans la session ;
5. accepter s'il tient, sinon réduire au point légal précédent ;
6. fermer la page au plus long préfixe accepté ;
7. vérifier que le curseur a avancé ;
8. continuer jusqu'à épuisement du flux ;
9. attribuer `count`, substituer tous les marqueurs et reconstruire toutes les pages finales ;
10. mesurer la suite finale entière avant `print()`.

La recherche du plus long préfixe peut employer une dichotomie sur une liste ordonnée de points de
coupe, puis une vérification linéaire du voisin immédiat. Elle ne suppose la monotonie que pour une
même structure à laquelle on ajoute du contenu ; tout changement de structure — ajout du pied de
table, nouvelle décoration de fragment — est mesuré comme un candidat distinct.

### 5.5 Texte

Pour un texte qui dépasse :

1. la sonde renvoie les fins de lignes visuelles dans le contexte de largeur réel ;
2. le moteur choisit la dernière ligne dont le fragment fermé tient dans l'espace courant ;
3. si aucune ligne ne tient mais que la page contient déjà du flux, une page neuve est ouverte ;
4. si aucune ligne ne tient sur une page neuve, refus `pagination-impossible` avec le nœud ;
5. les runs sont tranchés au curseur sans concaténer puis reperdre leur typographie ;
6. le fragment suivant commence exactement au curseur précédent.

E2 ne conserve ni deux lignes en bas, ni deux lignes en haut : ces seuils appartiennent à E3.

### 5.6 Conteneur

Le conteneur est une séquence verticale d'enfants. Le moteur clone sa boîte sur chaque fragment et
remplit son contenu par le même algorithme récursif.

Un conteneur vide apparaît une fois. Un conteneur dont padding et décoration laissent une hauteur
interne nulle alors qu'il contient du flux est refusé. Un conteneur fragmenté ne répète pas ses
enfants déjà consommés.

### 5.7 Tableau simple

Le moteur traite une seule séquence de contenu : `body`, puis `footer`. Le `header` est une
préface répétée et n'avance pas le curseur.

Pour chaque fragment :

1. ajouter le tableau et son en-tête complet ;
2. ajouter autant de lignes suivantes qu'il en tient ;
3. ne jamais accepter un fragment en-tête-seul si du contenu reste ;
4. reporter une ligne entière sur la page suivante lorsqu'elle tient sur une page neuve ;
5. si la ligne ne tient jamais, appliquer §5.8 ;
6. inclure les lignes du pied seulement lorsque leur tour arrive après le corps ;
7. recalculer les filets sur la séquence du fragment ;
8. fermer le périmètre de ce fragment.

Un pied qui ne tient pas après la dernière ligne peut commencer sur une nouvelle page ; l'en-tête
du tableau y est encore répété s'il existe. E2 n'impose pas de garder une ligne du corps avec le
pied : ce serait une relation entre voisins réservée à un lot ultérieur.

### 5.8 Ligne surdimensionnée et tableau imbriqué

Une ligne est d'abord mesurée entière avec toutes ses cellules. Si elle dépasse la page racine
neuve :

1. créer un curseur de flux par cellule ;
2. calculer la hauteur interne disponible après la décoration clonée de la ligne ;
3. proposer pour chaque cellule son plus long préfixe légal dans cette hauteur ;
4. construire simultanément les cellules, car la hauteur de ligne est leur maximum ;
5. mesurer la ligne candidate complète ;
6. réduire les préfixes qui font dépasser le maximum jusqu'à ce que la ligne tienne ;
7. accepter si au moins une cellule avance ;
8. reprendre les cellules non terminées sur le fragment suivant.

Une cellule terminée reste un `<td>` vide afin de conserver le nombre, l'ordre et les largeurs de
colonnes. Un tableau imbriqué est un enfant fragmentable ordinaire de la cellule : ses propres
fragments répètent leur propre en-tête. Les deux niveaux recalculent leurs filets séparément.

La recette dédiée doit couvrir une ligne extérieure à deux cellules : un libellé court à gauche et
un tableau interne assez long à droite pour occuper trois pages. Le libellé apparaît une fois ; les
deux en-têtes apparaissent aux pages attendues ; aucun contenu n'est dupliqué.

### 5.9 Images

Une image décodée est atomique. Si elle ne tient pas dans l'espace restant, elle est réessayée sur
une page neuve. Si sa hauteur rendue dépasse la hauteur racine d'une page admissible avec les
réserves de bandes, refus `oversized-atomic-resource`.

La comparaison E1 contre toute l'aire imprimable est donc resserrée à la vraie aire de flux E2. Le
moteur ne réduit pas l'image, ne coupe pas son bitmap et n'imprime pas son texte alternatif à la
place.

### 5.10 Validation finale

Avant `page.pdf()` :

- le nombre de boîtes `.ov-page` est celui de `PaginatedDocument.pages` ;
- chaque feuille et chaque zone imprimable a la dimension attendue ;
- chaque slot contient au plus sa réserve ;
- chaque flux racine reste dans sa hauteur ;
- toutes les images sont décodées et dans une page ;
- aucun nœud ne peint hors de sa feuille ;
- chaque table fragmentée qui possède un en-tête en contient une copie ;
- aucun marqueur de mesure, placeholder visible ou `pageField` non substitué ne subsiste ;
- les numéros sont `1..N` et tous les comptes valent `N` ;
- une règle de page sépare deux feuilles sans créer une feuille vide terminale.

L'impression n'a lieu qu'après ces contrôles et exactement une fois.

---

## 6. Organisation cible des fichiers

L'arborescence précise peut s'ajuster à la baseline, mais les responsabilités restent séparées :

```text
packages/engine/src/
  document/
    bands.ts                    # domaines une page / multi-page, matérialisation paresseuse
    materialize.ts              # liaison unique, pageField conservé
    types.ts                    # document, runs et clés d'occurrence internes
  pagination/
    types.ts                    # curseurs, fragments, pages, mesures consommées
    progress.ts                 # borne et invariant d'avance stricte
    bands.ts                    # réserves haute/basse
    paginate.ts                 # orchestration gloutonne
    flow.ts                     # blocs et conteneurs
    text.ts                     # tranches de runs aux curseurs de lignes
    table.ts                    # header/body/footer et filets par fragment
    row.ts                      # flux coordonnés des cellules
    validate-measurement.ts     # mesures finies, clés complètes, curseurs ordonnés
  html/
    build-probe.ts              # page candidate fermée
    build.ts                    # document paginé final
    css.ts                      # slots, feuilles multiples, rupture finale
    table-rules.ts              # réemployé après coupe
  pipeline/
    render-pdf.ts               # ouverture/fermeture de session et six étapes
  strategy/
    pdf.ts                      # ressources, session, source et mesures
  errors.ts
  __tests__/
    pagination-bands.test.ts
    pagination-flow.test.ts
    pagination-text.test.ts
    pagination-table.test.ts
    pagination-nested-table.test.ts
    pagination-termination.test.ts
    render-pdf.test.ts

packages/adapter-puppeteer/src/
  session.ts                    # navigateur/contexte/page, cycle de vie
  measure.ts                    # rectangles, lignes, images, débordements
  page-fields.ts                # sonde de réserve des chiffres
  puppeteer-pdf-strategy.ts     # open(resources)
  __tests__/
    pagination-probes.test.ts
    puppeteer-pdf-strategy.test.ts
    reference-document.test.ts

apps/playground/src/examples/
  reference-invoice.ts          # jeu de 60 lignes ajouté au catalogue existant
```

Les gros moteurs ne rejoignent ni `materialize.ts` ni `build.ts`. Les types, la mesure, la
politique de coupure et la sérialisation restent lisibles et testables séparément.

`@openview/core`, `@openview/designer` et `@openview/viewer` ne changent pas.

---

## 7. Sondes bloquantes d'INC-0

Les sondes sont jetables ; leurs conclusions et les tests qui les tiennent survivent dans l'ADR
E2.

### P1 — Une boîte explicite produit exactement une page PDF

Construire 1, 2 et 4 `.ov-page` aux dimensions A4, avec la règle de rupture envisagée.

Porte : `pdf-lib` lit exactement 1, 2 et 4 pages, toutes dans la tolérance E1, sans cinquième page
blanche. Tester aussi une feuille personnalisée.

### P2 — La mesure reste stable dans une session réutilisée

Charger deux fois le même HTML dans la même page puis avant/après un autre candidat.

Porte : mêmes dimensions dans la tolérance de 0,5 px, images décodées, fontes prêtes, aucun état DOM
du candidat précédent. Si `setContent()` ne suffit pas à isoler, la session recrée une **page** dans
le même contexte ; elle ne relance pas un navigateur.

### P3 — Les lignes visuelles donnent des curseurs réversibles

Mesurer les cas D13, trancher, reconstruire, puis comparer texte et styles.

Porte : zéro caractère perdu/dupliqué, curseurs croissants, lignes vides observables. Un échec bloque
E2 ; il n'est pas contourné par un split sur espace ou par `Array.from()`.

### P4 — La réserve de numéro est réellement majorante

Pour chaque typographie de la recette, mesurer `0..9`, puis les champs de 1 à 120 avec les réserves
1, 2 et 3 chiffres.

Porte : aucune valeur ne change la hauteur ou ne dépasse la boîte. La valeur reste visible et
sélectionnable.

### P5 — Une table reconstruite garde sa géométrie

Comparer un tableau continu et deux fragments reconstruits à largeur identique : largeurs de
colonnes, hauteurs de lignes, en-tête, périmètre et filets.

Porte : colonnes identiques ; le fragment 2 répète l'en-tête ; les frontières au point de coupe
sont celles recalculées, sans somme de largeurs ni ombre héritée de l'ancien voisin.

### P6 — Une ligne peut être reconstruite par flux de cellules

Construire la fixture imbriquée de §5.8 et produire trois fragments de la même ligne extérieure.

Porte : même largeur de cellules, contenu court non répété, tableau interne complet et ordonné,
en-tête interne répété, aucun `rowspan` synthétique.

### P7 — La feuille de mesure reste inerte et hors ligne

Rejouer les preuves E1 pendant plusieurs `measure()` : script hostile, URL métadonnées cloud, image
corrompue.

Porte : le script ne s'exécute pas, la requête est avortée, l'image est refusée et la session ferme
ses ressources.

---

## 8. Factures de recette et oracles

### 8.1 La facture E2 de soixante lignes

La fixture conserve le vocabulaire de son application exemple. Les soixante lignes sont des données
hôte ordinaires sous la clé choisie par cette fixture ; aucun nom ne remonte dans le moteur ou
l'adaptateur.

Elle doit contenir :

- une feuille A4 déclarée par le modèle ;
- une bande haute `every` ;
- un pied `exceptLast` et un pied `lastOnly`, tous deux avec `number` et `count` ;
- un tableau à cinq colonnes et une ligne d'en-tête identifiable ;
- soixante lignes de corps matérialisées par `tableRowGroup` ;
- un pied de tableau avec une formule du modèle ;
- un bloc après le tableau afin de prouver que le flux continue après sa fragmentation ;
- au moins une ligne qui prend deux lignes visuelles sans devenir surdimensionnée.

La mise en page de la fixture est réglée pour donner **exactement quatre pages**. Si le premier
essai en donne trois ou cinq, seule l'apparence ou la donnée de recette est ajustée ; aucune
constante de production ne reconnaît « 60 » ou « facture ».

### 8.2 Oracles mécaniques sans navigateur

Avec une session factice déterministe :

- 60 lignes, hauteurs synthétiques et réserves données → 4 pages ;
- pages 1 à 3 : pied `exceptLast`; page 4 : pied `lastOnly` ;
- marqueurs : `1/4`, `2/4`, `3/4`, `4/4` aux positions du modèle ;
- en-tête du tableau présent quatre fois ;
- chaque ligne du corps présente exactement une fois et dans l'ordre ;
- pied de tableau présent une fois, après la ligne 60 ;
- bloc après tableau présent une fois ;
- aucun fragment en-tête-seul ;
- source matérialisée et données inchangées.

### 8.3 Oracles avec Chromium réel

- le PDF porte exactement quatre pages A4 ;
- chaque page finale passe la mesure sans débordement ;
- le DOM final contient quatre `.ov-page` et quatre copies de l'en-tête de table ;
- les slots de bandes ont la même hauteur sur les quatre pages ;
- les pieds courant/final suivent leurs domaines ;
- aucun placeholder de mesure n'est visible ;
- une image et les couleurs E1 restent présentes ;
- le navigateur est lancé une fois et `page.pdf()` appelé une fois.

### 8.4 Oracle humain

Le PDF de recette est ouvert page par page avant clôture :

- aucune ligne n'est tronquée verticalement ;
- l'en-tête de colonnes est immédiatement visible sur les pages 2, 3 et 4 ;
- le bandeau et le pied gardent leur alignement ;
- « page n / 4 » correspond à la feuille observée ;
- le pied du tableau et le bloc suivant ne sont ni répétés ni perdus ;
- les cadres fragmentés sont fermés proprement ;
- aucune page blanche ni bande fantôme n'apparaît.

Ce contrôle ne remplace aucun test. Il couvre la lisibilité globale que le nombre de pages ne peut
pas prouver.

---

## 9. Stratégie de tests

### 9.1 Matérialisation

- tous les marqueurs survivent avec leur typographie ;
- chaque bande est liée au plus une fois même si elle est répétée quatre fois ;
- une bande inapplicable dans le résultat mono-page n'évalue pas une liaison volontairement
  absente ;
- le budget d'évaluation est commun aux bandes effectivement liées et au flux ;
- les chemins et clés d'occurrence distinguent deux itérations imbriquées pendant le rendu ;
- aucun nom de donnée de fixture n'apparaît dans `packages/engine/src` ou
  `packages/adapter-puppeteer/src` hors tests.

### 9.2 Bandes et numérotation

- table exhaustive des cinq domaines pour N=1, première, milieu et dernière ;
- les paires licites du schéma n'empilent jamais deux bandes ;
- hauteur maximale réservée sur toutes les pages, bande réelle alignée dans le slot ;
- transition mono→multi matérialise uniquement les bandes nouvellement applicables ;
- `number` varie, `count` reste constant ;
- marqueur dans header, root, cellule et footer ;
- 9→10 et 99→100 sans changement de coupe avec une mesure factice témoin ;
- bande trop haute et réserves incompatibles donnent `page-band-overflow`.

### 9.3 Flux et terminaison

- bloc entier qui tient ;
- deux blocs avec coupe entre eux ;
- conteneur fragmenté avec enfants ordonnés ;
- aucune page vide créée en milieu ou en fin ;
- curseur identique deux fois → `pagination-impossible` ;
- décoration seule laissant zéro hauteur avec contenu → refus ;
- page bandes-seules et root vide → une page licite ;
- `keepTogether` présent/absent ne change pas encore la coupe E2 d'un texte ou d'un conteneur ;
- chaque succès consomme toutes les unités une fois.

### 9.4 Texte

- une ligne, plusieurs lignes, plusieurs runs ;
- coupe exacte au changement de page ;
- espaces, nouvelles lignes vides, Unicode et emoji de P3 ;
- marqueur atomique dans une ligne ;
- style de chaque run préservé ;
- reconstruction exacte de tous les caractères ;
- une ligne plus haute que la page → refus attribué ;
- aucun seuil de veuve/orpheline caché.

### 9.5 Tableaux

- header vide : aucun header inventé ;
- header présent : répété sur tout fragment ;
- header multi-lignes : répété en bloc et ordre conservé ;
- 60 lignes → 4 fragments avec la session factice ;
- ligne qui ne tient plus dans l'espace restant mais tient page neuve : jamais coupée ;
- en-tête qui ne tient pas avec le plus petit fragment : refus sans boucle ;
- footer une seule fois et après le corps ;
- footer repoussé sur une page suivante avec header répété ;
- règles de bordure recalculées à la coupe, égalités incluses ;
- colonnes pondérées identiques sur tous les fragments ;
- table dans table jusqu'au cas P6 ;
- ligne extérieure fragmentée, cellules terminées vides et aucun contenu répété.

### 9.6 Adaptateur Chromium

- `open()` refuse feuille/source non supportée avant lancement ;
- plusieurs mesures, un seul lancement ;
- JavaScript désactivé et réseau avorté à chaque chargement ;
- attente explicite des fontes et du décodage des images ;
- mesure complète et finie ;
- impression finale unique ;
- 1, 2 et 4 boîtes donnent 1, 2 et 4 pages sans blanche terminale ;
- fermeture après succès, refus de mesure, refus de pagination et échec d'impression ;
- une session fermée refuse une nouvelle mesure de façon explicite ;
- aucun appel asynchrone flottant.

### 9.7 Régressions E1

- les deux apparences et les deux petits jeux de données sortent encore en une page ;
- feuille personnalisée, fonds, filets, justification et ratio d'image restent exacts ;
- valeur absente/non imprimable garde son code et ses détails ;
- image corrompue, distante ou surdimensionnée garde son refus approprié ;
- le document v1 est encore migré et matérialisé par la façade ;
- HTML hostile reste échappé et la CSP inchangée.

### 9.8 Couverture et portes

Chaque fonction de `engine` et de l'adaptateur reçoit des tests. Les scénarios Chromium ne sont pas
skippés silencieusement. La validation finale est exécutée dans l'ordre du dépôt :

```bash
pnpm run lint && pnpm run build && pnpm run type-check && pnpm run test:coverage
```

Les seuils restent ≥ 90 % sur statements, branches, functions et lines, sans exclusion nouvelle.

---

## 10. Incréments d'exécution

### INC-0 — Baseline et sept sondes bloquantes

**Travail :**

1. vérifier worktree, versions, ADR suivante et état des quatre portes ;
2. écrire puis supprimer les sondes P1 à P7 ;
3. consigner résultats, tolérances et éventuelles corrections dans une note de travail destinée à
   l'ADR 0013 ;
4. confirmer qu'aucune dépendance n'est nécessaire ;
5. confirmer que l'algorithme de curseur de lignes est réversible avant tout refactor de production.

**Sortie :** les primitives Chromium sont prouvées ; aucun choix central du plan ne repose sur une
hypothèse navigateur non mesurée.

### INC-1 — Contrat de session et erreurs E2

**Travail :**

1. remplacer le contrat de stratégie sans état par ressources/session ;
2. ajouter les types de mesure et leurs gardes ;
3. retirer `single-page-overflow`, ajouter les trois codes E2 et le détail de page ;
4. adapter les stratégies factices des tests ;
5. préserver `createPdfRenderPort()` et `RenderResult` ;
6. épingler ouverture unique, impression unique et fermeture sur tous les chemins.

**Sortie :** le moteur peut demander une mesure sans DOM et l'adaptateur peut la fournir sans
exposer Puppeteer.

### INC-2 — Matérialisation des bandes et marqueurs tardifs

**Travail :**

1. remplacer `THE_ONLY_PAGE` par l'union de runs ;
2. introduire les bandes matérialisables une fois et leur sélection par rôle ;
3. conserver le budget unique ;
4. attribuer les clés d'occurrence locales ;
5. calculer la borne de progression ;
6. couvrir les non-évaluations et la non-mutation.

**Sortie :** le document lié ne suppose plus qu'il existe une page, mais ne contient toujours
aucune expression exécutable.

### INC-3 — Mesure Chromium réutilisable

**Travail :**

1. extraire le cycle navigateur/contexte/page dans `session.ts` ;
2. généraliser `measureInPage()` aux boîtes annotées et aux curseurs de lignes ;
3. implémenter la sonde de largeur des marqueurs ;
4. valider images, fontes, feuille et réseau sur chaque contenu chargé ;
5. séparer `measure()` de `print()` ;
6. faire passer P2, P3, P4 et P7 en tests permanents.

**Sortie :** une session mesure plusieurs pages candidates de façon sûre et stable.

### INC-4 — Réserves de bandes et pages explicites

**Travail :**

1. implémenter la table des rôles de page ;
2. mesurer et maximiser les réserves ;
3. gérer la transition une page → multi-page ;
4. construire les slots et plusieurs `.ov-page` ;
5. substituer les marqueurs avec leur réserve ;
6. faire passer P1 et les tests de bandes.

**Sortie :** un flux artificiellement découpé peut être peint sur N pages avec bandes et numéros
corrects, avant le paginateur général.

### INC-5 — Flux, texte et conteneurs

**Travail :**

1. écrire les types de curseurs/fragments et l'invariant de progrès ;
2. implémenter le remplissage glouton ;
3. trancher les runs aux lignes mesurées ;
4. fragmenter les conteneurs et cloner leurs décorations ;
5. traiter images et fragments minimaux impossibles ;
6. valider la concaténation exacte et la terminaison.

**Sortie :** tout flux sans table se pagine aux points E2 définis.

### INC-6 — Tableaux simples et filets par fragment

**Travail :**

1. séparer header répétable et séquence body/footer ;
2. garder chaque ligne entière lorsqu'une page neuve la contient ;
3. répéter l'en-tête sans produire de fragment en-tête-seul ;
4. placer le pied une fois ;
5. recalculer `resolveRowRules()` sur chaque fragment ;
6. couvrir header vide, multi-lignes, footer repoussé et table vide.

**Sortie :** la facture longue plate est correctement fragmentée.

### INC-7 — Lignes surdimensionnées et tableaux imbriqués

**Travail :**

1. implémenter les curseurs de cellule coordonnés ;
2. réutiliser récursivement le paginateur de flux dans les cellules ;
3. conserver les cellules finies comme cellules vides ;
4. garantir l'avance d'au moins une cellule ;
5. faire passer P6 et les tests d'imbrication ;
6. vérifier les filets aux deux niveaux.

**Sortie :** la dette explicite de l'ADR 0005 D5 est payée, pas reportée silencieusement.

### INC-8 — Facture de soixante lignes de bout en bout

**Travail :**

1. étendre la fixture de l'adaptateur avec le jeu de soixante lignes ;
2. obtenir exactement quatre pages sans constante métier ;
3. vérifier les oracles mécaniques et Chromium ;
4. produire le PDF des deux apparences si leur coût de test reste raisonnable ;
5. ajouter le même jeu au catalogue du playground ;
6. effectuer la recette humaine page par page.

**Sortie :** le critère « prêt quand » d'E2 est visible et reproductible.

### INC-9 — Ablations, ADR et clôture

**Travail :**

1. exécuter toutes les preuves d'ablation §11 ;
2. écrire l'ADR 0013 avec les résultats réels des sondes et les corrections du plan ;
3. mettre à jour `docs/roadmap/engine.md` en `✅ livré`, sans annoncer J3 atteint ;
4. ne pas cocher J3 : reports, exigences comptables et langues restent devant ;
5. lancer les quatre portes dans l'ordre ;
6. relire les commentaires source : anglais, concis, aucun numéro de lot.

**Sortie :** E2 livré ; E3 peut commencer sur une pagination explicite et mesurable.

---

## 11. Preuves d'ablation

Une preuve est réussie si la mutation indiquée fait rougir le test nommé.

| Mutation | Preuve attendue |
| :--- | :--- |
| laisser Chromium paginer le long flux | le HTML final n'a plus N `.ov-page` et la coupe attendue disparaît |
| ne pas répéter `header` | les pages 2–4 de la fixture n'ont plus l'en-tête |
| répéter le `footer` du tableau | le pied apparaît plus d'une fois |
| substituer tous les marqueurs à `1` | matrice `1/4..4/4` |
| donner une largeur naturelle aux numéros | témoin 9→10 change une hauteur/coupe |
| réserver la hauteur de bande page par page | fixture `exceptLast`/`lastOnly` change de découpe ou oscille |
| évaluer toutes les bandes sans condition | liaison absente dans une bande mono-page invisible refuse à tort |
| accepter un fragment en-tête-seul | test de progression boucle ou produit une page sans nouvelle ligne |
| couper une ligne qui tient page neuve | test de ligne atomique observe deux fragments |
| refuser toute ligne surdimensionnée | fixture de table imbriquée échoue au lieu de se paginer |
| répéter le contenu court d'une cellule externe | texte témoin apparaît trois fois |
| copier les règles de filet avant coupe | frontière du fragment garde l'ancien voisin |
| ne pas cloner padding/fond/filets | oracle de décoration des fragments |
| couper le texte sur un offset inventé | reconstruction Unicode ou multi-run diffère |
| autoriser un curseur sans progrès | test de terminaison ne reçoit plus `pagination-impossible` |
| comparer l'image à toute l'aire imprimable | image qui tient sans bandes mais pas dans `rootHeight` est acceptée |
| retourner une mesure `NaN` ou incomplète | garde `layout-measurement-failed` |
| imprimer avant validation finale | stratégie factice observe `print()` malgré un débordement |
| lancer un navigateur par mesure | compteur de lancement dépasse un |
| omettre un `await` de fermeture | ressource encore connectée après le test |
| laisser exécuter le script du document | sonde hostile modifie la hauteur |
| importer Puppeteer dans `engine` | `pnpm run lint` / dépendances de paquet |
| réserver `page`, `total`, `lines` ou un nom de facture | grep de périmètre et collecte des chemins de fixture |

---

## 12. Définition de fini

E2 est fini uniquement si tous les faits suivants sont vrais :

- [ ] `CURRENT_SCHEMA_VERSION` vaut toujours 8 et `core` n'a aucun nouveau champ ;
- [ ] `createPdfRenderPort()` garde sa surface d'appel et produit toujours un `RenderResult` PDF ;
- [ ] la stratégie ouvre une session de mesure/impression, sans type DOM dans `engine` ;
- [ ] les formules et données sont liées une seule fois par occurrence, jamais par page ;
- [ ] les marqueurs restent tardifs puis affichent le rang et le compte corrects ;
- [ ] les hauteurs de bandes et largeurs de marqueurs ne dépendent pas du rôle finalement attribué ;
- [ ] une page réussie avance strictement dans le flux ;
- [ ] texte, conteneur, table, ligne surdimensionnée et image suivent chacun la politique D12 ;
- [ ] un tableau avec header le répète à chaque fragment et ne répète jamais son footer ;
- [ ] un tableau sans header reste accepté sans contenu inventé ;
- [ ] le tableau imbriqué de P6 se pagine sans duplication ;
- [ ] les filets sont recalculés après coupe et les décorations sont clonées ;
- [ ] les bandes impossibles, images atomiques trop hautes et fragments minimaux impossibles sont
  refusés avec un code précis et sans boucle ;
- [ ] aucune erreur ne contient donnée liée, HTML, template sérialisé ou source d'image ;
- [ ] les quatre petits documents E1 sortent encore en une page ;
- [ ] la facture de soixante lignes sort en exactement quatre pages A4 ;
- [ ] les pages 2, 3 et 4 montrent l'en-tête de colonnes ;
- [ ] les quatre pages montrent une numérotation cohérente ;
- [ ] le playground permet de choisir le jeu long et de télécharger son PDF ;
- [ ] aucun nouveau paquet ni assouplissement de configuration n'a été ajouté ;
- [ ] les preuves d'ablation rougissent ;
- [ ] lint, build, type-check et couverture passent dans l'ordre ;
- [ ] l'ADR E2 fait foi et la roadmap marque E2 livré sans marquer J3 atteint.

---

## 13. Risques et réponses prévues

### Les curseurs de lignes Chromium peuvent être moins propres que le modèle théorique

Les lignes vides, les runs inline et Unicode sont les témoins P3. Le risque est bloquant : sans
curseur réversible, E2 ne coupe pas le texte. La réponse n'est pas un split approximatif ; elle est
de corriger le balisage de sonde ou de revoir explicitement le périmètre avant production.

### La recherche par mesures peut être coûteuse

Le plan privilégie l'exactitude : plusieurs `setContent()` dans une même session, un seul lancement.
La dichotomie réduit les essais sur les longues séquences. E8 possédera plafonds et pooling ; E2
mesure néanmoins le nombre d'appels sur la fixture de 60 lignes et l'inscrit dans l'ADR pour éviter
une complexité quadratique cachée.

### Une décoration clonée consomme plus de hauteur

C'est une décision visible, pas un défaut d'arrondi. Les sondes et la facture incluent ce coût. Le
moteur ne retire pas un padding au point de coupe pour faire tenir une ligne de plus.

### Le tableau imbriqué est le chemin le plus complexe

Il est une dette acceptée, pas un bonus. INC-7 est séparé pour que le lot ne soit pas déclaré fini
sur la seule facture plate. La règle de progrès par cellule et l'absence de `rowspan` synthétique
bornent le problème.

### Le nombre de pages pourrait être énorme

La terminaison logique est prouvée par les unités de progression, mais elle ne protège pas les
ressources d'un service. E2 ne choisit pas en passant un plafond produit. E8 ajoutera les limites
opérationnelles avant exposition ; le pont local reste fermé à son catalogue.

### Une stratégie tierce E1 ne saura plus seulement « imprimer une chaîne »

Le contrat de stratégie est public mais le seul adaptateur réel est dans le dépôt. INC-1 vérifie la
politique de version du paquet et documente la rupture. Conserver silencieusement l'ancien contrat
en laissant l'adaptateur décider la coupe serait plus dangereux qu'une évolution explicite avant
1.0.

### Les métriques restent dépendantes des fontes de la machine

Toutes les décisions d'un rendu emploient une même session, ce qui garantit la cohérence interne du
PDF, pas l'égalité entre machines. La dette `sans-serif` et l'embarquement des fontes restent à E6 ;
E2 ne prétend pas les fermer.

### Une bande peut contenir une boucle très grande

Elle est liée avec le budget commun puis mesurée atomiquement. Si elle dépasse, elle est refusée
sans tentative de coupe. Les plafonds d'évaluation C1 limitent le calcul ; le durcissement temporel
reste à E8.

---

## 14. Contrôle de périmètre avant exécution

Avant INC-0 :

1. vérifier et préserver les changements utilisateur du worktree ;
2. confirmer que l'ADR 0013 est encore libre ;
3. confirmer que `CURRENT_SCHEMA_VERSION` vaut 8 ;
4. relire les éventuels amendements aux ADR 0005, 0006, 0007, 0009 et 0012 ;
5. confirmer que la roadmap n'a pas déplacé reports, `keepTogether`, veuves/orphelines ou résultat
   public de pagination dans E2 ;
6. confirmer que Puppeteer et Chromium sont toujours aux versions de la baseline ou rejouer les
   sondes si l'un a changé ;
7. confirmer qu'aucun second adaptateur réel n'a introduit un contrat concurrent ;
8. relever tous les sites de `single-page-overflow`, `PdfRenderStrategy`, `PdfSourceDocument` et
   `bandOfTheOnlyPage` ;
9. vérifier que la facture de référence et ses deux apparences restent la recette E1 ;
10. confirmer que package manifests, configs, CI et seuils ne doivent pas changer ;
11. lancer les quatre portes avant modification pour distinguer une régression E2 d'une baseline
    déjà rouge ;
12. arrêter et faire arbitrer toute demande qui réserverait un nom de donnée, ajouterait un champ
    `core`, une dépendance ou une politique E3.
