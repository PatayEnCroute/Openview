# Plan d'implémentation — `@openview/engine` lot E8 : le moteur survit à un document hostile

> **Statut :** plan prêt à exécuter sous les mandats M-1 à M-3 — 2026-08-29  
> **Lot :** E8 — poids L annoncé, **L confirmé** si les exclusions du §2.3 restent fermées  
> **Dépend de :** E1 selon la roadmap ; baseline réelle E1 à E7  
> **Condition de :** exposition hostile du service J5 et service S2  
> **Décision d'exécution attendue :** ADR 0021

E8 ajoute deux défenses complémentaires. Le moteur reçoit des bornes logiques sur ce qu'il peut
matérialiser, paginer et sérialiser. L'adaptateur Puppeteer reçoit un runtime isolé, limité en
concurrence, capable d'interrompre un calcul synchrone et de remplacer le worker ou le navigateur
qui a cessé de répondre.

Le chemin existant reste disponible pour un intégrateur local qui contrôle ses entrées. Le nouveau
runtime durci est la seule façade que le futur service peut employer face à un document non fiable.
Il ne donne jamais une URL du modèle à Chromium : une image distante doit appartenir à un manifeste
exact, porter une empreinte attendue, être téléchargée et bornée par Node, puis être incorporée en
`data:` avant la première mesure. La CSP E1 et l'interception réseau restent donc fermées.

E8 ne transforme pas Openview en service, en gestionnaire d'actifs ou en source de données. Il ne
réserve aucun nom dans `RenderRequest.data`, ne journalise aucune valeur, et n'introduit ni règle de
facture, ni horloge dans `core` ou `engine`.

---

## 0. Résultat attendu

La façade durcie prend la forme d'un runtime possédé explicitement par l'appelant :

```ts
const runtime = await createPuppeteerRenderRuntime({
  limits: PROTECTED_RENDER_DEFAULTS,
  imageManifest: [],
});

try {
  const result = await runtime.pdf.render(request, { signal });
} finally {
  await runtime.close();
}
```

Pour chaque rendu :

1. la file réserve une place ou refuse immédiatement la surcharge ;
2. le modèle et le jeu de données sont copiés en données simples sous un budget de transport, sans
   lire d'accesseur et sans valider le vocabulaire de données de l'intégrateur ;
3. un worker persistant valide, migre et matérialise les occurrences atteintes du modèle ;
4. l'ouverture de session transmet leurs images au processus principal, qui les résout sous une
   politique exacte et renvoie uniquement des octets bornés au worker ;
5. le worker associe chaque clé d'occurrence à une URI `data:` éphémère, sans modifier le modèle ;
6. le moteur mesure, pagine et sérialise sous ses budgets logiques, puis résout de la même façon les
   seules images de bandes devenues atteignables après la première coupe ;
7. le processus principal possède le navigateur, une page et un contexte neufs pour ce rendu ;
8. le PDF brut est lu sous plafond, transféré au worker, canonicalisé et renvoyé sans copie inutile ;
9. le contexte est fermé et le slot redevient disponible ;
10. tout refus produit une erreur typée et un événement d'audit fermé qui ne contient ni données,
    ni HTML, ni URL, ni cause inconnue.

Un délai dépassé termine réellement le worker, ferme le contexte et remplace tout composant dont
l'état n'est plus prouvable. Le slot ne revient jamais dans le pool après un timeout, une sortie
mémoire ou un protocole invalide.

### 0.1 Garanties exactes

| Risque | Garantie E8 |
| :--- | :--- |
| expression coûteuse | budgets C1 actifs, plus terminaison du worker au délai mural |
| expansion d'une boucle statique | plafond partagé d'unités matérialisées |
| pagination sans fin utile | progression E2, huit rounds de stabilisation et plafond de pages |
| HTML ou PDF énorme | sérialiseur borné et lecture PDF bornée avant canonicalisation |
| image de 400 Mo | taille encodée, taille décodée, pixels par image et cumul par rendu bornés |
| SSRF / `file:` / métadonnées cloud | manifeste exact, HTTPS, résolution DNS épinglée, plages non publiques refusées, redirections revalidées |
| script ou réseau dans Chromium | JavaScript désactivé, CSP fermée, sources converties en `data:`, interception réseau toujours en refus total |
| rendu bloqué | worker terminé, contexte fermé, navigateur remplacé si son nettoyage ne répond pas |
| rafale locale | concurrence et file bornées ; refus immédiat quand la capacité est prise |
| fuite dans le journal | vocabulaire d'événements fermé, aucune interpolation du modèle ou des données |
| contamination entre clients | un `BrowserContext` neuf par rendu, aucun cache de ressource entre rendus |

### 0.2 Ce que « survit » signifie

Le test de disponibilité n'est pas « la promesse a rejeté ». Après chaque attaque, un rendu témoin
doit terminer dans le slot atteint et dans un autre slot :

```text
attaque → refus typé → nettoyage attesté → remplacement si nécessaire → témoin vert
```

Un timeout qui laisse un worker occupé, un navigateur orphelin ou une capacité définitivement
perdue est un échec du lot, même si l'appelant a reçu `render-timeout`.

### 0.3 Critère de performance

Le KPI QA « facture 60 pages / 60 000 lignes en moins de 2,0 s » devient un protocole mesurable :

- un jeu de données synthétique contient exactement 60 000 lignes sous des noms propres à la
  fixture ; le modèle les agrège et n'en imprime qu'un échantillon borné ;
- le document produit exactement 60 pages, attestées par le certificat E5 et le PDF ;
- le chronomètre couvre copie de transport, worker, mesures Chromium, pagination,
  canonicalisation et retour des octets ;
- le démarrage du runtime et l'attente en file sont mesurés séparément ;
- vingt rendus chauds suivent cinq chauffes, sur l'hôte officiel E6 ;
- le p95 doit rester inférieur à 2,0 s et aucun run ne doit dépasser le délai de rendu ;
- si la mesure contredit la cible, l'ADR remet le chiffre et le profil. Le lot ne relève pas le
  délai pour déclarer le KPI réussi et ne modifie pas la cible QA sans mandat produit.

Ce scénario ne prétend pas imprimer 60 000 lignes sur 60 feuilles : ce serait environ mille lignes
par page et ne correspondrait ni à la géométrie d'une facture ni au plafond de 100 pages. Il prouve
séparément la cardinalité du calcul et la volumétrie visible, dans un seul rendu.

---

## 1. Sources normatives et baseline réelle

### 1.1 Sources qui font foi

