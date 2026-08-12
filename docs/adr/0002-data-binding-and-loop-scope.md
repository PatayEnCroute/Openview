# ADR 0002 — Liaison des données dans les nœuds et portée des boucles

- **Statut :** 🟢 **Accepté — A1 + B1** (2026-08-12), implémentée dans `@openview/core`
- **Date :** 2026-08-12
- **Impact :** `@openview/core` (contrat de données), `@openview/engine` (`DataBindingStep`), `@openview/designer` (édition), `@openview/viewer` (rendu client)
- **Implémentation :** [`src/ast/nodes.ts`](../../packages/core/src/ast/nodes.ts) (segments et
  alias), [`src/expression/evaluate.ts`](../../packages/core/src/expression/evaluate.ts)
  (`childScope`), [`src/ast/visitor.ts`](../../packages/core/src/ast/visitor.ts)
  (`collectDataPaths` sensible aux alias)
- **Prérequis :** [ADR 0001](0001-expression-language.md) — ce document ferme deux
  conséquences de l'option C qui n'y avaient pas été traitées.

---

## Contexte

L'ADR 0001 a tranché **comment une expression est représentée** : un arbre typé,
validé par Zod, jamais une chaîne à parser. Il n'a pas tranché **où** ces
expressions s'accrochent dans le document. Deux trous en découlent, et tous deux
portent sur la forme **persistée** du template.

### Trou 1 — aucun nœud ne peut afficher une donnée

`TextNode.content` est un `string`
([`nodes.ts`](../../packages/core/src/ast/nodes.ts)). Le README, l'ADR 0001 et la
charte du Designer ([`DESIGN.md`](../../packages/designer/DESIGN.md), §6) parlent
tous de `{{ invoice.total }}` comme d'une *notation d'affichage* d'un objet
`Expression` — mais aucun nœud de l'AST ne porte cette liaison.

La preuve est dans le Visiteur : `collectDataPaths` ne visite que `loop` et
`condition` ([`visitor.ts`](../../packages/core/src/ast/visitor.ts)), parce qu'un
nœud texte n'a effectivement rien à collecter. Un template sait aujourd'hui
boucler et masquer des blocs, mais pas imprimer une seule valeur : la fonction
n°1 du produit n'est pas exprimable dans le contrat.

### Trou 2 — une boucle ne nomme pas son élément courant

`LoopNode` porte `each` et `children`, pas d'alias, et `EvaluationScope` est un
`Record` plat sans mécanisme de portée dérivée
([`evaluate.ts`](../../packages/core/src/expression/evaluate.ts)).

Le playground l'écrit noir sur blanc : il appelle
`evaluatePredicate(discountApplies, { line })` en fabriquant lui-même la portée,
avec un alias `line` que le template référence (`line.discount`) mais ne déclare
nulle part ([`App.tsx`](../../apps/playground/src/App.tsx)). `evaluateSequence`
est écrit et testé à 100 %, et personne ne peut consommer ce qu'il retourne.

Conséquence déjà présente, et c'est un bug : `collectDataPaths` renvoie
`line.discount` comme chemin de données requis, alors que `line` est une variable
de boucle et non une clé de l'entrée. Sa docstring promet à l'appelant de lui
dire *quelles clés un template a besoin avant tout rendu* — elle ment. Ce n'est
pas un défaut d'implémentation : c'est un concept manquant au contrat.

### Pourquoi maintenant

`CURRENT_SCHEMA_VERSION` vaut encore `1`, et l'ADR 0001 dit explicitement que
c'est parce que le changement atterrit **avant la première release**. La même
fenêtre est ouverte pour ces deux trous et se referme au premier template
enregistré par un client. La fermer maintenant coûte zéro migration ; la fermer
après l'écriture de `DataBindingStep` coûte une migration **et** une réécriture.

---

## Question A — comment un nœud affiche-t-il une donnée ?

### A1. Le contenu d'un texte devient une suite de segments, *recommandé*

Un `TextNode` reste un bloc (un paragraphe) ; son contenu devient une séquence de
runs, chacun soit littéral, soit une liaison.

```jsonc
{ "type": "text", "id": "t1", "content": [
  { "kind": "literal", "text": "Total dû : " },
  { "kind": "binding", "value": { "kind": "path", "path": "invoice.total" } }
]}
```

