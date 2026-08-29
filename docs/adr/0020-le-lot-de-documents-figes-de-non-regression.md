# ADR 0020 — Le lot de documents figés de non-régression

- **Statut :** 🟡 **Accepté, amorçage en cours** (2026-08-29) — le harnais, la porte, les tests et
  le job CI sont livrés et verts ; **les six PDF de référence ne sont pas encore committés**, parce
  qu'ils ne peuvent l'être qu'après un run officiel Ubuntu, une revue visuelle des 21 pages et une
  acceptation explicite (voir [§ Ce qu'il reste à faire pour dire « livré »](#ce-quil-reste-à-faire-pour-dire--livré-)).
- **Date :** 2026-08-29
- **Impact :** `tools/golden/` (sept modules d'outillage), `tests/golden/e7/references/` (le dossier
  du lot et son mode d'emploi), `packages/adapter-puppeteer/src/__tests__/` (trois suites de
  harnais), `.github/workflows/ci.yml` (un job bloquant). **`@openview/core`, `@openview/engine`,
  `@openview/designer`, `@openview/viewer` et `@openview/adapter-puppeteer` sortent du lot sans une
  ligne de production modifiée.**
- **Aucune dépendance ajoutée.** `pdf-lib` était déjà une dépendance d'exécution de l'adaptateur,
  `zod` une dépendance de `core` ; `node:crypto`, `node:fs` et `node:path` font le reste.
  `package.json`, `pnpm-lock.yaml` et `pnpm-workspace.yaml` sont inchangés.
- **Aucun contrat stocké ne bouge.** Ni `Template`, ni ses nœuds, ni `RenderRequest`, ni
  `PaginationResult` ne gagnent un champ : **pas d'incrément de `schemaVersion`, pas de migration**.
  Le manifeste E7 porte son propre `formatVersion`, parce que c'est un contrat de test distinct.
- **Mandats exercés :** M-2 (job E7 dans `.github/workflows/ci.yml`). **M-1 (six PDF binaires dans
  Git) est accordé mais pas encore exercé** : rien de binaire n'entre avant l'amorçage.
- **Plan d'implémentation :**
  [docs/plans/e7-le-lot-de-documents-figes-de-non-regression.md](../plans/e7-le-lot-de-documents-figes-de-non-regression.md)
  — les écarts sont au [§ Ce que l'exécution a corrigé du plan](#ce-que-lexécution-a-corrigé-du-plan).

---

## Contexte

E6 a rendu le document reproductible : la même facture, dix fois, sur deux machines du même profil,
donne les mêmes octets. Cette porte compare deux productions **contemporaines**. Aucune d'elles n'a
jamais ouvert un document produit le mois dernier.

Sept écarts restaient donc ouverts :

1. aucun PDF n'est committé — rien ne se souvient de ce que le client recevait ;
2. les recettes sont dispersées entre E1 et E6 et ne forment pas un corpus énumérable ;
3. le comparateur E6 compare deux machines, ne lit ni PDF ni page, et ne peut nommer aucune page ;
4. la fixture historique v1 de C9 est parsée, migrée, parcourue et évaluée — jamais **rendue** ;
5. aucun profil n'accompagne un golden : une comparaison lancée depuis un autre ICU annoncerait une
   fausse régression ;
6. aucun chemin d'approbation n'est sûr — un `-u` quelque part suffirait à bénir une différence ;
7. une modification volontaire du rendu peut laisser toute la suite verte si aucune assertion
   structurelle ne vise ce détail.

Le lot E7 est le premier filet de sécurité du projet : c'est lui qui rend la suite tenable.

---

## Décisions

### 1. E7 appartient au dépôt et à l'adaptateur, jamais au moteur publié

Le rendu réel dépend de Puppeteer, qui doit rester hors d'`@openview/engine` (AGENTS.md §2). Les
outils vivent dans `tools/golden/`, les références dans `tests/golden/e7/references/`, les tests du
harnais dans `packages/adapter-puppeteer/src/__tests__/`. Le libellé « lot `@openview/engine` » de
la roadmap désigne la capacité testée, pas un droit d'embarquer Chromium dans le paquet moteur.

Vérifié à blanc : les cinq tarballs publiables ne contiennent ni `tests/golden`, ni `tools/`, ni un
seul `.pdf`.

### 2. Les candidats passent par les deux façades publiques

Chaque scénario est exécuté deux fois, séquentiellement :
`createPaginationPort().paginate()` fournit l'HTML et le certificat E5, puis
`createPdfRenderPort().render()` fournit le PDF client. E5 prouve déjà que les deux voies composent
le même HTML ; E7 ne capture aucune fonction interne du pipeline et ne construit jamais un
`PaginatedDocument` à la main. Deux sessions Puppeteer par document sont le prix honnête d'un test
de deux contrats publics — le pooling appartient à E8.

### 3. Le PDF complet est l'oracle principal, et il est comparé octet par octet

La réussite exige l'égalité des longueurs **puis** l'égalité de chaque octet, lue sur les deux
fichiers. Les empreintes du manifeste résument et accélèrent ; elles ne décident jamais. Un test
dédié le prouve en réécrivant le manifeste d'un candidat pour qu'il réclame l'empreinte de la
référence : les deux fichiers sont quand même déclarés différents, et le mensonge du manifeste est
nommé (`is not the file its own manifest attests`).

### 4. L'extraction mono-page est un diagnostic conservateur, versionné

Pour chaque rang : `PDFDocument.load()` sans toucher aux métadonnées, `copyPages()`, ajout
explicite, `save()` sans object streams ni page par défaut, puis le **même `canonicalizePdf()`** que
le document livré — sans quoi l'instant de la création se retrouverait dans les octets extraits.

Une fonte sous-ensemble partagée peut faire différer plusieurs pages alors qu'une seule a gagné un
glyphe : c'est un sur-diagnostic accepté, il nomme un ensemble conservateur et n'en masque aucun.
L'extracteur porte `pageExtractorVersion: 1` ; un manifeste qui annonce une autre version est refusé
**avant** qu'une empreinte soit interprétée.

### 5. Le certificat E5 localise la sémantique de la coupure

Le certificat d'une page est le JSON canonique de son `PaginationPageResult` et des notices dont
`pages` contient ce rang. Il couvre placements ordonnés, régions, rôles, fragments, report entrant
et lignes achevées. Il ne contient ni HTML, ni mesure, ni curseur, ni valeur liée. `sheet` et la
liste globale des notices ont en plus leur propre empreinte au niveau du document.

### 6. L'HTML reste opaque et n'est jamais découpé par sélecteur

Le harnais enregistre sa longueur UTF-8 et son SHA-256, et rien d'autre : ni `split`, ni parse DOM,
ni requête CSS. Les classes et la structure restent privées comme E5 l'exige. Quand cette empreinte
bouge, le rapport nomme le document et considère **toutes** ses pages potentiellement affectées ; le
PDF mono-page et les certificats précisent ensuite.

L'HTML n'est pas committé : depuis E6 il incorpore les fontes en base64, et le recopier six fois
alourdirait le dépôt sans ajouter d'oracle.

### 7. Le profil E6 accompagne le lot, et il est coupé en deux moitiés

Le générateur appelle `profileOf()` : E7 ne maintient pas une deuxième liste, le schéma du manifeste
**construit** sa forme depuis `PROFILE_FIELDS`. Les treize champs sont ensuite partitionnés :

- **hôte** — `platform`, `architecture`, `node`, `v8`, `icu`, `unicode`, `launchArguments` : une
  différence ici est refusée **avant** qu'un octet soit lu, parce que les deux runs n'étaient jamais
  comparables. Une génération locale sert à inspecter, jamais à accepter.
- **renderer** — `engine`, `adapter`, `puppeteer`, `chromium`, `fonts`, `pdfCanonicalizer` : échec
  de profil **et** diagnostic complet des documents, parce que c'est exactement ce qu'une montée
  volontaire de Chromium a besoin de montrer pour être relue.

Une union des deux moitiés égale à `PROFILE_FIELDS`, et une intersection vide, sont vérifiées par
test : aucun champ ne peut sortir de la comparaison en glissant entre les deux.

### 8. Le manifeste est validé avec Zod 4, à sa frontière et une seule fois

`tools/golden/manifest.mjs` résout `zod/v4` depuis `core` et applique `safeParse` à la lecture. Le
schéma est **strict** et refuse : version inconnue du format, du générateur ou de l'extracteur, SHA
non hexadécimal ou de mauvaise longueur, longueur nulle ou négative, id ou nom de fichier dupliqué,
rangs non continus, chemin absolu, `..`, séparateur de chemin, extension autre que `.pdf`, clé
inconnue et tableau de documents vide.

Le message d'erreur nomme le **chemin du fichier** et les champs fautifs, jamais le contenu lu :
c'est un texte publié comme artefact de CI.

Le schéma reste dans l'outillage. Le placer dans `@openview/core` ferait d'un format de test un
contrat produit dont un intégrateur pourrait dépendre.

### 9. Chaque entrée rendue possède une empreinte canonique, et le JSON canonique refuse

Le canonicaliseur trie les clés d'objet par point de code, conserve l'ordre des tableaux, et
**refuse** `undefined`, fonction, symbole, `bigint`, nombre non fini et cycle — en nommant le chemin.
Refuser est le point : `JSON.stringify` *supprime* silencieusement un champ qu'il ne sait pas
écrire, et un champ supprimé est une fixture modifiée qu'aucune empreinte ne verrait.

L'entrée couvre le `Template` **après** `parseTemplate`, le jeu de données et les options. Le
scénario historique porte en plus l'empreinte du `V1_DOCUMENT` brut.

### 10. Le registre et les références sont fermés dans les deux sens

Le comparateur exige les mêmes ids, dans le même ordre, dans le registre, le manifeste de référence
et celui du candidat ; et il exige que chaque répertoire contienne **exactement** les PDF que son
manifeste nomme. Un scénario ajouté sans golden, un PDF orphelin, un fichier absent ou un ordre
différent font échouer la porte.

Le registre fixe **quels** documents le lot contient et dans quel ordre — pas leur longueur en
pages. Voir [§ Ce que l'exécution a corrigé du plan](#ce-que-lexécution-a-corrigé-du-plan).

### 11. Les scénarios ne dérivent pas silencieusement

Modifier l'entrée d'un scénario existant exige de changer son `recipeVersion` et de régénérer
explicitement. `historical-v1` est immuable sans nouveau mandat C9. Un scénario ne se retire que
lorsqu'un ADR nomme la preuve devenue redondante et son remplaçant.

### 12. Vérifier et accepter sont deux commandes sans chemin commun

Le générateur n'écrit que dans un répertoire explicitement fourni **et vide**, et refuse le dossier
des références comme tout dossier sous lui. Le comparateur ne touche jamais aux références. La
commande d'acceptation :

- n'est appelée par aucun script de CI — un test structurel lit le workflow et refuse la moindre
  commande `run:` qui la nommerait ;
- exige un candidat complet, dont chaque fichier est celui que son propre manifeste atteste ;
- exige le **profil hôte officiel**, pas celui de la machine qui copie ;
- remplace atomiquement les six fichiers nommés et le manifeste, et ne supprime rien d'autre ;
- refuse toute cible autre que `tests/golden/e7/references/` ;
- n'effectue ni `git add`, ni commit, ni push.

Il n'existe ni drapeau `--update`, ni variable d'environnement, ni mode Vitest capable de bénir une
référence pendant une vérification.

### 13. L'amorçage passe par un artefact de CI, jamais par un golden Windows

Le premier commit du harnais rend le job rouge — les références manquent — mais publie le candidat
Ubuntu pendant sept jours. Le mainteneur le télécharge, valide manifeste et profil, rastérise les 21
pages hors dépôt pour les **lire**, puis exécute l'acceptation et committe le lot dans un second
commit logique dont le diff textuel montre ce que la revue a approuvé.

### 14. Le rapport ne porte que des identifiants et des empreintes

Ni HTML, ni template, ni jeu de données : ids, profils, longueurs, empreintes, nombres de pages et
catégories de différence. Un test place une chaîne d'allure comptable dans un document du corpus
synthétique et vérifie qu'elle n'apparaît ni dans `report.json`, ni sur la console.

### 15. Aucune dépendance nouvelle

`pdf-lib` sait ouvrir, compter et copier des pages. Ajouter `pdf-parse` ne donnerait pas la fidélité
visuelle qu'on croit y trouver, et ajouter un rasteriseur anticiperait V3. La recommandation
historique de la stratégie QA est rectifiée en conséquence.

---

## Le corpus, exactement

| Id | Modèle et données | Options | Pages | Devoir |
| :--- | :--- | :--- | ---: | :--- |
| `invoice-one-page` | `referenceDocument(FRAMED)` + `ONE_ROW` | — | 1 | E1 : formule, image, grille, tableau, apparence |
| `invoice-sixty-bare` | `referenceDocument(BARE)` + `SIXTY_ROWS` | — | 4 | E2/E3 : métriques nues, en-têtes répétés, trois coutures |
| `invoice-sixty-fr-eur` | `writtenReferenceDocument(FRAMED)` + `worded(…, 'fr')` | `FRENCH_VALUES` | 5 | E4 : mots français, euros, décimaux, reports écrits |
| `invoice-sixty-en-usd` | **le même objet modèle** + `worded(…, 'en')` | `ENGLISH_VALUES` | 5 | E4 : mots anglais et dollars, modèle stocké inchangé |
| `invoice-sixty-layered` | `layeredReferenceDocument(FRAMED)` + `SIXTY_ROWS` | — | 5 | C11 : grille, arrière-plan, premier plan |
| `historical-v1` | `parseTemplate(V1_DOCUMENT)` + `V1_DATA` | — | 1 | C9 : document brut v1, migration transformante, rendu |

**21 pages en tout.** Les deux écritures partagent la **même référence d'objet** `Template` — pas
deux appels qui pourraient diverger — et un test l'assure par identité, pas par égalité.

`V1_DOCUMENT` et `V1_DATA` restent dans
[`packages/core/src/template/__tests__/compatibility-fixtures.ts`](../../packages/core/src/template/__tests__/compatibility-fixtures.ts).
Le registre les importe depuis la sortie de build ; il ne les copie pas, ne les annote d'aucun type
courant et ne leur ajoute pas de page. Un test vérifie que la source ne déclare aucune `page`, que la
migration ne la mute pas, et qu'elle arrive sur la page de compatibilité 210 × 297 / 20 mm.

---

## Mesures exécutées

### Génération locale, profil **non officiel**

Ces valeurs qualifient le coût et la stabilité de l'architecture. **Ce ne sont pas les goldens** :
elles ont été produites sous `win32 / x64 / node 24.11.1 / icu 77.1 / Chrome 152.0.7977.42`, sans
argument de lancement, et le comparateur refuserait de les qualifier contre un lot Ubuntu.

| Scénario | Pages | Octets |
| :--- | ---: | ---: |
| `invoice-one-page` | 1 | 29 935 |
| `invoice-sixty-bare` | 4 | 180 071 |
| `invoice-sixty-fr-eur` | 5 | 196 198 |
| `invoice-sixty-en-usd` | 5 | 196 065 |
| `invoice-sixty-layered` | 5 | 206 732 |
| `historical-v1` | 1 | 5 831 |
| **Total** | **21** | **814 832** (0,78 Mio) |

Le budget M-1 est de 2 Mio pour les PDF complets : le corpus initial en occupe **39 %**.

**Deux générations neuves et indépendantes ont produit des lots identiques** — mêmes six PDF, mêmes
21 extractions mono-page, mêmes certificats, même manifeste. Le générateur n'introduit donc aucune
variation propre. Cette répétition courte ne remplace pas les dix fois d'E6.

### Portes

`pnpm run lint`, `pnpm run build`, `pnpm run type-check`, `pnpm run test:coverage` — vertes, dans
cet ordre. **85 fichiers de test, 2 317 tests**, dont **150 nouveaux** répartis en trois suites de
harnais. Couverture globale **97,6 %** en instructions, **95,0 %** en branches, **98,97 %** en
fonctions, **97,63 %** en lignes ; les seuils par paquet restent à 90 %.

Une vérification verte ne modifie aucun fichier suivi : `git status --short` ne montre que les
fichiers de ce lot.

---

## Matrice de mutations

Chaque mutation a été appliquée, rejouée contre le corpus **réel** — six rendus complets et
21 extractions — puis restaurée et contrôlée par `git diff`.

| Mutation | Attendu | Observé |
| :--- | :--- | :--- |
| padding commun +0,1 mm | PDF complet, pages isolées | ✅ 4 documents encadrés, pages 1–4, `input` nommé |
| en-tête de table non répété | pages 2..N, certificats et PDF | ✅ pages 2, 3, 4 sur les quatre factures longues |
| report entrant supprimé | pages 2..N des factures longues | ✅ certificats 2..N, PDF isolés 1..N |
| bande `lastOnly` peinte partout | pages indues | ✅ page 1 des quatre factures longues, certificat compris |
| `FRENCH_VALUES` ↔ `ENGLISH_VALUES` | deux scénarios écrits, entrée et PDF | ✅ les deux, `input` nommé, 5 pages chacun |
| calque de premier plan retiré | scénario layered, pages 1..5 | ✅ exactement |
| page de compatibilité v1 modifiée | scénario historique, page 1 | ✅ exactement |
| métadonnée temporelle remise | PDF complet, `document-level` | ✅ 6/6 documents, aucune page faussement accusée |
| canonicaliseur PDF versionné 2 | profil renderer + documents | ✅ `profile.pdfCanonicalizer`, documents identiques |
| `parseTemplate` contourné pour v1 | rendu refusé **ou** empreinte absente | ✅ par l'empreinte d'entrée — voir ci-dessous |
| un scénario retiré du registre | fermeture registre/manifeste/dossier | ✅ les deux côtés nommés |
| comparer les seuls SHA du manifeste | deux fichiers à faux SHA commun | ✅ test dédié |
| acceptation appelée depuis le workflow | test structurel rouge | ✅ test dédié |
| `keepTogether` ignoré | dernière couture et page finale | ❌ **survit** — voir ci-dessous |
| contribution comptée sur le mauvais fragment | certificat et PDF à la couture | ❌ **survit** — voir ci-dessous |

### Deux mutations que le corpus ne tue pas, et pourquoi ce n'est pas un trou

**`keepTogether` ignoré** (quatre sites de `materialize.ts`, puis les groupes de lignes) et
**report entrant décalé d'un fragment** (`totalOf(carried, index)` au lieu de `index + 1`) produisent
des documents **identiques au bit près**. La raison est mesurable : dans les six scénarios, aucun
bloc marqué insécable ne tombe sur une coupure, et aucun décalage de fragment ne change la somme
reportée. Le corpus fige une **combinaison visible** ; il ne remplace pas un oracle fonctionnel.

Il ne remplace rien non plus ici : les deux mutations sont tuées par leurs propriétaires nommés au
§2.3 du plan. `keepTogether` rougit **huit** tests
(`pagination-keep-together`, `materialize-report`, `occurrence`, `notices`), et le décalage de
fragment rougit `pagination-reports`. La carte des propriétaires est donc vérifiée, pas seulement
écrite : le risque « E7 masque un test fonctionnel retiré » est mesuré et négatif.

### Contourner `parseTemplate` ne change pas un octet

Le pipeline appelle lui-même `validateTemplate()`, qui appelle `parseTemplate()` : remettre le
document v1 brut dans le registre produit exactement le même PDF. Seule l'**empreinte d'entrée**
bouge, et c'est elle qui refuse. C'est précisément la raison d'être de la décision 9 : sans
`inputSha256`, cette mutation passerait la porte sans laisser de trace.

---

## Ce que l'exécution a corrigé du plan

### Le registre ne ferme pas le nombre de pages du comparateur

Le plan faisait porter au registre, au manifeste **et** au comparateur la vérification du nombre de
pages attendu. Appliquée telle quelle, cette fermeture rendait inatteignable le diagnostic
« pages ajoutées / manquantes » que le §0.2 du plan décrit : toute variation de longueur était
rejetée comme un lot malformé avant d'être comparée.

Le partage retenu, et il est plus net : le **registre** fixe quels documents et dans quel ordre ; le
**générateur** vérifie la longueur trois fois (ce que le PDF contient, ce que la pagination annonce,
ce que le registre attend) et refuse d'écrire quoi que ce soit sinon ; l'**acceptation** la
revérifie ; le **comparateur** traite une longueur différente comme une différence de document et la
nomme page par page.

### L'HTML est annoncé après les pages, pas avant

Le plan écrit `pdf`, `page 3`, `page 4`, `html`. La première implémentation groupait toutes les
notes avant les pages. L'ordre du plan est le bon — ce que le document a fait, quelles pages ont
bougé, puis la source partagée qui peut expliquer les deux — et le comparateur l'écrit ainsi.

### Le générateur ne lit aucune horloge

Le plan demandait de mesurer les durées à l'exécution. Aucune ne l'est **par l'outil** : le harnais
d'un lot de reproductibilité n'a pas à lire une horloge, et §5.2 interdit de toute façon qu'une
durée entre dans un manifeste. La CI chronomètre ses propres étapes, ce qui donne le même nombre
sans mettre de `Date` dans le harnais.

### Les PDF synthétiques des tests sont canonicalisés

`PDFDocument.create()` estampille l'instant où il a tourné. Deux lots synthétiques construits à une
seconde d'intervalle différaient donc par cette seule métadonnée, et la suite de diagnostics était un
pile ou face — vu une fois, en exécution complète. Les fixtures passent maintenant par le même
`canonicalizePdf()` que les documents livrés.

### Une seule constante nomme l'hôte officiel

`OFFICIAL_HOST` vit dans `manifest.mjs`, et un test structurel lit le workflow pour refuser qu'elle
et le job dérivent l'un de l'autre. Changer de runner ou de patch Node oblige donc à changer les deux
et à régénérer le lot dans le même commit.

---

## Ce qui reste vrai après E7

- Un golden identique ne prouve pas qu'un comptable juge la facture correcte ; la revue métier J3
  reste ouverte.
- L'égalité binaire est **qualifiée par le profil E6**, jamais promise entre ICU ou plateformes.
- Le diagnostic mono-page est conservateur, ce n'est pas un diff de pixels.
- E7 compare l'histoire du PDF moteur ; il ne compare encore aucun aperçu React. C'est V3.
- Le corpus synthétique ne prouve ni sécurité, ni timeout, ni mémoire, ni concurrence. C'est E8, et
  E8 reste obligatoire avant toute exposition hostile.
- Une évolution volontaire exige encore un jugement humain : le test ne décide pas si le nouveau
  rendu est meilleur.

---

## Ce qu'il reste à faire pour dire « livré »

Le harnais est complet et vert ; **le lot ne l'est pas**, et il ne peut pas l'être depuis une machine
de développement. Il manque exactement ceci, dans cet ordre :

1. laisser le job `Frozen Documents (E7)` tourner — il échoue, comme prévu, sur des références
   absentes, et publie `golden-candidate` pendant sept jours ;
2. télécharger cet artefact et relire son `manifest.json` : profil, versions du harnais, longueurs,
   empreintes, nombres de pages ;
3. rastériser les 21 pages (Poppler, hors dépôt) et les **lire** : marges, filets, images, en-têtes
   répétés, reports, totaux, mentions de dernière page, français/euros, anglais/dollars, calques,
   document v1 ;
4. `node tools/golden/accept.mjs <candidat>` — la commande refusera tout ce qui ne vient pas du
   runner officiel ;
5. committer les six PDF et le manifeste dans un commit **séparé** du code du harnais ;
6. laisser la CI rejouer le corpus dans un workspace propre : c'est ce run-là, et pas l'acceptation,
   qui est la preuve.

Le tableau des mesures de ce document se complète alors du profil officiel, des six empreintes
retenues, du poids total committé et du résultat de la revue visuelle.

E7 sera terminé quand une faute volontaire dans le moteur rendra automatiquement la CI rouge, en
nommant la facture et la ou les pages affectées, et qu'une évolution volontaire ne pourra redevenir
verte qu'après génération sous le profil officiel, revue visuelle et acceptation explicite.
