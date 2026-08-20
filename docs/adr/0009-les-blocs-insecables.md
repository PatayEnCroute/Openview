# ADR 0009 — Les blocs insécables

- **Statut :** 🟢 **Accepté** (2026-08-20), implémenté dans `@openview/core`
- **Date :** 2026-08-20
- **Impact :** `@openview/core` (**un champ optionnel** sur la base commune des huit nœuds, donc
  **huit sites d'accrochage** et aucun type nouveau ; l'**estampille 8** et sa migration
  d'estampille), `@openview/engine` (**E3** hérite d'une politique **ordonnée** et de sa branche de
  repli ; **E1/E2** héritent du cas de la ressource atomique surdimensionnée ; **E5** hérite du
  choix d'une **identité d'occurrence** capable de représenter les boucles imbriquées),
  `@openview/viewer` (**V3** compare désormais des coupes qu'une déclaration du modèle contraint),
  `@openview/designer` (une case à cocher et sa `Command`, au lot d'édition)
- **Complète :** [ADR 0006](0006-la-page.md), dont la décision 8 a laissé cette place **vide
  délibérément** — « *Livrer `keepTogether` ici préempterait le seul lot que C4 débloque* » — et
  dont l'atomicité d'une bande est **conservée sans exception nouvelle** (D2, D5) ;
  [ADR 0005](0005-le-tableau-de-lignes.md), dont l'identifiant donné aux lignes et aux groupes de
  lignes est ce qui rend la marque **plaçable** là où une facture en a besoin, sans table externe
  d'identifiants ; et [ADR 0007](0007-l-apparence.md), dont la condition 3 du critère
  d'appartenance range `keepTogether` hors de l'apparence — « *c'est cette condition, et non un
  choix de politesse, qui laisse la place de C7 vide* ».
- **Précise le numéro de version que le plan C6 chiffrait.** [ADR 0008](0008-langue-devise-et-formats.md)
  actait « *une seconde estampille à la charge d'E4* », et son plan l'écrivait `7 → 8`. Un plan
  chiffre un **coût**, il ne réserve pas un **numéro** : la roadmap plaçant C7 avant E4, **C7 prend
  `7 → 8`** et le coût d'E4 devient **`8 → 9`**. La réconciliation est portée dans l'ADR 0008 et
  dans son plan, **avant** l'implémentation de ce lot et non mêlée à elle.
- **N'amende aucune règle de gouvernance.** `AGENTS.md` sort du lot **inchangé**, et le contrôle est
  négatif et rejouable. `packages/core/src/errors.ts` sort du lot **octet pour octet** : **zéro code
  d'erreur nouveau, zéro classe nouvelle, zéro site nouveau** — C8 reste propriétaire des messages
  compréhensibles. Même chose pour `ast/visitor.ts`, `ast/nodes.ts`, `template/paths.ts`,
  `template/guard.ts` et `src/index.ts` : une politique de page n'est **ni un nœud, ni une
  expression, ni un symbole public nouveau** (D9).
- **Plan d'implémentation :**
  [docs/plans/c7-les-blocs-insecables.md](../plans/c7-les-blocs-insecables.md) — **périmé** une fois
  le lot livré, comme le dit son propre en-tête. C'est cette ADR qui fait foi, et elle **corrige**
  son plan sur trois points nommés au [§ Ce que l'exécution a corrigé du plan].
- **Implémentation :**
  [`src/ast/types.ts`](../../packages/core/src/ast/types.ts) (le champ sur `NodeBase`, donc sur les
  huit interfaces exportées),
  [`src/ast/schemas.ts`](../../packages/core/src/ast/schemas.ts) (`keepTogetherField`, inscrit dans
  les huit `z.object`),
  [`src/template/template.ts`](../../packages/core/src/template/template.ts) (l'estampille 8),
  [`src/template/migrate.ts`](../../packages/core/src/template/migrate.ts) (l'entrée `7 → 8`)

---

## Contexte

Une exigence comptable ouvre ce lot, et elle tient en une phrase : un cadre de totaux, un bloc de
mentions légales, une adresse **ne se coupent pas en deux entre deux pages**. C'est la troisième
puce du lot moteur [E3](../roadmap/engine.md#e3-les-exigences-comptables), et c'est ce qui sépare
une démonstration d'un document qu'un gestionnaire signe.

Avant ce lot, le contrat n'avait **aucun moyen de le dire**. Les huit nœuds de `DocumentNode`
partageaient une base commune ne portant que `id`, et aucun des huit schémas Zod ne conservait de
politique de fragmentation. La conséquence n'était pas une erreur, c'était une **perte muette** :
un appelant écrivant `keepTogether: true` dans son objet brut voyait la clé **supprimée par
`z.object`** au parsing, sans un mot, et un `onSave` persistait la perte.

Trois lots avaient réservé la place sans la remplir, et chacun l'a écrit :

- **C3** ([ADR 0005](0005-le-tableau-de-lignes.md)) a donné un `id` aux lignes et aux groupes de
  lignes pour qu'un moteur et un éditeur puissent les **désigner**, tout en refusant d'inventer la
  pagination.
- **C4** ([ADR 0006](0006-la-page.md), décision 8) a décrit la feuille et les zones imprimables,
  puis a nommément refusé `keepTogether` : « *le lot suivant a besoin de trouver sa place vide* ».
- **C5** ([ADR 0007](0007-l-apparence.md)) a séparé l'apparence de la politique de coupe : une
  marque de coupe n'est ni un style CSS stocké, ni un attribut de boîte.

Ce lot remplit cette place, et rien de plus.

---

## Le partage des responsabilités, écrit AVANT le champ

C7 **ne mesure aucune hauteur, ne construit aucune page, ne choisit aucun point de coupe.** Il
ajoute un fait persistant dans l'AST : *l'auteur souhaite garder une occurrence de nœud sur une
seule page lorsqu'elle peut tenir sur une page admissible.* Le tableau ci-dessous est la ligne de
partage, et c'est lui qui tranche la plupart des questions de ce lot.

| Responsabilité | Propriétaire |
| :--- | :--- |
| Déclarer l'intention d'insécabilité | `@openview/core`, **C7** |
| Valider et migrer la forme stockée | `@openview/core`, **C7** |
| Mesurer le contenu **après** liaison des données | `@openview/engine`, **E2/E3** |
| Reporter, appliquer le repli ordinaire, garantir la terminaison | `@openview/engine`, **E3** |
| Restituer la coupe effectivement choisie | `@openview/engine`, **E5** |
| Éditer la marque avec undo/redo | `@openview/designer`, lot d'édition |

Cette séparation **interdit dans ce lot** un mini-paginateur, une dépendance DOM, une mesure de
fonte, un port de rendu et un champ de résultat moteur. Aucun des quatre n'a été écrit, et le
contrôle est négatif : `packages/core/src/ports/` sort du lot inchangé.

**Pourquoi C7 dépend de C4 sans importer `page/`.** L'insécabilité n'a de sens que par rapport à une
page, d'où la dépendance produit. Elle ne requiert pourtant **aucun type de `page/` dans l'AST** :
le modèle déclare une préférence **locale** sur un nœud, et c'est le moteur qui confrontera plus
tard cette préférence à `Template.page` et à la hauteur mesurée. Le résultat est un changement de
forme dans `ast/` et de version dans `template/`, **sans couplage interne nouveau** entre ces deux
dossiers.

---

## Les dix décisions

### D1 — Une marque POSITIVE et CANONIQUE : `keepTogether?: true`

La base commune des huit nœuds devient :

```ts
interface NodeBase {
  readonly id: string;
  readonly keepTogether?: true | undefined;
}
```

et le schéma que les huit `z.object` réutilisent est une seule ligne :

```ts
const keepTogetherField = z.literal(true).optional();
```

Les règles sont **fermées** :

- `keepTogether: true` demande de conserver l'occurrence sur une page ;
- l'**absence** de la clé autorise la fragmentation, mais ne l'ordonne jamais (D6) ;
- `false`, `null`, `0`, `'true'` et un objet sont **invalides**, sur le chemin `keepTogether` ;
- un `undefined` **explicite** reste accepté par le type strict et disparaît à la sérialisation
  JSON, de sorte que la forme persistée canonique reste l'**absence**.

**Pourquoi pas un booléen ordinaire — et c'est l'arbitrage central de ce lot.** Il donnerait **deux
écritures persistées pour le même sens** : clé absente, et `false`. Aucun lecteur ne pourrait dire
laquelle l'auteur a voulue, un éditeur écrirait l'une et un moteur lirait l'autre, et le premier
document d'un client figerait l'ambiguïté. Le littéral `true` fait de la canonicité une propriété du
**schéma** plutôt qu'une convention d'équipe : ce n'est pas une austérité de style, c'est le seul
état que Zod refuse d'écrire deux fois.

**Écarté.** (a) Une **énumération** `allow | avoid` — elle réserve le vocabulaire des politiques
futures, alors que ce lot ne livre qu'**une** capacité, et elle rouvre la question du défaut. (b) Un
**objet** `pagination: { keepTogether, keepWithNext, … }` — il préempte D7 et il crée un niveau de
profondeur pour un seul champ. (c) Une **priorité numérique** (`keepTogether: 1..9`) — elle suppose
un algorithme de compromis que personne n'a écrit, et le contrat n'a rien pour dire ce que `3` veut
dire de plus que `2`.

**Réversibilité.** Élargir plus tard `true` en `true | 'avoid'` élargit une union **stockée** : ce
serait le cas *refus illisible* d'`AGENTS.md` §1.2, donc une estampille de plus, et le refus
d'aujourd'hui reste lisible pour cette raison. Rétrécir, en revanche, est impossible dès le premier
document client — ce qui est exactement pourquoi la forme la plus étroite est livrée.

### D2 — La marque appartient aux HUIT `DocumentNode`, et à eux seuls

Le champ vit sur `NodeBase`, donc sur les huit interfaces exportées. Les huit schémas restent
néanmoins **explicites** : `ast/schemas.ts` n'a pas de schéma de base partagé, et chacun des huit
`z.object` déclare `keepTogether: keepTogetherField`. Ce n'est pas une redondance, c'est ce que le
gabarit du fichier impose — et c'est ce que les huit paires `*_KEYS_IN_STEP` vérifient (voir
[§ Ce que le lot mesure]).

| Nœud | Sujet de la marque |
| :--- | :--- |
| `TextNode` | les lignes composées de ce bloc de texte |
| `ImageNode` | l'occurrence de l'image ; une ressource atomique satisfait la marque **trivialement** tant qu'elle tient, et son surdimensionnement reste régi par E1/E2 |
| `ContainerNode` | l'ensemble du contenu rendu par ce conteneur |
| `LoopNode` | **chaque** itération matérialisée, indépendamment des autres (D3) |
| `ConditionNode` | la séquence rendue quand la condition est vraie ; **aucune** occurrence quand elle est fausse |
| `TableNode` | le tableau matérialisé, sections comprises |
| `TableRowNode` | **chaque** occurrence de la ligne, y compris dans un groupe répété |
| `TableRowGroupNode` | les lignes produites par **une** itération du groupe |

La marque ne vit **pas** sur `TextSegment`, `TableCell`, `TableColumn`, `PageBand`, `PageSetup`,
`Template`, ni dans une table externe d'identifiants. Un segment n'est pas une unité de placement,
une cellule n'a pas d'`id` et une colonne n'est pas rendue.

**Deux réutilisations de `ContainerNode` doivent être nommées, parce qu'elles sont gratuites et
qu'aucune ligne de `page/` n'a changé.** `Template.root` **est** un `ContainerNode`, donc la marque
peut porter sur tout le flux principal. `PageBand.content` **est** un `ContainerNode`, donc une
bande et ses descendants peuvent la porter **structurellement**. Une bande étant déjà atomique entre
deux pages, cette dernière marque est **satisfaite tant que la bande tient** : elle ne change **ni
sa mesure, ni son mode d'échec**, et elle ne remplace pas le refus propre qu'exige l'ADR 0006
(D5). C'est mesuré et épinglé par trois `it` dans `page/__tests__/page.test.ts`.

**Écarté : une table externe** `keepTogether: string[]` sur `Template`. Elle demanderait une
**unicité globale des `id`** que le contrat ne garantit pas — l'ADR 0005 ne la promet que dans un
tableau — et elle séparerait la politique du nœud qu'elle qualifie, si bien qu'un copier-coller de
sous-arbre perdrait la marque en silence.

### D3 — Les nœuds répétés sont traités par OCCURRENCE MATÉRIALISÉE

Une marque sur une déclaration répétable **ne lie pas** toutes ses sorties en un bloc géant :

- `LoopNode.keepTogether` s'applique **séparément** au groupe de blocs produit par chaque élément de
  `each` ;
- `TableRowGroupNode.keepTogether` s'applique **séparément** au groupe de lignes produit par chaque
  élément de `each` ;
- `TableRowNode.keepTogether` s'applique à **chaque** ligne matérialisée.

Le sens inverse serait absurde et il faut le dire : une boucle de soixante lignes marquée
« insécable en bloc » sur une facture de trois pages ne pourrait jamais être honorée, et la
préférence tomberait à chaque rendu.

**« Toute la séquence » reste exprimable, sans second champ :** on place la boucle dans un
`ContainerNode` marqué. La composition distingue donc « chaque occurrence » de « toute la séquence »
avec un seul champ — ce qui est la raison pour laquelle aucun `keepAllIterations` n'est livré.

**Ce que C7 ne fixe PAS, et l'aveu est délibéré :** aucune représentation de l'**identité
d'exécution**. La paire `(id, rang local)` **ne suffit pas** sous des boucles imbriquées, et les
`id` ne sont pas globalement uniques. C'est **E5** qui choisira une identité conservant au minimum
toute l'ascendance d'itération nécessaire pour distinguer deux occurrences. Figer ici une identité
insuffisante coûterait plus cher que de ne rien figer.

### D4 — Une marque imbriquée n'efface JAMAIS les marques descendantes

Le moteur essaie d'abord de respecter le nœud marqué **le plus englobant**. Si ce nœud est trop
grand et doit employer son repli ordinaire, ses descendants marqués **restent des contraintes
actives** :

- un tableau trop grand peut être coupé **entre** des lignes ;
- une ligne descendante marquée reste **entière** si elle tient sur une page neuve ;
- seule une occurrence **elle-même** trop grande déclenche son **propre** repli.

C'est la règle qui rend la marque utile sur une facture réelle : un tableau de soixante lignes est
forcément coupé, et ce que l'auteur veut préserver, c'est **la ligne de total** — pas le tableau.

**Deux nœuds frères ne deviennent jamais un groupe par juxtaposition.** `keepTogether` porte sur
l'**intérieur** d'une occurrence, pas sur sa relation avec la suivante. Le voisinage est D7.

### D5 — La politique moteur est ORDONNÉE, et la troisième branche garantit la terminaison

Après liaison des données, résolution des styles et mesure, **E3** applique cet ordre à chaque
occurrence marquée du flux principal :

1. **Page courante** — si l'occurrence tient dans l'espace restant, elle y est placée **entière**.
2. **Page neuve admissible** — sinon, si elle tient dans l'aire disponible d'une prochaine page
   compatible avec les bandes déclarées, elle y est **reportée entière**.
3. **Repli ordinaire** — si elle ne peut tenir sur **aucune** page neuve applicable, la préférence
   C7 **cesse de bloquer le placement** et le moteur applique la politique ordinaire du kind. Un
   contenu fragmentable est coupé de manière **déterministe** ; une ressource atomique conserve le
   comportement de placement ou de refus attribué à E1/E2.

**La troisième branche est un choix explicite, et c'est la décision la plus importante de ce
lot après D1.** Sans elle, `keepTogether` ajouterait un **mode d'échec nouveau** — ou, pire, un
paginateur reportant éternellement le même bloc, c'est-à-dire une **boucle infinie** sur un document
qu'un client a enregistré. Elle n'oblige pas pour autant un kind atomique à devenir fragmentable :
une image ne se coupe pas parce qu'on l'a marquée.

**Conséquence documentaire assumée :** toute promesse absolue de blocs « jamais coupés » doit être
qualifiée — **jamais coupés lorsqu'ils peuvent tenir sur une page neuve admissible ; sinon soumis au
repli ordinaire de leur kind, sans boucle**. Les quatre documents vivants qui la portaient sont
corrigés dans ce lot ([§ Conséquences]).

**Une bande de page n'entre pas dans cet ordre.** Elle n'est jamais reportée comme un bloc du flux.
Conformément à l'ADR 0006, si son contenu mesuré dépasse la zone imprimable, le moteur **refuse
proprement** plutôt que de la couper ou de boucler. Une marque portée par son `ContainerNode` ne
neutralise ni ne remplace cette règle (D2).

**Aucun diagnostic C7.** Ce lot n'ajoute dans `core` ni erreur, ni avertissement, ni champ de
diagnostic persistant. Le repli **réel** deviendra observable dans le résultat de pagination
d'**E5**, sans champ C7 nouveau ; un refus atomique ou de bande reste propriétaire d'E1/E2/E3.

### D6 — L'ABSENCE permet, elle ne commande pas

Un moteur conserve le droit de garder entier un nœud **sans** marque : il peut décider qu'une image
ou une ligne courte est atomique par nature. Le contrat distingue donc **deux états, pas trois** :

- une **contrainte explicite**, que le moteur doit tenter d'honorer ;
- l'**absence** de contrainte, qui laisse les règles ordinaires décider.

C'est ce qui interdit un troisième état `false` (« coupe cette ligne, même si tu n'y es pas obligé »)
que personne n'a demandé, et c'est ce qui rend le critère de recette exact : le test ne cherche pas
à **forcer** une coupe du nœud non marqué, il vérifie qu'un consommateur peut lire `true` pour l'un
et l'absence pour l'autre **sans heuristique**.

### D7 — Aucune relation entre voisins : SEPT refus, écrits

Restent hors périmètre, et pour chacun le motif est le même — ce lot livre **une** capacité, pas le
vocabulaire des politiques de coupe :

| Refusé | Motif | Propriétaire éventuel |
| :--- | :--- | :--- |
| `keepWithNext` / `keepWithPrevious` | une **relation** entre occurrences, pas une propriété de l'une | un lot `core` futur, **et une version** |
| veuves et orphelines | un **seuil** en lignes, donc une mesure de fonte | **E3** |
| saut de page avant / après, saut manuel | son effet **est** la pagination ; déjà refusé nommément par C3 et C4 | un lot `core` futur, **et une version** |
| répétition **effective** d'un en-tête de tableau | l'en-tête est déjà une **section nommée** : le moteur n'a besoin d'aucun drapeau | **E2** |
| report de page et point de coupe | décidés par la mesure | **E3**, restitués par **E5** |
| nombre minimal de lignes avant/après une coupure | même famille que la veuve | **E3** |
| priorité ou niveau numérique de la contrainte | suppose un algorithme de compromis inexistant | personne |

**Un piège nommé, parce qu'il est tentant :** l'exigence « *un tableau ne commence pas sans son
en-tête* » appartient à **E2** et ne doit **pas** être réécrite indirectement comme une relation C7
entre une ligne d'en-tête et la première ligne du corps. Elle serait alors exprimée deux fois, dans
deux briques, avec deux vérités possibles.

**Réversible** — ce sont des champs non écrits.

### D8 — `CURRENT_SCHEMA_VERSION` passe à 8 par une ESTAMPILLE SEULE

L'entrée est d'une ligne, et elle ne traverse pas l'AST :

```ts
{ from: 7, to: 8, migrate: (input) => ({ ...input, schemaVersion: 8 }) }
```

Un document v7 signifie **naturellement** que ses nœuds ne déclarent aucune contrainte C7 : il n'y a
rien à inventer, et rien à convertir.

**L'estampille est obligatoire MALGRÉ l'optionalité, et c'est mesuré dans les deux sens.** Un champ
optionnel ajouté à une forme stockée est le cas **PERTE SILENCIEUSE** d'`AGENTS.md` §1.2 : aucune
union ne s'élargit, donc aucun build antérieur ne rencontre de discriminant inconnu. C'est la classe
**dangereuse** — un build v7 ouvrant un document v8 **supprime la clé sans aucune erreur**, après
quoi un `onSave` persiste la perte et le cadre de totaux se coupe en deux.

| Oubli | Ce qui se passe, **mesuré sur ce dépôt** |
| :--- | :--- |
| l'**entrée** de migration oubliée, estampille posée | ⚡ **bruyant** — **20 tests rouges**, `No migration registered from schema version 7. The upgrade chain to 8 is broken.` |
| l'**estampille** oubliée, champ ajouté aux huit schémas | 🔇 **totalement silencieux** — **683 tests verts, zéro rouge**, les quatre portes à l'exit 0 |

La seconde ligne est la raison d'être de cette décision, et elle a été **exécutée** : le champ posé
sur les huit schémas, `CURRENT_SCHEMA_VERSION` laissé à 7 et aucune entrée enregistrée, la suite
telle qu'elle était avant ce lot passe intégralement. Aucun compilateur, aucun linter, aucun seuil
de couverture ne demande l'incrément.

> **Une migration qui ne transforme rien n'est pas une migration fantôme.** Elle **estampille**, et
> l'estampille est *tout* ce qui produit le message ci-dessus.

**La réserve des sept entrées précédentes transpose mot pour mot :** le garde de version lit
l'**estampille**, pas le contenu. Un document estampillé `7` portant **déjà** une marque — fait à la
main, ou écrit par un build de mi-lot non estampillé — **n'est pas refusé** : il parse et ressort en
`schemaVersion: 8` **en gardant sa marque**. C'est un `it` dédié.

**Le numéro, et pourquoi il n'était pas libre par accident.** Le plan C6 chiffrait à `7 → 8` le coût
de l'attente `E4-1`. Un plan chiffre un coût, il ne réserve pas un numéro : la roadmap plaçant C7
avant E4, C7 prend `7 → 8` et E4 prendra `8 → 9`. La réconciliation a été portée dans l'ADR 0008 et
son plan **avant** l'implémentation, comme une précondition, et non mêlée à elle.

### D9 — Aucun symbole public nouveau, aucun parcours nouveau

La surface publique change par **élargissement des interfaces déjà exportées**. Rien d'autre n'est
nécessaire, et chaque abstention a un motif :

- **pas de type `KeepTogether`** — le type exact est le littéral `true` ; un alias n'ajouterait
  qu'un nom à maintenir ;
- **pas de helper `isKeptTogether`** — `node.keepTogether === true` suffit, et un helper pour une
  comparaison est de la cérémonie qu'`AGENTS.md` §3 refuse nommément ;
- **pas de barrel ni d'export nouveau** dans `index.ts` : le compte du barrel reste à **126
  valeurs**, mesuré par émission ESM réelle et épinglé par un `it` existant ;
- **pas de kind nouveau**, donc **aucun changement du Visitor** — ni membre de `NodeVisitor`, ni
  `case`, ni branche de `childrenOf` ;
- **aucune expression, aucune donnée lue**, donc `nodeReads`, `collectDataPaths` et
  `collectTemplateDataPaths` sont inchangés — et l'invariance est **assertée** plutôt que supposée
  (voir [§ Ce que le lot mesure]) ;
- **aucune profondeur supplémentaire** : une marque présente compte **une valeur de plus** pour
  `ShapeLimits.maxNodes`, comme tout champ stocké, et **aucun niveau** pour `maxDepth`. Mesuré sur
  `RECIPE_TEMPLATE` — le modèle de recette de `ast/__tests__/fixtures.ts`, que ce lot ne marque pas,
  les deux marques étant posées sur une copie : **321 → 323 valeurs pour deux marques**, profondeur
  **18 → 18**. Le défaut du
  garde (100 000 valeurs, 64 niveaux) reste **inchangé** : deux marques par nœud sur un document de
  50 000 valeurs ne l'approchent pas ;
- **aucun code ni site d'erreur nouveau** : C8 reste propriétaire des messages compréhensibles, et
  ce lot ne fige donc **pas** le texte lu par un utilisateur final. Ce qu'il fige est le **chemin**
  de l'issue, `keepTogether`, qui est ce dont C8 aura besoin.

### D10 — Les commentaires de code restent courts ; l'ADR porte l'arbitrage

L'implémentation suit [AGENTS.md §1.6](../../AGENTS.md) : tout commentaire ajouté ou modifié dans un
fichier TypeScript, **tests compris**, est en **anglais**, tient en **1 à 5 lignes** pour un JSDoc,
et ne porte **ni** numéro de lot, **ni** hachage, **ni** historique de brouillon, **ni** dépôt de
métriques, **ni** majuscules de plaidoirie.

Concrètement : la JSDoc de `NodeBase` décrit **uniquement** le sens de la marque, celui de son
absence, et renvoie ici ; la documentation de `CURRENT_SCHEMA_VERSION` n'est **pas prolongée par un
journal de version** — sa ligne « Version 7 adds … » est **remplacée**, pas accumulée ; l'entrée de
migration porte un commentaire de deux lignes. Les preuves de perte silencieuse, les comptes de
mutations et les mesures vivent dans les tests et dans cette ADR.

**Ce lot ne lance pas un nettoyage général des anciens commentaires.** Il remet en conformité les
déclarations qu'il modifie et n'étend pas la dette documentaire ailleurs. Les longues JSDoc
antérieures de `ast/__tests__/nodes.test.ts` sortent donc du lot telles quelles, sauf celles que la
livraison touche.

---

## Ce que le lot mesure

Un lot qui ajoute **un champ optionnel** est celui où il est le plus facile de croire qu'on a livré
quelque chose. Les quatre mutations ci-dessous ont été exécutées sur le dépôt, une par une, et
chacune est **détectée** — c'est le critère de sortie d'`INC-0`, et il est rejouable.

| Mutation | Porte qui l'attrape | Ce qu'elle rend |
| :--- | :--- | :--- |
| le champ **retiré de `NodeBase`** | **3** (`type-check`) | **8 × `TS2322`** sur les huit paires `*_KEYS_IN_STEP` de nœud, plus des `TS2339` là où les tests lisent la propriété |
| le champ **élargi à `boolean`** | **3** | **exactement une** `TS2322`, sur `KEEP_TOGETHER_TYPE_IN_STEP` — et les huit paires de clés restent **vertes**, ce qui est précisément pourquoi cette neuvième assertion existe |
| le champ **retiré d'UN SEUL des huit schémas** | **3** et **4** | `TS2322` sur la paire du kind concerné, **et** un test rouge : `expected undefined to be true` |
| l'entrée **`7 → 8` retirée**, estampille conservée | **4** | **20 tests rouges**, `No migration registered from schema version 7` |

La deuxième ligne est la seule qui n'était pas déjà outillée avant ce lot. Les huit paires
`*_KEYS_IN_STEP` comparent des **ensembles de clés** : élargir l'interface à `boolean` alors que Zod
n'accepte que `true` les laisse toutes vertes, et un `false` qu'un éditeur écrirait serait ensuite
supprimé au parsing suivant. `KEEP_TOGETHER_TYPE_IN_STEP` compare le **type de la valeur**, et une
seule paire suffit : les huit interfaces héritent le champ de `NodeBase` et les huit schémas
partagent `keepTogetherField`.

**L'invariance des parcours est assertée, pas supposée.** Une arborescence portant les huit kinds est
écrite **une fois**, par une fabrique paramétrée par la marque, puis produite marquée et non
marquée. Ce qui est comparé :

- `walk` rend les **mêmes `id` dans le même ordre**, et les mêmes `type` ;
- `childrenOf` rend les mêmes enfants pour chaque nœud, et `findNodeById` les mêmes kinds ;
- `nodeReads` est **strictement égal**, nœud par nœud ;
- `collectDataPaths` et `collectTemplateDataPaths` rendent les **mêmes chemins**, flux et bandes
  comprises.

Ces assertions protègent les deux frontières que ce lot pouvait franchir sans le vouloir : une
politique de page ne devient **ni un enfant** de l'arbre, **ni une donnée** que l'intégrateur doit
fournir.

**Le compte.** 684 tests avant le lot, **713 après** — dix-huit blocs `it` neufs, dont deux
`it.each` qui couvrent les huit kinds et les cinq écritures refusées. Couverture inchangée à
**99,66 % / 99,58 % / 100 % / 99,65 %**, au-dessus du seuil de 90 % sur les quatre métriques.
Aucun seuil, aucun fichier de configuration, aucun workflow n'a été modifié.

**Les quatre portes, dans l'ordre exact de la CI :**

```bash
pnpm run lint && pnpm run build && pnpm run type-check && pnpm run test:coverage
```

---

## Conséquences

### Attentes envers `@openview/engine` — six scénarios, non simulés dans `core`

C7 ne peut démontrer aucun comportement moteur : aucun moteur n'existe dans son périmètre. Les six
scénarios ci-dessous sont donc transmis, et ils sont la contrepartie exacte de D4, D5 et D6.

| # | Scénario | Attendu | Propriétaire |
| :-- | :--- | :--- | :--- |
| **E3-1** | l'occurrence tient dans le reste de la page courante | elle n'est **pas déplacée** | **E3** |
| **E3-2** | elle ne tient plus, mais tient sur une page neuve | **reportée entière** | **E3** |
| **E3-3** | elle dépasse toute page neuve et son kind est fragmentable | le repli ordinaire la coupe **de façon déterministe**, sans boucle | **E3** |
| **E3-4** | un **parent** trop grand emploie son repli | une marque **descendante** encore satisfaisable reste **honorée** | **E3** |
| **E1/E2-5** | une image atomique **surdimensionnée** | politique de placement ou de refus d'E1/E2, **sans** la rendre artificiellement fragmentable et **sans** boucle | **E1/E2** |
| **E3-6** | une marque **dans une bande** | l'atomicité de la bande est **inchangée** : une bande trop grande conserve le **refus propre** exigé par l'ADR 0006 | **E3** |

Deux obligations s'ajoutent, et ce sont les seules dettes que ce lot crée :

- **E3** doit couvrir les **occurrences répétées** et vérifier qu'une boucle marquée ne rassemble
  **pas** toutes ses itérations en une seule contrainte (D3) ;
- **E5** doit choisir une **identité d'occurrence** capable de représenter les boucles imbriquées
  **sans supposer les `id` globalement uniques**. C7 s'est abstenu de la figer parce qu'une identité
  insuffisante serait plus coûteuse que pas d'identité du tout.

### Pour `@openview/viewer`

V3 compare des coupes — c'est la promesse d'aperçu identique au PDF. Une marque **contraint** ces
coupes, ce qui rend la comparaison plus facile là où elle est honorée, et **strictement identique**
là où la branche 3 s'applique : le repli doit être déterministe **dans les deux moteurs**, sans quoi
un bloc trop grand se coupe à un endroit dans l'aperçu et à un autre dans le PDF.

### Pour `@openview/designer`

Une case à cocher par bloc, et sa `Command` avec `undo()`. Rien de plus : il n'y a **ni valeur par
défaut à proposer**, ni troisième état à afficher (D6), ni message à composer (D9). L'éditeur écrit
`keepTogether: true` ou **retire la clé** — jamais `false`.

### Pour C8 et C9

**C8** hérite d'un **chemin d'issue** stable, `keepTogether`, et d'aucun message : la présentation
du refus lui appartient, et ce lot ne fige pas le texte que lira un non-développeur. **C9** est tenu
dans le même mouvement que le champ — l'estampille et la migration appartiennent au **même commit**
que la forme persistée, de sorte qu'il n'existe aucun état enregistré, publiable ou bisectable
sachant écrire la nouvelle forme sous l'ancienne estampille.

### Les quatre promesses documentaires qualifiées

La branche 3 de D5 rend fausse toute promesse **absolue**. Les quatre documents vivants qui la
portaient sont corrigés dans ce lot, et le mot ajouté est toujours le même — *quand ils peuvent
tenir* :

- [`README.md`](../../README.md) et [`docs/roadmap/README.md`](../roadmap/README.md) — « blocs qui
  ne se coupent jamais » ;
- [`docs/roadmap/engine.md`](../roadmap/engine.md) — la troisième puce d'E3, qui reçoit en outre
  l'ordre de traitement, le repli par kind et le maintien du refus propre d'une bande impossible ;
- [`docs/roadmap/core.md`](../roadmap/core.md) — le critère de recette de C7, qui **prétendait qu'un
  second bloc est « marqué comme sécable »**. Aucun marquage de ce genre n'existe, et il n'en
  existera pas : le critère décrit désormais un bloc **laissé sans contrainte de fragmentation**.

Cette dernière correction n'est pas cosmétique. Un critère de recette demandant de « marquer un bloc
comme sécable » exigeait le booléen que D1 refuse, et un exécutant l'ayant lu littéralement aurait
livré la forme à deux écritures.

---

## Ce qui reste ouvert

**Une seule question, et elle n'est attribuée à personne : le voisinage.** « L'adresse ne se sépare
pas de la mention qui la suit » n'est pas exprimable, et D7 le refuse en connaissance de cause. Le
jour où le besoin se présentera, il coûtera un **champ de relation** sur une forme stockée, donc un
lot `core` et une **version** — la classe la moins chère du dépôt, mais pas gratuite. Rien ne
l'appelle aujourd'hui, et rien n'est réservé pour lui : pas de nom de champ, pas d'objet
`pagination`, pas d'énumération à élargir.

---

## Ce que l'exécution a corrigé du plan

Le plan a été appliqué tel quel sur le **contrat** — dix décisions, aucune rouverte. Trois écarts
sont apparus à l'exécution, et ils sont écrits ici parce qu'un plan périmé n'est pas un plan
corrigé.

1. **La liste de fichiers du plan (§3.2) est incomplète d'un fichier de test.**
   `presentation/__tests__/presentation.test.ts` — le fichier du lot C6 — épinglait
   `expect(CURRENT_SCHEMA_VERSION).toBe(7)`, la **chaîne complète** des migrations et le message de
   refus avec ses deux nombres **littéraux**. L'estampille 8 en rougit **quatre**, et le plan ne les
   nommait pas. Correction retenue : ce fichier garde **son** pas — la version à partir de laquelle
   un build comprend `presentations` est 7 et le restera —, exprimé par une constante locale et un
   `toContainEqual([6, 7])`, tandis que le **littéral complet de la chaîne** reste dans
   `template/migrate.test.ts`, qui en est le propriétaire. Une même vérité épinglée dans deux
   fichiers est une vérité qu'on corrigera un jour dans un seul.

2. **Deux titres de tests étaient périmés depuis C6, l'assertion ayant été mise à jour sans eux.**
   `stamps a v5 document to 6` affirmait `toBe(7)`. Les deux assertions sont désormais écrites contre
   `CURRENT_SCHEMA_VERSION` et leurs titres disent « to the current version » : elles couvrent du
   même coup toute estampille future, au lieu de devoir être rééditées à chaque lot.

3. **L'illustration de l'ADR 0008 portait deux nombres incohérents avec sa propre phrase.** Le bloc
   de code annonçait « *schema version 8 … at most 7* » sous une phrase décrivant « *un build v6
   ouvrant un document v7* » — les nombres du test, pas ceux de l'exemple. Corrigé en `7` et `6`, et
   accompagné de la note qui empêche de relire ces nombres comme une réservation. Sans cette
   correction, la version 8 aurait paru appartenir à C6.

---

## Le protocole des mesures

Toute mesure de cette ADR est rejouable, et voici comment.

| Mesure | Comment |
| :--- | :--- |
| les quatre mutations | appliquer la mutation, jouer `pnpm run type-check` puis `npx vitest run packages/core/src`, restaurer |
| la perte silencieuse (683 verts) | poser le champ sur les huit schémas, ramener `CURRENT_SCHEMA_VERSION` à 7, retirer l'entrée `7 → 8`, restaurer les six fichiers de test à leur état d'avant le lot, jouer les quatre portes |
| le coût de forme (321 → 323 valeurs, 18 → 18 niveaux) | compter comme `assertBoundedShape` compte — 1 pour la racine, puis chaque valeur de propriété propre — sur une **copie** de `RECIPE_TEMPLATE` avec et sans les deux marques, le modèle de recette lui-même restant non marqué |
| le compte du barrel (126) | `Object.keys` sur l'import ESM réel de `src/index.js`, ce qu'un `it` de `presentation/__tests__/presentation.test.ts` fait déjà |
| les 20 tests rouges de l'entrée manquante | retirer l'entrée `7 → 8` en conservant l'estampille, jouer `npx vitest run packages/core/src` |
