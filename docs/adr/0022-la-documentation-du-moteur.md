# ADR 0022 — La documentation du moteur

- **Statut :** 🟢 **Accepté** (2026-08-29) — les seize pages sont écrites, la porte documentaire est
  verte dans la suite de tests, et la répétition à froid a produit un PDF depuis un dossier vide
  hors du dépôt (voir [§ La répétition à froid](#la-répétition-à-froid)).
- **Date :** 2026-08-29
- **Impact :** `packages/engine` et `packages/adapter-puppeteer` (deux README chacun),
  `docs/engine/` (deux arbres de langue et le modèle d'exemple), `tools/docs/` (la porte),
  `packages/adapter-puppeteer/src/__tests__/` (l'exemple exécuté et sa suite), plus la correction
  de trois textes que le dépôt avait dépassés.
- **Aucune ligne de production modifiée.** Ni contrat, ni export, ni message d'erreur : **pas
  d'incrément de `schemaVersion`, pas de migration**. Aucun fichier protégé par
  [AGENTS.md §7](../../AGENTS.md) n'est touché — ni `package.json`, ni un `tsconfig`, ni un
  workflow.
- **Aucun mandat, aucune dépendance.** Le mandat prévu par le plan — inscrire `README.fr.md` dans
  le champ `files` — a disparu avec sa raison : `npm pack --dry-run` embarque tout fichier
  `README*`, et les trois tarballs le confirment.
- **Plan d'implémentation :**
  [docs/plans/e9-la-documentation-du-moteur.md](../plans/e9-la-documentation-du-moteur.md)
  — les écarts sont au [§ Ce que l'exécution a corrigé du plan](#ce-que-lexécution-a-corrigé-du-plan).

---

## Contexte

J7 publie les cinq briques d'un seul bloc, et exige que chacune soit installable et utilisable par
un développeur inconnu. Le moteur n'avait aucune documentation d'usage : ni README de paquet, ni
page en anglais, ni exemple installable, ni liste lisible de ce qu'il peut refuser. Une page npm
vide est une brique qu'on n'essaie pas.

E9 tient deux promesses, et pas une de plus : **obtenir un PDF en une dizaine de lignes**, et
**comprendre chaque refus**. Tout le reste — le contrat de modèle, l'éditeur, l'aperçu, le service —
appartient à d'autres lots.

---

## Décisions

### 1. Un guide, deux langues, aucune traduction générée

`README.md` est en anglais parce que c'est la page qu'un inconnu voit sur npm ; `README.fr.md` est
son jumeau écrit, jamais traduit automatiquement. Une traduction générée vieillit sans relecteur, et
ce dépôt n'en a pas de second. Ce qu'une machine vérifie, c'est la **structure** — mêmes fichiers,
même charpente de titres, mêmes blocs de code à l'octet — jamais le sens.

### 2. Aucun extrait n'est écrit dans une page

Chaque bloc `ts` publié est une **région d'un module réel**, compilé par `type-check` et exécuté par
Vitest. La page cite la région ; la porte compare octet pour octet. C'est le seul mécanisme qui
empêche la documentation de vieillir toute seule : un exemple qui ne compile plus casse la suite
avant d'atteindre un lecteur.

Deux modules sont publiés de cette façon : le chemin direct (`example.ts` et `invoice-data.ts`) et
le chemin durci (`protected-example.ts`). Les deux rendent un vrai PDF à travers un vrai Chromium,
le second à travers un worker.

### 3. L'exemple publié n'apprend pas à retirer le bac à sable

`createPuppeteerPdfStrategy()` est appelé nu dans l'extrait. En intégration continue, un Chromium
a besoin de `--no-sandbox` : c'est le **test** qui prête ses arguments à l'exemple, en interceptant
le lancement. Un extrait publié qui montrerait `--no-sandbox` enseignerait à désarmer une
protection dont l'appelant seul peut juger.

### 4. Les faits volatils sont comparés à leur source, jamais recopiés

Les pages portent des commentaires HTML invisibles, identiques dans les deux langues, qui déclarent
ce qu'elles affirment : `docs-region` pour un extrait, `docs-api` pour les exports nommés,
`docs-vocabulary` pour une liste fermée, `docs-defaults` pour une table de valeurs par défaut,
`docs-value` pour un fait isolé. La porte ne devine rien : sans annotation, elle ne compare rien.

Les trois tables de défauts sont comparées **dans les deux sens** — mêmes clés, mêmes valeurs. Les
31 codes de refus, les 10 phases, les 5 issues d'audit et les 13 champs du profil de
reproductibilité sont comparés à leurs tableaux sources, **dans l'ordre source**.

### 5. La porte vit dans la suite de tests

Un contrôle qui n'appartient à aucune des quatre portes n'est pas un contrôle. `tools/docs/check.mjs`
est joué par Vitest, donc par `pnpm run test:coverage` en local et par `build-and-test` en CI, sans
qu'un fichier de workflow soit ouvert. Ses règles sont **pures** : rien n'est lu sur disque, tout
arrive par l'entrée — c'est ce qui permet de lui soumettre une page fautive et de vérifier qu'elle
mord.

### 6. Huit fautes, une par règle

Sans elles, une porte qui ne trouve jamais rien passerait pour verte pendant des mois. Huit
fixtures en mémoire — une page manquante, un titre en trop, un bloc modifié d'un seul côté, un
extrait qui a dérivé de sa région, une ligne trop longue, un lien mort, un export inventé, une
valeur par défaut fausse — sont chacune refusées par la règle attendue **et par elle seule**.

### 7. Les réserves sont recopiées sans être adoucies

La page des documents non fiables dit ce que dit l'[ADR 0021](0021-le-moteur-survit-a-un-document-hostile.md) :
la mémoire du processus n'est pas bornée, le corpus hostile outillé et son job CI ne sont pas
livrés, la mesure de charge n'a pas été jouée, aucune socket TLS n'est ouverte dans ce dépôt. Une
page de sécurité qui promet plus que son ADR est pire qu'une page absente.

### 8. E9 corrige d'abord les textes que le dépôt a dépassés

L'ADR 0020, la roadmap moteur et le mode d'emploi du lot figé annonçaient six PDF de référence
« en attente d'amorçage » alors qu'ils sont committés et que le job `Frozen Documents (E7)` les
rejoue vert à chaque run. La correction est factuelle et n'ouvre aucune décision d'E7.

---

## Mesures exécutées

### Volume

| Fichier | Anglais | Français | Plafond |
| :--- | ---: | ---: | ---: |
| `README` de `engine` | 82 | 82 | 120 |
| `README` de `adapter-puppeteer` | 57 | 57 | 80 |
| `00-contents` | 21 | 21 | 40 |
| `01-first-pdf` | 129 | 130 | 150 |
| `02-template-and-data` | 68 | 72 | 150 |
| `03-when-it-fails` | 126 | 127 | 220 |
| `04-untrusted-documents` | 142 | 148 | 150 |
| `05-guarantees-and-limits` | 75 | 78 | 120 |
| **Total** | **700** | **715** | **1 030** |

Les plafonds sont des maxima, pas des cibles : le guide tient à 68 % du budget.

### Surface publique citée

Dix-neuf symboles, et c'est la surface que le projet s'engage à ne pas casser sans le dire :
`parseTemplate`, `CURRENT_SCHEMA_VERSION`, `TemplateShapeError`, `TemplateMigrationError`,
`collectTemplateDataPaths`, `RenderRequest`, `diagnosticsOf` (`core`) ; `createPdfRenderPort`,
`createPaginationPort`, `PresentationSelection`, `DocumentRenderError`,
`DocumentRenderErrorDetails`, `InvalidRenderSafetyLimitsError` (`engine`) ;
`createPuppeteerPdfStrategy`, `createPuppeteerRenderRuntime`, `PuppeteerRenderRuntimeOptions`,
`ProtectedImageManifest`, `RENDER_AUDIT_CHANNEL`, `InvalidProtectedConfigurationError`
(`adapter-puppeteer`).

### Emballage

`npm pack --dry-run` sur `packages/engine`, avec `files: ["dist", "!dist/**/__tests__/**",
"LICENSE", "NOTICE"]`, embarque **`README.md` et `README.fr.md`** : aucun `package.json` n'a été
ouvert. Les trois tarballs produits par `pnpm pack` portent des dépendances installables —
`@openview/core: 0.1.0`, `@openview/engine: 0.1.0` — et non le protocole `workspace:`.
`node tools/packaging/surface.mjs` reste vert : les modules d'exemple, sous `src/__tests__/`, ne
partent pas dans le tarball.

**`@openview/core` n'a pas de README, et son tarball le montre :** sa page npm sera vide à la
publication. C'est le risque §12 du plan, désormais constaté plutôt que redouté.

### Coût de la suite

Les deux rendus Chromium de `documentation.test.ts` ajoutent environ **2,1 s** à la suite sur la
machine de développement (Windows, machine chargée) : 4,2 s pour le fichier complet, dont 2,3 s de
tests. Aucun job CI n'a été ajouté.

### Portes

`pnpm run lint && pnpm run build && pnpm run type-check && pnpm run test:coverage` : vertes.
Couverture globale **98,05 %** des instructions, seuil inchangé à 90 %.

---

## La répétition à froid

Protocole joué le 2026-08-29, hors du dépôt, dans un dossier vide.

1. `pnpm pack` des trois paquets, puis `npm init -y`, `npm pkg set type=module`, installation des
   trois `.tgz`, puis de `typescript` et `@types/node` — **9 s**, aucun accès au registre pour les
   paquets Openview, `@openview/core@0.1.0` et `@openview/engine@0.1.0` étant satisfaits par les
   tarballs installés à côté ;
2. les trois fichiers de la page 01 créés **en recopiant les blocs de la page**, et le modèle
   d'exemple téléchargé par le lien qu'elle donne ;
3. `npx tsc example.ts invoice-data.ts --target ES2022 --module NodeNext --moduleResolution NodeNext`
   — sortie vide, code 0 ;
4. `node example.js` — **5,3 s**, `invoice.pdf`, 22 527 octets, en-tête `%PDF-1.7`, **une page**.

**Aucun fichier de `packages/` n'a été ouvert**, et l'unique substitution prépublication est celle
que le plan prévoyait : les `.tgz` à la place de `npm install @openview/…`, le registre étant vide
avant J7.

**Réserve, et elle compte :** la répétition a été jouée par la personne qui a écrit les pages, faute
d'un second lecteur disponible. Elle prouve que le chemin est **exécutable** ; elle ne prouve pas
qu'il est **compréhensible** par quelqu'un qui ne sait pas déjà. C'est la question 2 du §14 du plan,
et elle reste ouverte.

---

## Ce que l'exécution a corrigé du plan

### Les régions sont référencées par nom de fichier

Le plan écrivait `docs-region: packages/adapter-puppeteer/src/__tests__/documentation/example.ts#first-pdf`.
Cette annotation fait 105 colonnes et viole la largeur de 100 que le même plan impose. Les régions
sont donc nommées `example.ts#first-pdf` : le test compose la clé à partir du nom de fichier, et le
registre des modules citables est fermé dans la suite.

### Les liens sont relatifs, y compris dans les README publiés

Le plan ne tranchait pas. Une URL GitHub absolue dépasse la largeur de 100 dès qu'elle porte un
chemin de page ; npm réécrit les liens relatifs d'un README à partir du champ `repository`, et la
porte vérifie l'existence réelle du fichier visé — ce qu'elle ne saurait faire d'une URL. Les liens
sont donc relatifs partout.

### Un second module d'exemple, pour le chemin durci

Le plan n'en prévoyait qu'un. Un extrait que le lecteur copie doit porter ses propres imports, et
une seconde région d'`example.ts` aurait publié un fragment sans en-tête. `protected-example.ts`
existe pour cela, et la suite l'exécute réellement : worker, navigateur, PDF d'une page.

### Un troisième texte en retard

Le plan nommait l'ADR 0020 et la roadmap. `tests/golden/e7/references/README.md` annonçait lui
aussi un dossier vide. Il est corrigé dans le même incrément.

### La table des refus est devenue une liste

Le plan demandait une table à trois colonnes. Trente et un codes dont le plus long fait trente
caractères, plus deux colonnes de texte, ne tiennent pas en 100 colonnes. La porte accepte une
**liste ou** une table ; le guide publie une liste, dans l'ordre source, une entrée par code.

### Le sommaire annonce cinq pages, pas six

La sixième est le sommaire lui-même. Un lien vers soi n'aide personne.

---

## Ce qui reste ouvert

- **`@openview/core` n'a pas de documentation, ni de README.** La roadmap `core` s'arrête à C11 et
  aucun lot ne la porte. E9 le contourne en livrant un modèle d'exemple : personne n'a besoin du
  contrat pour son premier PDF. Le **deuxième** modèle, celui qu'un intégrateur voudra écrire, n'a
  aujourd'hui aucune page. À arbitrer par le propriétaire produit avant J7.
- **La parité de sens entre les deux langues n'est pas outillée.** Deux pages peuvent avoir la même
  structure, les mêmes extraits, les mêmes chiffres, et dire deux choses différentes. Signal de
  réouverture : la première question d'un lecteur français à laquelle la page anglaise répondait.
- **La porte ne vérifie pas les ancres.** `G6` prouve qu'un fichier lié existe, pas qu'une ancre
  `#section` y pointe.
- **`docs-api` n'est pas vérifiée dans le sens inverse.** La porte prouve que chaque nom déclaré est
  bien exporté ; elle ne devine pas qu'un mot entre accents graves aurait dû être déclaré, parce
  qu'aucune heuristique ne distingue un export d'un champ de données.
- **La page 04 changera quand E8 se fermera.** Elle recopie aujourd'hui quatre réserves ; le jour où
  le corpus hostile et la mesure de charge existent, elle les perd. C'est un signal, pas une dette.

---

## Conséquences

Un développeur extérieur peut installer trois paquets, coller deux fichiers, lancer deux commandes
et obtenir une facture. S'il échoue, la page 03 nomme son refus et lui dit quoi faire. S'il expose
le moteur à un document qu'il n'a pas écrit, la page 04 lui donne la façade durcie **et** la liste
de ce qui n'est pas prouvé.

Pour le dépôt, la conséquence est ailleurs : la documentation est désormais un **artefact
vérifié**. Un export retiré, un défaut changé, un code de refus ajouté sans sa ligne, un extrait
qui ne compile plus — chacun casse la suite avant d'atteindre un lecteur. C'est la seule forme de
documentation qui survit à un an de développement.
