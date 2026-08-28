# Plan d'implémentation — `@openview/engine` lot E6 : le même document, à chaque fois

> **Statut :** plan prêt à exécuter sous les mandats M-1 à M-3 — 2026-08-28  
> **Lot :** E6 — poids M annoncé, **L réel** — dépend de E4, exécuté sur la baseline E5 livrée  
> **Préalables techniques :** CH1 puis CH2 de
> [`refactoring-huit-chantiers.md`](refactoring-huit-chantiers.md)  
> **Condition de :** E7  
> **Décision d'exécution attendue :** ADR 0019

E6 ferme quatre sources de variation laissées ouvertes par E1 à E5 : la résolution des fontes par
l'hôte, le repli de glyphes vers une police système, les métadonnées temporelles de Chromium et la
preuve réellement jouée sur deux machines. Les images sont déjà embarquées et les formules sont déjà
ordonnées ; le lot ne réécrit donc ni l'algèbre ni le pipeline de pagination. Il rend leurs garanties
observables dans un artefact reproductible.

La garantie est volontairement plus précise que la phrase historique « sur deux machines » : deux
rendus sont comparables lorsqu'ils emploient le **même profil de reproductibilité** — mêmes versions
de Node/V8/ICU/Unicode, du moteur, de l'adaptateur, de Chromium, du catalogue de fontes, de la
canonicalisation PDF et même cible plateforme/architecture. Deux builds portant deux ICU différents
peuvent produire deux caractères d'espace différents ; l'ADR 0008 l'a déjà tranché et E6 ne doit pas
le contredire.

---

## 0. Résultat attendu

Pour un même modèle validé, le même jeu de données, les mêmes options moteur et le même profil de
reproductibilité :

- dix rendus PDF successifs produisent des `Uint8Array` **identiques octet pour octet** ;
- la même recette jouée sur un second runner propre produit les mêmes dix SHA-256 ;
- la pagination publique produit le même HTML autonome et le même manifeste ordonné ;
- aucune famille de police, aucun glyphe, aucune image, aucune locale, aucune horloge et aucun
  navigateur implicite ne sont résolus depuis l'hôte ;
- les PDF de production ne portent ni heure du rendu, ni agent utilisateur, ni titre `about:blank`,
  ni identifiant aléatoire ;
- un nom de police ou un caractère hors du catalogue est refusé avant toute mesure, avec une erreur
  typée qui ne recopie ni le texte lié ni le nom de donnée ;
- un navigateur personnalisé reste utilisable, mais sort explicitement du profil officiel E6.

Le PDF renvoyé par `RenderPort` est déjà la forme canonique : l'appelant n'a aucun post-traitement à
faire et ne reçoit aucun timestamp à fournir. La date métier d'une facture reste une donnée du jeu
hôte, sous le nom choisi par l'intégrateur ; elle n'est jamais confondue avec une métadonnée
technique du fichier.

### 0.1 Définition exacte de l'égalité

| Artefact | Égalité E6 |
| :--- | :--- |
| PDF | même longueur et mêmes octets ; le SHA-256 n'est que le transport de cette comparaison |
| HTML de pagination | même chaîne UTF-16, donc mêmes octets UTF-8 après encodage |
| Manifeste E5 | égalité profonde : mêmes pages, occurrences, fragments, reports et notices dans le même ordre |
| Chaînes ICU | identiques dans un même profil ; aucune comparaison entre deux profils ICU différents |
| Rendu visuel par un lecteur PDF tiers | hors preuve E6 ; V3 compare l'aperçu et le PDF, E7 fige le corpus |

« Équivalent » dans la roadmap ne signifie donc pas « à peu près le même nombre de pages ». Après
E6, deux PDF comparables qui diffèrent d'un octet constituent un échec.

### 0.2 Définition exacte de la même entrée

La comparaison porte sur :

1. le `Template` obtenu après `parseTemplate` et migrations ;
2. les valeurs réellement accessibles dans `RenderRequest.data`, avec l'ordre de leurs séquences ;
3. les `RenderEngineOptions`, notamment `presentationSelection` et les limites ;
4. la stratégie Puppeteer officielle sans exécutable personnalisé ;
5. les arguments de lancement autorisés du profil, notamment le seul besoin CI `--no-sandbox` ;
6. le profil de reproductibilité décrit au §4.

`RenderRequest` reste `{ template, data }`. Le profil n'est ni une troisième donnée métier, ni un
champ réservé dans le jeu de l'intégrateur.

---

## 1. Sources normatives et baseline réelle

### 1.1 Sources qui font foi

