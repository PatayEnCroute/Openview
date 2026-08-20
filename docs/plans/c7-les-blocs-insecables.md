# Plan d'implémentation — `@openview/core` lot C7 : les blocs insécables

> **Document d'implémentation.** Il décrit le contrat, le découpage, les fichiers, les tests et
> l'ordre de livraison du lot. Il n'implémente rien. Une fois C7 livré, l'ADR 0009 fera foi et ce
> plan deviendra périmé.
>
> **Statut : 🟡 CONTRAT C7 PRÊT ; EXÉCUTION BLOQUÉE JUSQU'À LA CLÔTURE DE C6 ET À LA
> RÉCONCILIATION DU NUMÉRO DE VERSION.** Aucune décision propre au contrat C7 ne reste ouverte.
>
> **Précondition :** C6 doit être livré avec `CURRENT_SCHEMA_VERSION = 7` et
> `docs/adr/0008-langue-devise-et-formats.md`. Le plan C6 et l'ADR 0008 ne doivent plus réserver
> littéralement la version 8 à E4 : cette évolution différée prend la prochaine version disponible
> au moment de sa livraison. Tant que C6 ou son ADR promettent encore `7 -> 8` à E4, l'exécution de
> C7 s'arrête avant toute modification. Si une autre évolution prend entre-temps la version 8 ou
> l'ADR 0009, l'exécution s'arrête également afin de réattribuer sans collision les deux numéros.
>
> **Date :** 2026-08-20 · **Brique :** `@openview/core`, vague 1 · **Jalon visé :** J1

---

## 0. Le cadre : `core` déclare une intention, le moteur décide une coupe

