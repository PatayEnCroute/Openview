# ADR 0013 — Le tableau déborde proprement

- **Statut :** 🟢 **Accepté** (2026-08-22), implémenté dans `@openview/engine` et
  `@openview/adapter-puppeteer`
- **Date :** 2026-08-22
- **Impact :** `@openview/core` (**intact** : aucun champ, aucun kind, aucune migration ;
  `CURRENT_SCHEMA_VERSION` reste **8**), `@openview/engine` (un module `pagination/` nouveau, la
  matérialisation, le vocabulaire HTML, le contrat de stratégie et le catalogue de refus),
  `@openview/adapter-puppeteer` (une **session** remplace l'appel d'impression sans état),
  `apps/playground` (un troisième jeu de données), `@openview/designer` et `@openview/viewer`
  (**intacts**)
- **Ferme :** [ADR 0005](0005-le-tableau-de-lignes.md) D4, D5 et D9 (répétition de l'en-tête, ligne
  surdimensionnée, pied en fin de flux) ; [ADR 0006](0006-la-page.md) D6 et D7 (domaines de bandes,
  substitution de `number` et `count`) ; [ADR 0007](0007-l-apparence.md) attentes 1 et 6 (décoration
  au point de coupe, filets aux nouvelles frontières) ; [ADR 0009](0009-les-blocs-insecables.md) D6
  et D7 (ligne atomique tant qu'une page neuve la contient, en-tête répété)
- **Rompt :** le contrat de `PdfRenderStrategy` — `render(source)` devient `open(resources)` — et le
  code `single-page-overflow`, **retiré** du catalogue. Les deux ruptures sont nommées en
  [D-2](#d-2--une-session-remplace-lappel-dimpression-sans-état) et
  [D-13](#d-13--trois-refus-remplacent-lambiguïté-mono-page).
- **N'amende aucune règle de gouvernance.** `AGENTS.md`, `tsconfig*.json`, `biome.jsonc`, les
  plugins GritQL, `turbo.json`, `sonar-project.properties`, les workflows, la configuration Vitest
  et les seuils de couverture sortent du lot **inchangés**. Aucune dépendance n'est ajoutée : la
  pagination n'utilise que Puppeteer, déjà isolé dans l'adaptateur, et `pdf-lib`, déjà présent pour
  les tests.
- **Plan d'implémentation :**
  [docs/plans/e2-le-tableau-deborde-proprement.md](../plans/e2-le-tableau-deborde-proprement.md)
  — **périmé** une fois le lot livré. C'est cette ADR qui fait foi, et elle **corrige** son plan sur
  cinq points nommés au [§ Ce que l'exécution a corrigé du plan](#ce-que-lexécution-a-corrigé-du-plan).
- **Implémentation :**
  [`engine/src/pagination/`](../../packages/engine/src/pagination/) (curseurs, fragments, réserves,
  politique de coupure, gardes de mesure, vérification finale),
  [`engine/src/document/materialize.ts`](../../packages/engine/src/document/materialize.ts) et
  [`engine/src/document/bands.ts`](../../packages/engine/src/document/bands.ts),
  [`engine/src/html/build.ts`](../../packages/engine/src/html/build.ts) et
  [`engine/src/html/build-page.ts`](../../packages/engine/src/html/build-page.ts),
  [`engine/src/pipeline/render-pdf.ts`](../../packages/engine/src/pipeline/render-pdf.ts),
  [`engine/src/strategy/pdf.ts`](../../packages/engine/src/strategy/pdf.ts),
  [`adapter-puppeteer/src/session.ts`](../../packages/adapter-puppeteer/src/session.ts) et
  [`adapter-puppeteer/src/measure.ts`](../../packages/adapter-puppeteer/src/measure.ts)

---

## Contexte

L'[ADR 0012](0012-une-facture-d-une-page-sort-en-pdf.md) a livré le premier PDF d'Openview, et il
tient sur **une** feuille par construction : le moteur produisait une boîte `.ov-page`, remplaçait
les deux marqueurs de page par `1`, et l'adaptateur refusait tout dépassement sous le code
`single-page-overflow`. Quatre hypothèses mono-page, verrouillées ensemble.

E2 les retire ensemble. Une facture de soixante lignes doit sortir en quatre feuilles lisibles, avec
l'en-tête de colonnes répété, les bandes de page choisies par domaine, et « page n / N » exact. En
retirer une seule aurait produit soit un PDF tronqué, soit des bandes fausses, soit une numérotation
fausse, soit une coupure abandonnée à Chromium.

Le lot a commencé par sept sondes bloquantes, pour la même raison qu'E1 : une décision de conception
prise sans mesurer le navigateur est une hypothèse déguisée en contrat. **Une de ces sondes a
contredit le plan**, et elle est consignée telle quelle ci-dessous.

---

## Ce que le lot n'est pas

E2 pagine. Il ne compose pas.

- **Aucun report de total** d'une page à la suivante. C'est le seul calcul qui dépend du point de
  coupe, et son arrondi doit rester déclaré par le modèle : lot E3.
- **Aucune politique de `keepTogether`.** La marque est transportée jusqu'à la représentation
  matérialisée pour qu'E3 n'ait pas à refaire la liaison, et elle n'influence **aucune** coupure
  d'E2. C'est vérifié par un test, pas seulement écrit ici.
- **Aucun seuil de veuve ou d'orpheline, aucun nombre minimal de lignes** avant ou après une coupe.
  E2 lit « ligne orpheline » au sens structurel de l'ADR 0009 : aucune ligne de continuation n'est
  détachée de l'en-tête que son tableau déclare. Une page qui ne porte qu'une ligne de corps après
  cet en-tête reste licite.
- **Aucune mention de dernière page, aucun cadre de paiement** : responsabilité de composition
  finale, lot E3.
- **Aucun formatage localisé des marqueurs.** E2 écrit des entiers décimaux canoniques ; le site du
  format appartient au rendu localisé, lot E4.
- **Aucun résultat public de pagination** : `RenderResult` ne renvoie toujours que les octets. La
  clé d'occurrence introduite ici est interne à un rendu (voir
  [D-4](#d-4--une-clé-doccurrence-interne-jamais-un-identifiant-public)).
- **Aucun plafond de pages, de temps, de mémoire ni de concurrence.** La terminaison est prouvée
  logiquement ([D-9](#d-9--la-politique-de-coupure-est-gloutonne-et-garantit-un-progrès-strict)) ;
  le durcissement d'un document hostile reste au lot E8.
- **Aucun saut de page manuel, aucun `keepWithNext`, aucune priorité de coupe** : ils demanderaient
  un champ stocké et une migration, donc un lot `core` mandaté.
- **Aucun en-tête synthétisé** pour un tableau qui n'en déclare pas. Un tableau sans en-tête reste
  licite et le moteur n'invente aucun intitulé.

---

## Les sondes, et ce qu'elles ont dit

Sept sondes jetables ont été écrites, exécutées contre Chromium 25.6.0 (le binaire que Puppeteer
installe), puis supprimées. Leurs conclusions survivent ici et dans les tests permanents qui les
tiennent.

### P1 — Une boîte explicite produit exactement une page PDF : **passée**

Une, deux et quatre boîtes `.ov-page` de hauteur exacte, séparées par `break-after: page` sur toutes
sauf la dernière, produisent **exactement** 1, 2 et 4 pages PDF. Aucune cinquième page blanche.
Mesuré aussi sur une feuille personnalisée de 123,45 × 234,56 mm et sur trois boîtes.

La taille de page relevée est de 594,96 × 841,92 pt pour de l'A4 déclaré, contre 595,28 × 841,89 pt
attendus : l'écart est celui de la quantisation à 1/300 de pouce déjà mesurée en E1, et il reste
sous `SHEET_TOLERANCE_PT` (0,5 pt).

### P2 — La mesure reste stable dans une session réutilisée : **passée**

Le même contenu chargé deux fois dans la **même** page Chromium, avec un autre document entre les
deux, rend la même hauteur au centième de pixel. Recréer une page à chaque mesure n'a donc pas été
nécessaire : `setContent()` suffit à isoler.

### P3 — Les curseurs de lignes visuelles : **passée après correction de l'algorithme**

C'est la sonde qui a **contredit le plan**, et le seul angle de conception qu'E2 a dû revoir.

L'algorithme envisagé mesurait le **bas de chaque préfixe** — `range(début, offset)` — et coupait là
où ce bas descend. Sur les sept cas de la sonde, il est réversible partout, mais il se trompe de
lignes deux fois :

- un texte qui **mêle deux tailles de police** produit une frontière **fantôme** au milieu d'une
  ligne visuelle, parce que le bas du préfixe descend dès que le premier grand glyphe entre dans le
  rectangle englobant. Couper là, c'est couper « au milieu d'un curseur que Chromium a présenté
  comme une même ligne » — précisément ce que le plan interdit ;
- une **ligne vide** créée par `\n\n` est **fusionnée** avec la suivante, parce que le rectangle
  englobant d'un préfixe qui finit sur une frontière inclut un rectangle de largeur nulle au début
  de la ligne d'après.

L'algorithme retenu mesure le rectangle de **chaque unité** — `range(offset - 1, offset)` — et ouvre
une ligne quand le haut de l'unité descend au niveau du bas de tout ce qui est déjà sur la ligne
courante. Il coûte un rectangle par caractère au lieu d'un par dichotomie, ce qui est sans effet
mesurable sur la facture de recette, et il rend le compte de lignes **exact** sur les sept cas :

| Cas | Lignes | Réversible |
| :--- | ---: | :--- |
| une phrase qui se replie | 2 | oui |
| espaces de tête et de fin | 2 | oui |
| ligne vide créée par `\n\n` | 3 | oui |
| un run d'une autre taille en milieu de ligne | 3 | oui |
| accent combiné, paire de substitution, séquence emoji ZWJ, drapeau | 2 | oui |
| marqueur de page entre deux littéraux | 2 | oui |
| paragraphe justifié | 3 | oui |

« Réversible » veut dire que la concaténation des tranches prises aux curseurs rend **exactement**
la suite des runs d'origine : mêmes caractères, même ordre, même run. Les sept cas sont des tests
permanents de l'adaptateur.

### P4 — La réserve de numéro est réellement majorante : **passée**

Les dix chiffres décimaux ont la **même** largeur d'avance en `sans-serif` et en `serif`, à deux
tailles (7,359 px et 5,266 px ; 6,625 px et 4,734 px). Les valeurs 0 à 120 placées dans une boîte de
trois chiffres n'ont produit **qu'une seule** hauteur distincte et aucun débordement : `9 → 10` et
`99 → 100` ne changent ni la hauteur du bloc ni la boîte.

La largeur égale des chiffres est une propriété de ces deux familles, pas du contrat : le moteur
mesure les dix et retient le maximum, ce qui reste juste pour une police à chasse proportionnelle.

### P5 — Une table reconstruite garde sa géométrie : **passée**

Un tableau continu de six lignes et deux fragments de trois lignes à la même largeur donnent des
hauteurs de ligne **identiques** (25,53 px chacune) et un en-tête identique (25,53 px). La somme des
deux fragments dépasse le tableau continu d'exactement une hauteur d'en-tête (204,25 contre
178,72 px), ce qui est le coût annoncé de la répétition. Les largeurs de colonnes sont fixées par
`table-layout: fixed` et les `<col>` en pourcentage : elles ne dépendent pas du contenu.

### P6 — Une ligne peut être reconstruite par flux de cellules : **passée**

Traitée directement en tests permanents plutôt qu'en sonde jetable : une ligne extérieure à deux
cellules — un libellé court à gauche, un tableau interne long à droite — se fragmente sur plusieurs
pages avec les deux en-têtes répétés, le libellé écrit une seule fois, et aucun `rowspan` synthétique.

### P7 — La feuille de mesure reste inerte et hors ligne : **passée**

Le script d'un document hostile ne s'exécute **sur aucun** des chargements d'une session réutilisée,
et une requête sortante est **avortée** sur chacun.

La preuve du réseau a été renforcée par rapport à E1. L'ancienne visait `169.254.169.254`, une
adresse injoignable : un décodage manqué ne prouvait alors rien de plus que l'injoignabilité. Le test
d'E2 lance un serveur HTTP sur `127.0.0.1`, vérifie d'abord qu'il **répond** à une requête directe,
puis constate que l'image ne décode pas et que **rien** n'a atteint le serveur. Le mutant qui
remplace `abort()` par `continue()` fait maintenant rougir ce test.

---

## Les décisions

### D-1 — La coupure appartient au moteur ; Chromium fournit des mesures

Le moteur construit les fragments et choisit les coupes. L'adaptateur fournit les métriques que seul
un navigateur réel connaît : hauteurs de boîtes, fins de lignes visuelles, dimensions rendues des
images, débordements observés.

Chromium ne reçoit **jamais** le long document final avec mission de le paginer par ses règles CSS.
Cette délégation serait irréversible pour E5 : le moteur ne pourrait pas expliquer une coupe qu'il
n'a ni représentée ni choisie. Elle rendrait aussi `lastOnly`, les marqueurs dans le flux et les
tableaux imbriqués dépendants de comportements d'impression non observables depuis le DOM écran.

L'adaptateur ne reçoit toujours ni jeu de données, ni modèle, ni AST : chaque sonde est un document
HTML fermé et échappé, construit par les mêmes fonctions que le document final.

### D-2 — Une session remplace l'appel d'impression sans état

`render(source): Promise<Uint8Array>` était insuffisant : E2 doit mesurer plusieurs documents puis
imprimer le seul document final **dans le même environnement de fontes et d'images**. Le contrat
devient :

```ts
interface PdfRenderStrategy {
  readonly format: 'pdf';
  open(resources: PdfRenderResources): Promise<PdfRenderSession>;
}

interface PdfRenderSession {
  measure(document: PdfSourceDocument): Promise<PdfLayoutMeasurement>;
  print(document: PdfSourceDocument): Promise<Uint8Array>;
  close(): Promise<void>;
}
```

C'est une **rupture** du contrat public, avant 1.0 et assumée. Conserver `render()` en laissant
l'adaptateur décider la coupe aurait été plus dangereux : le moteur aurait promis une pagination
qu'il ne contrôle pas.

`createPdfRenderPort()`, `RenderRequest`, `RenderResult` et `RenderPort` sont **inchangés** :
l'intégrateur ne voit rien de cette évolution.

Une session est ouverte une fois, fermée dans un `finally` sur tous les chemins — succès, refus de
mesure, refus de pagination, échec d'impression — et n'est jamais partagée entre deux rendus. Une
session fermée refuse explicitement une nouvelle mesure. Le pooling et la concurrence restent au lot
E8 : E2 ne transforme pas une nécessité de cohérence métrique en abstraction de performance.

### D-3 — Le Pipeline gagne une étape, sans devenir une Chain of Responsibility

```text
RenderRequest → Validation → DataBinding → Pagination → DomBuild → Sanitize → PdfExport → RenderResult
```

`PaginationStep` construit et sérialise ses sondes par les mêmes fonctions fermées que le document
final : `buildFragment()` peint un fragment, que la page soit une sonde ou la feuille imprimée, et
`serializeHtml()` est le seul chemin vers une chaîne. Une étape ne retourne jamais un résultat
partiel : une mesure impossible ou incohérente lève une erreur typée, et rien ne saute silencieusement
à l'impression.

### D-4 — Une clé d'occurrence interne, jamais un identifiant public

Les `id` du modèle ne sont pas uniques une fois qu'une boucle les a répétés. La matérialisation
attribue donc une clé opaque à chaque occurrence mesurable, tirée d'un **compteur local au rendu** :
ni horloge, ni aléa, donc les mêmes données produisent deux fois les mêmes clés.

Cette clé sert à relier une demande de mesure à sa réponse et à annoter le DOM de sonde. Elle n'est
ni persistée, ni exportée dans `RenderResult`, ni promise stable entre deux rendus, et elle ne
remplace pas le `path` de diagnostic. E5 choisira l'identité publique avec toute l'ascendance
d'itération ; E2 lui laisse les fragments et les curseurs sans figer un contrat insuffisant.

Le document **final** ne porte aucune clé : deux fragments d'un même bloc partagent la clé de leur
source, et les annoter classerait deux boîtes sous un seul nom. Les clés appartiennent aux sondes.

### D-5 — Les marqueurs de page survivent à la liaison

`MaterialRun` devient une union fermée : texte déjà lié, ou marqueur typographié. Aucun `pageField`
n'est converti en chiffres pendant la liaison ; la substitution intervient quand une page finale
possède son rang, le nombre total de pages et la typographie déjà résolue du run.

Les valeurs sont des entiers décimaux canoniques, sans `Intl`, sans locale et sans séparateur. Un
marqueur est licite dans une bande, dans une cellule et dans le flux racine ; si un `TextNode` est
fragmenté, le marqueur est substitué selon la page qui contient effectivement ce run.

### D-6 — La géométrie d'un marqueur ne dépend pas de sa valeur

Un pied qui passe de `9` à `10` ne doit pas modifier la coupure qui détermine justement le nombre de
pages. Chaque marqueur reçoit donc une boîte en ligne de largeur **réservée**, capable de contenir
toute valeur possible pour ce document.

La borne de pages est calculée **avant** toute mesure, à partir des unités de progression que le
document matérialisé contient : caractères de texte liés, blocs atomiques, positions structurelles.
Une page réussie en consomme au moins une, donc le nombre de pages ne peut pas dépasser cette somme
finie. Une sonde mesure ensuite les dix chiffres décimaux de chaque signature typographique, et la
réserve vaut « chiffre le plus large × nombre de chiffres de la borne ».

**Le coût est visible et il est accepté.** Sur la facture de recette, la borne dépasse le millier :
le pied affiche « Page 1 ␣␣ / 4 » avec le blanc de la réserve. C'est le prix d'une géométrie qui ne
dépend pas de sa propre valeur, et l'alternative — chercher un point fixe en repaginant — est
exactement ce que le lot refuse. Resserrer la borne reste possible sans toucher à l'invariant.

Le marqueur est peint avec `font-kerning: none` et `font-variant-ligatures: none`, sur la même classe
que la sonde de chiffres : la largeur d'une valeur est donc la somme des avances de ses chiffres, et
la réserve la majore réellement.

### D-7 — Les bandes occupent deux réserves constantes sur toutes les pages

Pour chaque côté, le moteur mesure toutes les bandes **applicables** une fois, puis réserve la plus
haute sur **toutes** les pages :

```text
headerReserve = max(hauteur de toute bande haute pouvant apparaître)
footerReserve = max(hauteur de toute bande basse pouvant apparaître)
rootHeight    = printable.height - headerReserve - footerReserve
```

Une bande plus courte laisse du blanc dans son slot plutôt que de prêter sa hauteur au flux. Si le
flux grandissait quand la bande est courte, transformer une page supposée dernière en page
intermédiaire changerait ce qui y tient, et le nombre de pages se poursuivrait lui-même.

Le moteur commence par matérialiser les bandes applicables au cas d'**une** page — `every`,
`firstOnly`, `lastOnly`. Si la coupure produit plus d'une page, il matérialise les domaines
complémentaires, recalcule les deux maxima et recommence la coupure depuis le curseur initial.
Ajouter une bande ne peut pas refaire tenir le document sur une page : la transition est monotone,
elle a lieu **au plus une fois**, et il n'existe donc ni oscillation ni nombre arbitraire de passes.

Une bande jamais peinte n'est **jamais liée** : un `exceptFirst` sur un document d'une page ne voit
aucune de ses formules s'exécuter, et un chemin absent des données ne le fait donc pas échouer.

### D-8 — Une bande est atomique et n'entre jamais dans le flux paginé

Une bande est mesurée comme un tout après liaison. Si elle dépasse à elle seule l'aire imprimable,
refus `page-band-overflow` avec sa `region`. Si les deux réserves dépassent ensemble l'aire
imprimable, même famille de refus. Si elles la remplissent **exactement**, un document sans flux sort
quand même — ses bandes sont la page — mais le premier bloc de contenu est refusé, parce qu'aucune
coupe de ce bloc ne pourrait être imprimée.

Le moteur ne coupe, ne réduit, n'empile et ne reporte jamais une bande. `keepTogether` sur son
conteneur ne change rien : une bande est déjà atomique par sa nature de région.

### D-9 — La politique de coupure est gloutonne et garantit un progrès strict

À chaque page, le moteur prend le plus long préfixe du flux qui tient, en respectant les points de
coupe du kind. Il ne compare jamais deux mises en page selon une préférence esthétique et n'utilise
aucun aléa. Lorsqu'un candidat dépasse : le kind descend vers son point de coupe interne s'il en a
un ; sinon la page se ferme et le bloc est offert à une page neuve ; si le plus petit fragment légal
ne tient pas sur une page neuve, c'est un refus.

Une page n'est validée que si le curseur de flux a **strictement** avancé. Un tour qui reproduit le
même curseur lève `pagination-impossible`. Avec un nombre fini d'unités de progression et une avance
stricte par page, la pagination termine — sans `maxPasses`, sans compteur de tours et sans plafond de
temps. Les limites opérationnelles d'un service hostile restent au lot E8.

### D-10 — Les points de coupe, par kind

| Kind | Point de coupe | Plus petit fragment légal |
| :--- | :--- | :--- |
| `text` | entre deux lignes visuelles mesurées | une ligne complète |
| `image` | aucun | l'image entière |
| `container` | entre deux enfants, puis descente dans un enfant trop grand | un fragment légal de l'enfant |
| `table` | entre deux lignes du corps ou du pied, puis descente dans une ligne trop grande | en-tête complet et un fragment de ligne |
| `tableRow` | atomique si elle tient sur une page neuve, sinon flux coordonnés de cellules | un fragment où au moins une cellule avance |

Une image qui ne tient pas dans l'espace restant est réessayée sur une page neuve ; si sa hauteur
rendue dépasse la hauteur **du flux** d'une page admissible — réserves de bandes déduites — c'est
`oversized-atomic-resource`. La comparaison d'E1 contre toute l'aire imprimable est donc resserrée à
la vraie aire de flux, et c'est une preuve d'ablation à part entière.

Une ligne qu'aucune page ne peut contenir n'est pas refusée : le moteur fragmente les flux verticaux
de ses cellules à la fois. Toutes gardent leur colonne et leur largeur, chacune consomme le plus long
préfixe qui tient, une cellule déjà terminée reste présente et vide, la hauteur du fragment est celle
de la cellule la plus haute, et au moins une cellule doit avancer. C'est ce qui rend réellement
paginable un tableau imbriqué : un tableau interne est un enfant fragmentable ordinaire de la
cellule, et il répète son propre en-tête. Aucun `rowspan` n'est synthétisé.

### D-11 — L'en-tête se répète, le pied termine, et les filets sont recalculés

Pour chaque fragment d'un tableau : toutes les lignes de `header` sont clonées avant le contenu
continué ; aucune ligne de `footer` n'est clonée par répétition ; un fragment ne contient jamais un
en-tête répété **seul** alors qu'il reste du contenu ; si l'en-tête complet ne laisse pas la place au
plus petit fragment suivant sur une page neuve, le moteur refuse au lieu de produire des pages
d'en-tête en boucle. Un tableau vide licite reste rendu une fois, avec son éventuel en-tête.

`resolveRowRules()` est appelé **après** la coupe, sur la séquence exacte de chaque fragment. Une
frontière située entre deux pages n'est plus une frontière adjacente : elle devient une frontière
avec le périmètre du fragment, et la règle de conflit de l'ADR 0012 s'y applique telle quelle. Les
ombres calculées sur le tableau continu ne sont jamais copiées.

### D-12 — Toute boîte fragmentée est fermée sur chaque page

Un `text`, un `container`, un `table` ou une `tableRow` scindé produit plusieurs boîtes **complètes** :
le fond est peint sur toute la boîte du fragment, le padding des quatre côtés est repris, et les
filets déclarés sont repris selon les règles de conflit du contexte final.

C'est une décoration **clonée**, pas une boîte ouverte dont le fond continuerait derrière la page
suivante. Le coût — padding haut et bas répété, donc moins de lignes par page — est inclus dans la
mesure et accepté. V3 devra reproduire la même convention pour tenir la promesse aperçu/PDF ; elle
est enregistrée ici pour que le viewer ne la redécouvre pas.

### D-13 — Trois refus remplacent l'ambiguïté mono-page

| Code | Sens |
| :--- | :--- |
| `page-band-overflow` | une bande, ou la somme des réserves, rend la page structurellement impossible |
| `pagination-impossible` | aucun plus petit fragment légal ne tient, ou aucun progrès n'est possible |
| `layout-measurement-failed` | la session n'a pas fourni une mesure complète et cohérente |

`single-page-overflow` est **retiré** du tuple public et de son type. Avant 1.0, conserver un code
mort qui décrit une politique supprimée rendrait le catalogue mensonger, et aucun alias silencieux ne
transforme un refus E2 neuf en ancien refus mono-page. `oversized-atomic-resource` reste le refus
d'une image entière trop haute, et `pdf-export-failed` reste réservé à l'impression : une erreur de
mesure n'est pas renommée « export » alors qu'aucun PDF n'a été demandé.

Le type de détails gagne `pageNumber?: number | undefined`, qui est un rang et jamais une valeur de
rendu.

### D-14 — Les mesures sont finies, complètes et attribuables

Une réponse de session est refusée **avant** d'entrer dans l'algorithme si un nombre est `NaN`,
infini ou négatif là où une longueur ne peut pas l'être ; si une clé demandée manque, apparaît deux
fois ou revient sans avoir été demandée ; si un rang de ligne saute ; si un curseur recule ou si une
hauteur de ligne remonte ; si une feuille ou une zone ne correspond pas à la déclaration.

Ces types sont des contrats éphémères entre deux paquets du dépôt : construits et consommés dans une
seule session, jamais stockés, jamais acceptés depuis JSON. Ils ne portent donc ni Zod ni
`schemaVersion`, comme `MaterialDocument` en E1. Les gardes numériques restent obligatoires parce
qu'un adaptateur est un port remplaçable.

Le refus `layout-measurement-failed` ne transporte qu'un `nodeId`, un `path`, une `region`, un
`pageNumber` ou une borne sûre. Ni HTML, ni texte lié, ni source d'image, ni réponse brute.

### D-15 — La suite finale est mesurée avant d'être imprimée

Le moteur compose la suite de pages, la peint, la charge et la **mesure** : nombre de boîtes
`.ov-page`, dimensions de chaque feuille et de chaque zone imprimable, contenu de chaque slot,
décodage de chaque image, absence de nœud peint hors de sa feuille. `print()` n'est appelé qu'après,
et la session ne recharge pas le document : c'est la mise en page **prouvée** qui part à l'impression,
pas une seconde qui lui ressemble.

Un débordement du **flux** est la seule divergence que le paginateur peut corriger : la hauteur
mesurée en trop est retenue sur cette page et la coupure est reprise depuis le début. Chaque tour
retire strictement plus de hauteur à une page, donc la suite ne se répète pas. Tout le reste — page
manquante, feuille fausse, bande au-delà de sa réserve, image non décodée, boîte hors feuille — est
un refus : aucune coupe du flux ne le réparerait.

Sur la facture de recette, la boucle converge **au premier tour** : la composition arithmétique et la
mise en page réelle coïncident.

---

## Ce que le lot mesure

**1 253 tests, 44 fichiers**, contre 1 054 et 37 à la fin d'E1. Couverture globale : 92,83 % des
instructions, 90,21 % des branches, 97,80 % des fonctions, 92,72 % des lignes — au-dessus du seuil de
90 % sur les quatre métriques, sans exclusion nouvelle et sans seuil abaissé.

### Sans navigateur, sur papier quadrillé

Les oracles de coupure tournent contre une session factice **déterministe** : une police à chasse
fixe, vingt caractères par ligne, dix pixels par ligne. Une hauteur y est exactement la somme que le
paginateur calculerait pour les mêmes boîtes, donc un test qui rougit parle de l'endroit où la coupe
est tombée, jamais de l'arithmétique en dessous.

- **Bandes et numérotation** — la table des cinq domaines pour les quatre rôles de page ; les paires
  licites n'empilent jamais deux bandes ; la réserve est bien le maximum et non la dernière mesurée ;
  la transition une page → plusieurs ne lie que les domaines nouvellement atteints ; un marqueur dans
  une bande, dans le flux et dans une cellule ; `9 → 10` et `99 → 100` sans changement de boîte ;
  bande trop haute et réserves incompatibles refusées.
- **Flux et terminaison** — bloc entier, coupe entre deux frères, conteneur fragmenté aux enfants
  ordonnés, aucune page vide, curseur identique deux fois refusé, décoration sans hauteur refusée,
  page de bandes seules licite, `keepTogether` sans effet sur la coupe.
- **Texte** — tranche exacte aux curseurs, concaténation qui restitue le bloc, espaces et lignes
  vides préservés, paire de substitution et séquence emoji intactes, marqueur porté par la page qui
  le contient, typographie de chaque run conservée des deux côtés de la couture, aucun seuil de
  veuve ou d'orpheline caché.
- **Tableaux** — en-tête vide non inventé, en-tête présent répété sur chaque fragment, en-tête
  multi-lignes répété en bloc et dans l'ordre, chaque ligne du corps une fois et dans l'ordre, pied
  une seule fois et après le corps, pied repoussé sur une page suivante avec l'en-tête répété,
  filets recalculés à la coupe, colonnes identiques sur tous les fragments, ligne reportée entière
  quand une page neuve la contient.
- **Tableau imbriqué** — la ligne extérieure se fragmente, le libellé court n'apparaît qu'une fois,
  les cellules finies restent vides à leur colonne, les deux en-têtes se répètent, chaque ligne
  interne est écrite une fois et dans l'ordre.
- **Mesures** — dix-neuf réponses de session malformées, chacune refusée ; la vérification finale
  accepte une suite conforme, refuse une feuille fausse, une bande au-delà de sa réserve, une image
  non décodée et une boîte hors feuille, et **retourne** le pire débordement de flux au lieu de le
  refuser.
- **Périmètre** — un balayage lit les sources d'`engine` et de l'adaptateur, tests exclus, et refuse
  onze noms de donnée, tout `DataSchema`, et toute lecture d'horloge, de locale ou d'aléa. Le
  balayage vérifie d'abord que son propre motif reconnaît le nom qu'il cherche : une expression
  régulière abîmée ne peut pas passer en ne trouvant rien nulle part.

### Avec Chromium

- Une boîte explicite donne une page PDF : 1, 2, 4 boîtes et une feuille personnalisée, sans page
  blanche finale.
- La même mesure deux fois dans une session réutilisée, avec un autre document entre les deux.
- Les six cas de curseurs de lignes, chacun reconstruit caractère par caractère.
- La réserve de chiffres sur deux familles et deux tailles, et dix valeurs de 0 à 120.
- Le script d'un document hostile ne s'exécute sur **aucun** chargement de la session ; une requête
  vers un serveur **joignable** est avortée sur chacun, et le serveur ne voit rien passer.
- Une source d'image que le document glisserait après l'ouverture est refusée à la mesure.
- Un navigateur lancé une fois par rendu, fermé après succès et après refus, et une session fermée
  qui refuse une nouvelle mesure.

### La facture de recette, de bout en bout

Le même modèle qu'E1, ses deux apparences, et un troisième jeu de données de soixante lignes. Les
noms de champs appartiennent à la fixture ; rien du nombre soixante n'est connu du moteur.

- **Quatre feuilles A4** pour les deux apparences, aux dimensions déclarées à 0,5 pt près.
- Les deux jeux courts d'E1 sortent **toujours en une page**.
- L'en-tête de colonnes est présent une fois sur chacune des quatre feuilles.
- Les soixante lignes sont écrites une fois chacune et dans l'ordre : 19, 19, 19, 3.
- Le pied du tableau et les deux blocs qui le suivent apparaissent une seule fois, sur la dernière.
- Les marqueurs lisent `1/4`, `2/4`, `3/4`, `4/4`.
- Le pied courant `exceptLast` est sur les feuilles 1 à 3, le pied final `lastOnly` sur la 4, et la
  bande haute `every` sur les quatre.
- Une seule hauteur de slot est déclarée par côté, donc la réserve est la même partout.
- **Cinq** mesures pour tout le rendu : chiffres et hauteurs naturelles pour l'hypothèse d'une page,
  les deux mêmes une fois les domaines de bandes élargis, puis la suite composée. Soixante lignes
  n'en ajoutent pas une sixième — il n'y a pas de complexité quadratique cachée.
- Le document imprimé est **exactement** celui de la dernière mesure.

---

## La recette visuelle

Le PDF des deux apparences a été ouvert page par page avant clôture. Ce contrôle ne remplace aucun
test : il couvre la lisibilité globale, que le nombre de pages ne prouve pas.

- Aucune ligne n'est tronquée verticalement ; chaque feuille se termine sur une ligne complète.
- L'en-tête de colonnes est immédiatement visible en haut des feuilles 2, 3 et 4.
- La bande haute et le pied gardent leur alignement, le pied restant collé au bas de son slot sur
  les quatre feuilles.
- « Page n / 4 » correspond à la feuille observée à chaque fois.
- Le pied du tableau et les deux blocs suivants ne sont ni répétés ni perdus.
- Le cadre de l'apparence encadrée est **fermé** sur chacune des quatre feuilles, fond et filets
  compris.
- Aucune page blanche, aucune bande fantôme, aucun placeholder de mesure.

Un seul écart d'aspect est visible et il est voulu : le blanc de la réserve de marqueur, discuté en
[D-6](#d-6--la-géométrie-dun-marqueur-ne-dépend-pas-de-sa-valeur).

---

## Les preuves d'ablation

Chaque mutation ci-dessous a été appliquée, compilée, exécutée, puis retirée. Toutes font **rougir**
le test nommé ; une mutation qui ne compile pas, ou qui ne produit qu'une erreur de syntaxe, n'a pas
été comptée comme une preuve.

| Mutation | Ce qui rougit |
| :--- | :--- |
| ne peindre qu'une boîte `.ov-page` | la suite paginée et les oracles de la recette |
| ne pas répéter l'en-tête du tableau | cinq cas de tableau |
| répéter le pied du tableau | deux cas de tableau |
| accepter un fragment en-tête-seul | la progression du tableau |
| substituer tous les marqueurs à `1` | la matrice `1/4 … 4/4` |
| donner une largeur naturelle aux numéros | la réserve constante des marqueurs |
| ne pas substituer le compte de pages | deux cas de numérotation |
| réserver la dernière hauteur de bande au lieu du maximum | la réserve constante |
| lier toutes les bandes sans condition | la bande jamais peinte |
| couper une ligne qui tient sur une page neuve | la ligne atomique |
| refuser toute ligne surdimensionnée | les neuf cas de tableau imbriqué |
| répéter le contenu d'une cellule externe déjà finie | les neuf cas de tableau imbriqué |
| copier les règles de filet d'avant la coupe | la frontière du fragment |
| ne pas cloner le padding d'une boîte fragmentée | la décoration par fragment |
| couper le texte sur un offset inventé | sept cas de texte |
| autoriser un curseur sans progrès | la terminaison |
| comparer l'image à toute l'aire imprimable | l'image mesurée contre le flux |
| accepter une mesure `NaN` ou incomplète | sept gardes de mesure |
| imprimer sans vérifier la suite finale | la vérification finale |
| ouvrir deux sessions pour un rendu | le cycle de vie, côté moteur et côté adaptateur |
| omettre l'`await` de fermeture | cinq cas de cycle de vie |
| laisser s'exécuter le script du document | la sonde hostile |
| laisser une requête sortir de la page | le serveur joignable qui ne voit rien |
| réserver un nom de donnée dans le moteur | le balayage de périmètre |
| lire l'horloge dans le moteur | le balayage de périmètre |
| importer Puppeteer dans `engine` | `pnpm run lint` (`noRestrictedImports`) |

Deux tests ont été **renforcés** parce que leur ablation était verte, et c'est le seul intérêt de
l'exercice : la réserve de bande — la fixture déclarait la bande haute en dernier, donc « maximum »
et « dernière » coïncidaient — et le refus réseau, dont l'adresse était injoignable, si bien qu'un
décodage manqué ne prouvait rien. Un troisième s'est révélé **mensonger** avant toute ablation : le
balayage de périmètre construisait son motif dans un littéral de gabarit, où `\b` est un caractère de
retour arrière et non une frontière de mot, et ne pouvait donc rien trouver nulle part. Il porte
maintenant un témoin qui échoue si son propre motif cesse de reconnaître ce qu'il cherche.

---

## Conséquences

**Pour l'intégrateur.** `createPdfRenderPort()` garde sa surface et produit toujours un
`RenderResult` PDF. Un document long n'est plus un refus : il sort paginé. Un `single-page-overflow`
attrapé par code disparaît du catalogue, et trois refus plus précis le remplacent.

**Pour qui écrit un adaptateur.** Le contrat change : `open()` rend une session qui mesure, imprime
et se ferme. C'est plus de travail qu'une fonction d'impression, et c'est ce que coûte le fait de
décider les coupes dans le moteur plutôt que dans le navigateur.

**Pour E3.** Les primitives existent : des fragments nommés avec leur `edge`, des lignes visuelles
mesurées, des curseurs réversibles, un invariant de progrès, et `keepTogether` transporté sans
politique. Les reports, les veuves et les orphelines s'écrivent au-dessus de cela.

**Pour E5.** Les clés d'occurrence relient une mesure à sa demande sans engager l'identité publique.
Le moteur sait où il a coupé et pourquoi ; il ne le raconte pas encore.

**Pour V3.** La convention de décoration clonée (D-12) est la promesse aperçu/PDF : le viewer devra
peindre une boîte fragmentée fermée sur chaque page, jamais une boîte ouverte.

**Ce qui reste dépendant de la machine.** Toutes les décisions d'un rendu emploient une même session,
ce qui garantit la cohérence **interne** du PDF, pas l'égalité entre deux machines. La dette
`sans-serif` et l'embarquement des fontes restent au lot E6.

---

## Ce que l'exécution a corrigé du plan

1. **L'algorithme de curseurs de lignes.** Le plan mesurait le bas de chaque préfixe et cherchait par
   dichotomie. La sonde P3 a montré deux erreurs de découpage — une frontière fantôme sur un texte à
   deux tailles, une ligne vide fusionnée avec la suivante — et l'algorithme retenu mesure le
   rectangle de chaque unité. Voir
   [P3](#p3--les-curseurs-de-lignes-visuelles--passée-après-correction-de-lalgorithme).
2. **La forme de `PdfLayoutMeasurement`.** Le plan esquissait `page`, `printable` et `regions` à la
   racine. Un document paginé porte plusieurs feuilles et le plan demande lui-même de vérifier
   **chacune** : le type expose donc une liste `pages`, dont le cas mono-page d'E1 est l'élément
   unique.
3. **La recherche du plus long préfixe.** Le plan proposait de mesurer un candidat par essai, avec
   une dichotomie sur les longues séquences. L'implémentation mesure une fois les hauteurs de tous
   les points de coupe à la largeur réelle, compose la suite arithmétiquement — ce qui est exact pour
   des boîtes empilées sans marge — puis **mesure la suite entière** et reprend la coupure si le
   navigateur la dément. Le résultat est plus fort : c'est la suite imprimée qui est prouvée, et non
   chaque candidat pris isolément. Cinq mesures suffisent pour la facture de soixante lignes.
4. **La sonde de largeur des chiffres.** Le plan la plaçait dans l'adaptateur. Elle est un document
   HTML comme un autre : le moteur la construit, l'adaptateur la mesure comme n'importe quelle boîte
   annotée, et l'adaptateur n'a donc rien appris de spécial sur les marqueurs.
5. **La branche « flux vide ».** Le plan décrivait une page de bandes seules comme un cas licite. Le
   `root` d'un modèle est toujours un conteneur, donc le flux matérialisé n'est jamais une séquence
   vide : le cas licite est celui d'un conteneur racine **sans enfant**, et une hauteur de flux nulle
   est acceptée tant que rien n'a à y tenir.

---

## Ce qui reste ouvert

- **La borne de pages est large.** Elle compte les caractères, ce qui la rend correcte et lâche, et
  elle décide la largeur réservée aux marqueurs — donc le blanc visible dans un pied. La resserrer ne
  touche à aucun invariant.
- **La granularité des coupes de texte** dépend de ce que Chromium accepte de rapporter. Les six cas
  mesurés sont exacts ; une écriture que la sonde n'a pas visitée pourrait offrir moins de points de
  coupe que la typographie n'en admet. Le risque est un refus conservateur, jamais un PDF faux.
- **Aucune borne opérationnelle.** Un document dont le flux demanderait mille pages les produirait.
  E8 apportera les plafonds avant toute exposition ; le pont local du playground reste fermé à son
  catalogue.
- **L'identité des pages n'est pas publique**, et le nombre de pages n'est pas dans `RenderResult` :
  lot E5.
- **Les métadonnées PDF de Chromium** ne sont toujours pas nettoyées ; l'égalité octet à octet entre
  deux rendus n'est pas une promesse de cette version, comme en E1.
