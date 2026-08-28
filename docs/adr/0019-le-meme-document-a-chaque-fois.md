# ADR 0019 — Le même document, à chaque fois

- **Statut :** 🟢 **Accepté** (2026-08-28) — implémenté, mesuré, et la porte inter-machines est
  **verte en CI** : deux runners indépendants, vingt rendus, une seule empreinte par document
  (voir [§ Ce qu'il fallait pour dire « livré »](#ce-quil-fallait-pour-dire--livré-)).
- **Date :** 2026-08-28
- **Impact :** `@openview/engine` (un catalogue de fontes incorporées, une identité de face dans
  `ResolvedTypography`, deux codes de refus, la CSP ouverte aux octets embarqués, un visiteur de
  blocs matérialisés), `@openview/adapter-puppeteer` (canonicalisation PDF, vérification du
  chargement des faces, dérivation de mesure sortie du navigateur), `tools/fonts` et
  `tools/reproducibility` (outillage), `.github/workflows/ci.yml` (deux producteurs et un
  comparateur). `@openview/core`, `@openview/designer` et `@openview/viewer` sortent du lot
  **inchangés**.
- **`RenderRequest` reste `{ template, data }`.** Le profil de reproductibilité est une preuve
  technique construite *autour* du moteur : il ne traverse ni la requête, ni le `Template`, ni
  `PaginationResult`, ni `RenderResult`.
- **Aucune version de template, aucune migration.** La forme stockée ne change pas :
  `Typography.family` reste un nom libre dans `core`. Le catalogue est une **capacité du build**,
  comme le sous-ensemble d'images que l'adaptateur accepte — un moteur antérieur ne perd aucune clé
  et aucune union n'est élargie.
- **Mandats exercés :** M-2 (manifestes, ressources tierces) et M-3 (workflow), plus le mandat
  `vitest.config.ts` qu'appelait CH2. **M-1 a été accordé après le merge** et exercé dans le suivi :
  [`docs/roadmap/engine.md`](../roadmap/engine.md) énonce désormais la garantie **profilée** — voir
  [§ Ce que M-1 a rectifié](#ce-que-m-1-a-rectifié).
- **Plan d'implémentation :**
  [docs/plans/e6-le-meme-document-a-chaque-fois.md](../plans/e6-le-meme-document-a-chaque-fois.md)
  — les écarts sont au [§ Ce que l'exécution a corrigé du plan](#ce-que-lexécution-a-corrigé-du-plan).
- **Préalables livrés dans le même lot :** CH1 (visiteur de `MaterialBlock`) et CH2 (dérivation de
  mesure hors du navigateur), de
  [refactoring-huit-chantiers.md](../plans/refactoring-huit-chantiers.md).

---

## Contexte

E1 à E5 produisaient un document correct, jamais un document *reproductible*. Quatre sources de
variation restaient ouvertes, et aucune n'était visible dans une porte :

1. `DEFAULT_TYPOGRAPHY.family` valait `'sans-serif'`, et `cssFontFamily()` laissait passer cinq
   génériques CSS : la police était choisie par la machine qui imprimait.
2. Aucune fonte n'était incorporée — `CONTENT_SECURITY_POLICY` écrivait même `font-src 'none'`.
3. Un glyphe absent retombait silencieusement sur une police système ; attendre
   `document.fonts.ready` ne détecte pas ce repli.
4. Chromium écrivait l'heure de l'impression, son propre nom et le titre `about:blank` dans le
   dictionnaire d'information du PDF.

Deux rendus du même document, à une seconde d'intervalle, différaient donc par leurs octets — et
rien ne le disait.

---

## Décisions

### 1. Le catalogue de fontes vit dans `engine`, sans port ni registre

Le moteur décide déjà la typographie par défaut, écrit le CSS, compose les sondes et publie l'HTML
autonome : c'est le seul endroit où une fonte incorporée peut rester identique pour la mesure, le
PDF et l'aperçu. Il n'y a ni `FontPort`, ni callback, ni registre dynamique — un second adaptateur
de fontes n'existe pas, et la règle anti-sur-ingénierie d'`AGENTS.md` §3 le refuse nommément. Le
catalogue est un module de données fermé, versionné avec le build.

### 2. Trois familles, douze faces, aucune autre

`Inter 4.1`, `Noto Sans 2.015` et `Noto Serif 2.015`, quatre faces chacune (400/700 × normal/italic),
toutes sous SIL OFL 1.1. Les noms déclarés acceptés sont exactement : champ absent, `sans-serif`,
`serif`, `Noto Sans`, `Noto Serif`, `Inter`. **Sensibles à la casse, jamais taillés, jamais
canonicalisés par une locale** : décider que `noto sans` et `Noto Sans` désignent la même famille
serait une règle sur les polices de l'hôte, et replier la casse demanderait une locale que le moteur
n'a pas le droit de lire.

`Arial`, `Georgia`, `Helvetica`, `system-ui`, `monospace`, `cursive`, `fantasy`, `emoji`, `math`,
`-apple-system` et tout autre nom sont **refusés**. Accepter `Arial` en peignant Noto serait mentir
sur la déclaration ; laisser Chromium replier serait lire la machine.

### 3. Une famille déclarée devient une famille CSS interne, sans pile

Chaque famille porte un nom qu'aucun modèle ne peut demander — `__openview_noto_sans_2_015` — et
`runCss()` écrit `font-family:"__openview_noto_sans_2_015"` **seul**, sans virgule derrière. Le
navigateur ne peut donc ni préférer une installation locale de Noto Sans, ni continuer au-delà de la
face incorporée. `font-synthesis:none` interdit une graisse ou une italique inventée : les quatre
faces sont présentes, une face synthétisée serait une forme que ce build n'a jamais mesurée.

`ResolvedTypography` cesse de porter un nom libre et porte la **face résolue**. Les booléens
`bold`/`italic` disparaissent de cette structure : la graisse et l'inclinaison vivent dans la face,
donc aucun run ne peut demander une graisse que sa face ne porte pas, et deux sources de vérité ne
peuvent pas diverger.

### 4. Le défaut moteur est Noto Sans, pas un générique

`DEFAULT_TYPOGRAPHY` est désormais construit par le résolveur lui-même. `sans-serif` et `serif`
restent acceptés, mais comme **alias résolus avant la génération CSS** : `cssFontFamily()` et
`cssString()` n'ont plus d'appelant et sont supprimés.

### 5. Le `cmap` exact barre tout repli de glyphe

Chaque face publie les intervalles de points de code réellement présents dans son `cmap`. Après
liaison et écriture ICU, chaque texte atteint est parcouru par points de code ; tabulation, saut de
ligne et retour chariot sont admis explicitement comme instructions de mise en page ; tout autre
point absent de la face lève `unsupported-font-character`.

**Trois voies, pas une :** le texte lié à la matérialisation, les échantillons de
`markerSignatures()` avant mesure, et la chaîne finale de `markerText()` avant sérialisation. Un
`MaterialPageFieldRun` conserve pour cela une localisation interne sûre (`nodeId`, chemin, région,
occurrence) construite à la matérialisation : elle ne contient aucune valeur et ne traverse aucun
contrat public. Sans elle, les deux étapes tardives sauraient qu'un caractère est refusé mais pas
lequel des marqueurs du document l'a produit.

### 6. Ni le caractère, ni son point de code, ni la chaîne ne voyagent

`unsupported-font-family` porte `nodeId`, `path`, `region` et `occurrence` — **jamais le nom demandé**.
`unsupported-font-character` porte les mêmes, plus `pageNumber` quand il est connu — **jamais le
caractère**. Un nom de famille vient d'un modèle que l'appelant ne contrôle pas toujours, et un
caractère peut venir du jeu de données de l'intégrateur ; un message est une chose qui se journalise.

### 7. Seules les faces atteintes entrent dans l'HTML

`usedFaces()` collecte les faces des runs joignables via le parcours livré par CH1, **triées dans
l'ordre du catalogue** et non dans l'ordre où la marche les a rencontrées : deux rendus du même
document émettent la même feuille quelles que soient les données. Une facture en Noto Sans normal
n'embarque pas les onze faces inutilisées.

### 8. Les trois arbres HTML reçoivent la même chaîne, construite une fois

`documentFontCss()` est appelé **une fois par matérialisation** dans `compose.ts`, et la chaîne
obtenue est passée à `buildMarkerProbe()`, `buildProbeTree()` et `buildPagedTree()`. Le paramètre
est obligatoire : un appelant ne peut pas l'oublier. Recalculée après `extendBands()`, parce qu'une
bande que seule une deuxième page atteint peut peindre une famille que la première passe n'a jamais
rencontrée.

C'est plus fort que « les trois calculent la même chose » : les trois reçoivent le **même objet**.

### 9. Chromium prouve le chargement, il ne l'attend pas

`document.fonts.ready` se résout que les faces aient chargé **ou échoué** : l'attendre ne prouve
rien. Et une face déclarée que la page courante ne peint pas reste `unloaded` pour toujours — la
sonde de marqueurs, qui ne peint que des échantillons, en déclare plusieurs dans ce cas.

La session **force** donc le chargement de chaque `FontFace` déclarée, puis vérifie que toutes sont
`loaded`. Une face cassée produit `layout-measurement-failed` **avant** que la mesure ou
l'impression ne tournent. Seuls des compteurs reviennent de la page : les noms de famille
appartiennent au document, pas à l'adaptateur.

### 10. Le PDF est réécrit par une bibliothèque, jamais patché par regex

`canonicalizePdf()` recharge le fichier avec `pdf-lib`, fixe `Title`/`Creator`/`Producer` à
`Openview`, vide `Author`/`Subject`/`Keywords`, écrit les deux dates à l'époque Unix, **supprime
toute autre entrée du dictionnaire Info** et **supprime l'identifiant de trailer**, puis sauvegarde
sans object streams et sans page par défaut.

Remplacer une sous-chaîne dans des octets PDF dépendrait de la disposition que le navigateur produit
aujourd'hui : une montée de Chromium qui déplacerait le dictionnaire, ajouterait un `/ID` ou
activerait les object streams cesserait silencieusement de canonicaliser quoi que ce soit.

**La date est un littéral, pas un `Date`.** `D:19700101000000Z` est écrit directement dans les deux
entrées : l'adaptateur ne construit aucun objet `Date` et ne lit aucune horloge. Le plan prévoyait
`new Date(0)` en admettant que ce serait « une constante de sérialisation » ; la garde d'environnement
du dépôt interdit le constructeur `Date` dans `engine` **et** dans l'adaptateur, et l'écrire en
littéral supprime le besoin de la dérogation plutôt que de la demander.

### 11. La canonicalisation fait partie de l'export

`PdfRenderSession.print()` retourne la forme canonique. **Aucun appelant ne peut recevoir les octets
bruts par la façade publique.** La stratégie factice d'`engine` garde ses quatre octets arbitraires :
la canonicalisation appartient à l'adaptateur réel, pas au port abstrait.

### 12. Le profil est une preuve technique, jamais une donnée de rendu

Treize champs — plateforme, architecture, Node, V8, ICU, Unicode, moteur, adaptateur, Puppeteer,
Chromium, les douze empreintes de fontes, la version du canonicaliseur et les arguments de lancement
triés — sérialisés dans un **ordre fixe**. Le comparateur refuse deux profils différents **avant** de
lire une seule empreinte, et nomme le champ qui diffère : dire « les documents diffèrent » alors que
les deux ICU diffèrent serait un mensonge.

Le profil **observe** l'environnement pour décider si deux sorties sont comparables ; c'est
précisément pourquoi il vit dans `tools/`, hors de `core` et d'`engine`.

### 13. Le profil officiel emploie le Chromium téléchargé par Puppeteer

Aucun `executablePath` n'est passé par la recette : Puppeteer ne garantit sa compatibilité qu'avec
son navigateur incorporé. Un appelant peut continuer d'en passer un — son résultat est fonctionnel,
mais n'est pas couvert par l'attestation. Les arguments de lancement sont triés et recopiés dans le
profil : la CI porte `--no-sandbox`, et les deux jambes doivent porter exactement la même liste ou la
comparaison est refusée.

---

## Ce que CH1 et CH2 ont apporté, et pourquoi ils étaient des préalables

### CH1 — le visiteur de `MaterialBlock`

La collecte de fontes est un huitième parcours de l'union des blocs matérialisés. L'écrire à la main
aurait reproduit la dette qu'`AGENTS.md` §3.B interdit. `document/traverse.ts` livre `visitBlock()`
(répartition par kind, exhaustivité vérifiée à la compilation), `childBlocksOf()`, `rowsOf()`,
`walkBlocks()`, `documentAreas()`, `walkDocument()` et `flowBlocks()`.

**Sept `switch (block.kind)` dupliqués deviennent un seul**, et les **quatre** réécritures du
parcours de document (`images.ts`, `markers.ts`, `progress.ts`, `metrics.ts`) deviennent une. Le
littéral `'Unhandled materialised block'` passe de sept occurrences à une.

### CH2 — la mesure redevient mesurable

`measure.ts` est sérialisé et évalué **dans Chromium** : la couverture V8 tourne dans Node et ne peut
pas l'instrumenter. 227 lignes décidant où les pages sont coupées annonçaient 0 %, et l'annonceraient
toujours. Une attestation de reproductibilité bâtie sur une décision non mesurable serait une
promesse sans porte.

La fonction en page est réduite à de la **collecte** — rectangles, insets et longueurs bruts — et
toute la **dérivation** vit dans `derive.ts`, en Node : frontières de ligne, seuil sous-pixel de
0,5 px, hauteur de contenu d'une région, quatre comparaisons de débordement et le comptage des
marqueurs tronqués. `vitest.config.ts` déclare un plancher pour `adapter-puppeteer` et exclut
`measure.ts`, **parce qu'il ne contient plus de décision** ; y ramener de l'arithmétique la remettrait
hors de portée, et c'est cela — pas l'exclusion — qu'une revue doit refuser.

**Effet mesuré sur la couverture globale :** 94,16 % → 98,64 % en instructions, **90,57 % → 96,20 %
en branches**. La marge de 0,74 point sur le plancher de 90 % que citait l'analyse des huit chantiers
n'existe plus.

---

## Mesures exécutées

Profil de la machine de développement : `win32/x64`, Node `24.11.1`, V8 `13.6.233.10-node.28`,
ICU `77.1`, Unicode `16.0`, Puppeteer `25.8.0`, Chromium `152.0.7977.42`.

### Poids

| Mesure | Avant | Après |
| :--- | ---: | ---: |
| `@openview/engine` — `dist` | 0,37 Mio | **7,39 Mio** |
| dont les douze faces | — | 7,01 Mio |
| tarball `pnpm pack` (gzip) | — | 3,4 Mio |
| HTML autonome, une face | — | 0,551 Mio |
| HTML autonome, apparence *rust* (2 faces) | — | 1,23 Mio |
| HTML autonome, apparence *framed* (4 faces) | — | 2,44 Mio |
| PDF brut → canonique | 14 372 o | 14 456 o (+0,6 %) |

**Le coût est réel et il est assumé :** `engine` est vingt fois plus gros. C'est le prix de la
garantie — un moteur qui n'embarque pas ses fontes ne peut pas promettre le même document ailleurs.
Le budget est à rouvrir si un intégrateur le refuse ; le levier connu est le sous-ensemblage des
faces, qui casserait la traçabilité octet-pour-octet vers les releases amont (§ 2.3 du plan).

### Reproductibilité

| Recette | Pages | PDF | Rendus | Empreintes distinctes |
| :--- | ---: | ---: | ---: | ---: |
| *framed navy serif* | 5 | 195 441 o | 10 | **1** |
| *rust sans-serif* | 4 | 180 071 o | 10 | **1** |
| `PaginationResult` (framed) | 5 | — | 10 | **1** (égalité profonde) |

Temps de rendu, dix exécutions : médiane 2,09 s / max 2,31 s (*framed*), médiane 1,79 s / max 2,00 s
(*rust*). Deux processus indépendants sur la même machine produisent les mêmes vingt empreintes.

### Portes

`lint`, `build`, `type-check`, `test:coverage` : **vertes**, 2 161 tests. Couverture globale
97,60 % / 95,00 % / 98,97 % / 97,63 % (instructions / branches / fonctions / lignes).
`pnpm audit --audit-level=high --prod` : aucune vulnérabilité connue. Le tarball d'`engine` contient
`NOTICE`, les douze modules de faces, et **aucune dépendance Puppeteer ou Chromium**.

### Matrice de mutations

**14 mutations sur 14 détectées.** Les deux qui ne l'étaient pas au premier passage ont révélé de
vraies lacunes, corrigées :

- *écrire une pile de polices derrière la famille incorporée* : l'assertion cherchait une virgule
  dans la forme non échappée, alors qu'un style en ligne est un attribut et sort `&quot;` ;
- *retirer `icu` du profil* : aucun test ne vérifiait la **forme** du profil, seulement son
  comportement — un champ retiré des deux côtés à la fois rendait le comparateur aveugle en silence.

---

## Ce que l'exécution a corrigé du plan

### La facture de référence ne tient plus sur quatre feuilles, et c'est un fait, pas un réglage

Le plan demandait de remplacer `Georgia`/`Arial` par `Noto Serif`/`Noto Sans` dans les deux fixtures.
Les métriques de Noto ne sont pas celles des polices de l'hôte : l'apparence *framed* passe à **cinq**
feuilles, l'apparence *rust* reste à **quatre**. Le tableau s'arrête à la quatrième dans les deux cas ;
c'est la queue de l'état (mentions, coordonnées de paiement) qui réclame la cinquième.

Réduire `sizePt` pour retrouver « quatre » a été mesuré et **écarté** : à 7, 7,5 et 8 points, le
tableau occupe toujours quatre feuilles. Le nombre de feuilles n'était donc pas réglable par la
taille, et il n'a jamais été le contrat — « soixante lignes » l'est.

**Les assertions absolues sont devenues relationnelles.** « L'en-tête est répété sur les quatre
pages » devient « sur exactement les feuilles que le tableau atteint, et sur aucune autre » ; « le
report est porté sur les feuilles deux à quatre » devient « sur toutes sauf la première ». Ces
énoncés sont ceux que les domaines de bandes déclarent réellement, et ils survivent au prochain
changement de face — ce que les nombres ne faisaient pas.

### Le module généré est découpé en douze, pas en un

Le plan prévoyait un `generated.ts` unique. À 6,89 Mio de base64, Biome **saute** le fichier — sa
limite est un mébioctet — et affiche un avertissement à chaque `lint`. Le fichier serait alors sorti
du formateur, des règles et du plugin d'environnement, et la façon naturelle de faire taire
l'avertissement serait de toucher `biome.jsonc`, qu'`AGENTS.md` §7 interdit.

Un module par face (686 Kio au plus) et un baril `generated.ts` qui les ordonne : **tous les octets
générés restent sous les mêmes contrôles que le code écrit à la main**, sans une ligne de
configuration modifiée. Le fichier nommé par la carte du plan existe toujours.

### La date canonique est un littéral, pas un `Date`

Voir décision 10 : la dérogation que le plan envisageait n'était pas nécessaire.

### Le lecteur TTF est écrit deux fois, volontairement

`tools/fonts/ttf.mjs` génère la couverture ; `engine/src/document/fonts/__tests__/ttf.ts` la
re-dérive des octets incorporés et la compare. Deux implémentations indépendantes : une face
remplacée sans régénérer sa couverture rougit, ce qu'un lecteur partagé ne pourrait pas détecter.

### Les fixtures JPEG et WebP sont produites par Chromium, une fois

Aucun encodeur d'image n'est disponible en Node et le plan n'autorise aucune dépendance nouvelle. Les
deux images sont encodées une fois par Chromium, puis **committées en base64** — exactement le
traitement réservé aux fontes. Rien n'encode d'image au moment des tests.

---

## Ce qui reste vrai après E6

- **Deux builds ICU différents peuvent produire des espaces différents.** L'ADR 0008 l'a déjà
  tranché ; le comparateur refuse la comparaison plutôt que de la maquiller.
- **Deux cibles plateforme/architecture différentes ne sont pas déclarées comparables.**
- Le PDF reste DeviceRGB sans profil ICC : l'identité binaire ne prouve pas que deux écrans non
  calibrés donnent la même couleur perçue.
- **Arabe, hébreu, CJK, emoji** et tout script hors des trois familles sont **refusés**, pas
  approximés. Un besoin réel rouvre le catalogue ; le refus typé est la réponse honnête en attendant.
- Les polices distantes et les images distantes restent refusées jusqu'à E8.
- E6 ne remplace ni la comparaison aperçu/PDF de V3, ni le corpus historique d'E7.
- `dist/__tests__/` est publié dans le tarball d'`engine`. **Antérieur à ce lot** — le `tsconfig`
  n'exclut que `*.test.ts` — et laissé tel quel : le corriger sortait du périmètre E6.

---

## Ce que M-1 a rectifié

Le lot a d'abord été livré **sans** M-1 : la roadmap moteur promettait le même document « sur deux
machines », sans qualifier lesquelles, et cet ADR portait seul le périmètre réel de la garantie. Le
mandat a été accordé au lot de suivi, et [`docs/roadmap/engine.md`](../roadmap/engine.md) dit
maintenant ce que E6 démontre :

- la comparaison porte sur deux machines **portant le même profil de reproductibilité** — même Node,
  même V8, même ICU, même Unicode, même Chromium, même catalogue, même canonicaliseur, même cible,
  mêmes arguments de lancement ;
- la réserve ICU de l'[ADR 0008](0008-langue-devise-et-formats.md) (attente **E4-6**, l'espace
  insécable de `fr-FR` qui passe de U+00A0 à U+202F avec CLDR 42 / ICU 72) y est recopiée : c'est la
  raison la plus concrète pour laquelle la garantie absolue est fausse ;
- le critère de recette passe de « dix fichiers équivalents » à « dix fichiers identiques octet pour
  octet », ce qui est à la fois plus exigeant et exactement ce qui est mesuré.

La garantie absolue entre deux machines quelconques reste fausse, et C6 l'avait déjà démontrée
fausse. La différence est qu'aucun des deux documents ne la promet plus.

---

## Ce qu'il fallait pour dire « livré »

Le plan est explicite : E6 est terminé lorsque le PDF **renvoyé au client** satisfait l'égalité
binaire sur deux machines du même profil. À cet instant :

- [x] catalogue limité à Inter / Noto Sans / Noto Serif, douze faces exactes ;
- [x] empreintes, `cmap` et licences vérifiés à chaque exécution ;
- [x] aucun générique CSS ni nom d'hôte dans l'HTML final ;
- [x] famille et caractère non couverts refusés sans fuite ;
- [x] marqueurs, ICU et textes liés passent la couverture ;
- [x] mêmes fontes dans les trois voies HTML ;
- [x] toutes les `FontFace` chargées avant mesure ;
- [x] PNG / JPEG / WebP stables ;
- [x] métadonnées PDF fixes et absence d'`/ID` ;
- [x] dix PDF locaux identiques par apparence et par écriture ;
- [x] dix `PaginationResult` identiques ;
- [x] navigateur personnalisé non attesté ;
- [x] aucune modification de `RenderRequest`, de l'AST ou de `schemaVersion` ;
- [x] aucune dépendance nouvelle hors reclassement de `pdf-lib` ;
- [x] aucun `minimumReleaseAgeExclude` ajouté ;
- [x] quatre portes vertes, audit production vert ;
- [x] mutations jouées et restaurées ;
- [x] **deux profils CI identiques et vingt empreintes PDF identiques** — verts au merge du
      2026-08-28 sur deux runners `ubuntu-24.04` indépendants, Node `24.11.1` ;
- [x] **M-1** — la roadmap énonce la garantie profilée (§ ci-dessus).

Toutes les cases sont cochées : le statut passe à 🟢 et E7 peut commencer à figer une histoire.