- ✅ **Correspond exactement à l'interface d'édition.** Un auteur non-développeur
  tape un paragraphe et y insère une puce de variable au fil du texte. Les
  segments sont le modèle *inline* de cette UI (c'est ainsi que Slate, Lexical et
  ProseMirror modélisent le texte riche) : ce que l'interface manipule est ce qui
  est stocké, comme l'exige l'ADR 0001.
- ✅ **Un paragraphe reste un nœud.** Le rendu produit un élément avec des enfants
  inline ; rien n'a besoin de savoir que des blocs voisins « coulent » ensemble.
- ✅ La porte reste ouverte à des marques (gras, italique) sur un segment littéral :
  un champ optionnel de plus, au prix d'un incrément de `schemaVersion` (voir
  « Ce qui reste ouvert »).
- ❌ Deux concepts au lieu d'un dans le schéma (nœuds *et* segments).
- ❌ Le texte statique le plus simple devient un tableau d'un élément — verbeux à
  écrire à la main, comme tout l'option C de l'ADR 0001.

### A2. Un nouveau nœud feuille `BindingNode`

`TextNode` est inchangé ; on ajoute une feuille `{ type: 'binding', value: Expression }`.

- ✅ Schéma minimal, aucun concept nouveau : le Composite et le Visiteur
  l'absorbent tels quels.
- ⛔ **`"Total dû : "` et la valeur deviennent deux nœuds frères.** Le Composite
  est un arbre de blocs ; rien n'y exprime que deux feuilles doivent s'afficher
  sur la même ligne. Le moteur de rendu et le Designer devraient réinventer une
  notion de flux inline au-dessus d'une structure qui ne la porte pas — c'est la
  source de bugs de mise en page classique.
- ❌ Un paragraphe de facture mêlant trois variables devient sept nœuds à
  sélectionner, déplacer et annuler un par un dans le Designer.

### A3. `TextNode.content` devient un `Expression`

Un texte statique s'écrit `{ kind: 'literal', value: 'Facture' }`.

