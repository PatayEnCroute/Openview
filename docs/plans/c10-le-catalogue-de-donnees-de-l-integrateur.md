# Plan d'implémentation — `@openview/core` lot C10 : le catalogue de données de l'intégrateur

> **Document d'implémentation.** Il ferme le périmètre, les décisions de contrat, les algorithmes,
> les diagnostics, les tests et l'ordre d'exécution de C10. Une fois le lot livré, son ADR
> d'exécution fera foi et ce plan sera marqué périmé.
>
> **Statut : ⚠️ PÉRIMÉ.** Le lot est livré, et c'est
> l'[ADR 0015](../adr/0015-le-catalogue-de-donnees-de-l-integrateur.md) qui fait foi. Elle
> **corrige ce plan sur six points** — le gate J3 n'a pas été respecté et sa protection a été
> remplacée par une vérification garde par garde, l'ADR porte le numéro **0015** et non 0016, deux
> fichiers de production s'ajoutent (`data-catalogue/visitor.ts` et `expectations.ts`),
> `ExpressionVisitor` est un type mappé et non une interface écrite à la main, et le contrôle
> « pas de troisième switch » est une recherche et non un test. Ce document reste ici comme archive
> de ce qui était décidé avant l'exécution ; il ne doit plus être lu comme une consigne.
>
> **Ce que le statut précédent disait, et qui reste vrai.** Le plan gelait le lot jusqu'à J3, qui
> n'était pas atteint au 2026-08-26 — E4 et la relecture métier restent dus. Le lot a été exécuté
> sans ce gate, sur demande explicite, et l'ADR nomme l'écart en tête.
>
> **Briques touchées :** `@openview/core`, la couture de type de `@openview/designer`, la facture de
> référence du playground et la documentation · **Dépend de :** J3 atteint · **Poids roadmap :** M,
> **poids réel : L** à cause du Visitor d'expressions rendu obligatoire par ce troisième parcours.

---

## 0. Résultat attendu

C10 livre un contrat par lequel l'application hôte décrit, dans son propre vocabulaire :

- les clés qu'elle rend disponibles aux modèles ;
- le libellé métier de chaque clé ;
- leur organisation en objets et listes ;
- la nature des valeurs terminales : chaîne, nombre, booléen ou date civile.

À partir d'un `Template` déjà parsé et d'un catalogue déjà validé, `@openview/core` doit ensuite :

1. lister les champs du catalogue dans l'ordre choisi par l'intégrateur, avec leur chaîne de
   libellés ;
2. retrouver chaque lecture du modèle, y compris dans les bandes de page ;
3. suivre les portées des boucles, groupes de lignes, filtres et agrégats ;
4. vérifier les lectures par élément, par exemple `ligne.montant` contre le type des éléments de
   la liste source ;
5. distinguer un chemin non déclaré d'un chemin déclaré mais employé sous une nature incompatible ;
6. signaler séparément un alias qui masque une racine du catalogue ou un alias actif ;
7. donner au Designer la position exacte de chaque occurrence fautive sans jamais inclure une
   valeur de rendu dans un message.

La recette principale utilise un catalogue de facture uniquement comme **jeu d'épreuve**. Retirer
du catalogue le champ de prix d'une ligne rend le modèle incompatible à l'emplacement exact de
chaque lecture ; restaurer le champ rend le même modèle compatible. Renommer toutes les clés du
catalogue et du modèle ensemble laisse le mécanisme inchangé : aucune clé métier n'existe dans le
code de production.

---

## 1. Sources de vérité et écart réel

### 1.1 Ce que la roadmap impose

