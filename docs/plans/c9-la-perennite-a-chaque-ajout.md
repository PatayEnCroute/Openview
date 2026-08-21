# Plan d'implémentation — `@openview/core` lot C9 : la pérennité, à chaque ajout

> 🟡 **À EXÉCUTER.** Ce document planifie C9 ; il ne livre aucune modification de code.
>
> **Baseline relevée le 2026-08-21, après C8 :** `CURRENT_SCHEMA_VERSION` vaut **8**,
> `TEMPLATE_MIGRATIONS` contient les **sept** étapes 1→2 à 7→8, et
> [ADR 0010](../adr/0010-un-refus-comprehensible.md) est la dernière ADR disponible. C8 n'a ajouté
> aucune forme persistée et n'a donc créé ni version 9, ni huitième migration.
>
> **Nature du lot :** C9 n'est pas une neuvième évolution du contrat. C'est le lot qui rassemble,
> durcit et rend durable la preuve que les évolutions C1 à C8 n'ont pas rompu les modèles
> antérieurs. La cible normale est donc **une modification bornée du moteur de migration, des tests
> de compatibilité et de la documentation**, sans champ de modèle, sans schéma métier et sans
> dépendance.
>
> **Date :** 2026-08-21 · **Brique :** `@openview/core`, vague 1 · **Clôture visée :** vague 1 de
> `core`

---

## 0. Résultat attendu