- ✅ Un seul concept, réutilisation totale de l'ADR 0001.
- ⛔ Même défaut fatal que A2 : sans concaténation (et l'ADR 0001 exclut
  délibérément l'arithmétique et les appels de fonction), un paragraphe mixte
  redevient N nœuds frères.
- ❌ Ajouter un opérateur `concat` à l'algèbre d'expressions pour compenser
  reviendrait à réimplémenter un moteur de gabarit dans le langage d'expression,
  précisément ce que l'ADR 0001 refuse.

---

## Question B — comment les enfants d'une boucle lisent-ils l'élément courant ?

### B1. Alias explicite déclaré par la boucle, *recommandé*

```jsonc
{ "type": "loop", "id": "l1", "each": { "kind": "path", "path": "invoice.lines" },
  "as": "line", "children": [ … ] }
```

Les enfants sont évalués dans une portée dérivée où `line` désigne l'élément.

- ✅ Le template est **auto-suffisant** : l'alias que les enfants utilisent est
  déclaré dans le document, plus dans l'application hôte.
- ✅ `collectDataPaths` redevient exact : un chemin dont le premier segment est un
  alias en portée est une référence interne, pas une exigence d'entrée.
- ✅ Les boucles imbriquées se nomment (`line`, puis `item`) et restent lisibles
  dans le Designer.
- ❌ Un champ de plus dans le schéma, et un nom que l'auteur doit choisir — le
  Designer devra le proposer par défaut plutôt que le demander.

### B2. Nom réservé implicite (`item`, `this`)

- ✅ Rien à ajouter au schéma, rien à choisir pour l'auteur.
- ⛔ Les boucles imbriquées entrent en collision sans recours : `item` désigne
  l'élément de la boucle la plus proche, et l'élément de la boucle englobante
  devient **inatteignable**. Une facture groupée par catégorie est un cas d'usage
  de première ligne, pas un cas limite.

### B3. Résolution relative (portée décalée, `.` et `../` façon Handlebars)

Les chemins des enfants se résolvent d'abord contre l'élément, puis contre la racine.

- ✅ Aucun champ ajouté, écriture compacte.
- ⛔ **Résolution ambiguë** : `total` peut désigner celui de la ligne ou celui de
  la facture, et la réponse dépend de la donnée fournie à l'exécution. C'est
  exactement la classe de bug — mésinterprétation silencieuse — que l'ADR 0001
  écarte en refusant la coercion et la truthiness.
- ⛔ `collectDataPaths` redeviendrait une **heuristique** : sans connaître la
  donnée, on ne peut plus dire si `total` est une clé d'entrée. L'analyse statique
  exacte était le bénéfice n°1 de l'option C.

---

## Décision retenue

**A1 + B1.** Dans `@openview/core`, avant toute ligne d'`engine`.

```ts
// nodes.ts — le discriminant des segments est `kind` : `type` est réservé aux
// nœuds du document, `kind` aux briques d'expression (ADR 0001). Un segment
// n'est pas un nœud.
export interface TextLiteralSegment {
  readonly kind: 'literal';
  readonly text: string;
}

export interface TextBindingSegment {
  readonly kind: 'binding';
  readonly value: Expression;
}

export type TextSegment = TextLiteralSegment | TextBindingSegment;

export interface TextNode extends NodeBase {
  readonly type: 'text';
  readonly content: readonly TextSegment[];
}

export interface LoopNode extends NodeBase {
  readonly type: 'loop';
  readonly each: Expression;
  /** Nom sous lequel les enfants lisent l'élément courant. */
  readonly as: string;
  readonly children: readonly DocumentNode[];
}
```

`TextSegmentSchema` ne porte **pas** d'annotation `z.ZodType<TextSegment>`, et la
liaison explicite de `DocumentNodeSchema` ne la remplace pas — cette ADR a d'abord
affirmé le contraire. `ZodType` est déclaré covariant sur sa sortie (`out Output`
dans `zod/v4/classic/schemas.d.ts`), donc un schéma qui produit *moins* que
`TextSegment` reste assignable et compile sans un mot. Le garde-fou réel est une
assertion d'assignabilité mutuelle dans `nodes.test.ts`, qui échoue dans les deux
sens. Un contenu vide (`[]`) est accepté : un paragraphe vide est une intention de
mise en page légitime.

### Sous-décisions

1. **L'alias est un identifiant unique, validé au parsing.** Même règle que le
   premier segment d'un chemin, mêmes segments interdits (`__proto__`,
   `constructor`, `prototype`). `FORBIDDEN_PATH_SEGMENTS` est aujourd'hui privé à
   `expression.ts` : il faut en extraire un `identifierSchema` exporté et le faire
   dériver aux deux endroits, sinon les deux règles divergeront.
2. **Le masquage est lexical, le plus interne gagne**, et c'est documenté. Deux
   boucles imbriquées partageant un alias produisent un résultat *défini* — la
   sémantique de portée usuelle — et non une mésinterprétation silencieuse. On
   n'ajoute donc **pas** de passe de validation sémantique pour l'interdire
   (règle anti-sur-ingénierie, AGENTS.md §3) ; c'est au Designer de proposer des
   noms distincts.
3. **Un segment de liaison ne porte pas encore de format.** Imprimer `1234.5` au
   lieu de `1 234,50 €` est un vrai manque, mais `format?: …` est un champ
   optionnel : l'ajouter plus tard ne demande pas de *transformer* les documents
   déjà écrits, seulement d'incrémenter `schemaVersion` — pour la raison exposée
   dans « Ce qui reste ouvert ». Reporté.
4. **Pas d'index de boucle en v1.** Même raisonnement pour `indexAs?: string`, et
   la numérotation se traite souvent en CSS côté rendu.
5. **`collectDataPaths` devient sensible aux alias.** Il ne peut plus être bâti
   sur `walk()`, qui rend les nœuds sans leur ascendance : il lui faut sa propre
   descente récursive portant la pile d'alias. `walk()` reste inchangé pour
   `findNodeById`.

### Trois décisions prises à l'implémentation

**La règle partagée est un prédicat, pas un schéma exporté.** La sous-décision 1
annonçait un `identifierSchema` ; c'est `isIdentifier(value)` qui a été écrit, et
il reste privé au paquet. Deux raisons. Un chemin est *pointé* : il se valide
segment par segment, donc son atome commun avec l'alias est un prédicat, pas un
schéma de champ. Et `PathExpressionSchema` conserve **deux** raffinements distincts
plutôt qu'un seul appel au prédicat, pour que l'erreur continue de dire laquelle
des deux règles le chemin a enfreinte. Côté surface publique, rien n'est ajouté :
`LoopNodeSchema.shape.as` donne déjà au Designer de quoi valider une saisie
d'alias au clavier, donc un export de plus n'aurait servi personne.