La [roadmap du contrat](../roadmap/core.md#c7-les-blocs-insécables) demande qu'un modèle puisse
marquer un bloc comme insécable et qu'un moteur puisse lire cette distinction. La
[roadmap moteur](../roadmap/engine.md#e3-les-exigences-comptables) attribue à E3 le comportement
effectif : déplacer le bloc, choisir la page et, si aucune page ne peut le contenir, progresser sans
boucle.

C7 ne mesure donc aucune hauteur, ne construit aucune page et ne choisit aucun point de coupe. Il
ajoute un fait persistant dans l'AST : **l'auteur souhaite garder une occurrence de nœud sur une
seule page lorsqu'elle peut tenir sur une page admissible**.

| Responsabilité | Propriétaire |
| :--- | :--- |
| Déclarer l'intention d'insécabilité | `@openview/core`, C7 |
| Valider et migrer la forme stockée | `@openview/core`, C7 |
| Mesurer le contenu après liaison des données | `@openview/engine`, E2/E3 |
| Reporter, appliquer le repli ordinaire et garantir la terminaison | `@openview/engine`, E3 |
| Restituer la coupe effectivement choisie | `@openview/engine`, E5 |
| Éditer la marque avec undo/redo | `@openview/designer`, lot d'édition ultérieur |

Cette séparation interdit dans C7 un mini-paginateur, une dépendance DOM, une mesure de fonte, un
port de rendu ou un champ de résultat moteur.

---

## 1. État actuel et écart à combler

### 1.1 Le contrat possède huit nœuds, mais aucune politique de fragmentation

Après C3, l'AST distingue six nœuds de flux et deux nœuds propres aux tableaux :

1. `TextNode` ;
2. `ImageNode` ;
3. `ContainerNode` ;
4. `LoopNode` ;
5. `ConditionNode` ;
6. `TableNode` ;
7. `TableRowNode` ;
8. `TableRowGroupNode`.

Ils forment `DocumentNode`. Leur base commune ne porte aujourd'hui que `id`, et aucun de leurs huit
schémas Zod ne conserve une politique de fragmentation. Un champ inconnu serait supprimé par Zod :
un appelant peut écrire une intention dans son objet brut, puis la perdre au parsing sans erreur.

### 1.2 Les lots précédents ont réservé la place sans la remplir

- L'[ADR 0005](../adr/0005-le-tableau-de-lignes.md) a donné un identifiant aux lignes et groupes de
  lignes afin qu'un moteur et un éditeur puissent les désigner, mais a refusé d'inventer la
  pagination dans C3.
- L'[ADR 0006](../adr/0006-la-page.md) a décrit la feuille et les zones imprimables, puis a laissé
  explicitement l'insécabilité à C7.
- L'[ADR 0007](../adr/0007-l-apparence.md) a séparé l'apparence de la politique de coupe :
  `keepTogether` n'est ni un style CSS stocké, ni un attribut de boîte.
- C6 est indépendant de cette politique. Il doit néanmoins être livré avant C7 afin que les
  numéros persistants restent séquentiels et que l'ADR 0008 soit déjà attribuée.

### 1.3 Pourquoi C7 dépend de C4 sans importer `page/`

L'insécabilité n'a de sens que par rapport à une page, d'où la dépendance produit envers C4. Elle ne
requiert toutefois aucun type de `page/` dans l'AST : le modèle déclare une préférence locale sur un
nœud, tandis que le moteur confronte plus tard cette préférence à `Template.page` et à la hauteur
mesurée.

Le résultat attendu est donc un changement de forme dans `ast/` et de version dans `template/`, sans
nouveau couplage interne entre ces dossiers.

---

## 2. Décisions de contrat

### D1 — Une marque positive et canonique : `keepTogether?: true | undefined`

La base commune devient conceptuellement :

```ts
interface NodeBase {
  readonly id: string;
  readonly keepTogether?: true | undefined;
}
```

Le schéma réutilisé par les huit objets est :

```ts
const keepTogetherField = z.literal(true).optional();
```

Les règles sont fermées :

- `keepTogether: true` demande de conserver l'occurrence sur une page ;
- l'absence de la clé autorise la fragmentation, mais ne l'ordonne jamais ;
- `false`, `null`, `0`, une chaîne ou un objet sont invalides ;
- un `undefined` explicite reste accepté par le type strict et disparaît lors d'une sérialisation
  JSON, de sorte que la forme persistée canonique reste l'absence.

Un booléen ordinaire est écarté parce qu'il donnerait deux écritures persistées au même sens : clé
absente et `false`. Une énumération (`allow | avoid`) et un objet `pagination` sont écartés parce que
C7 ne livre qu'une capacité et ne doit pas réserver le vocabulaire des politiques futures.

### D2 — La marque appartient aux huit `DocumentNode`

Le champ vit sur `NodeBase`, donc sur les huit interfaces exportées. Les huit schémas restent
néanmoins explicites : `ast/schemas.ts` n'a pas de schéma de base partagé et chacun des huit
`z.object` doit déclarer `keepTogether: keepTogetherField`.

| Nœud | Sujet de la marque |
| :--- | :--- |
| `TextNode` | les lignes composées de ce bloc de texte |
| `ImageNode` | l'occurrence de l'image ; tant que l'image est atomique, la contrainte est satisfaite trivialement et son éventuel surdimensionnement reste régi par E1/E2 |
| `ContainerNode` | l'ensemble du contenu rendu par ce conteneur |
| `LoopNode` | chaque itération matérialisée, indépendamment des autres |
| `ConditionNode` | la séquence rendue lorsque la condition est vraie ; aucune occurrence lorsqu'elle est fausse |
| `TableNode` | le tableau matérialisé, sections comprises |
| `TableRowNode` | chaque occurrence de la ligne, y compris dans un groupe répété |
| `TableRowGroupNode` | les lignes produites par une itération du groupe |

La marque ne vit pas directement sur `TextSegment`, `TableCell`, `TableColumn`, `PageBand`,
`PageSetup`, `Template` ou une table externe d'identifiants. Deux réutilisations de
`ContainerNode` doivent néanmoins être nommées : `Template.root` peut porter la marque sur tout le
flux principal, et `PageBand.content` ainsi que ses descendants peuvent la porter structurellement.
Une bande étant déjà atomique entre deux pages, cette dernière marque est satisfaite tant que la
bande tient ; elle ne modifie ni sa mesure ni son mode d'échec. Une table externe demanderait une
unicité globale des ids que le contrat ne garantit pas et séparerait la politique du nœud qu'elle
qualifie.

### D3 — Les nœuds répétés sont traités par occurrence matérialisée

Une marque sur une déclaration répétable ne lie pas toutes ses sorties en un bloc géant :

- `LoopNode.keepTogether` s'applique séparément au groupe de blocs produit par chaque élément de
  `each` ;
- `TableRowGroupNode.keepTogether` s'applique séparément au groupe de lignes produit par chaque
  élément de `each` ;
- `TableRowNode.keepTogether` s'applique à chaque ligne matérialisée.

C7 ne fixe aucune représentation de l'identité d'exécution. La paire `(id, rang local)` ne suffit
pas sous des boucles imbriquées et les ids ne sont pas globalement uniques. E5 choisira une identité
qui conserve au minimum toute l'ascendance d'itération nécessaire pour distinguer deux occurrences.

Garder toutes les itérations d'une boucle ensemble reste exprimable en plaçant la boucle dans un
`ContainerNode` marqué. Cette composition distingue donc « chaque occurrence » de « toute la
séquence » sans second champ.

### D4 — Une marque imbriquée n'efface jamais les marques descendantes

Le moteur essaie d'abord de respecter le nœud marqué le plus englobant. Si ce nœud est trop grand et
doit employer son repli ordinaire, ses descendants marqués restent des contraintes actives :

- un tableau trop grand peut être coupé entre des lignes ;
- une ligne descendante marquée reste entière si elle tient sur une page neuve ;
- seule une occurrence elle-même trop grande déclenche son propre repli.

Deux nœuds frères ne deviennent jamais un groupe par juxtaposition. `keepTogether` porte sur
l'intérieur d'une occurrence, pas sur sa relation avec la suivante.

### D5 — La politique moteur est ordonnée et garantit la terminaison

Après liaison des données, résolution des styles et mesure, E3 applique cet ordre à chaque
occurrence marquée du flux principal :

1. **Page courante :** si l'occurrence tient dans l'espace restant, elle y est placée entière.
2. **Page neuve admissible :** sinon, si elle tient dans l'aire disponible d'une prochaine page
   compatible avec les bandes déclarées, elle y est reportée entière.
3. **Repli ordinaire :** si elle ne peut tenir sur aucune page neuve applicable, la préférence C7
   cesse de bloquer le placement et le moteur applique la politique ordinaire du kind. Un contenu
   fragmentable est coupé de manière déterministe ; une ressource atomique conserve le comportement
   de placement ou de refus attribué à E1/E2.

Cette troisième branche est un choix explicite : `keepTogether` n'ajoute pas un nouveau mode d'échec
et ne laisse pas le paginateur reporter éternellement le même bloc. Elle n'oblige toutefois pas un
kind atomique à devenir fragmentable. C7 n'ajoute dans `core` ni erreur, ni avertissement, ni
diagnostic persistant. E5 pourra rendre le repli observable dans son résultat de pagination sans
nouveau champ C7.

Une bande de page n'entre pas dans cet ordre : elle n'est jamais reportée comme un bloc du flux.
Conformément à l'ADR 0006, si son contenu mesuré dépasse la zone imprimable, le moteur refuse
proprement plutôt que de la couper ou de boucler. Une marque portée par son `ContainerNode` ne
neutralise ni ne remplace cette règle.

Les documents vivants qui promettent aujourd'hui des blocs « jamais coupés » devront être qualifiés
lors de la livraison : **jamais coupés lorsqu'ils peuvent tenir sur une page neuve admissible ;
sinon soumis au repli ordinaire de leur kind, sans boucle**.

### D6 — L'absence permet, elle ne commande pas

Un moteur conserve le droit de garder entier un nœud sans marque. Il peut notamment décider qu'une
image ou une ligne courte est atomique par nature. C7 distingue donc :

- une contrainte explicite que le moteur doit tenter d'honorer ;
- l'absence de contrainte, qui laisse les règles ordinaires décider.

Le test de recette ne cherchera pas à forcer une coupe du nœud non marqué. Il vérifiera que le moteur
peut lire `true` pour l'un et l'absence pour l'autre sans heuristique.

### D7 — C7 n'introduit aucune relation entre voisins

Restent hors périmètre :

- `keepWithNext` et `keepWithPrevious` ;
- veuves et orphelines ;
- saut avant/après et saut manuel ;
- répétition effective d'un en-tête de tableau ;
- report de page et point de coupe ;
- nombre minimal de lignes avant ou après une coupure ;
- priorité ou niveau numérique de la contrainte.

L'exigence « un tableau ne commence pas sans son en-tête » appartient à E2. Elle ne doit pas être
réécrite indirectement comme une relation C7 entre une ligne d'en-tête et la première ligne du
corps.

### D8 — Version 8, migration d'estampille seule

C6 livre la version 7. C7 ajoute ensuite un champ optionnel sur les huit formes de nœud et porte
`CURRENT_SCHEMA_VERSION` à **8**.

La migration `7 -> 8` est :

```ts
migrate: (input) => ({ ...input, schemaVersion: 8 })
```

Elle ne traverse pas l'AST et n'invente aucune marque. Un document v7 signifie naturellement que
ses nœuds ne déclarent aucune contrainte C7.

L'estampille est obligatoire malgré l'optionalité : un build v7 qui ouvrirait un document portant
`keepTogether` supprimerait la clé inconnue et pourrait persister la perte. Avec la version 8, ce
même build refuse le document comme écrit par une version plus récente.

Le plan C6 attribue encore littéralement `7 -> 8` à E4. Cette écriture décrit le coût d'une
évolution future ; elle ne peut pas réserver un numéro indépendamment de l'ordre réel de livraison.
Avant C7, le plan C6 et l'ADR 0008 doivent donc exprimer ce coût comme **version courante -> version
suivante**, ou acter explicitement que C7 prend la version 8 et qu'E4 prendra la version 9. Puisque
la roadmap place C7 avant E4, l'ordre attendu est **C7 : 7 -> 8**, puis **E4 : 8 -> 9**. Si E4 ou
une autre évolution persistée est livrée avant C7, le contrôle du §8 arrête ce plan et réattribue la
version au lieu de créer une lacune ou deux migrations concurrentes.

### D9 — Aucun nouveau symbole public ni parcours

La surface publique change par élargissement des interfaces de nœud déjà exportées. Aucun symbole
supplémentaire n'est nécessaire :

- pas de type `KeepTogether`, puisque le type exact est le littéral `true` ;
- pas de helper `isKeptTogether`, puisque `node.keepTogether === true` suffit ;
- pas de nouveau barrel ou export dans `index.ts` ;
- pas de nouveau kind, donc aucun changement du Visitor ;
- aucune expression et aucune donnée lue, donc aucun changement de `nodeReads` ou de
  `collectDataPaths` ;
- aucune profondeur supplémentaire ; une marque présente compte néanmoins une valeur de plus pour
  `ShapeLimits.maxNodes`, comme tout champ stocké. L'ADR mesure ce coût et le défaut du garde reste
  inchangé ;
- aucun code ou site d'erreur nouveau : C8 reste propriétaire des messages compréhensibles.

### D10 — Les commentaires de code restent courts ; l'ADR porte l'arbitrage

L'implémentation suit [AGENTS.md §1.6](../../AGENTS.md) :

- tous les commentaires JSDoc et inline ajoutés ou modifiés dans les fichiers TypeScript, tests
  compris, sont rédigés en **anglais** ;
- JSDoc et commentaires inline de **1 à 5 lignes** ;
- aucun numéro de lot, hash, historique de brouillon, métrique ou plaidoyer dans un fichier
  TypeScript ;
- la JSDoc de `NodeBase` décrit uniquement, en anglais, le sens de la marque et de son absence ;
- la documentation historique de `CURRENT_SCHEMA_VERSION` n'est pas prolongée par un nouveau
  journal de version : la règle de bump reste concise, en anglais, et les raisons de la version 8
  vivent dans l'ADR 0009 ;
- la nouvelle entrée de migration reçoit au plus un court commentaire anglais `Stamp only.` ; les
  preuves de perte silencieuse vivent dans les tests et l'ADR.

Le lot ne lance pas un nettoyage général des anciens commentaires. Il remet en conformité les
déclarations qu'il modifie et n'étend pas la dette documentaire ailleurs.

---

## 3. Fichiers de la future implémentation

### 3.1 Production

| Fichier | Modification prévue |
| :--- | :--- |
| [`packages/core/src/ast/types.ts`](../../packages/core/src/ast/types.ts) | Ajouter le champ à `NodeBase` et documenter son invariant en quelques lignes anglaises. |
| [`packages/core/src/ast/schemas.ts`](../../packages/core/src/ast/schemas.ts) | Définir `keepTogetherField` une fois et l'inscrire dans les huit schémas de nœud. |
| [`packages/core/src/template/template.ts`](../../packages/core/src/template/template.ts) | Passer la version courante de 7 à 8 et conserver une JSDoc concise renvoyant à l'ADR 0009. |
| [`packages/core/src/template/migrate.ts`](../../packages/core/src/template/migrate.ts) | Ajouter l'unique étape 7→8, sans parcours ni transformation de l'AST. |

### 3.2 Tests

| Fichier | Modification prévue |
| :--- | :--- |
| [`packages/core/src/ast/__tests__/nodes.test.ts`](../../packages/core/src/ast/__tests__/nodes.test.ts) | Étendre la preuve type/schéma et ajouter les tests positifs, négatifs et canoniques des huit kinds. |
| [`packages/core/src/ast/__tests__/visitor.test.ts`](../../packages/core/src/ast/__tests__/visitor.test.ts) | Prouver que la marque ne change ni le parcours, ni la recherche, ni les lectures de données. |
| [`packages/core/src/page/__tests__/page.test.ts`](../../packages/core/src/page/__tests__/page.test.ts) | Prouver qu'une marque portée par le conteneur d'une bande est acceptée et conservée sans créer de politique propre à `PageBand`. |
| [`packages/core/src/template/__tests__/paths.test.ts`](../../packages/core/src/template/__tests__/paths.test.ts) | Prouver que la marque ne change pas les chemins collectés dans le flux ou les bandes. |
| [`packages/core/src/template/migrate.test.ts`](../../packages/core/src/template/migrate.test.ts) | Étendre la chaîne à 8 et prouver l'estampille seule, la conservation du champ et la migration depuis v1. |

Aucune nouvelle fixture partagée n'est nécessaire : le modèle de recette C7 tient dans le test AST
et ne doit pas gonfler `RECIPE_TEMPLATE`, dont les parcours et comptes servent déjà d'autres lots.

### 3.3 Documentation à livrer avec C7

| Fichier | Modification prévue |
| :--- | :--- |
| `docs/adr/0009-les-blocs-insecables.md` | Consigner D1 à D10, les alternatives rejetées et les obligations E3/E5. |
| [`docs/roadmap/core.md`](../roadmap/core.md) | Marquer C7 livré, relier l'ADR, remplacer « un autre comme sécable » par « un autre laissé sans contrainte de fragmentation », puis qualifier le critère de recette par le repli du bloc trop grand. |
| [`docs/roadmap/engine.md`](../roadmap/engine.md) | Relier E3 à l'ordre de traitement, au repli par kind et au maintien du refus propre d'une bande impossible. |
| [`README.md`](../../README.md) et [`docs/roadmap/README.md`](../roadmap/README.md) | Qualifier la promesse absolue « jamais coupés » par la capacité à tenir et par le repli documenté des contenus impossibles. |
| ADR 0005, 0006 et 0007 | Ajouter les liens de complément/amendement vers l'ADR 0009 ; préciser que l'exécution des politiques de coupe reste au moteur, tandis qu'une future déclaration persistée de voisinage exigerait un nouveau lot `core` et une version. |
| Ce plan | Passer le statut à « périmé — C7 livré » et pointer vers l'ADR 0009. |

### 3.4 Fichiers explicitement inchangés

- `packages/core/src/index.ts` et `packages/core/src/ast/nodes.ts` : aucun symbole nouveau à
  exporter ;
- `packages/core/src/ast/visitor.ts` : aucun kind ni enfant nouveau ;
- `packages/core/src/template/paths.ts` et `guard.ts` : aucune lecture ni profondeur nouvelle ; le
  coût d'une valeur par marque présente est mesuré sans modifier les limites ;
- `packages/core/src/errors.ts` : aucun code ou site d'erreur ;
- `packages/core/src/page/types.ts`, `schemas.ts`, `page.ts` et les ports : aucune mesure ou
  interface de rendu ; seul le test de réutilisation du `ContainerNode` dans une bande évolue ;
- `packages/engine/**`, `packages/designer/**`, `packages/viewer/**` et le playground : C7 décrit,
  il ne rend ni n'édite encore ;
- `package.json`, `pnpm-workspace.yaml`, les `tsconfig`, Biome, Turbo, Sonar et les workflows : zéro
  dépendance et zéro modification d'outillage ;
- les fichiers d'implémentation C6 : aucune reprise, aucun renommage, aucune suppression ; la
  réconciliation documentaire du numéro futur d'E4 est une précondition déjà satisfaite avant C7,
  pas une modification mêlée à son implémentation.

---

## 4. Découpage en deux incréments

### INC-0 — Contrat AST et pérennité · état atomique publiable

**Contenu :**

- ajout du champ TypeScript à `NodeBase` ;
- ajout du champ aux huit schémas Zod ;
- tests type/schéma et tests de parsing sur les huit kinds ;
- preuve de conservation dans le conteneur d'une bande, sans politique `PageBand` nouvelle ;
- invariance des parcours, recherches et lectures de données ;
- refus des valeurs non canoniques ;
- mise en conformité anglaise et concise des commentaires directement touchés ;
- `CURRENT_SCHEMA_VERSION` 7→8 ;
- entrée de migration 7→8 ;
- mise à jour des attentes de chaîne ;
- preuve JSON de l'estampille seule ;
- conservation d'un `keepTogether: true` déjà présent sur un document sous-estampillé ;
- migration complète v1→v8.

**Critère de sortie :** les tests AST, page, chemins et migrations passent ; une mutation retirant
le champ de `NodeBase`, élargissant son type à `boolean`, ou retirant le champ d'un seul des huit
schémas est détectée. La forme persistée, la version 8 et la migration 7→8 appartiennent au **même
commit** : INC-0 ne crée aucun état intermédiaire enregistré, publiable ou bisectable, qui sache
écrire la nouvelle forme sous l'ancienne estampille.

### INC-1 — ADR, roadmaps et clôture · lot complet

**Contenu :**

- ADR 0009 ;
- qualification des promesses « jamais coupés » par le repli du kind et le cas distinct des bandes ;
- remplacement du faux marquage « comme sécable » par l'absence de contrainte de fragmentation ;
- liens depuis les ADR antérieures et les roadmaps ;
- C7 marqué livré ;
- présent plan marqué périmé.

**Critère de sortie :** aucun document vivant ne promet une insécabilité absolue pour un bloc plus
grand qu'une page neuve, et aucune responsabilité E2/E3 n'est déplacée dans `core`.

---

## 5. Plan de test complet

### 5.1 Cohérence TypeScript ↔ Zod sur les huit kinds

Conserver ou étendre les huit assertions de clés dans `nodes.test.ts` :

- `TEXT_NODE_KEYS_IN_STEP` ;
- `IMAGE_NODE_KEYS_IN_STEP` ;
- `CONTAINER_NODE_KEYS_IN_STEP` ;
- `LOOP_NODE_KEYS_IN_STEP` ;
- `CONDITION_NODE_KEYS_IN_STEP` ;
- `TABLE_NODE_KEYS_IN_STEP` ;
- `TABLE_ROW_KEYS_IN_STEP` ;
- `TABLE_ROW_GROUP_KEYS_IN_STEP`.

Chaque assertion compare `keyof z.infer<typeof Schema>` avec `keyof Interface`. Ajouter le champ à
un seul côté doit faire échouer `type-check` ; aucune assertion reposant sur un `expect(true)`
tautologique n'est admise.

Ajouter en plus une preuve dédiée au **type de la valeur**, que la comparaison des clés ne voit pas :

```ts
export const KEEP_TOGETHER_TYPE_IN_STEP: MutuallyAssignable<
  z.infer<typeof TextNodeSchema>['keepTogether'],
  TextNode['keepTogether']
> = true;
```

Cette assertion interdit notamment d'élargir silencieusement le contrat TypeScript à `boolean`
alors que Zod continue de n'accepter que `true`. Une seule paire suffit : les huit interfaces
héritent de `NodeBase` et les huit schémas réutilisent `keepTogetherField`. Les assertions de clés
restent nécessaires pour prouver que chacun des huit schémas inscrit effectivement le champ.

### 5.2 Acceptation et aller-retour des huit kinds

Pour chaque kind, construire la plus petite valeur valide portant `keepTogether: true`, la parser
par son schéma public ou par `DocumentNodeSchema`, puis vérifier :

- le parsing réussit ;
- la propriété vaut le littéral `true` ;
- le JSON obtenu conserve la clé ;
- les autres champs restent inchangés.

Le cas `table` doit rester valide sous `checkTableWiring`. Les cas `tableRow` et
`tableRowGroup` passent par `DocumentNodeSchema`, tout en restant interdits dans un `BlockNode` nu.

### 5.3 Refus des formes non canoniques

Sur un `TextNode` minimal, puis au moins sur un nœud de tableau pour couvrir l'autre famille de
schémas, refuser :

- `keepTogether: false` ;
- `keepTogether: null` ;
- `keepTogether: 'true'` ;
- `keepTogether: 1` ;
- `keepTogether: { value: true }`.

Chaque erreur doit viser le chemin `keepTogether`. C7 ne fige pas le texte utilisateur final : C8
reste propriétaire de sa présentation.

### 5.4 Absence canonique

Parser un nœud sans la clé et vérifier que sa sérialisation JSON n'en crée aucune. L'absence est le
comportement de compatibilité de tous les documents v7 et antérieurs.

Un objet TypeScript portant explicitement `keepTogether: undefined` doit sérialiser la même forme
JSON que l'objet sans clé. Le test porte sur la persistance, pas sur l'ordre des propriétés de
l'objet en mémoire.

Mesurer aussi la charge brute avant et après ajout de la marque : chaque `true` présent ajoute une
valeur à `ShapeLimits.maxNodes` et aucun niveau à `maxDepth`. Cette mesure vit dans l'ADR 0009 ; elle
ne justifie ni relèvement du défaut, ni test spécifique du garde, dont le comptage de propriétés est
déjà couvert.

### 5.5 Critère de recette de C7

Construire un `Template` minimal dont la racine contient deux `ContainerNode` frères :

- `totaux`, avec `keepTogether: true` ;
- `details`, sans la clé.

Après `parseTemplate`, vérifier qu'un consommateur peut lire directement `true` sur le premier et
l'absence sur le second. Aucun helper, registre d'id ou connaissance du contenu ne doit être
nécessaire.

Ajouter dans `page.test.ts` une bande minimale dont `content.keepTogether` vaut `true`, puis vérifier
que `PageSetupSchema` accepte et conserve la marque. Ce test prouve la réutilisation structurelle du
`ContainerNode` ; il ne donne aucune politique de fragmentation à `PageBand`.

Ces tests ne forcent pas une pagination : aucun moteur n'existe encore dans le périmètre C7.

### 5.6 Invariance des parcours et des lectures

Comparer une arborescence marquée avec la même arborescence non marquée :

- `walk` rend les mêmes ids dans le même ordre ;
- `findNodeById` trouve les mêmes ids et les mêmes kinds ;
- `collectDataPaths` et `collectTemplateDataPaths` rendent les mêmes chemins ;
- `nodeReads` ne gagne aucune expression.

Ces assertions protègent la frontière : une politique de page ne devient ni un enfant, ni une
donnée de l'intégrateur. Les trois premières fonctions de nœud et `collectDataPaths` sont couvertes
dans `visitor.test.ts` ; la collecte au niveau du template, bandes comprises, l'est dans
`template/__tests__/paths.test.ts`.

### 5.7 Migration et compatibilité

Les tests de migration couvrent au minimum :

1. la chaîne contient exactement les étapes 1→2, 2→3, …, 7→8 ;
2. le nombre d'étapes reste `CURRENT_SCHEMA_VERSION - 1` ;
3. un template v7 sans marque ressort v8, identique après restauration de l'estampille 7 ;
4. un template v7 sous-estampillé mais portant déjà une marque la conserve en v8 ;
5. un template v1 traverse toute la chaîne et reste valide ;
6. un template v8 marqué est accepté sans migration ;
7. une version supérieure à 8 produit le refus typé existant pour build trop ancien ;
8. supprimer l'étape 7→8 fait rougir les tests qui traversent la chaîne.

### 5.8 Contrats différés au moteur E1/E2/E3

L'ADR 0009 transmet six scénarios, non simulés dans `core` :

1. l'occurrence tient dans le reste de la page courante et n'est pas déplacée ;
2. elle ne tient plus mais tient sur une page neuve et est reportée entière ;
3. elle dépasse toute page neuve et, si son kind est fragmentable, le repli ordinaire la coupe de
   façon déterministe ;
4. un parent trop grand emploie son repli, mais une marque descendante encore satisfaisable reste
   honorée ;
5. une image atomique surdimensionnée suit la politique de placement ou de refus d'E1/E2 sans être
   rendue artificiellement fragmentable et sans boucle ;
6. une marque dans une bande ne change pas l'atomicité de la bande : une bande trop grande conserve
   le refus propre exigé par l'ADR 0006.

E3 devra également couvrir les occurrences répétées et vérifier qu'une boucle marquée ne rassemble
pas toutes ses itérations en une seule contrainte. E5 choisira une identité d'occurrence capable de
représenter les boucles imbriquées sans supposer les ids globalement uniques.

### 5.9 Quatre portes

La validation finale s'exécute dans l'ordre exact de la CI :

```bash
pnpm run lint && pnpm run build && pnpm run type-check && pnpm run test:coverage
```

Les quatre métriques de couverture restent à au moins 90 %. Aucun seuil, fichier de configuration ou
workflow n'est modifié pour obtenir ce résultat.

---

## 6. Définition de fini

C7 est livré lorsque toutes les affirmations suivantes sont vraies :

- les huit `DocumentNode` acceptent et conservent `keepTogether: true` ;
- aucune autre valeur persistée n'est admise ;
- l'absence reste la forme des documents antérieurs et signifie seulement « coupe permise » ;
- les répétitions ont une sémantique par occurrence ;
- aucune forme d'identité d'exécution insuffisante n'est figée par C7 ;
- le repli ordinaire d'un parent ne neutralise pas les marques descendantes ;
- une marque dans une bande ne remplace ni son atomicité ni son refus propre si elle est impossible ;
- un kind atomique n'est pas rendu artificiellement fragmentable ;
- aucun mécanisme de voisinage ou de pagination E2/E3 n'entre dans `core` ;
- la version courante vaut 8 et l'étape 7→8 n'effectue qu'une estampille ;
- aucun export, kind, code d'erreur, parcours ou dépendance inutile n'est ajouté ;
- l'ADR 0009 porte les arbitrages et les commentaires TypeScript touchés restent concis et anglais ;
- l'ADR mesure une valeur brute supplémentaire par marque présente et aucune limite de forme ne
  change sans nécessité ;
- les promesses documentaires absolues sont qualifiées par le cas du bloc trop grand ;
- la roadmap ne prétend plus qu'un second bloc est « marqué comme sécable » : elle décrit
  explicitement un bloc laissé sans contrainte de fragmentation ;
- les quatre portes passent dans l'ordre imposé.

---

## 7. Hypothèses et limites

- C6 est livré avant C7 avec la version 7 et l'ADR 0008.
- La décision différée d'E4 est exprimée comme une incrémentation de la version disponible, sans
  réservation concurrente de la version 8.
- C7 ne garantit aucun pixel et ne peut pas démontrer le comportement moteur avant E3.
- Une ressource atomique, comme une image, satisfait la marque sans traitement particulier tant
  qu'elle tient ; son surdimensionnement reste une politique E1/E2 indépendante de C7.
- Une page « admissible » est déterminée par la pagination et les bandes de C4 ; C7 n'ajoute pas de
  notion concurrente.
- Le repli du bloc trop grand est assumé : les kinds fragmentables progressent en coupant ; les
  contenus atomiques ou les bandes conservent leur politique ordinaire et ne bouclent jamais.
- L'absence de diagnostic propre à C7 est volontaire. Le repli réel deviendra observable dans le
  résultat du moteur avec E5 ; un refus atomique ou de bande reste propriétaire d'E1/E2/E3.
- Aucun nom de donnée, règle comptable, horloge, locale système, fuseau ou aléa n'entre dans ce lot.

---

## 8. Contrôle de périmètre avant exécution

Avant d'ouvrir INC-0 :

1. vérifier que C6 est effectivement livré et que la branche de travail est propre hors changements
   explicitement attribués à C7 ;
2. vérifier `CURRENT_SCHEMA_VERSION === 7` et l'existence de l'ADR 0008 ;
3. vérifier que le plan C6 et l'ADR 0008 ne réservent plus littéralement `7 -> 8` à E4, mais lui
   attribuent la prochaine version disponible ;
4. vérifier que `keepTogether`, `keepWithNext` et une politique équivalente n'ont pas été ajoutés
   entre-temps ;
5. conserver tous les changements utilisateur sans rapport et ne jamais réinitialiser la branche ;
6. arrêter l'exécution si le numéro 8 ou l'ADR 0009 ont déjà été attribués.

Ce contrôle ne change aucune décision : il empêche seulement d'appliquer un plan exact sur une base
qui ne l'est plus.