La [décision produit 9](../roadmap/README.md) donne au catalogue quatre propriétés : il appartient à
l'intégrateur, qui choisit **les données exposées, leurs libellés et leur structure** ; Openview ne
réserve aucun nom. Le [lot C10](../roadmap/core.md#c10-le-catalogue-de-données-de-lintégrateur) est
prêt quand ce catalogue suffit à vérifier les données d'un modèle et à fournir les libellés
proposables. Le [Designer](../roadmap/designer.md) en dépend pour ouvrir un modèle, insérer une
donnée et assister la barre de formule.

### 1.2 Les quatre dettes explicites déjà consignées

Les ADR existantes ne laissent pas C10 partir d'une page blanche :

| Dette | Source | Réponse de C10 |
| :--- | :--- | :--- |
| `collectDataPaths()` donne les chemins, pas le type attendu à chaque lecture | [ADR 0001](../adr/0001-expression-language.md) | une attente fermée accompagne chaque occurrence de chemin |
| un alias peut masquer une racine sans signal | [ADR 0002](../adr/0002-data-binding-and-loop-scope.md) | avertissement de portée distinct d'une incompatibilité |
| les lectures comme `line.skuu` sont supprimées de la liste externe | [ADR 0002](../adr/0002-data-binding-and-loop-scope.md) | analyse liée au type d'élément de la liste source |
| `aggregate.as` et `filter.as` ajoutent deux sites de portée | [ADR 0003](../adr/0003-formules-agregations-et-dates-civiles.md) | même pile lexicale pour AST de document et expressions |

Ces quatre points sont une seule décision : produire des **lectures localisées et résolues dans leur
portée**, pas une deuxième liste plate de chemins.

### 1.3 Ce qui existe déjà et doit rester vrai

- `PathExpressionSchema` accepte des identifiants séparés par des points, refuse les membres hérités
  et borne le chemin écrit à 256 caractères.
- `collectDataPaths()` et `collectTemplateDataPaths()` dédupliquent les chemins externes et excluent
  les alias locaux. Cette API sert à dire à un appelant quelles racines fournir ; C10 ne change ni
  son résultat ni son ordre.
- `nodeReads()` connaît les expressions directement lues par un nœud et les alias liés pour ses
  enfants. C'est une matière première, pas encore une analyse localisée.
- l'évaluateur porte exactement la sémantique de portée que l'analyse C10 doit reproduire.
- le Designer expose provisoirement `dataCatalogue?: Record<string, unknown>` ; cette forme ne
  décrit ni libellé, ni structure, ni type et doit disparaître.
- le jeu de données de rendu reste `unknown`/opaque à la frontière. Aucun schéma `RenderDataSchema`
  n'existe et C10 n'en crée pas.

### 1.4 Pourquoi le plan attend E4 même si son contrat paraît indépendant

E4 fixe les sites et les formes réellement imprimables après formatage. C10 doit donc revalider en
INC-0 la table des attentes de lecture : une liaison visible, une date formatée, un report, une
expression textuelle et une expression numérique doivent être classés d'après le moteur livré, pas
d'après une anticipation. Cette vérification peut modifier la table d'attentes ; elle ne peut pas
modifier les invariants de propriété, de portée ou d'absence de schéma de données.

---

## 2. Périmètre fermé

### 2.1 Inclus dans C10

- types TypeScript purs du catalogue dans `@openview/core` ;
- schéma Zod 4 récursif correspondant ;
- clés ordonnées, libellés ordonnés, objets, listes et listes imbriquées ;
- quatre natures terminales : `string`, `number`, `boolean`, `civil-date` ;
- contrôle des doublons de clé entre frères ;
- façade publique dédiée ;
- aplatissement ordonné du catalogue pour un consommateur d'interface ;
- analyse de chaque occurrence de lecture dans `root`, `page.header` et `page.footer` ;
- résolution lexicale des alias de document et d'expression ;
- attentes de nature dérivées du contexte de l'expression ;
- diagnostics structurés pour chemin non déclaré et nature incompatible ;
- avertissements structurés de masquage d'alias ;
- remplacement du placeholder de type dans `OpenviewDesignerProps` ;
- catalogue de la facture de référence et démonstration positive/négative ;
- ADR de décision et fermeture des trois questions ouvertes des ADR 0001 à 0003.

### 2.2 Exclus, avec leur propriétaire

| Exclu | Motif | Propriétaire |
| :--- | :--- | :--- |
| schéma Zod du jeu de données de rendu | sa forme appartient à l'hôte ; le catalogue décrit des capacités, pas une charge utile | jamais Openview |
| validation d'une instance de `RenderRequest.data` contre le catalogue | confondrait « déclaré » et « présent dans ce rendu » et casserait `isEmpty` | application hôte ; politique d'absence au moteur |
| inférence du catalogue depuis un objet d'exemple | une valeur vide ne révèle ni type d'élément, ni libellé, ni champ optionnel | intégrateur |
| découverte distante, requête API ou chargement asynchrone | C10 est un contrat pur ; l'hôte fournit le catalogue | application hôte |
| valeur par défaut, exemple, enum, regex ou borne métier | transformerait le catalogue en formulaire métier et en source de validation | application hôte |
| `required`, `nullable` ou `optional` | la disponibilité structurelle n'est pas la présence dans chaque rendu | application hôte / moteur |
| `money`, devise ou nombre de décimales comme type de donnée | un montant est un nombre ; son écriture est déclarée par le modèle | C6/E4 |
| date-heure, fuseau ou « aujourd'hui » | hors contrat déterministe ; `civil-date` reste `YYYY-MM-DD` | hors v1 / donnée hôte |
| type fiscal, client, facture, adresse, article ou total | vocabulaire métier interdit dans le code de production | jamais Openview |
| édition React du sélecteur de champs | C10 fournit le contrat ; D1/D4 construisent l'interface | Designer |
| autocomplétion complète et vérificateur de formules | C10 expose les lectures et les attentes ; D7 choisit l'expérience d'auteur | Designer D7 |
| formulaire interactif du Viewer | explicitement reporté en v2 | Viewer v2 |
| migration de `Template` | le catalogue n'est pas stocké dans le modèle | aucune |
| Port ou adaptateur de catalogue | un seul fournisseur existe : la prop de l'hôte ; aucune abstraction hexagonale n'est justifiée | futur second adaptateur réel |

### 2.3 La phrase qui interdit le glissement de périmètre

Le catalogue répond à « **qu'est-ce que l'hôte permet de lire ?** ». Il ne répond jamais à
« **quelles valeurs ce rendu contient-il ?** ». Toute proposition qui exige de parcourir
`RenderRequest.data` appartient à un autre problème et sort de C10.

---

## 3. Décisions d'architecture

### D1 — Le catalogue est un contrat hôte transitoire, jamais une propriété du `Template`

`DataCatalogue` est passé séparément au Designer et aux fonctions de compatibilité. Aucun champ
`dataCatalogue`, `schema`, `variables` ou équivalent n'entre dans `TemplateSchema`.

Conséquences :

- deux applications peuvent ouvrir le même modèle avec deux catalogues différents ;
- la compatibilité peut changer sans réécrire le modèle ;
- `CURRENT_SCHEMA_VERSION` et `TEMPLATE_MIGRATIONS` ne bougent pas ;
- un build ancien ne peut pas dépouiller un catalogue puis le sauvegarder, puisqu'Openview ne le
  possède ni ne le persiste.

### D2 — La structure est récursive et sépare le champ de son type

Un champ porte `key`, `label` et `type`. Le type est une union récursive : quatre feuilles, un objet
portant des champs, ou une liste portant le type de ses éléments. Séparer les deux permet :

- une liste de scalaires ;
- une liste d'objets ;
- une liste de listes sans forme spéciale ;
- un objet racine implicite dont les enfants sont ordonnés ;
- des éléments de liste sans inventer une clé qui n'existe pas dans la donnée.

Un dictionnaire plat `Record<path, metadata>` est écarté : il ne dit pas si `a.b` traverse un objet
ou prétend traverser chaque élément d'une liste, et il oblige à inventer une notation `[]` que le
langage de chemins n'accepte pas.

### D3 — Les quatre feuilles sont `string`, `number`, `boolean`, `civil-date`

`civil-date` est distinct de `string` dans le catalogue bien que sa valeur runtime soit une chaîne.
Cette distinction permet de proposer les opérations de date sans laisser croire qu'une date-heure
ou un fuseau est accepté. Elle réemploie le contrat `YYYY-MM-DD` de l'algèbre.

Il n'existe pas de feuille `null` ou `undefined` : l'absence décrit une instance, pas une capacité.
Il n'existe pas de feuille `money` : la devise et l'arrondi relèvent de l'écriture du modèle.

### D4 — Une clé suit exactement la grammaire des chemins existants

Chaque `DataField.key` doit satisfaire `isIdentifier()` : même alphabet, même refus de
`__proto__`, `constructor`, `prototype` et des membres hérités. C10 ne crée pas une seconde
grammaire et ne rend pas adressable une clé que `PathExpressionSchema` refuserait.

Ce choix ne réserve aucun nom métier. Il reprend seulement la frontière de sécurité et
d'adressabilité déjà publique du langage d'expressions.

### D5 — L'ordre du tableau est l'ordre du sélecteur ; les libellés ne sont pas des identifiants

`fields` est un tableau, jamais un `Record`, et l'ordre est contractuel. L'aplatissement parcourt en
profondeur, parent avant enfants, en conservant l'ordre des frères.

Un libellé est une chaîne non vide, sans espaces de bord, bornée par
`MAX_DATA_LABEL_LENGTH = 200`. Deux frères peuvent porter le même libellé : leur chaîne complète de
libellés et leur clé les distinguent. En revanche, deux frères ne peuvent jamais porter la même clé,
car ils décriraient deux types concurrents pour une seule donnée.

### D6 — Le catalogue peut être vide

Un modèle entièrement statique est valide avec `{ fields: [] }`. Un objet sans enfant et une liste
d'objets sans champ sont également représentables : `isEmpty`, `count` ou une future évolution de
l'hôte peuvent encore leur donner un sens. C10 ne refuse pas une structure uniquement parce que
l'interface n'a rien à afficher dessous.

### D7 — La compatibilité porte sur les occurrences, pas sur une liste dédupliquée

`collectTemplateDataPaths()` reste la bonne API pour demander les chemins externes une fois chacun.
La compatibilité C10 produit une entrée par occurrence, avec :

- le chemin tel qu'il est écrit dans l'expression ;
- le chemin structurel retrouvé dans le catalogue ;
- les libellés correspondants ;
- la nature déclarée ;
- l'attente imposée par le contexte ;
- la position dans le modèle et le `nodeId` fourni par ce modèle ;
- un statut `available`, `undeclared`, `incompatible` ou `blocked`.

Deux lectures du même champ dans deux nœuds donnent deux entrées. Le Designer peut ainsi souligner
les deux endroits ; dédupliquer ici perdrait précisément l'information que C10 ajoute.

### D8 — Les attentes forment un vocabulaire fermé mais pas un type-checker général

Le vocabulaire cible est :

```ts
export const DATA_EXPECTATIONS = [
  'any',
  'printable',
  'number',
  'boolean',
  'text',
  'civil-date',
  'primitive',
  'orderable',
  'list',
] as const;
```

Il décrit ce que le runtime exige à **l'endroit où un chemin est lu** : liste pour une boucle,
nombre pour une opération arithmétique, date civile pour `dateAdd`, texte pour `textCase`, etc.

C10 ne prouve pas toute l'algèbre. Par exemple, il sait que les deux opérandes de `gt` doivent être
ordonnables, mais ne cherche pas à résoudre toutes les unions possibles d'un `if` pour démontrer
qu'elles ont exactement la même nature. Les fautes sans aucune lecture de catalogue —
`add('x', true)` — restent les refus d'évaluation de C8. Cette limite garde C10 au niveau de la
compatibilité entre deux contrats au lieu d'inventer un compilateur statique parallèle au runtime.

### D9 — La table d'attentes est dérivée de la sémantique runtime

Sous réserve de la relecture E4 d'INC-0 :

| Contexte | Attente transmise aux chemins concernés |
| :--- | :--- |
| liaison visible directe | `printable` |
| `loop.each`, `tableRowGroup.each`, source de `aggregate`, `count`, `filter` | `list` |
| arithmétique, pourcentage, arrondi, valeur agrégée, contribution de report | `number` |
| `concat`, `textCase` | `text` |
| entrée de `text()` | `printable` élargi au contrat exact livré par E4 |
| `dateAdd.date`, `dateDiff.from/to`, `endOfMonth.date` | `civil-date` |
| `dateAdd.days` | `number` |
| condition, filtre, logique, négation | `boolean` |
| `eq` / `neq` | `primitive` |
| `gt` / `gte` / `lt` / `lte` | `orderable` |
| `isEmpty` | `any` |
| branches d'un `if` | attente héritée du parent |

Les ensembles acceptés sont centralisés et testés. `civil-date` satisfait `text`, `printable`,
`primitive` et `orderable`, mais seule `civil-date` satisfait l'attente homonyme.

### D10 — Une liste n'est traversable qu'après liaison de son élément

Avec un catalogue où `commande.lignes` est une liste d'objets :

- `commande.lignes` satisfait une attente `list` ;
- un alias `ligne` lié par cette source reçoit le type de l'élément ;
- `ligne.montant` peut alors résoudre le champ `montant` ;
- `commande.lignes.montant` est incompatible : le langage n'effectue aucun `map` implicite.

Une liste de scalaires lie directement son type terminal à l'alias. Une liste de listes lie une
nouvelle liste, qu'une boucle ou un filtre imbriqué peut à son tour consommer.

### D11 — Une source brisée bloque ses lectures locales sans produire une cascade

Si la source d'une boucle est absente ou n'est pas une liste, elle produit son diagnostic. Les
lectures enracinées dans l'alias reçoivent le statut `blocked` et aucun second diagnostic
« chemin inconnu » : leur base n'a pas pu être établie. Elles restent dans `reads` pour que le
Designer puisse expliquer pourquoi leur vérification est suspendue.

Corriger la source réactive leur analyse au prochain appel pur de la fonction.

### D12 — Les alias suivent une pile lexicale identique à l'évaluateur

Les quatre déclarations de portée sont traitées par la même abstraction interne :

- `LoopNode.as` ;
- `TableRowGroupNode.as` ;
- `AggregateExpression.as` ;
- `FilterExpression.as`.

L'alias le plus interne gagne. Un alias qui masque une racine du catalogue ou un alias actif ne
rend pas le modèle incompatible : la sémantique runtime est définie. Il produit un
`DataScopeWarning` localisé, parce que l'ADR 0002 a identifié un risque d'intention, pas un état
impossible.

### D13 — « Non déclaré » n'est jamais « absent au rendu »

Deux diagnostics nouveaux portent la source `data-compatibility` :

- `undeclared-data-path` : le catalogue ne décrit pas le segment demandé ;
- `incompatible-data-kind` : le chemin existe, mais sa nature ne satisfait pas l'usage.

Ils ne réemploient pas un code `missing-data`. Le premier compare le modèle à une **déclaration** ;
le moteur, lui, décide ce qu'il fait quand une valeur d'une instance est absente. C10 ne modifie ni
`isEmpty`, ni la boucle absente, ni la condition absente, ni le refus d'une liaison visible vide.

Le chemin de donnée est un champ structuré du diagnostic et n'est jamais interpolé dans `message`,
comme `nodeId` et le chemin du modèle dans l'ADR 0010. Aucune valeur de `RenderRequest.data` n'est
lue, stockée ou journalisée.

### D14 — Le troisième parcours d'expressions retire l'amendement temporaire

Avant C10, l'algèbre a deux parcours exhaustifs : évaluation et collecte de chemins. L'analyse des
attentes et des portées est le troisième parcours annoncé par `AGENTS.md` §3.B. Le Visitor devient
donc obligatoire.

INC-1 introduit un `ExpressionVisitor<TResult, TContext>` et un unique
`visitExpression(expression, visitor, context)` portant le `switch` exhaustif. L'évaluateur et
`pathsOf()` sont migrés vers lui **avant** l'analyse C10. Le visiteur reste interne au sous-système
tant qu'aucun besoin public ne le justifie.

Cette étape doit être un refactor comportementalement neutre : même valeur, même budget, même
`at`, même ordre de parcours, mêmes erreurs. Ajouter un troisième `switch (expression.kind)` pour
aller plus vite est explicitement interdit.

### D15 — Le Composite de document réemploie son Visitor existant

L'analyse des nœuds passe par `visitNode()` et ne crée aucun nouveau `switch (node.type)`. Elle
porte des descripteurs d'enfants localisés afin de produire les chemins exacts : `root`, bandes,
conteneurs, sections de table, groupes, lignes, cellules et segments.

`collectDataPaths()` garde son parcours optimisé et son résultat public. C10 ne fusionne pas une
analyse riche avec une API ancienne au risque de changer son ordre ou sa déduplication.

### D16 — La façade publique est fonctionnelle, synchrone et sans Port

Le contrat cible expose :

- valeurs, types et schéma du catalogue ;
- `listDataCatalogueEntries(catalogue)` ;
- `checkTemplateDataCompatibility(template, catalogue)` ;
- types de lecture, diagnostic, avertissement et résultat.

Ces fonctions sont pures et synchrones. Aucun cache global, registre, horloge, locale, réseau ou
adaptateur. Un catalogue de taille identique produit le même ordre de sortie à chaque appel.

### D17 — La prop du Designer reste optionnelle, mais cesse d'être opaque

`OpenviewDesignerProps.dataCatalogue?: DataCatalogue | undefined` remplace
`Record<string, unknown>`. L'absence équivaut fonctionnellement à un catalogue vide : le Designer
ne propose aucun champ et peut encore ouvrir un modèle statique. Elle ne signifie jamais qu'Openview
doit deviner les champs depuis les données.

Le composant Designer n'existant pas encore, C10 ne parse pas une prop React fictive. La future
frontière D1 devra appeler `DataCatalogueSchema.safeParse()` une seule fois à réception, jamais à
chaque rendu React.

### D18 — Aucun versionnement de modèle, aucun numéro de version dans le catalogue

Le catalogue n'est pas un document Openview persistant et ne traverse pas la chaîne de migrations
des templates. Son évolution relève du versionnement sémantique de l'API publique. Ajouter
`schemaVersion` au catalogue aujourd'hui créerait une chaîne de migrations sans propriétaire de
stockage ni besoin observé.

Le contrôle négatif de clôture exige donc : version courante du template inchangée, migrations
inchangées, corpus historique inchangé.

---

## 4. Contrat public cible

### 4.1 Types du catalogue

```ts
export const DATA_SCALAR_KINDS = ['string', 'number', 'boolean', 'civil-date'] as const;

export type DataScalarKind = (typeof DATA_SCALAR_KINDS)[number];

export interface DataScalarType {
  readonly kind: DataScalarKind;
}

export interface DataObjectType {
  readonly kind: 'object';
  readonly fields: readonly DataField[];
}

export interface DataListType {
  readonly kind: 'list';
  readonly items: DataType;
}

export type DataType = DataScalarType | DataObjectType | DataListType;

export interface DataField {
  readonly key: string;
  readonly label: string;
  readonly type: DataType;
}

export interface DataCatalogue {
  readonly fields: readonly DataField[];
}
```

Les noms définitifs doivent rester ceux-ci sauf collision découverte en INC-0. Aucun alias
`Catalog`/`Catalogue`, aucun doublon `DataFieldType`/`DataType` n'est publié « pour aider » : une API
publique a un seul vocabulaire.

### 4.2 Schémas Zod

`types.ts` contient uniquement les types et constantes. `schemas.ts` importe `z` depuis `zod/v4`,
écrit le type récursif à la main et lie explicitement le schéma :

```ts
export const DataTypeSchema: z.ZodType<DataType> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    DataStringTypeSchema,
    DataNumberTypeSchema,
    DataBooleanTypeSchema,
    DataCivilDateTypeSchema,
    DataObjectTypeSchema,
    DataListTypeSchema,
  ]),
);
```

Les schémas objet emploient `z.object`, comme le reste du contrat. Un `superRefine` au niveau du
catalogue parcourt les objets et refuse chaque doublon de clé au chemin du second champ. Les messages
sont constants, en anglais, sans clé ni libellé interpolé.

Le schéma refuse : clé inaccessible par le langage de chemins, libellé vide ou entouré d'espaces,
libellé au-delà de la borne, kind inconnu, membre requis absent et clé sœur dupliquée. Il accepte le
catalogue vide, les objets vides et toute profondeur encore acceptable par la frontière appelante.

### 4.3 Entrées ordonnées pour l'interface

```ts
export interface DataCatalogueEntry {
  readonly keyPath: readonly string[];
  readonly labelPath: readonly string[];
  readonly type: DataType;
}

export function listDataCatalogueEntries(
  catalogue: DataCatalogue,
): readonly DataCatalogueEntry[];
```

Chaque champ apparaît une fois, parent avant descendants. Les enfants d'un objet élément de liste
sont listés comme descendants du champ liste ; `type` conserve la frontière de liste sans inventer
`[]` dans `keyPath`. Les tableaux retournés sont neufs ; les objets du catalogue peuvent être
référencés en lecture seule.

### 4.4 Lecture et compatibilité

```ts
export const DATA_READ_STATUSES = [
  'available',
  'undeclared',
  'incompatible',
  'blocked',
] as const;

export interface TemplateDataRead {
  readonly writtenPath: string;
  readonly cataloguePath: readonly string[] | undefined;
  readonly labels: readonly string[];
  readonly actualKind: DataType['kind'] | undefined;
  readonly expectation: DataExpectation;
  readonly status: DataReadStatus;
  readonly path: readonly (string | number)[];
  readonly nodeId: string | undefined;
}

export interface TemplateDataCompatibility {
  readonly compatible: boolean;
  readonly reads: readonly TemplateDataRead[];
  readonly diagnostics: readonly DataCompatibilityDiagnostic[];
  readonly scopeWarnings: readonly DataScopeWarning[];
}

export function checkTemplateDataCompatibility(
  template: Template,
  catalogue: DataCatalogue,
): TemplateDataCompatibility;
```

`compatible` vaut `diagnostics.length === 0`. Les avertissements n'y participent pas. Une lecture
`blocked` ne crée pas de diagnostic supplémentaire, mais la cause qui l'a bloquée en a déjà un.

### 4.5 Diagnostics

La branche ajoutée à `OpenviewDiagnostic` est elle-même discriminée par `code` :

```ts
export type DataCompatibilityDiagnostic =
  | (DataCompatibilityDiagnosticBase & {
      readonly code: 'undeclared-data-path';
      readonly dataPath: string;
    })
  | (DataCompatibilityDiagnosticBase & {
      readonly code: 'incompatible-data-kind';
      readonly dataPath: string;
      readonly expectedKinds: readonly DataType['kind'][];
      readonly actualKind: DataType['kind'];
    });
```

La base porte `source: 'data-compatibility'`, `message`, `path`, `nodeId`. Le message est une phrase
anglaise constante ; `dataPath` reste séparé. `DIAGNOSTIC_SOURCES` gagne la source, la façade
diagnostics réexporte le type, et les tests de catalogue fermé sont mis à jour.

Les avertissements de portée ne rejoignent pas `OpenviewDiagnostic`, qui reste le catalogue des
refus. Ils portent un code fermé, l'alias, le chemin du modèle et le `nodeId`, sans rendre
`compatible` faux.

---

## 5. Algorithmes

### 5.1 Index du catalogue

Chaque appel à `checkTemplateDataCompatibility()` construit un index éphémère :

1. l'objet racine implicite devient le premier scope ;
2. chaque objet indexe ses champs par clé dans une `Map` locale ;
3. chaque champ conserve son type et les chemins de clés/libellés depuis la racine ;
4. une liste conserve le type de son élément ;
5. aucune donnée n'est copiée dans un cache global.

Le coût est O(F) en temps et espace pour F champs. L'analyse est ensuite O(N + E), N étant les
nœuds et E les nœuds d'expression. Aucun parcours du jeu de données de rendu n'entre dans ce coût.

### 5.2 Résolution d'un chemin

Pour un chemin écrit `root.child.leaf` :

1. séparer les segments avec la grammaire déjà validée ;
2. chercher `root` dans la pile d'alias, du plus interne au plus externe ;
3. si aucun alias ne correspond, chercher `root` dans l'objet racine du catalogue ;
4. pour chaque segment restant, exiger un objet puis chercher son champ ;
5. ne jamais traverser implicitement une liste ;
6. comparer le type final à l'attente ;
7. produire la lecture, puis éventuellement le diagnostic.

Un segment absent produit `undeclared-data-path`. Un segment demandé sous un scalaire ou une liste,
ou un type final incompatible, produit `incompatible-data-kind`.

### 5.3 Analyse d'une expression

Le Visitor d'expressions reçoit un contexte contenant la pile d'alias, l'attente courante, la
position dans le modèle et les accumulateurs de résultat. Chaque branche :

- visite ses enfants avec l'attente du tableau D9 ;
- renvoie une description minimale de son résultat (`known`, `unknown`, liste et type d'élément) ;
- lie temporairement l'élément pour `aggregate.value` ou `filter.where` ;
- hérite de l'attente du parent dans les branches de `if` ;
- enregistre seulement les branches `path` dans `reads`.

Le retour sert à lier une source de séquence composée, notamment un `filter` imbriqué. Il n'est pas
publié comme système général d'inférence.

### 5.4 Analyse du document

Ordre contractuel :

1. `template.root` ;
2. `template.page.header` dans l'ordre des bandes ;
3. `template.page.footer` dans l'ordre des bandes.

Dans chaque sous-arbre, l'ordre suit le Composite. Un alias de boucle ne vaut que pour ses enfants ;
un alias de groupe de lignes ne vaut que pour ses lignes et cellules. Les bandes repartent du scope
racine : aucune portée du flux ne fuit vers une bande ni d'une bande vers la suivante.

Les positions d'expression sont exactes : segment `binding.value`, `loop.each`, `condition.when`,
`tableRowGroup.each`, `pageReport.value`, puis les positions internes de l'algèbre.

### 5.5 Masquage

Lors de chaque liaison :

- si le nom existe parmi les racines du catalogue, ajouter `alias-shadows-catalogue-root` ;
- s'il existe déjà dans la pile active, ajouter `alias-shadows-alias` ;
- pousser malgré tout la nouvelle liaison ;
- dépiler à la sortie exacte de la portée.

Le warning est produit une fois par déclaration d'alias, pas une fois par lecture descendante.

### 5.6 Absence de cascade

Une source qui ne résout pas un type de liste pousse une liaison `blocked`. Toute lecture enracinée
sur elle devient `blocked`. Les autres racines de la même expression restent analysées. Ainsi une
faute ne masque pas une faute indépendante, mais n'invente pas dix symptômes à partir d'une seule
source cassée.

---

## 6. Organisation cible des fichiers

### 6.1 Nouveaux fichiers de production

```text
packages/core/src/data-catalogue/
├── types.ts
├── schemas.ts
├── list.ts
├── compatibility.ts
└── data-catalogue.ts

packages/core/src/expression/
└── visitor.ts
```

- `types.ts` : constantes et types purs, sans Zod ni logique ;
- `schemas.ts` : Zod 4 et invariants de catalogue ;
- `list.ts` : aplatissement ordonné ;
- `compatibility.ts` : index, portée, attentes et analyse ;
- `data-catalogue.ts` : façade interne du sous-système ;
- `expression/visitor.ts` : dispatch exhaustif unique.

### 6.2 Nouveaux tests

```text
packages/core/src/data-catalogue/__tests__/
├── schemas.test.ts
├── list.test.ts
├── compatibility.test.ts
└── recipe.test.ts

packages/core/src/expression/__tests__/
└── visitor.test.ts
```

### 6.3 Fichiers modifiés

- `packages/core/src/expression/evaluator/evaluate.ts` : remplacer son dispatch par le Visitor ;
- `packages/core/src/expression/paths.ts` : remplacer son dispatch par le Visitor sans changer
  `pathsOf()` ;
- `packages/core/src/expression/expression.ts` : façade interne si nécessaire, sans export public
  automatique du Visitor ;
- `packages/core/src/diagnostics/types.ts` et `diagnostics.ts` : nouvelle branche de refus ;
- `packages/core/src/diagnostics/__tests__/catalogues.test.ts` : fermeture des tuples/unions ;
- `packages/core/src/index.ts` : surface publique C10 ;
- `packages/designer/src/types.ts` : prop typée ;
- `packages/designer/DESIGN.md` et `packages/viewer/DESIGN.md` : remplacer la promesse abstraite par
  le contrat livré, sans annoncer les UI aval comme livrées ;
- facture/catalogue de référence du playground : démonstration sans nom de production ;
- ADR 0001, 0002 et 0003 : renvoi vers l'ADR C10 sur les questions désormais fermées ;
- `docs/roadmap/core.md` : marquer C10 livré seulement à la clôture ;
- `docs/adr/0016-le-catalogue-de-donnees-de-l-integrateur.md` : numéro à confirmer ;
- le présent plan : statut périmé et lien vers l'ADR après livraison.

### 6.4 Fichiers qui ne se touchent pas

- `packages/core/src/template/template.ts`, `migrate.ts` et le corpus historique ;
- `packages/core/src/ports/render.ts` ;
- les sources du moteur, sauf éventuel ajustement de fixture imposé par E4 et explicitement justifié ;
- `AGENTS.md`, les `tsconfig`, Biome, CI, Turbo, Sonar et les manifestes ;
- aucune dépendance.

---

## 7. Stratégie de tests

### 7.1 Schéma du catalogue

Cas positifs obligatoires : catalogue vide, feuilles des quatre kinds, objet imbriqué, liste de
scalaire, liste d'objet, liste de liste, objet vide, ordre préservé et aller-retour Zod.

Refus obligatoires :

- clé vide, avec point, espace, tiret ou premier caractère numérique ;
- chaque identifiant hérité interdit ;
- libellé vide, blanc, entouré d'espaces ou trop long ;
- kind inconnu ;
- champ, type, items ou fields requis absent ;
- clé dupliquée à la racine ;
- clé dupliquée dans un objet ;
- clé dupliquée dans l'objet élément d'une liste ;
- type récursif mal formé.

Le chemin Zod doit viser le second champ en doublon. Le message ne contient ni clé ni libellé.

### 7.2 Aplatissement

- parent avant enfant ;
- ordre des frères intact ;
- chemins de clés et de libellés exacts ;
- frontière de liste visible dans le `type` du parent ;
- listes et objets vides présents une fois ;
- aucun tableau du catalogue muté ;
- deux appels rendent des valeurs égales et des tableaux indépendants.

### 7.3 Refactor Visitor

- chaque kind appelle exactement sa branche ;
- le contexte générique arrive intact ;
- les tests d'évaluation existants restent inchangés et verts ;
- les tests de `pathsOf()` gardent valeur, ordre, déduplication et règles d'alias ;
- les limites de pas, profondeur et éléments rendent les mêmes codes et les mêmes `at` ;
- le code de production ne contient plus que le `switch (expression.kind)` du dispatcher.

Le contrôle de seuil est mécanique : une recherche de `switch (expression.kind)` et de chaque
`case` discriminant doit montrer un dispatcher, jamais trois parcours parallèles.

### 7.4 Compatibilité directe

- modèle statique + catalogue vide : compatible ;
- champ racine présent : lecture `available` avec label ;
- champ racine absent : `undeclared-data-path` ;
- membre d'objet présent/absent ;
- tentative de traversée d'un scalaire ;
- tentative de traversée directe d'une liste ;
- même champ lu deux fois : deux lectures et deux positions ;
- ordre `root`, `header`, `footer` ;
- `pageField` ne crée aucune lecture de catalogue.

### 7.5 Portées de document

- boucle sur liste d'objets, lecture de membre valide ;
- membre d'élément mal orthographié ;
- liste de scalaires, lecture de l'alias lui-même ;
- liste de listes et boucle imbriquée ;
- groupe de lignes et `pageReport.value` dans le scope de l'élément ;
- boucle source absente : une cause, descendants `blocked` ;
- boucle source scalaire : incompatibilité list, descendants `blocked` ;
- alias interne masquant un alias externe puis restitution du scope externe ;
- même alias dans deux branches sœurs sans fuite.

### 7.6 Portées d'expression

- `filter.as` dans `where` ;
- `aggregate.as` dans `value` ;
- filtre imbriqué conservant le type de liste pour une boucle ;
- agrégat exigeant un nombre sur le membre lu ;
- source cassée sans cascade ;
- alias d'expression ne fuyant pas vers une expression sœur.

### 7.7 Attentes

Une matrice couvre chaque ligne de D9 avec au moins un cas accepté et un refusé. Cas spécifiques :

- nombre dans arithmétique accepté, chaîne refusée ;
- chaîne et date civile dans texte acceptées selon la sémantique E4 ;
- date civile dans `dateAdd` acceptée, chaîne générique refusée ;
- nombre de jours requis ;
- booléen requis par condition et filtre ;
- objet/liste refusés par comparaison primitive ;
- nombre et texte acceptés séparément par ordre ;
- toute nature acceptée par `isEmpty` ;
- attente numérique propagée aux deux branches d'un `if` sous une addition.

### 7.8 Diagnostics et confidentialité

- `DIAGNOSTIC_SOURCES` et `OpenviewDiagnostic` restent en pas ;
- chaque code produit sa branche structurée exacte ;
- `message` reste constant pour deux chemins et deux catalogues différents ;
- le chemin de donnée n'apparaît que dans `dataPath` ;
- aucune valeur de rendu n'est nécessaire pour appeler l'analyse ;
- une recherche de noms métier réservés reste vide dans le code de production ;
- le code `undeclared-data-path` ne modifie aucun comportement runtime d'absence.

### 7.9 Couture Designer

Le type-check doit prouver qu'un `DataCatalogue` valide est accepté par
`OpenviewDesignerProps.dataCatalogue` et que le placeholder `Record<string, unknown>` a disparu.
L'absence de prop reste acceptée. Aucun composant ou hook fictif n'est ajouté pour fabriquer une
couverture.

### 7.10 Régressions

- toute la suite `core` et toute la suite monorepo ;
- facture E4 rendue identiquement avec ou sans appel préalable à la compatibilité ;
- `collectTemplateDataPaths()` rend strictement la même liste ;
- version de template et migrations strictement identiques avant/après C10 ;
- compte d'exports publics remesuré si un test l'épingle ;
- couverture au moins 90 % sur instructions, branches, fonctions et lignes.

---

## 8. Recette C10

### 8.1 Catalogue d'épreuve

La fixture contient au minimum :

- un objet document avec numéro et date civile ;
- un objet destinataire avec deux chaînes ;
- une liste de lignes dont l'élément objet porte libellé, quantité, prix et remise ;
- une liste de chaînes dans chaque ligne ;
- un booléen de condition ;
- les libellés métier français correspondants.

Ces clés vivent exclusivement dans les fixtures, jamais dans les types, schémas, messages ou
algorithmes.

### 8.2 Modèle d'épreuve

Le modèle lit :

- une racine dans le flux ;
- une racine dans l'en-tête et une dans le pied ;
- la liste dans une boucle ou un groupe de lignes ;
- trois membres de l'élément ;
- un membre dans un filtre ;
- un membre numérique dans un agrégat ;
- une date civile dans une opération de date ;
- un booléen dans une condition ;
- un champ numérique dans une contribution de report si le contrat E3 final la conserve.

### 8.3 Oracles

Avec le catalogue complet :

- `compatible === true` ;
- aucun diagnostic ;
- toutes les lectures sont `available` ;
- les libellés proposés apparaissent dans l'ordre du catalogue ;
- les lectures d'alias pointent vers les champs de l'élément, jamais vers une racine inventée.

Avec le prix retiré :

- `compatible === false` ;
- chaque occurrence qui lit ce prix reçoit `undeclared-data-path` à sa position ;
- les autres lectures restent disponibles ;
- aucune valeur de facture n'est fournie à l'analyse.

Avec la liste changée en objet :

- sa lecture reçoit `incompatible-data-kind` pour l'attente `list` ;
- les lectures sous l'alias sont `blocked` ;
- aucun diagnostic parasite ne prétend que leurs clés sont des racines absentes.

### 8.4 Démonstration visible

Le playground affiche une carte de développement : nombre de champs déclarés, libellés ordonnés,
compatibilité du modèle de référence et diagnostics de la variante volontairement incomplète. Il
ne demande aucun jeu de données à ce contrôle et ne présente pas cette carte comme le sélecteur de
champs final de D4.

---

## 9. Incréments d'exécution

### INC-0 — Gate J3, baseline et table E4

**Travail :** confirmer J3 démontrable et la relecture métier consignée ; préserver le worktree ;
relever les versions et numéros libres ; lancer les quatre portes ; inventorier les sites de liaison
et les natures imprimables après E4 ; confirmer les questions encore ouvertes des ADR 0001 à 0003.

**Sortie :** la table D9 est confirmée ou corrigée avant tout code, l'ADR C10 a un numéro libre, et
aucun changement C10 n'existe si J3 n'est pas atteint.

### INC-1 — Visitor d'expressions, comportement inchangé

**Travail :** introduire le dispatcher et ses tests ; migrer évaluateur et collecte de chemins ;
faire passer les tests ciblés et les ablations de dispatch ; ne publier aucun type de catalogue.

**Sortie :** deux comportements existants passent par un Visitor unique et le troisième parcours
peut être ajouté sans troisième `switch`.

### INC-2 — Contrat Zod-first du catalogue

**Travail :** créer le dossier, types, schémas, invariant de doublons, façade et tests ; n'ajouter
aucune migration de template ; vérifier que les commentaires source sont anglais et concis.

**Sortie :** un hôte peut déclarer et valider un catalogue récursif sans modèle ni donnée de rendu.

### INC-3 — Liste ordonnée et index éphémère

**Travail :** implémenter l'aplatissement, l'index interne et leurs tests de pureté, ordre et listes
imbriquées.

**Sortie :** un consommateur obtient les libellés proposables et l'analyse dispose d'une résolution
O(F), sans cache global.

### INC-4 — Lectures localisées et compatibilité de portée

**Travail :** analyser expressions, nœuds, bandes, alias et attentes ; produire statuts,
diagnostics et warnings ; couvrir les matrices de §§7.4 à 7.8.

**Sortie :** chemin direct, membre d'élément, filtre, agrégat et groupe de lignes sont vérifiés dans
leur portée exacte, sans cascade ni donnée runtime.

### INC-5 — Surface publique et couture Designer

**Travail :** exporter la surface minimale depuis `core`, remplacer la prop opaque du Designer,
mettre à jour les tests de catalogues fermés et les deux documents DESIGN concernés.

**Sortie :** la prochaine brique UI consomme un contrat réel ; aucun Port, composant ou dépendance
nouveau n'est apparu.

### INC-6 — Recette et playground

**Travail :** écrire catalogue et variante incomplète de référence ; couvrir les trois oracles ;
ajouter la carte de démonstration ; vérifier qu'aucune clé de fixture ne fuit en production.

**Sortie :** le « prêt quand » de la roadmap est visible et automatisé.

### INC-7 — Ablations, ADR et clôture

**Travail :** jouer puis retirer chaque mutation de §10 ; écrire l'ADR d'exécution avec les écarts
réels ; fermer les questions des ADR 0001 à 0003 ; marquer C10 livré dans la roadmap ; marquer ce
plan périmé ; lancer les quatre portes dans l'ordre.

**Sortie :** C10 fait foi par son ADR et débloque C11/D1 sans prétendre livrer leur interface.

---

## 10. Preuves d'ablation

Chaque mutation doit faire rougir le test nommé sans dépendre d'une erreur de syntaxe.

| Mutation | Preuve attendue |
| :--- | :--- |
| remplacer la structure récursive par un record plat | liste d'objet ou liste de liste devient ambiguë et la recette échoue |
| accepter deux clés sœurs identiques | test de doublon ne reçoit plus son issue au second champ |
| accepter une clé interdite | test de grammaire et de pollution de prototype rougit |
| trier les champs par clé ou libellé | ordre du sélecteur diffère de l'ordre hôte |
| ne pas descendre dans les bandes | lecture d'en-tête ou de pied disparaît |
| dédupliquer les occurrences | deux nœuds fautifs ne donnent plus deux positions |
| résoudre un alias comme une racine | membre de ligne valide devient non déclaré |
| traverser implicitement une liste | `commande.lignes.montant` passe à tort |
| ne pas lier `filter.as` | lecture du prédicat devient non déclarée ou bloquée |
| ne pas lier `aggregate.as` | valeur agrégée perd son type d'élément |
| laisser fuir un alias vers un frère | branche sœur accepte un chemin local impossible |
| produire un diagnostic par descendant bloqué | source fautive déclenche une cascade |
| traiter `civil-date` comme toute chaîne | une chaîne générique passe dans `dateAdd` |
| ignorer l'attente `list` | boucle sur nombre devient compatible |
| ignorer l'attente héritée d'un `if` | branche textuelle sous arithmétique n'est plus signalée |
| rendre un warning de masquage bloquant | modèle à sémantique définie devient incompatible |
| interpoler `dataPath` dans `message` | test de message constant rougit |
| lire une valeur de rendu pour décider | l'API à deux arguments et la recette sans données ne compilent plus |
| modifier `collectTemplateDataPaths()` | suite historique de chemins rougit |
| ajouter un troisième `switch` d'expressions | contrôle de structure du Visitor rougit |
| incrémenter `CURRENT_SCHEMA_VERSION` | contrôle négatif de version et migrations rougit |
| conserver `Record<string, unknown>` au Designer | couture de type C10 n'est pas démontrée |

---

## 11. Définition de fini

C10 est fini lorsque toutes ces assertions sont vraies ensemble :

- J3 était démontrable avant le premier changement du lot ;
- le catalogue est Zod-first, récursif, ordonné et vide-possible ;
- aucune clé ou structure métier n'existe en production ;
- les quatre feuilles et les deux structures ont une sémantique écrite ;
- les doublons de clé sont refusés à leur position ;
- les libellés sont listables dans l'ordre hôte ;
- chaque lecture du flux et des bandes est localisée ;
- les quatre formes d'alias respectent la portée runtime ;
- les membres d'élément sont vérifiés contre le type de la liste source ;
- une liste n'est jamais traversée implicitement ;
- les attentes sont confirmées contre E4 et couvertes par une matrice ;
- une source cassée bloque ses descendants sans cascade ;
- les deux incompatibilités rendent des diagnostics structurés sûrs ;
- les masquages rendent des warnings non bloquants ;
- aucune valeur de rendu n'est lue ni exigée ;
- aucun schéma de `RenderRequest.data` n'existe ;
- l'évaluateur, `pathsOf()` et C10 passent par un Visitor d'expressions unique ;
- le Composite de document est parcouru par `visitNode()` ;
- `collectDataPaths()` et `collectTemplateDataPaths()` sont strictement inchangés en sortie ;
- la prop Designer porte `DataCatalogue` et reste optionnelle ;
- la recette complète, la variante sans prix et la variante de mauvaise structure passent ;
- le playground montre le critère sans prétendre livrer D4 ;
- les ADR 0001 à 0003 renvoient vers la décision C10 ;
- l'ADR d'exécution remplace ce plan et la roadmap marque C10 livré ;
- version de template, migrations et corpus historique sont inchangés ;
- aucun fichier protégé, manifeste ou dépendance n'a changé ;
- les quatre portes passent dans l'ordre avec au moins 90 % sur les quatre métriques.

---

## 12. Risques et réponses prévues

### Le catalogue devient un schéma de données Openview

Le risque principal est sémantique : ajouter `required`, des règles de validation ou des noms
préfabriqués ferait d'Openview le propriétaire de la donnée. La réponse est le contrôle de périmètre
de §2.3 et une recette qui ne transmet aucune valeur.

### L'analyse diverge du runtime

Un second interpréteur complet finirait par mentir. C10 limite son résultat aux attentes des chemins,
réemploie le Visitor et la pile lexicale, et laisse au runtime les fautes de formule sans catalogue.
Chaque changement ultérieur d'opérateur doit mettre à jour le Visitor et la matrice d'attentes dans
le même mouvement.

### E4 change les valeurs imprimables

C'est la raison du gate INC-0. La table D9 est un brouillon exécutable, pas une permission de coder
avant E4. Si E4 ajoute une déclaration persistée, C10 consomme sa forme finale sans la réinventer.

### Un catalogue profond épuise la pile Zod

Le schéma récursif partage ce risque avec l'AST. La première frontière réelle est le futur composant
Designer, qui devra appliquer un garde de forme avant `safeParse`. C10 ne généralise pas
`TemplateShapeError` à un payload qui n'est pas un template sans mandat. Si une entrée runtime du
catalogue apparaît pendant le lot, elle bloque la clôture jusqu'à ce qu'un garde au vocabulaire
exact soit décidé ; elle ne justifie ni cast ni parse en boucle.

### Les warnings de masquage deviennent bruyants

Ils sont émis une fois à la déclaration, pas à chaque lecture, et n'affectent pas `compatible`. Le
Designer décidera comment les présenter. Leur suppression exigerait de rouvrir explicitement la
dette de l'ADR 0002.

### Le poids M explose en compilateur statique

Le vocabulaire d'attentes est fermé et local. Pas d'unification générale, pas de sous-typage métier,
pas de validation de littéraux sans chemin, pas de trace de calcul. Une demande au-delà devient un
lot de barre de formule D7, pas un élargissement discret de C10.

### La surface publique devient trop large

Le Visitor reste interne. L'index et les descriptions de résultat intermédiaires restent internes.
Le barrel ne publie que le contrat hôte, l'aplatissement, le résultat de compatibilité et les types
structurés nécessaires à un consommateur.

---

## 13. Contrôle de périmètre avant exécution

1. confirmer que J3 est atteint, y compris E4 et la relecture métier consignée ;
2. préserver tous les changements utilisateur et obtenir une baseline propre ou explicitement
   isolée pour C10 ;
3. confirmer le prochain numéro d'ADR sans réserver un numéro déjà pris ;
4. relever la version courante du template et prouver qu'elle ne changera pas ;
5. relire la politique d'impression finale d'E4 et corriger D9 si nécessaire ;
6. confirmer que `collectTemplateDataPaths()` exclut toujours les alias et garde l'ordre
   `root/header/footer` ;
7. confirmer les quatre sites d'alias et l'absence de troisième site non planifié ;
8. compter les parcours d'expressions et poser INC-1 avant tout code C10 ;
9. lancer les quatre portes sur la baseline ;
10. refuser toute proposition qui inspecte ou parse `RenderRequest.data` ;
11. refuser toute clé, libellé, type fiscal, devise ou règle métier de production ;
12. ne pas ajouter de Port, dépendance, config, cache global ou API asynchrone ;
13. ne pas modifier les migrations, le corpus historique ou les fichiers protégés ;
14. arrêter et faire arbitrer si E4 rend la table d'attentes impossible sans type-checker général,
    si un catalogue doit être chargé depuis une source distante, ou si l'hôte demande qu'Openview
    valide ses instances de données : chacun de ces besoins change le lot.