**La descente d'alias passe toujours par `visitNode`.** `collectDataPaths` a bien
sa propre récursion (`collectFrom`), mais elle dispatche par le Visiteur au lieu
d'un `switch` local : la garantie d'exhaustivité — un nouveau type de bloc casse
la compilation à un seul endroit — n'est pas dépensée pour obtenir l'ascendance.
La branche `image` y est explicitement vide, avec le commentaire qui dit où
brancher une liaison le jour où `src` en portera une.

**Ce que le rendu partagera n'est pas le parcours, c'est un primitif par nœud.**
Une première version se contentait de commenter `collectFrom` — « extrais ce
parcours plutôt que de le réécrire ». L'instruction était infaisable : ce parcours
visite les enfants d'une boucle **une fois**, en portant un ensemble de *noms*
d'alias, tandis que `DataBindingStep` doit les visiter **une fois par élément**, en
portant une portée de *valeurs*. Cardinalité différente, porteur différent : ce ne
sera jamais la même fonction, et l'auteur du rendu aurait réécrit la pile d'alias
que le commentaire prétendait éviter. Ce qui se partage réellement est
`nodeReads(node)` — quelles expressions un nœud évalue, quel alias il lie pour ses
enfants. `collectDataPaths` est désormais un pliage sur ce primitif, `DataBindingStep`
en sera un autre, et la règle « les enfants d'une boucle se lisent sous son alias »
n'est énoncée qu'une fois.

**Le contrat tient sans son hôte, et c'était vérifiable.** Le playground
n'invente plus `{ line }` : il lit l'alias sur le nœud de boucle
(`loopNode.as`) et le passe à `childScope`. C'est le test de bout en bout de
l'ADR : si le template n'était pas auto-suffisant, cette page ne pourrait pas
s'écrire.

---

## Conséquences, telles qu'implémentées

- **`nodes.ts`** : `TextSegment` + `TextNode.content` en tableau, `LoopNode.as`.
- **`expression.ts`** : extraction du prédicat `isIdentifier` partagé (sous-décision 1).
- **`evaluate.ts`** : une dérivation de portée explicite.

  ```ts
  export function childScope(
    parent: EvaluationScope, alias: string, item: unknown,
  ): EvaluationScope {
    return { ...parent, [alias]: item };
  }
  ```

  Le spread ne copie que les clés de premier niveau (une poignée en pratique),
  pas la donnée : le coût par itération reste négligeable. `Object.create(parent)`
  serait O(1) mais placerait la donnée sur la chaîne de prototypes, que
  `resolvePath` traverse via `Reflect.get` — on ne réintroduit pas cette
  sémantique dans un résolveur sensible à la sécurité.
- **`visitor.ts`** : `collectDataPaths` visite enfin les segments de texte et
  soustrait les alias en portée ; c'est la correction du bug décrit en contexte.
- **`index.ts`** : exports des nouveaux types, schémas et de `childScope`.
- **`CURRENT_SCHEMA_VERSION` reste à 1, aucune migration** : le projet étant en phase pré-v1.0 (aucun template client en stockage), le schéma v1 évolue directement sans créer de migration fantôme `1 -> 2`. Dès la publication v1.0, toute évolution incrémentera la version du schéma avec migration obligatoire dans `TEMPLATE_MIGRATIONS`.
- **Tests, dans le même commit** (AGENTS.md §4) : suite de tests unitaires et de typage exhaustive, dont un texte mêlant
  littéral et liaison ; une liaison malformée refusée au parsing ; sept formes
  d'alias refusées (vide, pointé, espacé, commençant par un chiffre, et les trois
  noms de la chaîne de prototypes) ; le masquage lexical entre boucles imbriquées ;
  un élément primitif lu par l'alias seul ; deux boucles imbriquées dont
  `collectDataPaths` ne rapporte ni l'un ni l'autre alias ; et la frontière de
  portée — un chemin en `item.` *après* la boucle est bien réclamé à l'appelant.
  Une assertion de type (`const segments: readonly TextSegment[] = parsed.content`)
  tient lieu de garde-fou sur la liaison schéma ↔ type écrit à la main.