La [roadmap du contrat](../roadmap/core.md#c9-la-pérennité-à-chaque-ajout) demande qu'un modèle écrit
avant C1 s'ouvre et se rende correctement après C8. La mécanique existe déjà :

- `parseTemplate` borne l'entrée, applique la chaîne de migrations puis valide le schéma courant ;
- chaque lot persistant de C1 à C7 a ajouté son estampille et son étape dans le même mouvement ;
- C8 a laissé la forme stockée intacte ;
- plusieurs tests traversent déjà une partie ou la totalité de la chaîne.

C9 ne remplace donc pas la mécanique. Il transforme un ensemble de preuves dispersées en un contrat
de non-régression unique et lisible :

1. la chaîne officielle est continue, ordonnée et complète de la version 1 à la version courante ;
2. une fixture réellement antérieure à C1 — notamment sans `page` — devient un `Template` courant
   exact ;
3. chaque version 1 à 8 possède un témoin minimal de la capacité persistée qu'elle a introduite ;
4. les contenus historiques conservent leur sens après migration, pas seulement leur validité
   syntaxique ;
5. toute étape produit exactement la version qu'elle annonce dans son champ `to` ;
6. la suite indique au prochain lot où ajouter sa fixture et sa preuve, sans prétendre détecter
   automatiquement toute évolution de schéma non estampillée.

### Ce que « se rend correctement » signifie avant l'existence du moteur

La vague 1 de `core` doit être terminée **avant** l'ouverture du moteur. C9 ne peut donc produire ni
DOM ni PDF sans renverser l'ordre décidé par la roadmap.

La preuve C9 comporte deux niveaux explicitement séparés :

| Niveau | Preuve | Propriétaire |
| :--- | :--- | :--- |
| Compatibilité disponible maintenant | Le modèle v1 est migré, validé, parcouru, ses chemins sont collectés et ses expressions historiques sont évaluées sur un jeu de données explicite avec le résultat attendu. | `@openview/core`, C9 |
| Compatibilité visuelle disponible plus tard | La même fixture migrée rejoint le corpus de documents figés et produit le PDF de référence attendu. | `@openview/engine`, E7 |

Cette séparation ne réduit pas la promesse. Elle évite seulement d'introduire dans `core` un faux
renderer de test qui devrait être jeté dès E1. À la livraison, la roadmap `core` doit écrire cette
frontière et la roadmap moteur doit recevoir le scénario E7 correspondant.

---

## 1. Baseline et écart à combler

### 1.1 La chaîne réellement livrée

| Version de départ | Contrat déjà porté par cette version | Lot qui livre la conversion suivante | Étape livrée | Effet de l'étape |
| :--- | :--- | :--- | :--- | :--- |
| 1 | état antérieur à C1 : texte, image, conteneur, boucle, condition et expressions initiales | C1 | 1→2 | estampille seulement |
| 2 | C1 : nouveaux kinds de formule et d'agrégation | C2 | 2→3 | estampille seulement |
| 3 | C2 : expression d'arrondi déclarée | C3 | 3→4 | estampille seulement |
| 4 | C3 : tableau, colonnes, lignes et groupes de lignes | C4 | 4→5 | **transformante** : écrit une page de compatibilité si elle manque |
| 5 | C4 : page, bandes et marqueurs de page | C5 | 5→6 | estampille seulement |
| 6 | C5 : apparence des boîtes et du texte | C6 | 6→7 | estampille seulement |
| 7 | C6 : écritures de langue, nombres, dates et monnaies | C7 | 7→8 | estampille seulement |
| 8 | C7 : préférence `keepTogether` ; C8 : diagnostics non persistés | — | — | version courante, aucun changement de format après C7 |

La nomenclature ci-dessus distingue volontairement la **version du document** du lot qui la rend
courante : le document v4 porte C3 ; c'est l'étape 4→5 de C4 qui le convertit. Les tests C9 doivent
raisonner sur les versions, jamais déduire une forme de la date ou du nom d'un lot.

### 1.2 Les preuves existantes à conserver

Le dépôt possède déjà des protections importantes :

- [`template/migrate.test.ts`](../../packages/core/src/template/migrate.test.ts) énumère la chaîne
  1→8, teste la première migration transformante, le double garde de forme, les estampilles seules,
  le refus d'une version future et plusieurs documents sous-estampillés ;
- [`diagnostics/__tests__/recette.test.ts`](../../packages/core/src/diagnostics/__tests__/recette.test.ts)
  charge un vrai objet v1 sans page après C8 ;
- les tests propres à C3, C5, C6 et C7 prouvent la conservation de leurs formes à travers leur pas
  de migration ;
- la version courante et les sept étapes sont exportées publiquement ;
- le message d'une version future est déjà typé et présenté par C8.

C9 reprend ces contrats ; il n'en supprime aucun pour faire place à une nouvelle organisation.

### 1.3 Les lacunes précises

#### Une vraie fixture v1 n'a pas encore d'oracle complet

Le test de migration nommé « écrit avant C1 » dans `migrate.test.ts` porte déjà une `page` rédigée,
alors qu'une page n'était pas requise avant C4. Il prouve la traversée des sept étapes, mais pas la
transformation réelle d'un document historique.

Le test C8 emploie, lui, un objet v1 réellement sans page ; son assertion se limite toutefois à
« la migration atteint la version courante » et « le parse ne lève pas ». Un document vide pourrait
satisfaire cette preuve alors qu'une boucle, une condition ou une liaison historique aurait été
altérée.

#### La preuve appartient à plusieurs lots

Le test C8 épingle littéralement la version 8 et la liste 1 à 7. Il deviendra rouge au prochain
changement persistant pour une raison sans rapport avec les diagnostics de C8. La topologie complète
doit avoir un seul propriétaire : C9.

Les tests de chaque sous-système gardent leur pas historique — par exemple 6→7 pour les écritures —,
mais ne doivent pas dupliquer la fin courante de la chaîne.

#### `TemplateMigration.to` n'est pas encore un invariant exécuté

Le runner choisit une étape par `from`, exécute sa fonction, puis accepte toute version de sortie
strictement supérieure. Une étape déclarée 1→2 peut donc produire une version 3 ou 8 sans être
refusée. Le registre officiel ne le fait pas, mais le champ `to` est alors décoratif dans la partie
générique de l'API.

C9 doit exiger que la version effectivement produite soit exactement celle annoncée par l'étape.
Le code d'erreur existant `invalid-migration-result` suffit ; aucun nouveau diagnostic n'est requis.

#### Le fichier de migration mélange trop de responsabilités de test

`migrate.test.ts` réunit le parsing courant, le garde de forme, la topologie du registre, les règles
du runner, sept générations de compatibilité et les cas particuliers de chaque lot. Le
dossier `template/__tests__/` existe déjà : C9 est le bon moment pour isoler la preuve historique,
sans réécrire la logique testée.

---

## 2. Décisions d'implémentation

### D1 — C9 ne crée pas de version 9

La version reste 8 parce que C9 n'ajoute aucun champ, aucun kind et aucune valeur persistée. Une
nouvelle fixture, un garde sur le runner et une réorganisation de tests sont des changements de
code, pas des changements du format stocké.

Conséquences :

- `TemplateSchema` reste inchangé ;
- le contenu de `TEMPLATE_MIGRATIONS` reste composé des sept étapes existantes ;
- aucun document v8 ne devient illisible pour un build v8 antérieur ;
- aucun commentaire ne doit présenter une migration 8→9 comme un « jalon C9 ».

Ajouter une estampille sans nouvelle forme serait ici une migration réellement fantôme, à l'inverse
des estampilles C1, C2, C3, C5, C6 et C7 qui protégeaient chacune une forme nouvelle.

### D2 — Un corpus historique de huit fixtures, réservé aux tests

C9 introduit une fixture minimale par version 1 à 8. Chaque fixture est une donnée brute :

- son `schemaVersion` est un littéral historique ;
- elle n'est ni annotée ni validée au chargement comme `Template` courant ;
- elle ne dépend pas d'un builder courant qui lui ajouterait silencieusement les champs récents ;
- elle ne contient aucun champ apparu après sa version ;
- elle porte une capacité représentative de cette version, pas une copie exhaustive de tous les
  tests du lot.

Les fixtures vivent en TypeScript dans le dossier de test, sous forme d'objets de donnée non mutés.
Un fichier JSON importé n'est pas retenu : il obligerait à modifier la configuration TypeScript ou à
introduire une lecture Node dans un paquet volontairement isomorphe. Une fixture TypeScript locale
offre la même indépendance à condition de ne jamais la typer comme le contrat courant.

### D3 — La matrice historique est fermée

| Fixture | Capacité témoin | Champs futurs explicitement absents |
| :--- | :--- | :--- |
| v1 | conteneur, texte littéral + liaison, boucle avec alias, condition et chemin arbitraire fourni par l'hôte | `page`, tableau, apparence, `presentations`, `keepTogether` |
| v2 | au moins une formule C1 composée, avec agrégation ou arithmétique dans une position imprimable | `page`, tableau, arrondi, apparence, `presentations`, `keepTogether` |
| v3 | un `round` complet avec mode et décimales déclarés | `page`, tableau, apparence, `presentations`, `keepTogether` |
| v4 | un tableau minimal correctement câblé, avec colonne et ligne | `page`, apparence, `presentations`, `keepTogether` |
| v5 | une page rédigée par l'auteur et un `pageField` dans une position de texte | apparence, `presentations`, `keepTogether` |
| v6 | une boîte, une typographie et un alignement représentatifs | `presentations`, `keepTogether` |
| v7 | une table d'écritures avec locale explicite et, selon le contrat livré, date/nombre/monnaie | `keepTogether` |
| v8 | deux blocs frères dont un seul porte `keepTogether: true` | aucune forme future inventée |

Les noms de chemins emploient un vocabulaire neutre choisi par la fixture, par exemple un objet
`payload` et une collection `entries`. C9 ne réserve aucun nom de facture, de client, de ligne ou de
montant et n'ajoute aucun schéma au jeu de données de l'intégrateur.

### D4 — L'oracle de migration porte sur le document entier

Pour chaque fixture, la preuve compare la forme complète attendue après conversion, et pas seulement
`schemaVersion` ou la présence d'un nœud :

- une fixture v1 à v4 sans page reçoit exactement la page de compatibilité 210 × 297 mm, marges de
  20 mm, bandes vides ;
- une fixture v4 qui porte déjà une page rédigée la conserve ;
- une fixture v5 à v8 ne reçoit aucune page inventée ;
- toutes les autres clés restent identiques après remise de l'estampille historique ;
- aucune table d'écritures, apparence ou préférence de fragmentation n'est inventée pour un document
  plus ancien ;
- le document brut donné au runner reste inchangé.

La comparaison se fait sur la donnée sérialisable complète. Les assertions ciblées restent utiles
pour l'identité d'objets créée par la page de compatibilité et pour distinguer une clé absente d'une
clé présente à `undefined`.

### D5 — Le sens du modèle v1 est rejoué sans renderer de test

Après `parseTemplate`, la fixture v1 est vérifiée par les opérations publiques déjà disponibles :

- `collectTemplateDataPaths` restitue exactement les chemins déclarés par le modèle ;
- `walk` ou le Visitor restitue les nœuds historiques dans leur ordre ;
- `evaluateSequence` matérialise la collection donnée à la boucle ;
- `childScope` résout l'alias de l'itération ;
- `evaluatePredicate` choisit la même branche de condition ;
- `evaluateExpression` produit la valeur attendue pour la liaison de texte.

Le test compose localement un petit résultat sémantique explicite à comparer. Il n'ajoute ni helper
de rendu dans `core`, ni HTML, ni CSS, ni pagination, ni composant React. La future preuve PDF E7
consommera la même fixture conceptuelle à travers le moteur réel.

### D6 — La topologie officielle est vérifiée sans liste périssable

Un test unique possède la chaîne complète. Il vérifie :

- la première étape part de la version 1 ;
- chaque étape officielle avance exactement d'une unité ;
- le `from` d'une étape est le `to` de la précédente ;
- aucun `from` ni `to` n'est dupliqué ;
- le dernier `to` vaut `CURRENT_SCHEMA_VERSION` ;
- le nombre d'étapes vaut `CURRENT_SCHEMA_VERSION - 1` tant que la version initiale reste 1.

L'attendu est dérivé de la version courante et de la version initiale, pas recopié sous la forme
`[1, 2, 3, 4, 5, 6, 7]` dans plusieurs sous-systèmes. Les tests propres aux lots conservent en
revanche leur assertion locale, par exemple « la chaîne contient 6→7 », parce que cette version
d'introduction ne change jamais.

Ce filet garantit qu'un bump de `CURRENT_SCHEMA_VERSION` sans étape fait échouer la suite. Il ne
peut pas déterminer qu'un développeur a ajouté un champ sans bumper la version : cette décision
reste une obligation de revue humaine explicitement reconnue par `AGENTS.md`. C9 n'annonce pas une
automatisation qui n'existe pas.

### D7 — Une étape doit produire son `to` déclaré

Le runner conserve la possibilité publique de recevoir une chaîne injectée. Il ne lui impose pas
la topologie unitaire du registre officiel : un appelant de test peut fournir une conversion directe
vers la version courante. En revanche, lorsqu'une étape sélectionnée annonce `to: n`, sa sortie doit
porter exactement `schemaVersion: n`.

Les cas suivants rendent `TemplateMigrationError` avec `invalid-migration-result` :

- la sortie perd `schemaVersion` ;
- la sortie conserve ou recule la version ;
- la sortie avance au-delà du `to` déclaré ;
- la sortie s'arrête avant le `to` déclaré.

Cette règle donne enfin un sens exécutable aux deux bornes de `TemplateMigration` sans créer de
nouveau type ou de nouveau code.

### D8 — La conversion officielle est pure et rejouable

C9 épingle les propriétés suivantes sur les fixtures officielles :

- ni `migrateToCurrent` ni `parseTemplate` ne modifie l'objet historique reçu ;
- deux conversions du même document donnent deux résultats structurellement égaux ;
- les pages de compatibilité de deux documents distincts ne partagent pas leurs objets imbriqués ni
  leurs tableaux de bandes ;
- convertir puis parser un document déjà courant est idempotent ;
- sérialiser le résultat, le relire et le parser produit la même forme courante.

C9 ne promet pas de rendre pure une fonction de migration arbitraire fournie par l'appelant. La
fonction injectée reste du code de confiance ; ses erreurs traversent selon la politique C8. La
pureté testée est celle du registre livré par Openview.

### D9 — Les tests de migration sont séparés par responsabilité

Le fichier monolithique est réparti sous `packages/core/src/template/__tests__/` :

| Fichier cible | Responsabilité exclusive |
| :--- | :--- |
| `parse-template.test.ts` | frontière `parseTemplate`, bornage avant/après migration, validation courante et refus des entrées futures |
| `migration-runner.test.ts` | chaîne injectée, version absente, étape absente, progression, respect de `to` et erreurs typées |
| `compatibility-fixtures.ts` | huit objets historiques et attentes de compatibilité, sans type courant |
| `compatibility.test.ts` | topologie du registre officiel, conversion exacte des huit fixtures, replay sémantique v1, pureté et idempotence |

Le déplacement conserve les scénarios existants avant d'ajouter les nouveaux. Les commentaires
directement repris sont réécrits en anglais, en 1 à 5 lignes lorsqu'ils documentent un contrat, sans
numéro de lot, historique de brouillon ni métrique de campagne. Les longues démonstrations restent
dans les ADR et dans ce plan.

### D10 — C9 devient l'unique propriétaire de la compatibilité transversale

Dans le test de recette C8 :

- le contrôle littéral de la version 8 et de la liste 1 à 7 est retiré ;
- le mini-test v1 sans oracle est retiré après installation de la preuve C9 plus forte ;
- le test de la politique de donnée absente reste, car il appartient réellement à C8.

Dans les tests de présentation, style, table, page et AST, les assertions sur leur **version
d'introduction** restent en place. Seules les références textuelles à l'ancien chemin de
`migrate.test.ts` sont ajustées si le déplacement les rend fausses.

### D11 — Aucun schéma historique de production

C9 ne crée ni `TemplateV1Schema`, ni union `StoredTemplateV1 | … | StoredTemplateV8`, ni huit types
publics. La chaîne actuelle migre d'abord puis valide une seule forme courante ; dupliquer tous les
anciens schémas en production créerait huit sources de vérité et rendrait chaque futur ajout huit
fois plus coûteux.

Les fixtures historiques sont des preuves, pas une seconde API de parsing. `parseTemplate` reste
l'unique frontière persistable. `TemplateSchema.parse(raw)` reste une validation du format courant,
pas une porte de migration.

### D12 — L'ADR de clôture porte le protocole futur

L'ADR C9 est `0011-la-perennite-a-chaque-ajout.md` sur la baseline actuelle. Elle doit consigner :

- la matrice versions 1 à 8 ;
- la distinction estampille / transformation ;
- la page de compatibilité comme seule transformation historique à cette date ;
- la topologie et le respect de `to` ;
- le protocole à suivre à toute évolution persistée future ;
- la limite honnête de l'automatisation : la machine vérifie une chaîne déclarée, la revue humaine
  décide qu'une évolution de forme exige une nouvelle déclaration ;
- le relais vers E7 pour la preuve PDF.

Si une ADR concurrente prend le numéro 0011 avant l'exécution, seul le numéro et les liens sont
recalculés ; aucune décision de ce plan n'en dépend.

---

## 3. Protocole imposé aux évolutions futures

C9 livre un protocole de contribution, documenté dans l'ADR et démontré par la suite :

1. identifier si l'évolution touche une forme persistée, y compris un champ optionnel ou un membre
   d'union ;
2. si oui, incrémenter `CURRENT_SCHEMA_VERSION` une seule fois après la dernière forme du lot ;
3. ajouter l'étape officielle depuis l'ancienne version dans le même état publiable ;
4. décider explicitement si l'étape estampille seulement ou transforme une donnée ;
5. ajouter une fixture minimale estampillée à la nouvelle version, portant la capacité introduite ;
6. ajouter l'oracle qui prouve la conservation des versions précédentes ;
7. conserver le test local du sous-système sur sa version d'introduction ;
8. jouer les quatre portes avant de publier ;
9. consigner la décision et les preuves d'ablation dans l'ADR du lot.

Un lot persistant ne doit jamais laisser sur la branche principale un état sachant écrire la forme
nouvelle avec l'ancienne estampille. Les incréments internes peuvent exister, mais le premier état
publiable contient ensemble la forme, la version, la migration et sa fixture.

### Ce que le protocole ne prétend pas automatiser

Ni TypeScript, ni Zod, ni Vitest ne sait comparer l'intention d'un schéma à l'état de la branche de
référence sans un mécanisme de diff dédié. C9 n'ajoute ni fingerprint fragile des internes de Zod,
ni snapshot géant qu'un simple « update snapshots » rendrait vert, ni modification de CI interdite
par le mandat.

La protection est composée de trois niveaux réels :

- `AGENTS.md` impose le bump et la migration en revue ;
- les tests locaux rendent visible la forme nouvelle et sa version d'introduction ;
- le test C9 refuse toute chaîne officielle incomplète, fusionnée ou discontinue une fois la
  version bumpée.

---

## 4. Fichiers de la future implémentation

### 4.1 Production

| Fichier | Modification prévue |
| :--- | :--- |
| [`packages/core/src/template/migrate.ts`](../../packages/core/src/template/migrate.ts) | Faire respecter la version `to` annoncée par l'étape sélectionnée, en réutilisant `TemplateMigrationError` et `invalid-migration-result`. Garder le registre officiel 1→8 inchangé. |

### 4.2 Tests

| Fichier | Modification prévue |
| :--- | :--- |
| [`packages/core/src/template/migrate.test.ts`](../../packages/core/src/template/migrate.test.ts) | Déplacer ses scénarios vers les trois fichiers spécialisés, puis supprimer le fichier source une fois la parité de tests vérifiée. |
| `packages/core/src/template/__tests__/parse-template.test.ts` | Recevoir les tests de frontière, validation, bornage et version future. |
| `packages/core/src/template/__tests__/migration-runner.test.ts` | Recevoir les tests génériques et ajouter les sorties différentes de `to`. |
| `packages/core/src/template/__tests__/compatibility-fixtures.ts` | Déclarer les huit fixtures brutes et leurs attentes, sans import de `Template` ni de schéma courant. |
| `packages/core/src/template/__tests__/compatibility.test.ts` | Posséder la chaîne officielle, les huit migrations exactes, la fixture v1 sémantique, la pureté et l'idempotence. |
| [`packages/core/src/diagnostics/__tests__/recette.test.ts`](../../packages/core/src/diagnostics/__tests__/recette.test.ts) | Retirer les deux preuves transversales reprises par C9 et leurs imports devenus inutiles ; conserver la preuve C8 sur la donnée absente. |
| [`packages/core/src/presentation/__tests__/presentation.test.ts`](../../packages/core/src/presentation/__tests__/presentation.test.ts) | Ajuster uniquement le commentaire qui nomme l'ancien propriétaire de la chaîne complète, si nécessaire ; conserver les preuves locales 6→7. |

Le nombre total de tests n'est pas un contrat. La migration initiale des scénarios se contrôle par
leurs noms et comportements, puis les nouveaux cas augmentent la suite. Aucun test ne doit être
supprimé uniquement pour maintenir un compte.

### 4.3 Documentation à livrer avec C9

| Fichier | Modification prévue |
| :--- | :--- |
| `docs/adr/0011-la-perennite-a-chaque-ajout.md` | Consigner les décisions D1 à D12, les mesures après exécution, les preuves d'ablation et le protocole futur. |
| [`docs/roadmap/core.md`](../roadmap/core.md) | Marquer C9 livré, préciser les deux niveaux de la preuve « ouvre et rend », déclarer la vague 1 close sans version 9 et relier l'ADR. |
| [`docs/roadmap/engine.md`](../roadmap/engine.md) | Ajouter à E7 le scénario : la fixture historique v1, migrée par `parseTemplate`, rejoint le corpus PDF figé lorsque le moteur existe. |
| [`docs/adr/0010-un-refus-comprehensible.md`](../adr/0010-un-refus-comprehensible.md) | Ajouter uniquement un lien de complément vers l'ADR C9 à la section qui lui transmet la compatibilité ; ne pas réécrire la décision historique de C8. |
| Ce plan | Passer en statut « périmé — C9 livré » en dernier et pointer vers l'ADR réellement attribuée. |

### 4.4 Fichiers explicitement inchangés

- [`packages/core/src/template/template.ts`](../../packages/core/src/template/template.ts) : version
  8 et schéma courant inchangés ;
- le tableau `TEMPLATE_MIGRATIONS` : aucune entrée, suppression, fusion ou réécriture des sept
  fonctions livrées ; seul le runner autour du tableau est durci ;
- [`packages/core/src/index.ts`](../../packages/core/src/index.ts) : aucun export nouveau ;
- `packages/core/src/ast/**`, `expression/**`, `page/**`, `presentation/**` et `style/**` en
  production : les capacités sont rejouées, pas redéfinies ;
- `packages/engine/**`, `packages/designer/**`, `packages/viewer/**` et le playground : aucun moteur,
  adaptateur ou écran n'est anticipé ; seule la roadmap moteur reçoit le scénario futur ;
- les ports de stockage et de rendu : C9 ne crée aucun second adaptateur ;
- `package.json`, `pnpm-workspace.yaml`, `tsconfig*`, Biome, Turbo, Sonar et les workflows : aucune
  dépendance, configuration ou règle de CI ;
- `AGENTS.md` : la règle de versionnement fait déjà foi et n'a pas besoin d'être amendée.

---

## 5. Découpage en trois incréments

### INC-0 — Réorganisation sans changement de comportement

**Contenu :**

- créer le sous-dossier de tests ciblé s'il manque des fichiers ;
- répartir les scénarios actuels entre parsing, runner et compatibilité ;
- conserver toutes les assertions et tous les cas d'erreur existants ;
- traduire et condenser les commentaires directement déplacés conformément à `AGENTS.md` ;
- mettre à jour les imports relatifs avec extension `.js` ;
- retirer le fichier monolithique seulement après vérification de la découverte Vitest.

**Critère de sortie :** les quatre portes rendent le même comportement qu'avant l'incrément ; aucune
ligne de production, aucune version et aucune migration n'a changé. Une comparaison des noms de
tests avant/après confirme qu'aucun scénario n'a disparu.

### INC-1 — Contrat C9 et durcissement du runner

**Contenu :**

- ajouter les huit fixtures historiques ;
- installer le test unique de topologie officielle ;
- remplacer les deux preuves transversales de C8 par la preuve C9 ;
- vérifier la conversion exacte et la non-mutation de chaque fixture ;
- rejouer le sens de la fixture v1 avec les opérations publiques de `core` ;
- faire respecter la version `to` déclarée ;
- ajouter les quatre cas de sortie invalide associés ;
- vérifier idempotence, sérialisation/relecture et indépendance des pages de compatibilité.

**Critère de sortie :** une fixture v1 sans page et avec contenu historique ressort en version 8,
porte exactement la page de compatibilité et produit les chemins, itérations, branches et valeurs
attendus. Modifier volontairement une étape officielle, sauter une version, perdre un contenu ou
produire une version différente de `to` fait échouer un test ciblé.

### INC-2 — ADR, roadmaps et clôture de la vague

**Contenu :**

- créer l'ADR C9 sous le prochain numéro libre ;
- consigner les mesures et les ablations réellement rejouées ;
- marquer C9 et la vague 1 de `core` livrés ;
- transmettre le scénario visuel à E7 ;
- relier l'ADR C8 sans réécrire son historique ;
- exécuter les quatre portes finales ;
- marquer le présent plan périmé en dernier.

**Critère de sortie :** la documentation ne laisse entendre ni qu'un PDF existe déjà, ni que C9 a
créé une version 9, ni que la détection de tout changement de schéma est entièrement automatique.
Le protocole du prochain lot persistant est lisible sans rouvrir les plans C1 à C8.

---

## 6. Plan de test complet

### 6.1 Topologie du registre officiel

Vérifier dans un seul test propriétaire :

1. origine à 1 ;
2. ordre strictement croissant ;
3. pas unitaire pour chaque étape officielle ;
4. couture exacte entre deux étapes consécutives ;
5. absence de doublon ;
6. terminaison à `CURRENT_SCHEMA_VERSION` ;
7. longueur cohérente avec l'origine et la terminaison.

Contre-épreuves à rejouer avant livraison puis consigner dans l'ADR :

- retirer 4→5 : les fixtures v1 à v4 échouent sur une chaîne rompue ;
- fusionner 3→4 et 4→5 : la topologie échoue même si une conversion directe pourrait atteindre 5 ;
- inverser deux entrées : l'ordre et la couture échouent ;
- bumper temporairement la version courante sans ajouter d'étape : la terminaison échoue.

### 6.2 Contrat générique d'une étape

Couvrir :

- sortie exactement égale à `to` : acceptée ;
- sortie sans `schemaVersion` : refus `invalid-migration-result` ;
- sortie égale à `from` : refus ;
- sortie inférieure à `from` : refus ;
- sortie entre `from` et `to` : refus ;
- sortie supérieure à `to` : refus ;
- exception arbitraire levée par la fonction : elle traverse intacte et reste diagnostiquée comme
  erreur inconnue par la façade C8.

Le message doit nommer l'étape déclarée et la version réellement produite sans exposer de contenu du
modèle. Le test porte d'abord sur le code typé, puis sur les fragments nécessaires à l'action ; une
copie intégrale du message n'est ajoutée que si cette phrase devient un contrat public décidé dans
l'ADR.

### 6.3 Conversion des huit fixtures

Pour chaque version :

- `migrateToCurrent` atteint la version courante ;
- `parseTemplate` accepte le résultat ;
- le document source est inchangé ;
- la capacité témoin est présente et identique ;
- aucun champ d'une version ultérieure n'est inventé, sauf la page requise par 4→5 ;
- une seconde conversion produit la même donnée ;
- un aller-retour JSON reste parseable et identique.

Pour v1 à v4 sans page, vérifier le contenu complet de la page de compatibilité. Pour v4 avec page,
vérifier la conservation de la page de l'auteur. Pour v7, vérifier l'absence de `keepTogether` sur
tous les nœuds ; pour v8, vérifier la distinction entre clé présente à `true` et clé absente.

### 6.4 Replay sémantique v1

Le jeu de données de test est explicite, déterministe et choisi par la fixture. Couvrir :

- chemin racine vers la collection ;
- itération sur au moins deux éléments ;
- alias local distinct du chemin racine ;
- branche vraie et branche fausse sur deux éléments différents ;
- texte fixe et valeur liée dans le bon ordre ;
- liste exacte des chemins statiques ;
- ordre exact des ids visités.

Le test ne lit ni date courante, ni locale système, ni fuseau, ni variable d'environnement. Toute
date éventuelle est une chaîne fournie dans le jeu de données et toute présentation éventuelle est
nommée par le modèle.

### 6.5 Sécurité et bornage conservés

Le déplacement des tests conserve les preuves existantes :

- l'entrée brute est bornée avant toute lecture ;
- une sortie transformée est bornée une seconde fois ;
- aucun second scan n'est effectué si aucune migration ne s'applique ;
- les accesseurs, cycles, profondeurs et volumes hostiles restent refusés par les erreurs typées
  existantes ;
- la page ajoutée par 4→5 peut faire franchir `maxNodes` et le second garde l'intercepte ;
- une version future est refusée avant validation du schéma courant.

C9 ne modifie aucun plafond. Les fixtures restent petites et ne deviennent pas un benchmark caché.

### 6.6 Non-régression des diagnostics C8

Le durcissement du runner réutilise `invalid-migration-result`. Vérifier que :

- `diagnosticsOf` reconnaît la sortie différente de `to` comme une migration invalide ;
- le diagnostic ne contient ni valeur du modèle ni cause sérialisée ;
- `fromVersion` reste la version de départ de l'étape fautive ;
- une exception de programmation arbitraire n'est toujours pas aplatie en diagnostic utilisateur.

Cette couverture peut étendre le tableau existant de `from-error.test.ts` si le nouveau cas n'est
pas déjà couvert par son code commun ; elle ne crée pas un fichier C9 dans le sous-système C8.

### 6.7 Portée publique

Vérifier que l'intégrateur continue d'utiliser les mêmes symboles :

- `parseTemplate` ;
- `migrateToCurrent` ;
- `TEMPLATE_MIGRATIONS` ;
- `CURRENT_SCHEMA_VERSION` ;
- `TemplateMigrationError` et ses codes existants.

Aucun export, paramètre ou type nouveau n'est attendu. Le resserrement « la sortie égale `to` » est
documenté comme l'application d'un invariant déjà déclaré, pas comme une nouvelle stratégie de
migration.

### 6.8 Quatre portes

À la fin de chaque incrément publiable, puis une dernière fois avant clôture :

```bash
pnpm run lint && pnpm run build && pnpm run type-check && pnpm run test:coverage
```

La couverture reste au moins à 90 % sur statements, branches, fonctions et lignes, sans exclusion,
seuil ou configuration modifié. Le déplacement de fichiers doit rester découvert par Vitest et
exclu du build publié conformément aux quatre suffixes de test du `tsconfig` existant.

---

## 7. Preuves d'ablation à consigner dans l'ADR

L'ADR ne doit pas seulement annoncer des tests verts. Avant la livraison, rejouer puis restaurer les
mutations suivantes :

| Mutation temporaire | Échec attendu |
| :--- | :--- |
| retirer l'étape 4→5 | topologie rompue et fixtures v1 à v4 incapables d'atteindre le format courant |
| remplacer la page de compatibilité par une page partielle | type-check si l'annotation de production est touchée, sinon comparaison exacte de fixture et parse |
| faire produire 3 à une étape déclarée 1→2 | test du runner sur `invalid-migration-result` |
| enlever la boucle de la fixture v1 après migration | oracle du document complet, chemins, ordre de visite et replay sémantique |
| inventer `presentations: {}` dans une migration ancienne | comparaison complète de la fixture et contrôle d'absence |
| écrire `keepTogether: undefined` sur les nœuds v7 | contrôle de propriété propre, pas seulement sérialisation JSON |
| partager un unique objet page entre deux migrations | contrôle d'identité des pages et de leurs tableaux |
| bumper la version à 9 sans huitième étape | terminaison et longueur de la topologie officielle |

Chaque mutation est locale, immédiatement restaurée et suivie d'un `git diff` ciblé. Aucune mesure
destructive, aucun reset et aucun changement utilisateur sans rapport ne sont autorisés.

---

## 8. Définition de fini

C9 est livré lorsque toutes les affirmations suivantes sont vraies :

- la version courante reste 8 et le registre officiel contient toujours sept étapes ;
- la chaîne officielle est vérifiée une seule fois, de façon continue et non dupliquée dans C8 ;
- le champ `to` de toute étape exécutée correspond exactement à sa sortie ;
- les erreurs de cette règle réutilisent `invalid-migration-result` et la façade C8 ;
- huit fixtures brutes représentent les versions 1 à 8 sans être typées comme le contrat courant ;
- la fixture v1 ne porte aucune page et traverse réellement la migration transformante 4→5 ;
- chaque fixture atteint le schéma courant sans perdre sa capacité témoin ;
- aucune capacité future n'est inventée pour une version ancienne, hormis la page de compatibilité
  explicitement décidée ;
- le replay v1 prouve les chemins, le parcours, la boucle, l'alias, la condition et la liaison ;
- le document source n'est jamais muté et les résultats sont idempotents et sérialisables ;
- les tests de migration sont rangés par responsabilité sous `template/__tests__/` ;
- les commentaires TypeScript déplacés sont concis, contractuels et anglais ;
- aucun schéma historique, helper de rendu, Port, export, dépendance ou configuration n'est ajouté ;
- la roadmap `core` distingue la preuve sémantique C9 de la future preuve PDF E7 ;
- la roadmap moteur reçoit la fixture historique comme scénario de document figé ;
- l'ADR C9 porte le protocole futur, ses limites et les preuves d'ablation ;
- la vague 1 de `core` est marquée close sans prétendre que le moteur existe ;
- les quatre portes passent dans l'ordre exact de la CI ;
- le présent plan est marqué périmé seulement après toutes les étapes précédentes.

---

## 9. Risques, limites et arbitrages différés

### La fixture v1 n'est pas un schéma v1

Elle est un témoin historique relu contre les décisions des ADR 0001 et 0002. C9 ne garantit pas
qu'un objet arbitraire estampillé 1 était valide dans toutes les versions intermédiaires ; il garantit
que ce modèle de référence, valide avant C1, reste accepté et conserve son sens.

### Une fixture par version n'est pas une duplication de tous les tests

Chaque sous-système conserve ses tests exhaustifs. Le corpus C9 choisit un témoin représentatif par
version afin de vérifier la composition de la chaîne. Ajouter toutes les bornes de tous les schémas
ferait de C9 une seconde suite complète, plus coûteuse et moins précise que les originales.

### L'automatisation ne détecte pas seule l'oubli du bump

Le filet devient fort **après** que la version a été incrémentée. Détecter qu'un champ nouvellement
ajouté aurait dû provoquer ce bump reste une revue humaine. Un futur mandat explicite pourrait
ajouter une comparaison de schéma avec la branche de référence, mais C9 ne modifie ni CI ni outils
et ne contourne pas cette limite par un snapshot fragile.

### La preuve visuelle attend le moteur

C9 ne peut garantir ni pagination, ni police, ni pixel, ni PDF. E7 reçoit ce devoir avec le même
modèle historique. Si le moteur change la représentation intermédiaire, la fixture stockée reste
inchangée ; seul l'adaptateur de test E7 évolue.

### Le resserrement de `to` touche les chaînes injectées

Un appelant qui déclarait une étape 1→2 mais produisait volontairement 8 exploitait un contrat
incohérent. C9 refuse désormais ce cas. Un convertisseur direct reste possible à condition d'annoncer
la vraie destination. L'ADR doit nommer ce resserrement comportemental et son caractère correctif.

### La page A4 historique reste assumée

C9 ne rouvre pas la décision C4. La page 210 × 297 mm et ses marges de 20 mm sont une donnée de
compatibilité écrite une fois, pas une lecture de locale système et pas le défaut des nouveaux
modèles. Le corpus l'épingle afin qu'un futur nettoyage ne la change pas silencieusement.

---

## 10. Contrôle de périmètre avant exécution

Avant INC-0 :

1. vérifier que C8 est livré, que l'ADR 0010 existe et que la branche ne contient pas de travail C9
   partiellement engagé ;
2. relever `CURRENT_SCHEMA_VERSION`, la topologie réelle, le prochain numéro d'ADR et les tests qui
   possèdent encore la chaîne complète ;
3. vérifier qu'aucune version 9 ou migration 8→9 n'a été ajoutée entre la rédaction et l'exécution ;
4. reconstruire la fixture v1 depuis les capacités réellement antérieures à C1, sans lui ajouter
   un champ par commodité de parsing ;
5. conserver tous les changements utilisateur sans rapport et ne jamais réinitialiser la branche ;
6. confirmer qu'aucune modification de `TemplateSchema`, d'AST, de donnée de rendu, de dépendance ou
   de configuration n'est nécessaire ;
7. si une nouvelle évolution persistée a déjà atterri, arrêter l'exécution, étendre la matrice à sa
   version réelle et recalculer les attendus avant toute écriture ;
8. si l'ADR 0011 est prise, attribuer le prochain numéro libre et mettre à jour tous les liens du
   lot dans un seul changement documentaire.

Ce contrôle protège le sens du plan : C9 doit auditer la chaîne réellement publiée, jamais figer une
photographie déjà dépassée.
