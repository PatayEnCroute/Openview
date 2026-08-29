# Plan d'implémentation — `@openview/engine` lot E7 : le lot de documents figés de non-régression

> **Statut :** 🟡 **exécuté le 2026-08-29, corpus en attente d'amorçage** — ce plan est conservé
> pour l'historique ; la décision qui fait foi est
> [l'ADR 0020](../adr/0020-le-lot-de-documents-figes-de-non-regression.md), qui consigne les écarts
> d'exécution (fermeture du nombre de pages, ordre du diagnostic, absence d'horloge dans le harnais)
> et les deux mutations que le corpus ne tue pas. Le harnais, les trois suites de tests et le job
> CI sont livrés ; les six PDF de référence attendent un run officiel Ubuntu, une revue visuelle des
> 21 pages et une acceptation explicite.  
> **Statut initial :** plan prêt à exécuter sous les mandats M-1 et M-2 — 2026-08-29  
> **Lot :** E7 — poids M annoncé, **M confirmé** — dépend d'E6 livré  
> **Conditions de :** viewer V3, service S1 et moteur E9  
> **Décision d'exécution attendue :** ADR 0020

E7 transforme les recettes accumulées depuis E1 en une mémoire de rendu. Six scénarios synthétiques
et énumérés produisent six PDF canoniques committés, accompagnés d'un manifeste textuel. Une
vérification dédiée les rejoue sous le profil officiel E6 et refuse toute différence non approuvée.

Le test ne se limite pas à annoncer « un binaire a changé ». Il compare le PDF complet, isole chaque
page avec `pdf-lib`, et confronte aussi le certificat de pagination E5 de cette page. Un échec nomme
donc le scénario et la ou les pages touchées. L'HTML autonome est figé par longueur et SHA-256 sans
être committé : depuis E6 il incorpore les fontes et le recopier six fois alourdirait le dépôt sans
ajouter d'oracle.

Ce corpus reste un harnais de test. Il n'ajoute aucune donnée à `RenderRequest`, aucune capacité au
moteur, aucun format public et aucun vocabulaire de facture. La seule fixture non comptable est le
témoin historique v1 imposé par C9 ; il prouve la moitié « se rend » de la compatibilité, sans être
réécrit ni retypé.

---

## 0. Résultat attendu

Sur le profil officiel E6, une seule commande de vérification :

- reconstruit les six scénarios depuis leurs fixtures sources ;
- passe tout modèle, y compris le document historique v1, par `parseTemplate` ;
- produit le PDF avec `createPdfRenderPort()` et la pagination avec `createPaginationPort()` ;
- compare exactement les octets du PDF candidat avec la référence committée ;
- compare la longueur et le SHA-256 de l'HTML autonome ;
- compare, page par page, un PDF mono-page dérivé et le certificat E5 correspondant ;
- refuse une différence de profil, de recette, de nombre de pages, de manifeste ou de fichier ;
- écrit un rapport sûr à publier comme artefact de CI ;
- sort en code non nul avec un message qui nomme le scénario et les pages concernées.

La CI exécute cette commande sur chaque pull request et chaque push vers `main`, sous Ubuntu 24.04,
Node 24.11.1 et le Chromium téléchargé par Puppeteer. Les quatre portes ordinaires restent
inchangées ; la vérification E7 est une cinquième porte d'intégration, profilée et volontairement
séparée de la matrice Node 24/26.

### 0.1 Les quatre niveaux d'oracle

| Niveau | Comparaison | Ce qu'il détecte | Diagnostic |
| :--- | :--- | :--- | :--- |
| PDF complet | longueur puis octets | toute variation du document livré | scénario |
| PDF mono-page | longueur puis octets après extraction canonique | variation attribuable à une page ou à une ressource qu'elle référence | page(s) |
| Certificat E5 | JSON canonique de `PaginationPageResult` et notices de la page | coupure, placement, fragment, report ou repli différent | page(s) |
| HTML autonome | longueur UTF-8 et SHA-256 | source d'impression ou source future du viewer différente | scénario ; toutes les pages potentiellement touchées |

Le SHA-256 n'est pas l'égalité du PDF : le comparateur lit les deux fichiers et compare leurs
octets. Les empreintes rendent le manifeste et les messages compacts. Pour les PDF mono-page, les
deux côtés sont dérivés au moment de la comparaison depuis le PDF stocké et le candidat, puis
comparés octet pour octet.

### 0.2 Forme minimale d'un échec

Le message doit rester court, attribuable et sans recopier de donnée liée :

```text
E7 invoice-sixty-fr-eur: reference differs
  pdf: 196198 bytes / <reference-sha> against 196244 bytes / <candidate-sha>
  page 3: isolated pdf differs; pagination certificate differs
  page 4: isolated pdf differs
  html: shared source differs; pages 1..5 may be affected
candidate report: test-results/golden/e7/report.json
```

Un changement du nombre de pages nomme les pages communes qui diffèrent, puis les pages ajoutées ou
manquantes. Une différence limitée au catalogue PDF ou aux métadonnées, qui ne change aucun PDF
mono-page, est annoncée comme « document-level; pages 1..N potentially affected » plutôt que
faussement attribuée à une page arbitraire.

### 0.3 Ce qui constitue une référence

Une référence E7 est l'ensemble atomique suivant :

1. le PDF canonique produit par la façade publique ;
2. son entrée dans `manifest.json` ;
3. le profil complet E6 qui a produit le lot ;
4. l'empreinte canonique de l'entrée réellement rendue ;
5. les empreintes du PDF isolé et du certificat E5 de chaque page ;
6. l'identifiant et la version de l'extracteur de pages E7.

Un PDF seul n'est pas une référence : sans profil ni empreinte d'entrée, une différence peut venir
d'une autre ICU ou d'une fixture modifiée. Un manifeste seul n'est pas une référence non plus : le
PDF committé est l'objet exact que le client recevait.

---

## 1. Sources normatives et baseline réelle

### 1.1 Sources qui font foi