- **Tests existants repris** : `nodes.test.ts`, `visitor.test.ts` et
  `migrate.test.ts` écrivaient `content: 'Invoice'`. Le cas de `migrate.test.ts`
  méritait attention : il vérifie qu'une racine non-conteneur est refusée, et avec
  l'ancienne forme il aurait continué de passer pour la mauvaise raison.
- **Playground** : il ne fabrique plus `{ line }`. Il lit `loopNode.as` et affiche
  les valeurs brutes des liaisons, en disant explicitement que la mise en forme
  appartient à `DataBindingStep`.
- **`engine`** (étape 2) : `DataBindingStep` consomme des segments et
  `childScope`, sur un contrat stable.
- **`viewer`** : évalue les mêmes segments côté client — l'évaluateur est
  isomorphe, il vit dans `core`, rien à dupliquer.

---

## Ce qui reste ouvert

**Politique de la valeur absente et de la mise en chaîne** — la question 2 de
l'ADR 0001, toujours à l'étape 2. La représentation choisie ici est neutre : un
segment de liaison s'évalue en `unknown`, l'absence reste `undefined`, et
`DataBindingStep` appliquera la politique — c'est la division du travail déjà
posée dans `evaluate.ts`. À trancher là-bas, en même temps : comment une valeur
non textuelle devient du texte. Un `[object Object]` imprimé silencieusement dans
une facture n'est pas une option.

**Formatage des valeurs (ADR 0003)** — nombres, devises, dates, locale. Reporté,
mais pas gratuitement : voir le point suivant.

**Tout champ ajouté incrémente `schemaVersion`, même optionnel.** Cette ADR a
d'abord affirmé trois fois le contraire — « champ optionnel, donc additif sans
migration ». C'est faux, et le mécanisme est le `strip` par défaut de Zod :
`z.object` **supprime** les clés qu'il ne connaît pas. Une version ultérieure qui
écrit `{ kind: 'literal', text: 'Total', bold: true }` en `schemaVersion: 1` sera
ouverte par un build antérieur qui rendra le nœud sans `bold`, sans erreur — la
garde de version ne se déclenche pas, puisque la version n'a pas bougé — et le
`onSave` du Designer persistera la perte. Ajouter un champ n'oblige donc pas à
écrire une transformation, mais oblige à l'incrément : c'est lui qui fait parler
`migrateToCurrent` (« écrit par une version plus récente ; mettez à jour avant
d'ouvrir »). Vaut pour `format?`, `indexAs?` et les marques de texte riche.

**Alias masquant une clé racine** — `loop invoice.lines as invoice` rend
`invoice.total` différent à l'intérieur et à l'extérieur de la boucle. Le
masquage lexical le rend *défini*, pas souhaitable, et `collectDataPaths` n'en dit
rien du tout : le chemin de l'enfant est filtré comme référence interne, donc un
document qui imprime le total de la ligne là où l'auteur voulait celui de la
facture ne déclenche aucun signal. `core` ne peut pas connaître les clés de la
donnée, mais la détection n'en a pas besoin : il suffit de savoir que le nom est lu
comme racine dans une portée englobante du **même** document, ce que la descente a
déjà en main. Le **Designer** reçoit en plus un `dataSchema`
([`types.ts`](../../packages/designer/src/types.ts)) et pourra donc l'avertir plus
largement — à traiter à l'étape 4.

**Les lectures par élément ne sont rapportées à personne.** `collectDataPaths`
exclut les chemins enracinés sur un alias, donc un `line.skuu` mal orthographié
n'est signalé par rien : ce n'est pas la fonction avec laquelle un Designer peut
confronter une liaison au schéma de données d'un élément. Il faudrait une sortie
associant chaque lecture à la portée dont elle dépend — la même sortie qui
détecterait le masquage ci-dessus, donc une seule décision, et `nodeReads` en est
déjà la matière première.

**Marques de texte riche** (gras, italique, lien) sur un segment littéral —
pas de décision requise aujourd'hui, hors l'incrément de version ci-dessus.

Rien d'autre. Le partage du parcours avec le rendu, un temps listé ici, est
tranché : voir la quatrième décision d'implémentation.