- [roadmap moteur, E8](../roadmap/engine.md#e8-le-moteur-survit-à-un-document-hostile) ;
- [AGENTS.md](../../AGENTS.md), particulièrement le périmètre, les limites C1, le Pipeline,
  l'absence de logging port et la sécurité Puppeteer ;
- [ADR 0003](../adr/0003-formules-agregations-et-dates-civiles.md), décision 8 : budgets actifs et
  nécessité d'un worker tuable ;
- [ADR 0004](../adr/0004-les-arrondis-declares-par-le-modele.md) : un vrai arrondi coûte jusqu'à
  deux ordres de grandeur de plus et le délai se dimensionne sur sa machine ;
- [ADR 0007](../adr/0007-l-apparence.md) : fontes et images sont des ressources, sans lecture de la
  machine ;
- [ADR 0012](../adr/0012-une-facture-d-une-page-sort-en-pdf.md) : navigateur par rendu, CSP,
  interception et refus des sources distantes avant E8 ;
- [ADR 0013](../adr/0013-le-tableau-deborde-proprement.md) : progression de pagination, session et
  isolation réseau ;
- [ADR 0019](../adr/0019-le-meme-document-a-chaque-fois.md) : profil de reproductibilité, fontes et
  images incorporées ;
- [ADR 0020](../adr/0020-le-lot-de-documents-figes-de-non-regression.md) : corpus E7 et limite
  explicite face aux documents hostiles ;
- [stratégie QA, axes 2 et 4](../qa/README.md) : corpus hostile, 60 pages, 60 000 lignes et KPI ;
- [Node.js `worker_threads`](https://nodejs.org/download/release/v24.18.0/docs/api/worker_threads.html),
  pour `resourceLimits`, `terminate()` et la limite explicite sur les `ArrayBuffer` et la mémoire
  externe ;
- [Node.js `AsyncResource`](https://nodejs.org/api/async_context.html#using-asyncresource-for-a-worker-thread-pool),
  pour conserver la corrélation asynchrone du pool ;
- [Puppeteer `Browser.createBrowserContext`](https://pptr.dev/api/puppeteer.browser.createbrowsercontext),
  pour l'isolation de cookies et de cache ;
- [Puppeteer request interception](https://pptr.dev/api/puppeteer.page.setrequestinterception),
  pour la règle selon laquelle toute requête doit être explicitement résolue ou avortée.

### 1.2 Ce que le dépôt livre déjà

| Besoin E8 | Baseline | Réemploi imposé |
| :--- | :--- | :--- |
| forme hostile | `assertBoundedShape`, profondeur 64, 100 000 valeurs | aucune seconde validation récursive |
| calcul hostile | 1 000 000 pas, profondeur 64, 100 000 items, chaîne 1 000 000 | même budget partagé entre toutes les expressions du rendu |
| erreurs sûres | `DocumentRenderError`, diagnostics C8, messages constants | aucune valeur ni cause dans l'événement E8 |
| terminaison pagination | preuve de progression et huit rounds de stabilisation | ajouter une borne de pages, ne pas réécrire E2 |
| isolation du contenu | HTML fermé, échappement, CSP, JavaScript désactivé | garder le vocabulaire, ne pas ajouter de sanitizer |
| réseau navigateur | `data:` et `about:blank` seuls, tout le reste avorté | le courtier précède Chromium ; l'intercepteur ne s'élargit pas |
| cycle de vie | page, contexte et navigateur fermés avec `await` en `finally` | extraire une session de contexte réutilisable par le pool |
| déterminisme | catalogue de fontes incorporées, PDF canonique, profil E6 | aucune police système, ressource sans empreinte ou cache opaque |
| non-régression | six scénarios, 21 pages, quatre oracles E7 | comparaison directe et runtime durci sur le même corpus |
| dépendances | Node 24, Puppeteer 25.8.0, `pdf-lib` 1.17.1, Zod déjà verrouillé | aucune nouvelle bibliothèque d'exécution |

### 1.3 Les douze écarts à combler

1. **Aucun plafond d'expansion matérialisée.** Une boucle de 100 000 éléments dont le corps est
   statique dépense peu de pas mais peut créer des millions d'objets.
2. **Aucun plafond de pages.** `paginate()` pousse jusqu'à épuisement du flux.
3. **Aucun plafond d'HTML.** Le sérialiseur construit la chaîne complète avant qu'un adaptateur la
   voie.
4. **Aucun plafond de PDF.** `page.pdf()` et `pdf-lib` peuvent tenir simultanément plusieurs copies.
5. **Aucun plafond d'image.** Une URI `data:` gigantesque est acceptée avant Chromium.
6. **Aucun délai interruptible.** `Promise.race` ne peut pas arrêter l'évaluation synchrone.
7. **Aucun pool.** Chaque façade et chaque rendu lancent leur propre navigateur.
8. **Aucune borne de concurrence ou de file.** Une rafale locale lance autant de Chromiums que
   d'appels.
9. **Aucune politique distante sûre.** Le backend refuse tout HTTP ; il ne sait ni autoriser une
   ressource exacte, ni empêcher un rebinding si l'autorisation est ouverte naïvement.
10. **Aucun contrat de transport de worker.** Les erreurs personnalisées, les octets et le sac de
    données ne peuvent pas être envoyés sans validation et sans règle de fuite.
11. **Aucun événement d'audit.** Les erreurs sont sûres à journaliser mais aucun canal standard ne
    dit qu'un refus a eu lieu.
12. **Aucun corpus de reprise.** Les tests prouvent des refus isolés, jamais qu'un rendu normal
    fonctionne immédiatement après l'attaque.

### 1.4 Sondes jouées pendant la planification

Baseline locale Windows, Node 24.11.1, ICU 77.1, Puppeteer 25.8.0 et Chromium 152.0.7977.42 :

- `pnpm run build` : vert, six paquets ;
- génération E7 complète : 27,1 s pour douze sessions froides, six documents et 21 pages ;
- PDF E7 : 814 832 octets au total, maximum 206 732 octets ;
- HTML autonome E7 : de 578 023 à 2 571 336 octets ;
- le plus grand document courant ne consomme donc que 7,7 % du plafond HTML proposé de 32 Mio et
  0,3 % du plafond PDF proposé de 64 Mio ;
- `PdfRenderSession` ne possède aujourd'hui ni signal, ni limite, ni phase observable ;
- `BrowserContext` et page appartiennent au même objet que le navigateur, ce qui empêche de garder
  le processus tout en détruisant l'état du rendu ;
- la documentation Node confirme que `resourceLimits` borne le tas V8 du worker mais ni les
  `ArrayBuffer`, ni Chromium, ni toute la mémoire du processus ; E8 ne présentera donc jamais cette
  option comme un cgroup portable.

Les fichiers temporaires de cette sonde vivent sous `test-results/`, déjà ignoré. Aucun PDF de
développement n'est une référence E7.

---

## 2. Périmètre fermé

### 2.1 Inclus dans E8

- limites de matérialisation, de pages et d'HTML dans `@openview/engine` ;
- limites d'images, de PDF et de ressources dans `@openview/adapter-puppeteer` ;
- runtime durci asynchrone, pool de workers et de navigateurs, file bornée ;
- délai de file, délai de rendu, annulation, nettoyage et remplacement ;
- manifeste exact d'images incorporées ou HTTPS avec SHA-256 obligatoire ;
- résolution DNS épinglée, blocage des adresses non publiques et redirections revalidées ;
- transport worker validé, erreurs reconstruites et octets transférés ;
- événement d'audit via `node:diagnostics_channel`, sans port de logging ;
- corpus hostile déterministe, reprise après attaque et mesure de charge officielle ;
- parité binaire entre chemin direct et runtime durci sur E7 ;
- ADR 0021, mise à jour de la roadmap et documentation des limites publiques.

### 2.2 Valeurs par défaut proposées

Ces limites sont actives. Un champ absent prend le défaut ; un champ présent mais invalide est
refusé, jamais remplacé silencieusement.

| Limite | Défaut | Motif |
| :--- | ---: | :--- |
| unités matérialisées | 250 000 | couvre 60 000 lignes de calcul et borne les objets de rendu |
| pages | 100 | laisse la cible 60+ avec marge sans accepter des milliers de feuilles |
| HTML UTF-8 | 32 Mio | plus de douze fois le maximum E7 actuel |
| PDF brut et canonique | 64 Mio chacun | borne l'entrée puis la sortie de `pdf-lib` |
| images distinctes | 64 | empêche un manifeste et un DOM d'actifs sans fin |
| image encodée | 8 Mio | refuse le cas 400 Mo avant décodage |
| images cumulées | 32 Mio | borne l'expansion base64 du document |
| pixels par image | 25 000 000 | borne le décodage bitmap individuel |
| pixels cumulés | 100 000 000 | borne la pression Chromium par rendu |
| valeurs de transport | 500 000 | couvre le modèle et 60 000 objets de données usuels |
| chaînes de transport cumulées | 64 Mio de code units | borne la copie avant worker, images comprises |
| workers / navigateurs | 1 | défaut indépendant de la machine, sans lecture de CPU |
| file en attente | 4 | borne la rétention de requêtes et applique le backpressure |
| attente en file | 5 s | une requête ne reste pas indéfiniment en mémoire |
| rendu actif | 30 s | garde un rapport ≥ 15 avec le KPI chaud de 2 s |
| arrêt / remplacement | 5 s | au-delà, le navigateur est tué et recréé |
| vieux tas V8 du worker | 256 Mio | défense partielle, complétée par les bornes logiques |
| rendus par worker | 100 | recycle l'isolate même sans fuite démontrée |
| ressource distante | 10 s | incluse dans les 30 s du rendu |
| redirections | 3 | chacune repasse toute la politique |

Les octets emploient des multiples de 1 048 576. Les hard ceilings de configuration valent dix fois
les défauts, sauf pages (10 000), concurrence (32), redirections (10) et délais (10 minutes). Les
hard ceilings empêchent `1_000_000_000` de devenir une manière documentée de désactiver E8.

INC-0 mesure ces valeurs sur l'hôte officiel. Il peut **abaisser** un défaut ou relever un plafond
strictement nécessaire à la cible 60/60 000 ; toute autre hausse exige une preuve consignée dans
l'ADR. Aucun test ne fixe un temps absolu hors du job profilé.

### 2.3 Exclus, avec propriétaire

| Exclu | Motif | Propriétaire |
| :--- | :--- | :--- |
| taille du corps HTTP, fréquence, identité, quota client | usage hostile d'un service, pas document hostile | S2 |
| cgroup, Kubernetes limit, Windows Job Object | isolation de déploiement, seule borne dure de tout l'arbre de processus | S2 / exploitation |
| logs HTTP et corrélation d'une requête externe | le moteur émet un événement sûr ; il ne connaît pas le service | S3 |
| police distante ou système | E6 impose un catalogue incorporé fermé ; aucun champ de source n'existe | besoin produit futur + nouvelle ADR |
| `file:`, chemin hôte, socket Unix | ouvre le système de fichiers ou le réseau local | jamais dans le runtime hostile |
| URL HTTP non chiffrée | ressource substituable en transit | jamais dans le runtime hostile |
| origine générique ou wildcard | ne donne ni intégrité, ni déterminisme, ni défense contre la dérive d'actif | jamais |
| cache de ressource entre rendus | état partagé, rétention et sémantique d'invalidation | besoin mesuré futur |
| nouveau champ `integrity` dans `ImageNode` | estampille et migration inutiles : le manifeste appartient à l'hôte | aucun dans E8 |
| validation métier de `RenderRequest.data` | le jeu de données appartient à l'intégrateur | jamais |
| fast-check, Stryker, Tinybench, github-action-benchmark | dépendances nouvelles non nécessaires au contrat E8 | QA J7 ou mandat séparé |
| comparaison aperçu/PDF | E7/E8 ne rendent aucun composant React | V3 |
| service ou API HTTP | autre brique et autre modèle de menace | S1 à S4 |

### 2.4 Aucun changement de contrat stocké

Le modèle courant sait déjà porter une source d'image libre et refuse les schémas exécutables ou
locaux. E8 ne change ni `Template`, ni `ImageNode`, ni expression, ni `RenderRequest.data`. Il ne
bouge donc pas `schemaVersion` et n'ajoute aucune migration.

La table éphémère qui associe une occurrence d'image à une URI `data:` n'est jamais rendue à
l'appelant et n'est jamais sauvegardée. Le manifeste d'actifs et le protocole de worker ont chacun
leur propre `formatVersion`, sans relation avec la version du document.

---

## 3. Mandats explicites avant exécution

### M-1 — Autoriser les manifestes de `engine` et `adapter-puppeteer`

**Recommandation : approuver.** Les nouvelles options et le protocole worker sont des contrats de
données et doivent être Zod-first. `zod@^3.25.76`, déjà verrouillé et livré par `core`, devient une
dépendance directe de `engine` et de `adapter-puppeteer`. Ce n'est ni une nouvelle bibliothèque, ni
une exemption `minimumReleaseAgeExclude`.

Les deux `package.json` et `pnpm-lock.yaml` sont protégés par AGENTS.md §7. L'exécution ne commence
pas ce changement sans mandat explicite.

### M-2 — Autoriser le job CI hostile dans `.github/workflows/ci.yml`

**Recommandation : approuver.** Une preuve de timeout, de récupération de slot et de mémoire n'a pas
de valeur dans la matrice unitaire ordinaire. Un job Ubuntu 24.04 / Node 24.11.1 / Chromium E6 :

- exécute le corpus hostile avec deux slots ;
- vérifie la reprise après chaque attaque ;
- mesure le scénario 60 pages / 60 000 lignes ;
- publie le rapport JSON sans modèle, données, HTML, URL ou PDF ;
- échoue si le p95 chaud dépasse 2,0 s ou si une borne mémoire est franchie ;
- garde `--no-sandbox` limité au runner éphémère, comme E1 à E7.

Le workflow est protégé par AGENTS.md §7. Aucun fichier `bench.yml` séparé ni action tierce n'est
nécessaire.

### M-3 — Confirmer la politique d'images distantes

**Recommandation : approuver l'option stricte.** Une image distante n'est acceptée que si sa source
exacte figure dans le manifeste du runtime avec MIME et SHA-256 attendus. Une simple liste d'origines
est refusée : elle ne prévient ni remplacement de l'actif, ni dérive E6, ni URL imprévue sous la même
origine.

Les polices restent incorporées. Si le produit veut un catalogue de fontes distant, il doit rouvrir
explicitement l'ADR 0019, définir les quatre faces, la couverture `cmap`, le pin de version et le
profil E6. Le glisser dans E8 contredirait la table fermée que le dépôt publie aujourd'hui.

### 3.1 Ce que l'exécution n'a pas à demander

- ajouter des codes d'erreur et options publiques dans les paquets concernés ;
- refactorer la session Puppeteer sans changer le comportement du chemin direct ;
- employer les modules Node standard `worker_threads`, `async_hooks`, `diagnostics_channel`, `dns`,
  `http`, `https`, `net` et `crypto` ;
- ajouter tests, fixtures et outils sous `tools/hostile/` et `tests/hostile/e8/` ;
- écrire l'ADR 0021 et mettre à jour les roadmaps après mesure ;
- corriger la documentation QA si, et seulement si, la cible de 2,0 s est contredite et qu'un mandat
  produit distinct a choisi sa nouvelle valeur.

---

## 4. Architecture cible

### D1 — Deux étages, aucune façade faussement sûre

`@openview/engine` borne le travail dont il connaît la sémantique : occurrences, pages et HTML.
`@openview/adapter-puppeteer` borne ce qui dépend de Node et Chromium : transport, temps, mémoire du
worker, ressources, concurrence et PDF.

`createPdfRenderPort()` et `createPaginationPort()` prennent les nouveaux défauts logiques, mais ne
prétendent pas imposer un délai mural. `createPuppeteerRenderRuntime()` est la façade durcie complète
et sa documentation dit explicitement que J5 doit l'employer.

### D2 — Le processus principal possède Chromium

Le worker exécute `core`, `engine` et la canonicalisation PDF. Le processus principal possède les
navigateurs et répond aux RPC `open`, `measure`, `print` et `close`.

Cette disposition résout le défaut d'un « worker qui lance Chromium » : `worker.terminate()` tue le
JavaScript, pas nécessairement tout enfant de processus déjà lancé. Ici, au timeout, le parent peut
terminer le worker **et** fermer le `BrowserContext` qu'il possède encore. Si le contexte ne se ferme
pas dans le délai de nettoyage, il ferme ou tue le processus Chromium et recrée le slot.

### D3 — Un slot = un worker, un navigateur, au plus un rendu

Le runtime crée un nombre explicite de slots. Un slot garde :

- un worker Node persistant sous `resourceLimits` ;
- un navigateur Puppeteer persistant ;
- zéro ou un contexte actif ;
- zéro ou une tâche active ;
- un compteur de générations et de rendus.

Chaque rendu reçoit un contexte et une page neufs. Cookies, cache, service workers et stockage ne
sont pas partagés. Le worker et le navigateur sont recyclés après 100 rendus, ou immédiatement après
timeout, sortie mémoire, crash, protocole invalide ou nettoyage incomplet.

### D4 — La file applique le backpressure

Le runtime n'appelle jamais `puppeteer.launch()` au fil des promesses entrantes. Il affecte une
tâche à un slot libre, met au plus quatre tâches en attente, puis refuse `render-capacity-exceeded`.

Une tâche en file porte déjà une copie simple et bornée de son entrée ; elle ne retient jamais
l'objet mutable de l'appelant. Son délai de file est indépendant du délai d'exécution. Une tâche
annulée en file est retirée sans réveiller de worker.

`AsyncResource` conserve la corrélation de la promesse appelante à travers le pool, sans inventer
une API de tracing propre au projet.

### D5 — Le transport ne définit aucun schéma métier de données

Avant `postMessage`, un cloneur itératif :

- lit les descripteurs, jamais les getters ;
- ne garde que les propriétés propres et énumérables que l'évaluateur pourrait lire ;
- préserve tableaux, objets simples, primitives et noms de clés exacts ;
- refuse fonctions, symboles, accesseurs, cycles et prototypes non simples en mode durci ;
- compte valeurs et longueurs de chaînes ;
- produit une copie sans référence partagée avec l'appelant.

Ce contrôle est un contrat de **transport**, pas un `RenderDataSchema`. Il n'attend aucune clé,
aucune profondeur métier et aucun type de facture. Le chemin direct continue d'accepter le contrat
plus large actuel ; le runtime durci vise les entrées JSON du service.

Les enveloppes RPC sont des unions discriminées Zod 4. Leurs champs `template` et `data` restent
`unknown` jusqu'à leurs frontières respectives ; aucun schéma de données Openview n'apparaît.

### D6 — Le worker est tué, pas seulement abandonné

Le timer vit dans le processus principal. Au délai :

1. la tâche devient terminale une seule fois ;
2. le worker est retiré du pool ;
3. `await worker.terminate()` est lancé ;
4. le contexte et la page sont fermés ;
5. le navigateur est remplacé si la fermeture dépasse cinq secondes ;
6. un nouveau worker est créé et doit répondre à un ping avant que le slot redevienne libre ;
7. l'appelant reçoit `render-timeout` avec la limite et la phase, jamais la donnée courante.

Un `Promise.race` sans ces sept effets est interdit. L'annulation par `AbortSignal` emprunte le même
nettoyage et rend `render-cancelled`.

### D7 — `resourceLimits` est une défense partielle nommée comme telle

Le worker fixe `maxOldGenerationSizeMb` et `stackSizeMb`. Une sortie `ERR_WORKER_OUT_OF_MEMORY` est
traduite en `render-memory-limit-exceeded`, le slot est recréé et le témoin doit passer.

Node documente que cette limite ne couvre pas les `ArrayBuffer`, les allocations externes ou
Chromium. Les limites structurelles, les transferts d'ownership et les plafonds d'octets ferment les
cas contrôlables par la bibliothèque. Le service hostile doit encore tourner sous une limite de
processus ou de conteneur ; E8 le dit dans son API et dans l'ADR au lieu de promettre une borne
portable inexistante.

### D8 — Une unité matérialisée correspond à un objet persistant du document lié

Le nouveau `MaterializationBudget` compte avant allocation :

- chaque bloc ;
- chaque run de texte ou marqueur ;
- chaque ligne et cellule de tableau ;
- chaque occurrence de groupe conservée ;
- chaque item de grille ;
- chaque bande et calque matérialisé.

Le budget est partagé entre la première passe et `extendBands`, comme le budget d'évaluation. Les
`flatMap` qui pourraient allouer un grand tableau avant le contrôle deviennent des boucles avec
réservation avant `push`. Le refus `materialization-limit-exceeded` porte la limite, le nœud et le
chemin connus, jamais le nombre issu des données si ce nombre révèle une cardinalité sensible.

### D9 — Le plafond de pages coupe avant la page excédentaire

`PaginationOptions` reçoit `maxPages`. Avant de remplir la page `maxPages + 1`, `paginate()` lève
`page-limit-exceeded`. Le test de frontière accepte exactement 100 et refuse la suivante sans
construire ses fragments.

La même limite s'applique au probe de comptage et aux huit rounds de stabilisation. Aucun appel ne
peut calculer 10 000 pages « juste pour savoir » qu'il devait les refuser à 100.

### D10 — Le sérialiseur HTML est un écrivain borné

`serializeHtml(tree, limit)` accumule des fragments dans un écrivain qui compte les octets UTF-8 au
moment de chaque ajout. Il lève `html-limit-exceeded` avant de joindre une chaîne supérieure au
plafond. La CSP, le CSS de fontes et chaque sonde passent par ce même écrivain.

Le compteur ne se fonde pas sur `string.length`, qui compte des unités UTF-16 et sous-estime certains
caractères en UTF-8. La sérialisation reste déterministe et le HTML sous le plafond reste octet pour
octet identique à E7.

### D11 — Le PDF brut est lu comme un flux borné

Le runtime emploie `page.createPDFStream(PDF_OPTIONS)` et accumule au plus 64 Mio. Un
`Content-Length` n'existe pas pour ce flux : le compteur porte sur les chunks réellement reçus.
Au-delà, le flux est annulé, le contexte détruit et `pdf-limit-exceeded` renvoyé.

Les octets bruts sont transférés au worker. `canonicalizePdf()` s'exécute dans le worker tuable et
sa sortie est contrôlée une seconde fois avant transfert à l'appelant. Le chemin direct peut garder
`page.pdf()` au début de l'incrément, mais converge vers le même helper borné avant clôture E8.

### D12 — Le manifeste d'images est exact et versionné

Deux formes seulement :

```ts
type ProtectedImageAsset =
  | {
      readonly source: string;
      readonly kind: 'bytes';
      readonly mediaType: 'image/png' | 'image/jpeg' | 'image/webp';
      readonly bytes: Uint8Array;
      readonly sha256: string;
    }
  | {
      readonly source: string;
      readonly kind: 'https';
      readonly mediaType: 'image/png' | 'image/jpeg' | 'image/webp';
      readonly sha256: string;
    };
```

`source` est le nom exact choisi par l'hôte : URL ou clé d'actif, sans convention Openview. Les URI
`data:image/...;base64,` restent autonomes et n'ont pas besoin d'entrée, mais subissent les mêmes
bornes, sniff MIME et contrôle de pixels.

Deux entrées pour une source, une empreinte invalide ou une source atteinte mais absente sont
refusées. Une entrée inutilisée est permise : un runtime peut servir plusieurs modèles, et une
branche non atteinte ne doit ni charger ni refuser son image. Le test exige qu'une entrée inutilisée
ne provoque aucune résolution, aucun octet retenu et aucun événement de ressource.

### D13 — L'intégrité précède l'incorporation

Le courtier :

1. borne la source textuelle avant parsing ;
2. trouve une entrée exacte ;
3. obtient les octets sous limite ;
4. vérifie le SHA-256 en temps constant sur une forme canonique ;
5. vérifie signature binaire et MIME déclaré ;
6. lit les dimensions PNG, JPEG ou WebP avec un parseur borné ;
7. vérifie pixels individuels et cumulés ;
8. renvoie les octets au worker par transfert ;
9. le worker produit une URI `data:` et l'associe à la clé de l'occurrence atteinte ;
10. les constructeurs HTML lisent cette table au lieu de la source stockée.

Une empreinte absente n'est pas calculée et acceptée : elle rend la configuration invalide. Une
empreinte fausse produit `resource-integrity-failed` sans répéter ni source ni empreinte.

### D14 — La défense SSRF se fait à la connexion, pas au texte du hostname

Pour une entrée `https` :

- protocole HTTPS, credentials absents, port explicite ou 443 ;
- URL normalisée égale à la source enregistrée ;
- résolution A et AAAA sous délai ;
- rejet si une réponse désigne loopback, link-local, privé, multicast, non spécifié, documentation,
  benchmark ou IPv4 mappée interdite ;
- adresses restantes triées, puis connexion via un `lookup` qui renvoie l'adresse déjà validée ;
- SNI, certificat et en-tête `Host` gardent le hostname original ;
- `Accept-Encoding: identity`, aucun cookie, authorization, proxy d'environnement ou header du
  modèle ;
- chaque redirection repasse manifeste, DNS et budget ;
- longueur annoncée vérifiée, puis longueur réelle vérifiée chunk par chunk ;
- timeout actif via `AbortSignal`, pas seulement un événement socket sans destruction.

Le test DNS rebinding donne d'abord une adresse publique puis `127.0.0.1` ; aucune branche ne doit
atteindre le serveur local. Chromium ne voit jamais l'URL, même autorisée.

### D15 — Les polices restent le catalogue E6

Une famille de police du modèle est un nom libre résolu contre les douze faces incorporées du build.
E8 ne remplace pas ce catalogue par la machine et ne télécharge aucune fonte. La politique réseau
des fontes est donc l'ensemble vide, ce qui est une liste blanche complète et déterministe.

Ajouter une fonte distante demanderait une autre décision : source, intégrité, quatre faces,
couverture `cmap`, licence, NOTICE, profil E6 et comportement hors ligne. L'implémenter ici ferait
passer E8 de durcissement à système de distribution de fontes et invaliderait le poids L.

### D16 — La résolution appartient à la session PDF, pas au modèle

`DocumentImage` gagne la clé opaque de l'occurrence. `PdfRenderSession` gagne une opération
`resolveImages(images)` qui renvoie une liste fermée de `{ key, src }`, où `src` est imprimable par
le backend. Le moteur vérifie absence de clé manquante, dupliquée ou étrangère, puis passe la table
aux constructeurs HTML.

`PdfRenderStrategy.open()` reçoit les images déjà atteintes par la première matérialisation. Le
backend les résout **avant** de lancer un navigateur dans le chemin direct, ou avant d'ouvrir un
contexte dans le runtime. Quand `extendBands()` rend de nouvelles images atteignables, le moteur
appelle `resolveImages()` sur le delta avant de reconstruire ses probes.

Ce changement pré-1.0 du port interne est préférable à deux variantes fausses : parcourir toutes
les branches chargerait des images inatteignables et pourrait refuser un modèle valide ; remplacer
une URL dans l'HTML sérialisé ferait de la sécurité une opération de texte fragile.

### D17 — Le protocole worker ne sérialise jamais une erreur brute

Le worker répond par une union fermée : succès PDF, succès pagination, refus connu, panne inconnue.
Un `DocumentRenderError` devient `{ code, message, details }` après projection sur les champs sûrs.
Une erreur inconnue devient `render-worker-failed` avec une phrase constante. `stack`, `cause`, nom
de fichier, HTML, source d'image et données ne traversent pas le port.

Le parent reconstruit une nouvelle `DocumentRenderError`. Le chemin direct garde sa `cause` locale ;
la perte est volontaire à la frontière hostile.

### D18 — L'audit emploie `diagnostics_channel`, pas un port de logging

AGENTS.md refuse un port de logging. Le runtime publie donc sur un canal Node stable, par exemple
`openview.render.audit`, avec un type exporté mais sans logger, callback ou dépendance :

```ts
interface ProtectedRenderAuditEvent {
  readonly renderId: string;
  readonly outcome: 'succeeded' | 'refused' | 'timed-out' | 'cancelled' | 'failed';
  readonly phase: ProtectedRenderPhase;
  readonly code: DocumentRenderErrorCode | undefined;
  readonly queueMs: number;
  readonly renderMs: number;
}
```

`renderId` vient d'un compteur local, pas d'un UUID. Les durées sont permises dans l'adaptateur et
n'entrent jamais dans le document. Le corpus s'abonne et exige exactement un événement terminal par
appel. S3 branchera ce canal sur son journal et ajoutera son propre identifiant HTTP.

### D19 — Les erreurs gagnent des codes, pas des messages dynamiques

Codes nouveaux proposés :

- `materialization-limit-exceeded` ;
- `page-limit-exceeded` ;
- `html-limit-exceeded` ;
- `pdf-limit-exceeded` ;
- `resource-policy-refused` ;
- `resource-load-failed` ;
- `resource-integrity-failed` ;
- `render-capacity-exceeded` ;
- `render-timeout` ;
- `render-cancelled` ;
- `render-memory-limit-exceeded` ;
- `render-worker-failed` ;
- `runtime-closed`.

`DocumentRenderErrorDetails` gagne des discriminants fermés `phase` et `resourceKind`, plus
`observed` seulement pour un nombre technique sûr (octets, pixels, pages). Aucun code ne porte URL,
nom de famille de police, texte, donnée, HTML, PID ou cause.

### D20 — Le runtime fermé a une sémantique unique

`close()` est idempotent :

- il refuse immédiatement toute nouvelle admission ;
- il annule les tâches en file avec `runtime-closed` ;
- il laisse les tâches actives finir sous leur délai déjà posé ;
- il ferme workers et navigateurs avec `await` ;
- il ne résout qu'après disparition de tous les handles possédés.

Il n'existe pas de `close({ force: true })` concurrent : l'appelant possède déjà `AbortSignal` pour
annuler une tâche et le runtime possède ses deadlines.

### D21 — Le chemin durci doit rester identique au chemin direct

Avec images incorporées, mêmes options et même profil E6 :

- pagination directe et pagination durcie rendent le même certificat et le même HTML ;
- PDF direct et PDF durci rendent exactement les mêmes octets canoniques ;
- deux ordres de concurrence rendent les mêmes octets ;
- un recyclage de worker ou de navigateur ne change rien ;
- une ressource HTTPS qui passe l'empreinte rend le même PDF que ses octets fournis avec
  `kind: 'bytes'`.

Le corpus E7 est l'oracle de cette décision. E8 n'accepte aucune divergence sous prétexte que le
chemin d'exécution a changé.

---

## 5. Contrats publics et internes

### 5.1 Limites moteur

```ts
interface RenderSafetyLimits {
  readonly maxMaterializedUnits: number;
  readonly maxPages: number;
  readonly maxHtmlBytes: number;
}

interface RenderEngineOptions {
  readonly shapeLimits?: Partial<ShapeLimits> | undefined;
  readonly evaluationLimits?: Partial<EvaluationLimits> | undefined;
  readonly safetyLimits?: Partial<RenderSafetyLimits> | undefined;
  readonly presentationSelection?: PresentationSelection | undefined;
}
```

`resolveRenderSafetyLimits()` valide avec Zod 4 et renvoie un objet complet. Le budget est créé une
fois dans `prepare()` et voyage dans `MaterializedDocument` puis `PaginationOptions`.

### 5.2 Résolution d'images par session

```ts
interface DocumentImage {
  readonly key: string;
  readonly nodeId: string;
  readonly path: readonly (string | number)[];
  readonly src: string;
}

interface ResolvedDocumentImage {
  readonly key: string;
  readonly src: string;
}

interface PdfRenderSession {
  resolveImages(images: readonly DocumentImage[]): Promise<readonly ResolvedDocumentImage[]>;
  measure(document: PdfSourceDocument): Promise<PdfLayoutMeasurement>;
  print(document: PdfSourceDocument): Promise<Uint8Array>;
  close(): Promise<void>;
}
```

`PdfSourceDocument` ne porte que les images résolues employées dans son HTML. Une stratégie factice
de test implémente l'identité seulement pour les URI `data:` ; elle ne reçoit aucun passe-droit
générique pour HTTP.

### 5.3 Runtime Puppeteer

```ts
interface ProtectedRenderCallOptions {
  readonly signal?: AbortSignal | undefined;
}

interface ProtectedPdfRenderPort extends RenderPort {
  render(
    request: RenderRequest,
    options?: ProtectedRenderCallOptions | undefined,
  ): Promise<RenderResult>;
}

interface PuppeteerRenderRuntime {
  readonly pdf: ProtectedPdfRenderPort;
  readonly pagination: ProtectedPaginationPort;
  close(): Promise<void>;
}
```

Le second paramètre optionnel garde l'assignabilité à `RenderPort`. `ProtectedPaginationPort` suit le
même patron. Le factory est asynchrone parce qu'un runtime qui ne peut pas lancer et pinger ses slots
doit échouer à la création, pas au premier client.

### 5.4 Protocole de slot

Messages parent → worker : `render`, `paginate`, `resource-result`, `session-opened`, `measured`,
`printed`, `closed`, `shutdown`. Messages worker → parent : `ready`, `resolve-resources`,
`open-session`, `measure`, `print`, `close-session`, `result`, `refusal`, `fault`.

Chaque message porte `formatVersion`, `generation`, `renderId` et un compteur `sequence`. Le parent
refuse une réponse d'une génération précédente ou une séquence inattendue, détruit le slot et rend
`render-worker-failed`. Un message tardif après timeout ne peut donc terminer la promesse suivante.

### 5.5 Configuration validée

Trois schémas séparés :

- `RenderSafetyLimitsSchema` dans `engine` ;
- `PuppeteerProtectionLimitsSchema` et `ProtectedImageManifestSchema` dans l'adaptateur ;
- `WorkerMessageSchema` à la frontière de chaque thread.

Les interfaces écrites à la main portent `?: T | undefined`. Les schemas n'acceptent ni `NaN`, ni
infini, ni zéro, ni clé inconnue. Le manifeste refuse les sources dupliquées au niveau de l'objet
complet, pas après construction d'une `Map` qui en aurait déjà perdu une.

---

## 6. Flux cibles

### 6.1 Rendu réussi

```text
appel
  → admission et snapshot borné
  → slot libre
  → parse/migrate dans le worker
  → matérialisation bornée des occurrences atteintes
  → ouverture RPC et courtier parent
  → table éphémère occurrence → data:
  → contexte/page neufs
  → mesures RPC
  → pagination bornée
  → HTML borné
  → PDF stream borné
  → canonicalisation worker
  → transfert du résultat
  → fermeture du contexte
  → événement succeeded
```

### 6.2 Refus logique

Un refus de forme, expression, matérialisation ou page n'ouvre aucun contexte s'il survient avant la
première mesure. Le worker reste réutilisable après projection sûre de l'erreur. Le parent publie un
événement `refused`, rend l'erreur reconstruite et affecte immédiatement le témoin suivant.

### 6.3 Refus de ressource

Le courtier refuse avant `open-session`. Aucun octet n'est envoyé à Chromium et aucun message ne
répète la source. Les octets déjà reçus d'autres images du même rendu sont relâchés avec la tâche et
ne rejoignent aucun cache global.

### 6.4 Timeout ou mémoire

Le slot devient indisponible, worker et contexte sont détruits, le navigateur est attesté ou
remplacé, puis un nouveau worker répond `ready`. La promesse est rejetée dès que le nettoyage
minimal est engagé, mais le slot ne redevient libre qu'après attestation complète.

### 6.5 Crash Chromium

L'événement Puppeteer `disconnected` marque le navigateur mort. La tâche courante reçoit
`layout-measurement-failed` ou `pdf-export-failed` selon la phase, le worker est remplacé parce que
son RPC en cours n'est plus prouvable, et le navigateur est relancé. Les autres slots continuent.

---

## 7. Carte des fichiers

### 7.1 `@openview/engine`

| Fichier | Action |
| :--- | :--- |
| `src/limits/types.ts` | `RenderSafetyLimits`, défauts et hard ceilings |
| `src/limits/schemas.ts` | schéma Zod 4 et résolution des overrides |
| `src/limits/materialization.ts` | budget partagé et refus attribué |
| `src/document/materialize.ts` | réservation avant chaque allocation persistante |
| `src/document/images.ts` | clé d'occurrence et distinction source/résolution |
| `src/pagination/types.ts` | limite de pages résolue |
| `src/pagination/paginate.ts` | refus avant la page excédentaire |
| `src/html/build.ts`, `src/html/build-page.ts` | lire la table des sources résolues |
| `src/html/serialize.ts` | écrivain UTF-8 borné, sortie identique sous plafond |
| `src/pipeline/compose.ts` | propagation des budgets sur probes et settle |
| `src/strategy/pdf.ts` | `safetyLimits`, images résolues et opération de session |
| `src/errors.ts` | codes, phases et détails sûrs |
| `src/index.ts` | exports publics minimaux |
| `src/**/__tests__/` | frontières, expansion, pages, HTML, propagation |
| `package.json` | dépendance directe Zod, sous M-1 |

### 7.2 `@openview/adapter-puppeteer`

| Fichier | Action |
| :--- | :--- |
| `src/session.ts` | séparer navigateur possédé et session de contexte |
| `src/browser.ts` | lancement, fermeture, kill et détection de déconnexion |
| `src/pdf-stream.ts` | lecture bornée de `createPDFStream` |
| `src/resource/types.ts` | manifeste et limites |
| `src/resource/schemas.ts` | validation Zod 4 |
| `src/resource/address.ts` | normalisation URL, classification IP, lookup épinglé |
| `src/resource/fetch.ts` | HTTPS, redirections, signal, taille et headers fermés |
| `src/resource/image.ts` | base64, signatures PNG/JPEG/WebP, dimensions et pixels |
| `src/resource/broker.ts` | résolution par rendu, cumul et intégrité |
| `src/runtime/snapshot.ts` | clone simple borné du modèle et des données |
| `src/runtime/protocol.ts` | unions Zod et projections sûres |
| `src/runtime/worker.ts` | parse, transformation éphémère, engine et proxy PDF |
| `src/runtime/slot.ts` | worker + navigateur + génération + reprise |
| `src/runtime/pool.ts` | file, admission, timers, annulation, fermeture |
| `src/runtime/audit.ts` | canal `diagnostics_channel` et type fermé |
| `src/runtime/runtime.ts` | factory et façades publiques |
| `src/index.ts` | exports E8 |
| `src/**/__tests__/` | ressources, protocole, pool, Chromium et reprise |
| `package.json` | dépendance directe Zod, sous M-1 |

### 7.3 Corpus, outils et documentation

| Fichier | Action |
| :--- | :--- |
| `tests/hostile/e8/corpus.mjs` | registre fermé des attaques et témoins |
| `tests/hostile/e8/fixtures/` | images minimales, réponses HTTPS et worker de test bloqué |
| `tools/hostile/run.mjs` | exécution, reprise, rapport JSON sûr |
| `tools/performance/e8.mjs` | protocole 60/60 000 et métriques profilées |
| `.github/workflows/ci.yml` | job bloquant E8, sous M-2 |
| `docs/adr/0021-le-moteur-survit-a-un-document-hostile.md` | décision et mesures d'exécution |
| `docs/roadmap/engine.md` | statut, limites exactes et réserve mémoire |
| `docs/roadmap/service-de-rendu.md` | S1 doit employer le runtime durci ; S2 garde l'usage hostile |
| `docs/qa/README.md` | mesure réelle du KPI, sans la réécrire avant résultat |

### 7.4 Fichiers qui ne changent pas

- `packages/core/src/ports/render.ts` et `RenderRequest.data` ;
- tout schéma AST, migration et `CURRENT_SCHEMA_VERSION` ;
- le catalogue de fontes incorporées E6 ;
- le corpus ou les PDF de référence E7, hors exécution normale de vérification ;
- `biome.jsonc`, `tsconfig*`, `turbo.json`, Sonar et les plugins de lint ;
- `apps/playground`, qui reste un pont local et n'est pas le service J5.

---

## 8. Plan de tests

### P1 — Configuration

Défauts exacts, overrides partiels, bornes inclusives, zéro, négatif, fraction, `NaN`, infini, clé
inconnue, hard ceiling, source dupliquée, SHA invalide et MIME inconnu. Un défaut invalide échoue à
la création du port ou du runtime avant tout worker ou navigateur.

### P2 — Budget matérialisé

Chaque famille d'objet consomme une unité. Exactement 250 000 passe ; la suivante refuse. Une boucle
statique sans binding atteint la borne. `extendBands` reprend le même budget. Une mutation qui oublie
run, cellule, grid item ou groupe est tuée.

### P3 — Pages

Document vide, une page, exactement 100, 101, bandes qui retirent toute hauteur et settle répété.
Le refus arrive avant `fillFlow` de la page 101 et porte `limit: 100`, sans HTML final.

### P4 — HTML

ASCII, accents, emoji, texte échappé, CSS de fontes et limite coupant au milieu d'un fragment. Sous
plafond, la sortie est identique à l'ancien sérialiseur. Au-dessus, aucune chaîne excédentaire n'est
rendue à la session.

### P5 — PDF stream

Chunks vides, limite exacte, un octet de trop, erreur de stream, annulation, sortie canonicalisée
plus grande que l'entrée et plus grande que le plafond final. Le flux est fermé sur tous les chemins.

### P6 — Images incorporées

PNG, JPEG et WebP minimaux ; base64 invalide ; MIME mensonger ; préfixe avec casse ou espace ; taille
exacte et +1 ; dimensions exactes et +1 ; cumul de 64 images ; en-tête tronqué ; PNG déclarant une
surface immense avec quelques octets. Chromium n'est pas lancé sur un refus du chemin direct et
n'ouvre aucun contexte dans le runtime.

### P7 — Manifeste et intégrité

Source `bytes`, URL HTTPS exacte, clé d'actif libre, source absente, entrée dupliquée, hash faux,
octets substitués, MIME faux et entrée inutilisée. Une branche fausse et une bande non atteinte ne
chargent rien. Deux sources portant le même SHA restent deux autorisations exactes ; le digest seul
n'autorise jamais un nom inattendu.

### P8 — SSRF

`file:`, HTTP, credentials, loopback IPv4/IPv6, link-local, RFC1918, IPv4 mappée, métadonnées cloud,
multicast, documentation, DNS mixte public/privé, rebinding, port non enregistré, redirection vers
privé, boucle de redirections, réponse lente, `Content-Length` mensonger et chunks dépassant la
limite. Un serveur local prouvé joignable reçoit zéro requête.

Le succès HTTPS emploie un transport injecté dans le test unitaire et une autorité locale de fixture ;
la CI ne dépend jamais d'Internet.

### P9 — CSP et navigateur

Après résolution d'une image HTTPS, l'HTML ne contient que `data:`, la CSP reste `img-src data:` et
l'intercepteur continue d'avorter HTTP, HTTPS et `file:`. Supprimer la conversion ou élargir la CSP
fait rougir le test.

### P10 — Snapshot de transport

Objet simple, tableaux, clés arbitraires, chaîne de 60 000 lignes, propriété non énumérable,
accesseur, fonction, symbole, prototype, cycle, partage, profondeur et compte. Aucun getter n'est
appelé. Aucun nom de clé n'est réservé ou interprété.

### P11 — Protocole worker

Chaque discriminant, version, séquence et génération ; message ancien, message doublé, octets
transférés, erreur connue et inconnue, cause contenant un secret, diagnostic sûr. Le secret n'apparaît
ni dans l'erreur parent, ni dans l'audit, ni dans le rapport.

### P12 — Timeout réel

Un worker de fixture entre dans une boucle synchrone et ne répond plus. Le parent termine le worker,
ferme le contexte, recrée la génération et rend le témoin. Le test prouve que le thread a émis
`exit` et que son identifiant n'est pas réutilisé.

### P13 — Mémoire worker

Un worker de fixture franchit un petit `maxOldGenerationSizeMb`. Le runtime rend
`render-memory-limit-exceeded`, ne tombe pas lui-même et exécute le témoin. Un second test montre
qu'un grand `ArrayBuffer` est arrêté par le plafond d'octets, pas attribué mensongèrement au tas V8.

### P14 — Pool et concurrence

0, 1 et N slots configurés ; N tâches actives, N+1 en file, file pleine, ordre FIFO, annulation en
file, annulation active, queue timeout, crash d'un slot pendant que l'autre réussit, recyclage après
100 rendus et création partiellement échouée. À aucun instant un slot ne traite deux rendus.

### P15 — Cycle de vie

Contexte neuf, aucun cookie/cache conservé, page fermée, browser réutilisé au succès, browser remplacé
au crash, fermeture lente, kill de repli, `close()` deux fois, `render()` après close et process sans
handle restant. Toute promesse asynchrone est attendue ou explicitement `void` avec justification.

### P16 — Audit

Un et un seul événement terminal par succès, refus logique, refus ressource, surcharge, timeout,
annulation, OOM et panne inconnue. Les champs exacts sont épinglés. Dataset, template, HTML, URL,
empreinte, PID, stack et cause sont absents par construction et par recherche dans le JSON.

### P17 — Corpus hostile intégré

Registre fermé minimal : profondeur, nœuds, agrégat explosif, boucle statique, pages, HTML, image
encodée, pixel bomb, source absente, hash faux, SSRF, lenteur, worker bloqué, OOM, navigateur crashé,
file pleine. Chaque entrée déclare son code attendu, sa phase et le témoin qui la suit.

### P18 — Déterminisme E6/E7

Les six scénarios passent par les deux façades directes et durcies. HTML, certificats et PDF sont
égaux octet pour octet. Deux slots, ordres inversés, recyclage et même ressource par `bytes`/HTTPS ne
changent rien. Le profil E6 accompagne le rapport.

### P19 — Charge 60/60 000

Le scénario du §0.3 vérifie pages, calcul, PDF, HTML, unités, pas, mémoire et temps. Cinq chauffes,
vingt mesures, p50/p95/max, aucune valeur aléatoire. Le rapport porte profil, limites, versions,
compteurs et RSS agrégé des processus, jamais la donnée synthétique.

### P20 — Absence de fuite après répétition

Cinquante rendus chauds puis drainage. Le nombre de workers, navigateurs, contextes et pages revient
à la baseline. La mémoire ne croît pas monotoniquement au-delà de la marge consignée par INC-0. Le
test ne dépend pas d'un instant précis de GC : il observe hautes eaux et état après recyclage forcé.

---

## 9. Matrice de mutations obligatoire

| Mutation | Test tueur |
| :--- | :--- |
| oublier de compter un run dans les unités | P2 |
| contrôler la page après `fillFlow` | P3 |
| compter l'HTML en UTF-16 | P4 avec emoji |
| contrôler seulement le PDF canonique | P5 brut trop grand |
| croire `Content-Length` sans compter les chunks | P8 |
| ne contrôler que la taille base64, pas les pixels | P6 pixel bomb |
| accepter le MIME déclaré sans signature | P6/P7 |
| autoriser une origine plutôt qu'une source exacte | P7 |
| omettre le SHA-256 | P7/P18 |
| valider DNS puis laisser `https.request` résoudre à nouveau | P8 rebinding |
| ne revalider que la première URL | P8 redirection privée |
| remettre l'URL autorisée à Chromium | P9 |
| remplacer `worker.terminate()` par un rejet | P12 |
| rendre au pool un worker timeouté | P12 témoin |
| attribuer un OOM externe à `resourceLimits` | P13 |
| ouvrir un browser par appel | P14/P19 |
| partager un contexte entre deux rendus | P15 |
| laisser la file grandir | P14 |
| accepter un message d'une ancienne génération | P11 |
| sérialiser `cause` ou `stack` | P11/P16 |
| publier deux événements terminaux | P16 |
| garder un cache d'images entre rendus | P15/P18 |
| lire `os.availableParallelism()` pour choisir le défaut | test structurel de configuration |
| changer un octet E7 sur le chemin durci | P18 |

Toutes ces mutations doivent être jouées manuellement au moins une fois et leur verdict consigné
dans l'ADR 0021. La couverture ≥ 90 % ne remplace pas cette matrice.

---

## 10. Incréments d'exécution

### INC-0 — Corpus et calibration avant production

- figer les scénarios 60/60 000 et hostiles sans code de production neuf ;
- mesurer chemin direct froid/chaud, HTML, PDF, unités estimées, pas, RSS et processus ;
- confirmer ou ajuster les défauts du §2.2 selon la règle écrite ;
- consigner le protocole et la baseline dans le brouillon ADR 0021.

**Sortie :** chaque plafond a un scénario sain sous lui et une attaque au-dessus ; aucune valeur
n'est choisie uniquement parce qu'elle est ronde.

### INC-1 — Bornes logiques du moteur

- schémas et types de limites ;
- budget de matérialisation ;
- plafond de pages ;
- sérialiseur HTML borné ;
- codes d'erreur et tests P1 à P4.

**Sortie :** `engine` refuse expansion, page et HTML sans navigateur ; portes ordinaires vertes.

### INC-2 — Ressources et PDF bornés

- parseurs d'images et manifeste ;
- courtier HTTPS, intégrité, DNS épinglé et redirections ;
- transformation éphémère des sources ;
- flux PDF borné ;
- tests P5 à P9.

**Sortie :** aucune URL du modèle n'atteint Chromium ; images distantes exactes et incorporées
produisent le même document que leurs octets locaux.

### INC-3 — Primitive navigateur réutilisable

- séparer lancement de browser et ouverture de contexte ;
- conserver le chemin direct browser-par-rendu ;
- ajouter déconnexion, fermeture bornée et kill de repli ;
- prouver contexte neuf et absence de dérive E7.

**Sortie :** un navigateur sert plusieurs rendus séquentiels sans partager leur contexte.

### INC-4 — Worker, protocole et slot

- snapshot borné ;
- schémas RPC ;
- proxy de session ;
- transferts d'octets ;
- timeout, OOM, génération, remplacement et audit ;
- tests P10 à P13 et P16.

**Sortie :** worker réellement bloqué et worker OOM sont remplacés, puis le témoin passe.

### INC-5 — Pool public et cycle de vie

- file bornée, `AsyncResource`, annulation et délais ;
- `PuppeteerRenderRuntime`, ports PDF/pagination et `close()` ;
- recyclage et reprise multi-slot ;
- tests P14 et P15.

**Sortie :** N slots exécutent N rendus, refusent proprement la surcharge et disparaissent tous à la
fermeture.

### INC-6 — Preuve intégrée et CI

- corpus hostile complet ;
- chemin durci E7 ;
- scénario 60/60 000 ;
- rapport sûr ;
- job CI sous M-2 ;
- tests P17 à P20.

**Sortie :** reprise après chaque attaque, p95 mesuré, aucune divergence E7, rapport publiable.

### INC-7 — Ablations, ADR et fermeture

- jouer les 24 mutations ;
- écrire ADR 0021 avec chiffres et réserves ;
- mettre à jour roadmaps et QA ;
- vérifier les tarballs et la documentation publique ;
- exécuter toutes les portes.

**Sortie :** aucune limite implicite, aucun mandat ouvert, aucun énoncé de mémoire plus fort que la
preuve.

---

## 11. Ordonnancement et commits logiques

1. `test(e8): freeze hostile and volume scenarios`
2. `feat(engine): bound materialization pagination and html`
3. `feat(adapter): validate and embed protected images`
4. `feat(adapter): bound pdf streaming and browser contexts`
5. `feat(adapter): isolate renders in replaceable workers`
6. `feat(adapter): add the bounded puppeteer runtime`
7. `test(e8): prove recovery determinism and volume`
8. `ci(e8): gate hostile rendering on the official profile`
9. `docs(e8): record limits measurements and residual risks`

INC-1 et INC-2 peuvent être revus séparément. INC-4 et INC-5 ne sont pas publiables séparément : un
worker sans pool public n'a pas de consommateur, et un pool sans remplacement prouvé donne une fausse
garantie. Le premier état publiable du runtime est la fin d'INC-5.

---

## 12. Portes de validation

Les quatre portes ordinaires restent obligatoires, dans l'ordre :

```bash
pnpm run lint && pnpm run build && pnpm run type-check && pnpm run test:coverage
```

Puis les portes E8 :

```bash
node tools/hostile/run.mjs --profile official
node tools/performance/e8.mjs --profile official
node tools/golden/compare.mjs
```

La dernière commande emploie l'interface exacte du harnais E7 au moment de l'exécution ; si son CLI
exige un candidat, le job E8 réutilise son module de comparaison au lieu d'inventer une commande
concurrente.

Vérifications structurelles supplémentaires :

- aucun import `worker_threads`, `diagnostics_channel`, `dns`, `http`, `https`, `net`, `crypto` ou
  Puppeteer dans `core` ;
- aucun import Puppeteer dans `engine` ;
- aucune occurrence de `console.`, logger maison ou callback `onLog` dans le runtime ;
- aucune CSP élargie à `https:` ;
- aucune URL, `src`, `data`, `template`, `html`, `cause` ou `stack` dans le schéma d'audit ;
- aucun champ neuf dans les schemas AST ou `RenderRequest` ;
- aucun `Date`, `Math.random`, `process.env`, `performance.*`, `globalThis.*` ou `toLocale*` neuf
  dans `core`/`engine` ;
- tarball `engine` sans Puppeteer et tarball adaptateur contenant le worker compilé ;
- `git diff` ne touche aucun fichier protégé hors mandats M-1/M-2.

### 12.1 Mesures à consigner dans l'ADR 0021

- profil E6 complet ;
- versions Node, V8, ICU, Puppeteer et Chromium ;
- limites finales et justification de chaque différence au §2.2 ;
- temps froid, temps de création du runtime, attente de file, p50/p95/max chaud ;
- pages, unités matérialisées, pas d'expression, octets HTML/PDF/images ;
- hautes eaux du parent, worker et arbre Chromium ;
- temps de terminaison et de remplacement d'un worker bloqué ;
- temps de reprise du témoin ;
- nombre de processus/handles avant et après cinquante rendus ;
- résultat des 24 mutations ;
- identité E7 directe/durcie ;
- limites que Node `resourceLimits` ne couvre pas ;
- décision sur le KPI de 2,0 s s'il est contredit.

---

## 13. Risques et signaux de réouverture

### Le tas V8 n'est pas la mémoire du rendu entier

**Risque :** `resourceLimits` ne couvre ni `ArrayBuffer` ni Chromium.  
**Réponse :** plafonds logiques et d'octets, transfert d'ownership, un browser par slot, mesure de
l'arbre, réserve explicite pour le conteneur S2.  
**Signal :** OOM du processus sous les limites E8 ; il impose isolation processus/cgroup, pas un
relèvement silencieux.

### Le snapshot ajoute une copie de l'entrée

**Risque :** la protection du parent consomme mémoire et temps.  
**Réponse :** copie bornée avant file, valeurs JSON seulement en runtime durci, p95 incluant la copie.  
**Signal :** la copie dépasse 20 % du KPI sur 60 000 lignes ; mesurer alors un transfert JSON borné
ou un processus d'admission, sans schéma métier.

### Un browser partagé par slot garde un état de processus

**Risque :** fuite Chromium ou crash après plusieurs contextes.  
**Réponse :** contexte neuf, compteur de recyclage, test de 50 rendus, remplacement à toute
incertitude.  
**Signal :** croissance monotone ou divergence E7 selon le rang ; abaisser `maxRendersPerWorker` et
recycler le navigateur au même rythme.

### Le DNS public n'est pas une preuve d'innocuité du serveur

**Risque :** un hôte public sert un contenu énorme, lent ou faux.  
**Réponse :** manifeste exact, hash, MIME, délais et tailles ; aucun secret ni header host transmis.  
**Signal :** besoin d'un CDN authentifié ; il exige un courtier de l'hôte en amont, pas des credentials
dans le modèle.

### Les images SVG restent refusées

**Risque :** demande produit fréquente.  
**Réponse :** SVG est un langage actif et n'entre pas par simple ajout MIME.  
**Signal :** besoin réel ; nouvelle ADR de rasterisation sûre avant Chromium.

### La cible de 2,0 s peut être fausse

**Risque :** la QA a fixé un chiffre avant E8 et le rendu actuel lance douze sessions en 27,1 s sur
la sonde locale E7. Le pool change fortement le coût mais ne prouve pas encore 60 pages.  
**Réponse :** protocole chaud officiel, chiffre remis sans maquillage.  
**Signal :** p95 > 2,0 s ; le propriétaire choisit optimisation, machine plus forte ou KPI corrigé.

### Une police distante rouvrirait E6

**Risque :** confondre le nom libre de famille avec une permission de réseau.  
**Réponse :** catalogue fermé et incorporé.  
**Signal :** mandat produit avec licence, quatre faces et empreintes ; nouvelle ADR.

### S2 reste nécessaire

E8 borne un **document**. Il ne borne pas le nombre d'appels par client, la taille du corps avant
parsing HTTP, l'authentification, le quota, le coût cumulé ou le déploiement. Publier S1 avec E8 mais
sans S2 reste une erreur ; les deux roadmaps doivent le dire.

---

## 14. Définition de terminé

E8 est livré lorsque toutes les affirmations suivantes sont vraies :

- [ ] M-1, M-2 et M-3 sont tranchés ;
- [ ] limites moteur actives et validées ;
- [ ] 250 000 unités passent, 250 001 refusent avant allocation excédentaire ;
- [ ] 100 pages passent, 101 refusent avant composition de la page excédentaire ;
- [ ] HTML et PDF sont bornés en octets réels ;
- [ ] image 400 Mo simulée et pixel bomb sont refusées avant Chromium ;
- [ ] aucune URL, même autorisée, n'atteint Chromium ;
- [ ] DNS rebinding, redirection privée et métadonnées cloud atteignent zéro serveur ;
- [ ] worker synchrone bloqué est terminé et remplacé ;
- [ ] OOM worker ne fait pas tomber le runtime ;
- [ ] N slots n'exécutent jamais plus de N rendus ;
- [ ] file pleine, attente et annulation ont des refus typés ;
- [ ] contexte neuf et nettoyage complet sur tous les chemins ;
- [ ] un témoin passe après chacune des attaques du registre ;
- [ ] un événement terminal sûr existe pour chaque appel ;
- [ ] aucun modèle, jeu de données, HTML, URL, stack ou cause n'apparaît dans les rapports ;
- [ ] chemin direct et runtime durci sont identiques sur E7 ;
- [ ] scénario 60 pages / 60 000 lignes mesuré selon §0.3 ;
- [ ] cinquante rendus ne laissent ni handle ni croissance non expliquée ;
- [ ] 24 mutations jouées et tuées ;
- [ ] quatre portes, corpus hostile, performance et golden verts ;
- [ ] tarballs inspectés ;
- [ ] ADR 0021 acceptée et roadmaps mises à jour ;
- [ ] réserves mémoire/processus et nécessité de S2 documentées sans ambiguïté.

---

## 15. Contrôle avant démarrage

Avant INC-0 :

1. confirmer que le corpus E7 officiel est amorcé ou prévoir la comparaison candidat-à-candidat
   sans bénir de référence locale ;
2. relire les modifications concurrentes de `docs/qa/README.md` et ne pas écraser leur KPI ;
3. vérifier qu'aucune branche concurrente ne refactore `session.ts`, `materialize.ts`,
   `paginate.ts` ou `serialize.ts` ;
4. obtenir M-1 avant tout changement de manifeste ;
5. obtenir M-2 avant tout changement de workflow ;
6. obtenir M-3 avant d'ouvrir le premier succès HTTPS ;
7. réserver le prochain numéro d'ADR au moment de l'exécution ; si 0021 est pris, renuméroter le
   plan et les liens, sans créer deux décisions concurrentes ;
8. refaire la sonde officielle après toute montée de Node, Puppeteer, Chromium, `pdf-lib` ou Zod ;
9. ne jamais employer un PDF ou une mesure Windows comme référence officielle ;
10. arrêter le lot si une limite saine exige d'élargir un schéma stocké : ce serait un nouveau
    besoin produit, pas une correction E8.