- [roadmap moteur, E7](../roadmap/engine.md#e7-le-lot-de-documents-figés-de-non-régression) ;
- [ADR 0011](../adr/0011-la-perennite-a-chaque-ajout.md), pour le témoin historique v1 intact ;
- [ADR 0012](../adr/0012-une-facture-d-une-page-sort-en-pdf.md), pour la facture mono-page ;
- [ADR 0013](../adr/0013-le-tableau-deborde-proprement.md), pour la pagination de tableau ;
- [ADR 0014](../adr/0014-les-exigences-comptables.md), pour reports, blocs insécables et dernière
  page ;
- [ADR 0016](../adr/0016-grille-colonnes-et-calques.md), pour grilles et calques ;
- [ADR 0017](../adr/0017-langue-et-devise-au-rendu.md), pour les deux écritures ;
- [ADR 0018](../adr/0018-le-moteur-sait-dire-ou-il-coupe.md), pour l'HTML et le certificat E5 ;
- [ADR 0019](../adr/0019-le-meme-document-a-chaque-fois.md), pour le profil et le PDF canonique ;
- [stratégie QA, axe 7](../qa/README.md#axe-7--golden-master--assertions-structurelles-pdf).

### 1.2 Ce que le dépôt livre déjà

| Besoin E7 | Baseline | Réemploi imposé |
| :--- | :--- | :--- |
| PDF réel | `createPdfRenderPort()` + adaptateur Puppeteer | aucune façade de rendu de test concurrente |
| Source et découpe | `createPaginationPort()` et `PaginationResult` | certificat public E5, aucun sélecteur DOM |
| Canonicalisation | `canonicalizePdf()` dans l'adaptateur | le PDF de référence est déjà la sortie client |
| Lecture/écriture PDF | `pdf-lib@1.17.1`, dépendance d'exécution de l'adaptateur | extraction de pages sans paquet nouveau |
| Profil | `tools/reproducibility/profile.mjs` et treize champs | une seule définition E6 du profil |
| Facture de référence | deux apparences, une/soixante lignes, deux écritures, calques | composer le corpus, ne pas recopier les modèles |
| Compatibilité | `V1_DOCUMENT` et `V1_DATA` dans les fixtures C9 | importer l'objet brut exact et appeler `parseTemplate` |
| CI profilée | deux jobs Ubuntu 24.04 / Node 24.11.1 | même runner et mêmes arguments de lancement |
| Répertoire temporaire | `test-results/` déjà ignoré | candidats et rapports jamais committés par défaut |
| Binaires Git | `*.pdf binary` dans `.gitattributes` | aucune modification nécessaire |

### 1.3 Les sept écarts à combler

1. **Aucun PDF n'est committé.** E6 compare des productions contemporaines, jamais une version
   actuelle à une sortie historique.
2. **Aucun registre fermé de scénarios n'existe.** Les recettes sont dispersées entre les tests E1
   à E6 et ne forment pas encore un corpus énumérable.
3. **Le comparateur E6 compare deux machines, pas une référence.** Il ne lit ni PDF ni page et son
   message ne peut pas nommer une page fautive.
4. **La fixture v1 ne traverse pas le moteur.** C9 prouve parsing, migration, parcours et
   évaluation, mais aucun PDF.
5. **Le profil n'accompagne aucun golden.** Une comparaison lancée depuis Windows ou un autre ICU
   pourrait annoncer une fausse régression.
6. **Aucun chemin d'approbation n'est sûr.** Un `vitest -u` ou une génération directement dans le
   dossier suivi permettrait de bénir une différence sans la voir.
7. **La CI n'exécute aucune mémoire historique.** Les tests actuels peuvent tous rester verts après
   une modification volontaire du rendu si leurs assertions structurelles ne ciblent pas ce détail.

### 1.4 Sondes jouées pendant la planification

Sur la baseline locale Windows, Node 24.11.1, Puppeteer 25.8.0 et Chromium 152.0.7977.42 :

- deux rendus de la facture mono-page ont produit les mêmes `29 935` octets ;
- deux rendus de la facture nue de soixante lignes ont produit les mêmes `180 071` octets ;
- l'extraction des quatre pages de cette dernière, suivie de la canonicalisation existante, a
  produit deux fois les mêmes quatre empreintes ;
- les six scénarios proposés pèsent ensemble `814 832` octets de PDF, soit moins de 0,8 Mio ;
- leur rendu PDF séquentiel a pris environ 10,4 s sur cette machine ; la pagination E5 double à peu
  près ce travail, ce qui reste compatible avec un job CI dédié ;
- les six documents occupent 21 pages : 1 + 4 + 5 + 5 + 5 + 1.

Ces valeurs qualifient le coût et la stabilité de l'architecture. Elles ne sont pas les goldens :
les références officielles doivent être produites sous le profil Ubuntu de la CI et approuvées à
l'œil avant d'entrer dans Git.

---

## 2. Périmètre fermé

### 2.1 Inclus dans E7

- un registre ordonné de six scénarios synthétiques ;
- six PDF de référence committés ;
- un manifeste JSON versionné, validé à la lecture et sérialisé canoniquement ;
- une empreinte de l'entrée de chaque scénario ;
- le profil E6 complet à côté du corpus ;
- un générateur de candidats qui refuse d'écrire dans un répertoire non vide ;
- un extracteur déterministe de PDF mono-page, strictement réservé aux tests ;
- un comparateur exact du PDF complet et de chaque PDF mono-page ;
- des certificats E5 page par page et une empreinte de l'HTML autonome ;
- un rapport JSON et un résumé console sûrs à publier ;
- une commande d'acceptation explicite, absente de la CI ;
- un job CI profilé et bloquant ;
- la recette visuelle des 21 pages ;
- des mutations prouvant les oracles ;
- l'ADR 0020, la fermeture d'E7 dans la roadmap et la rectification ciblée de la stratégie QA.

### 2.2 Corpus v1 exact

| Id stable | Modèle et données existants | Options | Pages attendues | Devoir principal |
| :--- | :--- | :--- | ---: | :--- |
| `invoice-one-page` | `referenceDocument(FRAMED)` + `ONE_ROW` | aucune | 1 | E1 : formule, image, grille, tableau, apparence, PDF mono-page |
| `invoice-sixty-bare` | `referenceDocument(BARE)` + `SIXTY_ROWS` | aucune | 4 | E2/E3 : métriques sans cadre, en-têtes répétés, trois coutures et reports |
| `invoice-sixty-fr-eur` | `writtenReferenceDocument(FRAMED)` + `worded(SIXTY_ROWS, 'fr')` | `FRENCH_VALUES` | 5 | E4 : mots français, euros, dates, décimaux et reports écrits |
| `invoice-sixty-en-usd` | le **même objet modèle** que le scénario précédent + `worded(..., 'en')` | `ENGLISH_VALUES` | 5 | E4 : mots anglais et dollars sans changer le modèle stocké |
| `invoice-sixty-layered` | `layeredReferenceDocument(FRAMED)` + `SIXTY_ROWS` | aucune | 5 | C11 : grille, arrière-plan, premier plan et coupures inchangées |
| `historical-v1` | `parseTemplate(V1_DOCUMENT)` + `V1_DATA` | aucune | 1 | C9 : document brut v1 sans `page`, migration transformante, rendu final |

Les deux scénarios écrits doivent partager la même référence de `Template` dans le registre, et non
deux appels indépendants qui pourraient diverger. Le corpus vérifie cette identité avant de rendre.

Les apparences nue et encadrée ont des métriques de police différentes et produisent respectivement
quatre et cinq pages. Cette différence est un cas limite utile : une modification de typographie ou
de largeur ne peut pas préserver artificiellement la même coupure sur les deux.

### 2.3 Capacités couvertes sans seconde suite fonctionnelle

| Capacité | Scénario(s) golden | Oracle fonctionnel qui reste propriétaire |
| :--- | :--- | :--- |
| formule, agrégation, date, arrondi | les cinq factures | tests `core` C1/C2/C3 |
| image PNG incorporée | une page, quatre factures longues, calques | tests images E1/E6 |
| grille atomique | toutes les factures actuelles | tests C11/engine de débordement |
| tableau et en-tête répété | quatre factures longues | matrice E2 |
| report entrant | quatre factures longues | matrice E3 |
| `keepTogether` et dernière page | quatre factures longues | matrice E3 |
| veuves/orphelines | restitution du texte long seulement | matrice mesurée E3, pas le golden |
| langue/devise | deux diagonales du même modèle | tests E4 |
| calques de page | scénario layered | tests C11/E5 |
| manifeste de pagination | les six scénarios | tests de contrat E5 |
| fontes et canonicalisation | les six scénarios | tests E6 |
| migration historique | `historical-v1` | corpus sémantique C9 |

E7 ne déplace aucun oracle métier. Il fige leur combinaison visible. Une somme fausse reste mieux
diagnostiquée par le test d'agrégation ; E7 prouve qu'une régression intégrée ne traverse pas tous
les sous-systèmes sans être vue.

### 2.4 L'exception historique n'élargit pas le produit

La roadmap dit « seulement des factures » puis transmet explicitement le document historique v1.
Le corpus suit les deux obligations ainsi : cinq scénarios sont des factures, et un sixième est le
témoin de compatibilité imposé par C9. Ce dernier n'introduit ni famille de document, ni règle de
rapport, ni branche de moteur. C'est une preuve de migration vers le même Composite générique.

`V1_DOCUMENT` et `V1_DATA` restent dans
`packages/core/src/template/__tests__/compatibility-fixtures.ts`. Le registre E7 les importe depuis
la sortie de build ; il ne les copie pas, ne les annote pas avec un type courant et ne leur ajoute
pas de page. Si le moteur change sa représentation intermédiaire, seul le registre/adaptateur E7
évolue.

### 2.5 Exclus, avec propriétaire

| Exclu | Motif | Propriétaire |
| :--- | :--- | :--- |
| comparaison pixel aperçu/PDF | exige le viewer réel et un rasteriseur commun | V3 |
| PNG de chaque page committé | dupliquerait le PDF et figerait un rasteriseur absent | V3 si nécessaire |
| extraction de texte comme oracle visuel | perd positions, fontes, filets et images | jamais seul |
| `pdf-parse`, `pdfjs-dist`, Pixelmatch, Playwright ou Poppler en CI E7 | aucune dépendance n'est nécessaire à l'égalité binaire | V3 pour la parité visuelle |
| document hostile ou volumétrie 60 000 lignes | sécurité, temps, mémoire et concurrence | E8 |
| nouveau type de document « pour couvrir » | le corpus v1 doit rester énumérable et motivé | besoin produit réel futur |
| HTML committé en clair | les fontes base64 le rendent lourd ; longueur et empreinte suffisent | aucun |
| conservation d'un jeu de données client | E7 n'emploie que des données synthétiques du dépôt | jamais |
| publication des goldens dans les paquets npm | actifs de test, sans contrat consommateur | jamais |
| API publique de golden, profil ou extraction de page | harnais de dépôt uniquement | aucun |
| règle de facture, nom de champ réservé ou schéma de `RenderRequest.data` | hors périmètre Openview | jamais |
| mise à jour automatique des snapshots en CI | bénirait la régression que la porte doit arrêter | jamais |

### 2.6 Aucun changement de contrat stocké

E7 n'ajoute aucun champ au `Template`, à ses nœuds, aux expressions, à `RenderRequest` ou à
`PaginationResult`. Il n'y a donc ni incrément de `schemaVersion`, ni migration. Le format du
manifeste E7 porte son propre `formatVersion`, parce qu'il s'agit d'un contrat de test distinct et
qu'un ancien comparateur doit refuser une forme nouvelle plutôt que l'interpréter partiellement.

---

## 3. Mandats explicites avant exécution

### M-1 — Autoriser les six PDF binaires dans Git

**Recommandation : approuver.** Le corpus initial mesuré reste sous 1 Mio et `.gitattributes`
déclare déjà `*.pdf binary`. Les PDF ne contiennent que les données synthétiques visibles dans les
fixtures. Le manifeste textuel porte longueurs, empreintes, pages et profil afin que la revue ne
dépende pas d'un diff binaire illisible.

Le budget initial est fixé à **2 Mio pour les PDF complets**. Un dépassement futur ne déclenche ni
compression ZIP ni Git LFS automatiquement : il oblige à mesurer quel scénario ou quelle ressource
a grandi et à le justifier dans l'ADR ou la PR.

### M-2 — Autoriser le job E7 dans `.github/workflows/ci.yml`

**Recommandation : approuver.** `AGENTS.md` §7 protège les workflows. E7 doit ajouter un job bloquant
sur `ubuntu-24.04`, Node `24.11.1`, `pnpm install --frozen-lockfile`, build, génération, comparaison,
puis upload du candidat et du rapport **uniquement en cas d'échec** pour sept jours.

Le job réemploie les actions déjà épinglées du workflow et `persist-credentials: false`. Il ne
pousse rien, n'accepte jamais un golden et n'obtient aucun droit d'écriture.

### 3.1 Ce que l'exécution n'a pas à demander

- aucune nouvelle dépendance ;
- aucune modification de `package.json`, du lockfile ou de `pnpm-workspace.yaml` ;
- aucune modification de `tsconfig*`, Biome, Turbo, Sonar ou des plugins GritQL ;
- aucune exposition de `canonicalizePdf()` ou du profil dans les exports publics ;
- aucune modification de production dans `core`, `engine`, `designer` ou `viewer`.

Si l'implémentation découvre qu'un de ces changements est nécessaire, elle s'arrête et demande un
nouveau mandat ; elle ne l'enfouit pas dans E7.

---

## 4. Décisions d'architecture

### D1 — E7 appartient au dépôt et à l'adaptateur, pas au moteur de production

Le rendu réel dépend de Puppeteer, qui doit rester hors d'`@openview/engine`. Les outils vivent dans
`tools/golden/`, les références dans `tests/golden/e7/references/`, et les tests du harnais dans
`packages/adapter-puppeteer/src/__tests__/`. Aucun fichier n'entre dans le tarball publié.

Le libellé roadmap « lot `@openview/engine` » désigne la capacité testée, pas un droit d'ajouter
Chromium au paquet moteur.

### D2 — Les deux façades publiques produisent les candidats

Chaque scénario est exécuté deux fois, séquentiellement :

1. `createPaginationPort(strategy, options).paginate(request)` fournit l'HTML et le certificat ;
2. `createPdfRenderPort(strategy, options).render(request)` fournit le PDF client.

E5 prouve déjà que les deux voies composent le même HTML. E7 ne capture pas une fonction interne du
pipeline et ne construit pas directement un `PaginatedDocument`. Deux sessions Puppeteer sont le
prix honnête d'un test des deux contrats publics ; le pooling appartient à E8.

### D3 — Le PDF complet est l'oracle principal

La réussite exige `candidate.bytes.length === reference.bytes.length` puis l'égalité de chaque
octet. Une empreinte égale accélère et résume, mais ne dispense pas de l'égalité binaire. Le PDF est
celui renvoyé par le port après canonicalisation, jamais le PDF brut de Chromium ni un dérivé de
test.

### D4 — L'extraction mono-page est un diagnostic conservateur

Pour chaque rang :

1. `PDFDocument.load()` ouvre le PDF canonique sans mettre à jour les métadonnées ;
2. `copyPages()` copie exactement la page dans un document neuf ;
3. la page est ajoutée explicitement ;
4. le document est sauvegardé sans object streams ni page par défaut ;
5. `canonicalizePdf()` fixe les métadonnées et retire l'identifiant ;
6. le résultat est comparé à l'extraction du même rang de l'autre PDF.

Une fonte sous-ensemble partagée peut faire différer plusieurs pages alors qu'une seule a gagné un
glyphe. Ce sur-diagnostic est accepté : il nomme un ensemble conservateur de pages et n'en masque
aucune. E7 ne prétend pas remplacer un diff de pixels ; V3 le fera avec le viewer réel.

L'extracteur porte `pageExtractorVersion: 1`. Toute modification de son algorithme fait échouer le
manifeste avant comparaison et exige une régénération examinée.

### D5 — Le certificat E5 localise la sémantique de pagination

Le certificat d'une page est le JSON canonique de :

- `PaginationPageResult` de ce rang ;
- les notices dont `pages` contient ce rang.

Il couvre placements ordonnés, régions, rôles, fragments, report entrant et lignes achevées. Il ne
contient ni HTML, ni mesure, ni curseur, ni valeur liée. `sheet` et la liste globale des notices ont
en plus leur propre empreinte au niveau du document.

### D6 — L'HTML reste opaque et n'est jamais découpé par sélecteur

Le harnais enregistre sa longueur UTF-8 et son SHA-256. Il ne fait ni `split('ov-page')`, ni parse
DOM, ni requête CSS. Les classes et la structure HTML restent privées comme l'exige E5. Quand cette
empreinte change, le rapport nomme le document et considère toutes ses pages potentiellement
affectées ; le PDF mono-page et les certificats précisent ensuite le diagnostic.

### D7 — Le profil E6 accompagne chaque lot

Le générateur appelle `profileOf()` et sérialise les treize champs existants. E7 ne maintient pas
une deuxième liste. Le comparateur distingue :

- **profil complet identique** : comparaison historique pleinement qualifiée par E6 ;
- **hôte différent** (`platform`, `architecture`, Node, V8, ICU, Unicode, arguments) : refus avant
  de qualifier les octets ; une génération locale peut servir à inspecter, jamais à accepter ;
- **renderer différent** (versions moteur/adaptateur/Puppeteer/Chromium, fontes ou canonicaliseur) :
  échec de profil et comparaison diagnostique des sorties ; une mise à jour atomique du profil et
  des goldens est nécessaire si le changement est volontaire.

Cette distinction ne relâche pas E6. Elle permet seulement à E7 de montrer les pages touchées lors
d'une montée volontaire du renderer, tout en refusant de déclarer les deux profils équivalents.

### D8 — Le manifeste est validé avec Zod 4 à sa frontière

`tools/golden/manifest.mjs` résout `zod/v4` depuis le paquet `core` déjà installé et applique
`safeParse` une seule fois à la lecture. Le schéma refuse : version inconnue, SHA mal formé, longueur
négative, id ou nom de fichier dupliqué, rangs non continus, chemin absolu, `..`, fichier non PDF et
champ inconnu.

Le schéma reste dans l'outillage : le placer dans `@openview/core` ferait d'un format de test un
contrat produit.

### D9 — Chaque entrée rendue possède une empreinte canonique

Le registre calcule un SHA-256 sur une sérialisation récursive où :

- les clés d'objet sont triées par code point ;
- l'ordre des tableaux est conservé ;
- seuls JSON `null`, booléen, nombre fini, chaîne, tableau et objet sont acceptés ;
- `undefined`, fonction, symbole, `bigint`, nombre non fini et cycle sont refusés.

L'entrée couvre le `Template` **après** `parseTemplate`, le jeu de données synthétique et les
options moteur. Le scénario historique porte en plus l'empreinte du `V1_DOCUMENT` brut. Modifier
une fixture ne peut donc pas se déguiser en changement de renderer.

### D10 — Le registre et les références sont fermés dans les deux sens

Le comparateur exige exactement les mêmes ids, dans le même ordre, dans le registre, le manifeste
de référence et le répertoire de PDF. Un scénario ajouté sans golden, un PDF orphelin, une entrée
dupliquée ou un fichier absent font échouer la porte.

Les ids et noms de fichiers sont stables, ASCII, en minuscules et séparés par des tirets. Ils ne
contiennent aucune donnée métier ni version de sortie.

### D11 — Les scénarios existants ne dérivent pas silencieusement

Ajouter une capacité visible crée de préférence un petit scénario nouveau. Modifier l'entrée d'un
scénario existant exige de changer son `recipeVersion`, d'expliquer pourquoi la vieille recette
n'est plus la bonne et de régénérer explicitement. `historical-v1` est immuable sans nouveau mandat
C9 : ni sa source, ni ses données ne changent.

Un scénario ne se retire que lorsqu'un ADR nomme la preuve devenue redondante et son remplaçant. Le
corpus peut croître, mais jamais par réflexe : un besoin réel et une capacité non déjà visible sont
requis.

### D12 — Vérifier et accepter sont deux commandes sans chemin commun

Le générateur écrit uniquement dans un répertoire explicitement fourni et vide. Le comparateur est
en lecture seule. La commande d'acceptation :

- n'est appelée par aucun script CI ;
- exige un candidat complet et valide ;
- exige un profil officiel, pas celui de la machine qui copie ;
- remplace atomiquement les six fichiers nommés et le manifeste ;
- refuse tout chemin hors de `tests/golden/e7/references/` ;
- ne supprime aucun fichier orphelin automatiquement ;
- n'effectue ni `git add`, ni commit, ni push.

Il n'existe pas de drapeau `--update`, de variable d'environnement ni de mode Vitest capable de
bénir les références pendant une vérification.

### D13 — Le bootstrap passe par un artefact CI, pas par un golden Windows

Le premier commit du harnais rend le job rouge parce que les références manquent, mais publie le
candidat Ubuntu pendant sept jours. Le mainteneur :

1. télécharge cet artefact ;
2. valide le manifeste et le profil ;
3. rend les 21 pages en PNG avec Poppler pour revue humaine ;
4. inspecte marges, textes, filets, images, reports, monnaies et calques ;
5. exécute l'acceptation explicite vers le dossier suivi ;
6. committe PDF et manifeste dans un second commit logique ;
7. laisse la même CI prouver que le corpus est désormais vert.

Le raster Poppler est une aide de revue ponctuelle, pas un oracle automatisé et pas une dépendance
du dépôt.

### D14 — Les données de recette sont publiables mais restent traitées comme le document

Le corpus ne contient que des noms, montants, images et textes synthétiques déjà versionnés. Le
rapport n'inclut néanmoins ni HTML, ni template, ni jeu de données. Il ne porte que ids, profils,
longueurs, empreintes, nombres de pages et catégories de différence.

Sur échec, la CI peut publier les PDF candidats et `report.json`. Elle ne publie jamais un rendu
fourni par un intégrateur, et le harnais n'accepte aucun chemin ou jeu de données externe.

### D15 — Aucune dépendance nouvelle

`pdf-lib` sait ouvrir, compter et copier des pages ; `node:crypto`, `node:fs` et `node:path` couvrent
le reste. Ajouter `pdf-parse` ne donnerait pas la fidélité visuelle, et ajouter un rasteriseur
anticiperait V3. La recommandation historique de la stratégie QA est donc rectifiée après
exécution, sans modifier sa section V3.

### D16 — V3 réemploiera le corpus sans dépendre de Puppeteer en production

Le registre et les références sont des actifs de monorepo. Les tests V3 pourront appeler le même
outil ou lire son manifeste depuis leur harnais E2E ; `@openview/viewer` n'importe ni
`@openview/engine`, ni l'adaptateur, ni `tools/golden`. E7 ne crée pas une API de test publique pour
un consommateur futur hypothétique.

---

## 5. Contrat du manifeste

### 5.1 Forme logique

La forme documentée ci-dessous guide le schéma Zod ; elle n'est pas exportée par un paquet :

```ts
interface DigestRecord {
  readonly bytes: number;
  readonly sha256: string;
}

interface GoldenPageRecord {
  readonly number: number;
  readonly pdf: DigestRecord;
  readonly pagination: DigestRecord;
}

interface GoldenDocumentRecord {
  readonly id: string;
  readonly recipeVersion: number;
  readonly filename: string;
  readonly inputSha256: string;
  readonly storedTemplateSha256?: string | undefined;
  readonly pdf: DigestRecord;
  readonly html: DigestRecord;
  readonly sheet: DigestRecord;
  readonly notices: DigestRecord;
  readonly pages: readonly GoldenPageRecord[];
}

interface GoldenManifest {
  readonly formatVersion: 1;
  readonly generatorVersion: 1;
  readonly pageExtractorVersion: 1;
  readonly profile: ReproducibilityProfile;
  readonly documents: readonly GoldenDocumentRecord[];
}
```

`bytes` signifie octets du fichier, UTF-8 de la chaîne ou UTF-8 du JSON canonique selon le champ.
Le schéma et le générateur nomment cette convention dans leurs tests pour empêcher une comparaison
accidentelle de longueur UTF-16.

### 5.2 Sérialisation

- deux espaces d'indentation et LF final pour le manifeste de revue ;
- ordre des champs fixé par le générateur ;
- ordre des documents fixé par le registre ;
- ordre des pages strictement `1..N` ;
- aucune date, durée, branche, hash Git, chemin absolu ou nom de machine ;
- le profil est sérialisé par `serializeProfile()` E6 ;
- les objets servant aux empreintes sont sérialisés par le canonicaliseur JSON E7.

Les mesures temporelles vont dans l'ADR, pas dans le golden : une durée variable ferait changer le
manifeste sans changer le document.

### 5.3 Versionnement du harnais

- `formatVersion` change si la forme JSON change ;
- `generatorVersion` change si la définition d'une empreinte change ;
- `pageExtractorVersion` change si les octets mono-page peuvent changer ;
- `recipeVersion` change seulement si l'entrée nommée change volontairement ;
- le canonicaliseur PDF conserve sa version dans le profil E6.

Le comparateur ne migre pas silencieusement un ancien manifeste. Une évolution du harnais produit
une erreur lisible puis une mise à jour atomique des références.

---

## 6. Flux cible

### 6.1 Génération d'un candidat

```text
registre fermé
  -> parseTemplate pour chaque source
  -> empreinte canonique template + data + options
  -> createPaginationPort().paginate()
  -> createPdfRenderPort().render()
  -> validation pages PDF == pages E5 == pages attendues
  -> extraction/canonicalisation de chaque page
  -> manifeste candidat + six PDF dans un répertoire vide
```

Le profil est sondé une seule fois avant le corpus avec le Chromium téléchargé. Les scénarios sont
rendus séquentiellement pour éviter de transformer E7 en test de concurrence avant E8. Chaque port
ferme sa session sur succès comme sur erreur.

### 6.2 Comparaison

```text
lecture + safeParse référence/candidat
  -> fermeture ids/fichiers/ordre
  -> comparaison du profil
  -> comparaison des empreintes d'entrée
  -> comparaison nombre de pages
  -> comparaison octets PDF complets
  -> extraction des deux PDF et comparaison par rang
  -> comparaison certificats E5 / HTML / sheet / notices
  -> rapport ordonné
  -> exit 0 seulement si aucune différence
```

Le comparateur accumule les différences des six scénarios au lieu de s'arrêter au premier. Une PR
qui modifie un style commun voit ainsi tout son rayon d'effet en un run.

### 6.3 Acceptation volontaire

```text
candidat CI téléchargé
  -> validation complète hors écriture
  -> revue visuelle des 21 pages
  -> tools/golden/accept.mjs <candidate>
  -> diff textuel de manifest.json
  -> ouverture des seuls PDF annoncés différents
  -> commit explicatif
  -> CI verte sur une génération neuve
```

Accepter un candidat n'est jamais la preuve finale. La preuve finale est le run suivant, qui
reconstruit le corpus dans un workspace propre et compare aux fichiers désormais suivis.

### 6.4 Échec de rendu

Si un scénario ne produit pas de PDF, la commande :

- nomme l'id du scénario ;
- conserve le code typé si l'erreur est un `DocumentRenderError` ;
- ne lit ni ne publie la valeur liée ou l'HTML partiel ;
- ferme la session ;
- écrit un rapport partiel marqué `render-failed` ;
- n'écrit aucun PDF de référence et n'appelle jamais l'acceptation.

---

## 7. Carte des fichiers

### 7.1 Outillage

| Fichier | Rôle |
| :--- | :--- |
| `tools/golden/corpus.mjs` | registre ordonné des six scénarios, recettes et pages attendues |
| `tools/golden/canonical-json.mjs` | sérialisation JSON fermée et empreinte d'entrée |
| `tools/golden/manifest.mjs` | schéma Zod 4, lecture et écriture canonique |
| `tools/golden/pages.mjs` | extraction mono-page, canonicalisation et certificats E5 |
| `tools/golden/render.mjs` | profil, rendu séquentiel et écriture d'un candidat |
| `tools/golden/compare.mjs` | comparaison exhaustive et rapport |
| `tools/golden/accept.mjs` | promotion atomique explicite vers le dossier suivi |
| `tools/golden/*.d.mts` | types des modules JS importés par les tests TypeScript, si nécessaire |

Le code factorisé reste proportionné : un fichier par responsabilité, sans classe ni Port. E7 est
un outil de dépôt, pas une nouvelle couche d'architecture.

### 7.2 Références

```text
tests/golden/e7/references/
  manifest.json
  historical-v1.pdf
  invoice-one-page.pdf
  invoice-sixty-bare.pdf
  invoice-sixty-en-usd.pdf
  invoice-sixty-fr-eur.pdf
  invoice-sixty-layered.pdf
```

Le tri lexical des fichiers n'est pas l'ordre du corpus ; `manifest.json` porte l'ordre officiel.
Le comparateur refuse tout autre PDF dans ce répertoire.

### 7.3 Tests et CI

| Fichier | Changement |
| :--- | :--- |
| `packages/adapter-puppeteer/src/__tests__/golden-corpus.test.ts` | fermeture du registre, recettes, v1, pages attendues |
| `packages/adapter-puppeteer/src/__tests__/golden-tooling.test.ts` | schéma, canonicalisation, extraction et comparateur sur petits artifices |
| `packages/adapter-puppeteer/src/__tests__/golden-diagnostics.test.ts` | erreurs nommées par scénario/page et absence de fuite |
| `.github/workflows/ci.yml` | job E7 profilé sous M-2 |

Le vrai corpus n'entre pas dans `vitest run --coverage` sur Node 24 et 26 : il n'est comparable que
sous son profil. Vitest couvre le harnais avec des PDF minimaux et des manifests artificiels ; le
job E7 exécute les six documents réels.

### 7.4 Documentation après exécution

| Fichier | Changement |
| :--- | :--- |
| `docs/adr/0020-le-lot-de-documents-figes-de-non-regression.md` | décisions exécutées, profil, mesures, revue et mutations |
| `docs/roadmap/engine.md` | E7 livré, corpus exact et limites |
| `docs/roadmap/viewer.md` | V3 peut consommer le corpus, sans déclarer V3 livré |
| `docs/roadmap/service-de-rendu.md` | dépendance S1 levée, sans démarrer le service |
| `docs/qa/README.md` | axe 7 aligné sur `pdf-lib` existant et frontière V3 |
| ce plan | statut périmé après l'ADR 0020 |

`README.md` global ne change pas : E7 ne ferme à lui seul aucun jalon J4 ou J5.

---

## 8. Plan de tests

### P1 — Schéma du manifeste

Accepter une référence complète ; refuser chaque champ absent, version inconnue, SHA non
hexadécimal ou de mauvaise longueur, entier négatif, page discontinue, id dupliqué, nom de fichier
dupliqué, chemin absolu, `..`, extension non PDF, clé inconnue et tableau de documents vide.

**Oracle :** l'erreur nomme le chemin du manifeste, jamais son contenu complet.

### P2 — JSON canonique et empreinte d'entrée

Deux objets aux clés insérées dans un ordre différent donnent les mêmes octets ; deux tableaux
permutés diffèrent. Refuser `undefined`, fonction, symbole, `bigint`, `NaN`, infini et cycle. Prouver
que template, données et options influencent chacun l'empreinte.

### P3 — Fermeture du registre

Les six ids, leur ordre, leur nom de fichier, leur `recipeVersion`, leurs pages attendues et leurs
capacités sont écrits explicitement dans le test. Refuser un septième PDF orphelin, une entrée sans
fichier et deux scénarios partageant un id.

### P4 — Même modèle pour les deux écritures

Le registre construit une fois `writtenReferenceDocument(FRAMED)` et les scénarios FR/EUR et
EN/USD portent exactement cette même référence. Leurs données et options diffèrent ; leurs
empreintes et leurs PDF doivent différer.

### P5 — Fixture historique v1

- importer `V1_DOCUMENT` et `V1_DATA` par leur chemin de build existant ;
- prouver que la source ne contient aucune clé `page` ;
- prendre un clone avant exécution et vérifier la non-mutation ;
- appeler `parseTemplate`, obtenir la version courante et la page de compatibilité 210 × 297 / 20 mm ;
- rendre une page PDF ;
- vérifier que l'empreinte du document brut est dans le manifeste ;
- muter l'adaptateur E7, jamais la fixture, si le pipeline change.

### P6 — Générateur

Répertoire absent ou vide accepté ; répertoire non vide, chemin de référence ou fichier à la place
du dossier refusés. Un échec au scénario 4 ne laisse jamais un manifeste qui prétend six succès.
Le profil est sondé une fois et chaque session est fermée.

### P7 — PDF complet

Comparer deux fichiers identiques, deux longueurs différentes et deux contenus de même longueur.
Le cas de même SHA simulé dans le manifeste ne peut pas rendre vert deux fichiers dont les octets
diffèrent.

### P8 — Extraction de pages

- document une page et document quatre pages ;
- deux extractions successives donnent les mêmes octets ;
- deux rendus E6 identiques donnent les mêmes extractions ;
- rang absent refusé ;
- ordre 1..N conservé ;
- métadonnées fixes et aucun trailer `/ID` après extraction ;
- changer `pageExtractorVersion` refuse la référence avant d'interpréter les empreintes.

### P9 — Certificats E5

Modifier séparément un placement, un fragment, une région, un rôle, un report entrant, une ligne
achevée et une notice. Chaque mutation ne rougit que le rang dont le certificat change. `sheet` et
notices globales ont leurs propres empreintes.

### P10 — Diagnostics

Matrice page ajoutée, page retirée, PDF page 2 différent, certificat page 3 différent, HTML seul,
profil seul, entrée seule, fichier absent et rendu refusé. Les messages contiennent id et rang,
jamais texte de facture, HTML, chemin de donnée ou dump PDF.

### P11 — Profil

Réemploi de la liste E6 : retirer ou muter chacun des treize champs fait échouer. Un hôte différent
interdit l'acceptation ; un renderer différent produit à la fois l'écart de profil et le diagnostic
des documents. Les arguments de lancement sont triés et comparés.

### P12 — Acceptation

Refuser candidat incomplet, profil hôte non officiel, manifest invalide, cible hors du dossier exact
et fichier extra. Sur un petit arbre temporaire, la promotion remplace tous les fichiers nommés et
le manifeste, ne supprime rien d'autre et laisse soit l'ancien lot complet, soit le nouveau si une
écriture échoue.

### P13 — Corpus réel

Sous le profil officiel : six PDF, 21 pages, nombres exacts du §2.2, entrées inchangées, six HTML et
six certificats. Une seconde génération neuve est identique à la première avant même de la comparer
aux références historiques.

Cette répétition courte ne remplace pas les dix fois d'E6 ; elle vérifie que le générateur E7
n'introduit aucune variation propre.

### P14 — CI

- job bloquant sur PR et `main` ;
- Node patch exact et Ubuntu exact ;
- Chromium Puppeteer, aucun `executablePath` ;
- `--no-sandbox` présent dans le profil ;
- aucune credential persistée ;
- candidat et rapport publiés seulement sur échec, sept jours ;
- aucune commande d'acceptation dans le workflow ;
- un échec d'upload ne transforme pas un échec de comparaison en succès.

### P15 — Revue PDF humaine

Rendre les 21 pages en PNG à résolution fixe avec Poppler, puis vérifier :

- aucun texte coupé, chevauché, carré noir ou glyphe de repli ;
- marges, formats et numéros de page ;
- en-têtes répétés et reports sur toutes les pages postérieures à la première ;
- cadres de totaux/règlement entiers et mentions sur la dernière page ;
- français/euros et anglais/dollars lisibles ;
- fonds, tampons, grilles et plans de calque ;
- document historique v1 lisible sur sa page de compatibilité.

Les PNG sont temporaires et non committés. L'ADR consigne le lecteur, le rasteriseur, la résolution
et le résultat, pas les images.

---

## 9. Matrice de mutations obligatoire

Chaque mutation est temporaire, restaurée immédiatement et contrôlée par `git diff` :

| Mutation | Échec attendu |
| :--- | :--- |
| changer de 0,1 mm un padding commun | PDF complet ; pages isolées concernées |
| ne plus répéter l'en-tête de table | pages 2..N, certificats et PDF |
| omettre le report entrant | pages 2..N des factures longues |
| compter une contribution sur le mauvais fragment | certificat et PDF à la couture concernée |
| ignorer `keepTogether` sur le cadre de règlement | dernière couture et page finale |
| peindre la bande `lastOnly` partout | toutes les pages indues |
| échanger `FRENCH_VALUES` et `ENGLISH_VALUES` | deux scénarios écrits, entrée et PDF |
| retirer le calque de premier plan | scénario layered, pages 1..5 |
| bypasser `parseTemplate` pour `historical-v1` | rendu refusé ou empreinte historique absente |
| modifier la page de compatibilité v1 | scénario historique, page 1 |
| remettre une métadonnée temporelle | PDF complet ; différence document-level |
| modifier une face de fonte ou le canonicaliseur | profil renderer + documents/pages touchés |
| faire comparer seulement les SHA du manifeste | test de deux fichiers différents à faux SHA commun |
| retirer un scénario du registre seulement | fermeture registre/manifeste/répertoire |
| appeler l'acceptation depuis le workflow | test structurel CI rouge |

La recette « modification volontairement fautive du moteur » de la roadmap est tenue seulement si
au moins une mutation de pagination et une mutation purement visuelle sont jouées contre le vrai
job E7, pas seulement contre le comparateur artificiel.

---

## 10. Incréments d'exécution

### INC-0 — Contrats du harnais

1. créer `tools/golden/` ;
2. écrire JSON canonique, schéma Zod et types de manifeste ;
3. écrire les tests P1/P2 ;
4. n'ajouter encore ni navigateur, ni PDF de référence, ni workflow.

**Sortie :** une forme de référence invalide est toujours refusée lisiblement.

### INC-1 — Registre fermé et témoin C9

1. composer les six scénarios depuis les fixtures existantes ;
2. partager réellement le modèle bilingue ;
3. importer le document v1 brut et le passer par `parseTemplate` ;
4. calculer les empreintes d'entrée ;
5. écrire P3 à P5.

**Sortie :** six entrées stables et aucune copie de la fixture historique.

### INC-2 — Candidats et certificats par page

1. réemployer le profil E6 ;
2. appeler les deux ports publics ;
3. écrire l'extracteur `pdf-lib` et ses gardes ;
4. produire le manifeste candidat ;
5. écrire P6, P8 et P9 ;
6. mesurer taille et durée sur une génération locale non officielle.

**Sortie :** un dossier candidat complet, déterministe et non suivi.

### INC-3 — Comparateur et acceptation sûre

1. comparer profil, entrée, fichiers, pages, certificats et HTML ;
2. produire console et `report.json` ;
3. accumuler toutes les différences ;
4. écrire l'acceptation atomique ;
5. écrire P7, P10 à P12 ;
6. confirmer qu'aucun chemin de vérification n'écrit dans les références.

**Sortie :** un faux moteur désigne scénario et page, mais rien ne peut se mettre à jour seul.

### INC-4 — Job CI et bootstrap officiel

1. appliquer M-2 sans toucher aux jobs E6 ;
2. générer le premier candidat Ubuntu ;
3. publier l'artefact malgré l'absence attendue de références ;
4. télécharger et valider le profil ;
5. inspecter visuellement les 21 pages ;
6. appliquer M-1 via l'acceptation ;
7. committer le manifeste et les six PDF ;
8. rejouer la CI dans un workspace propre.

**Sortie :** la porte historique est verte sur le profil officiel.

### INC-5 — Ablations, documentation et fermeture

1. jouer la matrice de mutations ;
2. mesurer taille, durée et diagnostics ;
3. écrire l'ADR 0020 avec les corrections du plan ;
4. marquer E7 livré dans la roadmap moteur ;
5. lever seulement les dépendances E7 de V3, S1 et E9 ;
6. rectifier l'axe 7 de la stratégie QA ;
7. marquer ce plan périmé en dernier.

**Sortie :** E7 devient la mémoire officielle du rendu, et non un dossier de snapshots sans mode
d'emploi.

---

## 11. Ordonnancement et commits logiques

| Ordre | Commit logique | Ne mélange pas |
| :--- | :--- | :--- |
| 1 | schéma, canonical JSON et tests | corpus/PDF/CI |
| 2 | registre et fixture historique | comparateur/CI |
| 3 | génération, extraction et tests | références binaires |
| 4 | comparaison, diagnostic et acceptation | workflow/PDF |
| 5 | job CI de bootstrap sous M-2 | références |
| 6 | six PDF + manifeste approuvés sous M-1 | code du harnais |
| 7 | mutations + ADR 0020 + roadmaps | changement de renderer |

Chaque commit de code laisse lint, build, type-check et couverture verts. Le commit de références
est séparé pour que son diff textuel montre exactement ce que la revue visuelle approuve.

---

## 12. Portes de validation

Dans l'ordre CI obligatoire :

```bash
pnpm run lint && pnpm run build && pnpm run type-check && pnpm run test:coverage
```

Puis, sous le profil officiel :

```bash
node tools/golden/render.mjs test-results/golden/e7 --no-sandbox
node tools/golden/compare.mjs tests/golden/e7/references test-results/golden/e7
```

Contrôles supplémentaires :

1. tests ciblés du harnais sans navigateur ;
2. génération locale deux fois et comparaison candidat/candidat ;
3. job E7 officiel candidat/référence ;
4. matrice de mutations ;
5. rendu Poppler et revue humaine des 21 pages ;
6. `git status --short` confirmant qu'une vérification verte n'a modifié aucun golden ;
7. inspection à blanc des tarballs : aucun `tests/golden`, aucun outil, aucun PDF ;
8. audit production inchangé et aucune dépendance ajoutée.

### 12.1 Mesures à consigner dans l'ADR 0020

- treize champs du profil officiel ;
- versions du manifeste, du générateur, de l'extracteur et du canonicaliseur ;
- nombre de scénarios et pages ;
- taille et SHA-256 de chaque PDF ;
- taille totale committée ;
- taille/empreinte HTML et certificat par scénario ;
- durée médiane et maximale de trois vérifications CI ;
- taille du candidat et du rapport d'échec ;
- résultat de chaque mutation ;
- résultat de la revue visuelle ;
- couverture globale et par paquet ;
- confirmation que les paquets publiés ne contiennent aucun golden.

---

## 13. Risques et signaux de réouverture

| Risque | Filet | Signal |
| :--- | :--- | :--- |
| faux échec sur autre ICU/OS | profil hôte refusé avant qualification | besoin fréquent de vérifier hors CI officielle |
| montée Puppeteer/Chromium change tout | profil renderer + candidat page par page | upgrade de sécurité à approuver rapidement |
| diff Git binaire illisible | manifeste textuel + artefact candidat + revue PNG | reviewers ne peuvent pas ouvrir les PDF |
| sous-ensemble de fonte sur-diagnostique | certificat E5 distingue coupe et contenu ; V3 fera le pixel | toutes les pages toujours annoncées sans cause |
| corpus trop lent | six scénarios, séquentiels, budget mesuré | dépassement durable de 60 s sur runner officiel |
| dépôt grossit | budget initial 2 Mio, nouveaux scénarios motivés | plus de 10 Mio ou clone sensiblement ralenti |
| fixture partagée change l'entrée | `inputSha256` + `recipeVersion` | mises à jour fréquentes sans capacité nouvelle |
| acceptation trop facile | commande séparée, jamais CI, revue obligatoire | golden mis à jour sans rapport ni PDF consulté |
| rapport divulgue le document | digests et ids seulement | apparition d'HTML, donnée ou texte lié |
| test E7 masque un test fonctionnel retiré | carte des propriétaires du §2.3 | mutation tuée seulement par golden, plus par le module propriétaire |
| extraction `pdf-lib` change | version d'extracteur et test de stabilité | dépendance transitive ou algorithme modifié |
| besoin de parité réelle viewer/PDF | frontière explicitement laissée ouverte | démarrage V3 |

### 13.1 Limites qui restent vraies après E7

- Un golden identique ne prouve pas qu'un comptable juge la facture correcte ; la revue métier J3
  reste ouverte.
- L'égalité binaire est qualifiée par le profil E6, pas promise entre ICU ou plateformes.
- Le diagnostic mono-page est conservateur, pas un diff pixel.
- E7 compare l'histoire du PDF moteur ; il ne compare encore aucun aperçu React.
- Le corpus synthétique ne prouve ni sécurité, ni timeout, ni mémoire, ni concurrence.
- Une évolution volontaire exige encore un jugement humain ; le test ne décide pas si le nouveau
  rendu est meilleur.
- Le service S1 peut démarrer après E7, mais E8 reste obligatoire avant toute exposition hostile.

---

## 14. Définition de terminé

- [ ] M-1 et M-2 approuvés ;
- [ ] six scénarios exactement, ids et recettes du §2.2 ;
- [ ] même objet modèle pour FR/EUR et EN/USD ;
- [ ] fixture v1 brute inchangée, migrée par `parseTemplate` et rendue ;
- [ ] six PDF officiels committés sous 2 Mio au total ;
- [ ] manifeste Zod v4, fermé, versionné et sans timestamp ;
- [ ] empreinte d'entrée pour chaque scénario et empreinte brute v1 ;
- [ ] profil E6 complet stocké ;
- [ ] PDF complet comparé par octets, pas seulement par SHA ;
- [ ] PDF mono-page stable et comparé par octets ;
- [ ] certificat E5 et HTML figés par empreinte ;
- [ ] scénario et page(s) dans chaque diagnostic ;
- [ ] générateur refuse un dossier non vide ;
- [ ] comparateur strictement en lecture seule ;
- [ ] acceptation atomique, explicite et absente de la CI ;
- [ ] job Ubuntu 24.04 / Node 24.11.1 bloquant ;
- [ ] artefacts d'échec synthétiques, sept jours, aucune credential persistée ;
- [ ] deux générations candidates identiques ;
- [ ] 21 pages inspectées visuellement ;
- [ ] mutations de pagination et visuelle tuées sur le vrai corpus ;
- [ ] quatre portes vertes dans l'ordre ;
- [ ] aucun changement de package, lockfile, contrat public ou version d'AST ;
- [ ] aucun golden dans les tarballs publiés ;
- [ ] ADR 0020 et roadmaps mises à jour après la preuve, pas avant.

E7 est terminé quand une faute volontaire dans le moteur rend automatiquement la CI rouge, nomme
la facture et la ou les pages affectées, et qu'une évolution volontaire ne peut redevenir verte
qu'après génération sous le profil officiel, revue visuelle et acceptation explicite du nouveau lot.

---

## 15. Contrôle avant démarrage

Avant INC-0 :

1. confirmer que la livraison E6 et son job inter-machines sont verts ;
2. relever les modifications locales existantes et préserver celles d'ADR 0019, de la roadmap et
   du workflow ;
3. obtenir M-1 et M-2 ;
4. vérifier que `pdf-lib` reste une dépendance d'exécution de l'adaptateur ;
5. vérifier que les fixtures C9 et E1-E6 sont présentes aux chemins cités ;
6. lancer les quatre portes sur la baseline ;
7. ne créer aucun PDF suivi avant que le harnais et le job officiel aient produit un candidat.

Si le profil E6 n'est pas encore vert sur deux runners propres, E7 ne commence pas : figer une
sortie dont la reproductibilité n'est pas démontrée transforme le premier filet de sécurité en
générateur de bruit.
