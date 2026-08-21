# ADR 0011 — La pérennité, à chaque ajout

- **Statut :** 🟢 **Accepté** (2026-08-21), implémenté dans `@openview/core`
- **Date :** 2026-08-21
- **Impact :** `@openview/core` (**aucun champ de modèle, aucune forme persistée, aucune
  migration nouvelle** ; `CURRENT_SCHEMA_VERSION` reste **8** et `TEMPLATE_MIGRATIONS` reste à
  **sept** entrées ; **un seul resserrement de production** — une étape doit produire exactement
  la version qu'elle annonce — et un **corpus historique de huit fixtures** réservé aux tests),
  `@openview/engine` (le lot **E7** reçoit la fixture historique comme document figé, et c'est là
  que la preuve visuelle sera faite — pas ici), `@openview/designer`, `@openview/viewer` et
  `apps/playground` (**intacts** : aucun écran, aucun adaptateur, aucun moteur n'est anticipé)
- **Complète :** [ADR 0006](0006-la-page.md), dont la page de compatibilité 210 × 297 mm à marges
  de 20 mm devient une **valeur épinglée** qu'un nettoyage ultérieur ne peut plus changer en
  silence ; [ADR 0010](0010-un-refus-comprehensible.md), dont le code `invalid-migration-result`
  couvre désormais un cas de plus **sans nouveau diagnostic, sans nouvelle phrase et sans nouveau
  champ** ; [ADR 0009](0009-les-blocs-insecables.md), dont la distinction entre la clé présente à
  `true` et la clé absente est vérifiée sur **propriété propre** et non par sérialisation.
- **N'amende aucune règle de gouvernance.** `AGENTS.md`, les `tsconfig*`, `biome.jsonc`, les
  plugins GritQL, `turbo.json`, `sonar-project.properties`, les workflows, `package.json` et
  `pnpm-workspace.yaml` sortent du lot **inchangés** : **zéro dépendance nouvelle**.
  `template/template.ts` et le contenu de `TEMPLATE_MIGRATIONS` sortent **octet pour octet**.
  Le barrel public reste à **133** valeurs : **aucun export, aucun paramètre, aucun type nouveau**.
- **Plan d'implémentation :**
  [docs/plans/c9-la-perennite-a-chaque-ajout.md](../plans/c9-la-perennite-a-chaque-ajout.md) —
  **périmé** une fois le lot livré. C'est cette ADR qui fait foi, et elle **corrige** son plan sur
  quatre points nommés au [§ Ce que l'exécution a corrigé du plan](#ce-que-lexécution-a-corrigé-du-plan).
- **Implémentation :**
  [`src/template/migrate.ts`](../../packages/core/src/template/migrate.ts) (le respect du `to`
  déclaré),
  [`src/template/__tests__/compatibility-fixtures.ts`](../../packages/core/src/template/__tests__/compatibility-fixtures.ts)
  (les huit documents historiques et leurs attentes),
  [`src/template/__tests__/compatibility.test.ts`](../../packages/core/src/template/__tests__/compatibility.test.ts)
  (la topologie officielle, les huit conversions, le rejeu sémantique v1, la pureté),
  [`src/template/__tests__/migration-runner.test.ts`](../../packages/core/src/template/__tests__/migration-runner.test.ts)
  (le contrat générique d'une étape),
  [`src/template/__tests__/parse-template.test.ts`](../../packages/core/src/template/__tests__/parse-template.test.ts)
  (la frontière et le bornage)

---

## Contexte

Les huit lots précédents ont chacun modifié le contrat de modèle. La mécanique de conversion
existait déjà et elle fonctionnait : `parseTemplate` borne l'entrée, applique la chaîne, borne
encore si une étape a transformé, puis valide **une seule** forme courante.

Ce qui n'existait pas, c'est un **contrat de non-régression unique**. La preuve que C1 à C8 n'ont
rompu aucun modèle antérieur était dispersée : un test de migration monolithique de 796 lignes,
deux assertions transversales logées dans la recette C8, et des tests par sous-système qui
épinglaient chacun un bout de la chaîne. Trois défauts en découlaient, et aucun n'était théorique :

- **La fixture « écrite avant C1 » portait une `page`**, alors qu'une page n'était pas requise
  avant C4. Elle prouvait la traversée des sept étapes, jamais la conversion d'un document
  réellement historique.
- **La recette C8 épinglait littéralement la version 8 et la liste `[1..7]`.** Elle serait devenue
  rouge au prochain changement persistant, pour une raison sans rapport avec les diagnostics.
- **`TemplateMigration.to` n'était pas un invariant exécuté.** Le runner choisissait une étape par
  `from`, exécutait sa fonction, puis acceptait **toute** version strictement supérieure. Une
  étape déclarée `1 -> 2` pouvait produire 3, ou 8, sans être refusée.

C9 ne remplace pas la mécanique. Il en fait une **preuve unique, lisible et possédée par un seul
fichier**.

---

## Ce que le lot n'est pas

C9 **ne crée pas de version 9**, et cette phrase est une décision, pas un constat.

Une estampille sans forme nouvelle serait ici une migration réellement fantôme — à l'inverse des
estampilles C1, C2, C3, C5, C6 et C7, qui protégeaient chacune une forme nouvelle en rendant
lisible le refus d'un build antérieur. Ajouter `8 -> 9` pour « marquer le lot » rendrait illisible
pour un build v8 un document que rien ne distingue d'un document v8, et coûterait une entrée
perpétuelle dans la chaîne pour zéro protection.

Le lot ne produit **ni DOM, ni PDF, ni pixel**. La vague 1 de `core` doit être close avant
l'ouverture du moteur ; produire ici un faux renderer de test, à jeter dès E1, aurait renversé
l'ordre décidé par la roadmap pour une preuve que le moteur devra refaire de toute façon.

---

## Les deux niveaux de la promesse, nommés plutôt qu'enterrés

La roadmap demande qu'un modèle écrit avant C1 « **s'ouvre et se rende** correctement après C8 ».
Ce lot en livre exactement une moitié, et il faut le dire, sinon la formulation laisse croire à une
preuve visuelle qui n'existe pas.

| Niveau | Preuve | Propriétaire |
| :--- | :--- | :--- |
| **S'ouvre**, disponible maintenant | Le modèle v1 est migré, validé, parcouru ; ses chemins sont collectés ; sa boucle, son alias, sa condition et sa liaison sont **évalués** sur un jeu de données explicite avec le résultat attendu. | `@openview/core`, **C9** |
| **Se rend**, disponible plus tard | La même fixture, migrée par `parseTemplate`, rejoint le corpus de documents figés et produit le PDF de référence attendu. | `@openview/engine`, **E7** |

La frontière est écrite dans les deux roadmaps. Elle ne réduit pas la promesse : elle nomme qui la
tient, et quand.

---

## La matrice des versions livrées

La nomenclature distingue volontairement la **version du document** du **lot qui la rend
courante** : un document v4 porte les capacités de C3 ; c'est l'étape `4 -> 5`, livrée par C4, qui
le convertit. Les tests raisonnent sur les versions, jamais sur le nom ou la date d'un lot.

| Version | Capacité que cette version porte déjà | Étape suivante | Nature de l'étape |
| :--- | :--- | :--- | :--- |
| 1 | texte, image, conteneur, boucle, condition, six kinds d'expression | `1 -> 2` | estampille |
| 2 | formules et agrégations | `2 -> 3` | estampille |
| 3 | arrondi déclaré par le modèle | `3 -> 4` | estampille |
| 4 | tableau, colonnes, lignes, groupes de lignes | `4 -> 5` | **transformante** |
| 5 | page, bandes, marqueurs de page | `5 -> 6` | estampille |
| 6 | apparence des boîtes et du texte | `6 -> 7` | estampille |
| 7 | écritures de langue, nombres, dates et monnaies | `7 -> 8` | estampille |
| 8 | préférence `keepTogether` | — | version courante |

**Une seule étape transforme une donnée à ce jour, et c'est `4 -> 5`.** Elle écrit une page de
compatibilité lorsque le document n'en déclare aucune. Toutes les autres estampillent, et une
estampille n'est pas une migration fantôme : elle est *tout* ce qui produit
`TemplateMigrationError: … written by a newer release of Openview; upgrade before opening it.`
au lieu d'un `ZodError` illisible sur un chemin de discriminant.

---

## Les décisions

### D1 — Aucune version 9, et la chaîne officielle sort octet pour octet

`TemplateSchema` est inchangé, les sept fonctions de `TEMPLATE_MIGRATIONS` sont inchangées, aucun
document v8 ne devient illisible pour un build v8 antérieur. Seul le **runner autour** du tableau
est durci.

### D2 — Huit fixtures brutes, jamais typées comme le contrat courant

Chaque fixture est une donnée : son `schemaVersion` est un littéral historique, elle n'est ni
annotée `Template` ni construite par un builder courant, et elle ne porte aucun champ apparu après
sa version.

L'annotation est précisément ce qu'il fallait interdire : typer un document v1 comme `Template`
ferait ajouter par le compilateur les champs d'aujourd'hui à un document d'hier — la substitution
même que ces fixtures existent pour détecter.

Le format retenu est **TypeScript, dans le dossier de test**, et non JSON. Un fichier JSON importé
aurait obligé soit à toucher la configuration TypeScript, soit à introduire une lecture Node dans
un paquet volontairement isomorphe. La fixture TypeScript offre la même indépendance, à la seule
condition — tenue — de ne jamais la typer.

### D3 — La matrice est fermée, et son vocabulaire appartient à la fixture

| Fixture | Capacité témoin | Champs futurs vérifiés absents |
| :--- | :--- | :--- |
| v1 | conteneur, texte littéral **et** liaison, boucle avec alias, condition, chemins fournis par l'hôte | `page`, tableau, apparence, `presentations`, `keepTogether` |
| v2 | une agrégation `sum` sur un produit arithmétique, en position imprimable | `page`, tableau, `round`, apparence, `presentations`, `keepTogether` |
| v3 | un `round` complet, mode et décimales déclarés | `page`, tableau, apparence, `presentations`, `keepTogether` |
| v4 | un tableau câblé de bout en bout : colonne, groupe répété, cellule liée | `page`, apparence, `presentations`, `keepTogether` |
| v5 | une page rédigée par l'auteur, une bande de pied et deux `pageField` | apparence, `presentations`, `keepTogether` |
| v6 | une boîte, une typographie et un alignement | `presentations`, `keepTogether` |
| v7 | deux écritures nommées, chacune avec locale, monnaie, bornes et style de date | `keepTogether` |
| v8 | deux blocs frères, un seul portant `keepTogether: true` | — |

Les chemins de données emploient un vocabulaire neutre — un objet `payload`, une collection
`entries` — choisi **par la fixture**. C9 ne réserve aucun nom de facture, de client, de ligne ou
de montant, et n'ajoute aucun schéma au jeu de données de l'intégrateur.

### D4 — L'oracle porte sur le document entier, pas sur l'estampille

Pour chaque fixture, la forme complète après conversion est comparée. L'attendu est **dérivé du
document source** — toutes ses clés, plus la page de compatibilité si et seulement si la fixture
n'en déclare aucune, plus l'estampille courante — ce qui rend l'assertion sensible dans les deux
sens : une clé perdue et une clé inventée échouent toutes deux.

Trois contrôles complètent la comparaison sérialisable, parce qu'elle est aveugle à trois choses :

- **l'identité** des objets, pour la page de compatibilité (voir D8) ;
- **la propriété propre**, pour distinguer une clé absente d'une clé présente à `undefined` — un
  aller-retour JSON efface la seconde des deux côtés ;
- **les jetons de capacité**, balayés en profondeur sur la source *et* sur le résultat.

Le balayage de jetons ne collecte les clés que des objets **discriminés** (porteurs d'un `type` ou
d'un `kind`), plus les clés du document lui-même. C'est ce qui empêche de confondre l'`align` d'une
colonne de tableau — contrat C3 — avec l'`align` d'un nœud de texte, contrat C5. Les deux
s'écrivent pareil et n'appartiennent pas à la même version.

### D5 — Le sens du modèle v1 est rejoué, sans renderer de test

Après `parseTemplate`, la fixture v1 est vérifiée par les seules opérations publiques déjà
disponibles : `collectTemplateDataPaths`, `walk`, `visitSegment`, `evaluateSequence`, `childScope`,
`evaluatePredicate` et `evaluateExpression`.

Le test compose un petit résultat sémantique explicite — deux lignes imprimées — et le compare.
Il couvre le chemin racine vers la collection, l'itération sur deux éléments, l'alias local
distinct du chemin racine, la branche vraie **et** la branche fausse sur deux éléments différents,
l'ordre du texte fixe et de la valeur liée, la liste exacte des chemins statiques et l'ordre exact
des identifiants visités.

Il ne lit ni horloge, ni fuseau, ni locale système, ni variable d'environnement : le jeu de données
est écrit dans la fixture.

Un point mérite d'être nommé, parce qu'il est le cœur de l'ADR 0002 : les chemins collectés sont
`payload.title` et `payload.entries`, **et rien d'autre**. `entry.status` et `entry.label` sont
enracinés sur l'alias de boucle, donc locaux ; ils ne sont pas demandés à l'application hôte.

### D6 — La topologie est vérifiée une fois, et sans liste périssable

Un test unique possède la chaîne complète et vérifie sept propriétés : origine à la version
initiale, ordre strictement croissant, pas unitaire, couture exacte entre deux entrées
consécutives, absence de doublon sur `from` comme sur `to`, terminaison à `CURRENT_SCHEMA_VERSION`,
et longueur cohérente avec les deux bornes.

L'attendu est **dérivé** des deux bornes, jamais recopié sous la forme `[1, 2, 3, 4, 5, 6, 7]`.
La liste littérale qu'un lot précédent maintenait à la main a été supprimée : elle obligeait chaque
lot persistant à éditer un fichier de plus, et elle était recopiée dans un sous-système qui n'en
était pas propriétaire.

Un huitième test ferme le corpus contre la chaîne : les versions des fixtures doivent former la
suite complète de la version initiale à la version courante. Un lot qui bumpe la version sans
ajouter sa fixture échoue là.

**Les tests par sous-système gardent leur assertion locale** — « la chaîne contient `6 -> 7` » pour
les écritures — parce qu'une **version d'introduction** ne change jamais. Ce qui a été retiré, ce
sont les copies de la **fin** de la chaîne.

### D7 — Une étape doit produire exactement le `to` qu'elle annonce

C'est le seul changement de production du lot.

Le runner conserve la possibilité publique de recevoir une chaîne injectée, et ne lui impose pas la
topologie unitaire du registre officiel : un appelant peut fournir un convertisseur direct
`1 -> 5`. Le resserrement porte sur la **véracité**, pas sur la taille du pas — une étape qui
annonce `to: n` doit produire `schemaVersion: n`.

Quatre sorties sont désormais refusées avec `invalid-migration-result` : la sortie qui reste à
`from`, celle qui recule, celle qui s'arrête avant `to`, et celle qui dépasse `to`. La sortie qui
perd `schemaVersion` l'était déjà.

**Les deux gardes coexistent, et ce n'est pas une redondance.** Le contrôle d'égalité seul ne
garantit plus la terminaison : une étape déclarant honnêtement `from: 1, to: 1` satisferait
l'égalité, puis serait sélectionnée à nouveau au tour suivant — une boucle infinie. C'est le
contrôle de progression, préexistant, qui l'interdit, et un test le couvre explicitement.

Ce resserrement est **correctif, et il est comportemental** : un appelant qui déclarait `1 -> 2` en
produisant volontairement 8 exploitait un contrat incohérent, et son code est désormais refusé.
Un convertisseur direct reste possible ; il doit annoncer sa vraie destination.

Aucun diagnostic nouveau n'a été créé : `invalid-migration-result` existait, sa phrase publique
— « *An upgrade step failed to produce a usable later schema version. Its upgrade chain is
faulty.* » — couvre le cas sans être retouchée, et la façade C8 le reconnaît sans modification.
Le message **technique** de l'erreur nomme l'étape déclarée et la version réellement produite ; il
ne contient aucune valeur du modèle, ce qu'un test vérifie.

### D8 — La conversion officielle est pure, rejouable et sérialisable

Cinq propriétés sont épinglées sur les huit fixtures : ni `migrateToCurrent` ni `parseTemplate` ne
modifie l'objet historique reçu ; deux conversions du même document donnent deux résultats
structurellement égaux ; convertir un résultat déjà courant est idempotent ; sérialiser, relire et
parser rend la même forme ; et **deux documents distincts ne partagent pas leur page de
compatibilité**, ni son `sheet`, ni ses deux tableaux de bandes.

Cette dernière n'est pas théorique. `migrateToCurrent` est publique et rend un
`Record<string, unknown>` : `readonly` est effacé à cette frontière, et rien n'empêche un appelant
de normaliser l'objet qu'on lui a remis. Avec une page écrite par référence, un `parseTemplate`
ultérieur et sans rapport aurait rendu la page mutée. `toStrictEqual` est aveugle à cela : les
assertions sont donc sur l'**identité**.

C9 ne promet pas de rendre pure une fonction de migration **fournie par l'appelant**. Celle-ci
reste du code de confiance, et ses erreurs traversent intactes selon la politique C8 — un test le
vérifie au niveau du runner, un autre au niveau de la façade.

### D9 — Les tests sont rangés par responsabilité

Le fichier monolithique de 796 lignes est réparti sous `packages/core/src/template/__tests__/` :

| Fichier | Responsabilité exclusive |
| :--- | :--- |
| `parse-template.test.ts` | frontière `parseTemplate`, bornage avant et après migration, validation courante, refus d'une entrée future |
| `migration-runner.test.ts` | chaîne injectée, version absente, étape absente, progression, respect de `to`, erreurs typées |
| `compatibility-fixtures.ts` | huit documents historiques, leurs attentes, la page de compatibilité épinglée, le jeu de données v1 |
| `compatibility.test.ts` | topologie officielle, huit conversions exactes, rejeu sémantique v1, pureté, idempotence, portée publique |

Le déplacement a été fait **à comportement identique**, vérifié par comparaison des noms de
scénarios avant et après : 39 avant, 39 après, identiques au caractère près. Les nouveaux cas ont
été ajoutés ensuite.

Les commentaires déplacés ont été traduits en anglais et condensés conformément à `AGENTS.md` §1.6
— sans numéro de lot, sans historique de brouillon, sans dump de mesure. Les démonstrations
longues vivent ici et dans le plan.

`compatibility-fixtures.ts` n'est pas un fichier de test : il est instrumenté par la couverture et
compilé dans `dist/`. Les deux règles héritées de `ast/__tests__/fixtures.ts` s'appliquent — aucune
fabrique exportée non appelée, aucun import de `vitest`.

### D10 — C9 est l'unique propriétaire de la compatibilité transversale

Deux assertions ont quitté la recette C8 : le contrôle littéral de la version 8 avec la liste
`[1..7]`, et un mini-test v1 dont l'oracle se limitait à « la migration atteint la version
courante » — qu'un document vide aurait satisfait alors qu'une boucle perdue serait passée.

La preuve C9 est strictement plus forte : elle compare le document entier et rejoue son sens.
Ce qui reste dans la recette C8, c'est ce qui lui appartient réellement — la politique de la donnée
absente, confirmée et non préemptée.

### D11 — Aucun schéma historique de production

Ni `TemplateV1Schema`, ni union `StoredTemplateV1 | … | StoredTemplateV8`, ni huit types publics.
La chaîne migre d'abord puis valide **une seule** forme courante ; dupliquer les anciens schémas
créerait huit sources de vérité et rendrait chaque futur ajout huit fois plus coûteux.

Les fixtures sont des **preuves**, pas une seconde API de parsing. `parseTemplate` reste l'unique
frontière persistable ; `TemplateSchema.parse(raw)` reste une validation du format courant, jamais
une porte de migration. Un test épingle négativement les trois noms qu'une dérive introduirait.

---

## Le protocole imposé aux évolutions futures

Tout lot qui touche une forme persistée — y compris un champ **optionnel** ou un membre d'union
supplémentaire — suit ces neuf étapes :

1. **Identifier** que l'évolution touche une forme stockée. Un champ optionnel en fait partie :
   `z.object` **supprime** les clés qu'il ne connaît pas, donc un build antérieur efface le champ
   sans erreur, et un `onSave` persiste la perte.
2. **Incrémenter `CURRENT_SCHEMA_VERSION` une seule fois**, après la dernière forme du lot.
3. **Ajouter l'étape officielle** depuis l'ancienne version, dans le **même état publiable**.
4. **Décider explicitement** si l'étape estampille seulement ou transforme une donnée, et l'écrire.
5. **Ajouter une fixture minimale** estampillée à la nouvelle version, portant la capacité
   introduite et aucune autre.
6. **Ajouter l'oracle** qui prouve la conservation des versions précédentes.
7. **Conserver** le test local du sous-système sur sa **version d'introduction**, qui ne changera
   jamais.
8. **Jouer les quatre portes** dans l'ordre exact de la CI.
9. **Consigner** la décision et les preuves d'ablation dans l'ADR du lot.

> **La règle qui n'admet pas d'exception :** un lot persistant ne laisse jamais sur la branche
> principale un état sachant écrire la forme nouvelle avec l'ancienne estampille. Les incréments
> internes peuvent exister ; le premier état **publiable** contient ensemble la forme, la version,
> la migration et sa fixture.

### Ce que le protocole ne prétend pas automatiser

Le filet devient fort **après** que la version a été incrémentée. Détecter qu'un champ nouvellement
ajouté *aurait dû* provoquer ce bump reste une **revue humaine**, et le dire est la moitié de
l'honnêteté de ce lot.

Ni TypeScript, ni Zod, ni Vitest ne sait comparer l'intention d'un schéma à l'état de la branche de
référence sans un mécanisme de diff dédié. C9 n'ajoute donc **ni** fingerprint fragile des internes
de Zod, **ni** snapshot géant qu'un `--update` rendrait vert, **ni** modification de CI — que le
mandat de `AGENTS.md` §7 interdit sans demande explicite.

La protection réelle est à trois niveaux :

| Niveau | Ce qu'il attrape | Ce qu'il laisse passer |
| :--- | :--- | :--- |
| `AGENTS.md` §1.2 | l'obligation de bumper et de migrer, en revue | ce que la revue ne voit pas |
| Tests du sous-système | la forme nouvelle et sa version d'introduction | l'oubli du bump lui-même |
| **Topologie C9** | toute chaîne incomplète, fusionnée ou discontinue **une fois la version bumpée** | l'oubli du bump lui-même |

Un futur mandat explicite pourrait ajouter une comparaison de schéma avec la branche de référence.
Ce lot ne contourne pas la limite par un artifice fragile.

---

## Ce que le lot mesure

| Mesure | Avant C9 | Après C9 |
| :--- | :--- | :--- |
| `CURRENT_SCHEMA_VERSION` | 8 | **8** |
| Entrées de `TEMPLATE_MIGRATIONS` | 7 | **7** |
| Valeurs du barrel public | 133 | **133** |
| Tests du dépôt | 845 | **907** |
| Fichiers de test | 28 | **30** |
| Tests de migration (fichier unique) | 39 en 796 lignes | **102** en quatre fichiers |
| Fixtures historiques | 0 | **8** |
| Couverture `core` (stmts / branches / fonctions / lignes) | 99,69 / 98,91 / 100 / 99,68 | **99,70 / 98,91 / 100 / 99,69** |
| Dépendances | inchangées | **inchangées** |

Le nombre total de tests n'est pas un contrat. Aucun test n'a été supprimé pour maintenir un
compte ; les deux retirés de la recette C8 l'ont été parce qu'une preuve strictement plus forte les
remplace, et le déplacement des 39 scénarios a été contrôlé nom par nom.

---

## Les preuves d'ablation

Huit mutations temporaires ont été jouées, chacune restaurée immédiatement et vérifiée par
`git diff`. Une ADR qui n'annonce que des tests verts ne prouve rien : ce tableau dit ce qui
**rougit**, et par quel test. Les comptes sont mesurés sur la suite de `@openview/core`, **906**
tests au vert.

| Mutation temporaire | Résultat observé |
| :--- | :--- |
| Retirer l'étape `4 -> 5` | **41 rouges.** Topologie rompue, et les fixtures v1 à v4 échouent toutes sur `No migration registered from schema version 4` |
| Rendre la page de compatibilité **partielle** (`footer` retiré) | **Porte 3 (type-check)** : `TS2741: Property 'footer' is missing … but required in type 'PageSetup'` — l'annotation de production suffit, aucun test n'est même atteint |
| Changer une **valeur** de la page (`top: 20` → `15`), ce qui compile | **9 rouges** : les quatre oracles de fixture sans page, les deux clés `page` vides, et les deux contrôles d'identité |
| Faire produire **3** à l'étape officielle déclarée `1 -> 2` | **15 rouges**, sur `TemplateMigrationError: Migration 1 -> 2 produced schemaVersion 3; a step must produce exactly the version it declares.` |
| Faire perdre sa boucle à la fixture v1 pendant la migration | **7 rouges** : l'oracle du document complet, la liste des chemins, l'ordre de visite, le rejeu sémantique et l'alias |
| Inventer `presentations: {}` dans l'étape `6 -> 7` | **17 rouges** : les six oracles de v1 à v6 et les contrôles d'absence de v1 à v6 |
| Écrire `keepTogether: undefined` sur la racine en `7 -> 8` | **10 rouges** : les contrôles de propriété propre et le balayage de jetons — **l'oracle sérialisable, lui, reste vert**, ce qui est précisément la raison d'être des deux autres |
| Bumper la version à **9** sans huitième étape | **76 rouges** : topologie, fermeture du corpus, et toute preuve qui part sous la version courante |

La sixième et la septième ligne portent l'enseignement le plus utile du lot : **une comparaison
JSON ne suffit pas**. `JSON.stringify` efface une clé de valeur `undefined` des deux côtés, si bien
qu'une étape écrivant `keepTogether: undefined` sur chaque nœud aurait laissé l'oracle vert pendant
que la clé traversait le parse, partait dans un `onSave` et coûtait une valeur du budget `maxNodes`
par nœud.

---

## Conséquences

### Pour `@openview/engine`

Le lot **E7** reçoit un scénario nommé : la fixture historique v1, migrée par `parseTemplate`,
rejoint le corpus de documents figés et produit le PDF de référence attendu. C'est là — et
seulement là — que le mot « **se rend** » de la roadmap sera tenu.

Si le moteur change sa représentation intermédiaire, la fixture stockée ne bouge pas ; seul
l'adaptateur de test E7 évolue. C'est tout l'intérêt d'une fixture qui n'est typée par rien.

### Pour `@openview/designer` et `@openview/viewer`

Aucune conséquence. Ils n'ouvrent pas de document stocké aujourd'hui, et le jour où l'éditeur
enregistrera, c'est `parseTemplate` qu'il appellera — inchangé, même signature, mêmes codes.

### Pour l'intégrateur

Une seule chose change en pratique, et seulement pour qui **injecte** sa propre chaîne : une étape
doit désormais annoncer la version qu'elle produit. Le registre officiel le faisait déjà ; un
convertisseur maison qui mentait sur sa destination est refusé, avec un code typé et un message qui
nomme l'étape.

### Pour la vague 1 de `core`

Elle est **close**, sans version 9 et sans moteur. Les neuf lots C1 à C9 ont livré le contrat de
modèle ; la suite appartient au moteur (vague E) et au catalogue de données de l'intégrateur
(C10, qui dépend de J3).

---

## Ce que l'exécution a corrigé du plan

Quatre points où le plan s'est révélé incomplet ou imprécis à l'exécution. Ils sont nommés ici
parce que c'est cette ADR qui fait foi.

1. **Le plan attribuait à `compatibility-fixtures.ts` les seules huit fixtures.** À l'exécution, le
   littéral courant partagé (`validTemplate`, `authoredPage`) est nécessaire aux **trois** fichiers
   de test ; le triplique aurait été une duplication franche. Il vit donc dans le même module, dont
   la responsabilité est énoncée comme « le corpus historique **et** la référence courante à
   laquelle il est mesuré ».
2. **Le plan décrivait le contrôle de `to` comme un remplacement du contrôle de progression.** Il
   ne peut pas l'être : une étape déclarant honnêtement `from: n, to: n` satisferait l'égalité et
   ferait boucler le runner à l'infini. Les **deux** gardes sont conservées, et un test couvre le
   cas que le plan n'avait pas vu.
3. **Le plan traitait les « champs futurs absents » comme un balayage de clés.** `align` s'écrit
   pareil sur une colonne de tableau (C3) et sur un nœud de texte (C5) : un balayage plat rendrait
   la fixture v4 rouge à tort. Le balayage ne collecte donc les clés que des objets **discriminés**,
   plus celles du document lui-même.
4. **Le plan annonçait la comparaison complète comme suffisante** pour prouver qu'aucune capacité
   future n'est inventée. L'ablation `keepTogether: undefined` montre que non : l'oracle
   sérialisable reste vert. Les contrôles de propriété propre et le balayage de jetons ne sont pas
   des ceintures et bretelles, ce sont les seuls qui attrapent ce cas.

---

## Ce qui reste ouvert

- **La détection de l'oubli du bump.** Nommée, non résolue, et non contournée. Elle demanderait une
  comparaison de schéma avec la branche de référence, donc un mandat explicite sur la CI.
- **La preuve visuelle.** E7, avec le même modèle historique.
- **La fixture v1 n'est pas un schéma v1.** Elle est un témoin relu contre les décisions des
  [ADR 0001](0001-expression-language.md) et [ADR 0002](0002-data-binding-and-loop-scope.md). C9 ne
  garantit pas qu'un objet arbitraire estampillé 1 était valide dans toutes les versions
  intermédiaires ; il garantit que **ce** modèle de référence, valide avant C1, reste accepté et
  conserve son sens.
- **Une fixture par version n'est pas une duplication de tous les tests.** Chaque sous-système garde
  ses tests exhaustifs ; le corpus C9 choisit un témoin représentatif afin de vérifier la
  **composition** de la chaîne. Ajouter toutes les bornes de tous les schémas ferait de C9 une
  seconde suite complète, plus coûteuse et moins précise que les originales.
- **La page A4 historique reste assumée.** C9 ne rouvre pas la décision C4 : 210 × 297 mm et 20 mm
  de marges sont une donnée de compatibilité écrite une fois — pas une lecture de la machine, pas
  le défaut des nouveaux modèles. Le corpus l'épingle pour qu'un futur nettoyage ne la change pas
  en silence.