- [roadmap moteur, E6](../roadmap/engine.md#e6-le-même-document-à-chaque-fois) ;
- [ADR 0003](../adr/0003-formules-agregations-et-dates-civiles.md), pour l'ordre numérique, les
  dates civiles et la réserve Unicode de `textCase` ;
- [ADR 0004](../adr/0004-les-arrondis-declares-par-le-modele.md), pour les arrondis déclarés ;
- [ADR 0007](../adr/0007-l-apparence.md), décision 9 et attentes 2/3, pour le danger des noms de
  police, l'interdiction du `FontPort` et la résolution des défauts ;
- [ADR 0008](../adr/0008-langue-devise-et-formats.md), amendement A-3, pour la garantie bornée au
  même ICU ;
- [ADR 0012](../adr/0012-une-facture-d-une-page-sort-en-pdf.md), pour la dette `sans-serif`, les
  deux timestamps et les images bitmap embarquées ;
- [ADR 0013](../adr/0013-le-tableau-deborde-proprement.md), pour la session unique de mesure et
  d'impression ;
- [ADR 0014](../adr/0014-les-exigences-comptables.md), pour l'ordre des contributions de report ;
- [ADR 0017](../adr/0017-langue-et-devise-au-rendu.md), pour l'écriture ICU du même build ;
- [ADR 0018](../adr/0018-le-moteur-sait-dire-ou-il-coupe.md), pour l'HTML exact remis à
  l'imprimeur et la dette multi-machine ;
- [analyse des huit chantiers](refactoring-huit-chantiers.md), CH1 et CH2.

### 1.2 Ce que E1 à E5 ont déjà livré

| Besoin E6 | Baseline | Consigne |
| :--- | :--- | :--- |
| Formules | évaluateur borné, ordre explicite, `roundDecimal` déclaré | tester l'intégration, ne pas réécrire |
| Dates | dates civiles et `Date.UTC` seulement | aucune horloge à ajouter |
| Locale | écriture déclarée, locale honorée, UTC/calendrier/chiffres épinglés | comparer seulement un même ICU |
| Sérialisation HTML | ordre d'attributs fermé et stable | y ajouter les fontes sans second renderer |
| Pagination | mesure et impression dans une session unique | conserver la même source et les mêmes ressources |
| Images | PNG/JPEG/WebP en `data:` seulement ; réseau refusé | prouver les trois décodeurs, ne pas ouvrir E8 |
| Navigateur | Puppeteer exact `25.8.0`, Chromium téléchargé `152.0.7977.42` | profil officiel = navigateur embarqué |
| PDF | options d'impression toutes explicites | canonicaliser après `page.pdf()` |
| Aperçu | HTML autonome exact du dernier tour réussi | les fontes doivent vivre dans cette même chaîne |
| Environnement | lecture d'horloge/locale/fuseau/aléa barrée dans `core`/`engine` | rejouer les sondes Biome, ne pas modifier les règles |

### 1.3 Les six écarts réels

1. **`sans-serif` et tout nom absent retombent sur la machine.** `DEFAULT_TYPOGRAPHY` porte encore
   le générique et `cssFontFamily()` laisse cinq familles CSS génériques actives.
2. **Aucune fonte n'est embarquée.** `CONTENT_SECURITY_POLICY` écrit même `font-src 'none'`.
3. **Un glyphe absent peut retomber silencieusement sur une fonte système.** Attendre
   `document.fonts.ready` ne détecte pas ce repli.
4. **Chromium écrit le temps et l'hôte.** Le dictionnaire d'information contient `Title`, `Creator`,
   `Producer`, `CreationDate` et `ModDate`.
5. **Le navigateur personnalisé est indistinguable du profil officiel.** `executablePath` et des
   arguments libres peuvent changer le moteur de mise en page.
6. **La recette n'est pas comparée entre deux machines.** La CI a deux versions de Node sur Ubuntu,
   mais aucun échange d'artefact ne compare leurs sorties et ces deux versions ne partagent pas
   nécessairement le même ICU.

### 1.4 Sondes jouées pendant la planification

Sur Windows, Node `24.11.1`, Puppeteer `25.8.0`, Chromium `152.0.7977.42` :

- cinq rendus successifs d'un même document ont tous une longueur de `20 308` octets ;
- deux sorties créées dans la même seconde sont déjà identiques ;
- entre deux secondes, seules les positions du `CreationDate` et du `ModDate` diffèrent ;
- aucun `/ID` de trailer n'est présent ;
- trois PDF distincts passés par `pdf-lib` avec métadonnées fixes donnent le même SHA-256
  `efc07a4f56aa921c85da4f14c652e832d8829efd0dd6f686c0ae356baef3dff5` et la même longueur
  `20 436` ;
- la forme normalisée porte `D:19700101000000Z`, aucun `/ID`, et des champs texte fixes.

Ces chiffres ne deviennent pas des goldens : ils justifient l'architecture. Les tests de production
rejouent la propriété sur leurs propres fixtures.

---

## 2. Périmètre fermé

### 2.1 Inclus dans E6

- un catalogue direct de fontes incorporées dans `@openview/engine` ;
- trois familles nommées et deux alias génériques déterministes ;
- les quatre faces `regular`, `bold`, `italic`, `bold italic` de chaque famille ;
- une famille interne CSS unique par police, sans collision possible avec une installation système ;
- l'incorporation des seules faces atteignables dans chaque HTML de sonde et de production ;
- la vérification exacte des caractères contre le `cmap` de la face ;
- les refus `unsupported-font-family` et `unsupported-font-character` ;
- la CSP `font-src data:` et la vérification Chromium que chaque face déclarée est chargée ;
- la canonicalisation PDF avec métadonnées fixes ;
- `pdf-lib` comme dépendance d'exécution de l'adaptateur, déjà présent en développement ;
- un profil de reproductibilité sérialisable pour la recette, pas pour `RenderRequest` ;
- dix rendus sur deux runners propres et une comparaison automatique des SHA-256 ;
- les preuves PNG, JPEG et WebP ;
- la facture multi-page avec reports, arrondis, dates et deux écritures E4 ;
- l'ADR 0019 et la rectification de la roadmap E6 après livraison.

### 2.2 Catalogue v1 retenu

| Nom déclaré | Ressource incorporée | Usage |
| :--- | :--- | :--- |
| champ absent | `Noto Sans` | défaut moteur déterministe |
| `sans-serif` | `Noto Sans` | alias générique déterministe |
| `serif` | `Noto Serif` | alias générique déterministe |
| `Noto Sans` | `Noto Sans` | nom exact |
| `Noto Serif` | `Noto Serif` | nom exact |
| `Inter` | `Inter` | compatibilité de la fixture historique C9/E7 |

Les noms sont sensibles à la casse et ne sont ni taillés ni canonicalisés par la locale. `Arial`,
`Georgia`, `Helvetica`, `system-ui`, `monospace`, `cursive`, `fantasy`, `emoji`, `math`,
`-apple-system` et tout autre nom sont refusés. Accepter `Arial` en peignant Noto serait mentir sur la
déclaration ; laisser Chromium replier serait lire la machine.

Les deux apparences de la facture de référence passent de `Georgia`/`Arial` à
`Noto Serif`/`Noto Sans`. La fixture historique v1 reste **inchangée** et continue de demander
`Inter`.

### 2.3 Ressources exactes

- `Inter` : version 4.1, licence SIL OFL 1.1 ;
- `Noto Sans` et `Noto Serif` : release 2.015 du dépôt `notofonts/latin-greek-cyrillic`, licence
  SIL OFL 1.1 ;
- quatre TTF statiques par famille : normal 400, normal 700, italic 400, italic 700 ;
- chaque fichier est épinglé par URL amont, commit, longueur et SHA-256 dans
  `packages/engine/NOTICE` ;
- les octets base64 et les intervalles `cmap` sont générés une fois et committés dans un module
  `generated.ts` ; aucune requête ni lecture de fichier n'a lieu au rendu.

Le TTF est choisi plutôt que WOFF2 pour que le test du dépôt puisse lire son `cmap` sans dépendance
de décompression ni paquet supplémentaire. Le surcoût de taille est mesuré à INC-1 avant acceptation.

### 2.4 Exclus, avec propriétaire

| Exclu | Motif | Propriétaire |
| :--- | :--- | :--- |
| police distante, URL, fichier hôte, clé d'actif | requête sortante et politique d'autorisation | E8 |
| pile de repli déclarée dans le modèle | politique nouvelle et forme stockée | hors E6, mandat produit requis |
| arabe, hébreu, CJK, emoji et scripts non incorporés | exigent des familles et une politique de composition dédiées | extension future sur besoin réel |
| HTML ou image comme nouveau format d'export | la roadmap v1 reste PDF-only | hors v1 |
| profil ICC et identité de raster entre lecteurs PDF | distinct de l'identité binaire du fichier | V3 / décision colorimétrique future |
| corpus de PDF de référence commité | E6 compare deux productions du même run, pas une histoire | E7 |
| timeout, mémoire, concurrence, pooling | risque opérationnel | E8 |
| modification de l'algèbre ou des schémas d'expression | les garanties existent déjà | aucun changement E6 |
| champ de template pour choisir le catalogue | le nom `family` suffit | aucun changement d'AST |
| champ `today`, `locale`, `currency` ou `font` dans les données | réserverait le vocabulaire hôte | jamais |
| garantie entre deux ICU, deux Chromium ou deux plateformes distincts | l'ADR 0008 l'interdit déjà pour les chaînes | aucun |

### 2.5 Aucun versionnement d'AST

La forme stockée ne change pas : `Typography.family?: string` reste un nom libre dans `core`. Le
catalogue est une capacité de l'adaptateur officiel, comme le sous-ensemble d'images qu'il accepte.
Un moteur antérieur ne perd aucune clé et aucune union n'est élargie. Il n'y a donc ni incrément de
`schemaVersion` ni migration fantôme.

---

## 3. Mandats explicites avant exécution

### M-1 — Rectifier la garantie E6 dans la roadmap

**Recommandation : approuver.** Remplacer la comparaison absolue entre « deux machines » par la
comparaison entre deux machines portant le même profil de reproductibilité, et recopier la réserve
ICU de l'ADR 0008. Sans cette phrase, E6 publierait une promesse que C6 a déjà démontrée fausse.

### M-2 — Autoriser les changements de manifestes et les ressources tierces

**Recommandation : approuver.** Le lot doit :

- déplacer `pdf-lib@1.17.1` de `devDependencies` vers `dependencies` dans
  `packages/adapter-puppeteer/package.json` ;
- ajouter `NOTICE` aux fichiers publiés par `packages/engine/package.json` ;
- embarquer douze fontes TTF sous OFL, encodées dans le build de `engine` ;
- mettre à jour `pnpm-lock.yaml` pour la classe de dépendance, sans nouvelle version ni dérogation
  `minimumReleaseAgeExclude`.

`AGENTS.md` §7 interdit ces fichiers sans mandat explicite. E6 n'est pas exécutable honnêtement sans
ce mandat ; une regex PDF faite maison ou une police système seraient des contournements, pas des
solutions.

### M-3 — Autoriser la preuve inter-machines dans `.github/workflows/ci.yml`

**Recommandation : approuver.** Ajouter deux jobs identiques sur `ubuntu-24.04` et Node `24.11.1`,
qui produisent chacun un manifeste de dix SHA-256 ; un troisième job les compare. Les actions de
checkout, upload et download d'artefact restent épinglées à un SHA complet selon la convention du
workflow. Les quatre portes existantes restent inchangées et la matrice Node 24/26 reste une preuve
de compatibilité, pas une preuve de reproductibilité.

Le workflow est protégé par `AGENTS.md` §7. Un test local joué deux fois ne satisfait pas le mot
« machines » de la roadmap.

---

## 4. Profil de reproductibilité

### D1 — Le profil est une preuve technique, jamais une donnée de rendu

Le profil est construit par l'outil de recette autour du moteur. Il ne traverse ni `RenderRequest`,
ni `Template`, ni `PaginationResult`, ni `RenderResult`.

```ts
interface ReproducibilityProfile {
  readonly platform: string;
  readonly architecture: string;
  readonly node: string;
  readonly v8: string;
  readonly icu: string;
  readonly unicode: string;
  readonly engine: string;
  readonly adapter: string;
  readonly puppeteer: string;
  readonly chromium: string;
  readonly fonts: readonly { readonly id: string; readonly sha256: string }[];
  readonly pdfCanonicalizer: 1;
  readonly launchArguments: readonly string[];
}
```

Le profil est sérialisé avec des clés dans un ordre fixe. Le comparateur refuse d'abord deux profils
différents, puis compare les sorties. Il ne masque jamais une divergence de version sous une erreur
de document.

### D2 — Le profil officiel emploie le Chromium téléchargé par Puppeteer

Puppeteer ne garantit sa compatibilité qu'avec son navigateur incorporé. La recette officielle ne
passe donc aucun `executablePath`. Un appelant peut continuer d'en passer un ; son résultat est
fonctionnel, mais n'est pas couvert par l'attestation E6.

Les arguments de lancement sont triés et recopiés dans le profil. Le défaut de production reste sans
argument. La CI peut porter `--no-sandbox`, déjà nécessaire sur son runner, à condition que les deux
jambes portent exactement la même liste.

### D3 — Même profil ne signifie pas même version majeure flottante

`node-version: 24` est insuffisant pour la recette : un patch Node peut changer V8, ICU ou Unicode.
La baseline du plan est Node `24.11.1` sur `ubuntu-24.04`. Si l'une de ces deux cibles disparaît, la
mise à jour est une décision visible dans l'ADR et le profil, jamais un flottement silencieux. La
matrice générale conserve `24` et `26` pour détecter les incompatibilités futures, mais ses sorties
ne sont jamais comparées entre elles.

---

## 5. Fontes déterministes

### D4 — Le catalogue vit directement dans `engine`

Le moteur décide déjà la typographie par défaut, écrit le CSS, compose les sondes et publie l'HTML
autonome. C'est donc le seul endroit où une fonte incorporée peut rester identique pour la mesure, le
PDF et le viewer.

Il n'y a ni `FontPort`, ni callback, ni registre dynamique. Un second adaptateur de fontes n'existe
pas et `AGENTS.md` le refuse nommément. Le catalogue est un module de données fermé, versionné avec le
build moteur.

### D5 — Une famille déclarée devient une famille CSS interne unique

Chaque famille porte un nom interne impossible à demander depuis le modèle, par exemple
`__openview_noto_sans_2_015`. `runCss()` n'écrit jamais le nom déclaré et jamais une pile :

```css
font-family:"__openview_noto_sans_2_015"
```

Le navigateur ne peut donc ni préférer une installation locale de `Noto Sans`, ni continuer après la
famille incorporée. `font-synthesis:none` interdit une graisse ou une italique inventée par le
navigateur ; les quatre faces sont présentes.

### D6 — Le défaut devient `Noto Sans`, pas un générique CSS

`DEFAULT_TYPOGRAPHY.family` cesse d'être `'sans-serif'` et devient l'identité interne de Noto Sans.
`'sans-serif'` et `'serif'` sont résolus avant la génération CSS. `cssFontFamily()` n'a plus à
connaître les cinq mots-clés génériques ; il ne reçoit que le nom interne fermé.

### D7 — Un nom absent est refusé sur l'occurrence atteinte

Le schéma `core` continue d'accepter tout nom. Pendant la matérialisation, le moteur résout la famille
effective du run. Une branche fausse ou une boucle vide n'est pas refusée pour une famille qu'elle ne
peint jamais, comme une image inaccessible n'est pas remise à l'adaptateur.

Le refus porte :

- `code: 'unsupported-font-family'` ;
- `nodeId`, chemin du segment, région et occurrence répétée si elle existe ;
- un message constant ;
- ni nom de famille recopié, ni texte, ni valeur liée.

### D8 — Le `cmap` exact barre tout repli de glyphe

Chaque face incorporée porte les intervalles de points de code réellement présents dans son `cmap`.
Après liaison et écriture E4, chaque `MaterialTextRun.text` est parcouru par points de code Unicode.
Les tabulations, retours de ligne et contrôles de structure admis par HTML sont traités explicitement ;
tout autre point absent de la face lève `unsupported-font-character` avec la même localisation sûre.

Les marqueurs de page sont couverts aux deux endroits qui créent leurs caractères :

- les échantillons réels de `markerSignatures()` avant mesure ;
- la chaîne finale de `markerText()` avant sérialisation de chaque page.

Un `MaterialPageFieldRun` conserve pour cela une localisation interne sûre construite à la
matérialisation (`nodeId`, chemin du segment, région et occurrence). Elle ne contient aucune valeur,
ne traverse aucun contrat public et permet aux deux étapes tardives de rendre le même refus précis
que le binding initial.

Le point de code, le glyphe et la chaîne ne voyagent pas dans `details`, car un caractère peut venir
du jeu de données hôte.

### D9 — Le module généré est vérifié contre ses propres octets

Le module `generated.ts` exporte, par face : base64 TTF, SHA-256, longueur et intervalles `cmap`. Un
test type-checké :

1. décode le base64 ;
2. vérifie longueur et SHA-256 ;
3. lit les tables TTF `cmap` format 4/12 avec un lecteur test local sans dépendance ;
4. compare exactement les intervalles générés ;
5. vérifie les métadonnées de famille, graisse et style attendues.

Une fonte remplacée sans régénérer sa couverture rend donc la porte rouge.

### D10 — Seules les faces utilisées entrent dans l'HTML

Après matérialisation, `walkBlocks(document)` de CH1 collecte les faces des runs atteignables. Elles
sont triées dans l'ordre fixe du catalogue, puis chaque HTML de sonde et de production reçoit le même
préfixe `@font-face`. Une facture en Noto Sans normal n'embarque pas les onze faces inutilisées.

Le CSS utilise des URI `data:font/ttf;base64,…` et la CSP devient `font-src data:`. Le réseau reste
fermé ; aucune URL du modèle n'entre dans un `@font-face`.

### D11 — Chromium prouve le chargement, pas seulement l'attente

Après `setContent`, la session attend `document.fonts.ready`, puis inspecte toutes les `FontFace`
déclarées. Une face en état `error`, absente ou non chargée produit
`layout-measurement-failed` avant que `measureInPage()` ou `print()` ne tourne.

`PDF_OPTIONS.waitForFonts: true` reste explicite : la vérification de session protège la mesure, et
l'option protège le contrat d'impression si Puppeteer change la séquence interne.

### D12 — Les trois HTML emploient le même CSS de fontes

Le préfixe est injecté par un seul helper dans :

- `buildMarkerProbe()` ;
- `buildProbeTree()` ;
- `buildPagedTree()`.

Oublier l'une des trois voies change soit les réserves, soit les coupures, soit le PDF. Un test
structurel compare le bloc `@font-face` des trois sources, et la recette Chromium mesure une phrase
qui change de ligne avec une police de l'hôte.

---

## 6. Images déterministes

### D13 — E6 conserve la frontière bitmap embarquée

PNG, JPEG et WebP restent les seules sources acceptées par l'adaptateur, sous forme base64 `data:`.
La source exacte fait partie de l'entrée ; aucun fetch, fichier, cache HTTP, en-tête, DNS ou horloge
n'entre dans le rendu.

E6 ajoute des fixtures valides des trois formats et prouve :

- dimensions intrinsèques identiques sur dix mesures ;
- même nombre de pages et mêmes coupures ;
- PDF canonicalisé identique ;
- une image corrompue et une source distante gardent leurs refus existants ;
- aucune normalisation ou ré-encodage de l'image n'est fait côté Node.

Les différences entre versions de décodeur sont absorbées par le profil Chromium. Une image distante
ou une clé d'actif reste E8.

---

## 7. Canonicalisation PDF

### D14 — Le PDF est réécrit par une bibliothèque, pas patché par regex

La sonde actuelle ne voit que deux chiffres variables, mais une montée Chromium peut ajouter un
`/ID`, déplacer l'Info dictionary ou activer les object streams. Remplacer une sous-chaîne dans des
octets PDF serait dépendre de la disposition interne observée aujourd'hui.

`canonicalizePdf(bytes)` vit dans `@openview/adapter-puppeteer` et emploie `pdf-lib` :

1. `PDFDocument.load(bytes, { updateMetadata: false })` ;
2. fixe `Title`, `Creator` et `Producer` à `Openview` ;
3. fixe `Author`, `Subject` et `Keywords` à la chaîne vide ;
4. fixe création et modification à l'instant Unix zéro ;
5. retire toute autre entrée du dictionnaire Info et supprime `context.trailerInfo.ID` ;
6. sauvegarde sans page par défaut, sans mise à jour d'apparence et sans object streams ;
7. renvoie les nouveaux octets.

La fonction reçoit les octets de Chromium et ne lit ni horloge, ni variable d'environnement, ni
fichier. `new Date(0)` est une constante de sérialisation dans l'adaptateur, jamais « aujourd'hui ».

### D15 — La canonicalisation fait partie de l'export

`PdfRenderSession.print()` retourne la forme canonique. Le pipeline `engine` reste inchangé et
continue de considérer toute erreur inconnue comme `pdf-export-failed`. Aucun appelant ne peut
recevoir le PDF brut par la façade publique.

La stratégie factice de `engine` garde ses quatre octets arbitraires : la canonicalisation appartient
à l'adaptateur réel, pas au port abstrait.

### D16 — Les invariants PDF sont vérifiés après réécriture

Les tests rechargent la sortie avec `pdf-lib` et contrôlent :

- signature PDF, nombre de pages et tailles ;
- présence des fontes incorporées et des trois images ;
- couleurs, filets, textes et calques déjà vérifiés par les recettes E1–E5 ;
- métadonnées exactes ;
- absence de `/ID` sur le build épinglé ;
- égalité binaire de plusieurs entrées ne différant que par les timestamps Chromium.

Si une montée de Chromium introduit un identifiant que `pdf-lib` conserve, le test échoue : la montée
doit alors décider comment le canonicaliser, jamais desserrer l'assertion.

---

## 8. Formules, ICU et environnement

### D17 — E6 intègre les preuves existantes au lieu de réimplémenter

La recette contient au moins :

- addition, soustraction, multiplication et division ;
- agrégation ordonnée de valeurs dont l'ordre IEEE-754 serait observable ;
- arrondis `halfEven`, `halfUp`, `towardZero`, positifs et négatifs ;
- une date civile fournie ;
- `textCase` sur `ß`, `ﬀ` et `İ` ;
- reports de page arrondis avant écriture ;
- FR/EUR et EN/USD sur deux exécutions séparées du même profil.

Les oracles métier restent dans les tests C1/C2/E3/E4. E6 n'affirme que la stabilité de leur résultat
intégré.

### D18 — Aucun golden ne fige une chaîne entre ICU

Le manifeste inter-machines porte l'ICU. Le comparateur refuse deux profils différents avant de lire
les hashes. Les tests de formatage continuent de comparer le moteur au formateur `core` du même
processus. E7 pourra figer un PDF seulement avec son profil complet à côté.

### D19 — Les gardes d'environnement existants restent la porte

E6 rejoue la sonde jetable de l'ADR 0003 pour confirmer que Biome refuse dans `core` et `engine` :

- constructeur `Date`, `Date.now`, `Date.parse` et getters locaux ;
- `Math.random`, `process.env`, `performance.*`, `globalThis.*` ;
- `toLocale*`, `Intl.*` sans locale et `DateTimeFormat` sans `timeZone` en ligne ;
- les trois angles morts documentés par une revue ciblée.

Le lot ne modifie ni `biome.jsonc` ni `tools/biome/*.grit`. Le profil de recette peut lire
`process.versions`, `platform` et `arch` parce qu'il **observe** l'environnement pour décider si deux
sorties sont comparables ; ces lectures restent hors `core` et `engine`.

---

## 9. Préalables CH1 et CH2

### 9.1 CH1 avant le catalogue

E6 ajoute une collecte des faces à travers `MaterialDocument`. Écrire un huitième `switch` de
descente violerait la règle Visitor et reproduirait la dette déjà inventoriée. CH1 livre d'abord :

- `visitBlock()` pour la répartition par kind ;
- `walkBlocks(document)` pour les descentes pures ;
- l'équivalent pour `MaterialFragment` ;
- les tests d'exhaustivité.

La collecte de fontes E6 consomme `walkBlocks`, elle n'en crée pas un clone.

### 9.2 CH2 avant l'attestation

`measureInPage()` décide aujourd'hui les frontières de ligne dans 227 lignes invisibles à la
couverture Node. Une attestation de reproductibilité construite sur une décision non mesurable serait
une promesse sans porte.

CH2 doit avoir livré avant INC-5 : collecte DOM autonome minimale, dérivation pure testable côté
Node, cas de lignes mixtes/vides/sous-pixel, et plancher de couverture de l'adaptateur. La modification
de `vitest.config.ts` nécessaire à ce plancher requiert son propre mandat explicite ; E6 ne la glisse
pas dans un commit de fontes.

---

## 10. Contrats internes et erreurs

### 10.1 Forme interne du catalogue

```ts
type BundledFontFamilyId = 'inter-4.1' | 'noto-sans-2.015' | 'noto-serif-2.015';

interface BundledFontFace {
  readonly family: BundledFontFamilyId;
  readonly cssFamily: string;
  readonly weight: 400 | 700;
  readonly style: 'normal' | 'italic';
  readonly data: string;
  readonly byteLength: number;
  readonly sha256: string;
  readonly codePoints: readonly (readonly [number, number])[];
}
```

Ces types restent internes. `ResolvedTypography` porte l'identité de face résolue, pas un nom libre.
`typographySignature()` emploie cette identité stable.

### 10.2 Nouveaux codes

| Code | Site | Détails sûrs |
| :--- | :--- | :--- |
| `unsupported-font-family` | matérialisation d'un run atteint | `nodeId`, `path`, `region`, `occurrence` |
| `unsupported-font-character` | texte lié/formaté ou marqueur | mêmes détails, plus `pageNumber` si connu |

Un échec de chargement d'une face est `layout-measurement-failed`, car la source était valide mais
le backend n'a pas pu établir sa géométrie. Une erreur de parsing/sauvegarde PDF est
`pdf-export-failed` par la façade existante.

### 10.3 Contrats publics inchangés

- `RenderRequest`, `RenderResult`, `RenderPort` ;
- `PaginationPort`, `PaginationResult` et leurs schémas ;
- `PdfRenderStrategy`, `PdfRenderSession`, `PdfSourceDocument` ;
- `Template`, `Typography` et `schemaVersion` ;
- `RenderEngineOptions`.

Le profil E6 et le catalogue ne gonflent aucune enveloppe publique.

---

## 11. Carte des fichiers

### 11.1 `@openview/engine`

| Fichier | Changement |
| :--- | :--- |
| `src/document/fonts/types.ts` | ids, faces et familles internes |
| `src/document/fonts/generated.ts` | TTF base64, hashes et `cmap`, générés |
| `src/document/fonts/catalogue.ts` | table fermée et aliases |
| `src/document/fonts/resolve.ts` | résolution de famille/face et refus |
| `src/document/fonts/coverage.ts` | test des points de code sans fuite |
| `src/document/fonts/css.ts` | `@font-face` ordonnés pour les faces utilisées |
| `src/document/fonts/collect.ts` | collecte via `walkBlocks()` de CH1 |
| `src/document/fonts/index.ts` | façade locale |
| `src/document/typography.ts` | défaut Noto Sans et résolution de face |
| `src/document/materialize.ts` | détails de site et validation des textes atteints |
| `src/document/types.ts` | face résolue dans `ResolvedTypography`, localisation sûre des marqueurs |
| `src/pagination/markers.ts` | couverture des échantillons ICU/canoniques |
| `src/html/build.ts` | couverture des marqueurs finaux, famille interne |
| `src/html/build-page.ts` | même préfixe de fontes dans les trois arbres |
| `src/html/serialize.ts` | CSP `font-src data:` |
| `src/errors.ts` | deux codes fermés |
| `src/**/__tests__/*` | résolution, couverture, CSS, répétition HTML et erreurs |
| `NOTICE` | versions, hashes, URLs et textes OFL |
| `package.json` | publier `NOTICE`, sous M-2 |

### 11.2 `@openview/adapter-puppeteer`

| Fichier | Changement |
| :--- | :--- |
| `src/canonicalize-pdf.ts` | chargement, métadonnées fixes et sauvegarde déterministe |
| `src/session.ts` | contrôle des `FontFace`, canonicalisation après `page.pdf()` |
| `src/__tests__/fixtures.ts` | JPEG/WebP valides, inspecteur de métadonnées et hashes |
| `src/__tests__/font-environment.test.ts` | fonte chargée, fonte cassée, zéro repli système |
| `src/__tests__/pdf-determinism.test.ts` | timestamps, metadata, dix sorties |
| `src/__tests__/reproducibility-recipe.test.ts` | recette locale complète |
| `package.json` | `pdf-lib` en dépendance d'exécution, sous M-2 |

### 11.3 Recette, CI et documentation

| Fichier | Changement |
| :--- | :--- |
| `tools/reproducibility/render.mjs` | construit le profil, rend dix fois, écrit un manifeste JSON |
| `tools/reproducibility/compare.mjs` | refuse les profils différents puis compare les vingt sorties |
| `.github/workflows/ci.yml` | deux producteurs et un comparateur, sous M-3 |
| `packages/adapter-puppeteer/src/__tests__/reference-document.ts` | Noto Serif/Noto Sans |
| `apps/playground/src/examples/reference-invoice.ts` | mêmes familles déclarées |
| `docs/adr/0019-le-meme-document-a-chaque-fois.md` | décisions et mesures exécutées |
| `docs/roadmap/engine.md` | E6 livré, garantie profilée, recette mesurée |
| `docs/plans/refactoring-huit-chantiers.md` | CH1/CH2 marqués livrés s'ils le sont |

---

## 12. Plan de tests

### P1 — Catalogue et aliases

Table exhaustive : absence, deux génériques et trois noms exacts réussissent ; variantes de casse,
espaces, dix indirections machine de l'ADR 0007 et familles CSS restantes sont refusées. Les quatre
combinaisons graisse/italique sélectionnent chacune la face attendue.

**Porte :** aucune chaîne non cataloguée n'atteint `runCss()`.

### P2 — Intégrité des fontes

Pour les douze faces : base64, longueur, SHA-256, `cmap`, famille, graisse, style et licence. Muter un
octet ou un intervalle doit faire rougir.

**Porte :** le catalogue décrit exactement les octets qu'il embarque.

### P3 — Couverture des caractères

Cas positifs : ASCII, accents français, ligatures, grec/cyrillique couvert, U+00A0, U+202F, euro,
moins, ponctuation et combinaisons accentuées. Cas négatifs : emoji, CJK, arabe, caractère privé,
surrogate isolé et caractère absent d'une face.

Jouer chaque négatif en littéral, binding, résultat `concat`/`textCase`, argent/date ICU, numéro de
page et report. Vérifier que le message et les détails ne contiennent pas le caractère ni la valeur.

**Porte :** aucune voie de texte ne peut déclencher une fonte de l'hôte.

### P4 — HTML autonome avec fontes

Comparer sonde de marqueurs, sonde naturelle, tour de stabilisation et source finale : même
`@font-face`, même ordre, seules les faces utilisées, `font-synthesis:none`, aucune pile, aucune URL
non `data:` et CSP `font-src data:`.

**Porte :** l'HTML E5 suffit seul à retrouver la typographie du PDF.

### P5 — Chargement Chromium

Une face valide atteint `loaded`; une base64 corrompue et une CSP mutée atteignent un refus avant la
mesure. Une phrase choisie pour couper différemment en police système garde la coupure du catalogue.

**Porte :** `document.fonts.ready` n'est jamais pris pour une preuve de succès à lui seul.

### P6 — Images

`it.each` PNG/JPEG/WebP : dimensions intrinsèques, mesure, page et bytes canonicalisés. Ajouter un
document avec les trois images et un second rendu dix fois. Conserver les tests source distante,
SVG, MIME non listé, image corrompue et image surdimensionnée.

**Porte :** même source bitmap + même Chromium = mêmes bytes.

### P7 — Canonicalisation unitaire

Fournir deux PDF Chromium ne différant que par leurs dates et Creator ; contrôler une sortie
identique. Vérifier toutes les métadonnées, l'absence d'ID, le rechargement, les pages et les objets
d'image/font.

**Porte :** la fonction ne dépend ni de l'instant d'appel ni de la disposition brute du dictionnaire.

### P8 — Pipeline PDF réel, dix fois

Rendre la facture de soixante lignes dix fois dans un processus, avec reports, blocs insécables,
calques, Noto Sans/Noto Serif, PNG, formules, dates et écriture FR/EUR. Comparer longueur, octets,
nombre de pages et source HTML capturée.

Rejouer EN/USD séparément sans comparer FR à EN.

**Porte :** dix hashes identiques par écriture.

### P9 — Pagination E5, dix fois

Appeler `createPaginationPort()` dix fois avec la même recette. Comparer l'HTML, la feuille, les
pages, occurrences, fragments, reports et notices. Vérifier qu'aucun `print()` n'a lieu.

**Porte :** E6 stabilise aussi la source du viewer, pas seulement le post-traitement PDF.

### P10 — Formules et arrondis

Sur une facture courte factice, rendre les vecteurs de D17 deux fois sans navigateur et dix fois avec
Chromium. Comparer les caractères produits avant mesure, les reports entrants et le PDF.

**Porte :** changer l'ordre d'une somme ou substituer un arrondi JS ordinaire fait rougir un oracle
existant et la recette intégrée.

### P11 — Profil

Sérialisation exacte et ordre fixe. Retirer Node, ICU, Chromium, un hash de fonte ou un argument doit
faire échouer le test de forme. Deux profils différents doivent être refusés avant la comparaison des
hashes, même si leurs fichiers coïncident par hasard.

**Porte :** aucune attestation ne traverse une frontière de build non comparable.

### P12 — Deux machines

Deux jobs indépendants, même Node exact et même cible Ubuntu : chacun installe depuis le lockfile,
construit, rend dix fois et publie seulement profil, longueurs et SHA-256. Le comparateur télécharge
les deux JSON et exige un profil égal et vingt hashes égaux.

**Porte :** supprimer une fonte incorporée, la canonicalisation ou un champ du profil rend la CI
rouge sans golden PDF commité.

### P13 — Navigateur personnalisé

Observer que la stratégie officielle lance le browser incorporé. Un `executablePath` fourni est
recopié comme mode non attesté par l'outil ; il ne peut pas produire un manifeste officiel. Les tests
de sandbox E1 restent verts.

**Porte :** un Chrome local ne peut pas se faire passer pour le build E6.

### P14 — Fuites et erreurs

Pour famille et caractère refusés, causes `pdf-lib` et chargement de fonte : vérifier code, message
constant, détails fermés, `cause` locale seulement, fermeture page/contexte/browser et aucune sortie
partielle.

**Porte :** aucun texte, nom de donnée, source image, HTML ou PDF brut dans les messages.

---

## 13. Matrice de mutations

| Mutation volontaire | Test qui doit rougir |
| :--- | :--- |
| remettre `sans-serif` comme défaut CSS | P1/P4 |
| laisser `Arial` atteindre Chromium | P1 |
| ajouter une seconde famille en repli | P4 |
| retirer `font-synthesis:none` | P4 |
| accepter un caractère absent du `cmap` | P2/P3 |
| oublier les marqueurs dans la couverture | P3/P8 |
| incorporer toutes les faces sans tri | P4 et budget de taille |
| garder `font-src 'none'` | P5 |
| attendre `document.fonts.ready` sans vérifier les faces | P5 |
| ne fontifier que la sonde naturelle | P4/P8 |
| retourner directement `page.pdf()` | P7/P8 |
| fixer `CreationDate` mais pas `ModDate` | P7 |
| préserver l'agent utilisateur | P7 |
| sauver avec les métadonnées automatiques de `pdf-lib` | P7/P8 |
| normaliser par regex et déplacer le dictionnaire | P7 |
| comparer Node 24 à Node 26 comme même profil | P11 |
| omettre ICU du profil | P11 |
| attester un `executablePath` local | P13 |
| recharger une image distante | tests E1/E2 + P6 |
| modifier l'ordre d'une somme de report | tests E3 + P10 |
| appeler `Intl` une seconde fois dans le viewer/pagination | P9 et contrat E5 |

Chaque mutation est appliquée, compilée, testée puis restaurée. Les mutations de workflow sont
vérifiées sur une branche d'exécution, jamais simulées par une assertion tautologique.

---

## 14. Incréments d'implémentation

### INC-0 — Livrer CH1 puis CH2

1. terminer le Visitor/parcours de `MaterialBlock` et `MaterialFragment` ;
2. extraire la dérivation pure de mesure ;
3. couvrir les frontières de lignes et le sous-pixel ;
4. obtenir les quatre portes vertes ;
5. ne démarrer E6 qu'avec `walkBlocks()` disponible.

**Sortie :** la collecte de fontes et la preuve de coupure ont une base mesurable.

### INC-1 — Acquérir et vérifier les fontes

1. obtenir les douze TTF depuis les releases/commits épinglés ;
2. enregistrer licences, URLs, commits, longueurs et SHA-256 ;
3. générer base64 et `cmap` ;
4. écrire le lecteur TTF test-only ;
5. jouer P2 et mesurer taille source, build, HTML une face et HTML facture ;
6. faire relire la conformité OFL avant fusion.

**Sortie :** catalogue d'octets auditable, sans runtime ni dépendance nouvelle.

### INC-2 — Résoudre familles, faces et caractères

1. ajouter les types/catalogue internes ;
2. changer le défaut ;
3. résoudre la face au site de matérialisation ;
4. valider le texte lié et formaté ;
5. valider échantillons et marqueurs finaux ;
6. ajouter les deux erreurs et leurs tests de fuite.

**Sortie :** aucun texte atteignable ne peut demander une ressource de l'hôte.

### INC-3 — Incorporer les faces dans l'unique HTML

1. collecter les faces via CH1 ;
2. produire les `@font-face` dans l'ordre fixe ;
3. préfixer les trois arbres HTML ;
4. ouvrir `font-src data:` ;
5. vérifier les `FontFace` dans la session ;
6. jouer P4/P5 et les tests E5 d'égalité source imprimée/source publiée.

**Sortie :** mesure, PDF et viewer reçoivent les mêmes octets de fontes.

### INC-4 — Canonicaliser le PDF

1. appliquer M-2 sur `pdf-lib` ;
2. écrire `canonicalizePdf()` ;
3. brancher après `page.pdf()` ;
4. jouer P7 sur PDF synthétiques et Chromium ;
5. rejouer toute la recette adaptateur ;
6. vérifier l'audit de production.

**Sortie :** deux temps d'impression différents produisent les mêmes octets.

### INC-5 — Fermer la recette locale E6

1. remplacer Arial/Georgia dans les deux fixtures de référence ;
2. ajouter JPEG/WebP ;
3. intégrer les vecteurs formules/arrondis/dates/ICU ;
4. rendre dix fois PDF et pagination ;
5. mesurer temps, mémoire, taille HTML/PDF et nombre d'ouvertures Chromium ;
6. jouer la matrice de mutations locale.

**Sortie :** le critère E6 est vrai dans un environnement propre.

### INC-6 — Prouver sur deux machines

1. appliquer M-3 ;
2. écrire les deux outils sans dépendance ;
3. épingler le Node exact de la recette ;
4. lancer deux jobs producteurs ;
5. comparer profils et vingt hashes ;
6. confirmer qu'aucun PDF ni donnée de recette n'est publié comme artefact durable.

**Sortie :** le mot « machines » de la roadmap est une porte automatique.

### INC-7 — ADR et clôture

1. écrire ADR 0019 avec mesures avant/après et divergences du plan ;
2. rectifier E6 dans la roadmap sous M-1 ;
3. marquer E6 livré seulement après un run CI inter-machines vert ;
4. transmettre à E7 le profil et la canonicalisation, pas un corpus anticipé ;
5. documenter limites de scripts, navigateur personnalisé et poids des fontes.

**Sortie :** E7 peut commencer sur une sortie stable et une garantie honnête.

---

## 15. Ordonnancement et commits

| Ordre | Commit logique | Ne mélange pas |
| :--- | :--- | :--- |
| 0 | CH1 | fontes/PDF |
| 1 | CH2 | fontes/PDF/workflow |
| 2 | ressources + intégrité + NOTICE | résolution runtime |
| 3 | catalogue + résolution + refus | CSS/PDF |
| 4 | CSS embarqué + chargement Chromium | canonicalisation PDF |
| 5 | canonicalisation PDF + dépendance | recette/workflow |
| 6 | recette locale et images | workflow |
| 7 | preuve inter-machines | ADR |
| 8 | ADR 0019 + roadmaps | code de production |

Chaque commit laisse `lint`, `build` et `type-check` verts. La couverture complète est jouée au moins
après chaque incrément de production, puis une dernière fois sur l'ensemble.

---

## 16. Portes de validation

Dans l'ordre CI exact :

```bash
pnpm run lint && pnpm run build && pnpm run type-check && pnpm run test:coverage
```

Puis :

1. tests ciblés `engine/src/document/fonts/**` ;
2. tests ciblés `adapter-puppeteer` avec Chromium réel ;
3. recette locale dix fois en FR/EUR puis EN/USD ;
4. audit production `pnpm audit --audit-level=high --prod --ignore-registry-errors` ;
5. job inter-machines complet ;
6. matrice de mutations ;
7. inspection du package publié à blanc : `dist`, `LICENSE`, `NOTICE`, aucune ressource manquante ;
8. vérification que `@openview/engine` seul n'installe toujours ni Puppeteer ni Chromium.

### 16.1 Mesures à consigner dans ADR 0019

- versions Node/V8/ICU/Unicode/Puppeteer/Chromium ;
- SHA-256 et tailles des douze faces ;
- taille installée de `engine` avant/après ;
- taille HTML une face, deux familles et facture complète ;
- taille PDF brut/canonique ;
- temps médian et maximum des dix rendus par runner ;
- hashes des vingt sorties du run d'acceptation ;
- couverture globale et par paquet après CH2/E6 ;
- résultat de chaque mutation.

---

## 17. Risques et signaux de réouverture

| Risque | Filet | Signal |
| :--- | :--- | :--- |
| package de fontes trop lourd | faces utilisées seulement, mesure INC-1 | dépassement du budget accepté en ADR |
| HTML autonome volumineux | même base64 pour preview/PDF, mesure E5 | transport réel trop lent ou manifeste > borne |
| script réel non couvert | refus typé, jamais fallback | deux intégrateurs demandent le même script |
| montée Chromium change le PDF | version exacte + P7/P12 | métadonnée/ID nouveau ou hash différent |
| montée ICU change une chaîne | profil + aucune comparaison croisée | profil identique mais chaîne différente |
| `pdf-lib` altère une structure | rechargement et recettes visuelles/structurelles | tag, image, fonte ou page perdu |
| CI trop lente | deux jobs parallèles, une seule recette de 10 | durée durablement disproportionnée |
| exécutable personnalisé revendique E6 | profil non attesté | besoin client d'attester un Chrome géré |
| nouvelle police demandée | catalogue fermé, ajout audité | deux modèles réels la demandent |
| nouveau format image | capacité fermée | besoin réel + décodeur déterministe mesuré |

### 17.1 Limites qui restent vraies après E6

- Deux builds ICU différents peuvent produire des espaces différents.
- Deux cibles plateforme/architecture différentes ne sont pas déclarées comparables sans une sonde
  dédiée qui permettrait d'élargir le profil.
- Le PDF peut rester DeviceRGB sans profil ICC ; l'identité binaire ne prouve pas que deux écrans
  non calibrés donnent la même couleur perçue.
- Les polices distantes et images distantes restent refusées jusqu'à E8.
- E6 ne remplace ni la comparaison aperçu/PDF de V3 ni le corpus historique d'E7.

---

## 18. Checklist de sortie

- [ ] M-1, M-2 et M-3 approuvés ;
- [ ] CH1 et CH2 livrés avant le code E6 ;
- [ ] catalogue limité à Inter/Noto Sans/Noto Serif et douze faces exactes ;
- [ ] hashes, `cmap` et licences vérifiés ;
- [ ] aucun générique CSS ni nom hôte dans l'HTML final ;
- [ ] famille et caractère non couverts refusés sans fuite ;
- [ ] marqueurs, ICU et textes liés passent la couverture ;
- [ ] mêmes fontes dans les trois voies HTML ;
- [ ] toutes les `FontFace` chargées avant mesure ;
- [ ] PNG/JPEG/WebP stables ;
- [ ] métadonnées PDF fixes et absence d'ID ;
- [ ] dix PDF locaux identiques en FR/EUR ;
- [ ] dix PDF locaux identiques en EN/USD ;
- [ ] dix `PaginationResult` identiques ;
- [ ] deux profils CI identiques et vingt hashes PDF identiques ;
- [ ] navigateur personnalisé non attesté ;
- [ ] aucune modification de `RenderRequest`, de l'AST ou de `schemaVersion` ;
- [ ] aucune dépendance nouvelle hors reclassement de `pdf-lib` ;
- [ ] aucun `minimumReleaseAgeExclude` ajouté ;
- [ ] quatre portes vertes dans l'ordre ;
- [ ] audit production vert ;
- [ ] mutations jouées et restaurées ;
- [ ] ADR 0019 et roadmap mises à jour après, jamais avant, la preuve inter-machines.

E6 est terminé uniquement lorsque le PDF **renvoyé au client**, et non un dérivé de test, satisfait
l'égalité binaire sur les deux machines du même profil. À cet instant seulement E7 peut commencer à
figer une histoire.
