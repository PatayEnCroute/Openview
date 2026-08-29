# ADR 0021 — Le moteur survit à un document hostile

- **Statut :** 🟡 **Accepté, mesures de charge en réserve** (2026-08-29) — les bornes, le courtier de
  ressources, le worker tuable, le pool et la façade durcie sont livrés et verts ; **le corpus
  hostile outillé, le job CI dédié et la mesure 60 pages / 60 000 lignes ne le sont pas** (voir
  [§ Ce qui reste ouvert](#ce-qui-reste-ouvert)).
- **Date :** 2026-08-29
- **Impact :** `@openview/engine` (bornes logiques, résolution d'images par session, codes d'erreur),
  `@openview/adapter-puppeteer` (ressources, flux PDF borné, navigateur réutilisable, worker,
  protocole, pool, audit, façade durcie). **`@openview/core`, `@openview/designer` et
  `@openview/viewer` sortent du lot sans une ligne modifiée.**
- **Un changement de comportement du chemin direct**, à connaître : `createPuppeteerPdfStrategy()`
  lit désormais son PDF en flux borné et vérifie la taille de la forme canonique. Un document
  au-dessus de 64 Mio, qui sortait auparavant, est refusé par `pdf-limit-exceeded`. C'est plus de
  douze fois le plus gros document que ce dépôt produit, et le plafond est configurable, mais
  l'intégrateur existant doit le savoir.
- **Aucune dépendance nouvelle.** `zod@^3.25.76` était déjà verrouillé et livré par `core` ; il
  devient une dépendance **directe** d'`engine` et de l'adaptateur, parce que les deux valident
  désormais des contrats de données qui leur appartiennent. `node:worker_threads`,
  `node:diagnostics_channel`, `node:async_hooks`, `node:dns`, `node:https`, `node:net` et
  `node:crypto` font le reste. Aucune entrée `minimumReleaseAgeExclude` n'est ajoutée.
- **Aucun contrat stocké ne bouge.** Ni `Template`, ni `ImageNode`, ni `RenderRequest` ne gagnent un
  champ : **pas d'incrément de `schemaVersion`, pas de migration**. Le manifeste d'actifs et le
  protocole de worker portent chacun leur propre version, sans relation avec celle du document.
- **Mandats exercés :** M-1 (zod en dépendance directe des deux paquets), M-3 (politique d'images
  distantes stricte). **M-2 (job CI hostile) n'est pas exercé** : le workflow n'est pas modifié,
  faute du corpus outillé qu'il aurait exécuté.
- **Plan d'implémentation :**
  [docs/plans/e8-le-moteur-survit-a-un-document-hostile.md](../plans/e8-le-moteur-survit-a-un-document-hostile.md)
  — les écarts sont au [§ Ce que l'exécution a corrigé du plan](#ce-que-lexécution-a-corrigé-du-plan).

---

## Contexte

Rendre un modèle, c'est exécuter ce que quelqu'un d'autre a écrit. Avant ce lot, le moteur bornait
la **forme** d'un modèle (`assertBoundedShape`, profondeur 64, 100 000 valeurs) et le **calcul** de
ses expressions (1 000 000 de pas, 100 000 items). Douze écarts restaient ouverts, et chacun d'eux
suffit à immobiliser un service :

1. aucun plafond d'expansion matérialisée — une boucle de 100 000 éléments au corps statique dépense
   une poignée de pas et alloue des millions d'objets ;
2. aucun plafond de pages — `paginate()` poussait jusqu'à épuisement du flux ;
3. aucun plafond d'HTML — le sérialiseur construisait la chaîne entière avant qu'un adaptateur la
   voie ;
4. aucun plafond de PDF, ni à l'entrée de `pdf-lib` ni à sa sortie ;
5. aucun plafond d'image — une URI `data:` gigantesque atteignait Chromium ;
6. aucun délai interruptible — `Promise.race` n'arrête pas une évaluation synchrone ;
7. aucun pool — chaque rendu lançait son propre navigateur ;
8. aucune borne de concurrence ni de file ;
9. aucune politique distante sûre — le backend refusait tout HTTP, sans savoir autoriser une
   ressource exacte ;
10. aucun contrat de transport entre threads ;
11. aucun canal d'audit standard ;
12. aucune preuve qu'un rendu normal fonctionne **immédiatement après** une attaque.

---

## Décisions

### 1. Deux étages, et une seule façade sûre

`@openview/engine` borne ce dont il connaît la sémantique : occurrences matérialisées, pages, octets
d'HTML. `@openview/adapter-puppeteer` borne ce qui dépend de Node et de Chromium : transport, temps,
mémoire du worker, ressources, concurrence, PDF.

`createPdfRenderPort()` et `createPaginationPort()` prennent les nouveaux défauts logiques et ne
prétendent **pas** imposer un délai mural : rien dans `engine` ne peut interrompre une évaluation
synchrone. `createPuppeteerRenderRuntime()` est la façade durcie complète, et sa documentation dit
explicitement qu'elle est la seule qu'un service peut pointer vers un document qu'il ne contrôle
pas.

### 2. Les défauts sont actifs, et un champ invalide est refusé

| Limite | Défaut | Plafond de configuration |
| :--- | ---: | ---: |
| unités matérialisées | 250 000 | 2 500 000 |
| pages | 100 | 10 000 |
| HTML UTF-8 | 32 Mio | 320 Mio |
| PDF brut / canonique | 64 Mio chacun | 640 Mio |
| images distinctes | 64 | 640 |
| image encodée | 8 Mio | 80 Mio |
| images cumulées | 32 Mio | 320 Mio |
| pixels par image | 25 000 000 | 250 000 000 |
| pixels cumulés | 100 000 000 | 1 000 000 000 |
| source textuelle d'une image | 16 Mio | 160 Mio |
| valeurs de transport | 500 000 | 5 000 000 |
| chaînes de transport cumulées | 64 Mio de code units | 640 Mio |
| slots | 1 | 32 |
| file en attente | 4 | 40 |
| attente en file | 5 s | 10 min |
| rendu actif | 30 s | 10 min |
| arrêt / remplacement | 5 s | 10 min |
| vieux tas V8 du worker | 256 Mio | 2 560 Mio |
| pile du worker | 4 Mio | 40 Mio |
| rendus par worker | 100 | 1 000 |
| ressource distante | 10 s | 60 s |
| redirections | 3 | 10 |

Un champ absent prend son défaut ; un champ présent mais invalide — zéro, négatif, fractionnaire,
`NaN`, infini, ou une clé inconnue — est **refusé**, jamais remplacé en silence. Les plafonds de
configuration existent pour une seule raison : sans eux, `1_000_000_000` serait une manière
documentée de désactiver E8.

**Le défaut de concurrence est 1, et il ne lit pas la machine.** `os.availableParallelism()` ferait
dépendre le refus d'un document de l'hôte qui le rend, ce qui est exactement la lecture
d'environnement que ce dépôt refuse partout ailleurs.

### 3. Le budget de matérialisation est compté avant allocation

`MaterializationBudget` réserve **avant** de construire chaque objet persistant : bloc, run de texte
ou marqueur, ligne, cellule, occurrence de groupe conservée, item de grille, bande, calque. Les
`flatMap` qui allouaient un tableau intermédiaire avant tout contrôle sont devenus des boucles avec
réservation avant `push` : un contrôle qui s'exécute une fois le tableau construit a déjà payé le
tableau qu'il devait refuser.

Le budget est **partagé** entre la première passe et `extendBands()`, comme le budget d'évaluation :
deux passes restant chacune sous le plafond laisseraient un rendu atteindre le double.

Le refus porte le plafond et le site, **jamais le total courant** : les réservations se font objet
par objet, donc un total ne ferait que répéter le plafond tout en suggérant la cardinalité du jeu de
données de l'appelant.

### 4. Le plafond de pages coupe avant la page excédentaire

`paginate()` refuse `page-limit-exceeded` **avant** `fillFlow` de la page `maxPages + 1`. Le probe
de comptage et les huit rounds de stabilisation appellent le même `paginate()`, donc aucun appel ne
peut calculer 10 000 pages « juste pour savoir » qu'il devait les refuser à 100.

### 5. Le sérialiseur HTML compte des octets UTF-8, pas des code units

`serializeHtml(tree, limit)` accumule ses fragments dans un écrivain qui compte au moment de chaque
ajout. Le compteur n'est pas `String.length` : un document d'emoji passerait un plafond qu'il
dépasse du double. Sous le plafond, la sortie est identique octet pour octet à celle de la
concaténation précédente — c'est ce que vérifie le test de parité.

### 6. L'intégrité précède l'incorporation, et Chromium ne voit jamais une URL

Une image distante n'est acceptée que si sa **source exacte** figure au manifeste du runtime avec
son type MIME et son SHA-256 attendus. Une liste d'origines est refusée par construction : elle ne
prévient ni le remplacement de l'actif, ni la dérive du rendu, ni une URL imprévue sous la même
origine.

Le courtier, dans l'ordre : borne la source textuelle avant parsing, trouve une entrée exacte,
obtient les octets sous plafond, vérifie le SHA-256 en temps constant, vérifie la **signature
binaire** contre le type déclaré, lit les dimensions avec un parseur borné (PNG `IHDR`, premier
`SOF` JPEG, `VP8`/`VP8L`/`VP8X` WebP), vérifie pixels individuels et cumulés, puis produit une URI
`data:`.

**Deux sources portant le même SHA-256 restent deux autorisations distinctes** : le digest seul
n'autorise jamais un nom inattendu.

### 7. La défense SSRF se fait à la connexion, pas au texte du hostname

Pour une entrée `https` : protocole HTTPS, credentials absents, port 443 seul, forme canonique
identique à la source enregistrée, résolution A **et** AAAA, refus si **une seule** des réponses
désigne loopback, link-local, privé, CGNAT, multicast, non spécifié, documentation, benchmark ou
IPv4 mappée interdite. L'adresse retenue est ensuite épinglée par le hook `lookup` de
`https.request` : sans lui, Node résout le nom une seconde fois et l'adresse examinée n'est pas
nécessairement celle que la socket ouvre.

SNI, certificat et en-tête `Host` gardent le hostname original : épingler change **qui est appelé**,
pas **qui est authentifié**. `Accept-Encoding: identity` — un corps compressé pourrait dépasser le
plafond après avoir été accepté. Aucun cookie, aucune autorisation, aucun en-tête du modèle. Chaque
redirection repasse **toute** la politique : ne revalider que la première URL laisse inexaminée
celle qui répond vraiment.

**Un nom qui répond une adresse publique et une adresse privée est refusé en entier** — c'est la
forme exacte d'une attaque par rebinding, et choisir la réponse acceptable la ferait réussir.

### 8. Le processus principal possède Chromium, le worker est tuable

Le worker exécute `core`, `engine` et la canonicalisation PDF. Le processus principal possède les
navigateurs et répond aux opérations `open`, `resolve`, `measure`, `print` et `close`.

Cette disposition résout le défaut d'un « worker qui lance Chromium » : `worker.terminate()` tue le
JavaScript, pas nécessairement un processus enfant déjà lancé. Ici, au délai, le parent termine le
worker **et** ferme le `BrowserContext` qu'il possède encore ; si ce nettoyage ne répond pas, le
navigateur est remplacé.

Au délai, sept effets, et pas six : la tâche devient terminale une seule fois, le worker est retiré,
`await worker.terminate()` est lancé, le contexte est fermé, le navigateur est remplacé si son
nettoyage échoue, un nouveau worker doit répondre avant que le slot redevienne libre, et l'appelant
reçoit `render-timeout` avec la limite et la phase. **Un `Promise.race` sans ces effets est une
capacité définitivement perdue déguisée en refus.**

### 9. `resourceLimits` est une défense partielle, nommée comme telle

Le worker fixe `maxOldGenerationSizeMb` et `stackSizeMb`. Une sortie `ERR_WORKER_OUT_OF_MEMORY` est
traduite en `render-memory-limit-exceeded`, le slot est reconstruit, et le témoin doit passer.

Node documente que cette limite ne couvre ni les `ArrayBuffer`, ni les allocations externes, ni
Chromium. **E8 ne présente donc jamais cette option comme un cgroup portable** : les bornes
structurelles ferment ce que la bibliothèque contrôle, et un service hostile doit encore tourner
sous une limite de processus ou de conteneur. C'est écrit dans le message d'erreur lui-même.

### 10. Le protocole ne sérialise jamais une erreur brute

Un `DocumentRenderError` traverse la frontière projeté sur huit champs sûrs : `nodeId`, `path`,
`region`, `limit`, `observed`, `pageNumber`, `phase`, `resourceKind`. `diagnostics` et `occurrence`
restent derrière — un diagnostic cite l'opérande qui a arrêté une expression, une adresse
d'occurrence compte des itérations, et les deux feraient sortir la donnée de l'isolat censé la
contenir. Toute autre erreur devient une phrase constante sous `render-worker-failed`.

Chaque message porte `formatVersion`, `generation` et `sequence`. Un message d'une génération déjà
remplacée détruit le slot au lieu de terminer la promesse du rendu suivant.

### 11. L'audit passe par `diagnostics_channel`, sans port de logging

AGENTS.md refuse un port de logging, et la règle anti-sur-ingénierie refuse une abstraction sans
second adaptateur. Le runtime publie donc sur `openview.render.audit` un événement fermé :
`renderId` (un compteur local, pas un UUID), `outcome`, `phase`, `code`, `queueMs`, `renderMs`. Ni
modèle, ni donnée, ni HTML, ni URL, ni empreinte, ni PID, ni stack, ni cause — par construction et
par recherche dans le JSON du test.

### 12. La résolution d'images appartient à la session, pas au modèle

`DocumentImage` gagne la **clé d'occurrence**, et `PdfRenderSession` gagne `resolveImages()`. Le
moteur vérifie qu'aucune clé n'est manquante, dupliquée ou étrangère, puis passe la table aux
constructeurs HTML, qui lisent cette table **au lieu** de la source stockée.

Les deux variantes écartées : parcourir toutes les branches chargerait des images inatteignables et
pourrait refuser un modèle valide ; remplacer une URL dans l'HTML sérialisé ferait de la sécurité
une opération de texte fragile.

C'est un changement pré-1.0 d'un port **interne** : `PdfRenderSession` et `PdfSourceDocument` ne
sont ni stockés, ni sérialisés, ni versionnés.

### 13. `close()` a une sémantique unique

Idempotent : refuse toute nouvelle admission, annule les tâches en file avec `runtime-closed`,
laisse les tâches actives finir **sous le délai déjà posé**, ferme workers et navigateurs, et ne
résout qu'après disparition de tous les handles possédés. Il n'existe pas de `close({ force: true })`
concurrent : l'appelant possède déjà `AbortSignal` pour annuler une tâche.

---

## Ce que l'exécution a corrigé du plan

1. **`ready` est exempté du contrôle de génération.** Un worker neuf s'annonce avant d'avoir appris
   quelle génération il sert, et son annonce ne termine rien. Le plan décrivait un contrôle
   uniforme ; l'appliquer à `ready` rendait tout slot reconstruit inutilisable.
2. **Le sous-arbre partagé deux fois est copié, pas refusé.** Le plan classait « partage » avec
   « cycle ». Un partage est ordinaire dans une donnée JSON ; il est copié deux fois et **compté**
   deux fois, ce qui laisse le budget une borne supérieure honnête. Seul un cycle est refusé.
3. **Le manifeste est validé depuis `unknown`.** Il vient d'une configuration d'hôte, souvent lue
   d'un fichier JSON : un paramètre typé aurait décrit un appelant TypeScript qui n'est pas celui
   que ce code protège.
4. **`resourceKind` distingue `embedded-image` de `remote-image`.** Le plan annonçait un
   discriminant fermé sans le peupler ; un discriminant à une seule valeur ne dit rien.
5. **Le worker est un fichier d'amorçage, la logique est ailleurs.** `runtime/worker.ts` ne fait que
   câbler `parentPort` ; `runtime/handler.ts` porte la stratégie proxy et l'exécution du moteur, et
   se teste dans le processus de test. Un thread ne peut pas être instrumenté depuis celui qui l'a
   lancé, et ce découpage est ce qui rend la mesure possible.
6. **Le port de pagination durci ne prétend pas `RenderPort`.** `ProtectedPaginationPort` étend
   `PaginationPort`, qui n'a pas de champ `format`.

---

## Ce qui reste ouvert

Trois éléments du plan ne sont **pas** livrés, et rien dans ce dépôt ne prétend le contraire :

- **Le corpus hostile outillé** (`tests/hostile/e8/`, `tools/hostile/run.mjs`) et le **job CI
  bloquant** (M-2). Les refus et la reprise sont prouvés par les suites unitaires et par un test qui
  lance un vrai thread bloqué, le termine et rend un témoin ; il n'existe pas encore de registre
  d'attaques exécutable ni de rapport JSON publiable.
- **La mesure 60 pages / 60 000 lignes** et le KPI de 2,0 s. Le protocole du §0.3 du plan n'a pas
  été exécuté : **la cible QA n'est donc ni confirmée ni infirmée**, et le tableau QA la garde
  marquée comme non mesurée. Aucun chiffre de performance n'est avancé ici.
- **La parité E7 octet pour octet entre chemin direct et runtime durci** sur les six scénarios
  figés. Un test de bout en bout, sur un vrai Chromium, prouve déjà que les deux façades rendent le
  **même digest** pour un document d'une page portant une image ; la comparaison avec le lot figé
  reste à jouer sur l'hôte officiel.
- **Un succès HTTPS de bout en bout.** La politique distante — manifeste, forme canonique, DNS
  épinglé, classe d'adresse, redirections, plafonds, empreinte — est prouvée par des tests unitaires
  contre un transport injecté, et le hook `lookup` est vérifié sous les deux formes que Node lui
  demande. **Aucune socket TLS n'est jamais ouverte, ni en production dans ce dépôt, ni en test :**
  l'autorité locale de fixture que le plan prévoyait (P8) n'existe pas. Un intégrateur qui active
  une entrée `kind: 'https'` est le premier à exercer ce chemin en vrai.

Les **24 mutations** de la matrice du plan n'ont pas été jouées une à une. Les tests correspondants
existent pour la majorité d'entre elles ; le verdict consigné, lui, n'existe pas.

---

## Conséquences

**Ce que le lot ferme.** Une boucle statique, une pagination sans fin, un HTML ou un PDF énorme, une
image de 400 Mo, une bombe de pixels, une source non autorisée, un digest faux, une redirection vers
une adresse privée, un rebinding DNS, une rafale locale, un worker bloqué, un worker en OOM et un
navigateur écroulé produisent chacun un refus typé, un événement d'audit fermé, et un slot
reconstruit.

**Ce que le lot n'ouvre pas.** Openview ne devient ni un service, ni un gestionnaire d'actifs, ni
une source de données. Aucun nom de champ n'est réservé dans `RenderRequest.data`, aucune valeur
n'est journalisée, aucune horloge n'entre dans `core` ou `engine` — le pool mesure des **durées**
avec `process.hrtime`, dans l'adaptateur, et une durée n'est pas une date.

**S2 reste nécessaire.** E8 borne un **document**. Il ne borne ni le nombre d'appels par client, ni
la taille du corps avant parsing HTTP, ni l'authentification, ni le quota, ni le déploiement.
Publier S1 avec E8 mais sans S2 reste une erreur.

**Les images SVG restent refusées.** SVG est un langage actif ; il n'entre pas par simple ajout d'un
type MIME. Une rasterisation sûre avant Chromium demanderait sa propre décision.

**Les polices restent le catalogue incorporé d'E6.** La politique réseau des fontes est l'ensemble
vide, ce qui est une liste blanche complète et déterministe. Une fonte distante rouvrirait l'ADR
0019 : source, intégrité, quatre faces, couverture `cmap`, licence, NOTICE et comportement hors
ligne.

---

## Signaux de réouverture

- **Un OOM du processus sous les limites E8** impose une isolation processus ou cgroup, pas un
  relèvement silencieux d'un plafond.
- **Une croissance monotone de mémoire sur cinquante rendus chauds** impose d'abaisser
  `maxRendersPerWorker` et de recycler le navigateur au même rythme.
- **Un p95 mesuré au-dessus de 2,0 s** appartient au propriétaire du produit : optimisation, machine
  plus forte, ou KPI corrigé — jamais un relèvement du délai pour déclarer la cible atteinte.
- **Un besoin de CDN authentifié** exige un courtier de l'hôte en amont, pas des credentials dans le
  modèle.
